"""A fossil in a block of layered matrix, and the block at three preparation stages.

Everything is a signed distance field on a voxel grid; meshes come from marching cubes,
which places each vertex between grid points, so surfaces are smooth rather than blocky.

  matrix      rounded box, noise-displaced, with a few planar chips (broken faces)
  floor(x,y)  how far down the preparator has worked: the bedding plane next to the
              fossil, rising in a slope away from its outline
  remaining   matrix minus everything above the floor (inside the worked area)
  surface     min(fossil, remaining)
"""

import numpy as np
from scipy.ndimage import distance_transform_edt, gaussian_filter
from skimage.measure import marching_cubes

from .localities import LOCALITIES
from .noise import Noise
from .trilobite import Body, Grid, Posed, sample, FAR


def fossil_volume(posed, grid):
    """Fossil SDF on `grid`, evaluated only inside the fossil's bounding box."""
    vol = np.full(grid.shape, FAR, np.float32)
    lo, hi = posed.bounds()
    sl = grid.box_slices(lo - .03, hi + .03)
    X, Y, Z = grid.mesh(sl)
    P = np.stack([X.ravel(), Y.ravel(), Z.ravel()], 1)
    vol[sl] = posed.field(P).reshape(X.shape)
    return vol


def mesh_field(vol, grid):
    # Gradient normals from the field (skimage's point inward for a negative-inside SDF).
    v, f, n, _ = marching_cubes(vol, 0.0, spacing=(grid.voxel,) * 3)
    return v + grid.origin, f, -n


