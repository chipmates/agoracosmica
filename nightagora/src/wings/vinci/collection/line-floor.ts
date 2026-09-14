/** The unchanged line bench's floor, fitted to this room by its host.
 * The bench brings walls for its own stage. This room already has walls, so
 * its paving and twelve complete date sockets stand here on the room grid.
 */
import { BufferGeometry, Float32BufferAttribute, Group, Mesh, type Material } from 'three/webgpu'
import { createLine, STUDS, STUD_SPACING, type LineMaterials } from '../line'
import { LINE_FIELD, LINE_ORIGIN, LINE_SLAB, ROOMS } from './layout'

export const COLLECTION_LINE_SECTIONS = [
  { station: 'line-early', selected: 0, row: 0 },
  { station: 'line-late', selected: 28, row: 4 },
  { station: 'line-amboise', selected: 38, row: 8 },
] as const
/** Row nine is the north end of the field the room is cut around. */
export const COLLECTION_LINE_FIRST_NORTH = LINE_ORIGIN.north + 9 * STUD_SPACING
export const collectionLineStuds = COLLECTION_LINE_SECTIONS.flatMap(section =>
  Array.from({ length: 4 }, (_, offset) => ({
    station: section.station,
    sourceIndex: section.selected + offset,
    id: STUDS[section.selected + offset]!.id,
    date: STUDS[section.selected + offset]!.date,
    certainty: STUDS[section.selected + offset]!.certainty,
    east: LINE_ORIGIN.east,
    north: COLLECTION_LINE_FIRST_NORTH - (section.row + offset) * STUD_SPACING,
  })),
)

// Position, normal, UV. Cuts interpolate the factory's original attributes.
type Vertex = number[]
type Buffers = { position: number[]; normal: number[]; uv: number[] }
const EPS = .00002
const near = (value: number, expected: number): boolean => Math.abs(value - expected) < EPS
function clip(vertices: Vertex[], axis: number, edge: number, keepAbove: boolean): Vertex[] {
  if (!vertices.length) return []
  const output: Vertex[] = []
  let previous = vertices[vertices.length - 1]!
  let previousInside = keepAbove ? previous[axis]! >= edge : previous[axis]! <= edge
  for (const vertex of vertices) {
    const inside = keepAbove ? vertex[axis]! >= edge : vertex[axis]! <= edge
    if (inside !== previousInside) {
      const share = (edge - previous[axis]!) / (vertex[axis]! - previous[axis]!)
      output.push(vertex.map((value, component) => previous[component]! + share * (value - previous[component]!)))
    }
    if (inside) output.push(vertex)
    previous = vertex; previousInside = inside
  }
  return output
}

