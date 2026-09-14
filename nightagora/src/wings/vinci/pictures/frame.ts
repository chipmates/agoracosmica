/**
 * Proposed exhibition moulding, not a reconstruction of any holder's frame.
 * A closed section is swept around the measured aperture with real mitres.
 * All members are baked into three material batches, regardless of hang size.
 * The library owns its maps; this module owns only geometry and materials.
 */
import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshStandardNodeMaterial,
} from 'three/webgpu'
import * as TSL from 'three/tsl'
import type { Stack } from '../../../stack'
import { NORTH_WINDOW_LIGHT, underApertureOnWall, type ApertureLight } from './aperture'

// TSL composition uses the same narrow untyped boundary as the stack helper.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any
const { attribute, cameraPosition, clamp, float, floor, length, min, mix, mx_noise_float,
  positionWorld, smoothstep, uv, vec3 } = TSL as unknown as Record<string, N>

export interface FramePlacement {
  id: string
  /** Aperture centre, metres, in the wall's local XY plane. */
  x: number
  y: number
  /** The unobstructed measured aperture, never the outer moulding. */
  width: number
  height: number
}

export const FRAME_MOULDING_WIDTH_M = 0.052
export const FRAME_BACK_M = 0.006
export const FRAME_FRONT_M = 0.051

type Finish = 0 | 1 | 2
interface SectionPoint {
  r: number
  z: number
  /** Finish of the face from this point to the next point. */
  finish: Finish
  /** A turned crown shares a tangent; fillets and rebates remain crisp. */
  smooth?: boolean
}

/** Radius is measured OUTSIDE the true object. No lip masks its dimensions.
 * The inner return stands 2 mm behind the z=.021 picture plane. The broad
 * ogee rises into a crown, drops through a quirk, then reaches the outer bead.
 * The back returns through a second shoulder to close the 45 mm wooden section.
 * Its back stands just 6 mm from the plaster for the mounting hardware.
 */
const SECTION: readonly SectionPoint[] = [
  { r: 0,     z: .019, finish: 2 },
  { r: 0,     z: .033, finish: 0 },
  { r: .002,  z: .040, finish: 0, smooth: true },
  { r: .0045, z: .043, finish: 0, smooth: true },
  { r: .007,  z: .042, finish: 0, smooth: true },
  { r: .009,  z: .038, finish: 0 },
  { r: .011,  z: .038, finish: 1 },
  { r: .012,  z: .030, finish: 1 },
  { r: .015,  z: .028, finish: 1, smooth: true },
  { r: .019,  z: .030, finish: 0, smooth: true },
  { r: .023,  z: .036, finish: 0, smooth: true },
  { r: .027,  z: .044, finish: 0, smooth: true },
  { r: .032,  z: .050, finish: 0, smooth: true },
  { r: .035,  z: .051, finish: 0, smooth: true },
  { r: .039,  z: .049, finish: 0, smooth: true },
  { r: .042,  z: .044, finish: 0 },
  { r: .044,  z: .044, finish: 1 },
  { r: .044,  z: .040, finish: 1 },
  { r: .046,  z: .040, finish: 0 },
  { r: .047,  z: .044, finish: 0 },
  { r: .050,  z: .044, finish: 0 },
  { r: .052,  z: .041, finish: 2 },
  { r: .052,  z: .006, finish: 2 },
  { r: .007,  z: .006, finish: 2 },
  { r: .007,  z: .019, finish: 2 },
]

type Point3 = [number, number, number]
interface Batch {
  positions: number[]
  normals: number[]
  uvs: number[]
  seeds: number[]
  radial: number[]
}
const emptyBatch = (): Batch => ({ positions: [], normals: [], uvs: [], seeds: [], radial: [] })

function hashId(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619) >>> 0
  return h / 4294967296
}

/** The section normal in radial/Z coordinates. */
function sectionNormal(index: number, endpoint: 0 | 1): [number, number] {
  const next = (index + 1) % SECTION.length
  const a = SECTION[index]!
  const b = SECTION[next]!
  const dr = b.r - a.r
  const dz = b.z - a.z
  const size = Math.hypot(dr, dz)
  let nr = -dz / size
  let nz = dr / size
  const at = endpoint === 0 ? index : next
  if (SECTION[at]!.smooth) {
    const other = endpoint === 0 ? (index - 1 + SECTION.length) % SECTION.length : next
    const c = SECTION[other]!
    const d = SECTION[(other + 1) % SECTION.length]!
    const span = Math.hypot(d.r - c.r, d.z - c.z)
    nr += -(d.z - c.z) / span
    nz += (d.r - c.r) / span
    const total = Math.hypot(nr, nz)
    nr /= total
    nz /= total
  }
  return [nr, nz]
}

