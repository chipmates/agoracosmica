/** THE HANG STRIP: THE WALL'S OWN INSTRUMENT, along the foot of the frame.
 *
 * A standpoint holds a few of the picture room's twenty five works, and the
 * marks on the wall can only name what is in front of the eye. The strip
 * names the rest: every exhibit of the station a visitor is standing in, in
 * the order the wall hangs them. At 44 px a Ginevra was a smudge, so on the
 * wide stage the row stands along the foot at full width with cells large
 * enough to recognise, and a press on one runs the eye to that stop.
 *
 * Its three words are the wall's, from the card models' file: the row's own
 * name, the place along the wall for a screen reader, and the control that
 * carries the visitor back to the end they came in by. A button's name is
 * the work's own title, and a colour is that object's certainty. A kind the
 * spine cannot open yet stands in the row disabled rather than absent, so the
 * row is the whole wall from the first day and lights up as the spine
 * reaches it.
 *
 * AND THE ROW IS WALKED BY EVERY HAND. A mouse has one wheel and no sideways
 * gesture, so the wheel over the row moves it along; a mouse may drag it; the
 * arrows walk the focus and the row follows; the two controls at its ends
 * step it a width at a time; and the line beside it says which cell of how
 * many is in view, so a row that can be moved says that it can.
 */
import { lang } from '../../content'
import { deskOn } from '../../desk-switches'
import { DESK_SET_CHANGED } from '../../overview'
import cardsRaw from '../data/cards.json?raw'

type Words = { en: string; de: string }
const CONTROLS = (JSON.parse(cardsRaw) as { controls: {
  picture: { whole_wall: Words; hang_row: Words; place: Words }
  date: { previous: Words; next: Words } } }).controls
const WALL_WORDS = CONTROLS.picture
/** The two ends carry a mark and not a word, so their names are the two the
 * wing already has for a step back and a step on. */
const STEP_WORDS = CONTROLS.date
/** THE STRIP NAMES A WORK WITH THE RECORD'S OWN WORDS. A Windsor sheet
 * carries no title of its own: its record opens with the author and then the
 * name the holder's catalogue gives the sheet, in both languages. */
export function vinciSheetTitle(honesty: string): string {
  const said = honesty.replace(/^Leonardo da Vinci,\s*/, '')
  const stop = said.indexOf('. ')
  return stop < 0 ? said : said.slice(0, stop)
}

/* THE ROW'S THUMBNAILS ARE THE ROOM'S OWN PREVIEWS, made small once. The
 * plates decode every preview at entry; a row that fetched and decoded the
 * same files again stood with blank cells when its station stood. The
 * picture module registers a small upright copy by the preview's address,
 * and a cell takes it the moment it exists. */
const thumbs = new Map<string, string>()
const waiting = new Set<(address: string, thumb: string) => void>()
export function registerVinciStripThumb(address: string, thumb: string): void {
  thumbs.set(address, thumb)
  for (const tell of waiting) tell(address, thumb)
}
/** THE SMALL COPY MADE FOR A PLATE, where one exists. A second view of the
 * same set reads the row's own copy instead of decoding the file again. */
export function vinciStripThumb(address: string): string {
  return thumbs.get(address) ?? address
}
export function releaseVinciStripThumb(address: string): void {
  const thumb = thumbs.get(address)
  if (thumb === undefined) return
  thumbs.delete(address)
  URL.revokeObjectURL(thumb)
}

export interface VinciStripEntry {
  id: string
  /** The exhibit's own name, already in the page's language. */
  title: string
  /** The certainty colour of this object, which is a fact, not a style. */
  colour: string
  /** The plate at rest. An entry without one is not a cell. */
  preview: string | null
  openable: boolean
}

/** THE CELLS OF A ROW: the entries that carry a picture of what they open.
 * A cell exists to show that picture, so a tile with only a word or a year
 * in it is not one, and a station whose exhibits have no plates stands with
 * no row at all rather than with a line of bare tiles. Its dates are chosen
 * where they already are, on the floor itself and in the life. Every row of
 * this wing is painted from this one predicate. */
