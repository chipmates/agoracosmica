import type { MeshStandardNodeMaterial, Node } from 'three/webgpu'
import { normalGeometry, uv, vec2, vec3 } from 'three/tsl'

/** GENERATED optical approximation for the assumed cover's foot.
 * The deck's metric top-cap UVs are its local X/Z coordinates. A soft,
 * directional annulus peaking at .203 m, just beyond the exact .2 m glass
 * radius, approximates the small
 * concentration of indirect light beyond the cover wall. It remains attached
 * to the existing deck during the slow quasi-static demonstration.
 * This is surface dressing, not a ray-traced caustic or a historical mark.
 * It adds no plane, changes no part dimension, and retains every base detail
 * node. The host must explicitly record the approximation in its recipe.
 */
export function createGlassSeatMaterial(base: MeshStandardNodeMaterial): MeshStandardNodeMaterial {
  if (!base.colorNode) throw new Error('Glass seat requires the dressed deck material')
  const material = base.clone()
  material.name = `${base.name}:glass-foot-light`
  const p = uv(), radius = p.length()
  const ring = radius.sub(.203).div(.014).pow(2).negate().exp()
  // The selected hour's light arrives from -X/+Z. Its transmitted foot cue
  // favours the opposite sector; the broad lobe avoids an engraved-circle look.
  const sector = p.dot(vec2(.785, -.619)).div(radius.max(.001)).mul(.45).add(.55).max(0)
  const top = normalGeometry.y.max(0).pow(8)
  material.colorNode = (base.colorNode as Node<'vec3'>).add(vec3(.24, .18, .10).mul(ring).mul(sector).mul(top))
  return material
}
