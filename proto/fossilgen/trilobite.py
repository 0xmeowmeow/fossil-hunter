"""Seeded trilobite: anatomy + pose -> signed distance field.

Body frame: length 1 along +y (tail tip y=-0.5, head front y=+0.5), x across, z up,
base of the shield on z=0. The dorsal shield is a height field over the outline; spines
and eyes are 3D shapes smooth-unioned on. The head (cephalon) and trunk are stored as
separate volumes so a moult can shift the head away from the body.

Pose: enrolment (bend about x), roll/tilt/yaw, then compaction (squash in world z).
"""

from dataclasses import dataclass, asdict, field
import numpy as np
from scipy.ndimage import map_coordinates

from .localities import ARCHETYPES, INT_PARAMS, LOCALITIES
from .noise import hash01

FAR = 0.1  # field value used outside sampled volumes


@dataclass
class Trilobite:
    seed: int
    locality: str
    archetype: str
    blend: str
    blend_weight: float
    anatomy: dict
    pose: dict
    colour: tuple

    def __getattr__(self, k):
        try:
            return self.__dict__["anatomy"][k]
        except KeyError:
            raise AttributeError(k)

    def to_dict(self):
        return asdict(self)


def _draw(rng, ranges):
    out = {}
    for k, (lo, hi) in ranges.items():
        out[k] = float(rng.uniform(lo, hi))
    return out


def sample(seed, locality):
    rng = np.random.default_rng(seed)
    loc = LOCALITIES[locality]
    names = list(loc["archetypes"])
    probs = np.array([loc["archetypes"][n] for n in names])
    primary = names[rng.choice(len(names), p=probs / probs.sum())]
    secondary = list(ARCHETYPES)[rng.integers(len(ARCHETYPES))]
    # Mostly the primary group; occasionally a real chimera.
    w = rng.uniform(.75, 1.0) if rng.random() > .15 else rng.uniform(.45, .7)
    a, b = _draw(rng, ARCHETYPES[primary]), _draw(rng, ARCHETYPES[secondary])
    anatomy = {k: w * a[k] + (1 - w) * b[k] for k in a}
    for k in INT_PARAMS:
        anatomy[k] = int(round(anatomy[k]))
    anatomy["glabellar_furrows"] = int(rng.integers(1, 4))

    enroll_p = .45 if primary == "phacopid" else .12
    pose = dict(enroll=0.0, roll=0.0, tilt=float(rng.normal(0, .04)),
                yaw=float(rng.uniform(-np.pi, np.pi)), flatten=float(rng.uniform(.55, .95)),
                moult=False, moult_dx=0.0, moult_dy=0.0, moult_rot=0.0, sink=.006)
    r = rng.random()
    if r < enroll_p:
        full = rng.random() < .6
        pose["enroll"] = float(rng.uniform(1.6, 1.85) * np.pi if full else rng.uniform(.25, .7) * np.pi)
        pose["flatten"] = float(rng.uniform(.85, 1.0))
        if full and rng.random() < .4:
            pose["roll"] = float(rng.choice([-1, 1]) * np.pi / 2)
    elif r < enroll_p + .12:
        pose.update(moult=True, moult_dx=float(rng.uniform(-.15, .15)), moult_dy=float(rng.uniform(.03, .15)),
                    moult_rot=float(rng.uniform(-.9, .9)))
    else:
        pose["enroll"] = float(rng.normal(0, .08))
    base = np.array(loc["fossil"][rng.integers(len(loc["fossil"]))])
    colour = tuple(float(c) for c in base * rng.uniform(.85, 1.15))
    return Trilobite(seed, locality, primary, secondary, float(w), anatomy, pose, colour)


# ---------------------------------------------------------------- body frame field

def _layout(t):
    yt, yh = -.5, .5
    yc = yh - t.ceph_len
    yp = yt + t.pyg_len
    Wc = t.ceph_halfwidth
    return yt, yh, yc, yp, Wc, Wc * t.thorax_front, Wc * t.thorax_taper


