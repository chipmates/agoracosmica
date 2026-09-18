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
import { GRAVE_DEATHBED, GRAVE_FRAME, GRAVE_SLAB } from '../grave/placement'
import { LINE_STUDS, lineCutStuds } from '../line/studs'
import { hangPlacements } from './hang'
import { COURT, FACE, FLOOR, GRAVE_ORIGIN, LINE_ORIGIN, OPENING, SUPPER_WALL } from './layout'
import { STANDS, standLevel } from './stands'
import { dossiers, MACHINE_SLUGS, type MachineSlug } from '../machines/catalog'

export interface ApproachPose { eye: Vector3; at: Vector3; fov: number }

/** The kinds the registry reads off the scene. A sheet is read and inert. */
export type VinciExhibitKind = 'picture' | 'sheet' | 'mural' | 'machine' | 'stud' | 'manuscript' | 'place'

export interface VinciExhibitRecord {
  /** Stable across a rebuild and independent of the manifest, because the
   * offline certificate is written without one. */
  id: string
  kind: VinciExhibitKind
  /** The station the approach leaves from and the return lands on. */
  station: VinciStationId
  /** A plate's work and face; null for the kinds that are not plates. */
  workId: string | null
  face: 'front' | 'reverse' | null
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

/** A flat work, in a frame where it faces north: the eye stands north of it. */
interface Field {
  east: number; north: number; datum: number; width: number; height: number
  /** The height the standing eye is at, and how near and far it may stand. */
  eye?: number; nearest?: number; furthest?: { desktop: number; phone: number }
}

/** Where the work's own four corners land in the frame, exactly: the camera
 * has no roll and the eye stands on the work's centre line, so this is the
 * same projection the renderer runs, without a renderer. */
function corners(field: Field, distance: number, drop: number, fov: number, aspect: number)
  : { top: number; bottom: number; side: number } {
  const eye = world(field.east, field.north + distance, field.eye ?? EYE)
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
  const furthest = field.furthest?.[viewport] ?? (narrow ? PHONE_FURTHEST_M : FURTHEST_M)
  let distance = Math.min(furthest, Math.max(field.nearest ?? NEAREST_M, field.height, field.width))
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
    pose: { eye: world(field.east, field.north + distance, field.eye ?? EYE),
      at: world(field.east, field.north, field.datum - answer.drop), fov: answer.fov },
  }
}

/** A WALL THAT FACES EAST IS A WALL THAT FACES NORTH, turned a quarter. The
 * plane is solved in a frame where it faces north and the pose is turned back:
 * a quarter turn only swaps coordinates and one sign, so it is exact. */
