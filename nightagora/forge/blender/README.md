# The Blender kit

The parts kit in `src/stack/parts` answers what a thing IS at runtime, in
TypeScript, for what three.js can build live. This kit answers the same
question in Blender, for the things worth building once, baking, and shipping
as one body: masonry with individual bricks, roofs of individual tiles, cut
stone, carpentry, ironwork and rope. A dovecote of a quarter of a million
triangles is three draw calls in the museum and seventeen megabytes on the
wire. The same building made live would be neither.

```
kit/            the modules a build script imports
examples/       one build script per object
build-object.sh script -> bake -> export -> pack -> manifest record
record.py       the record and the size table (plain python, no bpy)
```

## One object, one command

```sh
forge/blender/build-object.sh . forge/blender/examples/dovecote.py --stage all
forge/blender/build-object.sh . forge/blender/examples/dovecote.py --stage bake --size 4096
forge/blender/build-object.sh . forge/blender/examples/dovecote.py --stage export
```

`--stage model` builds the geometry and saves the authoring blend, `bake`
writes the atlases, `export` writes one glb per tier and the receipt; `all`
does the three in order. The stages are separate because a re-bake should
never rebuild what stands, and a failed stage should be re-runnable alone.

Blender cannot run inside a sandboxed seat (it segfaults at Metal detection),
so a seat that cannot run it gets the eyes' `/bake` call printed instead.

## Where things land

| what | where |
|---|---|
| the authoring blend, the atlases, the raw glbs, the receipt | `internal/night-agora/blender/<object>/` |
| the packed tiers | the store, `<scope>/models/<object>/<object>-<tier>.glb` |
| the record | the store's own `manifest.json` for that scope |

Nothing but source lives in this repository: an atlas or a blend committed
here would be the store moving into public git, which the Manifest Law
forbids.

## The three laws the kit keeps

- **Metres, always.** Every option is a real dimension of a real building.
- **A seed, always.** Every jitter comes from one seeded hand, so the same
  script makes the same building and a frame can be compared with a frame.
- **No light, ever.** The bake scene has no sun and no sky with an hour in
  it. Occlusion is a visibility ratio measured off geometry, it travels in
  the ORM texture where glTF puts occlusion, and the museum's loader gives it
  to the ambient term alone. The stack's own key light models the brick.

## The modules

| module | what it lays |
|---|---|
| `mesh` | `Frame` (local axes on a face) and `Build` (quads, one mesh, one atlas) |
| `materials` | one library set on a surface, verified against the store's manifest |
| `bond` | brick in stretcher, English, Flemish and header bond, on a recessed lime bed; `nest` for a wall of pigeon holes |
| `tiles` | tile courses on a slope, a whole hipped roof, ridge and hip rolls, a finial |
| `timber` | beams, boards, pegs, battens |
| `stone` | quoins, jambs, lintels, sills, string courses, thresholds, reveals, tooled faces |
| `iron` | straps, rivets, pintles, rings, brackets |
| `rope` | a real three strand helix along any curve, and the catenary it hangs in |
| `bake` | the atlas uv, the high poly, the six passes, the three sizes, the export |

## What the bake measures

Albedo, roughness and a metal mask are read straight off the materials. The
normal is baked from a HIGH poly (the same body with a rounder arris) onto the
low one, so the edge the export cannot afford in triangles is carried in the
map. Occlusion and curvature are geometry. Curvature then does one job: it
lifts the albedo where a corner is rubbed and drops it into the joints, which
is where a real wall is worn.

Two settings decide whether the atlas is usable, and both were measured rather
than guessed on a wall of eighteen thousand separate bricks: the smart project
angle has to be high enough that a brick's face and its splayed arris stay one
island, and the pack margin has to be added in flat uv units rather than
scaled per island. With the scaled method the same wall packs at one per cent
of the sheet and the atlas comes out black.
