/* THE FALLEN LEAVES, AS GROUND.

   What has fallen that week lies where the trees and the wind put it. Under
   each crown that is dropping it lies a carpet, thickest under the crown's
   middle and carried north-east by the week's south-west wind. What the wind
   moves on comes to rest against whatever stops it: the foot of a wall, the
   back of a stair tread against the riser above, a kerb, the base of a tomb.
   There it lies in drifts, a heap here and a thin line there, deepest in the
   corners, some leaves leaning on the face, the lowest layer dark and damp,
   the top one the week's fresh fall; no two treads of a stair hold the same.
   A walked surface keeps a little of what falls on it; feet and wheels move
   the rest to its edges.

   Every leaf is a card of its species' outline, cupped and folded as a
   drying leaf curls, its colour from the fall of its own tree, and where it
   lies on stone the stone round it sees less of the sky. The amount and the
   places are this exhibition's reading of one October week, never a record.
   The drifts are densest where the walk's stops look. The fall is dressing a
   few centimetres deep on the floor, so it stands outside the walk's solids. */
import { cellUV, CONTACT_PAD, LEAF_RECIPES, leafCell } from './leaf-maps'
import { Body, fallenPalette, leafLengthOf, mulberry, type Species, type TreeResult, type TreeTier } from './tree-growth'
import { terrainSteps } from './terrain-mesh'
import { dossier, polygon, type Quantity } from './site'
import { layBlade } from './leaf-blade'

type V2 = [number, number]
type V3 = [number, number, number]

/** inside the house's entrance court or on the flagged walk within 3.6 m
    beyond its edges, where its kerb and the house's feet stand */
const COURT = polygon('courtyard') as V2[]
function nearCourt(p: V2): boolean {
  let area = 0
  for (let i = 0; i < COURT.length; i++) { const a = COURT[i]!, b = COURT[(i + 1) % COURT.length]!; area += a[0] * b[1] - b[0] * a[1] }
  let d = Infinity
  for (let i = 0; i < COURT.length; i++) {
    const a = COURT[i]!, b = COURT[(i + 1) % COURT.length]!, dx = b[0] - a[0], dn = b[1] - a[1], span = Math.hypot(dx, dn)
    const inward: V2 = area > 0 ? [-dn / span, dx / span] : [dn / span, -dx / span]
    d = Math.min(d, (p[0] - a[0]) * inward[0] + (p[1] - a[1]) * inward[1])
  }
  return d > -3.6
}

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

/** A block standing on the floor: a leaf that lands on it lies on its top,
    or nowhere when it has none a leaf could rest on. */
export interface Block { west: number; south: number; east: number; north: number; top: number | null }

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
  /** the blocks standing on a floor: a tomb, a lectern's foot */
  blocks?: readonly Block[]
  /** the body a leaf at (east, north) is written into, its shadow body, and
      the body of the soft darkening it leaves on a hard floor */
  bodyAt: (east: number, north: number) => Target
  /** a carted road: its centre line and its width */
  lane?: { centre: readonly V2[]; width: number }
  /** a walled court the wind blows leaves into over its walls: its made
      floor's rectangles and how near a place is to the walls they come over */
  court?: { floor: readonly { west: number; south: number; east: number; north: number }[]; toWall: (east: number, north: number) => number }
}

interface Source { species: Species; e: number; n: number; reach: number; fallen: number }
export interface Target { leaves: Body; shadow: Body | null; contact: Body | null }

/** What was laid, by where it lies. */
export interface LitterCounts { carpet: number; drifts: number; scatter: number; lane: number; court: number }

/** A run of one face: consecutive pieces of a riser or a wall laid end to end. */
interface Run extends Catcher { riser: boolean; region?: string; level?: number; built?: boolean }

/** a draw in 0..1 that belongs to a place, so a run keeps its character
    whatever order the faces are found in */
function placeSeed(e: number, n: number, salt: number): number {
  const h = Math.imul(Math.round(e * 1000) | 0, 73856093) ^ Math.imul(Math.round(n * 1000) | 0, 19349663) ^ salt
  return h >>> 0
}

