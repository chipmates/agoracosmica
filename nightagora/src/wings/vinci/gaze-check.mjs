#!/usr/bin/env node
/** WHAT STANDS IN THE MIDDLE OF THE PICTURE WHILE THE VISITOR WALKS.
 *
 * The recorded walk's `camera intrusion` line reads pixels: it flags a run of
 * frames whose centre box is flat, which is what one near surface looks like.
 * Exact triangle tests clear every certified route, so the flagged frames are
 * not crossings; they are views. This reads the same box as geometry instead:
 * the real rail is driven leg by leg with a controlled clock, and the centre
 * box is cast against the mounted collision solids, so a flat frame can be
 * named as a body at a distance rather than as a statistic.
 *
 *   node src/wings/vinci/gaze-check.mjs [--phone] [--life] [--steps 60]
 */
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import * as THREE from 'three/webgpu'
import * as TSL from 'three/tsl'

const root = fs.realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..'))
const wing = path.join(root, 'src/wings/vinci')
const args = process.argv.slice(2)
const STEPS = Number(args[args.indexOf('--steps') + 1]) || 60
const VIEWPORTS = args.includes('--phone') ? [true] : args.includes('--desktop') ? [false] : [false, true]
const ORDERS = args.includes('--life') ? ['life'] : args.includes('--rooms') ? ['rooms'] : ['rooms', 'life']
/** The gate's own centre box, in the share of the frame it reads. */
const BOX = { x0: .3, x1: .7, y0: .28, y1: .58 }, BOX_RAYS = 5
/** A surface nearer than this fills the box with no detail to read. The near
 * plane is .25 m and the walking envelope reaches .563 m, so this is a view
 * bound and not a clearance. */
const NEAR_M = 3, REACH_M = 60, MARCH_M = 2
/** A run of flat frames this long is what the recorded walk flags. */
const RUN = 3
/** THE MIDDLE OF THE LEG IS THE ONLY PART THIS JUDGES. The first and the last
 * share of a leg belong to the two authored compositions the gaze leaves and
 * arrives in; a station that stands close to its own subject is the design,
 * not a defect. What is judged is the stretch the walk itself holds. */
const WALKED = { from: .1, to: .7 }
/** A pane is not a wall: the picture carries the room behind it. */
const SEE_THROUGH = /glazing|glassSky|\/glass|water/
/** The look ahead the gaze law holds mid-leg, read back here so a flat frame
 * can be separated into a gaze still leaving its composition and a gaze led
 * round a corner. It mirrors `GAZE_AHEAD_M` in the rail. */
const GAZE_AHEAD_M = 6

const modules = new Map()
const media = { reduced: false }
async function load(file) {
  if (modules.has(file)) return modules.get(file)
  const exports = {}
  modules.set(file, exports)
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const dependencies = new Map()
  for (const [, name] of code.matchAll(/\brequire\(["']([^"']+)["']\)/g)) {
    if (dependencies.has(name)) continue
    if (name.startsWith('.')) {
      const target = path.resolve(path.dirname(file), name.replace(/\?raw$/, ''))
      if (name.endsWith('?raw')) { dependencies.set(name, { default: fs.readFileSync(target, 'utf8') }); continue }
      if (target.endsWith('.json')) { dependencies.set(name, { default: JSON.parse(fs.readFileSync(target, 'utf8')) }); continue }
      const source = [target + '.ts', target, path.join(target, 'index.ts')].find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile())
      if (!source) throw new Error('Unresolved gaze dependency: ' + name)
      dependencies.set(name, await load(source))
    } else if (/^three(?:\/|$)/.test(name)) dependencies.set(name, await import(name))
    else throw new Error('Unexpected gaze dependency: ' + name)
  }
  new vm.Script(code, { filename: path.relative(root, file) }).runInNewContext({
    exports, require: name => dependencies.get(name), console, Float32Array, performance,
    crypto: globalThis.crypto, TextEncoder: globalThis.TextEncoder,
    location: { search: '' }, URLSearchParams, matchMedia: () => ({ matches: media.reduced }),
  }, { timeout: 20000 })
  return exports
}

