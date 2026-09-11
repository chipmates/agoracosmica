"""Rope: a helix along a curve.

Rope drawn as a smooth tube is the single most reliable tell of a machine that
has never been looked at closely, because what makes rope read as rope is the
lay: three strands winding along its length, each one catching the light on
its own side. So this is a true swept helix. The strand centres travel around
the axis once per `lay` metres and each strand is a tube in its own right,
which costs a few hundred triangles a metre and is worth every one of them at
the distance a hand would reach for it.

`catenary` gives the curve a hanging rope actually takes under its own weight,
so a coil on a peg or a line between two rings falls the way rope falls.
"""

import math

from mathutils import Vector

from .mesh import Build


def _frames(points):
    """a stable pair of normals along a polyline, carried from segment to
    segment so the strands do not spin where the curve turns"""
    out = []
    reference = None
    for i, p in enumerate(points):
        ahead = points[min(i + 1, len(points) - 1)]
        behind = points[max(i - 1, 0)]
        axis = (ahead - behind)
        if axis.length < 1e-9:
            axis = Vector((0, 0, 1))
        axis.normalize()
        if reference is None:
            reference = Vector((0, 0, 1)) if abs(axis.z) < 0.9 else Vector((1, 0, 0))
        u = axis.cross(reference)
        if u.length < 1e-6:
            u = axis.cross(Vector((0, 1, 0)))
        u.normalize()
        w = axis.cross(u).normalized()
        reference = w
        out.append((p, u, w))
    return out


def along_curve(build, points, *, radius=0.019, strands=3, lay=0.24, sides=5, mat=0,
          tone=(0.72, 1.06), shade=None):
    """rope along a polyline. `lay` is how far one twist travels."""
    points = [Vector(p) for p in points]
    if len(points) < 2:
        return 0
    frames = _frames(points)
    lengths = [0.0]
    for i in range(1, len(points)):
        lengths.append(lengths[-1] + (points[i] - points[i - 1]).length)
    core = radius * (1 - 1.0 / (1 + strands * 0.55))
    strand = radius - core
    laid = 0
    for s in range(strands):
        phase = 2 * math.pi * s / strands
        path = []
        for (p, u, w), run in zip(frames, lengths):
            angle = phase + 2 * math.pi * run / max(1e-3, lay)
            path.append(p + (u * math.cos(angle) + w * math.sin(angle)) * core)
        build.tube(path, strand, sides=sides, mat=mat,
                   shade=build.tone(*tone) if shade is None else shade, close=False)
        laid += 1
    return laid


def catenary(a, b, slack=1.15, steps=16, drop=None):
    """the curve a rope of `slack` times the straight distance hangs in"""
    a, b = Vector(a), Vector(b)
    span = b - a
    flat = Vector((span.x, span.y, 0)).length
    if flat < 1e-6 and drop is None:
        return [a, b]
    drop = max(0.0, (slack - 1.0)) * flat * 0.9 if drop is None else drop
    out = []
    for i in range(steps + 1):
        t = i / steps
        p = a + span * t
        p.z -= drop * math.sin(math.pi * t) ** 0.86
        out.append(p)
    return out


def hank(build, at, direction, *, turns=3, drop=0.52, rope_radius=0.016, spread=0.045,
         mat=0, tone=(0.7, 1.02)):
    """a hank on a peg: several bights of the same rope hanging side by side,
    which is how rope is kept when it is not in use"""
    at = Vector(at)
    axis = Vector(direction).normalized()
    up = Vector((0, 0, 1))
    side = axis.cross(up).normalized() if abs(axis.z) < 0.9 else Vector((1, 0, 0))
    laid = 0
    for turn in range(turns):
        along = axis * ((turn - (turns - 1) / 2) * rope_radius * 2.4)
        a = at + along - side * spread
        b = at + along + side * spread
        laid += along_curve(build, catenary(a, b, steps=13, drop=drop * (1 - 0.12 * turn)),
                            radius=rope_radius, mat=mat, tone=tone)
    return laid


# the kit's own name for it, kept short at the call site
along = along_curve
