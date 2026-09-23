/* MOSS AT THE DAMP FEET OF THINGS.

   A house forty-six years old in a river valley keeps moss where water stays:
   at the foot of its walls, most on the north feet the sun never dries, in
   the back corners of stair treads where the riser shades them, and in the
   joints of paving near the walls of a court the sun cannot reach. It grows
   in low cushions, a few centimetres across, in patches with bare stone
   between them. Positions and amounts are this exhibition's reading of the
   damp, never a record; the moss is a type. */
import { BufferGeometry, DoubleSide, Float32BufferAttribute, Group, Mesh, MeshStandardNodeMaterial } from 'three/webgpu'
import { cameraViewMatrix, float, mix, mx_noise_float, normalWorldGeometry, positionWorld, smoothstep, vec3 } from 'three/tsl'
import { reliefNormal } from '../../stack/detail'
import type { TierName } from '../../stack/tier'
import { anisotropicFootprint } from './masonry-courses'
import { floorAt, terrainSteps } from './terrain-mesh'
import { drawnFaces, GRAVE_FLOOR, GRAVE_FLOOR_RISE, type Catcher } from './ground-walls'
import { stageWeight } from './leaf-litter'
import { mulberry } from './tree-growth'
import { pebble, type Emit, type V3 } from './pebbles'
import { COLLECTION_PAVING_ORIGIN, COURT, GRAVE_ORIGIN, LINE_SLAB, SUPPER_WALL } from './collection/layout'
import { COURT_GROUND, GALLERY } from './collection/rooms'

export const mossProvenance = {
  manifestId: 'vinci/moss',
  assetClass: 'GENERATED',
  certainty: 'conjectural',
  recipe: 'Low moss cushions 30 to 120 mm across, in patches along the foot of every wall and retaining face a stop sees, most on the north feet and inside the grave court, sparse in the back corners of stair treads; thin strips of moss in the court paving joints within five metres of its walls. Colour and relief from a recipe in code. Positions and amounts are an exhibition reading of the damp, not a record.',
} as const

/** moss greens, damp to dry, in linear reflectance 0.04 to 0.2 */
const GREENS: readonly V3[] = ['#4b5a2d', '#566630', '#617036', '#3f4b27', '#6e7a3b', '#7a7f45', '#566138'].map(hex => {
  const n = parseInt(hex.slice(1), 16)
  const c = (v: number): number => { const s = v / 255; return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4 }
  return [c((n >> 16) & 255), c((n >> 8) & 255), c(n & 255)] as V3
})

interface Batch { position: number[]; normal: number[]; colour: number[] }
const batch = (): Batch => ({ position: [], normal: [], colour: [] })
const into = (b: Batch): Emit => (a, c, d, na, nc, nd, colour) => {
  for (const [p, q] of [[a, na], [c, nc], [d, nd]] as const) {
    b.position.push(p[0], p[1], p[2]); b.normal.push(q[0], q[1], q[2]); b.colour.push(colour[0], colour[1], colour[2])
  }
}

/** the made floor of the insertion's court (the grave's own floor a little
    over its paving), or the ground's own */
function groundAt(e: number, n: number): number {
  for (const g of COURT_GROUND) if (e > g.west && e < g.east && n > g.south && n < g.north)
    return COURT.level + (e > GRAVE_FLOOR.west && e < GRAVE_FLOOR.east && n > GRAVE_FLOOR.south && n < GRAVE_FLOOR.north ? GRAVE_FLOOR_RISE : 0)
  return floorAt(e, n)
}
const inCourt = (e: number, n: number): boolean => COURT_GROUND.some(g => e > g.west && e < g.east && n > g.south && n < g.north)
/** A step in the grade is a face only where its foot is the grade itself:
    under the court's paving and the museum's floors it is buried. */
