"""The dressings: the cut stone a brick building needs where brick will not do.

Every opening in a masonry wall is a stone problem. The jambs carry the load
around the hole, the lintel spans it and has to be SEEN to bear on something,
the sill throws the water clear, the quoins tie two faces together at the
corner, and the string course marks a floor from the outside. All of them are
laid here as separate blocks with their own beds, because a dressing modelled
as one long box is the thing that makes a reconstruction look printed.

`tool_marks` is the smallest module in the kit and the one that pays at close
range: shallow chisel runs across a dressed face, a millimetre proud and never
quite parallel. At two metres they are a texture; at sixty centimetres they
are the reason the stone was worked by a person.
"""

import math

from .mesh import Build, Frame


def _face(build, frame, centre, size, proud, *, splay=0.008, mat=0, shade=1.0, tooling=0.0,
          pitch=0.013):
    """one dressed face, plain or worked.

    A tooled face is not a texture laid over a block: it IS the block's face,
    cut into shallow runs that step a fraction of a millimetre apart. Anything
    added on top of a finished face reads at hand distance as loose slats
    lying on the stone, which is the one thing tooling must never look like."""
    if tooling <= 0:
        build.raised(frame, centre, size, proud, splay=splay, mat=mat, shade=shade)
        return 1
    cx, cz = centre
    width, height = size
    rows = max(1, int(height / pitch))
    # the runs are not ruled: a hand holding a chisel does not keep a gauge
    widths = [pitch * (0.72 + 0.56 * build.rng.random()) for _ in range(rows)]
    scale = height / sum(widths)
    at = cz - height / 2
    for run in widths:
        step = run * scale
        cut = tooling * (0.4 + 0.6 * build.rng.random())
        build.raised(frame, (cx, at + step / 2), (width, step * 1.06),
                     (proud - cut, proud - cut * 0.55), splay=splay * 0.2, mat=mat,
                     shade=shade * (1.0 + build.jitter(0.012)))
        at += step
    return rows


def quoins(build, frame, *, x, height, base=0.0, long=0.58, short=0.44, course=0.42,
           proud=0.028, mat=0, tone=(0.86, 1.06), phase=0, jitter=0.004, tooling=0.0):
    """the corner blocks of one face, alternating long and short by course.

    A corner takes two calls, one per face, with opposite `phase`: then the
    long block of one face sits beside the short block of the other and the
    two faces interlock the way a mason ties them."""
    laid = 0
    rows = max(1, int(height / course))
    for row in range(rows):
        z = base + (row + 0.5) * course
        length = long if (row + phase) % 2 == 0 else short
        edge = x - math.copysign(length / 2, x)
        laid += _face(build, frame, (edge + build.jitter(jitter * 0.4), z),
                      (length, course * 0.94), proud + build.jitter(jitter), splay=0.009,
                      mat=mat, shade=build.tone(*tone), tooling=tooling)
    return laid


def jambs(build, frame, *, x, base, width, height, reveal=0.32, course=0.38,
          proud=0.026, mat=0, tone=(0.88, 1.05), tooling=0.0):
    """the dressed uprights each side of an opening, in courses that bond back
    into the wall"""
    laid = 0
    rows = max(1, int(math.ceil(height / course)))
    for side in (-1, 1):
        for row in range(rows):
            tall = min(course * 0.985, base + height - (base + row * course))
            if tall < 0.05:
                continue
            z = base + row * course + tall / 2
            laid += _face(build, frame, (x + side * (width / 2 + reveal / 2), z),
                          (reveal, tall), proud, splay=0.005, mat=mat,
                          shade=build.tone(*tone), tooling=tooling)
    return laid


