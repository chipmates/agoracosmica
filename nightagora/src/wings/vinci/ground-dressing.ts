import {
  BufferGeometry, Color, DoubleSide, Float32BufferAttribute,
  Group, Mesh, MeshStandardNodeMaterial, Vector3,
} from 'three/webgpu'
import type { TierName } from '../../stack/tier'
import { dossier, edgeDistance, feature, inside, polygon, type Quantity } from './site'
import { getPathCorridors, pathSpecifications } from './paths'
import { gateApproachRoute } from './terrain-mesh'
import { getWaterCuts } from './water'
import { getApronOutlines } from './apron'

interface Batch { positions: number[]; normals: number[]; colours: number[] }
interface Patch { east: number; north: number; radiusEast: number; radiusNorth: number; weight: number }
type HeightAt = (east: number, north: number) => number

const PROVENANCE = {
  manifestId: 'vinci/ground-dressing',
  assetClass: 'GENERATED',
  certainty: 'conjectural',
  basis: 'A-SITE and A-LAYOUT terrain and exclusions. Modern garden photographs inform surface character only. Grass, gravel and fallen-leaf positions are a proposed October dressing, not period evidence.',
  recipe: 'Seed 15171010. Weighted elliptical fields concentrate unequal tuft clusters in the arrival slope and garden foreground. Dense narrow three-triangle curved opaque grass blades, 6–13 mm base width, in uneven clumps, folded fallen leaves and four-face limestone chips. Gravel collects beside literal path corridors. Masonry, platforms, gate circulation and retained water cuts exclude all dressing. Every contact samples the shared gradeAt through heightAt. Two geometry batches. No textures, alpha, billboard orientation or shadow dither.',
}

const PATCHES: readonly Patch[] = [
  { east: -30, north: -42, radiusEast: 18, radiusNorth: 14, weight: 4 },
  { east: -22, north: -30, radiusEast: 13, radiusNorth: 11, weight: 2 },
  { east: -36, north: 24, radiusEast: 18, radiusNorth: 22, weight: 1 },
  { east: -20, north: 10, radiusEast: 10, radiusNorth: 14, weight: 1 },
  { east: 32, north: -9, radiusEast: 13, radiusNorth: 24, weight: 3 },
  { east: 30, north: -25, radiusEast: 10, radiusNorth: 12, weight: 4 },
  { east: -52, north: -14, radiusEast: 12, radiusNorth: 26, weight: 1 },
  { east: -17, north: -61, radiusEast: 18, radiusNorth: 12, weight: 1 },
]
const WEIGHTED_PATCHES = PATCHES.flatMap(patch => Array.from({ length: patch.weight }, () => patch))
const GRASS = ['#626943', '#788050', '#858458', '#9a9260', '#a99b6d', '#697048'].map(c => new Color(c))
const LEAVES = ['#806143', '#96754b', '#a28b58', '#726048', '#766b42'].map(c => new Color(c))
const CHIPS = ['#a69e87', '#b7ac92', '#c2b69d', '#988f7b', '#867f6c'].map(c => new Color(c))

function randomSource(seed: number): () => number {
  let value = seed >>> 0
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0
    return value / 4294967296
  }
}

function makeBatch(): Batch { return { positions: [], normals: [], colours: [] } }

function face(batch: Batch, a: Vector3, b: Vector3, c: Vector3, colour: Color): void {
  const normal = b.clone().sub(a).cross(c.clone().sub(a)).normalize()
  for (const v of [a, b, c]) {
    batch.positions.push(v.x, v.y, v.z)
    batch.normals.push(normal.x, normal.y, normal.z)
    batch.colours.push(colour.r, colour.g, colour.b)
  }
}

function routeStrip(a: readonly number[], b: readonly number[], width: number): number[][] {
  const dx = b[0]! - a[0]!, dn = b[1]! - a[1]!, length = Math.hypot(dx, dn)
  const e = -dn / length * width / 2, n = dx / length * width / 2
  return [[a[0]! + e, a[1]! + n], [b[0]! + e, b[1]! + n], [b[0]! - e, b[1]! - n], [a[0]! - e, a[1]! - n]]
}

function tuftBlade(batch: Batch, heightAt: HeightAt, east: number, north: number, height: number, azimuth: number, width: number, colour: Color): void {
  const base = new Vector3(east, heightAt(east, north) - 0.008, -north)
  const across = new Vector3(Math.cos(azimuth), 0, Math.sin(azimuth))
  const lean = new Vector3(-Math.sin(azimuth), 0, Math.cos(azimuth))
  const knee = base.clone().add(new Vector3(0, height * 0.64, 0)).addScaledVector(lean, height * 0.17)
  const tip = base.clone().add(new Vector3(0, height, 0)).addScaledVector(lean, height * 0.66)
  const left = base.clone().addScaledVector(across, -width * 0.5)
  const right = base.clone().addScaledVector(across, width * 0.5)
  const middleLeft = knee.clone().addScaledVector(across, -width * 0.29)
  const middleRight = knee.clone().addScaledVector(across, width * 0.29)
  const dry = colour.clone().multiplyScalar(1.07)
  face(batch, left, right, middleRight, colour)
  face(batch, left, middleRight, middleLeft, colour)
  face(batch, middleLeft, middleRight, tip, dry)
}

