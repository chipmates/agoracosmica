# Reading table module

`buildTable(stack, pages, manifest)` receives the existing museum `Stack`, all
438 locked `PageRecord`s in edition order, and the merged `ManifestIndex`.
It rejects an incomplete edition. The returned object is independent of
the bench host:

```ts
const table = buildTable(stack, pages, manifest)
scene.add(table.object)
readingHost.append(table.panel.element)
shelfHost.append(table.shelf)
detailHost.append(table.mirrorDetail.element)
await table.open('B:83v')
// Optional: after the room's lighting and reading camera are ready.
await table.prewarmTurn(scene, camera)
table.turn(1)
table.mirror(true)
table.mirrorDetail.element.hidden = false
// On each room frame, using real wall-clock milliseconds:
table.update(performance.now())
// On room teardown:
scene.remove(table.object)
table.dispose()
```

`open` accepts `83v`, `B:83v`, `D:1r` or `edition:0` through `edition:437`.
It refuses nonexistent manuscript leaves.
Numeric edition requests clamp to the edition's ends. The panel's edition
selector exposes all 438 records, including French, editorial matter,
blanks and missing-leaf notices; its separate manuscript selector lists
represented facsimile leaves. Displayed edition numbers are one-based,
while API indices are zero-based.

`turn(-1 | 1)` normally advances two edition records: one physical leaf has
two printed faces, and facing French is edition matter rather than an extra
Leonardo folio. At index 1 going backward and index 436 going forward, the
destination clamps to the one remaining record. These boundary remainders
are not certified complete two-face leaf turns. Outward turns at terminal
records do nothing. Every record remains directly reachable regardless of
turn parity. `panel.showShelf(boolean)`, `panel.language('en' | 'de')` and
`close(boolean)` compose the DOM and book state. `ready()` waits for the
current opening or turn preparation; animation advances through `update`.
`pending()` includes main-stream, shelf, carrier and prewarm work.
`snapshot()` reports displayed source/reverse files, turn state, text,
errors, scale reference and texture residency. `manifest()` exposes observed
page and shelf records, carrier sources and generated table recipes.

Opening a folio closes the shelf and mirror so its source reading returns.
Closing the book clears those auxiliary views; the bench's open control
retains the current edition page. Enabling the mirror opens the current
page if necessary. The bench makes its shelf and mirror controls mutually
exclusive and exposes both pressed states. The room host owns the layout
and visibility of the accompanying mirror explanation and enlarged detail.

The table's top is local y = 0. The book gutter is local x = 0; the page's
top points along negative z. Coordinates are metres. The room owns the
camera, light, grade and object transform. The bench supplies a single
warm stack key, a neutral grade, and a fixed reading camera. Its lamp shade
has a continuous cap, cone, rolled lip and lit interior. There is no look
or drag camera, hence no added viewing cone.

`src/bench/soft-shadow.ts` configures only the bench-owned key with a
contact-hardening PCSS filter. Blocker search and receiver-plane correction
soften the actual caster silhouette with distance; raw depth reads and
manual comparisons serve the renderer paths without changing shared
shadow code. The bench retains cast shadows at every tier (2048 map for
hero, 1024 for standard and calm) and sets `min(devicePixelRatio, 2)` so
calm does not halve the phone plate resolution. Leaving the bench disposes
its light, restores the shared tier's pixel ratio and resizes the stack to
the window. The reusable table module imposes none of those host choices.

The leaf reference is approximately 23 × 16 cm, explicitly supplied by
`brief/COMMISSION.md`. **The page map contains no physical measurements.**
The reference cannot certify a one-percent match to the original. Complete
1883 scans are contained without changing aspect ratio. Their photographic
margins are retained; no manuscript crop is invented. The display binding
is a modern exhibition carrier, not a reconstruction of an original codex.
The bench reports `mapPhysicalDimensions: null` and the one-percent map
gate as unverifiable. Curved text blocks swell from gutter to fore-edge;
24 shallow edge bands represent groups of leaves without claiming a
historical leaf count. Rounded leather boards surround a hollow spine.

The page stream joins the complete `pages[].file` to manifest `page`,
requiring one `ms-thumb` and one `ms-page` per record: 876 source entries.
It displays the thumbnail before requesting the full plate and fetches
only the local asset plugin's `/na-assets/wing-vinci/msb/` paths. Source
URLs remain provenance links. Both levels require display-grade PD-ART
records and licences, verify downloaded bytes against the recorded
SHA-256, and check decoded pixel counts when recorded. Full plates cannot
exceed the admitted 2K resolution. Images use sRGB. One open plate is held
at 2K, with a small thumbnail cache; residency includes RGBA mip levels. Compact
carrier albedos come from the existing library at 1K, with three scales of
procedural detail. The module's memory is reported separately from the
shared lobby's already-resident materials.

