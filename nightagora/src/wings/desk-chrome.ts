/* THE DESKTOP'S WORDS AND WAYS. Two steps of the frozen design, each behind
   its own switch and each able to stand without the other.

   THE WORDS stand on one margin in the lower left: the name row with the
   certainty mark, the chapter title, the age clock and the chapter count,
   then the line, then the two worded controls. THE WAYS stand in the lower
   right: the way back, and one gold control that always means go on and
   names the chapter it goes to. Both hang from one foot line, and neither
   ever moves.

   Nothing here knows da Vinci. The host hands the standing station, the one
   after it in the order the rail walks, and the words of both. */

import { deskOn } from './desk-switches'
import { setDeskBand } from './desk-stage'
import { deskControl, deskCutBetween, deskStoryStop } from './desk-story'
import { setRegister } from './frame'
import { LOBBY_TEXT } from '../content/lobby'
import type { VinciCertainty, VinciText } from './vinci/content'

import { createDeskPanel } from './desk-panel'

// desk.marks: its imports stand here, and nowhere else in this list

// desk.overview: its imports stand here, and nowhere else in this list
import { createDeskOverview, type DeskOverview, type DeskOverviewCell } from './overview'

// desk.sheet: its imports stand here, and nowhere else in this list

// desk.opening: its imports stand here, and nowhere else in this list

export interface DeskStation {
  id: string
  /** the station's place in the order the rail walks today, from zero */
  index: number
  /** how many the rail walks today */
  count: number
}

export interface DeskChromeHost {
  /** the wing's own stage: the band hangs in it and takes no pointer */
  stage: HTMLElement
  /** `#wing`, where the switches and the walking attribute are written */
  wing: HTMLElement
  lang: () => 'en' | 'de'
  standing: () => DeskStation
  /** the station the way on leads to, or null at the end of the walk */
  next: () => DeskStation | null
  /** every stop the walk takes, by id, in the order it takes them */
  order: () => readonly string[]
  /** the stops of this visit the walker has stood at, as the plan reads them */
  stood: () => readonly string[]
  /** a stop the story layer does not carry falls back to the wing's name */
  name: (id: string) => VinciText
  /** the frame's own way out of the museum, which the words' foot row takes
      in while the bar stands down */
  door: () => HTMLElement | null
  /** the wing's own way to what a station rests on, which the drawer's foot
      takes in until the one sheet replaces it */
  sources: () => HTMLElement | null
  /** the question this station's door carries, as the frame wrote it */
  question: () => string
  /** the words of the controls the frame and the wing already carry */
  words: {
    next: VinciText
    back: VinciText
    /** the name the frame gives the walk itself */
    rail: VinciText
  }
  go: (index: number) => void
  /** how much of the leg under way is walked, 0 to 1, or null at rest */
  leg: () => number | null
  /** a second press on the gold control while a leg runs */
  hurry: () => void

  // desk.panel: the host fields its step needs stand here

  // desk.marks: the host fields its step needs stand here

  // desk.overview: the host fields its step needs stand here
  /** the set the standing station holds, the room's own name, and the one
      press that walks to a work of it. A station with no set hands none. */
  overview?: {
    cells: () => readonly DeskOverviewCell[]
    open: (id: string) => void
    room: () => string
    measure?: () => VinciText | null
    name?: () => VinciText | null
    columns?: () => number | null
    absent?: () => { heading: string; items: readonly { title: string; reason: string }[] } | null
  }

  // desk.sheet: the host fields its step needs stand here

  // desk.opening: the host fields its step needs stand here
}

export interface DeskChrome {
  /** The first pixel down the screen the chrome owns: where a panel that used
      to stop above the bar now stops. Null while neither step stands. */
  floor(): number | null
  /** The boxes the words hold, for the layer that places the marks: no mark
      of either kind may stand under the words or under the drawer. */
  panels(): { left: number; top: number; right: number; bottom: number }[]
  /** the station changed, or the language did */
  paint(): void
  /** one frame: the counted ring and nothing else */
  update(): void
  /** True when the key was the ways'. */
  key(event: KeyboardEvent): boolean
  dispose(): void
}

/* EVERY DISPLAYED WORD OF THIS CHROME IS THE CARD DATA'S, by key. Nothing
   here is written, and a word that changes changes in one file. */
