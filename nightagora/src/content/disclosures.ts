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
  /** the keeper discloses himself, in character, in his one line */
  voice: {
    en: '"I am an AI voice for the museum. An interpretation, not a person. Welcome to the Night Agora."',
    de: '"Ich bin die KI-Stimme des Museums. Eine Interpretation, kein Mensch. Willkommen in der Night Agora."',
  },
  /** the colophon on every surface an Echo appears on */
  ink: {
    en: 'An AI Echo · An interpretation, not a recording',
    de: 'Ein AI Echo · Eine Interpretation, keine Aufnahme',
  },
  /** The museum's own voice never claims to be a figure's Echo. */
  watchman: {
    en: 'An AI museum voice · An interpretation, not a person',
    de: 'Eine KI-Stimme des Museums · Eine Interpretation, kein Mensch',
  },
}

export const DISCLOSURE_KEYS = Object.keys(DISCLOSURES) as DisclosureKey[]

/** what the canon says in the language the page is set in */
export function disclosure(key: DisclosureKey, lang: 'en' | 'de' = 'en'): string {
  return DISCLOSURES[key][lang]
}
