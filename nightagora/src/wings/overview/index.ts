/* THE WHOLE SET AS ITS OWN VIEW. A room that holds a set, the picture wall,
   the body wall, the reading table, the machine hall, says at the foot of the
   screen how many things there are to see, and that one word opens the set as
   a view of its own: named cells in the order the room hangs them, one
   selector, and the gold control walks to the work the selector names.

   It covers nothing, because it IS the picture: the view owns the window, so
   there is no room behind it to cover and no band to shorten.

   Nothing here knows a wing. The host hands the cells, the room's name, the
   museum's own certainty mark, and the one press that walks. */

import { deskControl } from '../desk-story'
import { LOBBY_TEXT } from '../../content/lobby'
import type { VinciCertainty, VinciText } from '../vinci/content'

export interface DeskOverviewCell {
  id: string
  /** the work's own name, already in the page's language */
  title: string
  /** the name the cell has two rows for, where the work's own runs longer */
  short?: string | null
  /** the museum's own mark for this object, which is a fact and not a style */
  certainty: VinciCertainty
  /** the kind the room gave it, which is what names the set */
  kind: string
  /** the plate at rest. A cell exists only where one resolves. */
  preview: string | null
  openable: boolean
}

export interface DeskOverviewHost {
  lang: () => 'en' | 'de'
  /** the set the standing station holds, in the order the room hangs it */
  cells: () => readonly DeskOverviewCell[]
  /** walk to that work through the room's own certified route and open it */
  open: (id: string) => void
  /** the room's own name, which the one step back carries */
  room: () => string
  /** the museum's certainty mark, handed in so this view draws the same one */
  mark: (certainty: VinciCertainty) => SVGSVGElement
}

export interface DeskOverview {
  /** the worded control that opens the whole set, for the band's foot row */
  readonly control: HTMLButtonElement
  /** the view itself, which the chrome hangs in the wing's own stage */
  readonly element: HTMLDialogElement
  /** the station changed, or the language did */
  paint: () => void
  standing: () => boolean
  close: () => void
  dispose: () => void
}

/* EVERY DISPLAYED WORD OF THIS VIEW IS THE CARD DATA'S, by key. The count in
   the control is the set's own number and nothing here writes a word. */
const WORD = {
  count: () => deskControl('overview', 'things_to_see'),
  wall: () => deskControl('overview', 'whole_wall'),
  book: () => deskControl('overview', 'whole_book'),
  hall: () => deskControl('overview', 'whole_hall'),
  there: () => deskControl('walk', 'walk_there'),
  place: () => deskControl('picture', 'place'),
  close: () => LOBBY_TEXT.close,
}

const SVG = 'http://www.w3.org/2000/svg'
const STEP_BACK = 'M10 3L5 8l5 5'
const ARROW_ON = 'M3 8h10M9 4l4 4-4 4'
const SHUT = 'M4 4l8 8M12 4l-8 8'

/* THE GRID'S OWN NUMBERS. Seven columns at every count, so fourteen machines
   read as two rows of the same part twenty five paintings read as four; the
   cell is 172 px wide because that is what two rows of a German title need;
   the picture takes the height the count leaves it, down to a floor under
   which the view scrolls and wears its bar. */
const COLUMNS = 7
const GAP_ROW = 16
/** the room fills its set after the station stands, and says so with this */
export const DESK_SET_CHANGED = 'na-exhibit-set'
/** the name under a picture: two rows at 14 / 18 and the air above them */
const NAME_BLOCK = 42
const PICTURE_MOST = 200
const PICTURE_LEAST = 96

function icon(path: string): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg')
  svg.setAttribute('viewBox', '0 0 16 16')
  svg.setAttribute('class', 'desk-ic')
  svg.setAttribute('aria-hidden', 'true')
  const line = document.createElementNS(SVG, 'path')
  line.setAttribute('d', path)
  svg.append(line)
  return svg
}

function make<K extends keyof HTMLElementTagNameMap>(
  tag: K, cls: string, text?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  node.className = cls
  if (text !== undefined) node.textContent = text
  return node
}

/** WHAT THE SET IS CALLED, from the kinds the room hangs: a hall of machines,
    a book of leaves or sheets, a wall of pictures. */
function setName(cells: readonly DeskOverviewCell[]): VinciText {
  if (cells.some(cell => cell.kind === 'machine')) return WORD.hall()
  if (cells.some(cell => cell.kind === 'sheet' || cell.kind === 'manuscript')) return WORD.book()
  return WORD.wall()
}

