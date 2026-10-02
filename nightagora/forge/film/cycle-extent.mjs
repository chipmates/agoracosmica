// THE MACHINE'S EXTENT IN ITS OWN FILMED FRAME: the union, over the run, of
// the pixels its bodies cover, read off the export's id pass (every mesh
// drawn in its own index, no backdrop, no fog, no shadow). The machine is
// every body under the island's table; the floor it stands on and the shadow
// it throws are not the machine and may be cut, its body, its moving parts
// and its travel never. The player fits this box, not the island's fitting
// box, into the glass (`src/wings/picture/cycle.ts`, fit).
//
// Nothing here draws a frame of the recording: the island is posed by its
// clock exactly as the recorder poses it, drawn once without jitter, and only
// the ids are read. So an extent can be measured for cycle files already made,
// and measuring it moves no cycle key.

/** what the extent is and how it was read: a release names it beside the box */
export const EXTENT_HOW = 'silhouette: the union over the run of the id pass pixels of the bodies under the island\'s table'
/** the island's table: every body under it is the machine (`turntable.ts`, stand) */
export const MACHINE_ROOT = 'vitrine/turntable'
/** the id pass at the frame's own device pixels: a thin rod still counts */
export const EXTENT_DIV = 1
/** every frame of a run up to this many; a longer run by an even stride, every step's frame and the last kept */
export const EXTENT_SAMPLES = 720

/** the indices (from one, as the export arms them) of the bodies under the table */
export function machineIds(bodies) {
  const ids = new Set()
  bodies.forEach((path, k) => { if (path === MACHINE_ROOT || path.startsWith(`${MACHINE_ROOT}/`)) ids.add(k + 1) })
  return ids
}

/** the box the wanted ids cover in an id plane, [x0, y0, x1, y1] with the far edges exclusive, or null */
export function idBox(ids, w, h, wanted) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1
  for (let y = 0, i = 0; y < h; y++) {
    for (let x = 0; x < w; x++, i++) {
      if (!wanted.has(ids[i])) continue
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      y1 = y
    }
  }
  return x1 < 0 ? null : [x0, y0, x1 + 1, y1 + 1]
}

export const unite = (a, b) => (!a ? b : !b ? a : [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])])

/** the frames sampled: all of them, or an even stride that keeps every step's frame and the last */
export function sampleFrames(frames, steps = [], most = EXTENT_SAMPLES) {
  const stride = Math.max(1, Math.ceil(frames / most))
  const out = new Set()
  for (let i = 0; i < frames; i += stride) out.add(i)
  for (const f of steps) if (f >= 0 && f < frames) out.add(f)
  if (frames > 0) out.add(frames - 1)
  return { stride, frames: [...out].sort((a, b) => a - b) }
}

/** an id-plane box in the frame's CSS pixels, widened out to the half pixel */
export function toCss(box, div, dpr) {
  const k = div / dpr
  const down = (v) => Math.floor(v * k * 2) / 2, up = (v) => Math.ceil(v * k * 2) / 2
  return [down(box[0]), down(box[1]), up(box[2]), up(box[3])]
}

/**
 * THE RECORD: the union in CSS pixels, the frame each side of it is reached
 * at, the frame whose own box is widest across, how many frames were read.
 *   boxes   Map(frame -> id-plane box or null)
 *   size    the id plane [w, h]; div, dpr as the frame was drawn
 */
export function extentRecord(boxes, { size, div, dpr, stride }) {
  let union = null, widest = null
  const reach = { left: null, top: null, right: null, bottom: null }
  let empty = 0
  for (const [frame, box] of boxes) {
    if (!box) { empty++; continue }
    if (!union || box[0] < union[0]) reach.left = frame
    if (!union || box[1] < union[1]) reach.top = frame
    if (!union || box[2] > union[2]) reach.right = frame
    if (!union || box[3] > union[3]) reach.bottom = frame
    union = unite(union, box)
    if (!widest || box[2] - box[0] > widest.across) widest = { frame, across: box[2] - box[0] }
  }
  if (!union) throw new Error('no frame of the run shows a body under the island\'s table')
  const edges = [union[0] <= 0 && 'left', union[1] <= 0 && 'top', union[2] >= size[0] && 'right', union[3] >= size[1] && 'bottom'].filter(Boolean)
  return {
    box: toCss(union, div, dpr),
    widest: widest.frame,
    reach,
    samples: boxes.size,
    stride,
    how: EXTENT_HOW,
    // a machine whose run leaves the recorded frame is cut by the frame itself: the record says where
    ...(edges.length ? { frameEdges: edges } : {}),
    ...(empty ? { emptyFrames: empty } : {}),
  }
}

/**
 * Measure a framing's extent in a page where the island stands framed, the
 * export is open at EXTENT_DIV and armed, and `next(tag, i)` hands back each
 * sent frame's { head, parts }. The clock and the poses are the recorder's;
 * `canvas` is the drawn canvas in device pixels, `start` the harness clock.
 */
export async function measureExtent(page, next, { tag, frames, steps, fps, dpr, canvas, start, log = () => {} }) {
  const bodies = await page.evaluate(() => window.__naExport.bodies())
  const wanted = machineIds(bodies)
  if (!wanted.size) throw new Error(`no body under ${MACHINE_ROOT} among ${bodies.length}`)
  const { stride, frames: chosen } = sampleFrames(frames, steps)
  const boxes = new Map()
  let t = start, size = null
  const t0 = Date.now()
  for (const [k, i] of chosen.entries()) {
    await page.evaluate((c) => window.__naIsland.pose(c, { playing: false, lit: false }), i / fps)
    t += 1000 / fps
    const wait = next(tag, i)
    await page.evaluate((p) => window.__naExport.frame(p), { tag, i, times: [t], jitter: [[0, 0]], anchor: 0, ids: true, send: true, grain: 0, seed: 0 })
    const { head, parts } = await wait
    const [w, h] = head.idSize
    if (!w || !h) throw new Error(`frame ${i} came without its ids`)
    size = [w, h]
    const raw = parts[2]
    boxes.set(i, idBox(new Uint32Array(raw.buffer, raw.byteOffset, raw.byteLength >> 2), w, h, wanted))
    if (k % 120 === 119) log(`extent: ${k + 1}/${chosen.length} frames, ${((Date.now() - t0) / (k + 1) / 1000).toFixed(2)} s a frame`)
  }
  // device pixels per id pixel, from the canvas the frame was drawn on
  const div = canvas[0] / size[0]
  if (!Number.isInteger(div) || canvas[1] / size[1] !== div) throw new Error(`the id plane ${size.join('x')} does not divide the canvas ${canvas.join('x')}`)
  return { record: extentRecord(boxes, { size, div, dpr, stride }), boxes, size, div, bodies: wanted.size, end: t }
}