function fallenLeaf(batch: Batch, heightAt: HeightAt, east: number, north: number, length: number, azimuth: number, colour: Color): void {
  const alongEast = Math.cos(azimuth), alongNorth = Math.sin(azimuth)
  const point = (along: number, across: number, lift: number): Vector3 => {
    const e = east + alongEast * along - alongNorth * across
    const n = north + alongNorth * along + alongEast * across
    return new Vector3(e, heightAt(e, n) + lift, -n)
  }
  const start = point(-length * 0.48, 0, 0.021)
  const tip = point(length * 0.52, 0, 0.035)
  const left = point(-length * 0.05, -length * 0.25, 0.012)
  const right = point(length * 0.03, length * 0.28, 0.014)
  face(batch, start, left, tip, colour)
  face(batch, start, tip, right, colour.clone().multiplyScalar(0.87))
}

function chip(batch: Batch, heightAt: HeightAt, east: number, north: number, size: number, angle: number, colour: Color): void {
  const base: Vector3[] = []
  for (let i = 0; i < 4; i++) {
    const a = angle + i * Math.PI * 0.5
    const radius = size * (i % 2 ? 0.56 : 0.82)
    const e = east + Math.cos(a) * radius, n = north + Math.sin(a) * radius
    base.push(new Vector3(e, heightAt(e, n) + 0.008, -n))
  }
  const top = new Vector3(east + size * 0.13, heightAt(east, north) + size * 0.32, -north + size * 0.08)
  for (let i = 0; i < 4; i++) face(batch, base[i]!, base[(i + 1) % 4]!, top, colour.clone().multiplyScalar(0.91 + i * 0.035))
}

function meshFrom(batch: Batch, name: string): Mesh {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(batch.positions, 3))
  geometry.setAttribute('normal', new Float32BufferAttribute(batch.normals, 3))
  geometry.setAttribute('color', new Float32BufferAttribute(batch.colours, 3))
  geometry.computeBoundingSphere()
  const material = new MeshStandardNodeMaterial({ vertexColors: true, roughness: 0.97, side: DoubleSide })
  material.name = name
  material.userData = { ...PROVENANCE }
  const mesh = new Mesh(geometry, material)
  mesh.name = name
  mesh.receiveShadow = true
  mesh.castShadow = false
  mesh.userData = { ...PROVENANCE }
  return mesh
}

/** Coordinates stay east/north until converted at each vertex. All placement
 * fields are explicit museum assumptions outside masonry and walking surfaces. */
