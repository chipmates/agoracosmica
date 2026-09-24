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
/** the smallest rung that still carries the box's device pixels, within a tenth */
function rungFor(files: Record<string, CycleFile>, box: PictureBox, aspect: number): string {
  const rungs = Object.keys(files).map(k => k.split('x').map(Number) as [number, number]).sort((a, b) => a[0] - b[0])
  const across = Math.max(box.width, box.height * aspect) * (devicePixelRatio || 1)
  return (rungs.find(r => r[0] >= across * 0.9) ?? rungs[rungs.length - 1]!).join('x')
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
  sheet?: { src: Promise<string | null> | null; label: string; open(): void }
  /** the step it opens landed on, or null to open playing */
  land: number | null
}): VitrinePayload & { landed(): number | null; standing(): boolean } {
  const { cycle, steps } = options
  let host: VitrinePayloadHost | undefined
  let root: HTMLDivElement | undefined, video: HTMLVideoElement | undefined, poster: HTMLImageElement | undefined
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

  /** THE MACHINE WHERE THE ISLAND WOULD STAND IT: the frame scaled as the
      island's fitting box is, and centred on it; the frame's margins cover the box */
  function fit(): void {
    if (!root || !host) return
    const f = at()
    if (!f) return
    const box = islandFit(host)
    const scale = Math.min(box.width / f.fit[0], box.height / f.fit[1])
    const width = (f.master[0] / f.dpr) * scale, height = (f.master[1] / f.dpr) * scale
    Object.assign(root.style, { left: `${box.left + (box.width - width) / 2}px`, top: `${box.top + (box.height - height) / 2}px`,
      width: `${width}px`, height: `${height}px` })
  }

  function paint(): void {
    if (!host || !video) return
    const frame = Math.min(cycle.frames - 1, Math.floor(video.currentTime * cycle.fps + 1e-3))
    const step = landed ?? stepAtFrame(frame)
    if (slider && !dragging) slider.value = String(Math.round((frame / Math.max(1, cycle.frames)) * 1000))
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
    options.host.append(root)
    fit()
    if (f) {
      poster.src = address(f.poster.file)
      const rung = rungFor(f.files, options.box(), f.master[0] / f.master[1])
      video.src = address(f.files[rung]!.file)
      video.dataset['rung'] = rung
    }
    // the clip is shown only once its first frame is presented over the poster
    const reveal = (): void => { if (!video || shown) return; shown = true; video.classList.add('shown') }
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
      const sheet = make('button', 'vitrine-folio')
      sheet.type = 'button'
      sheet.setAttribute('aria-label', options.sheet.label)
      if (options.sheet.src) {
        void options.sheet.src.then(src => {
          if (!root) return
          if (!src) { sheet.textContent = options.sheet!.label; return }
          const image = make('img', 'vitrine-folio-thumb')
          image.alt = ''
          image.decoding = 'async'
          image.src = src
          sheet.append(image)
        })
      } else sheet.textContent = options.sheet.label
      sheet.addEventListener('click', () => options.sheet?.open(), { signal })
      if (next.narrow) { sheet.classList.add('vitrine-folio-glass'); views.append(sheet) }
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
      video.src = address(f.files[rungFor(f.files, options.box(), f.master[0] / f.master[1])]!.file)
      video.addEventListener('loadeddata', () => { shown = true; video?.classList.add('shown'); land(step) }, { once: true, signal })
    },
    key(event) {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { turn(event.key === 'ArrowRight' ? 1 : -1); return true }
      return false
    },
    unmount() {
      listening.abort()
      if (video) { video.pause(); video.removeAttribute('src'); video.load() }
      root?.remove()
      root = undefined; video = undefined; poster = undefined; outline = undefined
      host = undefined
    },
    landed: () => landed,
    standing: () => shown || root?.dataset['ready'] === 'true',
  }
}
