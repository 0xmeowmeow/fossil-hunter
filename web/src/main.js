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

function start(level, seed) {
  ui.showLoading();
  // Let the loading screen paint before the (synchronous) build.
  setTimeout(() => game.load(level, seed), 350);
}

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

let last = performance.now();
view.renderer.setAnimationLoop(() => {
  const now = performance.now();
  const dt = (now - last) / 1000;
  last = now;
  xr.update(dt);
  game.update(dt);
  view.render();
});
