/** THE DATES AS EXTENDED DATE/TIME FORMAT (ISO 8601-2, Levels 1 and 2), derived
 * from the sealed record rather than written into it: the record keeps its
 * own precision, end, alternatives and certainty, and this reads them.
 *
 * The qualifier follows the museum's certainty word: a documented date is
 * plain, an inferred or traditional one is uncertain (`?`), a date the record
 * gives as about is approximate (`~`), or both (`%`) where it is also not
 * documented. One of several recorded dates is a set
 * (`[a,b]`), an open side is `..`, a season is its Level 1 code. Every date
 * is read in the calendar the record names, and a bound is never converted:
 * the age beside a date is counted in the same calendar as the birth. */
import type { Stud } from './studs'

export interface DateBounds { earliest: string | null; latest: string | null }

const SEASONS: Record<string, { code: number; from: string; to: string }> = {
  spring: { code: 21, from: '03-01', to: '05-31' }, summer: { code: 22, from: '06-01', to: '08-31' },
  autumn: { code: 23, from: '09-01', to: '11-30' }, winter: { code: 24, from: '12-01', to: '12-31' },
}

const lastDay = (year: number, month: number): number => new Date(Date.UTC(year, month, 0)).getUTCDate()
/** The first and the last day a written date can mean. */
function span(date: string): { from: string; to: string } {
  const [year, month, day] = date.split('-')
  if (day) return { from: date, to: date }
  if (month) return { from: `${year}-${month}-01`, to: `${year}-${month}-${String(lastDay(+year!, +month)).padStart(2, '0')}` }
  return { from: `${year}-01-01`, to: `${year}-12-31` }
}
// The qualifier is the date's: a documented event can stand on an inferred date.
const qualifier = (stud: Stud): string => (stud.date_certainty ?? stud.certainty) === 'documented' ? '' : '?'
const season = (stud: Stud): (typeof SEASONS)[string] | undefined =>
  SEASONS[stud.date_label_en.split(' ')[0]!.toLowerCase()]

export function studEdtf(stud: Stud): string {
  const q = qualifier(stud)
  switch (stud.date_precision) {
    case 'circa': { const a = q ? '%' : '~'; return stud.date_end ? `${stud.date}${a}/${stud.date_end}${a}` : `${stud.date}${a}` }
    case 'range': return `${stud.date}${q}/${stud.date_end}${q}`
    case 'disputed': return `[${[stud.date, ...stud.date_alternatives.map(entry => entry.date)].join(',')}]`
    case 'after': return `[${stud.date}..]`
    case 'before_or_on': return `[..${stud.date}]`
    // one moment inside the span, not the span: a month whose name is half lost
    case 'within': return `[${stud.date}..${stud.date_end}]`
    case 'season': { const s = season(stud); return s ? `${stud.date}-${s.code}${q}` : `${stud.date}${q}` }
    default: return `${stud.date}${q}`
  }
}

/** THE SPAN THE LABEL NAMES, which the drawing, the order and the age read:
 * "about 1482" stands at 1482. The widened bounds a catalogue searches by are
 * `studLimits`. */
export function studBounds(stud: Stud): DateBounds {
  switch (stud.date_precision) {
    case 'circa': case 'range': case 'within': return { earliest: span(stud.date).from, latest: span(stud.date_end ?? stud.date).to }
    case 'disputed': {
      const all = [stud.date, ...stud.date_alternatives.map(entry => entry.date)].map(span)
      return { earliest: all.map(entry => entry.from).sort()[0]!, latest: all.map(entry => entry.to).sort().at(-1)! }
    }
    case 'after': return { earliest: span(stud.date).from, latest: null }
    case 'before_or_on': return { earliest: null, latest: stud.date }
    case 'season': { const s = season(stud); return s ? { earliest: `${stud.date}-${s.from}`, latest: `${stud.date}-${s.to}` } : { earliest: span(stud.date).from, latest: span(stud.date).to } }
    default: { const s = span(stud.date); return { earliest: s.from, latest: s.to } }
  }
}

/** HOW FAR "ABOUT" REACHES, in years each side. The width is the museum's
 * convention, not the source's, and it is printed beside the bounds. */
export const CIRCA_YEARS = 2

/** THE EARLIEST AND LATEST DAY FOR RETRIEVAL: an approximate date widens by
 * `CIRCA_YEARS` on each side, everything else is the named span. */
export function studLimits(stud: Stud): DateBounds {
  const named = studBounds(stud)
  if (stud.date_precision !== 'circa' || !named.earliest || !named.latest) return named
  const shift = (day: string, years: number): string => `${Number(day.slice(0, 4)) + years}${day.slice(4)}`
  return { earliest: shift(named.earliest, -CIRCA_YEARS), latest: shift(named.latest, CIRCA_YEARS) }
}

/** Whole years from one day to another, both in the same calendar. */
function years(birth: string, day: string): number {
  const [by, bm, bd] = birth.split('-').map(Number), [y, m, d] = day.split('-').map(Number)
  return y! - by! - (m! < bm! || (m === bm && d! < bd!) ? 1 : 0)
}

/** The age a date falls at, where every day it can mean gives the same one
 * and the life has not ended by it; null wherever it cannot be said. */
export function ageAt(stud: Stud, birth: Stud, death: Stud): number | null {
  const { earliest, latest } = studBounds(stud)
  if (!earliest || !latest || stud.calendar !== birth.calendar || latest > death.date || earliest < birth.date) return null
  const low = years(birth.date, earliest), high = years(birth.date, latest)
  // The day he was born is not a day he was of an age.
  return low === high && low > 0 ? low : null
}
