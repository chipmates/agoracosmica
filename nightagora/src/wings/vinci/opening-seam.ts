/** THE WING'S OPENING, AWAITED BEFORE THE DESCENT. The opening card is its
 * own module; this seam is the one call the start makes, so the start
 * compiles without the card's branch. Replaced at landing by the card's own
 * open, which settles when the card is done, refused or cut short; the
 * descent begins in every case.
 *
 * Until then it settles at once.
 */
export function awaitOpening(host: HTMLElement): Promise<void> {
  void host
  return Promise.resolve()
}
