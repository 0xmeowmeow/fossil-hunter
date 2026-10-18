// A finer mesh for the fossil itself. The rock is simulated and meshed on the coarse grid;
// the shell is re-meshed at `factor` times the resolution, straight from the trilobite's
// analytic SDF in a thin band around its surface, with smooth gradient normals and baked
// cavity shading. Damage from the coarse simulation is carried over per vertex: tool marks
// tint it, lost shell pushes the surface in, and shell that's gone disappears.

import { CHUNK, LIM } from './volume.js';
import { meshGrid } from './mesher.js';

/**
 * src: { origin, voxel, nx, ny, nz, field (coarse fossil density, voxel units, +inside),
 *        fn(x,y,z) -> signed distance in world units (negative inside) }
 * Returns a list of chunk meshes: { key, pos, nrm, ao, idx, nv } in local units.
 */
export function buildFine(src, factor = 3, onlyKeys = null) {
  const { origin, voxel, nx, ny, nz, field, fn } = src;
  const fv = voxel / factor;
  const cx = Math.ceil(nx / CHUNK), cy = Math.ceil(ny / CHUNK), cz = Math.ceil(nz / CHUNK);
  const out = [];
  const M = 1; // fine cells of overlap with neighbours, so there are no cracks
  const S = 8; // sub-block size in coarse cells: only blocks that hold shell surface are meshed
  const steps = [1.5, 3.5, 7].map((s) => s * fv);
  for (let kz = 0; kz < cz; kz++)
    for (let ky = 0; ky < cy; ky++)
      for (let kx = 0; kx < cx; kx++) {
        const key = kx + ky * cx + kz * cx * cy;
        if (onlyKeys && !onlyKeys.has(key)) continue;
        const parts = [];
        for (let bz = kz * CHUNK; bz < Math.min(nz - 1, (kz + 1) * CHUNK); bz += S)
          for (let by = ky * CHUNK; by < Math.min(ny - 1, (ky + 1) * CHUNK); by += S)
            for (let bx = kx * CHUNK; bx < Math.min(nx - 1, (kx + 1) * CHUNK); bx += S) {
              const c0 = [bx, by, bz];
              const c1 = [Math.min(nx - 1, bx + S), Math.min(ny - 1, by + S), Math.min(nz - 1, bz + S)];
              let any = false;
              for (let k = c0[2]; k <= c1[2] && !any; k++)
                for (let j = c0[1]; j <= c1[1] && !any; j++)
                  for (let i = c0[0]; i <= c1[0]; i++) {
                    const f = field[i + j * nx + k * nx * ny];
                    if (f > -1.6 && f < 1.6) { any = true; break; }
                  }
              if (!any) continue;
              const p = fineBlock(c0, c1);
              if (p) parts.push(p);
            }
        if (!parts.length) continue;
        // Merge the sub-blocks of this chunk.
        let nv = 0, ni = 0;
        for (const p of parts) { nv += p.nv; ni += p.idx.length; }
        const pos = new Float32Array(nv * 3), nrm = new Float32Array(nv * 3), ao = new Float32Array(nv), idx = new Uint32Array(ni);
        let ov = 0, oi = 0;
        for (const p of parts) {
          pos.set(p.pos, ov * 3); nrm.set(p.nrm, ov * 3); ao.set(p.ao, ov);
          for (let t = 0; t < p.idx.length; t++) idx[oi + t] = p.idx[t] + ov;
          ov += p.nv; oi += p.idx.length;
        }
        out.push({ key, pos, nrm, ao, idx, nv });
      }
  return out;

  function fineBlock(c0, c1) {
    const lo = [c0[0] * voxel + origin[0] - M * fv, c0[1] * voxel + origin[1] - M * fv, c0[2] * voxel + origin[2] - M * fv];
    const dims = [0, 1, 2].map((a) => Math.round((c1[a] - c0[a]) * factor) + 1 + 2 * M);
    const n = dims[0] * dims[1] * dims[2], sxy = dims[0] * dims[1];
    const fine = new Float32Array(n);
    for (let k = 0; k < dims[2]; k++) {
      const z = lo[2] + k * fv;
      const gk = Math.min(nz - 1, Math.max(0, Math.round((z - origin[2]) / voxel)));
      for (let j = 0; j < dims[1]; j++) {
        const y = lo[1] + j * fv;
        const gj = Math.min(ny - 1, Math.max(0, Math.round((y - origin[1]) / voxel)));
        for (let i = 0; i < dims[0]; i++) {
          const x = lo[0] + i * fv;
          const gi = Math.min(nx - 1, Math.max(0, Math.round((x - origin[0]) / voxel)));
          const cf = field[gi + gj * nx + gk * nx * ny];
          // Far from the surface the coarse sign is enough; near it, ask the real shape.
          fine[i + j * dims[0] + k * sxy] = cf > 2 || cf < -2 ? (cf > 0 ? 4 : -4) : Math.max(-4, Math.min(4, -fn(x, y, z) / fv));
        }
      }
    }
    const data = meshGrid(fine, ZEROS(n), dims, NOCOL, PLAIN);
    if (!data) return null;
    const P = data.pos, N = data.nrm, nv = P.length / 3;
    for (let q = 0; q < nv; q++) {
      P[q * 3] = lo[0] + P[q * 3] * fv;
      P[q * 3 + 1] = lo[1] + P[q * 3 + 1] * fv;
      P[q * 3 + 2] = lo[2] + P[q * 3 + 2] * fv;
    }
    // Snap each vertex onto the true surface (one Newton step on the analytic SDF) and take
    // the exact normal there. The sampled field is only approximate on steep relief, which is
    // what made shells look terraced.
    const h = fv * 0.5;
    for (let q = 0; q < nv; q++) {
      let x = P[q * 3], y = P[q * 3 + 1], z = P[q * 3 + 2];
      const d = fn(x, y, z);
      let gx = fn(x + h, y, z) - fn(x - h, y, z), gy = fn(x, y + h, z) - fn(x, y - h, z), gz = fn(x, y, z + h) - fn(x, y, z - h);
      const g2 = gx * gx + gy * gy + gz * gz;
      if (g2 > 1e-12) {
        const k = (d * 2 * h) / g2; // gradient is (g / 2h); step = d * grad / |grad|^2
        const sx = gx * k, sy = gy * k, sz = gz * k;
        if (sx * sx + sy * sy + sz * sz < fv * fv * 2.25) {
          x -= sx; y -= sy; z -= sz;
          P[q * 3] = x; P[q * 3 + 1] = y; P[q * 3 + 2] = z;
        }
        const gl = Math.sqrt(g2);
        N[q * 3] = gx / gl; N[q * 3 + 1] = gy / gl; N[q * 3 + 2] = gz / gl;
      }
    }
    // Cavity shading: how much of the space just outside the surface is still shell (an SDF
    // ambient-occlusion estimate). Grooves, furrows and eye sockets darken.
    const ao = new Float32Array(nv);
    for (let q = 0; q < nv; q++) {
      const x = P[q * 3], y = P[q * 3 + 1], z = P[q * 3 + 2];
      const a = N[q * 3], b = N[q * 3 + 1], c = N[q * 3 + 2];
      let occ = 0, w = 1;
      for (const d of steps) {
        occ += w * Math.max(0, d - fn(x + a * d, y + b * d, z + c * d)) / d;
        w *= 0.6;
      }
      ao[q] = Math.max(0.35, 1 - 0.55 * occ);
    }
    return { pos: P, nrm: N, ao, idx: data.idx, nv };
  }
}

