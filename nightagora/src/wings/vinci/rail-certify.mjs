#!/usr/bin/env node
/** THE RAIL'S CLEARANCE CERTIFICATE, WRITTEN FROM THE MOUNTED GEOMETRY.
 *
 * `rail-proof.ts` refuses to move the camera unless a SHA-256 over every
 * collision mesh AND over both viewports' station poses matches
 * `data/rail-clearance.json`. Without the program that writes that file no
 * pose can move and no solid can change. This is that program.
 *
 * It runs the real factories at every tier, hashes them with the same
 * `rail-fingerprint.ts` the browser runs, builds every directed route
 * routes from `rail-waypoints.ts`, proves every straight span and every
 * rounded corner against the real triangles, proves each station's own near
 * envelope, and writes the certificate plus its manifest hash.
 *
 *   node src/wings/vinci/rail-certify.mjs            re-certify and write
 *   node src/wings/vinci/rail-certify.mjs --verify   prove the file on disk
 *   node src/wings/vinci/rail-certify.mjs --json     the full record
 *
 * `--verify` writes nothing and exits non-zero if the file on disk is not what
 * the current geometry and the current poses certify.
 */
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import * as THREE from 'three/webgpu'
import * as TSL from 'three/tsl'

const ROOT = fs.realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..'))
const WING = path.join(ROOT, 'src/wings/vinci')
const CERTIFICATE = path.join(WING, 'data/rail-clearance.json')
const MANIFEST = path.join(ROOT, 'assets/wing-vinci/manifest.json')
const RECIPE = 'src/wings/vinci/rail-certify.mjs'
const args = new Set(process.argv.slice(2))
const VERIFY = args.has('--verify')
/** For the identity proof against the inherited certificate, which was written
 * before the walk carried a step rhythm. */
const NO_GAIT = args.has('--no-gait')

/** The tolerance the runtime reserves from every stored ball, and the quantum
 * the geometry fingerprint rounds every coordinate to. */
const GEOMETRY_TOLERANCE_M = .000002, QUANTUM_M = .000001, BALL_RESERVE_M = .000004
const NEAR_M = .25, NUMERICAL_MARGIN_M = .00001
const LOOK_YAW = .6, LOOK_PITCH = .32, LOOK_STEP = .02
const VIEWPORTS = [
  { name: 'desktop', phone: false, aspect: 1280 / 720, tier: 'standard' },
  { name: 'phone', phone: true, aspect: 390 / 844, tier: 'calm' },
]

const sources = []
const modules = new Map()
function read(file) {
  const real = fs.realpathSync(file)
  if (!real.startsWith(ROOT + path.sep)) throw new Error('Read leaves the app: ' + file)
  const raw = fs.readFileSync(real, 'utf8')
  const relative = path.relative(ROOT, real).split(path.sep).join('/')
  if (!sources.some(source => source.file === relative)) {
    sources.push({ file: relative, sha256: createHash('sha256').update(raw).digest('hex'), bytes: Buffer.byteLength(raw) })
  }
  return raw
}
async function load(file) {
  if (modules.has(file)) return modules.get(file)
  const exports = {}
  modules.set(file, exports)
  const code = ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const dependencies = new Map()
  for (const [, name] of code.matchAll(/\brequire\(["']([^"']+)["']\)/g)) {
    if (dependencies.has(name)) continue
    if (name.startsWith('.')) {
      const target = path.resolve(path.dirname(file), name.replace(/\?raw$/, ''))
      dependencies.set(name, name.endsWith('?raw') ? { default: read(target) } : await load(target + '.ts'))
    } else if (/^three(?:\/|$)/.test(name)) dependencies.set(name, await import(name))
    else throw new Error('Unexpected runtime dependency: ' + name)
  }
  new vm.Script(code, { filename: path.relative(ROOT, file) }).runInNewContext({
    exports, require: name => dependencies.get(name), Float32Array, performance,
    crypto: globalThis.crypto, TextEncoder: globalThis.TextEncoder, console, matchMedia: () => ({ matches: false }),
  }, { timeout: 20000 })
  return exports
}

