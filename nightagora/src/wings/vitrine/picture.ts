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
  /** The file the room already streams. */
  src?: string
  /** Or the pixels the room already decoded: drawn at the size the frame
   * shows them, so no second full-size copy is decoded. */
  pixels?: () => CanvasImageSource & { width: number; height: number } | null
  /** The work's own name, the viewport's accessible name where nobody has
   * written what is on the plate. */
  title: string
  /** What is on the plate, in words, for a visitor who cannot see it. */
  description?: string | null
  /** The source's own width over its height. */
  aspect: number
  window: PlateWindow | null
  /** True once the eye stands where it will stand for this exhibit. */
  standing(): boolean
  /** The work takes the narrow stage's whole glass, its card folded under it. */
  fill?: boolean
}): VitrinePayload {
  let host: VitrinePayloadHost | undefined
  let frame: HTMLDivElement | undefined, image: HTMLImageElement | HTMLCanvasElement | undefined
  let settled = 0, held = false
  const cut = options.window ?? { left: 0, top: 0, right: 1, bottom: 1 }
  const shownAspect = options.aspect * (cut.right - cut.left) / (cut.bottom - cut.top)

  /** The shown part of the source, contained whole in a rectangle. */
  function contain(rect: VitrineRect): VitrineRect {
    const width = Math.min(rect.width, rect.height * shownAspect)
    const height = width / shownAspect
    return { left: rect.left + (rect.width - width) / 2, top: rect.top + (rect.height - height) / 2, width, height }
  }

  /** Where the plate may stand: the viewport, or, where the work fills the
   * glass, the part of it the folded card leaves free. */
  function room(): VitrineRect {
    if (!host || !options.fill || !host.narrow) return host!.viewport()
    const box = host.element.getBoundingClientRect()
    return box.width > 0 && box.height > 0 ? { left: box.left, top: box.top, width: box.width, height: box.height } : host.viewport()
  }

  function hold(): void {
    if (!host || !frame || !image) return
    const rect = host.work() ?? contain(room())
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
    const pixels = image instanceof HTMLCanvasElement ? options.pixels?.() : null
    if (pixels && image instanceof HTMLCanvasElement) {
      const scale = Math.min(devicePixelRatio, pixels.width / width)
      image.width = Math.max(1, Math.round(width * scale))
      image.height = Math.max(1, Math.round(height * scale))
      image.getContext('2d')?.drawImage(pixels, 0, 0, image.width, image.height)
    }
    frame.hidden = false
    host.surface('hold')
    held = true
  }

  return {
    kind: 'picture',
    fill: options.fill,
    mount(next) {
      host = next
      const document = next.element.ownerDocument
      frame = document.createElement('div')
      frame.className = 'vitrine-plate'
      frame.hidden = true
      if (options.src) {
        const img = document.createElement('img')
        img.alt = ''
        img.decoding = 'async'
        img.src = options.src
        image = img
      } else {
        image = document.createElement('canvas')
        image.setAttribute('aria-hidden', 'true')
      }
      frame.append(image)
      next.element.append(frame)
      next.describe(options.description ?? options.title)
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
