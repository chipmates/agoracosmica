#!/usr/bin/env node
/** THE LIGHT MODEL SHOWS THE COMPUTED SUN AND NOTHING ELSE.
 *
 * The grave is built in node as the wing builds it, on both stages, and the
 * model in its box is read from its bodies and its light, never from the
 * numbers it was built from:
 *   - the light stands at the computed altitude over the plate and at the
 *     computed azimuth on it (`GRAVE_HOUR`), the plate's north up;
 *   - the building's ridge runs along the gable's measured bearing, so the sun
 *     meets the gable at the computed angle;
 *   - the building's shadow, cast here point by point along that light onto
 *     the plate, is 1 / tan(altitude) building heights long, runs away from
 *     the sun, and lies on the plate whole, tip included;
 *   - the marks beside it stand one building height apart, start at the foot
 *     of the gable the tip is thrown from, keep clear of the shadow, and the
 *     tip falls between the fifteenth and the sixteenth;
 *   - the light's map is drawn from the building alone, on its own layer, and
 *     holds all of it; nothing in the box casts into the wing's own maps.
 *
 *   node src/wings/vinci/grave/diagram-check.mjs
 */
import assert from 'node:assert/strict'
import * as THREE from 'three/webgpu'
import { load } from '../build-in-node.mjs'

const { GRAVE_HOUR, createGrave } = load('src/wings/vinci/grave/index.ts')
const { DIAGRAM_SHADOW_LAYER } = load('src/wings/vinci/grave/diagram.ts')

const DEG = Math.PI / 180
const altitude = GRAVE_HOUR.sunAltitude * DEG
const reach = 1 / Math.tan(altitude)
/** a bearing in degrees clockwise from north, of a direction on the plate (east, north) */
const bearing = (e, n) => (Math.atan2(e, n) / DEG + 360) % 360
const apart = (a, b, turn = 360) => { const d = Math.abs(a - b) % turn; return Math.min(d, turn - d) }

const m = () => new THREE.MeshStandardMaterial()
const report = { checker: 'vinci-grave-light-model', sun: { azimuth: GRAVE_HOUR.sunAzimuth, altitude: GRAVE_HOUR.sunAltitude, gableBearing: GRAVE_HOUR.gableBearing }, reach: +reach.toFixed(4), stages: {} }

