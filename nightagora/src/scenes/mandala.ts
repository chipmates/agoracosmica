/* THE MANDALA — the map, not the territory. The stage the visitor falls
   through while eight questions drift past, and the only thing in the
   night that is seen from sixty metres AND from four.

   It is an instrument, not a picture: a marble plate carrying the agora's
   own paving grammar, a graduated limb turning over it, a pierced inner
   plate turning back the other way, thirty lamps standing on the walk, and
   one ember at the heart. Three plates at three rates is what makes the
   motion celestial instead of a shimmer.

   THE LAW THIS FILE OBEYS FIRST: the questions are white text over this
   stone, and wherever they sit, what is beneath them stays dark enough to
   read. Every value here is authored against that, which is why the plate
   GIVES UP value as the camera closes (craft note at uAlt) and why the
   heart is a tight core rather than a wash.

   Craft laws carried over from the camp:
   · every hand-picked colour is a hex through three Color, which hands
     back the linear working values the shaders want (no manual gamma)
   · dither on every gradient, at creation
   · one shared heartbeat, so the lamps and the coals breathe as one body
   · a shoulder on the bright end, so the heart is a fire and not a hole
   · instanced quads for every sized particle, never THREE.Points
   · detail that DISSOLVES rather than aliases: a mark whose spacing has
     fallen under a pixel stops being a mark and becomes a value (settle) */

import {
  AdditiveBlending,
  CircleGeometry,
  Color,
  Group,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  MeshBasicNodeMaterial,
  PlaneGeometry,
  RingGeometry,
  Scene,
} from 'three/webgpu'
import * as TSL from 'three/tsl'
import { mulberry32, FOUNDING_SEED } from '../core/seed'

/* TSL, uncast. A hand-composed node graph cannot be followed by TSL's own
   overloads once it is built out of helpers, and the shaders are the part
   a human has to be able to read. One cast, here, at the boundary. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any
const {
  abs,
  atan,
  attribute,
  cameraPosition,
  cameraProjectionMatrix,
  clamp,
  cos,
  dot,
  exp,
  float,
  floor,
  fract,
  fwidth,
  length,
  max,
  min,
  mix,
  modelViewMatrix,
  mx_noise_float,
  oneMinus,
  positionLocal,
  pow,
  screenCoordinate,
  sin,
  smoothstep,
  step,
  uniform,
  uv,
  varying,
  vec2,
  vec3,
  vec4,
} = TSL as unknown as Record<string, N>

const FLOOR_Y = -0.9
/** the marble plate */
const RADIUS = 14
/** the walk of the thirty */
const RING_R = 10.6
/** the brink, where the terrace gives out into night */
const TERRACE_R = 18.4
/** the belt of graduations, outside the walk */
const LIMB_IN = 11.7
const LIMB_OUT = 13.5
/** how far an ember climbs before it is another ember */
const EMBER_SPAN = 44
const TAU = Math.PI * 2

/* craft law: sRGB lies. Every constant goes through three Color, which
   reads the hex as sRGB and hands back the LINEAR value the shader wants. */
const lin = (hex: string): Color => new Color(hex)
const hex3 = (h: string, k = 1): N => {
  const c = lin(h)
  return vec3(c.r * k, c.g * k, c.b * k)
}

const GOLD = '#e0b96a'
const LAMP_CORE = '#fff3d6'
const EMBER = '#ff9c42'

/** the bright end rolls off, so a warm heart stays a fire instead of
    burning a white hole through the stone */
const shoulder = (c: N): N => c.div(float(1).add(c.mul(0.42)))

/** dither at creation: the sRGB step is tiny down in the abyss values, and
    a plate this large would band across half a screen without it */
const dither = (amp: number): N =>
  fract(sin(dot(screenCoordinate.xy.add(0.5), vec2(12.9898, 78.233))).mul(43758.5453))
    .sub(0.5)
    .mul(amp)

export interface MandalaHandles {
  update(dt: number, elapsed: number, reveal: number, fire: number): void
  visible(v: boolean): void
}

