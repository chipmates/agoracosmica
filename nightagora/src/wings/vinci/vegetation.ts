/* THE TREES OF THE SITE, 10 OCTOBER 1517 (our 20 October).

   Every tree here is a TYPE of the period, grown from its species' habit as
   the flora card gives the species and its state that week
   (refs FLORA.md §6): no source records what grew at Cloux, so no tree is a
   record of one that stood there, and every position and size is the
   exhibition's choice. The trees are GENERATED and conjectural.

   What binds them: the walls (no crown grows through a house), the certified
   walks (no leaf and no limb within a walker's clearance over a pad, a path,
   a stair or the insertion), and the tiers (hero grows the whole tree for the
   film, every other tier keeps fewer of the same limbs and draws its leaves
   larger so a crown keeps its cover). */
import {
  BufferAttribute, BufferGeometry, DoubleSide, Float32BufferAttribute, Group, Mesh, MeshBasicNodeMaterial,
  MeshStandardNodeMaterial, PhysicalLightingModel, Uint32BufferAttribute,
} from 'three/webgpu'
import { attribute, diffuseColor, normalMap, normalView, positionWorld, texture, uv, vec2, vec3 } from 'three/tsl'
import { SHADOW_ONLY_LAYER } from '../../stack/light'
import { leftOutAtCalm } from './calm-tier'
import { barkMaps, cellUV, leafAtlas, leafCell } from './leaf-maps'
import type { TierName } from '../../stack/tier'
import { dossier, edgeDistance, feature, hourKey, inside, polygon, type Quantity } from './site'
import { collectionExclusions } from './collection'
import { collectionAccessExclusions } from './collection-access'
import { COURT, SUPPER_WALL } from './collection/layout'
import { getInnerCourtOutlines } from './inner-court'
import { getApronOutlines } from './apron'
import { getWaterCuts } from './water'
import { getPathCorridors } from './paths'
import { gateApproachRoute } from './terrain-mesh'
import {
  Body, fallenLeaf, fallenPalette, growTree, leafLengthOf, mulberry,
  type Refuse, type Species, type TreeDetail, type TreeResult, type TreeSpec, type TreeTier,
} from './tree-growth'
import { createFallingLeaves, windPosition, windWanted, type FallSource } from './wind'

const PROVENANCE = {
  manifestId: 'vinci/vegetation',
  assetClass: 'GENERATED',
  certainty: 'conjectural',
  basis: 'Flora card FLORA.md §6 (species and their state about 20 October, all types for Cloux, none documented there); modern garden plates Q119, Q128 and Q178 for the branching character only. Planting positions and tree dimensions are not period evidence.',
  recipe: 'Deterministic trees grown per species habit (types of the flora card): a trunk that runs or forks into leaders, scaffold limbs that fork toward the crown the species makes, second-order branches and twigs, each grown segment by segment and stopped at the crown skin or at a refused place. Every leaf of a near crown is its own card of its species outline (a compound leaf for walnut); a crown further off is carried by spray cards of the same leaf; the count follows the crown skin and the share the week has taken; each leaf turns its face to the light out of the crown and takes its colour from the species palette of the week by how far it has turned. Bark as tubes with shared rings and a flared foot sunk into the sampled ground. Leaf and bark maps are drawn from recipes in code. Leaves carry the key light through themselves and cast through one opaque triangle inside each outline. Fallen leaves lie under and downwind of each crown, a third kept on walked pads, and along the north and west walls of the insertion court. No leaf or limb stands inside a building or within 3.2 m above a certified walking surface. Wind only on an address that asks for it.',
}

/* ─── the planting ─────────────────────────────────────────────────────── */

/** Where each tree stands: a type of the period in the place the flora card
    gives its species (a walnut in a yard, elms by the road, alder, willow
    and poplar at the Amasse, oak and hornbeam on the slopes, fruit trees in
    the garden square). East and north in the wing's metres. */
