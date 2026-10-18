// What people write on rocks: field numbers in marker, museum numbers on a dab of white
// paint, glued paper labels, rock-shop price stickers, "TOP" for the way up, and (on the
// Lightning Ridge parcel) the miner's circle round the glint with a note to you.
//
// Everything is drawn into one canvas that the rock shader projects straight down onto the
// top face (upper half of the canvas) and straight up onto the underside (lower half). Ink
// only shows on the original weathered surface, so chiselling a mark away removes it.

import { Rng } from './rng.js';

const MARKER = '"Permanent Marker", "Comic Sans MS", cursive';
const PEN = 'Caveat, "Segoe Print", cursive';
const TYPE = '"IBM Plex Mono", ui-monospace, monospace';

const NOTES = [
  'Enjoy!', 'Go gently!', 'Saw colour!!', 'Have fun mate', 'One for the museum', 'Don\'t rush this one',
  'Opal!!', 'Told ya ;)', 'She\'s a beauty', 'Happy digging!', 'Look at that!', 'Careful with it',
];
const SIGNS = ['– Gaz', '– Bev', '– Robbo', '– Shazza', '– Col', '– Dot', '– Mick'];
const RIDGE_FIELDS = ['3 MILE', 'COOCORAN', 'GRAWIN', 'GLENGARRY', 'SHEEPYARD', 'NEW ROMANY'];
const COLLECTORS = ['A. Whitlock', 'M. Ferrier', 'E. Okafor', 'J. Pruett', 'H. Lindqvist', 'R. Tamura', 'L. Haddad', 'C. Bellweather'];
const INKS = ['#141414', '#141414', '#1c3a8c', '#9b1f1f'];

