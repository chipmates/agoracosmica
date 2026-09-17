/** THE LIFE AS ONE DRAWING: a year axis with the empty stretches shrunk, the
 * periods along it, and three lanes under it for places, works and people.
 *
 * The drawing is the picture and never the control. The dates of one life
 * stand a few pixels apart at any width a sheet has, so a mark here could not
 * be a 44 px target without covering its neighbours; the list beside the
 * plate takes every press, at both viewports. The plate is hidden from the
 * reading for the same reason: everything it shows is in that list.
 */

import { dateYears, type LifeScale } from './scale'
import type { LifeEvent, LifeRecord, LifeWork, Sure } from './types'

const NS = 'http://www.w3.org/2000/svg'

export const PLATE = {
  pad: 10,
  /** the axis strip with the periods and the gap marks */
  axis: 30,
  lane: 38,
  /** what the life keeps of the width, the rest being the afterlife */
  lifeShare: .76,
  /** the blank between the life and what happened to the papers after it */
  gutter: 18,
  least: 3,
} as const

export interface LifePlate {
  element: SVGSVGElement
  width: number
  height: number
}

/** The afterlife has its own linear scale: five centuries cannot share an
 * axis with sixty seven years and leave either of them readable. */
function afterScale(events: readonly LifeEvent[]): (year: number) => number {
  const years = events.map(event => dateYears(event.date)).filter(Boolean).map(span => span!.from)
  const from = Math.min(...years), to = Math.max(...years)
  const width = Math.max(1, to - from)
  return (year: number) => Math.max(0, Math.min(1, (year - from) / width))
}

export function drawLifePlate(options: {
  record: LifeRecord
  scale: LifeScale
  area: { width: number; height: number }
  /** the row a phone holds one of; every row on a wide stage */
  rows: readonly ('places' | 'works' | 'people')[]
}): LifePlate {
  const { record, scale, area, rows } = options
  const width = Math.max(240, Math.round(area.width))
  const height = PLATE.pad * 2 + PLATE.axis + rows.length * PLATE.lane
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
  const colour = (kind: Sure): string => record.sure[kind].colour

  const after = record.bands.find(band => band.afterlife)
  const afterEvents = after ? record.events.filter(event => event.band === after.id) : []
  const lifeWidth = Math.round((width - PLATE.pad * 2 - (after ? PLATE.gutter : 0)) * (after ? PLATE.lifeShare : 1))
  const afterLeft = PLATE.pad + lifeWidth + PLATE.gutter
  const afterWidth = Math.max(40, width - PLATE.pad - afterLeft)
  const x = (year: number): number => PLATE.pad + scale.at(year) * lifeWidth
  const place = afterScale(afterEvents.length ? afterEvents : record.events)
  const xAfter = (year: number): number => afterLeft + place(year) * afterWidth
  const top = PLATE.pad

  /* THE PERIODS along the axis, each in the colour of the weaker of its two
     bounds, and the afterlife apart, after the blank. */
  for (const band of record.bands) {
    const events = record.events.filter(event => event.band === band.id)
    const years = events.map(event => dateYears(event.date)).filter(Boolean) as { from: number; to: number }[]
    if (!years.length) continue
    const first = Math.min(...years.map(span => span.from)), last = Math.max(...years.map(span => span.to))
    const left = band.afterlife ? xAfter(first) : x(first)
    const right = band.afterlife ? xAfter(last) : x(last)
    const bar = add('rect', { class: 'wing-life-band', x: left, y: top, width: Math.max(PLATE.least, right - left), height: 11, rx: 1 })
    bar.style.fill = colour(band.certainty)
    if (band.afterlife) bar.setAttribute('data-afterlife', 'true')
    const label = add('text', { class: 'wing-life-year', x: left, y: top + 25 }, svg)
    label.textContent = String(first)
  }
  const last = record.span.to
  const end = add('text', { class: 'wing-life-year wing-life-year-end', x: x(last), y: top + 25 })
  end.textContent = String(last)

  /* AN EMPTY STRETCH IS DRAWN, NOT CLOSED UP: the years are there and the
     record is not, so the mark keeps its place on the axis and says how many
     years it stands for. */
  for (const gap of scale.gaps) {
    const left = x(gap.from), right = x(gap.to + 1)
    add('rect', { class: 'wing-life-gap', x: left, y: top - 2, width: Math.max(PLATE.least, right - left), height: 15 })
    const count = add('text', { class: 'wing-life-gap-count', x: (left + right) / 2, y: top + 25 })
    count.textContent = String(gap.years)
  }

  let lane = top + PLATE.axis
  const line = (y: number): void => { add('line', { class: 'wing-life-rule', x1: PLATE.pad, y1: y, x2: width - PLATE.pad, y2: y }) }

  for (const row of rows) {
    line(lane)
    const middle = lane + PLATE.lane / 2
    if (row === 'places') {
      for (const event of record.events) {
        const span = dateYears(event.date)
        if (!span) continue
        const afterlife = record.bands.find(band => band.id === event.band)?.afterlife
        const left = afterlife ? xAfter(span.from) : x(span.from)
        const right = afterlife ? xAfter(span.to) : x(span.to)
        if (right - left > PLATE.least) {
          const bar = add('rect', { class: 'wing-life-span', x: left, y: middle - 2, width: right - left, height: 4, rx: 2 })
          bar.style.fill = colour(event.certainty)
        }
        const dot = add('circle', { class: 'wing-life-event', cx: left, cy: middle, r: 3.4 })
        dot.style.fill = colour(event.certainty)
      }
    }
    if (row === 'works') {
      const dated = record.works.filter((work): work is LifeWork & { date: NonNullable<LifeWork['date']> } => Boolean(work.date))
      for (const [index, work] of dated.entries()) {
        const span = dateYears(work.date)
        if (!span) continue
        const left = x(span.from), right = x(span.to)
        // Works overlap in time, so they are stacked in three courses and
        // nothing is hidden under anything else.
        const y = middle - 9 + (index % 3) * 8
        add('rect', { class: 'wing-life-work', 'data-domain': work.domain, x: left, y, width: Math.max(PLATE.least, right - left), height: 5, rx: 2 })
      }
    }
    if (row === 'people') {
      for (const [index, person] of record.people.entries()) {
        const tied = person.events.map(id => record.events.find(event => event.id === id)).filter(Boolean) as LifeEvent[]
        const years = tied.map(event => dateYears(event.date)).filter(Boolean) as { from: number; to: number }[]
        if (!years.length) continue
        const left = x(Math.min(...years.map(span => span.from))), right = x(Math.max(...years.map(span => span.to)))
        const y = lane + 8 + (index % 4) * 7
        const bar = add('rect', { class: 'wing-life-tie', x: left, y, width: Math.max(PLATE.least, right - left), height: 3, rx: 1.5 })
        bar.style.fill = colour(person.certainty)
        for (const span of years) {
          const dot = add('circle', { class: 'wing-life-tie-dot', cx: x(span.from), cy: y + 1.5, r: 2.4 })
          dot.style.fill = colour(person.certainty)
        }
      }
    }
    lane += PLATE.lane
  }
  line(lane)
  if (after) add('line', { class: 'wing-life-break', x1: afterLeft - PLATE.gutter / 2, y1: top - 4, x2: afterLeft - PLATE.gutter / 2, y2: lane })

  return { element: svg, width, height }
}