def lintel(build, frame, *, x, top, width, height=0.34, bearing=0.30, depth=0.22,
           proud=0.03, mat=0, tone=(0.9, 1.02), tooling=0.0):
    """the stone over an opening. It is longer than the hole by its bearing at
    each end, and that overlap is the whole reason the wall stands."""
    _face(build, frame, (x, top + height / 2), (width + 2 * bearing, height), proud,
          splay=0.01, mat=mat, shade=build.tone(*tone), tooling=tooling, pitch=0.031)
    # the soffit: the underside a visitor sees from the threshold
    soffit = frame.moved(x, -depth / 2, top).turned(-90, 'X')
    build.raised(soffit, (0, 0), (width + 2 * bearing * 0.6, depth), 0.0, splay=0.0,
                 mat=mat, shade=build.tone(*tone) * 0.82, skirts='none')
    return 2


def sill(build, frame, *, x, z, width, depth=0.26, height=0.11, proud=0.05,
         mat=0, tone=(0.82, 1.0), throat=True):
    """a sill weathered away from the wall, with the throat cut under its nose
    so the water drips clear instead of running back down the face"""
    build.raised(frame, (x, z), (width, height), (proud, proud * 0.45), splay=0.008,
                 mat=mat, shade=build.tone(*tone))
    if throat:
        under = frame.moved(x, proud * 0.7, z - height / 2).turned(-90, 'X')
        build.raised(under, (0, 0), (width * 0.98, depth * 0.5), 0.0, splay=0.003,
                     mat=mat, shade=build.tone(*tone) * 0.78, skirts='none')
    return 2


def string_course(build, frame, *, z, length, block=0.62, height=0.13, proud=0.075,
                  mat=0, tone=(0.84, 1.04), weather=True):
    """a band running the whole face: a floor line from outside, and the ledge
    that stops a climbing animal"""
    count = max(1, int(round(length / block)))
    step = length / count
    for i in range(count):
        x = -length / 2 + (i + 0.5) * step
        build.raised(frame, (x, z), (step * 0.995, height),
                     (proud, proud * (0.72 if weather else 1.0)), splay=0.007,
                     mat=mat, shade=build.tone(*tone))
    return count


def threshold(build, frame, *, x, z, width, depth=0.4, hollow=0.022, mat=0,
              tone=(0.74, 0.98)):
    """the step under a door, rubbed hollow in the middle by five hundred
    years of the same stride"""
    top = frame.moved(x, 0, z).turned(90, 'X')
    pieces = 7
    for i in range(pieces):
        u = (i + 0.5) / pieces
        dip = hollow * math.sin(math.pi * u) ** 1.6
        build.raised(top, (-width / 2 + u * width, 0), (width / pieces * 1.01, depth),
                     -dip, splay=0.004, mat=mat, shade=build.tone(*tone))
    return pieces


def tool_marks(build, frame, *, x, z, width, height, pitch=0.013, depth=0.0006,
               mat=0, tone=(0.94, 1.04), proud=0.0):
    """a worked face on something the kit did not lay: the same shallow runs
    `_face` cuts, on a rectangle named by hand"""
    return _face(build, frame, (x, z), (width, height), proud, splay=0.004, mat=mat,
                 shade=build.tone(*tone), tooling=depth, pitch=pitch)


def reveal(build, frame, *, x, base, width, height, depth, mat=0, tone=(0.7, 0.95),
           soffit=True, floor=False):
    """the return of an opening through the thickness of a wall.

    Without it a hole in a wall shows the void between its two leaves, which
    is the fastest way to tell a modelled building from a built one."""
    laid = 0
    for side in (-1, 1):
        cheek = frame.moved(x + side * width / 2, -depth / 2, base + height / 2).turned(-90 * side, 'Z')
        build.raised(cheek, (0, 0), (depth, height), 0.0, splay=0.0, mat=mat,
                     shade=build.tone(*tone), skirts='none')
        laid += 1
    if soffit:
        head = frame.moved(x, -depth / 2, base + height).turned(-90, 'X')
        build.raised(head, (0, 0), (width, depth), 0.0, splay=0.0, mat=mat,
                     shade=build.tone(*tone) * 0.8, skirts='none')
        laid += 1
    if floor:
        bed = frame.moved(x, -depth / 2, base).turned(90, 'X')
        build.raised(bed, (0, 0), (width, depth), 0.0, splay=0.0, mat=mat,
                     shade=build.tone(*tone) * 1.1, skirts='none')
        laid += 1
    return laid