const PLANTING: readonly TreeSpec[] = [
  // the garden front: a walnut in the meadow under the terrace wall, and a
  // field maple at the court's south corner
  // (its crown stays left of the garden front: the eight principal windows
  // stand clear of leaves in both framings)
  { id: 'meadow-walnut', species: 'walnut', east: -28.6, north: -20.2, height: 13.6, seed: 71517, detail: 'near', lean: [-.6, .4] },
  { id: 'court-maple', species: 'maple', east: -8.2, north: -36.6, height: 9.8, seed: 10151, detail: 'near', lean: [-.5, -.4] },
  // the road: a walnut in the yard across the street from the gate, leaning
  // over the road to the light, and a field elm further up the road
  { id: 'street-walnut', species: 'walnut', east: 22.4, north: -3.4, height: 14.5, seed: 15170, detail: 'near', lean: [-3, -1.6], spread: 1.12 },
  { id: 'street-elm', species: 'elm', east: 17.2, north: 24.5, height: 21, seed: 15171, detail: 'mid', lean: [-.8, 0] },
  // the garden square's fruit trees
  { id: 'square-pear-1', species: 'pear', east: -24.8, north: 3.6, height: 8.2, seed: 2201, detail: 'mid' },
  { id: 'square-pear-2', species: 'pear', east: -17.8, north: 12.8, height: 7.4, seed: 2202, detail: 'mid' },
  { id: 'square-walnut', species: 'walnut', east: -11.2, north: -1.6, height: 11.5, seed: 2203, detail: 'mid' },
  // the meadow between the terrace and the insertion's court
  { id: 'meadow-hornbeam', species: 'hornbeam', east: -40.5, north: -12.5, height: 12.5, seed: 3301, detail: 'mid' },
  { id: 'meadow-cherry', species: 'cherry', east: -52.5, north: -9.5, height: 13.5, seed: 3302, detail: 'mid' },
  // the Amasse: alders and pollard willows at the water, black poplars and
  // an elm behind them
  { id: 'amasse-poplar-1', species: 'poplar', east: -64.5, north: -46, height: 23, seed: 4401, detail: 'mid' },
  { id: 'amasse-alder-1', species: 'alder', east: -68.5, north: -33, height: 14, seed: 4402, detail: 'mid' },
  { id: 'amasse-willow-1', species: 'willow', east: -70.5, north: -24.5, height: 7.2, seed: 4403, detail: 'mid', pollard: true },
  { id: 'amasse-poplar-2', species: 'poplar', east: -63.5, north: -17, height: 24.5, seed: 4404, detail: 'mid' },
  { id: 'amasse-alder-2', species: 'alder', east: -69.5, north: -7, height: 13, seed: 4405, detail: 'mid' },
  { id: 'amasse-willow-2', species: 'willow', east: -70, north: 3, height: 6.8, seed: 4406, detail: 'mid', pollard: true },
  { id: 'amasse-elm', species: 'elm', east: -62, north: 18, height: 21, seed: 4407, detail: 'mid' },
  { id: 'amasse-alder-3', species: 'alder', east: -66.5, north: -58, height: 13.5, seed: 4408, detail: 'far' },
  // the six trees of the middle distance, at the positions the planting
  // record declares
  { id: 'middle-1', species: 'oak', east: -53, north: 12, height: 12.4, seed: 31417, detail: 'mid' },
  { id: 'middle-2', species: 'elm', east: -49, north: 44, height: 15.6, seed: 31953, detail: 'far' },
  { id: 'middle-3', species: 'walnut', east: -21, north: 65, height: 10.8, seed: 32739, detail: 'far' },
  { id: 'middle-4', species: 'poplar', east: 30, north: 66, height: 17.2, seed: 33287, detail: 'far' },
  { id: 'middle-5', species: 'cherry', east: 39, north: 54, height: 13.6, seed: 33917, detail: 'far' },
  { id: 'middle-6', species: 'oak', east: 53, north: 24, height: 15.1, seed: 34713, detail: 'far' },
]

/** The open woodland of the distance: oak and hornbeam on the slopes, cherry
    and field maple at the wood's edge, walnut in the fields. */
