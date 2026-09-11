/* THE GROUND OF THE SMALL DARK PLANET — the dome, the earth, the river,
   the mist. Everything here is a value structure before it is a picture:
   night is a DEPTH (abyss ink overhead, lapis in the body, one ember at
   the bearing of the dying day), gold only ever emits or reflects, and
   the earth always keeps enough skylight to be a surface.

   the founder's law (2026-07-25): the CAMP is a dawn you can read. The night
   lives overhead, in uNight, and the ground follows it only part of the
   way (uDeep). Look up, and the sky deepens over a camp that is still
   there when you look back down. */

import {
  BackSide,
  BufferGeometry,
  type CanvasTexture,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicNodeMaterial,
  PlaneGeometry,
  SphereGeometry,
} from 'three/webgpu'
import {
  abs,
  cameraPosition,
  clamp,
  dot,
  float,
  floor,
  fract,
  length,
  max,
  min,
  mix,
  modelWorldMatrix,
  type N,
  normalize,
  positionLocal,
  reflect,
  pow,
  sin,
  smoothstep,
  step,
  uv,
  varying,
  vec2,
  vec3,
  vec4,
} from './tsl'
import {
  c3,
  clipOf,
  dither,
  fireColU,
  firelight,
  firePosU,
  fireRadU,
  FIRES,
  hex3,
  lin,
  MAP,
  planetize,
  shoulder,
  reliefNormal,
  sn,
  uDeep,
  uDuskDir,
  uFloor,
  uNight,
  uReveal,
  uT,
} from './hour'

import { sampleCampShadow } from './shadows'

/* the polar ground: rings spaced geometrically so the detail sits where
   the eye is, out to a rim far below the horizon */
function polarDisc(rMax: number, segs: number, growth: number): BufferGeometry {
  const radii = [0.45]
  let last = 0.45
  while (last < rMax) {
    last = last * growth
    radii.push(last)
  }
  radii[radii.length - 1] = rMax
  const nR = radii.length
  const pos: number[] = [0, 0, 0]
  const uvs: number[] = [0, 0]
  for (let i = 0; i < nR; i++) {
    const r = radii[i] ?? rMax
    for (let s = 0; s < segs; s++) {
      const th = (s / segs) * Math.PI * 2
      pos.push(Math.cos(th) * r, 0, Math.sin(th) * r)
      uvs.push(r / rMax, s / segs)
    }
  }
  const at = (i: number, s: number): number => 1 + i * segs + (s % segs)
  const idx: number[] = []
  for (let s = 0; s < segs; s++) idx.push(0, at(0, s + 1), at(0, s))
  for (let i = 0; i < nR - 1; i++)
    for (let s = 0; s < segs; s++)
      idx.push(at(i, s), at(i, s + 1), at(i + 1, s), at(i, s + 1), at(i + 1, s + 1), at(i + 1, s))
  const geo = new BufferGeometry()
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3))
  geo.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  geo.setIndex(idx)
  return geo
}

export interface World {
  group: Group
  /** the dome rides with the eye: a sky is never a place you can reach */
  follow(x: number, y: number, z: number): void
}

export function createWorld(shadow: CanvasTexture): World {
  const group = new Group()

  // ------------------------------------------------------------ THE SKY
  const sky = new Mesh(new SphereGeometry(160, 48, 32), skyMaterial())
  sky.renderOrder = -1
  sky.frustumCulled = false
  group.add(sky)

  // --------------------------------------------------------- THE GROUND
  const ground = new Mesh(polarDisc(190, 112, 1.058), groundMaterial(shadow))
  ground.renderOrder = 0
  ground.frustumCulled = false
  group.add(ground)

  // ---------------------------------------------------------- THE RIVER
  const river = new Mesh(new PlaneGeometry(240, 26, 120, 13), riverMaterial())
  river.rotation.x = -Math.PI / 2
  river.position.set(0, MAP.river.y, 15.5)
  river.renderOrder = 1
  river.frustumCulled = false
  group.add(river)

  // ----------------------------------------------------------- THE MIST
  const mistMat = mistMaterial()
  const MIST: Array<[number, number, number]> = [
    [12.0, 3.6, 0.98],
    [21.0, 5.0, 1.0],
    [28.5, 7.0, 1.0],
    [38.0, 9.0, 0.85],
  ]
  MIST.forEach(([z, h, k], i) => {
    const m = new Mesh(new PlaneGeometry(240, h, 96, 4), mistMat)
    m.position.set(0, MAP.river.y + h / 2 - 0.25, z)
    m.renderOrder = 10 + i
    m.scale.y = k
    m.frustumCulled = false
    group.add(m)
  })

  return {
    group,
    follow(x, y, z) {
      sky.position.set(x, y, z)
    },
  }
}

