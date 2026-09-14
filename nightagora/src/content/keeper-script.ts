/* The keeper's one line at the fire, and the disclosure that goes with
   it. Scripted only: nothing here is generated, and it says so.
   Displayed text follows the house writing rules: no em or en dashes,
   no semicolons, short sentences that land on first listen. */

export interface KeeperTurn {
  /** The visitor's line, set in italic ink. */
  ask: string
  /** The answer, revealed phrase by phrase in letterpress. */
  phrases: string[]
}

/** One staged sitting: the same exchange engine serves any hearth.
    Verbs universal, staging sovereign. */
export interface KeeperScript {
  name: string
  greeting: string
  offered: KeeperTurn[]
  typedReply: string[]
  codaText: string
  codaGold: string
  /** Optional way onward, shown after the coda as a quiet gold line. */
  exit?: string
  /** Greeting-only staging: the exit shows as soon as the greeting has
      landed: the keeper points the way rather than holding the frame. */
  exitImmediate?: boolean
}

import { disclosure } from './disclosures'
import { lang, type Lang } from '../wings/content'

export const KEEPER_NAME = 'The Night Watchman'

/** The voice layer of the disclosure, read from the canon so the line the
    keeper speaks and the line the honesty gate checks cannot drift apart. */
export const GREETING = disclosure('voice')

/** The one honest answer to a question this fire cannot answer. The
    question itself travels with the visitor. */
export const TYPED_REPLY: string[] = [
  'You are in the Night Agora. This welcome is scripted.',
  'The count above shows which wings are open and which are in preparation.',
  'Look up to choose a life. In a wing, walk from place to place. Open a label to look closer.',
]

/** The museum voice has its own colophon. */
export const COLOPHON = disclosure('watchman')

/** sessionStorage key: a free-typed question the visitor carries out. */
export const CARRIED_QUESTION_KEY = 'na-carried-question'

/** The lobby keeper: one greeting, one way onward. */
export const FIRE_SCRIPT: KeeperScript = {
  name: KEEPER_NAME,
  greeting: GREETING,
  offered: [],
  typedReply: TYPED_REPLY,
  codaText: '',
  codaGold: '',
  exit: 'Look up · choose a life',
  exitImmediate: true,
}

const FIRE_SCRIPTS: Record<Lang, KeeperScript> = {
  en: FIRE_SCRIPT,
  de: {
    name: 'Der Nachtwächter',
    greeting: disclosure('voice', 'de'),
    offered: [],
    typedReply: [
      'Du bist in der Night Agora. Dieser Willkommensgruß ist vorab geschrieben.',
      'Die Angabe oben zeigt, welche Flügel offen sind und welche vorbereitet werden.',
      'Schau nach oben und wähle ein Leben. Geh im Flügel von Ort zu Ort. Öffne eine Beschriftung, um genauer hinzusehen.',
    ],
    codaText: '',
    codaGold: '',
    exit: 'Schau nach oben · wähle ein Leben',
    exitImmediate: true,
  },
}

export function fireScript(): KeeperScript {
  return FIRE_SCRIPTS[lang()]
}
