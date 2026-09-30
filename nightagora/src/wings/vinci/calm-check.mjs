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
 * own margin, so the two are never the same number by accident. The one
 * exception is the rail's own table of lifted walks (RAIL_TURN_LIFTS): each
 * is named in the report and read against its lifted criteria.
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

/** THE CRITERIA, AT TWICE THE FIRST TURNING SPEED. They were the panning rule
 * of cinema practice (a frame width in no less than seven seconds at the
 * film's landscape field, a turn eased over about a second and a half); every
 * turn now runs the same curve in half the time, so a rate doubles, its
 * acceleration goes up four times and its jerk eight. The phone is held to
 * the same degrees: its screen subtends about as much of the eye per degree
 * of view as the desktop's does. */
const T1 = 2, T2 = T1 * T1, T3 = T2 * T1
export const CALM = {
  turnDegPerSecond: 12 * T1,
  turnDegPerSecond2: 12 * T2,
  turnDegPerSecond3: 40 * T3,
  /** the change of the lens, as a share of the picture's scale per second */
  zoomPerSecond: .15,
  /** the body getting under way and stopping, in metres per second squared */
  bodyMetresPerSecond2: 2,
  /** THE PICTURE'S OWN MOTION, in the film's pixels per frame at 30 frames:
   * a frame width of 1920 px crossed in no less than three and a half
   * seconds. With the film's half-open shutter a hung work smears by half of
   * it. */
  filmPixelsPerFrame: 9 * T1,
}
/** A TURN MADE STANDING STILL may run faster than one made walking: up to
 * 40 degrees a second on the desktop and 28 on the phone, and on a lens of
 * 60 degrees or wider up to 70 and 50 eased at 88, so a half turn takes a
 * few seconds. Whatever the rate, the picture moves no more than 28 px a
 * frame at the lens it turns on, a narrower lens turning slower. Frames read
 * against it are those whose body has not moved over the whole reading. */
export const CALM_STANDING = {
  desktop: { turnDegPerSecond: 36 * T1, turnDegPerSecond2: 23 * T2, turnDegPerSecond3: 60 * T3, filmPixelsPerFrame: 14 * T1 },
  phone: { turnDegPerSecond: 26 * T1, turnDegPerSecond2: 23 * T2, turnDegPerSecond3: 60 * T3, filmPixelsPerFrame: 14 * T1 },
}
/** THE NAMED STANDS (the line-early arrival, the works departure) turn at 56
 * degrees a second on the desktop and 40 on the phone on a narrower lens,
 * eased at 88: read against the same caps. */
export const CALM_NAMED = CALM_STANDING
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

const { createRail, stationPose, RAIL_TURN_LIFTS = {} } = await load(path.join(wing, 'rail.ts'))
const { createRailGeometryAuthority, collectRailSolids } = await load(path.join(wing, 'rail-proof.ts'))
const { gradeAt } = await load(path.join(wing, 'terrain-mesh.ts'))
const { createCollectionStandSolids } = await load(path.join(wing, 'collection/stands.ts'))
const { vinciWalk, vinciWalkPose } = await load(path.join(wing, 'walk.ts'))
const { VINCI_HOUSE_DOOR: DOOR, VINCI_STAIR_HEAD } = await load(path.join(wing, 'walk-places.ts'))
const { vinciWalkPoseOf } = await load(path.join(wing, 'walk-poses.ts'))
const { VINCI_WALLS, vinciWallById, vinciWallVertex, vinciWallLastVertex } = await load(path.join(wing, 'collection/wall.ts'))
const { vinciExhibitRecords, vinciApproachPose, vinciApproachRunPairs, vinciApproachStation } = await load(path.join(wing, 'collection/approaches.ts'))

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
  const still = { peakDegPerSecond: 0, peakDegPerSecond2: 0, peakDegPerSecond3: 0, filmPixelsPerFrame: 0, seconds: 0 }
  // the body has not moved between frame n - 1 and frame n
  const stood = n => n >= 1 && frames[n].metres !== undefined && frames[n - 1].metres !== undefined && Math.abs(frames[n].metres - frames[n - 1].metres) < 1e-9
  for (let n = 1; n < frames.length; n++) {
    const dt = frames[n].t - frames[n - 1].t
    if (!(dt > 0)) continue
    const w = spin(frames[n - 1].q, frames[n].q, dt)
    const rate = w.length()
    turned += rate * dt
    const pixels = filmFocalPixels(Math.min(frames[n].fov, frames[n - 1].fov), frames[n].aspect <= .9) * rate / DEG / FILM_FPS
    if (stood(n)) {
      still.seconds += dt
      still.peakDegPerSecond = Math.max(still.peakDegPerSecond, rate); still.filmPixelsPerFrame = Math.max(still.filmPixelsPerFrame, pixels)
      if (previous) {
        const a = w.clone().sub(previous).divideScalar(dt)
        if (stood(n - 1)) still.peakDegPerSecond2 = Math.max(still.peakDegPerSecond2, a.length())
        if (previousAccel && stood(n - 1) && stood(n - 2)) still.peakDegPerSecond3 = Math.max(still.peakDegPerSecond3, a.clone().sub(previousAccel).divideScalar(dt).length())
        previousAccel = a
      }
      previous = w
      continue
    }
    if (rate > peak) { peak = rate; peakAt = frames[n].share }
    film = Math.max(film, pixels)
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
    standing: { seconds: +still.seconds.toFixed(2), peakDegPerSecond: +still.peakDegPerSecond.toFixed(2), peakDegPerSecond2: +still.peakDegPerSecond2.toFixed(1),
      peakDegPerSecond3: +still.peakDegPerSecond3.toFixed(0), filmPixelsPerFrame: +still.filmPixelsPerFrame.toFixed(2) },
  }
}

