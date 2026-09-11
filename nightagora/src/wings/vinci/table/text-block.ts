import { BufferGeometry, Float32BufferAttribute } from 'three/webgpu'

const WIDTH_SEGMENTS = 24
const DEPTH_SEGMENTS = 4
const LEAF_BANDS = 24

/** Top of a swollen section, relative to its centred bounding box.
 * u=0 is the gutter and u=1 the fore-edge, for either side of the binding.
 * The shallow crown reaches the exact requested half-height at u=0.5.
 * Both halves have zero slope there, so the profile is continuously smooth.
 */
export function textBlockTop(u: number, height: number): number {
  const across = Math.max(0, Math.min(1, u))
  const shoulder = (across * 2 - 1) ** 2
  const drop = across < 0.5 ? 0.16 : 0.075
  return height * (0.5 - drop * shoulder)
}

/** An exhibition text block in metres, centred like BoxGeometry.
 * Its page bands run around the entire section: head, fore-edge, foot and
 * gutter. They represent small groups of leaves, not an invented leaf count.
 * Every groove cuts inward; the exact width/height/depth bounds are retained.
 * One block is 5,760 triangles, or 11,520 for the complete open binding.
 */
export function textBlockGeometry(width: number, height: number, depth: number, side: -1 | 1): BufferGeometry {
  if (![width, height, depth].every(value => Number.isFinite(value) && value > 0)) {
    throw new RangeError('Text-block dimensions must be finite positive lengths')
  }
  if (side !== -1 && side !== 1) throw new RangeError('Text-block side must be -1 or 1')

  const positions: number[] = [], uvs: number[] = [], indices: number[] = []
  const add = (x: number, y: number, z: number, u: number, v: number) => {
    const index = positions.length / 3
    positions.push(x, y, z)
    uvs.push(u, v)
    return index
  }
  const triangle = (a: number, b: number, c: number, reverse = false) => {
    if (reverse) indices.push(a, c, b)
    else indices.push(a, b, c)
  }
  // x is expressed in world-left-to-right order for consistent winding.
  const across = (x: number) => side === 1 ? x : 1 - x
  const top = (x: number) => textBlockTop(across(x), height)
  const bottom = -height / 2

  for (const upper of [false, true]) {
    const start = positions.length / 3
    for (let z = 0; z <= DEPTH_SEGMENTS; z++) {
      for (let x = 0; x <= WIDTH_SEGMENTS; x++) {
        const u = x / WIDTH_SEGMENTS, v = z / DEPTH_SEGMENTS
        add((u - 0.5) * width, upper ? top(u) : bottom, (v - 0.5) * depth, u, v)
      }
    }
    for (let z = 0; z < DEPTH_SEGMENTS; z++) {
      for (let x = 0; x < WIDTH_SEGMENTS; x++) {
        const a = start + z * (WIDTH_SEGMENTS + 1) + x
        const b = a + 1, c = a + WIDTH_SEGMENTS + 1, d = c + 1
        triangle(a, c, b, !upper)
        triangle(b, c, d, !upper)
      }
    }
  }

  // A counter-clockwise path seen from above, with no repeated corner.
  // The caps and the first/last side rings meet at identical coordinates.
  const perimeter: Array<readonly [number, number]> = []
  for (let x = 0; x < WIDTH_SEGMENTS; x++) perimeter.push([x / WIDTH_SEGMENTS, 0])
  for (let z = 0; z < DEPTH_SEGMENTS; z++) perimeter.push([1, z / DEPTH_SEGMENTS])
  for (let x = WIDTH_SEGMENTS; x > 0; x--) perimeter.push([x / WIDTH_SEGMENTS, 1])
  for (let z = DEPTH_SEGMENTS; z > 0; z--) perimeter.push([0, z / DEPTH_SEGMENTS])

  const grooveDepth = Math.min(0.00014, height * 0.009, width * 0.002, depth * 0.002)
  const rings = Array.from({ length: LEAF_BANDS * 2 + 1 }, (_, index) => ({
    t: index / (LEAF_BANDS * 2),
    inset: index > 0 && index < LEAF_BANDS * 2 && index % 2 === 0 ? grooveDepth : 0,
  }))

  for (let strip = 0; strip < rings.length - 1; strip++) {
    const start = positions.length / 3
    for (const ring of [rings[strip]!, rings[strip + 1]!]) {
      for (const [u, v] of perimeter) {
        // A broad, tiny departure of a section from mechanical regularity.
        // This stays well inside the measured section and vanishes at caps.
        const wobble = Math.sin(ring.t * LEAF_BANDS * 1.7 + u * 4.3 + v * 2.1)
          * Math.sin(ring.t * Math.PI) * Math.min(0.000035, height * 0.002)
        const x = (u - 0.5) * (width - ring.inset * 2)
        const z = (v - 0.5) * (depth - ring.inset * 2)
        const y = bottom + (top(u) - bottom) * ring.t + wobble
        add(x, y, z, u, ring.t)
      }
    }
    // Separate strip vertices preserve the very shallow leaf-edge bevels;
    // sharing them vertically would average their normals into a plain box.
    for (let edge = 0; edge < perimeter.length; edge++) {
      const next = (edge + 1) % perimeter.length
      const a = start + edge, b = start + next
      const c = a + perimeter.length, d = b + perimeter.length
      triangle(a, c, b)
      triangle(b, c, d)
    }
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData['leafBands'] = LEAF_BANDS
  geometry.userData['profile'] = 'gutter-to-fore-edge swelling in metres'
  return geometry
}
