#!/usr/bin/env node
/** THE CLOSE LOOK'S OFFLINE PROOF, on the real modules.
 *
 * Five things this checks, none of which needs a browser: every declared
 * viewing eye of every kind is in the clearance certificate on disk under the
 * exact station pose it returns to; the picture module's own one-slot stream
 * raises the full plate of the hang's exhibit that was walked to, and only
 * that one; each frame holds the whole plate at both viewports; the certified
 * path reversed lands on the station eye with no drift; and the places the
 * poses are composed from are the places the room builds its exhibits at.
 *
 * It claims no rendered light, no browser residency and no frame cost.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import * as THREE from 'three/webgpu'
import * as TSL from 'three/tsl'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const source = relative => fs.readFileSync(path.join(root, relative), 'utf8')
const raw = JSON.parse(source('public/na-manifest.json'))
const all = Array.isArray(raw) ? raw : raw.assets
const manifest = { all, byId: new Map(all.map(entry => [entry.id, entry])), forPath: () => undefined }
let tier = 'standard'
const memory = new Set(), streams = []
const memoryTotal = () => [...memory].reduce((sum, measure) => sum + measure(), 0)
const fullCount = () => streams.filter(stream => !stream.disposed && stream.full).length
const stack = {
  tierName: () => tier,
  registerTextureMemory(measure) { memory.add(measure); return () => memory.delete(measure) },
  cost: () => ({ textureMB: memoryTotal(), budget: { textureMB: 256 } }),
}
function fakeStream(preview, full) {
  const api = {
    preview, plate: full, full: false, disposed: false,
    material: new THREE.MeshBasicNodeMaterial(), ready: Promise.resolve(),
    available() { return !api.disposed }, update() {},
    allocation: () => ({ previewMB: 1, fullMB: 32 }),
    textureMB: () => api.disposed ? 0 : 1 + (api.full ? 32 : 0),
    error: () => null, pending: () => 0,
    high(enable) { api.full = enable; assert.ok(fullCount() <= 1, 'a second full source was granted'); return Promise.resolve() },
    dispose() { api.disposed = true; api.full = false; api.material.dispose() },
  }
  streams.push(api)
  return api
}

const cache = new Map()
const overrides = new Map([
  ['src/manifest/index.ts', { loadManifest: () => Promise.resolve(manifest) }],
  ['src/wings/vinci/pictures/stream.ts', { createPlateStream: fakeStream }],
  ['src/wings/vinci/collection/materials.ts', {
    collectionInteriorMaterial: () => new THREE.MeshBasicNodeMaterial(),
    collectionPlateTone: () => ({ mul() { return this } }),
  }],
])
function load(relative) {
  if (overrides.has(relative)) return overrides.get(relative)
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
  vm.runInNewContext(compiled, { module, exports: module.exports, require, console,
    matchMedia: () => ({ matches: false }) }, { filename: relative })
  return module.exports
}

const { vinciExhibitRecords, vinciApproachPose, vinciApproachFit, vinciApproachPlateMetres, vinciApproachReachMetres,
  VINCI_PLAQUE_AT, VINCI_READING_TABLE } = load('src/wings/vinci/collection/approaches.ts')
const { stationPose } = load('src/wings/vinci/rail.ts')
const { mountCollectionPlates } = load('src/wings/vinci/collection/plates.ts')
const { readVinciExhibits } = load('src/wings/vinci/collection/pick.ts')
const { createCertifiedRailPath } = load('src/wings/vinci/rail-smoothing.ts')
const { vinciWallStops, VINCI_PICTURE_WALL, VINCI_WALL_ENDS } = load('src/wings/vinci/collection/wall.ts')
const certificate = JSON.parse(source('src/wings/vinci/data/rail-clearance.json'))

/* ---- 1. every declared viewing eye is certified, at both viewports ---- */

const poseKey = pose => JSON.stringify([pose.eye, pose.at, pose.fov])
const saved = new Map(certificate.approaches.map(entry =>
  [`${entry.viewport}:${entry.station}:${entry.exhibit}`, entry]))
assert.equal(certificate.format, 'vinci-rail-clearance-v2')
const records = vinciExhibitRecords()
const kinds = {}
for (const record of records) kinds[record.kind] = (kinds[record.kind] ?? 0) + 1
assert.equal(JSON.stringify(kinds), JSON.stringify({ picture: 26, mural: 1, machine: 13, place: 3, manuscript: 1, stud: 12 }),
  'the hang, the Ingres, the mural, thirteen machines, three places, the book and twelve dates')
