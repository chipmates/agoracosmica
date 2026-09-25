/* A SHOWPIECE FILM in the vitrine: a film the museum made of what a work
   describes, standing where the work's close look stands. Its first frame is
   a still shown at once; the visitor starts it, pauses it and plays it again,
   and it never starts by itself. Its lines run in the caption under the
   picture, never over it, each from its own second of the film. Every word is
   the caller's, already in the page's language. */

import css from './showpiece.css?inline'
import type { VitrinePayload, VitrinePayloadHost } from './types'
import { paintSlider } from './slider'
import { folioDoor, type FolioSheet } from './folio'

export type ShowpieceFraming = 'wide' | 'upright'
export interface ShowpieceFile { src: string; width: number; height: number }
/** one framing of the film: its first frame as a still, and its sizes */
export interface ShowpieceCut { poster: ShowpieceFile; rungs: readonly ShowpieceFile[] }
/** a line and the second of the film it stands from */
export interface ShowpieceLine { from: number; text: string }

export interface ShowpiecePayload extends VitrinePayload {
  /** true once the first frame or a frame of the film stands */
  standing(): boolean
  readout(): { framing: ShowpieceFraming; rung: string | null; time: number; playing: boolean; ended: boolean
    line: number; poster: boolean; video: boolean; film: { left: number; top: number; width: number; height: number } | null }
}

/** the air between the picture and its lines, and the least a picture keeps */
const GAP = 12
const LEAST = 120
/** the lines' measure on a wide stage: two rows of the line's type */
const MEASURE = 860
/** a wide stage keeps a lane beside the picture for the work's own door */
const LANE = 24

const make = <K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] => {
  const node = doc.createElement(tag)
  node.className = cls
  if (text !== undefined) node.textContent = text
  return node
}
const seconds = (t: number): string => `${Math.round(t)} s`

