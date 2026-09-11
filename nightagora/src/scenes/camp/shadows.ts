/* THE MORNING'S SHADOWS — a fixed sun over a fixed camp needs one map,
   not a second render of every stake on every frame. Raster the actual
   constructed geometry once, in raw map space, before the planet bends.
   Black is blocked daylight; white is open sky. The hour decides how
   much that distinction matters, and the fires keep their own light. */

import {
  CanvasTexture,
  ClampToEdgeWrapping,
  type Group,
  InstancedBufferGeometry,
  LinearFilter,
  type Material,
  Mesh,
  NoColorSpace,
} from 'three/webgpu'
import { texture } from 'three/tsl'
import { DUSK_DIR } from './hour'
import { mix, type N, step, vec2 } from './tsl'

export const CAMP_SHADOW_BOUNDS = {
  minX: -34,
  maxX: 34,
  minZ: -42,
  maxZ: 38,
  width: 68,
  depth: 80,
  resolution: 1024,
} as const

const opaque = (material: Material | undefined): boolean =>
  !!material && material.visible && !material.transparent && material.opacity >= 0.98

/** Call with fort and praetorium groups BEFORE mergeStatic removes their
    source meshes. No scene visibility is needed: the camp is hidden while
    it is being built. Sprite light, mist and translucent organs never cast. */