function distantPlanting(): TreeSpec[] {
  const place = mulberry(73821)
  const plans: TreeSpec[] = []
  const woods: Species[] = ['oak', 'oak', 'hornbeam', 'oak', 'maple', 'cherry', 'walnut', 'oak']
  for (let i = 0; i < 24; i++) {
    const bank = i % 3
    const east = bank === 0 ? 72 + place() * 88 : bank === 1 ? -88 - place() * 70 : -75 + place() * 215
    const north = bank === 2 ? -148 - place() * 66 : -135 + place() * 255
    const species = woods[Math.floor(place() * woods.length)]!
    plans.push({ id: `distant-${i + 1}`, species, east, north, height: 11.5 + place() * 9.5, seed: 2103 + i * 347, detail: 'far' })
  }
  return plans
}

/* ─── what growth refuses ──────────────────────────────────────────────── */

/** A walker's clearance over a walking surface: no leaf or limb below this
    height above the grade within its margin. */
const WALK_CLEAR_M = 3.2
const WALK_MARGIN_M = 1.0
const BUILDING_MARGIN_M = .45

interface Region { points: number[][]; minE: number; maxE: number; minN: number; maxN: number }
function region(points: number[][]): Region {
  return { points, minE: Math.min(...points.map(p => p[0]!)), maxE: Math.max(...points.map(p => p[0]!)), minN: Math.min(...points.map(p => p[1]!)), maxN: Math.max(...points.map(p => p[1]!)) }
}
function near(r: Region, e: number, n: number, margin: number): boolean {
  if (e < r.minE - margin || e > r.maxE + margin || n < r.minN - margin || n > r.maxN + margin) return false
  return inside(e, n, r.points) || edgeDistance(e, n, r.points) < margin
}
function strip(a: readonly number[], b: readonly number[], width: number): number[][] {
  const dx = b[0]! - a[0]!, dn = b[1]! - a[1]!, length = Math.hypot(dx, dn)
  const e = -dn / length * width / 2, n = dx / length * width / 2
  return [[a[0]! + e, a[1]! + n], [b[0]! + e, b[1]! + n], [b[0]! - e, b[1]! - n], [a[0]! - e, a[1]! - n]]
}

function refusals(heightAt: (east: number, north: number) => number) {
  const buildings = [
    dossier.site.footprint.map(p => p.value),
    dossier.site.build_envelope.map(p => p.value),
    ...dossier.site.features.filter(f => f.id.startsWith('annex-')).map(f => (f.geometry as Quantity<number[]>[]).map(p => p.value)),
    ...collectionExclusions.filter(r => r.id !== 'collection-approach-and-cheeks').map(r => r.points),
  ].map(region)
  const walks = [
    ...['courtyard', 'terrace', 'street-grade'].map(polygon),
    ...getInnerCourtOutlines().map(c => c.points),
    ...getApronOutlines().map(a => a.points),
    ...collectionExclusions.filter(r => r.id === 'collection-approach-and-cheeks').map(r => r.points),
    ...collectionAccessExclusions.map(r => r.points),
    ...getPathCorridors().map(c => c.points),
    ...gateApproachRoute.slice(1).map((b, i) => strip(gateApproachRoute[i]!, b, feature('gate-steps').width_m!.value)),
  ].map(region)
  const water = getWaterCuts().map(c => region(c.points))
  // the insertion's open court carries its own floor, not the hill's grade
  const court = region([[COURT.west, COURT.south], [COURT.east, COURT.south], [COURT.east, COURT.north], [COURT.west, COURT.north]])
  /** a crown point: refused inside a building or low over a walk */
  const refuse = (x: number, y: number, z: number): boolean => {
    const e = x, n = -z
    if (buildings.some(r => near(r, e, n, BUILDING_MARGIN_M))) return true
    if (walks.some(r => near(r, e, n, WALK_MARGIN_M)) && y < heightAt(e, n) + WALK_CLEAR_M) return true
    if (near(court, e, n, WALK_MARGIN_M) && y < COURT.level + WALK_CLEAR_M + .4) return true
    return false
  }
  /** the same refusal over only the regions a tree of this reach can meet,
      so a tree far from the house pays nothing; a point beyond the reach
      asks the whole site, so the answer never differs */
  const around = (e0: number, n0: number, reach: number): Refuse => {
    const meets = (r: Region, m: number): boolean =>
      r.maxE + m > e0 - reach && r.minE - m < e0 + reach && r.maxN + m > n0 - reach && r.minN - m < n0 + reach
    const b = buildings.filter(r => meets(r, BUILDING_MARGIN_M)), w = walks.filter(r => meets(r, WALK_MARGIN_M))
    const c = meets(court, WALK_MARGIN_M)
    return (x, y, z) => {
      const e = x, n = -z
      if (Math.abs(e - e0) > reach || Math.abs(n - n0) > reach) return refuse(x, y, z)
      if (b.some(r => near(r, e, n, BUILDING_MARGIN_M))) return true
      if (w.some(r => near(r, e, n, WALK_MARGIN_M)) && y < heightAt(e, n) + WALK_CLEAR_M) return true
      return c && near(court, e, n, WALK_MARGIN_M) && y < COURT.level + WALK_CLEAR_M + .4
    }
  }
  /** a trunk or a fallen leaf on open ground */
  const openGround = (e: number, n: number, margin: number): boolean =>
    !buildings.some(r => near(r, e, n, margin)) && !walks.some(r => near(r, e, n, margin)) && !water.some(r => near(r, e, n, margin * .5))
  const onBuilding = (e: number, n: number): boolean => buildings.some(r => near(r, e, n, .05))
  const onWater = (e: number, n: number): boolean => water.some(r => near(r, e, n, .1))
  const onWalk = (e: number, n: number): boolean => walks.some(r => near(r, e, n, 0))
  return { refuse, around, openGround, onBuilding, onWater, onWalk, walks, buildings }
}

