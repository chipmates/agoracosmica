# Picture hang module — window 2

The module hangs the commissioned register in metres and resolves reproductions under the 9 September 2026 source policy. Measured field geometry, source-image aspect and authenticated physical image registration are separate claims. This contract does not certify that every reproduction matches the original’s centimetres.

## Import and ownership

```ts
// Paths for a consumer directly inside src/wings/vinci/pictures/bench/; adjust for the room file.
import { loadManifest } from '../manifest'
import { buildHang, MAIN_HANG } from '../wings/vinci/pictures'

const manifest = await loadManifest()
await Promise.all(['gold-leaf', 'oak-beams', 'canvas-raw'].map(
  name => stack.materials.load(name),
))
const hang = buildHang(stack, MAIN_HANG, manifest, { gapM: .56 })
scene.add(hang.wall)
labelHost.append(hang.labels)

// In the caller’s render update, with its actual unparented camera:
hang.stream(stack.tierName())
hang.update(camera, dt, selectedWorkId)

// Before releasing the caller’s material library/scope:
hang.dispose()
```

`buildHang(stack, register, manifest, options?)` owns one hang assembly and its source streams. It does not own the room, route, camera, lights, render loop, stylesheet, selected-work dock or shared material textures. The room consumer must provide those, mount the detached DOM, choose its label/selection policy and dispose the hang before its private material scope. `options.gapM` defaults to 0.56 m; values below 0.12 m and non-finite values throw. The complete-hang bench passes 2 m so adjacent assemblies clear its common phone view while all 25 works and 26 main images remain mounted and visible. Every work’s dimensions and manifest join, and duplicate work IDs, are checked before allocation. Other allocation/library failures are not promised to be transactional.

`index.ts` re-exports the register and scale APIs. Import policy, registration and stream helpers directly from their respective files. `createWorkLabel` is the current policy-label composer. The older exported `certaintyColour` and `displayPlates` helpers remain for compatibility; current hang admission and label certainty come from `resolvePicturePolicy` and `policyCertainty`.

| Handle | Contract |
|---|---|
| `wall` | `Group` in metre-local XY coordinates; +Z faces the viewer. Do not scale it. Preserve main centres at world Y=1.55 for the datum checker. |
| `frames` | Ordered `HungFrame[]`, one per supplied work. `aperture` is the primary measured field plane or null. `furniture` holds modern display geometry, including a reverse face’s separate field and backing. `cards` holds `{entry,mesh,stream}` for each main source/face. |
| `extent` | Actual builder layout width, including additional faces, spacing and minimum one-metre layout slots. Use it when placing the hang; do not assume it equals the sum of painting widths. |
| `labels` | Detached `.picture-anchors` DOM containing dots, field captions and any fallback well captions. The selected-work dock is caller-owned. |
| `setVisible(ids?, reproductionsOnly=false)` | Filters frame/furniture/source geometry without changing its scale. Omitted IDs selects all. Reproductions-only hides measured fields and furniture. The caller still supplies matching dock/caption selection. |
| `stream(tier)` | Reconsiders the shared full-resolution residency slot using the most recent camera from `update`. No observer means no upgrade. |
| `update(camera,dt,selectedId?)` | Updates world matrices, source transitions, projected anchors, selection state and streaming. |
| `pending()` / `errors()` | Requests plus unfinished arrival/resolution transitions, and current image errors. Zero pending alone is insufficient. |
| `textureMB()` | Owned live source RGBA8 allocations in MiB, including exact non-square mip chains and placeholders; excludes library/probe/GI/render targets. |
| `contactStats` | Directional receiver visibility diagnostics. This is neither measured illumination nor diffuse-GI validation. |
| `dispose()` | Idempotently releases owned geometry/materials, requests, bitmaps, textures and timers; removes hang and anchor DOM. Shared library resources stay caller-owned. |

DOM projection currently uses `innerWidth/innerHeight`, so an inset canvas needs an adapted projection. Streaming uses card world positions and `camera.position`; keep the camera unparented or adapt that distance calculation. Scalar px/cm verification requires a camera parallel to the measured plane. Rotating a room/hang also requires transforming the directional-contact light vector into its local coordinates; `buildHang` currently uses the bench direction.

