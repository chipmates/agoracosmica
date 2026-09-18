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
import { renderLifeDate } from './card'
import { drawLifePlate, type LifePlate } from './plate'
import { dateYears, lifeCounts, lifeScale, workYears, type LifeGap } from './scale'
import { LIFE_BAND_WORDS, LIFE_COUNTS, LIFE_ROW_WORDS, LIFE_WORDS, LIFE_WORKS_COUNT, capitalise, countedCertainties, fill, spokenCount } from './words'
import type { Bi, LifeBand, LifeEvent, LifeRecord, LifeWork } from './types'

export type { LifeBand, LifeCounts, LifeEvent, LifePerson, LifeRecord, LifeWork, LifeWingWords, MuseumDate, Sure } from './types'
export { LIFE_WORDS } from './words'

const HISTORY_MARK = 'wingLife'

export const LIFE_WIDE = { top: 76, side: 28, bottom: 18, padding: 20, widest: 1080 } as const
export const LIFE_NARROW = { top: 52, side: 8, bottom: 10, padding: 12 } as const

export interface WingLifeOptions {
  host: HTMLElement
  lang(): 'en' | 'de'
  narrow(): boolean
  /** the top edge of the wing's bar: the sheet stands clear of it */
  floor(): number
  /** the life, read fresh on every open */
  record(): LifeRecord
  /** walk to the date the floor cuts and open it where it is cut */
  walk(stud: string): void
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
  const live = make('p', 'wing-life-live')
  live.setAttribute('aria-live', 'polite')
  dialog.append(style, head, body, foot, live)
  host.append(dialog)

