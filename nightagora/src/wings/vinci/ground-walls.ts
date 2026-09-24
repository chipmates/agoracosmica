/* THE BUILT FACES THE GROUND MEETS.

   Where a wall stands on the ground is where the wind lays leaves and the
   damp keeps moss: the house and its annexes all round, the street wall,
   the walls of the insertion's court and both faces of the supper wall.
   Each face carries the unit normal of the side the ground lies on. */
import { dossier, inside, polygon, type Quantity } from './site'
import { COURT, GRAVE_ORIGIN, SUPPER_WALL } from './collection/layout'
import { GALLERY } from './collection/rooms'
import { GRAVE_SLAB } from './grave/placement'
import { BED, COURT_TREES, courtFurnitureBlocks, WALKWAY, walkwayOutline } from './grave/court-plan'

type V2 = [number, number]
/** A face the ground meets: its ends, the unit normal (east, north) into
    the side the ground lies on, and its height. */
export interface Catcher { from: V2; to: V2; low: V2; height: number }

let faces: Catcher[] | undefined
/** Every built face a blown leaf or a patch of moss meets at its foot,
    besides the terrain's own steps: the house and its annexes all round, the street
    wall, the walls of the insertion's court and both faces of the supper
    wall. Each face's low side is the side the leaves lie on. */
export function builtFaces(): Catcher[] {
  if (faces) return faces
  const out: Catcher[] = []
  const ring = (points: readonly number[][], height: number): void => {
    let area = 0
    for (let i = 0; i < points.length; i++) {
      const a = points[i]!, b = points[(i + 1) % points.length]!
      area += a[0]! * b[1]! - b[0]! * a[1]!
    }
    const outside = area > 0 ? 1 : -1
    for (let i = 0; i < points.length; i++) {
      const a = points[i]!, b = points[(i + 1) % points.length]!
      const dx = b[0]! - a[0]!, dn = b[1]! - a[1]!, span = Math.hypot(dx, dn)
      if (span < .2) continue
      out.push({ from: [a[0]!, a[1]!], to: [b[0]!, b[1]!], low: [dn / span * outside, -dx / span * outside], height })
    }
  }
  ring(dossier.site.footprint.map(p => p.value), 6)
  for (const f of dossier.site.features.filter(f => f.id.startsWith('annex-'))) ring((f.geometry as Quantity<number[]>[]).map(p => p.value), 3)
  const street = polygon('street-wall')
  if (street.length >= 2) {
    const a = street[0]!, b = street[1]!, dx = b[0]! - a[0]!, dn = b[1]! - a[1]!, span = Math.hypot(dx, dn)
    for (const side of [1, -1]) out.push({ from: [a[0]!, a[1]!], to: [b[0]!, b[1]!], low: [dn / span * side, -dx / span * side], height: 2.1 })
  }
  // the insertion's court: the grave's gallery wall and its north return,
  // the parapet over the park, and the supper wall standing in the court
  const face = (from: [number, number], to: [number, number], low: [number, number], height: number): void => { out.push({ from, to, low, height }) }
  face([GALLERY.backKerb, COURT.south], [GALLERY.backKerb, GALLERY.northKerb], [1, 0], 6)
  face([GALLERY.back, GALLERY.northKerb], [GALLERY.returnEast, GALLERY.northKerb], [0, -1], 6)
  face([GALLERY.returnEast, COURT.north - COURT.parapetThickness], [COURT.east, COURT.north - COURT.parapetThickness], [0, -1], COURT.parapet)
  const wall = SUPPER_WALL, half = wall.length / 2, t = wall.thickness / 2
  face([wall.east + t, wall.north - half], [wall.east + t, wall.north + half], [1, 0], wall.height)
  face([wall.east - t, wall.north - half], [wall.east - t, wall.north + half], [-1, 0], wall.height)
  faces = out
  return out
}

/** A made block standing on a floor, on the ground plane, and its top. */
export interface FloorBlock { west: number; south: number; east: number; north: number; top: number | null }

/** The walls of the house, its annexes and the street, as `builtFaces` reads
    them, without the insertion's court. */
function houseFaces(): Catcher[] {
  const all = builtFaces()
  return all.slice(0, all.length - COURT_FACES)
}
/** how many faces `builtFaces` gives the insertion's court, last in its list */
const COURT_FACES = 5

/** The grave's tomb and its lectern in the wing's metres: the exhibit is
    mounted at the grave's origin turned a quarter turn, so its local x reads
    as north and its local z as east. */
