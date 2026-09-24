#!/usr/bin/env node
/** Audit the supper room against every certified way through the wing.
 *   node src/wings/vinci/collection/supper-room-check.mjs
 * The room is raised after the rail reads the scene, so it stands outside the
 * construction fingerprint. This supplement builds the room's own plan, every
 * triangle of every body the runtime builds from it, and proves each clear of
 * every certified route and approach span, every leg and wall run at its
 * saved near and gait envelope, every recorded corner ball, and every station
 * and viewing eye's own near envelope. A control post stood on the walk from
 * the station into the court must fail. It also holds the room to the
 * court's machines it was sized around: the parachute's cloth and the crane's
 * swept bound stay outside every body of it.
 */
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import * as THREE from 'three/webgpu'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const modules = new Map()
async function load(file) {
  if (modules.has(file)) return modules.get(file)
  const exports = {}
  modules.set(file, exports)
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const dependencies = new Map()
  for (const [, name] of code.matchAll(/\brequire\(["']([^"']+)["']\)/g)) {
    if (dependencies.has(name)) continue
    if (name.startsWith('.')) {
      const target = path.resolve(path.dirname(file), name.replace(/\?raw$/, ''))
      dependencies.set(name, name.endsWith('?raw') ? { default: fs.readFileSync(target, 'utf8') } : await load(target + '.ts'))
    } else if (/^three(?:\/|$)/.test(name)) dependencies.set(name, await import(name))
    else throw new Error('Unexpected runtime dependency: ' + name)
  }
  new vm.Script(code, { filename: file }).runInNewContext({
    exports, require: name => dependencies.get(name), Float32Array, performance,
    crypto: globalThis.crypto, TextEncoder: globalThis.TextEncoder, console, matchMedia: () => ({ matches: false }),
  }, { timeout: 20000 })
  return exports
}

const plan = await load(path.join(HERE, 'supper-room-plan.ts'))
const stands = await load(path.join(HERE, 'stands.ts'))
const certificate = JSON.parse(fs.readFileSync(path.join(HERE, '../data/rail-clearance.json'), 'utf8'))
/** a hair over the saved envelope, so a face that only grazes it is refused */
const MARGIN_M = .02

/** every body's triangles, in three's frame */
function trianglesOf(bodies) {
  const out = []
  for (const [name, body] of Object.entries(bodies)) {
    const p = body.positions()
    for (let i = 0; i + 8 < p.length; i += 9) out.push({ name, tri: [
      new THREE.Vector3(p[i], p[i + 1], p[i + 2]), new THREE.Vector3(p[i + 3], p[i + 4], p[i + 5]), new THREE.Vector3(p[i + 6], p[i + 7], p[i + 8])] })
  }
  for (const t of out) t.box = new THREE.Box3().setFromPoints(t.tri)
  return out
}
const clamp = value => Math.max(0, Math.min(1, value))
function segmentDistanceSquared(a, b, c, d) {
  const u = b.clone().sub(a), v = d.clone().sub(c), w = a.clone().sub(c)
  const aa = u.dot(u), bb = u.dot(v), cc = v.dot(v), dd = u.dot(w), ee = v.dot(w)
  let s = 0, t = 0
  if (aa < 1e-18) t = cc < 1e-18 ? 0 : clamp(ee / cc)
  else if (cc < 1e-18) s = clamp(-dd / aa)
  else {
    const determinant = aa * cc - bb * bb
    s = determinant < 1e-18 ? 0 : clamp((bb * ee - cc * dd) / determinant)
    t = (bb * s + ee) / cc
    if (t < 0) { t = 0; s = clamp(-dd / aa) }
    else if (t > 1) { t = 1; s = clamp((bb - dd) / aa) }
  }
  return w.addScaledVector(u, s).addScaledVector(v, -t).lengthSq()
}
function segmentTriangleDistance(start, end, [a, b, c]) {
  const direction = end.clone().sub(start), lengthSquared = direction.lengthSq()
  if (lengthSquared > 1e-18) {
    const hit = new THREE.Ray(start, direction.clone().normalize()).intersectTriangle(a, b, c, false, new THREE.Vector3())
    if (hit && hit.distanceToSquared(start) <= lengthSquared + 1e-12) return 0
  }
  const triangle = new THREE.Triangle(a, b, c), closest = new THREE.Vector3()
  return Math.sqrt(Math.min(
    triangle.closestPointToPoint(start, closest).distanceToSquared(start),
    triangle.closestPointToPoint(end, closest).distanceToSquared(end),
    segmentDistanceSquared(start, end, a, b), segmentDistanceSquared(start, end, b, c), segmentDistanceSquared(start, end, c, a),
  ))
}
const pointTriangleDistance = (p, [a, b, c]) => new THREE.Triangle(a, b, c).closestPointToPoint(p, new THREE.Vector3()).distanceTo(p)

