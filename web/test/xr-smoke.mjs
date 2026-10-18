// VR smoke test with Meta's WebXR emulator (IWER) as a Quest 3: enter VR, touch the rock
// with the right controller and pull the trigger, grab and move the sample with the left
// grip, change tool with A, finish with left Y.
//   node test/xr-smoke.mjs [baseUrl]

import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';

const base = process.argv[2] || 'http://localhost:8000';
const out = new URL('../../build/smoke/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });
const iwer = readFileSync(new URL('../node_modules/iwer/build/iwer.min.js', import.meta.url), 'utf8');

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.addInitScript(`${iwer}\nwindow.__xr = new IWER.XRDevice(IWER.metaQuest3); window.__xr.installRuntime({ forceInstall: true });`);

await page.goto(`${base}/?level=wheeler`);
await page.waitForSelector('#hud:not(.hidden)', { timeout: 60000 });
await page.click('#btnBegin');
await page.waitForSelector('#btnVR2:not(.hidden)', { timeout: 10000 });
await page.click('#btnVR2');
await page.waitForFunction(() => fh.view.renderer.xr.isPresenting, null, { timeout: 15000 });
console.log('entered VR');
await page.waitForFunction(() => !fh.xr?.placePending && fh.view.root.position.y !== 1.05, null, { timeout: 30000 }); // bench placed on the first tracked frame
await page.waitForTimeout(500);

const state = () => page.evaluate(() => ({
  presenting: fh.view.renderer.xr.isPresenting,
  tool: fh.game.settings.tool,
  blows: fh.game.tools.stats.blows,
  root: fh.view.root.position.toArray().map((v) => +v.toFixed(3)),
  aim: fh.game.xrAim && { active: fh.game.xrAim.active, tip: fh.game.xrAim.tip.toArray().map((v) => +v.toFixed(3)) },
}));

// Where is the top of the block in world space, above its centre?
const top = await page.evaluate(() => {
  const sp = fh.game.sp, THREE = fh.view.root.position.constructor;
  const c = [0, 1, 2].map((i) => (sp.bLo[i] + sp.bHi[i]) / 2);
  const p = fh.view.toWorld(new THREE(c[0], c[1], sp.bHi[2]));
  return p.toArray();
});
console.log('block top (world)', top.map((v) => v.toFixed(3)));

// Right controller pointing straight down, tip just into the rock.
await page.evaluate(([x, y, z]) => {
  const r = window.__xr.controllers.right;
  r.position.set(x, y + 0.13 - 0.004, z);
  r.quaternion.set(-Math.SQRT1_2, 0, 0, Math.SQRT1_2);
}, top);
await page.waitForTimeout(300);
// Start from the chisel, then A once -> large scribe.
await page.evaluate(() => fh.game.setTool('chisel'));
await page.evaluate(() => window.__xr.controllers.right.updateButtonValue('a-button', 1));
await page.waitForTimeout(150);
await page.evaluate(() => window.__xr.controllers.right.updateButtonValue('a-button', 0));
await page.waitForTimeout(150);
console.log('after A', JSON.stringify(await state()));

await page.evaluate(() => window.__xr.controllers.right.updateButtonValue('trigger', 0.8));
for (let i = 0; i < 20; i++) {
  await page.evaluate(([x, y, z, i]) => {
    const r = window.__xr.controllers.right;
    r.position.set(x - 0.02 + i * 0.002, y + 0.13 - 0.004 - i * 0.0004, z);
  }, [...top, i]);
  await page.waitForTimeout(80);
}
const s1 = await state();
console.log('after trigger', JSON.stringify(s1));
await page.screenshot({ path: out + '10-xr-work.png' });
await page.evaluate(() => window.__xr.controllers.right.updateButtonValue('trigger', 0));

// Chisel: hold the trigger to wind up, release to strike.
await page.evaluate(() => fh.game.setTool('chisel'));
const blowsBefore = (await state()).blows;
await page.evaluate(([x, y, z]) => {
  const r = window.__xr.controllers.right;
  r.position.set(x + 0.01, y + 0.13 - 0.002, z);
  r.updateButtonValue('trigger', 1);
}, top);
await page.waitForTimeout(2000);
await page.evaluate(() => window.__xr.controllers.right.updateButtonValue('trigger', 0));
await page.waitForFunction((b) => fh.game.tools.stats.blows > b, blowsBefore, { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(1500);
const chiselBlows = (await state()).blows - blowsBefore;
console.log('chisel strikes', chiselBlows);

// Left grip: grab and move the sample 10 cm to the left.
const before = (await state()).root;
await page.evaluate(() => {
  const l = window.__xr.controllers.left;
  l.position.set(-0.2, 1.1, -0.35);
  l.updateButtonValue('squeeze', 1);
});
await page.waitForTimeout(1500);
await page.evaluate(() => window.__xr.controllers.left.position.set(-0.3, 1.1, -0.35));
await page.waitForTimeout(1500);
await page.evaluate(() => window.__xr.controllers.left.updateButtonValue('squeeze', 0));
await page.waitForTimeout(100);
const after = (await state()).root;
console.log('root before/after grab', before, after);

// Finish with left Y.
await page.evaluate(() => window.__xr.controllers.left.updateButtonValue('y-button', 1));
await page.waitForTimeout(400);
const end = await state();
const results = await page.evaluate(() => !document.getElementById('celebrate').classList.contains('hidden'));
console.log('after Y', JSON.stringify(end), 'results shown', results);
await page.screenshot({ path: out + '11-xr-results.png' });

await browser.close();
const fail = [];
if (s1.tool !== 'scribe_large') fail.push('A did not change tool');
if (!(s1.blows > 0)) fail.push('no scribe blows from trigger');
if (Math.abs(after[0] - before[0] - -0.1) > 0.02) fail.push('grab did not move sample');
if (!(top[1] > 1.0 && top[1] < 1.4)) fail.push('bench not placed below the eyes');
if (chiselBlows !== 1) fail.push('VR chisel did not strike exactly once');
if (end.presenting || !results) fail.push('Y did not finish and exit');
if (errors.length) fail.push('page errors:\n' + errors.join('\n'));
if (fail.length) {
  console.log('FAIL\n' + fail.join('\n'));
  process.exit(1);
}
console.log('ok');
