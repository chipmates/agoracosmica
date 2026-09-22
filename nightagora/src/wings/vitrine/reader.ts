/** THE READER: a book in the window, one side at a time, as near as the
 * scan goes.
 *
 * The kernel piece is a book: an ordered list of sides, each with a scan, a
 * name, a line and whatever witnesses exist beside it. This module owns the
 * window's side of that: the deep viewer the side stands in, the strip of
 * sides under it, the segmented control, the two arrows, the keys, the
 * swipe and the words in the card. A wing supplies the sides and their
 * words; it never supplies a layout.
 *
 * THE WAYS ARE DECLARED PER SIDE, never fixed here. A manuscript leaf has
 * three (the hand, the mirror, the printed page facing it), a printed
 * edition has two, a leaf with no transcription has one, and the module
 * takes whatever the side declares.
 */
import { createDeepPlatePayload, type DeepPlatePayload, type DeepPlateSource, type DeepPlateTier, type DeepPlateWindow } from './deep-plate'
import css from './reader.css?inline'
import type { VitrinePayload, VitrinePayloadHost } from './types'

/** One way of looking at one side. The first is what stands when the side
 * opens. */
export interface ReaderWay {
  id: string
  /** The control's word, already in the page's language. */
  label: string
  /** The scan this way shows. The side's own source where it is left out. */
  source?: DeepPlateSource
  /** The share of that scan Home shows. A way that brings its own source
   * brings its own window with it, and nothing where it has none. */
  window?: DeepPlateWindow | null
  /** Reversed on the glass: the viewer's own flip, so every word and every
   * control beside it stays the right way round. */
  mirrored?: boolean
  /** The line the card carries while this way stands, under the side's own. */
  line?: string | null
  /** What the view says at the ceiling of this way's source. */
  ceiling?: string
}

export interface ReaderSide {
  /** The side's own key, which is what a caller opens it by. */
  id: string
  /** What it is called: `83 verso`. */
  label: string
  /** What is on it, in the page's language. */
  shows: string
  source: DeepPlateSource
  /** The share of the source Home shows: the page on the sheet it was
   * printed on, with the pan still reaching the sheet's own margin. */
  window?: DeepPlateWindow | null
  /** The cell in the strip, where the store holds one. */
  thumb: string | null
  ways: readonly ReaderWay[]
  /** The colour of the museum's own certainty word for this reproduction. */
  colour?: string
  /** A named study this side is known by, printed under its line. */
  named?: string | null
  /** The line at the card's head while this side stands. Left out, the
   * caller's own line stays where it is: one volume has one line, while a
   * wall of sheets has one per sheet. */
  head?: string | null
  /** Who holds this one, where the book's own holder is not it. */
  holder?: string
  /** THE STRIP IS ONE VOLUME. A wing whose book is several volumes names
   * each side's own, and the strip holds the sides of the one open now. */
  volume?: string
}

/** A cell in the strip that is not a page. Absence shown as absence: it
 * carries the source's own sentence about what is not there. */
export interface ReaderGap {
  /** The side it stands after. */
  after: string
  text: string
}

export interface ReaderBook {
  sides: readonly ReaderSide[]
  gaps?: readonly ReaderGap[]
  /** The strip's own name for the volume open now, in the page's language. */
  stripLabel(volume: string | undefined, sides: number): string
  /** Who holds the original, in the page's language. */
  holder: string
  /** What this reproduction is, said under every side. */
  honesty: string
}

export interface ReaderWords {
  /** The deep viewer's own three, in the page's language. */
  whole: string
  nearer: string
  further: string
  /** What the view says at the ceiling where a way names no other. */
  ceiling: string
  previous: string
  next: string
  /** The position line: `{n} of {total}`. */
  place: string
  /** The witnesses behind one press, and the phone's own raise. */
  more: string
  moreLabel: string
  /** The way back to the page from a card raised over it. */
  back: string
}

export interface ReaderPayload extends VitrinePayload {
  /** Open one side by its key. */
  open(id: string): void
  /** The side standing now, for a caller painting the record beside it. */
  current(): ReaderSide | null
}

