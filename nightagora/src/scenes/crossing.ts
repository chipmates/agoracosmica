/* Beats 7+8 · THE CHOOSING and THE CROSSING — tap Marcus's lantern and
   the night carries you to him. Velocity renders as engraving hatching:
   parallel ink strokes, denser and longer with speed, never a warp
   tunnel. You home in on a voice (fragments cleaning up with
   proximity), the crossing resolves into the PORTRAIT (the real Marcus
   in a gilt hairline frame, atlas annotations assembling around it:
   the atlas entry IS the arrival), and the gold breath dissolves it
   down to the camp. "You enter a life through its light."

   THE ONE PLATE (2026-07-25): every mark in this crossing is cut by the
   same burin and printed on the same page. The strokes are tapered
   quads, not hairlines, so they carry PRESSURE — a burin bites on entry,
   swells through the body and lifts at the end. They thin out and go
   fine around his light, the way an engraver renders a glow: the light
   is not painted in, it is the place where the ink stops. And when the
   speed dies they do not simply vanish, they LIE DOWN along the plate
   mark and become his frame. The engraving that carried you is the
   frame you arrive in.

   One draw call holds all of it (strokes, glory, halo, course, gilding),
   because a field of loose meshes is how a crossing costs a phone its
   frame rate. */

import {
  AdditiveBlending,
  BufferGeometry,
  CanvasTexture,
  Color,
  Group,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  MeshBasicNodeMaterial,
  NormalBlending,
  PlaneGeometry,
  Scene,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three/webgpu'
import * as TSL from 'three/tsl'
import { mulberry32, FOUNDING_SEED } from '../core/seed'

/** a TSL node — the same uncast boundary the camp draws (its shaders are
    hand-composed graphs, and TSL's own overloads cannot follow a graph
    built out of helpers). One cast here keeps the shader readable, and
    the shader is the part a human has to be able to read. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any

const {
  abs,
  attribute,
  cameraProjectionMatrix,
  cameraViewMatrix,
  cos,
  dot,
  float,
  fract,
  fwidth,
  length,
  max,
  mix,
  modelWorldMatrix,
  oneMinus,
  positionLocal,
  pow,
  screenCoordinate,
  sin,
  smoothstep,
  uv,
  uniform,
  varying,
  vec2,
  vec3,
  vec4,
} = TSL as unknown as Record<string, N>

/* craft law: every hand-picked colour goes through three's Color, which
   reads the hex as sRGB and hands back the LINEAR values a shader wants */
const lin = (hex: string): Color => new Color(hex)

const GOLD = lin('#e0b96a')
const GOLD_HOT = lin('#f7e2b4')
const STROKE_WHITE = lin('#dfe4f4')
/* the tone strokes: the cross-hatch that builds value without ever
   becoming a second white. Cooler and quieter than the leading bearing. */
const STROKE_TONE = lin('#93a5cf')
const PLATE_INK = lin('#aab6d6')
/* the ink nearest his light takes his colour. One plate cannot print two
   inks, but light falling on a sheet does exactly this, and it is what
   binds the whole hatching to the star instead of leaving it wallpaper. */
const WARM_WHITE = Array.from({ length: 5 }, (_, i) =>
  lin('#dfe4f4').lerp(lin('#f0c789'), (i / 4) * 0.62)
)
const WARM_TONE = Array.from({ length: 5 }, (_, i) =>
  lin('#93a5cf').lerp(lin('#d9ab6c'), (i / 4) * 0.55)
)
const VEIL_INK = lin('#04060f')

// the timeline (seconds on the crossing's own clock)
const T_VOICE_FRAGMENTS = 1.6
const T_VOICE_CLEAN = 3.3
const T_VOICE_FADE = 4.9
const T_PORTRAIT = 5.1
const T_BREATH = 8.6
const T_DONE = 9.9
/** the page arriving: the strokes slow, then lie down along the plate */
const T_SETTLE_IN = 4.5
const T_SETTLE_OUT = 5.6

// the page: one plane the whole engraving is printed on. 46° is the
// night's one field of view, and every stage but the camp is the seated
// eye at the origin, so page coordinates and pixels stay registered.
const HALF_TAN = Math.tan((46 * Math.PI) / 360)
const INK_Z = -9
const LIGHT_Z = -11
const VEIL_Z = -12.4
const S_INK = HALF_TAN * -INK_Z
const S_LIGHT = HALF_TAN * -LIGHT_Z

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
  /** page space: u runs [-aspect, aspect], v runs [-1, 1], v up */
  u: number
  v: number
  ang: number
  len: number
  wid: number
  bright: number
  /** 0 = the leading bearing, 1 = the cross-hatch that builds tone */
  cross: number
  /** which plate this stroke belongs to: near ones run faster and heavier */
  plate: number
  v0: number
  u0: number
  /** 0 = drifts away, 1 = lies down on the plate mark, 2 = becomes dust */
  role: number
  /** where on the plate mark's perimeter this one comes to rest */
  seat: number
  seatOff: number
  seatLen: number
  /** its position the moment the page began to arrive */
  fu: number
  fv: number
  fang: number
  flen: number
  snapped: boolean
  gold: number
}

interface PageRect {
  cu: number
  cv: number
  hu: number
  hv: number
}

