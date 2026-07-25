/* THE FIRES — and their bodies. A fire needs a vessel (craft law): a
   brazier on a plinth in the shallows, four logs crossed at the same lean,
   a torch cage, a watch pan, a clay lamp.

   THE FLAME itself is donor E's field equation, the most alive of the five
   the fire tournament produced, and the one the champion agora already
   burns. THE TRUE MIRRORED TWIN is the same material hung below the water
   with y flipped, dimmed and smeared: not a blur of a screenshot, the same
   fire burning downward. */

import {
  AdditiveBlending,
  BoxGeometry,
  CanvasTexture,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicNodeMaterial,
  PlaneGeometry,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
  Vector3,
} from 'three/webgpu'
import {
  abs,
  clamp,
  float,
  max,
  mix,
  type N,
  oneMinus,
  pow,
  smoothstep,
  uniform,
  uv,
  vec3,
} from './tsl'
import {
  dither,
  fbm3,
  field,
  type FieldItem,
  MAP,
  place,
  sn,
  uFlick,
  uGust,
  uReveal,
  uT,
  uYield,
} from './hour'
import { palette } from './materials'

const mp = (x: number, y: number, z: number): Vector3 => new Vector3(x, y, z)

export interface Flame {
  mesh: Mesh
  twin: Mesh | null
  update(t: number, pos: Vector3, camPos: Vector3, mirrorY?: number): void
}

interface FlameOptions {
  w?: number
  h?: number
  lean?: number
  dim?: number
  /** the water line this flame is mirrored in (omit: no twin) */
  mirrorY?: number
}

function flameMaterial(dim: N, smear: N, lean: number, tint: [number, number, number]): MeshBasicNodeMaterial {
  const mat = new MeshBasicNodeMaterial()
  mat.transparent = true
  mat.depthWrite = false
  mat.blending = AdditiveBlending
  const p = uv()
  const y = clamp(p.y, 0, 1)
  const x = p.x.sub(0.5).mul(smear)
  // the sway: the whole column leans and drifts, the wind adds its lean
  const swayA = sn(vec3(y.mul(2.2).sub(uT.mul(1.3)), uT.mul(0.3), 3.1))
  const xx = x.add(swayA.mul(y.mul(0.16))).add(uGust.mul(lean).mul(y).mul(y).mul(0.42))
  const radius = mix(float(0.34), float(0.05), pow(y, 0.7))
  const d = abs(xx).div(radius)
  // the carve: fractal noise tears the tips off the cone
  const turb = fbm3(vec3(xx.mul(6.2).add(1.0), y.mul(3.0).sub(uT.mul(2.1)), uT.mul(0.14).add(5.3))).mul(1.42)
  const fieldV = float(1).sub(d.mul(d)).add(turb.mul(0.5)).sub(y.mul(0.78))
  const flame = float(0.8).add(uFlick.mul(0.2))
  const alpha = smoothstep(0.18, 0.5, fieldV)
    .mul(smoothstep(0.0, 0.07, y))
    .mul(oneMinus(smoothstep(0.78, 0.97, y)))
    .mul(flame)
  const heat = smoothstep(0.55, 1.25, fieldV.add(oneMinus(y).mul(0.5)).sub(abs(xx).mul(1.6)))
  const body = mix(vec3(0.55, 0.11, 0.014), vec3(1.0, 0.6, 0.18), smoothstep(0.0, 0.85, fieldV))
  const col = mix(body, vec3(1.02, 0.93, 0.78), heat).add(dither(0.006))
  mat.colorNode = col.mul(vec3(tint[0], tint[1], tint[2]))
  mat.opacityNode = alpha.mul(dim).mul(uReveal)
  return mat
}

