#!/usr/bin/env node
/** THE GRAVE COURT STANDS CLEAR OF THE CERTIFIED WALK.
 *
 * The court's walls, walkway, bench, beds and maples, the ledger's cut face
 * and the diagram's box are no rail solids: the certificate does not see
 * them, so this proves by itself that none of them enters the walk. Every
 * polyline the certificate holds (routes, approaches, links and walls) is
 * clipped to the court, and every triangle of those bodies, built in node and
 * mounted as the wing mounts them, is measured against every segment in
 * three dimensions: it must stand further off than that segment's own
 * certified radius plus the gait and a margin. And no leaf or limb of a court
 * tree stands within the court's keep of a certified line in plan, at any
 * height: nothing grows over the walk.
 *
 *   node src/wings/vinci/grave/court-check.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import * as THREE from 'three/webgpu'
import { load, root } from '../build-in-node.mjs'

const certificate = JSON.parse(fs.readFileSync(path.join(root, 'src/wings/vinci/data/rail-clearance.json'), 'utf8'))
const { COURT, GRAVE_ORIGIN } = load('src/wings/vinci/collection/layout.ts')
const plan = load('src/wings/vinci/grave/court-plan.ts')
const { createGraveCourt } = load('src/wings/vinci/grave/court.ts')
const { createGrave } = load('src/wings/vinci/grave/index.ts')

// the plan's own copy of the origin and level agrees with the layout's
assert.equal(plan.GRAVE_COURT_ORIGIN.east, GRAVE_ORIGIN.east)
assert.equal(plan.GRAVE_COURT_ORIGIN.north, GRAVE_ORIGIN.north)
assert.equal(plan.GRAVE_COURT_LEVEL, COURT.level)

/* ---- the certified polylines through the court ---- */
const REGION = { west: -62, east: -40, south: -35, north: -15 }
const inRegion = p => p[0] > REGION.west && p[0] < REGION.east && p[1] > REGION.south && p[1] < REGION.north
const GAIT = .011, MARGIN = .25
const segments = []
for (const table of ['routes', 'approaches', 'links', 'walls']) {
  for (const entry of certificate[table] ?? []) {
    const pts = entry.points
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i], b = pts[i + 1]
      if (!inRegion(a) && !inRegion(b)) continue
      segments.push({ a, b, radius: (entry.maxNearRadius ?? .5) + GAIT, from: `${table}:${entry.viewport}:${entry.station ?? entry.from ?? entry.id}:${entry.to ?? entry.exhibit ?? ''}` })
    }
  }
}
assert.ok(segments.length > 0, 'no certified segment runs through the court')
// every line the plan keeps its trees from is a certified line
const planLines = plan.CERTIFIED_LINES.map(([a, b]) => `${a[0]},${a[1]}|${b[0]},${b[1]}`)
const certLines = new Set(segments.map(s => `${s.a[0]},${s.a[1]}|${s.b[0]},${s.b[1]}`).concat(segments.map(s => `${s.b[0]},${s.b[1]}|${s.a[0]},${s.a[1]}`)))
for (const line of planLines) assert.ok(certLines.has(line), `the plan keeps its trees from ${line}, which the certificate does not hold`)
// and every certified line through the court's floor is one the plan keeps
const planSet = new Set(plan.CERTIFIED_LINES.flatMap(([a, b]) => [`${a[0]},${a[1]}|${b[0]},${b[1]}`, `${b[0]},${b[1]}|${a[0]},${a[1]}`]))
const onFloor = s => [s.a, s.b].some(p => p[0] > -61 && p[0] < -46.5 && p[1] > -33.8 && p[1] < -16.2)
const unkept = segments.filter(s => onFloor(s) && !planSet.has(`${s.a[0]},${s.a[1]}|${s.b[0]},${s.b[1]}`))
assert.equal(unkept.length, 0, `certified lines over the court's floor the plan does not keep: ${JSON.stringify(unkept.slice(0, 3).map(s => [s.a, s.b]))}`)

