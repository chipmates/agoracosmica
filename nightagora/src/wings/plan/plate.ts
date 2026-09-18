/** THE PLATE: the wing drawn as a plan, from geometry the wing already
 * declares. It is a drawing and never a screenshot, so it is one SVG of
 * rectangles, outlines and names, at the museum's own weights.
 *
 * NORTH IS UP, as the site has it: east runs right, north runs up, and the
 * arrow says so. Nothing here reads the scene, the camera or a texture, so a
 * plan costs no draw, no mesh and no shader.
 *
 * NOTHING DRAWN LANDS ON ANYTHING ELSE DRAWN. Every numeral is tested against
 * the marks and the numerals already placed, so the guarantee does not rest on
 * one engine's text metrics agreeing with another's.
 *
 * The drawing is aria-hidden. Everything a hand or a reader needs is the
 * list beside it, which is why no text in here has to be reachable. */

import type { PlanPoint, PlanSite } from './types'

/** metres of clear ground around everything the plan draws */
export const PLATE_PAD_M = 2.5
/** Two eyes closer than this are one standing place, so they are one mark. */
export const CLUSTER_M = 1.2
/** The room names, in pixels: the size each stage starts at, and the size
 * below which a name is left off rather than shrunk into illegibility. */
export const PLATE_NAME_PX = { wide: 11, narrow: 8.5 } as const
export const PLATE_NAME_FLOOR = { wide: 8, narrow: 6.5 } as const
/** The numeral beside a mark. The rule that draws it and the rule that keeps
 * it clear of everything else have to agree on its size, so it stands here
 * and `plan.css` reads the same number. */
export const PLATE_NUMBER_PX = 9
/** the plate's own tracking, which the ruler has to add back */
const NAME_TRACKING = .04
const NUMBER_TRACKING = .06
/** clear ground each side of a name inside its room */
const NAME_MARGIN = 4
/** The dot with its ring, in pixels, and the standing dot with its second
 * ring: what the drawing actually puts on the plate at a mark. */
const RING = 9.5, RING_HERE = 13.5
/** the air demanded around everything placed, which is also the halo's own */
const CLEAR = 2

/** THE NAME IS MEASURED, NOT ESTIMATED. A name wider than the room it names
 * reads as the name of the room beside it, so each one shrinks to fit its own
 * room and is left off only when even the floor will not hold it. German is
 * the worst case and is the one that decides. */
let ruler: CanvasRenderingContext2D | null | undefined
function textWidth(words: string, px: number, tracking: number): number {
  ruler ??= document.createElement('canvas').getContext('2d')
  const face = getComputedStyle(document.documentElement).getPropertyValue('--sans').trim() || 'sans-serif'
  if (!ruler) return words.length * px * .54
  ruler.font = `${px}px ${face}`
  return ruler.measureText(words).width + words.length * px * tracking
}
function nameSize(words: string, room: number, base: number, floor: number): number | null {
  for (let px = base; px >= floor; px -= .5) if (textWidth(words, px, NAME_TRACKING) <= room - NAME_MARGIN) return px
  return null
}

interface Box { l: number; t: number; r: number; b: number }
const around = (x: number, y: number, w: number, h: number): Box =>
  ({ l: x - w / 2, t: y - h / 2, r: x + w / 2, b: y + h / 2 })
const grown = (box: Box, by: number): Box => ({ l: box.l - by, t: box.t - by, r: box.r + by, b: box.b + by })
const meets = (a: Box, b: Box): boolean =>
  Math.min(a.r, b.r) > Math.max(a.l, b.l) && Math.min(a.b, b.b) > Math.max(a.t, b.t)

export interface PlanMark {
  /** the stations this one standing place carries, in rail order */
  stations: string[]
  /** the station a press on this mark walks to */
  lead: string
  /** the number drawn beside it, which is the lead station's rail number */
  number: number
  /** true where the visitor is standing right now */
  here: boolean
  x: number
  y: number
  /** the numeral's own centre, offset from the mark's */
  numeral: { dx: number; dy: number }
}

export interface PlanPlate {
  element: SVGSVGElement
  width: number
  height: number
  /** px per metre */
  scale: number
  project(east: number, north: number): { x: number; y: number }
  marks: PlanMark[]
  /** the room names the plate found room for, by room id */
  named: string[]
}

