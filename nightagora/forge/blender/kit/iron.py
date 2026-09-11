"""Ironwork: straps, rivets, hinges, rings.

The iron on a building is small, dark and almost all silhouette, which is
exactly why it cannot be painted on. A strap hinge is a tapered bar lying on
the boards with its own thickness, its rivets stand proud of it, and the ring
handle hangs off the face rather than sitting in the plane of it. Together
they are perhaps two thousand triangles on a whole door, and they are the
first thing an eye lands on when it comes close.

Iron is also the one material in this kit that wants a metallic surface. The
bake carries a metal channel for exactly this: brick and stone go out at zero,
forged iron at one, and the museum's own light does the rest.
"""

import math

from mathutils import Vector

from .mesh import Build, Frame


def strap(build, frame, *, x, z, length, width=0.075, thickness=0.014, mat=0,
          taper=0.45, tone=(0.8, 1.05), rivets=6, rivet=0.024, rivet_proud=0.009):
    """a tapered hinge strap lying across boards, with its rivets"""
    pieces = 9
    for i in range(pieces):
        u = (i + 0.5) / pieces
        w = width * (1 - (1 - taper) * u ** 1.3)
        build.raised(frame, (x + length * u, z), (length / pieces * 1.02, w),
                     thickness, splay=0.003, mat=mat, shade=build.tone(*tone))
    for i in range(rivets):
        u = (i + 0.6) / (rivets + 0.2)
        build.disc(frame.point(x + length * u, thickness + rivet_proud, z),
                   frame.direction(0, 1, 0), rivet / 2, sides=7, mat=mat,
                   shade=build.tone(*tone))
        build.tube([frame.point(x + length * u, thickness, z),
                    frame.point(x + length * u, thickness + rivet_proud, z)],
                   rivet / 2, sides=7, mat=mat, shade=build.tone(*tone), close=False)
    return pieces + rivets


def rivet(build, at, direction, *, head=0.026, proud=0.008, mat=0, sides=7,
          tone=(0.82, 1.02)):
    """one nail head, standing proud of what it holds"""
    start = Vector(at)
    axis = Vector(direction).normalized()
    build.tube([start, start + axis * proud], head / 2, sides=sides, mat=mat,
               shade=build.tone(*tone))
    return 1


def pintle(build, at, direction, *, length=0.13, bar=0.028, mat=0, tone=(0.78, 1.0)):
    """the pin the strap turns on, driven into the jamb"""
    start = Vector(at)
    axis = Vector(direction).normalized()
    build.tube([start, start + axis * length], bar / 2, sides=7, mat=mat,
               shade=build.tone(*tone))
    build.tube([start + axis * length * 0.55,
                start + axis * length * 0.55 + Vector((0, 0, bar * 2.4))],
               bar / 2.4, sides=7, mat=mat, shade=build.tone(*tone))
    return 2


def ring(build, centre, normal, *, radius=0.075, bar=0.017, segments=14, mat=0,
         tone=(0.8, 1.04)):
    """a ring handle, hanging in its own plane"""
    n = Vector(normal).normalized()
    up = Vector((0, 0, 1)) if abs(n.z) < 0.9 else Vector((1, 0, 0))
    u = n.cross(up).normalized()
    w = n.cross(u).normalized()
    c = Vector(centre)
    points = [c + (u * math.cos(2 * math.pi * k / segments)
                   + w * math.sin(2 * math.pi * k / segments)) * radius
              for k in range(segments + 1)]
    build.tube(points, bar / 2, sides=5, mat=mat, shade=build.tone(*tone), close=False)
    return 1


def bracket(build, frame, *, x, z, out=0.16, drop=0.2, bar=0.02, mat=0,
            tone=(0.78, 1.0)):
    """a forged bracket standing out of a wall: what a rope, a lamp or a
    latch hangs from"""
    foot = frame.point(x, 0.0, z)
    knee = frame.point(x, out, z)
    build.tube([foot, knee], bar / 2, sides=6, mat=mat, shade=build.tone(*tone))
    build.tube([knee, frame.point(x, out * 0.86, z - drop)], bar / 2, sides=6, mat=mat,
               shade=build.tone(*tone))
    return 2
