/* A SHOWPIECE FILM in the vitrine: a film the museum made of what a work
   describes, standing where the work's close look stands. Its first frame is
   a still shown at once; the visitor starts it, pauses it and plays it again,
   and it never starts by itself. Its lines run in the caption under the
   picture, never over it, each from its own second of the film. Every word is
   the caller's, already in the page's language. */

import css from './showpiece.css?inline'
import type { VitrinePayload, VitrinePayloadHost, VitrineRect } from './types'
import { paintSlider } from './slider'
import { folioDoor, type FolioSheet } from './folio'
import { softMask } from '../picture/cycle'

export type ShowpieceFraming = 'wide' | 'upright'
export interface ShowpieceFile { src: string; width: number; height: number }
/** one framing of the film: its first frame as a still, and its sizes */
export interface ShowpieceCut { poster: ShowpieceFile; rungs: readonly ShowpieceFile[] }
/** a line and the second of the film it stands from */
export interface ShowpieceLine { from: number; text: string }
/** where the model stands in a framing's frame over the whole run, as shares of the frame: [left, top, right, bottom] */
export type ShowpieceExtent = Partial<Record<ShowpieceFraming, readonly [number, number, number, number]>>

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
/** SIDEWAYS THE FILM IS SHOWN THROUGH ITS MODEL'S BOX: the box's sides
    widened by this share of the frame's width, over which the film fades into
    the wall, so the model itself is never faded; an end that stands inside
    the glass fades over this share of the height, one at the glass's edge runs off it */
