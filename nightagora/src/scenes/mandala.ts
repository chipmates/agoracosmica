/** The descent's own instrument: three carved volumes, thirty fires.
 * All relief, stone, metal and light are procedural. The lighting evaluates
 * the nearest three members of a circular lamp field, in world space, so
 * each pool follows its source while the stones turn independently. */
import {
  AdditiveBlending, BackSide, BufferGeometry, Color, Group,
  InstancedBufferAttribute, InstancedBufferGeometry, LatheGeometry, Mesh,
  MeshBasicNodeMaterial, PlaneGeometry, Scene, SphereGeometry, Sprite,
  SpriteNodeMaterial, Vector2,
} from 'three/webgpu'
import * as TSL from 'three/tsl'
import { combine, piercedCourt, revolve, stoneRing } from './mandala/geometry'
import {
  abacusGeometry, bayCentre, beamGeometry, COL_H, columnProfile,
  ECHINUS_PROFILE, FLOOR_Y, NEAR, PLINTH_H, plinthGeometry, ringBays,
  ringStandings,
} from './agora'
import { FOUNDING_SEED, mulberry32 } from '../core/seed'

// A single boundary for TSL's polymorphic node graph, as in the donor organs.
type N = any
const { abs, atan, attribute, cameraPosition, cameraProjectionMatrix,
  cameraViewMatrix, clamp, cos, cross, dot, exp, float, floor, fract, fwidth,
  instancedBufferAttribute, length, max, min, mix, modelWorldMatrix,
  mx_noise_float, mx_fractal_noise_float, normalWorld, normalize, oneMinus,
  positionLocal, positionWorld, pow, screenCoordinate, sin, smoothstep, sqrt,
  step, uniform, uv, vec2, vec3, vec4 } = TSL as unknown as Record<string, N>
const TAU = Math.PI * 2
const LAMP_R = 11.35
const LAMP_Y = 1.42
/** where a flame's root sits: inside the cup, under its lip */
const FLAME_ROOT_Y = 0.78
/** where the coal bed's light stands over the well: the paving is at -0.9,
    the bed sits on it, and a fire lights from just above its own coals */
const HEARTH_Y = -0.28
/** the court's near ring stands at its own floor height, on the map as in the
    room: the cut only reads as one place if the two rings share one metre */
const COL_BASE = FLOOR_Y + NEAR.lift
const GOLD = '#e0b96a'
const PAPER = '#f3efe2'
/** where the court's own fire stands, in the court's metres: the map takes
    its first light from here once the ride has come down to the room */
const COURT_FIRE = { y: -0.45, z: -5.6 }
/** the map's size in the court's metres once the ride has landed: a hair
    under one, so its paving and ring win the depth test against the court
    rising at the same place behind them */
export const LANDED_SCALE = 0.996
/** the ride's last stretch, in descent progress. The instrument's machinery
    goes down into the paving it stands on, and the court comes up behind the
    ring before the map is switched off with the camera at the seat. */