The main thumbnail cache holds at most eight images and pins displayed and
incoming sheets. Two full images may coexist during a turn; settlement
retains only the new open image. `node src/bench/verify-stream.mjs` checks
the actual stream source against delayed fetch/decode completion and
disposal races. It uses mock I/O, not a browser or visual substitute.
Old testimony is hidden before a new record's label appears; a load failure
shows the unavailable-image notice and source text rather than the previous
folio under new copy.

From 83v (edition index 340), the leaf reverse is the actual blank at 341,
and the next right sheet is the printed missing-leaf notice at 342. The
blank is preserved.

The moving leaf is a sampled ribbon with separate front and reverse texture
nodes, updated normals and a shadow cast by its actual geometry. Both
destination thumbnails exist before it lifts; an incoming 2K upgrade does
not change the current label before landing. The ribbon interpolates source
and receiving heights and section thicknesses, with a gutter-root
translation and 0.12 mm surface separation at landing. Settlement transfers
the destination pixels and label to the resting spread. The animation uses
one second of wall time after preparation, with no sound, bounce or
overshoot; a delayed frame may observe settlement after that second.
Reduced motion changes ordinary turns immediately. The calm quality tier
is separate from that preference. `holdTurn(0.5)` is a mid-turn inspection
hook.

Resting leaves use their section's current thickness for the gutter and
crown profile. Completed three-dimensional cross-sections, including rest
and landing, are normalized to the approximate 16 cm reference arc.
`node src/bench/verify-geometry.mjs` extracts the actual geometry declarations
and samples 1,001 poses in each direction: all positions/normals are finite,
every pose remains non-planar, and cross-sections match the approximate
reference. It also checks gutter and receiving endpoints, changing stack
thicknesses, distinct edition faces, block bounds, boundary remainders and
clearance above the loose-copy supports. This mathematical sampling is
separate from rendered motion and does not supply historical measurements.

`prewarmTurn(scene, camera)` prepares the moving material using two observed
draws of the existing resting sheet through the room's actual post pass.
Its exposed face samples the same admitted image with the same roughness;
the resting material is restored afterward. No extra mesh, texture or target
is allocated. Persistent texture nodes avoid rebuilding the shaders when
thumbnails upgrade or folios change. Warmup is counted as pending; turns
wait for it, and telemetry exposes success, draw count and target format.
Page changes, closing and disposal cancel and restore a pending preparation.
The hook is optional and does not create a light or camera.

The physical shelf is a modern oak rack with eight reduced Ms B reading
copies: 74r, 75r, 79r, 80r, 83v, 88v, 89r and 33r. Matching semantic DOM
buttons open their records by name. The rack loads its own eight pinned
manifested thumbnails when first shown. After all eight arrive, it publishes
one merged card mesh with a 1024 × 1024 sRGB canvas atlas arranged in four
columns and two rows. Each complete source fills its 256 × 512 cell; the
physical card preserves the source aspect ratio. Half-texel UV insets avoid
adjacent-cell filtering. The atlas has no mipmaps and adds exactly 4 MiB of
GPU texture residency, in addition to the retained source thumbnails. Its
generated recipe and per-card metadata retain each source page, manifest ID,
licence, source dimensions, atlas cell and index range. Showing the rack
never requests a 2K plate. Additional Codex Atlanticus records admitted to
the merged store are not added to this runtime shelf. The Codex on the
Flight of Birds remains a named absence.

Italian and French use exact text nodes from the map. Unusable/null Italian
is displayed as the grey unavailable notice. OCR errors, historical
spelling and the inherited licence line are not corrected. The map's
available machine descriptions and local concept names supply the shelf;
dossier paths in metadata are provenance, not fetched text. The displayed
folio provenance now uses the corrected full stop: “83 verso, from the 1883
facsimile. The original is in the Institut de France.”

The Italiano/Français buttons choose the visible witness; both exact source
text nodes remain available in the panel. Reading choice persists across
folio and UI-language changes. Table copy is in `content.ts` and bench
controls are in `bench-content.ts`; changing the UI language never
translates the witnesses.

The mirror is a clearly labelled horizontal reversal of the same plate,
beside its unchanged source. It is a reading aid, not a physically traced
reflection. The source's mirror-writing reasons are separated into
documented facts, unproved hypotheses and an unknown personal reason.
The loose mirror copy and isolated phone plate use their own
zero-stack-thickness cockle profiles above flat supports, rather than a
bound leaf's gutter depression. The complete book retains its curved stack
profiles.

