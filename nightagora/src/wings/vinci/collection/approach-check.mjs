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

/** Every three.js addon the wing's sources import, resolved once up front:
 * the module loader below is synchronous and cannot await one. */
const addons = new Map()
for (const dir of ['src/wings/vinci', 'src/stack']) {
  const walk = at => fs.readdirSync(at, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? walk(path.join(at, entry.name)) : /\.(ts|mjs)$/.test(entry.name) ? [path.join(at, entry.name)] : [])
  for (const file of walk(path.join(root, dir)))
    for (const hit of fs.readFileSync(file, 'utf8').matchAll(/from '(three\/addons\/[^']+)'/g)) addons.set(hit[1], null)
}
for (const specifier of [...addons.keys()]) addons.set(specifier, await import(specifier))
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
    if (addons.has(specifier)) return addons.get(specifier)
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
  vinciApproachRunPairs, vinciApproachRowNeighbours, VINCI_MACHINE_ROW, VINCI_PLAQUE_AT, VINCI_READING_TABLE } = load('src/wings/vinci/collection/approaches.ts')
const { MACHINE_SLUGS } = load('src/wings/vinci/machines/catalog.ts')
const { stationPose } = load('src/wings/vinci/rail.ts')
const { mountCollectionPlates } = load('src/wings/vinci/collection/plates.ts')
const { readVinciExhibits } = load('src/wings/vinci/collection/pick.ts')
const { createCertifiedRailPath } = load('src/wings/vinci/rail-smoothing.ts')
const { VINCI_WALLS, vinciWallStops, vinciGalleryRun, GALLERY_WALK_M } = load('src/wings/vinci/collection/wall.ts')
const certificate = JSON.parse(source('src/wings/vinci/data/rail-clearance.json'))

/* ---- 1. every declared viewing eye is certified, at both viewports ---- */

const poseKey = pose => JSON.stringify([pose.eye, pose.at, pose.fov, pose.shift ?? 0])
const saved = new Map(certificate.approaches.map(entry =>
  [`${entry.viewport}:${entry.station}:${entry.exhibit}`, entry]))
assert.equal(certificate.format, 'vinci-rail-clearance-v2')
const records = vinciExhibitRecords()
const kinds = {}
for (const record of records) kinds[record.kind] = (kinds[record.kind] ?? 0) + 1
/* The census of what a visitor can walk up to, by kind. The order the kinds
   are declared in is the registry's own business, so this reads them by name:
   the hang and the deathbed painting, the wall in Milan, the body wall's
   sheets, the twelve machines on their stands, the two on the hall's table
   and the lion on the hall's floor, the two of the grave court, the codex
   and the study's leaf. The court's stone is a bench and no exhibit. */
const CENSUS = { picture: 26, mural: 1, sheet: 29, machine: 15, place: 2, manuscript: 2 }
const named = kinds_ => Object.keys(kinds_).sort().map(kind => `${kind} ${kinds_[kind]}`).join(', ')
assert.equal(named(kinds), named(CENSUS),
  'the hang and the deathbed painting, the mural, the body wall\'s sheets, twelve machines on stands, the table\'s two and the floor\'s lion, two places, the codex and the study\'s leaf')
/* EVERY NEIGHBOUR OF A ROW IS WALKED: the machine row holds every machine
   once, and each step of a room's row is a certified leg, so a step to the
   next machine is never a jump. */
