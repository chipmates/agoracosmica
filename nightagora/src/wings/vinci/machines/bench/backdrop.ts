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
  upperColour: '#36404b',
  frequenciesPerViewportHeight: [5.4, 14, 23, 180] as const,
  description: 'Static four-band coherent noise on a half-aspect viewport field. Broad charcoal tonal structure carried by the mix between two charcoals, middle density variation and fine filtered grain fade towards the existing fog colour. Fixed numerical offsets, no animation, no texture or additional light.',
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
  // Half the aspect, not all of it: measured straight, a phone's field holds
  // a third of the wide frame's horizontal cycles and the middle scale
  // disappears; measured per screen width the lumps stretch on the desktop.
  const aspect = viewportSize.x.div(viewportSize.y.max(1))
  const p = vec2(viewportUV.x.sub(.5).mul(aspect.sqrt()), viewportUV.y)

  // Every tier retains all three spatial bands. Density, rather than removal
  // of a band, quiets the field as it meets the scene's distant fog.
  // The floor's far edge crosses these frames between a fifth and a third of
  // the way down, so everything below that is ground, not air: a field spread
  // over two thirds of the frame spends its structure where nothing sees it.
  const verticalDensity = float(1).sub(smoothstep(.02, .34, viewportUV.y))
  const broad = mx_noise_float(vec3(vec2(p.x.mul(2.7), p.y.mul(5.4)), 3.17)).clamp(-1, 1)
  const middle = mx_noise_float(vec3(p.mul(23).add(vec2(7.31, 2.19)), 11.43)).clamp(-1, 1)
  // Distant air layers: slow across, quick down, which is how a far horizon
  // stacks. One extra tap, and it is what the eye reads as the middle scale.
  const layers = mx_noise_float(vec3(vec2(p.x.mul(3.4), p.y.mul(14)), 23.9)).clamp(-1, 1)
  const fine = mx_noise_float(vec3(p.mul(180).add(vec2(19.73, 31.07)), 5.89)).clamp(-1, 1)
  const fineCoverage = float(1).sub(smoothstep(.24, .75, length(fwidth(p)).mul(180)))

  // A wide, irregular tonal slope avoids an empty upper strip without
  // introducing a competing halo, a ruled band, clouds or a second subject.
  // The structure rides the MIX, not the brightness: the two colours are a
  // stop apart, so moving between them is the only lever dark air has.
  // A narrow frame shows the same field at half the width, so the same
  // amplitude reads as half the structure. The phone is a full viewer here,
  // not a crop of the wide one, and it is given the amplitude it needs.
  const narrow = float(1).add(float(1).sub(aspect.min(1)).mul(1.3))
  const shape = broad.mul(.6).add(layers.mul(.28)).add(middle.mul(.12)).mul(narrow)
  const gradient = verticalDensity.mul(shape.mul(.45).add(.62)).clamp(0, 1)
  const colour = mix(fogLinear, upperLinear, gradient)
  const detailDensity = verticalDensity.mul(.85).add(.15)
  const relief = narrow.mul(broad.mul(.14)
    .add(layers.mul(.1).mul(detailDensity))
    .add(middle.mul(.12).mul(detailDensity))
    .add(fine.mul(.075).mul(detailDensity).mul(fineCoverage))
    .mul(verticalDensity))
  return colour.mul(relief.add(1)).clamp(0, 1)
}
