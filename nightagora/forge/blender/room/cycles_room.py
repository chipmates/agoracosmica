"""THE ROOM IN CYCLES: an export of export-room.mjs, rendered at its stops.

Blender --background --factory-startup --python-exit-code 1 --python cycles_room.py --
    --export DIR --rig-dir RIG/blender --output DIR [--camera wide/flight] [--samples 256]

The import, the certified cameras and the device choice are the render rig's
own (`import_room`, `cameras`, `render.select_device`); this file adds what the
export carries beyond a glTF: the materials rebuilt from their recipes, the
lights from data, the air, the sky, and the engine's own print on the result.
"""
import argparse
import json
import math
from pathlib import Path
import sys
import time

import bpy
from mathutils import Matrix, Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
from print_engine import engine_print  # noqa: E402  the engine's print, shared with expose.py

THREADS = 4
SAMPLES = 256
SEED = 23
BOUNCES = {"max": 12, "diffuse": 4, "glossy": 4, "transmission": 8, "volume": 0, "transparent": 16}


def three_to_blender(v):
    """glTF/three (x, y, z) to Blender (x, -z, y); the importer's own mapping."""
    return Vector((v[0], -v[2], v[1]))


def arguments(argv):
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--export", type=Path, required=True)
    p.add_argument("--rig-dir", type=Path, required=True, help="the render rig's blender/ folder")
    p.add_argument("--output", type=Path, required=True)
    p.add_argument("--camera", action="append", help="pose id, e.g. wide/flight; repeatable; default every pose")
    p.add_argument("--samples", type=int, default=SAMPLES)
    p.add_argument("--denoise", action=argparse.BooleanOptionalAction, default=True)
    p.add_argument("--scale", type=float, default=1.0, help="output size as a share of each pose's stage")
    p.add_argument("--threads", type=int, default=THREADS)
    p.add_argument("--device", choices=("AUTO", "OPTIX", "METAL", "CPU"), default="CPU")
    p.add_argument("--air", action=argparse.BooleanOptionalAction, default=True)
    p.add_argument("--fittings", action=argparse.BooleanOptionalAction, default=False,
                   help="the hall's five point fittings, which reach no hall surface in the engine")
    p.add_argument("--reach-window", action=argparse.BooleanOptionalAction, default=True,
                   help="three's (1 - (d/reach)^4)^2 window on each spot")
    p.add_argument("--save-blend", type=Path)
    p.add_argument("--adaptive", type=float, default=0.0, help="adaptive sampling threshold; 0 renders every sample")
    p.add_argument("--border", type=float, nargs=4, metavar=("X0", "Y0", "X1", "Y1"),
                   help="render only this share of the frame (0..1, y up) for a study; the print's vignette is then the crop's")
    # Blender's own surface tools (tools.py); without them the render is the plain translation
    p.add_argument("--bevel", action="store_true", help="rounded edges: the Bevel shader node")
    p.add_argument("--displace", nargs="?", const="floor,timber", default=None,
                   help="true displacement from the sets' own height (heights.mjs) on adaptive subdivision: floor, timber")
    p.add_argument("--grime", action="store_true", help="cavity grime and arris wear where the set is weathered")
    p.add_argument("--dicing-rate", type=float, default=1.0, help="adaptive subdivision's size of a diced facet, in pixels")
    # a film's frames: poses other than the export's stops, printed at a stop's dials
    p.add_argument("--poses", type=Path, help="a museum-poses-v1 file to render instead of the export's stops")
    p.add_argument("--print-stop", help="the stop whose print dials a --poses frame takes")
    p.add_argument("--crops", type=Path, help="JSON {pose id: [[left, top, width, height], ...]} in the whole stage's pixels: each box rendered at full size")
    p.add_argument("--no-frame", action="store_true", help="render only the --crops, not the frames")
    return p.parse_args(argv)


# ---------------------------------------------------------------- materials