export function createMandala(scene: Scene): MandalaHandles {
  const root = new Group()
  root.visible = false
  scene.add(root)

  const rand = mulberry32(FOUNDING_SEED + 89)
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  // tier by viewport width: a phone gets the same composition, fewer motes
  const small = window.innerWidth < 760

  /* the three plates. The stone carries the map, the rim carries the
     graduations and the thirty lamps, the court is a pierced plate that
     turns back against both. Nothing here bounces: they turn. */
  const plate = new Group()
  const rim = new Group()
  const court = new Group()
  root.add(plate, rim, court)

  const uReveal = uniform(0)
  const uHeat = uniform(0)
  const uT = uniform(0)
  /** ONE heartbeat, so the lamps, the coals and the light pools all answer
      the same signal instead of forty independent loops */
  const uFlick = uniform(1)
  /** where the lamps stand, measured in the STONE's own turning frame, so
      their light pools slide across the engraving as the two plates part */
  const uLampOff = uniform(0)

  // -------------------------------------------------------- the toolkit
  /* Every plate in this file is flat and centred, so they all share one
     way of asking where a fragment is and how much of the engraving that
     fragment is being asked to hold. */
  interface Plate {
    /** radius in world units */
    rw: N
    /** angle in the plate's own frame */
    ang: N
    /** world units under one pixel, from the plate's own derivatives */
    px: N
    /** An anti-aliased line at a signed world distance, weighted in PIXELS.
        An engraved line authored in stone is a hairline at sixty metres and
        a gold plank at four, which is how gold stops being a reflection and
        starts being a fill. Weight is a hand, not a measurement: the mark
        keeps its hand at every altitude and only opens a little at the end. */
    stroke(d: N, w: number): N
    /** 0 when marks this close together are finer than the screen can
        hold, 1 when they are comfortably resolved */
    settle(spacing: N): N
    /** world arc distance to the nearest of n marks, offset by `off` */
    arc(n: number, off?: number): N
  }

  function plateFrame(): Plate {
    const p = vec2(positionLocal.x, positionLocal.y)
    const rw = length(p)
    const ang = atan(p.y, p.x)
    // fwidth on the plate's own coordinates is the only honest measure of
    // scale here: it is large at sixty metres and tiny at four
    const px = max(abs(fwidth(positionLocal.x)), abs(fwidth(positionLocal.y)))
      .mul(0.8)
      .add(0.0006)
    return {
      rw,
      ang,
      px,
      stroke: (d, w) => {
        const hw = max(px.mul(w), float(0.0085 * w))
        const soft = px.mul(0.62)
        return oneMinus(smoothstep(hw.sub(soft), hw.add(soft), abs(d)))
      },
      settle: (spacing) => smoothstep(1.1, 3.4, spacing.div(px)),
      arc: (n, off = 0) =>
        abs(fract(ang.add(off).mul(n / TAU).add(0.5)).sub(0.5)).mul(rw.mul(TAU / n)),
    }
  }

  /** how high the eye is over the plate, 0 at the close pass, 1 at the
      overview. Not physics: at altitude the whole plate is a jewel against
      the void and the eye reads it whole, on the close pass it is a floor
      a few metres under you lit by one ember. The stone gives up value on
      the way down because the questions outrank it. */
  function altitude(): N {
    return clamp(cameraPosition.y.sub(FLOOR_Y).div(38), 0, 1)
  }

  /* the marble of concept 01, unchanged in its bones: four octaves with a
     domain warp. Three scales are pulled out of it, which is what gives
     this plate structure at the overview AND at the close pass. */
  const fbm = (p: N): N =>
    mx_noise_float(vec2(p.x, p.y))
      .mul(0.5)
      .add(mx_noise_float(vec2(p.x, p.y).mul(2.03)).mul(0.25))
      .add(mx_noise_float(vec2(p.x, p.y).mul(4.12)).mul(0.125))
      .add(mx_noise_float(vec2(p.x, p.y).mul(8.36)).mul(0.0625))
      .add(0.5)

  // ------------------------------------------------------------ THE STONE
  const stoneMat = new MeshBasicNodeMaterial({ transparent: true })
  {
    const F = plateFrame()
    const r = F.rw.div(RADIUS)
    const q = vec2(positionLocal.x, positionLocal.y).div(RADIUS).mul(7.0)
    const alt = altitude()
    const close = oneMinus(alt)

    // clamp keeps the fold inside [0,1]: an unclamped fbm feeds pow a
    // negative base and the whole stone whitens with NaN fragments
    const warp = clamp(fbm(q.mul(1.7).add(3.7)), 0, 1)
    const m = clamp(fbm(q.add(warp.mul(1.3))), 0, 1)
    const vein = pow(clamp(oneMinus(abs(m.mul(2.0).sub(1.0))), 0, 1), 9.0)
    // the coarse swell is what the overview reads as form, the grain is
    // what the close pass reads as crystal. Neither is ever the whole story.
    const swell = fbm(q.mul(0.32).add(2.4))
    const grain = fbm(q.mul(6.4).add(9.1))

    // THE SURVEY — iso-lines of the marble itself, so the map is a map and
    // not a texture. They dissolve into a wash at altitude by design.
    const cg = m.mul(15.0)
    const cw = fwidth(cg).mul(1.15).add(0.0018)
    const contour = oneMinus(smoothstep(float(0), cw, abs(fract(cg.add(0.5)).sub(0.5))))
    const contourFade = float(1).div(float(1).add(cw.mul(6.0)))

    /* THE PAVING — the same grammar the stone carries down in the agora:
       eight joints at 1.6 m and sixteen radial seams offset by 0.11 rad.
       Map and territory are one stone, so the landing is a cut and not a
       change of subject.

       A joint in polished marble is not a dark line: it is a cut with a lip
       on each side that catches the sky. Round 2 drew the cut alone and the
       whole architecture vanished at four metres, which is exactly where a
       floor should be at its most legible. */
    const off = max(F.px.mul(1.9), float(0.026))
    const inJoints = step(1.5, F.rw).mul(step(F.rw, 12.9)).mul(F.settle(float(1.6)))
    const jd = abs(fract(F.rw.div(1.6).add(0.5)).sub(0.5)).mul(1.6)
    const joint = F.stroke(jd, 1.0).mul(inJoints)
    const jointLip = F.stroke(jd.sub(off), 0.85).mul(inJoints)

    const inSeams = smoothstep(1.5, 2.0, F.rw)
      .mul(oneMinus(smoothstep(13.1, 13.5, F.rw)))
      .mul(F.settle(F.rw.mul(TAU / 16)))
    const sd = F.arc(16, 0.11)
    const seam = F.stroke(sd, 1.0).mul(inSeams)
    const seamLip = F.stroke(sd.sub(off), 0.85).mul(inSeams)
    // EVERY SECOND SEAM is gilded: the eight fields of the eight questions,
    // laid into the cut as a thread rather than painted on. It is the only
    // gold that reaches across the whole plate, and it is a hair wide.
    const gild = F.stroke(F.arc(8, 0.11), 0.5)
      .mul(inSeams)
      .mul(F.settle(F.rw.mul(TAU / 8)))

    // THE EIGHT FIELDS — one per question, alternating by a whisker. At
    // altitude this is the only thing giving the plate an eight-fold read.
    const oct = fract(floor(F.ang.add(0.11).mul(8 / TAU).add(8.0)).mul(0.5)).mul(2.0)

    // THE WALK — centuries of feet have polished a band at the ring: the
    // survey wears away there and the marble comes up a shade
    const wear = exp(pow(F.rw.sub(RING_R).div(1.15), 2.0).negate())

    // KINTSUGI — a few breaks, carried rather than hidden. Gold is not a
    // fill here: it is what the heart finds in the repair. The field is
    // deliberately coarse, because a crack runs across a stone in one long
    // sweep. A finer field gave scribbles, and scribbles are not damage.
    const mc = fbm(q.mul(0.19).add(21.7))
    const kw = fwidth(mc.mul(1.7)).mul(1.3).add(0.0011)
    const crack = oneMinus(smoothstep(float(0), kw, abs(fract(mc.mul(1.7).add(0.5)).sub(0.5))))
    const crackMask = smoothstep(0.53, 0.74, fbm(q.mul(0.5).add(5.1)))

    // THE LAMPLIGHT — thirty pools laid on the stone by the thirty lamps,
    // sliding as the rim turns away from the plate
    const lobe = pow(cos(F.ang.sub(uLampOff).mul(30.0)).mul(0.5).add(0.5), 7.0)
    const pool = exp(pow(F.rw.sub(RING_R).mul(1.35), 2.0).negate()).mul(lobe)

    // THE HEART — a tight core with coals in it, and one narrow wash. The
    // core is small on purpose: a warm blob the size of the frame is what
    // makes white text unreadable, and round 1 proved it by turning the
    // whole close pass mauve.
    const coals = pow(clamp(fbm(q.mul(9.0).add(uT.mul(0.05))), 0, 1), 2.4)
    const core = exp(F.rw.mul(3.4).negate())
    const wash = exp(F.rw.mul(1.1).negate())

    // THE POLISH GRADIENT — the court has been walked and wiped for
    // centuries, the outer plate has not. The survey wears away toward the
    // heart and the stone's own gleam takes over.
    const polish = smoothstep(9.0, 2.0, F.rw)

    // THE POLISH — the firmament caught in the stone, only close enough to
    // see. At altitude these would be one pixel each, which is aliasing.
    const cell = vec2(floor(positionLocal.x.mul(5.5)), floor(positionLocal.y.mul(5.5)))
    const h = fract(sin(dot(cell, vec2(12.9898, 78.233))).mul(43758.5453))
    const glint = step(0.968, h).mul(sin(uT.mul(1.6).add(h.mul(51.0))).mul(0.5).add(0.5))

    let col: N = mix(hex3('#0A1030'), hex3('#04071A'), smoothstep(0.02, 1.0, r))
    col = col.mul(swell.mul(0.26).add(0.87)).mul(grain.mul(0.11).add(0.945))
    col = col.mul(oct.sub(0.5).mul(0.06).add(1.0))
    // lapis in the vein, and the faintest gold where the vein catches. The
    // vein stays BLUE: a violet lean here is what turned the close pass
    // mauve in round 2, and purple is atmosphere only, low and narrow.
    col = col.add(hex3('#22357A', 0.135).mul(vein))
    col = col.add(hex3(GOLD, 0.04).mul(vein).mul(grain))
    // the survey, worn away along the walk. It is faint at altitude, where
    // its lines have dissolved into a wash anyway, and it is the thing that
    // carries the close pass, where it is the only fine mark left.
    col = col.add(
      hex3('#4B5A99', 0.055)
        .mul(contour)
        .mul(contourFade)
        .mul(oneMinus(wear.mul(0.65)))
        .mul(oneMinus(polish.mul(0.6)))
        .mul(close.mul(1.5).add(0.5))
    )
    // joints and seams are cut INTO the stone, so they take value away,
    // and their lips give a little of it back to the sky
    col = col.mul(oneMinus(min(joint.mul(0.52).add(seam.mul(0.44)), 0.72)))
    col = col.add(hex3('#5A6AA8', 0.028).mul(jointLip.add(seamLip.mul(0.8))))
    col = col.add(hex3(GOLD, 0.075).mul(gild).mul(uHeat.mul(0.3).add(0.55)))
    col = col.mul(wear.mul(0.09).add(1.0))
    col = col.add(hex3(GOLD, 0.3).mul(crack).mul(crackMask).mul(uHeat.mul(0.45).add(0.14)))
    col = col.add(hex3('#ffb35e', 0.052).mul(pool).mul(uFlick.mul(0.38).add(0.62)))
    col = col.add(hex3('#9fb4d8', 0.09).mul(glint).mul(close).mul(polish.mul(0.85).add(0.4)))
    // the plate ends on a drawn edge, not an airbrush: a gilded rim line
    // and a short fall, so it reads as a built thing and not a ball
    col = col.mul(oneMinus(smoothstep(0.88, 1.0, r).mul(0.42)))
    col = col.add(hex3(GOLD, 0.085).mul(F.stroke(F.rw.sub(RADIUS), 1.6)))

    // the plate yields value as the eye comes down. Not physics: the
    // questions own the near frame and this stone is what they sit on.
    col = col.mul(mix(float(0.44), float(1.0), alt))
    // and on the close pass the plate falls away from the heart, so the
    // near frame keeps a dark shoulder for the text to sit on
    col = col.mul(oneMinus(smoothstep(1.4, 8.5, F.rw).mul(0.2).mul(close)))
    // the heart holds its own curve. A phone at four metres sees almost
    // nothing BUT the heart, so it is tight AND it yields with the eye:
    // a portrait frame is a horizontal crop of this one, so the same fire
    // that reads as a coal on a desk fills half a phone.
    const hearth = uHeat.mul(mix(float(0.55), float(1.0), alt))
    col = col.add(
      hex3(EMBER, 0.42).mul(core).mul(hearth).mul(coals.mul(0.5).add(0.62)).mul(uFlick.mul(0.22).add(0.82))
    )
    col = col.add(hex3('#c4611e', 0.035).mul(wash).mul(hearth))

    stoneMat.colorNode = shoulder(col).add(dither(0.0028))
    stoneMat.opacityNode = uReveal
  }
  const stone = new Mesh(new CircleGeometry(RADIUS, small ? 128 : 192), stoneMat)
  stone.rotation.x = -Math.PI / 2
  stone.position.y = FLOOR_Y
  stone.renderOrder = 0
  plate.add(stone)

  // ---------------------------------------------------------- THE TERRACE
  /* Outside the plate the stone does not simply stop being: it steps down
     three shelves into the night. This is what gives the disc a silhouette
     at altitude, where before it faded off like an airbrushed ball. */
  const terraceMat = new MeshBasicNodeMaterial({ transparent: true })
  {
    const F = plateFrame()
    const step1 = 15.45
    const step2 = 16.85
    const down = clamp(floor(F.rw.sub(RADIUS).div(1.45)), 0, 2)
    const shelf = exp(down.mul(-0.62))
    const grit = fbm(vec2(positionLocal.x, positionLocal.y).mul(0.9)).mul(0.3).add(0.82)
    const joints = F.stroke(F.arc(48), 0.9).mul(F.settle(F.rw.mul(TAU / 48)))
    const lip = F.stroke(F.rw.sub(step1), 1.0).add(F.stroke(F.rw.sub(step2), 1.0))

    let col: N = hex3('#070b1e').mul(shelf).mul(grit)
    // the lips catch what the lamps throw outward, which is the only light
    // that ever reaches out here
    col = col.add(hex3(GOLD, 0.026).mul(lip).mul(uFlick.mul(0.3).add(0.7)))
    col = col.mul(oneMinus(joints.mul(0.42)))
    terraceMat.colorNode = shoulder(col).add(dither(0.0026))
    // the brink dissolves rather than ending on a drawn circle
    terraceMat.opacityNode = oneMinus(smoothstep(17.0, TERRACE_R, F.rw)).mul(uReveal)
  }
  const terrace = new Mesh(
    new RingGeometry(RADIUS, TERRACE_R, small ? 128 : 192, 3),
    terraceMat
  )
  terrace.rotation.x = -Math.PI / 2
  terrace.position.y = FLOOR_Y - 0.002
  terrace.renderOrder = 1
  plate.add(terrace)

  // ------------------------------------------------------------- THE LIMB
  /* The graduated rim: the walk of the thirty, a belt of marks outside it,
     and ONE gate mark heavier than everything else so that the turning of
     this plate can be read instead of merely felt. */
  const limbMat = new MeshBasicNodeMaterial({
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
  })
  {
    const F = plateFrame()
    const alt = altitude()
    const belt = step(LIMB_IN, F.rw).mul(step(F.rw, LIMB_OUT))

    const walk = F.stroke(F.rw.sub(RING_R), 1.5)
    const inner = F.stroke(F.rw.sub(LIMB_IN), 0.7)
    const outer = F.stroke(F.rw.sub(LIMB_OUT), 0.9)

    // marks hang from the outer hairline inward, deepest for the thirty
    const tick = (n: number, depth: number, w: number): N =>
      F.stroke(F.arc(n, -Math.PI / 2), w)
        .mul(belt)
        .mul(step(float(LIMB_OUT).sub(depth), F.rw))
        .mul(F.settle(F.rw.mul(TAU / n)))
    const minor = tick(150, 0.34, 0.6)
    const major = tick(30, 0.8, 1.0)
    const heavy = tick(6, 1.5, 1.5)

    // the gate: one mark, doubled, at the head of the walk. One thing on
    // this rim is unlike the others, so the turning can be READ.
    const dg = fract(F.ang.sub(Math.PI / 2).div(TAU).add(0.5)).sub(0.5).mul(F.rw.mul(TAU))
    const gate = F.stroke(abs(dg).sub(0.14), 1.9).mul(belt)

    let g: N = walk.mul(0.6)
    g = g.add(inner.mul(0.3)).add(outer.mul(0.42))
    g = g.add(minor.mul(0.34)).add(major.mul(0.62)).add(heavy.mul(0.8))
    g = g.add(gate.mul(0.95))
    // at altitude the whole rim is the emblem's outline and wants weight,
    // on the close pass it is a bar sliding past the corner of the eye
    limbMat.colorNode = hex3(GOLD).mul(alt.mul(0.35).add(0.72))
    limbMat.opacityNode = clamp(g, 0, 1).mul(uReveal).mul(alt.mul(0.12).add(0.24))
  }
  const limb = new Mesh(new RingGeometry(9.9, LIMB_OUT + 0.3, small ? 192 : 320, 1), limbMat)
  limb.rotation.x = -Math.PI / 2
  limb.position.y = FLOOR_Y + 0.03
  limb.renderOrder = 4
  rim.add(limb)

  // ------------------------------------------------------------- THE RETE
  /* A pierced plate over the stone, turning back against it: two rings, the
     twelve chapters, and the eclipse sign at the heart. Only the marks are
     drawn, so the survey underneath is never hidden. */
  const reteMat = new MeshBasicNodeMaterial({
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
  })
  {
    const F = plateFrame()
    const alt = altitude()
    const ring = (rr: number, w: number): N => F.stroke(F.rw.sub(rr), w)
    // the twelve chapters hang as short graduations off the inner ring.
    // Round 1 ran them the full width of the band and the whole court read
    // as a clock face, which is a different night entirely.
    const chapters = F.stroke(F.arc(12), 0.9)
      .mul(step(4.36, F.rw))
      .mul(step(F.rw, 4.92))
      .mul(F.settle(F.rw.mul(TAU / 12)))
    // the night's own sign, inscribed: a ring with one limb alight
    const alight = pow(cos(F.ang.sub(0.9)).mul(0.5).add(0.5), 1.5)

    let g: N = ring(5.15, 1.3).mul(0.8)
    g = g.add(ring(4.92, 0.7).mul(0.42))
    g = g.add(ring(3.55, 0.6).mul(0.3))
    g = g.add(chapters.mul(0.55))
    g = g.add(ring(2.35, 1.2).mul(alight.mul(0.85).add(0.3)))
    g = g.add(ring(1.02, 0.7).mul(0.38))
    reteMat.colorNode = hex3(GOLD).mul(uHeat.mul(0.5).add(0.72))
    reteMat.opacityNode = clamp(g, 0, 1).mul(uReveal).mul(alt.mul(0.1).add(0.22))
  }
  const rete = new Mesh(new CircleGeometry(5.5, small ? 96 : 160), reteMat)
  rete.rotation.x = -Math.PI / 2
  rete.position.y = FLOOR_Y + 0.05
  rete.renderOrder = 5
  court.add(rete)

  // ------------------------------------------------------- the quad fields
  /* Sized particles ride instanced quads. three ignores sizeNode on Points,
     and thirty sprites would be thirty draw calls. */
  function quads(n: number, attrs: Array<[string, number, Float32Array]>): InstancedBufferGeometry {
    const base = new PlaneGeometry(1, 1)
    const g = new InstancedBufferGeometry()
    g.index = base.index
    for (const key of Object.keys(base.attributes)) {
      const a = base.attributes[key]
      if (a) g.setAttribute(key, a)
    }
    for (const [name, size, data] of attrs) {
      g.setAttribute(name, new InstancedBufferAttribute(data, size))
    }
    g.instanceCount = n
    return g
  }

  /** a camera-facing quad at a position this field computes for itself */
  const billboard = (world: N, size: N): N => {
    const mv = modelViewMatrix.mul(vec4(world, 1))
    return cameraProjectionMatrix.mul(vec4(mv.xy.add(positionLocal.xy.mul(size)), mv.z, mv.w))
  }

  // ------------------------------------------------------- THE THIRTY LAMPS
  const LAMPS = 30
  {
    const iPos = new Float32Array(LAMPS * 3)
    const iVar = new Float32Array(LAMPS * 3)
    for (let i = 0; i < LAMPS; i++) {
      const a = (i / LAMPS) * TAU
      iPos[i * 3] = Math.sin(a) * RING_R
      iPos[i * 3 + 1] = 0.17
      iPos[i * 3 + 2] = -Math.cos(a) * RING_R
      iVar[i * 3] = 0.82 + rand() * 0.22
      iVar[i * 3 + 1] = rand() * TAU
      iVar[i * 3 + 2] = a
    }
    const mat = new MeshBasicNodeMaterial({
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
    })
    const p = attribute('iPos', 'vec3')
    const v = attribute('iVar', 'vec3')
    // Each lamp keeps its own phase, but they all ride the one heartbeat,
    // and one long swell walks the whole circle every eleven seconds, so
    // the thirty read as one body attending rather than thirty bulbs.
    const swell = sin(uT.mul(0.57).sub(v.z)).mul(0.5).add(0.5)
    const flick = uFlick
      .mul(0.66)
      .add(sin(uT.mul(2.1).add(v.y)).mul(0.18))
      .add(sin(uT.mul(5.3).add(v.y.mul(2.0))).mul(0.08))
      .add(swell.mul(0.2))
      .add(0.22)
    const fv = varying(flick)
    mat.vertexNode = billboard(p, v.x.mul(flick).mul(1.35))
    const d = length(uv().sub(vec2(0.5, 0.5))).mul(2.0)
    const fall = clamp(oneMinus(d), 0, 1)
    const core = pow(fall, 13.0)
    const halo = pow(fall, 3.2)
    mat.colorNode = mix(hex3(GOLD), hex3(LAMP_CORE), core)
    mat.opacityNode = min(halo.mul(0.34).add(core.mul(0.85)).mul(fv).mul(uReveal), 1)
    const lamps = new Mesh(quads(LAMPS, [['iPos', 3, iPos], ['iVar', 3, iVar]]), mat)
    lamps.frustumCulled = false
    lamps.position.y = FLOOR_Y
    lamps.renderOrder = 6
    rim.add(lamps)
  }

  // ------------------------------------------------------------ THE EMBERS
  /* What the heart throws off, and what the night has left drifting over
     the plate. This is the only thing in the descent that tells the eye it
     is FALLING: at sixty metres it is a thread of light at the centre, at
     four it streams past the frame. Dim on purpose. */
  {
    const COUNT = small ? 72 : 168
    const iA = new Float32Array(COUNT * 4)
    const iB = new Float32Array(COUNT * 3)
    for (let i = 0; i < COUNT; i++) {
      // a bit under half rise from the fire, the rest drift over the plate
      const heart = i % 5 < 2
      const rr = heart ? 0.3 + rand() * 2.0 : 3.4 + Math.sqrt(rand()) * 12.4
      iA[i * 4] = rr
      iA[i * 4 + 1] = rand() * TAU
      iA[i * 4 + 2] = rand() * EMBER_SPAN
      iA[i * 4 + 3] = heart ? 1.5 + rand() * 1.6 : 0.35 + rand() * 0.7
      iB[i * 3] = (heart ? 0.05 : 0.06) + rand() * 0.045
      iB[i * 3 + 1] = rand() * TAU
      iB[i * 3 + 2] = heart ? 1 : 0
    }
    const mat = new MeshBasicNodeMaterial({
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
    })
    const a = attribute('iA', 'vec4')
    const b = attribute('iB', 'vec3')
    const climb = fract(a.z.add(uT.mul(a.w)).div(EMBER_SPAN))
    const ang = a.y.add(uT.mul(0.009)).add(sin(uT.mul(0.31).add(b.y)).mul(0.03))
    const rr = a.x.add(sin(uT.mul(0.23).add(b.y.mul(1.7))).mul(0.4))
    const world = vec3(
      sin(ang).mul(rr),
      climb.mul(EMBER_SPAN).add(0.25),
      cos(ang).negate().mul(rr)
    )
    // born low, spent high, and the ones off the fire only live while the
    // heart is warm
    const mv = modelViewMatrix.mul(vec4(world, 1))
    // a mote that passes within arm's reach of the eye is a thirty-pixel
    // smear across the questions, so it gives up first
    const clear = smoothstep(0.9, 3.6, length(mv.xyz))
    const life = smoothstep(0, 0.08, climb)
      .mul(oneMinus(smoothstep(0.5, 1.0, climb)))
      .mul(mix(float(1), uHeat.mul(0.8).add(0.2), b.z))
      .mul(clear)
    const lv = varying(life)
    mat.vertexNode = cameraProjectionMatrix.mul(
      vec4(mv.xy.add(positionLocal.xy.mul(b.x)), mv.z, mv.w)
    )
    const d = length(uv().sub(vec2(0.5, 0.5))).mul(2.0)
    const fall = clamp(oneMinus(d), 0, 1)
    mat.colorNode = mix(hex3(EMBER), hex3(LAMP_CORE), pow(fall, 9.0).mul(0.7))
    mat.opacityNode = min(pow(fall, 2.6).mul(0.44).mul(lv).mul(uReveal), 1)
    const embers = new Mesh(quads(COUNT, [['iA', 4, iA], ['iB', 3, iB]]), mat)
    embers.frustumCulled = false
    embers.position.y = FLOOR_Y
    embers.renderOrder = 7
    root.add(embers)
  }

  // ------------------------------------------------------------ the turning
  /* Three rates, none of them a multiple of another, so the instrument
     never returns to the same reading twice on one descent. */
  const W_PLATE = 0.016
  const W_RIM = 0.0271
  const W_COURT = -0.0114
  // a still frame is still a composed frame: reduced motion holds the
  // instrument at an angle that was chosen, not at zero
  const HOLD = 11.2

  function update(dt: number, elapsed: number, reveal: number, fire: number): void {
    if (!root.visible) return
    void dt
    const t = reduced ? HOLD : elapsed
    uT.value = t
    uReveal.value = reveal
    uHeat.value = fire
    uFlick.value = reduced
      ? 0.88
      : 0.7 + 0.18 * Math.sin(t * 2.3) + 0.09 * Math.sin(t * 5.9 + 1.7) + 0.05 * Math.sin(t * 11.3 + 4.1)
    plate.rotation.y = t * W_PLATE
    rim.rotation.y = t * W_RIM
    court.rotation.y = t * W_COURT
    // the lamps' bearing in the stone's own frame, so their pools slide
    // over the engraving as the two plates part company
    uLampOff.value = rim.rotation.y - plate.rotation.y + Math.PI / 2
  }

  return {
    update,
    visible(v: boolean) {
      root.visible = v
    },
  }
}
