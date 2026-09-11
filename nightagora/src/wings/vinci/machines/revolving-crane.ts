import type { Stack } from '../../../stack'
import { machineCatalog } from './catalog'
import { makeMachine, type ReadyMachineBuild } from './runtime'

/** Exact dossier parts and schedule. Construction dimensions remain declared assumptions. */
export function build(stack: Stack): ReadyMachineBuild {
  return makeMachine(stack, machineCatalog['revolving-crane'])
}