def _node(nt, kind, x=0, y=0, **inputs):
    n = nt.nodes.new(kind)
    n.location = (x, y)
    for k, v in inputs.items():
        n.inputs[k].default_value = v
    return n


def _image(nt, tex_dir, file, colour, x, y):
    n = nt.nodes.new("ShaderNodeTexImage")
    n.location = (x, y)
    img = bpy.data.images.load(str(tex_dir / file), check_existing=True)
    img.colorspace_settings.name = "sRGB" if colour else "Non-Color"
    n.image = img
    n.interpolation = "Linear"
    n.extension = "REPEAT"
    return n


def _math(nt, op, a, b=None, x=0, y=0, clamp=False):
    n = nt.nodes.new("ShaderNodeMath")
    n.operation = op
    n.use_clamp = clamp
    n.location = (x, y)
    for i, v in enumerate((a, b)):
        if v is None:
            continue
        if isinstance(v, (int, float)):
            n.inputs[i].default_value = v
        else:
            nt.links.new(v, n.inputs[i])
    return n.outputs[0]


def _mul_colour(nt, colour_socket, factor_socket_or_rgb, x, y):
    n = nt.nodes.new("ShaderNodeMix")
    n.data_type = "RGBA"
    n.blend_type = "MULTIPLY"
    n.location = (x, y)
    n.inputs["Factor"].default_value = 1.0
    nt.links.new(colour_socket, n.inputs["A"])
    if isinstance(factor_socket_or_rgb, (list, tuple)):
        n.inputs["B"].default_value = (*factor_socket_or_rgb[:3], 1.0)
    else:
        nt.links.new(factor_socket_or_rgb, n.inputs["B"])
    return n.outputs["Result"]


def _scalar_to_colour(nt, scalar, x, y):
    n = nt.nodes.new("ShaderNodeCombineColor")
    n.location = (x, y)
    for i in range(3):
        nt.links.new(scalar, n.inputs[i])
    return n.outputs[0]


def _drift(nt, pos, amount, x, y):
    """the engine's metre-scale drift, noise(P x .11) + noise(P x .37) / 2, each
    remapped from Blender's 0..1 noise to the -1..1 of MaterialX's"""
    total = None
    for scale, weight in ((0.11, amount), (0.37, amount * 0.5)):
        nz = nt.nodes.new("ShaderNodeTexNoise")
        nz.location = (x, y)
        nz.noise_dimensions = "3D"
        nz.inputs["Scale"].default_value = scale
        nz.inputs["Detail"].default_value = 0.0
        nt.links.new(pos, nz.inputs["Vector"])
        term = _math(nt, "MULTIPLY", _math(nt, "SUBTRACT", nz.outputs["Fac"], 0.5, x + 180, y), 2 * weight, x + 360, y)
        total = term if total is None else _math(nt, "ADD", total, term, x + 540, y)
        y -= 200
    return total


def _saw_cuts(nt, pos, bays, x, y):
    """the floor's 3 mm saw cuts on the bay grid, from world position (Blender
    x = east, y = north)"""
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    sep.location = (x, y)
    nt.links.new(pos, sep.inputs[0])
    cut = None
    for axis, origin, period in ((0, bays["originEast"], bays["east"]), (1, bays["originNorth"], bays["north"])):
        c = _math(nt, "SUBTRACT", sep.outputs[axis], origin, x + 180, y)
        f = _math(nt, "FRACT", _math(nt, "DIVIDE", c, period, x + 360, y), None, x + 540, y)
        edge = _math(nt, "MULTIPLY", _math(nt, "MINIMUM", f, _math(nt, "SUBTRACT", 1.0, f, x + 700, y - 60), x + 860, y), period, x + 1020, y)
        line = _math(nt, "LESS_THAN", edge, bays["cut"] / 2, x + 1180, y)
        cut = line if cut is None else _math(nt, "MAXIMUM", cut, line, x + 1340, y)
        y -= 220
    return cut


