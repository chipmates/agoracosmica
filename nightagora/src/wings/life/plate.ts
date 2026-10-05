/** THE LIFE AS ONE NAMED RIBBON: the periods drawn to the years they are
 * declared between, named where a name measures, interrupted where the record
 * is empty, with every date under them as one thin tick.
 *
 * The drawing carries no numeral of its own and no certainty: a period is an
 * editorial grouping and not a claim, and every year it spans is written in
 * the list beside it. What it does carry is the shape of a life, the place
 * that is open, the hour the visitor stands in, and the date being read.
 *
 * The presses are HTML over this drawing, placed from the bands it reports,
 * because an SVG rect cannot be a 44 px target and keep its own width.
 */

import { dateYears, type LifeGap, type LifeScale } from './scale'
import type { Bi, LifeBand, LifeRecord } from './types'
import { fill } from './words'

const NS = 'http://www.w3.org/2000/svg'

export const PLATE = {
  pad: { wide: 10, narrow: 6 },
  /** the room the standing ring keeps over the ribbon */
  ring: { wide: 8, narrow: 6 },
  /** the painted height of one period */
  strip: { wide: 26, narrow: 22 },
  /** the blank between two periods, in pixels */
  gutter: 6,
  /** the ticks of every date, under the periods */
  ticks: { normal: 5, floor: 9, gap: 5 },
  /** the afterlife, on its own scale, under a blank */
  after: { gap: 36, height: 8 },
  /** the baseline of the life's two years under its ticks */
  years: 16,
  least: 3,
  name: { wide: 15, narrow: 14, floor: 14, margin: 6 },
  /** the tracking the ribbon's names carry, which the ruler adds back */
  tracking: .02,
  /** A PHONE HELD SIDEWAYS: the strip is the sheet's main thing. Its blocks
   * take the height the glass spares, and every name stands over its own
   * block on a leader, because at this width no block holds its name. */
  side: {
    /** the strip starts where the sheet's words start */
    pad: { x: 1, top: 8, bottom: 4 },
    /** the lowest and the tallest a block is drawn: the tallest is a press's own height */
    strip: { least: 26, most: 44 },
    /** one row of names, the rows they take first, and the rows a crowded life may take */
    row: 19, rows: 2, most: 3,
    /** a name's size, the air between two in a row, how far one may stand off its block's middle,
     * and how far inside its own ends its leader starts */
    name: { base: 15, floor: 13, gap: 12, nudge: 12, inset: 5 },
    /** the band between the names and the strip, which the ring stands in */
    ring: 12,
    /** the air a leader keeps to a name it passes and to the ring, and the air it is given where there is a choice */
    clear: 5, pin: 8, roomy: 16,
    after: { gap: 26, height: 10 },
  },
} as const

export interface LifePlateBand {
  id: string
  left: number
  right: number
  top: number
  height: number
  name: Bi
}

export interface LifePlate {
  element: SVGSVGElement
  width: number
  height: number
  /** where each period was drawn, for the presses laid over it */
  bands: readonly LifePlateBand[]
  /** the middle of the life strip, where a marker stands */
  strip: { top: number; height: number }
  /** where one date falls on the ribbon, or nothing for the afterlife */
  at(eventId: string): number | null
}

/** THE NAME IS MEASURED, NOT ESTIMATED. Copied from the plan's plate rather
 * than shared, because that module belongs to another hand; a name wider than
 * the segment it names reads as the name of the segment beside it, so each
 * one shrinks to fit and is left off when even the floor will not hold it. */
let ruler: CanvasRenderingContext2D | null | undefined
function nameWidth(words: string, px: number): number {
  ruler ??= document.createElement('canvas').getContext('2d')
  const face = getComputedStyle(document.documentElement).getPropertyValue('--sans').trim() || 'sans-serif'
  if (!ruler) return words.length * px * .54
  ruler.font = `${px}px ${face}`
  return ruler.measureText(words).width + words.length * px * PLATE.tracking
}
function nameSize(words: string, room: number, base: number, floor: number): number | null {
  for (let px = base; px >= floor; px -= .5) if (nameWidth(words, px) <= room - PLATE.name.margin) return px
  return null
}

