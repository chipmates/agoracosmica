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
/** A person stands about a picture's own height off it, never closer than a
 * small panel asks for. */
const NEAREST_M = 1.1, FURTHEST_M = 2.1
/** THE NARROW STAGE STEPS BACK RATHER THAN STANDING A WORK BEHIND ITS CARD.
 * A phone leaves a work less than half its frame and the lens is already at
 * its ceiling, so the largest works are held whole by distance instead: the
 * eye takes a step back, the way a person does in front of a big picture.
 * The furthest still stands in front of the room's own bench, and the full
 * plate raises at that distance because the module reads its own reach. */
const PHONE_FURTHEST_M = 2.72, STEP_BACK_M = .04
/** THE FRAME IS NOT THE STAGE. The bar, the door and the card stand on the
 * stage too, so the band a work may fill is what is left of it, in the
 * frame's own coordinates: plus one at the top edge, minus one at the bottom.
 * The wide stage docks the card at its right, which is what the side bound
 * holds the work clear of; the narrow stage raises the card from the bottom.
 */
const BAND = {
  desktop: { top: .87, bottom: -.66, side: .45 },
  phone: { top: .92, bottom: 0, side: .94 },
}
/** The aspect each pose is composed against, as `rail-projection.ts` fits it. */
const AUTHORED_ASPECT = { desktop: 1280 / 720, phone: 390 / 844 }
/** The lens a work may ask for. The narrow stage goes wider than the wide one
 * because it has half the band and the work is square to the eye, where a
 * wide lens is a scale and not a distortion. */
const FOV_FLOOR = 34, FOV_CEILING = { desktop: 84, phone: 118 }
/** How near the frame's own edge a work may ever stand, when the band gives way. */
const FRAME_EDGE = .96

const exhibitId = (workId: string, face: string): string => `picture/${workId}/${face}`
const halfAngle = (fov: number): number => Math.tan(fov * Math.PI / 360)

interface Field { east: number; north: number; datum: number; width: number; height: number }

/** Where the work's own four corners land in the frame, exactly: the camera
 * has no roll and the eye stands on the work's centre line, so this is the
 * same projection the renderer runs, without a renderer. */
function corners(field: Field, distance: number, drop: number, fov: number, aspect: number)
  : { top: number; bottom: number; side: number } {
  const eye = world(field.east, field.north + distance, EYE)
  const at = world(field.east, field.north, field.datum - drop)
  const forward = at.clone().sub(eye).normalize()
  // The camera's own right, which is forward crossed with world up.
  const right = new Vector3(-forward.z, 0, forward.x).normalize()
  const up = right.clone().cross(forward).normalize()
  const tan = halfAngle(fov), point = new Vector3()
  let top = -Infinity, bottom = Infinity, side = 0
  for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
    point.set(field.east + x * field.width / 2, field.datum + y * field.height / 2, -field.north).sub(eye)
    const along = point.dot(forward)
    if (!(along > 0)) return { top: Infinity, bottom: -Infinity, side: Infinity }
    const ndcY = point.dot(up) / along / tan
    const ndcX = point.dot(right) / along / (tan * aspect)
    top = Math.max(top, ndcY); bottom = Math.min(bottom, ndcY); side = Math.max(side, Math.abs(ndcX))
  }
  return { top, bottom, side }
}

/** The aim that stands the work in the middle of the band it is left. Aiming
 * lower lifts the work, and the response is monotone, so this is exact to the
 * tenth of a millimetre in thirty steps. */
function centredDrop(field: Field, distance: number, fov: number, aspect: number, top: number, bottom: number): number {
  let low = -1, high = 3
  for (let step = 0; step < 40; step++) {
    const drop = (low + high) / 2
    const seen = corners(field, distance, drop, fov, aspect)
    if ((top - seen.top) - (seen.bottom - bottom) > 0) low = drop; else high = drop
  }
  return (low + high) / 2
}

/** One straight square eye per plate: on the plate's own normal through its
 * centre, at the distance the work's own size asks for, with the narrowest
 * lens that holds the whole work. Where that distance cannot hold it in the
 * band the card leaves, the eye steps back until it can; the band gives way
 * at the bottom only when the room behind the eye has run out, and the frame
 * never cuts the work.
 */
