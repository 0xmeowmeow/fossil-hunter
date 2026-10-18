// Loose rock and time slicing.
//   1. Cut a full-depth trench across a block: the cut-off end must fall away as one piece.
//   2. The same pass run in 1 ms slices (as in a headset) gives exactly the same result.
//   3. A chisel blow run in slices matches the same blow run straight through.
//   node test/loose.test.js

import { LEVELS, E_MAX } from '../src/data.js';
import { Specimen } from '../src/specimen.js';
import { Tools } from '../src/tools.js';

const level = LEVELS.find((l) => l.id === 'wheeler');
let fails = 0;
const check = (ok, msg) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`);
  if (!ok) fails++;
};

function trenched() {
  const sp = new Specimen(level, { seed: 5, targetVoxels: 1.2e6 });
  const t = new Tools(sp), v = sp.vol;
  const gx = v.grid(sp.fHi[0] + 0.05, 0, 0)[0] | 0;
  for (let k = 0; k < v.nz; k++) for (let j = 0; j < v.ny; j++) for (let i = gx; i < gx + 3; i++) v.rock[v.idx(i, j, k)] = -1;
  return { sp, t, v };
}
const solid = (v) => { let n = 0; for (let i = 0; i < v.count; i++) if (v.rock[i] > 0) n++; return n; };

// 1 + 2
{
  const a = trenched();
  check(new Tools(new Specimen(level, { seed: 5, targetVoxels: 1.2e6 })).dropLoose().length === 0, 'an untouched block has nothing loose');
  const t0 = performance.now();
  const ra = a.t.dropLoose();
  const ms = performance.now() - t0;
  check(ra.length === 1 && ra[0].size > 10000 && !!ra[0].debris, `trench drops one piece (${ra.map((p) => p.size)}) in ${ms.toFixed(0)} ms`);

  const b = trenched();
  const gen = b.t.fracture.begin(b.t.dropLooseGen(), 1);
  let r, slices = 0;
  do { b.t.fracture._t0 = performance.now(); r = gen.next(); slices++; } while (!r.done);
  check(r.value.length === ra.length && r.value[0].size === ra[0].size && solid(a.v) === solid(b.v), `sliced pass matches (${slices} slices)`);
}

// 3
{
  const blow = (sliced) => {
    const sp = new Specimen(level, { seed: 5, targetVoxels: 1.2e6 });
    const t = new Tools(sp), v = sp.vol;
    const z = sp.z0 + 1.5 * v.voxel, y = (sp.bLo[1] + sp.bHi[1]) / 2;
    const g = v.raycast([sp.bLo[0] - 0.1, y, z], [1, 0, 0], 5).g;
    if (!sliced) return { ev: t.chiselStrike(g, [1, 0, 0], [0, 1, 0], 'wedge', E_MAX * 0.85), v, slices: 1 };
    const gen = t.fracture.begin(t.chiselStrikeGen(g, [1, 0, 0], [0, 1, 0], 'wedge', E_MAX * 0.85), 1);
    let r, slices = 0;
    do { t.fracture._t0 = performance.now(); r = gen.next(); slices++; } while (!r.done);
    return { ev: r.value, v, slices };
  };
  const a = blow(false), b = blow(true);
  check(a.ev.strike.kind === b.ev.strike.kind && a.ev.strike.size === b.ev.strike.size && solid(a.v) === solid(b.v),
    `sliced blow matches: ${b.ev.strike.kind} of ${b.ev.strike.size} voxels over ${b.slices} slices`);
}

process.exit(fails ? 1 : 0);