def build_material(mat, recipe, tex_dir):
    """A Cycles graph from the export's recipe, replacing the importer's."""
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = _node(nt, "ShaderNodeOutputMaterial", 1600, 0)
    kind = recipe["kind"]
    maps = recipe.get("maps") or {}
    if kind == "emission":
        e = recipe["emission"]
        peak = max(e["colour"])
        em = _node(nt, "ShaderNodeEmission", 1200, 0, Color=(*[c / peak for c in e["colour"]], 1), Strength=peak * e.get("strength", 1))
        nt.links.new(em.outputs[0], out.inputs["Surface"])
        return
    geo = _node(nt, "ShaderNodeNewGeometry", -1400, -600)
    pos = geo.outputs["Position"]
    bsdf = _node(nt, "ShaderNodeBsdfPrincipled", 1000, 0)
    bsdf.inputs["Metallic"].default_value = recipe.get("metal") or 0.0
    base = recipe.get("base") or {"mode": "flat", "tint": [0.5, 0.5, 0.5]}
    uv = recipe.get("uv") or {}
    vector = None
    if uv.get("mode") == "box":
        tc = _node(nt, "ShaderNodeTexCoord", -1400, 300)
        mp = _node(nt, "ShaderNodeMapping", -1200, 300)
        m = uv["metres"]
        mp.inputs["Scale"].default_value = (1 / m[0], 1 / m[1], 1 / m[0])
        mp.inputs["Rotation"].default_value = (0, 0, uv.get("turn", 0))
        nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
        vector = mp.outputs["Vector"]
    colour = None
    if maps.get("albedo"):
        im = _image(nt, tex_dir, maps["albedo"], True, -900, 300)
        if vector is not None:
            im.projection = "BOX"
            im.projection_blend = 0.3
            nt.links.new(vector, im.inputs["Vector"])
        colour = im.outputs["Color"]
        factor = maps.get("albedoFactor") or [1, 1, 1]
        if any(abs(f - 1) > 1e-6 for f in factor):
            colour = _mul_colour(nt, colour, factor, -600, 300)
    elif base["mode"] == "vertex":
        va = _node(nt, "ShaderNodeVertexColor", -900, 300)
        colour = va.outputs["Color"]
    else:
        rgb = _node(nt, "ShaderNodeRGB", -900, 300)
        rgb.outputs[0].default_value = (*base.get("tint", [0.5, 0.5, 0.5])[:3], 1)
        colour = rgb.outputs[0]
    if recipe.get("vertexTone"):
        # the piece's own tone rides in the vertex colour, as in the engine
        vt = _node(nt, "ShaderNodeVertexColor", -900, 100)
        colour = _mul_colour(nt, colour, vt.outputs["Color"], -450, 250)
    tone = recipe.get("tone")
    joint = None
    if tone:
        k = None
        if tone.get("bays"):
            va = _node(nt, "ShaderNodeVertexColor", -900, 0)
            sep = _node(nt, "ShaderNodeSeparateColor", -700, 0)
            nt.links.new(va.outputs["Color"], sep.inputs[0])
            k = sep.outputs[0]
        if tone.get("drift"):
            d = _drift(nt, pos, tone["drift"], -1200, -300)
            k = _math(nt, "ADD", k if k is not None else 1.0, d, -100, -100)
        if tone.get("bays"):
            joint = _saw_cuts(nt, pos, tone["bays"], -1200, -900)
            k = _math(nt, "MULTIPLY", k, _math(nt, "SUBTRACT", 1.0, _math(nt, "MULTIPLY", joint, tone["bays"]["cutDark"], 200, -700), 350, -700), 500, -100)
        if k is not None:
            colour = _mul_colour(nt, colour, _scalar_to_colour(nt, k, 650, -100), 800, 200)
    nt.links.new(colour, bsdf.inputs["Base Color"])
    rough = recipe.get("rough") or {"mode": "const", "value": 0.8}
    if maps.get("orm") and rough.get("mode") != "const":
        orm = _image(nt, tex_dir, maps["orm"], False, -900, -300)
        if vector is not None:
            orm.projection = "BOX"
            orm.projection_blend = 0.3
            nt.links.new(vector, orm.inputs["Vector"])
        sep = _node(nt, "ShaderNodeSeparateColor", -600, -300)
        nt.links.new(orm.outputs["Color"], sep.inputs[0])
        r = sep.outputs[1]
    else:
        r = None
        bsdf.inputs["Roughness"].default_value = rough.get("value", maps.get("roughnessFactor", 0.8))
    if joint is not None:
        r = _math(nt, "ADD", r if r is not None else bsdf.inputs["Roughness"].default_value, _math(nt, "MULTIPLY", joint, tone["bays"]["cutRough"], 500, -500), 700, -400, clamp=True)
    if r is not None:
        nt.links.new(r, bsdf.inputs["Roughness"])
    if maps.get("normal") and (recipe.get("normalScale") or 0) > 0:
        nm_img = _image(nt, tex_dir, maps["normal"], False, -900, -600)
        if vector is not None:
            nm_img.projection = "BOX"
            nm_img.projection_blend = 0.3
            nt.links.new(vector, nm_img.inputs["Vector"])
        nm = _node(nt, "ShaderNodeNormalMap", -500, -600, Strength=recipe["normalScale"])
        nt.links.new(nm_img.outputs["Color"], nm.inputs["Color"])
        nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
    coat = recipe.get("coat")
    if coat:
        bsdf.inputs["Coat Weight"].default_value = coat["weight"]
        bsdf.inputs["Coat Roughness"].default_value = coat["roughness"]
        bsdf.inputs["Coat IOR"].default_value = coat.get("ior", 1.5)
    shader = bsdf.outputs[0]
    cloth = recipe.get("cloth")
    if cloth:
        tr = _node(nt, "ShaderNodeBsdfTranslucent", 1000, -400)
        nt.links.new(_mul_colour(nt, colour, cloth["through"], 800, -400), tr.inputs["Color"])
        mix = _node(nt, "ShaderNodeMixShader", 1300, -100)
        mix.inputs["Fac"].default_value = cloth["weight"]
        nt.links.new(shader, mix.inputs[1])
        nt.links.new(tr.outputs[0], mix.inputs[2])
        shader = mix.outputs[0]
    if kind == "thin-glass":
        lw = _node(nt, "ShaderNodeLayerWeight", 600, -500)
        lw.inputs["Blend"].default_value = 0.5
        facing = lw.outputs["Facing"]
        grazing = _math(nt, "MULTIPLY", _math(nt, "POWER", facing, 5.0, 800, -500), recipe.get("grazing") or 0.34, 950, -500)
        opacity = _math(nt, "MINIMUM", _math(nt, "ADD", grazing, recipe.get("opacity") or 0.1, 1100, -500), 0.46, 1250, -500)
        clear = _node(nt, "ShaderNodeBsdfTransparent", 1000, -300)
        mix = _node(nt, "ShaderNodeMixShader", 1400, -100)
        nt.links.new(opacity, mix.inputs["Fac"])
        nt.links.new(clear.outputs[0], mix.inputs[1])
        nt.links.new(shader, mix.inputs[2])
        shader = mix.outputs[0]
    nt.links.new(shader, out.inputs["Surface"])


