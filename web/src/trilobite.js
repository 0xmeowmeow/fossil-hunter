// Seeded trilobite as a signed distance field. Port of proto/fossilgen/trilobite.py.
//
// Body frame: length 1 along +y (tail -0.5, head +0.5), x across, z up, shield base on z=0.
// The dorsal shield is a height field over the outline; eyes and spines are 3D shapes
// smooth-unioned on. Spines carry a part id so they can snap off individually.

import { ARCHETYPES, INT_PARAMS } from './data.js';
import { Rng, hash3 } from './rng.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const sq = (v) => v * v;
const ramp = (x, a, b) => {
  const u = clamp((x - a) / (b - a), 0, 1);
  return u * u * (3 - 2 * u);
};
const smin = (a, b, k) => {
  const h = clamp(0.5 + 0.5 * (b - a) / k, 0, 1);
  return b * (1 - h) + a * h - k * h * (1 - h);
};

function draw(rng, ranges) {
  const out = {};
  for (const [k, [lo, hi]] of Object.entries(ranges)) out[k] = rng.uniform(lo, hi);
  return out;
}

export function sampleTrilobite(seed, { archetype, weights, pure = false, pose = {} } = {}) {
  const rng = new Rng(seed);
  const names = Object.keys(ARCHETYPES);
  const primary = archetype ?? rng.weighted(Object.keys(weights), Object.values(weights));
  const secondary = rng.pick(names);
  const w = pure ? 1 : rng.next() > 0.15 ? rng.uniform(0.75, 1) : rng.uniform(0.45, 0.7);
  const a = draw(rng, ARCHETYPES[primary]), b = draw(rng, ARCHETYPES[secondary]);
  const anatomy = {};
  for (const k of Object.keys(a)) anatomy[k] = w * a[k] + (1 - w) * b[k];
  for (const k of INT_PARAMS) anatomy[k] = Math.round(anatomy[k]);
  anatomy.glabellar_furrows = 1 + rng.int(3);
  const p = {
    enroll: rng.normal(0, 0.05), roll: 0, tilt: rng.normal(0, 0.03),
    yaw: rng.uniform(-Math.PI, Math.PI), flatten: rng.uniform(0.75, 0.95), sink: 0.006,
    ...pose,
  };
  return { seed, archetype: primary, blend: secondary, blendWeight: w, anatomy, pose: p };
}

// ---------------------------------------------------------------- body frame

function tubercles(X, Y, cell, seed) {
  const gx = X / cell, gy = Y / cell;
  const ix = Math.floor(gx), iy = Math.floor(gy);
  let out = 0;
  for (let di = -1; di <= 1; di++) {
    for (let dj = -1; dj <= 1; dj++) {
      const cx = ix + di, cy = iy + dj;
      const px = cx + 0.2 + 0.6 * hash3(cx, cy, 0, seed);
      const py = cy + 0.2 + 0.6 * hash3(cy, cx, 1, seed);
      const rad = 0.25 + 0.2 * hash3(cx, cy, 2, seed);
      const d = Math.hypot(gx - px, gy - py) / rad;
      const v = Math.pow(clamp(1 - d * d, 0, 1), 1.5);
      if (v > out) out = v;
    }
  }
  return out;
}

