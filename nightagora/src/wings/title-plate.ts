/* THE TITLE PLATE, the museum's title wall at the door of a wing: the place
   and the date, the name, one sentence, one way in. Everything else is the
   leaflet in the rack beside the door, a row of words under the wall, one
   open at a time and never between the visitor and the room.

   The part owns the sheet, the row and the folds; a wing supplies its words,
   its leaves and its controls and keeps its own rule about when to show it.
   On a narrow stage the sheet stands at the foot in three heights: the wall
   alone, the wall with the row, the row with one leaf open. */

import css from './title-plate.css?inline'
import { windowOwnsTheScreen } from './window-chrome'
import { deskAny } from './desk-switches'
import { setCloseLookBand } from './desk-stage'

const MOUNT = 'na-title-plate'
/** the aspect the wing chrome already calls a phone */
const NARROW = '(max-aspect-ratio: 9/10)'

export interface PlateWords {
  /** the sheet's own name, for a screen reader */
  label: string
  kicker: string
  title: string
  line: string
  /** the row's own name, for a screen reader */
  leaflet: string
  /** what the handle that pulls the sheet up is called; never displayed */
  handle: string
}

export interface PlateLeaf {
  id: string
  /** the one word that stands in the row */
  tab: string
  /** the leaf's full name, for a screen reader; the row carries the short one */
  name?: string
  render(host: HTMLElement): void
}

export interface PlateControl {
  word: string
  rank: 'primary' | 'second' | 'third'
  className?: string
  attributes?: Readonly<Record<string, string>>
  press(): void
}

export interface PlateParts {
  id: string
  /** the wing's own class, beside the part's, for its skin */
  className?: string
  words(): PlateWords
  leaves(): readonly PlateLeaf[]
  controls(): readonly PlateControl[]
  /** every way out lands here, the way in included */
  onClose(): void
  /** `sheet` stands over a dimmed frame; `door` stands where the wing's own
   *  words will stand and leaves the picture above it whole */
  form?: 'sheet' | 'door'
}

export interface TitlePlate {
  element: HTMLDialogElement
  open(): void
  dispose(): void
}

/** a named group inside a leaf: what it is, how many the records hold, and
 *  what it says when it is opened */
export interface PlateGroup {
  id: string
  name: string
  count: number
  render(host: HTMLElement): void
}

function mountStyle(document_: Document): void {
  if (document_.getElementById(MOUNT)) return
  const style = document_.createElement('style')
  style.id = MOUNT
  style.textContent = css
  document_.head.append(style)
}

const SVG = 'http://www.w3.org/2000/svg'
function icon(document_: Document, path: string, cls: string): SVGSVGElement {
  const svg = document_.createElementNS(SVG, 'svg')
  svg.setAttribute('viewBox', '0 0 16 16')
  svg.setAttribute('class', cls)
  svg.setAttribute('aria-hidden', 'true')
  const line = document_.createElementNS(SVG, 'path')
  line.setAttribute('d', path)
  svg.append(line)
  return svg
}
/** the museum's book, the mark of its own reading, and the way on */
const BOOK = 'M8 3.2a4.8 4.8 0 1 0 0 9.6a4.8 4.8 0 1 0 0-9.6M8 6.2v3.6M6.2 8h3.6'
const ARROW = 'M3 8h10M9 4l4 4-4 4'

/* A FOLD KEEPS ITS WORDS IN THE DOM and out of the reading: it animates to
   nothing, and `inert` is what stops a shut one from being tabbed into or
   announced. */
function makeFold(document_: Document, cls: string, id = ''): { fold: HTMLElement; body: HTMLElement } {
  const fold = document_.createElement('div')
  fold.className = `na-plate-fold ${cls}`
  if (id) fold.id = id
  fold.dataset['open'] = 'false'
  fold.setAttribute('inert', '')
  const clip = document_.createElement('div')
  clip.className = 'na-plate-clip'
  const body = document_.createElement('div')
  body.className = 'na-plate-body'
  clip.append(body)
  fold.append(clip)
  return { fold, body }
}

function setFold(element: HTMLElement, open: boolean): void {
  element.dataset['open'] = String(open)
  if (open) element.removeAttribute('inert')
  else element.setAttribute('inert', '')
}