## Register, rights and source identities

The immutable `data/paintings.json` supplies **30 locked works**, including **24 main chronological works**. Its 11 DG / 18 RC / 1 REF classes and historical display-mode strings remain auditable. They are not the current source-admission decision. The new policy admits an old RC work only through its actual tiered, displayed manifest record. Reference-only content remains inadmissible.

The store contains **27 new full plates plus 12 legacy full plates**, each with a preview. Five explicit replacements leave **34 surviving source identities for 31 work IDs**. Of the locked register, **29 works now have a displayed main reproduction**; **Wilton Leda is the sole source absence**. Ginevra’s reverse adds a second face, so those 29 works produce 30 main images. The `complete-hang` budget segment contains 25 works and 26 main previews, because it includes the 24 main works plus Isabella, not the entire mural register.

`findPlateEntries(work,manifest)` delegates to `resolvePicturePolicy(...).mainPlates`. `resolvePicturePolicy` also exposes documentary `alternatives` and `all`. `resolveManifestWorkPlates(workId,manifest)` exposes every surviving identity, including the store-only Vitruvian Man and Turin drawing. The Sources catalogue now makes all 34 identities accessible through **Browse all reproduction sources / Alle Bildquellen**, without assigning them invented dimensions. Salvator’s restored painting, Cook photograph and independent engraving published in 1844 remain three distinct images; the engraving does not inherit the painting’s size. Neither store-only drawing has a commissioned physical-size record.

Selection applies explicit `supersedes` before ranking, pairs preview/full records by stable `plate_id` identity and consistent source/licence/honesty, and retains unsuperseded legacy DG plates. It rejects malformed identities, paths, roles, classes, dimensions, duplicate records and ambiguous preview joins. Only `ASSET_BASE + wing + path` forms a texture URL. `source_url` is a citation, never an image endpoint. The runtime checks decoded dimensions; it does not rehash every fetched JPEG. Store metadata and the recorded source-byte audit provide hash evidence.

The independent [source-catalogue module](bench/source-catalogue.ts) preflights the complete manifest before creating image DOM. It offers a native source selector, paged complete-image thumbnails, a selected preview/full-resolution control, exact supplied English and German honesty text, verbatim licence, and expandable pixel/hash/citation records. `createSourceCatalogue(manifest,{selectedId?,pageSize?,onClose?,onSelect?})` returns `root`, `records`, `select(identity)`, `selected()`, `measure()` and idempotent `dispose()`. The bench mounts it inside its Sources dialog; forge views `catalogue:vitruvian-man`, `catalogue:turin-self-portrait`, `catalogue:salvator-mundi:restored`, `catalogue:salvator-mundi:cook-historical` and `catalogue:salvator-mundi:print-1844` select those exact identities. Catalogue image readiness and errors appear in `__forge.hang().sourceCatalogue` and the bench’s pending/error hooks.

These complete HTML images belong to a reading view, not the measured wall or its Three texture account. The catalogue validates loaded natural pixel dimensions and exposes a separate `decodedRGBAEstimateMiB`: unique loaded source IDs × natural pixels × four bytes. That estimate excludes browser cache, compositor storage and all Three textures. Switching pages/sources or disposing the catalogue removes the previous image URIs and handlers. [source-catalogue-check.mjs](bench/source-catalogue-check.mjs) verifies all 34 identities, literal bilingual copy, independent source dimensions, rejection, pagination, failure reporting and disposal; rendered layout and browser memory still require EYES evidence.

## Physical fields, source windows and frames

`trueScale(work)` converts centimetres to metres without changing the supplied extent. An unknown dimension produces null; known nonpositive/non-finite values throw. Main fields retain the locked 1.55 m centre. A null historical datum remains null in evidence even where modern furniture needs a display height.

For works with measured dimensions, the first source plane sits **inside the work’s measured field**, centred on it. Further faces sit beside the primary assembly. `reproductionCardSize` uniformly contains the source aspect within the supplied field: `s=min(W/p,H/q)`, output `(sp,sq)`. It has no arbitrary 0.76 m cap. If source and field ratios differ, one source axis remains shorter; the function does not stretch it to make both axes pass. Ginevra’s reverse has its own same-sized field, mat, backing and moulding; the two measured fields are separated by 0.34 m. Both mounts follow the same work’s visibility and use distinct contact-cache identities.

