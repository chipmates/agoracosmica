/** THE GRAVE'S SECOND ENDING: the talk choice opens the library's door with a
 * closing question. The door and its plate belong to the frame; this is the
 * one call the grave makes, so the grave compiles without the door's branch.
 * At landing its body becomes
 *   openWingDoor(vinciFarewellDoor.station, text(vinciFarewellDoor)); return true
 * with `openWingDoor` from `../frame` and `vinciFarewellDoor` from `./content`.
 *
 * Returns whether a door opened; while it is unwired nothing opens and the
 * grave keeps its controls as they stand.
 */
export function talkAtTheGrave(): boolean {
  return false
}
