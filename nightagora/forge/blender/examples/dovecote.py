"""The square dovecote, built with the kit.

The building is a brick box of eight metres a side under a pyramidal roof of
small clay tiles, with limestone dressings, one door, one upper light, one west
window and two flight holes under the eaves. Inside, the four walls carry
nesting cells in courses to the ceiling, and the roof is battens on rafters.
Every dimension here is a PROPOSED reading of photographs of the surviving
building, not a survey: eight metre side, seven and a half to the eaves, a
forty eight degree roof. The museum labels the object amber for exactly that
reason, and the certainty word travels with it into the manifest record.

The whole model is the four calls at the top of `walls`, `roof`, `door` and
`inside`. What the kit carries is the bond, the tiles, the dressings, the
joinery and the ironwork; what the script carries is this building's own
numbers. Run it through `forge/blender/build-object.sh`, never by hand:

    forge/blender/build-object.sh . forge/blender/examples/dovecote.py --stage all
"""

import argparse
import hashlib
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import bpy
from mathutils import Vector

from kit import Build, Frame, bake, bond, iron, join, materials, paths, select, stone, tiles, timber

ID = 'dovecote'
SCOPE = 'wing-vinci'
SEED = 1517
SIDE = 8.0            # the wall face, metres, proposed from photographs
WALL = 0.64           # how thick the masonry is between its two leaves
EAVES = 7.5           # the top of the wall, where the roof starts
PITCH = 48.0          # degrees, proposed
OVERHANG = 0.34       # how far the roof stands out over the wall
BRICK = (0.24, 0.105, 0.058)
JOINT = 0.012
OUTER = SIDE / 2 - 0.02
INNER = SIDE / 2 - WALL
HALF_ROOF = SIDE / 2 + OVERHANG
RISE = math.tan(math.radians(PITCH))
# the slope passes over the wall head at the eaves, so the line it starts from
# stands below it by the overhang's own rise
ROOF_FOOT = EAVES - OVERHANG * RISE
APEX = ROOF_FOOT + HALF_ROOF * RISE

# every hole in the four walls, in the face's own coordinates
DOOR = {'x': 0.0, 'base': 0.0, 'width': 1.40, 'height': 2.25}
LIGHT = {'x': 0.0, 'base': 3.55, 'width': 0.96, 'height': 1.80}
WINDOW = {'x': 0.8, 'base': 1.45, 'width': 0.72, 'height': 1.20}
FLIGHT = {'x': 0.0, 'base': 6.64, 'width': 0.30, 'height': 0.22}
OPENINGS = {0: [DOOR, LIGHT], 1: [FLIGHT], 2: [FLIGHT], 3: [WINDOW]}

# one library set per material, in the order the materials are appended
SETS = ['brick-old-red', 'limestone-pale', 'limestone-pale', 'terracotta-tiles',
        'oak-beams', 'oak-planks-worn', 'iron-forged', 'earth-packed']
BRICKWORK, LIME, DRESSED, TILE, BEAM, BOARD, IRON, EARTH = range(8)

DATE = '2026-09-10'
LABEL = ('The square dovecote. Brick with stone dressings, and a roof of small '
         'tiles. Its dimensions are proposed from photographs.')
CERTAINTY = 'inferred'