/** Fonts are drawn into a canvas, so they must have loaded first. */
async function fontsReady() {
  if (typeof document === 'undefined' || !document.fonts) return;
  try {
    await Promise.race([
      Promise.all(['40px "Permanent Marker"', '40px Caveat', '20px "IBM Plex Mono"'].map((f) => document.fonts.load(f))),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  } catch { /* fall back to system fonts */ }
}

/**
 * Build the marks for a specimen. Returns { canvas, rect: [x0, y0, S], count } or null when
 * this rock carries nothing (most don't).
 */
export async function makeMarks(sp, level, { px = 1536 } = {}) {
  const salt = [...level.id].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) % 100003, 7);
  const rng = new Rng((sp.seed ?? 1) * 7919 + salt);
  const ridge = !!sp.peekAt;
  const want = {
    field: rng.next() < 0.3,
    museum: rng.next() < 0.18,
    label: rng.next() < 0.14,
    price: rng.next() < 0.1,
    top: rng.next() < 0.1,
  };
  if (!ridge && !Object.values(want).some(Boolean)) return null;
  await fontsReady();

  const c = sp.bc, h = sp.bHalf;
  const S = Math.max(sp.bHi[0] - sp.bLo[0], sp.bHi[1] - sp.bLo[1]) + 0.04;
  const x0 = c[0] - S / 2, y0 = c[1] - S / 2;
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = px * 2;
  const ctx = canvas.getContext('2d');
  const k = px / S; // pixels per world unit
  // Face 'top' fills the upper half, read from above; 'bottom' the lower half, read with the
  // block flipped over toward you.
  const toPx = (face, x, y) => face === 'top'
    ? [(x - x0) * k, (1 - (y - y0) / S) * px]
    : [(x - x0) * k, px + ((y - y0) / S) * px];
  const zTop = c[2] + h[2] - 0.03, zBot = c[2] - h[2] + 0.03;
  const fl = sp.fLo, fh = sp.fHi;

  /** Is a w x h (world units) patch at (x, y) wholly on this face, clear of the fossil? */
  const fits = (face, x, y, w, hh, avoidFossil = true) => {
    const z = face === 'top' ? zTop : zBot;
    for (const [u, v] of [[0, 0], [-1, -1], [1, -1], [-1, 1], [1, 1], [0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const px_ = x + (u * w) / 2, py_ = y + (v * hh) / 2;
      if (sp.rockSDF(px_, py_, z) > -0.02) return false;
      if (face === 'top' && avoidFossil && px_ > fl[0] - 0.03 && px_ < fh[0] + 0.03 && py_ > fl[1] - 0.03 && py_ < fh[1] + 0.03) return false;
    }
    return true;
  };
  const spot = (face, w, hh, avoidFossil = true) => {
    for (let t = 0; t < 80; t++) {
      const x = c[0] + rng.uniform(-h[0], h[0]), y = c[1] + rng.uniform(-h[1], h[1]);
      if (fits(face, x, y, w, hh, avoidFossil)) return [x, y];
    }
    return null;
  };

  const text = (face, x, y, str, font, size, colour, angle = 0) => {
    const [cx, cy] = toPx(face, x, y);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.font = `${Math.round(size * k)}px ${font}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = colour;
    ctx.fillText(str, 0, 0);
    ctx.restore();
  };
  const width = (str, font, size) => {
    ctx.font = `${Math.round(size * k)}px ${font}`;
    return ctx.measureText(str).width / k;
  };
  const face = () => (rng.next() < 0.7 ? 'bottom' : 'top');
  let count = 0;

  // The miner's circle round the glint, and a note.
  if (ridge) {
    const [px_, py_] = sp.peekAt, u = sp.hollow?.u ?? [1, 0];
    const ra = 0.14, rb = 0.105, rot = Math.atan2(u[1], u[0]);
    const [cx, cy] = toPx('top', px_, py_);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-rot);
    ctx.strokeStyle = 'rgba(15,15,15,0.92)';
    ctx.lineWidth = 0.0075 * k;
    ctx.lineCap = ctx.lineJoin = 'round';
    ctx.beginPath();
    const a0 = rng.uniform(0, Math.PI * 2), turns = 1.12 + rng.uniform(0, 0.1);
    for (let i = 0; i <= 120; i++) {
      const a = a0 + (i / 120) * turns * Math.PI * 2;
      const wob = 1 + 0.05 * Math.sin(a * 3 + a0) + 0.03 * Math.sin(a * 7) + (i / 120) * 0.08;
      const x = Math.cos(a) * ra * wob * k, y = Math.sin(a) * rb * wob * k;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
    // The note goes beside the circle, wherever there's room.
    const note = rng.pick(NOTES), sign = rng.pick(SIGNS);
    const size = 0.05, w = Math.max(width(note, MARKER, size), width(sign, MARKER, size * 0.8)) + 0.02;
    let placed = false;
    for (let t = 0; t < 24 && !placed; t++) {
      const a = (t / 24) * Math.PI * 2 + rng.uniform(-0.2, 0.2), r = 0.22 + (t % 3) * 0.04;
      const x = px_ + Math.cos(a) * (r + w / 3), y = py_ + Math.sin(a) * r;
      if (!fits('top', x, y, w, 0.1, false)) continue;
      if (Math.abs(x - px_) < ra + w / 2 && Math.abs(y - py_) < rb + 0.06) continue;
      const ang = rng.uniform(-0.18, 0.18);
      text('top', x, y + 0.022, note, MARKER, size, 'rgba(15,15,15,0.92)', ang);
      text('top', x + 0.02, y - 0.03, sign, MARKER, size * 0.8, 'rgba(15,15,15,0.9)', ang);
      placed = true;
    }
    // And on the underside, which field it came from.
    const where = `${rng.pick(RIDGE_FIELDS)}  L.R.`;
    const s = spot('bottom', width(where, MARKER, 0.04) + 0.02, 0.06);
    if (s) text('bottom', s[0], s[1], where, MARKER, 0.04, 'rgba(15,15,15,0.9)', rng.uniform(-0.15, 0.15));
    count += 2;
  }

  const pfx = level.id.slice(0, 2).toUpperCase();
  if (want.field) {
    const f = face(), str = `${pfx}-${1 + rng.int(60)}${rng.next() < 0.5 ? `/${1 + rng.int(12)}` : ''}`;
    const w = width(str, MARKER, 0.038) + 0.02, s = spot(f, w, 0.06);
    if (s) {
      text(f, s[0], s[1], str, MARKER, 0.038, rng.pick(INKS), rng.uniform(-0.25, 0.25));
      count++;
    }
  }
  if (want.museum) {
    // A dab of white paint with the catalogue number in fine pen, as museums number specimens.
    const f = rng.next() < 0.8 ? 'bottom' : 'top';
    const str = `FH.P.${1000 + rng.int(8999)}`, w = width(str, PEN, 0.032) + 0.026, s = spot(f, w, 0.05);
    if (s) {
      const [cx, cy] = toPx(f, s[0], s[1]), ang = rng.uniform(-0.12, 0.12);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(ang);
      ctx.fillStyle = 'rgba(242,240,232,0.96)';
      ctx.beginPath();
      const W = (w * k) / 2, H = 0.022 * k;
      for (let i = 0; i <= 40; i++) {
        const a = (i / 40) * Math.PI * 2, r = 1 + 0.06 * Math.sin(a * 5 + cx) + 0.04 * Math.sin(a * 11);
        const x = Math.sign(Math.cos(a)) * Math.abs(Math.cos(a)) ** 0.4 * W * r, y = Math.sign(Math.sin(a)) * Math.abs(Math.sin(a)) ** 0.4 * H * r;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.fill();
      ctx.restore();
      text(f, s[0], s[1], str, PEN, 0.032, '#161616', ang);
      count++;
    }
  }
  if (want.label) {
    // A glued paper label, typed, from an old collection.
    const f = rng.next() < 0.75 ? 'bottom' : 'top';
    const lines = [level.place.split(',').slice(-2).join(',').trim(), `Coll. ${rng.pick(COLLECTORS)}`, `${1890 + rng.int(120)}   No. ${1 + rng.int(900)}`];
    const size = 0.017, w = Math.max(...lines.map((l) => width(l, TYPE, size))) + 0.03, hh = lines.length * size * 1.35 + 0.024;
    const s = spot(f, w, hh);
    if (s) {
      const [cx, cy] = toPx(f, s[0], s[1]), ang = rng.uniform(-0.08, 0.08);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(ang);
      ctx.fillStyle = 'rgba(236,228,206,0.97)';
      ctx.fillRect((-w * k) / 2, (-hh * k) / 2, w * k, hh * k);
      ctx.strokeStyle = 'rgba(90,70,40,0.6)';
      ctx.lineWidth = 0.0012 * k;
      ctx.strokeRect((-w * k) / 2 + 0.005 * k, (-hh * k) / 2 + 0.005 * k, w * k - 0.01 * k, hh * k - 0.01 * k);
      // A torn-off corner.
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.moveTo((w * k) / 2 + 1, (-hh * k) / 2 - 1);
      ctx.lineTo((w * k) / 2 - 0.02 * k, (-hh * k) / 2 - 1);
      ctx.lineTo((w * k) / 2 + 1, (-hh * k) / 2 + 0.016 * k);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#2a2420';
      ctx.font = `${Math.round(size * k)}px ${TYPE}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      lines.forEach((l, i) => ctx.fillText(l, (-w * k) / 2 + 0.015 * k, (-hh * k) / 2 + (0.012 + size * 1.35 * (i + 0.5)) * k));
      ctx.restore();
      count++;
    }
  }
  if (want.price) {
    const f = face(), r = 0.026, s = spot(f, 2 * r, 2 * r);
    if (s) {
      const [cx, cy] = toPx(f, s[0], s[1]);
      ctx.fillStyle = rng.pick(['#f2a33a', '#f0dc4a', '#ef6f6c', '#7fd18b']);
      ctx.beginPath();
      ctx.arc(cx, cy, r * k, 0, Math.PI * 2);
      ctx.fill();
      text(f, s[0], s[1], `$${rng.pick([4, 5, 8, 10, 12, 15, 20])}`, 'Inter, sans-serif', 0.022, '#1b1b1b', rng.uniform(-0.3, 0.3));
      count++;
    }
  }
  if (want.top) {
    const s = spot('top', 0.1, 0.06);
    if (s) {
      text('top', s[0], s[1], 'TOP', MARKER, 0.034, rng.pick(INKS), rng.uniform(-0.3, 0.3));
      count++;
    }
  }
  if (!count) return null;
  return { canvas, rect: [x0, y0, S], count };
}
