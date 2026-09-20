/* THE DISCLOSURES, VERBATIM. Two layers, one canon, and a machine that
   checks the page against it: stone at the door into the library, ink on
   every surface that carries an Echo. Nothing speaks at the fire, so the
   fire discloses nothing.

   These strings are the museum's promise and they are not paraphrased. The
   honesty check reads every disclosure on the frame and fails when one has
   drifted from this file, in either language, by a single character.

   Displayed text follows the house writing rules: no em or en dashes, no
   semicolons, short sentences. */

export type DisclosureKey = 'stone' | 'ink'

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
  /** the colophon on every surface an Echo appears on. No surface of the
      museum carries one today: the figure pane used to, and it now shows a
      public-domain likeness with its own credit instead of an Echo. The
      layer stays in the canon for the surface that speaks in a figure's
      voice, and the honesty check reads the canon either way. */
  ink: {
    en: 'An AI Echo · An interpretation, not a recording',
    de: 'Ein AI Echo · Eine Interpretation, keine Aufnahme',
  },
}

export const DISCLOSURE_KEYS = Object.keys(DISCLOSURES) as DisclosureKey[]

/** what the canon says in the language the page is set in */
export function disclosure(key: DisclosureKey, lang: 'en' | 'de' = 'en'): string {
  return DISCLOSURES[key][lang]
}