Eight conservative display windows in `registration.ts` remove clearly external photographic context around Anne, London Rocks, Litta, Mona’s printed illustration, Annunciation, Musician, Saint John and Lansdowne. They bind the exact source/evidence IDs and hashes. `pictureDisplayUV` applies an affine UV window; geometry uses its `contentAspect`. The source bytes, colours and grain are unchanged by the window. The complete unwindowed prepared image must remain accessible in Sources. These windows retain narrow uncertain edges and do not authenticate physical corners. All report `physicalRegistration:false`; a close ratio is not promoted to `registeredReproductionPass`.

The three generated arch mats in `arch-mask.ts` cover inspected non-painted shoulders for the Louvre and London Rocks and Benois Madonna. They use measured source-column polylines, bind exact source/evidence hashes and share the surrounding mat material at 0.4 mm in front of the source plane. Louvre and Benois retain five and seven preview pixels respectively toward the white shoulder; London retains 24 full-source pixels toward the photographed gilt/rebate. Louvre and Benois traces are normalized from the exact previews onto their corresponding full plates; the source checks do not claim full-resolution semantic segmentation. The full source view omits these mats. They preserve source aspect and keep `physicalRegistration:false`; neither a mat nor a rectangular crop authenticates the physical arch. Spiridon and Tavola lack complete source boundaries and have no approved crop. The Last Supper top-cornice candidate remains unapproved because the complete painted-field boundary is unverified.

The generated moulding has a **52 mm face width and 45 mm body depth**, running from Z=6 to 51 mm. A **40 mm mat border** surrounds the measured field; the frame aperture includes this added border, so frame dimensions are never painting dimensions. A 16 mm opaque backing occupies Z=4.8–20.8 mm; the measured field is at Z=21 mm and source plane at Z=23 mm. These are modern exhibition supports, not reconstructed holder frames.

| Exceptional placement/extent | Treatment |
|---|---|
| Mona Lisa | Present historical printed reproduction within the locked 79.4×53.4 cm field; signature centre stays 1.55 m. The print does not authenticate the original panel edges or colour. |
| Ginevra | Obverse and reverse belong to the same 38.1×37 cm original panel, displayed in separate equal modern mounts. The 42.7 cm later addition is not substituted. |
| Anne | Field 168×113 cm; later support 168×130 cm remains a different documented extent. |
| Last Supper | 460×880 cm field, modern lower edge 0.50 m/centre 2.80 m. Source datum remains null; mural camera composition is explicitly separate. |
| Other measured non-main records | Modern lower edge 0.80 m; their null historical datum remains null. |
| Sala delle Asse | Unknown painted extent: no measured aperture. The complete monochrome source is uniformly contained within a modern 1.15 m wide × 0.72 m high document carrier, with a 40 mm mat border, backing and moulding. Its current 4096×1428 aspect yields a 1.15×0.401 m source plane. These are furniture dimensions; the approximate 15×15 m room footprint is never a painting size. |
| Wilton Leda | Unillustrated catalogue card, no painting, aperture or gilded frame. Its historical 96.52×73.66 cm catalogue figure is quoted rather than certified as a current object measurement. |

## One light and resource budgets

The bench key is azimuth 235°, elevation 34°, 6,800 K with the stack’s ambient/environment terms. Geometry-based directional contact samples 25 rays in a 6° angular-radius disk around that same key. It uses actual moulding and opaque support triangles and a declared 0.17 radiance fraction. This composited direct-shadow approximation supplies sub-texel joinery shadows; it is not an even hemisphere halo, a second light, measured lux or diffuse GI. Keep it consistent with the room light, and avoid double attenuation if shadow maps resolve the same contact sufficiently.

Only physically mounted work furniture enters that directional receiver's occluder group. The unframed Wilton catalogue sheet is excluded; both Ginevra faces and Sala's actual documentary backing are retained. Cloning furniture for every register entry, including an entry without a physical placement, creates a stray shadow at an unrelated mount. The presentation check exercises the production assembly and rejects that former loop.

