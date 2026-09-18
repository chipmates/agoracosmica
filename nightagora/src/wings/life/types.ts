/** WHAT A WING HANDS THE LIFE VIEW. One life read as three parallel facets,
 * places, works and people, so nothing under this folder knows which life it
 * is drawing: a wing passes its own record and the view draws it, which is
 * what lets the second wing have a life view without a second one being
 * written.
 *
 * Every date carries the calendar it was written in and is never converted.
 * The earliest and latest bounds are for sorting and for the age only, and a
 * date the record leaves open has none.
 */

export interface Bi { en: string; de: string }

/** The museum's three words for how sure a thing is. */
export type Sure = 'documented' | 'inferred' | 'tradition'

export interface MuseumDate {
  /** Extended Date/Time Format, derived from the record, never retyped. */
  edtf: string
  calendar: string
  /** proleptic, for sorting and the age; null where the record leaves it open */
  earliest: string | null
  latest: string | null
  /** the record's own written date, in its own words */
  label: Bi
  certainty: Sure
}

export interface LifeBand {
  id: string
  /** named by place and by the years the period runs between */
  name: Bi
  /** one cue sentence, the period in a line */
  line: Bi
  from: MuseumDate
  to: MuseumDate
  /** the weaker of its two bounds */
  certainty: Sure
  /** what a closed band shows: four is what a boundary carries */
  first: readonly string[]
  /** The rows after a death are the reception of the work, not a period of a
   * life, so the view draws them apart. */
  afterlife?: true
}

export interface LifeEvent {
  id: string
  band: string
  date: MuseumDate
  certainty: Sure
  /** the record's own sentence */
  line: Bi
  /** the record's own reading of where the sentence comes from */
  source: Bi | null
  age: number | null
  ageApproximate: boolean
  /** the twelve that are cut into a floor carry a stud, the rest a station */
  walk: { stud: string } | { station: string } | null
  exhibit: string | null
  people: readonly string[]
}

export interface LifeWork {
  id: string
  title: Bi
  /** null is not a guess: an undated work stands apart and never on the axis */
  date: MuseumDate | null
  domain: 'painting' | 'sheet' | 'machine' | 'codex' | 'building'
  state: 'shown' | 'reproduction' | 'absent'
  exhibit: string | null
}

export interface LifePerson {
  id: string
  name: Bi
  /** the tie, in the record's own terms */
  role: Bi
  certainty: Sure
  /** the events of the record this tie rests on */
  events: readonly string[]
}

export interface LifeCounts {
  events: { total: number; documented: number; inferred: number; tradition: number }
  works: { total: number; dated: number; undated: number }
  emptyYears: number
  longestGapYears: number
}

/** The wing's own sentences: the ones that name this life and this house and
 * cannot be written once for every wing. */
export interface LifeWingWords {
  /** the wing's one sentence, the same in the welcome and at the exit */
  throughLine: Bi
  /** the view's own second line, under it */
  secondLine: Bi
  /** the honesty line at the foot, the floor's own */
  honesty: Bi
  /** what a date the floor does not carry says instead of offering a walk */
  notCut: Bi
  /** The middle row's name, in the word the wing's own register uses for
   * what it holds, and that row's counted sentence in the same grammar as
   * the museum's others. */
  worksRow: Bi
  worksCount: Bi
  /** The age beside a year, in the wing's own words, so the reader that
   * stands at a date and this view say it from one place. */
  age: { exact: Bi; about: Bi }
}

export interface LifeRecord {
  bands: readonly LifeBand[]
  events: readonly LifeEvent[]
  works: readonly LifeWork[]
  people: readonly LifePerson[]
  words: LifeWingWords
  /** The museum's three words and the colours the wing already cuts them in,
   * so the view says certainty in the same colour the floor does. */
  sure: Record<Sure, { word: Bi; colour: string }>
  /** the years the life itself runs between, the afterlife excluded */
  span: { from: number; to: number }
}

/** The three facets, in the order the view reads them. */
export const LIFE_ROWS = ['places', 'works', 'people'] as const
export type LifeRow = (typeof LIFE_ROWS)[number]
