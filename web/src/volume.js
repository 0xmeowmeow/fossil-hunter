// The block as voxel fields. Densities are in voxel units, positive inside, clamped to
// +-LIM, so the surface (density 0) can be located to a fraction of a voxel.
//
//   rock    matrix density
//   fossil  fossil density (fossil0 keeps the untouched original for grading)
//   frost   0-255 surface damage on the fossil (abrasion frosting, scribe dings)
//   rock0   the untouched matrix; where rock has dropped well below it the surface is
//           tool-cut (fresh, lighter than the weathered rind)
//   part    0 = rock/body, n = spine n (can snap off)

export const LIM = 4;
export const CHUNK = 32;

export class Volume {
  constructor(lo, hi, voxel) {
    this.voxel = voxel;
    this.origin = lo.slice();
    this.nx = Math.ceil((hi[0] - lo[0]) / voxel) + 1;
    this.ny = Math.ceil((hi[1] - lo[1]) / voxel) + 1;
    this.nz = Math.ceil((hi[2] - lo[2]) / voxel) + 1;
    const n = this.nx * this.ny * this.nz;
    this.sx = 1;
    this.sy = this.nx;
    this.sz = this.nx * this.ny;
    this.rock = new Float32Array(n).fill(-LIM);
    this.fossil = new Float32Array(n).fill(-LIM);
    this.fossil0 = null;
    this.frost = new Float32Array(n);
    this.dmg = new Float32Array(n); // microcracking from earlier blows (0-1); weakens rock
    this.rock0 = null;
    this.part = new Uint8Array(n);
    this.cx = Math.ceil(this.nx / CHUNK);
    this.cy = Math.ceil(this.ny / CHUNK);
    this.cz = Math.ceil(this.nz / CHUNK);
    this.dirty = new Set();
  }

  get count() {
    return this.nx * this.ny * this.nz;
  }

  idx(i, j, k) {
    return i + j * this.sy + k * this.sz;
  }

  pos(i, j, k) {
    return [this.origin[0] + i * this.voxel, this.origin[1] + j * this.voxel, this.origin[2] + k * this.voxel];
  }

  /** Grid coordinates (fractional) of a local-space point. */
  grid(x, y, z) {
    return [(x - this.origin[0]) / this.voxel, (y - this.origin[1]) / this.voxel, (z - this.origin[2]) / this.voxel];
  }

  /** Combined surface field at a voxel. */
  F(n) {
    const r = this.rock[n], f = this.fossil[n];
    return r > f ? r : f;
  }

  /** Trilinear sample of an array at fractional grid coords; outside -> -LIM. */
  sample(arr, gx, gy, gz) {
    const i = Math.floor(gx), j = Math.floor(gy), k = Math.floor(gz);
    if (i < 0 || j < 0 || k < 0 || i >= this.nx - 1 || j >= this.ny - 1 || k >= this.nz - 1) return -LIM;
    const tx = gx - i, ty = gy - j, tz = gz - k;
    const n = this.idx(i, j, k), sy = this.sy, sz = this.sz;
    const a = arr[n] * (1 - tx) + arr[n + 1] * tx;
    const b = arr[n + sy] * (1 - tx) + arr[n + sy + 1] * tx;
    const c = arr[n + sz] * (1 - tx) + arr[n + sz + 1] * tx;
    const d = arr[n + sy + sz] * (1 - tx) + arr[n + sy + sz + 1] * tx;
    return (a * (1 - ty) + b * ty) * (1 - tz) + (c * (1 - ty) + d * ty) * tz;
  }

  /** Trilinear sample of the combined field max(rock, fossil). */
  sampleF(gx, gy, gz) {
    const i = Math.floor(gx), j = Math.floor(gy), k = Math.floor(gz);
    if (i < 0 || j < 0 || k < 0 || i >= this.nx - 1 || j >= this.ny - 1 || k >= this.nz - 1) return -LIM;
    const tx = gx - i, ty = gy - j, tz = gz - k;
    const n = this.idx(i, j, k), sy = this.sy, sz = this.sz;
    const F = (m) => this.F(m);
    const a = F(n) * (1 - tx) + F(n + 1) * tx;
    const b = F(n + sy) * (1 - tx) + F(n + sy + 1) * tx;
    const c = F(n + sz) * (1 - tx) + F(n + sz + 1) * tx;
    const d = F(n + sy + sz) * (1 - tx) + F(n + sy + sz + 1) * tx;
    return (a * (1 - ty) + b * ty) * (1 - tz) + (c * (1 - ty) + d * ty) * tz;
  }

  /** Mark every chunk whose mesh can change when voxels in [i0..i1] change. */
  touch(i0, j0, k0, i1, j1, k1) {
    // A voxel feeds cells on both sides, so widen by one.
    const c = (v, n) => Math.max(0, Math.min(n - 1, Math.floor(v / CHUNK)));
    const a0 = c(i0 - 1, this.cx), a1 = c(i1 + 1, this.cx);
    const b0 = c(j0 - 1, this.cy), b1 = c(j1 + 1, this.cy);
    const d0 = c(k0 - 1, this.cz), d1 = c(k1 + 1, this.cz);
    for (let z = d0; z <= d1; z++) for (let y = b0; y <= b1; y++) for (let x = a0; x <= a1; x++) this.dirty.add(x + y * this.cx + z * this.cx * this.cy);
  }

  /** Ray march the combined field. Ray in local space; returns {t, p, g} or null. */
  raycast(o, d, maxT) {
    const v = this.voxel;
    let t = 0;
    let prev = -LIM, prevT = 0;
    while (t < maxT) {
      const x = o[0] + d[0] * t, y = o[1] + d[1] * t, z = o[2] + d[2] * t;
      const [gx, gy, gz] = this.grid(x, y, z);
      const f = this.sampleF(gx, gy, gz);
      if (f > 0) {
        // Refine between previous and current sample.
        const s = prevT + (t - prevT) * (0 - prev) / (f - prev);
        const p = [o[0] + d[0] * s, o[1] + d[1] * s, o[2] + d[2] * s];
        return { t: s, p, g: this.grid(p[0], p[1], p[2]) };
      }
      prev = f;
      prevT = t;
      // Field is in voxel units and roughly distance-like near the surface.
      t += Math.max(0.35, Math.min(-f, LIM) * 0.8) * v;
    }
    return null;
  }

  /** Outward surface normal (local space) from the field gradient. */
  normal(gx, gy, gz) {
    const h = 0.75;
    const nx = this.sampleF(gx - h, gy, gz) - this.sampleF(gx + h, gy, gz);
    const ny = this.sampleF(gx, gy - h, gz) - this.sampleF(gx, gy + h, gz);
    const nz = this.sampleF(gx, gy, gz - h) - this.sampleF(gx, gy, gz + h);
    const l = Math.hypot(nx, ny, nz) || 1;
    return [nx / l, ny / l, nz / l];
  }
}
