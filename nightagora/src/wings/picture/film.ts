/* THE FILM behind the seam: the wing as a recording of its own live rail
   (RENDER-GRAPH §7). One still under two videos in one box, all three covered
   the same way, so a still hands over to the same picture; a clip is shown only
   once its first frame is presented, and taken away only after the arrival's
   still is decoded under it. Words never ride the film: the chrome stands over
   this element and reads it through the seam. */

import { route } from '../../../forge/film/router.mjs'
import filmCss from './film.css?inline'
import type { FilmCycle } from './cycle'
import {
  PICTURE_ASPECT, lineIsLean, onBox, parsePrint, projectPrint,
  type CameraPrint, type PictureBox, type PictureEvent, type PictureFraming, type PictureMark,
  type PictureNode, type PictureSource, type PictureState, type PictureWords,
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

export interface FilmNodeRecord {
  kind: 'stop' | 'view'
  station: string
  walkId?: string
  exhibit?: string
  wall?: string
  vertex?: number
  stills: Partial<Record<PictureFraming, Record<Size, FilmFile>>>
  print: Partial<Record<PictureFraming, string>>
  marks: Partial<Record<PictureFraming, Partial<Record<'en' | 'de', FilmMarkRecord[]>>>>
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

export interface FilmRelease {
  format: typeof FILM_FORMAT
  wing: string
  fps: number
  revision: string
  framings: Record<PictureFraming, { master: [number, number]; rungs: [number, number][] }>
  story: PictureNode[]
  cuts: { from: PictureNode; to: PictureNode; title: PictureWords }[]
  opens: [PictureNode, PictureNode][]
  /** each station's set of exhibits, in the order its room holds them */
  sets?: Record<string, string[]>
  /** a machine's filmed cycle by its exhibit, where the release carries one */
  cycles?: Record<string, FilmCycle>
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
/** a mark held this long under a desktop pointer fetches the start of its clip */
export const LEAN_MS = 150
const LEAN_BYTES = 512 * 1024
/** one pace is rendered, the walk; the others play it at a rate */
const PACE_RATE: Record<Pace, number> = { stroll: 0.667, walk: 1, brisk: 1.5 }
/** the carried pace of a queued press, and its ceiling until phones show more */
const CARRIED = 0.9, RATE_MOST = 2
/** a clip's bytes the page keeps at once; the oldest idle one is let go */
const KEPT_CLIPS = 6

type RouterGraph = Parameters<typeof route>[0]
type RouterPlan = ReturnType<typeof route>

const make = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag)
  node.className = cls
  return node
}
const frame = (): Promise<void> => new Promise(resolve => requestAnimationFrame(() => resolve()))
const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))
const reduced = (): boolean => matchMedia('(prefers-reduced-motion: reduce)').matches