/* ---- the bodies, mounted as the wing mounts them ---- */
const m = () => new THREE.MeshStandardMaterial()
const grave = createGrave({ stone: m(), plaster: m(), bronze: m(), ink: m(), dark: m() }, 'en', { tier: 'hero' })
grave.group.rotation.y = Math.PI / 2
grave.group.position.set(GRAVE_ORIGIN.east, COURT.level + .035, -GRAVE_ORIGIN.north)
const court = createGraveCourt('hero')
grave.group.add(court.local)
grave.group.updateMatrixWorld(true)
court.world.updateMatrixWorld(true)
const measured = []
const take = (object, what) => object.traverse(o => { if (o.isMesh) measured.push({ mesh: o, what }) })
take(court.local, 'court')
take(court.world, 'trees')
grave.group.traverse(o => {
  if (!o.isMesh) return
  if (o.name.startsWith('vinci/grave/diagram')) measured.push({ mesh: o, what: 'diagram' })
})

/* ---- the distances ---- */
const A = new THREE.Vector3(), B = new THREE.Vector3(), P = new THREE.Vector3(), Q = new THREE.Vector3()
const segment = new THREE.Line3()
const toSegment = (p, s) => {
  A.set(s.a[0], s.a[2], -s.a[1]); B.set(s.b[0], s.b[2], -s.b[1])
  segment.set(A, B)
  segment.closestPointToPoint(p, true, Q)
  return p.distanceTo(Q)
}
const planDistance = (e, n, s) => {
  const de = s.b[0] - s.a[0], dn = s.b[1] - s.a[1], l = de * de + dn * dn
  const t = Math.max(0, Math.min(1, ((e - s.a[0]) * de + (n - s.a[1]) * dn) / l))
  return Math.hypot(e - (s.a[0] + de * t), n - (s.a[1] + dn * t))
}
let worst = { clearance: Infinity }, worstPlan = { distance: Infinity }, points = 0
const floorY = COURT.level + .02
for (const { mesh, what } of measured) {
  const position = mesh.geometry.getAttribute('position'), index = mesh.geometry.getIndex()
  const count = index ? index.count : position.count
  const vertex = i => new THREE.Vector3().fromBufferAttribute(position, index ? index.getX(i) : i).applyMatrix4(mesh.matrixWorld)
  for (let at = 0; at + 2 < count; at += 3) {
    const tri = [vertex(at), vertex(at + 1), vertex(at + 2)]
    // a large face is measured on a lattice of its own points
    const longest = Math.max(tri[0].distanceTo(tri[1]), tri[1].distanceTo(tri[2]), tri[2].distanceTo(tri[0]))
    const steps = Math.min(40, Math.max(1, Math.ceil(longest / .25)))
    for (let i = 0; i <= steps; i++) for (let j = 0; j <= steps - i; j++) {
      const u = i / steps, v = j / steps
      P.copy(tri[0]).multiplyScalar(1 - u - v).addScaledVector(tri[1], u).addScaledVector(tri[2], v)
      points++
      for (const s of segments) {
        const clearance = toSegment(P, s) - s.radius
        if (clearance < worst.clearance) worst = { clearance, what, mesh: mesh.name, at: P.toArray().map(x => +x.toFixed(3)), line: s.from }
      }
      if (what === 'trees' && P.y > floorY + .3) for (const s of segments) {
        if (!onFloor(s) && !(s.a[1] > -21 && s.b[1] > -21)) continue
        const d = planDistance(P.x, -P.z, s)
        if (d < worstPlan.distance) worstPlan = { distance: d, mesh: mesh.name, at: P.toArray().map(x => +x.toFixed(3)), line: s.from }
      }
    }
  }
}
const report = {
  checker: 'vinci-grave-court-clearance',
  segments: segments.length, bodies: measured.length, points,
  worstClearanceM: +worst.clearance.toFixed(4), worst,
  requiredMarginM: MARGIN,
  treesNearestLineInPlanM: +worstPlan.distance.toFixed(4), treeKeepM: plan.WALK_KEEP.metres, worstPlan,
  ok: worst.clearance >= MARGIN && worstPlan.distance >= plan.WALK_KEEP.metres - 1e-6,
}
console.log(JSON.stringify(report, null, 1))
process.exitCode = report.ok ? 0 : 1
