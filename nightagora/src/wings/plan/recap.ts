/** THE RECAP: the exit of a wing, and the only thing the night is kept for.
 *
 * A visitor who has walked a wing has opened a few things and read a sentence
 * under each. The recap is where those come back: the wing's one sentence,
 * then the titles of what was opened, each one giving its line back on a
 * press. Nothing else opens here, nothing scores, and the list never says
 * what was missed, because a museum is not a checklist.
 *
 * It resolves every title and every line at render from the wing's own
 * registers, so the device holds ids and never a sentence.
 */

import { RECAP_WORDS } from './words'
import type { RecapEntry } from './types'

export interface WingRecapOptions {
  lang(): 'en' | 'de'
  narrow(): boolean
  /** the wing's one sentence, the same one the welcome carries */
  throughLine(): string
  /** the ids the night kept, oldest first */
  opened(): readonly string[]
  /** the title and the line of an id, in the page's language */
  resolve(id: string): RecapEntry | null
  /** the way to another life: the lobby's own wheel */
  onLobby(): void
  /** the library door the frame already carries at every station */
  door(): { word: string; press(): void }
  /** drop the night, on the device and on this surface */
  onForget(): void
}

let lines = 0

/** The recap as it stands right now. A wing paints its station card again to
 * refresh it, so this composes and never keeps state. */
export function createWingRecap(options: WingRecapOptions): HTMLElement {
  const language = options.lang()
  const say = <T extends { en: string; de: string }>(value: T): string => value[language]
  const make = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, words = ''): HTMLElementTagNameMap[K] => {
    const element = document.createElement(tag)
    element.className = cls
    if (words) element.textContent = words
    return element
  }

  const root = make('section', 'wing-recap')
  root.append(
    make('p', 'wing-recap-through', options.throughLine()),
    make('h2', 'wing-recap-heading', say(RECAP_WORDS.heading)),
  )

  const entries = options.opened()
    .map(id => options.resolve(id))
    .filter((entry): entry is RecapEntry => entry !== null)

  if (!entries.length) {
    root.append(make('p', 'wing-recap-empty', say(RECAP_WORDS.empty)))
  } else {
    root.append(make('p', 'wing-recap-prompt', say(options.narrow() ? RECAP_WORDS.promptPhone : RECAP_WORDS.prompt)))
    const list = make('ol', 'wing-recap-list')
    for (const entry of entries) {
      const item = make('li', 'wing-recap-item')
      const title = make('button', 'wing-recap-title', entry.title)
      title.type = 'button'
      item.append(title)
      if (entry.line) {
        const line = make('p', 'wing-recap-line', entry.line)
        line.id = `wing-recap-line-${++lines}`
        line.hidden = true
        title.setAttribute('aria-expanded', 'false')
        title.setAttribute('aria-controls', line.id)
        title.addEventListener('click', () => {
          line.hidden = !line.hidden
          title.setAttribute('aria-expanded', String(!line.hidden))
        })
        item.append(line)
      } else {
        title.disabled = true
      }
      list.append(item)
    }
    root.append(list)
  }

  root.append(make('p', 'wing-recap-privacy', say(RECAP_WORDS.privacy)))
  const forget = make('button', 'wing-recap-forget', say(RECAP_WORDS.forget))
  forget.type = 'button'
  forget.addEventListener('click', () => options.onForget())
  root.append(forget)

  /* THE TWO DOORS. One goes back to the wheel for another life, and the other
     is the library door this frame already carries at every station, named
     here as the way out rather than added a second time. */
  const doors = make('div', 'wing-recap-doors')
  const another = make('button', 'wing-recap-door', say(RECAP_WORDS.another))
  another.type = 'button'
  another.addEventListener('click', () => options.onLobby())
  const library = options.door()
  const ask = make('button', 'wing-recap-door', library.word)
  ask.type = 'button'
  ask.addEventListener('click', () => library.press())
  doors.append(another, ask)
  root.append(doors)

  return root
}