/** The leaflet's inner rack: named groups, one open at a time, in place. */
export function plateGroups(host: HTMLElement, groups: readonly PlateGroup[]): void {
  const document_ = host.ownerDocument
  let open = ''
  for (const group of groups) {
    const id = `${host.id || 'na-plate'}-group-${group.id}`
    const button = document_.createElement('button')
    button.type = 'button'
    button.className = 'na-plate-group'
    button.setAttribute('aria-expanded', 'false')
    button.setAttribute('aria-controls', id)
    button.append(document_.createTextNode(group.name))
    const count = document_.createElement('span')
    count.className = 'na-plate-count'
    count.textContent = String(group.count)
    button.append(count)
    const panel = makeFold(document_, 'na-plate-group-fold', id)
    group.render(panel.body)
    button.addEventListener('click', () => {
      const wanted = open === group.id ? '' : group.id
      for (const other of host.querySelectorAll<HTMLElement>('.na-plate-group-fold')) setFold(other, false)
      for (const other of host.querySelectorAll('.na-plate-group')) other.setAttribute('aria-expanded', 'false')
      if (wanted) {
        setFold(panel.fold, true)
        button.setAttribute('aria-expanded', 'true')
      }
      open = wanted
    })
    host.append(button, panel.fold)
  }
}

