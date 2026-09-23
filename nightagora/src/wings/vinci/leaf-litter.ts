/* THE FALLEN LEAVES, AS GROUND.

   What has fallen that week lies where the trees and the wind put it. Under
   each crown that is dropping it lies a carpet, thickest under the crown's
   middle and carried north-east by the week's south-west wind. What the wind
   moves on comes to rest against whatever stops it: the foot of a wall, the
   back of a stair tread against the riser above, a kerb, a retaining face.
   There it lies in a drift, deepest against the face and in its corners,
   some leaves leaning on the face, the lowest layer dark and damp, the top
   one the week's fresh fall. A walked surface keeps a little of what falls
   on it; feet and wheels move the rest to its edges.

   Every leaf is a card of its species' outline, folded along its midrib as
   a drying leaf folds, its colour from the fall of its own tree. The amount
   and the places are this exhibition's reading of one October week, never
   a record. The drifts are densest where the walk's stops look; the carpet
   is laid wherever a crown drops it. */
import { cellUV, LEAF_RECIPES, leafCell } from './leaf-maps'
import { Body, fallenPalette, leafLengthOf, mulberry, type Species, type TreeResult, type TreeTier } from './tree-growth'
import { terrainSteps } from './terrain-mesh'
import { dossier, type Quantity } from './site'

type V2 = [number, number]
type V3 = [number, number, number]

/** The eyes of the outdoor stops (east, north) and where each looks: the
    ground is dressed densest where a stop sees it. */
export const STOP_EYES: readonly { at: V2; look: V2 }[] = [
  { at: [25.0, -16.1], look: [-.99, .15] }, // arrival
  { at: [10.0, -21.0], look: [-.66, .75] }, // courtyard
  { at: [5.6, -21.3], look: [-.65, .76] },  // oratory
  { at: [2.4, -29.3], look: [-.56, .83] },  // study
  { at: [-4.2, -32.4], look: [-.78, .63] }, // chamber
  { at: [-24.5, -31.2], look: [.73, .68] }, // garden
  { at: [-33.9, -29.5], look: [-1, 0] },    // supper wall
  { at: [-46.9, -29.2], look: [-.88, .47] }, // grave
]
/** The house and its annexes on the ground plane: what stands between a
    stop's eye and a place hides it. */
const OCCLUDERS: readonly (readonly V2[])[] = [
  dossier.site.footprint.map(p => [p.value[0]!, p.value[1]!] as V2),
  ...dossier.site.features.filter(f => f.id.startsWith('annex-'))
    .map(f => (f.geometry as Quantity<number[]>[]).map(p => [p.value[0]!, p.value[1]!] as V2)),
]
function crosses(a: V2, b: V2, c: V2, d: V2): boolean {
  const o = (p: V2, q: V2, r: V2): number => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0
}
export function hidden(eye: V2, p: V2): boolean {
  for (const ring of OCCLUDERS) for (let i = 0; i < ring.length; i++)
    if (crosses(eye, p, ring[i]!, ring[(i + 1) % ring.length]!)) return true
  return false
}
/** How much a stop sees of a place: 1 near and in front, falling to 0 by
    sixty metres or behind, and 0 where the house stands between. A fixed
    field, never a camera at run time. */