/** Lay the week's fall, and say how many leaves lie where. */
export function layLitter(plan: LitterPlan): LitterCounts {
  const counts: LitterCounts = { carpet: 0, drifts: 0, scatter: 0, lane: 0, court: 0 }
  const hero = plan.tier === 'hero', calm = plan.tier === 'calm'
  bladesDrawn = hero
  const keep = hero ? 1 : plan.tier === 'standard' ? .2 : .07
  const grow = hero ? 1 : plan.tier === 'standard' ? 1.4 : 1.9
  // within this reach of a stop a leaf is drawn folded along its midrib
  const foldReach = 12
  let laid = 0
  const blocks = plan.blocks ?? []
  const blockAt = (e: number, n: number): Block | undefined => blocks.find(b => e > b.west && e < b.east && n > b.south && n < b.north)
  /** where a leaf landing at (east, north) comes to rest, or null where it cannot */
  const restAt = (e: number, n: number): number | null => {
    const b = blockAt(e, n)
    if (!b) return plan.floorAt(e, n)
    return b.top
  }
  // where the fall comes from: every tree that stands near enough to drop
  // on the ground a stop sees, pushed downwind of its crown
  const sources: Source[] = plan.results.filter(r => r.spec.detail !== 'far').map(r => ({
    species: r.spec.species,
    e: r.crown.cx + TOWARD[0] * r.crown.radius * .3, n: -r.crown.cz + TOWARD[1] * r.crown.radius * .3,
    reach: r.crown.radius, fallen: r.fallen,
  }))
  /** how much blown fall reaches a place, whose it mostly is, and the whole
      mix of trees it comes from, so a blown drift is never one species */
  const supply = (e: number, n: number): { amount: number; species: Species; second: Species; pick: (u: number) => Species } => {
    // the lane's hedges and the fields beyond send some to every place
    let amount = .45, best = 0, bestSpecies: Species = 'walnut', second: Species = 'walnut', secondBest = 0
    const mix = new Map<Species, number>()
    for (const s of sources) {
      const sigma = s.reach + 14
      // what blows travels mostly downwind; a calm day of the week drops some
      // upwind of the crown too
      const de = e - s.e, dn = n - s.n, along = de * TOWARD[0] + dn * TOWARD[1]
      const reach = Math.exp(-(de * de + dn * dn) / (2 * sigma * sigma)) * (along > 0 ? 1 : Math.exp(along / 14))
      const v = reach * s.fallen / .2 * Math.min(1.6, s.reach / 5)
      amount += v
      mix.set(s.species, (mix.get(s.species) ?? 0) + v)
      if (v > best) { secondBest = best; second = bestSpecies; best = v; bestSpecies = s.species }
      else if (v > secondBest) { secondBest = v; second = s.species }
    }
    const entries = [...mix.entries()].filter(([, w]) => w > best * .06), total = entries.reduce((a, [, w]) => a + w, 0)
    const pick = (u: number): Species => {
      let at = u * total
      for (const [species, w] of entries) { if (at < w) return species; at -= w }
      return bestSpecies
    }
    return { amount: Math.min(2.2, amount), species: bestSpecies, second: secondBest > best * .25 ? second : bestSpecies, pick }
  }

  const palettes = new Map<Species, ReturnType<typeof fallenPalette>>()
  const paletteOf = (species: Species): ReturnType<typeof fallenPalette> => {
    let p = palettes.get(species)
    if (!p) { p = fallenPalette(species); palettes.set(species, p) }
    return p
  }
  const colourOf = (species: Species, pick: number, age: number, hard = false): V3 => {
    const { colours, weights } = paletteOf(species)
    // the older the layer, the further down the palette's dried end; what the
    // wind carries onto stone is the dry fall, browner and duller than what
    // still lies on the grass it fell on
    const total = weights.reduce((a, b) => a + b, 0)
    let at = clamp01(pick * .75 + Math.max(age, hard ? .7 : 0) * .25) * total, i = 0
    while (i < weights.length - 1 && at > weights[i]!) { at -= weights[i]!; i++ }
    const c = colours[i]!
    if (!hard) return [c[0], c[1], c[2]]
    const grey = .2126 * c[0] + .7152 * c[1] + .0722 * c[2]
    return [(c[0] + (grey - c[0]) * .32) * 1.02, (c[1] + (grey - c[1]) * .32) * .97, (c[2] + (grey - c[2]) * .32) * .9]
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
      const floor = restAt(e, n)
      if (floor === null) continue
      const onGrass = plan.grass(e, n)
      const folded = !calm && stopDistance(e, n) < foldReach
      lay(plan.bodyAt(e, n), {
        species: r.spec.species, east: e, north: n, y: floor + (onGrass ? .004 + s2 * s2 * .028 : .003),
        angle: s3 * Math.PI * 2, length: length * (1.05 + s1 * .45) * size, colour: colourOf(r.spec.species, s2, s1 * .5, !onGrass),
        fold: onGrass ? .12 + s1 * .3 : .14 + s1 * .3, folded, tilt: onGrass ? (s4 - .5) * .7 : (s4 - .5) * .15,
        ao: .78 + s2 * .18, casts: folded && onGrass, hard: !onGrass, floor,
      })
      laid++
    }
  }

  counts.carpet = laid
  // ─── THE DRIFTS against every face across the wind ──────────────────────
  // a step in the grade under a made floor is no face at all: the court's
  // paving and the museum's floors run over it, so a step is only a face
  // where a leaf on its low side would lie on the grade itself
  const underFloor = (p: V2): boolean => (plan.court?.floor ?? []).some(g => p[0] > g.west - .6 && p[0] < g.east + .6 && p[1] > g.south - .6 && p[1] < g.north + .6)
  const exposed = (s: { from: readonly number[]; to: readonly number[]; low: readonly number[]; lowLevel: number }): boolean => {
    const m: V2 = [(s.from[0]! + s.to[0]!) / 2, (s.from[1]! + s.to[1]!) / 2]
    const foot: V2 = [m[0] + s.low[0]! * .15, m[1] + s.low[1]! * .15]
    return !underFloor(m) && Math.abs(plan.floorAt(foot[0], foot[1]) - s.lowLevel) < .08
  }
  // the grade's steps come in short pieces; a riser or a retaining face is
  // one run end to end, so its heaps and its corners are the run's own
  const runs: Run[] = []
  for (const s of terrainSteps()) {
    if (!exposed(s)) continue
    const last = runs[runs.length - 1]
    if (last && last.region === s.region && Math.hypot(last.to[0] - s.from[0], last.to[1] - s.from[1]) < .03
      && last.low[0] * s.low[0] + last.low[1] * s.low[1] > .999 && Math.abs((last.level ?? 0) - s.lowLevel) < .03) {
      last.to = [s.to[0]!, s.to[1]!]
      last.height = Math.max(last.height, s.height)
    } else runs.push({ from: [s.from[0]!, s.from[1]!], to: [s.to[0]!, s.to[1]!], low: [s.low[0]!, s.low[1]!], height: s.height,
      riser: s.height < .3, region: s.region, level: s.lowLevel })
  }
  for (const w of plan.walls) runs.push({ ...w, riser: w.height < .3, built: true })
  const random = mulberry(15171021)
  for (const c of runs) {
    const dx = c.to[0] - c.from[0], dn = c.to[1] - c.from[1], span = Math.hypot(dx, dn)
    if (span < .05) continue
    // how much of the run a stop sees: the best of its ends and its middle
    const at = (t: number): V2 => [c.from[0] + dx * t, c.from[1] + dn * t]
    const stages = [0, .25, .5, .75, 1].map(t => stageWeight(...at(t)))
    const stage = Math.max(...stages)
    if (stage <= .02) continue
    const mid = at(.5)
    // a face looking back into the wind stops the most; eddies leave some
    // against every face
    const facing = .45 + .55 * clamp01(c.low[0] * FROM[0] + c.low[1] * FROM[1])
    const tall = clamp01((c.height - .03) / .12)
    const here = supply(mid[0], mid[1])
    // THE RUN'S OWN CHARACTER: where along it the wind heaped the week's
    // leaves, how clean feet have swept it, how wide its drift lies
    const own = mulberry(placeSeed(mid[0], mid[1], 15171026))
    const riser = c.riser
    const heaps = Array.from({ length: 1 + Math.floor(own() * (riser ? 3.2 : 1.5 + span / 3.5)) },
      () => ({ at: own() * span, width: riser ? .07 + own() * own() * .45 : .25 + own() * own() * 1.8, amp: .5 + own() * 1.8 }))
    // some treads are swept nearly bare, others hold a heap or two with bare
    // stone between: a riser's line is never one ridge from cheek to cheek
    const bare = riser && own() < .35
    const base = riser ? (bare ? own() * .02 : own() * own() * .14) : .25 + own() * .5
    const swept = riser ? .3 + own() * .65 : 0
    const width = .7 + own() * .75
    // each end of a run holds its corner or not, and not the same amount
    const cornerA = riser ? own() * own() * 1.6 : 1.3, cornerB = riser ? own() * own() * 1.6 : 1.3
    const profile = (s: number): number => {
      let v = base
      for (const h of heaps) v += h.amp * Math.exp(-(((s - h.at) / h.width) ** 2)) * (bare ? .25 : 1)
      // the corners where the run meets a cheek or another wall
      v += cornerA * Math.exp(-s / .3) + cornerB * Math.exp(-(span - s) / .3)
      // feet sweep a stair's middle
      if (riser) v *= 1 - swept * (1 - Math.min(1, Math.abs(s / span - .5) * 2.6))
      return v
    }
    let peak = 0, mean = 0
    for (let i = 0; i <= 40; i++) { const v = profile(span * i / 40); peak = Math.max(peak, v); mean += v / 41 }
    // a drift is laid in full where a stop sees it close, thinly beyond; in
    // a walled court all that comes over the walls ends at a foot
    const walledIn = underFloor(mid) ? 3.4 : 1
    // feet move what falls on the walked court to its edges: a wall foot or a
    // kerb standing on it or on the flagged walk beside it holds that too (a
    // stair's own treads are walked across, not beside; the street keeps its
    // own drifts, the arrival's budget has no room for more)
    const foot: V2 = [mid[0] + c.low[0] * .15, mid[1] + c.low[1] * .15]
    const lee = c.built && plan.walked(foot[0], foot[1]) && nearCourt(foot) ? 2.6 : 1
    const perMetre = (15 + 40 * here.amount) * facing * tall * stage * stage * walledIn * lee
    const count = Math.round(perMetre * span * keep * 1.1 * mean / Math.max(1e-6, peak) * 1.6)
    const depthOf = clamp01(perMetre / 90)
    const band = (riser ? .045 + .05 * depthOf : .14 + .3 * depthOf) * width
    for (let k = 0; k < count; k++) {
      const t = random(), g = Math.abs(gauss(random)), s1 = random(), s2 = random(), s3 = random(), s4 = random(), s5 = random()
      const s = t * span, local = profile(s) / peak
      if (random() > local) continue
      const seenHere = stages[Math.min(4, Math.round(t * 4))]! / stage
      if (random() > seenHere * seenHere) continue
      // a heap is wider and deeper than a thin line
      const off = Math.min(band * 2.6, g * band * (.55 + .7 * local)) + .012
      const e = c.from[0] + dx * t + c.low[0] * off, n = c.from[1] + dn * t + c.low[1] * off
      if (plan.refused(e, n)) continue
      const floor = restAt(e, n)
      if (floor === null) continue
      const species = here.pick(s5)
      const corner = Math.exp(-s / .35) + Math.exp(-(span - s) / .35)
      const layer = Math.floor(s1 * s1 * (1 + depthOf * 2.4 + local * 2.4 + corner * 2) * Math.exp(-off / (band * 1.4)))
      const lift = .003 + layer * .007 + s2 * .003
      const length = leafLengthOf(species) * (1 + s3 * .4) * grow
      // against the face a leaf rests on it, tilted up its foot
      const leaning = !riser && off < .06 && s4 < .4
      const along = Math.atan2(dn, dx) + (s4 - .5) * (leaning ? .8 : 3.2)
      const onGrass = !leaning && plan.grass(e, n)
      lay(plan.bodyAt(e, n), {
        species, east: leaning ? c.from[0] + dx * t + c.low[0] * .03 : e, north: leaning ? c.from[1] + dn * t + c.low[1] * .03 : n,
        y: floor + (leaning ? .002 : lift + (onGrass ? .012 : 0)), angle: along, length,
        colour: colourOf(species, s2, clamp01(1 - layer / 3), !onGrass),
        fold: .1 + s1 * .32, folded: !calm && (leaning || stopDistance(e, n) < foldReach), tilt: leaning ? s3 : (s4 - .5) * .35,
        ao: clamp01(.52 + .1 * layer + .3 * clamp01(off / band) + s5 * .1), leanTo: leaning ? c.low : undefined,
        casts: leaning || layer > 0, hard: !onGrass && layer === 0, floor,
      })
      laid++
    }
    // a few leaves blown out over a tread that is not swept bare
    if (riser && !bare) {
      const out = Math.round(span * (.6 + own() * 2.4) * stage * keep * (here.amount / 1.2))
      for (let k = 0; k < out; k++) {
        const t = random(), s1 = random(), s2 = random(), s3 = random(), off = .06 + random() * .26
        const e = c.from[0] + dx * t + c.low[0] * off, n = c.from[1] + dn * t + c.low[1] * off
        if (plan.refused(e, n) || blockAt(e, n)) continue
        const floor = plan.floorAt(e, n)
        if (Math.abs(floor - (plan.floorAt(c.from[0] + dx * t + c.low[0] * .03, c.from[1] + dn * t + c.low[1] * .03))) > .02) continue
        const species = here.pick(s3)
        lay(plan.bodyAt(e, n), {
          species, east: e, north: n, y: floor + .003 + s2 * .003, angle: s1 * Math.PI * 2,
          length: leafLengthOf(species) * (1 + s2 * .4) * grow, colour: colourOf(species, s2, .4 + s1 * .4, true),
          fold: .14 + s1 * .3, folded: !calm && stopDistance(e, n) < foldReach, tilt: (s3 - .5) * .15, ao: .76 + s2 * .18,
          casts: false, hard: true, floor,
        })
        laid++
      }
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
      // the walled court's floor keeps its own reading below
      const walled = underFloor([e0, n0]) ? .45 : 1
      if (random() > stage * Math.min(1, here.amount / 1.1) * walled) continue
      const clumpSize = 1 + Math.floor(random() * random() * 7)
      for (let j = 0; j < clumpSize; j++) {
        const a = random() * Math.PI * 2, rr = Math.sqrt(random()) * (.06 + .1 * clumpSize)
        const e = e0 + Math.cos(a) * rr, n = n0 + Math.sin(a) * rr, s1 = random(), s2 = random(), s3 = random(), s4 = random()
        if (plan.refused(e, n)) continue
        if (plan.walked(e, n) && s4 < .4) continue
        const floor = restAt(e, n)
        if (floor === null) continue
        const species = s3 < .7 ? here.species : here.second
        const onGrass = plan.grass(e, n)
        lay(plan.bodyAt(e, n), {
          species, east: e, north: n, y: floor + (onGrass ? .005 + s2 * s2 * .025 : .003 + j * .004),
          angle: s1 * Math.PI * 2, length: leafLengthOf(species) * (1 + s2 * .45) * grow,
          colour: colourOf(species, s2, s1 * .4, !onGrass), fold: onGrass ? .08 + s1 * .3 : .14 + s1 * .3, folded: !calm && stopDistance(e, n) < foldReach,
          tilt: onGrass ? (s4 - .5) * .6 : (s4 - .5) * .15, ao: .74 + s2 * .2, casts: onGrass && j === 0,
          hard: !onGrass && j === 0, floor,
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
      const count = Math.round(span * width * 9 * keep)
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
        const floor = plan.floorAt(e, n)
        lay(plan.bodyAt(e, n), {
          species, east: e, north: n, y: floor + .003 + s2 * .004,
          angle: Math.atan2(dn, dx) + (s1 - .5) * 2.6, length: leafLengthOf(species) * (1 + s2 * .4) * grow,
          colour: colourOf(species, s2, .3 + s1 * .5, true), fold: .1 + s1 * .26, folded: !calm && stopDistance(e, n) < 20,
          tilt: (s3 - .5) * .12, ao: .7 + s2 * .2, casts: false, hard: true, floor,
        })
        laid++
      }
    }
  }
  counts.lane = laid - counts.carpet - counts.drifts - counts.scatter
  // ─── THE WALLED COURT: what comes over its walls lies about its floor,
  // most of it in the lee of the walls it came over, the open middle of the
  // court nearly clear, where the wind scours it
  if (plan.court) {
    const random = mulberry(15171025)
    for (const g of plan.court.floor) {
      const area = (g.east - g.west) * (g.north - g.south)
      const tries = Math.round(area * 2.8 * keep)
      for (let k = 0; k < tries; k++) {
        const e0 = g.west + random() * (g.east - g.west), n0 = g.south + random() * (g.north - g.south)
        const lee = Math.exp(-plan.court.toWall(e0, n0) / 2.8)
        if (random() > (.38 + .62 * lee) * stageWeight(e0, n0)) continue
        // the wind lays what it moves in small rafts, not one by one
        const raft = 1 + Math.floor(random() * random() * 5), a0 = random() * Math.PI
        for (let j = 0; j < raft; j++) {
          const along = (random() - .5) * .16 * raft, aside = (random() - .5) * .07
          const e = e0 + Math.cos(a0) * along - Math.sin(a0) * aside, n = n0 + Math.sin(a0) * along + Math.cos(a0) * aside
          const s1 = random(), s2 = random(), s3 = random(), s4 = random()
          if (plan.refused(e, n)) continue
          const floor = restAt(e, n)
          if (floor === null) continue
          const here = supply(e, n), species = here.pick(s3)
          lay(plan.bodyAt(e, n), {
            species, east: e, north: n, y: floor + .003 + j * .003 + s2 * .003, angle: a0 + (s1 - .5) * 2.4,
            length: leafLengthOf(species) * (1 + s2 * .4) * grow, colour: colourOf(species, s2, s1 * .5, true),
            fold: .16 + s1 * .32, folded: !calm && stopDistance(e, n) < foldReach, tilt: (s4 - .5) * .15, ao: .72 + s2 * .18, casts: false,
            hard: j === 0, floor,
          })
          laid++
        }
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
  /** lying on stone, gravel or earth rather than on the sward, and the
      floor's own height there */
  hard?: boolean
  floor: number
}

/** Within this reach of a stop's eye a lying leaf is a blade, not a card:
    rolled at its margins, curled at its tip, lying on its midrib. */
const BLADE_REACH = 7.5
/** blades are the film's and the desktop's: a phone's tier keeps the card,
    which is what its walk was measured to hold still with */
let bladesDrawn = false

/** One fallen leaf, lying on its floor or leaning on a face: a card of its
    species' outline, folded along the midrib as a drying leaf folds, its tip
    curling up a little. */
function lay(target: Target, leaf: Leaf): void {
  if (bladesDrawn && leaf.folded && !leaf.leanTo && stopDistance(leaf.east, leaf.north) < BLADE_REACH) { nearBlade(target, leaf); return }
  const body = target.leaves
  const recipe = LEAF_RECIPES[leaf.species]
  const hw = Math.min(.5, .5 * recipe.width * 1.08 + .02)
  const cell = leafCell(leaf.species)
  const { u0, v0, du, dv } = cellUV(cell)
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
  // a flat card still reads as a cupped blade: its edges' normals lean in
  // toward the midrib as a folded blade's halves do
  const cup = folded ? fold * .9 : .3 + fold * .8
  const corner = (u: number, v: number): void => {
    const p = point(u, v)
    body.position.push3(p[0], p[1], p[2])
    const lean = v === 0 ? 0 : -Math.sign(v) * cup
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
  // on a hard floor the stone under and around a lying leaf sees less sky:
  // the blade's own outline, softened, drawn on the stone under it wherever
  // a stop can see the leaf
  const contact = target.contact
  if (contact && leaf.hard && !leaf.leanTo && stopDistance(leaf.east, leaf.north) < 14 && stageWeight(leaf.east, leaf.north) > .15) {
    const c0 = contact.vertices, pad = CONTACT_PAD
    // the halo's card is the leaf's own card grown by the pad on every side,
    // lying flat on the stone under the blade
    const flat: V3 = norm([dir[0], 0, dir[2]]), side: V3 = [flat[2], 0, -flat[0]]
    const lift = Math.max(0, leaf.y - leaf.floor)
    // a blade lifted off the stone softens and spreads what it takes
    const strength = clamp01(.95 - lift * 18 - fold * .2)
    const o: V3 = [leaf.east - flat[0] * L * .5, leaf.floor + .0008, -leaf.north - flat[2] * L * .5]
    const { u0: cu0, v0: cv0, du: cdu, dv: cdv } = cellUV(cell)
    for (const [u, v] of [[-pad, -.5 - pad], [1 + pad, -.5 - pad], [1 + pad, .5 + pad], [-pad, .5 + pad]] as const) {
      contact.position.push3(o[0] + (flat[0] * u + side[0] * v) * L, o[1], o[2] + (flat[2] * u + side[2] * v) * L)
      contact.normal.push3(0, 1, 0)
      // the contact atlas's cells hold the leaf padded on every side
      contact.uv.push2(cu0 + ((v + .5 + pad) / (1 + 2 * pad)) * cdu, cv0 + ((u + pad) / (1 + 2 * pad)) * cdv)
      contact.colour.push4(0, 0, 0, byte(strength))
      contact.wind.push4(0, 0, 0, 0)
    }
    contact.index.push3(c0, c0 + 2, c0 + 1); contact.index.push3(c0, c0 + 3, c0 + 2)
  }
}

/** A leaf near a stop's eye, laid as a blade (`leaf-blade.ts`): its
    shadow triangle where it casts, its contact where it lies on stone a
    stop sees. */
function nearBlade(target: Target, leaf: Leaf): void {
  const touches = leaf.hard && stageWeight(leaf.east, leaf.north) > .15
  const own = leafLengthOf(leaf.species)
  // a card drawn larger than its leaf, to keep a far drift's cover, is laid
  // near the eye as the leaves of its own size that cover as much
  const many = Math.max(1, Math.min(3, Math.round(Math.pow(leaf.length / (own * 1.17), 2))))
  const random = mulberry(placeSeed(leaf.east, leaf.north, 0xb1ade))
  for (let k = 0; k < many; k++) {
    const a = random() * Math.PI * 2, r = k === 0 ? 0 : leaf.length * (.35 + random() * .4)
    const e = leaf.east + Math.cos(a) * r, n = leaf.north + Math.sin(a) * r
    layBlade(target.leaves, {
      species: leaf.species, east: e, north: n, floor: leaf.floor, y: leaf.y, angle: k === 0 ? leaf.angle : random() * Math.PI * 2,
      length: leaf.length, own, colour: leaf.colour, fold: leaf.fold, tilt: leaf.tilt, ao: leaf.ao,
    }, leaf.casts ? target.shadow : null, touches ? target.contact : null)
  }
}

function norm(v: V3): V3 { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l] }
function cross(a: V3, b: V3): V3 { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]] }