export const vinciStripCells = (entries: readonly VinciStripEntry[]): VinciStripEntry[] =>
  entries.filter(entry => entry.preview !== null)

/** What a row standing at a WALL is: the whole hang, and the way off it. */
export interface VinciStripWall {
  /** Which stop the eye stands at, counted from 1, or 0 off the wall. */
  place: number
  total: number
  /** True for the hang, whose row carries its own name. */
  hang?: boolean
  /** Back to the end the visitor came in by. */
  whole(): void
}

export interface VinciHangStrip {
  element: HTMLElement
  /** The row stands only where a station holds more than one exhibit. */
  readonly count: number
  setEntries(entries: readonly VinciStripEntry[], label: string): void
  /** Which exhibit stands open, so the row says where the visitor is. */
  setOpen(id: string | null): void
  /** The wall this row is the instrument of, or null where it is only a row. */
  setWall(wall: VinciStripWall | null): void
  setHidden(hidden: boolean): void
  /** the row's own small copy of a plate, for a view that shows the same set */
  thumb(address: string): string
  /** ONE SELECTOR PER VIEW. A view that brings its own way through the same
   * set, the reader's strip of sides, silences the row while it stands: two
   * selectors for one set is a choice a visitor has to make twice. A view
   * that brings none, a work in the vitrine or a machine on its turntable,
   * keeps the row and takes it under its own words. */
  setViewSelector(brings: boolean): void
  /** Where the row stands: along the foot of the wide stage, at a rectangle
   * under the station card, inline inside a card that holds it, or null for
   * the narrow stage's own place. */
  dock(place: { left: number; top: number; width: number } | 'foot' | 'inline' | null, parent: HTMLElement): void
  dispose(): void
}

/** A drag this far is a drag; a shorter one is the press it looks like. */
const DRAG_SLOP = 6

/* WHERE THE WHOLE SET HAS A VIEW OF ITS OWN, THIS ROW STANDS DOWN, at rest
 * and under a close look alike: one selector per set, and the overview is
 * that one. The reader's own strip of sides stays, because it is the page's
 * instrument and not a second way through the same set. The word the wing
 * wrote says whether the view stands: a narrow stage never gets one. */
const rowStandsDown = (): boolean =>
  deskOn('overview') && (document.getElementById('wing')?.dataset['desk'] ?? '').split(' ').includes('overview')