The bench installs Three r185’s `PCFShadowFilter` on that key’s existing shadow map with a 1.5-shadow-texel radius. Its five Vogel-disk comparisons use deterministic screen-pixel rotation and no time input. Install the filter before receiving-material compilation and again on each new key after relight. The helper adds no light or shadow map and respects the tier’s shadow policy. A fixed-camera deterministic pattern does not establish motion stability; EYES must still verify moving edges.

The separate bench diffuse field is one declared diffuse bounce from the actual generated room/window geometry. Its 128×64 RGBA16F allocation is 0.0625 MiB. It requires matching room/bake provenance, affects the eligible back wall and does not activate the shared stack GI placeholder. See `src/wings/vinci/pictures/bench/diffuse-gi.md`. Material/probe/GI ownership and costs belong to the room/bench, not `hang.textureMB()`.

`src/wings/vinci/pictures/bench/gi-config.json` declares architectural extents independently of the current source hang. The drawer, murals and complete-hang rooms use 12 m, 27.34 m and 89.48403834732778 m extents respectively; the wall adds 1.2 m beyond each end. The caller centres the actual hang within that extent without changing its source dimensions or camera calibration. Each room uses its own matching regenerated diffuse field, and the runtime rejects mismatched room metadata.

The window-2 tier contract is **512 px preview uploads at calm/standard, 1024 px at hero, and at most one distance-earned full source up to 4096 px outside calm**. `buildHang` selects this tier upload size when it constructs streams. `createPlateStream(preview,full,{previewMaxEdge})` supports the same contract; direct callers default to 1024 and must choose the tier option explicitly. Changing a mounted stream’s tier does not resize its existing preview; the bench remounts the hang on tier changes. A 512 upload is derived only after decoding and validating the original manifested preview. It uses the full source extent, high-quality resizing and no second orientation/colour conversion. `residency().previewUpload` and `allocation()` expose the actual source/upload sizes and mip allocation; do not call this a native 512 source.

Preview arrival fades over 240 ms and resolution changes over 700 ms of wall time. Timers settle transitions even with frozen scene `dt`. `ready` always settles; inspect availability/error separately. Full-load failure preserves an established preview. The hang releases all other full textures before granting the next slot, requires a visible source within 2.2 m and checks the tier texture budget. `high(false)` resolves after release, including late decodes. Disposal aborts, closes late images and clears timers.

The caller’s cost input must include non-hang resident allocations. Add `hang.textureMB()` once to published totals. Standard limits are 150 draws, 1.2M triangles and 256 MiB; measure current costs after source, tier, material or geometry changes. Old twelve-preview cost tables are not window-2 evidence.

### The opening's own terms (window 7)

`NORTH_WINDOW_LIGHT` is a declared exhibition light, not a measurement of illuminance. Its compressed band `range` is the tone a surface takes near the reference distance; below the band the term keeps a shallow slope of its own at `shoulder` of the band's own slope down to `shoulderFloor`, and above it the same at `crest` up to `crestCeiling`. Without those two shoulders a nine metre wall computes one value over its far two thirds and a mount two metres from the glass computes one value over its whole width. `floorFraction` and `floorReach` are the return off the boards: a floor under the direct term that itself halves at `floorReach` square metres from the opening, so the direct term still models the wall along its whole run. A gallery with another window passes its own record and nothing else changes.

A board inside a moulding is shaded by the section that holds it. `REBATE_RISE_M` is how far the inner lip stands above the board and `REBATE_SKY_M` how much of the board's sky the section closes; the cast band's width is that rise times the light's own slope, so it is a few centimetres opposite the glazing and crosses the whole mount far along the run. Geometry that takes these terms declares the moulding's opening in a `rebateHalf` vertex attribute in its own metres, and a surface that declares none takes no rebate term at all. The absence mount's window is CUT: its four cut faces take the same ratio of cosines the mouldings take. Reproductions take the run's falloff and nothing else, so no cast band ever darkens a plate.

`buildHang(..., { skirtingM })` is the room's skirting height, 11.2 cm by default. A work hung on the datum can reach far enough down that the wall below its moulding is thinner than its certainty mark; the mark then stands at the frame's own bottom corner on the window side rather than on the stone. A gallery with a taller plinth passes its own height.

## Labels and bench hooks

