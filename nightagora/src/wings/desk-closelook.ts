/* THE CLOSE LOOK'S LABEL BAND. The work owns the stage and the museum stands
   under it: nothing of the museum is laid over the work, and everything a
   visitor can read or press about it is in one band at the foot of the screen.

   The band is the station's band with one row more: the step back to the room
   stands above the work's name, which is why a close look measures 224 where
   a station measures 192. Its right column is the kind's own instruments over
   the two ways, so a painting's zoom, a machine's clock and a page's versions
   all stand in one place.

   Nothing here knows a wing. The window hands it a view: the name, the line,
   the certainty, the place in the set, the room behind, the module's own
   sentences for the drawer, and the nodes of the controls the wing already
   built, each under the role the wing gave it. */

import { deskMark } from './desk-chrome'
import { deskControl } from './desk-story'
import { setCloseLookBand } from './desk-stage'
import { setRegister } from './frame'
import { LOBBY_TEXT } from '../content/lobby'
import type { VinciCertainty, VinciText } from './vinci/content'

export interface CloseLookView {
  id: string
  /** the work's own name, in the page's language */
  title: string
  /** the one thing to remember, in the page's language */
  line: string | null
  /** the payload's kind, which chooses the gold control's word */
  kind: string
  certainty: VinciCertainty | null
  /** where the work stands in the set it belongs to, counted from one */
  set: { at: number; of: number } | null
  /** the room the one step back leads to, in the page's language */
  room: string
  /** the module's own sentences, which the drawer holds */
  words: readonly HTMLElement[]
  /** the wing's own controls, by the role the wing gave them */
  record: HTMLElement | null
  /** the two that walk the set: the way back and the way on */
  back: HTMLElement | null
  on: HTMLElement | null
  /** what the way on leads to, where the set names it */
  onTitle: string | null
  /** the machine's own play control, where the kind has one */
  run: HTMLElement | null
}

export interface CloseLookBand {
  readonly element: HTMLElement
  /** where the payload's own row stands: the kind's instruments */
  readonly instruments: HTMLElement
  /** the band's measured height, which is the price the stage pays */
  height(): number
  show(view: CloseLookView): void
  /** a machine's clock, counted in steps and not in seconds */
  step(at: number, of: number): void
  clear(): void
  /** the stage changed size, or a language did */
  measure(): void
  /** True when the key was the band's. */
  key(event: KeyboardEvent): boolean
  dispose(): void
}

const SVG = 'http://www.w3.org/2000/svg'
const ARROW_ON = 'M3 8h10M9 4l4 4-4 4'
const ARROW_BACK = 'M13 8H3M7 4L3 8l4 4'
const STEP_BACK = 'M10 3L5 8l5 5'

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

/* EVERY DISPLAYED WORD OF THIS BAND IS THE CARD DATA'S, by key: the way on
   for each kind, the run, the two side paths, and the count's own pattern. */
const WORD = {
  more: () => deskControl('shared', 'read_more'),
  work: () => deskControl('walk', 'next_work'),
  page: () => deskControl('walk', 'next_page'),
  machine: () => deskControl('walk', 'next_machine'),
  run: () => deskControl('walk', 'run_it'),
  place: () => deskControl('picture', 'place'),
  step: () => deskControl('machine', 'step'),
  close: () => LOBBY_TEXT.close,
}

/** the word the gold control carries at a kind */
function wayOn(kind: string): VinciText {
  if (kind === 'machine') return WORD.machine()
  if (kind === 'manuscript') return WORD.page()
  return WORD.work()
}

