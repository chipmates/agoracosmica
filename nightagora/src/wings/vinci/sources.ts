import { setRegister } from '../frame'
import { lang } from '../content'
import type { VinciCertainty, VinciText } from './content'

export type VinciSourcesTab = 'station' | 'room' | 'wing'

/** A close look supplies its existing registers to the same sources window. */
export interface VinciExhibitSources {
  id: string
  title: VinciText
  certainty: VinciCertainty
  renderStation(host: HTMLElement): void
  renderRoom?(host: HTMLElement): void
}

export const vinciSourcesTabs: Readonly<Record<VinciSourcesTab, VinciText>> = {
  station: { en: 'This station', de: 'Diese Station' },
  room: { en: 'This room', de: 'Dieser Raum' },
  wing: { en: 'The wing', de: 'Der Flügel' },
}

/** One modal and one scrolling surface. Native dialog owns focus containment
 * and Escape; tab arrows never reach the station rail beneath it. */
export function createVinciSourcesWindow(host: HTMLElement, control: HTMLButtonElement,
  onClose: () => void) {
  const dialog = document.createElement('dialog')
  dialog.className = 'vinci-dock'
  dialog.id = 'vinci-source-card'
  dialog.tabIndex = -1
  dialog.setAttribute('aria-label', lang() === 'de' ? 'Quellen und Rekonstruktion' : 'Sources and reconstruction')
  setRegister(dialog, 'drawer')
  const toolbar = document.createElement('div')
  toolbar.className = 'vinci-sources-toolbar'
  const tabs = document.createElement('div')
  tabs.className = 'vinci-sources-tabs'
  tabs.setAttribute('role', 'tablist')
  tabs.setAttribute('aria-label', control.textContent ?? '')
  const close = document.createElement('button')
  close.className = 'vinci-sources-close'
  close.type = 'button'
  close.textContent = lang() === 'de' ? 'Schließen' : 'Close'
  close.addEventListener('click', () => dialog.close())
  // A press on the backdrop closes: on the phone the thumb is already below the window.
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return
    const box = dialog.getBoundingClientRect()
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close()
  })
  toolbar.append(tabs, close)
  dialog.append(toolbar)
  const buttons = {} as Record<VinciSourcesTab, HTMLButtonElement>
  const panels = {} as Record<VinciSourcesTab, HTMLElement>
  const order = Object.keys(vinciSourcesTabs) as VinciSourcesTab[]
  let selected: VinciSourcesTab = 'station'
  let live = true
  const scroll = { station: 0, room: 0, wing: 0 }

  function select(tab: VinciSourcesTab, focus = false): void {
    const changed = selected !== tab
    const moveFocus = focus || (changed && panels[selected].contains(document.activeElement))
    if (changed) { scroll[selected] = dialog.scrollTop; selected = tab }
    for (const id of order) {
      buttons[id].setAttribute('aria-selected', String(id === selected))
      buttons[id].tabIndex = id === selected ? 0 : -1
      panels[id].hidden = id !== selected
    }
    if (changed) dialog.scrollTop = scroll[selected]
    if (moveFocus) buttons[selected].focus({ preventScroll: true })
  }
  for (const id of order) {
    const button = document.createElement('button')
    button.type = 'button'
    button.id = `vinci-sources-tab-${id}`
    button.textContent = vinciSourcesTabs[id][lang()]
    button.setAttribute('role', 'tab')
    button.setAttribute('aria-controls', `vinci-sources-${id}`)
    button.addEventListener('click', () => select(id))
    button.addEventListener('keydown', event => {
      let next: VinciSourcesTab | undefined
      const index = order.indexOf(id)
      if (event.key === 'ArrowRight') next = order[(index + 1) % order.length]
      if (event.key === 'ArrowLeft') next = order[(index + order.length - 1) % order.length]
      if (event.key === 'Home') next = order[0]
      if (event.key === 'End') next = order[order.length - 1]
      if (next) { event.preventDefault(); event.stopPropagation(); select(next, true) }
    })
    buttons[id] = button
    tabs.append(button)
    const panel = document.createElement('section')
    panel.id = `vinci-sources-${id}`
    panel.className = 'vinci-sources-panel'
    panel.setAttribute('role', 'tabpanel')
    panel.setAttribute('aria-labelledby', button.id)
    panel.tabIndex = 0
    panels[id] = panel
    dialog.append(panel)
  }
  dialog.addEventListener('close', () => {
    if (!live || dialog.open) return
    control.setAttribute('aria-expanded', 'false')
    onClose()
    if (control.isConnected) control.focus({ preventScroll: true })
  })
  dialog.addEventListener('keydown', event => {
    if (event.key.toLowerCase() === 'l' && !event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey
      && !(event.target instanceof Element && event.target.closest('input,textarea,select,[contenteditable="true"]'))) {
      event.preventDefault(); event.stopPropagation(); dialog.close()
    }
  })
  host.append(dialog)
  select('station')
  control.setAttribute('aria-controls', dialog.id)
  control.setAttribute('aria-haspopup', 'dialog')
  control.setAttribute('aria-expanded', 'false')
  return {
    element: dialog, panels,
    get tab() { return selected },
    select,
    resetScroll() { for (const id of order) scroll[id] = 0; dialog.scrollTop = 0 },
    setOpen(open: boolean): void {
      if (open && !dialog.open) { dialog.showModal(); buttons[selected].focus({ preventScroll: true }) }
      else if (!open && dialog.open) dialog.close()
      control.setAttribute('aria-expanded', String(open))
    },
    dispose() { live = false; dialog.close(); dialog.remove() },
  }
}
