"""The library set on a kit surface, and the record of what was used.

A set in the museum's library is three plates and a measurement: an albedo, a
normal, a packed surface map holding roughness, occlusion and height, and the
physical size of one tile in metres. This module builds one Blender material
per set, verified against the store's manifest before a single pixel is read:
a set whose bytes do not hash to their record, or which is not CC0 and
displayable, stops the build rather than reaching an atlas. What the material
adds to the plate is what a plate cannot carry: the piece's own tone out of
the mesh's colour attribute, a tint that puts the set in the period's colour,
and a fine grain the photograph is too coarse to hold at arm's length.

The occlusion channel of the set is deliberately dropped. Occlusion here is a
fact about THIS building, and the bake measures it from the geometry the kit
actually laid.
"""

import hashlib
import json
import math

import bpy

from . import paths

_manifest = None
_used = {}


def _index():
    global _manifest
    if _manifest is None:
        doc = json.loads((paths.library() / 'manifest.json').read_text())
        entries = doc if isinstance(doc, list) else doc['assets']
        _manifest = {e['id']: e for e in entries}
    return _manifest


def record(name):
    """the set's own manifest record, verified"""
    entry = _index().get(f'library/{name}')
    if not entry:
        raise SystemExit(f'no library set named {name}')
    if entry.get('class') != 'CC0' or not entry.get('display'):
        raise SystemExit(f'the set {name} may not be used: {entry.get("class")}')
    return entry


def plate(name, kind):
    """one file of a set, hashed against its record before it is opened"""
    entry = _index().get(f'library/{name}-{kind}')
    if not entry:
        raise SystemExit(f'the set {name} has no {kind} plate')
    file = paths.library() / entry['path']
    digest = hashlib.sha256(file.read_bytes()).hexdigest()
    if digest != entry['sha256']:
        raise SystemExit(f'{entry["path"]} does not hash to its record')
    _used[entry['id']] = entry
    return file


def used():
    """every library file this build read, for the receipt and the drawer"""
    return sorted(_used.values(), key=lambda e: e['id'])


def repeat(name):
    """how many metres one tile of the set covers"""
    entry = record(name)
    scale = entry.get('scale_m') or entry.get('metres') or [1.0, 1.0]
    return float(scale[0])


def _image(file, colour):
    image = bpy.data.images.load(str(file), check_existing=True)
    image.colorspace_settings.name = 'sRGB' if colour else 'Non-Color'
    return image


def surface(name, set_name, *, tint=(1, 1, 1), tint_amount=0.5, gain=1.0, roughness=None,
            metallic=0.0, grain=0.004, relief=0.55, sheen=0.0):
    """one material out of one library set.

    `tint` moves the photograph toward the colour the building is (a red brick
    plate does not have to stay the plate's own red) and `gain` moves it up or
    down the exposure. Both are needed and neither replaces the other: the CC0
    plates are photographs of real surfaces under real light, so a dark one
    (the clay tile set is a floor shot indoors) bakes to an albedo no daylight
    can lift. `grain` is the depth of the noise bump that carries the surface
    at hand distance, where a 2 K photograph over a metre has already run
    out."""
    entry = record(set_name)
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat['library_set'] = set_name
    mat['metallic'] = float(metallic)
    tree = mat.node_tree
    n, l = tree.nodes, tree.links
    n.clear()
    out = n.new('ShaderNodeOutputMaterial')
    bsdf = n.new('ShaderNodeBsdfPrincipled')
    l.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    bsdf.inputs['Metallic'].default_value = metallic
    if sheen and 'Sheen Weight' in bsdf.inputs:
        bsdf.inputs['Sheen Weight'].default_value = sheen

    uv = n.new('ShaderNodeUVMap')
    uv.uv_map = 'SurfaceUV'

    albedo = n.new('ShaderNodeTexImage')
    albedo.image = _image(plate(set_name, 'albedo'), True)
    l.new(uv.outputs['UV'], albedo.inputs['Vector'])
    mix = n.new('ShaderNodeMix')
    mix.data_type = 'RGBA'
    mix.blend_type = 'MULTIPLY'
    mix.inputs['Factor'].default_value = tint_amount
    l.new(albedo.outputs['Color'], mix.inputs[6])
    mix.inputs[7].default_value = (*tint, 1)
    lifted = mix
    if gain != 1.0:
        lift = n.new('ShaderNodeMix')
        lift.data_type = 'RGBA'
        lift.blend_type = 'MULTIPLY'
        lift.inputs['Factor'].default_value = 1.0
        l.new(mix.outputs[2], lift.inputs[6])
        lift.inputs[7].default_value = (gain, gain, gain, 1)
        lifted = lift
    tone = n.new('ShaderNodeVertexColor')
    tone.layer_name = 'Variation'
    shade = n.new('ShaderNodeMix')
    shade.data_type = 'RGBA'
    shade.blend_type = 'MULTIPLY'
    shade.inputs['Factor'].default_value = 1.0
    l.new(lifted.outputs[2], shade.inputs[6])
    l.new(tone.outputs['Color'], shade.inputs[7])
    l.new(shade.outputs[2], bsdf.inputs['Base Color'])

    normal = n.new('ShaderNodeTexImage')
    normal.image = _image(plate(set_name, 'normal'), False)
    l.new(uv.outputs['UV'], normal.inputs['Vector'])
    nm = n.new('ShaderNodeNormalMap')
    nm.uv_map = 'SurfaceUV'
    nm.inputs['Strength'].default_value = relief
    l.new(normal.outputs['Color'], nm.inputs['Color'])

    # the noise the plate cannot hold at hand distance, in metres of the object
    noise = n.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 240
    noise.inputs['Detail'].default_value = 4
    coords = n.new('ShaderNodeTexCoord')
    l.new(coords.outputs['Object'], noise.inputs['Vector'])
    bump = n.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.35
    bump.inputs['Distance'].default_value = grain
    l.new(noise.outputs['Fac'], bump.inputs['Height'])
    l.new(nm.outputs['Normal'], bump.inputs['Normal'])
    l.new(bump.outputs['Normal'], bsdf.inputs['Normal'])

    packed = entry.get('packed') or []
    measured = float(entry.get('measured', {}).get('roughness', 0.85))
    want = measured if roughness is None else roughness
    if 'roughness' in packed:
        surf = n.new('ShaderNodeTexImage')
        surf.image = _image(plate(set_name, 'surface'), False)
        l.new(uv.outputs['UV'], surf.inputs['Vector'])
        split = n.new('ShaderNodeSeparateColor')
        l.new(surf.outputs['Color'], split.inputs['Color'])
        # the plate's own variation about the roughness this building wants
        toward = n.new('ShaderNodeMapRange')
        toward.inputs['From Min'].default_value = 0.0
        toward.inputs['From Max'].default_value = 1.0
        toward.inputs['To Min'].default_value = max(0.05, want - 0.22)
        toward.inputs['To Max'].default_value = min(1.0, want + 0.22)
        l.new(split.outputs['Red'], toward.inputs['Value'])
        l.new(toward.outputs['Result'], bsdf.inputs['Roughness'])
    else:
        bsdf.inputs['Roughness'].default_value = want
    return mat


def flat(name, colour, roughness=0.9, metallic=0.0):
    """a surface with no library set behind it: an interior shadow field, a
    backing board, anything the visitor never stands close to"""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat['metallic'] = float(metallic)
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*colour, 1)
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metallic
    return mat


def repeats(names):
    """the physical tile size per material, in the order the object holds them"""
    return [repeat(n) if n else 1.0 for n in names]
