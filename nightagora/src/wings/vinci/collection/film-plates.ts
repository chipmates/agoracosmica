/** THE FILM'S PLATES. The film is rendered offline, so no live texture budget
 * holds a full plate down and no one slot is shared: every plate is shown at
 * its full raster wherever its preview would show coarse. The rule is a pure
 * function of where the eye stands, so a frame is one picture whichever clip
 * reaches it; the plate's decoded raster is held for the whole run and put on
 * the GPU in the very frame that needs it, and taken off where none does.
 * The picture key reads this module (`forge/film/scene.mjs`). */

/** The most of a delivered pixel one texel of a preview may take before the
 * full raster is shown: half, for the frame's corners and a slanted wall. */
export const FILM_PREVIEW_CAP = 0.5
/** The film's narrowest lens, vertical, over every clip of both framings. */
export const FILM_NARROWEST_LENS_DEG = 34
/** Works the film shows at their preview wherever the eye stands. The mural's
 * scan is covered in flaking: its full raster, filtered down to the sizes the
 * film draws it at, reads paler and grainy where the preview reads clean. */
export const FILM_PREVIEW_HELD: ReadonlySet<string> = new Set(['last-supper'])

/** Metres of wall one preview texel spans on a card: the coarser axis. */
export function previewPitch(widthM: number, heightM: number, texelsWide: number, texelsHigh: number): number {
  return Math.max(widthM / texelsWide, heightM / texelsHigh)
}

/** How near the eye a card needs its full raster: where one texel of its
 * preview, seen face on through the film's narrowest lens on a stage
 * `stageHeightPx` pixels tall, would take more than the cap of a pixel. */
export function filmReachMetres(pitchM: number, stageHeightPx: number): number {
  const pixelPerMetre = (2 * Math.tan((FILM_NARROWEST_LENS_DEG * Math.PI) / 360)) / stageHeightPx
  return pitchM / (pixelPerMetre * FILM_PREVIEW_CAP)
}

type V3 = readonly [number, number, number]
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

/** The distance from the eye to the nearest point of a card's face (centre,
 * unit axes along its width and height, half extents), or null when the eye
 * stands behind it. */
export function cardDistance(eye: V3, centre: V3, right: V3, up: V3, halfW: number, halfH: number): number | null {
  const d: V3 = [eye[0] - centre[0], eye[1] - centre[1], eye[2] - centre[2]]
  const normal: V3 = [right[1] * up[2] - right[2] * up[1], right[2] * up[0] - right[0] * up[2], right[0] * up[1] - right[1] * up[0]]
  const off = dot(d, normal)
  if (off <= 0) return null
  const s = Math.max(-halfW, Math.min(halfW, dot(d, right))), t = Math.max(-halfH, Math.min(halfH, dot(d, up)))
  return Math.hypot(dot(d, right) - s, dot(d, up) - t, off)
}
