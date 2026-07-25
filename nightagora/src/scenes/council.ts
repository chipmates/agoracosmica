/* Beat 11 · THE COUNCIL — the agora convening. Four lights come down out
   of the night and take their places at the fire, the blaze answers each
   arrival, the circle closes on the stone, and the real council preview
   plays under a thin cartouche bar.

   THE LAWS THIS BEAT IS CARVED FROM (the camp's, ported):
   · a voice is a LIGHT, never a body: no faces, no silhouettes, no chairs
     with backs. What arrives is a presence — a core, a halo it throws into
     the air, and a standing column of its own light.
   · organs receive light, they never own it. The four seats live in one
     block of uniforms, and the marble, the stone seats, the colonnade and
     the air all read the SAME four lights. One write per frame lights the
     whole circle.
   · one heartbeat: the flame, the pools, the washes and the motes answer a
     single flicker signal, so the agora breathes as one body.
   · every repeated thing is one draw call, and every sized field rides
     instanced quads (three ignores sizeNode on Points, forge lesson 13).
   · gold only ever emits or reflects. Everything gold here is either a
     light or stone remembering one.

   Disclosure stays in ink below the topic. The letterpress owns the top of
   the frame and the bottom bar, so nothing bright is ever staged there. */

import {
  AdditiveBlending,
  CircleGeometry,
  Color,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  MeshBasicNodeMaterial,
  PerspectiveCamera,
  Scene,
  Vector3,
  Vector4,
} from 'three/webgpu'
import * as TSL from 'three/tsl'
import { AUDIO_COUNCIL } from '../content/media'
import { COUNCIL_SEATS } from '../content/council'
import { FOUNDING_SEED, mulberry32 } from '../core/seed'

/* TSL, uncast — same boundary the camp keeps: TSL's own overloads cannot
   follow a graph built out of helpers, and the shaders are the part a human
   has to be able to read. One cast here buys that. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any
const {
  attribute,
  cameraProjectionMatrix,
  cameraViewMatrix,
  clamp,
  cos,
  dot,
  float,
  fract,
  length,
  max,
  min,
  mix,
  mx_noise_float,
  normalize,
  normalLocal,
  oneMinus,
  positionLocal,
  positionWorld,
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
} = TSL as unknown as Record<string, N>

/* craft law: sRGB lies. Every hand-picked colour goes through three's Color,
   which reads the hex as sRGB and hands back the LINEAR values the shaders
   want. */
const lin = (hex: string): Color => new Color(hex)
const c3 = (c: Color, k = 1): N => vec3(c.r * k, c.g * k, c.b * k)
const hex3 = (h: string, k = 1): N => c3(lin(h), k)

const GOLD = lin('#e0b96a')
const MODERATOR = lin('#f3efe2')
const WHITE_HOT = lin('#fff6e0')

/** the agora's staging, mirrored here because the council is staged INSIDE
    it: the marble plane, and the fire the circle gathers around */
const FLOOR_Y = -0.9
const FIRE = { x: 0, y: -0.45, z: -5.6 }
/** a voice hovers a hand above its seat */
const SEAT_Y = -0.24
/* Where they come from. A 46 degree lens at five metres shows almost no
   sky over the circle, so a light dropped from the zenith spends its whole
   fall above the frame and arrives as a streak with no head (round 6's
   arrival frames). These come out of the deep night BEHIND the colonnade
   instead: high, far back, and swinging forward into their places, which
   keeps the head on screen for the whole descent. */
const FROM_Y = 3.6
const FROM_Z = 2.6

/** THE FOUR VOICES. Character is mostly BEHAVIOUR, not hue: the palette
    stays inside gold and starlight, and what separates them is how wide
    they burn, how tall they stand and how they breathe. The moderator is
    the only cool one, so the circle reads its centre at a glance. */
interface Voice {
  hex: string
  /** how wide the aura opens */
  aura: number
  /** how far the standing column reaches */
  col: number
  /** the breath rate of this presence */
  breath: number
  /** how far its light spreads on the stone */
  pool: number
  gain: number
}
const VOICES: Voice[] = [
  { hex: '#f2b055', aura: 1.12, col: 0.9, breath: 0.72, pool: 1.05, gain: 1.0 },
  { hex: '#f6f0dd', aura: 0.94, col: 1.26, breath: 0.5, pool: 0.92, gain: 1.06 },
  { hex: '#ecd39a', aura: 0.86, col: 1.02, breath: 1.35, pool: 0.86, gain: 0.96 },
  { hex: '#e8bf72', aura: 1.0, col: 0.82, breath: 0.6, pool: 1.22, gain: 0.92 },
]
/** who moderates is the content file's to say, not this scene's */
const MOD = Math.max(0, COUNCIL_SEATS.findIndex((s) => s.moderator))
/** the moderator burns starlight; the rest of the circle burns gold */
const voiceColour = (i: number): Color => (i === MOD ? MODERATOR : lin(VOICES[i]?.hex ?? '#e0b96a'))

export interface CouncilHandles {
  /** The return breath lands: descend the lights, then start the audio. */
  begin(): void
  update(dt: number, elapsed: number, camera: PerspectiveCamera): void
  /** 0..1 how far the blaze has risen (drives the agora fire). */
  blaze(): number
  stop(): void
  forgeStage(camera: PerspectiveCamera): void
  active(): boolean
}

/** a unit quad, instanced: every field in this file is one draw call */
function quadGeo(n: number): InstancedBufferGeometry {
  const g = new InstancedBufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3))
  g.setIndex([0, 1, 2, 0, 2, 3])
  g.instanceCount = n
  return g
}

/** dither at creation: the abyss values are one sRGB step apart, and an
    undithered gradient down here bands like corrugated iron */
const dither = (amp: number): N =>
  fract(sin(dot(screenCoordinate.xy.add(0.5), vec2(12.9898, 78.233))).mul(43758.5453))
    .sub(0.5)
    .mul(amp)

/** a soft round light: q is already divided by its radii */
const gauss = (q: N): N => dot(q, q).negate().exp()

