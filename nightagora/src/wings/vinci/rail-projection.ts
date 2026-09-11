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

export function assertRailProjection(camera: PerspectiveCamera) {
  if (Math.abs(camera.near - .25) > 1e-12 || camera.zoom !== 1 || camera.view?.enabled || camera.filmOffset !== 0) throw new Error('Rail projection exceeds its authored clearance envelope')
}
