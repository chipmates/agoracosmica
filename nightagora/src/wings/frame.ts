/* THE WING FRAME — the chrome every wing gets, so thirty wings are one
   museum and not thirty websites: the rail with its station index, the
   layer a wing hangs its labels in, the door at EVERY station, and the
   way back to the lobby.

   Two laws live here.

   · THE DOOR IS AT EVERY STATION. Asking the person about what you are
     looking at is the peak of the visit, so it cannot wait for the last
     room. Each station reports its own question, the visitor reads it
     beside the door, and the door opens the library with exactly that
     question named.
   · THE LOBBY IS NOT REPLAYED. A wing is a place you come back to. The
     station index rides the URL hash, so a reload puts the visitor back
     where they stood, and the way home lands at the wheel, never at the
     overture. */

import { PerspectiveCamera, Scene } from 'three/webgpu'
import { WING_TEXT, lang, say } from './content'
import type { WingEntry } from './registry'
import type { Stack } from '../stack'

const APP_ORIGIN = 'https://agoracosmica.org'

/** The room a wing is drawn in: its own scene and camera, the museum's one
    stack, and the wall clock its motion runs on. The frame owns all four,
    so thirty wings render through one renderer and one post chain. */
export interface WingWorld {
  scene: Scene
  camera: PerspectiveCamera
  stack: Stack
  clock: () => number
}

export interface WingHosts {
  /** the layer a wing hangs its own labels in */
  labels: HTMLElement
  /** the wing's own surface, under the stack's light */
  stage: HTMLElement
  /** the scene, the camera, the stack and the clock */
  world: WingWorld
  /** move along the rail from inside the wing, so a wheel or a swipe over
      the stage and a click on the rail arrive at the same station */
  navigate: (index: number) => void
}

export interface WingStation {
  /** the station's own name in the wing's source, stable across languages
      and across a rebuild: it is how every instrument addresses a station,
      because an integer into a normalised rail repeats the last one */
  id: string
  /** the station's name, already in the page's language */
  name: string
  /** the question its door carries, shown beside the door as text */
  question: string
}

export interface WingModule {
  stations: WingStation[]
  /** compose one station into the frame's hosts */
  show(index: number, hosts: WingHosts): void
  /** strike everything the wing put on the page */
  stop(): void
  /** one frame of the wing's own time, when it holds a living stage */
  update?(dt: number): void
  /** a named composition at the standing station, for the eye and the rig */
  view?(id: string): void
  /** the gaze, in radians, when the wing drives its own camera */
  look?(yaw: number, pitch: number): void
}

export interface WingFrame {
  /** `at` is a station's index or its id; `view` is a named composition */
  open(entry: WingEntry, wing: WingModule, at: number | string, view?: string): void
  goto(index: number): void
  /** stand at a station by its id. False when this wing has no such
      station, so a caller can say so instead of shooting the wrong one. */
  gotoId(id: string): boolean
  close(): void
  /** which station is standing, for the rig and for the URL */
  station(): number
  /** the id of the station standing, which is what a report names */
  stationId(): string
  /** every station's id, in rail order: the walk a machine addresses */
  stationIds(): string[]
  /** how many this wing has, which is what the motion eye walks */
  stations(): number
  /** the door as it stands right now: where it goes and what it asks, so a
      walk can record what a visitor's click would have opened */
  doorHere(): { href: string; question: string }
  /** one frame of the wing's own time */
  update(dt: number): void
  /** the gaze a hand or the rig asks for, in radians */
  look(yaw: number, pitch: number): void
  /** the camera the wing is seen through, which is what telemetry reads */
  camera(): PerspectiveCamera
}

/** The station the URL is standing at, or 0. The hash is the return path,
    and it is written as an index; a station's own id is read as well, so a
    link written by hand stands where its name says. */
