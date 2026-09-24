/* THE BOX THE ISLAND FITS ITS MACHINE IN, shared with the filmed cycle so a
   recording made in one window lands on the same machine in another: the
   viewport less the caption's foot, and on the phone the glass down to the
   card's peek less the caption's four-row box. */
import type { VitrinePayloadHost, VitrineRect } from './types'

/** four rows of the longest German step with their padding */
export const CAPTION_BOX = 104

export function islandFit(host: VitrinePayloadHost): VitrineRect {
  const rect = host.narrow ? host.element.getBoundingClientRect() : host.viewport()
  const foot = host.narrow ? CAPTION_BOX : host.banded ? 52 : 118
  return { left: rect.left, top: rect.top, width: rect.width, height: Math.max(80, rect.height - foot) }
}
