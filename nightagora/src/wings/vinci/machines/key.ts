/** WHERE THE KEY STANDS, for the surfaces that have to answer to it.
 *
 * A forged bar eight millimetres thick is a line at a visitor's distance, and
 * a line the light cannot find an edge on is a scratch in the dark. The
 * materials that give an edge its rim need the key's own direction, and the
 * key is the bench's: the hour is installed by the host, not decided by a
 * material. The host hands the light's own direction over here after it
 * installs it, so nothing under `machines/` has to reach into the wing's
 * content for an hour, and a material built with no bench standing (the CPU
 * audit builds them that way) simply gets no rim.
 */

export interface KeyDirection { x: number; y: number; z: number }

let installed: KeyDirection | null = null

/** the host's own key, as the direction the light points from */
export function setBenchKey(direction: KeyDirection | null): void {
  installed = direction ? { x: direction.x, y: direction.y, z: direction.z } : null
}

export function benchKeyDirection(): KeyDirection | null {
  return installed
}
