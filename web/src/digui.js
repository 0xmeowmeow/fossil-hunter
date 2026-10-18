// The quarry face, drawn: beds in the deposit's own rock, laminations, joints, weathering, and
// whatever shows at the face (real signs and look-alikes). Blocks already cut are dark holes
// with saw marks. Hover shows the block you'd cut; click saws it out.

import { MATRICES, LEVELS } from './data.js';
import { Rng } from './rng.js';
import { CUT_W, COLS, SIGNS, FALSE_SIGNS } from './dig.js';

const W = 1600, H = 800;
const SKY = 0.1; // the top of the face, with soil and grass above

const shade = (hex, k) => {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(v * k))));
  return `rgb(${c})`;
};

/** Face coordinates (0..1) to canvas pixels, and back. */
export const toPx = (x, y) => [x * W, (SKY + y * (1 - SKY)) * H];
export const fromPx = (px, py) => [px / W, (py / H - SKY) / (1 - SKY)];

/** Paint the rock once (it doesn't change); cuts and signs go on top each frame. */
export function paintRock(site, f, seed) {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const lv = LEVELS.find((l) => l.id === site.level);
  const pal = MATRICES[lv.matrix].colours;
  const rng = new Rng(seed);
  // Sky, soil, grass.
  const sky = g.createLinearGradient(0, 0, 0, SKY * H);
  sky.addColorStop(0, '#7f9bb0');
  sky.addColorStop(1, '#c9c2ad');
  g.fillStyle = sky;
  g.fillRect(0, 0, W, SKY * H);
  g.fillStyle = '#4a3a26';
  g.beginPath();
  g.moveTo(0, SKY * H);
  for (let x = 0; x <= W; x += 20) g.lineTo(x, SKY * H - 10 - 8 * Math.sin(x / 90) - rng.uniform(0, 5));
  g.lineTo(W, SKY * H + 6);
  g.lineTo(0, SKY * H + 6);
  g.fill();
  g.strokeStyle = '#5e6b2f';
  g.lineWidth = 2;
  for (let i = 0; i < 260; i++) {
    const x = rng.uniform(0, W), y = SKY * H - 12 - 8 * Math.sin(x / 90);
    g.beginPath();
    g.moveTo(x, y + 4);
    g.lineTo(x + rng.uniform(-4, 4), y - rng.uniform(4, 14));
    g.stroke();
  }
  // Beds: good (productive) beds a shade darker and finely laminated.
  for (const r of f.rows) {
    const [, y0] = toPx(0, r.y0), [, y1] = toPx(0, r.y1);
    const base = pal[rng.int(pal.length)];
    const k = r.good ? 0.78 : 1.02;
    const wav = (x, y) => y + 3 * Math.sin(x / 70 + y) + 2 * Math.sin(x / 23);
    g.fillStyle = shade(base, k);
    g.beginPath();
    g.moveTo(0, wav(0, y0));
    for (let x = 0; x <= W; x += 16) g.lineTo(x, wav(x, y0));
    for (let x = W; x >= 0; x -= 16) g.lineTo(x, wav(x, y1));
    g.fill();
    // Grain.
    for (let i = 0; i < (y1 - y0) * 9; i++) {
      g.fillStyle = shade(pal[rng.int(pal.length)], k * rng.uniform(0.85, 1.12));
      g.globalAlpha = 0.35;
      g.fillRect(rng.uniform(0, W), rng.uniform(y0, y1), rng.uniform(3, 22), rng.uniform(1, 3));
    }
    g.globalAlpha = 1;
    // Laminations.
    const n = r.good ? Math.round((y1 - y0) / 7) : Math.round((y1 - y0) / 26);
    g.strokeStyle = 'rgba(20,14,8,0.22)';
    g.lineWidth = 1;
    for (let i = 1; i < n; i++) {
      const yy = y0 + ((y1 - y0) * i) / n;
      g.beginPath();
      for (let x = 0; x <= W; x += 24) g.lineTo(x, wav(x, yy) + rng.uniform(-1, 1));
      g.stroke();
    }
    // The bedding plane: a dark parting.
    g.strokeStyle = 'rgba(15,10,6,0.6)';
    g.lineWidth = 2.5;
    g.beginPath();
    for (let x = 0; x <= W; x += 16) g.lineTo(x, wav(x, y1));
    g.stroke();
  }
  // Joints: near-vertical cracks through several beds.
  g.strokeStyle = 'rgba(10,7,4,0.5)';
  for (let i = 0; i < 7; i++) {
    let x = rng.uniform(0, W), y = SKY * H + rng.uniform(0, 80);
    g.lineWidth = rng.uniform(1, 2.5);
    g.beginPath();
    g.moveTo(x, y);
    const end = y + rng.uniform(200, 600);
    while (y < Math.min(end, H)) { y += 18; x += rng.uniform(-5, 5); g.lineTo(x, y); }
    g.stroke();
  }
  // Weathering: light from above, darker towards the foot of the face.
  const lt = g.createLinearGradient(0, SKY * H, 0, H);
  lt.addColorStop(0, 'rgba(255,240,210,0.12)');
  lt.addColorStop(1, 'rgba(0,0,0,0.35)');
  g.fillStyle = lt;
  g.fillRect(0, SKY * H, W, H);
  return c;
}

