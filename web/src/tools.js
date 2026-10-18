// Tool physics on the voxel fields. All positions are grid coordinates (voxel units).
// Rules follow docs/preparation-survey.md section 8 and docs/design-v2.md:
//   - each tool bites a material according to one rule (scribeBite / abrasiveBite), so the
//     same tool always treats the same material the same way;
//   - the scribe works along its axis: a shallow approach lifts and pops thin matrix, a
//     steep blow into the shell marks it;
//   - near the shell, a blow pops the matrix skin off along a good parting or, where
//     welded, can crack into the shell;
//   - vibration snaps spines in proportion to how little rock still supports them;
//   - after edits, paper-thin flaps and disconnected islands of rock break away.

import { MEDIA, TOOLS, E_MAX } from './data.js';
import { Fracture } from './fracture.js';
import { LIM } from './volume.js';
import { Rng } from './rng.js';

/** How readily a carbide scribe breaks a material of hardness H (0-1). Falls off steeply. */
export function scribeBite(H) {
  return 1.4 * Math.max(0, 1 - H) ** 2 + 0.03;
}

/** How readily an abrasive of hardness Hm cuts a material of hardness H. Zero when softer. */
export function abrasiveBite(Hm, H) {
  return Math.max(0, Hm - H + 0.04);
}

export class Tools {
  constructor(sp) {
    this.sp = sp;
    this.vol = sp.vol;
    this.rng = new Rng(sp.spec.seed * 31 + 5);
    this.blowAcc = 0;
    this.stats = { blows: 0, pops: 0, chips: 0, snaps: 0, fossilHits: 0, seconds: 0 };
    this.removed = 0; // matrix voxels removed (running total)
    this.dirtyBox = null; // region to check for flaps/islands
    this.spawn = []; // local-space points where material broke away (for chips/dust)
    this.fracture = new Fracture(sp, this.rng);
  }

  _grow(i0, j0, k0, i1, j1, k1) {
    const b = this.dirtyBox;
    if (!b) this.dirtyBox = [i0, j0, k0, i1, j1, k1];
    else {
      b[0] = Math.min(b[0], i0); b[1] = Math.min(b[1], j0); b[2] = Math.min(b[2], k0);
      b[3] = Math.max(b[3], i1); b[4] = Math.max(b[4], j1); b[5] = Math.max(b[5], k1);
    }
  }

  _box(g, R) {
    const v = this.vol;
    return [
      Math.max(1, Math.floor(g[0] - R)), Math.max(1, Math.floor(g[1] - R)), Math.max(1, Math.floor(g[2] - R)),
      Math.min(v.nx - 2, Math.ceil(g[0] + R)), Math.min(v.ny - 2, Math.ceil(g[1] + R)), Math.min(v.nz - 2, Math.ceil(g[2] + R)),
    ];
  }

