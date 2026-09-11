"""The common bake: what every object built with this kit goes through between
the last kit call and the export.

Six passes, into one atlas per part, at three sizes for the three tiers.
Albedo, roughness and a metal mask are surface facts read straight off the
materials. The normal is baked from a HIGH poly onto the LOW one, so the arris
the export cannot afford in triangles is carried in the map. Occlusion and
curvature are geometry: how much of the sky a point can see, and whether it
sits on an edge or in a hollow. The curvature then does one job in the
compositing below, which is to lift the albedo where a corner is rubbed and
drop it into the joints, because that is where a real wall is worn.

THERE IS NO LIGHT IN THIS SCENE. Not a sun, not a lamp, not a sky with an
hour in it. That is not an oversight and it is not a taste: a baked light
crossing into the museum would be a second hour standing in a room that
already has one, so the bake scene has nothing that could cast. Occlusion is
a visibility ratio measured off the geometry, it travels in the ORM texture
where glTF puts occlusion, and the loader gives it to the ambient term only.
The one place a lamp is allowed is `preview`, which renders a picture for the
seat to look at and never writes an atlas.
"""

import json
import math
import time

import bpy

from .mesh import select

PASSES = ('albedo', 'normal', 'roughness', 'ao', 'curvature', 'metal')


def log(*words):
    print('KIT', *words, flush=True)


def gpu(samples=96):
    """Cycles on the Metal GPU. The first run of a session compiles kernels."""
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'METAL'
    prefs.get_devices()
    for device in prefs.devices:
        device.use = device.type == 'METAL'
    scene.cycles.device = 'GPU'
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.render.bake.margin = 12
    scene.render.bake.use_clear = True
    log('metal', [d.name for d in prefs.devices if d.use], 'samples', samples)


def measure_world(strength=1.0):
    """a plain white dome, which is what an occlusion ratio is measured
    against. It carries no hour: there is nothing in it to cast a shadow."""
    world = bpy.data.worlds.get('Occlusion measure') or bpy.data.worlds.new('Occlusion measure')
    world.use_nodes = True
    background = world.node_tree.nodes.get('Background')
    background.inputs['Color'].default_value = (1, 1, 1, 1)
    background.inputs['Strength'].default_value = strength
    bpy.context.scene.world = world
    return world


def atlas_uv(obj, *, angle=89.0, margin=0.0004, priority=None):
    """one packed atlas layer beside the library's own metre scale layer.

    Two settings decide whether an atlas is usable, and both were measured
    rather than guessed on a building of eighteen thousand separate bricks.
    The angle limit has to be high enough that a brick's face and its splayed
    arris stay ONE island: at sixty six degrees they split into three and the
    packer spends the sheet on margins. And the margin has to be added in flat
    uv units, not scaled per island: with the scaled method the same wall
    packs at one per cent of the sheet and the atlas comes out black.

    `priority` is the answer to the other half of the problem, which is that a
    lime bed hidden behind its own bricks has no business holding a quarter of
    the sheet. It maps a material index to how much texel density that
    material is worth, and it is applied per face, so it is for the flat
    pieces (a bed, a floor, the back of a nesting cell) and not for anything
    whose island has a skirt on it."""
    select([obj])
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(angle), island_margin=0.0,
                             area_weight=1.0, correct_aspect=True)
    bpy.ops.uv.select_all(action='SELECT')
    bpy.ops.uv.average_islands_scale()
    bpy.ops.object.mode_set(mode='OBJECT')
    if priority:
        layer = obj.data.uv_layers.active
        for polygon in obj.data.polygons:
            scale = priority.get(polygon.material_index, 1.0)
            if scale == 1.0:
                continue
            loops = list(polygon.loop_indices)
            mid_u = sum(layer.data[li].uv[0] for li in loops) / len(loops)
            mid_v = sum(layer.data[li].uv[1] for li in loops) / len(loops)
            for li in loops:
                u, v = layer.data[li].uv
                layer.data[li].uv = (mid_u + (u - mid_u) * scale, mid_v + (v - mid_v) * scale)
        select([obj])
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.uv.select_all(action='SELECT')
    else:
        select([obj])
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.uv.select_all(action='SELECT')
    bpy.ops.uv.pack_islands(margin=margin, margin_method='ADD', rotate=True, scale=True,
                            shape_method='AABB')
    bpy.ops.object.mode_set(mode='OBJECT')
    obj.data.uv_layers.active.name = 'AtlasUV'
    obj.data.uv_layers['AtlasUV'].active_render = True
    log('atlas uv', obj.name, len(obj.data.polygons), 'faces', f'{texel_density(obj):.0f} texels/m at 4k')
    return obj


