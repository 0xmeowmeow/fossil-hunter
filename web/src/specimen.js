// A level's specimen: a seeded trilobite resting on a bedding plane inside a block of
// layered matrix, as voxel fields, plus everything the tools and grading need.

import { FOSSILS, MATRICES } from './data.js';
import { Noise } from './noise.js';
import { Rng } from './rng.js';
import { sampleTrilobite, Trilobite, Assemblage } from './trilobite.js';
import { sampleShell, makeShell } from './shells.js';

// Body length in block units for each kind (a trilobite is ~5 cm at 1.0).
const SIZES = { trilobite: [0.85, 1.05], ammonite: [0.7, 1.0], gastropod: [0.35, 0.6], bivalve: [0.35, 0.6], brachiopod: [0.25, 0.45], shark_tooth: [0.35, 0.75] };
import { LIM, Volume } from './volume.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export function srgbToLinear(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
}

/**
 * The precious opal's character, the way a buyer at the Ridge would size it up:
 *   body tone N1 (black) .. N7 (light), brightness B1 (blazing) .. B5 (dull),
 *   the top colour of its fire (blue, green, orange, red: red needs the largest silica spheres
 *   and is rarest), and the pattern (pinfire .. harlequin). Price is a judgement, so these
 *   multiply into a guide value, not a formula anyone could defend to the dollar.
 * The shader reads the same numbers to draw it (view.js, play-of-colour).
 */
export function gradeOpal(rng) {
  const tone = rng.weighted([1, 2, 3, 4, 5, 6, 7], [10, 16, 20, 20, 14, 11, 9]);
  const bright = rng.weighted([1, 2, 3, 4, 5], [6, 16, 32, 28, 18]);
  const top = rng.weighted(['blue', 'green', 'orange', 'red'], [30, 32, 24, 14]);
  const pattern = rng.weighted(['pinfire', 'broad flash', 'rolling flash', 'flagstone', 'harlequin'], [38, 26, 18, 12, 6]);
  // Bragg peak (nm) at normal incidence for the biggest spheres present; the smallest give blue.
  const lmax = { blue: 490, green: 560, orange: 630, red: 690 }[top] + rng.uniform(-10, 10);
  const lmin = 440 + rng.uniform(-15, 15);
  // Domain size (world units, 1 = 5 cm), how wide an angle each flashes over, how much it rolls.
  const P = {
    pinfire: { scale: 0.014, width: 0.045, roll: 0.15 },
    'broad flash': { scale: 0.09, width: 0.1, roll: 0.25 },
    'rolling flash': { scale: 0.06, width: 0.07, roll: 0.8 },
    flagstone: { scale: 0.035, width: 0.06, roll: 0.2 },
    harlequin: { scale: 0.05, width: 0.045, roll: 0.06 },
  }[pattern];
  const mul =
    [0, 1.45, 1.3, 1.15, 1.0, 0.8, 0.65, 0.55][tone] *
    [0, 1.7, 1.3, 1.0, 0.75, 0.55][bright] *
    { blue: 0.7, green: 1.0, orange: 1.6, red: 2.6 }[top] *
    { pinfire: 0.9, 'broad flash': 1.0, 'rolling flash': 1.2, flagstone: 1.3, harlequin: 2.0 }[pattern];
  return { tone, bright, top, pattern, lmin, lmax, ...P, mul, seed: rng.uniform(0, 100) };
}

