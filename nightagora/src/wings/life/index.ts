/** THE LIFE VIEW OF A WING: one life, read one place at a time.
 *
 * Four rules live here.
 *
 * · ONE PERIOD IS OPEN. The ribbon segment and the item in the spine are one
 *   control, and what stands beside them is everything the record holds about
 *   that one place: its dates, its works, the people it names.
 * · A DATE IS A HEADING, AND ONE OF THEM IS UNFOLDED. Every date of the open
 *   period is shown; the one being read carries its sentence, its age, how
 *   sure it is and the door to where it comes from.
 * · AN EMPTY STRETCH IS DRAWN AND COUNTED. Years the record never reaches
 *   interrupt the ribbon and stand in the reading where they fall.
 * · THE AFTERLIFE IS NOT A PERIOD OF A LIFE. What happened to the papers
 *   after the death is drawn apart, on its own clock.
 *
 * It owns one history entry, so a visitor's Back dismisses the view and
 * nothing else, and it owns no words about a wing: the through line, the
 * bands, the people and the sentence about the wing's own floor come in
 * through the record.
 */

import css from './life.css?inline'
import { windowOwnsTheScreen } from '../window-chrome'
import { renderLifeDate } from './card'
import { drawLifePlate, type LifePlate } from './plate'
import { dateYears, lifeCounts, lifeScale, workYears, type LifeGap } from './scale'
import { LIFE_BAND_WORDS, LIFE_COUNTS, LIFE_ROW_WORDS, LIFE_WORDS, LIFE_WORKS_COUNT, capitalise, countedCertainties, fill, spokenCount } from './words'
import type { Bi, LifeBand, LifeEvent, LifeRecord, LifeWork } from './types'

export type { LifeBand, LifeCounts, LifeEvent, LifePerson, LifeRecord, LifeWork, LifeWingWords, MuseumDate, Sure } from './types'
export { LIFE_WORDS } from './words'

const HISTORY_MARK = 'wingLife'
/** The one item of the spine that is not a period of a life. */
const UNDATED = '#without-a-year'

export const LIFE_WIDE = { top: 76, side: 28, bottom: 18, padding: 20, widest: 1080 } as const
/** THE SHEET OWNS THE SCREEN ON THE PHONE: the chrome under it stands down,
 * so the sheet is bounded by the viewport and not by the bar. */
export const LIFE_NARROW = { top: 10, side: 8, bottom: 10, padding: 12 } as const

export interface WingLifeOptions {
  host: HTMLElement
  lang(): 'en' | 'de'
  narrow(): boolean
  /** the top edge of the wing's bar: the sheet stands clear of it */
  floor(): number
  /** the life, read fresh on every open */
  record(): LifeRecord
  /** walk to one exhibit of the wing and open it where it stands: a date the
   * floor cuts, or a work that hangs on a wall */
  walk(exhibit: string): void
  /** where the hand goes when the sheet closes */
  returnFocus(): void
  /** the wing's own record layer for one date, with the way back to the door */
  openRecord?(event: LifeEvent, back: () => void): void
  /** True when an exhibit already pushed the entry this sheet should take. */
  adopt?(): boolean
}

export interface WingLife {
  readonly standing: boolean
  element: HTMLDialogElement
  /** opened at one date, the way a reader standing at it climbs back up */
  show(at?: string): void
  close(): void
  toggle(): void
  /** True while nothing may draw: the canvas holds its last frame. */
  held(): boolean
  dispose(): void
}

