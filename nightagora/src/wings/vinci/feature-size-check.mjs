#!/usr/bin/env node
/** NO FACE THINNER THAN A PIXEL, FOUND OFFLINE. A surface narrower than the
 * pixel that samples it does not get quieter as the picture gets better: it
 * vanishes and comes back as the eye moves, and no multisampling, no depth
 * format and no filter puts it back. The stability audit measured the class
 * on the wing (the largest family is 1.09 px wide and steps up to seventeen
 * levels); this finds the same thing with no renderer at all, so it can run
 * on every landing.
 *
 *   node src/wings/vinci/feature-size-check.mjs [--all] [--px 1] [--top 20]
 *
 * WHAT IT MEASURES. Every triangle of the wing's BUILT geometry carries its
 * own minimum altitude, which for a long thin strip is the strip's own width.
 * That altitude is a SEGMENT in the world, and the segment is projected
 * through every certified eye of `data/rail-clearance.json` that can see it.
 * The smallest projection any eye gives is the face's thinnest reading, and
 * a face under one pixel there is an offence.
 *
 * WHAT IT DOES NOT SEE, plainly: occlusion (a sliver behind a wall is still
 * counted, which is why the allow list carries reasons), the sown bodies
 * (vegetation, ground dressing, terrain grass are cards on a slope and are
 * not mounted), and anything a material draws rather than builds. It is a
 * geometric rule about geometry.
 */
import assert from 'node:assert/strict'
import * as THREE from 'three/webgpu'
import { buildBodies, facesOf, source } from './build-in-node.mjs'

const args = process.argv.slice(2)
const ALL = args.includes('--all')
/** the floor, in CSS pixels of the stage the eye was certified on */
const FLOOR_PX = Number(args[args.indexOf('--px') + 1]) || 1
const TOP = Number(args[args.indexOf('--top') + 1]) || 20
/* A TRIANGLE THIS THICK CANNOT PROJECT UNDER A PIXEL ANYWHERE IN THIS WING.
   One pixel of the desktop stage is 0.96 mm per metre of distance at the
   widest certified lens, and the wing's farthest certified eye stands under
   two hundred metres from anything, so a strip over this cannot offend and
   is not projected at all. It is what keeps a reading of a hundred and
   seventy thousand triangles under a minute. */
const THICK_CAP = 0.25
/* A STRIP IS A STRIP WHEN IT IS LONG AS WELL AS THIN. A triangle whose own
   two dimensions are both under a pixel draws nothing and is a seam in a
   mesh, not a face a visitor loses; the class this rule is about is a
   hairline that RUNS across the picture. So a face counts only where its
   long side covers at least this many pixels at the same eye. */
const RUN_PX = 4
/** under this a face is mesh noise rather than an authored surface */
const THIN_FLOOR = 0.0001
/* AND A FACE SEEN EDGE ON IS NOT THIN, IT IS INVISIBLE. A brick course side
   viewed along its own plane projects to nothing at any width, and losing
   nothing is not the defect this rule is about. A face counts at an eye only
   where it is turned far enough toward it to be seen at all. */
const FACING_FLOOR = 0.15

/* ---- the stages the eyes were certified on ---- */
/* The rail records a viewport with every pose. A pixel is a fraction of the
   stage's own HEIGHT, because the vertical field of view is what the pose
   carries, so only the height and the aspect are needed here. */
const STAGE = {
  desktop: { height: 950, aspect: 1512 / 950 },
  mobile: { height: 844, aspect: 390 / 844 },
}

const certificate = JSON.parse(source('src/wings/vinci/data/rail-clearance.json'))
const eyes = []
{
  const seen = new Set()
  const take = (record, pose, where) => {
    if (!pose?.eye || !pose?.at) return
    const key = `${record.viewport}|${pose.eye.join(',')}|${pose.at.join(',')}|${pose.fov}`
    if (seen.has(key)) return
    seen.add(key)
    const eye = new THREE.Vector3().fromArray(pose.eye)
    const at = new THREE.Vector3().fromArray(pose.at)
    const forward = at.clone().sub(eye).normalize()
    // the pose's own up is the world's: the rail never rolls the camera
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize()
    const up = new THREE.Vector3().crossVectors(right, forward).normalize()
    const stage = STAGE[record.viewport] ?? STAGE.desktop
    /* HOW FAR AWAY A STRIP HAS TO STAND TO FALL UNDER A PIXEL AT THIS EYE.
       A world length w perpendicular to the gaze covers `reach * w / d`
       pixels, so `reach * w` is the distance under which it cannot offend
       and the projection is not worth doing. */
    const reach = stage.height / (2 * Math.tan((pose.fov * Math.PI) / 360))
    eyes.push({ where, viewport: record.viewport, eye, forward, right, up, fov: pose.fov, stage, reach })
  }
  for (const route of certificate.routes ?? []) {
    take(route, route.fromPose, `${route.from} to ${route.to}`)
    take(route, route.toPose, `${route.from} to ${route.to}`)
  }
  for (const approach of certificate.approaches ?? []) {
    take(approach, approach.fromPose, `${approach.station} approach`)
    take(approach, approach.toPose, `${approach.station} approach`)
  }
}

