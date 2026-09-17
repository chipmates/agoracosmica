/** WHAT A WING HANDS THE PLAN. The plan draws a place, so everything here is
 * geometry a wing has already declared plus the names it already carries. No
 * module under this folder knows which wing it is drawing: a wing passes this
 * site and the plan draws it, which is what lets the second wing have a plan
 * without a second plan being written.
 *
 * The frame is the wing's own metres: east to the right, north up, exactly
 * as the site holds them. Heights are not drawn and are not passed. */

export interface Bi { en: string; de: string }

/** east, north */
export type PlanPoint = readonly [number, number]

export interface PlanRoom {
  id: string
  name: Bi | null
  /** a walled room, an open terrace, or a field inside a room */
  kind: 'room' | 'court' | 'field'
  west: number; east: number; south: number; north: number
  /** A room in construction is drawn as an outline and never as fill. */
  built: boolean
}

/** Everything the plan draws that is not a rectangle: a footprint, a free
 * standing wall, the edge a parapet runs along. */
export interface PlanShape {
  id: string
  points: readonly PlanPoint[]
  closed: boolean
  fill: boolean
  built: boolean
}

export interface PlanStation {
  id: string
  /** its place in the rail's own order, one based, which is what a visitor
   * reads on the bar */
  number: number
  name: Bi
  group: 'house' | 'line' | 'collection'
  /** the station's own eye */
  east: number
  north: number
  /** the stations whose eye is this one: the four rooms of a house that are
   * entered from one standing place are one mark, not four */
  sharesPoseWith: readonly string[]
}

export interface PlanHighlight {
  id: string
  station: string
  title: Bi
  kind: string
}

export interface PlanSite {
  rooms: readonly PlanRoom[]
  shapes: readonly PlanShape[]
  stations: readonly PlanStation[]
  highlights: readonly PlanHighlight[]
}

/** Composed at render and never stored: a title and a line in the page's
 * language, resolved from the wing's own registers by the id the night kept. */
export interface RecapEntry {
  id: string
  title: string
  line: string | null
  station: string
}
