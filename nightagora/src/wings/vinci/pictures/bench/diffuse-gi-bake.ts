/** Pure, deterministic offline diffuse transport. No renderer, asset loader or
 * authored spatial field. Each receiver follows a cosine-distributed ray to
 * actual geometry, then connects that diffuse hit to the area emitter with a
 * visibility ray. Thus every nonzero sample follows emitter -> surface -> wall.
 * Escaped rays are black; this is a generated window-light model, not an HDRI
 * measurement, multibounce solver, specular bake, or the shared stack.gi hook.
 */
export type GIVec3 = [number, number, number]
export interface GITransportTriangle {
  a: GIVec3
  b: GIVec3
  c: GIVec3
  /** Declared mean LINEAR diffuse reflectance. Fine maps stay in the renderer. */
  reflectance: GIVec3
  /** One-sided emitted LINEAR radiance; zero for non-emitting surfaces. */
  emission: GIVec3
  label: string
}
export interface GIWallBounds { minX: number; maxX: number; minY: number; maxY: number }
export const DIFFUSE_GI_RECIPE = Object.freeze({
  version: 1,
  width: 128,
  height: 64,
  hemisphereSamples: 64,
  emitterSamples: 4,
  rayEpsilonM: .0002,
  diffuseBounces: 1,
  escapedRadiance: 0,
  receiverPlaneZ: 0,
  receiverNormal: '+Z',
  quadrature: 'Hammersley cosine hemisphere; stratified area-emitter connections',
  estimator: 'E_indirect(P) = mean[rho(Q) * E_direct_from_emitter(Q)]',
})
export interface DiffuseGIBakeStats {
  bakeMs: number
  sourceTriangles: number
  emitterTriangles: number
  emitterAreaM2: number
  receivers: number
  hemisphereRays: number
  diffuseHits: number
  emitterConnectionRays: number
  visibleEmitterConnections: number
  boundsTests: number
  triangleTests: number
  meanIrradiance: GIVec3
  maxIrradiance: GIVec3
}
export interface DiffuseGIBakeResult {
  width: number
  height: number
  bounds: GIWallBounds
  channels: 'RGB indirect irradiance'
  /** Row zero is minY. Texel centres evenly cover the declared domain. */
  irradiance: number[]
  stats: DiffuseGIBakeStats
}
interface Triangle {
  a: GIVec3
  e1: GIVec3
  e2: GIVec3
  normal: GIVec3
  area: number
  low: GIVec3
  high: GIVec3
  center: GIVec3
  reflectance: GIVec3
  emission: GIVec3
}
interface BVH {
  low: GIVec3
  high: GIVec3
  left?: BVH
  right?: BVH
  triangles?: Triangle[]
}
interface Hit { triangle: Triangle | null; distance: number }
const dot = (a: GIVec3, b: GIVec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: GIVec3, b: GIVec3): GIVec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const fract = (x: number) => x - Math.floor(x)
function radicalInverse(value: number, base: number): number {
  let result = 0, weight = 1 / base
  while (value) { result += (value % base) * weight; value = Math.floor(value / base); weight /= base }
  return result
}
function prepare(source: GITransportTriangle): Triangle {
  for (const v of [source.a, source.b, source.c, source.reflectance, source.emission])
    if (v.length !== 3 || !v.every(Number.isFinite)) throw new Error('Non-finite or malformed GI triangle')
  if (source.reflectance.some(v => v < 0 || v > 1) || source.emission.some(v => v < 0))
    throw new Error('GI reflectance must be in [0,1] and emission nonnegative')
  const a = source.a
  const e1 = source.b.map((v, i) => v - a[i]!) as GIVec3
  const e2 = source.c.map((v, i) => v - a[i]!) as GIVec3
  const n = cross(e1, e2), magnitude = Math.hypot(...n)
  if (magnitude <= 1e-12) throw new Error('Degenerate GI triangle')
  return { a: [...a], e1, e2, normal: n.map(v => v / magnitude) as GIVec3, area: magnitude / 2,
    low: a.map((v, i) => Math.min(v, source.b[i]!, source.c[i]!)) as GIVec3,
    high: a.map((v, i) => Math.max(v, source.b[i]!, source.c[i]!)) as GIVec3,
    center: a.map((v, i) => (v + source.b[i]! + source.c[i]!) / 3) as GIVec3,
    reflectance: [...source.reflectance], emission: [...source.emission] }
}
function buildBVH(triangles: Triangle[]): BVH {
  const low: GIVec3 = [Infinity, Infinity, Infinity], high: GIVec3 = [-Infinity, -Infinity, -Infinity]
  for (const t of triangles) for (let k = 0; k < 3; k++) {
    low[k] = Math.min(low[k]!, t.low[k]!)
    high[k] = Math.max(high[k]!, t.high[k]!)
  }
  if (triangles.length <= 6) return { low, high, triangles }
  const span = high.map((v, i) => v - low[i]!)
  const axis = span[0]! >= span[1]! && span[0]! >= span[2]! ? 0 : span[1]! >= span[2]! ? 1 : 2
  triangles.sort((a, b) => a.center[axis]! - b.center[axis]!)
  const half = triangles.length >> 1
  return { low, high, left: buildBVH(triangles.slice(0, half)), right: buildBVH(triangles.slice(half)) }
}
function triangleDistance(t: Triangle, origin: GIVec3, direction: GIVec3): number {
  const px = direction[1] * t.e2[2] - direction[2] * t.e2[1]
  const py = direction[2] * t.e2[0] - direction[0] * t.e2[2]
  const pz = direction[0] * t.e2[1] - direction[1] * t.e2[0]
  const determinant = t.e1[0] * px + t.e1[1] * py + t.e1[2] * pz
  if (Math.abs(determinant) < 1e-12) return Infinity
  const inverse = 1 / determinant
  const tx = origin[0] - t.a[0], ty = origin[1] - t.a[1], tz = origin[2] - t.a[2]
  const u = (tx * px + ty * py + tz * pz) * inverse
  if (u < -1e-9 || u > 1 + 1e-9) return Infinity
  const qx = ty * t.e1[2] - tz * t.e1[1]
  const qy = tz * t.e1[0] - tx * t.e1[2]
  const qz = tx * t.e1[1] - ty * t.e1[0]
  const v = (direction[0] * qx + direction[1] * qy + direction[2] * qz) * inverse
  if (v < -1e-9 || u + v > 1 + 1e-9) return Infinity
  const distance = (t.e2[0] * qx + t.e2[1] * qy + t.e2[2] * qz) * inverse
  return distance > DIFFUSE_GI_RECIPE.rayEpsilonM * .1 ? distance : Infinity
}
function cast(root: BVH, origin: GIVec3, direction: GIVec3, inverse: GIVec3, hit: Hit,
  stats: DiffuseGIBakeStats, anyHit = false): boolean {
  stats.boundsTests++
  let near = 0, far = hit.distance
  for (let k = 0; k < 3; k++) {
    if (Math.abs(direction[k]!) < 1e-12) {
      if (origin[k]! < root.low[k]! || origin[k]! > root.high[k]!) return false
      continue
    }
    const a = (root.low[k]! - origin[k]!) * inverse[k]!, b = (root.high[k]! - origin[k]!) * inverse[k]!
    near = Math.max(near, Math.min(a, b)); far = Math.min(far, Math.max(a, b))
    if (near > far) return false
  }
  if (root.triangles) {
    let found = false
    for (const t of root.triangles) {
      stats.triangleTests++
      const distance = triangleDistance(t, origin, direction)
      if (distance < hit.distance) {
        hit.distance = distance; hit.triangle = t; found = true
        if (anyHit) return true
      }
    }
    return found
  }
  const left = cast(root.left!, origin, direction, inverse, hit, stats, anyHit)
  if (left && anyHit) return true
  return cast(root.right!, origin, direction, inverse, hit, stats, anyHit) || left
}
function hemisphere(count: number): GIVec3[] {
  return Array.from({ length: count }, (_, i) => {
    const r = Math.sqrt((i + .5) / count), phi = 2 * Math.PI * (radicalInverse(i, 2) + .17320508075688773)
    return [r * Math.cos(phi), r * Math.sin(phi), Math.sqrt(1 - r * r)]
  })
}
function directIrradiance(position: GIVec3, normal: GIVec3, emitters: Triangle[], totalArea: number,
  root: BVH, samples: number, seed: number, stats: DiffuseGIBakeStats): GIVec3 {
  const result: GIVec3 = [0, 0, 0]
  const origin = position.map((v, i) => v + normal[i]! * DIFFUSE_GI_RECIPE.rayEpsilonM) as GIVec3
  const shiftU = fract((seed + 1) * .7548776662466927), shiftV = fract((seed + 1) * .5698402909980532)
  for (let sample = 0; sample < samples; sample++) {
    let area = (sample + .5) / samples * totalArea
    let emitter = emitters[emitters.length - 1]!
    for (const e of emitters) { area -= e.area; if (area <= 0) { emitter = e; break } }
    const r = Math.sqrt(fract(radicalInverse(sample, 2) + shiftU))
    const v = fract(radicalInverse(sample, 3) + shiftV)
    const target = emitter.a.map((x, i) => x + emitter.e1[i]! * r * (1 - v) + emitter.e2[i]! * r * v) as GIVec3
    const vector = target.map((x, i) => x - origin[i]!) as GIVec3
    const distance = Math.hypot(...vector)
    if (distance < DIFFUSE_GI_RECIPE.rayEpsilonM * 2) continue
    const direction = vector.map(x => x / distance) as GIVec3
    const surfaceCosine = Math.max(0, dot(normal, direction))
    const emitterCosine = Math.max(0, -dot(emitter.normal, direction))
    if (surfaceCosine === 0 || emitterCosine === 0) continue
    stats.emitterConnectionRays++
    const occlusion: Hit = { distance: distance - DIFFUSE_GI_RECIPE.rayEpsilonM, triangle: null }
    if (cast(root, origin, direction, direction.map(x => 1 / x) as GIVec3, occlusion, stats, true)) continue
    stats.visibleEmitterConnections++
    const factor = surfaceCosine * emitterCosine * totalArea / (distance * distance * samples)
    for (let channel = 0; channel < 3; channel++) result[channel] = result[channel]! + emitter.emission[channel]! * factor
  }
  return result
}

