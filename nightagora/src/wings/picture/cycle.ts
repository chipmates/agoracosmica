/* THE MACHINE'S FILMED CYCLE (RENDER-GRAPH §8.2): one turn of the machine
   from the whole view, recorded from the live island by the film's export,
   played as a loop where the island does not open. A key frame stands at
   every step, so a pressed step lands exactly on its frame, and there the
   part the step names is drawn round by a thin outline. The words are the
   island's own: the caption, the steps as rows, the clock and its ticks. */

import cycleCss from './cycle.css?inline'
import type { PictureBox, PictureFraming } from './seam'
import type { VitrinePayload, VitrinePayloadHost } from '../vitrine/types'
import { islandFit } from '../vitrine/fit'
import { deskStageHeight } from '../desk-stage'
import { paintSlider } from '../vitrine/slider'
import { folioDoor, type FolioSheet } from '../vitrine/folio'

export interface CycleFile { file: string; bytes: number }

export interface FilmCycleFraming {
  /** the frame the export drew, in device pixels, and the device pixels a CSS pixel had there */
  master: [number, number]
  dpr: number
  /** the island's fitting box the machine was drawn in, in CSS pixels, centred on the frame */
  fit: [number, number]
  /** one mp4 per rung, the key frames at every step */
  files: Record<string, CycleFile>
  /** the first frame, shown while the clip's bytes arrive */
  poster: CycleFile
  /** each step's frame, and the outline of the part it names */
  steps: { frame: number; outline: CycleFile | null }[]
  /** THE MACHINE OVER ITS WHOLE RUN in this frame, CSS pixels [left, top,
      right, bottom]: every body, every moving part, its travel; never its
      shadow. A cycle recorded before the extent was measured has none. */
  extent?: { box: [number, number, number, number] }
}

export interface FilmCycle {
  period: number
  fps: number
  frames: number
  framings: Partial<Record<PictureFraming, FilmCycleFraming>>
}

export interface CycleStep { text: string; certainty: string }

const make = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag)
  node.className = cls
  if (text !== undefined) node.textContent = text
  return node
}
/** the smallest rung that still carries the box's device pixels, or the frame's as it is shown where that is wider, within a tenth */
function rungFor(files: Record<string, CycleFile>, box: PictureBox, aspect: number, shown: number): string {
  const rungs = Object.keys(files).map(k => k.split('x').map(Number) as [number, number]).sort((a, b) => a[0] - b[0])
  const across = Math.max(box.width, box.height * aspect, shown) * (devicePixelRatio || 1)
  return (rungs.find(r => r[0] >= across * 0.9) ?? rungs[rungs.length - 1]!).join('x')
}

/** the air left round the machine on every side, a share of the free box's shorter side */
export const CYCLE_MARGIN = 0.04

export interface CycleFit { left: number; top: number; width: number; height: number; scale: number; covers: boolean }

/** one axis: where the frame's near edge stands. The machine keeps its margin
    inside the box (`lo` to `hi`); the frame covers `from` to `to` where it can.
    Covering never moves the machine out of its box. */
function placeAxis(centred: number, span: number, lo: number, hi: number, from: number, to: number): number {
  const c0 = to - span, c1 = from
  if (c0 > c1) return centred
  const a = Math.max(lo, c0), b = Math.min(hi, c1)
  if (a <= b) return Math.min(b, Math.max(a, centred))
  return c1 < lo ? lo : hi
}

/** THE MACHINE AS BIG AS ITS BOX ALLOWS: the largest scale at which the
    machine's extent, with an even margin, fits the free box, the extent
    centred on it; the frame is then moved, never scaled, to cover what it
    must (null: nothing), as far as the machine stays inside its box. A frame
    with no extent is fitted by the island's fitting box, centred, as before. */
