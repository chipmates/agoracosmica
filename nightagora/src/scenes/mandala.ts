/** The descent's own instrument: three carved volumes, thirty fires.
 * All relief, stone, metal and light are procedural. The lighting evaluates
 * the nearest three members of a circular lamp field, in world space, so
 * each pool follows its source while the stones turn independently. */
import {
  AdditiveBlending, Color, Group, InstancedBufferAttribute, Mesh,
  MeshBasicNodeMaterial, Scene, Sprite, SpriteNodeMaterial,
} from 'three/webgpu'
import * as TSL from 'three/tsl'
import { combine, piercedCourt, revolve, stoneRing } from './mandala/geometry'
import { FOUNDING_SEED, mulberry32 } from '../core/seed'

// A single boundary for TSL's polymorphic node graph, as in the donor organs.
type N = any
const { abs, atan, cameraPosition, clamp, cos, dot, exp, float, floor, fract,
  fwidth, instancedBufferAttribute, length, max, min, mix, mx_noise_float,
  normalWorld, normalize, oneMinus, positionLocal, positionWorld, pow,
  screenCoordinate, sin, smoothstep, step, uniform, uv, vec2, vec3 } = TSL as unknown as Record<string, N>
const TAU = Math.PI * 2
const LAMP_R = 11.35
const LAMP_Y = 1.42
const GOLD = '#e0b96a'
const PAPER = '#f3efe2'
const c = (hex: string, gain = 1): N => {
  const v = new Color(hex)
  return vec3(v.r * gain, v.g * gain, v.b * gain)
}
const noise = (p: N): N => mx_noise_float(p)
const hash = (p: N): N => fract(sin(dot(p, vec2(127.1, 311.7))).mul(43758.5453))
const dither = (): N => hash(screenCoordinate.xy).sub(0.5).mul(0.00032)
const shoulder = (v: N): N => v.div(v.mul(0.32).add(1))