/** The room behind the window, where a wing has one: it turns its own
 * leaves under the held frame, and nothing stands until the eye does. */
export interface ReaderRoom {
  /** The eye was walked to the book. */
  walked(): boolean
  /** The eye stands where it will stand. */
  standing(): boolean
  /** The room has nothing on its way: no leaf turning, no plate arriving. */
  still(): boolean
  /** The room turns to this side behind the held frame. */
  open(side: ReaderSide): void
  /** Leave the room as the reading found it. */
  leave(): void
}

/** Frames the room draws before it may be held, after the last change. */
const SETTLE_FRAMES = 2
/** A swipe on the glass turns the side: this far across, and no further
 * down, with the leaf standing at its own fit so nothing is being panned. */
const SWIPE_PX = 44
const SWIPE_SLOPE = 1.6

export function createReaderPayload(options: {
  book: Promise<ReaderBook>
  /** The side the reading opens at. */
  start?: string
  words: ReaderWords
  tier(): DeepPlateTier
  room?: ReaderRoom
  /** What a wing hangs behind More for one side: its transcriptions, its
   * translations, whatever witnesses exist. */
  witnesses?(side: ReaderSide): readonly HTMLElement[]
  /** The side or the way changed: a caller repaints what stands beside it. */
  changed?(): void
}): ReaderPayload {
  let host: VitrinePayloadHost | undefined
  let book: ReaderBook | undefined
  let at = 0, way = 0
  let root: HTMLDivElement | undefined, stage: HTMLDivElement | undefined
  let ground: HTMLImageElement | undefined, shelf: HTMLOListElement | undefined
  let plate: DeepPlatePayload | undefined
  let moreOpen = false, settled = 0, live = false
  const cells: HTMLButtonElement[] = []
  /** Which side of the book each cell of the strip stands for. */
  const cellOf: number[] = []
  const ways: HTMLButtonElement[] = []
  const steps: { previous?: HTMLButtonElement; next?: HTMLButtonElement } = {}
  const listening = new AbortController()

  const make = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] => {
    const n = host!.element.ownerDocument.createElement(tag)
    n.className = cls
    if (text !== undefined) n.textContent = text
    return n
  }
  const side = (): ReaderSide | undefined => book?.sides[at]
  /** The sides of the volume open now, in the order the binding holds them. */
  function volume(): number[] {
    const here = side()
    if (!book) return []
    return book.sides.map((entry, index) => ({ entry, index }))
      .filter(item => item.entry.volume === here?.volume).map(item => item.index)
  }
  const chosen = (): ReaderWay | undefined => side()?.ways[way] ?? side()?.ways[0]

  /** The room draws while the eye walks to the book. Once it stands, the
   * viewer takes the window and the room holds its last frame. */
  function mountPlate(): void {
    if (plate || !host || !stage || !book) return
    const here = side()
    if (!here) return
    plate = createDeepPlatePayload({
      title: here.label,
      description: here.shows,
      source: sourceOf(here),
      window: windowOf(here),
      words: { whole: options.words.whole, nearer: options.words.nearer, further: options.words.further,
        ceiling: options.words.ceiling, rule: [] },
      // The page grows out of where the room drew the book, where the eye
      // walked to it, and stands at once where it did not.
      from: () => host?.work() ?? null,
      tier: options.tier,
      // THE MUSEUM DOES NOT KNOW THE CENTIMETRES OF A LEAF, so no rule is
      // drawn beside it and the corner it would take names the side instead.
      pxPerCm: null,
      onDrawn: () => { if (ground) ground.hidden = true },
    })
    plate.mount(inner())
    paintStand()
    showSide(true)
  }

  /** The viewer's own host: the stage the reader keeps clear of the strip,
   * its own row for the two zoom controls, and the window's caption. */
  function inner(): VitrinePayloadHost {
    const outer = host!
    const zoom = make('div', 'reader-zoom')
    outer.controls.append(zoom)
    return {
      element: stage!,
      controls: zoom,
      aside: make('div', ''),
      caption: outer.caption,
      lang: outer.lang,
      narrow: outer.narrow,
      reducedMotion: outer.reducedMotion,
      banded: outer.banded,
      // The viewer seats itself in the box it actually stands in, which is
      // the viewport less the strip under the page.
      viewport: () => {
        const box = stage!.getBoundingClientRect()
        return box.width > 0 ? { left: box.left, top: box.top, width: box.width, height: box.height } : outer.viewport()
      },
      work: () => outer.work(),
      surface: kind => outer.surface(kind),
      describe: text => outer.describe(text),
    }
  }

  function sourceOf(here: ReaderSide): DeepPlateSource {
    return chosen()?.source ?? here.source
  }
  /** The window of the way standing: its own where it brings a source, and
   * the side's where it reads the side's. */
  function windowOf(here: ReaderSide): DeepPlateWindow | null {
    const view = chosen()
    return view?.source ? view.window ?? null : view?.window ?? here.window ?? null
  }

  /** The side standing now, in the viewer that is already up. */
  function showSide(first: boolean): void {
    const here = side(), view = chosen()
    if (!here || !plate) return
    if (!first) {
      plate.show({
        source: view?.source ?? here.source,
        window: windowOf(here),
        title: here.label,
        description: here.shows,
        ceiling: view?.ceiling ?? options.words.ceiling,
        flipped: Boolean(view?.mirrored),
      })
    }
    dockShelf()
    paintStand()
  }

  /** The folio and its line, on the glass, in the corner the rule would
   * have had. */
  function paintStand(): void {
    const here = side()
    if (!plate || !here || !host) return
    const folio = make('p', 'deep-stand-folio')
    if (here.colour) {
      const dot = make('span', 'deep-stand-dot')
      dot.style.setProperty('--certainty', here.colour)
      dot.setAttribute('aria-hidden', 'true')
      folio.append(dot)
    }
    folio.append(make('span', '', here.label))
    const shows = make('p', 'deep-stand-shows', here.shows)
    shows.hidden = !here.shows
    folio.lang = host.lang
    shows.lang = host.lang
    plate.stand([folio, shows])
  }

  /** THE WORDS OF ONE SIDE, in the card: where it stands in the book, what
   * is on it, the holder, and the witnesses one deliberate press away. The
   * side's own name is the window's heading, which every kind is named in. */
  function paintWords(): void {
    if (!host || !book) return
    const here = side()
    if (!here) return
    const aside = host.aside
    aside.textContent = ''
    const block = make('section', 'reader-words')
    block.lang = host.lang
    // WHERE THE SIDE STANDS IN ITS BOOK, which a book of one side has no
    // need to say, and a label in the band already says in its name row.
    const inside = volume(), place = inside.indexOf(at)
    if (inside.length > 1 && !host.banded) block.append(make('p', 'vitrine-meta reader-place',
      options.words.place.replace('{n}', String(place + 1)).replace('{total}', String(inside.length))))
    if (here.shows) block.append(make('p', '', here.shows))
    if (here.named) block.append(make('p', 'reader-named', here.named))
    const line = chosen()?.line
    if (line) block.append(make('p', '', line))
    block.append(make('p', 'vitrine-meta', here.holder ?? book.holder))
    // THE CARD IS THE SIDE'S, not the side the window opened at: a wall of
    // sheets renames its card as the hand walks it.
    // where the side stands in its book goes with the name: a label that
    // counts the volumes of a room would count the wrong thing here
    host.rename?.(here.label, here.head, here.colour ?? null,
      inside.length > 1 ? { at: place + 1, of: inside.length } : null)
    if (witnesses().length) {
      const texts = make('div', 'vitrine-description reader-texts')
      texts.id = 'vitrine-reader-texts'
      texts.hidden = !moreOpen
      texts.append(...witnesses())
      const more = make('button', 'vitrine-more', options.words.more)
      more.type = 'button'
      more.setAttribute('aria-expanded', String(moreOpen))
      more.setAttribute('aria-controls', texts.id)
      more.addEventListener('click', () => {
        moreOpen = !moreOpen
        texts.hidden = !moreOpen
        more.setAttribute('aria-expanded', String(moreOpen))
      }, { signal: listening.signal })
      block.append(more, texts)
    }
    block.append(make('p', 'vitrine-meta', book.honesty))
    aside.append(block)
    // THE PHONE FOLDS THE CARD TO A PEEK. What stands on it is the page's
    // own name and the one control that brings the rest of the words up.
    if (host.narrow && host.raise && host.peeked?.() !== false) {
      const raise = make('button', 'vitrine-more reader-raise', options.words.moreLabel)
      raise.type = 'button'
      raise.addEventListener('click', () => host?.raise?.(true), { signal: listening.signal })
      aside.append(raise)
    }
    paintControls()
  }

  function witnesses(): readonly HTMLElement[] {
    const here = side()
    return here && options.witnesses ? options.witnesses(here) : []
  }

  /** The ways as one segmented control, and the two that step one side. */
  function paintControls(): void {
    for (const [index, button] of ways.entries()) {
      const label = side()?.ways[index]
      if (!label || !button) continue
      button.textContent = label.label
      button.setAttribute('aria-pressed', String(index === way))
      button.hidden = false
    }
    for (let index = side()?.ways.length ?? 0; index < ways.length; index++) ways[index]!.hidden = true
    // A PAGE WITH ONE WAY HAS NO SEGMENTS, and the two that step the book
    // take the row rather than standing in a corner of it.
    steps.previous?.parentElement?.setAttribute('data-ways', String(side()?.ways.length ?? 0))
    if (steps.previous) steps.previous.disabled = at <= 0
    if (steps.next) steps.next.disabled = !book || at >= book.sides.length - 1
  }

  function control(cls: string, label: string, run: () => void, name?: string): HTMLButtonElement {
    const button = make('button', `vitrine-control ${cls}`, label)
    button.type = 'button'
    if (name) button.setAttribute('aria-label', name)
    button.addEventListener('click', run, { signal: listening.signal })
    return button
  }

  /* WHERE THE STRIP STANDS. Under the leaf it takes a band of the height
     the page is fitted into, and a portrait leaf is fitted BY its height:
     every pixel of that band comes off the page. Beside it, it takes width
     the same leaf is not using. So the two boxes are measured against the
     side's own rectangle and the wider page wins, per side and per resize.
     The phone keeps the strip under the leaf: there the page is fitted by
     its width and a column would come straight off it. */
  /** the column the strip takes beside the leaf, its own gap included */
  const COLUMN = 96
  /** what the strip and the control row take under the leaf, and the row alone */
  const FOOT_UNDER = 156, FOOT_ALONE = 60

  /** The side's displayed rectangle, as wide over high. Null while no side
   * stands, where the strip has no measurement to decide on. */
  function shownAspect(): number | null {
    const here = side()
    if (!here) return null
    const source = sourceOf(here), cut = windowOf(here)
    const width = source.width * (cut ? cut.right - cut.left : 1)
    const height = source.height * (cut ? cut.bottom - cut.top : 1)
    return width > 0 && height > 0 ? width / height : null
  }

  function dockShelf(): void {
    if (!root || !shelf) return
    const aspect = shownAspect()
    if (shelf.hidden || !host || host.narrow || aspect === null) { root.dataset['dock'] = 'foot'; return }
    const box = root.getBoundingClientRect()
    if (box.width <= 0 || box.height <= 0) return
    const under = Math.min(box.width, (box.height - FOOT_UNDER) * aspect)
    const beside = Math.min(box.width - COLUMN, (box.height - FOOT_ALONE) * aspect)
    root.dataset['dock'] = beside > under ? 'side' : 'foot'
  }

  /** THE STRIP IS THE BOOK. Every side of the volume open now as one cell,
   * the one standing lit, and the places the source itself says are not
   * there standing as absences between them. */
  function paintShelf(): void {
    if (!shelf || !book) return
    shelf.textContent = ''
    cells.length = 0
    cellOf.length = 0
    const inside = volume()
    // A BOOK OF ONE SIDE HAS NO STRIP, and the page takes the room the strip
    // would have stood in.
    const single = inside.length < 2 && !(book.gaps ?? []).length
    shelf.hidden = single
    if (root) root.dataset['strip'] = String(!single)
    dockShelf()
    if (single) return
    shelf.setAttribute('aria-label', book.stripLabel(side()?.volume, inside.length))
    const gaps = new Map((book.gaps ?? []).map(gap => [gap.after, gap.text]))
    for (const index of inside) {
      const entry = book.sides[index]!
      const item = make('li', 'reader-cell')
      const button = make('button', 'reader-page')
      button.type = 'button'
      button.dataset['side'] = entry.id
      button.setAttribute('aria-label', entry.label)
      button.tabIndex = -1
      if (entry.thumb) {
        const thumb = make('img', 'reader-page-thumb')
        thumb.alt = ''
        thumb.loading = 'lazy'
        thumb.decoding = 'async'
        thumb.src = entry.thumb
        button.append(thumb)
      } else button.append(make('span', 'reader-page-name', entry.label))
      button.addEventListener('click', () => go(index), { signal: listening.signal })
      cells.push(button)
      cellOf.push(index)
      item.append(button)
      shelf.append(item)
      const gap = gaps.get(entry.id)
      if (gap === undefined) continue
      const absence = make('li', 'reader-cell reader-absence')
      absence.lang = host?.lang ?? 'en'
      absence.append(make('p', '', gap))
      shelf.append(absence)
    }
    const first = cells[0]
    if (first) first.tabIndex = 0
    markShelf()
  }

  function markShelf(): void {
    for (const [cell, button] of cells.entries()) {
      if (cellOf[cell] === at) button.setAttribute('aria-current', 'true')
      else button.removeAttribute('aria-current')
    }
    const current = cells[cellOf.indexOf(at)]
    if (!current || !shelf || !shelf.isConnected) return
    if (root?.dataset['dock'] === 'side') {
      const down = current.offsetTop - (shelf.clientHeight - current.offsetHeight) / 2
      shelf.scrollTop = Math.max(0, Math.min(shelf.scrollHeight - shelf.clientHeight, down))
      return
    }
    const target = current.offsetLeft - (shelf.clientWidth - current.offsetWidth) / 2
    shelf.scrollLeft = Math.max(0, Math.min(shelf.scrollWidth - shelf.clientWidth, target))
  }

  /** ONE ARROW STEPS ONE SIDE, never two records of an edition: from 23r to
   * 23v to 24r, which is what a hand turning a book does. */
  function go(next: number): void {
    if (!book) return
    const bounded = Math.max(0, Math.min(book.sides.length - 1, next))
    if (bounded === at) return
    const wasVolume = side()?.volume
    at = bounded
    if (side()?.volume !== wasVolume) paintShelf()
    way = 0
    const here = side()
    if (here) {
      if (ground && here.thumb) { ground.src = here.thumb; ground.hidden = Boolean(plate?.drawn()) }
      options.room?.open(here)
    }
    showSide(false)
    paintWords()
    markShelf()
    options.changed?.()
  }

  function chooseWay(index: number): void {
    if (index === way || !side()?.ways[index]) return
    way = index
    showSide(false)
    paintWords()
    options.changed?.()
  }

  /** A DRAG ON THE PAGE TURNS IT, where there is nothing to pan: at the
   * side's own fit the glass holds the whole page, so a flick across it is
   * a hand turning a leaf and never a pan that went nowhere. */
  function watchSwipe(element: HTMLElement): void {
    let from: { x: number; y: number; id: number } | null = null
    element.addEventListener('pointerdown', event => {
      if (!event.isPrimary || from) return
      from = { x: event.clientX, y: event.clientY, id: event.pointerId }
    }, { signal: listening.signal, capture: true })
    const end = (event: PointerEvent): void => {
      if (!from || event.pointerId !== from.id) return
      const dx = event.clientX - from.x, dy = event.clientY - from.y
      from = null
      if (!host?.narrow || !plate?.home()) return
      if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(dy) * SWIPE_SLOPE) return
      go(at + (dx < 0 ? 1 : -1))
    }
    element.addEventListener('pointerup', end, { signal: listening.signal, capture: true })
    element.addEventListener('pointercancel', () => { from = null }, { signal: listening.signal, capture: true })
  }

  return {
    kind: 'manuscript',
    fill: true,
    raiseWords: { up: options.words.moreLabel, down: options.words.back },
    open(id) {
      const index = book?.sides.findIndex(entry => entry.id === id) ?? -1
      if (index >= 0) go(index)
    },
    current() { return side() ?? null },
    mount(next) {
      host = next
      live = true
      settled = 0
      moreOpen = false
      const document = next.element.ownerDocument
      root = make('div', 'reader')
      const style = document.createElement('style')
      style.textContent = css
      ground = make('img', 'reader-ground')
      ground.alt = ''
      ground.decoding = 'async'
      ground.hidden = true
      stage = make('div', 'reader-stage')
      shelf = make('ol', 'reader-shelf')
      shelf.setAttribute('role', 'list')
      root.append(style, ground, stage, shelf)
      next.element.append(root)
      next.surface('room')
      // The row a hand meets: the two that step one side with the ways
      // between them, all at the row's own size.
      const row = make('div', 'reader-row')
      steps.previous = control('vitrine-step', '‹', () => go(at - 1), options.words.previous)
      steps.next = control('vitrine-step', '›', () => go(at + 1), options.words.next)
      row.append(steps.previous)
      for (let index = 0; index < 4; index++) {
        const button = control('reader-way', '', () => chooseWay(index))
        button.hidden = true
        ways.push(button)
        row.append(button)
      }
      row.append(steps.next)
      next.controls.append(row)
      // THE STRIP TAKES ONE TAB STOP. Inside it the arrows walk, and its two
      // ends are Home and End.
      shelf.addEventListener('keydown', event => {
        const target = event.target
        if (!(target instanceof HTMLButtonElement)) return
        const index = cells.indexOf(target)
        if (index < 0) return
        const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
        const to = step ? index + step : event.key === 'Home' ? 0 : event.key === 'End' ? cells.length - 1 : -1
        if (to < 0) return
        event.preventDefault()
        event.stopPropagation()
        const bounded = Math.max(0, Math.min(cells.length - 1, to))
        for (const cell of cells) cell.tabIndex = -1
        const landing = cells[bounded]
        if (!landing) return
        landing.tabIndex = 0
        landing.focus({ preventScroll: true })
        landing.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      }, { signal: listening.signal })
      watchSwipe(root)
      void options.book.then(loaded => {
        if (!live || !host) return
        book = loaded
        const start = options.start ? loaded.sides.findIndex(entry => entry.id === options.start) : 0
        at = Math.max(0, start)
        way = 0
        const here = side()
        if (here?.thumb && ground) { ground.src = here.thumb; ground.hidden = false }
        paintShelf()
        paintWords()
        // The eye is walking: the room draws the book until it stands, and
        // the viewer takes the window after it.
        if (!options.room?.walked() || options.room.standing()) mountPlate()
      })
    },
    update() {
      if (!host || plate || !book) return
      const room = options.room
      // THE ROOM DRAWS THE WALK. The viewer takes the window once the eye
      // stands still over the book and nothing is on its way to it.
      if (room?.walked() && !(room.standing() && room.still())) { settled = 0; return }
      if (++settled > SETTLE_FRAMES) mountPlate()
    },
    layout() {
      dockShelf()
      plate?.layout?.()
      markShelf()
      // The card rose or went back down: the control that moves it says
      // which way it now goes.
      if (host?.narrow) paintWords()
    },
    key(event) {
      // The arrows pan the page, which is the viewer's own; a comma and a
      // full stop turn it, which is what an edition's own reader does.
      if (event.key === ',') { go(at - 1); return true }
      if (event.key === '.') { go(at + 1); return true }
      if (event.key === 'Home' && book) { go(0); return true }
      if (event.key === 'End' && book) { go(book.sides.length - 1); return true }
      return plate?.key?.(event) ?? false
    },
    unmount() {
      live = false
      listening.abort()
      plate?.unmount()
      plate = undefined
      options.room?.leave()
      root?.remove()
      root = undefined; stage = undefined; ground = undefined; shelf = undefined
      cells.length = 0
      ways.length = 0
      host = undefined
    },
  }
}