interface Run { left: number; right: number }
interface OverName { left: number; right: number; row: number; lead: number }

/** Where a leader may touch its block: on a painted piece, under its own
 * name, clear of everything it must pass. The name's own middle where that
 * is free, else the middle of the free stretch nearest to it. */
function leadAt(pieces: readonly Run[], name: Run, barred: readonly Run[]): number | null {
  const inset = PLATE.side.name.inset
  let free: Run[] = pieces
    .map(piece => piece.right - piece.left >= 6 ? { left: piece.left + 2, right: piece.right - 2 } : { left: (piece.left + piece.right) / 2, right: (piece.left + piece.right) / 2 })
    .map(piece => ({ left: Math.max(piece.left, name.left + inset), right: Math.min(piece.right, name.right - inset) }))
    .filter(piece => piece.right >= piece.left)
  for (const bar of barred) free = free.flatMap(run => {
    if (bar.right <= run.left || bar.left >= run.right) return [run]
    return [{ left: run.left, right: bar.left }, { left: bar.right, right: run.right }].filter(part => part.right >= part.left)
  })
  if (!free.length) return null
  const middle = (name.left + name.right) / 2
  const near = (run: Run): number => middle < run.left ? run.left - middle : middle > run.right ? middle - run.right : 0
  const best = free.reduce((held, run) => near(run) < near(held) ? run : held)
  return near(best) === 0 ? middle : (best.left + best.right) / 2
}

/** One row of names, each as near its own place as the others and the
 * drawing's two ends allow: names that would meet move as one group, by the
 * least that parts them. Null where the row is wider than the drawing. */
function settleRow(names: readonly { ideal: number; width: number }[], bounds: Run, gap: number): number[] | null {
  interface Group { first: number; width: number; sum: number; count: number }
  const at = (group: Group): number => Math.min(Math.max(group.sum / group.count, bounds.left), bounds.right - group.width)
  const groups: Group[] = []
  for (const [index, name] of names.entries()) {
    let group: Group = { first: index, width: name.width, sum: name.ideal, count: 1 }
    for (let before = groups[groups.length - 1]; before && at(before) + before.width + gap > at(group); before = groups[groups.length - 1]) {
      const offset = before.width + gap
      group = { first: before.first, width: offset + group.width, sum: before.sum + group.sum - group.count * offset, count: before.count + group.count }
      groups.pop()
    }
    if (group.width > bounds.right - bounds.left + .5) return null
    groups.push(group)
  }
  const lefts: number[] = []
  for (const group of groups) {
    let left = at(group)
    for (let index = group.first; index < group.first + group.count; index++) { lefts.push(left); left += names[index]!.width + gap }
  }
  return lefts
}

/** EVERY NAME OVER ITS OWN BLOCK, at the largest size and in the fewest rows
 * that hold them all. Every way of sharing the names between the rows is
 * tried, and the one kept has no name far off its block's middle, no two
 * meeting and no leader through a name or the ring; of those, the fewest
 * rows, then the least moved, then the leaders with the most air. No name is
 * left off. */
