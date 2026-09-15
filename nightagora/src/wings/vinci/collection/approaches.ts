/** WHERE A PERSON STANDS TO LOOK AT ONE EXHIBIT.
 *
 * An approach is NOT a station. It is reachable from exactly one station, it
 * returns to that station, and it is one short straight leg, so it does not
 * belong in the any-to-any product of station poses: the clearance
 * certificate carries these in a second linear table, two entries per
 * exhibit, and the rail refuses an approach it has no certificate for.
 *
 * The offline certifier and the runtime read this one module, so a viewing
 * pose can never move on one side only. Every number here is a modern
 * exhibition choice and documents nothing about 1517.
 */
import { Vector3 } from 'three/webgpu'
import { world } from '../site'
import type { VinciStationId } from '../content'
import { hangPlacements } from './hang'
import { FLOOR } from './layout'

export interface ApproachPose { eye: Vector3; at: Vector3; fov: number }

/** The kinds the registry reads off the scene. Only `picture` carries a
 * viewing pose in this window; the others are read and inert. */
export type VinciExhibitKind = 'picture' | 'sheet' | 'mural' | 'machine' | 'stud' | 'leaf'

export interface VinciExhibitRecord {
  /** Stable across a rebuild and independent of the manifest, because the
   * offline certificate is written without one. */
  id: string
  kind: VinciExhibitKind
  /** The station the approach leaves from and the return lands on. */
  station: VinciStationId
  workId: string
  face: 'front' | 'reverse'
}

/** The room's own standing eye, the one its station pose stands at. */
const EYE = FLOOR + 1.62
/** A person stands off a work far enough to hold it whole, never closer than
 * a small panel asks for and never past the 2.2 m inside which the picture
 * module raises the full plate. */
const NEAREST_M = 1.1, FURTHEST_M = 2.1
/** The lens the standing distance is measured against, per viewport. The
 * frame that holds the work then takes the lens the work asks for at that
 * distance, which is why a wide work on a narrow stage ends at the ceiling. */
const READING_FOV = { desktop: 58, phone: 96 }
/** What the frame leaves around the work. The wide stage frames it and docks
 * the card beside it; the narrow stage has to leave the whole band the card
 * rises into, so the work takes less of it. */
const HEIGHT_MARGIN = { desktop: 1.14, phone: 2.4 }
const WIDTH_MARGIN = { desktop: 1.14, phone: 1.45 }
/** The aspect each pose is composed against, as `rail-projection.ts` fits it. */
const AUTHORED_ASPECT = { desktop: 1280 / 720, phone: 390 / 844 }
/** THE NARROW FRAME'S AIM DROPS, which lifts the whole work above the card,
 * and never so far that the work's own top leaves the frame. */
const NARROW_AIM_DROP = .5, NARROW_TOP_EDGE = .04
const FOV_FLOOR = 34, FOV_CEILING = 104

const exhibitId = (workId: string, face: string): string => `picture/${workId}/${face}`
const halfAngle = (fov: number): number => Math.tan(fov * Math.PI / 360)

/** One straight square eye per plate: on the plate's own normal through its
 * centre, at the distance the work asks for, with the lens that holds it. */
function pictureApproach(field: { east: number; north: number; datum: number; width: number; height: number },
  narrow: boolean): { pose: ApproachPose; distance: number; reach: number; drop: number; aspect: number } {
  const viewport = narrow ? 'phone' : 'desktop'
  const aspect = AUTHORED_ASPECT[viewport]
  // What the work needs of the frame's own half height, on both axes, framed.
  const half = Math.max(field.height / 2 * HEIGHT_MARGIN[viewport], field.width / 2 * WIDTH_MARGIN[viewport] / aspect)
  const distance = Math.min(FURTHEST_M, Math.max(NEAREST_M, half / halfAngle(READING_FOV[viewport])))
  const fov = Math.min(FOV_CEILING, Math.max(FOV_FLOOR, Math.atan(half / distance) * 360 / Math.PI))
  const reach = distance * halfAngle(fov)
  const drop = narrow ? Math.max(0, Math.min(NARROW_AIM_DROP * reach, reach * (1 - NARROW_TOP_EDGE) - field.height / 2)) : 0
  return { distance, reach, drop, aspect,
    pose: { eye: world(field.east, field.north + distance, EYE),
      at: world(field.east, field.north, field.datum - drop), fov } }
}

function placement(id: string) {
  return hangPlacements().find(field => exhibitId(field.id, field.face) === id)
}

/** What the frame holds of the work at its own pose: the share of the frame's
 * own half extents the work takes, both axes. Over one means the frame cuts
 * the work, which is what the offline check refuses. */
export function vinciApproachFit(id: string, narrow: boolean): { height: number; width: number } | undefined {
  const field = placement(id)
  if (!field) return undefined
  const { reach, drop, aspect } = pictureApproach(field, narrow)
  return { height: (field.height / 2 + drop) / reach, width: field.width / 2 / (reach * aspect) }
}

/** THIS WINDOW'S OPENABLE SET: the picture room's hang, whose wall placement
 * is the same list the room builds its frames from and the picture module
 * streams its sources onto. */
export function vinciExhibitRecords(): readonly VinciExhibitRecord[] {
  return hangPlacements().map(field => ({ id: exhibitId(field.id, field.face), kind: 'picture' as const,
    station: 'picture-room' as VinciStationId, workId: field.id, face: field.face }))
}

/** The viewing pose of one exhibit, or undefined when this window does not
 * stand a person in front of it. */
export function vinciApproachPose(id: string, narrow: boolean): ApproachPose | undefined {
  const field = placement(id)
  return field ? pictureApproach(field, narrow).pose : undefined
}

/** The distance from the viewing eye to the plate's own centre, which is what
 * the picture module's 2.2 m rule measures. */
export function vinciApproachPlateMetres(id: string, narrow: boolean): number | undefined {
  const field = placement(id)
  if (!field) return undefined
  return pictureApproach(field, narrow).pose.eye.distanceTo(new Vector3(field.east, field.datum, -field.north))
}

/** The identity the registry joins a mounted plate to. */
export const vinciPlateExhibitId = exhibitId
