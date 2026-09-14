"""THE MACHINE SHOP — what a machine needs that a building does not.

The building modules of this kit lay a wall, a roof and an opening. A machine
is a different animal: it is squared members with the arris a plane took off,
turned bodies that went round on a pole lathe, forged teeth that came off an
anvil one at a time, bores with a mouth a rope has worn, and the pegs, wedges,
hoops and straps that hold all of it together. None of that can be painted on,
because a machine is looked at from half a metre by people who want to know
how it works.

Everything here is one idea: a SECTION swept along an axis. A squared oak
member is a rectangle with its corners taken off and a few shallow hollows
left by the plane, swept down its own length. An iron hoop is the same
rectangle grown outward with the member's own section as its hole. A drum is a
crowned profile turned about its axis, a sheave is the same with a groove for
the rope, a ratchet is a polygon forged tooth by tooth. Because they are all
sections, they all go through the dossier reader's own extruder, they are all
closed, and their winding is measured rather than reasoned about.

Two rules the module keeps. Nothing here changes a declared dimension: a
groove is cut inward from the declared radius, never proud of it, and a
chamfer takes material off rather than adding it. And everything takes a
seeded random hand, so the same script makes the same machine twice.
"""

import math

from mathutils import Vector

from . import dossier
from .mesh import Build, Frame

AXIS_PLANE = {'X': 'YZ', 'Y': 'XZ', 'Z': 'XY'}


# --------------------------------------------------------------- the sections
def rect(width, height, *, chamfer=0.006, facets=0, hollow=0.0004, rng=None,
         waney=0.0):
    """the section of a squared timber: four faces, four arrises off it.

    `facets` is the plane's own chatter. A face left by a hand plane is not
    flat, it is two or three shallow hollows running WITH the grain, and at a
    raking sun that is the difference between oak and a printed box. They are
    a tenth of a millimetre deep and they cost four points a face."""
    half_w, half_h = width / 2, height / 2
    # one chamfer, or one per corner: a stone's arris is knocked about and a
    # planed timber's is not, and both are the same call
    wanted = chamfer if isinstance(chamfer, (tuple, list)) else [chamfer] * 4
    cuts = [min(c, half_w * 0.6, half_h * 0.6) for c in wanted]
    cut = cuts[0]
    pick = (lambda: rng.uniform(0.35, 1.0)) if rng else (lambda: 0.7)

    def run(a, b, inward):
        """one face, from corner a to corner b, hollowed toward `inward`"""
        out = []
        steps = max(1, facets)
        for i in range(1, steps):
            t = i / steps
            point = Vector(a).lerp(Vector(b), t)
            out.append(tuple(point + inward * hollow * pick()))
        return out

    corners = [
        ((half_w - cuts[0], -half_h), (half_w, -half_h + cuts[0])),
        ((half_w, half_h - cuts[1]), (half_w - cuts[1], half_h)),
        ((-half_w + cuts[2], half_h), (-half_w, half_h - cuts[2])),
        ((-half_w, -half_h + cuts[3]), (-half_w + cuts[3], -half_h)),
    ]
    normals = [Vector((0, 1)), Vector((-1, 0)), Vector((0, -1)), Vector((1, 0))]
    ring = []
    for i, (start, end) in enumerate(corners):
        ring.append(start)
        ring.append(end)
        nxt = corners[(i + 1) % 4][0]
        ring.extend(run(end, nxt, normals[(i + 1) % 4]))
    if waney:
        ring = [(x, y + waney * math.sin(3.1 * x / max(1e-4, half_w))) for x, y in ring]
    return ring


def ring_of(radius, sides=24, *, start=0.0, wobble=0.0, rng=None):
    """a round section, optionally off true the way a hand forged band is"""
    out = []
    for i in range(sides):
        angle = start + 2 * math.pi * i / sides
        r = radius * (1 + (rng.uniform(-wobble, wobble) if rng and wobble else 0.0))
        out.append((r * math.cos(angle), r * math.sin(angle)))
    return out