/* ─── the clusters ─────────────────────────────────────────────────────── */

/** Trees are dealt into spatial clusters so the frustum can refuse a far
    cluster whole: a cut along whichever axis is longer, down to `leaves`. */
function clusterTrees(trees: readonly TreeSpec[], leaves: number): number[] {
  const out = new Array<number>(trees.length).fill(0)
  let next = 0
  const split = (ids: number[], parts: number): void => {
    if (parts <= 1 || ids.length <= 1) { for (const id of ids) out[id] = next; next++; return }
    const es = ids.map(i => trees[i]!.east), ns = ids.map(i => trees[i]!.north)
    const axis = Math.max(...es) - Math.min(...es) >= Math.max(...ns) - Math.min(...ns) ? 'east' : 'north'
    const sorted = [...ids].sort((a, b) => trees[a]![axis] - trees[b]![axis] || a - b)
    const half = Math.floor(sorted.length / 2)
    split(sorted.slice(0, half), Math.floor(parts / 2)); split(sorted.slice(half), parts - Math.floor(parts / 2))
  }
  split(trees.map((_, i) => i), leaves)
  return out
}

/* ─── the materials ────────────────────────────────────────────────────── */

/** The live engine's crown occlusion on the sky's share of the light: the
    film's export turns it off and lets its renderer find the occlusion. */
const ENGINE_TERMS = !(typeof location !== 'undefined' && new URLSearchParams(location.search).has('export'))

/** A leaf is thin: the light that reaches its lit face comes through to the
    other face, deepened and saturated by the blade. Driven by each light as
    it arrives (its colour already carries its shadow), never by a fixed
    direction. */
class LeafLightingModel extends PhysicalLightingModel {
  override direct(input: Parameters<PhysicalLightingModel['direct']>[0], builder: Parameters<PhysicalLightingModel['direct']>[1]): void {
    super.direct(input, builder)
    const { lightDirection, lightColor, reflectedLight } = input as unknown as {
      lightDirection: ReturnType<typeof vec3>; lightColor: ReturnType<typeof vec3>; reflectedLight: { directDiffuse: ReturnType<typeof vec3> }
    }
    const through = normalView.dot(lightDirection).negate().clamp()
    const albedo = diffuseColor.rgb
    const carried = albedo.mul(albedo).mul(1.5).add(albedo.mul(.3))
    reflectedLight.directDiffuse.addAssign(through.mul(lightColor).mul(carried).mul(1 / Math.PI))
  }
}
class LeafMaterial extends MeshStandardNodeMaterial {
  override setupLightingModel(): PhysicalLightingModel { return new LeafLightingModel() }
}

