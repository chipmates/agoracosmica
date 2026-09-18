import { collectionAccessLayout, collectionAccessPoint } from './collection-access'
import { collectionLayout } from './collection'
import { COURT, FACE, FLOOR, OPENING } from './collection/layout'
import { roadGradeProvenance } from './road-grade'

/** THE RAIL'S OWN WAYPOINTS, in east, north, height, with the height already
 * at the eye. A station is a composition; the way between two of them is a
 * route through a real building, and these are the turns it takes. Every
 * number is either a registered one (the gate crossing, the stair, the
 * terrace access, the built openings of the insertion) or an authored turn on
 * open ground, marked as such. `rail-certify.mjs` proves the chain below
 * against the mounted geometry and writes the clearance certificate the
 * runtime reads.
 */
export type RailWaypoint = readonly [east: number, north: number, height: number]

/** Standing eye height above whatever the body is walking on. */
export const railEyeHeightM = 1.65
const A = collectionAccessLayout, S = collectionLayout.stair
/** The two walking levels of the collection ground: the rooms' finished floor
 * and the apron, which the court outside shares with it. */
const INSIDE = FLOOR + railEyeHeightM, OUTSIDE = collectionLayout.apron.height + railEyeHeightM

/** Through the gallery under the east range, from the street to the court.
 * The crossing is the registered intersection of the mapped street with the
 * gate-steps axis; the four turns after it follow the passage and the steps.
 */
export const railGateWaypoints: readonly RailWaypoint[] = [
  [roadGradeProvenance.crossing[0], roadGradeProvenance.crossing[1], 2.65],
  [20.6107, -15.9474, 2.48],
  [18.2624, -17.4724, 2.48],
  [15.9141, -18.9974, 1.65],
  [13.5658, -20.5224, 1.65],
]

/** Out of the court and down the modern access stair to the terrace. The four
 * access points are the middles of its two landings and the two ends of its
 * run. One turn on the open terrace is authored: it keeps the walk off the
 * bank. */
const landing = A.run / 2 + A.landingDepth / 2
export const railAccessWaypoints: readonly RailWaypoint[] = [
  [...collectionAccessPoint(landing), A.upper + railEyeHeightM],
  [...collectionAccessPoint(A.run / 2), A.upper + railEyeHeightM],
  [...collectionAccessPoint(-A.run / 2), A.lower + railEyeHeightM],
  [...collectionAccessPoint(-landing), A.lower + railEyeHeightM],
  [-18, -14.5, A.lower + railEyeHeightM],
] as RailWaypoint[]

/** Along the terrace to the head of the collection stair, down its
 * twenty-seven treads and out onto the apron. The stair points are the
 * registered stair's own head and foot. */
export const railCollectionStairWaypoints: readonly RailWaypoint[] = [
  [S.east, S.north + .5, A.lower + railEyeHeightM],
  [S.east, S.north, A.lower + railEyeHeightM],
  [S.east, S.south, collectionLayout.floor + railEyeHeightM],
  [S.east, collectionLayout.apron.north - .4, OUTSIDE],
] as RailWaypoint[]

/** The one descent the 1f window walked, kept as the record of it. */
export const railTerraceWaypoints: readonly RailWaypoint[] = [
  ...railAccessWaypoints, ...railCollectionStairWaypoints,
]

/** THE DOORS OF THE INSERTION. The two interior doors are the ends of the
 * built partitions, so their middles are the openings' own; the entrance is
 * the recessed north bay of the east elevation, under the canopy.
 *
 * The picture room's WEST door is not one of them. Its opening is 1.16 m
 * between the built partitions, and its two door linings leave 0.74 m of it
 * clear at eye height: 0.37 m at the widest line through it, against the
 * 0.41 to 0.45 m near envelope this rail is proved with. The walk to the
 * machines therefore keeps to the gallery's door, and the west station's card
 * names that door as the building's, not as the walk's.
 */
const ENTRANCE_NORTH = -35
const PICTURE_TO_GALLERY = (OPENING.pictureToGallery.east[0] + OPENING.pictureToGallery.east[1]) / 2
const HALL_TO_GALLERY = (OPENING.hallToGallery.north[0] + OPENING.hallToGallery.north[1]) / 2
const ENTRANCE_IN: RailWaypoint = [FACE.glazingEast - 1.6, ENTRANCE_NORTH, INSIDE]
const ENTRANCE_OUT: RailWaypoint = [FACE.glazingEast + 1.2, ENTRANCE_NORTH, OUTSIDE]
/** Two authored turns on the open apron, north of the water channel and
 * clear of the pavilion, which is how the court is reached on foot. */