/* ---- every triangle's own thinnest dimension, as a segment ---- */
const bodies = buildBodies()
const faces = facesOf(bodies)
/** the foot of the shortest altitude, and the corner it rises from */
function altitude(v) {
  let longest = 0
  let at = 0
  for (let i = 0; i < 3; i++) {
    const length = v[(i + 1) % 3].distanceTo(v[i])
    if (length > longest) {
      longest = length
      at = i
    }
  }
  const a = v[at]
  const b = v[(at + 1) % 3]
  const c = v[(at + 2) % 3]
  const axis = b.clone().sub(a)
  const t = axis.lengthSq() > 0 ? c.clone().sub(a).dot(axis) / axis.lengthSq() : 0
  const foot = a.clone().addScaledVector(axis, t)
  return { foot, top: c, along: [a, b], thick: foot.distanceTo(c) }
}

/** where a world point lands on this eye's stage, in pixels, or null behind it */
function onStage(eye, point) {
  const to = point.clone().sub(eye.eye)
  const depth = to.dot(eye.forward)
  if (depth <= 0.25) return null
  const half = Math.tan((eye.fov * Math.PI) / 360)
  const y = (to.dot(eye.up) / depth / half) * (eye.stage.height / 2)
  const x = (to.dot(eye.right) / depth / half / eye.stage.aspect) * ((eye.stage.height * eye.stage.aspect) / 2)
  return { x, y, depth }
}

const wide = { desktop: (STAGE.desktop.height * STAGE.desktop.aspect) / 2, mobile: (STAGE.mobile.height * STAGE.mobile.aspect) / 2 }
/** in the picture, with a fifth of the frame of slack at every edge */
const inFrame = (eye, p) => Math.abs(p.y) < eye.stage.height * 0.6 && Math.abs(p.x) < wide[eye.viewport] * 1.2

const offenders = new Map()
let projected = 0
let read = 0
for (const face of faces) {
  const { foot, top, along, thick } = altitude(face.v)
  if (!(thick > THIN_FLOOR) || thick >= THICK_CAP) continue
  read++
  let worst = null
  const centre = foot.clone().add(top).multiplyScalar(0.5)
  const toEye = new THREE.Vector3()
  for (const eye of eyes) {
    // too close for this strip to fall under a pixel, whatever its angle
    const far = eye.reach * thick
    if (centre.distanceToSquared(eye.eye) < far * far) continue
    toEye.copy(eye.eye).sub(centre).normalize()
    if (Math.abs(toEye.dot(face.n)) < FACING_FLOOR) continue
    const a = onStage(eye, foot)
    if (!a || !inFrame(eye, a)) continue
    const b = onStage(eye, top)
    if (!b) continue
    projected++
    const px = Math.hypot(a.x - b.x, a.y - b.y)
    if (!worst || px < worst.px) {
      const p = onStage(eye, along[0])
      const q = onStage(eye, along[1])
      if (!p || !q || Math.hypot(p.x - q.x, p.y - q.y) < RUN_PX) continue
      worst = { px, eye, depth: (a.depth + b.depth) / 2, runPx: Math.hypot(p.x - q.x, p.y - q.y) }
    }
  }
  if (!worst || worst.px >= FLOOR_PX) continue
  const key = `${face.body}|${face.mesh}`
  let row = offenders.get(key)
  if (!row) offenders.set(key, (row = { body: face.body, mesh: face.mesh, faces: 0, thinnestPx: Infinity, thickM: Infinity, atM: 0, eye: '', viewport: '' }))
  row.faces++
  if (worst.px < row.thinnestPx) {
    row.thinnestPx = +worst.px.toFixed(3)
    row.runPx = Math.round(worst.runPx)
    row.thickM = +thick.toFixed(4)
    row.atM = +worst.depth.toFixed(1)
    row.eye = worst.eye.where
    row.viewport = worst.eye.viewport
  }
}

/** FACES THAT MAY STAND THINNER THAN A PIXEL, each with the reason it may.
 * A rule names a body and a mesh, never a class, so a new thin face in a new
 * body cannot hide behind an old one. Every entry here was measured on
 * 2026-09-21 and is a place to fix, not a place that is right: the list is
 * the ratchet's memory, and it may only shrink. */
