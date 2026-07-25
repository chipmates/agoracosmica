/* THE NIGHT AGORA — the marble, the pillars, one fire, and the night
   standing behind them.

   This is the room the whole night keeps returning to, so it is built as a
   PLACE and not as a backdrop: a cut floor with courses and joints and a
   path worn into it, columns with bases and entasis and twenty flutes each,
   a second row falling away behind the first, a far stoa holding the
   horizon, and the ground carrying on past all of it into haze. Everything
   that glows reads its light out of the one block of uniforms below, so the
   room breathes as one body instead of as forty loops.

   The laws this file is carved from:
   · night is a DEPTH — abyss ink overhead, lapis in the body, one low ember
   · gold only ever EMITS or REFLECTS, it is never a fill
   · darkness carves: one fire, and nothing may compete with it
   · every hand-picked colour is a hex through three's Color, which hands
     back the linear values the shaders actually want
   · no bodies, no faces: the seats around this fire are empty, and the one
     gap in the circle is where the visitor sits
   · sized fields ride instanced quads, never Points (three drops sizeNode)
   · the seated eye sees only 2.5 m of world height above the floor at the
     fire's distance, so every organ does its work inside that band */

import {
  AdditiveBlending,
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  LatheGeometry,
  Mesh,
  MeshBasicNodeMaterial,
  PlaneGeometry,
  Scene,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
  Vector2,
} from 'three/webgpu'
import * as TSL from 'three/tsl'
import { mulberry32, FOUNDING_SEED } from '../core/seed'

/* TSL, uncast. A hand-composed node graph cannot be followed by TSL's own
   overload types once it is built out of helpers, so the cast happens once,
   here at the boundary, and the shaders below stay readable. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any
const {
  abs,
  attribute,
  cameraProjectionMatrix,
  cameraViewMatrix,
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
  modelWorldMatrix,
  mx_fractal_noise_float,
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
  sqrt,
  uniform,
  uv,
  varying,
  vec2,
  vec3,
  vec4,
} = TSL as unknown as Record<string, N>

// ---------------------------------------------------------------- the palette
/* sRGB lies: every constant goes through lin(), because three reads a hex as
   sRGB and hands back the LINEAR working value the shader wants. */
const lin = (hex: string): Color => new Color(hex)
const c3 = (c: Color, k = 1): N => vec3(c.r * k, c.g * k, c.b * k)
const hex3 = (h: string, k = 1): N => c3(lin(h), k)

const GOLD = lin('#e0b96a') // gilding, and only ever where a fire finds it
const FIRE_WARM = lin('#fbd8a4') // what the fire throws onto the MARBLE, held
// deliberately pale: a saturated light on a floor this size turns the whole
// court beige, and the marble may never turn beige
const FIRE_LIT = lin('#ffb469') // and what it throws onto everything standing
// UP in it, where the same pale light only ever made olive-grey stone
const SKY_AMB = lin('#c2ceff') // the dome's own light, cool and free
const SKY_REFLECT = lin('#2f3d78') // what the polish finds when it looks up
const HORIZON = lin('#0b1130') // where the ground gives itself to the night
const STONE_COURT = lin('#0c1132') // the polished marble of the court
const STONE_OUT = lin('#090d28') // the rough flags past the temenos line
const STONE_PLAIN = lin('#06091c') // the unbuilt ground beyond
const STONE_VEIN = lin('#46589c') // the cool vein inside the marble
const COLUMN_ALB = lin('#a9a79c') // pale stone: what the firelight finds
const COLUMN_INK = lin('#0a0e22') // and what it is when the fire misses it
const DRESS_ALB = lin('#6f6b60') // the plainer dressed stone of the trim
const SEAT_ALB = lin('#7b6c56')
const BRONZE = lin('#c08a49')
const TIMBER = lin('#8a7358')
const EMBER_GOLD = lin('#f0b45a')
const STAR_WHITE = lin('#eef1ff')
const STAR_COOL = lin('#c9d4f2')
const SMOKE_COOL = lin('#161c3c') // smoke is night that has been breathed on

// ------------------------------------------------------------------ the map
const FLOOR_Y = -0.9
const FIRE = { x: 0, y: -0.45, z: -5.6 } // the light anchor sits low in the bowl
const COURT_R = 12.6 // the temenos: where the polished marble stops
const GROUND_R = 86 // and how far the ground carries on past it
const TAU = Math.PI * 2

/** the empty seats around the fire, in world space. The circle has one gap,
    at the near side, and the gap is where the visitor is sitting. */
const SEATS: Array<{ x: number; z: number; yaw: number }> = [112, 156, -112, -156].map((deg) => {
  const a = (deg * Math.PI) / 180
  const r = 2.62 // inside the outer engraved ring: these belong to the fire
  const x = Math.sin(a) * r
  const z = FIRE.z + Math.cos(a) * r
  return { x, z, yaw: a + Math.PI }
})
const WOODPILE = { x: -1.78, z: -4.28 }
const BASIN = { x: 2.06, z: -4.86 }

export interface AgoraState {
  /** 0..1 fade-in of the ground world after the dark door */
  reveal: number
  elapsed: number
  /** 0..1 while the Keeper speaks: the fire listens and leans in */
  speak?: number
  /** 0..1 while the council convenes: hearth scales toward blaze */
  blaze?: number
}

/**
 * The ground hub, material-first. Camera stays at the origin; everything
 * below is staged for the seated eye (pitch -0.12, fov 46).
 */
