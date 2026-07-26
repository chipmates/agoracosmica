/* THE SIGN — a figure's Wisdom Map as a constellation. First organ
   extraction by the rule of two: His Sky (the living concept page) and
   the camp's duskrise both raise it. N seed stars seated in the
   figure's zodiac pattern, each bloom level 0..4 a visibly richer FORM
   of light (ember, kindled, risen, radiant, bloomed), one hairline
   chain drawing the whole animal in a single stroke.

   THE BLOOM LANGUAGE: the five stages are told apart by what the eye can
   COUNT, never by how blurred a ball is.

     ember    a coal shut inside its husk    no rays, an ashen shell
     kindled  the seed splits its shell      two rays, still inside it
     risen    a star on a chart              four rays, out through the mark
     radiant  it carries a corona            eight rays, an aureole
     bloomed  worth the nights it took       eight long and eight short
                                             between them, a white centre,
                                             and no circle left at all

   0, 2, 4, 8, 16 reads across a room and on a phone. Blur radius does
   not, and the first pass proved it: at the duskrise every stage was the
   same gold ball at a different size, and the ONE stage that was supposed
   to be the reward was the least drawn mark in the frame.

   The arc the circle takes is its own half of the story: the seed is
   SHUT in a shell, then MARKED as a star, then the ring gives way and
   there is nothing out there but light.

   SIZED BY THE FIGURE ITSELF: every length in here is a fraction of the
   pattern's own median star spacing, so the sign reads the same density
   in the camp's frame, in the concept's frame, and at the 0.62 a phone
   scales it to. Nothing is an absolute world constant.

   ONE DRAW EACH: the stars are one instanced quad field and the chain is
   another (sized fields ride instanced quads, never Points). Fifty-nine
   draw calls became two.

   Organ law (Bible Law 25): the sign receives its frame, its seeded
   hand, and its palette from the world; it never owns the light. The
   world scales every glow through update()'s master. */

import {
  AdditiveBlending,
  Color,
  Float32BufferAttribute,
  Group,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  MeshBasicNodeMaterial,
  Vector3,
} from 'three/webgpu'
import {
  abs,
  attribute,
  cameraProjectionMatrix,
  cameraViewMatrix,
  dot,
  exp,
  float,
  fract,
  length,
  max,
  min,
  mix,
  modelWorldMatrix,
  oneMinus,
  pow,
  screenCoordinate,
  sin,
  smoothstep,
  uniform,
  uv,
  varying,
  vec2,
  vec3,
  vec4,
} from 'three/tsl'
import type { SignPattern } from '../content/signs'

/* the TSL runtime chains and swizzles these fine; the generated typings
   do not follow a graph built out of helpers — the same boundary escape
   the firmament and the camp's ink both take */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any

export interface SignOptions {
  pattern: SignPattern
  /** the frame the sign must fill, world units (aspect preserved) */
  width: number
  height: number
  /** the world's seeded hand (determinism law) */
  rand(): number
  /** the world's palette; canon gold by default */
  gold?: Color
  ember?: Color
  starlight?: Color
}

export interface Sign {
  group: Group
  /** per-seed anchors, for letterpress labels and buttons to project */
  stars: Group[]
  /** displayed (eased) bloom levels 0..4 */
  shown: number[]
  /** ease the stars toward levels; master scales every light (0..1) */
  update(dt: number, elapsed: number, levels: number[], master?: number): void
  /** land on levels instantly (reduced motion, the rig's frozen eye) */
  snap(levels: number[]): void
}

const reducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/* ------------------------------------------------------- the palette ---
   Colours are authored as hex and read through three's Color, which hands
   back the linear values the shaders want. TWO ramps, because a bloomed
   star burns white at its centre inside a corona that stays gold: gold in
   this night emits, it never fills. */
const ASH = new Color('#8d8892')
const GOLD_HEX = '#e0b96a'
const EMBER_HEX = '#bd6d2c'
const STARLIGHT_HEX = '#fffaf0'

/** the five stages, sampled continuously */
function rampAt(ramp: Color[], level: number, into: Color): Color {
  const last = ramp.length - 1
  const t = Math.min(last, Math.max(0, level))
  const i = Math.min(last - 1, Math.floor(t))
  const a = ramp[i] ?? ramp[0]
  const b = ramp[i + 1] ?? a
  if (!a || !b) return into.setRGB(0, 0, 0)
  return into.copy(a).lerp(b, t - i)
}

