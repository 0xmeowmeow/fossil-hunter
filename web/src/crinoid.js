// Crinoids (sea lilies): echinoderms on a stalk. A stem of stacked disc-shaped columnals, a
// cup (calyx) of calcite plates, and arms fringed with pinnules that fanned out to catch food.
// They fossilise lying flat on a bedding plane, the crown fanned or closed like a shut brush,
// as at Crawfordsville, Indiana. Arms are thin and snap like trilobite spines: each is a part.
//
// Body frame: the crown points +y, the stem runs -y, z is up out of the bedding. The largest
// dimension is about 1 body unit.

import { Fossil } from './fossilbase.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/** Distance from (x, y) to segment (ax, ay)-(bx, by), and how far along it (0..1). */
function seg(x, y, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy), 0, 1);
  return [Math.hypot(x - ax - t * dx, y - ay - t * dy), t];
}

export function sampleCrinoid(rng) {
  const n = rng.next() < 0.6 ? 10 : rng.next() < 0.5 ? 5 : 20;
  return {
    kind: 'crinoid', arms: n,
    rc: rng.uniform(0.055, 0.085), // cup radius
    cupY: rng.uniform(0.02, 0.1),
    stemL: rng.uniform(0.35, 0.65), stemR: rng.uniform(0.018, 0.03), bend: rng.uniform(-0.25, 0.25), colN: rng.uniform(70, 120),
    armL: rng.uniform(0.34, 0.48), armR: rng.uniform(0.016, 0.022) * (n > 10 ? 0.7 : 1),
    spread: rng.next() < 0.6 ? rng.uniform(1.3, 2.2) : rng.uniform(0.3, 0.55), // fanned out, or closed
    curl: rng.uniform(-0.6, 0.6), pinN: rng.uniform(62, 84), pin: rng.uniform(2.2, 3),
    plates: rng.uniform(5, 7),
  };
}

export class Crinoid extends Fossil {
  constructor(spec, opts) {
    super(spec, opts);
    const a = this.a;
    this.nParts = a.arms + 1;
    // Each arm as a short polyline from the top of the cup, fanned about +y and curling.
    const SEG = 7;
    this.armsP = [];
    for (let i = 0; i < a.arms; i++) {
      const f = a.arms === 1 ? 0 : i / (a.arms - 1) - 0.5;
      let ang = Math.PI / 2 + a.spread * f;
      let x = Math.cos(ang) * a.rc * 0.8, y = a.cupY + Math.sin(ang) * a.rc * 0.8;
      const pts = [[x, y]];
      const step = a.armL / SEG;
      for (let k = 0; k < SEG; k++) {
        ang += (a.curl * f * 0.9 + a.curl * 0.15) / SEG;
        x += Math.cos(ang) * step;
        y += Math.sin(ang) * step;
        pts.push([x, y]);
      }
      const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]), m = a.armR * 3;
      this.armsP.push({ pts, lo: [Math.min(...xs) - m, Math.min(...ys) - m], hi: [Math.max(...xs) + m, Math.max(...ys) + m] });
    }
    const all = this.armsP.flatMap((p) => p.pts);
    const top = Math.max(...all.map((p) => p[1])), w = Math.max(...all.map((p) => Math.abs(p[0])), a.rc);
    const bot = a.cupY - a.rc - a.stemL;
    // Normalise so the whole animal is about 1 unit long.
    this.k = 1 / Math.max(top - bot, 2 * w);
    this.box = [[-w - 0.05, bot - 0.05, -0.1], [w + 0.05, top + 0.05, 0.12]].map((v) => v.map((c) => c * this.k));
    this.bot = bot;
  }

  sdf(X, Y, Z) {
    const a = this.a, k = this.k;
    const x = X / k, y = Y / k, z = Z / k;
    this.part = 0;
    // Cup: a flattened, plated bowl.
    const cx = x, cy = y - a.cupY;
    const ang = Math.atan2(cy, cx);
    const plate = 1 + 0.06 * Math.abs(Math.cos(ang * a.plates)) ** 0.5;
    let d = (Math.hypot(cx / (a.rc * plate), cy / (a.rc * 1.1 * plate), z / (a.rc * 0.75)) - 1) * a.rc * 0.8;
    // Stem: columnals stacked along a gently bending stalk below the cup.
    const sy0 = a.cupY - a.rc * 0.6, sy1 = this.bot;
    if (y < sy0 + 0.02 && y > sy1 - 0.05) {
      const t = clamp((sy0 - y) / (sy0 - sy1), 0, 1);
      const sx = x - a.bend * t * t * (sy0 - sy1);
      const r = a.stemR * (1 + 0.14 * Math.cos(y * a.colN * TAU)) * (1 - 0.25 * t);
      const ds = Math.max(Math.hypot(sx, z * 1.15) - r, y - sy0, sy1 - y);
      if (ds < d) d = ds;
    }
    // Arms: tapering, fringed with pinnules in the bedding plane, thin out of it.
    for (let i = 0; i < this.armsP.length; i++) {
      const p = this.armsP[i];
      if (x < p.lo[0] || x > p.hi[0] || y < p.lo[1] || y > p.hi[1]) continue;
      let best = Infinity, bt = 0;
      const P = p.pts;
      for (let s = 0; s < P.length - 1; s++) {
        const [dd, t] = seg(x, y, P[s][0], P[s][1], P[s + 1][0], P[s + 1][1]);
        if (dd < best) { best = dd; bt = (s + t) / (P.length - 1); }
      }
      const r = a.armR * (1 - 0.55 * bt);
      // Pinnules: short side-branches, slanting towards the tip, alternating left and right,
      // so each arm reads as a feather.
      const s0 = P[Math.min(P.length - 2, Math.floor(bt * (P.length - 1)))], s1 = P[Math.min(P.length - 1, Math.floor(bt * (P.length - 1)) + 1)];
      const side = (s1[0] - s0[0]) * (y - s0[1]) - (s1[1] - s0[1]) * (x - s0[0]) > 0 ? 1 : 0;
      const ph = bt * a.pinN - best / (r * 3) + side * Math.PI;
      const fringe = 1 + a.pin * Math.pow(0.5 + 0.5 * Math.cos(ph), 7) * (bt > 0.06 ? 1 : 0) * (1 - 0.4 * bt);
      const da = Math.max(best - r * fringe, Math.abs(z) - r * (best < r ? 0.95 : 0.6));
      if (da < d) {
        d = da;
        this.part = i + 1;
      }
    }
    return d * k;
  }
}