export class Specimen {
  /** targetVoxels sets the grid resolution: more voxels = finer detail, more memory and work. */
  constructor(level, { targetVoxels = 2.6e6, seed } = {}) {
    this.level = level;
    const s = { ...level.specimen, seed: seed ?? level.specimen.seed };
    this.matrix = MATRICES[level.matrix];
    this.fossilMat = FOSSILS[level.fossil];
    this.seed = s.seed;
    this.noise = new Noise(s.seed);
    this.partNoise = new Noise(s.seed + 77);
    const rng = new Rng(s.seed + 1000);

    // What's in the block: the headline animal (s.kind, default trilobite); for trilobites,
    // sometimes a second or third of its kind (a moult bed or mass mortality); plus any
    // associates the level lists in s.mix (e.g. brachiopods on a hash plate).
    const kind = s.kind ?? 'trilobite';
    const roll = rng.next();
    const same = s.count ?? (kind === 'trilobite' ? (roll < 0.68 ? 1 : roll < 0.92 ? 2 : 3) : 1);
    const plan = [];
    const spec = (k, seed, i) =>
      k === 'trilobite'
        ? sampleTrilobite(seed, { archetype: s.archetype, pure: i === 0 ? s.pure : rng.next() < 0.5, pose: i === 0 ? (s.pose ?? {}) : {} })
        : sampleShell(seed, k, { pose: i === 0 ? (s.pose ?? {}) : {} });
    const sizeOf = (k) => (s.size?.[k] ?? SIZES[k] ?? [0.85, 1.05]);
    for (let i = 0; i < same; i++) {
      const seed = i === 0 ? s.seed : s.seed * 31 + i * 977;
      const [lo, hi] = sizeOf(kind);
      const scale = i === 0 ? rng.uniform(lo, hi) : rng.uniform(lo * 0.5, hi * 0.9);
      // Now and then a second animal lies on a deeper bedding plane.
      const bed = i > 0 && rng.next() < 0.25 ? -rng.uniform(0.02, 0.04) : 0;
      plan.push({ spec: spec(kind, seed, i), scale, bed });
    }
    for (const [mi, mx] of (s.mix ?? []).entries()) {
      const n = mx.n[0] + rng.int(mx.n[1] - mx.n[0] + 1);
      for (let j = 0; j < n; j++) {
        const [lo, hi] = mx.size ?? sizeOf(mx.kind);
        const sp2 = spec(mx.kind, s.seed * 53 + mi * 101 + j * 7 + 1, plan.length);
        // Associates are ordinary shells: their own colour, not the headline fossil's.
        if (this.fossilMat.kind !== 'calcite') {
          const c = srgbToLinear(FOSSILS.calcite_pale.colour), f = rng.uniform(0.75, 1.1);
          sp2.colour = c.map((v) => v * f);
        }
        plan.push({ spec: sp2, scale: rng.uniform(lo, hi), bed: 0, associate: true });
      }
    }
    // Some animals were broken before burial: a piece is simply missing.
    for (const p of plan) {
      if (rng.next() < (s.partialChance ?? 0.18)) {
        const a = rng.uniform(0, Math.PI * 2);
        p.cut = { dir: [Math.cos(a), Math.sin(a)], at: rng.uniform(0.05, 0.3) };
      }
    }
    this.spec = plan[0].spec;
    this.count = same;
    const place = (minRWorld) => {
      const members = [];
      for (const p of plan) {
        const tri = p.spec.kind === 'trilobite' || !p.spec.kind
          ? new Trilobite(p.spec, { minR: minRWorld / p.scale, scale: p.scale })
          : makeShell(p.spec, { scale: p.scale });
        const fb = tri.restOnPlane(p.bed);
        const m = { tri, lo: fb.lo, hi: fb.hi, p };
        if (p.cut) {
          // A plane through the animal (in its own footprint), keeping most of it.
          const cx = (fb.lo[0] + fb.hi[0]) / 2, cy = (fb.lo[1] + fb.hi[1]) / 2;
          const ext = Math.abs(p.cut.dir[0]) * (fb.hi[0] - fb.lo[0]) / 2 + Math.abs(p.cut.dir[1]) * (fb.hi[1] - fb.lo[1]) / 2;
          m.cut = { n: p.cut.dir, c: [cx, cy], k: ext * (1 - 2 * p.cut.at) };
        }
        members.push(m);
      }
      return members;
    };
    // Lay them out once (positions are kept for the final build).
    let members = place(0.009);
    if (!this._layout) {
      this._layout = [[0, 0]];
      for (let i = 1; i < members.length; i++) {
        let ok = null;
        for (let t = 0; t < 40 && !ok; t++) {
          const a = rng.uniform(0, Math.PI * 2), r = plan[i].associate ? rng.uniform(0.2, 0.75) : rng.uniform(0.35, 0.85);
          const off = [Math.cos(a) * r, Math.sin(a) * r];
          const m = members[i];
          const lo = [m.lo[0] + off[0] - 0.03, m.lo[1] + off[1] - 0.03], hi = [m.hi[0] + off[0] + 0.03, m.hi[1] + off[1] + 0.03];
          const clash = members.slice(0, i).some((o, j) => {
            const oo = this._layout[j];
            return !(hi[0] < o.lo[0] + oo[0] || lo[0] > o.hi[0] + oo[0] || hi[1] < o.lo[1] + oo[1] || lo[1] > o.hi[1] + oo[1]);
          });
          if (!clash) ok = off;
        }
        this._layout.push(ok ?? [0, 0]);
        if (!ok) plan[i].drop = true;
      }
    }
    const apply = (ms) => {
      const kept = [];
      ms.forEach((m, i) => {
        if (plan[i].drop) return;
        const [dx, dy] = this._layout[i];
        m.tri.offset[0] += dx;
        m.tri.offset[1] += dy;
        m.tri._b = null;
        if (m.cut) m.cut.c = [m.cut.c[0] + dx, m.cut.c[1] + dy];
        m.lo = [m.lo[0] + dx, m.lo[1] + dy, m.lo[2]];
        m.hi = [m.hi[0] + dx, m.hi[1] + dy, m.hi[2]];
        kept.push(m);
      });
      return kept;
    };
    members = apply(members);
    this.count = members.filter((m) => !m.p.associate).length;
    let asm = new Assemblage(members);
    let fb = asm.bounds(true);
    // The block: varied size and proportions; the find often sits off-centre, near an edge.
    const m = [0, 1, 2, 3].map(() => (rng.next() < 0.3 ? rng.uniform(0.1, 0.16) : rng.uniform(0.18, 0.42)));
    this.bLo = [fb.lo[0] - m[0], fb.lo[1] - m[1], -rng.uniform(0.1, 0.22)];
    // Bury the shells, not the spines: a tall spine may poke out of the top, as found in the field.
    const shellTop = asm.bounds(false).hi[2];
    // `peek`: a thin cover, worn through over the crest of the shell so a glint of it shows.
    this.peek = s.peek ?? 0;
    const cover = this.peek ? 0.025 : rng.uniform(0.03, 0.09);
    this.bHi = [fb.hi[0] + m[2], fb.hi[1] + m[3], Math.max(shellTop, 0) + cover];
    const margin = 0.03;
    const size = [0, 1, 2].map((i) => this.bHi[i] - this.bLo[i] + 2 * margin);
    const voxel = Math.cbrt((size[0] * size[1] * size[2]) / targetVoxels);
    // Final build: keep spines at least ~1.3 voxels thick so they survive meshing.
    asm = new Assemblage(apply(place(1.3 * voxel)));
    fb = asm.bounds(true);
    this.tri = asm;
    this.fLo = fb.lo;
    this.fHi = fb.hi;
    this.z0 = 0;
    this.fossilBeds = [...new Set(plan.filter((p) => !p.drop).map((p) => p.bed))];
    this.members = asm.members;
    // Opalised specimens: a random share of the shell turned to precious opal, in patches.
    if (s.opal) {
      this.opalFrac = rng.uniform(0.12, 0.8);
      this.opalNoise = new Noise(s.seed + 4242);
      this.opal = gradeOpal(new Rng(s.seed * 13 + 4243));
      this.valueMul = (0.45 + 1.4 * this.opalFrac) * this.opal.mul;
    }
    // How much of each partial animal is actually there (sampled).
    for (const m of asm.members) m.complete = m.cut ? this._completeness(m) : 1;
    this.completeness = asm.members[0].complete;

    const lo = this.bLo.map((v) => v - margin), hi = this.bHi.map((v) => v + margin);
    this.vol = new Volume(lo, hi, voxel);

    this._chips(rng);
    this._fillRock();
    this._fillFossil();
    this._strata(rng);
    this._joints(rng);
    this._parts();
    this._targets();
    this._shell();
  }

