// THE VIRTUAL CLOCK, installed in the page before any module of the app runs.
//
// The rail's leg reads wall time: the wing is handed `() => performance.now()
// / 1000` as its clock, and the leg integrates it (`rail.ts`, legClock). So a
// capture paced by a screenshot loop, which takes half a second a frame, would
// walk the leg in fourteen pictures. Freezing the clock from the first byte is
// worse: the wing's build loop time-slices itself against `performance.now()`
// and would never yield.
//
// The answer is two states. The page loads and the wing stands on the REAL
// clock; then `arm()` switches `performance.now` to a counter the harness
// advances, and takes the animation frame queue with it, so exactly one app
// frame is drawn per step and every clock the app reads sees 1/30 s pass.
// Nothing of this lives in the app: it is one init script of this harness.

/** Runs in the page, before the app. Leaves the page on the real clock. */
export function installVirtualClock() {
  const realNow = performance.now.bind(performance)
  const rawRAF = window.requestAnimationFrame.bind(window)
  const rawCAF = window.cancelAnimationFrame.bind(window)
  const s = { virtual: false, gated: false, t: 0, dt: 1000 / 30, seq: 1, frames: 0, starved: 0, queue: [] }
  const now = () => (s.virtual ? s.t : realNow())
  Object.defineProperty(performance, 'now', { value: now, configurable: true, writable: true })
  window.requestAnimationFrame = (cb) => {
    if (!s.gated) return rawRAF(() => cb(now()))
    const id = s.seq++
    s.queue.push({ id, cb })
    return id
  }
  window.cancelAnimationFrame = (id) => {
    const at = s.queue.findIndex((q) => q.id === id)
    if (at >= 0) s.queue.splice(at, 1)
    else rawCAF(id)
  }
  window.__pre = {
    /** take the clock and the frame queue; from here the page draws only on step() */
    arm(fps) {
      s.dt = 1000 / fps
      s.t = realNow()
      s.virtual = true
      s.gated = true
      s.frames = 0
    },
    /** one app frame, exactly 1/30 s of the app's own time later */
    step() {
      return window.__pre.advance(s.dt)
    },
    /** one app frame, `ms` of the app's own time later: a shutter's draws
        are steps of their own spacing, and a zero step lets the rail take a
        request at the instant it was asked */
    advance(ms) {
      return window.__pre.at(s.t + ms)
    },
    /** one app frame at an app time named outright, so a long run of short
        steps carries no rounding of its own into the walk */
    at(t) {
      s.t = t
      const due = s.queue.splice(0, s.queue.length)
      if (!due.length) s.starved++
      for (const q of due) {
        try {
          q.cb(s.t)
        } catch (err) {
          console.error('frame threw', err)
        }
      }
      s.frames++
      return { frames: s.frames, t: s.t, queued: s.queue.length }
    },
    /** a real animation frame, for waiting on the compositor while gated */
    raw() {
      return new Promise((r) => rawRAF(() => r(true)))
    },
    queued: () => s.queue.length,
    virtualTime: () => s.t,
    frames: () => s.frames,
    /** a step that found no callback waiting: a frame the app never drew */
    starved: () => s.starved,
  }
}

/** The page's own chrome, hidden without moving a single box: the wing fits
    its compositions around the card and the bar, and a display change would
    reframe the picture this test is about. */
export const CHROME_OFF =
  'html.na-bare body *{visibility:hidden!important}html.na-bare canvas{visibility:visible!important}'
/** the class the rule above hangs on, so bare and dressed is one toggle */
export const BARE = 'na-bare'
/* THE PICTURE IS THE WHOLE AUTHORED FRAME. The desktop's stage step stands a
   band under the picture and shortens the canvas; the band is chrome, so a
   still and a clip ask for every desktop step but that one. */
export const STILL_DESK = 'none,type14,words,ways,freearea,drawer,closelook,panel,marks,overview,sheet,opening'
