// The shared world: publishing your museum, visiting other people's, and auctions.
// Talks to api/world.php. Players are anonymous: a random key kept in this browser.
//
// Specimens travel as their baked display mesh (bake.js), packed small: positions quantised
// to 16 bits inside the piece's bounds, normals to 8 bits, then gzipped.

const API = 'api/world.php';

/** This browser's player key (made on first use). */
export function key() {
  let k = null;
  try { k = localStorage.getItem('fh-key'); } catch {}
  if (!k) {
    k = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
    try { localStorage.setItem('fh-key', k); } catch {}
  }
  return k;
}

async function call(a, { method = 'GET', body, query = '', binary = false } = {}) {
  const r = await fetch(`${API}?a=${a}${query}`, {
    method, body: binary ? body : body && JSON.stringify(body),
    headers: { 'X-FH-Key': key(), 'Content-Type': binary ? 'application/octet-stream' : 'application/json' },
  });
  if (a === 'mesh' && method === 'GET') {
    if (!r.ok) throw new Error('model unavailable');
    return new Uint8Array(await r.arrayBuffer());
  }
  let data;
  try { data = await r.json(); } catch { throw new Error(`the server didn't answer (${r.status})`); }
  if (!r.ok) throw new Error(data.error || r.status);
  return data;
}

// ---- packing meshes

async function gzip(u8) {
  return new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
}
async function gunzip(u8) {
  return new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
}

/** A baked mesh (bake.js) -> gzipped bytes. */
export async function packMesh(m) {
  const lo = m.lo, span = m.hi.map((h, i) => Math.max(1e-6, h - lo[i]));
  const parts = [], head = { v: 1, lo, hi: m.hi, tris: m.tris, opal: m.opal ?? null, groups: {} };
  let off = 0;
  const add = (arr) => {
    // Keep every block 4-byte aligned so typed views can sit on the buffer directly.
    const b = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
    const pad = (4 - (b.length % 4)) % 4;
    parts.push(b, new Uint8Array(pad));
    const at = off;
    off += b.length + pad;
    return [at, arr.length];
  };
  for (const name of ['rock', 'shell']) {
    const g = m[name];
    if (!g) continue;
    const n = g.pos.length / 3, h = (head.groups[name] = {});
    const pos = new Uint16Array(n * 3), nrm = new Int8Array(n * 3);
    for (let i = 0; i < n * 3; i++) {
      pos[i] = Math.round(((g.pos[i] - lo[i % 3]) / span[i % 3]) * 65535);
      nrm[i] = Math.round(Math.max(-1, Math.min(1, g.nrm[i])) * 127);
    }
    h.pos = add(pos);
    h.nrm = add(nrm);
    h.col = add(g.col);
    h.idx = add(n < 65536 ? Uint16Array.from(g.idx) : g.idx);
    h.wide = n >= 65536;
    for (const e of ['rough', 'metal', 'opal']) if (g[e]) h[e] = add(Uint8Array.from(g[e], (x) => Math.round(Math.max(0, Math.min(1, x)) * 255)));
  }
  const hj = new TextEncoder().encode(JSON.stringify(head));
  const out = new Uint8Array(4 + hj.length + ((4 - ((4 + hj.length) % 4)) % 4) + off);
  new DataView(out.buffer).setUint32(0, hj.length, true);
  out.set(hj, 4);
  let p = 4 + hj.length + ((4 - ((4 + hj.length) % 4)) % 4);
  for (const b of parts) { out.set(b, p); p += b.length; }
  return gzip(out);
}

/** Gzipped bytes -> a mesh in the shape museum.js expects (as stored by bake.js). */
export async function unpackMesh(gz) {
  const u = await gunzip(gz);
  const hl = new DataView(u.buffer, u.byteOffset).getUint32(0, true);
  const head = JSON.parse(new TextDecoder().decode(u.subarray(4, 4 + hl)));
  const base = 4 + hl + ((4 - ((4 + hl) % 4)) % 4);
  const buf = u.buffer.slice(u.byteOffset + base);
  const m = { lo: head.lo, hi: head.hi, tris: head.tris, opal: head.opal };
  const span = head.hi.map((h, i) => h - head.lo[i]);
  for (const [name, h] of Object.entries(head.groups)) {
    const view = (T, [at, len]) => new T(buf, at, len);
    const q = view(Uint16Array, h.pos), qn = view(Int8Array, h.nrm);
    const pos = new Float32Array(q.length), nrm = new Float32Array(q.length);
    for (let i = 0; i < q.length; i++) {
      pos[i] = head.lo[i % 3] + (q[i] / 65535) * span[i % 3];
      nrm[i] = qn[i] / 127;
    }
    const g = { pos, nrm, col: view(Uint8Array, h.col).slice(), idx: Uint32Array.from(view(h.wide ? Uint32Array : Uint16Array, h.idx)) };
    for (const e of ['rough', 'metal', 'opal']) if (h[e]) g[e] = Float32Array.from(view(Uint8Array, h[e]), (x) => x / 255);
    m[name] = g;
  }
  return m;
}

// ---- museums

export async function uploadMesh(m) {
  return (await call('mesh', { method: 'POST', body: await packMesh(m), binary: true })).h;
}
const meshCache = new Map();
export function fetchMesh(h) {
  if (!meshCache.has(h)) meshCache.set(h, call('mesh', { query: `&h=${h}` }).then(unpackMesh));
  return meshCache.get(h);
}
export const listMuseums = () => call('museums');
export const getMuseum = (id) => call('museum', { query: `&id=${encodeURIComponent(id)}` });
export const publish = (body) => call('publish', { method: 'POST', body });
export const report = (kind, id) => call('report', { method: 'POST', body: { kind, id } });

// ---- auctions

export const listAuctions = () => call('auctions');
export const getAuction = (id) => call('auction', { query: `&id=${id}` });
export const listForSale = (body) => call('list', { method: 'POST', body });
export const bid = (id, amount, name) => call('bid', { method: 'POST', body: { id, amount, name } });
export const myAuctions = () => call('mine');
export const claim = (id) => call('claim', { method: 'POST', body: { id } });
