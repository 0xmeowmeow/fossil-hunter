// Promo video: real gameplay, scripted and captured frame by frame (so it's smooth whatever
// the render speed), then encoded with ffmpeg.
//   node tools/promo.mjs [format...]        formats: vertical (1080x1920), square, wide
// Needs the dev server (./serve.py --port 8000). Uses the NVIDIA GPU when present.
// Output: ../build/promo/fossil-hunter-<format>.mp4

import { chromium } from 'playwright';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const FORMATS = { vertical: [1080, 1920], square: [1080, 1080], wide: [1920, 1080] };
const want = process.argv.slice(2).filter((a) => FORMATS[a]);
const BASE = process.env.PROMO_URL || 'http://localhost:8000/';
const FPS = 30;
const OUT = new URL('../../build/promo/', import.meta.url).pathname;

const nv = existsSync('/usr/share/glvnd/egl_vendor.d/10_nvidia.json');
const env = nv ? { ...process.env, __NV_PRIME_RENDER_OFFLOAD: '1', __GLX_VENDOR_LIBRARY_NAME: 'nvidia', __EGL_VENDOR_LIBRARY_FILENAMES: '/usr/share/glvnd/egl_vendor.d/10_nvidia.json' } : process.env;

// The shots: [start, end, caption, small print]. Times in seconds.
const SHOTS = [
  [0.0, 3.6, 'There’s something inside this rock.', 'Every fossil is generated. No one has seen this one before.'],
  [3.6, 7.2, 'Split it along the bedding…', 'Real techniques: hammer and chisel'],
  [7.2, 11.4, '…then clean it, grain by grain.', 'Air scribe · abrasion · a steady hand'],
  [11.4, 15.2, 'Name it. Display it. Sell it.', ''],
  [15.2, 19.4, 'Some finds turned to opal.', 'Lightning Ridge, NSW · watch the fire move'],
  [19.4, 23.5, '', ''],
];
const END = SHOTS.at(-1)[1];