  /** Erode a field with a smooth spherical kernel. Returns the number of voxels that went solid -> empty. */
  _erode(arr, g, R, amount, opts = {}) {
    const v = this.vol;
    const [i0, j0, k0, i1, j1, k1] = this._box(g, R);
    if (i0 > i1 || j0 > j1 || k0 > k1 || amount <= 0) return 0;
    const R2 = R * R;
    let changed = false, crossed = 0;
    for (let k = k0; k <= k1; k++)
      for (let j = j0; j <= j1; j++)
        for (let i = i0; i <= i1; i++) {
          const dx = i - g[0], dy = j - g[1], dz = k - g[2];
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 >= R2) continue;
          const n = v.idx(i, j, k);
          const old = arr[n];
          if (old <= -LIM) continue;
          if (opts.onlyIfDominant === 'rock' && v.rock[n] < v.fossil[n] - 0.5) continue;
          if (opts.protect && this.mind?.placed && this.mind.mask[n]) continue; // inside the mind model
          const w = 1 - d2 / R2;
          const nv = Math.max(-LIM, old - amount * w * w);
          if (nv !== old) {
            arr[n] = nv;
            changed = true;
            if (old > 0 && nv <= 0) crossed++;
          }
        }
    if (changed) {
      this._relax(arr, i0, j0, k0, i1, j1, k1);
      v.touch(i0, j0, k0, i1, j1, k1);
      if (arr === v.rock) this._grow(i0, j0, k0, i1, j1, k1);
    }
    return crossed;
  }

  /**
   * Keep the field distance-like after an edit: no voxel may exceed a neighbour by more
   * than one voxel. Interior values are clamped at +LIM, so without this a voxel freshly
   * next to air can still read +4 and resist erosion four times too long.
   */
  _relax(arr, i0, j0, k0, i1, j1, k1) {
    const v = this.vol, sy = v.sy, sz = v.sz;
    i0 = Math.max(1, i0 - 1); j0 = Math.max(1, j0 - 1); k0 = Math.max(1, k0 - 1);
    i1 = Math.min(v.nx - 2, i1 + 1); j1 = Math.min(v.ny - 2, j1 + 1); k1 = Math.min(v.nz - 2, k1 + 1);
    for (let pass = 0; pass < 2; pass++) {
      const fwd = pass === 0;
      for (let k = fwd ? k0 : k1; fwd ? k <= k1 : k >= k0; k += fwd ? 1 : -1)
        for (let j = fwd ? j0 : j1; fwd ? j <= j1 : j >= j0; j += fwd ? 1 : -1)
          for (let i = fwd ? i0 : i1; fwd ? i <= i1 : i >= i0; i += fwd ? 1 : -1) {
            const n = i + j * sy + k * sz;
            const a = arr[n];
            if (a <= 0) continue;
            let m = arr[n - 1];
            if (arr[n + 1] < m) m = arr[n + 1];
            if (arr[n - sy] < m) m = arr[n - sy];
            if (arr[n + sy] < m) m = arr[n + sy];
            if (arr[n - sz] < m) m = arr[n - sz];
            if (arr[n + sz] < m) m = arr[n + sz];
            // Air counts as just outside the surface: this may soften a solid voxel but must
            // never hollow it out (deep-air values next to a fresh fracture would cascade).
            if (m < -0.5) m = -0.5;
            if (a > m + 1) arr[n] = m + 1;
          }
    }
  }

  /** Surface marks on exposed shell (scribe dings, abrasive frosting). 0-255 per voxel. */
  _mark(g, R, amount) {
    const v = this.vol;
    if (amount <= 0) return;
    const [i0, j0, k0, i1, j1, k1] = this._box(g, R);
    let changed = false;
    for (let k = k0; k <= k1; k++)
      for (let j = j0; j <= j1; j++)
        for (let i = i0; i <= i1; i++) {
          const d2 = (i - g[0]) ** 2 + (j - g[1]) ** 2 + (k - g[2]) ** 2;
          if (d2 > R * R) continue;
          const n = v.idx(i, j, k);
          if (v.fossil[n] < -1.5 || v.fossil[n] > 1.5 || v.rock[n] > 0.3) continue;
          const f = Math.min(255, v.frost[n] + amount * (1 - d2 / (R * R)));
          if (f > v.frost[n]) {
            v.frost[n] = f;
            changed = true;
          }
        }
    if (changed) v.touch(i0, j0, k0, i1, j1, k1);
  }

  /** What the tip is touching, and the outward surface normal there. */
  probe(g) {
    const v = this.vol;
    const f = v.sampleF(g[0], g[1], g[2]);
    if (f < -0.7) return { contact: 'none' };
    const r = v.sample(v.rock, g[0], g[1], g[2]);
    const fo = v.sample(v.fossil, g[0], g[1], g[2]);
    return { contact: fo > -0.7 && fo >= r - 0.3 ? 'fossil' : 'rock', r, fo, n: v.normal(g[0], g[1], g[2]) };
  }

  /**
   * One frame of air scribe. g: tip (grid coords). dir: unit vector along the stylus, into
   * the work. pressure, stroke in 0-1. Returns contact + events for sound, haptics and HUD.
   */
  scribe(toolId, g, dir, pressure, stroke, dt) {
    const tool = TOOLS[toolId], v = this.vol, sp = this.sp;
    const ev = { contact: 'none', pops: 0, chips: 0, snaps: [], removed: 0 };
    const pr = this.probe(g);
    this.stats.seconds += dt;
    if (pr.contact === 'none') return ev;
    ev.contact = pr.contact;
    const { r, fo, n } = pr;
    const onFossil = pr.contact === 'fossil';
    if (this.mind?.placed && !onFossil) {
      const n = v.idx(Math.round(g[0]), Math.round(g[1]), Math.round(g[2]));
      if (this.mind.mask[n]) {
        // You believe this is fossil: a careful operator doesn't drive the scribe in here.
        ev.contact = 'model';
        return ev;
      }
    }

    const e = 0.25 + 0.75 * pressure;
    this.blowAcc += tool.rate * (0.3 + 0.7 * stroke) * dt;
    const blows = Math.floor(this.blowAcc);
    this.blowAcc -= blows;
    if (!blows) return ev;
    this.stats.blows += blows;

    // Steepness: 1 = straight into the surface, 0 = skimming along it.
    const steep = Math.max(0, -(dir[0] * n[0] + dir[1] * n[1] + dir[2] * n[2]));
    const R = tool.radius * (0.75 + 0.4 * e);
    const c = [g[0] + dir[0] * R * 0.5, g[1] + dir[1] * R * 0.5, g[2] + dir[2] * R * 0.5];
    const per = tool.depth / tool.rate; // centre depth per blow, voxels
    ev.removed += this._erode(v.rock, c, R, blows * per * e * scribeBite(sp.matrix.H) * (0.6 + 0.4 * steep), { protect: true });
    if (onFossil || fo > -R * 0.5) {
      // The stylus is on the shell. How much it marks depends on the shell's hardness and
      // on how squarely it hits: skimming barely marks, hammering straight in does.
      const bite = scribeBite(sp.fossilMat.H) * (0.25 + 0.75 * steep * steep);
      this._erode(v.fossil, c, R * 0.7, blows * per * 0.18 * e * bite);
      this._mark(g, R + 1, blows * 12 * e * bite);
      this.stats.fossilHits += blows;
    }

    const P = v.pos(g[0], g[1], g[2]);
    for (let b = 0; b < blows; b++) {
      // Thin matrix over the fossil: pop (good parting) or crack the shell (welded).
      // A low, lifting angle helps it pop; a steep one drives a crack in.
      if (fo > -tool.popDepth && r > -0.5 && !onFossil) {
        const part = sp.parting(P[0], P[1], P[2]);
        const x = this.rng.next();
        if (x < part * 0.45 * e * (1.3 - 0.6 * steep)) {
          ev.removed += this._pop(g, tool.popRadius, tool.popDepth);
          ev.pops++;
          this.stats.pops++;
        } else if (x > 1 - (1 - part) * 0.08 * e * steep * (tool.radius / 1.4)) {
          const d = Math.max(0, -fo);
          const cc = [g[0] + dir[0] * d, g[1] + dir[1] * d, g[2] + dir[2] * d];
          const rc = toolId === 'scribe_large' ? 2.0 : 1.2;
          this._erode(v.fossil, cc, rc, 2.5 * scribeBite(sp.fossilMat.H) + 0.5);
          this._erode(v.rock, cc, rc + 0.5, 3);
          this._mark(cc, rc + 1.5, 120);
          ev.chips++;
          this.stats.chips++;
        }
      }
      for (const id of this._vibrate(tool, g, e)) ev.snaps.push(id);
    }
    this.removed += ev.removed;
    return ev;
  }

  /**
   * One hammer blow on the chisel (see fracture.js). g: contact, d: drive direction,
   * e: blade edge direction, head: HEADS key, energy: blow energy.
   * Returns events plus the fracture result (debris piece, kind of break).
   */
  chiselStrike(g, d, e, head, energy) {
    const v = this.vol;
    const r = this.fracture.strike(g, d, e, head, energy);
    const ev = { contact: r.kind === 'miss' ? 'none' : 'rock', pops: 0, chips: 0, snaps: [...(r.spines ?? [])], removed: r.size ?? 0, strike: r };
    const box = r.box ?? (r.kind === 'crush' ? this.fracture.crushBox : null);
    if (box) {
      this._relax(v.rock, ...box);
      this._relax(v.fossil, ...box);
      v.touch(...box);
      this._grow(...box);
    }
    if (r.kind === 'crush') this.spawn.push(v.pos(g[0], g[1], g[2]));
    if (r.fossilLost) ev.chips = 1;
    this.stats.blows++;
    this.stats.chips += ev.chips;
    for (const id of this._vibrate(TOOLS.chisel, g, Math.min(1, energy / E_MAX))) ev.snaps.push(id);
    this.removed += ev.removed;
    return ev;
  }

  /** Matrix within popRadius that lies within popDepth of the fossil comes away cleanly. */
  _pop(g, R, depth) {
    const v = this.vol;
    const Rr = R * (0.7 + 0.5 * this.rng.next()); // ragged flake outline
    const [i0, j0, k0, i1, j1, k1] = this._box(g, Rr);
    let crossed = 0;
    for (let k = k0; k <= k1; k++)
      for (let j = j0; j <= j1; j++)
        for (let i = i0; i <= i1; i++) {
          const d2 = (i - g[0]) ** 2 + (j - g[1]) ** 2 + (k - g[2]) ** 2;
          if (d2 > Rr * Rr) continue;
          const n = v.idx(i, j, k);
          const fo = v.fossil[n];
          if (fo < -depth - 0.5 || v.rock[n] <= fo) continue;
          if (this.mind?.placed && this.mind.mask[n]) continue;
          if (v.rock[n] > 0) crossed++;
          v.rock[n] = Math.min(v.rock[n], fo - 0.6);
        }
    this._relax(v.rock, i0, j0, k0, i1, j1, k1);
    v.touch(i0, j0, k0, i1, j1, k1);
    this._grow(i0, j0, k0, i1, j1, k1);
    this.spawn.push(v.pos(g[0], g[1], g[2]));
    return crossed;
  }

  /**
   * Rock that can't stand breaks away: paper-thin flaps (a voxel with at most 8 solid
   * neighbours of 26) and islands no longer connected to the rest of the block.
   * Runs over the region edited since the last call. Returns voxels removed.
   */
  cleanup() {
    const b = this.dirtyBox;
    if (!b) return 0;
    this.dirtyBox = null;
    const v = this.vol, { sy, sz } = v;
    const m = 5;
    const i0 = Math.max(1, b[0] - m), j0 = Math.max(1, b[1] - m), k0 = Math.max(1, b[2] - m);
    const i1 = Math.min(v.nx - 2, b[3] + m), j1 = Math.min(v.ny - 2, b[4] + m), k1 = Math.min(v.nz - 2, b[5] + m);
    const solid = (n) => v.rock[n] > 0 || v.fossil[n] > 0;
    let removed = 0;
    const drop = (n, i, j, k) => {
      v.rock[n] = Math.min(v.rock[n], -0.5);
      removed++;
      if (removed % 6 === 1) this.spawn.push(v.pos(i, j, k));
    };

    // Thin flaps and slivers.
    for (let pass = 0; pass < 2; pass++)
      for (let k = k0; k <= k1; k++)
        for (let j = j0; j <= j1; j++)
          for (let i = i0; i <= i1; i++) {
            const n = i + j * sy + k * sz;
            if (v.rock[n] <= 0 || v.fossil[n] > 0) continue;
            if (this.mind?.placed && this.mind.mask[n]) continue; // you said that's fossil: leave it
            let c = 0;
            for (let dz = -1; dz <= 1; dz++)
              for (let dy = -1; dy <= 1; dy++)
                for (let dx = -1; dx <= 1; dx++) if ((dx || dy || dz) && solid(n + dx + dy * sy + dz * sz)) c++;
            if (c <= 8) drop(n, i, j, k);
          }

    // Islands: flood from the solid voxels on the box faces (they connect to the rest).
    const W = i1 - i0 + 1, H = j1 - j0 + 1, D = k1 - k0 + 1;
    const seen = new Uint8Array(W * H * D);
    const stack = [];
    const L = (i, j, k) => i - i0 + (j - j0) * W + (k - k0) * W * H;
    for (let k = k0; k <= k1; k++)
      for (let j = j0; j <= j1; j++)
        for (let i = i0; i <= i1; i++) {
          if (i !== i0 && i !== i1 && j !== j0 && j !== j1 && k !== k0 && k !== k1) continue;
          const n = i + j * sy + k * sz;
          if (solid(n)) {
            seen[L(i, j, k)] = 1;
            stack.push(i, j, k);
          }
        }
    while (stack.length) {
      const k = stack.pop(), j = stack.pop(), i = stack.pop();
      const nb = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
      for (const [dx, dy, dz] of nb) {
        const a = i + dx, bb = j + dy, c = k + dz;
        if (a < i0 || a > i1 || bb < j0 || bb > j1 || c < k0 || c > k1) continue;
        const l = L(a, bb, c);
        if (seen[l]) continue;
        if (!solid(a + bb * sy + c * sz)) continue;
        seen[l] = 1;
        stack.push(a, bb, c);
      }
    }
    for (let k = k0; k <= k1; k++)
      for (let j = j0; j <= j1; j++)
        for (let i = i0; i <= i1; i++) {
          const n = i + j * sy + k * sz;
          if (v.rock[n] > 0 && v.fossil[n] <= 0 && !seen[L(i, j, k)] && !(this.mind?.placed && this.mind.mask[n])) drop(n, i, j, k);
        }
    if (removed) {
      this._relax(v.rock, i0, j0, k0, i1, j1, k1);
      v.touch(i0, j0, k0, i1, j1, k1);
      this.removed += removed;
    }
    return removed;
  }

  /**
   * Rock cut clean off from the specimen falls away. Floods the whole block from the fossil
   * (and anything the mind model claims): solid not reached is loose, however big. Each loose
   * piece comes back as debris for the view. Costs one pass over the grid, so call it when
   * the player pauses, not every frame.
   */
  dropLoose() {
    const v = this.vol, N = v.count, { sy, sz } = v;
    const rock = v.rock, fossil = v.fossil;
    const lab = (this._lab ??= new Int32Array(N));
    lab.fill(0);
    const stack = this.fracture.stack;
    let sp = 0;
    const mask = this.mind?.placed ? this.mind.mask : null;
    for (let n = 0; n < N; n++) if (fossil[n] > 0 || (mask && mask[n] && rock[n] > 0)) { lab[n] = 1; stack[sp++] = n; }
    if (!sp) return [];
    const nb = [1, -1, sy, -sy, sz, -sz];
    const flood = (label) => {
      let size = 0;
      while (sp) {
        const q = stack[--sp];
        size++;
        for (let t = 0; t < 6; t++) {
          const r = q + nb[t];
          if (lab[r] || (rock[r] <= 0 && fossil[r] <= 0)) continue;
          lab[r] = label;
          stack[sp++] = r;
        }
      }
      return size;
    };
    flood(1);
    // Everything else that is still rock is loose: group it into pieces.
    const pieces = [];
    let label = 1;
    for (let n = 0; n < N; n++) {
      if (lab[n] || rock[n] <= 0) continue;
      lab[n] = ++label;
      stack[sp++] = n;
      const P = [];
      // Flood, recording members.
      while (sp) {
        const q = stack[--sp];
        P.push(q);
        for (let t = 0; t < 6; t++) {
          const r = q + nb[t];
          if (lab[r] || rock[r] <= 0) continue;
          lab[r] = label;
          stack[sp++] = r;
        }
      }
      pieces.push(P);
    }
    const out = [];
    for (const P of pieces) out.push(this._detach(P));
    this.removed += pieces.reduce((a, P) => a + P.length, 0);
    return out.filter(Boolean);
  }

  /** Lift a loose piece out of the block: returns { debris, centre, size } for the view. */
  _detach(P) {
    const v = this.vol, { sy, sz } = v, rock = v.rock;
    let lo = [1e9, 1e9, 1e9], hi = [-1, -1, -1], c = [0, 0, 0];
    for (const q of P) {
      const i = q % v.nx, j = ((q / sy) | 0) % v.ny, k = (q / sz) | 0;
      if (i < lo[0]) lo[0] = i; if (j < lo[1]) lo[1] = j; if (k < lo[2]) lo[2] = k;
      if (i > hi[0]) hi[0] = i; if (j > hi[1]) hi[1] = j; if (k > hi[2]) hi[2] = k;
      c[0] += i; c[1] += j; c[2] += k;
    }
    const centre = c.map((x) => x / P.length);
    let debris = null;
    if (P.length >= 40) {
      const pad = 2;
      const stride = (hi[0] - lo[0] + 5) * (hi[1] - lo[1] + 5) * (hi[2] - lo[2] + 5) > 3e6 ? 2 : 1;
      const o = [0, 1, 2].map((a) => Math.max(0, lo[a] - pad));
      const lim = [v.nx - 1, v.ny - 1, v.nz - 1];
      const dims = [0, 1, 2].map((a) => Math.ceil((Math.min(lim[a], hi[a] + pad) - o[a]) / stride) + 1);
      const [dx, dy, dz] = dims;
      const field = new Float32Array(dx * dy * dz).fill(-LIM);
      const fos = new Float32Array(dx * dy * dz);
      const lab = this._lab, me = lab[P[0]];
      for (let k = 0; k < dz; k++)
        for (let j = 0; j < dy; j++)
          for (let i = 0; i < dx; i++) {
            const gi = o[0] + i * stride, gj = o[1] + j * stride, gk = o[2] + k * stride;
            if (gi > lim[0] || gj > lim[1] || gk > lim[2]) continue;
            const n = gi + gj * sy + gk * sz;
            field[i + j * dx + k * dx * dy] = lab[n] === me ? Math.max(-LIM, Math.min(rock[n] / stride, LIM)) : Math.min(-0.5, rock[n] / stride);
          }
      debris = { field, fos, dims, origin: o, stride };
    }
    for (const q of P) rock[q] = -0.5;
    const box = [Math.max(1, lo[0] - 2), Math.max(1, lo[1] - 2), Math.max(1, lo[2] - 2), Math.min(v.nx - 2, hi[0] + 2), Math.min(v.ny - 2, hi[1] + 2), Math.min(v.nz - 2, hi[2] + 2)];
    this._relax(rock, ...box);
    v.touch(...box);
    return { debris, centre, size: P.length };
  }

  /** Vibration from one blow; returns ids of spines that snapped. */
  _vibrate(tool, g, e) {
    const v = this.vol, out = [];
    const tipPart = v.part[v.idx(Math.round(g[0]), Math.round(g[1]), Math.round(g[2]))];
    for (const p of this.sp.parts) {
      if (!p.alive) continue;
      const dist = Math.hypot(p.centre[0] - g[0], p.centre[1] - g[1], p.centre[2] - g[2]) - p.radius;
      if (dist > tool.vibRadius) continue;
      let held = 0;
      for (const q of p.support) if (v.rock[q] > 0) held++;
      const support = p.support.length ? held / p.support.length : 1;
      let prob = tool.vib * e * (1 - Math.max(0, dist) / tool.vibRadius) * (1 - support) ** 3 * p.fragility * 0.02;
      if (tipPart === p.id) prob += 0.04 * tool.vib * e;
      if (this.rng.next() < prob) {
        this._snap(p);
        out.push(p.id);
      }
    }
    return out;
  }

  _snap(p) {
    const v = this.vol;
    p.alive = false;
    this.stats.snaps++;
    let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (const q of p.vox) {
      v.fossil[q] = -LIM;
      const i = q % v.nx, j = Math.floor(q / v.sy) % v.ny, k = Math.floor(q / v.sz);
      lo = [Math.min(lo[0], i), Math.min(lo[1], j), Math.min(lo[2], k)];
      hi = [Math.max(hi[0], i), Math.max(hi[1], j), Math.max(hi[2], k)];
    }
    v.touch(lo[0], lo[1], lo[2], hi[0], hi[1], hi[2]);
  }

  /**
   * One frame of air abrasion. o: nozzle (grid coords), dir: unit spray direction.
   * The powder cuts whatever is softer than it (abrasiveBite) and frosts the shell if the
   * shell is softer too. Nothing else.
   */
  abrade(mediaId, o, dir, pressure, flow, dt) {
    const tool = TOOLS.abrader, media = MEDIA[mediaId], v = this.vol, sp = this.sp;
    const ev = { contact: 'none', pops: 0, chips: 0, snaps: [], removed: 0 };
    this.stats.seconds += dt;
    if (flow <= 0.01 || pressure <= 0.01) return ev;
    const rockBite = abrasiveBite(media.H, sp.matrix.H) * 1.6;
    const fosBite = abrasiveBite(media.H, sp.fossilMat.H);
    const rays = Math.max(4, Math.round(tool.rays * (0.4 + 0.6 * flow)));
    const amount = (tool.depth * dt * pressure * (0.3 + flow)) / rays;
    const spread = 0.07;
    let hitsFossil = 0, hits = 0;
    for (let r = 0; r < rays; r++) {
      const d = [dir[0] + this.rng.normal(0, spread), dir[1] + this.rng.normal(0, spread), dir[2] + this.rng.normal(0, spread)];
      const l = Math.hypot(...d);
      const hit = this._march(o, [d[0] / l, d[1] / l, d[2] / l], 60);
      if (!hit) continue;
      hits++;
      const r0 = v.sample(v.rock, hit[0], hit[1], hit[2]);
      const f0 = v.sample(v.fossil, hit[0], hit[1], hit[2]);
      const spot = tool.spot * (0.8 + 0.4 * pressure);
      // The spray strips any matrix film it reaches, even lying on the shell.
      ev.removed += this._erode(v.rock, hit, spot, amount * rockBite * 1.6, { onlyIfDominant: 'rock', protect: true });
      if (f0 >= r0 - 0.3) {
        hitsFossil++;
        this._erode(v.fossil, hit, spot * 0.8, amount * fosBite * 0.1);
        this._mark(hit, spot + 1, amount * fosBite * 12);
      } else if (f0 > -2.5) {
        this._mark(hit, spot * 1.6, amount * fosBite * 3); // rebound off nearby shell
      }
    }
    if (hits) ev.contact = hitsFossil > hits / 2 ? 'fossil' : 'rock';
    this.removed += ev.removed;
    return ev;
  }

  _march(o, d, maxSteps) {
    const v = this.vol;
    let t = 0, prev = -LIM, prevT = 0;
    for (let s = 0; s < maxSteps; s++) {
      const x = o[0] + d[0] * t, y = o[1] + d[1] * t, z = o[2] + d[2] * t;
      const f = v.sampleF(x, y, z);
      if (f > 0) {
        const u = prevT + ((t - prevT) * (0 - prev)) / (f - prev);
        return [o[0] + d[0] * u, o[1] + d[1] * u, o[2] + d[2] * u];
      }
      prev = f;
      prevT = t;
      t += Math.max(0.4, -f * 0.8);
    }
    return null;
  }

  /**
   * Follow the tool's line of action from the tip through the block until it leaves.
   * Returns segments [{kind: 'rock'|'fossil', a, b}] in grid coords, for the through-rock guide.
   */
  lineOfAction(g, dir, maxLen = 220) {
    const v = this.vol, segs = [];
    let cur = null, outside = 0;
    for (let t = 0; t < maxLen; t += 0.6) {
      const p = [g[0] + dir[0] * t, g[1] + dir[1] * t, g[2] + dir[2] * t];
      const f = v.sample(v.fossil, p[0], p[1], p[2]);
      const r = v.sample(v.rock, p[0], p[1], p[2]);
      let kind = f > 0 ? 'fossil' : r > 0 ? 'rock' : null;
      if (kind === 'rock' && this.mind?.placed) {
        const n = v.idx(Math.round(p[0]), Math.round(p[1]), Math.round(p[2]));
        if (n >= 0 && n < v.count && this.mind.mask[n]) kind = 'model';
      }
      if (kind !== (cur && cur.kind)) {
        if (cur) segs.push(cur);
        cur = kind ? { kind, a: p, b: p } : null;
      } else if (cur) cur.b = p;
      if (!kind && t > 3) {
        if (++outside > 6) break;
      } else outside = 0;
    }
    if (cur) segs.push(cur);
    return segs;
  }
}

