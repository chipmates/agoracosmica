/** THE VITRINE: one window for every close look, and its one state owner.
 *
 * The room is where a visitor finds a work by standing where it is. The
 * vitrine is the close look: the work alone in a viewport and its words
 * beside it. The payload is the kind (a plate, a machine on its turntable, a
 * leaf, a year); the window around it does not change.
 *
 * This module owns the window, the one history entry a visitor's Back
 * dismisses, where the focus goes and where it returns to, and who draws the
 * stage while a payload stands. It owns no words: the line, the card and
 * every control are the caller's, already in the page's language.
 */
import { setRegister } from '../frame'
import { deskAny, deskOn } from '../desk-switches'
import { createCloseLookBand, type CloseLookBand } from '../desk-closelook'
import { noteOpened } from '../visit'
import { uiSure } from '../ui-sure'
import css from './vitrine.css?inline'
import type { VitrineCinema, VitrineExhibit, VitrinePayloadHost, VitrinePeek, VitrinePlace, VitrineRect, VitrineSurface } from './types'

export type { VitrineCinema, VitrineExhibit, VitrinePayload, VitrinePayloadHost, VitrinePlace, VitrineRect, VitrineSurface } from './types'

export interface Vitrine {
  /** The exhibit standing open, or null. */
  readonly id: string | null
  /** Who draws the stage right now. */
  readonly surface: VitrineSurface
  /** The card, which is what every mark that opens it names. */
  readonly element: HTMLElement
  /** The slot at the card's foot, where a wing docks its station's row. */
  readonly foot: HTMLElement
  /** `advance` puts the next exhibit in the window a visitor already has
   * open: the same history entry, the hand where it was left. */
  open(exhibit: VitrineExhibit, invoker?: HTMLElement | null, how?: 'enter' | 'advance'): void
  /** `pop` false leaves the browser's own entry where it is, for a caller
   * composing a still rather than dismissing on a visitor's behalf. */
  close(pop?: boolean): void
  /** ONE LEVEL UP: a detail goes back to the close look it was opened from,
   * a close look leaves the window. Every kind takes the same step. */
  back(): void
  escape(): boolean
  /** True while the window owns the keys and the wheel over its own surface. */
  owns(target: Element | null): boolean
  /** Hand a key to the payload. True when it took it. */
  key(event: KeyboardEvent): boolean
  /** True while nothing may draw: the canvas holds its last frame. */
  held(): boolean
  /** The card's rectangle, which no mark of the room may stand under. */
  reading(): VitrineRect | null
  update(dt: number): void
  /** The stage changed: the window and its payload are laid out again. */
  layout(): void
  dispose(): void
}

/** THE WAY ON PAST A SET'S END. Where the set ends, the band's gold asks the
 * window's host with this event on the host element; a host that answers
 * fills `detail.onward` in the page's language, and the gold carries it. */
export const VITRINE_ONWARD = 'na-vitrine-onward'
export interface VitrineOnward {
  kicker: string
  title: string
  /** the way leads up, not on: the walk's last stop */
  up?: boolean
  go(): void
}

const HISTORY_MARK = 'vinciExhibit'
/** A resized canvas is a cleared canvas: it draws this many frames of the
 * room before a held payload may hold it again. */
const RESIZE_FRAMES = 3
/** The card's peek over the foot of a filled viewport: the grabber, the
 * work's own name, the one control that raises the rest of the words, and
 * the payload's own row, each at the row's own size. */
const PEEK = 190
/** The share of the sheet a raised card takes over the work. */
const RAISED_SHARE = .62
/** However much its own peek asks for, a card never takes more of the sheet
 * than this: the work is what the window is for. */
const PEEK_MOST = .42
/** A peek that shows the line gives it this many rows and never cuts it,
 * and keeps the work this share of the screen above the sheet. */
const PEEK_LINE_ROWS = 2
const WORK_AT_REST = 2 / 3
/** A drag on the grabber this far decides; a shorter one is a press. */
const GRAB_PX = 24
const GRAB_SLOP = 8
/** THE WORK OWNS THE STAGE: it fills this share of the stage's limiting side,
 * and the rest is the air every hung thing needs around it. */
const WORK_SHARE = .92
/** THE PHONE HELD SIDEWAYS: the instruments' column at the left, over the
 * walk's two seats and as wide as they are, the work's zone beside it, and a
 * label column at the right where a work stands beside its words. */
const CINEMA = {
  tools: 104, toolsGap: 16,
  /** the label column: a share of the glass between two bounds, its gap to the work, its head */
  columnLeast: 256, columnMost: 300, columnShare: .31, columnGap: 28, columnTop: 18,
  /** the air at the glass's top and foot, and over the foot row */
  air: 10, rowGap: 12,
  /** the strip in the foot row, and the width its raised column takes at most */
  strip: 52, raised: 420,
  /** the clock's band along a film's foot, and its inset from the film's sides */
  clock: 44, clockInset: 16,
}

