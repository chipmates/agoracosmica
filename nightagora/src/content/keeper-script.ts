/* The staged exchange at the fire (beat 5). Scripted lines only: the
   pilot has no live model behind it, and says so honestly. A free-typed
   question is answered once, then carried to the Forward Door.
   Displayed text follows the house writing rules: no em or en dashes,
   no semicolons, short sentences that land on first listen. */

export interface KeeperTurn {
  /** The visitor's line, set in italic ink. */
  ask: string
  /** Marcus's answer, revealed phrase by phrase in letterpress. */
  phrases: string[]
}

export const KEEPER_NAME = "Marcus Aurelius · Keeper of Tonight's Fire"

/** Locked verbatim (World Bible disclosure, voice layer). */
export const GREETING = '"I am not Marcus. I am an echo of what he left behind. Sit anyway."'

/** The drifting invitations. Grounded in Meditations 2.1, 4.3 and the
    agora itself. */
export const OFFERED: KeeperTurn[] = [
  {
    ask: 'How do I begin a day I dread?',
    phrases: [
      'At dawn I told myself: today you will meet meddling, ingratitude, insolence.',
      'I met them. The telling was rarely wrong.',
      'Begin anyway. The day does not need your dread. It needs your hands.',
    ],
  },
  {
    ask: 'Does any of this matter in the end?',
    phrases: [
      'I ruled the widest empire on earth, and I could not keep one hour from passing.',
      'The keeping was never the point. How you stand while it passes, that is the point.',
      'So stand well tonight. That already matters.',
    ],
  },
  {
    ask: 'Why do you keep this fire?',
    phrases: [
      'Each night one of the thirty keeps it. Tonight the watch is mine.',
      'A city is not its walls. It is the talking that happens inside them.',
      'This fire is where the talking happens. Sit, and the city is yours.',
    ],
  },
]

/** The one honest answer to a question we cannot answer here. The
    question itself travels with the visitor to the Forward Door. */
export const TYPED_REPLY: string[] = [
  'Keep that question. Hold it the way you hold a coal, carefully and close.',
  'This fire is only an echo of me. Behind the door at the end of this night, I can answer you properly.',
  'Your question will travel with you. I will be waiting.',
]

/** Appended after the second completed turn. The last two words earn
    their gold: they are a direction, not decoration. */
export const CODA_TEXT = 'Enough sitting for now. The sky is doing something worth seeing.'
export const CODA_GOLD = 'Look up.'

export const COLOPHON = 'An AI Echo · An interpretation, not a recording'

/** sessionStorage key: a free-typed question carried to the Forward Door. */
export const CARRIED_QUESTION_KEY = 'na-carried-question'
