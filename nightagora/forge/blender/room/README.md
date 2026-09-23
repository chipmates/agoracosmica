# A room of the wing, exported for Cycles

Two steps. The first reads a room off the live museum and writes it as data;
the second renders that data in Blender Cycles at the room's certified stops,
printed the way the museum prints.

```
export-room.mjs   the live room -> glTF + lights + cameras + sky + air + print + report
cycles_room.py    the export -> Cycles frames (EXR, and PNG in the engine's print)
tools.py          Blender's own surface tools, switched on by cycles_room.py's flags
heights.mjs       each set's height (surface.png's displacement channel) beside an export
expose.py         a frame printed at the exposure that meets a reference print's median
print_engine.py   the engine's print, shared by cycles_room.py and expose.py
film-poses.mjs    a filmed clip's cameras (a film export's sidecar) as poses for Cycles
air-probe.mjs     the engine's own air at a stop: with, without, and the difference
rooms.mjs         the rooms it knows: box, stops, machines, exclusions, air, print
```

## 1. Export

Build this checkout and serve it (the export reads the preview, as the stills do):

```sh
pnpm build
pnpm exec vite preview --port 5437 --strictPort --host 127.0.0.1
FORGE_PORT=5437 node forge/blender/room/export-room.mjs --room=hall --out=<dir>
```

`--stage=list` stops after the inventory. `--maps=full` lays every set with all
of its store maps instead of the maps the engine really sampled (a what-if,
recorded as such in the report). `--tier=max` reads the room at the film's tier
(every machine set with its whole maps); the default is the live desktop's
`hero`. About four minutes for the hall.

The page is read through three's own devtools hook (every `Scene` and renderer
announces itself to `window.__THREE_DEVTOOLS__`), so nothing under `src/`
changes. The export waits until every machine of the room holds its parts, reads
every drawn mesh whose bounds meet the room's box (a mesh that meets it comes
whole), follows each stop to record what it draws, and writes into `<dir>`:

| file | what |
|---|---|
| `room.gltf`, `room.bin`, `textures/` | the room in three's frame and metres; one node per mesh or instance with its world matrix |
| `materials.json` | each glTF material's recipe: set, UV rule, colour rule, roughness rule, normal strength, and what did and did not travel |
| `lights.json` | every light as data (position, aim, cone, candela or cd/m2, colour, kelvin, reach, shadow) and its Cycles equal |
| `poses.json` | the stops from the clearance certificate, both framings (`wide/<stop>` desktop on 2400x1350, `upright/<stop>` phone on 1170x2532), the rig's `museum-poses-v1` |
| `sky.hdr` | the engine's sky, six views from inside the room resampled to an equirectangular map |
| `air.json`, `print.json` | the room's air and the print, with the laws they follow |
| `export.json` | the report: counts, exclusions, every translation, camera cross-check, source hashes |

The store is read, never written. The export directory holds CC0 library
photographs and derivatives of them: keep it outside the repository.

## 2. Render

The render uses the render rig's `blender/` folder (its importer, its camera
module and its device choice), passed as `--rig-dir`:

```sh
blender --background --factory-startup --threads 4 --python-exit-code 1 \
  --python forge/blender/room/cycles_room.py -- \
  --export <dir> --rig-dir <rig>/blender --output <out> --samples 128
```

`--camera wide/flight` (repeatable) renders one pose, `--scale 0.5` renders at
half the stage, `--no-air`, `--fittings`, `--no-reach-window`, `--adaptive 0.01`
and `--device` are there for studies. Output: `<out>/linear/<framing>/<stop>.exr`
(scene-linear), `<out>/stills/rooms/<framing>/<stop>.png` (the names the stills
use) and `<out>/render-log.json` with the seconds per frame.

`--crops <json>` renders boxes of the whole stage at full size after each
frame (`{"wide/flight": [[left, top, width, height], ...]}`), printed with the
vignette where the whole frame has it; `--no-frame` renders only the boxes.
`--poses <file> --print-stop <stop>` renders other cameras (a film clip's, from
`film-poses.mjs`) at a stop's print.

