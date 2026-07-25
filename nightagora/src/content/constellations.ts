/* The six constellations of the thirty. Each is modeled on a real
   asterism whose silhouette carries the category's meaning: the shape is
   the identity, so shapes stay rigid while the whole sky breathes.
   Coordinates are patch-local: x right, y up, unit scaled by the scene.

   Tradition + promise lines are the founder's locked copy (2026-07-20). */

export interface ConstellationStar {
  slug: string
  x: number
  y: number
  /** the brightest star of the figure group (renders larger) */
  alpha?: boolean
  /** the school or art, small caps under the name */
  tradition: string
  /** the promise: what a visitor will learn */
  promise: string
}

export interface Constellation {
  key: string
  numeral: string
  name: string
  voices: string
  /** the asterism the shape honors (letterpress footnote) */
  after: string
  /** direction of the patch: azimuth around the visitor (rad, 0 = the
      gaze the agora faces), elevation above the horizon (rad) */
  azimuth: number
  elevation: number
  stars: ConstellationStar[]
  /** hairlines between star indices */
  lines: Array<[number, number]>
}

export const SKY_INVITE = 'Open any name to explore their life and ideas.'

/** Chapter order = scroll order. The night wheels around the visitor. */
export const CONSTELLATIONS: Constellation[] = [
  {
    key: 'philosophers',
    numeral: 'I',
    name: 'Philosophers',
    voices: 'Five voices',
    after: 'after Cassiopeia',
    azimuth: 0,
    elevation: 0.6,
    stars: [
      {
        slug: 'plato',
        x: -2.0,
        y: 0.55,
        tradition: 'Classical Philosophy',
        promise: 'You will learn to examine your own life.',
      },
      {
        slug: 'beauvoir',
        x: -1.0,
        y: -0.25,
        tradition: 'Existentialist Feminism',
        promise: 'You will learn to see how you were made.',
      },
      {
        slug: 'aurelius',
        x: 0,
        y: 0.5,
        alpha: true,
        tradition: 'Stoicism',
        promise: 'You will learn to question your first reaction.',
      },
      {
        slug: 'schopenhauer',
        x: 1.0,
        y: -0.3,
        tradition: 'Philosophy of Will',
        promise: 'You will learn to see through the wanting.',
      },
      {
        slug: 'nietzsche',
        x: 2.0,
        y: 0.4,
        tradition: 'Existential Philosophy',
        promise: 'You will learn to build your own meaning.',
      },
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
    ],
  },
  {
    key: 'teachers',
    numeral: 'II',
    name: 'Spiritual Teachers',
    voices: 'Six voices',
    after: 'after Corona Borealis',
    azimuth: 0.85,
    elevation: 0.68,
    stars: [
      {
        slug: 'laozi',
        x: -1.6,
        y: 0.05,
        tradition: 'Taoism',
        promise: 'You will learn to act without forcing.',
      },
      {
        slug: 'eckhart',
        x: -1.0,
        y: 0.62,
        tradition: 'Christian Mysticism',
        promise: 'You will learn to stop clutching what you love.',
      },
      {
        slug: 'gautama',
        x: -0.3,
        y: 0.92,
        alpha: true,
        tradition: 'Buddhism',
        promise: 'You will learn to watch wanting rise and fade.',
      },
      {
        slug: 'rumi',
        x: 0.45,
        y: 0.85,
        tradition: 'Sufi Mysticism',
        promise: 'You will learn to let your longing guide you.',
      },
      {
        slug: 'bingen',
        x: 1.1,
        y: 0.5,
        tradition: 'Christian Mysticism',
        promise: 'You will learn to notice the life in things.',
      },
      {
        slug: 'zenji',
        x: 1.6,
        y: -0.05,
        tradition: 'Zen Buddhism',
        promise: 'You will learn to stop chasing the next moment.',
      },
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
    ],
  },
  {
    key: 'activists',
    numeral: 'III',
    name: 'Activists and Leaders',
    voices: 'Four voices',
    after: 'after the Southern Cross',
    azimuth: 1.7,
    elevation: 0.55,
    stars: [
      {
        slug: 'king',
        x: 0,
        y: 1.05,
        tradition: 'Civil Rights & Theology',
        promise: 'You will learn to resist without hate.',
      },
      {
        slug: 'gandhi',
        x: 0.12,
        y: -1.0,
        alpha: true,
        tradition: 'Nonviolent Resistance',
        promise: 'You will learn to stay willing to be wrong.',
      },
      {
        slug: 'tubman',
        x: -0.85,
        y: -0.05,
        tradition: 'Liberation & Faith',
        promise: 'You will learn to act before fear stops you.',
      },
      {
        slug: 'mandela',
        x: 0.78,
        y: 0.22,
        tradition: 'Ubuntu & Liberation',
        promise: 'You will learn to free yourself from bitterness.',
      },
    ],
    lines: [
      [0, 1],
      [2, 3],
    ],
  },
  {
    key: 'artists',
    numeral: 'IV',
    name: 'Artists',
    voices: 'Four voices',
    after: 'after Lyra',
    azimuth: 2.55,
    elevation: 0.72,
    stars: [
      {
        slug: 'kahlo',
        x: -0.85,
        y: 0.95,
        alpha: true,
        tradition: 'Art & Identity',
        promise: 'You will learn to look at yourself without flinching.',
      },
      {
        slug: 'vinci',
        x: 0,
        y: 0.28,
        tradition: 'Renaissance Polymath',
        promise: 'You will learn to train your own eye.',
      },
      {
        slug: 'blake',
        x: -0.18,
        y: -0.68,
        tradition: 'Visionary Poetry',
        promise: 'You will learn to see the chains you forged.',
      },
      {
        slug: 'mozart',
        x: 0.62,
        y: -0.32,
        tradition: 'Classical Music',
        promise: 'You will learn to find freedom inside the rules.',
      },
    ],
    lines: [
      [0, 1],
      [1, 2],
      [1, 3],
      [2, 3],
    ],
  },
  {
    key: 'writers',
    numeral: 'V',
    name: 'Writers',
    voices: 'Six voices',
    after: 'after Cygnus',
    azimuth: 3.4,
    elevation: 0.62,
    stars: [
      {
        slug: 'shakespeare',
        x: 0,
        y: 1.1,
        alpha: true,
        tradition: 'Renaissance Drama',
        promise: 'You will learn to see a person from inside.',
      },
      {
        slug: 'goethe',
        x: 0,
        y: 0.1,
        tradition: 'German Classicism',
        promise: 'You will learn to look until you understand.',
      },
      {
        slug: 'austen',
        x: 0.08,
        y: -1.15,
        tradition: 'Literary Realism',
        promise: "You will learn to read what people don't say.",
      },
      {
        slug: 'woolf',
        x: -0.95,
        y: 0.38,
        tradition: 'Modernist Literature',
        promise: 'You will learn to wake inside an ordinary moment.',
      },
      {
        slug: 'dickinson',
        x: 0.9,
        y: 0.34,
        tradition: 'American Poetry',
        promise: 'You will learn to tell the truth slant.',
      },
      {
        slug: 'angelou',
        x: -1.75,
        y: 0.72,
        tradition: 'Poetry & Civil Rights',
        promise: 'You will learn to find your own voice.',
      },
    ],
    lines: [
      [0, 1],
      [1, 2],
      [1, 3],
      [3, 5],
      [1, 4],
    ],
  },
  {
    key: 'scientists',
    numeral: 'VI',
    name: 'Scientists and Thinkers',
    voices: 'Five voices',
    after: 'after Auriga',
    azimuth: 4.35,
    elevation: 0.66,
    stars: [
      {
        slug: 'einstein',
        x: -0.5,
        y: 0.95,
        alpha: true,
        tradition: 'Theoretical Physics',
        promise: 'You will learn to keep asking why.',
      },
      {
        slug: 'lovelace',
        x: 0.7,
        y: 0.75,
        tradition: 'Mathematics & Computing',
        promise: 'You will learn to see what a thing could become.',
      },
      {
        slug: 'galilei',
        x: 1.0,
        y: -0.38,
        tradition: 'Natural Philosophy',
        promise: 'You will learn to test what you are told.',
      },
      {
        slug: 'jung',
        x: 0,
        y: -1.0,
        tradition: 'Depth Psychology',
        promise: 'You will learn to meet your own shadow.',
      },
      {
        slug: 'campbell',
        x: -1.0,
        y: -0.28,
        tradition: 'Comparative Mythology',
        promise: 'You will learn to read your own turning points.',
      },
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 0],
    ],
  },
]

/** The only open world in Run 1. Every other pane says still-being-drawn. */
export const OPEN_WORLD = 'aurelius'
