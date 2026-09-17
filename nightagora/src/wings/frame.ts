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
import type { ManifestEntry } from '../manifest'

const APP_ORIGIN = 'https://agoracosmica.org'

/* THE THREE REGISTERS OF TEXT (quality bar B14). Every visitor facing
   string belongs to one of three. THE LABEL: one line in the museum's
   voice, the certainty word, nothing a visitor would not say aloud. THE
   DRAWER: a plain paragraph per element, the source named as a person
   names it, the one number that matters. THE RECORD: the full machine
   chain, arithmetic and ranges and licence lines and keys, opened on
   purpose and complete.

   A subtree declares its register here, and the gate resolves a string
   from the nearest declared ancestor. An undeclared string is read as a
   label, so a wing that forgets to mark is gated hardest, never softest,
   and the record is exempt only where it says it is a record. A drawer or
   a record a visitor opens carries an id and is opened by a control that
   names it with aria-controls, so the walk opens it the way a hand does. */
export type TextRegister = 'label' | 'drawer' | 'record'

/* WHAT AN ENTRY SAYS ABOUT ITSELF. Thirty wings will wait behind the same
   gold field, so the field is told in one shape: which of the three stages
   of building a place is really running, and how much of the whole wait is
   paid for. The share is COUNTED, never timed, it never runs backwards, and
   it stands at 1 only when the wing does. A wing with nothing it can count
   yet says so with null, and the field shows that it is working without
   claiming a number it does not have. */
export type WingStage = 'house' | 'exhibits' | 'walk'

export interface WingProgress {
  stage: WingStage
  /** the whole entry paid for, 0 to 1, or null while nothing can be counted */
  share: number | null
}

export type WingReport = (progress: WingProgress) => void

export function setRegister(el: HTMLElement, register: TextRegister): void {
  el.dataset['register'] = register
}

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
  /** A walking wing distinguishes its standing station from its destination. */
  navigation?(): { completed?: string; target?: string; question?: string }
  /** Keep the library disclosure behind the first door press of this visit. */
  doorDisclosure?: 'first-press'
  /** Old numeric deep links resolve through this fixed order; new links use ids. */
  legacyStationIds?: readonly string[]
  /** compose one station into the frame's hosts */
  show(index: number, hosts: WingHosts): void
  /** Resolves when the wing is standing and everything the walk will meet
      has been compiled, so the caller may lift its loading field on a frame
      that costs what every later frame costs. `report` takes the entry's own
      counts, in the one shape every wing reports. A wing without this stands
      as soon as it is shown, and reports nothing. */
  ready?(report?: WingReport): Promise<void>
  /** strike everything the wing put on the page */
  stop(): void
  /** one frame of the wing's own time, when it holds a living stage */
  update?(dt: number): void
  /** True while a payload stands over the frame the canvas already holds:
      nothing may draw until it lets go. */
  held?(): boolean
  /** a named composition at the standing station, for the eye and the rig */
  view?(id: string): void
  /** the gaze, in radians, when the wing drives its own camera */
  look?(yaw: number, pitch: number): void
  /** Privately streamed exhibits participate in the host's settled meter. */
  pending?(): number
  errors?(): readonly string[]
  manifest?(): ManifestEntry[]
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
  /** True when the wing standing is already at that address. A wing may push
      its own history entry inside a station, and the pop that entry makes
      must not rebuild the place the visitor is standing in. */
  standsAt(at: number | string): boolean
  /** how many this wing has, which is what the motion eye walks */
  stations(): number
  /** the door as it stands right now: where it goes and what it asks, so a
      walk can record what a visitor's click would have opened */
  doorHere(): { href: string; question: string }
  /** one frame of the wing's own time */
  update(dt: number): void
  /** True while the wing holds the canvas on its last frame: the loop skips
      its draw, so a DOM payload stands over a still picture at no cost. */
  held(): boolean
  /** resolves when the wing standing has paid for its first frame */
  ready(report?: WingReport): Promise<void>
  /** the gaze a hand or the rig asks for, in radians */
  look(yaw: number, pitch: number): void
  /** the camera the wing is seen through, which is what telemetry reads */
  camera(): PerspectiveCamera
  pending(): number
  errors(): readonly string[]
  manifest(): ManifestEntry[]
}

/** The hash accepts station ids and legacy zero-based positions. A wing maps
    legacy positions through its original order when the frame opens it. */
