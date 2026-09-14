import { BufferGeometry, Float32BufferAttribute } from 'three/webgpu'
import type { PartSpec } from './types'

type Point = readonly [number, number, number]

/** Keep the full X spoke and replace only the Z spoke's render surface.
 * Both dossier parts remain identity children of the same rotating shaft.
 *
 * X occupies [-.6,.6] × [-.015,.015] × [-.02,.02]. Removing that
 * central Z interval from Z therefore preserves X union Z exactly. Every
 * exposed point, extremum and joint transform stays in the combined object.
 * The two new arm ends are open into X: there are no added internal caps,
 * invented joins, displacement, bevels or duplicate coplanar top faces.
 *
 * This is a rendering cleanup, not a different structural reconstruction.
 * The shaft also encloses the central overlap, so this alone need not change
 * the visible hub. The caller must keep spoke-x and the existing hierarchy.
 */
export function createFlywheelSpokeArms(spokeZ: PartSpec, spokeX: PartSpec): BufferGeometry {
  const identity = (values: readonly number[]): boolean => values.length === 3 && values.every(value => value === 0)
  const admits = (part: PartSpec, id: string, dimensions: Point): boolean =>
    part.id === id && part.parent === 'rotor' && part.shape === 'box'
    && identity(part.position_m) && identity(part.orientation_rad)
    && part.dimensions_m.x === dimensions[0]
    && part.dimensions_m.y === dimensions[1]
    && part.dimensions_m.z === dimensions[2]
  if (!admits(spokeZ, 'spoke-z', [.04, .03, 1.2]) || !admits(spokeX, 'spoke-x', [1.2, .03, .04])) {
    throw new Error('Flywheel overlap cleanup requires the two unchanged coplanar dossier spokes')
  }

  // Quantize each plane once, just as the original BoxGeometry attribute
  // does. Translating smaller BoxGeometry instances would round twice and
  // could move the original ±.6 endpoints or create a microscopic seam.
  const halfX = Math.fround(spokeZ.dimensions_m.x! / 2)
  const halfY = Math.fround(spokeZ.dimensions_m.y! / 2)
  const halfZ = Math.fround(spokeZ.dimensions_m.z! / 2)
  const cutZ = Math.fround(spokeX.dimensions_m.z! / 2)
  const position: number[] = [], normal: number[] = [], uv: number[] = [], indices: number[] = []

  const quad = (points: readonly [Point, Point, Point, Point], outward: Point): void => {
    const start = position.length / 3
    for (const p of points) {
      position.push(...p)
      normal.push(...outward)
      // Match geometry.ts metricPlanarUV for the ORIGINAL complete Z beam.
      // V follows its long axis on its four sides. The terminal caps retain
      // their original metre coordinates. Neither arm restarts the grain.
      if (outward[0] !== 0) uv.push(p[1], p[2])
      else if (outward[1] !== 0) uv.push(p[0], p[2])
      else uv.push(p[1], p[0])
    }
    indices.push(start, start + 1, start + 2, start, start + 2, start + 3)
  }
  const arm = (lowZ: number, highZ: number, negative: boolean): void => {
    quad([[halfX, -halfY, lowZ], [halfX, halfY, lowZ], [halfX, halfY, highZ], [halfX, -halfY, highZ]], [1, 0, 0])
    quad([[-halfX, -halfY, lowZ], [-halfX, -halfY, highZ], [-halfX, halfY, highZ], [-halfX, halfY, lowZ]], [-1, 0, 0])
    quad([[-halfX, halfY, lowZ], [-halfX, halfY, highZ], [halfX, halfY, highZ], [halfX, halfY, lowZ]], [0, 1, 0])
    quad([[-halfX, -halfY, lowZ], [halfX, -halfY, lowZ], [halfX, -halfY, highZ], [-halfX, -halfY, highZ]], [0, -1, 0])
    if (negative) {
      quad([[-halfX, -halfY, lowZ], [-halfX, halfY, lowZ], [halfX, halfY, lowZ], [halfX, -halfY, lowZ]], [0, 0, -1])
    } else {
      quad([[-halfX, -halfY, highZ], [halfX, -halfY, highZ], [halfX, halfY, highZ], [-halfX, halfY, highZ]], [0, 0, 1])
    }
  }
  arm(-halfZ, -cutZ, true)
  arm(cutZ, halfZ, false)

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(position, 3))
  geometry.setAttribute('normal', new Float32BufferAttribute(normal, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  geometry.setIndex(indices)
  geometry.name = 'spoke-z:dossier-surface:covered-overlap-removed'
  geometry.userData = {
    sourcePart: 'spoke-z', requiredCompanion: 'spoke-x',
    retainedZIntervalsM: [[-.6, -.02], [.02, .6]],
    removedOverlapVolumeM3: .04 * .03 * .04,
    combinedExteriorPreserved: true, internalCutCaps: false,
  }
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}
