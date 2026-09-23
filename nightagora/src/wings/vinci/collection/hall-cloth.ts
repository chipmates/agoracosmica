/** THE SAIL LETS THE LIGHT THROUGH. Starched linen is a thin cloth, and a lamp
 * or a sky behind it glows through it on the side a visitor sees. The surface
 * a machine was built with is kept node for node; only the lighting model
 * learns that the cloth is thin. A property of the material class, not a
 * claim about the sheet: nothing here is documented detail.
 */
import { Color, MeshSSSNodeMaterial, type Material, type MeshStandardNodeMaterial } from 'three/webgpu'
import { float, vec3 } from 'three/tsl'

const KEPT = ['colorNode', 'normalNode', 'roughnessNode', 'metalnessNode', 'aoNode', 'emissiveNode', 'opacityNode',
  'positionNode', 'map', 'normalMap', 'roughnessMap', 'aoMap'] as const

/** The same cloth, thin. */
export function translucentCloth(from: MeshStandardNodeMaterial): Material {
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
  // starch; it spreads, so the glow is broad and never a hot spot
  const colour = from.colorNode ? (from.colorNode as unknown as { mul: (v: unknown) => unknown }).mul(vec3(1.0, .93, .8)) : vec3(...new Color(from.color).toArray())
  Object.assign(m, {
    thicknessColorNode: colour,
    thicknessDistortionNode: float(.35),
    thicknessPowerNode: float(1.2),
    thicknessScaleNode: float(7),
    thicknessAttenuationNode: float(.7),
    thicknessAmbientNode: float(0),
  })
  return m
}