/** the router's own graph, one per framing: the clips this release carries */
function routerGraph(release: FilmRelease, framing: PictureFraming): RouterGraph {
  const nodes = Object.entries(release.nodes).map(([id, n]) => ({ id, ...(n.wall ? { wall: n.wall } : {}) }))
  const edges = release.edges.filter(e => e.framings[framing]).map(e => ({
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

export function createFilmSource(options: FilmOptions): PictureSource & { readout(): Record<string, unknown>[] } {
  const { release, host, base } = options
  const graphs: Partial<Record<PictureFraming, RouterGraph>> = {}
  const graphOf = (f: PictureFraming): RouterGraph => (graphs[f] ??= routerGraph(release, f))
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
  const dark = make('div', 'na-film-dark')
  const wait = make('div', 'na-film-wait')
  const waitFill = make('span', 'na-film-wait-fill')
  wait.append(waitFill)
  root.append(still, cross, ...videos, dark, wait)
  host.prepend(style, root)

  let here: PictureNode = release.nodes[options.at] ? options.at : release.story.find(n => release.nodes[n]) ?? Object.keys(release.nodes)[0]!
  let state: PictureState = { kind: 'rest', node: here }
  let shownFraming: PictureFraming = options.framing()
  let busy = false
  let queued: { node: PictureNode; resolve: ((n: PictureNode) => void)[] } | null = null
  let carried = 0
  let hurried = false
  let disposed = false
  let playing: { video: HTMLVideoElement; edge: FilmEdgeRecord; track: CameraPrint[] | null; frame: number } | null = null
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
    video.load()
    video.classList.remove('shown', 'leaving')
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
    const f = framingOf()
    if (f !== shownFraming) await showStill(edge.from, f)
    const arrival = stillFile(edge.to, f)
    const arrived = arrival ? decode(arrival) : Promise.resolve()
    const src = await bytesInTime(edge, f, target)
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
    playing = { video, edge, track: null, frame: 0 }
    void track.then(list => { if (playing?.edge === edge) playing.track = list })
    watchFrames(video)
    await firstFrame(video)
    video.classList.add('shown')
    set({ kind: 'walk', from: edge.from, to: edge.to, target, clip: edge.id, share: 0 })
    const record: Record<string, unknown> = { clip: edge.id, framing: f, rung: rungNow(f), src: src.startsWith('blob:') ? 'bytes' : 'network',
      pressToShownMs: Math.round(performance.now() - pressed), shownAtMediaTime: Math.round(video.currentTime * 1000) / 1000,
      stillUnder: still.currentSrc.replace(/^.*\//, '') }
    readouts.push(record)
    await new Promise<void>(resolve => {
      // a clip that never says it ended is ended by its own length, and a little air
      const bound = setTimeout(() => done(), ((video.duration || 30) / Math.max(0.25, video.playbackRate) + 3) * 1000)
      const done = (): void => { clearTimeout(bound); video.removeEventListener('ended', done); resolve() }
      video.addEventListener('ended', done)
    })
    /* THE CUT AT THE STOP IS INVISIBLE: the arrival's still is decoded and
       swapped in under the clip's last frame, and the clip only leaves on the
       frame after, dissolving over what the codec left */
    const ended = performance.now()
    record['endedAtMediaTime'] = Math.round(video.currentTime * 1000) / 1000
    record['duration'] = Math.round(video.duration * 1000) / 1000
    await arrived
    if (arrival && still.src !== arrival) {
      still.src = arrival
      await still.decode().catch(() => undefined)
    }
    await frame()
    record['endToDissolveMs'] = Math.round(performance.now() - ended)
    const quality = (video as HTMLVideoElement & { getVideoPlaybackQuality?: () => { droppedVideoFrames: number; totalVideoFrames: number } }).getVideoPlaybackQuality?.()
    if (quality) record['dropped'] = `${quality.droppedVideoFrames} of ${quality.totalVideoFrames}`
    video.classList.add('leaving')
    await sleep(END_DISSOLVE_MS + 20)
    tearDown(video)
    if (src.startsWith('blob:')) URL.revokeObjectURL(src)
    if (playing?.video === video) playing = null
    here = edge.to
    return true
  }

  /** still to still, the picture never dark: reduced motion and a late clip */
  async function dissolveTo(node: PictureNode): Promise<void> {
    const url = stillFile(node, framingOf())
    if (!url) { here = node; return }
    await decode(url)
    cross.src = url
    await cross.decode().catch(() => undefined)
    cross.classList.add('shown')
    await sleep(STILL_DISSOLVE_MS + 20)
    still.src = url
    await still.decode().catch(() => undefined)
    cross.classList.remove('shown')
    cross.removeAttribute('src')
    shownFraming = framingOf()
    here = node
  }

  /** THE JUMP: down to the museum's dark, the place it goes to named where a
      chapter's title stands, and that place's still up again */
  async function dip(node: PictureNode, title: PictureWords | null): Promise<void> {
    set({ kind: 'dip', from: here, to: node, title }, 'dip')
    dark.classList.add('shown')
    const url = stillFile(node, framingOf())
    await Promise.all([sleep(reduced() ? 0 : DIP_MS), url ? decode(url) : Promise.resolve()])
    if (url) { still.src = url; await still.decode().catch(() => undefined) }
    shownFraming = framingOf()
    here = node
    await Promise.race([sleep(options.hold(title)), new Promise<void>(resolve => { dipSkip = resolve })])
    dipSkip = null
    dark.classList.remove('shown')
    await sleep(reduced() ? 0 : DIP_MS)
  }

  async function walkPlan(plan: Extract<RouterPlan, { type: 'walk' }>, target: PictureNode): Promise<void> {
    if (reduced()) {
      const landed = plan.steps.filter((s): s is { clip: string; seconds: number } => 'clip' in s).map(s => edgeById.get(s.clip)?.to).filter(Boolean).at(-1)
      await dissolveTo(landed ?? target)
      return
    }
    for (const step of plan.steps) {
      if (disposed) return
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

  async function goNow(node: PictureNode): Promise<PictureNode> {
    const f = framingOf()
    let plan: RouterPlan
    try {
      plan = route(graphOf(f), here, node, { framing: f, pace: 'walk' })
    } catch {
      // a node this release does not carry is not a place the film can stand
      return here
    }
    if (plan.type === 'here' || plan.type === 'open') return here
    if (plan.type === 'dip') {
      if (!release.nodes[node]?.stills[f]) return here
      const step = plan.steps[0] as { title?: PictureWords } | undefined
      await dip(node, step?.title ?? null)
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

  async function go(node: PictureNode): Promise<PictureNode> {
    if (busy) {
      /* A PRESS WHILE WALKING queues one target, as the rail's one pending slot
         does, and carries the pace up while it waits */
      return new Promise(resolve => {
        if (queued && queued.node === node) queued.resolve.push(resolve)
        else {
          for (const r of queued?.resolve ?? []) r(here)
          queued = { node, resolve: [resolve] }
        }
        carried = 1
        if (playing) playing.video.playbackRate = rate()
      })
    }
    busy = true
    let at = here
    try {
      at = await goNow(node)
    } finally {
      busy = false
      carried = 0
      hurried = false
    }
    const next = queued
    queued = null
    if (next && !disposed) {
      const landed = await go(next.node)
      for (const r of next.resolve) r(landed)
    }
    return at
  }

  firstPicture = showStill(here).then(() => { fit(); set({ kind: 'rest', node: here }, 'rest') })

  return {
    kind: 'film',
    element: root,
    readout: () => readouts.slice(),
    go,
    hurry() {
      if (dipSkip) { dipSkip(); return }
      if (!playing) return
      hurried = true
      playing.video.playbackRate = rate()
    },
    ahead(nodes) {
      if (lean() || busy) return
      const f = framingOf()
      for (const node of nodes.slice(0, 2)) {
        const edge = firstClip(node, f)
        const file = edge ? clipFile(edge, f) : null
        if (file) void fetchWhole(file.url, file.bytes).then(blob => { if (blob && node === nodes[0]) arm(file.url, blob) })
        const arrival = edge ? stillFile(edge.to, f) : null
        if (arrival) void decode(arrival)
        if (edge) void trackOf(edge, f)
      }
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
    project(point) {
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
        const share = v.duration > 0 ? Math.min(1, v.currentTime / v.duration) : 0
        if (!(v as HTMLVideoElement & { requestVideoFrameCallback?: unknown }).requestVideoFrameCallback) playing.frame = Math.round(v.currentTime * release.fps)
        if (Math.abs(share - state.share) >= 0.004) state = { ...state, share }
      }
      // a turned phone is another render: at rest the picture is picked again
      if (!busy && state.kind === 'rest' && framingOf() !== shownFraming) void showStill(here)
    },
    veil(hidden) {
      root.classList.toggle('veiled', hidden)
    },
    dispose() {
      disposed = true
      disarm()
      for (const video of videos) tearDown(video)
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
