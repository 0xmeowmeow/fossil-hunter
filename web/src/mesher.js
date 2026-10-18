// Surface nets over max(rock, fossil), one chunk at a time.
// One vertex per sign-changing cell, placed at the mean of its edge crossings (so the
// surface sits between grid points and stays smooth). Normals are the field gradient.
// A chunk owns the edges whose lower corner lies inside it, and reads one extra layer of
// cells on its low side, so neighbouring chunks join without seams.

import { CHUNK, LIM } from './volume.js';

const EDGES = [
  [0, 1], [2, 3], [4, 5], [6, 7],
  [0, 2], [1, 3], [4, 6], [5, 7],
  [0, 4], [1, 5], [2, 6], [3, 7],
];

export function meshChunk(sp, cx, cy, cz) {
  const v = sp.vol;
  const { nx, ny, nz, sy, sz } = v;
  const rock = v.rock, fos = v.fossil, rock0 = v.rock0;
  const rockOnly = !!sp.fine;
  const x0 = cx * CHUNK, y0 = cy * CHUNK, z0 = cz * CHUNK;
  const ax = Math.max(0, x0 - 1), ay = Math.max(0, y0 - 1), az = Math.max(0, z0 - 1);
  const bx = Math.min(nx - 2, x0 + CHUNK - 1), by = Math.min(ny - 2, y0 + CHUNK - 1), bz = Math.min(nz - 2, z0 + CHUNK - 1);
  if (bx < ax || by < ay || bz < az) return null;
  const Lx = bx - ax + 1, Ly = by - ay + 1, Lz = bz - az + 1;
  const vmap = new Int32Array(Lx * Ly * Lz).fill(-1);

  const pos = [], nrm = [], col = [], rough = [], metal = [], grain = [], extra = [];
  const cF = new Float32Array(8), cR = new Float32Array(8), cP = new Float32Array(8);
  const off = [0, 1, sy, sy + 1, sz, sz + 1, sy + sz, sy + sz + 1];
  const tmp = [0, 0, 0];
  const vox = v.voxel, o = v.origin;
  const gloss = sp.fossilMat.gloss, fmetal = sp.fossilMat.metal;
  let nv = 0;

  for (let k = az; k <= bz; k++) {
    for (let j = ay; j <= by; j++) {
      for (let i = ax; i <= bx; i++) {
        const n = i + j * sy + k * sz;
        let mask = 0;
        for (let b = 0; b < 8; b++) {
          const m = n + off[b];
          const r = rock[m], f = fos[m];
          cR[b] = r;
          cP[b] = f;
          // With a fine shell mesh, the coarse mesh is rock only (the fossil is a hole in it).
          cF[b] = rockOnly ? (r < -f ? r : -f) : r > f ? r : f;
          if (cF[b] > 0) mask |= 1 << b;
        }
        if (mask === 0 || mask === 255) continue;

        let px = 0, py = 0, pz = 0, cnt = 0;
        for (const [a, b] of EDGES) {
          const fa = cF[a], fb = cF[b];
          if (fa > 0 === fb > 0) continue;
          const t = fa / (fa - fb);
          px += (a & 1) + ((b & 1) - (a & 1)) * t;
          py += ((a >> 1) & 1) + (((b >> 1) & 1) - ((a >> 1) & 1)) * t;
          pz += ((a >> 2) & 1) + (((b >> 2) & 1) - ((a >> 2) & 1)) * t;
          cnt++;
        }
        px /= cnt; py /= cnt; pz /= cnt;

        // Trilinear gradient of F at (px, py, pz) inside the cell.
        const ux = px, uy = py, uz = pz, vx = 1 - px, vy = 1 - py, vz = 1 - pz;
        const gx = (cF[1] - cF[0]) * vy * vz + (cF[3] - cF[2]) * uy * vz + (cF[5] - cF[4]) * vy * uz + (cF[7] - cF[6]) * uy * uz;
        const gy = (cF[2] - cF[0]) * vx * vz + (cF[3] - cF[1]) * ux * vz + (cF[6] - cF[4]) * vx * uz + (cF[7] - cF[5]) * ux * uz;
        const gz = (cF[4] - cF[0]) * vx * vy + (cF[5] - cF[1]) * ux * vy + (cF[6] - cF[2]) * vx * uy + (cF[7] - cF[3]) * ux * uy;
        const gl = Math.hypot(gx, gy, gz) || 1;

        // Fossil vs matrix at the vertex: which field is defining the surface here.
        const w8 = [vx * vy * vz, ux * vy * vz, vx * uy * vz, ux * uy * vz, vx * vy * uz, ux * vy * uz, vx * uy * uz, ux * uy * uz];
        let fr = 0, ff = 0, frost = 0, worked = 0, left = 0;
        const tm = sp.leftMask;
        for (let b = 0; b < 8; b++) {
          fr += cR[b] * w8[b];
          ff += cP[b] * w8[b];
          const m = n + off[b];
          if (v.frost[m] > frost) frost = v.frost[m];
          if (rock0[m] - rock[m] > 0.6) worked = 1;
          if (tm && tm[m] && rock[m] > 0) left = 1; // rock still lying on the shell (see game.setShowLeft)
        }
        const w = rockOnly ? 0 : Math.min(1, Math.max(0, 0.5 + (ff - fr) * 0.7));

        const X = o[0] + (i + px) * vox, Y = o[1] + (j + py) * vox, Z = o[2] + (k + pz) * vox;
        pos.push(X, Y, Z);
        nrm.push(-gx / gl, -gy / gl, -gz / gl);
        sp.rockColour(X, Y, Z, worked, tmp);
        const r0 = tmp[0], r1 = tmp[1], r2 = tmp[2];
        sp.fossilColour(X, Y, Z, frost, tmp);
        col.push(r0 + (tmp[0] - r0) * w, r1 + (tmp[1] - r1) * w, r2 + (tmp[2] - r2) * w);
        // Lustre is what really separates shell from matrix: rock is matte and granular,
        // shell is smooth (and pyrite metallic). Marks dull it.
        const mk = Math.min(1, frost / 255);
        const fRough = 1 - gloss + mk * gloss * 0.75;
        rough.push(0.9 + (fRough - 0.9) * w);
        metal.push(fmetal * (1 - 0.75 * mk) * w);
        grain.push(1 - w * (0.92 - 0.5 * mk));
        // extra.x: original weathered surface (takes ink, labels); extra.y: how close the
        // fossil lies beneath this bit of rock (water shows it through thin matrix).
        const fd = ff > -LIM + 0.01 ? 0 : sp.tri.field(X, Y, Z);
        extra.push(worked ? 0 : 1 - w, (1 - w) * Math.max(0, 1 - fd / 0.045) ** 2, left);
        vmap[i - ax + (j - ay) * Lx + (k - az) * Lx * Ly] = nv++;
      }
    }
  }
  if (nv === 0) return null;

  const idx = [];
  const V = (i, j, k) => vmap[i - ax + (j - ay) * Lx + (k - az) * Lx * Ly];
  const quad = (a, b, c, d, flip) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) idx.push(a, d, c, a, c, b);
    else idx.push(a, b, c, a, c, d);
  };
  const ex = Math.min(nx - 2, x0 + CHUNK - 1), ey = Math.min(ny - 2, y0 + CHUNK - 1), ez = Math.min(nz - 2, z0 + CHUNK - 1);
  for (let k = Math.max(1, z0); k <= ez; k++) {
    for (let j = Math.max(1, y0); j <= ey; j++) {
      for (let i = Math.max(1, x0); i <= ex; i++) {
        const n = i + j * sy + k * sz;
        const F = (m) => (rockOnly ? Math.min(v.rock[m], -v.fossil[m]) : v.F(m));
        const f0 = F(n);
        const in0 = f0 > 0;
        // Edge along +x: cells (i, j-1..j, k-1..k), ordered (u=y, v=z).
        if (F(n + 1) > 0 !== in0) quad(V(i, j - 1, k - 1), V(i, j, k - 1), V(i, j, k), V(i, j - 1, k), !in0);
        // Edge along +y: cells (i-1..i, j, k-1..k), ordered (u=z, v=x).
        if (F(n + sy) > 0 !== in0) quad(V(i - 1, j, k - 1), V(i - 1, j, k), V(i, j, k), V(i, j, k - 1), !in0);
        // Edge along +z: cells (i-1..i, j-1..j, k), ordered (u=x, v=y).
        if (F(n + sz) > 0 !== in0) quad(V(i - 1, j - 1, k), V(i, j - 1, k), V(i, j, k), V(i - 1, j, k), !in0);
      }
    }
  }
  if (!idx.length) return null;
  return {
    pos: new Float32Array(pos), nrm: new Float32Array(nrm), col: new Float32Array(col),
    rough: new Float32Array(rough), metal: new Float32Array(metal), grain: new Float32Array(grain),
    extra: new Float32Array(extra), idx: new Uint32Array(idx),
  };
}

