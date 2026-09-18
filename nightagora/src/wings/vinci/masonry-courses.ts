/** Irregular dressed coursing for surfaces that carry no laid geometry.
 * A hand-set 1517 wall keeps its bed joints level and nothing else: course
 * heights, block lengths and joint widths all wander. Colour and relief only;
 * no geometry, no imported bitmap, no measured historic course table.
 *
 * The mechanism now lives in the stack (`stack/detail.ts`), where a room, a
 * plinth and a court paving can all reach it. What stays here is the wing's
 * own recipe and the two calls the shell makes.
 */
import * as TSL from 'three/tsl'
import { anisotropicFootprint, courses, reliefNormal, type CourseNodes, type CourseRecipe } from '../../stack/detail'

// The composable node overloads stay local to this helper.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any
const { float, mix } = TSL as unknown as Record<string, N>

export { anisotropicFootprint }
export type { CourseRecipe }

export const dressedTuffeau: CourseRecipe = {
  courseM: .29, courseWaveM: 1.75, courseSwing: .26, blockM: .66, blockSwing: .46,
  jointM: .013, wanderM: .0018, faceSwing: .045, seed: 3.17,
}

export const courseProvenance = {
  class: 'GENERATED',
  basis: ['A-MASONRY', 'src/wings/vinci/data/closluce.json § materials', 'Q124', 'Q127'],
  recipe: 'Bed joints stay level; their spacing swings on a metre-scale wave, each course draws its own block length and phase, the joint line wanders a few millimetres and every block takes its own face tone. Joints are recessed by a bounded height gradient, never by geometry. No course table is measured from any photograph.',
  label: {
    en: 'Dressed tuffeau, laid by hand: courses 0.24 to 0.34 m, blocks 0.44 to 0.88 m, joints 8 to 20 mm. The wall is coursed but not repeated; these are finish assumptions, not measured stones.',
    de: 'Handgesetzter Tuffstein: Schichten von 0,24 bis 0,34 m, Steine von 0,44 bis 0,88 m, Fugen von 8 bis 20 mm. Die Mauer ist geschichtet, aber nicht wiederholt; dies sind Annahmen zur Oberfläche, keine gemessenen Steine.',
  },
} as const

/** Face tone, joint coverage and the joint's own depth, in metres. */
export function coursedFace(U: N, recipe: CourseRecipe = dressedTuffeau): CourseNodes {
  return courses(U, recipe)
}

/** Fold coursing into a shell surface that was built as plain geometry. */
export function applyCoursing(material: { colorNode: N; normalNode: N }, recipe: CourseRecipe = dressedTuffeau): void {
  const U = TSL.uv()
  const { tone, joint, depthM } = coursedFace(U, recipe)
  material.colorNode = material.colorNode.mul(tone).mul(mix(float(1), float(.70), joint))
  const base = material.normalNode
  if (!base) return
  material.normalNode = reliefNormal(base, depthM, .11)
}
