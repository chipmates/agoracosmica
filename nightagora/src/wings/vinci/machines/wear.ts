/** WEAR IS A LOOK, NOT A CLAIM. Where a machine was used, its surface shows
 * it: damp timber below a water line, green where it stays wet, a hand's
 * polish on a grip. The dossier records what the machine is; this is dressing
 * over it, so it lives here and not in the record. It is baked into vertex
 * colours as a multiplier of at most one per channel, so a renderer that bakes
 * or exports the surface keeps it. A line that must read crisp is given
 * vertices of its own by cutting the surface along it. */
import { Float32BufferAttribute, Matrix3, Matrix4, Vector3, type BufferGeometry } from 'three/webgpu'

type Tint = readonly [number, number, number]
interface Cut {
  /** The cutting planes' normal, in the machine's frame. */
  normal: readonly [number, number, number]
  /** Where the planes stand along that normal, in metres. */
  at: readonly number[]
  /** Only faces turned this way are cut, where no other face is seen. */
  facing?: readonly [number, number, number]
}
export interface WearRule {
  parts(id: string): boolean
  cuts: readonly Cut[]
  /** The multiplier at a point and normal in the machine's rest frame; the
   * point in the part's own frame beside it. */
  tint(p: Vector3, n: Vector3, local: Vector3): Tint
}

const ONE: Tint = [1, 1, 1]
const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
const mix = (a: Tint, b: Tint, t: number): Tint => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
const range = (from: number, to: number, step: number): number[] => {
  const out: number[] = []
  for (let v = from; v <= to + 1e-9; v += step) out.push(Math.round(v * 1e6) / 1e6)
  return out
}

/** A timber box that held water: its inside damp to a line, a dark line of
 * scum at the water's edge, a paler margin drying above it; silt settled
 * along the foot of the walls; outside, green creeping up from the floor. */
interface Trough {
  x: number; z0: number; z1: number
  floor: number; rim: number; tide: number
  damp: Tint; scum: Tint; silt: Tint; green: Tint
}
function troughTint(t: Trough, p: Vector3, n: Vector3): Tint {
  const qx = p.x + n.x * .01, qy = p.y + n.y * .01, qz = p.z + n.z * .01
  const inside = Math.abs(qx) <= t.x && qz >= t.z0 && qz <= t.z1 && qy < t.rim - .001 && qy > t.floor - .002
  if (!inside) {
    // outside, the foot of a board stays wet longest
    if (p.y > t.floor + .06 || n.y > .5) return ONE
    return mix(t.green, ONE, smooth(t.floor - .01, t.floor + .06, p.y))
  }
  if (p.y > t.tide + .004) return mix([.8, .81, .76], ONE, smooth(t.tide + .004, t.tide + .045, p.y))
  if (p.y > t.tide - .006) return t.scum
  // below the line: damp, darker toward the floor, silt along the walls' foot
  const deep = mix(t.damp, [t.damp[0] * .9, t.damp[1] * .92, t.damp[2] * .88], smooth(t.tide, t.floor, p.y))
  if (n.y < .5) return deep
  const toWall = Math.min(t.x - Math.abs(p.x), p.z - t.z0, t.z1 - p.z)
  return mix(t.silt, deep, smooth(.015, .085, toWall))
}

const S3 = Math.sqrt(3) / 2
const PIVOT = new Vector3(0, .242, -1.185099963)
const AXIS = new Vector3(0, .5, S3)
const SUMP: Trough = {
  x: .53, z0: -1.48, z1: -.62, floor: .125, rim: .29, tide: .215,
  damp: [.46, .48, .41], scum: [.27, .34, .22], silt: [.6, .6, .53], green: [.46, .58, .36],
}
const BASIN: Trough = {
  x: .33, z0: .79, z1: 1.31, floor: .915, rim: 1.08, tide: .958,
  damp: [.54, .54, .48], scum: [.36, .4, .3], silt: [.64, .64, .57], green: [.62, .7, .52],
}
/** Walls are cut along their height, floors across their face. */
const wallCuts = (t: Trough): Cut[] => [
  { normal: [0, 1, 0], at: [t.floor + .012, t.floor + .03, t.floor + .05, t.tide - .006, t.tide, t.tide + .004, t.tide + .018, t.tide + .045] },
]
const floorCuts = (t: Trough): Cut[] => [
  { normal: [1, 0, 0], at: [-t.x + .03, -t.x + .075, t.x - .075, t.x - .03], facing: [0, 1, 0] },
  { normal: [0, 0, 1], at: [t.z0 + .03, t.z0 + .075, t.z1 - .075, t.z1 - .03], facing: [0, 1, 0] },
]
/** The sump's footprint on the base, where the planks stay wet. */
const FOOT = { x: .57, z0: -1.52, z1: -.58 }

