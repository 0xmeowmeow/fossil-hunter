// Baking a finished specimen into a light display mesh: the museum shows dozens of these, so
// each is the block's surface merged, welded and simplified (meshoptimizer) to a few tens of
// thousands of triangles, and stored with the save. Rock and shell stay separate meshes so the
// shell keeps its gloss, metal and opal.
//
// Input groups are lists of surface pieces { pos, nrm, col, idx, rough?, metal?, opal? }
// (float arrays, colours linear 0..1). Output per group: { pos, nrm, col (Uint8 RGB), idx,
// rough, metal, opal } plus the bounds of the whole piece.

import { MeshoptSimplifier } from 'meshoptimizer';

// Positions on the same 1e-4 grid (5 microns on a 5 cm specimen) are one vertex. Keys pack the
// three grid coordinates into one number (exact below 2^53) for a fast Map.
const WELD = 1e-4, K = 65536, M = 131072;

/** Concatenate pieces into one indexed mesh, welding identical vertices across seams. */
function merge(pieces, extras) {
  let nv = 0, ni = 0;
  for (const p of pieces) { nv += p.pos.length / 3; ni += p.idx.length; }
  const map = new Map(), remap = new Uint32Array(nv);
  const pos = [], nrm = [], col = [], ex = Object.fromEntries(extras.map((k) => [k, []]));
  let base = 0, out = 0;
  const key = (x, y, z) => ((Math.round(x / WELD) + K) * M + (Math.round(y / WELD) + K)) * M + (Math.round(z / WELD) + K);
  for (const p of pieces) {
    const n = p.pos.length / 3;
    for (let i = 0; i < n; i++) {
      const x = p.pos[i * 3], y = p.pos[i * 3 + 1], z = p.pos[i * 3 + 2];
      const k = key(x, y, z);
      let v = map.get(k);
      if (v === undefined) {
        v = out++;
        map.set(k, v);
        pos.push(x, y, z);
        nrm.push(p.nrm[i * 3], p.nrm[i * 3 + 1], p.nrm[i * 3 + 2]);
        col.push(p.col[i * 3], p.col[i * 3 + 1], p.col[i * 3 + 2]);
        for (const e of extras) ex[e].push(p[e]?.[i] ?? 0);
      }
      remap[base + i] = v;
    }
    base += n;
  }
  const idx = new Uint32Array(ni);
  let o = 0;
  base = 0;
  for (const p of pieces) {
    for (let i = 0; i < p.idx.length; i++) idx[o++] = remap[base + p.idx[i]];
    base += p.pos.length / 3;
  }
  return { pos: new Float32Array(pos), nrm: new Float32Array(nrm), col: new Float32Array(col), idx, ex };
}

/** Simplify to about `tris` triangles and drop unused vertices. */
function simplify(m, tris, extras) {
  const target = Math.min(m.idx.length, tris * 3);
  let idx = m.idx;
  if (target < m.idx.length) {
    const [out] = MeshoptSimplifier.simplify(m.idx, m.pos, 3, target, 0.02, ['LockBorder']);
    idx = out;
  }
  // Compact: keep only the vertices still used.
  const used = new Int32Array(m.pos.length / 3).fill(-1);
  let n = 0;
  for (const i of idx) if (used[i] < 0) used[i] = n++;
  const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), col = new Uint8Array(n * 3);
  const ex = Object.fromEntries(extras.map((k) => [k, new Float32Array(n)]));
  for (let i = 0; i < used.length; i++) {
    const j = used[i];
    if (j < 0) continue;
    for (let c = 0; c < 3; c++) {
      pos[j * 3 + c] = m.pos[i * 3 + c];
      nrm[j * 3 + c] = m.nrm[i * 3 + c];
      // Linear -> sRGB bytes (the display material converts back).
      col[j * 3 + c] = Math.round(255 * Math.pow(Math.min(1, Math.max(0, m.col[i * 3 + c])), 1 / 2.2));
    }
    for (const e of extras) ex[e][j] = m.ex[e][i];
  }
  const out = new Uint32Array(idx.length);
  for (let i = 0; i < idx.length; i++) out[i] = used[idx[i]];
  return { pos, nrm, col, idx: out, ...ex };
}

/**
 * groups: { rock: [pieces], shell: [pieces] }. Returns { rock, shell, lo, hi, tris } ready to
 * store (typed arrays only).
 */
export async function bake(groups, { rockTris = 14000, shellTris = 26000 } = {}) {
  await MeshoptSimplifier.ready;
  const out = { tris: 0 };
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const [name, pieces, tris, extras] of [['rock', groups.rock, rockTris, []], ['shell', groups.shell, shellTris, ['rough', 'metal', 'opal']]]) {
    const live = pieces.filter((p) => p && p.idx.length);
    if (!live.length) continue;
    const m = simplify(merge(live, extras), tris, extras);
    for (let i = 0; i < m.pos.length; i += 3) for (let c = 0; c < 3; c++) {
      if (m.pos[i + c] < lo[c]) lo[c] = m.pos[i + c];
      if (m.pos[i + c] > hi[c]) hi[c] = m.pos[i + c];
    }
    out[name] = m;
    out.tris += m.idx.length / 3;
  }
  out.lo = lo;
  out.hi = hi;
  return out;
}