export function createCrossing(scene: Scene, onDone: () => void): CrossingHandles {
  const rand = mulberry32(FOUNDING_SEED + 77)
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  const root = new Group()
  root.visible = false
  scene.add(root)

  // ---------------------------------------------------------- the burin
  /* THE ONE MATERIAL. Every mark is an instanced quad with its own
     bearing, length, weight and colour, and the fragment gives it the
     profile of a cut: thin on entry, swelling through the body, lifting
     at the end. A rule (shape 1) keeps its weight the whole run, which
     is what a ruling pen does and a burin never does. */
  const uInk = uniform(0)

  const inkGeo = new PlaneGeometry(1, 1, 3, 1)
  inkGeo.translate(0.5, 0, 0) // the stroke runs from its own origin

  const dither = (amp: number): N =>
    fract(sin(dot(screenCoordinate.xy.add(0.5), vec2(12.9898, 78.233))).mul(43758.5453))
      .sub(0.5)
      .mul(amp)

  function burinMaterial(): MeshBasicNodeMaterial {
    const mat = new MeshBasicNodeMaterial()
    mat.transparent = true
    mat.blending = AdditiveBlending
    mat.depthWrite = false
    mat.depthTest = false
    const iA = attribute('iA', 'vec4') // x, y, z, bearing
    const iB = attribute('iB', 'vec4') // length, width, weight, shape
    const iC = attribute('iC', 'vec3') // its own colour, already linear

    const c = cos(iA.w)
    const s = sin(iA.w)
    const lx = positionLocal.x.mul(iB.x)
    const ly = positionLocal.y.mul(iB.y).add(
      sin(positionLocal.x.mul(Math.PI)).mul(iB.x).mul(0.025).mul(oneMinus(iB.w))
    )
    const p = vec3(iA.x.add(lx.mul(c)).sub(ly.mul(s)), iA.y.add(lx.mul(s)).add(ly.mul(c)), iA.z)
    mat.vertexNode = cameraProjectionMatrix.mul(cameraViewMatrix).mul(modelWorldMatrix).mul(vec4(p, 1))

    const vA = varying(iA)
    const vB = varying(iB)
    const vC = varying(iC)
    const t = uv()
    const u = t.x
    const across = t.y.sub(0.5).mul(2)
    /* the trough and its raised shoulder share one fragment, one cut:
       the pressure curve is asymmetric, so the bite lands before the
       middle of the run and the burin lifts out of it */
    const prof = mix(
      pow(max(sin(pow(u, 0.72).mul(Math.PI)), 0), 0.62),
      smoothstep(0, 0.02, u).mul(smoothstep(0, 0.02, oneMinus(u))), vB.w
    )
    const edge = across.add(sin(u.mul(21).add(vA.x.mul(7))).mul(0.035))
    const aa = max(fwidth(edge).mul(0.7), 0.06)
    const cover = oneMinus(smoothstep(prof.sub(aa), prof.add(aa), abs(edge)))
    const trough = oneMinus(smoothstep(0.08, 0.32, abs(edge.add(prof.mul(0.16)))))
    const burr = oneMinus(smoothstep(0.05, aa.add(0.22), abs(edge.sub(prof.mul(0.48)))))
      .mul(prof).mul(0.56)
    const pool = smoothstep(0.02, 0.2, u).mul(oneMinus(smoothstep(0.25, 0.72, u)))
    const hand = sin(u.mul(47).add(vA.y.mul(21))).mul(0.045).add(0.955)
    const ink = cover.mul(float(0.54).sub(trough.mul(0.28)).sub(pool.mul(0.1)))
      .add(burr).mul(hand).mul(vB.z).mul(uInk)
    mat.colorNode = vC.mul(ink).add(dither(0.0032))
    return mat
  }

  const STROKES = innerWidth < 700 ? 840 : 1400
  const FURNITURE = 420
  const CAP = STROKES + FURNITURE

  const iA = new Float32Array(CAP * 4)
  const iB = new Float32Array(CAP * 4)
  const iC = new Float32Array(CAP * 3)
  const aA = new InstancedBufferAttribute(iA, 4)
  const aB = new InstancedBufferAttribute(iB, 4)
  const aC = new InstancedBufferAttribute(iC, 3)

  const fieldGeo = new InstancedBufferGeometry()
  fieldGeo.index = inkGeo.index
  for (const key of Object.keys(inkGeo.attributes)) {
    const attr = inkGeo.attributes[key]
    if (attr) fieldGeo.setAttribute(key, attr)
  }
  fieldGeo.setAttribute('iA', aA)
  fieldGeo.setAttribute('iB', aB)
  fieldGeo.setAttribute('iC', aC)
  fieldGeo.instanceCount = CAP
  const inkField = new Mesh(fieldGeo, burinMaterial())
  inkField.frustumCulled = false
  inkField.renderOrder = 24
  root.add(inkField)

  let cursor = 0
  /** lay one mark on the plate (page coordinates, page-sized lengths) */
  function put(
    u: number,
    v: number,
    ang: number,
    len: number,
    wid: number,
    weight: number,
    col: Color,
    shape: number
  ): void {
    if (cursor >= CAP || weight <= 0.0005 || len <= 0) return
    const o = cursor * 4
    iA[o] = u * S_INK
    iA[o + 1] = v * S_INK
    iA[o + 2] = INK_Z
    iA[o + 3] = ang
    iB[o] = len * S_INK
    iB[o + 1] = wid * S_INK
    iB[o + 2] = weight
    iB[o + 3] = shape
    const q = cursor * 3
    iC[q] = col.r
    iC[q + 1] = col.g
    iC[q + 2] = col.b
    cursor++
  }

  // ------------------------------------------------------- the hatching
  const BEARING = 0.16 // one shared direction: parallel, like plate hatching
  /* the second bearing sits close to the first on purpose: two sets a
     right angle apart are a GRID, and a grid is a mesh, not an engraving.
     Twenty-five degrees is where the two sets read as one built tone. */
  const CROSS_BEARING = BEARING + 0.44
  const strokes: Stroke[] = []
  const aspect0 = innerWidth / Math.max(1, innerHeight)
  for (let i = 0; i < STROKES; i++) {
    const plate = i % 3
    const cross = i % 7 === 3 ? 1 : 0
    // the field is sown on a lattice, not at random: a hand rules its
    // cuts in rows, and rows are what let the banks bend as one body
    const columns = STROKES / 70
    const row = Math.floor(i / columns)
    const u0 = ((i % columns) + ((row * 0.381966) % 1) + rand() * 0.18) / columns
    const v0 = ((row + rand() * 0.16) / 70 - 0.5) * 2.5
    strokes.push({
      u: (u0 - 0.5) * 2.6 * aspect0,
      v: v0,
      ang: (cross ? CROSS_BEARING : BEARING) + (rand() - 0.5) * 0.06,
      len: (cross ? 0.025 : 0.045) + rand() * (cross ? 0.035 : 0.11),
      // never under a pixel and a half: a sub-pixel quad does not read
      // as a fine line, it reads as a dotted one (round 1)
      wid: 0.003 + rand() * (cross ? 0.002 : 0.0035),
      bright: 0.3 + rand() * 0.65,
      cross,
      plate,
      v0,
      u0,
      role: 0,
      seat: rand(),
      seatOff: (rand() - 0.5) * 0.035,
      seatLen: 0.015 + rand() * 0.035,
      fu: 0,
      fv: 0,
      fang: 0,
      flen: 0,
      snapped: false,
      gold: rand() > 0.985 ? 1 : 0,
    })
  }
  /* a third of the field comes to rest on the plate mark, a handful stay
     in the air as dust in his light, the rest let go. The seats are
     dealt EVENLY around the impression, with only a hand's jitter: seats
     drawn at random leave half a side missing, and half an impression
     reads as a mistake instead of as a mark (round 3). */
  const seated: Stroke[] = []
  for (let i = 0; i < STROKES; i++) {
    const s = strokes[i]
    if (!s) continue
    if (i % 3 === 0) {
      s.role = 1
      seated.push(s)
    } else if (i % 11 === 5) s.role = 2
  }
  for (let i = 0; i < seated.length; i++) {
    const s = seated[i]
    if (!s) continue
    s.seat = (i + 0.5) / seated.length + (rand() - 0.5) * (0.5 / seated.length)
  }

  // ----------------------------------------------------------- his light
  /* the destination: a hard bright star in a warm halo, never a fog.
     Both gradients are authored in canvas space the way the original
     source did, and both get a dither pass so a 128px ramp blown up to
     half the frame does not band. */
  function glowTexture(stops: Array<[number, string]>): CanvasTexture {
    const size = 128
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2d context unavailable')
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    for (const [at, color] of stops) g.addColorStop(at, color)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, size, size)
    // craft law: dither every gradient at creation
    const img = ctx.getImageData(0, 0, size, size)
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (rand() - 0.5) * 5
      img.data[i] = Math.max(0, Math.min(255, (img.data[i] ?? 0) + n))
      img.data[i + 1] = Math.max(0, Math.min(255, (img.data[i + 1] ?? 0) + n))
      img.data[i + 2] = Math.max(0, Math.min(255, (img.data[i + 2] ?? 0) + n))
    }
    ctx.putImageData(img, 0, 0)
    return new CanvasTexture(canvas)
  }
  const destMat = new SpriteMaterial({
    map: glowTexture([
      [0, 'rgba(255, 250, 235, 0.9)'],
      [0.14, 'rgba(246, 223, 174, 0.42)'],
      [0.4, 'rgba(224, 185, 106, 0.1)'],
      [1, 'rgba(0, 0, 0, 0)'],
    ]),
    transparent: true,
    opacity: 0,
    blending: AdditiveBlending,
    depthWrite: false,
  })
  const dest = new Sprite(destMat)
  dest.renderOrder = 22
  root.add(dest)
  const coreMat = new SpriteMaterial({
    map: glowTexture([
      [0, 'rgba(255, 253, 244, 1)'],
      [0.22, 'rgba(255, 250, 232, 0.95)'],
      [0.34, 'rgba(246, 223, 174, 0.25)'],
      [1, 'rgba(0, 0, 0, 0)'],
    ]),
    transparent: true,
    opacity: 0,
    blending: AdditiveBlending,
    depthWrite: false,
  })
  const destCore = new Sprite(coreMat)
  destCore.renderOrder = 23
  root.add(destCore)
  /* the spill: at the arrival his light falls on the page under the
     frame, so the portrait sits IN light instead of on top of a void */
  const spillMat = new SpriteMaterial({
    map: glowTexture([
      [0, 'rgba(246, 226, 182, 0.5)'],
      [0.3, 'rgba(224, 185, 106, 0.16)'],
      [1, 'rgba(0, 0, 0, 0)'],
    ]),
    transparent: true,
    opacity: 0,
    blending: AdditiveBlending,
    depthWrite: false,
  })
  const spill = new Sprite(spillMat)
  spill.renderOrder = 22
  root.add(spill)

  // ------------------------------------------------------------ the page
  /* THE PAPER. A crossing that happens in empty navy is a transition; a
     crossing that happens on a sheet is a print. The veil deepens the
     corners toward ink so the frame has a centre, and the tooth gives
     the light something to sit on. Both are dithered at creation. */
  const veilGeo = new PlaneGeometry(2, 2)
  const veilMat = new MeshBasicNodeMaterial()
  veilMat.transparent = true
  veilMat.blending = NormalBlending
  veilMat.depthWrite = false
  veilMat.depthTest = false
  const uVeil = uniform(0)
  veilMat.colorNode = vec3(VEIL_INK.r, VEIL_INK.g, VEIL_INK.b)
  veilMat.opacityNode = float(0.74)
    .add(smoothstep(0.15, 0.7, length(uv().sub(vec2(0.5, 0.5)))).mul(0.26))
    .mul(uVeil)
    .add(dither(0.006))
  const veil = new Mesh(veilGeo, veilMat)
  veil.renderOrder = 20
  veil.frustumCulled = false
  root.add(veil)

  const toothMat = new MeshBasicNodeMaterial()
  toothMat.transparent = true
  toothMat.blending = AdditiveBlending
  toothMat.depthWrite = false
  toothMat.depthTest = false
  const grain = fract(
    sin(dot(screenCoordinate.xy, vec2(23.1406, 91.7743))).mul(28657.191)
  )
  toothMat.colorNode = vec3(0.42, 0.44, 0.52)
    .mul(max(grain.sub(0.62), 0))
    .mul(uVeil.mul(0.018))
  const tooth = new Mesh(veilGeo, toothMat)
  tooth.renderOrder = 21
  tooth.frustumCulled = false
  root.add(tooth)

  // ---- the DOM organs: voice line, portrait, gold breath ----
  const voiceNode = document.getElementById('voice')
  const portraitNode = document.getElementById('portrait')
  const breathNode = document.getElementById('goldbreath')
  if (!voiceNode || !portraitNode || !breathNode) throw new Error('missing crossing shell')
  const voiceEl: HTMLElement = voiceNode
  const portraitEl: HTMLElement = portraitNode
  const breathEl: HTMLElement = breathNode

  /* THE GLORY. The breath is one full-frame heartbeat of gold, and a
     bare gradient is the one thing on this page that no hand made. This
     canvas rides under the shell's own dark rule: fine light and dark
     rays cut from the heart, a highlight along the incised line, and the
     same paper tooth the rest of the crossing is printed on. */
  const glory = document.createElement('canvas')
  glory.setAttribute('aria-hidden', 'true')
  glory.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none'
  breathEl.insertBefore(glory, breathEl.firstChild)
  let gloryW = 0
  let gloryH = 0

  function paintGlory(): void {
    const w = Math.max(1, innerWidth)
    const h = Math.max(1, innerHeight)
    if (w === gloryW && h === gloryH) return
    gloryW = w
    gloryH = h
    const dpr = Math.min(devicePixelRatio || 1, 2)
    glory.width = Math.round(w * dpr)
    glory.height = Math.round(h * dpr)
    const ctx = glory.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    const cx = w * 0.5
    const cy = h * 0.46
    const reach = Math.hypot(w, h)
    const g = mulberry32(FOUNDING_SEED + 91)
    // the rays: light and dark, hand-jittered, and deliberately uneven —
    // an even fan of equal rays is a vector sunburst, not a glory cut by
    // a hand (round 1). Some run to the edge, some barely leave the heart.
    // the heart first: a dense corona of very fine cuts, so the middle
    // of the light is engraved and not a smooth blend
    for (let i = 0; i < 96; i++) {
      const a = (i / 96) * Math.PI * 2 + (g() - 0.5) * 0.05
      const r0 = reach * (0.035 + g() * 0.03)
      const r1 = r0 + reach * (0.04 + g() * 0.1)
      ctx.strokeStyle = `rgba(255, 248, 228, ${(0.03 + g() * 0.06).toFixed(3)})`
      ctx.lineWidth = 0.8 + g() * 1.2
      ctx.beginPath()
      ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0)
      ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1)
      ctx.stroke()
    }
    const RAYS = 116
    for (let i = 0; i < RAYS; i++) {
      const a = (i / RAYS) * Math.PI * 2 + (g() - 0.5) * 0.1
      const lightRay = g() > 0.42
      const r0 = reach * (0.04 + g() * 0.14)
      // the dark cuts stay near the heart and build tone; the light ones
      // are the only marks allowed to run all the way out
      const r1 = lightRay
        ? r0 + reach * (0.16 + Math.pow(g(), 1.5) * 0.9)
        : r0 + reach * (0.07 + g() * g() * 0.4)
      const grad = ctx.createLinearGradient(
        cx + Math.cos(a) * r0,
        cy + Math.sin(a) * r0,
        cx + Math.cos(a) * r1,
        cy + Math.sin(a) * r1
      )
      const tint = lightRay ? '255, 246, 222' : '68, 36, 6'
      const peak = (lightRay ? 0.05 + g() * 0.1 : 0.05 + g() * 0.09) * (0.35 + g())
      grad.addColorStop(0, `rgba(${tint}, 0)`)
      grad.addColorStop(0.12 + g() * 0.16, `rgba(${tint}, ${peak.toFixed(3)})`)
      grad.addColorStop(1, `rgba(${tint}, 0)`)
      ctx.strokeStyle = grad
      ctx.lineWidth = lightRay ? 0.8 + g() * 2.6 : 0.8 + g() * 2.8
      ctx.beginPath()
      ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0)
      ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1)
      ctx.stroke()
    }
    // the same ruled circle the crossing draws around his light, carried
    // into the breath: one language, cut twice
    for (const ring of [0.22, 0.46]) {
      const rr = reach * ring
      for (let i = 0; i < 40; i++) {
        const a = (i / 40) * Math.PI * 2 + g() * 0.03
        const half = (Math.PI / 40) * (0.3 + g() * 0.5)
        ctx.strokeStyle = `rgba(255, 246, 222, ${(0.09 + g() * 0.08).toFixed(3)})`
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(cx, cy, rr, a - half, a + half)
        ctx.stroke()
      }
    }
    // the incised rule: the shell's dark line gets the highlight that
    // makes a cut read as a cut, and a fainter echo below it
    const ruleY = h * 0.46
    const x0 = w * 0.27
    const x1 = w * 0.73
    const hi = ctx.createLinearGradient(x0, 0, x1, 0)
    hi.addColorStop(0, 'rgba(255, 248, 226, 0)')
    hi.addColorStop(0.5, 'rgba(255, 248, 226, 0.5)')
    hi.addColorStop(1, 'rgba(255, 248, 226, 0)')
    ctx.strokeStyle = hi
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x0, ruleY - 1.5)
    ctx.lineTo(x1, ruleY - 1.5)
    ctx.stroke()
    const echo = ctx.createLinearGradient(x0, 0, x1, 0)
    echo.addColorStop(0, 'rgba(74, 40, 8, 0)')
    echo.addColorStop(0.5, 'rgba(74, 40, 8, 0.3)')
    echo.addColorStop(1, 'rgba(74, 40, 8, 0)')
    ctx.strokeStyle = echo
    ctx.beginPath()
    ctx.moveTo(w * 0.33, ruleY + 5)
    ctx.lineTo(w * 0.67, ruleY + 5)
    ctx.stroke()
    /* the impression survives the light. A plate mark is pressed INTO
       the sheet, so it is still there when the image is gone, and this
       is what keeps the breath on the same page as his portrait rather
       than being a flash borrowed from somewhere else. */
    const px = (u: number): number => ((u / Math.max(aspect, 0.01) + 1) * w) / 2
    const py = (v: number): number => ((1 - v) * h) / 2
    const l = px(rect.cu - plateHu)
    const r = px(rect.cu + plateHu)
    const top = py(rect.cv + plateUp)
    const bot = py(rect.cv - plateDn)
    if (r > l && bot > top) {
      ctx.strokeStyle = 'rgba(70, 38, 8, 0.07)'
      ctx.lineWidth = 1
      ctx.strokeRect(l, top, r - l, bot - top)
      ctx.strokeStyle = 'rgba(255, 246, 222, 0.05)'
      ctx.strokeRect(l - 1, top - 1, r - l + 2, bot - top + 2)
    }
    // the tooth: one tile, laid over the whole sheet
    const tile = document.createElement('canvas')
    tile.width = 96
    tile.height = 96
    const tctx = tile.getContext('2d')
    if (tctx) {
      const img = tctx.createImageData(96, 96)
      for (let i = 0; i < img.data.length; i += 4) {
        const n = g()
        const dark = n < 0.5
        img.data[i] = dark ? 60 : 255
        img.data[i + 1] = dark ? 34 : 244
        img.data[i + 2] = dark ? 6 : 214
        img.data[i + 3] = Math.floor(Math.abs(n - 0.5) * 52)
      }
      tctx.putImageData(img, 0, 0)
      const pattern = ctx.createPattern(tile, 'repeat')
      if (pattern) {
        ctx.fillStyle = pattern
        ctx.fillRect(0, 0, w, h)
      }
    }
  }

  const VOICE_FRAGMENTS = '· · come · · · down · · · the river · ·'
  const VOICE_CLEAN = 'Come down to the river with me.'

  // ---- state ----
  let running = false
  let t = 0
  let doneFired = false
  const target = new Vector3(0, 4, -14)
  let aspect = aspect0
  let lightU = 0
  let lightV = 0
  /** the frame's own rectangle, in page coordinates, read from the shell */
  const rect: PageRect = { cu: 0, cv: 0.06, hu: 0.19, hv: 0.24 }
  /* the plate mark: the impression the copper leaves in the sheet. It
     encloses the WHOLE entry, letterpress and all, because that is what
     a plate does — and because a mark that stops at the image cuts
     straight through his dates (round 2). */
  let plateHu = 0.24
  let plateUp = 0.29
  let plateDn = 0.29
  let margin = 0.05

  function setVoice(text: string, clean: boolean): void {
    voiceEl.textContent = text
    voiceEl.classList.toggle('clean', clean)
    voiceEl.classList.add('lit')
  }

  /** the shell's own frame, measured, so the gilding lands on the pixel
      it belongs to instead of on an assumption about the stylesheet */
  function measure(): void {
    aspect = innerWidth / Math.max(1, innerHeight)
    const r = portraitEl.getBoundingClientRect()
    let hw = r.width * 0.5
    let hh = r.height * 0.5
    let cx = r.left + hw
    let cy = r.top + hh
    if (hh < 24 || hw < 24) {
      // the plate before the image has loaded: the shell's own sizing
      hw = Math.min(innerHeight * 0.38, innerWidth * 0.64) * 0.5 + 8
      hh = hw * 1.222
      cx = innerWidth * 0.5
      cy = innerHeight * 0.47
    }
    rect.cu = ((2 * cx) / innerWidth - 1) * aspect
    rect.cv = 1 - (2 * cy) / innerHeight
    rect.hu = ((2 * hw) / innerWidth) * aspect
    rect.hv = (2 * hh) / innerHeight
    // the margins breathe with the stage: a phone has no room for a
    // survey plate's generosity
    margin = 0.05 * Math.min(1, innerWidth / 760) + 0.022
    plateHu = rect.hu + margin
    // the shell hangs his name and his years above the image and his
    // epithet and his book below it, so the impression clears all four
    plateUp = rect.hv + 80 * (2 / innerHeight)
    plateDn = rect.hv + 90 * (2 / innerHeight)
  }

  function begin(to: Vector3): void {
    target.copy(to)
    running = true
    doneFired = false
    t = 0
    root.visible = true
    measure()
    for (const s of strokes) s.snapped = false
    voiceEl.classList.remove('lit', 'clean')
    portraitEl.classList.remove('lit')
    breathEl.classList.remove('lit', 'passing')
    glory.style.transform = 'scale(1)'
  }

  function speedEnvelope(): number {
    const rampIn = Math.min(1, Math.max(0, (t - 0.8) / 1.6))
    const rampOut = 1 - Math.min(1, Math.max(0, (t - 4.6) / 1.2))
    return rampIn * rampIn * (3 - 2 * rampIn) * rampOut
  }

  const ease = (k: number): number => k * k * (3 - 2 * k)
  const span = (a: number, b: number, k: number): number =>
    Math.min(1, Math.max(0, (k - a) / (b - a)))

  /** a seat on the plate mark's perimeter, with room for the stroke's own
      run so no cut overshoots its corner (round 1: the corners frayed) */
  function seatOf(p: number, len: number): { u: number; v: number; ang: number } {
    const w = plateHu * 2
    const h = plateUp + plateDn
    const per = (w + h) * 2
    const fit = (d: number, side: number): number => Math.min(d, Math.max(0, side - len))
    let d = p * per
    if (d < w) return { u: rect.cu - plateHu + fit(d, w), v: rect.cv + plateUp, ang: 0 }
    d -= w
    if (d < h) return { u: rect.cu + plateHu, v: rect.cv - plateDn + fit(d, h), ang: Math.PI / 2 }
    d -= h
    if (d < w) return { u: rect.cu - plateHu + fit(d, w), v: rect.cv - plateDn, ang: 0 }
    d -= w
    return { u: rect.cu - plateHu, v: rect.cv - plateDn + fit(d, h), ang: Math.PI / 2 }
  }

  /** the course: a portolan arc from low in the frame toward his light */
  function coursePoint(k: number): { u: number; v: number } {
    const fu = -0.73 * aspect
    const fv = -0.12
    const bu = (fu + lightU) * 0.5
    const bv = Math.max(fv, lightV) + 0.22
    const a = 1 - k
    return {
      u: a * a * fu + 2 * a * k * bu + k * k * lightU,
      v: a * a * fv + 2 * a * k * bv + k * k * lightV,
    }
  }

  function update(dt: number, elapsed: number): void {
    if (!running) return
    t += dt
    measure()

    const spd = speedEnvelope()
    const settle = ease(span(T_SETTLE_IN, T_SETTLE_OUT, t))
    const arrival = span(T_PORTRAIT, T_PORTRAIT + 0.9, t)
    // ONE heartbeat for the whole plate: the hand's pressure, not forty
    // independent flickers (the camp's law, carried across)
    const beat = reduced ? 1 : 0.9 + 0.1 * Math.sin(elapsed * 3.1) + 0.04 * Math.sin(elapsed * 7.7 + 1.3)

    // his light: far on the course at first, easing to the frame's heart
    const k = ease(span(2.2, 4.8, t))
    lightU = (target.x * (1 - k) * 0.35) / S_LIGHT
    lightV = (target.y * (1 - k) * 0.35 + 0.1 * k) / S_LIGHT
    // at the arrival the light steps behind the portrait and stays there
    lightU += (rect.cu - lightU) * arrival
    lightV += (rect.cv + rect.hv * 0.35 - lightV) * arrival
    dest.position.set(lightU * S_LIGHT, lightV * S_LIGHT, LIGHT_Z)
    destCore.position.copy(dest.position)
    const grow = 0.3 + Math.min(1, t / 5) * 1.7
    dest.scale.set(grow * (1 + arrival * 2.4), grow * (1 + arrival * 2.4), 1)
    destCore.scale.set(grow * 0.13, grow * 0.13, 1)
    destMat.opacity = Math.min(0.28, t / 2.5) * (1 - arrival * 0.68) * beat
    coreMat.opacity = Math.min(1, t / 2.2) * (1 - arrival) * beat
    // the spill: a small warm pool on the page right under the frame. A
    // wide one is not light, it is fog, and it swallowed his caption on
    // both stages (round 1).
    spill.position.set(rect.cu * S_LIGHT, (rect.cv - rect.hv * 1.1) * S_LIGHT, LIGHT_Z)
    spill.scale.set(rect.hu * 3.2 * S_LIGHT, rect.hv * 0.62 * S_LIGHT, 1)
    spillMat.opacity = arrival * 0.34 * (1 - span(T_BREATH - 0.2, T_BREATH + 0.3, t))

    uVeil.value = Math.min(1, t / 0.9) * (1 - span(T_BREATH - 0.3, T_BREATH + 0.2, t))
    uInk.value = Math.min(1, t / 0.8)

    // ---------------------------------------------------- the hatching
    cursor = 0
    for (let i = 0; i < STROKES; i++) {
      const s = strokes[i]
      if (!s) continue
      /* two banks of bent parallel cuts, the way an engraver renders a
         passage of water. The positions are analytic, so a second visit
         and a posed frame agree on every cut. */
      const travel = reduced ? 0 : Math.min(t, T_SETTLE_IN) * 0.025
      const x = (((((s.u0 - travel) % 1) + 1) % 1) - 0.5) * aspect * 2.8
      const row = Math.floor(i / (STROKES / 70))
      const upper = row < 35
      const layer = (row % 35) / 34
      const y = (upper ? 0.42 : -0.64) + (layer - 0.5) * (upper ? 0.43 : 0.52)
      const bend =
        0.15 * Math.sin(x * 2.25 + (upper ? 0 : 2.4)) +
        0.045 * Math.sin(x * 5.1 + layer * 1.4)
      s.u = x
      s.v = y + bend + x * 0.06
      s.ang =
        Math.atan(
          0.06 + 0.3375 * Math.cos(x * 2.25 + (upper ? 0 : 2.4)) +
            0.2295 * Math.cos(x * 5.1 + layer * 1.4)
        ) + (s.cross ? 0.54 : 0)
      // the tonal field: the ink goes fine and thins out around his
      // light, and stays heavy at the edges of the sheet. The glow is
      // not painted in, it is where the strokes stop.
      const dl = Math.hypot(s.u - lightU, s.v - lightV)
      const tone = Math.min(1, Math.max(0, (dl - 0.22) / 0.52))
      // and the sheet is not an even mat: an engraver leaves passages
      // open and builds others up, which is what makes ink read as tone
      const passage =
        0.46 +
        0.34 * (0.5 + 0.5 * Math.sin(s.u * 2.1 + s.v * 1.4)) +
        0.2 * (0.5 + 0.5 * Math.sin(s.v * 3.9 - s.u * 1.1 + 2.3))
      // and the sheet builds toward its own edges: the ink is heaviest
      // where the eye should not go, which is what carries it to him
      const edge = 0.78 + 0.42 * Math.min(1, Math.hypot(s.u / Math.max(aspect, 0.5), s.v))
      const toneW = (0.2 + 0.8 * tone * tone) * passage * edge
      // the cross-hatch only builds at speed: tone belongs to the run
      const crossK = s.cross ? Math.min(1, Math.max(0, (spd - 0.42) / 0.4)) : 1
      let u = s.u
      let v = s.v
      let ang = s.ang
      // a cut runs the width of its own cell: neighbours in a row meet
      // end to end, which is what makes a bank read as one drawn body
      let len =
        ((aspect * 2.8) / (STROKES / 70)) *
        (0.85 + s.bright * 0.3) *
        (0.55 + spd * 0.5) *
        (0.6 + 0.4 * tone) *
        (s.cross ? 0.48 : 1)
      // the near plate runs faster and cuts heavier: that is the whole of
      // the depth here, and it is enough
      let wid = s.wid * (0.45 + toneW * 0.38) * (0.82 + s.plate * 0.15)
      // the banks keep their own margins open, and each one fades at its
      // outer lip: an even mat of cuts is wallpaper, not water
      const quiet =
        (1 - span(0.84, 0.98, Math.abs(s.v))) *
        (1 - 0.88 * Math.exp(-Math.pow((s.v - 0.75) / 0.13, 2))) *
        (1 - 0.8 * Math.exp(-Math.pow((s.v + 0.3) / 0.1, 2)))
      const bank = 0.32 + 0.68 * Math.pow(Math.sin(layer * Math.PI), 0.65)
      let weight = s.bright * beat * (0.16 + spd * 0.84) * toneW * crossK * quiet * bank
      const warmth = Math.min(4, Math.max(0, Math.round((1 - tone) * 4)))
      let col = s.gold
        ? GOLD
        : ((s.cross ? WARM_TONE[warmth] : WARM_WHITE[warmth]) ??
          (s.cross ? STROKE_TONE : STROKE_WHITE))
      const shape = 0

      if (settle > 0 && s.role !== 0) {
        // the press meets successive cuts along the course, and a cut
        // shortens under pressure before it takes its seat in the paper
        const localSettle = ease(span(T_SETTLE_IN + s.seat * 0.22, T_SETTLE_OUT, t))
        if (!s.snapped) {
          s.snapped = true
          s.fu = s.u
          s.fv = s.v
          s.fang = s.ang
          s.flen = len
        }
        if (s.role === 1) {
          // it lies down along the plate mark: the engraving that
          // carried you becomes the impression around his frame
          const seat = seatOf(s.seat, s.seatLen)
          const nx = seat.ang === 0 ? 0 : 1
          const ny = seat.ang === 0 ? 1 : 0
          const away = seat.v > rect.cv ? 1 : -1
          const side = seat.u > rect.cu ? 1 : -1
          const tu = seat.u + nx * s.seatOff * side
          const tv = seat.v + ny * s.seatOff * away
          u = s.fu + (tu - s.fu) * localSettle
          v = s.fv + (tv - s.fv) * localSettle
          const cutAngle = i % 2 ? 0.68 : 0.84
          ang = s.fang + (cutAngle - s.fang) * settle
          len =
            (s.flen + (s.seatLen - s.flen) * localSettle) *
            (1 - Math.sin(localSettle * Math.PI) * 0.64)
          wid = s.wid * (1 - settle * 0.4)
          // seated, they hold one even pressure: a ruled impression, not
          // forty different hands
          weight =
            s.bright * (0.16 + spd * 0.84) * (1 - settle) +
            settle * (0.035 + s.bright * 0.05) * beat
          col = WARM_TONE[2] ?? PLATE_INK
        } else {
          // dust, hanging in the light he arrives with. It stays where
          // it was caught: dust that all swims to one point is a comet.
          const drift = elapsed * (reduced ? 0.04 : 0.14)
          u = s.fu + Math.sin(drift + s.seat * 9) * 0.035
          v = s.fv + settle * 0.03 + Math.cos(drift * 0.8 + s.seat * 7) * 0.028
          len = s.flen * (1 - settle) + settle * 0.009
          wid = s.wid * (1 - settle) + settle * 0.009
          weight = s.bright * (0.16 + spd * 0.84) * (1 - settle) + settle * 0.018 * beat
          col = GOLD
        }
      } else if (settle > 0) {
        // the rest do not vanish, they come to rest: a printed sheet
        // carries tone everywhere, and an empty page is the one thing
        // this arrival cannot be (round 1). Short, or they read as
        // scratches on the plate rather than as its tone (round 3).
        len *= 1 - settle * 0.62
        weight = weight * (1 - settle) + settle * s.bright * 0.012 * toneW * beat
      }
      put(u, v, ang, len, wid, weight, col, shape)
    }

    // ------------------------------------------------------ his glory
    /* short gold cuts radiating from the light: the engraver's sunburst.
       They stay tight around the star so the frame never becomes a
       tunnel, and they turn, slowly, the way everything here turns. */
    const spin = 0.13
    /* short and soft: a long hard ray is a lens flare, and a star with
       twelve of them is a sticker (round 2 shot it on a phone and it
       read as tinsel). These are cuts around a light, nothing more. */
    /* page space is measured against the HEIGHT, so a mark that is
       modest on a desk is a third of a phone's width. His light keeps
       its proportion to the stage it is standing on (round 4). */
    const sizeK = Math.min(1, 0.56 + aspect * 0.3)
    const glowLen = (0.025 + spd * 0.082) * sizeK
    const glow = Math.max(spd * 0.78, arrival * 0.2)
    const RAYS = 67 // fine and many: the corona of a cut light, not a fan
    for (let i = 0; i < RAYS; i++) {
      const a = (i / RAYS) * Math.PI * 2 + spin + Math.sin(i * 3.7) * 0.016
      const scale = 0.45 + Math.abs(Math.sin(i * 2.3)) * 1.1
      const r0 = (0.045 + (1.4 - scale) * 0.012) * sizeK + arrival * 0.16
      put(
        lightU + Math.cos(a) * r0,
        lightV + Math.sin(a) * r0,
        a,
        glowLen * scale,
        0.0026,
        glow * (0.16 + scale * 0.3) * beat,
        i % 5 === 0 ? GOLD_HOT : GOLD,
        0
      )
    }
    // the halo: one fine ruled circle, dash by dash, turning against the
    // rays. It is the faintest mark on the page, so the light keeps the
    // frame and the circle only says the light has an edge.
    const haloR = (0.19 + spd * 0.04) * sizeK
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2 - spin * 1.6
      const dash = 0.03 * sizeK * (i % 3 === 0 ? 0.45 : 1)
      put(
        lightU + Math.cos(a) * haloR - Math.sin(a) * dash * 0.5,
        lightV + Math.sin(a) * haloR + Math.cos(a) * dash * 0.5,
        a + Math.PI / 2,
        dash,
        0.0028,
        spd * 0.15 * (1 - arrival) * beat,
        GOLD,
        1
      )
    }

    // ------------------------------------------------------ the course
    /* the chart line: a dashed portolan course drawn toward his light,
       with three bearing ticks, and a nib at the head while it is being
       laid. It survives the whole run, because it is what you are
       following, and only yields when the portrait takes the frame. */
    const drawn = Math.min(1, span(0.25, 1.5, t))
    const courseK = Math.min(1, drawn) * (1 - span(4.2, 5.3, t))
    if (courseK > 0.002) {
      const DASHES = 60
      for (let i = 0; i < DASHES; i++) {
        const k0 = i / DASHES
        if (k0 > drawn) break
        const p0 = coursePoint(k0)
        const p1 = coursePoint(k0 + 0.86 / DASHES)
        const ang = Math.atan2(p1.v - p0.v, p1.u - p0.u)
        const len = Math.hypot(p1.u - p0.u, p1.v - p0.v)
        const head = drawn < 1 ? 1 - Math.min(1, Math.abs(k0 - drawn) * 8) : 0.42
        put(p0.u, p0.v, ang, len, 0.0034, courseK * (0.42 + head * 0.5) * beat, GOLD, 1)
        if (i % 18 === 9) {
          // a bearing tick, the way a chart marks its own run
          put(p0.u, p0.v - 0.014, ang + Math.PI / 2, 0.028, 0.003, courseK * 0.42, GOLD, 1)
        }
      }
      if (drawn < 1) {
        const nib = coursePoint(drawn)
        put(nib.u - 0.008, nib.v, 0, 0.018, 0.006, courseK * 1.2, GOLD_HOT, 0)
      }
    }

    /* the rose the course departs from: a ruled circle, eight winds and
       three faint rhumbs running off the sheet, the way a portolan
       tells you where its bearings were taken */
    if (courseK > 0.002) {
      const origin = coursePoint(0)
      const radius = Math.min(0.072, aspect * 0.115)
      for (let i = 0; i < 32; i++) {
        const a = (i / 32) * Math.PI * 2
        const r = radius * (i % 4 === 0 ? 1.35 : 1)
        put(
          origin.u + Math.cos(a) * r,
          origin.v + Math.sin(a) * r,
          a + Math.PI / 2,
          radius * 0.16,
          0.0019,
          courseK * 0.24,
          GOLD,
          1
        )
      }
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2
        const r = radius * (i % 2 === 0 ? 0.96 : 0.52)
        put(origin.u, origin.v, a, r, i % 2 === 0 ? 0.005 : 0.0025, courseK * 0.52, GOLD, 0)
      }
      for (const a of [0.17, 0.7, 1.24]) {
        put(
          origin.u - Math.cos(a) * radius * 1.8,
          origin.v - Math.sin(a) * radius * 1.8,
          a,
          Math.min(aspect * 1.35, 1.2),
          0.0015,
          courseK * 0.055,
          PLATE_INK,
          1
        )
      }
    }

    // ------------------------------------------------- the gilt frame
    /* THE DOUBLE HAIRLINE. The shell draws a dark rule around his
       portrait; this is the gilding that rule was asking for — two gold
       lines a few pixels apart, ruled on side by side over three
       quarters of a second, and carried past their own corners the way
       a plate carries registration marks. */
    const gild = span(T_PORTRAIT - 0.15, T_PORTRAIT + 0.85, t)
    const gone = 1 - span(T_BREATH - 0.25, T_BREATH + 0.25, t)
    if (gild > 0.002 && gone > 0.002) {
      // the shell rules the two hairlines in CSS; the plate contributes
      // only the shoulder that catches the light at the corners
      for (let corner = 0; corner < 4; corner++) {
        const su = corner % 2 ? 1 : -1
        const sv = corner < 2 ? 1 : -1
        const u = rect.cu + su * (rect.hu + 0.012)
        const v = rect.cv + sv * (rect.hv + 0.012)
        const shine = (corner === 0 ? 0.85 : corner === 3 ? 0.34 : 0.12) * gild * gone
        put(u - (su > 0 ? 0.045 : 0), v, 0, 0.045, 0.0025, shine, GOLD_HOT, 1)
        put(u, v - (sv > 0 ? 0.045 : 0), Math.PI / 2, 0.045, 0.002, shine * 0.7, GOLD, 1)
      }
    }

    // only the cuts actually laid this frame are drawn
    fieldGeo.instanceCount = cursor
    aA.needsUpdate = true
    aB.needsUpdate = true
    aC.needsUpdate = true

    // ------------------------------------------------------- the beats
    // the voice homes in: fragments, then the sentence begun in space
    if (t >= T_VOICE_FRAGMENTS && t < T_VOICE_CLEAN) setVoice(VOICE_FRAGMENTS, false)
    if (t >= T_VOICE_CLEAN && t < T_VOICE_FADE) setVoice(VOICE_CLEAN, true)
    if (t >= T_VOICE_FADE) voiceEl.classList.remove('lit')

    // the portrait blooms: the atlas entry is the arrival
    if (t >= T_PORTRAIT) portraitEl.classList.add('lit')
    portraitEl.style.setProperty('--print', String(ease(span(T_PORTRAIT, T_PORTRAIT + 0.8, t))))

    // the gold breath: one heartbeat of warm gold with a single dark line
    if (t >= T_BREATH - 0.5) paintGlory()
    if (t >= T_BREATH) {
      breathEl.classList.add('lit')
      portraitEl.classList.remove('lit')
      // the light does not sit still while it swallows the frame
      const swell = 1 + span(T_BREATH, T_DONE, t) * 0.06
      glory.style.transform = `scale(${swell.toFixed(3)})`
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