let zeros = new Float32Array(0);
const ZEROS = (n) => (zeros.length >= n ? zeros : (zeros = new Float32Array(n)));
const NOCOL = (x, y, z, f, o) => { o[0] = o[1] = o[2] = 1; };
const PLAIN = { fossilMat: { gloss: 0, metal: 0 } };

/**
 * Colour + damage for a fine chunk from the coarse simulation. Writes col, rough, metal,
 * grain and displaced positions; returns an index buffer with lost shell removed (or the
 * original when nothing is lost).
 */
export function shadeFine(sp, ch, out) {
  const v = sp.vol, P = ch.pos, N = ch.nrm, nv = ch.nv;
  const mat = sp.fossilMat, tmp = [0, 0, 0];
  const pos = out.pos, col = out.col, rough = out.rough, metal = out.metal, grain = out.grain, opal = out.opal;
  let gone = null;
  for (let q = 0; q < nv; q++) {
    const x = P[q * 3], y = P[q * 3 + 1], z = P[q * 3 + 2];
    const g = v.grid(x, y, z);
    const f0 = v.sample(v.fossil0, g[0], g[1], g[2]);
    const f = v.sample(v.fossil, g[0], g[1], g[2]);
    const frost = v.sample(v.frost, g[0], g[1], g[2]);
    const loss = Math.max(0, f0 - f);
    if (loss > 1.3 || f <= -LIM + 0.5) {
      (gone ??= new Uint8Array(nv))[q] = 1;
    }
    const d = Math.min(loss, 1.3) * v.voxel * 0.85;
    pos[q * 3] = x - N[q * 3] * d;
    pos[q * 3 + 1] = y - N[q * 3 + 1] * d;
    pos[q * 3 + 2] = z - N[q * 3 + 2] * d;
    sp.fossilColour(x, y, z, Math.max(0, frost), tmp);
    const ao = ch.ao[q] * (loss > 0.3 ? 0.8 : 1);
    col[q * 3] = tmp[0] * ao;
    col[q * 3 + 1] = tmp[1] * ao;
    col[q * 3 + 2] = tmp[2] * ao;
    const mk = Math.min(1, Math.max(0, frost) / 255);
    rough[q] = 1 - mat.gloss + mk * mat.gloss * 0.75;
    metal[q] = mat.metal * (1 - 0.75 * mk);
    grain[q] = 0.06 + 0.45 * mk;
    if (opal) opal[q] = sp.opalAt ? sp.opalAt(x, y, z) * (1 - mk) : 0;
  }
  if (!gone) return ch.idx;
  const I = ch.idx, keep = [];
  for (let t = 0; t < I.length; t += 3) {
    if (gone[I[t]] || gone[I[t + 1]] || gone[I[t + 2]]) continue;
    keep.push(I[t], I[t + 1], I[t + 2]);
  }
  return new Uint32Array(keep);
}