const { createRail, stationPose, railMoveDurationSeconds: DURATION } = await load(path.join(wing, 'rail.ts'))
const { assertRailProjection } = await load(path.join(wing, 'rail-projection.ts'))
const { createRailGeometryAuthority, collectRailSolids } = await load(path.join(wing, 'rail-proof.ts'))
const { gradeAt } = await load(path.join(wing, 'terrain-mesh.ts'))
const { createCollectionStandSolids } = await load(path.join(wing, 'collection/stands.ts'))
const { vinciWalk, vinciWalkPose } = await load(path.join(wing, 'walk.ts'))
const { vinciWallById, vinciWallVertex } = await load(path.join(wing, 'collection/wall.ts'))

const factories = [
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
const authorities = new Map()
let solids = null
for (const tier of ['standard', 'calm']) {
  const scene = new THREE.Group()
  for (const [id, file, name, grounded] of factories) {
    const module = await load(path.join(wing, file + '.ts'))
    const group = grounded ? module[name](gradeAt, tier) : module[name](tier)
    group.traverse(object => { if (object.isMesh && typeof object.userData.manifestId !== 'string') object.userData.manifestId = 'vinci/' + id })
    scene.add(group)
  }
  const water = (await load(path.join(wing, 'water.ts'))).createWater(new THREE.Scene(), {
    tierName: () => tier, reflector: () => ({ node: TSL.vec4(0, 0, 0, 1), dispose() {} }),
  })
  water.traverse(object => { if (object.isMesh && typeof object.userData.manifestId !== 'string') object.userData.manifestId = 'vinci/water' })
  scene.add(createCollectionStandSolids(new THREE.MeshBasicMaterial()))
  scene.add(water)
  scene.updateMatrixWorld(true)
  const collected = collectRailSolids(scene)
  const authority = createRailGeometryAuthority(collected)
  await authority.ready
  if (authority.status !== 'verified') throw new Error(authority.failure)
  authorities.set(tier, authority)
  if (tier === 'standard') solids = collected
}

/* ---- the triangles the picture can land on ---- */
function trianglesOf(meshes) {
  const values = [], names = []
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3()
  for (const mesh of meshes) {
    mesh.updateWorldMatrix(true, false)
    const attribute = mesh.geometry.getAttribute('position'), index = mesh.geometry.getIndex()
    const count = index?.count ?? attribute.count
    for (let i = 0; i + 2 < count; i += 3) {
      a.fromBufferAttribute(attribute, index ? index.getX(i) : i).applyMatrix4(mesh.matrixWorld)
      b.fromBufferAttribute(attribute, index ? index.getX(i + 1) : i + 1).applyMatrix4(mesh.matrixWorld)
      c.fromBufferAttribute(attribute, index ? index.getX(i + 2) : i + 2).applyMatrix4(mesh.matrixWorld)
      values.push(...a.toArray(), ...b.toArray(), ...c.toArray())
      names.push(mesh.name || mesh.userData.manifestId || 'unnamed')
    }
  }
  return { values: new Float64Array(values), names, count: names.length }
}
const CELL = 2
function makeIndex(data) {
  const bins = new Map()
  for (let i = 0; i < data.count; i++) {
    const at = i * 9
    const low = [0, 1, 2].map(axis => Math.floor(Math.min(data.values[at + axis], data.values[at + 3 + axis], data.values[at + 6 + axis]) / CELL))
    const high = [0, 1, 2].map(axis => Math.floor(Math.max(data.values[at + axis], data.values[at + 3 + axis], data.values[at + 6 + axis]) / CELL))
    for (let x = low[0]; x <= high[0]; x++) for (let y = low[1]; y <= high[1]; y++) for (let z = low[2]; z <= high[2]; z++) {
      const key = x + ',' + y + ',' + z
      let bucket = bins.get(key)
      if (!bucket) { bucket = []; bins.set(key, bucket) }
      bucket.push(i)
    }
  }
  return bins
}
const data = trianglesOf(solids)
const bins = makeIndex(data)
const ta = new THREE.Vector3(), tb = new THREE.Vector3(), tc = new THREE.Vector3(), hit = new THREE.Vector3()
const ray = new THREE.Ray()
/** The first solid along a ray, marched cell band by cell band so a long ray
 * never asks for the whole world at once. */
function firstHit(origin, direction) {
  ray.set(origin, direction)
  for (let start = 0; start < REACH_M; start += MARCH_M) {
    const end = Math.min(REACH_M, start + MARCH_M)
    const from = [origin.x + direction.x * start, origin.y + direction.y * start, origin.z + direction.z * start]
    const to = [origin.x + direction.x * end, origin.y + direction.y * end, origin.z + direction.z * end]
    const low = [0, 1, 2].map(axis => Math.floor(Math.min(from[axis], to[axis]) / CELL))
    const high = [0, 1, 2].map(axis => Math.floor(Math.max(from[axis], to[axis]) / CELL))
    let best = Infinity, name = null
    const seen = new Set()
    for (let x = low[0]; x <= high[0]; x++) for (let y = low[1]; y <= high[1]; y++) for (let z = low[2]; z <= high[2]; z++) {
      for (const i of bins.get(x + ',' + y + ',' + z) ?? []) {
        if (seen.has(i)) continue
        seen.add(i)
        const at = i * 9
        ta.fromArray(data.values, at); tb.fromArray(data.values, at + 3); tc.fromArray(data.values, at + 6)
        if (!ray.intersectTriangle(ta, tb, tc, false, hit)) continue
        const distance = hit.distanceTo(origin)
        if (distance < best) { best = distance; name = data.names[i] }
      }
    }
    if (best <= end + 1e-9) return { distance: best, name }
  }
  return { distance: Infinity, name: null }
}

/* ---- the walk ---- */
const inverse = new THREE.Matrix4(), corner = new THREE.Vector3(), forward = new THREE.Vector3()
const travel = new THREE.Vector3(), look = new THREE.Vector3(), chord = new THREE.Vector3()
function readBox(camera) {
  camera.updateMatrixWorld(true)
  camera.updateProjectionMatrix()
  inverse.copy(camera.projectionMatrix).invert()
  const hits = []
  for (let row = 0; row < BOX_RAYS; row++) for (let column = 0; column < BOX_RAYS; column++) {
    const shareX = BOX.x0 + (BOX.x1 - BOX.x0) * (column / (BOX_RAYS - 1))
    const shareY = BOX.y0 + (BOX.y1 - BOX.y0) * (row / (BOX_RAYS - 1))
    corner.set(shareX * 2 - 1, 1 - shareY * 2, .5).applyMatrix4(inverse)
    forward.copy(corner).normalize().applyQuaternion(camera.quaternion)
    hits.push(firstHit(camera.position, forward))
  }
  const names = new Set(hits.map(entry => entry.name))
  const distances = hits.map(entry => entry.distance)
  return {
    nearest: +Math.min(...distances).toFixed(2),
    farthest: Number.isFinite(Math.max(...distances)) ? +Math.max(...distances).toFixed(2) : null,
    bodies: names.size,
    body: names.size === 1 ? [...names][0] : null,
  }
}

const report = { checker: 'vinci-gaze', near: NEAR_M, run: RUN, box: BOX, rays: BOX_RAYS * BOX_RAYS, legs: [], flat: [], refused: [] }
for (const phone of VIEWPORTS) {
  for (const order of ORDERS) {
    const stops = vinciWalk(order === 'life').stops
    let now = 0
    const camera = new THREE.PerspectiveCamera(49, phone ? 390 / 844 : 1440 / 900, .25, 1100)
    const authority = authorities.get(phone ? 'calm' : 'standard')
    const rail = createRail(camera, () => now, authority)
    /** A stop that stands on a wall is reached in two moves: the certified
     * route to the wall's own end station, then the run along the wall. */
    const movesTo = stop => {
      const wall = stop.wall ? vinciWallById(stop.wall) : undefined
      const vertex = wall && stop.exhibit ? vinciWallVertex(wall, stop.exhibit) : undefined
      const onWall = { id: stop.id, station: stop.station, pose: vinciWalkPose(stop, phone), vertex }
      if (vertex === undefined) return [onWall]
      return [{ id: stop.station, station: stop.station, pose: stationPose(stop.station, phone) }, onWall]
    }
    rail.set(stops[0].station, vinciWalkPose(stops[0], phone), true, phone)
    now = 0; rail.update()
    let standing = stops[0].id
    for (let n = 1; n < stops.length; n++) for (const move of movesTo(stops[n])) {
      if (move.id === standing) continue
      rail.set(move.station, move.pose, false, phone, move.vertex)
      const samples = []
      let seconds = 0
      try {
        now += 1e-6; rail.update()
        seconds = (rail.navigation.legSeconds || DURATION) / (rail.navigation.legPace || 1)
        for (let step = 1; step <= STEPS; step++) {
          now = step * seconds / STEPS
          rail.update()
          assertRailProjection(camera)
          samples.push({ share: +(step / STEPS).toFixed(3), at: camera.position.clone(), q: camera.quaternion.clone(), ...readBox(camera) })
        }
        // WHERE THE BODY IS GOING, beside where the eye is looking. The step
        // between two samples is the direction of travel, and one ray along
        // it says whether a flat frame is a tight place or a gaze led off it.
        for (let i = 0; i < samples.length; i++) {
          const previous = samples[Math.max(0, i - 1)].at, next = samples[Math.min(samples.length - 1, i + 1)].at
          travel.subVectors(next, previous)
          travel.y = 0
          if (travel.lengthSq() < 1e-12) continue
          travel.normalize()
          look.set(0, 0, -1).applyQuaternion(samples[i].q)
          look.y = 0
          samples[i].travelClear = +firstHit(samples[i].at, travel).distance.toFixed(2)
          samples[i].offDegrees = look.lengthSq() < 1e-12 ? null
            : +(Math.acos(Math.max(-1, Math.min(1, look.normalize().dot(travel)))) * 180 / Math.PI).toFixed(1)
          // THE CHORD THE GAZE LAW ITSELF HOLDS mid-leg: the way to the place
          // six metres on. Its angle off the local travel separates a gaze
          // still in the composition it is leaving from one led round a corner.
          let run = 0, j = i
          while (j + 1 < samples.length && run < GAZE_AHEAD_M) { run += samples[j].at.distanceTo(samples[j + 1].at); j++ }
          chord.subVectors(samples[j].at, samples[i].at)
          chord.y = 0
          if (chord.lengthSq() > 1e-12) {
            chord.normalize()
            samples[i].aheadDegrees = +(Math.acos(Math.max(-1, Math.min(1, chord.dot(travel)))) * 180 / Math.PI).toFixed(1)
            samples[i].aheadClear = +firstHit(samples[i].at, chord).distance.toFixed(2)
          }
          delete samples[i].q
        }
        // Land the move, so the next one starts where the walk stands.
        for (let guard = 0; guard < 400 && rail.navigation.completed !== move.station; guard++) { now += Math.max(.25, seconds / 4); rail.update() }
      } catch (error) {
        report.refused.push({ viewport: phone ? 'phone' : 'desktop', order, from: standing, to: move.id, vertex: move.vertex ?? null, why: String(error.message ?? error) })
        rail.set(move.station, move.pose, true, phone, move.vertex)
        now += 1e-6; rail.update()
        standing = move.id
        continue
      }
      const from = standing
      standing = move.id
      const flat = []
      let run = []
      const close = () => {
        if (run.length >= RUN) {
          const worst = run.reduce((a, b) => (b.nearest < a.nearest ? b : a))
          flat.push({
            from: run[0].share, to: run[run.length - 1].share, frames: run.length,
            body: run[0].body, nearest: worst.nearest,
            offDegrees: worst.offDegrees ?? null, travelClear: worst.travelClear ?? null, aheadDegrees: worst.aheadDegrees ?? null, aheadClear: worst.aheadClear ?? null,
            at: worst.at.toArray().map(value => +value.toFixed(2)),
          })
        }
        run = []
      }
      for (const sample of samples) {
        const judged = sample.share >= WALKED.from && sample.share <= WALKED.to
        if (judged && sample.bodies === 1 && sample.nearest <= NEAR_M && !SEE_THROUGH.test(sample.body ?? '')) run.push(sample)
        else close()
      }
      close()
      const leg = {
        viewport: phone ? 'phone' : 'desktop', order,
        from, to: move.id,
        seconds: +seconds.toFixed(2),
        nearest: Math.min(...samples.map(entry => entry.nearest)),
        oneBodyFrames: samples.filter(entry => entry.bodies === 1).length,
        flat,
      }
      report.legs.push(leg)
      if (flat.length) report.flat.push(leg)
    }
  }
}
report.ok = report.flat.length === 0
report.flatLegs = report.flat.length
console.log(JSON.stringify(report, null, 1))
process.exitCode = report.ok ? 0 : 1
