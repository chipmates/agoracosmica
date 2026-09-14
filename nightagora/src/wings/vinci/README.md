# The da Vinci wing

A documentary reconstruction of the Chateau du Clos Luce at Amboise at 15:19
local apparent time on 10 October 1517, walked on a rail of nineteen stations.
Everything here is modelled from the drawer's plans, photographs and surveys;
a dimension the drawer does not give is a range with its basis on the label.

## The rail, and why it is certified

The camera never moves on an unproved line. `rail-proof.ts` runs one SHA-256
over every collision mesh at mount and refuses to route the camera unless that
hash is in `data/rail-clearance.json`. The certificate also pins both
viewports' station poses, so a pose cannot move either: a changed pose has no
certified route and the rail stops.

That is the point of it. It also means the certificate has to be regenerable,
or the wing is frozen.

### `rail-certify.mjs`, the generator

```
node src/wings/vinci/rail-certify.mjs            re-certify and write
node src/wings/vinci/rail-certify.mjs --verify   prove the file on disk, write nothing
node src/wings/vinci/rail-certify.mjs --json     add every route's own reading
```

It runs the real factories at hero, standard and calm, hashes them with the
same `rail-fingerprint.ts` the browser runs, builds each of the forty directed
routes from the station poses and `rail-waypoints.ts`, and proves them against
the real triangles:

- every straight span of the finished path, end to end, by exact
  segment/triangle distance;
- every rounded corner, by closed balls over its control hull, subdivided
  until each one is clear. Those balls are what the runtime replays, so the
  browser repeats the proof instead of trusting it;
- every station's own near envelope, as the full ball of the near rectangle's
  enclosing radius at the authored aspect (the widest the lens ever is).

The radius everything is proved against is the near rectangle's enclosing
radius plus the walk's own step rhythm envelope (`gait.ts`), because the eye
leaves the certified line by that much while walking.

On success it writes `data/rail-clearance.json` and updates the
`vinci/rail-clearance` hash in `assets/wing-vinci/manifest.json`. On failure it
writes nothing and names what is too close to what, in metres.

A station standing inside its own near envelope is refused. The record then
carries how close the near plane itself comes over the whole drag envelope, so
whoever moves the pose knows by how much.

Run time is about two minutes; it is a generator, not a gate. `--verify` is
the one to run after touching any geometry, any station pose or any waypoint.

### `rail-waypoints.ts`

The turns a route takes between two stations: the gallery passage from the
street to the court, and the modern access stair, the terrace and the
collection stair from the court to the ground. They are written against the
registered crossing, the access layout and the stair's own dimensions, so a
change in the building moves the rail with it.

## The walk

`gait.ts` owns the profile of a leg: the body leans into the walk over 0.90 s,
strolls at 1.30 m/s, leans out of it over 1.10 s, and carries 9 mm of rise and
fall at the step and 6 mm of sway at the stride, phased by the distance walked
so the cadence follows the speed. Reduced motion switches the rhythm off. The
numbers are measured by `gait-check.mjs`, on the module and on the real rail.

## The checkers

Every `*-check.mjs` in this folder is run by `forge/gates.mjs` and its exit
code is the gate. `rail-certify.mjs` is deliberately not one of them: it is the
tool that writes the certificate the checkers then hold the wing to.
