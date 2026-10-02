/* THE FILM behind the seam: the wing as a recording of its own live rail
   (RENDER-GRAPH §7). One still under two videos in one box, all three covered
   the same way, so a still hands over to the same picture; a clip is shown only
   once its first frame is presented, and taken away only after the arrival's
   still is decoded under it. Words never ride the film: the chrome stands over
   this element and reads it through the seam. */

import { route } from '../../../forge/film/router.mjs'
import { samePlace } from '../../../forge/film/same-place.mjs'
import filmCss from './film.css?inline'
import type { FilmCycle } from './cycle'
import {
  PICTURE_ASPECT, lineIsLean, onBox, parsePrint, projectPrint,
  type CameraPrint, type PictureBox, type PictureEvent, type PictureFraming, type PictureMark,
  type PictureGo, type PictureNode, type PictureSource, type PictureState, type PictureWords,
} from './seam'

export const FILM_FORMAT = 'vinci-film-player-v1'

type Pace = 'stroll' | 'walk' | 'brisk'
type Size = string

export interface FilmFile { file: string; bytes: number }

export interface FilmMarkRecord {
  id: string
  /** the mark's centre in the master's own fractions */
  u: number
  v: number
  walks: boolean
  label: string
  word: string
  colour: string
}

/** One work's region at a node, its outline in the master's own fractions */
export interface FilmRegionRecord {
  id: string
  points: [number, number][]
  depth: number
}

export interface FilmNodeRecord {
  kind: 'stop' | 'view'
  station: string
  walkId?: string
  exhibit?: string
  wall?: string
  vertex?: number
  stills: Partial<Record<PictureFraming, Record<Size, FilmFile>>>
  print: Partial<Record<PictureFraming, string>>
  /** the marks in each language, and beside them the regions of the works a press on the picture reaches */
  marks: Partial<Record<PictureFraming, Partial<Record<'en' | 'de', FilmMarkRecord[]>> & { regions?: FilmRegionRecord[] }>>
}

export interface FilmEdgeRecord {
  id: string
  from: PictureNode
  to: PictureNode
  kinds: string[]
  passes: PictureNode[]
  framings: Partial<Record<PictureFraming, {
    seconds: Record<Pace, number>
    frames: number
    files: Record<Size, FilmFile>
    track: string
  }>>
}

/** THE GRAVE'S LOOK UP (`forge/film/graph.mjs` eveningOf): the evening the
    last stop's way on plays, at its own rate, from that stop's still to the
    dark before the lobby. */
export interface FilmEveningRecord {
  id: string
  /** the node whose way on plays it */
  from: PictureNode
  fps: number
  seconds: number
  framings: Partial<Record<PictureFraming, { frames: number; files: Record<Size, FilmFile> }>>
}

/** The evening as the chrome asks for it: nothing of it is a walk, so the
    picture's state stays at rest under it. */
export interface FilmEvening {
  /** the release carries it in the framing shown, and the picture rests where it begins */
  here(): boolean
  /** its bytes fetched while the visitor reads the stop it leaves from */
  ahead(): void
  /** Played once, whole, at its own pace. `widen` is called at the bottom of
      a short dip where the box must grow to the window first. Resolves with
      'ended' after its last frame (the dark), 'cut' when stopped, and 'none'
      when it could not start. */
  play(how?: { widen?: () => void }): Promise<'ended' | 'cut' | 'none'>
  stop(): void
}

export interface FilmRelease {
  format: typeof FILM_FORMAT
  wing: string
  fps: number
  revision: string
  framings: Record<PictureFraming, { master: [number, number]; rungs: [number, number][] }>
  story: PictureNode[]
  /** where the walk begins before its first stop, where the release carries it */
  start?: PictureNode
  /** the chapter cuts, and the doors: a quiet cut, one way and untitled */
  cuts: { from: PictureNode; to: PictureNode; title?: PictureWords; quiet?: true }[]
  opens: [PictureNode, PictureNode][]
  /** each station's set of exhibits, in the order its room holds them */
  sets?: Record<string, string[]>
  /** a machine's filmed cycle by its exhibit, where the release carries one */
  cycles?: Record<string, FilmCycle>
  /** the grave's look up, where the release carries it */
  evening?: FilmEveningRecord
  nodes: Record<PictureNode, FilmNodeRecord>
  edges: FilmEdgeRecord[]
}

export interface FilmOptions {
  /** where the picture's elements stand: under every word of the chrome */
  host: HTMLElement
  /** the release's own folder, ending in a slash */
  base: string
  release: FilmRelease
  at: PictureNode
  framing(): PictureFraming
  /** the picture's box on the page, in CSS pixels */
  box(): PictureBox
  pace(): Pace
  /** how long a chapter's title stands on a dip, in milliseconds */
  hold(title: PictureWords | null): number
  /** the clips a press may walk; a clip refused here stands in the release unplayed */
  walks?(edge: FilmEdgeRecord): boolean
}

/* THE CLIP'S LIFE, in the numbers the design gives it (RENDER-GRAPH §7.3, §7.4) */
/** the dissolve that hides what the codec left at a clip's end */
const END_DISSOLVE_MS = 120
/** still to still, where no clip plays: reduced motion, a clip refused or late */
const STILL_DISSOLVE_MS = 200
/** the longest a gold way waits for its bytes before the stop is reached by a dissolve */
const WAIT_MOST_MS = 3000
/** the dark of a dip, down and up, as the wing's own chapter cut */
const DIP_MS = 450
/** a door's dip stands in the dark this long, as the live door's does */
const QUIET_HOLD_MS = 150
/** a mark held this long under a desktop pointer fetches the start of its clip */
export const LEAN_MS = 150
const LEAN_BYTES = 512 * 1024
/** one pace is rendered, the walk; the others play it at a rate */
const PACE_RATE: Record<Pace, number> = { stroll: 0.667, walk: 1, brisk: 1.5 }
/** the carried pace of a queued press, and its ceiling until phones show more */
const CARRIED = 0.9, RATE_MOST = 2
/** a clip's bytes the page keeps at once; the oldest idle one is let go */
const KEPT_CLIPS = 6
/** THE EVENING'S DIP where the desktop's band gives its strip back to the
    picture, down and up, as the live wing's own (`index.ts` BAND_DOWN, BAND_UP) */
const EVENING_DOWN_MS = 300, EVENING_UP_MS = 600
/** A PHONE TURNED IN MID-WALK: the most the clip laid into the new glass waits
    for its leg in the new framing, from the turn to that clip sought and
    ready, before the leg lands by the dissolve. Half the gold way's wait: here
    a picture already moves, and longer laid it reads as a state, not a turn. */
const TURN_WAIT_MS = 1500
/** the other framing is sought this far ahead of the clip on screen, in the
    walk's own seconds, to cover its seek; doubled and tripled when too short */
const TURN_LEAD_S = 0.25
/** the first frame of a clip set playing comes within a few frames, or never */
const FIRST_FRAME_MOST_MS = 600
/** HOW A CLIP STANDS IN THE OTHER FRAMING'S GLASS until its own framing's
    takes over: whole and centred on the museum's night (film.css). Covering
    it instead crops it to a picture neither framing composed. */
