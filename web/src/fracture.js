// Brittle fracture for the hammer and chisel. See docs/fracture-research.md.
//
// A blow can only remove material by running a crack that cuts a piece free. Each strike
// tries a set of candidate fracture surfaces, each an implicit region f(x) < 0 (grid
// coords, voxel units) that would come away:
//   - cones flaring from the contact (Hertzian), along the drive and bent off it: near an
//     edge the cone breaks out through the side and a flake comes off; in the middle of a
//     face it never breaks out, so the blow just crushes;
//   - bedding planes below the contact: a side blow with the blade along the bedding can
//     open a whole layer;
//   - the plane of the blade (a wedge splits);
//   - joints (pre-existing cracks).
// The piece is the solid connected to the contact inside the region. Its cost is the
// toughness of every face the crack must cut to free it (bedding, joints and earlier
// damage are weak; a clean fossil parting is weak). A candidate is possible if the blow's
// energy pays for it. Among those, the crack takes the path that best fits how the chisel
// is driven and costs least. Leftover energy crushes and microcracks the rock around.
//
// Where the crack meets the fossil it follows the shell if the matrix parts cleanly there,
// and cuts through it where it is welded.

import { LIM } from './volume.js';
import { E_MAX, HEADS } from './data.js';

const DEG = Math.PI / 180;

const norm = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

export class Fracture {
  constructor(sp, rng) {
    this.sp = sp;
    this.v = sp.vol;
    this.rng = rng;
    this.mark = new Uint32Array(this.v.count);
    this.stack = new Int32Array(this.v.count);
    this.stamp = 0;
    this.partCache = new Map();
    // The block rests on the bench: anything connected to its lowest layers can't fly off.
    // `down` is gravity in volume space; the game updates it as the block is turned.
    this.down = [0, 0, -1];
    this._brace([0, 0, -1]);
  }

  /**
   * Which side is braced: the side resting on the bench (gravity), or, for a blow from
   * underneath, the top (you hold the block down from above). Sets the plane beyond which
   * a voxel counts as part of the supported block.
   */
  _brace(d) {
    const v = this.v;
    let s = this.down;
    if (dot(d, s) < -0.3) s = [-s[0], -s[1], -s[2]];
    this.braceDir = s;
    let max = -Infinity;
    const { nx, ny, nz, sy, sz } = v, rock = v.rock;
    for (let k = 1; k < nz - 1; k += 2)
      for (let j = 1; j < ny - 1; j += 2) {
        let n = 1 + j * sy + k * sz;
        for (let i = 1; i < nx - 1; i += 2, n += 2) {
          if (rock[n] <= 0) continue;
          const t = i * s[0] + j * s[1] + k * s[2];
          if (t > max) max = t;
        }
      }
    this.braceAt = max - 4;
  }

  braced(q) {
    const v = this.v, s = this.braceDir;
    const i = q % v.nx, j = ((q / v.sy) | 0) % v.ny, k = (q / v.sz) | 0;
    return i * s[0] + j * s[1] + k * s[2] > this.braceAt;
  }

  solid(n) {
    return this.v.rock[n] > 0 || this.v.fossil[n] > 0;
  }

  /** Fossil material (the rock field also fills the space the fossil occupies, so don't compare). */
  isFos(n) {
    return this.v.fossil[n] > 0;
  }

  ijk(n) {
    const v = this.v;
    return [n % v.nx, Math.floor(n / v.sy) % v.ny, Math.floor(n / v.sz)];
  }

  partingAt(n) {
    let p = this.partCache.get(n);
    if (p === undefined) {
      const [i, j, k] = this.ijk(n);
      p = this.sp.parting(...this.v.pos(i, j, k));
      this.partCache.set(n, p);
    }
    return p;
  }

  /** Matrix skin (voxels) a crack leaves on the shell here: thin where it parts cleanly. */
  skin(n) {
    const p = this.partingAt(n);
    if (p < this.deflect) return 0; // welded: no parting to follow
    // Patchy, in smooth blotches a few mm across.
    const v = this.v;
    const x = v.origin[0] + (n % v.nx) * v.voxel, y = v.origin[1] + (((n / v.sy) | 0) % v.ny) * v.voxel, z = v.origin[2] + ((n / v.sz) | 0) * v.voxel;
    const h = 0.5 + 0.5 * this.sp.noise.noise(x * 22 + 31.7, y * 22, z * 22);
    return Math.max(0, ((1 - p) * 6 + 0.6) * this.skinScale * (0.2 + 1.3 * h) - 0.4);
  }

