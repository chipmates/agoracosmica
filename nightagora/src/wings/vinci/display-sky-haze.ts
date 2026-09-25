/** Wing-owned atmospheric display continuation. No measured terrain,
 * scene fog, light or environment-probe input is changed by this module.
 */
import { Color, type FogExp2, type NodeMaterial } from 'three/webgpu'
import { cameraPosition, float, fog as fogNode, mix, positionWorld, smoothstep, vec3, vec4 } from 'three/tsl'

export const displayedHorizonHazeProvenance = {
  class: 'GENERATED', source: ['A-LIGHT', 'brief/SITE-HOUR.md', 'brief/building/terrain.json'],
  recipe: 'Angular continuation of the existing FogExp2 extinction colour on the displayed sky only. The effective excess slant path is H × max(1/sin(elevation) − 1/sin(clear angle), 0); exp(−(density × path)²) retains the existing compressed sky. Downward and horizontal rays converge to the same linear fog colour as remote geometry. Optical depth is capped at six only for numerical saturation.',
  effectiveColumnM: 18, effectiveColumnRangeM: [12, 24],
  clearElevationDeg: 12, clearElevationRangeDeg: [10, 16],
  fog: { colour: '#c0bba9', densityPerM: .0075, densityRangePerM: [.0075, .015] },
  scope: 'Exhibition atmosphere, not measured weather or a physical fog-volume solution. This angular profile never reads the DEM, camera pose IDs, image pixels or inspection state. It does not generate or extrapolate terrain. It does not alter the light probe or baked-transport boundary.',
  label: {
    en: 'Assumed horizon haze for the displayed sky: an effective optical column of 12–24 m, nominal 18 m, clears toward 10–16° elevation, nominal 12°. It continues #c0bba9 fog at assumed density 0.0075–0.015 m⁻¹, nominal 0.0075 m⁻¹. These are exhibition controls, not weather measurements. The retained IGN domain, terrain heights, fixed hour, direct light and environment probe are unchanged.',
    de: 'Angenommener Horizontdunst für den sichtbaren Himmel: eine effektive optische Säule von 12–24 m, nominal 18 m, klingt bis 10–16° Höhe ab, nominal 12°. Sie setzt den Nebel #c0bba9 mit angenommener Dichte 0,0075–0,015 m⁻¹, nominal 0,0075 m⁻¹, fort. Dies sind Einstellungen der Ausstellung, keine Wettermessungen. Der erhaltene IGN-Bereich, Geländehöhen, festgelegte Stunde, Direktlicht und Umgebungsprobe bleiben unverändert.',
  },
} as const

export function applyDisplayedHorizonHaze(material: NodeMaterial, fog: FogExp2, sun?: { x: number; y: number; z: number }): void {
  if (!material.colorNode) throw new Error('Displayed sky needs its existing colour node')
  const original = material.colorNode as ReturnType<typeof vec4>
  const direction = positionWorld.sub(cameraPosition).normalize()
  const reciprocalClearSine = 1 / Math.sin(displayedHorizonHazeProvenance.clearElevationDeg * Math.PI / 180)
  const path = float(1).div(direction.y.max(.0001)).sub(reciprocalClearSine).max(0)
    .mul(displayedHorizonHazeProvenance.effectiveColumnM)
  const opticalDepth = path.mul(fog.density).min(6)
  const transmittance = opticalDepth.mul(opticalDepth).negate().exp()
  const horizon = sun ? hazeColour(direction, sun, fog) : vec3(fog.color.r, fog.color.g, fog.color.b)
  material.colorNode = vec4(mix(horizon, original.rgb, transmittance), 1)
  material.userData['displayedHorizonHaze'] = displayedHorizonHazeProvenance
}

/** THE AIR BY DISTANCE. One haze colour for the far planes and the low sky,
 * looked up by the direction of the view against the sun: brighter and warm
 * toward it (the forward scatter), cooler and bluer away from it, meeting the
 * rig's fog colour a quarter turn off. The near planes keep the hour's warmth:
 * the haze only starts past `clearM`, and it grows by optical depth, so it
 * lifts and cools what stands far off before it hides it. */
export const aerialPerspectiveProvenance = {
  class: 'GENERATED',
  recipe: 'The rig\'s fog colour turned by the view\'s angle to the sun (cool #a8b2b6 away from it, warm #d2c7ae toward it); geometry takes it by an optical depth of beta times the path past the clear distance (in addition to the squared-exponential exhibition fog, never less); the displayed sky pales toward the horizon as a clear sky does: from nothing at the zenith to two thirds at fifteen degrees (one minus the sine of the elevation, to the power 1.4), up to 28 per cent of its saturation and up to a quarter brighter, and a quarter of the way toward the same haze colour. Exhibition atmosphere, not measured weather.',
  clearM: 18, betaPerM: .004, cool: '#a8b2b6', warm: '#d2c7ae',
  skyBand: { power: 1.4, desaturate: .28, lift: .25, brighten: .25 },
} as const

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TslNode = any
export function hazeColour(direction: TslNode, sun: { x: number; y: number; z: number }, fog: FogExp2): TslNode {
  const P = aerialPerspectiveProvenance
  const c = (hex: string): TslNode => { const k = new Color(hex); return vec3(k.r, k.g, k.b) }
  const toSun = direction.dot(vec3(sun.x, sun.y, sun.z))
  const mid = vec3(fog.color.r, fog.color.g, fog.color.b)
  const away = mix(mid, c(P.cool), smoothstep(.05, -.75, toSun))
  return mix(away, c(P.warm), smoothstep(.15, .95, toSun))
}

/** The fog node for geometry: the exhibition fog as it was, and the aerial
 * term past the clear distance, both in the directional haze colour. */
export function createAerialFog(fog: FogExp2, sun: { x: number; y: number; z: number }): TslNode {
  const P = aerialPerspectiveProvenance
  const view = positionWorld.sub(cameraPosition), distance = view.length()
  const direction = view.div(distance.max(.0001))
  const exhibition = float(1).sub(distance.mul(fog.density).pow(2).negate().exp())
  const aerial = float(1).sub(distance.sub(P.clearM).max(0).mul(P.betaPerM).negate().exp())
  return fogNode(hazeColour(direction, sun, fog), exhibition.max(aerial)) as unknown as TslNode
}

/** The displayed sky above the old twelve-degree band: its saturation falls
 * and it lifts toward the haze colour as it nears the horizon. */
export function applyDisplayedSkyAir(material: NodeMaterial, fog: FogExp2, sun: { x: number; y: number; z: number }): void {
  if (!material.colorNode) throw new Error('Displayed sky needs its existing colour node')
  const P = aerialPerspectiveProvenance.skyBand
  const original = material.colorNode as ReturnType<typeof vec4>
  const direction = positionWorld.sub(cameraPosition).normalize()
  // nothing at the zenith, a fifth at forty-five degrees, two thirds at fifteen
  const low = float(1).sub(direction.y.clamp(0, 1)).pow(P.power)
  const rgb = original.rgb, grey = vec3(rgb.dot(vec3(.2126, .7152, .0722)))
  const faded = mix(rgb, grey, low.mul(P.desaturate)).mul(low.mul(P.brighten).add(1))
  material.colorNode = vec4(mix(faded, hazeColour(direction, sun, fog), low.mul(P.lift)), 1)
  material.userData['displayedSkyAir'] = aerialPerspectiveProvenance
}
