/** THE MUSEUM'S OWN WORDS FOR THE PLAN AND THE RECAP. They belong to every
 * wing and not to one, so they stand here beside the components that show
 * them and a text seat finds all of them in one file. A wing's own words (its
 * name, its rooms, its station names, its through line) come in through the
 * site and the recap's options, never from here. */

import type { Bi } from './types'

export const PLAN_WORDS = {
  /** the control in the wing's bar, beside the sources of the station */
  plan: { en: 'The plan', de: 'Der Plan' },
  close: { en: 'Close', de: 'Schließen' },
  /** read out beside a station a visitor has already stood at */
  stood: { en: 'stood here', de: 'hier gestanden' },
} satisfies Record<string, Bi>

export const RECAP_WORDS = {
  heading: { en: 'What you opened tonight', de: 'Was du heute Abend geöffnet hast' },
  prompt: { en: 'Press a title to see its sentence again.', de: 'Drück einen Titel, um seinen Satz wiederzusehen.' },
  promptPhone: { en: 'Tap a title to see its sentence again.', de: 'Tipp einen Titel an, um seinen Satz wiederzusehen.' },
  empty: {
    en: 'You have not opened anything yet. Every work in this wing carries one sentence worth keeping.',
    de: 'Du hast noch nichts geöffnet. Jedes Werk in diesem Flügel trägt einen Satz, den man behalten kann.',
  },
  another: { en: 'Another life', de: 'Ein anderes Leben' },
  privacy: {
    en: 'This list stays on your device. The museum keeps no account and sends nothing away.',
    de: 'Diese Liste bleibt auf deinem Gerät. Das Museum führt kein Konto und schickt nichts weg.',
  },
  forget: { en: 'Forget tonight', de: 'Heute Abend vergessen' },
} satisfies Record<string, Bi>

/** THE LOBBY'S OFFER, next visit. One form and many, in both languages, with
 * the count written into the sentence rather than set beside it. */
export const VISIT_OFFER = {
  one: {
    en: 'Last time you opened one work in this wing.',
    de: 'Beim letzten Mal hast du in diesem Flügel ein Werk geöffnet.',
  },
  many: {
    en: 'Last time you opened {n} works in this wing.',
    de: 'Beim letzten Mal hast du in diesem Flügel {n} Werke geöffnet.',
  },
  again: { en: 'See them again', de: 'Noch einmal ansehen' },
} satisfies Record<string, Bi>

/** The counts a visitor reads are written out, the way a person says them. */
const NUMBERS: Record<'en' | 'de', readonly string[]> = {
  en: ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
    'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'],
  de: ['', 'ein', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun', 'zehn',
    'elf', 'zwölf', 'dreizehn', 'vierzehn', 'fünfzehn', 'sechzehn', 'siebzehn', 'achtzehn', 'neunzehn', 'zwanzig'],
}

export function spokenCount(value: number, language: 'en' | 'de'): string {
  return NUMBERS[language][value] ?? String(value)
}

/** The offer's sentence for a record of this size, or null for an empty one. */
export function visitOfferLine(count: number, language: 'en' | 'de'): string | null {
  if (count <= 0) return null
  if (count === 1) return VISIT_OFFER.one[language]
  return VISIT_OFFER.many[language].replace('{n}', spokenCount(count, language))
}