/* fit ANY sign into a generous frame: normalize the pattern's own bounds
   and keep its aspect. The seats come back flat; the depth is added after
   the spacing is known, because a whisper of depth is a FRACTION of how
   far apart these stars sit and never a world constant. */
function fitPattern(pattern: SignPattern, w: number, h: number): Array<[number, number]> {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const [x, y] of pattern) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x)
    minY = Math.min(minY, y); maxY = Math.max(maxY, y)
  }
  const sx = w / Math.max(1e-6, maxX - minX)
  const sy = h / Math.max(1e-6, maxY - minY)
  const k = Math.min(sx, sy)
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  return pattern.map(([x, y]) => [(x - cx) * k, (cy - y) * k])
}

/** THE UNIT: how far apart this figure's stars actually sit. Every mark in
    the bloom language is a fraction of it, which is what lets one organ be
    raised into two frames at two fit scales and read the same in both. */
function medianSpacing(seats: Array<[number, number]>): number {
  const near: number[] = []
  for (let i = 0; i < seats.length; i++) {
    const a = seats[i]
    if (!a) continue
    let best = Infinity
    for (let j = 0; j < seats.length; j++) {
      if (i === j) continue
      const b = seats[j]
      if (!b) continue
      best = Math.min(best, Math.hypot(a[0] - b[0], a[1] - b[1]))
    }
    if (Number.isFinite(best)) near.push(best)
  }
  if (!near.length) return 1
  near.sort((x, y) => x - y)
  return Math.max(1e-3, near[Math.floor(near.length / 2)] ?? 1)
}

// ------------------------------------------------------- the shared hand
/** a ring with no edge on either side of it */
const ringAt = (r: N, at: N, w: N): N => pow(oneMinus(min(abs(r.sub(at)).div(w), 1)), 2.4)

/** a needle of light: it runs to `reach` and thins as it goes */
const ray = (along: N, across: N, reach: N, wide: number): N => {
  const run = pow(smoothstep(reach, float(0), along), 1.7)
  const thin = max(float(wide).mul(oneMinus(along.div(reach.add(0.001)).mul(0.88))), 0.0035)
  return run.mul(smoothstep(thin, float(0), across))
}

/** THE SHOULDER — the camp's law, and the sign keeps it: a soft rolloff on
    the bright end so a bloomed star rolls over instead of clipping into a
    white hole, and the darks stay exactly where they were authored. */
const shoulder = (c: N): N => c.div(float(1).add(c.mul(0.42)))

/** dither at creation, so the one wide gradient in this organ does not band */
const dither = (amp: number): N =>
  fract(sin(dot(screenCoordinate.xy.add(0.5), vec2(12.9898, 78.233))).mul(43758.5453))
    .sub(0.5)
    .mul(amp)

/** a unit quad, instanced. The vertex path billboards it in view space and
    sizes it in WORLD units, so the group's own scale and position carry. */
function quadField(n: number): InstancedBufferGeometry {
  const g = new InstancedBufferGeometry()
  g.setAttribute(
    'position',
    new Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3)
  )
  g.setAttribute('uv', new Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2))
  g.setIndex([0, 1, 2, 0, 2, 3])
  g.instanceCount = n
  return g
}

/** the world scale the group is carrying, read off the model matrix: one
    local unit, measured after the transform. A phone scales this group to
    0.62 and every mark has to come with it. */
function worldK(at: N): N {
  const centre = modelWorldMatrix.mul(vec4(at, 1)).xyz
  const along = modelWorldMatrix.mul(vec4(at.add(vec3(1, 0, 0)), 1)).xyz
  return max(length(along.sub(centre)), 1e-5)
}

interface SeedStar {
  group: Group
  level: number
  shown: number
  prev: number
  wake: number
  base: Vector3
  phase: number
}

// ---------------------------------------------------------- the almanac
/* THE CURRENT — one light walks the whole animal, nose to tail, every
   nineteen seconds. It is the difference between twelve stars that happen
   to be joined and one figure being drawn. It happens, then it stops:
   nothing in this night pulses. */
