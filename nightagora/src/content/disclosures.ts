/* THE DISCLOSURES, VERBATIM. Three layers, one canon, and a machine that
   checks the page against it: stone at the threshold, voice in character at
   the fire, ink on every surface that carries an Echo.

   These strings are the museum's promise and they are not paraphrased. The
   honesty check reads every disclosure on the frame and fails when one has
   drifted from this file, in either language, by a single character.

   Displayed text follows the house writing rules: no em or en dashes, no
   semicolons, short sentences. */

export type DisclosureKey = 'stone' | 'voice' | 'ink'

export interface DisclosureLine {
  en: string
  de: string
}

export const DISCLOSURES: Record<DisclosureKey, DisclosureLine> = {
  /** passed on arrival: what the whole night is, before anyone speaks */
  stone: {
    en: 'Every voice here is an AI Echo: an interpretation built from what each person left behind. Not recordings. Not the dead themselves.',
    de: 'Jede Stimme hier ist ein AI Echo: eine Interpretation aus dem, was der Mensch hinterlassen hat. Keine Aufnahmen. Nicht die Toten selbst.',
  },
  /** the keeper discloses himself, in character, in his one line */
  voice: {
    en: '"I am not Marcus. I am an echo of what he left behind. Sit anyway."',
    de: '"Ich bin nicht Marcus. Ich bin ein Echo dessen, was er hinterlassen hat. Setz dich trotzdem."',
  },
  /** the colophon on every surface an Echo appears on */
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
