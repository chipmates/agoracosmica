/* THE FILM'S PLAN, composed: the live plan's rooms and shapes from the same
   declared geometry, the film's own stops at the eyes the film was printed
   from, and the works the film can show under the stations that hold them. */

import type { PlanHighlight, PlanPoint, PlanRoom, PlanShape, PlanSite, PlanStation } from '../plan/types'
import { COURT, GRAVE_ORIGIN, LINE_FIELD, ROOMS, SUPPER_WALL } from './collection/layout'
import { dossier } from './site'
import { vinciContent, vinciPlanRooms, type VinciText } from './content'
import { parsePrint } from '../picture/seam'
import { vinciLineHighlights } from './life-record'
import type { FilmRelease } from '../picture/film'
import type { DeskOverviewCell } from '../overview'

export interface FilmPlanStop { id: string; station: string; name: VinciText }

/** A STOP THAT IS A STATION is a mark on the plan, as in the live plan: a
    place of the walk inside a station's room (the Lisa, the valve) is not. */
function stations(release: FilmRelease, stops: readonly FilmPlanStop[], carried: (index: number) => boolean) {
  return stops.flatMap((stop, index) => {
    const content = vinciContent.find(station => station.id === stop.id)
    const node = release.nodes[`stop:${stop.id}`]
    const print = parsePrint(node?.print.wide ?? node?.print.upright ?? '')
    if (stop.id !== stop.station || !content || !print || !carried(index)) return []
    // the print's eye is the world's: east is x, north is minus z
    return [{ content, number: index + 1, east: print[0], north: -print[2] }]
  })
}

/** THE WING AS A PLAN, its stations in the walk's own order. */
export function filmPlanSite(release: FilmRelease, stops: readonly FilmPlanStop[], carried: (index: number) => boolean,
  highlights: readonly PlanHighlight[]): PlanSite {
  const box = (west: number, east: number, south: number, north: number): PlanPoint[] =>
    [[west, south], [east, south], [east, north], [west, north]]
  const rooms: PlanRoom[] = [
    { id: 'court', name: vinciPlanRooms.court, kind: 'court', west: COURT.west, east: COURT.east, south: COURT.south, north: COURT.north, built: true },
    { id: 'grave', name: vinciPlanRooms.grave, kind: 'court', west: GRAVE_ORIGIN.east - 4, east: GRAVE_ORIGIN.east + 9, south: GRAVE_ORIGIN.north - 6, north: GRAVE_ORIGIN.north + 6, built: true },
    { id: ROOMS.picture.id, name: vinciPlanRooms['picture-room'], kind: 'room', west: ROOMS.picture.west, east: ROOMS.picture.east, south: ROOMS.picture.south, north: ROOMS.picture.north, built: true },
    { id: ROOMS.hall.id, name: vinciPlanRooms['mechanism-hall'], kind: 'room', west: ROOMS.hall.west, east: ROOMS.hall.east, south: ROOMS.hall.south, north: ROOMS.hall.north, built: true },
    { id: ROOMS.gallery.id, name: vinciPlanRooms['long-gallery'], kind: 'room', west: ROOMS.gallery.west, east: ROOMS.gallery.east, south: ROOMS.gallery.south, north: ROOMS.gallery.north, built: true },
    { id: 'line-field', name: null, kind: 'field', west: LINE_FIELD.west, east: LINE_FIELD.east,
      south: Math.max(LINE_FIELD.south, ROOMS.gallery.south), north: Math.min(LINE_FIELD.north, ROOMS.gallery.north), built: true },
  ]
  const shapes: PlanShape[] = [
    // the house is not open: its footprint is an outline, never a fill
    { id: 'house', name: vinciPlanRooms.house, points: dossier.site.footprint.map(point => [point.value[0]!, point.value[1]!] as PlanPoint), closed: true, fill: false, built: false },
    { id: 'supper-wall', points: box(SUPPER_WALL.east - SUPPER_WALL.thickness / 2, SUPPER_WALL.east + SUPPER_WALL.thickness / 2,
      SUPPER_WALL.north - SUPPER_WALL.length / 2, SUPPER_WALL.north + SUPPER_WALL.length / 2), closed: true, fill: true, built: true },
    { id: 'parapet-north', points: box(COURT.west, COURT.east, COURT.north - COURT.parapetThickness, COURT.north), closed: true, fill: true, built: true },
    { id: 'parapet-west', points: box(COURT.west, COURT.west + COURT.parapetThickness, COURT.south, COURT.north), closed: true, fill: true, built: true },
    { id: 'parapet-east', points: box(COURT.east - COURT.parapetThickness, COURT.east, COURT.south, COURT.north), closed: true, fill: true, built: true },
  ]
  const placed = stations(release, stops, carried)
  const marks: PlanStation[] = placed.map((here, index) => ({
    id: here.content.id, number: here.number, name: here.content.name, group: here.content.group, east: here.east, north: here.north,
    // stations seen from one standing place are one mark
    sharesPoseWith: placed.flatMap((other, at) => at === index || other.east !== here.east || other.north !== here.north ? [] : [other.content.id]),
  }))
  return { rooms, shapes, stations: marks, highlights }
}

/** THE WORKS THE PLAN OFFERS under each station: the room's own list as the
    film's overview names it (a cell exists only where the film can show the
    work), the reading table's topics, and the line's dates and floor. The
    titles come in the page's language, so a list is read again per language. */
export async function filmPlanHighlights(release: FilmRelease, stops: readonly FilmPlanStop[], carried: (index: number) => boolean,
  cells: (ids: readonly string[]) => Promise<DeskOverviewCell[]>, sets: { floor: string; table: readonly string[] }, language: 'en' | 'de'): Promise<PlanHighlight[]> {
  const out: PlanHighlight[] = []
  for (const { content } of stations(release, stops, carried)) {
    if (content.group === 'line') {
      for (const work of vinciLineHighlights(sets.floor)) out.push({ id: work.id, station: content.id, title: work.title, kind: 'stud' })
      continue
    }
    const ids = content.id === 'reading-table' ? sets.table : release.sets?.[content.id] ?? []
    for (const cell of ids.length ? await cells(ids) : []) {
      if (!cell.openable) continue
      out.push({ id: cell.id, station: content.id, title: { en: language === 'en' ? cell.title : '', de: language === 'de' ? cell.title : '' }, kind: cell.kind })
    }
  }
  return out
}
