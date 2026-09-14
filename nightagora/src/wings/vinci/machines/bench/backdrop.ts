import { Color, type Node } from 'three/webgpu'
import { float, fwidth, length, mix, mx_noise_float, smoothstep, vec2, vec3, viewportSize, viewportUV } from 'three/tsl'

/** Procedural dressing for the existing bench's distant charcoal field.
 * No image, captured surface, historical sky or weather is represented.
 * The host keeps the stack.detail helper on its actual floor and support
 * materials; this background node does not replace either material.
 */
export const BENCH_BACKDROP_RECIPE = Object.freeze({
  class: 'GENERATED',
  name: 'vinci/bench/charcoal-backdrop',
  fogColour: '#1a2026',
  upperColour: '#293038',
  frequenciesPerViewportHeight: [2.7, 23, 180] as const,
  description: 'Static three-scale coherent noise on an aspect-correct viewport field. Broad charcoal tonal gradient, middle density variation and fine filtered grain fade towards the existing fog colour. Fixed numerical offsets, no animation, no texture or additional light.',
})

/** Assign the returned node to scene.backgroundNode for the distant bench field. The node has no timers, scene mutation or owned GPU assets.
 * It uses r185 viewport coordinates, which follow the same top-left origin
 * on WebGPU and the WebGL fallback. The host clears backgroundNode on exit.
 */
export function createBenchBackdrop(): Node {
  const fog = new Color(BENCH_BACKDROP_RECIPE.fogColour)
  const upper = new Color(BENCH_BACKDROP_RECIPE.upperColour)
  // Color has already converted the hex sRGB values to linear components.
  // Feeding the original hex channel fractions to TSL would brighten them.
  const fogLinear = vec3(fog.r, fog.g, fog.b)
  const upperLinear = vec3(upper.r, upper.g, upper.b)
  const aspect = viewportSize.x.div(viewportSize.y.max(1))
  const p = vec2(viewportUV.x.sub(.5).mul(aspect), viewportUV.y)

  // Every tier retains all three spatial bands. Density, rather than removal
  // of a band, quiets the field as it meets the scene's distant fog.
  const verticalDensity = float(1).sub(smoothstep(.04, .66, viewportUV.y))
  const broad = mx_noise_float(vec3(p.mul(2.7), 3.17)).clamp(-1, 1)
  const middle = mx_noise_float(vec3(p.mul(23).add(vec2(7.31, 2.19)), 11.43)).clamp(-1, 1)
  const fine = mx_noise_float(vec3(p.mul(180).add(vec2(19.73, 31.07)), 5.89)).clamp(-1, 1)
  const fineCoverage = float(1).sub(smoothstep(.24, .75, length(fwidth(p)).mul(180)))

  // A wide, irregular tonal slope avoids an empty upper strip without
  // introducing a competing halo, a ruled band, clouds or a second subject.
  const gradient = verticalDensity.mul(broad.mul(.12).add(.78)).clamp(0, 1)
  const colour = mix(fogLinear, upperLinear, gradient)
  const detailDensity = verticalDensity.mul(.85).add(.15)
  const relief = broad.mul(.18)
    .add(middle.mul(.14).mul(detailDensity))
    .add(fine.mul(.065).mul(detailDensity).mul(fineCoverage))
    .mul(verticalDensity)
  return colour.mul(relief.add(1)).clamp(0, 1)
}
