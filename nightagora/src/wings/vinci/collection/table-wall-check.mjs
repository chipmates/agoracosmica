#!/usr/bin/env node
/** Audit the late mounted table panel against every certified route.
 *   node src/wings/vinci/collection/table-wall-check.mjs
 * The rail's construction fingerprint excludes asynchronous furniture. This
 * supplement executes the actual panel constructor, host fit and placement,
 * then proves the full near/gait envelope of spans and recorded corner balls.
 */
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import * as THREE from 'three/webgpu'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const source = name => {
  const file = path.join(HERE, name)
  return ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
}
const execute = (text, context) => new vm.Script(ts.transpileModule(text, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText).runInNewContext(context, { timeout: 20000 })
const layout = {}, solids = {}
execute(source('layout.ts').text, { exports: layout })
execute(source('../rail-solids.ts').text, { exports: solids, require: () => THREE })
const furniture = source('../table/geometry.ts'), exhibits = source('exhibits.ts')
let builder, warmer
function walk(node, visit) { visit(node); ts.forEachChild(node, child => walk(child, visit)) }
walk(furniture, node => { if (ts.isFunctionDeclaration(node) && node.name?.text === 'buildFurniture') builder = node })
walk(exhibits, node => { if (ts.isFunctionDeclaration(node) && node.name?.text === 'warmTable') warmer = node })
// THE TABLE'S PLACE IS ONE CONSTANT, declared with the room programme and
// passed on by the module that composes its eye. So this audit reads the
// declaration itself rather than keeping a second copy of the digits: a
// checker that re-encoded them would pass a table that had moved.
const table = layout.VINCI_READING_TABLE
if (!builder || !warmer) throw new Error('The actual table factory or host mount is absent')
if (!table) throw new Error('The reading table has no declared place')
const constructor = builder.body.statements.filter(statement => {
  if (ts.isVariableStatement(statement)) return statement.declarationList.declarations.some(declaration => declaration.name.getText(furniture) === 'wall')
  return /^wall\./.test(statement.getText(furniture))
}).map(statement => statement.getText(furniture)).join('\n')
const fit = [], placement = []
walk(warmer, node => {
  if (ts.isVariableStatement(node) && node.declarationList.declarations.some(declaration => declaration.name.getText(exhibits) === 'backWall')) fit.push(node.getText(exhibits))
  if (!ts.isExpressionStatement(node)) return
  const text = node.getText(exhibits)
  if (/^backWall\./.test(text)) fit.push(text)
  if (/^built\.object\.(rotation|position|scale)\b/.test(text)) placement.push(text)
})
if (!constructor.includes('new PlaneGeometry') || !fit.length || placement.length !== 2) throw new Error('The actual panel geometry, fit or placement could not be isolated')

function mount(fitted, northShiftM = 0) {
  const object = new THREE.Group(), material = new THREE.MeshBasicMaterial()
  execute(constructor + '\nobject.add(wall)', { ...THREE, plaster: material, object })
  const built = { object }
  if (fitted) execute(fit.join('\n'), { built, VINCI_READING_TABLE: table })
  execute(placement.join('\n'), { built, FLOOR: layout.FLOOR, VINCI_READING_TABLE: table })
  // north is -z, so a control that walks the panel north walks z down
  object.position.z -= northShiftM
  object.updateMatrixWorld(true)
  const wall = object.getObjectByName('reading-room-wall')
  wall.userData.manifestId = 'vinci/table-furniture'
  const positions = wall.geometry.getAttribute('position'), index = wall.geometry.index
  const triangles = []
  for (let i = 0; i < (index?.count ?? positions.count); i += 3) triangles.push([0, 1, 2].map(corner =>
    new THREE.Vector3().fromBufferAttribute(positions, index ? index.getX(i + corner) : i + corner).applyMatrix4(wall.matrixWorld)))
  return { object, wall, material, triangles, box: new THREE.Box3().setFromObject(wall) }
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
function segmentTriangleDistance(start, end, vertices) {
  const [a, b, c] = vertices, direction = end.clone().sub(start), lengthSquared = direction.lengthSq()
  if (lengthSquared > 1e-18) {
    const hit = new THREE.Ray(start, direction.normalize()).intersectTriangle(a, b, c, false, new THREE.Vector3())
    if (hit && hit.distanceToSquared(start) <= lengthSquared + 1e-12) return 0
  }
  const triangle = new THREE.Triangle(a, b, c), closest = new THREE.Vector3()
  return Math.sqrt(Math.min(
    triangle.closestPointToPoint(start, closest).distanceToSquared(start),
    triangle.closestPointToPoint(end, closest).distanceToSquared(end),
    segmentDistanceSquared(start, end, a, b), segmentDistanceSquared(start, end, b, c), segmentDistanceSquared(start, end, c, a),
  ))
}
const certificate = JSON.parse(fs.readFileSync(path.join(HERE, '../data/rail-clearance.json'), 'utf8'))
function audit(panel) {
  let spans = 0, balls = 0, chords = 0, ballIntrusions = 0, worst = null
  for (const route of certificate.routes) {
    const points = route.points.map(([east, north, height]) => new THREE.Vector3(east, height, -north))
    for (let i = 1; i < points.length; i++) {
      const clearance = Math.min(...panel.triangles.map(triangle => segmentTriangleDistance(points[i - 1], points[i], triangle)))
      const margin = clearance - route.maxNearRadius
      spans++
      if (margin < 0) chords++
      if (!worst || margin < worst.marginM) worst = { viewport: route.viewport, from: route.from, to: route.to, span: i - 1, clearanceM: clearance, requiredM: route.maxNearRadius, marginM: margin }
    }
    for (const ball of route.certifiedBalls) {
      const centre = new THREE.Vector3().fromArray(ball.centre)
      const clearance = Math.min(...panel.triangles.map(vertices => new THREE.Triangle(...vertices).closestPointToPoint(centre, new THREE.Vector3()).distanceTo(centre)))
      balls++
      if (clearance < ball.radiusM) ballIntrusions++
    }
  }
  return { routes: certificate.routes.length, spans, balls, chords, ballIntrusions, worst }
}
const before = mount(false), after = mount(true)
const original = audit(before), fitted = audit(after)
const revealGapM = layout.OPENING.hallToGallery.north[0] + after.box.min.z
// THE CONTROL THAT PROVES THIS AUDIT CAN SEE. With the table at its own place
// the panel clears every route at its full length too, so its length is no
// longer a negative control. The control is the panel walked north into the
// door it must never reach, where a blocked route is certain: the shift is
// the distance from the fitted panel's north end to the door's far reveal.
const controlShiftM = layout.OPENING.hallToGallery.north[1] + after.box.min.z
const control = mount(true, controlShiftM), blocked = audit(control)
const excludedFromConstructionCertificate = solids.collectRailSolids(after.object).length === 0
const failures = []
if (!excludedFromConstructionCertificate) failures.push('Update this supplemental audit: the table has entered the construction certificate')
if (!(revealGapM >= .15)) failures.push('The fitted panel must stop at least 150 mm short of the door reveal')
// THE PANEL IS CENTRED ON THE TABLE IT STANDS BEHIND, which is the rule the
// table's own place is derived from: an eye on their shared normal sees the
// book, the lamp and the brown concentric, and every other eye sees a metre of
// parallax between them. So the test is the two centres, not which end the
// panel was shortened at.
const panelCentreNorth = -(after.box.min.z + after.box.max.z) / 2
if (Math.abs(panelCentreNorth - table.north) > .00001) failures.push('The panel is not centred on the table')
if (Math.abs((after.box.max.z - after.box.min.z) - table.panelWidthM) > .00001) failures.push('The fitted panel is not the length the table\'s place is derived from')
if (!(controlShiftM > 0)) failures.push('The control panel does not have to move to reach the door')
if (blocked.chords === 0) failures.push('The control panel in the doorway did not reproduce a blocked route')
if (original.chords || original.ballIntrusions) failures.push('The unshortened table panel intrudes into a certified route envelope')
if (fitted.chords || fitted.ballIntrusions) failures.push('The fitted table panel intrudes into a certified route envelope')
const bounds = panel => ({ east: panel.box.min.x, south: -panel.box.max.z, north: -panel.box.min.z, bottom: panel.box.min.y, top: panel.box.max.y })
console.log(JSON.stringify({ checker: 'vinci-collection-table-wall', ok: failures.length === 0,
  scope: 'Actual source panel and host transforms, with the table\'s own declared place read from the module that owns it; every certificate waypoint span and recorded corner ball, with the saved near and gait envelope. Asynchronous table furniture remains outside the rail construction fingerprint.',
  tableAt: table, panelCentreNorth,
  excludedFromConstructionCertificate, revealGapM, controlShiftM,
  before: { bounds: bounds(before), ...original }, after: { bounds: bounds(after), ...fitted },
  control: { bounds: bounds(control), ...blocked }, failures,
}, null, 2))
for (const panel of [before, after, control]) { panel.wall.geometry.dispose(); panel.material.dispose() }
process.exitCode = failures.length ? 1 : 0
