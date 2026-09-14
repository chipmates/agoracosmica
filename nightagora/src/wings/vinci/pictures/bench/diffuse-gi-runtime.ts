/** Samples an offline, geometry-derived wall irradiance field. This module
 * owns only the small upload and material binding; it does not bake, fetch,
 * or make the shared stack.gi placeholder into a working GI implementation.
 */
import { ClampToEdgeWrapping, DataTexture, DataUtils, HalfFloatType,
  LinearFilter, LinearSRGBColorSpace, MeshStandardNodeMaterial, RGBAFormat } from 'three/webgpu'
import type { Node } from 'three/webgpu'
import { clamp, float, materialColor, normalGeometry, positionGeometry, positionLocal,
  texture, vec2, vec3 } from 'three/tsl'

export interface WallDiffuseGIData {
  schema: 'vinci-wall-diffuse-gi-v1'
  segment: string
  width: number
  height: number
  bounds: { minX: number; maxX: number; minY: number; maxY: number }
  channels: 'RGB indirect irradiance'
  /** Linear RGB irradiance, bottom row first; three numbers per grid cell. */
  irradiance: number[]
  provenance: Record<string, unknown> & {
    class: 'GENERATED'
    geometrySha256: string
    lightSha256: string
    materialSha256: string
    recipeSha256: string
    roomSourceSha256: string
  }
  stats: Record<string, unknown>
}

export interface WallDiffuseGI {
  /** Adds Lambertian reflected indirect radiance to the existing emissive
   * node. Repeated application to the same material returns the same cleanup.
   * Only the local z=0, normal +Z face inside the baked bounds receives it. */
  apply(material: MeshStandardNodeMaterial): () => void
  /** Exact owned RGBA16F allocation in MiB; zero after disposal. */
  textureMB(): number
  dispose(): void
}

export interface WallDiffuseGIExpected {
  segment?: string
  geometrySha256?: string
  lightSha256?: string
  materialSha256?: string
  recipeSha256?: string
  roomSourceSha256?: string
}

const HASH_FIELDS = ['geometrySha256', 'lightSha256', 'materialSha256',
  'recipeSha256', 'roomSourceSha256'] as const
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
const hash = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
function invalid(reason: string): never { throw new Error(`Invalid wall diffuse GI: ${reason}`) }
const rgb = (node: Node): Node<'vec3'> => node.convert('vec3') as Node<'vec3'>

/** Validate before allocating a texture. The runtime rejects missing or
 * mismatched evidence instead of rendering an unverified approximation. */
function validate(value: unknown, expected: WallDiffuseGIExpected): asserts value is WallDiffuseGIData {
  if (!record(value) || value['schema'] !== 'vinci-wall-diffuse-gi-v1') invalid('schema')
  if (typeof value['segment'] !== 'string' || !/^[a-z][a-z0-9-]*$/.test(value['segment'])) invalid('segment')
  if (expected.segment !== undefined && value['segment'] !== expected.segment) invalid('segment mismatch')
  const width = value['width'], height = value['height']
  if (typeof width !== 'number' || !Number.isInteger(width) || width < 1 || width > 256
    || typeof height !== 'number' || !Number.isInteger(height) || height < 1 || height > 128) invalid('dimensions')
  if (value['channels'] !== 'RGB indirect irradiance') invalid('channels')
  const bounds = value['bounds']
  if (!record(bounds) || Object.keys(bounds).sort().join(',') !== 'maxX,maxY,minX,minY') invalid('bounds fields')
  for (const key of ['minX', 'maxX', 'minY', 'maxY']) {
    if (typeof bounds[key] !== 'number' || !Number.isFinite(bounds[key])) invalid(`bounds.${key}`)
  }
  if (!(Number(bounds['maxX']) > Number(bounds['minX']))
    || !(Number(bounds['maxY']) > Number(bounds['minY']))
    || !Number.isFinite(Number(bounds['maxX']) - Number(bounds['minX']))
    || !Number.isFinite(Number(bounds['maxY']) - Number(bounds['minY']))) invalid('bounds extent')
  const samples = value['irradiance']
  if (!Array.isArray(samples) || samples.length !== width * height * 3) invalid('sample count')
  // Half float cannot represent values above 65504. Reject rather than clamp
  // a source measurement or silently upload infinity to the lighting graph.
  for (const sample of samples) {
    if (typeof sample !== 'number' || !Number.isFinite(sample) || sample < 0 || sample > 65504) invalid('sample value')
  }
  const provenance = value['provenance']
  if (!record(provenance) || !record(value['stats'])) invalid('metadata')
  if (provenance['class'] !== 'GENERATED') invalid('provenance class')
  for (const field of HASH_FIELDS) {
    if (!hash(provenance[field])) invalid(field)
    if (expected[field] !== undefined
      && (!hash(expected[field]) || provenance[field] !== expected[field])) invalid(`${field} mismatch`)
  }
}

