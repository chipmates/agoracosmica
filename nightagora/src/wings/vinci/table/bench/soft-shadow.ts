import { NearestFilter, type DepthTexture, type DirectionalLight, type DirectionalLightShadow, type Node, type NodeBuilder } from 'three/webgpu'
import { Fn, dFdx, dFdy, float, fract, ivec2, mix, reference, textureLoad, vec2 } from 'three/tsl'

type ShadowInputs = {
  depthTexture: DepthTexture
  shadowCoord: Node<'vec3'>
  shadow: DirectionalLightShadow
}

// A stable disk keeps the book still. Screen-space random rotations would
// turn the shadow into moving stipple on the small printed lines.
function disk(count: number): Array<readonly [number, number]> {
  return Array.from({ length: count }, (_, i) => {
    const radius = Math.sqrt((i + 0.5) / count)
    const angle = i * 2.399963229728653
    return [Math.cos(angle) * radius, Math.sin(angle) * radius] as const
  })
}
const SEARCH_DISK = disk(12)
const FILTER_DISK = disk(16)
const ANGULAR_RADIUS = 0.055
const MAX_PENUMBRA_METRES = 0.014

/** Contact-hardening filtering of the actual caster depth, in book metres.
 * The receiver-plane correction evaluates each tap at the depth its own
 * position has on the receiving sheet. A wide kernel without this correction
 * mistakes the sheet's own slope for an occluder and produces paper acne.
 */
const bookShadowFilter = Fn(({ depthTexture, shadowCoord, shadow }: ShadowInputs, builder: NodeBuilder) => {
  // Read ordinary depth and compare it explicitly. Mixing raw blocker reads
  // and a comparison sampler on one texture creates conflicting sampler
  // bindings in the WebGL fallback. This uses the same raw texture path on
  // both backends; the final four-tap visibility interpolation is manual PCF.
  depthTexture.compareFunction = null
  depthTexture.minFilter = depthTexture.magFilter = NearestFilter

  const size = reference('mapSize', 'vec2', shadow)
  const mapUV = shadowCoord.xy.toVar()
  const receiver = (builder.renderer.reversedDepthBuffer ? shadowCoord.z.oneMinus() : shadowCoord.z).toVar()
  const dx = dFdx(mapUV).toVar(), dy = dFdy(mapUV).toVar()
  const dzdx = dFdx(receiver), dzdy = dFdy(receiver)
  const determinant = dx.x.mul(dy.y).sub(dx.y.mul(dy.x)).toVar()
  // Keep a signed denominator even when the projection approaches edge-on.
  const divisor = determinant.lessThan(0).select(determinant.min(-1e-10), determinant.max(1e-10))
  const gradient = vec2(
    dzdx.mul(dy.y).sub(dzdy.mul(dx.y)),
    dx.x.mul(dzdy).sub(dy.x.mul(dzdx)),
  ).div(divisor).clamp(-1, 1).toVar()
  const depthSpan = reference('far', 'float', shadow.camera).sub(reference('near', 'float', shadow.camera))
  const worldSpan = reference('right', 'float', shadow.camera).sub(reference('left', 'float', shadow.camera))
  const searchRadius = float(MAX_PENUMBRA_METRES).div(worldSpan)

  const rawDepth = (pixel: Node<'vec2'>) => {
    const coordinate = ivec2(pixel.clamp(vec2(0), size.sub(1)))
    const sample = textureLoad(depthTexture, coordinate, 0).r
    return builder.renderer.reversedDepthBuffer ? sample.oneMinus() : sample
  }
  const correctedReceiver = (atUV: Node<'vec2'>) => receiver.add(gradient.dot(atUV.sub(mapUV)))
  const blockerSum = float(0).toVar(), blockerCount = float(0).toVar()
  for (const [x, y] of SEARCH_DISK) {
    const atUV = mapUV.add(vec2(x, y).mul(searchRadius))
    const pixel = atUV.mul(size).floor().toVar()
    const actualUV = pixel.add(0.5).div(size)
    const gap = correctedReceiver(actualUV).sub(rawDepth(pixel)).toVar()
    // The light's normal/depth bias is already included in shadowCoord.
    const isBlocker = gap.greaterThan(0)
    blockerSum.addAssign(isBlocker.select(gap, 0))
    blockerCount.addAssign(isBlocker.select(1, 0))
  }
  const distance = blockerSum.div(blockerCount.max(1)).mul(depthSpan)
  const radius = distance.mul(ANGULAR_RADIUS).div(worldSpan)
    .clamp(float(0.65).div(size.x), searchRadius).toVar()

  const visibility = (pixel: Node<'vec2'>) => {
    const atUV = pixel.add(0.5).div(size)
    return correctedReceiver(atUV).lessThanEqual(rawDepth(pixel)).select(1, 0)
  }
  const filtered = float(0).toVar()
  for (const [x, y] of FILTER_DISK) {
    const pixel = mapUV.add(vec2(x, y).mul(radius)).mul(size).sub(0.5).toVar()
    const origin = pixel.floor().toVar(), weight = fract(pixel)
    // Interpolate comparison results, never depths across a silhouette.
    const lower = mix(visibility(origin), visibility(origin.add(vec2(1, 0))), weight.x)
    const upper = mix(visibility(origin.add(vec2(0, 1))), visibility(origin.add(vec2(1, 1))), weight.x)
    filtered.addAssign(mix(lower, upper, weight.y))
  }
  return blockerCount.greaterThan(0).select(filtered.div(FILTER_DISK.length), 1)
})

/** Configure only a light owned by the isolated reading-table bench.
 * Call before the first scene draw so all receiving materials compile with
 * this filter. No shared renderer shadow mode or tier configuration changes.
 */
export function configureBookShadow(light: DirectionalLight): void {
  const shadow = light.shadow
  // The shared light stands 24 m from the book. A 60 m depth range turns even
  // tiny normalized bias into millimetres. Fit depth to this local carrier.
  const distance = light.position.distanceTo(light.target.position)
  shadow.camera.near = Math.max(0.01, distance - 1.5)
  shadow.camera.far = distance + 1.5
  shadow.camera.updateProjectionMatrix()
  shadow.normalBias = 0.00018
  shadow.bias = -0.000025
  // r185 ShadowNode.js reads LightShadow.filterNode, but @types/three r185
  // omits that property. This intersection adds only that verified API.
  ;(shadow as typeof shadow & { filterNode: typeof bookShadowFilter }).filterNode = bookShadowFilter
  shadow.needsUpdate = true
}
