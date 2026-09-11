/** Local ambient visibility at the registered masonry feet. This describes
 * occluded sky, not a second sun or an invented westward cast shadow.
 * Falloff 0.06–1.8 m is an A-LIGHT reconstruction parameter.
 */
import { float, length, positionWorld, smoothstep, vec2 } from 'three/tsl'
import { dossier } from './site'

export function foundationVisibility() {
  const p = vec2(positionWorld.x, positionWorld.z.negate())
  let distance: ReturnType<typeof length> = float(1000)
  const facades=(dossier as unknown as {facades:{render:boolean;from:{value:number[]};to:{value:number[]}}[]}).facades
  for (const facade of facades) {
    if (!facade.render) continue
    const a = facade.from.value, b = facade.to.value
    const dx = b[0]! - a[0]!, dn = b[1]! - a[1]!
    const span = dx * dx + dn * dn
    if (span < .1) continue
    const v = p.sub(vec2(a[0]!, a[1]!))
    const t = v.dot(vec2(dx, dn)).div(span).clamp(0, 1)
    distance = distance.min(length(v.sub(vec2(dx, dn).mul(t))))
  }
  return smoothstep(.06, 1.8, distance).mul(.66).add(.34)
}
