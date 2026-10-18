// Science track: prerequisites, costs, what each idea changes on the bench, knowledge earned.
//   node test/science.test.js
import { NODES, blocked, learn, featuresFor, leftFrom, factsFor, earned, known, DEPOSITS } from '../src/science.js';
import { LEVELS, SPECIAL } from '../src/data.js';
import { Specimen } from '../src/specimen.js';
import { integrity } from '../src/tools.js';

let fails = 0;
const check = (ok, msg) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`);
  if (!ok) fails++;
};
const lv = (id) => LEVELS.find((l) => l.id === id) ?? SPECIAL[id];

check(NODES.every((n) => n.needs.every((x) => NODES.some((m) => m.id === x))), 'every prerequisite exists');
check([...LEVELS, ...Object.values(SPECIAL)].every((l) => DEPOSITS[l.id]), 'every deposit has an age and taphonomy note');
const total = NODES.reduce((a, n) => a + n.cost, 0);
console.log(`  the whole track costs ${total} knowledge`);

const p = { knowledge: 4, science: [] };
check(/Needs Identification tests/.test(blocked(p, 'guide')), 'field guides need the tests first');
check(learn(p, 'notebook') === p && p.knowledge === 1 && known(p).has('notebook'), 'learning spends knowledge');
check(/Needs 5 knowledge/.test(blocked(p, 'guide')), 'and you can\'t overspend');
check(typeof learn(p, 'notebook') === 'string', 'no learning twice');

const sci = new Set(['notebook', 'guide', 'model']);
check(featuresFor(lv('wheeler'), sci).join() === 'notebook,guide,model', 'model, guide and notebook reach the Wheeler bench');
check(!featuresFor(lv('calvert'), sci).includes('model'), 'but no trilobite model for a shark tooth');
check(leftFrom(new Set()) === 0.96 && leftFrom(new Set(['lustre'])) === 0.9, 'lustre shows leftovers from 90%');
check(factsFor(lv('ridge'), new Set(['opal', 'taphonomy'])).length === 2 && factsFor(lv('wheeler'), new Set(['opal'])).length === 0, 'facts appear only where they bear');

const e = earned({ first: true, matrixOk: true, fossilOk: false, fitTrue: true });
check(e.reduce((a, [k]) => a + k, 0) === 6, `a first, well identified: ${e.map(([k, w]) => `+${k} ${w}`).join(', ')}`);

// Consolidant: a snapped spine costs far less.
const sp = new Specimen(lv('spiny'), { seed: 44, targetVoxels: 4e5 });
sp.parts[0].alive = false;
const raw = integrity(sp).value;
sp.repair = true;
const glued = integrity(sp).value;
check(glued > raw, `one snapped spine of ${sp.parts.length}: ${(raw * 100).toFixed(1)}% bare, ${(glued * 100).toFixed(1)}% glued`);

process.exit(fails ? 1 : 0);
