// Baking: a prepared specimen's surface merged, welded and simplified for display.
//   node test/bake.test.js
import { LEVELS } from '../src/data.js';
import { Specimen } from '../src/specimen.js';
import { meshChunk } from '../src/mesher.js';
import { buildFine, shadeFine } from '../src/finefossil.js';
import { bake } from '../src/bake.js';

const sp = new Specimen(LEVELS.find((l) => l.id === 'wheeler'), { seed: 5 });
const v = sp.vol;
// Prepared: strip the rock above the bedding.
const k0 = Math.floor((sp.z0 - v.origin[2]) / v.voxel) + 1;
for (let n = k0 * v.sz; n < v.count; n++) if (v.fossil[n] <= 0) v.rock[n] = Math.min(v.rock[n], -1.2);
const fine = buildFine({ origin: v.origin, voxel: v.voxel, nx: v.nx, ny: v.ny, nz: v.nz, field: v.fossil0, fn: (x, y, z) => sp.tri.field(x, y, z) }, 1.5);
sp.fine = true;
const rock = [];
for (let z = 0; z < v.cz; z++) for (let y = 0; y < v.cy; y++) for (let x = 0; x < v.cx; x++) rock.push(meshChunk(sp, x, y, z));
const shell = fine.map((ch) => {
  const nv = ch.nv, out = { pos: new Float32Array(nv * 3), col: new Float32Array(nv * 3), rough: new Float32Array(nv), metal: new Float32Array(nv), grain: new Float32Array(nv), opal: new Float32Array(nv) };
  const idx = shadeFine(sp, ch, out);
  return { ...out, nrm: ch.nrm, idx };
});
const tris = (ps) => ps.filter(Boolean).reduce((a, p) => a + p.idx.length / 3, 0);
const t0 = performance.now();
const b = await bake({ rock, shell });
const ms = performance.now() - t0;
const bytes = ['rock', 'shell'].reduce((a, k) => a + ['pos', 'nrm', 'col', 'idx', 'rough', 'metal', 'opal'].reduce((s, f) => s + (b[k]?.[f]?.byteLength ?? 0), 0), 0);
console.log(`input ${Math.round(tris(rock))} rock + ${Math.round(tris(shell))} shell triangles -> ${b.tris} in ${ms.toFixed(0)} ms, ${(bytes / 1024).toFixed(0)} KB`);
const ok = b.tris > 5000 && b.tris < 45000 && b.rock && b.shell && b.hi[0] > b.lo[0];
console.log(ok ? 'ok' : 'FAIL');
process.exit(ok ? 0 : 1);
