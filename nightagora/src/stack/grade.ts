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

/* IDENTITY — the print that changes nothing.

   Neutral is the default and every dial below it has to be earned against a
   measurement. It is also what an unknown or missing grade name resolves to:
   a look nobody wrote must show the art as it was authored, never take the
   frame down with it. */
export const IDENTITY: Grade = {
  name: 'identity',
  exposure: 1,
  lift: [0, 0, 0],
  gamma: [1, 1, 1],
  gain: [1, 1, 1],
  saturation: 1,
  warm: [1, 1, 1],
  cool: [1, 1, 1],
  split: 0,
  vignette: 0,
  grain: 0,
  bloom: { strength: 0, radius: 0.4, threshold: 1, warmth: 1 },
  ao: { intensity: 0, distance: 0.6, thickness: 1 },
  dof: null,
}

/* THE SIX LOOKS. Each one starts at IDENTITY and names ONLY the dials it
   earned against a measurement of the base frame (`forge/parity.mjs`). No
   scene lifts its blacks, tints its shadows or hazes its air by default:
   the room's own dark is what the art authored, and the stack's job is to
   let it stand. What every scene does keep is the film's own tooth and a
   bloom that is allowed on emitters only.

   THE BLOOM THRESHOLD IS A MEASUREMENT, NOT A TASTE. The chain blooms the
   LINEAR frame, and every hand-written material in this museum lands
   through the same shoulder (`c / (1 + c/2)`), which puts lit stone under
   1.0 and leaves only what is actually emitting above it. So a threshold
   at 1.15 is the line between a surface that is lit and a surface that is
   a source: over it, the fire, the coals, the candle flames, the gold and
   the diamond flash; under it, the bowl's rim, which is what glared in the
   frame the judge scored.

   NO LOBBY GRADE ASKS FOR THE LENS, and `dof` stays null in all six. Every
   station of this lobby carries a caption, a name or a disclosure line, and
   a caption inside the circle of confusion is where the wheel's own bright
   motes landed on the words LIFE and AND. Depth of field is a wing-only
   knob: a wing with a real room at a real depth turns it on in its own
   grade, and gives up the pass's MSAA for it (see `samplesFor` in post.ts).

   The film's tooth is per scene, and each value is the one that broke the
   plane it had to break: the agora at 0.0035, where the bowl's own three
   scales are the thing being measured, and the wing's field at 0.008,
   where the sky's dither needed the most breaking. Nothing else in the
   table is a taste either. */

/** The night's six looks. Every scene of the path names one. */
export const GRADES = {
  /* THE COLD MOON — the corona owns the frame and the grade does nothing to
     it. The bloom is warm-masked and high, so the diamond flash reaches it
     and the white corona never does: that is how the ring keeps every
     streamer. */
  'cold-moon': {
    ...IDENTITY,
    name: 'cold-moon',
    grain: 0.006,
    bloom: { strength: 0.3, radius: 0.62, threshold: 1.15, warmth: 0.88 },
  },

  /* THE FALLING PLATES — thirty candle flames on a turning court. Only the
     flames are sources, and the stone under them is not. */
  'falling-plates': {
    ...IDENTITY,
    name: 'falling-plates',
    grain: 0.006,
    bloom: { strength: 0.34, radius: 0.5, threshold: 1.15, warmth: 0.6 },
  },

  /* LAPIS AND EMBER — the lobby. One fire in a stone room: the flame and
     the coals bloom, the bowl they stand in does not, and nothing lifts the
     air beside it. */
  'lapis-ember': {
    ...IDENTITY,
    name: 'lapis-ember',
    exposure: 0.94,
    grain: 0.0035,
    bloom: { strength: 0.3, radius: 0.1, threshold: 1.4, warmth: 0.92 },
  },

  /* THE WHEEL — thirty gold names on a dome of ink. Gold is the only warm
     thing in the frame and it has to stay legible, so the halo is small and
     tight and nothing else in the sky is allowed one. */
  'gold-on-ink': {
    ...IDENTITY,
    name: 'gold-on-ink',
    grain: 0.006,
    bloom: { strength: 0.34, radius: 0.3, threshold: 1.1, warmth: 0.9 },
  },

  /* THE BREATH — one gold breath and a hard cut. The whole frame is the
     source here, which is the one place a wide halo is the subject. */
  'gold-breath': {
    ...IDENTITY,
    name: 'gold-breath',
    grain: 0.006,
    bloom: { strength: 0.5, radius: 0.7, threshold: 1.05, warmth: 0.95 },
  },

  /* THE FIRST STATION — a wing's own room before the wing exists. Neutral,
     because whatever a wing is, the plate that stands in for it must not
     pretend to a look it has not earned. */
  'first-station': {
    ...IDENTITY,
    name: 'first-station',
    grain: 0.008,
    bloom: { strength: 0.3, radius: 0.45, threshold: 1.15, warmth: 0.8 },
  },
} satisfies Record<string, Grade>

export type GradeName = keyof typeof GRADES

export function grade(name: GradeName): Grade {
  return GRADES[name]
}

const unknown = new Set<string>()

/**
 * The look a scene asked for, or the identity print when it named one that
 * does not exist. A grade name arrives from a route, a rig state or a phase
 * table, so `undefined` is reachable from outside this module and a frame is
 * never the right place to find out.
 */
export function resolveGrade(asked: GradeName | Grade | null | undefined): Grade {
  if (asked && typeof asked === 'object') return asked
  const found = asked ? (GRADES as Record<string, Grade>)[asked] : undefined
  if (found) return found
  const name = String(asked)
  if (!unknown.has(name)) {
    unknown.add(name)
    console.warn(`grade "${name}" is not in the table; the frame is printed neutral`)
  }
  return IDENTITY
}