Append `table.mirrorDetail.element` below the complete spread for the
explicitly labelled enlarged ink comparison. The two canvas images derive
from the same loaded bitmap, with an exact horizontal pixel reversal and
0.989 MiB total backing storage, reported separately from GPU textures.
`paperOnly(true)` isolates a complete plate on a linen support for a narrow
reading view. Call `paperOnly(false)` before a turn, mirror or shelf view.

`src/bench/orientation.ts` adds the authoritative computed wing hour and its
arithmetic, qualified as context for this modern museum display under a
reading lamp. It adds all nineteen station links with the reading table
marked 13/19. Left/Right/Home/End focus and reveal rail links without turning
the book; normal Tab and link navigation remain available. `Sources · L`
opens a modal drawer with the current full-plate manifest's available
licence, holder, source link and honesty text, plus the hour's integrity
statement. Escape closes it and returns focus; arrow keys in the drawer
cannot turn the book behind it.

The footer preserves the canonical EN/DE station question, door label and
free-quota note. Its public URL uses the registry's public figure slug,
general `f:vinci:1` ask tag and current interface language. It does not
submit or prefill the displayed mirror-writing question. The Sources drawer
repeats that exact question and visibly explains that the library opens
Leonardo's general question, leaving this question here to copy. Rendering
the door sends no query; its link opens a new tab on activation. The helper
returns header, navigation and footer elements and provides language,
source-refresh and disposal hooks for the bench host.

The bench is at `/bench/vinci/table/<state>` and
`window.__forge.jump('bench', { kind: 'table', state })`. The seven states
are `closed`, `open-83v`, `turning`, `mirror`, `shelf`, `open-33r`, and
`phone-open`; `window.__forge.table()` reports the actual open record,
turn, text, manifest, scale reference and live costs. Prefix a state with
`audit-` to display those measurements beside the object for the eyes.

Supplementary `sources` and `french` states expose the drawer and French
witness. `material-oak`, `material-leather` and `material-linen` states
bring the bench camera close to the modern fittings under its reading
light. They do not replace any commissioned state. The material reference
plates do not include their camera or light calibration, so these are
visual studies rather than certified matched-condition renders.

The frozen shared journey, motion, cost and gate scripts measure existing
lobby/wing paths; their actual results are recorded with that scope. The
window-2 commission explicitly says to continue past a shared gate that
measures the wing instead of the table, and the coordinator runs bench
gates. Bench probes and source checks are supplemental evidence with their
own scope, not replacements for independent certification.

Linen supports, including the isolated phone support, use the admitted
0.271 m tile extent and metre UV charts wrapped around padded corners.
This avoids treating each whole support face as one metre of cloth. The
ordinary reading support reuses the same geometry builder and material;
no extra texture or draw is introduced by the rounded edge.

Table texture telemetry includes the main stream, shelf atlas and retained
thumbnails, and carrier material residency. Shared lobby textures, detail
canvas backing storage and frame-attachment estimates remain separate.
On teardown, remove the object from the scene and call `dispose()`. The
module cancels preparation and requests, closes resident bitmaps, disposes
owned geometry, materials, textures and atlas, and removes panel, shelf and
comparison DOM/styles. Late asynchronous results are discarded. The bench
separately disposes its orientation listeners/dialog, light and host,
returns the shared canvas to its stage and restores sizing.

As a dated reference, window-2 round 12 cost images transcribed on
2026-09-09 at 23:45 UTC contain all seven states at both viewports and all
three tiers (42 rows). `forge/table-evidence/window2-r12-cost-transcription.json`
records each source image hash and printed precision. Its standard-tier
rows reported maxima of 40 draws, 59,738 triangles and 45.5 MiB of table
textures against table limits of 40, 200,000 and 64 MiB. Standard frame
times ranged from 8.3–8.4 ms p50 and 9.0–10.1 ms p95. Each of the six images
reported a 44 px minimum visible target and a maximum of two persistent
marks across its seven states. Sampling used 132 settled frames per state
and a 120-frame rolling meter. Frame attachments were a separate estimate
(standard range 22.0–47.1 MiB). These manually transcribed observations of
that round do not certify the final build, trusted input or independent
gates; later reports and bench evidence must identify their own revision
and measurements.

Additional bench inspection routes `reader-it` and `reader-fr` place the existing
source panel at the phone's reading position; they do not alter the seven sealed
scene states. `scale.rendererPixelRatio` reports the actual renderer ratio for
resolution checks. Entering any bench state closes a prior Sources modal before
applying the requested state; the `sources` inspection state then opens it afresh.
The supplemental source probe exercises this transition explicitly.