const LAID = 'contain'

type RouterGraph = Parameters<typeof route>[0]
type RouterPlan = ReturnType<typeof route>

const make = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag)
  node.className = cls
  return node
}
const frame = (): Promise<void> => new Promise(resolve => requestAnimationFrame(() => resolve()))
const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))
const within = <T>(promise: Promise<T>, ms: number): Promise<T | null> => Promise.race([promise, sleep(ms).then(() => null)])
const reduced = (): boolean => matchMedia('(prefers-reduced-motion: reduce)').matches

/** the router's own graph, one per framing: the clips this release carries */
function routerGraph(release: FilmRelease, framing: PictureFraming, walks: (edge: FilmEdgeRecord) => boolean = () => true): RouterGraph {
  const nodes = Object.entries(release.nodes).map(([id, n]) => ({ id, ...(n.wall ? { wall: n.wall } : {}) }))
  const edges = release.edges.filter(e => e.framings[framing] && walks(e)).map(e => ({
    id: e.id, from: e.from, to: e.to, kinds: e.kinds, passes: e.passes,
    framings: { [framing]: { seconds: e.framings[framing]!.seconds } },
  }))
  return { nodes, edges, opens: release.opens, cuts: release.cuts, filmPace: 'walk', story: release.story } as unknown as RouterGraph
}

/** the smallest rung that still carries the box's pixels, within a tenth */
function pickRung(rungs: readonly [number, number][], aspect: number, box: PictureBox, lean: boolean): Size {
  const sorted = [...rungs].sort((a, b) => a[0] - b[0])
  if (lean) return sorted[0]!.join('x')
  const across = Math.max(box.width, box.height * aspect) * (devicePixelRatio || 1)
  return (sorted.find(r => r[0] >= across * 0.9) ?? sorted[sorted.length - 1]!).join('x')
}

interface Held { url: string; bytes: number; got: number; blob: Blob | null; head: ArrayBuffer | null; fetching: Promise<Blob | null> | null; abort: AbortController | null; used: number }

/** THE CLIP ON SCREEN. After a turn in mid-walk its element, bytes, framing
    and track are the other framing's, and the leg's end is watched there. */
interface Playing {
  video: HTMLVideoElement
  edge: FilmEdgeRecord
  track: CameraPrint[] | null
  frame: number
  framing: PictureFraming
  /** the bytes' address, let go when the clip leaves */
  src: string
  /** its first frame presented: a turn may begin */
  shown: boolean
  /** laid into the glass of the other framing (LAID) */
  laid: boolean
  /** crossed to on a turn: its share is held from running back */
  turned: boolean
  /** a cross under way, which a second turn waits for */
  crossing: boolean
  /** each turn and each undoing of one counts up; a turn under way that sees another number stands down */
  turning: number
  /** where the leg's end is watched; null once the leg has ended */
  watch: ((video: HTMLVideoElement) => void) | null
  /** ends the leg now: it lands at the arrival's still by the dissolve */
  land: (() => void) | null
}

