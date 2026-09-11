import {
  BoxGeometry, BufferGeometry, Group, Material, Mesh, Object3D, Vector3,
} from 'three/webgpu'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { createText } from '../words'

/** Reusable exhibition materials. The host supplies its TSL node materials. */
export interface ExhibitMaterials {
  stone: Material
  plaster: Material
  bronze: Material
  ink: Material
  dark: Material
}

export interface ExhibitionObject<M = Record<string, unknown>> {
  group: Group
  metadata: M
  /** Disposes owned geometry; host materials and supplied plate remain owned by the host. */
  dispose: () => void
}

/** Static construction is welded by material. The inspection switch is preserved. */
export class Construction {
  readonly group = new Group()
  private readonly batches = new Map<Material, BufferGeometry[]>()

  constructor(readonly materials: ExhibitMaterials, name: string, readonly manifestId = 'vinci/myths-geometry') {
    this.group.name = name
    this.group.userData.manifestClass = 'GENERATED'
    this.group.userData.manifestId = manifestId
  }

  geometry(geometry: BufferGeometry, material: Material): void {
    const batch = this.batches.get(material) ?? []
    batch.push(geometry)
    this.batches.set(material, batch)
  }

  box(x: number, y: number, z: number, w: number, h: number, d: number, material: Material): void {
    const geometry = new BoxGeometry(w, h, d)
    geometry.translate(x, y, z)
    this.geometry(geometry, material)
  }

  beam(from: [number, number, number], to: [number, number, number], width: number, depth: number, material: Material): void {
    const a = new Vector3(...from)
    const b = new Vector3(...to)
    const object = new Object3D()
    object.position.copy(a).add(b).multiplyScalar(0.5)
    object.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), b.clone().sub(a).normalize())
    object.updateMatrix()
    const geometry = new BoxGeometry(width, a.distanceTo(b), depth)
    geometry.applyMatrix4(object.matrix)
    this.geometry(geometry, material)
  }

  text(text: string, x: number, y: number, z: number, size: number, maxWidth: number, material = this.materials.ink, depth = 0.0018): { width: number; height: number; lines: string[]; lineWidths: number[] } {
    const result = createText(text, { size, maxWidth, material, depth, lineHeight: 1.45 })
    result.mesh.geometry.translate(x, y, z)
    this.geometry(result.mesh.geometry, material)
    return result
  }

  finish(): Group {
    const noweld = typeof location !== 'undefined' && new URLSearchParams(location.search).has('noweld')
    for (const [material, geometries] of this.batches) {
      // Text and primitives do not necessarily expose the same attribute set.
      // The physical inscriptions only need positions/normals/uv for host materials.
      const normalized = geometries.map((original) => {
        const geometry = original.index ? original.toNonIndexed() : original
        if (geometry !== original) original.dispose()
        for (const name of Object.keys(geometry.attributes)) {
          if (name !== 'position' && name !== 'normal' && name !== 'uv') geometry.deleteAttribute(name)
        }
        return geometry
      })
      const add = (geometry: BufferGeometry): void => {
        const mesh = new Mesh(geometry, material)
        mesh.castShadow = material !== this.materials.ink
        mesh.receiveShadow = true
        mesh.name = `${this.group.name}-made-surface`
        mesh.userData.manifestClass = 'GENERATED'
        mesh.userData.manifestId = this.manifestId
        this.group.add(mesh)
      }
      if (noweld) normalized.forEach(add)
      else {
        const merged = mergeGeometries(normalized, false)
        if (merged) add(merged)
        normalized.forEach((geometry) => geometry.dispose())
      }
    }
    this.batches.clear()
    return this.group
  }

  dispose(): void {
    this.group.traverse((object) => {
      if (object instanceof Mesh) object.geometry.dispose()
    })
    this.group.removeFromParent()
  }
}

/** Large backing, recessed joint bands and small edge repairs; fine grain belongs to the host material. */
export function plasterWall(build: Construction, width: number, height: number, centreY: number, z: number): void {
  const { plaster, stone, dark } = build.materials
  build.box(0, centreY, z - 0.16, width, height, 0.30, plaster)
  build.box(0, centreY - height / 2 + 0.10, z + 0.03, width + 0.12, 0.2, 0.18, stone)
  build.box(0, centreY + height / 2 - 0.06, z + 0.015, width + 0.07, 0.12, 0.16, stone)
  for (let side = -1; side <= 1; side += 2) {
    build.box(side * (width / 2 - 0.055), centreY, z + 0.015, 0.11, height, 0.13, stone)
  }
  // The irregular lower-edge wear grows denser toward the corners.
  for (let i = 0; i < 34; i++) {
    const q = i / 33
    const x = (q - 0.5) * (width - 0.3)
    const y = centreY - height / 2 + 0.27 + Math.sin(i * 7.61) * 0.04
    const length = 0.035 + Math.abs(q - 0.5) * 0.075
    build.box(x, y, z + 0.005, length, 0.006 + (i % 3) * 0.004, 0.009, i % 6 === 0 ? dark : stone)
  }
}

/** A real shallow stone floor, with staggered joints and irregular wear at the display. */
export function exhibitionFloor(build: Construction, width = 13, depth = 12): void {
  const { stone, dark } = build.materials
  build.box(0, -0.135, 2.5, width, 0.20, depth, stone)
  const minZ = 2.5 - depth / 2
  for (let row = 0; row < Math.ceil(depth / 1.4); row++) {
    const z = minZ + row * 1.4
    build.box(0, -0.033, z, width, 0.003, 0.006, dark)
    const offset = row % 2 === 0 ? 0 : 0.9
    for (let col = -4; col < 4; col++) {
      const x = col * 1.8 + offset
      if (Math.abs(x) > width / 2 - 0.3) continue
      build.box(x, -0.033, z + 0.70, 0.005, 0.003, 1.394, dark)
    }
  }
  // Tiny chipped joint ends thin toward the visitor rather than tiling uniformly.
  for (let i = 0; i < 27; i++) {
    const x = Math.sin(i * 3.76) * Math.min(width / 2 - 0.2, 4.8)
    const z = -0.9 + (i % 6) * 0.30
    build.box(x, -0.031, z, 0.018 + (i % 4) * 0.019, 0.004, 0.011, dark)
  }
}
