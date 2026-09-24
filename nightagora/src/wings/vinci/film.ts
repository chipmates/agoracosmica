/* THE FILM'S HAND ON THE RAIL — loaded only when `?export=1` asks for it.

   The export walks the film graph's clips (`forge/film/graph.mjs`) on the live
   rail with the very calls a visitor's press makes, which `replay.mjs` makes in
   node, and stands the eye on a node at once, the way a cut does. The poses
   are the wing's own, computed here, never numbers carried in from node: the
   certificate matches what this page computes. */

import type { VinciStationId } from './content'
import type { createRail, Pose } from './rail'
import type { VinciWalk, VinciWalkStop } from './walk'
import { LOOP_S, windClock } from './wind'

type Rail = ReturnType<typeof createRail>

export interface FilmNode {
  id: string
  kind: 'stop' | 'view'
  station: VinciStationId
  walkId?: string
  exhibit?: string
  wall?: string
  vertex?: number
}

export interface FilmMotion {
  rail: 'route' | 'wall' | 'approach' | 'return' | 'link'
  from?: number | string
  to?: number | string
  exhibit?: string
}

export interface FilmParts {
  rail: () => Rail
  walk: VinciWalk
  narrow: () => boolean
  walkPose: (stop: VinciWalkStop, narrow: boolean) => Pose
  approachPose: (exhibit: string, narrow: boolean) => Pose | undefined
}

/** THE WORLD'S CLOCK AT THE JOINS. At rest the wind stands on its loop's
    first frame, so every still of a stop is one picture; a leg carries it
    through whole loops as the body walks, easing in and out with the walk,
    and lands on the first frame again. A leg shorter than a loop holds it. */
export function pinnedWind(nav: { active?: string | null; legSeconds: number; legWalked: number }): number {
  if (!nav.active) return 0
  const loops = Math.floor(nav.legSeconds / LOOP_S)
  return (LOOP_S * loops * nav.legWalked) % LOOP_S
}

export function installFilm(parts: FilmParts): void {
  const phone = (): boolean => parts.narrow()
  const stopOf = (walkId: string): VinciWalkStop => {
    const stop = parts.walk.stops.find((s) => s.id === walkId)
    if (!stop) throw new Error(`the walk has no stop ${walkId}`)
    return stop
  }
  const stationStop = (station: string): VinciWalkStop => {
    const stop = parts.walk.stops.find((s) => s.station === station && !s.exhibit)
    if (!stop) throw new Error(`no stop of the walk stands at ${station}`)
    return stop
  }
  const poseOf = (node: FilmNode): Pose => {
    if (node.kind === 'stop') return parts.walkPose(stopOf(node.walkId ?? node.station), phone())
    const pose = parts.approachPose(node.exhibit ?? '', phone())
    if (!pose) throw new Error(`${node.id}: no viewing pose`)
    return pose
  }

  /* THE ARRIVAL STANDS ON THE NODE'S OWN POSE. A walked leg lands on it
     through other arithmetic than a placement (the path's end, the gaze's
     angles, the eased lens), a last bit apart, and the clip's last frame must
     be its still's bytes: at rest after the leg the eye is placed on it. */
  let arriving: FilmNode | null = null
  let left = false
  const hook = {
    /** the eye stood at a node at once, as a cut stands it */
    place(node: FilmNode): boolean {
      const rail = parts.rail()
      if (node.kind === 'stop') {
        rail.set(node.station, poseOf(node), true, phone(), node.exhibit ? node.vertex : undefined)
        return true
      }
      if (node.wall) {
        rail.set(node.station, poseOf(node), true, phone(), node.vertex)
        return true
      }
      rail.set(node.station, parts.walkPose(stationStop(node.station), phone()), true, phone())
      rail.update()
      return rail.approach(node.exhibit ?? '', poseOf(node), phone(), true)
    },
    /** the leg from one node to the next, asked for as the press asks for it */
    walk(from: FilmNode, to: FilmNode, motion: FilmMotion): boolean {
      const rail = parts.rail()
      arriving = to
      left = false
      if (motion.rail === 'route') { rail.set(to.station, poseOf(to), false, phone()); return true }
      if (motion.rail === 'wall') {
        if (to.kind === 'stop') { rail.set(to.station, poseOf(to), false, phone(), Number(motion.to)); return true }
        return rail.along(Number(motion.to), from.station, poseOf(to), to.exhibit, phone())
      }
      if (motion.rail === 'approach') return rail.approach(motion.exhibit ?? '', poseOf(to), phone(), false)
      if (motion.rail === 'return') return rail.returnToStation()
      if (motion.rail === 'link') return rail.chain(String(motion.to), poseOf(to), phone())
      throw new Error(`no motion ${String(motion.rail)}`)
    },
    /** where the body is: the rail's own scheduler state */
    state() {
      const nav = parts.rail().navigation
      return {
        completed: nav.completed ?? null,
        active: nav.active ?? null,
        walking: nav.active !== undefined,
        legWalked: nav.legWalked,
        legSeconds: nav.legSeconds,
        exhibit: nav.exhibit ?? null,
        approaching: nav.approaching ?? null,
        wall: nav.wall ?? null,
      }
    },
    /** at the top of every draw, after the wing's own update wrote the clock */
    beforeDraw(): void {
      const nav = parts.rail().navigation
      if (arriving) {
        if (nav.active !== undefined) left = true
        else if (left) { const to = arriving; arriving = null; hook.place(to) }
      }
      windClock.value = pinnedWind(parts.rail().navigation)
    },
  }
  ;(window as Window & { __naFilm?: unknown }).__naFilm = hook
  // the seam's live side: the forge reads the live picture through the calls the chrome makes of the film
  void import('../picture/live').then(m => { (window as Window & { __naPicture?: unknown }).__naPicture = m.createLivePicture(hook, parts.walk) })
}