  _chips(rng) {
    const c = [0, 1, 2].map((i) => (this.bLo[i] + this.bHi[i]) / 2);
    const half = [0, 1, 2].map((i) => (this.bHi[i] - this.bLo[i]) / 2);
    this.bc = c;
    this.bHalf = half;
    this.chips = [];
    const n = 2 + rng.int(3);
    for (let i = 0; i < n; i++) {
      const v = [
        (rng.next() < 0.5 ? -1 : 1) + rng.normal(0, 0.3),
        (rng.next() < 0.5 ? -1 : 1) + rng.normal(0, 0.3),
        (rng.next() < 0.5 ? -1 : 1) * rng.uniform(0.3, 1.2) + rng.normal(0, 0.3),
      ];
      const l = Math.hypot(...v);
      const nrm = v.map((x) => x / l);
      const ext = Math.abs(nrm[0]) * half[0] + Math.abs(nrm[1]) * half[1] + Math.abs(nrm[2]) * half[2];
      this.chips.push([nrm, ext - rng.uniform(0.03, 0.09)]);
    }
    this._shape(rng);
  }

  /**
   * The block as it comes out of the field: bedding surfaces top and bottom (gently wavy),
   * sides broken along a ring of fracture faces at odd angles, each a shallow conchoidal
   * scallop, a few knocked-off corners, and fine lamination ridges on fissile rock.
   */
  _shape(rng) {
    const c = this.bc, fx = (this.fLo[0] + this.fHi[0]) / 2, fy = (this.fLo[1] + this.fHi[1]) / 2;
    const hx = (this.fHi[0] - this.fLo[0]) / 2, hy = (this.fHi[1] - this.fLo[1]) / 2;
    this.faces = [];
    const n = 6 + rng.int(4);
    const a0 = rng.uniform(0, Math.PI * 2);
    for (let i = 0; i < n; i++) {
      const a = a0 + (i / n) * Math.PI * 2 + rng.normal(0, 0.18);
      const tilt = rng.normal(0, 0.28); // sides are seldom vertical
      const nn = [Math.cos(a) * Math.cos(tilt), Math.sin(a) * Math.cos(tilt), Math.sin(tilt)];
      const ext = Math.abs(nn[0]) * hx + Math.abs(nn[1]) * hy;
      const k = nn[0] * fx + nn[1] * fy + ext + rng.uniform(0.1, 0.16);
      // Conchoidal scallop: the face bulges or dishes slightly around a random centre.
      this.faces.push({ n: nn, k, bulge: rng.uniform(-1.4, 1.4), cx: rng.uniform(-0.1, 0.1), cz: rng.uniform(-0.05, 0.05) });
    }
    this.topWave = rng.uniform(0.006, 0.014);
    if (this.peek) this._peekHollow();
    this.lam = this.matrix.fiss < 0.1 ? 0.0018 : this.matrix.fiss < 0.2 ? 0.001 : 0;
  }

