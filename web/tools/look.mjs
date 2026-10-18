// Stills of the bench for judging the look, rendered on the GPU (as the promo is).
//   node tools/look.mjs [tag]     -> ../build/look/<tag>-*.png
// Needs the dev server (./serve.py --port 8000).
import { chromium } from 'playwright';
import { mkdirSync, existsSync } from 'node:fs';

const tag = process.argv[2] || 'now';
const BASE = process.env.LOOK_URL || 'http://localhost:8000/';
const OUT = new URL('../../build/look/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const nv = existsSync('/usr/share/glvnd/egl_vendor.d/10_nvidia.json');
const env = nv ? { ...process.env, __NV_PRIME_RENDER_OFFLOAD: '1', __GLX_VENDOR_LIBRARY_NAME: 'nvidia', __EGL_VENDOR_LIBRARY_FILENAMES: '/usr/share/glvnd/egl_vendor.d/10_nvidia.json' } : process.env;
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=gl-egl', '--ignore-gpu-blocklist'], env });
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
p.on('pageerror', (e) => console.log('page error', e.message));
await p.goto(BASE);
await p.waitForFunction(() => window.fh);
await p.waitForTimeout(1500);
await p.screenshot({ path: `${OUT}${tag}-menu.png` });

const shot = async (level, name, prep) => {
  await p.evaluate(async ({ level, prep }) => {
    const { LEVELS, SPECIAL } = await import('./src/data.js');
    const lv = LEVELS.find((l) => l.id === level) ?? SPECIAL[level];
    window.fh.start(lv, lv.specimen.seed);
    const g = window.fh.game;
    await new Promise((r) => { const t = setInterval(() => { if (g.sp && g.level === lv && !document.getElementById('hud').classList.contains('hidden')) { clearInterval(t); r(); } }, 100); });
    document.querySelectorAll('#intro').forEach((e) => e.classList.add('hidden'));
    const v = g.sp.vol;
    // Clear the rock above the fossil's top so there's something to see.
    if (prep) {
      // As a preparator would: down to the fossil's base where it lies, and to the shallowest
      // fossil's base everywhere else.
      const kf = new Int32Array(v.nx * v.ny).fill(-1);
      for (let j = 0; j < v.ny; j++) for (let i = 0; i < v.nx; i++) for (let k = 0; k < v.nz; k++) if (v.fossil[v.idx(i, j, k)] > 0) { kf[i + j * v.nx] = k; break; }
      const kTop = Math.max(...kf);
      for (let k = 0; k < v.nz; k++) for (let j = 0; j < v.ny; j++) for (let i = 0; i < v.nx; i++) {
        const n = v.idx(i, j, k), c = kf[i + j * v.nx];
        if (v.rock[n] > 0 && v.fossil[n] <= 0 && k > (c >= 0 ? c : kTop) + 1) v.rock[n] = Math.min(v.rock[n], -1.2);
      }
      v.touch(1, 1, 1, v.nx - 2, v.ny - 2, v.nz - 2);
    }
  }, { level, prep });
  await p.waitForFunction(() => { const g = window.fh.game; return g.sp && !g.job; }, null, { timeout: 60000 });
  await p.waitForTimeout(3000);
  await p.evaluate(() => document.querySelectorAll('#hud, #toast, #tipread').forEach((e) => (e.style.visibility = 'hidden')));
  await p.screenshot({ path: `${OUT}${tag}-${name}.png` });
  await p.evaluate(() => document.querySelectorAll('#hud, #toast, #tipread').forEach((e) => (e.style.visibility = '')));
};
const only = process.env.LOOK_ONLY?.split(',');
if (only) {
  for (const id of only) await shot(id, id, 0.42);
  await b.close();
  process.exit(0);
}
await shot('wheeler', 'raw', 0);
await shot('phacops', 'prepped', 0.42);
await shot('ridge', 'opal', 0.4);
// A real blow along the bedding, then a few edge flakes: the spoil should land and stay.
await shot('wheeler', 'split', 0);
await p.evaluate(async () => {
  const T = await import('three');
  const { game } = window.fh, sp = game.sp, v = sp.vol;
  game.settings.head = 'wedge';
  game.settings.pressure = 1;
  const blow = (y, z, dir, charge) => {
    const h = v.raycast([dir > 0 ? sp.bLo[0] - 0.1 : sp.bHi[0] + 0.1, y, z], [dir, 0, 0], 5);
    if (h) game._strike({ tip: new T.Vector3(...v.pos(...h.g)), d: new T.Vector3(dir, 0, 0), e: new T.Vector3(0, 1, 0), charge });
  };
  const ys = [0.3, 0.5, 0.7].map((f) => sp.bLo[1] + f * (sp.bHi[1] - sp.bLo[1]));
  for (const [i, y] of ys.entries()) {
    while (game.job) await new Promise((r) => setTimeout(r, 100));
    blow(y, sp.bHi[2] - 2.5 * v.voxel, i % 2 ? -1 : 1, 0.7);
    await new Promise((r) => setTimeout(r, 1200));
  }
});
await p.waitForTimeout(5000);
console.log('spoil', await p.evaluate(() => JSON.stringify({ flying: window.fh.view.debris.length, spoil: window.fh.view.spoil.map((d) => [d.m.position.x, d.m.position.y, d.m.position.z, d.r].map((x) => +x.toFixed(2))), landed: [...window.fh.view.chipLife].filter((x) => x < 0).length })));
await p.evaluate(() => document.querySelectorAll('#hud, #toast, #tipread').forEach((e) => (e.style.visibility = 'hidden')));
await p.screenshot({ path: `${OUT}${tag}-split.png` });
await b.close();
console.log('wrote', OUT);