def palette():
    """the library sets this building is dressed from, in material order"""
    return [
        materials.surface('Brick, old red', 'brick-old-red', tint=(1.06, 0.56, 0.4),
                          tint_amount=0.55, grain=0.005),
        materials.surface('Lime bed', 'limestone-pale', tint=(0.86, 0.82, 0.7),
                          tint_amount=0.4, roughness=0.96, grain=0.003, relief=0.4),
        materials.surface('Dressed limestone', 'limestone-pale', tint=(0.95, 0.9, 0.78),
                          tint_amount=0.3, roughness=0.9, grain=0.004),
        # the clay set is a photograph of a floor shot indoors: measured, it
        # bakes to a twentieth of the albedo fired clay has in daylight
        materials.surface('Unglazed flat tile', 'terracotta-tiles', tint=(1.9, 1.25, 1.0),
                          tint_amount=0.6, gain=3.4, roughness=0.93, grain=0.004),
        materials.surface('Hewn oak', 'oak-beams', tint=(0.68, 0.52, 0.34),
                          tint_amount=0.45, grain=0.006),
        materials.surface('Oak boards', 'oak-planks-worn', tint=(0.6, 0.46, 0.31),
                          tint_amount=0.5, grain=0.006),
        materials.surface('Forged iron', 'iron-forged', tint=(0.5, 0.48, 0.46),
                          tint_amount=0.35, roughness=0.62, metallic=1.0, grain=0.003),
        materials.surface('Packed earth', 'earth-packed', tint=(0.72, 0.62, 0.46),
                          tint_amount=0.45, roughness=0.97, grain=0.006),
    ]


def walls(build):
    """four brick faces with their dressings, cut by the openings they carry"""
    laid = 0
    for i, face in enumerate(Frame.faces(4, OUTER)):
        holes = OPENINGS[i]
        laid += bond.face(build, face, length=SIDE, height=EAVES, bond='flemish',
                          brick=BRICK, joint=JOINT, mat=BRICKWORK, bed_mat=LIME,
                          openings=holes, proud=0.011, recess=0.007, splay=0.0032,
                          tone=(0.68, 1.22))
        for corner, phase in ((-SIDE / 2, i % 2), (SIDE / 2, (i + 1) % 2)):
            stone.quoins(build, face, x=corner, height=EAVES, mat=DRESSED, phase=phase,
                         proud=0.022, tone=(0.78, 1.08), tooling=0.0002)
        # the rat ledge: a stone band a climbing animal cannot pass
        stone.string_course(build, face, z=5.62, length=SIDE, mat=DRESSED, proud=0.085)
        for hole in holes:
            stone.reveal(build, face, x=hole['x'], base=hole['base'], width=hole['width'],
                         height=hole['height'], depth=WALL - 0.06, mat=DRESSED,
                         floor=hole is not DOOR)
            if hole is FLIGHT:
                continue
            # the door is where a visitor stands closest, so its dressings are
            # the ones worth cutting rather than casting
            worked = 0.0005 if hole is DOOR else 0.0
            stone.jambs(build, face, x=hole['x'], base=hole['base'], width=hole['width'],
                        height=hole['height'], mat=DRESSED, reveal=0.27, course=0.34,
                        proud=0.019, tone=(0.8, 1.06), tooling=worked)
            stone.lintel(build, face, x=hole['x'], top=hole['base'] + hole['height'],
                         width=hole['width'], mat=DRESSED, height=0.3, proud=0.023,
                         tone=(0.82, 1.02), tooling=worked)
            if hole is DOOR:
                stone.threshold(build, face, x=hole['x'], z=0.02, width=hole['width'] + 0.5,
                                mat=DRESSED)
            else:
                stone.sill(build, face, x=hole['x'], z=hole['base'] - 0.05,
                           width=hole['width'] + 0.34, mat=DRESSED)
        # the corbelled eaves course and the plate the roof lands on
        stone.string_course(build, face, z=EAVES - 0.23, length=SIDE, block=0.52,
                            height=0.15, proud=0.12, mat=DRESSED, weather=False)
        build.box(face.moved(0, 0.07, EAVES - 0.09), (0, 0, 0), (SIDE + 0.06, 0.26, 0.17),
                  mat=BEAM, shade=build.tone(0.8, 0.95))
    return laid


