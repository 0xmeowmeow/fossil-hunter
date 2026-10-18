// Contracts and lots: the board fills, offers can be taken, deliveries check the goal, the
// board doesn't re-roll on reload, and a fortnight of days stays sensible.
//   node test/contracts.test.js
import { CONTRACTS, LOTS, refreshBoard, accept, deliver, deliverable, buyLot, returnLoans, qualifies, shortfall, findContract } from '../src/contracts.js';
import { LEVELS, SPECIAL } from '../src/data.js';

let fails = 0;
const check = (ok, msg) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`);
  if (!ok) fails++;
};
const lv = (id) => LEVELS.find((l) => l.id === id) ?? SPECIAL[id];

// Every level named anywhere exists.
const named = [...CONTRACTS.flatMap((c) => [].concat(c.goal.level, c.supply ?? [])), ...LOTS.flatMap((l) => l.blocks)];
check(named.every(lv), `every contract and lot names a real level (${new Set(named).size} levels)`);
check(new Set(CONTRACTS.map((c) => c.id)).size === CONTRACTS.length && new Set(LOTS.map((l) => l.id)).size === LOTS.length, 'ids are unique');

// A fresh career.
const fresh = () => ({ day: 1, funds: 250, rep: 0, knowledge: 0, started: 1760000000000 });
const p = fresh();
refreshBoard(p);
check(p.offers.length === 3 && p.lots.length === 3, `day 1: ${p.offers.map((o) => o.id).join(', ')} | lots ${p.lots.map((l) => `${l.id} $${l.price}`).join(', ')}`);
check(p.offers.every((o) => findContract(o.id).rep === 0), 'only starter contracts at 0 reputation');
const q = fresh();
refreshBoard(q);
check(JSON.stringify(q.offers) === JSON.stringify(p.offers) && JSON.stringify(q.lots) === JSON.stringify(p.lots), 'the same day gives the same board');

// Take on Utah's teaching contract (forced onto the board), then deliver.
p.offers = [{ id: 'utah-teaching', until: 5 }, ...p.offers.slice(0, 2)];
const r = accept(p, 'utah-teaching');
check(typeof r === 'object' && r.blocks.length === 1 && r.blocks[0] === 'wheeler', 'accepting sends a Wheeler block');
check(p.contracts.length === 1 && p.contracts[0].due === 7, 'the contract is due in 6 days');
const it = (o) => ({ status: 'prepared', where: 'museum', level: 'wheeler', exposure: 0.95, integrity: 0.9, value: 150, name: 'test', ...o });
const weak = it({ integrity: 0.7 });
check(!qualifies(findContract('utah-teaching'), weak) && /integrity 70% of 85%/.test(shortfall(findContract('utah-teaching'), weak)), `a damaged one falls short: ${shortfall(findContract('utah-teaching'), weak)}`);
check(typeof deliver(p, 'utah-teaching', [weak]) === 'string', 'and can\'t be delivered');
const good = it();
const funds0 = p.funds;
const d = deliver(p, 'utah-teaching', [weak, good]);
check(typeof d === 'object' && d.items[0] === good && good.where === 'delivered' && p.funds === funds0 + 140 && p.rep === 5 && p.knowledge === 3, 'a good one delivers and pays');
check(!p.contracts.length && p.contractsDone.includes('utah-teaching'), 'and the contract is done');

// Loans come back.
const lp = { ...fresh(), offers: [{ id: 'school-handling', until: 5 }] };
accept(lp, 'school-handling');
const tooth = it({ level: 'calvert' });
deliver(lp, 'school-handling', [tooth]);
check(tooth.loanedTo && tooth.where === 'museum', 'a loan stays yours');
lp.day = 3;
check(returnLoans(lp, [tooth]).length === 1 && !tooth.loanedTo, 'and comes home after two days');

// A series takes the cheapest three.
const series = findContract('growth-series');
const three = [it({ value: 300 }), it({ value: 120 }), it({ value: 200 }), it({ value: 90 })];
check(deliverable(series, three.slice(0, 2)) === null && deliverable(series, three).map((x) => x.value).join() === '90,120,200', 'a series delivers its three cheapest qualifying pieces');

// Mounted and intact goals.
check(!qualifies(findContract('ohio-mount'), it({ level: 'cincinnati' })) && qualifies(findContract('ohio-mount'), it({ level: 'cincinnati', mounted: true })), 'the Cincinnati job needs a mount');
check(!qualifies(findContract('spines-intact'), it({ level: 'spiny', snapped: 1 })), 'a snapped spine fails the spines contract');

// Buying a lot.
const bp = fresh();
refreshBoard(bp);
const lot = bp.lots[0];
const b = buyLot(bp, lot.id);
check(typeof b === 'object' && b.blocks.length > 0 && bp.funds === 250 - lot.price && !bp.lots.some((l) => l.id === lot.id), `bought ${lot.id} for $${lot.price}: ${b.blocks.join(', ')}`);
check(buyLot({ ...fresh(), lots: [{ id: 'morocco-grey', price: 700, until: 4 }] }, 'morocco-grey') === 'Not enough funds.', 'can\'t buy what you can\'t afford');

// Expiry costs a little reputation and frees the slot.
const ep = { ...fresh(), rep: 5, offers: [{ id: 'utah-teaching', until: 5 }] };
accept(ep, 'utah-teaching');
ep.day = 8;
const ex = refreshBoard(ep);
check(ex.expired[0] === 'utah-teaching' && ep.rep === 3 && !ep.contracts.length, 'an overdue contract expires: -2 reputation');

// A fortnight: reputation rising, the board always has something, rare lots appear later.
const fp = fresh();
const seen = new Set(), seenLots = new Set();
for (let day = 1; day <= 30; day++) {
  fp.day = day;
  fp.rep = day * 1.5;
  refreshBoard(fp);
  fp.offers.forEach((o) => seen.add(o.id));
  fp.lots.forEach((l) => seenLots.add(l.id));
}
console.log(`  30 days at rising reputation: ${seen.size}/${CONTRACTS.length} contracts and ${seenLots.size}/${LOTS.length} lots came up`);
check(seen.size >= 7 && seenLots.size >= 7, 'most of the board turns up over a month');

process.exit(fails ? 1 : 0);