export function stationFromHash(): number | string {
  const value = /(?:^|[#&])s=([a-z0-9-]+)/.exec(location.hash)?.[1]
  if (value === undefined) return 0
  if (!/^\d+$/.test(value)) return value
  const n = Number(value)
  // Preserve explicit numeric hash text so ordinary numeric API indices and
  // a missing hash still refer to the current walk's order.
  return Number.isInteger(n) && n >= 0 ? value : 0
}

/** Only numeric text from a hash uses the old positions. Numeric API calls
 * address the current order, including an ordinary entry at position zero. */
export function resolveWingStationIndex(at: number | string, stations: readonly WingStation[], legacy?: readonly string[]): number {
  const clamp = (index: number) => Number.isInteger(index) ? Math.max(0, Math.min(index, stations.length - 1)) : 0
  if (typeof at === 'number') return clamp(at)
  if (/^\d+$/.test(at)) {
    if (!legacy) return clamp(Number(at))
    at = legacy[Number(at)] ?? ''
  }
  return Math.max(0, stations.findIndex(station => station.id === at))
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

  const disclosure = el('dialog', 'wing-door-disclosure')
  disclosure.setAttribute('aria-describedby', 'wing-door-disclosure-text')
  disclosure.setAttribute('aria-label', say(WING_TEXT.door))
  const disclosureText = el('p', '', say(WING_TEXT.doorNote))
  disclosureText.id = 'wing-door-disclosure-text'
  const continueDoor = el('a', 'wing-door', say(WING_TEXT.door))
  continueDoor.target = '_blank'; continueDoor.rel = 'noopener'
  const closeDisclosure = el('button', '', lang() === 'de' ? 'Schließen' : 'Close')
  closeDisclosure.type = 'button'
  disclosure.append(disclosureText, continueDoor, closeDisclosure)
  let disclosureSeen = false
  door.addEventListener('click', event => {
    if (wing?.doorDisclosure !== 'first-press' || disclosureSeen) return
    event.preventDefault()
    disclosureSeen = true
    continueDoor.href = door.href
    disclosure.showModal()
    continueDoor.focus({ preventScroll: true })
  })
  continueDoor.addEventListener('click', () => disclosure.close())
  closeDisclosure.addEventListener('click', () => disclosure.close())
  disclosure.addEventListener('close', () => { if (!host.hidden) door.focus({ preventScroll: true }) })

  host.append(stage, labels, railGroup, doorBlock, disclosure)

  let entry: WingEntry | null = null
  let wing: WingModule | null = null
  let index = 0

  /** THE LANGUAGE IS CHOSEN IN THE LOBBY, and this frame outlives every wing
      it opens: a control word set once keeps the language the page loaded
      in, so each open paints them all again. */
  function paintWords(): void {
    lobby.textContent = say(WING_TEXT.lobby)
    rail.setAttribute('aria-label', say(WING_TEXT.rail))
    door.textContent = continueDoor.textContent = say(WING_TEXT.door)
    disclosure.setAttribute('aria-label', say(WING_TEXT.door))
    note.textContent = disclosureText.textContent = say(WING_TEXT.doorNote)
    closeDisclosure.textContent = lang() === 'de' ? 'Schließen' : 'Close'
  }

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

  function paintNavigation(): void {
    const navigation = wing?.navigation?.()
    if (navigation?.question !== undefined && question.textContent !== navigation.question) question.textContent = navigation.question
    for (let i = 0; i < rail.children.length; i++) {
      const button = rail.children[i] as HTMLElement
      const current = navigation ? button.dataset['station'] === navigation.completed : i === index
      if (button.getAttribute('aria-current') !== String(current)) button.setAttribute('aria-current', String(current))
      const target = String(!current && button.dataset['station'] === navigation?.target)
      if (button.dataset['target'] !== target) button.dataset['target'] = target
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
    paintNavigation()
    const selected = rail.children[index] as HTMLElement | undefined
    if (selected && !wing.navigation) rail.scrollLeft = selected.offsetLeft - rail.clientWidth / 2 + 22
    // the return path: a reload stands the visitor where they stood
    const hash = count > 1 || index > 0 ? `#s=${wing.legacyStationIds ? idAt(index) : index}` : ''
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
      if (!reuse) { disclosure.close(); disclosureSeen = false }
      entry = nextEntry
      if (!reuse) wing = nextWing
      // a kept wing takes the fresh module's names: same stations, the
      // page's language now
      else wing!.stations = nextWing.stations
      paintWords()
      note.hidden = wing?.doorDisclosure === 'first-press'
      index = 0
      host.hidden = false
      paintRail()
      goto(resolveWingStationIndex(at, wing!.stations, wing?.legacyStationIds))
      if (view) wing?.view?.(view)
      const selected = rail.children[index] as HTMLElement | undefined
      if (!reuse && selected) rail.scrollLeft = selected.offsetLeft - rail.clientWidth / 2 + 22
    },
    goto,
    gotoId,
    ready: (report) => wing?.ready?.(report) ?? Promise.resolve(),
    close() {
      disclosure.close()
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
    standsAt: at => wing !== null && resolveWingStationIndex(at, wing.stations, wing.legacyStationIds) === index,
    stations: () => wing?.stations.length ?? 0,
    pending: () => wing?.pending?.() ?? 0,
    errors: () => wing?.errors?.() ?? [],
    manifest: () => wing?.manifest?.() ?? [],
    doorHere: () => ({
      href: door.href,
      question: question.textContent ?? '',
    }),
    update(dt) {
      world.camera.aspect = innerWidth / innerHeight
      world.camera.updateProjectionMatrix()
      wing?.update?.(dt)
      paintNavigation()
    },
    held: () => wing?.held?.() ?? false,
    look: (yaw, pitch) => wing?.look?.(yaw, pitch),
    camera: () => world.camera,
  }
}
