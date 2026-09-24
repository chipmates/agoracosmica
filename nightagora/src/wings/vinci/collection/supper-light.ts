/** Where the mural's light is handed from the supper room to the plates. The
 * room builds the node when it stands; the plates read it when they mount the
 * mural. A module of its own, so the plates never import the room. */
let muralLight: unknown

/** The light of the supper room on the field's reproduction, or undefined
 * while the room does not stand. */
export function supperMuralLight(): unknown {
  return muralLight
}

export function setSupperMuralLight(node: unknown): void {
  muralLight = node
}
