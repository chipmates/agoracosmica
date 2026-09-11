/** Irregular dressed coursing for surfaces that carry no laid geometry.
 * A hand-set 1517 wall keeps its bed joints level and nothing else: course
 * heights, block lengths and joint widths all wander. Colour and relief only;
 * no geometry, no imported bitmap, no measured historic course table.
 */
import * as TSL from 'three/tsl'

// The composable node overloads stay local to this helper.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any
const { cameraViewMatrix, cos, float, floor, fract, length, mix, mx_noise_float,
  positionView, positionWorld, sin, smoothstep, vec2 } = TSL as unknown as Record<string, N>

export interface CourseRecipe {
  /** mean bed-joint spacing, metres */
  courseM: number
  /** the metres over which course height swings, and by how much */
  courseWaveM: number
  courseSwing: number
  /** mean block length and the fraction it varies by, per course */
  blockM: number
  blockSwing: number
  /** joint width and how far a joint line wanders off straight, metres */
  jointM: number
  wanderM: number
  /** how far a block's own face tone departs from the wall's */
  faceSwing: number
  seed: number
}

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

const hash = (a: N, b: N, salt: number): N => fract(a.mul(31.17).add(b.mul(13.713)).add(salt).sin().mul(4317.1))

/** Face tone, joint coverage and the joint's own depth, in metres. */
export function coursedFace(U: N, recipe: CourseRecipe = dressedTuffeau): { tone: N; joint: N; depthM: N } {
  const r = recipe
  const wave = float(Math.PI * 2 / r.courseWaveM)
  // A monotone phase whose slope carries the course-height swing; dividing
  // by that slope returns the distance to a bed joint in real metres.
  const phase = U.y.div(r.courseM).add(sin(U.y.mul(wave)).mul(r.courseSwing))
  const slope = float(1 / r.courseM).add(cos(U.y.mul(wave)).mul(r.courseSwing).mul(wave)).max(.2)
  const row = floor(phase)
  const bedM = fract(phase).sub(.5).abs().sub(.5).abs().div(slope)
  const length_ = float(r.blockM).mul(hash(row, float(0), r.seed).sub(.5).mul(r.blockSwing).add(1))
  const head = U.x.div(length_).add(hash(row, float(1), r.seed + 5.1))
  const headM = fract(head).sub(.5).abs().sub(.5).abs().mul(length_)
  const wander = mx_noise_float(vec2(U.x.mul(7.3), U.y.mul(11.7))).mul(r.wanderM)
  const edge = bedM.min(headM).add(wander).max(0)
  const pixel = length(U.dFdx()).add(length(U.dFdy())).mul(.5).max(.0002)
  // A joint narrower than the pixel must fade back into the wall, not smear
  // into a half-covered grey across the whole face.
  const held = smoothstep(1.3, 2.8, float(r.courseM).div(pixel))
  const joint = float(1).sub(smoothstep(float(r.jointM * .5).sub(pixel).max(0), float(r.jointM * .5).add(pixel), edge)).mul(held)
  const column = floor(head)
  const face = hash(row, column, r.seed + 11.3).sub(.5).mul(2 * r.faceSwing)
  // The arris of a hand-dressed block is never quite sharp.
  const arris = smoothstep(r.jointM * .5, r.jointM * 2.6, edge)
  return { tone: float(1).add(face).sub(mix(float(.035), float(0), arris).mul(held)), joint, depthM: joint.mul(-r.jointM * .22) }
}

/** Fold coursing into a shell surface that was built as plain geometry. */
export function applyCoursing(material: { colorNode: N; normalNode: N }, recipe: CourseRecipe = dressedTuffeau): void {
  const U = TSL.uv()
  const { tone, joint, depthM } = coursedFace(U, recipe)
  material.colorNode = material.colorNode.mul(tone).mul(mix(float(1), float(.70), joint))
  const base = material.normalNode
  if (!base) return
  const height = depthM.toVar()
  const sx = positionView.dFdx(), sy = positionView.dFdy()
  const rx = sy.cross(base), ry = base.cross(sx), det = sx.dot(rx)
  const gradient = rx.mul(height.dFdx()).add(ry.mul(height.dFdy())).mul(det.sign()).div(det.abs().max(1e-10)).toVar()
  material.normalNode = base.sub(gradient.div(length(gradient).div(.11).max(1))).normalize()
  void positionWorld; void cameraViewMatrix
}
