/* THE DRIFTING THINGS — four instanced-quad organs, one draw call each.
   No Points anywhere: three ignores sizeNode on Points, and a sized field
   has to ride the instanced-sprite path (forge lesson 13).

   · THE SPARK LADDER (donor d): born fast, decelerating, cooling ember →
     gold → starlight, holding their light almost to the firmament and then
     letting go. Where the ascent ends, the picture hands them to the stars.
   · THE SMOKE: normal-blended columns that SWALLOW stars, warm only in the
     lowest metres where the fire still reaches them. Additive smoke would
     be glowing smoke, which is a lie at night.
   · THE GRASS: wind-bent tufts outside the palisade, three blades carved
     per quad in the fragment, leaning on the shared gust.
   · THE BREATH: it is a Danube dusk, and the sentries breathe. */

import {
  Float32BufferAttribute,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  MeshBasicNodeMaterial,
  NormalBlending,
  AdditiveBlending,
  Vector3,
} from 'three/webgpu'
import {
  abs,
  attribute,
  cameraPosition,
  cameraProjectionMatrix,
  cameraViewMatrix,
  clamp,
  cos,
  float,
  fract,
  max,
  min,
  mix,
  type N,
  normalize,
  oneMinus,
  positionLocal,
  pow,
  sin,
  smoothstep,
  uniform,
  varying,
  vec2,
  vec3,
  vec4,
} from './tsl'
import { dither, fbm3, planetize, uDeep, uGust, uReveal, uT } from './hour'

function quadGeo(n: number): InstancedBufferGeometry {
  const g = new InstancedBufferGeometry()
  g.setAttribute(
    'position',
    new Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3)
  )
  g.setIndex([0, 1, 2, 0, 2, 3])
  g.instanceCount = n
  return g
}

/** a view-space billboard: the quad turns to the eye and never tips */
function billboard(world: N, dx: N, dy: N): N {
  const mv = cameraViewMatrix.mul(vec4(world, 1))
  return cameraProjectionMatrix.mul(vec4(mv.x.add(dx), mv.y.add(dy), mv.z, mv.w))
}

export interface Drift {
  mesh: Mesh
}

export interface Sparks extends Drift {
  setLens(fovDeg: number, height: number): void
}

// ------------------------------------------------------------ the sparks
export function createSparks(opts: {
  origins: Vector3[]
  perFire: number
  rand(): number
  reduced: boolean
}): Sparks {
  const { origins, perFire, rand } = opts
  const n = origins.length * perFire
  const iOrig = new Float32Array(n * 3)
  const iSeed = new Float32Array(n * 4)
  let k = 0
  for (const o of origins) {
    for (let j = 0; j < perFire; j++) {
      iOrig[k * 3] = o.x
      iOrig[k * 3 + 1] = o.y
      iOrig[k * 3 + 2] = o.z
      iSeed[k * 4] = 0.42 + rand() * 0.4
      iSeed[k * 4 + 1] = rand() * 3
      iSeed[k * 4 + 2] = (rand() - 0.5) * 0.5
      iSeed[k * 4 + 3] = (rand() - 0.5) * 0.5
      k++
    }
  }
  const geo = quadGeo(n)
  geo.setAttribute('iOrig', new InstancedBufferAttribute(iOrig, 3))
  geo.setAttribute('iSeed', new InstancedBufferAttribute(iSeed, 4))

  const uPx = uniform(0.001)
  const uRise = uniform(opts.reduced ? 0.35 : 1)

  const mat = new MeshBasicNodeMaterial()
  mat.transparent = true
  mat.depthWrite = false
  mat.blending = AdditiveBlending

  const orig = attribute('iOrig', 'vec3')
  const seed = attribute('iSeed', 'vec4')
  const p = fract(uT.mul(seed.x).add(seed.y))
  // donor d: fast birth, still heights. Gold moves, white holds.
  const pe = oneMinus(pow(oneMinus(p), 1.8))
  const sway = float(0.05).add(pe.mul(0.34))
  const w = vec3(
    orig.x
      .add(seed.z.mul(float(0.4).add(pe)))
      .add(sin(uT.mul(1.7).add(seed.y.mul(6.0))).mul(sway))
      .add(uGust.mul(pe).mul(pe).mul(1.3)),
    orig.y.add(float(0.24).add(pe.mul(3.1).mul(uRise))),
    orig.z.add(seed.w.mul(float(0.4).add(pe))).add(cos(uT.mul(1.4).add(seed.y.mul(5.0))).mul(sway).mul(0.6))
  )
  // ember -> gold -> starlight (linear constants: craft law 1)
  let col: N = vec3(0.3, 0.075, 0.012)
  col = mix(col, vec3(0.72, 0.42, 0.13), clamp(pe.sub(0.16).div(0.3), 0, 1))
  col = mix(col, vec3(0.86, 0.83, 0.74), clamp(pe.sub(0.5).div(0.42), 0, 1))
  const fadeIn = min(p.div(0.06), 1)
  const letGo = smoothstep(1.0, 0.86, pe)
  const alpha = uReveal.mul(fadeIn).mul(float(0.3).add(pow(oneMinus(pe), 0.7).mul(0.7))).mul(letGo)
  const sizePx = float(7.2).sub(pe.mul(2.6))
  const mv = cameraViewMatrix.mul(vec4(w, 1))
  const px = sizePx.mul(uPx).mul(max(mv.z.negate(), 1))
  mat.vertexNode = cameraProjectionMatrix.mul(
    vec4(mv.x.add(positionLocal.x.mul(px)), mv.y.add(positionLocal.y.mul(px)), mv.z, mv.w)
  )
  const vUv: N = varying(positionLocal.xy)
  const vCol: N = varying(col)
  const vA: N = varying(alpha)
  const d = vUv.length()
  const a = smoothstep(1.0, 0.1, d).add(smoothstep(1.0, 0.55, d).mul(0.35)).mul(vA)
  mat.colorNode = vCol
  mat.opacityNode = min(a, 1)

  const mesh = new Mesh(geo, mat)
  mesh.frustumCulled = false
  mesh.renderOrder = 22
  return {
    mesh,
    setLens(fovDeg, height) {
      uPx.value = Math.tan((fovDeg * Math.PI) / 360) / Math.max(200, height)
    },
  }
}