export function createWingLife(options: WingLifeOptions): WingLife {
  const { host } = options
  const document_ = host.ownerDocument
  const view = document_.defaultView!
  const make = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, words = ''): HTMLElementTagNameMap[K] => {
    const element = document_.createElement(tag)
    element.className = cls
    if (words) element.textContent = words
    return element
  }
  const say = (value: Bi): string => value[options.lang()]

  const dialog = document_.createElement('dialog')
  dialog.className = 'wing-life'
  dialog.id = 'wing-life'
  const style = make('style', '')
  style.textContent = css
  const head = make('div', 'wing-life-head')
  const through = make('h2', 'wing-life-through')
  head.append(through)
  const body = make('div', 'wing-life-body')
  const drawing = make('div', 'wing-life-drawing')
  const presses = make('div', 'wing-life-presses')
  drawing.append(presses)
  const second = make('p', 'wing-life-second')
  const caption = make('p', 'wing-life-caption')
  const reading = make('div', 'wing-life-reading')
  const spine = make('ol', 'wing-life-spine')
  /** ONE BODY, MOVED: on a wide stage it stands beside the spine, on a narrow
   * one inside the open item, and keeping one element is what lets the unfold
   * of a date animate instead of being built again. */
  const periodBody = make('div', 'wing-life-period-body')
  periodBody.id = 'wing-life-period'
  reading.append(spine, periodBody)
  body.append(drawing, second, caption, reading)
  const foot = make('div', 'wing-life-foot')
  const counts = make('div', 'wing-life-counts')
  const close = make('button', 'wing-life-close')
  close.type = 'button'
  close.addEventListener('click', () => shut())
  foot.append(counts, close)
  /** ONE MARK DISMISSES THE SHEET where the foot's row has stood down: the
   * close look's grammar, at the corner the thumb reaches. */
  const shutMark = make('button', 'wing-life-shut', '\u2715')
  shutMark.type = 'button'
  shutMark.addEventListener('click', () => shut())
  const live = make('p', 'wing-life-live')
  live.setAttribute('aria-live', 'polite')
  dialog.append(style, head, body, foot, shutMark, live)
  host.append(dialog)

  let alive = true, open = false, marked = false, popping = false
  let plate: LifePlate | undefined
  /** THE HEAD IS FOLDED while the reading is scrolled off its top. */
  let folded = false
  const noMotion = view.matchMedia('(prefers-reduced-motion: reduce)')
  /** the one period that is open, and the one date unfolded inside it */
  let band: string | null = null, at: string | null = null
  /** ONE QUESTION A VISIT, at the foot of the period being read. */
  let asked = false, asking = false

  function mark(): void {
    const state = { ...(view.history.state as object | null ?? {}), [HISTORY_MARK]: 1 }
    if (options.adopt?.()) view.history.replaceState(state, '')
    else view.history.pushState(state, '')
    marked = true
  }
  function unmark(): void {
    if (!marked) return
    marked = false
    popping = true
    view.history.back()
  }

  function layout(): void {
    if (!open) return
    const width = view.innerWidth, height = view.innerHeight
    const narrow = options.narrow()
    const floor = Math.min(height, Math.max(0, options.floor()))
    dialog.dataset['narrow'] = String(narrow)
    /* THE SHEET OWNS THE SCREEN ON THE PHONE. The chrome under it stands
       down, so the bar is no longer what bounds the sheet and the reading
       takes the height a pinned foot and a hidden bar were holding. */
    windowOwnsTheScreen(document_, narrow)
    const numbers = narrow ? LIFE_NARROW : LIFE_WIDE
    const top = numbers.top, bottom = Math.max(top + 220, (narrow ? height : floor) - numbers.bottom)
    const left = narrow ? numbers.side : Math.max(numbers.side, Math.round((width - LIFE_WIDE.widest) / 2))
    Object.assign(dialog.style, {
      left: `${left}px`, top: `${top}px`,
      width: `${Math.max(280, width - left * 2)}px`, height: `${bottom - top}px`,
    })
    paint()
    foldTheHead()
  }

  /** The whole sheet, painted on every open and every resize: a language or a
   * viewport that changed while it stood is answered by the next paint. */
  function paint(): void {
    const language = options.lang()
    const narrow = options.narrow()
    const record = options.record()
    const scale = lifeScale(record.events, record.span)
    const tally = lifeCounts(record.events, record.works, record.span)
    if (!band || !(band === UNDATED || record.bands.some(entry => entry.id === band))) band = firstBand(record)
    dialog.setAttribute('aria-label', say(record.words.throughLine))
    through.textContent = say(record.words.throughLine)
    second.textContent = say(record.words.secondLine)
    caption.textContent = LIFE_WORDS.caption[language]
    close.textContent = say(LIFE_WORDS.close)
    shutMark.setAttribute('aria-label', say(LIFE_WORDS.close))
    spine.setAttribute('aria-label', LIFE_ROW_WORDS.places[language])

    /* THE RIBBON, and the presses laid over it. A segment is a 44 px target
       on a wide stage; on a phone the narrowest of them is seventeen pixels,
       so there the drawing is inert and the spine takes every press. */
    const area = Math.max(240, body.getBoundingClientRect().width - (narrow ? LIFE_NARROW.padding : LIFE_WIDE.padding) * 2)
    const drawn = record.events.some(event => dateYears(event.date))
    plate = drawn
      ? drawLifePlate({ record, scale, area: { width: area }, language, narrow, open: band, at,
        afterWord: LIFE_WORDS.after[language] })
      : undefined
    presses.replaceChildren()
    drawing.replaceChildren(...(plate ? [plate.element] : []), presses)
    drawing.hidden = !plate
    /* WHAT THE FOLDED RIBBON KEEPS: the strip with the hour's ring over it and
       the marker that stands on it. The ticks, the afterlife and its years are
       what the fold gives to the reading. */
    if (plate) {
      drawing.style.setProperty('--life-full', `${Math.round(plate.height)}px`)
      drawing.style.setProperty('--life-fold', `${Math.round(plate.strip.top + plate.strip.height + 4)}px`)
    } else {
      drawing.style.removeProperty('--life-full')
      drawing.style.removeProperty('--life-fold')
    }
    caption.hidden = !plate || !scale.gaps.length
    if (plate && !narrow) for (const segment of plate.bands) {
      const press = make('button', 'wing-life-press')
      press.type = 'button'
      press.dataset['band'] = segment.id
      press.setAttribute('aria-label', segment.name[language])
      press.setAttribute('aria-controls', periodBody.id)
      press.setAttribute('aria-expanded', String(segment.id === band))
      press.tabIndex = segment.id === band ? 0 : -1
      Object.assign(press.style, {
        left: `${segment.left}px`, width: `${Math.max(12, segment.right - segment.left)}px`,
        top: `${segment.top + segment.height / 2 - 22}px`,
      })
      press.addEventListener('click', () => select(segment.id, 'ribbon'))
      press.addEventListener('keydown', event => step(event, record))
      presses.append(press)
    }
    // A RECORD WITH NO YEAR IS NOT DRAWN, and says so where the ribbon
    // would have stood. The list beside it is the whole of that life.
    if (!plate) {
      drawing.hidden = false
      drawing.replaceChildren(make('p', 'wing-life-nothing', LIFE_WORDS.noYears[language]))
    }

    paintSpine(record, language)
    paintPeriod(record, scale.gaps, language)

    /* THE PLACES ARE A ROW OF CHIPS ON THE PHONE, over the reading and not
       inside it: one sideways row of 44 px targets that keeps its place while
       the open place's reading scrolls under it. */
    if (narrow) { if (spine.parentElement !== body) body.insertBefore(spine, reading) }
    else if (spine.parentElement !== reading) reading.insertBefore(spine, periodBody)

    /* ON A PHONE THE COUNTS READ AT THE END OF THE LIST, where a pinned
       ledger of four sentences took a third of the sheet from the reading. */
    if (narrow) reading.append(counts)
    else if (counts.parentElement !== foot) foot.prepend(counts)

    /* THE ABSENCES STAND BESIDE WHAT IS SHOWN, counted from the record and
       never written down beside it. */
    counts.replaceChildren(
      make('p', 'wing-life-count', capitalise(fill(LIFE_COUNTS.dates[language], {
        total: spokenCount(tally.events.total, language),
        counted: countedCertainties(record.sure, tally.events.by, language),
      }))),

      make('p', 'wing-life-honesty', say(record.words.honesty)),
    )
    /* A FAMILY THE RECORD HOLDS NONE OF IS NOT COUNTED. A life with no work
       in its register says nothing about works rather than counting none. */
    if (tally.works.total) counts.insertBefore(make('p', 'wing-life-count', capitalise(fill(record.words.worksCount[language], {
      total: spokenCount(tally.works.total, language),
      dated: spokenCount(tally.works.dated, language),
      undated: spokenCount(tally.works.undated, language),
    }))), counts.lastElementChild)
    /* THE EMPTY YEARS ARE COUNTED ONLY WHERE THERE ARE YEARS. A record whose
       dates cannot be put on one says that instead, where the ribbon would
       have stood, and counting its silence in years would be a claim. */
    // A count is a word and a year is a numeral, in the same sentence.
    if (drawn) counts.insertBefore(make('p', 'wing-life-count', capitalise(fill(LIFE_COUNTS.emptyYears[language], {
      empty: spokenCount(tally.emptyYears, language),
      span: spokenCount(record.span.to - record.span.from + 1, language),
      from: record.span.from, to: record.span.to,
      longest: spokenCount(tally.longestGapYears, language),
    }))), counts.lastElementChild)
  }

  /** THE VIEW OPENS ON THE HOUR THE WING STANDS IN: the museum's premise is
   * that the visitor is standing on one documented afternoon, and a view that
   * opens there says so without a word. A life whose record names no such
   * hour opens at its first period. */
  function firstBand(record: LifeRecord): string | null {
    const here = record.here ? record.events.find(event => event.id === record.here) : undefined
    return here?.band ?? record.bands[0]?.id ?? null
  }

  function bandOf(record: LifeRecord, id: string | null): LifeBand | undefined {
    return record.bands.find(entry => entry.id === id)
  }

  function eventsOf(record: LifeRecord, id: string | null): LifeEvent[] {
    return record.events.filter(event => event.band === id)
  }

  /** THE SPINE: the seven places, always all of them, each with what it
   * holds. It is the navigation, so nothing in it is ever folded away. */
  function paintSpine(record: LifeRecord, language: 'en' | 'de'): void {
    const narrow = options.narrow()
    spine.replaceChildren()
    for (const entry of record.bands) {
      const item = make('li', 'wing-life-item')
      item.dataset['band'] = entry.id
      if (entry.afterlife) item.dataset['afterlife'] = 'true'
      const press = make('button', 'wing-life-item-name')
      press.type = 'button'
      press.dataset['band'] = entry.id
      press.setAttribute('aria-expanded', String(entry.id === band))
      press.setAttribute('aria-controls', periodBody.id)
      /* ONE STOP FOR THE SEVEN PLACES. The spine is the navigation, so it
         takes a single tab stop and the arrows walk inside it; otherwise the
         hand crosses seven controls to reach the reading. */
      press.tabIndex = entry.id === band ? 0 : -1
      if (entry.id === band) press.setAttribute('aria-current', 'true')
      /* A CHIP CARRIES THE PLACE AND NOT THE YEARS: the row holds eight of
         them on one line, the years stand on the ribbon over it and in the
         reading's own heading. The afterlife is not a place, so it takes the
         word the ribbon's strip already carries. */
      const title = make('span', 'wing-life-item-title',
        narrow ? (entry.afterlife ? LIFE_WORDS.after[language] : entry.place[language]) : entry.name[language])
      press.append(title, make('span', 'wing-life-item-count', dateCount(eventsOf(record, entry.id).length, language)))
      press.addEventListener('click', () => select(entry.id, 'spine'))
      press.addEventListener('keydown', event => step(event, record))
      item.append(press)
      spine.append(item)
    }
    /* THE EIGHTH ITEM, where the register has works no year can hold. It is
       not a period of a life, so it stands after the afterlife and carries no
       dates, no people and no question. */
    if (undatedWorks(record).length) spine.append(undatedItem(record, language))
  }

  /** The works the record cannot put on any year of this life. */
  function undatedWorks(record: LifeRecord): LifeWork[] {
    return record.works.filter(work => !workYears(work, record.span))
  }

  function undatedItem(record: LifeRecord, language: 'en' | 'de'): HTMLElement {
    const item = make('li', 'wing-life-item')
    item.dataset['band'] = UNDATED
    item.dataset['undated'] = 'true'
    const press = make('button', 'wing-life-item-name')
    press.type = 'button'
    press.dataset['band'] = UNDATED
    press.setAttribute('aria-expanded', String(band === UNDATED))
    press.setAttribute('aria-controls', periodBody.id)
    press.tabIndex = band === UNDATED ? 0 : -1
    if (band === UNDATED) press.setAttribute('aria-current', 'true')
    // The row's own word for what it carries is the wing's; English lowercases
    // a noun inside a sentence and German does not.
    const row = record.words.worksRow[language]
    press.append(make('span', 'wing-life-item-title', LIFE_WORDS.undated[language]),
      make('span', 'wing-life-item-count', capitalise(fill(LIFE_WORDS.undatedCount[language], {
        n: spokenCount(undatedWorks(record).length, language),
        row: language === 'en' ? row.toLowerCase() : row,
      }))))
    press.addEventListener('click', () => select(UNDATED, 'spine'))
    press.addEventListener('keydown', event => step(event, record))
    item.append(press)
    return item
  }

  function dateCount(n: number, language: 'en' | 'de'): string {
    if (!n) return LIFE_BAND_WORDS.noDate[language]
    if (n === 1) return LIFE_BAND_WORDS.oneDate[language]
    return capitalise(fill(LIFE_BAND_WORDS.dates[language], { n: spokenCount(n, language) }))
  }

  /** The place the question's own answer leads to, where there is one. */
  function nextBand(record: LifeRecord): LifeBand | undefined {
    const index = record.bands.findIndex(entry => entry.id === band)
    return index >= 0 ? record.bands[index + 1] : undefined
  }

  /** THE OPEN PERIOD: its dates, one of them unfolded, what was made in those
   * years, and who the record names in them. */
  function paintPeriod(record: LifeRecord, gaps: readonly LifeGap[], language: 'en' | 'de'): void {
    const entry = bandOf(record, band)
    periodBody.replaceChildren()
    if (!entry && band !== UNDATED) return
    /* THE READING STANDS UNDER THE PLACES ON BOTH STAGES: the phone's
       accordion is a chip row now, so the body is never inside an item. */
    if (periodBody.parentElement !== reading) reading.append(periodBody)
    /* THE WORKS NO YEAR CAN HOLD stand on their own, with no dates to read
       and nobody named in years the record does not give them. */
    if (!entry) {
      periodBody.append(make('h3', 'wing-life-period-name', LIFE_WORDS.undated[language]))
      paintWorkList(record, undatedWorks(record), language, false)
      return
    }
    periodBody.append(make('h3', 'wing-life-period-name', entry.name[language]),
      make('p', 'wing-life-period-line', entry.line[language]))
    const own = eventsOf(record, entry.id)
    periodBody.append(dates(record, own, entry, gaps, language))
    const stops = [...periodBody.querySelectorAll<HTMLElement>('.wing-life-date-name')]
    if (stops.length && !stops.some(stop => stop.tabIndex === 0)) stops[0]!.tabIndex = 0
    paintWorks(record, entry, language)
    paintPeople(record, own, language)
    if (asking && nextBand(record)) periodBody.append(question(record, language))
  }

  /** The dates of one period in the record's own order, with the empty
   * stretches that fall inside it standing where they fall. */
  function dates(record: LifeRecord, events: readonly LifeEvent[], entry: LifeBand, gaps: readonly LifeGap[], language: 'en' | 'de'): HTMLElement {
    const list = make('ol', 'wing-life-dates')
    const years = events.map(event => dateYears(event.date))
    const first = years.filter(Boolean).map(span => span!.from)
    const inside = entry.afterlife || !first.length
      ? []
      : gaps.filter(gap => gap.to >= Math.min(...first) && gap.from <= Math.max(...first))
    let seen = 0
    for (const [index, event] of events.entries()) {
      const year = years[index]?.from ?? null
      while (seen < inside.length && year !== null && inside[seen]!.to < year) {
        list.append(gapNote(inside[seen]!, language))
        seen++
      }
      list.append(dateItem(record, event, language))
    }
    for (; seen < inside.length; seen++) list.append(gapNote(inside[seen]!, language))
    return list
  }

  function dateItem(record: LifeRecord, event: LifeEvent, language: 'en' | 'de'): HTMLElement {
    const item = make('li', 'wing-life-date')
    const press = make('button', 'wing-life-date-name')
    press.type = 'button'
    press.dataset['event'] = event.id
    press.setAttribute('aria-expanded', String(event.id === at))
    const dot = make('span', 'wing-life-dot')
    dot.style.background = record.sure[event.certainty]?.colour ?? ''
    dot.setAttribute('aria-hidden', 'true')
    const time = make('time', 'wing-life-date-label', event.date.label[language])
    if (event.date.earliest) time.dateTime = event.date.earliest
    time.dataset['edtf'] = event.date.edtf
    press.append(dot, time)
    // THE HOUR THE VISITOR IS STANDING IN is one of these dates, and the wing
    // says so in its own words beside it.
    if (record.here === event.id && record.words.hour)
      press.append(make('span', 'wing-life-date-here', record.words.hour[language]))
    /* ONE STOP FOR THE WHOLE LIST. Fourteen dates would be fourteen tab
       stops between the spine and the foot, so the list takes one and the
       arrows walk inside it. */
    press.tabIndex = event.id === at ? 0 : -1
    press.addEventListener('click', () => unfold(event.id === at ? null : event.id))
    press.addEventListener('keydown', event_ => stepDate(event_))
    press.addEventListener('focus', () => rove(press))
    const holder = make('div', 'wing-life-date-body')
    holder.dataset['open'] = String(event.id === at)
    const inner = make('div', 'wing-life-date-inner')
    holder.append(inner)
    if (event.id === at) fillDate(record, event, inner, language)
    item.append(press, holder)
    if (event.id === at) item.setAttribute('aria-current', 'true')
    return item
  }

  /** The hand is on one date of the list, so that date is the list's stop. */
  function rove(press: HTMLElement): void {
    for (const other of [...periodBody.querySelectorAll<HTMLElement>('.wing-life-date-name')])
      other.tabIndex = other === press ? 0 : -1
  }

  function fillDate(record: LifeRecord, event: LifeEvent, inner: HTMLElement, language: 'en' | 'de'): void {
    renderLifeDate({
      host: inner, record, event, language,
      walk: target => {
        const stud = target.walk && 'stud' in target.walk ? target.walk.stud : null
        if (stud) press(() => options.walk(stud))
      },
      ...(options.openRecord ? { open: (target: LifeEvent, back: () => void) => options.openRecord?.(target, back) } : {}),
    })
  }

  function gapNote(gap: LifeGap, language: 'en' | 'de'): HTMLElement {
    const item = make('li', 'wing-life-gap-note')
    item.append(make('p', 'wing-life-gap-line', capitalise(fill(LIFE_COUNTS.gap[language], { years: spokenCount(gap.years, language) }))))
    return item
  }

  /** The works the record puts inside the years of this period. A work with
   * no year the record can hold stands in no period and is counted at the
   * foot, never placed here at a guess. */
  function worksOf(record: LifeRecord, entry: LifeBand): LifeWork[] {
    return record.works.filter(work => {
      const span = workYears(work, record.span)
      return span ? span.from <= entry.years.to && span.to >= entry.years.from : false
    }).sort((a, b) => (workYears(a, record.span)!.from - workYears(b, record.span)!.from))
  }

  function paintWorks(record: LifeRecord, entry: LifeBand, language: 'en' | 'de'): void {
    paintWorkList(record, worksOf(record, entry), language, true)
  }

  /** The works of one item, each with the door to the wall it hangs on, and
   * the line that says how many of them this wing holds. */
  function paintWorkList(record: LifeRecord, own: readonly LifeWork[], language: 'en' | 'de', counted: boolean): void {
    const section = make('section', 'wing-life-section')
    section.dataset['row'] = 'works'
    if (counted) section.append(make('h4', 'wing-life-row-name', record.words.worksRow[language]))
    if (!own.length) {
      section.append(make('p', 'wing-life-empty', record.words.worksEmpty[language]))
      periodBody.append(section)
      return
    }
    const list = make('ol', 'wing-life-works')
    for (const work of own) {
      const item = make('li', 'wing-life-work-item')
      item.dataset['domain'] = work.domain
      item.append(make('span', 'wing-life-work-date', work.date?.label[language] ?? ''),
        make('span', 'wing-life-work-title', work.title[language]))
      /* THE PICTURE IS REACHED FROM THE LIFE: the sheet closes and the museum
         walks to the wall it hangs on, which is where it can be looked at. */
      if (work.exhibit) {
        const door = make('button', 'wing-life-work-door', LIFE_WORDS.wall[language])
        door.type = 'button'
        const exhibit = work.exhibit
        door.addEventListener('click', () => press(() => options.walk(exhibit)))
        item.append(door)
      }
      list.append(item)
    }
    section.append(list)
    const shown = own.filter(work => work.exhibit).length
    const words = shown === 0 ? LIFE_WORKS_COUNT.none : shown === 1 ? LIFE_WORKS_COUNT.one : LIFE_WORKS_COUNT.some
    section.append(make('p', 'wing-life-work-count', capitalise(fill(words[language], {
      shown: spokenCount(shown, language), total: spokenCount(own.length, language),
    }))))
    periodBody.append(section)
  }

  function paintPeople(record: LifeRecord, own: readonly LifeEvent[], language: 'en' | 'de'): void {
    const here = new Set(own.map(event => event.id))
    const people = record.people.filter(person => person.events.some(id => here.has(id)))
    const section = make('section', 'wing-life-section')
    section.dataset['row'] = 'people'
    section.append(make('h4', 'wing-life-row-name', LIFE_ROW_WORDS.people[language]))
    if (!people.length) {
      section.append(make('p', 'wing-life-empty', LIFE_WORDS.noPeople[language]))
      periodBody.append(section)
      return
    }
    const list = make('ul', 'wing-life-people')
    for (const person of people) {
      const item = make('li', 'wing-life-person')
      const dot = make('span', 'wing-life-dot')
      dot.style.background = record.sure[person.certainty]?.colour ?? ''
      dot.setAttribute('aria-hidden', 'true')
      item.append(dot, make('span', 'wing-life-person-name', person.name[language]),
        make('span', 'wing-life-person-role', person.role[language]),
        make('span', 'wing-life-person-sure', record.sure[person.certainty]?.word[language] ?? ''))
      list.append(item)
    }
    section.append(list)
    periodBody.append(section)
  }

  /** THE ONE QUESTION, at the foot of the period being read. The answer is
   * the place that came next, and showing it is going there: nothing in the
   * spine is ever hidden to make the question work, because a nameless item
   * reads as a fault and not as a veil. Nothing is counted, and it is never
   * asked again. */
  function question(record: LifeRecord, language: 'en' | 'de'): HTMLElement {
    const box = make('div', 'wing-life-ask')
    box.append(make('p', 'wing-life-ask-line', LIFE_WORDS.ask[language]))
    const row = make('div', 'wing-life-ask-row')
    const next = nextBand(record)
    for (const [index, word] of [LIFE_WORDS.askShow, LIFE_WORDS.askSkip].entries()) {
      const control = make('button', 'wing-life-ask-control', word[language])
      control.type = 'button'
      control.addEventListener('click', () => {
        asking = false
        box.remove()
        if (index === 0 && next) select(next.id, 'spine')
      })
      row.append(control)
    }
    box.append(row, make('p', 'wing-life-ask-note', LIFE_WORDS.askNote[language]))
    return box
  }

  /** A PERIOD IS OPENED, and nothing else is rebuilt: the ribbon keeps its
   * drawing and changes which segment is lit, so the fill and the marker are
   * the only things that move. */
  function select(id: string, from: 'ribbon' | 'spine'): void {
    const record = options.record()
    if (id !== UNDATED && !bandOf(record, id)) return
    band = id
    at = null
    if (!asked) { asked = true; asking = true }
    for (const segment of [...(plate?.element.querySelectorAll<SVGElement>('.wing-life-segment') ?? [])])
      segment.dataset['open'] = String(segment.dataset['band'] === id)
    for (const press of [...presses.querySelectorAll<HTMLElement>('.wing-life-press')])
      press.setAttribute('aria-expanded', String(press.dataset['band'] === id))
    moveMarker(null)
    paintSpine(record, options.lang())
    paintPeriod(record, lifeScale(record.events, record.span).gaps, options.lang())
    const entry = bandOf(record, id)
    if (entry) announce(`${entry.name[options.lang()]}. ${dateCount(eventsOf(record, id).length, options.lang())}`)
    else if (id === UNDATED) announce(LIFE_WORDS.undated[options.lang()])
    if (from === 'spine') spine.querySelector<HTMLElement>(`[data-band="${id}"] .wing-life-item-name`)?.focus({ preventScroll: true })
    if (from === 'ribbon') presses.querySelector<HTMLElement>(`[data-band="${id}"]`)?.focus({ preventScroll: true })
    periodBody.scrollTop = 0
    /* A NEW PLACE IS READ FROM ITS OWN TOP, which is also where the head
       stands whole again. Only the chip row moves sideways. */
    showTheChip(id)
    if (options.narrow()) { reading.scrollTop = 0; foldTheHead() }
  }

  /** ONE DATE IS UNFOLDED WHERE IT STANDS. The body is built into the element
   * that is already there, so the unfold is a transition and not a rebuild. */
  function unfold(id: string | null, focus = true): void {
    const record = options.record()
    const previous = at
    at = id
    for (const item of [...periodBody.querySelectorAll<HTMLElement>('.wing-life-date')]) {
      const press = item.querySelector<HTMLElement>('.wing-life-date-name')
      const holder = item.querySelector<HTMLElement>('.wing-life-date-body')
      const inner = item.querySelector<HTMLElement>('.wing-life-date-inner')
      const mine = press?.dataset['event'] === id
      if (!press || !holder || !inner) continue
      press.setAttribute('aria-expanded', String(mine))
      if (mine) item.setAttribute('aria-current', 'true'); else item.removeAttribute('aria-current')
      if (mine) {
        const event = record.events.find(entry => entry.id === id)
        if (event) fillDate(record, event, inner, options.lang())
        holder.dataset['open'] = 'true'
      } else if (holder.dataset['open'] === 'true') {
        holder.dataset['open'] = 'false'
        inner.replaceChildren()
      }
    }
    moveMarker(id)
    if (id && id !== previous) {
      const event = record.events.find(entry => entry.id === id)
      const sure = event ? record.sure[event.certainty] : undefined
      if (event) announce(`${event.date.label[options.lang()]}. ${sure?.word[options.lang()] ?? ''}`)
      if (focus) periodBody.querySelector<HTMLElement>(`[data-event="${id}"]`)?.focus({ preventScroll: true })
    }
  }

  function moveMarker(id: string | null): void {
    const marker = plate?.element.querySelector<SVGElement>('.wing-life-marker')
    if (!marker) return
    const place = id ? plate?.at(id) ?? null : null
    if (place === null) { marker.setAttribute('opacity', '0'); return }
    marker.setAttribute('opacity', '1')
    marker.setAttribute('transform', `translate(${place.toFixed(1)},0)`)
  }

  function announce(words: string): void { live.textContent = words }

  /** THE HEAD FOLDS AS THE READING IS SCROLLED. The through line and the two
   * captions go, the ribbon keeps its strip with the marker and the hour's
   * ring, and a scroll back to the top brings all of it back. The two
   * thresholds are apart because the fold gives the reading its own height
   * back, and one threshold would cross itself on the way down. */
  function foldTheHead(): void {
    if (!options.narrow()) { folded = false; dialog.dataset['folded'] = 'false'; return }
    // A reading with nothing under the fold would fold and be clamped open
    // again by its own new height.
    const room = reading.scrollHeight - reading.clientHeight
    const next = folded ? reading.scrollTop > 8 : reading.scrollTop > 40 && room > 160
    if (next === folded) return
    folded = next
    dialog.dataset['folded'] = String(folded)
  }

  /** The open chip is brought into its own row and nothing else moves: the
   * reading under it keeps the scroll the finger left it at. */
  function showTheChip(id: string): void {
    if (!options.narrow()) return
    const chip = spine.querySelector<HTMLElement>(`[data-band="${id}"] .wing-life-item-name`)
    if (!chip) return
    const box = chip.getBoundingClientRect(), row = spine.getBoundingClientRect()
    const left = spine.scrollLeft + (box.left - row.left) - Math.max(0, (row.width - box.width) / 2)
    spine.scrollTo({ left: Math.max(0, left), behavior: noMotion.matches ? 'auto' : 'smooth' })
  }

  /** The arrows step from period to period: left and right on the ribbon,
   * and up and down as well in the spine, which reads downward. */
  function step(event: KeyboardEvent, record: LifeRecord): void {
    const ribbon = (event.currentTarget as HTMLElement).classList.contains('wing-life-press')
    const forward = event.key === 'ArrowRight' || (!ribbon && event.key === 'ArrowDown')
    const back = event.key === 'ArrowLeft' || (!ribbon && event.key === 'ArrowUp')
    if (!forward && !back) return
    const walk = [...record.bands.map(entry => entry.id), ...(undatedWorks(record).length ? [UNDATED] : [])]
    const next = walk[walk.indexOf(band ?? '') + (forward ? 1 : -1)]
    if (!next) return
    event.preventDefault()
    event.stopPropagation()
    select(next, ribbon ? 'ribbon' : 'spine')
  }

  /** Up and down step date to date inside the open period, Home and End to
   * its ends, and the key that opens one is Enter, which a button already is. */
  function stepDate(event: KeyboardEvent): void {
    const keys = ['ArrowUp', 'ArrowDown', 'Home', 'End']
    if (!keys.includes(event.key)) return
    const all = [...periodBody.querySelectorAll<HTMLElement>('.wing-life-date-name')]
    const here = all.indexOf(event.currentTarget as HTMLElement)
    const target = event.key === 'Home' ? all[0]
      : event.key === 'End' ? all[all.length - 1]
        : all[here + (event.key === 'ArrowDown' ? 1 : -1)]
    if (!target) return
    event.preventDefault()
    event.stopPropagation()
    target.focus({ preventScroll: true })
    target.scrollIntoView({ block: 'nearest' })
  }

  function shut(): void {
    if (!open) return
    open = false
    at = null
    asking = false
    windowOwnsTheScreen(document_, false)
    unmark()
    if (dialog.open) dialog.close()
    options.returnFocus()
  }

  /** THE WALK STARTS AFTER THE ENTRY IS GONE. Dismissing the sheet is a
   * history traversal and the frame writes the station into the address as it
   * walks, so a walk begun in the same task would have its address undone by
   * the pop that follows it. */
  function press(run: () => void): void {
    const held = marked
    shut()
    if (!held) { run(); return }
    let done = false
    const go = (): void => {
      if (done) return
      done = true
      view.removeEventListener('popstate', go)
      run()
    }
    view.addEventListener('popstate', go)
    // a traversal that never answers still walks
    view.setTimeout(go, 150)
  }

  const leaving = new AbortController()
  reading.addEventListener('scroll', () => foldTheHead(), { passive: true, signal: leaving.signal })
  view.addEventListener('popstate', () => {
    if (popping) { popping = false; return }
    if (!open) return
    marked = false
    shut()
  }, { signal: leaving.signal })
  view.addEventListener('resize', () => layout(), { signal: leaving.signal })
  // Escape is one step back and not a cancel: the life is a place to look at.
  dialog.addEventListener('cancel', event => { event.preventDefault(); shut() })
  dialog.addEventListener('keydown', event => {
    if (event.key.toLowerCase() !== 'e' || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return
    const target = event.target as Element | null
    if (target?.closest('input,textarea,select,[contenteditable="true"]')) return
    event.preventDefault()
    shut()
  })

  return {
    get standing() { return open },
    element: dialog,
    show(from) {
      if (!alive || open) return
      open = true
      dialog.dataset['narrow'] = String(options.narrow())
      if (!dialog.open) dialog.showModal()
      mark()
      const record = options.record()
      const event = from ? record.events.find(entry => entry.id === from) : undefined
      band = event?.band ?? firstBand(record)
      at = event?.id ?? null
      folded = false
      dialog.dataset['folded'] = 'false'
      layout()
      spine.scrollTop = 0
      spine.scrollLeft = 0
      periodBody.scrollTop = 0
      reading.scrollTop = 0
      if (at) unfold(at, false)
      const landing = at
        ? periodBody.querySelector<HTMLElement>(`[data-event="${at}"]`)
        : spine.querySelector<HTMLElement>('.wing-life-item-name[aria-current="true"]') ?? spine.querySelector<HTMLElement>('.wing-life-item-name')
      landing?.focus({ preventScroll: true })
      landing?.scrollIntoView({ block: 'nearest' })
      // after the landing, which would otherwise leave the chip at an edge
      if (band) showTheChip(band)
    },
    close: shut,
    toggle() { if (open) shut(); else this.show() },
    held: () => open,
    dispose() {
      alive = false
      open = false
      marked = false
      windowOwnsTheScreen(document_, false)
      leaving.abort()
      if (dialog.open) dialog.close()
      dialog.remove()
    },
  }
}