function exposed(s: { from: readonly number[]; to: readonly number[]; low: readonly number[]; lowLevel: number }): boolean {
  const m: [number, number] = [(s.from[0]! + s.to[0]!) / 2, (s.from[1]! + s.to[1]!) / 2]
  const under = COURT_GROUND.some(g => m[0] > g.west - .6 && m[0] < g.east + .6 && m[1] > g.south - .6 && m[1] < g.north + .6)
  return !under && Math.abs(groundAt(m[0] + s.low[0]! * .15, m[1] + s.low[1]! * .15) - s.lowLevel) < .08
}

export function createMoss(tier: TierName): Group {
  const group = new Group()
  group.name = 'vinci generated moss'
  group.userData = { ...mossProvenance }
  const calm = tier === 'calm'
  const keep = tier === 'hero' ? 1 : tier === 'standard' ? .45 : .2
  const cushions = batch()
  const emit = into(cushions)
  const random = mulberry(15171031)
  let laid = 0
  const colourAt = (dry: number): V3 => {
    const c = GREENS[Math.floor(random() * GREENS.length)]!, k = .85 + random() * .3
    return [c[0] * k * (1 + dry * .25), c[1] * k * (1 + dry * .12), c[2] * k]
  }
  /** a patch of cushions hugging a face's foot */
  const patch = (e: number, n: number, low: readonly [number, number], radius: number, damp: number): void => {
    const count = 2 + Math.floor(random() * 6)
    for (let k = 0; k < count; k++) {
      const a = random() * Math.PI * 2, r = Math.sqrt(random()) * radius
      // a patch grows along the wall more than out from it
      const alongE = -low[1], alongN = low[0]
      const u = Math.cos(a) * r * 1.6, v = Math.abs(Math.sin(a)) * r * .6
      const pe = e + alongE * u + low[0] * v, pn = n + alongN * u + low[1] * v
      const size = .03 + random() * random() * .09
      if (pebble(emit, groundAt, pe, pn, size, .16 + random() * .14, random() * Math.PI, calm ? 4 : 5, size * .02,
        colourAt(1 - damp), random)) laid++
    }
  }

  // ─── the foot of every wall and retaining face a stop sees ─────────────
  const faces: Catcher[] = [...drawnFaces(), ...terrainSteps().filter(s => s.height >= .3 && exposed(s))
    .map(s => ({ from: s.from as [number, number], to: s.to as [number, number], low: s.low as [number, number], height: s.height }))]
  for (const f of faces) {
    const dx = f.to[0] - f.from[0], dn = f.to[1] - f.from[1], span = Math.hypot(dx, dn)
    if (span < .1) continue
    const mid: [number, number] = [(f.from[0] + f.to[0]) / 2, (f.from[1] + f.to[1]) / 2]
    const stage = stageWeight(mid[0], mid[1])
    if (stage <= .05) continue
    // a foot facing north stays damp; the grave court is in shade all day;
    // a house's own foot takes the splash off its roof on every side
    const house = f.height >= 5.5 && !inCourt(mid[0], mid[1])
    const damp = inCourt(mid[0], mid[1]) ? .9 : Math.max(house ? .6 : 0, .25 + .75 * Math.max(0, f.low[1]))
    const patches = Math.round(span * 1.6 * damp * stage * keep)
    for (let k = 0; k < patches; k++) {
      // the corners where two faces meet hold the wet longest
      const u = random(), t = u < .35 ? (random() < .5 ? random() * .12 : 1 - random() * .12) : random()
      const off = .015 + random() * random() * .12
      patch(f.from[0] + dx * t + f.low[0] * off, f.from[1] + dn * t + f.low[1] * off, f.low, .05 + random() * .12, damp)
    }
  }

  // ─── the back corners of stair treads, under the riser's shade ─────────
  for (const s of terrainSteps()) {
    if (s.height >= .3 || s.height < .08 || !exposed(s)) continue
    const dx = s.to[0] - s.from[0], dn = s.to[1] - s.from[1], span = Math.hypot(dx, dn)
    const mid: [number, number] = [(s.from[0] + s.to[0]) / 2, (s.from[1] + s.to[1]) / 2]
    const stage = stageWeight(mid[0], mid[1])
    if (stage <= .05 || span < .1) continue
    const damp = .3 + .7 * Math.max(0, s.low[1])
    // the ends of a tread, against its cheeks, keep the most
    for (const end of [0, 1]) {
      if (random() > .55 * damp * stage * keep) continue
      const t = end === 0 ? random() * .12 : 1 - random() * .12
      patch(s.from[0] + dx * t + s.low[0] * .03, s.from[1] + dn * t + s.low[1] * .03, s.low as [number, number], .04 + random() * .05, damp)
    }
  }

  // ─── the joints of the court's paving near its walls ───────────────────
  const strips = batch()
  // moss in a joint keeps wet longest and stays the brightest green
  const jointMoss = (): V3 => { const c = colourAt(0); return [c[0] * 1.35, c[1] * 1.45, c[2] * 1.15] }
  if (!calm) {
    const walls = [
      (e: number, n: number): number => Math.abs(e - GALLERY.backKerb),
      (e: number, n: number): number => Math.abs(n - GALLERY.northKerb) + (e > GALLERY.returnEast ? 99 : 0),
      (e: number, n: number): number => Math.hypot(Math.max(0, Math.abs(e - SUPPER_WALL.east) - SUPPER_WALL.thickness / 2),
        Math.max(0, Math.abs(n - SUPPER_WALL.north) - SUPPER_WALL.length / 2)),
    ]
    const nearWall = (e: number, n: number): number => Math.min(...walls.map(w => w(e, n)))
    const ribbon = (a: [number, number], b: [number, number], width: number, colour: V3): void => {
      const dx = b[0] - a[0], dn = b[1] - a[1], span = Math.hypot(dx, dn), px = -dn / span, pn = dx / span
      const steps = Math.max(1, Math.round(span / .05))
      // the moss fills its joint and creeps a little over the edges, its
      // width wandering smoothly, thinning out at both ends
      const phase = random() * 6.28, phase2 = random() * 6.28
      const half = (t: number): number => width * (.55 + .3 * Math.sin(t * span * 9 + phase) + .15 * Math.sin(t * span * 23 + phase2)) *
        Math.min(1, t * span / .12, (1 - t) * span / .12)
      const p = (t: number, side: number): V3 => {
        const w = half(t) * side, e = a[0] + dx * t + px * w, n = a[1] + dn * t + pn * w
        return [e, groundAt(e, n) + .0025, -n]
      }
      const up: V3 = [0, 1, 0]
      for (let i = 0; i < steps; i++) {
        const t0 = i / steps, t1 = (i + 1) / steps
        const q0 = p(t0, -1), q1 = p(t1, -1), q2 = p(t1, 1), q3 = p(t0, 1)
        into(strips)(q0, q2, q1, up, up, up, colour); into(strips)(q0, q3, q2, up, up, up, colour)
      }
    }
    const lay = (a: [number, number], b: [number, number]): void => {
      const m: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
      // every joint of a court the sun cannot reach holds a little moss; the
      // joints nearer the damp walls hold the most
      const p = .28 + .62 * Math.exp(-nearWall(m[0], m[1]) / 2.4)
      if (random() > p) return
      // a strip runs part of a joint
      const share = .35 + random() * .65, start = random() * (1 - share)
      ribbon([a[0] + (b[0] - a[0]) * start, a[1] + (b[1] - a[1]) * start],
        [a[0] + (b[0] - a[0]) * (start + share), a[1] + (b[1] - a[1]) * (start + share)], .006 + random() * .006, jointMoss())
    }
    // the grave's own floor: 1.8 by 1.4 m slabs in running bond, its rows
    // along the court's length, mounted at the grave's origin
    const grave = { west: GRAVE_ORIGIN.east - 4, east: GRAVE_ORIGIN.east + 9, south: GRAVE_ORIGIN.north - 6, north: GRAVE_ORIGIN.north + 6 }
    for (let row = 0; row < Math.ceil(13 / 1.4); row++) {
      const e0 = grave.west + row * 1.4, e1 = Math.min(grave.east, e0 + 1.4)
      if (row > 0) lay([e0, grave.south], [e0, grave.north])
      const offset = row % 2 === 0 ? 0 : .9
      for (let col = -5; col <= 5; col++) {
        const n = GRAVE_ORIGIN.north + col * 1.8 + offset
        if (n > grave.south + .05 && n < grave.north - .05) lay([e0, n], [e1, n])
      }
    }
    // the rest of the court's paving: the museum's own 1.60 by 1.65 m grid
    const outside = (e: number, n: number): boolean => !(e > grave.west && e < grave.east && n > grave.south && n < grave.north)
    for (const g of COURT_GROUND) {
      const e0 = Math.ceil((g.west - COLLECTION_PAVING_ORIGIN.east) / LINE_SLAB.pitchEast)
      const e1 = Math.floor((g.east - COLLECTION_PAVING_ORIGIN.east) / LINE_SLAB.pitchEast)
      const n0 = Math.ceil((g.south - COLLECTION_PAVING_ORIGIN.north) / LINE_SLAB.pitchNorth)
      const n1 = Math.floor((g.north - COLLECTION_PAVING_ORIGIN.north) / LINE_SLAB.pitchNorth)
      const joint = (a: [number, number], b: [number, number]): void => { if (outside((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)) lay(a, b) }
      for (let i = e0; i <= e1; i++) {
        const e = COLLECTION_PAVING_ORIGIN.east + i * LINE_SLAB.pitchEast
        for (let j = n0; j < n1; j++) joint([e, COLLECTION_PAVING_ORIGIN.north + j * LINE_SLAB.pitchNorth], [e, COLLECTION_PAVING_ORIGIN.north + (j + 1) * LINE_SLAB.pitchNorth])
      }
      for (let j = n0; j <= n1; j++) {
        const n = COLLECTION_PAVING_ORIGIN.north + j * LINE_SLAB.pitchNorth
        for (let i = e0; i < e1; i++) joint([COLLECTION_PAVING_ORIGIN.east + i * LINE_SLAB.pitchEast, n], [COLLECTION_PAVING_ORIGIN.east + (i + 1) * LINE_SLAB.pitchEast, n])
      }
    }
  }

  const material = mossMaterial()
  for (const [b, name] of [[cushions, 'vinci generated moss cushions'], [strips, 'vinci generated moss in the court joints']] as const) {
    if (!b.position.length) continue
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(b.position, 3))
    geometry.setAttribute('normal', new Float32BufferAttribute(b.normal, 3))
    geometry.setAttribute('color', new Float32BufferAttribute(b.colour, 3))
    geometry.computeBoundingSphere()
    const mesh = new Mesh(geometry, material)
    mesh.name = name
    mesh.receiveShadow = true
    mesh.castShadow = false
    mesh.userData = { manifestId: mossProvenance.manifestId, labelOccluder: false }
    group.add(mesh)
  }
  group.userData['cushions'] = laid
  return group
}

/** Moss is a felt of fine shoots: its colour breaks up at a few millimetres
    and its surface is rough and matt. Filtered by its own resolution. */
function mossMaterial(): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial({ vertexColors: true, roughness: .97, side: DoubleSide })
  const P = positionWorld, pixel = anisotropicFootprint(P)
  const shows = (metres: number) => smoothstep(1.2, 3, float(metres).div(pixel))
  const shoots = mx_noise_float(P.mul(260)).mul(shows(.004))
  const tufts = mx_noise_float(P.mul(48).add(vec3(3.1, 7.7, 1.9))).mul(shows(.02))
  m.colorNode = vec3(1, 1, 1).mul(shoots.mul(.22).add(1)).mul(mix(float(.86), float(1.1), tufts.mul(.5).add(.5)))
  // the felt's relief from its own height: the cushions carry no map coordinates
  m.normalNode = reliefNormal(normalWorldGeometry.transformDirection(cameraViewMatrix), shoots.mul(.0008).add(tufts.mul(.002)), .35)
  m.name = 'vinci generated moss'
  m.userData = { ...mossProvenance }
  return m
}
