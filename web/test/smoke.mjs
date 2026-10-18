// Browser smoke test: menu -> level -> chisel + scribe with the mouse -> finish.
// Saves screenshots to ../build/smoke/ and fails on page errors.
//   node test/smoke.mjs [baseUrl]

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] || 'http://localhost:8000';
const out = new URL('../../build/smoke/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
page.on('crash', () => console.log('PAGE CRASHED'));
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

await page.goto(base);
await page.waitForTimeout(800);
await page.screenshot({ path: out + '01-menu.png' });

const level = process.env.LEVEL || 'phacops';
const t0 = Date.now();
await page.goto(`${base}/?level=${level}`);
await page.waitForSelector('#hud:not(.hidden)', { timeout: 60000 });
console.log('load ms', Date.now() - t0);
await page.click('#btnBegin');
await page.waitForTimeout(1500);
await page.screenshot({ path: out + '02-start.png' });

// Chisel a band across the middle of the block.
const cx = 640, cy = 470;
await page.keyboard.press('1');
await page.mouse.move(cx - 160, cy - 40);
await page.mouse.down();
for (let i = 0; i <= 60; i++) {
  await page.mouse.move(cx - 160 + i * 5, cy - 40 + Math.sin(i / 5) * 30);
  await page.waitForTimeout(40);
}
await page.mouse.up();
await page.waitForTimeout(600);
await page.screenshot({ path: out + '03-chisel.png' });

// Large scribe over the same area.
await page.keyboard.press('2');
await page.mouse.move(cx - 120, cy - 20);
await page.mouse.down();
for (let i = 0; i <= 120; i++) {
  await page.mouse.move(cx - 120 + (i % 40) * 6, cy - 20 + Math.floor(i / 40) * 15);
  await page.waitForTimeout(30);
}
await page.mouse.up();
await page.waitForTimeout(600);
await page.screenshot({ path: out + '04-scribe.png' });

const stats = await page.evaluate(() => ({ exposure: fh.game.exposure, stats: fh.game.tools.stats, chunks: fh.view.chunks.size }));
console.log(JSON.stringify(stats));

await page.click('#btnFinish');
await page.waitForTimeout(500);
await page.screenshot({ path: out + '05-results.png' });

await browser.close();
if (errors.length) {
  console.log('ERRORS:\n' + errors.join('\n'));
  process.exit(1);
}
console.log('ok');
