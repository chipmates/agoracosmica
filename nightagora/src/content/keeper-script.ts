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
      landed (the hub keeper points the way, the hearth keeper talks). */
  exitImmediate?: boolean
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

/** The agora sitting, assembled. */
/** The hub keeper (guided first night, Michel 2026-07-20): one greeting,
    one invitation. The full exchange lives at his hearth in his world. */
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

export const AGORA_SCRIPT: KeeperScript = {
  name: KEEPER_NAME,
  greeting: GREETING,
  offered: OFFERED,
  typedReply: TYPED_REPLY,
  codaText: CODA_TEXT,
  codaGold: CODA_GOLD,
}

/** The hearth sitting at his camp on the Danube (beat 10). Grounded in
    Meditations 5.20 (the obstacle passage) and the campaign context. */
export const CAMP_SCRIPT: KeeperScript = {
  name: 'Marcus Aurelius · At his hearth on the Danube',
  greeting: '"Sit. The watch is long, and honest company is rare."',
  offered: [
    {
      ask: 'What is it like, ruling from a tent?',
      phrases: [
        'Rome thinks the empire is marble. Out here I know it is mud, rivers, and tired men.',
        'A tent is honest. It reminds you how little a wall ever held.',
      ],
    },
    {
      ask: 'Teach me the thing about obstacles.',
      phrases: [
        'I wrote it by this fire: the impediment to action advances action.',
        'What stands in the way becomes the way. Look, I carved it into the post there.',
        'It is not comfort. It is a tool. Use it on something real tomorrow.',
      ],
    },
  ],
  typedReply: TYPED_REPLY,
  codaText: 'The night is turning. The others are gathering at the great fire, and a question like yours deserves many voices.',
  codaGold: 'Walk back with me.',
  exit: 'Return to the agora fire',
}