const report = { checker: 'vinci-calm', hz: HZ, pace: PACE ?? 'the default', calm: CALM, calmStanding: CALM_STANDING, legs: [], refused: [] }
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
    const standingAt = rail.navigation.completed
    try {
      if (ask() === false) { report.refused.push({ viewport, kind, from, to, why: 'the rail refused the request' }); return false }
      for (let guard = 0; guard < HZ * 300; guard++) {
        now += DT
        rail.update()
        const nav = rail.navigation
        if (nav.active && !leg) leg = { seconds: nav.legSeconds / (nav.legPace || 1), metres: nav.legMetres, gaze: nav.legGaze, pair: `${standingAt}>${nav.active}` }
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
    report.legs.push({ viewport, kind, from, to, pair: leg.pair, seconds: +leg.seconds.toFixed(2), metres: +leg.metres.toFixed(2), gaze: leg.gaze, ...read(frames) })
    return true
  }
  const place = (station, pose) => { rail.set(station, pose, true, phone); now += DT; rail.update() }

  /* the spine, both orders and both directions */
  for (const life of [false, true]) for (const back of [false, true]) {
    const order = (life ? 'life' : 'rooms') + (back ? ' back' : '')
    if (ONLY && !order.startsWith(ONLY)) continue
    const { stops: walked, cuts } = vinciWalk(life)
    const stops = [...walked]
    if (back) stops.reverse()
    // A CHAPTER CUT IS CROSSED BY ITS TITLE and the house's door by a cut:
    // neither is walked, so neither is a leg the certificate carries
    const cutPairs = new Set(cuts.flatMap(cut => [`${cut.from}>${cut.to}`, `${cut.to}>${cut.from}`]))
    // A STOP AT A PLACE OF ITS OWN is asked of the rail by the place's id, as
    // the wing and the film ask for it, and stands on no wall
    const railOf = stop => stop.place ?? stop.station
    const movesTo = stop => {
      const wall = !stop.place && stop.wall ? vinciWallById(stop.wall) : undefined
      const vertex = wall && stop.exhibit ? vinciWallVertex(wall, stop.exhibit) : undefined
      const onWall = { id: stop.id, station: stop.station, rail: railOf(stop), pose: vinciWalkPose(stop, phone), vertex }
      if (vertex === undefined) return [onWall]
      return [{ id: stop.station, station: stop.station, rail: stop.station, pose: stationPose(stop.station, phone) }, onWall]
    }
    // the life's walk begins above the museum and walks down into its first stop
    if (life && !back) {
      place(VINCI_STAIR_HEAD, vinciWalkPoseOf(VINCI_STAIR_HEAD, phone))
      if (!walk('spine ' + order, VINCI_STAIR_HEAD, stops[0].id, () => rail.set(railOf(stops[0]), vinciWalkPose(stops[0], phone), false, phone), nav => nav.completed === railOf(stops[0])))
        place(railOf(stops[0]), vinciWalkPose(stops[0], phone))
    } else place(railOf(stops[0]), vinciWalkPose(stops[0], phone))
    let standing = stops[0].id, standingStation = stops[0].station
    for (let n = 1; n < stops.length; n++) for (const move of movesTo(stops[n])) {
      if (move.id === standing) continue
      if (cutPairs.has(`${standing}>${move.id}`)) { place(move.rail, move.pose); standing = move.id; standingStation = move.station; continue }
      if (move.station === DOOR.station && standingStation !== DOOR.station) {
        const door = vinciWalkPoseOf(DOOR.inward, phone)
        walk('spine ' + order, standing, DOOR.inward, () => rail.set(DOOR.inward, door, false, phone), nav => nav.completed === DOOR.inward)
        place(move.rail, move.pose); standing = move.id; standingStation = move.station; continue
      }
      if (standingStation === DOOR.station && move.station !== DOOR.station) place(DOOR.outward, vinciWalkPoseOf(DOOR.outward, phone))
      const ok = walk('spine ' + order, standingStation === DOOR.station ? DOOR.outward : standing, move.id, () => rail.set(move.rail, move.pose, false, phone, move.vertex), nav => nav.completed === move.rail)
      if (!ok) place(move.rail, move.pose)
      standing = move.id; standingStation = move.station
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
    // each end stands at its own station; a link across two (the hall's one
    // row) hands the card to the other, as the wing's own walk does
    const home = vinciApproachStation(from), there = vinciApproachStation(to)
    place(home, stationPose(home, phone))
    rail.approach(from, vinciApproachPose(from, phone), phone, true); now += DT; rail.update()
    const across = there !== home ? { id: there, pose: stationPose(there, phone) } : undefined
    walk('link', from, to, () => rail.chain(to, vinciApproachPose(to, phone), phone, across), nav => nav.exhibit === to)
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

/** THE OWNER'S ALLOWANCE: the lifted walks the owner approved, by screen. A
 * station walk the rail's table lifts (its pair, completed id to asked id) is
 * read against the standing turn rate and picture motion lifted by the table's
 * factor, never past the one allowed here, so a table raised on its own reads
 * red. Acceleration and jerk stay: the rail's lift leaves the planner's own
 * caps on them untouched. */
const CALM_ALLOWANCES = { 'body-valve>line-early': { desktop: 1.4 } }
const allowedLift = (pair, viewport) => CALM_ALLOWANCES[pair]?.[viewport] ?? 1
const railLift = (pair, viewport) => RAIL_TURN_LIFTS[pair]?.[viewport] ?? 1
const liftOf = leg => leg.kind.startsWith('spine') ? Math.min(railLift(leg.pair, leg.viewport), allowedLift(leg.pair, leg.viewport)) : 1
const lifted = (cap, factor) => factor === 1 ? cap
  : { ...cap, turnDegPerSecond: +(cap.turnDegPerSecond * factor).toFixed(6), filmPixelsPerFrame: +(cap.filmPixelsPerFrame * factor).toFixed(6) }
const overStanding = leg => { const cap = lifted((/ named\b/.test(leg.gaze ?? '') ? CALM_NAMED : CALM_STANDING)[leg.viewport], liftOf(leg)), st = leg.standing
  return st.peakDegPerSecond > cap.turnDegPerSecond || st.peakDegPerSecond2 > cap.turnDegPerSecond2 || st.peakDegPerSecond3 > cap.turnDegPerSecond3 || st.filmPixelsPerFrame > cap.filmPixelsPerFrame }
const over = leg => leg.peakDegPerSecond > CALM.turnDegPerSecond || leg.peakDegPerSecond2 > CALM.turnDegPerSecond2
  || leg.peakDegPerSecond3 > CALM.turnDegPerSecond3 || leg.zoomPerSecond > CALM.zoomPerSecond || leg.bodyMetresPerSecond2 > CALM.bodyMetresPerSecond2
  || leg.filmPixelsPerFrame > CALM.filmPixelsPerFrame || overStanding(leg)
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
const walkedViewports = VIEWPORTS.map(phone => (phone ? 'phone' : 'desktop'))
report.allowances = Object.keys(RAIL_TURN_LIFTS).flatMap(pair => walkedViewports.filter(v => railLift(pair, v) !== 1).map(viewport => {
  const rail = railLift(pair, viewport), allowed = allowedLift(pair, viewport), factor = Math.min(rail, allowed)
  const legs = report.legs.filter(leg => leg.viewport === viewport && leg.pair === pair && leg.kind.startsWith('spine'))
  return { allowance: allowed !== 1 ? `owner's allowance: ${pair} ${viewport} x${allowed}` : `no owner's allowance: ${pair} ${viewport}`,
    pair, viewport, railFactor: rail, allowedFactor: allowed, readAt: factor,
    ...(rail > allowed ? { beyond: `the rail lifts x${rail}, the owner allowed x${allowed}: read at x${factor}` } : {}),
    standingCriteria: lifted(CALM_STANDING[viewport], factor),
    legs: legs.map(leg => ({ kind: leg.kind, from: leg.from, to: leg.to, seconds: leg.seconds, gaze: leg.gaze, standing: leg.standing,
      walking: { peakDegPerSecond: leg.peakDegPerSecond, filmPixelsPerFrame: leg.filmPixelsPerFrame }, over: over(leg) })) }
}))
// an allowance no walked leg carries means the checker cannot see the walk it lifts
const unwalked = ONLY ? [] : report.allowances.filter(a => a.legs.length === 0).map(a => a.allowance)
report.summary = { legs: report.legs.length, over: failing.length, refused: report.refused.length, allowances: report.allowances.map(a => a.allowance), unwalkedAllowances: unwalked, byKind }
report.fastest = [...report.legs].sort((a, b) => b.peakDegPerSecond - a.peakDegPerSecond).slice(0, TOP)
report.standing = { calm: CALM_STANDING, worst: Object.fromEntries(['desktop', 'phone'].map(v => [v, ['peakDegPerSecond', 'peakDegPerSecond2', 'peakDegPerSecond3', 'filmPixelsPerFrame']
  .map(k => [k, Math.max(0, ...report.legs.filter(l => l.viewport === v).map(l => l.standing[k]))])]).map(([v, e]) => [v, Object.fromEntries(e)])),
  seconds: +report.legs.reduce((n, l) => n + l.standing.seconds, 0).toFixed(1) }
if (!args.includes('--legs')) delete report.legs
report.ok = failing.length === 0 && report.refused.length === 0 && unwalked.length === 0
console.log(JSON.stringify(report, null, 1))
process.exitCode = report.ok ? 0 : 1
