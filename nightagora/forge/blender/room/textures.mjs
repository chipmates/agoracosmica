// THE PHOTOGRAPHS, PER RECIPE. A library set's albedo, surface and normal
// maps are read from the store (never written to it) and, where a recipe
// applies a per-texel rule the glTF factors cannot, derived into new images
// beside the export: the rule is the engine's, in linear light.
import sharp from 'sharp'
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'

const SRGB_TO_LIN = new Float32Array(256).map((_, i) => {
  const v = i / 255
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
})
const linToSrgb8 = (v) => {
  const c = Math.min(1, Math.max(0, v))
  const s = c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055
  return Math.round(s * 255)
}
/** the largest side a derived map is written at: the photographs are 2048 */
const MAX_SIDE = 2048

async function rgb(file, side) {
  let img = sharp(file).removeAlpha()
  const meta = await sharp(file).metadata()
  const want = Math.min(side ?? meta.width, MAX_SIDE)
  if (meta.width !== want || meta.height !== want) img = img.resize(want, want, { kernel: 'lanczos3' })
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true })
  return { data, width: info.width, height: info.height, channels: info.channels }
}

const key = (o) => createHash('sha256').update(JSON.stringify(o)).digest('hex').slice(0, 12)

/**
 * Writes (or reuses) the maps a recipe needs. Returns
 * { albedo: {file, factor}, orm: {file}|null, roughnessFactor, normal: {file}|null }.
 */