/** The direction toward the sun of the hour, for one thing only: a leaf's
    shadow lookup steps toward it so a blade is not shadowed by itself. */
const SUN_TOWARD = ((azimuth: number, elevation: number) => {
  const az = azimuth * Math.PI / 180, el = elevation * Math.PI / 180
  return [Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)] as const
})(hourKey.sun_azimuth_deg.value, hourKey.sun_elevation_deg.value)

function materials(wind: boolean) {
  const barkSet = barkMaps(), leafSet = leafAtlas()
  const bark = new MeshStandardNodeMaterial({ vertexColors: true, roughness: .93 })
  bark.name = 'vinci generated bark'
  bark.userData = { ...PROVENANCE }
  bark.colorNode = texture(barkSet.albedo, uv())
  bark.normalNode = normalMap(texture(barkSet.normal, uv()), vec2(.9, .9))
  if (ENGINE_TERMS) bark.aoNode = attribute('ao', 'float')
  const leaves = new LeafMaterial({ vertexColors: true, roughness: .6, side: DoubleSide, alphaTest: .42 })
  leaves.alphaToCoverage = true
  leaves.name = 'vinci generated October leaves'
  leaves.userData = { ...PROVENANCE }
  leaves.colorNode = texture(leafSet.albedo, uv())
  leaves.normalNode = normalMap(texture(leafSet.normal, uv()), vec2(.6, .6))
  if (ENGINE_TERMS) leaves.aoNode = attribute('ao', 'float')
  leaves.receivedShadowPositionNode = positionWorld.add(vec3(SUN_TOWARD[0], SUN_TOWARD[1], SUN_TOWARD[2]).mul(.06))
  const litter = new MeshStandardNodeMaterial({ vertexColors: true, roughness: .88, side: DoubleSide, alphaTest: .42 })
  litter.alphaToCoverage = true
  litter.name = 'vinci generated fallen leaves'
  litter.userData = { ...PROVENANCE }
  litter.colorNode = texture(leafSet.albedo, uv())
  if (ENGINE_TERMS) litter.aoNode = attribute('ao', 'float')
  // the leaf's shadow is an opaque triangle inside its outline, drawn only in
  // the sun's own pass, so the leaves fold into the wing's one shadow body
  const shade = new MeshBasicNodeMaterial({ colorWrite: false, depthWrite: false, side: DoubleSide })
  shade.name = 'vinci generated leaf shadows'
  shade.shadowSide = DoubleSide
  if (wind) {
    const moved = windPosition()
    bark.positionNode = moved
    leaves.positionNode = moved
    shade.positionNode = moved
    shade.castShadowPositionNode = moved
  }
  return { bark, leaves, litter, shade }
}

function meshOf(body: Body, material: MeshStandardNodeMaterial | MeshBasicNodeMaterial, name: string, casts: boolean): Mesh | null {
  if (!body.triangles) return null
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(body.position.view(), 3))
  geometry.setAttribute('normal', new Float32BufferAttribute(body.normal.view(), 3))
  // a leaf's shadow triangle carries its place and its wind, nothing else
  if (body.colour.length) geometry.setAttribute('color', new BufferAttribute(body.colour.view(), 4, true))
  if (body.uv.length) geometry.setAttribute('uv', new Float32BufferAttribute(body.uv.view(), 2))
  if (body.ao.length) geometry.setAttribute('ao', new Float32BufferAttribute(body.ao.view(), 1))
  geometry.setAttribute('wind', new BufferAttribute(body.wind.view(), 4, true))
  geometry.setIndex(new Uint32BufferAttribute(body.index.view(), 1))
  geometry.computeBoundingSphere()
  const mesh = new Mesh(geometry, material)
  mesh.name = name
  mesh.castShadow = casts
  mesh.receiveShadow = true
  mesh.userData = { ...PROVENANCE }
  return mesh
}

