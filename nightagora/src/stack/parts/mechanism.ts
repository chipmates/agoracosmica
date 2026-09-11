/* THE MECHANISM — a wheel, a gear, a rope, a beam.

   Three lines out of the machine-hall verdict, and each of them is one of
   these parts. "Both wheels hover clear of the slab with no shadow." "Wheels
   are plain discs with a hole, no hub, no spokes, no tyre." "The rope is a
   one-pixel gold line." A fourth, from the same page, is the reason the gear
   here is not a cylinder with notches: the one station that would have passed
   on its own was the rolling mill, and what carried it was "cut gear teeth, a
   pinion behind, an iron crank handle".

   So the teeth are involute, computed from a module and a tooth count the way
   a gear is actually specified, and the rope is a swept twisted profile with a
   catenary under it rather than a line with a width. Neither is expensive.
   Both are the difference between a machine and a diagram of one. */

import {
  BufferGeometry,
  CatmullRomCurve3,
  Float32BufferAttribute,
  Group,
  Matrix4,
  Path,
  Shape,
  Vector2,
  Vector3,
} from 'three/webgpu'
import {
  Bench,
  RAD,
  at,
  between,
  body,
  catenary,
  chamfered,
  hand,
  metreBox,
  metreCylinder,
  metreExtrude,
  metreLathe,
  seal,
  weld,
  type Part,
} from './common'

const OAK = 'oak-beams'
const ELM = 'oak-planks-worn'
const IRON = 'iron-forged'
const BRONZE = 'bronze-dark'
const ROPE = 'rope'

/* ── the gear ──────────────────────────────────────────────────────────── */

export interface GearOptions {
  kind?: 'spur' | 'lantern' | 'worm'
  /** the module, in metres: the pitch diameter divided by the tooth count.
      A wooden mill gear runs 0.05 to 0.09; a bronze clock train runs 0.002. */
  module: number
  teeth: number
  thickness: number
  /** the pressure angle, in degrees. Twenty is the modern standard and
      fourteen and a half is the older one; a 1517 gear was cut by eye and
      neither, so the number is declared rather than assumed. */
  pressure?: number
  /** the hole for the shaft */
  bore?: number
  /** arms, for a wheel too large to be a solid web. 0 leaves it solid. */
  arms?: number
  /** a worm's own: how many starts, and how long the screw runs */
  starts?: number
  length?: number
  set?: string
  seed?: number
  lod?: 1 | 2 | 3
}

/**
 * A gear with REAL teeth. The flank is the involute of the base circle,
 * generated from the module and the tooth count, so two gears built from the
 * same module mesh and a frame that shows them meshing is not a lie.
 *
 * The wheel lies in the XY plane with its shaft along z, which is the frame a
 * machine hangs a gear in.
 */
export function gearPart(bench: Bench, o: GearOptions): Part {
  const kind = o.kind ?? 'spur'
  const m = o.module
  const z = Math.max(6, Math.round(o.teeth))
  const t = o.thickness
  const setName = o.set ?? (kind === 'lantern' ? ELM : BRONZE)
  const metal = bench.surface(setName, { roughFloor: kind === 'lantern' ? 0.7 : 0.36 })
  const group = new Group()
  group.name = `${kind} gear, ${z} teeth at module ${m}`
  const r = hand(o.seed ?? 3)

  if (kind === 'worm') {
    return wormPart(bench, o, group, metal, setName)
  }
  if (kind === 'lantern') {
    return lanternPart(bench, o, group, metal, setName, r)
  }

  const shape = involuteShape(m, z, (o.pressure ?? 20) * RAD, (o.lod ?? bench.detail()) >= 2 ? 5 : 3)
  const bore = o.bore ?? m * z * 0.14
  if (bore > 0) shape.holes.push(circleHole(bore / 2, 20))
  const arms = o.arms ?? 0
  if (arms >= 3) {
    /* a wheel of any size is arms and a rim, never a plate: the lightening
       is what a founder cast and what the eye reads as a wheel */
    const rim = (m * z) / 2 - m * 2.2
    const hub = Math.max(bore / 2 + m * 1.2, rim * 0.28)
    for (let i = 0; i < arms; i++) {
      shape.holes.push(armHole((i * 2 * Math.PI) / arms, hub, rim, (Math.PI / arms) * 0.62))
    }
  }
  const geometry = metreExtrude(shape, t, 8)
  geometry.translate(0, 0, -t / 2)
  group.add(body(geometry, metal, 'the wheel'))

  return seal(
    group,
    'gear',
    `a spur gear, ${z} teeth at module ${m} m, pitch diameter ${round(m * z)} m`,
    [setName]
  )
}