def outline_and_top(t, X, Y):
    """Half-width w(y) and shield height top(x, y) over 2D arrays."""
    yt, yh, yc, yp, Wc, Wf, Wb = _layout(t)
    cl, pl, tl, n, H = t.ceph_len, t.pyg_len, yc - yp, t.n_thorax, t.height
    ax = np.abs(X)

    v = np.clip((Y - yc) / cl, 0, 1)
    w_c = Wc * np.clip(1 - v ** t.ceph_shape, 0, 1) ** (1 / t.ceph_shape)
    u = np.clip((yc - Y) / tl, 0, 1)
    s = u * n
    fr = s - np.floor(s)
    w_line = Wf + (Wb - Wf) * u
    w_t = w_line * (.965 + .035 * np.sin(np.pi * fr) ** .5)
    q = np.clip((yp - Y) / pl, 0, 1)
    w_p = Wb * .96 * np.clip(1 - q ** t.pyg_shape, 0, 1) ** (1 / t.pyg_shape)

    in_c = Y >= yc
    in_t = (Y < yc) & (Y >= yp)
    w = np.where(in_c, w_c, np.where(in_t, w_t, w_p))
    w = np.where((Y < yt) | (Y > yh), 0, w)
    r = ax / np.maximum(w, 1e-4)

    # Trunk: axial lobe, axial furrows, sloping pleural fields.
    A = t.axial_ratio * np.where(in_t, w_line, Wb * np.clip(1 - q / .85, 0, 1) ** .6)
    a_n = ax / np.maximum(A, 1e-4)
    pleura = .45 * np.clip(1 - r ** 2.5, 0, 1) ** .5
    ring = .55 * np.sqrt(np.clip(1 - a_n ** 2, 0, 1))
    furrow = -.12 * np.exp(-((a_n - 1) / .18) ** 2)
    trunk = pleura + ring + furrow

    seg = np.cos(np.pi * fr) ** 6
    frd = fr - .35 * np.clip((ax - A) / np.maximum(w_line, 1e-3), 0, 1)
    pf = np.exp(-((frd - .45) / .07) ** 2) * _ramp(ax / np.maximum(A, 1e-4), 1.05, 1.4)
    top_t = trunk * (1 - .28 * seg) - .06 * pf

    sp = q / .85 * t.n_pyg
    frp = sp - np.floor(sp)
    segp = np.cos(np.pi * frp) ** 8 * (q < .85) * (1 - q)
    bw = .1 + .15 * t.border
    top_p = trunk * (1 - .3 * segp)
    b = _ramp(r, 1 - bw - .04, 1 - bw + .04)
    top_p = top_p * (1 - b) + np.minimum(top_p, .18) * b

    # Cephalon: cheeks, border rim, glabella with furrows, occipital ring.
    cheek = .58 * np.clip(1 - r ** 2, 0, 1) ** .45
    bwc = .08 + .1 * t.border
    rim = .12 * t.border * np.exp(-((r - (1 - bwc * .5)) / (bwc * .35)) ** 2)
    bfur = -.08 * np.exp(-((r - (1 - bwc)) / .04) ** 2)
    gy0 = yc + .13 * cl
    gy1 = min(yc + t.glabella_len * cl, yh - .03)
    gu = (Y - gy0) / (gy1 - gy0)
    Ag0 = t.axial_ratio * Wf
    gw = Ag0 * (1 + (t.glabella_front - 1) * np.clip(gu, 0, 1))
    gx = ax / gw
    e = gx ** 2 + (np.maximum(gu - .55, 0) / .45) ** 2 + (np.maximum(-gu, 0) / .04) ** 2
    glab = (.6 + t.glabella_height) * np.sqrt(np.clip(1 - e, 0, 1))
    for k in (.18, .38, .58)[:t.glabellar_furrows]:
        glab -= .1 * np.exp(-((gu - k) / .035) ** 2) * _ramp(gx, .25, .5) * _ramp(glab, 0, .1)
    occ_y = (Y - yc) / (gy0 - yc)
    occ = .5 * np.sqrt(np.clip(1 - (ax / Ag0) ** 2, 0, 1)) * (occ_y < .8) * (1 - .3 * np.exp(-((occ_y - .1) / .15) ** 2))
    gfur = -.1 * np.exp(-((np.sqrt(e) - 1) / .12) ** 2) * (gu > -.3)
    top_c = np.maximum.reduce([cheek + rim + bfur + gfur, glab, occ])

    # Blend across the head/thorax and thorax/tail joints so the height field has no steps
    # (a step makes marching cubes bead along the seam). Posterior border furrow at the joint.
    bc = _ramp(Y, yc - .01, yc + .01)
    bp = _ramp(Y, yp - .01, yp + .01)
    top = top_c * bc + (top_t * bp + top_p * (1 - bp)) * (1 - bc)
    top = (top - .08 * np.exp(-((Y - yc - .012) / .01) ** 2) * _ramp(a_n, .8, 1.2)) * H
    # No cut-off at the outline: d_xy bounds the shape, so the field stays continuous there.
    top = np.maximum(top, H * .2)

    if t.tubercles > 0:
        top += _tubercles(X, Y, cell=.032, seed=t.seed) * t.tubercles * H * .22 * (1 - _ramp(r, .88, .97))
    return w, top


