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
  dot,
  float,
  fract,
  length,
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
import {
  dither,
  fbm3,
  fireRadU,
  FIRES,
  firePosU,
  planetize,
  sn,
  uDeep,
  uGust,
  uReveal,
  uT,
} from './hour'

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
      iSeed[k * 4] = 0.16 + rand() * 0.15
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
  const sway = float(0.025).add(pe.mul(0.14))
  const w = vec3(
    orig.x
      .add(seed.z.mul(float(0.4).add(pe)))
      .add(sin(uT.mul(0.7).add(seed.y.mul(6.0))).mul(sway))
      .add(uGust.mul(pe).mul(pe).mul(0.6)),
    orig.y.add(float(0.24).add(pe.mul(3.1).mul(uRise))),
    orig.z.add(seed.w.mul(float(0.4).add(pe))).add(cos(uT.mul(0.6).add(seed.y.mul(5.0))).mul(sway).mul(0.6))
  )
  // ember -> gold -> starlight (linear constants: craft law 1)
  let col: N = vec3(0.3, 0.075, 0.012)
  col = mix(col, vec3(0.72, 0.42, 0.13), clamp(pe.sub(0.16).div(0.3), 0, 1))
  col = mix(col, vec3(0.86, 0.83, 0.74), clamp(pe.sub(0.5).div(0.42), 0, 1))
  const fadeIn = min(p.div(0.06), 1)
  const letGo = smoothstep(1.0, 0.86, pe)
  const alpha = uReveal.mul(fadeIn).mul(float(0.3).add(pow(oneMinus(pe), 0.7).mul(0.7))).mul(letGo)
  const sizePx = float(2.8).sub(pe.mul(1.2))
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
  // Phase, height, form (grass / reed / trodden straw), and width share
  // one field. The riverbank earns detail without another draw.
  const iSeed = new Float32Array(count * 4)
  const reeds = Math.floor(count * 0.28)
  const straw = Math.floor(count * 0.18)
  let made = 0
  let guard = 0
  while (made < count && guard++ < count * 40) {
    let x: number, z: number, h: number, form: number, width: number
    if (made < reeds) {
      // Small loose clumps on both banks; the crossing remains clear.
      const side = made % 2 ? -1 : 1
      const cluster = Math.floor(made / 2) % 5
      x = side * (3.4 + cluster * 3.4 + (rand() - 0.5) * 1.15)
      z = made % 4 < 2 ? 25.3 + rand() * 1.5 : 6.0 + rand() * 1.15
      h = 0.65 + rand() * 0.7
      form = 1
      width = 0.25
    } else if (made < reeds + straw) {
      // The boots have spared only the edge of the approach, short dry
      // blades between the kerb and the tent frontage, never a lawn.
      x = (made % 2 ? -1 : 1) * (2.45 + rand() * 0.95)
      z = 1.5 - rand() * 7.0
      h = 0.09 + rand() * 0.13
      form = 2
      width = 0.7
    } else {
      const a = rand() * Math.PI * 2
      const r = 15 + Math.pow(rand(), 0.6) * 46
      x = Math.cos(a) * r
      z = Math.sin(a) * r
      if (Math.abs(x) < 15 && z < 6 && z > -33) continue
      if (z > 6.6 && z < 24.4) continue
      h = 0.35 + rand() * 0.55
      form = 0
      width = 0.55
    }
    iPos[made * 3] = x
    iPos[made * 3 + 1] = 0.04
    iPos[made * 3 + 2] = z
    iSeed[made * 4] = rand()
    iSeed[made * 4 + 1] = h
    iSeed[made * 4 + 2] = form
    iSeed[made * 4 + 3] = width
    made++
  }
  const geo = quadGeo(made)
  geo.setAttribute('iPos', new InstancedBufferAttribute(iPos.slice(0, made * 3), 3))
  geo.setAttribute('iSeed', new InstancedBufferAttribute(iSeed.slice(0, made * 4), 4))

  const mat = new MeshBasicNodeMaterial()
  mat.transparent = true
  mat.depthWrite = false
  mat.blending = NormalBlending

  const pos = attribute('iPos', 'vec3')
  const seed = attribute('iSeed', 'vec4')
  // The same channel cut as the earth: roots follow the bank instead of
  // hovering over the water where the curved ground falls away.
  const wob = sn(vec3(pos.x.mul(0.055), 0, 3.1)).mul(1.5)
  const channel = float(0.66).mul(smoothstep(3.4, 8.6, pos.z.add(wob)))
    .mul(oneMinus(smoothstep(22.4, 27.4, pos.z.sub(wob))))
  const base = planetize(vec3(pos.x, pos.y.sub(channel), pos.z))
  const h = seed.y
  // a vertical billboard: it turns to face the eye, it never tips
  const toEye = vec3(cameraPosition.x.sub(base.x), 0, cameraPosition.z.sub(base.z))
  const right = normalize(vec3(toEye.z.negate().add(0.00001), 0, toEye.x.add(0.00001)))
  const up01 = positionLocal.y.mul(0.5).add(0.5)
  const lean = uGust.mul(0.15).add(sin(uT.mul(0.7).add(seed.x.mul(20.0))).mul(0.025))
    .mul(up01).mul(up01)
  const w = base
    .add(right.mul(positionLocal.x.mul(h).mul(seed.w).add(lean.mul(h))))
    .add(vec3(0, up01.mul(h), 0))
  mat.vertexNode = cameraProjectionMatrix.mul(cameraViewMatrix).mul(vec4(w, 1))

  const vUv: N = varying(positionLocal.xy)
  const vSeed: N = varying(seed.x)
  const vForm: N = varying(seed.z)
  const reed = smoothstep(0.5, 0.9, vForm).mul(oneMinus(smoothstep(1.1, 1.5, vForm)))
  const dry = smoothstep(1.5, 2, vForm)
  const y = vUv.y.mul(0.5).add(0.5)
  let a: N = float(0)
  let reedA: N = float(0)
  for (let i = 0; i < 3; i++) {
    const jitter = fract(sin(vSeed.mul(13.0).add(i)).mul(43758.5453)).sub(0.5).mul(0.3)
    const o = float((i - 1) * 0.42).add(jitter)
    const cx = o.add(o.mul(1.5).mul(y).mul(y))
    const wide = mix(float(0.16), float(0.02), y)
    a = max(a, smoothstep(wide, 0, abs(vUv.x.sub(cx))).mul(oneMinus(smoothstep(0.65, 1.0, y))))
    // Slender stems with unequal seed heads, not broad upright leaves.
    const top = float(0.79 + i * 0.065).add(jitter.mul(0.1))
    const stemX = o.mul(0.9).add(o.mul(y).mul(y).mul(0.2))
    const stem = smoothstep(0.032, 0.008, abs(vUv.x.sub(stemX)))
      .mul(oneMinus(smoothstep(top.sub(0.015), top, y)))
    const head = smoothstep(1, 0.45, length(vec2(vUv.x.sub(stemX).div(0.065), y.sub(top.sub(0.075)).div(0.082))))
    reedA = max(reedA, max(stem, head))
  }
  const dryColour = mix(vec3(0.045, 0.04, 0.029), vec3(0.078, 0.06, 0.037), max(reed, dry))
  mat.colorNode = mix(dryColour, vec3(0.008, 0.009, 0.013), uDeep)
  mat.opacityNode = min(mix(a, reedA, reed).mul(0.85).mul(uReveal), 1)

  const mesh = new Mesh(geo, mat)
  mesh.frustumCulled = false
  mesh.renderOrder = 8
  return { mesh }
}