/** the involute of the base circle: the one curve that makes two wheels turn
    each other at a constant ratio however far apart their centres drift */
function involuteShape(m: number, z: number, alpha: number, steps: number): Shape {
  const rp = (m * z) / 2
  const rb = rp * Math.cos(alpha)
  const ra = rp + m
  const rf = Math.max(rp - 1.25 * m, rb * 0.55)
  const invA = Math.tan(alpha) - alpha
  const halfAt = (radius: number): number => {
    const rr = Math.max(radius, rb + 1e-9)
    const a = Math.acos(Math.min(1, rb / rr))
    return Math.PI / (2 * z) + invA - (Math.tan(a) - a)
  }
  const shape = new Shape()
  const put = (radius: number, angle: number, first: boolean): void => {
    const x = radius * Math.cos(angle)
    const y = radius * Math.sin(angle)
    if (first) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  }
  const start = Math.max(rb, rf)
  for (let k = 0; k < z; k++) {
    const base = (k * 2 * Math.PI) / z
    /* the midpoint of the space before this tooth, on the root circle */
    put(rf, base - Math.PI / z, k === 0)
    if (rf < rb) put(rf, base - halfAt(rb), false)
    for (let i = 0; i <= steps; i++) {
      const radius = start + ((ra - start) * i) / steps
      put(radius, base - halfAt(radius), false)
    }
    /* across the tip, which is an arc and not a chord */
    const tip = halfAt(ra)
    for (let i = 1; i < 3; i++) put(ra, base - tip + (2 * tip * i) / 3, false)
    for (let i = steps; i >= 0; i--) {
      const radius = start + ((ra - start) * i) / steps
      put(radius, base + halfAt(radius), false)
    }
    if (rf < rb) put(rf, base + halfAt(rb), false)
  }
  shape.closePath()
  return shape
}

function circleHole(radius: number, steps: number): Path {
  const path = new Shape()
  for (let i = 0; i <= steps; i++) {
    const a = (i * 2 * Math.PI) / steps
    const x = radius * Math.cos(a)
    const y = radius * Math.sin(a)
    if (i === 0) path.moveTo(x, y)
    else path.lineTo(x, y)
  }
  path.closePath()
  return path
}

/** one of the openings between a wheel's arms */
function armHole(centre: number, inner: number, outer: number, half: number): Path {
  const path = new Shape()
  const steps = 6
  for (let i = 0; i <= steps; i++) {
    const a = centre - half + (2 * half * i) / steps
    path[i === 0 ? 'moveTo' : 'lineTo'](inner * Math.cos(a), inner * Math.sin(a))
  }
  for (let i = steps; i >= 0; i--) {
    const a = centre - half + (2 * half * i) / steps
    path.lineTo(outer * Math.cos(a), outer * Math.sin(a))
  }
  path.closePath()
  return path
}

/**
 * A LANTERN PINION: two discs with round staves between them, which is the
 * pinion a mill and a clock of 1517 actually used, because a turner can make
 * one and a gear cutter cannot be had.
 */