def _ramp(x, a, b):
    u = np.clip((x - a) / (b - a), 0, 1)
    return u * u * (3 - 2 * u)


def _tubercles(X, Y, cell, seed):
    gx, gy = X / cell, Y / cell
    ix, iy = np.floor(gx).astype(np.int64), np.floor(gy).astype(np.int64)
    out = np.zeros_like(X)
    for di in (-1, 0, 1):
        for dj in (-1, 0, 1):
            cx, cy = ix + di, iy + dj
            px = cx + .2 + .6 * hash01(cx, cy, seed)
            py = cy + .2 + .6 * hash01(cy, cx, seed + 1)
            rad = .25 + .2 * hash01(cx, cy, seed + 2)
            d = np.sqrt((gx - px) ** 2 + (gy - py) ** 2) / rad
            out = np.maximum(out, np.clip(1 - d ** 2, 0, 1) ** 1.5)
    return out


def smin(a, b, k):
    h = np.clip(.5 + .5 * (b - a) / k, 0, 1)
    return b * (1 - h) + a * h - k * h * (1 - h)


class Grid:
    def __init__(self, lo, hi, voxel):
        self.voxel = voxel
        self.axes = [np.arange(l, h + voxel, voxel) for l, h in zip(lo, hi)]
        self.origin = np.array([a[0] for a in self.axes])
        self.shape = tuple(len(a) for a in self.axes)

    def box_slices(self, lo, hi):
        return tuple(slice(max(np.searchsorted(a, l) - 1, 0), np.searchsorted(a, h) + 1)
                     for a, l, h in zip(self.axes, lo, hi))

    def mesh(self, sl=None):
        axes = self.axes if sl is None else [a[s] for a, s in zip(self.axes, sl)]
        return np.meshgrid(*axes, indexing="ij")


def _union_shape(vol, grid, lo, hi, fn, k):
    sl = grid.box_slices(np.asarray(lo) - k, np.asarray(hi) + k)
    X, Y, Z = grid.mesh(sl)
    vol[sl] = smin(vol[sl], fn(X, Y, Z), k)


def _cone(a, b, ra, rb):
    a, b = np.asarray(a, float), np.asarray(b, float)
    ba = b - a
    bb = ba @ ba

    def f(X, Y, Z):
        px, py, pz = X - a[0], Y - a[1], Z - a[2]
        h = np.clip((px * ba[0] + py * ba[1] + pz * ba[2]) / bb, 0, 1)
        dx, dy, dz = px - ba[0] * h, py - ba[1] * h, pz - ba[2] * h
        return np.sqrt(dx * dx + dy * dy + dz * dz) - (ra + (rb - ra) * h)
    lo = np.minimum(a, b) - max(ra, rb)
    hi = np.maximum(a, b) + max(ra, rb)
    return f, lo, hi


def _ellipsoid(c, rad):
    c, rad = np.asarray(c, float), np.asarray(rad, float)

    def f(X, Y, Z):
        k = np.sqrt(((X - c[0]) / rad[0]) ** 2 + ((Y - c[1]) / rad[1]) ** 2 + ((Z - c[2]) / rad[2]) ** 2)
        return (k - 1) * rad.min()
    return f, c - rad, c + rad


