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

/** HOW SURE A THING IS, in the record's own key. The museum does not fix the
 * set: one life is documented, inferred or held by tradition, another is
 * documented, reported, inferred or disputed, and a module that named three
 * of them could not draw the second life. Every word and colour for a key
 * comes in through the record, so nothing under this folder says a certainty
 * out loud. */
export type Sure = string

/** What a wing says about one of its own certainty keys: the word on a date,
 * the same word inside a counted sentence, and the colour the floor already
 * cuts it in. */
export interface LifeSure {
  word: Bi
  /** the clause of the counted sentence, with {n} for the count */
  counted: Bi
  colour: string
}

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
  /** the short name alone, for the ribbon, where a name has a segment's room */
  place: Bi
  /** one cue sentence, the period in a line */
  line: Bi
  from: MuseumDate
  to: MuseumDate
  /** THE YEARS THE PERIOD IS DECLARED BETWEEN, which are not the years its
   * dates happen to fall in: a period named 1500 to 1506 whose last date is
   * 1504 is drawn to 1506, and the thin tail is the record growing thin. */
  years: { from: number; to: number }
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
  /** the dates, and how many of them stand under each key of the record */
  events: { total: number; by: Record<string, number> }
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
  /** The wing's own word for the door to the record behind one date, where
   * the wing holds such a layer. The view opens it and never draws it. */
  provenance?: Bi
  /** One step back up, the wing's own word for it. The year card closes into
   * the list it was opened from, and calling that Close beside the sheet's
   * own Close puts two of the same word one under the other on a phone. */
  back: Bi
}

export interface LifeRecord {
  bands: readonly LifeBand[]
  events: readonly LifeEvent[]
  works: readonly LifeWork[]
  people: readonly LifePerson[]
  words: LifeWingWords
  /** the event the wing's own hour stands on, where the view opens */
  here?: string
  /** The record's own certainty keys, in the order its counted sentence says
   * them, with the colours the wing already cuts them in. */
  sure: Record<string, LifeSure>
  /** the years the life itself runs between, the afterlife excluded */
  span: { from: number; to: number }
}
