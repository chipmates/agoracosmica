/** THE STUD READER: all fifty six dates as one ordered list, opened at the
 * date the visitor walked to.
 *
 * The floor carries twelve of them and is never rebuilt: previous and next
 * step through the whole line as text. Each date is a list item with its own
 * heading, a machine-readable time and a link that opens the wing at it; the
 * viewport shows the date the list stands at, over the held frame. Every word
 * is the record's: the date's own label, its line, its certainty word. */
import type { VitrinePayload, VitrinePayloadHost } from '../../vitrine/types'
import { SOURCE_READINGS } from './bench/visitor-sources'
import { ageAt, studEdtf } from './edtf'
import { CERTAINTY } from './index'
import { LINE_STUDS, type Stud } from './studs'

const SETTLE_FRAMES = 2
const BIRTH = LINE_STUDS.find(stud => stud.id === 'life-01')!
const DEATH = LINE_STUDS.find(stud => stud.id === 'life-41')!

export interface StudReaderPayload extends VitrinePayload {
  /** The date the list stands at. */
  current(): Stud
  /** The record behind "Where it comes from" for that date. */
  renderRecord(host: HTMLElement): void
}

export function createStudReaderPayload(options: {
  start: number
  words: {
    previous: string; next: string
    /** How many of the dates the floor carries, as the card models write it. */
    floor: string
    /** One optional question before a date is shown, where the words exist. */
    whichYear: string | null
    /** The age beside a date, where the words exist. */
    age: ((years: number) => string) | null
  }
  /** The address that opens the wing at one date. */
  link(stud: Stud): string
  standing(): boolean
  /** The list stands at another date: the record follows it. */
  changed(): void
}): StudReaderPayload {
  let host: VitrinePayloadHost | undefined, lang: 'en' | 'de' = 'en'
  let at = Math.max(0, Math.min(LINE_STUDS.length - 1, options.start))
  let settled = 0, held = false, asked = false, veiled = false
  let plate: HTMLElement | undefined, list: HTMLOListElement | undefined
  let previous: HTMLButtonElement | undefined, next: HTMLButtonElement | undefined
  const listening = new AbortController()
  const make = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] => {
    const n = host!.element.ownerDocument.createElement(tag); n.className = cls; if (text !== undefined) n.textContent = text; return n
  }
  const label = (stud: Stud): string => lang === 'de' ? stud.date_label_de : stud.date_label_en
  const certainty = (stud: Stud) => CERTAINTY[stud.certainty as keyof typeof CERTAINTY]

  /** A date as a heading: its own label inside a machine-readable time. */
  function time(stud: Stud): HTMLTimeElement {
    const node = make('time', '', label(stud))
    node.dateTime = stud.date
    node.dataset['edtf'] = studEdtf(stud)
    return node
  }

  function paintPlate(): void {
    if (!host || !plate) return
    const stud = LINE_STUDS[at]!
    plate.textContent = ''
    plate.lang = lang
    const year = make('p', 'vitrine-date-year')
    if (veiled && options.words.whichYear) {
      // THE QUESTION IS ONE TAP, AND THE TAP IS THE ANSWER: nothing is scored.
      const ask = make('button', 'vitrine-control vitrine-date-ask', options.words.whichYear)
      ask.type = 'button'
      ask.addEventListener('click', () => { veiled = false; paint() }, { signal: listening.signal })
      year.append(ask)
    } else year.append(time(stud))
    const word = make('p', 'vitrine-certainty', certainty(stud)[lang])
    word.style.setProperty('--certainty', certainty(stud).colour)
    plate.append(year, word)
    const age = ageAt(stud, BIRTH, DEATH)
    if (age !== null && options.words.age && !veiled) plate.append(make('p', 'vitrine-meta', options.words.age(age)))
    plate.append(make('p', 'vitrine-meta', `${at + 1} / ${LINE_STUDS.length}`))
    host.describe(label(stud))
    host.caption.textContent = veiled ? '' : label(stud)
  }

  function paintList(): void {
    if (!list) return
    for (const [index, item] of [...list.children].entries()) {
      const current = index === at
      if (current) item.setAttribute('aria-current', 'true'); else item.removeAttribute('aria-current')
      item.querySelector<HTMLElement>('.vitrine-date-line')!.hidden = !current
      const heading = item.querySelector<HTMLElement>('time')
      if (heading) heading.style.visibility = current && veiled ? 'hidden' : ''
    }
    list.children[at]?.scrollIntoView({ block: 'nearest' })
    if (previous) previous.disabled = at === 0
    if (next) next.disabled = at === LINE_STUDS.length - 1
  }

  function paint(): void { paintPlate(); paintList() }

  function go(index: number): void {
    const target = Math.max(0, Math.min(LINE_STUDS.length - 1, index))
    if (target === at) return
    at = target
    // One question per visit, before the first date the visitor steps to.
    if (!asked && options.words.whichYear) { asked = true; veiled = true } else veiled = false
    paint()
    options.changed()
  }

  return {
    kind: 'date',
    mount(nextHost) {
      host = nextHost
      lang = nextHost.lang
      plate = make('div', 'vitrine-date')
      nextHost.element.append(plate)
      const aside = nextHost.aside
      // THE ABSENCES ARE COUNTED BESIDE THE DATES: how sure each date is, in the
      // museum's own words, and how many of them the floor carries.
      const tally = (Object.keys(CERTAINTY) as (keyof typeof CERTAINTY)[])
        .map(key => [LINE_STUDS.filter(stud => stud.certainty === key).length, CERTAINTY[key][lang]] as const)
        .filter(([count]) => count > 0).map(([count, word]) => `${count} ${word}`).join(' · ')
      aside.append(make('p', 'vitrine-meta', tally), make('p', 'vitrine-meta', options.words.floor))
      list = make('ol', 'vitrine-dates')
      list.lang = lang
      for (const [index, stud] of LINE_STUDS.entries()) {
        const item = make('li', 'vitrine-dates-item')
        item.dataset['stud'] = stud.id
        const heading = make('h3', 'vitrine-dates-heading')
        const link = make('a', 'vitrine-dates-link')
        link.href = options.link(stud)
        link.append(time(stud))
        const dot = make('span', 'vinci-title-dot')
        dot.style.background = certainty(stud).colour
        dot.setAttribute('aria-hidden', 'true')
        link.prepend(dot)
        // The link is the address of the date; a press inside the reader walks
        // the list to it, and the address stays for a visitor who keeps it.
        link.addEventListener('click', event => { event.preventDefault(); go(index) }, { signal: listening.signal })
        heading.append(link)
        item.append(heading, make('p', 'vitrine-date-line', lang === 'de' ? stud.line_de : stud.line_en))
        list.append(item)
      }
      aside.append(list)
      previous = make('button', 'vitrine-control vitrine-step', '‹')
      previous.type = 'button'
      previous.setAttribute('aria-label', options.words.previous)
      previous.addEventListener('click', () => go(at - 1), { signal: listening.signal })
      next = make('button', 'vitrine-control vitrine-step', '›')
      next.type = 'button'
      next.setAttribute('aria-label', options.words.next)
      next.addEventListener('click', () => go(at + 1), { signal: listening.signal })
      const row = make('div', 'vitrine-reader-row')
      row.append(previous, next)
      nextHost.controls.append(row)
      nextHost.surface('room')
      settled = 0; held = false
      paint()
    },
    update() {
      if (!host || held) return
      if (!options.standing()) { settled = 0; return }
      if (++settled <= SETTLE_FRAMES) return
      host.surface('hold')
      held = true
    },
    layout() {
      if (!host || !held) return
      held = false; settled = 0
      host.surface('room')
    },
    key(event) {
      if (event.key === 'ArrowLeft') { go(at - 1); return true }
      if (event.key === 'ArrowRight') { go(at + 1); return true }
      return false
    },
    current: () => LINE_STUDS[at]!,
    renderRecord(record) {
      const stud = LINE_STUDS[at]!, document = record.ownerDocument
      const full = document.createElement('div')
      full.className = 'vinci-record'
      full.dataset['register'] = 'record'
      const add = (text: string | null | undefined): void => {
        if (!text) return
        const p = document.createElement('p'); p.className = 'vinci-statement'; p.textContent = text; full.append(p)
      }
      add(label(stud))
      add(SOURCE_READINGS[stud.id]?.[lang])
      add(stud.document)
      add(stud.holder)
      add(lang === 'de' ? stud.qualifications_de : stud.qualifications_en)
      for (const gap of stud.gaps) add(gap)
      for (const source of stud.sources) {
        const a = document.createElement('a')
        a.className = 'vinci-picture-source'; a.href = source.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = source.supports
        full.append(a)
      }
      add(stud.licence_line)
      const data = document.createElement('pre')
      data.className = 'vinci-arithmetic'
      data.textContent = JSON.stringify({ edtf: studEdtf(stud), calendar: stud.calendar, date_original: stud.date_original,
        date_alternatives: stud.date_alternatives, document_status: stud.document_status }, null, 1)
      full.append(data)
      record.append(full)
    },
    unmount() {
      listening.abort()
      plate?.remove()
      plate = undefined; list = undefined; previous = undefined; next = undefined
      host = undefined
      held = false
    },
  }
}
