import { BoxGeometry, type BufferGeometry } from 'three/webgpu'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'

/** Leather-covered board in metres, centred like BoxGeometry: width on X,
 * thickness on Y, depth on Z. The roll stays inside the requested dimensions. */
export function roundedBoardGeometry(width: number, height: number, depth: number, radius = 0.0012): BufferGeometry {
  if (![width, height, depth].every(value => Number.isFinite(value) && value > 0)) {
    throw new RangeError('Binding dimensions must be finite positive lengths')
  }
  if (!Number.isFinite(radius) || radius < 0) {
    throw new RangeError('Binding edge radius must be finite and non-negative')
  }

  const roll = Math.min(radius, width / 2, height / 2, depth / 2)
  if (roll === 0) {
    const geometry = new BoxGeometry(width, height, depth)
    geometry.computeBoundingBox()
    geometry.computeBoundingSphere()
    return geometry
  }

  // Three corner segments leave broad flat board faces between the rounded
  // edges. Preserve the addon's smooth normals and per-face UV seams.
  const rounded = new RoundedBoxGeometry(width, height, depth, 3, roll)
  // RoundedBoxGeometry is non-indexed; the furniture weld also includes
  // indexed boxes. mergeVertices indexes without joining normal/UV seams.
  const geometry = mergeVertices(rounded, 1e-7)
  rounded.dispose()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}
