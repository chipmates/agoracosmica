/** WHERE THE GRAVE'S THREE EXHIBITS STAND IN THE GRAVE'S OWN FRAME, in metres:
 * the slab, the framed diagram of the light and the painting on the backdrop.
 * The factory builds from these and the viewing poses are composed from them,
 * so neither can move without the other. Frame-space +Z faces the visitor. */
export const GRAVE_SLAB = { x: -0.95, y: 0.24, z: 0.65, width: 1.98, length: 3.55 } as const
export const GRAVE_FRAME = { x: 1.20, y: 2.46, z: -1.34, width: 3.13, height: 2.55 } as const
/** The reproduction is 40 by 50.5 cm. It hangs here at 1.9 m across, and the
 * wall says so. */
export const GRAVE_DEATHBED = {
  width: 1.9, height: 1.9 * 3252 / 4096, imageWidth: 4096, imageHeight: 3252,
  originalWidth: 0.505, originalHeight: 0.4,
  centreX: -0.42, centreY: 2.62, faceZ: -5.39,
} as const