const { stationPose } = await load(path.join(WING, 'rail.ts'))
const { vinciContent } = await load(path.join(WING, 'content.ts'))
const { railGeometryFingerprint } = await load(path.join(WING, 'rail-fingerprint.ts'))
const { collectRailSolids } = await load(path.join(WING, 'rail-solids.ts'))
const { createCertifiedRailPath, railNearRectangleRadius } = await load(path.join(WING, 'rail-smoothing.ts'))
const { fittedRailFov } = await load(path.join(WING, 'rail-projection.ts'))
const { gaitEnvelopeM } = await load(path.join(WING, 'gait.ts'))
const { railSide, railWaypointsBetween, railGateWaypoints, railTerraceWaypoints } = await load(path.join(WING, 'rail-waypoints.ts'))
const { railExhibitStands, railExhibitLevel } = await load(path.join(WING, 'rail-solids.ts'))
const { createCollectionStandSolids } = await load(path.join(WING, 'collection/stands.ts'))
const { geometryForPart } = await load(path.join(WING, 'machines/geometry.ts'))
const { jointValuesAt } = await load(path.join(WING, 'machines/motion.ts'))
const { gradeAt } = await load(path.join(WING, 'terrain-mesh.ts'))

/* ---- the mounted geometry, at every tier ---- */

const FACTORIES = [
  ['shell', 'shell', 'createShell', false], ['terrain', 'ground', 'createGround', false],
  ['gate-passage', 'gate-passage', 'createGatePassage', false],
  ['inner-court', 'inner-court', 'createInnerCourtDressing', true],
  ['collection', 'collection', 'createCollection', false],
  ['collection-access', 'collection-access', 'createCollectionAccess', false],
  ['entry-passage', 'entry-passage', 'createEntryPassage', false],
  ['vegetation', 'vegetation', 'createVegetation', true],
  ['road-dressing', 'road-dressing', 'createRoadDressing', true],
  ['ground-dressing', 'ground-dressing', 'createGroundDressing', true],
]
async function mount(tier) {
  const scene = new THREE.Group()
  for (const [id, file, name, grounded] of FACTORIES) {
    const module = await load(path.join(WING, file + '.ts'))
    const group = grounded ? module[name](gradeAt, tier) : module[name](tier)
    group.traverse(object => { if (object.isMesh && typeof object.userData.manifestId !== 'string') object.userData.manifestId = 'vinci/' + id })
    scene.add(group)
  }
  const water = (await load(path.join(WING, 'water.ts'))).createWater(new THREE.Scene(), {
    tierName: () => tier, reflector: () => ({ node: TSL.vec4(0, 0, 0, 1), dispose() {} }),
  })
  water.traverse(object => { if (object.isMesh && typeof object.userData.manifestId !== 'string') object.userData.manifestId = 'vinci/water' })
  scene.add(water)
  // The plinths and bases under the exhibits, from the runtime's own factory.
  scene.add(createCollectionStandSolids(new THREE.MeshBasicMaterial()))
  return scene
}

/* ---- every machine in the pose its schedule holds at t=0 ---- */

/** A machine is not a mounted mesh when the runtime hashes the scene: it
 * arrives as the visitor walks up to it. Its REST geometry is a solid all the
 * same, and the walk is proved against it here. Any joint value away from
 * zero at t=0 is refused rather than silently ignored. */
