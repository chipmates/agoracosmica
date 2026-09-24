/** THE GRAVE COURT'S PLAN, as data: the brick leaf in front of the gallery's
 * cast core, the filter band that raises the back wall, the copings, the oak
 * walkway to the slab, the bench and the three field maples in their beds.
 * Every number is a modern exhibition-design choice; nothing here documents a
 * building of 1519 or the chapel of Saint-Hubert.
 *
 * Two frames. The grave's own (x, y, z), in which the gallery and the slab are
 * built: +z faces the visitor. And the wing's (east, north): the exhibit is
 * mounted at the grave's origin turned a quarter turn, so its local x reads as
 * north and its local z as east. This module imports nothing of the wing so the
 * offline checkers can load it alone.
 */

/** The grave's origin in the wing and the court's paving level, repeated from
 * `collection/layout.ts` (the checker proves the two agree). */
export const GRAVE_COURT_ORIGIN = { east: -55.5, north: -25 } as const
export const GRAVE_COURT_LEVEL = -6.44
/** the grave group stands this far over the court's paving */
export const GRAVE_MOUNT_RISE = .035

export const toWorld = (x: number, z: number): [east: number, north: number] =>
  [GRAVE_COURT_ORIGIN.east + z, GRAVE_COURT_ORIGIN.north + x]
export const toLocal = (east: number, north: number): [x: number, z: number] =>
  [north - GRAVE_COURT_ORIGIN.north, east - GRAVE_COURT_ORIGIN.east]

/** THE BRICK. The long flat brick of the reference building, about 528 by 37
 * mm on its face, laid with thin joints struck flush. A course is 45 mm. */
export const BRICK = { length: .528, height: .037, joint: .008, course: .045, bond: .5 } as const

/** THE LEAF. A wall of that brick one brick deep, laid in front of the
 * gallery's cast core on the court's side. Its face stands in front of the
 * core's boards and a bed behind the painting's support and label plate; the
 * core's bands that stand further out are taken inside a plinth course and a
 * string course. */
export const LEAF = {
  /** the back wall's face and the depth of the leaf behind it (grave z) */
  backFace: -5.385, depth: .2,
  /** the two returns' faces (grave |x|) and how far they run east (grave z) */
  returnFace: 8.765, returnEnd: 14.65,
  /** the leaf stands on the core's stone kerb */
  foot: .21,
  /** the height the returns are laid to, and their coping */
  returnTop: 6.0,
  coping: { height: .1, over: .035 },
} as const

/** THE PLINTH COURSE. A band of stone at the leaf's foot, standing proud of
 * the brick, which takes the core's dado bands inside it. */
export const PLINTH_COURSE = { top: .47, backFace: -5.30, returnFace: 8.705 } as const
/** THE STRING COURSE under the filter band, which takes the core's cornice
 * bands inside it. */
export const STRING_COURSE = { bottom: 5.69, top: 5.84, backFace: -5.315 } as const

/** THE FILTER BAND. The back wall rises over its core in brick laid open:
 * pairs of courses whose head joints are left wide, staggered pair to pair,
 * so the western light passes the wall in small slots. */
export const FILTER = {
  bottom: 6.0, top: 7.08,
  /** grave |x| of the band's two ends, each a solid pier */
  halfWidth: 9.16, pier: .44,
  /** the open slot left between two bricks of a perforated course */
  slot: .19,
  /** how many courses make one solid run, and one perforated run */
  solidCourses: 2, openCourses: 2,
  coping: { height: .12, over: .04 },
} as const

/** THE WALKWAY: oak boards laid across the walk on two bearers, from the
 * court's open side to the foot of the slab, on the visitor's line to it. In
 * the wing's metres. */
export const WALKWAY = {
  from: [-47.62, -28.86] as [number, number],
  to: [-52.52, -26.18] as [number, number],
  width: 1.2,
  /** top of the boards over the grave floor */
  height: .075,
  board: { width: .135, gap: .012, thickness: .032 },
} as const

/** THE BENCH: oiled oak on bronze feet, on the court's south side, facing the
 * slab and the lit north wall. In the wing's metres; `facing` is the unit
 * direction the sitter looks. */
export const BENCH = {
  at: [-54.9, -30.62] as [number, number],
  length: 2.3, depth: .44, seat: .45,
  facing: [0, 1] as [number, number],
} as const

/** THE MUSEUM'S PLANTING: field maple, a tree of the region's hedges, three
 * of them in steel-edged beds. Types of the season, the museum's own. */
export interface CourtTree { id: string; east: number; north: number; height: number; seed: number; lean: [number, number] }
export const COURT_TREES: readonly CourtTree[] = [
  { id: 'grave-court-maple-south', east: -57.9, north: -31.2, height: 7.6, seed: 51902, lean: [.35, .25] },
  { id: 'grave-court-maple-west', east: -58.3, north: -19.0, height: 8.1, seed: 51903, lean: [.3, -.35] },
  { id: 'grave-court-maple-east', east: -52.3, north: -32.1, height: 7.0, seed: 51904, lean: [.2, .45] },
]
/** a court tree's clear stem, and the share of the species' own spread it
 * takes: a tree raised over a walked floor, as a court keeps one */
export const COURT_TREE_FORM = { crownBase: .33, bole: .33, spread: .82, leafCap: 20000 } as const
/** Each bed: a square of earth in a blackened steel edge round its tree. */
export const BED = { half: .82, edge: .012, rise: .055 } as const

/** THE CERTIFIED LINES THROUGH THE COURT, in the wing's metres at the eye:
 * the lane, the leg from the lane to the station, and the three approaches.
 * Read off `data/rail-clearance.json`; the court checker proves them equal. */
export const CERTIFIED_LINES: readonly (readonly [number, number])[][] = [
  [[-33.5, -20.6], [-49.5, -20.6]],
  [[-49.5, -20.6], [-46.9, -29.2]],
  [[-46.9, -29.2], [-51.5, -26.9]],
  [[-46.9, -29.2], [-52.5, -23.8]],
  [[-46.9, -29.2], [-56.9, -27.9]],
]
/** Nothing of the court stands within this of a certified line above this
 * height over the floor, and no leaf or limb within it at any height. */
export const WALK_KEEP = { metres: 1.2, above: .9 } as const

/** The ground in plan: what a fallen leaf may lie on and what it piles
 * against, for the ground's own laying (`ground-walls.ts`). */
export function courtFurnitureBlocks(): { west: number; south: number; east: number; north: number; top: number | null }[] {
  const floor = GRAVE_COURT_LEVEL + .02
  const out: { west: number; south: number; east: number; north: number; top: number | null }[] = []
  for (const t of COURT_TREES)
    out.push({ west: t.east - BED.half, east: t.east + BED.half, south: t.north - BED.half, north: t.north + BED.half, top: floor + BED.rise })
  const [e, n] = BENCH.at
  out.push({ west: e - BENCH.length / 2, east: e + BENCH.length / 2, south: n - BENCH.depth / 2, north: n + BENCH.depth / 2, top: floor + BENCH.seat })
  return out
}

/** The walkway's outline in plan, counter-clockwise, in the wing's metres. */
export function walkwayOutline(): [number, number][] {
  const [ax, an] = WALKWAY.from, [bx, bn] = WALKWAY.to
  const len = Math.hypot(bx - ax, bn - an), ux = (bx - ax) / len, un = (bn - an) / len
  const px = -un * WALKWAY.width / 2, pn = ux * WALKWAY.width / 2
  return [[ax - px, an - pn], [bx - px, bn - pn], [bx + px, bn + pn], [ax + px, an + pn]]
}