/** One sign at the face, at canvas position (px, py). */
function drawSign(g, kind, px, py, s, rng) {
  g.save();
  g.translate(px, py);
  const dark = 'rgba(25,18,12,0.9)';
  if (kind === 'trilobite') {
    g.strokeStyle = dark;
    g.lineWidth = s * 0.09;
    g.beginPath();
    g.ellipse(0, 0, s * 0.55, s * 0.16, 0, Math.PI * 1.05, Math.PI * 1.95);
    g.stroke();
    g.lineWidth = s * 0.03;
    for (let i = -4; i <= 4; i++) { g.beginPath(); g.moveTo(i * s * 0.1, -s * 0.12); g.lineTo(i * s * 0.1, -s * 0.2); g.stroke(); }
  } else if (kind === 'leaf') {
    g.fillStyle = 'rgba(15,12,9,0.92)';
    g.beginPath();
    g.ellipse(0, 0, s * 0.7, s * 0.05, 0, 0, Math.PI * 2);
    g.fill();
  } else if (kind === 'crystal') {
    g.fillStyle = 'rgba(235,240,245,0.95)';
    g.beginPath();
    g.moveTo(-s * 0.12, s * 0.1); g.lineTo(0, -s * 0.22); g.lineTo(s * 0.1, s * 0.08); g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.9)';
    g.lineWidth = 2;
    for (const a of [0, 1.57, 0.78, 2.35]) { g.beginPath(); g.moveTo(Math.cos(a) * s * 0.3, -s * 0.22 + Math.sin(a) * s * 0.3); g.lineTo(-Math.cos(a) * s * 0.3, -s * 0.22 - Math.sin(a) * s * 0.3); g.stroke(); }
  } else if (kind === 'ammonite') {
    g.strokeStyle = 'rgba(40,32,22,0.9)';
    g.lineWidth = s * 0.06;
    g.beginPath();
    g.arc(0, s * 0.3, s * 0.45, Math.PI * 1.15, Math.PI * 1.85);
    g.stroke();
    g.lineWidth = s * 0.025;
    for (let a = 1.2; a < 1.85; a += 0.08) { g.beginPath(); g.moveTo(Math.cos(a * Math.PI) * s * 0.4, s * 0.3 + Math.sin(a * Math.PI) * s * 0.4); g.lineTo(Math.cos(a * Math.PI) * s * 0.5, s * 0.3 + Math.sin(a * Math.PI) * s * 0.5); g.stroke(); }
  } else if (kind === 'crinoid') {
    g.fillStyle = 'rgba(225,212,185,0.95)';
    g.strokeStyle = 'rgba(60,50,35,0.7)';
    for (let i = -3; i <= 3; i++) { g.beginPath(); g.ellipse(i * s * 0.09, 0, s * 0.04, s * 0.06, 0, 0, Math.PI * 2); g.fill(); g.stroke(); }
  } else if (kind === 'vein') {
    g.strokeStyle = 'rgba(240,236,225,0.85)';
    g.lineWidth = s * 0.03;
    g.beginPath();
    g.moveTo(-s * 0.15, -s * 0.4);
    g.lineTo(s * 0.15, s * 0.4);
    g.stroke();
  } else if (kind === 'stain') {
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, s * 0.35);
    gr.addColorStop(0, 'rgba(176,92,30,0.75)');
    gr.addColorStop(1, 'rgba(176,92,30,0)');
    g.fillStyle = gr;
    g.fillRect(-s * 0.4, -s * 0.4, s * 0.8, s * 0.8);
  } else if (kind === 'burrow') {
    g.fillStyle = 'rgba(30,22,14,0.55)';
    g.beginPath();
    g.ellipse(0, 0, s * 0.09, s * 0.08, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(220,210,190,0.4)';
    g.lineWidth = 1.5;
    g.stroke();
  }
  g.restore();
}