/* ─── the steps ────────────────────────────────────────────────────────── */

/** THE WOOD IS GROWN IN STEPS A LINE CAN COUNT: the same trees, the same
    order, the same seeds, dealt into frames by the caller, the count fixed
    before the first one. */
export const VEGETATION_STEPS = 8
const TREE_BANKS = 6

export interface VegetationPlan { group: Group; steps: readonly (() => void)[] }

export function createVegetation(heightAt: (east: number, north: number) => number, tier: TierName): Group {
  const plan = planVegetation(heightAt, tier)
  for (const step of plan.steps) step()
  return plan.group
}

export function planVegetation(heightAt: (east: number, north: number) => number, tier: TierName): VegetationPlan {
  const group = new Group()
  group.name = 'vinci generated conjectural landscape trees'
  group.userData = { ...PROVENANCE }
  if (leftOutAtCalm(tier, 'vegetation')) {
    group.userData['leftOutAtCalm'] = true
    return { group, steps: Array.from({ length: VEGETATION_STEPS }, () => (): void => {}) }
  }
  const growing = grow(group, heightAt, tier as TreeTier)
  const steps = Array.from({ length: VEGETATION_STEPS }, (_, i) =>
    i === VEGETATION_STEPS - 1 ? (): void => { while (!growing.next().done); } : (): void => { growing.next() })
  return { group, steps }
}

