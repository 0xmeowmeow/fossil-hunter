"""Render build/manifest.json with Blender (Cycles).

  blender -b --python proto/render_blender.py -- [sheet|specimens|closeup ...] [--samples N]

Lighting is a low raking key light, as fossil photographers use, so relief reads clearly.
"""

import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "build"
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
SAMPLES = int(argv[argv.index("--samples") + 1]) if "--samples" in argv else 96
JOBS = [a for a in argv if a in ("sheet", "specimens", "closeup")] or ["sheet", "specimens", "closeup"]


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    prefs = bpy.context.preferences.addons["cycles"].preferences
    for kind in ("OPTIX", "CUDA"):
        try:
            prefs.compute_device_type = kind
            prefs.get_devices()
            if any(d.type == kind for d in prefs.devices):
                for d in prefs.devices:
                    d.use = d.type == kind
                sc.cycles.device = "GPU"
                break
        except TypeError:
            continue
    sc.cycles.samples = SAMPLES
    sc.cycles.use_denoising = True
    sc.view_settings.view_transform = "AgX"
    sc.view_settings.look = "AgX - Medium High Contrast"
    world = bpy.data.worlds.new("w")
    sc.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (.035, .035, .04, 1)
    world.node_tree.nodes["Background"].inputs[1].default_value = .6
    return sc


