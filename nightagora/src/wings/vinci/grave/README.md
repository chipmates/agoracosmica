# Presumed grave

`createGrave(materials, language = 'en', options = {})` returns
`{group, metadata, dispose}`. The materials
are the same `ExhibitMaterials` used by `../myths`: `stone`, `plaster`,
`bronze`, `ink`, `dark`, plus optional `tuffeau: Material`, which the
grave no longer reads: the slab's facing and the separate plaque are both
cut from the ledger's own honed limestone (`ledgerStone()`). `language` is `'en' | 'de'`; `options` is `{mobile?: boolean}` with
mobile disabled by default. The host supplies TSL node materials, camera,
lighting, accessible reading surface and input. Units are metres, +Y is up,
and +Z faces the reader. Call `dispose()` on unmount; supplied materials
remain owned by the host. Static geometry is welded by material; `?noweld`
preserves parts for the cost comparison.

The constructor creates no DOM, light, camera, input handler or clock. It
includes a jointed exhibition floor and generated gallery enclosure; do not
add a coincident floor or backdrop. Shared `exhibitionFloor` ensures at least
40 × 60 m of supporting floor, centred at z=2.5, for the host's distant
phone camera. `galleryBackdrop` supplies an 18 m wide, 6 m high coursed rear
wall at nominal z=-5.5, with 20.3 m side returns and a stone base. This is
modern museum architecture, not a reconstruction of Saint-Hubert. The
returned `metadata` is also assigned to `group.userData.exhibit`. If a host
welds the returned group again, preserve its manifest identity and convert
the published local-space anchors through the group's world transform.

| Import | Export | Purpose |
| --- | --- | --- |
| `./index` | `createGrave(materials, language?, options?)` | Creates static exhibit geometry and metadata; optional pale material and phone restaging as above. |
| `./index` | `GRAVE_EVIDENCE` | Source evidence, slab name and cautious historical interpretation; its legacy computed-hour string belongs to the record, not the current physical caption. |
| `./index` | `GRAVE_HOUR` | Rounded start-minute values, date conversion, site and reference paths. |
| `./index` | `graveSunDirection()` | Start-minute unit vector in the exhibit's local frame; takes no time argument. |
| `./hour` | `computedHour(seconds = 0)` | Computes the chosen minute continuously, returning `ComputedHour`. |
| `./hour` | `ComputedHour` | Public TypeScript result type. |

The name-only slab's anchor is `(-0.95, 0.24, 0.65)`. Its stone layer is
2.04 m wide × 3.61 m long × 0.13 m thick, on a 2.16 × 3.74 m base. Its
top facing is a pale honed limestone 1.98 × 3.55 × 0.064 m, its face at
y=0.234 (`ledger.ts`). The slab's only writing is **LEONARDO / DA VINCI**
on two centred lines at 0.27 m cap height, cut into the face along each
letter's own outline: the union of the font's overlapping strokes is taken
as a distance field over each line and traced at the letter's edge and at
a mouth 4 mm outside it (`LEDGER_CUT`); the mouth splays 2.2 mm down to the
edge, a 0.9 mm wall drops to the filling in the grave's ink; the block's middle
stands 0.35 m from the slab's middle toward its foot. The ledger casts no
shadow. The slab stays put at every viewport.
This is an openly generated exhibition study: its dimensions are not an
attested survey of the actual tomb. A neutral empty bronze inset marks the
place of a medallion without fabricating a human portrait. The admitted
reference photograph was inspected, not projected or textured. No remains,
burial scene or invented epitaph are present. The empty inset is an
interpretive omission, not a claim that the real tomb lacks its documented
bronze portrait roundel.

The medallion opening is a real 1.06 m diameter hole through the top facing,
centred at `(-0.95, 0.23, -0.05)`. Its turned bronze bezel has maximum outer
diameter 1.072 m and an inner throat of 0.940 m; the lip stands 10 mm proud of
the slab face and its skirt runs 95 mm down. The pale floor of the well reaches
y=0.165, **65 mm below the face**. The bedding course under the slab stops
0.62 m short on both sides of the setting, so the well is an actual void rather
than that course's own top face 17 mm down. These are authored geometry
dimensions, not measurements of the historical portrait mount. The recess
retains real sides and depth without depicting a face or applying a reference
image.

