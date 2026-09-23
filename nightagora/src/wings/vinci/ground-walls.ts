/* THE BUILT FACES THE GROUND MEETS.

   Where a wall stands on the ground is where the wind lays leaves and the
   damp keeps moss: the house and its annexes all round, the street wall,
   the walls of the insertion's court and both faces of the supper wall.
   Each face carries the unit normal of the side the ground lies on. */
import { dossier, polygon, type Quantity } from './site'
import { COURT, SUPPER_WALL } from './collection/layout'
import { GALLERY } from './collection/rooms'

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
