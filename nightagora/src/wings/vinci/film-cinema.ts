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
}

export interface FilmCinema {
  /** the form stands on the glass now, or has left it */
  set(on: boolean): void
  paint(): void
  /** where a mark at (x, y) stands clear of the foot row's controls: its own
      height, a short lift above them, or nowhere (null) */
  clear(x: number, y: number, half: number): number | null
}

const SVG = 'http://www.w3.org/2000/svg'
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
      lowerLooks()
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
    const key = [id, lang(), line, opens, innerWidth, innerHeight, Math.round(gold?.getBoundingClientRect().width ?? 0)].join('|')
    publish()
    if (key === said) return
    said = key
    caption.lang = lang()
    mark.replaceChildren(deskMark(stop?.certainty ?? 'reconstructed'))
    moreWord.textContent = say(deskControl('shared', 'read_more'))
    more.hidden = !opens
    more.setAttribute('aria-expanded', box.dataset['drawer'] === 'true' ? 'true' : 'false')
    fit(line, opens ? 2 : 3)
    room()
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

  /* ---- the close look's card stands whole beside the work ---- */
  /** the looks this form raised, lowered again where the phone stands upright */
  const raised = new WeakSet<HTMLElement>()
  function raiseLooks(): void {
    if (!on) return
    const vitrine = wing.querySelector<HTMLElement>('.vitrine[data-peek="true"]:not([hidden])')
    const grab = vitrine?.querySelector<HTMLElement>('.vitrine-grab')
    if (!vitrine || !grab) return
    raised.add(vitrine)
    grab.click()
  }
  function lowerLooks(): void {
    const vitrine = wing.querySelector<HTMLElement>('.vitrine[data-peek="false"]:not([hidden])')
    if (!vitrine || !raised.has(vitrine)) return
    raised.delete(vitrine)
    vitrine.querySelector<HTMLElement>('.vitrine-grab[aria-expanded="true"]')?.click()
  }
  const watch = new MutationObserver(() => { if (on) { raiseLooks(); paint() } })
  watch.observe(wing, { subtree: true, attributes: true, attributeFilter: ['data-peek', 'data-drawer', 'hidden'] })
  const lineWatch = new MutationObserver(() => paint())
  const phoneLine = part('film-line')
  if (phoneLine) lineWatch.observe(phoneLine, { childList: true, characterData: true, subtree: true })
  /* the life opens at its drawing: its landing scrolls every box around the
     period read, and only this form lets the life's body scroll */
  const lifeWatch = new MutationObserver(records => {
    if (!on) return
    for (const record of records)
      if ((record.target as Element).matches('.wing-life[open]'))
        (record.target as Element).querySelector<HTMLElement>('.wing-life-body')?.scrollTo({ top: 0 })
  })
  lifeWatch.observe(wing, { subtree: true, attributes: true, attributeFilter: ['open'] })
  addEventListener('resize', () => { said = ''; requestAnimationFrame(() => paint()) }, { signal })
  // gold's name settles its own width a frame late: the caption takes what is left
  const goldWatch = new ResizeObserver(() => requestAnimationFrame(() => paint()))
  if (gold) goldWatch.observe(gold)
  signal.addEventListener('abort', () => { watch.disconnect(); lineWatch.disconnect(); lifeWatch.disconnect(); goldWatch.disconnect(); set(false) })

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

  return { set, paint, clear }
}
