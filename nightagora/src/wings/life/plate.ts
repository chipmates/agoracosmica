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
}): LifePlate {
  const { record, scale, language, narrow, open } = options
  const width = Math.max(240, Math.round(options.area.width))
  const stripHeight = narrow ? PLATE.strip.narrow : PLATE.strip.wide
  const after = record.bands.find(band => band.afterlife)
  const afterEvents = after ? record.events.filter(event => event.band === after.id) : []
  const afterYears = afterEvents.map(event => dateYears(event.date)?.from).filter((year): year is number => year !== undefined)
  const hasAfter = Boolean(after && afterYears.length)
  const pad = narrow ? PLATE.pad.narrow : PLATE.pad.wide
  const top = pad + (narrow ? PLATE.ring.narrow : PLATE.ring.wide)
  const ticksTop = top + stripHeight + 3
  // the life's own two years stand under its ticks, one row of type
  const lifeYears = ticksTop + PLATE.ticks.floor + PLATE.years
  const afterTop = lifeYears + PLATE.after.gap
  const height = (hasAfter ? afterTop + PLATE.after.height : lifeYears + 4) + pad

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

  const left = pad, span = Math.max(40, width - pad * 2)
  const x = (year: number): number => left + scale.at(year) * span
  const living = record.bands.filter(band => !band.afterlife)
  // what one full year is worth in pixels, for the instruments that read the
  // drawing back: the last year of the life is never inside an empty stretch
  svg.dataset['year'] = (x(record.span.to + 1) - x(record.span.to)).toFixed(2)

  /* THE PERIODS, EACH TO ITS DECLARED BOUNDS. Two periods that name the same
     year of a move share it, so the boundary between them is drawn in the
     middle of that year and neither bar runs under the other. */
  const edge = (band: LifeBand, next: LifeBand | undefined): number =>
    next ? (x(band.years.to + 1) + x(next.years.from)) / 2 : x(band.years.to + 1)
  const gapRuns = scale.gaps.map((gap: LifeGap) => ({ left: x(gap.from), right: x(gap.to + 1), years: gap.years }))
  const bands: LifePlateBand[] = []
  for (const [index, band] of living.entries()) {
    const start = index === 0 ? x(band.years.from) : edge(living[index - 1]!, band)
    const end = edge(band, living[index + 1])
    const from = start + PLATE.gutter / 2, to = Math.max(start + PLATE.least, end - PLATE.gutter / 2)
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
       over the middle of an interrupted segment sits on the empty years. */
    const widest = pieces(from, to, gapRuns).reduce<{ left: number; right: number } | null>(
      (held, piece) => !held || piece.right - piece.left > held.right - held.left ? piece : held, null)
    const words = band.place[language]
    const base = narrow ? PLATE.name.narrow : PLATE.name.wide
    /* A name no piece holds is written across the whole segment rather than
       dropped, because a period with no name reads as no period. Where it
       crosses a break it carries a halo in its own segment's ink, so the
       dashes under it never run through the letters. */
    const held = widest !== null && nameSize(words, widest.right - widest.left, base, PLATE.name.floor) !== null
    const run = held ? widest : { left: from, right: to }
    const size = run ? nameSize(words, run.right - run.left, base, PLATE.name.floor) : null
    if (run && size !== null) {
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
    add('rect', { class: 'wing-life-after', x: left, y: afterTop, width: span, height: PLATE.after.height, rx: 1 })
    for (const year of afterYears) {
      const place = left + clock.at(year) * span
      add('line', { class: 'wing-life-tick wing-life-tick-after', x1: place, y1: afterTop, x2: place, y2: afterTop + PLATE.after.height })
    }
  }

  return { element: svg, width, height, bands, strip: { top, height: stripHeight }, at: (id: string) => at.get(id) ?? null }
}