  let alive = true, open = false, marked = false, popping = false
  let plate: LifePlate | undefined
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
    const numbers = narrow ? LIFE_NARROW : LIFE_WIDE
    const top = numbers.top, bottom = Math.max(top + 220, floor - numbers.bottom)
    const left = narrow ? numbers.side : Math.max(numbers.side, Math.round((width - LIFE_WIDE.widest) / 2))
    Object.assign(dialog.style, {
      left: `${left}px`, top: `${top}px`,
      width: `${Math.max(280, width - left * 2)}px`, height: `${bottom - top}px`,
    })
    paint()
  }

  /** The whole sheet, painted on every open and every resize: a language or a
   * viewport that changed while it stood is answered by the next paint. */
  function paint(): void {
    const language = options.lang()
    const narrow = options.narrow()
    const record = options.record()
    const scale = lifeScale(record.events, record.span)
    const tally = lifeCounts(record.events, record.works, record.span)
    if (!band || !record.bands.some(entry => entry.id === band)) band = firstBand(record)
    dialog.setAttribute('aria-label', say(record.words.throughLine))
    through.textContent = say(record.words.throughLine)
    second.textContent = say(record.words.secondLine)
    caption.textContent = LIFE_WORDS.caption[language]
    close.textContent = say(LIFE_WORDS.close)
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
    caption.hidden = !plate || !scale.gaps.length
    if (plate && !narrow) for (const segment of plate.bands) {
      const press = make('button', 'wing-life-press')
      press.type = 'button'
      press.dataset['band'] = segment.id
      press.setAttribute('aria-label', segment.name[language])
      press.setAttribute('aria-controls', periodBody.id)
      press.setAttribute('aria-expanded', String(segment.id === band))
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
      make('p', 'wing-life-count', capitalise(fill(record.words.worksCount[language], {
        total: spokenCount(tally.works.total, language),
        dated: spokenCount(tally.works.dated, language),
        undated: spokenCount(tally.works.undated, language),
      }))),
      // A count is a word and a year is a numeral, in the same sentence.
      make('p', 'wing-life-count', capitalise(fill(LIFE_COUNTS.emptyYears[language], {
        empty: spokenCount(tally.emptyYears, language),
        span: spokenCount(record.span.to - record.span.from + 1, language),
        from: record.span.from, to: record.span.to,
        longest: spokenCount(tally.longestGapYears, language),
      }))),
      make('p', 'wing-life-honesty', say(record.words.honesty)),
    )
  }

  function firstBand(record: LifeRecord): string | null {
    return record.bands[0]?.id ?? null
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
      if (entry.id === band) press.setAttribute('aria-current', 'true')
      const title = make('span', 'wing-life-item-title', entry.name[language])
      press.append(title, make('span', 'wing-life-item-count', dateCount(eventsOf(record, entry.id).length, language)))
      press.addEventListener('click', () => select(entry.id, 'spine'))
      press.addEventListener('keydown', event => step(event, record))
      item.append(press)
      spine.append(item)
    }
    veil(record)
  }

  function dateCount(n: number, language: 'en' | 'de'): string {
    if (!n) return LIFE_BAND_WORDS.noDate[language]
    if (n === 1) return LIFE_BAND_WORDS.oneDate[language]
    return capitalise(fill(LIFE_BAND_WORDS.dates[language], { n: spokenCount(n, language) }))
  }

  /** ONE NAME IS VEILED WHILE THE QUESTION STANDS: the answer to "What came
   * next?" is the next item of the spine, and version one printed it one line
   * under the question. */
  function veil(record: LifeRecord): void {
    const index = record.bands.findIndex(entry => entry.id === band)
    const next = index >= 0 ? record.bands[index + 1] : undefined
    for (const item of [...spine.children]) {
      const title = item.querySelector<HTMLElement>('.wing-life-item-title')
      if (!title) continue
      const hide = asking && next !== undefined && (item as HTMLElement).dataset['band'] === next.id
      title.style.visibility = hide ? 'hidden' : ''
    }
  }

  /** THE OPEN PERIOD: its dates, one of them unfolded, what was made in those
   * years, and who the record names in them. */
  function paintPeriod(record: LifeRecord, gaps: readonly LifeGap[], language: 'en' | 'de'): void {
    const entry = bandOf(record, band)
    periodBody.replaceChildren()
    if (!entry) return
    const narrow = options.narrow()
    const holder = narrow ? spine.querySelector<HTMLElement>(`[data-band="${entry.id}"]`) : reading
    if (holder && periodBody.parentElement !== holder) holder.append(periodBody)
    periodBody.append(make('h3', 'wing-life-period-name', entry.name[language]),
      make('p', 'wing-life-period-line', entry.line[language]))
    const own = eventsOf(record, entry.id)
    periodBody.append(dates(record, own, entry, gaps, language))
    paintWorks(record, entry, language)
    paintPeople(record, own, language)
    if (asking) periodBody.append(question(language))
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
    press.addEventListener('click', () => unfold(event.id === at ? null : event.id))
    press.addEventListener('keydown', event_ => stepDate(event_))
    const holder = make('div', 'wing-life-date-body')
    holder.dataset['open'] = String(event.id === at)
    const inner = make('div', 'wing-life-date-inner')
    holder.append(inner)
    if (event.id === at) fillDate(record, event, inner, language)
    item.append(press, holder)
    if (event.id === at) item.setAttribute('aria-current', 'true')
    return item
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
    const section = make('section', 'wing-life-section')
    section.dataset['row'] = 'works'
    section.append(make('h4', 'wing-life-row-name', record.words.worksRow[language]))
    const own = worksOf(record, entry)
    if (!own.length) {
      section.append(make('p', 'wing-life-empty', LIFE_WORDS.noWorks[language]))
      periodBody.append(section)
      return
    }
    const list = make('ol', 'wing-life-works')
    for (const work of own) {
      const item = make('li', 'wing-life-work-item')
      item.dataset['domain'] = work.domain
      item.append(make('span', 'wing-life-work-date', work.date?.label[language] ?? ''),
        make('span', 'wing-life-work-title', work.title[language]))
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

  /** THE ONE QUESTION, at the foot of the period being read. One tap either
   * way and the next name is unveiled; nothing is counted, and it is never
   * asked again. */
  function question(language: 'en' | 'de'): HTMLElement {
    const box = make('div', 'wing-life-ask')
    box.append(make('p', 'wing-life-ask-line', LIFE_WORDS.ask[language]))
    const row = make('div', 'wing-life-ask-row')
    for (const word of [LIFE_WORDS.askShow, LIFE_WORDS.askSkip]) {
      const control = make('button', 'wing-life-ask-control', word[language])
      control.type = 'button'
      control.addEventListener('click', () => {
        asking = false
        box.remove()
        veil(options.record())
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
    if (!bandOf(record, id)) return
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
    if (from === 'spine') spine.querySelector<HTMLElement>(`[data-band="${id}"] .wing-life-item-name`)?.focus({ preventScroll: true })
    if (from === 'ribbon') presses.querySelector<HTMLElement>(`[data-band="${id}"]`)?.focus({ preventScroll: true })
    periodBody.scrollTop = 0
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

  /** Left and right step from period to period, wherever the hand is. */
  function step(event: KeyboardEvent, record: LifeRecord): void {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    const index = record.bands.findIndex(entry => entry.id === band)
    const next = record.bands[index + (event.key === 'ArrowRight' ? 1 : -1)]
    if (!next) return
    event.preventDefault()
    event.stopPropagation()
    const target = event.currentTarget as HTMLElement
    select(next.id, target.classList.contains('wing-life-press') ? 'ribbon' : 'spine')
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
      layout()
      spine.scrollTop = 0
      periodBody.scrollTop = 0
      if (at) unfold(at, false)
      const landing = at
        ? periodBody.querySelector<HTMLElement>(`[data-event="${at}"]`)
        : spine.querySelector<HTMLElement>('.wing-life-item-name[aria-current="true"]') ?? spine.querySelector<HTMLElement>('.wing-life-item-name')
      landing?.focus({ preventScroll: true })
      landing?.scrollIntoView({ block: 'nearest' })
    },
    close: shut,
    toggle() { if (open) shut(); else this.show() },
    held: () => open,
    dispose() {
      alive = false
      open = false
      marked = false
      leaving.abort()
      if (dialog.open) dialog.close()
      dialog.remove()
    },
  }
}
