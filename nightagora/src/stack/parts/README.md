# The parts kit

The material library answers what a surface is made of. The model library
answers what a thing IS, for the eighty things the open commons happens to
hold. This kit answers for the things it does not hold, and after a sweep of
the whole CC0 commons that list is most of a building: no window, no shutter,
no dormer, no chimney, no ridge tile, no roof element of any kind, no stone
step, no threshold, no fence section, no cart wheel, no gear, no rope as a
coil, and no tree at all.

```ts
import { createParts } from './stack/parts'

const parts = createParts(stack)
scene.add(parts.window({ width: 1.55, height: 2.35, mullion: 0.14, transom: 1.2 }))
```

**Three rules the whole kit keeps.**

- **Metres, always.** Every option is a real dimension. The Clos Luce's own
  aperture schedule reads 1.55 by 2.35 for a ground-floor light and 1.15 by
  1.75 for an attic one; those numbers go in unchanged.
- **A seed, always.** Every wobble comes from a seeded hand, so a part shot
  twice is the same part and a frame can be compared with a frame.
- **A tier, always.** Every builder takes the tier's own count of detail
  scales (`stack.tierConfig().detail`) unless `lod` overrides it, and lays
  fewer, larger units at the cheaper ones. A calm roof is the same roof seen
  from further away, never a flat one.

Every builder returns an `Object3D` carrying `userData.part`:

```ts
{ name, says, tris, draws, metres: [x, y, z], sets: string[], generated: string[] }
```

`says` is the line a label can print. `sets` is every library set the part put
on a surface, which is what the evidence drawer needs. `generated` names any
texture the part made at runtime rather than fetched (only the tree's leaf
atlas does).

The bench that every part below was judged on is `/parts.html?part=<name>` in
dev, and `node forge/shot-agent.mjs <port> <dir> '[part <name>]'` shoots it.

---

## Openings

### `window(opts)`

A hole through half a metre of masonry: a surround extruded through the whole
wall (so its reveal is the inside of the same stone and cannot disagree with
it), a sill with the throat cut under its nose, a head, a mullion, a transom,
glazing cut to the light, and shutters. The origin is the middle of the sill's
top, the wall's outer face is `z = 0`, and the wall runs back to `-z`.

```ts
parts.window({
  width: 1.55,           // the clear opening, metres
  height: 2.35,
  wall: 0.62,            // how thick the wall it is cut through is
  reveal: 0.2,           // how far behind the outer face the glass stands
  head: 'flat',          // 'flat' | 'segmental' | 'pointed' | 'ogee'
  surround: 0.17,        // the dressed band around the opening
  mullion: 0.14,         // the upright stone bar; 0 for none
  transom: 1.2,          // the cross bar's height above the sill; 0 for none
  glazing: 'leaded',     // 'leaded' | 'panes' | 'none'
  quarry: 0.135,         // one diamond of leaded glass, or one pane
  shutters: 'open',      // 'none' | 'open' | 'closed'
  shutterAngle: 152,     // degrees off the wall's face when open
  seed: 5,
})
```

The lead is real geometry, not a drawn lattice: every line of the diamond
lattice is walked across the light and a came is cut for each run that falls
inside it, so the lead follows an arch instead of stopping at a rectangle.
The glass carries a per-quarry normal tilt, which is what makes hand-blown
glass twinkle rather than mirror.

### `door(opts)`

The same masonry opening with a boarded leaf on strap hinges, a ring handle,
and a threshold with a hollow rubbed into its middle. The leaf turns about the
jamb it hangs on.

```ts
parts.door({ width: 1.2, height: 2.5, head: 'segmental', open: 26, hinge: 'left' })
```

### `wall(opts)` and `cutInto(wall, opening)`

A wall built as the panels a mason leaves around its openings: piers between
them, an apron under each and a spandrel over it. **There is no CSG library in
this app's one runtime dependency**, and the brief's rule allows no second one,
so this is the honest substitute for a boolean. Every panel reads its courses
off ONE plane through the wall's own face, so a course runs on through a pier
instead of restarting at every panel, which is the only way the construction is
invisible.

```ts
const wall = parts.wall({
  length: 11,
  height: 7.6,
  thickness: 0.62,
  azimuth: 0,            // which way the face looks, for the course projection
  set: 'brick-old-red',
  plinth: 0.55,          // a chamfered plinth course at the foot
  openings: [
    { x: -3.8, base: 1.55, width: 1.55, height: 2.35,
      window: { mullion: 0.14, transom: 1.2, shutters: 'open' } },
    { x: 1.4, base: 0, width: 1.2, height: 2.5, fill: 'door', head: 'segmental' },
  ],
})
const wider = parts.cutInto(wall, { x: 4.4, base: 5.05, width: 1.15, height: 1.75 })
```

`cutInto` puts the opening in the plan, re-cuts the panels, and swaps the new
wall for the old one in its parent. `wall.frames` lists where every opening
ended up, for a wing that fills them itself (`fill: 'none'`).

---

## Roofing

### `roof(opts)`

Real slate courses, not a slate photograph. A roof is four thousand objects
each 25 cm wide, each lapping the two under it, each hung a fraction out of
true, and what the eye reads at fifty metres is the shadow line at the foot of
every course and the broken silhouette at the eaves. Both are geometry and
neither can come from a map. One instanced mesh per slope per map variant: two
to six draw calls whatever the count.

```ts
parts.roof({
  width: 9.4,            // along the ridge
  depth: 7.2,            // across it, eaves to eaves
  pitch: 49,             // degrees; the Clos Luce's ranges read 41 to 56
  kind: 'gable',         // 'gable' | 'hip' | 'lean'
  gauge: 0.15,           // how much of each slate shows
  overhang: 0.34,
  gable: 'crow',         // 'none' | 'plain' | 'crow'
  seed: 21,
})
```

