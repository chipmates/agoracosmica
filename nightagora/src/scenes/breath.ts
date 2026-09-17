/* THE BREATH — the one cut between the lobby and a wing. A full-frame
   heartbeat of gold with its own source and falloff, and then a HARD
   CUT: the wing is simply there. A fade would leave the lobby's ink
   standing over the first station for a second and a half, which reads
   as a dissolve nobody chose.

   The glory is drawn rather than gradiented: a bare radial ramp is the
   one mark on this page no hand made. Fine light and dark rays cut from
   the heart, a highlight along the incised line, and the same paper
   tooth the rest of the night is printed on. */

import { FOUNDING_SEED, mulberry32 } from '../core/seed'
import { LOBBY_TEXT } from '../content/lobby'
import { say } from '../wings/content'
import type { WingProgress, WingStage } from '../wings/frame'

/** a stable hand per stroke. It reads from the stroke's index instead of
    the scene's seeded sequence, so adding the bow moved no other mark. */
function wobble(i: number, salt: number): number {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453
  return x - Math.floor(x) - 0.5
}

/** A BURIN CUT IS NOT A RULED LINE. Every stroke bows off its own chord,
    by its own amount and to its own side, which is the difference between
    an engraved mark and a scratched hairline. */
function cut(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  bow: number
): void {
  const dx = x1 - x0
  const dy = y1 - y0
  const len = Math.hypot(dx, dy) || 1
  ctx.beginPath()
  ctx.moveTo(x0, y0)
  ctx.quadraticCurveTo(
    (x0 + x1) / 2 - (dy / len) * bow,
    (y0 + y1) / 2 + (dx / len) * bow,
    x1,
    y1
  )
  ctx.stroke()
}

/** the shortest the gold ever holds the frame: its own beat */
const HOLD_MS = 640
/** THE FIELD IS NOT A LOCK. A wing that never reports itself standing is a
    fault in that wing, and the visitor may not be left at a gold screen for
    it: past this the field lifts anyway, onto whatever is there. */
const CAP_MS = 60000

export interface BreathHandles {
  /** Light the gold and start the work under it. The cut waits for the beat
      AND for the work: a wing that is not standing yet would otherwise hand
      the visitor a raw stage, which is what a loading screen is for. */
  begin(onCut: () => void | PromiseLike<unknown>): void
  /** THE FIELD WITHOUT THE BREATH, for the deep link: there is no lobby to
      breathe out of, so the gold is simply there from the first paint, and
      it holds until the work is done. */
  hold(work: PromiseLike<unknown>): void
  /** What the wing under the field reports about its own building: the dark
      ink on the rule, and the one line under it naming the stage. A field
      that is never told keeps the indeterminate state. */
  progress(reading: WingProgress): void
  /** the rig's frozen moment: the gold at full, no cut scheduled */
  forgeStage(): void
  /** strike it with no transition at all */
  stop(): void
  active(): boolean
}

