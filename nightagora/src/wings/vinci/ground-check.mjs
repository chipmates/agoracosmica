#!/usr/bin/env node
/** THE GROUND'S OWN OFFLINE PROOF: no wall in this wing stands on air, and
 * the numbers the court's module declares about the envelope it may not
 * import are the envelope's own.
 *
 * Three things, none of which needs a browser: the pavilion's faces, apron
 * level and channel as `collection/rooms.ts` declares them are the ones
 * `collection.ts` builds; the plinth course at the pavilion's foot covers
 * the 40 mm the envelope stood clear of its apron on every elevation; and
 * every rendered facade of the shell has its lowest wall foot at or under
 * the terrain it stands on, counting the foundation plinth's own depth.
 *
 * It claims no rendered light, no residency and no frame cost.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import * as THREE from 'three/webgpu'
import * as TSL from 'three/tsl'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const source = relative => fs.readFileSync(path.join(root, relative), 'utf8')
const cache = new Map()
function load(relative) {
  if (cache.has(relative)) return cache.get(relative)
  const module = { exports: {} }
  cache.set(relative, module.exports)
  const compiled = ts.transpileModule(source(relative), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const require = specifier => {
    if (specifier === 'three/tsl') return TSL
    if (specifier === 'three' || specifier === 'three/webgpu') return THREE
    if (!specifier.startsWith('.')) throw new Error(`Unexpected import: ${specifier}`)
    const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(relative), specifier))
    if (resolved.endsWith('?raw')) return { default: source(resolved.slice(0, -4)) }
    const file = fs.existsSync(path.join(root, resolved + '.ts')) ? resolved + '.ts' : resolved + '/index.ts'
    return load(file)
  }
  vm.runInNewContext(compiled, { module, exports: module.exports, require, console, matchMedia: () => ({ matches: false }) },
    { filename: relative })
  return module.exports
}

const report = {}
const rooms = source('src/wings/vinci/collection/rooms.ts')
const declared = name => {
  const line = new RegExp(`const ${name} = (\\{[^}]*\\})`).exec(rooms)
  assert.ok(line, `${name} is not declared in collection/rooms.ts`)
  return JSON.parse(line[1].replace(/([a-z]+):/g, '"$1":').replace(/'/g, '"'))
}
const ENVELOPE = declared('ENVELOPE'), CHANNEL = declared('CHANNEL')
const { collectionLayout } = load('src/wings/vinci/collection.ts')

/* ---- 1. the declared envelope is the built envelope ---- */
const L = collectionLayout
for (const key of ['west', 'east', 'south', 'north'])
  assert.equal(ENVELOPE[key], L[key], `the declared ${key} face is not the envelope's`)
assert.equal(ENVELOPE.apron, L.apron.height, 'the declared apron level is not the apron\'s')
assert.equal(ENVELOPE.foot, L.floor, 'the declared foot is not the pavilion floor the base is cast to')
for (const key of Object.keys(CHANNEL))
  assert.equal(CHANNEL[key], L.channel[key], `the declared channel ${key} is not the channel's`)
report.envelope = { ...ENVELOPE, channel: CHANNEL }

/* ---- 2. the plinth course closes the foot on every elevation ---- */
// what the envelope leaves open: its base top stands at the pavilion floor,
// its apron is paved 40 mm under that, and the glazing sill oversails the
// base's face by 90 mm on the north and east elevations.
const OPEN = +(ENVELOPE.foot - ENVELOPE.apron).toFixed(3)
assert.ok(OPEN > 0, 'the envelope no longer stands clear of its apron: this check is stale')
const proud = /const E = ENVELOPE, PROUD = ([.\d]+), DEPTH = ([.\d]+)/.exec(rooms)
assert.ok(proud, 'the plinth course no longer declares its own proud and depth')
const PROUD = Number(proud[1]), DEPTH = Number(proud[2])
assert.ok(PROUD >= OPEN, `the plinth course stands ${PROUD} m proud and the foot is ${OPEN} m clear`)
assert.ok(DEPTH >= .09 + .04, `the plinth course is ${DEPTH} m deep and the sill oversails by 0.09 m`)
report.foot = { openBefore: OPEN, proud: PROUD, depth: DEPTH }

/* ---- 3. no wall of the shell stands on air ---- */
const { gradeAt } = load('src/wings/vinci/terrain-mesh.ts')
const raw = JSON.parse(source('src/wings/vinci/data/closluce.json'))
const value = x => (x && typeof x === 'object')
  ? ('value' in x ? value(x.value) : Array.isArray(x) ? x.map(value) : Object.fromEntries(Object.entries(x).map(([k, y]) => [k, value(y)])))
  : x
const spec = value(raw)
const { foundationPlinthFaces } = load('src/wings/vinci/foundation-plinth.ts')
const PLINTH_BOTTOM = foundationPlinthFaces('standard')
  .reduce((low, face) => Math.min(low, ...face.points.map(p => p[2])), Infinity)
assert.ok(Number.isFinite(PLINTH_BOTTOM), 'the foundation plinth builds no face')
const walls = spec.walls.filter(wall => wall.render)
const nearSegment = (p, a, b) => {
  const dx = b[0] - a[0], dn = b[1] - a[1], span = dx * dx + dn * dn
  if (span < 1e-9) return Math.hypot(p[0] - a[0], p[1] - a[1])
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dn) / span))
  return Math.hypot(p[0] - (a[0] + dx * t), p[1] - (a[1] + dn * t))
}
// F16 and F17 are the two facades whose foot is above the retained grade;
// the foundation plinth is the closure under them, and it is counted here.
const PLINTH_FACADES = new Set(['F16', 'F17'])
const air = []
for (const facade of spec.facades) {
  if (!facade.render) continue
  for (let i = 0; i <= 10; i++) {
    const t = i / 10
    const east = facade.from[0] + (facade.to[0] - facade.from[0]) * t
    const north = facade.from[1] + (facade.to[1] - facade.from[1]) * t
    const covering = walls.filter(wall => nearSegment([east, north], wall.from, wall.to) < .7)
    if (!covering.length) continue
    const foot = PLINTH_FACADES.has(facade.id) ? PLINTH_BOTTOM : Math.min(...covering.map(wall => wall.base_m))
    const grade = gradeAt(east, north)
    if (grade === undefined) continue
    if (foot - grade > .02) air.push({ facade: facade.id, east: +east.toFixed(2), north: +north.toFixed(2), air: +(foot - grade).toFixed(3) })
  }
}
assert.equal(air.length, 0, `a wall of the shell stands on air: ${JSON.stringify(air.slice(0, 4))}`)
report.shell = { facades: spec.facades.filter(f => f.render).length, plinthBottom: +PLINTH_BOTTOM.toFixed(3), onAir: 0 }

console.log(JSON.stringify(report, null, 1))
