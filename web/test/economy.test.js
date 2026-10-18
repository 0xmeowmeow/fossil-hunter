// Museum days: what a few displayed specimens and a stocked shop bring in.
//   node test/economy.test.js
import { dayResult, restock, JUNK } from '../src/economy.js';
let p = { day: 1, funds: 250, rep: 0, stock: {} };
const show = (vals) => vals.map((v, i) => ({ value: v, name: `piece ${i}` }));
const avg = (f, n = 400) => { let s = 0; for (let i = 0; i < n; i++) s += f(); return s / n; };
console.log('empty museum, no shop:', avg(() => dayResult(p, []).earned).toFixed(0), '$/day');
console.log('3 cheap pieces ($180 each):', avg(() => dayResult(p, show([180, 180, 180])).earned).toFixed(0), '$/day,', avg(() => dayResult(p, show([180, 180, 180])).visitors).toFixed(0), 'visitors');
for (const j of JUNK) p = restock(p, j.id) ?? p;
console.log('after stocking every line, funds', Math.round(p.funds), 'stock', JSON.stringify(p.stock));
const r = dayResult(p, show([180, 180, 180]));
console.log('3 pieces + shop, one day:', r.visitors, 'visitors, tickets $' + r.tickets, 'shop $' + r.shop, JSON.stringify(r.sold));
console.log('an opal star ($4000) + 5 pieces:', avg(() => dayResult(p, show([4000, 300, 250, 200, 180, 150])).earned).toFixed(0), '$/day');
const ok = dayResult(p, []).earned >= 0 && r.earned > 0 && restock({ funds: 0, stock: {} }, 'plush') === null;
console.log(ok ? 'ok' : 'FAIL');
process.exit(ok ? 0 : 1);
