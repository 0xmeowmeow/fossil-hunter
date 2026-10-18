"""Generate preview meshes + a manifest for render_blender.py.

  venv/bin/python proto/generate.py                    # default preview set
  venv/bin/python proto/generate.py --sheet 1-12 --specimens 3,7
"""

import argparse
import json
import time
from pathlib import Path

from fossilgen.localities import LOCALITIES
from fossilgen.specimen import Specimen, fossil_mesh, write_ply

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "build"
LOCS = list(LOCALITIES)


def seeds(spec):
    out = []
    for part in spec.split(","):
        if "-" in part:
            a, b = part.split("-")
            out += range(int(a), int(b) + 1)
        elif part:
            out.append(int(part))
    return out


def locality_for(seed):
    return LOCS[seed % len(LOCS)]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sheet", default="1-12")
    ap.add_argument("--specimens", default="3,6")
    ap.add_argument("--voxel", type=float, default=.005)
    a = ap.parse_args()
    (OUT / "meshes").mkdir(parents=True, exist_ok=True)
    manifest = {"sheet": [], "specimens": []}

    for s in seeds(a.sheet):
        t0 = time.time()
        v, f, n, c, t = fossil_mesh(s, locality_for(s))
        p = OUT / "meshes" / f"trilobite_{s:04d}.ply"
        write_ply(p, v, f, n, c)
        manifest["sheet"].append(dict(ply=str(p), seed=s, locality=t.locality, archetype=t.archetype,
                                      blend=t.blend, blend_weight=t.blend_weight, pose=t.pose))
        (OUT / "meshes" / f"trilobite_{s:04d}.json").write_text(json.dumps(t.to_dict(), indent=1))
        print(f"fossil {s:4d} {t.locality:22s} {t.archetype:13s} ({t.blend_weight:.2f}, {t.blend}) "
              f"{len(f):7d} tris  {time.time() - t0:.1f}s", flush=True)

    for s in seeds(a.specimens):
        t0 = time.time()
        sp = Specimen(s, locality_for(s), voxel=a.voxel)
        entry = dict(seed=s, locality=sp.locality, archetype=sp.t.archetype, stages=[])
        for stage in ("raw", "partial", "prepared"):
            v, f, n, c = sp.stage_mesh(stage)
            p = OUT / "meshes" / f"specimen_{s:04d}_{stage}.ply"
            write_ply(p, v, f, n, c)
            entry["stages"].append(dict(stage=stage, ply=str(p), tris=len(f)))
        manifest["specimens"].append(entry)
        print(f"specimen {s:4d} grid {sp.grid.shape} {time.time() - t0:.1f}s", flush=True)

    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=1))


if __name__ == "__main__":
    main()
