// The tour editor in the storeroom and walking it in the museum: three pieces on display, add
// them as stops, write a card, see the rating, then walk the tour.
//   node test/tour.mjs [baseUrl] [outDir]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.argv[2] || 'http://localhost:8000/', out = process.argv[3] || '../build/tour';
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
await p.goto(base);
await p.waitForFunction(() => window.fh);
await p.waitForSelector('#career [data-go]', { timeout: 45000 });
// Three finished pieces on display, from different times.
await p.evaluate(async () => {
  const s = await import('./src/save.js'), { LEVELS } = await import('./src/data.js');
  for (const [id, name] of [['wheeler', 'Elrathia testi'], ['crawfordsville', 'Macrocrinus testi'], ['lyme', 'Asteroceras testi']]) {
    const it = s.newItem(LEVELS.find((l) => l.id === id), 1, { status: 'prepared', where: 'museum', exposure: 0.97, integrity: 0.95, value: 200, name, day: 1 });
    await s.putItem(it);
  }
  await window.fh.game.ui.renderCareer();
});
await p.waitForSelector('#career [data-addstop]', { timeout: 30000 });
for (let i = 0; i < 3; i++) {
  await p.evaluate(() => document.querySelector('#career [data-addstop]').click());
  await p.waitForFunction((n) => document.querySelectorAll('#career [data-card]').length === n, i + 1, { timeout: 30000 });
}
await p.fill('#tourName', 'Half a billion years in three cases');
await p.fill('#career [data-card="0"]', 'Look for the three lobes running nose to tail: that is where the name comes from.');
await p.waitForTimeout(1200);
const rating = await p.$eval('#tourRate', (e) => e.innerText);
console.log('rating:', rating.replace(/\n+/g, ' | '));
await p.evaluate(() => document.getElementById('careerSec').scrollIntoView());
await p.screenshot({ path: `${out}/editor.png`, fullPage: true });
const saved = await p.evaluate(async () => (await (await import('./src/save.js')).profile()).tour);
console.log('saved', JSON.stringify(saved).slice(0, 200));
// Walk it.
await p.evaluate(() => document.getElementById('btnMuseum').click());
await p.waitForSelector('#btnTour:not(.hidden)', { timeout: 60000 });
await p.evaluate(() => document.getElementById('btnTour').click());
await p.waitForSelector('#tourCard:not(.hidden)', { timeout: 30000 });
const first = await p.$eval('#tourCard', (e) => e.innerText);
await p.evaluate(() => document.getElementById('tcNext').click());
const second = await p.$eval('#tcCat', (e) => e.innerText);
await p.waitForTimeout(1500);
await p.screenshot({ path: `${out}/walk.png` });
console.log('stop 1:', first.replace(/\n+/g, ' | ').slice(0, 160), '\nthen:', second);
const ok = /★/.test(rating) && saved?.stops?.length === 3 && saved.name.startsWith('Half') && /three lobes/.test(first) && /stop 2 of 3/i.test(second);
if (errors.length) console.log('page errors', errors);
await b.close();
console.log(ok && !errors.length ? 'ok' : 'FAIL');
process.exit(ok && !errors.length ? 0 : 1);