  /**
   * A weathered hollow in the top of the block, just deep enough to bare the highest point of
   * the shell (as a find shows when the miner's pick or the rain has worn the dirt off it).
   */
  _peekHollow() {
    const f = this.tri, lo = this.fLo, hi = this.fHi, n = 40, dz = 0.002;
    let best = null;
    for (let j = 0; j <= n; j++) {
      const y = lo[1] + ((hi[1] - lo[1]) * j) / n;
      for (let i = 0; i <= n; i++) {
        const x = lo[0] + ((hi[0] - lo[0]) * i) / n;
        for (let z = hi[2]; z > (best ? best[2] : lo[2]); z -= dz) {
          if (f.field(x, y, z) < 0) { best = [x, y, z]; break; }
        }
      }
    }
    if (!best) return;
    // A flattened, elongated, ragged scuff rather than a neat crater.
    const R = 0.22, flat = 1.6, a = this.noise.noise(best[0] * 7, best[1] * 7, 11) * Math.PI;
    this.peekAt = best;
    this.hollow = { c: [best[0], best[1], best[2] - this.peek + R / flat], R, flat, u: [Math.cos(a), Math.sin(a)] };
  }

  /** Matrix SDF (world units). */
  rockSDF(x, y, z) {
    const c = this.bc, h = this.bHalf;
    const w = this.topWave;
    // Bedding surfaces: the slab is bounded above and below by (wavy) bedding planes.
    let d = Math.max(z - (c[2] + h[2] - 0.01 + w * this.noise.noise(x * 4.5, y * 4.5, 1.7)), (c[2] - h[2] + 0.01 + w * this.noise.noise(x * 4.5 + 9, y * 4.5, 3.1)) - z);
    for (const f of this.faces) {
      const px = x - c[0], py = y - c[1], pz = z - c[2];
      let s = f.n[0] * x + f.n[1] * y + f.n[2] * z - f.k;
      // Distance along the face from its scallop centre -> shallow dish or dome.
      const tx = -f.n[1], ty = f.n[0];
      const u = px * tx + py * ty - f.cx, vv = pz - f.cz;
      s -= f.bulge * 0.06 * Math.max(0, 1 - (u * u + vv * vv * 4) / 0.36) * 0.25;
      d = Math.max(d, s);
    }
    if (this.hollow) {
      const { c: hc, R, flat, u } = this.hollow;
      const dx = x - hc[0], dy = y - hc[1];
      const along = dx * u[0] + dy * u[1], across = (dy * u[0] - dx * u[1]) * 1.45;
      const rag = 0.018 * this.noise.fbm(x, y, z, 16, 2);
      d = Math.max(d, R - Math.hypot(along, across, (z - hc[2]) * flat) + rag);
    }
    // Rough-broken surfaces and a slightly rounded, weathered edge.
    d += 0.009 * this.noise.fbm(x, y, z, 6.0, 3);
    if (this.lam) d += this.lam * Math.sin((z / 0.011) * Math.PI * 2 + 2 * this.noise.noise(x * 3, y * 3, 0));
    for (const [nrm, k] of this.chips) d = Math.max(d, nrm[0] * (x - c[0]) + nrm[1] * (y - c[1]) + nrm[2] * (z - c[2]) - k);
    // Never past the block's bounds (the simulation grid ends just beyond them).
    return Math.max(d, Math.abs(x - c[0]) - h[0], Math.abs(y - c[1]) - h[1], Math.abs(z - c[2]) - h[2]);
  }

