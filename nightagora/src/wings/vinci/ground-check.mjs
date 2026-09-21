#!/usr/bin/env node
/** THE GROUND'S OWN OFFLINE PROOF: no wall in this wing stands on air, and
 * the numbers the court's module declares about the envelope it may not
 * import are the envelope's own.
 *
 * Three things, none of which needs a browser: the pavilion's faces and
 * apron level as `collection/rooms.ts` declares them are the ones
 * `collection.ts` builds, and nothing is cut into that apron; the plinth
 * course at the pavilion's foot covers the 40 mm the envelope stood clear of
 * its apron on every elevation; and every rendered facade of the shell has
 * its lowest wall foot at or under the terrain it stands on, counting the
 * foundation plinth's own depth.
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
const ENVELOPE = declared('ENVELOPE')
const { collectionLayout, getCollectionGradeRegions } = load('src/wings/vinci/collection.ts')

/* ---- 1. the declared envelope is the built envelope, and the apron is whole ---- */
const L = collectionLayout
for (const key of ['west', 'east', 'south', 'north'])
  assert.equal(ENVELOPE[key], L[key], `the declared ${key} face is not the envelope's`)
assert.equal(ENVELOPE.apron, L.apron.height, 'the declared apron level is not the apron\'s')
assert.equal(ENVELOPE.foot, L.floor, 'the declared foot is not the pavilion floor the base is cast to')
// The ornamental channel is gone: the apron carries no void, so neither the
// layout nor the grade regions may name one again.
assert.equal(L.channel, undefined, 'the layout declares a water channel again')
const regionIds = getCollectionGradeRegions().map(region => region.id)
assert.ok(!regionIds.some(id => id.includes('water')), `a water region is graded again: ${regionIds.filter(id => id.includes('water')).join(', ')}`)
assert.ok(!rooms.includes('CHANNEL'), 'the rooms module declares a channel again')
report.envelope = { ...ENVELOPE, gradeRegions: regionIds.length, waterRegions: 0 }

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