function audit(tris) {
  let spans = 0, balls = 0, eyes = 0, worst = null
  const failures = []
  const note = (kind, label, solid, clearance, required) => {
    const margin = clearance - required
    if (!worst || margin < worst.marginM) worst = { kind, label, solid, clearanceM: +clearance.toFixed(4), requiredM: +required.toFixed(4), marginM: +margin.toFixed(4) }
    if (margin < MARGIN_M) failures.push(`${kind} ${label}: ${solid} stands ${clearance.toFixed(4)} m off, inside ${required.toFixed(4)} m and the ${MARGIN_M} m margin`)
  }
  const nearest = (box, reach, measure) => {
    let best = Infinity, name = null
    for (const t of tris) {
      if (!box.intersectsBox(t.box.clone().expandByScalar(reach))) continue
      const d = measure(t.tri)
      if (d < best) { best = d; name = t.name }
    }
    return { best, name }
  }
  const runs = [
    ...certificate.routes.map(r => ({ kind: 'route', label: `${r.viewport} ${r.from} to ${r.to}`, entry: r })),
    ...(certificate.approaches ?? []).map(r => ({ kind: 'approach', label: `${r.viewport} ${r.station} to ${r.exhibit}`, entry: r })),
    ...(certificate.links ?? []).map(r => ({ kind: 'leg', label: `${r.viewport} ${r.from} to ${r.to}`, entry: r })),
    ...(certificate.walls ?? []).map(r => ({ kind: 'wall', label: `${r.viewport} ${r.id}`, entry: r })),
  ]
  for (const { kind, label, entry } of runs) {
    const points = entry.points.map(([east, north, height]) => new THREE.Vector3(east, height, -north))
    const reach = entry.maxNearRadius + MARGIN_M + .5
    for (let i = 1; i < points.length; i++) {
      spans++
      const span = new THREE.Box3().setFromPoints([points[i - 1], points[i]])
      const { best, name } = nearest(span, reach, tri => segmentTriangleDistance(points[i - 1], points[i], tri))
      if (name) note(kind, `${label} span ${i - 1}`, name, best, entry.maxNearRadius)
    }
    for (const ball of entry.certifiedBalls ?? []) {
      balls++
      const centre = new THREE.Vector3().fromArray(ball.centre)
      const { best, name } = nearest(new THREE.Box3(centre, centre), ball.radiusM + MARGIN_M + .5, tri => pointTriangleDistance(centre, tri))
      if (name) note(`${kind} ball`, label, name, best, ball.radiusM)
    }
  }
  const stationEyes = new Map()
  for (const route of certificate.routes) for (const [id, pose] of [[route.from, route.fromPose], [route.to, route.toPose]])
    stationEyes.set(`${route.viewport} ${id}`, pose.eye)
  for (const cone of certificate.stationCones ?? []) {
    for (const station of cone.stations ?? [cone.id]) {
      const eye = stationEyes.get(`${cone.viewport} ${station}`)
      if (!eye) continue
      eyes++
      const at = new THREE.Vector3().fromArray(eye)
      const { best, name } = nearest(new THREE.Box3(at, at), cone.radius + MARGIN_M + .5, tri => pointTriangleDistance(at, tri))
      if (name) note('station eye', `${cone.viewport} ${station}`, name, best, cone.radius)
    }
  }
  for (const approach of certificate.approaches ?? []) {
    eyes++
    const at = new THREE.Vector3().fromArray(approach.toPose.eye)
    const { best, name } = nearest(new THREE.Box3(at, at), approach.maxNearRadius + MARGIN_M + .5, tri => pointTriangleDistance(at, tri))
    if (name) note('viewing eye', `${approach.viewport} ${approach.exhibit}`, name, best, approach.maxNearRadius)
  }
  return { triangles: tris.length, spans, balls, eyes, worst, failures }
}

