#!/usr/bin/env node
/** HOW CALMLY THE CAMERA WALKS.
 *
 * The real rail is driven leg by leg with a controlled clock at the film's
 * sampling rate, and every frame's view is differenced against the one before
 * it: the turn rate, its acceleration and its jerk, the lens's zoom rate. Every
 * leg a visitor or the film can take is walked: the spine in both orders and
 * both directions, every approach out and back, every neighbour link both ways
 * and every run along a wall, at both screen shapes.
 *
 *   node src/wings/vinci/calm-check.mjs [--phone|--desktop] [--pace walk] [--hz 60] [--top 12] [--legs]
 *
 * It fails when any leg turns faster, or changes its turn faster, than the
 * caps below. The caps are the criteria; the rail plans under them with its
 * own margin, so the two are never the same number by accident.
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
const value = (name, fallback) => { const at = args.indexOf(name); return at >= 0 && args[at + 1] !== undefined ? args[at + 1] : fallback }
const VIEWPORTS = args.includes('--phone') ? [true] : args.includes('--desktop') ? [false] : [false, true]
const HZ = Number(value('--hz', 60))
const TOP = Number(value('--top', 12))
const PACE = value('--pace', null)
const ONLY = value('--only', null)
const DT = 1 / HZ

/** THE CRITERIA. A frame width may not be crossed in under seven seconds at
 * the film's own landscape field (the panning rule of cinema practice), and a
 * turn eases in and out over no less than about a second and a half. The
 * phone is held to the same degrees: its screen subtends about as much of the
 * eye per degree of view as the desktop's does. */
export const CALM = {
  turnDegPerSecond: 12,
  turnDegPerSecond2: 12,
  turnDegPerSecond3: 40,
  /** the change of the lens, as a share of the picture's scale per second */
  zoomPerSecond: .15,
  /** the body getting under way and stopping, in metres per second squared */
  bodyMetresPerSecond2: 2,
  /** THE PICTURE'S OWN MOTION, in the film's pixels per frame at 30 frames:
   * a frame width of 1920 px crossed in no less than seven seconds. With the
   * film's half-open shutter a hung work smears by half of it and still reads. */
  filmPixelsPerFrame: 9,
}
/** The film keeps the authored width: landscape 1920 px from the desktop's
 * lens, portrait 1080 px from the phone's. */
const filmFocalPixels = (fov, phone) => (phone ? 540 : 960) / (Math.tan(fov * Math.PI / 360) * (phone ? 390 / 844 : 1280 / 720))
const FILM_FPS = 30

const modules = new Map()
const media = { reduced: false }
const storage = { getItem: key => (key === 'na-gait-pace' ? PACE : null), setItem() {} }
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
      if (!source) throw new Error('Unresolved calm dependency: ' + name)
      dependencies.set(name, await load(source))
    } else if (/^three(?:\/|$)/.test(name)) dependencies.set(name, await import(name))
    else throw new Error('Unexpected calm dependency: ' + name)
  }
  new vm.Script(code, { filename: path.relative(root, file) }).runInNewContext({
    exports, require: name => dependencies.get(name), console, Float32Array, performance,
    crypto: globalThis.crypto, TextEncoder: globalThis.TextEncoder,
    location: { search: '' }, URLSearchParams, matchMedia: () => ({ matches: media.reduced }),
    ...(PACE ? { localStorage: storage } : {}),
  }, { timeout: 20000 })
  return exports
}

const { createRail, stationPose } = await load(path.join(wing, 'rail.ts'))
const { createRailGeometryAuthority, collectRailSolids } = await load(path.join(wing, 'rail-proof.ts'))
const { gradeAt } = await load(path.join(wing, 'terrain-mesh.ts'))
const { createCollectionStandSolids } = await load(path.join(wing, 'collection/stands.ts'))
const { vinciWalk, vinciWalkPose } = await load(path.join(wing, 'walk.ts'))
const { VINCI_WALLS, vinciWallById, vinciWallVertex, vinciWallLastVertex } = await load(path.join(wing, 'collection/wall.ts'))
const { vinciExhibitRecords, vinciApproachPose, vinciApproachRunPairs } = await load(path.join(wing, 'collection/approaches.ts'))

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
for (const tier of VIEWPORTS.map(phone => (phone ? 'calm' : 'standard'))) {
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
  const authority = createRailGeometryAuthority(collectRailSolids(scene))
  await authority.ready
  if (authority.status !== 'verified') throw new Error(authority.failure)
  authorities.set(tier, authority)
}

