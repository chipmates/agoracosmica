/* PLANAR REFLECTION — for the floors that are actually polished.

   A screen-space reflection is a guess that fails exactly where a floor is
   most convincing: at the grazing angle, where the reflected thing is off
   the top of the screen. Marble, lapis and water are all grazing-angle
   surfaces, so they get the honest version: the scene rendered a second time
   from behind the plane.

   It costs a second pass over the scene, which is why it is a tier feature
   and why the resolution scale is part of the contract. A reflection at half
   resolution on a polished stone floor is indistinguishable from one at full
   resolution, because stone is not a mirror. */

import { Object3D, type Mesh, type Scene } from 'three/webgpu'
import * as TSL from 'three/tsl'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any
const { reflector } = TSL as unknown as Record<string, N>

export interface ReflectorOptions {
  /** 1 is the full frame; a stone floor is convincing at 0.5 */
  resolutionScale?: number
  /** whether this reflection may contain other reflections */
  bounces?: boolean
  generateMipmaps?: boolean
}

export interface Reflection {
  /** the reflected colour, ready to be mixed into the plane's own material */
  node: N
  /** the mirror plane; it rides the mesh it was made for */
  target: Object3D
  dispose: () => void
}

/**
 * Mirror `plane` (a mesh whose local XY face is the reflecting surface after
 * its own rotation) and hand back the node its material should read.
 */
export function createReflector(
  scene: Scene,
  plane: Mesh,
  opts: ReflectorOptions = {}
): Reflection {
  const node = reflector({
    resolutionScale: opts.resolutionScale ?? 0.5,
    bounces: opts.bounces ?? false,
    generateMipmaps: opts.generateMipmaps ?? false,
  })
  const target: Object3D = node.target
  plane.updateWorldMatrix(true, false)
  target.position.setFromMatrixPosition(plane.matrixWorld)
  target.quaternion.setFromRotationMatrix(plane.matrixWorld)
  scene.add(target)

  return {
    node,
    target,
    dispose() {
      scene.remove(target)
    },
  }
}