  tough(n) {
    const v = this.v;
    if (this.isFos(n)) return this.sp.fossilMat.T * (1 - 0.5 * v.dmg[n]);
    return this.sp.rockT(n, n % v.nx, ((n / v.sy) | 0) % v.ny, (n / v.sz) | 0);
  }

  /** Toughness of the face between two solid voxels: cracks follow a clean fossil parting. */
  faceT(a, b) {
    const fa = this.isFos(a), fb = this.isFos(b);
    if (fa !== fb) {
      // Sediment drapes the shell: a clean parting there is as weak as a bedding plane.
      const fos = fa ? a : b;
      return this.sp.matrix.T * Math.max(0.02, 1 - this.partingAt(fos)) * 0.25 + 0.002;
    }
    const ta = this.tough(a), tb = this.tough(b);
    return ta < tb ? ta : tb;
  }

  /**
   * Solid voxels inside f<0 connected to the seeds; abort if the crack would cost more than E.
   * On meeting the shell, the crack follows it (leaving the fossil behind) where the matrix
   * parts cleanly, and cuts through it (taking that bit of fossil) where welded.
   */
  piece(f, seeds, E, maxN = 300000) {
    const v = this.v, st = ++this.stamp, mark = this.mark, stack = this.stack;
    const rock = v.rock, fossil = v.fossil;
    const nb = [1, -1, v.sy, -v.sy, v.sz, -v.sz];
    // Breadth-first, so the crack front grows evenly and an unaffordable one fails early.
    const P = [];
    let sp = 0, head = 0;
    for (const s of seeds) {
      if (mark[s] === st || !this.solid(s) || f(s) >= 0) continue;
      mark[s] = st;
      stack[sp++] = s;
    }
    if (!sp) return (this.lastFail = 'no seeds'), null;
    let cost = 0;
    const deflected = [];
    const NEAR = -LIM + 1e-3;
    while (head < sp) {
      const q = stack[head++];
      P.push(q);
      if (P.length > maxN) return (this.lastFail = 'too big'), null;
      if (this.braced(q)) return (this.lastFail = 'anchored'), null; // reached the base: that's the block, not a piece
      const qFos = fossil[q] > 0;
      for (let t = 0; t < 6; t++) {
        const r = q + nb[t];
        if (mark[r] === st) continue;
        const fr = fossil[r];
        if (rock[r] <= 0 && fr <= 0) continue; // air
        const inside = f(r) < 0;
        if (fr <= NEAR) {
          // Plain rock, far from the shell: the common case.
          if (inside) {
            mark[r] = st;
            stack[sp++] = r;
          } else {
            cost += this.faceT(q, r);
            if (cost > E) return (this.lastFail = 'energy'), null;
          }
          continue;
        }
        const fos = fr > 0;
        // Over the shell the crack follows the parting, usually leaving a thin skin of
        // matrix (thicker where the parting is poorer); where welded it goes through.
        if (inside && !qFos && (fos ? this.partingAt(r) > this.deflect : fr > -this.skin(r))) {
          deflected.push(r);
          cost += fos ? this.faceT(q, r) : this.sp.matrix.T * 0.06;
          if (cost > E) return null;
        } else if (inside) {
          mark[r] = st;
          stack[sp++] = r;
        } else {
          cost += this.faceT(q, r);
          if (cost > E) return null;
        }
      }
    }
    if (cost <= 0) return (this.lastFail = 'nothing cut'), null;
    // Whatever the crack went round (the shell, a skin of matrix) must still be attached to the
    // block outside the piece; if not, it goes with the piece (e.g. the wrong layer was split
    // and the fossil rides off inside the slab).
    if (deflected.length) {
      const st2 = ++this.stamp, mark2 = mark;
      for (let i = 0; i < deflected.length; i++) {
        const d0 = deflected[i];
        if (mark2[d0] === st2 || mark2[d0] === st) continue;
        const comp = [d0];
        mark2[d0] = st2;
        let attached = false;
        for (let h = 0; h < comp.length; h++) {
          const q = comp[h];
          for (let t = 0; t < 6; t++) {
            const r = q + nb[t];
            if (mark2[r] === st2 || mark2[r] === st) continue;
            if (rock[r] <= 0 && fossil[r] <= 0) continue;
            if (f(r) >= 0) { attached = true; continue; }
            mark2[r] = st2;
            comp.push(r);
          }
          if (comp.length > 400000) { attached = true; break; }
        }
        if (!attached) for (const q of comp) { mark[q] = st; P.push(q); }
      }
      // Re-stamp so the caller sees one membership mark for the whole piece.
      for (const q of P) mark[q] = st;
    }
    return { P, cost, stamp: st };
  }

