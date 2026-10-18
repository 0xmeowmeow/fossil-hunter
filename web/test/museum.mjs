// Museum: finish a specimen, display it, visit the hall, walk to its case.
//   node test/museum.mjs [baseUrl] [outDir]
import { chromium } from 'playwright';
import { existsSync, mkdirSync } from 'node:fs';
const base = process.argv[2] || 'http://localhost:8000/', out = process.argv[3] || '../build/museum';
mkdirSync(out, { recursive: true });
const nv = existsSync('/usr/share/glvnd/egl_vendor.d/10_nvidia.json');
const env = nv ? { ...process.env, __NV_PRIME_RENDER_OFFLOAD: '1', __GLX_VENDOR_LIBRARY_NAME: 'nvidia', __EGL_VENDOR_LIBRARY_FILENAMES: '/usr/share/glvnd/egl_vendor.d/10_nvidia.json' } : process.env;
const b = await chromium.launch({ args: nv ? ['--use-gl=angle', '--use-angle=gl-egl', '--ignore-gpu-blocklist'] : ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'], env });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
await p.goto(base);
await p.waitForFunction(() => window.fh);
// Prepare and finish two specimens (one an opal), each displayed.
for (const [id, seed, special] of [['wheeler', 5, false], ['ridge', 511, true]]) {
  await p.evaluate(async ({ id, seed, special }) => {
    const d = await import('./src/data.js');
    const lv = special ? d.SPECIAL[id] : d.LEVELS.find((l) => l.id === id);
    const { game } = window.fh;
    await game.load(lv, seed);
    const v = game.sp.vol, k0 = Math.floor((game.sp.z0 - v.origin[2]) / v.voxel) + 1;
    for (let n = (special ? 0 : k0 * v.sz); n < v.count; n++) if (v.fossil[n] <= 0) v.rock[n] = Math.min(v.rock[n], -1.2);
    v.touch(1, 1, 1, v.nx - 2, v.ny - 2, v.nz - 2);
  }, { id, seed, special });
  await p.waitForTimeout(1500);
  await p.evaluate(() => window.fh.game.finish());
  await p.waitForFunction(() => window.fh.game.item?.display, null, { timeout: 60000 });
  await p.click('#where button[data-w="museum"]');
  await p.waitForTimeout(500);
}
await p.evaluate(() => window.fh.game.ui.showMenu());
await p.waitForSelector('#btnMuseum', { timeout: 30000 });
await p.evaluate(() => document.getElementById('btnMuseum').click());
await p.waitForTimeout(2500);
const info = await p.textContent('#museumInfo');
await p.screenshot({ path: `${out}/hall.png` });
// Walk to the star case (middle) by clicking it on screen.
const pt = await p.evaluate(async () => {
  const T = await import('three');
  const m = window.fh.museum, c = m.cases[0].group;
  const v = c.position.clone().setY(1.05).project(window.fh.view.camera);
  return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight];
});
await p.mouse.click(pt[0], pt[1]);
await p.waitForTimeout(1500);
await p.screenshot({ path: `${out}/case.png` });
// And the opal's case (second best, if the opal was worth less).
const pt2 = await p.evaluate(() => {
  const m = window.fh.museum, c = m.cases.find((x) => x.item?.special) ?? m.cases[1];
  const v = c.group.position.clone().setY(1.05).project(window.fh.view.camera);
  return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight, c.group.position.toArray()];
});
await p.evaluate((pos) => { const m = window.fh.museum, T = m.pos.constructor; const c = m.cases.find((x) => x.item?.special); if (c) { const f = new T(0, 0, 1).applyQuaternion(c.group.quaternion); m._walk(c.group.position.clone().addScaledVector(f, c.size / 2 + 0.6).setY(1.4), c.group.position.clone().setY(1.0)); } }, pt2[2]);
await p.waitForTimeout(1500);
await p.screenshot({ path: `${out}/opal-case.png` });
console.log('museum:', info, errors.length ? 'errors: ' + errors.join('; ') : '');
await b.close();
const ok = /2 specimens/.test(info) && !errors.length;
console.log(ok ? 'ok' : 'FAIL');
process.exit(ok ? 0 : 1);
