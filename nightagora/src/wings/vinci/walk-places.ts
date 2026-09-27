/** THE WALK'S PLACES THAT ARE NOT STATIONS, as names only: the film player
 * reads them without the rail, and `walk-poses.ts` stands a pose at each.
 */
import type { VinciStationId, VinciText } from './content'

export type VinciWalkPoseId = 'hall-door-in' | 'hall-door-out' | 'body-valve'
export const VINCI_WALK_POSE_IDS: readonly VinciWalkPoseId[] = ['hall-door-in', 'hall-door-out', 'body-valve']
export const isVinciWalkPose = (id: string | null | undefined): id is VinciWalkPoseId =>
  (VINCI_WALK_POSE_IDS as readonly string[]).includes(id ?? '')

/** THE DOOR OF THE HOUSE, the room it opens on and its two poses. */
export const VINCI_HOUSE_DOOR = { station: 'hall' as VinciStationId, inward: 'hall-door-in' as const, outward: 'hall-door-out' as const }

/** THE HEART VALVE: its stop, the station whose card it stands in, the sheet
 * it stands at, which opens where the visitor stands, and its name. */
export const VINCI_VALVE = {
  place: 'body-valve' as const, station: 'body' as VinciStationId, exhibit: 'sheet/rcin-919082',
  name: { en: 'The heart valve', de: 'Die Herzklappe' } as VinciText,
}
