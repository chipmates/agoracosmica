/* THE ECLIPSE — the overture, and the first thing anyone ever sees of this
   project. A moon swallowing a light.

   THE ONE GLORY (2026-07-25): the corona carries this frame alone, so it
   is built the way a corona is actually built — a dipole field. Streamers
   crowd the magnetic equator and thin toward the poles, where short fine
   brushes stand instead. The lanes are RIDGED (bright at the zero of an
   angular harmonic stack, dark between), so they read as filaments rather
   than as the petals of a flower, and they shear outward so each one bends
   on its own. Two great helmet streamers reach five solar radii.

   THE MOON IS THE DARKEST THING IN THE FRAME, and its edge is rock: the
   silhouette radius wanders with seeded angular noise and the alpha is
   feathered by fwidth, so the limb antialiases at 1x and still reads as
   stone at the 26x of the door. The moon's own valleys are what carve the
   chromosphere into beads.

   THE DIAMOND RING earns its name by being OCCLUDED: the bead's bloom is
   drawn behind the disc, so the moon cuts it and the light sits ON the
   limb instead of washing across the face. Only a tight glint cross rides
   in front.

   Darkness carves (craft law 5): the sky brightens toward the disc and
   goes to true dark away from it, the horizon keeps the one warm band that
   says you are standing inside an umbra, and nothing else here glows. */

import {
  AdditiveBlending,
  BackSide,
  CircleGeometry,
  Color,
  DoubleSide,
  Group,
  InstancedBufferAttribute,
  Mesh,
  MeshBasicNodeMaterial,
  PlaneGeometry,
  PointsNodeMaterial,
  RingGeometry,
  Scene,
  SphereGeometry,
  Sprite,
  Vector3,
} from 'three/webgpu'
import * as TSL from 'three/tsl'
import { mulberry32, FOUNDING_SEED } from '../core/seed'
import { createFirmament } from '../core/firmament'

/* TSL, uncast — a hand-composed node graph outruns the generated overloads
   (the same boundary escape camp/tsl.ts makes). One cast, here, so the
   shaders below stay the readable part. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const T = TSL as any
const {
  abs, atan, clamp, cos, dot, exp, float, fract, fwidth, instancedBufferAttribute,
  length, max, min, mix, mx_noise_float, normalize, oneMinus, pow, sin, smoothstep,
  uniform, uv, vec2, vec3,
} = T
const positionLocal: N = TSL.positionLocal
const screenCoordinate: N = TSL.screenCoordinate

/* craft law 1 — sRGB lies. Every hand-picked constant goes through three's
   Color, which reads the hex as sRGB and hands back the LINEAR working
   values the shaders want. */
const lin = (hex: string): Color => new Color(hex)
const c3 = (c: Color, k = 1): N => vec3(c.r * k, c.g * k, c.b * k)

// the light: gold only ever EMITS here, never fills
const WHITE_HOT = lin('#fff6e6')
const EMBER = lin('#f6dfae')
const GOLD = lin('#e0b96a')
const GOLD_DEEP = lin('#a97c2f')
// hydrogen at the limb: the one rose in the whole night, and it is fire
const CHROMO = lin('#d8564e')
const PROMINENCE = lin('#e8756a')
// the night as a depth: abyss overhead, lapis in the body, one low ember
const ABYSS = lin('#050817')
const LAPIS = lin('#0B1330')
const HORIZON = lin('#131C42')
// the umbra's own sky: scattered corona light near the disc, nothing away
const HALO_NEAR = lin('#414E7E')
const HALO_WIDE = lin('#1D2650')
const TWILIGHT = lin('#8A4520')
// the moon: below the darkest value the dome ever wears, or the silhouette
// stops being a silhouette
const MOON = lin('#010206')
const MOON_MARE = lin('#04060F')

const REDUCED =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** where the eclipse hangs, as a bearing: the sky has to know which way to
    brighten, and the group's own position is the only honest source */
const ECLIPSE_AT = new Vector3(0, 1.35, -10)
const uEclipseDir = uniform(ECLIPSE_AT.clone().normalize())

/** craft law 2: dither every gradient at creation. Down in the abyss values
    the sRGB step is wide enough to band a clean gradient into stripes. */
