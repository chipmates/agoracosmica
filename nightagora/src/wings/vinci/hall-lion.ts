/** THE LION IN THE GREAT HALL. It stands on the hall's floor in the pose
 * its run starts from, its near flank open on the works, turned so the
 * door's eye reads its chest and its left flank. Like every machine it runs
 * only in its close look, so the walk keeps one shadow map and one
 * certificate. No source puts the lion in this house; it stands here as the
 * museum's reconstruction.
 */
import type { Stack } from '../../stack'
import { buildMachine, type ReadyMachineBuild } from './machines'
import { HALL_LION } from './collection/stands'

export function createHallLion(stack: Stack): ReadyMachineBuild {
  const lion = buildMachine('mechanical-lion', stack)
  lion.object.position.set(HALL_LION.east, HALL_LION.floor, -HALL_LION.north)
  lion.object.rotation.y = HALL_LION.bearing * Math.PI / 180
  lion.section(true)
  lion.animate(0, 0)
  lion.object.updateMatrixWorld(true)
  return lion
}
