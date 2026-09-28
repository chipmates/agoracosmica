/** Wing-owned atmospheric display continuation. No measured terrain,
 * scene fog, light or environment-probe input is changed by this module.
 */
import { Color, Vector3, type FogExp2, type NodeMaterial } from 'three/webgpu'
import { cameraPosition, float, fog as fogNode, mix, mx_fractal_noise_float, positionWorld, smoothstep, uniform, vec3, vec4 } from 'three/tsl'

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

export function applyDisplayedHorizonHaze(material: NodeMaterial, fog: FogExp2, sun?: { x: number; y: number; z: number }, live?: HazeLive): void {
  if (!material.colorNode) throw new Error('Displayed sky needs its existing colour node')
  const original = material.colorNode as ReturnType<typeof vec4>
  const direction = positionWorld.sub(cameraPosition).normalize()
  const reciprocalClearSine = 1 / Math.sin(displayedHorizonHazeProvenance.clearElevationDeg * Math.PI / 180)
  const path = float(1).div(direction.y.max(.0001)).sub(reciprocalClearSine).max(0)
    .mul(displayedHorizonHazeProvenance.effectiveColumnM)
  const opticalDepth: TslNode = path.mul(live ? live.air.mul(live.veil).mul(fog.density) : fog.density).min(6)
  const transmittance = opticalDepth.mul(opticalDepth).negate().exp()
  let horizon: TslNode = sun ? hazeColour(direction, sun, fog, live) : vec3(fog.color.r, fog.color.g, fog.color.b)
  if (live) {
    // below the horizon the dome stands for far land, which darkens with it;
    // seen from above the court it is the land past the survey's edge, so it
    // deepens away from the horizon and carries faint field and wood lines
    const under = smoothstep(.0015, -.006, direction.y)
    const depth = smoothstep(0, -.1, direction.y).pow(.6)
    const lines = mx_fractal_noise_float(vec3(direction.x.mul(26), direction.y.mul(420), direction.z.mul(26)), 3, 2, .5).mul(.2).add(1)
    const farLand = mix(float(1), float(.32), depth).mul(lines)
    horizon = horizon.mul(mix(float(1), live.land.mul(mix(float(1), farLand, live.far)), under))
  }
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
  recipe: 'The rig\'s fog colour turned by the view\'s angle to the sun (cool #a8b2b6 away from it, warm #d2c7ae toward it); geometry takes it by an optical depth of beta times the path past the clear distance (in addition to the squared-exponential exhibition fog, never less); the displayed sky pales toward the horizon as a clear sky does: from nothing at the zenith to two thirds at fifteen degrees (one minus the sine of the elevation, to the power 1.4), up to 28 per cent of its saturation and up to a quarter brighter, and a quarter of the way toward the same haze colour. The air by distance is outdoor air: a surface inside the collection, seen from inside it, takes none. Exhibition atmosphere, not measured weather.',
  clearM: 18, betaPerM: .004, cool: '#a8b2b6', warm: '#d2c7ae',
  skyBand: { power: 1.4, desaturate: .28, lift: .25, brighten: .25 },
} as const

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TslNode = any
/** THE AIR'S COLOURS, THE SUN THEY TURN BY AND THE SHARE OF ITS DENSITY, AS
 * UNIFORMS. At rest they hold the rig's own values, so the picture is the
 * hour's; an evening moves them without building a shader. */