export const CUT = {
  wheelDown: [0.856, 0.912],
  lampsOut: [0.885, 0.915],
  beltDown: [0.895, 0.928],
  hearthOut: [0.9, 0.93],
  landScale: [0.895, 0.922],
  courtRise: [0.922, 0.944],
  mapOut: 0.947,
} as const
const WHEEL_SINK = 3.2 // the rails' crown under the paving's face
const BELT_SINK = 1.9 // the cups' lips under the paving's face
const ramp = (k: number, [a, b]: readonly [number, number]): number => {
  const t = Math.min(1, Math.max(0, (k - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
/** The map's scale along the ride. A tall stage draws the whole instrument
    smaller; before the court rises the scale comes up to the court's own
    metres. The camera scales with it about the same origin, so the picture
    of the map does not change while its size does. */
export function mapScaleAt(progress: number, aspect: number): number {
  const fit = Math.min(1, aspect / 1.05)
  return fit + (LANDED_SCALE - fit) * ramp(progress, CUT.landScale)
}
/** 0 until the court rises behind the ring, 1 once it stands */
export function courtRiseAt(progress: number): number {
  return ramp(progress, CUT.courtRise)
}
const c = (hex: string, gain = 1): N => {
  const v = new Color(hex)
  return vec3(v.r * gain, v.g * gain, v.b * gain)
}
const noise = (p: N): N => mx_noise_float(p)
const fractal = (p: N, oct: number, amp: number): N =>
  mx_fractal_noise_float(p, oct, 2.0, 0.5, amp)
const hash = (p: N): N => fract(sin(dot(p, vec2(127.1, 311.7))).mul(43758.5453))
const dither = (): N => hash(screenCoordinate.xy).sub(0.5).mul(0.00032)
const shoulder = (v: N): N => v.div(v.mul(0.32).add(1))

export interface MandalaHandles {
  update(
    dt: number,
    elapsed: number,
    reveal: number,
    fire: number,
    deep?: number,
    progress?: number
  ): void
  visible(v: boolean): void
}

export function createMandala(scene: Scene): MandalaHandles {
  const root = new Group()
  root.visible = false
  scene.add(root)
  const plate = new Group(), rim = new Group(), court = new Group()
  root.add(plate, rim, court)
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const rand = mulberry32(FOUNDING_SEED + 89)
  const uReveal = uniform(0), uHeat = uniform(0), uT = uniform(0)
  const uLampAngle = uniform(0), uCourtAngle = uniform(0), uFlick = uniform(1)
  const uScale = uniform(1), uFireFlick = uniform(1), uDeep = uniform(0)
  const uLamps = uniform(1), uHearth = uniform(1), uCourtFire = uniform(0)

  /** World coordinates expressed in the full-size stage: portrait restages
   * the complete instrument uniformly, including the lamps and their light. */
  const P = positionWorld.div(uScale)
  const lightField = (n: N): N => {
    const angle = atan(P.z, P.x).add(uLampAngle)
    const nearest = floor(angle.mul(30 / TAU).add(0.5))
    let light: N = float(0)
    for (let offset = -1; offset <= 1; offset++) {
      const a = nearest.add(offset).mul(TAU / 30).sub(uLampAngle)
      const lp = vec3(cos(a).mul(LAMP_R), LAMP_Y, sin(a).mul(LAMP_R))
      const delta = lp.sub(P)
      const d2 = dot(delta, delta)
      const incidence = max(dot(n, normalize(delta)), 0)
      light = light.add(incidence.mul(2.3).div(d2.add(0.48)))
    }
    return light.mul(uFlick).mul(uLamps)
  }
  /** the court's fire, seen from the map once the ride is low enough to be in
      the room: a point source low in its bowl, falling off as the court's own
      floor pool does */
  const courtFire = (n: N, k: number, soft: number): N => {
    const delta = vec3(0, COURT_FIRE.y, COURT_FIRE.z).sub(P)
    const incidence = max(dot(n, normalize(delta)), 0)
    return incidence.mul(k).div(dot(delta, delta).add(soft)).mul(uCourtFire).mul(uFireFlick)
  }

  /** The same quarry and half-bond paving as the agora. Grooves remove
   * light; the bevels return only what a lamp or the sky can actually find. */
  function stoneMaterial(kind: 'map' | 'limb' | 'court' | 'socket'): MeshBasicNodeMaterial {
    const mat = new MeshBasicNodeMaterial()
    const Q = positionLocal
    const xz = Q.xz
    const r = length(xz)
    const rW = length(P.xz)
    const a = atan(Q.z, Q.x)
    const px = max(fwidth(Q.x), fwidth(Q.z)).add(0.002)
    const line = (distance: N, width: number): N => oneMinus(smoothstep(width, px.mul(0.7).add(width), abs(distance)))
    const arc = (count: number): N => abs(fract(a.mul(count / TAU).add(0.5)).sub(0.5)).mul(r.mul(TAU / count))
    const warp = noise(xz.mul(0.57).add(7.2))
    const quarry = noise(vec2(Q.x.mul(0.85).add(Q.z.mul(0.29)), Q.z.mul(0.33)).add(warp.mul(0.28)))
    const fine = noise(xz.mul(19.0))
    const vein = pow(clamp(oneMinus(abs(quarry)), 0, 1), 30)
    const grain = noise(xz.mul(7.1).add(19.8))
    // A small mineral normal, subordinate to the actual bevel geometry.
    const bumpX = noise(xz.add(vec2(0.025, 0)).mul(7.1).add(19.8)).sub(grain)
    const bumpZ = noise(xz.add(vec2(0, 0.025)).mul(7.1).add(19.8)).sub(grain)
    const N = normalize(normalWorld.add(vec3(bumpX.mul(0.48), 0, bumpZ.mul(0.48))))
    const top = smoothstep(0.6, 0.95, normalWorld.y)
    const lamp = lightField(N)
    const sky = max(dot(N, normalize(vec3(-0.4, 0.82, 0.26))), 0).mul(0.7).add(0.2)
    const face = oneMinus(top)
    let alb: N = mix(c('#17223a'), c('#454b58'), quarry.mul(0.18).add(0.38))
    alb = alb.mul(grain.mul(0.18).add(0.9)).mul(fine.mul(0.065).add(1))
    alb = alb.add(c('#8d93ad', 0.055).mul(vein))
    let cut: N = float(0), lip: N = float(0), cupShade: N = float(0)
    if (kind === 'map') {
      const rowF = Q.z.add(4.8).div(0.94)
      const row = floor(rowF)
      const colF = Q.x.div(1.28).add(fract(row.mul(0.5)))
      const dj = min(min(fract(rowF), oneMinus(fract(rowF))).mul(0.94), min(fract(colF), oneMinus(fract(colF))).mul(1.28))
      cut = line(dj, 0.015)
      lip = line(dj.sub(0.043), 0.013)
      alb = alb.mul(hash(vec2(row, floor(colF))).mul(0.24).add(0.88))
      // The map's eight survey axes are incised, never continuously gilded.
      const survey = line(arc(8).sub(0.035), 0.02).mul(smoothstep(1.3, 2.0, r))
      cut = max(cut, survey.mul(0.65))
      for (const radius of [1.95, 3.16, 8.8, 9.1, 13.65]) {
        cut = max(cut, line(r.sub(radius), 0.025))
        lip = max(lip, line(r.sub(radius + 0.055), 0.014))
      }
      /* THE SUSPENDED COURT STANDS OVER THIS PAVING, AND THE THIRTY LAMPS
         STAND OUTSIDE IT. Its own footprint painted straight down is an
         occlusion and nothing more: the wheel reads as a print of a wheel.
         So there are two terms. The core is what no light reaches, directly
         under the rails and the spokes. The penumbra is the same shapes
         thrown INWARD and widened, because every lamp of the ring is
         outside the court and above it, so what it casts falls toward the
         well. One extra evaluation of two masks, no second light, no map. */
      const ca = atan(P.z, P.x).add(uCourtAngle)
      const soft = (dist: N, half: number, feather: number): N =>
        oneMinus(smoothstep(float(half), float(half + feather), abs(dist)))
      const spokeAt = (rr: N, half: number, feather: number): N =>
        oneMinus(smoothstep(float(half), float(half + feather), abs(fract(ca.mul(8 / TAU).add(0.5)).sub(0.5))))
          .mul(smoothstep(3.3, 3.7, rr))
          .mul(oneMinus(smoothstep(7.0, 7.5, rr)))
      const rail = max(line(r.sub(7.42), 0.39), line(r.sub(3.35), 0.40))
      const spoke = spokeAt(r, 0.05, 0.11)
      // how far a lamp at the rim throws the court's own edge across the map
      const thrown = r.add(0.72)
      const railPen = max(soft(thrown.sub(7.42), 0.44, 0.62), soft(thrown.sub(3.35), 0.44, 0.58))
      const spokePen = spokeAt(thrown, 0.055, 0.26)
      alb = alb.mul(oneMinus(max(rail, spoke).mul(0.43)))
      alb = alb.mul(oneMinus(max(railPen, spokePen).mul(0.3)))
      // the ring's plinths stand on this paving once the belt has gone down
      // into it: each foot keeps its contact dark
      for (const { x, z } of ringStandings(NEAR.r, NEAR.angles)) {
        cupShade = max(cupShade, oneMinus(smoothstep(0.42, 1.05, length(P.xz.sub(vec2(x, z))))).mul(0.7))
      }
    } else if (kind === 'limb') {
      const ticks = (count: number, depth: number, width: number): N => line(arc(count), width).mul(step(float(13.2).sub(depth), r)).mul(step(r, 13.2))
      cut = max(ticks(150, 0.29, 0.018), max(ticks(30, 0.65, 0.035), ticks(6, 1.06, 0.06)))
      lip = max(ticks(30, 0.65, 0.065).sub(cut), line(r.sub(13.32), 0.025))
      // One double gate index, cut deep across the graduated belt.
      const gateD = abs(fract(a.div(TAU).add(0.5)).sub(0.5)).mul(r.mul(TAU))
      cut = max(cut, line(gateD.sub(0.15), 0.05).mul(step(12, r)))
      cut = max(cut, line(r.sub(10.17), 0.025))
      alb = alb.mul(0.86)
      /* THIRTY BODIES BETWEEN THE PAVING AND THE THIRTY FLAMES. A cup blocks
         its own flame straight down (the contact dark it sits in) and blocks
         each neighbour's throw along the ring, which leaves a tapering lobe of
         shade to either side. Both terms are 2D in the cup grid: no second
         light, no map. */
      const cupOff = fract(a.mul(30 / TAU).add(0.5)).sub(0.5)
      const arcD = cupOff.mul(r.mul(TAU / 30))
      const radD = r.sub(LAMP_R)
      const foot = length(vec2(arcD, radD))
      const contact = oneMinus(smoothstep(0.24, 0.98, foot))
      // each neighbour's throw lands as one soft ellipse along the ring,
      // longer than it is wide because the light comes in low
      const lobeD = length(vec2(abs(arcD).sub(0.92).div(1.15), radD.div(0.46)))
      const lobe = oneMinus(smoothstep(0.42, 1.0, lobeD))
      /* AND THE COLUMNS STAND ON THIS SAME BELT. Ten feet that do not turn
         with it, each with its contact dark, and each thrown INWARD because
         every lamp of the ring is outside the ring of columns. The feet are
         read in world space, where the colonnade stands still. */
      const inward = P.xz.mul(rW.add(0.62).div(max(rW, float(0.001))))
      let feet: N = float(0)
      for (const { x, z } of ringStandings(NEAR.r, NEAR.angles)) {
        const at = vec2(x, z)
        feet = max(
          feet,
          oneMinus(smoothstep(0.44, 1.18, length(P.xz.sub(at)))).mul(0.88)
            .add(oneMinus(smoothstep(0.52, 1.75, length(inward.sub(at)))).mul(0.3))
        )
      }
      cupShade = clamp(contact.mul(0.86).add(lobe.mul(0.34)).add(feet), 0, 0.93)
    } else if (kind === 'court') {
      cut = max(line(r.sub(7.5), 0.035), line(r.sub(3.26), 0.028))
      lip = max(line(r.sub(7.56), 0.026), line(r.sub(3.32), 0.025))
      const tools = line(fract(r.mul(10)).sub(0.5).div(10), 0.004)
      cut = max(cut, tools.mul(0.22).mul(oneMinus(smoothstep(0.015, 0.1, px))))
      alb = alb.mul(1.5)
    }
    // Quarry bedding visible on the vertical faces, with an undercut seam.
    const bedding = line(fract(Q.y.mul(5)).sub(0.5).div(5), 0.012)
    alb = alb.mul(oneMinus(bedding.mul(face).mul(0.25)))
    alb = alb.mul(oneMinus(cut.mul(top).mul(0.78)))
    const shade = oneMinus(cupShade)
    let col: N = alb.mul(
      c('#8d93ad', 0.85).mul(sky).mul(oneMinus(cupShade.mul(0.72)))
        .add(c(GOLD, 1.7).mul(lamp).mul(shade))
    )
    col = col.add(c(PAPER, 0.0014).mul(lip).mul(top).mul(sky))
    col = col.add(c(GOLD, 0.022).mul(lip).mul(top).mul(lamp).mul(shade))
    /* THE COAL BED IS A SOURCE, not a wash. It stands half a metre over the
       well, so the paving around it takes a real pool, the inner faces of the
       rails above it take the up-light, and both fall off as a light does. */
    const hv = vec3(0, HEARTH_Y, 0).sub(P)
    const hd2 = dot(hv, hv)
    const hinc = max(dot(N, normalize(hv)), 0)
    const fire = hinc.mul(7.2).div(hd2.add(1.1)).mul(uHeat).mul(uHearth).mul(uFireFlick)
    col = col.add(alb.mul(c('#ff8c3a', 1.9)).mul(fire))
    // and the ash it throws: the stone nearest the bed is warm even where no
    // face turns toward it
    col = col.add(c('#ff7a2e', 0.05).mul(uHeat).mul(uHearth).mul(uFireFlick)
      .div(dot(P.xz, P.xz).mul(0.35).add(1)))
    col = col.add(alb.mul(c('#fbd8a4', 1.1)).mul(courtFire(N, 5.6, 1.2)))
    /* AIR. At arrival range the far rim is thirty metres of night away and the
       near rim is ten, and stone that reads the same at both distances reads
       as a print. The air arrives with the fire, because that is when the
       ride is close enough for a metre to mean anything. */
    const dCam = length(cameraPosition.div(uScale).sub(P))
    const air = smoothstep(9, 42, dCam).mul(uHeat).mul(0.44)
    col = mix(col, c('#101b35', 0.62), air)
    mat.colorNode = shoulder(col).add(dither()).mul(uReveal)
    return mat
  }

  /* THE DEEP — what the fall falls through. The night's own field is seeded
     for a SEATED eye and holds nothing under the horizon, and the middle of
     this ride looks down into exactly that. So the descent carries its own
     night: the depth of it, the same river of dust crossing it, rifts of dark
     inside the dust, and a grain under all of it. Three scales and a
     gradient, on one shell, behind everything. */
  const deepMat = new MeshBasicNodeMaterial({
    transparent: true, side: BackSide, depthWrite: false,
  })
  {
    const dir = normalize(positionLocal)
    const dep = smoothstep(-0.95, 0.30, dir.y)
    let col: N = mix(c('#010207'), c('#0a1429'), pow(dep, 1.4))
    // the large form: the night is not even, it has masses and pools. Two
    // scales, because one alone reads as fog and a phone's frame is a
    // narrow window that has to find structure wherever it lands
    const cloud = clamp(fractal(dir.mul(3.5).add(3.1), 4, 0.62), -1, 1)
    const fine = clamp(fractal(dir.mul(9.5).add(31.0), 3, 0.66), -1, 1)
    col = col.add(c('#0e1932', 0.075).mul(clamp(cloud, 0, 1)))
    col = col.add(c('#121e38', 0.05).mul(clamp(fine, 0, 1)).mul(clamp(cloud.add(0.6), 0, 1)))
    col = col.mul(oneMinus(clamp(cloud.negate(), 0, 1).mul(0.30)))
    /* THE RIVER CROSSES THE FALL. Its plane stands nearly upright, so the
       band runs through the sky the ride looks down into instead of lying
       along a horizon nobody sees from up here. */
    const bandN = normalize(vec3(0.86, 0.21, -0.46))
    const wobble = clamp(fractal(dir.mul(1.7).add(13.0), 3, 0.7), -1, 1).mul(0.055)
    const across = abs(dot(dir, bandN).add(wobble))
    const core = oneMinus(smoothstep(0.01, 0.115, across))
    const halo = oneMinus(smoothstep(0.06, 0.30, across))
    // lanes run WITH the river; the rifts are where the dust hides the light
    const lanes = clamp(fractal(dir.mul(6.4).add(7.4), 4, 0.78).mul(0.5).add(0.58), 0, 1)
    const rift = smoothstep(-0.42, 0.22, clamp(fractal(dir.mul(3.4).add(19.0), 3, 0.72), -1, 1))
    col = col.add(c('#93a6cc', 0.10).mul(core.mul(0.75).add(halo.mul(0.45))).mul(lanes).mul(rift))
    // the far small lights the dust hides and uncovers
    const grit = pow(clamp(noise(dir.mul(74)), 0, 1), 7).mul(0.6)
      .add(pow(clamp(noise(dir.mul(124).add(5)), 0, 1), 10).mul(0.85))
      .add(pow(clamp(noise(dir.mul(168).add(17)), 0, 1), 13).mul(0.8))
    col = col.add(c('#c2cfea', 0.52).mul(grit).mul(halo.mul(0.5).add(0.5)).mul(rift.mul(0.4).add(0.6)))
    // and the grain the whole field is printed on
    col = col.mul(noise(dir.mul(190)).mul(0.06).add(1)).add(dither())
    deepMat.colorNode = col
    deepMat.opacityNode = uDeep
  }
  const deep = new Mesh(new SphereGeometry(84, 40, 28), deepMat)
  deep.renderOrder = -20
  deep.frustumCulled = false
  deep.visible = false
  scene.add(deep)
  /* THE DOORWAY HAS AN INSIDE. For the first fifth of the ride the frame is
     the moon's own face, swallowing the eye: a plane with six levels of
     range in it. The night on the far side of that door shows THROUGH it
     instead, so the breath the visitor takes between the eclipse and the map
     is a night and not a black card. Once the ride is past the door the deep
     goes back behind everything, where it belongs. */
  function deepThroughDoor(through: boolean): void {
    deepMat.depthTest = !through
    deep.renderOrder = through ? 30 : -20
  }

  const base = new Mesh(stoneRing(0, 14, -2.1, -0.9, 0.18), stoneMaterial('map'))
  const limb = new Mesh(stoneRing(9.85, 13.55, -0.25, 0.45, 0.11), stoneMaterial('limb'))
  const pierced = new Mesh(piercedCourt(), stoneMaterial('court'))
  plate.add(base)
  rim.add(limb)
  court.add(pierced)

  /* THE COURT'S OWN NEAR RING, STANDING ON THE MAP. The ride flies over the
     territory for the whole descent and used to meet its first column only at
     the cut. So the ten columns of the near arc stand here too, from the
     court's profile at the court's radius and angles, merged into ONE draw.
     They do not turn: the plate, the belt and the suspended court each
     revolve on their own, and this ring is the destination the fall is aimed
     at, which has to be standing exactly where the room's ring stands when
     the map goes out. The arc is open toward the visitor, as the court is. */
  function lathe(profile: Array<[number, number]>, segments: number): BufferGeometry {
    return new LatheGeometry(profile.map(([r, y]) => new Vector2(r, y)), segments)
  }
  function colonnadeGeometry(): BufferGeometry {
    const parts: BufferGeometry[] = []
    for (const { x, z, yaw } of ringStandings(NEAR.r, NEAR.angles)) {
      const put = (g: BufferGeometry, y: number): void => {
        parts.push(g.rotateY(yaw).translate(x, COL_BASE + y, z).toNonIndexed())
      }
      // the shaft carries the court's own 26 facets, so the silhouette at the
      // handover is the same silhouette
      put(lathe(columnProfile(), 26), 0)
      put(lathe(ECHINUS_PROFILE, 22), COL_H + 0.1)
      // the crown and the footing are solid: from above, an open lathe is a
      // hole down the middle of every column
      put(abacusGeometry(), COL_H + 0.235)
      put(plinthGeometry(), -PLINTH_H)
    }
    for (const { mid, half, chord } of ringBays(NEAR.r, NEAR.angles)) {
      const [bx, bz] = bayCentre(NEAR.r, mid, half)
      parts.push(
        beamGeometry()
          .scale(chord + 0.18, 1, 1)
          .rotateY(-mid)
          .translate(bx, COL_BASE + COL_H + 0.44, bz)
          .toNonIndexed()
      )
    }
    return combine(parts)
  }
  const colonnadeMat = new MeshBasicNodeMaterial()
  {
    const h = P.y.sub(COL_BASE)
    const nW = normalWorld
    // twenty flutes, cut into the shaft alone. The normal turns about the
    // column's own axis, so every flute takes a lit arris and a dark hollow
    // off the lamp standing beside it, which is what carves stone.
    const shaftMask = smoothstep(0.34, 0.5, h)
      .mul(oneMinus(smoothstep(COL_H - 0.18, COL_H - 0.04, h)))
    const f = fract(uv().x.mul(20))
    const horiz = vec3(nW.z.negate(), float(0), nW.x)
    // a crown's top face has no horizontal tangent: normalize would hand back
    // a NaN and paint the capital black
    const tHor = horiz.div(max(length(horiz), float(0.001)))
    const nF = normalize(nW.add(tHor.mul(sin(f.mul(TAU)).mul(0.36).mul(shaftMask))))
    const hollow = oneMinus(pow(sin(f.mul(Math.PI)), 2).mul(0.24).mul(shaftMask))
    const grain = noise(vec3(P.x.mul(5.2), P.y.mul(2.8), P.z.mul(5.2)))
    const bedding = oneMinus(
      smoothstep(0.0, 0.02, abs(fract(h.sub(0.32).div(0.59)).sub(0.5))).mul(0.18).mul(shaftMask)
    )
    /* the court's stone is the PALE one, against the lapis of its floor, so
       the ring on the map is quarried a step lighter than the paving it
       stands on. It is still the night's stone: nothing here is limestone in
       daylight. */
    let alb: N = mix(c('#2c3750'), c('#6e7587'), grain.mul(0.22).add(0.5))
    alb = alb.mul(bedding).mul(hollow)
    /* EVERY LAMP OF THE RING STANDS OUTSIDE THIS COLONNADE, so the faces the
       ride looks at are the unlit ones and the light arrives around the
       shafts. A flame a metre off is an area source over a stone this size:
       what it throws at the far face comes back off the belt and around the
       drum, and without that term the ring reads as a fence of black sticks. */
    const lamp = lightField(nF).add(lightField(nF.negate()).mul(0.34))
    /* and the sky is TAKEN OFF the faces that look up at it. Half the ride
       reads this ring from overhead, where a lit crown on every column would
       print a comb of pale marks across the field the questions stand in. */
    const sky = max(dot(nF, normalize(vec3(-0.4, 0.82, 0.26))), 0).mul(0.7).add(0.2)
      .mul(oneMinus(max(nF.y, 0).mul(0.5)))
    // the shaft gives itself to the night as it climbs, so the ring reads as
    // dark verticals from overhead and the questions keep their field
    const lift = smoothstep(0.4, COL_H, h)
    let col: N = alb.mul(
      c('#8d93ad', 0.7).mul(sky).mul(oneMinus(lift.mul(0.34)))
        .add(c(GOLD, 1.55).mul(lamp).mul(oneMinus(lift.mul(0.5))))
    )
    // the well is far from this ring, but it is the only fire in the map and
    // the inner faces know it
    const hv = vec3(0, HEARTH_Y, 0).sub(P)
    const hinc = max(dot(nF, normalize(hv)), 0)
    col = col.add(alb.mul(c('#ff8c3a', 1.9))
      .mul(hinc.mul(7.2).div(dot(hv, hv).add(1.1)).mul(uHeat).mul(uHearth).mul(uFireFlick)))
    // and once the ride is in the room, the court's fire finds the faces
    // turned to it, dying as the shaft climbs as the court's own shafts do
    col = col.add(alb.mul(c('#ffb469', 1.2)).mul(courtFire(nF, 7.0, 2.0)).mul(oneMinus(lift.mul(0.73))))
    const dCam = length(cameraPosition.div(uScale).sub(P))
    col = mix(col, c('#101b35', 0.62), smoothstep(9, 42, dCam).mul(uHeat).mul(0.44))
    colonnadeMat.colorNode = shoulder(col).add(dither()).mul(uReveal)
  }
  root.add(new Mesh(colonnadeGeometry(), colonnadeMat))

  // Thirty physical cups share a mesh; the thirty flames share one draw.
  const cups = []
  const flameAt = new Float32Array(30 * 3)
  const phases = new Float32Array(30 * 2)
  for (let i = 0; i < 30; i++) {
    const a = i * TAU / 30
    const x = Math.cos(a) * LAMP_R, z = Math.sin(a) * LAMP_R
    const cup = revolve([[0.11, 0.45], [0.18, 0.52], [0.17, 0.68], [0.34, 0.83], [0.32, 0.91], [0.25, 0.89], [0.09, 0.7]], 16)
    cup.translate(x, 0, z)
    cups.push(cup)
    flameAt.set([x, FLAME_ROOT_Y, z], i * 3)
    phases.set([a, 0.8 + rand() * 0.35], i * 2)
  }
  const cupMat = new MeshBasicNodeMaterial()
  const cupN = normalWorld
  cupMat.colorNode = c('#332c24').mul(lightField(cupN).mul(0.9).add(0.1))
    .add(c(GOLD, 0.028).mul(pow(max(cupN.y, 0), 3)))
    .mul(uReveal)
  rim.add(new Mesh(combine(cups), cupMat))
  /* A FLAME STANDS IN ITS OWN CUP. A view-aligned sprite hung over the cup
     leans along the screen's up, which from above is not the column's up:
     on the side arcs the flames rode clear of their bowls. Each flame is a
     quad anchored at its root inside the cup, facing the eye, with its axis
     the world vertical as the eye sees it, so the cup's lip covers the root
     from the side and the flame cannot leave the bowl at any azimuth or
     scale. Seen from above a flame is shorter, and it is drawn so. */
  const flameGeo = new InstancedBufferGeometry()
  {
    const quad = new PlaneGeometry(1, 1)
    flameGeo.index = quad.index
    for (const key of Object.keys(quad.attributes)) {
      const attr = quad.attributes[key]
      if (attr) flameGeo.setAttribute(key, attr)
    }
    flameGeo.setAttribute('flameAt', new InstancedBufferAttribute(flameAt, 3))
    flameGeo.setAttribute('flameVar', new InstancedBufferAttribute(phases, 2))
    flameGeo.instanceCount = 30
  }
  const lampMat = new MeshBasicNodeMaterial({
    // the quad is built facing the eye, so its front face is the one seen
    transparent: true, blending: AdditiveBlending, depthWrite: false,
  })
  {
    const at = attribute('flameAt', 'vec3')
    const lv = attribute('flameVar', 'vec2')
    const root = modelWorldMatrix.mul(vec4(at, 1)).xyz
    const up = vec3(0, 1, 0)
    const toEye = normalize(cameraPosition.sub(root))
    const across = cross(up, toEye)
    const cosElev = length(across)
    const right = across.div(max(cosElev, float(0.001)))
    const upSeen = cross(toEye, right)
    // a flame grows back into its cup as the lamp goes out
    const size = lv.y.mul(uScale)
    const w = size.mul(1.2)
    const h = size.mul(1.5).mul(sqrt(uLamps)).mul(cosElev.mul(0.55).add(0.45))
    const world = root
      .add(right.mul(positionLocal.x.mul(w)))
      .add(upSeen.mul(positionLocal.y.add(0.2).mul(h)))
    lampMat.vertexNode = cameraProjectionMatrix.mul(cameraViewMatrix).mul(vec4(world, 1))
    const q = uv().sub(0.5)
    const flick = sin(uT.mul(3.4).add(lv.x.mul(4))).mul(0.07).add(0.93)
    const bend = sin(q.y.mul(11).sub(uT.mul(2.2)).add(lv.x)).mul(0.025).mul(smoothstep(-0.1, 0.4, q.y))
    const tongue = exp(pow(q.x.sub(bend).div(max(float(0.025), float(0.10).sub(q.y.mul(0.15)))), 2).negate())
      .mul(smoothstep(-0.21, -0.13, q.y)).mul(oneMinus(smoothstep(0.12, 0.39, q.y)))
    const halo = exp(dot(q.mul(vec2(1, 0.85)), q.mul(vec2(1, 0.85))).mul(-20))
    const core = exp(dot(q.sub(vec2(0, -0.1)), q.sub(vec2(0, -0.1))).mul(-240))
    lampMat.colorNode = mix(c(GOLD), c('#fff3d6'), core.add(tongue.mul(0.5)))
    lampMat.opacityNode = clamp(tongue.mul(0.92).add(core.mul(0.6)).add(halo.mul(0.14)), 0, 1)
      .mul(uReveal).mul(flick).mul(uLamps)
  }
  const lamps = new Mesh(flameGeo, lampMat)
  lamps.frustumCulled = false
  lamps.renderOrder = 5
  rim.add(lamps)

  /* THE COAL BED. The destination seen from above is a fire, not a decal:
     a bed of broken coal in its own kerb, read at three scales (the ragged
     outline the ash makes, the plates of coal the cracks divide, the speckle
     burning inside the cracks). It is a surface, so it takes the whole pull
     of the light it gives; the air over it is a separate additive breath.
     The bed only ever appears with the heat: an opaque disc at the hub
     printed a black hole for as long as the fire was cold. */
  const bedMat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false })
  {
    const q = positionLocal.xz
    const hr = length(q)
    const ang = atan(q.y, q.x)
    /* three scales: the plates the fire has broken the bed into, the seams
       burning between them, and the speckle inside the seams. The plates
       are dark on top because ash is dark on top; all the light in a coal
       bed comes out of its cracks. */
    const warp = noise(q.mul(1.5).add(4.3)).mul(0.30)
    const plates = noise(q.mul(1.75).add(vec2(warp, warp.mul(1.7))))
    const seam = oneMinus(smoothstep(0.0, 0.19, abs(plates)))
    const fineSeam = oneMinus(smoothstep(0.0, 0.085, abs(noise(q.mul(4.3).add(11.0)))))
    const speck = pow(clamp(noise(q.mul(21.0).add(uT.mul(0.05))), 0, 1), 2.0)
    // the bed is hottest where it is deepest, and it breathes on two clocks
    const deepHeat = exp(pow(hr.div(0.78), 2).negate())
    const breath = sin(uT.mul(0.77)).mul(0.09).add(sin(uT.mul(1.93).add(1.1)).mul(0.05)).add(1)
    const glow = clamp(
      float(0.06)
        .add(seam.mul(0.78))
        .add(fineSeam.mul(0.24))
        .add(speck.mul(0.14))
        .mul(deepHeat.mul(0.85).add(0.15)),
      0, 1.5
    ).mul(breath)
    // the bed has lumps: coal is broken stone, and the top of a lump takes
    // what little light there is while its side keeps the dark
    const lump = noise(q.mul(3.4).add(27.0)).mul(0.5).add(0.5)
    const ash = mix(c('#0f0b08'), c('#2b231c'), noise(q.mul(4.1).add(2.1)).mul(0.5).add(0.5))
      .mul(lump.mul(0.55).add(0.62))
    // a coal runs from black through dull red to the one hot place in it
    const ember = mix(c('#4a1002'), c('#ff9a3c'), clamp(pow(glow, 1.45), 0, 1))
      .add(c('#ffd9a0', 0.5).mul(clamp(glow.sub(0.85).mul(2.4), 0, 1)))
    bedMat.colorNode = mix(ash, ember, clamp(glow.mul(1.7).sub(0.16).mul(uHeat), 0, 1))
      .add(dither())
    // the ash spills where it spills: the edge is noise, never a circle
    const edge = noise(vec2(cos(ang), sin(ang)).mul(2.6)).mul(0.16).add(0.90)
    bedMat.opacityNode = oneMinus(smoothstep(edge.sub(0.13), edge, hr))
      .mul(clamp(uHeat.mul(2.2), 0, 1)).mul(uHearth).mul(uReveal)
  }
  const bed = new Mesh(stoneRing(0, 1.06, -0.93, -0.868, 0.01, 48), bedMat)
  bed.renderOrder = 3
  plate.add(bed)

  /* the kerb: a course of stone set round the bed, so the fire is HELD by
     something and the well has one more scale of build at arrival range */
  const kerb = new Mesh(stoneRing(1.02, 1.32, -0.95, -0.80, 0.05, 64), stoneMaterial('socket'))
  plate.add(kerb)

  // the air over the coals: one additive breath, no edge of its own
  const heartMat = new MeshBasicNodeMaterial({
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
  })
  {
    const hr2 = length(positionLocal.xz)
    const lick = noise(vec3(positionLocal.x.mul(2.4), positionLocal.z.mul(2.4), uT.mul(0.33)))
      .mul(0.22).add(0.86)
    // the air over the coals is a HALO, not a wash: the round before this
    // one drowned the bed's own structure under its own glow
    heartMat.colorNode = c('#ff9440', 0.24).mul(lick).mul(uHeat).mul(uHearth).mul(uFireFlick)
      .mul(exp(pow(hr2.div(0.70), 2).negate())).mul(uReveal)
  }
  // it floats clear of the kerb, which is stone and holds its own shadow
  const heart = new Mesh(stoneRing(0, 2.0, -0.706, -0.700, 0.01, 48), heartMat)
  heart.renderOrder = 4
  plate.add(heart)

  /* THE COALS BREATHE OUT. One thin column over the bed, lit from below by
     what it rises from and giving that light back as it cools, gone before
     it reaches the rails. The only moving thing in the well, so the fire
     reads as burning and not as a lamp under glass. */
  {
    const SMOKE = window.innerWidth < 760 ? 26 : 44
    const puff = new Float32Array(SMOKE * 4)
    for (let i = 0; i < SMOKE; i++)
      puff.set([rand() * TAU, 0.04 + rand() * 0.38, rand(), 0.34 + rand() * 0.40], i * 4)
    const sm = new SpriteNodeMaterial({
      transparent: true, blending: AdditiveBlending, depthWrite: false,
    })
    const sa = instancedBufferAttribute(new InstancedBufferAttribute(puff, 4))
    const climb = fract(sa.z.add(uT.mul(0.055)))
    const sway = sin(climb.mul(4.1).add(sa.x)).mul(0.22).mul(climb)
    sm.positionNode = vec3(
      cos(sa.x).mul(sa.y).add(sway),
      climb.mul(3.4).sub(0.84),
      sin(sa.x).mul(sa.y).add(sway.mul(0.6))
    )
    sm.scaleNode = sa.w.mul(climb.mul(2.6).add(0.5))
    const sd = length(uv().sub(0.5)).mul(2)
    // the first metre of smoke over a fire is LIT, and it gives that light
    // back to the night on the way up
    sm.colorNode = mix(c('#d98047', 0.85), c('#5b6480', 0.30), smoothstep(0.04, 0.52, climb))
    sm.opacityNode = pow(clamp(oneMinus(sd), 0, 1), 1.7)
      .mul(smoothstep(0.0, 0.12, climb))
      .mul(oneMinus(smoothstep(0.35, 1.0, climb)))
      .mul(uHeat).mul(uHearth).mul(uReveal).mul(uFireFlick).mul(0.46)
    const smoke = new Sprite(sm)
    smoke.count = SMOKE
    smoke.frustumCulled = false
    smoke.renderOrder = 4
    plate.add(smoke)
  }

  const COUNT = window.innerWidth < 760 ? 48 : 90
  const motes = new Float32Array(COUNT * 4)
  for (let i = 0; i < COUNT; i++) motes.set([rand() * TAU, 0.7 + rand() * 9, rand(), 0.028 + rand() * 0.032], i * 4)
  const em = new SpriteNodeMaterial({ transparent: true, blending: AdditiveBlending, depthWrite: false })
  const ea = instancedBufferAttribute(new InstancedBufferAttribute(motes, 4))
  const climb = fract(ea.z.add(uT.mul(0.013)))
  em.positionNode = vec3(cos(ea.x.add(uT.mul(0.015))).mul(ea.y), climb.mul(28), sin(ea.x).mul(ea.y))
  em.scaleNode = ea.w
  const ed = length(uv().sub(0.5)).mul(2)
  em.colorNode = c(GOLD)
  em.opacityNode = pow(clamp(oneMinus(ed), 0, 1), 2).mul(sin(climb.mul(Math.PI))).mul(uReveal).mul(0.48)
  const embers = new Sprite(em)
  embers.count = COUNT
  embers.frustumCulled = false
  root.add(embers)

  return {
    update(_dt, elapsed, reveal, fire, deepAmount, progress) {
      // the deep opens before the map does, so it is driven ahead of the
      // early return that belongs to the instrument alone
      uDeep.value = deepAmount ?? 0
      deep.visible = uDeep.value > 0.002
      deepThroughDoor((progress ?? 1) < 0.19)
      if (!root.visible) return
      const t = reduced ? 11.2 : elapsed
      uT.value = t
      uReveal.value = reveal
      uHeat.value = fire
      uFlick.value = reduced ? 1 : 0.94 + 0.045 * Math.sin(t * 2.3) + 0.025 * Math.sin(t * 5.9 + 1.7)
      // a fire is not a lamp: it breathes wider and on its own clock
      uFireFlick.value = reduced ? 1 : 0.9 + 0.075 * Math.sin(t * 1.7) + 0.045 * Math.sin(t * 4.3 + 0.9)
      plate.rotation.y = t * 0.016
      rim.rotation.y = t * 0.0271
      court.rotation.y = t * -0.0114
      uLampAngle.value = rim.rotation.y
      uCourtAngle.value = court.rotation.y
      const k = progress ?? 1
      const scale = mapScaleAt(k, window.innerWidth / window.innerHeight)
      root.scale.setScalar(scale)
      uScale.value = scale
      // the machinery goes down into the paving it stood on; only the ring
      // and the paving are left when the court comes up behind them
      court.position.y = -WHEEL_SINK * ramp(k, CUT.wheelDown)
      rim.position.y = -BELT_SINK * ramp(k, CUT.beltDown)
      uLamps.value = 1 - ramp(k, CUT.lampsOut)
      uHearth.value = 1 - ramp(k, CUT.hearthOut)
      uCourtFire.value = courtRiseAt(k)
    },
    visible(v) {
      root.visible = v
      if (!v) deep.visible = uDeep.value > 0.002
    },
  }
}