class Specimen:
    def __init__(self, seed, locality, voxel=.005):
        self.seed, self.locality = seed, locality
        self.loc = LOCALITIES[locality]
        self.t = sample(seed, locality)
        rng = np.random.default_rng(seed + 1000)
        self.posed = Posed(Body(self.t))
        flo, fhi = self.posed.rest_on_plane(0.0)
        self.z0 = 0.0
        self.noise = Noise(seed)

        # Block: footprint plus margins, bedding plane somewhere in the middle third.
        m = rng.uniform(.26, .4, 4)
        self.b_lo = np.array([flo[0] - m[0], flo[1] - m[1], -rng.uniform(.18, .3)])
        self.b_hi = np.array([fhi[0] + m[2], fhi[1] + m[3], max(fhi[2], 0) + rng.uniform(.1, .2)])
        self.grid = g = Grid(self.b_lo - .06, self.b_hi + .06, voxel)
        self.X, self.Y, self.Z = g.mesh()

        self.d_f = fossil_volume(self.posed, g)
        self.d_m = self._matrix(self.X, self.Y, self.Z, rng)
        self.floor = self._floor(rng)
        self.sweep = self._sweep(rng)
        self._strata(rng)

    # ---- fields

    def _matrix(self, X, Y, Z, rng):
        c = (self.b_lo + self.b_hi) / 2
        half = (self.b_hi - self.b_lo) / 2
        r = .035
        q = np.stack([np.abs(X - c[0]) - half[0] + r, np.abs(Y - c[1]) - half[1] + r, np.abs(Z - c[2]) - half[2] + r])
        d = np.linalg.norm(np.maximum(q, 0), axis=0) + np.minimum(q.max(0), 0) - r
        d = d + .022 * self.noise.fbm(X, Y, Z, freq=3.0, octaves=4)
        if not hasattr(self, "_chips"):
            self._chips = []
            for _ in range(rng.integers(2, 5)):
                n = rng.choice([-1, 1], 3) * np.array([1, 1, rng.uniform(.3, 1.2)]) + rng.normal(0, .3, 3)
                n /= np.linalg.norm(n)
                ext = np.abs(n) @ half
                self._chips.append((n, ext - rng.uniform(.04, .14)))
        for n, k in self._chips:
            d = np.maximum(d, n[0] * (X - c[0]) + n[1] * (Y - c[1]) + n[2] * (Z - c[2]) - k)
        return d.astype(np.float32)

    def _floor(self, rng):
        g = self.grid
        foot = (self.d_f < 0).any(axis=2)
        dxy = distance_transform_edt(~foot) * g.voxel
        dxy = gaussian_filter(dxy, 1.0)
        margin, slope = rng.uniform(.015, .04), rng.uniform(.7, 1.6)
        X2, Y2 = self.X[:, :, 0], self.Y[:, :, 0]
        tool = .0015 * self.noise.fbm(X2 * 1.0, Y2, np.zeros_like(X2) + 3.3, freq=40, octaves=2)
        # A shallow moat right against the outline, as preparators undercut the edge.
        moat = .012 * np.exp(-dxy / .015)
        return (self.z0 - .002 - moat + slope * np.maximum(0, dxy - margin) + tool)[:, :, None]

    def _sweep(self, rng):
        """< 0 where the partial-prep stage has already been worked."""
        a = rng.uniform(0, 2 * np.pi)
        X2, Y2 = self.X[:, :, :1], self.Y[:, :, :1]
        ext = np.abs(np.cos(a)) * (self.b_hi[0] - self.b_lo[0]) + np.abs(np.sin(a)) * (self.b_hi[1] - self.b_lo[1])
        pr = (np.cos(a) * X2 + np.sin(a) * Y2) / ext
        pr = pr + .06 * self.noise(X2, Y2, np.full_like(X2, 9.1), freq=2.5)
        return (pr - rng.uniform(-.05, .1)).astype(np.float32)

    def _strata(self, rng):
        lo, hi = self.b_lo[2] - .1, self.b_hi[2] + .1
        below = np.cumsum(rng.exponential(.06, 20) + .012)
        above = np.cumsum(rng.exponential(.06, 20) + .012)
        self.beds = np.sort(np.concatenate([self.z0 - below, [self.z0], self.z0 + above]))
        self.beds = self.beds[(self.beds > lo) & (self.beds < hi)]
        pal = np.array(self.loc["layers"])
        self.bed_cols = pal[rng.integers(len(pal), size=len(self.beds) + 1)] * rng.uniform(.88, 1.12, (len(self.beds) + 1, 1))

    def remaining(self, stage):
        cut = self.Z - self.floor
        if stage == "raw":
            return self.d_m
        if stage == "partial":
            cut = cut - 2.5 * np.maximum(self.sweep, 0)
        return np.maximum(self.d_m, cut)

    # ---- meshes

    def stage_mesh(self, stage):
        surf = np.minimum(self.d_f, self.remaining(stage))
        v, f, n = mesh_field(surf, self.grid)
        return v, f, n, self._colour(v, stage)

    def _colour(self, V, stage):
        x, y, z = V[:, 0], V[:, 1], V[:, 2]
        d_f = self.posed.field(V.copy())
        rng = np.random.default_rng(0)
        d_m = self._matrix(x, y, z, rng)
        fl = self._floor_at(x, y)
        cut = z - fl
        if stage == "partial":
            cut = cut - 2.5 * np.maximum(self._sweep_at(x, y), 0)
        rem = d_m if stage == "raw" else np.maximum(d_m, cut)
        # Soft fossil/matrix mix over ~1 voxel so the boundary does not look torn.
        mix = np.clip(.5 + (np.abs(rem) - np.abs(d_f)) / (2 * self.grid.voxel), 0, 1)
        is_fossil = mix > .5
        worked = (stage != "raw") & (cut > d_m) & ~is_fossil

        tz = z + .012 * self.noise.fbm(x, y, z, freq=5, octaves=3)
        bed = np.searchsorted(self.beds, tz)
        col = self.bed_cols[bed].copy()
        grain = 1 + .12 * self.noise.fbm(x, y, z, freq=60, octaves=2)
        col *= grain[:, None]
        parting = np.exp(-((tz - self.z0) / .004) ** 2)
        col *= (1 - .45 * parting)[:, None]
        weathered = ~worked
        col[weathered] *= np.array([.88, .82, .74])
        col[worked] *= 1.08

        fc = np.array(self.t.colour) * (1 + .25 * self.noise.fbm(x, y, z, freq=30, octaves=3))[:, None]
        col = col * (1 - mix[:, None]) + fc * mix[:, None]
        col = np.clip(col, 0, 1)
        alpha = mix.astype(np.float32)
        return np.concatenate([col, alpha[:, None]], 1)

    def _floor_at(self, x, y):
        g = self.grid
        ix = np.clip(np.round((x - g.origin[0]) / g.voxel).astype(int), 0, g.shape[0] - 1)
        iy = np.clip(np.round((y - g.origin[1]) / g.voxel).astype(int), 0, g.shape[1] - 1)
        return self.floor[ix, iy, 0]

    def _sweep_at(self, x, y):
        g = self.grid
        ix = np.clip(np.round((x - g.origin[0]) / g.voxel).astype(int), 0, g.shape[0] - 1)
        iy = np.clip(np.round((y - g.origin[1]) / g.voxel).astype(int), 0, g.shape[1] - 1)
        return self.sweep[ix, iy, 0]