function namesOver(
  blocks: readonly { words: string; from: number; to: number; pieces: readonly Run[] }[],
  bounds: Run, pin: number | null,
): { size: number; rows: number; names: OverName[] } | null {
  const side = PLATE.side
  // every sharing is tried, so a life of many periods keeps the wide form's names
  if (!blocks.length || blocks.length > 8) return null
  for (const rows of [side.rows, side.most]) for (let size: number = side.name.base; size >= side.name.floor; size -= .5) {
    const widths = blocks.map(block => nameWidth(block.words, size))
    const ideals = blocks.map((block, index) => Math.min(Math.max((block.from + block.to) / 2 - widths[index]! / 2, bounds.left), bounds.right - widths[index]!))
    let best: { cost: number; names: OverName[] } | null = null
    for (let code = 0; code < rows ** blocks.length; code++) {
      const row = blocks.map((_, index) => Math.floor(code / rows ** index) % rows)
      const names: OverName[] = blocks.map((_, index) => ({ left: 0, right: 0, row: row[index]!, lead: 0 }))
      let moved = 0, fits = true
      for (let r = 0; r < rows && fits; r++) {
        const own = blocks.map((_, index) => index).filter(index => row[index] === r)
        const lefts = settleRow(own.map(index => ({ ideal: ideals[index]!, width: widths[index]! })), bounds, side.name.gap)
        if (!lefts) { fits = false; break }
        for (const [n, index] of own.entries()) {
          const shift = Math.abs(lefts[n]! - ideals[index]!)
          if (shift > side.name.nudge) fits = false
          moved += shift
          names[index]!.left = lefts[n]!
          names[index]!.right = lefts[n]! + widths[index]!
        }
      }
      if (!fits) continue
      for (const [index, name] of names.entries()) {
        const barred = names.filter(other => other.row < name.row).map(other => ({ left: other.left - side.clear, right: other.right + side.clear }))
        if (pin !== null) barred.push({ left: pin - side.pin, right: pin + side.pin })
        const lead = leadAt(blocks[index]!.pieces, name, barred)
        if (lead === null) { fits = false; break }
        name.lead = lead
      }
      if (!fits) continue
      // a leader squeezed between two names reads as a rule between them
      let tight = 0
      for (const name of names) for (const other of names) {
        if (other.row >= name.row) continue
        const air = name.lead < other.left ? other.left - name.lead : name.lead > other.right ? name.lead - other.right : 0
        tight += Math.max(0, side.roomy - air)
      }
      const used = Math.max(...row) + 1
      const cost = used * 1e6 + Math.round(moved) * 1000 + Math.round(tight) * 10 + row.reduce((sum, r) => sum + r, 0)
      if (!best || cost < best.cost) best = { cost, names }
    }
    if (best) return { size, rows: Math.max(...best.names.map(name => name.row)) + 1, names: best.names }
  }
  return null
}

/** The afterlife has its own linear scale: five centuries cannot share an
 * axis with sixty seven years and leave either of them readable. */
function afterScale(years: readonly number[]): { at(year: number): number; from: number; to: number } {
  const from = Math.min(...years), to = Math.max(...years)
  const width = Math.max(1, to - from)
  return { at: (year: number) => Math.max(0, Math.min(1, (year - from) / width)), from, to }
}

/** The pieces of a segment that the record actually reaches: a stretch of
 * empty years interrupts the bar instead of being painted over it. */
function pieces(left: number, right: number, gaps: readonly { left: number; right: number }[]): { left: number; right: number }[] {
  let runs = [{ left, right }]
  for (const gap of gaps) {
    const next: { left: number; right: number }[] = []
    for (const run of runs) {
      if (gap.right <= run.left || gap.left >= run.right) { next.push(run); continue }
      if (gap.left > run.left) next.push({ left: run.left, right: gap.left })
      if (gap.right < run.right) next.push({ left: gap.right, right: run.right })
    }
    runs = next
  }
  return runs.filter(run => run.right - run.left >= 1)
}

