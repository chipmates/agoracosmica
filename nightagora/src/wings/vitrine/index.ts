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
import { noteOpened } from '../visit'
import css from './vitrine.css?inline'
import type { VitrineExhibit, VitrinePayloadHost, VitrineRect, VitrineSurface } from './types'

export type { VitrineExhibit, VitrinePayload, VitrinePayloadHost, VitrineRect, VitrineSurface } from './types'

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
/** A drag on the grabber this far decides; a shorter one is a press. */
const GRAB_PX = 24
const GRAB_SLOP = 8

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
  naming.append(namingDot, namingText)
  const line = make('p', 'vitrine-line')
  setRegister(line, 'label')
  const body = make('div', 'vitrine-body')
  const words = make('div', 'vitrine-words')
  const aside = make('div', 'vitrine-aside')
  const after = make('div', 'vitrine-words vitrine-after')
  body.append(naming, line, words, aside, after)
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
  shutMark.textContent = '\u2715'
  // THE HAND MEETS THE WORDS FIRST: the card takes the focus on opening, and
  // the viewport and its controls follow it in the tab order.
  root.append(style, scrim, hole, sheet, card, stage, payloadControls, shutMark)

  let open: string | null = null, invoker: HTMLElement | null = null
  let marked = false, popping = false, disposed = false
  let exhibit: VitrineExhibit | null = null
  let surface: VitrineSurface = 'room', resizeFrames = 0, laidNarrow: boolean | null = null
  let raised = false
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
    const work = surface === 'hold' ? exhibit?.work?.() ?? null : null
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
  function layout(): void {
    if (!open) return
    const width = view.innerWidth, height = view.innerHeight
    const narrow = options.narrow()
    const floor = Math.min(height, Math.max(0, options.floor()))
    root.dataset['narrow'] = String(narrow)
    if (laidNarrow !== narrow) {
      laidNarrow = narrow
      if (narrow) card.insertBefore(payloadControls, controls)
      else root.append(payloadControls)
    }
    if (narrow) {
      // THE WINDOW OWNS THE PHONE. The station's chrome stands down while a
      // window is open, so the sheet runs to the foot of the screen and the
      // work is not read through a third of it.
      const top = 58, bottom = height - 10, left = 8, right = width - 8
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
      if (fill && !raised) {
        place2(peek)
        const asked = grab.getBoundingClientRect().height + body.scrollHeight
          + payloadControls.getBoundingClientRect().height + 26
        peek = Math.min(Math.max(peek, Math.ceil(asked)), Math.round(tall * PEEK_MOST))
      }
      // The sheet is the card's ground; the viewport above it stays open to
      // the stage, so the work is seen and not a shade through a panel.
      place2(fill ? (raised ? Math.round(tall * RAISED_SHARE) : peek) : bottom - top - viewHeight)
      payloadControls.style.cssText = ''
      place(shutMark, { left: right - 50, top: top + 6, width: 44, height: 44 })
      // The peek is what the payload keeps clear of the card, raised or not:
      // a card that rises stands OVER the work rather than resizing it.
      root.style.setProperty('--vitrine-peek', `${fill ? peek : 0}px`)
      grab.hidden = !fill
      shutMark.hidden = false
    } else {
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
    else delete document.documentElement.dataset['naWindow']
    paintHole()
    exhibit?.payload?.layout?.()
  }

  /** The name at the head of the card, and the card's accessible name with
   * it: a window that named itself twice would be read twice. The mark
   * before it carries the exhibit's certainty where the payload has one. */
  function nameIt(title: string, certainty?: string | null): void {
    const said = title.trim()
    namingText.textContent = said
    naming.hidden = !said
    naming.lang = options.lang()
    namingDot.hidden = !certainty
    if (certainty) namingDot.style.setProperty('--certainty', certainty)
    else namingDot.style.removeProperty('--certainty')
    if (said) {
      card.setAttribute('aria-labelledby', naming.id)
      card.removeAttribute('aria-label')
      return
    }
    card.setAttribute('aria-label', title)
    card.removeAttribute('aria-labelledby')
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
    viewport: () => ({ ...rects.view }),
    work: () => exhibit?.work?.() ?? null,
    surface: setSurface,
    describe: text => payloadEl.setAttribute('aria-label', text),
    raise: open => setRaised(open),
    peeked: () => !raised,
    rename: (title, head, certainty) => {
      nameIt(title, certainty)
      if (head === undefined) return
      line.textContent = head ?? ''
      line.hidden = !head
    },
  })

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
  shutMark.addEventListener('click', () => shut())
  grab.addEventListener('click', () => setRaised(!raised))
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
      nameIt(next.title)
      line.textContent = next.line ?? ''
      line.hidden = !next.line
      line.lang = options.lang()
      words.replaceChildren(...next.card)
      after.replaceChildren(...next.after ?? [])
      body.scrollTop = 0
      // The two that walk the wall stand at the two ends of the controls' row.
      const [previousControl, nextControl] = next.walk ?? []
      controls.replaceChildren(...[previousControl, ...next.controls, nextControl].filter((node): node is HTMLElement => Boolean(node)))
      root.hidden = false
      if (!root.isConnected) host.append(root)
      if (!advancing) mark()
      laidNarrow = null
      layout()
      // The eye walks where it can walk. On calm, on the phone and under
      // reduced motion it stands still and the window opens where it stands.
      onOpen(next.id, advancing ? previous : null)
      // THE ONE DOOR OF THE NIGHT. Every close look of every kind opens here,
      // so the visitor's own record is written by one line and holds nothing
      // a visitor did not open.
      noteOpened(next.id)
      next.payload?.mount(payloadHost())
      layout()
      const row = [...controls.children]
      const back = held < 0 ? null : row[Math.min(held, row.length - 1)]
      if (back instanceof HTMLElement && !(back as HTMLButtonElement).disabled) back.focus({ preventScroll: true })
      else if (!advancing || inside) card.focus({ preventScroll: true })
    },
    close: shut,
    escape() {
      if (!open) return false
      shut()
      return true
    },
    owns(target) {
      return open !== null && target !== null && (card.contains(target) || stage.contains(target) || payloadControls.contains(target))
    },
    key(event) {
      if (!open || !exhibit?.payload?.key) return false
      return exhibit.payload.key(event)
    },
    held() {
      return open !== null && surface === 'hold' && resizeFrames === 0
    },
    reading() {
      if (!open) return null
      const box = options.narrow() ? sheet.getBoundingClientRect() : card.getBoundingClientRect()
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
      leaving.abort()
      delete document.documentElement.dataset['naWindow']
      root.remove()
    },
  }
}