export function createGroundDressing(heightAt: HeightAt, tier: TierName): Group {
  const group = new Group()
  group.name = 'vinci generated conjectural ground dressing'
  group.userData = { ...PROVENANCE }
  const calm = tier === 'calm'
  const plantBatch = makeBatch(), mineralBatch = makeBatch()
  const random = randomSource(15171010)
  const buildings = [
    dossier.site.footprint.map(p => p.value),
    dossier.site.build_envelope.map(p => p.value),
    ...dossier.site.features.filter(f => f.id.startsWith('annex-'))
      .map(f => (f.geometry as Quantity<number[]>[]).map(p => p.value)),
  ]
  const routes = [
    ...['courtyard', 'terrace', 'street-grade'].map(polygon),
    ...getApronOutlines().map(apron=>apron.points),
    ...getPathCorridors().map(corridor => corridor.points),
    ...gateApproachRoute.slice(1).map((b, i) => routeStrip(gateApproachRoute[i]!, b, feature('gate-steps').width_m!.value)),
  ]
  const water = getWaterCuts().map(cut => cut.points)
  const clear = (east: number, north: number): boolean => {
    if (buildings.some(p => inside(east, north, p) || edgeDistance(east, north, p) < 0.65)) return false
    if (routes.some(p => inside(east, north, p) || edgeDistance(east, north, p) < 0.28)) return false
    if (water.some(p => inside(east, north, p) || edgeDistance(east, north, p) < 0.45)) return false
    return true
  }
  const pathDistance = (east: number, north: number): number => Math.min(...routes.map(p => edgeDistance(east, north, p)))
  const sample = (index: number): [number, number, number] => {
    const patch = WEIGHTED_PATCHES[index % WEIGHTED_PATCHES.length]!
    const theta = random() * Math.PI * 2
    const radius = Math.sqrt(random())
    const east = patch.east + Math.cos(theta) * patch.radiusEast * radius
    const north = patch.north + Math.sin(theta) * patch.radiusNorth * radius
    const clump = 0.5 + 0.5 * Math.sin(east * 1.71 + Math.sin(north * 0.42) * 2.2) * Math.cos(north * 1.18 - east * 0.31)
    const density = (0.30 + 0.70 * (1 - radius * radius)) * (0.30 + 0.70 * clump)
    return [east, north, density]
  }

  const tuftTarget = calm ? 8000 : 30000
  let tufts = 0
  for (let attempt = 0; tufts < tuftTarget && attempt < tuftTarget * 18; attempt++) {
    const [east, north, density] = sample(attempt)
    if (!clear(east, north) || random() > density) continue
    const edge = pathDistance(east, north)
    const stature = (0.07 + random() * 0.18) * (edge < 1.3 ? 0.72 : 1)
    const colour = GRASS[Math.floor(random() * GRASS.length)]!.clone().multiplyScalar(0.84 + density * 0.19)
    const angle = random() * Math.PI * 2
    for (let blade = 0; blade < 3; blade++) {
      const e = east + (random() - 0.5) * 0.055, n = north + (random() - 0.5) * 0.055
      tuftBlade(plantBatch, heightAt, e, n, stature * (0.66 + random() * 0.70),
        angle + blade * 2.13 + random() * 0.4, 0.006 + random() * 0.007, colour)
    }
    tufts++
  }

  const leafTarget = calm ? 900 : 1450
  let leaves = 0
  for (let attempt = 0; leaves < leafTarget && attempt < leafTarget * 16; attempt++) {
    const [east, north, density] = sample(attempt)
    if (!clear(east, north) || random() > density * 1.45) continue
    const colour = LEAVES[Math.floor(random() * LEAVES.length)]!.clone().multiplyScalar(0.82 + random() * 0.25)
    fallenLeaf(plantBatch, heightAt, east, north, 0.065 + random() * 0.07, random() * Math.PI * 2, colour)
    leaves++
  }

  const chipTarget = calm ? 400 : 850
  const gravelSegments = pathSpecifications.flatMap(path => path.centreline.slice(1).map((b, i) => {
    const a = path.centreline[i]!, length = Math.hypot(b[0] - a[0], b[1] - a[1])
    return { a, b, length, width: path.width.value }
  })).filter(segment => {
    const east = (segment.a[0] + segment.b[0]) / 2, north = (segment.a[1] + segment.b[1]) / 2
    return east > -50 && east < 50 && north > -95 && north < 30
  })
  const gravelLength = gravelSegments.reduce((sum, segment) => sum + segment.length, 0)
  const samplePathEdge = (): [number, number, number] => {
    let along = random() * gravelLength
    const segment = gravelSegments.find(item => {
      if (along <= item.length) return true
      along -= item.length
      return false
    }) ?? gravelSegments[gravelSegments.length - 1]!
    const t = Math.max(0.02, Math.min(0.98, along / segment.length))
    const dx = (segment.b[0] - segment.a[0]) / segment.length
    const dn = (segment.b[1] - segment.a[1]) / segment.length
    const side = (random() < 0.5 ? -1 : 1) * (segment.width / 2 + 0.35 + random() ** 2 * 0.70)
    return [segment.a[0] + (segment.b[0] - segment.a[0]) * t - dn * side,
      segment.a[1] + (segment.b[1] - segment.a[1]) * t + dx * side, 0.4]
  }
  let chips = 0
  for (let attempt = 0; chips < chipTarget && attempt < chipTarget * 45; attempt++) {
    // Most chips collect against the outer edge of a footway. The remainder
    // are sparse mineral pieces in the bare intervals between plant clumps.
    const [east, north, density] = attempt % 5 ? samplePathEdge() : sample(attempt)
    if (!clear(east, north)) continue
    const edge = pathDistance(east, north)
    const probability = edge < 2 ? 0.88 : 0.06 * (1 - density)
    if (random() > probability) continue
    chip(mineralBatch, heightAt, east, north, 0.028 + random() ** 2 * 0.075,
      random() * Math.PI * 2, CHIPS[Math.floor(random() * CHIPS.length)]!)
    chips++
  }

  group.add(meshFrom(plantBatch, 'vinci October grass and uneven leaf litter'))
  group.add(meshFrom(mineralBatch, 'vinci pale mineral path-edge gravel'))
  group.userData['draws'] = 2
  group.userData['triangles'] = (plantBatch.positions.length + mineralBatch.positions.length) / 9
  group.userData['counts'] = { tufts, grassBlades: tufts * 3, leaves, chips }
  group.userData['tier'] = tier
  group.userData['patches'] = PATCHES.map(p => ({ ...p }))
  group.userData['excluded'] = ['cadastre', 'build envelope', 'mapped annexes', 'courtyard', 'terrace', 'street', 'street grade', 'house-side apron', 'gate approach', 'gate steps', 'garden descent', 'retained water cuts']
  return group
}