async function render(format) {
  const [W, H] = FORMATS[format];
  const dir = `${OUT}${format}/`;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=gl-egl', '--ignore-gpu-blocklist'], env });
  const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  p.on('pageerror', (e) => console.log('page error', e.message));
  await p.goto(BASE);
  await p.waitForFunction(() => window.fh);
  await p.evaluate(async () => { await document.fonts.ready; });

  // Overlay: captions and the end card, styled like the game.
  await p.evaluate(({ W, H }) => {
    const tall = H > W * 1.2;
    const st = document.createElement('style');
    st.textContent = `
      #menu, #hud, #intro, #toast, #tipread, #celebrate, #showlabel, #loading, #results, #guide, #notebook { display: none !important; }
      #vo { position: fixed; inset: 0; pointer-events: none; font-family: Fraunces, serif; color: #f4ead6; }
      #vo .cap { position: absolute; left: 6%; right: 6%; top: ${tall ? '9%' : '7%'}; text-align: center; transition: none; }
      #vo .cap b { display: block; font-weight: 700; font-size: ${tall ? 76 : W > H ? 64 : 58}px; line-height: 1.08; letter-spacing: -0.01em; text-shadow: 0 4px 30px rgba(0,0,0,.65); }
      #vo .cap span { display: block; margin-top: 18px; font: 500 ${tall ? 34 : 28}px Inter, sans-serif; color: #e7c47a; text-shadow: 0 2px 16px rgba(0,0,0,.7); }
      #vo .shade { position: absolute; left: 0; right: 0; top: 0; height: 42%; background: linear-gradient(180deg, rgba(10,9,8,.72), rgba(10,9,8,0)); }
      #vo .brand { position: absolute; left: 0; right: 0; bottom: ${tall ? '7%' : '5%'}; text-align: center; font: 500 ${tall ? 30 : 24}px 'IBM Plex Mono', monospace; letter-spacing: .12em; color: rgba(244,234,214,.75); }
      #vo .label { position: absolute; left: 50%; bottom: ${tall ? '17%' : '10%'}; transform: translateX(-50%) rotate(-1.2deg); background: #f1e6cc; color: #2a2118; padding: 18px 30px 16px; border-radius: 4px; box-shadow: 0 10px 40px rgba(0,0,0,.5); text-align: left; min-width: ${tall ? 640 : 560}px; }
      #vo .label .c { font: 500 ${tall ? 20 : 17}px 'IBM Plex Mono', monospace; letter-spacing: .08em; color: #6b5a44; }
      #vo .label .n { font: italic 700 ${tall ? 54 : 46}px Fraunces, serif; margin-top: 4px; }
      #vo .label .l { font: 500 ${tall ? 24 : 20}px Fraunces, serif; margin-top: 2px; }
      #vo .end { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; background: radial-gradient(ellipse at 50% 45%, rgba(23,23,26,.55), rgba(12,11,10,.94) 70%); }
      #vo .end .t { font: 800 ${tall ? 120 : 104}px/1 Fraunces, serif; letter-spacing: -0.02em; }
      #vo .end .s { font: italic 500 ${tall ? 46 : 40}px Fraunces, serif; color: #e7c47a; margin-top: 18px; }
      #vo .end .u { margin-top: ${tall ? 70 : 44}px; font: 600 ${tall ? 44 : 38}px 'IBM Plex Mono', monospace; color: #fff; background: rgba(217,169,78,.18); border: 2px solid #d9a94e; padding: 16px 28px; border-radius: 14px; }
      #vo .end .f { margin-top: ${tall ? 40 : 28}px; font: 500 ${tall ? 38 : 30}px Inter, sans-serif; color: rgba(244,234,214,.85); max-width: 85%; line-height: 1.35; }
    `;
    document.head.appendChild(st);
    const vo = document.createElement('div');
    vo.id = 'vo';
    vo.innerHTML = `<div class="shade"></div><div class="cap"><b></b><span></span></div><div class="label" style="display:none"><div class="c"></div><div class="n"></div><div class="l"></div></div>` +
      `<div class="brand">FOSSIL HUNTER · MEOW-MEOW.IO/TRILOBITE</div>` +
      `<div class="end" style="display:none"><div class="t">Fossil Hunter</div><div class="s">Free what the rock has kept.</div>` +
      `<div class="u">meow-meow.io/trilobite</div><div class="f">Play free in your browser, today.<br>VR on Meta Quest and the full museum game are coming: sign up on the site for updates.</div></div>`;
    document.body.appendChild(vo);
    window.fh.view.renderer.setAnimationLoop(null); // we drive every frame
  }, { W, H });

  let frame = 0;
  const shot = async () => {
    await p.screenshot({ path: `${dir}f${String(frame++).padStart(5, '0')}.png` });
  };
  const caption = (t) => p.evaluate((s) => {
    const vo = document.getElementById('vo');
    vo.querySelector('.cap b').textContent = s?.[2] ?? '';
    vo.querySelector('.cap span').textContent = s?.[3] ?? '';
    vo.querySelector('.cap').style.opacity = s?.[4] ?? 1;
  }, t);
  const capFor = (t) => {
    const s = SHOTS.find((x) => t >= x[0] && t < x[1]);
    if (!s) return null;
    const fade = Math.min(1, (t - s[0]) / 0.35, (s[1] - t) / 0.35);
    return [...s, Math.max(0, fade)];
  };
  // Advance the scene (in-page) and capture one frame.
  const step = async (t, fn, arg) => {
    await p.evaluate(({ fn, arg, dt }) => {
      const { game, view } = window.fh;
      window.__promo[fn]?.(arg);
      view.update(dt);
      view.updateDirty(400);
      view.render();
    }, { fn, arg, dt: 1 / FPS });
    await caption(capFor(t));
    await shot();
  };

  // Scene helpers live in the page.
  await p.evaluate(() => {
    const { game, view } = window.fh;
    const P = (window.__promo = {});
    P.load = async (id, seed, special) => {
      const d = await import('./src/data.js');
      const lv = special ? d.SPECIAL[id] : d.LEVELS.find((l) => l.id === id);
      await game.load(lv, seed);
      view.renderer.setAnimationLoop(null);
      document.getElementById('intro')?.classList.add('hidden');
      for (let i = 0; i < 40 && view.sp.vol.dirty.size; i++) view.updateDirty(400);
    };
    P.spin = ({ a, tilt }) => {
      const T = view.root.quaternion.constructor;
      const q1 = new T().setFromAxisAngle(view.root.up.clone().set(1, 0, 0), tilt ?? 0);
      const q2 = new T().setFromAxisAngle(view.root.up.clone().set(0, 1, 0), a);
      view.root.quaternion.copy(q2).multiply(q1);
    };
    P.split = async () => {
      const sp = game.sp, v = sp.vol, E = 1200;
      const z = sp.z0 + 1.5 * v.voxel, y = (sp.bLo[1] + sp.bHi[1]) / 2;
      const h = v.raycast([sp.bLo[0] - 0.1, y, z], [1, 0, 0], 5);
      if (!h) return;
      const ev = game.tools.chiselStrike(h.g, [1, 0, 0], [0, 1, 0], 'wedge', E * 0.85);
      const r = ev.strike;
      if (r.debris) view.addDebris(r.debris, [0.05, 0.02, 0.5], 0.7);
      game.sfx?.crack?.(r.size);
    };
    // Cleaning: a front sweeps across the block, taking rock off down to the shell.
    P.clean = (f) => {
      const sp = game.sp, v = sp.vol;
      const x0 = sp.bLo[0] - 0.05, x1 = sp.bHi[0] + 0.05, fx = x0 + (x1 - x0) * f;
      const k0 = Math.floor((sp.z0 - v.origin[2]) / v.voxel) + 1;
      const i1 = Math.min(v.nx - 2, Math.floor((fx - v.origin[0]) / v.voxel));
      const i0 = Math.max(1, (P._ci ?? 1));
      if (i1 < i0) return;
      const pts = [];
      for (let k = k0; k < v.nz - 1; k++)
        for (let j = 1; j < v.ny - 1; j++)
          for (let i = i0; i <= i1; i++) {
            const n = i + j * v.sy + k * v.sz;
            if (v.fossil[n] > 0 || v.rock[n] <= 0) continue;
            v.rock[n] = -1.2;
            if (((n * 2654435761) >>> 0) % 900 === 0) pts.push(v.pos(i, j, k));
          }
      v.touch(i0, 1, k0, i1, v.ny - 2, v.nz - 2);
      P._ci = i1 + 1;
      if (pts.length) view.spawnChips(pts.slice(0, 40), 3);
    };
    P.strip = () => {
      const v = game.sp.vol;
      for (let n = 0; n < v.count; n++) v.rock[n] = Math.min(v.rock[n], -1.2);
      v.touch(1, 1, 1, v.nx - 2, v.ny - 2, v.nz - 2);
    };
    P.light = ({ az, el }) => view.setLight(az, el);
    P.zoom = (d) => { view.camDist = d; view._placeCamera(); };
    P.label = (on) => {
      const el = document.querySelector('#vo .label');
      if (!on) { el.style.display = 'none'; return; }
      const c = game.guide.find((x) => x.isTrue);
      el.querySelector('.c').textContent = `FH-${String(game.seed).padStart(6, '0')} · PREPARED ON THE BENCH`;
      el.querySelector('.n').textContent = `${c.genus} ${c.species}`;
      el.querySelector('.l').textContent = `${game.level.title}, ${game.level.place}`;
      el.style.display = 'block';
    };
    P.end = (on) => { document.querySelector('#vo .end').style.display = on ? 'flex' : 'none'; document.querySelector('#vo .brand').style.display = on ? 'none' : 'block'; };
  });

  const tall = H > W * 1.2;
  const baseDist = await p.evaluate(() => window.fh.view.camDist);
  const fitDist = tall ? baseDist * 0.78 : baseDist * 0.72;

  // --- Shot 1-4: one grey-shale block, start to finish.
  await p.evaluate(() => window.__promo.load('wheeler', 5));
  await p.evaluate((d) => window.__promo.zoom(d), fitDist);
  await p.evaluate(() => window.__promo.light({ az: -1.0, el: 0.45 }));
  const N = (s) => Math.round(s * FPS);
  let t = 0;
  for (let i = 0; i < N(3.6); i++, t += 1 / FPS) await step(t, 'spin', { a: -0.5 + i * 0.006, tilt: 0.18 });
  // The split: one blow, then the slab flies.
  await p.evaluate(() => window.__promo.split());
  for (let i = 0; i < N(3.6); i++, t += 1 / FPS) await step(t, 'spin', { a: -0.5 + (N(3.6) + i) * 0.006, tilt: 0.18 });
  // Cleaning sweep.
  for (let i = 0; i < N(4.2); i++, t += 1 / FPS) {
    await p.evaluate((f) => window.__promo.clean(f), Math.min(1, i / (N(4.2) * 0.85)));
    await step(t, 'spin', { a: -0.5 + (N(7.2) + i) * 0.006, tilt: 0.18 + i * 0.002 });
  }
  // Reveal: turntable and label.
  await p.evaluate(() => window.__promo.label(true));
  for (let i = 0; i < N(3.8); i++, t += 1 / FPS) {
    await p.evaluate((d) => window.__promo.zoom(d), fitDist * (1 - 0.12 * Math.min(1, i / N(1.5))));
    await step(t, 'spin', { a: -0.5 + N(11.4) * 0.006 + i * 0.018, tilt: 0.42 });
  }
  await p.evaluate(() => window.__promo.label(false));

  // --- Shot 5: the opal.
  await p.evaluate(() => window.__promo.load('ridge', 1, true));
  await p.evaluate(() => window.__promo.strip());
  await p.evaluate((d) => window.__promo.zoom(d), fitDist * 0.72);
  for (let i = 0; i < N(4.2); i++, t += 1 / FPS) {
    await p.evaluate((x) => window.__promo.light({ az: -1.6 + x * 2.4, el: 0.55 + 0.25 * Math.sin(x * 6) }), i / N(4.2));
    await step(t, 'spin', { a: 0.4 + i * 0.012, tilt: 0.75 + 0.15 * Math.sin(i / 20) });
  }

  // --- Shot 6: end card over the turning opal.
  await p.evaluate(() => window.__promo.end(true));
  for (let i = 0; i < N(4.1); i++, t += 1 / FPS) await step(t, 'spin', { a: 0.4 + (N(4.2) + i) * 0.012, tilt: 0.85 });

  await b.close();
  const mp4 = `${OUT}fossil-hunter-${format}.mp4`;
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', `${dir}f%05d.png`,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4]);
  console.log(format, `${frame} frames →`, mp4);
}

for (const f of want.length ? want : Object.keys(FORMATS)) await render(f);
