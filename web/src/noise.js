// Smooth 3D value noise and fBm, seeded. Range of noise() is roughly [-1, 1].

import { hash3 } from './rng.js';

function smooth(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

export class Noise {
  constructor(seed) {
    this.seed = seed | 0;
  }

  noise(x, y, z) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const fx = smooth(x - xi), fy = smooth(y - yi), fz = smooth(z - zi);
    const s = this.seed;
    const c000 = hash3(xi, yi, zi, s), c100 = hash3(xi + 1, yi, zi, s);
    const c010 = hash3(xi, yi + 1, zi, s), c110 = hash3(xi + 1, yi + 1, zi, s);
    const c001 = hash3(xi, yi, zi + 1, s), c101 = hash3(xi + 1, yi, zi + 1, s);
    const c011 = hash3(xi, yi + 1, zi + 1, s), c111 = hash3(xi + 1, yi + 1, zi + 1, s);
    const x00 = c000 + (c100 - c000) * fx, x10 = c010 + (c110 - c010) * fx;
    const x01 = c001 + (c101 - c001) * fx, x11 = c011 + (c111 - c011) * fx;
    const y0 = x00 + (x10 - x00) * fy, y1 = x01 + (x11 - x01) * fy;
    return (y0 + (y1 - y0) * fz) * 2 - 1;
  }

  fbm(x, y, z, freq = 1, octaves = 3, gain = 0.5) {
    let total = 0, amp = 1, norm = 0;
    for (let o = 0; o < octaves; o++) {
      const off = 7.31 * o;
      total += amp * this.noise(x * freq + off, y * freq - off, z * freq + 2 * off);
      norm += amp;
      amp *= gain;
      freq *= 2;
    }
    return total / norm;
  }
}