/** Half-width w(y) and shield height top(x, y). Returns [w, top]. */
export function outlineTop(a, X, Y, seed) {
  const yt = -0.5, yh = 0.5, yc = yh - a.ceph_len, yp = yt + a.pyg_len;
  const Wc = a.ceph_halfwidth, Wf = Wc * a.thorax_front, Wb = Wc * a.thorax_taper;
  const cl = a.ceph_len, pl = a.pyg_len, tl = yc - yp, n = a.n_thorax, H = a.height;
  const ax = Math.abs(X);

  const v = clamp((Y - yc) / cl, 0, 1);
  const w_c = Wc * Math.pow(clamp(1 - Math.pow(v, a.ceph_shape), 0, 1), 1 / a.ceph_shape);
  const u = clamp((yc - Y) / tl, 0, 1);
  const s = u * n, fr = s - Math.floor(s);
  const w_line = Wf + (Wb - Wf) * u;
  const w_t = w_line * (0.965 + 0.035 * Math.pow(Math.sin(Math.PI * fr), 0.5));
  const q = clamp((yp - Y) / pl, 0, 1);
  const w_p = Wb * 0.96 * Math.pow(clamp(1 - Math.pow(q, a.pyg_shape), 0, 1), 1 / a.pyg_shape);

  const in_c = Y >= yc, in_t = Y < yc && Y >= yp;
  let w = in_c ? w_c : in_t ? w_t : w_p;
  if (Y < yt || Y > yh) w = 0;
  const r = ax / Math.max(w, 1e-4);

  // Trunk: axial lobe, axial furrows, sloping pleural fields.
  const A = a.axial_ratio * (in_t ? w_line : Wb * Math.pow(clamp(1 - q / 0.85, 0, 1), 0.6));
  const a_n = ax / Math.max(A, 1e-4);
  const pleura = 0.45 * Math.pow(clamp(1 - Math.pow(r, 2.5), 0, 1), 0.5);
  const ring = 0.55 * Math.sqrt(clamp(1 - a_n * a_n, 0, 1));
  const furrow = -0.12 * Math.exp(-sq((a_n - 1) / 0.18));
  const trunk = pleura + ring + furrow;

  const seg = Math.pow(Math.cos(Math.PI * fr), 6);
  const frd = fr - 0.35 * clamp((ax - A) / Math.max(w_line, 1e-3), 0, 1);
  const pf = Math.exp(-sq((frd - 0.45) / 0.07)) * ramp(a_n, 1.05, 1.4);
  const top_t = trunk * (1 - 0.28 * seg) - 0.06 * pf;

  const sp = (q / 0.85) * a.n_pyg, frp = sp - Math.floor(sp);
  const segp = Math.pow(Math.cos(Math.PI * frp), 8) * (q < 0.85 ? 1 : 0) * (1 - q);
  const bw = 0.1 + 0.15 * a.border;
  let top_p = trunk * (1 - 0.3 * segp);
  const bb = ramp(r, 1 - bw - 0.04, 1 - bw + 0.04);
  top_p = top_p * (1 - bb) + Math.min(top_p, 0.18) * bb;

  // Cephalon: cheeks, border rim, glabella with furrows, occipital ring.
  const cheek = 0.58 * Math.pow(clamp(1 - r * r, 0, 1), 0.45);
  const bwc = 0.08 + 0.1 * a.border;
  const rim = 0.12 * a.border * Math.exp(-sq((r - (1 - bwc * 0.5)) / (bwc * 0.35)));
  const bfur = -0.08 * Math.exp(-sq((r - (1 - bwc)) / 0.04));
  const gy0 = yc + 0.13 * cl;
  const gy1 = Math.min(yc + a.glabella_len * cl, yh - 0.03);
  const gu = (Y - gy0) / (gy1 - gy0);
  const Ag0 = a.axial_ratio * Wf;
  const gw = Ag0 * (1 + (a.glabella_front - 1) * clamp(gu, 0, 1));
  const gx = ax / gw;
  const e = gx * gx + sq(Math.max(gu - 0.55, 0) / 0.45) + sq(Math.max(-gu, 0) / 0.04);
  let glab = (0.6 + a.glabella_height) * Math.sqrt(clamp(1 - e, 0, 1));
  const furrows = [0.18, 0.38, 0.58].slice(0, a.glabellar_furrows);
  for (const k of furrows) glab -= 0.1 * Math.exp(-sq((gu - k) / 0.035)) * ramp(gx, 0.25, 0.5) * ramp(glab, 0, 0.1);
  const occ_y = (Y - yc) / (gy0 - yc);
  const occ = 0.5 * Math.sqrt(clamp(1 - sq(ax / Ag0), 0, 1)) * (occ_y < 0.8 ? 1 : 0) * (1 - 0.3 * Math.exp(-sq((occ_y - 0.1) / 0.15)));
  const gfur = -0.1 * Math.exp(-sq((Math.sqrt(e) - 1) / 0.12)) * (gu > -0.3 ? 1 : 0);
  const top_c = Math.max(cheek + rim + bfur + gfur, glab, occ);

  // Blend the joints so the height field has no steps.
  const bc = ramp(Y, yc - 0.01, yc + 0.01), bp = ramp(Y, yp - 0.01, yp + 0.01);
  let top = top_c * bc + (top_t * bp + top_p * (1 - bp)) * (1 - bc);
  top = (top - 0.08 * Math.exp(-sq((Y - yc - 0.012) / 0.01)) * ramp(a_n, 0.8, 1.2)) * H;
  top = Math.max(top, H * 0.2);
  if (a.tubercles > 0) top += tubercles(X, Y, 0.032, seed) * a.tubercles * H * 0.22 * (1 - ramp(r, 0.88, 0.97));
  return [w, top];
}

