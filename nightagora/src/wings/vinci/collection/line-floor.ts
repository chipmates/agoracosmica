/** The unchanged line bench's floor, fitted to this room by its host.
 * The bench brings walls for its own stage. This room already has walls, so
 * its paving and twelve complete date sockets stand here on the room grid.
 */
import { BufferGeometry, Float32BufferAttribute, Group, Mesh, type Material } from 'three/webgpu'
import { createLine, STUDS, STUD_SPACING, type LineMaterials } from '../line'
import { LINE_FIELD, LINE_ORIGIN, LINE_SLAB, ROOMS } from './layout'

/** The exact horizontal planes of each sheet of the shared exhibition floor.
 * They are the builder's own numbers, repeated here because the offline
 * checkers that read this file take only relative imports and the builder
 * carries a merge helper. `line-floor-check` proves the two still agree. */
export const EXHIBITION_STAGE_LEVELS = {
  stone: [-.215, -.015],
  bed: [-.2195, -.0195],
} as const

/** HOW EACH EXCERPT IS LETTERED: the first is read standing over it, each
 * word beside its socket and each year at the visitor's feet; the two down
 * the room are read from its south end, where a stacked date runs into the
 * next, so each of their dates is laid as one row. */
export const COLLECTION_LINE_SECTIONS = [
  { station: 'line-early', selected: 0, row: 0, lettering: 'stacked' },
  { station: 'line-late', selected: 28, row: 4, lettering: 'row' },
  { station: 'line-amboise', selected: 38, row: 8, lettering: 'row' },
] as const
/** THE LIFE RUNS AWAY FROM THE VISITOR. The one station stands at the south
 * end, where every numeral reads upright, so the birth is the date at the
 * standing eye's own feet and the last year is at the far wall. The twelve
 * courses are the same twelve places on the floor either way round; which
 * date stands on which is what this line fixes. */
export const COLLECTION_LINE_FIRST_NORTH = LINE_ORIGIN.north - 2 * STUD_SPACING
export const collectionLineStuds = COLLECTION_LINE_SECTIONS.flatMap(section =>
  Array.from({ length: 4 }, (_, offset) => ({
    station: section.station,
    sourceIndex: section.selected + offset,
    id: STUDS[section.selected + offset]!.id,
    date: STUDS[section.selected + offset]!.date,
    certainty: STUDS[section.selected + offset]!.certainty,
    east: LINE_ORIGIN.east,
    north: COLLECTION_LINE_FIRST_NORTH + (section.row + offset) * STUD_SPACING,
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

/** The footprints the collection assigned before the benches acquired their
 * larger independent stages. Their upright exhibits keep the new geometry;
 * only the paving is cut to the footprint this host has space for.
 */
export const COLLECTION_EXHIBIT_FLOORS = {
  grave: { width: 12, depth: 13 },
  deathbed: { width: 13, depth: 12 },
  quotes: { width: 13, depth: 12 },
} as const

export function fitCollectionExhibitFloor(group: Group, materials: Pick<LineMaterials, 'stone' | 'dark'>,
  kind: keyof typeof COLLECTION_EXHIBIT_FLOORS): void {
  const footprint = COLLECTION_EXHIBIT_FLOORS[kind]
  group.traverse(object => {
    if (!(object instanceof Mesh) || Array.isArray(object.material)) return
    const stone = object.material === materials.stone, dark = object.material === materials.dark
    if (!stone && !dark) return
    const geometry = object.geometry, position = geometry.getAttribute('position'), index = geometry.getIndex()
    const names = ['position', ...Object.keys(geometry.attributes).filter(name => name !== 'position')]
    const attributes = names.map(name => geometry.getAttribute(name))
    const buffers = attributes.map(() => [] as number[])
    let touched = false
    for (let at = 0; at < (index?.count ?? position.count); at += 3) {
      const vertices: Vertex[] = [0, 1, 2].map(corner => {
        const i = index ? index.getX(at + corner) : at + corner
        return attributes.flatMap(attribute => Array.from({ length: attribute.itemSize }, (_, component) => attribute.getComponent(i, component)))
      })
      // Exact native stage levels distinguish paving from any low plinth or
      // downward face of the wall. All other triangles pass through intact.
      const floor = vertices.every(vertex =>
        EXHIBITION_STAGE_LEVELS[stone ? 'stone' : 'bed'].some(level => near(vertex[1]!, level)))
      let polygon = vertices
      if (floor) {
        touched = true
        polygon = clip(polygon, 0, -footprint.width / 2, true)
        polygon = clip(polygon, 0, footprint.width / 2, false)
        polygon = clip(polygon, 2, 2.5 - footprint.depth / 2, true)
        polygon = clip(polygon, 2, 2.5 + footprint.depth / 2, false)
      }
      for (let i = 1; i < polygon.length - 1; i++) for (const vertex of [polygon[0]!, polygon[i]!, polygon[i + 1]!]) {
        let offset = 0
        for (const [channel, attribute] of attributes.entries()) {
          buffers[channel]!.push(...vertex.slice(offset, offset + attribute.itemSize))
          offset += attribute.itemSize
        }
      }
    }
    if (!touched) return
    const fitted = new BufferGeometry()
    for (const [channel, attribute] of attributes.entries()) {
      fitted.setAttribute(names[channel]!, new Float32BufferAttribute(buffers[channel]!, attribute.itemSize, attribute.normalized))
    }
    fitted.computeBoundingBox(); fitted.computeBoundingSphere()
    object.geometry = fitted
    geometry.dispose()
    object.userData['sourceManifestIds'] = [...new Set([
      ...(object.userData['sourceManifestIds'] ?? []), object.userData['manifestId'],
    ].filter(Boolean))]
    object.userData['manifestId'] = 'vinci/collection-exhibit-floors'
  })
  group.userData['collectionFloorFootprint'] = { ...footprint, centreZ: 2.5 }
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
  /** THE THREE SECTIONS ARE CUT FROM THREE BUILDS of the bench, and each
   * build makes its own inlay material per certainty. The colour is the
   * certainty's, not the section's, so one material serves all three and the
   * floor draws each certainty once instead of once per section. */
  const byCertainty = new Map<string, Material>()
  const canonical = (material: Material): Material => {
    if (material.userData['owned'] !== true) return material
    const first = byCertainty.get(material.name)
    if (first) return first
    byCertainty.set(material.name, material)
    return material
  }
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
    const source = createLine(materials, section.selected, language, false, section.lettering)
    source.updateMatrixWorld(true)
    source.traverse(object => {
      if (!(object instanceof Mesh) || Array.isArray(object.material)) return
      if (object.material.userData['owned']) owned.add(object.material)
      const material = canonical(object.material)
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
        // All four dates are copied whole. Each row starts beside its socket
        // and reaches across the courses east of it.
        const socketStone = material === materials.stone
        const socketDetail = material === materials.bronze || material === materials.year || material === materials.ink
          || material.userData['owned'] === true
        if (!socketStone && !socketDetail) continue
        const right = socketStone ? .801 : 3.6
        if (!vertices.every(vertex => vertex[0]! >= -.801 && vertex[0]! <= right
          && vertex[2]! >= -3 * STUD_SPACING - .82 && vertex[2]! <= .82)) continue
        // The visitor reads from the south end, and the excerpt already runs
        // the way the life does: the earliest of its four at the south. So
        // the whole excerpt is carried onto its own course as one piece, which
        // keeps every numeral's bearing as the bench cut it.
        const translated = vertices.map(vertex => {
          const copy = [...vertex]
          copy[2] = vertex[2]! + (2 - section.row) * STUD_SPACING
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