Absence carries its own label, on its own carrier, never on the pale slab:
**The portrait medallion is left empty here.** / **Das Porträtmedaillon bleibt
hier leer.** Desktop stands it at the slab head on a small dark plinth with a
pale face at `(-1.25, 0.43, -1.33)`; phone lays the same words on a floor-set
strip beyond the head, at `(-0.61, 0.062, -2.09)` and 0.150 m cap height. A
host that restages this station must keep one of the two in frame: an unlabelled
dark disc reads as a hole in the pavement, which is what this exhibit is not.

The separate lectern at `(1.44, 0.9, 1.5)`, one block of the ledger's
limestone on a dark base course, says **presumed remains** and
dates the excavation to 1863. `GRAVE_EVIDENCE` gives the host the fuller
reading text: Houssaye reported a skeleton; identification is not proof.
The separate chapel plaque is known from its account, not from a held
photograph. Its text is not forged onto the slab. The precise 1874 transfer
date and the letter fragments stay qualified as requiring the historical
record, following `refs/RIGHTS-CROSSCHECK.md`. The exhibition lectern's
layout and English words do not claim to reproduce a photographed chapel
plaque. The presumed phrase requests 0.13 m in English and 0.102 m in
German on desktop, or 0.16 m and 0.135 m on phone. On phone the lectern moves
to `(1.32, 1.55)`, the 1863 baseline moves down to y=0.46 and the small
explanatory sentence is omitted;
the host card retains the identification caveat.

The source drawer must explain the grave photograph, separate plaque and
unproved identification in ordinary language. Keep the complete
`metadata.geometryDisclosure`, evidence and dimensional assumptions in an
intentionally opened `record` root. The bench uses `GRAVE_SOURCE` and
`GRAVE_DIAGRAM` in `../line/bench/visitor-sources.ts` for these plain readings.

