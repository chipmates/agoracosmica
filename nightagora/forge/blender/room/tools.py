"""BLENDER'S OWN SURFACE TOOLS on an exported room, switched on by cycles_room.py's
flags so the plain translation stays reproducible without them.

  --bevel      rounded edges: the Bevel shader node, its width by what the part is
               and, on a machine, by the part's own size (2 to 12 mm; 15 on walls)
  --displace   true displacement on adaptive subdivision from a set's own height
               (surface.png's displacement channel, written by heights.mjs), where
               the set carries one: the floor's concrete and the machines' timber
  --grime      cavity grime from Cycles' local occlusion and wear on the arrises
               (the bevel's turn of the normal), only on weathered sets; never on
               a part the machine's source makes new (the water screw's oak)

Nothing is added to the scene: no object, no word, no light. Every change is to
how an existing surface or edge is drawn, and each one is listed in the report.
"""
import json
import math
from pathlib import Path

import bmesh
import bpy

# the width of a rounded arris, metres, by what the surface is
FABRIC_BEVEL = {"walls": 0.015, "overhead": 0.012, "backing": 0.006, "plinths": 0.010, "slats": 0.003}
CONSTRUCTION_BEVEL = 0.010
FIXTURE_BEVEL = 0.003
# a machine part: a share of its smallest extent, held between the two widths
MACHINE_BEVEL = (0.04, 0.002, 0.012)
BEVEL_SAMPLES = 4

# peak-to-peak relief of a set's height map in metres, at the engine's full
# normal strength for that set; a calmer variant takes its share of it
RELIEF = {"concrete-floor-polished": 0.0015, "oak-beams": 0.004}
# the set's own normal scale in the export at full strength (2 x the recipe)
FULL_NORMAL = {"concrete-floor-polished": 0.6, "oak-beams": 1.6}
DICING_RATE = 1.0
# the finest a patch is cut (2^8 a side) and how much coarser what the camera
# does not see is cut: without both a floor bay can be diced to millions
MAX_SUBDIVISIONS = 8
OFFSCREEN_DICING = 8.0

# sets whose photograph is weathered: grime in the hollows, wear on the arrises
WEATHERED = {"oak-beams": {"grime": 0.35, "wear": 0.30, "polish": 0.0},
             "iron-forged": {"grime": 0.30, "wear": 0.0, "polish": 0.18},
             "bronze-dark": {"grime": 0.25, "wear": 0.0, "polish": 0.0},
             "limestone-pale": {"grime": 0.25, "wear": 0.0, "polish": 0.0}}
# a machine whose source says its material is new work: no wear, no grime
NEW_WORK = {"water-lifting-screw"}
GRIME_DISTANCE = 0.12
GRIME_SAMPLES = 8


def _recipe_of(mat, recipes):
    key = mat.get("na_recipe")
    return key, (recipes.get(key) if key else None)


def _principled(nt):
    for n in nt.nodes:
        if n.bl_idname == "ShaderNodeBsdfPrincipled":
            return n
    return None


def _output(nt):
    for n in nt.nodes:
        if n.bl_idname == "ShaderNodeOutputMaterial":
            return n
    return None


def _albedo_image(nt):
    """the node that samples the set's photograph: its vector and projection are
    the ones every other map of the set must follow"""
    for n in nt.nodes:
        if n.bl_idname == "ShaderNodeTexImage" and n.image and n.image.colorspace_settings.name == "sRGB":
            return n
    return None


def _linked_from(socket):
    return socket.links[0].from_socket if socket.is_linked else None


def _part_kind(name):
    parts = name.split(":")
    return parts[0] if len(parts) >= 3 else None


# ------------------------------------------------------------------ bevel

def bevel_width(obj, recipe, mat_name):
    fam = recipe.get("family")
    if fam == "fabric":
        return FABRIC_BEVEL.get(mat_name.rsplit("/", 1)[-1].split(".")[0])
    if fam == "construction":
        return CONSTRUCTION_BEVEL
    if fam == "fixture":
        return FIXTURE_BEVEL
    if fam == "machine":
        if recipe.get("cloth") or recipe.get("kind") != "pbr":
            return None
        share, lo, hi = MACHINE_BEVEL
        dims = [d for d in obj.dimensions if d > 1e-4]
        if not dims:
            return None
        return max(lo, min(hi, share * min(dims)))
    return None