function pictureApproach(field: Field, narrow: boolean)
  : { pose: ApproachPose; distance: number; drop: number; bottom: number; fit: { height: number; width: number } } {
  const viewport = narrow ? 'phone' : 'desktop'
  const aspect = AUTHORED_ASPECT[viewport], band = BAND[viewport], ceiling = FOV_CEILING[viewport]
  const furthest = narrow ? PHONE_FURTHEST_M : FURTHEST_M
  let distance = Math.min(furthest, Math.max(NEAREST_M, field.height, field.width))
  const solve = (distance: number, bottom: number): { fov: number; drop: number; holds: boolean } => {
    const fits = (fov: number): boolean => {
      const drop = centredDrop(field, distance, fov, aspect, band.top, bottom)
      const seen = corners(field, distance, drop, fov, aspect)
      return seen.top <= band.top && seen.bottom >= bottom && seen.side <= band.side
    }
    let low = FOV_FLOOR, high = ceiling
    if (fits(low)) high = low
    else for (let step = 0; step < 24; step++) {
      const fov = (low + high) / 2
      if (fits(fov)) high = fov; else low = fov
    }
    return { fov: high, drop: centredDrop(field, distance, high, aspect, band.top, bottom), holds: fits(high) }
  }
  let bottom = band.bottom, answer = solve(distance, bottom)
  // A STEP BACK BEFORE THE BAND GIVES WAY. Only the band's own last resort
  // puts a work's foot behind the card, and it is reached now only where the
  // room itself runs out behind the standing eye.
  while (!answer.holds && distance < furthest - 1e-9) {
    distance = Math.min(furthest, distance + STEP_BACK_M)
    answer = solve(distance, bottom)
  }
  while (!answer.holds && bottom > FRAME_EDGE * -1) {
    bottom = Math.max(-FRAME_EDGE, bottom - .04)
    answer = solve(distance, bottom)
  }
  const seen = corners(field, distance, answer.drop, answer.fov, aspect)
  return {
    distance, drop: answer.drop, bottom,
    fit: { height: (seen.top - seen.bottom) / (band.top - bottom), width: seen.side / band.side },
    pose: { eye: world(field.east, field.north + distance, EYE),
      at: world(field.east, field.north, field.datum - answer.drop), fov: answer.fov },
  }
}

function placement(id: string): Field & { id: string; face: string } | undefined {
  return hangPlacements().find(field => exhibitId(field.id, field.face) === id)
}

/** What the frame holds of the work at its own pose: the share of the band it
 * takes, both axes, and the band it settled on. Over one means the frame cuts
 * the work, which is what the offline check refuses; a bottom under the
 * authored one is a work whose own foot stands behind the card. */
export function vinciApproachFit(id: string, narrow: boolean)
  : { height: number; width: number; bottom: number; authoredBottom: number } | undefined {
  const field = placement(id)
  if (!field) return undefined
  const answer = pictureApproach(field, narrow)
  return { ...answer.fit, bottom: answer.bottom, authoredBottom: BAND[narrow ? 'phone' : 'desktop'].bottom }
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
 * the picture module's near rule measures. */
export function vinciApproachPlateMetres(id: string, narrow: boolean): number | undefined {
  const field = placement(id)
  if (!field) return undefined
  return pictureApproach(field, narrow).pose.eye.distanceTo(new Vector3(field.east, field.datum, -field.north))
}

let reach = 0
/** THE ROOM'S ONE FULL SLOT HAS TO REACH THE EYE THE MODULE STANDS. The
 * furthest certified viewing eye, over every exhibit and both viewports, so
 * the plate a visitor has walked up to raises at whatever distance the band
 * solver settled on and nowhere else. */
export function vinciApproachReachMetres(): number {
  if (reach) return reach
  for (const record of vinciExhibitRecords()) for (const narrow of [false, true]) {
    reach = Math.max(reach, vinciApproachPlateMetres(record.id, narrow) ?? 0)
  }
  return reach
}

/** The identity the registry joins a mounted plate to. */
export const vinciPlateExhibitId = exhibitId