function restPoseSolids(tier) {
  const meshes = []
  for (const slug of Object.keys(railExhibitStands)) {
    const dossier = JSON.parse(read(path.join(WING, `machines/data/${slug}.json`)))
    for (const [joint, value] of Object.entries(jointValuesAt(slug, 0))) {
      if (Math.abs(value) > 1e-12) throw new Error(`${slug}: joint ${joint} is not at rest at t=0`)
    }
    const stand = railExhibitStands[slug]
    const root = new THREE.Group()
    root.rotation.y = stand.bearing * Math.PI / 180
    root.position.set(stand.east, railExhibitLevel(stand.ground) + stand.plinth - (dossier.frame.ground_y_m ?? 0), -stand.north)
    const nodes = new Map([['world', root], ['root', root]])
    const pending = [...dossier.parts]
    const built = new Set()
    let guard = 0
    while (pending.length && guard++ < 20000) {
      const part = pending.shift()
      if (part.parent && !nodes.has(part.parent) && dossier.parts.some(other => other.id === part.parent) && !built.has(part.parent)) { pending.push(part); continue }
      const group = new THREE.Group()
      group.position.fromArray(part.position_m)
      group.rotation.set(part.orientation_rad[0] ?? 0, part.orientation_rad[1] ?? 0, part.orientation_rad[2] ?? 0)
      ;(nodes.get(part.parent) ?? root).add(group)
      nodes.set(part.id, group)
      built.add(part.id)
      const mesh = new THREE.Mesh(geometryForPart(part, tier, slug))
      mesh.name = `vinci/${slug}/${part.id}`
      mesh.userData.manifestId = `vinci/machine/${slug}`
      group.add(mesh)
      meshes.push(mesh)
    }
    if (pending.length) throw new Error(`${slug}: unresolved parent for ${pending.map(part => part.id).join(', ')}`)
    root.updateMatrixWorld(true)
  }
  return meshes
}

const geometry = [], solidSets = [], restSets = []
for (const tier of ['hero', 'standard', 'calm']) {
  const scene = await mount(tier)
  const solids = collectRailSolids(scene)
  const sha256 = await railGeometryFingerprint(solids)
  geometry.push({ tier, sha256, quantumM: QUANTUM_M, matchingGeometryToleranceM: GEOMETRY_TOLERANCE_M })
  solidSets.push({ tier, solids })
  // The rest poses stand outside the fingerprint and inside the clearance.
  restSets.push({ tier: `rest-${tier}`, solids: restPoseSolids(tier) })
}
const geometrySha256 = [...new Set(geometry.map(entry => entry.sha256))]

/* ---- the triangles, and the two exact distance tests ---- */

function trianglesOf(sets) {
  const values = [], names = []
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3()
  const seen = new Set()
  for (const { tier, solids } of sets) for (const mesh of solids) {
    const key = tier + '/' + mesh.name
    if (seen.has(key)) continue
    seen.add(key)
    mesh.updateWorldMatrix(true, false)
    const attribute = mesh.geometry.getAttribute('position'), index = mesh.geometry.getIndex()
    const count = index?.count ?? attribute.count
    for (let i = 0; i + 2 < count; i += 3) {
      a.fromBufferAttribute(attribute, index ? index.getX(i) : i).applyMatrix4(mesh.matrixWorld)
      b.fromBufferAttribute(attribute, index ? index.getX(i + 1) : i + 1).applyMatrix4(mesh.matrixWorld)
      c.fromBufferAttribute(attribute, index ? index.getX(i + 2) : i + 2).applyMatrix4(mesh.matrixWorld)
      values.push(...a.toArray(), ...b.toArray(), ...c.toArray())
      names.push(mesh.name)
    }
  }
  return { values: new Float64Array(values), names, count: names.length }
}
/** A uniform grid. Every triangle is registered in every cell its box meets,
 * so a query cannot miss one by looking at the wrong cell. */
