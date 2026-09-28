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
 * upright stands near (-33.4, -26.7), a metre west and 0.7 m south of this
 * turn, so the walk passes east of it and comes back onto the lane north of
 * the cloth. */
const COURT_LANE_SOUTH: RailWaypoint = [-32.4, -26, COURT.level + railEyeHeightM]
/** THE DISPLAY WALL'S EYES LEAVE FOR THE LANE BY ONE TURN. Both stand south
 * and west of where the one eye stood, and a straight walk from either to the
 * lane's south end passed the parachute's south-east upright; this turn
 * stands 1.6 m south of that upright, and from it the lane runs clear. */
const COURT_LANE_START: RailWaypoint = [-33.375, -28.275, COURT.level + railEyeHeightM]
const COURT_LANE_EAST: RailWaypoint = [COURT.east - 3, -20.6, COURT.level + railEyeHeightM]
const COURT_LANE_WEST: RailWaypoint = [-49.5, -20.6, COURT.level + railEyeHeightM]

/** Where a station stands. The house keeps its three sides; the collection
 * ground is its rooms, because a room is entered through its door. */
export type RailSide = 'street' | 'court' | 'south-lawn' | 'great-hall' | 'terrace' | 'apron'
  | 'picture-room' | 'long-gallery' | 'mechanism-hall' | 'exhibit-court' | 'grave-court' | 'house-door' | 'valve-niche'

