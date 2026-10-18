// Crystal clusters: quartz points grown from a crust into an open pocket, the way they come
// out of the red clay of the Ouachita Mountains. Each crystal is a six-sided prism ending in
// a pointed termination; each is a part, and the points snap like spines.
//
// Body frame: the crust lies in the xy plane, crystals grow up and out (+z). The cluster is
// about 1 body unit across.

import { Fossil } from './fossilbase.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export function sampleCluster(rng) {
  const n = 6 + rng.int(9);
  const xs = [];
  for (let i = 0; i < n; i++) {
    // Rooted across the crust, leaning out from its middle; the tallest near the centre.
    const a = rng.uniform(0, Math.PI * 2), r = Math.sqrt(rng.next()) * 0.28;
    const ox = Math.cos(a) * r, oy = Math.sin(a) * r;
    const lean = rng.uniform(0.15, 0.75) * (0.4 + r * 2);
    const la = a + rng.normal(0, 0.4);
    const dir = [Math.cos(la) * Math.sin(lean), Math.sin(la) * Math.sin(lean), Math.cos(lean)];
    const L = rng.uniform(0.22, 0.52) * (1.2 - r);
    xs.push({ o: [ox, oy, -0.02], dir, L, r: L * rng.uniform(0.13, 0.2), tip: rng.uniform(0.9, 1.3), spin: rng.uniform(0, Math.PI / 3) });
  }
  return { kind: 'crystal', xs, crust: rng.uniform(0.3, 0.38), milk: rng.uniform(0.2, 0.6) };
}

/** Signed distance to a hexagon of inradius r in the plane (iq's formula). */
function hex(px, py, r) {
  const kx = -0.866025404, ky = 0.5, kz = 0.577350269;
  px = Math.abs(px);
  py = Math.abs(py);
  const d = 2 * Math.min(kx * px + ky * py, 0);
  px -= d * kx;
  py -= d * ky;
  px -= clamp(px, -kz * r, kz * r);
  py -= r;
  return Math.hypot(px, py) * Math.sign(py);
}

export class Cluster extends Fossil {
  constructor(spec, opts) {
    super(spec, opts);
    const a = this.a;
    this.nParts = a.xs.length + 1;
    // A frame for each crystal: its axis w and two perpendiculars, turned by its spin.
    for (const c of a.xs) {
      const w = c.dir, t = Math.abs(w[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
      let u = [w[1] * t[2] - w[2] * t[1], w[2] * t[0] - w[0] * t[2], w[0] * t[1] - w[1] * t[0]];
      const ul = Math.hypot(...u);
      u = u.map((x) => x / ul);
      const v = [w[1] * u[2] - w[2] * u[1], w[2] * u[0] - w[0] * u[2], w[0] * u[1] - w[1] * u[0]];
      const cs = Math.cos(c.spin), sn = Math.sin(c.spin);
      c.u = u.map((x, i) => cs * x + sn * v[i]);
      c.v = v.map((x, i) => -sn * u[i] + cs * x);
      const tip = c.o.map((x, i) => x + w[i] * c.L);
      c.lo = c.o.map((x, i) => Math.min(x, tip[i]) - c.r * 1.3);
      c.hi = c.o.map((x, i) => Math.max(x, tip[i]) + c.r * 1.3);
    }
    const lo = [-a.crust - 0.05, -a.crust - 0.05, -0.12], hi = [a.crust + 0.05, a.crust + 0.05, 0.1];
    for (const c of a.xs) for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], c.lo[i]); hi[i] = Math.max(hi[i], c.hi[i]); }
    this.box = [lo, hi];
  }

  sdf(x, y, z) {
    const a = this.a;
    this.part = 0;
    // The crust: a lumpy lens of drusy quartz the points grew from.
    // Lumpy with tiny crystal faces, and mostly hidden under the points.
    const lump = 0.012 * (Math.sin(x * 61) * Math.sin(y * 57) + Math.sin((x + y) * 43));
    let d = (Math.hypot(x / a.crust, y / a.crust, (z + 0.05) / 0.04) - 1) * 0.04 - lump;
    for (let i = 0; i < a.xs.length; i++) {
      const c = a.xs[i];
      if (x < c.lo[0] || x > c.hi[0] || y < c.lo[1] || y > c.hi[1] || z < c.lo[2] || z > c.hi[2]) continue;
      const px = x - c.o[0], py = y - c.o[1], pz = z - c.o[2];
      const w = px * c.dir[0] + py * c.dir[1] + pz * c.dir[2];
      const pu = px * c.u[0] + py * c.u[1] + pz * c.u[2], pv = px * c.v[0] + py * c.v[1] + pz * c.v[2];
      // Prism, then the six faces of the termination closing to a point.
      const tipL = c.r * c.tip * 1.6, body = c.L - tipL;
      const r = w < body ? c.r : c.r * Math.max(0, (c.L - w) / tipL);
      const dc = Math.max(hex(pu, pv, r) * (w < body ? 1 : 0.55), -w, w - c.L);
      if (dc < d) {
        d = dc;
        this.part = i + 1;
      }
    }
    return d;
  }

  /** Milky at the roots, clearing towards the points. */
  tintBody(x, y, z) {
    this.sdf(x, y, z);
    const a = this.a;
    if (!this.part) return [0.42, 0.33, 0.27]; // the crust, stained by the clay
    const c = a.xs[this.part - 1];
    const w = (x - c.o[0]) * c.dir[0] + (y - c.o[1]) * c.dir[1] + (z - c.o[2]) * c.dir[2];
    const m = a.milk * (1 - clamp(w / c.L, 0, 1));
    return [0.68 + 0.2 * m, 0.71 + 0.18 * m, 0.75 + 0.15 * m];
  }
}
