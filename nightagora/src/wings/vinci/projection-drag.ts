/** Convert a pointer delta in CSS pixels through the camera's actual lens.
 * At the centre of the picture, one pointer pixel produces approximately
 * one scene pixel. The linear angular mapping is independent of event
 * batching and device pixel ratio. Cone bounds belong to the look controller.
 */
export function projectRailDrag(
  dxCss: number,
  dyCss: number,
  verticalFovDegrees: number,
  cssViewportHeight: number,
): { yaw: number; pitch: number } {
  if (![dxCss, dyCss, verticalFovDegrees, cssViewportHeight].every(Number.isFinite)
    || verticalFovDegrees <= 0 || verticalFovDegrees >= 180 || cssViewportHeight <= 0) {
    throw new Error('Invalid rail pointer projection')
  }
  const radiansPerCssPixel = 2 * Math.tan(verticalFovDegrees * Math.PI / 360) / cssViewportHeight
  return { yaw: -dxCss * radiansPerCssPixel, pitch: -dyCss * radiansPerCssPixel }
}