function makeIndex(data, cellSize) {
  const bins = new Map()
  for (let i = 0; i < data.count; i++) {
    const at = i * 9
    const low = [0, 1, 2].map(axis => Math.floor(Math.min(data.values[at + axis], data.values[at + 3 + axis], data.values[at + 6 + axis]) / cellSize))
    const high = [0, 1, 2].map(axis => Math.floor(Math.max(data.values[at + axis], data.values[at + 3 + axis], data.values[at + 6 + axis]) / cellSize))
    for (let x = low[0]; x <= high[0]; x++) for (let y = low[1]; y <= high[1]; y++) for (let z = low[2]; z <= high[2]; z++) {
      const key = x + ',' + y + ',' + z
      let bucket = bins.get(key)
      if (!bucket) { bucket = []; bins.set(key, bucket) }
      bucket.push(i)
    }
  }
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3()
  return {
    data, bins, cellSize,
    triangle(i) { const n = i * 9; a.fromArray(data.values, n); b.fromArray(data.values, n + 3); c.fromArray(data.values, n + 6); return [a, b, c] },
    near(minimum, maximum, radius, visit) {
      const low = [0, 1, 2].map(axis => Math.floor((minimum[axis] - radius) / cellSize))
      const high = [0, 1, 2].map(axis => Math.floor((maximum[axis] + radius) / cellSize))
      const seen = new Set()
      for (let x = low[0]; x <= high[0]; x++) for (let y = low[1]; y <= high[1]; y++) for (let z = low[2]; z <= high[2]; z++) {
        for (const i of bins.get(x + ',' + y + ',' + z) ?? []) { if (seen.has(i)) continue; seen.add(i); if (visit(i) === false) return false }
      }
      return true
    },
  }
}
const edgeU = new THREE.Vector3(), edgeV = new THREE.Vector3(), edgeW = new THREE.Vector3()
function segmentDistanceSq(a, b, c, d) {
  edgeU.subVectors(b, a); edgeV.subVectors(d, c); edgeW.subVectors(a, c)
  const aa = edgeU.dot(edgeU), bb = edgeU.dot(edgeV), cc = edgeV.dot(edgeV), dd = edgeU.dot(edgeW), ee = edgeV.dot(edgeW)
  const clamp = x => Math.max(0, Math.min(1, x))
  let s = 0, t = 0
  if (aa < 1e-18) t = cc < 1e-18 ? 0 : clamp(ee / cc)
  else if (cc < 1e-18) s = clamp(-dd / aa)
  else {
    const determinant = aa * cc - bb * bb
    s = determinant < 1e-18 ? 0 : clamp((bb * ee - cc * dd) / determinant)
    t = (bb * s + ee) / cc
    if (t < 0) { t = 0; s = clamp(-dd / aa) } else if (t > 1) { t = 1; s = clamp((bb - dd) / aa) }
  }
  return edgeW.addScaledVector(edgeU, s).addScaledVector(edgeV, -t).lengthSq()
}
const ray = new THREE.Ray(), tri = new THREE.Triangle(), closest = new THREE.Vector3(), rayPoint = new THREE.Vector3(), direction = new THREE.Vector3()
function pointTriangleDistanceSq(point, a, b, c) {
  tri.set(a, b, c)
  return tri.closestPointToPoint(point, closest).distanceToSquared(point)
}
function segmentTriangleDistanceSq(start, end, a, b, c) {
  direction.subVectors(end, start)
  const lengthSq = direction.lengthSq()
  if (lengthSq > 1e-18) {
    ray.set(start, direction.normalize())
    if (ray.intersectTriangle(a, b, c, false, rayPoint) && rayPoint.distanceToSquared(start) <= lengthSq + 1e-12) return 0
  }
  tri.set(a, b, c)
  let distance = tri.closestPointToPoint(start, closest).distanceToSquared(start)
  distance = Math.min(distance, tri.closestPointToPoint(end, closest).distanceToSquared(end))
  return Math.min(distance, segmentDistanceSq(start, end, a, b), segmentDistanceSq(start, end, b, c), segmentDistanceSq(start, end, c, a))
}

const index = makeIndex(trianglesOf([...solidSets, ...restSets]), 1)

/** The closest triangle to a point, stopping at a limit. */
function ballClearance(centre, limit) {
  let best = limit * limit, mesh = null, triangleIndex = null
  const at = centre.toArray()
  index.near(at, at, limit, i => {
    const value = pointTriangleDistanceSq(centre, ...index.triangle(i))
    if (value < best) { best = value; mesh = index.data.names[i]; triangleIndex = i }
  })
  return { distance: Math.sqrt(best), mesh, triangle: triangleIndex }
}
function ballIsClear(centre, radius) {
  const at = centre.toArray()
  return index.near(at, at, radius, i => pointTriangleDistanceSq(centre, ...index.triangle(i)) >= radius * radius)
}
function segmentClearance(start, end, limit) {
  let best = limit * limit, mesh = null
  const minimum = [Math.min(start.x, end.x), Math.min(start.y, end.y), Math.min(start.z, end.z)]
  const maximum = [Math.max(start.x, end.x), Math.max(start.y, end.y), Math.max(start.z, end.z)]
  index.near(minimum, maximum, limit, i => {
    const value = segmentTriangleDistanceSq(start, end, ...index.triangle(i))
    if (value < best) { best = value; mesh = index.data.names[i] }
  })
  return { distance: Math.sqrt(best), mesh }
}

