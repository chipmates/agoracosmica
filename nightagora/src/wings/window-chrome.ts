/** THE ONE RULE FOR A SHEET ON A PHONE, and the one attribute that carries
 * it. A dialog on a narrow stage owns the screen: the station's chrome stands
 * down under it, so a visitor reads the sheet and not a third of the bar.
 *
 * The close look wrote this attribute first and carries its own copy of the
 * rule inside its window's style, which is in the page only while that window
 * stands. Every other sheet asks here instead, and the stylesheet is mounted
 * once for all of them.
 */
import css from './window-chrome.css?inline'

const MOUNT = 'na-window-chrome'

/** `owns` true while a sheet stands, false on Close and on dispose. The value
 * is the stage it stands on, because a close look owns a desk as well as a
 * phone, and each stage has its own chrome to stand down. */
export function windowOwnsTheScreen(document: Document, owns: boolean, stage: 'phone' | 'desk' = 'phone'): void {
  if (!owns) { delete document.documentElement.dataset['naWindow']; return }
  if (!document.getElementById(MOUNT)) {
    const style = document.createElement('style')
    style.id = MOUNT
    style.textContent = css
    document.head.append(style)
  }
  document.documentElement.dataset['naWindow'] = stage
}