for (const stage of ['desktop', 'phone']) {
  const grave = createGrave({ stone: m(), plaster: m(), bronze: m(), ink: m(), dark: m() }, 'en', { mobile: stage === 'phone' })
  // turned as the wing turns it: the model's own frame must not care
  grave.group.rotation.y = Math.PI / 2
  grave.group.position.set(-55.5, -6.365, 25)
  grave.group.updateMatrixWorld(true)
  const box = grave.group.getObjectByName('vinci/grave/diagram')
  assert.ok(box, 'the grave holds no light model')
  const toBox = box.matrixWorld.clone().invert()
  const body = name => box.children.find(child => child.name === `vinci/grave/diagram/${name}`)
  const points = mesh => { const p = mesh.geometry.getAttribute('position'); return Array.from({ length: p.count }, (_, i) => new THREE.Vector3().fromBufferAttribute(p, i)) }
  const stone = body('stone'), ground = body('ground'), bronze = body('bronze'), caster = body('stone-caster')
  assert.ok(stone && ground && bronze && caster, 'the model lost one of its bodies')

  /* ---- the plate and the building, from their own vertices ---- */
  const building = points(stone)
  const face = Math.min(...building.map(v => v.z)), top = Math.max(...building.map(v => v.z))
  const height = top - face
  const plate = points(ground).filter(v => Math.abs(v.z - face) < 1e-6)
  assert.ok(plate.length >= 4, 'the building does not stand on the plate')
  const west = Math.min(...plate.map(v => v.x)), east = Math.max(...plate.map(v => v.x))
  const south = Math.min(...plate.map(v => v.y)), north = Math.max(...plate.map(v => v.y))
  // the plate is no deeper in the box than the strips' own face: a rim would shade it whole
  const rim = Math.max(...points(bronze).map(v => v.z))
  assert.ok(rim - face < .002 && rim >= face, `the plate lies ${(rim - face).toFixed(4)} m under its frame: at this sun the frame would shade ${((rim - face) * reach).toFixed(2)} m of it`)
  const ridge = building.filter(v => Math.abs(v.z - top) < 1e-6)
  const ends = [ridge[0], ridge.reduce((far, v) => v.distanceTo(ridge[0]) > far.distanceTo(ridge[0]) ? v : far, ridge[0])]
  const ridgeBearing = bearing(ends[1].x - ends[0].x, ends[1].y - ends[0].y)
  assert.ok(apart(ridgeBearing, GRAVE_HOUR.gableBearing, 180) < 1e-4, `the ridge runs at ${ridgeBearing.toFixed(4)}, the gable faces ${GRAVE_HOUR.gableBearing}`)

  /* ---- the light, in the box's own frame ---- */
  const light = box.children.find(child => child.isDirectionalLight)
  assert.ok(light, 'the model has no light of its own')
  const from = light.getWorldPosition(new THREE.Vector3()).applyMatrix4(toBox)
  const aim = light.target.getWorldPosition(new THREE.Vector3()).applyMatrix4(toBox)
  const toSun = from.sub(aim).normalize()
  const lightAltitude = Math.asin(toSun.z) / DEG, lightAzimuth = bearing(toSun.x, toSun.y)
  assert.ok(Math.abs(lightAltitude - GRAVE_HOUR.sunAltitude) < 1e-5, `the light stands ${lightAltitude} over the plate, the sun ${GRAVE_HOUR.sunAltitude}`)
  assert.ok(apart(lightAzimuth, GRAVE_HOUR.sunAzimuth) < 1e-5, `the light stands at ${lightAzimuth} on the plate, the sun at ${GRAVE_HOUR.sunAzimuth}`)
  const offGable = Math.min(...[0, 180].map(turn => apart(lightAzimuth, GRAVE_HOUR.gableBearing + turn)))
  assert.ok(Math.abs(offGable - apart(GRAVE_HOUR.sunAzimuth, GRAVE_HOUR.gableBearing)) < 1e-4, 'the sun does not meet the gable at the computed angle')

  /* ---- the shadow, cast here along that light ---- */
  const cast = building.map(v => new THREE.Vector3().copy(v).addScaledVector(toSun, -(v.z - face) / toSun.z))
  const away = new THREE.Vector2(-toSun.x, -toSun.y).normalize()
  const along = v => v.x * away.x + v.y * away.y, beside = v => v.x * away.y - v.y * away.x
  const tip = cast.reduce((far, v) => along(v) > along(far) ? v : far, cast[0])
  // the foot of what throws the tip: the ridge end that stands furthest along the shadow
  const thrower = ends.reduce((far, v) => along(v) > along(far) ? v : far, ends[0])
  const length = Math.hypot(tip.x - thrower.x, tip.y - thrower.y)
  assert.ok(Math.abs(length / height - reach) < 1e-4, `the shadow is ${(length / height).toFixed(4)} building heights long, the sun asks ${reach.toFixed(4)}`)
  const shadowBearing = bearing(tip.x - thrower.x, tip.y - thrower.y)
  assert.ok(apart(shadowBearing, GRAVE_HOUR.sunAzimuth + 180) < 1e-4, `the shadow runs at ${shadowBearing.toFixed(4)}, away from the sun is ${((GRAVE_HOUR.sunAzimuth + 180) % 360).toFixed(4)}`)
  const KEEP = .1
  for (const v of cast) assert.ok(v.x > west + KEEP && v.x < east - KEEP && v.y > south + KEEP && v.y < north - KEEP, `the shadow leaves the plate at ${v.x.toFixed(3)}, ${v.y.toFixed(3)}`)
  // and it is the longest line in the box: longer than the plate is tall, most of its width
  assert.ok(length > north - south && length > .8 * (east - west), 'the shadow is not the longest line in the box')

  /* ---- the marks: every flat face a hair off the plate that is no numeral ---- */
  const lifted = points(ground).filter(v => v.z > face + 1e-4)
  assert.ok(lifted.length > 0, 'the plate carries no marks')
  for (const v of lifted) {
    assert.ok(v.z - face < .005, 'a mark stands off the plate and would have to throw a shadow')
    assert.ok(v.x > west + .02 && v.x < east - .02 && v.y > south + .02 && v.y < north - .02, 'a mark leaves the plate')
  }
  // no mark under the shadow: the band the building throws, from its foot to its tip
  const band = [Math.min(...cast.map(beside)), Math.max(...cast.map(beside))], run = [Math.min(...building.map(along)), along(tip)]
  const under = lifted.filter(v => beside(v) > band[0] - .01 && beside(v) < band[1] + .01 && along(v) > run[0] - .01 && along(v) < run[1] + .01)
  assert.equal(under.length, 0, `${under.length} mark vertices lie under the shadow`)
  // the ticks: quads of four coplanar vertices nearest the band, one per building height
  const side = Math.sign(lifted.reduce((s, v) => s + beside(v) - (band[0] + band[1]) / 2, 0))
  const edge = side > 0 ? band[1] : band[0]
  const nearEdge = lifted.filter(v => Math.abs(beside(v) - edge) < .045)
  const feet = [...new Set(nearEdge.map(v => Math.round((along(v) - along(thrower)) / height * 1000) / 1000))].sort((a, b) => a - b)
  // each tick has two near vertices, half a mark's width either side of its foot
  const ticks = []
  for (let i = 0; i + 1 < feet.length; i += 2) ticks.push((feet[i] + feet[i + 1]) / 2)
  assert.ok(ticks.length >= 16, `only ${ticks.length} marks stand beside the shadow`)
  ticks.forEach((t, k) => assert.ok(Math.abs(t - k) < 1e-3, `mark ${k} stands ${t} building heights from the gable's foot`))
  const tipAt = length / height
  assert.ok(ticks.includes(ticks.find(t => Math.abs(t - Math.floor(tipAt)) < 1e-3)) && ticks.some(t => Math.abs(t - Math.ceil(tipAt)) < 1e-3), 'the tip does not fall between two marks')

  /* ---- the map: the building alone, all of it ---- */
  const casting = []
  grave.group.traverse(o => { if (o.isMesh && o.castShadow && o.name.startsWith('vinci/grave/diagram')) casting.push(o) })
  assert.equal(casting.length, 1, 'more than the building casts in the box')
  assert.equal(casting[0], caster)
  assert.equal(caster.layers.mask, 1 << DIAGRAM_SHADOW_LAYER, 'the building\'s double left its layer')
  assert.equal(caster.geometry, stone.geometry, 'the map is drawn from another body than the building')
  assert.equal(light.shadow.camera.layers.mask, 1 << DIAGRAM_SHADOW_LAYER, 'the map\'s camera reads another layer')
  assert.equal(light.visible, false, 'the model\'s light reaches the wing')
  assert.ok(ground.receiveShadow && !ground.castShadow && !stone.castShadow && !bronze.castShadow)
  light.shadow.updateMatrices(light)
  const seen = light.shadow.camera
  let margin = Infinity
  for (const v of building) {
    const p = v.clone().applyMatrix4(stone.matrixWorld).applyMatrix4(seen.matrixWorldInverse).applyMatrix4(seen.projectionMatrix)
    margin = Math.min(margin, 1 - Math.abs(p.x), 1 - Math.abs(p.y), 1 - Math.abs(p.z))
  }
  assert.ok(margin > .01, `the building leaves its light's map (${margin.toFixed(4)})`)
  // the plate's furthest corner from the light is still inside the map's depth, or its shadow would end early
  const depth = Math.max(...[[west, south], [west, north], [east, south], [east, north]].map(([x, y]) =>
    -new THREE.Vector3(x, y, face).applyMatrix4(stone.matrixWorld).applyMatrix4(seen.matrixWorldInverse).z))
  assert.ok(depth < seen.far, `the plate runs ${depth.toFixed(2)} m from the light, its map ends at ${seen.far}`)

  report.stages[stage] = {
    buildingHeightM: +height.toFixed(4), ridgeBearing: +ridgeBearing.toFixed(4),
    lightAltitude: +lightAltitude.toFixed(6), lightAzimuth: +lightAzimuth.toFixed(6), sunOffGable: +offGable.toFixed(4),
    shadowLengthM: +length.toFixed(4), shadowInBuildingHeights: +(length / height).toFixed(4), shadowBearing: +shadowBearing.toFixed(4),
    tip: [+(tip.x - (west + east) / 2).toFixed(4), +(tip.y - (south + north) / 2).toFixed(4)], plateM: [+(east - west).toFixed(3), +(north - south).toFixed(3)],
    marks: ticks.length, mapMargin: +margin.toFixed(4), plateDepthM: +depth.toFixed(3), mapFarM: seen.far,
  }
}
report.ok = true
console.log(JSON.stringify(report, null, 1))