const SIDE_FADE = 0.08
const END_FADE = 0.1
/** the line's column beside the film: its least and most width, and its gap to the film */
const WORDS_LEAST = 200
const WORDS_MOST = 340
const WORDS_GAP = 28
/** under the film: the air over its line, and the clock's band under the line */
const LINE_AIR = 8
const CLOCK = 44

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
  /** where its model stands in each framing's frame over the run; sideways the film is shown through it */
  extent?: ShowpieceExtent
}): ShowpiecePayload {
  const lines = [...options.lines].sort((a, b) => a.from - b.from)
  let host: VitrinePayloadHost | undefined
  let root: HTMLDivElement | undefined, poster: HTMLImageElement | undefined, video: HTMLVideoElement | undefined
  let play: HTMLButtonElement | undefined, slider: HTMLInputElement | undefined, door: HTMLButtonElement | undefined
  let framing: ShowpieceFraming = options.framing()
  let rung: string | null = null
  let shown = false, dragging = false, line = -1, lineBox = 0, measuredAt = ''
  let film: { left: number; top: number; width: number; height: number } | null = null
  /** sideways, where the line and the clock stand clear of the film, in the viewport */
  let words: { box: VitrineRect; beside: boolean } | null = null
  /** the whole frame's width on the screen, which may run past the box the film is shown through */
  let frameWidth = 0
  let listening = new AbortController()
  /** ON THE PHONE THE LINE IS THE CARD'S: it stands in the sheet under the
      work's name, as the phone form's line does, and never over the film */
  let said: HTMLParagraphElement | undefined
  /** SIDEWAYS THE LINE IS THE FILM'S SUBTITLE, over its foot */
  const lineHost = (): HTMLElement | undefined => (host?.narrow && !host.cinema?.() ? said : host?.caption)
  /** where the line was last written, so a turned phone moves it and leaves no copy behind */
  let wrote: HTMLElement | undefined

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
    const caption = lineHost()
    if (!host || !caption) return 0
    const box = (host.narrow ? caption : host.element).getBoundingClientRect()
    const key = `${Math.round(box.width)}|${host.lang}|${lines.length}`
    if (key === measuredAt) return lineBox
    const shown = caption.textContent
    if (!host.narrow) { caption.style.top = '0px'; caption.style.bottom = 'auto' }
    caption.style.minHeight = ''
    let most = 0
    for (const each of lines) {
      caption.textContent = each.text
      most = Math.max(most, caption.getBoundingClientRect().height)
    }
    caption.textContent = shown
    measuredAt = key
    lineBox = Math.ceil(most)
    // the card's peek is measured once, at the longest line, so it never jumps
    if (host.narrow) caption.style.minHeight = `${lineBox}px`
    return lineBox
  }

  /** THE PICTURE WHOLE, AND ITS LINES UNDER IT: the film is contained in the
      viewport less the lines' box, and the pair stands centred in it */
  function fit(): void {
    if (!host || !root) return
    const box = host.element.getBoundingClientRect()
    if (box.width < 2 || box.height < 2) return
    if (host.cinema?.()) { fitWall(box); return }
    plainFrame()
    if (host.narrow) { fitGlass(box); return }
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

  /** THE FILM TAKES THE GLASS'S WIDTH ON THE PHONE, at its own aspect: its
      middle stands in the middle of the glass above the sheet, and a film
      taller than that runs on under the sheet and past the glass's top, as
      the walk's own picture runs under its box */
  function fitGlass(box: DOMRect): void {
    if (!host || !root) return
    measureLines()
    const view = host.element.ownerDocument.defaultView!
    const width = view.innerWidth, height = width / aspect()
    // the payload ends where the card's peek begins
    const above = box.bottom
    let top = (above - height) / 2
    if (height > above) top = Math.min(0, Math.max(above - height, top))
    film = { left: Math.round(-box.left), top: Math.round(top - box.top), width: Math.round(width), height: Math.round(height) }
    Object.assign(root.style, { left: `${film.left}px`, top: `${film.top}px`, width: `${film.width}px`, height: `${film.height}px` })
  }

  /** the film's frame fills the box it stands in, as it does everywhere but sideways */
  function plainFrame(): void {
    words = null
    frameWidth = 0
    for (const el of [poster, video]) if (el) for (const name of ['inset', 'left', 'top', 'width', 'height']) el.style.removeProperty(name)
    if (root) for (const name of ['mask-image', '-webkit-mask-image', 'mask-composite', '-webkit-mask-composite']) root.style.removeProperty(name)
  }

  /** SIDEWAYS THE FILM STANDS ON THE WALL THROUGH ITS MODEL'S BOX, as tall as
      the zone: its line and its clock stand beside it where the zone has the
      room, else under it, and never over it. A framing with no box measured
      stands whole, its line and clock over its foot. */
  function fitWall(box: DOMRect): void {
    if (!root) return
    const a = aspect()
    const ex = options.extent?.[framing]
    if (!ex) {
      plainFrame()
      const width = Math.min(box.width, box.height * a), height = width / a
      film = { left: Math.round((box.width - width) / 2), top: Math.round((box.height - height) / 2), width: Math.round(width), height: Math.round(height) }
      Object.assign(root.style, { left: `${film.left}px`, top: `${film.top}px`, width: `${film.width}px`, height: `${film.height}px` })
      return
    }
    const x0 = Math.max(0, ex[0] - SIDE_FADE), x1 = Math.min(1, ex[2] + SIDE_FADE), y0 = ex[1], y1 = ex[3]
    // the box's width over its height, in the frame's own pixels
    const shape = ((x1 - x0) / Math.max(0.01, y1 - y0)) * a
    // the film may run up past the zone's air to the field's top, the glass's own edge
    const field = host?.field?.() ?? null
    const over = field ? Math.max(0, box.top - field.top) : 0
    let height = box.height + over, width = height * shape
    const room = box.width - width - WORDS_GAP
    if (room >= WORDS_LEAST) {
      const column = Math.min(WORDS_MOST, room)
      const left = Math.round((box.width - width - WORDS_GAP - column) / 2)
      film = { left, top: -Math.round(over), width: Math.round(width), height: Math.round(height) }
      words = { box: { left: film.left + film.width + WORDS_GAP, top: 0, width: Math.round(column), height: Math.round(box.height) }, beside: true }
    } else {
      const said = linesAt(box.width)
      height = Math.max(LEAST, box.height + over - said - LINE_AIR - CLOCK)
      width = Math.min(box.width, height * shape)
      height = width / shape
      // a film the zone's width holds shorter still runs off the glass's top; the room it leaves stands over its line
      film = { left: Math.round((box.width - width) / 2), top: -Math.round(over), width: Math.round(width), height: Math.round(height) }
      const below = film.top + film.height + LINE_AIR
      words = { box: { left: 0, top: below, width: Math.round(box.width), height: Math.round(Math.max(said + CLOCK, box.height - below)) }, beside: false }
    }
    Object.assign(root.style, { left: `${film.left}px`, top: `${film.top}px`, width: `${film.width}px`, height: `${film.height}px` })
    // the whole frame, placed so the model's box is what the film shows
    const frameHeight = film.height / Math.max(0.01, y1 - y0)
    frameWidth = frameHeight * a
    for (const el of [poster, video]) if (el) Object.assign(el.style, { inset: 'auto', left: `${(-x0 * frameWidth).toFixed(2)}px`, top: `${(-y0 * frameHeight).toFixed(2)}px`,
      width: `${frameWidth.toFixed(2)}px`, height: `${frameHeight.toFixed(2)}px` })
    // its sides fade into the wall over the air outside the model's box; its foot, and a top inside the glass, over a share of its height
    const end = END_FADE * film.height
    const atEdge = field !== null && box.top + film.top <= field.top + 0.5
    const mask = softMask({ left: Math.max(end / 2, (ex[0] - x0) * frameWidth), right: Math.max(end / 2, (x1 - ex[2]) * frameWidth),
      top: atEdge ? 0 : end, bottom: end })
    if (mask) {
      for (const name of ['mask-image', '-webkit-mask-image']) root.style.setProperty(name, mask)
      root.style.setProperty('mask-composite', 'intersect')
      root.style.setProperty('-webkit-mask-composite', 'source-in')
    }
  }
  /** THE LONGEST LINE'S HEIGHT at a width, in the caption's own type, measured
      once per width and language, so the film never moves when a line gives way */
  let linesFor = '', linesTall = 0
  function linesAt(width: number): number {
    if (!host) return 0
    const key = `${Math.round(width)}|${host.lang}|${lines.length}`
    if (key === linesFor) return linesTall
    const probe = host.caption.cloneNode(false) as HTMLElement
    probe.removeAttribute('aria-live')
    probe.setAttribute('aria-hidden', 'true')
    Object.assign(probe.style, { visibility: 'hidden', left: '0px', right: 'auto', top: '0px', bottom: 'auto', width: `${Math.round(width)}px`, padding: '0px' })
    host.caption.after(probe)
    let most = 0
    for (const each of lines) { probe.textContent = each.text; most = Math.max(most, probe.getBoundingClientRect().height) }
    probe.remove()
    linesFor = key
    linesTall = Math.ceil(most)
    return linesTall
  }

  function load(f: ShowpieceFraming, at: number, playing: boolean): void {
    if (!video || !poster || !host) return
    const cut = cutOf(f)
    if (!cut) return
    framing = f
    shown = false
    video.classList.remove('shown')
    poster.src = cut.poster.src
    const width = frameWidth || (film?.width ?? host.element.getBoundingClientRect().width)
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
      // drawn as a glyph sideways, the word stays the button's name and its hint
      if (host.cinema?.()) play.title = word
      else play.removeAttribute('title')
    }
    const at = lineAt(t)
    const into = lineHost()
    if (at === line && into === wrote) return
    line = at
    if (wrote && wrote !== into) wrote.textContent = ''
    wrote = into
    if (!into) return
    into.textContent = lines[at]?.text ?? ''
    into.lang = host.lang
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
    if (next.narrow) {
      said = make(doc, 'p', 'showpiece-line')
      said.setAttribute('aria-live', 'polite')
      next.aside.append(said)
    }
    video.addEventListener('playing', reveal, { signal })
    video.addEventListener('seeked', reveal, { signal })
    for (const event of ['play', 'pause', 'ended', 'timeupdate', 'seeked']) video.addEventListener(event, paint, { signal })

    const clock = make(doc, 'div', 'vitrine-clock')
    play = make(doc, 'button', 'vitrine-control vitrine-play', options.words.play)
    play.type = 'button'
    play.dataset['tool'] = 'play'
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
    track.dataset['tool'] = 'clock'
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
      door.dataset['tool'] = 'source'
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
      wrote = undefined
      measuredAt = ''
      linesFor = ''
      build(next)
      next.element.tabIndex = 0
      next.describe(options.title)
      // nothing draws: the room holds its frame, dimmed, and the film stands over it
      next.surface('hold')
      // fitted first, so the size fetched is the one the picture stands at
      fit()
      // THE FILM RUNS BY ITSELF when its look opens, as a machine does; its
      // own play control replays it, and starts it where motion is reduced
      load(framing, 0, !next.reducedMotion)
      paint()
    },
    update() {
      if (host) paint()
    },
    layout() {
      if (!host || !video) return
      measuredAt = ''
      linesFor = ''
      fit()
      paint()
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
      said?.remove()
      said = undefined
      root?.remove()
      door?.remove()
      root = undefined; poster = undefined; video = undefined; play = undefined; slider = undefined; door = undefined
      host = undefined
      film = null
      words = null
      frameWidth = 0
    },
    aspect,
    filmBox: () => {
      if (!host || !film) return null
      const box = host.element.getBoundingClientRect()
      return { left: box.left + film.left, top: box.top + film.top, width: film.width, height: film.height }
    },
    filmWords: () => {
      if (!host || !words || !host.cinema?.()) return null
      const box = host.element.getBoundingClientRect()
      return { box: { left: box.left + words.box.left, top: box.top + words.box.top, width: words.box.width, height: words.box.height }, beside: words.beside }
    },
    standing: () => shown || root?.dataset['ready'] === 'true',
    readout: () => ({ framing, rung, time: now(), playing: Boolean(video && !video.paused && !video.ended), ended: Boolean(video?.ended),
      line, poster: root?.dataset['ready'] === 'true', video: shown, film }),
  }
}
