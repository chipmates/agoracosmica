#!/usr/bin/env node
/** Audit the cabinet of drawings against every certified way through the wing.
 *   node src/wings/vinci/collection/body-wall-check.mjs
 * The cabinet is raised after the rail reads the scene, so it stands outside
 * the construction fingerprint. This supplement builds the cabinet's own
 * plan, every solid of it (the lining, the chest and its rail, every frame,
 * the track and its heads), and proves each clear of every certified route
 * and approach span, every leg and wall run at its saved near and gait
 * envelope, every recorded corner ball, and every station and viewing eye's
 * own near envelope. A control post stood on the walk along the drawings
 * must fail. And it reads the six heads' wash from the table: even over the
 * pages, the bottom course as the top, no pool on the lining round the
 * opening, the splayed soffit lit.
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

const plan = await load(path.join(HERE, 'body-wall-plan.ts'))
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

/* THE WASH, READ FROM THE TABLE. What the six heads lay through their optic
 * (the same cone, band and falloff the lamps and the sheets' declared light
 * are drawn with), at the points the hang is judged by: every sheet's window
 * centre, top and foot, the splayed soffit, and the lining's face over and
 * beside the opening. */
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }
const heads = plan.BODY_LIGHTS.filter(light => light.wash)
function washAt(point, normal) {
  let sum = 0
  for (const light of heads) {
    const d = point.map((v, i) => v - light.at[i]), length = Math.hypot(...d)
    const axis = light.aim.map((v, i) => v - light.at[i]), axisLength = Math.hypot(...axis)
    const cone = smooth(Math.cos(light.angle), Math.cos(light.angle * (1 - light.penumbra)), d.reduce((s, v, i) => s + v * axis[i], 0) / length / axisLength)
    const west = light.at[0] - point[0]
    if (west <= .02) continue
    const reach = light.at[0] - light.wash.plane, t = reach / west
    const optic = plan.washBand(light.wash, light.at[2] + d[2] * t, d[1] * t) * (length * t) ** 3 / reach
    sum += light.intensity * cone * optic * Math.max(0, -d.reduce((s, v, i) => s + v * normal[i], 0) / length) / (length * length)
  }
  return sum
}
const face = plan.sheetFace(plan.mountedSheets()[0].mount), R = plan.RECESS, east = [1, 0, 0]
const grid = plan.mountedSheets().filter(s => s.mount.row !== 'vortex')
const pages = grid.flatMap(s => [s.mount.datum, s.window.top, s.window.bottom].map(h => ({ row: s.mount.row, e: washAt([face, s.mount.north, h], east) })))
const rowMean = row => { const own = pages.filter(p => p.row === row); return own.reduce((s, p) => s + p.e, 0) / own.length }
const courses = [...new Set(grid.map(s => s.mount.row))].sort()
const pageMin = Math.min(...pages.map(p => p.e)), pageMax = Math.max(...pages.map(p => p.e)), pageMean = pages.reduce((s, p) => s + p.e, 0) / pages.length
const splayNormal = [Math.sin(R.splay), 0, -Math.cos(R.splay)]
const splay = plan.HEAD_NORTHS.map(n => washAt([plan.PLANE.linen + .09, n, R.back + .09 * Math.tan(R.splay)], splayNormal))
const over = [], beside = []
for (let n = R.south; n <= R.north; n += .1) for (const h of [R.head + plan.REVEAL_LIP + .01, R.head + .2, R.head + .5]) over.push(washAt([plan.LINING.face, n, h], east))
for (const n of [R.south - .5, R.north + .5]) for (let h = R.sill + .1; h < R.head; h += .2) beside.push(washAt([plan.LINING.face, n, h], east))
// the steepest a head's ray climbs to the splay's front edge, against the splay
const climb = Math.max(...heads.map(light => (light.at[2] - R.head) / (light.at[0] - plan.LINING.face)))
const wash = {
  pages: { min: +pageMin.toFixed(3), max: +pageMax.toFixed(3), mean: +pageMean.toFixed(3) },
  courses: Object.fromEntries(courses.map(row => [row, +rowMean(row).toFixed(3)])),
  splay: +Math.min(...splay).toFixed(3),
  overOpening: +Math.max(...over).toFixed(3),
  halfMetreBeside: +Math.max(...beside).toFixed(3),
  climb: +climb.toFixed(3), splayRise: +Math.tan(R.splay).toFixed(3),
}
const lightFailures = []
if (pageMin < .85 * pageMax) lightFailures.push(`The wash swings ${pageMin.toFixed(3)} to ${pageMax.toFixed(3)} over the pages, more than 15 per cent`)
const lowest = rowMean(courses.at(-1)), highest = rowMean(courses[0])
if (Math.abs(lowest - highest) > .08 * highest) lightFailures.push(`The bottom course takes ${lowest.toFixed(3)} against the top course's ${highest.toFixed(3)}`)
if (wash.overOpening > .05 * pageMean) lightFailures.push(`The wash lays ${wash.overOpening} on the lining over the opening, a pool on empty wall`)
if (wash.halfMetreBeside > .15 * pageMean) lightFailures.push(`The wash lays ${wash.halfMetreBeside} half a metre past the opening's jambs`)
if (climb >= Math.tan(R.splay)) lightFailures.push('A head\'s ray climbs to the splay\'s edge as steep as the splay: its soffit takes no light')
if (wash.splay <= 0) lightFailures.push('The splayed soffit takes no light under a head')

const solids = plan.bodyWallSolids()
const cabinet = audit(solids)
// THE CONTROL: a post on the wall's own walk between two viewing eyes of the
// third course, where a refusal is certain, proves the audit can see.
const control = audit([{ name: 'control-post', box: [-37.62, -52.9, -6.3, -37.48, -52.75, -4.3] }])
const failures = [...cabinet.failures, ...lightFailures]
if (control.failures.length === 0) failures.push('The control post on the walk along the drawings was not refused')
const bounds = solids.reduce((b, { box }) => [Math.min(b[0], box[0]), Math.min(b[1], box[1]), Math.min(b[2], box[2]), Math.max(b[3], box[3]), Math.max(b[4], box[4]), Math.max(b[5], box[5])], [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity])
console.log(JSON.stringify({ checker: 'vinci-collection-body-wall', ok: failures.length === 0,
  scope: 'The cabinet of drawings as the runtime builds it: the fumed oak lining whole, every board of the plan chest, its bronze rail and saddles and pulls, every frame at its outer box, the wash track, its rods and seven heads and their lamp faces. Every certificate route, approach, leg and wall span at its saved near and gait envelope plus a margin, every recorded corner ball, every station eye and viewing eye at its own near radius. The mats, the linen and the lining lie inside those boxes; the cabinet stands outside the rail construction fingerprint.',
  marginM: MARGIN_M, bounds, cabinet: { ...cabinet, failures: cabinet.failures.slice(0, 12) }, wash,
  control: { failures: control.failures.length, worst: control.worst }, failures: failures.slice(0, 20) }, null, 2))
process.exitCode = failures.length ? 1 : 0
