/**
 * Deterministic local visibility bake, evaluated once from the supplied meshes.
 * This is NOT diffuse GI: no bounce transport, light intensity or wall albedo is
 * solved. Equal-weight cosine hemisphere samples estimate the fraction of local
 * incident diffuse light blocked by the physical frame within 25 cm. The black
 * vertex-alpha receiver multiplies the detailed wall beneath it; it supplies no
 * replacement wall colour, texture, painted border, or distance falloff. As a
 * composited approximation it darkens the final wall, including direct light;
 * it is not a separate renderer-level ambient-irradiance channel.
 *
 * Build before filtering the frame batch. Placements and returned receivers use
 * the frame group's local metre coordinates; the wall is z=0 with normal +Z.
 * Geometry transforms below the supplied group are included. Callers own the
 * source group; this module never changes or disposes any source resource.
 * The full datum hang and every solo phone selection are baked up front. A
 * different subset is baked on first use; only the last such subset is cached.
 * Receiver partitioning assumes the commission's single horizontal datum row.
 */
import {
  BufferAttribute, BufferGeometry, Group, Matrix4, Mesh,
  MeshBasicNodeMaterial, Vector3, type Object3D,
} from 'three/webgpu'
import type { FramePlacement } from './frame'

export const CONTACT_BAKE_RECIPE = Object.freeze({
  version: 1,
  raysPerReceiver: 64,
  rayMaxM: .25,
  nearGridM: .01,
  farGridM: .03,
  nearBandM: .09,
  wallRayOriginM: .00005,
  receiverOffsetM: .0006,
})

export interface ContactBakeStats {
  sourceTriangles: number
  frames: number
  receivers: number
  rays: number
  blockedRays: number
  triangleTests: number
  boundsTests: number
  bakeMs: number
  peakOcclusion: number
  visibleFrames: number
  visibleTriangles: number
  /** No texture is allocated. Retained typed bake/live geometry array bytes;
   * excludes JS object bookkeeping and source triangle/BVH object storage. */
  cpuBytes: number
}

type Triple = [number, number, number]
interface Triangle {
  a: Triple
  e1: Triple
  e2: Triple
  low: Triple
  high: Triple
  centre: Triple
}
interface Branch {
  low: Triple
  high: Triple
  left?: Branch
  right?: Branch
  triangles?: Triangle[]
}
interface BakedPatch {
  id: string
  positions: Float32Array
  colours: Float32Array
  indices: Uint32Array
}
interface ReceiverBounds { low: Triple; high: Triple; count: number }
interface ClipBounds { low: [number, number]; high: [number, number] }

function triangle(a: Vector3, b: Vector3, c: Vector3): Triangle {
  return {
    a: [a.x, a.y, a.z],
    e1: [b.x - a.x, b.y - a.y, b.z - a.z],
    e2: [c.x - a.x, c.y - a.y, c.z - a.z],
    low: [Math.min(a.x, b.x, c.x), Math.min(a.y, b.y, c.y), Math.min(a.z, b.z, c.z)],
    high: [Math.max(a.x, b.x, c.x), Math.max(a.y, b.y, c.y), Math.max(a.z, b.z, c.z)],
    centre: [(a.x + b.x + c.x) / 3, (a.y + b.y + c.y) / 3, (a.z + b.z + c.z) / 3],
  }
}

function sourceTriangles(group: Object3D): Triangle[] {
  group.updateWorldMatrix(true, true)
  const inverse = group.matrixWorld.clone().invert()
  const matrix = new Matrix4()
  const a = new Vector3(), b = new Vector3(), c = new Vector3()
  const triangles: Triangle[] = []
  group.traverse(object => {
    if (!(object instanceof Mesh)) return
    if ('isInstancedMesh' in object && object.isInstancedMesh)
      throw new Error('Frame contact bake requires the welded frame batch, not instance transforms')
    const geometry = object.geometry
    const position = geometry.getAttribute('position')
    if (!position) return
    matrix.multiplyMatrices(inverse, object.matrixWorld)
    const index = geometry.getIndex()
    const count = index?.count ?? position.count
    const start = geometry.drawRange.start
    const end = Math.min(count, start + geometry.drawRange.count)
    for (let i = start; i + 2 < end; i += 3) {
      a.fromBufferAttribute(position, index ? index.getX(i) : i).applyMatrix4(matrix)
      b.fromBufferAttribute(position, index ? index.getX(i + 1) : i + 1).applyMatrix4(matrix)
      c.fromBufferAttribute(position, index ? index.getX(i + 2) : i + 2).applyMatrix4(matrix)
      if (![a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z].every(Number.isFinite))
        throw new Error('Frame contact bake found a non-finite source vertex')
      triangles.push(triangle(a, b, c))
    }
  })
  return triangles
}

