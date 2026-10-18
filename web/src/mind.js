// The mind model: the player's belief about where the fossil is (docs/design-v2.md §B).
//
// A 2.5D shape resting on the bedding plane: an outline (radius as a function of angle, in
// the model's own frame) and a dome over it. It starts as an ovoid; choosing a species from
// the field guide reshapes the outline and dome to that animal; the player can pull and push
// the outline by hand. Careful tools (air scribe, abrader) will not remove rock inside it -
// a competent preparator doesn't blast away what they believe is fossil. The chisel ignores it.

import { outlineTop } from './trilobite.js';

export const NR = 64; // outline samples

export class MindModel {
  constructor(sp) {
    this.sp = sp;
    const v = sp.vol;
    this.z0 = sp.z0;
    this.cx = (sp.bLo[0] + sp.bHi[0]) / 2;
    this.cy = (sp.bLo[1] + sp.bHi[1]) / 2;
    this.yaw = 0;
    this.len = Math.min(sp.bHi[1] - sp.bLo[1], sp.bHi[0] - sp.bLo[0]) * 0.55;
    this.height = 0.1;
    this.shape = new Float32Array(NR); // unit outline (length 1 along the model's y axis)
    this.dome = new Float32Array(NR * 8); // relative height on rings (8 rings out to the rim)
    this.ovoid();
    this.visible = true;
    this.version = 0;
    this.mask = new Uint8Array(v.count);
    this.placed = false;
  }

  /** Reset to a plain egg shape. */
  ovoid() {
    for (let i = 0; i < NR; i++) {
      const a = (i / NR) * 2 * Math.PI;
      const ex = 0.36, ey = 0.5;
      this.shape[i] = 1 / Math.hypot(Math.cos(a) / ex, Math.sin(a) / ey);
    }
    for (let i = 0; i < NR; i++) for (let r = 0; r < 8; r++) this.dome[i * 8 + r] = Math.sqrt(Math.max(0, 1 - ((r + 0.5) / 8) ** 2));
    this.species = null;
    this.version++;
  }

  /**
   * Reshape to a species' typical body (anatomy params), keeping position, heading and size.
   * Outline and dome come from the same generator that made the real fossils.
   */
  fit(anatomy, seed = 1) {
    const a = anatomy;
    let hmax = 1e-6;
    const tops = [];
    for (let i = 0; i < NR; i++) {
      const ang = (i / NR) * 2 * Math.PI;
      const dx = Math.cos(ang), dy = Math.sin(ang);
      // March out from the body centre until we leave the shield.
      let r = 0;
      for (let s = 0.004; s < 0.8; s += 0.004) {
        const [w] = outlineTop(a, dx * s, dy * s, seed);
        if (Math.abs(dx * s) > w || w <= 0) break;
        r = s;
      }
      this.shape[i] = Math.max(r, 0.03);
      for (let k = 0; k < 8; k++) {
        const s = r * ((k + 0.5) / 8);
        const [, top] = outlineTop(a, dx * s, dy * s, seed);
        tops.push(top);
        hmax = Math.max(hmax, top);
      }
    }
    for (let i = 0; i < tops.length; i++) this.dome[i] = tops[i] / hmax;
    this.height = Math.max(0.03, hmax * this.len * 1.1);
    this.species = a;
    this.version++;
  }

  // ---- geometry (volume-local units, z up)

  _toModel(x, y) {
    const dx = x - this.cx, dy = y - this.cy;
    const c = Math.cos(-this.yaw), s = Math.sin(-this.yaw);
    return [(dx * c - dy * s) / this.len, (dx * s + dy * c) / this.len];
  }

  radiusAt(ang) {
    const f = (((ang / (2 * Math.PI)) % 1) + 1) % 1 * NR;
    const i = Math.floor(f), t = f - i;
    return this.shape[i % NR] * (1 - t) + this.shape[(i + 1) % NR] * t;
  }

  _domeAt(ang, rho) {
    const f = (((ang / (2 * Math.PI)) % 1) + 1) % 1 * NR;
    const i = Math.floor(f) % NR, j = (i + 1) % NR, t = f - Math.floor(f);
    const rr = Math.min(7.999, Math.max(0, rho * 8 - 0.5));
    const k = Math.floor(rr), u = rr - k, k2 = Math.min(7, k + 1);
    const a = this.dome[i * 8 + k] * (1 - u) + this.dome[i * 8 + k2] * u;
    const b = this.dome[j * 8 + k] * (1 - u) + this.dome[j * 8 + k2] * u;
    return a * (1 - t) + b * t;
  }