def build_materials(export):
    recipes = json.loads((export / "materials.json").read_text())
    tex_dir = export / "textures"
    done, missing = [], []
    for mat in bpy.data.materials:
        name = mat.name
        key = name if name in recipes else name.rsplit(".", 1)[0]
        recipe = recipes.get(key)
        if recipe is None:
            missing.append(name)
            continue
        build_material(mat, recipe, tex_dir)
        mat["na_recipe"] = key
        done.append(name)
    # a lamp body stays out of its own beam, as in the engine
    for obj in bpy.data.objects:
        if obj.type != "MESH":
            continue
        slots = [s.material for s in obj.material_slots if s.material]
        if slots and all(recipes.get(m.get("na_recipe", ""), {}).get("hideFromShadow") for m in slots):
            obj.visible_shadow = False
    return {"rebuilt": len(done), "unmatched": missing}


# ---------------------------------------------------------------- lights

def _orient(obj, forward, up=None):
    f = three_to_blender(forward).normalized()
    if up is None:
        obj.rotation_euler = f.to_track_quat("-Z", "Y").to_euler()
        return
    u = three_to_blender(up).normalized()
    z = -f
    x = u.cross(z).normalized()
    y = z.cross(x)
    obj.matrix_world = Matrix((x, y, z)).transposed().to_4x4() @ Matrix.Identity(4)