function* grow(group: Group, heightAt: (east: number, north: number) => number, tier: TreeTier): Generator<void, void, void> {
  const { around, openGround, onBuilding, onWater, onWalk } = refusals(heightAt)
  const planted = [...PLANTING, ...distantPlanting()].filter(spec => openGround(spec.east, spec.north, Math.max(.8, spec.height * .03)))
  // the house's own trees and the valley's woods are dealt apart, so a view
  // of the house refuses the woods whole; the woods cast no shadow the walk
  // could see (it falls a hundred metres off, outside every cascade)
  const nearIds = planted.map((spec, i) => spec.detail === 'far' ? -1 : i).filter(i => i >= 0)
  const farIds = planted.map((spec, i) => spec.detail === 'far' ? i : -1).filter(i => i >= 0)
  const nearClusters = tier === 'calm' ? 3 : 6, farClusters = tier === 'calm' ? 1 : 3
  const clusters = nearClusters + farClusters
  const clusterOf = new Array<number>(planted.length).fill(0)
  clusterTrees(nearIds.map(i => planted[i]!), nearClusters).forEach((c, k) => { clusterOf[nearIds[k]!] = c })
  clusterTrees(farIds.map(i => planted[i]!), farClusters).forEach((c, k) => { clusterOf[farIds[k]!] = nearClusters + c })
  const casting = (c: number): boolean => tier !== 'calm' && c < nearClusters
  const bark = Array.from({ length: clusters }, () => new Body())
  // a casting cluster keeps its fine wood apart: a twig's shadow is under a
  // texel of the sun's map and inside its crown's leaf shadow
  const fine = Array.from({ length: clusters }, (_, c) => casting(c) ? new Body() : null)
  const leaves = Array.from({ length: clusters }, () => new Body())
  // calm draws no sun shadows, so it carries no leaf shadows either
  const shadows = Array.from({ length: clusters }, (_, c) => casting(c) ? new Body() : null)
  const results: TreeResult[] = []
  yield
  let bank = 1
  for (const [i, spec] of planted.entries()) {
    if (bank < TREE_BANKS && i >= planted.length * bank / TREE_BANKS) { bank++; yield }
    const c = clusterOf[i]!
    const refuse = around(spec.east, spec.north, spec.height * 1.3 + 4)
    results.push(growTree(spec, tier, heightAt, refuse, bark[c]!, fine[c] ?? bark[c]!, leaves[c]!, shadows[c]!))
  }
  while (bank < TREE_BANKS) { bank++; yield }

  // THE FALLEN LEAVES: under each crown and pushed downwind of it, fewer on
  // the paths and pads where feet and wheels move them to the edges
  const litterClusters = tier === 'calm' ? 2 : 4
  const litterBodies = Array.from({ length: litterClusters }, () => new Body())
  const litterOf = clusterTrees(planted, litterClusters)
  const share = tier === 'hero' ? 1 : tier === 'standard' ? .45 : .22
  const grow = tier === 'hero' ? 1 : tier === 'standard' ? 1.35 : 1.8
  const inCourt = (e: number, n: number): boolean =>
    e > COURT.west + .5 && e < COURT.east - .5 && n > COURT.south + .5 && n < COURT.north - .5
  /** the floor a fallen leaf lies on: the court's own paving inside the
      insertion's court (its grave half a step up), the shared grade elsewhere */
  const floorAt = (e: number, n: number): number =>
    inCourt(e, n) ? COURT.level + (e < SUPPER_WALL.east ? .035 : 0) : heightAt(e, n)
  const lay = (body: Body, species: Species, e: number, n: number, colours: readonly (readonly [number, number, number])[], weights: readonly number[],
    random: () => number): void => {
    const total = weights.reduce((a, b) => a + b, 0)
    const pick = random(), turn = random(), curl = random(), size = random()
    let w = pick * total, ci = 0
    while (ci < weights.length - 1 && w > weights[ci]!) { w -= weights[ci]!; ci++ }
    const base = colours[ci]!, lift = .78 + turn * .38
    fallenLeaf(body, species, e, n, floorAt(e, n), turn * Math.PI * 2, leafLengthOf(species) * 1.1 * grow * (.8 + size * .45),
      [base[0] * lift, base[1] * lift, base[2] * lift], .06 + curl * .22)
  }
  for (const [i, result] of results.entries()) {
    const spec = result.spec
    if (spec.detail === 'far') continue
    const random = mulberry(spec.seed ^ 0x9e3779b9)
    const { colours, weights } = fallenPalette(spec.species)
    const radius = result.crown.radius
    // the heaviest fall is under the early droppers (FLORA §1)
    const count = Math.round((spec.detail === 'near' ? 5200 : 1500) * (.12 + result.fallen) * 1.6 * Math.min(1.8, radius / 5))
    const body = litterBodies[litterOf[i]!]!
    // under the crown, which leans with its tree, and pushed north-east by
    // the week's south-west wind
    const cx = result.crown.cx + Math.sin(52 * Math.PI / 180) * radius * .3
    const cn = -result.crown.cz + Math.cos(52 * Math.PI / 180) * radius * .3
    for (let k = 0; k < count; k++) {
      const a = random() * Math.PI * 2, rr = radius * 1.3 * Math.sqrt(random()), keep = random(), walked = random()
      if (keep > share) continue
      const e = cx + Math.cos(a) * rr, n = cn + Math.sin(a) * rr
      if (onBuilding(e, n) || onWater(e, n)) continue
      // a walked surface keeps a third of what falls on it; a court keeps it
      // at its walls, where the wind leaves it
      if (onWalk(e, n) && walked > .33) continue
      if (inCourt(e, n) && walked > .5) continue
      lay(body, spec.species, e, n, colours, weights, random)
    }
  }
  // THE COURT'S WALL FOOT: what the wind has carried over the insertion's
  // west wall from the Amasse's poplars and alders lies along its north and
  // west walls, clear of every stand in the court
  {
    const random = mulberry(15171020)
    const poplar = fallenPalette('poplar'), alder = fallenPalette('alder')
    const count = Math.round(520 * share)
    const body = litterBodies[0]!
    for (let k = 0; k < count; k++) {
      const u = random(), v = random(), which = random()
      const alongNorth = u < .62
      const e = alongNorth ? COURT.west + .7 + v * (COURT.east - COURT.west - 1.4) : COURT.west + .6 + Math.pow(random(), 2) * 1.4
      const n = alongNorth ? COURT.north - .6 - Math.pow(random(), 2) * 1.5 : COURT.south + .8 + v * (COURT.north - COURT.south - 1.6)
      const palette = which < .7 ? poplar : alder
      lay(body, which < .7 ? 'poplar' : 'alder', e, n, palette.colours, palette.weights, random)
    }
  }
  yield
  const wind = windWanted()
  const mats = materials(wind)
  const casts = tier !== 'calm'
  const meshes: Mesh[] = []
  for (let c = 0; c < clusters; c++) {
    const b = meshOf(bark[c]!, mats.bark, `vinci generated trunks and limbs cluster ${String(c + 1).padStart(2, '0')}`, casts && casting(c))
    const f = fine[c] ? meshOf(fine[c]!, mats.bark, `vinci generated branches and twigs cluster ${String(c + 1).padStart(2, '0')}`, false) : null
    const l = meshOf(leaves[c]!, mats.leaves, `vinci generated leaves cluster ${String(c + 1).padStart(2, '0')}`, false)
    if (b) meshes.push(b)
    if (f) meshes.push(f)
    if (l) meshes.push(l)
    const s = shadows[c] ? meshOf(shadows[c]!, mats.shade, `vinci generated leaf shadows cluster ${String(c + 1).padStart(2, '0')}`, true) : null
    if (s) { s.receiveShadow = false; s.layers.set(SHADOW_ONLY_LAYER); meshes.push(s) }
  }
  for (let c = 0; c < litterClusters; c++) {
    const m = meshOf(litterBodies[c]!, mats.litter, `vinci generated fallen leaves cluster ${String(c + 1).padStart(2, '0')}`, false)
    if (m) meshes.push(m)
  }
  group.add(...meshes)
  // THE FILM'S FEW FALLING LEAVES, from the outer crowns of the trees the walk
  // stands near, landing downwind of them; only a page with the wind has them
  if (wind && tier !== 'calm') {
    const random = mulberry(15171023)
    const sources: FallSource[] = []
    for (const result of results) {
      if (result.spec.detail === 'far') continue
      const c = result.crown, { colours } = fallenPalette(result.spec.species)
      for (let k = 0; k < (result.spec.detail === 'near' ? 10 : 3); k++) {
        const a = random() * Math.PI * 2, h = .35 + random() * .5
        const x = c.cx + Math.cos(a) * c.radius * .85, z = c.cz + Math.sin(a) * c.radius * .85, y = c.y0 + (c.y1 - c.y0) * h
        const landE = x + 2.2, landN = -z + 1.7
        const colour = colours[Math.floor(random() * colours.length)]!
        sources.push({ x, y, z, ground: heightAt(landE, landN), colour: [colour[0], colour[1], colour[2]], uv: cellUV(leafCell(result.spec.species)) })
      }
    }
    group.add(createFallingLeaves(sources, tier === 'hero' ? 64 : 32, leafAtlas().albedo))
  }
  let triangles = 0
  for (const mesh of meshes) triangles += (mesh.geometry.getIndex()?.count ?? 0) / 3
  group.userData['trees'] = results.length
  group.userData['triangles'] = triangles
  group.userData['draws'] = meshes.filter(m => !m.layers.isEnabled(SHADOW_ONLY_LAYER) || m.layers.isEnabled(0)).length
  group.userData['leaves'] = results.reduce((a, r) => a + r.leaves, 0)
  group.userData['treePlans'] = results.map(r => ({ id: r.spec.id, species: r.spec.species, east: r.spec.east, north: r.spec.north, height: r.spec.height, spread: r.crown.radius, detail: r.spec.detail, seed: r.spec.seed }))
  group.userData['perTree'] = results.map(r => ({ id: r.spec.id, leaves: r.leaves, leafTriangles: r.leafTriangles, barkTriangles: r.barkTriangles }))
  group.userData['excluded'] = ['cadastre', 'build envelope', 'mapped annexes', 'the insertion', `walks below ${WALK_CLEAR_M} m`, 'retained water cuts']
  group.userData['wind'] = wind
}

export type { TreeDetail }