export function createCampShadow(groups: Group[]): CanvasTexture {
  const B = CAMP_SHADOW_BOUNDS
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = B.resolution
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Camp shadow map requires a canvas 2D context')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, B.resolution, B.resolution)
  ctx.fillStyle = '#000000'

  const sx = DUSK_DIR.x / Math.max(0.05, DUSK_DIR.y)
  const sz = DUSK_DIR.z / Math.max(0.05, DUSK_DIR.y)
  const mapX = B.resolution / B.width
  const mapZ = B.resolution / B.depth
  // These two short buffers are reused for every triangle that crosses
  // ground level. Clipping first prevents submerged piles casting back
  // towards the sun through the river bed.
  const clipped = new Float64Array(12)
  const projected = new Float64Array(8)

  const raster = (mesh: Mesh): void => {
    if (!mesh.visible) return
    const geo = mesh.geometry
    const position = geo.getAttribute('position')
    if (!position || position.itemSize < 3) return
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    if (!materials.some(opaque)) return
    const index = geo.getIndex()
    const elementCount = index ? index.count : position.count
    const start = Math.max(0, geo.drawRange.start)
    const end = Math.min(elementCount, start + geo.drawRange.count)
    const ranges = Array.isArray(mesh.material) && geo.groups.length
      ? geo.groups.filter((g) => opaque(materials[g.materialIndex ?? 0]))
        .map((g) => [Math.max(start, g.start), Math.min(end, g.start + g.count)] as const)
      : [[start, end] as const]
    const offsets = geo.getAttribute('iPos')
    const scales = geo.getAttribute('iScl')
    const rotations = geo.getAttribute('iRot')
    const field = geo instanceof InstancedBufferGeometry && offsets && scales && rotations
    const instances = field ? Math.min(geo.instanceCount, offsets.count, scales.count, rotations.count) : 1
    const transformed = new Float64Array(position.count * 3)
    const matrix = mesh.matrixWorld.elements
    ctx.beginPath()
    let paths = 0

    for (let instance = 0; instance < instances; instance++) {
      const yaw = field ? rotations.getX(instance) : 0
      const c = Math.cos(yaw), s = Math.sin(yaw)
      const ix = field ? offsets.getX(instance) : 0
      const iy = field ? offsets.getY(instance) : 0
      const iz = field ? offsets.getZ(instance) : 0
      const kx = field ? scales.getX(instance) : 1
      const ky = field ? scales.getY(instance) : 1
      const kz = field ? scales.getZ(instance) : 1
      let highest = -Infinity
      for (let v = 0; v < position.count; v++) {
        const x = position.getX(v) * kx
        const y = position.getY(v) * ky + iy
        const z = position.getZ(v) * kz
        // Exactly the field() shader's scale -> yaw -> offset order.
        const rx = c * x + s * z + ix
        const rz = -s * x + c * z + iz
        const j = v * 3
        transformed[j] = matrix[0]! * rx + matrix[4]! * y + matrix[8]! * rz + matrix[12]!
        transformed[j + 1] = matrix[1]! * rx + matrix[5]! * y + matrix[9]! * rz + matrix[13]!
        transformed[j + 2] = matrix[2]! * rx + matrix[6]! * y + matrix[10]! * rz + matrix[14]!
        highest = Math.max(highest, transformed[j + 1]!)
      }
      if (highest <= 0.001) continue

      for (const [from, to] of ranges) {
        for (let i = from; i + 2 < to; i += 3) {
          const a = (index ? index.getX(i) : i) * 3
          const b = (index ? index.getX(i + 1) : i + 1) * 3
          const d = (index ? index.getX(i + 2) : i + 2) * 3
          if (Math.max(transformed[a + 1]!, transformed[b + 1]!, transformed[d + 1]!) <= 0.001) continue

          // Sutherland-Hodgman against y >= 0. A clipped triangle has at
          // most four vertices, retained in its original cyclic order.
          let count = 0
          for (let edge = 0; edge < 3; edge++) {
            const current = edge === 0 ? a : edge === 1 ? b : d
            const previous = edge === 0 ? d : edge === 1 ? a : b
            const cy = transformed[current + 1]!
            const py = transformed[previous + 1]!
            if ((cy >= 0) !== (py >= 0)) {
              const t = py / (py - cy)
              clipped[count * 3] = transformed[previous]! + (transformed[current]! - transformed[previous]!) * t
              clipped[count * 3 + 1] = 0
              clipped[count * 3 + 2] = transformed[previous + 2]! + (transformed[current + 2]! - transformed[previous + 2]!) * t
              count++
            }
            if (cy >= 0) {
              clipped[count * 3] = transformed[current]!
              clipped[count * 3 + 1] = cy
              clipped[count * 3 + 2] = transformed[current + 2]!
              count++
            }
          }
          if (count < 3) continue
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
          for (let j = 0; j < count; j++) {
            const y = clipped[j * 3 + 1]!
            const px = (clipped[j * 3]! - y * sx - B.minX) * mapX
            const pz = (clipped[j * 3 + 2]! - y * sz - B.minZ) * mapZ
            projected[j * 2] = px
            projected[j * 2 + 1] = pz
            minX = Math.min(minX, px); maxX = Math.max(maxX, px)
            minY = Math.min(minY, pz); maxY = Math.max(maxY, pz)
          }
          if (maxX < 0 || maxY < 0 || minX > B.resolution || minY > B.resolution) continue
          let area = 0
          for (let j = 0; j < count; j++) {
            const next = (j + 1) % count
            area += projected[j * 2]! * projected[next * 2 + 1]! - projected[next * 2]! * projected[j * 2 + 1]!
          }
          if (Math.abs(area) < 0.02) continue
          // Same winding for every face makes nonzero fill a UNION. The
          // hidden face of a tent must never erase the face in front.
          for (let j = 0; j < count; j++) {
            const v = area >= 0 ? j : count - j - 1
            if (j === 0) ctx.moveTo(projected[v * 2]!, projected[v * 2 + 1]!)
            else ctx.lineTo(projected[v * 2]!, projected[v * 2 + 1]!)
          }
          ctx.closePath()
          paths++
        }
      }
    }
    // One opaque fill per mesh, independent of how many stakes or cloth
    // layers overlap. No multiplicative alpha darkening in deep ranks.
    if (paths) ctx.fill()
  }

  const visited = new Set<Mesh>()
  for (const group of groups) {
    group.updateWorldMatrix(true, true)
    group.traverse((object) => {
      if (!(object instanceof Mesh) || visited.has(object)) return
      visited.add(object)
      raster(object)
    })
  }

  // A handspan of softness at this map scale, baked once at startup.
  const soft = document.createElement('canvas')
  soft.width = soft.height = B.resolution
  const blur = soft.getContext('2d')
  if (!blur) throw new Error('Camp shadow softness requires a canvas 2D context')
  blur.fillStyle = '#ffffff'
  blur.fillRect(0, 0, B.resolution, B.resolution)
  blur.filter = 'blur(1.15px)'
  blur.drawImage(canvas, 0, 0)
  const shadow = new CanvasTexture(soft)
  shadow.name = 'camp-projected-morning'
  shadow.colorSpace = NoColorSpace
  shadow.flipY = false
  shadow.minFilter = shadow.magFilter = LinearFilter
  shadow.wrapS = shadow.wrapT = ClampToEdgeWrapping
  shadow.generateMipmaps = false
  return shadow
}

/** Light visibility, 0..1. Curvature changes only world.y, so a curved
    ground fragment's xz addresses the uncurved map without correction.
    Outside the authored map remains sunlit instead of smearing an edge. */
export function sampleCampShadow(world: N, shadow: CanvasTexture): N {
  const B = CAMP_SHADOW_BOUNDS
  const address = vec2(world.x.sub(B.minX).div(B.width), world.z.sub(B.minZ).div(B.depth))
  const inside = step(0, address.x).mul(step(address.x, 1))
    .mul(step(0, address.y)).mul(step(address.y, 1))
  return mix(1, texture(shadow, address).r, inside)
}