export function createShowpiecePayload(options: {
  cuts: Partial<Record<ShowpieceFraming, ShowpieceCut>>
  framing(): ShowpieceFraming
  /** the film's length in seconds */
  seconds: number
  title: string
  lines: readonly ShowpieceLine[]
  words: { play: string; pause: string; clock: string }
  /** the work the film shows the model of, one press away */
  sheet?: FolioSheet
}): ShowpiecePayload {
  const lines = [...options.lines].sort((a, b) => a.from - b.from)
  let host: VitrinePayloadHost | undefined
  let root: HTMLDivElement | undefined, poster: HTMLImageElement | undefined, video: HTMLVideoElement | undefined
  let play: HTMLButtonElement | undefined, slider: HTMLInputElement | undefined, door: HTMLButtonElement | undefined
  let framing: ShowpieceFraming = options.framing()
  let rung: string | null = null
  let shown = false, dragging = false, line = -1, lineBox = 0, measuredAt = ''
  let film: { left: number; top: number; width: number; height: number } | null = null
  let listening = new AbortController()

  const cutOf = (f: ShowpieceFraming): ShowpieceCut | undefined => options.cuts[f] ?? options.cuts.wide ?? options.cuts.upright
  const aspect = (): number => { const c = cutOf(framing); return c ? c.poster.width / c.poster.height : 16 / 9 }
  const duration = (): number => (video && Number.isFinite(video.duration) && video.duration > 0 ? video.duration : options.seconds)
  const now = (): number => (video && shown ? video.currentTime : 0)
  const lineAt = (t: number): number => {
    let found = 0
    for (let i = 0; i < lines.length; i++) if (t + 1e-3 >= lines[i]!.from) found = i
    return found
  }

  /** the smallest size that still carries the picture's device pixels, within a tenth */
  function rungFor(cut: ShowpieceCut, width: number): ShowpieceFile {
    const sorted = [...cut.rungs].sort((a, b) => a.width - b.width)
    const across = width * (devicePixelRatio || 1)
    return sorted.find(r => r.width >= across * 0.9) ?? sorted[sorted.length - 1]!
  }

  /** THE LINES' BOX IS THE LONGEST LINE'S: measured once per width and
      language in the caption's own type, so the picture never moves when a
      line gives way to the next */
  function measureLines(): number {
    if (!host) return 0
    const caption = host.caption
    const box = host.element.getBoundingClientRect()
    const key = `${Math.round(box.width)}|${host.lang}|${lines.length}`
    if (key === measuredAt) return lineBox
    const said = caption.textContent
    caption.style.top = '0px'
    caption.style.bottom = 'auto'
    let most = 0
    for (const each of lines) {
      caption.textContent = each.text
      most = Math.max(most, caption.getBoundingClientRect().height)
    }
    caption.textContent = said
    measuredAt = key
    lineBox = Math.ceil(most)
    return lineBox
  }

  /** THE PICTURE WHOLE, AND ITS LINES UNDER IT: the film is contained in the
      viewport less the lines' box, and the pair stands centred in it */
  function fit(): void {
    if (!host || !root) return
    const box = host.element.getBoundingClientRect()
    if (box.width < 2 || box.height < 2) return
    const lanes = !host.narrow && door ? 2 * (door.offsetWidth + LANE) : 0
    const room = { width: Math.max(LEAST, box.width - lanes), height: Math.max(LEAST, box.height - measureLines() - GAP) }
    const a = aspect()
    const width = Math.min(room.width, room.height * a), height = width / a
    const top = Math.max(0, (box.height - (height + GAP + lineBox)) / 2)
    film = { left: Math.round((box.width - width) / 2), top: Math.round(top), width: Math.round(width), height: Math.round(height) }
    Object.assign(root.style, { left: `${film.left}px`, top: `${film.top}px`, width: `${film.width}px`, height: `${film.height}px` })
    host.caption.style.top = `${film.top + film.height + GAP}px`
    host.caption.style.bottom = 'auto'
    host.caption.style.minHeight = `${lineBox}px`
    // the work's own door stands in the lane beside the picture's foot
    if (door && !host.narrow) {
      door.style.left = `${film.left + film.width + LANE}px`
      door.style.top = `${film.top + film.height - door.offsetHeight}px`
    }
  }

  function load(f: ShowpieceFraming, at: number, playing: boolean): void {
    if (!video || !poster || !host) return
    const cut = cutOf(f)
    if (!cut) return
    framing = f
    shown = false
    video.classList.remove('shown')
    poster.src = cut.poster.src
    const width = film?.width ?? host.element.getBoundingClientRect().width
    const chosen = rungFor(cut, width)
    rung = `${chosen.width}x${chosen.height}`
    video.dataset['rung'] = rung
    video.src = chosen.src
    if (at > 0 || playing) {
      video.addEventListener('loadedmetadata', () => {
        if (!video) return
        if (at > 0) video.currentTime = Math.min(at, duration() - 0.05)
        if (playing) void video.play().catch(() => undefined)
      }, { once: true, signal: listening.signal })
    }
    video.load()
  }

  /** the film takes the still's place only once a frame of its own is presented */
  function reveal(): void {
    if (!video || shown) return
    const withCallback = video as HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number }
    const show = (): void => { if (!video) return; shown = true; video.classList.add('shown'); paint() }
    if (withCallback.requestVideoFrameCallback) withCallback.requestVideoFrameCallback(show)
    else requestAnimationFrame(show)
  }

  function run(): void {
    if (!video) return
    if (video.ended || video.currentTime >= duration() - 0.05) video.currentTime = 0
    void video.play().catch(() => undefined)
    paint()
  }
  function toggle(): void {
    if (!video) return
    if (video.paused || video.ended) run()
    else { video.pause(); paint() }
  }
  function seek(t: number): void {
    if (!video) return
    video.currentTime = Math.max(0, Math.min(duration() - 1 / 120, t))
    reveal()
    paint()
  }

  function paint(): void {
    if (!host || !video) return
    const t = now()
    if (slider && !dragging) slider.value = String(Math.round((t / duration()) * 1000))
    if (slider) {
      paintSlider(slider)
      slider.setAttribute('aria-valuetext', `${seconds(t)} / ${seconds(duration())}`)
    }
    if (play) {
      const playing = !video.paused && !video.ended
      const word = playing ? options.words.pause : options.words.play
      if (play.textContent !== word) play.textContent = word
      play.setAttribute('aria-pressed', String(playing))
    }
    const at = lineAt(t)
    if (at === line) return
    line = at
    host.caption.textContent = lines[at]?.text ?? ''
    host.caption.lang = host.lang
  }

  function build(next: VitrinePayloadHost): void {
    const doc = next.element.ownerDocument
    const { signal } = listening
    root = make(doc, 'div', 'showpiece')
    root.setAttribute('aria-hidden', 'true')
    const style = make(doc, 'style', '')
    style.textContent = css
    poster = make(doc, 'img', 'showpiece-poster')
    poster.alt = ''
    poster.decoding = 'async'
    poster.addEventListener('load', () => { if (root) root.dataset['ready'] = 'true' }, { signal })
    video = make(doc, 'video', 'showpiece-video')
    video.muted = true
    video.playsInline = true
    video.loop = false
    video.preload = 'auto'
    video.disablePictureInPicture = true
    for (const name of ['playsinline', 'muted', 'disableremoteplayback']) video.setAttribute(name, '')
    root.append(style, poster, video)
    next.element.append(root)
    video.addEventListener('playing', reveal, { signal })
    video.addEventListener('seeked', reveal, { signal })
    for (const event of ['play', 'pause', 'ended', 'timeupdate', 'seeked']) video.addEventListener(event, paint, { signal })

    const clock = make(doc, 'div', 'vitrine-clock')
    play = make(doc, 'button', 'vitrine-control vitrine-play', options.words.play)
    play.type = 'button'
    play.setAttribute('aria-pressed', 'false')
    play.addEventListener('click', toggle, { signal })
    slider = make(doc, 'input', 'vitrine-slider')
    slider.type = 'range'
    slider.min = '0'; slider.max = '1000'; slider.step = '1'; slider.value = '0'
    slider.setAttribute('aria-label', options.words.clock)
    slider.addEventListener('input', () => {
      if (!video || !slider) return
      dragging = true
      video.pause()
      seek((Number(slider.value) / 1000) * duration())
    }, { signal })
    slider.addEventListener('change', () => { dragging = false; paint() }, { signal })
    const track = make(doc, 'div', 'vitrine-track')
    track.append(slider)
    // a tick where a line gives way to the next: the moment the film is about
    for (const each of lines) {
      if (each.from <= 0) continue
      const tick = make(doc, 'span', 'vitrine-tick')
      tick.style.left = `${(each.from / options.seconds) * 100}%`
      tick.setAttribute('aria-hidden', 'true')
      track.append(tick)
    }
    clock.append(play, track)
    next.controls.append(clock)
    if (options.sheet) {
      door = folioDoor(doc, options.sheet, next.narrow, signal, () => root !== undefined)
      door.classList.add('showpiece-door')
      // on the phone the sheet's glass closes the clock's own row, so the card keeps its peek
      if (next.narrow) clock.append(door)
      else next.element.append(door)
      // the thumbnail's own height is known once it has loaded
      door.addEventListener('load', () => fit(), { capture: true, signal })
    }
  }

  return {
    kind: 'showpiece',
    // the film takes the glass on the phone, as a machine's cycle does
    fill: true,
    mount(next) {
      host = next
      listening = new AbortController()
      framing = options.framing()
      line = -1
      measuredAt = ''
      build(next)
      next.element.tabIndex = 0
      next.describe(options.title)
      // nothing draws: the room holds its frame, dimmed, and the film stands over it
      next.surface('hold')
      // fitted first, so the size fetched is the one the picture stands at
      fit()
      load(framing, 0, false)
      paint()
    },
    update() {
      if (host) paint()
    },
    layout() {
      if (!host || !video) return
      measuredAt = ''
      fit()
      // a turned phone is the other framing's film, at the second it stood at
      const turned = options.framing()
      if (turned === framing || !options.cuts[turned]) return
      const at = now(), playing = !video.paused && !video.ended
      load(turned, at, playing)
      fit()
    },
    key(event) {
      if (!video) return false
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        seek(now() + (event.key === 'ArrowRight' ? 5 : -5))
        return true
      }
      return false
    },
    unmount() {
      listening.abort()
      if (video) { video.pause(); video.removeAttribute('src'); video.load() }
      if (host) {
        host.caption.style.removeProperty('top')
        host.caption.style.removeProperty('bottom')
        host.caption.style.removeProperty('min-height')
      }
      root?.remove()
      door?.remove()
      root = undefined; poster = undefined; video = undefined; play = undefined; slider = undefined; door = undefined
      host = undefined
      film = null
    },
    standing: () => shown || root?.dataset['ready'] === 'true',
    readout: () => ({ framing, rung, time: now(), playing: Boolean(video && !video.paused && !video.ended), ended: Boolean(video?.ended),
      line, poster: root?.dataset['ready'] === 'true', video: shown, film }),
  }
}
