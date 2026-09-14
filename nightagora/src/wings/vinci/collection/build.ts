/** One welded body per material for everything this module adds. A room is
 * still: welding it is free, and the tier budget for the whole walk is 150
 * draws with fourteen machines already inside it. */
import { BoxGeometry, BufferGeometry, Float32BufferAttribute, Mesh, Vector3, type Material } from 'three/webgpu'
import { world } from '../site'
import type { CollectionRole } from './materials'
import { collectionRoomsProvenance } from './materials'

type Point3 = [east: number, north: number, height: number]

export class RoomBatch {
  private p: number[] = []; private n: number[] = []; private u: number[] = []; private r: number[] = []
  private vertex(p: Vector3, n: Vector3, u: [number, number], role: CollectionRole): void {
    this.p.push(p.x, p.y, p.z); this.n.push(n.x, n.y, n.z); this.u.push(u[0], u[1]); this.r.push(role)
  }
  quad(a: Point3, b: Point3, c: Point3, d: Point3, role: CollectionRole, facing?: Point3): void {
    const v = [world(...a), world(...b), world(...c), world(...d)]
    const normal = v[1]!.clone().sub(v[0]!).cross(v[2]!.clone().sub(v[0]!)).normalize()
    const tex: [number, number][] = [[0, 0], [v[0]!.distanceTo(v[1]!), 0],
      [v[0]!.distanceTo(v[1]!), v[1]!.distanceTo(v[2]!)], [0, v[0]!.distanceTo(v[3]!)]]
    const reverse = facing !== undefined && normal.dot(world(...facing)) < 0
    if (reverse) normal.negate()
    for (const i of reverse ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3]) this.vertex(v[i]!, normal, tex[i]!, role)
  }
  /** A box in the wing's own frame: centre east/north/height, then its size
   * east by north by height. */
  box(east: number, north: number, height: number, width: number, depth: number, tall: number, role: CollectionRole): void {
    if (Math.min(width, depth, tall) <= 0) return
    const geometry = new BoxGeometry(width, tall, depth)
    geometry.translate(east, height, -north)
    const p = geometry.getAttribute('position'), normal = geometry.getAttribute('normal'), uv = geometry.getAttribute('uv')
    for (let j = 0; j < geometry.index!.count; j++) {
      const i = geometry.index!.getX(j), nx = Math.abs(normal.getX(i)), ny = Math.abs(normal.getY(i))
      this.vertex(new Vector3(p.getX(i), p.getY(i), p.getZ(i)),
        new Vector3(normal.getX(i), normal.getY(i), normal.getZ(i)),
        [uv.getX(i) * (nx > .5 ? depth : width), uv.getY(i) * (ny > .5 ? depth : tall)], role)
    }
    geometry.dispose()
  }
  /** A slab with a rectangular void in it, as four pieces. The floor of the
   * long gallery is cut this way around the line the museum lets into it. */
  slabAround(west: number, south: number, east: number, north: number, height: number, thickness: number,
    hole: { west: number; south: number; east: number; north: number }, role: CollectionRole): void {
    const pieces: [number, number, number, number][] = []
    const holeW = Math.max(west, hole.west), holeE = Math.min(east, hole.east)
    const holeS = Math.max(south, hole.south), holeN = Math.min(north, hole.north)
    if (holeW >= holeE || holeS >= holeN) { this.slab(west, south, east, north, height, thickness, role); return }
    if (north > holeN) pieces.push([west, holeN, east, north])
    if (south < holeS) pieces.push([west, south, east, holeS])
    if (west < holeW) pieces.push([west, holeS, holeW, holeN])
    if (east > holeE) pieces.push([holeE, holeS, east, holeN])
    for (const [w, s, e, n] of pieces) this.slab(w, s, e, n, height, thickness, role)
  }
  slab(west: number, south: number, east: number, north: number, height: number, thickness: number, role: CollectionRole): void {
    this.box((west + east) / 2, (south + north) / 2, height - thickness / 2, east - west, north - south, thickness, role)
  }
  get triangles(): number { return this.p.length / 9 }
  geometry(): BufferGeometry {
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(this.p, 3))
    g.setAttribute('normal', new Float32BufferAttribute(this.n, 3))
    g.setAttribute('uv', new Float32BufferAttribute(this.u, 2))
    g.setAttribute('collectionRoomRole', new Float32BufferAttribute(this.r, 1))
    g.computeBoundingBox(); g.computeBoundingSphere()
    return g
  }
  mesh(name: string, material: Material, cast = true): Mesh {
    const mesh = new Mesh(this.geometry(), material)
    mesh.name = name; mesh.castShadow = cast; mesh.receiveShadow = true
    mesh.userData = { manifestId: collectionRoomsProvenance.manifestId, asset: collectionRoomsProvenance.manifestId,
      assetClass: 'GENERATED', certainty: 'reconstructed' }
    return mesh
  }
}

/** Every mesh this window adds is stamped, because an unstamped mesh in the
 * collection's group inherits the pavilion's id, and the pavilion's id is a
 * rail collision solid whose geometry the clearance certificate hashes. */
export function stamp(object: { traverse: (fn: (o: unknown) => void) => void }, id: string): void {
  object.traverse(child => {
    const mesh = child as Mesh
    if (!(mesh as { isMesh?: boolean }).isMesh) return
    if (typeof mesh.userData['manifestId'] !== 'string') mesh.userData['manifestId'] = id
    mesh.userData['asset'] = mesh.userData['manifestId']
  })
}
