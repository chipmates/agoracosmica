/** ONE DATE OF A LIFE, unfolded where it stands: the record's own sentence,
 * the date as the record writes it, the age it falls at, how sure it is, and
 * the door to where it comes from.
 *
 * It is written into the body under its own heading and never into a card
 * that floats away from it, which is the reader's own grammar and the one a
 * visitor already met at the floor.
 *
 * The bottom rung is the honest one. A date the floor carries offers the walk
 * to it; a date it does not carry says so in the wing's own words instead of
 * offering a door that would open somewhere else.
 */

import { LIFE_WORDS, fill } from './words'
import type { LifeEvent, LifeRecord } from './types'

export interface LifeDateHost {
  host: HTMLElement
  record: LifeRecord
  event: LifeEvent
  language: 'en' | 'de'
  /** offered only where the event carries a stud the floor cuts */
  walk(event: LifeEvent): void
  /** the record layer behind "Where it comes from", where the wing holds one */
  open?(event: LifeEvent, back: () => void): void
}

export function renderLifeDate(options: LifeDateHost): void {
  const { host, record, event, language } = options
  const document_ = host.ownerDocument
  const make = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, words = ''): HTMLElementTagNameMap[K] => {
    const element = document_.createElement(tag)
    element.className = cls
    if (words) element.textContent = words
    return element
  }
  host.replaceChildren()

  const head = make('div', 'wing-life-date-head')
  if (event.age !== null) {
    const words = record.words.age
    head.append(make('span', 'wing-life-date-age',
      fill((event.ageApproximate ? words.about : words.exact)[language], { years: event.age })))
  }
  const sure = record.sure[event.certainty]
  if (sure) {
    const word = make('span', 'wing-life-date-sure', sure.word[language])
    word.style.setProperty('--certainty', sure.colour)
    head.append(word)
  }
  if (head.childElementCount) host.append(head)
  host.append(make('p', 'wing-life-date-line', event.line[language]))

  if (event.source) {
    const source = make('p', 'wing-life-date-source', event.source[language])
    // The reading of where a sentence comes from is the record's own voice.
    source.dataset['register'] = 'drawer'
    host.append(source)
  }

  const foot = make('div', 'wing-life-date-foot')
  if (event.walk && 'stud' in event.walk) {
    const walk = make('button', 'wing-life-date-walk', LIFE_WORDS.walk[language])
    walk.type = 'button'
    walk.addEventListener('click', () => options.walk(event))
    foot.append(walk)
  } else foot.append(make('p', 'wing-life-date-elsewhere', record.words.notCut[language]))
  if (options.open && record.words.provenance) {
    const door = make('button', 'wing-life-date-record', record.words.provenance[language])
    door.type = 'button'
    door.addEventListener('click', () => options.open?.(event, () => door.focus({ preventScroll: true })))
    foot.append(door)
  }
  host.append(foot)
}