export function cycleFit(frame: Pick<FilmCycleFraming, 'master' | 'dpr' | 'fit' | 'extent'>, box: PictureBox, cover: PictureBox | null,
  margin = CYCLE_MARGIN): CycleFit {
  const W = frame.master[0] / frame.dpr, H = frame.master[1] / frame.dpr
  const [x0, y0, x1, y1] = frame.extent?.box ?? [(W - frame.fit[0]) / 2, (H - frame.fit[1]) / 2, (W + frame.fit[0]) / 2, (H + frame.fit[1]) / 2]
  const air = frame.extent ? margin * Math.min(box.width, box.height) : 0
  const scale = Math.min((box.width - 2 * air) / Math.max(1, x1 - x0), (box.height - 2 * air) / Math.max(1, y1 - y0))
  const width = W * scale, height = H * scale
  const centred = { left: box.left + box.width / 2 - ((x0 + x1) / 2) * scale, top: box.top + box.height / 2 - ((y0 + y1) / 2) * scale }
  if (!cover) return { ...centred, width, height, scale, covers: true }
  const left = placeAxis(centred.left, width,
    box.left + air - x0 * scale, box.left + box.width - air - x1 * scale, cover.left, cover.left + cover.width)
  const top = placeAxis(centred.top, height,
    box.top + air - y0 * scale, box.top + box.height - air - y1 * scale, cover.top, cover.top + cover.height)
  const covers = left <= cover.left + 0.5 && top <= cover.top + 0.5
    && left + width >= cover.left + cover.width - 0.5 && top + height >= cover.top + cover.height - 0.5
  return { left, top, width, height, scale, covers }
}

/** THE GROUND BESIDE A FRAME THAT CANNOT COVER, drawn from the frame's own
    edges at a quarter of the cover's pixels. Each bare side is the frame's
    outer strip (`strip` of its breadth) averaged across into one line,
    softened along it over `soft` ground pixels and drawn out to the cover's
    edge, so the air, the horizon and the floor run on. Next to the frame that
    line is drawn as it is, fading out over `fade` of the side; beyond, its dark
    dips are closed (the brightest of the neighbours within `close` of its
    length, then the darkest), so a shadow or a dark part reaching the frame's
    edge fades out instead of running on as a bar. No pixel is read back (the
    release's media may be cross-origin): the canvas's own compositing does it,
    and every line has a canvas of its own size, so no filter reads past it. */
