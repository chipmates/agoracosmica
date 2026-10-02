/* THE TURN LINE: one quiet sentence under the first way in an upright phone
   meets, once a visit, offering the sideways film. It never takes a control's
   place: it stands in the reading order after the way in and leaves with it,
   at the turn, or on a press of the way in.

   · ONCE A VISIT. A session flag, set the moment the line is shown. A store
     that refuses counts by the page load instead.
   · A HAND THAT CAN TURN THE GLASS. The upright form and a coarse pointer: a
     narrow desktop window takes the upright form too, but it has no sideways
     to offer. */

import { lang } from '../content'
import { filmForm } from './film-cinema'
import { openingWord } from './opening/arno-card'
import css from './turn-line.css?inline'

/** the stylesheet the film wing mounts beside its own */
export const TURN_LINE_CSS = css

const FLAG = 'vinci-turn-line'
let shownThisLoad = false

function seen(): boolean {
  if (shownThisLoad) return true
  try {
    return sessionStorage.getItem(FLAG) === '1'
  } catch {
    return false
  }
}

function markSeen(): void {
  shownThisLoad = true
  try {
    sessionStorage.setItem(FLAG, '1')
  } catch {
    // the page load's own flag holds it
  }
}

export interface TurnLine {
  /** lays the line in after the way in, where this visit has not met it yet */
  under(way: HTMLElement): void
  /** fades the line where it stands; its host takes it away when it leaves */
  fade(): void
}

export function createTurnLine(signal: AbortSignal): TurnLine {
  let line: HTMLParagraphElement | null = null
  /** the words stand with the opening's own; none, no line */
  const words = (): string => {
    try { return openingWord('opening.turn.line') } catch { return '' }
  }

  /** out of the flow at once: the turned glass lays its controls out without it */
  function remove(): void {
    line?.remove()
    line = null
  }

  function fade(): void {
    if (line) line.dataset['gone'] = ''
  }

  function under(way: HTMLElement): void {
    if (line || seen() || signal.aborted || !way.parentElement) return
    if (filmForm() !== 'upright' || !matchMedia('(pointer: coarse)').matches) return
    const said = words()
    if (!said) return
    line = way.ownerDocument.createElement('p')
    line.className = 'turn-line'
    line.lang = lang()
    line.textContent = said
    way.after(line)
    markSeen()
    way.addEventListener('click', fade, { once: true, signal })
    addEventListener('resize', () => { if (filmForm() !== 'upright') remove() }, { signal })
    addEventListener('na-language', () => {
      if (!line) return
      line.lang = lang()
      line.textContent = words()
    }, { signal })
  }

  signal.addEventListener('abort', remove, { once: true })
  return { under, fade }
}