export function stationFromHash(): number | string {
  const value = /(?:^|[#&])s=([a-z0-9-]+)/.exec(location.hash)?.[1]
  if (value === undefined) return 0
  if (!/^\d+$/.test(value)) return value
  const n = Number(value)
  return Number.isInteger(n) && n >= 0 ? n : 0
}

/** The library's own door. The app's entry parser resolves NAMED ask tags
    only, so a question travels as an identifier and free text never rides
    the URL into the composer. */
function doorUrl(entry: WingEntry): string {
  const p = new URLSearchParams()
  // TODO-WING-ASK-TAG: the app resolves f:<figure>:1 (the figure's hero
  // question) and nothing per station. A w:<figure>:<station> tag class in
  // the app would let each station name its own question; until it exists
  // every door of a wing carries the same named question.
  if (!entry.publicSlug || !entry.askTag) {
    p.set('figure', entry.slug)
    return `${APP_ORIGIN}/?${p.toString()}`
  }
  p.set('figure', entry.publicSlug)
  p.set('ask', entry.askTag)
  p.set('lang', lang())
  return `${APP_ORIGIN}/?${p.toString()}`
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag)
  n.className = cls
  if (text !== undefined) n.textContent = text
  return n
}

export function createWingFrame(
  host: HTMLElement,
  onLobby: () => void,
  stack: Stack,
  clock: () => number
): WingFrame {
  const world: WingWorld = {
    scene: new Scene(),
    camera: new PerspectiveCamera(46, innerWidth / innerHeight, 0.08, 1100),
    stack,
    clock,
  }
  const labels = el('div', 'wing-labels')
  labels.setAttribute('aria-hidden', 'true')
  const stage = el('div', 'wing-stage')

  const lobby = el('button', 'wing-lobby', say(WING_TEXT.lobby))
  lobby.type = 'button'
  lobby.style.cssText = 'position:static;flex:0 0 auto'
  lobby.addEventListener('click', () => onLobby())

  /* THE RAIL IS ONE MARK, not two. The way home and the stations stand in
     one group, and only the inner track scrolls, so a wing with nineteen
     stations keeps 44 px targets and the frame keeps one persistent mark
     where a lobby button beside a rail would have made two. */
  const railGroup = el('div', 'wing-rail-group')
  railGroup.style.cssText =
    'position:fixed;left:50%;transform:translateX(-50%);bottom:var(--wing-rail-bottom,calc(168px + env(safe-area-inset-bottom)));max-width:calc(100vw - 32px);display:flex;align-items:center'
  railGroup.dataset['naPersistent'] = ''
  const rail = el('nav', 'wing-rail')
  rail.setAttribute('aria-label', say(WING_TEXT.rail))
  rail.style.cssText =
    'position:relative;left:auto;transform:none;bottom:auto;min-width:0;overflow-x:auto;overflow-y:hidden;scrollbar-width:none;justify-content:flex-start'
  railGroup.append(lobby, rail)

  const question = el('p', 'wing-question')
  const door = el('a', 'wing-door', say(WING_TEXT.door))
  // the door is the frame's one persistent mark: it stands at every station
  door.dataset['naPersistent'] = ''
  door.target = '_blank'
  door.rel = 'noopener'
  // the no-key case, said once and plainly: the free tier is a daily
  // quota, so a visitor with no key is not standing at a locked door
  const note = el('p', 'wing-note', say(WING_TEXT.doorNote))
  const doorBlock = el('div', 'wing-doorblock')
  doorBlock.append(question, door, note)

  host.append(stage, labels, railGroup, doorBlock)

  let entry: WingEntry | null = null
  let wing: WingModule | null = null
  let index = 0

  /** a station's id, or the position it stands at when a wing predates ids */
  function idAt(i: number): string {
    return wing?.stations[i]?.id ?? `station-${i + 1}`
  }

  function paintRail(): void {
    rail.textContent = ''
    const stations = wing?.stations ?? []
    rail.dataset['single'] = String(stations.length < 2)
    for (let i = 0; i < stations.length; i++) {
      const b = el('button', 'wing-step')
      b.type = 'button'
      b.style.flex = '0 0 44px'
      b.dataset['station'] = idAt(i)
      b.setAttribute(
        'aria-label',
        `${say(WING_TEXT.station)} ${i + 1} · ${stations[i]?.name ?? ''}`
      )
      b.setAttribute('aria-current', i === index ? 'true' : 'false')
      b.addEventListener('click', () => goto(i))
      rail.appendChild(b)
    }
  }

  function goto(n: number): void {
    if (!wing || !entry) return
    const count = wing.stations.length
    index = Math.min(Math.max(n, 0), Math.max(0, count - 1))
    const station = wing.stations[index]
    wing.show(index, { labels, stage, world, navigate: goto })
    question.textContent = station?.question ?? ''
    door.href = doorUrl(entry)
    for (let i = 0; i < rail.children.length; i++) {
      rail.children[i]?.setAttribute('aria-current', i === index ? 'true' : 'false')
    }
    const selected = rail.children[index] as HTMLElement | undefined
    if (selected) rail.scrollLeft = selected.offsetLeft - rail.clientWidth / 2 + 22
    // the return path: a reload stands the visitor where they stood
    const hash = count > 1 || index > 0 ? `#s=${index}` : ''
    const url = `/w/${entry.slug}${location.search}${hash}`
    if (location.pathname + location.search + location.hash !== url)
      history.replaceState({}, '', url)
  }

  function gotoId(id: string): boolean {
    const stations = wing?.stations ?? []
    for (let i = 0; i < stations.length; i++) {
      if (idAt(i) !== id) continue
      goto(i)
      return true
    }
    return false
  }

  return {
    open(nextEntry, nextWing, at, view) {
      /* THE SAME WING IS NOT REBUILT. A jump between two stations of the
         wing already standing arrives here as a second open; rebuilding
         would throw away the scene and every compiled material to show a
         room next door. The module that is standing is kept and the fresh
         one is dropped, so a wing may allocate only in `show`. */
      const reuse = entry?.slug === nextEntry.slug && wing !== null
      if (!reuse) wing?.stop()
      entry = nextEntry
      if (!reuse) wing = nextWing
      index = 0
      host.hidden = false
      paintRail()
      if (typeof at === 'string') {
        if (!gotoId(at)) goto(0)
      } else {
        goto(at)
      }
      if (view) wing?.view?.(view)
    },
    goto,
    gotoId,
    close() {
      wing?.stop()
      wing = null
      entry = null
      labels.textContent = ''
      stage.textContent = ''
      rail.textContent = ''
      host.hidden = true
    },
    station: () => index,
    stationId: () => (wing ? idAt(index) : ''),
    stationIds: () => (wing?.stations ?? []).map((_, i) => idAt(i)),
    stations: () => wing?.stations.length ?? 0,
    doorHere: () => ({
      href: door.href,
      question: question.textContent ?? '',
    }),
    update(dt) {
      world.camera.aspect = innerWidth / innerHeight
      world.camera.updateProjectionMatrix()
      wing?.update?.(dt)
    },
    look: (yaw, pitch) => wing?.look?.(yaw, pitch),
    camera: () => world.camera,
  }
}