**Blender's own tools** (`tools.py`), off unless asked, so the plain
translation stays reproducible: `--bevel` (the Bevel shader node, 2 to 15 mm by
what the part is and how large), `--displace` (true displacement on adaptive
subdivision from the set's own height, where the set carries one: the floor's
concrete and the machines' timber; run `heights.mjs --export=<dir>` first),
`--grime` (local-AO grime in the hollows and wear on the arrises, only on
weathered sets and never on a machine its source makes new). None adds an
object, a word or a light.

**A photographer's exposure.** `expose.py --render <out> --print <export>/print.json
--reference <stills/rooms> --out <stills/rooms>` prints each EXR at the gain that
puts its median luma where the reference print has it, writes the gain per
frame (`exposure.json`) and prints the frame's crops at the same gain.

## What is translated, and how

**Units.** Three's physical lights: candela for spots and points, luminance for
rectangles; a white Lambert surface under I cd at d m reads I cos / (pi d2).
Cycles: a point or spot of P watts has a radiant intensity P / 4 pi, a Lambert
area light P / (pi A) radiance. So P = 4 pi I and P = pi A L, and both engines
compare at the same exposure. Measured in Cycles 5.3 (white plane, no bounce):
0.3181 for a 1 cd point at 1 m (1/pi is 0.3183), 1.0000 under a unit-luminance
area, the spot's cone equal on axis and in its penumbra.

**Spots.** Cone `spot_size = 2 x angle`, `spot_blend = (cos inner - cos outer) /
(1 - cos outer)`, which is three's `smoothstep(cos outer, cos inner, cos theta)`.
Three's distance window `(1 - (d/reach)^4)^2` rides on the light as a node on
the ray length. The shadow map (2048 px, filtered over 1.5 texels) becomes a
ray-traced shadow from the lamp face, 50 mm in radius. The light's own sphere is
not seen by the camera; the lamp face is the exported emissive mesh.

**The clerestory.** A rectangle of the glazing's size at the engine's place and
tilt, Lambert, not seen by the camera (the camera looks through it at the sky).
The engine's rectangle casts no shadow; Cycles' does.

**Selective lighting (`material.lightsNode`).** An engine means for a sampler
ceiling: the hall's rig reaches the hall's surfaces only. In Cycles the lights
are real and light everything; the walls keep them in. The five ceiling
fittings, which reach no hall surface in the engine, stay off (`--fittings`).

**The probe.** Dropped: Cycles path-traces the bounce. The engine reads its probe
at 1.35 of what the room holds; Cycles reads the room as it is.

**The air.** The engine marches `0.01 x density x profile x (lit irradiance)` per
metre and adds it. Cycles gets an isotropic scattering volume of coefficient
`4 pi x 0.01 x density x profile` in the same box, which is the same single
scattering, and which also dims what stands behind it, as a real medium does.
The clerestory is kept off it by light linking, as the source keeps it off.

**The print.** The EXR is scene-linear. The PNG is printed from it in
`stack/post.ts`'s order: exposure, lift, gamma and gain, split, saturation, the
Khronos PBR Neutral shoulder, vignette, sRGB. The scene itself carries Blender's
Khronos PBR Neutral view transform at the stop's exposure, the same curve.

**Materials.** Each engine material is recognised by its name and by the first
constant colour of its colour graph (read off the live graph), and becomes the
set's photograph at the UV the engine samples it at (a part's own metre UV, or
the world projection of the hall's fabric, the floor cut into its bays), with
the graph's per-texel rule baked into a derived albedo and roughness map. A set
the engine draws without its normal or surface map (the tier's albedo-only
budget) is drawn so in Cycles too. What a texel cannot carry (the procedural
macro, mid and micro scales, grain fields, de-tiling, the key rim, distance
fades, emissive stand-ins for bounce, the floor's planar reflection pass) is
listed per material in `materials.json` under `lost`, with its replacement
where there is one (the floor's reflection becomes a clear coat).

## Limits

- A room is a table entry in `rooms.mjs`: its box, its stops, its machines, its
  exclusions, its air and its print. The material table covers the families the
  mechanism hall holds; anything else is laid flat in its authored colour and
  named in the report as not recognised.
- A mesh that meets the box comes whole; the construction of the neighbouring
  rooms comes with it, their contents do not.
- CPU timings are this laptop's four threads. The same scripts run on a GPU box
  with `--device OPTIX` or `METAL`.
