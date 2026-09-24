#!/usr/bin/env node
/** Audit the picture room against every certified way through the wing, and
 * its hang against the construction it is laid over.
 *   node src/wings/vinci/collection/picture-room-check.mjs
 * The room's frames, benches, frieze, bulkhead, door surrounds and fittings
 * are raised after the rail reads the scene, so they stand outside the
 * construction fingerprint. This supplement builds the room's own plan,
 * every solid of it, and proves each clear of every certified route and
 * approach span, every leg and wall run at its saved near and gait envelope,
 * every recorded corner ball, and every station and viewing eye's own near
 * envelope. A control post stood on the walk down the room must fail. It
 * then proves the frames: each section clears the construction's moulding on
 * every side, no frame covers a canvas, no two frames touch, every work has
 * its head on the track.
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

const plan = await load(path.join(HERE, 'picture-room-plan.ts'))
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

const solids = plan.pictureRoomSolids()
const room = audit(solids)
// THE CONTROL: a post on the walk down the room, between its two end
// stations, where a refusal is certain, proves the audit can see.
const control = audit([{ name: 'control-post', box: [-42.1, -38.3, -6.3, -41.9, -38.1, -3.8] }])
const failures = [...room.failures]
if (control.failures.length === 0) failures.push('The control post on the walk down the picture room was not refused')

// THE FRAMES, against the construction's own moulding: 80 mm wide, from
// 12 to 74 mm off the lining, its lip inside that; the pale field from 0
// to 16 mm. Every point of the section over the moulding stands a bed clear.
const BED = .002, MOULDING = .08, MOULD_BACK = .012, MOULD_FRONT = .074
for (const { style, points: section, seat } of Object.values(plan.SECTIONS)) {
  const outerR = Math.max(...section.map(p => p.r))
  if (outerR < MOULDING + BED) failures.push(`the ${style} frame's side stands ${outerR} m out, inside the moulding's 0.08 m and a bed`)
  for (let i = 0; i + 1 < section.length; i++) {
    const a = section[i], b = section[i + 1]
    // a face over the moulding's run (0 < r < 0.08) must stand in front of it
    for (const t of [0, .25, .5, .75, 1]) {
      const r = a.r + (b.r - a.r) * t, z = a.z + (b.z - a.z) * t
      if (r > 1e-6 && r < MOULDING + BED && z < MOULD_FRONT + BED) failures.push(`${style} section point ${r.toFixed(4)}, ${z.toFixed(4)} lies inside the construction's moulding`)
    }
  }
  const back = Math.min(...section.filter(p => p.r >= outerR - 1e-9).map(p => p.z))
  if (back > MOULD_BACK - .0005) failures.push(`the ${style} frame's back at ${back} m does not reach behind the moulding's back`)
  if (section.some(p => p.r < 0)) failures.push(`a ${style} section reaches over its canvas`)
  // the number is cast on a flat: the section stands level under the figure
  const under = section.filter(p => p.r >= seat.r - seat.figure / 2 - 1e-9 && p.r <= seat.r + seat.figure / 2 + 1e-9)
  const flat = section.some((p, i) => i + 1 < section.length && p.r <= seat.r - seat.figure / 2 + 1e-9
    && section[i + 1].r >= seat.r + seat.figure / 2 - 1e-9 && Math.abs(p.z - seat.z) < 1e-9 && Math.abs(section[i + 1].z - seat.z) < 1e-9)
  if (!flat || under.some(p => Math.abs(p.z - seat.z) > 1e-9)) failures.push(`the ${style} number's seat is not a flat of its section`)
}
if (!(plan.CANVAS_Z >= MOULD_FRONT + BED - 1e-9)) failures.push(`the canvas at ${plan.CANVAS_Z} m stands inside the construction's moulding`)
if (!(plan.CANVAS_Z < plan.SLIP_Z)) failures.push('the canvas stands in front of its own slip')
if (!(plan.WALL_FACE + plan.CANVAS_Z < plan.ROOM.finish + .1)) failures.push('the canvas stands off its wall')
if (!(plan.ROOM.finish - plan.WALL_FACE >= .012 + BED / 2 - 1e-9)) failures.push('the plaster does not cover the construction\'s hangers')
const frames = plan.hangFrames()
if (frames.length !== 25) failures.push(`the hang holds ${frames.length} frames, not 25`)
for (let i = 1; i < frames.length; i++) {
  const gap = frames[i - 1].outer.west - frames[i].outer.east
  if (gap < .2) failures.push(`${frames[i - 1].key} and ${frames[i].key} stand ${gap.toFixed(3)} m apart`)
}
// THE NUMBERS: one to twenty five in the hang's order, each on its own rail
frames.forEach((f, i) => {
  if (f.number !== i + 1) failures.push(`${f.key} carries the number ${f.number}, not ${i + 1}`)
  const seat = plan.numberSeat(f)
  if (seat.east < f.east - f.width / 2 - 1e-9 || seat.east > f.east + f.width / 2 + 1e-9) failures.push(`${f.key}'s number stands off its bottom rail`)
})
for (const f of frames) {
  if (f.outer.high > plan.ROOM.friezeFoot - .02) failures.push(`${f.key} reaches into the frieze`)
  if (f.outer.low < -6.3 + plan.ROOM.gap + .05) failures.push(`${f.key} reaches into the shadow gap`)
}
// THE HEADS: every work lit, every head on the track, none in another's can
const lamps = plan.hangLamps()
for (const f of frames) if (!lamps.some(l => l.key === f.key)) failures.push(`${f.key} has no head`)
for (const l of lamps) {
  if (l.at[0] < plan.TRACK.west || l.at[0] > plan.TRACK.east) failures.push(`${l.name} hangs off the track`)
  if (!(l.intensity > 0 && l.intensity < 200)) failures.push(`${l.name} carries ${l.intensity} cd`)
}
const along = [...lamps].sort((a, b) => a.at[0] - b.at[0])
for (let i = 1; i < along.length; i++)
  if (along[i].at[0] - along[i - 1].at[0] < .2) failures.push(`${along[i - 1].name} and ${along[i].name} hang ${(along[i].at[0] - along[i - 1].at[0]).toFixed(3)} m apart`)
const projectors = lamps.filter(l => l.shutter)
if (projectors.length !== 1 || projectors[0].key !== plan.PROJECTOR.key) failures.push('the framing projector is not the portrait\'s alone')

const bounds = solids.reduce((b, { box }) => [Math.min(b[0], box[0]), Math.min(b[1], box[1]), Math.min(b[2], box[2]), Math.max(b[3], box[3]), Math.max(b[4], box[4]), Math.max(b[5], box[5])], [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity])
console.log(JSON.stringify({ checker: 'vinci-collection-picture-room', ok: failures.length === 0,
  scope: 'The picture room as the runtime builds it: the twenty five frames, the benches and their shoes, the frieze, the bulkhead, the door surrounds and heads, the hang track and every head and lamp face. Every certificate route, approach, leg and wall span at its saved near and gait envelope plus a margin, every recorded corner ball, every station eye and viewing eye at its own near radius. Then the frames against the construction moulding, the canvas planes, the spacing, and the heads on the track. The finish skins lie over the certified construction and are not solids; the room stands outside the rail construction fingerprint.',
  marginM: MARGIN_M, bounds, frames: frames.length, heads: lamps.length, room: { ...room, failures: room.failures.slice(0, 12) },
  control: { failures: control.failures.length, worst: control.worst }, failures: failures.slice(0, 20) }, null, 2))
process.exitCode = failures.length ? 1 : 0