  /**
   * One hammer blow. g: contact (grid coords), d: drive direction (unit, into the rock),
   * e: blade edge direction (unit, across d), head: HEADS key, energy: blow energy.
   * Returns { kind: 'flake'|'split'|'crush', ...} with the piece for debris.
   */
  strike(g, d, e, headId, energy) {
    const v = this.v, sp = this.sp, head = HEADS[headId];
    d = norm(d);
    e = norm(cross(cross(d, e), d)); // make sure the blade is square to the drive
    this._brace(d);
    this.partCache.clear();
    // How good the parting must be for the crack to follow the shell, this blow, and how
    // much matrix it tends to leave on the shell.
    this.deflect = 0.4 + 0.25 * this.rng.next();
    this.skinScale = 0.4 + 2.0 * this.rng.next();
    const idx = (x, y, z) => v.idx(Math.round(x), Math.round(y), Math.round(z));

    // Seeds: the solid under the blade.
    const seeds = new Set();
    const half = head.width / 2;
    for (let s = -half; s <= half + 1e-6; s += 0.7) {
      for (let t = 0; t <= 2.5; t += 0.8) {
        const x = g[0] + e[0] * s + d[0] * t, y = g[1] + e[1] * s + d[1] * t, z = g[2] + e[2] * s + d[2] * t;
        if (x < 1 || y < 1 || z < 1 || x > v.nx - 2 || y > v.ny - 2 || z > v.nz - 2) continue;
        const n = idx(x, y, z);
        if (this.solid(n)) seeds.add(n);
      }
    }
    if (!seeds.size) return { kind: 'miss' };
    const seedArr = [...seeds];
    const pos = (n) => this.ijk(n);
    const NX = v.nx, NY = v.ny, SY = v.sy, SZ = v.sz;

    const cands = [];
    // Cones: axis along the drive, and bent off it toward wherever the rock is thinnest.
    const u1 = norm(Math.abs(d[2]) < 0.9 ? cross(d, [0, 0, 1]) : cross(d, [1, 0, 0]));
    const u2 = cross(d, u1);
    const axes = [d];
    for (const gam of [30 * DEG]) {
      for (let k = 0; k < 6; k++) {
        const ph = (k / 6) * 2 * Math.PI;
        axes.push(norm([
          d[0] * Math.cos(gam) + (u1[0] * Math.cos(ph) + u2[0] * Math.sin(ph)) * Math.sin(gam),
          d[1] * Math.cos(gam) + (u1[1] * Math.cos(ph) + u2[1] * Math.sin(ph)) * Math.sin(gam),
          d[2] * Math.cos(gam) + (u1[2] * Math.cos(ph) + u2[2] * Math.sin(ph)) * Math.sin(gam),
        ]));
      }
    }
    const cb = Math.cos(head.beta * DEG), sb = Math.sin(head.beta * DEG);
    const cone = (a) => {
      const ap = [g[0] - a[0] * 1.2, g[1] - a[1] * 1.2, g[2] - a[2] * 1.2];
      return (n) => {
        const px = (n % NX) - ap[0], py = (((n / SY) | 0) % NY) - ap[1], pz = ((n / SZ) | 0) - ap[2];
        const s = px * a[0] + py * a[1] + pz * a[2];
        const rx = px - a[0] * s, ry = py - a[1] * s, rz = pz - a[2] * s;
        return Math.max(Math.hypot(rx, ry, rz) * cb - s * sb, s - 70);
      };
    };
    for (const a of axes) {
      cands.push({ kind: 'flake', f: cone(a), align: head.pref.cone * (0.55 + 0.45 * dot(a, d) ** 2) });
    }

    // Bedding planes below the contact: piece is everything above, connected to the blow.
    // Each bedding crack runs along the weakest layer of its band (split between k and k+1).
    const beds = sp.beds
      .map((b) => {
        const z = (b - v.origin[2]) / v.voxel;
        let kb = Math.round(z);
        for (const k of [kb - 1, kb + 1]) if (k > 0 && k < v.nz && sp.bedT[k] < sp.bedT[kb]) kb = k;
        return { b, zb: kb + 0.5 };
      })
      .filter(({ zb }) => g[2] - zb >= 0.2 && g[2] - zb <= 45);
    const bladeFlat = headId === 'point' ? 1 : 1 - 0.7 * Math.abs(e[2]);
    for (const { zb } of beds) {
      const f = (n) => zb - Math.floor(n / v.sz);
      // The wedge has to be in the parting: a couple of voxels off and it opens something else.
      const onPlane = Math.exp(-(((g[2] - zb - 1) / 1.6) ** 2));
      cands.push({ kind: 'split', f, align: head.pref.bed * (1 - Math.abs(d[2])) * bladeFlat * onPlane, global: true });
      // A flake whose crack runs into this bedding plane and follows it.
      if (g[2] - zb <= 18) {
        for (const a of axes.slice(0, 4)) {
          const c = cone(a);
          cands.push({ kind: 'flake', f: (n) => Math.max(c(n), f(n)), align: head.pref.cone * (0.6 + 0.4 * dot(a, d) ** 2) + 0.05 });
        }
      }
    }

    // The plane of the blade: a wedge splits along it. Either side may be the piece.
    const m = norm(cross(d, e));
    if (head.width > 1.5) {
      for (const s of [1, -1]) {
        const f = (n) => -s * (((n % NX) - g[0]) * m[0] + ((((n / SY) | 0) % NY) - g[1]) * m[1] + (((n / SZ) | 0) - g[2]) * m[2]) + 0.5;
        cands.push({ kind: 'split', f, align: head.pref.blade, global: true, seedShift: m.map((x) => x * s * 1.5) });
      }
    }

    // Joints near the blow: the crack can run along them.
    const gp = v.pos(g[0], g[1], g[2]);
    for (const jt of sp.joints) {
      const dist = (jt.n[0] * gp[0] + jt.n[1] * gp[1] + jt.n[2] * gp[2] - jt.d) / v.voxel;
      if (Math.abs(dist) > 25) continue;
      const s = Math.sign(dist) || 1;
      const o = v.origin, vx = v.voxel;
      const f = (n) => {
        const x = o[0] + (n % NX) * vx, y = o[1] + (((n / SY) | 0) % NY) * vx, z = o[2] + ((n / SZ) | 0) * vx;
        return (-s * (jt.n[0] * x + jt.n[1] * y + jt.n[2] * z - jt.d)) / vx;
      };
      const along = headId === 'point' ? 0.5 : Math.abs(dot(m, jt.n));
      cands.push({ kind: 'split', f, align: head.pref.joint * (0.4 + 0.6 * along), global: true });
    }

    // Try them, most promising first; keep the best by fit and cost.
    cands.sort((a, b) => b.align - a.align);
    const rough = (c) => (c.global ? this._estimate(c.f) : 0);
    let best = null;
    const t0 = performance.now();
    for (const c of cands) {
      if (performance.now() - t0 > 70 && best) break; // budget: keep the best found so far
      if (best && c.align < best.score - 0.05) continue; // can't win even at zero cost
      if (c.global && rough(c) > energy * 1.6) continue; // a crack that size is out of reach
      let sd = seedArr;
      if (c.seedShift) {
        sd = seedArr.map((n) => {
          const [i, j, k] = pos(n);
          return idx(i + c.seedShift[0], j + c.seedShift[1], k + c.seedShift[2]);
        });
      }
      const r = this.piece(c.f, sd, energy, c.global ? 2500000 : 250000);
      if (!r || r.P.length < 4) continue;
      const score = c.align - 0.55 * (r.cost / energy) + 0.12 * this.rng.next();
      if (!best || score > best.score) best = { ...c, ...r, score };
    }

    const out = { kind: 'crush', energy, g, d };
    if (!best || best.score < 0.22) {
      this._crush(g, d, headId, energy);
      this._damage(g, energy / E_MAX);
      return out;
    }
    out.kind = best.kind;
    out.cost = best.cost;
    const res = this._remove(best);
    Object.assign(out, res);
    this._damage(g, Math.max(0, energy - best.cost) / E_MAX);
    return out;
  }

