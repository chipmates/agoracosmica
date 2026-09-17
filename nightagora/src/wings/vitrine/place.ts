/** A PLACE AS A PAYLOAD: a slab, a standing frame, a plaque.
 *
 * What a visitor reads at a place is cut into its own stones, so the viewport
 * holds nothing of its own: once the eye stands the loop holds its last frame,
 * the room dims around the object's own rectangle where the eye walked to it,
 * and the card carries the reading. */
import type { VitrinePayload, VitrinePayloadHost } from './types'

/** Frames the room draws at the standing eye before it is held. */
const SETTLE_FRAMES = 2

export function createPlacePayload(options: {
  /** The place's own name, the viewport's accessible name. */
  title: string
  /** True once the eye stands where it will stand for this exhibit. */
  standing(): boolean
}): VitrinePayload {
  let host: VitrinePayloadHost | undefined
  let settled = 0, held = false
  return {
    kind: 'place',
    mount(next) {
      host = next
      next.describe(options.title)
      next.surface('room')
      settled = 0; held = false
    },
    update() {
      if (!host || held) return
      if (!options.standing()) { settled = 0; return }
      if (++settled <= SETTLE_FRAMES) return
      host.surface('hold')
      held = true
    },
    layout() {
      if (!host || !held) return
      // A resized stage is a new frame: the room draws it before it holds.
      held = false; settled = 0
      host.surface('room')
    },
    unmount() {
      host = undefined
      held = false
    },
  }
}