/* ---- the frame arithmetic ---- */
const DEG = 180 / Math.PI
const relative = new THREE.Quaternion(), inverse = new THREE.Quaternion(), axis = new THREE.Vector3()
/** The rotation from one frame's view to the next, as a vector in degrees per
 * second: its length is the turn rate, its change the turn's acceleration. */
function spin(a, b, dt) {
  inverse.copy(a).invert()
  relative.multiplyQuaternions(b, inverse)
  if (relative.w < 0) relative.set(-relative.x, -relative.y, -relative.z, -relative.w)
  const angle = 2 * Math.acos(Math.min(1, relative.w))
  const sine = Math.sqrt(Math.max(0, 1 - relative.w * relative.w))
  if (sine < 1e-12) return new THREE.Vector3()
  axis.set(relative.x / sine, relative.y / sine, relative.z / sine)
  return axis.clone().multiplyScalar(angle * DEG / dt)
}
const scaleOf = fov => Math.log(Math.tan(fov * Math.PI / 360))
const widthOf = (fov, aspect) => 2 * Math.atan(Math.tan(fov * Math.PI / 360) * aspect) * DEG

/** One leg's readings from its frames: frame 0 is the last standing frame
 * before the leg, so a start that jumps is read as a jump. */
function read(frames) {
  let film = 0, peak = 0, peakAt = 0, accel = 0, accelAt = 0, jerk = 0, jerkAt = 0, zoom = 0, turned = 0, widths = 0, body = 0, bodySpeed = null
  let over = 0, previous = null, previousAccel = null
  for (let n = 1; n < frames.length; n++) {
    const dt = frames[n].t - frames[n - 1].t
    if (!(dt > 0)) continue
    const w = spin(frames[n - 1].q, frames[n].q, dt)
    const rate = w.length()
    turned += rate * dt
    if (rate > peak) { peak = rate; peakAt = frames[n].share }
    film = Math.max(film, filmFocalPixels(Math.min(frames[n].fov, frames[n - 1].fov), frames[n].aspect <= .9) * rate / DEG / FILM_FPS)
    widths = Math.max(widths, rate / widthOf(frames[n].fov, frames[n].aspect))
    zoom = Math.max(zoom, Math.abs(scaleOf(frames[n].fov) - scaleOf(frames[n - 1].fov)) / dt)
    if (frames[n].metres !== undefined && frames[n - 1].metres !== undefined) {
      const speed = (frames[n].metres - frames[n - 1].metres) / dt
      if (bodySpeed !== null) body = Math.max(body, Math.abs(speed - bodySpeed) / dt)
      bodySpeed = speed
    }
    if (rate > CALM.turnDegPerSecond + 1e-9) over++
    if (previous) {
      const a = w.clone().sub(previous).divideScalar(dt)
      if (a.length() > accel) { accel = a.length(); accelAt = frames[n].share }
      if (previousAccel) {
        const j = a.clone().sub(previousAccel).divideScalar(dt).length()
        if (j > jerk) { jerk = j; jerkAt = frames[n].share }
      }
      previousAccel = a
    }
    previous = w
  }
  return {
    turnedDeg: +turned.toFixed(1), peakDegPerSecond: +peak.toFixed(2), peakAt: +peakAt.toFixed(3),
    frameWidthsPerSecond: +widths.toFixed(3), secondsPerFrameWidth: widths > 0 ? +(1 / widths).toFixed(2) : null,
    peakDegPerSecond2: +accel.toFixed(1), accelAt: +accelAt.toFixed(3),
    peakDegPerSecond3: +jerk.toFixed(0), jerkAt: +jerkAt.toFixed(3),
    zoomPerSecond: +zoom.toFixed(3), bodyMetresPerSecond2: +body.toFixed(2), filmPixelsPerFrame: +film.toFixed(2), framesOverTurnCap: over,
  }
}

