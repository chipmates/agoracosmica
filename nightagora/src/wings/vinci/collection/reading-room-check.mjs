#!/usr/bin/env node
/** Audit the reading room against every certified way through the wing.
 *   node src/wings/vinci/collection/reading-room-check.mjs
 * The room is furniture raised after the rail reads the scene, so it stands
 * outside the construction fingerprint. This supplement builds the room's own
 * plan, every box of it, and proves each clear of every certified route and
 * approach span, every leg and wall run at its saved near and gait envelope,
 * every recorded corner ball, and every station and viewing eye's own near
 * envelope. A control box stood across the walk to the hall door must fail.
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

const plan = await load(path.join(HERE, 'reading-room-plan.ts'))
const { FACE } = await load(path.join(HERE, 'layout.ts'))
const FACE_WEST = FACE.hallPartitionEast
const certificate = JSON.parse(fs.readFileSync(path.join(HERE, '../data/rail-clearance.json'), 'utf8'))
/** a hair over the saved envelope, so a box that only grazes it is refused */
const MARGIN_M = .02

/** a box [west, south, bottom, east, north, top] as twelve triangles in three's frame */
function triangles([w, s, b, e, n, t]) {
  const v = (x, y, z) => new THREE.Vector3(x, y, z)
  const c = [v(w, b, -n), v(e, b, -n), v(e, b, -s), v(w, b, -s), v(w, t, -n), v(e, t, -n), v(e, t, -s), v(w, t, -s)]
  const faces = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [3, 2, 6, 7], [0, 3, 7, 4], [1, 2, 6, 5]]
  return faces.flatMap(([a, bb, cc, d]) => [[c[a], c[bb], c[cc]], [c[a], c[cc], c[d]]])
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
const pointBoxDistance = (p, box) => new THREE.Box3(new THREE.Vector3(box[0], box[2], -box[4]), new THREE.Vector3(box[3], box[5], -box[1])).distanceToPoint(p)

function audit(solids) {
  const boxes = solids.map(solid => ({ ...solid, tris: triangles(solid.box),
    aabb: new THREE.Box3(new THREE.Vector3(solid.box[0], solid.box[2], -solid.box[4]), new THREE.Vector3(solid.box[3], solid.box[5], -solid.box[1])) }))
  let spans = 0, balls = 0, eyes = 0, worst = null
  const failures = []
  const note = (kind, label, solid, clearance, required) => {
    const margin = clearance - required
    if (!worst || margin < worst.marginM) worst = { kind, label, solid, clearanceM: +clearance.toFixed(4), requiredM: +required.toFixed(4), marginM: +margin.toFixed(4) }
    if (margin < MARGIN_M) failures.push(`${kind} ${label}: ${solid} stands ${clearance.toFixed(4)} m off, inside ${required.toFixed(4)} m and the ${MARGIN_M} m margin`)
  }
  const runs = [
    ...certificate.routes.map(r => ({ kind: 'route', label: `${r.viewport} ${r.from} to ${r.to}`, entry: r })),
    ...(certificate.approaches ?? []).map(r => ({ kind: 'approach', label: `${r.viewport} ${r.station} to ${r.exhibit}`, entry: r })),
    ...(certificate.links ?? []).map(r => ({ kind: 'leg', label: `${r.viewport} ${r.from} to ${r.to}`, entry: r })),
    ...(certificate.walls ?? []).map(r => ({ kind: 'wall', label: `${r.viewport} ${r.id}`, entry: r })),
  ]
  for (const { kind, label, entry } of runs) {
    const points = entry.points.map(([east, north, height]) => new THREE.Vector3(east, height, -north))
    for (let i = 1; i < points.length; i++) {
      spans++
      const reach = entry.maxNearRadius + MARGIN_M + .5
      const span = new THREE.Box3().setFromPoints([points[i - 1], points[i]]).expandByScalar(reach)
      for (const box of boxes) {
        if (!span.intersectsBox(box.aabb)) continue
        const clearance = Math.min(...box.tris.map(tri => segmentTriangleDistance(points[i - 1], points[i], tri)))
        note(kind, `${label} span ${i - 1}`, box.name, clearance, entry.maxNearRadius)
      }
    }
    for (const ball of entry.certifiedBalls ?? []) {
      balls++
      const centre = new THREE.Vector3().fromArray(ball.centre)
      for (const box of boxes) note(`${kind} ball`, label, box.name, pointBoxDistance(centre, box.box), ball.radiusM)
    }
  }
  // every station's eye, at its own near envelope, and every viewing eye
  const stationEyes = new Map()
  for (const route of certificate.routes) for (const [id, pose] of [[route.from, route.fromPose], [route.to, route.toPose]])
    stationEyes.set(`${route.viewport} ${id}`, pose.eye)
  for (const cone of certificate.stationCones ?? []) {
    for (const station of cone.stations ?? [cone.id]) {
      const eye = stationEyes.get(`${cone.viewport} ${station}`)
      if (!eye) continue
      eyes++
      for (const box of boxes) note('station eye', `${cone.viewport} ${station}`, box.name, pointBoxDistance(new THREE.Vector3().fromArray(eye), box.box), cone.radius)
    }
  }
  for (const approach of certificate.approaches ?? []) {
    eyes++
    for (const box of boxes) note('viewing eye', `${approach.viewport} ${approach.exhibit}`, box.name, pointBoxDistance(new THREE.Vector3().fromArray(approach.toPose.eye), box.box), approach.maxNearRadius)
  }
  return { solids: boxes.length, spans, balls, eyes, worst, failures }
}