function tree(triangles: Triangle[]): Branch {
  const low: Triple = [Infinity, Infinity, Infinity]
  const high: Triple = [-Infinity, -Infinity, -Infinity]
  for (const t of triangles) for (let k = 0; k < 3; k++) {
    low[k] = Math.min(low[k]!, t.low[k]!)
    high[k] = Math.max(high[k]!, t.high[k]!)
  }
  if (triangles.length <= 6) return { low, high, triangles }
  const span = high.map((v, i) => v - low[i]!)
  const axis = span[0]! >= span[1]! && span[0]! >= span[2]! ? 0 : span[1]! >= span[2]! ? 1 : 2
  triangles.sort((a, b) => a.centre[axis]! - b.centre[axis]!)
  const middle = triangles.length >> 1
  return { low, high, left: tree(triangles.slice(0, middle)), right: tree(triangles.slice(middle)) }
}

/** Hammersley points mapped uniformly to the projected disk: cosine-weighted
 * hemisphere directions, fixed for every receiver, without random state. */
function directions(): Triple[] {
  return Array.from({ length: CONTACT_BAKE_RECIPE.raysPerReceiver }, (_, i) => {
    let bits = i, inverse = 0, scale = .5
    while (bits) { inverse += (bits & 1) * scale; bits >>>= 1; scale *= .5 }
    const radial = Math.sqrt((i + .5) / CONTACT_BAKE_RECIPE.raysPerReceiver)
    const angle = 2 * Math.PI * (inverse + .17320508075688773)
    return [radial * Math.cos(angle), radial * Math.sin(angle), Math.sqrt(1 - radial * radial)]
  })
}

function intersectsTriangle(t: Triangle, x: number, y: number, d: Triple): boolean {
  // Möller–Trumbore, double-sided: visibility is independent of render winding.
  const px = d[1] * t.e2[2] - d[2] * t.e2[1]
  const py = d[2] * t.e2[0] - d[0] * t.e2[2]
  const pz = d[0] * t.e2[1] - d[1] * t.e2[0]
  const det = t.e1[0] * px + t.e1[1] * py + t.e1[2] * pz
  if (Math.abs(det) < 1e-12) return false
  const inverse = 1 / det
  const tx = x - t.a[0], ty = y - t.a[1]
  const tz = CONTACT_BAKE_RECIPE.wallRayOriginM - t.a[2]
  const u = (tx * px + ty * py + tz * pz) * inverse
  if (u < -1e-8 || u > 1 + 1e-8) return false
  const qx = ty * t.e1[2] - tz * t.e1[1]
  const qy = tz * t.e1[0] - tx * t.e1[2]
  const qz = tx * t.e1[1] - ty * t.e1[0]
  const v = (d[0] * qx + d[1] * qy + d[2] * qz) * inverse
  if (v < -1e-8 || u + v > 1 + 1e-8) return false
  const distance = (t.e2[0] * qx + t.e2[1] * qy + t.e2[2] * qz) * inverse
  return distance > 1e-6 && distance <= CONTACT_BAKE_RECIPE.rayMaxM
}