export function createAgora(scene: Scene) {
  const root = new Group()
  root.visible = false
  scene.add(root)

  const narrow = window.innerWidth < 760
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  /** counts scale with the frame: a phone is a narrow slot, not a small desktop */
  const tier = (full: number, phone: number): number => (narrow ? phone : full)

  // ------------------------------------------------------------ the hour
  /* ONE heartbeat. Flame, coals, rim, floor pool, column edge and inlay all
     answer uFlick, so the room flickers as one fire and not as nine. */
  const uT = uniform(0)
  /* the drifting-field clock. Under prefers-reduced-motion the whole room
     keeps its composition and its one fire, and only slows the things that
     travel across the frame: nothing here bounces, so slowing is enough. */
  const uTP = uniform(0)
  const uR = uniform(0)
  const uFlick = uniform(1)
  const uFlame = uniform(0)
  const uLean = uniform(0)
  const uBlaze = uniform(0)

  // ------------------------------------------------------------ the laws
  const sn = (p: N): N => mx_noise_float(p)
  const vn = (p: N): N => mx_noise_float(p).mul(0.5).add(0.5)
  const fbm = (p: N): N => mx_fractal_noise_float(p, 3, 2.0, 0.55, 1.0)
  /** dither every gradient at creation: the sRGB step is enormous down here */
  const dith = (amp: number): N =>
    fract(sin(dot(screenCoordinate.xy.add(0.5), vec2(12.9898, 78.233))).mul(43758.5453))
      .sub(0.5)
      .mul(amp)
  /** a shoulder on the bright end: a fire a hand away is still a fire, not
      a white hole. Keeps the darks exactly where they were authored. */
  const shoulder = (c: N): N => c.div(float(1).add(c.mul(0.5)))
  /** aerial perspective: everything far gives itself to the night */
  const haze = (c: N, d: N, from: number, to: number, k = 0.9): N =>
    mix(c, c3(HORIZON, 0.95), smoothstep(from, to, d).mul(k))
  const clip = (world: N): N => cameraProjectionMatrix.mul(cameraViewMatrix).mul(vec4(world, 1))
  const yawRot = (v: N, ang: N): N => {
    const ca = cos(ang)
    const sa = sin(ang)
    return vec3(ca.mul(v.x).add(sa.mul(v.z)), v.y, sa.negate().mul(v.x).add(ca.mul(v.z)))
  }

  // ------------------------------------------------------- instanced fields
  /* Every repeated thing in this room is one draw call: forty columns are a
     colonnade, not forty meshes. */
  interface Item {
    p: [number, number, number]
    s?: [number, number, number]
    r?: number
    tint?: number
  }
  function field(geo: BufferGeometry, mat: MeshBasicNodeMaterial, items: Item[]): Mesh {
    const n = items.length
    const g = new InstancedBufferGeometry()
    g.index = geo.index
    for (const key of Object.keys(geo.attributes)) {
      const attr = geo.attributes[key]
      if (attr) g.setAttribute(key, attr)
    }
    const iPos = new Float32Array(n * 3)
    const iScl = new Float32Array(n * 3)
    const iRot = new Float32Array(n * 2)
    items.forEach((it, k) => {
      iPos[k * 3] = it.p[0]
      iPos[k * 3 + 1] = it.p[1]
      iPos[k * 3 + 2] = it.p[2]
      const s = it.s ?? [1, 1, 1]
      iScl[k * 3] = s[0]
      iScl[k * 3 + 1] = s[1]
      iScl[k * 3 + 2] = s[2]
      iRot[k * 2] = it.r ?? 0
      iRot[k * 2 + 1] = it.tint ?? 1
    })
    g.setAttribute('iPos', new InstancedBufferAttribute(iPos, 3))
    g.setAttribute('iScl', new InstancedBufferAttribute(iScl, 3))
    g.setAttribute('iRot', new InstancedBufferAttribute(iRot, 2))
    g.instanceCount = n
    const m = new Mesh(g, mat)
    m.frustumCulled = false
    root.add(m)
    return m
  }

  /** the shared instanced vertex path: place the shape, carry its world
      position, its own normal (three's normalWorld cannot know about an
      instance) and its local height, which is what the flutes are cut from */
  function inkVertex(): { world: N; normal: N; hLocal: N; tint: N; clip: N } {
    const iPos = attribute('iPos', 'vec3')
    const iScl = attribute('iScl', 'vec3')
    const iRot = attribute('iRot', 'vec2')
    const p = yawRot(positionLocal.mul(iScl), iRot.x).add(iPos)
    const n = normalize(yawRot(normalLocal.div(max(iScl, vec3(0.001, 0.001, 0.001))), iRot.x))
    const world = varying(modelWorldMatrix.mul(vec4(p, 1)).xyz)
    return {
      world,
      normal: varying(n),
      hLocal: varying(positionLocal.y),
      tint: varying(iRot.y),
      clip: clip(world),
    }
  }

  // --------------------------------------------------------- the one light
  /** the fire's falling light at a world point, already flickering */
  function firelight(w: N, k: number, soft: number): N {
    const d = vec3(FIRE.x, FIRE.y, FIRE.z).sub(w)
    return float(k).div(dot(d, d).add(soft)).mul(uFlick)
  }
  /** how squarely a surface faces the fire */
  function facing(w: N, n: N, p: number): N {
    const d = vec3(FIRE.x, FIRE.y, FIRE.z).sub(w)
    return pow(clamp(dot(n, normalize(d)), 0, 1), p)
  }

  // ------------------------------------------------------------- textures
  const texRand = mulberry32(FOUNDING_SEED + 21)
  function paintNoise(ctx: CanvasRenderingContext2D, size: number, rnd: () => number, amp: number): void {
    const img = ctx.getImageData(0, 0, size, size)
    const d = img.data
    for (let i = 0; i < d.length; i += 4) {
      const n = (rnd() - 0.5) * 2 * amp
      d[i] = Math.max(0, Math.min(255, (d[i] ?? 0) + n))
      d[i + 1] = Math.max(0, Math.min(255, (d[i + 1] ?? 0) + n))
      d[i + 2] = Math.max(0, Math.min(255, (d[i + 2] ?? 0) + n))
      const a = (rnd() - 0.5) * amp
      d[i + 3] = Math.max(0, Math.min(255, (d[i + 3] ?? 0) + a))
    }
    ctx.putImageData(img, 0, 0)
  }
  function glowTexture(stops: Array<[number, string]>, rnd: () => number): CanvasTexture {
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
    paintNoise(ctx, size, rnd, 5)
    return new CanvasTexture(canvas)
  }

  // ==================================================================
  // 1 · THE MARBLE — courses, joints, veins, a worn path, and a polish
  //     that wears the night. The stone is dark under the eye and lifts
  //     toward the horizon, which is what grazing reflection actually
  //     does and what keeps the letterpress legible over the near floor.
  // ==================================================================
  const stoneMat = new MeshBasicNodeMaterial()
  {
    const P = positionWorld
    const d = length(P.xz) // from the visitor's own seat
    const dF = length(P.xz.sub(vec2(FIRE.x, FIRE.z)))
    const court = oneMinus(smoothstep(COURT_R - 0.55, COURT_R - 0.02, d))

    // the fire lying on the stone, dancing a little
    const dance = vn(vec3(P.x.mul(0.5), P.z.mul(0.5), uT.mul(0.3))).mul(0.2).add(0.9)
    const fire = float(5.6).div(dF.mul(dF).add(1.2)).mul(dance).mul(uFlick)

    // --- the cut stone -------------------------------------------------
    // courses run across the room and are laid in half bond, the way a
    // pavement is actually laid; each slab took its own polish, so each
    // one sits a few percent off its neighbour
    const SW = 1.28
    const SD = 0.94
    const rowF = P.z.sub(FIRE.z).div(SD)
    const row = floor(rowF)
    const colF = P.x.div(SW).add(fract(row.mul(0.5)))
    const col = floor(colF)
    const dRow = min(fract(rowF), oneMinus(fract(rowF))).mul(SD)
    const dCol = min(fract(colF), oneMinus(fract(colF))).mul(SW)
    const dJoint = min(dRow, dCol)
    const jAA = fwidth(dJoint).mul(1.1).add(0.0007)
    const groove = oneMinus(smoothstep(float(0.009), float(0.009).add(jAA), dJoint))
    // the chamfer beside every groove takes the fire edge-on: this is the
    // line that says the floor is cut and not printed. Its width is held in
    // SCREEN space, or the far courses break into dashes.
    const lipW = max(float(0.012), jAA.mul(1.4))
    const lip = oneMinus(smoothstep(float(0), lipW, abs(dJoint.sub(lipW.add(0.006)))))
    const slabId = row.mul(37.1).add(col.mul(11.7))
    const slabTint = fract(sin(slabId.mul(12.9898)).mul(43758.5453)).sub(0.5).mul(0.09).add(1)

    // --- the vein ------------------------------------------------------
    // veins run with the grain of the quarry, so the noise is stretched
    // along the room. They are THIN: a broad vein is not marble, it is
    // satin, and satin is what round 1 shipped.
    // the floor covers half the frame, so its noise budget is real: one
    // plain warp instead of a fractal one, and the fine family rides the
    // same warp rather than paying for its own
    const g = vec2(P.x.mul(2.4).add(P.z.mul(0.7)), P.z.mul(0.95))
    const warp = sn(vec3(g.x.mul(1.6), g.y.mul(1.6), 12.7)).mul(0.6)
    const m1 = fbm(vec3(g.x.add(warp), g.y.add(warp), 3.3))
    const vein = pow(clamp(oneMinus(abs(m1)), 0, 1), 30.0)
    // a second, finer family branching off the first: one vein family is a
    // contour map, two are a stone
    const m2 = sn(vec3(g.x.mul(2.7).add(warp.mul(0.5)), g.y.mul(2.7), 21.4))
    const hair = pow(clamp(oneMinus(abs(m2)), 0, 1), 44.0)
    const cloud = vn(vec3(P.x.mul(0.1), P.z.mul(0.085), 5.1)).mul(0.24).add(0.88)

    // --- the worn path -------------------------------------------------
    // where feet cross, marble goes paler and glossier and loses its vein:
    // the lane from the seat to the fire, and the ring the council walks
    const lane = oneMinus(smoothstep(0.45, 1.55, abs(P.x)))
      .mul(smoothstep(-6.3, -5.0, P.z))
      .mul(oneMinus(smoothstep(0.3, 1.9, P.z)))
    const hw = dF.sub(2.55).div(1.15)
    const halo = exp(hw.mul(hw).negate())
    const wear = clamp(lane.mul(0.9).add(halo.mul(0.8)), 0, 1)
      .mul(vn(vec3(P.x.mul(1.6), P.z.mul(1.6), 7.7)).mul(0.4).add(0.72))
      .mul(court)

    // --- the stone itself ----------------------------------------------
    const outer = oneMinus(smoothstep(COURT_R + 3.4, COURT_R + 11.0, d))
    // the ground past the temenos is a place, not a backdrop: a long swell
    // under it keeps the far band from reading as one flat wall of navy
    const swell = vn(vec3(P.x.mul(0.042), P.z.mul(0.036), 9.4)).mul(0.4).add(0.8)
    let alb: N = mix(mix(c3(STONE_PLAIN), c3(STONE_OUT), outer), c3(STONE_COURT), court)
    alb = alb.mul(cloud).mul(mix(swell, float(1), court)).mul(mix(float(1), slabTint, court))
    // a vein you can only find by looking is a vein; the far stone loses
    // them entirely, which is also what keeps the distance from crawling
    alb = alb.add(
      c3(STONE_VEIN, 0.1)
        .mul(vein.add(hair.mul(0.7)))
        .mul(court)
        .mul(oneMinus(smoothstep(7.0, 17.0, d)))
        .mul(oneMinus(wear.mul(0.6)))
    )
    alb = alb.mul(oneMinus(groove.mul(0.3).mul(court.mul(0.6).add(0.4))))
    alb = alb.mul(float(1).add(wear.mul(0.2)))

    // --- the light -----------------------------------------------------
    const light = c3(SKY_AMB, 0.62).add(c3(FIRE_WARM).mul(fire))
    let colr: N = alb.mul(light)

    // the polish: a floor is a weak mirror, and a weak mirror is almost
    // black straight down and almost sky at the horizon. This one term is
    // what fills the void behind the colonnade and what keeps the near
    // stone dark enough to carry his words.
    const cosT = clamp(float(0.9).div(sqrt(d.mul(d).add(0.81))), 0, 1)
    const fres = pow(oneMinus(cosT), 5.0)
    const polish = mix(float(0.28), float(1.0), court).mul(float(0.78).add(wear.mul(0.55)))
    colr = colr.add(c3(SKY_REFLECT, 0.062).mul(fres).mul(polish))
    colr = colr.add(c3(FIRE_WARM, 0.022).mul(fire).mul(fres.mul(0.65).add(0.35)).mul(polish))
    colr = colr.add(c3(GOLD, 0.013).mul(lip).mul(fire).mul(court))
    // ash gathers in the joints near the fire, because it always does and
    // because a floor that is swept everywhere is a floor nobody uses
    const aw = dF.sub(1.7).div(1.5)
    colr = colr.add(c3(lin('#9a8f7e'), 0.02).mul(groove).mul(exp(aw.mul(aw).negate())).mul(court))

    // --- the engraved circles ------------------------------------------
    // cut into the stone, not drawn on it: a groove, and a fillet on the
    // fire side of it that the flame finds. This is what earns the line.
    const ring = (r0: number, w: number, k: number): void => {
      const dr = abs(dF.sub(r0))
      const aa = fwidth(dr).mul(1.1).add(0.0007)
      const cut = oneMinus(smoothstep(float(w), float(w).add(aa), dr))
      const fw = max(float(0.011), aa.mul(1.4))
      const fill = oneMinus(smoothstep(float(0), fw, abs(dr.sub(float(w).add(fw)))))
      colr = colr.mul(oneMinus(cut.mul(0.32)))
      colr = colr.add(c3(GOLD, k).mul(fill).mul(fire))
    }
    ring(1.95, 0.036, 0.05)
    ring(3.16, 0.022, 0.032)

    // the temenos: where the polished court stops, one carved line that
    // reads at every azimuth, so even a phone's narrow slot has a horizon
    // of architecture instead of a smear
    {
      const de = abs(d.sub(COURT_R))
      const aa = fwidth(de).mul(1.1).add(0.0012)
      const cut = oneMinus(smoothstep(float(0.055), float(0.055).add(aa), de))
      const fw = max(float(0.022), aa.mul(1.5))
      const fill = oneMinus(smoothstep(float(0), fw, abs(de.sub(float(0.055).add(fw)))))
      colr = colr.mul(oneMinus(cut.mul(0.26)))
      colr = colr.add(c3(SKY_REFLECT, 0.055).mul(fill).mul(fres))
    }

    // --- what sits on the stone ----------------------------------------
    // contact shade: a brazier that casts nothing is a brazier floating a
    // centimetre above the floor
    const shade = (cx: number, cz: number, r0: number, r1: number, k: number): N =>
      oneMinus(smoothstep(r0, r1, length(P.xz.sub(vec2(cx, cz))))).mul(k)
    let ao: N = shade(FIRE.x, FIRE.z, 0.28, 1.4, 0.52)
    for (const s of SEATS) ao = ao.add(shade(s.x, s.z, 0.2, 0.95, 0.34))
    ao = ao.add(shade(WOODPILE.x, WOODPILE.z, 0.18, 0.8, 0.3))
    ao = ao.add(shade(BASIN.x, BASIN.z, 0.14, 0.62, 0.26))
    colr = colr.mul(oneMinus(clamp(ao, 0, 0.72)))

    stoneMat.colorNode = shoulder(haze(colr, d, 14, 62)).add(dith(0.0024)).mul(uR)
  }
  const floor0 = new Mesh(new CircleGeometry(GROUND_R, 160), stoneMat)
  floor0.rotation.x = -Math.PI / 2
  floor0.position.y = FLOOR_Y
  root.add(floor0)

  // ==================================================================
  // 2 · THE FIRMAMENT IN THE STONE — a whisper only. The stars belong in
  //     the sky behind the pillars; the polish keeps a few of them, lying
  //     flat and smeared along the eye's own direction the way a
  //     reflection on stone actually lies.
  // ==================================================================
  const dustMat = new MeshBasicNodeMaterial({
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
  })
  {
    const { world, tint, clip: c } = inkVertex()
    dustMat.vertexNode = c
    const p = uv().sub(vec2(0.5, 0.5)).mul(2)
    const core = oneMinus(smoothstep(0.0, 1.0, length(p)))
    const twinkle = sin(uT.mul(0.7).add(tint.mul(31.0))).mul(0.22).add(0.78)
    const dCam = length(world.xz)
    dustMat.colorNode = mix(c3(STAR_COOL), c3(STAR_WHITE), tint.sub(0.5))
    dustMat.opacityNode = pow(core, 2.2)
      .mul(twinkle)
      .mul(smoothstep(2.2, 6.5, dCam))
      .mul(oneMinus(smoothstep(9.5, 12.4, dCam)))
      .mul(0.28)
      .mul(uR)
  }
  {
    const rnd = mulberry32(FOUNDING_SEED + 34)
    const items: Item[] = []
    const want = tier(320, 150)
    let guard = 0
    while (items.length < want && guard < want * 60) {
      guard++
      const r = 2.0 + 10.6 * Math.pow(rnd(), 0.5)
      const a = rnd() * TAU
      const x = Math.sin(a) * r
      const z = -Math.cos(a) * r
      if (z > 0.6) continue // behind the visitor
      if (Math.hypot(x - FIRE.x, z - FIRE.z) < 1.6) continue // the altar owns its ground
      const dCam = Math.hypot(x, z)
      const s = 0.026 + rnd() * 0.03
      // a reflection is not a dot: it smears along the line of sight
      items.push({
        p: [x, FLOOR_Y + 0.012, z],
        s: [s, 1, s * (2.6 + rnd() * 2.4)],
        r: Math.atan2(x, z),
        tint: rnd(),
      })
      if (dCam > 20) break
    }
    const plate = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2)
    field(plate, dustMat, items).renderOrder = 2
  }

  // ==================================================================
  // 3 · THE FIRE — one TSL field carved from fractal noise: torn tips,
  //     rising turbulence, a slow whole-body lean. Untouched, because it
  //     is already the best thing in the night and the hierarchy is law.
  // ==================================================================
  function flameMaterial(flip: boolean, gain: number, seed: number): MeshBasicNodeMaterial {
    const mat = new MeshBasicNodeMaterial({
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
    })
    const p = uv()
    const y = clamp(flip ? oneMinus(p.y) : p.y, 0.0, 1.0)
    const x = p.x.sub(0.5)
    const swayA = mx_noise_float(vec3(y.mul(1.9).sub(uT.mul(1.15)), uT.mul(0.27), 5.2 + seed))
    const swayB = mx_noise_float(vec3(y.mul(4.6).sub(uT.mul(2.1)), uT.mul(0.4), 9.7 + seed))
    const xx = x
      .add(swayA.mul(y.mul(0.17)))
      .add(swayB.mul(y.mul(0.06)))
      .add(uLean.mul(y))
    const radius = mix(float(0.38), float(0.05), pow(y, float(0.74)))
    const dd = abs(xx).div(radius)
    const turb = mx_fractal_noise_float(
      vec3(xx.mul(5.6).add(2.0), y.mul(2.6).sub(uT.mul(1.9)), uT.mul(0.12).add(7.3 + seed)),
      3,
      2.0,
      0.55,
      1.0
    )
    const fieldV = float(1.02).sub(dd.mul(dd)).add(turb.mul(0.52)).sub(y.mul(0.72))
    const rooted = smoothstep(0.0, 0.06, y)
    const crown = oneMinus(smoothstep(0.8, 0.97, y))
    let alpha = smoothstep(0.16, 0.46, fieldV).mul(rooted).mul(crown).mul(uFlame).mul(float(gain))
    if (flip) alpha = alpha.mul(oneMinus(smoothstep(0.05, 0.46, y)))
    const heat = smoothstep(0.55, 1.3, fieldV.add(oneMinus(y).mul(0.5)).sub(abs(xx).mul(1.5)))
    const body = mix(vec3(0.58, 0.12, 0.015), vec3(1.0, 0.63, 0.19), smoothstep(0.0, 0.85, fieldV))
    mat.colorNode = mix(body, vec3(1.02, 0.94, 0.8), heat)
    mat.opacityNode = alpha
    return mat
  }

  const RIM_Y = FLOOR_Y + 0.385 // the brazier's lip
  const flameGeo = new PlaneGeometry(1, 1)
  const FLAME_W = 1.2
  const FLAME_H = 1.35
  const TONGUE_W = FLAME_W * 0.62
  const TONGUE_H = FLAME_H * 0.66
  const FLAME_BASE = RIM_Y - 0.12
  const flame = new Mesh(flameGeo, flameMaterial(false, 1, 0))
  flame.scale.set(FLAME_W, FLAME_H, 1)
  flame.position.set(FIRE.x, FLAME_BASE + FLAME_H / 2, FIRE.z)
  flame.renderOrder = 7
  root.add(flame)

  const tongue = new Mesh(flameGeo, flameMaterial(false, 0.85, 4.3))
  tongue.scale.set(TONGUE_W, TONGUE_H, 1)
  tongue.position.set(FIRE.x + 0.1, FLAME_BASE + TONGUE_H / 2, FIRE.z + 0.16)
  tongue.renderOrder = 7
  root.add(tongue)

  // ---- the vessel: stepped stone, a bronze bowl, a bed of coals -------
  /** a lathe from a list of [radius, height] pairs */
  function lathe(profile: Array<[number, number]>, segs: number): LatheGeometry {
    return new LatheGeometry(
      profile.map(([r, y]) => new Vector2(r, y)),
      segs
    )
  }

  /** dressed stone: what the fire finds, what the sky leaves, and haze */
  function dressedStone(opts: {
    albedo: Color
    rim: number
    facePow?: number
    ambK?: number
    baseK?: number
  }): MeshBasicNodeMaterial {
    const mat = new MeshBasicNodeMaterial()
    const { world, normal, tint, clip: c } = inkVertex()
    mat.vertexNode = c
    const alb = c3(opts.albedo)
    const skyTint = mix(vec3(1, 1, 1), alb.mul(1.6), 0.75)
    let colr: N = c3(COLUMN_INK, opts.baseK ?? 0.42)
      .mul(tint)
      .add(
        c3(SKY_AMB, opts.ambK ?? 0.0075)
          .mul(skyTint)
          .mul(tint)
          .mul(float(0.42).add(max(normal.y, 0).mul(0.58)))
      )
    colr = colr.add(
      alb.mul(c3(FIRE_LIT)).mul(firelight(world, 5.6, 2.0)).mul(facing(world, normal, opts.facePow ?? 2.4)).mul(opts.rim)
    )
    mat.colorNode = shoulder(haze(colr, length(world.xz), 9, 32)).add(dith(0.0022)).mul(uR)
    return mat
  }

  const pedestalMat = dressedStone({ albedo: lin('#6d6a63'), rim: 0.14, facePow: 1.6, baseK: 0.42 })
  field(
    lathe(
      [
        [0.42, 0.0],
        [0.42, 0.06],
        [0.36, 0.085],
        [0.36, 0.15],
        [0.3, 0.175],
        [0.28, 0.225],
      ],
      22
    ),
    pedestalMat,
    [{ p: [FIRE.x, FLOOR_Y, FIRE.z] }]
  )

  // the hearth kerb: one low course set INTO the floor, barely a hand
  // proud of it. Round 1 built a crown of black teeth around the fire and
  // the frames called it out at once.
  {
    const rnd = mulberry32(FOUNDING_SEED + 71)
    const items: Item[] = []
    const n = 42
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + 0.17
      const r = 0.7 + (rnd() - 0.5) * 0.03
      items.push({
        p: [FIRE.x + Math.sin(a) * r, FLOOR_Y - 0.005, FIRE.z + Math.cos(a) * r],
        s: [1, 0.7 + rnd() * 0.6, 1],
        r: a + (rnd() - 0.5) * 0.09,
        tint: 0.85 + rnd() * 0.3,
      })
    }
    field(new BoxGeometry(0.104, 0.038, 0.13).translate(0, 0.019, 0), pedestalMat, items)
  }

  const bowlMat = new MeshBasicNodeMaterial()
  {
    const { world, normal, hLocal, clip: c } = inkVertex()
    bowlMat.vertexNode = c
    // bronze remembers the fire it has held: cold and nearly black at the
    // foot, warming as it climbs to the lip
    const up = smoothstep(0.02, 0.3, hLocal)
    const hammer = vn(vec3(world.x.mul(26), world.y.mul(30), world.z.mul(26))).mul(0.28).add(0.86)
    const alb = c3(BRONZE).mul(hammer)
    let colr: N = c3(COLUMN_INK, 0.5).add(c3(SKY_AMB, 0.03).mul(max(normal.y, 0).mul(0.6).add(0.3)))
    colr = colr.add(
      alb.mul(c3(FIRE_WARM)).mul(firelight(world, 4.4, 0.55)).mul(facing(world, normal, 1.6)).mul(float(0.22).add(up.mul(1.5)))
    )
    bowlMat.colorNode = shoulder(colr).add(dith(0.0022)).mul(uR)
  }
  field(
    lathe(
      [
        [0.235, 0.0],
        [0.3, 0.05],
        [0.4, 0.13],
        [0.5, 0.235],
        [0.545, 0.29],
        [0.545, 0.325],
        [0.5, 0.325],
        [0.46, 0.29],
      ],
      36
    ),
    bowlMat,
    [{ p: [FIRE.x, FLOOR_Y + 0.1, FIRE.z] }]
  )

  // the coal bed: the bowl's inside was a black hole, and a fire with no
  // coals under it is a picture of a fire
  const coalMat = new MeshBasicNodeMaterial()
  {
    const p = uv().sub(vec2(0.5, 0.5)).mul(2)
    const r = length(p)
    const cells = vn(vec3(p.x.mul(7.5), p.y.mul(7.5), uT.mul(0.06)))
    const crack = pow(clamp(oneMinus(abs(fbm(vec3(p.x.mul(4.4), p.y.mul(4.4), uT.mul(0.09))))), 0, 1), 5.0)
    const breath = vn(vec3(p.x.mul(2.1), p.y.mul(2.1), uT.mul(0.55))).mul(0.45).add(0.62)
    const heat = clamp(crack.mul(1.15).add(cells.sub(0.56).mul(1.5)), 0, 1).mul(breath).mul(uFlick)
    const colr = mix(hex3('#26120a'), hex3('#ff9a3a'), heat).add(hex3('#fff1cc').mul(pow(heat, 3.4)).mul(0.55))
    coalMat.colorNode = colr.mul(oneMinus(smoothstep(0.74, 1.0, r))).add(dith(0.003)).mul(uR)
  }
  const coalBed = new Mesh(new CircleGeometry(0.47, 28), coalMat)
  coalBed.rotation.x = -Math.PI / 2
  coalBed.position.set(FIRE.x, FLOOR_Y + 0.33, FIRE.z)
  coalBed.renderOrder = 5
  root.add(coalBed)

  // molten rim: the bowl's lip catches the flame
  const rimMat = new MeshBasicNodeMaterial({
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
  })
  rimMat.colorNode = c3(GOLD)
  rimMat.opacityNode = uFlick.mul(0.34).add(0.28).mul(uR)
  const rim = new Mesh(new TorusGeometry(0.545, 0.014, 8, 64), rimMat)
  rim.rotation.x = Math.PI / 2
  rim.position.set(FIRE.x, RIM_Y + 0.04, FIRE.z)
  rim.renderOrder = 6
  root.add(rim)

  // one quiet breath of warm air over the coals
  const coalRand = mulberry32(FOUNDING_SEED + 8)
  const airMat = new SpriteMaterial({
    map: glowTexture(
      [
        [0, 'rgba(224, 169, 84, 0.20)'],
        [0.5, 'rgba(180, 120, 50, 0.06)'],
        [1, 'rgba(0, 0, 0, 0)'],
      ],
      coalRand
    ),
    blending: AdditiveBlending,
    depthWrite: false,
    transparent: true,
    opacity: 0,
  })
  const air = new Sprite(airMat)
  air.position.set(FIRE.x, 0.3, FIRE.z)
  air.scale.set(1.8, 1.5, 1)
  air.renderOrder = 8
  root.add(air)

  // ==================================================================
  // 4 · THE ANSWER IN THE STONE — the flame's true twin, hung below the
  //     floor plane exactly where reflection geometry puts it
  // ==================================================================
  const REFL_W = FLAME_W * 1.1
  const REFL_H = FLAME_H * 1.18
  const reflMat = flameMaterial(true, 0.2, 0)
  reflMat.depthTest = false
  const refl = new Mesh(flameGeo, reflMat)
  refl.scale.set(REFL_W, REFL_H, 1)
  refl.position.set(FIRE.x, 2 * FLOOR_Y - FLAME_BASE - REFL_H / 2, FIRE.z)
  refl.renderOrder = 4
  root.add(refl)

  const washMat = new MeshBasicNodeMaterial({
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
  })
  {
    const cu = uv().sub(vec2(0.5, 0.5))
    const dd = length(vec2(cu.x.mul(1.6), cu.y))
    const a = oneMinus(smoothstep(0.06, 0.5, dd)).mul(0.075)
    const shim = vn(vec3(uv().x.mul(5), uv().y.mul(5), uT.mul(0.4))).mul(0.4).add(0.8)
    washMat.colorNode = c3(GOLD)
    washMat.opacityNode = a.mul(shim).mul(uFlick).mul(uR).add(dith(0.006))
  }
  const wash = new Mesh(new PlaneGeometry(3.4, 3.6), washMat)
  wash.rotation.x = -Math.PI / 2
  wash.position.set(FIRE.x, FLOOR_Y + 0.008, -4.3)
  wash.renderOrder = 3
  root.add(wash)

  // ==================================================================
  // 5 · THE COLONNADE — three registers, one draw call each.
  //     The near arc is the blessed composition and keeps its angles; behind
  //     it a second row falls away through the gaps, and past both a low
  //     far stoa holds the horizon at every azimuth (which is the only
  //     thing a phone's narrow slot can see).
  // ==================================================================
  const COL_H = 5.62 // plinth crown to shaft crown
  function columnProfile(): Array<[number, number]> {
    const pts: Array<[number, number]> = [
      [0.4, 0.0],
      [0.4, 0.055],
      [0.386, 0.078],
      [0.374, 0.126],
      [0.343, 0.166],
      [0.318, 0.19],
      [0.336, 0.228],
      [0.352, 0.258],
      [0.344, 0.288],
      [0.309, 0.318],
    ]
    const rB = 0.288
    const rT = 0.211
    const y0 = 0.318
    const N_ = 14
    for (let i = 0; i <= N_; i++) {
      const t = i / N_
      // entasis: the shaft swells about a third up, which is the whole
      // reason a stone column reads as round instead of as a pipe
      const r = rB + (rT - rB) * Math.pow(t, 1.22) + 0.015 * Math.sin(Math.pow(t, 0.8) * Math.PI)
      pts.push([r, y0 + t * (COL_H - y0)])
    }
    // the necking: three annulets under the capital
    pts.push([rT * 0.965, COL_H + 0.028])
    pts.push([rT * 1.07, COL_H + 0.058])
    pts.push([rT * 1.07, COL_H + 0.1])
    return pts
  }

  const shaftMat = new MeshBasicNodeMaterial()
  {
    const { world, normal, hLocal, tint, clip: c } = inkVertex()
    shaftMat.vertexNode = c
    const dCam = length(world.xz)
    // twenty flutes, cut only into the shaft. The normal is rotated about
    // the column's own axis, so each flute gets a lit arris and a dark
    // hollow from the one fire, which is what makes stone read as carved.
    const shaftMask = smoothstep(0.34, 0.5, hLocal).mul(oneMinus(smoothstep(5.4, 5.58, hLocal)))
    const fade = oneMinus(smoothstep(17.0, 33.0, dCam))
    const f = fract(uv().x.mul(20))
    const bend = sin(f.mul(TAU)).mul(0.62).mul(shaftMask).mul(fade)
    const tHor = normalize(vec3(normal.z.negate(), float(0.0), normal.x))
    const nF = normalize(normal.add(tHor.mul(bend)))
    // and the hollows keep a little of their own shade
    const hollow = oneMinus(pow(sin(f.mul(Math.PI)), 2.0).mul(0.24).mul(shaftMask).mul(fade))

    const alb = c3(COLUMN_ALB)
    const skyTint = mix(vec3(1, 1, 1), alb.mul(1.5), 0.78)
    // the lapis night rests on the upper shafts, so the stone reads round
    // against the sky instead of flat
    const lift = smoothstep(0.5, 5.2, hLocal)
    let colr: N = c3(COLUMN_INK, 0.42)
      .mul(tint)
      .add(c3(SKY_AMB, 0.0072).mul(skyTint).mul(tint).mul(float(0.5).add(lift.mul(0.9))))
    // the fire is LOW, so a shaft is a column of light that dies as it
    // climbs. A column lit evenly to its capital is a column in daylight.
    // The base mouldings sit closest of all and would blaze on their own,
    // so they keep two thirds of what the shaft gets.
    const foot = float(0.6).add(smoothstep(0.1, 0.85, hLocal).mul(0.4))
    const glow = firelight(world, 6.0, 2.0).mul(facing(world, nF, 4.0)).mul(oneMinus(lift.mul(0.86)).add(0.055))
    colr = colr.add(alb.mul(c3(FIRE_LIT)).mul(glow).mul(0.66).mul(hollow).mul(foot))
    shaftMat.colorNode = shoulder(haze(colr, dCam, 9, 32)).add(dith(0.0022)).mul(uR)
  }

  const dressMat = dressedStone({ albedo: DRESS_ALB, rim: 0.13, facePow: 2.4, baseK: 0.42, ambK: 0.0068 })

  const NEAR_ANGLES = [-62, -44, -30, -19, -9, 9, 19, 30, 44, 62]
  const MID_ANGLES = [-71, -53, -37, -24.5, -14, 14, 24.5, 37, 53, 71]
  const STOA_ANGLES: number[] = []
  for (let a = -94.5; a <= 94.5; a += 9) STOA_ANGLES.push(a)

  interface Register {
    r: number
    angles: number[]
    scale: number
    lift: number
    tint: number
  }
  const REGISTERS: Register[] = [
    { r: 10.6, angles: NEAR_ANGLES, scale: 1, lift: 0.2, tint: 1 },
    { r: 16.3, angles: MID_ANGLES, scale: 1, lift: 0.2, tint: 0.95 },
    { r: 26.0, angles: narrow ? STOA_ANGLES.filter((_, i) => i % 2 === 0) : STOA_ANGLES, scale: 0.58, lift: 0.74, tint: 0.9 },
  ]

  const shafts: Item[] = []
  const plinths: Item[] = []
  const echini: Item[] = []
  const abaci: Item[] = []
  const beams: Item[] = []
  for (const reg of REGISTERS) {
    const s = reg.scale
    const base = FLOOR_Y + reg.lift
    for (const deg of reg.angles) {
      const a = (deg * Math.PI) / 180
      const x = Math.sin(a) * reg.r
      const z = -Math.cos(a) * reg.r
      shafts.push({ p: [x, base, z], s: [s, s, s], r: -a, tint: reg.tint })
      plinths.push({ p: [x, base - 0.2 * s, z], s: [s, s, s], r: -a, tint: reg.tint })
      echini.push({ p: [x, base + (COL_H + 0.1) * s, z], s: [s, s, s], r: -a, tint: reg.tint })
      abaci.push({ p: [x, base + (COL_H + 0.235) * s, z], s: [s, s, s], r: -a, tint: reg.tint })
    }
    // the architrave crowns each register, but the two central gaps stay
    // open: the arc breathes where the visitor's gaze passes through it
    for (let i = 0; i < reg.angles.length - 1; i++) {
      const d0 = reg.angles[i]
      const d1 = reg.angles[i + 1]
      if (d0 === undefined || d1 === undefined) continue
      if (d0 < 0 && d1 > 0) continue
      const a0 = (d0 * Math.PI) / 180
      const a1 = (d1 * Math.PI) / 180
      const mid = (a0 + a1) / 2
      const chord = 2 * reg.r * Math.sin(Math.abs(a1 - a0) / 2)
      beams.push({
        p: [Math.sin(mid) * reg.r, base + (COL_H + 0.44) * s, -Math.cos(mid) * reg.r],
        s: [chord + 0.34 * s, s, s],
        r: -mid,
        tint: reg.tint,
      })
    }
  }
  field(lathe(columnProfile(), 26), shaftMat, shafts)
  field(new BoxGeometry(0.74, 0.2, 0.74).translate(0, 0.1, 0), dressMat, plinths)
  field(
    lathe(
      [
        [0.212, 0.0],
        [0.232, 0.022],
        [0.268, 0.058],
        [0.3, 0.09],
        [0.318, 0.112],
        [0.318, 0.132],
      ],
      22
    ),
    dressMat,
    echini
  )
  field(new BoxGeometry(0.66, 0.11, 0.66), dressMat, abaci)
  field(new BoxGeometry(1, 0.34, 0.5), dressMat, beams)

  // the stoa's podium: courses of masonry, so the far architecture has a
  // horizon line of its own instead of a hovering row of sticks
  {
    const rnd = mulberry32(FOUNDING_SEED + 91)
    const items: Item[] = []
    const R = 26.0
    const n = narrow ? 30 : 46
    const span = (200 * Math.PI) / 180
    for (let course = 0; course < 2; course++) {
      const y = FLOOR_Y + 0.02 + course * 0.36
      for (let i = 0; i < n; i++) {
        const a = -span / 2 + (span * (i + (course % 2) * 0.5)) / n
        items.push({
          p: [Math.sin(a) * R, y, -Math.cos(a) * R],
          s: [1, 1, 1],
          r: -a,
          tint: 0.8 + rnd() * 0.34,
        })
      }
    }
    const w = (2 * Math.PI * 26.0 * (200 / 360)) / (narrow ? 30 : 46)
    field(new BoxGeometry(w * 0.97, 0.36, 1.4).translate(0, 0.18, 0), dressMat, items)
  }

  // ---- the colonnade in the polish -----------------------------------
  /* A stone floor is a weak mirror, and the one thing standing near enough
     to the fire to leave an image in it is the colonnade. Each lit base
     lays a soft warm streak that runs from its own foot back toward the
     seated eye, which is exactly where reflection geometry puts it. Faint
     by law: gold on a floor is a reflection or it is a fill. */
  const reflectMat = new MeshBasicNodeMaterial({
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
  })
  {
    const { world, tint, clip: c } = inkVertex()
    reflectMat.vertexNode = c
    const t = uv()
    const away = pow(oneMinus(t.y), 2.6)
    const across = pow(oneMinus(abs(t.x.sub(0.5)).mul(2)), 1.4)
    const wobble = vn(vec3(world.x.mul(2.2), world.z.mul(0.7), uT.mul(0.35))).mul(0.7).add(0.5)
    reflectMat.colorNode = c3(GOLD)
    reflectMat.opacityNode = away.mul(across).mul(wobble).mul(tint).mul(uFlick).mul(0.08).mul(uR)
  }
  {
    const items: Item[] = []
    for (const deg of NEAR_ANGLES) {
      const a = (deg * Math.PI) / 180
      const x = Math.sin(a) * 10.6
      const z = -Math.cos(a) * 10.6
      // how much of the fire this base actually catches, so the streaks
      // fall off around the arc instead of all burning the same
      const d2 = (x - FIRE.x) ** 2 + 0.2 + (z - FIRE.z) ** 2
      const k = Math.min(1, 6.0 / (d2 + 2.0) / 0.18)
      items.push({
        p: [Math.sin(a) * 9.42, FLOOR_Y + 0.01, -Math.cos(a) * 9.42],
        s: [0.46, 1, 2.4],
        // the streak's own +z has to point AT its column, or the image
        // lies down the wrong way from the foot that casts it
        r: Math.PI - a,
        tint: k,
      })
    }
    field(new PlaneGeometry(1, 1).rotateX(-Math.PI / 2), reflectMat, items).renderOrder = 3
  }

  // ==================================================================
  // 6 · THE NIGHT BETWEEN — a band of air along the horizon. Without it
  //     the far ground meets the sky in a line, and a line is a wall.
  // ==================================================================
  const airBandMat = new MeshBasicNodeMaterial({
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    side: DoubleSide,
  })
  {
    const t = uv()
    const drift = vn(vec3(t.x.mul(6.0), t.y.mul(1.4), uT.mul(0.02))).mul(0.5).add(0.6)
    airBandMat.colorNode = mix(hex3('#243057'), hex3('#16204c'), t.y)
    airBandMat.opacityNode = pow(oneMinus(t.y), 3.0).mul(drift).mul(0.085).mul(uR).add(dith(0.004))
  }
  const airBand = new Mesh(new CylinderGeometry(46, 46, 5.2, 72, 1, true), airBandMat)
  airBand.position.y = FLOOR_Y + 1.5
  airBand.renderOrder = 1
  root.add(airBand)

  // ==================================================================
  // 7 · WHAT SAYS PEOPLE GATHER HERE — no bodies, no faces. Four low
  //     seats around the fire with the near arc left open, wood cut for
  //     the night, a krater of water, spent embers, and ash gathered in
  //     the joints where it always gathers.
  // ==================================================================
  const seatMat = dressedStone({ albedo: SEAT_ALB, rim: 0.19, facePow: 1.9, baseK: 0.45, ambK: 0.0072 })
  {
    // four blocks, none of them the same block: identical stools four times
    // over read as props, and nobody has ever left four stones square
    const rnd = mulberry32(FOUNDING_SEED + 117)
    const seatItems: Item[] = SEATS.map((s) => ({
      p: [s.x, FLOOR_Y, s.z],
      s: [0.86 + rnd() * 0.3, 0.82 + rnd() * 0.28, 0.9 + rnd() * 0.24],
      r: s.yaw + (rnd() - 0.5) * 0.5,
      tint: 0.88 + rnd() * 0.26,
    }))
    // a stool for one, not a bench for six: round 2 put four pale
    // sarcophagi against the colonnade and the frame said so
    field(new BoxGeometry(0.5, 0.27, 0.4).translate(0, 0.135, 0), seatMat, seatItems)
    field(new BoxGeometry(0.56, 0.05, 0.44).translate(0, 0.29, 0), seatMat, seatItems)
  }

  // wood cut for the night, stacked the way it is actually stacked: two
  // low rows, not the black cairn round 1 put in the frame
  const timberMat = dressedStone({ albedo: TIMBER, rim: 0.6, facePow: 0.9, baseK: 0.42, ambK: 0.009 })
  {
    const rnd = mulberry32(FOUNDING_SEED + 103)
    const items: Item[] = []
    for (let row = 0; row < 2; row++) {
      const n = 4 - row
      for (let i = 0; i < n; i++) {
        const acr = (i - (n - 1) / 2) * 0.115
        items.push({
          p: [
            WOODPILE.x + acr * Math.cos(0.5) + (rnd() - 0.5) * 0.02,
            FLOOR_Y + 0.052 + row * 0.098,
            WOODPILE.z - acr * Math.sin(0.5) + (rnd() - 0.5) * 0.02,
          ],
          s: [1, 0.85 + rnd() * 0.3, 1],
          r: 0.5 + Math.PI / 2 + (rnd() - 0.5) * 0.14,
          tint: 0.82 + rnd() * 0.4,
        })
      }
    }
    field(new CylinderGeometry(0.048, 0.055, 0.56, 9).rotateZ(Math.PI / 2), timberMat, items)
  }

  // a krater of water standing on the stone: the only other thing in this
  // room that reflects, and it reflects one thing only
  const bronzeMat = dressedStone({ albedo: BRONZE, rim: 0.4, facePow: 1.8, baseK: 0.42, ambK: 0.007 })
  field(
    lathe(
      [
        [0.08, 0.0],
        [0.102, 0.018],
        [0.089, 0.04],
        [0.151, 0.08],
        [0.191, 0.142],
        [0.2, 0.191],
        [0.2, 0.209],
        [0.174, 0.191],
      ],
      20
    ),
    bronzeMat,
    [{ p: [BASIN.x, FLOOR_Y, BASIN.z] }]
  )

  // the water: a disc that holds the fire and nothing else
  const waterMat = new MeshBasicNodeMaterial({
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
  })
  {
    const p = uv().sub(vec2(0.5, 0.5)).mul(2)
    const ripple = vn(vec3(p.x.mul(9), p.y.mul(9), uT.mul(0.5))).mul(0.5).add(0.55)
    waterMat.colorNode = c3(FIRE_WARM)
    waterMat.opacityNode = oneMinus(smoothstep(0.5, 1.0, length(p)))
      .mul(ripple)
      .mul(uFlick)
      .mul(0.1)
      .mul(uR)
  }
  const water = new Mesh(new CircleGeometry(0.178, 20), waterMat)
  water.rotation.x = -Math.PI / 2
  water.position.set(BASIN.x, FLOOR_Y + 0.198, BASIN.z)
  water.renderOrder = 6
  root.add(water)

  // spent embers cooling on the stone: the fire has been burning a while
  const cinderMat = new MeshBasicNodeMaterial({
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
  })
  {
    const { tint, clip: c } = inkVertex()
    cinderMat.vertexNode = c
    const p = uv().sub(vec2(0.5, 0.5)).mul(2)
    const glow = oneMinus(smoothstep(0.1, 1.0, length(p)))
    const pulse = sin(uT.mul(0.9).add(tint.mul(19.0))).mul(0.4).add(0.55)
    cinderMat.colorNode = mix(c3(lin('#c2521a')), c3(EMBER_GOLD), pulse)
    cinderMat.opacityNode = pow(glow, 2.0).mul(pulse).mul(uFlick).mul(0.5).mul(uR)
  }
  {
    const rnd = mulberry32(FOUNDING_SEED + 47)
    const items: Item[] = []
    for (let i = 0; i < tier(38, 22); i++) {
      const a = rnd() * TAU
      const r = 0.95 + Math.pow(rnd(), 0.75) * 2.4
      const s = 0.035 + rnd() * 0.075
      items.push({
        p: [FIRE.x + Math.sin(a) * r, FLOOR_Y + 0.014, FIRE.z + Math.cos(a) * r],
        s: [s, 1, s],
        r: a,
        tint: rnd(),
      })
    }
    field(new PlaneGeometry(1, 1).rotateX(-Math.PI / 2), cinderMat, items).renderOrder = 3
  }

  // ==================================================================
  // 8 · THE AIR — smoke, motes and the ember plume. Every sized field
  //     rides an instanced quad (three drops sizeNode on Points), and
  //     every one of them moves as a pure function of elapsed, so the
  //     rig's frozen clock and the live loop see the same night.
  // ==================================================================
  /** billboard an instanced quad at a world centre */
  function bill(center: N, size: N): N {
    const vp = cameraViewMatrix.mul(vec4(center, 1))
    const off = uv().sub(vec2(0.5, 0.5)).mul(size)
    return cameraProjectionMatrix.mul(vec4(vp.x.add(off.x), vp.y.add(off.y), vp.z, vp.w))
  }
  function quadField(
    count: number,
    fill: (i: number, pos: Float32Array, dat: Float32Array, rnd: () => number) => void,
    mat: MeshBasicNodeMaterial,
    seed: number
  ): Mesh {
    const rnd = mulberry32(FOUNDING_SEED + seed)
    const base = new PlaneGeometry(1, 1)
    const g = new InstancedBufferGeometry()
    g.index = base.index
    for (const key of Object.keys(base.attributes)) {
      const attr = base.attributes[key]
      if (attr) g.setAttribute(key, attr)
    }
    const pos = new Float32Array(count * 3)
    const dat = new Float32Array(count * 4)
    for (let i = 0; i < count; i++) fill(i, pos, dat, rnd)
    g.setAttribute('iPos', new InstancedBufferAttribute(pos, 3))
    g.setAttribute('iDat', new InstancedBufferAttribute(dat, 4))
    g.instanceCount = count
    const m = new Mesh(g, mat)
    m.frustumCulled = false
    root.add(m)
    return m
  }

  // ---- the ember plume: gold cooling to star-white as it climbs -------
  const ASC_H = 2.9
  const emberMat = new MeshBasicNodeMaterial({
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
  })
  {
    const iPos = attribute('iPos', 'vec3') // a0, rad0, speed
    const iDat = attribute('iDat', 'vec4') // phase, wob, size, spin
    const k = fract(uTP.mul(iPos.z).add(iDat.x))
    const ang = iPos.x.add(uTP.mul(0.22)).add(k.mul(2.6))
    const rad = min(float(0.62), iPos.y.add(pow(k, 1.4).mul(0.62)))
    const c = vec3(
      float(FIRE.x).add(cos(ang).mul(rad)).add(uLean.mul(k.mul(2.4))),
      float(FLOOR_Y + 0.44).add(k.mul(ASC_H)),
      float(FIRE.z).add(sin(ang).mul(rad).mul(0.55))
    )
    emberMat.vertexNode = bill(c, iDat.z.mul(float(1).add(k.mul(0.5))))
    const kv = varying(k)
    const p = uv().sub(vec2(0.5, 0.5)).mul(2)
    const core = oneMinus(smoothstep(0.0, 1.0, length(p)))
    const white = smoothstep(0.5, 1.0, kv)
    emberMat.colorNode = mix(c3(EMBER_GOLD, 1.6), c3(STAR_WHITE, 1.3), white)
    // an ember is a SPARK, not a bokeh ball: a hot pinpoint with a very
    // short halo (round 1 filled the sky with orange confetti)
    emberMat.opacityNode = pow(core, 4.0)
      .mul(smoothstep(0.0, 0.06, kv))
      .mul(oneMinus(smoothstep(0.55, 1.0, kv)))
      .mul(uFlick)
      .mul(float(0.62).add(uBlaze.mul(0.4)))
      .mul(uR)
  }
  quadField(
    tier(74, 42),
    (i, pos, dat, rnd) => {
      pos[i * 3] = rnd() * TAU
      pos[i * 3 + 1] = 0.06 + rnd() * 0.16
      pos[i * 3 + 2] = 0.16 + rnd() * 0.2
      dat[i * 4] = rnd()
      dat[i * 4 + 1] = 4 + rnd() * 4
      dat[i * 4 + 2] = 0.016 + rnd() * 0.02
      dat[i * 4 + 3] = rnd()
    },
    emberMat,
    55
  ).renderOrder = 9

  // ---- the sparks: quick bright leaps just above the coals ------------
  const sparkMat = new MeshBasicNodeMaterial({
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
  })
  {
    const iPos = attribute('iPos', 'vec3') // ox, oz, speed
    const iDat = attribute('iDat', 'vec4') // phase, wob, size, seed
    const k = fract(uTP.mul(iPos.z).add(iDat.x))
    const c = vec3(
      float(FIRE.x).add(iPos.x.mul(float(0.4).add(k))).add(sin(uTP.mul(iDat.y).add(iDat.w.mul(9))).mul(0.05).mul(k)),
      float(FLOOR_Y + 0.5).add(k.mul(1.5)),
      float(FIRE.z).add(iPos.y.mul(float(0.4).add(k))).add(cos(uT.mul(iDat.y).mul(0.7)).mul(0.05).mul(k))
    )
    sparkMat.vertexNode = bill(c, iDat.z)
    const kv = varying(k)
    const p = uv().sub(vec2(0.5, 0.5)).mul(2)
    const core = oneMinus(smoothstep(0.0, 1.0, length(p)))
    sparkMat.colorNode = c3(lin('#fff0c8'), 1.5)
    sparkMat.opacityNode = pow(core, 4.0)
      .mul(smoothstep(0.0, 0.08, kv))
      .mul(oneMinus(smoothstep(0.5, 1.0, kv)))
      .mul(uFlick)
      .mul(0.75)
      .mul(uR)
  }
  quadField(
    tier(34, 20),
    (i, pos, dat, rnd) => {
      pos[i * 3] = (rnd() - 0.5) * 0.34
      pos[i * 3 + 1] = (rnd() - 0.5) * 0.3
      pos[i * 3 + 2] = 0.5 + rnd() * 0.4
      dat[i * 4] = rnd()
      dat[i * 4 + 1] = 4 + rnd() * 4
      dat[i * 4 + 2] = 0.014 + rnd() * 0.014
      dat[i * 4 + 3] = rnd()
    },
    sparkMat,
    61
  ).renderOrder = 9

  // ---- the smoke: a body for the fire, and the one thing that fills a
  //      phone's empty upper frame. Warm and turbulent at the root where
  //      the heat still owns it, cool and slow by the time it leaves.
  const smokeMat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false })
  {
    const iPos = attribute('iPos', 'vec3') // ox, oz, speed
    const iDat = attribute('iDat', 'vec4') // phase, wob, size0, size1
    const k = fract(uTP.mul(iPos.z).add(iDat.x))
    const sway = sin(uTP.mul(0.31).add(iDat.y).add(k.mul(2.2))).mul(0.22).add(uLean.mul(6.0))
    const c = vec3(
      float(FIRE.x).add(iPos.x).add(sway.mul(k.mul(k))),
      float(FLOOR_Y + 0.62).add(k.mul(2.6)),
      float(FIRE.z).add(iPos.y).add(cos(uT.mul(0.23).add(iDat.y)).mul(0.16).mul(k.mul(k)))
    )
    smokeMat.vertexNode = bill(c, mix(iDat.z, iDat.w, k))
    const kv = varying(k)
    const p = uv().sub(vec2(0.5, 0.5)).mul(2)
    const soft = oneMinus(smoothstep(0.15, 1.0, length(p)))
    const churn = vn(vec3(p.x.mul(1.8), p.y.mul(1.8).sub(uT.mul(0.35)), kv.mul(4.0))).mul(0.6).add(0.45)
    // smoke over a fire is LIT: the first metre is a warm grey the eye can
    // find, and it gives itself back to the night on the way up. Round 3
    // drew navy smoke on a navy sky and nothing arrived.
    smokeMat.colorNode = mix(hex3('#6b4a2c'), c3(SMOKE_COOL), smoothstep(0.02, 0.5, kv)).mul(
      float(1).add(uFlick.mul(0.75).mul(oneMinus(smoothstep(0.0, 0.34, kv))))
    )
    smokeMat.opacityNode = pow(soft, 1.4)
      .mul(churn)
      .mul(smoothstep(0.0, 0.1, kv))
      .mul(oneMinus(smoothstep(0.3, 0.92, kv)))
      .mul(0.4)
      .mul(uR)
  }
  quadField(
    tier(22, 14),
    (i, pos, dat, rnd) => {
      pos[i * 3] = (rnd() - 0.5) * 0.26
      pos[i * 3 + 1] = (rnd() - 0.5) * 0.24
      pos[i * 3 + 2] = 0.11 + rnd() * 0.08
      dat[i * 4] = rnd()
      dat[i * 4 + 1] = rnd() * TAU
      dat[i * 4 + 2] = 0.55 + rnd() * 0.35
      dat[i * 4 + 3] = 2.3 + rnd() * 1.4
    },
    smokeMat,
    67
  ).renderOrder = 6

  // ---- the motes: ash turning slowly in the firelight ------------------
  const moteMat = new MeshBasicNodeMaterial({
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
  })
  {
    const iPos = attribute('iPos', 'vec3') // a0, rad, y0
    const iDat = attribute('iDat', 'vec4') // speed, phase, size, drift
    const ang = iPos.x.add(uTP.mul(iDat.x))
    const y = iPos.z.add(sin(uTP.mul(iDat.w).add(iDat.y.mul(9.0))).mul(0.22))
    const c = vec3(
      float(FIRE.x).add(cos(ang).mul(iPos.y)),
      y,
      float(FIRE.z).add(sin(ang).mul(iPos.y).mul(0.8))
    )
    moteMat.vertexNode = bill(c, iDat.z)
    const p = uv().sub(vec2(0.5, 0.5)).mul(2)
    const core = oneMinus(smoothstep(0.0, 1.0, length(p)))
    const dd = length(c.xz.sub(vec2(FIRE.x, FIRE.z)))
    moteMat.colorNode = c3(EMBER_GOLD, 1.1)
    moteMat.opacityNode = pow(core, 3.2)
      .mul(float(3.0).div(dd.mul(dd).add(2.0)))
      .mul(uFlick)
      .mul(0.34)
      .mul(uR)
  }
  quadField(
    tier(52, 26),
    (i, pos, dat, rnd) => {
      pos[i * 3] = rnd() * TAU
      pos[i * 3 + 1] = 0.9 + Math.pow(rnd(), 0.7) * 2.6
      pos[i * 3 + 2] = FLOOR_Y + 0.15 + rnd() * 1.7
      dat[i * 4] = 0.04 + rnd() * 0.07
      dat[i * 4 + 1] = rnd()
      dat[i * 4 + 2] = 0.014 + rnd() * 0.016
      dat[i * 4 + 3] = 0.12 + rnd() * 0.16
    },
    moteMat,
    73
  ).renderOrder = 8

  // ==================================================================
  // update
  // ==================================================================
  function update(s: AgoraState): void {
    root.visible = s.reveal > 0.01
    if (!root.visible) return

    const r = s.reveal
    const t = s.elapsed
    uT.value = t
    uTP.value = reduced ? t * 0.3 : t
    uR.value = r

    // ONE fire, many flickers: the source stays steady, the light it throws
    // trembles a little more. All motion is sine-woven and deterministic.
    const sp = s.speak ?? 0
    const bz = s.blaze ?? 0
    uBlaze.value = bz
    const fl = reduced
      ? 0.9
      : 0.76 + 0.12 * Math.sin(t * 7.1) + 0.07 * Math.sin(t * 11.7 + 1.3) + 0.05 * Math.sin(t * 19.3 + 4.1)
    uFlick.value = 0.82 + 0.32 * fl
    uFlame.value = r * (0.82 + 0.18 * fl) * (1 + 0.1 * sp) * (1 + 0.28 * bz)
    uLean.value = reduced ? 0.012 : 0.03 * Math.sin(t * 0.42) + 0.015 * Math.sin(t * 1.1 + 2)

    // the flame breathes in scale as well as in noise: deeper while its
    // keeper speaks, and it rises hearth-to-blaze when the council sits
    const breath = reduced
      ? 1
      : 1 + (0.035 + 0.02 * sp) * Math.sin(t * 2.1) + 0.02 * Math.sin(t * 3.7 + 1.1)
    const rise = 1 + 0.42 * bz
    const wide = 1 + 0.16 * bz
    flame.scale.set(FLAME_W * wide, FLAME_H * breath * rise, 1)
    flame.position.y = FLAME_BASE + (FLAME_H * breath * rise) / 2
    tongue.scale.set(TONGUE_W * wide, TONGUE_H * breath * rise, 1)
    tongue.position.y = FLAME_BASE + (TONGUE_H * breath * rise) / 2
    refl.scale.set(REFL_W * wide, REFL_H * breath * rise, 1)
    refl.position.y = 2 * FLOOR_Y - FLAME_BASE - (REFL_H * breath * rise) / 2

    airMat.opacity = r * (0.24 + 0.06 * Math.sin(t * 1.7)) * (1 + 0.4 * bz)
  }

  return { update }
}
