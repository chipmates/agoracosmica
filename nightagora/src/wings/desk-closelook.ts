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
  /** A WORK WITH A NUMBER ON ITS FRAME is read as a catalogue entry: the
      number before its name, its date in the clock's place, and where the
      original is in the count's place, since the number already says which
      one of the set it is */
  catalogue?: { number: string; date: string; where: string } | null
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
  const numeral = make('span', 'desk-number')
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

  /* THE DRAWER TAKES THE LINE'S PLACE UNDER THE ONE NAME ROW. It holds a few
     short sentences and never scrolls: the band grows by what they need and
     the stage gives it back. A transcription, an edition's credits and the
     chain of sources are a way of reading or the record, never the drawer.
     One name row in every state is one count in every state. */
  const drawer = make('div', 'desk-clb-drawer')
  drawer.id = 'desk-closelook-drawer'
  drawer.hidden = true
  drawer.setAttribute('role', 'region')
  const drawerWords = make('div', 'desk-clb-words')
  setRegister(drawerWords, 'drawer')
  drawer.append(drawerWords)
  cap.append(nameRow, line, drawer)
  left.append(cap, foot)
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
    measure()
    // the hand stays on the word that opened the drawer, which now closes it
    more.focus({ preventScroll: true })
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

  /* THE DRAWER'S WORDS CAN CHANGE WHILE IT STANDS, a page turned in the same
     work, so the band measures itself again whenever they do. */
  const sized = new ResizeObserver(() => { if (!drawer.hidden) measure() })
  sized.observe(drawerWords)

  /** the gold control's two states at a machine, and its one everywhere else */
  function paintWays(): void {
    if (!view) return
    const on_ = view.on as HTMLButtonElement | null
    const running = view.kind === 'machine' && !ran && Boolean(view.run)
    // the set names where the way on leads; a book's own step names it only
    // where it crosses into another volume
    const target = view.onTitle ?? on_?.dataset['title'] ?? ''
    onKicker.textContent = say(running ? WORD.run() : wayOn(view.kind))
    onTitle.textContent = running ? '' : target
    onTitle.hidden = running || !target
    on.disabled = running ? false : !on_ || on_.disabled
    on.setAttribute('aria-label', `${onKicker.textContent}${onTitle.hidden ? '' : ` · ${onTitle.textContent}`}`)
    const back = view.back as HTMLButtonElement | null
    backWay.disabled = !back || back.disabled
    backWay.setAttribute('aria-label', back?.getAttribute('aria-label') ?? '')
  }

  /* the museum's control stands outside the wing, on this band's first row,
     so the band's height is copied where that control can read it */
  function publish(height: number | null): void {
    const style = document.documentElement.style
    if (height === null) style.removeProperty('--desk-clb-h')
    else if (style.getPropertyValue('--desk-clb-h') !== `${height}px`) style.setProperty('--desk-clb-h', `${height}px`)
  }

  function measure(): void {
    requestAnimationFrame(() => {
      const box = root.getBoundingClientRect()
      if (box.height < 1) return
      const height = Math.round(box.height)
      if (height === measured) return
      measured = height
      setCloseLookBand(height)
      publish(height)
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
      const entry = next.catalogue ?? null
      nameRow.append(deskMark(next.certainty ?? 'reconstructed'), ...(entry ? [numeral] : []), title, clock, count)
      nameRow.dataset['catalogue'] = String(Boolean(entry))
      numeral.textContent = entry?.number ?? ''
      title.textContent = next.title
      title.lang = language
      clock.textContent = entry?.date ?? ''
      clock.hidden = !entry?.date
      // A COUNT OF ONE IS NOISE: a work alone in its set carries no count
      const place = next.set && next.set.of > 1
        ? say(WORD.place()).replace('{n}', String(next.set.at)).replace('{total}', String(next.set.of))
        : ''
      count.textContent = entry ? entry.where : place
      count.hidden = !count.textContent
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
      drawer.setAttribute('aria-label', next.title)
      drawer.lang = language
      paintMore()
      more.setAttribute('aria-disabled', String(!drawerWords.childElementCount))
      foot.textContent = ''
      foot.append(more)
      if (next.record) foot.append(next.record)
      paintWays()
      measure()
    },
    step(at, of) {
      // THE CLOCK COUNTS THE STEP, because a machine's time is its steps and
      // a visitor reads which one he is looking at, never a second hand.
      // and a run of one step has nothing to count
      const said = of > 1 && at >= 0
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
      drawerWords.textContent = ''
      foot.textContent = ''
      setCloseLookBand(null)
      publish(null)
    },
    measure,
    key(event) {
      if (event.key === 'Escape' && !drawer.hidden) { openDrawer(false); return true }
      const target = event.target instanceof Element ? event.target : null
      if (target?.closest('button,a,input,select,textarea,[role="button"],[role="region"]')) return false
      // THE ARROWS BELONG TO THE SET HERE, which is why the drawer has no key
      // of its own in a close look and opens by its word alone.
      // SPACE IS THE GOLD CONTROL, here as at a station: one meaning everywhere.
      if (event.key === ' ' || event.key === 'Spacebar') { on.click(); return true }
      return false
    },
    dispose() {
      sized.disconnect()
      setCloseLookBand(null)
      publish(null)
      root.remove()
    },
  }
}