export function stageWeight(e: number, n: number): number {
  let best = 0
  for (const s of STOP_EYES) {
    const de = e - s.at[0], dn = n - s.at[1], d = Math.hypot(de, dn)
    if (d > 62) continue
    const ahead = d < 1e-6 ? 1 : (de * s.look[0] + dn * s.look[1]) / d
    const w = smooth(62, 22, d) * (.3 + .7 * smooth(-.35, .45, ahead))
    if (w > best && !hidden(s.at, [e, n])) best = w
  }
  return best
}
/** the nearest stop eye, in metres */
export function stopDistance(e: number, n: number): number {
  let best = Infinity
  for (const s of STOP_EYES) best = Math.min(best, Math.hypot(e - s.at[0], n - s.at[1]))
  return best
}
function smooth(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
const clamp01 = (v: number): number => v < 0 ? 0 : v > 1 ? 1 : v
const byte = (v: number): number => Math.round(clamp01(v) * 255)

/** The week's wind comes from the south-west (bearing 232): it carries what
    falls north-east and lays it against faces that look back into it. */
const WIND_FROM_DEG = 232
const FROM: V2 = [Math.sin(WIND_FROM_DEG * Math.PI / 180), Math.cos(WIND_FROM_DEG * Math.PI / 180)]
const TOWARD: V2 = [-FROM[0], -FROM[1]]

import type { Catcher } from './ground-walls'

export interface LitterPlan {
  results: readonly TreeResult[]
  tier: TreeTier
  /** the floor a leaf lies on (a court's own paving inside its court) */
  floorAt: (east: number, north: number) => number
  /** where no leaf lies at all, and where one lies only thinly */
  refused: (east: number, north: number) => boolean
  walked: (east: number, north: number) => boolean
  /** a sward, where a fallen leaf rests up on the grass */
  grass: (east: number, north: number) => boolean
  /** faces besides the terrain's own steps: walls of houses and courts */
  walls: readonly Catcher[]
  /** the body a leaf at (east, north) is written into, and its shadow body */
  bodyAt: (east: number, north: number) => { leaves: Body; shadow: Body | null }
  /** a carted road: its centre line and its width */
  lane?: { centre: readonly V2[]; width: number }
  /** a walled court the wind blows leaves into over its walls: its made
      floor's rectangles and how near a place is to the walls they come over */
  court?: { floor: readonly { west: number; south: number; east: number; north: number }[]; toWall: (east: number, north: number) => number }
}

interface Source { species: Species; e: number; n: number; reach: number; fallen: number }


/** What was laid, by where it lies. */
export interface LitterCounts { carpet: number; drifts: number; scatter: number; lane: number; court: number }

/** Lay the week's fall, and say how many leaves lie where. */
export function layLitter(plan: LitterPlan): LitterCounts {
  const counts: LitterCounts = { carpet: 0, drifts: 0, scatter: 0, lane: 0, court: 0 }
  const hero = plan.tier === 'hero', calm = plan.tier === 'calm'
  const keep = hero ? 1 : plan.tier === 'standard' ? .2 : .07
  const grow = hero ? 1 : plan.tier === 'standard' ? 1.4 : 1.9
  let laid = 0
  // where the fall comes from: every tree that stands near enough to drop
  // on the ground a stop sees, pushed downwind of its crown
  const sources: Source[] = plan.results.filter(r => r.spec.detail !== 'far').map(r => ({
    species: r.spec.species,
    e: r.crown.cx + TOWARD[0] * r.crown.radius * .3, n: -r.crown.cz + TOWARD[1] * r.crown.radius * .3,
    reach: r.crown.radius, fallen: r.fallen,
  }))
  /** how much blown fall reaches a place, and whose it mostly is */
  const supply = (e: number, n: number): { amount: number; species: Species; second: Species } => {
    // the lane's hedges and the fields beyond send some to every place
    let amount = .45, best = 0, bestSpecies: Species = 'walnut', second: Species = 'walnut', secondBest = 0
    for (const s of sources) {
      const sigma = s.reach + 14
      // what blows travels mostly downwind; a calm day of the week drops some
      // upwind of the crown too
      const de = e - s.e, dn = n - s.n, along = de * TOWARD[0] + dn * TOWARD[1]
      const reach = Math.exp(-(de * de + dn * dn) / (2 * sigma * sigma)) * (along > 0 ? 1 : Math.exp(along / 14))
      const v = reach * s.fallen / .2 * Math.min(1.6, s.reach / 5)
      amount += v
      if (v > best) { secondBest = best; second = bestSpecies; best = v; bestSpecies = s.species }
      else if (v > secondBest) { secondBest = v; second = s.species }
    }
    return { amount: Math.min(2.2, amount), species: bestSpecies, second: secondBest > best * .25 ? second : bestSpecies }
  }

  const palettes = new Map<Species, ReturnType<typeof fallenPalette>>()
  const paletteOf = (species: Species): ReturnType<typeof fallenPalette> => {
    let p = palettes.get(species)
    if (!p) { p = fallenPalette(species); palettes.set(species, p) }
    return p
  }
  const colourOf = (species: Species, pick: number, age: number): V3 => {
    const { colours, weights } = paletteOf(species)
    // the older the layer, the further down the palette's dried end
    const total = weights.reduce((a, b) => a + b, 0)
    let at = clamp01(pick * .75 + age * .25) * total, i = 0
    while (i < weights.length - 1 && at > weights[i]!) { at -= weights[i]!; i++ }
    const c = colours[i]!
    return [c[0], c[1], c[2]]
  }

  // ─── THE CARPET under every crown that is dropping it ───────────────────
  for (const r of plan.results) {
    if (r.spec.detail === 'far') continue
    const random = mulberry(r.spec.seed ^ 0x9e3779b9)
    const R = r.crown.radius, Rm = R * 1.35
    const cx = r.crown.cx + TOWARD[0] * R * .3, cn = -r.crown.cz + TOWARD[1] * R * .3
    // leaves a square metre under the crown's middle: the week's share of a
    // crown's leaves, most of it within the crown's own spread
    const density = 58 * r.fallen / .2
    const near = r.spec.detail === 'near'
    const cap = near ? 9000 : 1800
    const wanted = density * .4 * Math.PI * Rm * Rm
    // a crown no stop sees close lays its carpet thinner, in larger leaves
    const seen = near ? 1 : .3 + .7 * stageWeight(cx, cn)
    const count = Math.round(Math.min(cap, wanted) * keep * seen)
    // a capped crown draws its leaves a little larger so its ground keeps cover
    const size = Math.min(1.6, Math.sqrt(Math.max(1, wanted / (cap * seen)))) * grow
    const length = leafLengthOf(r.spec.species)
    for (let k = 0; k < count; k++) {
      const u = random(), a = random() * Math.PI * 2, s1 = random(), s2 = random(), s3 = random(), s4 = random()
      const rr = Rm * Math.sqrt(1 - Math.pow(1 - u, 1 / 2.5))
      const e = cx + Math.cos(a) * rr, n = cn + Math.sin(a) * rr
      if (plan.refused(e, n)) continue
      // laid in full where a stop sees it, thinly where none does
      const seenHere = stageWeight(e, n)
      if (random() > .1 + .9 * seenHere * Math.sqrt(seenHere)) continue
      // a walked surface keeps a third of what falls on it
      if (plan.walked(e, n) && s4 > .33) continue
      const onGrass = plan.grass(e, n)
      const folded = !calm && stopDistance(e, n) < 12
      lay(plan.bodyAt(e, n), {
        species: r.spec.species, east: e, north: n, y: plan.floorAt(e, n) + (onGrass ? .004 + s2 * s2 * .028 : .002),
        angle: s3 * Math.PI * 2, length: length * (1.05 + s1 * .45) * size, colour: colourOf(r.spec.species, s2, s1 * .5),
        fold: onGrass ? .12 + s1 * .3 : .06 + s1 * .2, folded, tilt: onGrass ? (s4 - .5) * .7 : (s4 - .5) * .15,
        ao: .78 + s2 * .18, casts: folded && onGrass,
      })
      laid++
    }
  }

  counts.carpet = laid
  // ─── THE DRIFTS against every face across the wind ──────────────────────
  const catchers: Catcher[] = [
    ...terrainSteps().map(s => ({ from: s.from as V2, to: s.to as V2, low: s.low as V2, height: s.height })),
    ...plan.walls,
  ]
  const random = mulberry(15171021)
  for (const [ci, c] of catchers.entries()) {
    const dx = c.to[0] - c.from[0], dn = c.to[1] - c.from[1], span = Math.hypot(dx, dn)
    if (span < .05) continue
    const mid: V2 = [(c.from[0] + c.to[0]) / 2, (c.from[1] + c.to[1]) / 2]
    const stage = stageWeight(mid[0], mid[1])
    if (stage <= .02) continue
    // a face looking back into the wind stops the most; eddies leave some
    // against every face
    const facing = .45 + .55 * clamp01(c.low[0] * FROM[0] + c.low[1] * FROM[1])
    const tall = clamp01((c.height - .03) / .18)
    const here = supply(mid[0], mid[1])
    // a drift is laid in full where a stop sees it close, thinly beyond
    const perMetre = (15 + 40 * here.amount) * facing * tall * stage * stage
    const count = Math.round(perMetre * span * keep * 1.6)
    // a deep drift is wider and higher; a stair's riser holds a strip at the
    // back of the tread below it, a wall a bank at its foot
    const depth = clamp01(perMetre / 90)
    const riser = c.height < .3
    const band = riser ? .045 + .05 * depth : .14 + .3 * depth
    const phase = ci * 1.618
    for (let k = 0; k < count; k++) {
      const t = random(), g = Math.abs(gauss(random)), s1 = random(), s2 = random(), s3 = random(), s4 = random(), s5 = random()
      // along a face leaves lie in clumps with gaps between, and pile in its
      // corners; feet sweep the middle of a stair
      const clump = .5 + .5 * Math.sin(t * span * 3.9 + phase) * Math.sin(t * span * 1.7 + phase * 2.3)
      const corner = Math.exp(-t * span / .35) + Math.exp(-(1 - t) * span / .35)
      const swept = riser ? .35 + .65 * Math.min(1, Math.abs(t - .5) * 2.4) : 1
      if (random() > Math.min(1, (.15 + .85 * clump * clump + 1.2 * corner) * swept) / 1.6) continue
      const off = Math.min(band * 2.4, g * band) + .012
      const e = c.from[0] + dx * t + c.low[0] * off, n = c.from[1] + dn * t + c.low[1] * off
      if (plan.refused(e, n)) continue
      const species = s5 < .72 ? here.species : here.second
      const layer = Math.floor(s1 * s1 * (1 + depth * 3.2 + corner * 2) * Math.exp(-off / (band * 1.4)))
      const lift = .003 + layer * .007 + s2 * .003
      const length = leafLengthOf(species) * (1 + s3 * .4) * grow
      // against the face a leaf rests on it, tilted up its foot
      const leaning = !riser && off < .06 && s4 < .4
      const along = Math.atan2(dn, dx) + (s4 - .5) * (leaning ? .8 : 3.2)
      const onGrass = !leaning && plan.grass(e, n)
      lay(plan.bodyAt(e, n), {
        species, east: leaning ? c.from[0] + dx * t + c.low[0] * .03 : e, north: leaning ? c.from[1] + dn * t + c.low[1] * .03 : n,
        y: plan.floorAt(e, n) + (leaning ? .002 : lift + (onGrass ? .012 : 0)), angle: along, length,
        colour: colourOf(species, s2, clamp01(1 - layer / 3)),
        fold: .1 + s1 * .32, folded: !calm && (leaning || stopDistance(e, n) < 12), tilt: leaning ? s3 : (s4 - .5) * .35,
        ao: clamp01(.52 + .1 * layer + .3 * clamp01(off / band) + s5 * .1), leanTo: leaning ? c.low : undefined,
        casts: leaning || layer > 0,
      })
      laid++
    }
  }

  counts.drifts = laid - counts.carpet
  // ─── THE BLOWN SCATTER over the ground the stops see ────────────────────
  // what the wind has not yet laid against anything lies about in small
  // clumps, thinner on what is walked
  {
    const random = mulberry(15171022)
    const box = { minE: -70, maxE: 45, minN: -72, maxN: 22 }
    const area = (box.maxE - box.minE) * (box.maxN - box.minN)
    const peak = 2.6
    const tries = Math.round(area * peak * keep / 3.2)
    for (let k = 0; k < tries; k++) {
      const e0 = box.minE + random() * (box.maxE - box.minE), n0 = box.minN + random() * (box.maxN - box.minN)
      const stage = stageWeight(e0, n0)
      if (stage <= .02) { random(); continue }
      const here = supply(e0, n0)
      if (random() > stage * Math.min(1, here.amount / 1.1)) continue
      const clumpSize = 1 + Math.floor(random() * random() * 7)
      for (let j = 0; j < clumpSize; j++) {
        const a = random() * Math.PI * 2, rr = Math.sqrt(random()) * (.06 + .1 * clumpSize)
        const e = e0 + Math.cos(a) * rr, n = n0 + Math.sin(a) * rr, s1 = random(), s2 = random(), s3 = random(), s4 = random()
        if (plan.refused(e, n)) continue
        if (plan.walked(e, n) && s4 < .4) continue
        const species = s3 < .7 ? here.species : here.second
        const onGrass = plan.grass(e, n)
        lay(plan.bodyAt(e, n), {
          species, east: e, north: n, y: plan.floorAt(e, n) + (onGrass ? .005 + s2 * s2 * .025 : .002 + j * .004),
          angle: s1 * Math.PI * 2, length: leafLengthOf(species) * (1 + s2 * .45) * grow,
          colour: colourOf(species, s2, s1 * .4), fold: .08 + s1 * .3, folded: !calm && stopDistance(e, n) < 12,
          tilt: onGrass ? (s4 - .5) * .6 : (s4 - .5) * .15, ao: .74 + s2 * .2, casts: onGrass && j === 0,
        })
        laid++
      }
    }
  }
  counts.scatter = laid - counts.carpet - counts.drifts
  // ─── THE LANE: a carted road holds its leaves in its two wheel ruts and
  // in the gutters at its edges, where the wheels and the rain put them
  if (plan.lane) {
    const random = mulberry(15171024)
    const { centre, width } = plan.lane
    for (let i = 1; i < centre.length; i++) {
      const a = centre[i - 1]!, b = centre[i]!, dx = b[0] - a[0], dn = b[1] - a[1], span = Math.hypot(dx, dn)
      if (span < .1) continue
      const ux = dx / span, un = dn / span, px = -un, pn = ux
      const count = Math.round(span * width * 11 * keep)
      for (let k = 0; k < count; k++) {
        const t = random(), lane = random(), g = gauss(random), s1 = random(), s2 = random(), s3 = random()
        // two ruts 1.4 m apart, two gutters at the edges, a little between
        const across = lane < .52 ? (lane < .26 ? -.7 : .7) + g * .09
          : lane < .88 ? (lane < .7 ? -1 : 1) * (width / 2 - .22 - Math.abs(g) * .14) : (random() - .5) * (width - .4)
        const e = a[0] + dx * t + px * across, n = a[1] + dn * t + pn * across
        const stage = stageWeight(e, n)
        if (random() > stage) continue
        if (plan.refused(e, n)) continue
        const here = supply(e, n)
        const species = s3 < .7 ? here.species : here.second
        lay(plan.bodyAt(e, n), {
          species, east: e, north: n, y: plan.floorAt(e, n) + .002 + s2 * .004,
          angle: Math.atan2(dn, dx) + (s1 - .5) * 2.6, length: leafLengthOf(species) * (1 + s2 * .4) * grow,
          colour: colourOf(species, s2, .3 + s1 * .5), fold: .06 + s1 * .22, folded: !calm && stopDistance(e, n) < 20,
          tilt: (s3 - .5) * .12, ao: .7 + s2 * .2, casts: false,
        })
        laid++
      }
    }
  }
  counts.lane = laid - counts.carpet - counts.drifts - counts.scatter
  // ─── THE WALLED COURT: what comes over its walls lies about its floor,
  // thickest in the lee of the walls it came over
  if (plan.court) {
    const random = mulberry(15171025)
    for (const g of plan.court.floor) {
      const area = (g.east - g.west) * (g.north - g.south)
      const tries = Math.round(area * 3.2 * keep)
      for (let k = 0; k < tries; k++) {
        const e = g.west + random() * (g.east - g.west), n = g.south + random() * (g.north - g.south)
        const s1 = random(), s2 = random(), s3 = random(), s4 = random()
        const lee = Math.exp(-plan.court.toWall(e, n) / 3.5)
        if (random() > (.22 + .78 * lee) * stageWeight(e, n) || plan.refused(e, n)) continue
        const here = supply(e, n), species = s3 < .7 ? here.species : here.second
        lay(plan.bodyAt(e, n), {
          species, east: e, north: n, y: plan.floorAt(e, n) + .002 + s2 * .004, angle: s1 * Math.PI * 2,
          length: leafLengthOf(species) * (1 + s2 * .4) * grow, colour: colourOf(species, s2, s1 * .5),
          fold: .1 + s1 * .3, folded: !calm && stopDistance(e, n) < 12, tilt: (s4 - .5) * .15, ao: .76 + s2 * .18, casts: false,
        })
        laid++
      }
    }
  }
  counts.court = laid - counts.carpet - counts.drifts - counts.scatter - counts.lane
  return counts
}

/** a standard normal draw from two uniforms */
function gauss(random: () => number): number {
  const u = Math.max(1e-9, random()), v = random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

interface Leaf {
  species: Species; east: number; north: number; y: number; angle: number; length: number; colour: V3
  /** how far the blade is folded along its midrib (edges up), 0 flat */
  fold: number
  /** four triangles with the fold, or two flat */
  folded: boolean
  /** a roll about the midrib, or against a face the pitch up it */
  tilt: number
  ao: number
  /** the face's own normal when the leaf leans on it */
  leanTo?: V2
  casts: boolean
}

/** One fallen leaf, lying on its floor or leaning on a face: a card of its
    species' outline, folded along the midrib as a drying leaf folds, its tip
    curling up a little. */
function lay(target: { leaves: Body; shadow: Body | null }, leaf: Leaf): void {
  const body = target.leaves
  const recipe = LEAF_RECIPES[leaf.species]
  const hw = Math.min(.5, .5 * recipe.width * 1.08 + .02)
  const { u0, v0, du, dv } = cellUV(leafCell(leaf.species))
  const L = leaf.length, fold = leaf.fold, folded = leaf.folded
  // the blade's frame: along, across and up, in world (x east, z south)
  let dir: V3 = [Math.cos(leaf.angle), 0, -Math.sin(leaf.angle)]
  let up: V3 = [0, 1, 0]
  let at: V3
  if (leaf.leanTo) {
    // it stands on its stalk at the face's foot and leans back on the face
    const back: V3 = [-leaf.leanTo[0], 0, leaf.leanTo[1]]
    const pitch = Math.min(1.1, .5 + leaf.tilt * .5)
    dir = norm([back[0] * Math.cos(pitch) * .7 + dir[0] * .3, Math.sin(pitch), back[2] * Math.cos(pitch) * .7 + dir[2] * .3])
    up = norm(cross(cross(dir, [0, 1, 0]), dir))
    if (up[1] < 0) up = [-up[0], -up[1], -up[2]]
    at = [leaf.east, leaf.y, -leaf.north]
  } else {
    // rolled a little about its own midrib, its middle at (east, north)
    const side = norm(cross(up, dir))
    up = norm([up[0] + side[0] * leaf.tilt, up[1], up[2] + side[2] * leaf.tilt])
    at = [leaf.east - dir[0] * L * .5, leaf.y, -leaf.north - dir[2] * L * .5]
  }
  const across = norm(cross(up, dir))
  const curl = .06 + fold * .12
  const liftAt = (u: number, v: number): number => (folded ? Math.abs(v) * fold : 0) + curl * u * u
  const point = (u: number, v: number): V3 => {
    const lift = liftAt(u, v)
    return [at[0] + (dir[0] * u + across[0] * v + up[0] * lift) * L,
      at[1] + (dir[1] * u + across[1] * v + up[1] * lift) * L,
      at[2] + (dir[2] * u + across[2] * v + up[2] * lift) * L]
  }
  const first = body.vertices
  const corner = (u: number, v: number): void => {
    const p = point(u, v)
    body.position.push3(p[0], p[1], p[2])
    // each half of a folded blade faces up and in toward the fold
    const lean = v === 0 || !folded ? 0 : -Math.sign(v) * fold * .9
    const n = norm([up[0] + across[0] * lean - dir[0] * curl * u, up[1] + across[1] * lean - dir[1] * curl * u,
      up[2] + across[2] * lean - dir[2] * curl * u])
    body.normal.push3(n[0], n[1], n[2])
    body.colour.push4(byte(leaf.colour[0]), byte(leaf.colour[1]), byte(leaf.colour[2]), 255)
    body.uv.push2(u0 + (.5 + v) * du, v0 + u * dv)
    // where a blade lies on its floor it sees least of the sky
    body.ao.push1(leaf.ao * (.82 + .18 * clamp01(liftAt(u, v) * L * 60)))
    body.wind.push4(0, 0, 0, 0)
  }
  if (folded) {
    corner(0, -hw); corner(0, 0); corner(0, hw); corner(1, -hw); corner(1, 0); corner(1, hw)
    body.index.push3(first, first + 4, first + 1); body.index.push3(first, first + 3, first + 4)
    body.index.push3(first + 1, first + 5, first + 2); body.index.push3(first + 1, first + 4, first + 5)
  } else {
    corner(0, -hw); corner(0, hw); corner(1, hw); corner(1, -hw)
    body.index.push3(first, first + 2, first + 1); body.index.push3(first, first + 3, first + 2)
  }
  // a leaf standing off its floor throws a shadow the sun's map can hold:
  // one opaque triangle inside its outline
  const shadow = target.shadow
  if (shadow && leaf.casts && stopDistance(leaf.east, leaf.north) < 12) {
    const s0 = shadow.vertices, w = recipe.width * .45
    for (const [u, v] of [[.12, 0], [.9, w * .5], [.9, -w * .5]] as const) {
      const p = point(u, v)
      shadow.position.push3(p[0], p[1], p[2])
      shadow.normal.push3(up[0], up[1], up[2])
      shadow.wind.push4(0, 0, 0, 0)
    }
    shadow.index.push3(s0, s0 + 2, s0 + 1)
  }
}

function norm(v: V3): V3 { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l] }
function cross(a: V3, b: V3): V3 { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]] }

