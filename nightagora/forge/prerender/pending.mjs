// WHAT IS STILL IN FLIGHT, and how long it is worth waiting for it.
//
// A frame shot over a library set that has not arrived is a frame drawn on a
// surface that is not dressed yet, so every rig here waits for the count to
// come to rest before it keeps a frame.
//
// It does not always come to rest at ZERO. A set whose fetch is aborted stays
// neither ready nor missing, and the count then holds at one for the life of
// the page: a rig that waits for zero waits forever. So the wait is for a
// RESTING count, the number is handed back, and every instrument records it
// beside its frames instead of tuning it away.

/** Resolves with the resting count, or the last one read at the cap. */
export async function restingPending(page, ms = 60000, still = 6, step = 500) {
  let last = -1
  let same = 0
  for (let waited = 0; waited < ms; waited += step) {
    const now = await page.evaluate(() => window.__forge.state().texturesPending)
    if (now === 0) return 0
    same = now === last ? same + 1 : 0
    last = now
    if (same >= still) return now
    await page.waitForTimeout(step)
  }
  return last
}