export function bakeWallDiffuseGI(input: {
  triangles: readonly GITransportTriangle[]
  bounds: GIWallBounds
  width?: number
  height?: number
  hemisphereSamples?: number
  emitterSamples?: number
}): DiffuseGIBakeResult {
  const started = performance.now()
  const width = input.width ?? DIFFUSE_GI_RECIPE.width, height = input.height ?? DIFFUSE_GI_RECIPE.height
  const samples = input.hemisphereSamples ?? DIFFUSE_GI_RECIPE.hemisphereSamples
  const lightSamples = input.emitterSamples ?? DIFFUSE_GI_RECIPE.emitterSamples
  const b = input.bounds
  if (![width, height, samples, lightSamples].every(v => Number.isInteger(v) && v > 0)
    || width > 256 || height > 128 || samples > 4096 || lightSamples > 8192
    || ![b.minX, b.maxX, b.minY, b.maxY].every(Number.isFinite) || b.minX >= b.maxX || b.minY >= b.maxY)
    throw new Error('Invalid bounded wall GI bake configuration')
  const triangles = input.triangles.map(prepare)
  const emitters = triangles.filter(t => t.emission.some(v => v > 0))
  const totalArea = emitters.reduce((n, t) => n + t.area, 0)
  const stats: DiffuseGIBakeStats = { bakeMs: 0, sourceTriangles: triangles.length,
    emitterTriangles: emitters.length, emitterAreaM2: totalArea, receivers: width * height,
    hemisphereRays: 0, diffuseHits: 0, emitterConnectionRays: 0, visibleEmitterConnections: 0,
    boundsTests: 0, triangleTests: 0, meanIrradiance: [0, 0, 0], maxIrradiance: [0, 0, 0] }
  const irradiance = Array<number>(width * height * 3).fill(0)
  if (triangles.length && emitters.length) {
    const root = buildBVH(triangles)
    const directions = hemisphere(samples), inverses = directions.map(d => d.map(v => 1 / v) as GIVec3)
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const pixel = y * width + x
      const origin: GIVec3 = [b.minX + (x + .5) * (b.maxX - b.minX) / width,
        b.minY + (y + .5) * (b.maxY - b.minY) / height, DIFFUSE_GI_RECIPE.rayEpsilonM]
      for (let i = 0; i < directions.length; i++) {
        const direction = directions[i]!
        const hit: Hit = { distance: Infinity, triangle: null }
        stats.hemisphereRays++
        if (!cast(root, origin, direction, inverses[i]!, hit, stats)) continue
        const t = hit.triangle!
        // Direct emitter visibility is intentionally excluded from this map.
        if (t.emission.some(v => v > 0) || t.reflectance.every(v => v === 0)) continue
        stats.diffuseHits++
        const position = origin.map((v, k) => v + direction[k]! * hit.distance) as GIVec3
        const normal = (dot(t.normal, direction) < 0 ? t.normal : t.normal.map(v => -v)) as GIVec3
        const direct = directIrradiance(position, normal, emitters, totalArea, root, lightSamples, pixel * samples + i, stats)
        // E(P)=pi*mean(L(Q)); L(Q)=rho(Q)*E_direct(Q)/pi. Cosine is
        // already in the hemisphere PDF and must NOT be multiplied again.
        for (let channel = 0; channel < 3; channel++)
          irradiance[pixel * 3 + channel] = irradiance[pixel * 3 + channel]! + t.reflectance[channel]! * direct[channel]! / samples
      }
      for (let channel = 0; channel < 3; channel++) {
        const value = irradiance[pixel * 3 + channel]!
        if (!Number.isFinite(value) || value < 0 || value > 65504) throw new Error('GI irradiance is outside finite half-float range')
        stats.meanIrradiance[channel] = stats.meanIrradiance[channel]! + value / (width * height)
        stats.maxIrradiance[channel] = Math.max(stats.maxIrradiance[channel]!, value)
      }
    }
  }
  stats.bakeMs = performance.now() - started
  return { width, height, bounds: { ...b }, channels: 'RGB indirect irradiance', irradiance, stats }
}
