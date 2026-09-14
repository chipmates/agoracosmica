/**
 * Per-light shadow filtering for the picture bench's existing single key.
 * The shared stack keeps its renderer and map type. Three r185 ShadowNode
 * selects light.shadow.filterNode before its renderer-default filter, so this
 * replaces only the sampling of this light's already-owned depth map.
 *
 * Install immediately after stack.light(), before the scene's first render;
 * Three selects the graph while compiling receiving materials. Applying this
 * to an already-compiled scene alone does not rebuild those material graphs.
 * Every newly created key, including relight(), needs its own installation.
 */
import { PCFShadowFilter } from 'three/tsl'
import type { KeyLight } from '../../../../stack/light'

export const PICTURE_SHADOW_FILTER_RECIPE = Object.freeze({
  version: 1,
  filter: 'Three r185 PCFShadowFilter',
  radiusTexels: 1.5,
  comparisonsPerFragment: 5,
  pattern: 'Vogel disk with deterministic per-screen-pixel IGN rotation',
  timeInput: false,
  extraLights: 0,
  extraShadowMaps: 0,
  scope: 'existing picture-bench key only',
})

// @types/three r185 does not yet declare LightShadow.filterNode, although the
// installed Three ShadowNode reads it. This local intersection exposes exactly
// that public runtime hook; no global declaration or shared stack is changed.
type FilteredShadow = KeyLight['light']['shadow'] & {
  filterNode?: typeof PCFShadowFilter | null
}
export interface PictureShadowFilterHandle {
  readonly recipe: Omit<typeof PICTURE_SHADOW_FILTER_RECIPE, 'radiusTexels'> & { radiusTexels: number }
  /** The source is screen-stable at a fixed camera, not proven alias-free in motion. */
  readonly motionLimitation: string
  /** Restore owned settings only; no light, map or material is disposed. */
  restore(): void
}

/** A 1.5 shadow-texel disk makes radius effective without a renderer override. */
export function configurePictureKeyShadow(
  key: Pick<KeyLight, 'light'>,
  options: { radiusTexels?: number } = {},
): PictureShadowFilterHandle {
  const light = key?.light
  const radius = options.radiusTexels ?? PICTURE_SHADOW_FILTER_RECIPE.radiusTexels
  if (!light?.isDirectionalLight || !light.shadow?.camera?.isOrthographicCamera)
    throw new Error('Picture shadow filter requires the existing directional key')
  if (!Number.isFinite(radius) || radius <= 0 || radius > 8)
    throw new RangeError('Picture shadow radius must be finite and in (0,8] shadow texels')
  const shadow = light.shadow as FilteredShadow
  const hadFilter = Object.prototype.hasOwnProperty.call(shadow, 'filterNode')
  const priorFilter = shadow.filterNode, priorRadius = shadow.radius
  shadow.filterNode = PCFShadowFilter
  shadow.radius = radius
  // Do not enable a calm-tier shadow map or replace the stack's tier policy.
  // First-render graph creation and map rendering remain the owner's work.
  let active = true
  return {
    recipe: { ...PICTURE_SHADOW_FILTER_RECIPE, radiusTexels: radius },
    motionLimitation: 'The stock filter uses no time input. Its screen-space sample rotation can change when scene edges move; EYES must verify motion before a no-blink claim.',
    restore() {
      if (!active) return
      active = false
      // A later owner may have installed another filter or chosen a new radius.
      // Do not overwrite those independent settings during this handle's exit.
      if (shadow.filterNode === PCFShadowFilter) {
        if (hadFilter) shadow.filterNode = priorFilter
        else delete shadow.filterNode
      }
      if (shadow.radius === radius) shadow.radius = priorRadius
    },
  }
}
