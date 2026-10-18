// More animals: shells and teeth, each as a signed distance field with the same interface as
// Trilobite (field, part, nParts, bounds, restOnPlane, offset, scale, spec), so they drop into
// blocks, assemblages, meshing and grading unchanged.
//
//   Spiral: Raup (1966) coiling. A generating curve (an ellipse) swept along a logarithmic
//           spiral: whorl expansion W per turn, tube size k, translation T down the axis.
//           T = 0 gives ammonites (planispiral); T > 0 gives snails (helicospiral).
//   Lens:   an outline with upper and lower surfaces: bivalves (one valve or both),
//           brachiopods (unequal valves, beak, fold and sulcus) and shark teeth (serrated
//           crown, bilobed root).
// See docs/assemblages-and-taxa.md.

import { Rng } from './rng.js';
import { Noise } from './noise.js';
import { Fossil } from './fossilbase.js';
import { Crinoid, sampleCrinoid } from './crinoid.js';
import { Leaf, sampleLeaf } from './leaf.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

export { Fossil };

// ---------------------------------------------------------------- coiled shells

export class Spiral extends Fossil {
  constructor(spec, opts) {
    super(spec, opts);
    const a = this.a;
    this.thMax = TAU * a.whorls;
    const Wn = Math.pow(a.W, a.whorls);
    // Size so the largest dimension is about 1 body unit.
    const dia = 2 * Wn * (1 + a.k);
    const height = a.T * (Wn - 1) + 2 * a.k * a.S * Wn;
    this.a0 = 1 / Math.max(dia, height, 1e-6);
    this.zTop = a.T * this.a0; // apex height (centre of the first whorl)
    const R = this.a0 * Wn * (1 + a.k) + 0.02;
    const zLo = -a.T * this.a0 * Wn - a.k * a.S * this.a0 * Wn - 0.02;
    const zHi = a.k * a.S * this.a0 * Wn + 0.02;
    this.box = [[-R, -R, zLo], [R, R, zHi]];
  }

  /** Distance to the tube; also records the coil angle of the nearest whorl in this.th. */
  sdf(x, y, z) {
    const a = this.a, R = Math.hypot(x, y);
    let phi = Math.atan2(y, x);
    if (phi < 0) phi += TAU;
    let best = 1e9;
    for (let n = 0; n <= Math.ceil(a.whorls); n++) {
      const th = phi + TAU * n;
      if (th > this.thMax) break;
      const Rc = this.a0 * Math.pow(a.W, th / TAU);
      // Ribs: periodic swelling across the whorl, stronger on the outer whorls.
      const rib = a.ribs > 0 ? a.ribAmp * Math.pow(Math.max(0, Math.cos(th * a.ribs)), 6) * sstep(0.5, 2, th / TAU) : 0;
      const h = a.k * Rc * (1 + rib), v = h * a.S;
      const zc = -a.T * Rc;
      const dr = (R - Rc) / h, dz = (z - zc) / v;
      let d = (Math.hypot(dr, dz) - 1) * Math.min(h, v);
      // A keel along the venter (outer edge) on some ammonites.
      if (a.keel > 0) d = Math.min(d, Math.hypot(R - Rc - h, z - zc) - a.keel * h);
      if (d < best) {
        best = d;
        this.th = th;
        this.sec = Math.atan2(z - zc, R - Rc);
      }
    }
    return best;
  }

  /** Suture lines: the frilly chamber walls show as dark lines on internal moulds. */
  tintBody(x, y, z) {
    const a = this.a;
    if (!a.sutures) return null;
    this.sdf(x, y, z);
    if (this.th > this.thMax - TAU * 0.6) return null; // the body chamber has no septa
    const s = (this.th * a.septa) / TAU + 0.1 * Math.sin(this.sec * 6) + 0.05 * Math.sin(this.sec * 15);
    const f = s - Math.floor(s);
    return Math.min(f, 1 - f) < 0.035 ? a.sutureCol : null;
  }
}

// ---------------------------------------------------------------- lens-shaped: valves and teeth

export class Lens extends Fossil {
  constructor(spec, opts) {
    super(spec, opts);
    const a = this.a;
    this.noise = new Noise(spec.seed);
    const W = a.halfW * (1 + (a.wing || 0)) + 0.05, L = 0.62;
    const H = (a.H + (a.Hb ?? 0)) * 1.4 + 0.05;
    this.box = [[-W, -L, -H], [W, L, H]];
  }

  sdf(x, y, z) {
    const o = this.outline(x, y);
    if (o > 0.08) return Math.max(o, Math.abs(z) - this.a.H);
    const top = this.top(x, y), bot = this.bottom(x, y);
    return Math.max(o, (z - top) * 0.7, (bot - z) * 0.7);
  }

  tintBody(x, y) {
    const a = this.a;
    if (a.kind === 'shark_tooth' && y < a.rootY + 0.02) return a.rootCol;
    return null;
  }

