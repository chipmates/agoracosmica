import { collectionAccessLayout, collectionAccessPoint } from './collection-access'
import { collectionLayout } from './collection'
import { COURT, FACE, FLOOR, OPENING, SUPPER_WALL, doorClearEastWest } from './collection/layout'
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

/** THE DOORS OF THE INSERTION. The three interior doors are the ends of the
 * built partitions, so the line through each one is the middle of what its
 * reveals leave clear; the entrance is the recessed north bay of the east
 * elevation, under the canopy.
 *
 * The picture room's WEST door carries the walk into the machines. Its
 * reveals leave 1.06 m clear at eye height, so the widest line through it has
 * 0.53 m on either side, against the 0.41 to 0.45 m near envelope this rail
 * is proved with.
 */
const ENTRANCE_NORTH = -35
const clearMiddle = (opening: { east: readonly number[] }): number => {
  const [west, east] = doorClearEastWest(opening)
  return (west + east) / 2
}
const PICTURE_TO_HALL = clearMiddle(OPENING.pictureToHall)
const PICTURE_TO_GALLERY = (OPENING.pictureToGallery.east[0] + OPENING.pictureToGallery.east[1]) / 2
const HALL_TO_GALLERY = (OPENING.hallToGallery.north[0] + OPENING.hallToGallery.north[1]) / 2
const ENTRANCE_IN: RailWaypoint = [FACE.glazingEast - 1.6, ENTRANCE_NORTH, INSIDE]
const ENTRANCE_OUT: RailWaypoint = [FACE.glazingEast + 1.2, ENTRANCE_NORTH, OUTSIDE]
/** Two authored turns on the open apron, north of the water channel and
 * clear of the pavilion, which is how the court is reached on foot. */
const APRON_CORNER: RailWaypoint = [S.east, collectionLayout.apron.north - .4, OUTSIDE]
const APRON_NORTH: RailWaypoint = [COURT.east - 1.4, collectionLayout.apron.north - .5, OUTSIDE]
/** THE COURT IS ENTERED ON THE DISPLAY WALL'S OWN LINE. Standing 2.6 m into
 * the court put the turn onto the wall at 119 degrees over the last stride,
 * with the eye swinging round as it arrived. On the wall's line the walk
 * turns once, west, and the measurement grows straight ahead. */
const COURT_EAST: RailWaypoint = [COURT.east - 1.4, SUPPER_WALL.north, COURT.level + railEyeHeightM]
/** The lane along the court's north side: the only way west that passes the
 * wall that is not here (its north end) and the machines standing in the
 * court, which a visitor walks between, not through. It runs a metre and a
 * quarter off the parapet, because the parachute's suspension cords reach
 * walking height two and a half metres from its axis. */
/** The lane's own south end, out from under the parachute: its south-east
 * upright stands a metre north-east of the display wall's eye on the line
 * the lane would otherwise run, so the walk leaves the station east of it
 * and comes back onto the lane north of the cloth. */
const COURT_LANE_SOUTH: RailWaypoint = [-32.4, -26, COURT.level + railEyeHeightM]
const COURT_LANE_EAST: RailWaypoint = [COURT.east - 3, -20.6, COURT.level + railEyeHeightM]
const COURT_LANE_WEST: RailWaypoint = [-49.5, -20.6, COURT.level + railEyeHeightM]

/** Where a station stands. The house keeps its three sides; the collection
 * ground is its rooms, because a room is entered through its door. */
export type RailSide = 'street' | 'court' | 'south-lawn' | 'great-hall' | 'terrace' | 'apron'
  | 'picture-room' | 'long-gallery' | 'mechanism-hall' | 'exhibit-court' | 'grave-court'

