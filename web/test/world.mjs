// Two players, one world (needs tools/php.sh running): A publishes a museum and puts a piece
// up for a three-minute auction; B visits A's museum, bids, and after the hammer falls B has the
// piece and A has the money.
//   node test/world.mjs [baseUrl] [outDir]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.argv[2] || 'http://localhost:8000/', out = process.argv[3] || '../build/world';
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
const player = async (tag) => {
  const ctx = await b.newContext({ viewport: { width: 1300, height: 950 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(`${tag}: ${e.message}`));
  await p.goto(base);
  await p.waitForFunction(() => window.fh);
  await p.waitForSelector('#career [data-go]', { timeout: 150000 });
  return p;
};
const state = (p) => p.evaluate(async () => {
  const s = await import('./src/save.js');
  const pr = await s.profile(), items = await s.listItems();
  return { funds: pr.funds, items: items.filter((i) => i.status === 'prepared').map((i) => ({ name: i.name, where: i.where, from: i.from })) };
});

const A = await player('A');
// A: a finished piece with a real baked model, on display.
await A.evaluate(async () => {
  const s = await import('./src/save.js'), { bake } = await import('./src/bake.js'), { LEVELS } = await import('./src/data.js');
  const blob = (r, n) => {
    const pos = [], nrm = [], col = [], idx = [];
    for (let i = 0; i <= n; i++) for (let j = 0; j <= 2 * n; j++) {
      const th = (i / n) * Math.PI, ph = (j / (2 * n)) * Math.PI * 2, d = [Math.sin(th) * Math.cos(ph), Math.sin(th) * Math.sin(ph), Math.cos(th) * 0.4];
      pos.push(...d.map((x) => x * r)); nrm.push(...d); col.push(0.5, 0.45, 0.4);
    }
    for (let i = 0; i < n; i++) for (let j = 0; j < 2 * n; j++) { const a = i * (2 * n + 1) + j, c = a + 2 * n + 1; idx.push(a, c, a + 1, a + 1, c, c + 1); }
    return { pos: new Float32Array(pos), nrm: new Float32Array(nrm), col: new Float32Array(col), idx: new Uint32Array(idx) };
  };
  const mesh = await bake({ rock: [blob(1, 40)], shell: [blob(0.4, 30)] });
  const it = s.newItem(LEVELS.find((l) => l.id === 'wheeler'), 3, { status: 'prepared', where: 'museum', name: 'Elrathia worldensis', value: 200, exposure: 0.98, integrity: 0.96, day: 1 });
  await s.putItem(it);
  await s.saveDisplay(it.id, mesh);
  await window.fh.game.ui.renderCareer();
});
await A.waitForSelector('#wPublish');
await A.fill('#wName', 'The Test Gallery');
await A.fill('#wCurator', 'Player A');
await A.click('#wPublish');
await A.waitForFunction(() => /Published/.test(document.getElementById('wPubState').textContent), null, { timeout: 60000 });
console.log('A:', await A.$eval('#wPubState', (e) => e.textContent));
// A: put it up for a minute.
await A.evaluate(() => document.querySelector('#career [data-sellform]').click());
await A.waitForSelector('#sellHours');
await A.selectOption('#sellHours', '0.05');
await A.fill('#sellReserve', '100');
await A.evaluate(() => document.querySelector('#career [data-sellgo]').click());
await A.waitForFunction(() => /· under the hammer/.test(document.getElementById('career').innerText), null, { timeout: 60000 });
const a0 = await state(A);
console.log('A listed:', JSON.stringify(a0.items));

const B = await player('B');
await B.waitForSelector('#worldMuseums [data-visit]', { timeout: 120000 });
await B.evaluate(() => document.querySelector('#worldMuseums [data-visit]').click());
await B.waitForFunction(() => !document.getElementById('museumHud').classList.contains('hidden') && /Player A/.test(document.getElementById('museumInfo').textContent), null, { timeout: 60000 });
await B.waitForTimeout(4000);
const visit = await B.evaluate(() => ({ title: document.querySelector('#museumHud .mtop b').textContent, info: document.getElementById('museumInfo').textContent, cases: window.fh.museum.cases.filter((c) => c.mesh).length }));
console.log('B visits:', JSON.stringify(visit));
await B.screenshot({ path: `${out}/visit.png` });
await B.evaluate(() => document.getElementById('btnMuseumBack').click());
await B.waitForSelector('#worldAuctions [data-bid]', { timeout: 120000 }).catch(async (e) => {
  console.log('B auction house:', await B.$eval('#worldAuctions', (x) => x.innerText).catch(() => '(none)'), '| menu', await B.$eval('#menu', (x) => x.className));
  throw e;
});
await B.evaluate(() => document.querySelector('#worldAuctions [data-bid]').click());
await B.waitForTimeout(1500);
// Outbid any collector for certain, so the test knows who wins.
const bidR = await B.evaluate(async () => {
  const net = await import('./src/net.js');
  const { auctions } = await net.listAuctions();
  const a = auctions.find((x) => x.status === 'open' && !x.mine);
  if (!a.leading) await net.bid(a.id, a.next + 400, 'Player B');
  return (await net.getAuction(a.id)).auction;
});
console.log('B bid:', bidR.price, 'leading', bidR.leading, 'closes in', bidR.left, 's');
await B.waitForTimeout((bidR.left + 3) * 1000);
await B.evaluate(() => window.fh.game.ui.renderCareer());
await B.waitForFunction(() => /You won/.test(document.getElementById('worldNews')?.innerText ?? ''), null, { timeout: 60000 });
await A.evaluate(() => window.fh.game.ui.renderCareer());
await A.waitForFunction(() => /sold to/.test(document.getElementById('worldNews')?.innerText ?? ''), null, { timeout: 60000 });
const [a1, b1] = [await state(A), await state(B)];
console.log('A after:', a1.funds, JSON.stringify(a1.items), '\nB after:', b1.funds, JSON.stringify(b1.items));
await B.evaluate(() => document.getElementById('worldNews').scrollIntoView());
await B.screenshot({ path: `${out}/won.png` });
const ok = visit.cases === 1 && bidR.leading && a1.funds === a0.funds + bidR.price && a1.items[0].where === 'sell' &&
  b1.items.some((i) => i.name === 'Elrathia worldensis' && /at auction/.test(i.from));
if (errors.length) console.log('page errors', errors);
await b.close();
console.log(ok && !errors.length ? 'ok' : 'FAIL');
process.exit(ok && !errors.length ? 0 : 1);