const report = { checker: 'vinci-calm', hz: HZ, pace: PACE ?? 'the default', calm: CALM, legs: [], refused: [] }
for (const phone of VIEWPORTS) {
  const viewport = phone ? 'phone' : 'desktop'
  const camera = new THREE.PerspectiveCamera(49, phone ? 390 / 844 : 1440 / 900, .25, 1100)
  const authority = authorities.get(phone ? 'calm' : 'standard')
  let now = 0
  const rail = createRail(camera, () => now, authority)
  const frame = (share, metres) => ({ t: now, q: camera.quaternion.clone(), fov: camera.fov, aspect: camera.aspect, share, metres })
  /** Walk whatever the rail was just asked for, frame by frame, until it
   * stands; the frame before and two standing frames after are kept. */
  function walk(kind, from, to, ask, done) {
    const frames = [frame(0, 0)]
    let length = 0, walkedBefore = 0, lastShare = 0
    let leg = null
    try {
      if (ask() === false) { report.refused.push({ viewport, kind, from, to, why: 'the rail refused the request' }); return false }
      for (let guard = 0; guard < HZ * 300; guard++) {
        now += DT
        rail.update()
        const nav = rail.navigation
        if (nav.active && !leg) leg = { seconds: nav.legSeconds / (nav.legPace || 1), metres: nav.legMetres, gaze: nav.legGaze }
        // A move may be two legs (a run back along a wall, then the route):
        // the body's distance carries on across them.
        if (nav.active && nav.legMetres !== length) { walkedBefore += length * lastShare; length = nav.legMetres }
        lastShare = nav.active ? nav.legWalked : 1
        frames.push(frame(lastShare, walkedBefore + lastShare * length))
        if (!nav.active && done(nav)) break
      }
      for (let i = 0; i < 2; i++) { now += DT; rail.update(); frames.push(frame(1)) }
    } catch (error) {
      report.refused.push({ viewport, kind, from, to, why: String(error.message ?? error) })
      return false
    }
    if (!leg) return true
    report.legs.push({ viewport, kind, from, to, seconds: +leg.seconds.toFixed(2), metres: +leg.metres.toFixed(2), gaze: leg.gaze, ...read(frames) })
    return true
  }
  const place = (station, pose) => { rail.set(station, pose, true, phone); now += DT; rail.update() }

  /* the spine, both orders and both directions */
  for (const life of [false, true]) for (const back of [false, true]) {
    const order = (life ? 'life' : 'rooms') + (back ? ' back' : '')
    if (ONLY && !order.startsWith(ONLY)) continue
    const stops = [...vinciWalk(life).stops]
    if (back) stops.reverse()
    const movesTo = stop => {
      const wall = stop.wall ? vinciWallById(stop.wall) : undefined
      const vertex = wall && stop.exhibit ? vinciWallVertex(wall, stop.exhibit) : undefined
      const onWall = { id: stop.id, station: stop.station, pose: vinciWalkPose(stop, phone), vertex }
      if (vertex === undefined) return [onWall]
      return [{ id: stop.station, station: stop.station, pose: stationPose(stop.station, phone) }, onWall]
    }
    place(stops[0].station, vinciWalkPose(stops[0], phone))
    let standing = stops[0].id
    for (let n = 1; n < stops.length; n++) for (const move of movesTo(stops[n])) {
      if (move.id === standing) continue
      const ok = walk('spine ' + order, standing, move.id, () => rail.set(move.station, move.pose, false, phone, move.vertex), nav => nav.completed === move.station)
      if (!ok) place(move.station, move.pose)
      standing = move.id
    }
  }
  if (ONLY && ONLY.startsWith('spine')) continue

  /* every approach, out and back */
  for (const record of vinciExhibitRecords()) {
    const eye = vinciApproachPose(record.id, phone)
    if (!eye) continue
    place(record.station, stationPose(record.station, phone))
    walk('approach', record.station, record.id, () => rail.approach(record.id, eye, phone), nav => nav.exhibit === record.id)
    walk('return', record.id, record.station, () => rail.returnToStation(), nav => nav.exhibit === undefined && nav.completed === record.station)
  }

  /* every neighbour link, both ways */
  for (const pair of vinciApproachRunPairs()) for (const [from, to] of [[pair.from, pair.to], [pair.to, pair.from]]) {
    place(pair.station, stationPose(pair.station, phone))
    rail.approach(from, vinciApproachPose(from, phone), phone, true); now += DT; rail.update()
    walk('link', from, to, () => rail.chain(to, vinciApproachPose(to, phone), phone), nav => nav.exhibit === to)
  }

  /* every run along a wall, stop to stop, out and back */
  for (const wall of VINCI_WALLS) {
    const last = vinciWallLastVertex(wall), stops = wall.stops()
    const poseOf = vertex => vertex === 0 ? stationPose(wall.ends[0], phone)
      : vertex === last && wall.ends.length > 1 ? stationPose(wall.ends[1], phone) : vinciApproachPose(stops[vertex - 1].exhibit, phone)
    const idOf = vertex => vertex === 0 ? wall.ends[0] : vertex === last && wall.ends.length > 1 ? wall.ends[1] : stops[vertex - 1].exhibit
    place(wall.ends[0], stationPose(wall.ends[0], phone))
    let at = 0
    const run = to => {
      const station = wall.ends.length > 1 && to === last ? wall.ends[1] : wall.ends[0]
      const exhibit = to === 0 || (to === last && wall.ends.length > 1) ? undefined : stops[to - 1].exhibit
      walk('wall', idOf(at), idOf(to), () => rail.along(to, station, poseOf(to), exhibit, phone), nav => nav.wall === to && !nav.running)
      at = to
    }
    for (let v = 1; v <= last; v++) run(v)
    for (let v = last - 1; v >= 0; v--) run(v)
  }
}