export function createFlame(opts: FlameOptions = {}): Flame {
  const w = opts.w ?? 0.54
  const h = opts.h ?? 0.78
  const lean = opts.lean ?? 1
  const dimK = opts.dim ?? 1

  const uDim = uniform(dimK)
  const mesh = new Mesh(new PlaneGeometry(1, 1), flameMaterial(uDim, float(1), lean, [1, 1, 1]))
  mesh.scale.set(w, h, 1)
  mesh.renderOrder = 20
  mesh.frustumCulled = false

  let twin: Mesh | null = null
  let uTwinDim: N = null
  if (opts.mirrorY !== undefined) {
    uTwinDim = uniform(dimK * 0.34)
    // water eats the blue out of a reflection long before the gold
    const twinMat = flameMaterial(uTwinDim, float(0.72), lean * 1.6, [1.0, 0.6, 0.32])
    twinMat.depthTest = false
    twin = new Mesh(new PlaneGeometry(1, 1), twinMat)
    twin.scale.set(w * 1.18, -h * 1.35, 1)
    twin.renderOrder = 19
    twin.frustumCulled = false
  }

  return {
    mesh,
    twin,
    update(t, pos, camPos, mirrorY) {
      const breathe = 1 + 0.05 * Math.sin(t * 2.3 + pos.x)
      const gust = 1 - uGust.value * 0.16
      mesh.scale.set(w * gust, h * breathe, 1)
      mesh.position.set(pos.x, pos.y + (h * breathe) / 2, pos.z)
      const yaw = Math.atan2(camPos.x - pos.x, camPos.z - pos.z)
      mesh.rotation.y = yaw
      if (twin && uTwinDim && mirrorY !== undefined) {
        const smear = 1 + 0.22 * Math.sin(t * 1.6)
        const th = h * 1.35 * breathe * smear
        twin.scale.set(w * 1.18 * gust, -th, 1)
        // the twin's crown hangs from the mirrored BASE, not the mirrored
        // centre: a reflection starts where the fire starts
        twin.position.set(pos.x, 2 * mirrorY - pos.y - th / 2, pos.z)
        twin.rotation.y = yaw
        uTwinDim.value = dimK * (0.3 + 0.08 * Math.sin(t * 3.1))
      }
    },
  }
}

// ------------------------------------------------------------- the glows
/* Craft law: generosity kills night. Only a few soft pools exist — the
   brazier on the water, the campfire on the earth, the wedge of gold the
   praetorium throws down the via, and its smoke vent seen from behind. */
function glowTexture(rand: () => number, stops: Array<[number, string]>): CanvasTexture {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2d context unavailable')
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  for (const [at, color] of stops) g.addColorStop(at, color)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const img = ctx.getImageData(0, 0, size, size)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const n = (rand() - 0.5) * 5
    d[i] = Math.max(0, Math.min(255, (d[i] ?? 0) + n))
    d[i + 1] = Math.max(0, Math.min(255, (d[i + 1] ?? 0) + n))
    d[i + 2] = Math.max(0, Math.min(255, (d[i + 2] ?? 0) + n))
  }
  ctx.putImageData(img, 0, 0)
  return new CanvasTexture(canvas)
}

export interface Fires {
  group: Group
  /** the three world marks a trace can be opened from */
  tracePos: Vector3[]
  setLens(fov: number, height: number): void
  update(t: number, camPos: Vector3, reveal: number): void
}

