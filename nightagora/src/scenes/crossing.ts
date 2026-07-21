/* Beats 7+8 · THE CHOOSING and THE CROSSING — tap Marcus's lantern and
   the night carries you to him. Velocity renders as engraving hatching:
   parallel ink strokes, denser and longer with speed, never a warp
   tunnel. You home in on a voice (fragments cleaning up with
   proximity), the crossing resolves into the PORTRAIT (the real Marcus
   in a gilt hairline frame, atlas annotations assembling around it:
   the atlas entry IS the arrival), and the gold breath dissolves it
   down to the camp. "You enter a life through its light." */

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Line,
  LineBasicMaterial,
  LineSegments,
  Scene,
  Sprite,
  SpriteMaterial,
  CanvasTexture,
  Vector3,
} from 'three/webgpu'
import { mulberry32, FOUNDING_SEED } from '../core/seed'

const GOLD = new Color('#e0b96a')
const STROKE_WHITE = new Color('#dfe4f4')

// the timeline (seconds on the crossing's own clock)
const T_VOICE_FRAGMENTS = 1.6
const T_VOICE_CLEAN = 3.3
const T_VOICE_FADE = 4.9
const T_PORTRAIT = 5.1
const T_BREATH = 8.6
const T_DONE = 9.9

export interface CrossingHandles {
  /** Start the crossing toward a sky position (world space). */
  begin(target: Vector3): void
  /** Advance the choreography; only called while the phase is crossing. */
  update(dt: number, elapsed: number): void
  /** Tap: never trap the visitor. Jumps to the portrait, then onward. */
  skip(): void
  /** Rig hook: compose a deterministic mid-crossing frame. */
  forgeStage(stage: 'hatch' | 'portrait' | 'breath'): void
  /** Leave no trace: clear the canvas organs and the DOM classes. */
  stop(): void
  active(): boolean
}

interface Stroke {
  x: number
  y: number
  z: number
  v: number
  len: number
  bright: number
  gold: boolean
}