const over = leg => leg.peakDegPerSecond > CALM.turnDegPerSecond || leg.peakDegPerSecond2 > CALM.turnDegPerSecond2
  || leg.peakDegPerSecond3 > CALM.turnDegPerSecond3 || leg.zoomPerSecond > CALM.zoomPerSecond || leg.bodyMetresPerSecond2 > CALM.bodyMetresPerSecond2
  || leg.filmPixelsPerFrame > CALM.filmPixelsPerFrame
const failing = report.legs.filter(over)
const byKind = {}
for (const leg of report.legs) {
  const key = leg.viewport + ' ' + leg.kind.replace(/ back$/, '').replace(/^spine .*/, 'spine')
  const row = byKind[key] ??= { legs: 0, over: 0, worstDegPerSecond: 0, worstDegPerSecond2: 0, worstDegPerSecond3: 0, worstZoom: 0 }
  row.legs++; if (over(leg)) row.over++
  row.worstDegPerSecond = Math.max(row.worstDegPerSecond, leg.peakDegPerSecond)
  row.worstDegPerSecond2 = Math.max(row.worstDegPerSecond2, leg.peakDegPerSecond2)
  row.worstDegPerSecond3 = Math.max(row.worstDegPerSecond3, leg.peakDegPerSecond3)
  row.worstZoom = Math.max(row.worstZoom, leg.zoomPerSecond)
}
report.summary = { legs: report.legs.length, over: failing.length, refused: report.refused.length, byKind }
report.fastest = [...report.legs].sort((a, b) => b.peakDegPerSecond - a.peakDegPerSecond).slice(0, TOP)
if (!args.includes('--legs')) delete report.legs
report.ok = failing.length === 0 && report.refused.length === 0
console.log(JSON.stringify(report, null, 1))
process.exitCode = report.ok ? 0 : 1
