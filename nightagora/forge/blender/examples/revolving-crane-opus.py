"""The revolving crane of Manuscript B 49r, built with the kit.

The machine is an engineering dossier before it is an object: twenty parts
with a shape, a size in metres, a place in their parent's frame and a material
class. `kit.dossier` reads that file and hands back a frame per part, so every
number below is the dossier's own number and the parity table at the end of
the build measures the vertices rather than the intention. What this script
adds is the hand: the arris a plane took off every member, the bored holes
with the mouth a rope has worn, the pegs and iron bands that hold a period
crane together, the drum as a turned barrel in bored journals, the ratchet as
twenty four forged teeth, the sheaves between their cheeks, the rope as a
three strand hemp helix, and the counterweight and the load as dressed stone.
None of it changes a declared dimension and none of it carries a claim.

The body leaves as eight bodies, because the hall drives this machine: the
moving assemblies are their own glTF nodes with their origin at the dossier's
joint (`turntable`, `drum`, `rear-pulley`, `tip-pulley`, `rope-fall`, `load`),
so a runtime can turn the drum and shorten the fall without knowing how either
was built. Each body is one atlas, and the atlas sizes are not equal: the
frame and the jib head are what a visitor stands in front of, and a sheave the
size of a hand is not worth the same sheet.

    forge/blender/build-object.sh . forge/blender/examples/revolving-crane-opus.py --stage all
"""

import argparse
import hashlib
import math
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import bpy
from mathutils import Matrix, Vector

from kit import Build, Frame, bake, dossier, machine, materials, paths, rope, weld

ID = 'revolving-crane-opus'
SCOPE = 'wing-vinci'
SEED = 1493
DATE = '2026-09-11'
SOURCE = 'brief/dossier/revolving-crane.json'

# the locked first line of brief/pages/revolving-crane.md
LABEL = ('Reconstructed from Manuscript B 49r with modern dimensions. '
         'A hand crank raises the load.')
CERTAINTY = 'inferred'

SETS = ['oak-beams', 'oak-beams', 'oak-beams', 'iron-forged', 'rope', 'plaster-lime-aged']
OAK, BOARD, ENDGRAIN, IRON, HEMP, STONE = range(6)

# one atlas per body, at the size that body is worth. The hero tier gets these
# numbers, the standard tier half of each and the calm tier a quarter.
ATLAS = {
    'frame': 4096, 'jib': 4096, 'bed': 2048, 'drum': 2048,
    'rear-sheave': 1024, 'tip-sheave': 1024, 'load': 1024, 'fall': 1024,
}

# the joint tree the hall drives, with every pivot at the dossier's own joint
NODES = [
    {'name': 'base', 'parent': None, 'pivot': (0, 0, 0), 'parts': ['bed']},
    {'name': 'turntable', 'parent': None, 'pivot': (0, 0.12, 0), 'parts': []},
    {'name': 'body', 'parent': 'turntable', 'pivot': (0, 0.12, 0), 'parts': ['frame', 'jib']},
    {'name': 'drum', 'parent': 'turntable', 'pivot': (0, 1.12, 0), 'parts': ['drum']},
    {'name': 'rear-pulley', 'parent': 'turntable', 'pivot': (0, 2.62, 0), 'parts': ['rear-sheave']},
    {'name': 'tip-pulley', 'parent': 'turntable', 'pivot': (0, 2.62, 1.5), 'parts': ['tip-sheave']},
    {'name': 'rope-fall', 'parent': 'turntable', 'pivot': (0, 2.62, 1.58), 'parts': ['fall']},
    {'name': 'load', 'parent': 'turntable', 'pivot': (0, 0.94, 1.58), 'parts': ['load']},
]

LAY = 0.042           # how far one twist of the hemp travels
ROPE_STEP = 0.0055    # how often the helix is sampled where the eye is close


def palette():
    """the library sets this machine is dressed from, in material order"""
    return [
        materials.surface('Squared oak', 'oak-beams', tint=(1.35, 0.95, 0.58),
                          tint_amount=0.7, gain=1.42, roughness=0.78, grain=0.0026),
        # the deck and the bed are the same timber, weathered a season longer:
        # one plate, another tint, another metre, so two oak surfaces meeting
        # at a joint are not the same photograph twice
        materials.surface('Weathered oak', 'oak-beams', tint=(1.2, 1.0, 0.74),
                          tint_amount=0.6, gain=1.28, roughness=0.8, grain=0.0028),
        # a sawn end is a different surface from a riven face: the same plate,
        # laid at a tenth of a metre, is the tight figure of end grain
        materials.surface('Sawn end', 'oak-beams', tint=(1.12, 0.84, 0.52),
                          tint_amount=0.65, gain=1.22, roughness=0.86, grain=0.0022),
        materials.surface('Forged iron', 'iron-forged', tint=(0.74, 0.71, 0.68),
                          tint_amount=0.4, gain=2.1, roughness=0.5, metallic=1.0,
                          grain=0.0016),
        # a bump measured in millimetres on a strand two millimetres thick is
        # a surface whose normals point nowhere, and it renders black
        materials.surface('Hemp rope', 'rope', tint=(1.18, 1.02, 0.76),
                          tint_amount=0.45, gain=1.75, roughness=0.88, relief=0.35,
                          grain=0.00018),
        # stone has to be COLDER than the oak beside it, not only darker: a
        # warm pale block among warm timber is read as a crate every time
        # the travertine plate bands like veneer at every scale, and a block
        # of it beside warm oak is read as a crate. Aged lime mottles instead,
        # which is what a weathered dressed block does.
        materials.surface('Dressed stone', 'plaster-lime-aged', tint=(0.88, 0.83, 0.72),
                          tint_amount=0.72, gain=0.82, roughness=0.9, relief=0.9,
                          grain=0.003),
    ]


def repeats():
    """how many metres of object one tile of each plate covers.

    A plate laid at its own photographed size is a patch of something else on
    a hand made object. The iron plate is a metre of wall on a strap forty
    millimetres wide, and the rope plate is a metre of coiled cable on a rope
    ten millimetres thick: both are read at arm's length, so both take the
    picture at the size the piece really is."""
    scale = materials.repeats(SETS)
    scale[ENDGRAIN] = 0.11
    scale[IRON] = 0.22
    scale[HEMP] = 0.036
    scale[BOARD] = 0.52
    scale[STONE] = 0.34
    return scale


