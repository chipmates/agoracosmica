/* THE DISCLOSURES, VERBATIM. Three layers, one canon, and a machine that
   checks the page against it: stone at the threshold, voice in character at
   the fire, ink on every surface that carries an Echo.

   These strings are the museum's promise and they are not paraphrased. The
   honesty check reads every disclosure on the frame and fails when one has
   drifted from this file, in either language, by a single character.

   Displayed text follows the house writing rules: no em or en dashes, no
   semicolons, short sentences. */

export type DisclosureKey = 'stone' | 'voice' | 'ink' | 'watchman'

export interface DisclosureLine {
  en: string
  de: string
}

export const DISCLOSURES: Record<DisclosureKey, DisclosureLine> = {
  /** passed on arrival: what the whole night is, before anyone speaks */
  stone: {
    en: 'The historical figures speak as AI Echoes: interpretations built from what each person left behind. Not recordings. Not the dead themselves.',
    de: 'Die historischen Persönlichkeiten sprechen als AI Echoes: Interpretationen dessen, was sie hinterlassen haben. Keine Aufnahmen. Nicht die Toten selbst.',
  },
  /** the watchman's one line at the fire: the museum's own introduction,
      written in advance; no figure speaks here, so no Echo is disclosed */
  voice: {
    en: '"Welcome to the Night Agora. Thirty lives, each kept in the place they lived, at a real hour of a real day. Every visit begins at this fire."',
    de: '"Willkommen in der Night Agora. Dreißig Leben, jedes an dem Ort, an dem es gelebt wurde, zu einer wirklichen Stunde eines wirklichen Tages. Jeder Besuch beginnt an diesem Feuer."',
  },
  /** the colophon on every surface an Echo appears on */
  ink: {
    en: 'An AI Echo · An interpretation, not a recording',
    de: 'Ein AI Echo · Eine Interpretation, keine Aufnahme',
  },
  /** the line under the watchman: what the museum is and what a visitor
      does in it; no figure speaks here, so nothing is disclosed */
  watchman: {
    en: 'Thirty wings, one for each life · Walk their place, look closer, ask them',
    de: 'Dreißig Flügel, einer für jedes Leben · Geh durch ihren Ort, sieh genauer hin, frag sie',
  },
}

export const DISCLOSURE_KEYS = Object.keys(DISCLOSURES) as DisclosureKey[]

/** what the canon says in the language the page is set in */
export function disclosure(key: DisclosureKey, lang: 'en' | 'de' = 'en'): string {
  return DISCLOSURES[key][lang]
}
