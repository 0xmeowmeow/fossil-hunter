// The shared frame for shell-like fossils: pose (yaw, tilt, roll, flattening), placement,
// tight bounds and resting on a bedding plane. Subclasses give sdf(x, y, z) in body units and
// `box`. Used by shells.js, crinoid.js and leaf.js.

function rotation(p) {
  const cy = Math.cos(p.yaw), sy = Math.sin(p.yaw), ct = Math.cos(p.tilt), st = Math.sin(p.tilt), cr = Math.cos(p.roll), sr = Math.sin(p.roll);
  const Rz = [cy, -sy, 0, sy, cy, 0, 0, 0, 1], Rx = [1, 0, 0, 0, ct, -st, 0, st, ct], Ry = [cr, 0, sr, 0, 1, 0, -sr, 0, cr];
  const m = (A, B) => {
    const C = new Array(9);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) C[r * 3 + c] = A[r * 3] * B[c] + A[r * 3 + 1] * B[3 + c] + A[r * 3 + 2] * B[6 + c];
    return C;
  };
  return m(m(Rz, Rx), Ry);
}

/** Shared pose, placement and bounds; subclasses provide sdf(x,y,z) in body units and `box`. */
export class Fossil {
  constructor(spec, { scale = 1 } = {}) {
    this.spec = spec;
    this.a = spec.anatomy;
    this.scale = scale;
    this.offset = [0, 0, 0];
    this.part = 0;
    this.nParts = 1;
    this.R = rotation(spec.pose);
  }

  field(x, y, z) {
    const k = this.scale, f = this.spec.pose.flatten, R = this.R;
    const qx = (x - this.offset[0]) / k, qy = (y - this.offset[1]) / k, qz = (z - this.offset[2]) / k / f;
    const bx = R[0] * qx + R[3] * qy + R[6] * qz, by = R[1] * qx + R[4] * qy + R[7] * qz, bz = R[2] * qx + R[5] * qy + R[8] * qz;
    return this.sdf(bx, by, bz) * f * k;
  }

  toWorld(x, y, z) {
    const R = this.R, k = this.scale;
    const wx = R[0] * x + R[1] * y + R[2] * z, wy = R[3] * x + R[4] * y + R[5] * z, wz = (R[6] * x + R[7] * y + R[8] * z) * this.spec.pose.flatten;
    return [wx * k + this.offset[0], wy * k + this.offset[1], wz * k + this.offset[2]];
  }

  /** Body-frame material colour override (linear RGB) or null. */
  tintBody() {
    return null;
  }

  tint(x, y, z) {
    const k = this.scale, f = this.spec.pose.flatten, R = this.R;
    const qx = (x - this.offset[0]) / k, qy = (y - this.offset[1]) / k, qz = (z - this.offset[2]) / k / f;
    return this.tintBody(R[0] * qx + R[3] * qy + R[6] * qz, R[1] * qx + R[4] * qy + R[7] * qz, R[2] * qx + R[5] * qy + R[8] * qz) ?? this.spec.colour ?? null;
  }

  /** World bounds from sampled interior points (tight even after rotation). */
  bounds() {
    if (this._b && this._bOff === this.offset.join()) return this._b;
    const [lo, hi] = this.box, N = 22;
    const out = { lo: [Infinity, Infinity, Infinity], hi: [-Infinity, -Infinity, -Infinity] };
    for (let k = 0; k <= N; k++)
      for (let j = 0; j <= N; j++)
        for (let i = 0; i <= N; i++) {
          const x = lo[0] + ((hi[0] - lo[0]) * i) / N, y = lo[1] + ((hi[1] - lo[1]) * j) / N, z = lo[2] + ((hi[2] - lo[2]) * k) / N;
          if (this.sdf(x, y, z) > 0.01) continue;
          const w = this.toWorld(x, y, z);
          for (let a = 0; a < 3; a++) {
            out.lo[a] = Math.min(out.lo[a], w[a]);
            out.hi[a] = Math.max(out.hi[a], w[a]);
          }
        }
    const pad = 0.03 * this.scale;
    for (let a = 0; a < 3; a++) {
      out.lo[a] -= pad;
      out.hi[a] += pad;
    }
    this._b = out;
    this._bOff = this.offset.join();
    return out;
  }

  restOnPlane(z0 = 0) {
    this.offset = [0, 0, 0];
    this._b = null;
    const { lo, hi } = this.bounds();
    this.offset = [-(lo[0] + hi[0]) / 2, -(lo[1] + hi[1]) / 2, z0 - lo[2] - this.spec.pose.sink * this.scale - 0.03 * this.scale];
    this._b = null;
    return this.bounds();
  }
}