The deep frame centred at `(1.2, 2.46, -1.34)` holds a small three-dimensional
gable study and a physically inscribed caption (`diagram.ts`). Its linen
ground is 3.13 m wide × 2.55 m high; the relief is a coursed chapel gable
1.48 m wide and about 1.9 m high on an oak shelf, its blocks each their own
length, tone and depth, with quoins, a lancet in a chamfered surround, dark
glass set back in the reveal, stone copings and slate verges. These are
authored exhibition dimensions. The window, ashlar, roof, frame and slab do
not constitute a surveyed replica of either historic building or tomb. The
gable's orientation carries the calculation: only the box takes a light of
its own (`lightsNode`, hidden from the scene's list of lights), a
directional light along `graveSunDirection()`, 3000 K, with a shadow map
drawn from depth-only doubles on layer 12, so the relief shows the chosen
minute's low light; its decorative geometry does not testify to a 1519
elevation.
Desktop uses a projecting ledge whose text plane lies beyond the frame
posts. It says **CHOSEN LIGHT · A DIAGRAM** and **2 MAY 1519 · JULIAN
CALENDAR**, or **GEWÄHLTES LICHT · EINE STUDIE** and **2. MAI 1519 ·
JULIANISCH**. Requested cap heights are 0.107 m and 0.075 m. No azimuth,
altitude, UT interval or other computed arithmetic is engraved on it.

With `options.mobile:true` the same two lines stay on the same kind of ledge,
cut larger: a 3.34 × 0.70 m plaster ledge in front of the frame carries
**CHOSEN LIGHT · A DIAGRAM** at 0.178 m (0.142 m in German, which runs a third
longer and would otherwise wrap into the line below it) over **2 MAY 1519 ·
JULIAN CALENDAR** at 0.134 m. No fragment is ever set on the mount over the
drawing, and the date line is present at both viewports. Bronze feet on dark
pads ground the frame.

Only the framed gable assembly scales uniformly to 0.84 and moves to
`(-1.26, 0, -1.55)` in the exhibit's frame; the presumed lectern moves to
`(1.32, 1.55)` in X and Z. The slab retains its full dimensions and position.
`metadata.anchors.computedFrame` follows this restaging; desktop retains
`(1.2, 2.46, -1.24)`. Because the sun is barely three degrees above the
horizon, the lit band across this room is narrow: a host that moves the frame
further left will find the diagram in the side wall's shadow.
The host still owns the camera and must compose from the chosen layout.
It must keep the chosen hour distinct from the documented date in its
readable card: the bench uses amber for **Chosen light · Just before seven
by the sun.** and green for the documented Julian date, with corresponding
German wording. The phrase refers to local apparent solar time, not UT.

The minute is **18:50:00–18:51:00 UT on Julian 2 May 1519**, the same day
as proleptic Gregorian 12 May 1519. JD at 0h UT is 2275993.5. The site is
47.4103059° N, 0.9920706° E. It is a chosen minute on the death day, not a
witnessed death hour, weather reconstruction, or the later sunset.

`computedHour` implements the solar calculation from the held `hour.py`:
Meeus solar position and sidereal time, with the Espenak–Meeus 1000–1600
delta-T polynomial. The monthly delta-T model gives 178.977591736 s;
`GRAVE_HOUR.deltaTSeconds` records this rounded to 178.978 s. Solar altitude
is **geometric centre altitude**, without atmospheric refraction or a local
terrain horizon. Numerical digits describe the computation, not observational
precision about conditions in 1519.

| Offset | UT | Azimuth | Geometric altitude | JD on UT scale | Local apparent solar time |
| --- | --- | --- | --- | --- | --- |
| 0 s | 18:50:00 | 292.712367636° | 3.735860609° | 2275994.284722222 | 18:58:20 |
| 60 s | 18:51:00 | 292.892352495° | 3.580026445° | 2275994.285416667 | 18:59:20 |

These values were read directly from the current exported function. At the
start, longitude contributes `4λ = 3.9682824 min` and the equation of time
is `4.367058645 min`; add both to UT for local apparent solar time. The
result exposes `seconds`, `azimuth`, `altitude`, `deltaT`, `jd`, `UTclock`,
`localApparentTime`, `equationOfTimeMinutes`, `longitudeOffsetMinutes` and
`localApparentSeconds`. The two returned clock strings round to the nearest second.
Finite offsets below 0 or above 60 clamp to an endpoint; `NaN` and infinities
throw `RangeError`.

`graveSunDirection()` returns the **start** direction from the frame toward
the sun. In frame coordinates +Z corresponds to the NW gable's 321.47°
bearing. For any computed sample, in radians `b = (azimuth − 321.47)π/180`
and `a = altitudeπ/180`, its direction is
`[sin(b)cos(a), sin(a), cos(b)cos(a)]`. Transform this direction through any
rotation the host applies to the exhibit. For the stack's light convention,
the equivalent local azimuth is `180 + 321.47 − azimuth` degrees.

Place the host's one directional light along that vector and point it back
toward the exhibit. During the minute, update the light/cascades and the
complete arithmetic in the deliberately opened record from the same
`computedHour` sample. The visitor's hour wording and physical diagram
caption remain plain and static. The host owns wall-clock playback,
pause/replay, reduced-motion policy and ambient fill. The bench control
pauses at the minute's end and allows replay; changing the drawer state
must not make its playing/paused caption disagree with the clock.
The original calculation and day's track are in `refs/place/notes/hour.py`
and `hour-2may1519.txt`.

Every made part declares `GENERATED` and manifest family
`vinci/grave-geometry`; shared construction is `vinci/myths-construction`,
and the arithmetic is `vinci/computed-minute`. The module adds neither
binary assets nor runtime dependencies. `metadata` contains `kind`,
`slabText`, `plaqueText`, `evidence`, `hour`, `sunDirection`, `classification`,
`geometryDisclosure` and `anchors`. The solar vector and `hour` in this
static metadata describe the start; use `computedHour` for a live sample.

Museum-authored plaque and diagram lettering follow `language`, as do
`metadata.plaqueText` and `metadata.geometryDisclosure`. The name-only slab
retains the same name in both languages. `GRAVE_EVIDENCE` remains the source
English evidence object; the host supplies identified German readings and
the label/drawer/record separation. This module does not mark DOM registers.

The bronze light frame uses bevelled mitred solid strips. Desktop supports reach the paving behind the projecting caption; phone retains its separate slender feet and caption omission. All furniture remains an authored exhibition study.