def fossil_mesh(seed, locality, voxel=.004):
    """The posed fossil alone, resting on z=0 (for contact sheets)."""
    t = sample(seed, locality)
    posed = Posed(Body(t))
    lo, hi = posed.rest_on_plane(0.0)
    g = Grid(lo - .02, hi + .02, voxel)
    v, f, n = mesh_field(fossil_volume(posed, g), g)
    noise = Noise(seed)
    shade = 1 + .25 * noise.fbm(v[:, 0], v[:, 1], v[:, 2], freq=30, octaves=3)
    col = np.clip(np.array(t.colour)[None] * shade[:, None], 0, 1)
    return v, f, n, np.concatenate([col, np.ones((len(v), 1))], 1), t


def write_ply(path, V, F, N, C):
    vd = np.zeros(len(V), dtype=[("x", "<f4"), ("y", "<f4"), ("z", "<f4"),
                                 ("nx", "<f4"), ("ny", "<f4"), ("nz", "<f4"),
                                 ("r", "u1"), ("g", "u1"), ("b", "u1"), ("a", "u1")])
    vd["x"], vd["y"], vd["z"] = V[:, 0], V[:, 1], V[:, 2]
    vd["nx"], vd["ny"], vd["nz"] = N[:, 0], N[:, 1], N[:, 2]
    # Store sRGB-encoded colours, as Blender expects for byte colour attributes.
    srgb = np.where(C[:, :3] <= .0031308, 12.92 * C[:, :3], 1.055 * np.power(C[:, :3], 1 / 2.4) - .055)
    rgb = np.round(np.clip(srgb, 0, 1) * 255).astype(np.uint8)
    vd["r"], vd["g"], vd["b"] = rgb[:, 0], rgb[:, 1], rgb[:, 2]
    vd["a"] = np.round(C[:, 3] * 255).astype(np.uint8)
    fd = np.zeros(len(F), dtype=[("n", "u1"), ("i", "<i4", (3,))])
    fd["n"], fd["i"] = 3, F
    header = (f"ply\nformat binary_little_endian 1.0\nelement vertex {len(V)}\n"
              "property float x\nproperty float y\nproperty float z\n"
              "property float nx\nproperty float ny\nproperty float nz\n"
              "property uchar red\nproperty uchar green\nproperty uchar blue\nproperty uchar alpha\n"
              f"element face {len(F)}\nproperty list uchar int vertex_indices\nend_header\n")
    with open(path, "wb") as fh:
        fh.write(header.encode())
        fh.write(vd.tobytes())
        fh.write(fd.tobytes())
