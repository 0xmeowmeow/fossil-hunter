import { View } from './view.js';
import { Sfx } from './audio.js';
import { UI } from './ui.js';
import { Game } from './game.js';
import { Input } from './input.js';
import { XRControl } from './xr.js';
import { LEVELS } from './data.js';
import { buildShowcase } from './showcase.js';
import { track } from './telemetry.js';

const view = new View(document.getElementById('view'));
const sfx = new Sfx();
const ui = new UI();
const game = new Game(view, sfx, ui);
const input = new Input(document.getElementById('view'), document.getElementById('pad'), game);
const xr = new XRControl(view, game, ui);

function start(level, seed, opts) {
  ui.showLoading();
  // Let the loading screen paint before the (synchronous) build.
  setTimeout(() => game.load(level, seed, opts), 350);
}

// Never lose work: save when the page is hidden (tab switch, headset off, app killed).
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && game.sp && !game.finished) game.save();
});

ui.bind(game, input, start);

// The specimen's label belongs to the hero; fade it once the drawers scroll into view.
document.getElementById('menu').addEventListener('scroll', (e) => {
  const lbl = document.getElementById('showlabel');
  if (document.getElementById('showName').textContent === '—') return;
  lbl.classList.toggle('hidden', e.target.scrollTop > window.innerHeight * 0.35);
});

// The landing page: today's specimen turns on its plinth behind the title.
view.showcaseMode(true);
setTimeout(() => {
  const sc = buildShowcase(Math.floor(Math.random() * 1e6));
  view.setShowcase(sc);
  ui.setShowLabel(sc);
}, 50);

XRControl.supported().then((ok) => {
  if (!ok) return;
  ui.showVRButtons(async () => {
    sfx.resume();
    // requestSession must run inside the click, so enter first and build afterwards.
    const entering = xr.enter();
    if (!game.sp) game.load(LEVELS[0]);
    await entering;
  });
});

// Debug / testing hooks.
window.fh = { game, view, start, xr };
const params = new URLSearchParams(location.search);
if (params.has('level')) {
  const lv = LEVELS.find((l) => l.id === params.get('level')) ?? LEVELS[0];
  start(lv, params.has('seed') ? Number(params.get('seed')) : undefined);
}

// Frame timing: a rolling window for the wrist readout in VR, and every 30 s of play an
// anonymous summary to telemetry (so real headsets tell us where frames drop).
const perf = { ms: new Float32Array(240), i: 0, n: 0, sent: performance.now(), p50: 0, p95: 0, worst: 0 };
game.perf = perf;
function notePerf(ms) {
  perf.ms[perf.i] = ms;
  perf.i = (perf.i + 1) % perf.ms.length;
  perf.n = Math.min(perf.n + 1, perf.ms.length);
  if ((perf.i & 15) === 0 && perf.n > 30) {
    const a = Array.from(perf.ms.subarray(0, perf.n)).sort((x, y) => x - y);
    perf.p50 = a[Math.floor(a.length * 0.5)];
    perf.p95 = a[Math.floor(a.length * 0.95)];
    perf.worst = a[a.length - 1];
  }
  const now = performance.now();
  if (game.sp && now - perf.sent > 30000 && perf.n > 60) {
    perf.sent = now;
    track('perf', game.level?.id ?? '', {
      xr: view.renderer.xr.isPresenting, p50: +perf.p50.toFixed(1), p95: +perf.p95.toFixed(1), worst: +perf.worst.toFixed(1),
      voxels: game.sp.vol.count, fineMs: Math.round(view.fineMs ?? 0),
    });
  }
}

let last = performance.now();
view.renderer.setAnimationLoop(() => {
  const now = performance.now();
  const dt = (now - last) / 1000;
  last = now;
  notePerf(dt * 1000);
  xr.update(dt);
  game.update(dt);
  view.render();
});
