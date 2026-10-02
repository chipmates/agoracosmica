// The shape the page reads of `same-place.mjs`, which stays plain JavaScript so its tests run in node.
export const LOOK_METRES: number
export const SHARE_METRES: number
export const EYE_MOST: number
export function samePlace(
  from: readonly (readonly number[])[] | null | undefined,
  at: number,
  to: readonly (readonly number[])[] | null | undefined,
  options?: { most?: number },
): { frame: number; eye: number; look: number } | null