assert.equal(new Set(records.map(record => record.id)).size, records.length, 'an exhibit is declared once')
assert.equal(certificate.approaches.length, records.length * 2)
const hang = records.filter(record => record.station === 'picture-room')
assert.equal(hang.length, 25, 'the picture room hangs twenty five plates')
const report = { records: records.length, kinds, approaches: certificate.approaches.length, worst: {} }
for (const viewport of ['desktop', 'phone']) {
  const narrow = viewport === 'phone'
  for (const record of records) {
    const entry = saved.get(`${viewport}:${record.station}:${record.id}`)
    assert.ok(entry, `no certified approach: ${viewport} ${record.id}`)
    const station = stationPose(record.station, narrow)
    const viewing = vinciApproachPose(record.id, narrow)
    assert.equal(poseKey(entry.fromPose), poseKey({ eye: station.eye.toArray(), at: station.at.toArray(), fov: station.fov }),
      `the certified start is not the station eye: ${viewport} ${record.id}`)
    assert.equal(poseKey(entry.toPose), poseKey({ eye: viewing.eye.toArray(), at: viewing.at.toArray(), fov: viewing.fov }),
      `the certified end is not the viewing eye: ${viewport} ${record.id}`)
    assert.equal(entry.certifiedBalls.length, 0, 'an approach is a straight leg')

    /* ---- 4. the return lands on the exact certified station eye ---- */
    const points = entry.points.map(([east, north, height]) => new THREE.Vector3(east, height, -north))
    const back = createCertifiedRailPath([...points].reverse(), {
      clearanceRadiusM: entry.maxNearRadius, maxTrimM: .5, certificateDepth: 6, certifyBall: () => true,
    })
    const landed = back.pointAtDistance(back.length, new THREE.Vector3())
    const drift = landed.distanceTo(station.eye)
    assert.equal(drift, 0, `the return drifts ${drift} m: ${viewport} ${record.id}`)
    const out = createCertifiedRailPath(points, {
      clearanceRadiusM: entry.maxNearRadius, maxTrimM: .5, certificateDepth: 6, certifyBall: () => true,
    })
    assert.equal(out.pointAtDistance(out.length, new THREE.Vector3()).distanceTo(viewing.eye), 0)
    assert.equal(+out.length.toFixed(9), +back.length.toFixed(9))

    /* ---- 3. the frame holds the whole work inside the band it settled on ---- */
    if (record.station !== 'picture-room') continue
    const fit = vinciApproachFit(record.id, narrow)
    assert.ok(fit.height <= 1.001 && fit.width <= 1.001,
      `the frame cuts the work: ${viewport} ${record.id} height ${fit.height} width ${fit.width}`)
    assert.ok(fit.bottom >= -.96, `the work stands on the frame's own edge: ${viewport} ${record.id}`)
    const metres = vinciApproachPlateMetres(record.id, narrow)
    assert.ok(metres <= vinciApproachReachMetres(), `the viewing eye stands ${metres} m off the plate: ${viewport} ${record.id}`)
    assert.ok(fit.bottom >= fit.authoredBottom - 1e-9, `the work's foot stands behind the card: ${viewport} ${record.id}`)
    const worst = report.worst[viewport] ?? { fit: 0, metres: 0, band: fit.authoredBottom, relaxed: [] }
    report.worst[viewport] = { fit: Math.max(worst.fit, fit.height, fit.width), metres: Math.max(worst.metres, metres),
      band: Math.min(worst.band, fit.bottom),
      relaxed: fit.bottom < fit.authoredBottom - 1e-9 ? [...worst.relaxed, record.id] : worst.relaxed }
  }
}

/* ---- 2. the arrival is what raises the full plate ---- */

