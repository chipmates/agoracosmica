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
  walk: { en: 'Walk me there', de: 'Bring mich hin' },
  /** The works with no date in the record, grouped rather than guessed at. */
  undated: { en: 'Without a date', de: 'Ohne Datum' },
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

/** A band shows four dates closed and all of them open. The control says how
 * many are still folded away, never how many were missed. */
export const LIFE_BAND_WORDS = {
  more: { en: '{n} more', de: '{n} weitere' },
  fewer: { en: 'Fewer', de: 'Weniger' },
} satisfies Record<string, Bi>

/** THE COUNTED SENTENCES. Every count under a hundred is written as a word,
 * wherever it stands in the sentence; a year stays a numeral. The wing's own
 * counted sentence for the middle row is in its record, beside that row's
 * name, and is filled the same way. */
export const LIFE_COUNTS = {
  dates: {
    en: '{total} dates here. {documented} documented, {inferred} inferred, {tradition} from tradition.',
    de: '{total} Daten hier. {documented} belegt, {inferred} erschlossen, {tradition} aus Überlieferung.',
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

/** A count as a person says it. Above ninety nine the numeral is what a person
 * says, so the numeral is what comes back. */
export function spokenCount(value: number, language: 'en' | 'de'): string {
  if (!Number.isInteger(value) || value < 0 || value > 99) return String(value)
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