const graveBox = (x: number, z: number, alongX: number, alongZ: number): { west: number; south: number; east: number; north: number } => ({
  west: GRAVE_ORIGIN.east + z - alongZ / 2, east: GRAVE_ORIGIN.east + z + alongZ / 2,
  south: GRAVE_ORIGIN.north + x - alongX / 2, north: GRAVE_ORIGIN.north + x + alongX / 2,
})
/** the grave's floor stands this far over the court's own paving */
export const GRAVE_FLOOR_RISE = .02
/** the grave's own floor, on the ground plane */
export const GRAVE_FLOOR = { west: GRAVE_ORIGIN.east - 4, east: GRAVE_ORIGIN.east + 9, south: GRAVE_ORIGIN.north - 6, north: GRAVE_ORIGIN.north + 6 }

/** What stands on the grave's floor: the slab, whose top a leaf can lie on,
    the masonry round it and the lectern's foot, which it cannot. */
export function courtBlocks(): FloorBlock[] {
  const mount = COURT.level + .035
  return [
    { ...graveBox(GRAVE_SLAB.x, GRAVE_SLAB.z, GRAVE_SLAB.width, GRAVE_SLAB.length), top: mount + .234 },
    { ...graveBox(GRAVE_SLAB.x, GRAVE_SLAB.z, 2.16, 3.74), top: null },
    { ...graveBox(1.44, 1.37, 1.88, .48), top: null },
    // the court's beds and bench, and the walkway as squares inside its boards
    ...courtFurnitureBlocks(),
    ...walkwaySquares(),
  ]
}

/** The walkway in plan as squares that lie wholly inside its boards, so a
    leaf that lands on one lies on the boards and none hangs off their edge. */
function walkwaySquares(): FloorBlock[] {
  const [a, b, , d] = walkwayOutline()
  const along = [b![0] - a![0], b![1] - a![1]], across = [d![0] - a![0], d![1] - a![1]]
  const length = Math.hypot(along[0]!, along[1]!), width = Math.hypot(across[0]!, across[1]!)
  const side = width / Math.SQRT2 * .98, top = COURT.level + GRAVE_FLOOR_RISE + WALKWAY.height
  const out: FloorBlock[] = []
  for (let t = side / 2 + .02; t < length - side / 2; t += side * .8) {
    const c = [a![0] + along[0]! * t / length + across[0]! / 2, a![1] + along[1]! * t / length + across[1]! / 2]
    const h = side / 2 * Math.SQRT1_2
    out.push({ west: c[0]! - h, east: c[0]! + h, south: c[1]! - h, north: c[1]! + h, top })
  }
  return out
}

/** The faces a blown leaf meets in the insertion's court, each at the front
    of what stands at its foot: the gallery's walls at their foot course, the
    parapets, the supper wall at its base course and its sill, the grave's
    tomb and lectern, and the pavilion's north wall across the apron. */
