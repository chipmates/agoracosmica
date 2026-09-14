import { BoxGeometry, BufferGeometry, Float32BufferAttribute, Mesh, Vector3, type Box3, type Material } from 'three/webgpu'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { metricPlanarUV } from '../geometry'
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
 * Preserve every box face, index and normal; bake only its translation
 * before merging the iron boxes into a single material submission. Baking
 * rounds positions once to their existing Float32 attribute precision.
 * Each face receives a nondegenerate metre UV projection, so the iron
 * photograph and three detail scales also resolve on thin vertical reveals.
 */
/** THE ARRIS OF THE PLINTH. Seen from a phone the slab is a black card laid on
 * the fog: a box's top edge is one line where two faces both turn away from the
 * key, so nothing on the plate catches it and the edge is a cut in the air. A
 * plate of iron has its arris taken off, and that chamfer is the one strip of
 * the plate that faces the light. Built here rather than bevelled onto a box,
 * because a box has no geometry to put in the gap.
 */
function chamferedSlab(width: number, height: number, depth: number, chamfer: number): BufferGeometry {
  const x = width / 2, y = height / 2, z = depth / 2
  const c = Math.min(chamfer, Math.min(x, z, height) * .4)
  const position: number[] = [], normal: number[] = [], index: number[] = []
  const quad = (a: number[], b: number[], d: number[], e: number[], n: number[]): void => {
    const base = position.length / 3
    for (const p of [a, b, d, e]) position.push(p[0]!, p[1]!, p[2]!)
    for (let i = 0; i < 4; i++) normal.push(n[0]!, n[1]!, n[2]!)
    index.push(base, base + 1, base + 2, base, base + 2, base + 3)
  }
  const t = y, w = y - c, s2 = Math.SQRT1_2
  // the top face, drawn in by the chamfer on every side
  quad([-x + c, t, z - c], [x - c, t, z - c], [x - c, t, -z + c], [-x + c, t, -z + c], [0, 1, 0])
  // the four facets of the arris
  quad([-x + c, t, z - c], [-x, w, z], [x, w, z], [x - c, t, z - c], [0, s2, s2])
  quad([x - c, t, -z + c], [x, w, -z], [-x, w, -z], [-x + c, t, -z + c], [0, s2, -s2])
  quad([x - c, t, z - c], [x, w, z], [x, w, -z], [x - c, t, -z + c], [s2, s2, 0])
  quad([-x + c, t, -z + c], [-x, w, -z], [-x, w, z], [-x + c, t, z - c], [-s2, s2, 0])
  // the four walls, from the arris down to the floor
  quad([-x, w, z], [-x, -y, z], [x, -y, z], [x, w, z], [0, 0, 1])
  quad([x, w, -z], [x, -y, -z], [-x, -y, -z], [-x, w, -z], [0, 0, -1])
  quad([x, w, z], [x, -y, z], [x, -y, -z], [x, w, -z], [1, 0, 0])
  quad([-x, w, -z], [-x, -y, -z], [-x, -y, z], [-x, w, z], [-1, 0, 0])
  // and the underside
  quad([-x, -y, -z], [x, -y, -z], [x, -y, z], [-x, -y, z], [0, -1, 0])
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(position, 3))
  geometry.setAttribute('normal', new Float32BufferAttribute(normal, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(new Float32Array((position.length / 3) * 2), 2))
  geometry.setIndex(index)
  return geometry
}

export function buildBenchSupports(options: BenchSupportOptions): BenchSupports {
  const { slug, machineBounds, displayBounds, ironMaterial, groundMaterial } = options
  const size = displayBounds.getSize(new Vector3())
  const centre = displayBounds.getCenter(new Vector3())
  const span = Math.max(size.x, size.y, size.z)
  const thick = span * .022
  const plinth: MountBox = {
    size: [size.x * 1.08, thick, size.z * 1.08],
    centre: [centre.x, machineBounds.min.y - thick / 2, centre.z],
  }
  const boxes: MountBox[] = [plinth, ...mountBoxes(slug)]
  const inputs: BufferGeometry[] = []
  let merged: BufferGeometry | null = null
  try {
    for (const box of boxes) {
      const geometry = box === plinth
        ? chamferedSlab(box.size[0], box.size[1], box.size[2], Math.min(thick * .42, span * .007))
        : new BoxGeometry(...box.size)
      inputs.push(geometry)
      geometry.translate(...box.centre)
      metricPlanarUV(geometry)
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
