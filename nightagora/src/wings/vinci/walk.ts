/** THE ORDER THE WING IS WALKED IN.
 *
 * Two orders stand here. The LIFE, from the birth to the grave, which is the
 * order `story.ts` carries in its `order` field and the order the film is
 * rendered in, is the walk; the one the rooms were built in, the order
 * `content.ts` declares its stations in, is asked for by the address
 * (`?order=room`). A visitor walks what the film shows.
 *
 * A STOP OF THE WALK IS NOT ALWAYS A STATION. The life stands once at a place
 * that is a stop of a certified wall and not a station of its own: the eye is
 * the wall's own certified vertex, so the walk to it and away from it are
 * sub-paths of a proof the certificate already holds.
 *
 * A CUT IS A CHAPTER BOUNDARY, not a leg. Where the story cuts, the walk does
 * not cross the site: the picture dips to the chapter's title and the visitor
 * arrives at the next stop. The certified leg under each cut still exists.
 */
import type { Pose } from './rail'
import { stationPose } from './rail'
import { vinciContent, type VinciStationId, type VinciText } from './content'
import { vinciStory } from './story'
import { vinciApproachPose } from './collection/approaches'
import { getWork } from './pictures/register'
import { hangPlacements } from './collection/hang'
import { VINCI_PICTURE_WALL } from './collection/wall'
import { world } from './site'
import { gaitPace } from './gait'
import { VINCI_HOUSE_DOOR, VINCI_VALVE, vinciWalkPoseOf, type VinciWalkPoseId } from './walk-poses'
import { VINCI_LISA_STOP, VINCI_OFF_THE_WALK } from './walk-places'

/** The address that names an order, and the values it takes. */
export const VINCI_ORDER_PARAM = 'order', VINCI_LIFE_ORDER = 'life', VINCI_ROOM_ORDER = 'room'

/** The life's order unless the address asks for the rooms'. */
export function vinciLifeOrderAsked(): boolean {
  try { return new URLSearchParams(location.search).get(VINCI_ORDER_PARAM) !== VINCI_ROOM_ORDER } catch { return true }
}

export interface VinciWalkStop {
  /** The walk's own id: a station's id, or the story's id for a wall stop. */
  id: string
  /** The station whose room, card and sources this stop stands in. */
  station: VinciStationId
  /** A stop that is not a station of its own carries the name of the work it
   * stands at, so the bar names a place and not the room twice. */
  name?: VinciText
  /** The certified wall a stop stands on, and which of its stops it is. */
  wall?: string
  exhibit?: string
  /** A stop that stands at a pose of its own (`walk-poses.ts`), walked to and
   * from as a station is, and the exhibit that opens where it stands. */
  place?: VinciWalkPoseId
  opens?: string
}

export interface VinciWalkCut {
  /** the two stops the cut stands between, by their walk ids */
  from: string
  to: string
  /** the chapter the visitor is entering, as the story writes it */
  title: VinciText
}

export interface VinciWalk {
  stops: readonly VinciWalkStop[]
  cuts: readonly VinciWalkCut[]
}

/** The one stop of the life that is a wall stop and not a station: the
 * portrait he kept, at its own place in the hang. */
const LISA_STOP = VINCI_LISA_STOP, LISA_WORK = 'mona-lisa', LISA_EXHIBIT = `picture/${LISA_WORK}/front`

/** The work's own title, from the register that already displays it. */
const lisaName = (): VinciText => {
  const work = getWork(LISA_WORK)
  return { en: work.title_en, de: work.title_de }
}

const built = new Set(vinciContent.map(station => station.id as string))

/** THE HEART VALVE, a stop of its own after the body wall's grid, in both
 * orders: the one button that goes on reads the sheets first and then the
 * valve. The sheet it stands at keeps its own title in the row. */
const VALVE_STOP: VinciWalkStop = { id: VINCI_VALVE.place, station: VINCI_VALVE.station, name: VINCI_VALVE.name, place: VINCI_VALVE.place, opens: VINCI_VALVE.exhibit }
const withValve = (stops: VinciWalkStop[]): VinciWalkStop[] => {
  const at = stops.findIndex(stop => stop.id === VINCI_VALVE.station)
  return at < 0 ? stops : [...stops.slice(0, at + 1), VALVE_STOP, ...stops.slice(at + 1)]
}

/** The order the rooms were built in, one stop per station. */
const roomOrder = (): VinciWalkStop[] =>
  withValve(vinciContent.map(station => ({ id: station.id, station: station.id })))

/** The life's own order, from the story layer. A story stop the wing does not
 * build is left out rather than breaking the walk: the story is re-imported
 * from its card and may name a place before the wing stands one. A station
 * the walk no longer stands at keeps its words and leaves the walk. */
