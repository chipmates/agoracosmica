/** THE LEGS THE RAIL WALKS: only a stop's next and previous in the walk.
 *
 * A press on the plan or on a far mark of the bar is a short fade, never a
 * walk, so the certificate carries neighbour legs only, both ways, in both
 * orders (the life's, and the rooms' the address may ask for). Where the
 * house's door stands between two neighbours the walked leg ends or begins
 * at the door's own pose, as the walk takes it; a chapter cut is crossed by
 * its title and walks nothing; the portrait's stop is a vertex of the
 * picture wall, whose runs the wall's own line carries.
 *
 * Ids here are rail places: a station's id, or a pose of the walk's own
 * (`walk-places.ts`). `rail-certify.mjs` proves exactly these legs and
 * `rail-proof.ts` requires exactly them.
 */
import { vinciStory } from './story'
import { VINCI_HOUSE_DOOR, VINCI_LISA_STOP, VINCI_OFF_THE_WALK, VINCI_STAIR_HEAD, VINCI_VALVE } from './walk-places'

/** THE WALK'S START: the rail place the wing opens at, before its first
 * stop. Its one leg is the descent to the life's first stop, walked down and
 * never back up. */
export const VINCI_WALK_START = VINCI_STAIR_HEAD

/** One order of the walk as rail places, the valve after the body wall, and
 * the index of every stop a chapter cut stands before. */
function sequence(ids: readonly string[], cutBefore: ReadonlySet<number>): { places: string[]; cuts: Set<number> } {
  const places: string[] = [], cuts = new Set<number>()
  ids.forEach((id, i) => {
    if (cutBefore.has(i)) cuts.add(places.length)
    places.push(id)
    if (id === VINCI_VALVE.station) places.push(VINCI_VALVE.place)
  })
  return { places, cuts }
}

/** The life's stops in the story's order, as the walk builds them. */
function lifeIds(built: ReadonlySet<string>): { places: string[]; cuts: Set<number> } {
  const ids: string[] = [], cutBefore = new Set<number>()
  let waiting = false
  for (const stop of [...vinciStory].sort((a, b) => a.order - b.order)) {
    if (stop.kind === 'cut') { waiting = true; continue }
    const here = stop.id === VINCI_LISA_STOP || (built.has(stop.id) && !VINCI_OFF_THE_WALK.has(stop.id))
    if (!here) continue
    if (waiting && ids.length) cutBefore.add(ids.length)
    waiting = false
    ids.push(stop.id)
  }
  return sequence(ids, cutBefore)
}

/** The walked leg between two neighbouring stops, from one to the other, or
 * none where the leg is a wall's run. */
function leg(from: string, to: string): readonly [string, string] | null {
  if (from === VINCI_LISA_STOP || to === VINCI_LISA_STOP) return null
  const room = VINCI_HOUSE_DOOR.station
  if (to === room && from !== room) return [from, VINCI_HOUSE_DOOR.inward]
  if (from === room && to !== room) return [VINCI_HOUSE_DOOR.outward, to]
  return [from, to]
}

/** Every directed leg the walk can ask of the rail, each once. `rooms` is the
 * stations in the order the rooms were built, `content.ts`'s own. */
export function vinciRailNeighbourLegs(rooms: readonly string[]): readonly (readonly [string, string])[] {
  const built = new Set(rooms)
  const legs = new Map<string, readonly [string, string]>()
  const add = (pair: readonly [string, string] | null): void => { if (pair && pair[0] !== pair[1]) legs.set(`${pair[0]}>${pair[1]}`, pair) }
  const life = lifeIds(built)
  if (life.places.length) add(leg(VINCI_WALK_START, life.places[0]!))
  for (const { places, cuts } of [life, sequence(rooms, new Set())]) {
    for (let i = 1; i < places.length; i++) {
      if (cuts.has(i)) continue
      add(leg(places[i - 1]!, places[i]!))
      add(leg(places[i]!, places[i - 1]!))
    }
  }
  return [...legs.values()]
}
