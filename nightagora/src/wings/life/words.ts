/** THE MUSEUM'S OWN WORDS FOR THE LIFE VIEW. They belong to every wing and
 * not to one, so they stand here beside the components that show them and a
 * text seat finds all of them in one file. A wing's own words (its through
 * line, its bands, its people, the sentence about its own floor) come in
 * through the record, never from here.
 *
 * The counted sentences are templates the record fills: the numbers a visitor
 * reads are always the ones the record holds, so a sentence cannot drift away
 * from what is drawn above it.
 */

import type { Bi } from './types'

export const LIFE_WORDS = {
  /** The control in the wing's bar, a bare noun the way the bar's others are. */
  door: { en: 'Life', de: 'Leben' },
  close: { en: 'Close', de: 'Schließen' },
  /** The way back up from one date, on the reader that stands at it. */
  life: { en: 'The life', de: 'Das Leben' },
  /** Under the ribbon: why an empty stretch is drawn narrower than it is. */
  caption: {
    en: 'Empty years are drawn narrow. Every stretch stands in the list.',
    de: 'Leere Jahre sind schmal gezeichnet. Jede Strecke steht in der Liste.',
  },
  /** On a work of the open period that hangs in this wing. */
  wall: { en: 'See it on the wall', de: 'An der Wand ansehen' },
  /** A period the record names nobody in. What the middle row says when it
   * holds nothing is the wing's, beside that row's own name. */
  noPeople: {
    en: 'Nobody in this record is named in these years.',
    de: 'Niemand aus diesem Verzeichnis wird in diesen Jahren genannt.',
  },
  /** A life whose record holds no year at all: the ribbon is not drawn. */
  noYears: {
    en: 'No date in this record can be put on a year.',
    de: 'Kein Datum in diesem Verzeichnis lässt sich auf ein Jahr legen.',
  },
  walk: { en: 'Walk me there', de: 'Bring mich hin' },
  /** The strip under the blank, on its own clock: what happened to the work
   * after the life is not a period of that life. */
  after: { en: 'Afterwards', de: 'Danach' },
  /** THE EIGHTH ITEM OF THE SPINE: what the register cannot put on a year at
   * all. It is not a period of a life, so it stands after the afterlife, and
   * its works are counted in the wing's own word for what that row carries. */
  undated: { en: 'Without a year', de: 'Ohne Jahreszahl' },
  undatedCount: { en: '{n} {row}', de: '{n} {row}' },
  ask: { en: 'What came next?', de: 'Was kam danach?' },
  askShow: { en: 'Show me', de: 'Zeig es mir' },
  askSkip: { en: 'Skip', de: 'Überspringen' },
  askNote: {
    en: 'One guess, then the answer. Nothing is counted.',
    de: 'Einmal raten, dann die Antwort. Nichts wird gezählt.',
  },
} satisfies Record<string, Bi>

/** Two of the three facets, named for the controls that hold one of them at
 * a time. The middle row is named by the wing, because what it holds differs:
 * where it carries one register the row takes that register's own word, and a
 * row that gathered several kinds would be named for all of them. */
export const LIFE_ROW_WORDS = {
  places: { en: 'Places', de: 'Orte' },
  people: { en: 'People', de: 'Menschen' },
} satisfies Record<string, Bi>

/** WHAT A PERIOD HOLDS, on its item in the spine. Every date of the open
 * period is shown, so the count is what the closed ones say about themselves
 * and never a promise of more. */
export const LIFE_BAND_WORDS = {
  dates: { en: '{n} dates', de: '{n} Daten' },
  oneDate: { en: 'One date', de: 'Ein Datum' },
  noDate: { en: 'No date', de: 'Kein Datum' },
} satisfies Record<string, Bi>

/** HOW MANY OF A PERIOD'S WORKS HANG HERE. The museum counts what a visitor
 * can walk to, and says so where the works are listed. */