const ALLOWED = [
  // THE MANOR'S OWN SHELL. A sixteenth century house is built of things that
  // are thin: a brick course, a slate lap, a mullion, a lead came, a flashing
  // and a gate's ironwork are millimetres wide and authored at their real
  // size. They are under a pixel at the far certified eyes, and the audit
  // reads the shell's brick and stone as the wing's loudest surfaces.
  { mesh: 'vinci/shell/brick', why: 'known, 2026-09-21: the coursing, 46104 faces, thinnest 0.03 px over a 35 px run at 34 m' },
  { mesh: 'vinci/shell/slate', why: 'known, 2026-09-21: the roof laps, 13316 faces, thinnest 0.001 px at 47 m' },
  { mesh: 'vinci/shell/stone', why: 'known, 2026-09-21: the dressings and quoins, 8418 faces' },
  { mesh: 'vinci/shell/oak', why: 'known, 2026-09-21: the window frames, 465 faces' },
  { mesh: 'vinci/shell/iron', why: 'known, 2026-09-21: the casement ironwork, 1670 faces' },
  { mesh: 'vinci/shell/dark', why: 'known, 2026-09-21: the dark joinery, 634 faces' },
  // the shell's flat panes left the colour pass; their quarries are now
  // pieces of glass of their own, one continuous surface per light
  { mesh: 'vinci/house-glazing/glass', why: 'known, 2026-09-23: the quarries in their leading, 3808 faces, thinnest 0.041 px at 28 m' },
  // the rooms seen through the windows: a continuous vault and floor
  // tessellation, read only through glass from the far route eyes
  { mesh: 'vinci/house-rooms/fabric', why: 'known, 2026-09-23: the chapel vault cells and one floor cell, 32 faces, thinnest 0.813 px at 29 m' },
  { mesh: 'vinci/shell/lead', why: 'known, 2026-09-21: the flashings, 114 faces, thinnest 0.79 px' },
  { mesh: 'vinci/shell/clay', why: 'known, 2026-09-21: the ridge and hip tiles, 16 faces' },
  // THE COURT AND THE MODERN INSERTION.
  { mesh: 'vinci-grave-made-surface', why: 'known, 2026-09-21: the grave made ground and its furniture, 5360 faces' },
  { mesh: 'vinci/collection-rooms/construction', why: 'known, 2026-09-21: the room linings, reveals and joint bands, 2668 faces' },
  { mesh: 'vinci/collection/architecture', why: 'known, 2026-09-21: the envelope bands at the far court eyes, 232 faces' },
  // THE TWO PASSAGES.
  { mesh: 'wing-vinci/gate-passage/gate ironwork', why: 'known, 2026-09-21: the gate straps and studs, 16 faces' },
  { mesh: 'wing-vinci/entry-passage/plaster', why: 'known, 2026-09-21: four faces of the passage plaster at one far eye' },
  // THE GREAT HALL: its furniture and the entrance leaf's ironwork are made
  // things at their real size, read from the walk only through the west
  // windows' glass and the open entrance door
  { mesh: 'house-hall', why: 'known, 2026-09-24: the furniture with the stools\' joinery and the leaf ironwork, 1097 faces, thinnest 0.019 px at 20 m' },
  // THE GRAVE COURT: its copings and its made things at their real size (the
  // beds' steel edges, the bench's feet, the walk's nosing), and the diagram's
  // relief, a model whose joints, slates and glass are millimetres, read from
  // the far route eyes across the court's walls
  { mesh: 'vinci-grave-court-walls-made-surface', why: 'known, 2026-09-24: the copings\' drips and the band\'s bricks, 30 faces, thinnest 0.22 px at 61 m' },
  { mesh: 'vinci-grave-court-floor-made-surface', why: 'known, 2026-09-24: the beds\' steel edges, the bench\'s feet and the walk\'s nosing, 360 faces, thinnest 0.045 px at 52 m' },
  { mesh: 'vinci/grave/diagram/stone', why: 'known, 2026-09-24: the relief\'s blocks, surround and copings, 364 faces, thinnest 0.003 px at 78 m' },
  { mesh: 'vinci/grave/diagram/ground', why: 'known, 2026-09-24: the relief\'s slates, glass and shelf, 562 faces, thinnest 0.003 px at 78 m' },
  { mesh: 'vinci/grave/diagram/bronze', why: 'known, 2026-09-24: the box\'s bevelled strips (were in the grave\'s own body), 80 faces, thinnest 0.023 px at 32 m' },
]
const allowed = row => ALLOWED.find(rule => rule.mesh === row.mesh || rule.mesh === row.body)

const rows = [...offenders.values()].sort((a, b) => b.faces - a.faces)
const offences = rows.filter(row => !allowed(row))
const report = {
  checker: 'vinci-feature-size',
  floorPx: FLOOR_PX, runPx: RUN_PX, thickCapM: THICK_CAP, thinFloorM: THIN_FLOOR, facingFloor: FACING_FLOOR,
  eyes: eyes.length, faces: faces.length, thinEnoughToProject: read, projections: projected,
  bodies: rows.length, allowed: rows.length - offences.length,
  offences: (ALL ? rows : offences).slice(0, TOP).map(row => ({ ...row, meant: Boolean(allowed(row)), why: allowed(row)?.why ?? null })),
}
console.log(JSON.stringify(report, null, 1))
assert.equal(offences.length, 0,
  `${offences.length} body/bodies carry a face thinner than ${FLOOR_PX} px at a certified eye: ` +
    offences.slice(0, 4).map(row => `${row.mesh} ${row.faces} face(s), thinnest ${row.thinnestPx} px (${row.thickM} m at ${row.atM} m)`).join(' | '))