/* ---- the stations ---- */

const ids = vinciContent.map(station => station.id)
const families = []
for (const viewport of VIEWPORTS) {
  const seen = []
  for (const id of ids) {
    const pose = stationPose(id, viewport.phone)
    const known = seen.find(entry => entry.pose.eye.distanceToSquared(pose.eye) < 1e-18
      && entry.pose.at.distanceToSquared(pose.at) < 1e-18 && Math.abs(entry.pose.fov - pose.fov) < 1e-9)
    if (known) { known.stations.push(id); continue }
    const fov = fittedRailFov(pose.fov, viewport.aspect, viewport.phone)
    seen.push({ id, stations: [id], pose, fov, radius: railNearRectangleRadius(NEAR_M, fov, viewport.aspect) })
  }
  families.push({ viewport, seen })
}

/** Every orientation a visitor can hold at a station, proved continuously:
 * the sampled near pyramid plus the distance its corners can travel between
 * two samples. */
function orientedStationClearance(pose, fov, aspect, cornerRadius) {
  const base = new THREE.PerspectiveCamera(fov, aspect, NEAR_M, 100)
  base.position.copy(pose.eye); base.lookAt(pose.at)
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(base.quaternion)
  const heading = Math.atan2(-forward.x, -forward.z), elevation = Math.asin(Math.max(-1, Math.min(1, forward.y)))
  const half = NEAR_M * Math.tan(fov * Math.PI / 360)
  const local = [[-half * aspect, half], [half * aspect, half], [half * aspect, -half], [-half * aspect, -half]]
    .map(([x, y]) => new THREE.Vector3(x, y, -NEAR_M))
  const slack = cornerRadius * LOOK_STEP
  const euler = new THREE.Euler(0, 0, 0, 'YXZ'), quaternion = new THREE.Quaternion()
  const corners = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]
  let worst = Infinity, worstMesh = null, samples = 0
  const steps = (span, step) => Math.ceil(2 * span / step)
  for (let y = 0; y <= steps(LOOK_YAW, LOOK_STEP); y++) for (let p = 0; p <= steps(LOOK_PITCH, LOOK_STEP); p++) {
    const yaw = Math.max(-LOOK_YAW, Math.min(LOOK_YAW, -LOOK_YAW + y * LOOK_STEP))
    const pitch = Math.max(-LOOK_PITCH, Math.min(LOOK_PITCH, -LOOK_PITCH + p * LOOK_STEP))
    euler.set(elevation + pitch, heading + yaw, 0, 'YXZ'); quaternion.setFromEuler(euler)
    for (let i = 0; i < 4; i++) corners[i].copy(local[i]).applyQuaternion(quaternion).add(pose.eye)
    samples++
    for (let i = 0; i < 4; i++) {
      for (const [start, end] of [[pose.eye, corners[i]], [corners[i], corners[(i + 1) % 4]]]) {
        const reading = segmentClearance(start, end, Math.min(worst, cornerRadius))
        if (reading.distance < worst) { worst = reading.distance; worstMesh = reading.mesh }
      }
    }
  }
  return { minimumM: worst === Infinity ? cornerRadius : worst, mesh: worstMesh, orientations: samples, stepRadians: LOOK_STEP, travelBetweenSamplesM: slack, clear: worst > slack }
}

/* ---- the routes ---- */

