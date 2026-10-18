// Career save: the profile (day, funds, reputation, knowledge), the storeroom of blocks, and
// the state of each block you've worked on, in IndexedDB.
//
// A block regenerates exactly from its level and seed, so a save stores only what the player
// changed: each field quantised to 8 bits and stored as a difference from the fresh block,
// then gzipped. Voxels nobody touched restore to their exact original values.

const DB = 'fossil-hunter', VER = 2;
const Q = 127 / 4; // density (voxel units, +-LIM = 4) -> int8

let dbp = null;
function db() {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    const r = indexedDB.open(DB, VER);
    r.onupgradeneeded = (e) => {
      const d = r.result;
      if (e.oldVersion < 1) {
        d.createObjectStore('kv');
        d.createObjectStore('items', { keyPath: 'id' });
        d.createObjectStore('states');
      }
      // v2: baked display meshes of prepared specimens (bake.js), for the museum.
      if (e.oldVersion < 2) d.createObjectStore('display');
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}
async function tx(store, mode, fn) {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction(store, mode), s = t.objectStore(store);
    const out = fn(s);
    // A request resolves to its result, even when that's undefined (a missing key).
    t.oncomplete = () => res(out instanceof IDBRequest ? out.result : out);
    t.onerror = () => rej(t.error);
  });
}
const get = (store, key) => tx(store, 'readonly', (s) => s.get(key));
const put = (store, val, key) => tx(store, 'readwrite', (s) => (key === undefined ? s.put(val) : s.put(val, key)));
const del = (store, key) => tx(store, 'readwrite', (s) => s.delete(key));
const all = (store) => tx(store, 'readonly', (s) => s.getAll());

// ---- profile

const FRESH = { day: 1, funds: 250, rep: 0, knowledge: 0, started: null };

export async function profile() {
  return { ...FRESH, ...((await get('kv', 'profile')) ?? {}) };
}
export async function saveProfile(p) {
  await put('kv', p, 'profile');
  return p;
}

/**
 * End the day: visitors come to see what's on display and the gift shop sells; the takings,
 * reputation and new stock go into the profile, and the day moves on. Returns the day's result.
 */
export async function endDay() {
  const { dayResult } = await import('./economy.js');
  const p = await profile();
  const shown = (await listItems()).filter((it) => it.status === 'prepared' && it.where === 'museum' && !it.loanedTo);
  const r = dayResult(p, shown);
  // A school group may book the tour.
  const T = await import('./tours.js');
  const t = tourStops(p, shown);
  const school = t.length ? T.schoolVisit(T.rate(t).stars, p.rep ?? 0) : null;
  if (school) {
    r.school = { ...school, tour: p.tour.name || 'your tour' };
    r.earned += school.fee;
    r.repGain += school.rep;
  }
  p.funds = Math.round((p.funds + r.earned) * 100) / 100;
  p.rep = (p.rep ?? 0) + r.repGain;
  p.stock = r.stock;
  p.day++;
  p.lastDay = r;
  // A new day at the dig: cuts and close looks come back; spent leases are given up.
  p.leases = (p.leases ?? []).filter((l) => l.cutsLeft > 0).map((l) => ({ ...l, cutsToday: 0, looks: 4 }));
  // The board turns over and loans come home.
  const { refreshBoard, returnLoans } = await import('./contracts.js');
  r.expired = refreshBoard(p).expired;
  const back = returnLoans(p, await listItems());
  r.returned = back.map((it) => it.name || it.level);
  if (back.length) await tx('items', 'readwrite', (s) => back.forEach((it) => s.put(it)));
  await saveProfile(p);
  return r;
}

/** The tour's stops that are still on display, as [{ item, card }]. */
export function tourStops(p, shown) {
  const byId = new Map(shown.map((it) => [it.id, it]));
  return (p.tour?.stops ?? []).filter((s) => byId.has(s.id)).map((s) => ({ item: byId.get(s.id), card: s.card ?? '' }));
}

/** Change the tour (name and stops). */
export async function saveTour(tour) {
  const p = await profile();
  p.tour = tour;
  await saveProfile(p);
}

// ---- contracts and lots (contracts.js has the rules)

async function levelOf(id) {
  const { LEVELS, SPECIAL } = await import('./data.js');
  return LEVELS.find((l) => l.id === id) ?? SPECIAL[id];
}
async function addBlocks(ids, extra) {
  const items = [];
  for (const id of ids) items.push(newItem(await levelOf(id), Math.floor(Math.random() * 1e6), extra));
  if (items.length) await tx('items', 'readwrite', (s) => items.forEach((it) => s.put(it)));
  return items;
}