def _spines(t):
    """Returns (head_parts, trunk_parts): lists of (fn, lo, hi)."""
    yt, yh, yc, yp, Wc, Wf, Wb = _layout(t)
    H, n = t.height, t.n_thorax
    head, trunk = [], []
    for sx in (-1, 1):
        if t.genal_spine > .03:
            p = np.array([sx * Wc * .96, yc + .012, H * .18])
            ang = t.genal_angle
            seg = t.genal_spine / 3
            radii = [.026, .017, .009, .003]
            for i in range(3):
                d = np.array([sx * np.sin(ang), -np.cos(ang), -.08])
                q = p + d * seg
                q[2] = max(q[2], .01)
                head.append(_cone(p, q, radii[i], radii[i + 1]))
                p, ang = q, ang - .12
        # Eyes sit on the fixed cheeks, on the shield surface.
        es = t.eye_size
        ex, ey = sx * t.eye_x * Wc, yc + t.eye_y * t.ceph_len
        _, top = outline_and_top(t, np.array([[ex]]), np.array([[ey]]))
        head.append(_ellipsoid((ex, ey, top[0, 0] + .1 * es), (.45 * es, es, .6 * es)))
        if t.pleural_spine > .02:
            yl = yc - (np.arange(n) + .5) * (yc - yp) / n
            for i, y in enumerate(yl):
                f = i / max(n - 1, 1)
                wl = Wf + (Wb - Wf) * f
                th = .25 + .9 * f
                L = t.pleural_spine * (.5 + .8 * f)
                a = np.array([sx * wl * .9, y, H * .15])
                b = a + np.array([sx * np.cos(th) * L, -np.sin(th) * L, -H * .1])
                trunk.append(_cone(a, b, .012, .003))
        for j in range(t.pyg_spines):
            qj = (j + 1) / (t.pyg_spines + 1) * .9
            y = yp - qj * t.pyg_len
            wp = Wb * .96 * (1 - qj ** t.pyg_shape) ** (1 / t.pyg_shape)
            th = .8 + .5 * qj
            L = .08 + .2 * t.pleural_spine
            a = np.array([sx * wp * .9, y, H * .12])
            trunk.append(_cone(a, a + np.array([sx * np.cos(th) * L, -np.sin(th) * L, -H * .08]), .011, .003))
    if t.tail_spine > .03:
        trunk.append(_cone((0, yt + .03, H * .3), (0, yt - t.tail_spine, .015), .022, .004))
    if t.occipital_spine > .03:
        o = t.occipital_spine
        z0 = H * (.6 + t.glabella_height) * .9
        head.append(_cone((0, yc + .06 * t.ceph_len, z0), (0, yc - .5 * o, z0 + .8 * o), .016, .004))
    return head, trunk


class Body:
    """Head and trunk SDF volumes in the body frame."""

    def __init__(self, t, voxel=.004):
        self.t = t
        head_parts, trunk_parts = _spines(t)
        parts = head_parts + trunk_parts
        lo = np.min([p[1] for p in parts] + [np.array([-t.ceph_halfwidth, -.5, -.02])], axis=0) - .03
        hi = np.max([p[2] for p in parts] + [np.array([t.ceph_halfwidth, .5, t.height * 1.5])], axis=0) + .03
        lo[2] = -.03
        self.grid = g = Grid(lo, hi, voxel)
        X2, Y2 = np.meshgrid(g.axes[0], g.axes[1], indexing="ij")
        w, top = outline_and_top(t, X2, Y2)
        d_xy = np.maximum(np.abs(X2) - w, np.maximum(-.5 - Y2, Y2 - .5))
        Z = g.axes[2][None, None, :]
        d = np.maximum(d_xy[:, :, None], np.maximum((Z - top[:, :, None]) * .6, -Z)).astype(np.float32)
        yc = .5 - t.ceph_len
        dy = (yc - Y2)[:, :, None]
        # Overlap the halves slightly; an exact split pinches the field to zero along the seam.
        ov = 3 * voxel
        self.head = np.maximum(d, dy - ov)
        self.trunk = np.maximum(d, -dy - ov)
        for fn, plo, phi in head_parts:
            _union_shape(self.head, g, plo, phi, fn, .012)
        for fn, plo, phi in trunk_parts:
            _union_shape(self.trunk, g, plo, phi, fn, .01)

    def sample(self, vol, P):
        idx = ((P - self.grid.origin) / self.grid.voxel).T
        # Cubic B-spline used as a smoother (no prefilter): no overshoot ringing on thin spines.
        return map_coordinates(vol, idx, order=3, mode="constant", cval=FAR, prefilter=False)

    def occupied_points(self, max_n=150000, seed=0):
        pts = []
        for vol in (self.head, self.trunk):
            ii = np.argwhere(vol < 0)
            if len(ii) > max_n:
                ii = ii[np.random.default_rng(seed).choice(len(ii), max_n, replace=False)]
            pts.append(self.grid.origin + ii * self.grid.voxel)
        return pts  # [head_pts, trunk_pts]


