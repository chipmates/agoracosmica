/** A smaller upload of the same CC0 overcast sky. The shared loader's original
 * half-float pixels remain untouched. This is a runtime resolution choice,
 * not a new sky asset, exposure adjustment, or independently authored light.
 */
import { DataTexture, DataUtils, EquirectangularReflectionMapping, HalfFloatType,
  LinearFilter, LinearSRGBColorSpace, RGBAFormat } from 'three/webgpu'
import type { SkyProbe } from '../../../../stack'

export interface BenchProbe {
  probe: SkyProbe
  /** Conservative GPU allocation: uploaded source + PMREM output + the
   * retained PMREM generator scratch target. Excludes the shared CPU source. */
  textureMB(): number
  dispose(): void
}

const powerOfTwo = (n: number): boolean => Number.isInteger(n) && n > 0 && Number.isInteger(Math.log2(n))

/**
 * Average integer blocks in LINEAR radiance before rounding back to half
 * float. Pixel rows retain their order; flipY stays exactly the source's.
 * The sun and manifest entry remain the original source measurements.
 *
 * At 512×256: source RGBA16F = 1 MiB; each 384×512 PMREM atlas = 1.5 MiB;
 * output + scratch + source = 4 MiB. PMREM atlas dimensions follow the local
 * three.js PMREMGenerator: 3*max(face,112) by 4*face, face=2^floor(log2(W/4)).
 */
export function createBenchProbe(source: SkyProbe, width = 512): BenchProbe {
  const image = source.texture.image as { width?: number; height?: number; data?: unknown } | undefined
  const sourceWidth = image?.width ?? 0
  const sourceHeight = image?.height ?? 0
  const input = image?.data
  if (!powerOfTwo(sourceWidth) || !powerOfTwo(sourceHeight) || !powerOfTwo(width)
    || width < 16 || width > sourceWidth || sourceWidth !== sourceHeight * 2
    || !(input instanceof Uint16Array) || input.length !== sourceWidth * sourceHeight * 4
    || source.texture.type !== HalfFloatType || source.texture.colorSpace !== LinearSRGBColorSpace)
    throw new Error('Bench probe requires a 2:1 power-of-two linear RGBA16F source and a smaller power-of-two width')
  const block = sourceWidth / width
  const height = sourceHeight / block
  const scale = 1 / (block * block)
  const pixels = new Uint16Array(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const sum = [0, 0, 0, 0]
      for (let by = 0; by < block; by++) {
        let at = ((y * block + by) * sourceWidth + x * block) * 4
        for (let bx = 0; bx < block; bx++, at += 4) {
          for (let channel = 0; channel < 4; channel++) {
            const value = DataUtils.fromHalfFloat(input[at + channel]!)
            if (!Number.isFinite(value)) throw new Error('Bench probe source contains non-finite radiance')
            sum[channel] = sum[channel]! + value
          }
        }
      }
      const target = (y * width + x) * 4
      for (let channel = 0; channel < 4; channel++)
        pixels[target + channel] = DataUtils.toHalfFloat(sum[channel]! * scale)
    }
  }

  const owned = new DataTexture(pixels, width, height, RGBAFormat, HalfFloatType)
  owned.name = `${source.entry.id}/bench-${width}`
  owned.mapping = EquirectangularReflectionMapping
  owned.colorSpace = LinearSRGBColorSpace
  owned.flipY = source.texture.flipY
  owned.generateMipmaps = false
  owned.minFilter = LinearFilter
  owned.magFilter = LinearFilter
  owned.needsUpdate = true
  owned.userData['manifestId'] = source.entry.id
  owned.userData['resolutionTransform'] = {
    sourcePixels: [sourceWidth, sourceHeight], pixels: [width, height],
    method: 'Integer-block area average in linear half-float radiance',
    sourceChanged: false,
  }
  const face = 2 ** Math.floor(Math.log2(width / 4))
  const atlasWidth = 3 * Math.max(face, 16 * 7)
  const atlasHeight = 4 * face
  const sourceBytes = width * height * 8
  const atlasBytes = atlasWidth * atlasHeight * 8
  const gpuBytes = sourceBytes + atlasBytes * 2
  let live = true
  return {
    probe: { texture: owned, entry: source.entry, sun: source.sun },
    textureMB: () => live ? gpuBytes / (1024 * 1024) : 0,
    dispose() {
      if (!live) return
      live = false
      // The PMREM cache listens to this texture's dispose event and releases
      // its output. The shared source and its global cache are not disposed.
      owned.dispose()
      owned.image.data = new Uint16Array(0)
    },
  }
}