function cone(A, B, ra, rb, part) {
  const ba = [B[0] - A[0], B[1] - A[1], B[2] - A[2]];
  const bb = ba[0] * ba[0] + ba[1] * ba[1] + ba[2] * ba[2];
  const m = Math.max(ra, rb);
  return {
    part, k: 0.01, A, B, ra, rb,
    lo: [Math.min(A[0], B[0]) - m, Math.min(A[1], B[1]) - m, Math.min(A[2], B[2]) - m],
    hi: [Math.max(A[0], B[0]) + m, Math.max(A[1], B[1]) + m, Math.max(A[2], B[2]) + m],
    f(x, y, z) {
      const px = x - A[0], py = y - A[1], pz = z - A[2];
      const h = clamp((px * ba[0] + py * ba[1] + pz * ba[2]) / bb, 0, 1);
      return Math.hypot(px - ba[0] * h, py - ba[1] * h, pz - ba[2] * h) - (ra + (rb - ra) * h);
    },
  };
}

function ellipsoid(c, r) {
  const rmin = Math.min(...r);
  return {
    part: 0, k: 0.012,
    lo: [c[0] - r[0], c[1] - r[1], c[2] - r[2]], hi: [c[0] + r[0], c[1] + r[1], c[2] + r[2]],
    f(x, y, z) {
      const k = Math.hypot((x - c[0]) / r[0], (y - c[1]) / r[1], (z - c[2]) / r[2]);
      return (k - 1) * rmin;
    },
  };
}