const routes = [], readings = []
for (const { viewport, seen } of families) {
  for (const from of seen) for (const to of seen) {
    if (from === to) continue
    const chain = railWaypointsBetween(railSide(from.id), railSide(to.id))
    const enh = [[from.pose.eye.x, -from.pose.eye.z, from.pose.eye.y], ...chain.map(point => [...point]), [to.pose.eye.x, -to.pose.eye.z, to.pose.eye.y]]
    const points = enh.map(([east, north, height]) => new THREE.Vector3(east, height, -north))
    // The eye leaves the certified line by the step rhythm's own envelope, so
    // the envelope is inside the radius everything below is proved against.
    const clearance = Math.max(from.radius, to.radius) + (NO_GAIT ? 0 : gaitEnvelopeM)
    const balls = []
    const path = createCertifiedRailPath(points, {
      clearanceRadiusM: clearance, maxTrimM: .5, certificateDepth: 6, numericalMarginM: NUMERICAL_MARGIN_M,
      certifyBall(centre, radius) {
        if (!ballIsClear(centre, radius)) return false
        balls.push({ centre: [centre.x, centre.y, centre.z], radiusM: radius + BALL_RESERVE_M })
        return true
      },
    })
    // Only the balls that carried the accepted trim belong in the certificate;
    // a rejected trim's proofs certified a curve that is not on this path.
    const accepted = new Map()
    for (const ball of balls) accepted.set(ball.centre.join(','), ball)
    const trims = new Map(path.corners.filter(corner => corner.result === 'certified').map(corner => [corner.index, corner.acceptedTrimM]))
    const kept = []
    for (let i = 1; i < points.length - 1; i++) {
      const trim = trims.get(i)
      if (trim === undefined) continue
      const vertex = points[i]
      const incoming = vertex.clone().sub(points[i - 1]).normalize(), outgoing = points[i + 1].clone().sub(vertex).normalize()
      const a = vertex.clone().addScaledVector(incoming, -trim), b = vertex.clone().addScaledVector(outgoing, trim)
      collect(a, vertex.clone(), b, 6)
      function collect(x, control, z, remaining) {
        const centre = x.clone().add(control).add(z).multiplyScalar(1 / 3)
        const key = [centre.x, centre.y, centre.z].join(',')
        const ball = accepted.get(key)
        if (ball) { kept.push(ball); return }
        if (remaining === 0) throw new Error('A certified corner has no recorded ball')
        const left = x.clone().lerp(control, .5), right = control.clone().lerp(z, .5), middle = left.clone().lerp(right, .5)
        collect(x, left, middle, remaining - 1); collect(middle, right, z, remaining - 1)
      }
    }
    // Every unrounded span of the finished path, proved end to end.
    const spans = []
    let cursor = points[0]
    for (let i = 1; i < points.length - 1; i++) {
      const trim = trims.get(i)
      if (trim === undefined) { spans.push([cursor, points[i]]); cursor = points[i]; continue }
      const vertex = points[i]
      const incoming = vertex.clone().sub(points[i - 1]).normalize(), outgoing = points[i + 1].clone().sub(vertex).normalize()
      spans.push([cursor, vertex.clone().addScaledVector(incoming, -trim)])
      cursor = vertex.clone().addScaledVector(outgoing, trim)
    }
    spans.push([cursor, points.at(-1)])
    let worst = Infinity, worstMesh = null
    for (const [start, end] of spans) {
      if (start.distanceToSquared(end) < 1e-18) continue
      const reading = segmentClearance(start, end, Math.min(worst, clearance))
      if (reading.distance < worst) { worst = reading.distance; worstMesh = reading.mesh }
    }
    readings.push({
      viewport: viewport.name, from: from.id, to: to.id, lengthM: +path.length.toFixed(4),
      spanClearanceM: +(worst === Infinity ? clearance : worst).toFixed(4), spanMesh: worstMesh,
      requiredM: +clearance.toFixed(4), corners: path.corners.map(corner => corner.result),
      clear: worst > clearance - 1e-9 || worst === Infinity,
    })
    routes.push({
      viewport: viewport.name, from: from.id, to: to.id,
      fromPose: { eye: from.pose.eye.toArray(), at: from.pose.at.toArray(), fov: from.pose.fov },
      toPose: { eye: to.pose.eye.toArray(), at: to.pose.at.toArray(), fov: to.pose.fov },
      points: enh, roundedLength: path.length, maxNearRadius: clearance, certifiedBalls: kept,
    })
  }
}

