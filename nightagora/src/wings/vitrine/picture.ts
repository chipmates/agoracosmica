/** THE PLATE AS A DOM PAYLOAD over the paused frame.
 *
 * The seam a deep viewer will use: once the eye stands, the loop holds its
 * last frame and the plate's own reproduction stands in the work's own
 * rectangle, or contained in the viewport where the eye did not walk. The
 * file is the one the room already streams, so it comes from the cache, and
 * it is shown through the same display window the room's plate is cut to.
 */
import type { VitrinePayload, VitrinePayloadHost, VitrineRect } from './types'

/** Frames the room draws at the standing eye before it is held, so the frame
 * that stays on the canvas is the arrival and not the last stride. */
const SETTLE_FRAMES = 2

/** The share of the source the room shows, from its top left. */
export interface PlateWindow { left: number; top: number; right: number; bottom: number }

export function createPlatePayload(options: {
  src: string
  /** The work's own name, the viewport's accessible name. */
  title: string
  /** The source's own width over its height. */
  aspect: number
  window: PlateWindow | null
  /** True once the eye stands where it will stand for this exhibit. */
  standing(): boolean
}): VitrinePayload {
  let host: VitrinePayloadHost | undefined
  let frame: HTMLDivElement | undefined, image: HTMLImageElement | undefined
  let settled = 0, held = false
  const cut = options.window ?? { left: 0, top: 0, right: 1, bottom: 1 }
  const shownAspect = options.aspect * (cut.right - cut.left) / (cut.bottom - cut.top)

  /** The shown part of the source, contained whole in a rectangle. */
  function contain(rect: VitrineRect): VitrineRect {
    const width = Math.min(rect.width, rect.height * shownAspect)
    const height = width / shownAspect
    return { left: rect.left + (rect.width - width) / 2, top: rect.top + (rect.height - height) / 2, width, height }
  }

  function hold(): void {
    if (!host || !frame || !image) return
    const rect = host.work() ?? contain(host.viewport())
    frame.style.left = `${rect.left}px`
    frame.style.top = `${rect.top}px`
    frame.style.width = `${rect.width}px`
    frame.style.height = `${rect.height}px`
    // The whole source, scaled so its display window fills the frame.
    const width = rect.width / (cut.right - cut.left), height = rect.height / (cut.bottom - cut.top)
    image.style.width = `${width}px`
    image.style.height = `${height}px`
    image.style.left = `${-cut.left * width}px`
    image.style.top = `${-cut.top * height}px`
    frame.hidden = false
    host.surface('hold')
    held = true
  }

  return {
    kind: 'picture',
    mount(next) {
      host = next
      const document = next.element.ownerDocument
      frame = document.createElement('div')
      frame.className = 'vitrine-plate'
      frame.hidden = true
      image = document.createElement('img')
      image.alt = ''
      image.decoding = 'async'
      image.src = options.src
      frame.append(image)
      next.element.append(frame)
      next.describe(options.title)
      next.surface('room')
      settled = 0; held = false
    },
    update() {
      if (!host || held) return
      if (!options.standing()) { settled = 0; return }
      if (++settled > SETTLE_FRAMES) hold()
    },
    layout() {
      if (!host || !held) return
      // A resized stage is a new frame: the room draws it before it holds.
      held = false; settled = 0
      if (frame) frame.hidden = true
      host.surface('room')
    },
    unmount() {
      frame?.remove()
      frame = undefined; image = undefined; host = undefined
      held = false
    },
  }
}
