// Pacing probe: a methodical bot roughs out with the chisel, then finishes with one tool,
// sweeping the fossil footprint until exposure stops rising. Prints exposure and value
// against simulated play time, so we can see how long each level takes and what it costs.
//
//   node test/pacing.js [levelId] [finishTool] [media]

import { LEVELS, MEDIA, E_MAX } from '../src/data.js';
import { Specimen } from '../src/specimen.js';
import { Tools, grade } from '../src/tools.js';

const [levelId = 'beecher', finish = 'abrader', media = 'bicarb'] = process.argv.slice(2);
const level = LEVELS.find((l) => l.id === levelId);
const sp = new Specimen(level);
const tools = new Tools(sp);
const v = sp.vol;
const down = [0, 0, -1];
const top = v.origin[2] + (v.nz - 2) * v.voxel;
const hitAt = (x, y) => v.raycast([x, y, top], down, top - v.origin[2]);
const dt = 1 / 30;
let t = 0;

const raster = (step) => {
  const pts = [];
  let row = 0;
  for (let y = sp.fLo[1] - 0.03; y <= sp.fHi[1] + 0.03; y += step, row++) {
    const xs = [];
    for (let x = sp.fLo[0] - 0.03; x <= sp.fHi[0] + 0.03; x += step) xs.push(x);
    if (row % 2) xs.reverse();
    pts.push(...xs.map((x) => [x, y]));
  }
  return pts;
};

// Rough out: chisel taps on a coarse raster, light force, one pass.
for (const [x, y] of raster(v.voxel * 10)) {
  const h = hitAt(x, y);
  if (h && h.p[2] > sp.z0 + 0.02) tools.chiselStrike(h.g, down, [1, 0, 0], 'bolster', E_MAX * 0.35);
  t += 0.35;
}
let g = grade(sp, tools.stats);
console.log(`after chisel  ${(t / 60).toFixed(1)} min  exposed ${(g.exposure * 100).toFixed(0)}%  value ${g.value}`);

// Finish: sweep the footprint; skip spots where the surface is already shell.
const pts = raster(v.voxel * (finish === 'abrader' ? 2.5 : 1.5));
let last = -1;
for (let pass = 0; pass < 12; pass++) {
  for (const [x, y] of pts) {
    for (let f = 0; f < 3; f++) {
      const h = hitAt(x, y);
      if (!h) break;
      const fo = v.sample(v.fossil, ...h.g), r = v.sample(v.rock, ...h.g);
      // Careful: stop on shell (unless spraying an abrasive that can't hurt it).
      const harmless = finish === 'abrader' && (MEDIA[media].H - sp.fossilMat.H + 0.15) <= 0;
      if (fo >= r - 0.3 && !harmless) break;
      if (finish === 'abrader') tools.abrade(media, [h.g[0], h.g[1], h.g[2] + 10], down, 0.45, 0.5, dt);
      else tools.scribe(finish, h.g, down, 0.35, 0.6, dt);
      t += dt;
    }
  }
  g = grade(sp, tools.stats);
  console.log(`pass ${pass + 1}  ${(t / 60).toFixed(1)} min  exposed ${(g.exposure * 100).toFixed(0)}%  integrity ${(g.integrity * 100).toFixed(1)}%  marks ${(g.markMean * 100).toFixed(1)}%  lost ${(g.lostFrac * 100).toFixed(1)}%  snapped ${g.snapped}/${g.spines}  pops ${tools.stats.pops} chips ${tools.stats.chips}  value ${g.value}/${level.value}`);
  if (g.exposure - last < 0.005) break;
  last = g.exposure;
}
