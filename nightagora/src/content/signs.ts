/* The zodiac patterns of the thirty — content, not organ. Points are
   verbatim from the classic app's ZodiacConstellation patterns
   (0..100 screen space, y down). The sign organ (core/sign.ts) fits
   any of these into a world's frame. */

export type SignPattern = Array<[number, number]>

// THE STOIC TAURUS — Marcus Aurelius: horns, face, neck, shoulder,
// legs, belly, back, tail tuft.
export const STOIC_TAURUS: SignPattern = [
  [30, 30], // Horn left tip
  [40, 25], // Horn arc to forehead
  [50, 30], // Head top
  [60, 25], // Horn arc to right tip
  [70, 30], // Right horn tip
  [65, 40], // Face
  [55, 45], // Neck
  [45, 50], // Shoulder
  [40, 60], // Front leg
  [35, 70], // Belly / hind leg
  [55, 65], // Back / tail base
  [65, 55], // Tail tuft
]
