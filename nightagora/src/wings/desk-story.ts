/* THE STORY THE WORDS READ. The chrome displays four things per stop: the
   chapter title, the age clock, the line, and how sure the line is. Nothing
   else of the story layer is read here, so a field that changes shape in the
   wing's own file cannot break the chrome.

   THE SEAM. When the wing's story file lands, the body below becomes one
   import and one map:

     import { vinciStory } from './vinci/story'
     const stops = vinciStory.filter(stop => stop.kind === 'station')
       .map(stop => ({ id: stop.id, order: stop.order, quiet: stop.quiet,
         chapter: stop.chapter, age: stop.age, line: stop.line,
         certainty: stop.certainty }))

   and the fixture goes. Its lines are copied from the same source the wing's
   file is copied from, so the two cannot disagree while both stand. */

import cardsSource from './vinci/data/cards.json?raw'
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

/* THE AGE IS THE WING'S OWN STRING, never typed here: the story carries the
   number, the wing carries the words. `near` has no string of its own yet and
   borrows the about one until the text owner gives it one. */
type AgeShape = { years: number; shape: 'exact' | 'about' | 'near' } | null
const AGE_WORDS = (JSON.parse(cardsSource) as {
  controls: { date: { age: VinciText; age_about: VinciText } }
}).controls.date

function ageText(age: AgeShape): VinciText | null {
  if (!age) return null
  const pattern = age.shape === 'exact' ? AGE_WORDS.age : AGE_WORDS.age_about
  return {
    en: pattern.en.replace('{years}', String(age.years)),
    de: pattern.de.replace('{years}', String(age.years)),
  }
}

interface Seed {
  id: string
  order: number
  quiet?: true
  chapter: VinciText
  age: AgeShape
  line: VinciText
  certainty: VinciCertainty
}

