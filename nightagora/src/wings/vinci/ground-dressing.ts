import { partitionGroundDressing } from './dressing-partition'
import {
  BufferGeometry, Color, DoubleSide, Float32BufferAttribute,
  Group, Mesh, MeshStandardNodeMaterial, Vector3,
} from 'three/webgpu'
import { cameraViewMatrix, normalWorldGeometry, normalize, texture, uv } from 'three/tsl'
import { leftOutAtCalm } from './calm-tier'
import type { TierName } from '../../stack/tier'
import { dossier, edgeDistance, feature, inside, polygon, type Quantity } from './site'
import { getPathCorridors, pathSpecifications } from './paths'
import { gateApproachRoute } from './terrain-mesh'
import { getWaterCuts } from './water'
import { collectionExclusions } from './collection'
import { collectionAccessExclusions } from './collection-access'
import { getInnerCourtOutlines } from './inner-court'
import { getApronOutlines } from './apron'
import { pebble, stoneColour, type Emit } from './pebbles'
import { createMoss } from './moss'
import { createCreepers } from './creepers'
import { createCopings } from './copings'
import { hidden, stageWeight, STOP_EYES, stopDistance } from './leaf-litter'
import { builtFaces } from './ground-walls'
import { GRASS_CELLS, grassAtlas, grassCellUV } from './grass-maps'

interface Batch { positions: number[]; normals: number[]; colours: number[] }
interface Patch { east: number; north: number; radiusEast: number; radiusNorth: number; weight: number }
type HeightAt = (east: number, north: number) => number

