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
import { maskWholeLines, unmaskLines, wholeLines, type LineCut } from './whole-lines'
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
/** THE READING WINDOW: the share of the sheet a raised card takes over the
 * work at most. The rest stays the work's, so a reader sees what the words
 * are about and where the window goes back to. */
const READ_SHARE = .86
/** However much its own peek asks for, a card never takes more of the sheet
 * than this: the work is what the window is for. */
const PEEK_MOST = .42
/** A peek that shows the line gives it this many rows and never cuts it,
 * and keeps the work this share of the screen above the sheet. */
const PEEK_LINE_ROWS = 2
const WORK_AT_REST = 2 / 3
/** The air a plate keeps in a stage it cannot fill, above and below together, before its line may take the rest. */
const REST_AIR = 24
/** A drag on the grabber this far decides; a shorter one is a press. */
const GRAB_PX = 24
const GRAB_SLOP = 8
/** THE WORK OWNS THE STAGE: it fills this share of the stage's limiting side,
 * and the rest is the air every hung thing needs around it. */
const WORK_SHARE = .92
/** THE PHONE HELD SIDEWAYS: the work's zone from the glass's left edge, and a
 * label column at the right where a work stands beside its words; the close
 * mark at the column's head, the look's ways in the foot row under it. */
const CINEMA = {
  /** the label column: a share of the glass between two bounds, its gap to the work, its head */
  columnLeast: 256, columnMost: 300, columnShare: .31, columnGap: 28, columnTop: 18,
  /** where a work leaves width it cannot use at the glass's height, the column takes it, up to this */
  columnRest: 380,
  /** the reading window: a share of the glass inside its safe areas, up to a measure a line reads well in */
  readShare: .6, readMost: 460,
  /** the close mark, the air it keeps, a seat of the foot row, and the most air between two seats that stand together */
  shut: 44, shutGap: 8, seat: 44, together: 24,
  /** the air at the glass's top and foot, and over the foot row */
  air: 10, rowGap: 12,
  /** the strip in the foot row */
  strip: 52,
  /** the clock's band along a film's foot, and its inset from the film's sides */
  clock: 44, clockInset: 16,
  /** the air between a film's subject and its clock, where the film's line stands in the label column */
  clockAir: 6,
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
  /* THE STRIP'S TWO ROWS end on a whole word: what they show is a copy cut
     at a word's end, or the first whole sentence; the name and the line
     themselves stay whole for a screen reader */
  const stripName = make('span', 'vitrine-strip-copy vitrine-strip-name')
  const stripLine = make('p', 'vitrine-strip-copy vitrine-strip-line')
  for (const copy of [stripName, stripLine]) copy.setAttribute('aria-hidden', 'true')
  const naming = make('h2', 'vitrine-name')
  naming.id = `${options.id}-name`
  setRegister(naming, 'label')
  const namingDot = make('span', 'vitrine-name-dot')
  namingDot.setAttribute('aria-hidden', 'true')
  const namingText = make('span', 'vitrine-name-text')
  // the number cast on the work's frame, before its name
  const namingNumber = make('span', 'vitrine-name-number')
  namingNumber.hidden = true
  naming.append(namingDot, namingNumber, namingText, stripName)
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
  body.append(naming, seat, entryRow, line, stripLine, note, words, aside, after)
  const controls = make('div', 'vitrine-controls')
  const foot = make('div', 'vitrine-foot')
  /** THE CARD IS A SHEET ON THE PHONE. The grabber raises it over the work
   * and puts it back, and the work keeps the screen between the two. */
  const grab = make('button', 'vitrine-grab')
  grab.type = 'button'
  grab.setAttribute('aria-controls', options.id)
  // the word the opened window's grab says, where a form draws it
  const grabSays = make('span', 'vitrine-grab-says')
  grabSays.setAttribute('aria-hidden', 'true')
  grab.append(grabSays)
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
  /* SIDEWAYS, THE LOOK'S ONE KEY TO ITS WORDS: it opens the reading window,
     from the label column and from the foot row's strip alike */
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
  /** and its other key, in the same seat while the reading window stands: back to the label at rest */
  const lookLess = make('button', 'vitrine-look-more vitrine-look-less')
  lookLess.type = 'button'
  const lookLessWord = make('span', 'vitrine-look-more-word')
  const lessArrow = lookArrow.cloneNode(true) as SVGSVGElement
  const lessArrowPath = lessArrow.firstElementChild as SVGPathElement
  lookLess.append(lookLessWord, lessArrow)
  /* ON A PHONE THE WORK'S OWN TOOLS LEAVE THE CARD: a payload marks each with
     `data-tool`, and the window stands it in its place here while the form
     stands, and back where it was after. THE FINGERS ZOOM, so the plate's
     steps are not drawn there: they keep their names and their place in the
     reading order here, and show while a keyboard holds one of them */
  const tools = make('div', 'vitrine-tools')
  tools.hidden = true
  const toolSlots = new Map<string, HTMLElement>([['zoom', tools], ['whole', tools]])
  /** a film's pause, its clock and its sheet run along the film's own foot, over it */
  const clockFoot = make('div', 'vitrine-clockfoot')
  clockFoot.hidden = true
  for (const kind of ['play', 'clock', 'source']) toolSlots.set(kind, clockFoot)
  /** the tools an upright phone lends: the rest keep the card's own row there */
  const UPRIGHT_LENDS = new Set(['zoom', 'whole', 'turn'])
  /** A BOOK'S PAGER under its seat in the label column: the step back, the
   * count, the step on, and the strip of its leaves behind the count */
  const pager = make('div', 'vitrine-pager')
  pager.hidden = true
  for (const kind of ['page', 'count', 'leaves']) toolSlots.set(kind, pager)
  /** UPRIGHT, A BOOK WITHOUT A STRIP steps from the card's head, beside the
   * page's name: the row the two steps kept alone goes to the page */
  const headSteps = make('div', 'vitrine-headsteps')
  headSteps.hidden = true
  /** where each tool stood before the form took it, so it goes back to the same place */
  const lent = new Map<HTMLElement, Comment>()
  /** a payload that marks no tools of its own (the live island) is read by its controls' own classes */
  const UNMARKED: readonly (readonly [string, string])[] = [['vitrine-play', 'play'], ['vitrine-track', 'clock'], ['vitrine-folio-glass', 'source']]
  /** THE HOST'S WAY ON, where it keeps its foot row under the window: a work's
   * own turn (a page's other way) stands left of it, in that row */
  const wayOn = (): HTMLElement | null => (host.dataset['keepsFoot'] !== undefined ? host.querySelector<HTMLElement>('.film-foot > .film-gold') : null)
  grab.after(headSteps)
  /** true where a book's steps stand at the card's head: upright, at rest, a lined book with no strip of its own */
  const stepsAtHead = (): boolean => !cinemaFrame && !raised && Boolean(exhibit?.payload?.lined)
    && host.dataset['keepsFoot'] !== undefined && root.querySelector('.reader[data-strip="false"]') !== null
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
  /** what the folded card kept clear of the work at rest: the reading window rises over the work and never resizes it */
  let restPeek: number | null = null
  /** THE LINE THE CARD SAYS, whole, and its source row; the peek may say its own. */
  let spoken: { head: string | null; note: string | null; short: string | null; restNote: string | null; restSource: string | null
    own: VitrinePeek['own'] } = { head: null, note: null, short: null, restNote: null, restSource: null, own: null }
  const reducedMotion = view.matchMedia('(prefers-reduced-motion: reduce)')
  const rects = { view: { left: 0, top: 0, width: 0, height: 0 } as VitrineRect, field: null as VitrineRect | null }

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
    try { layOut(); keptAsShown() } finally { laying = false }
  }
  /** WORDS KEPT BEHIND A CARD'S SECOND DOOR come up with the window in the forms that show them there: shown,
   * they carry no hidden attribute, or a reader of the screen skips what the eye reads; folded, the door's state returns. */
  const keptHidden = new Set<HTMLElement>()
  function keptAsShown(): void {
    for (const kept of keptHidden) kept.hidden = true
    keptHidden.clear()
    if (!raised) return
    for (const kept of card.querySelectorAll<HTMLElement>('.vitrine-words > .vitrine-description[hidden]')) {
      if (view.getComputedStyle(kept).display === 'none') continue
      keptHidden.add(kept)
      kept.hidden = false
    }
  }
  function layOut(): void {
    const width = view.innerWidth, height = view.innerHeight
    const narrow = options.narrow()
    const floor = Math.min(height, Math.max(0, options.floor()))
    const frame = narrow ? options.cinema?.() ?? null : null
    root.dataset['narrow'] = String(narrow)
    const as = frame ? 'cinema' : narrow ? 'narrow' : 'desk'
    /* WHILE THE PHONE'S WINDOW IS READ the work's own row and the card's row
       ride the words, after their last line; everywhere else they stand under them */
    const reading = as === 'narrow' && raised && Boolean(exhibit?.payload?.fill)
    if (!reading && controls.parentElement !== card) card.insertBefore(controls, foot)
    if (laidAs !== as) {
      if (as !== 'cinema') leaveCinema()
      // every lent tool goes home, and the new form lends what it has a place for
      returnTools()
      if (as === 'desk') toolWatch.disconnect()
      laidAs = as
      if (frame) { body.insertBefore(payloadControls, words); seat.after(pager) }
      else if (!narrow && !inBand()) root.append(payloadControls)
    }
    if (as === 'narrow') {
      if (reading) body.append(payloadControls, controls)
      else if (payloadControls.parentElement !== card) card.insertBefore(payloadControls, controls)
    }
    if (as !== 'narrow') { delete root.dataset['read']; delete root.dataset['restLine'] }
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
      root.dataset['read'] = String(reading)
      grab.hidden = !fill
      // the plate's steps leave the card before it is measured: the fingers zoom
      if (!stepsAtHead()) giveBack(headSteps)
      gatherTools()
      toolWatch.observe(root, { childList: true, subtree: true })
      // THE PEEK IS WHAT IT HAS TO SHOW. A work whose name takes two lines
      // gets the two lines: the card is placed once to be measured in its
      // own width, and then at the height its own peek needs.
      let peek = raised && restPeek !== null ? restPeek : Math.min(PEEK, Math.round(tall * .34))
      const place2 = (height: number): void => {
        const at = bottom - height
        place(sheet, { left, top: at, width: right - left, height })
        place(card, { left, top: at, width: right - left, height })
      }
      const lined = Boolean(exhibit?.payload?.lined)
      delete root.dataset['restLine']
      if (fill && !raised && lined) {
        // ONE REST HEIGHT FOR EVERY PAGE of a lined book, never over a third
        // of the screen: a page with less to say leaves its room empty
        peek = Math.max(0, restHeight(place2, bottom - Math.ceil(height * WORK_AT_REST)))
        place2(peek)
        paintLine(() => body.scrollHeight <= body.clientHeight + 1)
      } else if (fill && !raised) {
        place2(peek)
        paintLine(peekRoom)
        // where the host keeps its foot row the card at rest is what it has to show, and the work takes the rest
        const snug = host.dataset['keepsFoot'] !== undefined
        peek = Math.min(snug ? restAsked() : Math.max(peek, peekAsked()), Math.round(tall * PEEK_MOST))
        /* A PLATE THAT CANNOT USE THE STAGE'S HEIGHT leaves it to its line: fitted
           by its width, it stands as large with the line under its name as without */
        const shape = snug && exhibit?.payload?.kind === 'deep-plate' && spoken.head ? exhibit.payload.aspect?.() ?? null : null
        if (shape && tall - peek - Math.ceil((right - left) / shape) - REST_AIR > 0) {
          root.dataset['restLine'] = 'true'
          const said = Math.min(restAsked(), Math.round(tall * PEEK_MOST))
          if (tall - said - Math.ceil((right - left) / shape) - REST_AIR >= 0) peek = said
          else delete root.dataset['restLine']
        }
      } else paintLine(null)
      // The sheet is the card's ground; the viewport above it stays open to
      // the stage, so the work is seen and not a shade through a panel.
      // a raised card takes the height its words need, never more than its share
      if (fill && raised) place2(Math.round(tall * READ_SHARE))
      place2(fill ? (raised ? Math.max(peek, Math.min(Math.round(tall * READ_SHARE), raisedAsked())) : peek) : bottom - top - viewHeight)
      if (fill && !raised) restPeek = peek
      payloadControls.style.cssText = ''
      // a lined book's page runs to the stage's top corner, where its folio
      // stands: the mark waits above the stage there
      place(shutMark, { left: right - 50, top: lined ? Math.max(4, top - 51) : top + 6, width: 44, height: 44 })
      // The peek is what the payload keeps clear of the card, raised or not:
      // a card that rises stands OVER the work rather than resizing it.
      root.style.setProperty('--vitrine-peek', `${fill ? peek : 0}px`)
      shutMark.hidden = false
      // the unseen steps' place while a keyboard holds one: the work's lower left, over the card
      const low = fill ? bottom - peek : top + viewHeight
      Object.assign(tools.style, { left: `${left + 8}px`, top: `${Math.round(low - 52)}px` })
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
    if (cinemaFrame) { clampWords(); paintLookMore() }
  }

  /** True while a work of the payload's own hangs on the wall: sideways, a
   * payload that knows its shape draws its own picture; a place is the room's. */
  const onWall = (): boolean => cinemaFrame !== null && typeof exhibit?.payload?.aspect === 'function' && surface !== 'own'

  /** THE LOOK SIDEWAYS. A work whose shape gives it more area beside a label
   * column stands BESIDE it at the stage's full height; a wider work stands
   * UNDER, over the foot row, whose strip carries the words. Nothing of the
   * museum stands left of the work: the close mark is at the glass's upper
   * right, the column's head, and the look's ways stand in the foot row
   * under the column. */
  function layCinema(frame: VitrineCinema): void {
    const width = view.innerWidth, height = view.innerHeight
    const safe = frame.safe, right = safe.left + safe.width
    const left = safe.left, top = safe.top + CINEMA.air
    const across = right - left, down = height - CINEMA.air - top
    const filmed = Boolean(root.querySelector('[data-tool="clock"], .vitrine-clockfoot .vitrine-track, .vitrine-payload-controls .vitrine-track'))
    const aspect = exhibit?.payload?.aspect?.() ?? null
    /* A MACHINE RESTS BESIDE ITS WORDS: its film's frame is wide, but the
       machine inside it stands taller in the field at the glass's height than
       over the strip, and its step's line reads in the label column */
    const machine = exhibit?.payload?.kind === 'machine'
    /* THE LOOK'S WAYS (the work before, a page's other way, gold) stand
       together at the foot row's right: the column over them is as wide as
       they are, so a work at the glass's full height never runs under them */
    // a work that cannot use the zone's whole width at the glass's height leaves the rest to its words
    const spare = aspect && !machine ? across - CINEMA.columnGap - Math.ceil(down * aspect) : 0
    const ways = waysWide(frame, right, spare)
    const least = Math.max(Math.round(Math.min(CINEMA.columnMost, Math.max(CINEMA.columnLeast, width * CINEMA.columnShare))),
      Math.min(Math.ceil(ways), Math.round(across * CINEMA.readShare)))
    const rest = Math.max(least, Math.min(CINEMA.columnRest, spare))
    // THE READING WINDOW: the words take most of the glass, and the work, still whole, what is left
    const column = raised ? Math.max(rest, Math.round(Math.min(CINEMA.readMost, across * CINEMA.readShare))) : rest
    const besideOf = (words: number): VitrineRect => ({ left, top, width: right - words - CINEMA.columnGap - left, height: down })
    const beside = besideOf(column)
    const under: VitrineRect = { left, top, width: across, height: frame.row.top - CINEMA.rowGap - top }
    const area = (shape: number, box: VitrineRect): number => { const wide = Math.min(box.width, box.height * shape); return wide * wide / shape }
    // a work that stands under steps aside when its words open: the words take the column, the work the place beside it
    const home = !machine && aspect && area(aspect, under) > area(aspect, besideOf(rest)) ? 'under' : 'beside'
    const form = home === 'under' && raised ? 'beside' : home
    // under the close mark a work steps aside, where that costs it nothing
    if (form === 'under' && aspect) {
      const wide = Math.min(under.width, under.height * aspect), reach = CINEMA.shut + CINEMA.shutGap
      if ((under.width - wide) / 2 < reach && under.width - reach >= wide) under.width -= reach
    }
    root.dataset['form'] = 'cinema'
    root.dataset['lookForm'] = form
    root.dataset['lookHome'] = home
    root.toggleAttribute('data-look-open', raised)
    root.toggleAttribute('data-look-film', filmed)
    root.dataset['lookWall'] = String(onWall())
    root.dataset['lookAspect'] = aspect ? aspect.toFixed(3) : ''
    // the shape where both forms give a work the same area: wider than this, it stands under
    root.dataset['lookCrossover'] = (besideOf(rest).width / under.height).toFixed(2)
    delete root.dataset['fill']
    delete root.dataset['peek']
    root.style.setProperty('--vitrine-peek', '0px')
    grab.hidden = true
    sheet.style.cssText = ''
    payloadControls.style.cssText = ''
    paintLine(null)
    nameIt(namingText.textContent ?? '', named.certainty ?? sureOf(exhibit?.certainty))
    rects.view = form === 'under' ? under : beside
    place(stage, rects.view)
    // a filmed machine beside its words says its step in the label column, over the column's keys
    const aside = machine && filmed && form === 'beside'
    root.toggleAttribute('data-look-aside', aside)
    if (aside && caption.parentElement !== card) { card.insertBefore(caption, controls); wordsResized.observe(caption) }
    else if (!aside && caption.parentElement !== stage) { stage.append(caption); wordsResized.unobserve(caption) }
    if (form === 'beside') {
      /* THE LABEL COLUMN IS A BOX ON THE WALL in the walk's own ground, from
         the glass's top air to the foot row; its left padding keeps the words
         where the column stands */
      const from = right - column - CINEMA.columnGap / 2
      place(card, { left: from, top, width: right - from, height: frame.row.top - CINEMA.rowGap - top })
      card.style.paddingLeft = `${Math.round(CINEMA.columnGap / 2)}px`
    } else {
      // the strip runs from the glass's left edge to the look's ways
      card.style.removeProperty('padding-left')
      const stripTop = Math.round((frame.row.top + frame.row.bottom - CINEMA.strip) / 2)
      place(card, { left, top: stripTop, width: Math.max(120, right - ways - 16 - left), height: CINEMA.strip })
    }
    // the part of the glass a film may run to: all of it under the strip, all but the label column beside it
    rects.field = form === 'under' ? { left: 0, top: 0, width, height } : { left: 0, top: 0, width: right - column - CINEMA.columnGap / 2, height }
    // ONE CLOSE, where the column's head is: it keeps its place whatever the card does
    shutMark.hidden = false
    place(shutMark, { left: right - CINEMA.shut, top, width: CINEMA.shut, height: CINEMA.shut })
    gatherTools()
    toolWatch.observe(root, { childList: true, subtree: true })
    // the unseen steps' place while a keyboard holds one: the work's lower left, over the glass's own foot bar
    Object.assign(tools.style, { left: `${Math.round(rects.view.left + 8)}px`, top: `${Math.round(Math.min(rects.view.top + rects.view.height, safeFoot()) - 52)}px` })
    fitStrip()
    paintLookMore()
  }
  /** Where the look's ways begin at the foot row's right: the left edge of the seats that stand together from gold leftward. */
  function waysFrom(frame: VitrineCinema, right: number): number {
    const row = wayOn()?.parentElement
    if (!row) return frame.row.gold
    const seats = ([...row.children] as HTMLElement[]).filter(seat => !seat.hidden).map(seat => seat.getBoundingClientRect())
      .filter(box => box.width > 0 && box.height > 0).sort((a, b) => b.right - a.right)
    let from = Math.min(right, frame.row.gold)
    for (const box of seats) {
      if (box.left >= from) continue
      if (from - box.right > CINEMA.together) break
      from = box.left
    }
    return from
  }
  /** How wide the look's ways stand. Where they are wider than the room a work
   * leaves beside itself, a page's turn sets its word on two rows first: read
   * from the turn at its full width each time, so the answer never reads itself. */
  function waysWide(frame: VitrineCinema, right: number, room: number): number {
    const wide = (): number => Math.max(0, right - waysFrom(frame, right))
    const turn = [...lent.keys()].find(node => node.dataset['tool'] === 'turn' && !node.hidden)
    if (!turn) return wide()
    delete turn.dataset['tight']
    const loose = wide()
    if (room <= 0 || loose <= room) return loose
    turn.dataset['tight'] = 'true'
    return wide()
  }
  /** The strip's two rows, each cut at a word's end where it does not fit whole. */
  function fitStrip(): void {
    const strip = root.dataset['lookForm'] === 'under'
    if (!strip) return
    fitWords(stripName, namingText.textContent ?? '')
    fitWords(stripLine, line.hidden ? '' : line.textContent ?? '')
  }
  /** A row's words, whole, or its first whole sentence, or as many whole words as fit with a mark of more. */
  function fitWords(row: HTMLElement, said: string): void {
    const text = said.trim().replace(/\s+/g, ' ')
    row.textContent = text
    if (!text || row.scrollWidth <= row.clientWidth + 0.5) return
    const sentence = /^.+?[.!?](?=\s)/.exec(text)?.[0]
    if (sentence) { row.textContent = sentence; if (row.scrollWidth <= row.clientWidth + 0.5) return }
    const words = text.split(' ')
    let lo = 1, hi = words.length - 1, best = 1
    const tryWords = (n: number): boolean => {
      row.textContent = `${words.slice(0, n).join(' ').replace(/[,;:–-]+$/, '')} …`
      return row.scrollWidth <= row.clientWidth + 0.5
    }
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (tryWords(mid)) { best = mid; lo = mid + 1 } else hi = mid - 1 }
    tryWords(best)
  }
  /** THE COLUMN SHOWS WHOLE LINES ONLY, at rest and while it scrolls. */
  let cut: LineCut | null = null, cutAsked = false
  function clampWords(): void {
    cutAsked = false
    if (!cinemaFrame || root.dataset['lookForm'] !== 'beside') { cut = null; unmaskLines(body); return }
    const head = headBand()
    // at rest a row cut inside its sentence ends on a mark of more; the opened window scrolls on instead
    cut = wholeLines(body, { from: head, reach: restReach(), mark: !raised })
    maskWholeLines(body, cut, head)
  }
  /** at rest a machine beside its words says its step in its own line, so its list of steps waits for the page read on */
  function restReach(): number | undefined {
    if (raised || !root.hasAttribute('data-look-aside') || body.scrollTop > 0.5) return undefined
    const list = body.querySelector<HTMLElement>('.vitrine-steps')
    if (!list) return undefined
    const at = list.getBoundingClientRect().top - body.getBoundingClientRect().top - body.clientTop
    return at > 0 && at < body.clientHeight ? at : undefined
  }
  /** read on, the window's lines pass under its name, which stays at its head */
  function headBand(): number {
    if (!raised || body.scrollTop <= 0.5 || naming.hidden) return 0
    return Math.max(0, naming.getBoundingClientRect().bottom - body.getBoundingClientRect().top - body.clientTop)
  }
  const askClamp = (): void => { if (cutAsked) return; cutAsked = true; requestAnimationFrame(() => { clampWords(); paintLookMore() }) }
  /** A FILM'S FOOT: its clock along the film's lower edge, its line centred
   * over the clock, both on the film itself. A film that stands smaller than
   * the zone names its own box; one that runs to the glass is the zone's. */
  function placeFilm(): void {
    const filmed = root.hasAttribute('data-look-film')
    clockFoot.hidden = !filmed || !clockFoot.firstElementChild
    if (!filmed) { delete root.dataset['lookWords']; return }
    const zone = rects.view
    // a film's keys stand over the glass's own foot bar, never under it
    const floor = safeFoot()
    // a film that keeps its words clear of it names where they stand: the line over the clock, both on the wall
    const said = exhibit?.payload?.filmWords?.() ?? null
    if (said) {
      const box = said.box, inset = said.beside ? 0 : CINEMA.clockInset
      // the line stands over the clock wherever the clock stands
      const foot = Math.min(box.top + box.height, floor)
      root.dataset['lookWords'] = said.beside ? 'beside' : 'under'
      place(clockFoot, { left: box.left + inset, top: foot - CINEMA.clock, width: Math.max(44, box.width - 2 * inset), height: CINEMA.clock })
      stage.style.setProperty('--words-left', `${Math.round(box.left - zone.left)}px`)
      stage.style.setProperty('--words-width', `${Math.round(box.width)}px`)
      stage.style.setProperty('--words-foot', `${Math.round(zone.top + zone.height - foot)}px`)
      return
    }
    delete root.dataset['lookWords']
    const own = exhibit?.payload?.filmBox?.() ?? null
    const left = Math.max(zone.left, own?.left ?? zone.left)
    const right = Math.min(zone.left + zone.width, own ? own.left + own.width : zone.left + zone.width)
    const foot = Math.min(zone.top + zone.height, own ? own.top + own.height : zone.top + zone.height, floor)
    place(clockFoot, { left: left + CINEMA.clockInset, top: foot - CINEMA.clock, width: Math.max(44, right - left - 2 * CINEMA.clockInset), height: CINEMA.clock })
    const zoneFoot = zone.top + zone.height
    stage.style.setProperty('--film-left', `${Math.round(left - zone.left)}px`)
    stage.style.setProperty('--film-width', `${Math.round(right - left)}px`)
    stage.style.setProperty('--film-foot', `${Math.round(zoneFoot - foot)}px`)
    // the fall under the line: over the film's own width, or over the glass to its foot where the film runs on there
    const field = rects.field ?? { left: 0, top: 0, width: view.innerWidth, height: view.innerHeight }
    const glass = { left: field.left - zone.left, width: field.width, below: field.top + field.height - zoneFoot }
    const fall = own ? { left: left - zone.left, width: right - left, below: foot - zoneFoot } : glass
    stage.style.setProperty('--fall-left', `${Math.round(fall.left)}px`)
    stage.style.setProperty('--fall-width', `${Math.round(fall.width)}px`)
    stage.style.setProperty('--fall-below', `${Math.round(fall.below)}px`)
  }
  /** the lower edge of the glass inside its safe areas, sideways */
  const safeFoot = (): number => (cinemaFrame ? cinemaFrame.safe.top + cinemaFrame.safe.height : view.innerHeight)
  /** the form's own places a payload's tools are lent into */
  const toolHomes = (): HTMLElement[] => [...new Set(toolSlots.values()), headSteps]
  /** A LENT TOOL'S PLACE IS ITS PAYLOAD'S, never the form's: a payload that
   * set a node beside one of its lent tools set it in the form's place, so it
   * goes beside that tool's home; a lent tool whose home its payload took
   * down is gone with it. */
  function settleTools(): void {
    for (const [node, mark] of lent) {
      if (mark.isConnected) continue
      lent.delete(node)
      node.remove()
    }
    for (const home of toolHomes()) {
      for (const stray of [...home.children] as HTMLElement[]) {
        if (stray === countButton || lent.has(stray)) continue
        let after: Element | null = stray.nextElementSibling
        while (after && !lent.has(after as HTMLElement)) after = after.nextElementSibling
        let before: Element | null = stray.previousElementSibling
        while (before && !lent.has(before as HTMLElement)) before = before.previousElementSibling
        const beside = after ? lent.get(after as HTMLElement) : before ? lent.get(before as HTMLElement) : undefined
        if (!beside) continue
        if (after) beside.before(stray)
        else beside.after(stray)
      }
    }
  }
  /** What is left in the form's places once every lent tool went home is a payload's that is gone. */
  function sweepTools(): void {
    for (const home of toolHomes()) for (const left of [...home.children]) if (left !== countButton) left.remove()
  }
  /** The payload's tools into the form's own places; one the form has no place for stays where it is. */
  function gatherTools(): void {
    if (!options.narrow()) return
    settleTools()
    let clocked = false
    for (const node of root.querySelectorAll<HTMLElement>('[data-tool], .vitrine-payload-controls :is(.vitrine-play, .vitrine-track, .vitrine-folio-glass)')) {
      if (lent.has(node)) continue
      const kind = toolOf(node)
      const atHead = kind === 'page' && stepsAtHead()
      if (!kind || !(cinemaFrame || atHead || UPRIGHT_LENDS.has(kind))) continue
      // a page's other way stands left of the host's way on, in the host's own row
      const on = kind === 'turn' ? wayOn() : null
      const slot = atHead ? headSteps : toolSlots.get(kind)
      if (!slot && !on) continue
      const mark = document.createComment('')
      node.before(mark)
      lent.set(node, mark)
      if (on) { on.before(node); turnWatch.observe(node) }
      else slot!.append(node)
      if (kind === 'clock') clocked = true
      // a step that is not drawn keeps its word as its name
      if (kind === 'zoom' && !node.hasAttribute('aria-label')) { node.setAttribute('aria-label', node.textContent?.trim() ?? ''); node.dataset['toolNamed'] = '' }
    }
    tools.hidden = !tools.firstElementChild
    headSteps.hidden = !headSteps.firstElementChild
    if (cinemaFrame) arrangePager()
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
  /** The tools one of the form's places holds, back where their payload put them. */
  function giveBack(home: HTMLElement): void {
    for (const [node, mark] of lent) {
      if (node.parentElement !== home) continue
      if (mark.isConnected) mark.replaceWith(node)
      else { mark.remove(); node.remove() }
      lent.delete(node)
    }
    home.hidden = true
  }
  /** Every tool back where its payload put it. */
  function returnTools(): void {
    for (const [node, mark] of lent) {
      if (node.dataset['toolNamed'] !== undefined) { node.removeAttribute('aria-label'); delete node.dataset['toolNamed'] }
      delete node.dataset['tight']
      if (mark.isConnected) mark.replaceWith(node)
      else { mark.remove(); node.remove() }
    }
    lent.clear()
    turnWatch.disconnect()
    tools.hidden = true
    headSteps.hidden = true
    clockFoot.hidden = true
    if (countButton.parentElement !== seat) seat.append(countButton)
    pager.hidden = true
  }
  const toolWatch = new MutationObserver(() => gatherTools())
  /** sideways a page's turn stands among the look's ways: as it comes, goes or changes its word, the column over them is measured again */
  const turnWatch = new ResizeObserver(() => { if (open && cinemaFrame) layout() })
  /** The look's key says where it goes: up into the reading window, or back down to the label at rest. */
  const UP = 'M8 13V3M4 7l4-4 4 4', DOWN = 'M8 3v10M4 9l4 4 4-4'
  /** the key that folds the window says its own word: the look's close mark stands in the same column and closes the look */
  const FOLD_SAYS = { en: 'Less', de: 'Weniger' } as const
  function paintLookMore(): void {
    const frame = cinemaFrame
    if (!frame) { lookMore.remove(); lookLess.remove(); return }
    const strip = root.dataset['lookForm'] === 'under'
    // one seat, at the head of the column's foot row: the key that opens the window, and while it stands the key that folds it
    if (lookMore.parentElement !== controls) controls.prepend(lookMore)
    if (lookLess.parentElement !== controls || lookLess.previousElementSibling !== lookMore) lookMore.after(lookLess)
    lookMoreWord.textContent = frame.more
    lookLessWord.textContent = FOLD_SAYS[options.lang()]
    lookArrowPath.setAttribute('d', UP)
    lessArrowPath.setAttribute('d', DOWN)
    lookMore.setAttribute('aria-expanded', 'false')
    lookLess.setAttribute('aria-expanded', 'true')
    // a label that says all it has at rest has no window to open; words kept behind a card's second door wait in it
    const kept = words.querySelector(':scope > .vitrine-more') !== null
    lookMore.hidden = raised || (!strip && !cut?.below && !kept)
    lookLess.hidden = !raised
  }
  lookMore.addEventListener('click', () => setRaised(true))
  lookLess.addEventListener('click', () => setRaised(false))
  // a detail pressed in an opened column folds it, so the work it moves to stands in its own place
  payloadControls.addEventListener('click', event => {
    if (cinemaFrame && root.hasAttribute('data-look-open') && (event.target as Element | null)?.closest('button')) setRaised(false)
  })
  /** The look leaves the cinema form: the window's own phone or desk layout takes it back. */
  function leaveCinema(): void {
    for (const key of ['form', 'lookForm', 'lookHome', 'lookOpen', 'lookWall', 'lookAspect', 'lookCrossover', 'lookFilm', 'lookWords', 'lookAside']) delete root.dataset[key]
    if (caption.parentElement !== stage) { stage.append(caption); wordsResized.unobserve(caption) }
    card.style.removeProperty('padding-left')
    unmaskLines(body)
    cut = null
    stripName.textContent = ''
    stripLine.textContent = ''
    for (const name of ['--film-left', '--film-width', '--film-foot', '--fall-left', '--fall-width', '--fall-below', '--words-left', '--words-width', '--words-foot']) stage.style.removeProperty(name)
    lookMore.remove()
    lookLess.remove()
    returnTools()
    pager.remove()
    cinemaFrame = null
    nameIt(namingText.textContent ?? '', named.certainty)
  }

  /** The drawer's lower edge fades while more of its words waits below. */
  function markMore(): void {
    body.dataset['more'] = String(open && body.scrollHeight - body.scrollTop - body.clientHeight > 1)
    body.dataset['top'] = String(open && body.scrollTop < 1)
    if (cinemaFrame) askClamp()
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
    else if (cinemaFrame) { fitStrip(); askClamp() }
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
  /** The folded card's own height: its rows at their own heights, nothing between them. */
  function restAsked(): number {
    const held = card.style.height
    card.style.height = 'auto'
    const asked = Math.ceil(card.getBoundingClientRect().height)
    card.style.height = held
    return asked
  }
  /** The height the raised card's words and rows ask for: every row at its
   * own height, the words whole. */
  function raisedAsked(): number {
    const own = view.getComputedStyle(card)
    let asked = parseFloat(own.paddingTop) + parseFloat(own.paddingBottom) + parseFloat(own.borderTopWidth) + parseFloat(own.borderBottomWidth)
    for (const part of [...card.children] as HTMLElement[]) {
      const style = view.getComputedStyle(part)
      // the window's head stands over its words and asks for no row of its own
      if (part.hidden || style.display === 'none' || style.position === 'absolute') continue
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
  let restKey = '', restIdeal = 0, restShort = 0, restLeast = 0
  /** Where the screen has no room for that, every page rests at the richest
   * of two shorter rests that fits (the line over one source row; the name,
   * the place and one source row) and the page takes the room that leaves:
   * `most` is what the work's share of the screen leaves the card. */
  function restHeight(placeAt: (height: number) => void, most: number): number {
    const pick = (): number => (restIdeal <= most ? restIdeal : restShort <= most ? restShort : Math.min(most, restLeast))
    const key = [view.innerWidth, view.innerHeight, view.getComputedStyle(document.documentElement).fontSize,
      Math.round(payloadControls.getBoundingClientRect().height)].join('/')
    if (key === restKey) return pick()
    const kept = { name: namingText.textContent, seat: seat.hidden, words: seatWords.textContent, wordsHidden: seatWords.hidden,
      count: countButton.textContent, countHidden: countButton.hidden }
    namingText.textContent = 'M'
    seat.hidden = false; seatWords.hidden = false; seatWords.textContent = 'M'; countButton.hidden = false; countButton.textContent = 'M'
    line.hidden = false; line.replaceChildren('M', document.createElement('br'), 'M')
    note.hidden = false; note.replaceChildren('M', document.createElement('br'), 'M')
    // the card at no height, so the body's scroll height is its words' own
    placeAt(1)
    const own = view.getComputedStyle(card)
    const asked = (): number => Math.ceil(body.getBoundingClientRect().top - card.getBoundingClientRect().top + body.scrollHeight
      + payloadControls.getBoundingClientRect().height + parseFloat(own.paddingBottom) + 2)
    restIdeal = asked()
    note.replaceChildren('M')
    restShort = asked()
    line.hidden = true
    restLeast = asked()
    namingText.textContent = kept.name
    seat.hidden = kept.seat; seatWords.textContent = kept.words; seatWords.hidden = kept.wordsHidden
    countButton.textContent = kept.count; countButton.hidden = kept.countHidden
    restKey = key
    return pick()
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
    // opened, the grab folds the window and says so, as the sideways key does
    const fold = FOLD_SAYS[options.lang()]
    grab.setAttribute('aria-label', words ? (raised ? words.down : words.up) : raised ? fold : options.raiseLabel?.() ?? '')
    grabSays.textContent = raised ? fold : ''
    // drawn beside the name, the key says the host's one short word on every kind: a payload's longer name would run into the name
    grab.dataset['says'] = options.raiseLabel?.() ?? words?.up ?? ''
  }

  /** THE READING WINDOW over the work, or the card back at rest: one step
   * each way, the same on every kind of look. */
  function setRaised(open: boolean): void {
    if (raised === open) return
    const hand = document.activeElement
    raised = open
    grab.setAttribute('aria-expanded', String(raised))
    nameTheGrabber()
    body.scrollTop = 0
    layout()
    // the hand stays on the key that moved the window, which is the key that moves it back:
    // where the key it was on left the page with the step, the key in its seat takes it
    if (!(hand instanceof HTMLElement) || hand === card || !root.contains(hand) && hand.isConnected) return
    if (hand.isConnected && !hand.hidden && hand.getClientRects().length) return
    const key = cinemaFrame ? (raised ? lookLess : lookMore) : grab
    if (key.isConnected && !key.hidden && key.getClientRects().length) key.focus({ preventScroll: true })
    else card.focus({ preventScroll: true })
  }
  /** True where the card at rest has a window to open. */
  const canRaise = (): boolean => (cinemaFrame ? lookMore.isConnected && !lookMore.hidden : !grab.hidden)

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
    field: () => (cinemaFrame && rects.field ? { ...rects.field } : null),
    clear: () => (cinemaFrame && root.hasAttribute('data-look-aside')
      ? { ...rects.view, height: Math.max(80, Math.min(rects.view.top + rects.view.height, safeFoot()) - rects.view.top - CINEMA.clock - CINEMA.clockAir) } : null),
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
    sweepTools()
    const payload = exhibit?.payload
    if (payload) {
      try { payload.unmount() } catch (error) { console.error(error) }
    }
    payloadEl.textContent = ''
    payloadEl.removeAttribute('aria-label')
    payloadControls.textContent = ''
    aside.textContent = ''
    caption.textContent = ''
    caption.style.removeProperty('min-height')
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
  /* A SWIPE MOVES THE WINDOW AS ITS KEY DOES: up on the card at rest opens it,
     down on its head folds it. Read from touches, which a scroll does not
     cancel; the words' own scroll is never a fold. */
  let swipe: { x: number; y: number; head: boolean } | null = null
  card.addEventListener('touchstart', event => {
    swipe = null
    const target = event.target instanceof Element ? event.target : null
    const touch = event.touches[0]
    if (!options.narrow() || event.touches.length !== 1 || !touch || target?.closest('input, [role="slider"]')) return
    swipe = { x: touch.clientX, y: touch.clientY, head: Boolean(target?.closest('.vitrine-grab, .vitrine-name')) }
  }, { passive: true })
  card.addEventListener('touchend', event => {
    const was = swipe, touch = event.changedTouches[0]
    swipe = null
    if (!was || !touch) return
    const dy = touch.clientY - was.y, dx = touch.clientX - was.x
    if (Math.abs(dy) < GRAB_PX || Math.abs(dy) < Math.abs(dx) * 1.5) return
    if (dy < 0 && !raised && canRaise()) setRaised(true)
    else if (dy > 0 && raised && was.head) setRaised(false)
  }, { passive: true })
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
      restPeek = null
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
      turnWatch.disconnect()
      leaving.abort()
      delete document.documentElement.dataset['naWindow']
      root.remove()
    },
  }
}