export function drawLifePlate(options: {
  record: LifeRecord
  scale: LifeScale
  area: { width: number }
  language: 'en' | 'de'
  narrow: boolean
  /** the period that is open, drawn lit while the others are quiet */
  open: string | null
  /** the date being read, where the marker stands */
  at: string | null
  /** the museum's word for the strip under the blank */
  /** the museum's words for the strip under the blank, with {from} and {to} */
  afterWords: string
  /** a phone held sideways, with the height the sheet has for the drawing */
  side?: { room: number }
}): LifePlate {
  const { record, scale, language, narrow, open } = options
  const width = Math.max(240, Math.round(options.area.width))
  const after = record.bands.find(band => band.afterlife)
  const afterEvents = after ? record.events.filter(event => event.band === after.id) : []
  const afterYears = afterEvents.map(event => dateYears(event.date)?.from).filter((year): year is number => year !== undefined)
  const hasAfter = Boolean(after && afterYears.length)
  const sideways = Boolean(options.side) && !narrow
  const pad = sideways ? PLATE.side.pad.x : narrow ? PLATE.pad.narrow : PLATE.pad.wide
  /* ON A PHONE A NAME NO PIECE HOLDS STANDS OVER THE RIBBON, at its own
     segment's middle: written across the pieces it would hide their edges.
     The row is only there when a name needs it. */
  const overSize = PLATE.name.narrow
  const living = record.bands.filter(band => !band.afterlife)
  const left = pad, span = Math.max(40, width - pad * 2)
  const x = (year: number): number => left + scale.at(year) * span
  const edge = (band: LifeBand, next: LifeBand | undefined): number =>
    next ? (x(band.years.to + 1) + x(next.years.from)) / 2 : x(band.years.to + 1)
  const gapRuns = scale.gaps.map((gap: LifeGap) => ({ left: x(gap.from), right: x(gap.to + 1), years: gap.years }))
  const naming = (index: number, band: LifeBand) => {
    const start = index === 0 ? x(band.years.from) : edge(living[index - 1]!, band)
    const end = edge(band, living[index + 1])
    const from = start + PLATE.gutter / 2, to = Math.max(start + PLATE.least, end - PLATE.gutter / 2)
    const widest = pieces(from, to, gapRuns).reduce<{ left: number; right: number } | null>(
      (held, piece) => !held || piece.right - piece.left > held.right - held.left ? piece : held, null)
    const words = band.place[language]
    const base = narrow ? PLATE.name.narrow : PLATE.name.wide
    const held = widest !== null && nameSize(words, widest.right - widest.left, base, PLATE.name.floor) !== null
    const run = held ? widest : { left: from, right: to }
    const size = run ? nameSize(words, run.right - run.left, base, PLATE.name.floor) : null
    return { from, to, words, held, run, size, over: narrow && !held && size !== null }
  }
  const overRow = living.some((band, index) => naming(index, band).over) ? overSize + 8 : 0
  /* SIDEWAYS, THE NAMES ARE PLACED FIRST: the rows they take and what is left
     of the sheet's room decide how tall a block is drawn. The ring's place is
     read early, so no leader runs through it. */
  const here = record.here ? record.events.find(event => event.id === record.here) : undefined
  const hereYears = here && !record.bands.find(band => band.id === here.band)?.afterlife ? dateYears(here.date) : null
  const flown = sideways
    ? namesOver(living.map((band, index) => { const { from, to, words } = naming(index, band); return { words, from, to, pieces: pieces(from, to, gapRuns) } }),
      { left, right: left + span }, hereYears ? x(hereYears.from) : null)
    : null
  const side = flown ? PLATE.side : null
  const afterGap = side ? side.after.gap : PLATE.after.gap, afterHeight = side ? side.after.height : PLATE.after.height
  const top = side ? side.pad.top + flown!.rows * side.row + side.ring : pad + overRow + (narrow ? PLATE.ring.narrow : PLATE.ring.wide)
  const under = 3 + PLATE.ticks.floor + PLATE.years + (hasAfter ? afterGap + afterHeight : 4) + (side ? side.pad.bottom : pad)
  const stripHeight = side
    ? Math.round(Math.min(side.strip.most, Math.max(side.strip.least, options.side!.room - top - under)))
    : narrow ? PLATE.strip.narrow : PLATE.strip.wide
  const ticksTop = top + stripHeight + 3
  // the life's own two years stand under its ticks, one row of type
  const lifeYears = ticksTop + PLATE.ticks.floor + PLATE.years
  const afterTop = lifeYears + afterGap
  const height = top + stripHeight + under

  const svg = document.createElementNS(NS, 'svg')
  svg.setAttribute('class', 'wing-life-plate')
  svg.setAttribute('width', String(width))
  svg.setAttribute('height', String(height))
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('focusable', 'false')
  const add = <K extends keyof SVGElementTagNameMap>(tag: K, attributes: Record<string, string | number>, parent: SVGElement = svg): SVGElementTagNameMap[K] => {
    const node = document.createElementNS(NS, tag)
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value))
    parent.append(node)
    return node
  }

  // what one full year is worth in pixels, for the instruments that read the
  // drawing back: the last year of the life is never inside an empty stretch
  svg.dataset['year'] = (x(record.span.to + 1) - x(record.span.to)).toFixed(2)

  /* THE PERIODS, EACH TO ITS DECLARED BOUNDS. Two periods that name the same
     year of a move share it, so the boundary between them is drawn in the
     middle of that year and neither bar runs under the other. */
  const bands: LifePlateBand[] = []
  const overTaken: { l: number; r: number }[] = []
  for (const [index, band] of living.entries()) {
    const { from, to, words, run, size, over } = naming(index, band)
    const lit = band.id === open
    /* The declared bounds and where the scale puts them travel with the
       drawing, so a machine can read whether a segment spans what the record
       says it spans instead of judging it from pixels. */
    const group = add('g', { class: 'wing-life-segment', 'data-open': String(lit), 'data-band': band.id,
      'data-years': `${band.years.from} ${band.years.to}`,
      'data-bounds': `${x(band.years.from).toFixed(1)} ${x(band.years.to + 1).toFixed(1)}` })
    for (const run of pieces(from, to, gapRuns))
      add('rect', { class: 'wing-life-period', x: run.left, y: top, width: Math.max(PLATE.least, run.right - run.left), height: stripHeight, rx: 1 }, group)
    // the break is bridged by a rule, so the years are visibly there and the
    // record visibly is not
    for (const gap of gapRuns) {
      const bridgeFrom = Math.max(from, gap.left), bridgeTo = Math.min(to, gap.right)
      if (bridgeTo - bridgeFrom < 1) continue
      add('line', { class: 'wing-life-break', 'data-years': gap.years, x1: bridgeFrom, y1: top + stripHeight / 2, x2: bridgeTo, y2: top + stripHeight / 2 }, group)
    }
    /* THE NAME STANDS ON THE WIDEST PIECE, never across a break: a name laid
       over the middle of an interrupted segment sits on the empty years.
       A name no piece holds is written across the whole segment rather than
       dropped, because a period with no name reads as no period. Where it
       crosses a break it carries a halo in its own segment's ink, so the
       dashes under it never run through the letters; on a phone it stands
       over the ribbon instead. */
    const high = flown?.names[index]
    if (high && side) {
      /* SIDEWAYS: over its own block, on a leader that touches a painted
         piece of it, so a name wider than its block is still that block's. */
      const base = side.pad.top + (flown!.rows - 1 - high.row) * side.row + side.name.base * .93
      add('line', { class: 'wing-life-lead', x1: high.lead.toFixed(1), y1: base + 4, x2: high.lead.toFixed(1), y2: top - 1 }, group)
      const text = add('text', { class: 'wing-life-place', 'data-over': 'true', x: ((high.left + high.right) / 2).toFixed(1), y: base, 'font-size': flown!.size }, group)
      text.textContent = words
    } else if (over) {
      const w = nameWidth(words, overSize)
      const middle = Math.min(Math.max((from + to) / 2, left + w / 2), left + span - w / 2)
      const room = { l: middle - w / 2 - 6, r: middle + w / 2 + 6 }
      if (!overTaken.some(held => held.l < room.r && room.l < held.r)) {
        const text = add('text', { class: 'wing-life-place', 'data-over': 'true', x: middle, y: pad + overSize * .82, 'font-size': overSize }, group)
        text.textContent = words
        overTaken.push(room)
      }
    } else if (run && size !== null) {
      const text = add('text', { class: 'wing-life-place', x: (run.left + run.right) / 2, y: top + stripHeight / 2 + size * .36, 'font-size': size }, group)
      text.textContent = words
    }
    bands.push({ id: band.id, left: from, right: to, top, height: stripHeight, name: band.name })
  }

  /* EVERY DATE AS ONE THIN TICK. One drawing for six dates and for four
     hundred: where ticks coincide the strip darkens, and the ones the floor
     cuts stand taller, so the ribbon says at a glance how much of the record
     is underfoot. */
  const seen = new Map<number, number>()
  const at = new Map<string, number>()
  for (const event of record.events) {
    if (record.bands.find(band => band.id === event.band)?.afterlife) continue
    const years = dateYears(event.date)
    if (!years) continue
    const place = x(years.from)
    at.set(event.id, place)
    const key = Math.round(place)
    seen.set(key, (seen.get(key) ?? 0) + 1)
    const floor = Boolean(event.walk && 'stud' in event.walk)
    const tick = add('line', { class: floor ? 'wing-life-tick wing-life-tick-floor' : 'wing-life-tick',
      x1: place, y1: ticksTop, x2: place, y2: ticksTop + (floor ? PLATE.ticks.floor : PLATE.ticks.normal) })
    tick.style.opacity = String(Math.min(1, .34 + (seen.get(key) ?? 1) * .22))
  }

  /* THE HOUR THE WING STANDS IN, as a ring on the ribbon, and the date being
     read, as a hairline that slides between them. */
  if (record.here) {
    const place = at.get(record.here)
    if (place !== undefined) {
      // over the ribbon, never on it: a ring around a segment would sit on
      // that segment's own name
      const ring = add('g', { class: 'wing-life-standing' })
      add('circle', { class: 'wing-life-standing-ring', cx: place, cy: top - 5, r: 3.6 }, ring)
      add('line', { class: 'wing-life-standing-stem', x1: place, y1: top - 2, x2: place, y2: top + 2 }, ring)
    }
  }
  /* The marker crosses a lit segment and the dark ground alike, so it is two
     lines: a dark one the width of the gold, and the gold inside it. */
  const marker = add('g', { class: 'wing-life-marker' })
  for (const cls of ['wing-life-marker-back', 'wing-life-marker-core'])
    add('line', { class: cls, x1: 0, y1: top, x2: 0, y2: ticksTop + PLATE.ticks.floor }, marker)
  const markerAt = options.at ? at.get(options.at) : undefined
  if (markerAt === undefined) marker.setAttribute('opacity', '0')
  else marker.setAttribute('transform', `translate(${markerAt.toFixed(1)},0)`)

  /* EACH STRIP SAYS ITS OWN YEARS. The life's first and last year stand
     under its own ends, so the afterlife's years under it can never be read
     as the scale of the life above. */
  for (const [year, anchor] of [[record.span.from, 'start'], [record.span.to, 'end']] as const) {
    const node = add('text', { class: 'wing-life-life-year', x: anchor === 'start' ? left : left + span, y: lifeYears, 'text-anchor': anchor })
    node.textContent = String(year)
  }

  /* WHAT HAPPENED TO THE PAPERS AFTER IS NOT A PERIOD OF A LIFE: it stands
     apart, dimmer, on its own clock, and its one label says both of its years
     and that the clock is its own. */
  if (hasAfter && after) {
    const clock = afterScale(afterYears)
    const label = add('text', { class: 'wing-life-after-word', x: left, y: afterTop - 7 })
    label.textContent = fill(options.afterWords, { from: clock.from, to: clock.to })
    add('rect', { class: 'wing-life-after', x: left, y: afterTop, width: span, height: afterHeight, rx: 1 })
    for (const year of afterYears) {
      const place = left + clock.at(year) * span
      add('line', { class: 'wing-life-tick wing-life-tick-after', x1: place, y1: afterTop, x2: place, y2: afterTop + afterHeight })
    }
  }

  return { element: svg, width, height, bands, strip: { top, height: stripHeight }, at: (id: string) => at.get(id) ?? null }
}
