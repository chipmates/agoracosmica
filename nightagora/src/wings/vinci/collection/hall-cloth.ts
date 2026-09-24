/** THE SAIL LETS THE LIGHT THROUGH. Starched linen is a thin cloth, and a lamp
 * or a sky behind it glows through it on the side a visitor sees. The surface
 * a machine was built with is kept node for node; only the lighting model
 * learns that the cloth is thin. A property of the material class, not a
 * claim about the sheet: nothing here is documented detail.
 */
import { Color, MeshSSSNodeMaterial, type Material, type MeshStandardNodeMaterial } from 'three/webgpu'
import { attribute, float, vec3 } from 'three/tsl'

const KEPT = ['colorNode', 'normalNode', 'roughnessNode', 'metalnessNode', 'aoNode', 'emissiveNode', 'opacityNode',
  'positionNode', 'map', 'normalMap', 'roughnessMap', 'aoMap'] as const

/** The same cloth, thin. A cloth sewn with doubled layers carries the share
 * of light each layer lets through in its `layers` attribute. */
export function translucentCloth(from: MeshStandardNodeMaterial, layered = false): Material {
  const m = new MeshSSSNodeMaterial()
  const source = from as unknown as Record<string, unknown>, target = m as unknown as Record<string, unknown>
  for (const key of KEPT) if (source[key] != null) target[key] = source[key]
  m.color.copy(from.color)
  m.roughness = from.roughness
  m.metalness = from.metalness
  m.side = from.side
  m.shadowSide = from.shadowSide
  m.transparent = from.transparent
  m.opacity = from.opacity
  m.name = `${from.name}:thin`
  m.userData = { ...from.userData }
  // what comes through is the cloth's own colour, a little warmer for the
  // starch; it spreads, so the glow is broad and never a hot spot, and a
  // share of it leaves the far face whichever way the eye looks: a lamp above
  // the sail lights its underside from within
  const warm = layered ? vec3(1.0, .96, .88) : vec3(1.0, .93, .8)
  const base = from.colorNode ? (from.colorNode as unknown as { mul: (v: unknown) => unknown }).mul(warm) : vec3(...new Color(from.color).toArray())
  const colour = layered ? (base as unknown as { mul: (v: unknown) => unknown }).mul(attribute('layers', 'float')) : base
  Object.assign(m, {
    thicknessColorNode: colour,
    thicknessDistortionNode: float(.35),
    thicknessPowerNode: float(1.2),
    thicknessScaleNode: float(7),
    thicknessAttenuationNode: float(.7),
    thicknessAmbientNode: float(layered ? .24 : 0),
  })
  return m
}