  _fillRock() {
    const v = this.vol, vx = v.voxel;
    for (let k = 0; k < v.nz; k++) {
      const z = v.origin[2] + k * vx;
      for (let j = 0; j < v.ny; j++) {
        const y = v.origin[1] + j * vx;
        let n = v.idx(0, j, k);
        for (let i = 0; i < v.nx; i++, n++) {
          const x = v.origin[0] + i * vx;
          v.rock[n] = clamp(-this.rockSDF(x, y, z) / vx, -LIM, LIM);
        }
      }
    }
    this._closeBorder(v.rock);
    v.rock0 = v.rock.slice();
  }

  _fillFossil() {
    const v = this.vol, vx = v.voxel, t = this.tri;
    const pad = 0.03;
    const [i0, j0, k0] = v.grid(this.fLo[0] - pad, this.fLo[1] - pad, this.fLo[2] - pad).map((g) => Math.max(0, Math.floor(g)));
    const g1 = v.grid(this.fHi[0] + pad, this.fHi[1] + pad, this.fHi[2] + pad);
    const i1 = Math.min(v.nx - 1, Math.ceil(g1[0])), j1 = Math.min(v.ny - 1, Math.ceil(g1[1])), k1 = Math.min(v.nz - 1, Math.ceil(g1[2]));
    for (let k = k0; k <= k1; k++) {
      const z = v.origin[2] + k * vx;
      for (let j = j0; j <= j1; j++) {
        const y = v.origin[1] + j * vx;
        for (let i = i0; i <= i1; i++) {
          const x = v.origin[0] + i * vx;
          const d = t.field(x, y, z);
          const n = v.idx(i, j, k);
          v.fossil[n] = clamp(-d / vx, -LIM, LIM);
          if (d < 1.5 * vx) v.part[n] = t.part;
        }
      }
    }
    this._closeBorder(v.fossil);
    v.fossil0 = v.fossil.slice();
  }

