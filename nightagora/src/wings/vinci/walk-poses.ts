/** THE POSES THE WALK STANDS AT THAT ARE NOT STATIONS.
 *
 * THE HOUSE'S DOOR IS CROSSED BY A CUT, NOT WALKED. The passages behind it
 * are the weakest rooms the wing has, so a walk into the great hall comes up
 * the threshold steps to the door facing in, the picture dips, and the hall
 * stands there; a walk out of it dips and stands on the steps facing out over
 * the court, and walks on from there. Both door poses stand on the certified
 * line up the steps, between their foot and the landing.
 *
 * THE HEART VALVE STANDS APART FROM THE BODY WALL'S GRID, and the wall's own
 * line to it passes every sheet of the grid course by course. So its stop is a
 * pose of its own, the sheet's own viewing eye, walked to and from straight.
 *
 * Each is a physical pose of the rail like a station's: the certificate
 * proves every walk between it and every other pose (`rail-certify.mjs` and
 * `rail-proof.ts` read this list), and none of them moves a station.
 */
import { Vector3 } from 'three/webgpu'
import type { VinciStationId } from './content'
import { world } from './site'
import { vinciApproachPose } from './collection/approaches'
import { FRAME_FRONT, mountedSheets } from './collection/body-wall-plan'
import { VINCI_VALVE, type VinciWalkPoseId } from './walk-places'
import { railCollectionStairWaypoints } from './rail-waypoints'

export { VINCI_HOUSE_DOOR, VINCI_STAIR_HEAD, VINCI_VALVE, VINCI_WALK_POSE_IDS, isVinciWalkPose, type VinciWalkPoseId } from './walk-places'

interface WalkPose { eye: Vector3; at: Vector3; fov: number }

/** The rail reads a place's id for the wall it ends and the side it stands
 * on; a pose of the walk ends no wall, so it is handed over under the
 * station's type. */
export const vinciRailPlace = (id: VinciWalkPoseId): VinciStationId => id as unknown as VinciStationId

/** The foot of the five threshold treads and the landing in the doorway, the
 * two turns every certified walk into the house takes (rail-waypoints.ts), in
 * east, north and eye height. */
const STEPS_FOOT = [4.834, -14.329, 1.65] as const, STEPS_LANDING = [3.0682, -13.0604, 2.45] as const
const onTheSteps = (share: number): [number, number, number] =>
  [0, 1, 2].map(i => STEPS_FOOT[i]! + (STEPS_LANDING[i]! - STEPS_FOOT[i]!) * share) as [number, number, number]
/** Where the passage turns toward the hall's door, which the door's inward
 * view looks down. */
const ENFILADE = [.0049, -8.3434] as const

/** THE WAY IN stands three quarters up the steps, half a metre short of the
 * landing, looking up through the door and down the passage: the lens is the
 * court's own, so the walk up from the court does not zoom. */
const DOOR_IN_SHARE = .75, DOOR_OUT_SHARE = .55
const DOOR_LENS = { desktop: 60, phone: 80 }
/** THE WAY OUT stands a step lower and looks out over the court the walk
 * goes on into, a little down, as a person on the steps does. */
const DOOR_OUT_AIM = [8, -21, 1.1] as const

function doorPose(id: 'hall-door-in' | 'hall-door-out', narrow: boolean): WalkPose {
  const fov = DOOR_LENS[narrow ? 'phone' : 'desktop']
  if (id === 'hall-door-in') {
    const eye = onTheSteps(DOOR_IN_SHARE)
    return { eye: world(...eye), at: world(ENFILADE[0], ENFILADE[1], STEPS_LANDING[2]), fov }
  }
  return { eye: world(...onTheSteps(DOOR_OUT_SHARE)), at: world(...DOOR_OUT_AIM), fov }
}

/** THE VALVE'S SHEET IS READ LARGE AND CENTRED ON THE DESKTOP. The eye is the
 * sheet's certified viewing eye, unmoved; the aim rises to the sheet and the
 * lens closes until its frame takes more than half the picture, its middle a
 * little above the picture's. The words stand in the band under the picture,
 * so nothing is carried aside. The shares hold at the desktop picture under
 * the English band (1440 by 708), which is also the film's wide frame cropped
 * to that box; the lens is authored for the rail's 16:9 frame, which keeps
 * its horizontal field on wider pictures (`rail-projection.ts`). The phone
 * keeps its approach: the sheet already takes three fifths of its picture. */