/** Eyes and spines. Each spine gets its own part id (1, 2, ...); eyes are part 0 (body). */
export function shapes(a, seed, minR) {
  const yt = -0.5, yc = 0.5 - a.ceph_len, yp = yt + a.pyg_len;
  const Wc = a.ceph_halfwidth, Wf = Wc * a.thorax_front, Wb = Wc * a.thorax_taper;
  const H = a.height, n = a.n_thorax;
  const out = [];
  let part = 1;
  const R = (r) => Math.max(r, minR);
  for (const sx of [-1, 1]) {
    if (a.genal_spine > 0.03) {
      let p = [sx * Wc * 0.96, yc + 0.012, H * 0.18];
      let ang = a.genal_angle;
      const seg = a.genal_spine / 3;
      const radii = [0.026, 0.017, 0.009, 0.003];
      const id = part++;
      for (let i = 0; i < 3; i++) {
        const q = [p[0] + sx * Math.sin(ang) * seg, p[1] - Math.cos(ang) * seg, Math.max(p[2] - 0.08 * seg, 0.01)];
        out.push(cone(p, q, R(radii[i]), R(radii[i + 1]), id));
        p = q;
        ang -= 0.12;
      }
    }
    const es = a.eye_size;
    const ex = sx * a.eye_x * Wc, ey = yc + a.eye_y * a.ceph_len;
    const [, top] = outlineTop(a, ex, ey, seed);
    out.push(ellipsoid([ex, ey, top + 0.1 * es], [0.45 * es, es, 0.6 * es]));
    if (a.pleural_spine > 0.02) {
      for (let i = 0; i < n; i++) {
        const y = yc - (i + 0.5) * (yc - yp) / n;
        const f = i / Math.max(n - 1, 1);
        const wl = Wf + (Wb - Wf) * f;
        const th = 0.25 + 0.9 * f;
        const L = a.pleural_spine * (0.5 + 0.8 * f);
        const A = [sx * wl * 0.9, y, H * 0.15];
        out.push(cone(A, [A[0] + sx * Math.cos(th) * L, A[1] - Math.sin(th) * L, A[2] - H * 0.1], R(0.012), R(0.003), part++));
      }
    }
    for (let j = 0; j < a.pyg_spines; j++) {
      const qj = ((j + 1) / (a.pyg_spines + 1)) * 0.9;
      const y = yp - qj * a.pyg_len;
      const wp = Wb * 0.96 * Math.pow(1 - Math.pow(qj, a.pyg_shape), 1 / a.pyg_shape);
      const th = 0.8 + 0.5 * qj;
      const L = 0.08 + 0.2 * a.pleural_spine;
      const A = [sx * wp * 0.9, y, H * 0.12];
      out.push(cone(A, [A[0] + sx * Math.cos(th) * L, A[1] - Math.sin(th) * L, A[2] - H * 0.08], R(0.011), R(0.003), part++));
    }
  }
  if (a.tail_spine > 0.03) out.push(cone([0, yt + 0.03, H * 0.3], [0, yt - a.tail_spine, 0.015], R(0.022), R(0.004), part++));
  if (a.occipital_spine > 0.03) {
    const o = a.occipital_spine;
    const z0 = H * (0.6 + a.glabella_height) * 0.9;
    out.push(cone([0, yc + 0.06 * a.ceph_len, z0], [0, yc - 0.5 * o, z0 + 0.8 * o], R(0.016), R(0.004), part++));
  }
  return { list: out, nParts: part };
}

// ---------------------------------------------------------------- field + pose

export class Trilobite {
  /** minR: smallest spine radius allowed (keep spines at least ~1.3 voxels thick). */
  constructor(spec, { res = 0.004, minR = 0.009, scale = 1 } = {}) {
    this.spec = spec;
    this.scale = scale; // body length in block units
    const a = (this.a = spec.anatomy);
    const sh = shapes(a, spec.seed, minR);
    this.shapes = sh.list;
    this.nParts = sh.nParts;

    // 2D height field over the body (spines excluded).
    const pad = 0.02;
    this.hx0 = -a.ceph_halfwidth - pad;
    this.hy0 = -0.5 - pad;
    this.hres = res;
    this.hnx = Math.ceil((2 * a.ceph_halfwidth + 2 * pad) / res) + 1;
    this.hny = Math.ceil((1 + 2 * pad) / res) + 1;
    this.dxy = new Float32Array(this.hnx * this.hny);
    this.top = new Float32Array(this.hnx * this.hny);
    for (let j = 0; j < this.hny; j++) {
      const Y = this.hy0 + j * res;
      for (let i = 0; i < this.hnx; i++) {
        const X = this.hx0 + i * res;
        const [w, top] = outlineTop(a, X, Y, spec.seed);
        this.dxy[j * this.hnx + i] = Math.max(Math.abs(X) - w, Math.max(-0.5 - Y, Y - 0.5));
        this.top[j * this.hnx + i] = top;
      }
    }

    const p = spec.pose;
    const cy = Math.cos(p.yaw), sy = Math.sin(p.yaw);
    const ct = Math.cos(p.tilt), st = Math.sin(p.tilt);
    const cr = Math.cos(p.roll), sr = Math.sin(p.roll);
    // R = Rz(yaw) Rx(tilt) Ry(roll), row-major 3x3.
    const Rz = [cy, -sy, 0, sy, cy, 0, 0, 0, 1];
    const Rx = [1, 0, 0, 0, ct, -st, 0, st, ct];
    const Ry = [cr, 0, sr, 0, 1, 0, -sr, 0, cr];
    this.R = mul3(mul3(Rz, Rx), Ry);
    this.Rb = Math.abs(p.enroll) > 1e-3 ? 1 / p.enroll : null;
    this.offset = [0, 0, 0];
    this.part = 0;
  }