// ---------------------------------------------------------------- the dome
function skyMaterial(): MeshBasicNodeMaterial {
  const mat = new MeshBasicNodeMaterial()
  mat.side = BackSide
  mat.depthWrite = false
  const d: N = varying(normalize(positionLocal))
  const h = d.y

  // night is a DEPTH, and the dawn end of every band stays open enough
  // that a camp under it can be read
  const zen = mix(hex3('#142B43', 0.65), hex3('#070A1C', 0.22), uNight)
  const mid = mix(hex3('#445C70', 0.65), hex3('#0A0F2C', 0.30), uNight)
  const hor = mix(hex3('#938A81', 0.62), hex3('#0C1234', 0.42), uNight)

  let col: N = mix(zen, mid, smoothstep(0.8, 0.1, h))
  col = mix(col, hor, pow(clamp(oneMinusScaled(h), 0, 1), 2.2))

  // THE EMBER DUSK sits at ONE bearing: measure the azimuth on the ground
  // plane. A 3D dot stays high across the whole forward sky, which is what
  // smears plum over the flanks.
  const dh = normalize(vec2(d.x, d.z).add(vec2(0.00001, 0.00001)))
  const sh = normalize(vec2(uDuskDir.x, uDuskDir.z))
  const azh = max(dot(dh, sh), 0)
  const ember = pow(azh, 6).mul(smoothstep(0.26, -0.12, h)).mul(oneMinusN(uNight.mul(0.9)))
  col = col.add(hex3('#F1B879', 0.65).mul(ember))
  // purple is atmosphere ONLY, and only just above the ember
  col = col.add(
    hex3('#3B2E5E', 0.1).mul(pow(azh, 3)).mul(smoothstep(0.3, 0.01, h)).mul(oneMinusN(uNight)).mul(0.4)
  )
  const strata = sn(vec3(d.x.mul(4), h.mul(18), d.z.mul(4)))
    .add(sn(vec3(d.x.mul(11), h.mul(42), d.z.mul(11))).mul(0.3))
  const cloud = smoothstep(-0.15, 0.45, strata).mul(smoothstep(-0.02, 0.15, h)).mul(smoothstep(0.68, 0.3, h))
  col = mix(col, col.mul(0.48).add(hex3('#B39178', 0.035).mul(pow(azh, 3))), cloud.mul(oneMinusN(uNight)).mul(0.64))
  // slow strata carved out of the glow, never a band
  col = col.mul(float(1).add(sn(vec3(d.x.mul(3.4), d.y.mul(7.0), uT.mul(0.012))).mul(0.05)))
  mat.colorNode = col.add(dither(0.0034)).mul(uReveal)
  return mat
}

/** 1 - h*2.6, clamped by the caller: the horizon band's reach */
function oneMinusScaled(h: N): N {
  return float(1).sub(h.mul(2.6))
}
function oneMinusN(x: N): N {
  return float(1).sub(x)
}