const host = new THREE.Group()
const plates = mountCollectionPlates(host, stack)
await plates.ready
const tick = async eye => {
  plates.update(1 / 60, eye)
  for (let turn = 0; turn < 8; turn++) await Promise.resolve()
}
await tick(new THREE.Vector3(0, 0, 0))
assert.equal(plates.errors().length, 0)
assert.equal(fullCount(), 0, 'no full plate stands before anyone walks up to one')
const registry = readVinciExhibits(host)
// The plates' own group carries the hang and the mural; the other kinds stand
// in the collection beside it and are read there.
assert.equal(registry.filter(entry => entry.openable).length, hang.length + 1)
assert.equal(registry.filter(entry => entry.kind === 'sheet').length, 29)
assert.equal(registry.filter(entry => entry.kind === 'mural').length, 1)
assert.ok(registry.every(entry => entry.radiusM >= .11), 'every proxy has its own floor')
const raised = []
for (const record of hang) {
  const pose = vinciApproachPose(record.id, false)
  await tick(pose.eye)
  assert.equal(fullCount(), 1, `the arrival raised ${fullCount()} full plates: ${record.id}`)
  const mesh = host.getObjectByName('vinci/collection-plates')
    .children.find(child => child.userData.workId === record.workId && child.userData.face === record.face)
  assert.ok(mesh, `no mounted plate for ${record.id}`)
  const stream = streams.find(entry => entry.plate.id === mesh.userData.manifestId)
  assert.ok(stream.full, `the plate at the viewing eye is not at full resolution: ${record.id}`)
  raised.push(record.id)
}
assert.equal(raised.length, hang.length)
// THE TWO END STATIONS STAND AT THE ENDS OF THE WALL, a stride off the
// nearest work, so the room's one full slot is spent on that work while a
// visitor stands there. It is still one slot, and it is the work at their
// shoulder. A station in another room raises nothing at all, which is what
// keeps the budget from being spent from across the building.
for (const station of ['picture-room', 'picture-room-west']) {
  await tick(stationPose(station, false).eye)
  assert.equal(fullCount(), 1, `the ${station} eye raised ${fullCount()} full plates`)
}
await tick(stationPose('body', false).eye)
assert.equal(fullCount(), 0, 'a station in another room holds a full plate')
report.raisedOnArrival = raised.length

/* ---- 6. the wall: one polyline, and every run a sub-path of it ----
 *
 * The 25 viewing eyes with the two end station eyes as the ends of the same
 * line. What is proved here is the claim the certificate rests on: that a run
 * between two vertices is the sub-path between them, which needs the trims to
 * be identical in the whole and in the part, both endpoints to be exact, and
 * the sub-path's length to be the certificate's own cumulative tables. The
 * fillets are accepted against the SAVED balls, as the runtime accepts them,
 * so a corner certified in the whole and refused in a part would show here.
 */

const walls = certificate.walls ?? []
assert.equal(walls.length, 2, 'one wall per viewport')
const wallReport = {}
for (const viewport of ['desktop', 'phone']) {
  const narrow = viewport === 'phone'
  const wall = walls.find(entry => entry.viewport === viewport)
  assert.ok(wall, `no wall certificate: ${viewport}`)
  assert.equal(wall.id, VINCI_PICTURE_WALL)
  // The modules run in their own realm, so the lists are compared as text.
  assert.equal(JSON.stringify(wall.ends), JSON.stringify([...VINCI_WALL_ENDS]))
  assert.equal(JSON.stringify(wall.stops), JSON.stringify(vinciWallStops().map(stop => stop.exhibit)),
    'the stops are the wall\'s own order')
  assert.equal(wall.stops.length, 25)
  assert.equal(wall.points.length, 27)
  assert.equal(wall.chordM.length, 27)
  assert.equal(wall.shortenM.length, 27)
  const eyes = [
    stationPose(wall.ends[0], narrow).eye,
    ...wall.stops.map(id => vinciApproachPose(id, narrow).eye),
    stationPose(wall.ends[1], narrow).eye,
  ]
  const points = wall.points.map(([east, north, height]) => new THREE.Vector3(east, height, -north))
  points.forEach((point, at) => assert.equal(point.distanceTo(eyes[at]), 0,
    `wall vertex ${at} is not the eye the certificate holds: ${viewport}`))
  const balls = wall.certifiedBalls.map(ball =>
    ({ centre: new THREE.Vector3().fromArray(ball.centre), radius: ball.radiusM - .000002 }))
  const build = list => createCertifiedRailPath(list, {
    clearanceRadiusM: wall.maxNearRadius, maxTrimM: .5, certificateDepth: 6,
    certifyBall: (centre, radius) => balls.some(ball => ball.centre.distanceTo(centre) + radius <= ball.radius),
  })
  const whole = build(points.map(point => point.clone()))
  assert.ok(Math.abs(whole.length - wall.roundedLength) < 1e-9, `the wall rebuilds shorter than its certificate: ${viewport}`)
  const legs = []
  for (let at = 1; at < points.length; at++) legs.push(points[at - 1].distanceTo(points[at]))
  let drift = 0, lengthError = 0, runs = 0
  const landed = new THREE.Vector3(), left = new THREE.Vector3()
  for (let from = 0; from < points.length; from++) for (let to = 0; to < points.length; to++) {
    if (from === to) continue
    const low = Math.min(from, to), high = Math.max(from, to)
    const slice = points.slice(low, high + 1).map(point => point.clone())
    const path = build(from < to ? slice : slice.reverse())
    path.pointAtDistance(0, left)
    path.pointAtDistance(path.length, landed)
    drift = Math.max(drift, left.distanceTo(points[from]), landed.distanceTo(points[to]))
    // the run's own certified length: the chord between its two vertices, less
    // what each corner INSIDE it takes out of that chord. Its ends take none.
    const certified = (wall.chordM[high] - wall.chordM[low]) - (wall.shortenM[high - 1] - wall.shortenM[low])
    lengthError = Math.max(lengthError, Math.abs(path.length - certified))
    runs++
  }
  assert.equal(drift, 0, `a wall run drifts ${drift} m off its own vertex: ${viewport}`)
  assert.ok(lengthError < 1e-9, `a wall run is ${lengthError} m off its certified length: ${viewport}`)
  wallReport[viewport] = {
    vertices: points.length, spans: points.length - 1, runs, drift, lengthError,
    lengthM: +whole.length.toFixed(4),
    shortestLegM: +Math.min(...legs).toFixed(4), longestLegM: +Math.max(...legs).toFixed(4),
  }
}
report.wall = wallReport

