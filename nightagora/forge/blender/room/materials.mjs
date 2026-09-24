// THE MATERIALS, TRANSLATED. The museum's surfaces are TSL graphs written in
// code; glTF carries a photograph, a UV and a few factors. Each family the
// room holds is recognised here (by its name and by the constant colour its
// colour graph multiplies by, read off the live graph) and translated to the
// set's own photographs, the UV the engine samples them at and the factors its
// graph applies per texel. Everything a graph does that a texel cannot carry is
// named in `lost`, so the frame beside the engine's can be read honestly.
//
// The numbers are the source's own, copied with the files they come from; the
// export records those files' hashes, and a changed file is reported.
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export const SOURCES = [
  'src/wings/vinci/collection/hall-fabric.ts',
  'src/wings/vinci/collection/hall-floor.ts',
  'src/wings/vinci/collection/hall-light.ts',
  'src/wings/vinci/collection/hall-air.ts',
  'src/wings/vinci/collection/hall-cloth.ts',
  'src/wings/vinci/collection/exhibits.ts',
  'src/wings/vinci/collection/materials.ts',
  'src/wings/vinci/collection.ts',
  'src/wings/vinci/machines/parts.ts',
  'src/stack/materials.ts',
  'src/stack/detail.ts',
  'src/stack/post.ts',
  'src/wings/vinci/index.ts',
]

export const sourceHashes = (appRoot) =>
  Object.fromEntries(SOURCES.map((f) => [f, createHash('sha256').update(readFileSync(join(appRoot, f))).digest('hex')]))

/** sRGB hex to linear, as three's Color does */
export function lin(hex) {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const v = c / 255
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })
}
const near = (a, b, tol = 2e-3) => a && b && a.length >= 3 && Math.abs(a[0] - b[0]) < tol && Math.abs(a[1] - b[1]) < tol && Math.abs(a[2] - b[2]) < tol

/** THE HALL'S FABRIC (hall-fabric.ts): each look, as the file states it. */
export const FABRIC_LOOKS = {
  walls: { set: 'concrete-wall-formed', metres: 2.71, tint: [0.92, 0.97, 1.25], rough: [0.62, 0.95], normal: 1, cell: 0, drift: 0.06, bays: false },
  overhead: { set: 'concrete-wall-formed', metres: 2.71, tint: [0.84, 0.88, 1.1], rough: [0.7, 0.98], normal: 0.8, cell: 0, drift: 0.05, shelf: 0.36, bays: false },
  plinths: { set: 'concrete-floor-polished', metres: 1.5, tint: [0.36, 0.35, 0.34], rough: [0.32, 0.62], normal: 0.5, cell: 0, drift: 0.04, bays: false },
  slats: { set: 'oak-veneer-light', metres: 1.83, tint: [0.5, 0.45, 0.4], rough: [0.45, 0.75], normal: 0.7, cell: 0, drift: 0.08, shelf: 0.34, turn: true, bays: false },
  backing: { set: 'concrete-wall-formed', metres: 2.71, tint: [0.1, 0.095, 0.09], rough: [0.85, 1], normal: 0.3, cell: 0, drift: 0.02, bays: false },
}
/** the floor's bays and saw cuts (hall-fabric.ts BAY, layout.ts COLLECTION_PAVING_ORIGIN) */
export const FLOOR_BAYS = { east: 3.2, north: 3.3, originEast: -30.4, originNorth: -59, faceShift: 23.7, cut: 0.003, cutDark: 0.55, cutRough: 0.3 }

/** THE MACHINES (parts.ts makeSurface): what each variant's colour graph is,
 * recognised by the tint it multiplies by. `lum` = tint x (lum(photo/mean) x a
 * + b) x occlusion; `photo` = the set's mean x photo/mean x occlusion, which is
 * the photograph itself; `ratio` = tint x photo/mean, no occlusion. */