function lifeOrder(): VinciWalk {
  const told = [...vinciStory].sort((a, b) => a.order - b.order)
  const stops: VinciWalkStop[] = []
  const cuts: VinciWalkCut[] = []
  let waiting: VinciText | null = null
  for (const stop of told) {
    if (stop.kind === 'cut') { waiting = stop.chapter; continue }
    const here: VinciWalkStop | null = stop.id === LISA_STOP
      ? { id: LISA_STOP, station: 'picture-room', name: lisaName(), wall: VINCI_PICTURE_WALL, exhibit: LISA_EXHIBIT }
      : built.has(stop.id) && !VINCI_OFF_THE_WALK.has(stop.id) ? { id: stop.id, station: stop.id as VinciStationId } : null
    if (!here) continue
    if (waiting && stops.length) cuts.push({ from: stops[stops.length - 1]!.id, to: here.id, title: waiting })
    waiting = null
    stops.push(here)
  }
  return { stops: withValve(stops), cuts }
}

export function vinciWalk(life: boolean): VinciWalk {
  return life ? lifeOrder() : { stops: roomOrder(), cuts: [] }
}

/** THE PORTRAIT HE KEPT, COMPOSED FROM THE EYE THE CERTIFICATE ALREADY HOLDS.
 * The eye is the exhibit's own certified vertex of the wall, unmoved, so the
 * walk in and out of this stop is a sub-path of the wall's proof. What is
 * composed here is where that eye looks and how wide: the words stand in a
 * box at the lower left of the frame, so the portrait is carried into the
 * clear half and the wall it hangs on is read with it.
 */
/** The desktop keeps the portrait in the right half of the frame, with its
 * three neighbours whole at the left: turned a little further east, the large
 * cartoon beyond them stood cut at the left edge.
 * THE DESKTOP LOOKS LEVEL. From an eye 1.1 m off the wall any tilt keystones
 * the frame, so the aim stands at the eye's own height and the lens opens
 * until the frame's foot clears the picture's edge. Its near rectangle stays
 * inside the radius the hang's wall is proved with (78 degrees and under).
 * THE PHONE LOOKS DOWN TWELVE DEGREES, NOT NINETEEN. The sheet takes the
 * stage's lower third, so the frame's foot stands just above it; the lens
 * opens until the whole frame stands inside both edges, and the top of the
 * frame is a sixth wider than its foot instead of a quarter. */
const LISA_SWING_M = { desktop: .469, phone: 0 }, LISA_RISE_M = { desktop: null, phone: .163 }
const LISA_FOV = { desktop: 71, phone: 94 }
export function vinciLisaPose(narrow: boolean): Pose {
  const viewport = narrow ? 'phone' : 'desktop'
  const eye = vinciApproachPose(LISA_EXHIBIT, narrow)?.eye
  const field = hangPlacements().find(work => work.id === LISA_WORK && work.face === 'front')
  if (!eye || !field) return stationPose('picture-room', narrow)
  // The wall runs east to west and the eye faces it, so the earlier works
  // stand to the left of the frame: looking east of the portrait carries the
  // portrait to the right, clear of the words, with its neighbour beside it.
  const rise = LISA_RISE_M[viewport]
  const at = world(field.east + LISA_SWING_M[viewport], field.north, rise === null ? eye.y : field.datum - rise)
  return { eye: eye.clone(), at, fov: LISA_FOV[viewport] }
}

/** The pose a stop of the walk stands at. */
export function vinciWalkPose(stop: VinciWalkStop, narrow: boolean): Pose {
  if (stop.place) return vinciWalkPoseOf(stop.place, narrow)
  return stop.id === LISA_STOP ? vinciLisaPose(narrow) : stationPose(stop.station, narrow)
}

/** THE DOOR A WALK BETWEEN TWO STATIONS CROSSES, if it crosses one: into the
 * hall from anywhere else, or out of it to anywhere else. A walk in goes to
 * the door's inward pose and dips into the room; a walk out dips to the
 * outward pose and walks on from there. */
export function vinciDoorBetween(from: VinciStationId | string | undefined, to: VinciStationId | string):
  { door: typeof VINCI_HOUSE_DOOR; way: 'in' | 'out' } | undefined {
  const room = VINCI_HOUSE_DOOR.station
  if (to === room && from !== room) return { door: VINCI_HOUSE_DOOR, way: 'in' }
  if (from === room && to !== room) return { door: VINCI_HOUSE_DOOR, way: 'out' }
  return undefined
}

/** HOW LONG A CHAPTER'S TITLE STANDS, when it is not waiting for a press.
 * The law counts a reading from the characters at the pace the visitor set,
 * and gives it two seconds over that (STORY-SYSTEM §10). */
const READING_CHARACTERS_PER_SECOND = { stroll: 8, walk: 10, brisk: 13 } as const
const READING_OVER_SECONDS = 2
export function vinciReadingSeconds(characters: number): number {
  return READING_OVER_SECONDS + Math.max(0, characters) / READING_CHARACTERS_PER_SECOND[gaitPace()]
}