export function createCloseLookBand(options: {
  lang(): 'en' | 'de'
  /** the one step back, which is the window's own Close */
  back(): void
  /** the band's height changed, so the window lays its payload out again */
  resized(): void
}): CloseLookBand {
  const say = (value: VinciText): string => value[options.lang()]

  const root = make('div', 'desk-clb')
  const stepBack = make('button', 'desk-clb-step')
  stepBack.type = 'button'
  stepBack.addEventListener('click', () => options.back())

  const left = make('div', 'desk-clb-left')
  const cap = make('div', 'desk-clb-cap')
  const nameRow = make('div', 'desk-name')
  const title = make('span', 'desk-chapter')
  const clock = make('span', 'desk-clock')
  const count = make('span', 'desk-count')
  const line = make('p', 'desk-line desk-clb-line')
  /* THE FOOT ROW STANDS UNDER BOTH TEXTS, the line and the drawer, so the
     word that opened the drawer is the word that closes it, in the place the
     hand already is. */
  const foot = make('div', 'desk-foot desk-clb-foot')
  const more = make('button', 'desk-word-control desk-clb-more')
  more.type = 'button'
  more.setAttribute('aria-expanded', 'false')
  cap.append(nameRow, line)

  /* THE DRAWER IS THE BAND GROWN, as it is at a station: the same wall, the
     same margin, and the name row kept so the eye keeps the place it read.
     The band stops at its top height; what the drawer holds beyond it
     scrolls inside its own box, and a fade at that box's foot says more
     lies below. */
  const drawer = make('div', 'desk-clb-drawer')
  drawer.id = 'desk-closelook-drawer'
  drawer.hidden = true
  const drawerName = make('div', 'desk-name desk-clb-drawer-name')
  const drawerTitle = make('span', 'desk-chapter')
  const drawerCount = make('span', 'desk-count')
  const well = make('div', 'desk-clb-well')
  const scroll = make('div', 'desk-clb-scroll')
  scroll.setAttribute('role', 'region')
  const drawerWords = make('div', 'desk-clb-words')
  setRegister(drawerWords, 'drawer')
  const fade = make('div', 'desk-clb-fade')
  fade.setAttribute('aria-hidden', 'true')
  scroll.append(drawerWords)
  well.append(scroll, fade)
  drawer.append(drawerName, well)
  left.append(cap, drawer, foot)
  more.setAttribute('aria-controls', drawer.id)

  /* THE KIND'S OWN INSTRUMENTS, at the band's right above the ways: the
     window docks the payload's own row here, whatever the kind built. */
  const rightColumn = make('div', 'desk-clb-right')
  const instruments = make('div', 'desk-clb-inst')
  const ways = make('div', 'desk-clb-ways')
  const backWay = make('button', 'desk-back desk-clb-back')
  backWay.type = 'button'
  backWay.append(icon(ARROW_BACK))
  const on = make('button', 'desk-on desk-clb-on')
  on.type = 'button'
  const onWords = make('span', 'desk-on-words')
  const onKicker = make('span', 'desk-on-kicker')
  const onTitle = make('span', 'desk-on-title')
  onWords.append(onKicker, onTitle)
  const onArrow = make('span', 'desk-on-arrow')
  onArrow.append(icon(ARROW_ON))
  on.append(onWords, onArrow)
  ways.append(backWay, on)
  rightColumn.append(instruments, ways)
  root.append(stepBack, left, rightColumn)

  let view: CloseLookView | null = null
  /** the run a machine has not had yet, which is what the gold control asks
      for before it offers the next machine */
  let ran = false
  let measured = 0

  function press(node: HTMLElement | null): void {
    if (!node || (node as HTMLButtonElement).disabled) return
    node.click()
  }

  backWay.addEventListener('click', () => press(view?.back ?? null))
  on.addEventListener('click', () => {
    const run = view?.run ?? null
    if (view?.kind === 'machine' && !ran && run) {
      // a run already under way is not started twice: the word goes on, the
      // machine keeps running
      ran = true
      if (run.getAttribute('aria-pressed') !== 'true') press(run)
      paintWays()
      return
    }
    press(view?.on ?? null)
  })
  more.addEventListener('click', () => openDrawer(drawer.hidden))

  function openDrawer(open: boolean): void {
    if (open && !drawerWords.childElementCount) return
    drawer.hidden = !open
    if (open) root.dataset['drawer'] = 'open'
    else delete root.dataset['drawer']
    paintMore()
    scroll.scrollTop = 0
    measure()
    if (open) scroll.focus({ preventScroll: true })
    else more.focus({ preventScroll: true })
  }

  /** Read more at rest; Close with its key while the drawer stands, in the
      same place, so the way back is where the hand already is. */
  function paintMore(): void {
    const open = !drawer.hidden
    more.textContent = ''
    more.setAttribute('aria-expanded', String(open))
    if (!open) {
      more.textContent = say(WORD.more())
      more.removeAttribute('aria-keyshortcuts')
      return
    }
    const hint = make('span', 'desk-key', 'Esc')
    hint.setAttribute('aria-hidden', 'true')
    more.append(document.createTextNode(say(WORD.close())), hint)
    more.setAttribute('aria-keyshortcuts', 'Escape')
  }

  /** The fade stands only while more lies below the drawer's visible foot,
      and the box takes the keyboard only when it has somewhere to go. */
  function paintFade(): void {
    // a few pixels of rounding are not "more"
    const over = scroll.scrollHeight - scroll.clientHeight
    const below = !drawer.hidden && over > 3 && scroll.scrollTop < over - 3
    if (below) drawer.dataset['more'] = 'true'
    else delete drawer.dataset['more']
    scroll.tabIndex = !drawer.hidden && over > 3 ? 0 : -1
  }
  scroll.addEventListener('scroll', paintFade, { passive: true })
  const sized = new ResizeObserver(() => paintFade())
  sized.observe(scroll)
  sized.observe(drawerWords)

  /* THE BOX SCROLLS BY ITS OWN KEYS while it has the focus: the arrows here
     read on down the text, and never walk the set behind it. */
  const ROW = 40
  scroll.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey) return
    const page = Math.max(ROW, scroll.clientHeight - ROW)
    const by = event.key === 'ArrowDown' ? ROW : event.key === 'ArrowUp' ? -ROW
      : event.key === 'PageDown' ? page : event.key === 'PageUp' ? -page : 0
    if (by) scroll.scrollBy({ top: by })
    else if (event.key === 'Home') scroll.scrollTop = 0
    else if (event.key === 'End') scroll.scrollTop = scroll.scrollHeight
    else return
    event.preventDefault()
  })

  /** the gold control's two states at a machine, and its one everywhere else */
  function paintWays(): void {
    if (!view) return
    const on_ = view.on as HTMLButtonElement | null
    const running = view.kind === 'machine' && !ran && Boolean(view.run)
    const target = view.onTitle ?? ''
    onKicker.textContent = say(running ? WORD.run() : wayOn(view.kind))
    onTitle.textContent = running ? '' : target
    onTitle.hidden = running || !target
    on.disabled = running ? false : !on_ || on_.disabled
    on.setAttribute('aria-label', `${onKicker.textContent}${onTitle.hidden ? '' : ` · ${onTitle.textContent}`}`)
    const back = view.back as HTMLButtonElement | null
    backWay.disabled = !back || back.disabled
    backWay.setAttribute('aria-label', back?.getAttribute('aria-label') ?? '')
  }

  function measure(): void {
    requestAnimationFrame(() => {
      const box = root.getBoundingClientRect()
      if (box.height < 1) return
      const height = Math.round(box.height)
      if (height === measured) return
      measured = height
      setCloseLookBand(height)
      options.resized()
    })
  }

  return {
    element: root,
    instruments,
    height: () => measured,
    show(next) {
      const language = options.lang()
      // a page turned inside the same work keeps an open drawer open: the
      // reader asked to read, and the next side's words take the same place
      const keep = next.id === view?.id && !drawer.hidden
      if (next.id !== view?.id) ran = false
      view = next
      root.lang = language
      stepBack.textContent = ''
      stepBack.append(icon(STEP_BACK), document.createTextNode(next.room))
      nameRow.textContent = ''
      nameRow.append(deskMark(next.certainty ?? 'reconstructed'), title, clock, count)
      title.textContent = next.title
      title.lang = language
      clock.textContent = ''
      clock.hidden = true
      const place = next.set
        ? say(WORD.place()).replace('{n}', String(next.set.at)).replace('{total}', String(next.set.of))
        : ''
      count.textContent = place
      count.hidden = !place
      line.textContent = next.line ?? ''
      line.hidden = !next.line
      line.lang = language
      // THE MODULE'S OWN SENTENCES GO BEHIND ONE WORD. At rest the band says
      // the name and the line; everything the module wrote about the work is
      // one press away, which is what keeps the label a label.
      drawerWords.replaceChildren(...next.words)
      const held = keep && drawerWords.childElementCount > 0
      drawer.hidden = !held
      if (held) root.dataset['drawer'] = 'open'
      else delete root.dataset['drawer']
      scroll.scrollTop = 0
      scroll.setAttribute('aria-label', next.title)
      paintMore()
      more.setAttribute('aria-disabled', String(!drawerWords.childElementCount))
      foot.textContent = ''
      foot.append(more)
      if (next.record) foot.append(next.record)
      drawerName.textContent = ''
      drawerName.append(deskMark(next.certainty ?? 'reconstructed'), drawerTitle, drawerCount)
      drawerTitle.textContent = next.title
      drawerCount.textContent = place
      drawerCount.hidden = !place
      paintWays()
      paintFade()
      measure()
    },
    step(at, of) {
      // THE CLOCK COUNTS THE STEP, because a machine's time is its steps and
      // a visitor reads which one he is looking at, never a second hand.
      const said = of > 0 && at >= 0
        ? say(WORD.step()).replace('{n}', String(at + 1)).replace('{total}', String(of))
        : ''
      clock.textContent = said
      clock.hidden = !said
      // the run has begun once the clock has left its first step: before that
      // the gold control still asks for the run
      if (at > 0 && view?.kind === 'machine' && !ran) { ran = true; paintWays() }
    },
    clear() {
      view = null
      ran = false
      measured = 0
      drawer.hidden = true
      delete root.dataset['drawer']
      delete drawer.dataset['more']
      drawerWords.textContent = ''
      foot.textContent = ''
      setCloseLookBand(null)
    },
    measure,
    key(event) {
      if (event.key === 'Escape' && !drawer.hidden) { openDrawer(false); return true }
      const target = event.target instanceof Element ? event.target : null
      if (target?.closest('button,a,input,select,textarea,[role="button"]')) return false
      // THE ARROWS BELONG TO THE SET HERE, which is why the drawer has no key
      // of its own in a close look and opens by its word alone.
      // SPACE IS THE GOLD CONTROL, here as at a station: one meaning everywhere.
      if (event.key === ' ' || event.key === 'Spacebar') { on.click(); return true }
      return false
    },
    dispose() {
      sized.disconnect()
      setCloseLookBand(null)
      root.remove()
    },
  }
}
