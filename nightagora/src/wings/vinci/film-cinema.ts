/* THE CINEMA FORM: a phone held sideways. The wide film stands full-bleed and
   the phone's own graded box (film-wing.ts buildPhone) is laid out for a short
   wide glass by film-cinema.css: the stop's line as a caption strip, the three
   seats in the bottom row. This module adds what a stylesheet cannot do: the
   caption cut to two rows with the phone's own "read more" key at its end, the
   opened caption's one scrolling column, the close look's card standing whole
   beside the work, and the panel's rows where no other part publishes them. */

import { lang, WING_TEXT } from '../content'
import { deskMark } from '../desk-chrome'
import { deskControl, deskStoryStop } from '../desk-story'
import type { DeskPanelRow } from '../desk-panel'
import type { PictureFraming, PictureSource } from '../picture/seam'
import type { VitrineCinema } from '../vitrine/types'
import { wholeLines as lineCut } from '../vitrine/whole-lines'
import { LOBBY_TEXT } from '../../content/lobby'
import css from './film-cinema.css?inline'

export type FilmForm = 'desk' | 'upright' | 'cinema'

/** the stylesheet the film wing mounts beside its own */
export const FILM_CINEMA_CSS = css

/** A phone held sideways is 320 to 480 px tall; a tablet or a desktop window is taller. */
export const CINEMA_MOST_HEIGHT = 500

/** THE FORM A GLASS GETS: upright where it is narrow, the cinema where it is
    wide and short, the desktop's band everywhere else. */
export function filmForm(width = innerWidth, height = innerHeight): FilmForm {
  if (width / height <= 0.9) return 'upright'
  return height <= CINEMA_MOST_HEIGHT ? 'cinema' : 'desk'
}

/** resolves once the picture stands in the framing asked for, or after a few seconds */
export function whenFraming(picture: PictureSource | undefined, want: () => PictureFraming, signal: AbortSignal): Promise<void> {
  return new Promise(resolve => {
    const until = performance.now() + 8000
    const look = (): void => {
      if (signal.aborted || !picture || picture.framing() === want() || performance.now() > until) { resolve(); return }
      requestAnimationFrame(look)
    }
    look()
  })
}

/** A mark's press target, wider than its drawn ring and halo in every form. */
export const MARK_TARGET = 48

/** A mark within a fingertip of one already standing gives way: the wide film
    at a phone's height sets the works half as far apart as on a desktop. The
    room's list and a press on the work itself still reach it. */
export function crowded(x: number, y: number, placed: readonly HTMLElement[], room = MARK_TARGET): boolean {
  return placed.some(d => Math.hypot((parseFloat(d.style.left) || 0) - x, (parseFloat(d.style.top) || 0) - y) < room)
}

export interface FilmCinemaHost {
  /** #wing */
  wing: HTMLElement
  /** the phone's graded box, whose controls the cinema form lays out */
  box: HTMLElement
  /** the stop the words stand for */
  stop(): string
  /** the panel's rows are published here only where no other part of the wing does */
  rows: boolean
  count(): string
  signal: AbortSignal
  /** the open look lays itself out again: the row it keeps changed size */
  relayout?(): void
}

export interface FilmCinema {
  /** the form stands on the glass now, or has left it */
  set(on: boolean): void
  paint(): void
  /** where a mark at (x, y) stands clear of the foot row's controls: its own
      height, a short lift above them, or nowhere (null) */
  clear(x: number, y: number, half: number): number | null
  /** the glass and the foot row a close look lays itself out by, while the form stands */
  frame(): VitrineCinema | null
}

const SVG = 'http://www.w3.org/2000/svg'
/** the strip's least width for its words; under it the caption gives way to the endings */
const CAPTION_LEAST = 300
/** the air a whole line keeps above or below a box's foot */
const LINE_AIR = 2
/** the air between the record's last whole line and its close */
const RECORD_AIR = 8
/** what a box's foot keeps whole besides its lines of words */
const CONTROLS = 'button, a[href], input, select, summary, [role="button"]'
const ARROW_UP = 'M8 13V3M4 7l4-4 4 4'
const make = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, value?: string): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag)
  node.className = cls
  if (value !== undefined) node.textContent = value
  return node
}
function arrowUp(): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg')
  svg.setAttribute('viewBox', '0 0 16 16')
  svg.setAttribute('class', 'film-ic')
  svg.setAttribute('aria-hidden', 'true')
  const line = document.createElementNS(SVG, 'path')
  line.setAttribute('d', ARROW_UP)
  svg.append(line)
  return svg
}