def texel_density(obj, side=4096, layer='AtlasUV'):
    """what the atlas actually delivers, measured off the uv against the
    world area it covers. A number the manifest carries and the loader reads:
    under four hundred the museum lays its own library band over the body."""
    uv = obj.data.uv_layers[layer]
    covered = 0.0
    world = 0.0
    for polygon in obj.data.polygons:
        points = [uv.data[li].uv for li in polygon.loop_indices]
        area = 0.0
        for i, point in enumerate(points):
            other = points[(i + 1) % len(points)]
            area += point[0] * other[1] - other[0] * point[1]
        covered += abs(area) / 2
        world += polygon.area
    return side * math.sqrt(covered / world) if world else 0.0


def high_poly(obj, *, bevel=0.005, segments=3, angle=52.0):
    """the same body with a rounder arris, for the normal and the curvature.

    A brick in the export has one splayed edge because ten triangles is what a
    brick may cost. The high poly has three, and the difference between the
    two is exactly what a tangent space normal map is for."""
    high = obj.copy()
    high.data = obj.data.copy()
    high.name = obj.name + ' high'
    bpy.context.collection.objects.link(high)
    select([high])
    modifier = high.modifiers.new('Arris', 'BEVEL')
    modifier.width = bevel
    modifier.segments = segments
    modifier.limit_method = 'ANGLE'
    modifier.angle_limit = math.radians(angle)
    modifier.harden_normals = False
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    high.hide_render = False
    return high


def _image(name, size):
    old = bpy.data.images.get(name)
    if old:
        bpy.data.images.remove(old)
    image = bpy.data.images.new(name, width=size, height=size, alpha=False, float_buffer=True)
    image.colorspace_settings.name = 'Non-Color'
    return image


def _target(obj, image):
    for slot in obj.material_slots:
        material = slot.material
        if not material:
            continue
        nodes = material.node_tree.nodes
        old = nodes.get('BAKE TARGET')
        if old:
            nodes.remove(old)
        node = nodes.new('ShaderNodeTexImage')
        node.name = 'BAKE TARGET'
        node.image = image
        nodes.active = node
    layers = obj.data.uv_layers
    layers.active_index = layers.find('AtlasUV')
    layers['AtlasUV'].active_render = True


def _emission(materials, value_of):
    """swap every material to an emission-only reading, and hand back the way
    to put them all back. This is how a fact that is not a light (a metal
    flag, a curvature) is measured with a light transport engine."""
    saved = []
    for material in materials:
        nodes = material.node_tree.nodes
        bsdf = next((n for n in nodes if n.type == 'BSDF_PRINCIPLED'), None)
        if not bsdf:
            continue
        colour = tuple(bsdf.inputs['Emission Color'].default_value)
        strength = bsdf.inputs['Emission Strength'].default_value
        links = [l for l in material.node_tree.links
                 if l.to_node == bsdf and l.to_socket.name == 'Emission Color']
        saved.append((material, bsdf, colour, strength, [(l.from_socket, l.to_socket) for l in links]))
        for link in links:
            material.node_tree.links.remove(link)
        value_of(material, bsdf, nodes, material.node_tree.links)
        bsdf.inputs['Emission Strength'].default_value = 1.0

    def restore():
        for material, bsdf, colour, strength, links in saved:
            for node in list(material.node_tree.nodes):
                if node.name.startswith('MEASURE '):
                    material.node_tree.nodes.remove(node)
            bsdf.inputs['Emission Color'].default_value = colour
            bsdf.inputs['Emission Strength'].default_value = strength
            for from_socket, to_socket in links:
                material.node_tree.links.new(from_socket, to_socket)

    return restore


def _materials_of(obj):
    return [s.material for s in obj.material_slots if s.material]


def _read(image):
    """the image's own float buffer, as (pixels, 4)"""
    import numpy as np
    out = np.empty(len(image.pixels), dtype=np.float32)
    image.pixels.foreach_get(out)
    return out.reshape(-1, 4)