def roof(build):
    """the four tiled slopes, their hips and the pot over the apex"""
    laid = tiles.pyramid(build, half=HALF_ROOF, eaves=ROOF_FOOT, pitch=PITCH, mat=TILE,
                         tile=(0.23, 0.34), gauge=0.135, thickness=0.021, overhang=0.09)
    apex = Vector((0, 0, laid['apex'] + 0.04))
    for i in range(4):
        corner = Frame.face(i, HALF_ROOF).point(HALF_ROOF, 0.03, ROOF_FOOT + 0.03)
        tiles.ridge(build, corner, apex, mat=TILE, overhang=0.1)
    tiles.finial(build, (0, 0, laid['apex'] - 0.06), mat=TILE)
    return laid


def door(build):
    """the leaf standing open on its pintles, and the rope kept beside it"""
    face = Frame.faces(4, OUTER)[0]
    # hung on the jamb away from the approach, so the opening reads as a room
    hinge = face.point(-DOOR['width'] / 2 - 0.04, 0.04, 0.0)
    leaf = Frame(hinge, face.rot).turned(64, 'Z')
    width, height = DOOR['width'] + 0.06, DOOR['height'] - 0.03
    timber.boards(build, leaf, width=width, height=height, board=0.152, thickness=0.045,
                  gap=0.007, mat=BOARD, centre=width / 2, solid=True)
    outer = leaf.moved(0, 0.045, 0)
    for z in (0.36, 1.72):
        iron.strap(build, outer, x=0.05, z=z, length=width * 0.84, mat=IRON)
        iron.pintle(build, leaf.point(0.02, 0.02, z), leaf.direction(-1, 0, 0), mat=IRON)
        # the ledge on the inner face, which is the face an open door shows
        timber.beam(build, leaf.point(0.06, -0.01, z), leaf.point(width - 0.06, -0.01, z),
                    width=0.16, depth=0.036, mat=BOARD)
    iron.ring(build, leaf.point(width - 0.14, 0.1, 1.05), leaf.direction(0, 1, 0), mat=IRON)
    # the upper light keeps a boarded shutter with the birds' own gap above it
    timber.boards(build, face.moved(0, 0.02, LIGHT['base']), width=LIGHT['width'] - 0.03,
                  height=LIGHT['height'] - 0.42, board=0.17, thickness=0.04, mat=BOARD,
                  solid=True)
    for z in (LIGHT['base'] + 0.3, LIGHT['base'] + 1.1):
        iron.strap(build, face.moved(0, 0.06, 0), x=-LIGHT['width'] / 2 + 0.06, z=z,
                   length=LIGHT['width'] - 0.12, width=0.06, mat=IRON, rivets=4)
    iron.bracket(build, face, x=1.35, z=2.05, mat=IRON)
    return 1


