/** Named compositions inside the collection's rooms.
 *
 * The rail uses these room views for its canonical stations and certifies
 * every route between them. The same views remain available for inspection.
 */
import { Vector3 } from 'three/webgpu'
import { world } from '../site'
import { COURT, FLOOR, GRAVE_ORIGIN, HANG_DATUM, LINE_ORIGIN, LINE_SLAB, SUPPER_WALL } from './layout'
import { STANDS } from './stands'

export interface RoomPose { eye: Vector3; at: Vector3; fov: number }
const EYE = FLOOR + 1.62

/** Read each excerpt from its south end. The standing eye has enough room
 * behind the selected date to hold its whole numeral and the gallery with
 * a shallow gaze; the phone places that date above the station card.
 */
function lineFloorView(north: number, narrow: boolean): RoomPose {
  const eye = world(LINE_ORIGIN.east + .3, north - 3.4, FLOOR + 1.66)
  const heading = 10 * Math.PI / 180
  const descent = (narrow ? 46 : 25) * Math.PI / 180
  const direction = new Vector3(Math.sin(heading) * Math.cos(descent), -Math.sin(descent), -Math.cos(heading) * Math.cos(descent))
  return { eye, at: eye.clone().add(direction), fov: narrow ? 104 : 72 }
}

export function collectionView(id: string, narrow: boolean): RoomPose | undefined {
  /** THE PHONE'S STAGE IS A BAND, NOT A FRAME. The card, the rail, the
   * question and the door take two thirds of 844 px, so a subject aimed at
   * the centre of the frame stands behind the card. The narrow aim is lifted,
   * which drops the subject into the band that is still stage. */
  const pose = (e: number, n: number, h: number, te: number, tn: number, th: number, fov: number, lift = .9): RoomPose =>
    ({ eye: world(e, n, h), at: world(te, tn, th + (narrow ? lift : 0)), fov })
  switch (id) {
    // Three fixed excerpts of the bench's date course, walked south from
    // the picture room. The selected dates are 1452, 1503 and 1517; the
    // last section continues to the two 1519 studs at the end of the line.
    case 'collection-room-line-early': {
      const north = LINE_ORIGIN.north + 9 * LINE_SLAB.pitchNorth
      return lineFloorView(north, narrow)
    }
    case 'collection-room-line-late': {
      const north = LINE_ORIGIN.north + 5 * LINE_SLAB.pitchNorth
      return lineFloorView(north, narrow)
    }
    case 'collection-room-line-amboise': {
      const north = LINE_ORIGIN.north + LINE_SLAB.pitchNorth
      return lineFloorView(north, narrow)
    }
    // The picture room, standing where a visitor stands to read a hang.
    case 'collection-room-picture':
      return pose(-38.2, -35.6, EYE, -42.6, -41.8, HANG_DATUM + .1, narrow ? 74 : 58, .8)
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
    case 'collection-room-corrections':
      return pose(-50.4, -52.4, EYE + .3, -56.4, -62.6, FLOOR + 3.1, narrow ? 82 : 64, 1.5)
    // The long gallery, down the line.
    case 'collection-room-gallery':
      // The gallery's existing survey view remains at its south end.
      return pose(-30.2, -60.4, EYE, -30.4, -46, FLOOR + .25, narrow ? 76 : 60, -.55)
    case 'collection-room-reading':
      return pose(-34.6, -46.3, EYE - .08, -37.7, -45.35, FLOOR + 1.28, narrow ? 76 : 60, .3)
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
      const stand = STANDS['parachute']
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
  'collection-room-line-early', 'collection-room-line-late', 'collection-room-line-amboise',
  'collection-room-picture', 'collection-room-picture-long', 'collection-hang-near',
  'collection-room-hall', 'collection-room-hall-screw', 'collection-room-corrections',
  'collection-room-gallery', 'collection-room-reading', 'collection-room-body',
  'collection-room-court', 'collection-room-grave', 'collection-room-parachute',
  'collection-room-supper',
] as const