  outline(x, y) {
    const a = this.a;
    if (a.kind === 'shark_tooth') {
      const L = 0.5, base = -0.05;
      if (y >= base) {
        // Crown: a curved, serrated triangle.
        const t = clamp((y - base) / (L - base), 0, 1);
        const cx = a.curve * t * t * a.halfW;
        let w = a.halfW * Math.pow(1 - t, 0.85);
        if (a.serr > 0) w *= 1 + a.serr * (((y * a.serrN) % 1 + 1) % 1 - 0.5);
        return Math.max(Math.abs(x - cx) - w, y - L);
      }
      // Root: two lobes with a notch in the middle.
      const wr = a.halfW * a.rootW;
      const notch = a.rootDepth * (1 - 0.6 * Math.exp(-((x / (0.28 * wr)) ** 2)));
      return Math.max(Math.abs(x) - wr * (1 - 0.25 * sstep(0.6, 1, (base - y) / a.rootDepth)), base - notch - y, y - base - 0.01);
    }
    // Bivalve / brachiopod: superellipse, skewed, with a straight hinge for brachiopods.
    // Spiriferid brachiopods widen into "wings" along the straight hinge.
    const wing = a.wing ? 1 + a.wing * sstep(-0.05, 0.38, y) : 1;
    const u = (x - a.skew * (y - 0.5)) / (a.halfW * wing), v = (y + 0.02) / 0.5;
    const egg = 1 + a.egg * v;
    let d = (Math.pow(Math.abs(u * egg), a.p) + Math.pow(Math.abs(v), a.p)) ** (1 / a.p) - 1;
    d *= Math.min(a.halfW, 0.5);
    if (a.kind === 'brachiopod') {
      const hy = 0.5 - a.beak;
      d = Math.max(d, y - hy - (a.kind === 'brachiopod' ? a.beak * 0.6 * Math.exp(-((x / 0.08) ** 2)) : 0));
    }
    return d;
  }

  _relief(x, y) {
    const a = this.a;
    // Ribs radiating from the umbo/beak, and concentric growth lines.
    const ux = 0, uy = 0.5;
    const dx = x - ux, dy = uy - y;
    const r = Math.hypot(dx, dy), ang = Math.atan2(dx, dy);
    const rib = a.ribs > 0 ? Math.pow(0.5 + 0.5 * Math.cos(ang * a.ribs), 2) * sstep(0.05, 0.3, r) : 0;
    const gl = a.growth > 0 ? Math.pow(0.5 + 0.5 * Math.cos(r * a.growthN * TAU), 6) : 0;
    return a.ribAmp * rib + a.growth * gl;
  }

  top(x, y) {
    const a = this.a;
    if (a.kind === 'shark_tooth') {
      if (y < -0.05) return a.H * 1.25 * Math.sqrt(clamp(1 - (x / (a.halfW * a.rootW)) ** 2, 0, 1));
      const t = clamp((y + 0.05) / 0.55, 0, 1), cx = a.curve * t * t * a.halfW;
      const w = Math.max(1e-3, a.halfW * Math.pow(1 - t, 0.85));
      return a.H * Math.sqrt(clamp(1 - ((x - cx) / w) ** 2, 0, 1)) * (1 - 0.6 * t);
    }
    const wing = a.wing ? 1 + a.wing * sstep(-0.05, 0.38, y) : 1;
    const u = x / (a.halfW * wing), v = (y - 0.1) / 0.62;
    let h = a.H * Math.pow(clamp(1 - u * u - v * v, 0, 1), 0.6);
    if (a.kind === 'brachiopod' && a.fold) h += a.fold * a.H * Math.exp(-((x / (0.18 * a.halfW)) ** 2)) * sstep(0.45, -0.4, y);
    h += a.H * this._relief(x, y) * clamp(h / a.H * 3, 0, 1);
    return Math.max(h, 0.012);
  }

  bottom(x, y) {
    const a = this.a;
    if (a.kind === 'shark_tooth') return -0.5 * this.top(x, y);
    if (!a.Hb) return -0.004; // a single valve, flat underneath
    const wing = a.wing ? 1 + a.wing * sstep(-0.05, 0.38, y) : 1;
    const u = x / (a.halfW * wing), v = (y - (a.kind === 'brachiopod' ? 0.2 : 0.1)) / 0.62;
    let h = a.Hb * Math.pow(clamp(1 - u * u - v * v, 0, 1), 0.6);
    if (a.kind === 'brachiopod' && a.fold) h -= a.fold * 0.7 * a.Hb * Math.exp(-((x / (0.18 * a.halfW)) ** 2)) * sstep(0.45, -0.4, y);
    return -Math.max(h, 0.012);
  }
}

// ---------------------------------------------------------------- sampling

const R2 = (rng, lo, hi) => rng.uniform(lo, hi);