export function createCrossing(scene: Scene, onDone: () => void): CrossingHandles {
  const rand = mulberry32(FOUNDING_SEED + 77)
  const root = new Group()
  root.visible = false
  scene.add(root)

  // ---- the hatching field: parallel strokes, an engraving of speed ----
  const N = 260
  const ANGLE = 0.16 // one shared direction: parallel, like plate hatching
  const DIR_X = Math.cos(ANGLE)
  const DIR_Y = Math.sin(ANGLE)
  const strokes: Stroke[] = []
  for (let i = 0; i < N; i++) {
    strokes.push({
      x: (rand() - 0.5) * 16,
      y: (rand() - 0.5) * 9,
      z: -2.6 - rand() * 4.2,
      v: 2.2 + rand() * 5.2,
      len: 0.14 + rand() * 0.5,
      bright: 0.25 + rand() * 0.75,
      gold: rand() > 0.94,
    })
  }
  const hatchGeo = new BufferGeometry()
  const hatchPos = new Float32Array(N * 6)
  const hatchCol = new Float32Array(N * 6)
  hatchGeo.setAttribute('position', new BufferAttribute(hatchPos, 3))
  hatchGeo.setAttribute('color', new BufferAttribute(hatchCol, 3))
  const hatchMat = new LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0,
    blending: AdditiveBlending,
    depthWrite: false,
  })
  const hatch = new LineSegments(hatchGeo, hatchMat)
  hatch.frustumCulled = false
  root.add(hatch)

  // ---- the route: one portolan ink line toward the chosen light ----
  const ROUTE_PTS = 33
  const routeGeo = new BufferGeometry()
  const routePos = new Float32Array(ROUTE_PTS * 3)
  routeGeo.setAttribute('position', new BufferAttribute(routePos, 3))
  const routeMat = new LineBasicMaterial({
    color: GOLD,
    transparent: true,
    opacity: 0,
    blending: AdditiveBlending,
    depthWrite: false,
  })
  const route = new Line(routeGeo, routeMat)
  route.frustumCulled = false
  root.add(route)

  // ---- the destination: his light, growing with proximity ----
  function glowTexture(): CanvasTexture {
    const size = 128
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2d context unavailable')
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    g.addColorStop(0, 'rgba(255, 244, 214, 1)')
    g.addColorStop(0.3, 'rgba(224, 185, 106, 0.5)')
    g.addColorStop(1, 'rgba(0, 0, 0, 0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, size, size)
    return new CanvasTexture(canvas)
  }
  const destMat = new SpriteMaterial({
    map: glowTexture(),
    transparent: true,
    opacity: 0,
    blending: AdditiveBlending,
    depthWrite: false,
  })
  const dest = new Sprite(destMat)
  root.add(dest)

  // ---- the DOM organs: voice line, portrait, gold breath ----
  const voiceNode = document.getElementById('voice')
  const portraitNode = document.getElementById('portrait')
  const breathNode = document.getElementById('goldbreath')
  if (!voiceNode || !portraitNode || !breathNode) throw new Error('missing crossing shell')
  const voiceEl: HTMLElement = voiceNode
  const portraitEl: HTMLElement = portraitNode
  const breathEl: HTMLElement = breathNode

  const VOICE_FRAGMENTS = '· · come · · · down · · · the river · ·'
  const VOICE_CLEAN = 'Come down to the river with me.'

  // ---- state ----
  let running = false
  let t = 0
  let doneFired = false
  const target = new Vector3(0, 4, -14)

  function setVoice(text: string, clean: boolean): void {
    voiceEl.textContent = text
    voiceEl.classList.toggle('clean', clean)
    voiceEl.classList.add('lit')
  }

  function layRoute(): void {
    // a portolan arc: from low in the frame, bowing gently, to his light
    const from = new Vector3(0, -1.6, -3.2)
    const lift = new Vector3(
      (from.x + target.x) * 0.5,
      Math.max(from.y, target.y) + 2.2,
      (from.z + target.z) * 0.5
    )
    for (let i = 0; i < ROUTE_PTS; i++) {
      const k = i / (ROUTE_PTS - 1)
      const a = from.clone().lerp(lift, k)
      const b = lift.clone().lerp(target, k)
      const p = a.lerp(b, k)
      routePos[i * 3] = p.x
      routePos[i * 3 + 1] = p.y
      routePos[i * 3 + 2] = p.z
    }
    routeGeo.getAttribute('position').needsUpdate = true
  }

  function begin(to: Vector3): void {
    target.copy(to)
    layRoute()
    running = true
    doneFired = false
    t = 0
    root.visible = true
    voiceEl.classList.remove('lit', 'clean')
    portraitEl.classList.remove('lit')
    breathEl.classList.remove('lit', 'passing')
  }

  function speedEnvelope(): number {
    const rampIn = Math.min(1, Math.max(0, (t - 0.8) / 1.6))
    const rampOut = 1 - Math.min(1, Math.max(0, (t - 4.6) / 1.2))
    return rampIn * rampIn * (3 - 2 * rampIn) * rampOut
  }

  function update(dt: number, elapsed: number): void {
    if (!running) return
    t += dt

    const spd = speedEnvelope()

    // route ink: draws over the first second, fades as speed takes over
    const drawn = Math.min(1, t / 1.1)
    routeGeo.setDrawRange(0, Math.max(2, Math.floor(ROUTE_PTS * drawn)))
    routeMat.opacity = drawn * Math.max(0, 1 - Math.max(0, t - 1.5) / 0.9) * 0.85

    // strokes stream along the shared direction; length rides the speed
    for (let i = 0; i < N; i++) {
      const s = strokes[i]
      if (!s) continue
      s.x -= s.v * dt * (0.35 + spd * 2.4)
      if (s.x < -8.5) {
        s.x = 8.5
        s.y = (rand() - 0.5) * 9
      }
      const len = s.len * (0.12 + spd * 1.6)
      const o = i * 6
      hatchPos[o] = s.x
      hatchPos[o + 1] = s.y
      hatchPos[o + 2] = s.z
      hatchPos[o + 3] = s.x + DIR_X * len
      hatchPos[o + 4] = s.y + DIR_Y * len
      hatchPos[o + 5] = s.z
      const flick = 0.75 + 0.25 * Math.sin(elapsed * 5 + i * 1.7)
      const b = s.bright * flick * (0.35 + spd * 0.65)
      const c = s.gold ? GOLD : STROKE_WHITE
      hatchCol[o] = c.r * b
      hatchCol[o + 1] = c.g * b
      hatchCol[o + 2] = c.b * b
      hatchCol[o + 3] = c.r * b * 0.4
      hatchCol[o + 4] = c.g * b * 0.4
      hatchCol[o + 5] = c.b * b * 0.4
    }
    hatchGeo.getAttribute('position').needsUpdate = true
    hatchGeo.getAttribute('color').needsUpdate = true
    hatchMat.opacity = Math.min(0.9, spd * 1.2)

    // his light: far on the route at first, easing to the frame's heart
    const settle = Math.min(1, Math.max(0, (t - 2.2) / 2.6))
    const k = settle * settle * (3 - 2 * settle)
    dest.position.set(
      target.x * (1 - k) * 0.35 + 0.0 * k,
      target.y * (1 - k) * 0.35 + 0.1 * k,
      -11
    )
    const grow = 0.3 + Math.min(1, t / 5) * 1.7
    dest.scale.set(grow, grow, 1)
    destMat.opacity = Math.min(0.9, t / 2.5) * (1 - Math.min(1, Math.max(0, (t - T_PORTRAIT) / 0.8)))

    // the voice homes in: fragments, then the sentence begun in space
    if (t >= T_VOICE_FRAGMENTS && t < T_VOICE_CLEAN) setVoice(VOICE_FRAGMENTS, false)
    if (t >= T_VOICE_CLEAN && t < T_VOICE_FADE) setVoice(VOICE_CLEAN, true)
    if (t >= T_VOICE_FADE) voiceEl.classList.remove('lit')

    // the portrait blooms: the atlas entry is the arrival
    if (t >= T_PORTRAIT) portraitEl.classList.add('lit')

    // the gold breath: one heartbeat of warm gold with a single dark line
    if (t >= T_BREATH) {
      breathEl.classList.add('lit')
      portraitEl.classList.remove('lit')
    }
    if (t >= T_BREATH + 0.9) breathEl.classList.add('passing')

    if (t >= T_DONE && !doneFired) {
      doneFired = true
      running = false
      root.visible = false
      voiceEl.classList.remove('lit')
      portraitEl.classList.remove('lit')
      onDone()
    }
  }

  function skip(): void {
    if (!running) return
    if (t < T_PORTRAIT) t = T_PORTRAIT
    else if (t < T_BREATH) t = T_BREATH
  }

  function stop(): void {
    running = false
    root.visible = false
    voiceEl.classList.remove('lit', 'clean')
    portraitEl.classList.remove('lit')
    breathEl.classList.remove('lit', 'passing')
  }

  function forgeStage(stage: 'hatch' | 'portrait' | 'breath'): void {
    begin(new Vector3(2.4, 5.2, -12))
    const until = stage === 'hatch' ? 3.5 : stage === 'portrait' ? 6.2 : 8.8
    // the strokes are integrated, not a pure function of t: simulate
    const steps = Math.ceil(until / (1 / 60))
    for (let i = 0; i < steps; i++) update(1 / 60, 12.4 + i / 60)
  }

  return { begin, update, skip, forgeStage, stop, active: () => running }
}
