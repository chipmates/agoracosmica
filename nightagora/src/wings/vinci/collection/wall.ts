/** A WALL: an ordered list of exhibits standing on one surface, each at the
 * viewing eye its own work already asks for.
 *
 * A cone cannot hold thirty-four metres of hang in a room seven deep, so the
 * room is not read from one pose: it is walked. The stops are the twenty-five
 * certified viewing eyes, unmoved, and the two end stations are the ends of
 * the same polyline, which is what makes a run from any stop to any other a
 * SUB-PATH of one proof instead of six hundred and fifty new ones. The
 * clearance certificate carries the polyline in a table that is linear in the
 * stops, never the product of them.
 *
 * Nothing here is a claim about a room in 1517: the order is the wall's own,
 * from the end a visitor comes in by.
 */
import { hangPlacements } from './hang'

export interface VinciWallStop {
  /** Its place along the wall, counted from the end a visitor comes in by. */
  index: number
  exhibit: string
  workId: string
  face: 'front' | 'reverse'
  east: number
}

/** The one wall this wing has. A second wall is a second id and the same table. */
export const VINCI_PICTURE_WALL = 'picture-room-main'
/** The two stations the wall runs between, in the certificate's own order:
 * vertex 0 is the east end, the last vertex is the west end. */
export const VINCI_WALL_ENDS = ['picture-room', 'picture-room-west'] as const

const exhibitId = (workId: string, face: string): string => `picture/${workId}/${face}`

/** The stops in walking order, east to west, which the hang lays out as the
 * order of the life. Read off the placement rather than the list, so the order
 * follows the wall even if the wall is laid from the other end. */
export function vinciWallStops(): readonly VinciWallStop[] {
  return [...hangPlacements()]
    .sort((a, b) => b.east - a.east)
    .map((work, index) => ({
      index, exhibit: exhibitId(work.id, work.face), workId: work.id, face: work.face, east: work.east,
    }))
}

/** Where a stop stands on the polyline: the end stations are its two ends. */
export function vinciWallVertex(exhibit: string): number | undefined {
  const at = vinciWallStops().findIndex(stop => stop.exhibit === exhibit)
  return at < 0 ? undefined : at + 1
}

/** The vertex a station eye stands at, or undefined for a station that is not
 * an end of this wall. */
export function vinciWallEndVertex(station: string): number | undefined {
  const at = VINCI_WALL_ENDS.indexOf(station as typeof VINCI_WALL_ENDS[number])
  return at < 0 ? undefined : at === 0 ? 0 : vinciWallStops().length + 1
}

/** The nearer end of the wall to a vertex, which is where a walk that leaves
 * the wall comes back to standing. */
export function vinciWallNearerEnd(vertex: number): typeof VINCI_WALL_ENDS[number] {
  const last = vinciWallStops().length + 1
  return vertex <= last / 2 ? VINCI_WALL_ENDS[0] : VINCI_WALL_ENDS[1]
}
