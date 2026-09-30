/* THE GOLD'S NAME FITS ITS PILL. A name stands at the pill's own type on up
   to two rows; one that would take a third steps to the small type, which
   holds three rows inside the same 48 px, so the pill keeps its height and no
   row is cut. Shared by the live wing's phone form and the film player's. */

const rowsOf = (name: HTMLElement): number =>
  Math.round(name.getBoundingClientRect().height / (parseFloat(getComputedStyle(name).lineHeight) || 18))

/** Read again wherever the name or the foot changes size. A name already read
    at this width stands, so the answer never reads itself, unless the pill it
    was read in has since changed and now cuts it. */
export function fitGoldName(name: HTMLElement): void {
  const width = name.closest<HTMLElement>('.film-foot')?.clientWidth ?? 0
  // hidden (the walking ring): read when it shows
  if (!width || !(name.getBoundingClientRect().height > 0)) return
  const key = `${name.textContent ?? ''}|${width}`
  if (name.dataset['fit'] === key && (name.dataset['rows'] === '3' || rowsOf(name) <= 2)) return
  delete name.dataset['rows']
  if (rowsOf(name) > 2) name.dataset['rows'] = '3'
  name.dataset['fit'] = key
}

/** Keeps the name fitted for the life of its form: a new name, a new width,
    the serif arriving after the first read. */
export function watchGoldName(name: HTMLElement, signal: AbortSignal): void {
  const watch = new ResizeObserver(() => requestAnimationFrame(() => fitGoldName(name)))
  watch.observe(name)
  signal.addEventListener('abort', () => watch.disconnect())
  void document.fonts?.ready.then(() => { delete name.dataset['fit']; fitGoldName(name) })
}