/* ---- the station envelopes ---- */

const stationCones = []
for (const { viewport, seen } of families) {
  for (const family of seen) {
    const probe = ballClearance(family.pose.eye, family.radius + .05)
    const fullBall = probe.distance > family.radius
    const oriented = fullBall ? null : orientedStationClearance(family.pose, family.fov, viewport.aspect, family.radius)
    stationCones.push({
      viewport: viewport.name, id: family.id, stations: family.stations, fov: family.pose.fov, radius: family.radius,
      fullBall: { distance: probe.distance, mesh: probe.mesh, triangle: probe.triangle },
      clearAtEveryOrientation: fullBall,
      ...(oriented ? { oriented } : {}),
    })
  }
}

/* ---- the file ---- */

const arrivalEN = Object.fromEntries(families.map(({ viewport, seen }) => {
  const arrival = seen.find(family => family.id === 'arrival')
  return [viewport.name, [arrival.pose.eye.x, -arrival.pose.eye.z, arrival.pose.eye.y]]
}))
const recipeSha256 = createHash('sha256').update(fs.readFileSync(path.join(ROOT, RECIPE))).digest('hex')
const certificate = {
  format: 'vinci-rail-clearance-v1',
  completeNearClearance: true,
  recipe: RECIPE,
  recipeSha256,
  sources: sources.map(source => ({ ...source, unchangedDuringAudit: true })).sort((a, b) => a.file < b.file ? -1 : 1),
  geometrySha256,
  geometry,
  coordinateFrame: 'points ENH; poses and balls Three XYZ',
  scope: 'Actual mounted foundation-bearing shell, gate passage, inner court, collection, collection access, entry passage, whole ground, water, vegetation, every spatially partitioned road/ground dressing triangle, the fixed plinths and bases under the exhibits, and every machine in the pose its own schedule holds at t=0. Union of every tier; a tier is accepted by equal actual geometry fingerprint.',
  limits: [
    'No eyes, renderer, shader or browser input test. This certificate is regenerated against actual currently mounted factory geometry.',
    'DOM plates, atmosphere and shadow-only caster copies are excluded; all actual visible mesh solids including leaves and dressing are included.',
    'Every machine stands in its rest pose for the whole walk, and its actual rest geometry at every tier is proved against every route and every station envelope here. A machine is built as the visitor walks up to it, so it is not a mounted mesh when the runtime hashes the scene and is not part of the geometry fingerprint; the placement table it is certified from is hashed in the sources above.',
    `The ${NEAR_M} m near distance, both authored viewport aspect ratios and the authored endpoint FOV are used. The authored aspect gives the largest near rectangle, so a wider or narrower canvas is inside it.`,
    `Every straight span of the finished path is proved end to end by exact segment/triangle distance; every rounded corner is proved by closed balls over its control hull, and those balls are what the runtime replays. Stored balls reserve ${BALL_RESERVE_M * 1e6} µm beyond the requested radius; runtime matching of quantized geometry consumes at most ${GEOMETRY_TOLERANCE_M * 1e6} µm of it.`,
    `The walk carries a step rhythm of at most ${(gaitEnvelopeM * 1000).toFixed(2)} mm off the certified line, and that envelope is added to the clearance radius every span and every corner above is proved against.`,
    `A station whose full near ball is not clear carries an oriented certificate instead: its near pyramid is proved over the whole ±${LOOK_YAW} rad yaw and ±${LOOK_PITCH} rad pitch look envelope, sampled every ${LOOK_STEP} rad, with the distance a corner can travel between two samples subtracted from the measured margin.`,
  ],
  arrivalEN,
  core: railTerraceWaypoints.map(point => [...point]),
  gate: railGateWaypoints.map(point => [...point]),
  gardenBranches: Object.fromEntries(families.map(({ viewport, seen }) => {
    const garden = seen.find(family => family.stations.includes('garden'))
    return [viewport.name, [[garden.pose.eye.x, -garden.pose.eye.z, garden.pose.eye.y]]]
  })),
  stationCones,
  routes,
}

