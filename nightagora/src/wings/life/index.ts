/** THE LIFE VIEW OF A WING: one life read as three parallel facets, places,
 * works and people, with the years the record cannot fill left visible.
 *
 * Four rules live here.
 *
 * · A PERIOD IS NOT A LIST OF EVERYTHING. A boundary carries about four new
 *   things, so a closed band shows its name, its one line and four dates, and
 *   opening it shows all of them.
 * · AN EMPTY STRETCH IS DRAWN AND COUNTED. Years the record never reaches
 *   shrink to one mark that says how many they are, and the mark stands in
 *   the reading as well as on the plate.
 * · THE AFTERLIFE IS NOT A PERIOD OF A LIFE. What happened to the papers
 *   after the death is drawn apart, after a break.
 * · THE LADDER HAS AN HONEST BOTTOM RUNG. A date the floor cuts offers the
 *   walk to it; a date it does not carry says so.
 *
 * It owns one history entry, so a visitor's Back dismisses the view and
 * nothing else, and it owns no words about a wing: the through line, the
 * bands, the people and the sentence about the wing's own floor come in
 * through the record.
 */

import css from './life.css?inline'
import { renderLifeCard } from './card'
import { drawLifePlate } from './plate'
import { dateYears, lifeCounts, lifeScale, workYears, type LifeGap } from './scale'
import { LIFE_BAND_WORDS, LIFE_COUNTS, LIFE_ROW_WORDS, LIFE_WORDS, capitalise, countedCertainties, fill, spokenCount } from './words'
import { LIFE_ROWS, type Bi, type LifeBand, type LifeEvent, type LifeRecord, type LifeRow } from './types'

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
  const second = make('p', 'wing-life-second')
  head.append(through, second)
  const body = make('div', 'wing-life-body')
  const drawing = make('div', 'wing-life-drawing')
  const tabs = make('div', 'wing-life-tabs')
  const reading = make('div', 'wing-life-reading')
  const card = make('div', 'wing-life-card')
  card.hidden = true
  body.append(drawing, tabs, reading, card)
  const foot = make('div', 'wing-life-foot')
  const counts = make('div', 'wing-life-counts')
  const close = make('button', 'wing-life-close')
  close.type = 'button'
  close.addEventListener('click', () => shut())
  foot.append(counts, close)
  dialog.append(style, head, body, foot)
  host.append(dialog)

  let live = true, open = false, marked = false, popping = false
  let row: LifeRow = 'places'
  /** the bands a visitor has opened, kept while the sheet stands */
  const opened = new Set<string>()
  /** ONE QUESTION A VISIT, before the first band a visitor opens. */
  let asked = false, asking: string | null = null
  let at: string | null = null

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
    dialog.setAttribute('aria-label', say(record.words.throughLine))
    through.textContent = say(record.words.throughLine)
    second.textContent = say(record.words.secondLine)
    close.textContent = say(LIFE_WORDS.close)

    const area = Math.max(240, body.getBoundingClientRect().width - (narrow ? LIFE_NARROW.padding : LIFE_WIDE.padding) * 2)
    const plate = drawLifePlate({ record, scale, area: { width: area, height: 0 }, rows: narrow ? [row] : LIFE_ROWS })
    drawing.replaceChildren(plate.element)

    /* ONE ROW AT A TIME ON A PHONE, three at once on a wide stage: the
       controls are what the narrow sheet is held by, so they stand only
       where they do something. */
    tabs.replaceChildren()
    tabs.hidden = !narrow
    if (narrow) for (const name of LIFE_ROWS) {
      const control = make('button', 'wing-life-tab', rowWord(record, name, language))
      control.type = 'button'
      control.setAttribute('aria-pressed', String(name === row))
      control.addEventListener('click', () => { row = name; paint() })
      tabs.append(control)
    }

    reading.replaceChildren()
    for (const name of LIFE_ROWS) {
      const section = make('section', 'wing-life-section')
      section.dataset['row'] = name
      section.hidden = narrow && name !== row
      section.append(make('h3', 'wing-life-row-name', rowWord(record, name, language)))
      if (name === 'places') paintBands(section, record, scale.gaps, language)
      if (name === 'works') paintWorks(section, record, language)
      if (name === 'people') paintPeople(section, record, language)
      reading.append(section)
    }

    /* THE ABSENCES STAND BESIDE WHAT IS SHOWN, counted from the record and
       never written down beside it. On a narrow stage they read at the end of
       the list instead of standing pinned: four sentences at the foot took a
       third of the sheet from the reading itself. */
    if (narrow) reading.append(counts)
    else if (counts.parentElement !== foot) foot.prepend(counts)
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
    if (at) openCard(at)
  }

  /** Two rows are named by the museum and the middle one by the wing, in the
   * word its own register uses for what stands there. */
  function rowWord(record: LifeRecord, name: LifeRow, language: 'en' | 'de'): string {
    return name === 'works' ? record.words.worksRow[language] : LIFE_ROW_WORDS[name][language]
  }

  function paintBands(section: HTMLElement, record: LifeRecord, gaps: readonly LifeGap[], language: 'en' | 'de'): void {
    const list = make('ol', 'wing-life-bands')
    for (const band of record.bands) {
      const item = make('li', 'wing-life-band')
      if (band.afterlife) item.dataset['afterlife'] = 'true'
      const events = record.events.filter(event => event.band === band.id)
      const wide = opened.has(band.id)
      const name = make('button', 'wing-life-band-name')
      name.type = 'button'
      name.setAttribute('aria-expanded', String(wide))
      const dot = make('span', 'wing-life-dot')
      dot.style.background = record.sure[band.certainty]?.colour ?? ''
      dot.setAttribute('aria-hidden', 'true')
      name.append(dot, make('span', 'wing-life-band-title', band.name[language]),
        make('span', 'wing-life-band-sure', record.sure[band.certainty]?.word[language] ?? ''))
      name.addEventListener('click', () => expand(band))
      item.append(name, make('p', 'wing-life-band-line', band.line[language]))
      if (asking === band.id) item.append(question(band))
      else {
        const shown = wide ? events : events.filter(event => band.first.includes(event.id))
        item.append(dates(record, shown, band, gaps, language))
        if (events.length > shown.length) {
          const more = make('button', 'wing-life-more',
            capitalise(fill(LIFE_BAND_WORDS.more[language], { n: spokenCount(events.length - shown.length, language) })))
          more.type = 'button'
          more.setAttribute('aria-expanded', 'false')
          more.addEventListener('click', () => expand(band))
          item.append(more)
        } else if (wide && events.length > band.first.length) {
          const fewer = make('button', 'wing-life-more', LIFE_BAND_WORDS.fewer[language])
          fewer.type = 'button'
          fewer.setAttribute('aria-expanded', 'true')
          fewer.addEventListener('click', () => { opened.delete(band.id); paint() })
          item.append(fewer)
        }
      }
      list.append(item)
    }
    section.append(list)
  }

  /** The dates of one band in the record's own order, with the empty
   * stretches that fall inside it standing where they fall. */
  function dates(record: LifeRecord, events: readonly LifeEvent[], band: LifeBand, gaps: readonly LifeGap[], language: 'en' | 'de'): HTMLElement {
    const list = make('ol', 'wing-life-dates')
    const years = events.map(event => dateYears(event.date))
    const first = years.filter(Boolean).map(span => span!.from)
    const inside = band.afterlife || !first.length
      ? []
      : gaps.filter(gap => gap.to >= Math.min(...first) && gap.from <= Math.max(...first))
    let seen = 0
    for (const [index, event] of events.entries()) {
      const year = years[index]?.from ?? null
      while (seen < inside.length && year !== null && inside[seen]!.to < year) {
        list.append(gapNote(inside[seen]!, language))
        seen++
      }
      const item = make('li', 'wing-life-date')
      const press = make('button', 'wing-life-date-name')
      press.type = 'button'
      press.dataset['event'] = event.id
      const dot = make('span', 'wing-life-dot')
      dot.style.background = record.sure[event.certainty]?.colour ?? ''
      dot.setAttribute('aria-hidden', 'true')
      const time = make('time', 'wing-life-date-label', event.date.label[language])
      if (event.date.earliest) time.dateTime = event.date.earliest
      time.dataset['edtf'] = event.date.edtf
      press.append(dot, time, make('span', 'wing-life-date-line', event.line[language]))
      press.addEventListener('click', () => openCard(event.id))
      item.append(press)
      list.append(item)
    }
    for (; seen < inside.length; seen++) list.append(gapNote(inside[seen]!, language))
    return list
  }

  function gapNote(gap: LifeGap, language: 'en' | 'de'): HTMLElement {
    const item = make('li', 'wing-life-gap-note')
    item.append(make('p', 'wing-life-gap-line', capitalise(fill(LIFE_COUNTS.gap[language], { years: spokenCount(gap.years, language) }))))
    return item
  }

  function paintWorks(section: HTMLElement, record: LifeRecord, language: 'en' | 'de'): void {
    const dated = record.works.filter(work => workYears(work, record.span))
      .sort((a, b) => (workYears(a, record.span)!.from - workYears(b, record.span)!.from))
    const list = make('ol', 'wing-life-works')
    for (const work of dated) {
      const item = make('li', 'wing-life-work-item')
      item.dataset['domain'] = work.domain
      item.append(make('span', 'wing-life-work-date', work.date!.label[language]),
        make('span', 'wing-life-work-title', work.title[language]))
      list.append(item)
    }
    section.append(list)
    const undated = record.works.filter(work => !workYears(work, record.span))
    if (!undated.length) return
    /* A WORK WITH NO DATE IS NOT PLACED AT A GUESS: it stands at the foot,
       under the words for what it is missing. */
    section.append(make('h4', 'wing-life-undated', LIFE_WORDS.undated[language]))
    const rest = make('ul', 'wing-life-works')
    for (const work of undated) {
      const item = make('li', 'wing-life-work-item')
      item.dataset['domain'] = work.domain
      item.append(make('span', 'wing-life-work-title', work.title[language]))
      rest.append(item)
    }
    section.append(rest)
  }

  function paintPeople(section: HTMLElement, record: LifeRecord, language: 'en' | 'de'): void {
    const list = make('ul', 'wing-life-people')
    for (const person of record.people) {
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
  }

  /** THE ONE QUESTION, at the first boundary a visitor opens. One tap either
   * way and the band opens; nothing is counted and it is never asked again. */
  function question(band: LifeBand): HTMLElement {
    const language = options.lang()
    const box = make('div', 'wing-life-ask')
    box.append(make('p', 'wing-life-ask-line', LIFE_WORDS.ask[language]))
    const row_ = make('div', 'wing-life-ask-row')
    for (const word of [LIFE_WORDS.askShow, LIFE_WORDS.askSkip]) {
      const control = make('button', 'wing-life-ask-control', word[language])
      control.type = 'button'
      control.addEventListener('click', () => { asking = null; opened.add(band.id); paint() })
      row_.append(control)
    }
    box.append(row_, make('p', 'wing-life-ask-note', LIFE_WORDS.askNote[language]))
    return box
  }

  function expand(band: LifeBand): void {
    if (opened.has(band.id)) { opened.delete(band.id); paint(); return }
    if (!asked) { asked = true; asking = band.id; paint(); return }
    opened.add(band.id)
    paint()
  }

  function openCard(id: string): void {
    const record = options.record()
    const event = record.events.find(entry => entry.id === id)
    if (!event) { at = null; card.hidden = true; return }
    at = id
    renderLifeCard({
      host: card, record, event, language: options.lang(),
      walk: target => {
        const stud = target.walk && 'stud' in target.walk ? target.walk.stud : null
        if (stud) press(() => options.walk(stud))
      },
      close: () => {
        at = null
        card.hidden = true
        dialog.querySelector<HTMLElement>(`[data-event="${id}"]`)?.focus({ preventScroll: true })
      },
    })
  }

  function shut(): void {
    if (!open) return
    open = false
    at = null
    card.hidden = true
    asking = null
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
      if (!live || open) return
      open = true
      dialog.dataset['narrow'] = String(options.narrow())
      if (!dialog.open) dialog.showModal()
      mark()
      const event = from ? options.record().events.find(entry => entry.id === from) : undefined
      if (event) { opened.add(event.band); row = 'places' }
      at = event?.id ?? null
      layout()
      reading.scrollTop = 0
      const landing = event
        ? dialog.querySelector<HTMLElement>(`[data-event="${event.id}"]`)
        : dialog.querySelector<HTMLElement>('.wing-life-band-name')
      landing?.focus({ preventScroll: true })
      landing?.scrollIntoView({ block: 'nearest' })
    },
    close: shut,
    toggle() { if (open) shut(); else this.show() },
    held: () => open,
    dispose() {
      live = false
      open = false
      marked = false
      leaving.abort()
      if (dialog.open) dialog.close()
      dialog.remove()
    },
  }
}
