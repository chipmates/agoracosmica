/** Fits the existing primary directional shadow to real world geometry.
 * The caller supplies the union of the room and hang Box3 bounds after world
 * matrices are current. This owns no scene object, light, camera or texture,
 * and changes no shared stack implementation or hidden secondary cascade.
 */
import { Box3, Vector3, type Object3D } from 'three/webgpu'
import type { KeyLight } from '../../../../stack/light'

type Point = [number, number, number]
export interface ShadowFitOptions {
  /** Extra receiver/caster coverage at each lateral edge, in metres. */
  paddingM?: number
  /** Additional space before/after the real projected depth interval. */
  depthPaddingM?: number
  minNearM?: number
}
export interface ShadowFitResult {
  worldBounds: { min: Point; max: Point }
  /** Preserved world direction from light target toward the light. */
  direction: Point
  lightPosition: Point
  targetPosition: Point
  frustum: { left: number; right: number; top: number; bottom: number; near: number; far: number }
  texelWorldM: { x: number; y: number }
}

function worldPosition(object: Object3D, point: Vector3): void {
  if (object.parent) {
    object.parent.updateWorldMatrix(true, false)
    object.position.copy(object.parent.worldToLocal(point.clone()))
  } else object.position.copy(point)
  object.updateWorldMatrix(true, false)
}

/** Move light and target together to the supplied geometry, preserving their
 * world direction. Moving a directional light does not alter illumination;
 * its shadow camera now follows the same real casters/receivers. Orthographic
 * projection bounds come from all eight Box3 corners in that camera's actual
 * light-space matrix, so a long or translated room is not origin-cropped.
 */
export function fitBenchKeyShadow(key: Pick<KeyLight, 'light'>, bounds: Box3,
  options: ShadowFitOptions = {}): ShadowFitResult {
  const light = key?.light
  const shadow = light?.shadow
  const camera = shadow?.camera
  if (!light?.isDirectionalLight || !camera?.isOrthographicCamera)
    throw new Error('Bench shadow fit requires the existing directional light and orthographic shadow camera')
  const padding = options.paddingM ?? .25
  const depthPadding = options.depthPaddingM ?? .5
  const minNear = options.minNearM ?? .05
  if (![padding, depthPadding, minNear].every(Number.isFinite) || padding < 0 || depthPadding < 0 || minNear <= 0)
    throw new Error('Invalid bench shadow padding/near plane')
  if (!(bounds instanceof Box3) || bounds.isEmpty()
    || ![...bounds.min.toArray(), ...bounds.max.toArray()].every(Number.isFinite))
    throw new Error('Bench shadow fit requires finite nonempty world geometry bounds')
  const centre = bounds.getCenter(new Vector3()), radius = bounds.getSize(new Vector3()).length() / 2
  if (!Number.isFinite(radius) || radius <= 0) throw new Error('Bench shadow geometry bounds have no finite extent')
  if (![shadow.mapSize.x, shadow.mapSize.y].every(v => Number.isFinite(v) && v > 0))
    throw new Error('Bench shadow map dimensions must be positive')

  light.updateWorldMatrix(true, false)
  light.target.updateWorldMatrix(true, false)
  const oldPosition = light.getWorldPosition(new Vector3())
  const oldTarget = light.target.getWorldPosition(new Vector3())
  const direction = oldPosition.clone().sub(oldTarget)
  const oldDistance = direction.length()
  if (!Number.isFinite(oldDistance) || oldDistance <= 1e-8)
    throw new Error('Bench shadow light direction is undefined')
  direction.divideScalar(oldDistance)
  // Keep a valid positive depth for every corner, even if the new room is
  // larger than the old light-target separation. The light direction is fixed.
  const distance = Math.max(oldDistance, radius + depthPadding + minNear)
  const position = centre.clone().addScaledVector(direction, distance)
  worldPosition(light.target, centre)
  worldPosition(light, position)
  light.target.updateWorldMatrix(true, false)
  light.updateWorldMatrix(true, false)
  shadow.updateMatrices(light)

  let left = Infinity, right = -Infinity, bottom = Infinity, top = -Infinity
  let nearest = Infinity, furthest = -Infinity
  const corner = new Vector3()
  for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y])
    for (const z of [bounds.min.z, bounds.max.z]) {
      corner.set(x, y, z).applyMatrix4(camera.matrixWorldInverse)
      left = Math.min(left, corner.x); right = Math.max(right, corner.x)
      bottom = Math.min(bottom, corner.y); top = Math.max(top, corner.y)
      nearest = Math.min(nearest, -corner.z); furthest = Math.max(furthest, -corner.z)
    }
  const cx = (left + right) / 2, cy = (bottom + top) / 2
  const halfWidth = Math.max(.005, (right - left) / 2 + padding)
  const halfHeight = Math.max(.005, (top - bottom) / 2 + padding)
  camera.left = cx - halfWidth; camera.right = cx + halfWidth
  camera.bottom = cy - halfHeight; camera.top = cy + halfHeight
  camera.near = Math.max(minNear, nearest - depthPadding)
  camera.far = Math.max(camera.near + minNear, furthest + depthPadding)
  camera.zoom = 1
  if (camera.view?.enabled) camera.clearViewOffset()
  camera.updateProjectionMatrix()
  shadow.bias = -.00005
  shadow.normalBias = .002
  // Preserve calm's disabled shadows; do not turn a tier's map rendering on.
  if (light.castShadow) shadow.needsUpdate = true
  shadow.updateMatrices(light)
  return {
    worldBounds: { min: bounds.min.toArray() as Point, max: bounds.max.toArray() as Point },
    direction: direction.toArray() as Point,
    lightPosition: light.getWorldPosition(new Vector3()).toArray() as Point,
    targetPosition: light.target.getWorldPosition(new Vector3()).toArray() as Point,
    frustum: { left: camera.left, right: camera.right, top: camera.top, bottom: camera.bottom,
      near: camera.near, far: camera.far },
    texelWorldM: { x: (camera.right - camera.left) / shadow.mapSize.x,
      y: (camera.top - camera.bottom) / shadow.mapSize.y },
  }
}
