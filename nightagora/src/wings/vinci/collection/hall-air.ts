/** THE HALL'S AIR, FOR THE FILM: a thin haze that the clerestory's light and
 * the spots are seen through, each shaft carved by the shadows its own map
 * holds. Marched through the hall's box and stopped at the room's depth.
 *
 * The room's depth is the air's own: the scene's pass is multisampled, and a
 * multisampled depth cannot be read, so a depth pass without samples is drawn
 * for the camera the air is drawn for, just before it. A modern room's air;
 * no claim about 1517.
 */
import {
  AdditiveBlending, BackSide, BoxGeometry, DepthTexture, FloatType, Mesh, MeshBasicNodeMaterial, NodeUpdateType,
  RenderTarget, TextureNode, Vector2, VolumeNodeMaterial, type Light, type Scene,
} from 'three/webgpu'
import * as TSL from 'three/tsl'
import { FLOOR, ROOMS } from './layout'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any
const { float, interleavedGradientNoise, lights, mx_noise_float, screenCoordinate, screenUV, smoothstep } = TSL as unknown as Record<string, N>

export const HALL_AIR_PROVENANCE = {
  manifestId: 'vinci/collection-hall-air', assetClass: 'GENERATED', certainty: 'reconstructed',
} as const

/** The depth of whatever the camera drawing the air sees, taken just before
 * the air is drawn, at half the frame's size. */
class RoomDepth extends TextureNode {
  private target: RenderTarget
  private scene: Scene
  private air: Mesh
  private override = new MeshBasicNodeMaterial({ colorWrite: false })
  private drawn = new Vector2()
  private busy = false
  constructor(scene: Scene, air: Mesh) {
    const target = new RenderTarget(2, 2, { depthBuffer: true })
    target.depthTexture = new DepthTexture(2, 2, FloatType)
    super(target.depthTexture, screenUV)
    this.target = target
    this.scene = scene
    this.air = air
    this.updateBeforeType = NodeUpdateType.RENDER
  }
  override updateBefore(frame: { renderer: N; camera: N }): boolean | undefined {
    if (this.busy) return false
    const { renderer, camera } = frame
    renderer.getDrawingBufferSize(this.drawn)
    const w = Math.max(2, Math.round(this.drawn.x / 2)), h = Math.max(2, Math.round(this.drawn.y / 2))
    if (this.target.width !== w || this.target.height !== h) this.target.setSize(w, h)
    this.busy = true
    const target = renderer.getRenderTarget(), mrt = renderer.getMRT(), override = this.scene.overrideMaterial
    this.air.visible = false
    this.scene.overrideMaterial = this.override
    renderer.setMRT(null)
    renderer.setRenderTarget(this.target)
    renderer.render(this.scene, camera)
    renderer.setRenderTarget(target)
    renderer.setMRT(mrt)
    this.scene.overrideMaterial = override
    this.air.visible = true
    this.busy = false
    return undefined
  }
  override dispose(): void {
    this.target.dispose()
    this.override.dispose()
    super.dispose()
  }
}

export interface HallAir {
  mesh: Mesh
  dispose(): void
}

/** The air in the hall, lit by the lights it is handed. */
export function mountHallAir(scene: Scene, lit: readonly Light[], density: number): HallAir {
  const H = ROOMS.hall
  const top = 1.0, inset = .03
  const geometry = new BoxGeometry(H.east - H.west - 2 * inset, top - FLOOR - 2 * inset, H.north - H.south - 2 * inset)
  geometry.translate((H.west + H.east) / 2, (FLOOR + top) / 2, -(H.south + H.north) / 2)
  // enough steps that the dither which breaks the banding is finer than the
  // eye can hold as a pattern, even around a lamp
  const material = new VolumeNodeMaterial({ steps: 88 })
  material.name = 'vinci/collection-hall-air'
  material.side = BackSide
  material.blending = AdditiveBlending
  material.depthWrite = false
  material.depthTest = false
  const mesh = new Mesh(geometry, material)
  mesh.name = 'vinci/collection-hall-air'
  mesh.castShadow = false; mesh.receiveShadow = false
  mesh.frustumCulled = false
  mesh.renderOrder = 10
  mesh.raycast = () => {}
  mesh.userData = { ...HALL_AIR_PROVENANCE, labelOccluder: false, naLabelOccluder: false }
  const depth = new RoomDepth(scene, mesh)
  // the air is densest low down and thins toward the roof, and it is never
  // quite even: a slow drift, metres across, so no two shafts read the same
  const scattering = ({ positionRay }: { positionRay: N }): N => {
    const low = float(1).sub(smoothstep(float(FLOOR), float(top), positionRay.y)).mul(.8).add(.2)
    const drift = mx_noise_float(positionRay.mul(.23)).mul(.35).add(1)
    return low.mul(drift).mul(density)
  }
  Object.assign(material, {
    lightsNode: lights([...lit]),
    offsetNode: interleavedGradientNoise(screenCoordinate.xy),
    scatteringNode: scattering,
    depthNode: depth,
  })
  return {
    mesh,
    dispose() {
      depth.dispose()
      geometry.dispose()
      material.dispose()
    },
  }
}
