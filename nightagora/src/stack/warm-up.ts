/* THE WARM UP — every pipeline the walk will meet, compiled before the first
   visible frame instead of inside the frame that first needed it.

   A WebGPU render pipeline is built the first time its material is drawn. On
   a leg that first time lands in the middle of a stride: a wing holds under
   20 ms standing still and then drops whole seconds walking into a room it
   has never drawn. Here the same work is done once, behind the field the
   visitor is already waiting at, where a second is a second of waiting and
   not a stutter in a walk.

   IT RIDES THE PAGE'S OWN LOOP, one pose and then one batch of the wing per
   frame, and it does not call the renderer itself. A scene pass inside a
   post chain updates once per frame
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

/** IN HOW MANY FRAMES THE SWEEP IS DRAWN. One frame that unculls a whole
    wing draws every body it has never drawn at once, and the first sight of
    a body is a node graph, a shader program and a pipeline built inside that
    frame: a single second-long block a loading line cannot move through. The
    same objects dealt into batches cost the same total and bound what one
    frame carries. The number is fixed, so a wing knows its total before the
    first pose is drawn; a count that grew later would shorten the line. */
export const WARM_SWEEP_SLICES = 20
/** THE WALK IS LONGER THAN ITS STATIONS: the sweep's slices, the wait while
    the device links what they asked for, and the frame that draws all of it
    together. A wing counting its own entry knows the total before the first
    pose is drawn. */
export const WARM_EXTRA_FRAMES = WARM_SWEEP_SLICES + 2
/** how long the sweep waits for the bodies the stack is holding for it. A
    build that never settles must not keep a visitor at the field: past this
    the sweep draws what stands, which is what the walk would have met. */
const HOLD_CAP_MS = 30000
/** and how long the walk waits for the pipelines being linked */
const LINK_CAP_MS = 60000

/** what a frame can draw, and so what a slice has to carry. Clearing the
    flag on anything else moves no work into the frame. */
function draws(object: Object3D): boolean {
  const it = object as { isMesh?: boolean; isPoints?: boolean; isLine?: boolean; isSprite?: boolean }
  return it.isMesh === true || it.isPoints === true || it.isLine === true || it.isSprite === true
}

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
  // the poses, the sweep's slices, the link, and the frame that draws what
  // they compiled: the walk is longer than its stations, and the field's line
  // is measured against that
  const total = poses.length + WARM_EXTRA_FRAMES
  /** the last slice's index, then the link, then the frame that draws it all */
  const lastSlice = poses.length + WARM_SWEEP_SLICES - 1
  const culled: Object3D[] = []
  const hidden: Object3D[] = []
  let batches: Object3D[][] = []
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
  /** every link this walk has asked for, so the wait for them is a count and
      not a clock: the line steps once per pipeline that lands */
  let linksAsked = 0
  pipelines.getForRender = function (this: unknown, object: unknown, promises: unknown[] | null = null) {
    if (promises) return ordinary.call(this, object, promises)
    const asked: Promise<unknown>[] = []
    const pipeline = ordinary.call(this, object, asked)
    for (const link of asked) {
      linking++
      linksAsked++
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

  /* THE SWEEP — the scene drawn with nothing culled away, dealt into slices.
     A pipeline is keyed on its material, its geometry and the pass it belongs
     to, never on where the eye stood, so frames that between them draw every
     mesh in the scene compile every pipeline the walk can meet, including the
     ones that only come into view BETWEEN two stations, which is exactly
     where the old stalls were. The shadow pass culls by the same flag, so the
     depth pipelines come with it. Each mesh is dealt to a slice in turn, so a
     batch holds bodies from across the whole wing rather than one room's, and
     no slice inherits a room's whole first sight. */
  function deal(): void {
    /* A BODY THE WALK SHOWS BY DISTANCE is hidden wherever the warm up's eye
       stands, so a wing marks it `naWarm` and the sweep draws it too: its
       pipeline is keyed on what it is, not on where it is seen from. Hiding
       carries down a branch, so this half is lifted whole and not in slices;
       a mesh under it still waits for the slice it was dealt to. */
    batches = Array.from({ length: WARM_SWEEP_SLICES }, () => [] as Object3D[])
    let dealt = 0
    scene.traverse((object) => {
      if (object.userData['naWarm'] === true && !object.visible) {
        object.visible = true
        hidden.push(object)
      }
      if (!object.frustumCulled || !draws(object)) return
      batches[dealt++ % WARM_SWEEP_SLICES]!.push(object)
    })
  }
  /** THE BATCHES STAY OPEN, one more each frame. A wing draws more than its
      own frame: a water mirror is a second pass over the scene, and it runs
      only in a frame where the mirror itself is drawn. A slice that closed
      the batch before it would leave every one of those second sights for
      the one frame that has everything open, which is the block this window
      is here to remove. Opened and left open, each pass meets one batch of
      new work per frame, and the frame that has everything open has nothing
      left to build. */
  function open(batch: readonly Object3D[]): void {
    for (const object of batch) {
      object.frustumCulled = false
      culled.push(object)
    }
  }
  function close(): void {
    for (const object of culled) object.frustumCulled = true
    culled.length = 0
  }
  function rehide(): void {
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
    close()
    rehide()
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
      // and while a library set is still arriving: an encoded map takes its
      // placeholder's place when it lands, which the sweep must draw
      if (at === poses.length - 1 && (stack.holding() > 0 || stack.materials.pending() > 0) && performance.now() - began < HOLD_CAP_MS) return true
      // and the eye stands, drawing nothing new, while what the slices asked
      // for is being linked. That wait is paid for in LINKS LANDED, not in
      // seconds: one step of the line per pipeline the device hands back, and
      // the whole wait is worth the one frame it stands in, never more.
      if (at === lastSlice + 1) {
        linkedFrom ||= performance.now()
        if (linking > 0 && performance.now() - linkedFrom < LINK_CAP_MS) {
          report?.(at + (linksAsked - linking) / linksAsked, total)
          return true
        }
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
        deal()
        open(batches[0]!)
        return true
      }
      if (at > poses.length && at <= lastSlice) {
        open(batches[at - poses.length]!)
        return true
      }
      if (at === lastSlice + 1) {
        // the last batch is culled again and the eye stands: the frames of
        // the link cost what an ordinary frame costs
        close()
        return true
      }
      if (at === total - 1) {
        // the last frame draws everything together, and links the ordinary
        // way whatever the parallel link did not reach
        unlink()
        for (const batch of batches) open(batch)
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
