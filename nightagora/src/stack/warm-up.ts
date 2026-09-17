/* THE WARM UP — every pipeline the walk will meet, compiled before the first
   visible frame instead of inside the frame that first needed it.

   A WebGPU render pipeline is built the first time its material is drawn. On
   a leg that first time lands in the middle of a stride: a wing holds under
   20 ms standing still and then drops whole seconds walking into a room it
   has never drawn. Here the same work is done once, behind the field the
   visitor is already waiting at, where a second is a second of waiting and
   not a stutter in a walk.

   IT RIDES THE PAGE'S OWN LOOP, one pose per frame, and it does not call the
   renderer itself. A scene pass inside a post chain updates once per frame
   by its own node type, so a second render in the same frame draws the
   output quad over the last frame's picture and compiles nothing. So the
   warm up places an eye and hands the frame back: the loop that draws every
   other frame of the museum draws these too, through the same chain, with
   the same formats, which is the only way the pipelines it builds are the
   ones the walk will use.

   Only the drawing buffer is made small. A pipeline is keyed on the formats
   and the sample count of the pass it belongs to, never on how many pixels
   it covered. */

import { Vector2, type Object3D, type PerspectiveCamera, type Scene } from 'three/webgpu'
import type { Stack } from './index'

/** what a station stands at: the eye, what it looks at, the lens */
export interface WarmPose {
  eye: { x: number; y: number; z: number }
  at: { x: number; y: number; z: number }
  fov: number
}

export interface WarmWalk {
  /** One frame of the warm up, called from the wing's own update, before the
      loop renders. False once the last pose has been drawn and the eye and
      the buffer are back where they were: the frame that follows is the
      first the visitor sees, and it costs what every later frame costs. */
  frame(): boolean
  /** resolves on that same frame */
  done: Promise<void>
  /** put the eye and the buffer back without finishing the walk */
  abort(): void
}

/** the width the warm frames are drawn at. Wide enough that nothing culls
    away that a visitor's frame would keep, small enough to cost nothing. */
const WARM_WIDTH = 320

/** how long the sweep waits for the bodies the stack is holding for it. A
    build that never settles must not keep a visitor at the field: past this
    the sweep draws what stands, which is what the walk would have met. */
const HOLD_CAP_MS = 30000
/** and how long the last frame waits for the pipelines being linked */
const LINK_CAP_MS = 60000

