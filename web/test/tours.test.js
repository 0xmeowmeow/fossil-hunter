// Tours: the rating rewards a story through time, variety, good preparation and cards; schools
// come more often to better tours.
//   node test/tours.test.js
import { rate, schoolVisit, ageOf, suggestCard } from '../src/tours.js';
import { LEVELS } from '../src/data.js';

let fails = 0;
const check = (ok, msg) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`);
  if (!ok) fails++;
};
const it = (level, q = 0.95) => ({ level, exposure: q, integrity: q, name: level });
const card = 'A sentence or two about what to notice here.';
check(LEVELS.every((l) => ageOf(l.id) > 0), 'every level has an age');
check(rate([{ item: it('wheeler') }, { item: it('lyme') }]).stars === 0, 'two stops is not a tour');
const bare = rate([{ item: it('wheeler') }, { item: it('cincinnati') }, { item: it('lyme') }]);
const best = rate(['wheeler', 'crawfordsville', 'glossopteris', 'lyme', 'calvert'].map((l) => ({ item: it(l), card })));
const jumbled = rate(['lyme', 'wheeler', 'calvert', 'glossopteris'].map((l) => ({ item: it(l), card })));
const rough = rate(['wheeler', 'crawfordsville', 'glossopteris', 'lyme', 'calvert'].map((l) => ({ item: it(l, 0.6), card })));
console.log(`  bare ${bare.stars}★, best ${best.stars}★, jumbled ${jumbled.stars}★, rough ${rough.stars}★`);
check(best.stars === 5 && bare.stars <= 3 && jumbled.stars < best.stars && rough.stars < best.stars, 'order, variety, cards and quality all count');
check(best.notes.every(([, good]) => good), 'a five-star tour has nothing to fix');
const rate100 = (stars) => { let n = 0; for (let i = 0; i < 2000; i++) if (schoolVisit(stars, 10)) n++; return n / 20; };
const [r1, r5] = [rate100(1), rate100(5)];
check(r5 > r1 + 20, `schools come more to better tours (${r1.toFixed(0)}% of days at 1★, ${r5.toFixed(0)}% at 5★)`);
check(/450 million/.test(suggestCard(it('beecher'), LEVELS[0], new Set(['stratigraphy']))), 'suggested cards use what you know');
process.exit(fails ? 1 : 0);