  _hf(x, y, arr) {
    const fx = (x - this.hx0) / this.hres, fy = (y - this.hy0) / this.hres;
    const i = Math.floor(fx), j = Math.floor(fy);
    if (i < 0 || j < 0 || i >= this.hnx - 1 || j >= this.hny - 1) return null;
    const tx = fx - i, ty = fy - j, n = this.hnx, k = j * n + i;
    return (arr[k] * (1 - tx) + arr[k + 1] * tx) * (1 - ty) + (arr[k + n] * (1 - tx) + arr[k + n + 1] * tx) * ty;
  }

  /** SDF in the body frame. Sets this.part to the spine id that owns the point (0 = body). */
  bodyField(x, y, z) {
    let d;
    const dxy = this._hf(x, y, this.dxy);
    if (dxy === null) d = 0.1;
    else d = Math.max(dxy, Math.max((z - this._hf(x, y, this.top)) * 0.6, -z));
    const dBody = d;
    let part = 0, best = dBody;
    for (const s of this.shapes) {
      const k = s.k;
      if (x < s.lo[0] - k || y < s.lo[1] - k || z < s.lo[2] - k || x > s.hi[0] + k || y > s.hi[1] + k || z > s.hi[2] + k) continue;
      const ds = s.f(x, y, z);
      d = smin(d, ds, k);
      if (s.part && ds < best) {
        best = ds;
        part = s.part;
      }
    }
    this.part = part;
    return d;
  }

  _unbend(x, y, z) {
    const R = this.Rb;
    if (R === null) return [x, y, z];
    const Zc = z + R;
    if (R > 0) return [x, R * Math.atan2(y, Zc), Math.hypot(y, Zc) - R];
    return [x, R * Math.atan2(-y, -Zc), -Math.hypot(y, Zc) - R];
  }

  _bend(x, y, z) {
    const R = this.Rb;
    if (R === null) return [x, y, z];
    const phi = y / R, rr = R + z;
    return [x, rr * Math.sin(phi), rr * Math.cos(phi) - R];
  }

  toWorld(x, y, z) {
    const [bx, by, bz] = this._bend(x, y, z);
    const R = this.R;
    const wx = R[0] * bx + R[1] * by + R[2] * bz;
    const wy = R[3] * bx + R[4] * by + R[5] * bz;
    const wz = (R[6] * bx + R[7] * by + R[8] * bz) * this.spec.pose.flatten;
    const k = this.scale;
    return [wx * k + this.offset[0], wy * k + this.offset[1], wz * k + this.offset[2]];
  }

  /** World-space SDF (approximate). this.part is set as a side effect. */
  field(x, y, z) {
    const k = this.scale;
    const qx = (x - this.offset[0]) / k, qy = (y - this.offset[1]) / k, qz = (z - this.offset[2]) / k / this.spec.pose.flatten;
    const R = this.R; // inverse rotation = transpose
    const bx = R[0] * qx + R[3] * qy + R[6] * qz;
    const by = R[1] * qx + R[4] * qy + R[7] * qz;
    const bz = R[2] * qx + R[5] * qy + R[8] * qz;
    const [ux, uy, uz] = this._unbend(bx, by, bz);
    return this.bodyField(ux, uy, uz) * this.spec.pose.flatten * k;
  }