function blocked(root: Branch, x: number, y: number, d: Triple, inv: Triple, stats: ContactBakeStats): boolean {
  stats.boundsTests++
  let near: number = 0, far: number = CONTACT_BAKE_RECIPE.rayMaxM
  for (let axis = 0; axis < 3; axis++) {
    const origin = axis === 0 ? x : axis === 1 ? y : CONTACT_BAKE_RECIPE.wallRayOriginM
    const a = (root.low[axis]! - origin) * inv[axis]!
    const b = (root.high[axis]! - origin) * inv[axis]!
    near = Math.max(near, Math.min(a, b))
    far = Math.min(far, Math.max(a, b))
    if (near > far) return false
  }
  if (root.triangles) {
    for (const t of root.triangles) {
      stats.triangleTests++
      if (intersectsTriangle(t, x, y, d)) return true
    }
    return false
  }
  return blocked(root.left!, x, y, d, inv, stats) || blocked(root.right!, x, y, d, inv, stats)
}

function axisGrid(centre: number, half: number, outerLow: number, outerHigh: number): number[] {
  const innerLow = centre - half, innerHigh = centre + half
  const result: number[] = []
  const addSpan = (a: number, b: number, step: number) => {
    const n = Math.max(1, Math.ceil((b - a) / step))
    for (let i = 0; i < n; i++) result.push(a + (b - a) * i / n)
  }
  const { rayMaxM: reach, nearBandM: band, nearGridM: fine, farGridM: coarse } = CONTACT_BAKE_RECIPE
  addSpan(outerLow - reach, outerLow - band, coarse)
  addSpan(outerLow - band, innerLow, fine)
  addSpan(innerLow, innerHigh, coarse)
  addSpan(innerHigh, outerHigh + band, fine)
  addSpan(outerHigh + band, outerHigh + reach, coarse)
  result.push(outerHigh + reach)
  return result
}

function patch(f: FramePlacement, bounds: ReceiverBounds, clip: ClipBounds, root: Branch,
  rays: Triple[], inverses: Triple[], stats: ContactBakeStats): BakedPatch {
  const clipped = (values: number[], low: number, high: number) => {
    const start = Math.max(values[0]!, low), end = Math.min(values[values.length - 1]!, high)
    return start >= end ? [] : [start, ...values.filter(v => v > start && v < end), end]
  }
  const xs = clipped(axisGrid(f.x, f.width / 2, Math.min(bounds.low[0], f.x - f.width / 2), Math.max(bounds.high[0], f.x + f.width / 2)), clip.low[0], clip.high[0])
  const ys = clipped(axisGrid(f.y, f.height / 2, Math.min(bounds.low[1], f.y - f.height / 2), Math.max(bounds.high[1], f.y + f.height / 2)), clip.low[1], clip.high[1])
  const positions: number[] = [], colours: number[] = [], indices: number[] = []
  const vertices = new Map<number, number>()
  const receiver = (ix: number, iy: number): number => {
    const key = iy * xs.length + ix
    const existing = vertices.get(key)
    if (existing !== undefined) return existing
    const x = xs[ix]!, y = ys[iy]!
    let hits = 0
    for (let i = 0; i < rays.length; i++) if (blocked(root, x, y, rays[i]!, inverses[i]!, stats)) hits++
    const alpha = hits / rays.length
    stats.receivers++
    stats.rays += rays.length
    stats.blockedRays += hits
    stats.peakOcclusion = Math.max(stats.peakOcclusion, alpha)
    const vertex = positions.length / 3
    positions.push(x, y, CONTACT_BAKE_RECIPE.receiverOffsetM)
    colours.push(0, 0, 0, alpha)
    vertices.set(key, vertex)
    return vertex
  }
  for (let iy = 0; iy + 1 < ys.length; iy++) for (let ix = 0; ix + 1 < xs.length; ix++) {
    const x = (xs[ix]! + xs[ix + 1]!) / 2, y = (ys[iy]! + ys[iy + 1]!) / 2
    // The physical plate/mat covers the aperture: never put a receiver on it.
    if (Math.abs(x - f.x) < f.width / 2 && Math.abs(y - f.y) < f.height / 2) continue
    const a = receiver(ix, iy), b = receiver(ix + 1, iy)
    const c = receiver(ix + 1, iy + 1), d = receiver(ix, iy + 1)
    if (colours[a * 4 + 3] || colours[b * 4 + 3] || colours[c * 4 + 3] || colours[d * 4 + 3])
      indices.push(a, b, c, a, c, d)
  }
  return { id: f.id, positions: new Float32Array(positions), colours: new Float32Array(colours), indices: new Uint32Array(indices) }
}