def _reach_window(light, reach):
    """three's distance window on a light: (1 - (d / reach)^4)^2, clamped"""
    light.use_nodes = True
    nt = light.node_tree
    nt.nodes.clear()
    out = _node(nt, "ShaderNodeOutputLight", 600, 0)
    em = _node(nt, "ShaderNodeEmission", 400, 0)
    lp = _node(nt, "ShaderNodeLightPath", -400, 0)
    q = _math(nt, "POWER", _math(nt, "DIVIDE", lp.outputs["Ray Length"], reach, -200, 0), 4.0, 0, 0)
    w = _math(nt, "POWER", _math(nt, "SUBTRACT", 1.0, q, 150, 0, clamp=True), 2.0, 300, 0)
    nt.links.new(w, em.inputs["Strength"])
    nt.links.new(em.outputs[0], out.inputs[0])


def build_lights(scene, export, fittings, reach_window):
    data = json.loads((export / "lights.json").read_text())
    coll = bpy.data.collections.new("Room lights (exported)")
    scene.collection.children.link(coll)
    made = []
    for spec in data["lights"]:
        c = spec["cycles"]
        if spec["kind"] == "point" and not fittings:
            continue
        light = bpy.data.lights.new(spec["name"].split("/")[-1], c["type"])
        light.energy = c["power_w"]
        light.color = spec["colour"]
        if spec["kind"] == "spot":
            light.spot_size = c["spot_size"]
            light.spot_blend = c["spot_blend"]
            light.shadow_soft_size = c["radius"]
            light.use_soft_falloff = False
            if reach_window:
                _reach_window(light, spec["falloff"]["reach"])
        elif spec["kind"] == "area":
            light.shape = "RECTANGLE"
            light.size = c["size"]
            light.size_y = c["size_y"]
            light.spread = c["spread"]
        else:
            light.shadow_soft_size = c.get("radius", 0.05)
            light.use_soft_falloff = False
        obj = bpy.data.objects.new(light.name, light)
        coll.objects.link(obj)
        if spec["kind"] == "area":
            _orient(obj, spec["forward"], spec["up"])
            # the window's own light: its glint on glossy surfaces stays, the
            # camera looks through it at the sky the engine shows
            obj.visible_camera = False
        elif spec["kind"] == "spot":
            _orient(obj, spec["direction"])
        if spec["kind"] in ("spot", "point"):
            # the engine never draws a light's own sphere; its lamp face is a mesh
            obj.visible_camera = False
        obj.location = three_to_blender(spec["position"])
        made.append({"name": obj.name, "kind": spec["kind"], "watts": c["power_w"]})
    return made


# ---------------------------------------------------------------- air, sky

