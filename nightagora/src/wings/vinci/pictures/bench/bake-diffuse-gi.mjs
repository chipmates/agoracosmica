#!/usr/bin/env node
/** Offline wall GI forge command. No network, browser, GPU or binary output.
 *
 * node src/wings/vinci/pictures/bench/bake-diffuse-gi.mjs --segment signature --extent .534 --dry-run
 * node src/wings/vinci/pictures/bench/bake-diffuse-gi.mjs --config src/wings/vinci/pictures/bench/gi-config.json --out src/wings/vinci/pictures/bench/gi-data
 *
 * Config: {"segments":[{"segment":"signature","extent":0.534,"height":4.4,"depth":12}]}
 * --describe validates the live geometry and prints provenance without baking.
 * --verify checks existing output against CURRENT geometry/light/material/source
 * hashes, exact domain and the bounded runtime schema, without rebaking.
 * The renderer source is instantiated with material-loading doubles solely to
 * obtain its exact geometry. Transport uses declared mean linear reflectances;
 * albedo/normal texture pixels are never loaded or replaced by this bake.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname, relative, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import vm from 'node:vm'
import ts from 'typescript'
import * as Three from 'three/webgpu'
import * as TSL from 'three/tsl'

const here = fileURLToPath(import.meta.url)
const app = resolve(dirname(here), '../../../../..')
const sha256 = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex')
const fileHash = path => sha256(readFileSync(path, 'utf8'))
function inside(path) {
  const full = resolve(app, path), rel = relative(app, full)
  if (rel.startsWith('..') || isAbsolute(rel)) throw Error('GI forge paths must remain inside this app directory')
  return full
}

/** Values are explicit exhibition transport assumptions, not measured material
 * data. Hex values match room.ts's generated mean tint choices. The actual
 * per-vertex board tone multiplies this linear reflectance during extraction.
 * The renderer retains all three-scale maps/detail independently.
 */
export const DIFFUSE_GI_REFLECTANCE_MODEL = Object.freeze({
  'plaster': '#d6d0be',
  'oak-boards': '#a88a60',
  'limestone-reveals': '#c2b9a2',
  'graphite-plinth': '#414644',
  'window-timber': '#514639',
  'floor-joints': '#332b20',
  'north-glazing': '#000000',
})

const moduleCache = new Map()
const moduleSources = new Map()
export function loadLocalTS(path, append = '') {
  const full = inside(path), key = full + append
  const source = readFileSync(full, 'utf8')
  if (moduleCache.has(key) && moduleSources.get(key) === source) return moduleCache.get(key)
  const code = ts.transpileModule(source + append, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
  }, fileName: full }).outputText
  const exports = {}
  moduleCache.set(key, exports)
  moduleSources.set(key, source)
  vm.runInThisContext(`(function(exports, require) { ${code}\n })`, { filename: full })(exports, id => {
    if (id === 'three/webgpu' || id === 'three') return Three
    if (id === 'three/tsl') return TSL
    if (id.startsWith('.')) return loadLocalTS(resolve(dirname(full), id.endsWith('.ts') ? id : `${id}.ts`))
    throw Error(`Offline GI source requested unsupported import ${id}`)
  })
  return exports
}

function roomStack() {
  return { materials: { sync() {
    return { albedo: new Three.Color(1, 1, 1), material() {
      const m = new Three.MeshStandardNodeMaterial()
      m.colorNode = TSL.vec3(1); m.roughnessNode = TSL.float(.75)
      return m
    } }
  } }, detail() {} }
}
function normalizedConfig(value) {
  const config = { height: 4.4, depth: 12, ...value }
  if (!/^[a-z][a-z0-9-]*$/.test(config.segment ?? '') || ![config.extent, config.height, config.depth].every(Number.isFinite)
    || config.extent < 0 || config.height < 3.3 || config.depth < 3.1)
    throw Error('Expected segment ID, nonnegative extent, height >=3.3 m and depth >=3.1 m')
  return config
}

