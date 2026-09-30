/** THE PLATE'S OWN GROUND OVER A SCAN'S SHOULDERS.
 *
 * The room covers the white a cut-out scan leaves outside a round top with
 * its arch mats (arch-mask.ts); the plate on the glass shows the same scan,
 * so it takes the same traced edge and fills what lies outside it with its
 * own ground. Read only: the recipes and the room's mats stay as they are.
 */
import { pictureArchMask, type ArchMaskSource } from './arch-mask'

/** How far the plate's ground reaches past the traced edge into the painting,
 * in the evidence raster's pixels (a preview's: under half a centimetre of
 * the Louvre panel). Less leaves the soft rim of the scan as a grey line. */
export const PLATE_INSET_PX = 2.5
/** How far it reaches past the source's own top and sides: a drawer lays a
 * tile a pixel wider than its box, so the scan's white would edge the ground. */
const PLATE_BLEED_PX = 2
/** Within this many pixels of the raster's side the trace is a flat cap
 * while the scan's edge still runs down that column; there the ground runs
 * on as a straight line from the last sample outside it. */
const PLATE_SIDE_PX = 4

/** One closed outline in fractions of the whole source, top-left origin; it
 * may reach a little past 0 and 1, where a drawing clips it to its own box. */
export type PlateGround = readonly (readonly [number, number])[]

/** The outline outside the arch, or null. Only a recipe traced on the whole
 * raster qualifies: that scan is cut to the work, so its shoulders are the
 * scan's ground. A recipe traced inside a photograph's window keeps its
 * photographed surround (a frame), which the plate shows as evidence. */
export function plateArchGround(source: ArchMaskSource): PlateGround | null {
  const recipe = pictureArchMask(source)
  if (!recipe) return null
  const { width, height } = recipe.evidence
  const [x0, y0, x1, y1] = recipe.defaultWindowPx
  if (x0 !== 0 || y0 !== 0 || x1 !== width || y1 !== height) return null
  // The traced edge moved a little into the painting along its normal, not
  // out by the room's retained fringe: a resampled scan blends the white it
  // still holds into the edge's own pixels, which reads as a light line.
  const edge = recipe.boundaryPx, last = edge.length - 1
  const inset = edge.map(([x, y], i) => {
    const [ax, ay] = edge[Math.max(0, i - 1)]!, [bx, by] = edge[Math.min(last, i + 1)]!
    const length = Math.hypot(bx - ax, by - ay) || 1
    // the edge runs left to right with the painting below it: the normal (-ty, tx) points in
    const nx = -(by - ay) / length, ny = (bx - ax) / length
    return [Math.min(width, Math.max(0, x + nx * PLATE_INSET_PX)), y + ny * PLATE_INSET_PX] as const
  })
  const left = Math.max(0, edge.findIndex(([x]) => x >= PLATE_SIDE_PX))
  let right = last
  while (right > left + 1 && edge[right]![0] > width - PLATE_SIDE_PX) right--
  const capL = edge[1]![1] === edge[0]![1] ? 1 : 0, capR = edge[last - 1]![1] === edge[last]![1] ? last - 1 : last
  const out = PLATE_BLEED_PX
  const run = (i: number, cap: number, x: number): readonly [number, number] => {
    // toward the cap's own sample, moved in by the inset like every other
    const slope = (edge[cap]![1] + PLATE_INSET_PX - edge[i]![1]) / ((edge[cap]![0] - edge[i]![0]) || 1)
    return [x, inset[i]![1] + (x - inset[i]![0]) * slope]
  }
  return [[-out, -out], run(left, capL, -out), ...inset.slice(left, right + 1), run(right, capR, width + out), [width + out, -out]]
    .map(([x, y]) => [x / width, y / height] as const)
}