def add_bevel(mat, stats):
    nt = mat.node_tree
    bsdf = _principled(nt)
    if bsdf is None:
        return None
    attr = nt.nodes.new("ShaderNodeAttribute")
    attr.attribute_type = "OBJECT"
    attr.attribute_name = "na_bevel"
    attr.location = (bsdf.location.x - 700, bsdf.location.y - 900)
    bev = nt.nodes.new("ShaderNodeBevel")
    bev.samples = BEVEL_SAMPLES
    bev.location = (bsdf.location.x - 350, bsdf.location.y - 800)
    nt.links.new(attr.outputs["Fac"], bev.inputs["Radius"])
    upstream = _linked_from(bsdf.inputs["Normal"])
    if upstream is not None:
        nt.links.new(upstream, bev.inputs["Normal"])
    nt.links.new(bev.outputs["Normal"], bsdf.inputs["Normal"])
    stats["bevelled_materials"] += 1
    return bev


# ------------------------------------------------------------------ grime and wear

def add_grime(mat, recipe, bevel, stats):
    """darken the hollows by the local occlusion, lighten and polish the arrises
    by how far the bevel turns the normal there, outside the hollows only"""
    s = recipe.get("set")
    set_name = s.get("set") if isinstance(s, dict) else s
    w = WEATHERED.get(set_name)
    if not w:
        return False
    nt = mat.node_tree
    bsdf = _principled(nt)
    base = _linked_from(bsdf.inputs["Base Color"])
    x, y = bsdf.location.x - 600, bsdf.location.y + 500
    ao = nt.nodes.new("ShaderNodeAmbientOcclusion")
    ao.samples = GRIME_SAMPLES
    ao.only_local = True
    ao.inside = False
    ao.location = (x - 600, y)
    ao.inputs["Distance"].default_value = GRIME_DISTANCE

    def math_node(op, a, b=None, clamp=False, at=(0, 0)):
        n = nt.nodes.new("ShaderNodeMath")
        n.operation = op
        n.use_clamp = clamp
        n.location = at
        for i, v in enumerate((a, b)):
            if v is None:
                continue
            if isinstance(v, (int, float)):
                n.inputs[i].default_value = v
            else:
                nt.links.new(v, n.inputs[i])
        return n.outputs[0]

    def smooth(v, lo, hi, at):
        m = nt.nodes.new("ShaderNodeMapRange")
        m.interpolation_type = "SMOOTHSTEP"
        m.location = at
        m.inputs["From Min"].default_value = lo
        m.inputs["From Max"].default_value = hi
        nt.links.new(v, m.inputs["Value"])
        return m.outputs["Result"]

    open_ = ao.outputs["AO"]
    cavity = smooth(math_node("SUBTRACT", 1.0, open_, at=(x - 400, y)), 0.15, 0.85, (x - 250, y))
    wear = None
    if bevel is not None and (w["wear"] > 0 or w["polish"] > 0):
        # the bevel's own turn: its normal against the one it was handed (the
        # photograph's relief where there is one), so relief alone is no arris
        handed = _linked_from(bevel.inputs["Normal"])
        if handed is None:
            geo = nt.nodes.new("ShaderNodeNewGeometry")
            geo.location = (x - 600, y - 250)
            handed = geo.outputs["Normal"]
        dot = nt.nodes.new("ShaderNodeVectorMath")
        dot.operation = "DOT_PRODUCT"
        dot.location = (x - 400, y - 250)
        nt.links.new(bevel.outputs["Normal"], dot.inputs[0])
        nt.links.new(handed, dot.inputs[1])
        turn = math_node("SUBTRACT", 1.0, dot.outputs["Value"], at=(x - 250, y - 250))
        edge = smooth(turn, 0.01, 0.10, (x - 100, y - 250))
        wear = math_node("MULTIPLY", edge, open_, at=(x + 50, y - 250))
    if base is not None:
        k = math_node("SUBTRACT", 1.0, math_node("MULTIPLY", cavity, w["grime"], at=(x - 100, y + 120)), at=(x + 50, y + 120))
        if wear is not None and w["wear"] > 0:
            k = math_node("MULTIPLY", k, math_node("ADD", 1.0, math_node("MULTIPLY", wear, w["wear"], at=(x + 200, y - 100)), at=(x + 350, y - 100)), at=(x + 500, y + 50))
        mix = nt.nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        mix.blend_type = "MULTIPLY"
        mix.location = (x + 650, y + 100)
        mix.inputs["Factor"].default_value = 1.0
        nt.links.new(base, mix.inputs["A"])
        comb = nt.nodes.new("ShaderNodeCombineColor")
        comb.location = (x + 500, y + 200)
        for i in range(3):
            nt.links.new(k, comb.inputs[i])
        nt.links.new(comb.outputs[0], mix.inputs["B"])
        nt.links.new(mix.outputs["Result"], bsdf.inputs["Base Color"])
    rough = _linked_from(bsdf.inputs["Roughness"])
    r = rough if rough is not None else bsdf.inputs["Roughness"].default_value
    r = math_node("ADD", r, math_node("MULTIPLY", cavity, 0.08, at=(x + 200, y - 350)), at=(x + 350, y - 350))
    if wear is not None and w["polish"] > 0:
        r = math_node("SUBTRACT", r, math_node("MULTIPLY", wear, w["polish"], at=(x + 500, y - 450)), at=(x + 650, y - 400))
    r = math_node("MAXIMUM", r, 0.05, at=(x + 800, y - 400))
    r = math_node("MINIMUM", r, 1.0, at=(x + 950, y - 400))
    nt.links.new(r, bsdf.inputs["Roughness"])
    stats["grimed_materials"] += 1
    return True