/**
 * Fossil integrity 0-1: how much of the shell is intact. Lost shell counts most, surface
 * marks less, snapped spines in between. It multiplies the specimen's value.
 */
export function integrity(sp) {
  const v = sp.vol;
  let lost = 0;
  const shell = sp.shellVox;
  for (let i = 0; i < shell.length; i++) if (v.fossil[shell[i]] <= 0) lost++;
  const lostFrac = shell.length ? lost / shell.length : 0;
  let marks = 0;
  const t = sp.targets;
  for (let i = 0; i < t.length; i++) marks += v.frost[t[i]];
  const markMean = t.length ? marks / t.length / 255 : 0;
  const nSp = sp.parts.length;
  const snapped = sp.parts.filter((p) => !p.alive).length;
  const value = Math.max(0, 1 - 3 * lostFrac - 0.45 * markMean - (nSp ? 0.35 * (snapped / nSp) : 0));
  return { value, lostFrac, markMean, snapped, spines: nSp };
}

/**
 * Exposure as the player sees it: the last 1% of the surface is crevices and the odd grain,
 * tedious rather than skilful, so 99% of the shell bare counts as fully exposed.
 */
export const EXPOSE_FULL = 0.99;
export const exposureOf = (raw) => Math.min(1, raw / EXPOSE_FULL);

/** Grade: exposure x integrity -> value. */
export function grade(sp, stats) {
  const v = sp.vol;
  let exposed = 0;
  for (const q of sp.targets) if (v.rock[q] <= 0) exposed++;
  const exposure = exposureOf(exposed / (sp.targets.length || 1));
  const integ = integrity(sp);
  const value = Math.round(sp.level.value * (sp.valueMul ?? 1) * Math.pow(exposure, 1.5) * integ.value);
  return {
    exposure, integrity: integ.value, lostFrac: integ.lostFrac, markMean: integ.markMean,
    snapped: integ.snapped, spines: integ.spines, value, stats,
  };
}
