/** THE GRAVE'S SECOND ENDING: the talk choice opens the library's door with a
 * closing question, the door the museum keeps for the walk's end. Returns
 * whether a door opened. */
import { openWingDoor } from '../frame'
import { lang } from '../content'
import { vinciFarewellDoor } from './content'

export function talkAtTheGrave(): boolean {
  return openWingDoor(vinciFarewellDoor.station, vinciFarewellDoor[lang()]) !== ''
}