function eastFacingApproach(field: Field, narrow: boolean): ApproachPose {
  const turned = pictureApproach({ ...field, east: -field.north, north: field.east }, narrow).pose
  const back = (v: Vector3): Vector3 => new Vector3(-v.z, v.y, v.x)
  return { eye: back(turned.eye), at: back(turned.at), fov: turned.fov }
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

/* ---- the kinds beyond the hang ----------------------------------------- */

/** The lens a narrow stage takes for an object it is not walked to: the same
 * eye, opened by a third, never past what a phone lens is allowed. */
const narrowLens = (fov: number): number => Math.min(100, fov * 1.35)
const pose = (eye: [number, number, number], at: [number, number, number], fov: number, narrow: boolean): ApproachPose =>
  ({ eye: world(...eye), at: world(...at), fov: narrow ? narrowLens(fov) : fov })

/** THE MURAL IS READ SQUARE, ONE CERTIFIED STEP INSIDE THE STATION'S OWN EYE:
 * eleven metres hold the whole measurement, eight and a third hold it at a
 * lens a card can stand beside. */
const MURAL_ID = 'picture/last-supper/front'
const MURAL: Field = {
  east: SUPPER_WALL.east + SUPPER_WALL.thickness / 2, north: SUPPER_WALL.north,
  datum: COURT.level + SUPPER_WALL.field.sill + SUPPER_WALL.field.height / 2,
  width: SUPPER_WALL.field.width, height: SUPPER_WALL.field.height,
  eye: COURT.level + 1.62, nearest: 8.37, furthest: { desktop: 8.37, phone: 8.37 },
}

/** The grave's frame in the wing: turned a quarter so its +Z faces east. */
const GRAVE_LEVEL = COURT.level + .035
const graveWorld = (x: number, y: number, z: number): [number, number, number] =>
  [GRAVE_ORIGIN.east + z, GRAVE_ORIGIN.north + x, GRAVE_LEVEL + y]
/** The diagram stands free on its own legs and ledge, so the eye holds the
 * whole standing object, four metres off: east of the lectern that stands
 * between the slab and the frame. */
const DIAGRAM: Field = (() => {
  const [east, north] = graveWorld(GRAVE_FRAME.x, 0, GRAVE_FRAME.z + .1)
  return { east, north, datum: GRAVE_LEVEL + 1.9, width: 3.3, height: 3.8,
    eye: COURT.level + 1.62, nearest: 4.24, furthest: { desktop: 4.24, phone: 4.24 } }
})()

/** Where each object's eye stands, in east, north: every one is a short
 * straight leg from its own station eye that passes no plinth, no upright and
 * no furniture, and every eye stands clear of its object's swept envelope. */
const MACHINE_EYES: Record<Exclude<MachineSlug, 'proportional-compass'>, { station: VinciStationId; east: number; north: number }> = {
  // The court, from the display wall's eye: every leg passes south of the
  // plaque and of the parachute's south-west upright.
  'parachute': { station: 'supper-wall', east: -36.2, north: -28.3 },
  'revolving-crane': { station: 'supper-wall', east: -44.0, north: -26.3 },
  'anemometer': { station: 'supper-wall', east: -42.4, north: -26.9 },
  'inclinometer': { station: 'supper-wall', east: -42.4, north: -26.9 },
  // The hall's west half, from the screw's own station.
  'aerial-screw': { station: 'flight', east: -50.8, north: -48.4 },
  'miter-lock-gates': { station: 'flight', east: -51.2, north: -52.0 },
  'camera-obscura': { station: 'flight', east: -46.4, north: -50.2 },
  'flywheel': { station: 'flight', east: -45.9, north: -49.4 },
  // The aisle's east half, from the workshop's station.
  'multi-barrel-gun': { station: 'works', east: -42.2, north: -47.9 },
  'ball-bearing': { station: 'works', east: -41.9, north: -47.4 },
  'rolling-mill': { station: 'works', east: -45.8, north: -46.3 },
  'lathe': { station: 'works', east: -44.0, north: -45.4 },
  'water-lifting-screw': { station: 'works', east: -47.3, north: -47.8 },
}

function machinePose(slug: keyof typeof MACHINE_EYES, narrow: boolean): ApproachPose {
  const stand = STANDS[slug], { x, y, z } = dossiers[slug].scale_m
  const level = standLevel(stand.ground), eye = MACHINE_EYES[slug]
  // The aim stands at the body's own middle, never higher than a person looks
  // up at a nine metre screw from the aisle.
  const aim = level + stand.plinth + Math.min(y / 2, 2.2)
  const reach = Math.hypot(eye.east - stand.east, eye.north - stand.north)
  const fov = Math.max(35, Math.min(75, 2 * Math.atan(1.2 * Math.max(y, x, z) / 2 / reach) * 180 / Math.PI))
  return pose([eye.east, eye.north, level + 1.62], [stand.east, stand.north, aim], fov, narrow)
}

/** The one station the gallery's cut line is read and walked from. */
const LINE_STATION: VinciStationId = 'line-early'
/** The book lies open on the table under its lamp, read from the chair side.
 *
 * THE TABLE STANDS CENTRED ON ITS OWN PANEL, and the panel is what fixes the
 * place. The panel cannot grow and cannot walk north: the hall door beside it
 * is how a visitor reaches the gallery, so it keeps its length and its
 * clearance from that door's reveal, and the table's own north follows from
 * them. The table's top is 2.8 m along the wall against the panel's 3.25, so
 * nothing of it overhangs the brown at either end.
 */
export const VINCI_READING_TABLE = (() => {
  const panelWidthM = 3.25, doorClearM = .95
  return { east: -37.72, north: OPENING.hallToGallery.north[0] - doorClearM - panelWidthM / 2,
    top: FLOOR + .755, panelWidthM }
})()
const READING_TABLE = VINCI_READING_TABLE
/** The flight plaque's stone, and the standing distance its lines read at. */
export const VINCI_PLAQUE_AT = { east: -40.2, north: -25.5 }
const PLAQUE = VINCI_PLAQUE_AT

interface Placed { record: VinciExhibitRecord; pose(narrow: boolean): ApproachPose }

function otherKinds(): Placed[] {
  const placed: Placed[] = []
  const add = (id: string, kind: VinciExhibitKind, station: VinciStationId, at: (narrow: boolean) => ApproachPose,
    workId: string | null = null, face: 'front' | null = null): void => {
    // A pose is solved once per viewport: the registry reads it on every refresh.
    const solved: Partial<Record<'wide' | 'narrow', ApproachPose>> = {}
    const pose = (narrow: boolean): ApproachPose => {
      const key = narrow ? 'narrow' : 'wide', held = solved[key] ??= at(narrow)
      return { eye: held.eye.clone(), at: held.at.clone(), fov: held.fov }
    }
    placed.push({ record: { id, kind, station, workId, face }, pose })
  }
  add(MURAL_ID, 'mural', 'supper-wall', narrow => eastFacingApproach(MURAL, narrow), 'last-supper', 'front')
  for (const slug of MACHINE_SLUGS) {
    if (slug === 'proportional-compass') continue
    add(`machine/${slug}`, 'machine', MACHINE_EYES[slug].station, narrow => machinePose(slug, narrow))
  }
  // The plaque is read square, from the side it turns to the display wall's eye.
  add('plaque/flight-quote', 'place', 'supper-wall', narrow =>
    pose([-38.17, -26.79, COURT.level + 1.62], [PLAQUE.east, PLAQUE.north, COURT.level + .95], 50, narrow))
  // The grave: the slab from three and a half metres, the diagram square to
  // its frame, and the painting on the backdrop past the diagram's south end,
  // where the frame no longer stands between the eye and the painting.
  add('grave', 'place', 'grave', narrow =>
    pose([-51.5, -26.9, COURT.level + 1.62], graveWorld(GRAVE_SLAB.x, GRAVE_SLAB.y, GRAVE_SLAB.z), 55, narrow))
  add('grave-diagram', 'place', 'grave', narrow => eastFacingApproach(DIAGRAM, narrow))
  add('picture/deathbed-painting/front', 'picture', 'grave', narrow =>
    pose([-56.9, -27.9, COURT.level + 1.62], graveWorld(GRAVE_DEATHBED.centreX, GRAVE_DEATHBED.centreY, GRAVE_DEATHBED.faceZ + .098), 44, narrow),
  'deathbed-painting', 'front')
  // THE EYE COMES OVER THE PAGE. At 0.97 m out and 0.83 m above the leaf the
  // look was 41 degrees and the page foreshortened to 0.65 of its own height.
  // Nearer and higher over it, 0.60 m out and 0.71 m up, is 50 degrees and
  // 0.77, which is the difference between reading a page and seeing one.
  add('codex/paris-B', 'manuscript', 'reading-table', narrow =>
    pose([READING_TABLE.east + .60, READING_TABLE.north, READING_TABLE.top + .741], [READING_TABLE.east, READING_TABLE.north, READING_TABLE.top + .031], 44, narrow))
  // A DATE IS READ FROM ITS SOUTH, where its numerals stand upright, looking
  // down at the socket from a stride and a half.
  for (const stud of lineCutStuds(LINE_ORIGIN)) {
    // THE DATE AND ITS NUMERALS STAND CLEAR OF THE CARD: the year is cut east
    // of its socket, so the eye stands east of both and they read on the open
    // side of the frame.
    const east = stud.east + .75
    // The last date lies close to the gallery's south cross wall, so its eye
    // stands as far back as the wall leaves and looks more steeply down.
    const back = Math.min(1.5, stud.north - (FACE.southStripNorth + .6))
    // THE GALLERY READS ITS WHOLE LINE FROM ONE STATION. The sections the
    // bench cut its excerpts in are still how the floor lays the twelve
    // sockets, so the data keeps them and every approach leaves from the one
    // station that now stands at the head of the line.
    add(`stud/${stud.id}`, 'stud', LINE_STATION, narrow =>
      pose([east, stud.north - back, FLOOR + 1.62], [east, stud.north, FLOOR + .01], 50, narrow))
  }
  return placed
}
let others: Placed[] | undefined
const otherPlaced = (): Placed[] => (others ??= otherKinds())

/** EVERY EXHIBIT A VISITOR CAN BE WALKED TO: the picture room's hang, whose
 * wall placement is the same list the room builds its frames from, then the
 * mural, the machines, the plaque, the grave's three, the book and the twelve
 * dates cut into the gallery floor. */
export function vinciExhibitRecords(): readonly VinciExhibitRecord[] {
  return [
    ...hangPlacements().map(field => ({ id: exhibitId(field.id, field.face), kind: 'picture' as const,
      station: 'picture-room' as VinciStationId, workId: field.id, face: field.face })),
    ...otherPlaced().map(entry => entry.record),
  ]
}

/** The viewing pose of one exhibit, or undefined when no person is stood in
 * front of it. */
export function vinciApproachPose(id: string, narrow: boolean): ApproachPose | undefined {
  const field = placement(id)
  if (field) return pictureApproach(field, narrow).pose
  return otherPlaced().find(entry => entry.record.id === id)?.pose(narrow)
}

/** The station an exhibit's certified leg leaves from. */
export function vinciApproachStation(id: string): VinciStationId | undefined {
  return vinciExhibitRecords().find(record => record.id === id)?.station
}

/** The distance from the viewing eye to the plate's own centre, which is what
 * the picture module's near rule measures. The hang's plates only: the room's
 * one full slot belongs to the picture room. */
export function vinciApproachPlateMetres(id: string, narrow: boolean): number | undefined {
  const field = placement(id)
  if (!field) return undefined
  return pictureApproach(field, narrow).pose.eye.distanceTo(new Vector3(field.east, field.datum, -field.north))
}

let reach = 0
/** THE ROOM'S ONE FULL SLOT HAS TO REACH THE EYE THE MODULE STANDS. The
 * furthest certified viewing eye, over every hang plate and both viewports,
 * so the plate a visitor has walked up to raises at whatever distance the
 * band solver settled on and nowhere else. */
export function vinciApproachReachMetres(): number {
  if (reach) return reach
  for (const field of hangPlacements()) for (const narrow of [false, true]) {
    reach = Math.max(reach, vinciApproachPlateMetres(exhibitId(field.id, field.face), narrow) ?? 0)
  }
  return reach
}

/** The identity the registry joins a mounted plate to. */
export const vinciPlateExhibitId = exhibitId
/** THE FLOOR ITSELF, as one thing a press can reach: the cut line's field,
 * which is read from the station that stands at its head and so carries no
 * approach of its own. */
export const LINE_FLOOR_PICK = 'line/floor'

/** The date a stud exhibit names, by its place in the whole line. */
export const vinciStudIndex = (id: string): number => LINE_STUDS.findIndex(stud => `stud/${stud.id}` === id)