const bodies = plan.supperRoomBodies()
const tris = trianglesOf(bodies)
const room = audit(tris)
// THE CONTROL: a post on the walk from the station eye to the court's east
// edge, where a refusal is certain, proves the audit can see.
const post = new plan.Body()
post.box([-33.0, -29.6, -6.44, -32.9, -29.4, -3.5])
const control = audit(trianglesOf({ 'control-post': post }))
const failures = [...room.failures]
if (control.failures.length === 0) failures.push('The control post on the walk out of the station was not refused')

// THE MACHINES THE ROOM WAS SIZED AROUND: the parachute's cloth and the
// crane's swept bound stand outside every body of the room
const machineFailures = []
const cloth = stands.parachuteCloth()
const clothTris = []
for (let i = 0; i < 4; i++) {
  const a = cloth.corners[i], b = cloth.corners[(i + 1) % 4]
  clothTris.push([a, b, cloth.top].map(([e, n, h]) => new THREE.Vector3(e, h, -n)))
}
let clothClear = Infinity
for (const t of tris) for (const c of clothTris) {
  for (const p of t.tri) clothClear = Math.min(clothClear, pointTriangleDistance(p, c))
  for (const p of c) clothClear = Math.min(clothClear, pointTriangleDistance(p, t.tri))
}
if (clothClear < .15) machineFailures.push(`the room stands ${clothClear.toFixed(3)} m from the parachute's cloth`)
const crane = stands.standOf('revolving-crane')
const craneBox = new THREE.Box3(new THREE.Vector3(crane.east - 1.85, -6.44, -(crane.north + 1.85)), new THREE.Vector3(crane.east + 1.85, -6.44 + 2.9, -(crane.north - 1.85)))
const craneHit = tris.filter(t => t.box.intersectsBox(craneBox)).map(t => t.name)
if (craneHit.length) machineFailures.push(`the room enters the crane's swept bound: ${[...new Set(craneHit)].join(', ')}`)
failures.push(...machineFailures)

const bounds = new THREE.Box3()
for (const t of tris) bounds.union(t.box)
console.log(JSON.stringify({ checker: 'vinci-collection-supper-room', ok: failures.length === 0,
  scope: 'The supper room as the runtime builds it: the end wall\'s plaster and reveal, the wall over the coping, the south wall, the bay\'s and the nave\'s roofs, the step, the top light\'s well, diffuser and glass, the north lintel and wall, the east wall and its door, the fins, the floor, the sill\'s dress and the roofs\' copings; every triangle of each. Every certificate route, approach, leg and wall span at its saved near and gait envelope plus a margin, every recorded corner ball, every station eye and viewing eye at its own near radius; the parachute\'s cloth and the crane\'s swept bound kept outside the room. The room stands outside the rail construction fingerprint.',
  marginM: MARGIN_M,
  bounds: { east: [+bounds.min.x.toFixed(3), +bounds.max.x.toFixed(3)], north: [+(-bounds.max.z).toFixed(3), +(-bounds.min.z).toFixed(3)], height: [+bounds.min.y.toFixed(3), +bounds.max.y.toFixed(3)] },
  room: { ...room, failures: room.failures.slice(0, 12) }, clothClearanceM: +clothClear.toFixed(3),
  control: { failures: control.failures.length, worst: control.worst }, failures: failures.slice(0, 20) }, null, 2))
process.exitCode = failures.length ? 1 : 0