  _closeBorder(arr) {
    const v = this.vol;
    for (let k = 0; k < v.nz; k++)
      for (let j = 0; j < v.ny; j++)
        for (let i = 0; i < v.nx; i++)
          if (i === 0 || j === 0 || k === 0 || i === v.nx - 1 || j === v.ny - 1 || k === v.nz - 1) arr[v.idx(i, j, k)] = -LIM;
  }

  _strata(rng) {
    const beds = [this.z0];
    let z = this.z0;
    while (z > this.bLo[2] - 0.05) beds.push((z -= rng.uniform(0.02, 0.09)));
    z = this.z0;
    while (z < this.bHi[2] + 0.05) beds.push((z += rng.uniform(0.02, 0.09)));
    for (const b of this.fossilBeds ?? []) if (b !== this.z0) beds.push(b);
    this.beds = beds.sort((a, b) => a - b);
    const pal = this.matrix.colours.map(srgbToLinear);
    this.bedCols = this.beds.map(() => {
      const c = pal[rng.int(pal.length)], f = rng.uniform(0.9, 1.1);
      return c.map((x) => x * f);
    });
    this.bedCols.push(pal[0]);
    this.fossilCol = srgbToLinear(this.fossilMat.colour);
  }

  /**
   * Pre-existing joints: a few near-vertical planes of weakness through the block. They show
   * as faint dark lines on the rock, and cracks like to run along them.
   */
  _joints(rng) {
    this.joints = [];
    const n = rng.int(3) + (this.matrix.T > 0.4 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const a = rng.uniform(0, Math.PI);
      const nrm = [Math.cos(a), Math.sin(a), rng.normal(0, 0.12)];
      const l = Math.hypot(...nrm);
      const nn = nrm.map((x) => x / l);
      // Keep them off the fossil's middle so they're a hazard and a help, not a guillotine.
      const side = rng.next() < 0.5 ? -1 : 1;
      const d = nn[0] * this.bc[0] + nn[1] * this.bc[1] + side * rng.uniform(0.25, 0.6);
      this.joints.push({ n: nn, d, weak: rng.uniform(0.2, 0.4) });
    }
    // Per-layer toughness factor along z (grid k): bedding planes are weak, the fossil's
    // bedding plane (z0) weakest of all.
    const v = this.vol, fiss = this.matrix.fiss;
    this.bedT = new Float32Array(v.nz);
    for (let k = 0; k < v.nz; k++) {
      const z = v.origin[2] + k * v.voxel;
      let f = 1;
      for (const b of this.beds) {
        const w = Math.exp(-(((z - b) / (1.0 * v.voxel)) ** 2));
        f = Math.min(f, 1 - (1 - fiss) * w);
      }
      this.bedT[k] = f;
    }
    // Each bedding plane is fully weak on its nearest layer (whatever the grid alignment).
    for (const b of this.beds) {
      const k = Math.round((b - v.origin[2]) / v.voxel);
      if (k >= 0 && k < v.nz) this.bedT[k] = Math.min(this.bedT[k], fiss);
    }
  }