def build_air(scene, export):
    air = json.loads((export / "air.json").read_text())
    lo = three_to_blender(air["box"]["min"])
    hi = three_to_blender(air["box"]["max"])
    mn = Vector((min(lo.x, hi.x), min(lo.y, hi.y), min(lo.z, hi.z)))
    mx = Vector((max(lo.x, hi.x), max(lo.y, hi.y), max(lo.z, hi.z)))
    bpy.ops.mesh.primitive_cube_add(size=1)
    obj = bpy.context.object
    obj.name = "hall air (exported)"
    obj.scale = mx - mn
    obj.location = (mn + mx) / 2
    mat = bpy.data.materials.new("hall air")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = _node(nt, "ShaderNodeOutputMaterial", 900, 0)
    geo = _node(nt, "ShaderNodeNewGeometry", -900, 0)
    sep = _node(nt, "ShaderNodeSeparateXYZ", -700, 100)
    nt.links.new(geo.outputs["Position"], sep.inputs[0])
    rng = _node(nt, "ShaderNodeMapRange", -500, 100)
    rng.interpolation_type = "SMOOTHSTEP"
    rng.inputs["From Min"].default_value = air["floor"]
    rng.inputs["From Max"].default_value = air["top"]
    nt.links.new(sep.outputs[2], rng.inputs["Value"])
    low = _math(nt, "ADD", _math(nt, "MULTIPLY", _math(nt, "SUBTRACT", 1.0, rng.outputs["Result"], -300, 100), air["low"][0], -150, 100), air["low"][1], 0, 100)
    nz = _node(nt, "ShaderNodeTexNoise", -500, -200)
    nz.inputs["Scale"].default_value = air["drift"]["frequency"]
    nz.inputs["Detail"].default_value = 0.0
    nt.links.new(geo.outputs["Position"], nz.inputs["Vector"])
    drift = _math(nt, "ADD", _math(nt, "MULTIPLY", _math(nt, "SUBTRACT", nz.outputs["Fac"], 0.5, -300, -200), 2 * air["drift"]["amount"], -150, -200), 1.0, 0, -200)
    density = _math(nt, "MULTIPLY", _math(nt, "MULTIPLY", low, drift, 200, 0), air["scattering_per_m"], 400, 0)
    vs = _node(nt, "ShaderNodeVolumeScatter", 650, 0)
    vs.inputs["Anisotropy"].default_value = 0.0
    nt.links.new(density, vs.inputs["Density"])
    nt.links.new(vs.outputs[0], out.inputs["Volume"])
    obj.data.materials.append(mat)
    obj.visible_shadow = False
    return obj


def keep_air_from(light_obj, air_obj):
    """light linking: this light lights everything but the air"""
    coll = bpy.data.collections.new(f"{light_obj.name} receivers")
    coll.objects.link(air_obj)
    light_obj.light_linking.receiver_collection = coll
    for entry in coll.collection_objects:
        entry.light_linking.link_state = "EXCLUDE"


def build_world(scene, export):
    world = bpy.data.worlds.new("the engine's sky, camera rays only")
    world.use_nodes = True
    nt = world.node_tree
    nt.nodes.clear()
    out = _node(nt, "ShaderNodeOutputWorld", 600, 0)
    env = nt.nodes.new("ShaderNodeTexEnvironment")
    env.location = (-200, 100)
    env.image = bpy.data.images.load(str(export / "sky.hdr"))
    env.image.colorspace_settings.name = "Linear Rec.709"
    bg = _node(nt, "ShaderNodeBackground", 100, 100, Strength=1.0)
    nt.links.new(env.outputs["Color"], bg.inputs["Color"])
    dark = _node(nt, "ShaderNodeBackground", 100, -100, Strength=0.0)
    lp = _node(nt, "ShaderNodeLightPath", 100, 300)
    mix = _node(nt, "ShaderNodeMixShader", 400, 0)
    nt.links.new(lp.outputs["Is Camera Ray"], mix.inputs["Fac"])
    nt.links.new(dark.outputs[0], mix.inputs[1])
    nt.links.new(bg.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs["Surface"])
    scene.world = world


# ---------------------------------------------------------------- the print

