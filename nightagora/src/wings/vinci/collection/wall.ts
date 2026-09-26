/** A WALL: an ordered list of exhibits standing on one surface, each at the
 * viewing eye its own work already asks for.
 *
 * A cone cannot hold thirty-four metres of hang in a room seven deep, so the
 * room is not read from one pose: it is walked. The stops are the certified
 * viewing eyes, unmoved, and the end stations are the ends of the same
 * polyline, which is what makes a run from any stop to any other a SUB-PATH
 * of one proof instead of six hundred and fifty new ones. The clearance
 * certificate carries each polyline in a table that is linear in the stops,
 * never the product of them.
 *
 * Two walls stand in this wing. The hang runs between the picture room's two
 * end stations, so its polyline has a station at each end. The body wall's
 * sheets are read from the one station the gallery gives them, so its
 * polyline begins at that eye and ends at its last sheet.
 *
 * Nothing here is a claim about a room in 1517: the order is each wall's own,
 * from the end a visitor comes in by.
 */
import type { VinciStationId } from '../content'
import { bodyMounts, type BodyMount } from './body-wall'
import { hangPlacements } from './hang'
import { FACE } from './layout'

export interface VinciWallStop {
  /** Its place along the wall, counted from the end a visitor comes in by. */
  index: number
  exhibit: string
  workId: string | null
  face: 'front' | 'reverse' | null
  east: number
}

export interface VinciWall {
  id: string
  /** The stations the polyline's ends stand at, in the certificate's order:
   * vertex 0 is the first, and where a second is declared it is the last. */
  ends: readonly VinciStationId[]
  stops(): readonly VinciWallStop[]
  /** The aisle a long run walks down instead of the eyes' own line. */
  gallery?: VinciGallery
}

/** THE GALLERY WALK. The eyes of a hang stand where each work is read, a
 * metre or two off it and in and out with the size of the work, so a run past
 * twenty of them along their own line weaves along the frames. A run this
 * long walks one straight line down the room instead, and meets the eyes it
 * leaves and arrives at by one spur each, `gateM` along the room from the
 * eye, forward in the walk. The certificate proves the line whole and every
 * spur with its corner, so the table stays linear in the stops. */
export interface VinciGallery { north: number; gateM: number }
/** A run along a wall this long walks the gallery where one is declared, and
 * leads its gaze down the room. */
export const GALLERY_WALK_M = 8
/** The least straight between the two gates of a gallery run: from it on, a
 * gate's rounding is set by its own spur alone (a quarter of the span, at
 * most half a metre), so one proof per spur serves every run through it. */
export const GALLERY_MIDDLE_LEAST_M = 2.1
type ENH = readonly number[]
/** Where a vertex meets the gallery's line walking toward `side` (+1 east,
 * -1 west): the line's own north, `gateM` along from the vertex, at its eye
 * height. */
export function vinciGalleryGate(gallery: VinciGallery, vertex: ENH, side: 1 | -1): [number, number, number] {
  return [vertex[0]! + side * gallery.gateM, gallery.north, vertex[2]!]
}
/** The polyline of a gallery run between two vertices of a wall's own line
 * (points east, north, height), or null where the two gates stand too close
 * for the straight between them. */
export function vinciGalleryRun(gallery: VinciGallery, points: readonly ENH[], from: number, to: number): ENH[] | null {
  const a = points[from], b = points[to]
  if (!a || !b || from === to) return null
  const side: 1 | -1 = b[0]! > a[0]! ? 1 : -1
  const leave = vinciGalleryGate(gallery, a, side), arrive = vinciGalleryGate(gallery, b, side === 1 ? -1 : 1)
  if (side * (arrive[0] - leave[0]) < GALLERY_MIDDLE_LEAST_M) return null
  return [a, leave, arrive, b]
}

const exhibitId = (workId: string, face: string): string => `picture/${workId}/${face}`

/** The stops of the hang in walking order, east to west, which is the order
 * of the life. Read off the placement rather than the list, so the order
 * follows the wall even if the wall is laid from the other end. */
function pictureStops(): readonly VinciWallStop[] {
  return [...hangPlacements()]
    .sort((a, b) => b.east - a.east)
    .map((work, index) => ({
      index, exhibit: exhibitId(work.id, work.face), workId: work.id, face: work.face, east: work.east,
    }))
}

/** THE BODY WALL'S OWN ORDER. Four courses of seven sheets and the one that
 * stands apart. A course is read across and the next one back the other way,
 * so the walk steps in or out at the end of a course and never turns on
 * itself; the sheet apart is the last stop, reached by going on north past
 * the grid rather than by doubling back to it.
 */