def _write(pixels, size, path, colour):
    """one PNG at one size, through a fresh image.

    A generated image reloads its own buffer whenever its colour space is
    touched, so a bake is never scaled in place and never re-tagged in place:
    every file is written through an image made for it and thrown away."""
    import numpy as np
    if float(pixels[:, 0].max()) <= 0.0005:
        raise SystemExit(f'empty bake: {path.name}')
    image = bpy.data.images.new(f'write {path.stem} {size}', width=size, height=size,
                                alpha=False, float_buffer=True)
    image.colorspace_settings.name = 'sRGB' if colour else 'Non-Color'
    flat = np.ones((size * size, 4), dtype=np.float32)
    flat[:, :3] = pixels[:, :3]
    image.pixels.foreach_set(flat.ravel())
    scene = bpy.context.scene
    settings = scene.render.image_settings
    settings.file_format = 'PNG'
    settings.color_mode = 'RGB'
    settings.color_depth = '8'
    settings.compression = 70
    scene.view_settings.view_transform = 'Standard' if colour else 'Raw'
    scene.view_settings.look = 'None'
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save_render(str(path), scene=scene)
    bpy.data.images.remove(image)
    return path


def _halved(pixels, size):
    """one mip step, in a box filter: the calm tier's atlas is the hero tier's
    atlas resampled, which is what a tier is allowed to be"""
    import numpy as np
    grid = pixels.reshape(size, size, 4)
    return grid.reshape(size // 2, 2, size // 2, 2, 4).mean(axis=(1, 3)).reshape(-1, 4)


def _write_tiers(pixels, folder, name, sizes, colour):
    """the same atlas at the sizes the three tiers hold"""
    written = {}
    # the source's own side, so a single small tier still resamples from the
    # full bake rather than writing it out at the wrong size
    current, at = pixels, int(round(len(pixels) ** 0.5))
    for size in sorted(sizes, reverse=True):
        while at > size:
            current = _halved(current, at)
            at //= 2
        written[size] = _write(current, size, folder / str(size) / name, colour)
    return written


def atlases(parts, *, folder, sizes=(4096, 2048, 1024), samples=96, wear=0.10,
            bevel=0.005, cage=0.012, ray=0.05):
    """every pass, for every part, at every size. Returns what was written."""
    import numpy as np
    scene = bpy.context.scene
    gpu(samples)
    measure_world()
    written = {}
    for name, obj in parts.items():
        began = time.time()
        maps = {}
        high = high_poly(obj, bevel=bevel)
        size = max(sizes)
        bake = scene.render.bake

        def run(kind, pass_type, from_high=False, spp=None, prepare=None):
            image = _image(f'{name}_{kind}', size)
            _target(obj, image)
            scene.cycles.samples = spp or samples
            bake.use_selected_to_active = from_high
            bake.cage_extrusion = cage
            bake.max_ray_distance = ray
            undo = prepare() if prepare else None
            # THE HIGH POLY STANDS INSIDE THE LOW ONE. A direct pass with it
            # in the scene measures the occlusion of a body buried in itself,
            # which is how an occlusion atlas comes out black.
            high.hide_render = not from_high
            if from_high:
                select([high, obj], active=obj)
            else:
                select([obj])
            log('bake', name, kind, 'from high' if from_high else 'direct')
            bpy.ops.object.bake(type=pass_type)
            if undo:
                undo()
            return image

        bake.use_pass_direct = False
        bake.use_pass_indirect = False
        bake.use_pass_color = True
        albedo = run('albedo', 'DIFFUSE', spp=4)
        rough = run('roughness', 'ROUGHNESS', spp=4)
        normal = run('normal', 'NORMAL', from_high=True, spp=4)
        occlusion = run('ao', 'AO')

        def pointiness():
            def wire(material, bsdf, nodes, links):
                geometry = nodes.new('ShaderNodeNewGeometry')
                geometry.name = 'MEASURE geometry'
                ramp = nodes.new('ShaderNodeMapRange')
                ramp.name = 'MEASURE range'
                ramp.inputs['From Min'].default_value = 0.42
                ramp.inputs['From Max'].default_value = 0.62
                links.new(geometry.outputs['Pointiness'], ramp.inputs['Value'])
                links.new(ramp.outputs['Result'], bsdf.inputs['Emission Color'])
            return _emission(_materials_of(high), wire)

        curvature = run('curvature', 'EMIT', from_high=True, spp=4, prepare=pointiness)

        def metallic():
            def wire(material, bsdf, nodes, links):
                value = float(material.get('metallic', 0.0))
                bsdf.inputs['Emission Color'].default_value = (value, value, value, 1)
            return _emission(_materials_of(obj), wire)

        metal = run('metal', 'EMIT', spp=1, prepare=metallic)

        # the compositing, in numpy: what curvature does to colour and to
        # roughness, and the three channels glTF wants in one texture
        curve = _read(curvature)[:, 0]
        edge = np.clip((curve - 0.5) * 2.0, -1.0, 1.0)
        colour = _read(albedo)
        colour[:, :3] *= (1.0 + wear * edge)[:, None]
        np.clip(colour, 0.0, 1.0, out=colour)

        roughness = _read(rough)[:, 0]
        roughness = np.clip(roughness - 0.14 * np.maximum(edge, 0.0)
                            + 0.06 * np.maximum(-edge, 0.0), 0.04, 1.0)
        packed = np.ones((len(roughness), 4), dtype=np.float32)
        packed[:, 0] = _read(occlusion)[:, 0]
        packed[:, 1] = roughness
        packed[:, 2] = _read(metal)[:, 0]

        maps['albedo'] = _write_tiers(colour, folder, f'{name}-albedo.png', sizes, True)
        maps['normal'] = _write_tiers(_read(normal), folder, f'{name}-normal.png', sizes, False)
        maps['orm'] = _write_tiers(packed, folder, f'{name}-orm.png', sizes, False)
        maps['curvature'] = _write_tiers(_read(curvature), folder, f'{name}-curvature.png',
                                         [min(sizes)], False)
        for image in (albedo, normal, rough, occlusion, metal, curvature):
            bpy.data.images.remove(image)
        bpy.data.objects.remove(high, do_unlink=True)
        written[name] = maps
        log('baked', name, f'{time.time() - began:.0f}s')
    return written


def atlas_material(name, folder, size, *, part):
    """what the export ships: base colour, normal, and one ORM texture whose
    red channel is the occlusion. No emissive channel is built, so none can
    be exported, so no baked light can reach the museum."""
    material = bpy.data.materials.new(f'{part} atlas')
    material.use_nodes = True
    tree = material.node_tree
    n, l = tree.nodes, tree.links
    bsdf = n.get('Principled BSDF')
    bsdf.inputs['Emission Strength'].default_value = 0.0
    bsdf.inputs['Emission Color'].default_value = (0, 0, 0, 1)
    uv = n.new('ShaderNodeUVMap')
    uv.uv_map = 'AtlasUV'
    for kind in ('albedo', 'normal', 'orm'):
        texture = n.new('ShaderNodeTexImage')
        image = bpy.data.images.load(str(folder / str(size) / f'{part}-{kind}.png'), check_existing=False)
        image.colorspace_settings.name = 'sRGB' if kind == 'albedo' else 'Non-Color'
        texture.image = image
        l.new(uv.outputs['UV'], texture.inputs['Vector'])
        if kind == 'albedo':
            l.new(texture.outputs['Color'], bsdf.inputs['Base Color'])
        elif kind == 'normal':
            mapping = n.new('ShaderNodeNormalMap')
            mapping.uv_map = 'AtlasUV'
            l.new(texture.outputs['Color'], mapping.inputs['Color'])
            l.new(mapping.outputs['Normal'], bsdf.inputs['Normal'])
        else:
            split = n.new('ShaderNodeSeparateColor')
            l.new(texture.outputs['Color'], split.inputs['Color'])
            l.new(split.outputs['Green'], bsdf.inputs['Roughness'])
            l.new(split.outputs['Blue'], bsdf.inputs['Metallic'])
            group = bpy.data.node_groups.get('glTF Material Output') or \
                bpy.data.node_groups.new('glTF Material Output', 'ShaderNodeTree')
            if not group.interface.items_tree:
                group.interface.new_socket(name='Occlusion', in_out='INPUT',
                                           socket_type='NodeSocketFloat')
            holder = n.new('ShaderNodeGroup')
            holder.node_tree = group
            l.new(split.outputs['Red'], holder.inputs['Occlusion'])
    return material


def export(parts, *, folder, out, name, size, extras=None):
    """one glb of the whole object at one atlas size.

    Everything the bake does not ship is stripped here: the library's metre
    scale uv, the shade attribute the atlas already holds, and every material
    the object was authored with. What leaves is two textures and a normal
    map per part."""
    shipped = []
    for part, obj in parts.items():
        copy = obj.copy()
        copy.data = obj.data.copy()
        copy.name = f'{part} baked'
        bpy.context.collection.objects.link(copy)
        copy.data.materials.clear()
        copy.data.materials.append(atlas_material(name, folder, size, part=part))
        for polygon in copy.data.polygons:
            polygon.material_index = 0
        for attribute in list(copy.data.color_attributes):
            copy.data.color_attributes.remove(attribute)
        for layer in list(copy.data.uv_layers):
            if layer.name != 'AtlasUV':
                copy.data.uv_layers.remove(layer)
        copy.data.uv_layers.active_index = 0
        copy.data.uv_layers['AtlasUV'].active_render = True
        for key in list(copy.keys()):
            if key not in ('atlas',):
                del copy[key]
        obj.hide_render = True
        shipped.append(copy)
    for key, value in (extras or {}).items():
        shipped[0][key] = value
    select(shipped)
    out.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(out), export_format='GLB', use_selection=True,
                              export_yup=True, export_apply=True, export_extras=True,
                              export_texcoords=True, export_normals=True,
                              export_materials='EXPORT', export_image_format='AUTO',
                              export_attributes=False)
    tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in shipped)
    bounds = _bounds(shipped)
    for copy in shipped:
        bpy.data.objects.remove(copy, do_unlink=True)
    for obj in parts.values():
        obj.hide_render = False
    log('export', out.name, tris, 'triangles', out.stat().st_size, 'bytes')
    return {'file': out.name, 'bytes': out.stat().st_size, 'tris': tris, **bounds}