export function createFilmSource(options: FilmOptions): PictureSource & { readout(): Record<string, unknown>[]; evening: FilmEvening } {
  const { release, host, base } = options
  const graphs: Partial<Record<PictureFraming, RouterGraph>> = {}
  const graphOf = (f: PictureFraming): RouterGraph => (graphs[f] ??= routerGraph(release, f, options.walks))
  const edgeById = new Map(release.edges.map(e => [e.id, e]))

  /* THE ELEMENTS: one still, the cross-fade over it, two videos, the dark and
     the hairline. Nothing else ever stands in the picture's own box. */
  const root = make('div', 'na-film')
  root.setAttribute('aria-hidden', 'true')
  const style = make('style', '')
  style.textContent = filmCss
  const still = make('img', 'na-film-still')
  still.alt = ''
  still.decoding = 'sync'
  const cross = make('img', 'na-film-cross')
  cross.alt = ''
  const videos = [make('video', 'na-film-clip'), make('video', 'na-film-clip')]
  for (const video of videos) {
    video.muted = true
    video.playsInline = true
    video.preload = 'none'
    video.disablePictureInPicture = true
    video.setAttribute('disableremoteplayback', '')
    video.setAttribute('playsinline', '')
    video.setAttribute('muted', '')
  }
  const nightfall = make('video', 'na-film-evening')
  nightfall.muted = true
  nightfall.playsInline = true
  nightfall.preload = 'none'
  nightfall.disablePictureInPicture = true
  for (const name of ['disableremoteplayback', 'playsinline', 'muted']) nightfall.setAttribute(name, '')
  const dark = make('div', 'na-film-dark')
  const wait = make('div', 'na-film-wait')
  const waitFill = make('span', 'na-film-wait-fill')
  wait.append(waitFill)
  root.append(still, cross, ...videos, nightfall, dark, wait)
  host.prepend(style, root)

  let here: PictureNode = release.nodes[options.at] ? options.at : release.story.find(n => release.nodes[n]) ?? Object.keys(release.nodes)[0]!
  let state: PictureState = { kind: 'rest', node: here }
  let shownFraming: PictureFraming = options.framing()
  /** the node whose still stands in the still element, and in the cross-fade over it */
  let stillAt: PictureNode = here
  let crossAt: PictureNode = here
  let busy = false
  /* the rest a leg ends on is told while the leg still counts as busy, so the
     gold way's next clip asked for then is fetched once the leg is done */
  let aheadLater: readonly PictureNode[] | null = null
  let queued: { node: PictureNode; fade: boolean; resolve: ((n: PictureNode) => void)[] } | null = null
  let carried = 0
  let hurried = false
  let disposed = false
  let playing: Playing | null = null
  let dipSkip: (() => void) | null = null
  /** every hand-over as it happened, for the rigs: how long a press waited for its first
      frame, which frame was on screen when the clip was shown, how the end was handed back */
  const readouts: Record<string, unknown>[] = []
  /** THE NEXT VIDEO, ARMED: the gold way's clip on the idle element while the visitor
      reads, so its decoder is running before the press */
  let armed: { url: string; objectUrl: string; video: HTMLVideoElement } | null = null
  function arm(url: string, blob: Blob): void {
    if (busy || playing) return
    if (armed?.url === url) return
    disarm()
    const video = idleVideo()
    const objectUrl = URL.createObjectURL(blob)
    video.preload = 'auto'
    video.src = objectUrl
    video.dataset['src'] = objectUrl
    video.load()
    armed = { url, objectUrl, video }
  }
  function disarm(): void {
    if (!armed) return
    if (playing?.video !== armed.video) { tearDown(armed.video); URL.revokeObjectURL(armed.objectUrl) }
    armed = null
  }
  const listeners = new Map<PictureEvent, Set<(s: PictureState) => void>>()
  const held = new Map<string, Held>()
  const tracks = new Map<string, Promise<CameraPrint[] | null>>()
  let firstPicture: Promise<void>

  function emit(event: PictureEvent): void {
    for (const fn of listeners.get(event) ?? []) fn(state)
    if (event !== 'state') for (const fn of listeners.get('state') ?? []) fn(state)
  }
  function set(next: PictureState, event: PictureEvent = 'state'): void {
    state = next
    root.dataset['state'] = next.kind
    emit(event)
  }

  /* ---- the box ---- */
  let boxKey = ''
  function fit(): PictureBox {
    const b = options.box()
    const key = `${b.left},${b.top},${b.width},${b.height}`
    if (key !== boxKey) {
      boxKey = key
      root.style.left = `${b.left}px`
      root.style.top = `${b.top}px`
      root.style.width = `${b.width}px`
      root.style.height = `${b.height}px`
    }
    return b
  }

  /* ---- files ---- */
  const address = (file: string): string => new URL(file, base).href
  const framingOf = (): PictureFraming => options.framing()
  const lean = (): boolean => lineIsLean()
  const rungNow = (f: PictureFraming): Size =>
    pickRung(release.framings[f].rungs, PICTURE_ASPECT[f], fit(), lean())

  function stillFile(node: PictureNode, f: PictureFraming): string | null {
    const stills = release.nodes[node]?.stills[f]
    if (!stills) return null
    const want = rungNow(f)
    const file = stills[want] ?? Object.values(stills)[0]
    return file ? address(file.file) : null
  }
  /** a still decoded off the page, so a swap to it paints the same frame */
  const decoded = new Map<string, Promise<void>>()
  function decode(url: string): Promise<void> {
    let held = decoded.get(url)
    if (!held) {
      const img = new Image()
      img.decoding = 'async'
      img.src = url
      held = img.decode().catch(() => undefined)
      decoded.set(url, held)
    }
    return held
  }
  async function showStill(node: PictureNode, f = framingOf()): Promise<void> {
    const url = stillFile(node, f)
    if (!url) return
    await decode(url)
    if (still.src !== url) {
      still.src = url
      stillAt = node
      await still.decode().catch(() => undefined)
    }
    shownFraming = f
  }

  function clipFile(edge: FilmEdgeRecord, f: PictureFraming): { url: string; bytes: number } | null {
    const at = edge.framings[f]
    if (!at) return null
    const want = rungNow(f)
    const file = at.files[want] ?? Object.values(at.files)[0]
    return file ? { url: address(file.file), bytes: file.bytes } : null
  }
  function trackOf(edge: FilmEdgeRecord, f: PictureFraming): Promise<CameraPrint[] | null> {
    const at = edge.framings[f]
    // a clip not yet rendered is answered by its stills and has no track to fetch
    if (!at?.track) return Promise.resolve(null)
    const url = address(at.track)
    let held = tracks.get(url)
    if (!held) {
      held = fetch(url).then(r => (r.ok ? r.json() : null)).then((list: string[] | null) =>
        list ? list.map(p => parsePrint(p)).filter((p): p is CameraPrint => p !== null) : null).catch(() => null)
      tracks.set(url, held)
    }
    return held
  }

  /* ---- bytes ahead ---- */
  function keep(url: string, bytes: number): Held {
    let h = held.get(url)
    if (!h) {
      h = { url, bytes, got: 0, blob: null, head: null, fetching: null, abort: null, used: performance.now() }
      held.set(url, h)
      // the oldest clip nobody is playing or fetching is let go
      if (held.size > KEPT_CLIPS) {
        const idle = [...held.values()].filter(x => x !== h && !x.fetching && x.url !== playing?.video.dataset['src'])
          .sort((a, b) => a.used - b.used)[0]
        if (idle) held.delete(idle.url)
      }
    }
    h.used = performance.now()
    return h
  }
  /** the whole clip as bytes in a Blob: iOS may ignore a video's preload */
  function fetchWhole(url: string, bytes: number): Promise<Blob | null> {
    const h = keep(url, bytes)
    if (h.blob) return Promise.resolve(h.blob)
    if (h.fetching) return h.fetching
    const abort = new AbortController()
    h.abort = abort
    const from = h.head ? h.head.byteLength : 0
    h.got = from
    h.fetching = fetch(url, from ? { headers: { Range: `bytes=${from}-` }, signal: abort.signal } : { signal: abort.signal })
      .then(async r => {
        if (!r.ok || !r.body) return null
        // a server that ignores the range answers with the whole file
        const parts: BlobPart[] = r.status === 206 && h.head ? [h.head] : []
        if (!parts.length) h.got = 0
        const reader = r.body.getReader()
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          parts.push(value)
          h.got += value.byteLength
        }
        const whole = new Blob(parts, { type: 'video/mp4' })
        h.blob = whole
        h.head = null
        return whole
      })
      .catch(() => null)
      .finally(() => { h.fetching = null; h.abort = null })
    return h.fetching
  }
  /** the first bytes of a clip, where a hand rests on its way */
  function fetchHead(url: string, bytes: number): void {
    const h = keep(url, bytes)
    if (h.blob || h.head || h.fetching) return
    const abort = new AbortController()
    h.abort = abort
    h.fetching = fetch(url, { headers: { Range: `bytes=0-${LEAN_BYTES - 1}` }, signal: abort.signal })
      .then(async r => {
        if (r.status === 206) { h.head = await r.arrayBuffer(); h.got = h.head.byteLength }
        else if (r.ok) { h.blob = new Blob([await r.arrayBuffer()], { type: 'video/mp4' }); h.got = h.bytes }
        return h.blob
      })
      .catch(() => null)
      .finally(() => { h.fetching = null; h.abort = null })
  }
  /** the first clip of the way from here to a node, in this framing */
  function firstClip(to: PictureNode, f: PictureFraming): FilmEdgeRecord | null {
    let plan: RouterPlan
    try { plan = route(graphOf(f), here, to, { framing: f, pace: 'walk' }) } catch { return null }
    if (plan.type !== 'walk') return null
    const first = plan.steps.find((s): s is { clip: string; seconds: number } => 'clip' in s)
    return first ? edgeById.get(first.clip) ?? null : null
  }

  /* ---- the clip ---- */
  const rate = (): number => Math.min(RATE_MOST, PACE_RATE[options.pace()] * (1 + CARRIED * (carried + (hurried ? 1 : 0))))
  const idleVideo = (): HTMLVideoElement => videos.find(v => v !== playing?.video) ?? videos[0]!
  function tearDown(video: HTMLVideoElement): void {
    video.pause()
    video.removeAttribute('src')
    delete video.dataset['src']
    delete video.dataset['laid']
    video.load()
    video.classList.remove('shown', 'leaving', 'crossing')
  }
  /** THE VIDEO IS SHOWN ONLY ONCE ITS FIRST FRAME IS PRESENTED, so the still
      hands over to the same picture: the frame callback where the engine has
      one, else `playing` and one animation frame. */
  function firstFrame(video: HTMLVideoElement): Promise<void> {
    const withCallback = video as HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number }
    if (withCallback.requestVideoFrameCallback) return new Promise(resolve => withCallback.requestVideoFrameCallback!(() => resolve()))
    return new Promise(resolve => {
      const go = (): void => { requestAnimationFrame(() => resolve()) }
      if (!video.paused && video.readyState >= 3) go()
      else video.addEventListener('playing', go, { once: true })
    })
  }
  /** the frame of the clip on screen now, counted from the departure still */
  function watchFrames(video: HTMLVideoElement): void {
    const withCallback = video as HTMLVideoElement & { requestVideoFrameCallback?: (cb: (now: number, meta: { mediaTime: number }) => void) => number }
    if (!withCallback.requestVideoFrameCallback) return
    const tick = (_now: number, meta: { mediaTime: number }): void => {
      if (!playing || playing.video !== video) return
      playing.frame = Math.round(meta.mediaTime * release.fps)
      withCallback.requestVideoFrameCallback!(tick)
    }
    withCallback.requestVideoFrameCallback(tick)
  }

  /** the bytes of a clip in time, or null: at most three seconds under the hairline */
  async function bytesInTime(edge: FilmEdgeRecord, f: PictureFraming, target: PictureNode): Promise<string | null> {
    const file = clipFile(edge, f)
    if (!file) return null
    // the armed element already holds these bytes and is decoding them
    if (armed?.url === file.url) { const src = armed.objectUrl; armed = null; return src }
    disarm()
    const h = held.get(file.url)
    if (h?.blob) return URL.createObjectURL(h.blob)
    set({ kind: 'wait', from: edge.from, to: edge.to, target, clip: edge.id, share: 0 }, 'wait')
    wait.classList.add('shown')
    /* THE MEASURE IS COUNTED, NEVER TIMED: it is the bytes that have arrived
       against the bytes the clip needs, and it never runs backwards */
    let timer = 0, shown = 0
    const video = idleVideo()
    const measure = (): void => {
      const now = held.get(file.url)
      let share = now ? now.got / Math.max(1, now.bytes) : 0
      if (video.dataset['src'] === file.url && video.duration > 0 && video.buffered.length)
        share = Math.max(share, video.buffered.end(video.buffered.length - 1) / video.duration)
      shown = Math.max(shown, Math.min(1, share))
      waitFill.style.transform = `scaleX(${shown.toFixed(3)})`
      if (state.kind === 'wait') state = { ...state, share: shown }
      timer = requestAnimationFrame(measure)
    }
    measure()
    try {
      if (lean()) {
        // nothing is fetched ahead on a lean line: the video is asked for as
        // it plays, and the browser's own measure says whether it plays through
        video.preload = 'auto'
        video.src = file.url
        video.dataset['src'] = file.url
        video.load()
        const through = await Promise.race([
          new Promise<boolean>(resolve => video.addEventListener('canplaythrough', () => resolve(true), { once: true })),
          sleep(WAIT_MOST_MS).then(() => false),
        ])
        return through ? file.url : null
      }
      const blob = await Promise.race([fetchWhole(file.url, file.bytes), sleep(WAIT_MOST_MS).then(() => null)])
      if (!blob) { held.get(file.url)?.abort?.abort(); return null }
      return URL.createObjectURL(blob)
    } finally {
      cancelAnimationFrame(timer)
      wait.classList.remove('shown')
      waitFill.style.transform = 'scaleX(0)'
    }
  }

  /** ONE CLIP FROM PRESS TO REST. False when it could not play: the caller
      then reaches its stop by a dissolve. */
  async function playClip(edge: FilmEdgeRecord, target: PictureNode): Promise<boolean> {
    const pressed = performance.now()
    let f = framingOf()
    if (f !== shownFraming) await showStill(edge.from, f)
    let arrival = stillFile(edge.to, f)
    let arrived = arrival ? decode(arrival) : Promise.resolve()
    let src = await bytesInTime(edge, f, target)
    // A PHONE TURNED WHILE THE BYTES CAME waits once more, for its own framing's
    if (src && !disposed && framingOf() !== f) {
      for (const v of videos) if (v.dataset['src'] === src) tearDown(v)
      if (src.startsWith('blob:')) URL.revokeObjectURL(src)
      f = framingOf()
      if (f !== shownFraming) await showStill(edge.from, f)
      arrival = stillFile(edge.to, f)
      arrived = arrival ? decode(arrival) : Promise.resolve()
      src = await bytesInTime(edge, f, target)
    }
    if (!src || disposed) return false
    /* THE PRESS IS ANSWERED AT ONCE: the walk begins for the chrome now, and the
       picture moves when the clip's first frame is presented over its own still */
    set({ kind: 'walk', from: edge.from, to: edge.to, target, clip: edge.id, share: 0 }, 'depart')
    const video = [...videos].find(v => v.dataset['src'] === src) ?? idleVideo()
    if (video.src !== src) {
      video.preload = 'auto'
      video.src = src
      video.dataset['src'] = src
    }
    video.playbackRate = rate()
    const track = trackOf(edge, f)
    try {
      await video.play()
    } catch {
      tearDown(video)
      if (src.startsWith('blob:')) URL.revokeObjectURL(src)
      return false
    }
    const p: Playing = { video, edge, track: null, frame: 0, framing: f, src, shown: false, laid: false, turned: false, crossing: false, turning: 0, watch: null, land: null }
    playing = p
    void track.then(list => { if (playing === p && p.framing === f) p.track = list })
    watchFrames(video)
    await firstFrame(video)
    video.classList.add('shown')
    p.shown = true
    set({ kind: 'walk', from: edge.from, to: edge.to, target, clip: edge.id, share: 0 })
    const record: Record<string, unknown> = { clip: edge.id, framing: f, rung: rungNow(f), src: src.startsWith('blob:') ? 'bytes' : 'network',
      pressToShownMs: Math.round(performance.now() - pressed), shownAtMediaTime: Math.round(video.currentTime * 1000) / 1000,
      stillUnder: still.currentSrc.replace(/^.*\//, '') }
    readouts.push(record)
    await new Promise<void>(resolve => {
      let off = (): void => undefined
      // the end is watched on the clip on screen, which a turn may hand to the other framing's
      p.watch = (v: HTMLVideoElement): void => {
        off()
        // a clip that never says it ended is ended by its own length, and a little air
        const bound = setTimeout(() => done(), ((v.duration || 30) / Math.max(0.25, v.playbackRate) + 3) * 1000)
        const done = (): void => { off(); resolve() }
        v.addEventListener('ended', done)
        off = () => { clearTimeout(bound); v.removeEventListener('ended', done) }
      }
      p.land = () => { off(); resolve() }
      p.watch(video)
    })
    p.watch = p.land = null
    const shown = p.video
    /* THE CUT AT THE STOP IS INVISIBLE: the arrival's still is decoded and
       swapped in under the clip's last frame, and the clip only leaves on the
       frame after, dissolving over what the codec left */
    const ended = performance.now()
    record['endedAtMediaTime'] = Math.round(shown.currentTime * 1000) / 1000
    record['duration'] = Math.round(shown.duration * 1000) / 1000
    if (p.laid) {
      // A LEG LANDING IN A TURNED GLASS: the arrival in the framing that stands now, the laid clip dissolving over it
      const g = framingOf(), there = stillFile(edge.to, g)
      if (there) {
        await decode(there)
        still.src = there
        stillAt = edge.to
        await still.decode().catch(() => undefined)
      }
      shownFraming = g
    } else {
      // a clip crossed to on a turn arrives at its own framing's still
      if (p.framing !== f) { arrival = stillFile(edge.to, p.framing); arrived = arrival ? decode(arrival) : Promise.resolve() }
      await arrived
      if (arrival && still.src !== arrival) {
        still.src = arrival
        stillAt = edge.to
        await still.decode().catch(() => undefined)
      }
      shownFraming = p.framing
    }
    await frame()
    record['endToDissolveMs'] = Math.round(performance.now() - ended)
    const quality = (shown as HTMLVideoElement & { getVideoPlaybackQuality?: () => { droppedVideoFrames: number; totalVideoFrames: number } }).getVideoPlaybackQuality?.()
    if (quality) record['dropped'] = `${quality.droppedVideoFrames} of ${quality.totalVideoFrames}`
    shown.classList.add('leaving')
    await sleep((p.laid ? STILL_DISSOLVE_MS : END_DISSOLVE_MS) + 20)
    tearDown(shown)
    if (p.src.startsWith('blob:')) URL.revokeObjectURL(p.src)
    if (playing === p) playing = null
    here = edge.to
    return true
  }

  /** still to still, the picture never dark: reduced motion and a late clip */
  async function dissolveTo(node: PictureNode): Promise<void> {
    let f = framingOf()
    let url = stillFile(node, f)
    if (!url) { here = node; return }
    await decode(url)
    cross.src = url
    crossAt = node
    await cross.decode().catch(() => undefined)
    cross.classList.add('shown')
    await sleep(STILL_DISSOLVE_MS + 20)
    // a phone turned during the dissolve lands in the framing it holds now
    if (framingOf() !== f) {
      const now = stillFile(node, framingOf())
      if (now) { await decode(now); f = framingOf(); url = now }
    }
    still.src = url
    stillAt = node
    await still.decode().catch(() => undefined)
    cross.classList.remove('shown')
    cross.removeAttribute('src')
    // the framing dissolved to, so a phone turned meanwhile is picked again
    shownFraming = f
    here = node
  }

  /* ---- a phone turned in mid-walk ---- */
  const frameOf = (video: HTMLVideoElement): number => Math.round(video.currentTime * release.fps)
  const shareOf = (video: HTMLVideoElement): number => (video.duration > 0 ? Math.min(1, video.currentTime / video.duration) : 0)
  function loaded(video: HTMLVideoElement): Promise<boolean> {
    if (video.readyState >= 1) return Promise.resolve(true)
    return new Promise(resolve => {
      video.addEventListener('loadedmetadata', () => resolve(true), { once: true })
      video.addEventListener('error', () => resolve(false), { once: true })
    })
  }
  /** THE OTHER FRAMING'S CLIP MADE READY TO CROSS TO: its bytes loaded, sought
      to the place `place` gives for a moment a little ahead of the clip on
      screen, set playing at its rate once that clip reaches the moment, and
      its first frame presented. */
  async function readyAt(video: HTMLVideoElement, old: HTMLVideoElement, src: string, place: (oldTime: number) => number | null,
    left: () => number, stale: () => boolean): Promise<'ok' | 'late' | 'no shared place' | 'stale'> {
    video.preload = 'auto'
    video.src = src
    video.dataset['src'] = src
    video.load()
    if (!(await within(loaded(video), left())) || !(video.duration > 0)) return stale() ? 'stale' : 'late'
    for (let tries = 1; ; tries++) {
      if (stale()) return 'stale'
      const lead = TURN_LEAD_S * tries * old.playbackRate
      const at = old.currentTime + lead
      // the clip on screen arrives before the other could take over
      if (!(old.duration > 0) || at > old.duration - lead) return 'late'
      const t = place(at)
      if (t === null) return 'no shared place'
      const sought = new Promise<boolean>(resolve => video.addEventListener('seeked', () => resolve(true), { once: true }))
      video.currentTime = Math.max(0, Math.min(t, video.duration - 0.1))
      if (!(await within(sought, left()))) return stale() ? 'stale' : 'late'
      // the moment is waited for on screen; a seek that took longer than the lead is tried once more, further ahead
      if (old.currentTime <= at || tries === 3) {
        while (!stale() && !old.ended && old.currentTime < at) await frame()
        break
      }
    }
    if (stale()) return 'stale'
    video.playbackRate = old.playbackRate
    try { await video.play() } catch { return stale() ? 'stale' : 'late' }
    if ((await within(firstFrame(video).then(() => true), FIRST_FRAME_MOST_MS)) === null) return stale() ? 'stale' : 'late'
    return stale() ? 'stale' : 'ok'
  }
  /** A PHONE TURNED IN MID-WALK. At once the clip on screen is laid whole into
      the new glass; then the same leg in the new framing is fetched, sought to
      the same place on the way (`same-place.mjs`) and crossed to, and the walk
      goes on to its arrival in the new framing. What is not ready within
      TURN_WAIT_MS, a leg with no shared place, a lean line and reduced motion
      land at the arrival's still in the new framing by the dissolve. */
  async function turnWalk(p: Playing, to: PictureFraming): Promise<void> {
    const seq = ++p.turning
    const turned = performance.now()
    const from = p.framing, old = p.video
    const record: Record<string, unknown> = { turn: `${from}>${to}`, clip: p.edge.id, atShare: Math.round(shareOf(old) * 1000) / 1000, atFrame: frameOf(old) }
    readouts.push(record)
    old.dataset['laid'] = LAID
    p.laid = true
    const stale = (): boolean => disposed || playing !== p || p.turning !== seq || !p.watch
    const land = (why: string): void => {
      record['landed'] = 'dissolve'
      record['why'] = why
      record['ms'] = Math.round(performance.now() - turned)
      if (!stale()) p.land?.()
    }
    const file = clipFile(p.edge, to)
    if (!file) { land('no clip in this framing'); return }
    if (lean()) { land('lean line'); return }
    if (reduced()) { land('reduced motion'); return }
    const left = (): number => Math.max(0, turned + TURN_WAIT_MS - performance.now())
    const blob = await within(fetchWhole(file.url, file.bytes), left())
    if (stale()) return
    if (!blob) { land('bytes late'); return }
    const tracks = await within(Promise.all([trackOf(p.edge, from), trackOf(p.edge, to)]), left())
    if (stale()) return
    const video = idleVideo()
    const src = URL.createObjectURL(blob)
    // the clip crossed to stands over the one it replaces
    old.after(video)
    const place = (oldTime: number): number | null => {
      const [a, b] = tracks ?? [null, null]
      if (!a || !b) return (oldTime / old.duration) * video.duration
      const m = samePlace(a, oldTime * release.fps, b)
      if (m) { record['eye'] = Math.round(m.eye * 100) / 100; record['look'] = Math.round((m.look * 180) / Math.PI) }
      return m ? (m.frame + 0.5) / release.fps : null
    }
    const ready = await readyAt(video, old, src, place, left, stale)
    if (ready !== 'ok') {
      tearDown(video)
      URL.revokeObjectURL(src)
      if (ready !== 'stale') land(ready)
      return
    }
    /* THE CROSS: the same walk in the new framing dissolves in over the laid
       clip, and from its first frame it is the walk */
    video.classList.add('crossing', 'shown')
    const oldSrc = p.src
    Object.assign(p, { video, src, framing: to, laid: false, turned: true, crossing: true, track: tracks?.[1] ?? null, frame: frameOf(video) })
    shownFraming = to
    p.watch?.(video)
    watchFrames(video)
    Object.assign(record, { landed: 'cross', ms: Math.round(performance.now() - turned), fromFrame: frameOf(old), toFrame: frameOf(video) })
    await sleep(STILL_DISSOLVE_MS + 20)
    tearDown(old)
    if (oldSrc.startsWith('blob:')) URL.revokeObjectURL(oldSrc)
    video.classList.remove('crossing')
    p.crossing = false
  }
  /** a turn undone before its cross: the clip on screen is its own framing's again */
  function unlay(p: Playing): void {
    p.turning++
    p.laid = false
    delete p.video.dataset['laid']
  }
  let restilling = false
  /** BETWEEN CLIPS a turned phone's still is picked again at once: under a
      wait, a dip, a dissolve or the moment at a middle node */
  async function restill(f: PictureFraming): Promise<void> {
    const node = stillAt, over = cross.hasAttribute('src') ? crossAt : null
    const url = stillFile(node, f), overUrl = over ? stillFile(over, f) : null
    if (!url) return
    restilling = true
    try {
      await Promise.all([decode(url), overUrl ? decode(overUrl) : undefined])
      if (disposed || playing || framingOf() !== f) return
      // the dissolve's still coming in, then the one under it; a still the walk laid meanwhile is its own
      if (overUrl && crossAt === over && cross.hasAttribute('src')) cross.src = overUrl
      if (stillAt !== node) return
      still.src = url
      await still.decode().catch(() => undefined)
      shownFraming = f
    } finally {
      restilling = false
    }
  }
  /** what a turn asks of a walk under way; nothing at all where the phone kept its framing */
  function turnedInWalk(): void {
    const want = framingOf()
    if (duskWatch) { turnedInEvening(want); return }
    const p = playing
    if (p) {
      if (!p.shown || !p.watch || p.crossing) return
      if (p.laid && want === p.framing) unlay(p)
      else if (!p.laid && want !== p.framing) void turnWalk(p, want)
      return
    }
    if (want !== shownFraming && !restilling) void restill(want)
  }

  /** THE JUMP: down to the museum's dark, the place it goes to named where a
      chapter's title stands, and that place's still up again */
  async function dip(node: PictureNode, title: PictureWords | null, quiet = false): Promise<void> {
    set({ kind: 'dip', from: here, to: node, title, ...(quiet ? { quiet: true as const } : {}) }, 'dip')
    dark.classList.add('shown')
    let f = framingOf()
    let url = stillFile(node, f)
    await Promise.all([sleep(reduced() ? 0 : DIP_MS), url ? decode(url) : Promise.resolve()])
    // A PHONE TURNED IN THE DARK comes up in the framing it holds now
    if (framingOf() !== f) {
      f = framingOf()
      url = stillFile(node, f)
      if (url) await decode(url)
    }
    if (url) { still.src = url; stillAt = node; await still.decode().catch(() => undefined) }
    shownFraming = f
    here = node
    await Promise.race([sleep(quiet ? QUIET_HOLD_MS : options.hold(title)), new Promise<void>(resolve => { dipSkip = resolve })])
    dipSkip = null
    // and one turned while the title stood, under the dark still
    if (framingOf() !== shownFraming) await showStill(node)
    dark.classList.remove('shown')
    await sleep(reduced() ? 0 : DIP_MS)
  }

  async function walkPlan(plan: Extract<RouterPlan, { type: 'walk' }>, target: PictureNode): Promise<void> {
    if (reduced()) {
      // where the plan leaves the body: the last clip's end, or the room a door's dip after it opens on
      let landed: PictureNode | undefined
      for (const s of plan.steps) {
        if ('clip' in s) landed = edgeById.get(s.clip)?.to ?? landed
        else if ('dip' in s) landed = s.dip
      }
      await dissolveTo(landed ?? target)
      return
    }
    for (const step of plan.steps) {
      if (disposed) return
      // THROUGH A DOOR: the dark between the walk up to it and the walk on
      if ('dip' in step) { await dip(step.dip, step.title ?? null, step.quiet === true); continue }
      if ('wait' in step) {
        // A MOMENT AT THE MIDDLE NODE, as a walker stops: still a walk, so no mark comes and goes
        await sleep((step.wait * 1000) / rate())
        continue
      }
      if (!('clip' in step)) continue
      const edge = edgeById.get(step.clip)
      if (!edge) continue
      // the next clip of a chain is fetched while this one plays
      const ok = await playClip(edge, target)
      if (!ok) await dissolveTo(edge.to)
    }
  }

  async function goNow(node: PictureNode, fade = false): Promise<PictureNode> {
    const f = framingOf()
    // A FADE WALKS NOTHING: down to the dark, the place stood, up again
    if (fade && node !== here) {
      if (!release.nodes[node]?.stills[f]) return here
      await dip(node, null, true)
      set({ kind: 'rest', node: here }, 'rest')
      return here
    }
    let plan: RouterPlan
    try {
      plan = route(graphOf(f), here, node, { framing: f, pace: 'walk' })
    } catch {
      // a node this release does not carry is not a place the film can stand
      return here
    }
    // ONE EYE, TWO COMPOSITIONS: a stop asked for at its own work's eye stands by the dissolve
    if (plan.type === 'open' && node !== here && release.nodes[node]?.kind === 'stop' && release.nodes[node]?.stills[f]) {
      await dissolveTo(node)
      set({ kind: 'rest', node: here }, 'rest')
      return here
    }
    if (plan.type === 'here' || plan.type === 'open') return here
    if (plan.type === 'dip') {
      if (!release.nodes[node]?.stills[f]) return here
      const step = plan.steps[0] as { title?: PictureWords; quiet?: true } | undefined
      // a work reached by the dark, with no chapter to name, is reached as a door is: quiet and short
      await dip(node, step?.title ?? null, step?.quiet === true || (!step?.title && release.nodes[node]?.kind === 'view'))
    } else {
      // the chain's second clip, fetched while the first plays
      const clips = plan.steps.filter((s): s is { clip: string; seconds: number } => 'clip' in s)
      for (const s of clips.slice(1)) {
        const e = edgeById.get(s.clip), file = e ? clipFile(e, f) : null
        if (file && !lean()) void fetchWhole(file.url, file.bytes)
      }
      await walkPlan(plan, node)
    }
    set({ kind: 'rest', node: here }, 'rest')
    return here
  }

  async function go(node: PictureNode, how: PictureGo = {}): Promise<PictureNode> {
    const fade = how.fade === true
    if (busy) {
      /* A PRESS WHILE WALKING queues one target, as the rail's one pending slot
         does, and carries the pace up while it waits */
      return new Promise(resolve => {
        if (queued && queued.node === node) queued.resolve.push(resolve)
        else {
          for (const r of queued?.resolve ?? []) r(here)
          queued = { node, fade, resolve: [resolve] }
        }
        // only a press while the picture moves carries its pace: one that
        // lands while the bytes are still on their way hurries nothing
        if (state.kind !== 'wait') carried = 1
        if (playing) playing.video.playbackRate = rate()
      })
    }
    busy = true
    let at = here
    try {
      at = await goNow(node, fade)
    } finally {
      busy = false
      carried = 0
      hurried = false
    }
    const next = queued
    queued = null
    if (next && !disposed) {
      const landed = await go(next.node, { fade: next.fade })
      for (const r of next.resolve) r(landed)
    } else if (aheadLater && !disposed) {
      const nodes = aheadLater
      aheadLater = null
      fetchAhead(nodes)
    }
    return at
  }

  function fetchAhead(nodes: readonly PictureNode[]): void {
    if (lean()) return
    const f = framingOf()
    for (const node of nodes.slice(0, 2)) {
      const edge = firstClip(node, f)
      const file = edge ? clipFile(edge, f) : null
      if (file) void fetchWhole(file.url, file.bytes).then(blob => { if (blob && node === nodes[0]) arm(file.url, blob) })
      const arrival = edge ? stillFile(edge.to, f) : null
      if (arrival) void decode(arrival)
      if (edge) void trackOf(edge, f)
    }
  }

  firstPicture = showStill(here).then(() => { fit(); set({ kind: 'rest', node: here }, 'rest') })

  /* ---- the grave's look up ---- */
  function eveningFile(): { url: string; bytes: number } | null {
    const at = release.evening?.framings[framingOf()]
    if (!at) return null
    const file = at.files[rungNow(framingOf())] ?? Object.values(at.files)[0]
    return file ? { url: address(file.file), bytes: file.bytes } : null
  }
  let eveningDone: (() => void) | null = null
  let eveningCut = false
  let eveningSrc = ''
  /** THE EVENING ON SCREEN: its own element, or after a turn the idle clip
      element holding its other framing; where its end is watched while it plays */
  let dusk = nightfall
  let duskFraming: PictureFraming = shownFraming
  let duskWatch: ((video: HTMLVideoElement) => void) | null = null
  let duskTurning = 0
  let duskLaid = false
  let duskCrossing = false
  /** A PHONE TURNED WHILE THE EVENING PLAYS: laid at once as a walk's clip is,
      then crossed to its other framing at the same moment, both framings
      rendered on one clock. Its end is the dark every glass holds alike, so
      the evening waits for those bytes as long as it plays, laid; a lean line
      fetches nothing and plays it out laid. */
  async function turnEvening(to: PictureFraming): Promise<void> {
    const seq = ++duskTurning
    const turned = performance.now()
    const from = duskFraming, old = dusk
    const record: Record<string, unknown> = { turn: `${from}>${to}`, evening: release.evening?.id, atMediaTime: Math.round(old.currentTime * 1000) / 1000 }
    readouts.push(record)
    old.dataset['laid'] = LAID
    duskLaid = true
    const stale = (): boolean => disposed || eveningCut || !duskWatch || duskTurning !== seq || dusk !== old
    const at = release.evening?.framings[to], was = release.evening?.framings[from]
    const file = at ? at.files[rungNow(to)] ?? Object.values(at.files)[0] : undefined
    if (!file || lean()) { record['landed'] = 'laid to its end'; return }
    const url = address(file.file)
    // until a second before its end, past which the cross would come with the dark
    const left = (): number => Math.max(0, ((old.duration || 0) - old.currentTime) * 1000 / Math.max(0.25, old.playbackRate) - 1000)
    const blob = await within(fetchWhole(url, file.bytes), left())
    if (stale()) return
    if (!blob) { record['landed'] = 'laid to its end'; record['why'] = 'bytes late'; return }
    disarm()
    const video = [nightfall, ...videos].find(v => v !== dusk)!
    const src = URL.createObjectURL(blob)
    old.after(video)
    const place = (oldTime: number): number => (at && was && at.frames === was.frames ? oldTime : (oldTime / old.duration) * video.duration)
    const ready = await readyAt(video, old, src, place, left, stale)
    if (ready !== 'ok') {
      tearDown(video)
      URL.revokeObjectURL(src)
      if (ready !== 'stale') { record['landed'] = 'laid to its end'; record['why'] = ready }
      return
    }
    video.classList.add('crossing', 'shown')
    duskCrossing = true
    dusk = video
    duskFraming = to
    duskLaid = false
    duskWatch?.(video)
    Object.assign(record, { landed: 'cross', ms: Math.round(performance.now() - turned) })
    const oldSrc = eveningSrc
    eveningSrc = src
    await sleep(STILL_DISSOLVE_MS + 20)
    tearDown(old)
    if (oldSrc && oldSrc !== src) URL.revokeObjectURL(oldSrc)
    video.classList.remove('crossing')
    duskCrossing = false
  }
  function turnedInEvening(want: PictureFraming): void {
    if (duskCrossing) return
    if (duskLaid && want === duskFraming) {
      duskTurning++
      duskLaid = false
      delete dusk.dataset['laid']
    } else if (!duskLaid && want !== duskFraming) void turnEvening(want)
  }
  /** the evening's bytes in hand, or its address where the line is lean and it
      plays through in time; three seconds at most under the hairline, counted */
  async function eveningBytes(file: { url: string; bytes: number }): Promise<string | null> {
    const h = held.get(file.url)
    if (h?.blob) return URL.createObjectURL(h.blob)
    wait.classList.add('shown')
    let timer = 0, shown = 0
    const measure = (): void => {
      const now = held.get(file.url)
      let share = now ? now.got / Math.max(1, now.bytes) : 0
      if (nightfall.duration > 0 && nightfall.buffered.length) share = Math.max(share, nightfall.buffered.end(nightfall.buffered.length - 1) / nightfall.duration)
      shown = Math.max(shown, Math.min(1, share))
      waitFill.style.transform = `scaleX(${shown.toFixed(3)})`
      timer = requestAnimationFrame(measure)
    }
    measure()
    try {
      if (lean()) {
        nightfall.preload = 'auto'
        nightfall.src = file.url
        nightfall.load()
        const through = await Promise.race([
          new Promise<boolean>(resolve => nightfall.addEventListener('canplaythrough', () => resolve(true), { once: true })),
          sleep(WAIT_MOST_MS).then(() => false),
        ])
        return through ? file.url : null
      }
      const blob = await Promise.race([fetchWhole(file.url, file.bytes), sleep(WAIT_MOST_MS).then(() => null)])
      if (!blob) { held.get(file.url)?.abort?.abort(); return null }
      return URL.createObjectURL(blob)
    } finally {
      cancelAnimationFrame(timer)
      wait.classList.remove('shown')
      waitFill.style.transform = 'scaleX(0)'
    }
  }
  const evening: FilmEvening = {
    here: () => Boolean(release.evening && !busy && state.kind === 'rest' && here === release.evening.from && eveningFile()),
    ahead() {
      const file = eveningFile()
      if (file && !lean()) void fetchWhole(file.url, file.bytes)
    },
    async play(how = {}) {
      const file = eveningFile()
      if (!file || busy || disposed) return 'none'
      busy = true
      eveningCut = false
      dusk = nightfall
      duskFraming = framingOf()
      try {
        const src = nightfall.dataset['src'] === file.url && nightfall.readyState >= 3 ? file.url : await eveningBytes(file)
        if (!src || disposed || eveningCut) return eveningCut ? 'cut' : 'none'
        // THE BAND'S STRIP GOES BACK TO THE PICTURE at the bottom of a short dip, where the new frame cannot be seen to jump
        if (how.widen) {
          root.dataset['evening'] = 'down'
          dark.classList.add('shown')
          await sleep(reduced() ? 0 : EVENING_DOWN_MS)
          how.widen()
          fit()
        }
        if (nightfall.src !== src) {
          nightfall.preload = 'auto'
          nightfall.src = src
        }
        nightfall.dataset['src'] = src
        if (src.startsWith('blob:')) eveningSrc = src
        nightfall.playbackRate = 1
        try { await nightfall.play() } catch { return 'none' }
        await firstFrame(nightfall)
        nightfall.classList.add('shown')
        if (how.widen) {
          root.dataset['evening'] = 'up'
          dark.classList.remove('shown')
          void sleep(EVENING_UP_MS).then(() => { if (root.dataset['evening'] === 'up') delete root.dataset['evening'] })
        }
        if (eveningCut) return 'cut'
        await new Promise<void>(resolve => {
          let off = (): void => undefined
          // the end is watched on the evening on screen, which a turn may hand to its other framing's element
          duskWatch = (v: HTMLVideoElement): void => {
            off()
            // an evening that never says it ended is ended by its own length, and a little air
            const bound = setTimeout(() => done(), ((v.duration || release.evening!.seconds) + 3) * 1000)
            const done = (): void => { off(); eveningDone = null; resolve() }
            eveningDone = done
            v.addEventListener('ended', done)
            off = () => { clearTimeout(bound); v.removeEventListener('ended', done) }
          }
          duskWatch(nightfall)
        })
        return eveningCut ? 'cut' : 'ended'
      } finally {
        busy = false
        duskWatch = null
        duskTurning++
      }
    },
    stop() {
      eveningCut = true
      dusk.pause()
      eveningDone?.()
    },
  }

  return {
    kind: 'film',
    element: root,
    readout: () => readouts.slice(),
    evening,
    go,
    hurry() {
      if (dipSkip) { dipSkip(); return }
      if (!playing) return
      hurried = true
      playing.video.playbackRate = rate()
    },
    ahead(nodes) {
      if (busy) { aheadLater = nodes; return }
      fetchAhead(nodes)
    },
    reach(node) {
      const f = framingOf()
      let plan: RouterPlan
      try { plan = route(graphOf(f), here, node, { framing: f, pace: 'walk' }) } catch { return 'none' }
      if (plan.type === 'walk') return 'walk'
      if (plan.type === 'open' || plan.type === 'here') return 'open'
      return release.nodes[node]?.stills[f] ? 'dip' : 'none'
    },
    lean(node) {
      if (lean() || busy) return
      const f = framingOf()
      const edge = firstClip(node, f)
      const file = edge ? clipFile(edge, f) : null
      if (file) fetchHead(file.url, file.bytes)
    },
    state: () => state,
    marks(node, lang) {
      const f = shownFraming
      const list = release.nodes[node]?.marks[f]?.[lang] ?? []
      const box = fit()
      const out: PictureMark[] = []
      for (const m of list) {
        const p = onBox(PICTURE_ASPECT[f], box, m.u, m.v)
        // a mark the crop of this glass leaves out is not offered
        if (p.x < 22 || p.y < 22 || p.x > box.width - 22 || p.y > box.height - 22) continue
        out.push({ id: m.id, x: p.x, y: p.y, walks: m.walks, label: m.label, word: m.word, colour: m.colour })
      }
      return out
    },
    regions(node) {
      const f = shownFraming
      const box = fit()
      return (release.nodes[node]?.marks[f]?.regions ?? []).map(r => ({ id: r.id, depth: r.depth,
        points: r.points.map(([u, v]) => { const p = onBox(PICTURE_ASPECT[f], box, u, v); return [p.x, p.y] as const }) }))
    },
    project(point) {
      // a clip laid into the other framing's glass carries no words
      if (playing?.laid) return null
      const f = shownFraming
      const box = fit()
      let print: CameraPrint | null = null
      if (playing?.track) print = playing.track[Math.max(0, Math.min(playing.track.length - 1, playing.frame))] ?? null
      else if (!playing) print = parsePrint(release.nodes[here]?.print[f] ?? '')
      if (!print) return null
      const at = projectPrint(print, PICTURE_ASPECT[f], point)
      return at ? onBox(PICTURE_ASPECT[f], box, at.u, at.v) : null
    },
    box: () => fit(),
    framing: () => shownFraming,
    on(event, fn) {
      let bucket = listeners.get(event)
      if (!bucket) listeners.set(event, bucket = new Set())
      bucket.add(fn)
      return () => bucket!.delete(fn)
    },
    ready: () => firstPicture,
    update() {
      if (disposed) return
      fit()
      if (playing && state.kind === 'walk') {
        const v = playing.video
        let share = v.duration > 0 ? Math.min(1, v.currentTime / v.duration) : 0
        if (!(v as HTMLVideoElement & { requestVideoFrameCallback?: unknown }).requestVideoFrameCallback) playing.frame = Math.round(v.currentTime * release.fps)
        // a walk crossed to its other framing never runs its share back
        if (playing.turned) share = Math.max(share, state.share)
        if (Math.abs(share - state.share) >= 0.004) state = { ...state, share }
      }
      // a turned phone is another render: at rest the picture is picked again
      if (!busy && state.kind === 'rest' && framingOf() !== shownFraming) void showStill(here)
      // and under way: the clip laid and crossed, the still between clips picked again, the evening laid and crossed
      else if (busy) turnedInWalk()
    },
    veil(hidden) {
      root.classList.toggle('veiled', hidden)
    },
    dispose() {
      disposed = true
      disarm()
      for (const video of [...videos, nightfall]) tearDown(video)
      if (eveningSrc) URL.revokeObjectURL(eveningSrc)
      for (const h of held.values()) h.abort?.abort()
      held.clear()
      listeners.clear()
      root.remove()
      style.remove()
    },
  }
}

/** THE RELEASE, fetched once per visit: a visitor keeps the one he entered with */
export async function loadFilmRelease(base: string): Promise<FilmRelease> {
  const r = await fetch(new URL('film.json', base).href, { cache: 'no-cache' })
  if (!r.ok) throw new Error(`the film's release answered ${r.status}`)
  const release = (await r.json()) as FilmRelease
  if (release.format !== FILM_FORMAT) throw new Error(`the film's release is ${String(release.format)}, not ${FILM_FORMAT}`)
  return release
}