const WORD = {
  more: () => deskControl('shared', 'read_more'),
  tell: () => deskControl('visit', 'tell_the_story'),
  end: () => deskControl('walk', 'the_end'),
  walking: () => deskControl('walk', 'walking'),
  faster: () => deskControl('walk', 'walk_faster'),
}

const SVG = 'http://www.w3.org/2000/svg'

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

const ARROW_ON = 'M3 8h10M9 4l4 4-4 4'
const ARROW_BACK = 'M13 8H3M7 4L3 8l4 4'
const PLAY = 'M5 3l8 5-8 5z'

/* SHAPE CARRIES THE CLASS, so the mark survives a grey print and a colour
   blind eye, and the colour reinforces it: a full disc, a half disc, an open
   ring, a broken ring. The four colours are the wing's own. */
export function deskMark(certainty: VinciCertainty): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg')
  svg.setAttribute('viewBox', '0 0 18 18')
  svg.setAttribute('class', 'desk-mark')
  svg.dataset['certainty'] = certainty
  svg.setAttribute('aria-hidden', 'true')
  const ring = document.createElementNS(SVG, 'circle')
  ring.setAttribute('cx', '9')
  ring.setAttribute('cy', '9')
  if (certainty === 'documented') {
    ring.setAttribute('r', '6.2')
    ring.setAttribute('class', 'desk-mark-full')
  } else if (certainty === 'reconstructed') {
    ring.setAttribute('r', '6.2')
    ring.setAttribute('class', 'desk-mark-ring')
    const half = document.createElementNS(SVG, 'path')
    half.setAttribute('d', 'M9 2.8a6.2 6.2 0 0 0 0 12.4z')
    half.setAttribute('class', 'desk-mark-half')
    svg.append(ring, half)
    return svg
  } else {
    ring.setAttribute('r', '5.8')
    ring.setAttribute('class', certainty === 'unknown' ? 'desk-mark-broken' : 'desk-mark-open')
  }
  svg.append(ring)
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

/** the whole circumference of the counted ring, in user units */
const RING = 2 * Math.PI * 20.5

/* THE FIRST OF THE THREE REMEDIES, station by station. The words never move
   to clear a subject; where the wide measure covers one and the narrow one
   does not, the station takes the narrow measure and keeps the same margin
   and the same foot line. This list is the machine's, not a judgement:
   `forge/free-area.mjs` names every station it holds and every station it
   cannot clear, which is the rail seat's list to re-aim. */
const NARROW_STATIONS: readonly string[] = ['works']

/* THE THREAD IS NOT MOUNTED. A row of unlabelled dashes is a sign where this
   museum uses words, and the count in the name row already says where the
   visitor stands. The part stands built and unused: where the visitor jumps
   from will be the plan, the life and the story's index page. */
const DESK_THREAD = false

/* THE GUIDED VISIT IS NOT OFFERED HERE. Its control named itself and refused,
   which reads as a control that does nothing; its way in is the title wall,
   with the step that builds it. The part stands built and unused. */
const DESK_TELL = false