def _bounds(objects):
    points = [o.matrix_world @ v.co for o in objects for v in o.data.vertices]
    if not points:
        return {'bounds_m': [0, 0, 0], 'floor_m': 0}
    low = [min(p[i] for p in points) for i in range(3)]
    high = [max(p[i] for p in points) for i in range(3)]
    span = [round(high[i] - low[i], 4) for i in range(3)]
    # glTF is y up: the museum reads the object's height as its second number
    return {'bounds_m': [span[0], span[2], span[1]], 'floor_m': round(low[2], 4)}


def preview(path, *, at, to, size=(1200, 800), fov=44.0, samples=48,
            sun=(232.0, 17.0), strength=3.0, ground=True):
    """A PICTURE FOR THE SEAT, never an atlas. This is the only place in the
    kit that lights anything: a build is not verified by reading its source,
    and the shortest way to a frame is one Cycles render of what stands."""
    from mathutils import Vector
    scene = bpy.context.scene
    gpu(samples)
    world = measure_world(0.35)
    lamp = bpy.data.objects.get('Preview sun')
    if not lamp:
        bpy.ops.object.light_add(type='SUN')
        lamp = bpy.context.object
        lamp.name = 'Preview sun'
    azimuth, elevation = math.radians(sun[0]), math.radians(sun[1])
    direction = Vector((math.sin(azimuth) * math.cos(elevation),
                        -math.cos(azimuth) * math.cos(elevation),
                        math.sin(elevation)))
    lamp.rotation_euler = (-direction).to_track_quat('-Z', 'Y').to_euler()
    lamp.data.energy = strength
    lamp.data.angle = math.radians(0.53)
    lamp.data.color = (1.0, 0.86, 0.68)
    floor = bpy.data.objects.get('Preview ground')
    if ground and not floor:
        bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, -0.001))
        floor = bpy.context.object
        floor.name = 'Preview ground'
    camera = bpy.data.objects.get('Preview camera')
    if not camera:
        data = bpy.data.cameras.new('Preview camera')
        camera = bpy.data.objects.new('Preview camera', data)
        scene.collection.objects.link(camera)
    camera.data.lens_unit = 'FOV'
    camera.data.angle = math.radians(fov)
    camera.location = Vector(at)
    camera.rotation_euler = (Vector(to) - Vector(at)).to_track_quat('-Z', 'Y').to_euler()
    scene.camera = camera
    scene.render.resolution_x, scene.render.resolution_y = size
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.filepath = str(path)
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'None'
    bpy.ops.render.render(write_still=True)
    scene.view_settings.view_transform = 'Standard'
    log('preview', path)
    for temporary in (lamp, floor):
        if temporary:
            bpy.data.objects.remove(temporary, do_unlink=True)
    return path


def receipt(path, payload):
    path.write_text(json.dumps(payload, indent=2) + '\n')
    log('receipt', path)
    return path
