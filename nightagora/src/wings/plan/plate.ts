/** THE PLATE: the wing drawn as a plan, from geometry the wing already
 * declares. It is a drawing and never a screenshot, so it is one SVG of
 * rectangles, outlines and names, at the museum's own weights.
 *
 * NORTH IS UP, as the site has it: east runs right, north runs up, and the
 * arrow says so. Nothing here reads the scene, the camera or a texture, so a
 * plan costs no draw, no mesh and no shader.
 *
 * NOTHING DRAWN OVERLAPS ANYTHING ELSE DRAWN. Marks, numerals and names are
 * placed in that order, each against the boxes already taken, because a
 * numeral that lands on a wall still names its mark while a name that lands
 * on a mark names neither. Every candidate is tested, so the guarantee does
 * not depend on an engine's text metrics agreeing with another's.
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
/** a name's line, for a plate measured before it is laid out */
const NAME_LINE = 1.75
/** The dot with its ring, in pixels, and the standing dot with its second
 * ring: what the drawing actually puts on the plate at a mark. */
const RING = 9.5, RING_HERE = 13.5
/** the air demanded around everything placed, which is also the halo's own */
const CLEAR = 2
/** a name set beside its room stands this far off it, on a leader */
const LEADER_GAP = 9

/** THE NAME IS MEASURED, NOT ESTIMATED. A name wider than the room it names
 * reads as the name of the room beside it, so each one shrinks to fit its own
 * room and is left off only when even the floor will not hold it. German is
 * the worst case and is the one that decides. */
let ruler: CanvasRenderingContext2D | null | undefined
function rule(px: number): CanvasRenderingContext2D | null {
  ruler ??= document.createElement('canvas').getContext('2d')
  if (!ruler) return null
  const face = getComputedStyle(document.documentElement).getPropertyValue('--sans').trim() || 'sans-serif'
  ruler.font = `${px}px ${face}`
  return ruler
}
function textWidth(words: string, px: number, tracking: number): number {
  const at = rule(px)
  if (!at) return words.length * px * .54
  return at.measureText(words).width + words.length * px * tracking
}

interface Box { l: number; t: number; r: number; b: number }
interface Seg { ax: number; ay: number; bx: number; by: number }
const around = (x: number, y: number, w: number, h: number): Box =>
  ({ l: x - w / 2, t: y - h / 2, r: x + w / 2, b: y + h / 2 })
const grown = (box: Box, by: number): Box => ({ l: box.l - by, t: box.t - by, r: box.r + by, b: box.b + by })
const meets = (a: Box, b: Box): boolean =>
  Math.min(a.r, b.r) > Math.max(a.l, b.l) && Math.min(a.b, b.b) > Math.max(a.t, b.t)

/** A closed outline is not its own extent: the middle of a bent footprint's
 * box can stand outside the footprint. A name belongs to what it names, so an
 * anchor inside the outline is the only one an outline offers. */
function within(hull: readonly { x: number; y: number }[], x: number, y: number): boolean {
  let held = false
  for (let i = 0, j = hull.length - 1; i < hull.length; j = i++) {
    const a = hull[i]!, b = hull[j]!
    if (a.y > y !== b.y > y && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) held = !held
  }
  return held
}

/** The point on a closed outline nearest a place: where a leader touches the
 * thing it names, rather than the corner of the box around it. */
function nearest(hull: readonly { x: number; y: number }[], x: number, y: number): { x: number; y: number } {
  let best = hull[0]!, span = Infinity
  for (let i = 0, j = hull.length - 1; i < hull.length; j = i++) {
    const a = hull[j]!, b = hull[i]!
    const dx = b.x - a.x, dy = b.y - a.y
    const run = dx * dx + dy * dy
    const at = run === 0 ? 0 : Math.min(1, Math.max(0, ((x - a.x) * dx + (y - a.y) * dy) / run))
    const on = { x: a.x + dx * at, y: a.y + dy * at }
    const gap = Math.hypot(on.x - x, on.y - y)
    if (gap < span) { span = gap; best = on }
  }
  return best
}