/* ---- 5. the poses stand where the room builds what they look at ---- */

// The twelve cut dates: the floor's own list against the one the poses read.
const studs = load('src/wings/vinci/line/studs.ts')
const floor = (() => {
  overrides.set('src/wings/vinci/line/index.ts', { STUDS: studs.LINE_STUDS, STUD_SPACING: studs.LINE_STUD_SPACING, createLine() {} })
  return load('src/wings/vinci/collection/line-floor.ts')
})()
const { LINE_ORIGIN } = load('src/wings/vinci/collection/layout.ts')
// The modules run in their own realm, so the lists are compared as text.
assert.equal(JSON.stringify(floor.collectionLineStuds.map(stud => [stud.id, stud.station, stud.east, stud.north])),
  JSON.stringify(studs.lineCutStuds(LINE_ORIGIN).map(stud => [stud.id, stud.station, stud.east, stud.north])),
  'the floor lays its dates where the poses look for them')
for (const stud of floor.collectionLineStuds) assert.ok(records.some(record => record.id === `stud/${stud.id}`), `no pose for ${stud.id}`)
// The plaque's stone and the reading table, read off the modules that stand them.
const plaque = /COURT_PLAQUE_STAND = \{ east: (-?[\d.]+), north: (-?[\d.]+)/.exec(source('src/wings/vinci/collection/court-plaque.ts'))
assert.ok(plaque && +plaque[1] === VINCI_PLAQUE_AT.east && +plaque[2] === VINCI_PLAQUE_AT.north, 'the plaque stands where its pose looks')
// The table's place is ONE constant now, imported by the module that stands
// it from the module that composes the eye, so there are no two literals left
// to disagree. What is checked is that the import is the one that is used.
const exhibitsSource = source('src/wings/vinci/collection/exhibits.ts')
assert.ok(/import \{ VINCI_READING_TABLE \} from '\.\/approaches'/.test(exhibitsSource),
  'the table does not read its place from the module that composes its eye')
assert.ok(exhibitsSource.includes('built.object.position.set(VINCI_READING_TABLE.east, VINCI_READING_TABLE.top, -VINCI_READING_TABLE.north)'),
  'the book lies where its pose looks')
const grave = source('src/wings/vinci/collection/exhibits.ts')
assert.ok(grave.includes('grave.group.rotation.y = Math.PI / 2')
  && grave.includes('grave.group.position.set(GRAVE_ORIGIN.east, COURT.level + .035, -GRAVE_ORIGIN.north)'),
  'the grave stands turned and set where its poses look')
report.placed = { studs: floor.collectionLineStuds.length, plaque: true, table: true, grave: true }
report.ok = true
console.log(JSON.stringify(report, null, 2))
