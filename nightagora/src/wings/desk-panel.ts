/* THE WING'S HALF OF THE INSTRUMENTS PANEL, the `desk.panel` step.

   The panel itself is the lobby's own, in the shell: this file hands it the
   five rows a wing adds at its head, answers a press on one of them with the
   wing's own control, and keeps the two ways the walk needs at its ends. The
   words are the card data's and the wing's controls' own, never written here.

   Nothing below runs while the step is off. */

import { deskControl } from './desk-story'
import { say, WING_TEXT } from './content'
import type { VinciText } from './vinci/content'

/** one row of the wing's own five, as the shell paints it */
export interface DeskPanelRow {
  id: string
  label: string
  /** the walk's own count, beside the row that opens the whole of it */
  count?: string
  /** the way out of the wing carries a chevron, as a way back does */
  mark?: 'back'
  /** a row whose own surface is not built names itself and refuses */
  disabled?: boolean
}

export interface DeskPanelHost {
  /** `#wing`, where the step's attribute and the band's height are written */
  wing: HTMLElement
  /** the band the ways hang in, so they can go home after the plate */
  band: HTMLElement
  ways: HTMLElement
  back: HTMLButtonElement
  on: HTMLButtonElement
  kicker: HTMLElement
  title: HTMLElement
  arrow: HTMLElement
  standing: () => { index: number; count: number }
  /** null at the end of the walk, which is where the way on leads up */
  next: () => unknown
}

const ARROW_ON = 'M3 8h10M9 4l4 4-4 4'
const ARROW_UP = 'M8 13V3M4 7l4-4 4 4'

const text = (value: VinciText): string => say(value)

/** the word a control of the wing already carries, in the page's language */
const wordOf = (node: Element | null): string => node?.textContent?.trim() ?? ''