export interface MandalaHandles {
  update(dt: number, elapsed: number, reveal: number, fire: number, progress?: number): void
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
  const uScale = uniform(1)

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
    return light.mul(uFlick)
  }

  /** The same quarry and half-bond paving as the agora. Grooves remove
   * light; the bevels return only what a lamp or the sky can actually find. */
  function stoneMaterial(kind: 'map' | 'limb' | 'court' | 'socket'): MeshBasicNodeMaterial {
    const mat = new MeshBasicNodeMaterial()
    const Q = positionLocal
    const xz = Q.xz
    const r = length(xz)
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
    let cut: N = float(0), lip: N = float(0)
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
    } else if (kind === 'limb') {
      const ticks = (count: number, depth: number, width: number): N => line(arc(count), width).mul(step(float(13.2).sub(depth), r)).mul(step(r, 13.2))
      cut = max(ticks(150, 0.29, 0.018), max(ticks(30, 0.65, 0.035), ticks(6, 1.06, 0.06)))
      lip = max(ticks(30, 0.65, 0.065).sub(cut), line(r.sub(13.32), 0.025))
      // One double gate index, cut deep across the graduated belt.
      const gateD = abs(fract(a.div(TAU).add(0.5)).sub(0.5)).mul(r.mul(TAU))
      cut = max(cut, line(gateD.sub(0.15), 0.05).mul(step(12, r)))
      cut = max(cut, line(r.sub(10.17), 0.025))
      alb = alb.mul(0.86)
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
    let col: N = alb.mul(c('#8d93ad', 0.85).mul(sky).add(c(GOLD, 1.7).mul(lamp)))
    col = col.add(c(PAPER, 0.0014).mul(lip).mul(top).mul(sky))
    col = col.add(c(GOLD, 0.022).mul(lip).mul(top).mul(lamp))
    // The last questions receive a low firelight from the dark central well.
    const heat = float(2.5).div(dot(P.xz, P.xz).add(3)).mul(uHeat)
    col = col.add(alb.mul(c('#ff9c42', 0.7)).mul(heat).mul(max(N.y, 0)))
    mat.colorNode = shoulder(col).add(dither()).mul(uReveal)
    return mat
  }

  const base = new Mesh(stoneRing(0, 14, -2.1, -0.9, 0.18), stoneMaterial('map'))
  const limb = new Mesh(stoneRing(9.85, 13.55, -0.25, 0.45, 0.11), stoneMaterial('limb'))
  const pierced = new Mesh(piercedCourt(), stoneMaterial('court'))
  plate.add(base)
  rim.add(limb)
  court.add(pierced)

  // Thirty physical cups share a mesh; the thirty flames share a Sprite.
  const cups = []
  const positions = new Float32Array(30 * 3)
  const phases = new Float32Array(30 * 2)
  for (let i = 0; i < 30; i++) {
    const a = i * TAU / 30
    const x = Math.cos(a) * LAMP_R, z = Math.sin(a) * LAMP_R
    const cup = revolve([[0.11, 0.45], [0.18, 0.52], [0.17, 0.68], [0.34, 0.83], [0.32, 0.91], [0.25, 0.89], [0.09, 0.7]], 16)
    cup.translate(x, 0, z)
    cups.push(cup)
    positions.set([x, LAMP_Y, z], i * 3)
    phases.set([a, 0.8 + rand() * 0.35], i * 2)
  }
  const cupMat = new MeshBasicNodeMaterial()
  const cupN = normalWorld
  cupMat.colorNode = c('#332c24').mul(lightField(cupN).mul(0.9).add(0.1))
    .add(c(GOLD, 0.028).mul(pow(max(cupN.y, 0), 3)))
    .mul(uReveal)
  rim.add(new Mesh(combine(cups), cupMat))
  const lampMat = new SpriteNodeMaterial({ transparent: true, blending: AdditiveBlending, depthWrite: false })
  const lp = instancedBufferAttribute(new InstancedBufferAttribute(positions, 3))
  const lv = instancedBufferAttribute(new InstancedBufferAttribute(phases, 2))
  lampMat.positionNode = lp
  lampMat.scaleNode = vec2(1.2, 1.5).mul(lv.y)
  const q = uv().sub(0.5)
  const flick = sin(uT.mul(3.4).add(lv.x.mul(4))).mul(0.07).add(0.93)
  const bend = sin(q.y.mul(11).sub(uT.mul(2.2)).add(lv.x)).mul(0.025).mul(smoothstep(-0.1, 0.4, q.y))
  const tongue = exp(pow(q.x.sub(bend).div(max(float(0.025), float(0.10).sub(q.y.mul(0.15)))), 2).negate())
    .mul(smoothstep(-0.21, -0.13, q.y)).mul(oneMinus(smoothstep(0.12, 0.39, q.y)))
  const halo = exp(dot(q.mul(vec2(1, 0.85)), q.mul(vec2(1, 0.85))).mul(-20))
  const core = exp(dot(q.sub(vec2(0, -0.1)), q.sub(vec2(0, -0.1))).mul(-240))
  lampMat.colorNode = mix(c(GOLD), c('#fff3d6'), core.add(tongue.mul(0.5)))
  lampMat.opacityNode = clamp(tongue.mul(0.92).add(core.mul(0.6)).add(halo.mul(0.14)), 0, 1).mul(uReveal).mul(flick)
  const lamps = new Sprite(lampMat)
  lamps.count = 30
  lamps.frustumCulled = false
  lamps.renderOrder = 5
  rim.add(lamps)

  // An ember at the axis establishes the destination without a billboard
  // fire seen from above. The real brazier belongs to the territory below.
  /* the ember only ever ADDS to the plate it sits on: an opaque disc here
     printed a black hole at the hub for as long as the fire was cold */
  const heartMat = new MeshBasicNodeMaterial({
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
  })
  const hr = length(positionLocal.xz)
  const coal = noise(positionLocal.xz.mul(12).add(uT.mul(0.08))).mul(0.35).add(0.55)
  heartMat.colorNode = c('#ff9c42', 0.8).mul(coal).mul(uHeat).mul(exp(hr.mul(-3))).mul(uReveal)
  // a disc this small holds its circle at half the segments
  plate.add(new Mesh(stoneRing(0, 0.74, -0.92, -0.86, 0.02, 32), heartMat))

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
    update(_dt, elapsed, reveal, fire, _progress) {
      if (!root.visible) return
      const t = reduced ? 11.2 : elapsed
      uT.value = t
      uReveal.value = reveal
      uHeat.value = fire
      uFlick.value = reduced ? 1 : 0.94 + 0.045 * Math.sin(t * 2.3) + 0.025 * Math.sin(t * 5.9 + 1.7)
      plate.rotation.y = t * 0.016
      rim.rotation.y = t * 0.0271
      court.rotation.y = t * -0.0114
      uLampAngle.value = rim.rotation.y
      uCourtAngle.value = court.rotation.y
      const aspect = window.innerWidth / window.innerHeight
      const scale = Math.min(1, aspect / 1.05)
      root.scale.setScalar(scale)
      uScale.value = scale
    },
    visible(v) { root.visible = v },
  }
}
