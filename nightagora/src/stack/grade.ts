/* THE GRADE — one named look per scene, and the post chain's own dial board.

   A grade is not a filter laid over a finished picture: it is the last honest
   step of the photograph, the same lift/gamma/gain a colourist would reach
   for, plus the warm-cool split that gives a night its temperature. Every
   scene of the museum names its grade here so the whole night can be read as
   one table instead of six shaders. */

export interface BloomGrade {
  strength: number
  radius: number
  threshold: number
  /** 0 lets every bright pixel bloom, 1 lets only the warm ones. Fire and
      gold are warm; the eclipse's corona is not, and it keeps its ring. */
  warmth: number
}

export interface DofGrade {
  /** metres from the eye */
  focus: number
  focal: number
  bokeh: number
}

export interface Grade {
  name: string
  exposure: number
  lift: [number, number, number]
  gamma: [number, number, number]
  gain: [number, number, number]
  saturation: number
  /** what the highlights are pushed toward */
  warm: [number, number, number]
  /** and what the shadows are pulled toward */
  cool: [number, number, number]
  split: number
  vignette: number
  grain: number
  bloom: BloomGrade
  ao: { intensity: number; distance: number; thickness: number }
  dof: DofGrade | null
}

const base: Grade = {
  name: 'base',
  exposure: 1,
  lift: [0, 0, 0],
  gamma: [1, 1, 1],
  gain: [1, 1, 1],
  saturation: 1,
  warm: [1, 0.94, 0.84],
  cool: [0.82, 0.88, 1],
  split: 0,
  vignette: 0.18,
  grain: 0.02,
  bloom: { strength: 0.5, radius: 0.4, threshold: 0.72, warmth: 0.85 },
  ao: { intensity: 1, distance: 0.6, thickness: 1 },
  dof: null,
}

/** The night's six looks. Every scene of the path names one. */
export const GRADES = {
  /* THE COLD MOON — the corona owns the frame, so the grade does almost
     nothing: no lift into the black, a hair of cool in the shadows, and a
     bloom threshold high enough that only the diamond flash reaches it. */
  'cold-moon': {
    ...base,
    name: 'cold-moon',
    exposure: 1,
    lift: [0, 0, 0.0015],
    gamma: [1, 1, 1],
    saturation: 0.98,
    split: 0.22,
    vignette: 0.26,
    grain: 0.024,
    // warm only, and high: the corona is white and it keeps every streamer
    bloom: { strength: 0.3, radius: 0.62, threshold: 0.93, warmth: 0.88 },
    ao: { intensity: 0, distance: 0.6, thickness: 1 },
  },

  /* THE FALLING PLATES — the descent is a passage, not a room: the grade
     opens the gamma a little so the turning plates keep their edges, and
     leans cool because everything here is still sky. */
  'falling-plates': {
    ...base,
    name: 'falling-plates',
    exposure: 1.01,
    lift: [0, 0.001, 0.002],
    gamma: [1, 1, 0.99],
    saturation: 1.02,
    split: 0.3,
    vignette: 0.3,
    grain: 0.026,
    bloom: { strength: 0.4, radius: 0.5, threshold: 0.8, warmth: 0.6 },
    ao: { intensity: 0.5, distance: 0.5, thickness: 1 },
  },

  /* LAPIS AND EMBER — the lobby. The whole room is one fire against blue
     stone, so the split is the loudest thing the grade does: warmth into
     the firelit highlights, lapis into everything the fire misses. */
  'lapis-ember': {
    ...base,
    name: 'lapis-ember',
    exposure: 1,
    lift: [0, 0, 0.0015],
    gamma: [1, 1, 1],
    gain: [1, 1, 1],
    saturation: 1.04,
    warm: [1, 0.92, 0.78],
    cool: [0.72, 0.82, 1],
    split: 0.3,
    vignette: 0.3,
    grain: 0.026,
    bloom: { strength: 0.45, radius: 0.42, threshold: 0.78, warmth: 0.92 },
    ao: { intensity: 0.9, distance: 0.85, thickness: 1 },
    dof: null,
  },

  /* THE WHEEL — thirty gold names on a dome of ink. Gold is the only warm
     thing in the frame and it must stay legible, so the bloom is small and
     tight and the vignette does the rest of the focusing. */
  'gold-on-ink': {
    ...base,
    name: 'gold-on-ink',
    exposure: 1,
    lift: [0, 0, 0.0015],
    gamma: [1, 1, 1],
    saturation: 1.03,
    warm: [1, 0.92, 0.78],
    split: 0.3,
    vignette: 0.36,
    grain: 0.022,
    bloom: { strength: 0.46, radius: 0.36, threshold: 0.68, warmth: 0.9 },
    ao: { intensity: 0.4, distance: 0.5, thickness: 1 },
    // no depth of field on a dome of stars: everything in it is at the same
    // distance, so the lens can only bloat the pinpoints it should keep
    dof: null,
  },

  /* THE BREATH — one gold breath and a hard cut. The grade is the breath's
     own instrument here: warm gain, no vignette fighting the corona, and a
     bloom wide enough to feel like light rather than like a sprite. */
  'gold-breath': {
    ...base,
    name: 'gold-breath',
    exposure: 1.04,
    lift: [0.002, 0.001, 0],
    gain: [1.03, 1.0, 0.97],
    saturation: 1.02,
    split: 0.2,
    vignette: 0.12,
    grain: 0.02,
    bloom: { strength: 0.8, radius: 0.7, threshold: 0.55, warmth: 0.95 },
    ao: { intensity: 0, distance: 0.5, thickness: 1 },
  },

  /* THE FIRST STATION — a wing's own room before the wing exists. Neutral
     on purpose: whatever a wing is, the plate that stands in for it must
     not pretend to a look it has not earned. */
  'first-station': {
    ...base,
    name: 'first-station',
    exposure: 1,
    lift: [0, 0, 0.0015],
    saturation: 1,
    split: 0.18,
    vignette: 0.24,
    grain: 0.022,
    bloom: { strength: 0.4, radius: 0.45, threshold: 0.74, warmth: 0.8 },
    ao: { intensity: 0.6, distance: 0.6, thickness: 1 },
  },
} satisfies Record<string, Grade>

export type GradeName = keyof typeof GRADES

export function grade(name: GradeName): Grade {
  return GRADES[name]
}