  /** World bounds from the shield outline and (optionally) spine end points. */
  bounds(withSpines = true) {
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    const add = (p) => {
      for (let i = 0; i < 3; i++) {
        lo[i] = Math.min(lo[i], p[i]);
        hi[i] = Math.max(hi[i], p[i]);
      }
    };
    const step = 4;
    for (let j = 0; j < this.hny; j += step) {
      for (let i = 0; i < this.hnx; i += step) {
        const k = j * this.hnx + i;
        if (this.dxy[k] > 0) continue;
        const X = this.hx0 + i * this.hres, Y = this.hy0 + j * this.hres;
        add(this.toWorld(X, Y, 0));
        add(this.toWorld(X, Y, this.top[k]));
      }
    }
    if (withSpines) for (const s of this.shapes) for (const c of [s.lo, s.hi]) add(this.toWorld(c[0], c[1], c[2]));
    return { lo, hi };
  }

  /** Centre the footprint on the origin and sink the base slightly into the plane z = z0. */
  restOnPlane(z0 = 0) {
    this.offset = [0, 0, 0];
    const { lo, hi } = this.bounds();
    this.offset = [-(lo[0] + hi[0]) / 2, -(lo[1] + hi[1]) / 2, z0 - lo[2] - this.spec.pose.sink * this.scale];
    return {
      lo: [lo[0] + this.offset[0], lo[1] + this.offset[1], lo[2] + this.offset[2]],
      hi: [hi[0] + this.offset[0], hi[1] + this.offset[1], hi[2] + this.offset[2]],
    };
  }
}

function mul3(A, B) {
  const C = new Array(9);
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++) C[r * 3 + c] = A[r * 3] * B[c] + A[r * 3 + 1] * B[3 + c] + A[r * 3 + 2] * B[6 + c];
  return C;
}

/**
 * Several animals in one block, behaving as one shape: the field is the union, `part` is a
 * global spine id, and `which` says which animal owns the point just evaluated.
 */
export class Assemblage {
  constructor(members) {
    this.members = members; // [{ tri, lo, hi }]
    let base = 0;
    for (const m of members) {
      m.partBase = base;
      base += m.tri.nParts - 1;
    }
    this.nParts = base + 1;
    this.part = 0;
    this.which = 0;
  }

  field(x, y, z) {
    let best = Infinity;
    this.part = 0;
    for (let i = 0; i < this.members.length; i++) {
      const m = this.members[i];
      // Cheap box test first: far from this animal, its box distance is a good enough bound.
      const dx = Math.max(m.lo[0] - x, x - m.hi[0], 0), dy = Math.max(m.lo[1] - y, y - m.hi[1], 0), dz = Math.max(m.lo[2] - z, z - m.hi[2], 0);
      const bd = Math.hypot(dx, dy, dz);
      if (bd > 0.04 && bd >= best) continue;
      let d = bd > 0.04 ? bd : m.tri.field(x, y, z);
      // A partial animal: the missing piece is cut away by a vertical plane.
      if (m.cut && bd <= 0.04) d = Math.max(d, (x - m.cut.c[0]) * m.cut.n[0] + (y - m.cut.c[1]) * m.cut.n[1] - m.cut.k);
      if (d < best) {
        best = d;
        this.which = i;
        this.part = bd > 0.04 || !m.tri.part ? 0 : m.tri.part + m.partBase;
      }
    }
    return best;
  }

  /** Material colour override where an animal has one (sutures, tooth roots, opal). */
  tint(x, y, z) {
    this.field(x, y, z);
    const m = this.members[this.which];
    return m?.tri.tint ? m.tri.tint(x, y, z) : null;
  }

  bounds(withSpines = true) {
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (const m of this.members) {
      const b = m.tri.bounds(withSpines);
      for (let i = 0; i < 3; i++) {
        lo[i] = Math.min(lo[i], b.lo[i]);
        hi[i] = Math.max(hi[i], b.hi[i]);
      }
    }
    return { lo, hi };
  }
}