export function warmWalk(
  stack: Stack,
  scene: Scene,
  camera: PerspectiveCamera,
  poses: readonly WarmPose[],
  report?: (done: number, total: number) => void,
  /** what the scene has to re-aim at each pose before it is drawn: a shadow
      cascade that travels with the visitor covers the eye it is focused on
      and nothing else, so a caster warmed without it never compiles its
      depth pass at all */
  aim?: (index: number) => void
): WarmWalk {
  const size = stack.renderer.getSize(new Vector2())
  const held = {
    position: camera.position.clone(),
    quaternion: camera.quaternion.clone(),
    fov: camera.fov,
  }
  // the poses, the sweep, and the frame that draws what the sweep compiled:
  // the walk is two steps longer than its stations, and the field's line is
  // measured against that
  const total = poses.length + 2
  const culled: Object3D[] = []
  const hidden: Object3D[] = []
  const began = performance.now()
  let at = -1
  let linkedFrom = 0
  let finish = (): void => {}
  const done = new Promise<void>((resolve) => {
    finish = resolve
  })
  /* THE PIPELINES ARE LINKED IN PARALLEL. A pipeline asked for inside a frame
     is linked synchronously, one after the other, and the submit that uses it
     waits for each: with every body of a wing standing at entry that is half
     a minute of one blocked queue. So while the warm up owns the loop, every
     pipeline goes through the device's asynchronous link, which runs them
     side by side and draws nothing until each is ready; the walk then waits
     for all of them and draws one last frame with everything in it, which
     links whatever is left the ordinary way and uploads what they read. */
  const pipelines = (stack.renderer as unknown as { _pipelines: { getForRender: (object: unknown, promises?: unknown[] | null) => unknown } })._pipelines
  const ordinary = pipelines.getForRender
  let linking = 0
  pipelines.getForRender = function (this: unknown, object: unknown, promises: unknown[] | null = null) {
    if (promises) return ordinary.call(this, object, promises)
    const asked: Promise<unknown>[] = []
    const pipeline = ordinary.call(this, object, asked)
    for (const link of asked) {
      linking++
      void link.then(() => { linking-- })
    }
    return pipeline
  }
  const unlink = (): void => {
    pipelines.getForRender = ordinary
  }
  // the style is left alone, so the canvas keeps the frame it had and none
  // of this is visible even if the field above it were to lift early
  stack.renderer.setSize(WARM_WIDTH, Math.round(WARM_WIDTH / (camera.aspect || 1)), false)

  /* THE SWEEP — one frame with nothing culled away. A pipeline is keyed on
     its material, its geometry and the pass it belongs to, never on where
     the eye stood, so a single frame that draws every mesh in the scene
     compiles every pipeline the walk can meet, including the ones that only
     come into view BETWEEN two stations, which is exactly where the old
     stalls were. The shadow pass culls by the same flag, so the depth
     pipelines come with it. */
  function sweep(on: boolean): void {
    if (on) {
      /* A BODY THE WALK SHOWS BY DISTANCE is hidden wherever the warm up's
         eye stands, so a wing marks it `naWarm` and the sweep draws it too:
         its pipeline is keyed on what it is, not on where it is seen from. */
      scene.traverse((object) => {
        if (object.userData['naWarm'] === true && !object.visible) {
          object.visible = true
          hidden.push(object)
        }
      })
      scene.traverse((object) => {
        if (!object.frustumCulled) return
        object.frustumCulled = false
        culled.push(object)
      })
      return
    }
    for (const object of culled) object.frustumCulled = true
    culled.length = 0
    for (const object of hidden) object.visible = false
    hidden.length = 0
  }

  /* AN EYE PLACED WHILE THE WALK RUNS IS THE ONE IT RETURNS TO. A station
     asked for during the warm up places the camera at once, and the next
     warm pose would overwrite it; restoring the eye the walk started from
     would then leave the visitor at the old station's eye with the new
     station's gaze. So an eye that is not the pose this walk placed is taken
     as the eye to restore. */
  const placed = { position: camera.position.clone(), quaternion: camera.quaternion.clone(), fov: camera.fov }
  function adopt(): void {
    if (camera.position.equals(placed.position) && camera.quaternion.equals(placed.quaternion) && camera.fov === placed.fov) return
    held.position.copy(camera.position)
    held.quaternion.copy(camera.quaternion)
    held.fov = camera.fov
    remember()
  }
  function remember(): void {
    placed.position.copy(camera.position)
    placed.quaternion.copy(camera.quaternion)
    placed.fov = camera.fov
  }

  function restore(): void {
    unlink()
    sweep(false)
    camera.position.copy(held.position)
    camera.quaternion.copy(held.quaternion)
    camera.fov = held.fov
    camera.updateProjectionMatrix()
    camera.updateMatrixWorld(true)
    stack.renderer.setSize(size.x, size.y, false)
  }

  return {
    done,
    abort() {
      if (at >= total) return
      at = total
      restore()
      finish()
    },
    frame() {
      if (at >= total) return false
      adopt()
      // the last pose stands while the stack still holds bodies for the sweep
      if (at === poses.length - 1 && stack.holding() > 0 && performance.now() - began < HOLD_CAP_MS) return true
      // and the sweep's eye stands, drawing nothing new, while what it asked
      // for is being linked
      if (at === poses.length) {
        sweep(false)
        linkedFrom ||= performance.now()
        if (linking > 0 && performance.now() - linkedFrom < LINK_CAP_MS) return true
      }
      // the pose placed last frame has been drawn by now, so the count the
      // loading field shows is of frames PAID FOR, not of frames asked for
      if (at >= 0) report?.(at + 1, total)
      at++
      if (at >= total) {
        restore()
        finish()
        return false
      }
      if (at === poses.length) {
        sweep(true)
        return true
      }
      if (at === poses.length + 1) {
        // the last frame draws everything, and links the ordinary way
        // whatever the parallel link did not reach
        unlink()
        sweep(true)
        return true
      }
      const pose = poses[at]!
      camera.position.set(pose.eye.x, pose.eye.y, pose.eye.z)
      camera.lookAt(pose.at.x, pose.at.y, pose.at.z)
      camera.fov = pose.fov
      camera.updateProjectionMatrix()
      camera.updateMatrixWorld(true)
      remember()
      aim?.(at)
      return true
    },
  }
}
