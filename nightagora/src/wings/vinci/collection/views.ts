/** Named compositions inside the collection's rooms.
 *
 * The rail uses these room views for its canonical stations and certifies
 * every route between them. The same views remain available for inspection.
 */
import { Vector3 } from 'three/webgpu'
import { world } from '../site'
import { VINCI_READING_TABLE } from './approaches'
import { hangPlacements } from './hang'
import { COURT, FACE, FLOOR, GRAVE_ORIGIN, HANG_DATUM, LINE_ORIGIN, LINE_SLAB, SUPPER_WALL } from './layout'
import { standOf } from './stands'

export interface RoomPose { eye: Vector3; at: Vector3; fov: number }
const EYE = FLOOR + 1.62

/** Read each excerpt from its south end. The standing eye has enough room
 * behind the selected date to hold its whole numeral and the gallery with
 * a shallow gaze; the phone places that date above the station card.
 */
/** The course one row of the bench's excerpts is laid on. The line is read
 * from its south end, so row zero is the nearest course to the station and
 * the life runs north away from it. */
const lineCourseNorth = (row: number): number => LINE_ORIGIN.north + (row - 2) * LINE_SLAB.pitchNorth

function lineFloorView(north: number, narrow: boolean): RoomPose {
  const eye = world(LINE_ORIGIN.east + .3, north - 3.4, FLOOR + 1.66)
  const heading = 10 * Math.PI / 180
  const descent = (narrow ? 46 : 25) * Math.PI / 180
  const direction = new Vector3(Math.sin(heading) * Math.cos(descent), -Math.sin(descent), -Math.cos(heading) * Math.cos(descent))
  return { eye, at: eye.clone().add(direction), fov: narrow ? 104 : 72 }
}

/** THE TWO ENDS OF THE HANG, STOOD BACK AND LOOKED AT DIAGONALLY.
 *
 * Thirty-four metres of hang in a room seven deep cannot be held from one
 * pose, and the first answer to that was an eye a metre off the wall aimed
 * along it, which did take all twenty-five into the frame and showed a
 * painting to nobody: edge on, a panel is a line. So each end stands back to
 * the room's own mid depth and turns diagonally onto the FIRST work of its
 * end, which reads whole and well under 40 degrees off its own normal, with
 * the next three or four stepping away behind it and the far end of the wall
 * allowed to leave the frame. The wide stage's card docks left, so each aim
 * is turned to stand its own work clear of it.
 */
const HANG_EYE_NORTH = FACE.pictureWallNorth + 3.79
/** How far past its own end of the hang each eye stands, and how far along the
 * wall its aim runs past the work. The west end is the tighter of the two: the
 * room's west wall and the door to the machines stand right behind it, so it
 * takes a shorter stand off and a longer turn, which is also why its work
 * reads squarer than the east one's. */
const HANG_END = [{ stand: 2.335, turn: .72 }, { stand: 1.255, turn: 1.445 }] as const
/** The phone is the same stand with a narrower frame. Its card peeks at the
 * foot instead of docking at the side, so the aim barely turns and the work
 * takes the middle; the lens comes in rather than out, because holding the
 * whole wall on a 390 px stage is what made the far end a smudge. */
const HANG_END_NARROW = { turn: .3, drop: .35, fov: 68 }
function hangEndPose(end: 0 | 1, narrow: boolean): RoomPose {
  const works = hangPlacements()
  const first = end === 0 ? works[0]! : works[works.length - 1]!
  const side = end === 0 ? 1 : -1, { stand, turn } = HANG_END[end]
  return {
    eye: world(first.east + side * stand, HANG_EYE_NORTH, EYE),
    at: world(first.east - side * (narrow ? HANG_END_NARROW.turn : turn), first.north,
      HANG_DATUM - (narrow ? HANG_END_NARROW.drop : .1)),
    fov: narrow ? HANG_END_NARROW.fov : 60,
  }
}