const dither = (amp: number): N =>
  fract(sin(dot(screenCoordinate.xy.add(0.5), vec2(12.9898, 78.233))).mul(43758.5453))
    .sub(0.5)
    .mul(amp)

/** THE SHOULDER — a corona collar a hundred times brighter than the sky is
    still light, not a white ring. One soft rolloff on the bright end keeps
    the darks exactly where they were authored. */
const shoulder = (c: N): N => c.div(float(1).add(c.mul(0.42)))

/** the smoothstep the JS side needs for the totality gate */
function ease(a: number, b: number, k: number): number {
  const t = Math.min(1, Math.max(0, (k - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

export interface EclipseState {
  transit: number
  door: number
  skyBirth: number
  /** 0..1 how present the thirty lanterns are (whispers at the eclipse, full in the sky) */
  lanterns: number
  sinceFlash: number
  elapsed: number
}

export function createEclipse(scene: Scene) {
  const rand = mulberry32(FOUNDING_SEED)
  // tier by viewport, not by guess: a phone draws the same composition with
  // fewer wedges, and nothing in the frame is allowed to go missing
  const narrow = typeof window !== 'undefined' && window.innerWidth < 720
  const seg = (wide: number, thin: number): number => (narrow ? thin : wide)

  // ---------------------------------------------------------- the uniforms
  const uTime = uniform(0)
  /** how much light the corona is allowed: the transit's own ramp */
  const uIntensity = uniform(0)
  /** 0 until the last moment of the transit, 1 at totality. The delicate
      registers (chromosphere, prominences, polar brushes) belong to
      totality alone, because before it the photosphere would drown them. */
  const uTotal = uniform(0)
  /** the sky's share of the corona: scattered light, which is a SKY thing */
  const uHalo = uniform(0)
  /** the bead, 0..1 */
  const uFlash = uniform(0)

  // ------------------------------------------------------------- THE DOME
  /* Night is a depth, and the depth is READ near the disc: the sky lifts
     toward the corona and falls to true dark away from it. The horizon
     keeps one warm band, because inside an umbra the un-eclipsed world is
     still burning all the way around you. */
  const domeMat = new MeshBasicNodeMaterial()
  domeMat.side = BackSide
  domeMat.depthWrite = false
  {
    const d: N = normalize(positionLocal)
    const h = d.y

    let col: N = mix(c3(LAPIS), c3(ABYSS), smoothstep(0.04, 0.80, h))
    // the horizon lift: wide and weak. At full strength it drew a blue
    // sea-line straight across the frame at eye level (round 3).
    col = mix(col, c3(HORIZON), pow(clamp(oneMinus(abs(h).mul(5.5)), 0, 1), 2.4).mul(0.55))
    // and below the eye it sinks back to ink, so looking down during the
    // descent is clean darkness and never a muddy skirt
    col = mix(col, c3(ABYSS), clamp(h.negate().mul(5.0), 0, 1))

    // slow strata carved out of the wash, never a band
    const strat = mx_noise_float(vec3(d.x.mul(2.6), d.y.mul(5.4), uTime.mul(0.008)))
    col = col.mul(float(1).add(strat.mul(0.05)))

    // THE AUREOLE: the corona's own light scattered by the air. One
    // direction, three widths, and it dies with the corona.
    const cd = max(dot(d, uEclipseDir), 0)
    const near = pow(cd, 62).mul(0.45).add(pow(cd, 15).mul(0.18))
    const wide = pow(cd, 5.0).mul(0.07)
    col = col.add(c3(HALO_NEAR).mul(near).mul(uHalo))
    col = col.add(c3(HALO_WIDE).mul(wide).mul(uHalo))

    // THE RING OF DAY: the world outside the umbra, still in sunlight, all
    // the way around the horizon. Low and narrow, because a warm band any
    // wider than this is a sunset and this is not one (round 2).
    const band = exp(pow(h.add(0.185).div(0.048), 2).negate()).mul(uHalo)
    // carve the night's own blue out of the band before laying the warmth
    // in, or the two average into plum instead of reading as distant day
    col = col.mul(oneMinus(band.mul(0.38))).add(c3(TWILIGHT, 0.052).mul(band))

    domeMat.colorNode = shoulder(col).add(dither(0.0024))
  }
  const dome = new Mesh(new SphereGeometry(90, seg(64, 40), seg(40, 28)), domeMat)
  dome.renderOrder = -2
  scene.add(dome)

  // ---------------------------------------------------------- THE ECLIPSE
  const eclipse = new Group()
  eclipse.position.copy(ECLIPSE_AT)
  scene.add(eclipse)

  // the polar frame every surface of the eclipse is carved in. atan hands
  // back a true angle, and every harmonic below is an INTEGER multiple of
  // it, so nothing seams at the wrap.
  const P: N = positionLocal
  const r = length(P.xy)
  const rr = max(r, 0.0001)
  const ang = atan(P.y, P.x)
  const inv = float(1).div(rr)

  /* THE DIPOLE — a corona is a magnetic field made visible. The axis is
     tilted off vertical, streamers crowd its equator, and the poles keep
     only their short brushes. Everything else about this shape follows. */
  const AXIS = 0.52
  const axA = ang.sub(AXIS)
  const equator = pow(abs(sin(axA)), 1.9)
  const poles = pow(abs(cos(axA)), 7.0)

  /* THE FILAMENTS — a stack of angular harmonics, RIDGED so the bright
     part is the thin zero crossing and not the fat crest, sheared outward
     so each lane bends on its own instead of leaving as a spoke. The time
     terms are slower than a minute: the corona writhes, it never pulses. */
  const shear = sin(ang.mul(2.0).add(0.6)).mul(0.15).mul(r.sub(1.0))
  const aw = ang.add(shear)
  const harm = sin(aw.mul(3.0).add(uTime.mul(0.019)).add(0.7)).mul(0.46)
    .add(sin(aw.mul(7.0).sub(uTime.mul(0.015)).sub(1.9)).mul(0.28))
    .add(sin(aw.mul(13.0).add(uTime.mul(0.011)).add(2.6)).mul(0.17))
    .add(sin(aw.mul(23.0).sub(uTime.mul(0.008)).sub(0.4)).mul(0.09))
  // two registers, because a corona has both: broad soft streamers, and a
  // few crisp threads laid over them (round 4 — one register alone read as
  // a starburst, every ray the same width)
  const lane = pow(oneMinus(abs(harm)), 3.6)
  const thread = sin(aw.mul(17.0).add(2.2))
    .mul(0.5)
    .add(sin(aw.mul(29.0).sub(0.8)).mul(0.32))
    .add(sin(aw.mul(43.0).add(1.4)).mul(0.18))
  const crisp = pow(oneMinus(abs(thread)), 9.0)
  // a hair inside each lane, so a streamer has grain and not a smooth core.
  // Kept gentle: at the door's 26x a strong comb reads as brushed metal.
  const grain = sin(aw.mul(31.0).add(1.7)).mul(0.5).add(0.5)
  const filament = lane
    .mul(float(0.74).add(grain.mul(0.26)))
    .add(crisp.mul(0.55))
    .add(0.085)

  // ---------------------------------------------------- (a) THE CORONA
  const coronaMat = new MeshBasicNodeMaterial({
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    side: DoubleSide,
  })
  {
    // how far each direction reaches: the equator far, the poles near, and
    // two helmet streamers that go all the way out
    const spread = sin(ang.mul(2.0).sub(0.9)).mul(0.5).add(0.5)
    // the two great helmet streamers: narrow, and they go all the way out
    const helmet = pow(abs(sin(axA)), 18.0)
    const reach = float(1.10)
      .add(equator.mul(1.95))
      .add(spread.mul(0.70))
      .add(helmet.mul(2.10))
      // the whole field breathes once every forty seconds
      .mul(float(1).add(sin(uTime.mul(0.155)).mul(0.02)))

    // K corona falls off like a cube, the dusty F corona barely at all
    const body = pow(inv, 2.9).add(pow(inv, 1.25).mul(0.10))
    const taper = oneMinus(smoothstep(reach.mul(0.34), reach, r))
    // the ring's own outer rim must never be an edge in the picture
    const outer = smoothstep(5.2, 3.9, r)
    // and the poles are THIN, not merely short: a dipole that only
    // shortens its polar rays still reads as a wheel (round 4)
    const density = float(0.30).add(equator.mul(0.70))

    let a: N = body.mul(filament).mul(density).mul(taper).mul(outer)
    // THE BRUSHES: fine near-radial hairs everywhere close to the limb,
    // gathering into the classic stiff tufts over the poles
    const brush = pow(oneMinus(abs(sin(aw.mul(29.0)))), 3.0)
    a = a.add(
      float(0.30)
        .add(poles.mul(0.70))
        .mul(brush)
        .mul(pow(inv, 3.6))
        .mul(smoothstep(2.0, 1.0, r))
        .mul(0.55)
        .mul(uTotal)
    )
    // THE COLLAR: the bright tight ring every streamer rises out of. Thin
    // on purpose, or the frame gains a second white disc (round 2).
    a = a.add(pow(smoothstep(1.34, 1.0, r), 2.2).mul(0.55))
    // and the innermost hair of it steps back, because that hair belongs
    // to the chromosphere. At full strength the white collar simply ate
    // every trace of hydrogen colour off the limb (round 5).
    a = a.mul(float(0.34).add(smoothstep(1.02, 1.16, r).mul(0.66)))
    a = a.mul(uIntensity)

    // white-hot at the collar, gold through the streamers, deep gold in
    // the dust: one ramp, and it never leaves gold
    let col: N = mix(c3(GOLD), c3(WHITE_HOT), smoothstep(1.85, 1.0, r))
    col = mix(c3(GOLD_DEEP), col, smoothstep(3.8, 1.35, r))
    // the chromosphere bleeds a breath of rose into the innermost collar
    col = mix(col, c3(CHROMO).add(c3(EMBER, 0.5)), pow(smoothstep(1.14, 1.0, r), 3.0).mul(0.30).mul(uTotal))

    coronaMat.colorNode = shoulder(col.mul(a)).add(dither(0.005).mul(min(a.mul(8), 1)))
    coronaMat.opacityNode = float(1)
  }
  const corona = new Mesh(new RingGeometry(0.98, 5.2, seg(384, 224), 1), coronaMat)
  corona.renderOrder = 1
  eclipse.add(corona)

  // ------------------------------- (b) THE LIMB: chromosphere + prominences
  const rimMat = new MeshBasicNodeMaterial({
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    side: DoubleSide,
  })
  {
    // the photosphere edge, which is the one register that survives the
    // whole transit. Uneven, because a sun's edge is never a stroke.
    const uneven = sin(ang.mul(9.0).add(uTime.mul(0.021)))
      .mul(sin(ang.mul(5.0).sub(uTime.mul(0.017)).add(2.1)))
      .mul(0.16)
      .add(0.84)
    // ...and which has no business being here at totality, because at
    // totality there IS no photosphere. Standing it down is what finally
    // gave the hydrogen the limb to itself (round 6).
    const edge = pow(smoothstep(1.20, 1.0, r), 2.4).mul(uneven).mul(oneMinus(uTotal.mul(0.62)))

    // THE CHROMOSPHERE: hydrogen just past the limb. Arcs, not a ring —
    // most of a limb shows nothing and two stretches of it burn (round 4:
    // at ring strength the white collar simply ate the colour).
    const patch = pow(sin(ang.mul(3.0).add(1.3)).mul(0.5).add(0.5), 2.6)
      .mul(pow(sin(ang.mul(7.0).sub(0.4)).mul(0.5).add(0.5), 1.6))
      .mul(0.92)
      .add(0.08)
    const chromo = pow(smoothstep(1.088, 1.002, r), 1.6).mul(patch).mul(3.0).mul(uTotal)

    // THE PROMINENCES: three loops standing off the limb, breathing on a
    // clock no one watches. They start at 1.028 and not at 1.0, because
    // the moon's own silhouette reaches 1.022 and a loop that grows from
    // the sun's surface is a loop nobody ever sees (round 6).
    const FOOT = 1.028
    const promAt = (at: number, w: number, hgt: number, ph: number): N => {
      const dA = abs(sin(ang.sub(at).mul(0.5)))
      const g = exp(pow(dA.div(w), 2).negate())
      const lift = float(hgt).mul(float(0.86).add(sin(uTime.mul(0.09).add(ph)).mul(0.14)))
      const lobe = smoothstep(float(FOOT).add(lift), FOOT + 0.008, r).mul(
        smoothstep(FOOT - 0.010, FOOT + 0.012, r)
      )
      return g.mul(pow(lobe, 1.4))
    }
    const prom = promAt(1.95, 0.075, 0.165, 0.0)
      .add(promAt(-0.62, 0.045, 0.105, 2.4).mul(0.8))
      .add(promAt(3.02, 0.058, 0.195, 4.1).mul(0.9))
    const rose = chromo.add(prom.mul(2.6).mul(uTotal))

    const total = edge.add(rose)
    const col = mix(
      mix(c3(GOLD), c3(WHITE_HOT), pow(edge, 2)),
      mix(c3(CHROMO), c3(PROMINENCE), 0.4),
      clamp(rose.div(max(total, 0.0001)), 0, 1)
    )
    const a = total.mul(uIntensity)
    rimMat.colorNode = shoulder(col.mul(a)).add(dither(0.004).mul(min(a.mul(8), 1)))
    rimMat.opacityNode = float(1)
  }
  const rim = new Mesh(new RingGeometry(0.96, 1.42, seg(448, 256), 1), rimMat)
  rim.renderOrder = 2
  eclipse.add(rim)

  // ------------------------------------------------- (c) THE PHOTOSPHERE
  /* The light being swallowed. Without it the uncovered part of the sun
     during the transit is a hole in the sky the colour of the sky, and
     "a moon swallowing a light" has nothing to swallow (round 7). It
     lives entirely behind the moon at totality, and it is gated off there
     as well, so no dip of the ragged limb can ever let it flash. */
  const photoMat = new MeshBasicNodeMaterial({
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
  })
  {
    const rp = clamp(r.div(0.995), 0, 1)
    // limb darkening: a star is brighter at its heart and cooler at its rim
    const dark = float(1.55).sub(pow(rp, 2.4).mul(0.5))
    const feather = max(fwidth(r).mul(0.9), 0.0004)
    const a = smoothstep(float(0.995).add(feather), float(0.995).sub(feather), r)
    // no shoulder here on purpose: the surface of a star is the one thing
    // in this night allowed to blow out to white, and a crescent of it that
    // reads as cream reads as a paper cutout (round 8)
    photoMat.colorNode = mix(c3(WHITE_HOT), c3(EMBER), pow(rp, 8.0))
      .mul(dark)
      .mul(a)
      .mul(oneMinus(uTotal))
      .mul(uIntensity.mul(0.28).add(0.72))
    photoMat.opacityNode = float(1)
  }
  const photosphere = new Mesh(new CircleGeometry(1.0, seg(128, 96)), photoMat)
  photosphere.position.z = 0.05
  // between the dome and the corona, explicitly: renderOrder 0 is the
  // default every unordered thing in the night shares, and a sun that
  // sorts against the stars by accident is a sun that will one day flicker
  photosphere.renderOrder = -1
  eclipse.add(photosphere)

  // ------------------------------------------- (d) THE DIAMOND, at the rim
  /* The bead's bloom is drawn BEFORE the disc, so the moon eats its inner
     half. That occlusion is the whole trick: light that is cut by the limb
     sits ON the limb, and light that is not just washes the face. */
  const rimAngle = Math.PI * 0.24
  const diamond = new Group()
  diamond.position.set(Math.cos(rimAngle) * 1.02, Math.sin(rimAngle) * 1.02, 0.1)
  eclipse.add(diamond)

  const beadMat = new MeshBasicNodeMaterial({
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
  })
  {
    const q = positionLocal.xy
    const bd = length(q)
    const ba = atan(q.y, q.x).add(0.42)
    const core = pow(smoothstep(0.40, 0.0, bd), 2.6)
    const bloom = pow(smoothstep(2.6, 0.0, bd), 2.4).mul(0.34)
    // six rays, because a bead of photosphere seen through air has them
    const rays = pow(abs(cos(ba.mul(3.0))), 46.0)
      .mul(pow(smoothstep(2.6, 0.08, bd), 2.0))
      .mul(0.5)
    const a = core.add(bloom).add(rays).mul(uFlash)
    const col = mix(c3(EMBER), c3(WHITE_HOT), pow(smoothstep(0.9, 0.0, bd), 1.6))
    beadMat.colorNode = shoulder(col.mul(a)).add(dither(0.004).mul(min(a.mul(8), 1)))
    beadMat.opacityNode = float(1)
  }
  const bead = new Mesh(new PlaneGeometry(5.2, 5.2), beadMat)
  bead.renderOrder = 3
  diamond.add(bead)

  // ------------------------------------------------------- (e) THE MOON
  /* An edge of rock. The silhouette radius wanders with three octaves of
     seeded angular noise, and the alpha is feathered by the pixel's own
     footprint, so the limb stays smooth at 1x and still reads as stone at
     the 26x of the door. */
  const moonMat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false })
  {
    // one noise for the great lobes, then products of sines for the crater
    // scale and the fine chipping. Sines close on themselves at the wrap
    // for free, and this shape is drawn full-frame at the door, where a
    // stack of 3D noise lookups is a bill nobody needs to pay (round 2).
    const cx = cos(ang)
    const sy = sin(ang)
    const n1 = mx_noise_float(vec3(cx.mul(2.7), sy.mul(2.7), 0.0))
    const n2 = mx_noise_float(vec3(cx.mul(13.0), sy.mul(13.0), 7.3))
    // one sine pair for the finest chipping, because a third noise lookup
    // buys nothing the eye can name (round 3: the sine-only limb scalloped)
    const w3 = sin(ang.mul(53.0).add(2.7)).mul(sin(ang.mul(31.0).sub(1.1)))
    const limb = float(1.012).add(n1.mul(0.0052)).add(n2.mul(0.0031)).add(w3.mul(0.0013))
    const feather = max(fwidth(r).mul(0.9), 0.0004)
    const a = smoothstep(limb.add(feather), limb.sub(feather), r)

    // the maria: a whisper of value so the disc is a body and not a hole,
    // and it fades out at the edge where the silhouette has to be absolute
    const mare = mx_noise_float(vec3(P.x.mul(1.7), P.y.mul(1.7), 3.7)).mul(0.5).add(0.5)
    const inner = smoothstep(limb, limb.mul(0.58), r)
    const col = mix(c3(MOON), c3(MOON_MARE), mare.mul(inner))
    // barely any dither: the disc lives so far down in the values that a
    // normal amplitude reads as a weave on the rock (round 3)
    moonMat.colorNode = col.add(dither(0.0011))
    moonMat.opacityNode = a
  }
  const disc = new Mesh(new CircleGeometry(1.24, seg(128, 96)), moonMat)
  disc.position.z = 0.15
  disc.renderOrder = 4
  eclipse.add(disc)

  // ------------------------------------------- (f) THE GLINT, in front
  /* Tight on purpose. The whole reason the old bead failed is that a wide
     bloom in front of the moon lights the moon. This one is a jewel's
     sparkle: a core the size of a bead and four short rays. */
  const glintMat = new MeshBasicNodeMaterial({
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
  })
  {
    const q = positionLocal.xy
    const gd = length(q)
    const ga = atan(q.y, q.x).add(0.35)
    const core = pow(smoothstep(0.11, 0.0, gd), 1.8)
    const cross = pow(abs(cos(ga.mul(2.0))), 130.0)
      .mul(pow(smoothstep(0.45, 0.02, gd), 2.2))
      .mul(0.55)
    const a = core.add(cross).mul(uFlash)
    glintMat.colorNode = shoulder(c3(WHITE_HOT).mul(a))
    glintMat.opacityNode = float(1)
  }
  const glint = new Mesh(new PlaneGeometry(0.9, 0.9), glintMat)
  glint.renderOrder = 6
  diamond.add(glint)

  // ------------------------------------------------------------- THE AIR
  /* Something between the eye and the corona, or the corona is a decal.
     One slow veil at arm's length from the disc, drifting, lit by the
     light it is standing in. Peak opacity is a few percent: it is air. */
  const hazeMat = new MeshBasicNodeMaterial({
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    side: DoubleSide,
  })
  const uHaze = uniform(0)
  {
    // the eclipse's own centre and scale, projected onto this plane
    const q = vec2(positionLocal.x, positionLocal.y.sub(0.837)).div(0.627)
    const rq = length(q)
    const drift = uTime.mul(0.013)
    const v1 = mx_noise_float(vec3(q.x.mul(0.85), q.y.mul(0.85).add(drift), 1.7))
    const veil = max(v1, 0)
    const fall = pow(smoothstep(7.0, 1.0, rq), 1.6)
    const a = veil.mul(fall).mul(uHaze)
    const col = mix(c3(HALO_WIDE), c3(GOLD_DEEP), pow(smoothstep(5.0, 1.0, rq), 1.8))
    hazeMat.colorNode = shoulder(col.mul(a)).add(dither(0.003).mul(min(a.mul(10), 1)))
    hazeMat.opacityNode = float(1)
  }
  const haze = new Mesh(new PlaneGeometry(19, 14, 1, 1), hazeMat)
  haze.position.set(0, 0, -6.2)
  haze.renderOrder = 7
  // a phone gets the composition, not the whisper: at 390 the corona
  // already fills the frame, so this full-screen veil costs a pass and
  // buys almost nothing (the mobile tier, round 3)
  if (!narrow) scene.add(haze)

  // ---- THE FIRMAMENT — the standard stars (core/firmament.ts): real
  // depth 60..180 with the near bokeh shell, seated bias filling the
  // band behind the pillars. The dome writes no depth so the far
  // stars shine through. ----
  const firmament = createFirmament({
    count: 2000,
    far: [60, 180],
    near: [30, 80],
    bias: 'seated',
    rand,
  })
  scene.add(firmament.points)

  // ------------------------------------------------------- THE WANDERERS
  /* Thirty anonymous sparks, and they stay a MURMUR. One instanced quad
     field rather than thirty sprites: sized particles ride instanced
     quads in this codebase, and thirty draw calls for a whisper is a
     tax the phone pays for nothing. */
  const WCOUNT = 30
  const wandererBase: Array<[number, number, number]> = []
  const wPos = new Float32Array(WCOUNT * 3)
  const wCol = new Float32Array(WCOUNT * 3)
  const wSize = new Float32Array(WCOUNT)
  const wTw = new Float32Array(WCOUNT * 2)
  {
    const tint = new Color()
    for (let i = 0; i < WCOUNT; i++) {
      // the wanderers gather in a wide cone around the visitor's gaze:
      // a sky of thirty must greet, not hide. Drift reveals the rest.
      const th = Math.acos(0.42 + 0.58 * rand())
      const ph = rand() * Math.PI * 2
      const rrr = 40 + 12 * rand()
      const raw: [number, number, number] = [
        rrr * Math.sin(th) * Math.cos(ph),
        rrr * Math.sin(th) * Math.sin(ph) * 0.85,
        -rrr * Math.cos(th),
      ]
      // tilt the gathering upward: in the sky phase the visitor gazes up
      const tilt = 0.6
      const p: [number, number, number] = [
        raw[0],
        raw[1] * Math.cos(tilt) - raw[2] * Math.sin(tilt),
        raw[1] * Math.sin(tilt) + raw[2] * Math.cos(tilt),
      ]
      wandererBase.push(p)
      wPos[i * 3] = p[0]
      wPos[i * 3 + 1] = p[1]
      wPos[i * 3 + 2] = p[2]
      // every wanderer is gold, but no two are the same gold
      tint.copy(GOLD).lerp(EMBER, rand() * 0.7)
      const dim = 0.62 + rand() * 0.38
      wCol[i * 3] = tint.r * dim
      wCol[i * 3 + 1] = tint.g * dim
      wCol[i * 3 + 2] = tint.b * dim
      wSize[i] = 2.6 + rand() * 3.4
      wTw[i * 2] = 0.35 + rand() * 0.9
      wTw[i * 2 + 1] = rand() * Math.PI * 2
    }
  }
  const uWand = uniform(0)
  const wandererMat = new PointsNodeMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  })
  {
    wandererMat.positionNode = instancedBufferAttribute(new InstancedBufferAttribute(wPos, 3))
    wandererMat.sizeAttenuation = false
    const sizeN = instancedBufferAttribute(new InstancedBufferAttribute(wSize, 1))
    const colN = instancedBufferAttribute(new InstancedBufferAttribute(wCol, 3))
    const twN = instancedBufferAttribute(new InstancedBufferAttribute(wTw, 2))
    wandererMat.sizeNode = sizeN
    const d = uv().sub(vec2(0.5, 0.5))
    const dd = length(d)
    const halo = pow(smoothstep(0.5, 0.0, dd), 2.2)
    const core = pow(smoothstep(0.17, 0.0, dd), 1.5)
    const breath = float(1).sub(sin(uTime.mul(twN.x).add(twN.y)).mul(0.5).add(0.5).mul(0.3))
    wandererMat.colorNode = colN
    wandererMat.opacityNode = halo.mul(0.5).add(core.mul(0.72)).mul(breath).mul(uWand)
  }
  const wandererField = new Sprite(wandererMat)
  wandererField.count = WCOUNT
  wandererField.frustumCulled = false
  const wanderers = new Group()
  wanderers.add(wandererField)
  scene.add(wanderers)

  function update(s: EclipseState): void {
    // the corona writhes on the scene clock; a still night still composes
    uTime.value = REDUCED ? 9.4 : s.elapsed

    const cover = 1 - s.transit
    disc.position.x = -0.62 * cover
    uIntensity.value = 0.12 + 0.88 * Math.pow(s.transit, 2)
    uTotal.value = ease(0.7, 0.99, s.transit)

    // the diamond ring: the bead ignites while the corona is still faint,
    // then the corona blooms as the bead dies
    let flash = 0
    if (s.sinceFlash >= 0 && s.sinceFlash < 1.4) {
      const k = s.sinceFlash / 1.4
      flash = (1 - k) * (0.55 + 0.45 * Math.exp(-s.sinceFlash * 3))
      bead.scale.setScalar(0.62 + 0.5 * (1 - k))
      uIntensity.value *= 0.3 + 0.7 * k
    }

    firmament.update(s.elapsed, s.skyBirth)
    uWand.value = s.skyBirth * s.lanterns
    wanderers.rotation.y = s.elapsed * 0.011
    wanderers.rotation.x = Math.sin(s.elapsed * 0.05) * 0.01

    const door = s.door
    const scale = 1 + Math.pow(door, 1.6) * 26
    eclipse.scale.setScalar(scale)
    // once through the door, the eclipse is behind you. The corona dies
    // early in the swallow, or its scaled-up glow paints a muddy wash
    // across the whole frame mid-passage.
    eclipse.visible = door < 0.995
    const swallow = Math.max(0, 1 - Math.pow(door * 1.45, 1.6))
    uIntensity.value *= swallow
    uFlash.value = flash * swallow
    glint.visible = uFlash.value > 0.002
    bead.visible = uFlash.value > 0.002

    // the sky's own share: scattered corona light, plus the bead's surge
    uHalo.value = Math.min(1, uIntensity.value * 0.9 + flash * 0.45) * Math.max(0, 1 - door * 1.9)
    // the air belongs to the frame you STAND in. Once the door opens, the
    // eclipse is a doorway and its unscaled veil would smear across the
    // moon's own face (round 2: that was the brown mottling at desc 0.04).
    uHaze.value = 0.028 * uIntensity.value * Math.max(0, 1 - door * 4)
    haze.visible = uHaze.value > 0.0008

    // one slow breath through the whole overture: the corona rises and
    // settles against a limb that stays exactly where it is
    const pulse = REDUCED ? 1 : 1 + Math.sin(s.elapsed * 0.42) * 0.006
    corona.scale.setScalar(pulse)
  }

  return { update, wanderers, wandererBase, wandererOpacity: () => uWand.value }
}