assert.deepEqual([...VINCI_MACHINE_ROW].sort(), [...MACHINE_SLUGS].sort(), 'the machine row holds every machine once')
const walked = new Set(vinciApproachRunPairs().map(pair => `${pair.from}|${pair.to}`))
for (const [from, to] of vinciApproachRowNeighbours()) assert.ok(walked.has(`${from}|${to}`), `a row step is not walked: ${from} to ${to}`)
for (const pair of vinciApproachRunPairs()) for (const viewport of ['desktop', 'phone']) {
  assert.ok(certificate.links.some(link => link.viewport === viewport && link.from === pair.from && link.to === pair.to), `no certified link: ${viewport} ${pair.from} to ${pair.to}`)
}
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
    assert.equal(poseKey(entry.fromPose), poseKey({ eye: station.eye.toArray(), at: station.at.toArray(), fov: station.fov, shift: station.shift }),
      `the certified start is not the station eye: ${viewport} ${record.id}`)
    assert.equal(poseKey(entry.toPose), poseKey({ eye: viewing.eye.toArray(), at: viewing.at.toArray(), fov: viewing.fov, shift: viewing.shift }),
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
// The hang and the mural, and now every sheet of the body wall: each one
// carries a certified viewing eye at both viewports.
assert.equal(registry.filter(entry => entry.openable).length, hang.length + 1 + 29)
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
// THE TWO END STATIONS STAND BACK FROM THE WALL, at the room's own mid depth,
// because a pose a stride off the hang shows a painting to nobody. From back
// there the nearest work is past the module's own reach, so a station spends
// NO full slot and the whole budget stands ready for the stop the visitor
// walks to. A station in another room raises nothing at all either, which is
// what keeps the budget from being spent from across the building.
for (const station of ['picture-room', 'picture-room-west']) {
  await tick(stationPose(station, false).eye)
  assert.equal(fullCount(), 0, `the ${station} eye raised ${fullCount()} full plates`)
}
await tick(stationPose('body', false).eye)
assert.equal(fullCount(), 0, 'a station in another room holds a full plate')
report.raisedOnArrival = raised.length

/* ---- 6. the wall: one polyline, and every run a sub-path of it ----
 *
 * Each wall's viewing eyes with its own station eyes as the ends of the same
 * line. What is proved here is the claim the certificate rests on: that a run
 * between two vertices is the sub-path between them, which needs the trims to
 * be identical in the whole and in the part, both endpoints to be exact, and
 * the sub-path's length to be the certificate's own cumulative tables. The
 * fillets are accepted against the SAVED balls, as the runtime accepts them,
 * so a corner certified in the whole and refused in a part would show here.
 */

const walls = certificate.walls ?? []
assert.equal(walls.length, VINCI_WALLS.length * 2, 'every declared wall, once per viewport')
const wallReport = {}
for (const viewport of ['desktop', 'phone']) for (const declared of VINCI_WALLS) {
  const narrow = viewport === 'phone'
  const wall = walls.find(entry => entry.viewport === viewport && entry.id === declared.id)
  assert.ok(wall, `no wall certificate: ${viewport} ${declared.id}`)
  const stops = vinciWallStops(declared)
  // The modules run in their own realm, so the lists are compared as text.
  assert.equal(JSON.stringify(wall.ends), JSON.stringify([...declared.ends]))
  assert.equal(JSON.stringify(wall.stops), JSON.stringify(stops.map(stop => stop.exhibit)),
    'the stops are the wall\'s own order')
  assert.equal(wall.points.length, wall.stops.length + wall.ends.length)
  assert.equal(wall.chordM.length, wall.points.length)
  assert.equal(wall.shortenM.length, wall.points.length)
  const eyes = [
    stationPose(wall.ends[0], narrow).eye,
    ...wall.stops.map(id => vinciApproachPose(id, narrow).eye),
    ...(wall.ends.length > 1 ? [stationPose(wall.ends[wall.ends.length - 1], narrow).eye] : []),
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
  assert.ok(Math.abs(whole.length - wall.roundedLength) < 1e-9, `the wall rebuilds shorter than its certificate: ${viewport} ${declared.id}`)
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
  assert.equal(drift, 0, `a wall run drifts ${drift} m off its own vertex: ${viewport} ${declared.id}`)
  assert.ok(lengthError < 1e-9, `a wall run is ${lengthError} m off its certified length: ${viewport} ${declared.id}`)
  wallReport[`${viewport}/${declared.id}`] = {
    vertices: points.length, spans: points.length - 1, runs, drift, lengthError,
    lengthM: +whole.length.toFixed(4),
    shortestLegM: +Math.min(...legs).toFixed(4), longestLegM: +Math.max(...legs).toFixed(4),
  }
}
report.wall = wallReport

/* ---- 4b. the gallery: every long run down a wall's aisle ----
 *
 * A run long enough to walk a wall's aisle is its first vertex, one gate, the
 * gate forward of its last vertex, and that vertex. What is proved here is
 * what the certificate's linear table rests on: each gate's corner, rebuilt
 * against the SAVED balls of its two spurs, takes the trim the table records
 * in every run through it, both ends are exact, and the run's length is the
 * table's own sum. A corner refused in some run, or a gate the table lacks,
 * would show here.
 */
const galleryReport = {}
for (const viewport of ['desktop', 'phone']) for (const declared of VINCI_WALLS) {
  if (!declared.gallery) continue
  const gallery = (certificate.galleries ?? []).find(entry => entry.viewport === viewport && entry.id === declared.id)
  assert.ok(gallery, `no gallery certificate: ${viewport} ${declared.id}`)
  const wall = walls.find(entry => entry.viewport === viewport && entry.id === declared.id)
  const toVector = ([east, north, height]) => new THREE.Vector3(east, height, -north)
  let runs = 0, drift = 0, lengthError = 0, trimError = 0, shortest = Infinity
  for (let from = 0; from < wall.points.length; from++) for (let to = 0; to < wall.points.length; to++) {
    if (from === to) continue
    const low = Math.min(from, to), high = Math.max(from, to)
    if ((wall.chordM[high] - wall.chordM[low]) - (wall.shortenM[high - 1] - wall.shortenM[low]) < GALLERY_WALK_M) continue
    const points = vinciGalleryRun(declared.gallery, wall.points, from, to)
    if (!points) continue
    const side = points[3][0] > points[0][0] ? 1 : -1
    const leave = gallery.spurs.find(spur => spur.vertex === from && spur.side === side)
    const arrive = gallery.spurs.find(spur => spur.vertex === to && spur.side === -side)
    assert.ok(leave && arrive, `a long run has no gate on the table: ${viewport} ${from} to ${to}`)
    const balls = [...leave.certifiedBalls, ...arrive.certifiedBalls].map(ball =>
      ({ centre: new THREE.Vector3().fromArray(ball.centre), radius: ball.radiusM - .000002 }))
    const path = createCertifiedRailPath(points.map(toVector), {
      clearanceRadiusM: gallery.maxNearRadius, maxTrimM: .5, certificateDepth: 6,
      certifyBall: (centre, radius) => balls.some(ball => ball.centre.distanceTo(centre) + radius <= ball.radius),
    })
    const [first, second] = path.corners
    trimError = Math.max(trimError, Math.abs(first.acceptedTrimM - leave.trimM), Math.abs(second.acceptedTrimM - arrive.trimM))
    const start = new THREE.Vector3(), end = new THREE.Vector3()
    path.pointAtDistance(0, start); path.pointAtDistance(path.length, end)
    drift = Math.max(drift, start.distanceTo(toVector(points[0])), end.distanceTo(toVector(points[3])))
    const certified = leave.spurM + Math.abs(arrive.gate[0] - leave.gate[0]) + arrive.spurM - leave.shortenM - arrive.shortenM
    lengthError = Math.max(lengthError, Math.abs(path.length - certified))
    shortest = Math.min(shortest, path.length)
    runs++
  }
  assert.ok(runs > 0, `no run walks the gallery: ${viewport} ${declared.id}`)
  assert.equal(drift, 0, `a gallery run drifts ${drift} m off its own vertex: ${viewport} ${declared.id}`)
  assert.equal(trimError, 0, `a gate rounds differently in some run: ${viewport} ${declared.id}`)
  assert.ok(lengthError < 1e-9, `a gallery run is ${lengthError} m off its certified length: ${viewport} ${declared.id}`)
  galleryReport[`${viewport}/${declared.id}`] = { runs, spurs: gallery.spurs.length, drift, trimError, lengthError, shortestRunM: +shortest.toFixed(4) }
}
report.gallery = galleryReport

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
// A date is read from the one station that stands at the line's head, so no
// socket carries a certified leg and none may stand in the approach table.
for (const stud of floor.collectionLineStuds) assert.ok(!records.some(record => record.id === `stud/${stud.id}`), `a dead leg for ${stud.id}`)
// The court's bench and the reading table, read off the modules that stand them.
const plaque = /COURT_PLAQUE_STAND = \{ east: (-?[\d.]+), north: (-?[\d.]+)/.exec(source('src/wings/vinci/collection/court-plaque.ts'))
assert.ok(plaque && +plaque[1] === VINCI_PLAQUE_AT.east && +plaque[2] === VINCI_PLAQUE_AT.north, 'the bench stands where the court puts it')
assert.ok(!records.some(record => record.id === 'plaque/flight-quote'), 'the bench is no exhibit')
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
report.placed = { studs: floor.collectionLineStuds.length, bench: true, table: true, grave: true }
report.ok = true
console.log(JSON.stringify(report, null, 2))
