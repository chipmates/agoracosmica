/* THE REAL SKY. Stage 0.2 left the probe slot open and baked its own sky
   into it; this is what fills the slot when a scene has an hour it can
   point at.

   Three 2K equirectangular HDRIs live in the library, all CC0, all
   manifest-logged like every other asset: a clear night with the moon
   standing in it, an overcast day, a warm late afternoon. Loading one is a
   network fetch, and a key light is built inside a scene's constructor, so
   the two cannot be one call. `Stack.hdri(name)` does the fetch and the
   manifest resolution; `Stack.light({ probe })` takes the result. */

import { EquirectangularReflectionMapping, type Texture } from 'three/webgpu'
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js'
import { loadManifest, type ManifestEntry } from '../manifest'
import { ASSET_BASE } from './materials'

const loader = new HDRLoader()
const held = new Map<string, Promise<Texture>>()

export interface SkyProbe {
  texture: Texture
  entry: ManifestEntry
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
  return { texture: await pending, entry }
}