const WATER_SCREW: WearRule[] = [
  {
    parts: id => /^lower-wall-/.test(id) || id === 'lower-bearing',
    cuts: wallCuts(SUMP),
    tint: (p, n) => troughTint(SUMP, p, n),
  },
  {
    parts: id => /^lower-trough-(base|board-)/.test(id),
    cuts: floorCuts(SUMP),
    tint: (p, n) => troughTint(SUMP, p, n),
  },
  {
    parts: id => /^upper-wall-/.test(id),
    cuts: wallCuts(BASIN),
    tint: (p, n) => troughTint(BASIN, p, n),
  },
  {
    parts: id => /^upper-trough-(base|board-)/.test(id),
    cuts: floorCuts(BASIN),
    tint: (p, n) => troughTint(BASIN, p, n),
  },
  {
    // the base round the sump, darkened by what it spills
    parts: id => id === 'base' || id.startsWith('base-plank-'),
    cuts: [{ normal: [0, 0, 1], at: range(-1.84, -.22, .09), facing: [0, 1, 0] }],
    tint: (p, n) => {
      if (n.y < .5) return ONE
      const dx = Math.max(Math.abs(p.x) - FOOT.x, 0), dz = Math.max(FOOT.z0 - p.z, p.z - FOOT.z1, 0)
      const wet = 1 - smooth(0, .3, Math.hypot(dx, dz))
      return mix(ONE, mix([.66, .67, .6], [.52, .6, .43], smooth(.14, 0, Math.hypot(dx, dz))), wet)
    },
  },
  {
    // the core's lower end turns through the sump's water every turn
    parts: id => id === 'shaft',
    cuts: [{ normal: [AXIS.x, AXIS.y, AXIS.z], at: [.2, .27, .35, .45, .57, .72, .9].map(a => AXIS.dot(PIVOT) + a) }],
    tint: p => {
      const a = AXIS.dot(new Vector3().subVectors(p, PIVOT))
      return mix(mix([.36, .43, .31], [.55, .56, .48], smooth(.2, .45, a)), ONE, smooth(.35, .9, a))
    },
  },
  {
    // the grip's middle, where the hand closes, darkened by it
    parts: id => id === 'handle',
    cuts: [],
    tint: (_p, _n, local) => mix([.7, .66, .6], ONE, smooth(.05, .09, Math.abs(local.y))),
  },
]

/** THE AERIAL SCREW: the ring of the deck four people walk as they push the
 * bars round, scuffed darker, and the head of the bearing block where the
 * grease the mast turns in runs down. */
const AERIAL_SCREW: WearRule[] = [
  {
    parts: id => id === 'platform' || id.startsWith('deck-plank-'),
    cuts: [
      { normal: [1, 0, 0], at: range(-1.5, 1.5, .1), facing: [0, 1, 0] },
      { normal: [0, 0, 1], at: range(-1.5, 1.5, .1), facing: [0, 1, 0] },
    ],
    tint: (p, n) => {
      if (n.y < .5) return ONE
      const d = Math.hypot(p.x, p.z)
      return mix(ONE, [.84, .82, .78], smooth(.72, .95, d) * (1 - smooth(1.3, 1.52, d)))
    },
  },
  {
    parts: id => id === 'bearing',
    cuts: [{ normal: [0, 1, 0], at: [.68, .73, .765] }],
    tint: (p, n) => mix(ONE, n.y > .5 ? [.7, .66, .6] : [.8, .76, .7], smooth(.66, .78, p.y)),
  },
]

export function wearFor(slug: string): readonly WearRule[] {
  return slug === 'water-lifting-screw' ? WATER_SCREW : slug === 'aerial-screw' ? AERIAL_SCREW : []
}

/** Cut a flat-listed surface by parallel planes n.p = offset, every
 * attribute carried to the new vertices along the edge they split. */
