# Presumed grave

`createGrave(materials)` returns `{group, metadata, dispose}`. The materials
are the same `ExhibitMaterials` used by `../myths`: `stone`, `plaster`,
`bronze`, `ink`, `dark`. The host supplies TSL node materials, camera,
lighting, accessible reading surface and input. Units are metres, +Y is up,
and +Z faces the reader. Call `dispose()` on unmount; supplied materials
remain owned by the host. Static geometry is welded by material; `?noweld`
preserves parts for the cost comparison.

The constructor creates no DOM, light, camera, input handler or clock. It
includes a jointed exhibition floor; do not add a coincident floor. The
returned `metadata` is also assigned to `group.userData.exhibit`. If a host
welds the returned group again, preserve its manifest identity and convert
the published local-space anchors through the group's world transform.

| Import | Export | Purpose |
| --- | --- | --- |
| `./index` | `createGrave(materials)` | Creates static exhibit geometry and metadata. |
| `./index` | `GRAVE_EVIDENCE` | Exact made-slab/plaque words and cautious historical interpretation. |
| `./index` | `GRAVE_HOUR` | Rounded start-minute values, date conversion, site and reference paths. |
| `./index` | `graveSunDirection()` | Start-minute unit vector in the exhibit's local frame; takes no time argument. |
| `./hour` | `computedHour(seconds = 0)` | Computes the chosen minute continuously, returning `ComputedHour`. |
| `./hour` | `ComputedHour` | Public TypeScript result type. |

The name-only slab's anchor is `(-0.95, 0.24, 0.65)`. Its stone layer is
2.04 m wide × 3.61 m long × 0.13 m thick, on a 2.16 × 3.74 m base. Its
top facing is 1.98 × 3.55 m. The slab's only writing is **LEONARDO DA VINCI**.
This is an openly generated exhibition study: its dimensions are not an
attested survey of the actual tomb. A neutral empty bronze inset marks the
place of a medallion without fabricating a human portrait. The admitted
reference photograph was inspected, not projected or textured. No remains,
burial scene or invented epitaph are present. The empty inset is an
interpretive omission, not a claim that the real tomb lacks its documented
bronze portrait roundel.

The separate lectern at `(1.44, 0.9, 1.5)` says **presumed remains** and
dates the excavation to 1863. `GRAVE_EVIDENCE` gives the host the fuller
reading text: Houssaye reported a skeleton; identification is not proof.
The separate chapel plaque is known from its account, not from a held
photograph. Its text is not forged onto the slab. The precise 1874 transfer
date and the letter fragments stay qualified as requiring the historical
record, following `refs/RIGHTS-CROSSCHECK.md`. The exhibition lectern's
layout and English words do not claim to reproduce a photographed chapel
plaque. Keep `metadata.geometryDisclosure` visible in the host's source
drawer so the carrier's assumptions are available to the visitor.

The deep frame centred at `(1.2, 2.46, -1.34)` holds a small three-dimensional
gable study and a physically inscribed hour mount. Its backing is
3.13 m wide × 2.55 m high; the gable outline is 1.90 m wide × 1.75 m high
with a 0.20 m extrusion. These are authored exhibition dimensions. The
window, ashlar, roof, frame and slab do not constitute a surveyed replica
of either historic building or tomb. The gable's orientation carries the
calculation; its decorative geometry does not testify to a 1519 elevation.

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
`localApparentSeconds`. The two displayed clocks round to the nearest second.
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
readable numerical label from the same `computedHour` sample. The physical
mount correctly labels **START** values and the whole 18:50–18:51 interval;
it does not pretend its static letters are a running clock. The host owns
wall-clock playback, pause/replay, reduced-motion policy and ambient fill.
The original calculation and day's track are in `refs/place/notes/hour.py`
and `hour-2may1519.txt`.

Every made part declares `GENERATED` and manifest family
`vinci/grave-geometry`; shared construction is `vinci/myths-construction`,
and the arithmetic is `vinci/computed-minute`. The module adds neither
binary assets nor runtime dependencies. `metadata` contains `kind`,
`slabText`, `plaqueText`, `evidence`, `hour`, `sunDirection`, `classification`,
`geometryDisclosure` and `anchors`. The solar vector and `hour` in this
static metadata describe the start; use `computedHour` for a live sample.