/** Retain original triangles; only a paver cut by the room is clipped. */
export function createCollectionLineFloor(materials: LineMaterials, language: 'en' | 'de'): Group {
  const floor = new Group()
  floor.name = 'vinci/collection-line-floor'
  floor.userData['studs'] = collectionLineStuds
  floor.userData['manifestId'] = 'vinci/collection-line-floor'
  floor.userData['sourceManifestIds'] = ['vinci/line-geometry']
  const batches = new Map<Material, Buffers>()
  const owned = new Set<Material>(), used = new Set<Material>()
  const limits = {
    west: LINE_FIELD.west - LINE_ORIGIN.east,
    east: LINE_FIELD.east - LINE_ORIGIN.east,
    front: Math.max(LINE_ORIGIN.north - ROOMS.gallery.north, LINE_ORIGIN.north - LINE_FIELD.north),
    back: LINE_ORIGIN.north - ROOMS.gallery.south,
  }
  function append(material: Material, polygon: Vertex[]): void {
    if (polygon.length < 3) return
    let buffer = batches.get(material)
    if (!buffer) {
      buffer = { position: [], normal: [], uv: [] }
      batches.set(material, buffer)
    }
    used.add(material)
    for (let i = 1; i < polygon.length - 1; i++) {
      for (const vertex of [polygon[0]!, polygon[i]!, polygon[i + 1]!]) {
        buffer.position.push(vertex[0]!, vertex[1]!, vertex[2]!)
        buffer.normal.push(vertex[3]!, vertex[4]!, vertex[5]!)
        buffer.uv.push(vertex[6]!, vertex[7]!)
      }
    }
  }
  for (const section of COLLECTION_LINE_SECTIONS) {
    const source = createLine(materials, section.selected, language, false)
    source.updateMatrixWorld(true)
    source.traverse(object => {
      if (!(object instanceof Mesh) || Array.isArray(object.material)) return
      const material = object.material
      if (material.userData['owned']) owned.add(material)
      const geometry = object.geometry.clone().applyMatrix4(object.matrixWorld)
      const position = geometry.getAttribute('position'), normal = geometry.getAttribute('normal')
      const uv = geometry.getAttribute('uv'), index = geometry.getIndex()
      const count = index?.count ?? position.count
      for (let at = 0; at + 2 < count; at += 3) {
        const vertices: Vertex[] = [0, 1, 2].map(corner => {
          const i = index ? index.getX(at + corner) : at + corner
          return [position.getX(i), position.getY(i), position.getZ(i),
            normal.getX(i), normal.getY(i), normal.getZ(i), uv?.getX(i) ?? 0, uv?.getY(i) ?? 0]
        })
        const lowY = Math.min(...vertices.map(vertex => vertex[1]!))
        const highY = Math.max(...vertices.map(vertex => vertex[1]!))
        if (highY > .02 + EPS) continue
        // A height ceiling alone keeps architectural bottom faces at floor
        // level. These exact levels and normals select native paving boxes.
        if (section.row === 0) {
          const paver = material === materials.stone
            && vertices.every(vertex => near(vertex[1]!, -.19) || near(vertex[1]!, -.01))
            && vertices.every(vertex => near(Math.abs(vertex[0]! - Math.round(vertex[0]! / LINE_SLAB.pitchEast) * LINE_SLAB.pitchEast), LINE_SLAB.width / 2))
            && !(near(lowY, -.01) && vertices.every(vertex => vertex[4]! < -.99))
          const bed = material === materials.dark
            && vertices.every(vertex => near(vertex[1]!, -.222) || near(vertex[1]!, -.022))
            && vertices.every(vertex => near(Math.abs(vertex[0]!), LINE_SLAB.pitchEast * 3.5))
          const middle = paver && vertices.every(vertex => Math.abs(vertex[0]!) <= LINE_SLAB.width / 2 + EPS)
          const replaced = middle && vertices.every(vertex => vertex[2]! >= -9 * STUD_SPACING - LINE_SLAB.depth / 2 - EPS
            && vertex[2]! <= 2 * STUD_SPACING + LINE_SLAB.depth / 2 + EPS)
          if ((paver && !replaced) || bed) {
            let polygon = clip(vertices, 0, limits.west, true)
            polygon = clip(polygon, 0, limits.east, false)
            polygon = clip(polygon, 2, limits.front, true)
            polygon = clip(polygon, 2, limits.back, false)
            append(material, polygon)
          }
        }
        // All four dates are copied whole. Lettering is left-aligned beside
        // the socket and reaches beyond the centre slab into the next course.
        const socketStone = material === materials.stone
        const socketDetail = material === materials.bronze || material === materials.ink || material.userData['owned'] === true
        if (!socketStone && !socketDetail) continue
        const right = socketStone ? .801 : 1.9
        if (!vertices.every(vertex => vertex[0]! >= -.801 && vertex[0]! <= right
          && vertex[2]! >= -3 * STUD_SPACING - .82 && vertex[2]! <= .82)) continue
        const translated = vertices.map(vertex => {
          const copy = [...vertex]
          copy[0] = -vertex[0]!
          copy[2] = -vertex[2]! + (section.row - 9) * STUD_SPACING
          copy[3] = -vertex[3]!
          copy[5] = -vertex[5]!
          return copy
        })
        append(material, translated)
      }
      geometry.dispose()
    })
    source.traverse(object => { if (object instanceof Mesh) object.geometry.dispose() })
  }
  for (const [material, buffer] of batches) {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(buffer.position, 3))
    geometry.setAttribute('normal', new Float32BufferAttribute(buffer.normal, 3))
    geometry.setAttribute('uv', new Float32BufferAttribute(buffer.uv, 2))
    geometry.computeBoundingBox(); geometry.computeBoundingSphere()
    const mesh = new Mesh(geometry, material)
    mesh.name = `vinci/collection-line-floor/${material.name || 'surface'}`
    mesh.receiveShadow = true
    mesh.userData['manifestId'] = 'vinci/collection-line-floor'
    mesh.userData['sourceManifestIds'] = ['vinci/line-geometry']
    floor.add(mesh)
  }
  for (const material of owned) if (!used.has(material)) material.dispose()
  return floor
}
