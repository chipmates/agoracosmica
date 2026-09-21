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
import { DISCLOSURES } from '../content/disclosures'
import { LOBBY_TEXT } from '../content/lobby'
import plateCss from './title-plate.css?inline'
import { windowOwnsTheScreen } from './window-chrome'
import { gaitPace, setGaitPace, type GaitPaceName } from './vinci/gait'
import type { WingEntry } from './registry'
import type { Stack } from '../stack'
import type { ManifestEntry } from '../manifest'

const APP_ORIGIN = 'https://agoracosmica.org'

/** how often a standing station keeps a still of itself */
const STILL_EVERY_S = 4

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
  /** WHERE THE BAR'S WORDS STAND ON A NARROW STAGE. A phone bar keeps one
      line, so the words a wing appends to the bar, and the question and the
      door under it, move into a foot the wing offers inside its own sheet.
      Null gives all of them back to the frame, which is where they stand on
      a wide stage and in a wing that offers no foot. */
  barFoot: (host: HTMLElement | null) => void
  /** NOTHING ON SCREEN MOVES WITH THE WALKER. While a leg is under way the
      frame carries one attribute and CSS alone takes the chrome that belongs
      to a place a visitor has left: its card, its rows, its labels and the
      question. The bar stays, at full strength, because it is the way out of
      the room and out of the wing. */
  walking: (underWay: boolean) => void
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
  /** The page's language moved while this wing stood: read every word the
      wing owns again, including its own station names, before the frame
      repaints the chrome around them. */
  language?(): void
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
  const BAR_BOTTOM = 'var(--wing-rail-bottom,calc(168px + env(safe-area-inset-bottom)))'
  railGroup.style.cssText =
    `position:fixed;left:50%;transform:translateX(-50%);bottom:${BAR_BOTTOM};max-width:calc(100vw - 32px);display:flex;align-items:center`
  railGroup.dataset['naPersistent'] = ''
  const rail = el('nav', 'wing-rail')
  rail.setAttribute('aria-label', say(WING_TEXT.rail))
  rail.style.cssText =
    'position:relative;left:auto;transform:none;bottom:auto;min-width:0;overflow-x:auto;overflow-y:hidden;scrollbar-width:none;justify-content:flex-start'
  railGroup.append(lobby, rail)

  /* THE RAIL KEEPS A THIRD OF THE BAR. A wing appends its own controls to
     this group, and on a 390 px stage four words beside the rail leave it a
     stub of about 45 px. When the words would take more than two thirds of
     the bar, the group wraps them under the rail: the decision is the
     frame's, so a wing never has to know how wide its own words are. */
  const RAIL_SHARE = 1 / 3
  /** what the bar keeps clear of the door block under it */
  const BAR_CLEAR = 8
  /* THE PHONE KEEPS ONE BAR LINE. A 390 px bar that carries the way home,
     the rail and three words spends two lines on chrome and leaves the room
     half the screen. So on a narrow stage the words a wing appended, and the
     question and door block beneath them, stand in the foot the wing offers
     inside its own sheet, and the bar is the way home and the rail. The
     decision is the frame's: a wing never places the frame's own chrome. */
  const words: HTMLElement[] = []
  const wordRow = el('div', 'wing-bar-words')
  /* THE PACE STANDS WHERE THE BAR'S WORDS STAND. On a narrow stage the bar
     keeps one line and everything else is read in the wing's own sheet, so
     the choice of how fast the walk goes is read there too, beside the words
     it belongs with. The wide stage reads it in the museum's instruments. */
  const paceRow = el('div', 'wing-pace')
  const paceName = el('span', 'wing-pace-name')
  paceRow.append(paceName)
  const paceControls: [GaitPaceName, HTMLElement][] = []
  for (const name of ['stroll', 'walk', 'brisk'] as const) {
    const control = document.createElement('button')
    control.type = 'button'
    control.className = 'wing-pace-step'
    control.dataset['paceChoice'] = name
    control.addEventListener('click', () => { setGaitPace(name); paintPace() })
    paceRow.append(control)
    paceControls.push([name, control])
  }
  function paintPace(): void {
    paceName.textContent = say(LOBBY_TEXT.pace)
    for (const [name, control] of paceControls) {
      control.textContent = say(LOBBY_TEXT[name === 'stroll' ? 'paceStroll' : name === 'walk' ? 'paceWalk' : 'paceBrisk'])
      control.setAttribute('aria-pressed', String(gaitPace() === name))
    }
  }
  let footHost: HTMLElement | null = null
  const narrowStage = () => innerWidth / innerHeight <= 0.9
  /** every child a wing appended to the bar, in the order it appended them */
  function trackWords(): void {
    for (const child of railGroup.children) {
      const node = child as HTMLElement
      if (node === lobby || node === rail || node === wordRow || words.includes(node)) continue
      words.push(node)
    }
  }
  function placeChrome(): void {
    const away = footHost !== null && narrowStage()
    const home = away ? wordRow : railGroup
    for (const word of words) if (word.parentElement !== home) home.append(word)
    if (away) {
      if (doorBlock.parentElement !== footHost) footHost!.append(doorBlock)
      if (wordRow.parentElement !== footHost) footHost!.append(wordRow)
      if (paceRow.parentElement !== wordRow) wordRow.append(paceRow)
      paintPace()
    } else {
      // back to its own place in the frame, which is under the bar and
      // before the disclosure the door opens
      if (doorBlock.parentElement !== host) railGroup.after(doorBlock)
      paceRow.remove()
      wordRow.remove()
    }
  }
  /** The words belong to the wing that made them, so they die with it and
      the frame's own blocks come home before the wing's layer is struck. */
  function releaseWords(): void {
    footHost = null
    words.length = 0
    wordRow.textContent = ''
    placeChrome()
  }
  function fitTheBar(): void {
    /* Measured with nothing wrapped. A group that has already wrapped is
       narrower and taller than its own ceiling, and deciding from that would
       oscillate between one line and two. */
    railGroup.style.flexWrap = 'nowrap'
    railGroup.style.bottom = BAR_BOTTOM
    rail.style.flexBasis = ''
    for (const child of railGroup.children) (child as HTMLElement).style.flexGrow = ''
    const box = getComputedStyle(railGroup)
    const line = railGroup.clientWidth - parseFloat(box.paddingLeft || '0') - parseFloat(box.paddingRight || '0')
    if (line <= 0) return
    const flat = railGroup.getBoundingClientRect().height
    let words = 0, lead = 0, beforeRail = true
    for (const child of railGroup.children) {
      if (child === rail) { beforeRail = false; continue }
      const width = (child as HTMLElement).getBoundingClientRect().width
      words += width
      if (beforeRail) lead += width
    }
    if (line - words >= line * RAIL_SHARE) return
    railGroup.style.flexWrap = 'wrap'
    // the rail fills the first line, so every appended word falls to the next
    rail.style.flexBasis = `${Math.max(120, Math.floor(line - lead))}px`
    // the second line is a row of cells, not three words against one edge
    let past = false
    for (const child of railGroup.children) {
      if (child === rail) { past = true; continue }
      if (past) (child as HTMLElement).style.flexGrow = '1'
    }
    /* A SECOND LINE TAKES THE BAR'S OWN SLACK FIRST. Above the bar stands
       whatever the wing put there, keyed to the bar's one line; below it
       stands the door block, which is this frame's. So the group drops by as
       much of its new height as the door block leaves it, and only what is
       left over grows upward. */
    const grew = railGroup.getBoundingClientRect().height - flat
    const slack = doorBlock.getBoundingClientRect().top - railGroup.getBoundingClientRect().bottom
    const drop = Math.max(0, Math.min(grew, Math.floor(slack - BAR_CLEAR)))
    if (drop > 0) railGroup.style.bottom = `calc(${BAR_BOTTOM} - ${drop}px)`
  }
  new MutationObserver(() => { trackWords(); placeChrome(); fitTheBar() }).observe(railGroup, { childList: true })
  addEventListener('resize', () => { placeChrome(); fitTheBar(); doorStandsAlone() })

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

  /* THE DOOR SAYS WHAT IS BEHIND IT. A visitor who has never heard of the
     library is one press from leaving the museum for it, so the first press
     opens a plate: which library, in whose voice, on what terms. It is the
     museum's own plate grammar, and the part that owns that grammar mounts
     its stylesheet only where a wing builds a sheet, so the frame mounts it
     under the same id and the door stands in a wing that builds none. */
  const PLATE_STYLE = 'na-title-plate'
  if (!document.getElementById(PLATE_STYLE)) {
    const plateStyle = document.createElement('style')
    plateStyle.id = PLATE_STYLE
    plateStyle.textContent = plateCss
    document.head.append(plateStyle)
  }
  const disclosure = el('dialog', 'na-plate wing-door-plate')
  disclosure.id = 'wing-door-plate'
  const doorTitle = el('h1', 'na-plate-title')
  doorTitle.id = 'wing-door-title'
  disclosure.setAttribute('aria-labelledby', doorTitle.id)
  const doorWall = el('div', 'na-plate-wall')
  doorWall.append(doorTitle)
  const doorWords = el('div', 'wing-door-words')
  setRegister(doorWords, 'drawer')
  const doorLead = el('p', 'wing-door-word')
  /* THE CANON'S OWN SENTENCE, never a second telling of it: the museum says
     once what an Echo is, and the honesty check reads this one against it. */
  const doorEcho = el('p', 'wing-door-word')
  doorEcho.dataset['naDisclosure'] = 'stone'
  const doorTerms = el('p', 'wing-door-word')
  doorWords.append(doorLead, doorEcho, doorTerms)
  const continueDoor = el('a', 'na-plate-primary')
  continueDoor.target = '_blank'; continueDoor.rel = 'noopener'
  const closeDisclosure = el('button', 'na-plate-second')
  closeDisclosure.type = 'button'
  const doorControls = el('div', 'na-plate-controls')
  doorControls.append(continueDoor, closeDisclosure)
  const doorFoot = el('div', 'na-plate-foot')
  doorFoot.append(doorControls)
  disclosure.append(doorWall, doorWords, doorFoot)

  /** the plate's words, read again on every open and on a language change */
  function paintDoorPlate(): void {
    doorTitle.textContent = say(WING_TEXT.doorTitle).replace('{name}', entry?.name ?? '')
    doorLead.textContent = say(WING_TEXT.doorLead)
    doorEcho.textContent = say(DISCLOSURES.stone)
    doorTerms.textContent = say(WING_TEXT.doorTerms)
    continueDoor.textContent = say(WING_TEXT.doorAsk)
    closeDisclosure.textContent = say(WING_TEXT.doorStay)
  }
  /* ONE TEXT AT A TIME, the rule the entrance sheet follows: while the plate
     stands, the card, the bar and the question behind it stand down. */
  function doorStandsAlone(): void {
    if (disclosure.open) document.documentElement.dataset['naPlate'] = 'open'
    else delete document.documentElement.dataset['naPlate']
    windowOwnsTheScreen(document, disclosure.open && narrowStage())
  }
  let disclosureSeen = false
  door.addEventListener('click', event => {
    if (wing?.doorDisclosure !== 'first-press' || disclosureSeen) return
    event.preventDefault()
    disclosureSeen = true
    continueDoor.href = door.href
    paintDoorPlate()
    disclosure.showModal()
    doorStandsAlone()
    disclosure.scrollTop = 0
    continueDoor.focus({ preventScroll: true })
  })
  continueDoor.addEventListener('click', () => disclosure.close())
  closeDisclosure.addEventListener('click', () => disclosure.close())
  disclosure.addEventListener('close', () => {
    doorStandsAlone()
    if (!host.hidden) door.focus({ preventScroll: true })
  })

  /* THE LOST CONTEXT. A phone under memory pressure takes the GPU back from
     the tab and every frame after that is black, with the card, the bar and
     the door still standing over it. The address carries the station, so the
     way back is to open the page again; while that runs, and if it is
     refused, the last frame the renderer held stands in the canvas's place
     with one line and a control over it. One automatic reload per visit: a
     second loss right after one is the machine saying no, and a page that
     reloads itself in a circle is worse than a still. */
  const RELOAD_MARK = 'na-context-lost'
  const RELOAD_WINDOW_MS = 60_000
  /* The rules stand on the elements, as the bar's do above: the frame's
     stylesheet belongs to another hand this round and a veil that only ever
     shows over a dead canvas is not worth a rebase. */
  const lostVeil = el('div', 'wing-lost')
  /* the display is switched with the flag, never left to `hidden` alone: an
     inline rule beats the one the browser gives a hidden element */
  lostVeil.hidden = true
  lostVeil.style.cssText =
    'position:fixed;inset:0;z-index:40;display:none;flex-direction:column;align-items:center;justify-content:center;gap:18px;' +
    'background:var(--na-abyss);padding:24px'
  const lostStill = el('div', 'wing-lost-still')
  lostStill.style.cssText =
    'max-width:min(92vw,720px);width:100%;display:flex;justify-content:center;opacity:.5;filter:saturate(.7)'
  const lostLine = el('p', 'wing-lost-line')
  lostLine.style.cssText =
    'margin:0;font-family:var(--serif);font-size:16px;letter-spacing:.01em;color:var(--na-starlight);text-align:center;text-shadow:var(--ink-night)'
  const lostAgain = el('button', 'wing-lost-again')
  lostAgain.type = 'button'
  lostAgain.style.cssText =
    'min-height:44px;min-width:44px;padding:11px 20px;border:1px solid var(--rule);border-radius:2px;background:var(--plate-foot);' +
    'font-family:var(--sans);font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--na-gold);cursor:pointer'
  lostAgain.addEventListener('click', () => location.reload())
  lostVeil.append(lostStill, lostLine, lostAgain)
  function lostWords(): void {
    // ASK (in the STATUS): this state has no words of its own yet. Shipped
    // from the entry's own line and the lobby's way in, which are what the
    // control does.
    lostLine.textContent = say(LOBBY_TEXT.entryOpening)
    lostAgain.textContent = say(LOBBY_TEXT.paneEnter)
  }
  function showLost(): void {
    if (!lostVeil.hidden) return
    lostWords()
    const kept = stack.still()
    lostStill.textContent = ''
    if (kept) {
      kept.style.cssText = 'width:100%;height:auto;border:1px solid var(--rule-faint)'
      lostStill.append(kept)
    }
    lostStill.hidden = !kept
    lostVeil.hidden = false
    lostVeil.style.display = 'flex'
    host.dataset['lost'] = ''
    lostAgain.focus({ preventScroll: true })
    let recent = 0
    try {
      recent = Number(sessionStorage.getItem(RELOAD_MARK) ?? 0)
      sessionStorage.setItem(RELOAD_MARK, String(Date.now()))
    } catch {
      // a private window refuses the mark: then the visitor presses
    }
    if (Date.now() - recent > RELOAD_WINDOW_MS)
      // the veil is painted first, so the visitor sees the room and not a flash
      setTimeout(() => location.reload(), 600)
  }
  stack.onContextLost(() => showLost())

  host.append(stage, labels, lostVeil, railGroup, doorBlock, disclosure)

  let entry: WingEntry | null = null
  let wing: WingModule | null = null
  let index = 0
  /** how long the station has stood since the last still was kept */
  let sinceStill = 0

  /** THE LANGUAGE IS CHOSEN IN THE LOBBY, and this frame outlives every wing
      it opens: a control word set once keeps the language the page loaded
      in, so each open paints them all again. */
  function paintWords(): void {
    lobby.textContent = say(WING_TEXT.lobby)
    rail.setAttribute('aria-label', say(WING_TEXT.rail))
    door.textContent = say(WING_TEXT.door)
    note.textContent = say(WING_TEXT.doorNote)
    paintDoorPlate()
    // the pace stands in the wing's own sheet, so its four words are the
    // frame's to repaint as well
    paintPace()
  }

  /** a station's id, or the position it stands at when a wing predates ids */
  function idAt(i: number): string {
    return wing?.stations[i]?.id ?? `station-${i + 1}`
  }

  /** The rail's names, the question and the door's address, read again from
      the wing's own stations. The buttons are not rebuilt: a rebuild would
      drop the hand that is on one and scroll the track back. */
  function paintStationWords(): void {
    const stations = wing?.stations ?? []
    for (let i = 0; i < rail.children.length; i++) {
      (rail.children[i] as HTMLElement).setAttribute(
        'aria-label',
        `${say(WING_TEXT.station)} ${i + 1} · ${stations[i]?.name ?? ''}`
      )
    }
    question.textContent = stations[index]?.question ?? ''
    if (entry) door.href = doorUrl(entry)
  }

  /* ONE MECHANISM FOR THE WHOLE FRAME. The language is announced once, by
     the control that changes it, and answered here for every wing: the wing
     reads its own words first, because the rail's names are the wing's. A
     language that did not change is not answered: reading the page's own
     language writes it back, and answering that write would never end. */
  let spoken = lang()
  addEventListener('na-language', event => {
    const said = (event as CustomEvent<unknown>).detail
    const next = said === 'de' || said === 'en' ? said : lang()
    if (next === spoken) return
    spoken = next
    if (!wing) return
    wing.language?.()
    paintWords()
    paintStationWords()
    paintNavigation()
  })

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

  /** A wing offers the foot its own sheet keeps, or takes it back. */
  /** One attribute, one transition, no element made or destroyed. */
  function walking(underWay: boolean): void {
    if (underWay) host.dataset['walking'] = ''
    else delete host.dataset['walking']
  }
  function barFoot(next: HTMLElement | null): void {
    if (footHost === next) { placeChrome(); return }
    footHost = next
    placeChrome()
    fitTheBar()
  }

  function goto(n: number): void {
    if (!wing || !entry) return
    const count = wing.stations.length
    index = Math.min(Math.max(n, 0), Math.max(0, count - 1))
    const station = wing.stations[index]
    wing.show(index, { labels, stage, world, navigate: goto, barFoot, walking })
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
      if (!reuse) { releaseWords(); wing?.stop() }
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
      releaseWords()
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
      /* A STILL OF THE STATION, not of a stride: the copy is asked for only
         while the visitor stands, and at most every few seconds, so a lost
         context has the room to show and the walk pays nothing. */
      sinceStill += dt
      if (sinceStill >= STILL_EVERY_S && host.dataset['walking'] === undefined) {
        sinceStill = 0
        stack.keepStill()
      }
    },
    held: () => wing?.held?.() ?? false,
    look: (yaw, pitch) => wing?.look?.(yaw, pitch),
    camera: () => world.camera,
  }
}