export function courtFaces(): Catcher[] {
  const out: Catcher[] = []
  const face = (from: [number, number], to: [number, number], low: [number, number], height: number): void => { out.push({ from, to, low, height }) }
  const box = (b: { west: number; south: number; east: number; north: number }, height: number): void => {
    face([b.west, b.south], [b.east, b.south], [0, -1], height)
    face([b.east, b.south], [b.east, b.north], [1, 0], height)
    face([b.east, b.north], [b.west, b.north], [0, 1], height)
    face([b.west, b.north], [b.west, b.south], [-1, 0], height)
  }
  const FOOT = .18
  face([GALLERY.backKerb + FOOT, COURT.south], [GALLERY.backKerb + FOOT, GALLERY.northKerb - FOOT], [1, 0], 6)
  face([GALLERY.backKerb + FOOT, GALLERY.northKerb - FOOT], [GALLERY.returnEast, GALLERY.northKerb - FOOT], [0, -1], 6)
  face([GALLERY.returnEast, COURT.north - COURT.parapetThickness], [COURT.east - COURT.parapetThickness, COURT.north - COURT.parapetThickness], [0, -1], COURT.parapet)
  face([COURT.east - COURT.parapetThickness, COURT.north - COURT.parapetThickness], [COURT.east - COURT.parapetThickness, COURT.south], [-1, 0], COURT.parapet)
  const S = SUPPER_WALL, t = S.thickness / 2, base = t + .07, sill = t + .84, field = S.field.width / 2, half = S.length / 2 + .07
  face([S.east + sill, S.north - field], [S.east + sill, S.north + field], [1, 0], .44)
  face([S.east + base, S.north - half], [S.east + base, S.north - field], [1, 0], .22)
  face([S.east + base, S.north + field], [S.east + base, S.north + half], [1, 0], .22)
  face([S.east + base, S.north - field], [S.east + sill, S.north - field], [0, -1], .44)
  face([S.east + sill, S.north + field], [S.east + base, S.north + field], [0, 1], .44)
  // the west face stands between its two piers
  face([S.east - base, S.north + half - .95], [S.east - base, S.north - half + .95], [-1, 0], .22)
  face([S.east - base, S.north - half], [S.east + base, S.north - half], [0, -1], .22)
  face([S.east + base, S.north + half], [S.east - base, S.north + half], [0, 1], .22)
  box(graveBox(GRAVE_SLAB.x, GRAVE_SLAB.z, 2.16, 3.74), .15)
  box(graveBox(1.44, 1.37, 1.88, .48), .17)
  // the court's beds at their steel edges, and the walkway's two long sides
  for (const t of COURT_TREES) box({ west: t.east - BED.half, east: t.east + BED.half, south: t.north - BED.half, north: t.north + BED.half }, BED.rise)
  {
    const [a, b, c, d] = walkwayOutline()
    const along = [b![0] - a![0], b![1] - a![1]], l = Math.hypot(along[0]!, along[1]!)
    const n: [number, number] = [along[1]! / l, -along[0]! / l]
    face([a![0], a![1]], [b![0], b![1]], n, WALKWAY.height)
    face([c![0], c![1]], [d![0], d![1]], [-n[0], -n[1]], WALKWAY.height)
  }
  // the pavilion's north wall at its foot course, across the apron
  face([-62, -34 + FOOT], [-22, -34 + FOOT], [0, 1], 3)
  return out
}

/** The house as it is built: every rendered facade, the chapel's bay among
    them (the site's footprint runs straight across the bay's foot), each
    looking out to the side the house does not stand on. */
function facadeFaces(): Catcher[] {
  const out: Catcher[] = []
  const envelope = dossier.site.build_envelope.map(p => p.value), footprint = dossier.site.footprint.map(p => p.value)
  const within = (e: number, n: number): boolean => inside(e, n, envelope) || inside(e, n, footprint)
  const facades = (dossier as unknown as { facades: { render: boolean; from: { value: number[] }; to: { value: number[] } }[] }).facades
  for (const f of facades) {
    if (!f.render) continue
    const a = f.from.value, b = f.to.value, dx = b[0]! - a[0]!, dn = b[1]! - a[1]!, span = Math.hypot(dx, dn)
    if (span < .2) continue
    const m = [(a[0]! + b[0]!) / 2, (a[1]! + b[1]!) / 2], left: [number, number] = [-dn / span, dx / span]
    const outLeft = !within(m[0]! + left[0] * .4, m[1]! + left[1] * .4)
    const outRight = !within(m[0]! - left[0] * .4, m[1]! - left[1] * .4)
    if (outLeft === outRight) continue
    out.push({ from: [a[0]!, a[1]!], to: [b[0]!, b[1]!], low: outLeft ? left : [-left[0], -left[1]], height: 6 })
  }
  return out
}

/** The faces the drawn fall is laid against: the house as built, its
    annexes, the street wall and the court's. */
export function drawnFaces(): Catcher[] {
  const house = new Set(builtFaces().filter(f => f.height === 6).slice(0, dossier.site.footprint.length))
  return [...facadeFaces(), ...houseFaces().filter(f => !house.has(f)), ...courtFaces(), ...kerbFaces()]
}

/** The kerb between the court's cobbles and the flagged walk before the
    house (laid in `copings.ts` along the court's north-west edge, 0.24 m
    wide): a leaf lodges against either arris, so each side is a low face. */
function kerbFaces(): Catcher[] {
  const court = polygon('courtyard')
  const a = court[3]!, b = court[2]!, dx = b[0]! - a[0]!, dn = b[1]! - a[1]!, span = Math.hypot(dx, dn)
  const toApron: [number, number] = [-dn / span, dx / span]
  const at = (p: readonly number[], o: number): [number, number] => [p[0]! + toApron[0] * o, p[1]! + toApron[1] * o]
  return [
    { from: at(a, -.24), to: at(b, -.24), low: [-toApron[0], -toApron[1]], height: .16 },
    { from: at(b, 0), to: at(a, 0), low: toApron, height: .16 },
  ]
}