const failures = []
for (const reading of readings) if (!reading.clear) failures.push(`${reading.viewport} ${reading.from} to ${reading.to}: a span passes within ${reading.spanClearanceM} m of ${reading.spanMesh}, under the ${reading.requiredM} m envelope`)
for (const cone of stationCones) {
  if (cone.clearAtEveryOrientation) continue
  // A station whose near envelope is not clear at every orientation is a
  // station standing too close to a wall. The oriented reading below says how
  // close; it is a diagnosis for whoever moves the pose, never a pass.
  failures.push(`${cone.viewport} ${cone.id}: the eye stands ${cone.fullBall.distance.toFixed(4)} m from ${cone.fullBall.mesh}, inside its own ${cone.radius.toFixed(4)} m near envelope; the near plane itself misses by ${cone.oriented.minimumM.toFixed(4)} m over the look envelope`)
}
// Every ordered pair of distinct station poses, both viewports: a visitor can
// press any mark on the rail, so any pair is a route the walk may be asked for.
const expectedRoutes = families.reduce((sum, family) => sum + family.seen.length * (family.seen.length - 1), 0)
if (routes.length !== expectedRoutes) failures.push(`Expected ${expectedRoutes} directed routes, certified ${routes.length}`)

const text = JSON.stringify(certificate, null, 1) + '\n'
const previous = fs.existsSync(CERTIFICATE) ? fs.readFileSync(CERTIFICATE, 'utf8') : ''
const previousCertificate = previous ? JSON.parse(previous) : null
const sameGeometry = previousCertificate ? JSON.stringify(previousCertificate.geometrySha256) === JSON.stringify(geometrySha256) : false
const samePoints = previousCertificate ? JSON.stringify(previousCertificate.routes.map(route => [route.viewport, route.from, route.to, route.points, route.roundedLength]))
  === JSON.stringify(routes.map(route => [route.viewport, route.from, route.to, route.points, route.roundedLength])) : false

if (args.has('--dump')) fs.writeFileSync(path.join(ROOT, 'forge/scratch/candidate.json'), text)
if (VERIFY) {
  if (!sameGeometry) failures.push('The certificate on disk does not carry the geometry hash the mounted factories produce')
  if (!samePoints) failures.push('The certificate on disk does not carry the routes the current poses produce')
} else if (!failures.length) {
  fs.writeFileSync(CERTIFICATE, text)
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'))
  const entry = manifest.assets.find(asset => asset.id === 'vinci/rail-clearance')
  if (!entry) failures.push('The manifest has no vinci/rail-clearance record')
  else {
    entry.sha256 = createHash('sha256').update(fs.readFileSync(CERTIFICATE)).digest('hex')
    entry.note = entry.note.replace(/source_generator=[^;\s]+/, 'source_generator=' + RECIPE)
    fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n')
  }
}

const report = {
  checker: 'vinci-rail-certify',
  mode: VERIFY ? 'verify' : 'write',
  geometrySha256, geometry,
  gaitEnvelopeM: +gaitEnvelopeM.toFixed(6),
  routes: routes.length,
  triangles: index.data.count,
  sameGeometryAsDisk: sameGeometry, sameRoutesAsDisk: samePoints,
  worstSpanClearance: readings.reduce((worst, reading) => reading.spanClearanceM < worst.spanClearanceM ? reading : worst, readings[0]),
  stationCones: stationCones.map(cone => ({ viewport: cone.viewport, id: cone.id, radius: +cone.radius.toFixed(4), fullBallM: +cone.fullBall.distance.toFixed(4), oriented: cone.oriented ? { minimumM: +cone.oriented.minimumM.toFixed(4), travelM: +cone.oriented.travelBetweenSamplesM.toFixed(5), orientations: cone.oriented.orientations, clear: cone.oriented.clear } : null })),
  ...(args.has('--json') ? { readings } : {}),
  ok: failures.length === 0,
  failures,
}
console.log(JSON.stringify(report, null, 2))
process.exitCode = failures.length ? 1 : 0
