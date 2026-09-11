# Vinci inscriptions

`createInscription(id = 'richter-498', language = 'en', options)` returns an
object with `group`, `width`, `height`, `passage`, `text`, `siglum`, `available`,
`reason`, and `dispose()`. `options` accepts `surface` and `ink` Three materials,
`width`, `height`, and cap-height `size`, all lengths in metres. The caller owns
materials it supplies. The module disposes its own geometry and fallback
materials. The default slab is 4.8 by 3.25 m and 0.30 m thick, centred in XY;
its front is z=0 and thickness extends toward -Z. Face it toward +Z.
Height expands for longer passages to preserve the requested letter size;
the returned height is the authoritative carrier extent.

The module imports `data/inscriptions.json`, a byte-identical deployable copy of
locked `brief/collection/inscriptions.json`. `src/bench/verify-data.mjs` verifies
the exact bytes, SHA256 and record counts against that source. Only `text_en`
and `text_de` are used, verbatim, with their original punctuation and case.
`display_text_en/de` are normalized readings and are never used for quotations.
Richter 498 is the default because both languages are independently ready and
its Forster III f. 24v identification is A. Each surface carries one passage,
with its exact folio siglum smaller below. Changing language rebuilds the
surface from its corresponding source; the caller disposes the old instance.

A null German source returns `available:false`, `text:null` and the exact
catalogue `de_status` as `reason`. A passage not ready for standalone display
also returns `available:false`, with catalogue folio notes as `reason`. Neither
case creates a quotation mesh. The caller must show that status in its source
drawer and must never supply a guessed translation or silently substitute EN.

`createText(text, {size, maxWidth?, depth?, material, lineHeight?, bevel?})`
returns `{mesh, width, height, lines, lineWidths, size, dispose}`. The mesh is real extruded
glyph geometry, facing +Z in local XY. Its top-left bound is at (0,0), and it
extends right and down (-Y). `width` and `height` are measured geometry bounds;
`lineHeight` is the baseline distance as a multiple of cap height (default
1.40). Default depth is 0.0015 m. Long words shrink the whole setting only when
they could not otherwise fit. Wrapping changes whitespace alone; the exact
original string is held in `mesh.userData.text`. Unsupported characters fail
explicitly rather than being silently rendered as question marks.

`mesh.geometry` is one mergeable, ungrouped buffer geometry. For repetitive
labels, clone it, apply the desired transform and merge the clones by material;
that produces one draw per material. The source text meshes do not dispose
their caller-owned material. `?noweld` is the integrating scene's responsibility.

The font is `Vinci Bench Roman`, an original procedural serif vector alphabet
defined in `font.ts`. It is consumed by Three's existing `FontLoader` and
`TextGeometry`; no runtime package, bitmap, system font or fetched typeface is
added. Capitals, lowercase, numerals, German umlauts, ß, the French accents in
the collection and its punctuation are independent literal glyphs. Its
source recipe is the regeneration record. The main letters have 2 mm physical
thickness as ink laid into a modern exhibition stone; this is a declared made
carrier, not a facsimile of an original Leonardo wall inscription.

Manifest IDs expected from the integrating bench:

- `vinci/bench-vector-letters`: GENERATED, font/text geometry recipe in these
  source files, original source, procedural model, 2026-09-09, SHA256 of source.
- `vinci/bench-inscription-carrier`: GENERATED, modern rounded limestone slab
  and dressed edge, original source, procedural model, 2026-09-09, SHA256 of source.

The normal bench supplies its shared three-scale limestone and ink materials.
The standalone fallback still provides procedural macro mottling, mid-scale
mineral variation, fine roughness and distance thinning. No reference plate is
sampled or displayed by this module.