function lanternPart(
  bench: Bench,
  o: GearOptions,
  group: Group,
  metal: ReturnType<Bench['surface']>,
  setName: string,
  r: () => number
): Part {
  const z = Math.max(4, Math.round(o.teeth))
  const rp = (o.module * z) / 2
  const t = o.thickness
  const stave = o.module * 0.55
  const pieces: BufferGeometry[] = []
  for (const end of [-1, 1] as const) {
    /* the discs stop just inside the stave circle, so the staves stand proud
       at the rim: a lantern pinion whose discs cover its staves is a plain
       wooden wheel and reads as one */
    pieces.push(
      at(metreCylinder(rp - stave * 0.25, rp - stave * 0.25, t * 0.14, 22), [0, 0, (end * t) / 2], [
        Math.PI / 2,
        0,
        0,
      ])
    )
  }
  for (let i = 0; i < z; i++) {
    const a = (i * 2 * Math.PI) / z
    pieces.push(
      at(metreCylinder(stave, stave, t, 8), [rp * Math.cos(a), rp * Math.sin(a), 0], [
        Math.PI / 2,
        between(r, 0, 6.2),
        0,
      ])
    )
  }
  const bore = o.bore ?? rp * 0.3
  if (bore > 0) {
    const iron = bench.surface(IRON, { roughFloor: 0.42 })
    group.add(
      body(
        at(metreCylinder(bore / 2, bore / 2, t * 1.6, 12), [0, 0, 0], [Math.PI / 2, 0, 0]),
        iron,
        'the shaft'
      )
    )
  }
  group.add(body(weld(pieces), metal, 'discs and staves'))
  return seal(group, 'gear', `a lantern pinion, ${z} staves on a ${round(2 * rp)} m circle`, [
    setName,
    IRON,
  ])
}

/**
 * A WORM: one thread wrapped round a shaft. Built as a swept surface rather
 * than as a stack of discs, so the thread runs continuously and the flank is
 * a real helicoid.
 */