const RUN_PERIOD = 19
const RUN_FLIGHT = 7.2
const smooth01 = (x: number): number => {
  const t = Math.min(1, Math.max(0, x))
  return t * t * (3 - 2 * t)
}

export function createSign(opts: SignOptions): Sign {
  const GOLD = opts.gold ?? new Color(GOLD_HEX)
  const EMBER = opts.ember ?? new Color(EMBER_HEX)
  const STARLIGHT = opts.starlight ?? new Color(STARLIGHT_HEX)

  /* the core is what the seed itself is made of: a coal, then a flame,
     then a star, then light. The glow is everything the seed THROWS —
     husk, rays, rings, aureole — and it only reaches gold once the seed
     has earned it. */
  const CORE_RAMP = [
    EMBER.clone(),
    EMBER.clone().lerp(GOLD, 0.62),
    GOLD.clone().lerp(STARLIGHT, 0.2),
    GOLD.clone().lerp(STARLIGHT, 0.6),
    STARLIGHT.clone(),
  ]
  // the corona stays GOLD to the end. Only the seed's own centre is ever
  // allowed white, which is the whole of the law out here: gold emits, it
  // does not fill, and a sky of white starbursts is a lens, not a night.
  const GLOW_RAMP = [
    ASH.clone(),
    ASH.clone().lerp(GOLD, 0.68),
    GOLD.clone(),
    GOLD.clone().lerp(STARLIGHT, 0.1),
    GOLD.clone().lerp(STARLIGHT, 0.16),
  ]

  const group = new Group()
  const flat = fitPattern(opts.pattern, opts.width, opts.height)
  /** every length in this organ is a fraction of this one number */
  const UNIT = medianSpacing(flat)
  const n = opts.pattern.length

  // the quad has to hold the widest thing the language ever draws, which
  // is the bloomed star's aureole
  const STAR_QUAD = UNIT * 1.5
  const STAR_HALF = STAR_QUAD * 0.5
  const THREAD_W = UNIT * 0.075
  const LIFT = UNIT * 0.058

  const seeds: SeedStar[] = []
  for (let i = 0; i < n; i++) {
    const seat = flat[i] ?? [0, 0]
    const g = new Group()
    // a whisper of depth, not half a spacing: the sign is a DRAWING, and
    // the first pass hung its stars +-1.7 units apart in z on a 3.7 unit
    // spacing, which is what made the chain cross itself
    const base = new Vector3(seat[0], seat[1], (opts.rand() - 0.5) * UNIT * 0.22)
    g.position.copy(base)
    group.add(g)
    seeds.push({ group: g, level: 0, shown: 0, prev: 0, wake: 0, base, phase: opts.rand() * Math.PI * 2 })
  }

  // ---- the chain, measured: the current runs at one speed along the
  // whole stroke, so every bind carries where it sits in the drawing
  const spans: number[] = []
  let total = 0
  for (let i = 0; i < n - 1; i++) {
    const a = seeds[i]?.base
    const b = seeds[i + 1]?.base
    const d = a && b ? Math.hypot(b.x - a.x, b.y - a.y) : 0
    spans.push(d)
    total += d
  }
  const arcs: number[] = [0]
  {
    let run = 0
    for (const d of spans) {
      run += d
      arcs.push(total > 1e-6 ? run / total : 0)
    }
  }

  const uT = uniform(0)
  const uMaster = uniform(0)
  const uRun = uniform(0)
  const uRunOn = uniform(0)

  // ------------------------------------------------------ THE SEED STARS
  const sPos = new Float32Array(n * 3)
  const sLvl = new Float32Array(n * 3)
  const sCore = new Float32Array(n * 3)
  const sGlow = new Float32Array(n * 3)
  const aPos = new InstancedBufferAttribute(sPos, 3)
  const aLvl = new InstancedBufferAttribute(sLvl, 3)
  const aCore = new InstancedBufferAttribute(sCore, 3)
  const aGlow = new InstancedBufferAttribute(sGlow, 3)
  const starGeo = quadField(n)
  starGeo.setAttribute('iPos', aPos)
  starGeo.setAttribute('iLvl', aLvl)
  starGeo.setAttribute('iCore', aCore)
  starGeo.setAttribute('iGlow', aGlow)

  const starMat = new MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  })
  {
    const iPos = attribute('iPos', 'vec3') as N
    const iLvl = attribute('iLvl', 'vec3') as N
    const iCore = attribute('iCore', 'vec3') as N
    const iGlow = attribute('iGlow', 'vec3') as N

    const viewC = cameraViewMatrix.mul(vec4(modelWorldMatrix.mul(vec4(iPos, 1)).xyz, 1)) as N
    const off = uv().sub(vec2(0.5, 0.5)).mul(STAR_QUAD).mul(worldK(iPos))
    starMat.vertexNode = cameraProjectionMatrix.mul(
      vec4(viewC.xy.add(off), viewC.z, viewC.w)
    )

    const L = varying(iLvl.x) as N
    const wake = varying(iLvl.y) as N
    const phase = varying(iLvl.z) as N
    const cCore = varying(iCore) as N
    const cGlow = varying(iGlow) as N

    const p = uv().sub(vec2(0.5, 0.5)).mul(2) as N
    const r = length(p)
    // the five stages, continuous. Each one is a THING that arrives, and
    // the ones below it stay: that is why the eye can count them.
    const w1 = smoothstep(0.06, 1.0, L)
    const w2 = smoothstep(1.0, 2.0, L)
    const w3 = smoothstep(2.0, 3.0, L)
    const w4 = smoothstep(3.0, 4.0, L)

    // THE WAKE — a stage crossed is an event, never a ramp. One ring
    // leaves the seed and does not come back, and the seed flares as it
    // goes. wake sits at exactly 0 when nothing is happening.
    const wk = min(wake, 1)
    const alive = min(wk.mul(26), 1)
    const wEase = oneMinus(pow(oneMinus(wk), 2.3))
    const wakeRing = ringAt(r, float(0.15).add(wEase.mul(0.66)), float(0.05).add(wEase.mul(0.055)))
      .mul(pow(oneMinus(wk), 1.7))
      .mul(alive)
      .mul(0.62)
    const flare = float(1).add(pow(oneMinus(wk), 2.2).mul(alive).mul(0.85))

    // 1 · THE POINT — the seed itself: a tight core, a soft skirt, and a
    // low warm breath around it, because an ember is a COAL and not a
    // pinprick. This is the mark that has to carry stage one on its own.
    const coreR = float(0.125).add(w2.mul(0.026)).add(w4.mul(0.018))
    const fall = oneMinus(min(r.div(coreR), 1))
    const seat = oneMinus(min(r.div(coreR.mul(2.4)), 1))
    const point = pow(fall, 2.2).mul(0.4).add(pow(fall, 9).mul(1.05)).add(pow(seat, 2.6).mul(0.19))
    const breath = reducedMotion
      ? float(1)
      : float(1).add(sin(uT.mul(0.62).add(phase)).mul(0.07).mul(min(L, 1)))
    const pointK = float(0.62).add(w1.mul(0.2)).add(w2.mul(0.22)).add(w3.mul(0.34)).add(w4.mul(0.42))

    // 2 · THE HUSK — the shell a seed is shut inside, with the ash of it
    // lying close around the coal. It starts cold, because nothing here
    // has been earned yet, takes a little of the seed's own warmth as the
    // seed splits, and by the time the star has risen it is gone. A
    // WHISPER of a shell: round 1 drew it as a stroke and twelve badges
    // came back.
    const husk = ringAt(r, float(0.245).add(w1.mul(0.095)), float(0.072).add(w1.mul(0.04)))
      .mul(float(0.21).sub(w1.mul(0.06)))
      .add(pow(oneMinus(min(r.div(0.36), 1)), 2.2).mul(0.028))
      .mul(oneMinus(w2))

    // 3 · THE MARK — the quiet circle that says this is a star on a
    // chart. It arrives when the seed has risen, and then it GIVES WAY:
    // by full bloom there is no circle left at all, only light. Round 2
    // kept a rim out here and every bloomed seed came back a bullseye —
    // a bright disc, a dark trough, a ring. The arc the language actually
    // wants is shell, then mark, then nothing but corona.
    const mark = ringAt(r, float(0.315).add(w4.mul(0.06)), float(0.07).add(w4.mul(0.05)))
      .mul(w2.mul(0.17))
      .mul(oneMinus(w4.mul(0.92)))

    // 5 · THE RAYS — what is actually countable, and the whole escalation
    // is in how far they run. At the split they stay INSIDE the husk. At
    // risen the cross breaks out through the mark. Then eight, then eight
    // running long. Two, four, eight, eight-long reads across a room.
    const ax = abs(p.x)
    const ay = abs(p.y)
    const qx = abs(p.x.add(p.y).mul(0.70710678))
    const qy = abs(p.y.sub(p.x).mul(0.70710678))
    const reachV = float(0.3).add(w2.mul(0.16)).add(w3.mul(0.12)).add(w4.mul(0.2))
    const reachH = float(0.06).add(w2.mul(0.4)).add(w3.mul(0.12)).add(w4.mul(0.2))
    const reachD = float(0.06).add(w3.mul(0.32)).add(w4.mul(0.22))
    const rays = ray(ay, ax, reachV, 0.05)
      .mul(w1)
      .add(ray(ax, ay, reachH, 0.05).mul(w2))
      .add(ray(qy, qx, reachD, 0.04).add(ray(qx, qy, reachD, 0.04)).mul(w3).mul(0.86))
      .mul(float(0.36).add(w4.mul(0.4)))

    // 6 · THE ROSE — bloom alone. Eight SHORT petals threaded between the
    // eight long ones, which is what turns a corona into something worth
    // the nights it took. It is light, not a rim: whatever a full seed
    // earns out here, it earns as more light.
    const rx = p.x.mul(0.92387953).add(p.y.mul(0.38268343))
    const ry = p.y.mul(0.92387953).sub(p.x.mul(0.38268343))
    const sx = abs(rx.add(ry).mul(0.70710678))
    const sy = abs(ry.sub(rx).mul(0.70710678))
    const reachR = float(0.06).add(w4.mul(0.4))
    const rose = ray(abs(ry), abs(rx), reachR, 0.032)
      .add(ray(abs(rx), abs(ry), reachR, 0.032))
      .add(ray(sy, sx, reachR, 0.032))
      .add(ray(sx, sy, reachR, 0.032))
      .mul(w4)
      .mul(0.4)

    // 7 · THE AUREOLE — the air around anything truly bright
    const aur = pow(oneMinus(min(r.div(0.8), 1)), 2.8)
    const aurK = w2.mul(0.03).add(w3.mul(0.045)).add(w4.mul(0.095))

    const lit = cCore
      .mul(point.mul(pointK).mul(breath).mul(flare))
      .add(cGlow.mul(husk.add(mark).add(rays).add(rose).add(aur.mul(aurK)).add(wakeRing)))
    starMat.colorNode = shoulder(lit).add(dither(0.006).mul(aur)).mul(uMaster)
  }
  const starMesh = new Mesh(starGeo, starMat)
  starMesh.frustumCulled = false
  group.add(starMesh)

  // --------------------------------------------------------- THE BINDING
  /* One hairline chain draws the whole figure in one stroke, and the
     whole stroke is always there: the sign has to read as a SIGN on the
     first night, its light still unearned. A ribbon, not a Line — a Line
     in this pipeline is one device pixel wide however far away it is,
     which on a phone is half a CSS pixel and aliases into dashes. */
  const m = Math.max(0, n - 1)
  const bA = new Float32Array(m * 3)
  const bB = new Float32Array(m * 3)
  const bSeg = new Float32Array(m * 4)
  const bEnd = new Float32Array(m * 2)
  const aA = new InstancedBufferAttribute(bA, 3)
  const aB = new InstancedBufferAttribute(bB, 3)
  const aSeg = new InstancedBufferAttribute(bSeg, 4)
  const aEnd = new InstancedBufferAttribute(bEnd, 2)
  const bindGeo = quadField(m)
  bindGeo.setAttribute('iA', aA)
  bindGeo.setAttribute('iB', aB)
  bindGeo.setAttribute('iSeg', aSeg)
  bindGeo.setAttribute('iEnd', aEnd)

  const bindMat = new MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  })
  {
    const iA = attribute('iA', 'vec3') as N
    const iB = attribute('iB', 'vec3') as N
    const iSeg = attribute('iSeg', 'vec4') as N
    const iEnd = attribute('iEnd', 'vec2') as N

    const aV = cameraViewMatrix.mul(vec4(modelWorldMatrix.mul(vec4(iA, 1)).xyz, 1)) as N
    const bV = cameraViewMatrix.mul(vec4(modelWorldMatrix.mul(vec4(iB, 1)).xyz, 1)) as N
    const along = uv().x
    const pV = mix(aV, bV, along) as N
    // the ribbon faces the camera in view space; a segment pointing at the
    // eye has no direction on the glass, so the length is floored
    const d = bV.xy.sub(aV.xy) as N
    const dir = d.div(max(length(d), 1e-4))
    const perp = vec2(dir.y.negate(), dir.x)
    const across = uv().y.sub(0.5).mul(THREAD_W).mul(worldK(iA))
    bindMat.vertexNode = cameraProjectionMatrix.mul(
      vec4(pV.xy.add(perp.mul(across)), pV.z, pV.w)
    )

    const seg = varying(iSeg) as N
    const ends = varying(iEnd) as N
    const t = uv().x
    const v = abs(uv().y.sub(0.5).mul(2)) as N
    // A HAIRLINE THAT SURVIVES THE RASTER. The lit part of the ribbon has
    // to be a whole pixel wide or a diagonal samples in and out of it and
    // the chain comes back DASHED, which is exactly what round 3 shot. So
    // the profile is soft and broad inside a narrow ribbon rather than a
    // needle inside a wide one.
    const thread = pow(oneMinus(v), 1.6).mul(0.56).add(pow(oneMinus(v), 5.0).mul(0.36))
    // it stops short of both stars, the way a hand draws a chart, and a
    // brighter seed pushes its end of the line further away
    const gap = smoothstep(seg.x.mul(0.42), seg.x, t).mul(
      smoothstep(oneMinus(seg.y.mul(0.42)), oneMinus(seg.y), t)
    )
    const earned = mix(ends.x, ends.y, t)

    // THE CURRENT, in the drawing's own arc length, so the light crosses
    // every bind at one speed. It rides the THREAD's own core and not its
    // skirt: fed through the whole ribbon it lit the full width and came
    // back a white blade laid over the chain instead of a light walking it.
    const arc = mix(seg.z, seg.w, t)
    const dd = arc.sub(uRun).div(0.03)
    const bead = exp(dd.mul(dd).negate()).mul(uRunOn).mul(float(0.34).add(earned.mul(0.66)))
    const spark = pow(oneMinus(v), 5.0).mul(bead)

    const tint = mix(vec3(ASH.r, ASH.g, ASH.b), vec3(GOLD.r, GOLD.g, GOLD.b), earned)
    const glow = thread.mul(gap).mul(float(0.24).add(earned.mul(0.66))).add(spark.mul(gap).mul(0.85))
    bindMat.colorNode = mix(
      tint,
      vec3(STARLIGHT.r, STARLIGHT.g, STARLIGHT.b),
      min(bead.mul(0.62), 0.8)
    )
      .mul(glow)
      .mul(uMaster)
  }
  const bindMesh = new Mesh(bindGeo, bindMat)
  bindMesh.frustumCulled = false
  group.add(bindMesh)

  const shown: number[] = new Array(n).fill(0)
  const scratchCore = new Color()
  const scratchGlow = new Color()

  /** the gap a star opens at its end of a bind, in world units */
  const gapOf = (level: number): number => STAR_HALF * (0.34 + 0.16 * Math.min(1, level / 4))

  function write(): void {
    for (let i = 0; i < n; i++) {
      const s = seeds[i]
      if (!s) continue
      const L = s.shown
      sPos[i * 3] = s.group.position.x
      sPos[i * 3 + 1] = s.group.position.y
      sPos[i * 3 + 2] = s.group.position.z
      sLvl[i * 3] = L
      sLvl[i * 3 + 1] = s.wake
      sLvl[i * 3 + 2] = s.phase
      rampAt(CORE_RAMP, L, scratchCore)
      rampAt(GLOW_RAMP, L, scratchGlow)
      sCore[i * 3] = scratchCore.r
      sCore[i * 3 + 1] = scratchCore.g
      sCore[i * 3 + 2] = scratchCore.b
      sGlow[i * 3] = scratchGlow.r
      sGlow[i * 3 + 1] = scratchGlow.g
      sGlow[i * 3 + 2] = scratchGlow.b
    }
    for (let i = 0; i < m; i++) {
      const a = seeds[i]
      const b = seeds[i + 1]
      if (!a || !b) continue
      bA[i * 3] = a.group.position.x
      bA[i * 3 + 1] = a.group.position.y
      bA[i * 3 + 2] = a.group.position.z
      bB[i * 3] = b.group.position.x
      bB[i * 3 + 1] = b.group.position.y
      bB[i * 3 + 2] = b.group.position.z
      const span = Math.max(1e-4, spans[i] ?? 1)
      bSeg[i * 4] = Math.min(0.34, gapOf(a.shown) / span)
      bSeg[i * 4 + 1] = Math.min(0.34, gapOf(b.shown) / span)
      bSeg[i * 4 + 2] = arcs[i] ?? 0
      bSeg[i * 4 + 3] = arcs[i + 1] ?? 1
      // A BIND IS EARNED BY ITS DIMMER END: a chain is only as awake as
      // the seed it is still waiting on. But a seed that IS awake spills
      // into the line leaving it, so a bloom joined to an ember draws
      // gold at one end and ash at the other, and the stroke reads as
      // light on its way somewhere rather than as twelve dots wired up.
      const on = Math.max(0, Math.min(a.shown, b.shown) - 0.5) / 3.5
      bEnd[i * 2] = Math.min(1, Math.max(on, Math.min(1, a.shown / 4) * 0.6))
      bEnd[i * 2 + 1] = Math.min(1, Math.max(on, Math.min(1, b.shown / 4) * 0.6))
    }
    aPos.needsUpdate = true
    aLvl.needsUpdate = true
    aCore.needsUpdate = true
    aGlow.needsUpdate = true
    aA.needsUpdate = true
    aB.needsUpdate = true
    aSeg.needsUpdate = true
    aEnd.needsUpdate = true
  }

  function update(dt: number, elapsed: number, levels: number[], master = 1): void {
    uT.value = elapsed
    uMaster.value = master
    starMesh.visible = master > 0.004
    bindMesh.visible = starMesh.visible

    // the almanac: one pass of the current, then a long quiet
    if (reducedMotion) {
      uRun.value = 0
      uRunOn.value = 0
    } else {
      const tin = elapsed - Math.floor(elapsed / RUN_PERIOD) * RUN_PERIOD
      const p = tin / RUN_FLIGHT
      uRun.value = smooth01(p)
      uRunOn.value =
        p > 0 && p < 1 ? smooth01(p / 0.09) * smooth01((1 - p) / 0.12) : 0
    }

    for (let i = 0; i < n; i++) {
      const s = seeds[i]
      if (!s) continue
      s.level = levels[i] ?? 0
      // a fast attack and a slow settle, frame-rate honest, and it never
      // overshoots, because nothing in this night bounces
      s.prev = s.shown
      s.shown += (s.level - s.shown) * (1 - Math.exp(-dt * 3.1))
      shown[i] = s.shown
      // A STAGE CROSSED IS AN EVENT. The seed all but arrives at a stage,
      // and at that instant one ring leaves it. This is what a waking
      // looks like; an opacity ramp is what it looked like before.
      const gate = Math.ceil(s.prev + 0.14 - 1e-6)
      if (gate >= 1 && gate <= 4 && s.prev < gate - 0.14 && s.shown >= gate - 0.14) s.wake = 1e-4
      if (s.wake > 0) {
        s.wake += dt / 1.25
        if (s.wake >= 1) s.wake = 0
      }
      if (reducedMotion) s.wake = 0
      // a waking star rises a breath, and the chain rises with it
      s.group.position.y = s.base.y + Math.min(1, s.shown / 4) * LIFT
    }
    write()
  }

  function snap(levels: number[]): void {
    for (let i = 0; i < n; i++) {
      const s = seeds[i]
      if (!s) continue
      s.level = s.shown = s.prev = levels[i] ?? 0
      s.wake = 0
      shown[i] = s.shown
      s.group.position.y = s.base.y + Math.min(1, s.shown / 4) * LIFT
    }
    write()
  }

  return {
    group,
    stars: seeds.map((s) => s.group),
    shown,
    update,
    snap,
  }
}
