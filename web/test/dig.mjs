// A dig: lease a site, look closely at a sign, saw a block out on it, saw one from blank rock,
// head home (a day passes), then open the dug block on the bench.
//   node test/dig.mjs [baseUrl] [outDir]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.argv[2] || 'http://localhost:8000/', out = process.argv[3] || '../build/dig';
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1400, height: 1000 } });
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
await p.goto(base);
await p.waitForFunction(() => window.fh);
await p.waitForSelector('#career [data-lease="house-range"]', { timeout: 45000 });
await p.evaluate(() => document.querySelector('#career [data-lease="house-range"]').click());
await p.waitForSelector('#career [data-dig]', { timeout: 30000 });
await p.evaluate(() => document.querySelector('#career [data-dig]').click());
await p.waitForSelector('#digSite:not(.hidden)', { timeout: 30000 });
await p.waitForTimeout(500);
// Where are the real and blank spots? (The test may peek; a player can't.)
const spots = await p.evaluate(async () => {
  const s = await import('./src/save.js');
  const st = await s.leaseFace(0);
  const real = st.f.cells.find((c) => c.has && c.sign?.real) ?? st.f.cells.find((c) => c.has);
  const blank = st.f.cells.find((c) => !c.has && !c.sign && !st.f.cells.some((d) => d.has && Math.abs(d.fx - (c.x0 + c.x1) / 2) < 0.12 && d.row === c.row));
  return { real: [real.fx, real.fy, !!real.sign], blank: [(blank.x0 + blank.x1) / 2, (blank.y0 + blank.y1) / 2] };
});
const click = async ([x, y]) => {
  const r = await p.$eval('#digCanvas', (c) => { const b = c.getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; });
  const n = await p.$$eval('#digLog p', (e) => e.length);
  await p.mouse.click(r[0] + x * r[2], r[1] + (0.1 + y * 0.9) * r[3]);
  await p.waitForFunction((n) => document.querySelectorAll('#digLog p').length > n, n, { timeout: 30000 });
};
if (spots.real[2]) {
  await p.click('#digLook');
  await click(spots.real);
}
await p.click('#digSaw');
await click(spots.real);
await click(spots.blank);
const log = await p.$eval('#digLog', (e) => e.innerText);
console.log(log);
await p.screenshot({ path: `${out}/face.png` });
const before = await p.evaluate(async () => (await (await import('./src/save.js')).profile()).day);
await p.click('#digHome');
await p.waitForFunction(() => !document.getElementById('menu').classList.contains('hidden'), null, { timeout: 45000 });
const after = await p.evaluate(async () => {
  const s = await import('./src/save.js');
  const items = await s.listItems();
  return { day: (await s.profile()).day, dug: items.filter((i) => i.dug).map((i) => ({ id: i.id, sawn: i.sawn })) };
});
console.log('day', before, '->', after.day, 'dug', JSON.stringify(after.dug));
// Open the dug block.
await p.waitForSelector(`#career [data-go="${after.dug[0].id}"]`, { timeout: 30000 });
await p.evaluate((id) => document.querySelector(`#career [data-go="${id}"]`).click(), after.dug[0].id);
await p.waitForFunction(() => window.fh.game.sp && !document.getElementById('hud').classList.contains('hidden'), null, { timeout: 60000 });
const sp = await p.evaluate(() => ({ level: window.fh.game.level.id, sawn: window.fh.game.sp.sawn, targets: window.fh.game.sp.targets.length }));
console.log('bench', JSON.stringify(sp));
const ok = /A good block|saw went through/.test(log) && /barren/.test(log) && after.day === before + 1 && after.dug.length === 1 && sp.level === 'wheeler' && sp.targets > 100;
if (errors.length) console.log('page errors', errors);
await b.close();
console.log(ok && !errors.length ? 'ok' : 'FAIL');
process.exit(ok && !errors.length ? 0 : 1);