export function createDeskPanel(host: DeskPanelHost): void {
  const stop = new AbortController()
  const signal = stop.signal
  const control = document.getElementById('rail-instruments')
  const panel = document.getElementById('instruments')

  /* THE WAY OUT OF THE WING, NAMED. At the first station the way back leads
     out of the wing instead of one station back, so it carries the word
     before the press. It is the ways' own place and the only station with it. */
  const out = document.createElement('span')
  out.className = 'desk-panel-out'
  out.hidden = true
  host.ways.insertBefore(out, host.ways.firstChild)
  /* the ways go home to their own place in the band after the door's plate
     has borrowed them, so the row is rebuilt nowhere */
  const waysNext = host.ways.nextElementSibling

  const path = host.arrow.querySelector<SVGPathElement>('.desk-ic path')

  function set(node: HTMLElement, key: 'textContent' | 'ariaLabel', value: string): void {
    if (key === 'textContent') { if (node.textContent !== value) node.textContent = value }
    else if (node.getAttribute('aria-label') !== value) node.setAttribute('aria-label', value)
  }

  /* THE TWO ENDS OF THE WALK. The chrome paints the ways for the stations
     between them and disables both controls at the ends; here each end gets
     the way out it needs. Every write is compared first, so the observer that
     brings us here never answers our own hand. */
  function ways(): void {
    const at = host.standing()
    const first = at.index === 0
    const end = host.next() === null
    if (out.hidden === first) out.hidden = !first
    if (first) {
      set(out, 'textContent', text(WING_TEXT.lobby))
      if (host.back.disabled) host.back.disabled = false
      set(host.back, 'ariaLabel', text(WING_TEXT.lobby))
    }
    if (end) {
      if (host.on.disabled) host.on.disabled = false
      const look = text(deskControl('walk', 'look_up'))
      set(host.title, 'textContent', look)
      if (host.title.hidden) host.title.hidden = false
      set(host.on, 'ariaLabel', `${host.kicker.textContent ?? ''} · ${look}`)
    }
    const d = end ? ARROW_UP : ARROW_ON
    if (path && path.getAttribute('d') !== d) path.setAttribute('d', d)
  }

  /** the frame's own way home, pressed by every row and end that leaves */
  function leave(): void {
    host.wing.querySelector<HTMLElement>('.wing-lobby')?.click()
  }
  host.back.addEventListener('click', () => {
    if (host.standing().index === 0) leave()
  }, { signal })
  host.on.addEventListener('click', () => {
    if (host.next() === null) leave()
  }, { signal })

  /* THE FIVE ROWS THE WING ADDS at the panel's head. Every word is the card
     data's or the wing's own control's, so a wing that carries no plan offers
     no plan row and nothing here writes a string. */
  function rows(): DeskPanelRow[] {
    const at = host.standing()
    const list: DeskPanelRow[] = [{
      id: 'lobby',
      label: wordOf(host.wing.querySelector('.wing-lobby')) || text(WING_TEXT.lobby),
      mark: 'back',
    }]
    const plan = wordOf(host.wing.querySelector('.wing-plan-open'))
    if (plan) list.push({ id: 'plan', label: plan })
    const life = wordOf(host.wing.querySelector('.wing-life-open'))
    if (life) list.push({ id: 'life', label: life })
    /* THE CHAPTERS ARE THE PLAN. The walk has one page that shows the whole
       of it, so the row that names the chapters opens that page and carries
       the walk's own count, which is the count in the name row. */
    if (plan) list.push({
      id: 'chapters',
      label: text(deskControl('ways', 'chapters')),
      count: `${at.index + 1} / ${at.count}`,
    })
    return list
  }

  let said = ''
  function publish(): void {
    const list = rows()
    const line = JSON.stringify(list)
    if (line === said) return
    said = line
    dispatchEvent(new CustomEvent('na-wing-instruments', { detail: { rows: list } }))
  }

  /* THE BAND'S HEIGHT, WHERE THE SHELL CAN READ IT. The control and the sheet
     stand outside the wing's element, so the two numbers that place them are
     copied to the root in the frame the band publishes them in. */
  function measure(): void {
    const box = getComputedStyle(host.wing)
    for (const name of ['--desk-foot-clear', '--desk-g'] as const) {
      const value = box.getPropertyValue(name).trim()
      if (!value) continue
      const onto = name === '--desk-g' ? '--desk-panel-g' : '--desk-band-h'
      if (document.documentElement.style.getPropertyValue(onto) !== value)
        document.documentElement.style.setProperty(onto, value)
    }
  }

  let scheduled = 0
  function read(): void {
    if (scheduled) return
    scheduled = requestAnimationFrame(() => {
      scheduled = 0
      // the wing was struck: the band is out of the document and so is this
      if (!host.band.isConnected) { stop.abort(); return }
      ways()
      publish()
      measure()
    })
  }
  /* The chrome repaints the band on every station, every language and every
     leg, and this step reads what it wrote: one observer instead of a hook in
     a paint that belongs to another hand. */
  const watch = new MutationObserver(read)
  watch.observe(host.band, { subtree: true, childList: true, characterData: true, attributes: true })
  watch.observe(host.wing, { attributes: true, attributeFilter: ['style', 'data-desk'] })
  signal.addEventListener('abort', () => watch.disconnect())
  read()

  /* A PRESS IN THE PANEL IS ANSWERED BY THE WING'S OWN CONTROL. The panel is
     the museum's and knows no wing, so it says which row was pressed and the
     wing presses what that row stands for. */
  addEventListener('na-wing-instrument', event => {
    const id = (event as CustomEvent<{ row?: string }>).detail?.row
    if (id === 'lobby') leave()
    else if (id === 'plan' || id === 'chapters') host.wing.querySelector<HTMLElement>('.wing-plan-open')?.click()
    else if (id === 'life') host.wing.querySelector<HTMLElement>('.wing-life-open')?.click()
  }, { signal })

  /* THE DOOR'S PLATE IS THE BAND GROWN, so the ways stand inside it while it
     stands: the control a visitor has pressed at every station keeps its
     place and its meaning, and goes home when the plate closes. */
  let drawerStood = false
  addEventListener('na-wing-plate', event => {
    const open = (event as CustomEvent<{ open?: boolean }>).detail?.open === true
    const plate = host.wing.querySelector<HTMLElement>('.wing-door-plate')
    if (!plate) return
    if (open) plate.append(host.ways)
    else if (host.ways.parentElement !== host.band) host.band.insertBefore(host.ways, waysNext)
    /* ONE GROUND, ONE HEIGHT. The plate and the drawer are the same wall
       grown, so the drawer folds under the plate and comes back with it: the
       visitor is left where he was, with the door under his hand again. */
    if (open) {
      drawerStood = host.wing.dataset['drawer'] === 'open'
      if (drawerStood) host.wing.querySelector<HTMLElement>('.desk-drawer-close')?.click()
    } else if (drawerStood) {
      drawerStood = false
      if (host.wing.dataset['drawer'] !== 'open') host.wing.querySelector<HTMLElement>('.desk-more')?.click()
    }
  }, { signal })

  /* ONE SURFACE AT A TIME: a press on the way on or the way back while the
     plate stands takes the visitor on, so the plate closes with it. */
  for (const way of [host.back, host.on])
    way.addEventListener('click', () => {
      const plate = host.wing.querySelector<HTMLDialogElement>('.wing-door-plate')
      if (plate?.open) plate.close()
    }, { signal })

  /* THE WING'S KEYS ARE NOT THE PANEL'S. The wing listens for the arrows on
     the window, and while the panel stands the hand is inside it, so its keys
     stop at its own edge. The panel's own Escape and Tab are answered before
     this listener, which is why it is added after them. */
  panel?.addEventListener('keydown', event => event.stopPropagation(), { signal })

  /* THE CONTROL RISES WITH THE SHEET AND DROPS BACK WITH IT, which is the
     shell's own move: nothing here is rebuilt, so the hand that opened the
     panel closes it without moving. */
  if (control && panel) signal.addEventListener('abort', () => {
    if (control.parentElement === panel) document.getElementById('rail')?.append(control)
  })
}