def hewn(radius, *, sides=24, facets=8, depth=0.0022, rng=None, jitter=0.0):
    """the section of a spar an axe left round: eight shallow flats with the
    full radius standing at every corner between them.

    The corners keep the declared radius exactly, and they are placed where
    the sample grid already has a vertex, so a hewn spar measures the same as
    the round one the dossier declares. The flats are what catches a low sun
    and the reason a pole reads as worked rather than turned."""
    step = math.pi * 2 / facets
    out = []
    for i in range(sides):
        angle = 2 * math.pi * i / sides
        nearest = round((angle - step / 2) / step) * step + step / 2
        r = min(radius, (radius - depth) / max(0.2, math.cos(angle - nearest)))
        if rng and jitter:
            r -= rng.uniform(0, jitter)
        out.append((r * math.cos(angle), r * math.sin(angle)))
    return out


def grown(section, amount):
    """the same section, `amount` metres outward: a hoop around a member"""
    return dossier._shrink(section, -amount)


def forged(ring, rng, amount=0.0006):
    """a polygon that came off an anvil rather than out of a formula: every
    vertex moved a fraction of a millimetre along its own radius"""
    out = []
    for x, y in ring:
        length = math.hypot(x, y)
        if length < 1e-9:
            out.append((x, y))
            continue
        scale = 1 + rng.uniform(-amount, amount) / length
        out.append((x * scale, y * scale))
    return out


# ---------------------------------------------------------------- the members
def _grain_axis(frame, axis):
    """which WORLD axis a member's own axis lies closest to"""
    direction = frame.direction(*{'X': (1, 0, 0), 'Y': (0, 1, 0), 'Z': (0, 0, 1)}[axis])
    return max(range(3), key=lambda i: abs(direction[i]))


def member(build, frame, centre=(0, 0, 0), size=(0.1, 1.0, 0.1), axis='Y', *,
           chamfer=0.006, facets=3, hollow=0.0005, mat=0, end_mat=None, shade=None,
           tone=(0.72, 1.05), rng=None, ends=True, end_chamfer=0.0015, offset=None,
           waney=0.0):
    """a squared timber, in the frame's own axes, with its grain down its length.

    `size` is the dossier's own (x, y, z) box and `axis` says which of the
    three the member runs along, so the call site never has to reorder its own
    numbers. The end grain takes its own material where one is given, because
    a sawn end is a different surface from a riven face and reading the same
    plate on both is the tell of a body nobody looked at."""
    order = {'X': (1, 2, 0), 'Y': (0, 2, 1), 'Z': (0, 1, 2)}[axis]
    width, height, length = (size[order[0]], size[order[1]], size[order[2]])
    section = rect(width, height, chamfer=chamfer, facets=facets, hollow=hollow,
                   rng=rng, waney=waney)
    at = {'X': (centre[1], centre[2]), 'Y': (centre[0], centre[2]),
          'Z': (centre[0], centre[1])}[axis]
    section = [(x + at[0], y + at[1]) for x, y in section]
    along = centre[order[2]]
    grain = _grain_axis(frame, axis)
    tone_value = shade if shade is not None else (build.tone(*tone) if rng is None else rng.uniform(*tone))
    body = Frame(frame.point(*[(along if i == order[2] else 0) for i in range(3)]), frame.rot)
    dossier.extrude(build, body, section, depth=length, plane=AXIS_PLANE[axis],
                    mat=mat, shade=tone_value, chamfer=end_chamfer if ends else 0.0,
                    grain=grain, offset=offset)
    if end_mat is not None and ends:
        # the sawn ends again in their own material, a hair proud of the cut so
        # the two surfaces do not fight for the same depth
        inner = dossier._shrink(section, end_chamfer)
        for side in (-1, 1):
            dossier.polygon(build, body, inner, plane=AXIS_PLANE[axis],
                            at=side * (length / 2 + 0.00012),
                            want=_axis_vector(axis, side), mat=end_mat,
                            shade=tone_value * 0.96)
    return section


def _axis_vector(axis, sign=1):
    return {'X': (sign, 0, 0), 'Y': (0, sign, 0), 'Z': (0, 0, sign)}[axis]


