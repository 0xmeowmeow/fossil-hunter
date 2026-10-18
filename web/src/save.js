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
    t.oncomplete = () => res(out?.result ?? out);
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
  if (p.started) return p;
  p.started = Date.now();
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
