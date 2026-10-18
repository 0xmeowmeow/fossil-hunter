// The display bench: after the excavation, saw the block to a tidy shape for showing.
//
// A keep-shape in plan (oval, round, or a custom outline clicked onto the rock) is extruded
// straight down; rock outside it is sawn away. A saw cut levels the base. "Edge finish" runs
// from a clean saw cut to rough, natural-looking edges. Cuts never enter the fossil: the shape
// must contain the fossil's whole footprint and the base stays below it. Each change is
// re-applied to a snapshot of the block, so it previews live; "Mount it" fixes the result.

import * as THREE from 'three';
import { LIM } from './volume.js';

const MAX_POINTS = 16;

export class DisplayBench {
  constructor(game) {
    this.game = game;
    this.active = false;
    this.mounted = false;
  }

  open() {
    const g = this.game, sp = g.sp, v = sp.vol;
    this.sp = sp;
    this.v = v;
    this.active = true;
    this.snap = v.rock.slice();
    // The fossil's footprint (columns holding shell) and its lowest point.
    const cols = new Uint8Array(v.nx * v.ny);
    let kmin = v.nz, rkmin = v.nz;
    for (let n = 0; n < v.count; n++) {
      if (v.fossil[n] > 0) {
        cols[n % v.sz] = 1;
        const k = (n / v.sz) | 0;
        if (k < kmin) kmin = k;
      } else if (v.rock[n] > 0 && rkmin === v.nz) rkmin = (n / v.sz) | 0;
    }
    const foot = [];
    let lo = [Infinity, Infinity], hi = [-Infinity, -Infinity];
    for (let j = 0; j < v.ny; j++)
      for (let i = 0; i < v.nx; i++) {
        if (!cols[i + j * v.nx]) continue;
        // Only the outline matters for containment.
        const edge = !cols[i + 1 + j * v.nx] || !cols[i - 1 + j * v.nx] || !cols[i + (j + 1) * v.nx] || !cols[i + (j - 1) * v.nx];
        const [x, y] = v.pos(i, j, 0);
        if (edge) foot.push([x, y]);
        lo = [Math.min(lo[0], x), Math.min(lo[1], y)];
        hi = [Math.max(hi[0], x), Math.max(hi[1], y)];
      }
    this.foot = foot;
    this.c = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2];
    this.half = [(hi[0] - lo[0]) / 2, (hi[1] - lo[1]) / 2];
    this.zFossil = v.origin[2] + kmin * v.voxel;
    this.zBottom = v.origin[2] + rkmin * v.voxel;
    this.blockR = Math.hypot(sp.bHalf[0], sp.bHalf[1]) + 0.05;
    this.p = { shape: 'none', size: 0.35, base: 0, rough: 0.2, pts: [] };
    this.changed = null;
    this._cutter();
    g.view.skipFine = true;
  }

  close() {
    this.active = false;
    this.game.view.skipFine = false;
    if (this.mesh) {
      this.game.view.off.remove(this.mesh);
      this.mesh.traverse((o) => o.geometry?.dispose());
      this.mesh = null;
    }
  }

  /** Change parameters and re-apply. Returns an error string when the cut would hit the fossil. */
  set(patch) {
    Object.assign(this.p, patch);
    return this.apply();
  }

  addPoint(x, y) {
    if (this.p.pts.length >= MAX_POINTS) return `Up to ${MAX_POINTS} points.`;
    this.p.pts.push([x, y]);
    return this.apply();
  }

  // ---- the keep-shape in plan: signed distance (world units), negative inside

  _sdf2() {
    const { shape, size, pts } = this.p, c = this.c, m = 0.03;
    if (shape === 'oval') {
      // From snug round the fossil (size 0) out to the whole block (size 1).
      const a0 = this.half[0] + m, b0 = this.half[1] + m;
      const s = 1 + size * (this.blockR / Math.min(a0, b0) - 1);
      const a = a0 * s, b = b0 * s, k = Math.min(a, b);
      return (x, y) => (Math.hypot((x - c[0]) / a, (y - c[1]) / b) - 1) * k;
    }
    if (shape === 'round') {
      let r0 = 0;
      for (const [x, y] of this.foot) r0 = Math.max(r0, Math.hypot(x - c[0], y - c[1]));
      r0 += m;
      const r = r0 + size * (this.blockR - r0);
      return (x, y) => Math.hypot(x - c[0], y - c[1]) - r;
    }
    if (shape === 'custom' && pts.length >= 3) return (x, y) => polySDF(pts, x, y);
    return null;
  }

  /** The outline as a closed list of points (for the cutter mesh). */
  _outline() {
    const f = this._sdf2();
    if (!f) return null;
    if (this.p.shape === 'custom') return this.p.pts;
    // Trace the zero contour radially.
    const out = [], c = this.c;
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2, d = [Math.cos(a), Math.sin(a)];
      let lo = 0, hi = this.blockR * 2;
      for (let t = 0; t < 30; t++) {
        const mid = (lo + hi) / 2;
        if (f(c[0] + d[0] * mid, c[1] + d[1] * mid) < 0) lo = mid;
        else hi = mid;
      }
      out.push([c[0] + d[0] * lo, c[1] + d[1] * lo]);
    }
    return out;
  }

  apply() {
    const v = this.v, sp = this.sp, rock = v.rock, snap = this.snap, vx = v.voxel;
    const f = this._sdf2();
    const rough = this.p.rough;
    const amp = 0.018 * rough; // how far the rough edge wanders
    // Never into the fossil: the shape must hold the whole footprint.
    let err = null;
    if (f) for (const [x, y] of this.foot) if (f(x, y) + amp > -vx) { err = 'That would cut into the fossil. Make it bigger.'; break; }
    const zb = this.zBottom + this.p.base * Math.max(0, this.zFossil - 0.02 - this.zBottom);
    // Restore the last change, then cut afresh.
    const ch = this.changed;
    if (ch) {
      for (let k = ch[2]; k <= ch[5]; k++)
        for (let j = ch[1]; j <= ch[4]; j++) {
          const n0 = j * v.sy + k * v.sz;
          rock.set(snap.subarray(n0 + ch[0], n0 + ch[3] + 1), n0 + ch[0]);
        }
    }
    const box = [v.nx, v.ny, v.nz, -1, -1, -1];
    const noise = sp.noise;
    if (!err && (f || this.p.base > 0)) {
      for (let k = 1; k < v.nz - 1; k++) {
        const z = v.origin[2] + k * vx;
        const baseCut = (zb - z) / vx; // >0 below the saw line
        for (let j = 1; j < v.ny - 1; j++) {
          const y = v.origin[1] + j * vx;
          let n = 1 + j * v.sy + k * v.sz;
          for (let i = 1; i < v.nx - 1; i++, n++) {
            if (snap[n] <= -LIM) continue;
            const x = v.origin[0] + i * vx;
            let cut = baseCut; // in voxels; >0 means outside what we keep
            if (f) {
              let d = f(x, y);
              if (d > -amp - 3 * vx) {
                if (amp > 0) d += amp * (noise.fbm(x, y, z, 9, 3) + 0.35 * noise.noise(x * 60, y * 60, z * 60));
                cut = Math.max(cut, d / vx);
              }
            }
            if (cut <= -LIM) continue;
            const nv = Math.min(snap[n], -cut);
            if (nv < rock[n]) {
              rock[n] = Math.max(-LIM, nv);
              if (i < box[0]) box[0] = i; if (j < box[1]) box[1] = j; if (k < box[2]) box[2] = k;
              if (i > box[3]) box[3] = i; if (j > box[4]) box[4] = j; if (k > box[5]) box[5] = k;
            }
          }
        }
      }
    }
    // Remesh whatever changed this time or last time.
    const u = box[3] >= 0 ? box : null;
    const all = ch && u ? [Math.min(ch[0], u[0]), Math.min(ch[1], u[1]), Math.min(ch[2], u[2]), Math.max(ch[3], u[3]), Math.max(ch[4], u[4]), Math.max(ch[5], u[5])] : ch ?? u;
    if (all) v.touch(...all);
    this.changed = u;
    this.zb = zb;
    this._cutter(err);
    return err;
  }

  /** How much rock the mount removed (0..1 of the block), for the label and value. */
  trimmed() {
    let a = 0, b = 0;
    for (let n = 0; n < this.snap.length; n++) {
      if (this.snap[n] > 0) {
        a++;
        if (this.v.rock[n] <= 0) b++;
      }
    }
    return a ? b / a : 0;
  }

  // ---- the see-through saw guide

  _cutter(err) {
    const view = this.game.view;
    if (this.mesh) {
      view.off.remove(this.mesh);
      this.mesh.traverse((o) => o.geometry?.dispose());
    }
    const g = new THREE.Group();
    const col = err ? 0xff5a4a : 0xf0c060;
    const z0 = (this.zb ?? this.zBottom) - 0.01, z1 = this.sp.bHi[2] + 0.04;
    const ol = this._outline();
    if (ol) {
      const pos = [], idx = [], line = [];
      for (let i = 0; i < ol.length; i++) {
        const [x, y] = ol[i];
        pos.push(x, y, z0, x, y, z1);
        const a = 2 * i, b = 2 * ((i + 1) % ol.length);
        idx.push(a, b, b + 1, a, b + 1, a + 1);
        const [x2, y2] = ol[(i + 1) % ol.length];
        line.push(x, y, z1, x2, y2, z1, x, y, z0, x2, y2, z0);
      }
      const wall = new THREE.BufferGeometry();
      wall.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      wall.setIndex(idx);
      g.add(new THREE.Mesh(wall, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false })));
      const lg = new THREE.BufferGeometry();
      lg.setAttribute('position', new THREE.Float32BufferAttribute(line, 3));
      g.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.75 })));
    }
    // Custom points not yet a shape.
    if (this.p.shape === 'custom') {
      const pts = this.p.pts;
      for (const [x, y] of pts) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(0.008, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffd27a }));
        s.position.set(x, y, z1);
        g.add(s);
      }
      if (pts.length === 2) {
        const lg = new THREE.BufferGeometry();
        lg.setAttribute('position', new THREE.Float32BufferAttribute([...pts[0], z1, ...pts[1], z1], 3));
        g.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0xffd27a })));
      }
    }
    // The saw line for the base.
    if (this.p.base > 0) {
      const h = this.sp.bHalf, zz = this.zb;
      const pg = new THREE.PlaneGeometry(h[0] * 2 + 0.06, h[1] * 2 + 0.06);
      const pl = new THREE.Mesh(pg, new THREE.MeshBasicMaterial({ color: 0xf0c060, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }));
      pl.position.set(this.sp.bc[0], this.sp.bc[1], zz);
      g.add(pl);
    }
    g.visible = !this.mounted;
    view.off.add(g);
    this.mesh = g;
  }

  mount() {
    const err = this.apply();
    if (err) return err;
    this.mounted = true;
    if (this.mesh) this.mesh.visible = false;
    const t = this.trimmed();
    const shape = { none: null, oval: 'oval', round: 'round', custom: 'custom-cut' }[this.p.shape];
    this.result = {
      shape, base: this.p.base > 0, rough: this.p.rough, trimmed: t,
      text: [shape && `${shape} mount`, this.p.base > 0 && 'sawn base', shape && (this.p.rough > 0.5 ? 'natural edges' : 'clean saw cut')].filter(Boolean).join(', ') || 'as found',
    };
    this.close();
    this.snap = null;
    return null;
  }
}

/** Signed distance to a polygon (negative inside, even-odd rule). */
function polySDF(p, x, y) {
  let d = Infinity, inside = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [ax, ay] = p[j], [bx, by] = p[i];
    const ex = bx - ax, ey = by - ay, wx = x - ax, wy = y - ay;
    const t = Math.max(0, Math.min(1, (wx * ex + wy * ey) / (ex * ex + ey * ey || 1)));
    d = Math.min(d, Math.hypot(wx - ex * t, wy - ey * t));
    if (ay > y !== by > y && x < (ex * (y - ay)) / (ey || 1e-12) + ax) inside = !inside;
  }
  return inside ? -d : d;
}