export function createRoomTransport(value) {
  const config = normalizedConfig(value)
  const roomPath = inside('src/wings/vinci/pictures/bench/room.ts')
  const { buildPictureRoom } = loadLocalTS(roomPath)
  const roomSourceSha256 = sha256(moduleSources.get(roomPath))
  // Current source may ignore options. Independent bounds validation below
  // rejects that mismatch instead of silently baking a different room.
  const room = buildPictureRoom(roomStack(), config.extent, { height: config.height, depth: config.depth })
  room.group.updateWorldMatrix(true, true)
  const inverse = room.group.matrixWorld.clone().invert(), matrix = new Three.Matrix4()
  const a = new Three.Vector3(), b = new Three.Vector3(), c = new Three.Vector3()
  const normal = new Three.Vector3(), edge = new Three.Vector3()
  const triangles = [], emitters = []
  const bounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity }
  let maxDepth = -Infinity
  try {
    room.group.traverse(object => {
      if (!(object instanceof Three.Mesh)) return
      if (object.isInstancedMesh || Array.isArray(object.material)) throw Error('GI extractor expects the room’s welded single-material batches')
      const name = object.material.name.split('/').at(-1)
      const hex = DIFFUSE_GI_REFLECTANCE_MODEL[name]
      if (!hex) throw Error(`No declared GI reflectance for room surface ${name}`)
      const colour = new Three.Color(hex), rho = [colour.r, colour.g, colour.b]
      const emitted = object.material.emissive
      const intensity = object.material.emissiveIntensity ?? 1
      const emission = emitted ? [emitted.r * intensity, emitted.g * intensity, emitted.b * intensity] : [0, 0, 0]
      const g = object.geometry, position = g.getAttribute('position'), tone = g.getAttribute('tone'), index = g.index
      if (!position) throw Error(`Missing room position attribute for ${name}`)
      matrix.multiplyMatrices(inverse, object.matrixWorld)
      const end = Math.min(index?.count ?? position.count, g.drawRange.start + g.drawRange.count)
      for (let i = g.drawRange.start; i + 2 < end; i += 3) {
        const ids = [0, 1, 2].map(k => index ? index.getX(i + k) : i + k)
        a.fromBufferAttribute(position, ids[0]).applyMatrix4(matrix)
        b.fromBufferAttribute(position, ids[1]).applyMatrix4(matrix)
        c.fromBufferAttribute(position, ids[2]).applyMatrix4(matrix)
        normal.subVectors(b, a).cross(edge.subVectors(c, a)).normalize()
        const scale = tone ? ids.reduce((sum, at) => sum + tone.getX(at), 0) / 3 : 1
        const triangle = { a: a.toArray(), b: b.toArray(), c: c.toArray(),
          reflectance: rho.map(v => v * scale), emission: [...emission], label: name }
        triangles.push(triangle)
        if (emission.some(v => v > 0)) emitters.push(triangle)
        if (name === 'plaster' && normal.z > .99999 && [a.z, b.z, c.z].every(z => Math.abs(z) < 1e-7)) {
          bounds.minX = Math.min(bounds.minX, a.x, b.x, c.x); bounds.maxX = Math.max(bounds.maxX, a.x, b.x, c.x)
          bounds.minY = Math.min(bounds.minY, a.y, b.y, c.y); bounds.maxY = Math.max(bounds.maxY, a.y, b.y, c.y)
        }
        maxDepth = Math.max(maxDepth, a.z, b.z, c.z)
      }
    })
    const expected = { minX: -1.2, maxX: Math.max(2.8, config.extent + 1.2), minY: 0, maxY: config.height }
    for (const key of Object.keys(expected)) if (Math.abs(bounds[key] - expected[key]) > 1e-5)
      throw Error(`Room geometry/config mismatch: ${key}=${bounds[key]}, expected ${expected[key]}. Reconcile room options before baking.`)
    if (Math.abs(maxDepth - config.depth) > 1e-5) throw Error(`Room geometry/config mismatch: depth=${maxDepth}, expected ${config.depth}`)
    if (emitters.length !== 2 || emitters.some(e => e.label !== 'north-glazing'))
      throw Error('The declared light model requires the actual two north-glazing triangles')
    const source = loadLocalTS('src/wings/vinci/pictures/bench/diffuse-gi-bake.ts')
    const coreSourceSha256 = sha256(moduleSources.get(inside('src/wings/vinci/pictures/bench/diffuse-gi-bake.ts')))
    const light = { type: 'Generated one-sided frosted north-window area emission',
      units: 'Relative linear radiance, not calibrated lux and not a measured HDRI bake',
      source: 'Actual room north-glazing material emissive colour times emissiveIntensity',
      triangles: emitters.map(e => ({ a: e.a, b: e.b, c: e.c, emission: e.emission })) }
    const material = { description: 'Declared mean linear diffuse reflectance from exhibition tint, multiplied by actual vertex tone; no material texture samples',
      srgbTints: DIFFUSE_GI_REFLECTANCE_MODEL }
    const recipe = { ...source.DIFFUSE_GI_RECIPE, coreSourceSha256,
      storedDecimalSignificantDigits: 9, textureEncoding: 'RGBA16F, RGB indirect irradiance, A=1, no mipmaps' }
    const provenance = {
      class: 'GENERATED', model: 'Deterministic CPU diffuse transport, one reflected bounce',
      geometrySha256: sha256(triangles), lightSha256: sha256(light), materialSha256: sha256(material),
      recipeSha256: sha256(recipe), roomSourceSha256, coreSourceSha256,
      forgeSourceSha256: fileHash(here), roomOptions: config, roomMetadata: room.group.userData.room,
      geometrySource: 'Actual src/wings/vinci/pictures/bench/room.ts indexed/nonindexed triangles with local transforms',
      light, material, recipe,
      limitations: ['Indirect diffuse transport to the back wall only; one bounce.',
        'No specular transport or measured HDRI integration; escaped rays have zero radiance in this window model.',
        'The renderer retains its own direct/key/probe light; the texture contains no direct-emitter term.',
        'Mean diffuse reflectances approximate patterned materials; their three-scale detail remains in the runtime shader.',
        'No claim that the shared stack.gi() stub is functional.'],
    }
    return { config, triangles, bounds, provenance }
  } finally { room.dispose() }
}