function addFrame(batches: readonly Batch[], f: FramePlacement): void {
  if (![f.x, f.y, f.width, f.height].every(Number.isFinite) || f.width <= 0 || f.height <= 0)
    throw new Error(`Invalid physical frame dimensions: ${f.id}`)
  const w = f.width / 2
  const h = f.height / 2
  const seed = hashId(f.id)
  // Counterclockwise ring. Adjacent members meet along exact 45-degree cuts.
  const corners: readonly [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]]
  const outward: readonly [number, number][] = [[0, -1], [1, 0], [0, 1], [-1, 0]]
  let profileDistance = 0
  for (let i = 0; i < SECTION.length; i++) {
    const a = SECTION[i]!
    const b = SECTION[(i + 1) % SECTION.length]!
    const start = profileDistance
    profileDistance += Math.hypot(b.r - a.r, b.z - a.z)
    const batch = batches[a.finish]!
    for (let edge = 0; edge < 4; edge++) {
      const ca = corners[edge]!
      const cb = corners[(edge + 1) % 4]!
      const face = outward[edge]!
      const point = (corner: readonly number[], p: SectionPoint): Point3 =>
        [f.x + corner[0]! * (w + p.r), f.y + corner[1]! * (h + p.r), p.z]
      const points = [point(ca, a), point(ca, b), point(cb, b), point(cb, a)]
      const normalA = sectionNormal(i, 0)
      const normalB = sectionNormal(i, 1)
      const normals = [normalA, normalB, normalB, normalA]
      const radii = [a.r, b.r, b.r, a.r]
      const distances = [start, profileDistance, profileDistance, start]
      for (const k of [0, 1, 2, 0, 2, 3]) {
        const p = points[k]!
        const n = normals[k]!
        batch.positions.push(...p)
        batch.normals.push(face[0] * n[0], face[1] * n[0], n[1])
        // Metres, not normalized board UVs. The grain never scales with a work.
        const along = edge % 2 === 0 ? p[0] - f.x : p[1] - f.y
        batch.uvs.push(along + seed * 5.17 + edge * .271, distances[k]!)
        batch.seeds.push(seed + edge * .173)
        batch.radial.push(radii[k]! / FRAME_MOULDING_WIDTH_M)
      }
    }
  }
}

function batchGeometry(batch: Batch): BufferGeometry {
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(batch.positions, 3))
  g.setAttribute('normal', new Float32BufferAttribute(batch.normals, 3))
  g.setAttribute('uv', new Float32BufferAttribute(batch.uvs, 2))
  g.setAttribute('leafSeed', new Float32BufferAttribute(batch.seeds, 1))
  g.setAttribute('leafRadial', new Float32BufferAttribute(batch.radial, 1))
  g.computeBoundingBox()
  g.computeBoundingSphere()
  return g
}

function frameMaterials(stack: Stack, light: ApertureLight): MeshStandardNodeMaterial[] {
  const goldSet = stack.materials.sync('gold-leaf')
  const woodSet = stack.materials.sync('oak-beams')
  const details = { uv: uv(), scales: [.34, .022, .0014] as [number, number, number],
    macro: .075, mid: .35, micro: .15, fade: [2.5, 8] as [number, number], count: 3 as const }
  const gold = goldSet.material(details)
  gold.name = 'vinci/pictures/gold-leaf'
  gold.metalness = 1
  // The source map supplies leaf crumple. Ground grain changes roughness only:
  // long 200 mm timber fibres and 8 mm cross-grain do not paint a gold surface.
  const p = uv()
  const seed = attribute('leafSeed', 'float')
  const grain = mx_noise_float(vec3(p.x.mul(5), p.y.mul(125), seed.mul(19)))
  const density = float(1).sub(smoothstep(2.5, 8, length(positionWorld.sub(cameraPosition))))
  const crown = smoothstep(.42, .60, attribute('leafRadial', 'float'))
    .mul(float(1).sub(smoothstep(.70, .83, attribute('leafRadial', 'float'))))
  // Water gilding is laid leaf by leaf. Each 82 mm leaf burnishes a little
  // differently and the laps stay matt, so no highlight runs an entire member
  // at one value. The lap pitch is the leaf, never the size of the picture.
  const lapPhase = p.x.mul(1 / .082).add(seed.mul(7.3))
  const within = lapPhase.sub(floor(lapPhase))
  const lap = float(1).sub(smoothstep(.030, .085, min(within, float(1).sub(within))))
  const leaf = mx_noise_float(vec3(floor(lapPhase).mul(.37), seed.mul(11), 2.1))
  // The burnisher reaches the crown and nothing else, so the crown is the
  // only part of a water-gilt frame that mirrors the window. The laps stay
  // matt and each leaf takes the agate a little differently.
  gold.roughnessNode = clamp((gold.roughnessNode as N).add(grain.mul(.018).mul(density))
    .sub(crown.mul(.115)).add(lap.mul(.085)).add(leaf.mul(.035)), .12, .68)
  // The bole under the leaf is a warm red clay. Where the burnisher cannot
  // reach, at the edge of a member and in the hollow of the sweep, the leaf
  // is thin and the clay shows through as warmth, not as colour.
  const hollow = float(1).sub(crown)
  // At arm's length a laid leaf is not a tone, it is an edge: the lap where
  // one sheet overlaps the next takes a hair more gold and stands a hair
  // warmer. Under three metres the edge is a pixel wide, past eight it is a
  // tenth of one and would only shimmer, so it arrives with the distance.
  const lapEdge = lap.mul(density)
  const rub = smoothstep(.52, .78, mx_noise_float(vec3(p.x.mul(3.1), seed.mul(5.7), .9)))
    .mul(crown).mul(density)
  gold.colorNode = (gold.colorNode as N).mul(float(1).add(leaf.mul(.026)).sub(lap.mul(.030)))
    .mul(float(1).sub(lapEdge.mul(.055)))
    .mul(mix(vec3(1, 1, 1), vec3(1.115, .935, .835), hollow.mul(.72)))
    // Where a frame is handled the leaf wears off the high points and the
    // bole itself is what a visitor sees, not a duller gold.
    .mul(mix(vec3(1, 1, 1), vec3(1.30, .705, .545), rub.mul(.34)))
  gold.userData['manifestId'] = 'vinci/pictures/frame-gilding'

  const recess = goldSet.material({ ...details, macro: .045, micro: .1 })
  recess.name = 'vinci/pictures/leaf-in-quirk'
  recess.colorNode = recess.colorNode!.mul(vec3(.57, .46, .35))
  recess.metalness = .78
  recess.roughnessNode = clamp((recess.roughnessNode as N).add(.12), .40, .78)
  recess.userData['manifestId'] = 'vinci/pictures/frame-gilding'

  const wood = new MeshStandardNodeMaterial({ color: new Color('#554332'), roughness: .74 })
  wood.name = 'vinci/pictures/wood-rebate'
  const colour = wood.color
  wood.colorNode = vec3(colour.r, colour.g, colour.b)
  stack.detail(wood, woodSet, { uv: uv(), scales: [.40, .018, .0012],
    macro: .24, mid: .24, micro: .30, maps: .34, fade: [2.5, 8], count: 3 })
  wood.userData['manifestId'] = 'vinci/pictures/frame-gilding'
  // The wall takes its light from the window; so does everything hanging on
  // it. The run keeps a frame with the plaster behind it, the facing term
  // gives each swept member its own window side.
  for (const m of [gold, recess, wood]) underApertureOnWall(m, light)
  return [gold, recess, wood]
}

