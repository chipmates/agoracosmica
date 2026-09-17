/** THE PLATE: the wing drawn as a plan, from geometry the wing already
 * declares. It is a drawing and never a screenshot, so it is one SVG of
 * rectangles, outlines and names, at the museum's own weights.
 *
 * NORTH IS UP, as the site has it: east runs right, north runs up, and the
 * arrow says so. Nothing here reads the scene, the camera or a texture, so a
 * plan costs no draw, no mesh and no shader.
 *
 * The drawing is aria-hidden. Everything a hand or a reader needs is the
 * list beside it, which is why no text in here has to be reachable. */

import type { PlanPoint, PlanSite } from './types'

/** metres of clear ground around everything the plan draws */
export const PLATE_PAD_M = 2.5
/** Two eyes closer than this are one standing place, so they are one mark. */
export const CLUSTER_M = 1.2
/** The room names, in pixels, at the two stages. */
export const PLATE_NAME_PX = { wide: 11, narrow: 8.5 } as const
/** A NAME WIDER THAN THE ROOM IT NAMES IS NOT DRAWN: at the scale a whole
 * wing needs, a name that overruns reads as the name of the room beside it.
 * The share is the average advance of this face, measured against its worst
 * case, which is the German. */
const NAME_ADVANCE = .54

export interface PlanMark {
  /** the stations this one standing place carries, in rail order */
  stations: string[]
  x: number
  y: number
}

export interface PlanPlate {
  element: SVGSVGElement
  width: number
  height: number
  /** px per metre */
  scale: number
  project(east: number, north: number): { x: number; y: number }
  marks: PlanMark[]
}

const SVG = 'http://www.w3.org/2000/svg'

function node<K extends keyof SVGElementTagNameMap>(tag: K, cls: string): SVGElementTagNameMap[K] {
  const element = document.createElementNS(SVG, tag)
  element.setAttribute('class', cls)
  return element
}

interface Bounds { west: number; east: number; south: number; north: number }

function bounds(site: PlanSite): Bounds {
  const box: Bounds = { west: Infinity, east: -Infinity, south: Infinity, north: -Infinity }
  const hold = (east: number, north: number): void => {
    box.west = Math.min(box.west, east); box.east = Math.max(box.east, east)
    box.south = Math.min(box.south, north); box.north = Math.max(box.north, north)
  }
  for (const room of site.rooms) { hold(room.west, room.south); hold(room.east, room.north) }
  for (const shape of site.shapes) for (const [east, north] of shape.points) hold(east, north)
  for (const station of site.stations) hold(station.east, station.north)
  return box
}

/** THE STANDING PLACES, not the stations. Four rooms entered from one place
 * are one mark with four names, which is the standstill shown rather than
 * explained; two stations the room puts a hand's width apart are one too. */
export function planMarks(site: PlanSite, project: (east: number, north: number) => { x: number; y: number }): PlanMark[] {
  const marks: { stations: string[]; east: number; north: number }[] = []
  for (const station of site.stations) {
    const near = marks.find(mark => Math.hypot(mark.east - station.east, mark.north - station.north) <= CLUSTER_M)
    if (near) { near.stations.push(station.id); continue }
    marks.push({ stations: [station.id], east: station.east, north: station.north })
  }
  return marks.map(mark => ({ stations: mark.stations, ...project(mark.east, mark.north) }))
}

/** The plan drawn to fit the area whole: a wing is a place a visitor takes in
 * at once, so it is never panned and never zoomed. */
export function drawPlanPlate(
  site: PlanSite,
  area: { width: number; height: number },
  language: 'en' | 'de',
  namePx: number = PLATE_NAME_PX.wide,
): PlanPlate {
  const box = bounds(site)
  const spanEast = Math.max(1, box.east - box.west + PLATE_PAD_M * 2)
  const spanNorth = Math.max(1, box.north - box.south + PLATE_PAD_M * 2)
  const scale = Math.min(area.width / spanEast, area.height / spanNorth)
  const width = spanEast * scale, height = spanNorth * scale
  const project = (east: number, north: number): { x: number; y: number } => ({
    x: (east - box.west + PLATE_PAD_M) * scale,
    y: (box.north + PLATE_PAD_M - north) * scale,
  })

  const element = node('svg', 'wing-plan-plate')
  element.setAttribute('viewBox', `0 0 ${width.toFixed(2)} ${height.toFixed(2)}`)
  element.setAttribute('width', String(Math.round(width)))
  element.setAttribute('height', String(Math.round(height)))
  element.setAttribute('aria-hidden', 'true')
  element.setAttribute('focusable', 'false')

  const rooms = node('g', 'wing-plan-rooms')
  const shapes = node('g', 'wing-plan-shapes')
  const names = node('g', 'wing-plan-names')
  element.append(shapes, rooms, names)

  for (const room of site.rooms) {
    const a = project(room.west, room.north), b = project(room.east, room.south)
    const rect = node('rect', 'wing-plan-room')
    rect.setAttribute('x', a.x.toFixed(2)); rect.setAttribute('y', a.y.toFixed(2))
    rect.setAttribute('width', Math.abs(b.x - a.x).toFixed(2))
    rect.setAttribute('height', Math.abs(b.y - a.y).toFixed(2))
    rect.dataset['kind'] = room.kind
    rect.dataset['built'] = String(room.built)
    rooms.append(rect)
    if (!room.name) continue
    const words = room.name[language]
    if (words.length * namePx * NAME_ADVANCE > Math.abs(b.x - a.x) - 4) continue
    const centre = project((room.west + room.east) / 2, (room.south + room.north) / 2)
    const text = node('text', 'wing-plan-room-name')
    text.setAttribute('x', centre.x.toFixed(2)); text.setAttribute('y', centre.y.toFixed(2))
    text.setAttribute('font-size', String(namePx))
    text.textContent = words
    names.append(text)
  }

  const path = (points: readonly PlanPoint[]): string =>
    points.map(([east, north]) => { const p = project(east, north); return `${p.x.toFixed(2)},${p.y.toFixed(2)}` }).join(' ')
  for (const shape of site.shapes) {
    const line = node(shape.closed ? 'polygon' : 'polyline', 'wing-plan-shape')
    line.setAttribute('points', path(shape.points))
    line.dataset['fill'] = String(shape.fill)
    line.dataset['built'] = String(shape.built)
    shapes.append(line)
  }

  /* NORTH AS THE SITE HAS IT. The site's own frame is east and north, so the
     arrow is the frame and not a decoration. */
  const arrow = node('g', 'wing-plan-north')
  const stem = node('line', 'wing-plan-north-stem')
  const top = 14, tail = 42, x = width - 16
  stem.setAttribute('x1', String(x)); stem.setAttribute('y1', String(tail))
  stem.setAttribute('x2', String(x)); stem.setAttribute('y2', String(top))
  const head = node('polygon', 'wing-plan-north-head')
  head.setAttribute('points', `${x},${top - 6} ${x - 4},${top + 2} ${x + 4},${top + 2}`)
  const letter = node('text', 'wing-plan-north-letter')
  letter.setAttribute('x', String(x)); letter.setAttribute('y', String(tail + 11))
  letter.textContent = 'N'
  arrow.append(stem, head, letter)
  element.append(arrow)

  return { element, width, height, scale, project, marks: planMarks(site, project) }
}