export function collectionView(id: string, narrow: boolean): RoomPose | undefined {
  /** THE PHONE'S STAGE IS A BAND, NOT A FRAME. The card, the rail, the
   * question and the door take two thirds of 844 px, so a subject aimed at
   * the centre of the frame stands behind the card. The narrow aim is lifted,
   * which drops the subject into the band that is still stage. */
  const pose = (e: number, n: number, h: number, te: number, tn: number, th: number, fov: number, lift = .9): RoomPose =>
    ({ eye: world(e, n, h), at: world(te, tn, th + (narrow ? lift : 0)), fov })
  switch (id) {
    // THE WHOLE LINE, FROM THE END IT IS READ FROM. Eighteen metres of cut
    // dates, and every numeral is cut to be read from its own south: from the
    // north end the whole line stands mirrored. So the one station is at the
    // south end, where the reading begins, and the earliest date is the
    // farthest away. The eye stands 0.4 m south of the last socket, which is
    // all the room the cross wall leaves, and the aim comes down two and a
    // half metres ahead: that is the pitch that holds the near socket inside
    // the frame's foot and still lifts 1452 to the middle of it. The phone
    // takes a wider lens and a shallower drop, which stands the run of them
    // above its card.
    case 'collection-room-line':
      return {
        eye: world(LINE_ORIGIN.east + .3, LINE_ORIGIN.north - 2.24 * LINE_SLAB.pitchNorth, FLOOR + 1.66),
        at: world(LINE_ORIGIN.east, narrow ? -60.8 : -59.8, FLOOR + .01),
        fov: narrow ? 104 : 88,
      }
    // Three fixed excerpts of the bench's date course, kept as the named
    // inspections the excerpt stations were composed from. The life runs away
    // from the visitor, so each excerpt stands four courses south of where it
    // did. The earliest excerpt begins at the station's own feet and the
    // cross wall leaves no room to stand south of that course, so its
    // inspection reads the excerpt from its own head instead.
    case 'collection-room-line-early':
      return lineFloorView(lineCourseNorth(3), narrow)
    case 'collection-room-line-late':
      return lineFloorView(lineCourseNorth(4), narrow)
    case 'collection-room-line-amboise':
      return lineFloorView(lineCourseNorth(8), narrow)
    // THE PICTURE ROOM IS READ FROM ITS TWO ENDS. Thirty-four metres of hang
    // in a room seven deep cannot be held from the middle: at the middle the
    // last six works stand outside the cone and outside the look envelope too.
    // The east end is the end a visitor comes in by from the garden, and its
    // cone holds all twenty-five; the west end is where the wall stops, with
    // the door to the machines at the visitor's shoulder.
    // BOTH ENDS ARE MEASURED AGAINST THE WORKS, not adopted from the generic
    // room adjustment, which is composed for an upright subject. End-on the
    // wall runs from one edge of the frame to its middle, so the aim turns
    // away from the side the card stands on; the phone takes a wider lens and
    // a far lower aim, which is what lifts the run of it out of the card.
    case 'collection-room-picture':
      return hangEndPose(0, narrow)
    // THE WEST END IS READ RAKING, ALONG THE WALL'S OWN LAST WORK. Aimed east
    // down the room instead, the cone takes in the east glazing and with it
    // the outdoor ground and the planting beyond: 222 draws and 1.52 M
    // triangles against the tier's 150 and 1.2 M, and the ground dressing
    // alone is 18 draws drawn twice. Turned onto the last painting the cone
    // leaves the glazing outside it and the reading is 134 draws and 647 K,
    // with every one of the twenty-five still inside the frame, the last one
    // whole at 2.21 m and the door to the machines at the visitor's shoulder.
    case 'collection-room-picture-west':
      return hangEndPose(1, narrow)
    // The two rejected trials, kept reproducible: both are cheaper still and
    // both lose the wall's run, a metre further off the wall holding ten of
    // the twenty-five at 122 draws and seventeen at 127 with a wider lens.
    case 'collection-room-picture-west-trial-a':
      return { eye: world(-60.6, -39.4, EYE), at: world(-58.945, -41.767, HANG_DATUM - .1), fov: narrow ? 104 : 60 }
    case 'collection-room-picture-west-trial-b':
      return { eye: world(-60.6, -39.4, EYE), at: world(-58.945, -41.767, HANG_DATUM - .1), fov: narrow ? 104 : 66 }
    case 'collection-room-picture-long':
      return pose(-24.9, -37.9, EYE, -58, -39.9, HANG_DATUM + .3, narrow ? 78 : 62, .6)
    case 'collection-hang-near':
      return pose(-45.3, -38.4, HANG_DATUM + .05, -45.3, -41.8, HANG_DATUM, narrow ? 52 : 40, .12)
    // THE MECHANISM HALL HAS ONE AISLE, and both of its stations stand on it,
    // so the walk between them and the walk in from the door are the same
    // line and every machine keeps its room around it.
    case 'collection-room-hall':
      return pose(-42.9, -45.5, EYE + .7, -50.5, -46.2, FLOOR + 2.2, narrow ? 84 : 66, 1.3)
    case 'collection-room-hall-screw':
      return pose(-46.5, -48.8, EYE, -54.5, -46.4, FLOOR + 3.1, narrow ? 78 : 62, 1.5)
    // The long gallery, down the line.
    case 'collection-room-gallery':
      // The gallery's existing survey view remains at its south end.
      return pose(-30.2, -60.4, EYE, -30.4, -46, FLOOR + .25, narrow ? 76 : 60, -.55)
    // THE BOOK STANDS IN THE MIDDLE OF THE BROWN, which is a place and not an
    // aim: the panel is centred on the table and the table stands a metre in
    // front of it, so any eye off their shared normal reads the two as offset
    // by a metre of parallax however they are built. This eye is on that
    // normal, square to the wall, 1.72 m out, which is as near as the table's
    // own edge leaves. The lens is what keeps the hall door out of the cone:
 
    case 'collection-room-reading':
      return pose(VINCI_READING_TABLE.east + 2.02, VINCI_READING_TABLE.north, FLOOR + 1.45,
        VINCI_READING_TABLE.east, VINCI_READING_TABLE.north, FLOOR + .8, narrow ? 76 : 50, .3)
    // The eye stands a stride further down the gallery than the hang's own
    // axis asks, because from the nearer place the hall's south-east door
    // opens at the frame's left edge and a slice of the corrections wall's
    // inscription stands inside it, cut to three letters by the jamb.
    case 'collection-room-body':
      return pose(-32.8, -50.6, EYE, -38.7, -52.6, FLOOR + 1.75, narrow ? 78 : 60, .75)
    // The court, and what stands in it under the sky.
    case 'collection-room-court':
      return pose(-30.8, -28.6, COURT.level + 1.68, -47.5, -26.5, COURT.level + 5.2, narrow ? 88 : 70, 1.4)
    case 'collection-room-grave':
      return pose(GRAVE_ORIGIN.east + 8.6, GRAVE_ORIGIN.north - 4.2, COURT.level + 1.66,
        GRAVE_ORIGIN.east + .4, GRAVE_ORIGIN.north + .2, COURT.level + .9, narrow ? 78 : 60, .95)
    case 'collection-room-parachute': {
      // Ten metres of cloth cannot be read from under it: this eye stands off
      // the court's south edge, where the whole pyramid clears the frame.
      const stand = standOf('parachute')
      return pose(stand.east, -32.6, COURT.level + 1.62,
        stand.east, stand.north, COURT.level + 4.6, narrow ? 86 : 68, 2.1)
    }
    case 'collection-room-supper':
      // The field is 8.8 by 4.6 m and the card sits in the middle of the
      // frame: the eye stands where the whole measurement clears it.
      return pose(-31, -26, COURT.level + 1.66,
        SUPPER_WALL.east, SUPPER_WALL.north, COURT.level + 4.4, narrow ? 84 : 62, 1.1)
    default:
      return undefined
  }
}

export const COLLECTION_VIEW_IDS = [
  'collection-room-line',
  'collection-room-line-early', 'collection-room-line-late', 'collection-room-line-amboise',
  'collection-room-picture', 'collection-room-picture-west', 'collection-room-picture-long', 'collection-hang-near',
  'collection-room-picture-west-trial-a', 'collection-room-picture-west-trial-b',
  'collection-room-hall', 'collection-room-hall-screw',
  'collection-room-gallery', 'collection-room-reading', 'collection-room-body',
  'collection-room-court', 'collection-room-grave', 'collection-room-parachute',
  'collection-room-supper',
] as const