`createWorkLabel(work,entries,expanded?)` composes bilingual current labels with exact source licence/honesty lines. It removes the obsolete availability prefix from an admitted work’s first line while retaining the locked title/attribution wording. Unavailable wording becomes “Not shown / Nicht gezeigt”. Expanded Sources retains the complete original EN/DE first lines and dated historical rights decision. Attribution certainty is independent of image permission; the four-colour key explains documented, unknown/unavailable, qualified/reconstructed and disputed/conjectural states. German notes carry the same measurement caveats as English. The bench’s language buttons select the reading column without rewriting its content.

The module adds no museum-path entry. `src/wings/vinci/pictures/bench/index.ts` owns `/bench/vinci/pictures/<segment>#work=<id>` and `__forge.jump('bench',{kind:'pictures',segment,work?,view?})`. The six sealed IDs remain `early`, `milan`, `florence`, `late`, `absences` and `signature`; `absences` is now the newly available pictures view. Additional segments are `drawer`, `murals`, `complete-hang` and `materials`. Route/segment identifiers do not change when rights policy admits images.

The normal panel wall uses one CSS px/cm calibration per viewport, independent of the selected work. On a phone it selects one work and retains that scale. Murals may use a separately fitted architectural view. `inspect` is an explicitly fitted source inspection; Ermine additionally offers `near`/`picture-room-near` at 45 cm with adjusted FOV. Neither inspection mode is evidence of common cross-work viewing scale. `sources`, `german`, `audit`, `audit-page-N` and view combinations support source/language/evidence inspection. The `materials` segment’s `material-gold`, `material-plaster`, `material-oak` and `material-limestone` views compare the stock library treatment on the left with the current production shader on the right, using equal local geometry, a shared camera/light and 40° vertical FOV. `hang().materialPair` records both centre distances and current camera/light values. These local comparisons do not reproduce the unknown reference-preview camera and light settings.

Previous/next, arrows/PageUp/PageDown, wheel and horizontal swipe navigate works/segments. Labels, Sources and audit regions keep their own scrolling. `L` cycles off/dots/card; Escape closes Sources or returns to the wall. There is no drag/look envelope: `lookCone:null` is truthful and `look()` is a no-op while the bench owns the scene. Do not report four identical calls as meaningful corner views.

| Forge hook | Meaning |
|---|---|
| `jump(...)`, `station(id)`, `rail(t)` | Start asynchronous mounting; return is not mount completion. |
| `state()` | Active segment, ownership/loading/error, pending counts, draws/triangles and null look cone. |
| `work(id)` | Selects a work already mounted in the segment; returns boolean. |
| `hang()` | Full live measurement record: field and source geometry separately, source windows/registration limits, residency/upload sizes, costs, light/GI/contact details, targets, marks, pending/errors and `auditReady`. |
| `cost()`, `tier(name)`, `relight()` | Current accounting, tier remount retaining selection/view, and current-key rebuild. |
| `manifest()` | Generated picture records, library records and active source records; policy catalogue consumers may need the full manifest index. |

Before recording numbers require `data-forge="bench"`, the requested segment, zero pending, empty errors and `auditReady:true` (at least 120 bench updates and meter samples). `bench-error` is a failure. `measureProjectedWork` measures actual geometry/matrixWorld in CSS pixels against independent camera projection and a 1 mm datum tolerance; it does not know what image pixels depict. Preserve each row’s exhibited/visible/frontParallel state. The audit panel is a paged transcript and its JSON download retains all rows; it performs no measurement itself.

## Verification and continuation

Use the focused scale, policy, registration, stream, transition, lifecycle, contact/shadow, material and diffuse-GI checks for their declared domains; typecheck/build must also pass. Current source-check output and current EYES evidence belong in window-2 reports. A field-geometry pass does not settle unresolved source registration; offline lifecycle checks do not prove rendered flicker, real-input navigation, phone composition or backend performance.

The room importer owns final bench-targeted input, motion, cost and WebGPU/WebGL2 evidence, plus matching room/light/material provenance. EYES owns the browser/rig at ports 5308/5238. Keep the sealed primary states, shared hooks and source register unchanged. Regenerate only affected generated recipes/bakes after relevant changes, refresh their manifests, and dispose caller-owned resources in the correct order.