export function createDeskOverview(host: DeskOverviewHost): DeskOverview {
  const say = (value: VinciText): string => value[host.lang()]

  /* THE ONE WORD IN THE FOOT ROW. It carries the set's own count, and where
     the station holds no set it is not there at all. */
  const control = make('button', 'desk-word-control desk-ov-open')
  control.type = 'button'
  control.setAttribute('aria-haspopup', 'dialog')
  control.hidden = true

  const view = document.createElement('dialog')
  view.className = 'desk-ov'
  view.id = 'desk-overview'
  control.setAttribute('aria-controls', view.id)

  const stepBack = make('button', 'desk-ov-back')
  stepBack.type = 'button'
  const shut = make('button', 'desk-ov-shut')
  shut.type = 'button'
  shut.append(icon(SHUT))
  const title = make('h2', 'desk-ov-title')
  const sub = make('p', 'desk-ov-sub')
  const grid = make('ul', 'desk-ov-grid')
  grid.setAttribute('role', 'list')
  const foot = make('div', 'desk-ov-foot')
  const named = make('div', 'desk-ov-named')
  const said = make('div', 'desk-ov-said')
  const place = make('div', 'desk-ov-place')
  named.append(said, place)
  const on = make('button', 'desk-on desk-ov-on')
  on.type = 'button'
  const onWords = make('span', 'desk-on-words')
  const onKicker = make('span', 'desk-on-kicker')
  const onTitle = make('span', 'desk-on-title')
  onWords.append(onKicker, onTitle)
  const onArrow = make('span', 'desk-on-arrow')
  onArrow.append(icon(ARROW_ON))
  on.append(onWords, onArrow)
  foot.append(named, on)
  view.append(stepBack, shut, title, sub, grid, foot)

  let shown: DeskOverviewCell[] = []
  let buttons: HTMLButtonElement[] = []
  let at = 0
  let open = false
  let framed = 0
  const window_ = document.defaultView!

  control.addEventListener('click', () => show())
  stepBack.addEventListener('click', () => close(true))
  shut.addEventListener('click', () => close(true))
  on.addEventListener('click', () => walk(at))
  // Escape is one step back and not a cancel: the set is a place to look at.
  view.addEventListener('cancel', event => { event.preventDefault(); close(true) })
  // A traversal walks the museum under the view, so the view goes with it.
  const leaving = new AbortController()
  window_.addEventListener('popstate', () => close(false), { signal: leaving.signal })
  window_.addEventListener('resize', () => layout(), { signal: leaving.signal })
  // the count is the set's own, and a room that has just finished building it
  // says so: the word is never a count of what had arrived by the first paint
  window_.addEventListener(DESK_SET_CHANGED, () => paint(), { signal: leaving.signal })

  /** THE CELLS ARE THE ONES WITH A PICTURE. No picture, no cell: a date or an
      absence never gets a tile here, and the count says the same. */
  const pictured = (): DeskOverviewCell[] => host.cells().filter(cell => cell.preview !== null)

  function paint(): void {
    const set = pictured()
    control.hidden = set.length < 2
    control.textContent = say(WORD.count()).replace('{n}', String(set.length))
    if (open) fill(set)
  }

  function fill(set: DeskOverviewCell[]): void {
    const held = shown[at]?.id
    shown = set
    at = Math.max(0, shown.findIndex(cell => cell.id === held))
    const name = setName(shown)
    title.textContent = say(name)
    // the set's own count stands under its name until the room's measure has
    // a sentence of its own in the card data
    sub.textContent = say(WORD.count()).replace('{n}', String(shown.length))
    view.setAttribute('aria-label', `${say(name)} · ${host.room()}`)
    stepBack.textContent = ''
    stepBack.append(icon(STEP_BACK), document.createTextNode(host.room()))
    shut.setAttribute('aria-label', say(WORD.close()))
    grid.textContent = ''
    buttons = []
    shown.forEach((cell, index) => {
      const item = document.createElement('li')
      const button = make('button', 'desk-ov-cell')
      button.type = 'button'
      button.dataset['exhibit'] = cell.id
      button.disabled = !cell.openable
      button.tabIndex = -1
      // the name may take two rows and stop there, so the whole title is the
      // cell's own name and stands in the foot line for the one selected
      button.setAttribute('aria-label', cell.title)
      const plate = make('span', 'desk-ov-plate')
      const thumb = document.createElement('img')
      thumb.className = 'desk-ov-thumb'
      thumb.decoding = 'async'
      thumb.alt = ''
      thumb.src = cell.preview ?? ''
      plate.append(thumb)
      const word = make('span', 'desk-ov-cellname')
      word.append(host.mark(cell.certainty), document.createTextNode(cell.short ?? cell.title))
      button.append(plate, word)
      button.addEventListener('click', () => walk(index))
      // ONE SELECTOR IN THE VIEW, moved by both hands: the pointer and the
      // arrows each move the foot line one work at a time.
      button.addEventListener('pointerenter', () => select(index, false))
      button.addEventListener('focus', () => select(index, false))
      buttons.push(button)
      item.append(button)
      grid.append(item)
    })
    select(at, false)
    layout()
  }

  /** THE PICTURE TAKES THE HEIGHT THE COUNT LEAVES IT. The columns never
      change with the set, so a short set reads as the same part in a bigger
      picture and a long one scrolls at the floor. */
  function layout(): void {
    if (!open) return
    if (framed) window_.cancelAnimationFrame(framed)
    framed = window_.requestAnimationFrame(() => {
      framed = 0
      const rows = Math.max(1, Math.ceil(buttons.length / COLUMNS))
      const box = grid.getBoundingClientRect()
      if (box.height < 1) return
      const free = (box.height - (rows - 1) * GAP_ROW) / rows - NAME_BLOCK
      let tall = Math.round(Math.max(PICTURE_LEAST, Math.min(PICTURE_MOST, free)))
      view.style.setProperty('--desk-ov-picture', `${tall}px`)
      /* THE NAME'S OWN HEIGHT IS THE LANGUAGE'S, so the fit is measured and
         corrected and never assumed: a row of German titles takes the second
         row more often, and the picture gives those pixels back. */
      for (let pass = 0; pass < 3 && tall > PICTURE_LEAST; pass++) {
        const over = grid.scrollHeight - grid.clientHeight
        if (over <= 1) break
        tall = Math.max(PICTURE_LEAST, tall - Math.ceil(over / rows))
        view.style.setProperty('--desk-ov-picture', `${tall}px`)
      }
      // a set that outgrows its box says so, and its rows start at the top
      grid.dataset['scrolls'] = String(grid.scrollHeight > grid.clientHeight + 1)
    })
  }

  function select(index: number, focus: boolean): void {
    if (!buttons.length) return
    at = Math.max(0, Math.min(buttons.length - 1, index))
    const cell = shown[at]
    buttons.forEach((button, index_) => {
      const here = index_ === at
      button.tabIndex = here ? 0 : -1
      if (here) button.setAttribute('aria-current', 'true')
      else button.removeAttribute('aria-current')
    })
    said.textContent = cell?.title ?? ''
    place.textContent = shown.length
      ? say(WORD.place()).replace('{n}', String(at + 1)).replace('{total}', String(shown.length))
      : ''
    onKicker.textContent = say(WORD.there())
    onTitle.textContent = cell?.title ?? ''
    on.disabled = !cell?.openable
    on.setAttribute('aria-label', `${onKicker.textContent} · ${onTitle.textContent}`)
    if (!focus) return
    buttons[at]?.focus({ preventScroll: true })
    buttons[at]?.scrollIntoView({ block: 'nearest' })
  }

  /* THE VIEW LEAVES BEFORE THE MUSEUM WALKS, so the room the eye walks
     through is never drawn behind a surface that is about to go. */
  function walk(index: number): void {
    const cell = shown[index]
    if (!cell?.openable) return
    close(false)
    holdTheHand()
    host.open(cell.id)
  }

  /* AND THE HAND COMES BACK FROM THE WORK THE VIEW SENT IT TO. The view is
     unmounted while that work stands, so the way back is the word that opened
     it, and the museum's own window attribute says when the work is done. */
  let letGo: (() => void) | null = null
  function holdTheHand(): void {
    letGo?.()
    const root = document.documentElement
    let stood = false
    const watch = new MutationObserver(() => {
      if (root.dataset['naWindow']) { stood = true; return }
      if (!stood) return
      letGo?.()
      if (control.isConnected && !control.hidden) control.focus({ preventScroll: true })
    })
    // a press that opens no window of its own lets the hand go where it fell
    const patience = window_.setTimeout(() => { if (!stood) letGo?.() }, 3000)
    letGo = () => { watch.disconnect(); window_.clearTimeout(patience); letGo = null }
    watch.observe(root, { attributes: true, attributeFilter: ['data-na-window'] })
  }

  function step(by: number): void {
    select(at + by, true)
  }

  grid.addEventListener('keydown', event => {
    if (!(event.target instanceof HTMLButtonElement)) return
    const key = event.key
    const by = key === 'ArrowRight' ? 1 : key === 'ArrowLeft' ? -1
      : key === 'ArrowDown' ? COLUMNS : key === 'ArrowUp' ? -COLUMNS : 0
    if (by) { event.preventDefault(); step(by); return }
    if (key === 'Home') { event.preventDefault(); select(0, true) }
    if (key === 'End') { event.preventDefault(); select(buttons.length - 1, true) }
  })

  function show(): void {
    if (open) return
    const set = pictured()
    if (set.length < 2) return
    open = true
    if (!view.open) view.showModal()
    fill(set)
    select(at, true)
  }

  /** The hand comes back to the word that opened the view, where a visitor
      closed it himself; where he pressed a cell it goes with the work. */
  function close(back: boolean): void {
    if (!open) return
    open = false
    if (framed) { window_.cancelAnimationFrame(framed); framed = 0 }
    if (view.open) view.close()
    if (back && control.isConnected) control.focus({ preventScroll: true })
  }

  return {
    control,
    element: view,
    paint,
    standing: () => open,
    close: () => close(true),
    dispose() {
      close(false)
      letGo?.()
      leaving.abort()
      view.remove()
      control.remove()
      buttons = []
      shown = []
    },
  }
}