def inside(build):
    """the nesting cells on all four walls, the earth floor and the carpentry"""
    counted = {'cells': 0}
    for i, leaf in enumerate([f.turned(180) for f in Frame.faces(4, INNER)]):
        holes = [{**hole, 'x': -hole['x']} for hole in OPENINGS[i]]
        laid = bond.nest(build, leaf, length=SIDE - 2 * WALL + 0.1, height=EAVES - 0.1,
                         base=0.05, mouth=(0.28, 0.24), depth=0.42, pitch=(0.47, 0.345),
                         margin=0.26, brick=BRICK, joint=JOINT, bond='header',
                         mat=BRICKWORK, bed_mat=LIME, openings=holes, proud=0.012,
                         recess=0.008, splay=0.003)
        counted['cells'] += laid['cells']
    floor = Frame((0, 0, 0.0)).turned(90, 'X')
    build.raised(floor, (0, 0), (SIDE - 2 * WALL + 0.2, SIDE - 2 * WALL + 0.2), 0.0,
                 splay=0.0, mat=EARTH, shade=build.tone(0.7, 0.95))
    # rafters up each slope, battens across them, and the tie beams they land on
    for i in range(4):
        plate = Frame.face(i, INNER)
        slope = Frame.face(i, HALF_ROOF).moved(0, 0, ROOF_FOOT).sloped(PITCH)
        # a common rafter rises until the hip cuts it off, which is where the
        # slope's own width has closed to the rafter's own distance along it
        for j in range(13):
            x = -INNER + 0.3 + j * (2 * INNER - 0.6) / 12
            reach = max(0.16, abs(x))
            timber.beam(build, Frame.face(i, HALF_ROOF).point(x, 0.0, ROOF_FOOT - 0.09),
                        Frame.face(i, reach).point(x, 0.0, ROOF_FOOT + (HALF_ROOF - reach) * RISE - 0.13),
                        width=0.13, depth=0.17, mat=BEAM)
        timber.battens(build, slope.moved(0, -0.055, 0),
                       run=HALF_ROOF / math.cos(math.radians(PITCH)) - 0.45,
                       half_at_eaves=HALF_ROOF - 0.12, taper=math.cos(math.radians(PITCH)),
                       spacing=0.135, section=(0.045, 0.03), mat=BEAM)
        timber.beam(build, plate.point(-INNER, 0.16, EAVES - 0.2),
                    plate.point(INNER, 0.16, EAVES - 0.2), width=0.2, depth=0.26, mat=BEAM)
    for a, b in (((-INNER, 0, EAVES - 0.42), (INNER, 0, EAVES - 0.42)),
                 ((0, -INNER, EAVES - 0.42), (0, INNER, EAVES - 0.42))):
        timber.beam(build, a, b, width=0.22, depth=0.28, mat=BEAM)
        for t in (0.28, 0.72):
            at = Vector(a).lerp(Vector(b), t)
            timber.peg(build, at + Vector((0, 0, 0.14)), (0, 0, 1), mat=BOARD)
    return counted


def model():
    """build the three bodies and save the authoring file.

    Three parts and not one, because an atlas is a budget: the walls are what
    every bench state looks at, and giving the roof its own sheet buys the
    brick half as much texel density again."""
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    bpy.context.scene.unit_settings.system = 'METRIC'
    palette_materials = palette()
    repeats = materials.repeats(SETS)
    # a plate laid at its own metre is a flat patch on a hand forged strap,
    # which is read at arm's length: it takes the picture at its own size
    repeats[IRON] = 0.34
    outside = Build(SEED)
    counted = {'bricks': walls(outside)}
    door(outside)
    covering = Build(SEED + 2)
    counted.update(roof(covering))
    within = Build(SEED + 1)
    counted.update(inside(within))
    parts = {
        'walls': outside.object('Walls', palette_materials, repeats, atlas='walls'),
        'roof': covering.object('Roof', palette_materials, repeats, atlas='roof'),
        'inside': within.object('Inside', palette_materials, repeats, atlas='inside'),
    }
    # the lime bed stands behind its own bricks and is seen through the joints
    # alone: it is worth a fifth of the sheet a brick face is worth
    for name, part in parts.items():
        bake.atlas_uv(part, priority={LIME: 0.45, EARTH: 0.5})
    scene = bpy.context.scene
    scene['object'] = {'id': ID, 'side_m': SIDE, 'eaves_m': EAVES, 'pitch_deg': PITCH,
                       'apex_m': round(APEX, 3), 'wall_m': WALL, 'seed': SEED,
                       'cells': counted.get('cells', 0), 'tiles': counted.get('tiles', 0),
                       'bricks': counted.get('bricks', 0)}
    bake.log('model', dict(scene['object']))
    return parts


PARTS = ('walls', 'roof', 'inside')