export function createVinciHangStrip(options: {
  host: HTMLElement
  onOpen(id: string, button: HTMLButtonElement): void
}): VinciHangStrip {
  const { host, onOpen } = options
  const document = host.ownerDocument
  // The instrument is the row and what stands with it: the way back to the
  // end the visitor came in by, and the hairline scale under the row that
  // says where along thirty four metres the eye is.
  const frame = document.createElement('div')
  frame.className = 'vinci-strip'
  frame.hidden = true
  const whole = document.createElement('button')
  whole.type = 'button'
  whole.className = 'vinci-strip-whole'
  whole.hidden = true
  const walk = document.createElement('div')
  walk.className = 'vinci-strip-walk'
  const row = document.createElement('ul')
  row.className = 'vinci-strip-row'
  row.setAttribute('role', 'list')
  const end = (which: 'back' | 'on'): HTMLButtonElement => {
    const control = document.createElement('button')
    control.type = 'button'
    control.className = 'vinci-strip-end'
    control.dataset['end'] = which
    control.textContent = which === 'back' ? '\u2039' : '\u203a'
    return control
  }
  const back = end('back'), on = end('on')
  walk.append(back, row, on)
  const scale = document.createElement('div')
  scale.className = 'vinci-strip-scale'
  const mark = document.createElement('span')
  mark.className = 'vinci-strip-mark'
  scale.append(mark)
  const foot = document.createElement('div')
  foot.className = 'vinci-strip-foot'
  foot.hidden = true
  const place = document.createElement('span')
  place.className = 'vinci-strip-place'
  foot.append(place, whole)
  frame.append(walk, scale, foot)
  host.append(frame)
  let wall: VinciStripWall | null = null, named = ''
  whole.addEventListener('click', () => wall?.whole())

  let entries: readonly VinciStripEntry[] = []
  let docked = ''
  let open: string | null = null, hidden = false, ownSelector = false, disposed = false
  const buttons: HTMLButtonElement[] = []
  const arrive = (address: string, thumb: string): void => {
    for (const image of row.querySelectorAll<HTMLImageElement>('img.vinci-strip-thumb'))
      if (image.dataset['preview'] === address && image.getAttribute('src') !== thumb) image.src = thumb
  }
  waiting.add(arrive)
  const view = document.defaultView!
  const reduced = (): boolean => view.matchMedia('(prefers-reduced-motion: reduce)').matches

  /** THE ROW MOVES SIDEWAYS UNDER A PLAIN WHEEL. A mouse has one axis, and
   * without this the twenty five works of the hang end at the sixth. */
  function slide(by: number, smooth = false): void {
    const most = row.scrollWidth - row.clientWidth
    if (most <= 0 || !by) return
    const to = Math.max(0, Math.min(most, row.scrollLeft + by))
    if (smooth && !reduced()) row.scrollTo({ left: to, behavior: 'smooth' })
    else row.scrollLeft = to
  }
  row.addEventListener('wheel', event => {
    if (event.ctrlKey) return
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? row.clientWidth : 1
    const was = row.scrollLeft
    slide((Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY) * unit)
    if (row.scrollLeft !== was) event.preventDefault()
  }, { passive: false })
  // A MOUSE MAY ALSO TAKE THE ROW AND MOVE IT. A finger already has the
  // surface's own scrolling with its momentum, so only a mouse drags here,
  // and the press that ends a drag does not open the work under it.
  let from = 0, at = 0, pointer = -1, dragged = false
  row.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0 || event.pointerType !== 'mouse') return
    pointer = event.pointerId; from = event.clientX; at = row.scrollLeft; dragged = false
  })
  row.addEventListener('pointermove', event => {
    if (event.pointerId !== pointer) return
    const by = event.clientX - from
    if (!dragged && Math.abs(by) < DRAG_SLOP) return
    if (!dragged) { dragged = true; row.setPointerCapture(pointer) }
    row.scrollLeft = at - by
    event.preventDefault()
  })
  for (const name of ['pointerup', 'pointercancel'] as const)
    row.addEventListener(name, event => { if (event.pointerId === pointer) pointer = -1 })
  row.addEventListener('click', event => {
    if (!dragged) return
    dragged = false
    event.preventDefault()
    event.stopPropagation()
  }, true)
  for (const [control, step] of [[back, -1], [on, 1]] as const)
    control.addEventListener('click', () => slide(step * Math.max(88, row.clientWidth * .8), true))
  let painting = 0
  row.addEventListener('scroll', () => {
    if (painting) return
    painting = view.requestAnimationFrame(() => { painting = 0; paintEnds(); paintPlace() })
  }, { passive: true })

  /** THE ROW TAKES ONE TAB STOP. Inside it the arrows walk, which is what a
   * row of targets owes a keyboard: Home and End are its two ends. */
  function reachable(): HTMLButtonElement[] {
    return buttons.filter(button => !button.disabled)
  }
  function focusAt(index: number): void {
    const live = reachable()
    if (!live.length) return
    const at = Math.max(0, Math.min(live.length - 1, index))
    for (const button of live) button.tabIndex = button === live[at] ? 0 : -1
    live[at]!.focus({ preventScroll: true })
    live[at]!.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }
  row.addEventListener('keydown', event => {
    const target = event.target
    if (!(target instanceof HTMLButtonElement)) return
    const live = reachable(), at = live.indexOf(target)
    if (at < 0) return
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1
      : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0
    if (step) { event.preventDefault(); focusAt(at + step); return }
    if (event.key === 'Home') { event.preventDefault(); focusAt(0) }
    if (event.key === 'End') { event.preventDefault(); focusAt(live.length - 1) }
  })

  function paint(): void {
    row.textContent = ''
    buttons.length = 0
    // a row that stands down builds no cell: nothing of it is in the tab
    // order, and a hand coming back from a work is never sent to a hidden one
    for (const entry of rowStandsDown() ? [] : entries) {
      const item = document.createElement('li')
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'vinci-strip-item'
      button.dataset['exhibit'] = entry.id
      button.setAttribute('aria-label', entry.title)
      button.disabled = !entry.openable
      button.tabIndex = -1
      if (entry.preview) {
        const thumb = document.createElement('img')
        thumb.className = 'vinci-strip-thumb'
        thumb.decoding = 'async'
        thumb.alt = ''
        thumb.dataset['preview'] = entry.preview
        thumb.src = thumbs.get(entry.preview) ?? entry.preview
        button.append(thumb)
      }
      const dot = document.createElement('span')
      dot.className = 'vinci-strip-dot'
      dot.style.setProperty('--certainty', entry.colour)
      button.append(dot)
      if (entry.openable) button.addEventListener('click', () => onOpen(entry.id, button))
      buttons.push(button)
      item.append(button)
      row.append(item)
    }
    const first = reachable()[0]
    if (first) first.tabIndex = 0
    mark_()
    paintEnds()
    paintPlace()
  }

  function mark_(): void {
    for (const button of buttons) {
      const current = button.dataset['exhibit'] === open && open !== null
      if (current) button.setAttribute('aria-current', 'true')
      else button.removeAttribute('aria-current')
    }
    reveal()
  }
  /** THE OPEN WORK STANDS IN VIEW in its own row, centred where the row can
   * centre it. Only the row scrolls, never the page. */
  function reveal(): void {
    const current = buttons.find(button => button.dataset['exhibit'] === open && open !== null)
    // The ends and the line are repainted even where nothing stands open: a
    // row that was painted while it was still hidden has no width yet, and
    // both of its ends would stay down at a row that can be walked.
    if (current && !frame.hidden && row.isConnected) {
      const cell = current.getBoundingClientRect(), rail = row.getBoundingClientRect()
      const target = row.scrollLeft + (cell.left - rail.left) - (rail.width - cell.width) / 2
      row.scrollLeft = Math.max(0, Math.min(row.scrollWidth - row.clientWidth, target))
    }
    paintEnds()
    paintPlace()
  }
  /** THE TWO ENDS STAND DOWN AT THE END THEY POINT TO and keep their place
   * while they do: a control that leaves the line changes the row's width
   * under the hand, and the cell being aimed at moves with it. */
  function paintEnds(): void {
    const most = row.scrollWidth - row.clientWidth
    back.dataset['off'] = String(most <= 1 || row.scrollLeft <= 1)
    on.dataset['off'] = String(most <= 1 || row.scrollLeft >= most - 1)
  }

  /** WHERE ALONG THE WALL THE EYE IS, said once for the scale line and once
   * for a screen reader. Off a wall the line stands down: a row of three
   * machines is a row, not thirty four metres. */
  function paintLabel(): void {
    // The hang's own name is the hang's. A second wall is named by the room
    // it stands in, which is the label the row already carries.
    row.setAttribute('aria-label', wall === null || !wall.hang ? named : WALL_WORDS.hang_row[lang()])
    back.setAttribute('aria-label', STEP_WORDS.previous[lang()])
    on.setAttribute('aria-label', STEP_WORDS.next[lang()])
  }
  function paintScale(): void {
    scale.hidden = wall === null || wall.total < 2
    if (wall === null) { whole.hidden = true; paintPlace(); return }
    const at = Math.max(0, Math.min(wall.total, wall.place))
    mark.style.setProperty('--along', `${wall.total < 2 ? 0 : (at - 1) / (wall.total - 1) * 100}%`)
    mark.hidden = at < 1
    // THE WAY OFF THE WALL STANDS ONLY WHERE IT LEADS OFF IT. At an end
    // station the eye is already off the wall, and the control resolved to
    // the station the visitor was standing at: a word that did nothing.
    whole.hidden = at < 1
    whole.textContent = WALL_WORDS.whole_wall[lang()]
    paintPlace()
  }
  /** WHICH OF HOW MANY IS IN VIEW. At a stop of the wall the place is the
   * stop the eye stands at. Off the wall the row is the walk, so the line
   * says the cell the row is showing: the hand, then the open work, then
   * what the width has brought into view. */
  function paintPlace(): void {
    const total = wall !== null ? wall.total : entries.length
    const stop = wall !== null && wall.place >= 1 ? Math.min(wall.total, wall.place) : rowPlace()
    place.textContent = total < 2 || stop < 1 ? ''
      : WALL_WORDS.place[lang()].replace('{n}', String(stop)).replace('{total}', String(total))
    foot.hidden = !place.textContent && whole.hidden
  }
  /** The row stands unless something stands for it. */
  function stand(): void {
    const was = frame.hidden
    frame.hidden = hidden || ownSelector || rowStandsDown() || entries.length < 2
    if (was && !frame.hidden) paintScale()
    reveal()
  }
  function rowPlace(): number {
    if (!buttons.length || frame.hidden) return 0
    const held = buttons.findIndex(button => button === document.activeElement)
    if (held >= 0) return held + 1
    const shown = buttons.findIndex(button => button.dataset['exhibit'] === open && open !== null)
    if (shown >= 0) return shown + 1
    const left = row.getBoundingClientRect().left
    const first = buttons.findIndex(button => button.getBoundingClientRect().right > left + 1)
    return first < 0 ? buttons.length : first + 1
  }
  return {
    element: frame,
    get count() { return entries.length },
    setEntries(next, label) {
      if (disposed) return
      const cells = vinciStripCells(next)
      const same = cells.length === entries.length
        && cells.every((entry, at) => entry.id === entries[at]!.id && entry.title === entries[at]!.title)
      entries = cells
      named = label
      paintLabel()
      // THE ROOM FILLS ITS SET AFTER THE STATION STANDS, so the row says when
      // the set changed and a word that counts it is never a stale count.
      if (!same) { paint(); frame.dispatchEvent(new CustomEvent(DESK_SET_CHANGED, { bubbles: true })) }
      stand()
      paintPlace()
    },
    setOpen(id) {
      if (open === id) return
      open = id
      mark_()
    },
    setWall(next) {
      const was = wall !== null
      wall = next
      paintScale()
      if (was !== (wall !== null)) paintLabel()
    },
    setHidden(next) {
      hidden = next
      stand()
    },
    thumb: address => vinciStripThumb(address),
    setViewSelector(brings) {
      ownSelector = brings
      stand()
    },
    dock(place_, parent) {
      const key = place_ === null ? 'narrow' : typeof place_ === 'string' ? place_
        : `${place_.left},${place_.top},${place_.width}`
      const moved = frame.parentElement !== parent
      if (moved) parent.append(frame)
      if (key === docked && !moved) return
      docked = key
      frame.dataset['dock'] = place_ === null ? 'narrow' : typeof place_ === 'string' ? place_ : 'card'
      if (place_ === null || typeof place_ === 'string') frame.style.left = frame.style.top = frame.style.width = ''
      else {
        frame.style.left = `${place_.left}px`
        frame.style.top = `${place_.top}px`
        frame.style.width = `${place_.width}px`
      }
      reveal()
    },
    dispose() {
      disposed = true
      waiting.delete(arrive)
      if (painting) view.cancelAnimationFrame(painting)
      frame.remove()
      buttons.length = 0
    },
  }
}
