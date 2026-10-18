"""Smooth seeded 3D noise: a random lattice read through cubic B-spline interpolation."""

import numpy as np
from scipy.ndimage import map_coordinates, spline_filter


class Noise:
    def __init__(self, seed, size=32):
        rng = np.random.default_rng(seed)
        lattice = rng.standard_normal((size, size, size)).astype(np.float32)
        self.coef = spline_filter(lattice, order=3, mode="grid-wrap")

    def __call__(self, x, y, z, freq=1.0):
        shape = np.shape(x)
        coords = np.stack([np.ravel(x) * freq, np.ravel(y) * freq, np.ravel(z) * freq])
        v = map_coordinates(self.coef, coords, order=3, mode="grid-wrap", prefilter=False)
        return v.reshape(shape)

    def fbm(self, x, y, z, freq=1.0, octaves=4, gain=0.5):
        total, amp, norm = 0.0, 1.0, 0.0
        for o in range(octaves):
            off = 7.31 * o
            total = total + amp * self(x + off, y - off, z + 2 * off, freq)
            norm += amp
            amp *= gain
            freq *= 2.0
        return total / norm


def hash01(ix, iy, seed):
    """Integer lattice hash -> [0, 1). Works on int64 arrays."""
    h = (ix.astype(np.int64) * 73856093) ^ (iy.astype(np.int64) * 19349663) ^ (seed * 83492791)
    h &= 0xFFFFFFFF
    h = ((h >> 13) ^ h) * 1274126177
    h &= 0xFFFFFFFF
    h ^= h >> 16
    return (h & 0xFFFF) / 65536.0
