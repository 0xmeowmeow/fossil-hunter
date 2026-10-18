// Balance probe: a careless bot works straight down over the fossil for a fixed time with
// one tool, never stopping at the shell. Prints exposure and damage per level, so we can
// see the contrast ladder: early levels forgive this, Moroccan ones punish it.
//
//   node test/balance.js [seconds]

import { LEVELS, E_MAX } from '../src/data.js';
import { Specimen } from '../src/specimen.js';
import { Tools, grade } from '../src/tools.js';

const seconds = Number(process.argv[2] || 60);
const dt = 1 / 30;
const setups = [
  { name: 'chisel', tool: 'chisel', pressure: 0.6 },
  { name: 'large scribe', tool: 'scribe_large', pressure: 0.6, stroke: 0.7 },
  { name: 'fine scribe', tool: 'scribe_fine', pressure: 0.5, stroke: 0.7 },
  { name: 'abrade bicarb', tool: 'abrader', media: 'bicarb', pressure: 0.6, flow: 0.6 },
  { name: 'abrade dolomite', tool: 'abrader', media: 'dolomite', pressure: 0.6, flow: 0.6 },
  { name: 'abrade Al2O3', tool: 'abrader', media: 'alox', pressure: 0.6, flow: 0.6 },
];

for (const level of LEVELS) {
  console.log(`\n${level.id}: ${level.title}`);
  for (const s of setups) {
    const sp = new Specimen(level);
    const tools = new Tools(sp);
    const v = sp.vol;
    // Serpentine raster over the fossil footprint, in local units.
    const step = v.voxel * ({ chisel: 12, scribe_large: 5, abrader: 3 }[s.tool] ?? 2);
    const pts = [];
    let row = 0;
    for (let y = sp.fLo[1]; y <= sp.fHi[1]; y += step, row++) {
      const xs = [];
      for (let x = sp.fLo[0]; x <= sp.fHi[0]; x += step) xs.push(x);
      if (row % 2) xs.reverse();
      for (const x of xs) pts.push([x, y]);
    }
    const down = [0, 0, -1];
    // Rough out with the chisel first (except for the chisel-only run), on a coarse raster.
    if (s.tool !== 'chisel') {
      const cstep = v.voxel * 12;
      let q = 0;
      const cpts = [];
      for (let y = sp.fLo[1]; y <= sp.fHi[1]; y += cstep) for (let x = sp.fLo[0]; x <= sp.fHi[0]; x += cstep) cpts.push([x, y]);
      for (let t = 0; t < 25; t += 0.35) {
        const [x, y] = cpts[q++ % cpts.length];
        const top = v.origin[2] + (v.nz - 2) * v.voxel;
        const hit = v.raycast([x, y, top], down, top - v.origin[2]);
        if (hit) tools.chiselStrike(hit.g, down, [1, 0, 0], 'bolster', E_MAX * 0.5);
      }
    }
    let p = 0;
    const dwell = 6; // frames spent on each raster point
    for (let t = 0, f = 0; t < seconds; t += dt, f++) {
      const [x, y] = pts[Math.floor(f / dwell) % pts.length];
      const top = v.origin[2] + (v.nz - 2) * v.voxel;
      const hit = v.raycast([x, y, top], down, top - v.origin[2]);
      if (!hit) continue;
      if (s.tool === 'chisel') {
        if (Math.floor(t / 0.35) !== Math.floor((t - dt) / 0.35)) tools.chiselStrike(hit.g, down, [1, 0, 0], 'bolster', E_MAX * s.pressure);
      } else if (s.tool === 'abrader') {
        const o = [hit.g[0], hit.g[1], hit.g[2] + 10];
        tools.abrade(s.media, o, down, s.pressure, s.flow, dt);
      } else {
        tools.scribe(s.tool, hit.g, down, s.pressure, s.stroke, dt);
      }
    }
    const g = grade(sp, tools.stats);
    console.log(
      `  ${s.name.padEnd(16)} exposed ${(g.exposure * 100).toFixed(0).padStart(3)}%  frost ${(g.frostMean * 100).toFixed(0).padStart(3)}%  ` +
      `lost ${(g.lostFrac * 100).toFixed(1).padStart(5)}%  pops ${String(tools.stats.pops).padStart(4)}  chips ${String(tools.stats.chips).padStart(3)}  ` +
      `snapped ${g.snapped}/${g.spines}  value ${g.value}/${level.value}`,
    );
  }
}