  /** Toughness of a rock voxel (grid coords), including bedding, joints and damage. */
  rockT(n, i, j, k) {
    const v = this.vol;
    let t = this.matrix.T * this.bedT[k];
    if (this.joints.length) {
      const x = v.origin[0] + i * v.voxel, y = v.origin[1] + j * v.voxel, z = v.origin[2] + k * v.voxel;
      for (const jt of this.joints) {
        const d = Math.abs(jt.n[0] * x + jt.n[1] * y + jt.n[2] * z - jt.d) / v.voxel;
        if (d < 1) t *= 1 - (1 - jt.weak) * (1 - d);
      }
    }
    // A little grain-scale scatter, so no two blows behave quite alike.
    const h = Math.imul(n, 2654435761) >>> 0;
    return t * (1 - 0.6 * v.dmg[n]) * (0.85 + 0.3 * (h / 4294967296));
  }

  /** Spines: voxel lists, the rock voxels that support them, and a centre for vibration range. */
  _parts() {
    const v = this.vol;
    const n = this.tri.nParts;
    this.parts = [];
    const lists = Array.from({ length: n }, () => []);
    for (let q = 0; q < v.count; q++) {
      const p = v.part[q];
      if (p && v.fossil[q] > -1) lists[p].push(q);
    }
    for (let id = 1; id < n; id++) {
      const vox = lists[id];
      if (!vox.length) continue;
      const support = new Set();
      let cx = 0, cy = 0, cz = 0;
      for (const q of vox) {
        const i = q % v.nx, j = Math.floor(q / v.sy) % v.ny, k = Math.floor(q / v.sz);
        cx += i; cy += j; cz += k;
        for (let dz = -2; dz <= 2; dz++)
          for (let dy = -2; dy <= 2; dy++)
            for (let dx = -2; dx <= 2; dx++) {
              const ii = i + dx, jj = j + dy, kk = k + dz;
              if (ii < 1 || jj < 1 || kk < 1 || ii >= v.nx - 1 || jj >= v.ny - 1 || kk >= v.nz - 1) continue;
              const m = v.idx(ii, jj, kk);
              if (v.fossil[m] <= 0 && v.rock[m] > 0) support.add(m);
            }
      }
      const c = [cx / vox.length, cy / vox.length, cz / vox.length];
      let r = 0;
      for (const q of vox) {
        const i = q % v.nx, j = Math.floor(q / v.sy) % v.ny, k = Math.floor(q / v.sz);
        r = Math.max(r, Math.hypot(i - c[0], j - c[1], k - c[2]));
      }
      this.parts.push({ id, vox, support: [...support], centre: c, radius: r, alive: true, fragility: Math.min(2, 1 + vox.length / 4000) });
    }
  }

  /**
   * The upper surface of the fossil above the bedding plane: what the player is trying to
   * expose. Each target is the voxel just outside the shell, and only counts if no shell lies
   * above it (undersides of a tilted rim would need undercutting, which we don't ask for).
   */
  _targets() {
    const v = this.vol;
    const kz = Math.ceil((this.z0 - v.origin[2]) / v.voxel) + 1;
    const t = [];
    const nb = [1, -1, v.sy, -v.sy, v.sz, -v.sz];
    for (let k = kz; k < v.nz - 1; k++)
      for (let j = 1; j < v.ny - 1; j++)
        for (let i = 1; i < v.nx - 1; i++) {
          const q = v.idx(i, j, k);
          if (v.fossil[q] <= 0) continue;
          for (const o of nb) {
            const m = q + o;
            if (v.fossil[m] > 0) continue;
            let covered = false;
            for (let u = m + v.sz; u < v.count; u += v.sz) if (v.fossil[u] > 0) { covered = true; break; }
            if (!covered) {
              t.push(m); // just outside the shell: exposed when it holds no rock
              break;
            }
          }
        }
    this.targets = Int32Array.from(t);
    this.targetMask = new Uint8Array(v.count);
    for (const q of t) this.targetMask[q] = 1;
    // Which animal each target belongs to (for "there's another one!").
    this.targetOwner = new Uint8Array(t.length);
    if (this.count > 1) {
      for (let i = 0; i < t.length; i++) {
        const [x, y, z] = v.pos(t[i] % v.nx, Math.floor(t[i] / v.sy) % v.ny, Math.floor(t[i] / v.sz));
        this.tri.field(x, y, z);
        this.targetOwner[i] = this.tri.which;
      }
    }
  }