# ------------------------------------------------------------------ displacement

def _adaptive(obj, scene, rate, stats):
    """a Simple subdivision diced for the camera, by the pixel (a displaced
    mesh is made single-user first: Cycles dices a shared mesh once, in its
    own space, for all its users)"""
    mod = obj.modifiers.new("na-dice", "SUBSURF")
    mod.subdivision_type = "SIMPLE"
    mod.levels = 0
    mod.render_levels = 1
    for owner, prop in ((mod, "use_adaptive_subdivision"), (getattr(obj, "cycles", None), "use_adaptive_subdivision")):
        if owner is not None and hasattr(owner, prop):
            setattr(owner, prop, True)
            stats["adaptive_via"] = f"{type(owner).__name__}.{prop}"
            if hasattr(mod, "adaptive_space"):
                mod.adaptive_space = "PIXEL"
            if hasattr(mod, "adaptive_pixel_size"):
                mod.adaptive_pixel_size = rate
            stats["dicing"][obj.name] = "pixel %.1f" % rate
            return True
    obj.modifiers.remove(mod)
    stats["adaptive_via"] = "none found"
    return False


def _weld(mesh, cache):
    """one surface out of the exporter's split corners, so a displaced edge is
    shared by both its faces and cannot open"""
    if mesh.name in cache:
        return
    bm = bmesh.new()
    bm.from_mesh(mesh)
    before = len(bm.verts)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bm.to_mesh(mesh)
    bm.free()
    # smooth faces: the diced surface takes its normals from the displaced
    # micro-facets, so a face stays flat and its arris turns over one facet
    for p in mesh.polygons:
        p.use_smooth = True
    cache[mesh.name] = (before, len(mesh.vertices))