/** A random animal of a given kind. Returns a spec; makeFossil(spec) builds it. */
export function sampleShell(seed, kind, opts = {}) {
  const rng = new Rng(seed * 13 + 7);
  const pose = { yaw: rng.uniform(-Math.PI, Math.PI), tilt: rng.normal(0, 0.04), roll: 0, flatten: 1, sink: 0.004, enroll: 0, moult: false };
  let a;
  if (kind === 'ammonite') {
    const evolute = rng.next() < 0.5;
    a = {
      kind, W: R2(rng, evolute ? 1.7 : 2.2, evolute ? 2.2 : 3.2), whorls: R2(rng, 3.2, 5), k: evolute ? R2(rng, 0.22, 0.32) : R2(rng, 0.38, 0.5),
      S: R2(rng, 0.55, 0.95), T: 0, ribs: rng.next() < 0.8 ? Math.round(R2(rng, 3, 7)) : 0, ribAmp: R2(rng, 0.06, 0.16),
      keel: rng.next() < 0.3 ? R2(rng, 0.08, 0.14) : 0, sutures: true, septa: Math.round(R2(rng, 10, 16)), sutureCol: [0.09, 0.075, 0.06],
    };
    pose.flatten = rng.next() < 0.5 ? R2(rng, 0.55, 0.85) : 1;
  } else if (kind === 'gastropod') {
    a = {
      kind, W: R2(rng, 1.6, 2.6), whorls: R2(rng, 4, 7), k: R2(rng, 0.42, 0.6), S: R2(rng, 0.8, 1.1), T: R2(rng, 1.2, 4.5),
      ribs: rng.next() < 0.5 ? Math.round(R2(rng, 6, 14)) : 0, ribAmp: R2(rng, 0.04, 0.1), keel: 0, sutures: false,
    };
    // Successive whorls must touch: cap the spire's steepness by the tube size.
    a.T = Math.min(a.T, (1.7 * a.k * a.S) / (a.W - 1));
    pose.roll = (rng.next() < 0.5 ? -1 : 1) * R2(rng, 1.2, 1.6); // lying on its side
  } else if (kind === 'bivalve') {
    a = {
      kind, halfW: R2(rng, 0.42, 0.56), p: R2(rng, 2, 2.6), egg: R2(rng, -0.25, 0.1), skew: R2(rng, -0.25, 0.25),
      H: R2(rng, 0.1, 0.2), Hb: rng.next() < 0.35 ? R2(rng, 0.08, 0.18) : 0, ribs: rng.next() < 0.6 ? Math.round(R2(rng, 14, 34)) : 0,
      ribAmp: R2(rng, 0.04, 0.09), growth: R2(rng, 0.02, 0.07), growthN: R2(rng, 7, 16),
    };
  } else if (kind === 'brachiopod') {
    a = {
      kind, halfW: R2(rng, 0.45, 0.62), p: R2(rng, 2, 2.4), egg: R2(rng, -0.1, 0.15), skew: 0, H: R2(rng, 0.08, 0.16), Hb: R2(rng, 0.14, 0.26),
      beak: R2(rng, 0.04, 0.1), wing: rng.next() < 0.35 ? R2(rng, 0.2, 0.6) : 0, fold: rng.next() < 0.6 ? R2(rng, 0.3, 0.7) : 0,
      ribs: Math.round(R2(rng, 16, 40)), ribAmp: R2(rng, 0.03, 0.08), growth: R2(rng, 0.01, 0.04), growthN: R2(rng, 6, 12),
    };
  } else if (kind === 'shark_tooth') {
    a = {
      kind, halfW: R2(rng, 0.26, 0.42), curve: R2(rng, -0.35, 0.35), H: R2(rng, 0.06, 0.1), serr: rng.next() < 0.7 ? R2(rng, 0.1, 0.18) : 0,
      serrN: R2(rng, 40, 70), rootW: R2(rng, 1.05, 1.3), rootDepth: R2(rng, 0.14, 0.24), rootY: -0.05,
      rootCol: [0.18, 0.11, 0.06],
    };
  } else if (kind === 'crinoid') {
    a = sampleCrinoid(rng);
    pose.tilt = rng.normal(0, 0.02);
  } else if (kind === 'leaf') {
    a = sampleLeaf(rng);
    pose.tilt = 0;
    pose.sink = 0;
  } else throw new Error(`unknown kind ${kind}`);
  Object.assign(pose, opts.pose ?? {});
  return { seed, kind, archetype: kind, blend: kind, blendWeight: 1, anatomy: a, pose };
}

export function makeShell(spec, opts) {
  if (spec.kind === 'crinoid') return new Crinoid(spec, opts);
  if (spec.kind === 'leaf') return new Leaf(spec, opts);
  return spec.kind === 'ammonite' || spec.kind === 'gastropod' ? new Spiral(spec, opts) : new Lens(spec, opts);
}