const VALVE_FILL = .57, VALVE_MIDDLE = .47, DESK_PICTURE_ASPECT = 1440 / 708, RAIL_ASPECT = 1280 / 720
function valveDesktopPose(pose: WalkPose): WalkPose {
  const sheet = mountedSheets().find(entry => `sheet/${entry.mount.id}` === VINCI_VALVE.exhibit)
  if (!sheet) return pose
  const eye = pose.eye, middle = world(FRAME_FRONT, sheet.mount.north, sheet.mount.datum)
  const reach = Math.hypot(middle.x - eye.x, middle.z - eye.z)
  const rise = (height: number): number => Math.atan2(height - eye.y, reach)
  const top = rise(sheet.frame.top), foot = rise(sheet.frame.bottom)
  // the frame's edges on the picture, in half heights of the lens from its middle
  const topAt = 1 - 2 * (VALVE_MIDDLE - VALVE_FILL / 2), footAt = 2 * (VALVE_MIDDLE + VALVE_FILL / 2) - 1
  // the pitch at which both edges ask for the same lens
  let low = foot, high = top
  for (let i = 0; i < 60; i++) {
    const pitch = (low + high) / 2
    if (Math.tan(top - pitch) / topAt > Math.tan(pitch - foot) / footAt) low = pitch
    else high = pitch
  }
  const pitch = (low + high) / 2, half = Math.tan(top - pitch) / topAt
  const toward = new Vector3(middle.x - eye.x, 0, middle.z - eye.z).normalize()
  const at = eye.clone().add(new Vector3(toward.x * Math.cos(pitch), Math.sin(pitch), toward.z * Math.cos(pitch)).multiplyScalar(reach))
  return { eye: eye.clone(), at, fov: 360 / Math.PI * Math.atan(half * DESK_PICTURE_ASPECT / RAIL_ASPECT) }
}

/** THE HEAD OF THE COLLECTION STAIR, a stride back from its first tread on
 * the top landing: the stair goes down in front, the pavilion's glazing below
 * it, and the court with the display wall and its machines on the right. The
 * phone looks further round, to the Supper room and the parachute: the walk
 * down turns right on to the Last Supper's door (`rail.ts`, the descent's
 * look), and the phone's turn there and back to the picture room stays under
 * the film's heading line only from here. Bearings are east of north. */
const STAIR_HEAD_BACK_M = .4, STAIR_HEAD_REACH_M = 20
const STAIR_HEAD_LOOK = { desktop: { bearing: 210, pitch: -12, fov: 55 }, phone: { bearing: 234, pitch: -16, fov: 80 } }
function stairHeadPose(narrow: boolean): WalkPose {
  const [east, north, height] = railCollectionStairWaypoints[0]!
  const look = STAIR_HEAD_LOOK[narrow ? 'phone' : 'desktop']
  const bearing = look.bearing * Math.PI / 180, pitch = look.pitch * Math.PI / 180, level = Math.cos(pitch) * STAIR_HEAD_REACH_M
  const eye = [east, north + STAIR_HEAD_BACK_M, height] as const
  return { eye: world(...eye), fov: look.fov,
    at: world(eye[0] + Math.sin(bearing) * level, eye[1] + Math.cos(bearing) * level, eye[2] + Math.sin(pitch) * STAIR_HEAD_REACH_M) }
}

/** The pose one of the walk's own places stands at. */
export function vinciWalkPoseOf(id: VinciWalkPoseId, narrow: boolean): WalkPose {
  if (id === 'stair-head') return stairHeadPose(narrow)
  if (id === 'body-valve') {
    const pose = vinciApproachPose(VINCI_VALVE.exhibit, narrow)
    if (!pose) throw new Error(`${VINCI_VALVE.exhibit}: no viewing eye for the valve's stop`)
    return narrow ? pose : valveDesktopPose(pose)
  }
  return doorPose(id, narrow)
}