# ---------------------------------------------------------------- pose

def _rot(pose):
    cy, sy = np.cos(pose["yaw"]), np.sin(pose["yaw"])
    ct, st = np.cos(pose["tilt"]), np.sin(pose["tilt"])
    cr, sr = np.cos(pose["roll"]), np.sin(pose["roll"])
    Rz = np.array([[cy, -sy, 0], [sy, cy, 0], [0, 0, 1]])
    Rx = np.array([[1, 0, 0], [0, ct, -st], [0, st, ct]])
    Ry = np.array([[cr, 0, sr], [0, 1, 0], [-sr, 0, cr]])
    return Rz @ Rx @ Ry


def _moult_mat(pose, yc):
    c, s = np.cos(pose["moult_rot"]), np.sin(pose["moult_rot"])
    R = np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])
    pivot = np.array([0, yc, 0])
    off = np.array([pose["moult_dx"], pose["moult_dy"], 0])
    return R, pivot, off


class Posed:
    """A Body placed in world space. `offset` is set by the caller (e.g. to rest on a bedding plane)."""

    def __init__(self, body):
        self.body = body
        self.t = t = body.t
        self.pose = t.pose
        self.R = _rot(self.pose)
        self.yc = .5 - t.ceph_len
        self.offset = np.zeros(3)
        e = self.pose["enroll"]
        self.Rb = 1.0 / e if abs(e) > 1e-3 else None

    def _bend(self, P):
        if self.Rb is None:
            return P
        R = self.Rb
        phi = P[:, 1] / R
        rr = R + P[:, 2]
        return np.stack([P[:, 0], rr * np.sin(phi), rr * np.cos(phi) - R], 1)

    def _unbend(self, P):
        if self.Rb is None:
            return P
        R = self.Rb
        Y, Zc = P[:, 1], P[:, 2] + R
        phi = np.arctan2(Y, Zc) if R > 0 else np.arctan2(-Y, -Zc)
        rho = np.sqrt(Y * Y + Zc * Zc)
        return np.stack([P[:, 0], R * phi, (rho - R) if R > 0 else (-rho - R)], 1)

    def to_world(self, P, head=False):
        if head and self.pose["moult"]:
            M, piv, off = _moult_mat(self.pose, self.yc)
            P = (P - piv) @ M.T + piv + off
        Q = self._bend(P) @ self.R.T
        Q[:, 2] *= self.pose["flatten"]
        return Q + self.offset

    def _to_body(self, W):
        Q = W - self.offset
        Q[:, 2] /= self.pose["flatten"]
        return self._unbend(Q @ self.R)

    def field(self, W):
        """SDF (approximate, world units) at world points W (N, 3)."""
        B = self._to_body(W)
        d_trunk = self.body.sample(self.body.trunk, B)
        if self.pose["moult"]:
            M, piv, off = _moult_mat(self.pose, self.yc)
            B = (B - piv - off) @ M + piv
        d_head = self.body.sample(self.body.head, B)
        # Undo the compaction stretch on distances, roughly.
        return np.minimum(d_head, d_trunk) * self.pose["flatten"]

    def bounds(self):
        head, trunk = self.body.occupied_points(seed=self.t.seed)
        W = np.concatenate([self.to_world(head, head=True), self.to_world(trunk)])
        return W.min(0), W.max(0)

    def rest_on_plane(self, z0=0.0):
        """Shift so the fossil's footprint is centred on the origin and its base sinks into z0."""
        self.offset = np.zeros(3)
        lo, hi = self.bounds()
        self.offset = np.array([-(lo[0] + hi[0]) / 2, -(lo[1] + hi[1]) / 2, z0 - lo[2] - self.pose["sink"]])
        return lo + self.offset, hi + self.offset
