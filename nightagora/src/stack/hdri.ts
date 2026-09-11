/* THE REAL SKY. Stage 0.2 left the probe slot open and baked its own sky
   into it; this is what fills the slot when a scene has an hour it can
   point at.

   Three 2K equirectangular HDRIs live in the library, all CC0, all
   manifest-logged like every other asset: a clear night with the moon
   standing in it, an overcast day, a warm late afternoon. Loading one is a
   network fetch, and a key light is built inside a scene's constructor, so
   the two cannot be one call. `Stack.hdri(name)` does the fetch, the manifest
   resolution and the reading of the sky's own sun; `Stack.light({ hdri })`
   takes the result and lights the scene from the hour that is in it. */

import { DataUtils, EquirectangularReflectionMapping, type Texture } from 'three/webgpu'
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js'
import { loadManifest, type ManifestEntry } from '../manifest'
import { kelvinToColour } from './light'
import { ASSET_BASE } from './materials'

const loader = new HDRLoader()
const held = new Map<string, Promise<Texture>>()

/** where a sky's own brightest place stands, and what colour it is, in the
    terms `light()` takes */
export interface Sun {
  azimuth: number
  elevation: number
  kelvin: number
  /** the peak's luminance over the dome's mean: 1 is a sky with no sun in it */
  contrast: number
}

export interface SkyProbe {
  texture: Texture
  entry: ManifestEntry
  /** the hour this sky is, measured off its own pixels */
  sun: Sun
}

/**
 * One HDRI out of the library, as an equirectangular probe. The manifest
 * answers for it exactly as it answers for a material set: a REFERENCE-ONLY
 * or undisplayable entry throws rather than reaching a surface.
 */
export async function loadHDRI(name: string): Promise<SkyProbe> {
  const index = await loadManifest()
  const entry = index.byId.get(`library/${name}`)
  if (!entry) throw new Error(`no manifest entry for the sky "${name}"`)
  if (!entry.display || entry.class === 'REFERENCE-ONLY') {
    throw new Error(`the sky "${name}" may not be displayed`)
  }
  const url = `${ASSET_BASE}${entry.wing}/${entry.path}`
  let pending = held.get(url)
  if (!pending) {
    pending = loader.loadAsync(url).then((tex) => {
      tex.mapping = EquirectangularReflectionMapping
      return tex as unknown as Texture
    })
    held.set(url, pending)
  }
  const texture = await pending
  return { texture, entry, sun: sunOf(texture) }
}

/* THE HOUR IS A DIRECTION, AND THE SKY ALREADY KNOWS IT. A key light hand-
   placed beside a probe is two hours in one room: the metal reflects a sun
   standing in one place and is shaded by a sun standing in another. So the
   direction, and the temperature, are read off the sky's own brightest
   place.

   The equirectangular mapping is three's: u runs the azimuth from atan2(z, x)
   and v the elevation from asin(y). The stack's own azimuth counts from
   behind -Z, so the two are reconciled once, here. */
export function sunOf(texture: Texture): Sun {
  const image = (texture as unknown as { image?: { data?: ArrayLike<number>; width: number; height: number } }).image
  const data = image?.data
  const w = image?.width ?? 0
  const h = image?.height ?? 0
  const fallback: Sun = { azimuth: 0, elevation: 45, kelvin: 5600, contrast: 1 }
  if (!data || !w || !h || data.length < w * h * 4) return fallback

  // half floats are what the loader hands back by default; a float texture
  // reads straight through
  const half = data instanceof Uint16Array
  const at = (i: number): number => (half ? DataUtils.fromHalfFloat(data[i] as number) : (data[i] as number))

  let sum = 0
  let best = -1
  let bestX = 0
  let bestY = 0
  let bestR = 0
  let bestG = 0
  let bestB = 0
  /* one row in eight and one column in four: a 2K probe is two million
     texels and a sun is never one of them alone */
  for (let y = 0; y < h; y += 8) {
    for (let x = 0; x < w; x += 4) {
      const i = (y * w + x) * 4
      const r = at(i)
      const g = at(i + 1)
      const b = at(i + 2)
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
      sum += lum
      if (lum > best) {
        best = lum
        bestX = x
        bestY = y
        bestR = r
        bestG = g
        bestB = b
      }
    }
  }
  const mean = sum / (Math.ceil(h / 8) * Math.ceil(w / 4))
  const u = (bestX + 0.5) / w
  const row = (bestY + 0.5) / h
  /* the loader hands back the zenith as its first row and marks the texture
     flipY, so a row counted from the top is an elevation counted from the
     zenith down */
  const phi = (u - 0.5) * Math.PI * 2
  const theta = (0.5 - row) * Math.PI
  const elevation = (theta * 180) / Math.PI
  const azimuth = (Math.atan2(Math.cos(phi), -Math.sin(phi)) * 180) / Math.PI
  return {
    azimuth,
    elevation,
    kelvin: kelvinOf(bestR, bestG, bestB),
    contrast: mean > 0 ? best / mean : 1,
  }
}

/** the blackbody temperature whose own red over blue matches this light's.
    A search rather than an inversion: the curve `kelvinToColour` walks is
    piecewise and monotone in exactly this ratio, which is all a bisection
    needs. */
function kelvinOf(r: number, g: number, b: number): number {
  const want = Math.log(Math.max(1e-4, r) / Math.max(1e-4, b))
  let lo = 1500
  let hi = 12000
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2
    const c = kelvinToColour(mid)
    const got = Math.log(Math.max(1e-4, c.r) / Math.max(1e-4, c.b))
    if (got > want) lo = mid
    else hi = mid
  }
  return Math.round((lo + hi) / 2 / 50) * 50
}
