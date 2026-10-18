// Contact sheet of generated shells and teeth -> PLY for a Blender look.
//   node test/shells-sheet.js OUT.ply
import { writeFileSync } from 'node:fs';
import { sampleShell, makeShell } from '../src/shells.js';
import { meshGrid } from '../src/mesher.js';

const kinds = ['ammonite', 'ammonite', 'gastropod', 'gastropod', 'bivalve', 'bivalve', 'brachiopod', 'brachiopod', 'shark_tooth', 'shark_tooth'];
const cols = { ammonite: [0.45, 0.33, 0.2], gastropod: [0.6, 0.55, 0.45], bivalve: [0.55, 0.5, 0.42], brachiopod: [0.4, 0.33, 0.24], shark_tooth: [0.1, 0.1, 0.11] };
const P = [], C = [], I = [];
kinds.forEach((k, n) => {
  const spec = sampleShell(n * 17 + 3, k);
  spec.pose.yaw = 0.4;
  const f = makeShell(spec, { scale: 1 });
  const b = f.restOnPlane(0);
  const vx = 0.006, dims = [0, 1, 2].map((a) => Math.ceil((b.hi[a] - b.lo[a]) / vx) + 3);
  const field = new Float32Array(dims[0] * dims[1] * dims[2]);
  for (let z = 0; z < dims[2]; z++) for (let y = 0; y < dims[1]; y++) for (let x = 0; x < dims[0]; x++)
    field[x + y * dims[0] + z * dims[0] * dims[1]] = Math.max(-4, Math.min(4, -f.field(b.lo[0] + (x - 1) * vx, b.lo[1] + (y - 1) * vx, b.lo[2] + (z - 1) * vx) / vx));
  const m = meshGrid(field, new Float32Array(field.length), dims, (x, y, z, ff, o) => {
    const t = f.tint(b.lo[0] + (x - 1) * vx, b.lo[1] + (y - 1) * vx, b.lo[2] + (z - 1) * vx);
    const c = t ?? cols[k]; o[0] = c[0]; o[1] = c[1]; o[2] = c[2];
  }, { fossilMat: { gloss: 0, metal: 0 } });
  const ox = (n % 5) * 1.25 - 2.5, oy = Math.floor(n / 5) * -1.25 + 0.6, base = P.length / 3;
  for (let q = 0; q < m.pos.length / 3; q++) {
    P.push(b.lo[0] + (m.pos[q * 3] - 1) * vx - (b.lo[0] + b.hi[0]) / 2 + ox, b.lo[1] + (m.pos[q * 3 + 1] - 1) * vx - (b.lo[1] + b.hi[1]) / 2 + oy, b.lo[2] + (m.pos[q * 3 + 2] - 1) * vx);
    C.push(m.col[q * 3], m.col[q * 3 + 1], m.col[q * 3 + 2]);
  }
  for (const i of m.idx) I.push(i + base);
  console.log(k, 'tris', m.idx.length / 3);
});
const nv = P.length / 3, nf = I.length / 3;
const head = `ply\nformat binary_little_endian 1.0\nelement vertex ${nv}\nproperty float x\nproperty float y\nproperty float z\nproperty uchar red\nproperty uchar green\nproperty uchar blue\nelement face ${nf}\nproperty list uchar int vertex_indices\nend_header\n`;
const vb = Buffer.alloc(nv * 15), fb = Buffer.alloc(nf * 13);
const enc = (c) => Math.round(255 * Math.min(1, c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055));
for (let i = 0; i < nv; i++) { vb.writeFloatLE(P[i * 3], i * 15); vb.writeFloatLE(P[i * 3 + 1], i * 15 + 4); vb.writeFloatLE(P[i * 3 + 2], i * 15 + 8); vb[i * 15 + 12] = enc(C[i * 3]); vb[i * 15 + 13] = enc(C[i * 3 + 1]); vb[i * 15 + 14] = enc(C[i * 3 + 2]); }
for (let f = 0; f < nf; f++) { fb[f * 13] = 3; for (let e = 0; e < 3; e++) fb.writeInt32LE(I[f * 3 + e], f * 13 + 1 + e * 4); }
writeFileSync(process.argv[2], Buffer.concat([Buffer.from(head), vb, fb]));