/** Take on a contract; any blocks it sends go on the shelf. Returns an error string or null. */
export async function acceptContract(id) {
  const C = await import('./contracts.js');
  const r = C.accept(await profile(), id);
  if (typeof r === 'string') return r;
  await addBlocks(r.blocks, { from: C.findContract(id).from, contract: id });
  await saveProfile(r.p);
  return null;
}

/** Hand the qualifying specimens to the client and take the reward. Returns an error or null. */
export async function deliverContract(id) {
  const C = await import('./contracts.js');
  const r = C.deliver(await profile(), id, await listItems());
  if (typeof r === 'string') return r;
  await tx('items', 'readwrite', (s) => r.items.forEach((it) => s.put(it)));
  await saveProfile(r.p);
  return null;
}

// ---- dig sites (dig.js has the rules)

/** Take out a lease on a site. Returns an error or null. */
export async function takeLease(siteId) {
  const D = await import('./dig.js');
  const r = D.lease(await profile(), siteId, Math.floor(Math.random() * 1e9));
  if (typeof r === 'string') return r;
  await saveProfile(r.p);
  return null;
}

/** The face of a lease as it stands now (cells already cut out are marked taken). */
export async function leaseFace(i) {
  const D = await import('./dig.js');
  const p = await profile(), l = p.leases?.[i];
  if (!l) return null;
  const site = D.findSite(l.site), f = D.face(site, l.seed);
  for (const c of l.cuts) if (c.col !== undefined) {
    const cell = f.cells.find((x) => x.col === c.col && x.row === c.row);
    if (cell) cell.taken = true;
  }
  return { p, l, site, f };
}

/**
 * Saw a block out at (x, y) on lease i. Returns { result, item? } or an error string. A block
 * with something in it goes on the shelf; barren rock goes on the spoil heap.
 */
export async function digCut(i, x, y) {
  const D = await import('./dig.js');
  const st = await leaseFace(i);
  if (!st) return 'No such lease.';
  const { p, l, site, f } = st;
  if (l.cutsLeft <= 0) return 'The lease is used up.';
  if (l.cutsToday >= 3) return 'That is three blocks today: head home and come back tomorrow.';
  const r = D.cut(f, x, y);
  l.cutsLeft--;
  l.cutsToday = (l.cutsToday ?? 0) + 1;
  let item = null;
  if (!r.barren) {
    const lv = await levelOf(site.level);
    item = newItem(lv, r.cell.seed, { from: site.name, dug: true, sawn: r.sawn ?? null });
    await putItem(item);
  }
  l.cuts.push({ x, y, col: r.cell?.col, row: r.cell?.row, result: r.barren ? 'barren' : r.whole ? 'whole' : 'sawn' });
  p.leases = p.leases.map((x, k) => (k === i ? l : x));
  await saveProfile(p);
  return { result: r.barren ? 'barren' : r.whole ? 'whole' : 'sawn', item };
}

/** Look closely at a sign on the face (a few looks a day). */
export async function digLook(i, col, row) {
  const p = await profile(), l = p.leases?.[i];
  if (!l) return 'No such lease.';
  l.looked ??= [];
  if (l.looked.some(([c, r]) => c === col && r === row)) return null;
  if ((l.looks ?? 0) <= 0) return 'No more close looks today.';
  l.looks--;
  l.looked.push([col, row]);
  await saveProfile(p);
  return null;
}

/** Learn an idea on the science track. Returns an error or null. */
export async function learnNode(id) {
  const r = (await import('./science.js')).learn(await profile(), id);
  if (typeof r === 'string') return r;
  await saveProfile(r);
  return null;
}

/** Buy a lot off the noticeboard; its blocks go on the shelf. Returns an error or null. */
export async function buyLot(id) {
  const C = await import('./contracts.js');
  const r = C.buyLot(await profile(), id);
  if (typeof r === 'string') return r;
  await addBlocks(r.blocks, { from: r.lot.title.split(':')[0].toLowerCase(), lot: id });
  await saveProfile(r.p);
  return null;
}

// ---- storeroom

export const listItems = () => all('items');
export const getItem = (id) => get('items', id);
export const putItem = (it) => put('items', it);
export async function removeItem(id) {
  await del('items', id);
  await del('states', id);
  await del('display', id);
}

export function newItem(level, seed, extra = {}) {
  return {
    id: `b${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`,
    level: level.id, special: !!level.hidden, seed, status: 'raw', name: '', created: Date.now(),
    minutes: 0, exposure: 0, integrity: 1, value: 0, where: null, ...extra,
  };
}