// ------------------------------------------------------------- the smoke
export function createSmoke(opts: {
  origins: Array<{ p: Vector3; scale: number; rate: number }>
  perFire: number
  rand(): number
  reduced: boolean
}): Drift {
  const { origins, perFire, rand } = opts
  const n = origins.length * perFire
  const iOrig = new Float32Array(n * 3)
  const iSeed = new Float32Array(n * 4)
  let k = 0
  for (const o of origins) {
    for (let j = 0; j < perFire; j++) {
      iOrig[k * 3] = o.p.x
      iOrig[k * 3 + 1] = o.p.y
      iOrig[k * 3 + 2] = o.p.z
      iSeed[k * 4] = (0.055 + rand() * 0.03) * o.rate
      iSeed[k * 4 + 1] = rand()
      iSeed[k * 4 + 2] = (rand() - 0.5) * 2
      iSeed[k * 4 + 3] = o.scale * (0.8 + rand() * 0.6)
      k++
    }
  }
  const geo = quadGeo(n)
  geo.setAttribute('iOrig', new InstancedBufferAttribute(iOrig, 3))
  geo.setAttribute('iSeed', new InstancedBufferAttribute(iSeed, 4))

  const uRise = uniform(opts.reduced ? 0.5 : 1)
  const mat = new MeshBasicNodeMaterial()
  mat.transparent = true
  mat.depthWrite = false
  mat.blending = NormalBlending

  const orig = attribute('iOrig', 'vec3')
  const seed = attribute('iSeed', 'vec4')
  const p = fract(uT.mul(seed.x).add(seed.y))
  const rise = pow(p, 0.85)
  // the column shears with the wind as it climbs
  const w = vec3(
    orig.x
      .add(seed.z.mul(rise).mul(1.5))
      .add(uGust.mul(rise).mul(rise).mul(3.4))
      .add(sin(uT.mul(0.4).add(seed.y.mul(9.0))).mul(rise).mul(0.7)),
    orig.y.add(rise.mul(7.4).mul(uRise)),
    orig.z.add(seed.z.mul(rise).mul(0.8)).add(cos(uT.mul(0.33).add(seed.y.mul(7.0))).mul(rise).mul(0.6))
  )
  const size = seed.w.mul(float(0.55).add(rise.mul(2.5)))
  mat.vertexNode = billboard(w, positionLocal.x.mul(size), positionLocal.y.mul(size))

  const vUv: N = varying(positionLocal.xy)
  const vP: N = varying(p)
  const vSeed: N = varying(seed.y)
  const d = vUv.length()
  const body = smoothstep(1.0, 0.05, d)
  const curl = fbm3(vec3(vUv.x.mul(1.6), vUv.y.mul(1.6), vSeed.mul(11.0).add(uT.mul(0.08)))).mul(0.5).add(0.62)
  // smoke is DARKNESS at night: navy that eats the stars, lifted to warm
  // only in the first metres where the fire still finds it
  const cold = vec3(0.016, 0.021, 0.052)
  const warm = vec3(0.13, 0.062, 0.022)
  const a = body
    .mul(curl)
    .mul(uReveal)
    .mul(smoothstep(0.0, 0.1, vP))
    .mul(oneMinus(smoothstep(0.55, 1.0, vP)))
    .mul(mix(float(0.17), float(0.13), uDeep))
  mat.colorNode = mix(warm, cold, smoothstep(0.0, 0.22, vP)).add(dither(0.004))
  mat.opacityNode = min(a, 1)

  const mesh = new Mesh(geo, mat)
  mesh.frustumCulled = false
  mesh.renderOrder = 12
  return { mesh }
}

