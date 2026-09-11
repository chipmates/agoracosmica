/** Wing-owned atmospheric display continuation. No measured terrain,
 * scene fog, light or environment-probe input is changed by this module.
 */
import type { FogExp2, NodeMaterial } from 'three/webgpu'
import { cameraPosition, float, mix, positionWorld, vec3, vec4 } from 'three/tsl'

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

export function applyDisplayedHorizonHaze(material: NodeMaterial, fog: FogExp2): void {
  if (!material.colorNode) throw new Error('Displayed sky needs its existing colour node')
  const original = material.colorNode as ReturnType<typeof vec4>
  const direction = positionWorld.sub(cameraPosition).normalize()
  const reciprocalClearSine = 1 / Math.sin(displayedHorizonHazeProvenance.clearElevationDeg * Math.PI / 180)
  const path = float(1).div(direction.y.max(.0001)).sub(reciprocalClearSine).max(0)
    .mul(displayedHorizonHazeProvenance.effectiveColumnM)
  const opticalDepth = path.mul(fog.density).min(6)
  const transmittance = opticalDepth.mul(opticalDepth).negate().exp()
  const horizon = vec3(fog.color.r, fog.color.g, fog.color.b)
  material.colorNode = vec4(mix(horizon, original.rgb, transmittance), 1)
  material.userData['displayedHorizonHaze'] = displayedHorizonHazeProvenance
}
