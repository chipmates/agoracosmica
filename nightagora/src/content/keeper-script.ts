/* The keeper's one line at the fire, and the disclosure that goes with
   it. Scripted only: nothing here is generated, and it says so.
   Displayed text follows the house writing rules: no em or en dashes,
   no semicolons, short sentences that land on first listen. */

export interface KeeperTurn {
  /** The visitor's line, set in italic ink. */
  ask: string
  /** Marcus's answer, revealed phrase by phrase in letterpress. */
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

export const KEEPER_NAME = "Marcus Aurelius · Keeper of Tonight's Fire"

/** The voice layer of the disclosure, read from the canon so the line the
    keeper speaks and the line the honesty gate checks cannot drift apart. */
export const GREETING = disclosure('voice')

/** The one honest answer to a question this fire cannot answer. The
    question itself travels with the visitor. */
export const TYPED_REPLY: string[] = [
  'Keep that question. Hold it the way you hold a coal, carefully and close.',
  'This fire is only an echo of me. Behind the door at the end of this night, I can answer you properly.',
  'Your question will travel with you. I will be waiting.',
]

/** The ink layer, from the same canon. */
export const COLOPHON = disclosure('ink')

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
  exit: 'Look up · the thirty are chosen in the sky',
  exitImmediate: true,
}