const GROUND = { scale: 0.25, strip: 0.04, soft: 4, close: 0.08, fade: 0.35 }
/** the fade's own resolution across, stretched over the side */
const EDGE = 8
export type GroundLines = { raw: HTMLCanvasElement; wide: HTMLCanvasElement; closed: HTMLCanvasElement; edge: HTMLCanvasElement }
export const groundLines = (): GroundLines => ({
  raw: document.createElement('canvas'), wide: document.createElement('canvas'),
  closed: document.createElement('canvas'), edge: document.createElement('canvas'),
})
function sized(c: HTMLCanvasElement, w: number, h: number): CanvasRenderingContext2D | null {
  if (c.width !== w) c.width = w
  if (c.height !== h) c.height = h
  const x = c.getContext('2d')
  if (x) { x.globalCompositeOperation = 'source-over'; x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high' }
  return x
}
export function paintGround(canvas: HTMLCanvasElement, lines: GroundLines, source: CanvasImageSource, size: [number, number],
  at: PictureBox, frame: PictureBox): void {
  const k = GROUND.scale
  const w = Math.max(1, Math.ceil(at.width * k)), h = Math.max(1, Math.ceil(at.height * k))
  const ink = sized(canvas, w, h)
  if (!ink) return
  const [sw, sh] = size
  const fx0 = (frame.left - at.left) * k, fy0 = (frame.top - at.top) * k
  const fw = frame.width * k, fh = frame.height * k, fx1 = fx0 + fw, fy1 = fy0 + fh
  const p = Math.max(1, Math.round(Math.min(sw, sh) * GROUND.strip))
  ink.drawImage(source, 0, 0, sw, sh, fx0, fy0, fw, fh)

  /** a strip of the source averaged into a line `n` long (down a side or across one), raw and with its dark dips closed */
  const line = (sx: number, sy: number, sWidth: number, sHeight: number, down: boolean, n: number): boolean => {
    const [lw, lh] = down ? [1, n] : [n, 1]
    const raw = sized(lines.raw, lw, lh), wide = sized(lines.wide, lw, lh), closed = sized(lines.closed, lw, lh)
    if (!raw || !wide || !closed) return false
    raw.drawImage(source, sx, sy, sWidth, sHeight, 0, 0, lw, lh)
    const r = Math.max(1, Math.round(n * GROUND.close))
    const spread = (into: CanvasRenderingContext2D, from: HTMLCanvasElement, mode: GlobalCompositeOperation): void => {
      into.imageSmoothingEnabled = false
      into.drawImage(from, 0, 0)
      into.globalCompositeOperation = mode
      for (let d = 1; d <= r; d++) for (const o of [d, -d]) into.drawImage(from, down ? 0 : o, down ? o : 0)
      into.globalCompositeOperation = 'source-over'
    }
    spread(wide, lines.raw, 'lighten')
    spread(closed, lines.wide, 'darken')
    return true
  }
  /** the closed line over the whole side, the raw line next to the frame fading out away from it */
  const lay = (down: boolean, n: number, frameFirst: boolean, dx: number, dy: number, dw: number, dh: number): void => {
    ink.drawImage(lines.closed, dx, dy, dw, dh)
    const breadth = down ? dw : dh
    const reach = Math.min(breadth, Math.max(3, breadth * GROUND.fade))
    const [ew, eh] = down ? [EDGE, n] : [n, EDGE]
    const edge = sized(lines.edge, ew, eh)
    if (!edge) return
    edge.drawImage(lines.raw, 0, 0, ew, eh)
    edge.globalCompositeOperation = 'destination-in'
    const fall = down ? edge.createLinearGradient(0, 0, EDGE, 0) : edge.createLinearGradient(0, 0, 0, EDGE)
    fall.addColorStop(0, `rgba(0, 0, 0, ${frameFirst ? 1 : 0})`)
    fall.addColorStop(1, `rgba(0, 0, 0, ${frameFirst ? 0 : 1})`)
    edge.fillStyle = fall
    edge.fillRect(0, 0, ew, eh)
    edge.globalCompositeOperation = 'source-over'
    if (down) ink.drawImage(lines.edge, frameFirst ? dx : dx + dw - reach, dy, reach, dh)
    else ink.drawImage(lines.edge, dx, frameFirst ? dy : dy + dh - reach, dw, reach)
  }
  const rows = Math.max(1, Math.ceil(fh / GROUND.soft)), cols = Math.max(1, Math.ceil(fw / GROUND.soft))
  // the sides, each with the corners above and below it from its own line's ends
  for (const [sx, dx, dw, frameFirst] of [[0, 0, fx0, false], [sw - p, fx1, w - fx1, true]] as const) {
    if (dw <= 0 || !line(sx, 0, p, sh, true, rows)) continue
    lay(true, rows, frameFirst, dx, fy0, dw, fh)
    if (fy0 > 0) ink.drawImage(lines.closed, 0, 0, 1, 1, dx, 0, dw, fy0)
    if (fy1 < h) ink.drawImage(lines.closed, 0, rows - 1, 1, 1, dx, fy1, dw, h - fy1)
  }
  for (const [sy, dy, dh, frameFirst] of [[0, 0, fy0, false], [sh - p, fy1, h - fy1, true]] as const) {
    if (dh <= 0 || !line(0, sy, sw, p, false, cols)) continue
    lay(false, cols, frameFirst, fx0, dy, fw, dh)
  }
}

export function createCyclePayload(options: {
  cycle: FilmCycle
  /** the release's folder, ending in a slash */
  base: string
  framing(): PictureFraming
  /** where the cycle stands: under the window, over the held canvas */
  host: HTMLElement
  /** the island's canvas box, which the cycle covers the same way */
  box(): PictureBox
  title: string
  steps: readonly CycleStep[]
  words: { play: string; pause: string; again: string; clock: string }
  /** the folio beside the model, as the island shows it */
  sheet?: FolioSheet
  /** the step it opens landed on, or null to open playing */
  land: number | null
}): VitrinePayload & { landed(): number | null; standing(): boolean } {
  const { cycle, steps } = options
  let host: VitrinePayloadHost | undefined
  let root: HTMLDivElement | undefined, video: HTMLVideoElement | undefined, poster: HTMLImageElement | undefined
  let ground: HTMLCanvasElement | undefined, lines: GroundLines | undefined
  /** where the frame stands now, and the part of the screen its ground fills where it cannot cover */
  let fitted: CycleFit | null = null, groundAt: PictureBox | null = null, groundAsked = false
  /** what the last fit was laid out from, so a frame that changes nothing writes nothing */
  let laid = '', grounded = false, groundedFor = ''
  let outline: HTMLImageElement | undefined
  let play: HTMLButtonElement | undefined, slider: HTMLInputElement | undefined
  let stepButtons: HTMLButtonElement[] = []
  let landed: number | null = null
  let shown = false, active = -2, dragging = false
  let framing: PictureFraming = options.framing()
  const listening = new AbortController()
  const signal = listening.signal
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches

  const at = (): FilmCycleFraming | undefined => cycle.framings[framing] ?? Object.values(cycle.framings)[0]
  const address = (file: string): string => new URL(file, options.base).href
  const duration = (): number => cycle.frames / cycle.fps
  /** the middle of a frame's own interval, so every engine shows that frame and no neighbour */
  const timeOf = (frame: number): number => (frame + 0.5) / cycle.fps
  const stepFrames = (): number[] => at()?.steps.map(s => s.frame) ?? []
  function stepAtFrame(frame: number): number {
    const list = stepFrames()
    let found = 0
    for (let i = 0; i < list.length; i++) if (frame + 0.5 >= list[i]!) found = i
    return found
  }

  /** WHAT THE FRAME MUST COVER: the glass on the phone, the stage over the band on the desktop */
  function coverOf(h: VitrinePayloadHost): PictureBox {
    if (!h.narrow) return { left: 0, top: 0, width: innerWidth, height: deskStageHeight() }
    const r = h.element.getBoundingClientRect()
    return { left: r.left, top: r.top, width: r.width, height: r.height }
  }
  /** THE MACHINE AS BIG AS ITS BOX ALLOWS, never cut (`cycleFit`); where the
      frame cannot cover the glass as well, its ground does, over the glass's
      breadth and as high as the frame stands on the screen */
  function fit(): void {
    if (!root || !host) return
    const f = at()
    if (!f) return
    // a layer that paints a ground of its own holds the frame on it (the cinema form): nothing to cover
    const size = `${innerWidth}x${innerHeight}`
    if (size !== groundedFor) {
      groundedFor = size
      grounded = !/^(transparent|rgba\(0, 0, 0, 0\))$/.test(getComputedStyle(options.host).backgroundColor)
    }
    const cover = grounded ? null : coverOf(host)
    const next = cycleFit(f, islandFit(host), cover)
    const key = [framing, next.left, next.top, next.width, next.height, cover?.left, cover?.top, cover?.width, cover?.height].join()
    if (key === laid) return
    laid = key
    fitted = next
    Object.assign(root.style, { left: `${fitted.left}px`, top: `${fitted.top}px`, width: `${fitted.width}px`, height: `${fitted.height}px` })
    if (fitted.covers || !cover) groundAt = null
    else if (!host.narrow) groundAt = cover
    else {
      const top = Math.min(cover.top, Math.max(0, fitted.top))
      const bottom = Math.max(cover.top + cover.height, Math.min(innerHeight, fitted.top + fitted.height))
      groundAt = { left: cover.left, top, width: cover.width, height: bottom - top }
    }
    if (ground) {
      ground.hidden = true
      if (groundAt) {
        Object.assign(ground.style, { left: `${groundAt.left}px`, top: `${groundAt.top}px`, width: `${groundAt.width}px`, height: `${groundAt.height}px` })
        drawGround()
        followGround()
      }
    }
  }
  function groundSource(): { source: CanvasImageSource; size: [number, number] } | null {
    if (video && shown && video.readyState >= 2 && video.videoWidth) return { source: video, size: [video.videoWidth, video.videoHeight] }
    if (poster?.complete && poster.naturalWidth) return { source: poster, size: [poster.naturalWidth, poster.naturalHeight] }
    return null
  }
  function drawGround(): void {
    if (!ground || !groundAt || !fitted) return
    const from = groundSource()
    if (!from) return
    lines ??= groundLines()
    paintGround(ground, lines, from.source, from.size, groundAt, fitted)
    ground.hidden = false
  }
  /** a running clip's ground is drawn again at each of its frames */
  function followGround(): void {
    if (!video || !groundAt || groundAsked || video.paused) return
    groundAsked = true
    const next = (): void => { groundAsked = false; drawGround(); followGround() }
    const withCallback = video as HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number }
    if (withCallback.requestVideoFrameCallback) withCallback.requestVideoFrameCallback(next)
    else requestAnimationFrame(next)
  }

  function paint(): void {
    if (!host || !video) return
    const frame = Math.min(cycle.frames - 1, Math.floor(video.currentTime * cycle.fps + 1e-3))
    const step = landed ?? stepAtFrame(frame)
    if (slider && !dragging) slider.value = String(Math.round((frame / Math.max(1, cycle.frames)) * 1000))
    if (slider) paintSlider(slider)
    if (slider) slider.setAttribute('aria-valuetext', `${video.currentTime.toFixed(1)} s / ${cycle.period} s`)
    if (play) {
      const text = video.paused ? options.words.play : options.words.pause
      if (play.textContent !== text) play.textContent = text
      play.setAttribute('aria-pressed', String(!video.paused))
    }
    if (step === active) return
    active = step
    host.caption.textContent = steps[step]?.text ?? ''
    host.caption.lang = host.lang
    host.step?.(step, steps.length)
    stepButtons.forEach((button, i) => { if (i === step) button.setAttribute('aria-current', 'step'); else button.removeAttribute('aria-current') })
    host.describe(steps[step] ? `${options.title}. ${steps[step]!.text}` : options.title)
  }

  /** THE STEP LANDS ON ITS OWN KEY FRAME, and only there is the part drawn round */
  function land(index: number): void {
    const f = at()
    if (!video || !f || !f.steps[index]) return
    video.pause()
    landed = index
    active = -2
    const file = f.steps[index]!.outline
    if (outline) {
      outline.classList.remove('shown')
      if (file) {
        const src = address(file.file)
        if (outline.src !== src) outline.src = src
      }
    }
    const show = (): void => { if (landed === index && outline && file) outline.classList.add('shown'); paint() }
    const t = timeOf(f.steps[index]!.frame)
    if (Math.abs(video.currentTime - t) < 0.5 / cycle.fps) { show(); return }
    video.addEventListener('seeked', show, { once: true, signal })
    video.currentTime = t
    paint()
  }
  function run(): void {
    if (!video) return
    landed = null
    outline?.classList.remove('shown')
    void video.play().catch(() => undefined)
    paint()
  }
  function toggle(): void {
    if (!video) return
    if (video.paused) run()
    else { video.pause(); paint() }
  }

  function build(next: VitrinePayloadHost): void {
    const f = at()
    root = make('div', 'na-cycle')
    laid = ''; groundedFor = ''
    root.setAttribute('aria-hidden', 'true')
    const style = make('style', '')
    style.textContent = cycleCss
    poster = make('img', 'na-cycle-poster')
    poster.alt = ''
    poster.decoding = 'async'
    // the cycle's ground shows only under a frame of its own, never as an empty box
    poster.addEventListener('load', () => { if (root) root.dataset['ready'] = 'true' }, { signal })
    video = make('video', 'na-cycle-video')
    video.muted = true
    video.playsInline = true
    video.loop = true
    video.preload = 'auto'
    video.disablePictureInPicture = true
    video.setAttribute('playsinline', '')
    video.setAttribute('muted', '')
    video.setAttribute('disableremoteplayback', '')
    outline = make('img', 'na-cycle-outline')
    outline.alt = ''
    root.append(style, poster, video, outline)
    ground = make('canvas', 'na-cycle-ground')
    ground.setAttribute('aria-hidden', 'true')
    ground.hidden = true
    Object.assign(ground.style, { position: 'fixed', pointerEvents: 'none' })
    options.host.append(ground, root)
    poster.addEventListener('load', drawGround, { signal })
    video.addEventListener('seeked', drawGround, { signal })
    video.addEventListener('play', followGround, { signal })
    fit()
    if (f) {
      poster.src = address(f.poster.file)
      const rung = rungFor(f.files, options.box(), f.master[0] / f.master[1], fitted?.width ?? 0)
      video.src = address(f.files[rung]!.file)
      video.dataset['rung'] = rung
    }
    // the clip is shown only once its first frame is presented over the poster
    const reveal = (): void => { if (!video || shown) return; shown = true; video.classList.add('shown'); drawGround() }
    const withCallback = video as HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number }
    video.addEventListener('loadeddata', () => {
      if (withCallback.requestVideoFrameCallback) withCallback.requestVideoFrameCallback(() => reveal())
      else requestAnimationFrame(() => reveal())
      if (options.land !== null || reduced) land(options.land ?? 0)
      else run()
    }, { once: true, signal })
    // an engine that paints a paused first frame without a callback is revealed on its seek,
    // and one that skips the callback for a hidden video on its first advance
    video.addEventListener('seeked', () => requestAnimationFrame(() => reveal()), { signal })
    video.addEventListener('timeupdate', () => { if (video && video.currentTime > 0) requestAnimationFrame(() => reveal()) }, { signal })

    const row = next.controls
    const clock = make('div', 'vitrine-clock')
    play = make('button', 'vitrine-control vitrine-play', options.words.play)
    play.type = 'button'
    play.addEventListener('click', toggle, { signal })
    slider = make('input', 'vitrine-slider')
    slider.type = 'range'
    slider.min = '0'; slider.max = '1000'; slider.step = '1'
    slider.setAttribute('aria-label', options.words.clock)
    slider.addEventListener('input', () => {
      if (!video) return
      dragging = true
      video.pause()
      landed = null
      outline?.classList.remove('shown')
      video.currentTime = Math.min(duration() - 0.5 / cycle.fps, (Number(slider!.value) / 1000) * duration())
    }, { signal })
    // THE CLOCK SNAPS TO THE STEPS: a hand let go lands on the nearest one
    slider.addEventListener('change', () => {
      dragging = false
      const frame = (Number(slider!.value) / 1000) * cycle.frames
      const list = stepFrames()
      let near = 0
      for (let i = 1; i < list.length; i++) if (Math.abs(list[i]! - frame) < Math.abs(list[near]! - frame)) near = i
      land(near)
    }, { signal })
    slider.addEventListener('keydown', event => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      event.preventDefault(); event.stopPropagation()
      turn(event.key === 'ArrowRight' ? 1 : -1)
    }, { signal })
    const track = make('div', 'vitrine-track')
    track.append(slider)
    for (const frame of stepFrames()) {
      const tick = make('span', 'vitrine-tick')
      tick.style.left = `${(frame / cycle.frames) * 100}%`
      tick.setAttribute('aria-hidden', 'true')
      track.append(tick)
    }
    clock.append(play, track)
    const views = make('div', 'vitrine-views')
    row.append(views, clock)
    stepButtons = []
    if (steps.length) {
      const list = make('ul', 'vitrine-steps')
      list.setAttribute('role', 'list')
      steps.forEach((step, i) => {
        const item = make('li', '')
        const button = make('button', 'vitrine-step-item')
        button.type = 'button'
        button.lang = next.lang
        const dot = make('span', 'vinci-title-dot')
        dot.dataset['certainty'] = step.certainty
        dot.setAttribute('aria-hidden', 'true')
        button.append(dot, make('span', '', step.text))
        button.addEventListener('click', () => land(i), { signal })
        stepButtons.push(button)
        item.append(button)
        list.append(item)
      })
      next.aside.append(list)
    }
    if (options.sheet) {
      const sheet = folioDoor(next.element.ownerDocument, options.sheet, next.narrow, signal, () => root !== undefined)
      if (next.narrow) views.append(sheet)
      else next.element.append(sheet)
    }
  }

  function turn(direction: number): void {
    const now = landed ?? (video ? stepAtFrame(Math.floor(video.currentTime * cycle.fps)) : 0)
    land((now + direction + steps.length) % steps.length)
  }

  return {
    kind: 'machine',
    // the cycle takes the glass on the phone as the island does, so both stand in one frame
    fill: true,
    mount(next) {
      host = next
      framing = options.framing()
      landed = null
      active = -2
      build(next)
      next.element.tabIndex = 0
      next.describe(options.title)
      // nothing draws: the canvas holds, and the cycle stands over it
      next.surface('hold')
      paint()
    },
    update() {
      if (!host) return
      fit()
      paint()
    },
    layout() {
      if (!host || !video) return
      fit()
      // a turned phone is the other framing's cycle, at the step it stood at
      const turned = options.framing()
      if (turned === framing || !cycle.framings[turned]) return
      const step = landed ?? stepAtFrame(Math.floor(video.currentTime * cycle.fps))
      framing = turned
      const f = at()
      if (!f) return
      poster!.src = address(f.poster.file)
      shown = false
      video.classList.remove('shown')
      video.src = address(f.files[rungFor(f.files, options.box(), f.master[0] / f.master[1], fitted?.width ?? 0)]!.file)
      video.addEventListener('loadeddata', () => { shown = true; video?.classList.add('shown'); land(step); drawGround() }, { once: true, signal })
    },
    key(event) {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { turn(event.key === 'ArrowRight' ? 1 : -1); return true }
      return false
    },
    unmount() {
      listening.abort()
      if (video) { video.pause(); video.removeAttribute('src'); video.load() }
      root?.remove()
      ground?.remove()
      root = undefined; video = undefined; poster = undefined; outline = undefined; ground = undefined; lines = undefined
      fitted = null; groundAt = null
      host = undefined
    },
    landed: () => landed,
    standing: () => shown || root?.dataset['ready'] === 'true',
  }
}