export function createWallDiffuseGI(data: unknown,
  expected: WallDiffuseGIExpected = {}): WallDiffuseGI {
  validate(data, expected)
  const { width, height, bounds } = data
  const pixels = new Uint16Array(width * height * 4)
  for (let cell = 0; cell < width * height; cell++) {
    for (let channel = 0; channel < 3; channel++)
      pixels[cell * 4 + channel] = DataUtils.toHalfFloat(data.irradiance[cell * 3 + channel]!)
    pixels[cell * 4 + 3] = DataUtils.toHalfFloat(1)
  }
  const owned = new DataTexture(pixels, width, height, RGBAFormat, HalfFloatType)
  const manifestId = `vinci/pictures/diffuse-gi/${data.segment}`
  owned.name = manifestId
  owned.userData['manifestId'] = manifestId
  for (const field of HASH_FIELDS) owned.userData[field] = data.provenance[field]
  owned.colorSpace = LinearSRGBColorSpace
  owned.flipY = false
  owned.generateMipmaps = false
  owned.wrapS = owned.wrapT = ClampToEdgeWrapping
  owned.minFilter = owned.magFilter = LinearFilter
  owned.needsUpdate = true

  // The baker samples x=minX+(i+.5)*extent/width, and similarly for y.
  // Thus this affine mapping already lands exactly at texture pixel centres;
  // adding a half-texel offset would shift the bake. Edge clamping extends the
  // first/last cell only to its own domain boundary, without a wrapping seam.
  const ux = positionLocal.x.sub(bounds.minX).div(bounds.maxX - bounds.minX)
  const uy = positionLocal.y.sub(bounds.minY).div(bounds.maxY - bounds.minY)
  const coordinates = vec2(clamp(ux, .5 / width, 1 - .5 / width),
    clamp(uy, .5 / height, 1 - .5 / height))
  // normalGeometry is the local vertex attribute, before any normal map.
  // Each room face has separate vertices and a constant axis normal. Do the
  // exact plane/normal test at vertices and transmit a flat 0/1: interpolation
  // cannot perturb a floating-point equality or blend eligibility at a corner.
  const wallFace = float(positionGeometry.z.equal(0).and(normalGeometry.x.equal(0))
    .and(normalGeometry.y.equal(0)).and(normalGeometry.z.equal(1)))
    .toVarying().setInterpolation('flat')
  const withinBounds = ux.greaterThanEqual(0).and(ux.lessThanEqual(1))
    .and(uy.greaterThanEqual(0)).and(uy.lessThanEqual(1))
  const reflectedIrradiance = texture(owned, coordinates).rgb
    .mul(wallFace).mul(float(withinBounds)).div(Math.PI)
  const bindings = new Map<MeshStandardNodeMaterial, () => void>()
  let live = true
  return {
    apply(material) {
      if (!live) throw new Error('Cannot apply disposed wall diffuse GI')
      if (!material?.isMeshStandardNodeMaterial) throw new Error('Wall diffuse GI requires MeshStandardNodeMaterial')
      const existing = bindings.get(material)
      if (existing) return existing
      const previous = material.emissiveNode
      const e = material.emissive.clone().multiplyScalar(material.emissiveIntensity)
      const baseline = previous ?? (material.emissiveMap
        ? vec3(e.r, e.g, e.b).mul(texture(material.emissiveMap).rgb) : vec3(e.r, e.g, e.b))
      // Preserve the complete library colour graph, including its three
      // physical detail scales, by reading it without replacing or mutating it.
      const addition = rgb(material.colorNode ?? materialColor).mul(reflectedIrradiance)
      const applied = rgb(baseline).add(addition)
      material.emissiveNode = applied
      material.needsUpdate = true
      let bound = true
      const restore = (): void => {
        if (!bound) return
        bound = false
        bindings.delete(material)
        material.removeEventListener('dispose', restore)
        // Do not overwrite an independently replaced node during cleanup.
        if (material.emissiveNode === applied) {
          material.emissiveNode = previous
          material.needsUpdate = true
        }
      }
      bindings.set(material, restore)
      material.addEventListener('dispose', restore)
      return restore
    },
    textureMB: () => live ? width * height * 8 / (1024 * 1024) : 0,
    dispose() {
      if (!live) return
      live = false
      for (const restore of [...bindings.values()]) restore()
      owned.dispose()
      owned.image.data = new Uint16Array(0)
    },
  }
}