export function railSide(stationId: string): RailSide {
  if (stationId === 'arrival') return 'street'
  // The walk's own poses (walk-poses.ts): the house door's two stand on the
  // threshold steps, the heart valve's before its niche by the body wall.
  if (stationId === 'hall-door-in' || stationId === 'hall-door-out') return 'house-door'
  if (stationId === 'body-valve') return 'valve-niche'
  // the walk's start stands on the terrace's top landing, over the stair
  if (stationId === 'stair-head') return 'terrace'
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
/** An authored turn on the machine hall's open floor: its south-west bay,
 * two metres off the aerial screw's deck and 1.76 m off the west wall, where
 * the walk turns standing between the hall and the way up to the picture
 * room's door. */
const HALL_WEST_BAY: RailWaypoint = [-59.9, -49.5, INSIDE]
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

/** THE STUDIOLO'S DOORSTEP. The reading table is seen through the studiolo's
 * door from two thirds of a metre off its front; every walk to that eye comes
 * in on the door's axis from here, facing through the door, and every walk
 * from it draws back to here before it turns away. It stands a metre off the
 * eye: a longer pull-back out of the booth read as walking out backward. */
const READING_PORCH: RailWaypoint = [-34.36, -46.125, INSIDE]
/** THE DOORSTEPS OF EYES THAT STAND AGAINST A WALL, on the way in a little
 * back from the eye. A view turned round on the eye itself sweeps that wall
 * from a hand away, so a walk that leaves such an eye facing away draws back
 * to its doorstep and turns there, and one that would arrive facing away
 * turns there and backs in. The hall's eye stands in the hall's own door,
 * half a metre from either reveal (its doorstep is in the room behind,
 * nearly four metres across); the street's eye 0.87 m from the street's
 * wall; the reading table's eye two thirds of a metre off the studiolo. */
const HALL_PORCH: RailWaypoint = [-2.7714, -10.1461, HOUSE_FLOOR_EYE]
const STREET_PORCH: RailWaypoint = [22.799, -15.121, 2.661]
/** THE STEP INTO THE GREAT HALL. A walk away from the hall's eye goes on a
 * metre and a half into the hall along the door's axis, turns there with the
 * room in front of it, and walks back out through the door on that axis: the
 * turn sweeps the hall, never the doorstep's walls a metre off, and nothing
 * is walked backward. The hall's tables stand clear of it by 0.7 m. */
const HALL_INSIDE: RailWaypoint = [-5.5037, -11.9181, HOUSE_FLOOR_EYE]
/** THE TURNS MADE STANDING, in a doorway or where the way to a door turns. A
 * walk stands still where its way turns at one of these and turns there, so
 * the view goes through the door straight and is never swung across its
 * reveals at a walking pace. */
export const railDoorTurns: readonly RailWaypoint[] = [ENFILADE_TURN, READING_PORCH, HALL_WEST_BAY, HALL_INSIDE]
/** The studiolo's doorstep, where the booth is left and entered. */
export const railReadingPorch: RailWaypoint = READING_PORCH
export const railPorchStands: readonly RailWaypoint[] = [HALL_PORCH, STREET_PORCH, READING_PORCH]
/** THE NARROW DOORS A WALK PASSES STRAIGHT THROUGH, at their centres: a door
 * a metre wide holds its reveals in the frame's edges, and a view askew in
 * it holds one of them in the frame. */
export const railDoorways: readonly RailWaypoint[] = [
  // the house door and the passage's side door to the service passage
  [2.298, -12.07, HOUSE_FLOOR_EYE], [-1.04, -9.02, HOUSE_FLOOR_EYE],
  // the great hall's own door, where the hall's eye stands
  [-4.2388, -11.0992, HOUSE_FLOOR_EYE],
  // the picture room's west door and its door to the gallery
  [PICTURE_TO_HALL, (FACE.pictureWallNorth + FACE.pictureWallSouth) / 2, INSIDE],
  [PICTURE_TO_GALLERY, (FACE.pictureWallNorth + FACE.pictureWallSouth) / 2, INSIDE],
]
/** Where a station's walks leave from and arrive on, next to its eye. */
const PORCHES: Readonly<Record<string, RailWaypoint>> = { 'reading-table': READING_PORCH }
/** Where a station's walks go first when they leave, and never come back by. */
const STEPS_OUT: Readonly<Record<string, readonly RailWaypoint[]>> = { hall: [HALL_INSIDE] }
/** Turns a walk between two stations leaves out, by its pair either way. The
 * body wall's walk to the display wall comes round the picture room's corner
 * and crosses the apron to the display wall's eye straight: the step onto
 * the wall's line swung its way twice more under a view already turning.
 * The studiolo's walk to the display wall takes the same corner. */
const SKIPPED: Readonly<Record<string, readonly RailWaypoint[]>> = {
  'body>supper-wall': [APRON_NORTH, COURT_EAST],
  'reading-table>supper-wall': [APRON_NORTH, COURT_EAST],
  'body-valve>supper-wall': [APRON_NORTH, COURT_EAST],
  'line-early>supper-wall': [APRON_NORTH, COURT_EAST],
}
/** Turns one walk makes standing, by its pair in walking order. The body
 * wall's walk to the display wall comes out of the picture room facing its
 * entrance and turns to the display wall on the apron's corner: turning
 * there on the move swung the way under the view four times. */
/** THE GARDEN'S PORCH, at the foot of the collection stair. The garden's eye
 * looks back up at the house and the pavilion's door lies behind it, so a walk
 * in turns round here, standing, and quick: on the move the view was led
 * round each corner of the way in and the walk slowed to let it. */
export const railGardenPorch: RailWaypoint = APRON_CORNER
const PAVILION_STATIONS = ['picture-room', 'picture-room-west', 'line-early', 'reading-table', 'body', 'flight', 'works']
export const railPairTurns: Readonly<Record<string, readonly RailWaypoint[]>> = {
  'body>supper-wall': [APRON_CORNER], 'supper-wall>body': [APRON_CORNER],
  'body-valve>supper-wall': [APRON_CORNER], 'supper-wall>body-valve': [APRON_CORNER],
  ...Object.fromEntries(PAVILION_STATIONS.map(id => [`garden>${id}`, [APRON_CORNER]])),
}
/** A LINK BETWEEN TWO NEIGHBOURING VIEWS THAT BENDS, by its pair either way, in east
 * and north (the height runs even between the two eyes): the crane's plinth
 * stands a hand off the straight line to the parachute. */
export const railLinkVia: Readonly<Record<string, readonly (readonly [east: number, north: number])[]>> = {
  'machine/revolving-crane>machine/parachute': [[-40.4, -27.72]],
}

/** THE HEART VALVE'S EYE STANDS SOUTH OF THE STUDIOLO, inside the line of
 * its front, so a straight walk to the reading table crossed the booth's
 * south-east corner. It leaves by one step back into the gallery, near the
 * straight line to the body wall's eye, and goes on from there. */
const VALVE_STEP: RailWaypoint = [-34, -49.9, INSIDE]

const LINKS: readonly { from: RailSide; to: RailSide; via: readonly RailWaypoint[] }[] = [
  { from: 'street', to: 'court', via: railGateWaypoints },
  // The threshold steps are a side of their own, where the house door's two
  // poses stand: every walk from the court to the hall still takes the same
  // four turns.
  { from: 'court', to: 'house-door', via: [COURT_OPEN, THRESHOLD_FOOT] },
  { from: 'house-door', to: 'great-hall', via: [HOUSE_LANDING, ENFILADE_TURN] },
  { from: 'valve-niche', to: 'long-gallery', via: [VALVE_STEP] },
  { from: 'court', to: 'terrace', via: railAccessWaypoints },
  { from: 'court', to: 'south-lawn', via: [LAWN_FOOT] },
  { from: 'terrace', to: 'apron', via: railCollectionStairWaypoints },
  { from: 'apron', to: 'picture-room', via: [APRON_CORNER, ENTRANCE_OUT, ENTRANCE_IN] },
  { from: 'apron', to: 'exhibit-court', via: [APRON_CORNER, APRON_NORTH, COURT_EAST] },
  // The lane leaves the display wall's eye due north, so a walk to the grave
  // begins by turning up it and never by stepping back east first.
  { from: 'exhibit-court', to: 'grave-court', via: [COURT_LANE_START, COURT_LANE_SOUTH, COURT_LANE_EAST, COURT_LANE_WEST] },
  { from: 'picture-room', to: 'long-gallery',
    via: [[PICTURE_TO_GALLERY, FACE.pictureWallNorth + 1.4, INSIDE], [PICTURE_TO_GALLERY, FACE.pictureWallSouth - 1.4, INSIDE]] },
  // The picture room's west door stands in the machine hall's north-west
  // corner, its west reveal the hall's west wall. The walk comes to it up the
  // hall's west side from the south-west bay, so it faces the door for the
  // last six metres and turns in it by a few degrees: along the north wall it
  // met the door at a right angle, facing the west wall from 0.8 m.
  { from: 'picture-room', to: 'mechanism-hall',
    via: [[PICTURE_TO_HALL, FACE.pictureWallNorth + 1.4, INSIDE], [PICTURE_TO_HALL, FACE.pictureWallSouth - 1, INSIDE],
      HALL_WEST_BAY] },
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

/** THE WAY BETWEEN TWO STATION EYES: the shortest chain between their sides,
 * through the doorstep either station keeps. */
export function railStationWaypoints(from: string, to: string,
  ends?: { from: readonly [number, number]; to: readonly [number, number] }): RailWaypoint[] {
  const first = PORCHES[from], last = PORCHES[to]
  const inner = railWaypointsBetween(railSide(from), railSide(to), ends && {
    from: first ? [first[0], first[1]] : ends.from, to: last ? [last[0], last[1]] : ends.to,
  })
  const skipped = SKIPPED[`${from}>${to}`] ?? SKIPPED[`${to}>${from}`] ?? []
  return [...(STEPS_OUT[from] ?? []), ...(first ? [first] : []), ...inner.filter(point => !skipped.includes(point)), ...(last ? [last] : [])]
}