/** A wall is a line and not a box, so a name clears it by the segment and not
 * by its extent: a long diagonal wall would otherwise refuse the whole field
 * it runs across. */
function crosses(seg: Seg, box: Box): boolean {
  const inside = (x: number, y: number): boolean => x >= box.l && x <= box.r && y >= box.t && y <= box.b
  if (inside(seg.ax, seg.ay) || inside(seg.bx, seg.by)) return true
  const dx = seg.bx - seg.ax, dy = seg.by - seg.ay
  let near = 0, far = 1
  for (const [into, room] of [[-dx, seg.ax - box.l], [dx, box.r - seg.ax], [-dy, seg.ay - box.t], [dy, box.b - seg.ay]] as const) {
    if (into === 0) { if (room < 0) return false; continue }
    const at = room / into
    if (into < 0) { if (at > far) return false; if (at > near) near = at }
    else { if (at < near) return false; if (at < far) far = at }
  }
  return near <= far
}

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
  /** where the drawing goes, attached before a name is measured: a name is
   * placed by what the engine actually draws and not by a proxy for it */
  host: HTMLElement
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
  const leaders = node('g', 'wing-plan-leaders')
  const names = node('g', 'wing-plan-names')
  element.append(shapes, rooms, leaders, names)
  /* ATTACHED FIRST, BECAUSE A NAME IS MEASURED AND NOT ESTIMATED. Engines do
     not agree on what a line of SVG text measures, and none of them agrees
     with a canvas ruler, so the rule that decides where a name may stand
     reads the same text this plate will draw, in this page's own face. */
  options.host.replaceChildren(element)
  const probe = node('text', 'wing-plan-room-name')
  probe.setAttribute('x', '0'); probe.setAttribute('y', '0')
  probe.setAttribute('visibility', 'hidden')
  names.append(probe)
  const sized = new Map<string, { w: number; h: number; dy: number }>()
  function measured(words: string, px: number): { w: number; h: number; dy: number } {
    const key = `${px}|${words}`
    const had = sized.get(key)
    if (had) return had
    probe.setAttribute('font-size', String(px))
    probe.textContent = words
    const seen = probe.getBoundingClientRect(), face = element.getBoundingClientRect()
    // A plate that is not laid out yet measures nothing: the ruler answers.
    const got = face.width > 0 && seen.width > 0
      ? { w: seen.width, h: seen.height, dy: (seen.top + seen.bottom) / 2 - face.top }
      : { w: textWidth(words, px, NAME_TRACKING), h: px * NAME_LINE, dy: 0 }
    sized.set(key, got)
    return got
  }
  /** The largest size at which the name fits the room it names, or none. */
  function nameSize(words: string, room: number, base: number, floor: number): number | null {
    for (let px = base; px >= floor; px -= .5) if (measured(words, px).w <= room - NAME_MARGIN) return px
    return null
  }

  /* EVERYTHING ALREADY ON THE PLATE, in the plate's own pixels. A wall is a
     segment, a mark and a numeral are boxes, and a name has to clear them
     all before it is drawn. */
  const walls: Seg[] = []
  const taken: Box[] = []
  const edges = (corners: { x: number; y: number }[], closed: boolean): void => {
    const last = closed ? corners.length : corners.length - 1
    for (let i = 0; i < last; i++) {
      const a = corners[i]!, b = corners[(i + 1) % corners.length]!
      walls.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y })
    }
  }

  interface Named { id: string; words: string; room: Box; area: number; hull: { x: number; y: number }[] | null }
  const wanted: Named[] = []

  for (const room of site.rooms) {
    const a = project(room.west, room.north), b = project(room.east, room.south)
    const rect = node('rect', 'wing-plan-room')
    rect.setAttribute('x', a.x.toFixed(2)); rect.setAttribute('y', a.y.toFixed(2))
    rect.setAttribute('width', Math.abs(b.x - a.x).toFixed(2))
    rect.setAttribute('height', Math.abs(b.y - a.y).toFixed(2))
    rect.dataset['kind'] = room.kind
    rect.dataset['built'] = String(room.built)
    rooms.append(rect)
    const face: Box = { l: Math.min(a.x, b.x), t: Math.min(a.y, b.y), r: Math.max(a.x, b.x), b: Math.max(a.y, b.y) }
    edges([{ x: face.l, y: face.t }, { x: face.r, y: face.t }, { x: face.r, y: face.b }, { x: face.l, y: face.b }], true)
    if (room.name) wanted.push({ id: room.id, words: room.name[language], room: face, area: (face.r - face.l) * (face.b - face.t), hull: null })
  }

  const path = (points: readonly PlanPoint[]): string =>
    points.map(([east, north]) => { const p = project(east, north); return `${p.x.toFixed(2)},${p.y.toFixed(2)}` }).join(' ')
  for (const shape of site.shapes) {
    const line = node(shape.closed ? 'polygon' : 'polyline', 'wing-plan-shape')
    line.setAttribute('points', path(shape.points))
    line.dataset['fill'] = String(shape.fill)
    line.dataset['built'] = String(shape.built)
    shapes.append(line)
    const corners = shape.points.map(([east, north]) => project(east, north))
    edges(corners, shape.closed)
    if (!shape.name) continue
    // A named outline takes its name inside its own extent.
    const face: Box = { l: Infinity, t: Infinity, r: -Infinity, b: -Infinity }
    for (const corner of corners) {
      face.l = Math.min(face.l, corner.x); face.r = Math.max(face.r, corner.x)
      face.t = Math.min(face.t, corner.y); face.b = Math.max(face.b, corner.y)
    }
    wanted.push({
      id: shape.id, words: shape.name[language], room: face,
      area: (face.r - face.l) * (face.b - face.t), hull: shape.closed ? corners : null,
    })
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
  taken.push({ l: x - 9, t: top - 8, r: x + 9, b: tail + 14 })

  /* THE MARKS, then their numerals, then the names. The order is the order
     of what a mark is worth: a dot without its numeral says nothing, and a
     name has a list beside the plate that already carries it. */
  const marks = planMarks(site, project, options.standing)
  const rings = marks.map(mark => {
    const r = mark.here ? RING_HERE : RING
    return { l: mark.x - r, t: mark.y - r, r: mark.x + r, b: mark.y + r }
  })
  taken.push(...rings)

  const inside = (place: Box): boolean => place.l >= 0 && place.t >= 0 && place.r <= width && place.b <= height
  /** EIGHT WAYS ROUND A MARK, at three distances, and the first that is free
   * of every ring, every numeral already placed and the north arrow. */
  const compass = [[1, -1], [-1, -1], [1, 1], [-1, 1], [0, -1], [0, 1], [1, 0], [-1, 0]] as const
  for (const mark of marks) {
    const words = String(mark.number)
    const w = textWidth(words, PLATE_NUMBER_PX, NUMBER_TRACKING), h = PLATE_NUMBER_PX
    const reach = mark.here ? RING_HERE : RING
    let first: { dx: number; dy: number; box: Box } | null = null
    let chosen: { dx: number; dy: number; box: Box } | null = null
    for (const bounded of [true, false]) {
      for (let step = 0; step < 3 && !chosen; step++) for (const [sx, sy] of compass) {
        // A diagonal reaches the ring at its own angle, so it leans in.
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
    // A mark without its numeral names nothing, so one is always drawn.
    const put = chosen ?? first!
    mark.numeral = { dx: +put.dx.toFixed(2), dy: +put.dy.toFixed(2) }
    taken.push(put.box)
  }

  /* THE NAMES, the widest room first, so the rooms that have the space to
     hold their own name take it and the narrow ones look for air around it. */
  const named: string[] = []
  for (const entry of [...wanted].sort((a, b) => b.area - a.area)) {
    const mid = { x: (entry.room.l + entry.room.r) / 2, y: (entry.room.t + entry.room.b) / 2 }
    const tries: { x: number; y: number; size: number; leader: Seg | null }[] = []
    const held = nameSize(entry.words, entry.room.r - entry.room.l, namePx, nameFloor)
    if (held !== null) {
      const tall = measured(entry.words, held).h
      const hull = entry.hull
      const at = (x: number, y: number): void => {
        if (hull && !within(hull, x, y)) return
        tries.push({ x, y, size: held, leader: null })
      }
      // An outline's own middle of area first, which a bent footprint has and
      // the middle of its box has not.
      if (hull) {
        let weight = 0, cx = 0, cy = 0
        for (let i = 0, j = hull.length - 1; i < hull.length; j = i++) {
          const a = hull[i]!, b = hull[j]!
          const cross = a.x * b.y - b.x * a.y
          weight += cross; cx += (a.x + b.x) * cross; cy += (a.y + b.y) * cross
        }
        if (weight !== 0) at(cx / (3 * weight), cy / (3 * weight))
      }
      at(mid.x, mid.y)
      at(mid.x, entry.room.t + tall / 2 + 3)
      at(mid.x, entry.room.b - tall / 2 - 3)
    }
    // BESIDE THE ROOM, ON A LEADER, at the plate's own size: a name that will
    // not fit a narrow room still belongs to it, and the line says which.
    const out = measured(entry.words, namePx).w, tall = measured(entry.words, namePx).h
    const beside = [
      { x: entry.room.r + LEADER_GAP + out / 2, y: mid.y, from: { x: entry.room.r, y: mid.y } },
      { x: entry.room.l - LEADER_GAP - out / 2, y: mid.y, from: { x: entry.room.l, y: mid.y } },
      { x: mid.x, y: entry.room.t - LEADER_GAP - tall / 2, from: { x: mid.x, y: entry.room.t } },
      { x: mid.x, y: entry.room.b + LEADER_GAP + tall / 2, from: { x: mid.x, y: entry.room.b } },
    ]
    for (const spot of beside) {
      // THE LEADER TOUCHES THE THING IT NAMES: a room's own edge, and for an
      // outline the outline itself and not the corner of its box. It stops
      // where the name's halo starts.
      const foot = entry.hull ? nearest(entry.hull, spot.x, spot.y) : spot.from
      const dx = foot.x - spot.x, dy = foot.y - spot.y
      const span = Math.hypot(dx, dy) || 1
      const edge = Math.min(Math.abs(dx) > .01 ? (out / 2 + CLEAR) / Math.abs(dx) * span : Infinity,
        Math.abs(dy) > .01 ? (tall / 2 + CLEAR) / Math.abs(dy) * span : Infinity, span)
      tries.push({
        x: spot.x, y: spot.y, size: namePx,
        leader: { ax: foot.x, ay: foot.y, bx: spot.x + dx / span * edge, by: spot.y + dy / span * edge },
      })
    }

    let put: { x: number; y: number; size: number; leader: Seg | null; box: Box } | null = null
    for (const spot of tries) {
      const seen = measured(entry.words, spot.size)
      const place = around(spot.x, spot.y + seen.dy, seen.w, seen.h)
      const test = grown(place, CLEAR)
      if (!inside(test)) continue
      if (taken.some(hold => meets(test, hold))) continue
      if (walls.some(wall => crosses(wall, test))) continue
      put = { ...spot, box: place }
      break
    }
    // A NAME THAT FITS NOWHERE IS LEFT OFF. The list beside the plate carries
    // every one of them, so nothing is lost by the plate staying readable.
    if (!put) continue
    const text = node('text', 'wing-plan-room-name')
    text.setAttribute('x', put.x.toFixed(2)); text.setAttribute('y', put.y.toFixed(2))
    text.setAttribute('font-size', String(put.size))
    text.textContent = entry.words
    names.append(text)
    if (put.leader) {
      const line = node('line', 'wing-plan-leader')
      line.setAttribute('x1', put.leader.ax.toFixed(2)); line.setAttribute('y1', put.leader.ay.toFixed(2))
      line.setAttribute('x2', put.leader.bx.toFixed(2)); line.setAttribute('y2', put.leader.by.toFixed(2))
      leaders.append(line)
    }
    taken.push(put.box)
    named.push(entry.id)
  }

  probe.remove()
  return { element, width, height, scale, project, marks, named }
}
