// The newer levels build into playable blocks: something to expose, crinoid arms that can
// snap, and a grade at full exposure near the level's value.
//   node test/newlevels.test.js
import { LEVELS } from '../src/data.js';
import { Specimen } from '../src/specimen.js';
import { grade } from '../src/tools.js';
import { fieldGuide } from '../src/species.js';

let fails = 0;
const check = (ok, msg) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`);
  if (!ok) fails++;
};
for (const id of ['glossopteris', 'crawfordsville']) {
  const lv = LEVELS.find((l) => l.id === id);
  for (const seed of [lv.specimen.seed, 12345, 777]) {
    const t0 = performance.now();
    const sp = new Specimen(lv, { seed, targetVoxels: 1.2e6 });
    const ms = performance.now() - t0;
    const v = sp.vol;
    // Expose everything: rock gone wherever there's fossil or above it.
    for (const q of sp.targets) v.rock[q] = -1;
    const g = grade(sp, {});
    const card = fieldGuide(sp)[0];
    check(sp.targets.length > 500 && g.exposure > 0.99 && g.value > lv.value * 0.5,
      `${id} seed ${seed}: ${sp.targets.length} target voxels, ${sp.parts.length} snappable parts, $${g.value} of $${lv.value}, built in ${ms.toFixed(0)} ms · ${card.genus} ${card.species}: ${card.features.join(', ')}`);
    if (id === 'crawfordsville') check(sp.parts.length >= 4, `  crinoid arms are parts (${sp.parts.length})`);
  }
}
process.exit(fails ? 1 : 0);
