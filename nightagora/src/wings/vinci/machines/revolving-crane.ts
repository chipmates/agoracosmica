import type { Stack } from '../../../stack'
import { buildStoreCrane } from './crane-body'
import type { ReadyMachineBuild } from './runtime'

/** The one machine on this bench that is not built here: the recorded body out
 * of the store, from the same dossier, driven by the same schedule. */
export function build(stack: Stack): ReadyMachineBuild {
  return buildStoreCrane(stack)
}