export async function mapsFor(recipe, storeRoot, outDir, cache) {
  const s = recipe.set
  if (!s) return null
  const dir = join(storeRoot, 'library', s.set)
  const albedoSrc = join(dir, 'albedo.jpg'), surfaceSrc = join(dir, 'surface.png'), normalSrc = join(dir, 'normal.png')
  mkdirSync(outDir, { recursive: true })
  const out = { albedo: null, orm: null, roughnessFactor: 1, normal: null }
  const b = recipe.base
  // THE ALBEDO. A photograph the recipe only multiplies by a constant is
  // copied as it stands and the constant becomes the glTF factor.
  if (b.mode === 'photo' && !b.ao) {
    const name = `${s.set}-albedo.jpg`
    if (!existsSync(join(outDir, name))) copyFileSync(albedoSrc, join(outDir, name))
    out.albedo = { file: name, factor: b.tint }
  } else {
    const spec = { set: s.set, mode: b.mode, tint: b.tint, a: b.a, b: b.b, spread: b.spread, k: b.k, ao: b.ao, mean: s.mean }
    const name = `${s.set}-albedo-${key(spec)}.jpg`
    if (!cache.has(name)) {
      cache.set(name, (async () => {
        const A = await rgb(albedoSrc)
        const S = existsSync(surfaceSrc) ? await rgb(surfaceSrc, A.width) : null
        const px = A.width * A.height, o = Buffer.alloc(px * 3)
        const M = s.mean ?? [0.5, 0.5, 0.5]
        for (let i = 0; i < px; i++) {
          const r = SRGB_TO_LIN[A.data[i * A.channels]], g = SRGB_TO_LIN[A.data[i * A.channels + 1]], bl = SRGB_TO_LIN[A.data[i * A.channels + 2]]
          const ao = b.ao && S ? S.data[i * S.channels + 1] / 255 : 1
          let c
          if (b.mode === 'photo') c = [r * b.tint[0], g * b.tint[1], bl * b.tint[2]]
          // the photograph pulled toward its own mean by k, as the hall floor keeps it
          else if (b.mode === 'photo-soft') c = [r, g, bl].map((v, j) => (M[j] + (v - M[j]) * b.k) * b.tint[j])
          else if (b.mode === 'ratio') c = [b.tint[0] * r / M[0], b.tint[1] * g / M[1], b.tint[2] * bl / M[2]]
          else if (b.mode === 'pitch') {
            // parts.ts: the ratio's luminance over the set mean's own luminance
            const lum = 0.2126 * (r / M[0]) + 0.7152 * (g / M[1]) + 0.0722 * (bl / M[2])
            const lm = Math.max(0.2126 * M[0] + 0.7152 * M[1] + 0.0722 * M[2], 0.001)
            const k = Math.min(1.4, Math.max(0.5, (lum / lm) * b.spread + 1 - b.spread))
            c = [b.tint[0] * k, b.tint[1] * k, b.tint[2] * k]
          } else if (b.mode === 'new-oak') {
            const q = [r / M[0], g / M[1], bl / M[2]]
            const lum = 0.2126 * q[0] + 0.7152 * q[1] + 0.0722 * q[2]
            c = q.map((v, j) => b.tint[j] * ((lum + (v - lum) * 0.35 - 1) * b.k + 1))
          } else {
            const lum = 0.2126 * (r / M[0]) + 0.7152 * (g / M[1]) + 0.0722 * (bl / M[2])
            const k = lum * b.a + b.b
            c = [b.tint[0] * k, b.tint[1] * k, b.tint[2] * k]
          }
          o[i * 3] = linToSrgb8(c[0] * ao); o[i * 3 + 1] = linToSrgb8(c[1] * ao); o[i * 3 + 2] = linToSrgb8(c[2] * ao)
        }
        await sharp(o, { raw: { width: A.width, height: A.height, channels: 3 } }).jpeg({ quality: 93, chromaSubsampling: '4:4:4' }).toFile(join(outDir, name))
      })())
    }
    await cache.get(name)
    out.albedo = { file: name, factor: [1, 1, 1] }
  }
  // THE ROUGHNESS, in the green of a metallic-roughness map (blue is metal,
  // left at one so the factor alone sets it).
  const rr = recipe.rough
  if (rr.mode === 'const') out.roughnessFactor = rr.value
  else if (existsSync(surfaceSrc)) {
    const spec = { set: s.set, rough: rr, floor: s.roughFloor }
    const name = `${s.set}-orm-${key(spec)}.png`
    if (!cache.has(name)) {
      cache.set(name, (async () => {
        const S = await rgb(surfaceSrc)
        const px = S.width * S.height, o = Buffer.alloc(px * 3)
        for (let i = 0; i < px; i++) {
          const r0 = Math.max(S.data[i * S.channels] / 255, s.roughFloor ?? 0)
          let r = r0
          if (rr.mode === 'remap') r = rr.lo + (rr.hi - rr.lo) * (S.data[i * S.channels] / 255)
          else if (rr.mode === 'clamp') r = Math.min(rr.hi, Math.max(rr.lo, r0 * rr.mul))
          else if (rr.mode === 'affine') r = Math.min(rr.hi, Math.max(rr.lo, r0 * rr.mul + rr.add))
          o[i * 3] = 255; o[i * 3 + 1] = Math.round(Math.min(1, Math.max(0.02, r)) * 255); o[i * 3 + 2] = 255
        }
        await sharp(o, { raw: { width: S.width, height: S.height, channels: 3 } }).png({ compressionLevel: 9 }).toFile(join(outDir, name))
      })())
    }
    await cache.get(name)
    out.orm = { file: name }
  }
  // THE NORMAL, as published (OpenGL, green up), flipped where the manifest
  // says the source is the other convention.
  if (recipe.normalScale > 0 && existsSync(normalSrc)) {
    const name = `${s.set}-normal${s.greenFlip ? '-flipped' : ''}.png`
    if (!cache.has(name)) {
      cache.set(name, (async () => {
        if (!s.greenFlip) { copyFileSync(normalSrc, join(outDir, name)); return }
        const N = await rgb(normalSrc)
        const o = Buffer.alloc(N.width * N.height * 3)
        for (let i = 0; i < N.width * N.height; i++) {
          o[i * 3] = N.data[i * N.channels]; o[i * 3 + 1] = 255 - N.data[i * N.channels + 1]; o[i * 3 + 2] = N.data[i * N.channels + 2]
        }
        await sharp(o, { raw: { width: N.width, height: N.height, channels: 3 } }).png().toFile(join(outDir, name))
      })())
    }
    await cache.get(name)
    out.normal = { file: name }
  }
  return out
}