export function createFires(rand: () => number): Fires {
  const P = palette()
  const group = new Group()
  const add = <T extends Mesh | Group | Sprite>(m: T): T => {
    group.add(m)
    return m
  }
  const flames: Array<{ f: Flame; pos: Vector3; mirrorY?: number }> = []
  const T = MAP.praetorium
  const D = MAP.desk

  // ------------------------- the ford brazier, twinned in the Danube
  {
    const bowl = new Mesh(new CylinderGeometry(0.3, 0.2, 0.24, 12, 1, true), P.bronze)
    bowl.position.copy(mp(2.85, 0.16, 12.6))
    add(bowl)
    const rim = new Mesh(new TorusGeometry(0.3, 0.028, 6, 16), P.bronze)
    rim.rotation.x = Math.PI / 2
    rim.position.copy(mp(2.85, 0.28, 12.6))
    add(rim)
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.4
      const leg = new Mesh(new CylinderGeometry(0.022, 0.03, 0.62, 5), P.bronze)
      leg.position.copy(mp(2.85 + Math.cos(a) * 0.16, -0.06, 12.6 + Math.sin(a) * 0.16))
      leg.rotation.z = -Math.cos(a) * 0.24
      leg.rotation.x = Math.sin(a) * 0.24
      add(leg)
    }
    const coals = new Mesh(new SphereGeometry(0.22, 10, 6), P.coal)
    coals.scale.y = 0.42
    coals.position.copy(mp(2.85, 0.24, 12.6))
    add(coals)
    const f = createFlame({ w: 0.66, h: 0.98, mirrorY: 0, lean: 1 })
    add(f.mesh)
    if (f.twin) add(f.twin)
    flames.push({ f, pos: place(2.85, 0.24, 12.6), mirrorY: place(2.85, MAP.river.y, 12.6).y })
  }

  // ----------------------------------------- the crossed-log campfire
  {
    const C: [number, number, number] = [-3.4, 0, -11.2]
    const logGeo = new CylinderGeometry(0.055, 0.065, 1.15, 7)
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.35
      const log = new Mesh(logGeo, P.log)
      log.position.copy(mp(C[0] + Math.cos(a) * 0.2, 0.24, C[2] + Math.sin(a) * 0.18))
      log.rotation.z = Math.cos(a) * 1.02
      log.rotation.x = -Math.sin(a) * 1.02
      add(log)
    }
    const stones: FieldItem[] = []
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.2
      stones.push({
        p: [C[0] + Math.cos(a) * 0.56, 0.045, C[2] + Math.sin(a) * 0.5],
        s: [1, 0.7 + rand() * 0.6, 1],
        r: rand() * 3,
        tint: 0.9 + rand() * 0.2,
      })
    }
    add(field(new BoxGeometry(0.15, 0.1, 0.12), P.hearthStone, stones))
    const coals = new Mesh(new SphereGeometry(0.26, 10, 6), P.coal)
    coals.scale.y = 0.3
    coals.position.copy(mp(C[0], 0.07, C[2]))
    add(coals)
    const f = createFlame({ w: 0.66, h: 0.72, lean: 1.2 })
    add(f.mesh)
    flames.push({ f, pos: place(C[0], 0.16, C[2]) })
    // two bedrolls and a cooking pot: someone lives at this fire
    for (const sx of [-1, 1]) {
      const roll = new Mesh(new CylinderGeometry(0.1, 0.1, 1.15, 8), P.bedroll)
      roll.rotation.z = Math.PI / 2
      roll.position.copy(mp(C[0] + sx * 1.35, 0.1, C[2] + sx * 0.62))
      roll.rotation.y = sx * 0.4
      add(roll)
    }
    const tripod = new Mesh(new ConeGeometry(0.42, 1.05, 3, 1, true), P.tripod)
    tripod.position.copy(mp(C[0], 0.52, C[2]))
    add(tripod)
    const pot = new Mesh(new SphereGeometry(0.13, 10, 8), P.pot)
    pot.scale.y = 0.8
    pot.position.copy(mp(C[0], 0.44, C[2]))
    add(pot)
  }

  // the gate torches
  for (const sx of [-1, 1]) {
    const x = sx * 2.35
    const shaft = new Mesh(new CylinderGeometry(0.035, 0.045, 2.0, 6), P.timber)
    shaft.position.copy(mp(x, 1.0, 4.5))
    add(shaft)
    const cage = new Mesh(new CylinderGeometry(0.1, 0.075, 0.2, 8, 1, true), P.bronze)
    cage.position.copy(mp(x, 2.05, 4.5))
    add(cage)
    const f = createFlame({ w: 0.34, h: 0.56, lean: 2.2 })
    add(f.mesh)
    flames.push({ f, pos: place(x, 2.05, 4.5) })
  }

  // the watch fires on the gate towers
  for (const sx of [-1, 1]) {
    const x = sx * 4.4
    const pan = new Mesh(new CylinderGeometry(0.24, 0.17, 0.16, 10, 1, true), P.bronze)
    pan.position.copy(mp(x, 4.78, 4.9))
    add(pan)
    const f = createFlame({ w: 0.34, h: 0.5, lean: 2.6 })
    add(f.mesh)
    flames.push({ f, pos: place(x, 4.82, 4.9) })
  }

  // the lamp flame inside the praetorium: the smallest flame in the world
  {
    const f = createFlame({ w: 0.075, h: 0.13, lean: 0.2 })
    add(f.mesh)
    flames.push({ f, pos: place(D.x - 0.52, 0.695, D.z + 0.02) })
  }

  // ------------------------------------------------------------ the pools
  const poolTex = glowTexture(rand, [
    [0, 'rgba(226,170,92,0.40)'],
    [0.42, 'rgba(170,116,48,0.12)'],
    [1, 'rgba(0,0,0,0)'],
  ])
  const pools: Array<{ mat: SpriteMaterial; k: number }> = []
  function pool(p: Vector3, sx: number, sy: number, k: number): void {
    const mat = new SpriteMaterial({
      map: poolTex,
      blending: AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0,
    })
    const s = new Sprite(mat)
    s.position.copy(p)
    s.scale.set(sx, sy, 1)
    s.renderOrder = 24
    add(s)
    pools.push({ mat, k })
  }
  pool(place(2.85, 0.06, 12.6), 3.6, 1.6, 1.15)
  pool(place(-3.4, 0.3, -11.2), 3.8, 1.4, 1.05)
  pool(place(0, 0.3, T.z + T.d / 2 + 1.6), 6.2, 3.4, 1.25)
  pool(place(0, 1.5, T.z + T.d / 2 - 0.4), 4.4, 3.2, 1.0)
  pool(place(-2.35, 2.0, 4.5), 1.5, 1.5, 0.55)
  pool(place(2.35, 2.0, 4.5), 1.5, 1.5, 0.55)
  // the praetorium's smoke vent: from the overlook behind the fort this is
  // the only warm thing at the centre, which is the Hearth law made visible
  // from a side the doorway cannot serve
  pool(place(T.x, T.h - 0.15, T.z), 2.1, 1.5, 0.95)

  // ------------------------------------------------------------ the marks
  const markTex = glowTexture(rand, [
    [0, 'rgba(255,240,200,1)'],
    [0.24, 'rgba(224,185,106,0.55)'],
    [1, 'rgba(0,0,0,0)'],
  ])
  const tracePos = [
    place(-1.42, 1.0, 12.4),
    place(3.32, 1.02, -5.22),
    place(D.x + 0.04, 0.695, D.z + 0.02),
  ]
  const marks = tracePos.map((p) => {
    const mat = new SpriteMaterial({
      map: markTex,
      blending: AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      transparent: true,
      opacity: 0,
    })
    const s = new Sprite(mat)
    s.position.copy(p)
    s.scale.set(0.15, 0.15, 1)
    s.renderOrder = 30
    add(s)
    return mat
  })

  return {
    group,
    tracePos,
    setLens() {
      /* the flames are world-sized; only the sparks care about the lens */
    },
    update(t, camPos, reveal) {
      for (const fl of flames) fl.f.update(t, fl.pos, camPos, fl.mirrorY)
      for (const p of pools) p.mat.opacity = reveal * (0.26 + 0.16 * uFlick.value) * p.k
      // the marks pulse like the sky's stars, and step back while a trace
      // holds the frame
      marks.forEach((m, i) => {
        m.opacity = reveal * (0.5 + 0.25 * Math.sin(t * 1.9 + i * 2)) * (1 - uYield.value * 0.85)
      })
    },
  }
}

