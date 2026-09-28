/** THE WALK'S PLACES THAT ARE NOT STATIONS, as names only: the film player
 * reads them without the rail, and `walk-poses.ts` stands a pose at each.
 */
import type { VinciStationId, VinciText } from './content'

export type VinciWalkPoseId = 'hall-door-in' | 'hall-door-out' | 'body-valve' | 'stair-head'
export const VINCI_WALK_POSE_IDS: readonly VinciWalkPoseId[] = ['hall-door-in', 'hall-door-out', 'body-valve', 'stair-head']
export const isVinciWalkPose = (id: string | null | undefined): id is VinciWalkPoseId =>
  (VINCI_WALK_POSE_IDS as readonly string[]).includes(id ?? '')

/** THE WALK BEGINS ABOVE THE MUSEUM, at the head of the collection stair,
 * and walks down into the picture room. The place is no stop of the walk:
 * the first stop is the picture room, and this is where its leg leaves from. */
export const VINCI_STAIR_HEAD = 'stair-head' as const

/** THE STATIONS THE LIFE'S WALK DOES NOT STAND AT. The garden apron was the
 * walk's opening; the walk now opens in the picture room, and the garden is
 * kept as a station of the rooms' order only. */
export const VINCI_OFF_THE_WALK: ReadonlySet<string> = new Set(['garden'])
/** The life's one stop on a wall and not a station of its own: the portrait
 * he kept, walked to along the picture wall. */
export const VINCI_LISA_STOP = 'picture-room-lisa'

/** THE DOOR OF THE HOUSE, the room it opens on and its two poses. */
export const VINCI_HOUSE_DOOR = { station: 'hall' as VinciStationId, inward: 'hall-door-in' as const, outward: 'hall-door-out' as const }

/** THE HEART VALVE: its stop, the station whose card it stands in, the sheet
 * it stands at, which opens where the visitor stands, and its name. */
export const VINCI_VALVE = {
  place: 'body-valve' as const, station: 'body' as VinciStationId, exhibit: 'sheet/rcin-919082',
  name: { en: 'The heart valve', de: 'Die Herzklappe' } as VinciText,
}