def print_frame(exr, png, dials, stop, frame=None):
    import numpy as np
    import OpenImageIO as oiio
    buf = oiio.ImageBuf(str(exr))
    px = buf.get_pixels(oiio.FLOAT)[..., :3]
    out = engine_print(px.astype(np.float64), dials, stop, frame)
    spec = oiio.ImageSpec(out.shape[1], out.shape[0], 3, oiio.UINT8)
    img = oiio.ImageBuf(spec)
    img.set_pixels(oiio.ROI(), (out * 255 + 0.5).astype(np.uint8))
    img.write(str(png))
    return {"mean": float(out.mean() * 255), "p1": float(np.percentile(out, 1) * 255), "p99": float(np.percentile(out, 99) * 255)}


# ---------------------------------------------------------------- main

def main():
    args = arguments(sys.argv[sys.argv.index("--") + 1:])
    started = time.perf_counter()
    sys.path.insert(0, str(args.rig_dir.resolve()))
    from import_room import import_room
    from cameras import load_poses, create_cameras, configure_camera_projection
    from render import select_device
    export = args.export.resolve()
    poses = load_poses(args.poses.resolve() if args.poses else export / "poses.json")
    dials = json.loads((export / "print.json").read_text())
    imported = import_room(export / "room.gltf")
    scene = bpy.context.scene
    for obj in scene.objects:
        if obj.type == "LIGHT":
            obj.hide_render = True
    report = {"blender": bpy.app.version_string, "export": str(export), "imported": {k: imported[k] for k in ("meshes", "bounding_box_gltf_m")}}
    report["materials"] = build_materials(export)
    if args.bevel or args.displace or args.grime:
        sys.path.insert(0, str(Path(__file__).resolve().parent))
        from tools import apply_tools
        report["tools"] = apply_tools(scene, export, args)
    report["lights"] = build_lights(scene, export, args.fittings, args.reach_window)
    if args.air:
        air = build_air(scene, export)
        for obj in scene.objects:
            if obj.type == "LIGHT" and obj.data.type == "AREA":
                keep_air_from(obj, air)
    build_world(scene, export)
    cameras = create_cameras(poses, scene=scene)
    if args.camera:
        cameras = [c for c in cameras if c.name in args.camera]
        if not cameras:
            raise ValueError(f"no pose among {args.camera}")
    scene.render.engine = "CYCLES"
    cy = scene.cycles
    cy.samples = args.samples
    cy.use_adaptive_sampling = args.adaptive > 0
    if args.adaptive > 0:
        cy.adaptive_threshold = args.adaptive
    cy.use_denoising = args.denoise
    cy.denoiser = "OPENIMAGEDENOISE"
    cy.seed = SEED
    cy.max_bounces, cy.diffuse_bounces, cy.glossy_bounces = BOUNCES["max"], BOUNCES["diffuse"], BOUNCES["glossy"]
    cy.transmission_bounces, cy.volume_bounces, cy.transparent_max_bounces = BOUNCES["transmission"], BOUNCES["volume"], BOUNCES["transparent"]
    scene.render.threads_mode = "FIXED"
    scene.render.threads = args.threads
    # THE SHOULDER AS A VIEW TRANSFORM: Blender's Khronos PBR Neutral at the
    # stop's exposure is the engine's print curve for anyone opening the scene.
    # The EXR stays scene-linear whatever the view (measured), and the PNG is
    # printed from it by stack/post.ts's own order (lift, saturation, vignette)
    scene.view_settings.view_transform = "Khronos PBR Neutral"
    scene.view_settings.look = "None"
    scene.render.image_settings.file_format = "OPEN_EXR"
    scene.render.image_settings.color_depth = "32"
    scene.render.image_settings.exr_codec = "ZIP"
    scene.render.use_compositing = False
    if args.border:
        scene.render.use_border = True
        scene.render.use_crop_to_border = True
        (scene.render.border_min_x, scene.render.border_min_y, scene.render.border_max_x, scene.render.border_max_y) = args.border
    scene.render.use_persistent_data = True
    report["device"] = select_device(scene, args.device)
    report["settings"] = {"samples": args.samples, "denoise": args.denoise, "adaptive": args.adaptive, "threads": args.threads, "bounces": BOUNCES,
                          "clamp_indirect": cy.sample_clamp_indirect, "air": args.air, "fittings": args.fittings, "reach_window": args.reach_window}
    if args.save_blend:
        bpy.ops.wm.save_as_mainfile(filepath=str(args.save_blend.resolve()))
    args.output.mkdir(parents=True, exist_ok=True)
    report["frames"] = []
    crops = json.loads(args.crops.read_text()) if args.crops else {}
    log = args.output / "render-log.json"
    for cam in cameras:
        pose = json.loads(cam["pose_json"])
        w = max(1, round(pose["stage"]["width"] * args.scale))
        h = max(1, round(pose["stage"]["height"] * args.scale))
        projection = configure_camera_projection(scene, cam, w, h)
        framing, stop = cam.name.split("/")
        dial_stop = args.print_stop or stop
        scene.view_settings.exposure = math.log2(dials["exposure"][dial_stop])
        exr = args.output / "linear" / framing / f"{stop}.exr"
        png = args.output / "stills" / "rooms" / framing / f"{stop}.png"
        exr.parent.mkdir(parents=True, exist_ok=True)
        png.parent.mkdir(parents=True, exist_ok=True)
        if not args.no_frame:
            scene.render.filepath = str(exr)
            t0 = time.perf_counter()
            bpy.ops.render.render(write_still=True)
            seconds = time.perf_counter() - t0
            stats = print_frame(exr, png, dials, dial_stop)
            report["frames"].append({"camera": cam.name, "width": w, "height": h, "seconds": round(seconds, 2), "png": str(png), "exr": str(exr),
                                     "print": stats, "vertical_fov": projection["vertical_fov"]})
            log.write_text(json.dumps(report, indent=1) + "\n")
            print(f"FRAME {cam.name} {w}x{h}: {seconds:.1f} s")
        # THE CROPS: boxes of the whole stage at full size, each its own border
        for k, (left, top, cw, ch) in enumerate(crops.get(cam.name, [])):
            fw, fh = pose["stage"]["width"], pose["stage"]["height"]
            configure_camera_projection(scene, cam, fw, fh)
            scene.render.use_border = True
            scene.render.use_crop_to_border = True
            scene.render.border_min_x, scene.render.border_max_x = left / fw, (left + cw) / fw
            scene.render.border_min_y, scene.render.border_max_y = 1 - (top + ch) / fh, 1 - top / fh
            cexr = args.output / "linear" / framing / f"{stop}-crop{k + 1}.exr"
            cpng = args.output / "crops" / framing / f"{stop}-crop{k + 1}.png"
            cpng.parent.mkdir(parents=True, exist_ok=True)
            scene.render.filepath = str(cexr)
            t0 = time.perf_counter()
            bpy.ops.render.render(write_still=True)
            seconds = time.perf_counter() - t0
            stats = print_frame(cexr, cpng, dials, dial_stop, (fw, fh, left, top))
            report.setdefault("crops", []).append({"camera": cam.name, "box": [left, top, cw, ch], "stage": [fw, fh], "seconds": round(seconds, 2), "png": str(cpng), "exr": str(cexr), "print": stats})
            log.write_text(json.dumps(report, indent=1) + "\n")
            print(f"CROP {cam.name} {k + 1} {cw}x{ch}: {seconds:.1f} s")
            scene.render.use_border = bool(args.border)
    report["total_seconds"] = round(time.perf_counter() - started, 1)
    log.write_text(json.dumps(report, indent=1) + "\n")


if __name__ == "__main__":
    main()
