# Correction exhibits

Import `createMythDeathbed(materials, plateTexture?)` or
`createMythQuotes(materials, options?)` from this directory. Both return
`{ group, metadata, dispose }`. The host owns the camera, lights, stage,
navigation, language controls, accessible reading surface and supplied
materials/texture. Call `dispose()` when striking an exhibit. It releases
geometry and the deathbed's internally created paint material; it does not
release host materials or the supplied texture.

`ExhibitMaterials` contains `stone`, `plaster`, `bronze`, `ink`, `dark`, all
Three.js `Material`s. The host supplies TSL node materials with three-scale
detail. All dimensions are metres; +Y is up and +Z faces the visitor. Static
construction and geometric letters are welded by material. `?noweld` keeps
the same physical parts separate for a measured A/B.

The returned `group.userData.exhibit` is the same object as `metadata`.
The scene constructors create no DOM, camera, lights, event listeners or
animation loop. Recreate a quote wall when its phone index or composition
changes, and dispose the previous exhibit. The modules include their own
shallow jointed floor and backing wall; do not add a coincident floor.

| Export | Contract |
| --- | --- |
| `createMythDeathbed` | Creates the measured display carrier, physical frame, wall and full-image surface. |
| `createMythQuotes` | Creates six desktop records or one mobile record on physical plaster. |
| `ExhibitMaterials`, `ExhibitionObject`, `MythQuotesOptions` | Public TypeScript integration types. |
| `INGRES_MANIFEST_ID`, `INGRES_DISPLAY` | Admitted plate identifier, carrier dimensions, source image pixels and original-work dimensions. |
| `DEATHBED_EVIDENCE` | Claim, earliest named source, Vasari passage, counter-evidence, verdict and age discrepancy. |
| `APOCRYPHA` | The six locked source records; no authored replacement quote or origin. |

## Deathbed

Dimensions distinguish three different objects:

| Object | Height × width | Meaning |
| --- | --- | --- |
| Original Ingres oil painting | **40 × 50.5 cm** | Source-catalogued original work; this is not a four-metre painting. |
| Modern exhibition support | **3.9697265625 × 5.000 m** | Enlargement carrier; depth 0.090 m, centre `(0, 2.8, -0.04)`. |
| Complete admitted image | **3.9697265625 × 5.000 m** | Height is exactly `5 × 3252 / 4096` metres; centred at `(0, 2.8, 0.012)`. |

The admitted Q084 image is **4096 × 3252 pixels** and shows the complete
painting, including its narrow worn perimeter, without a photographed
decorative frame. Its native aspect ratio is retained: the module neither
crops nor warps the image, and the solid support has the same dimensions.
This places the displayed height **0.7568359375% below four metres**, within
the commission's one-percent dimensional gate, while preserving all source
pixels. The scan's proportions are not forced to the catalogue's 50.5:40
canvas ratio. Stepped mouldings and carved beads form the physical modern
frame; the complete constructed wall is 8.6 m wide × 6.05 m high.

The size conflict is explicitly disclosed in `INGRES_DISPLAY.label` and
physical lettering. A host must keep the original-size/enlargement
distinction in its readable source panel. The original dimensions are
documented by LIFE plate L01 in `refs/MINING-CATALOG-LIFE.md`; the displayed
image's admission is PLACE plate Q084 in `refs/RIGHTS-CROSSCHECK.md`.
`brief/CONCEPT-OPUS.md` S18 supplies the enlarged exhibition premise.

Resolve `INGRES_MANIFEST_ID` through the app's manifest, require
`display: true`, load its `wing` and `path` from the asset origin, and provide
the texture in sRGB. Do not use `source_url` as an image URL; that field is
the source citation. This file is classified **PD-ART**, with manifest
licence `Jean-Auguste-Dominique Ingres, Public domain, via Wikimedia Commons`
and holder `Petit Palais, Musee des Beaux-Arts de la Ville de Paris`.
The physical credit reads `Paris Musées · PD-Art`; display the manifest's
complete licence string in the source drawer. The separate framed LIFE L01
file's CC0 classification does not replace Q084's actual manifest class.

If no texture is supplied, the image mesh remains invisible and the solid
carrier stays present. The constructor does not fetch, validate or replace
missing bytes. The host must report a failed load rather than present the
empty carrier as a loaded painting. `dispose()` releases the internally
created image material but leaves the supplied texture to its loader/host.

`DEATHBED_EVIDENCE` supplies the claim, later source, counter-evidence and
cautious verdict for the host's legible reading panel. The royal act was
issued at Saint-Germain-en-Laye on **3 May**, the day after the death, and
the chancellor-signature caveat prevents claiming that it alone proves the
king's whereabouts on 2 May. Melzi's letter is dated 1 June 1519. The
exhibit does not assert a witnessed bedside. Sources: `refs/MINING-CATALOG-LIFE.md`
M1, `brief/CONCEPT-OPUS.md` S18, `brief/CONCEPT-GPT6.md` Station 20.

## Apocrypha

`options` is `{mobile?: boolean, quoteIndex?: number}`. Desktop holds all six
records in two columns on one 9 × 5.4 m plaster wall. Mobile restages one
record on a 3.7 × 4.9 m wall leaf; the host advances `quoteIndex` through all
six using real scroll/swipe and previous/next controls. Supply a finite
integer index from 0 to 5. Omission selects 0; finite out-of-range values
are clamped. The module does not round fractions or sanitize `NaN`, so route
and input parsing belong to the host. `mobile` defaults to false.

`APOCRYPHA` imports `../words/data/inscriptions.json`, a byte-identical copy of
locked `brief/collection/inscriptions.json`. `src/bench/verify-data.mjs` checks
its SHA256 and all 52 passage and six apocrypha records against the original.
Every displayed quote and `actual_origin` is the exact string from that
array. Layout only adds line breaks. Every quoted line is crossed with a
physical pigment ridge. Actual origins remain unstruck. Unknown authors
remain unknown; the Luce parallel is not labelled as proof of an identical
sentence. All exact visible text and indices are exposed in `metadata`.

Quote metadata contains `kind`, `quoteCount`, `visibleQuotes` (zero-based),
`exactText` (alternating quote and origin), `textClass`, `source`, `mobile`
and `wallSizeM`. Deathbed metadata contains `kind`, `plate`, `display`,
`evidence` and local-space `anchors`. The plate mesh also retains its
manifest class/id, original size, support size, image pixels and uncropped
flag. If the host welds again, preserve these identities and anchors.

## Traceability and limits

All exhibition construction and made text declare `GENERATED`, with manifest
family `vinci/myths-geometry`. The plate separately declares its
PD-ART manifest identifier. Shared construction is recorded separately as
`vinci/myths-construction`; glyph construction as `vinci/bench-vector-letters`.
The architecture is modern exhibition furniture,
not a reconstruction of Leonardo's room. Fine texture comes only from the
host's manifest-backed materials. This module loads no binary assets and
adds no runtime dependency.