export function createDeskChrome(host: DeskChromeHost): DeskChrome {
  const words = deskOn('words')
  const ways = deskOn('ways')
  /* THE STAGE AND THE LABEL. The picture keeps its own box and the museum
     stands under it on solid night: the band's height is the type's ladder,
     the stage is the window less that height, and nothing of the museum ever
     stands on the picture. */
  const stage = deskOn('stage')
  const say = (value: VinciText): string => value[host.lang()]

  const band = make('div', 'desk-low')
  band.dataset['words'] = String(words)
  band.dataset['ways'] = String(ways)

  /* THE WORDS. One margin, one measure, hung from the foot line. */
  const cap = make('div', 'desk-cap')
  const nameRow = make('div', 'desk-name')
  const chapter = make('span', 'desk-chapter')
  const clock = make('span', 'desk-clock')
  const count = make('span', 'desk-count')
  const line = make('p', 'desk-line')
  const foot = make('div', 'desk-foot')
  const more = make('button', 'desk-word-control desk-more')
  more.type = 'button'
  const tell = make('button', 'desk-word-control desk-tell')
  tell.type = 'button'
  /* THE TWO WAYS DEEPER FROM A STATION stand in their place from this step
     on, and answer from their own steps: the drawer is desk.drawer and the
     guided visit is desk.opening. Until then each names itself and refuses. */
  tell.setAttribute('aria-disabled', 'true')
  tell.addEventListener('click', event => event.preventDefault())
  if (!deskOn('drawer')) {
    more.setAttribute('aria-disabled', 'true')
    more.addEventListener('click', event => event.preventDefault())
  } else {
    more.setAttribute('aria-controls', 'desk-drawer-words')
    more.setAttribute('aria-expanded', 'false')
    more.addEventListener('click', () => {
      if (more.getAttribute('aria-disabled') === 'true') return
      openDrawer(plate.hidden)
    })
  }
  cap.append(nameRow, line, foot)

  /* THE WAYS. One gold control, the way back beside it, neither ever moves. */
  const waysRow = make('div', 'desk-ways')
  const back = make('button', 'desk-back')
  back.type = 'button'
  back.append(icon(ARROW_BACK))
  const on = make('button', 'desk-on')
  on.type = 'button'
  const onWords = make('span', 'desk-on-words')
  const onKicker = make('span', 'desk-on-kicker')
  const onTitle = make('span', 'desk-on-title')
  onWords.append(onKicker, onTitle)
  const onArrow = make('span', 'desk-on-arrow')
  const ring = document.createElementNS(SVG, 'svg')
  ring.setAttribute('viewBox', '0 0 44 44')
  ring.setAttribute('class', 'desk-on-ring')
  ring.setAttribute('aria-hidden', 'true')
  const ringLine = document.createElementNS(SVG, 'circle')
  ringLine.setAttribute('cx', '22')
  ringLine.setAttribute('cy', '22')
  ringLine.setAttribute('r', '20.5')
  ring.append(ringLine)
  onArrow.append(ring, icon(ARROW_ON))
  on.append(onWords, onArrow)
  waysRow.append(back, on)

  /* THE THREAD. One segment a stop, in the order the walk takes them: the
     quiet stops short, the chapter cuts as uprights, the count in digits for
     a visitor who does not point. A segment is a 44 px target that names its
     own stop, on the pointer and on focus alike, and a press walks there. */
  const thread = make('nav', 'desk-thread')
  thread.hidden = !ways || !DESK_THREAD
  const threadCount = make('span', 'desk-thread-count')
  const chip = make('span', 'desk-chip')
  chip.hidden = true
  /** every segment, by the stop it stands for, in the walk's own order */
  let segments: HTMLButtonElement[] = []

  /** the stop's number, its chapter and its clock, which is the segment's own
      name and the word the pointer brings */
  function segmentName(id: string, place: number): string {
    const stop = deskStoryStop(id)
    const age = stop?.age ? ` · ${say(stop.age)}` : ''
    return `${place} · ${say(titleOf(id))}${age}`
  }

  function buildThread(): void {
    const ids = host.order()
    thread.textContent = ''
    segments = []
    thread.append(threadCount)
    ids.forEach((id, index) => {
      const cut = index > 0 ? deskCutBetween(ids[index - 1]!, id) : null
      if (cut) {
        const upright = make('span', 'desk-cut')
        upright.title = say(cut)
        thread.append(upright)
      }
      const segment = make('button', 'desk-seg')
      segment.type = 'button'
      segment.dataset['stop'] = id
      if (deskStoryStop(id)?.quiet) segment.dataset['quiet'] = 'true'
      segment.append(make('i', 'desk-seg-bar'))
      segment.addEventListener('click', () => host.go(index))
      segment.addEventListener('pointerenter', () => nameSegment(segment))
      segment.addEventListener('pointerleave', () => hideChip())
      segment.addEventListener('focus', () => nameSegment(segment))
      segment.addEventListener('blur', () => hideChip())
      segments.push(segment)
      thread.append(segment)
    })
    thread.append(chip)
  }

  /** the word a pointer brings is the control's own name, and it shows on
      focus too: nothing here lives on a rollover alone */
  function nameSegment(segment: HTMLButtonElement): void {
    chip.textContent = segment.getAttribute('aria-label') ?? ''
    chip.hidden = false
    chip.style.left = `${segment.offsetLeft + segment.offsetWidth / 2}px`
  }
  function hideChip(): void { chip.hidden = true }

  /* THE THREAD IS ONE STOP IN THE TAB ORDER, and the arrows walk inside it:
     sixteen stops in the order would bury the two controls behind it. */
  thread.addEventListener('keydown', event => {
    const at = segments.indexOf(document.activeElement as HTMLButtonElement)
    if (at < 0) return
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    let to = -1
    if (step) to = Math.max(0, Math.min(segments.length - 1, at + step))
    else if (event.key === 'Home') to = 0
    else if (event.key === 'End') to = segments.length - 1
    if (to < 0) return
    event.preventDefault()
    event.stopPropagation()
    segments[to]?.focus()
  })

  if (words) band.append(cap)
  else band.append(make('span', 'desk-nothing'))
  if (ways) band.append(waysRow)
  /* The top dusk goes in first, so the bar and the door block stand on it. */
  const top = make('div', 'desk-top')
  host.stage.append(top, thread, band)

  /* THE WAY OUT OF THE MUSEUM STAYS ONE PRESS AWAY. The bar stands down with
     this step, so the door it carried moves into the words' foot row until
     the drawer's own foot takes it. It is the frame's node, kept whole with
     its word, its address and its plate, and put back where it stood. */
  const doorNode = ways && words ? host.door() : null
  const doorNext = doorNode?.nextElementSibling ?? null
  const doorNest = doorNode?.parentElement ?? null

  /* THE DRAWER: the same margin, the same foot line, one sentence a row, and
     the name row in its own place so the eye keeps the place it read. It is
     the label a visitor reads while looking, so it is capped at a share of
     the stage and never scrolls. */
  const drawer = deskOn('drawer') && words
  const plate = make('div', 'desk-drawer')
  plate.id = 'desk-drawer'
  plate.hidden = true
  // the surface itself takes the hand when it opens, so the next key is the
  // drawer's own and Escape has one layer to step back from
  plate.tabIndex = -1
  const plateName = make('div', 'desk-name desk-drawer-name')
  const plateChapter = make('span', 'desk-chapter')
  const plateClock = make('span', 'desk-clock')
  const plateCount = make('span', 'desk-count')
  const plateWords = make('div', 'desk-drawer-words')
  plateWords.id = 'desk-drawer-words'
  setRegister(plateWords, 'drawer')
  const plateFoot = make('div', 'desk-drawer-foot')
  const plateQuestion = make('p', 'desk-drawer-question')
  /* THE WAY BACK OUT IS A WORD in the drawer's own foot, beside the two side
     paths, and it says which key does the same thing. */
  const plateClose = make('button', 'desk-word-control desk-drawer-close')
  plateClose.type = 'button'
  plate.append(plateName, plateWords, plateFoot)
  /* the wing's own way to the sources keeps its word, its key and its window
     until the one sheet takes them: it is borrowed, not rebuilt. The wing
     builds it a frame or two after this chrome stands, so it is taken at the
     first paint that finds it and not at the first paint. */
  let sourcesNode: HTMLElement | null = null
  let sourcesNext: Element | null = null
  let sourcesNest: HTMLElement | null = null
  function borrowSources(): void {
    if (!drawer || sourcesNode) return
    const node = host.sources()
    if (!node) return
    sourcesNode = node
    sourcesNext = node.nextElementSibling
    sourcesNest = node.parentElement
  }
  if (drawer) band.append(plate)

  plateClose.addEventListener('click', () => openDrawer(false))

  function openDrawer(open: boolean, back: HTMLElement = more): void {
    if (!drawer) return
    const held = plate.contains(document.activeElement)
    plate.hidden = !open
    more.setAttribute('aria-expanded', String(open))
    if (open) host.wing.dataset['drawer'] = 'open'
    else delete host.wing.dataset['drawer']
    // the band grew or folded, so the stage under it changed in the same breath
    measure()
    // Escape steps exactly one surface back, and the hand comes back to the
    // control that opened it
    if (open) plate.focus({ preventScroll: true })
    else if (held) back.focus({ preventScroll: true })
  }

  /* ONE SENTENCE A ROW. German writes a day and a century with a period
     ("2. Mai", "19. Jahrhundert"), so that stop never cuts; an age or a year
     before a stop ends the sentence in either language. */
  function sentences(said: string, language: string): string[] {
    const out: string[] = []
    let start = 0
    for (let i = 0; i < said.length; i++) {
      const mark = said[i]
      if (mark !== '.' && mark !== '!' && mark !== '?') continue
      if (said[i + 1] !== ' ') continue
      if (mark === '.' && language === 'de' && /(?:^|\D)\d{1,2}$/.test(said.slice(start, i))
        && /^ (?:Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember|Jahrhunderts?)(?!\p{L})/u.test(said.slice(i + 1))) continue
      out.push(said.slice(start, i + 1).trim())
      start = i + 1
    }
    const rest = said.slice(start).trim()
    if (rest) out.push(rest)
    return out
  }

  function paintDrawer(): void {
    if (!drawer) return
    borrowSources()
    const at = host.standing()
    const stop = deskStoryStop(at.id)
    const said = stop?.drawer ? say(stop.drawer) : ''
    plateName.textContent = ''
    // the same name row the line carried, so the eye keeps the place it read
    plateName.append(deskMark(stop?.certainty ?? 'reconstructed'), plateChapter, plateClock, plateCount)
    plateChapter.textContent = say(titleOf(at.id))
    plateClock.textContent = stop?.age ? say(stop.age) : ''
    plateClock.hidden = !stop?.age
    plateCount.textContent = `${at.index + 1} / ${at.count}`
    plateWords.textContent = ''
    for (const line of sentences(said, host.lang())) plateWords.append(make('p', '', line))
    plateFoot.textContent = ''
    if (sourcesNode) plateFoot.append(sourcesNode)
    plateQuestion.textContent = host.question()
    plateFoot.append(plateQuestion)
    if (doorNode) plateFoot.append(doorNode)
    plateClose.textContent = ''
    plateClose.append(document.createTextNode(say(LOBBY_TEXT.close)), make('span', 'desk-key', 'Esc'))
    plateFoot.append(plateClose)
    // a stop the story gives no drawer keeps the control, named and inert
    const has = said.length > 0
    more.setAttribute('aria-disabled', String(!has))
    if (has) more.removeAttribute('aria-disabled')
    if (!has) openDrawer(false)
  }

  back.addEventListener('click', () => {
    const at = host.standing()
    if (at.index > 0) host.go(at.index - 1)
  })
  on.addEventListener('click', () => pressOn())

  function pressOn(): void {
    if (host.leg() !== null) { host.hurry(); return }
    const to = host.next()
    if (to) host.go(to.index)
  }

  /** the chapter title of a stop, or the wing's own name where the story
      layer does not carry that stop yet */
  function titleOf(id: string): VinciText {
    return deskStoryStop(id)?.chapter ?? host.name(id)
  }

  function paint(): void {
    const at = host.standing()
    const stop = deskStoryStop(at.id)
    // WHERE THE PICTURE HAS ITS OWN BOX THE FREE AREA IS THAT BOX, so the
    // narrow measure has nothing left to clear and the words keep one measure
    if (!stage && deskOn('freearea') && NARROW_STATIONS.includes(at.id)) host.wing.dataset['measure'] = 'narrow'
    else delete host.wing.dataset['measure']
    // one text at a time: a drawer belongs to the place it was opened in
    openDrawer(false, on)
    if (words) {
      nameRow.textContent = ''
      const sure: VinciCertainty = stop?.certainty ?? 'reconstructed'
      nameRow.append(deskMark(sure), chapter, clock, count)
      chapter.textContent = say(titleOf(at.id))
      const age = stop?.age ?? null
      clock.textContent = age ? say(age) : ''
      clock.hidden = !age
      // THE COUNT COUNTS THE WALK THE WING IS ON, whichever order that is.
      // It is plain text until the story's index page gives it a press.
      count.textContent = `${at.index + 1} / ${at.count}`
      line.textContent = stop ? say(stop.line) : ''
      line.hidden = !stop
      foot.textContent = ''
      more.textContent = ''
      more.append(document.createTextNode(say(WORD.more())), make('span', 'desk-key', '↓'))
      tell.textContent = ''
      tell.append(icon(PLAY), document.createTextNode(say(WORD.tell())))
      foot.append(more)
      if (DESK_TELL) foot.append(tell)
      // the door stands in this row until the drawer's own foot takes it
      if (doorNode && !drawer) foot.append(doorNode)
      paintDrawer()
    }
    if (ways) {
      if (DESK_THREAD) paintThread()
      const to = host.next()
      onKicker.textContent = say(to ? host.words.next : WORD.end())
      onTitle.textContent = to ? say(titleOf(to.id)) : ''
      onTitle.hidden = !to
      on.setAttribute('aria-label', `${onKicker.textContent}${to ? ` · ${onTitle.textContent}` : ''}`)
      on.disabled = !to
      back.setAttribute('aria-label', say(host.words.back))
      back.disabled = at.index === 0
    }
    measure()
  }

  /** the thread against the walk: where the visitor stands, where he has
      stood, and which stops are quiet */
  function paintThread(): void {
    const at = host.standing()
    if (segments.length !== host.order().length) buildThread()
    thread.setAttribute('aria-label', say(host.words.rail))
    threadCount.textContent = `${at.index + 1} / ${at.count}`
    const stood = new Set(host.stood())
    segments.forEach((segment, index) => {
      const id = segment.dataset['stop'] ?? ''
      const here = index === at.index
      segment.dataset['here'] = String(here)
      segment.dataset['stood'] = String(stood.has(id) && !here)
      segment.tabIndex = here ? 0 : -1
      segment.setAttribute('aria-label', segmentName(id, index + 1))
      if (here) segment.setAttribute('aria-current', 'true')
      else segment.removeAttribute('aria-current')
    })
    hideChip()
  }

  /* WHAT THE BAND TAKES AT THE FOOT, published for the parts that stood
     above the bar: the row and the sources window clear the words instead of
     standing under them. */
  function measure(): void {
    if (!words) return
    requestAnimationFrame(() => {
      /* THE BAND'S OWN HEIGHT IS THE STAGE'S PRICE, so it is measured and
         never assumed: a third row of a long language grows the band by one
         row here and the picture gives that row back in the same frame. */
      if (stage) {
        const low = band.getBoundingClientRect()
        if (low.height < 1) return
        setDeskBand(low.height)
        host.wing.style.setProperty('--desk-foot-clear', `${Math.round(low.height)}px`)
        return
      }
      const box = cap.getBoundingClientRect()
      if (box.height < 1) return
      host.wing.style.setProperty('--desk-foot-clear', `${Math.round(innerHeight - box.top)}px`)
    })
  }

  let walked = -1
  function update(): void {
    if (!ways) return
    const share = host.leg()
    const running = share !== null
    if (on.dataset['leg'] !== String(running)) {
      on.dataset['leg'] = String(running)
      // a drawer that stood folds before the first metre
      if (running) openDrawer(false, on)
      /* ONE CONTROL, ONE MEANING: while a leg runs it says where the walker
         is and what a second press does, and the ring is the leg itself. */
      const to = host.next()
      onKicker.textContent = say(running ? WORD.walking() : to ? host.words.next : WORD.end())
      onTitle.textContent = running ? say(WORD.faster()) : to ? say(titleOf(to.id)) : ''
      onTitle.hidden = !running && !to
      on.setAttribute('aria-label', `${onKicker.textContent}${onTitle.hidden ? '' : ` · ${onTitle.textContent}`}`)
    }
    const at = running ? Math.max(0, Math.min(1, share)) : 0
    if (Math.abs(at - walked) < 0.01) return
    walked = at
    ringLine.setAttribute('stroke-dasharray', `${(RING * at).toFixed(1)} ${RING.toFixed(1)}`)
    /* THE THREAD STAYS WHILE A LEG RUNS, and the segment the leg leads to
       fills with it: the walk's own count, never a clock. */
    const here = segments[host.standing().index]
    if (!here) return
    here.dataset['walking'] = String(running)
    here.style.setProperty('--desk-leg', `${(at * 100).toFixed(1)}%`)
  }

  function key(event: KeyboardEvent): boolean {
    /* ONE LAYER BACK, EXACTLY ONE. Escape belongs to the drawer while it
       stands, wherever the hand is; the deeper key opens it. */
    if (drawer && event.key === 'Escape' && !plate.hidden) { openDrawer(false); return true }
    const target = event.target instanceof Element ? event.target : null
    // a control under the hand answers its own key: the browser presses it
    const onControl = Boolean(target?.closest('button,a,[role="button"]'))
    if (drawer && event.key === 'ArrowDown' && plate.hidden
      && more.getAttribute('aria-disabled') !== 'true') { openDrawer(true); return true }
    if (!ways || onControl) return false
    if (event.key === ' ' || event.key === 'Spacebar') { pressOn(); return true }
    return false
  }

  /* THE SEAM. Each step still to land has one hook here and each seat
     fills only its own; a hook stays empty until its step stands. */

  // desk.panel: the instruments control and its sheet
  if (deskOn('panel')) {
    createDeskPanel({
      wing: host.wing,
      band,
      ways: waysRow,
      back,
      on,
      kicker: onKicker,
      title: onTitle,
      arrow: onArrow,
      standing: host.standing,
      next: host.next,
    })
  }


  // desk.marks: the two kinds of mark on the picture
  if (deskOn('marks')) {
    // filled by its own seat, empty until its step stands
  }


  // desk.overview: the whole set as its own view
  if (deskOn('overview')) {
    const set = host.overview
    if (words && set) {
      let overview: DeskOverview | null = createDeskOverview({
        lang: host.lang, cells: set.cells, open: set.open, room: set.room, measure: set.measure,
        name: set.name, columns: set.columns, absent: set.absent, mark: deskMark,
      })
      host.stage.append(overview.element)
      /* THE FOOT ROW IS BUILT AGAIN AT EVERY PAINT, so the one word joins it
         again each time and that row needs to know nothing about this step. */
      const joinFoot = (): void => {
        if (!overview) return
        overview.paint()
        if (foot.lastElementChild !== overview.control) foot.append(overview.control)
      }
      const joining = new MutationObserver(joinFoot)
      joining.observe(foot, { childList: true })
      joinFoot()
      /* THE VIEW GOES WITH THE BAND. The chrome's own dispose is one return
         statement below and belongs to no step, so this one reads the band. */
      const watching = new MutationObserver(() => {
        if (band.isConnected) return
        watching.disconnect()
        joining.disconnect()
        overview?.dispose()
        overview = null
      })
      watching.observe(host.stage, { childList: true })
    }
  }


  // desk.sheet: the one reading sheet
  if (deskOn('sheet')) {
    // filled by its own seat, empty until its step stands
  }


  // desk.opening: the guided visit
  if (deskOn('opening')) {
    // filled by its own seat, empty until its step stands
  }

  return {
    panels: () => {
      // where the band stands under the picture no word of the museum can
      // cover a subject, so there is nothing for the marks to avoid
      if (stage) return []
      if (!words || !deskOn('freearea')) return []
      const out: { left: number; top: number; right: number; bottom: number }[] = []
      for (const node of plate.hidden ? [cap as HTMLElement] : [cap as HTMLElement, plate]) {
        const box = node.getBoundingClientRect()
        if (box.width > 0 && box.height > 0)
          out.push({ left: box.left, top: box.top, right: box.right, bottom: box.bottom })
      }
      return out
    },
    floor: () => {
      const box = band.getBoundingClientRect()
      if (box.height <= 0) return null
      // the band's own top edge is the picture's foot: nothing of the museum
      // stands below it and nothing of the picture above it
      if (stage) return Math.round(box.top)
      // the padding above the words is the dusk, not the words: a panel may
      // stand in it, and stopping at the band's own top would waste it
      return Math.round(box.bottom - box.height + 110)
    },
    paint,
    update,
    key,
    dispose() {
      // the picture takes the whole window back with the band
      setDeskBand(0)
      // the frame's door and the wing's own sources go home before the band
      // that borrowed them is struck
      if (doorNode && doorNest) doorNest.insertBefore(doorNode, doorNext)
      if (sourcesNode && sourcesNest) sourcesNest.insertBefore(sourcesNode, sourcesNext)
      band.remove()
      top.remove()
      thread.remove()
      host.wing.style.removeProperty('--desk-foot-clear')
    },
  }
}