def add_displacement(mat, recipe, heights, tex_dir, relief_scale, stats):
    s = recipe.get("set")
    set_name = s.get("set") if isinstance(s, dict) else s
    h = heights.get(set_name)
    if not h or set_name not in RELIEF:
        return False
    nt = mat.node_tree
    out = _output(nt)
    albedo = _albedo_image(nt)
    if out is None or albedo is None:
        return False
    img = nt.nodes.new("ShaderNodeTexImage")
    img.image = bpy.data.images.load(str(tex_dir / h["file"]), check_existing=True)
    img.image.colorspace_settings.name = "Non-Color"
    img.interpolation = "Cubic"
    img.extension = "REPEAT"
    img.projection = albedo.projection
    img.projection_blend = albedo.projection_blend
    img.location = (albedo.location.x, albedo.location.y - 1400)
    vec = _linked_from(albedo.inputs["Vector"])
    if vec is not None:
        nt.links.new(vec, img.inputs["Vector"])
    span = max(1e-3, h["max"] - h["min"])
    relief = RELIEF[set_name] * relief_scale
    disp = nt.nodes.new("ShaderNodeDisplacement")
    disp.space = "OBJECT"
    disp.location = (out.location.x - 250, out.location.y - 400)
    disp.inputs["Midlevel"].default_value = h["mean"]
    disp.inputs["Scale"].default_value = relief / span
    height = img.outputs["Color"]
    bays = (recipe.get("tone") or {}).get("bays")
    if bays:
        # the bays are cut apart: the relief fades to the modelled plane at
        # every saw cut, so no two bays part at their joint
        geo = nt.nodes.new("ShaderNodeNewGeometry")
        sep = nt.nodes.new("ShaderNodeSeparateXYZ")
        nt.links.new(geo.outputs["Position"], sep.inputs[0])
        fade = None
        for axis, origin, period in ((0, bays["originEast"], bays["east"]), (1, bays["originNorth"], bays["north"])):
            m = nt.nodes.new("ShaderNodeMath"); m.operation = "SUBTRACT"
            nt.links.new(sep.outputs[axis], m.inputs[0]); m.inputs[1].default_value = origin
            d = nt.nodes.new("ShaderNodeMath"); d.operation = "DIVIDE"
            nt.links.new(m.outputs[0], d.inputs[0]); d.inputs[1].default_value = period
            f = nt.nodes.new("ShaderNodeMath"); f.operation = "FRACT"
            nt.links.new(d.outputs[0], f.inputs[0])
            g = nt.nodes.new("ShaderNodeMath"); g.operation = "SUBTRACT"
            g.inputs[0].default_value = 1.0; nt.links.new(f.outputs[0], g.inputs[1])
            mn = nt.nodes.new("ShaderNodeMath"); mn.operation = "MINIMUM"
            nt.links.new(f.outputs[0], mn.inputs[0]); nt.links.new(g.outputs[0], mn.inputs[1])
            metres = nt.nodes.new("ShaderNodeMath"); metres.operation = "MULTIPLY"
            nt.links.new(mn.outputs[0], metres.inputs[0]); metres.inputs[1].default_value = period
            ramp = nt.nodes.new("ShaderNodeMapRange"); ramp.interpolation_type = "SMOOTHSTEP"
            ramp.inputs["From Min"].default_value = 0.004; ramp.inputs["From Max"].default_value = 0.02
            nt.links.new(metres.outputs[0], ramp.inputs["Value"])
            if fade is None:
                fade = ramp.outputs["Result"]
            else:
                both = nt.nodes.new("ShaderNodeMath"); both.operation = "MINIMUM"
                nt.links.new(fade, both.inputs[0]); nt.links.new(ramp.outputs["Result"], both.inputs[1])
                fade = both.outputs[0]
        # height' = mid + (height - mid) x fade
        dh = nt.nodes.new("ShaderNodeMath"); dh.operation = "SUBTRACT"
        nt.links.new(img.outputs["Color"], dh.inputs[0]); dh.inputs[1].default_value = h["mean"]
        mul = nt.nodes.new("ShaderNodeMath"); mul.operation = "MULTIPLY"
        nt.links.new(dh.outputs[0], mul.inputs[0]); nt.links.new(fade, mul.inputs[1])
        add = nt.nodes.new("ShaderNodeMath"); add.operation = "ADD"
        nt.links.new(mul.outputs[0], add.inputs[0]); add.inputs[1].default_value = h["mean"]
        height = add.outputs[0]
    nt.links.new(height, disp.inputs["Height"])
    nt.links.new(disp.outputs["Displacement"], out.inputs["Displacement"])
    mat.displacement_method = "DISPLACEMENT"
    stats["displaced_materials"].append({"material": mat.name, "set": set_name, "relief_mm": round(relief * 1000, 3), "midlevel": round(h["mean"], 4)})
    return True


# ------------------------------------------------------------------ main