  /**
   * Rough cost of a global crack: sample the block on a coarse grid, find solid voxel pairs
   * the region boundary separates, and scale up. Cheap enough to rule out hopeless splits.
   */
  _estimate(f) {
    const v = this.v, step = 6;
    let cost = 0;
    const nb = [1, v.sy, v.sz];
    for (let k = 1; k < v.nz - 2; k += step)
      for (let j = 1; j < v.ny - 2; j += step)
        for (let i = 1; i < v.nx - 2; i += step) {
          const n = v.idx(i, j, k);
          if (!this.solid(n)) continue;
          const a = f(n) < 0;
          for (const o of nb) {
            // Look along each axis for a boundary crossing within the step.
            for (let s = 1; s <= step; s++) {
              const r = n + o * s;
              if (!this.solid(r)) break;
              if (f(r) < 0 !== a) {
                // Through the shell the real crack detours along the parting: price it so.
                const q = n + o * (s - 1);
                const fos = this.v.fossil[q] > 0 || this.v.fossil[r] > 0;
                cost += (fos ? this.sp.matrix.T * 0.05 : this.faceT(q, r)) * step * step;
                break;
              }
            }
          }
        }
    return cost;
  }

  /** Cut the chosen piece free: smooth fracture faces on the block, debris field for the piece. */
  _remove(c) {
    const v = this.v, { sy, sz } = v, f = c.f, mark = this.mark;
    // Later candidates reused the visit marks: re-mark the chosen piece.
    const st = ++this.stamp;
    for (const q of c.P) mark[q] = st;
    const nb = [1, -1, sy, -sy, sz, -sz];
    // Fossil in the piece went with it (the crack cut through welded shell).
    const take = c.P;
    let fossilLost = 0;
    const fossilKept = 0;
    const spines = new Set();
    for (const q of take) {
      if (this.isFos(q)) {
        fossilLost++;
        if (v.part[q]) spines.add(v.part[q]);
      }
    }
    if (!take.length) return { size: 0 };

    // Bounding box of the piece.
    let lo = [1e9, 1e9, 1e9], hi = [-1, -1, -1];
    let cx = 0, cy = 0, cz = 0;
    for (const q of take) {
      const [i, j, k] = this.ijk(q);
      if (i < lo[0]) lo[0] = i; if (j < lo[1]) lo[1] = j; if (k < lo[2]) lo[2] = k;
      if (i > hi[0]) hi[0] = i; if (j > hi[1]) hi[1] = j; if (k > hi[2]) hi[2] = k;
      cx += i; cy += j; cz += k;
    }
    const centre = [cx / take.length, cy / take.length, cz / take.length];

    // Debris field: the piece's own surface, bounded by the fracture where it was cut.
    const pad = 2;
    const stride = (hi[0] - lo[0] + 5) * (hi[1] - lo[1] + 5) * (hi[2] - lo[2] + 5) > 3e6 ? 2 : 1;
    const ox = Math.max(0, lo[0] - pad), oy = Math.max(0, lo[1] - pad), oz = Math.max(0, lo[2] - pad);
    const dx = Math.ceil((Math.min(v.nx - 1, hi[0] + pad) - ox) / stride) + 1;
    const dy = Math.ceil((Math.min(v.ny - 1, hi[1] + pad) - oy) / stride) + 1;
    const dz = Math.ceil((Math.min(v.nz - 1, hi[2] + pad) - oz) / stride) + 1;
    const field = new Float32Array(dx * dy * dz).fill(-LIM);
    const fos = new Float32Array(dx * dy * dz);
    for (let k = 0; k < dz; k++)
      for (let j = 0; j < dy; j++)
        for (let i = 0; i < dx; i++) {
          const gi = ox + i * stride, gj = oy + j * stride, gk = oz + k * stride;
          if (gi > v.nx - 1 || gj > v.ny - 1 || gk > v.nz - 1) continue;
          const n = gi + gj * sy + gk * sz;
          const l = i + j * dx + k * dx * dy;
          const fv = f(n);
          if (mark[n] === st) {
            const old = Math.max(v.rock[n], v.fossil[n]);
            field[l] = Math.max(-LIM, Math.min(old / stride, -fv / stride, LIM));
            fos[l] = v.fossil[n] > 0 ? 1 : 0;
          } else {
            field[l] = Math.max(-LIM, Math.min(-0.5, -fv / stride));
          }
        }

    // Now cut it out of the block, leaving a smooth fracture face.
    for (const q of take) {
      const fv = Math.max(-LIM, f(q));
      if (v.rock[q] > fv) v.rock[q] = fv;
      if (v.fossil[q] > 0) v.fossil[q] = Math.min(-0.5, fv); // only shell that went with the piece
    }
    for (const q of take) {
      for (const o of nb) {
        const r = q + o;
        if (mark[r] === st || !this.solid(r) || this.isFos(r)) continue;
        const fv = f(r);
        if (fv >= 0 && v.rock[r] > fv) v.rock[r] = Math.max(fv, 0.02);
      }
    }
    for (const id of spines) {
      const p = this.sp.parts.find((x) => x.id === id);
      if (p && p.alive) {
        p.alive = false;
        for (const q of p.vox) v.fossil[q] = -LIM;
      }
    }

    return {
      size: take.length, fossilKept, fossilLost, spines: [...spines], centre,
      box: [Math.max(1, lo[0] - 2), Math.max(1, lo[1] - 2), Math.max(1, lo[2] - 2), Math.min(v.nx - 2, hi[0] + 2), Math.min(v.ny - 2, hi[1] + 2), Math.min(v.nz - 2, hi[2] + 2)],
      debris: { field, fos, dims: [dx, dy, dz], origin: [ox, oy, oz], stride },
    };
  }