/* The order is the story's own, which is not the order the rail walks today. */
const seeds: readonly Seed[] = [
  {
    id: 'garden', order: 0, age: { years: 65, shape: 'exact' }, certainty: 'documented',
    chapter: { en: 'The last house, from below', de: 'Das letzte Haus, von unten' },
    line: {
      en: "The house above you was Leonardo da Vinci's last. His story starts 65 years earlier, behind you.",
      de: 'Das Haus über dir war Leonardo da Vincis letztes. Seine Geschichte beginnt 65 Jahre früher, hinter dir.',
    },
  },
  {
    // ASK: the design's clock reads "age 0" here. German has no wing string
    // for a newborn's age, so the clock stands empty until it has one.
    id: 'line-early', order: 1, age: null, certainty: 'documented',
    chapter: { en: 'The night he was born', de: 'Die Nacht seiner Geburt' },
    line: {
      en: 'He was born on 15 April 1452, at the third hour of the night. His grandfather wrote it down.',
      de: 'Er wurde am 15. April 1452 geboren, in der dritten Stunde der Nacht. Sein Großvater schrieb es auf.',
    },
  },
  {
    id: 'picture-room', order: 2, age: { years: 20, shape: 'about' }, certainty: 'conjectural',
    chapter: { en: "The pupil's angel", de: 'Der Engel des Schülers' },
    line: {
      en: 'It is said that he painted the angel on the left, as a pupil. His master never touched paint again.',
      de: 'Er soll den Engel links gemalt haben, noch als Schüler. Sein Meister rührte nie wieder Farbe an.',
    },
  },
  {
    id: 'picture-room-west', order: 4, age: null, certainty: 'documented',
    chapter: { en: 'Forty years of pictures', de: 'Vierzig Jahre Bilder' },
    line: {
      en: 'This wall is his life as a painter, over forty years. Now the story goes back. He is thirty.',
      de: 'Diese Wand ist sein Leben als Maler, über vierzig Jahre. Jetzt geht die Geschichte zurück. Er ist dreißig.',
    },
  },
  {
    id: 'flight', order: 5, age: { years: 30, shape: 'about' }, certainty: 'reconstructed',
    chapter: { en: 'He wanted to fly', de: 'Er wollte fliegen' },
    line: {
      en: 'At about thirty he offered himself to the duke of Milan as an engineer. He also wanted to fly.',
      de: 'Mit etwa dreißig bot er sich dem Herzog von Mailand als Ingenieur an. Fliegen wollte er auch.',
    },
  },
  {
    id: 'works', order: 6, age: { years: 47, shape: 'exact' }, certainty: 'documented',
    chapter: { en: 'Seventeen years in Milan', de: 'Siebzehn Jahre Mailand' },
    line: {
      en: 'He spent about seventeen years in Milan and drew these machines. Then the French took the city, and he left.',
      de: 'Etwa siebzehn Jahre verbrachte er in Mailand und zeichnete diese Maschinen. Dann nahmen die Franzosen die Stadt, und er ging.',
    },
  },
  {
    id: 'reading-table', order: 7, age: null, certainty: 'unknown',
    chapter: { en: 'Written backwards', de: 'Rückwärts geschrieben' },
    line: {
      en: 'He wrote his notebooks from right to left. A mirror reads them back. He never wrote down why.',
      de: 'Seine Notizbücher schrieb er von rechts nach links. Ein Spiegel liest sie zurück. Warum, hat er nie aufgeschrieben.',
    },
  },
  {
    id: 'body', order: 8, age: { years: 60, shape: 'near' }, certainty: 'reconstructed',
    chapter: { en: 'Inside the body', de: 'Im Inneren des Körpers' },
    line: {
      en: 'Near sixty he opened dead bodies and drew them. He wrote that all this would be finished in 1510.',
      de: 'Mit fast sechzig öffnete er Tote und zeichnete sie. Er schrieb, 1510 werde das alles fertig sein.',
    },
  },
  {
    id: 'supper-wall', order: 9, age: { years: 45, shape: 'exact' }, certainty: 'documented',
    chapter: { en: 'A wall in Milan', de: 'Eine Wand in Mailand' },
    line: {
      en: 'Now back to Milan. He is 45. He painted this picture on a wall, just this big.',
      de: 'Jetzt zurück nach Mailand. Er ist 45. Dieses Bild malte er auf eine Wand, genau so groß.',
    },
  },
  {
    id: 'arrival', order: 10, age: { years: 64, shape: 'exact' }, certainty: 'reconstructed',
    chapter: { en: 'A house in France', de: 'Ein Haus in Frankreich' },
    line: {
      en: 'At 64 he moved to France, to this house. He came for the young king. It was his last house.',
      de: 'Mit 64 zog er nach Frankreich, in dieses Haus. Er kam für den jungen König. Es war sein letztes Haus.',
    },
  },
  {
    id: 'courtyard', order: 11, age: { years: 65, shape: 'exact' }, certainty: 'documented',
    chapter: { en: 'A visitor comes', de: 'Ein Besucher kommt' },
    line: {
      en: 'It is 10 October 1517. A cardinal visits, and his secretary keeps a diary. That is how we know.',
      de: 'Es ist der 10. Oktober 1517. Ein Kardinal kommt zu Besuch, sein Sekretär führt Tagebuch. Daher kennen wir den Tag.',
    },
  },
  {
    id: 'hall', order: 11.5, quiet: true, age: null, certainty: 'conjectural',
    chapter: { en: 'The great hall', de: 'Der große Saal' },
    line: {
      en: 'Guests were received in the hall behind this door. It is said the king gave him this house.',
      de: 'Hinter dieser Tür empfing man Gäste. Der König soll ihm dieses Haus gegeben haben.',
    },
  },
  {
    id: 'oratory', order: 11.6, quiet: true, age: null, certainty: 'conjectural',
    chapter: { en: 'The small chapel', de: 'Die kleine Kapelle' },
    line: {
      en: 'This small chapel was here before he came. The paintings inside may be by his pupils.',
      de: 'Diese kleine Kapelle stand schon, als er kam. Die Bilder darin stammen vielleicht von seinen Schülern.',
    },
  },
  {
    id: 'study', order: 12, age: { years: 65, shape: 'exact' }, certainty: 'documented',
    chapter: { en: 'What the secretary wrote', de: 'Was der Sekretär aufschrieb' },
    line: {
      en: 'The secretary writes down what he sees. Three paintings. A hand that cannot paint any more. It still draws.',
      de: 'Der Sekretär schreibt auf, was er sieht. Drei Gemälde. Eine Hand, die nicht mehr malen kann. Zeichnen kann sie noch.',
    },
  },
  {
    id: 'chamber', order: 13, age: { years: 67, shape: 'exact' }, certainty: 'conjectural',
    chapter: { en: 'The north room', de: 'Das Nordzimmer' },
    line: {
      en: 'He died in this house at 67, on 2 May 1519. His room was probably at this end.',
      de: 'Er starb in diesem Haus mit 67, am 2. Mai 1519. Sein Zimmer lag wohl an diesem Ende.',
    },
  },
  {
    id: 'grave', order: 14, age: null, certainty: 'unknown',
    chapter: { en: 'Where he lies', de: 'Wo er liegt' },
    line: {
      en: 'He wanted to be buried in a church by the castle. It was pulled down. Nobody knows where he rests.',
      de: 'Er wollte in einer Kirche beim Schloss begraben werden. Sie wurde abgerissen. Wo er liegt, weiß niemand sicher.',
    },
  },
]

export const deskStory: readonly DeskStoryStop[] = seeds.map(seed => ({
  id: seed.id,
  order: seed.order,
  quiet: seed.quiet === true,
  chapter: seed.chapter,
  age: ageText(seed.age),
  line: seed.line,
  certainty: seed.certainty,
}))

const byId = new Map(deskStory.map(stop => [stop.id, stop]))

export function deskStoryStop(id: string): DeskStoryStop | undefined {
  return byId.get(id)
}
