// Node checks for the simulation core: build every level, mesh it, check the mesh is
// closed and outward-facing, and optionally export a PLY (--ply DIR) for a Blender look.

import { writeFileSync, mkdirSync } from 'node:fs';
import { LEVELS } from '../src/data.js';
import { Specimen } from '../src/specimen.js';
import { meshChunk } from '../src/mesher.js';

const args = process.argv.slice(2);
const plyDir = args.includes('--ply') ? args[args.indexOf('--ply') + 1] : null;
const only = args.includes('--level') ? args[args.indexOf('--level') + 1] : null;

export function meshAll(sp) {
  const v = sp.vol;
  const parts = [];
  for (let z = 0; z < v.cz; z++) for (let y = 0; y < v.cy; y++) for (let x = 0; x < v.cx; x++) {
    const m = meshChunk(sp, x, y, z);
    if (m) parts.push(m);
  }
  return parts;
}

function merge(parts) {
  let nv = 0, ni = 0;
  for (const p of parts) { nv += p.pos.length / 3; ni += p.idx.length; }
  const pos = new Float32Array(nv * 3), col = new Float32Array(nv * 3), idx = new Uint32Array(ni);
  let ov = 0, oi = 0;
  for (const p of parts) {
    pos.set(p.pos, ov * 3);
    col.set(p.col, ov * 3);
    for (let i = 0; i < p.idx.length; i++) idx[oi + i] = p.idx[i] + ov;
    ov += p.pos.length / 3;
    oi += p.idx.length;
  }
  return { pos, col, idx };
}

/** Chunks are meshed separately, so weld by position before checking topology. */
function checkClosed(m) {
  const key = (i) => `${m.pos[i * 3].toFixed(5)},${m.pos[i * 3 + 1].toFixed(5)},${m.pos[i * 3 + 2].toFixed(5)}`;
  const id = new Map(), weld = new Uint32Array(m.pos.length / 3);
  for (let i = 0; i < weld.length; i++) {
    const k = key(i);
    if (!id.has(k)) id.set(k, id.size);
    weld[i] = id.get(k);
  }
  const edges = new Map();
  for (let t = 0; t < m.idx.length; t += 3) {
    for (let e = 0; e < 3; e++) {
      const a = weld[m.idx[t + e]], b = weld[m.idx[t + ((e + 1) % 3)]];
      const k = `${a},${b}`;
      edges.set(k, (edges.get(k) || 0) + 1);
    }
  }
  let open = 0, flipped = 0;
  for (const [k, c] of edges) {
    const [a, b] = k.split(',');
    const back = edges.get(`${b},${a}`) || 0;
    if (!back) open++;
    if (c > 1) flipped++;
  }
  return { open, flipped, edges: edges.size };
}

function signedVolume(m) {
  let s = 0;
  for (let t = 0; t < m.idx.length; t += 3) {
    const a = m.idx[t] * 3, b = m.idx[t + 1] * 3, c = m.idx[t + 2] * 3;
    const p = m.pos;
    s += p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1]) - p[a + 1] * (p[b] * p[c + 2] - p[b + 2] * p[c]) + p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c]);
  }
  return s / 6;
}

function writePly(path, m) {
  const nv = m.pos.length / 3, nf = m.idx.length / 3;
  const head = `ply\nformat binary_little_endian 1.0\nelement vertex ${nv}\nproperty float x\nproperty float y\nproperty float z\nproperty uchar red\nproperty uchar green\nproperty uchar blue\nelement face ${nf}\nproperty list uchar int vertex_indices\nend_header\n`;
  const vb = Buffer.alloc(nv * 15), fb = Buffer.alloc(nf * 13);
  const enc = (c) => Math.round(255 * Math.min(1, c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055));
  for (let i = 0; i < nv; i++) {
    vb.writeFloatLE(m.pos[i * 3], i * 15); vb.writeFloatLE(m.pos[i * 3 + 1], i * 15 + 4); vb.writeFloatLE(m.pos[i * 3 + 2], i * 15 + 8);
    vb[i * 15 + 12] = enc(m.col[i * 3]); vb[i * 15 + 13] = enc(m.col[i * 3 + 1]); vb[i * 15 + 14] = enc(m.col[i * 3 + 2]);
  }
  for (let f = 0; f < nf; f++) {
    fb[f * 13] = 3;
    for (let e = 0; e < 3; e++) fb.writeInt32LE(m.idx[f * 3 + e], f * 13 + 1 + e * 4);
  }
  writeFileSync(path, Buffer.concat([Buffer.from(head), vb, fb]));
}

/** Debug: cut the rock down to the bedding plane over the fossil's footprint. */
function reveal(sp) {
  const v = sp.vol, pad = 0.05;
  for (let k = 0; k < v.nz; k++) for (let j = 0; j < v.ny; j++) for (let i = 0; i < v.nx; i++) {
    const [x, y, z] = v.pos(i, j, k);
    if (x < sp.fLo[0] - pad || x > sp.fHi[0] + pad || y < sp.fLo[1] - pad || y > sp.fHi[1] + pad) continue;
    const n = v.idx(i, j, k);
    v.rock[n] = Math.min(v.rock[n], (sp.z0 - z) / v.voxel - 0.3);
  }
}

let failed = 0;
for (const level of LEVELS) {
  if (only && level.id !== only) continue;
  let t0 = performance.now();
  const sp = new Specimen(level);
  const tBuild = performance.now() - t0;
  if (args.includes('--reveal')) reveal(sp);
  t0 = performance.now();
  const parts = meshAll(sp);
  const tMesh = performance.now() - t0;
  const m = merge(parts);
  const c = checkClosed(m);
  const vol = signedVolume(m);
  const v = sp.vol;
  console.log(
    `${level.id.padEnd(10)} grid ${v.nx}x${v.ny}x${v.nz} (${(v.count / 1e6).toFixed(2)}M, voxel ${v.voxel.toFixed(4)})  ` +
    `build ${tBuild.toFixed(0)}ms  mesh ${tMesh.toFixed(0)}ms  ${parts.length} chunks  ${(m.idx.length / 3 / 1e3).toFixed(0)}k tris  ` +
    `open ${c.open}  non-manifold ${c.flipped}  vol ${vol.toFixed(4)}  spines ${sp.parts.length}  targets ${sp.targets.length}`,
  );
  if (c.open || vol <= 0) {
    console.log('  FAIL: mesh not closed / not outward');
    failed++;
  }
  if (plyDir) {
    mkdirSync(plyDir, { recursive: true });
    writePly(`${plyDir}/${level.id}.ply`, m);
  }
}
process.exit(failed ? 1 : 0);