  /** Not enough to break anything out: the blow crushes a small crater under the tip. */
  _crush(g, d, headId, energy) {
    const v = this.v;
    const s = energy / E_MAX;
    const r = (headId === 'point' ? 1.0 : 1.4) + 2.2 * Math.sqrt(s);
    const c = [g[0] + d[0] * r * 0.35, g[1] + d[1] * r * 0.35, g[2] + d[2] * r * 0.35];
    const R = r + 1;
    const box = [Math.max(1, Math.floor(c[0] - R)), Math.max(1, Math.floor(c[1] - R)), Math.max(1, Math.floor(c[2] - R)),
      Math.min(v.nx - 2, Math.ceil(c[0] + R)), Math.min(v.ny - 2, Math.ceil(c[1] + R)), Math.min(v.nz - 2, Math.ceil(c[2] + R))];
    for (let k = box[2]; k <= box[5]; k++)
      for (let j = box[1]; j <= box[4]; j++)
        for (let i = box[0]; i <= box[3]; i++) {
          const n = v.idx(i, j, k);
          const dd = Math.hypot(i - c[0], j - c[1], k - c[2]) - r;
          if (v.rock[n] > dd) v.rock[n] = Math.max(-LIM, dd);
          // A crushing blow on the shell itself bruises it.
          if (v.fossil[n] > dd + 0.6) v.fossil[n] = Math.max(-LIM, dd + 0.6);
        }
    this.crushBox = box;
  }

  /** Microcracks from leftover energy: the next blow nearby breaks more easily. */
  _damage(g, s) {
    if (s <= 0.01) return;
    const v = this.v, R = 3 + 14 * s;
    for (let k = Math.max(1, Math.floor(g[2] - R)); k <= Math.min(v.nz - 2, Math.ceil(g[2] + R)); k++)
      for (let j = Math.max(1, Math.floor(g[1] - R)); j <= Math.min(v.ny - 2, Math.ceil(g[1] + R)); j++)
        for (let i = Math.max(1, Math.floor(g[0] - R)); i <= Math.min(v.nx - 2, Math.ceil(g[0] + R)); i++) {
          const r = Math.hypot(i - g[0], j - g[1], k - g[2]);
          if (r >= R) continue;
          const n = v.idx(i, j, k);
          v.dmg[n] = Math.min(1, v.dmg[n] + 0.45 * s * (1 - r / R));
        }
  }
}
