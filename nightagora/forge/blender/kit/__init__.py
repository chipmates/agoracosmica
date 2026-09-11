"""THE BLENDER KIT — the object shop, beside the parts kit that is the museum.

The parts kit in the app answers what a thing IS at runtime, in TypeScript, for
the things three.js builds live. This kit answers the same question in Blender,
for the things worth building once, baking, and shipping as one body: masonry
with individual bricks, roofs of individual tiles, cut stone, carpentry, iron
and rope. A dovecote of a quarter of a million triangles is two draw calls in
the museum and thirteen megabytes on the wire; the same building made live
would be neither.

    from kit import Build, Frame, bond, tiles, timber, stone, iron, rope, bake

    build = Build(seed=1517)
    for i, wall in enumerate(Frame.faces(4, 3.98)):
        bond.face(build, wall, length=8, height=7.5, bond='flemish', mat=BRICK)
    tiles.pyramid(build, half=4.34, eaves=7.5, pitch=48, mat=TILE)
    body = build.object('Exterior', materials, repeats, atlas='exterior')

Three laws the kit keeps, and the build script cannot break:

  METRES, ALWAYS. Every option is a real dimension of a real building.
  A SEED, ALWAYS. Every jitter comes from one seeded hand, so the same script
  makes the same building and a frame can be compared with a frame.
  NO LIGHT, EVER. The bake scene has no sun and no sky with an hour in it.
  Occlusion is measured off geometry and travels in the ORM texture; the
  museum's own key light models the brick.
"""

from .mesh import Build, Frame, WORLD, join, select
from . import bake, bond, iron, materials, paths, rope, stone, tiles, timber

__all__ = ['Build', 'Frame', 'WORLD', 'join', 'select',
           'bake', 'bond', 'iron', 'materials', 'paths', 'rope', 'stone', 'tiles', 'timber']
