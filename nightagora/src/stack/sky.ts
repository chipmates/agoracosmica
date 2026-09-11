/* THE BAKED SKY — the ambient term's honest source.

   A flat ambient colour is the one lie a night scene cannot afford: it lifts
   the floor and the ceiling by the same amount and the room goes to fog. What
   a real room has instead is a sky above it and a ground below it, and the
   difference between those two is most of what "ambient" means outdoors at
   night.

   So the stack bakes one: an equirectangular sky painted from the scene's own
   horizon colours with the key light's disc in it, handed to three's PMREM
   path as an irradiance probe. No file, no download, and the probe rotates
   with the key light because it is drawn from it. When a wing ships a real
   HDRI, the same probe slot takes it and this generator steps aside. */

import { CanvasTexture, EquirectangularReflectionMapping, SRGBColorSpace, Texture } from 'three/webgpu'

export interface SkyRecipe {
  /** straight up */
  zenith: string
  /** the band the architecture stands against */
  horizon: string
  /** what is under the visitor's feet, reflected back up */
  ground: string
  /** the key's own disc: where it stands and how hard it burns */
  key: { azimuth: number; elevation: number; colour: string; size: number; intensity: number }
  /** a faint band of stars so the probe is not a studio dome */
  stars: number
}

const W = 512
const H = 256

/**
 * Paint the sky the probe is built from. Equirect: x is azimuth (0 at -Z,
 * growing clockwise seen from above), y is elevation (top = zenith).
 */
export function bakeSky(recipe: SkyRecipe): Texture {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2d context unavailable')

  const band = ctx.createLinearGradient(0, 0, 0, H)
  band.addColorStop(0, recipe.zenith)
  band.addColorStop(0.42, recipe.zenith)
  band.addColorStop(0.5, recipe.horizon)
  band.addColorStop(0.56, recipe.ground)
  band.addColorStop(1, recipe.ground)
  ctx.fillStyle = band
  ctx.fillRect(0, 0, W, H)

  // the stars are what stops the probe reading as a studio dome: a sparse
  // field, upper hemisphere only, deterministic enough to look the same twice
  if (recipe.stars > 0) {
    let seed = 0x9e3779b9
    const rnd = (): number => {
      seed = (seed * 1664525 + 1013904223) >>> 0
      return seed / 0x100000000
    }
    const n = Math.round(recipe.stars * 900)
    for (let i = 0; i < n; i++) {
      const x = rnd() * W
      const y = rnd() * H * 0.48
      const a = 0.06 + rnd() * 0.3
      ctx.fillStyle = `rgba(214, 226, 255, ${a.toFixed(3)})`
      ctx.fillRect(x, y, 1, 1)
    }
  }

  // the key's disc, so the probe carries a direction and not only a level
  const k = recipe.key
  const cx = (((k.azimuth % 360) + 360) % 360) * (W / 360)
  const cy = (0.5 - k.elevation / 180) * H
  const r = Math.max(2, (k.size / 360) * W)
  const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 7)
  halo.addColorStop(0, k.colour)
  halo.addColorStop(0.14, `rgba(255,255,255,${(0.22 * k.intensity).toFixed(3)})`)
  halo.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = halo
  ctx.beginPath()
  ctx.arc(cx, cy, r * 7, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = k.colour
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()

  const tex = new CanvasTexture(canvas)
  tex.mapping = EquirectangularReflectionMapping
  tex.colorSpace = SRGBColorSpace
  tex.needsUpdate = true
  return tex
}
