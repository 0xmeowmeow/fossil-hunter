// Fracture scenarios: does the chisel behave like rock?
//   1. straight down into the middle of the top face          -> crush (no piece)
//   2. bolster near an edge, driven out toward it              -> a flake
//   3. wedge into the side face along the fossil's bedding plane -> split off the top layer
//      (in fissile shale), crack runs over the fossil where it parts cleanly
//   node test/fracture.test.js [levelId]

import { LEVELS, E_MAX } from '../src/data.js';
import { Specimen } from '../src/specimen.js';
import { Fracture } from '../src/fracture.js';
import { Rng } from '../src/rng.js';
import { grade, integrity } from '../src/tools.js';

const levelId = process.argv[2] || 'beecher';
const level = LEVELS.find((l) => l.id === levelId);

function fresh() {
  const sp = new Specimen(level);
  return { sp, fr: new Fracture(sp, new Rng(7)) };
}

function hitFrom(v, o, d) {
  const h = v.raycast(o, d, 5);
  return h && h.g;
}

function report(name, sp, r, t) {
  const g = grade(sp, {});
  console.log(`${name.padEnd(34)} ${String(r.kind).padEnd(6)} size ${String(r.size ?? 0).padStart(7)}  cost ${(r.cost ?? 0).toFixed(0).padStart(5)}  ` +
    `fossil kept/lost ${r.fossilKept ?? 0}/${r.fossilLost ?? 0}  exposed ${(g.exposure * 100).toFixed(0)}%  integrity ${(integrity(sp).value * 100).toFixed(1)}%  ${t.toFixed(0)}ms`);
  return r;
}

const out = {};
{
  const { sp, fr } = fresh();
  const v = sp.vol, c = [(sp.bLo[0] + sp.bHi[0]) / 2, (sp.bLo[1] + sp.bHi[1]) / 2];
  const g = hitFrom(v, [c[0], c[1], sp.bHi[2] + 0.1], [0, 0, -1]);
  const t0 = performance.now();
  out.crush = report('1 centre, straight down, wedge', sp, fr.strike(g, [0, 0, 1].map((x) => -x), [1, 0, 0], 'wedge', E_MAX), performance.now() - t0);
}
{
  const { sp, fr } = fresh();
  const v = sp.vol;
  // Near the +x edge of the top face, driving down and out toward that edge.
  const x = sp.bHi[0] - 8 * v.voxel, y = (sp.bLo[1] + sp.bHi[1]) / 2;
  const g = hitFrom(v, [x, y, sp.bHi[2] + 0.1], [0, 0, -1]);
  const d = [Math.sin(0.5), 0, -Math.cos(0.5)];
  const t0 = performance.now();
  out.flake = report('2 near edge, bolster, out 29deg', sp, fr.strike(g, d, [0, 1, 0], 'bolster', E_MAX * 0.5), performance.now() - t0);
}
for (const energy of [0.4, 0.8, 1.0]) {
  const { sp, fr } = fresh();
  const v = sp.vol;
  // Side face (-x), just above the fossil's bedding plane, driving straight in, blade flat.
  const z = sp.z0 + 1.5 * v.voxel, y = (sp.bLo[1] + sp.bHi[1]) / 2;
  const g = hitFrom(v, [sp.bLo[0] - 0.1, y, z], [1, 0, 0]);
  const t0 = performance.now();
  out['split' + energy] = report(`3 side, bedding, wedge, E=${energy}`, sp, fr.strike(g, [1, 0, 0], [0, 1, 0], 'wedge', E_MAX * energy), performance.now() - t0);
}
for (const flipped of [false, true]) {
  // 4. The underside, near the +x edge, driving up and out. A blow from below braces the top
  //    (you hold the block down), so it should break like any other edge either way up.
  const { sp, fr } = fresh();
  const v = sp.vol;
  if (flipped) fr.down = [0, 0, 1];
  const x = sp.bHi[0] - 8 * v.voxel, y = (sp.bLo[1] + sp.bHi[1]) / 2;
  const g = hitFrom(v, [x, y, sp.bLo[2] - 0.1], [0, 0, 1]);
  const d = [Math.sin(0.5), 0, Math.cos(0.5)];
  const t0 = performance.now();
  out['under' + flipped] = report(`4 underside, bolster, ${flipped ? 'flipped' : 'on bench'}`, sp, fr.strike(g, d, [0, 1, 0], 'bolster', E_MAX * 0.5), performance.now() - t0);
}
