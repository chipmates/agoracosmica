/** ONE DATE OF A LIFE, unfolded where it stands: the record's own sentence,
 * the date as the record writes it, the age it falls at, how sure it is, and
 * the door to where it comes from.
 *
 * It is written into the body under its own heading and never into a card
 * that floats away from it, which is the reader's own grammar and the one a
 * visitor already met at the floor.
 *
 * The bottom rung is the honest one. A date this wing's own floor carries
 * says so in the wing's words; a date it does not carry says nothing extra,
 * because the count at the foot of the view already says how many are cut.
 */

import { LIFE_WORDS, fill } from './words'
import type { LifeEvent, LifeRecord } from './types'

export interface LifeDateHost {
  host: HTMLElement
  record: LifeRecord
  event: LifeEvent
  language: 'en' | 'de'
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

  /* The age and the event's certainty stand on the heading above. What the
     body adds is the date's own doubt, where it is not the event's. */
  const head = make('div', 'wing-life-date-head')
  const dateSure = record.sure[event.date.certainty]
  if (event.date.certainty !== event.certainty && dateSure) {
    const word = make('span', 'wing-life-date-doubt', fill(LIFE_WORDS.dateSure[language], { word: dateSure.word[language] }))
    word.style.setProperty('--certainty', dateSure.colour)
    head.append(word)
  }
  if (event.date.disputed) head.append(make('span', 'wing-life-date-doubt', LIFE_WORDS.disputed[language]))
  if (head.childElementCount) host.append(head)
  host.append(make('p', 'wing-life-date-line', event.line[language]))
  // Who set the year, or the style it is counted in, travels with the date.
  if (event.date.note) host.append(make('p', 'wing-life-date-note', event.date.note[language]))

  if (event.source) {
    const source = make('p', 'wing-life-date-source', event.source[language])
    // The reading of where a sentence comes from is the record's own voice.
    source.dataset['register'] = 'drawer'
    host.append(source)
  }

  const foot = make('div', 'wing-life-date-foot')
  // THE VISITOR IS STANDING ON THE FLOOR THAT CARRIES IT, so this is a mark
  // and not a door: there is nowhere to be walked to.
  if (event.walk && 'stud' in event.walk)
    foot.append(make('p', 'wing-life-date-cut', record.words.cut[language]))
  if (options.open && record.words.provenance) {
    const door = make('button', 'wing-life-date-record', record.words.provenance[language])
    door.type = 'button'
    door.addEventListener('click', () => options.open?.(event, () => door.focus({ preventScroll: true })))
    foot.append(door)
  }
  host.append(foot)
}
