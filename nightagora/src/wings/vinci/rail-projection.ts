import type { PerspectiveCamera } from 'three/webgpu'

/** Preserve the authored horizontal field on wider canvases. Both actual
 * near-plane half extents remain inside the authored projection envelope.
 * The prescribed 1280×720 and 390×844 review frames retain their lenses.
 */
export function fittedRailFov(authoredFov: number, aspect: number, phone: boolean) {
  if (!(aspect > 0 && Number.isFinite(aspect))) throw new Error('Invalid rail camera aspect')
  const authoredAspect = phone ? 390 / 844 : 1280 / 720
  return 360 / Math.PI * Math.atan(Math.tan(authoredFov * Math.PI / 360) * Math.min(1, authoredAspect / aspect))
}

/** THE SHIFT LENS. A close look may look level and slide its frustum up or
 * down instead of pitching, as a photographer's shift lens does, so the wall
 * and its frames stay square. The shift is where the frame's middle stands,
 * in the frame's own half heights, the same on every canvas: a point on the
 * level look lands at minus the shift. The rail sets it with its lens; three
 * rebuilds the projection from the lens, so the shift is added after every
 * rebuild, and a view offset laid on inside a draw adds to it. */
export const RAIL_SHIFT_CEILING = .7
const shifts = new WeakMap<PerspectiveCamera, number>()
export const railShiftOf = (camera: PerspectiveCamera): number => shifts.get(camera) ?? 0
export function setRailShift(camera: PerspectiveCamera, shift: number): void {
  if (!(Number.isFinite(shift) && Math.abs(shift) <= RAIL_SHIFT_CEILING)) throw new Error('Rail shift exceeds its authored envelope')
  if (!shifts.has(camera)) {
    const own = camera.updateProjectionMatrix
    camera.updateProjectionMatrix = function (this: PerspectiveCamera) {
      own.call(this)
      const slide = shifts.get(this) ?? 0
      if (slide !== 0) {
        this.projectionMatrix.elements[9] = this.projectionMatrix.elements[9]! + slide
        this.projectionMatrixInverse.copy(this.projectionMatrix).invert()
      }
    }
  }
  shifts.set(camera, shift)
}

/** The projection is the authored one: no zoom, no skew, no offset standing
 * between frames, and a shift no larger than the certified leg's ends allow
 * (none unless a caller names one). */
export function assertRailProjection(camera: PerspectiveCamera, shiftBound = 0) {
  const shift = railShiftOf(camera)
  if (Math.abs(camera.near - .25) > 1e-12 || camera.zoom !== 1 || camera.view?.enabled || camera.filmOffset !== 0
    || !(Math.abs(shift) <= Math.min(RAIL_SHIFT_CEILING, shiftBound) + 1e-12)) throw new Error('Rail projection exceeds its authored clearance envelope')
}