// --------------------------------------------------------------- the earth
function groundMaterial(shadow: CanvasTexture): MeshBasicNodeMaterial {
  const mat = new MeshBasicNodeMaterial()
  mat.side = DoubleSide

  // THE CHANNEL: the Danube is cut into the skin of the planet, its
  // shoreline wandering with the ground it eats, so the waterline is found
  // by the geometry instead of drawn as an edge
  const p: N = positionLocal
  const wob = sn(vec3(p.x.mul(0.055), 0, 3.1)).mul(1.5)
  const chan = float(0.66)
    .mul(smoothstep(3.4, 8.6, p.z.add(wob)))
    .mul(oneMinusN(smoothstep(22.4, 27.4, p.z.sub(wob))))
  const uneven = sn(vec3(p.x.mul(0.8), 2.3, p.z.mul(0.8))).mul(0.065)
    .add(sn(vec3(p.x.mul(2.4), 3.1, p.z.mul(2.4))).mul(0.022))
  const cut = vec3(p.x, p.y.sub(chan).add(uneven), p.z)
  const world: N = varying(planetize(modelWorldMatrix.mul(vec4(cut, 1)).xyz))
  mat.vertexNode = clipOf(world)

  const grain = sn(vec3(world.x.mul(38), 1.3, world.z.mul(38)))
  const lumps = sn(vec3(world.x.mul(5.5), 4.1, world.z.mul(5.5)))
  const mottle = sn(vec3(world.x.mul(0.55), 3.7, world.z.mul(0.55)))
  const edge = float(2.9).add(sn(vec3(world.z.mul(0.32), 7.0, 0)).mul(0.22))
  const via = oneMinusN(smoothstep(edge.sub(0.35), edge.add(0.35), abs(world.x)))
    .mul(smoothstep(-21.6, -19.4, world.z))
    .mul(oneMinusN(smoothstep(4.6, 6.4, world.z)))
  const rut = oneMinusN(smoothstep(0.08, 0.24, abs(abs(world.x.add(mottle.mul(0.1))).sub(1.35)))).mul(via)
  const height = grain.mul(0.001).add(lumps.mul(0.009)).sub(rut.mul(0.04))
  const n = reliefNormal(world, vec3(0, 1, 0), height)
  const alb = mix(hex3('#625E50'), hex3('#8C8270'), via.mul(0.7))
    .mul(float(0.79).add(mottle.mul(0.18)).add(grain.mul(0.05)).add(lumps.mul(0.065)))
    .mul(oneMinusN(rut.mul(0.27)))
  const fill = mix(vec3(0.11, 0.145, 0.19), vec3(0.022, 0.03, 0.045), uDeep)
  const key = hex3('#FFD4A0', 1.2).mul(max(dot(n, uDuskDir), 0)).mul(oneMinusN(uDeep)).mul(sampleCampShadow(world, shadow).mul(0.9).add(0.1))
  let col: N = alb.mul(fill.add(key)).mul(uFloor)
  col = col.add(firelight(world, n, 0.85, 0.65).mul(alb))
  // Damp wheel depressions carry cool sky at grazing angles.
  const eye = normalize(cameraPosition.sub(world))
  const wet = rut.mul(smoothstep(-0.08, 0.3, mottle))
  const fresnel = pow(oneMinusN(max(dot(eye, n), 0)), 5)
  col = col.add(mix(hex3('#80929E', 0.25), hex3('#1E2D46', 0.18), uDeep).mul(wet).mul(fresnel))
  // the far rim: a planet has no edge, it has a distance the light stops
  // reaching. The ground sinks into the dome's own value out there.
  const away = smoothstep(60.0, 150.0, length(world.xz))
  col = mix(col, mix(hex3('#101838', 0.5), hex3('#080C22', 0.42), uDeep), away)
  const distanceFog = oneMinusN(length(world.sub(cameraPosition)).mul(-0.012).exp()).mul(0.6)
  col = mix(col, mix(hex3('#65737D', 0.38), hex3('#111B33', 0.3), uDeep), distanceFog)
  mat.colorNode = shoulder(col).add(dither(0.0026)).mul(uReveal)
  return mat
}

