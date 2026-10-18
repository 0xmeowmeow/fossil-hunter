// Frame-time probe: a big bedding split through the real chisel path, with the game's
// animation loop running on the GPU. Reports the worst frames around the blow.
//   node test/frames.mjs [baseUrl]
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
const base = process.argv[2] || 'http://localhost:8000/';
const nv = existsSync('/usr/share/glvnd/egl_vendor.d/10_nvidia.json');
const env = nv ? { ...process.env, __NV_PRIME_RENDER_OFFLOAD: '1', __GLX_VENDOR_LIBRARY_NAME: 'nvidia', __EGL_VENDOR_LIBRARY_FILENAMES: '/usr/share/glvnd/egl_vendor.d/10_nvidia.json' } : process.env;
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=gl-egl', '--ignore-gpu-blocklist'], env });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on('pageerror', (e) => console.log('page error', e.message));
await p.goto(base);
await p.waitForFunction(() => window.fh);
await p.evaluate(async () => { const { LEVELS } = await import('./src/data.js'); await window.fh.game.load(LEVELS.find((l) => l.id === 'wheeler'), 5); document.getElementById('intro')?.classList.add('hidden'); });
await p.waitForTimeout(3000);
const r = await p.evaluate(async () => {
  const T = await import('three');
  const { game } = window.fh, sp = game.sp, v = sp.vol;
  const z = sp.z0 + 1.5 * v.voxel, y = (sp.bLo[1] + sp.bHi[1]) / 2;
  const h = v.raycast([sp.bLo[0] - 0.1, y, z], [1, 0, 0], 5);
  const tip = new T.Vector3(...v.pos(...h.g));
  game.settings.head = 'wedge';
  game.settings.pressure = 1;
  // Time the suspects.
  const T2 = (window.__t = {});
  const wrap = (o, n) => { const f = o[n]; o[n] = function (...a) { const t = performance.now(); try { return f.apply(this, a); } finally { const d = performance.now() - t; (T2[n] ??= []).push(Math.round(d)); } }; };
  wrap(game, '_strikeDone'); wrap(game.view, 'addDebris'); wrap(game.view, '_applyChunk'); wrap(game.view, '_buildChunk'); wrap(game.tools, '_relax'); wrap(game.tools, '_grow'); wrap(game.view, 'updateDirty'); wrap(game.view, 'render'); wrap(game, 'update'); wrap(game.view, 'update');
  const jr = game._runJob; game._runJob = function () { const t = performance.now(); jr.call(this); (T2.runJob ??= []).push(Math.round(performance.now() - t)); };
  const frames = [];
  let last = performance.now(), stop = false;
  const tick = () => { const now = performance.now(); frames.push(now - last); last = now; if (!stop) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  await new Promise((r) => setTimeout(r, 500));
  const n0 = frames.length;
  game._strike({ tip, d: new T.Vector3(1, 0, 0), e: new T.Vector3(0, 1, 0), charge: 0.9 });
  await new Promise((r) => setTimeout(r, 4000));
  stop = true;
  const after = frames.slice(n0).sort((a, b) => b - a);
  const top = (k) => (T2[k] ?? []).slice().sort((a, b) => b - a).slice(0, 3);
  return { t: Object.fromEntries(Object.keys(T2).map((k) => [k, top(k)])), worst: after.slice(0, 5).map((x) => Math.round(x)), over20: after.filter((x) => x > 20).length, frames: after.length, removed: game.tools.removed };
});
console.log(JSON.stringify(r));
await b.close();