// -------------------------------------------------------------- the motes
/* THE AIR ITSELF. A night camp is not a vacuum: chaff off the thatch, ash,
   river damp, the dust four hundred men raise walking. It is invisible
   until a fire finds it, which is exactly the point — the motes are how
   you SEE that the fires throw light through air, and they are what makes
   the ground between the tents feel occupied rather than empty. */
export function createMotes(opts: { count: number; rand(): number }): Sparks {
  const { count, rand } = opts
  const iPos = new Float32Array(count * 3)
  const iSeed = new Float32Array(count * 4)
  for (let i = 0; i < count; i++) {
    // gathered along the walk, where the eye actually travels
    const z = 16 - Math.pow(rand(), 0.75) * 42
    iPos[i * 3] = (rand() - 0.5) * 22
    iPos[i * 3 + 1] = 0.15 + Math.pow(rand(), 1.6) * 3.4
    iPos[i * 3 + 2] = z
    iSeed[i * 4] = 0.04 + rand() * 0.07
    iSeed[i * 4 + 1] = rand() * 6.28
    iSeed[i * 4 + 2] = 0.5 + rand() * 1.4
    iSeed[i * 4 + 3] = rand()
  }
  const geo = quadGeo(count)
  geo.setAttribute('iPos', new InstancedBufferAttribute(iPos, 3))
  geo.setAttribute('iSeed', new InstancedBufferAttribute(iSeed, 4))

  const uPx = uniform(0.001)
  const mat = new MeshBasicNodeMaterial()
  mat.transparent = true
  mat.depthWrite = false
  mat.blending = AdditiveBlending

  const pos = attribute('iPos', 'vec3')
  const seed = attribute('iSeed', 'vec4')
  // a mote does not fall and it does not fly: it wanders, and the gust
  // carries it a little way downwind
  const t = uT.mul(seed.x).add(seed.y)
  const w = vec3(
    pos.x.add(sin(t).mul(0.9)).add(uGust.mul(1.6)),
    pos.y.add(sin(t.mul(0.61).add(1.7)).mul(0.32)),
    pos.z.add(cos(t.mul(0.83)).mul(0.7))
  )
  // it is invisible until a fire finds it: one cheap warm term over the
  // same eight lights every surface reads
  let warm: N = float(0)
  for (let i = 0; i < FIRES.length; i++) {
    const posU = firePosU[i]
    const radU = fireRadU[i]
    if (!posU || !radU) continue
    const d = posU.sub(w)
    warm = warm.add(radU.div(dot(d, d).mul(1.6).add(2.2)))
  }
  const lit = min(warm, 1.6)
  const twinkle = sin(uT.mul(seed.z.mul(1.7)).add(seed.w.mul(24))).mul(0.3).add(0.7)
  const alpha = lit.mul(0.16).mul(twinkle).mul(uReveal)
  const size = float(1.05).add(seed.w.mul(1.1))
  const mv = cameraViewMatrix.mul(vec4(w, 1))
  const px = size.mul(uPx).mul(max(mv.z.negate(), 1))
  mat.vertexNode = cameraProjectionMatrix.mul(
    vec4(mv.x.add(positionLocal.x.mul(px)), mv.y.add(positionLocal.y.mul(px)), mv.z, mv.w)
  )
  const vUv: N = varying(positionLocal.xy)
  const vA: N = varying(alpha)
  const d2 = vUv.length()
  mat.colorNode = vec3(0.62, 0.44, 0.22)
  mat.opacityNode = min(smoothstep(1.0, 0.0, d2).mul(vA), 1)

  const mesh = new Mesh(geo, mat)
  mesh.frustumCulled = false
  mesh.renderOrder = 21
  return {
    mesh,
    setLens(fovDeg, height) {
      uPx.value = Math.tan((fovDeg * Math.PI) / 360) / Math.max(200, height)
    },
  }
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
  // A BREATH IS A NEAR THING. Warm air disperses in a metre or two, and
  // from the overlook these puffs were reading as pale discs floating over
  // the tents. It exists where you could hear the man breathing.
  const vNear: N = varying(smoothstep(22.0, 7.0, length(cameraPosition.sub(w))))
  const d = vUv.length()
  const a = smoothstep(1.0, 0.15, d)
    .mul(uReveal)
    .mul(vNear)
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