export function createVitrine(options: {
  host: HTMLElement
  /** The card's id, which the marks and the row name with aria-controls. */
  id: string
  lang(): 'en' | 'de'
  narrow(): boolean
  /** The stage's lower edge the window stands clear of: the wing's own bar. */
  floor(): number
  /** Walk the eye to the exhibit. `from` is the exhibit the visitor walks on
   * from, which is one motion and not a second opening. */
  onOpen(id: string, from: string | null): boolean
  /** Walk the eye back to the station it left. */
  onClose(id: string): void
  /** Where the hand lands when the control that opened the window is no
   * longer on the page to take it back. */
  returnFocus?(id: string): HTMLElement | null
  /** The word for the one mark that dismisses a window on the phone, in the
   * page's language. The window owns no words: this is the caller's. */
  closeLabel?(): string
  /** The word for the grabber that raises a folded card. */
  raiseLabel?(): string
  /** The room a close look's one step back leads to, in the page's language. */
  room?(): string
  /** THE PHONE HELD SIDEWAYS, as the host measures it; null in every other form. */
  cinema?(): VitrineCinema | null
}): Vitrine {
  const { host, onOpen, onClose } = options
  const document = host.ownerDocument
  const view = document.defaultView!
  const make = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string): HTMLElementTagNameMap[K] => {
    const n = document.createElement(tag); n.className = cls; return n
  }

  const root = make('div', 'vitrine')
  root.hidden = true
  const style = make('style', '')
  style.textContent = css
  const scrim = make('div', 'vitrine-scrim')
  const hole = make('div', 'vitrine-hole')
  const sheet = make('div', 'vitrine-sheet')
  const stage = make('div', 'vitrine-view')
  const payloadEl = make('div', 'vitrine-payload')
  payloadEl.setAttribute('role', 'img')
  const caption = make('p', 'vitrine-caption')
  caption.setAttribute('aria-live', 'polite')
  const payloadControls = make('div', 'vitrine-payload-controls')
  stage.append(payloadEl, caption)
  const card = make('section', 'vitrine-card')
  card.id = options.id
  card.tabIndex = -1
  card.setAttribute('role', 'group')
  setRegister(card, 'drawer')
  /** THE PANEL SAYS WHAT THE THING IS CALLED, FIRST. Every caller already
   * hands the window the exhibit's own name in the page's language; the card
   * reads it at its head and takes it as its accessible name. */
  const naming = make('h2', 'vitrine-name')
  naming.id = `${options.id}-name`
  setRegister(naming, 'label')
  const namingDot = make('span', 'vitrine-name-dot')
  namingDot.setAttribute('aria-hidden', 'true')
  const namingText = make('span', 'vitrine-name-text')
  // the number cast on the work's frame, before its name
  const namingNumber = make('span', 'vitrine-name-number')
  namingNumber.hidden = true
  naming.append(namingDot, namingNumber, namingText)
  // the catalogue's own row under the name: the date and where the original is
  const entryRow = make('p', 'vitrine-catalogue')
  entryRow.hidden = true
  const line = make('p', 'vitrine-line')
  setRegister(line, 'label')
  /* THE SOURCE ROW under the line, and on the phone the leaf's mark with the
     count beside it, where a set counts its pages by topic */
  const note = make('p', 'vitrine-note')
  note.hidden = true
  const seat = make('p', 'vitrine-seat')
  seat.hidden = true
  const seatWords = make('span', 'vitrine-seat-words')
  const countButton = make('button', 'vitrine-count')
  countButton.type = 'button'
  seat.append(seatWords, countButton)
  const body = make('div', 'vitrine-body')
  const words = make('div', 'vitrine-words')
  const aside = make('div', 'vitrine-aside')
  const after = make('div', 'vitrine-words vitrine-after')
  body.append(naming, seat, entryRow, line, note, words, aside, after)
  const controls = make('div', 'vitrine-controls')
  const foot = make('div', 'vitrine-foot')
  /** THE CARD IS A SHEET ON THE PHONE. The grabber raises it over the work
   * and puts it back, and the work keeps the screen between the two. */
  const grab = make('button', 'vitrine-grab')
  grab.type = 'button'
  grab.setAttribute('aria-controls', options.id)
  card.append(grab, body, controls, foot)
  /** ONE MARK DISMISSES THE WINDOW where the card's own row has stood down. */
  const shutMark = make('button', 'vitrine-shut')
  shutMark.type = 'button'
  // drawn, not a glyph: the cross's font differs between engines and shrank in one
  const cross = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  cross.setAttribute('viewBox', '0 0 16 16')
  cross.setAttribute('width', '16')
  cross.setAttribute('height', '16')
  cross.setAttribute('aria-hidden', 'true')
  const stroke = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  for (const [name, value] of [['d', 'M4 4l8 8M12 4l-8 8'], ['fill', 'none'], ['stroke', 'currentColor'], ['stroke-width', '1.4'], ['stroke-linecap', 'round']] as const) stroke.setAttribute(name, value)
  cross.append(stroke)
  shutMark.append(cross)
  /* SIDEWAYS, THE LOOK'S ONE KEY TO ITS WORDS: in the label column it reads
     on down the column, in the foot row's strip it raises the strip's column */
  const lookMore = make('button', 'vitrine-look-more')
  lookMore.type = 'button'
  const lookMoreWord = make('span', 'vitrine-look-more-word')
  const lookArrow = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  lookArrow.setAttribute('viewBox', '0 0 16 16')
  lookArrow.setAttribute('class', 'vitrine-look-arrow')
  lookArrow.setAttribute('aria-hidden', 'true')
  const lookArrowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  lookArrow.append(lookArrowPath)
  lookMore.append(lookMoreWord, lookArrow)
  /* SIDEWAYS THE WORK'S OWN TOOLS STAND BY THE LEFT HAND, over the walk's
     seats: a payload marks each with `data-tool`, and the window stands it
     in its place here while the form stands, and back where it was after */
  const tools = make('div', 'vitrine-tools')
  tools.hidden = true
  const TOOL_ORDER = ['way', 'zoom', 'whole', 'play', 'source', 'rule'] as const
  const toolSlots = new Map<string, HTMLElement>(TOOL_ORDER.map(kind => {
    const slot = make('div', `vitrine-tools-slot vitrine-tools-${kind}`)
    tools.append(slot)
    return [kind, slot]
  }))
  /** a film's clock runs along the film's own foot, over it */
  const clockFoot = make('div', 'vitrine-clockfoot')
  clockFoot.hidden = true
  toolSlots.set('clock', clockFoot)
  /** A BOOK'S PAGER under its seat in the label column: the step back, the
   * count, the step on, and the strip of its leaves behind the count */
  const pager = make('div', 'vitrine-pager')
  pager.hidden = true
  for (const kind of ['page', 'count', 'leaves']) toolSlots.set(kind, pager)
  /** where each tool stood before the form took it, so it goes back to the same place */
  const lent = new Map<HTMLElement, Comment>()
  /** a payload that marks no tools of its own (the live island) is read by its controls' own classes */
  const UNMARKED: readonly (readonly [string, string])[] = [['vitrine-play', 'play'], ['vitrine-track', 'clock'], ['vitrine-viewpoint', 'way'], ['vitrine-folio-glass', 'source']]
  const toolOf = (node: HTMLElement): string | undefined => node.dataset['tool']
    ?? (payloadControls.contains(node) ? UNMARKED.find(([cls]) => node.classList.contains(cls))?.[1] : undefined)
  // THE HAND MEETS THE WORDS FIRST: the card takes the focus on opening, and
  // the viewport and its controls follow it in the tab order.
  root.append(style, scrim, hole, sheet, card, stage, payloadControls, shutMark, tools, clockFoot)

  /* THE CLOSE LOOK IN VARIANT B. On a wide stage, behind its own switch, the
   * work takes the whole picture box and every word about it stands in one
   * band under it; the card, the plates and the payload's fixed row stand
   * down. With the switch off not one line below this changes. */
  const inBand = (): boolean => deskOn('closelook') && !options.narrow()
  let band: CloseLookBand | null = null
  function theBand(): CloseLookBand {
    if (band) return band
    band = createCloseLookBand({ lang: options.lang, back: () => up(), resized: () => layout() })
    root.append(band.element)
    return band
  }

  let open: string | null = null, invoker: HTMLElement | null = null
  let marked = false, popping = false, disposed = false
  let exhibit: VitrineExhibit | null = null
  let surface: VitrineSurface = 'room', resizeFrames = 0, laidAs: 'desk' | 'narrow' | 'cinema' | null = null
  /** the cinema form's measure while it stands, else null */
  let cinemaFrame: VitrineCinema | null = null
  let raised = false
  /** THE LINE THE CARD SAYS, whole, and its source row; the peek may say its own. */
  let spoken: { head: string | null; note: string | null; short: string | null; restNote: string | null; restSource: string | null
    own: VitrinePeek['own'] } = { head: null, note: null, short: null, restNote: null, restSource: null, own: null }
  const reducedMotion = view.matchMedia('(prefers-reduced-motion: reduce)')
  const rects = { view: { left: 0, top: 0, width: 0, height: 0 } as VitrineRect }

  function setSurface(kind: VitrineSurface): void {
    surface = kind
    root.dataset['surface'] = kind
    paintHole()
  }
  /** THE ROOM DIMS AROUND THE WORK, never over it. Held on a work the room
   * shows, the scrim leaves the work's own rectangle clear. */
  function paintHole(): void {
    // SIDEWAYS A WORK OF ITS OWN HANGS ON THE MUSEUM'S WALL: the room behind
    // it stands down whole, from the first frame
    if (cinemaFrame) root.dataset['lookWall'] = String(onWall())
    if (onWall()) { hole.hidden = true; scrim.hidden = false; return }
    // In the band the work is fitted to the stage's box and no longer stands
    // in its own rectangle on the room's frame, so there is no hole to cut.
    const work = surface === 'hold' && !inBand() ? exhibit?.work?.() ?? null : null
    hole.hidden = !work
    scrim.hidden = surface !== 'hold' || Boolean(work)
    if (!work) return
    Object.assign(hole.style, { left: `${work.left}px`, top: `${work.top}px`, width: `${work.width}px`, height: `${work.height}px` })
  }

  function place(el: HTMLElement, r: VitrineRect): void {
    el.style.left = `${Math.round(r.left)}px`
    el.style.top = `${Math.round(r.top)}px`
    el.style.width = `${Math.round(r.width)}px`
    el.style.height = `${Math.round(r.height)}px`
  }

  /** THE WIDE STAGE: the viewport left of the card, the card beside it, both
   * standing clear of the bar. THE NARROW STAGE: one sheet from under the
   * brand line to the bar, the viewport above and the card below, and the
   * payload's own controls in the thumb zone at the sheet's foot. */
  /** True while the window lays itself out: a payload's own layout renames
   * the card from inside it. */
  let laying = false
  function layout(): void {
    if (!open || laying) return
    laying = true
    try { layOut() } finally { laying = false }
  }
  function layOut(): void {
    const width = view.innerWidth, height = view.innerHeight
    const narrow = options.narrow()
    const floor = Math.min(height, Math.max(0, options.floor()))
    const frame = narrow ? options.cinema?.() ?? null : null
    root.dataset['narrow'] = String(narrow)
    const as = frame ? 'cinema' : narrow ? 'narrow' : 'desk'
    if (laidAs !== as) {
      if (as !== 'cinema') leaveCinema()
      laidAs = as
      if (frame) { body.insertBefore(payloadControls, words); seat.after(pager) }
      else if (narrow) card.insertBefore(payloadControls, controls)
      else if (!inBand()) root.append(payloadControls)
    }
    cinemaFrame = frame
    if (frame) layCinema(frame)
    else if (narrow) {
      // THE WINDOW OWNS THE PHONE. The station's chrome stands down while a
      // window is open, so the sheet runs to the foot of the screen and the
      // work is not read through a third of it.
      // a host that keeps its foot row under the window says so, and its floor holds
      const top = 58, bottom = (host.dataset['keepsFoot'] !== undefined ? floor : height) - 10, left = 8, right = width - 8
      const tall = bottom - top
      const fill = Boolean(exhibit?.payload?.fill)
      const viewHeight = fill ? tall : Math.round(Math.max(160, Math.min(320, tall * .34)))
      rects.view = { left, top, width: right - left, height: viewHeight }
      place(stage, rects.view)
      root.dataset['fill'] = String(fill)
      root.dataset['peek'] = String(fill && !raised)
      // THE PEEK IS WHAT IT HAS TO SHOW. A work whose name takes two lines
      // gets the two lines: the card is placed once to be measured in its
      // own width, and then at the height its own peek needs.
      let peek = Math.min(PEEK, Math.round(tall * .34))
      const place2 = (height: number): void => {
        const at = bottom - height
        place(sheet, { left, top: at, width: right - left, height })
        place(card, { left, top: at, width: right - left, height })
      }
      const lined = Boolean(exhibit?.payload?.lined)
      if (fill && !raised && lined) {
        // ONE REST HEIGHT FOR EVERY PAGE of a lined book, never over a third
        // of the screen: a page with less to say leaves its room empty
        peek = Math.max(0, Math.min(restHeight(place2), bottom - Math.ceil(height * WORK_AT_REST)))
        place2(peek)
        paintLine(() => body.scrollHeight <= body.clientHeight + 1)
      } else if (fill && !raised) {
        place2(peek)
        paintLine(peekRoom)
        peek = Math.min(Math.max(peek, peekAsked()), Math.round(tall * PEEK_MOST))
      } else paintLine(null)
      // The sheet is the card's ground; the viewport above it stays open to
      // the stage, so the work is seen and not a shade through a panel.
      // a raised card takes the height its words need, never more than its share
      if (fill && raised) place2(Math.round(tall * RAISED_SHARE))
      place2(fill ? (raised ? Math.max(peek, Math.min(Math.round(tall * RAISED_SHARE), raisedAsked())) : peek) : bottom - top - viewHeight)
      payloadControls.style.cssText = ''
      // a lined book's page runs to the stage's top corner, where its folio
      // stands: the mark waits above the stage there
      place(shutMark, { left: right - 50, top: lined ? Math.max(4, top - 51) : top + 6, width: 44, height: 44 })
      // The peek is what the payload keeps clear of the card, raised or not:
      // a card that rises stands OVER the work rather than resizing it.
      root.style.setProperty('--vitrine-peek', `${fill ? peek : 0}px`)
      grab.hidden = !fill
      shutMark.hidden = false
    } else if (inBand()) {
      paintLine(null)
      // THE WORK OWNS THE STAGE. The picture's box is the window less the
      // band, and the work is fitted inside it: nothing of the museum stands
      // on the work, and the work stands on nothing of the museum.
      const low = theBand().height()
      const box = { width, height: Math.max(1, height - low) }
      rects.view = {
        left: Math.round(box.width * (1 - WORK_SHARE) / 2),
        top: Math.round(box.height * (1 - WORK_SHARE) / 2),
        width: Math.round(box.width * WORK_SHARE),
        height: Math.round(box.height * WORK_SHARE),
      }
      place(stage, rects.view)
      sheet.style.cssText = ''
      delete root.dataset['fill']
      delete root.dataset['peek']
      root.style.removeProperty('--vitrine-peek')
      grab.hidden = true
      shutMark.hidden = true
      // the payload's own row is an instrument of the kind, so it stands in
      // the band's own place for one and keeps none of its fixed geometry
      payloadControls.style.cssText = ''
      const slot = theBand().instruments
      if (payloadControls.parentElement !== slot) slot.append(payloadControls)
    } else {
      paintLine(null)
      const cardWidth = Math.round(Math.min(380, Math.max(320, width * .26)))
      const top = 84, bottom = floor - 16, right = width - 28
      place(card, { left: right - cardWidth, top, width: cardWidth, height: bottom - top })
      rects.view = { left: 28, top, width: right - cardWidth - 24 - 28, height: bottom - top }
      place(stage, rects.view)
      sheet.style.cssText = ''
      delete root.dataset['fill']
      root.style.removeProperty('--vitrine-peek')
      delete root.dataset['peek']
      grab.hidden = true
      shutMark.hidden = true
      // The payload's controls stand under the work, inside the viewport.
      const row = payloadControls
      row.style.left = `${Math.round(rects.view.left)}px`
      row.style.width = `${Math.round(rects.view.width)}px`
      row.style.top = 'auto'
      row.style.bottom = `${Math.round(height - bottom)}px`
    }
    // ONE ATTRIBUTE CARRIES THE RULE. While a window stands on the phone the
    // station's chrome stands down, and the page's own frame reads this to
    // know it.
    if (narrow) document.documentElement.dataset['naWindow'] = 'phone'
    else if (deskAny()) document.documentElement.dataset['naWindow'] = 'desk'
    else delete document.documentElement.dataset['naWindow']
    paintHole()
    exhibit?.payload?.layout?.()
    if (cinemaFrame) placeFilm()
    fadeWords()
    markMore()
  }

  /** True while a work of the payload's own hangs on the wall: sideways, a
   * payload that knows its shape draws its own picture; a place is the room's. */
  const onWall = (): boolean => cinemaFrame !== null && typeof exhibit?.payload?.aspect === 'function' && surface !== 'own'

  /** THE LOOK SIDEWAYS. A work whose shape gives it more area beside a label
   * column stands BESIDE it at the stage's full height; a wider work, a film
   * and a machine's cycle stand UNDER, over the foot row, whose strip carries
   * the words. The walk's seats and gold keep their places in that row. */
  function layCinema(frame: VitrineCinema): void {
    const width = view.innerWidth, height = view.innerHeight
    const safe = frame.safe, right = safe.left + safe.width
    const left = safe.left + CINEMA.tools + CINEMA.toolsGap, top = safe.top + CINEMA.air
    const column = Math.round(Math.min(CINEMA.columnMost, Math.max(CINEMA.columnLeast, width * CINEMA.columnShare)))
    const filmed = Boolean(root.querySelector('[data-tool="clock"], .vitrine-clockfoot .vitrine-track, .vitrine-payload-controls .vitrine-track'))
    const beside: VitrineRect = { left, top, width: right - column - CINEMA.columnGap - left, height: height - CINEMA.air - top }
    const under: VitrineRect = { left, top, width: right - left, height: frame.row.top - CINEMA.rowGap - top }
    const aspect = exhibit?.payload?.aspect?.() ?? null
    const area = (shape: number, box: VitrineRect): number => { const across = Math.min(box.width, box.height * shape); return across * across / shape }
    const form = aspect && area(aspect, under) > area(aspect, beside) ? 'under' : 'beside'
    root.dataset['form'] = 'cinema'
    root.dataset['lookForm'] = form
    root.toggleAttribute('data-look-open', form === 'under' && raised)
    root.toggleAttribute('data-look-film', filmed)
    root.dataset['lookWall'] = String(onWall())
    root.dataset['lookAspect'] = aspect ? aspect.toFixed(3) : ''
    // the shape where both forms give a work the same area: wider than this, it stands under
    root.dataset['lookCrossover'] = (beside.width / under.height).toFixed(2)
    delete root.dataset['fill']
    delete root.dataset['peek']
    root.style.setProperty('--vitrine-peek', '0px')
    grab.hidden = true
    shutMark.hidden = true
    sheet.style.cssText = ''
    payloadControls.style.cssText = ''
    paintLine(null)
    nameIt(namingText.textContent ?? '', named.certainty ?? sureOf(exhibit?.certainty))
    rects.view = form === 'under' ? under : beside
    place(stage, rects.view)
    if (form === 'beside') {
      const head = safe.top + CINEMA.columnTop
      place(card, { left: right - column, top: head, width: column, height: frame.row.top - CINEMA.rowGap - head })
    } else {
      const stripTop = Math.round((frame.row.top + frame.row.bottom - CINEMA.strip) / 2)
      const from = Math.max(left, frame.row.seats + CINEMA.rowGap)
      const across = Math.max(120, frame.row.gold - 16 - from)
      if (!raised) place(card, { left: from, top: stripTop, width: across, height: CINEMA.strip })
      else {
        // the raised column grows up from the strip's foot, as tall as its words, never past the glass's head
        const foot = stripTop + CINEMA.strip, most = foot - (safe.top + 8), wide = Math.min(CINEMA.raised, across)
        place(card, { left: from, top: foot - most, width: wide, height: most })
        const asked = Math.min(most, raisedAsked())
        place(card, { left: from, top: foot - asked, width: wide, height: asked })
      }
    }
    gatherTools()
    toolWatch.observe(root, { childList: true, subtree: true })
    if (!tools.hidden) place(tools, { left: safe.left, top, width: CINEMA.tools - 8, height: frame.row.top - CINEMA.rowGap - top })
    paintLookMore()
  }
  /** A FILM'S FOOT: its clock along the film's lower edge, its line centred
   * over the clock, both on the film itself. A film that stands smaller than
   * the zone names its own box; one that runs to the glass is the zone's. */
  function placeFilm(): void {
    const filmed = root.hasAttribute('data-look-film')
    clockFoot.hidden = !filmed || !clockFoot.firstElementChild
    if (!filmed) return
    const zone = rects.view
    const own = exhibit?.payload?.filmBox?.() ?? null
    const left = Math.max(zone.left, own?.left ?? zone.left)
    const right = Math.min(zone.left + zone.width, own ? own.left + own.width : zone.left + zone.width)
    const foot = Math.min(zone.top + zone.height, own ? own.top + own.height : zone.top + zone.height)
    place(clockFoot, { left: left + CINEMA.clockInset, top: foot - CINEMA.clock, width: Math.max(44, right - left - 2 * CINEMA.clockInset), height: CINEMA.clock })
    const zoneFoot = zone.top + zone.height
    stage.style.setProperty('--film-left', `${Math.round(left - zone.left)}px`)
    stage.style.setProperty('--film-width', `${Math.round(right - left)}px`)
    stage.style.setProperty('--film-foot', `${Math.round(zoneFoot - foot)}px`)
    // the fall under the line: over the film's own width, or over the glass to its foot where the film runs on there
    const glass = { left: -zone.left, width: view.innerWidth, below: view.innerHeight - zoneFoot }
    const fall = own ? { left: left - zone.left, width: right - left, below: foot - zoneFoot } : glass
    stage.style.setProperty('--fall-left', `${Math.round(fall.left)}px`)
    stage.style.setProperty('--fall-width', `${Math.round(fall.width)}px`)
    stage.style.setProperty('--fall-below', `${Math.round(fall.below)}px`)
  }
  /** The payload's tools into the form's own places; one the form has no place for stays where it is. */
  function gatherTools(): void {
    if (!cinemaFrame) return
    let clocked = false
    for (const node of root.querySelectorAll<HTMLElement>('[data-tool], .vitrine-payload-controls :is(.vitrine-play, .vitrine-track, .vitrine-viewpoint, .vitrine-folio-glass)')) {
      if (lent.has(node)) continue
      const kind = toolOf(node)
      const slot = toolSlots.get(kind ?? '')
      if (!slot) continue
      const mark = document.createComment('')
      node.before(mark)
      lent.set(node, mark)
      slot.append(node)
      if (kind === 'clock') clocked = true
      // a step drawn as a glyph keeps its word as its name and its hint
      if (kind === 'zoom') {
        const word = node.textContent?.trim() ?? ''
        if (!node.hasAttribute('aria-label')) { node.setAttribute('aria-label', word); node.dataset['toolNamed'] = '' }
        if (!node.title) { node.title = node.getAttribute('aria-label') ?? word; node.dataset['toolHint'] = '' }
      }
    }
    tools.hidden = !tools.querySelector('.vitrine-tools-slot > *')
    arrangePager()
    // a clock that arrives after the look was laid out lays the film's foot again
    if (clocked && !root.hasAttribute('data-look-film')) queueMicrotask(() => layout())
  }
  /** The pager's middle is the book's own count, or the window's where the book names none. */
  function arrangePager(): void {
    const pages = [...pager.querySelectorAll<HTMLElement>('[data-tool="page"]')].filter(page => !page.hidden)
    const own = pager.querySelector<HTMLElement>('[data-tool="count"]')
    const borrow = pages.length > 0 && !own && !countButton.hidden
    if (borrow && countButton.parentElement !== pager) pager.append(countButton)
    else if (!borrow && countButton.parentElement !== seat) seat.append(countButton)
    pager.hidden = pages.length === 0
  }
  /** Every tool back where its payload put it. */
  function returnTools(): void {
    for (const [node, mark] of lent) {
      if (node.dataset['toolNamed'] !== undefined) { node.removeAttribute('aria-label'); delete node.dataset['toolNamed'] }
      if (node.dataset['toolHint'] !== undefined) { node.removeAttribute('title'); delete node.dataset['toolHint'] }
      if (mark.isConnected) mark.replaceWith(node)
      else { mark.remove(); node.remove() }
    }
    lent.clear()
    tools.hidden = true
    clockFoot.hidden = true
    if (countButton.parentElement !== seat) seat.append(countButton)
    pager.hidden = true
  }
  const toolWatch = new MutationObserver(() => gatherTools())
  /** The look's key says where it goes: on down the column, up into the strip's column, or back down. */
  function paintLookMore(): void {
    const frame = cinemaFrame
    if (!frame) { lookMore.remove(); return }
    if (lookMore.parentElement !== controls) controls.prepend(lookMore)
    const under = root.dataset['lookForm'] === 'under'
    const back = under && raised
    lookMoreWord.textContent = back ? frame.less : frame.more
    lookMore.setAttribute('aria-expanded', String(back))
    lookArrowPath.setAttribute('d', under && !back ? 'M8 13V3M4 7l4-4 4 4' : 'M8 3v10M4 9l4 4 4-4')
    // beside, the key stands only while words wait below in the column
    if (!under) lookMore.hidden = !(body.scrollHeight - body.scrollTop - body.clientHeight > 1)
    else lookMore.hidden = false
  }
  lookMore.addEventListener('click', () => {
    if (root.dataset['lookForm'] === 'under') { setRaised(!raised); return }
    body.scrollBy({ top: Math.max(44, body.clientHeight - 44), behavior: reducedMotion.matches ? 'auto' : 'smooth' })
  })
  // a detail pressed in the raised column folds it, so the work it moves to stands in view
  payloadControls.addEventListener('click', event => {
    if (cinemaFrame && raised && root.dataset['lookForm'] === 'under' && (event.target as Element | null)?.closest('button')) setRaised(false)
  })
  /** The look leaves the cinema form: the window's own phone or desk layout takes it back. */
  function leaveCinema(): void {
    for (const key of ['form', 'lookForm', 'lookOpen', 'lookWall', 'lookAspect', 'lookCrossover', 'lookFilm']) delete root.dataset[key]
    for (const name of ['--film-left', '--film-width', '--film-foot', '--fall-left', '--fall-width', '--fall-below']) stage.style.removeProperty(name)
    lookMore.remove()
    toolWatch.disconnect()
    returnTools()
    pager.remove()
    cinemaFrame = null
    nameIt(namingText.textContent ?? '', named.certainty)
  }

  /** The drawer's lower edge fades while more of its words waits below. */
  function markMore(): void {
    body.dataset['more'] = String(open && body.scrollHeight - body.scrollTop - body.clientHeight > 1)
    body.dataset['top'] = String(open && body.scrollTop < 1)
    if (cinemaFrame) paintLookMore()
  }
  body.addEventListener('scroll', markMore, { passive: true })

  /** THE DRAWER'S LAST LINE FADES OUT, IT NEVER BREAKS OFF. On the phone the
   * words' box ends where the controls begin. While words wait below, the
   * lower edge fades from the top of the lowest line it shows, so that line
   * dissolves as the sign of more, and the rest scrolls. */
  function fadeWords(): void {
    body.style.removeProperty('--fade')
    if (!open || !options.narrow() || body.scrollHeight <= body.clientHeight + 1) return
    const top = body.getBoundingClientRect().top + body.clientTop
    const floor = top + body.clientHeight
    const lines: DOMRect[] = []
    const range = document.createRange()
    const text = document.createTreeWalker(body, NodeFilter.SHOW_TEXT)
    for (let node = text.nextNode(); node; node = text.nextNode()) {
      if (!node.textContent?.trim()) continue
      range.selectNodeContents(node)
      for (const rect of range.getClientRects()) if (rect.height > 0) lines.push(rect)
    }
    if (!lines.some(r => r.bottom > floor + .5)) return
    let last = -Infinity
    for (const r of lines) if (r.top > top + .5 && r.top < floor - 4) last = Math.max(last, r.top)
    if (last > top) body.style.setProperty('--fade', `${Math.round(Math.min(44, Math.max(16, floor - last)))}px`)
  }
  /* the words change after the layout that placed them: a payload lays in its
     steps, a label opens, a face arrives; a peek measured before them is
     measured again, or its last line stands under the controls */
  const wordsResized = new ResizeObserver(() => {
    if (!open) return
    if (options.narrow() && root.dataset['peek'] === 'true') layout()
    else if (cinemaFrame && raised && root.dataset['lookForm'] === 'under') layout()
    else { fadeWords(); markMore() }
  })
  for (const part of [naming, seat, entryRow, line, note, words, aside, after]) wordsResized.observe(part)

  /** the certainty a payload named the card with, where it renamed it */
  const named: { certainty: string | null } = { certainty: null }
  /** sideways the label column has the room for the exhibit's own mark, as the desktop's band shows it */
  const sureOf = (key?: string | null): string | null => (key ? `var(--ui-sure-${key})` : null)
  /** The name at the head of the card, and the card's accessible name with
   * it: a window that named itself twice would be read twice. The mark
   * before it carries the exhibit's certainty where the payload has one. */
  function nameIt(title: string, certainty?: string | null): void {
    const said = title.trim()
    namingText.textContent = said
    naming.hidden = !said
    naming.lang = options.lang()
    namingDot.hidden = !certainty
    if (certainty) namingDot.style.setProperty('--certainty', uiSure(certainty))
    else namingDot.style.removeProperty('--certainty')
    if (said) {
      card.setAttribute('aria-labelledby', naming.id)
      card.removeAttribute('aria-label')
      return
    }
    card.setAttribute('aria-label', title)
    card.removeAttribute('aria-labelledby')
  }

  /** The folio and the count a set of pages by topic says, the count a
   * control where the exhibit opens its set from it; and the source row. */
  function paintPlace(place: VitrinePlace | null | undefined, row: string | null | undefined): void {
    spoken.note = row ?? null
    note.lang = options.lang()
    const count = place?.said ?? ''
    seat.hidden = !place?.seat && !count
    seat.lang = options.lang()
    seatWords.textContent = place?.seat ?? ''
    seatWords.hidden = !place?.seat
    countButton.textContent = count
    countButton.hidden = !count
    countButton.disabled = !exhibit?.onCount
    if (cinemaFrame) arrangePager()
  }
  countButton.addEventListener('click', () => exhibit?.onCount?.())

  /** The height the peek's words and the payload's row ask for; its slack
   * shrinks with a peek that trims the card's padding, never grows. */
  function peekAsked(): number {
    const own = view.getComputedStyle(card)
    const slack = Math.min(26, parseFloat(own.paddingTop) + parseFloat(own.paddingBottom) + 4)
    // a grab that reaches over the name gives its overlap back
    const reach = grab.hidden ? 0 : grab.getBoundingClientRect().height + Math.min(0, parseFloat(view.getComputedStyle(grab).marginBottom) || 0)
    return Math.ceil(reach + body.scrollHeight + payloadControls.getBoundingClientRect().height + slack)
  }
  /** The height the raised card's words and rows ask for: every row at its
   * own height, the words whole. */
  function raisedAsked(): number {
    const own = view.getComputedStyle(card)
    let asked = parseFloat(own.paddingTop) + parseFloat(own.paddingBottom) + parseFloat(own.borderTopWidth) + parseFloat(own.borderBottomWidth)
    for (const part of [...card.children] as HTMLElement[]) {
      if (part.hidden || view.getComputedStyle(part).display === 'none') continue
      const style = view.getComputedStyle(part)
      asked += (part === body ? bodyAsked() : part.getBoundingClientRect().height) + parseFloat(style.marginTop) + parseFloat(style.marginBottom)
    }
    return Math.ceil(asked) + 2
  }
  /** The words' own height: the body grows to the card it stands in, so its
   * scroll height is the card's and not the words'. */
  function bodyAsked(): number {
    const kids = ([...body.children] as HTMLElement[]).filter((kid) => kid.getClientRects().length > 0)
    if (!kids.length) return 0
    const edge = (kid: HTMLElement, side: 'marginTop' | 'marginBottom') => parseFloat(view.getComputedStyle(kid)[side]) || 0
    const top = Math.min(...kids.map((kid) => kid.getBoundingClientRect().top - edge(kid, 'marginTop')))
    const end = Math.max(...kids.map((kid) => kid.getBoundingClientRect().bottom + edge(kid, 'marginBottom')))
    const own = view.getComputedStyle(body)
    return end - top + parseFloat(own.paddingTop) + parseFloat(own.paddingBottom)
  }
  /** The peek the words ask for keeps the work its share above the sheet. */
  const peekRoom = (): boolean => view.innerHeight - 10 - peekAsked() >= Math.ceil(view.innerHeight * WORK_AT_REST)

  /** THE REST HEIGHT OF A LINED BOOK: what a one-row name, a one-row place,
   * a two-row line and a one-row source row ask for in the card's own
   * type, measured once per screen with stand-in words. */
  let restKey = '', restIdeal = 0
  function restHeight(placeAt: (height: number) => void): number {
    const key = [view.innerWidth, view.innerHeight, view.getComputedStyle(document.documentElement).fontSize,
      Math.round(payloadControls.getBoundingClientRect().height)].join('/')
    if (key === restKey) return restIdeal
    const kept = { name: namingText.textContent, seat: seat.hidden, words: seatWords.textContent, wordsHidden: seatWords.hidden,
      count: countButton.textContent, countHidden: countButton.hidden }
    namingText.textContent = 'M'
    seat.hidden = false; seatWords.hidden = false; seatWords.textContent = 'M'; countButton.hidden = false; countButton.textContent = 'M'
    line.hidden = false; line.replaceChildren('M', document.createElement('br'), 'M')
    note.hidden = false; note.replaceChildren('M', document.createElement('br'), 'M')
    // the card at no height, so the body's scroll height is its words' own
    placeAt(1)
    const own = view.getComputedStyle(card)
    restIdeal = Math.ceil(body.getBoundingClientRect().top - card.getBoundingClientRect().top + body.scrollHeight
      + payloadControls.getBoundingClientRect().height + parseFloat(own.paddingBottom) + 2)
    namingText.textContent = kept.name
    seat.hidden = kept.seat; seatWords.textContent = kept.words; seatWords.hidden = kept.wordsHidden
    countButton.textContent = kept.count; countButton.hidden = kept.countHidden
    restKey = key
    return restIdeal
  }

  /** Rows the line takes at its own width, by the font it is set in. */
  function rowsOf(el: HTMLElement): number {
    const range = document.createRange()
    range.selectNodeContents(el)
    const tops = new Set<number>()
    for (const r of range.getClientRects()) if (r.height > 0) tops.add(Math.round(r.top))
    return tops.size
  }

  /** THE LINE AT THE PEEK IS NEVER CUT. Whole on the raised card and on a
   * wide stage; at a lined book's peek, the line with the peek's own source
   * row where it keeps two rows and the words fit the peek, else the short
   * line with the picture's source row where that does, else the name row
   * with the source row alone. `room` says whether the words fit the peek;
   * null off the peek. */
  function paintLine(room: (() => boolean) | null): void {
    const own = room ? spoken.own : null
    const choices: Array<[string | null, string | null]> = own?.first ? []
      : [[spoken.head, room ? spoken.restNote ?? spoken.note : spoken.note]]
    if (own) choices.push([own.line, own.note])
    if (room) choices.push([spoken.short, spoken.restSource], [null, spoken.restSource], [null, null])
    for (const [head, row] of choices) {
      line.textContent = head ?? ''
      line.hidden = !head
      note.textContent = row ?? ''
      note.hidden = !row
      if (!room || !exhibit?.payload?.lined) return
      if ((!head || rowsOf(line) <= PEEK_LINE_ROWS) && room()) return
    }
  }

  /** The grabber says which way it goes, in the payload's own words where
   * it has them. */
  function nameTheGrabber(): void {
    const words = exhibit?.payload?.raiseWords
    grab.setAttribute('aria-label', words ? (raised ? words.down : words.up) : options.raiseLabel?.() ?? '')
  }

  /** The card over the work, or back to its peek. */
  function setRaised(open: boolean): void {
    if (raised === open) return
    raised = open
    grab.setAttribute('aria-expanded', String(raised))
    nameTheGrabber()
    if (!raised) body.scrollTop = 0
    layout()
  }

  const payloadHost = (): VitrinePayloadHost => ({
    element: payloadEl,
    controls: payloadControls,
    aside,
    caption,
    lang: options.lang(),
    narrow: options.narrow(),
    reducedMotion: reducedMotion.matches,
    banded: inBand(),
    cinema: () => cinemaFrame !== null,
    viewport: () => ({ ...rects.view }),
    work: () => (inBand() ? null : exhibit?.work?.() ?? null),
    surface: setSurface,
    describe: text => payloadEl.setAttribute('aria-label', text),
    raise: open => setRaised(open),
    peeked: () => !raised,
    step: (at, of) => band?.step(at, of),
    rename: (title, head, certainty, place, said, peek) => {
      named.certainty = certainty ?? null
      nameIt(title, certainty ?? (cinemaFrame ? sureOf(exhibit?.certainty) : null))
      const was = { ...spoken }
      if (head !== undefined) spoken = { ...spoken, head, short: peek?.line ?? null, restNote: peek?.note ?? null, restSource: peek?.source ?? null,
        own: peek?.own ?? null }
      if (said !== undefined) paintPlace(place, said)
      // a new line at the peek is chosen by the peek's own layout, which
      // measures it from the peek's least height; the same line stays as chosen
      const changed = was.head !== spoken.head || was.short !== spoken.short || was.note !== spoken.note || was.restNote !== spoken.restNote
        || was.restSource !== spoken.restSource || was.own?.line !== spoken.own?.line || was.own?.first !== spoken.own?.first
      if (changed) {
        if (options.narrow() && root.dataset['peek'] === 'true' && !laying) layout()
        else paintLine(null)
      }
      if (exhibit && inBand()) showInBand({ ...exhibit, title, line: head ?? exhibit.line, set: place ?? exhibit.set,
        note: said === undefined ? exhibit.note : said })
      // sideways a page whose shape arrives with it may stand in the other form
      const shape = exhibit?.payload?.aspect?.()
      if (cinemaFrame && !laying && (shape ? shape.toFixed(3) : '') !== root.dataset['lookAspect']) layout()
    },
  })

  /** THE LABEL UNDER THE WORK, composed of what the window already has: the
   * name, the line, the module's own sentences behind one word, and the
   * wing's own control nodes, each under the role the wing gave it. */
  function showInBand(next: VitrineExhibit): void {
    const slot = theBand().instruments
    // the slot is the band's, and the kind's: what the exhibit before it lent
    // there goes back with it
    for (const old of [...slot.children]) if (old !== payloadControls) old.remove()
    const roles = new Map<string, HTMLElement>()
    for (const node of next.controls) {
      const role = node.dataset['role'] ?? ''
      if (role && !roles.has(role)) roles.set(role, node)
    }
    // A PAINTING'S ONE INSTRUMENT IS ITS ZOOM: the way into the whole plate
    // is the kind's own control, so it stands where instruments stand.
    const zoom = roles.get('zoom')
    if (zoom) slot.prepend(zoom)
    const walk = next.walk ?? []
    const live = (node?: HTMLElement | null): HTMLElement | null =>
      node && !(node as HTMLButtonElement).disabled ? node : null
    // A SET THE STATION CANNOT WALK IS WALKED BY THE PAYLOAD: a book steps
    // its own sides where the row holds one volume.
    const steps = payloadControls.querySelectorAll<HTMLElement>('.vitrine-step')
    // A SET THE WING WALKS IS WALKED TO ITS END: past the last book of a
    // shelf the gold rests, and the book's own arrows keep turning its pages.
    const on = walk[1] ?? live(steps[1]) ?? null
    const back = walk[0] ?? live(steps[0]) ?? null
    // past the set's end the host may hand the gold its own way on
    const onward = live(on) ? null : onwardOf()
    // A MACHINE'S STEPS ARE THE RUN'S CAPTIONS, one at a time under the work,
    // so the list of them does not stand in the label as well.
    const paged = next.payload?.kind !== 'machine'
    theBand().show({
      id: next.id,
      // the name and the line the card is showing now, which a payload that
      // walks its own sides has already renamed
      title: namingText.textContent || next.title,
      line: spoken.head || next.line,
      note: next.note ?? null,
      kind: next.payload?.kind ?? '',
      certainty: next.certainty ?? null,
      set: next.set ?? null,
      catalogue: next.catalogue ?? null,
      room: next.upLabel ?? options.room?.() ?? '',
      words: [...next.card, ...(paged ? [aside] : []), ...(next.after ?? [])],
      record: roles.get('record') ?? null,
      text: roles.get('text') ?? null,
      back,
      on: onward ? onwardPress(onward) : on,
      // the work the way on leads to, where the set knows its name
      onTitle: onward ? onward.title : on && walk.includes(on) ? on.getAttribute('aria-label') : null,
      // no walk of the wing's: the way on is the payload's own page, or none
      paging: !onward && !walk[1],
      onKicker: onward?.kicker ?? next.onKicker ?? null,
      onUp: Boolean(onward?.up),
    })
  }
  function onwardOf(): VitrineOnward | null {
    const asked = new CustomEvent<{ onward: VitrineOnward | null }>(VITRINE_ONWARD, { detail: { onward: null } })
    host.dispatchEvent(asked)
    return asked.detail.onward
  }
  /** the band presses a node, so the host's way on is one it never shows */
  function onwardPress(onward: VitrineOnward): HTMLElement {
    const press = make('button', '')
    press.type = 'button'
    press.addEventListener('click', () => onward.go())
    return press
  }

  /** Our own entry, so a visitor's Back dismisses the exhibit and nothing
   * else. The address does not change: an exhibit is a place inside a
   * station, not a second station. */
  function mark(): void {
    const state = { ...(view.history.state as object | null ?? {}), [HISTORY_MARK]: open }
    view.history.pushState(state, '')
    marked = true
  }
  function unmark(): void {
    const state = view.history.state as Record<string, unknown> | null
    const ours = marked && state?.[HISTORY_MARK] !== undefined
    marked = false
    if (!ours) return
    popping = true
    view.history.back()
  }
  /** The payload leaves the stage as it found it, and the room draws again. */
  function unmountPayload(): void {
    // the tools go home first, so the payload takes down its own
    returnTools()
    const payload = exhibit?.payload
    if (payload) {
      try { payload.unmount() } catch (error) { console.error(error) }
    }
    payloadEl.textContent = ''
    payloadEl.removeAttribute('aria-label')
    payloadControls.textContent = ''
    aside.textContent = ''
    caption.textContent = ''
    setSurface('room')
  }
  function dismiss(): void {
    if (!open) return
    const id = open
    open = null
    unmountPayload()
    exhibit = null
    // the picture takes the whole window back with the band, and the row the
    // band borrowed goes home before the window is struck
    band?.clear()
    if (payloadControls.parentElement !== root) root.append(payloadControls)
    root.hidden = true
    root.remove()
    delete document.documentElement.dataset['naWindow']
    words.textContent = ''
    after.textContent = ''
    controls.textContent = ''
    onClose(id)
    const back = invoker?.isConnected && invoker.getClientRects().length ? invoker : options.returnFocus?.(id) ?? null
    invoker = null
    back?.focus({ preventScroll: true })
  }
  const leaving = new AbortController()
  shutMark.addEventListener('click', () => { if (exhibit?.shut) exhibit.shut(); else shut() })
  grab.addEventListener('click', () => setRaised(!raised))
  // what a card opens at its peek opens on the raised card, never in a peek's few lines
  body.addEventListener('click', event => {
    if (root.dataset['peek'] === 'true' && (event.target as Element | null)?.closest('.vitrine-more')) setRaised(true)
  })
  // A DRAG ON THE GRABBER IS THE SAME GESTURE THE STATION'S SHEET TAKES: up
  // raises, down lowers, and a short one is a press.
  let grabFrom = 0, grabHeld = false
  grab.addEventListener('pointerdown', event => { if (!event.isPrimary) return; grabHeld = true; grabFrom = event.clientY })
  grab.addEventListener('pointerup', event => {
    if (!grabHeld) return
    grabHeld = false
    const dy = event.clientY - grabFrom
    if (Math.abs(dy) <= GRAB_SLOP) return
    setRaised(dy <= -GRAB_PX ? true : dy >= GRAB_PX ? false : raised)
  })
  grab.addEventListener('pointercancel', () => { grabHeld = false })
  view.addEventListener('popstate', () => {
    if (popping) { popping = false; return }
    if (!open) return
    marked = false
    // the browser's Back is one level up as well; the level it lands on
    // keeps one entry of its own for the next Back
    if (exhibit?.up) { mark(); exhibit.up(); return }
    dismiss()
  }, { signal: leaving.signal })
  view.addEventListener('resize', () => {
    if (!open) return
    resizeFrames = RESIZE_FRAMES
    layout()
  }, { signal: leaving.signal })

  function shut(pop = true): void {
    if (!open) return
    if (pop) unmark(); else marked = false
    dismiss()
  }
  function up(): void {
    if (!open) return
    if (exhibit?.up) { exhibit.up(); return }
    shut()
  }

  return {
    get id() { return open },
    get surface() { return surface },
    element: card,
    foot,
    open(next, from = null, how = 'enter') {
      if (disposed) return
      if (open === next.id) return
      const previous = open
      const advancing = how === 'advance' && previous !== null
      // WALKING ON IS NOT A SECOND OPENING. The window stays mounted, the one
      // history entry stays where it is, and the hand keeps the control it
      // was on, so a visitor holding next walks the wall with one finger.
      const inside = advancing && (card.contains(document.activeElement) || payloadControls.contains(document.activeElement))
      const hand = inside ? document.activeElement : null
      const held = hand ? [...controls.children].findIndex(child => child.contains(hand)) : -1
      if (previous && !advancing) { marked = false; dismiss() }
      if (advancing) unmountPayload()
      open = next.id
      exhibit = next
      raised = false
      grab.setAttribute('aria-expanded', 'false')
      shutMark.setAttribute('aria-label', options.closeLabel?.() ?? '')
      root.dataset['payload'] = next.payload?.kind ?? ''
      nameTheGrabber()
      if (!advancing) invoker = from
      root.dataset['exhibit'] = next.id
      card.dataset['exhibit'] = next.id
      named.certainty = null
      nameIt(next.title)
      const entry = next.catalogue ?? null
      namingNumber.textContent = entry?.number ?? ''
      namingNumber.hidden = !entry
      entryRow.textContent = entry ? [entry.date, entry.where].filter(Boolean).join(' · ') : ''
      entryRow.hidden = !entry
      entryRow.lang = options.lang()
      spoken = { head: next.line ?? null, note: null, short: next.peek?.line ?? null, restNote: next.peek?.note ?? null,
        restSource: next.peek?.source ?? null, own: next.peek?.own ?? null }
      line.lang = options.lang()
      paintPlace(next.set?.said || next.set?.seat ? next.set : null, next.note)
      paintLine(null)
      words.replaceChildren(...next.card)
      after.replaceChildren(...next.after ?? [])
      body.scrollTop = 0
      // The two that walk the wall stand at the two ends of the controls' row.
      const [previousControl, nextControl] = next.walk ?? []
      controls.replaceChildren(...[previousControl, ...next.controls, nextControl].filter((node): node is HTMLElement => Boolean(node)))
      root.hidden = false
      if (!root.isConnected) host.append(root)
      if (!advancing) mark()
      laidAs = null
      layout()
      // The eye walks where it can walk. On calm, on the phone and under
      // reduced motion it stands still and the window opens where it stands.
      onOpen(next.id, advancing ? previous : null)
      // THE ONE DOOR OF THE NIGHT. Every close look of every kind opens here,
      // so the visitor's own record is written by one line and holds nothing
      // a visitor did not open.
      noteOpened(next.id)
      next.payload?.mount(payloadHost())
      // The label is composed after the payload has built its own row, so the
      // band takes the kind's instruments as they really are.
      if (inBand()) showInBand(next)
      layout()
      const row = [...controls.children]
      const back = held < 0 ? null : row[Math.min(held, row.length - 1)]
      if (back instanceof HTMLElement && !(back as HTMLButtonElement).disabled) back.focus({ preventScroll: true })
      else if (!advancing || inside) card.focus({ preventScroll: true })
    },
    close: shut,
    back: up,
    escape() {
      if (!open) return false
      up()
      return true
    },
    owns(target) {
      return open !== null && target !== null && (card.contains(target) || stage.contains(target) || payloadControls.contains(target))
    },
    key(event) {
      if (!open) return false
      // THE PAYLOAD TAKES ITS OWN KEYS FIRST, then the label: the band's two
      // are the ones no payload claims, Escape out of the drawer and Space.
      if (exhibit?.payload?.key?.(event)) return true
      return inBand() ? Boolean(band?.key(event)) : false
    },
    held() {
      return open !== null && surface === 'hold' && resizeFrames === 0
    },
    reading() {
      if (!open) return null
      const reader = inBand() ? theBand().element : options.narrow() && !cinemaFrame ? sheet : card
      const box = reader.getBoundingClientRect()
      return { left: box.left, top: box.top, width: box.width, height: box.height }
    },
    update(dt) {
      if (!open) return
      if (resizeFrames > 0) resizeFrames--
      exhibit?.payload?.update?.(dt)
    },
    layout,
    dispose() {
      disposed = true
      if (open) { unmountPayload(); open = null; exhibit = null }
      band?.dispose()
      band = null
      wordsResized.disconnect()
      toolWatch.disconnect()
      leaving.abort()
      delete document.documentElement.dataset['naWindow']
      root.remove()
    },
  }
}