export function buildBakedFrameContact(frameGroup: Object3D, frames: readonly FramePlacement[]): {
  group: Group
  setVisible(ids?: readonly string[]): void
  dispose(): void
  stats: ContactBakeStats
} {
  const started = performance.now()
  const ids = new Set<string>()
  for (const f of frames) {
    if (ids.has(f.id) || ![f.x, f.y, f.width, f.height].every(Number.isFinite) || f.width <= 0 || f.height <= 0)
      throw new Error(`Invalid contact bake frame: ${f.id}`)
    ids.add(f.id)
  }
  const triangles = sourceTriangles(frameGroup)
  const stats: ContactBakeStats = { sourceTriangles: triangles.length, frames: frames.length,
    receivers: 0, rays: 0, blockedRays: 0, triangleTests: 0, boundsTests: 0, bakeMs: 0,
    peakOcclusion: 0, visibleFrames: 0, visibleTriangles: 0, cpuBytes: 0 }
  // Associate actual triangles with the nearest aperture perimeter solely to
  // bound receiver patches. ALL triangles remain in the shared visibility BVH.
  const bounds = frames.map(() => ({ low: [Infinity, Infinity, Infinity] as Triple,
    high: [-Infinity, -Infinity, -Infinity] as Triple, count: 0 }))
  const owned = frames.map(() => [] as Triangle[])
  for (const t of triangles) {
    let closest = -1, distance = Infinity
    for (let i = 0; i < frames.length; i++) {
      const f = frames[i]!
      const dx = Math.abs(t.centre[0] - f.x) - f.width / 2
      const dy = Math.abs(t.centre[1] - f.y) - f.height / 2
      const gap = dx > 0 || dy > 0 ? Math.hypot(Math.max(0, dx), Math.max(0, dy)) : Math.min(-dx, -dy)
      if (gap < distance) { distance = gap; closest = i }
    }
    if (closest < 0) continue
    const b = bounds[closest]!
    owned[closest]!.push(t)
    b.count++
    for (let k = 0; k < 3; k++) { b.low[k] = Math.min(b.low[k]!, t.low[k]!); b.high[k] = Math.max(b.high[k]!, t.high[k]!) }
  }
  const rays = directions()
  const inverses = rays.map(d => d.map(v => 1 / v) as Triple)
  const bakeSelection = (active: number[]): BakedPatch[] => {
    // Partition overlapping receiver extents at the geometric midpoint of
    // neighbouring frame bounds. Every ray sees the active geometry union,
    // while no wall region receives two transparent overlays.
    const clips: ClipBounds[] = frames.map(() => ({ low: [-Infinity, -Infinity], high: [Infinity, Infinity] }))
    for (let ai = 0; ai < active.length; ai++) for (let bi = ai + 1; bi < active.length; bi++) {
      const i = active[ai]!, j = active[bi]!
      const a = bounds[i]!, b = bounds[j]!
      if (!a.count || !b.count) continue
      for (const axis of [0, 1] as const) {
        const left = a.low[axis] < b.low[axis] ? i : j
        const right = left === i ? j : i
        if (bounds[left]!.high[axis] > bounds[right]!.low[axis]) continue
        const cut = (bounds[left]!.high[axis] + bounds[right]!.low[axis]) / 2
        clips[left]!.high[axis] = Math.min(clips[left]!.high[axis], cut)
        clips[right]!.low[axis] = Math.max(clips[right]!.low[axis], cut)
        break
      }
    }
    const source = active.flatMap(i => owned[i]!)
    if (!source.length) return []
    const root = tree(source)
    return active.filter(i => bounds[i]!.count).map(i => patch(frames[i]!, bounds[i]!, clips[i]!, root, rays, inverses, stats))
  }
  const cache = new Map<string, BakedPatch[]>()
  const all = frames.map((_, i) => i)
  const keyFor = (active: number[]) => JSON.stringify(active.map(i => frames[i]!.id))
  const allKey = keyFor(all)
  cache.set(allKey, bakeSelection(all))
  if (frames.length > 1) for (const i of all) cache.set(keyFor([i]), bakeSelection([i]))
  cache.set('[]', [])
  let lastSubset: string | null = null
  const cachedBytes = () => {
    let bytes = 0
    for (const patches of cache.values()) for (const p of patches)
      bytes += p.positions.byteLength + p.colours.byteLength + p.indices.byteLength
    return bytes
  }
  stats.cpuBytes = cachedBytes()
  const group = new Group()
  group.name = 'vinci/pictures/baked-frame-contact'
  group.userData['manifestId'] = 'vinci/pictures/frame-contact'
  group.userData['recipe'] = CONTACT_BAKE_RECIPE
  group.userData['contactStats'] = stats
  const material = new MeshBasicNodeMaterial({ color: 0x000000, vertexColors: true,
    transparent: true, depthWrite: false, depthTest: true })
  material.name = 'vinci/pictures/local-visibility'
  material.userData['manifestId'] = 'vinci/pictures/frame-contact'
  let geometry: BufferGeometry | null = null
  let selection = ''
  let disposed = false
  const setVisible = (visibleIds?: readonly string[]) => {
    if (disposed) return
    const admitted = visibleIds === undefined ? null : new Set(visibleIds)
    const active = all.filter(i => !admitted || admitted.has(frames[i]!.id))
    const key = keyFor(active)
    if (key === selection) return
    selection = key
    if (!cache.has(key)) {
      if (lastSubset) cache.delete(lastSubset)
      const before = performance.now()
      cache.set(key, bakeSelection(active))
      stats.bakeMs += performance.now() - before
      lastSubset = key
    }
    const visible = cache.get(key)!.filter(p => p.indices.length > 0)
    group.clear()
    geometry?.dispose()
    geometry = null
    stats.visibleFrames = visible.length
    stats.visibleTriangles = visible.reduce((n, p) => n + p.indices.length / 3, 0)
    stats.cpuBytes = cachedBytes()
    group.userData['receiverRanges'] = []
    if (!visible.length) return
    const vertexCount = visible.reduce((n, p) => n + p.positions.length / 3, 0)
    const positions = new Float32Array(vertexCount * 3), colours = new Float32Array(vertexCount * 4)
    const normals = new Float32Array(vertexCount * 3)
    for (let i = 2; i < normals.length; i += 3) normals[i] = 1
    const indices = new Uint32Array(stats.visibleTriangles * 3)
    let vertexOffset = 0, indexOffset = 0
    for (const p of visible) {
      group.userData['receiverRanges'].push({ id: p.id, firstVertex: vertexOffset, vertexCount: p.positions.length / 3 })
      positions.set(p.positions, vertexOffset * 3)
      colours.set(p.colours, vertexOffset * 4)
      for (let i = 0; i < p.indices.length; i++) indices[indexOffset + i] = p.indices[i]! + vertexOffset
      indexOffset += p.indices.length
      vertexOffset += p.positions.length / 3
    }
    geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(positions, 3))
    geometry.setAttribute('color', new BufferAttribute(colours, 4))
    geometry.setAttribute('normal', new BufferAttribute(normals, 3))
    geometry.setIndex(new BufferAttribute(indices, 1))
    stats.cpuBytes += positions.byteLength + colours.byteLength + normals.byteLength + indices.byteLength
    geometry.computeBoundingBox()
    geometry.computeBoundingSphere()
    const mesh = new Mesh(geometry, material)
    mesh.name = 'vinci/pictures/contact-batch'
    mesh.userData['manifestId'] = 'vinci/pictures/frame-contact'
    group.add(mesh)
  }
  setVisible()
  stats.bakeMs = performance.now() - started
  return { group, setVisible, stats, dispose() {
    if (disposed) return
    disposed = true
    group.removeFromParent()
    group.clear()
    geometry?.dispose()
    geometry = null
    material.dispose()
    cache.clear()
    owned.length = 0
    triangles.length = 0
    stats.cpuBytes = 0
    stats.visibleFrames = 0
    stats.visibleTriangles = 0
  } }
}