  /** Signed distance-ish (local units): negative inside the believed fossil. */
  sdf(x, y, z) {
    const [mx, my] = this._toModel(x, y);
    const rho = Math.hypot(mx, my), ang = Math.atan2(my, mx);
    const R = this.radiusAt(ang);
    const d2 = (rho - R) * this.len;
    const rel = R > 0 ? rho / R : 1;
    const top = this.z0 + this.height * (rel < 1 ? Math.max(0.15, this._domeAt(ang, rel)) : 0.15);
    return Math.max(d2, z - top, this.z0 - 0.02 - z);
  }

  /** Pull or push the outline so it passes through local point (x, y); falls off over ~30 degrees. */
  pull(x, y) {
    const [mx, my] = this._toModel(x, y);
    const ang = Math.atan2(my, mx), want = Math.hypot(mx, my);
    const cur = this.radiusAt(ang);
    const delta = want - cur;
    for (let i = 0; i < NR; i++) {
      const a = (i / NR) * 2 * Math.PI;
      let da = Math.abs(a - ((ang + 2 * Math.PI) % (2 * Math.PI)));
      da = Math.min(da, 2 * Math.PI - da);
      const w = Math.exp(-((da / 0.28) ** 2));
      this.shape[i] = Math.max(0.02, this.shape[i] + delta * w);
    }
    this.version++;
  }

  move(dx, dy) {
    this.cx += dx;
    this.cy += dy;
    this.version++;
  }

  rotate(da) {
    this.yaw += da;
    this.version++;
  }

  scale(f) {
    this.len = Math.max(0.1, Math.min(2, this.len * f));
    this.height *= f;
    this.version++;
  }

  setHeight(h) {
    this.height = Math.max(0.01, Math.min(0.4, h));
    this.version++;
  }

  /** Is local point (x, y) on the model's footprint? */
  contains2D(x, y) {
    const [mx, my] = this._toModel(x, y);
    return Math.hypot(mx, my) <= this.radiusAt(Math.atan2(my, mx));
  }

  /** Recompute the protection mask over the volume (only near the model). */
  rebuildMask() {
    const v = this.sp.vol, m = this.mask;
    m.fill(0);
    if (!this.placed) return;
    let rmax = 0;
    for (let i = 0; i < NR; i++) rmax = Math.max(rmax, this.shape[i]);
    const R = rmax * this.len + 0.02;
    const [i0, j0, k0] = v.grid(this.cx - R, this.cy - R, this.z0 - 0.03).map((g) => Math.max(0, Math.floor(g)));
    const g1 = v.grid(this.cx + R, this.cy + R, this.z0 + this.height + 0.02);
    const i1 = Math.min(v.nx - 1, Math.ceil(g1[0])), j1 = Math.min(v.ny - 1, Math.ceil(g1[1])), k1 = Math.min(v.nz - 1, Math.ceil(g1[2]));
    for (let k = k0; k <= k1; k++) {
      const z = v.origin[2] + k * v.voxel;
      for (let j = j0; j <= j1; j++) {
        const y = v.origin[1] + j * v.voxel;
        for (let i = i0; i <= i1; i++) {
          const x = v.origin[0] + i * v.voxel;
          if (this.sdf(x, y, z) < 0) m[i + j * v.sy + k * v.sz] = 1;
        }
      }
    }
    this.maskVersion = this.version;
  }

  /** How well the model matches the real fossil: share of shell inside, share of model that is shell. */
  agreement() {
    const v = this.sp.vol, m = this.mask;
    let shell = 0, shellIn = 0, model = 0, modelShell = 0;
    for (let n = 0; n < v.count; n++) {
      const f = v.fossil0[n] > 0;
      if (f) { shell++; if (m[n]) shellIn++; }
      if (m[n]) { model++; if (f) modelShell++; }
    }
    return { covers: shell ? shellIn / shell : 0, tight: model ? modelShell / model : 0 };
  }
}