function slice(geometry: BufferGeometry, normal: Vector3, offsets: readonly number[], facing: Vector3 | null): BufferGeometry {
  const names = Object.keys(geometry.attributes)
  const sizes = names.map(name => geometry.getAttribute(name).itemSize)
  const stride = sizes.reduce((a, b) => a + b, 0)
  const at = names.indexOf('position')
  const lead = sizes.slice(0, at).reduce((a, b) => a + b, 0)
  const u = new Vector3(), v = new Vector3()
  const turned = (tri: number[][]): boolean => {
    if (!facing) return true
    u.set(tri[1]![lead]! - tri[0]![lead]!, tri[1]![lead + 1]! - tri[0]![lead + 1]!, tri[1]![lead + 2]! - tri[0]![lead + 2]!)
    v.set(tri[2]![lead]! - tri[0]![lead]!, tri[2]![lead + 1]! - tri[0]![lead + 1]!, tri[2]![lead + 2]! - tri[0]![lead + 2]!)
    return u.cross(v).normalize().dot(facing) > .5
  }
  // one record per vertex: every attribute's values side by side
  let records: number[] = []
  const count = geometry.getAttribute('position').count
  for (let i = 0; i < count; i++) {
    names.forEach((name, k) => {
      const attribute = geometry.getAttribute(name)
      for (let c = 0; c < sizes[k]!; c++) records.push(attribute.getComponent(i, c))
    })
  }
  const EPS = 1e-7
  for (const offset of offsets) {
    const next: number[] = []
    const vertex = (i: number): number[] => records.slice(i * stride, i * stride + stride)
    const side = (v: number[]): number => normal.x * v[lead]! + normal.y * v[lead + 1]! + normal.z * v[lead + 2]! - offset
    for (let t = 0; t < records.length / stride; t += 3) {
      const tri = [vertex(t), vertex(t + 1), vertex(t + 2)]
      const d = tri.map(side)
      if (d.every(v => v >= -EPS) || d.every(v => v <= EPS) || !turned(tri)) { for (const v of tri) next.push(...v); continue }
      for (const sign of [1, -1]) {
        const poly: number[][] = []
        for (let i = 0; i < 3; i++) {
          const a = tri[i]!, b = tri[(i + 1) % 3]!, da = sign * d[i]!, db = sign * d[(i + 1) % 3]!
          if (da >= 0) poly.push(a)
          if ((da > EPS && db < -EPS) || (da < -EPS && db > EPS)) {
            const f = da / (da - db)
            poly.push(a.map((value, c) => value + (b[c]! - value) * f))
          }
        }
        for (let i = 1; i + 1 < poly.length; i++) next.push(...poly[0]!, ...poly[i]!, ...poly[i + 1]!)
      }
    }
    records = next
  }
  const out = geometry.clone()
  const total = records.length / stride
  let base = 0
  names.forEach((name, k) => {
    const size = sizes[k]!
    const values = new Float32Array(total * size)
    for (let i = 0; i < total; i++) for (let c = 0; c < size; c++) values[i * size + c] = records[i * stride + base + c]!
    out.setAttribute(name, new Float32BufferAttribute(values, size))
    base += size
  })
  return out
}

/** The part's surface with its wear laid in: cut where a line must be crisp,
 * then every vertex's colour multiplied by what the rules say at its place in
 * the machine. `toMachine` is rigid: the part's frame to the machine's. */
export function wornSurface(geometry: BufferGeometry, toMachine: Matrix4, rules: readonly WearRule[]): BufferGeometry {
  let surface = geometry.index ? geometry.toNonIndexed() : geometry.clone()
  surface.clearGroups()
  const rotation = new Matrix3().setFromMatrix4(toMachine)
  const back = rotation.clone().transpose()
  const shift = new Vector3().setFromMatrixPosition(toMachine)
  for (const rule of rules) {
    for (const cut of rule.cuts) {
      const n = new Vector3(...cut.normal).normalize()
      const local = n.clone().applyMatrix3(back)
      const facing = cut.facing ? new Vector3(...cut.facing).normalize().applyMatrix3(back) : null
      const cutSurface = slice(surface, local, cut.at.map(offset => offset - n.dot(shift)), facing)
      surface.dispose()
      surface = cutSurface
    }
  }
  const position = surface.getAttribute('position'), normal = surface.getAttribute('normal')
  let colour = surface.getAttribute('color')
  if (!colour) {
    colour = new Float32BufferAttribute(new Float32Array(position.count * 3).fill(1), 3)
    surface.setAttribute('color', colour)
  }
  const local = new Vector3(), p = new Vector3(), n = new Vector3()
  for (let i = 0; i < position.count; i++) {
    local.fromBufferAttribute(position, i)
    p.copy(local).applyMatrix4(toMachine)
    n.fromBufferAttribute(normal, i).applyMatrix3(rotation).normalize()
    let r = colour.getX(i), g = colour.getY(i), b = colour.getZ(i)
    for (const rule of rules) {
      const [tr, tg, tb] = rule.tint(p, n, local)
      r *= Math.min(1, tr); g *= Math.min(1, tg); b *= Math.min(1, tb)
    }
    colour.setXYZ(i, r, g, b)
  }
  surface.computeBoundingBox()
  surface.computeBoundingSphere()
  return surface
}