export function bodyWallOrder(): readonly BodyMount[] {
  const mounts = bodyMounts()
  const grid = mounts.filter(mount => mount.row !== 'vortex')
  const courses = [...new Set(grid.map(mount => mount.row as number))].sort((a, b) => a - b)
  const order: BodyMount[] = []
  for (const [at, row] of courses.entries()) {
    const course = grid.filter(mount => mount.row === row).sort((a, b) => a.north - b.north)
    order.push(...(at % 2 === 0 ? [...course].reverse() : course))
  }
  order.push(...mounts.filter(mount => mount.row === 'vortex'))
  return order
}

function bodyStops(): readonly VinciWallStop[] {
  return bodyWallOrder().map((mount, index) => ({
    index, exhibit: `sheet/${mount.id}`, workId: null, face: null, east: mount.east,
  }))
}

export const VINCI_PICTURE_WALL = 'picture-room-main'
export const VINCI_BODY_WALL = 'body-wall-main'
/** The two stations the hang runs between, in the certificate's own order. */
export const VINCI_WALL_ENDS = ['picture-room', 'picture-room-west'] as const

/** THE PICTURE ROOM'S AISLE. The room's middle holds the bench row, so the
 * walk down it runs between the benches and the hang: 2.45 m off the hang's
 * face, half a metre clear of the benches' edge, where the frames pass as a
 * row and not one by one at arm's length. */
const PICTURE_GALLERY: VinciGallery = { north: FACE.pictureWallNorth + 2.45, gateM: 2 }

export const VINCI_WALLS: readonly VinciWall[] = [
  { id: VINCI_PICTURE_WALL, ends: [...VINCI_WALL_ENDS], stops: pictureStops, gallery: PICTURE_GALLERY },
  { id: VINCI_BODY_WALL, ends: ['body'], stops: bodyStops },
]

export const vinciWallById = (id: string): VinciWall | undefined => VINCI_WALLS.find(wall => wall.id === id)
/** The wall a station stands on an end of, or undefined for a station that
 * ends no wall. */
export const vinciWallOfStation = (station: string | null | undefined): VinciWall | undefined =>
  station === null || station === undefined ? undefined : VINCI_WALLS.find(wall => (wall.ends as readonly string[]).includes(station))
/** The wall an exhibit is a stop of. */
export const vinciWallOfExhibit = (exhibit: string): VinciWall | undefined =>
  VINCI_WALLS.find(wall => wall.stops().some(stop => stop.exhibit === exhibit))

export const vinciWallStops = (wall: VinciWall): readonly VinciWallStop[] => wall.stops()
/** The last vertex of a wall's polyline. */
export const vinciWallLastVertex = (wall: VinciWall): number => wall.stops().length + wall.ends.length - 1
/** Where a stop stands on the polyline: the end stations are its ends. */
export function vinciWallVertex(wall: VinciWall, exhibit: string): number | undefined {
  const at = wall.stops().findIndex(stop => stop.exhibit === exhibit)
  return at < 0 ? undefined : at + 1
}
/** The vertex a station eye stands at, or undefined for a station that is not
 * an end of this wall. */
export function vinciWallEndVertex(wall: VinciWall, station: string): number | undefined {
  const at = wall.ends.indexOf(station as VinciStationId)
  return at < 0 ? undefined : at === 0 ? 0 : vinciWallLastVertex(wall)
}
/** The nearer end of the wall to a vertex, which is where a walk that leaves
 * the wall comes back to standing. */
export function vinciWallNearerEnd(wall: VinciWall, vertex: number): VinciStationId {
  if (wall.ends.length < 2) return wall.ends[0]!
  return vertex <= vinciWallLastVertex(wall) / 2 ? wall.ends[0]! : wall.ends[1]!
}
/** True where a vertex is a station eye and not a stop. */
export const vinciWallIsEnd = (wall: VinciWall, vertex: number): boolean =>
  vertex === 0 || (wall.ends.length > 1 && vertex === vinciWallLastVertex(wall))
/** Where an exhibit stands in its own wall's order, for a row that reads as
 * the wall reads. */
export function vinciWallOrderOf(exhibit: string): number | undefined {
  const wall = vinciWallOfExhibit(exhibit)
  if (!wall) return undefined
  const at = wall.stops().findIndex(stop => stop.exhibit === exhibit)
  return at < 0 ? undefined : at
}