export function railSide(stationId: string): RailSide {
  if (stationId === 'arrival') return 'street'
  // The hall's eye stands in the great hall's own door, one storey above the
  // court: it is reached over the threshold steps and through the passage.
  if (stationId === 'hall') return 'great-hall'
  if (['courtyard', 'oratory', 'study'].includes(stationId)) return 'court'
  if (stationId === 'chamber') return 'south-lawn'
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

/** A ROOM THE WALK ENTERS TO SEE, NEVER TO CROSS. The machine hall has two
 * doors now, and a walk from the picture room to the gallery through it is
 * ten metres shorter and passes between fourteen machines: the aisle is a
 * place to stand, not a corridor, and the envelope a visitor carries does
 * not clear their arms. A route uses this room only when it begins or ends
 * in it. */
const NOT_A_CORRIDOR: readonly RailSide[] = ['mechanism-hall']

/** The links of the walk, each written one way and walked either way. A route
 * is the shortest chain of them, so a visitor gets from any station to any
 * other through the doors and never through a wall. */
/** THE OPEN COURT, AND THE FOOT OF THE THRESHOLD STEPS. The first is a turn
 * in the middle of the court, clear of the gate's open leaf, which every walk
 * to the house door leaves from; the second is the foot of the five treads,
 * on the door's own axis, so the eye goes up them and not across their cheek.
 */
/** Two authored turns on the machine hall's open floor: the north aisle east
 * of the sail's lowest reach, and the gap between the two screws. */
const HALL_NORTH_AISLE: RailWaypoint = [-52.6, -43.4, INSIDE]
const BETWEEN_THE_SCREWS: RailWaypoint = [-51.2, -47.3, INSIDE]
const COURT_OPEN: RailWaypoint = [8, -21, railEyeHeightM]
const THRESHOLD_FOOT: RailWaypoint = [4.834, -14.329, railEyeHeightM]
/** THE HOUSE DOOR AND THE ENFILADE. The entrance's best clear line runs 0.47 m
 * off both jambs, so the walk crosses the landing onto it and goes straight in;
 * it turns where that line meets the axis of the passage's side door, the
 * service passage and the hall's door, and walks down the axis to the hall. */
/** THE LAWN UNDER THE COURT'S SOUTH-WEST CORNER, where the chamber is seen
 * from. The court's south edge is a retaining wall a metre and a half high
 * west of the study's eye, so the walk leaves the court where the edge is a
 * step, beside that eye, and turns west along the lawn. */
const LAWN_FOOT: RailWaypoint = [-.3, -34.4, -.6 + railEyeHeightM]
const HOUSE_FLOOR_EYE = .8 + railEyeHeightM
const HOUSE_LANDING: RailWaypoint = [3.0682, -13.0604, HOUSE_FLOOR_EYE]
const ENFILADE_TURN: RailWaypoint = [.0049, -8.3434, HOUSE_FLOOR_EYE]

const LINKS: readonly { from: RailSide; to: RailSide; via: readonly RailWaypoint[] }[] = [
  { from: 'street', to: 'court', via: railGateWaypoints },
  { from: 'court', to: 'great-hall', via: [COURT_OPEN, THRESHOLD_FOOT, HOUSE_LANDING, ENFILADE_TURN] },
  { from: 'court', to: 'terrace', via: railAccessWaypoints },
  { from: 'court', to: 'south-lawn', via: [LAWN_FOOT] },
  { from: 'terrace', to: 'apron', via: railCollectionStairWaypoints },
  { from: 'apron', to: 'picture-room', via: [APRON_CORNER, ENTRANCE_OUT, ENTRANCE_IN] },
  { from: 'apron', to: 'exhibit-court', via: [APRON_CORNER, APRON_NORTH, COURT_EAST] },
  // The lane leaves the display wall's eye due north, so a walk to the grave
  // begins by turning up it and never by stepping back east first.
  { from: 'exhibit-court', to: 'grave-court', via: [COURT_LANE_SOUTH, COURT_LANE_EAST, COURT_LANE_WEST] },
  { from: 'picture-room', to: 'long-gallery',
    via: [[PICTURE_TO_GALLERY, FACE.pictureWallNorth + 1.4, INSIDE], [PICTURE_TO_GALLERY, FACE.pictureWallSouth - 1.4, INSIDE]] },
  // The picture room's west door. The hall's side of it stands north of the
  // machine bay, so the walk leaves the door before it meets a plinth, keeps
  // to the north wall past the aerial screw's sail, and turns south between
  // the two screws: the works' eye stands south of the water screw's raised
  // end, and a straight line to it ran through that end's support.
  { from: 'picture-room', to: 'mechanism-hall',
    via: [[PICTURE_TO_HALL, FACE.pictureWallNorth + 1.4, INSIDE], [PICTURE_TO_HALL, FACE.pictureWallSouth - 1, INSIDE],
      HALL_NORTH_AISLE, BETWEEN_THE_SCREWS] },
  // The gallery's side of the hall door stands on the line the reading
  // table's eye stands on, two thirds of a metre off the reading room's front,
  // so the walk from that eye to the door runs straight past the room.
  { from: 'long-gallery', to: 'mechanism-hall',
    via: [[FACE.hallPartitionEast + 3.42, HALL_TO_GALLERY, INSIDE], [FACE.hallPartitionEast + 1.1, HALL_TO_GALLERY, INSIDE],
      [FACE.hallPartitionWest - 1.3, HALL_TO_GALLERY, INSIDE]] },
]

/** The turns of one chain of links, in walking order. */
function chainOf(route: readonly RailSide[]): RailWaypoint[] {
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

/** THE WAY BETWEEN TWO STATIONS IS THE SHORTEST ONE, NOT THE ONE WITH THE
 * FEWEST DOORS. Two rooms can be joined by one long link and by two short
 * ones, and counting links alone sent a visitor the length of a hall to save
 * a door. Every simple chain through the sides is measured end to end,
 * including the two station eyes, and the shortest is walked.
 */
export function railWaypointsBetween(from: RailSide, to: RailSide,
  ends?: { from: readonly [number, number]; to: readonly [number, number] }): RailWaypoint[] {
  if (from === to) return []
  const routes: RailSide[][] = []
  const walk = (route: RailSide[]): void => {
    const here = route[route.length - 1]!
    if (here === to) { routes.push(route); return }
    for (const link of LINKS) {
      for (const [a, b] of [[link.from, link.to], [link.to, link.from]] as const) {
        if (a !== here || route.includes(b)) continue
        walk([...route, b])
      }
    }
  }
  walk([from])
  const open = routes.filter(route => !route.slice(1, -1).some(side => NOT_A_CORRIDOR.includes(side)))
  if (open.length) routes.length = 0, routes.push(...open)
  if (!routes.length) throw new Error(`No way from ${from} to ${to}`)
  let best: RailWaypoint[] | undefined, shortest = Infinity
  for (const route of routes) {
    const chain = chainOf(route)
    const plan: (readonly [number, number])[] = [...(ends ? [ends.from] : []), ...chain.map(point => [point[0], point[1]] as const), ...(ends ? [ends.to] : [])]
    let length = 0
    for (let i = 1; i < plan.length; i++) length += Math.hypot(plan[i]![0] - plan[i - 1]![0], plan[i]![1] - plan[i - 1]![1])
    // Without the two eyes a chain is judged by its own turns alone, which
    // still separates a way through one room from a way through three.
    const cost = ends ? length : route.length * 1e4 + length
    if (cost < shortest) { shortest = cost; best = chain }
  }
  return best!
}