const APRON_CORNER: RailWaypoint = [S.east, collectionLayout.apron.north - .4, OUTSIDE]
const APRON_NORTH: RailWaypoint = [COURT.east - 1.4, collectionLayout.apron.north - .5, OUTSIDE]
const COURT_EAST: RailWaypoint = [COURT.east - 1.4, COURT.south + 2.6, COURT.level + railEyeHeightM]
/** The lane along the court's north side: the only way west that passes the
 * wall that is not here (its north end) and the machines standing in the
 * court, which a visitor walks between, not through. It runs a metre and a
 * quarter off the parapet, because the parachute's suspension cords reach
 * walking height two and a half metres from its axis. */
const COURT_LANE_EAST: RailWaypoint = [COURT.east - 3, -20.6, COURT.level + railEyeHeightM]
const COURT_LANE_WEST: RailWaypoint = [-49.5, -20.6, COURT.level + railEyeHeightM]

/** Where a station stands. The house keeps its three sides; the collection
 * ground is its rooms, because a room is entered through its door. */
export type RailSide = 'street' | 'court' | 'terrace' | 'apron'
  | 'picture-room' | 'long-gallery' | 'mechanism-hall' | 'exhibit-court' | 'grave-court'

export function railSide(stationId: string): RailSide {
  if (stationId === 'arrival') return 'street'
  if (['courtyard', 'hall', 'oratory', 'study', 'chamber'].includes(stationId)) return 'court'
  // The garden eye stands on the apron itself (apron.height + the eye), so it
  // is routed from there: routed as a terrace station it climbed to the stair
  // head and came back down the same stair to reach its own ground.
  if (stationId === 'garden') return 'apron'
  if (stationId === 'picture-room' || stationId === 'picture-room-west') return 'picture-room'
  if (['line-early', 'reading-table', 'body'].includes(stationId)) return 'long-gallery'
  if (['flight', 'works'].includes(stationId)) return 'mechanism-hall'
  if (stationId === 'supper-wall') return 'exhibit-court'
  if (stationId === 'grave') return 'grave-court'
  return 'terrace'
}

/** The links of the walk, each written one way and walked either way. A route
 * is the shortest chain of them, so a visitor gets from any station to any
 * other through the doors and never through a wall. */
const LINKS: readonly { from: RailSide; to: RailSide; via: readonly RailWaypoint[] }[] = [
  { from: 'street', to: 'court', via: railGateWaypoints },
  { from: 'court', to: 'terrace', via: railAccessWaypoints },
  { from: 'terrace', to: 'apron', via: railCollectionStairWaypoints },
  { from: 'apron', to: 'picture-room', via: [APRON_CORNER, ENTRANCE_OUT, ENTRANCE_IN] },
  { from: 'apron', to: 'exhibit-court', via: [APRON_CORNER, APRON_NORTH, COURT_EAST] },
  { from: 'exhibit-court', to: 'grave-court', via: [COURT_EAST, COURT_LANE_EAST, COURT_LANE_WEST] },
  { from: 'picture-room', to: 'long-gallery',
    via: [[PICTURE_TO_GALLERY, FACE.pictureWallNorth + 1.4, INSIDE], [PICTURE_TO_GALLERY, FACE.pictureWallSouth - 1.4, INSIDE]] },
  // The gallery's side of the hall door stands clear of the alcove the
  // reading table brings its own back wall for: at a metre and a half off the
  // partition the walk went by that wall at arm's length.
  { from: 'long-gallery', to: 'mechanism-hall',
    via: [[FACE.hallPartitionEast + 3.1, HALL_TO_GALLERY, INSIDE], [FACE.hallPartitionEast + 1.1, HALL_TO_GALLERY, INSIDE],
      [FACE.hallPartitionWest - 1.3, HALL_TO_GALLERY, INSIDE]] },
]

/** The turns between two stations, in walking order. */
export function railWaypointsBetween(from: RailSide, to: RailSide): RailWaypoint[] {
  if (from === to) return []
  const queue: RailSide[][] = [[from]]
  const seen = new Set<RailSide>([from])
  while (queue.length) {
    const route = queue.shift()!
    const here = route[route.length - 1]!
    if (here === to) {
      const chain: RailWaypoint[] = []
      for (let i = 1; i < route.length; i++) {
        const a = route[i - 1]!, b = route[i]!
        const link = LINKS.find(value => (value.from === a && value.to === b) || (value.from === b && value.to === a))!
        for (const point of link.from === a ? link.via : [...link.via].reverse()) {
          // Two links meet AT a turn, so the junction is written in both and
          // reached once. A repeated point is a corner with no length in it.
          const last = chain[chain.length - 1]
          if (last && Math.hypot(point[0] - last[0], point[1] - last[1], point[2] - last[2]) < 1e-6) continue
          chain.push(point)
        }
      }
      return chain
    }
    for (const link of LINKS) {
      for (const [a, b] of [[link.from, link.to], [link.to, link.from]] as const) {
        if (a !== here || seen.has(b)) continue
        seen.add(b)
        queue.push([...route, b])
      }
    }
  }
  throw new Error(`No way from ${from} to ${to}`)
}