/** Draw the face: rock, signs (unless cut away), cut holes, and the block under the pointer. */
export function drawFace(canvas, rock, st, hover) {
  const g = canvas.getContext('2d');
  g.drawImage(rock, 0, 0);
  const s = (W / COLS) * 0.55;
  const rng = new Rng(1);
  for (const c of st.f.cells) {
    if (!c.sign || c.taken) continue;
    const [px, py] = toPx(c.sign.x, c.sign.y);
    drawSign(g, c.sign.kind, px, py, s, rng);
    if (st.l.looked?.some(([cc, rr]) => cc === c.col && rr === c.row)) {
      g.strokeStyle = 'rgba(232,196,122,0.9)';
      g.lineWidth = 2;
      g.setLineDash([5, 4]);
      g.beginPath();
      g.arc(px, py, s * 0.5, 0, Math.PI * 2);
      g.stroke();
      g.setLineDash([]);
    }
  }
  const bw = CUT_W * W, bh = bw / 2;
  for (const cu of st.l.cuts) {
    const [px, py] = toPx(cu.x, cu.y);
    g.fillStyle = 'rgba(12,9,6,0.88)';
    g.fillRect(px - bw / 2, py - bh / 2, bw, bh);
    g.strokeStyle = 'rgba(200,190,170,0.35)';
    g.lineWidth = 1;
    for (let k = 0; k < 6; k++) { g.beginPath(); g.arc(px - bw / 2, py - bh / 2 + (k * bh) / 6, bh * 0.4, -0.5, 0.5); g.stroke(); }
    g.fillStyle = cu.result === 'barren' ? 'rgba(200,190,170,0.7)' : 'rgba(232,196,122,0.95)';
    g.font = '600 22px Inter, sans-serif';
    g.textAlign = 'center';
    g.fillText(cu.result === 'barren' ? 'barren' : cu.result === 'sawn' ? 'sawn through' : 'a block', px, py + 8);
  }
  if (hover) {
    const [px, py] = toPx(hover[0], hover[1]);
    g.strokeStyle = 'rgba(255,240,210,0.95)';
    g.lineWidth = 3;
    g.setLineDash([12, 8]);
    g.strokeRect(px - bw / 2, py - bh / 2, bw, bh);
    g.setLineDash([]);
  }
}

/** The sign under a face position, if any (for close looks). */
export function signAt(st, x, y) {
  let best = null, bd = 0.04;
  for (const c of st.f.cells) {
    if (!c.sign || c.taken) continue;
    const d = Math.hypot((c.sign.x - x) * 2, c.sign.y - y);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

export const signText = (c) => (c.sign.real ? SIGNS[c.sign.kind] : FALSE_SIGNS.find((f) => f.id === c.sign.kind)).loupe;
export const SIZE = [W, H];
