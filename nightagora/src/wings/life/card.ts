/** ONE YEAR OF A LIFE, opened from the view: the record's own sentence, the
 * date as the record writes it, the age it falls at, how sure it is, and
 * where it comes from.
 *
 * The bottom rung is the honest one. A date the floor carries offers the walk
 * to it; a date it does not carry says so in the wing's own words instead of
 * offering a door that would open somewhere else.
 */

import { LIFE_WORDS, fill } from './words'
import type { LifeEvent, LifeRecord } from './types'

export interface LifeCardHost {
  host: HTMLElement
  record: LifeRecord
  event: LifeEvent
  language: 'en' | 'de'
  /** offered only where the event carries a stud the floor cuts */
  walk(event: LifeEvent): void
  close(): void
}

export function renderLifeCard(options: LifeCardHost): void {
  const { host, record, event, language } = options
  const document_ = host.ownerDocument
  const make = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, words = ''): HTMLElementTagNameMap[K] => {
    const element = document_.createElement(tag)
    element.className = cls
    if (words) element.textContent = words
    return element
  }
  host.replaceChildren()
  host.hidden = false

  const head = make('div', 'wing-life-card-head')
  const time = make('time', 'wing-life-card-date', event.date.label[language])
  if (event.date.earliest) time.dateTime = event.date.earliest
  time.dataset['edtf'] = event.date.edtf
  head.append(time)
  if (event.age !== null) {
    const words = record.words.age
    const age = fill((event.ageApproximate ? words.about : words.exact)[language], { years: event.age })
    head.append(make('span', 'wing-life-card-age', age))
  }
  const sure = record.sure[event.certainty]
  const word = make('span', 'wing-life-card-sure', sure.word[language])
  word.style.setProperty('--certainty', sure.colour)
  head.append(word)
  host.append(head, make('p', 'wing-life-card-line', event.line[language]))

  if (event.source) {
    const source = make('p', 'wing-life-card-source', event.source[language])
    // The reading of where a sentence comes from is the record's own voice.
    source.dataset['register'] = 'drawer'
    host.append(source)
  }

  const foot = make('div', 'wing-life-card-foot')
  if (event.walk && 'stud' in event.walk) {
    const walk = make('button', 'wing-life-card-walk', LIFE_WORDS.walk[language])
    walk.type = 'button'
    walk.addEventListener('click', () => options.walk(event))
    foot.append(walk)
  } else foot.append(make('p', 'wing-life-card-elsewhere', record.words.notCut[language]))
  const close = make('button', 'wing-life-card-close', record.words.back[language])
  close.type = 'button'
  close.addEventListener('click', () => options.close())
  foot.append(close)
  host.append(foot)
}