  /** Shell voxels (spines excluded) for the integrity measure. */
  _shell() {
    const v = this.vol, out = [];
    for (let n = 0; n < v.count; n++) if (v.fossil0[n] > 0.5 && !v.part[n]) out.push(n);
    this.shellVox = Int32Array.from(out);
    this.markedCol = srgbToLinear(this.fossilMat.marked);
  }

  _completeness(m) {
    const rng = new Rng(7), t = m.tri;
    let all = 0, kept = 0;
    for (let i = 0; i < 6000; i++) {
      const x = m.lo[0] + rng.next() * (m.hi[0] - m.lo[0]), y = m.lo[1] + rng.next() * (m.hi[1] - m.lo[1]), z = m.lo[2] + rng.next() * (m.hi[2] - m.lo[2]);
      if (t.field(x, y, z) >= 0) continue;
      all++;
      if ((x - m.cut.c[0]) * m.cut.n[0] + (y - m.cut.c[1]) * m.cut.n[1] < m.cut.k) kept++;
    }
    return all ? kept / all : 1;
  }

  /** 0..1: how much precious opal (play-of-colour) there is at this point of the shell. */
  opalAt(x, y, z) {
    if (!this.opalNoise) return 0;
    let n = 0.5 + 0.5 * this.opalNoise.fbm(x, y, z, 3.5, 3);
    // The bit showing through the dirt is the bit that flashed colour at the miner.
    if (this.peekAt) n += 0.6 * Math.max(0, 1 - Math.hypot(x - this.peekAt[0], y - this.peekAt[1], z - this.peekAt[2]) / 0.06);
    const t = 1 - this.opalFrac; // threshold: higher fraction -> more of the shell passes
    return Math.max(0, Math.min(1, (n - t + 0.06) / 0.12));
  }

  /** How cleanly matrix parts from the fossil here (0 welded .. 1 pops off). */
  parting(x, y, z) {
    const p = this.level.parting;
    return clamp(p.base + p.vary * 1.6 * this.partNoise.fbm(x, y, z, p.freq, 2), 0, 1);
  }

  /** Matrix colour (linear RGB) at a point: bedded strata, grain, the parting film. */
  rockColour(x, y, z, worked, out) {
    const tz = z + 0.01 * this.noise.fbm(x, y, z, 5, 2);
    let lo = 0, hi = this.beds.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.beds[mid] < tz) lo = mid + 1;
      else hi = mid;
    }
    const c = this.bedCols[lo];
    const grain = 1 + 0.1 * this.noise.noise(x * 90, y * 90, z * 90);
    const parting = 1 - 0.4 * Math.exp(-(((tz - this.z0) / 0.004) ** 2));
    // Joints show as faint dark hairlines: a clue to where the rock wants to break.
    let joint = 1;
    for (const jt of this.joints ?? []) {
      const d = Math.abs(jt.n[0] * x + jt.n[1] * y + jt.n[2] * z - jt.d);
      if (d < 0.004) joint = Math.min(joint, 0.55 + 0.45 * (d / 0.004));
    }
    // Weathered outer rind is darker and warmer; tool-cut surfaces are fresh.
    const f = grain * parting * joint;
    if (worked) {
      out[0] = c[0] * f * 1.12; out[1] = c[1] * f * 1.12; out[2] = c[2] * f * 1.12;
    } else {
      out[0] = c[0] * f * 0.86; out[1] = c[1] * f * 0.8; out[2] = c[2] * f * 0.72;
    }
  }

  /** Shell colour; tool marks shift it toward the material's own damaged look. */
  fossilColour(x, y, z, frost, out) {
    const m = this.markedCol;
    const c = this.tri.tint?.(x, y, z) ?? this.fossilCol;
    const g = 1 + 0.18 * this.noise.fbm(x, y, z, 30, 2);
    const fr = Math.min(1, frost / 255);
    for (let i = 0; i < 3; i++) out[i] = c[i] * g * (1 - fr) + m[i] * fr;
  }
}
