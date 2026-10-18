// Contracts board and noticeboard in the storeroom: take a contract (its block arrives), buy a
// lot (funds drop, blocks arrive), then deliver a qualifying piece and get paid.
//   node test/board.mjs [baseUrl] [outDir]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.argv[2] || 'http://localhost:8000/', out = process.argv[3] || '../build/board';
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
await p.goto(base);
await p.waitForFunction(() => window.fh);
await p.waitForSelector('#career [data-take]', { timeout: 45000 });
const state = () => p.evaluate(async () => {
  const s = await import('./src/save.js');
  const pr = await s.profile(), items = await s.listItems();
  return { funds: pr.funds, rep: pr.rep, knowledge: pr.knowledge, contracts: (pr.contracts ?? []).map((c) => c.id), offers: (pr.offers ?? []).map((o) => o.id), lots: (pr.lots ?? []).map((l) => l.id), blocks: items.length };
});
const rerendered = (n) => p.waitForFunction((n) => document.querySelectorAll('#career [data-go]').length === n, n, { timeout: 30000 });
const s0 = await state();
console.log('start', JSON.stringify(s0));
await p.evaluate(() => document.getElementById('careerSec').scrollIntoView());
await p.screenshot({ path: `${out}/board.png`, fullPage: true });
// Take the first offer that sends a block.
const take = await p.evaluate(async () => {
  const C = await import('./src/contracts.js');
  const btn = [...document.querySelectorAll('#career [data-take]')].find((b) => C.findContract(b.dataset.take).supply);
  btn.click();
  return btn.dataset.take;
});
await rerendered(s0.blocks + 1);
const s1 = await state();
console.log('took', take, JSON.stringify(s1));
const tagged = await p.$$eval('#career .tag', (els) => els.length);
// Buy the cheapest lot.
const lot = await p.evaluate(() => {
  const btns = [...document.querySelectorAll('#career [data-lot]')].filter((b) => !b.disabled);
  btns.sort((a, b) => +a.textContent.replace(/\D/g, '') - +b.textContent.replace(/\D/g, ''));
  btns[0]?.click();
  return btns[0]?.dataset.lot;
});
await p.waitForFunction((n) => document.querySelectorAll('#career [data-go]').length > n, s1.blocks, { timeout: 30000 });
const s2 = await state();
console.log('bought', lot, JSON.stringify(s2));
// Pretend the contract's block was prepared well, then deliver it.
await p.evaluate(async (id) => {
  const s = await import('./src/save.js'), C = await import('./src/contracts.js');
  const c = C.findContract(id);
  const it = (await s.listItems()).find((x) => x.contract === id);
  Object.assign(it, { status: 'prepared', where: 'museum', exposure: 0.97, integrity: 0.96, value: 150, name: 'Testus probatus', mounted: true });
  await s.putItem(it);
  await window.fh.game.ui.renderCareer();
}, take);
await p.waitForSelector('#career [data-deliver]', { timeout: 30000 });
await p.screenshot({ path: `${out}/ready.png`, fullPage: true });
await p.click('#career [data-deliver]');
await p.waitForFunction(() => !document.querySelector('#career [data-deliver]'), null, { timeout: 30000 });
const s3 = await state();
console.log('delivered', JSON.stringify(s3));
await p.screenshot({ path: `${out}/delivered.png`, fullPage: true });
// Science: the delivery paid 3 knowledge; learn the identification tests, then the notebook
// should be on a Wheeler bench (which doesn't have it by default).
await p.waitForSelector('#career [data-learn="notebook"].on', { timeout: 30000 });
await p.click('#career [data-learn="notebook"]');
await p.waitForSelector('#career .node.have', { timeout: 30000 });
const learned = await p.evaluate(async () => (await (await import('./src/save.js')).profile()).science);
await p.evaluate(() => [...document.querySelectorAll('#career [data-go]')].find((b) => b.closest('.blk').textContent.includes('Utah'))?.click());
await p.waitForFunction(() => window.fh.game.sp && !document.getElementById('hud').classList.contains('hidden'), null, { timeout: 60000 });
const notes = await p.evaluate(() => ({ level: window.fh.game.level.id, shown: !document.getElementById('btnNotes').classList.contains('hidden'), intro: document.getElementById('introFresh').innerText }));
console.log('science', JSON.stringify(learned), JSON.stringify(notes));
await p.screenshot({ path: `${out}/intro.png` });
const ok = learned?.includes('notebook') && notes.level === 'wheeler' && notes.shown && /Identification tests/.test(notes.intro) &&
  s1.contracts.includes(take) && s1.blocks === s0.blocks + 1 && tagged >= 1 &&
  s2.funds < s1.funds && s2.blocks > s1.blocks && !s2.lots.includes(lot) &&
  !s3.contracts.includes(take) && s3.funds > s2.funds && s3.rep > s2.rep;
if (errors.length) console.log('page errors', errors);
await b.close();
console.log(ok && !errors.length ? 'ok' : 'FAIL');
process.exit(ok && !errors.length ? 0 : 1);
