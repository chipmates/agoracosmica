"""Roofing, laid course by course.

A roof is the one surface of a building that is nearly always faked, and it is
the one that gives a fake away fastest: a photographed roof is flat at the
eaves, and a real one is a broken line of four thousand small edges, each tile
lapping the two under it, each hung a fraction out of true. So the courses
here are individual tiles standing proud of the batten plane by their own
thickness, which is what draws the shadow line at the foot of every course,
and the eaves course is doubled the way a tiler doubles it.

`slope` lays one plane of a roof, `pyramid` lays the four slopes of a square
one, `ridge` runs the capping tiles along any line (a hip, a ridge, a barge),
and `finial` sets the pot on top. The gauge is how much of each tile shows;
the lap is the rest of it.
"""

import math

from .mesh import Build, Frame


def slope(build, frame, *, run, half_at_eaves, taper=0.0, tile=(0.23, 0.36),
          gauge=0.14, thickness=0.022, overhang=0.0, mat=0, tone=(0.72, 1.2),
          jitter=0.008, double_eaves=True, splay=0.004):
    """one plane of tiling on a frame whose z runs up the slope.

    `run` is the slope length from the eaves to the top, `half_at_eaves` the
    half width there, `taper` how much that half width loses per metre of run
    (the cosine of the pitch for a hip, zero for a gable), and `overhang` how
    far the first course hangs below the frame's own line."""
    laid = 0
    courses = max(1, int(round(run / gauge)))
    length = tile[1]
    for course in range(courses):
        foot = course * gauge - overhang
        half = half_at_eaves - max(0.0, foot + overhang) * taper
        if half <= tile[0] * 0.6:
            break
        count = max(1, int(round(2 * half / tile[0])))
        step = 2 * half / count
        # every other course starts half a tile over, so no perpend runs up
        # the roof: a tiler breaks the joint exactly as a mason does
        stagger = (course % 2) * step / 2
        # a tile is cut to the hip at its HEAD, not at its foot: the slope has
        # already narrowed by the time the top of the tile gets there, and a
        # course clipped at its foot walks out over the hip in a sawtooth
        head = half_at_eaves - max(0.0, foot + overhang + length) * taper
        for i in range(count + (1 if stagger else 0)):
            x = -half + (i + 0.5) * step - stagger
            if x + step / 2 < -half - 0.01 or x - step / 2 > half + 0.01:
                continue
            limit = max(head, 0.0)
            if abs(x) - step / 2 > limit:
                continue
            width = min(step, 2 * (limit - abs(x)) + step * 0.62) * (1.0 + build.jitter(jitter * 0.3))
            if width < step * 0.3:
                continue
            long = length * (1.0 + build.jitter(jitter))
            lift = thickness * (1.0 + build.jitter(jitter * 2))
            build.raised(frame, (x + build.jitter(jitter * 0.4), foot + long / 2),
                         (width * 0.985, long), (2 * lift, lift),
                         splay=splay, mat=mat, shade=build.tone(*tone))
            laid += 1
        if course == 0 and double_eaves:
            # the tiler's own doubled first course over a tilting fillet: this
            # is why an eaves line reads thicker than one tile
            for i in range(count):
                x = -half + (i + 0.5) * step
                build.raised(frame, (x, foot + gauge * 0.55), (step * 0.99, gauge * 1.35),
                             (thickness * 1.9, thickness * 0.9), splay=splay, mat=mat,
                             shade=build.tone(*tone))
                laid += 1
    return laid


def pyramid(build, *, half, eaves, pitch, tile=(0.23, 0.36), gauge=0.14,
            thickness=0.022, mat=0, sides=4, **kw):
    """the four slopes of a square roof, meeting over the middle of the plan"""
    angle = math.radians(pitch)
    run = half / math.cos(angle)
    laid = 0
    for i in range(sides):
        frame = Frame.face(i, half, sides=sides).moved(0, 0, eaves).sloped(pitch)
        laid += slope(build, frame, run=run, half_at_eaves=half, taper=math.cos(angle),
                      tile=tile, gauge=gauge, thickness=thickness, mat=mat, **kw)
    return {'tiles': laid, 'apex': eaves + half * math.tan(angle), 'run': run}


def ridge(build, a, b, *, width=0.17, height=0.08, tile=0.34, mat=0,
          tone=(0.7, 1.02), overhang=0.0):
    """capping tiles along a hip or a ridge: half round rolls, lapped.

    Where two slopes meet, neither is weathertight, and the roll that closes
    the joint is the line the eye follows down a hip from the finial."""
    from mathutils import Vector
    start, end = Vector(a), Vector(b)
    span = end - start
    length = span.length
    if length < 1e-6:
        return 0
    direction = span.normalized()
    start = start - direction * overhang
    length += overhang
    rot = direction.to_track_quat('X', 'Z').to_matrix()
    count = max(1, int(math.ceil(length / tile)))
    step = length / count
    laid = 0
    for i in range(count):
        at = start + direction * ((i + 0.5) * step)
        build.prism(Frame(at, rot), (0, 0, 0), (step * 1.06, width, height),
                    mat=mat, shade=build.tone(*tone))
        laid += 1
    return laid


def finial(build, at, *, radius=0.14, height=0.46, mat=0, sides=12):
    """the pot over the apex, where four hips meet and none of them is
    weathertight on its own"""
    from mathutils import Vector
    base = Vector(at)
    build.tube([base, base + Vector((0, 0, height * 0.55)), base + Vector((0, 0, height))],
               lambda t: radius * (1.0 - 0.62 * t ** 1.4), sides=sides, mat=mat,
               shade=build.tone(0.8, 1.0))
    build.tube([base + Vector((0, 0, -0.02)), base + Vector((0, 0, 0.08))],
               radius * 1.22, sides=sides, mat=mat, shade=build.tone(0.8, 1.0))
    return 2
