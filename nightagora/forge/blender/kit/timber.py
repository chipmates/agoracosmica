"""Carpentry: beams, boards, pegs.

A beam is a squared section running between two points, and it is the one kit
call that works in world coordinates rather than on a face, because a rafter's
job is to get from a wall plate to a ridge and the frame it would be built on
is the thing being built. Boards are the other half of carpentry: a leaf, a
shutter, a floor, a ceiling, laid as separate planks with their own widths and
their own small cup, because a door drawn as one panel is a door nobody
believes. Pegs are what holds the two together and, at the distance a visitor
stands from a door, they are the detail that says a hand made this.

Nothing here is fastened by a boolean. A tenon is a shortened beam and a peg
is a dowel standing proud of the face it pins, which is what they look like.
"""

import math

from mathutils import Vector

from .mesh import Build, Frame


def beam(build, a, b, *, width=0.18, depth=0.20, mat=0, shade=None, tone=(0.68, 1.1),
         extend=0.0, skip=()):
    """a squared timber from a to b, in world metres"""
    start, end = Vector(a), Vector(b)
    span = end - start
    length = span.length
    if length < 1e-6:
        return 0
    direction = span.normalized()
    start = start - direction * extend
    end = end + direction * extend
    rot = direction.to_track_quat('Z', 'Y').to_matrix()
    frame = Frame((start + end) / 2, rot)
    build.box(frame, (0, 0, 0), (width, depth, length + 2 * extend), mat=mat,
              shade=build.tone(*tone) if shade is None else shade, skip=skip)
    return 1


def boards(build, frame, *, width, height, count=None, board=0.15, gap=0.004,
           thickness=0.038, mat=0, tone=(0.66, 1.06), base=0.0, centre=0.0, cup=0.0015,
           solid=False):
    """a field of planks on a frame: a door leaf, a shutter, a floor, a ceiling.

    Every plank takes its own width and its own tiny cup, so the joints between
    them are not a ruled grid."""
    if count is None:
        count = max(1, int(round(width / board)))
    step = width / count
    laid = 0
    for i in range(count):
        x = centre - width / 2 + (i + 0.5) * step
        w = step - gap + build.jitter(gap * 0.4)
        if solid:
            build.box(frame, (x, thickness / 2, base + height / 2), (w, thickness, height),
                      mat=mat, shade=build.tone(*tone))
        else:
            build.raised(frame, (x, base + height / 2), (w, height),
                         (thickness, thickness + build.jitter(cup)),
                         splay=0.004, mat=mat, shade=build.tone(*tone))
        laid += 1
    return laid


def peg(build, at, direction, *, diameter=0.026, length=0.03, mat=0, sides=6,
        tone=(0.7, 1.0)):
    """a dowel head standing proud of what it pins"""
    start = Vector(at)
    axis = Vector(direction).normalized()
    build.tube([start, start + axis * length], diameter / 2, sides=sides, mat=mat,
               shade=build.tone(*tone))
    return 1


def battens(build, frame, *, run, half_at_eaves, taper=0.0, spacing=0.14,
            section=(0.05, 0.035), mat=0, tone=(0.62, 0.95), stop=0.0):
    """the battens a roof is hung from, seen from inside: the ceiling of every
    tiled building before a plaster one was afforded"""
    laid = 0
    count = max(1, int((run - stop) / spacing))
    for i in range(count):
        up = i * spacing
        half = half_at_eaves - up * taper
        if half <= 0.1:
            break
        build.box(frame, (0, -section[1] / 2, up), (2 * half, section[1], section[0]),
                  mat=mat, shade=build.tone(*tone))
        laid += 1
    return laid
