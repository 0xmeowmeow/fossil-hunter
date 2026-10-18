// Career smoke test: the storeroom shelf, packing up a block mid-work and resuming it exactly.
//   node test/career.mjs [baseUrl] [outDir]
import { chromium } from 'playwright';
const base = process.argv[2] || 'http://localhost:8000/', out = process.argv[3] || '../build/career';
import { mkdirSync } from 'node:fs';
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
await p.goto(base);
await p.waitForFunction(() => window.fh);
await p.waitForSelector('#career [data-go]', { timeout: 15000 });
const shelf0 = await p.$$eval('#career .blk', (els) => els.length);
console.log('starter blocks on the shelf', shelf0);
await p.click('#career [data-go]');
await p.waitForFunction(() => window.fh.game.sp && !document.getElementById('hud').classList.contains('hidden'), null, { timeout: 30000 });
await p.evaluate(() => document.querySelectorAll('#intro').forEach((e) => e.classList.add('hidden')));
// Carve: strip the top few layers and wait for status.
await p.evaluate(() => {
  const g = window.fh.game, v = g.sp.vol;
  const k0 = Math.floor(v.nz * 0.75);
  for (let n = k0 * v.sz; n < v.count; n++) v.rock[n] = Math.min(v.rock[n], -1.2);
  v.touch(1, 1, k0, v.nx - 2, v.ny - 2, v.nz - 2);
  g.tools.removed += 5000;
});
await p.waitForTimeout(2500);
const before = await p.evaluate(() => { const g = window.fh.game, v = g.sp.vol; let s = 0; for (let n = 0; n < v.count; n += 13) s += v.rock[n]; return { sum: s, exp: g.exposure, seed: g.seed, level: g.level.id }; });
await p.click('#btnPack');
await p.waitForFunction(() => !document.getElementById('menu').classList.contains('hidden'), null, { timeout: 15000 });
await p.waitForTimeout(800);
await p.screenshot({ path: `${out}/shelf.png` });
const card = await p.$eval('#career .blk', (el) => el.textContent);
console.log('first card after packing up:', card.replace(/\s+/g, ' ').slice(0, 160));
console.log('day', await p.$eval('#career .museum b', (el) => el.textContent));
await p.click('#career [data-go]');
await p.waitForFunction(() => window.fh.game.sp && !document.getElementById('hud').classList.contains('hidden'), null, { timeout: 30000 });
await p.waitForTimeout(2000);
const after = await p.evaluate(() => { const g = window.fh.game, v = g.sp.vol; let s = 0; for (let n = 0; n < v.count; n += 13) s += v.rock[n]; return { sum: s, exp: g.exposure, seed: g.seed, level: g.level.id, resumed: g.resumed }; });
console.log('before', JSON.stringify(before), '\nafter ', JSON.stringify(after));
const ok = after.resumed && after.seed === before.seed && Math.abs(after.sum - before.sum) / Math.abs(before.sum) < 1e-3 && Math.abs(after.exp - before.exp) < 0.01;
await p.screenshot({ path: `${out}/resumed.png` });
if (errors.length) console.log('page errors', errors);
await b.close();
console.log(ok && !errors.length ? 'ok' : 'FAIL');
process.exit(ok && !errors.length ? 0 : 1);
