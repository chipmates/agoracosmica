/** THE FIFTY SIX DATES AS DATA, without the floor that carries twelve of them.
 *
 * The sealed collection read once, in the walk's own order, so the offline
 * certifier, the pick registry and the stud reader share one list and none of
 * them builds geometry to learn where a date is. */
import timelineText from './data/timeline.json?raw'

export type Stud = (typeof import('./data/timeline.json'))['studs'][number]

const timeline = JSON.parse(timelineText) as { studs: Stud[]; design: { spacing: string; afterlife: string } }
const STATION_ORDER = ['line-early', 'line-late', 'line-amboise']

/** Sorted by station, then by the order each station reads its dates in. */
export const LINE_STUDS: readonly Stud[] = [...timeline.studs].sort((a, b) =>
  STATION_ORDER.indexOf(a.station) - STATION_ORDER.indexOf(b.station) || a.display_order - b.display_order)
/** One socket slab to the next, along the gallery. */
export const LINE_STUD_SPACING = 1.65

/** The gallery's three excerpts: four sockets each, from the selected date on,
 * at the course the room lays them from. The floor's own placement reads the
 * same three rows. */
export const LINE_SECTIONS = [
  { station: 'line-early', selected: 0, row: 0 },
  { station: 'line-late', selected: 28, row: 4 },
  { station: 'line-amboise', selected: 38, row: 8 },
] as const

/** Where each of the twelve cut dates stands, in the wing's own metres. */
export function lineCutStuds(origin: { east: number; north: number }): { id: string; station: string; index: number; east: number; north: number }[] {
  const first = origin.north + 9 * LINE_STUD_SPACING
  return LINE_SECTIONS.flatMap(section => Array.from({ length: 4 }, (_, offset) => ({
    id: LINE_STUDS[section.selected + offset]!.id,
    station: section.station,
    index: section.selected + offset,
    east: origin.east,
    north: first - (section.row + offset) * LINE_STUD_SPACING,
  })))
}
