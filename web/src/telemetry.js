// Anonymous gameplay telemetry (see api/event.php). Events are batched and sent every 20 s
// and when the page is hidden. Nothing identifying is collected.

const URL_ = 'api/event.php';
let install;
try {
  install = localStorage.getItem('fh-install');
  if (!install) {
    install = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    localStorage.setItem('fh-install', install);
  }
} catch {
  install = 'anon' + Math.random().toString(36).slice(2);
}
const session = Math.random().toString(36).slice(2) + Date.now().toString(36);
const t0 = performance.now();
let queue = [];

export function track(type, level = '', data = null) {
  queue.push({ t: Math.round(performance.now() - t0) / 1000, type, level, data });
  if (queue.length >= 60) flush();
}

export function flush() {
  if (!queue.length) return;
  const body = JSON.stringify({ install, session, events: queue.splice(0, queue.length) });
  try {
    if (navigator.sendBeacon) navigator.sendBeacon(URL_, new Blob([body], { type: 'application/json' }));
    else fetch(URL_, { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true });
  } catch {
    /* offline: drop */
  }
}

setInterval(flush, 20000);
addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flush());
addEventListener('pagehide', flush);
track('session_start', '', { ua: /Quest|OculusBrowser/.test(navigator.userAgent) ? 'quest' : /iPad|Mobi/.test(navigator.userAgent) || navigator.maxTouchPoints > 1 ? 'touch' : 'desktop', w: innerWidth, h: innerHeight });