export const MACHINE_VARIANTS = [
  { id: 'quiet-wood', hex: '#847967', base: { mode: 'lum', a: 0.8, b: 0.2 }, normalStrength: 0.12, maps: 0.85 },
  { id: 'quiet-bank', hex: '#86755f', base: { mode: 'lum', a: 0.55, b: 0.45 }, normalStrength: 0.18 },
  { id: 'iron', hex: '#787e80', base: { mode: 'lum', a: 0.6, b: 0.34 }, metal: 0.45, rough: { mode: 'clamp', mul: 0.8, lo: 0.38, hi: 0.7 } },
  { id: 'gun-iron', hex: '#5d6265', base: { mode: 'lum', a: 0.6, b: 0.45 }, metal: 0.42, rough: { mode: 'clamp', mul: 0.85, lo: 0.38, hi: 0.68 } },
  { id: 'obscura-iron', hex: '#43474a', base: { mode: 'lum', a: 0.5, b: 0.5 }, metal: 0.5, rough: { mode: 'clamp', mul: 1, lo: 0.44, hi: 0.74 } },
  { id: 'bronze', hex: '#7e6540', base: { mode: 'lum', a: 0.62, b: 0.5 }, metal: 0.62, rough: { mode: 'clamp', mul: 0.6, lo: 0.17, hi: 0.42 }, normalStrength: 0.22 },
  { id: 'stone', hex: '#7c7669', base: { mode: 'lum', a: 1.05, b: 0.02 }, rough: { mode: 'clamp', mul: 1, lo: 0.62, hi: 0.95 } },
  { id: 'hide', hex: '#5c4331', base: { mode: 'lum', a: 0.8, b: 0.3 }, rough: { mode: 'clamp', mul: 1, lo: 0.58, hi: 0.92 }, normalStrength: 0.55 },
  { id: 'flax', hex: '#c4b89c', base: { mode: 'lum', a: 1, b: 0 }, normalStrength: 0.3, cloth: true },
  { id: 'hemp-lathe', hex: '#c5ae80', base: { mode: 'lum', a: 0.45, b: 0.55 }, rough: { mode: 'const', value: 0.86 }, normalStrength: 0 },
  { id: 'hemp-crane', hex: '#ad9367', base: { mode: 'lum', a: 0.45, b: 0.55 }, rough: { mode: 'const', value: 0.86 }, normalStrength: 0 },
  { id: 'paper', lin: [0.69, 0.65, 0.55], base: { mode: 'ratio' } },
]
/** parts.ts's rules for new work, pitch and forged iron, applied by the
 * part's material name: recognised by that name and by the tint the colour
 * graph multiplies by. `pitch` = tint x clamp(lum(photo/mean) / lum(mean) x
 * spread + 1 - spread, .5, 1.4) x occlusion; `new-oak` = tint x ((mix(lum,
 * photo/mean, .35) - 1) x k + 1) x occlusion x the vertex colour. */
const NAMED_VARIANTS = [
  { id: 'pitched-bedding', test: /:pitched bedding:/, hex: '#1d1713', base: { mode: 'pitch', spread: 0.08 }, rough: { mode: 'affine', mul: 0.3, add: 0.5, lo: 0.52, hi: 0.72 }, normalStrength: 0 },
  { id: 'pitched-lining', test: /:pitched lining:/, hex: '#33271e', base: { mode: 'pitch', spread: 0.08 }, rough: { mode: 'affine', mul: 0.3, add: 0.5, lo: 0.52, hi: 0.72 }, normalStrength: 0 },
  { id: 'pitched-hide', test: /:[^:]*pitched[^:]*:/, hex: '#3d2e23', base: { mode: 'pitch', spread: 0.3 }, rough: { mode: 'clamp', mul: 0.75, lo: 0.46, hi: 0.66 }, normalStrength: 0.1 },
  { id: 'oak-grip', test: /oak grip/, hex: '#5f4a37', base: { mode: 'new-oak', k: 0.62 }, rough: { mode: 'clamp', mul: 0.8, lo: 0.32, hi: 0.6 }, vertexTone: true },
  { id: 'turned-oak', test: /turned oak/, hex: '#82715d', base: { mode: 'new-oak', k: 0.9 }, rough: { mode: 'clamp', mul: 1, lo: 0.5, hi: 0.85 }, vertexTone: true },
  { id: 'planed-oak', test: /planed oak|oak peg/, hex: '#897a66', base: { mode: 'new-oak', k: 0.62 }, rough: { mode: 'clamp', mul: 1, lo: 0.5, hi: 0.85 }, vertexTone: true },
  { id: 'forged-iron', test: /iron, forged/, hex: '#3f3a35', base: { mode: 'lum', a: 0.25, b: 0.8 }, rough: { mode: 'clamp', mul: 0.9, lo: 0.5, hi: 0.82 }, normalStrength: 0.3 },
]
/** per-slug surface rules parts.ts applies by name, not by tint */
const SLUG_RULES = [
  { test: /^camera-obscura:.*:oak-beams$/, rough: { mode: 'clamp', mul: 1, lo: 0.66, hi: 0.96 } },
  { test: /^flywheel:.*:limestone-pale$/, normalStrength: 0.62 },
]