/* ---- 4. no terrain is visible inside the court's walls ---- */
// The court's walls are its own parapet and the gallery the grave brings
// with it. The gallery is another module's, mounted by a third, so its four
// lines are read off their own sources and proved against the numbers the
// court declares; then every square of ground those walls enclose has to be
// made ground, laid at one level over terrain that lies below it.
const { COURT, GRAVE_ORIGIN } = load('src/wings/vinci/collection/layout.ts')
const { COURT_GROUND, GALLERY } = load('src/wings/vinci/collection/rooms.ts')
const construction = source('src/wings/vinci/myths/construction.ts')
const signature = /export function galleryBackdrop\(build: Construction, width=([\d.]+), backZ=(-?[\d.]+), height=([\d.]+)/.exec(construction)
assert.ok(signature, 'the gallery backdrop no longer declares its own width, back and height')
const WIDTH = Number(signature[1]), BACK_Z = Number(signature[2])
assert.ok(/galleryBackdrop\(build\)\s*$/m.test(source('src/wings/vinci/grave/index.ts')),
  'the grave no longer takes the gallery backdrop at its own defaults')
const placed = source('src/wings/vinci/collection/exhibits.ts')
assert.ok(placed.includes('grave.group.rotation.y = Math.PI / 2')
  && placed.includes('grave.group.position.set(GRAVE_ORIGIN.east, COURT.level + .035, -GRAVE_ORIGIN.north)'),
  'the grave is no longer mounted at its origin turned a quarter turn')
// A quarter turn reads the gallery's local x as north and its local z as east.
const piece = (pattern, what) => {
  const found = new RegExp(pattern).exec(construction)
  assert.ok(found, `the gallery's ${what} is no longer built as this checker reads it`)
  return found.slice(1).map(Number)
}
const [backDepth] = piece('build\\.box\\(0,height/2,backZ-\\.16,width,height,([\\d.]+),backing\\)', 'back wall')
const [kerbOffset, kerbDepth] = piece('build\\.box\\(0,\\.105,backZ\\+([\\d.]+),width\\+\\.1,\\.21,([\\d.]+),stone\\)', 'back wall base')
const [returnMid, returnThick, returnRun] = piece(
  'build\\.box\\(side\\*width/2,height/2,backZ\\+([\\d.]+),([\\d.]+),height,([\\d.]+),backing\\)', 'side returns')
// THE INSET RUNS STOP SHORT OF THE WALL THEY ARE SET INTO, by a bed the
// module declares once: four faces on one end plane fought each other and
// read as a comb of stripes from the court. The bed is read here rather than
// written here, so a change to it cannot pass this checker unseen.
const [endBed] = piece('const END=([\\d.]+)', "return runs' end bed")
const [kerbInset, kerbWidth] = piece(
  'build\\.box\\(side\\*\\(width/2-([\\d.]+)\\),\\.105,backZ\\+10-END,([\\d.]+),\\.21,20\\.3-END\\*2,stone\\)', 'return base')
// AND THE BED MAY ONLY TAKE THE RUN OFF THE WALL'S END PLANE. Its west end
// still meets the back wall and its east end stops short of the return's own
// end, both read off the same two numbers the run is built from.
{
  const baseWest = 10 - endBed - (returnRun - endBed * 2) / 2, baseEast = 10 - endBed + (returnRun - endBed * 2) / 2
  const wallWest = returnMid - returnRun / 2, wallEast = returnMid + returnRun / 2
  assert.equal(+baseWest.toFixed(6), +wallWest.toFixed(6),
    `the return's base no longer reaches the back wall: it starts at ${baseWest} against the wall's ${wallWest}`)
  assert.ok(baseEast < wallEast - 1e-9,
    `the return's base ends on the wall's own end plane again (${baseEast} against ${wallEast}): four faces at one depth`)
}
const gallery = {
  back: +(GRAVE_ORIGIN.east + BACK_Z - .16 - backDepth / 2).toFixed(3),
  backKerb: +(GRAVE_ORIGIN.east + BACK_Z + kerbOffset + kerbDepth / 2).toFixed(3),
  north: +(GRAVE_ORIGIN.north + WIDTH / 2 + returnThick / 2).toFixed(3),
  northKerb: +(GRAVE_ORIGIN.north + WIDTH / 2 - kerbInset - kerbWidth / 2).toFixed(3),
  returnEast: +(GRAVE_ORIGIN.east + BACK_Z + returnMid + returnRun / 2).toFixed(3),
}
for (const key of Object.keys(gallery))
  assert.equal(GALLERY[key], gallery[key], `the court declares the gallery's ${key} at ${GALLERY[key]}, it stands at ${gallery[key]}`)

// What those walls enclose: the whole gallery as far east as its returns
// reach, and the court's own footprint east of them.
const enclosed = [
  { west: GALLERY.back, south: COURT.south, east: GALLERY.returnEast, north: GALLERY.north },
  { west: GALLERY.returnEast, south: COURT.south, east: COURT.east, north: COURT.north },
]
const covered = (east, north) => COURT_GROUND.some(r => east >= r.west - 1e-9 && east <= r.east + 1e-9
  && north >= r.south - 1e-9 && north <= r.north + 1e-9)
const STEP = .1, bare = [], cut = []
let samples = 0, lowest = Infinity
for (const area of enclosed) {
  for (let east = area.west; east <= area.east + 1e-9; east += STEP) {
    for (let north = area.south; north <= area.north + 1e-9; north += STEP) {
      samples++
      if (!covered(east, north)) { if (bare.length < 6) bare.push([+east.toFixed(2), +north.toFixed(2)]); continue }
      // Every tenth sample is also asked what the ground under it stands at:
      // made ground here is a fill, so the terrain may never rise into it.
      if (samples % 10) continue
      const grade = gradeAt(east, north)
      if (grade === undefined) continue
      lowest = Math.min(lowest, COURT.level - grade)
      if (grade > COURT.level + 1e-6 && cut.length < 6) cut.push({ east: +east.toFixed(2), north: +north.toFixed(2), grade: +grade.toFixed(3) })
    }
  }
}
assert.equal(bare.length, 0, `terrain stands inside the court's walls at ${JSON.stringify(bare)}`)
assert.equal(cut.length, 0, `the court's ground is cut into the terrain at ${JSON.stringify(cut)}`)
report.court = { gallery, ground: COURT_GROUND.length, samples, bare: 0, cut: 0, thinnestFill: +lowest.toFixed(3) }

console.log(JSON.stringify(report, null, 1))