/** First visit: a career begins with a few blocks on the storeroom shelf. */
export async function ensureCareer(LEVELS) {
  const p = await profile();
  if (p.started) {
    // Careers from before the board existed get one now.
    if (p.boardDay === undefined) {
      (await import('./contracts.js')).refreshBoard(p);
      await saveProfile(p);
    }
    return p;
  }
  p.started = Date.now();
  (await import('./contracts.js')).refreshBoard(p);
  const starters = ['wheeler', 'beecher', 'calvert', 'cincinnati']
    .map((id) => LEVELS.find((l) => l.id === id)).filter(Boolean)
    .map((lv) => newItem(lv, Math.floor(Math.random() * 1e6), { from: 'the museum you inherited' }));
  // One transaction for the lot (each one costs at least a frame on a busy page).
  await tx('items', 'readwrite', (s) => starters.forEach((it) => s.put(it)));
  return saveProfile(p);
}

// ---- block state

async function gzip(u8) {
  const s = new Blob([u8]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(s).arrayBuffer());
}
async function gunzip(u8) {
  const s = new Blob([u8]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(s).arrayBuffer());
}

const CHUNK = 1 << 18;
const breathe = () => new Promise((r) => setTimeout(r, 0));

const q8 = (x) => Math.max(-127, Math.min(127, Math.round(x * Q)));

/**
 * Everything the player has changed about a block. Fields: rock and fossil XORed with the
 * fresh block, frost and microcracking as bytes.
 */
export async function encodeState(game, { background = false } = {}) {
  const sp = game.sp, v = sp.vol, n = v.count;
  const buf = new Uint8Array(n * 4);
  const rock = buf.subarray(0, n), fos = buf.subarray(n, 2 * n), frost = buf.subarray(2 * n, 3 * n), dmg = buf.subarray(3 * n);
  // In the background (autosave), hand the thread back between chunks so a headset never stalls.
  for (let i0 = 0; i0 < n; i0 += CHUNK) {
    const i1 = Math.min(n, i0 + CHUNK);
    for (let i = i0; i < i1; i++) {
      // XOR with the fresh block: reversible, and zero (compresses to nothing) where untouched.
      rock[i] = (q8(v.rock[i]) ^ q8(v.rock0[i])) & 255;
      fos[i] = (q8(v.fossil[i]) ^ q8(v.fossil0[i])) & 255;
      frost[i] = Math.min(255, v.frost[i]);
      dmg[i] = Math.round(Math.min(1, v.dmg[i]) * 255);
    }
    if (background && i1 < n) await breathe();
  }
  const m = game.mind;
  return {
    v: 1, n,
    fields: await gzip(buf),
    parts: sp.parts.map((p) => p.alive),
    stats: game.tools.stats, removed: game.tools.removed,
    minutes: (performance.now() - game.started) / 60000,
    mind: { cx: m.cx, cy: m.cy, yaw: m.yaw, len: m.len, height: m.height, shape: [...m.shape], dome: [...m.dome], species: m.species, visible: m.visible, placed: m.placed },
    milestones: [...(game.milestones ?? [])], found: [...(game.found ?? [])],
    notes: game.notes, guess: game.guess, usage: game.usage,
  };
}

/** Apply a saved state to a freshly built block (before it's meshed). */
export async function applyState(game, st) {
  const sp = game.sp, v = sp.vol, n = v.count;
  if (st.n !== n) throw new Error('saved block does not match');
  const buf = await gunzip(st.fields);
  for (let i = 0; i < n; i++) {
    const dr = buf[i], df = buf[n + i];
    if (dr) v.rock[i] = ((((dr ^ q8(v.rock0[i])) & 255) << 24) >> 24) / Q;
    if (df) v.fossil[i] = ((((df ^ q8(v.fossil0[i])) & 255) << 24) >> 24) / Q;
    v.frost[i] = buf[2 * n + i];
    v.dmg[i] = buf[3 * n + i] / 255;
  }
  st.parts?.forEach((alive, i) => sp.parts[i] && (sp.parts[i].alive = alive));
  Object.assign(game.tools.stats, st.stats ?? {});
  game.tools.removed = st.removed ?? 0;
  game.started = performance.now() - (st.minutes ?? 0) * 60000;
  const m = game.mind, s = st.mind;
  if (s) {
    Object.assign(m, { cx: s.cx, cy: s.cy, yaw: s.yaw, len: s.len, height: s.height, species: s.species, visible: s.visible, placed: s.placed });
    m.shape.set(s.shape);
    m.dome.set(s.dome);
    m.version++;
    if (m.placed) m.rebuildMask();
  }
  game.milestones = new Set(st.milestones ?? []);
  game.found = new Set(st.found ?? [0]);
  game.notes = st.notes ?? [];
  game.guess = st.guess ?? { matrix: null, fossil: null };
  game.usage = st.usage ?? {};
}

export const saveState = (id, st) => put('states', st, id);
export const saveDisplay = (id, mesh) => put('display', mesh, id);
export const loadDisplay = (id) => get('display', id);
export const loadState = (id) => get('states', id);