export function bakeRoom(config) {
  const scene = createRoomTransport(config)
  const { bakeWallDiffuseGI } = loadLocalTS('src/wings/vinci/pictures/bench/diffuse-gi-bake.ts')
  const result = bakeWallDiffuseGI(scene)
  return { schema: 'vinci-wall-diffuse-gi-v1', segment: scene.config.segment,
    ...result, irradiance: result.irradiance.map(v => Number(v.toPrecision(9))),
    provenance: { ...scene.provenance, generatedAt: new Date().toISOString() } }
}

/** Build-time stale-data guard. Expected hashes are derived afresh from the
 * actual room source and geometry; comparing a JSON file to its own hashes
 * would not detect a changed room or light model. */
export function verifyRoomBake(config, data) {
  const scene = createRoomTransport(config)
  const expected = { segment: scene.config.segment }
  for (const key of ['geometrySha256', 'lightSha256', 'materialSha256', 'recipeSha256', 'roomSourceSha256'])
    expected[key] = scene.provenance[key]
  if (data.width !== 128 || data.height !== 64) throw Error('Stale wall GI texture dimensions')
  for (const key of Object.keys(scene.bounds)) if (data.bounds?.[key] !== scene.bounds[key])
    throw Error(`Stale wall GI domain ${key}`)
  const { createWallDiffuseGI } = loadLocalTS('src/wings/vinci/pictures/bench/diffuse-gi-runtime.ts')
  const checked = createWallDiffuseGI(data, expected)
  checked.dispose()
  return expected
}

function main() {
  const args = process.argv.slice(2), values = {}
  for (let i = 0; i < args.length; i++) {
    const key = args[i]
    if (['--dry-run', '--describe', '--verify'].includes(key)) values[key.slice(2)] = true
    else if (['--config', '--out', '--segment', '--extent', '--height', '--depth'].includes(key)) {
      if (!args[i + 1]) throw Error(`Missing ${key} value`)
      values[key.slice(2)] = args[++i]
    } else throw Error(`Unknown GI forge option ${key}`)
  }
  let configs
  if (values.config) {
    const data = JSON.parse(readFileSync(inside(values.config), 'utf8'))
    configs = Array.isArray(data) ? data : data.segments
    if (!Array.isArray(configs) || !configs.length) throw Error('GI config must contain a nonempty segments array')
  } else configs = [{ segment: values.segment ?? 'signature', extent: Number(values.extent ?? .534),
    height: Number(values.height ?? 4.4), depth: Number(values.depth ?? 12) }]
  const seen = new Set()
  for (const config of configs) {
    if (seen.has(config.segment)) throw Error(`Duplicate GI segment ${config.segment}`)
    seen.add(config.segment)
    if (values.verify) {
      const directory = inside(values.out ?? 'src/wings/vinci/pictures/bench/gi-data')
      const path = resolve(directory, `${normalizedConfig(config).segment}.json`)
      const data = JSON.parse(readFileSync(path, 'utf8'))
      const expected = verifyRoomBake(config, data)
      console.log(JSON.stringify({ verified: relative(app, path), expected }, null, 2))
      continue
    }
    if (values.describe) {
      const scene = createRoomTransport(config)
      console.log(JSON.stringify({ segment: config.segment, bounds: scene.bounds, triangles: scene.triangles.length, provenance: scene.provenance }, null, 2))
      continue
    }
    const data = bakeRoom(config)
    const summary = { segment: data.segment, dimensions: [data.width, data.height], textureMiB: data.width * data.height * 8 / 1048576,
      bounds: data.bounds, stats: data.stats, provenance: data.provenance }
    if (!values['dry-run']) {
      const directory = inside(values.out ?? 'src/wings/vinci/pictures/bench/gi-data')
      mkdirSync(directory, { recursive: true })
      const path = resolve(directory, `${data.segment}.json`)
      const text = JSON.stringify(data) + '\n'
      writeFileSync(path, text)
      summary.output = relative(app, path); summary.sha256 = sha256(text); summary.bytes = Buffer.byteLength(text)
    }
    console.log(JSON.stringify(summary, null, 2))
  }
}
if (process.argv[1] && resolve(process.argv[1]) === here) {
  try { main() } catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 1 }
}
