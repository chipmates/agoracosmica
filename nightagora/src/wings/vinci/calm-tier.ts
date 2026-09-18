/** WHAT CALM MAY LEAVE OUT OF SIGHT.
 *
 * Calm carries 85 draws and 452.7k triangles at its worst station against a
 * budget of 60 and 400k, and the owners of that weight are known: the shell
 * seen through the collection's glazing, the ground dressing, the vegetation
 * and the terrain. None of them can be cut by welding, because each is
 * already one draw per material and its triangles are the tier's own
 * geometry. The move left is to keep a far thing out of the calm pass where
 * no station and no approach can see it.
 *
 * That is a decision about what a visitor on the smallest device is shown,
 * so it is the owner's and not a seat's. This module is the switch, built
 * and measured and SHIPPED EMPTY: with the list empty nothing changes for
 * anyone. Naming a body here is the whole change.
 */

/** A body calm may be asked to leave out. The two sown bodies are wired
 * here, at the moment they would be built. The shell is named but not wired:
 * it may not simply go, because the street, the courtyard and the garden are
 * the house, so leaving it out of sight is a per-station decision the wing's
 * own frame has to make and not a creator's.
 */
export type CalmOmission =
  /** the manor's own body, which at the collection's stations is only ever
   *  seen through the glazing (10 draws, about 100k triangles) */
  | 'shell-glazing'
  /** the landscape trees (about 60k triangles) */
  | 'vegetation'
  /** the sown grass, leaf litter and path gravel (about 87k triangles) */
  | 'ground-dressing'

/** EMPTY IS THE SHIPPED STATE. Nothing is left out until the owner names it.
 */
export const CALM_LEAVES_OUT: readonly CalmOmission[] = []

/** Whether this tier leaves that body out of sight. Only calm ever does:
 * hero and standard are the tiers the wing is composed at. */
export function leftOutAtCalm(tier: string, body: CalmOmission): boolean {
  return tier === 'calm' && CALM_LEAVES_OUT.includes(body)
}
