#!/usr/bin/env node
/** Measure the walk. Every number the gait claims is read off the real
 * module here, on the real certified leg lengths, and the invariants an
 * arrival depends on are asserted.
 * Run: node src/wings/vinci/gait-check.mjs [--json]
 */
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = fs.realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..'))
const wing = path.join(root, 'src/wings/vinci')
const modules = new Map()
const reducedMotionNow = { value: false }
async function load(file) {
  if (modules.has(file)) return modules.get(file)
  const exports = {}
  modules.set(file, exports)
  const raw = fs.readFileSync(file, 'utf8')
  const code = ts.transpileModule(raw, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const dependencies = new Map()
  for (const [, name] of code.matchAll(/\brequire\(["']([^"']+)["']\)/g)) {
    if (dependencies.has(name)) continue
    if (name.startsWith('.')) {
      const target = path.resolve(path.dirname(file), name.replace(/\?raw$/, ''))
      dependencies.set(name, name.endsWith('?raw') ? { default: fs.readFileSync(target, 'utf8') } : await load(target + '.ts'))
    } else if (/^three(?:\/|$)/.test(name)) dependencies.set(name, await import(name))
    else throw new Error('Unexpected runtime dependency: ' + name)
  }
  new vm.Script(code, { filename: path.relative(root, file) }).runInNewContext({
    exports, require: name => dependencies.get(name), Float32Array, performance,
    crypto: globalThis.crypto, TextEncoder: globalThis.TextEncoder, console,
    matchMedia: () => ({ matches: reducedMotionNow.value }),
  }, { timeout: 10000 })
  return exports
}

const { carriedPace, gaitAt, gaitLeg, gaitRhythm, gaitEnvelopeM, gaitHeadLift, stepMetres, strollMetresPerSecond } = await load(path.join(wing, 'gait.ts'))
const certificate = JSON.parse(fs.readFileSync(path.join(wing, 'data/rail-clearance.json'), 'utf8'))

const failures = []
const ensure = (condition, message) => { if (!condition) failures.push(message) }

/** A full walk retains its step; a ceiling-limited traverse fades it out. */
ensure(strollMetresPerSecond === 1.6, 'The walking cruise is not 1.6 m/s')
ensure(gaitLeg(40).rhythm === 1, 'The 1.6 m/s cruise loses its step rhythm')
ensure(Math.abs(gaitLeg(41.875).rhythm - .5) < 1e-12, 'The rhythm does not fade between 1.6 and 1.75 m/s')
ensure(gaitLeg(43.75).rhythm === 0, 'A 1.75 m/s traverse still carries a step rhythm')
ensure(gaitLeg(0).seconds === 1.1 && gaitLeg(1000).seconds === 26, 'The walking duration limits changed')

/** Every length the rail actually walks, from the clearance certificate. */
const lengths = [...new Set(certificate.routes.map(route => Math.round(route.roundedLength * 1000) / 1000))].sort((a, b) => a - b)
const SAMPLES = 4000
const legs = lengths.map(length => {
  const leg = gaitLeg(length)
  let previous = 0, peak = 0, maxRhythm = 0, maxBackwards = 0
  const bandSeconds = { below: 0, stroll: 0 }
  for (let i = 0; i <= SAMPLES; i++) {
    const seconds = leg.seconds * i / SAMPLES
    const at = gaitAt(leg, seconds)
    maxBackwards = Math.max(maxBackwards, previous - at.metres)
    previous = at.metres
    peak = Math.max(peak, at.metresPerSecond)
    if (at.metresPerSecond > 1.75) bandSeconds.below += leg.seconds / SAMPLES
    else if (at.metresPerSecond >= 1.4) bandSeconds.stroll += leg.seconds / SAMPLES
    const step = gaitRhythm(leg, at.metres, false)
    maxRhythm = Math.max(maxRhythm, Math.hypot(step.height, step.sway))
  }
  const start = gaitAt(leg, 0), end = gaitAt(leg, leg.seconds)
  const startStep = gaitRhythm(leg, start.metres, false), endStep = gaitRhythm(leg, end.metres, false)
  ensure(Math.abs(start.metres) < 1e-12, `A leg of ${length} m does not start at its own eye`)
  ensure(Math.abs(end.metres - length) < 1e-9, `A leg of ${length} m does not end at its own eye`)
  ensure(Math.hypot(startStep.height, startStep.sway) === 0 && Math.hypot(endStep.height, endStep.sway) === 0,
    `The step rhythm is not exactly zero at both ends of a ${length} m leg`)
  ensure(maxBackwards <= 0, `A ${length} m leg walks backwards by ${maxBackwards} m`)
  ensure(start.metresPerSecond === 0 && end.metresPerSecond === 0, `A ${length} m leg does not ease its start and its stop`)
  ensure(maxRhythm <= gaitEnvelopeM + 1e-12, `The step rhythm leaves its declared ${gaitEnvelopeM} m envelope`)
  ensure(gaitRhythm(leg, length / 2, true).height === 0 && gaitRhythm(leg, length / 2, true).sway === 0,
    'Reduced motion does not switch the step rhythm off')
  if (leg.rhythm > 0) ensure(peak >= 1.4 && peak <= 1.75, `A walked ${length} m leg cruises at ${peak} m/s, outside the stroll`)
  return {
    metres: +length.toFixed(3), seconds: +leg.seconds.toFixed(2),
    cruiseMetresPerSecond: +leg.cruiseMetresPerSecond.toFixed(3),
    meanMetresPerSecond: +(length / leg.seconds).toFixed(3),
    accelSeconds: +leg.accelSeconds.toFixed(2), brakeSeconds: +leg.brakeSeconds.toFixed(2),
    cadenceStepsPerSecond: +leg.cadenceStepsPerSecond.toFixed(3),
    rhythm: +leg.rhythm.toFixed(3), rhythmAmplitudeM: +maxRhythm.toFixed(5),
    secondsInStrollBand: +bandSeconds.stroll.toFixed(2),
    walked: leg.rhythm > 0,
  }
})

/** The head lift, read on the rail's own thresholds. */
const lifts = [
  { id: 'gallery mouth', east: 22.264357308598658, north: -14.873505099172615 },
  { id: 'court step', east: 13.2304, north: -20.7402 },
  { id: 'terrace stair head', east: -20.7, north: -15 },
]
const thresholds = [
  { east: 22.264357308598658, north: -14.873505099172615, radiusM: 5, radians: .05 },
  { east: 13.2304, north: -20.7402, radiusM: 3.5, radians: .032 },
  { east: -20.7, north: -15, radiusM: 4, radians: .042 },
]
const headLift = lifts.map(point => ({
  at: point.id,
  degreesAtThreshold: +(gaitHeadLift(thresholds, point.east, point.north) * 180 / Math.PI).toFixed(2),
  degreesTenMetresOff: +(gaitHeadLift(thresholds, point.east + 10, point.north) * 180 / Math.PI).toFixed(3),
}))
ensure(headLift.every(lift => lift.degreesAtThreshold > 0 && lift.degreesTenMetresOff === 0), 'A head lift does not fall to nothing away from its threshold')

/** THE RHYTHM ON THE REAL CAMERA. The rail controller walks a straight
 * synthetic leg of the same length, so the path's own height is linear and
 * every residual is the step rhythm itself. The certified routes are measured
 * by rail-check and geometry-check; this isolates the walk.
 */
const THREE = await import('three/webgpu')
const { createRail, stationPose } = await load(path.join(wing, 'rail.ts'))
const { createCertifiedRailPath } = await load(path.join(wing, 'rail-smoothing.ts'))
function walkTrace(metres, reduced) {
  const from = stationPose('arrival', false)
  const to = { eye: from.eye.clone().add(new THREE.Vector3(metres, 0, 0)), at: from.at.clone().add(new THREE.Vector3(metres, 0, 0)), fov: from.fov }
  const straight = createCertifiedRailPath([from.eye.clone(), to.eye.clone()], { clearanceRadiusM: 1, certifyBall: () => true })
  let now = 0
  const camera = new THREE.PerspectiveCamera(49, 1512 / 950, .25, 1100)
  const rail = createRail(camera, () => now, { status: 'verified', failure: '', route: () => straight })
  reducedMotionNow.value = reduced
  rail.set('arrival', from, true, false)
  rail.update()
  rail.set('courtyard', to, false, false)
  const leg = gaitLeg(metres), samples = []
  for (let i = 0; i <= 1200; i++) {
    now = leg.seconds * i / 1200
    rail.update()
    samples.push({ seconds: now, east: camera.position.x, height: camera.position.y, north: -camera.position.z })
  }
  reducedMotionNow.value = false
  const base = from.eye
  const height = samples.map(sample => sample.height - base.y)
  const sway = samples.map(sample => -(sample.north - (-base.z)))
  const crossings = height.reduce((count, value, i) => count + (i > 0 && ((height[i - 1] < 0 && value >= 0) || (height[i - 1] > 0 && value <= 0)) ? 1 : 0), 0)
  return {
    metres, reducedMotion: reduced,
    heightAmplitudeMM: +(Math.max(...height.map(Math.abs)) * 1000).toFixed(2),
    swayAmplitudeMM: +(Math.max(...sway.map(Math.abs)) * 1000).toFixed(2),
    riseAndFallPerSecond: +(crossings / 2 / leg.seconds).toFixed(2),
    endHeightErrorMM: +(Math.abs(height.at(-1)) * 1000).toFixed(6),
    endEastErrorMM: +(Math.abs(samples.at(-1).east - (base.x + metres)) * 1000).toFixed(6),
  }
}
const traces = [walkTrace(17.369497651827334, false), walkTrace(17.369497651827334, true), walkTrace(6.073302231899875, false)]
ensure(traces[0].heightAmplitudeMM > 6 && traces[0].heightAmplitudeMM < 10, 'The measured rise and fall left its declared band')
ensure(traces[0].riseAndFallPerSecond > 2.1 && traces[0].riseAndFallPerSecond < 2.5, 'The measured cadence is not a walking cadence')
ensure(traces[1].heightAmplitudeMM === 0 && traces[1].swayAmplitudeMM === 0, 'Reduced motion still carries a step rhythm on the camera')
ensure(traces.every(trace => trace.endHeightErrorMM < 1e-6 && trace.endEastErrorMM < 1e-6), 'A walk does not land on its own certified eye')

/** THE CARRIED PACE AND THE CARD'S HANDOVER. A visitor who has already asked
 * for the next station is carried on: the leg's own clock runs at the pace of
 * the asking. The overlay hands the card over at the half of the leg by
 * walked distance. Both are measured here on the lengths the rail walks. */
const CARD_HANDOVER = .5
const carried = lengths.map(length => {
  const leg = gaitLeg(length)
  let half = leg.seconds
  for (let i = 0; i <= SAMPLES; i++) {
    const seconds = leg.seconds * i / SAMPLES
    if (gaitAt(leg, seconds).metres >= length * CARD_HANDOVER) { half = seconds; break }
  }
  const row = { metres: +length.toFixed(3) }
  for (const waiting of [0, 1, 2, 4, 9]) {
    const pace = carriedPace(waiting)
    row[`waiting${waiting}`] = {
      pace: +pace.toFixed(2),
      seconds: +(leg.seconds / pace).toFixed(2),
      metresPerSecond: +(leg.cruiseMetresPerSecond * pace).toFixed(2),
      cardHandoverSeconds: +(half / pace).toFixed(2),
    }
    ensure(pace >= 1, `A carried pace of ${pace} would hold the walk back`)
    ensure(waiting < 4 || pace === carriedPace(4), 'The carried pace does not stop at four waiting stations')
    ensure(half > 0 && half < leg.seconds, `The card hands over outside the ${length} m leg`)
  }
  return row
})

/** The same on the real controller: one leg with two stations already asked
 * for behind it, walked to its own end. */
function carriedTrace(metres, waiting) {
  const from = stationPose('arrival', false)
  const step = new THREE.Vector3(metres, 0, 0)
  const to = { eye: from.eye.clone().add(step), at: from.at.clone().add(step), fov: from.fov }
  const beyond = { eye: to.eye.clone().add(step), at: to.at.clone().add(step), fov: from.fov }
  const straight = createCertifiedRailPath([from.eye.clone(), to.eye.clone()], { clearanceRadiusM: 1, certifyBall: () => true })
  let now = 0
  const camera = new THREE.PerspectiveCamera(49, 1512 / 950, .25, 1100)
  const rail = createRail(camera, () => now, { status: 'verified', failure: '', route: () => straight })
  rail.set('arrival', from, true, false)
  rail.update()
  rail.set('courtyard', to, false, false)
  for (let i = 0; i < waiting; i++) rail.set(i % 2 ? 'study' : 'oratory', beyond, false, false)
  let landed = 0
  for (let i = 1; i <= 4000 && !landed; i++) {
    now = i * .016
    rail.update()
    if (rail.navigation.completed === 'courtyard') landed = now
  }
  return { metres, waiting, secondsToLand: +landed.toFixed(2), metresPerSecond: +(metres / landed).toFixed(2) }
}
const carriedTraces = [carriedTrace(17.369497651827334, 0), carriedTrace(17.369497651827334, 2)]
ensure(carriedTraces[1].secondsToLand < carriedTraces[0].secondsToLand * .75,
  'Two stations waiting do not carry the walk on measurably')

const report = {
  checker: 'vinci-gait',
  carriedPaceAndCardHandover: { share: CARD_HANDOVER, legs: carried, onTheRail: carriedTraces },
  measuredOnTheRail: traces,
  strollMetresPerSecond, stepMetres,
  stepRhythmEnvelopeM: +gaitEnvelopeM.toFixed(5),
  legs, headLift,
  limitations: [
    'Pure timing and offsets. No renderer, no input, no geometry: the rail controller and the clearance are measured by rail-check and geometry-check.',
    'Leg lengths come from the saved clearance certificate, so this measures the walk the wing actually walks.',
  ],
  ok: failures.length === 0,
  failures,
}
console.log(JSON.stringify(report, null, 2))
process.exitCode = failures.length ? 1 : 0
