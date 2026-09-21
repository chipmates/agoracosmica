/* THE STORY THE WORDS READ. The wing's own story layer, narrowed to the four
   things the chrome displays: the chapter title, the age clock, the line, and
   how sure the line is. Nothing else of that layer is read here, so a field
   that changes shape in the story file cannot break the chrome.

   TWO THINGS ARE TRANSLATED HERE AND NOT THERE. The story classes a stop in
   seven words and the museum draws four marks, so the three the marks do not
   have fall to the nearest one they do. And the story's clock is the card's
   own raw words, whose German still carries the English, so the clock is
   built from the wing's own age strings and the number the story gives. Both
   are named in this seat's STATUS for the text owner. */

import cardsSource from './vinci/data/cards.json?raw'
import { vinciStory, type VinciStoryCertainty } from './vinci/story'
import type { VinciCertainty, VinciText } from './vinci/content'

export interface DeskStoryStop {
  id: string
  order: number
  /** a stop the spine walks past: it carries a line and no age */
  quiet: boolean
  chapter: VinciText
  age: VinciText | null
  line: VinciText
  /** the least sure claim of the line, which is what the mark shows */
  certainty: VinciCertainty
}

const AGE_WORDS = (JSON.parse(cardsSource) as {
  controls: { date: { age: VinciText; age_about: VinciText } }
}).controls.date

/** The four the museum's marks carry, from the seven the story classes in. */
function sureness(said: VinciStoryCertainty): VinciCertainty {
  switch (said) {
    case 'documented': return 'documented'
    case 'inferred': case 'reconstructed': return 'reconstructed'
    case 'tradition': case 'conjectural': return 'conjectural'
    default: return 'unknown'
  }
}

/* The clock's words are the wing's, the number is the story's. A stop whose
   clock the wing has no words for shows none: at the birth there is no age a
   German sentence would give, and the line says the year itself. */
function clock(said: VinciText | null): VinciText | null {
  const years = /-?\d+/.exec(said?.en ?? '')
  if (!said || !years) return null
  const value = Number(years[0])
  if (value <= 0) return null
  const pattern = /\babout\b|\bnear\b/.test(said.en) ? AGE_WORDS.age_about : AGE_WORDS.age
  return {
    en: pattern.en.replace('{years}', String(value)),
    de: pattern.de.replace('{years}', String(value)),
  }
}

export const deskStory: readonly DeskStoryStop[] = vinciStory
  .filter(stop => stop.kind === 'station')
  .map(stop => ({
    id: stop.id,
    order: stop.order,
    quiet: stop.quiet,
    chapter: stop.chapter,
    age: clock(stop.age),
    line: stop.line,
    certainty: sureness(stop.certainty),
  }))

const byId = new Map(deskStory.map(stop => [stop.id, stop]))

export function deskStoryStop(id: string): DeskStoryStop | undefined {
  return byId.get(id)
}