/** each library set's own normal strength (stack/materials.ts RECIPES) */
function recipeNormalStrengths(appRoot) {
  const src = readFileSync(join(appRoot, 'src/stack/materials.ts'), 'utf8')
  const start = src.indexOf('const RECIPES')
  const body = src.slice(start, src.indexOf('\n}\n', start))
  const out = {}
  const re = /\n\s{2}'?([a-z-]+)'?: \{([\s\S]*?)\n?\s*\},?(?=\n\s{2}'?[a-z-]+'?: \{|\s*$)/g
  for (const m of body.matchAll(re)) {
    const k = /normalStrength:\s*([\d.]+)/.exec(m[2])
    if (k) out[m[1]] = Number(k[1])
  }
  const def = /DEFAULT_RECIPE[\s\S]*?normalStrength:\s*([\d.]+)/.exec(src)
  out.__default = def ? Number(def[1]) : 0.45
  return out
}

/** THE ROOMS' CONSTRUCTION (collection/materials.ts): its colour per role,
 * the hall's own stones inside the hall, its roughness per role. */
export const ROOM_ROLES = {
  palette: { floor: '#9d9a8e', plaster: '#b7b2a4', dark: '#3c423d', steel: '#333b3c', ceiling: '#b0ab9e', paving: '#a6a393' },
  hall: { floor: '#625a4f', plaster: '#9a9386', ceiling: '#958f83', bay: '#56514a', floorRough: 0.44 },
  // role index -> name, roughness, metalness (the graph's own constants at rest)
  roles: [['floor', 0.62, 0.02], ['plaster', 0.88, 0.02], ['dark', 0.88, 0.02], ['steel', 0.42, 0.72], ['ceiling', 0.88, 0.02], ['paving', 0.88, 0.02]],
  hallBox: { minX: -61.8, maxX: -38.9, minZ: 41.92, maxZ: 63.8 },
  bayBox: { minX: -47.55, maxX: -43.65, minZ: 51.35, maxZ: 54.45 },
}
/** the envelope's architecture and concrete (collection.ts) */
export const ENVELOPE = {
  architecture: { rough: 0.87, steelRough: 0.47, steelMetal: 0.65 },
  concrete: { colour: '#a7a295', rough: 0.88 },
  glazing: { colour: '#a5b2ae', rough: 0.17, metal: 0.12, opacity: 0.1, grazing: 0.34 },
}

/**
 * Every scanned material, translated. `store` is the library manifest's
 * records by set name; MAPS `engine` lays the maps the engine really sampled,
 * `full` every map the store holds; `floor` is the hall floor's finish as its
 * source states it (hall-fabric.ts FLOOR_FINISH, hall-floor.ts's map, tile and
 * bays), read by the export. Returns recipes by material uuid.
 */
export function translateMaterials(scan, store, appRoot, MAPS = 'engine', floor = null) {
  const strengths = recipeNormalStrengths(appRoot)
  const recipes = {}
  const setInfo = (name) => {
    const e = store[name]
    if (!e) throw new Error(`the library has no set ${name}`)
    return {
      set: name,
      metres: e.scale_m ?? e.metres ?? [1, 1],
      turn: ((e.orientation ?? 0) * Math.PI) / 180,
      // the set's lean (stack/materials.ts): its tint normalised to its own
      // luminance, at the manifest's strength; it cancels out of every ratio
      tint: e.tint ? (() => {
        const t = lin(e.tint), k = 1 / Math.max(1e-4, 0.2126 * t[0] + 0.7152 * t[1] + 0.0722 * t[2]), w = e.tintStrength ?? 1
        return t.map((v) => 1 + (v * k - 1) * w)
      })() : [1, 1, 1],
      tintHex: e.tint ?? null,
      mean: e.measured?.albedo ? lin(e.measured.albedo) : null,
      roughFloor: e.roughness_floor ?? 0,
      greenFlip: e.normal_y === 'flip',
      normalStrength: strengths[name] ?? strengths.__default,
    }
  }
  /** which of the set's maps the engine really sampled: a set loaded under
   * the tier's albedo-only budget draws its normal and surface from the
   * one-texel placeholders (flat, roughness 128/255, no occlusion) */
  const loadedMaps = (graph, setName) => {
    const names = Object.values(graph ?? {}).flatMap((g) => g.textures ?? [])
    const real = (map) => names.some((n) => n.startsWith(`${setName}/${map}`) && !/placeholder/.test(n))
    return { albedo: real('albedo'), normal: real('normal'), surface: real('surface') }
  }
  const PLACEHOLDER_ROUGH = 128 / 255
  const roughAt = (rule, r0) => rule.mode === 'const' ? rule.value
    : rule.mode === 'remap' ? rule.lo + (rule.hi - rule.lo) * r0
      : rule.mode === 'clamp' ? Math.min(rule.hi, Math.max(rule.lo, r0 * rule.mul))
        : rule.mode === 'affine' ? Math.min(rule.hi, Math.max(rule.lo, r0 * rule.mul + rule.add)) : r0
  const firstColour = (graph) => {
    for (const c of graph?.colorNode?.consts ?? []) if (Array.isArray(c) && (c[0] === 'v3' || c[0] === 'c')) return c.slice(1)
    return null
  }
  for (const m of Object.values(scan.materials)) {
    const graph = scan.graphs?.[m.uuid]
    const name = m.name || ''
    const r = { uuid: m.uuid, name, doubleSided: m.side === 2, translated: [], lost: [] }
    const fabric = /^vinci\/collection-hall-fabric\/(.+)$/.exec(name)
    const machine = /^([a-z-]+):([^:]+):([a-z-]+)(:thin)?$/.exec(name)
    if (fabric && fabric[1] === 'floor') {
      if (!floor) throw new Error('the hall floor is in the room but its finish was not read')
      const s = setInfo(floor.set)
      const F = floor.finish
      Object.assign(r, {
        family: 'fabric', kind: 'pbr', set: s,
        uv: { mode: 'world-floor-bays', metres: [F.metres, F.metres], turn: s.turn, swap: false },
        base: { mode: 'photo-soft', k: F.photo, tint: F.tint.map((v, i) => v * s.tint[i]), ao: false },
        rough: { mode: 'floor' }, metal: 0, normalScale: F.normal,
        tone: { cell: 0, drift: 0, bays: { ...FLOOR_BAYS, east: floor.bay.east, north: floor.bay.north, originEast: floor.bay.originEast, originNorth: floor.bay.originNorth } },
        coat: { weight: F.reflection, roughness: .2, ior: 1.5, perTexel: true },
        floor: { finish: F, bay: floor.bay, map: floor.map, tile: floor.tile, files: null },
      })
      r.translated.push('the photograph at the engine\'s own world projection and tile, each bay its own read of it; the finish\'s tint and normal strength')
      r.translated.push('the baked finish map over the hall (the pour\'s tone, the sealer\'s roughness with its trowel arcs and wear, the dust and the silt in the cuts) and the baked tile (the cut aggregate, heel scuffs, hairline scratches), each read at the engine\'s own world projection; the saw cuts, their chipped arrises and their silt as world-position lines, combined as the floor\'s graph combines them')
      r.lost.push('the planar reflection (a blurred mirror pass added as emission, capped at 1.2, held back by dust and the cuts): replaced by a clear coat at the finish\'s reflection weight, the same hold, and the floor\'s own roughness, so Cycles reflects the room for real')
      r.lost.push('the finish map\'s contact channel and the clerestory past its shelf (engine stand-ins for occlusion): Cycles occludes for real')
      r.lost.push('the tile\'s per-bay quarter turn and shift use Blender\'s own random per bay, so a bay reads another part of the same tile')
    } else if (fabric) {
      const look = FABRIC_LOOKS[fabric[1]]
      if (!look) throw new Error(`no look for ${name}`)
      const s = setInfo(look.set)
      Object.assign(r, {
        family: 'fabric', kind: 'pbr', set: s,
        uv: { mode: look.bays ? 'world-floor-bays' : 'world-face', metres: [look.metres, look.metres], turn: s.turn, swap: Boolean(look.turn) },
        base: { mode: 'photo', tint: look.tint.map((v, i) => v * s.tint[i]), ao: false },
        rough: { mode: 'remap', lo: look.rough[0], hi: look.rough[1] },
        metal: 0, normalScale: look.normal,
        tone: { cell: look.cell, drift: look.drift, bays: look.bays ? FLOOR_BAYS : null },
      })
      r.translated.push('the photograph at the engine\'s own world projection and tile, the look\'s tint and roughness range, its normal strength')
      if (look.bays) r.translated.push('each bay read from its own part of the photograph and toned by its own hash (vertex colour); the saw cuts as world-position lines in Cycles')
      r.translated.push('the metre-scale drift as a Cycles noise over world position (a different noise function from MaterialX\'s)')
      if (look.shelf) r.lost.push('the light shelf\'s glow (an emissive stand-in for bounce): dropped, Cycles bounces the clerestory off the shelf itself')
      if (fabric[1] === 'floor') {
        r.coat = { weight: 0.7, roughness: 0.2, ior: 1.5 }
        r.lost.push('the planar reflection (a blurred mirror pass added as emission, capped at 1.2): replaced by a clear coat, weight 0.7 at the engine\'s Fresnel, roughness 0.2, so Cycles reflects the room for real')
      }
      r.lost.push('the occlusion map on the ambient term: Cycles occludes for real')
    } else if (machine) {
      const [, slug, cls, setName, thin] = machine
      const s = setInfo(setName)
      const tint = firstColour(graph)
      let variant = null
      for (const v of MACHINE_VARIANTS) {
        const want = v.lin ?? lin(v.hex)
        if (near(tint, want)) { variant = v; break }
      }
      if (!variant) variant = NAMED_VARIANTS.find((v) => v.test.test(name) && near(tint, lin(v.hex))) ?? null
      const isDefault = !variant && s.mean && near(tint, s.mean)
      const attrs = graph?.colorNode?.attributes ?? []
      const turned = attrs.includes('position') && !attrs.includes('uv')
      const geared = variant?.id === 'quiet-wood' && attrs.includes('normal') && !turned && slug === 'rolling-mill'
      const rule = SLUG_RULES.find((x) => x.test.test(name))
      // a machine's colour graph multiplies the set's occlusion into its albedo
      const base = variant
        ? { ...variant.base, tint: variant.lin ?? lin(variant.hex), ao: variant.base.mode !== 'ratio' }
        : { mode: 'photo', tint: s.tint, ao: true }
      const rough = variant?.rough ?? rule?.rough ?? { mode: 'photo', floor: s.roughFloor }
      const strength = rule?.normalStrength ?? variant?.normalStrength ?? s.normalStrength
      const maps = variant?.maps ?? 1
      Object.assign(r, {
        family: 'machine', slug, cls, kind: 'pbr', set: s, variant: variant?.id ?? (isDefault ? 'photo' : 'unrecognised'),
        uv: turned ? { mode: 'box', metres: s.metres, turn: s.turn } : { mode: 'attribute', metres: s.metres, turn: setName === 'oak-beams' ? 0 : s.turn },
        base, rough, metal: m.metalness ?? 0, normalScale: 2 * strength * maps,
        ...(variant?.vertexTone ? { vertexTone: true } : {}),
      })
      if (variant?.vertexTone) r.translated.push('the piece\'s own tone and its darker end grain, which ride in the vertex colour, multiplied in as the engine does')
      const loaded = loadedMaps(graph, setName)
      r.engineMaps = loaded
      if (MAPS === 'engine' && !loaded.surface) {
        r.base = { ...r.base, ao: false }
        r.rough = { mode: 'const', value: roughAt(r.rough, Math.max(PLACEHOLDER_ROUGH, s.roughFloor ?? 0)) }
        r.translated.push(`the engine draws ${setName} without its surface map (the tier's albedo-only budget): roughness ${r.rough.value.toFixed(3)} from the placeholder texel and no occlusion, and so does Cycles`)
      }
      if (MAPS === 'engine' && !loaded.normal) {
        r.normalScale = 0
        r.translated.push(`the engine draws ${setName} without its normal map: flat, and so does Cycles`)
      }
      if (!variant && !isDefault) r.lost.push(`colour graph not recognised (first constant ${JSON.stringify(tint)}): laid as the photograph`)
      r.translated.push(`the ${setName} photograph at the part's own metre UV and the set's ${s.metres[0]} m tile; the ${r.variant} colour rule per texel; roughness ${rough.mode}; normal x${r.normalScale.toFixed(2)}`)
      if (turned) r.translated.push('the turned part\'s three-plane projection as Cycles box projection in the part\'s own space')
      if (geared) r.lost.push('the worn flanks of the gear teeth (a darker, smoother band on faces along the axle)')
      r.lost.push('the three procedural scales (macro value and hue, mid relief, micro roughness), the second de-tiling read and the grain field over the photograph')
      if (thin || variant?.cloth) {
        r.cloth = { through: [1.0, 0.93, 0.8], weight: 0.35 }
        r.translated.push('the thin cloth (three\'s thickness terms: distortion .35, power 1.2, scale 7, attenuation .7) as a translucent layer, weight .35, in the cloth\'s own colour warmed by (1, .93, .8)')
      }
    } else if (/^vinci\/collection-hall-light\/fixtures$/.test(name)) {
      Object.assign(r, { family: 'fixture', kind: 'pbr', base: { mode: 'flat', tint: m.color }, rough: { mode: 'const', value: m.roughness }, metal: m.metalness, normalScale: 0 })
      r.translated.push('anodised black: colour, roughness and metalness as authored')
      r.hideFromShadow = true
      r.translated.push('casts no shadow, as in the engine: the lamp bodies stay out of their own beams')
    } else if (/^vinci\/collection-hall-light\/lamp-faces$/.test(name)) {
      Object.assign(r, { family: 'lamp', kind: 'emission', emission: { colour: m.color, strength: 1 } })
      r.hideFromShadow = true
      r.translated.push('an unlit face (colour x 9 in the engine) as an emitter of the same radiance')
    } else if (name === 'vinci/collection-rooms/surfaces') {
      Object.assign(r, { family: 'construction', kind: 'pbr', base: { mode: 'vertex' }, rough: { mode: 'role' }, metal: 0, normalScale: 0, split: 'collectionRoomRole' })
      r.translated.push('each role\'s colour (the hall\'s own stones inside the hall, the dark bay\'s own) as vertex colour, each role its own roughness and metalness')
      r.lost.push('the rooms\' procedural finish (joints, board lines, drift, wear) and their per-opening daylight term and fitting wash (engine stand-ins for bounce)')
    } else if (name === 'vinci/collection/three-scale-architecture') {
      Object.assign(r, { family: 'construction', kind: 'pbr', base: { mode: 'vertex' }, rough: { mode: 'const', value: ENVELOPE.architecture.rough }, metal: 0, normalScale: 0, split: 'collectionRole' })
      r.translated.push('the envelope\'s own vertex colour; roughness .87')
      r.lost.push('the envelope\'s procedural drift, board cast and joints')
    } else if (name === 'vinci/collection/filtered-cast-concrete') {
      Object.assign(r, { family: 'construction', kind: 'pbr', base: { mode: 'flat', tint: lin(ENVELOPE.concrete.colour) }, rough: { mode: 'const', value: ENVELOPE.concrete.rough }, metal: 0, normalScale: 0 })
      r.translated.push('cast concrete #a7a295, roughness .88')
      r.lost.push('the concrete\'s procedural panels, board lines, ties and pores; its soffit bounce term')
    } else if (name === 'vinci/collection/full-height-glazing') {
      const g = ENVELOPE.glazing
      Object.assign(r, { family: 'glazing', kind: 'thin-glass', base: { mode: 'flat', tint: lin(g.colour) }, rough: { mode: 'const', value: g.rough }, metal: g.metal, opacity: g.opacity, grazing: g.grazing, normalScale: 0 })
      r.translated.push('thin glass: the engine\'s opacity .10 rising to .44 at grazing (Schlick) as a mix of a clear pass-through and the glass\'s reflection')
    } else {
      Object.assign(r, { family: 'other', kind: 'pbr', base: { mode: 'flat', tint: m.color ?? [0.5, 0.5, 0.5] }, rough: { mode: 'const', value: m.roughness ?? 0.8 }, metal: m.metalness ?? 0, normalScale: 0 })
      r.lost.push('not recognised: laid flat in its authored colour')
    }
    recipes[m.uuid] = r
  }
  return recipes
}