export function createBreath(): BreathHandles {
  const node = document.getElementById('goldbreath')
  if (!node) throw new Error('missing breath shell')
  const el: HTMLElement = node

  const rule = el.querySelector<HTMLElement>('.dark-line')
  const measure = el.querySelector<HTMLElement>('.field-measure')
  const stageWord = el.querySelector<HTMLElement>('.field-stage')
  /** the aria-hidden the shell carries while the field is dark: a progress
      bar that is not running has nothing to say to a screen reader */
  const shellHidden = el.getAttribute('aria-hidden')
  const STAGE_WORDS: Record<WingStage, { en: string; de: string }> = {
    house: LOBBY_TEXT.entryHouse,
    exhibits: LOBBY_TEXT.entryExhibits,
    walk: LOBBY_TEXT.entryWalk,
  }
  let stageSaid: WingStage | 'none' | '' = ''
  let shareSaid: number | null = -1
  let paintedAt = 0
  const glory = document.createElement('canvas')
  glory.setAttribute('aria-hidden', 'true')
  glory.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none'
  el.insertBefore(glory, el.firstChild)
  let gloryW = 0
  let gloryH = 0
  let timer = 0
  let running = false
  /* A hold that was struck while it waited may not strike the NEXT one. The
     token is what a finished wait compares itself against. */
  let waiting: object | null = null

  /** the incised rule as a measure: the dark ink opens from the middle of the
      field to both ends as the wait is paid off, and stands full at the cut.
      A null share is a wing that cannot count yet, and the rule says so by
      travelling instead of standing at a number it has not earned. */
  function line(share: number | null): void {
    const held = share === null ? 0 : Math.max(0, Math.min(1, share))
    if (rule) rule.style.transform = `scaleX(${held})`
    el.dataset['measure'] = share === null ? 'indeterminate' : 'counted'
    // ARIA has one way to say working-with-no-number: no aria-valuenow at all
    if (share === null) measure?.removeAttribute('aria-valuenow')
    else measure?.setAttribute('aria-valuenow', held.toFixed(3))
  }

  /** the stage's own sentence, written at most once per stage */
  function word(stage: WingStage | 'none'): void {
    if (stage === stageSaid) return
    stageSaid = stage
    const said = say(stage === 'none' ? LOBBY_TEXT.entryOpening : STAGE_WORDS[stage])
    if (stageWord) stageWord.textContent = said
    measure?.setAttribute('aria-valuetext', said)
  }

  function paint(): void {
    const w = Math.max(1, innerWidth)
    const h = Math.max(1, innerHeight)
    if (w === gloryW && h === gloryH) return
    gloryW = w
    gloryH = h
    const dpr = Math.min(devicePixelRatio || 1, 2)
    glory.width = Math.round(w * dpr)
    glory.height = Math.round(h * dpr)
    const ctx = glory.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    const cx = w * 0.5
    const cy = h * 0.46
    const reach = Math.hypot(w, h)
    const g = mulberry32(FOUNDING_SEED + 91)
    // the heart first: a dense corona of very fine cuts, so the middle
    // of the light is engraved and not a smooth blend
    for (let i = 0; i < 96; i++) {
      const a = (i / 96) * Math.PI * 2 + (g() - 0.5) * 0.05
      const r0 = reach * (0.035 + g() * 0.03)
      const r1 = r0 + reach * (0.04 + g() * 0.1)
      ctx.strokeStyle = `rgba(255, 248, 228, ${(0.03 + g() * 0.06).toFixed(3)})`
      ctx.lineWidth = 0.8 + g() * 1.2
      cut(
        ctx,
        cx + Math.cos(a) * r0,
        cy + Math.sin(a) * r0,
        cx + Math.cos(a) * r1,
        cy + Math.sin(a) * r1,
        wobble(i, 1) * (r1 - r0) * 0.13
      )
    }
    // the rays: light and dark, hand-jittered, deliberately uneven, and
    // each one bowed off its own chord. An even fan of equal straight rays
    // is a vector sunburst, not a glory cut by a hand. Some run to the
    // edge, some barely leave the heart.
    const RAYS = 116
    for (let i = 0; i < RAYS; i++) {
      const a = (i / RAYS) * Math.PI * 2 + (g() - 0.5) * 0.1
      const lightRay = g() > 0.42
      const r0 = reach * (0.04 + g() * 0.14)
      // the dark cuts stay near the heart and build tone; the light ones
      // are the only marks allowed to run all the way out
      const r1 = lightRay
        ? r0 + reach * (0.16 + Math.pow(g(), 1.5) * 0.9)
        : r0 + reach * (0.07 + g() * g() * 0.4)
      const grad = ctx.createLinearGradient(
        cx + Math.cos(a) * r0,
        cy + Math.sin(a) * r0,
        cx + Math.cos(a) * r1,
        cy + Math.sin(a) * r1
      )
      const tint = lightRay ? '255, 246, 222' : '68, 36, 6'
      const peak = (lightRay ? 0.05 + g() * 0.1 : 0.05 + g() * 0.09) * (0.35 + g())
      grad.addColorStop(0, `rgba(${tint}, 0)`)
      grad.addColorStop(0.12 + g() * 0.16, `rgba(${tint}, ${peak.toFixed(3)})`)
      grad.addColorStop(1, `rgba(${tint}, 0)`)
      ctx.strokeStyle = grad
      ctx.lineWidth = lightRay ? 0.8 + g() * 2.6 : 0.8 + g() * 2.8
      cut(
        ctx,
        cx + Math.cos(a) * r0,
        cy + Math.sin(a) * r0,
        cx + Math.cos(a) * r1,
        cy + Math.sin(a) * r1,
        wobble(i, 2) * (r1 - r0) * 0.075
      )
    }
    // two ruled circles around the light: one language, cut twice
    for (const ring of [0.22, 0.46]) {
      const rr = reach * ring
      for (let i = 0; i < 40; i++) {
        const a = (i / 40) * Math.PI * 2 + g() * 0.03
        const half = (Math.PI / 40) * (0.3 + g() * 0.5)
        ctx.strokeStyle = `rgba(255, 246, 222, ${(0.09 + g() * 0.08).toFixed(3)})`
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(cx, cy, rr, a - half, a + half)
        ctx.stroke()
      }
    }
    // the incised rule: the shell's dark line gets the highlight that
    // makes a cut read as a cut, and a fainter echo below it
    const ruleY = h * 0.46
    const x0 = w * 0.27
    const x1 = w * 0.73
    const hi = ctx.createLinearGradient(x0, 0, x1, 0)
    hi.addColorStop(0, 'rgba(255, 248, 226, 0)')
    hi.addColorStop(0.5, 'rgba(255, 248, 226, 0.5)')
    hi.addColorStop(1, 'rgba(255, 248, 226, 0)')
    ctx.strokeStyle = hi
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x0, ruleY - 1.5)
    ctx.lineTo(x1, ruleY - 1.5)
    ctx.stroke()
    const echo = ctx.createLinearGradient(x0, 0, x1, 0)
    echo.addColorStop(0, 'rgba(74, 40, 8, 0)')
    echo.addColorStop(0.5, 'rgba(74, 40, 8, 0.3)')
    echo.addColorStop(1, 'rgba(74, 40, 8, 0)')
    ctx.strokeStyle = echo
    ctx.beginPath()
    ctx.moveTo(w * 0.33, ruleY + 5)
    ctx.lineTo(w * 0.67, ruleY + 5)
    ctx.stroke()
    // the tooth: one tile, laid over the whole sheet
    const tile = document.createElement('canvas')
    tile.width = 96
    tile.height = 96
    const tctx = tile.getContext('2d')
    if (!tctx) return
    const img = tctx.createImageData(96, 96)
    for (let i = 0; i < img.data.length; i += 4) {
      const n = g()
      const dark = n < 0.5
      img.data[i] = dark ? 60 : 255
      img.data[i + 1] = dark ? 34 : 244
      img.data[i + 2] = dark ? 6 : 214
      img.data[i + 3] = Math.floor(Math.abs(n - 0.5) * 52)
    }
    tctx.putImageData(img, 0, 0)
    const pattern = ctx.createPattern(tile, 'repeat')
    if (!pattern) return
    ctx.fillStyle = pattern
    ctx.fillRect(0, 0, w, h)
  }

  function strike(): void {
    running = false
    waiting = null
    document.body.classList.remove('entering')
    line(1)
    if (shellHidden === null) el.removeAttribute('aria-hidden')
    else el.setAttribute('aria-hidden', shellHidden)
    window.clearTimeout(timer)
    // the cut is a cut: no class may be left that can animate the gold out
    el.classList.add('cutting')
    el.classList.remove('lit')
    void el.offsetWidth
    el.classList.remove('cutting')
    glory.style.transform = 'scale(1)'
  }

  /** what both ways in share: the gold owns the frame and the page says so,
      because the masthead under it would ghost through at this opacity */
  function light(): void {
    paint()
    running = true
    document.body.classList.add('entering')
    // the field is a live region only while it is lit
    el.removeAttribute('aria-hidden')
    stageSaid = ''
    shareSaid = -1
    paintedAt = 0
    word('none')
    line(null)
    window.clearTimeout(timer)
  }

  /** hold the field until the work under it is done, then cut once */
  function holdFor(work: PromiseLike<unknown>, beat: boolean): void {
    const mine = {}
    waiting = mine
    const beats =
      beat ?
        new Promise<void>((resolve) => {
          timer = window.setTimeout(resolve, HOLD_MS)
        })
      : Promise.resolve()
    const capped = Promise.race([
      work,
      new Promise<void>((resolve) => window.setTimeout(resolve, CAP_MS)),
    ])
    void Promise.allSettled([beats, capped]).then(() => {
      if (waiting === mine) strike()
    })
  }

  return {
    begin(onCut) {
      light()
      el.classList.remove('cutting')
      el.classList.add('lit')
      // the light does not sit still while it swallows the frame
      glory.style.transform = 'scale(1.05)'
      // THE WORK STARTS UNDER THE BREATH, NOT AFTER IT. The wing used to be
      // asked for only once the gold had held its beat, so the beat was
      // added to the wait instead of spent on it.
      holdFor(Promise.resolve(onCut()), true)
    },
    hold(work) {
      light()
      // the transition is suppressed for the one frame that lights it: a
      // loading field that fades in is a second of black first
      el.classList.add('cutting')
      el.classList.add('lit')
      void el.offsetWidth
      el.classList.remove('cutting')
      glory.style.transform = 'scale(1.05)'
      holdFor(work, false)
    },
    progress(reading) {
      if (!running) return
      const now = performance.now()
      // ten writes a second at most. A new stage and the last reading of an
      // entry always land: they are what the visitor is waiting to see.
      const due = reading.stage !== stageSaid || reading.share === 1
      if (!due && now - paintedAt < 100) return
      paintedAt = now
      word(reading.stage)
      if (reading.share !== shareSaid) {
        shareSaid = reading.share
        line(reading.share)
      }
    },
    forgeStage() {
      paint()
      running = true
      window.clearTimeout(timer)
      el.classList.remove('cutting')
      el.classList.add('lit')
      word('none')
      line(1)
      glory.style.transform = 'scale(1.05)'
    },
    stop: strike,
    active: () => running,
  }
}
