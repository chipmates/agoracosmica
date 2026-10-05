/** THE GRAVE'S SECOND ENDING: the learn choice opens the library's door to
 * Leonardo's mode choice, with the plate's words the ending keeps. Returns
 * whether a door opened. */
import { openWingModes } from '../frame'
import { endingWord } from './ending-words'
import type { VinciText } from './content'

/** The choice's own word, beside the look up on every form. */
export const learnWord = (): VinciText => endingWord('ending.learn.word')
/** Where the look up leads, said over it on every form. */
export const lobbyWord = (): VinciText => endingWord('ending.lobby.word')

export function talkAtTheGrave(): boolean {
  return openWingModes({
    title: endingWord('ending.plate.title'),
    line: endingWord('ending.plate.line'),
    go: endingWord('ending.plate.go'),
  }) !== ''
}

/** An ending asked of the wing (`na-wing-ending`), as the desk's panel asks
 * it; false when nothing answered, and the caller goes home. */
export function endWith(ending: 'lookup' | 'talk'): boolean {
  const asked = new CustomEvent('na-wing-ending', { detail: { ending }, cancelable: true })
  dispatchEvent(asked)
  return asked.defaultPrevented
}