// --------------------------------------------------------------- the water
function riverMaterial(): MeshBasicNodeMaterial {
  const mat = new MeshBasicNodeMaterial()
  const world: N = varying(planetize(modelWorldMatrix.mul(vec4(positionLocal, 1)).xyz))
  mat.vertexNode = clipOf(world)

  const flow = sn(vec3(world.x.mul(0.7).add(uT.mul(0.1)), world.z.mul(2.4), uT.mul(0.05))).mul(0.42).add(0.8)
  const ripple = sin(world.z.mul(18).add(sn(vec3(world.x.mul(0.7), world.z, uT.mul(0.09))).mul(4)).sub(uT.mul(0.65)))
    .mul(0.005).add(sn(vec3(world.x.mul(4).add(uT.mul(0.14)), world.z.mul(13), 1.7)).mul(0.007))
  const n = reliefNormal(world, vec3(0, 1, 0), ripple)
  const view = normalize(cameraPosition.sub(world))
  const fresnel = float(0.025).add(pow(oneMinusN(max(dot(view, n), 0)), 5).mul(0.975))
  const far = smoothstep(15.0, 7.4, world.z)
  const reflectedRay = reflect(view.negate(), n)
  const dawnBearing = pow(max(dot(normalize(reflectedRay.xz), normalize(uDuskDir.xz)), 0), 6)
  const reflectedDawn = mix(hex3('#718495', 0.46), hex3('#BB9672', 0.52), dawnBearing.mul(smoothstep(0.45, 0.02, reflectedRay.y)))
  const reflected = mix(reflectedDawn, hex3('#233550', 0.36), uDeep)
  let col: N = mix(mix(hex3('#1C292D', 0.42), hex3('#101827', 0.36), uDeep), reflected, fresnel)
  const half = normalize(view.add(uDuskDir))
  const sun = pow(max(dot(n, half), 0), 120).mul(oneMinusN(uDeep))
  col = col.add(hex3('#F8C48C', 1.3).mul(sun))
  // firelight on water: a vertical smear, wide in z, narrow in x — the
  // same three arrays every other lit surface reads
  for (let i = 0; i < FIRES.length; i++) {
    const posU = firePosU[i]
    const colU = fireColU[i]
    const radU = fireRadU[i]
    if (!posU || !colU || !radU) continue
    const d = posU.sub(world)
    const lat = abs(d.x).mul(float(1.5).sub(flow.mul(0.9))).negate().exp()
    const lon = abs(d.z).mul(0.1).negate().exp()
    const up = float(1).div(dot(d, d).mul(0.06).add(1))
    col = col.add(colU.mul(radU).mul(lat).mul(lon).mul(up).mul(0.055).mul(flow))
  }

  // THE CURRENT: the one thing on this planet that moves on its own. Long
  // streaks drawn along the drift, catching whatever light is on the water,
  // so the Danube reads as a river and not as a dark floor
  const lane = sn(vec3(world.x.mul(0.9), world.z.mul(0.24).add(uT.mul(0.09)), 2.4))
  const streak = smoothstep(0.55, 0.95, abs(lane)).mul(smoothstep(26.0, 6.0, world.z))
  col = col.add(mix(hex3('#2A3A66', 0.5), hex3('#7A4A22', 0.42), far).mul(streak).mul(0.5))

  // and at full night the field itself glitters on the surface
  const sp = fract(sin(dot(vec2(floor(world.x.mul(7.0)), floor(world.z.mul(3.0))), vec2(12.9898, 78.233))).mul(43758.5453))
  const glint = step(0.982, sp).mul(sin(uT.mul(2.6).add(sp.mul(40))).mul(0.5).add(0.5)).mul(uNight)
  col = col.add(vec3(0.42, 0.46, 0.55).mul(glint).mul(0.1).mul(flow))
  mat.colorNode = shoulder(col).add(dither(0.0022)).mul(uReveal)
  return mat
}

// ---------------------------------------------------------------- the mist
function mistMaterial(): MeshBasicNodeMaterial {
  const mat = new MeshBasicNodeMaterial()
  mat.transparent = true
  mat.depthWrite = false
  mat.side = DoubleSide
  const world: N = varying(planetize(modelWorldMatrix.mul(vec4(positionLocal, 1)).xyz))
  mat.vertexNode = clipOf(world)
  const t = uv()

  const band = sn(vec3(world.x.mul(0.035).add(uT.mul(0.006)), t.y.mul(2.2), 4.3)).mul(0.5).add(0.5)
  const body = pow(oneMinusN(t.y), 2.1).mul(smoothstep(0, 0.22, t.y)).mul(float(0.2).add(band.mul(0.8)))
  // you cannot see the mist you are standing in: a bank fades out as the
  // eye reaches it, or the far shore washes the whole foreground
  const near = smoothstep(6.0, 20.0, length(world.sub(cameraPosition)))
  const a = body.mul(near).mul(mix(float(0.22), float(0.25), uDeep)).mul(uReveal)
  // mist is lapis lit from below by the water, never white
  let col: N = mix(hex3('#89939D', 0.65), vec3(0.02, 0.026, 0.055), uDeep)
  col = col.add(vec3(0.06, 0.033, 0.015).mul(oneMinusN(uDeep)).mul(pow(oneMinusN(t.y), 3.0)))
  mat.colorNode = col.add(dither(0.0022))
  mat.opacityNode = min(a, 1)
  return mat
}