def band(build, frame, section, axis='Y', *, at=0.0, width=0.05, thickness=0.008,
         mat=0, shade=1.0, rivets=0, rivet=0.015, rng=None, proud=0.0002, hammer=0.0):
    """an iron band round a member, with the member's own section as its hole.

    A band drawn as a box lying on a beam is the commonest wrong iron in a
    reconstruction. This one is a closed ring: it has an inside face against
    the timber, an outside face, two edges, and it wraps the chamfers.
    `hammer` moves each vertex of the outer face a fraction of a millimetre,
    which is the difference between a band that was forged and one that was
    extruded."""
    origin = Frame(frame.point(*[(at if 'XYZ'[i] == axis else 0) for i in range(3)]), frame.rot)
    inner = dossier._shrink(section, -proud)
    outer = dossier._shrink(section, -(proud + thickness))
    if hammer and rng:
        outer = [(x + rng.uniform(-hammer, hammer), y + rng.uniform(-hammer, hammer))
                 for x, y in outer]
    dossier.extrude(build, origin, outer, holes=[inner], depth=width,
                    plane=AXIS_PLANE[axis], centred=True, mat=mat, shade=shade,
                    chamfer=min(0.0018, thickness * 0.35))
    if rivets:
        # a rivet is driven through the flat of a strap, never through the
        # arris it wraps, so the heads are placed by face and not by vertex
        flats = [i for i, (u, v) in enumerate(outer)
                 if min(abs(u), abs(v)) > 0.32 * max(abs(u), abs(v))] or list(range(len(outer)))
        del flats
        step = max(1, len(outer) // rivets)
        for i in range(rivets):
            u, v = outer[(i * step + step // 2) % len(outer)]
            normal = Vector((u, v))
            if normal.length < 1e-9:
                continue
            normal.normalize()
            local = dossier._plane_point(AXIS_PLANE[axis], u, v, 0.0)
            out = dossier._plane_point(AXIS_PLANE[axis], normal.x, normal.y, 0.0)
            head = Vector(origin.point(*local))
            direction = Vector(origin.direction(*out))
            build.tube([head, head + direction * 0.004], rivet / 2, sides=7, mat=mat,
                       shade=shade * (1 + (rng.uniform(-0.05, 0.05) if rng else 0)))
    return origin


def peg(build, at, direction, *, diameter=0.022, proud=0.008, sink=0.02, mat=0,
        shade=1.0, sides=7, tilt=0.0):
    """an oak peg driven through a joint, its head standing proud and never
    quite square to the face it pins"""
    start = Vector(at)
    axis = Vector(direction).normalized()
    side = axis.cross(Vector((0, 0, 1)))
    if side.length < 1e-6:
        side = axis.cross(Vector((1, 0, 0)))
    side.normalize()
    head = start + axis * proud + side * tilt
    build.tube([start - axis * sink, head], diameter / 2, sides=sides, mat=mat, shade=shade)
    build.disc(head, axis, diameter / 2 * 0.94, sides=sides, mat=mat, shade=shade * 1.03)
    return 1


def wedge(build, frame, centre, size, axis='Y', *, taper=0.45, mat=0, shade=1.0):
    """the wedge that tightens a through tenon: a tapered slab in a slot"""
    width, height, length = size
    section_a = rect(width, height, chamfer=0.0012, facets=0)
    section_b = rect(width, height * taper, chamfer=0.0012, facets=0)
    plane = AXIS_PLANE[axis]
    body = Frame(frame.point(*centre), frame.rot)
    near = [(x, y) for x, y in section_a]
    far = [(x, y) for x, y in section_b]
    dossier._cap(build, body, plane, [near], -length / 2, _neg(_axis_vector(axis)),
                 mat, shade, None, None)
    dossier._cap(build, body, plane, [far], length / 2, _axis_vector(axis),
                 mat, shade, None, None)
    dossier._band(build, body, plane, near, -length / 2, far, length / 2, True,
                  mat, shade, None, None)
    return 1


def _neg(v):
    return tuple(-c for c in v)


# ------------------------------------------------------------- turned bodies
def barrel(build, frame, radius, length, *, axis='Y', crown=0.0008, segments=28,
           scores=(), score_depth=0.0012, mat=0, shade=1.0, rng=None, wobble=0.0006,
           ends=True, bore=0.0):
    """a body that went round on a lathe: a barrel with a crown in the middle,
    a score or two where a rope has cut in, and the pole lathe's own wander.

    The crown is what stops a rope walking off a drum and the reason a real
    barrel is never a cylinder. It is cut INWARD from the declared radius at
    the ends, so the widest point of the built body is the declared one."""
    profile = []
    steps = 16
    marks = sorted(scores)
    for i in range(steps + 1):
        t = i / steps
        axial = -length / 2 + t * length
        belly = radius - crown * (2 * abs(t - 0.5)) ** 1.6 * 2
        for mark in marks:
            belly -= score_depth * math.exp(-((axial - mark) / 0.006) ** 2)
        profile.append((axial, belly))
    inner = max(bore, 0.0004)
    closed = [(a, r) for a, r in profile]
    if ends:
        closed = closed + [(length / 2, inner), (-length / 2, inner)]
    return dossier.revolve(build, frame, closed, segments=segments, axis='+Y' if axis == 'Y' else axis,
                           mat=mat, shade=shade, wobble=wobble)


def sheave(build, frame, *, radius, width, bore, groove=0.0045, throat=0.62,
           segments=32, mat=0, shade=1.0, wobble=0.0005, shoulder=0.011):
    """a pulley wheel: a rim with a rope groove cut into it, a hub, a bore.

    The groove is cut DOWN from the declared radius, never up: the dossier
    says the rope is tangent to the rim, so the rim's crest is the declared
    number and the rope lies across the score between two shoulders."""
    half = width / 2
    lip = width * (1 - throat) / 2
    profile = [
        (-half, bore),
        (-half, radius - 0.0),
        (-half + lip, radius),
        (-half + lip * 1.25, radius - groove),
        (0.0, radius - groove * 1.08),
        (half - lip * 1.25, radius - groove),
        (half - lip, radius),
        (half, radius),
        (half, bore),
        (half - shoulder, bore + 0.004),
        (half - shoulder * 1.6, bore + 0.0035),
        (-half + shoulder * 1.6, bore + 0.0035),
        (-half + shoulder, bore + 0.004),
    ]
    return dossier.revolve(build, frame, profile, segments=segments, mat=mat,
                           shade=shade, wobble=wobble)


def washer(build, frame, *, radius, bore, thickness, segments=20, mat=0, shade=1.0):
    """the iron washer between a turning wheel and the cheek it runs against"""
    profile = [(-thickness / 2, bore), (-thickness / 2, radius),
               (thickness / 2, radius), (thickness / 2, bore)]
    return dossier.revolve(build, frame, profile, segments=segments, mat=mat, shade=shade)


def collar(build, frame, *, radius, bore, length, segments=16, mat=0, shade=1.0,
           taper=0.0):
    """a forged collar or a gudgeon's boss on an axle.

    A bore of nothing is not nothing: a profile that touches its own axis
    sweeps a strip of zero area faces down it, whose normals are undefined and
    whose bake is a black line. A solid end closes on a needle instead."""
    bore = max(bore, 0.0004)
    profile = [(-length / 2, bore), (-length / 2, radius),
               (length / 2, radius - taper), (length / 2, bore)]
    return dossier.revolve(build, frame, profile, segments=segments, mat=mat, shade=shade)


# ----------------------------------------------------------------- the stone
def dressed(build, frame, size, *, mat=0, margin=0.032, courses=7, pitched=0.0009,
            rng=None, tone=(0.86, 1.04), faces=None, strokes=True, pick=0.0016,
            offset=None, splay=0.0024):
    """the mason's work on a block whose body another call laid.

    A drafted margin round every face with the chisel runs still in it, and
    between the margins a field left proud off the point, in courses that are
    not a ruled grid. The field stands OUT of the face rather than sinking
    into it, so the block still measures what the dossier declares, and at a
    low sun the draft and the field catch the light differently, which is the
    whole reason a stone is dressed that way.

    `offset` is ONE place in the library plate for the WHOLE block. Every kit
    call otherwise takes its own, which is right for a hundred bricks and
    wrong for one stone: a face made of forty strips at forty different
    offsets reads as veneer, and that is exactly what a judge calls
    cardboard."""
    half = [s / 2 for s in size]
    every = faces or ((0, 1, 0), (0, -1, 0), (1, 0, 0), (-1, 0, 0), (0, 0, 1), (0, 0, -1))
    pull = (lambda a, b: rng.uniform(a, b)) if rng else (lambda a, b: (a + b) / 2)
    laid = 0
    for normal in every:
        centre = [normal[i] * half[i] for i in range(3)]
        plane = Frame(frame.point(*centre), frame.rot @ _face_rot(normal))
        if abs(normal[1]):
            width, height = 2 * half[0], 2 * half[2]
        elif abs(normal[0]):
            width, height = 2 * half[1], 2 * half[2]
        else:
            width, height = 2 * half[0], 2 * half[1]
        if min(width, height) < 2.5 * margin:
            continue
        shade = pull(*tone)
        rows = max(1, courses)
        step = (height - 2 * margin) / rows
        for i in range(rows):
            row = -height / 2 + margin + (i + 0.5) * step
            rise = pitched * pull(0.08, 1.0)
            # one course in three is picked deeper, which is how a face off the
            # point reads: not a corduroy, a surface with weather in it
            deep = pull(0.0, 1.0) < 0.34
            build.raised(plane, (0, row), (width - 2 * margin + pull(-0.004, 0.004),
                                           step * pull(0.92, 1.06)),
                         (rise, rise * pull(0.2, 0.8)) if not deep else
                         (rise - pick, rise * 0.3),
                         splay=splay, mat=mat, offset=offset,
                         shade=shade * (1 + pull(-0.035, 0.035)))
        # the second scale: the point's own marks across the courses, which is
        # what stops a dressed face reading as corduroy
        across = max(2, int((width - 2 * margin) / 0.055))
        for i in range(rows):
            row = -height / 2 + margin + (i + 0.5) * step
            for j in range(across):
                x = -width / 2 + margin + (j + 0.5) * (width - 2 * margin) / across
                if pull(0.0, 1.0) < 0.52:
                    continue
                build.raised(plane, (x + pull(-0.006, 0.006), row + pull(-0.008, 0.008)),
                             ((width - 2 * margin) / across * pull(0.4, 0.8),
                              step * pull(0.3, 0.6)),
                             (pitched * pull(0.2, 0.8), pitched * pull(0.05, 0.5)),
                             splay=splay * 1.1, mat=mat, offset=offset,
                             shade=shade * (1 + pull(-0.05, 0.05)))
        if not strokes:
            laid += 1
            continue
        # the drafted margin, worked across with a chisel the width of a thumb
        for side in (-1, 1):
            runs = max(2, int(width / 0.05))
            for i in range(runs):
                x = -width / 2 + (i + 0.5) * width / runs
                build.raised(plane, (x, side * (height - margin) / 2),
                             (width / runs * 0.92, margin * 0.72),
                             (0.00016, 0.00042 * pull(0.4, 1.0)), splay=0.0012, mat=mat,
                             offset=offset, shade=shade * (1 + pull(-0.02, 0.02)))
            runs = max(2, int(height / 0.05))
            for i in range(runs):
                y = -height / 2 + (i + 0.5) * height / runs
                build.raised(plane, (side * (width - margin) / 2, y),
                             (margin * 0.72, height / runs * 0.92),
                             (0.00016, 0.00042 * pull(0.4, 1.0)), splay=0.0012, mat=mat,
                             offset=offset, shade=shade * (1 + pull(-0.02, 0.02)))
        laid += 1
    return laid


def _face_rot(normal):
    from mathutils import Matrix
    n = Vector(normal)
    if abs(n.z) > 0.9:
        up = Vector((0, 1, 0))
    else:
        up = Vector((0, 0, 1))
    x = up.cross(n).normalized()
    z = n.cross(x).normalized()
    return Matrix((x, n, z)).transposed()


def slab(build, frame, centre, size, axis='Y', *, mat=0, shade=1.0, chamfer=0.0012,
         facets=0, rng=None):
    """a plain chamfered plate in the frame's own axes: a cheek, a packing
    piece, a shoe, a key. The same sweep as a member without its grain rule."""
    order = {'X': (1, 2, 0), 'Y': (0, 2, 1), 'Z': (0, 1, 2)}[axis]
    width, height, length = (size[order[0]], size[order[1]], size[order[2]])
    section = rect(width, height, chamfer=chamfer, facets=facets, rng=rng)
    at = {'X': (centre[1], centre[2]), 'Y': (centre[0], centre[2]),
          'Z': (centre[0], centre[1])}[axis]
    section = [(x + at[0], y + at[1]) for x, y in section]
    body = Frame(frame.point(*[(centre[order[2]] if i == order[2] else 0) for i in range(3)]),
                 frame.rot)
    dossier.extrude(build, body, section, depth=length, plane=AXIS_PLANE[axis],
                    mat=mat, shade=shade, chamfer=chamfer * 0.8)
    return section