def material():
    m = bpy.data.materials.new("specimen")
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    attr = nt.nodes.new("ShaderNodeVertexColor")
    attr.layer_name = "Col"
    nt.links.new(attr.outputs["Color"], bsdf.inputs["Base Color"])
    # Alpha marks fossil vertices: smoother, slightly glossy calcite vs dull matrix.
    rough = nt.nodes.new("ShaderNodeMapRange")
    rough.inputs["To Min"].default_value = .82
    rough.inputs["To Max"].default_value = .38
    nt.links.new(attr.outputs["Alpha"], rough.inputs["Value"])
    nt.links.new(rough.outputs["Result"], bsdf.inputs["Roughness"])
    # Fine grain bump so flat matrix does not look like plastic.
    tex = nt.nodes.new("ShaderNodeTexNoise")
    tex.inputs["Scale"].default_value = 900
    tex.inputs["Detail"].default_value = 4
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = .12
    bump.inputs["Distance"].default_value = .002
    nt.links.new(tex.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return m


def load(ply, mat, loc=(0, 0, 0)):
    bpy.ops.wm.ply_import(filepath=ply)
    ob = bpy.context.selected_objects[0]
    ob.location = loc
    for p in ob.data.polygons:
        p.use_smooth = True
    ob.data.materials.append(mat)
    if "Col" not in ob.data.color_attributes and ob.data.color_attributes:
        ob.data.color_attributes[0].name = "Col"
    return ob


def ground(z=0.0, size=60, col=(.05, .05, .055)):
    bpy.ops.mesh.primitive_plane_add(size=size, location=(0, 0, z))
    g = bpy.context.object
    m = bpy.data.materials.new("ground")
    m.use_nodes = True
    m.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (*col, 1)
    m.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = .9
    g.data.materials.append(m)


def lights(center, scale):
    c = Vector(center)
    key = bpy.data.lights.new("key", "AREA")
    key.energy = 900 * scale ** 2
    key.size = 1.5 * scale
    ok = bpy.data.objects.new("key", key)
    ok.location = c + Vector((-4, 2.5, 1.9)) * scale
    bpy.context.collection.objects.link(ok)
    aim(ok, c)
    fill = bpy.data.lights.new("fill", "AREA")
    fill.energy = 220 * scale ** 2
    fill.size = 4 * scale
    of = bpy.data.objects.new("fill", fill)
    of.location = c + Vector((3, -3, 4)) * scale
    bpy.context.collection.objects.link(of)
    aim(of, c)


def aim(ob, target):
    d = Vector(target) - ob.location
    ob.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()


def camera(loc, target, lens=50, ortho=None):
    cd = bpy.data.cameras.new("cam")
    cd.lens = lens
    if ortho:
        cd.type = "ORTHO"
        cd.ortho_scale = ortho
    cam = bpy.data.objects.new("cam", cd)
    cam.location = loc
    bpy.context.collection.objects.link(cam)
    aim(cam, target)
    bpy.context.scene.camera = cam


def label(text, loc, size=.09):
    bpy.ops.object.text_add(location=loc)
    t = bpy.context.object
    t.data.body = text
    t.data.size = size
    t.data.align_x = "CENTER"
    m = bpy.data.materials.new("label")
    m.use_nodes = True
    m.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (.6, .58, .52, 1)
    m.node_tree.nodes["Principled BSDF"].inputs["Emission Color"].default_value = (.6, .58, .52, 1)
    m.node_tree.nodes["Principled BSDF"].inputs["Emission Strength"].default_value = .4
    t.data.materials.append(m)


def render(sc, name, res):
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.filepath = str(OUT / f"{name}.png")
    bpy.ops.render.render(write_still=True)
    print("wrote", sc.render.filepath)


def sheet(man):
    sc = reset()
    mat = material()
    items = man["sheet"]
    cols = 4
    dx, dy = 1.9, 2.0
    rows = math.ceil(len(items) / cols)
    for i, it in enumerate(items):
        x = (i % cols - (cols - 1) / 2) * dx
        y = ((rows - 1) / 2 - i // cols) * dy
        load(it["ply"], mat, (x, y, 0))
        mix = it["archetype"] if it["blend_weight"] > .72 else f"{it['archetype']} x {it['blend']}"
        pose = "enrolled" if abs(it["pose"]["enroll"]) > 2 else "moult" if it["pose"]["moult"] else ""
        label(f"#{it['seed']}  {mix}  {pose}".strip(), (x, y - .92, 0), .085)
    ground(-.003)
    lights((0, 0, 0), 2.2)
    w, h = cols * dx + .3, rows * dy + .3
    camera((0, -1.2, 14), (0, -.1, 0), ortho=w)
    render(sc, "trilobite_sheet", (2000, int(2000 * h / w)))


def specimens(man, close=False):
    for it in man["specimens"]:
        sc = reset()
        mat = material()
        obs = []
        for j, st in enumerate(it["stages"]):
            ob = load(st["ply"], mat)
            obs.append(ob)
        # Lay the stages out left to right using their bounding boxes.
        widths = [ob.dimensions.x for ob in obs]
        gap = .25
        x = -(sum(widths) + gap * (len(obs) - 1)) / 2
        bottom = min(min((ob.matrix_world @ Vector(c)).z for c in ob.bound_box) for ob in obs)
        for ob, w, st in zip(obs, widths, it["stages"]):
            bb = [Vector(c) for c in ob.bound_box]
            cx = (min(c.x for c in bb) + max(c.x for c in bb)) / 2
            cy = (min(c.y for c in bb) + max(c.y for c in bb)) / 2
            ob.location = (x + w / 2 - cx, -cy, 0)
            label(st["stage"], (x + w / 2, -ob.dimensions.y / 2 - .18, bottom), .09)
            x += w + gap
        span = sum(widths) + gap * 2
        ground(bottom - .002)
        lights((0, 0, 0), span / 3)
        camera((0, -span * 1.25, span * .95), (0, -.15, bottom * .5), lens=50)
        render(sc, f"specimen_{it['seed']:04d}_stages", (2400, 1100))

        if close:
            # Close-up on the partially prepared block: tool-worked edge and exposed fossil.
            for ob in (obs[0], obs[2]):
                ob.hide_render = True
            o = obs[1]
            c = o.location
            camera((c.x - .45, c.y - .95, .6), (c.x, c.y, 0), lens=55)
            render(sc, f"specimen_{it['seed']:04d}_closeup", (1600, 1100))


man = json.loads((OUT / "manifest.json").read_text())
if "sheet" in JOBS:
    sheet(man)
if "specimens" in JOBS or "closeup" in JOBS:
    specimens(man, close="closeup" in JOBS)
