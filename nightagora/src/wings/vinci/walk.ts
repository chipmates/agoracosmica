/** THE ORDER THE WING IS WALKED IN.
 *
 * Two orders stand here. The one the rooms were built in, which is the order
 * `content.ts` declares its stations in, and the LIFE, from the birth to the
 * grave, which is the order `story.ts` carries in its `order` field. The life
 * is asked for by the address (`?order=life`) and is off everywhere else, so
 * the wing walks, numbers and opens exactly as before until it is asked for.
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

/** The address that asks for the life's order, and the value it takes. */
export const VINCI_ORDER_PARAM = 'order', VINCI_LIFE_ORDER = 'life'

export function vinciLifeOrderAsked(): boolean {
  try { return new URLSearchParams(location.search).get(VINCI_ORDER_PARAM) === VINCI_LIFE_ORDER } catch { return false }
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
const LISA_STOP = 'picture-room-lisa', LISA_WORK = 'mona-lisa', LISA_EXHIBIT = `picture/${LISA_WORK}/front`

/** The work's own title, from the register that already displays it. */
const lisaName = (): VinciText => {
  const work = getWork(LISA_WORK)
  return { en: work.title_en, de: work.title_de }
}

const built = new Set(vinciContent.map(station => station.id as string))

/** The order the rooms were built in, one stop per station. */
const roomOrder = (): VinciWalkStop[] =>
  vinciContent.map(station => ({ id: station.id, station: station.id }))

/** The life's own order, from the story layer. A story stop the wing does not
 * build is left out rather than breaking the walk: the story is re-imported
 * from its card and may name a place before the wing stands one. */
function lifeOrder(): VinciWalk {
  const told = [...vinciStory].sort((a, b) => a.order - b.order)
  const stops: VinciWalkStop[] = []
  const cuts: VinciWalkCut[] = []
  let waiting: VinciText | null = null
  for (const stop of told) {
    if (stop.kind === 'cut') { waiting = stop.chapter; continue }
    const here: VinciWalkStop | null = stop.id === LISA_STOP
      ? { id: LISA_STOP, station: 'picture-room', name: lisaName(), wall: VINCI_PICTURE_WALL, exhibit: LISA_EXHIBIT }
      : built.has(stop.id) ? { id: stop.id, station: stop.id as VinciStationId } : null
    if (!here) continue
    if (waiting && stops.length) cuts.push({ from: stops[stops.length - 1]!.id, to: here.id, title: waiting })
    waiting = null
    stops.push(here)
  }
  return { stops, cuts }
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
/** Measured against the frozen desktop design's words: at 1440 by 900 the box
 * runs to x 824, and the portrait's own left edge lands at 847. On the phone
 * the card takes the middle band, so the portrait stands above it. */
const LISA_SWING_M = { desktop: .5, phone: 0 }, LISA_RISE_M = { desktop: .06, phone: .3 }
const LISA_FOV = { desktop: 66, phone: 82 }
export function vinciLisaPose(narrow: boolean): Pose {
  const viewport = narrow ? 'phone' : 'desktop'
  const eye = vinciApproachPose(LISA_EXHIBIT, narrow)?.eye
  const field = hangPlacements().find(work => work.id === LISA_WORK && work.face === 'front')
  if (!eye || !field) return stationPose('picture-room', narrow)
  // The wall runs east to west and the eye faces it, so the earlier works
  // stand to the left of the frame: looking east of the portrait carries the
  // portrait to the right, clear of the words, with its neighbour beside it.
  const at = world(field.east + LISA_SWING_M[viewport], field.north, field.datum - LISA_RISE_M[viewport])
  return { eye: eye.clone(), at, fov: LISA_FOV[viewport] }
}

/** The pose a stop of the walk stands at. */
export function vinciWalkPose(stop: VinciWalkStop, narrow: boolean): Pose {
  return stop.id === LISA_STOP ? vinciLisaPose(narrow) : stationPose(stop.station, narrow)
}

/** HOW LONG A CHAPTER'S TITLE STANDS, when it is not waiting for a press.
 * The law counts a reading from the characters at the pace the visitor set,
 * and gives it two seconds over that (STORY-SYSTEM §10). */
const READING_CHARACTERS_PER_SECOND = { stroll: 8, walk: 10, brisk: 13 } as const
const READING_OVER_SECONDS = 2
export function vinciReadingSeconds(characters: number): number {
  return READING_OVER_SECONDS + Math.max(0, characters) / READING_CHARACTERS_PER_SECOND[gaitPace()]
}
