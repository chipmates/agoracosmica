// WHAT IS STILL IN FLIGHT, and how long it is worth waiting for it.
//
// A frame shot over a library set that has not arrived is a frame drawn on a
// surface that is not dressed yet, so every rig here waits for the count to
// come to rest before it keeps a frame.
//
// The wait is for a RESTING count, zero included, so a stop is stood at for
// the same seconds whatever the count reads: what the count does not see (a
// room dressed in slices, a pipeline compiled on first sight) finishes inside
// them too. A count that rests above zero is something still out, so the
// number is handed back and every instrument records it beside its frames.

/** Resolves with the resting count, or the last one read at the cap. */
export async function restingPending(page, ms = 60000, still = 6, step = 500) {
  let last = -1
  let same = 0
  for (let waited = 0; waited < ms; waited += step) {
    const now = await page.evaluate(() => window.__forge.state().texturesPending)
    same = now === last ? same + 1 : 0
    last = now
    if (same >= still) return now
    await page.waitForTimeout(step)
  }
  return last
}
