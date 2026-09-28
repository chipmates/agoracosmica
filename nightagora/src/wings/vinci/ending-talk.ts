/** THE GRAVE'S SECOND ENDING: the talk choice opens the library's door with a
 * closing question, the door the museum keeps for the walk's end. Returns
 * whether a door opened. */
import { openWingDoor } from '../frame'
import { lang } from '../content'
import { vinciFarewellDoor } from './content'

export function talkAtTheGrave(): boolean {
  return openWingDoor(vinciFarewellDoor.station, vinciFarewellDoor[lang()]) !== ''
}

/** An ending asked of the wing (`na-wing-ending`), as the desk's panel asks
 * it; false when nothing answered, and the caller goes home. */
export function endWith(ending: 'lookup' | 'talk'): boolean {
  const asked = new CustomEvent('na-wing-ending', { detail: { ending }, cancelable: true })
  dispatchEvent(asked)
  return asked.defaultPrevented
}