// ------------------------------------------------------------- the grass
export function createGrass(opts: { count: number; rand(): number }): Drift {
  const { count, rand } = opts
  const iPos = new Float32Array(count * 3)
  const iSeed = new Float32Array(count * 2)
  let made = 0
  let guard = 0
  while (made < count && guard++ < count * 40) {
    const a = rand() * Math.PI * 2
    const r = 15 + Math.pow(rand(), 0.6) * 46
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r
    // outside the palisade only, and never in the water
    if (Math.abs(x) < 15 && z < 6 && z > -33) continue
    if (z > 6.6 && z < 24.4) continue
    iPos[made * 3] = x
    iPos[made * 3 + 1] = 0
    iPos[made * 3 + 2] = z
    iSeed[made * 2] = rand()
    iSeed[made * 2 + 1] = 0.42 + rand() * 0.5
    made++
  }
  const geo = quadGeo(made)
  geo.setAttribute('iPos', new InstancedBufferAttribute(iPos.slice(0, made * 3), 3))
  geo.setAttribute('iSeed', new InstancedBufferAttribute(iSeed.slice(0, made * 2), 2))

  const mat = new MeshBasicNodeMaterial()
  mat.transparent = true
  mat.depthWrite = false
  mat.blending = NormalBlending

  const pos = attribute('iPos', 'vec3')
  const seed = attribute('iSeed', 'vec2')
  const base = planetize(pos)
  const h = seed.y
  // a vertical billboard: it turns to face the eye, it never tips
  const toEye = vec3(cameraPosition.x.sub(base.x), 0, cameraPosition.z.sub(base.z))
  const right = normalize(vec3(toEye.z.negate(), 0, toEye.x))
  const up01 = positionLocal.y.mul(0.5).add(0.5)
  const lean = uGust.mul(0.5).add(sin(uT.mul(1.1).add(seed.x.mul(20.0))).mul(0.06)).mul(up01)
  const w = base
    .add(right.mul(positionLocal.x.mul(h).mul(0.55).add(lean.mul(h))))
    .add(vec3(0, up01.mul(h).mul(1.6), 0))
  mat.vertexNode = cameraProjectionMatrix.mul(cameraViewMatrix).mul(vec4(w, 1))

  const vUv: N = varying(positionLocal.xy)
  const vSeed: N = varying(seed.x)
  const y = vUv.y.mul(0.5).add(0.5)
  let a: N = float(0)
  for (let i = 0; i < 3; i++) {
    const jitter = fract(sin(vSeed.mul(13.0).add(i)).mul(43758.5453)).sub(0.5).mul(0.3)
    const o = float((i - 1) * 0.42).add(jitter)
    const cx = o.add(o.mul(1.5).mul(y).mul(y))
    const wide = mix(float(0.16), float(0.02), y)
    a = max(a, smoothstep(wide, 0, abs(vUv.x.sub(cx))).mul(oneMinus(smoothstep(0.65, 1.0, y))))
  }
  mat.colorNode = mix(vec3(0.034, 0.034, 0.03), vec3(0.008, 0.009, 0.013), uDeep)
  mat.opacityNode = min(a.mul(0.85).mul(uReveal), 1)

  const mesh = new Mesh(geo, mat)
  mesh.frustumCulled = false
  mesh.renderOrder = 8
  return { mesh }
}

// ------------------------------------------------------------ the breath
export function createBreath(opts: {
  anchors: Array<{ p: Vector3; dir: number }>
  rand(): number
}): Drift {
  const { anchors, rand } = opts
  const n = anchors.length
  const iPos = new Float32Array(n * 3)
  const iSeed = new Float32Array(n * 2)
  anchors.forEach((a, k) => {
    iPos[k * 3] = a.p.x
    iPos[k * 3 + 1] = a.p.y
    iPos[k * 3 + 2] = a.p.z
    iSeed[k * 2] = rand()
    iSeed[k * 2 + 1] = a.dir
  })
  const geo = quadGeo(n)
  geo.setAttribute('iPos', new InstancedBufferAttribute(iPos, 3))
  geo.setAttribute('iSeed', new InstancedBufferAttribute(iSeed, 2))

  const mat = new MeshBasicNodeMaterial()
  mat.transparent = true
  mat.depthWrite = false
  mat.blending = NormalBlending

  const pos = attribute('iPos', 'vec3')
  const seed = attribute('iSeed', 'vec2')
  const p = fract(uT.mul(0.17).add(seed.x))
  const w = vec3(pos.x, pos.y.add(p.mul(0.42)), pos.z.add(seed.y.mul(p).mul(1.5)))
  const size = float(0.1).add(p.mul(0.46))
  mat.vertexNode = billboard(w, positionLocal.x.mul(size), positionLocal.y.mul(size))

  const vUv: N = varying(positionLocal.xy)
  const vP: N = varying(p)
  const d = vUv.length()
  const a = smoothstep(1.0, 0.15, d)
    .mul(uReveal)
    .mul(smoothstep(0.0, 0.06, vP))
    .mul(oneMinus(smoothstep(0.16, 0.55, vP)))
    .mul(0.5)
  mat.colorNode = vec3(0.36, 0.4, 0.46)
  mat.opacityNode = min(a, 1)

  const mesh = new Mesh(geo, mat)
  mesh.frustumCulled = false
  mesh.renderOrder = 14
  return { mesh }
}
