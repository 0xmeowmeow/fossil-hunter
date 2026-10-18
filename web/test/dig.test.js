// Dig sites: the face is fixed by the lease, productive beds hold more, signs mostly tell the
// truth, and where you cut decides whole, sawn-through or barren.
//   node test/dig.test.js
import { SITES, face, cut, lease, CUT_W } from '../src/dig.js';
import { LEVELS } from '../src/data.js';

let fails = 0;
const check = (ok, msg) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`);
  if (!ok) fails++;
};
check(SITES.every((s) => LEVELS.some((l) => l.id === s.level)), 'every site digs a real level');
const s = SITES[0];
check(JSON.stringify(face(s, 42)) === JSON.stringify(face(s, 42)), 'the same lease gives the same face');
// Over many leases: good beds richer, signs honest more often than not.
let good = 0, goodN = 0, bad = 0, badN = 0, realSigns = 0, falseSigns = 0, hidden = 0;
for (let seed = 1; seed < 400; seed++) {
  for (const c of face(s, seed).cells) {
    const r = face(s, seed).rows[c.row];
    if (r.good) { goodN++; good += c.has; } else { badN++; bad += c.has; }
    if (c.sign?.real) realSigns++;
    else if (c.sign) falseSigns++;
    else if (c.has) hidden++;
  }
  if (seed > 60) break;
}
console.log(`  good beds ${(100 * good / goodN).toFixed(0)}% hold something, others ${(100 * bad / badN).toFixed(0)}%; signs ${realSigns} real, ${falseSigns} look-alikes, ${hidden} fossils showing nothing`);
check(good / goodN > 4 * (bad / badN) && realSigns > 2 * falseSigns && hidden > 0, 'the beds and the signs are worth reading, but not everything shows');
// Cutting: centred whole, off-centre sawn, wide barren.
const f = face(s, 7);
const c = f.cells.find((x) => x.has);
const whole = cut(face(s, 7), c.fx, c.fy);
const sawn = cut(face(s, 7), c.fx + CUT_W * 0.42, c.fy);
const wide = cut(face(s, 7), c.fx + CUT_W * 2.5, c.fy);
check(whole.whole && whole.cell.col === c.col, 'a centred cut gets the whole animal');
check(sawn.sawn && sawn.sawn.at > 0.08 && sawn.sawn.dir[0] < 0, `off-centre, the saw takes ${(sawn.sawn?.at * 100).toFixed(0)}% off the near side`);
check(wide.barren || wide.cell !== c, 'well wide of it misses');
// Leases.
const p = { funds: 300, rep: 0, day: 1 };
const r = lease(p, 'house-range', 5);
check(r.lease && p.funds === 80 && r.lease.cutsLeft === 6, 'a lease costs funds and gives cuts');
check(typeof lease(p, 'jebel', 5) === 'string', 'Morocco needs reputation');
process.exit(fails ? 1 : 0);
