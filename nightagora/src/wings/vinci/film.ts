/* THE FILM'S HAND ON THE RAIL — loaded only when `?export=1` asks for it.

   The export walks the film graph's clips (`forge/film/graph.mjs`) on the live
   rail with the very calls a visitor's press makes, which `replay.mjs` makes in
   node, and stands the eye on a node at once, the way a cut does. The poses
   are the wing's own, computed here, never numbers carried in from node: the
   certificate matches what this page computes. */

import type { VinciStationId } from './content'
import type { createRail, Pose } from './rail'
import type { VinciWalk, VinciWalkStop } from './walk'

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
  }
  ;(window as Window & { __naFilm?: unknown }).__naFilm = hook
}