export interface HazeLive { sun: TslNode; warm: TslNode; mid: TslNode; cool: TslNode; air: TslNode; land: TslNode; veil: TslNode; far: TslNode }
export function createHazeLive(fog: FogExp2, sun: { x: number; y: number; z: number }): HazeLive {
  const P = aerialPerspectiveProvenance
  return { sun: uniform(new Vector3(sun.x, sun.y, sun.z)), warm: uniform(new Color(P.warm)), mid: uniform(fog.color.clone()), cool: uniform(new Color(P.cool)), air: uniform(1), land: uniform(1), veil: uniform(1), far: uniform(0) }
}
/** Puts the live set back at the rig's own values. */
export function resetHazeLive(live: HazeLive, fog: FogExp2, sun: { x: number; y: number; z: number }): void {
  const P = aerialPerspectiveProvenance
  live.sun.value.set(sun.x, sun.y, sun.z); live.warm.value.set(P.warm); live.mid.value.copy(fog.color); live.cool.value.set(P.cool); live.air.value = 1; live.land.value = 1; live.veil.value = 1; live.far.value = 0
}
export function hazeColour(direction: TslNode, sun: { x: number; y: number; z: number }, fog: FogExp2, live?: HazeLive): TslNode {
  const P = aerialPerspectiveProvenance
  const c = (hex: string): TslNode => { const k = new Color(hex); return vec3(k.r, k.g, k.b) }
  const toSun = direction.dot(live ? live.sun : vec3(sun.x, sun.y, sun.z))
  const mid = live ? live.mid : vec3(fog.color.r, fog.color.g, fog.color.b)
  const away = mix(mid, live ? live.cool : c(P.cool), smoothstep(.05, -.75, toSun))
  return mix(away, live ? live.warm : c(P.warm), smoothstep(.15, .95, toSun))
}

/** A world box, min and max corners: the rooms the aerial term stays out of. */
export interface IndoorBox { min: readonly [number, number, number]; max: readonly [number, number, number] }

/** The fog node for geometry: the exhibition fog as it was, and the aerial
 * term past the clear distance, both in the directional haze colour. The
 * aerial term is dropped where both the eye and the surface stand indoors. */
export function createAerialFog(fog: FogExp2, sun: { x: number; y: number; z: number }, indoors?: IndoorBox, live?: HazeLive): TslNode {
  const P = aerialPerspectiveProvenance
  const view = positionWorld.sub(cameraPosition), distance = view.length()
  const direction = view.div(distance.max(.0001))
  const exhibition = float(1).sub(distance.mul(live ? live.air.mul(fog.density) : fog.density).pow(2).negate().exp())
  let aerial: TslNode = float(1).sub(distance.sub(P.clearM).max(0).mul(live ? live.air.mul(P.betaPerM) : P.betaPerM).negate().exp())
  if (indoors) {
    const lo = vec3(...indoors.min), hi = vec3(...indoors.max)
    // full inside the box and a fifth of a metre past its faces, which are the rooms' inner faces
    const within = (p: TslNode): TslNode => {
      const out = lo.sub(p).max(p.sub(hi))
      return smoothstep(.6, .2, out.x.max(out.y).max(out.z))
    }
    aerial = aerial.mul(float(1).sub(within(positionWorld).mul(within(cameraPosition))))
  }
  const colour: TslNode = hazeColour(direction, sun, fog, live)
  return fogNode(live ? colour.mul(live.land) : colour, exhibition.max(aerial)) as unknown as TslNode
}

/** The displayed sky above the old twelve-degree band: its saturation falls
 * and it lifts toward the haze colour as it nears the horizon. */
export function applyDisplayedSkyAir(material: NodeMaterial, fog: FogExp2, sun: { x: number; y: number; z: number }, live?: HazeLive): void {
  if (!material.colorNode) throw new Error('Displayed sky needs its existing colour node')
  const P = aerialPerspectiveProvenance.skyBand
  const original = material.colorNode as ReturnType<typeof vec4>
  const direction = positionWorld.sub(cameraPosition).normalize()
  // nothing at the zenith, a fifth at forty-five degrees, two thirds at fifteen
  const low = float(1).sub(direction.y.clamp(0, 1)).pow(P.power)
  const rgb = original.rgb, grey = vec3(rgb.dot(vec3(.2126, .7152, .0722)))
  const faded = mix(rgb, grey, low.mul(P.desaturate)).mul(low.mul(P.brighten).add(1))
  material.colorNode = vec4(mix(faded, hazeColour(direction, sun, fog, live), low.mul(P.lift)), 1)
  material.userData['displayedSkyAir'] = aerialPerspectiveProvenance
}
