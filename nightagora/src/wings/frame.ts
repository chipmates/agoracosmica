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

import { WING_TEXT, lang, say } from './content'
import type { WingEntry } from './registry'

const APP_ORIGIN = 'https://agoracosmica.org'

export interface WingHosts {
  /** the layer a wing hangs its own labels in */
  labels: HTMLElement
  /** the wing's own surface, under the stack's light */
  stage: HTMLElement
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
}

export interface WingFrame {
  open(entry: WingEntry, wing: WingModule, at: number): void
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
}

/** The station the URL is standing at, or 0. The hash is the return path. */
export function stationFromHash(): number {
  const m = /(?:^|[#&])s=(\d+)/.exec(location.hash)
  const n = m?.[1] === undefined ? 0 : Number(m[1])
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

export function createWingFrame(host: HTMLElement, onLobby: () => void): WingFrame {
  const labels = el('div', 'wing-labels')
  labels.setAttribute('aria-hidden', 'true')
  const stage = el('div', 'wing-stage')

  const lobby = el('button', 'wing-lobby', say(WING_TEXT.lobby))
  lobby.type = 'button'
  lobby.addEventListener('click', () => onLobby())

  const rail = el('nav', 'wing-rail')
  rail.setAttribute('aria-label', say(WING_TEXT.rail))

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

  host.append(stage, labels, rail, doorBlock, lobby)

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
    wing.show(index, { labels, stage })
    question.textContent = station?.question ?? ''
    door.href = doorUrl(entry)
    for (let i = 0; i < rail.children.length; i++) {
      rail.children[i]?.setAttribute('aria-current', i === index ? 'true' : 'false')
    }
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
    open(nextEntry, nextWing, at) {
      entry = nextEntry
      wing = nextWing
      index = 0
      host.hidden = false
      paintRail()
      goto(at)
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
  }
}