export function createFilmCinema(host: FilmCinemaHost): FilmCinema {
  const { box, wing, signal } = host
  const say = (value: { en: string; de: string }): string => value[lang()]
  const part = (cls: string): HTMLElement | null => box.querySelector<HTMLElement>(`:scope > .${cls}, :scope > .cinema-panel > .${cls}`)
  const foot = box.querySelector<HTMLElement>('.film-foot')
  const gold = box.querySelector<HTMLElement>('.film-gold')

  /* THE OPENED CAPTION'S ONE COLUMN: the box's name, line, drawer and keys
     stand in it while the form stands, so the drawer scrolls as one sheet and
     its close stays at its foot; they go back to the box when it leaves */
  const panel = make('div', 'cinema-panel')
  /* THE CAPTION: the line with its mark and the phone's own key at its end */
  const caption = make('p', 'cinema-caption')
  caption.lang = lang()
  const mark = make('span', 'cinema-mark')
  const words = make('span', 'cinema-words')
  const more = make('button', 'cinema-more')
  more.type = 'button'
  more.setAttribute('aria-controls', 'film-drawer')
  const moreWord = make('span', 'cinema-more-word')
  more.append(moreWord, arrowUp())
  caption.append(mark, words, ' ', more)
  more.addEventListener('click', () => box.querySelector<HTMLElement>('.film-more')?.click(), { signal })
  // the whole strip is the key's target; the key stays the one control a keyboard and a screen reader meet
  caption.addEventListener('click', event => {
    if (more.hidden || more.contains(event.target as Node)) return
    more.click()
  }, { signal })

  let on = false
  function set(want: boolean): void {
    if (want === on) return
    on = want
    if (on) {
      const kept = ['film-name', 'film-line', 'film-drawer', 'film-keys'].map(part).filter((n): n is HTMLElement => Boolean(n))
      panel.append(...kept)
      box.insertBefore(panel, foot)
      if (foot && gold) foot.insertBefore(caption, gold)
      paint()
    } else {
      for (const node of [...panel.children]) box.insertBefore(node, panel)
      panel.remove()
      caption.remove()
      for (const scroller of cut) scroller.style.removeProperty('--cinema-cut')
      cut.clear()
      recordLines()
    }
  }

  /* ---- the caption cut to two rows, the rest one press away ---- */
  let said = ''
  function paint(): void {
    if (!on) return
    const id = host.stop()
    const stop = deskStoryStop(id)
    const line = stop ? say(stop.line) : ''
    const opens = !box.querySelector<HTMLElement>('.film-more')?.hidden
    // where the endings leave the strip too narrow for its words, it gives way to them and keeps its key
    const free = opens ? stripRoom() : 0
    const squeezed = free > 0 && free < CAPTION_LEAST
    const key = [id, lang(), line, opens, squeezed, innerWidth, innerHeight, Math.round(gold?.getBoundingClientRect().width ?? 0)].join('|')
    publish()
    if (key === said) return
    said = key
    caption.lang = lang()
    mark.replaceChildren(deskMark(stop?.certainty ?? 'reconstructed'))
    moreWord.textContent = say(deskControl('shared', 'read_more'))
    more.hidden = !opens
    more.setAttribute('aria-expanded', box.dataset['drawer'] === 'true' ? 'true' : 'false')
    caption.dataset['squeezed'] = String(squeezed)
    if (squeezed) words.textContent = line
    else fit(line, opens ? 2 : 3)
    room()
  }
  /** the width the row leaves the strip, read with the strip stretched over it, whatever words it holds now */
  function stripRoom(): number {
    caption.dataset['measure'] = 'true'
    const width = caption.clientWidth
    delete caption.dataset['measure']
    return width
  }
  /** the line whole where it stands in its rows, else cut at a word with an ellipsis before the key */
  function fit(line: string, rows: number): void {
    words.textContent = line
    caption.dataset['cut'] = 'false'
    if (!caption.clientWidth) return
    const own = getComputedStyle(caption)
    const row = parseFloat(own.lineHeight) || 20
    /** the rows the words and the key take, read from their own boxes */
    const taken = (): number => {
      const top = caption.getBoundingClientRect().top + parseFloat(own.paddingTop)
      const range = document.createRange()
      range.selectNodeContents(words)
      let last = 0
      for (const r of [...range.getClientRects(), ...(more.hidden ? [] : [more.getBoundingClientRect()])])
        if (r.height > 0) last = Math.max(last, Math.floor((r.top + r.height / 2 - top) / row))
      return last + 1
    }
    if (taken() <= rows) return
    const all = line.split(' ')
    let low = 1, high = all.length - 1, best = 1
    while (low <= high) {
      const mid = (low + high) >> 1
      words.textContent = `${all.slice(0, mid).join(' ').replace(/[,;:.]$/, '')}…`
      if (taken() <= rows) { best = mid; low = mid + 1 } else high = mid - 1
    }
    words.textContent = `${all.slice(0, best).join(' ').replace(/[,;:.]$/, '')}…`
    caption.dataset['cut'] = 'true'
  }
  /** the opened caption stands over the strip's own place, as wide as the strip */
  function room(): void {
    const r = caption.getBoundingClientRect(), b = box.getBoundingClientRect(), g = gold?.getBoundingClientRect()
    if (!r.width) return
    const right = g && g.width ? g.left - 16 : r.right
    box.style.setProperty('--cinema-text-left', `${Math.round(r.left - b.left)}px`)
    box.style.setProperty('--cinema-text-width', `${Math.round(Math.max(r.width, right - r.left))}px`)
  }

  /* ---- the close look's measure: the glass inside the form's margins and the row it keeps ---- */
  /** set by the same variables the row reads, so a look and the row agree to the pixel */
  const probe = make('div', 'cinema-probe')
  probe.setAttribute('aria-hidden', 'true')
  document.body.append(probe)
  function frame(): VitrineCinema | null {
    if (!on || !foot) return null
    const glass = probe.getBoundingClientRect()
    const seen = (node: Element | null): DOMRect | null => {
      if (!(node instanceof HTMLElement) || node.hidden || getComputedStyle(node).display === 'none') return null
      const r = node.getBoundingClientRect()
      return r.width && r.height ? r : null
    }
    const seats = [...foot.querySelectorAll(':scope > :is(.film-back, .film-book)')].map(seen).filter((r): r is DOMRect => r !== null)
    const way = seen(gold)
    const all = way ? [...seats, way] : seats
    return {
      safe: { left: glass.left, top: glass.top, width: glass.width, height: glass.height },
      row: { top: all.length ? Math.min(...all.map(r => r.top)) : glass.bottom - 48, bottom: all.length ? Math.max(...all.map(r => r.bottom)) : glass.bottom,
        seats: seats.length ? Math.max(...seats.map(r => r.right)) : glass.left, gold: way ? way.left : glass.right },
      more: say(deskControl('shared', 'read_more')), less: say(LOBBY_TEXT.close),
    }
  }
  const watch = new MutationObserver(() => { if (on) paint() })
  watch.observe(wing, { subtree: true, attributes: true, attributeFilter: ['data-peek', 'data-drawer', 'hidden'] })
  const lineWatch = new MutationObserver(() => paint())
  const phoneLine = part('film-line')
  if (phoneLine) lineWatch.observe(phoneLine, { childList: true, characterData: true, subtree: true })
  /* the life opens at its drawing: its landing scrolls every box around the
     period read, and only this form lets the life's body scroll */
  const lifeWatch = new MutationObserver(records => {
    if (!on) return
    for (const record of records) {
      const target = record.target as Element
      if (target.matches('.wing-life[open]')) target.querySelector<HTMLElement>('.wing-life-body')?.scrollTo({ top: 0 })
      if (target.matches('.vinci-dock')) askRecord()
      // the plan opens at the visitor's own row; its list then ends on a whole row
      if (target.matches('.wing-plan[open]')) {
        const reading = target.querySelector<HTMLElement>('.wing-plan-reading')
        if (reading) requestAnimationFrame(() => wholeLines(reading))
      }
    }
  })
  lifeWatch.observe(wing, { subtree: true, attributes: true, attributeFilter: ['open'] })
  addEventListener('resize', () => { said = ''; requestAnimationFrame(() => { paint(); panelLines() }) }, { signal })
  // gold's name settles its own width a frame late, and the row its own at a turn: the caption and an open look take what is left
  const goldWatch = new ResizeObserver(() => requestAnimationFrame(() => { paint(); if (on) host.relayout?.() }))
  if (gold) goldWatch.observe(gold)
  if (foot) goldWatch.observe(foot)
  signal.addEventListener('abort', () => { watch.disconnect(); lineWatch.disconnect(); lifeWatch.disconnect(); goldWatch.disconnect(); probe.remove(); set(false) })

  /* ---- a scrolling box ends on a whole line at rest ---- */
  /** the boxes whose foot this form has moved, restored when it leaves */
  const cut = new Set<HTMLElement>()
  /** No line of words and no control stands cut in half at a box's foot:
      the foot moves up to just above the line or control its edge would cut,
      or down past it where the glass has `grow` px free under the box. The
      move is --cinema-cut, which only this form's rules read; the lines are
      read from their own boxes, so a row, a paragraph and a legend are all
      one case. A move that would take more than a third of the box is left. */
  function wholeLines(box: HTMLElement, grow = 0): void {
    if (!on) return
    cut.add(box)
    let move = 0
    box.style.setProperty('--cinema-cut', '0px')
    const range = document.createRange()
    for (let pass = 0; pass < 3; pass++) {
      const r = box.getBoundingClientRect()
      if (!r.height) return
      const edge = r.bottom - (parseFloat(getComputedStyle(box).borderBottomWidth) || 0)
      let top = Infinity, bottom = -Infinity
      const walker = document.createTreeWalker(box, NodeFilter.SHOW_TEXT)
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const parent = node.parentElement
        if (!parent || !node.textContent?.trim()) continue
        const held = parent.getBoundingClientRect()
        if (held.bottom <= edge || held.top >= edge || getComputedStyle(parent).visibility === 'hidden') continue
        range.selectNodeContents(node)
        for (const line of range.getClientRects())
          if (line.height > 1 && line.top < edge - 1 && line.bottom > edge + 1) {
            top = Math.min(top, line.top)
            bottom = Math.max(bottom, line.bottom)
          }
      }
      for (const control of box.querySelectorAll<HTMLElement>(CONTROLS)) {
        const c = control.getBoundingClientRect()
        if (c.height > 1 && c.height < 120 && c.top < edge - 1 && c.bottom > edge + 1) {
          top = Math.min(top, c.top)
          bottom = Math.max(bottom, c.bottom)
        }
      }
      if (top === Infinity) return
      const down = bottom + LINE_AIR - edge
      // down where it fits on the first passes, else up over the line
      const next = pass < 2 && down - move <= grow ? move - down : move + edge - (top - LINE_AIR)
      if (next - move > r.height / 3) return
      move = next
      box.style.setProperty('--cinema-cut', `${Math.round(move)}px`)
    }
  }
  /** the museum's panel: its column may reach down to its close's foot */
  function panelLines(): void {
    if (!on || document.documentElement.dataset['naPanel'] !== 'open') return
    const links = document.querySelector<HTMLElement>('#instruments .inst-links')
    const close = document.querySelector<HTMLElement>('#instruments .inst-close')
    if (!links) return
    links.style.setProperty('--cinema-cut', '0px')
    const room = close ? close.getBoundingClientRect().bottom - links.getBoundingClientRect().bottom : 0
    wholeLines(links, Math.max(0, room))
  }
  const panelWatch = new MutationObserver(() => requestAnimationFrame(() => requestAnimationFrame(panelLines)))
  panelWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-na-panel'] })
  addEventListener('na-language', () => requestAnimationFrame(() => requestAnimationFrame(panelLines)), { signal })
  document.querySelector('#instruments')?.addEventListener('toggle', () => requestAnimationFrame(panelLines), { capture: true, signal })
  signal.addEventListener('abort', () => panelWatch.disconnect())

  /* ---- the record ends on whole lines ---- */
  /** The record's foot above its close and the cover under its tabs stand
      between two lines, never across one: --record-foot and --record-head,
      which only this form's rules read, are cut again at every scroll, tab,
      fold and turn. */
  let recordAsked = false
  function recordLines(): void {
    recordAsked = false
    for (const dock of wing.querySelectorAll<HTMLElement>('.vinci-dock')) {
      if (!on || !dock.matches('[open]')) { dock.style.removeProperty('--record-head'); dock.style.removeProperty('--record-foot'); continue }
      const edge = dock.getBoundingClientRect().top + dock.clientTop
      const bar = dock.querySelector<HTMLElement>('.vinci-sources-toolbar')?.getBoundingClientRect()
      const close = dock.querySelector<HTMLElement>('.vinci-sources-close')?.getBoundingClientRect()
      const from = bar ? bar.bottom + 1 - edge : 0
      const reach = close && close.height ? close.top - RECORD_AIR - edge : dock.clientHeight
      const at = lineCut(dock, { from, reach })
      dock.style.setProperty('--record-head', `${Math.max(0, Math.ceil(at.top - from))}px`)
      dock.style.setProperty('--record-foot', `${Math.max(0, Math.ceil(dock.clientHeight - at.foot))}px`)
    }
  }
  const askRecord = (): void => { if (recordAsked) return; recordAsked = true; requestAnimationFrame(recordLines) }
  const inRecord = (event: Event): void => { if ((event.target as Element | null)?.closest?.('.vinci-dock')) askRecord() }
  for (const type of ['scroll', 'click', 'toggle']) wing.addEventListener(type, inRecord, { capture: true, passive: true, signal })
  addEventListener('resize', askRecord, { signal })

  /* ---- the marks clear of the foot row ---- */
  /** a mark keeps clear of the row's controls themselves, not of the air
      between them; one that a control would cover by its lower edge stands
      lifted just above it, so the work keeps its mark */
  const LIFT_MOST = 28
  function clear(x: number, y: number, half: number): number | null {
    if (!on) return y
    const foot = box.querySelector<HTMLElement>(':scope > .film-foot')
    if (!foot) return y
    let at = y
    for (const seat of foot.children) {
      if (!(seat instanceof HTMLElement) || seat.hidden || getComputedStyle(seat).visibility === 'hidden') continue
      const r = seat.getBoundingClientRect()
      if (!r.width || !r.height) continue
      const air = 4
      if (x + half <= r.left - air || x - half >= r.right + air) continue
      if (at + half <= r.top - air || at - half >= r.bottom + air) continue
      at = r.top - air - half
    }
    return y - at <= LIFT_MOST ? at : null
  }

  /* ---- the panel's rows: Lobby, the plan, the life, the chapters ---- */
  let rowsSaid = ''
  function publish(): void {
    if (!host.rows || signal.aborted) return
    const word = (sel: string): string => wing.querySelector(sel)?.textContent?.trim() ?? ''
    const list: DeskPanelRow[] = [{ id: 'lobby', label: word('.wing-lobby') || say(WING_TEXT.lobby), mark: 'back' }]
    if (word('.wing-plan-open')) list.push({ id: 'plan', label: word('.wing-plan-open') })
    if (word('.wing-life-open')) list.push({ id: 'life', label: word('.wing-life-open') })
    if (word('.wing-plan-open')) list.push({ id: 'chapters', label: say(deskControl('ways', 'chapters')), count: host.count() })
    const json = JSON.stringify(list)
    if (json === rowsSaid) return
    rowsSaid = json
    dispatchEvent(new CustomEvent('na-wing-instruments', { detail: { rows: list } }))
  }
  if (host.rows) {
    addEventListener('na-wing-instrument', event => {
      const row = (event as CustomEvent<{ row?: string }>).detail?.row
      if (row === 'plan' || row === 'chapters') wing.querySelector<HTMLElement>('.wing-plan-open')?.click()
      else if (row === 'life') wing.querySelector<HTMLElement>('.wing-life-open')?.click()
    }, { signal })
    addEventListener('na-language', () => { rowsSaid = ''; publish() }, { signal })
  }

  return { set, paint, clear, frame }
}
