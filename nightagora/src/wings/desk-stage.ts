/* THE STAGE IS THE PICTURE'S OWN BOX. While the desktop's label band stands
   under the picture, the canvas is shorter than the window, so everything
   that turns a projected point into a screen point asks here instead of
   asking the window. The band is zero while no band stands, which is every
   other surface and every other screen, and then this module answers exactly
   what the window would have answered. */

let band = 0

/** the label band's measured height, written by the chrome that draws it */
export function setDeskBand(px: number): void {
  band = Number.isFinite(px) ? Math.max(0, Math.round(px)) : 0
}

export function deskBand(): number {
  return band
}

/** the picture's height on the screen: the window less the band under it */
export function deskStageHeight(): number {
  return Math.max(1, innerHeight - band)
}
