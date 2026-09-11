/** Receiver-plane PCF for the wing's opaque mineral and modern collection
 * receivers. Other materials retain the native PCFSoftShadowFilter. */
import * as TSL from 'three/tsl'

// The installed r185 runtime accepts one structured filter argument; the
// vendored declaration still describes the older positional signature.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any
const { Fn, float, fract, length, PCFSoftShadowFilter, reference, renderGroup,
  positionWorld, texture, vec2, vec3, vec4 } = TSL as unknown as Record<string, N>

export function createCollectionReceiverPlaneShadowFilter(): N {
  return Fn((inputs: N, builder: N) => {
    const { depthTexture, shadowCoord, shadow, depthLayer } = inputs
    const name = builder.material.name as string
    if (name !== 'vinci/collection/three-scale-architecture' && name !== 'vinci/collection/filtered-cast-concrete' && name !== 'vinci/brick' && name !== 'vinci/stone') {
      return PCFSoftShadowFilter({ depthTexture, shadowCoord, shadow, depthLayer })
    }
    const size = reference('mapSize', 'vec2', shadow).setGroup(renderGroup)
    // Copy the input: the native PCFSoft implementation mutates its UV.
    const coord = shadowCoord.toVar()
    // Fit the physical surface before normalBias. The material's shading
    // normal already contains procedural derivatives; differentiating that
    // normal again would make the plane follow bump noise and helper quads.
    // Retain coord below for the existing biased sample centre/base depth.
    const matrix = reference('matrix', 'mat4', shadow).setGroup(renderGroup)
    const projected = matrix.mul(vec4(positionWorld, 1)).toVar()
    const rawPlane = projected.xyz.div(projected.w)
    const plane = vec3(rawPlane.x, rawPlane.y.oneMinus(), rawPlane.z).toVar()
    const dx = plane.dFdx().toVar(), dy = plane.dFdy().toVar()
    const determinant = dx.x.mul(dy.y).sub(dx.y.mul(dy.x)).toVar()
    const scale = length(dx.xy).mul(length(dy.xy)).max(1e-12)
    const valid = determinant.abs().greaterThan(scale.mul(1e-5).max(1e-12))
    const signedSafe = determinant.greaterThanEqual(0).select(float(1), float(-1))
      .mul(determinant.abs().max(1e-12))
    // Invert d(uv)/d(screen) and apply it to d(depth)/d(screen).
    // The result is dz/du,dz/dv in the actual normalized shadow space.
    const gradient = vec2(dy.y.mul(dx.z).sub(dx.y.mul(dy.z)), dx.x.mul(dy.z).sub(dy.x.mul(dx.z)))
      .div(signedSafe).mul(valid.select(float(1), float(0))).toVar()
    const phase = fract(coord.xy.mul(size).add(.5)).toVar()
    const centre = coord.xy.sub(phase.sub(.5).div(size)).toVar()
    let sum: N = float(0)
    // Exactly the native four-gather footprint and its separable weights:
    // offsets −1.5,−0.5,+0.5,+1.5 texels with [1−f,1,1,f]/3.
    // Each comparison occurs at a texel centre, so hardware linear PCF
    // does not mix neighbouring texels with a shared incorrect depth.
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const sampleUV = centre.add(vec2(x - 1.5, y - 1.5).div(size)).toVar()
      const depth = coord.z.add(gradient.dot(sampleUV.sub(coord.xy)))
      let tap = texture(depthTexture, sampleUV)
      if (depthTexture.isArrayTexture) tap = tap.depth(depthLayer)
      const wx = x === 0 ? phase.x.oneMinus() : x === 3 ? phase.x : float(1)
      const wy = y === 0 ? phase.y.oneMinus() : y === 3 ? phase.y : float(1)
      sum = sum.add(tap.compare(depth).mul(wx).mul(wy))
    }
    return sum.mul(1 / 9)
  })
}