export const LIFE_WORKS_COUNT = {
  some: {
    en: '{shown} of these {total} hang in this wing.',
    de: '{shown} dieser {total} hängen in diesem Flügel.',
  },
  one: {
    en: 'One of these {total} hangs in this wing.',
    de: 'Eines dieser {total} hängt in diesem Flügel.',
  },
  none: {
    en: 'None of these hangs in this wing.',
    de: 'Keines davon hängt in diesem Flügel.',
  },
} satisfies Record<string, Bi>

/** THE COUNTED SENTENCES. Every count under a hundred is written as a word,
 * wherever it stands in the sentence; a year stays a numeral. The wing's own
 * counted sentence for the middle row is in its record, beside that row's
 * name, and is filled the same way. */
export const LIFE_COUNTS = {
  /** The head of the counted sentence; the clause for each certainty comes
   * from the record, so a life with four of them says four. */
  dates: {
    en: '{total} dates here. {counted}.',
    de: '{total} Daten hier. {counted}.',
  },
  emptyYears: {
    en: '{empty} of the {span} years from {from} to {to} hold no event in this record. The longest stretch is {longest} years.',
    de: '{empty} der {span} Jahre von {from} bis {to} tragen kein Ereignis in diesem Verzeichnis. Die längste Strecke ist {longest} Jahre lang.',
  },
  /** A stretch of empty years, shrunk to one mark that says what it holds. */
  gap: {
    en: '{years} years with nothing in this record.',
    de: '{years} Jahre, zu denen dieses Verzeichnis nichts hat.',
  },
} satisfies Record<string, Bi>

/** THE COUNTED CERTAINTIES, in the record's own order and its own words. A
 * key no date stands under is left out rather than counted as none. */
export function countedCertainties(sure: Record<string, { counted: Bi }>, by: Record<string, number>,
  language: 'en' | 'de'): string {
  const clauses: string[] = []
  for (const [key, words] of Object.entries(sure)) {
    const count = by[key] ?? 0
    if (count > 0) clauses.push(fill(words.counted[language], { n: spokenCount(count, language) }))
  }
  return clauses.join(', ')
}

const ONES: Record<'en' | 'de', readonly string[]> = {
  en: ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
    'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'],
  de: ['', 'ein', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun', 'zehn',
    'elf', 'zwölf', 'dreizehn', 'vierzehn', 'fünfzehn', 'sechzehn', 'siebzehn', 'achtzehn', 'neunzehn'],
}
const TENS: Record<'en' | 'de', readonly string[]> = {
  en: ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'],
  de: ['', '', 'zwanzig', 'dreißig', 'vierzig', 'fünfzig', 'sechzig', 'siebzig', 'achtzig', 'neunzig'],
}

/** A COUNT AS A PERSON SAYS IT, from two upward. Above ninety nine the numeral
 * is what a person says, so the numeral is what comes back.
 *
 * ONE AND NONE NEVER PASS THROUGH HERE. German inflects both with the gender
 * of the noun they count (ein Datum, eine Zeichnung, kein Bild), which this
 * module cannot know, so every counted sentence carries its own singular and
 * its own none, the way a period's date count carries `oneDate` and `noDate`.
 * A caller that asks anyway gets a numeral, which is visibly wrong in prose
 * rather than quietly ungrammatical. */
export function spokenCount(value: number, language: 'en' | 'de'): string {
  if (!Number.isInteger(value) || value < 2 || value > 99) return String(value)
  if (value < 20) return ONES[language][value] ?? String(value)
  const ten = TENS[language][Math.floor(value / 10)] ?? '', one = ONES[language][value % 10] ?? ''
  if (!one) return ten
  // German counts the unit first and joins it; English hyphenates.
  return language === 'de' ? `${one}und${ten}` : `${ten}-${one}`
}

/** A filled sentence starts with a capital, and so does the one after it: the
 * counts arrive as words and a word is not a capital. */
export function capitalise(text: string): string {
  return text.replace(/(^|[.!?]\s+)(\p{Ll})/gu, (_whole, lead: string, letter: string) => `${lead}${letter.toUpperCase()}`)
}

/** A template filled with what the record holds. A key written as a word is
 * spoken; one written as a numeral stays a numeral. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in values ? String(values[key]) : whole)
}