const PROVENANCE = {
  manifestId: 'vinci/ground-dressing',
  assetClass: 'GENERATED',
  certainty: 'conjectural',
  basis: 'A-SITE and A-LAYOUT terrain and exclusions. Modern garden photographs inform surface character only. Grass, gravel and fallen-leaf positions are a proposed October dressing, not period evidence.',
  recipe: 'The meadow sown from the stops: seed 15171013 sows, for every outdoor stop, clumps of four to nine curved opaque three-triangle blades (3 to 10 mm wide, 5 to 40 cm) and dry seed stalks, their density falling as one over (1 + (r / 4 m)^2) from the stop eye within 20 m and 60 degrees of its look, hidden places behind the house refused; blades green at the foot and gone to straw at the tip on dry ones, shorter within 1.3 m of a walked edge. Seed 15171041 adds crossed tuft cards from a tuft atlas drawn in code (30 to 40 blades each, green, mixed, seeding and bent kinds), one over (1 + (r / 8 m)^2) within 46 m, larger with distance; their normals stand up with the sward. Seed 15171042 lays short grass and weeds along the foot of the house and its annexes, never in a doorway or the gate. Path-edge gravel is bedded round-shaded river pebbles of 15 to 65 mm. Moss and ivy carry their own records. Masonry, platforms, gate circulation and retained water cuts exclude every blade; every contact samples the shared grade. Dimensions, species mix and positions are exhibition assumptions, not a record of 1517.',
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
const GRASS = ['#5b6440', '#697249', '#747c4c', '#626943', '#788050', '#858458'].map(c => new Color(c))
const STRAW = ['#9a9260', '#a99b6d', '#b3a577', '#8f8358', '#7d6e52'].map(c => new Color(c))

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

interface CardBatch { position: number[]; normal: number[]; colour: number[]; uv: number[] }
/** One tuft of the sward as two crossed cards of the tuft atlas, standing on
 * its crown, leaning a little with the week's wind. Their normals stand up
 * with the sward, so a tuft shades as the ground it grows from. */
function tuftCards(batch: CardBatch, heightAt: HeightAt, east: number, north: number, width: number, height: number,
  turn: number, cell: number, tint: [number, number, number], lean: number): void {
  const { u0, v0, du, dv } = grassCellUV(cell)
  const ground = heightAt(east, north) - .012
  const lx = Math.sin(232 * Math.PI / 180 + Math.PI) * lean, ln = Math.cos(232 * Math.PI / 180 + Math.PI) * lean
  for (const extra of [0, Math.PI / 2]) {
    const a = turn + extra, ce = Math.cos(a) * width / 2, cn = Math.sin(a) * width / 2
    const corners: [number, number, number, number, number][] = [
      [east - ce, north - cn, ground, u0, v0 + dv], [east + ce, north + cn, ground, u0 + du, v0 + dv],
      [east + ce + lx, north + cn + ln, ground + height, u0 + du, v0], [east - ce + lx, north - cn + ln, ground + height, u0, v0],
    ]
    // the card's face turned a little into the normal, so its two sides are lit alike
    const fx = -Math.sin(a) * .3, fz = -Math.cos(a) * .3
    for (const i of [0, 1, 2, 0, 2, 3]) {
      const [e, n, y, u, v] = corners[i]!
      batch.position.push(e, y, -n)
      const l = Math.hypot(fx, 1, fz)
      batch.normal.push(fx / l, 1 / l, fz / l)
      batch.colour.push(tint[0], tint[1], tint[2])
      batch.uv.push(u, v)
    }
  }
}

function cardMesh(batch: CardBatch, name: string): Mesh {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(batch.position, 3))
  geometry.setAttribute('normal', new Float32BufferAttribute(batch.normal, 3))
  geometry.setAttribute('color', new Float32BufferAttribute(batch.colour, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(batch.uv, 2))
  geometry.computeBoundingSphere()
  const material = new MeshStandardNodeMaterial({ vertexColors: true, roughness: .92, side: DoubleSide, alphaTest: .45 })
  material.alphaToCoverage = true
  material.colorNode = texture(grassAtlas(), uv())
  // both faces take the sward's own upward normal
  material.normalNode = normalize(normalWorldGeometry.transformDirection(cameraViewMatrix))
  material.name = name
  material.userData = { ...PROVENANCE }
  const mesh = new Mesh(geometry, material)
  mesh.name = name
  mesh.receiveShadow = true
  mesh.castShadow = false
  mesh.userData = { ...PROVENANCE }
  return mesh
}

/** A proposed dry panicle, not an identified species. Each stalk joins the
 * ground; six small opposing bracts break the silhouette without alpha. */
function seedStalk(batch: Batch, heightAt: HeightAt, east: number, north: number, height: number, azimuth: number, colour: Color): void {
  const base = new Vector3(east, heightAt(east, north) - 0.008, -north)
  const across = new Vector3(Math.cos(azimuth), 0, Math.sin(azimuth))
  const lean = new Vector3(-Math.sin(azimuth), 0, Math.cos(azimuth))
  const point = (t: number): Vector3 => base.clone().add(new Vector3(0, height * t, 0)).addScaledVector(lean, height * t * 0.10)
  const a = base.clone().addScaledVector(across, -0.0015)
  const b = base.clone().addScaledVector(across, 0.0015)
  const tip = point(1)
  const c = tip.clone().addScaledVector(across, 0.0006)
  const d = tip.clone().addScaledVector(across, -0.0006)
  face(batch, a, b, c, colour)
  face(batch, a, c, d, colour)
  for (let pair = 0; pair < 3; pair++) {
    const joint = point(0.70 + pair * 0.095)
    const axis = across.clone().applyAxisAngle(new Vector3(0, 1, 0), pair * 0.71)
    const spread = 0.014 - pair * 0.0025
    const peak = point(0.80 + pair * 0.09)
    face(batch, joint, joint.clone().addScaledVector(axis, -spread).add(new Vector3(0, height * 0.025, 0)), peak, colour)
    face(batch, joint, peak, joint.clone().addScaledVector(axis, spread).add(new Vector3(0, height * 0.025, 0)), colour.clone().multiplyScalar(1.08))
  }
}

/** Loose stone into a batch, with the stone's own rounded normals. */
function stoneInto(batch: Batch): Emit {
  return (a, b, c, na, nb, nc, colour) => {
    for (const [p, q] of [[a, na], [b, nb], [c, nc]] as const) {
      batch.positions.push(p[0], p[1], p[2]); batch.normals.push(q[0], q[1], q[2]); batch.colours.push(colour[0], colour[1], colour[2])
    }
  }
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

/** THE DRESSING IS LAID IN STEPS A LINE CAN COUNT. Sown in one call it was
 * 3.7 s of the wing's entry on the main thread, inside a task nothing could
 * report from, so the field's rule travelled through it without a number.
 * The work is the same work in the same order from the same seeds: the
 * generator below yields at its own seams, the caller runs one seam per
 * frame, and the count is fixed before the first one so a total never grows.
 */
export const GROUND_DRESSING_STEPS = 14
/** how many seams the meadow's sowing is cut at */
const TUFT_SLICES = 6

export interface DressingPlan { group: Group; steps: readonly (() => void)[] }

/** The whole dressing in one call, for anything that is not counting frames. */
export function createGroundDressing(heightAt: HeightAt, tier: TierName): Group {
  const plan = planGroundDressing(heightAt, tier)
  for (const step of plan.steps) step()
  return plan.group
}

export function planGroundDressing(heightAt: HeightAt, tier: TierName): DressingPlan {
  const group = new Group()
  group.name = 'vinci generated conjectural ground dressing'
  group.userData = { ...PROVENANCE }
  // The tier switch is empty as shipped: with nothing named, this is false
  // at every tier and the ground is sown as it always was.
  if (leftOutAtCalm(tier, 'ground-dressing')) {
    group.userData['leftOutAtCalm'] = true
    return { group, steps: Array.from({ length: GROUND_DRESSING_STEPS }, () => (): void => {}) }
  }
  const sowing = sow(group, heightAt, tier)
  // the last step drains what is left, so the plan finishes even if a seam
  // is never reached: a tier whose target is met early yields fewer times
  const steps = Array.from({ length: GROUND_DRESSING_STEPS }, (_, i) =>
    i === GROUND_DRESSING_STEPS - 1
      ? (): void => { while (!sowing.next().done); }
      : (): void => { sowing.next() })
  return { group, steps }
}

/** Coordinates stay east/north until converted at each vertex. All placement
 * fields are explicit museum assumptions outside masonry and walking surfaces. */
function* sow(group: Group, heightAt: HeightAt, tier: TierName): Generator<void, void, void> {
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
    ...getInnerCourtOutlines().map(court=>court.points),
    ...collectionExclusions.map(region=>region.points),
    ...collectionAccessExclusions.map(region=>region.points),
    ...getApronOutlines().map(apron=>apron.points),
    ...getPathCorridors().map(corridor => corridor.points),
    ...gateApproachRoute.slice(1).map((b, i) => routeStrip(gateApproachRoute[i]!, b, feature('gate-steps').width_m!.value)),
  ]
  const water = getWaterCuts().map(cut => cut.points)
  const clear = (east: number, north: number, margin = 0): boolean => {
    if (buildings.some(p => inside(east, north, p) || edgeDistance(east, north, p) < 0.65 + margin)) return false
    if (routes.some(p => inside(east, north, p) || edgeDistance(east, north, p) < 0.28 + margin)) return false
    if (water.some(p => inside(east, north, p) || edgeDistance(east, north, p) < 0.45 + margin)) return false
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

  yield

  // THE MEADOW, sown where the stops see it: a clump of blades every few
  // hand-widths near an eye, thinning with distance and behind the house.
  // Late October's sward is green below and straw above: blades greened at
  // the foot, seed stalks standing among them, shorter along every walked
  // edge where feet and scythes keep it down.
  const meadowRandom = randomSource(15171013)
  // each stop sows its own view, densest a few metres before its eye and
  // thinning as one over the square of the distance past four metres
  const perStop = calm ? 620 : tier === 'standard' ? 1800 : 3600
  const clumpTarget = perStop * STOP_EYES.length
  // past twenty metres a blade is under a pixel and the tuft cards carry
  // the sward, so the blades stop there at the same density before the eye
  const reach = 20, scale = 4, logSpan = Math.log(1 + (reach / scale) ** 2)
  let clumps = 0, blades = 0, seedStalks = 0, seam = 1
  for (let attempt = 0; attempt < clumpTarget; attempt++) {
    if (seam < TUFT_SLICES && attempt >= clumpTarget * seam / TUFT_SLICES) { seam++; yield }
    const stop = STOP_EYES[Math.floor(attempt / perStop)]!
    const r = scale * Math.sqrt(Math.exp(meadowRandom() * logSpan) - 1)
    const look = Math.atan2(stop.look[1], stop.look[0]), turn = (meadowRandom() - .5) * 2.1
    const east = stop.at[0] + Math.cos(look + turn) * r, north = stop.at[1] + Math.sin(look + turn) * r
    if (r < .9 || hidden(stop.at, [east, north])) continue
    if (!clear(east, north)) continue
    const eye = stopDistance(east, north)
    const edge = pathDistance(east, north)
    // rough where nothing walks: taller and straw-headed; low by the paths
    const rough = .5 + .5 * Math.sin(east * .83 + Math.sin(north * .37) * 2.1) * Math.cos(north * .71 - east * .23)
    const stature = (.09 + meadowRandom() ** .8 * .24) * (.7 + .6 * rough) * (edge < 1.3 ? .6 : 1)
    const angle = meadowRandom() * Math.PI * 2
    const count = 4 + Math.floor(meadowRandom() * 4) + (eye < 9 ? 2 : 0)
    const spread = .025 + meadowRandom() * .05
    for (let blade = 0; blade < count; blade++) {
      const a = meadowRandom() * Math.PI * 2, r = Math.sqrt(meadowRandom()) * spread
      const e = east + Math.cos(a) * r, n = north + Math.sin(a) * r
      const height = stature * (.55 + meadowRandom() * .75)
      const direction = angle + (meadowRandom() - .5) * 2.6
      const width = .003 + meadowRandom() ** 1.5 * .007
      const dry = meadowRandom() < .22 + .3 * rough
      const colour = dry ? STRAW[Math.floor(meadowRandom() * STRAW.length)]!.clone().multiplyScalar(.86 + meadowRandom() * .2)
        : GRASS[Math.floor(meadowRandom() * GRASS.length)]!.clone().multiplyScalar(.8 + meadowRandom() * .24)
      tuftBlade(plantBatch, heightAt, e, n, height, direction, width, colour)
      blades++
    }
    if (edge > 1.3 && meadowRandom() < .1 + .12 * rough) {
      const height = .22 + meadowRandom() * .3
      if (clear(east, north, height * .1 + .016)) {
        seedStalk(plantBatch, heightAt, east, north, height, angle, STRAW[1]!.clone().multiplyScalar(.9 + meadowRandom() * .18))
        seedStalks++
      }
    }
    clumps++
  }
  while (seam < TUFT_SLICES) { seam++; yield }
  yield

  // THE WALL FOOT: where no wheel and no foot goes, a strip of grass and
  // weeds stands along the foot of the house and its annexes, never in a
  // doorway or the gate; the museum's own walls keep theirs clean
  const verge = randomSource(15171042)
  const openings = [[16.1, -18.9], [3.85, -12.8], [18.3, -17.5], [15.9, -19.0]]
  let footTufts = 0
  for (const face of builtFaces()) {
    if (face.height !== 6 && face.height !== 3) continue
    const dx = face.to[0] - face.from[0], dn = face.to[1] - face.from[1], span = Math.hypot(dx, dn)
    const mid = [(face.from[0] + face.to[0]) / 2, (face.from[1] + face.to[1]) / 2]
    const seen = stageWeight(mid[0]! + face.low[0] * .3, mid[1]! + face.low[1] * .3)
    if (seen < .15) continue
    const count = Math.round(span * (calm ? 2 : 7) * seen)
    for (let k = 0; k < count; k++) {
      const t = verge(), off = .04 + verge() ** 1.6 * .3
      const east = face.from[0] + dx * t + face.low[0] * off, north = face.from[1] + dn * t + face.low[1] * off
      if (openings.some(([e, n]) => Math.hypot(east - e!, north - n!) < 1.4)) continue
      if (buildings.some(p => inside(east, north, p)) || water.some(p => inside(east, north, p))) continue
      const tall = (.05 + verge() ** 1.4 * .16) * (1 - off * 1.2)
      const blades = 3 + Math.floor(verge() * 4), angle = verge() * Math.PI * 2
      for (let b = 0; b < blades; b++) {
        const colour = (verge() < .3 ? STRAW : GRASS)[Math.floor(verge() * 5)]!.clone().multiplyScalar(.78 + verge() * .2)
        tuftBlade(plantBatch, heightAt, east + (verge() - .5) * .04, north + (verge() - .5) * .04, tall * (.6 + verge() * .6),
          angle + b * 2.1 + verge() * .5, .003 + verge() * .006, colour)
      }
      footTufts++
    }
  }

  // THE SWARD'S TUFTS as cards: the cover a meadow has, which single blades
  // cannot give past a few metres; larger with distance so the far sward
  // keeps its cover
  const cards: CardBatch = { position: [], normal: [], colour: [], uv: [] }
  const cardRandom = randomSource(15171041)
  const cardsPerStop = calm ? 0 : tier === 'standard' ? 1500 : 2600
  const cardReach = 46, cardScale = 8, cardSpan = Math.log(1 + (cardReach / cardScale) ** 2)
  let tufted = 0
  for (let attempt = 0; attempt < cardsPerStop * STOP_EYES.length; attempt++) {
    const stop = STOP_EYES[Math.floor(attempt / cardsPerStop)]!
    const r = cardScale * Math.sqrt(Math.exp(cardRandom() * cardSpan) - 1)
    const look = Math.atan2(stop.look[1], stop.look[0]), turn = (cardRandom() - .5) * 2.1
    const east = stop.at[0] + Math.cos(look + turn) * r, north = stop.at[1] + Math.sin(look + turn) * r
    const pick = cardRandom(), size = cardRandom(), tone = cardRandom(), spin = cardRandom()
    if (r < 1.2 || hidden(stop.at, [east, north]) || !clear(east, north, .12)) continue
    const edge = pathDistance(east, north)
    const rough = .5 + .5 * Math.sin(east * .83 + Math.sin(north * .37) * 2.1) * Math.cos(north * .71 - east * .23)
    const set = edge < 1.3 ? GRASS_CELLS.bent : rough > .62 && pick < .7 ? GRASS_CELLS.seeding : pick < .45 ? GRASS_CELLS.green : GRASS_CELLS.mixed
    const cell = set[Math.floor(cardRandom() * set.length)]!
    const grow = 1 + r / 20
    const width = (.24 + size * .2) * grow, height = (.17 + size * .2) * (edge < 1.3 ? .7 : .8 + .4 * rough) * (1 + r / 32)
    const k = .86 + tone * .26
    tuftCards(cards, heightAt, east, north, width, height, spin * Math.PI, cell, [k, k * (1.01 + rough * .03), k * .97], height * (.08 + tone * .12))
    tufted++
  }
  yield

  const chipTarget = calm ? 500 : 1400
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
    // worn river gravel of 15 to 65 mm, lying flat and bedded in the earth
    const size = 0.015 + random() ** 2 * 0.05
    if (!pebble(stoneInto(mineralBatch), heightAt, east, north, size, 0.28 + random() * 0.16, random() * Math.PI * 2,
      5, size * 0.07, stoneColour(random(), random()), random, (e, n) => clear(e, n))) continue
    chips++
  }

  yield

  const plants = meshFrom(plantBatch, 'vinci October meadow')
  if (cards.position.length) group.add(...partitionGroundDressing(cardMesh(cards, 'vinci October meadow tufts'), tier === 'hero' ? 3 : 1))
  group.add(...partitionGroundDressing(plants, calm ? 1 : tier === 'standard' ? 2 : 4, tier === 'hero' ? 8 : 0))
  group.add(meshFrom(mineralBatch, 'vinci pale mineral path-edge gravel'))
  if (!calm) group.add(createMoss(tier))
  group.add(createCopings(tier))
  group.add(createCreepers(tier, (e, n) => routes.some(p => inside(e, n, p) || edgeDistance(e, n, p) < 1)))
  group.userData['draws'] = group.children.length
  group.userData['triangles'] = (plantBatch.positions.length + mineralBatch.positions.length) / 9
  group.userData['counts'] = { clumps, blades, seedStalks, chips, tufted, footTufts }
  group.userData['tier'] = tier
  group.userData['patches'] = PATCHES.map(p => ({ ...p }))
  group.userData['excluded'] = ['cadastre', 'build envelope', 'mapped annexes', 'courtyard', 'terrace', 'street', 'street grade', 'house-side apron', 'gate approach', 'gate steps', 'garden descent', 'retained water cuts']
}
