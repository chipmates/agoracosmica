import { BoxGeometry, Mesh, Vector3, type Box3, type BufferGeometry, type Material } from 'three/webgpu'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { mountBoxes, type MountBox } from './mounts'

export interface BenchSupportOptions {
  slug: string
  /** Original dossier allocation, including its specified ground level. */
  machineBounds: Box3
  /** Existing camera/plinth allocation; the crane uses its occupied footprint. */
  displayBounds: Box3
  ironMaterial: Material
  groundMaterial: Material
}

export interface BenchSupports {
  /** One iron mesh and one separate floor mesh, in that order. */
  meshes: [Mesh, Mesh]
  /** Caller owns disposal. Supplied materials remain caller-owned. */
  geometries: [BufferGeometry, BoxGeometry]
}

/** GENERATED modern exhibition hardware, outside the authored machine.
 * Preserve every box face, index, normal and UV; bake only its translation
 * before merging the iron boxes into a single material submission. Baking
 * rounds positions once to their existing Float32 attribute precision.
 * The library samples this iron from world position, so its photograph and
 * three detail scales stay aligned across the original box boundaries.
 */
export function buildBenchSupports(options: BenchSupportOptions): BenchSupports {
  const { slug, machineBounds, displayBounds, ironMaterial, groundMaterial } = options
  const size = displayBounds.getSize(new Vector3())
  const centre = displayBounds.getCenter(new Vector3())
  const span = Math.max(size.x, size.y, size.z)
  const thick = span * .022
  const boxes: MountBox[] = [
    {
      size: [size.x * 1.08, thick, size.z * 1.08],
      centre: [centre.x, machineBounds.min.y - thick / 2, centre.z],
    },
    ...mountBoxes(slug),
  ]
  const inputs: BoxGeometry[] = []
  let merged: BufferGeometry | null = null
  try {
    for (const box of boxes) {
      const geometry = new BoxGeometry(...box.size)
      inputs.push(geometry)
      geometry.translate(...box.centre)
    }
    // A scalar material ignores BoxGeometry's original per-face groups.
    // Merging without groups therefore keeps exactly one iron submission.
    merged = mergeGeometries(inputs, false)
    if (!merged) throw new Error(`Could not merge exhibition supports for ${slug}`)
  } finally {
    for (const geometry of inputs) geometry.dispose()
  }
  const floorGeometry = new BoxGeometry(span * 100, span * .01, span * 100)
  const iron = new Mesh(merged, ironMaterial)
  const floor = new Mesh(floorGeometry, groundMaterial)
  iron.name = `vinci/bench/${slug}/iron-supports`
  floor.name = `vinci/bench/${slug}/floor`
  floor.position.set(centre.x, machineBounds.min.y - thick - span * .012, centre.z)
  for (const mesh of [iron, floor]) {
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.userData['assetClass'] = 'GENERATED'
    mesh.userData['manifestId'] = 'vinci/bench/support'
  }
  return { meshes: [iron, floor], geometries: [merged, floorGeometry] }
}