def apply_tools(scene, export, args):
    recipes = json.loads((export / "materials.json").read_text())
    tex_dir = export / "textures"
    heights = {}
    if args.displace:
        hfile = export / "heights.json"
        if not hfile.exists():
            raise FileNotFoundError(f"{hfile}: run heights.mjs on the export first")
        heights = {k: v for k, v in json.loads(hfile.read_text())["sets"].items() if v}
    kinds = set((args.displace or "").split(",")) if isinstance(args.displace, str) else {"floor", "timber"}
    stats = {"bevelled_materials": 0, "bevelled_objects": 0, "grimed_materials": 0, "displaced_materials": [], "displaced_objects": 0,
             "welded": {}, "adaptive_via": None, "dicing": {}, "bevel_widths_mm": {}, "skipped_new_work": []}
    bevels = {}
    displaced = set()
    for mat in bpy.data.materials:
        key, recipe = _recipe_of(mat, recipes)
        if recipe is None or not mat.use_nodes:
            continue
        slug = _part_kind(key)
        bev = None
        if args.bevel and recipe.get("family") in ("fabric", "construction", "fixture", "machine") and not recipe.get("cloth") \
                and recipe.get("kind") == "pbr" and not key.endswith("/floor"):
            bev = add_bevel(mat, stats)
            bevels[mat.name] = bev
        if args.grime and recipe.get("family") == "machine":
            if slug in NEW_WORK:
                stats["skipped_new_work"].append(key)
            else:
                add_grime(mat, recipe, bev, stats)
        if args.displace:
            kind = "floor" if key.endswith("/floor") and recipe.get("family") == "fabric" else \
                "timber" if recipe.get("family") == "machine" and (recipe.get("uv") or {}).get("mode") != "box" else None
            if kind in kinds:
                set_name = recipe["set"]["set"] if isinstance(recipe.get("set"), dict) else recipe.get("set")
                scale = 1.0
                if set_name in FULL_NORMAL and recipe.get("normalScale"):
                    scale = min(1.0, recipe["normalScale"] / FULL_NORMAL[set_name])
                if add_displacement(mat, recipe, heights, tex_dir, scale, stats):
                    displaced.add(mat.name)
    welded = {}
    for obj in scene.objects:
        if obj.type != "MESH":
            continue
        names = [s.material.name for s in obj.material_slots if s.material]
        if args.bevel and any(n in bevels for n in names):
            key, recipe = _recipe_of(bpy.data.materials[names[0]], recipes)
            width = bevel_width(obj, recipe, key) if recipe else None
            if width:
                obj["na_bevel"] = width
                stats["bevelled_objects"] += 1
                stats["bevel_widths_mm"][obj.name] = round(width * 1000, 2)
        if args.displace and any(n in displaced for n in names):
            key, recipe = _recipe_of(bpy.data.materials[names[0]], recipes)
            if obj.data.users > 1:
                obj.data = obj.data.copy()
                stats["made_single_user"] = stats.get("made_single_user", 0) + 1
            if recipe and recipe.get("family") == "machine":
                _weld(obj.data, welded)
            if _adaptive(obj, scene, args.dicing_rate, stats):
                stats["displaced_objects"] += 1
    stats["welded"] = {k: {"vertices_before": v[0], "after": v[1]} for k, v in welded.items()}
    if args.displace:
        scene.cycles.dicing_rate = args.dicing_rate
        scene.cycles.offscreen_dicing_scale = OFFSCREEN_DICING
        scene.cycles.max_subdivisions = MAX_SUBDIVISIONS
        if hasattr(scene.cycles, "feature_set") and stats["adaptive_via"] and stats["adaptive_via"].startswith("CyclesObjectSettings"):
            scene.cycles.feature_set = "EXPERIMENTAL"
    stats["settings"] = {"bevel_samples": BEVEL_SAMPLES, "fabric_bevel_m": FABRIC_BEVEL, "machine_bevel": MACHINE_BEVEL,
                         "relief_m": RELIEF, "dicing_rate_px": args.dicing_rate if args.displace else None,
                         "max_subdivisions": MAX_SUBDIVISIONS, "offscreen_dicing": OFFSCREEN_DICING,
                         "grime": WEATHERED if args.grime else None, "grime_distance_m": GRIME_DISTANCE, "new_work": sorted(NEW_WORK)}
    return stats