# --------------------------------------------------------------------- helpers
def plain(value):
    """Blender's own id properties, as something json will take"""
    if hasattr(value, 'to_dict'):
        return {k: plain(v) for k, v in value.to_dict().items()}
    if hasattr(value, 'to_list'):
        return [plain(v) for v in value.to_list()]
    if isinstance(value, dict):
        return {k: plain(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [plain(v) for v in value]
    return value


def axis_frame(a, b, roll=0.0):
    """a frame whose local +Z runs from a to b, for anything raking"""
    start, end = Vector(a), Vector(b)
    direction = (end - start)
    length = direction.length
    direction.normalize()
    up = Vector((0, 0, 1)) if abs(direction.z) < 0.95 else Vector((1, 0, 0))
    x = up.cross(direction).normalized()
    y = direction.cross(x).normalized()
    rot = Matrix((x, y, direction)).transposed()
    if roll:
        rot = rot @ Matrix.Rotation(roll, 3, 'Z')
    return Frame((start + end) / 2, rot), length


def resample(points, step, focus=None, spread=0.9, coarse=2.6):
    """a polyline sampled fine enough for a helix to twist along it.

    A rope drawn through the dossier's own nodes is a rope with one sample per
    metre on its straight runs, and a helix wound on that is a straight line
    with an offset. `focus` is where the eye stands at the detail station: the
    step opens out with distance from it, so the lay reads at arm's length
    without paying for it along four metres nobody stands next to."""
    out = []
    for i in range(len(points) - 1):
        a, b = Vector(points[i]), Vector(points[i + 1])
        span = (b - a).length
        if span < 1e-9:
            continue
        here = step
        if focus is not None:
            middle = (a + b) / 2
            marks = focus if isinstance(focus, list) else [focus]
            away = min((middle - Vector(mark)).length for mark in marks)
            here = step * (1 + (coarse - 1) * min(1.0, away / spread))
        count = max(1, int(math.ceil(span / here)))
        for k in range(count):
            out.append(a.lerp(b, k / count))
    out.append(Vector(points[-1]))
    return out


def hemp(build, points, *, radius=0.005, mat=HEMP, tone=(0.82, 1.08), sides=6, seed=0):
    """the kit's three strand helix, at this rope's own lay"""
    return rope.along_curve(build, points, radius=radius, strands=3, lay=LAY, sides=sides,
                            mat=mat, tone=tone)


def deck_pieces(x0, x1, outer, inner=0.0, steps=9):
    """the polygons one plank of a round deck is cut into.

    A plank crossing a bored centre becomes two, and a plank ending on the rim
    ends on an ARC rather than on a chord: sampled in x, the last step of a
    plank near the widest point of the circle cuts a centimetre off it and
    leaves a crack the ground shows through. So the arcs are sampled in
    ANGLE, which is exact wherever the plank falls."""
    def span(a, b, radius, sign, count):
        a, b = max(-radius, min(radius, a)), max(-radius, min(radius, b))
        first, last = math.asin(a / radius), math.asin(b / radius)
        out = []
        for i in range(count + 1):
            turn = first + (last - first) * i / count
            out.append((radius * math.sin(turn), sign * radius * math.cos(turn)))
        return out

    spans = [(x0, x1)]
    if inner > 0 and x0 < inner and x1 > -inner:
        cuts = sorted({x0, x1} | {c for c in (-inner, inner) if x0 < c < x1})
        spans = list(zip(cuts, cuts[1:]))
    pieces = []
    for a, b in spans:
        if b - a < 1e-5:
            continue
        if inner > 0 and abs((a + b) / 2) < inner:
            pieces.append(span(a, b, outer, -1, steps) +
                          list(reversed(span(a, b, inner, -1, steps))))
            pieces.append(span(a, b, inner, 1, steps) +
                          list(reversed(span(a, b, outer, 1, steps))))
        else:
            pieces.append(span(a, b, outer, -1, steps) +
                          list(reversed(span(a, b, outer, 1, steps))))
    return pieces


def circle(radius, sides=20, centre=(0.0, 0.0)):
    return [(centre[0] + radius * math.cos(2 * math.pi * i / sides),
             centre[1] + radius * math.sin(2 * math.pi * i / sides)) for i in range(sides)]


# ------------------------------------------------------------------- the bodies
def bed(build, d, rng, parity):
    """the ground frame: a plank platform, the iron pintle, the thrust ring"""
    with parity.of(build, 'base'):
        frame = d.frame('base')
        planks = 8
        for i in range(planks):
            x = -1.0 + (i + 0.5) * 2.0 / planks
            machine.member(build, frame, centre=(x, 0, 0),
                           size=(2.0 / planks - 0.007, 0.1, 2.0), axis='Z',
                           chamfer=0.005, facets=3, hollow=0.0006, mat=BOARD,
                           end_mat=ENDGRAIN, rng=rng, tone=(0.62, 0.92))
    # the pegs that hold the deck down, cut off flush the way a floor is
    for i in range(planks):
        x = -1.0 + (i + 0.5) * 2.0 / planks
        for z in (-0.86, 0.86):
            machine.peg(build, d.at('base', x, 0.0499, z), (0, 1, 0), diameter=0.021,
                        proud=0.0004, sink=0.02, mat=ENDGRAIN, shade=rng.uniform(0.6, 0.8))
    with parity.of(build, 'slew-pin'):
        frame = d.frame('slew-pin')
        machine.barrel(build, frame, 0.1, 0.12, crown=0.004, segments=24, mat=IRON,
                       shade=rng.uniform(0.85, 1.0), wobble=0.0012)
    with parity.of(build, 'turntable-thrust-ring'):
        frame = d.frame('turntable-thrust-ring')
        dossier.revolve(build, frame, [(-0.005, 0.105), (-0.005, 0.6), (0.005, 0.6),
                                       (0.005, 0.105)], segments=40, mat=IRON,
                        shade=0.82, wobble=0.0004)


def turntable(build, d, rng, parity):
    """the platform: planks on a bored curb, bound with an iron tyre"""
    frame = d.frame('turntable')
    rim, curb, gap = 0.816, 0.19, 0.006
    with parity.of(build, 'turntable'):
        # the curb the pintle turns in, turned out of the solid
        dossier.revolve(build, frame, [(-0.06, 0.105), (-0.058, 0.115), (-0.058, curb),
                                       (-0.06, curb + 0.004), (0.06, curb + 0.004),
                                       (0.058, curb), (0.058, 0.115), (0.06, 0.105)],
                        segments=48, mat=OAK, shade=rng.uniform(0.72, 0.88), wobble=0.0006)
        edges = [-0.82, -0.6625, -0.505, -0.3475, -0.19, 0.0, 0.19, 0.3475, 0.505, 0.6625, 0.82]
        for a, b in zip(edges, edges[1:]):
            for piece in deck_pieces(a + gap / 2, b - gap / 2, rim, curb - 0.004,
                                     steps=11):
                dossier.extrude(build, frame, piece, depth=0.12, plane='XZ',
                                mat=OAK, shade=rng.uniform(0.66, 1.0),
                                chamfer=(0.0035, 0.0035), grain=1)
        # the tyre, set into the rebate the planks stop short of
        dossier.revolve(build, frame, [(-0.06, 0.812), (-0.055, 0.82), (0.055, 0.82),
                                       (0.06, 0.812)], segments=64, mat=IRON,
                        shade=rng.uniform(0.8, 0.95), wobble=0.0005)
    # the plate the platform really bears on, let into the curb's own face
    dossier.revolve(build, frame, [(0.054, 0.108), (0.0605, 0.118), (0.0605, 0.188),
                                   (0.054, 0.194)], segments=44, mat=IRON,
                    shade=rng.uniform(0.86, 1.04), wobble=0.0004)
    for i in range(8):
        angle = 2 * math.pi * (i + 0.5) / 8
        machine.peg(build, frame.point(0.152 * math.cos(angle), 0.0605,
                                       0.152 * math.sin(angle)),
                    frame.direction(0, 1, 0), diameter=0.016, proud=0.0028, sink=0.02,
                    mat=IRON, sides=6, shade=rng.uniform(0.85, 1.05))
    for i in range(12):
        angle = 2 * math.pi * (i + 0.5) / 12
        machine.peg(build, frame.point(0.78 * math.cos(angle), 0.0605, 0.78 * math.sin(angle)),
                    frame.direction(0, 1, 0), diameter=0.02, proud=0.0035, sink=0.03,
                    mat=IRON, shade=rng.uniform(0.8, 1.0))


def standing(build, d, rng, parity):
    """the mast, the raking brace, and the counterweight on its tail"""
    # ---- the mast, shouldered under the jib ----------------------------------
    frame = d.frame('mast')
    with parity.of(build, 'mast'):
        machine.member(build, frame, centre=(0, -0.04, 0), size=(0.14, 2.16, 0.14),
                       axis='Y', chamfer=0.008, facets=4, hollow=0.0007, mat=OAK,
                       end_mat=ENDGRAIN, rng=rng, tone=(0.74, 1.0))
        # the head reduced to a tenon, its shoulders bearing on the jib's soffit
        machine.member(build, frame, centre=(0, 1.08, 0), size=(0.072, 0.08, 0.072),
                       axis='Y', chamfer=0.004, facets=0, mat=ENDGRAIN, rng=rng,
                       tone=(0.7, 0.9), ends=False)
    section = machine.rect(0.14, 0.14, chamfer=0.008, facets=0)
    for at, width in ((-0.85, 0.075), (0.55, 0.065), (1.02, 0.06)):
        machine.band(build, frame, section, axis='Y', at=at, width=width, thickness=0.008,
                     mat=IRON, shade=rng.uniform(0.82, 1.02), rivets=4, rng=rng, hammer=0.0004)
    for at in (-0.6, 0.2, 0.86):
        machine.peg(build, frame.point(0, at, 0.071), frame.direction(0, 0, 1),
                    diameter=0.024, proud=0.006, sink=0.03, mat=ENDGRAIN,
                    shade=rng.uniform(0.62, 0.84), tilt=0.0012)

    # ---- the brace, a hewn spar from the mast's foot to the jib ---------------
    with parity.of(build, 'brace'):
        line = d.dims('brace')['centreline']
        foot, head = d.at('brace', *line[0]), d.at('brace', *line[1])
        spar, length = axis_frame(foot, head)
        hewn = machine.hewn(0.055, sides=24, facets=8, depth=0.0022, rng=rng)
        dossier.extrude(build, spar, hewn, depth=length, plane='XY', mat=OAK,
                        shade=rng.uniform(0.7, 0.95), chamfer=(0.004, 0.004),
                        grain=_long_axis(spar))
    direction = (Vector(head) - Vector(foot)).normalized()
    # the tenon that carries the brace's thrust up into the jib's soffit
    tip = Frame(Vector(head) + direction * 0.052, spar.rot)
    dossier.extrude(build, tip, machine.rect(0.05, 0.05, chamfer=0.003, facets=0),
                    depth=0.12, plane='XY', mat=ENDGRAIN, shade=rng.uniform(0.66, 0.86))
    for at, width in ((-length / 2 + 0.30, 0.07), (length / 2 - 0.22, 0.065)):
        machine.band(build, spar, hewn, axis='Z', at=at, width=width, thickness=0.007,
                     mat=IRON, shade=rng.uniform(0.84, 1.02), rivets=5, rng=rng, hammer=0.0004)

    # ---- the counterweight tail, through the mast, and the stone on it --------
    frame = d.frame('counterweight-bracket')
    with parity.of(build, 'counterweight-bracket'):
        machine.member(build, frame, centre=(0, 0, -0.035), size=(0.15, 0.15, 0.63),
                       axis='Z', chamfer=0.007, facets=3, mat=OAK, end_mat=ENDGRAIN,
                       rng=rng, tone=(0.72, 0.96))
        # the through tenon that shows on the far side of the mast, wedged
        machine.member(build, frame, centre=(0, 0, 0.305), size=(0.09, 0.09, 0.09),
                       axis='Z', chamfer=0.003, facets=0, mat=ENDGRAIN, rng=rng,
                       tone=(0.68, 0.88))
    machine.wedge(build, frame, (0.0, 0.0, 0.352), (0.018, 0.085, 0.075), axis='Z',
                  taper=0.4, mat=ENDGRAIN, shade=rng.uniform(0.6, 0.8))
    tail = machine.rect(0.15, 0.15, chamfer=0.007, facets=0)
    machine.band(build, frame, tail, axis='Z', at=-0.02, width=0.06, thickness=0.007,
                 mat=IRON, shade=rng.uniform(0.82, 1.0), rivets=4, rng=rng, hammer=0.0004)

    frame = d.frame('counterweight')
    face = (rng.uniform(0, 1), rng.uniform(0, 1))
    with parity.of(build, 'counterweight'):
        # the block is keyed over the tail: a full section behind it, a slotted
        # section in front, so the timber enters a real housing in the stone
        slot = machine.rect(0.152, 0.152, chamfer=0.004, facets=0)
        slot = [(x, y - 0.10) for x, y in slot]
        knock = [0.006 + rng.uniform(0, 0.012) for _ in range(4)]
        solid = machine.rect(0.5, 0.4, chamfer=knock, facets=0)
        tone = rng.uniform(0.84, 1.0)
        dossier.extrude(build, Frame(frame.point(0, 0, -0.125), frame.rot), solid,
                        depth=0.25, plane='XY', mat=STONE, shade=tone,
                        chamfer=(0.006, 0.0), offset=face)
        dossier.extrude(build, Frame(frame.point(0, 0, 0.125), frame.rot), solid,
                        holes=[slot], depth=0.25, plane='XY', mat=STONE,
                        shade=tone, chamfer=(0.0, 0.006), mouth=[0.0025], offset=face)
    machine.dressed(build, frame, (0.5, 0.4, 0.5), rng=rng, mat=STONE, margin=0.032,
                    courses=10, pitched=0.0062, pick=0.003, tone=(0.86, 1.04),
                    splay=0.004, offset=face,
                    faces=((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, 0, -1)))
    strap = machine.rect(0.502, 0.402, chamfer=0.006, facets=0)
    for at in (-0.14, 0.13):
        machine.band(build, frame, strap, axis='Z', at=at, width=0.036, thickness=0.0075,
                     mat=IRON, shade=rng.uniform(0.86, 1.05), rivets=6, rivet=0.019,
                     rng=rng, hammer=0.0006)


def _long_axis(frame):
    """the world axis a raking member runs closest to, for the grain"""
    direction = frame.direction(0, 0, 1)
    return max(range(3), key=lambda i: abs(direction[i]))


def winch(build, d, rng, parity):
    """the crossbar through the mast, the bored journals, the pawl on its post"""
    frame = d.frame('drum-support-crossbar')
    with parity.of(build, 'drum-support-crossbar'):
        machine.member(build, frame, size=(0.5, 0.1, 0.3), axis='X', chamfer=0.006,
                       facets=3, mat=OAK, end_mat=ENDGRAIN, rng=rng, tone=(0.72, 0.98))
    for x in (-0.25, 0.25):
        machine.peg(build, frame.point(x * 0.86, 0.051, 0.0), frame.direction(0, 1, 0),
                    diameter=0.022, proud=0.005, sink=0.03, mat=ENDGRAIN,
                    shade=rng.uniform(0.62, 0.84))

    for side in ('left', 'right'):
        part = f'drum-journal-{side}'
        frame = d.frame(part)
        bore = d.dims(part)['holes_yz'][0]
        outline = d.dims(part)['coordinates_yz']
        post_face = (rng.uniform(0, 1), rng.uniform(0, 1))
        post_tone = rng.uniform(0.76, 0.98)
        with parity.of(build, part):
            # the post is forty millimetres at its foot and thirty at its head,
            # so the ratchet wheel beside it turns in its own clearance
            dossier.extrude(build, Frame(frame.point(-0.005, 0, 0), frame.rot), outline,
                            holes=[bore], depth=0.03, plane='YZ', mat=OAK,
                            shade=post_tone, chamfer=(0.004, 0.0), offset=post_face,
                            mouth=[(0.0035, 0.0)], grain=1)
            # the post is fuller where the crossbar houses it, and steps back
            # at the crossbar's top face, which is where the ratchet wheel runs
            foot = [(-0.15, -0.1), (-0.06, -0.1), (-0.06, 0.1), (-0.15, 0.1)]
            dossier.extrude(build, Frame(frame.point(0.015, 0, 0), frame.rot), foot,
                            depth=0.01, plane='YZ', mat=OAK, shade=post_tone,
                            chamfer=(0.0, 0.003), offset=post_face, grain=1)
        # the iron bearing plate the axle really runs in, let into the face
        machine.washer(build, Frame(frame.point(-0.0225, 0.05, 0), frame.rot @
                                    Matrix.Rotation(math.radians(90), 3, 'Z')),
                       radius=0.046, bore=0.0235, thickness=0.005, segments=22,
                       mat=IRON, shade=rng.uniform(0.85, 1.05))
        for z in (-0.07, 0.07):
            machine.peg(build, frame.point(-0.0205, -0.02, z), frame.direction(-1, 0, 0),
                        diameter=0.02, proud=0.005, sink=0.02, mat=IRON,
                        shade=rng.uniform(0.85, 1.0))

    # ---- the pawl, parked clear, on a post of its own ------------------------
    post = Frame(d.at('drum-support-crossbar', 0.2355, 0.0, -0.1), d.frame('base').rot)
    machine.member(build, post, centre=(0, 0.19, 0), size=(0.047, 0.40, 0.066), axis='Y',
                   chamfer=0.005, facets=2, mat=OAK, end_mat=ENDGRAIN, rng=rng,
                   tone=(0.7, 0.94))
    frame = d.frame('pawl')
    with parity.of(build, 'pawl'):
        # a detent with a hooked nose and a shoulder, not a flat bar
        nose = [(-0.01, -0.08), (0.0085, -0.079), (0.01, -0.05), (0.006, -0.012),
                (0.0075, 0.03), (0.0045, 0.066), (-0.0035, 0.08), (-0.0095, 0.062),
                (-0.0075, 0.01), (-0.0095, -0.04)]
        dossier.extrude(build, frame, nose, depth=0.025, plane='XY', mat=IRON,
                        shade=rng.uniform(0.88, 1.05), chamfer=0.0015)
    pin = d.at('pawl', 0, -0.062, 0)
    build.tube([Vector(pin) + Vector(d.frame('pawl').direction(-0.03, 0, 0)),
                Vector(pin) + Vector(d.frame('pawl').direction(0.085, 0, 0))],
               0.008, sides=8, mat=IRON, shade=rng.uniform(0.9, 1.05))
    machine.washer(build, Frame(pin, d.frame('pawl').rot @ Matrix.Rotation(math.radians(-90), 3, 'Z')),
                   radius=0.018, bore=0.0085, thickness=0.004, segments=14, mat=IRON,
                   shade=rng.uniform(0.9, 1.05))
    # the stay the parked pawl leans on, which is why it stands clear
    stay = d.at('pawl', 0, 0.05, -0.02)
    build.tube([Vector(stay), Vector(stay) + Vector(d.frame('pawl').direction(0.06, 0, 0))],
               0.007, sides=7, mat=IRON, shade=rng.uniform(0.85, 1.0))


def jib(build, d, rng, parity):
    """the jib in two layers, its bored holes, its sheave cheeks and the rope"""
    frame = d.frame('jib')
    outline = machine.rect(0.14, 2.6, chamfer=0.007, facets=6, hollow=0.0006, rng=rng)
    bores = [circle(0.009, 22, (0, -0.53)), circle(0.009, 22, (0, 1.13))]
    housings = [[(a, b) for a, b in machine.rect(0.02, 0.2, chamfer=0.0015, facets=0)]
                for _ in range(4)]
    seats = [(0.055, -0.45), (-0.055, -0.45), (0.055, 1.05), (-0.055, 1.05)]
    housings = [[(x + ox, y + oy) for x, y in ring] for ring, (ox, oy) in zip(housings, seats)]
    stick = (rng.uniform(0, 1), rng.uniform(0, 1))
    tone = rng.uniform(0.78, 1.0)
    with parity.of(build, 'jib'):
        # one beam in two plates, so both take the same place in the library
        # plate and no seam runs down the side of a timber that has none
        dossier.extrude(build, Frame(frame.point(0, -0.021, 0), frame.rot), outline,
                        holes=bores, depth=0.118, plane='XZ', mat=OAK, shade=tone,
                        chamfer=(0.007, 0.0), offset=stick,
                        mouth=[(0.0058, 0.0), (0.0058, 0.0)], grain=2)
        dossier.extrude(build, Frame(frame.point(0, 0.059, 0), frame.rot), outline,
                        holes=bores + housings, depth=0.042, plane='XZ', mat=OAK,
                        shade=tone, chamfer=(0.0, 0.007), offset=stick,
                        mouth=[(0.0, 0.0062), (0.0, 0.0062)] + [(0.0, 0.0012)] * 4,
                        grain=2)
    for at in (-0.53, 1.13):
        for face, want in ((0.0805, 1), (-0.0805, -1)):
            burnish = Frame(frame.point(0, face, at),
                            frame.rot @ Matrix.Rotation(math.radians(0), 3, 'Y'))
            dossier.revolve(build, burnish, [(0.0, 0.0102), (0.0006 * want, 0.0128),
                                             (0.0, 0.0164)], segments=20, mat=OAK,
                            shade=0.52, wobble=0.0002)
    section = machine.rect(0.14, 0.16, chamfer=0.007, facets=0)
    for at in (-0.72, -0.16, 0.62, 1.22):
        machine.band(build, frame, [(x, y) for x, y in section], axis='Z', at=at,
                     width=0.055, thickness=0.007, mat=IRON,
                     shade=rng.uniform(0.82, 1.02), rivets=4, rng=rng, hammer=0.0004)
    for at in (-1.0, -0.24, 0.4, 0.86):
        machine.peg(build, frame.point(0.071, 0.0, at), frame.direction(1, 0, 0),
                    diameter=0.024, proud=0.006, sink=0.03, mat=ENDGRAIN,
                    shade=rng.uniform(0.62, 0.84), tilt=0.0012)

    for part in ('rear-cheek-left', 'rear-cheek-right', 'tip-cheek-left', 'tip-cheek-right'):
        frame = d.frame(part)
        bore = d.dims(part)['holes_yz'][0]
        plate = [(-0.14, -0.1), (-0.14, 0.1), (0.1, 0.1), (0.14, 0.055),
                 (0.14, -0.055), (0.1, -0.1)]
        with parity.of(build, part):
            dossier.extrude(build, frame, plate, holes=[bore], depth=0.02, plane='YZ',
                            mat=OAK, shade=rng.uniform(0.78, 1.0), chamfer=0.003,
                            mouth=[0.0022], grain=1)
        # the bolt through the cheek's foot, standing out of its OUTER face
        out = 1.0 if 'right' in part else -1.0
        for z in (-0.06, 0.06):
            machine.peg(build, frame.point(out * 0.0104, -0.105, z),
                        frame.direction(out, 0, 0), diameter=0.017, proud=0.0045,
                        sink=0.022, mat=IRON, shade=rng.uniform(0.85, 1.02))

    for part in ('rear-axle', 'tip-axle'):
        frame = d.frame(part)
        with parity.of(build, part):
            machine.barrel(build, frame, 0.01, 0.14, crown=0.0004, segments=16,
                           mat=IRON, shade=rng.uniform(0.88, 1.06), wobble=0.0004)
        for side in (-1, 1):
            # the pin's head, standing proud of the cheek it bears against
            machine.collar(build, Frame(frame.point(0, side * 0.0655, 0), frame.rot),
                           radius=0.019, bore=0.0, length=0.013, segments=12, mat=IRON,
                           shade=rng.uniform(0.9, 1.08), taper=0.002)

    # ---- the rope's fixed run, from the drum over both sheaves ---------------
    line = d.dims('hoist-rope')['centreline']
    with parity.of(build, 'hoist-rope'):
        points = resample([d.at('hoist-rope', *p) for p in line[:35]], ROPE_STEP,
                          focus=[d.at('hoist-rope', 0, 2.5, 1.58),
                                 d.at('hoist-rope', 0, 1.1, -0.08)], spread=0.8, coarse=3.2)
        hemp(build, points)


def drum(build, d, rng, parity):
    """the barrel, the ratchet, the axle and the crank, all on the hoist axis"""
    frame = d.frame('drum')
    with parity.of(build, 'drum'):
        machine.barrel(build, frame, 0.075, 0.3, crown=0.0016, segments=32,
                       scores=(0.0,), score_depth=0.0016, mat=OAK,
                       shade=rng.uniform(0.76, 0.98), rng=rng, wobble=0.0009)
        # the band the rope has worn into the barrel, a shade darker than the
        # oak it was turned from
        dossier.revolve(build, frame, [(-0.021, 0.0742), (0.0, 0.0736), (0.021, 0.0742)],
                        segments=32, mat=OAK, shade=0.6, wobble=0.0006)
    for at in (-0.126, 0.126):
        machine.collar(build, Frame(frame.point(0, at, 0), frame.rot), radius=0.0752,
                       bore=0.066, length=0.034, segments=30, mat=IRON,
                       shade=rng.uniform(0.82, 1.02))
    for i in range(6):
        angle = 2 * math.pi * i / 6 + 0.3
        for at in (-0.126, 0.126):
            machine.peg(build, frame.point(0.0745 * math.cos(angle), at,
                                           0.0745 * math.sin(angle)),
                        frame.direction(math.cos(angle), 0, math.sin(angle)),
                        diameter=0.012, proud=0.0035, sink=0.01, mat=IRON, sides=6,
                        shade=rng.uniform(0.86, 1.05))

    frame = d.frame('ratchet')
    with parity.of(build, 'ratchet'):
        teeth = machine.forged(d.dims('ratchet')['coordinates_xz'], rng, 0.0007)
        dossier.extrude(build, frame, teeth, depth=0.02, plane='XZ', mat=IRON,
                        shade=rng.uniform(0.86, 1.06), chamfer=0.0014)
    machine.collar(build, Frame(frame.point(0, 0.022, 0), frame.rot), radius=0.034,
                   bore=0.0205, length=0.024, segments=18, mat=IRON,
                   shade=rng.uniform(0.84, 1.02))

    frame = d.frame('drum-axle')
    with parity.of(build, 'drum-axle'):
        # the axle shows outside its journals and nowhere else: inside the drum
        # it is a bore nobody can see, and a bore nobody can see is bytes
        for centre, length in ((-0.26, 0.36), (0.14, 0.28)):
            machine.barrel(build, Frame(frame.point(0, centre, 0), frame.rot), 0.02,
                           length, crown=0.0004, segments=12, mat=IRON,
                           shade=rng.uniform(0.86, 1.04), wobble=0.0008)
    for at in (-0.12, 0.22):
        machine.collar(build, Frame(frame.point(0, at, 0), frame.rot), radius=0.029,
                       bore=0.0, length=0.02, segments=12, mat=IRON,
                       shade=rng.uniform(0.88, 1.06))
    machine.collar(build, Frame(frame.point(0, -0.352, 0), frame.rot), radius=0.031,
                   bore=0.0, length=0.016, segments=12, mat=IRON, taper=0.004,
                   shade=rng.uniform(0.9, 1.08))
    key = Vector(frame.point(0, -0.33, 0))
    build.tube([key + Vector(frame.direction(0, 0, -0.027)),
                key + Vector(frame.direction(0, 0, 0.027))], 0.0045, sides=6, mat=IRON,
               shade=rng.uniform(0.9, 1.08))

    frame = d.frame('handle')
    with parity.of(build, 'handle'):
        machine.member(build, frame, size=(0.4, 0.04, 0.04), axis='X', chamfer=0.006,
                       facets=3, mat=OAK, end_mat=ENDGRAIN, rng=rng, tone=(0.74, 1.0))
    arm = machine.rect(0.04, 0.04, chamfer=0.006, facets=0)
    for at in (-0.17, 0.17):
        machine.band(build, frame, arm, axis='X', at=at, width=0.045, thickness=0.006,
                     mat=IRON, shade=rng.uniform(0.86, 1.04), rivets=3, rng=rng, hammer=0.0004)

    frame = d.frame('handle-grip')
    with parity.of(build, 'handle-grip'):
        # the one surface on this machine a hand has been round a thousand
        # times, so it is brighter than the iron it is forged from
        machine.barrel(build, frame, 0.015, 0.12, crown=0.0018, segments=16, mat=IRON,
                       shade=1.24, wobble=0.0004)
    for at in (-0.05, 0.05):
        machine.collar(build, Frame(frame.point(0, at, 0), frame.rot), radius=0.0185,
                       bore=0.0, length=0.008, segments=12, mat=IRON,
                       shade=rng.uniform(0.88, 1.06))

    with parity.of(build, 'drum-wrap'):
        line = d.dims('drum-wrap')['centreline']
        hemp(build, [d.at('drum-wrap', *p) for p in line], sides=5)
    with parity.of(build, 'rope-anchor'):
        # the staple the rope's end is made fast to, not a bead on a drum
        eye = d.frame('rope-anchor')
        machine.barrel(build, eye, 0.008, 0.016, crown=0.0006, segments=12, mat=IRON,
                       shade=rng.uniform(0.9, 1.08))
    legs = d.frame('rope-anchor')
    for side in (-1, 1):
        build.tube([legs.point(0.004 * side, 0.0, 0.0), legs.point(0.004 * side, -0.03, 0.0)],
                   0.003, sides=6, mat=IRON, shade=rng.uniform(0.88, 1.05))


def sheave(build, d, rng, parity, part):
    """one pulley wheel, grooved for the rope, on its own bush"""
    frame = d.frame(part)
    with parity.of(build, part):
        machine.sheave(build, frame, radius=0.075, width=0.06, bore=0.012, groove=0.0052,
                       throat=0.52, segments=40, mat=OAK, shade=rng.uniform(0.78, 1.0),
                       wobble=0.0007, shoulder=0.012)
    machine.collar(build, frame, radius=0.0165, bore=0.0105, length=0.062, segments=18,
                   mat=IRON, shade=rng.uniform(0.86, 1.05))


def fall(build, d, rng, parity):
    """the rope from the tip sheave's tangent point down to the load"""
    line = d.dims('hoist-rope')['centreline']
    with parity.of(build, 'hoist-rope'):
        points = resample([d.at('hoist-rope', *p) for p in line[34:]], ROPE_STEP,
                          focus=[d.at('hoist-rope', 0, 2.4, 1.58),
                                 d.at('hoist-rope', 0, 1.0, 1.58)], spread=0.7, coarse=2.4)
        hemp(build, points)


def load(build, d, rng, parity):
    """the stone, dressed and slung, hanging at the foot of its fall"""
    frame = d.frame('load')
    face = (rng.uniform(0, 1), rng.uniform(0, 1))
    with parity.of(build, 'load'):
        knock = [0.004 + rng.uniform(0, 0.008) for _ in range(4)]
        dossier.extrude(build, frame, machine.rect(0.24, 0.24, chamfer=knock, facets=0),
                        depth=0.24, plane='XY', mat=STONE, shade=rng.uniform(1.12, 1.24),
                        chamfer=(0.005, 0.008), offset=face)
    machine.dressed(build, frame, (0.24, 0.24, 0.24), rng=rng, mat=STONE, margin=0.019,
                    courses=7, pitched=0.0042, pick=0.0022, tone=(1.1, 1.26),
                    splay=0.0032, offset=face)
    # the strop: two bights passed right round the block and gathered into the
    # eye the fall ends in, so the stone reads as lifted and not as placed
    lie = 0.1245
    corner = 0.032
    eye = (0.0, 0.138, 0.0)
    for side in (-1, 1):
        x = side * 0.058
        bight = []
        # round the block from one top corner to the other, the long way
        for k in (0, 3, 2, 1):
            angle = math.pi / 4 + math.pi / 2 * k
            cy = (0.12 - corner) * math.copysign(1, math.cos(angle))
            cz = (0.12 - corner) * math.copysign(1, math.sin(angle))
            for j in range(6):
                turn = angle - math.pi / 4 + math.pi / 2 * (5 - j) / 5
                bight.append((x, cy + (corner + lie - 0.12) * math.cos(turn),
                              cz + (corner + lie - 0.12) * math.sin(turn)))
        # and out of each bight a leg rises and gathers into the eye, so the
        # stone hangs IN the sling rather than sitting under a rope laid on it
        legs = [(x * 0.94, 0.128, side * 0.062), (x * 0.52, 0.134, side * 0.03),
                eye, (x * 0.52, 0.134, -side * 0.03), (x * 0.94, 0.128, -side * 0.062)]
        path = [bight[0]] + legs[:2] if False else None
        del path
        loop = [frame.point(*p) for p in
                ([(x, lie, side * 0.088)] + legs + [(x, lie, -side * 0.088)])]
        hemp(build, resample([frame.point(*p) for p in bight], 0.0105),
             radius=0.0043, sides=5)
        hemp(build, resample(loop, 0.009), radius=0.0043, sides=5)
    ring = Frame(frame.point(0, 0.142, 0), frame.rot @ Matrix.Rotation(math.radians(90), 3, 'X'))
    machine.washer(build, ring, radius=0.029, bore=0.014, thickness=0.011, segments=20,
                   mat=IRON, shade=rng.uniform(0.88, 1.06))
    seize = [frame.point(0, 0.112 + 0.008 * i, 0) for i in range(6)]
    hemp(build, resample(seize, 0.006), radius=0.0079, sides=6)


# ------------------------------------------------------------------- the build
def model():
    """every body, its atlas uv, and the parity table against the dossier"""
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    bpy.context.scene.unit_settings.system = 'METRIC'
    palette_materials = palette()
    scale = repeats()
    d = dossier.read(SOURCE)
    parity = dossier.Parity(d)
    rng = random.Random(SEED)

    builds = {name: Build(SEED + i) for i, name in enumerate(ATLAS)}
    bed(builds['bed'], d, rng, parity)
    turntable(builds['frame'], d, rng, parity)
    standing(builds['frame'], d, rng, parity)
    winch(builds['frame'], d, rng, parity)
    jib(builds['jib'], d, rng, parity)
    drum(builds['drum'], d, rng, parity)
    sheave(builds['rear-sheave'], d, rng, parity, 'rear-pulley')
    sheave(builds['tip-sheave'], d, rng, parity, 'tip-pulley')
    fall(builds['fall'], d, rng, parity)
    load(builds['load'], d, rng, parity)

    parts = {}
    for name, build in builds.items():
        parts[name] = build.object(name.replace('-', ' ').title(), palette_materials,
                                   scale, atlas=name)
        before, after = weld(parts[name], 0.00002)
        bake.log('weld', name, before, '->', after, 'verts', build.tris, 'triangles')
        bake.atlas_uv(parts[name])

    rows = parity.table()
    bad = [r for r in rows if not r['ok']]
    missing = parity.missing()
    for row in rows:
        bake.log('parity', row['id'], row['declared'], row['built'],
                 f"{row['drift'] * 100:.2f}%", '' if row['ok'] else 'DRIFT')
    bake.log('parity rows', len(rows), 'drifting', len(bad), 'unbuilt', missing)
    points = [dossier.to_dossier(p) for build in builds.values() for p in build.v]
    span = [round(max(p[i] for p in points) - min(p[i] for p in points), 4) for i in range(3)]
    floor = round(min(p[1] for p in points), 4)
    bake.log('bounds', span, 'floor', floor, 'triangles',
             sum(b.tris for b in builds.values()))
    scene = bpy.context.scene
    scene['object'] = {'id': ID, 'seed': SEED, 'bounds_m': span, 'floor_m': floor,
                       'parity_rows': len(rows), 'parity_drifting': len(bad),
                       'parts_unbuilt': len(missing),
                       'triangles': sum(b.tris for b in builds.values())}
    scene['parity'] = [f"{r['id']}|{r['declared']}|{r['built']}|{r['drift']}|{r['material']}"
                       for r in rows]
    return parts


PARTS = tuple(ATLAS)


def parts_in_file():
    return {name: bpy.data.objects[name.replace('-', ' ').title()] for name in PARTS}


VIEWS = (
    # every camera is written in the DOSSIER's own axes and turned into
    # Blender's on the way in, so a station reads the same here and in the app
    ('whole', (4.6, 2.0, 3.9), (0.0, 1.35, 0.45), 42),
    ('head', (0.95, 2.95, 2.35), (0.0, 2.6, 1.52), 40),
    ('winch', (1.28, 1.52, -0.95), (0.02, 1.09, -0.03), 44),
    ('crank', (-1.2, 1.44, 0.96), (-0.16, 1.0, 0.0), 46),
    ('fall', (0.6, 1.55, 2.35), (0.0, 1.15, 1.58), 40),
    ('deck', (1.6, 0.95, 1.5), (0.0, 0.45, 0.1), 46),
    ('stone', (-0.72, 1.05, -1.35), (0.0, 0.78, -0.62), 40),
)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--stage', choices=['model', 'bake', 'export', 'all'], default='all')
    parser.add_argument('--size', type=int, default=0)
    parser.add_argument('--samples', type=int, default=96)
    parser.add_argument('--preview', default='')
    parser.add_argument('--only', default='', help='bake one body rather than all of them')
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    args = parser.parse_args(argv)
    work = paths.work(ID)
    blend = work / f'{ID}.blend'
    atlas = work / 'atlas'
    top = args.size or max(ATLAS.values())
    ratio = top / max(ATLAS.values())
    sizes = {name: [max(64, int(side * ratio)), max(64, int(side * ratio / 2)),
                    max(64, int(side * ratio / 4))] for name, side in ATLAS.items()}

    if args.stage in ('model', 'all') or not blend.exists():
        model()
        bpy.ops.wm.save_as_mainfile(filepath=str(blend))
    else:
        bpy.ops.wm.open_mainfile(filepath=str(blend))

    if args.preview:
        for name, at, to, fov in VIEWS:
            bake.preview(work / f'preview-{args.preview}-{name}.png',
                         at=dossier.to_blender(at), to=dossier.to_blender(to), fov=fov,
                         size=(1100, 760), samples=48)
        return

    if args.stage in ('bake', 'all'):
        wanted = parts_in_file()
        if args.only:
            wanted = {n: p for n, p in wanted.items() if n in args.only.split(',')}
        maps = bake.atlases(wanted, folder=atlas, sizes=sizes, samples=args.samples)
        bpy.ops.wm.save_as_mainfile(filepath=str(blend))
        bake.log('atlases', {k: sorted(v) for k, v in maps.items()})

    if args.stage in ('export', 'all'):
        if args.stage == 'export':
            bpy.ops.wm.open_mainfile(filepath=str(blend))
        parts = parts_in_file()
        source = Path(__file__).resolve()
        nodes = [{**node, 'pivot': tuple(dossier.to_blender(node['pivot']))}
                 for node in NODES]
        tiers = {}
        for index, tier in enumerate(('hero', 'standard', 'calm')):
            size = {name: sizes[name][index] for name in parts}
            out = work / f'{ID}-{tier}-raw.glb'
            tiers[tier] = {**bake.export(parts, folder=atlas, out=out, name=ID, size=size,
                                         nodes=nodes),
                           'atlas': max(size.values()), 'texture_limit': max(size.values()),
                           'sheets': size}
        scene = bpy.context.scene
        bake.receipt(work / 'build.json', {
            'id': ID, 'scope': SCOPE, 'name': 'Revolving crane',
            'date': DATE, 'app': str(paths.app_root()), 'store': str(paths.store()),
            'models': str(paths.models(SCOPE, ID)),
            'label': LABEL, 'certainty': CERTAINTY,
            'category': 'machine', 'period_fit': 'plausible-1490',
            'script': str(source.relative_to(source.parents[3])),
            'script_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
            'blend': str(blend), 'work': str(work), 'atlas': str(atlas),
            'measurements': plain(scene['object']),
            'parity': plain(scene['parity']),
            'nodes': [{'name': n['name'], 'parent': n['parent'], 'pivot': n['pivot'],
                       'parts': n['parts']} for n in NODES],
            'library': [{'id': f'library/{name}', 'licence': materials.record(name)['licence']}
                        for name in sorted(set(SETS))],
            'sets': sorted(set(SETS)),
            'maps': ['albedo', 'normal', 'orm'],
            'parts': list(PARTS),
            'texels_per_m': min(int(bake.texel_density(part, side=ATLAS[name]))
                                for name, part in parts.items()),
            'texels_per_m_by_part': {name: int(bake.texel_density(part, side=ATLAS[name]))
                                     for name, part in parts.items()},
            'note': ('Revolving crane of Manuscript B 49r, built part by part from its '
                     'engineering dossier: squared oak with planed arrises, bored rope '
                     'holes with worn mouths, a turned drum in bored journals, a forged '
                     'ratchet of twenty four teeth with its pawl parked clear, sheaves '
                     'between cheeks on their axles, a three strand hemp rope reeved over '
                     'both sheaves, and dressed stone for the counterweight and the load. '
                     'Every dimension is a modern demonstration choice. The moving '
                     'assemblies are named nodes with their origin at the dossier joint. '
                     'No light is baked: the atlases carry colour, relief, roughness, '
                     'metal and occlusion, and the occlusion reaches the ambient term '
                     'only.'),
            'tiers': tiers,
        })


if __name__ == '__main__':
    main()