def parts_in_file():
    return {name: bpy.data.objects[name.capitalize()] for name in PARTS}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--stage', choices=['model', 'bake', 'export', 'all'], default='all')
    parser.add_argument('--size', type=int, default=4096)
    parser.add_argument('--samples', type=int, default=96)
    parser.add_argument('--preview', default='')
    parser.add_argument('--only', default='', help='bake one part rather than all of them')
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    args = parser.parse_args(argv)
    work = paths.work(ID)
    blend = work / f'{ID}.blend'
    atlas = work / 'atlas'
    sizes = [args.size, args.size // 2, args.size // 4]

    if args.stage in ('model', 'all') or not blend.exists():
        model()
        bpy.ops.wm.save_as_mainfile(filepath=str(blend))
    else:
        bpy.ops.wm.open_mainfile(filepath=str(blend))

    if args.preview:
        for name, at, to, fov in (
            ('approach', (-11.5, -13.2, 1.65), (0, 0, 6.2), 44),
            ('near', (-2.4, -6.4, 1.6), (-0.5, -4.0, 2.0), 44),
            ('detail', (-1.42, -4.62, 1.3), (-0.86, -3.99, 1.26), 38),
            ('eaves', (-5.2, -7.4, 5.4), (-2.4, -4.4, 7.5), 42)):
            bake.preview(work / f'preview-{args.preview}-{name}.png', at=at, to=to, fov=fov,
                         size=(1000, 700), samples=40)
        return

    if args.stage in ('bake', 'all'):
        wanted = parts_in_file()
        if args.only:
            wanted = {name: part for name, part in wanted.items() if name in args.only.split(',')}
        maps = bake.atlases(wanted, folder=atlas, sizes=sizes, samples=args.samples)
        bpy.ops.wm.save_as_mainfile(filepath=str(blend))
        bake.log('atlases', {k: sorted(v) for k, v in maps.items()})

    if args.stage in ('export', 'all'):
        if args.stage == 'export':
            bpy.ops.wm.open_mainfile(filepath=str(blend))
        parts = parts_in_file()
        source = Path(__file__).resolve()
        tiers = {}
        for tier, size in zip(('hero', 'standard', 'calm'), sizes):
            out = work / f'{ID}-{tier}-raw.glb'
            tiers[tier] = {**bake.export(parts, folder=atlas, out=out, name=ID, size=size),
                           'atlas': size, 'texture_limit': size}
        scene = bpy.context.scene
        bake.receipt(work / 'build.json', {
            'id': ID, 'scope': SCOPE, 'name': 'The square dovecote',
            'date': DATE, 'app': str(paths.app_root()), 'store': str(paths.store()),
            'models': str(paths.models(SCOPE, ID)),
            # NO DETAIL SET. Under four hundred texels a metre the loader
            # offers to lay a library band over the body, and that band costs a
            # whole material set in the frame: measured, the standard tier then
            # stands at ninety nine per cent of its texture budget with one
            # building on a lawn. What the band would add at room scale (a
            # variation about one) the bake already carries per brick, so the
            # record declines it.
            'label': LABEL, 'certainty': CERTAINTY,
            'category': 'architecture', 'period_fit': 'plausible-1517',
            'script': str(source.relative_to(source.parents[3])),
            'script_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
            'blend': str(blend), 'work': str(work), 'atlas': str(atlas),
            'measurements': dict(scene['object']),
            # the sets the script dresses from, read off the store's own
            # manifest: the export stage opens the blend rather than building
            # it, so the list cannot come from what this process happened to
            # load
            'library': [{'id': f'library/{name}', 'licence': materials.record(name)['licence']}
                        for name in sorted(set(SETS))],
            'sets': sorted(set(SETS)),
            'maps': ['albedo', 'normal', 'orm'],
            'parts': list(PARTS),
            'texels_per_m': min(int(bake.texel_density(part)) for part in parts.values()),
            'note': ('Square dovecote: brick in Flemish bond on a recessed lime bed, '
                     'limestone quoins, jambs, lintels and a rat ledge, a pyramidal roof '
                     'of individual flat tiles with hips and a pot, an oak door on forged '
                     'straps, and nesting cells in courses on all four inner walls. '
                     'Dimensions proposed from photographs. No light is baked: the '
                     'atlases carry colour, relief, roughness, metal and occlusion, and '
                     'the occlusion reaches the ambient term only.'),
            'tiers': tiers,
        })


if __name__ == '__main__':
    main()
