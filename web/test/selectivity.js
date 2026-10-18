// Selectivity probe: one second of each tool on bare matrix, and one second on exposed
// shell, per level. This is the contrast ladder in numbers.
//
//   node test/selectivity.js

import { LEVELS } from '../src/data.js';
import { Specimen } from '../src/specimen.js';
import { Tools } from '../src/tools.js';

const dt = 1 / 30;
const setups = [
  ['large scribe', 'scribe_large', null],
  ['fine scribe', 'scribe_fine', null],
  ['abr bicarb', 'abrader', 'bicarb'],
  ['abr dolomite', 'abrader', 'dolomite'],
  ['abr Al2O3', 'abrader', 'alox'],
];

function reveal(sp) {
  const v = sp.vol, pad = 0.05;
  for (let k = 0; k < v.nz; k++) for (let j = 0; j < v.ny; j++) for (let i = 0; i < v.nx; i++) {
    const [x, y, z] = v.pos(i, j, k);
    if (x < sp.fLo[0] - pad || x > sp.fHi[0] + pad || y < sp.fLo[1] - pad || y > sp.fHi[1] + pad) continue;
    const n = v.idx(i, j, k);
    v.rock[n] = Math.min(v.rock[n], (sp.z0 - z) / v.voxel - 0.3);
  }
}

function surfaceZ(v, x, y) {
  const top = v.origin[2] + (v.nz - 2) * v.voxel;
  return v.raycast([x, y, top], [0, 0, -1], top - v.origin[2]);
}

console.log('rock = matrix depth dug in 1 s (voxels); shell = fossil depth lost, frost = surface frosting 0-255');
for (const level of LEVELS) {
  console.log(`\n${level.id}`);
  for (const [name, tool, media] of setups) {
    const sp = new Specimen(level);
    const t = new Tools(sp);
    const v = sp.vol;
    const down = [0, 0, -1];
    // Like the game: re-aim at the surface under the cursor every frame.
    const run = (hit0) => {
      const x = hit0.p[0], y = hit0.p[1];
      for (let s = 0; s < 1; s += dt) {
        const hit = surfaceZ(v, x, y);
        if (!hit) break;
        if (tool === 'abrader') t.abrade(media, [hit.g[0], hit.g[1], hit.g[2] + 10], down, 0.6, 0.6, dt);
        else t.scribe(tool, hit.g, down, 0.6, 0.7, dt);
      }
    };
    const maxFrost = (g) => {
      let m = 0;
      for (let dz = -4; dz <= 4; dz++) for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++)
        m = Math.max(m, v.frost[v.idx(Math.round(g[0]) + dx, Math.round(g[1]) + dy, Math.round(g[2]) + dz)]);
      return m;
    };
    // Matrix: a corner of the block top, away from the fossil.
    const mx = sp.bLo[0] + 0.08, my = sp.bLo[1] + 0.08;
    const h0 = surfaceZ(v, mx, my);
    run(h0);
    const h1 = surfaceZ(v, mx, my);
    const rockDepth = h1 ? (h0.p[2] - h1.p[2]) / v.voxel : Infinity; // Infinity: dug right through
    // Shell: reveal, then work a point on the axial lobe.
    reveal(sp);
    const fx = (sp.fLo[0] + sp.fHi[0]) / 2, fy = (sp.fLo[1] + sp.fHi[1]) / 2;
    const f0 = surfaceZ(v, fx, fy);
    run(f0);
    const f1 = surfaceZ(v, fx, fy);
    const g = f0.g;
    const fr = maxFrost(g);
    console.log(`  ${name.padEnd(13)} rock ${rockDepth.toFixed(1).padStart(5)}   shell ${((f0.p[2] - f1.p[2]) / v.voxel).toFixed(2).padStart(5)}   frost ${String(fr).padStart(3)}`);
  }
}
