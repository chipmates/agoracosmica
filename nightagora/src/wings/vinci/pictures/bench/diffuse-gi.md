# Bench wall diffuse GI

This is a real offline one-bounce diffuse transport calculation for the generated bench architecture. It does not activate `src/stack/gi.ts`, solve specular transport, integrate the HDRI, or claim a measured illumination level.

`diffuse-gi-bake.ts` is a pure TypeScript solver accepting exact triangle geometry, linear reflectance/emission and a wall domain. `bake-diffuse-gi.mjs` instantiates the actual `room.ts` geometry with material-loading doubles, extracts all triangles and their vertex tones, and supplies a declared mean reflectance model. It loads no material images or painting rasters. The light emitter is the actual two north-glazing triangles and their generated material's linear emissive colour times intensity. Escaped rays are black in this window-only model.

For each wall receiver, 64 deterministic cosine-hemisphere rays find the first physical surface. Four stratified samples of the area emitter are connected to that hit, with geometric visibility rays and both endpoint cosine factors. The reflected radiance is `rho * E_direct / pi`; integration back to the wall gives `E_indirect = mean(rho * E_direct)`. Thus each nonzero contribution follows **window → reflecting geometry → wall**. No analytic spatial gradient, hand-painted shadow, distance ramp or AO value enters the result. Direct emitter visibility is excluded from the stored field.

The default field is 128×64, with RGB indirect irradiance stored as decimal text JSON. Row zero is the lower wall edge, and samples are at cell centres. The runtime converts it into one linear RGBA16F texture with no mipmaps: **65,536 bytes / 0.0625 MiB**. It adds `existing wall albedo node * E_indirect / pi` to the existing emission graph. Colour, roughness, normals and all three detail scales remain intact. A flat eligibility flag restricts this addition to the local z=0/+Z wall face; the side wall shares the material but does not sample this map.

## Commands

```sh
node src/wings/vinci/pictures/bench/bake-diffuse-gi.mjs --segment signature --extent .534 --dry-run
node src/wings/vinci/pictures/bench/bake-diffuse-gi.mjs --config src/wings/vinci/pictures/bench/gi-config.json --describe
node src/wings/vinci/pictures/bench/bake-diffuse-gi.mjs --config src/wings/vinci/pictures/bench/gi-config.json --out src/wings/vinci/pictures/bench/gi-data
node src/wings/vinci/pictures/bench/bake-diffuse-gi.mjs --config src/wings/vinci/pictures/bench/gi-config.json --out src/wings/vinci/pictures/bench/gi-data --verify
```

The config is a JSON object with a `segments` array. Each entry supplies `segment`, the exact hang `extent` in metres, `height` (default 4.4 m) and `depth` (default 12 m). Example:

```json
{"segments":[{"segment":"signature","extent":0.534,"height":4.4,"depth":12}]}
```

The forge calls `buildPictureRoom(stack, extent, {height,depth})` and independently checks the extracted wall/floor dimensions. A room builder that ignores custom dimensions produces an error. Supply actual per-segment extents from the hang builder; the example extent is a small benchmark fixture, not a substitute for a measured mounted hang.

Final per-segment outputs must be generated after room changes settle. `--verify` reconstructs the current room and rejects mismatched geometry, area-light, reflectance-model, sampling-recipe or room-source hashes. It also checks the exact wall domain and runtime data schema. Comparing a file to hashes copied from that same file would not establish that the current room still matches it.

## Runtime integration

```ts
const gi = createWallDiffuseGI(data, {
  segment,
  geometrySha256,
  lightSha256,
  materialSha256,
  recipeSha256,
  roomSourceSha256,
})
const unbind = gi.apply(plasterMaterial)
// Include gi.textureMB() once in this visit's cost; it is 0.0625 MiB.
// On departure: unbind(); gi.dispose(); room.dispose().
```

Expected hashes must come from independently validated current build metadata. The sampler also requires GENERATED provenance and every valid hash when the optional expected object is omitted, but that alone cannot detect a changed live room. Run the forge verification before committing/building an integrated bake. Geometry/light changes require regeneration. The helper owns only its texture and material binding; repeated cleanup is safe and does not dispose the wall's maps.

Each output needs its own app-local GENERATED manifest record, ID `vinci/pictures/diffuse-gi/<segment>`, with the output JSON's SHA-256, source recipe/model/date and the five input hashes. The CLI prints the output hash and byte count. Geometry provenance includes actual positions, reflectance, emission, material labels and vertex tone. The source file hashes separately identify the room, solver and forge code.

## Verification and scope

```sh
node src/wings/vinci/pictures/bench/diffuse-gi-check.mjs
node src/wings/vinci/pictures/bench/diffuse-gi-runtime-check.mjs
pnpm typecheck
```

Checks cover an analytic disk-emitter integral, an independent Three.Ray nearest-hit comparison, reflected floor colour, linear scaling with emitted radiance, black-material/no-emitter energy, geometric emitter occlusion, determinism, bounded input validation, stale-data rejection and resource cleanup. A 14 m room benchmark used 7,994 actual source triangles, 524,288 primary rays and 682,659 emitter-connection rays, completing in approximately 5.5 seconds on the local machine. Performance remains a measured local result, not a universal guarantee.

This field covers the back wall only, with one diffuse bounce and declared average reflectances. Fine material maps stay in the renderer. The transport scene is architectural geometry; the separately generated frame-contact bake handles the mounted frames' local visibility. The existing renderer's direct/key/probe lighting remains separate. The additional radiance is intentionally modest under the current generated pane emission. Do not amplify it while describing the result as a calibrated HDRI or lux measurement.