/**
 * Surface nets over a standalone grid (for debris pieces). field: density (positive inside),
 * fos: 1 where the material is fossil. Returns positions in grid units (multiply by the
 * caller's voxel size and add its origin), normals, and per-vertex colour/lustre attributes
 * from colourAt(gx, gy, gz, isFossil, out).
 */
export function meshGrid(field, fos, dims, colourAt, sp) {
  const [nx, ny, nz] = dims;
  const sy = nx, sz = nx * ny;
  const vmap = new Int32Array(nx * ny * nz).fill(-1);
  const pos = [], nrm = [], col = [], rough = [], metal = [], grain = [];
  const off = [0, 1, sy, sy + 1, sz, sz + 1, sy + sz, sy + sz + 1];
  const c = new Float32Array(8);
  const tmp = [0, 0, 0];
  let nv = 0;
  for (let k = 0; k < nz - 1; k++)
    for (let j = 0; j < ny - 1; j++)
      for (let i = 0; i < nx - 1; i++) {
        const n = i + j * sy + k * sz;
        let mask = 0, fw = 0;
        for (let b = 0; b < 8; b++) {
          c[b] = field[n + off[b]];
          if (c[b] > 0) mask |= 1 << b;
          fw += fos[n + off[b]];
        }
        if (mask === 0 || mask === 255) continue;
        let px = 0, py = 0, pz = 0, cnt = 0;
        for (const [a, b] of EDGES) {
          if (c[a] > 0 === c[b] > 0) continue;
          const t = c[a] / (c[a] - c[b]);
          px += (a & 1) + ((b & 1) - (a & 1)) * t;
          py += ((a >> 1) & 1) + (((b >> 1) & 1) - ((a >> 1) & 1)) * t;
          pz += ((a >> 2) & 1) + (((b >> 2) & 1) - ((a >> 2) & 1)) * t;
          cnt++;
        }
        px /= cnt; py /= cnt; pz /= cnt;
        const ux = px, uy = py, uz = pz, vx = 1 - px, vy = 1 - py, vz = 1 - pz;
        const gx = (c[1] - c[0]) * vy * vz + (c[3] - c[2]) * uy * vz + (c[5] - c[4]) * vy * uz + (c[7] - c[6]) * uy * uz;
        const gy = (c[2] - c[0]) * vx * vz + (c[3] - c[1]) * ux * vz + (c[6] - c[4]) * vx * uz + (c[7] - c[5]) * ux * uz;
        const gz = (c[4] - c[0]) * vx * vy + (c[5] - c[1]) * ux * vy + (c[6] - c[2]) * vx * uy + (c[7] - c[3]) * ux * uy;
        const gl = Math.hypot(gx, gy, gz) || 1;
        const X = i + px, Y = j + py, Z = k + pz;
        pos.push(X, Y, Z);
        nrm.push(-gx / gl, -gy / gl, -gz / gl);
        const isF = fw >= 4;
        colourAt(X, Y, Z, isF, tmp);
        col.push(tmp[0], tmp[1], tmp[2]);
        rough.push(isF ? 1 - sp.fossilMat.gloss : 0.9);
        metal.push(isF ? sp.fossilMat.metal : 0);
        grain.push(isF ? 0.08 : 1);
        vmap[n] = nv++;
      }
  if (!nv) return null;
  const idx = [];
  const V = (i, j, k) => (i < 0 || j < 0 || k < 0 ? -1 : vmap[i + j * sy + k * sz]);
  const quad = (a, b, cc, d, flip) => {
    if (a < 0 || b < 0 || cc < 0 || d < 0) return;
    if (flip) idx.push(a, d, cc, a, cc, b);
    else idx.push(a, b, cc, a, cc, d);
  };
  const F = (n) => field[n];
  for (let k = 1; k < nz - 1; k++)
    for (let j = 1; j < ny - 1; j++)
      for (let i = 1; i < nx - 1; i++) {
        const n = i + j * sy + k * sz;
        const in0 = F(n) > 0;
        if (F(n + 1) > 0 !== in0) quad(V(i, j - 1, k - 1), V(i, j, k - 1), V(i, j, k), V(i, j - 1, k), !in0);
        if (F(n + sy) > 0 !== in0) quad(V(i - 1, j, k - 1), V(i - 1, j, k), V(i, j, k), V(i, j, k - 1), !in0);
        if (F(n + sz) > 0 !== in0) quad(V(i - 1, j - 1, k), V(i, j - 1, k), V(i, j, k), V(i - 1, j, k), !in0);
      }
  if (!idx.length) return null;
  return {
    pos: new Float32Array(pos), nrm: new Float32Array(nrm), col: new Float32Array(col),
    rough: new Float32Array(rough), metal: new Float32Array(metal), grain: new Float32Array(grain), idx: new Uint32Array(idx),
  };
}
