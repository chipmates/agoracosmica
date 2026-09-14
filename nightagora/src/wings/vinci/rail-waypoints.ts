import { collectionAccessLayout, collectionAccessPoint } from './collection-access'
import { collectionLayout } from './collection'
import { roadGradeProvenance } from './road-grade'

/** THE RAIL'S OWN WAYPOINTS, in east, north, height, with the height already
 * at the eye. A station is a composition; the way between two of them is a
 * route through a real building, and these are the turns it takes. Every
 * number is either a registered one (the gate crossing, the stair, the
 * terrace access) or an authored turn on open ground, marked as such.
 * `rail-certify.mjs` proves the chain below against the mounted geometry and
 * writes the clearance certificate the runtime reads.
 */
export type RailWaypoint = readonly [east: number, north: number, height: number]

/** Standing eye height above whatever the body is walking on. */
export const railEyeHeightM = 1.65
const A = collectionAccessLayout, S = collectionLayout.stair

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

/** Out of the court, down the modern access stair to the terrace, along it to
 * the head of the collection stair, down that, and out onto the apron. The
 * four access points are the middles of its two landings and the two ends of
 * its run; the stair points are the registered stair's own head and foot.
 * One turn on the open terrace is authored: it keeps the walk off the bank.
 */
const landing = A.run / 2 + A.landingDepth / 2
export const railTerraceWaypoints: readonly RailWaypoint[] = [
  [...collectionAccessPoint(landing), A.upper + railEyeHeightM],
  [...collectionAccessPoint(A.run / 2), A.upper + railEyeHeightM],
  [...collectionAccessPoint(-A.run / 2), A.lower + railEyeHeightM],
  [...collectionAccessPoint(-landing), A.lower + railEyeHeightM],
  [-18, -14.5, A.lower + railEyeHeightM],
  [S.east, S.north + .5, A.lower + railEyeHeightM],
  [S.east, S.north, A.lower + railEyeHeightM],
  [S.east, S.south, collectionLayout.floor + railEyeHeightM],
  [S.east, collectionLayout.apron.north - .4, collectionLayout.apron.height + railEyeHeightM],
] as RailWaypoint[]

/** Which side of the house a station stands on. The chains above join them. */
export type RailSide = 'street' | 'court' | 'terrace'
export function railSide(stationId: string): RailSide {
  if (stationId === 'arrival') return 'street'
  if (['courtyard', 'hall', 'oratory', 'study', 'chamber'].includes(stationId)) return 'court'
  return 'terrace'
}

/** The turns between two stations, in walking order. */
export function railWaypointsBetween(from: RailSide, to: RailSide): RailWaypoint[] {
  if (from === to) return []
  const outbound = ['street', 'court', 'terrace'].indexOf(from) < ['street', 'court', 'terrace'].indexOf(to)
  const chain: RailWaypoint[] = []
  const gate = from === 'street' || to === 'street'
  const terrace = from === 'terrace' || to === 'terrace'
  if (gate) chain.push(...railGateWaypoints)
  if (terrace) chain.push(...railTerraceWaypoints)
  return outbound ? chain : chain.reverse()
}