export function createTitlePlate(host: HTMLElement, parts: PlateParts): TitlePlate {
  const document_ = host.ownerDocument
  mountStyle(document_)
  const narrow = matchMedia(NARROW)
  const make = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, words = ''): HTMLElementTagNameMap[K] => {
    const node = document_.createElement(tag)
    if (cls) node.className = cls
    if (words) node.textContent = words
    return node
  }

  const dialog = document_.createElement('dialog')
  dialog.className = parts.className ? `na-plate ${parts.className}` : 'na-plate'
  dialog.id = parts.id
  const door = parts.form === 'door'
  dialog.dataset['form'] = door ? 'door' : 'sheet'
  let live = true
  /** on a narrow stage the sheet starts at the wall alone */
  let pulledUp = false
  let openLeaf = ''
  let tabs: HTMLButtonElement[] = []

  function height(): void {
    dialog.dataset['plate'] = openLeaf ? 'leaf' : pulledUp ? 'rows' : 'label'
    // the door keeps its leaflet behind the book at both stages
    const up = door ? pulledUp : !narrow.matches || pulledUp
    const rows = dialog.querySelector<HTMLElement>('.na-plate-rows')
    if (rows) setFold(rows, up)
    dialog.querySelector('.na-plate-grab, .na-door-book')?.setAttribute('aria-expanded', String(up))
  }

  function wallOf(words: PlateWords): HTMLElement {
    const wall = make('div', 'na-plate-wall')
    wall.append(
      make('p', 'na-plate-kicker', words.kicker),
      make('h1', 'na-plate-title', words.title),
      make('p', 'na-plate-line', words.line)
    )
    return wall
  }

  function leafletOf(words: PlateWords): HTMLElement {
    const leaflet = make('div', 'na-plate-leaflet')
    leaflet.id = `${parts.id}-leaflet`
    const rows = makeFold(document_, 'na-plate-rows')
    const row = make('div', 'na-plate-row')
    row.setAttribute('role', 'group')
    row.setAttribute('aria-label', words.leaflet)
    rows.body.append(row)
    leaflet.append(rows.fold)
    tabs = []
    /* THE LEAF STANDS UNDER ITS OWN WORD. One order serves both stages: on a
       phone the rack is an accordion and reads it straight, on a desktop the
       row is a grid line and every leaf sits in the band under it. */
    for (const leaf of parts.leaves()) {
      const id = `${parts.id}-leaf-${leaf.id}`
      const tab = make('button', 'na-plate-tab', leaf.tab)
      tab.type = 'button'
      tab.dataset['leaf'] = leaf.id
      tab.setAttribute('aria-expanded', 'false')
      tab.setAttribute('aria-controls', id)
      tab.addEventListener('click', () => toggle(leaf.id))
      tab.addEventListener('keydown', event => step(event, leaf.id))
      tabs.push(tab)
      const panel = makeFold(document_, 'na-plate-leaf', id)
      // The row's word is the leaf's title on the sheet, so the block does
      // not repeat it: the region carries the full name for a reader.
      panel.fold.setAttribute('role', 'region')
      panel.fold.setAttribute('aria-label', leaf.name ?? leaf.tab)
      leaf.render(panel.body)
      row.append(tab, panel.fold)
    }
    return leaflet
  }

  function controlOf(control: PlateControl): HTMLButtonElement {
    const button = make('button', `na-plate-${control.rank}${control.className ? ` ${control.className}` : ''}`, control.word)
    button.type = 'button'
    for (const [name, value] of Object.entries(control.attributes ?? {})) button.setAttribute(name, value)
    button.addEventListener('click', () => { control.press(); dialog.close() })
    return button
  }

  function paint(): void {
    dialog.textContent = ''
    const words = parts.words()
    dialog.setAttribute('aria-label', words.label)
    if (door) paintDoor(words)
    else paintSheet(words)
    height()
  }

  function paintSheet(words: PlateWords): void {
    /* THE HANDLE IS THE PHONE'S WAY UP, and a press is the whole of it: a
       drag is the same move under a thumb that never leaves the glass. */
    const grab = make('button', 'na-plate-grab')
    grab.type = 'button'
    grab.setAttribute('aria-label', words.handle)
    grab.setAttribute('aria-controls', `${parts.id}-leaflet`)
    grab.addEventListener('click', () => { pulledUp = !pulledUp; if (!pulledUp) shutLeaf(); height() })
    let from = 0
    grab.addEventListener('pointerdown', event => { from = event.clientY; grab.setPointerCapture(event.pointerId) })
    grab.addEventListener('pointerup', event => {
      const moved = event.clientY - from
      if (Math.abs(moved) < 24) return
      event.preventDefault()
      pulledUp = moved < 0
      if (!pulledUp) shutLeaf()
      height()
    })
    dialog.append(grab, wallOf(words), leafletOf(words))

    const foot = make('div', 'na-plate-foot')
    const controls = make('div', 'na-plate-controls')
    for (const control of parts.controls()) {
      const button = controlOf(control)
      if (control.rank === 'third') foot.append(button)
      else controls.append(button)
    }
    foot.insertBefore(controls, foot.firstChild)
    dialog.append(foot)
  }

  /* THE DOOR: the wall, the one way in, the small ways beside it and the
     book that holds the leaflet. The reading order is the wall, the way in,
     the small ways, the book, and the leaflet last, whatever stands where. */
  function paintDoor(words: PlateWords): void {
    const go = make('div', 'na-door-go')
    const links = make('div', 'na-door-links')
    for (const control of parts.controls()) {
      const button = controlOf(control)
      if (control.rank === 'primary') {
        button.textContent = ''
        const way = make('span', 'na-door-arrow')
        way.append(icon(document_, ARROW, 'na-door-ic'))
        button.append(make('span', 'na-door-word', control.word), way)
        go.append(button)
      } else links.append(button)
    }
    const book = make('button', 'na-door-book')
    book.type = 'button'
    book.title = words.handle
    book.setAttribute('aria-label', words.handle)
    book.setAttribute('aria-controls', `${parts.id}-leaflet`)
    book.append(icon(document_, BOOK, 'na-door-ic'))
    book.addEventListener('click', () => {
      pulledUp = !pulledUp
      if (!pulledUp) shutLeaf()
      height()
      if (pulledUp) requestAnimationFrame(() => tabs[0]?.focus({ preventScroll: true }))
    })
    dialog.append(wallOf(words), go, links, book, leafletOf(words))
  }

  function shutLeaf(): void {
    if (!openLeaf) return
    const panel = dialog.querySelector<HTMLElement>(`#${CSS.escape(`${parts.id}-leaf-${openLeaf}`)}`)
    if (panel) setFold(panel, false)
    dialog.querySelector(`.na-plate-tab[data-leaf="${openLeaf}"]`)?.setAttribute('aria-expanded', 'false')
    openLeaf = ''
  }

  /** one leaf at a time: the same word shuts it, another word swaps it */
  function toggle(id: string): void {
    const wanted = openLeaf === id ? '' : id
    shutLeaf()
    if (wanted) {
      const panel = dialog.querySelector<HTMLElement>(`#${CSS.escape(`${parts.id}-leaf-${wanted}`)}`)
      if (panel) setFold(panel, true)
      dialog.querySelector(`.na-plate-tab[data-leaf="${wanted}"]`)?.setAttribute('aria-expanded', 'true')
      openLeaf = wanted
      if (narrow.matches) pulledUp = true
      // the rack is a scroll surface once a leaf is open: the word that was
      // pressed stays where the eye left it
      const tab = tabs.find(button => button.dataset['leaf'] === wanted)
      requestAnimationFrame(() => tab?.scrollIntoView({ block: 'nearest' }))
    }
    height()
  }

  function step(event: KeyboardEvent, id: string): void {
    const index = tabs.findIndex(tab => tab.dataset['leaf'] === id)
    const along = narrow.matches ? ['ArrowDown', 'ArrowUp'] : ['ArrowRight', 'ArrowLeft']
    let next = -1
    if (event.key === along[0]) next = (index + 1) % tabs.length
    if (event.key === along[1]) next = (index + tabs.length - 1) % tabs.length
    if (event.key === 'Home') next = 0
    if (event.key === 'End') next = tabs.length - 1
    if (next < 0) return
    event.preventDefault()
    event.stopPropagation()
    tabs[next]!.focus({ preventScroll: true })
  }

  /* ONE TEXT AT A TIME. An entrance sheet is the only text on the screen, so
     the whole wing's chrome stands down behind it at both stages, by
     visibility, and comes back in its place. The narrow stage keeps the
     museum's own window rule on top of it. */
  const standDown = (): void => {
    if (dialog.open) document_.documentElement.dataset['naPlate'] = door ? 'door' : 'open'
    else delete document_.documentElement.dataset['naPlate']
    // the desk's window rule keeps the band standing as a wall, and the door is that band
    windowOwnsTheScreen(document_, dialog.open && (narrow.matches || (!door && deskAny())), narrow.matches ? 'phone' : 'desk')
  }

  // Escape enters: the plate is a welcome and not a question, so cancelling
  // it is the same as pressing the way in.
  dialog.addEventListener('cancel', event => {
    event.preventDefault()
    // an open leaflet on the door is shut first, and the book keeps the hand
    if (door && pulledUp) {
      shutLeaf()
      pulledUp = false
      height()
      dialog.querySelector<HTMLElement>('.na-door-book')?.focus({ preventScroll: true })
      return
    }
    dialog.close()
  })
  dialog.addEventListener('close', () => {
    if (door) setCloseLookBand(null)
    delete document_.documentElement.dataset['naPlate']
    windowOwnsTheScreen(document_, false)
    if (live) parts.onClose()
  })
  /* THE DOOR TAKES THE BAND'S PLACE on a desk: a stage that draws its picture
     above the band draws it above the door instead, and gets its row back at
     the close. A narrow stage keeps its picture whole under the door. */
  const holdBand = (): void => {
    if (!door) return
    if (!dialog.open || narrow.matches) { setCloseLookBand(null); return }
    setCloseLookBand(dialog.getBoundingClientRect().height)
  }
  const answerStage = (): void => { standDown(); if (dialog.open) height(); holdBand() }
  narrow.addEventListener('change', answerStage)
  const resized = (): void => { if (door && dialog.open) holdBand() }
  addEventListener('resize', resized)
  host.append(dialog)

  return {
    element: dialog,
    open() {
      if (!live) return
      // Painted on every open, so a language or a stage that changed while
      // the plate stood is answered by the next open and never remembered.
      pulledUp = false
      openLeaf = ''
      paint()
      if (!dialog.open) dialog.showModal()
      standDown()
      holdBand()
      dialog.querySelector<HTMLButtonElement>('.na-plate-primary')?.focus({ preventScroll: true })
      dialog.scrollTop = 0
    },
    dispose() {
      live = false
      if (door && dialog.open) setCloseLookBand(null)
      narrow.removeEventListener('change', answerStage)
      removeEventListener('resize', resized)
      delete document_.documentElement.dataset['naPlate']
      windowOwnsTheScreen(document_, false)
      if (dialog.open) dialog.close()
      dialog.remove()
    },
  }
}