export function createCouncil(scene: Scene, onEnded: () => void): CouncilHandles {
  const root = new Group()
  root.visible = false
  scene.add(root)

  const rand = mulberry32(FOUNDING_SEED + 91)
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // ------------------------------------------------------------ the circle
  /* THE PLACES. Every seat sits on one ring around the fire, and the ring
     is open toward the visitor: the near gap is the fifth place, and the
     visitor is already sitting in it. Angles run from the near axis, so a
     seat is (rx sin, rz cos) off the fire — which is why the circle reads
     as a circle instead of as a row: perspective does the work.

     The ring is WIDER than it is deep on a landscape stage, for two
     reasons. A seating arc facing one viewer always is, and the agora's
     own dressing (its woodpile and its water basin) stands about a quarter
     turn out at four metres: a round ring puts two of the four voices
     directly behind that timber, which is exactly what round 3's frames
     showed. The ellipse steps around it. */
  const WIDE = { rx: 2.98, rz: 2.3, ang: [-86, -32, 32, 86], seat: 0.5, aura: 1, col: 1, wash: 1 }
  /* the narrow stage sees the same ring from inside it: the fire owns the
     middle of a portrait frame, so the near pair closes in and the far pair
     opens just past the flame's own silhouette. Nothing sits behind fire. */
  const NARROW = {
    // the near pair closes and the far pair opens, or the two voices on one
    // flank project onto the same slice of a portrait frame and read as one
    rx: 1.72, rz: 1.72, ang: [-145, -13, 13, 145], seat: 0.36, aura: 0.82, col: 0.86, wash: 0.5,
  }
  type Stage = typeof WIDE
  let stage: Stage = WIDE

  const seatPos = VOICES.map(() => new Vector3())
  const seatYaw = [0, 0, 0, 0]

  function stageSeats(s: Stage): void {
    for (let i = 0; i < seatPos.length; i++) {
      const deg = s.ang[i]
      const p = seatPos[i]
      if (deg === undefined || !p) continue
      const a = (deg * Math.PI) / 180
      p.set(FIRE.x + Math.sin(a) * s.rx, SEAT_Y, FIRE.z + Math.cos(a) * s.rz)
      // the stone turns to the fire, which on an ellipse is not the angle
      // it sits at
      seatYaw[i] = Math.atan2(p.x - FIRE.x, p.z - FIRE.z) + Math.PI
    }
  }
  stageSeats(stage)

  // ----------------------------------------------------------- the light block
  /* Law 25 of the camp, ported: the four presences are ONE block of
     uniforms, and everything else in this file reads them. */
  const uSeatP = VOICES.map(() => uniform(new Vector3()))
  /** the colour a seat throws, already scaled by how bright it is */
  const uSeatC = VOICES.map(() => uniform(new Vector3()))
  /** (pool gain, ripple radius, ripple amplitude, arc settle) */
  const uSeatK = VOICES.map(() => uniform(new Vector4()))
  const uT = uniform(0)
  const uFlick = uniform(0.86)
  const uBlaze = uniform(0)
  const uReveal = uniform(0)
  /** 0..1 how far the circle has closed: the air answers this, not the clock */
  const uClosed = uniform(0)
  /** the ring's two half-axes, so the stone knows the same ellipse the
      seats stand on */
  const uRingA = uniform(WIDE.rx)
  const uRingB = uniform(WIDE.rz)
  const uPx = uniform(0.001)
  /** how much of the colonnade wash this stage can carry */
  const uWash = uniform(1)

  /** what the four presences throw at a point on the ground plane */
  function seatPools(worldXZ: N): N {
    let sum: N = vec3(0, 0, 0)
    for (let i = 0; i < uSeatP.length; i++) {
      const pu = uSeatP[i]
      const cu = uSeatC[i]
      const ku = uSeatK[i]
      const v = VOICES[i]
      if (!pu || !cu || !ku || !v) continue
      const d = vec2(pu.x, pu.z).sub(worldXZ)
      const dd = dot(d, d)
      // a light a hand above the stone makes a soft pool, never a spot —
      // and it has to die fast, or four pools become one haze and the
      // night's floor is gone (round 1)
      const pool = float(1)
        .div(dd.mul(6.5 / v.pool).add(0.3))
        .mul(ku.x)
      sum = sum.add(cu.mul(pool).mul(0.05 * v.pool))
      // and the ripple that ran out of its landing, once
      const ring = gauss(length(d).sub(ku.y).div(0.11)).mul(ku.z)
      sum = sum.add(cu.mul(ring).mul(0.3))
    }
    return sum
  }

  /** the shoulder: a light a hand from a surface is still a light, not a
      white hole. One soft rolloff on the bright end, darks untouched. */
  const shoulder = (c: N): N => c.div(float(1).add(c.mul(0.46)))

  // -------------------------------------------------------------- THE STONE
  /* The marble is the agora's, and it stays the agora's: this is only the
     LIGHT that lands on it. Four pools, the ripples of the four landings,
     the ring closing arc by arc, and the fire's own wash widening as the
     blaze rises. One draw call for all of it. */
  const marbleMat = new MeshBasicNodeMaterial()
  marbleMat.transparent = true
  marbleMat.depthWrite = false
  marbleMat.blending = AdditiveBlending
  {
    const p = positionWorld.xz.sub(vec2(FIRE.x, FIRE.z))
    const r = length(p)
    // the ellipse measured in its own units: 1 is exactly the seat ring
    const q = vec2(p.x.div(uRingA), p.y.div(uRingB))
    const rq = length(q)
    const dir = normalize(q.add(vec2(0.00001, 0.00001)))

    let col: N = seatPools(positionWorld.xz)

    // THE CIRCLE CLOSING: each seat lights its own arc of the ring, and as
    // the four arrive the arcs run together. The gap that stays open faces
    // the visitor, because that place is theirs.
    const band = gauss(rq.sub(1).mul(uRingB).div(0.055))
    const bandOut = gauss(rq.sub(1).mul(uRingB).sub(0.15).div(0.022))
    // the place the ring never closes is the one facing the visitor: they
    // are already sitting in it
    const gap = smoothstep(0.998, 0.955, dot(dir, vec2(0, 1)))
    for (let i = 0; i < uSeatP.length; i++) {
      const pu = uSeatP[i]
      const cu = uSeatC[i]
      const ku = uSeatK[i]
      if (!pu || !cu || !ku) continue
      const sd = normalize(vec2(pu.x.sub(FIRE.x).div(uRingA), pu.z.sub(FIRE.z).div(uRingB)))
      const arc = smoothstep(0.42, 0.96, dot(dir, sd)).mul(ku.w)
      col = col.add(c3(GOLD, 0.44).mul(band.mul(0.9).add(bandOut.mul(0.3))).mul(arc).mul(gap))
    }

    // the fire answering the gathering: its light on the stone widens with
    // the blaze, and trembles on the one heartbeat
    const fall = float(1).div(r.mul(r).mul(0.62).add(0.8))
    col = col.add(hex3('#f0a24a', 0.036).mul(fall).mul(uBlaze).mul(float(0.72).add(uFlick.mul(0.28))))

    // the polish keeps a grain: the stone is not a screen
    const grain = mx_noise_float(vec3(positionWorld.x.mul(1.7), 4.1, positionWorld.z.mul(1.7)))
      .mul(0.12)
      .add(0.94)
    const edge = oneMinus(smoothstep(3.6, 4.9, r))
    marbleMat.colorNode = shoulder(col.mul(grain)).add(dither(0.0032))
    marbleMat.opacityNode = min(edge.mul(uReveal), 1)
  }
  const marble = new Mesh(new CircleGeometry(5.0, 96), marbleMat)
  marble.rotation.x = -Math.PI / 2
  marble.position.set(FIRE.x, FLOOR_Y + 0.005, FIRE.z)
  marble.renderOrder = 3
  root.add(marble)

  // --------------------------------------------------------- THE SEATS
  /* Four drums of the same night stone the colonnade is cut from — a spare
     column base is what an agora has always used for a seat. They are dark
     until something lights them, which is the whole point: the fire finds
     their front, the presence above finds their top, and the gold cut into
     the top face is the mark of a PLACE. */
  const yawRot = (v: N, ang: N): N => {
    const c = cos(ang)
    const s = sin(ang)
    return vec3(c.mul(v.x).add(s.mul(v.z)), v.y, s.negate().mul(v.x).add(c.mul(v.z)))
  }
  const seatMat = new MeshBasicNodeMaterial()
  {
    const iPos = attribute('iPos', 'vec3')
    const iRot = attribute('iRot', 'vec2')
    const iScl = attribute('iScl', 'vec3')
    const world = varying(yawRot(positionLocal.mul(iScl), iRot.x).add(iPos))
    // a squashed box needs its normals unsquashed, or every face lies about
    // which way it points
    const n = varying(normalize(yawRot(normalLocal.div(max(iScl, vec3(0.001, 0.001, 0.001))), iRot.x)))
    seatMat.vertexNode = cameraProjectionMatrix.mul(cameraViewMatrix).mul(vec4(world, 1))

    const alb = c3(lin('#8d8474'))
    // the silhouette value: the same ink the colonnade sinks to, plus the
    // faintest lapis on the upward faces so a seat is a SURFACE, never a
    // hole cut in the marble
    let col: N = hex3('#0a0e22', 0.62).add(hex3('#2b3565', 0.04).mul(max(n.y, 0).mul(0.7).add(0.3)))

    // the fire on their fronts
    const toFire = vec3(FIRE.x, FIRE.y + 0.1, FIRE.z).sub(world)
    const fd = max(dot(toFire, toFire), 0.0001)
    const fn = pow(max(dot(n, toFire.div(fd.sqrt())), 0), 1.9)
    col = col.add(
      hex3('#f0a24a', 0.3).mul(alb).mul(fn).mul(float(3.4).div(fd.add(1.6))).mul(float(0.74).add(uFlick.mul(0.26)))
    )

    // and their own voice, from a hand above: this is what makes the seat
    // read as TAKEN. It is a small light close to the stone, so the falloff
    // has to be steep — a hot top face turns cut stone into a lampshade.
    for (let i = 0; i < uSeatP.length; i++) {
      const pu = uSeatP[i]
      const cu = uSeatC[i]
      if (!pu || !cu) continue
      const d = pu.sub(world)
      const dd = max(dot(d, d), 0.0001)
      // wrapped, not lambert: the side of a drum turned away from its own
      // voice is still stone, and stone at night is never pure black
      const ndl = pow(max(dot(n, d.div(dd.sqrt())), 0).mul(0.72).add(0.28), 1.6)
      col = col.add(cu.mul(alb).mul(ndl).mul(float(0.2).div(dd.add(0.22))))
    }

    // THE MARK: a ring cut into the top face and gilded. Gold reflecting a
    // light that is standing right over it, which is the only way gold is
    // ever allowed to appear.
    const t = uv()
    const rd = length(t.sub(vec2(0.5, 0.5)))
    const inlay = gauss(rd.sub(0.32).div(0.022)).mul(smoothstep(0.5, 0.9, n.y))
    let own: N = vec3(0, 0, 0)
    for (let i = 0; i < uSeatC.length; i++) {
      const cu = uSeatC[i]
      const pu = uSeatP[i]
      if (!cu || !pu) continue
      const d = pu.sub(world)
      own = own.add(cu.mul(float(0.42).div(max(dot(d, d), 0.0001).add(0.18))))
    }
    col = col.add(c3(GOLD, 0.8).mul(inlay).mul(own))

    seatMat.colorNode = shoulder(col).add(dither(0.0028)).mul(uReveal)
  }
  // a spare column drum, straight-sided: the same stone as the colonnade,
  // and its circular joint is where the mark belongs. A tapered cone read
  // as a plastic stool (round 2).
  const seatGeo = new CylinderGeometry(0.5, 0.5, 1, 22, 1)
  const seatInst = new InstancedBufferGeometry()
  seatInst.index = seatGeo.index
  for (const key of Object.keys(seatGeo.attributes)) {
    const attr = seatGeo.attributes[key]
    if (attr) seatInst.setAttribute(key, attr)
  }
  const seatIPos = new Float32Array(VOICES.length * 3)
  const seatIScl = new Float32Array(VOICES.length * 3)
  const seatIRot = new Float32Array(VOICES.length * 2)
  const seatPosAttr = new InstancedBufferAttribute(seatIPos, 3)
  const seatSclAttr = new InstancedBufferAttribute(seatIScl, 3)
  const seatRotAttr = new InstancedBufferAttribute(seatIRot, 2)
  seatInst.setAttribute('iPos', seatPosAttr)
  seatInst.setAttribute('iScl', seatSclAttr)
  seatInst.setAttribute('iRot', seatRotAttr)
  seatInst.instanceCount = VOICES.length
  const seats = new Mesh(seatInst, seatMat)
  seats.frustumCulled = false
  seats.renderOrder = 1
  root.add(seats)

  function stageStone(): void {
    for (let i = 0; i < seatPos.length; i++) {
      const p = seatPos[i]
      if (!p) continue
      const w = stage.seat
      seatIPos[i * 3] = p.x
      seatIPos[i * 3 + 1] = FLOOR_Y + w * 0.28
      seatIPos[i * 3 + 2] = p.z
      seatIScl[i * 3] = w
      seatIScl[i * 3 + 1] = w * 0.56
      seatIScl[i * 3 + 2] = w
      seatIRot[i * 2] = seatYaw[i] ?? 0
      seatIRot[i * 2 + 1] = 1
    }
    seatPosAttr.needsUpdate = true
    seatSclAttr.needsUpdate = true
    seatRotAttr.needsUpdate = true
  }
  stageStone()

  // ------------------------------------------------------- THE PRESENCES
  /* A voice is a light with STRUCTURE: a hot core, the halo it throws into
     the air, a wide soft aura, and the column of its own light standing
     over its place. The same profile is the comet on the way down — a fast
     core with a long tail — so the arrival and the presence are one organ
     and not two.

     One instanced quad, four instances, and a second pass of the same
     attributes hung under the marble as its reflection. */
  const uPW = uniform(0.62)
  const uPH = uniform(1.34)

  const presIPos = new Float32Array(VOICES.length * 3)
  const presICol = new Float32Array(VOICES.length * 3)
  const presIState = new Float32Array(VOICES.length * 4)
  /** how wide and how tall THIS voice burns, its own phase, and how far its
      column opens as it rises: the four are not one light stamped four times */
  const presISize = new Float32Array(VOICES.length * 4)
  const presPosAttr = new InstancedBufferAttribute(presIPos, 3)
  const presColAttr = new InstancedBufferAttribute(presICol, 3)
  const presStateAttr = new InstancedBufferAttribute(presIState, 4)
  const presSizeAttr = new InstancedBufferAttribute(presISize, 4)
  VOICES.forEach((v, i) => {
    presISize[i * 4] = v.aura
    presISize[i * 4 + 1] = 0.62 + v.col * 0.42
    presISize[i * 4 + 2] = 0.31 + i * 0.27
    presISize[i * 4 + 3] = 0.34
  })

  function presenceGeo(): InstancedBufferGeometry {
    const g = quadGeo(VOICES.length)
    g.setAttribute('iPos', presPosAttr)
    g.setAttribute('iCol', presColAttr)
    g.setAttribute('iState', presStateAttr)
    g.setAttribute('iSize', presSizeAttr)
    return g
  }

  /** flip = 1 the presence itself, flip = -1 its answer in the stone */
  function presenceMaterial(flip: number): MeshBasicNodeMaterial {
    const mat = new MeshBasicNodeMaterial()
    mat.transparent = true
    mat.depthWrite = false
    mat.blending = AdditiveBlending
    const twin = flip < 0
    if (twin) mat.depthTest = false // it lives under the floor plane

    const anchor = attribute('iPos', 'vec3')
    const iCol = attribute('iCol', 'vec3')
    const st = attribute('iState', 'vec4') // bright, tail, tailGain, phase
    const size = attribute('iSize', 'vec4') // wide, tall, phase, how far the column opens

    // the reflection hangs from the mirrored anchor and smears with depth,
    // which is where reflection geometry actually puts it
    const a = twin ? vec3(anchor.x, float(2 * FLOOR_Y).sub(anchor.y), anchor.z) : anchor
    const hw = (twin ? uPW.mul(1.16) : uPW).mul(size.x)
    const hh = (twin ? uPH.mul(1.12) : uPH).mul(size.y)
    const mv = cameraViewMatrix.mul(vec4(a, 1))
    mat.vertexNode = cameraProjectionMatrix.mul(
      vec4(mv.x.add(positionLocal.x.mul(hw)), mv.y.add(positionLocal.y.mul(hh)), mv.z, mv.w)
    )

    // the quad's own frame, in metres. Both halves are carried as their
    // own varyings and multiplied HERE: folding an attribute-scaled size
    // into the interpolated position lost the size, and the column came
    // out as a beam the height of the whole quad (round 6).
    const vX: N = varying(positionLocal.x)
    const vY: N = varying(positionLocal.y)
    const vHW: N = varying(hw)
    const vHH: N = varying(hh)
    const vU: N = vX.mul(vHW)
    const vV: N = vY.mul(vHH)
    /** 0 at the middle, 1 at the quad's own edge: every term dies before it
        reaches the edge, or a long trail ends in a flat cut (round 6) */
    const vCol: N = varying(iCol)
    const vSt: N = varying(st)
    /** this voice's own width, carried into the fragment */
    const k: N = varying(size.x)
    /** how far its column opens as it rises: tight while it is still
        falling (a comet has a thin tail), open once it stands */
    const open: N = varying(size.w)
    const u = vU
    const v = twin ? vV.negate() : vV
    const up = max(v, 0)
    const down = max(v.negate(), 0)
    /* A falloff in `up` is 1 wherever up is clamped to zero, which is the
       ENTIRE other half of the quad: without these masks the column and the
       foot each spread a flat strip across the half they do not belong to,
       and a hovering voice grows a searchlight beam (round 6, three rounds
       of chasing the wrong bug). */
    const above = smoothstep(0.004, 0.035, v)
    const below = smoothstep(0.004, 0.035, v.negate())

    // the column wavers: a voice is alive, and a perfectly straight shaft
    // is a laser pointer
    const wob = mx_noise_float(vec3(up.mul(2.4), uT.mul(0.62).add(vSt.w.mul(7.0)), vSt.w.mul(4.0)))
      .mul(0.05)
      .mul(up)
    const uu = u.add(wob)

    const core = gauss(vec2(uu.div(k.mul(0.04)), v.div(k.mul(0.034))))
    const halo = gauss(vec2(u.div(k.mul(0.135)), v.div(k.mul(0.115))))
    const aura = gauss(vec2(u.div(k.mul(0.42)), v.div(k.mul(0.33))))
    // the column of a voice widens and dissolves as it rises. A shaft that
    // holds its width is a laser pointer, which is the one thing a night
    // like this cannot have (round 1).
    const shaftW = k.mul(0.05).add(up.mul(open))
    // a gaussian fall, not an exponential one: an exponential tail is still
    // worth eight percent at the quad's own edge, and that shows up as a
    // flat cut across the top of a comet (round 6)
    const shaft = gauss(uu.div(shaftW)).mul(gauss(up.div(max(vSt.y, 0.02)))).mul(above)
    // the foot: where the light touches its own stone
    const foot = gauss(u.div(k.mul(0.26))).mul(gauss(down.div(0.22))).mul(below)

    const bright = vSt.x
    const alpha = core
      .add(halo.mul(0.46))
      .add(aura.mul(0.24))
      .add(shaft.mul(vSt.z))
      .add(foot.mul(0.14))
      .mul(bright)
      .mul(twin ? 0.24 : 1)
      .mul(uReveal)

    const hot = min(core.add(shaft.mul(0.18)), 1)
    let col: N = mix(vCol, c3(WHITE_HOT, 1.35), hot)
    // the stone eats the cool out of a reflection long before the gold
    if (twin) col = col.mul(vec3(1.0, 0.82, 0.56))
    mat.colorNode = col.add(dither(0.004))
    mat.opacityNode = min(alpha, 1.4)
    return mat
  }

  const presences = new Mesh(presenceGeo(), presenceMaterial(1))
  presences.frustumCulled = false
  presences.renderOrder = 8
  root.add(presences)
  const presenceTwins = new Mesh(presenceGeo(), presenceMaterial(-1))
  presenceTwins.frustumCulled = false
  presenceTwins.renderOrder = 4
  root.add(presenceTwins)

  // -------------------------------------------------------- THE COLONNADE
  /* The agora's columns are rim-lit by a hearth fire, and the council's
     blaze is not a hearth fire. This is the difference: a warm wash low on
     the shafts nearest the circle, rising with the blaze and trembling on
     the same heartbeat. The stone is not rebuilt, only lit.

     It stays LOW and it stays faint. Round 1 put a bright sheet across the
     whole colonnade and behind the topic line, which broke two laws in one
     pass (darkness carves, and nothing bright behind the letterpress). */
  const COL_R = 10.6
  const COL_ANGLES = [-62, -44, -30, -19, -9, 9, 19, 30, 44, 62]
  const washN = COL_ANGLES.length
  const washPos = new Float32Array(washN * 3)
  const washSeed = new Float32Array(washN * 2)
  COL_ANGLES.forEach((deg, i) => {
    const a = (deg * Math.PI) / 180
    const x = Math.sin(a) * COL_R
    const z = -Math.cos(a) * COL_R
    washPos[i * 3] = x
    washPos[i * 3 + 1] = FLOOR_Y + 0.28
    washPos[i * 3 + 2] = z
    // how much of the blaze reaches this shaft at all, and which side of it
    // the light comes from
    const d = Math.hypot(x - FIRE.x, z - FIRE.z)
    washSeed[i * 2] = 0.62 / (d * d + 3.2)
    washSeed[i * 2 + 1] = x < 0 ? 1 : -1
  })
  const washGeo = quadGeo(washN)
  washGeo.setAttribute('iPos', new InstancedBufferAttribute(washPos, 3))
  washGeo.setAttribute('iSeed', new InstancedBufferAttribute(washSeed, 2))
  const washMat = new MeshBasicNodeMaterial()
  washMat.transparent = true
  washMat.depthWrite = false
  washMat.blending = AdditiveBlending
  {
    const pos = attribute('iPos', 'vec3')
    const seed = attribute('iSeed', 'vec2')
    const mv = cameraViewMatrix.mul(vec4(pos, 1))
    const hw = float(0.17)
    const hh = float(0.7)
    washMat.vertexNode = cameraProjectionMatrix.mul(
      vec4(mv.x.add(positionLocal.x.mul(hw)), mv.y.add(positionLocal.y.mul(hh)), mv.z, mv.w)
    )
    const vU: N = varying(positionLocal.x)
    const vV: N = varying(positionLocal.y)
    const vSeed: N = varying(seed)
    // the lit side of a round shaft: the highlight sits off-centre, toward
    // the fire, and dies well before the silhouette so it never bleeds into
    // the sky beside the stone
    const off = vU.sub(vSeed.y.mul(0.26))
    const across = gauss(off.div(0.34)).mul(oneMinus(smoothstep(0.5, 0.92, vU.abs())))
    // fire is LOW: the shaft is brightest at its foot and gone by the knee
    const up = vV.mul(0.5).add(0.5)
    const along = up.mul(3.1).negate().exp().mul(oneMinus(smoothstep(0.5, 0.95, up)))
    const a = across
      .mul(along)
      .mul(vSeed.x)
      .mul(uWash)
      .mul(uBlaze)
      .mul(float(0.68).add(uFlick.mul(0.32)))
      .mul(uReveal)
    washMat.colorNode = hex3('#f0a24a', 0.5).add(dither(0.003))
    washMat.opacityNode = min(a, 1)
  }
  const washes = new Mesh(washGeo, washMat)
  washes.frustumCulled = false
  washes.renderOrder = 5
  root.add(washes)

  // ---------------------------------------------------------- THE AIR
  /* A room with people in it is not a vacuum. These are the motes hanging
     in the air over the circle — invisible until one of the five lights
     finds them, which is how you SEE that a light throws anything at all.
     They are what turns the space between the seats from a gap into a
     room. */
  const MOTE_N = 220
  const motePos = new Float32Array(MOTE_N * 3)
  const moteSeed = new Float32Array(MOTE_N * 4)
  for (let i = 0; i < MOTE_N; i++) {
    const a = rand() * Math.PI * 2
    const r = 0.5 + Math.pow(rand(), 0.65) * 3.4
    motePos[i * 3] = FIRE.x + Math.cos(a) * r
    motePos[i * 3 + 1] = FLOOR_Y + 0.1 + Math.pow(rand(), 1.5) * 3.2
    motePos[i * 3 + 2] = FIRE.z + Math.sin(a) * r * 0.72
    moteSeed[i * 4] = 0.05 + rand() * 0.09
    moteSeed[i * 4 + 1] = rand() * 6.28
    moteSeed[i * 4 + 2] = 0.5 + rand() * 1.6
    moteSeed[i * 4 + 3] = rand()
  }
  const moteGeo = quadGeo(MOTE_N)
  moteGeo.setAttribute('iPos', new InstancedBufferAttribute(motePos, 3))
  moteGeo.setAttribute('iSeed', new InstancedBufferAttribute(moteSeed, 4))
  const moteMat = new MeshBasicNodeMaterial()
  moteMat.transparent = true
  moteMat.depthWrite = false
  moteMat.blending = AdditiveBlending
  {
    const pos = attribute('iPos', 'vec3')
    const seed = attribute('iSeed', 'vec4')
    // a mote does not fall and it does not fly: it wanders on the warm air
    const t = uT.mul(seed.x).add(seed.y)
    const w = vec3(
      pos.x.add(sin(t).mul(0.34)),
      pos.y.add(sin(t.mul(0.57).add(1.4)).mul(0.2)).add(uT.mul(0.026).mul(seed.w).mul(uClosed)),
      pos.z.add(cos(t.mul(0.79)).mul(0.28))
    )
    // the fire, then the four voices: the same block every surface reads
    const fd = vec3(FIRE.x, FIRE.y + 0.3, FIRE.z).sub(w)
    let warm: N = c3(lin('#f0a24a'), 1).mul(float(2.6).div(dot(fd, fd).mul(1.5).add(2.4)).mul(uBlaze))
    for (let i = 0; i < uSeatP.length; i++) {
      const pu = uSeatP[i]
      const cu = uSeatC[i]
      if (!pu || !cu) continue
      const d = pu.sub(w)
      warm = warm.add(cu.mul(float(0.5).div(dot(d, d).mul(2.2).add(0.5))))
    }
    const twinkle = sin(uT.mul(seed.z).add(seed.w.mul(21))).mul(0.28).add(0.72)
    const a = min(length(warm), 1.2).mul(0.42).mul(twinkle).mul(uReveal).mul(float(0.4).add(uClosed.mul(0.6)))
    const size = float(1.8).add(seed.w.mul(2.4))
    const mv = cameraViewMatrix.mul(vec4(w, 1))
    const px = size.mul(uPx).mul(max(mv.z.negate(), 1))
    moteMat.vertexNode = cameraProjectionMatrix.mul(
      vec4(mv.x.add(positionLocal.x.mul(px)), mv.y.add(positionLocal.y.mul(px)), mv.z, mv.w)
    )
    const vUv: N = varying(positionLocal.xy)
    const vA: N = varying(a)
    const vC: N = varying(normalize(warm.add(vec3(0.001, 0.001, 0.001))))
    moteMat.colorNode = vC.mul(0.9)
    moteMat.opacityNode = min(smoothstep(1.0, 0.0, length(vUv)).mul(vA), 1)
  }
  const motes = new Mesh(moteGeo, moteMat)
  motes.frustumCulled = false
  motes.renderOrder = 9
  root.add(motes)

  /* THE LIFT. As the circle closes the fire takes the whole ring with it:
     embers off the coals, ash off the stone, the warm air of four voices
     going up together. Born at the ring, gone by the height of the
     columns. */
  const LIFT_N = 130
  const liftPos = new Float32Array(LIFT_N * 3)
  const liftSeed = new Float32Array(LIFT_N * 4)
  for (let i = 0; i < LIFT_N; i++) {
    const a = rand() * Math.PI * 2
    const r = 0.35 + Math.pow(rand(), 0.5) * 2.3
    liftPos[i * 3] = FIRE.x + Math.cos(a) * r
    liftPos[i * 3 + 1] = FLOOR_Y + 0.12
    liftPos[i * 3 + 2] = FIRE.z + Math.sin(a) * r * 0.8
    liftSeed[i * 4] = 0.055 + rand() * 0.07
    liftSeed[i * 4 + 1] = rand()
    liftSeed[i * 4 + 2] = (rand() - 0.5) * 0.5
    liftSeed[i * 4 + 3] = rand()
  }
  const liftGeo = quadGeo(LIFT_N)
  liftGeo.setAttribute('iPos', new InstancedBufferAttribute(liftPos, 3))
  liftGeo.setAttribute('iSeed', new InstancedBufferAttribute(liftSeed, 4))
  const liftMat = new MeshBasicNodeMaterial()
  liftMat.transparent = true
  liftMat.depthWrite = false
  liftMat.blending = AdditiveBlending
  {
    const pos = attribute('iPos', 'vec3')
    const seed = attribute('iSeed', 'vec4')
    const p = fract(uT.mul(seed.x).add(seed.y))
    // fast birth, then the air lets go: gold on the way up, starlight at
    // the top, where the picture hands them to the firmament
    const pe = oneMinus(pow(oneMinus(p), 1.7))
    const drift = float(0.12).add(pe.mul(0.5))
    const w = vec3(
      pos.x.add(seed.z.mul(drift.mul(2.2))).add(sin(uT.mul(0.9).add(seed.y.mul(7.0))).mul(drift.mul(0.5))),
      pos.y.add(pe.mul(4.4)),
      pos.z.add(seed.z.mul(drift)).add(cos(uT.mul(0.7).add(seed.y.mul(5.0))).mul(drift.mul(0.35)))
    )
    let col: N = hex3('#c4611e', 1.1)
    col = mix(col, hex3('#f0b45a', 1.0), clamp(pe.sub(0.1).div(0.32), 0, 1))
    col = mix(col, hex3('#eef1ff', 0.86), clamp(pe.sub(0.52).div(0.44), 0, 1))
    const a = min(p.div(0.06), 1)
      .mul(float(0.28).add(pow(oneMinus(pe), 0.8).mul(0.72)))
      .mul(smoothstep(1.0, 0.82, pe))
      .mul(uClosed)
      .mul(float(0.4).add(uBlaze.mul(0.6)))
      .mul(uReveal)
      .mul(1.35)
    const size = float(4.2).sub(pe.mul(1.6))
    const mv = cameraViewMatrix.mul(vec4(w, 1))
    const px = size.mul(uPx).mul(max(mv.z.negate(), 1))
    liftMat.vertexNode = cameraProjectionMatrix.mul(
      vec4(mv.x.add(positionLocal.x.mul(px)), mv.y.add(positionLocal.y.mul(px)), mv.z, mv.w)
    )
    const vUv: N = varying(positionLocal.xy)
    const vA: N = varying(a)
    const vC: N = varying(col)
    const d = length(vUv)
    liftMat.colorNode = vC
    liftMat.opacityNode = min(smoothstep(1.0, 0.1, d).add(smoothstep(1.0, 0.5, d).mul(0.3)).mul(vA), 1)
  }
  const lift = new Mesh(liftGeo, liftMat)
  lift.frustumCulled = false
  lift.renderOrder = 9
  root.add(lift)

  // ---- the DOM organs: topic, names, cartouche ----
  const topicNode = document.getElementById('council-topic')
  const namesNode = document.getElementById('council-names')
  const cartoucheNode = document.getElementById('cartouche')
  if (!topicNode || !namesNode || !cartoucheNode) throw new Error('missing council shell')
  const topicEl: HTMLElement = topicNode
  const namesEl: HTMLElement = namesNode
  const cartoucheEl: HTMLElement = cartoucheNode
  const nameEls = Array.from(namesEl.children) as HTMLElement[]
  const progressEl = cartoucheEl.querySelector('.cartouche-progress') as HTMLElement | null
  const toggleEl = cartoucheEl.querySelector('.cartouche-toggle') as HTMLElement | null

  // ---- the audio ----
  const audio = new Audio(AUDIO_COUNCIL)
  audio.preload = 'auto'
  let endedFired = false
  /** the ambient bed listens and ducks while the voices hold the floor */
  function announceVoice(playing: boolean): void {
    window.dispatchEvent(new CustomEvent('na-voice', { detail: playing }))
  }
  audio.addEventListener('ended', () => {
    announceVoice(false)
    if (endedFired) return
    endedFired = true
    onEnded()
  })
  function setToggleLabel(): void {
    if (toggleEl) toggleEl.textContent = audio.paused ? 'Listen' : 'Pause'
  }
  cartoucheEl.addEventListener('click', () => {
    if (!running) return
    if (audio.paused) void audio.play().catch(() => undefined)
    else audio.pause()
    announceVoice(!audio.paused)
    setToggleLabel()
  })

  // ---- state ----
  // Sound is on-by-invitation (World Bible §8): the circle convenes and
  // waits at the cartouche. Nothing plays until the visitor asks, and
  // the beat has to read as complete in silence.
  let running = false
  let t = 0
  /** 1 while the circle holds the frame, less once the way onward does */
  let yieldK = 1
  let topicTimer = 0
  let stagedAspect = 0
  const projected = new Vector3()
  const tmp = new Vector3()

  /* THE ARRIVAL. They do not come down together: the moderator takes the
     chair first and the circle closes around them, last light on the
     inside. Four separate events, one gathering. */
  const DELAY = [0.5, 0.0, 1.2, 0.85]
  const FALL = 2.3
  /* a visitor who asked for less motion still gets the whole circle, and
     gets it at once: the places are taken, the ring is closed, and only the
     journey is spared (the beat has to read composed either way) */
  const landAt = DELAY.map((d) => (reduced ? 0.12 : d + FALL))

  /** eased fall: quick out of the night, then a long settle into the seat */
  const settleOf = (i: number): number => {
    const d = DELAY[i] ?? 0
    if (reduced) return Math.min(1, Math.max(0, t / 0.25))
    return Math.min(1, Math.max(0, (t - d) / FALL))
  }

  /** Restage the circle for the current frame shape (phones get the tight
      ring; the CSS register/chips swap follows the same 9/10 line). */
  function layoutSeats(aspect: number): void {
    if (Math.abs(aspect - stagedAspect) < 0.01) return
    stagedAspect = aspect
    const narrow = aspect < 0.9
    stage = narrow ? NARROW : WIDE
    stageSeats(stage)
    stageStone()
    uRingA.value = stage.rx
    uRingB.value = stage.rz
    uWash.value = stage.wash
    uPW.value = 0.62 * stage.aura
    uPH.value = 1.34 * stage.col
    // a phone frame is a third of the pixels and half the air: fewer motes,
    // never an empty one
    moteGeo.instanceCount = narrow ? 120 : MOTE_N
    liftGeo.instanceCount = narrow ? 78 : LIFT_N
  }

  function begin(): void {
    running = true
    endedFired = false
    t = 0
    yieldK = 1
    root.visible = true
    // the poem line has the frame first; the letterpress sets once the
    // voices are already speaking
    window.clearTimeout(topicTimer)
    topicTimer = window.setTimeout(
      () => {
        if (running) topicEl.classList.add('lit')
      },
      reduced ? 1200 : 6200
    )
    cartoucheEl.hidden = false
    setToggleLabel()
  }

  function stop(): void {
    running = false
    root.visible = false
    audio.pause()
    announceVoice(false)
    audio.currentTime = 0
    window.clearTimeout(topicTimer)
    topicEl.classList.remove('lit')
    cartoucheEl.hidden = true
    namesEl.hidden = true
    for (const el of nameEls) {
      el.style.opacity = ''
      el.style.textShadow = ''
    }
    t = 0
  }

  /* THE FIRE ANSWERS. Not a ramp: the blaze takes a step every time a light
     lands, flares as it takes its seat, and settles into the height a
     four-voice circle deserves. Stays inside 0..1 — the agora scales its
     flame by this, and the contract is the contract. */
  function blaze(): number {
    if (!running) return 0
    let b = 0
    for (let i = 0; i < VOICES.length; i++) {
      const s = settleOf(i)
      b += (s * s * (3 - 2 * s)) * 0.215
      const since = t - (landAt[i] ?? 0)
      if (since > 0) b += 0.16 * Math.exp(-since * 2.6)
    }
    return Math.min(1, b)
  }

  /* THE FLOOR PASSES. There are no per-voice timestamps yet, so this claims
     nothing while the circle is silent: the moderator holds the open floor,
     the other three listen, and that is a true thing to say about a
     moderated council. Once the audio is running the floor moves on a slow
     turn so the frame always has ONE voice speaking and three listening,
     which is what a council looks like. When the timestamps land, this
     function is the one line that changes. */
  const TURNS = [MOD, 0, 2, MOD, 3, 0, MOD, 2, 3, MOD]
  function holder(): number {
    if (audio.paused || !(audio.duration > 0)) return MOD
    const turn = Math.floor(audio.currentTime / 13.5) % TURNS.length
    return TURNS[turn] ?? MOD
  }

  /* The council keeps its OWN clock. `elapsed` stays in the signature
     because main owns it, but the convening is measured from begin(): the
     arrival has to land the same way every night, and the forge freezes the
     world clock while it composes a frame. */
  function update(dt: number, elapsed: number, camera: PerspectiveCamera): void {
    if (!running) return
    void elapsed
    t += dt
    layoutSeats(camera.aspect)

    // ONE heartbeat for the whole circle: the marble, the colonnade, the
    // stone seats and the air all answer this single signal, so the agora
    // breathes as one body instead of as six loops
    uFlick.value = reduced
      ? 0.86
      : 0.66 + 0.19 * Math.sin(t * 7.3) + 0.1 * Math.sin(t * 11.9 + 1.7) + 0.06 * Math.sin(t * 17.3 + 4.1)
    // the air keeps moving for a visitor who asked for less motion, it just
    // moves like weather instead of like an effect
    uT.value = reduced ? t * 0.22 : t
    uBlaze.value = blaze()
    /* THE CIRCLE STANDS DOWN. When the forward door takes the frame the
       cartouche goes dark, and that is this beat's signal that the way
       onward is speaking now: the marks of the circle step back so nothing
       of ours sits bright behind that copy. The fire keeps burning. */
    const doorHolds = cartoucheEl.hidden
    yieldK += ((doorHolds ? 0.4 : 1) - yieldK) * Math.min(1, dt * 3)
    uReveal.value = Math.min(1, t / 0.55) * yieldK
    uPx.value = Math.tan((camera.fov * Math.PI) / 360) / Math.max(200, innerHeight)

    const held = holder()
    let closed = 0

    for (let i = 0; i < VOICES.length; i++) {
      const v = VOICES[i]
      const p = seatPos[i]
      const pu = uSeatP[i]
      const cu = uSeatC[i]
      const ku = uSeatK[i]
      if (!v || !p || !pu || !cu || !ku) continue
      const k = settleOf(i)
      const e = 1 - Math.pow(1 - k, 3)
      const phase = i * 1.7

      // the descent: it comes in from outside the ring and swings down onto
      // its own place, the way a star sets. Nothing bounces.
      const swing = (1 - e) * 0.42
      const ang = Math.atan2((p.x - FIRE.x) / stage.rx, (p.z - FIRE.z) / stage.rz) + swing
      const wide = 1 + Math.pow(1 - e, 1.6) * 0.26
      const x = FIRE.x + Math.sin(ang) * stage.rx * wide
      const z = FIRE.z + Math.cos(ang) * stage.rz * wide - FROM_Z * (1 - e)
      const y = FROM_Y + (SEAT_Y - FROM_Y) * e
      tmp.set(x, y, z)

      // the landing: a flare as it takes the seat, then the settled light
      const since = t - (landAt[i] ?? 0)
      const flash = since > -0.45 ? Math.exp(-Math.pow((since + 0.05) * 3.4, 2)) : 0
      const seated = Math.min(1, Math.max(0, (t - (landAt[i] ?? 0) + 0.5) / 0.9))
      // whoever holds the floor stands a little taller; the rest listen
      const floor = held === i ? 1 : 0
      const lead = 0.76 + 0.24 * floor
      const breathe = reduced ? 1 : 1 + 0.06 * Math.sin(t * v.breath * 1.6 + phase) * (0.4 + 0.6 * floor)
      const bright = (0.22 + 0.78 * Math.min(1, k * 1.6)) * (lead * seated + (1 - seated) * 0.9) * breathe * v.gain
      // the tail: long and thin while it falls, the standing column once it
      // has a place to stand on
      // the tail is the fall itself, not the instantaneous speed: an eased
      // descent spends most of its visible time already slow, and a comet
      // that loses its tail at the halfway mark has no arrival left
      const falling = Math.pow(1 - e, 1.15)
      const tail = (0.1 + 0.85 * falling) * (1 - seated) + seated * 0.2 * v.col * (0.8 + 0.4 * floor)
      const tailGain = 0.5 * (1 - seated) + seated * (0.2 + 0.22 * floor)
      // a comet's tail is a thread; a seated voice's column is a plume
      presISize[i * 4 + 3] = 0.05 * (1 - seated) + seated * 0.34

      presIPos[i * 3] = tmp.x
      presIPos[i * 3 + 1] = tmp.y
      presIPos[i * 3 + 2] = tmp.z
      const c = voiceColour(i)
      const glow = bright + flash * 1.5
      presICol[i * 3] = c.r
      presICol[i * 3 + 1] = c.g
      presICol[i * 3 + 2] = c.b
      presIState[i * 4] = glow
      presIState[i * 4 + 1] = tail
      presIState[i * 4 + 2] = tailGain
      presIState[i * 4 + 3] = 0.31 + i * 0.27

      // what this presence throws at the world
      pu.value.copy(tmp)
      const thrown = (bright + flash * 0.9) * seated * v.gain
      cu.value.set(c.r * thrown, c.g * thrown, c.b * thrown)
      // the ripple runs out of the landing across the stone, once
      const ripple = since > 0 && since < 1.5 ? since : -1
      ku.value.set(
        seated * (0.85 + 0.15 * floor) + flash * 0.6,
        ripple >= 0 ? 0.2 + ripple * 1.5 : -1,
        ripple >= 0 ? Math.max(0, 1 - ripple / 1.1) * 0.5 : 0,
        seated
      )
      closed += seated / VOICES.length
    }
    presPosAttr.needsUpdate = true
    presColAttr.needsUpdate = true
    presStateAttr.needsUpdate = true
    presSizeAttr.needsUpdate = true
    uClosed.value = closed

    // name chips ride under their own seat once it is taken; a chip that
    // would leave the frame hides rather than clip (narrow stages use the
    // letterpress register instead, via CSS). While the forward door holds
    // the frame the circle's names stand down: the cartouche going dark is
    // how this beat learns the door is open.
    const seated = t > (landAt[0] ?? 0) + 0.4
    const doorUp = cartoucheEl.hidden
    namesEl.hidden = !seated || doorUp
    if (seated && !doorUp) {
      for (let i = 0; i < VOICES.length; i++) {
        const p = seatPos[i]
        const el = nameEls[i]
        if (!p || !el) continue
        // the near rim of its own stone, so a chip never sits on the seat
        projected.set(p.x, FLOOR_Y + 0.02, p.z + stage.seat * 0.62).project(camera)
        const offFrame = projected.z > 1 || Math.abs(projected.x) > 0.99
        el.hidden = offFrame
        if (offFrame) continue
        // a name at the edge of the circle is still a name: hold it inside
        // the frame rather than let the stage cut it in half
        const x = Math.min(innerWidth - 64, Math.max(64, (projected.x * 0.5 + 0.5) * innerWidth))
        const y = (-projected.y * 0.5 + 0.5) * innerHeight
        el.style.left = `${x}px`
        el.style.top = `${y + 18}px`
        // these ride over stone, fire and colonnade, so they carry their own
        // night with them the way the kicker above them does
        el.style.textShadow = '0 1px 10px rgba(4, 6, 13, 0.95), 0 0 3px rgba(4, 6, 13, 0.85)'
        // the one holding the floor is named in full light
        el.style.opacity = held === i ? '1' : '0.85'
      }
    }

    if (progressEl && audio.duration > 0) {
      progressEl.style.width = `${(audio.currentTime / audio.duration) * 100}%`
    }
  }

  function forgeStage(camera: PerspectiveCamera): void {
    begin()
    // compose the whole convening without sound: every light down, the
    // circle closed, the blaze settled, the air already moving
    // the rig can ask for a half-arrived circle (?cf=96): stopping the
    // compose mid-descent is the only way the arrival gets screenshotted
    const frames = Number(new URLSearchParams(location.search).get('cf') ?? 340)
    for (let i = 0; i < frames; i++) update(1 / 60, 12.4 + i / 60, camera)
    audio.pause()
    window.clearTimeout(topicTimer)
    topicEl.classList.add('lit')
    setToggleLabel()
  }

  return { begin, update, blaze, stop, forgeStage, active: () => running }
}
