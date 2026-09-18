/* THE ENTRANCE PANEL. One sheet at the door of the wing, over the arrival
   frame, shown ONCE PER VISIT and never again: the four blocks, one control
   to enter and one that goes straight to the collection.

   Three rules live here.

   · ONCE PER VISIT, AND NOTHING KEPT. The flag is a session flag. A visitor
     who comes back tomorrow is welcomed again, and nothing about them
     survives the tab. A browser that refuses session storage counts as seen,
     so a blocked store can never hold the door shut on a reload.
   · THE RIG NEVER MEETS IT. Every frame the eyes shoot arrives through the
     forge marker, and a sheet over the arrival frame would be in every one
     of them. The panel opens by hand or by its own named view, never by
     itself while the rig drives.
   · THE WORDS ARE NOT HERE. They are in the wing's own content, with their
     certainty word, so this file holds a sheet and no claims. */

import { lang } from '../content'
import { LIFE_WORDS } from '../life/words'
import { vinciCertaintyWords, vinciThroughLine, vinciWelcomeBlocks, vinciWelcomeText, type VinciText } from './content'

const FLAG = 'vinci-welcome'

/** Read as seen when the store refuses, so the door never sticks. */
export function vinciWelcomeSeen(): boolean {
  try {
    return sessionStorage.getItem(FLAG) === '1'
  } catch {
    return true
  }
}

function markSeen(): void {
  try {
    sessionStorage.setItem(FLAG, '1')
  } catch {
    // A session store that refuses is not a reason to stop at the door.
  }
}

export interface VinciWelcome {
  element: HTMLDialogElement
  open(): void
  dispose(): void
}

export function createVinciWelcome(
  host: HTMLElement,
  onEnter: (route: 'house' | 'collection' | 'life') => void
): VinciWelcome {
  const text = (value: VinciText): string => value[lang()]
  const document_ = host.ownerDocument
  const phone = () => innerWidth / innerHeight <= 0.9
  const make = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, words = ''): HTMLElementTagNameMap[K] => {
    const node = document_.createElement(tag)
    node.className = cls
    if (words) node.textContent = words
    return node
  }
  const dialog = document_.createElement('dialog')
  dialog.className = 'vinci-welcome'
  dialog.id = 'vinci-welcome'
  dialog.setAttribute('aria-label', text(vinciWelcomeText.label))
  const sheet = make('div', 'vinci-welcome-sheet')
  // The controls stand outside the scrolling surface: the way in is never
  // below the fold, at either viewport.
  const foot = make('div', 'vinci-welcome-foot')
  dialog.append(sheet, foot)
  let live = true
  let route: 'house' | 'collection' | 'life' = 'house'

  function paint(): void {
    sheet.textContent = ''
    foot.textContent = ''
    sheet.append(
      make('p', 'vinci-kicker', text(vinciWelcomeText.kicker)),
      make('h1', 'vinci-welcome-title', text(vinciWelcomeText.title)),
      // The wing's one sentence, the same one the recap carries at the exit.
      make('p', 'vinci-promise', text(vinciThroughLine))
    )
    const narrow = phone()
    const blocks = make('div', 'vinci-welcome-blocks')
    for (const block of vinciWelcomeBlocks) {
      const section = make('section', 'vinci-welcome-block')
      section.append(make('h2', '', text(block.heading)))
      for (const line of block.lines) {
        if (line.only === 'phone' && !narrow) continue
        if (line.only === 'desktop' && narrow) continue
        const paragraph = make('p', 'vinci-statement')
        if (line.certainty) {
          paragraph.dataset['certainty'] = line.certainty
          paragraph.append(make('span', 'vinci-certainty-word', text(vinciCertaintyWords[line.certainty])))
        }
        paragraph.append(document_.createTextNode(text(line.text)))
        section.append(paragraph)
      }
      blocks.append(section)
    }
    sheet.append(blocks)
    foot.append(make('p', 'vinci-welcome-route', text(vinciWelcomeText.route)))
    const controls = make('div', 'vinci-welcome-controls')
    const enter = make('button', 'vinci-welcome-enter', text(vinciWelcomeText.enter))
    enter.type = 'button'
    enter.addEventListener('click', () => { route = 'house'; dialog.close() })
    const collection = make('button', 'vinci-welcome-collection', text(vinciWelcomeText.collection))
    collection.type = 'button'
    collection.addEventListener('click', () => { route = 'collection'; dialog.close() })
    controls.append(enter, collection)
    foot.append(controls)
    /* THE THIRD DOOR IS NOT A THIRD WAY IN. The two controls above choose
       where the visitor arrives; this one opens the years over the house they
       arrive in, so it stands under them and carries less weight. */
    const life = make('button', 'wing-life-door', text(LIFE_WORDS.life))
    life.type = 'button'
    life.setAttribute('aria-controls', 'wing-life')
    life.addEventListener('click', () => { route = 'life'; dialog.close() })
    foot.append(life)
  }

  // Escape enters: the panel is a welcome and not a question, so cancelling
  // it is the same as pressing Enter.
  dialog.addEventListener('cancel', event => {
    event.preventDefault()
    route = 'house'
    dialog.close()
  })
  dialog.addEventListener('close', () => {
    if (!live) return
    markSeen()
    onEnter(route)
  })
  host.append(dialog)

  return {
    element: dialog,
    open() {
      if (!live) return
      // Painted on every open, so a language or a viewport that changed while
      // the sheet stood open is answered by the next open and not remembered.
      route = 'house'
      paint()
      if (!dialog.open) dialog.showModal()
      dialog.querySelector<HTMLButtonElement>('.vinci-welcome-enter')?.focus({ preventScroll: true })
      dialog.scrollTop = 0
    },
    dispose() {
      live = false
      if (dialog.open) dialog.close()
      dialog.remove()
    },
  }
}
