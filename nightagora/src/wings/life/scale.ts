/** THE SCALE OF A LIFE, and the absences it makes visible.
 *
 * A life drawn to a plain year scale spends most of its width on years the
 * record says nothing about. So a year the record reaches keeps its full
 * width and a stretch of years it never reaches shrinks to one mark that says
 * how many years it holds. The shrinking is the honest part: the gap is drawn
 * and counted, never closed up as though the years were not there.
 *
 * Nothing here draws. The view asks for a position, the card asks for a
 * count, and both get the record's own arithmetic.
 */

import type { LifeCounts, LifeEvent, LifeWork } from './types'

/** A run of years no event of the record reaches. */
export interface LifeGap { from: number; to: number; years: number }

/** A stretch this long or longer is worth its own mark. */
const LEAST_GAP = 2
/** What an empty stretch costs on the axis, in the width of one year. */
const GAP_WIDTH = 2.4

export interface LifeScale {
  from: number
  to: number
  gaps: readonly LifeGap[]
  /** 0 to 1 across the life, with the empty stretches shrunk. */
  at(year: number): number
  /** The band a pair of years covers, as two positions. */
  between(from: number, to: number): { from: number; to: number }
}

/** The first and the last year a date can mean, or null where the record
 * leaves both sides open. */
export function dateYears(date: { earliest: string | null; latest: string | null }): { from: number; to: number } | null {
  const first = date.earliest ?? date.latest, last = date.latest ?? date.earliest
  if (!first || !last) return null
  const from = Number(first.slice(0, 4)), to = Number(last.slice(0, 4))
  return Number.isFinite(from) && Number.isFinite(to) ? { from: Math.min(from, to), to: Math.max(from, to) } : null
}

/** THE YEARS A WORK IS PLACED BETWEEN, or nothing. A register may date a work
 * to a century, and a bar from 1500 to 1599 laid over a life that ended in
 * 1519 claims the whole of it. A span wider than the life is therefore read
 * as what it is, no year for that work, and the work stands with the undated
 * ones instead of across the axis. */
export function workYears(work: LifeWork, life: { from: number; to: number }): { from: number; to: number } | null {
  const span = work.date ? dateYears(work.date) : null
  if (!span) return null
  return span.to - span.from > life.to - life.from ? null : span
}

/** Every year inside the span that at least one event reaches. */
function reached(events: readonly LifeEvent[], from: number, to: number): Set<number> {
  const years = new Set<number>()
  for (const event of events) {
    const span = dateYears(event.date)
    if (!span) continue
    for (let year = Math.max(from, span.from); year <= Math.min(to, span.to); year++) years.add(year)
  }
  return years
}

export function lifeGaps(events: readonly LifeEvent[], from: number, to: number): LifeGap[] {
  const years = reached(events, from, to), gaps: LifeGap[] = []
  let start: number | null = null
  for (let year = from; year <= to + 1; year++) {
    const empty = year <= to && !years.has(year)
    if (empty && start === null) start = year
    if (!empty && start !== null) {
      const length = year - start
      if (length >= LEAST_GAP) gaps.push({ from: start, to: year - 1, years: length })
      start = null
    }
  }
  return gaps
}

export function lifeScale(events: readonly LifeEvent[], span: { from: number; to: number }): LifeScale {
  const { from, to } = span
  const gaps = lifeGaps(events, from, to)
  const inGap = new Map<number, LifeGap>()
  for (const gap of gaps) for (let year = gap.from; year <= gap.to; year++) inGap.set(year, gap)
  /** The width of every year from the first to the last, in year widths. */
  const weights: number[] = []
  for (let year = from; year <= to; year++) {
    const gap = inGap.get(year)
    weights.push(gap ? GAP_WIDTH / gap.years : 1)
  }
  const running: number[] = [0]
  for (const weight of weights) running.push(running[running.length - 1]! + weight)
  const total = running[running.length - 1] || 1
  const at = (year: number): number => {
    const index = Math.max(0, Math.min(weights.length, Math.round(year) - from))
    return (running[index] ?? total) / total
  }
  return { from, to, gaps, at, between: (a, b) => ({ from: at(a), to: at(b + 1) }) }
}

export function lifeCounts(events: readonly LifeEvent[], works: readonly LifeWork[], span: { from: number; to: number }): LifeCounts {
  const by: Record<string, number> = {}
  for (const event of events) by[event.certainty] = (by[event.certainty] ?? 0) + 1
  const gaps = lifeGaps(events, span.from, span.to)
  const years = reached(events, span.from, span.to)
  const dated = works.filter(work => workYears(work, span)).length
  return {
    events: { total: events.length, by },
    works: { total: works.length, dated, undated: works.length - dated },
    emptyYears: span.to - span.from + 1 - years.size,
    longestGapYears: gaps.reduce((most, gap) => Math.max(most, gap.years), 0),
  }
}
