import { BufferGeometry, Float32BufferAttribute, ShapeUtils, Vector2 } from 'three/webgpu'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

type Profile = readonly (readonly [number, number])[]
const TAU = Math.PI * 2

/** Revolve a closed radius/height section about Y, keeping the bevels crisp. */
export function revolve(
  profile: Profile,
  segments = 192,
  start = 0,
  sweep = TAU,
): BufferGeometry {
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  const count = Math.max(1, Math.floor(segments))
  // A counterclockwise section has its solid on the left of each edge.
  const area = profile.reduce((sum, point, i) => {
    const next = profile[(i + 1) % profile.length]!
    return sum + point[0] * next[1] - next[0] * point[1]
  }, 0)
  const sectionSign = area >= 0 ? 1 : -1
  const sweepSign = sweep >= 0 ? 1 : -1

  for (let strip = 0; strip < profile.length; strip++) {
    const a = profile[strip]!
    const b = profile[(strip + 1) % profile.length]!
    const dr = b[0] - a[0]
    const dy = b[1] - a[1]
    const distance = Math.hypot(dr, dy)
    if (distance < 1e-8) continue
    const nr = (dy / distance) * sectionSign
    const ny = (-dr / distance) * sectionSign
    const base = positions.length / 3

    for (let segment = 0; segment <= count; segment++) {
      const fraction = segment / count
      const angle = start + sweep * fraction
      const x = Math.cos(angle)
      const z = Math.sin(angle)
      for (const [radius, height] of [a, b]) {
        positions.push(x * radius, height, z * radius)
        normals.push(x * nr, ny, z * nr)
        uvs.push(fraction, height)
      }
    }

    for (let segment = 0; segment < count; segment++) {
      const a0 = base + segment * 2
      const b0 = a0 + 1
      const a1 = a0 + 2
      const b1 = a0 + 3
      const front = sectionSign * sweepSign > 0
      // At the axis only one triangle of the quad has a nonzero area.
      if (b[0] > 1e-8) {
        if (front) indices.push(a0, b0, b1)
        else indices.push(a0, b1, b0)
      }
      if (a[0] > 1e-8) {
        if (front) indices.push(a0, b1, a1)
        else indices.push(a0, a1, b1)
      }
    }
  }

  if (Math.abs(sweep) < TAU - 1e-6 && profile.length >= 3) {
    const contour = profile.map(([radius, height]) => new Vector2(radius, height))
    const faces = ShapeUtils.triangulateShape(contour, [])
    for (const end of [0, 1]) {
      const angle = start + sweep * end
      const x = Math.cos(angle)
      const z = Math.sin(angle)
      const direction = (end === 0 ? -1 : 1) * sweepSign
      const base = positions.length / 3
      for (const [radius, height] of profile) {
        positions.push(x * radius, height, z * radius)
        normals.push(-z * direction, 0, x * direction)
        uvs.push(radius, height)
      }
      for (const face of faces) {
        const [ia, ib, ic] = face as [number, number, number]
        const a = profile[ia]!
        const b = profile[ib]!
        const c = profile[ic]!
        const winding = (b[0] - a[0]) * (c[1] - a[1])
          - (b[1] - a[1]) * (c[0] - a[0])
        if (winding * direction > 0) indices.push(base + ia, base + ib, base + ic)
        else indices.push(base + ia, base + ic, base + ib)
      }
    }
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

/** Collapse compatible stone parts into one draw and release their buffers. */
export function combine(geometries: BufferGeometry[]): BufferGeometry {
  if (geometries.length === 0) return new BufferGeometry()
  const geometry = mergeGeometries(geometries, false)
  if (!geometry) throw new Error('Mandala geometry attributes must match')
  for (const part of geometries) part.dispose()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

function ringProfile(
  inner: number,
  outer: number,
  bottom: number,
  top: number,
  bevel: number,
): Profile {
  const b = Math.max(0, Math.min(bevel, (outer - inner) * 0.49, (top - bottom) * 0.49))
  return [
    [inner + b, bottom],
    [outer - b, bottom],
    [outer, bottom + b],
    [outer, top - b],
    [outer - b, top],
    [inner + b, top],
    [inner, top - b],
    [inner, bottom + b],
  ]
}

/** A solid annular slab, with top and underside chamfers that catch the lamps. */
export function stoneRing(
  inner: number,
  outer: number,
  bottom: number,
  top: number,
  bevel = 0.10,
  segments = 192,
): BufferGeometry {
  return revolve(ringProfile(inner, outer, bottom, top, bevel), segments)
}

/** Two stone rails and eight narrow spokes leave real apertures to the map below. */
export function piercedCourt(): BufferGeometry {
  const parts = [
    stoneRing(3.0, 3.7, 1.5, 2.2, 0.10, 128),
    stoneRing(7.1, 7.8, 1.5, 2.2, 0.10, 128),
  ]
  for (let spoke = 0; spoke < 8; spoke++) {
    parts.push(revolve(
      ringProfile(3.56, 7.24, 1.5, 2.2, 0.10),
      4,
      (spoke * TAU) / 8 - 0.07,
      0.14,
    ))
  }
  return combine(parts)
}