const solids = plan.readingRoomSolids()
const room = audit(solids)
// THE CONTROL: a post stood on the walk from the reading table to the hall
// door, where a refusal is certain, proves the audit can see.
const control = audit([{ name: 'control-post', box: [-35.75, -45.0, -6.3, -35.6, -44.85, -3.8] }])
// THE CHAIR STANDS AS A CHAIR PUSHED IN: no part of it inside the table's
// top and every part that rises past the top a finger clear of its edge, the
// seat run on under the top, four legs on the room's floor.
const top = plan.TABLE_TOP, chairBoxes = plan.chairParts().boxes
const overlaps = (a, b) => a[0] < b[3] && a[3] > b[0] && a[1] < b[4] && a[4] > b[1] && a[2] < b[5] && a[5] > b[2]
const chairFailures = []
let edgeGap = Infinity
chairBoxes.forEach((box, i) => {
  if (overlaps(box, top)) chairFailures.push(`chair-${i} stands inside the table's top`)
  if (box[5] > top[2] && box[1] < top[4] && box[4] > top[1]) edgeGap = Math.min(edgeGap, box[0] - top[3])
})
if (edgeGap < .008) chairFailures.push(`the chair's back stands ${edgeGap.toFixed(4)} m off the top's edge, under 0.008 m`)
const floorLevel = plan.READING_ROOM.floor, onFloor = chairBoxes.filter(box => Math.abs(box[2] - floorLevel) < 1e-6).length
if (onFloor !== 4) chairFailures.push(`${onFloor} chair legs stand on the floor, not 4`)
const seat = chairBoxes.find(box => Math.abs(box[2] - (floorLevel + plan.READING_CHAIR.seat)) < 1e-6)
const seatUnder = seat ? +(top[3] - seat[0]).toFixed(4) : null
if (!seat || seat[5] >= top[2] || seatUnder < .2) chairFailures.push('the seat does not run on under the table top')
// THE BODY'S OWN TRIANGLES. The boxes above are the room's declared solids;
// here every triangle the room's batches actually build is held to the
// footprint and, near the room, to every certified envelope, so a moulding
// that runs past its box cannot pass unseen.
const body = plan.studioloParts()
const R = plan.READING_ROOM
const tris = []
for (const batch of [body.inside, body.outside, body.ceiling, body.dark, body.bronze]) {
  const pos = batch.geometry().getAttribute('position')
  for (let i = 0; i + 2 < pos.count; i += 3) tris.push([0, 1, 2].map(k => new THREE.Vector3(pos.getX(i + k), pos.getY(i + k), pos.getZ(i + k))))
}
const mesh = { triangles: tris.length, outside: 0, near: 0, worst: null }
const meshFailures = []
const lo = new THREE.Vector3(FACE_WEST - .006, R.floor - .1, -R.north), hi = new THREE.Vector3(R.front + 1e-4, R.top + 1e-4, -R.south)
for (const t of tris) for (const v of t) if (v.x < lo.x || v.x > hi.x || v.z < lo.z - 1e-4 || v.z > hi.z + 1e-4 || v.y > hi.y) mesh.outside++
if (mesh.outside) meshFailures.push(`${mesh.outside} vertices of the room's body stand outside its footprint`)
const roomBox = new THREE.Box3(new THREE.Vector3(lo.x, lo.y, lo.z), new THREE.Vector3(hi.x, hi.y, hi.z))
const triBoxes = tris.map(t => new THREE.Box3().setFromPoints(t))
const noteMesh = (label, clearance, required) => {
  const margin = clearance - required
  if (!mesh.worst || margin < mesh.worst.marginM) mesh.worst = { label, clearanceM: +clearance.toFixed(4), requiredM: +required.toFixed(4), marginM: +margin.toFixed(4) }
  if (margin < MARGIN_M) meshFailures.push(`${label}: the body's mesh stands ${clearance.toFixed(4)} m off, inside ${required.toFixed(4)} m and the ${MARGIN_M} m margin`)
}
const allRuns = [...certificate.routes, ...(certificate.approaches ?? []), ...(certificate.links ?? []), ...(certificate.walls ?? [])]
for (const entry of allRuns) {
  const points = entry.points.map(([east, north, height]) => new THREE.Vector3(east, height, -north))
  const reach = entry.maxNearRadius + MARGIN_M
  for (let i = 1; i < points.length; i++) {
    const span = new THREE.Box3().setFromPoints([points[i - 1], points[i]]).expandByScalar(reach)
    if (!span.intersectsBox(roomBox)) continue
    let best = Infinity
    tris.forEach((t, k) => { if (span.intersectsBox(triBoxes[k])) best = Math.min(best, segmentTriangleDistance(points[i - 1], points[i], t)) })
    if (best < Infinity) { mesh.near++; noteMesh(`${entry.viewport} ${entry.from ?? entry.station ?? entry.id} to ${entry.to ?? entry.exhibit ?? ''} span ${i - 1}`, best, entry.maxNearRadius) }
  }
  for (const ball of entry.certifiedBalls ?? []) {
    const centre = new THREE.Vector3().fromArray(ball.centre)
    const reachBox = new THREE.Box3().setFromCenterAndSize(centre, new THREE.Vector3(1, 1, 1).multiplyScalar(2 * (ball.radiusM + MARGIN_M)))
    if (!reachBox.intersectsBox(roomBox)) continue
    let best = Infinity
    tris.forEach((t, k) => { if (reachBox.intersectsBox(triBoxes[k])) best = Math.min(best, segmentTriangleDistance(centre, centre, t)) })
    if (best < Infinity) { mesh.near++; noteMesh(`ball of ${entry.viewport} ${entry.from ?? entry.station ?? entry.id}`, best, ball.radiusM) }
  }
}
for (const approach of certificate.approaches ?? []) {
  const eye = new THREE.Vector3().fromArray(approach.toPose.eye)
  const reachBox = new THREE.Box3().setFromCenterAndSize(eye, new THREE.Vector3(1, 1, 1).multiplyScalar(2 * (approach.maxNearRadius + MARGIN_M)))
  if (!reachBox.intersectsBox(roomBox)) continue
  let best = Infinity
  tris.forEach((t, k) => { if (reachBox.intersectsBox(triBoxes[k])) best = Math.min(best, segmentTriangleDistance(eye, eye, t)) })
  if (best < Infinity) { mesh.near++; noteMesh(`viewing eye ${approach.viewport} ${approach.exhibit}`, best, approach.maxNearRadius) }
}
const failures = [...room.failures, ...chairFailures, ...meshFailures]
if (control.failures.length === 0) failures.push('The control post on the walk to the hall door was not refused')
const bounds = solids.reduce((b, { box }) => [Math.min(b[0], box[0]), Math.min(b[1], box[1]), Math.min(b[2], box[2]), Math.max(b[3], box[3]), Math.max(b[4], box[4]), Math.max(b[5], box[5])], [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity])
console.log(JSON.stringify({ checker: 'vinci-collection-reading-room', ok: failures.length === 0,
  scope: 'The reading room plan as the runtime builds it: the studiolo plinth, walls, doorway, window, panelling, coffered ceiling and corniced lid as declared solids and as its own triangles, the bookcase and its volumes, the pendant and its cord, the chair, and the chair pushed in against the table top. Every certificate route, approach, leg and wall span at its saved near and gait envelope plus a margin, every recorded corner ball, every station eye and viewing eye at its own near radius. The room stands outside the rail construction fingerprint.',
  marginM: MARGIN_M, bounds, room: { ...room, failures: room.failures.slice(0, 12) },
  control: { failures: control.failures.length, worst: control.worst },
  chair: { edgeGapM: +edgeGap.toFixed(4), seatUnderTopM: seatUnder, legsOnFloor: onFloor, failures: chairFailures },
  mesh: { ...mesh, failures: meshFailures.slice(0, 12) }, failures: failures.slice(0, 20) }, null, 2))
process.exitCode = failures.length ? 1 : 0