/**
 * Coordinates are metres. The picture/mat face is z=.021 and wall face z=0.
 * Three front-pass draws for an entire room, plus the stack's shadow passes.
 * `?noweld` retains identical pieces as a diagnostic A/B of batch geometry.
 */
export function buildFrameBatch(stack: Stack, placements: FramePlacement[],
  light: ApertureLight = NORTH_WINDOW_LIGHT): {
  group: Group
  /** Omit ids to restore the complete hang; [] hides every moulding. */
  setVisible(ids?: readonly string[]): void
  dispose(): void
} {
  const group = new Group()
  group.name = 'vinci/pictures/physical-frames'
  group.userData['manifestId'] = 'vinci/pictures/frame-gilding'
  group.userData['frameCount'] = placements.length
  group.userData['apertures'] = placements.map(f => ({ ...f }))
  group.userData['profile'] = { width_m: FRAME_MOULDING_WIDTH_M,
    depth_m: FRAME_FRONT_M - FRAME_BACK_M, section: SECTION }
  group.userData['aperture'] = light
  const materials = frameMaterials(stack, light)
  const geometries: BufferGeometry[] = []
  const noweld = typeof location !== 'undefined' && new URLSearchParams(location.search).has('noweld')
  const physical = placements.map(f => ({ ...f }))
  let live = true
  let selection: string | null = null
  function setVisible(ids?: readonly string[]): void {
    if (!live) return
    const admitted = ids === undefined ? null : new Set(ids)
    const visible = admitted ? physical.filter(f => admitted.has(f.id)) : physical
    // Canonical placement order avoids rebuilding for reordered/duplicate ids.
    const key = JSON.stringify(visible.map(f => f.id))
    if (selection === key) return
    selection = key
    group.clear()
    for (const old of geometries) old.dispose()
    geometries.length = 0
    group.userData['visibleFrameCount'] = visible.length
    group.userData['visibleIds'] = visible.map(f => f.id)
    const chunks = noweld ? visible.map(f => [f]) : [visible]
    for (const chunk of chunks) {
      const batches = [emptyBatch(), emptyBatch(), emptyBatch()]
      for (const f of chunk) addFrame(batches, f)
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i]!
        if (!batch.positions.length) continue
        const geometry = batchGeometry(batch)
        geometries.push(geometry)
        const mesh = new Mesh(geometry, materials[i]!)
        mesh.name = `vinci/pictures/frame-batch-${i}`
        mesh.castShadow = true
        mesh.receiveShadow = true
        mesh.userData['manifestId'] = 'vinci/pictures/frame-gilding'
        group.add(mesh)
      }
    }
  }
  setVisible()
  return {
    group,
    setVisible,
    dispose() {
      if (!live) return
      live = false
      group.removeFromParent()
      for (const geometry of geometries) geometry.dispose()
      for (const material of materials) material.dispose()
      group.clear()
    },
  }
}