function wormPart(
  bench: Bench,
  o: GearOptions,
  group: Group,
  metal: ReturnType<Bench['surface']>,
  setName: string
): Part {
  const m = o.module
  const starts = o.starts ?? 1
  const length = o.length ?? m * 10
  const core = m * 1.5
  const crest = core + m
  const lead = Math.PI * m * starts
  const turns = length / lead
  const along = Math.max(24, Math.round(turns * 26))
  const around = 18
  const position: number[] = []
  const uvs: number[] = []
  const index: number[] = []
  for (let i = 0; i <= along; i++) {
    const s = (i / along) * length - length / 2
    const phase = (s / lead) * 2 * Math.PI
    for (let j = 0; j <= around; j++) {
      const th = (j / around) * 2 * Math.PI
      /* the thread: ONE rounded ridge per start, travelling round the shaft
         once every lead. The angle has to be wrapped into a single turn or
         the cosine changes sign along the shaft and half the screw comes out
         as a plain cylinder, which is what the first frame of this showed. */
      const raw = ((th * starts - phase) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI
      const w = Math.pow(Math.max(0, Math.cos(raw * 0.5)), 7)
      const rr = core + (crest - core) * w
      position.push(rr * Math.cos(th), rr * Math.sin(th), s)
      uvs.push(th * crest, s)
    }
  }
  for (let i = 0; i < along; i++) {
    for (let j = 0; j < around; j++) {
      const a = i * (around + 1) + j
      const b = a + around + 1
      index.push(a, a + 1, b, b, a + 1, b + 1)
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(position, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  geometry.setIndex(index)
  geometry.computeVertexNormals()
  const shaft = at(metreCylinder(core * 0.9, core * 0.9, length * 1.4, 14), [0, 0, 0], [Math.PI / 2, 0, 0])
  group.add(body(weld([geometry, shaft]), metal, 'the screw'))
  return seal(
    group,
    'gear',
    `a ${starts}-start worm, module ${m} m, ${round(length)} m of screw`,
    [setName]
  )
}

/* ── the wheel ─────────────────────────────────────────────────────────── */

export interface WheelOptions {
  /** over the tyre, in metres. A cart wheel runs 1.2 to 1.6; a gun carriage
      wheel runs about 1.2; a barrow wheel runs 0.6. */
  diameter: number
  spokes?: number
  /** the tread's width */
  width?: number
  /** the iron tyre's thickness */
  tyre?: number
  /** how far the spokes are dished out of the wheel's plane, in degrees */
  dish?: number
  nave?: { length?: number; diameter?: number }
  sets?: { felloe?: string; spoke?: string; nave?: string; iron?: string }
  seed?: number
  lod?: 1 | 2 | 3
}

/**
 * A SPOKED CART WHEEL: a turned nave, tapered spokes set into it, felloes cut
 * to the arc, and the iron tyre shrunk on over all of it. The wheel lies in
 * the XY plane with its axle along z and its origin at the middle of the
 * nave, so a carriage sets it on an axle and it stands on the ground at
 * y = -diameter/2 by arithmetic rather than by eye.
 */
export function wheelPart(bench: Bench, o: WheelOptions): Part {
  const R = o.diameter / 2
  const spokes = o.spokes ?? 12
  const width = o.width ?? 0.075
  const tyreT = o.tyre ?? 0.014
  const dish = (o.dish ?? 4) * RAD
  const sets = o.sets ?? {}
  const r = hand(o.seed ?? 61)
  const lod = o.lod ?? bench.detail()
  const group = new Group()
  group.name = `wheel ${o.diameter} m`

  const felloeSet = sets.felloe ?? ELM
  const spokeSet = sets.spoke ?? OAK
  const naveSet = sets.nave ?? ELM
  const ironSet = sets.iron ?? IRON
  const felloeMat = bench.surface(felloeSet, { roughFloor: 0.72 })
  const spokeMat = bench.surface(spokeSet, { roughFloor: 0.74 })
  const naveMat = bench.surface(naveSet, { roughFloor: 0.72 })
  const iron = bench.surface(ironSet, { roughFloor: 0.44 })

  /* THE NAVE, turned: a barrel with a shoulder at each end where the iron
     bands are driven on, and the bore through it */
  const naveL = o.nave?.length ?? R * 0.38
  const naveR = (o.nave?.diameter ?? R * 0.34) / 2
  const profile: Vector2[] = [
    new Vector2(naveR * 0.42, -naveL / 2),
    new Vector2(naveR * 0.86, -naveL / 2),
    new Vector2(naveR * 0.9, -naveL * 0.36),
    new Vector2(naveR, -naveL * 0.18),
    new Vector2(naveR, naveL * 0.18),
    new Vector2(naveR * 0.9, naveL * 0.36),
    new Vector2(naveR * 0.86, naveL / 2),
    new Vector2(naveR * 0.42, naveL / 2),
  ]
  const nave = metreLathe(profile, lod >= 2 ? 20 : 12)
  nave.rotateX(Math.PI / 2)
  group.add(body(nave, naveMat, 'nave'))
  const bands: BufferGeometry[] = []
  for (const end of [-1, 1] as const) {
    bands.push(
      at(metreCylinder(naveR * 0.92, naveR * 0.92, naveL * 0.14, 16), [0, 0, end * naveL * 0.42], [
        Math.PI / 2,
        0,
        0,
      ])
    )
  }
  group.add(body(weld(bands), iron, 'nave bands'))

  /* THE FELLOES. A rim is not a ring: it is six or seven curved blocks, each
     one carrying two spokes, with a joint between every pair. The joints are
     what stops the rim reading as a torus. */
  const felloeCount = Math.max(3, Math.round(spokes / 2))
  const inner = R - tyreT - 0.075
  const outer = R - tyreT
  const rim: BufferGeometry[] = []
  for (let i = 0; i < felloeCount; i++) {
    const mid = (i * 2 * Math.PI) / felloeCount
    const half = Math.PI / felloeCount - 0.014
    /* counter-clockwise, outer arc first: a felloe wound the other way is a
       block lit from inside itself */
    const shape = new Shape()
    const steps = lod >= 2 ? 7 : 4
    for (let k = 0; k <= steps; k++) {
      const a = mid - half + (2 * half * k) / steps
      shape[k === 0 ? 'moveTo' : 'lineTo'](outer * Math.cos(a), outer * Math.sin(a))
    }
    for (let k = steps; k >= 0; k--) {
      const a = mid - half + (2 * half * k) / steps
      shape.lineTo(inner * Math.cos(a), inner * Math.sin(a))
    }
    shape.closePath()
    const block = metreExtrude(shape, width, 4)
    block.translate(0, 0, -width / 2)
    rim.push(block)
  }
  group.add(body(weld(rim), felloeMat, 'felloes'))

  /* THE TYRE, shrunk on: one iron hoop over the whole rim, standing a hair
     proud of it, which is what a wheel runs on and what the frame reads as
     the wheel's edge */
  const tyre = metreCylinder(R, R, width * 0.94, lod >= 2 ? 40 : 24, 1, true)
  tyre.rotateX(Math.PI / 2)
  group.add(body(tyre, iron, 'tyre'))

  /* THE SPOKES, tapered and dished. Every one is a little out of true, which
     is what a wheelwright's wheel is and a lathe's is not. */
  const arms: BufferGeometry[] = []
  for (let i = 0; i < spokes; i++) {
    const a = (i * 2 * Math.PI) / spokes + between(r, -0.012, 0.012)
    const run = inner - naveR * 0.86
    const spoke = metreCylinder(0.021, 0.033, run, 6)
    spoke.rotateZ(-Math.PI / 2)
    spoke.translate(naveR * 0.86 + run / 2, 0, 0)
    at(spoke, [0, 0, 0], [0, 0, a])
    /* the dish: the spokes lean out of the wheel's plane, alternately, which
       is how a wheel takes a side load without collapsing */
    const lean = (i % 2 ? 1 : -1) * dish
    spoke.applyMatrix4(dishMatrix(a, lean))
    arms.push(spoke)
  }
  group.add(body(weld(arms), spokeMat, 'spokes'))

  return seal(group, 'wheel', `a ${spokes}-spoke wheel, ${o.diameter} m over the tyre`, [
    felloeSet,
    spokeSet,
    naveSet,
    ironSet,
  ])
}

/** the dish: a rotation about the spoke's own radial line, which is how a
    wheelwright leans the spokes out of the wheel's plane */
function dishMatrix(angle: number, lean: number): Matrix4 {
  return new Matrix4().makeRotationAxis(new Vector3(Math.cos(angle), Math.sin(angle), 0), lean)
}

/* ── the rope ──────────────────────────────────────────────────────────── */

export interface RopeOptions {
  /** the rope's own radius, in metres. A hand line is 0.006; a hoisting rope
      is 0.018; a crane fall is 0.03. */
  radius?: number
  /** how many strands are laid up in it. Three is a hawser. */
  strands?: number
  /** metres of rope per full turn of the lay. A real rope lays up at about
      seven times its own diameter. */
  lay?: number
  /** how many sides the section is drawn with */
  sides?: number
  set?: string
  seed?: number
  lod?: 1 | 2 | 3
}

/**
 * A ROPE: a twisted profile swept along a curve. "The rope is a one-pixel gold
 * line", "the harness ropes are sub-pixel hairlines" — a rope drawn as a line
 * has no radius, so it vanishes at the first mip and reappears as aliasing.
 * This one has a section, a lay that turns along its length, and a uv that
 * runs in metres so the library's own rope photograph lands at its own scale.
 */
export function ropePart(bench: Bench, path: Vector3[], o: RopeOptions = {}): Part {
  const R = o.radius ?? 0.014
  const strands = o.strands ?? 3
  const lay = o.lay ?? R * 14
  const lod = o.lod ?? bench.detail()
  const sides = o.sides ?? (lod >= 2 ? 12 : 8)
  const setName = o.set ?? ROPE
  if (path.length < 2) throw new Error('a rope needs at least two points')
  const curve = new CatmullRomCurve3(path, false, 'catmullrom', 0.4)
  const total = curve.getLength()
  const steps = Math.max(8, Math.round(total / Math.max(0.02, lay / 6)))
  const frames = curve.computeFrenetFrames(steps, false)
  const position: number[] = []
  const uvs: number[] = []
  const index: number[] = []
  for (let i = 0; i <= steps; i++) {
    const s = (i / steps) * total
    const p = curve.getPointAt(i / steps)
    const N = frames.normals[i] as Vector3
    const B = frames.binormals[i] as Vector3
    const twist = (s / lay) * 2 * Math.PI
    for (let j = 0; j <= sides; j++) {
      const th = (j / sides) * 2 * Math.PI
      /* the lay: the section is not a circle, it is `strands` lobes, and the
         lobes travel along the rope. That travel is the whole read. */
      const bulge = 1 + 0.2 * Math.cos(strands * (th + twist))
      const rr = R * bulge
      position.push(
        p.x + (N.x * Math.cos(th) + B.x * Math.sin(th)) * rr,
        p.y + (N.y * Math.cos(th) + B.y * Math.sin(th)) * rr,
        p.z + (N.z * Math.cos(th) + B.z * Math.sin(th)) * rr
      )
      uvs.push(th * R, s)
    }
  }
  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < sides; j++) {
      const a = i * (sides + 1) + j
      const b = a + sides + 1
      index.push(a, a + 1, b, b, a + 1, b + 1)
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(position, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  geometry.setIndex(index)
  geometry.computeVertexNormals()
  const group = new Group()
  group.add(body(geometry, bench.surface(setName, { roughFloor: 0.82 }), 'rope'))
  return seal(
    group,
    'rope',
    `${round(total)} m of ${strands}-strand rope at ${Math.round(R * 2000)} mm`,
    [setName]
  )
}

/** the same rope, hung between two points under its own weight */
export function hangRope(
  bench: Bench,
  a: [number, number, number],
  b: [number, number, number],
  slack = 1.06,
  o: RopeOptions = {}
): Part {
  return ropePart(bench, catenary(a, b, slack, 26), o)
}

/* ── the beam ──────────────────────────────────────────────────────────── */

export interface BeamOptions {
  length: number
  /** the squared section, in metres. A Loire tie beam runs 0.24 by 0.20. */
  width?: number
  depth?: number
  /** how much is taken off each arris. A hewn beam has a big one. */
  chamfer?: number
  /** oak pegs through it, at both ends */
  pegs?: boolean
  /** a tenon on each end, for a beam that goes into something */
  tenon?: number
  set?: string
  seed?: number
}

/**
 * A SQUARED OAK BEAM, running along x from its own middle. The library's own
 * beam set is turned so its grain runs along the beam, which is what the
 * material stage measured and wrote into the manifest; laid on a wall it
 * reads as staves, and laid on this it reads as timber.
 */
export function beamPart(bench: Bench, o: BeamOptions): Part {
  const L = o.length
  const w = o.width ?? 0.22
  const d = o.depth ?? 0.2
  const chamfer = o.chamfer ?? 0.018
  const setName = o.set ?? OAK
  const r = hand(o.seed ?? 97)
  const group = new Group()
  group.name = `beam ${L} m`
  const oak = bench.surface(setName, { roughFloor: 0.76 })

  const geometry = metreExtrude(chamfered(w, d, chamfer), L)
  geometry.rotateY(-Math.PI / 2)
  geometry.translate(L / 2, 0, 0)
  const pieces = [geometry]
  if (o.tenon) {
    for (const end of [-1, 1] as const) {
      pieces.push(
        at(metreBox(o.tenon, d * 0.42, w * 0.38), [end * (L / 2 + o.tenon / 2 - 0.002), 0, 0])
      )
    }
  }
  group.add(body(weld(pieces), oak, 'the beam'))

  if (o.pegs !== false) {
    const peg = bench.surface(ELM, { roughFloor: 0.78 })
    const pegs: BufferGeometry[] = []
    for (const end of [-1, 1] as const) {
      pegs.push(
        at(metreCylinder(0.014, 0.014, d * 1.12, 7), [
          end * (L / 2 - between(r, 0.14, 0.2)),
          0,
          0,
        ])
      )
    }
    group.add(body(weld(pegs), peg, 'pegs'))
  }

  return seal(group, 'beam', `${L} m of oak, ${w} by ${d} m squared`, [setName, ELM])
}

function round(v: number): number {
  return Math.round(v * 100) / 100
}