export interface PlanPlateOptions {
  language: 'en' | 'de'
  /** the station standing right now, which decides a shared mark's numeral */
  standing: string
  namePx?: number
  nameFloor?: number
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
export function planMarks(
  site: PlanSite,
  project: (east: number, north: number) => { x: number; y: number },
  standing = '',
): PlanMark[] {
  const places: { stations: string[]; east: number; north: number }[] = []
  for (const station of site.stations) {
    const near = places.find(place => Math.hypot(place.east - station.east, place.north - station.north) <= CLUSTER_M)
    if (near) { near.stations.push(station.id); continue }
    places.push({ stations: [station.id], east: station.east, north: station.north })
  }
  return places.flatMap(place => {
    // A shared place carries several names and lights the one standing.
    const here = place.stations.includes(standing)
    const lead = here ? standing : place.stations[0]!
    const first = site.stations.find(station => station.id === lead)
    if (!first) return []
    return [{
      stations: place.stations, lead, number: first.number, here,
      ...project(place.east, place.north), numeral: { dx: 0, dy: 0 },
    }]
  })
}

/** The plan drawn to fit the area whole: a wing is a place a visitor takes in
 * at once, so it is never panned and never zoomed. */
export function drawPlanPlate(
  site: PlanSite,
  area: { width: number; height: number },
  options: PlanPlateOptions,
): PlanPlate {
  const { language } = options
  const namePx = options.namePx ?? PLATE_NAME_PX.wide
  const nameFloor = options.nameFloor ?? PLATE_NAME_FLOOR.wide
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
  /* THE PLATE'S UNIT IS THE PAGE'S PIXEL. The marks and their numerals are
     DOM over this drawing, so a rounded width here would scale the SVG
     against them and every clearance would be out by up to a pixel. */
  element.setAttribute('width', width.toFixed(2))
  element.setAttribute('height', height.toFixed(2))
  element.setAttribute('aria-hidden', 'true')
  element.setAttribute('focusable', 'false')

  const rooms = node('g', 'wing-plan-rooms')
  const shapes = node('g', 'wing-plan-shapes')
  const names = node('g', 'wing-plan-names')
  element.append(shapes, rooms, names)
  const named: string[] = []

  function label(words: string, centre: { x: number; y: number }, room: number, id: string): void {
    const size = nameSize(words, room, namePx, nameFloor)
    if (size === null) return
    const text = node('text', 'wing-plan-room-name')
    text.setAttribute('x', centre.x.toFixed(2)); text.setAttribute('y', centre.y.toFixed(2))
    text.setAttribute('font-size', String(size))
    text.textContent = words
    names.append(text)
    named.push(id)
  }

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
    const centre = project((room.west + room.east) / 2, (room.south + room.north) / 2)
    label(room.name[language], centre, Math.abs(b.x - a.x), room.id)
  }

  const path = (points: readonly PlanPoint[]): string =>
    points.map(([east, north]) => { const p = project(east, north); return `${p.x.toFixed(2)},${p.y.toFixed(2)}` }).join(' ')
  for (const shape of site.shapes) {
    const line = node(shape.closed ? 'polygon' : 'polyline', 'wing-plan-shape')
    line.setAttribute('points', path(shape.points))
    line.dataset['fill'] = String(shape.fill)
    line.dataset['built'] = String(shape.built)
    shapes.append(line)
    if (!shape.name) continue
    // A named outline takes its name at the middle of its own extent.
    let west = Infinity, east = -Infinity, south = Infinity, north = -Infinity
    for (const [e, n] of shape.points) {
      west = Math.min(west, e); east = Math.max(east, e)
      south = Math.min(south, n); north = Math.max(north, n)
    }
    label(shape.name[language], project((west + east) / 2, (south + north) / 2), (east - west) * scale, shape.id)
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

  /* THE NUMERALS. A dot without its number names nothing, so one is drawn at
     every mark; which side it stands on is the plate's to choose, and it takes
     the first of eight ways round that is free of every mark's own ring, its
     own included, of every numeral already placed and of the north arrow. */
  const marks = planMarks(site, project, options.standing)
  const taken: Box[] = [{ l: x - 9, t: top - 8, r: x + 9, b: tail + 14 }]
  for (const mark of marks) {
    const r = mark.here ? RING_HERE : RING
    taken.push({ l: mark.x - r, t: mark.y - r, r: mark.x + r, b: mark.y + r })
  }
  const inside = (place: Box): boolean => place.l >= 0 && place.t >= 0 && place.r <= width && place.b <= height
  const compass = [[1, -1], [-1, -1], [1, 1], [-1, 1], [0, -1], [0, 1], [1, 0], [-1, 0]] as const
  for (const mark of marks) {
    const words = String(mark.number)
    const w = textWidth(words, PLATE_NUMBER_PX, NUMBER_TRACKING), h = PLATE_NUMBER_PX
    const reach = mark.here ? RING_HERE : RING
    let first: { dx: number; dy: number; box: Box } | null = null
    let chosen: { dx: number; dy: number; box: Box } | null = null
    for (const bounded of [true, false]) {
      for (let step = 0; step < 3 && !chosen; step++) for (const [sx, sy] of compass) {
        // A diagonal meets the ring at its own angle, so it leans in.
        const lean = sx !== 0 && sy !== 0 ? .72 : 1
        const off = reach * lean + 5 + step * 9
        const dx = sx === 0 ? 0 : sx * (off + w / 2)
        const dy = sy === 0 ? 0 : sy * (off + h / 2)
        const place = around(mark.x + dx, mark.y + dy, w, h)
        first ??= { dx, dy, box: place }
        const test = grown(place, CLEAR)
        if (bounded && !inside(test)) continue
        if (taken.some(held => meets(test, held))) continue
        chosen = { dx, dy, box: place }
        break
      }
      if (chosen) break
    }
    const put = chosen ?? first!
    mark.numeral = { dx: +put.dx.toFixed(2), dy: +put.dy.toFixed(2) }
    taken.push(put.box)
  }

  return { element, width, height, scale, project, marks, named }
}