The origin is the middle of the plan at EAVES level and the ridge runs along
x. `roofCost(opts, lod)` returns `{ slates, tris }` before anything is built,
for a wing deciding what it can afford.

### `dormer(opts)`, `chimney(opts)`, `valley(opts)`

```ts
parts.dormer({ width: 1.15, height: 1.4, roofPitch: 49, kind: 'gable' })
parts.chimney({ height: 3.4, flues: 2, corbel: true })
parts.valley({ from: [0, 0, 4], to: [0, 3.4, 0], width: 0.42 })
```

A dormer is a small building standing on a roof, so its cheeks carry their own
set and its cap is a real `roof()` with its own slates. A chimney oversails its
shaft in three corbelled courses under a weathered cap, with a pot per flue.

---

## The ground

```ts
parts.steps({ width: 2.2, count: 5, rise: 0.165, going: 0.32, wear: 0.02, cheeks: true })
parts.fence({ length: 6.4, kind: 'wattle' })   // 'wattle' | 'paling' | 'post-and-rail'
parts.gate({ width: 3.2, kind: 'field', open: 34, hinge: 'left' })
```

The wear is the part worth arguing for: a stone step that is a box is a box at
every distance, and a stone step with a hollow rubbed into its middle is five
hundred years old for the price of eight vertices.

`wattle` is hazel rods woven through cleft stakes, each rod passing in front of
one stake and behind the next. That alternation is the whole read, and it is
what a physic garden of 1517 was enclosed with. The field gate's brace runs
from the foot of the harr to the head, which is the only way it works: drawn
the other way the gate is a parallelogram within a season.

---

## The mechanism

```ts
parts.wheel({ diameter: 1.32, spokes: 12, width: 0.075, tyre: 0.014, dish: 4 })
parts.gear({ module: 0.06, teeth: 26, thickness: 0.09, arms: 6 })
parts.gear({ kind: 'lantern', module: 0.06, teeth: 9, thickness: 0.22 })
parts.gear({ kind: 'worm', module: 0.05, teeth: 1, thickness: 0.1, length: 0.55 })
parts.hang([-1, 1.5, 0], [1, 1.15, 0], 1.1, { radius: 0.028 })
parts.rope(points, { radius: 0.018, strands: 3, lay: 0.25 })
parts.beam({ length: 4.2, width: 0.24, depth: 0.2, tenon: 0.12 })
```

**The gear teeth are involute**, generated from the module and the tooth count
the way a gear is actually specified, so two gears built from the same module
mesh and a frame that shows them meshing is not a lie. `module` is the pitch
diameter over the tooth count: a wooden mill gear runs 0.05 to 0.09 m, a bronze
clock train runs 0.002.

**The wheel** is a turned nave, tapered dished spokes, felloes cut to the arc
with a joint between every pair, and the iron tyre shrunk on over all of it. It
lies in the XY plane with its axle along z and its origin at the middle of the
nave, so a carriage sets it on an axle and it stands on the ground at
`y = -diameter/2` by arithmetic rather than by eye.

**The rope** is a twisted profile swept along a curve, with `strands` lobes
that travel along its length. `hang(a, b, slack)` puts it on the catenary it
would actually take under its own weight; `catenary(a, b, slack, steps)` is
exported on its own for a wing that wants the points.

---

## The planting

```ts
parts.tree({ species: 'oak', height: 16, season: 'october', seed: 41 })
parts.shrub({ height: 1.5, season: 'october', stems: 5 })
parts.grass({ width: 4, depth: 4, kind: 'meadow', density: 140 })
```

Species: `oak`, `lime`, `plane`, `yew`, `cypress`, `shrub`. Season: `summer`,
`october`, `bare`.

A tree is GROWN, not drawn. Attraction points fill the crown the species
actually makes and the branches grow toward them one step at a time until the
points are used up; the radii come from the pipe model, which is the
observation that a limb carries the cross-section of everything above it. The
reason for space colonisation here is not novelty: a branch grown toward a
point IS attached to its parent at every fork, by construction, so nothing in a
tree built this way can float. Three verdicts named floating twig sprays,
detached leaf clusters and trees as blobs.

The leaves are cards carrying a small SPRAY drawn into a generated atlas, one
per species and season, alpha-tested rather than blended so they cast real
shadows and need no sorting. The atlas is the one thing in this kit that is not
a library asset: it is regenerable from its recipe and every part that uses one
names it in `userData.part.generated`.

`grass` is instanced blades over a patch, one draw call. A ground plane with a
grass photograph on it is a flat green at every distance; what makes a lawn a
lawn at the near edge of a frame is that the blades break the silhouette
against whatever is behind them.

---

## What the kit assumes about the stack

- `stack.materials.sync(name)` for every set, and `stack.detail(...)` for the
  empty-plane helper on every plane. A part never writes a shader.
- **A set's own measured mean albedo arrives with the manifest, which is a
  fetch.** A part built in the same tick as the page compiles its shader before
  that fetch lands, and the helper would write the placeholder's mid grey in as
  a constant: a slate roof then renders pale and nothing in the frame says why.
  So the kit holds the base colour in a UNIFORM and writes it again every frame
  until the library has landed. `parts.bench.report()` says which sets are
  holding what, for a wing that finds a part reading grey.
- Every geometry the kit makes carries a **uv measured in metres of its own
  surface**, not a 0..1 box. A brick set read through a box's own 0..1 uv puts
  one tile on a jamb and one tile on a twelve metre wall.
