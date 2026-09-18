/** THE PLAN OF A WING: one surface with three uses, a map, a quick select and
 * a memory of where the visitor has been.
 *
 * Three rules live here.
 *
 * · IT IS A PLACE, NOT A MENU. The plate is the wing drawn from its own
 *   declared geometry, and the stations stand on it where they stand in the
 *   room, so the list beside it reads as the walk reads.
 * · A PRESS IS THE PRESS THE BAR ALREADY MAKES. Every pair of stations is
 *   certified and the museum walks between them, so the quick select needs
 *   no cut, no second grammar and not one new certificate row.
 * · NOTHING DRAWS WHILE IT STANDS. The sheet is DOM over the frame the canvas
 *   already holds, so it costs no draw, no mesh and no shader.
 *
 * It owns one history entry, so a visitor's Back dismisses the plan and
 * nothing else, and it owns no words about a wing: the site, the wing's name
 * and every station name come in from the wing.
 */

import css from './plan.css?inline'
import { drawPlanPlate, PLATE_NAME_FLOOR, PLATE_NAME_PX, type PlanPlate } from './plate'
import { PLAN_WORDS } from './words'
import type { PlanSite } from './types'

export type { PlanHighlight, PlanRoom, PlanShape, PlanSite, PlanStation, RecapEntry } from './types'

const HISTORY_MARK = 'wingPlan'

/** THE WIDE STAGE: the plate takes two thirds of the sheet, the reading
 * stands beside it, and the sheet takes the stage's own height. */
export const PLAN_WIDE = { top: 76, side: 28, bottom: 18, padding: 20, gap: 22, plateShare: .66, readingMin: 270, readingMax: 380 } as const
/** THE NARROW STAGE: the sheet rises from the bar, the plate on top scaled to
 * fit whole, the reading under it. */
export const PLAN_NARROW = { top: 58, side: 8, bottom: 10, padding: 12, gap: 10, plateShare: .58, plateLeast: 190, plateMost: 400 } as const

export interface WingPlanOptions {
  host: HTMLElement
  lang(): 'en' | 'de'
  narrow(): boolean
  /** the top edge of the wing's bar: the sheet stands clear of it */
  floor(): number
  /** the wing's own name, which is the reading's heading */
  title(): string
  /** the site, read fresh on every open */
  site(): PlanSite
  /** the station standing right now, by id */
  standing(): string
  /** the stations already stood at tonight, by id */
  stood(): readonly string[]
  /** walk there: the same press the bar makes */
  station(id: string): void
  /** walk there and open that work */
  highlight(id: string): void
  /** where the hand goes when the sheet closes */
  returnFocus(): void
  /** True when an exhibit already pushed the entry this sheet should take,
   * so the visitor's Back never has to be pressed twice. */
  adopt?(): boolean
}

export interface WingPlan {
  readonly standing: boolean
  element: HTMLDialogElement
  show(): void
  close(): void
  toggle(): void
  /** Compose it again where it stands: the wing's registry is a read, and it
   * can land while the sheet is already open. */
  repaint(): void
  /** True while nothing may draw: the canvas holds its last frame. */
  held(): boolean
  dispose(): void
}

export function createWingPlan(options: WingPlanOptions): WingPlan {
  const { host } = options
  const document_ = host.ownerDocument
  const view = document_.defaultView!
  const make = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, words = ''): HTMLElementTagNameMap[K] => {
    const element = document_.createElement(tag)
    element.className = cls
    if (words) element.textContent = words
    return element
  }
  const say = <T extends { en: string; de: string }>(value: T): string => value[options.lang()]

  const dialog = document_.createElement('dialog')
  dialog.className = 'wing-plan'
  dialog.id = 'wing-plan'
  const style = make('style', '')
  style.textContent = css
  const sheet = make('div', 'wing-plan-sheet')
  const drawing = make('div', 'wing-plan-drawing')
  const marksHost = make('div', 'wing-plan-marks')
  drawing.append(marksHost)
  const reading = make('div', 'wing-plan-reading')
  const foot = make('div', 'wing-plan-foot')
  const close = make('button', 'wing-plan-close')
  close.type = 'button'
  close.addEventListener('click', () => shut())
  foot.append(close)
  sheet.append(drawing, reading)
  dialog.append(style, sheet, foot)
  host.append(dialog)

  let live = true, open = false, marked = false, popping = false
  let plate: PlanPlate | null = null

  /** Our own entry, so Back dismisses the plan and nothing else. */
  function mark(): void {
    const state = { ...(view.history.state as object | null ?? {}), [HISTORY_MARK]: 1 }
    if (options.adopt?.()) view.history.replaceState(state, '')
    else view.history.pushState(state, '')
    marked = true
  }
  function unmark(): void {
    if (!marked) return
    marked = false
    popping = true
    view.history.back()
  }

  function layout(): void {
    if (!open) return
    const width = view.innerWidth, height = view.innerHeight
    const narrow = options.narrow()
    const floor = Math.min(height, Math.max(0, options.floor()))
    dialog.dataset['narrow'] = String(narrow)
    const numbers = narrow ? PLAN_NARROW : PLAN_WIDE
    /* THE SHEET IS MODAL, so the bar under it cannot be reached while it
       stands and is not what bounds it: the wide stage takes the viewport's
       own height less its margin, and the plate grows with it. The narrow
       sheet still rises from the bar, which is where it comes from. */
    const top = numbers.top
    const bottom = Math.max(top + 200, (narrow ? floor : height) - numbers.bottom)
    const left = narrow ? numbers.side : Math.max(numbers.side, Math.round((width - 980) / 2))
    Object.assign(dialog.style, {
      left: `${left}px`, top: `${top}px`,
      width: `${Math.max(280, width - left * 2)}px`, height: `${bottom - top}px`,
    })
    paint()
  }

  /** The plate and the reading, painted on every open and every resize: a
   * language or a viewport that changed while the sheet stood is answered by
   * the next paint and never remembered. */
  function paint(): void {
    const language = options.lang()
    const narrow = options.narrow()
    const site = options.site()
    const standing = options.standing()
    const stood = new Set(options.stood())
    dialog.setAttribute('aria-label', `${say(PLAN_WORDS.plan)} · ${options.title()}`)
    close.textContent = say(PLAN_WORDS.close)

    const box = sheet.getBoundingClientRect()
    const numbers = narrow ? PLAN_NARROW : PLAN_WIDE
    const area = narrow
      ? {
        width: Math.max(80, box.width - numbers.padding * 2),
        height: Math.max(80, Math.min(PLAN_NARROW.plateMost, Math.max(PLAN_NARROW.plateLeast, (box.height - numbers.padding * 2) * numbers.plateShare))),
      }
      : {
        width: Math.max(80, (box.width - numbers.padding * 2 - numbers.gap) * numbers.plateShare),
        height: Math.max(80, box.height - numbers.padding * 2),
      }
    // The plate attaches its own drawing, because it measures a name on the
    // page before it decides where the name may stand.
    plate = drawPlanPlate(site, area, {
      host: drawing, language, standing,
      namePx: narrow ? PLATE_NAME_PX.narrow : PLATE_NAME_PX.wide,
      nameFloor: narrow ? PLATE_NAME_FLOOR.narrow : PLATE_NAME_FLOOR.wide,
    })
    // The marks are DOM over the drawing, so the two share one pixel exactly.
    drawing.style.width = `${plate.width.toFixed(2)}px`
    drawing.style.height = `${plate.height.toFixed(2)}px`
    drawing.append(marksHost)

    /* THE MARKS ARE THE MAP, THE LIST IS THE CONTROL. On the wide stage a
       mark is a 44 px target of its own. On a 390 px stage the wing's own
       eyes stand a few metres apart, which is a few pixels, so there the
       marks are drawn and the list beside them takes the hand. */
    marksHost.replaceChildren()
    for (const mark of plate.marks) {
      const element = narrow ? make('span', 'wing-plan-mark') : make('button', 'wing-plan-mark')
      if (element instanceof HTMLButtonElement) {
        element.type = 'button'
        element.addEventListener('click', () => { const id = mark.lead; press(() => options.station(id)) })
      }
      element.setAttribute('aria-hidden', 'true')
      element.tabIndex = -1
      element.dataset['here'] = String(mark.here)
      element.dataset['stood'] = String(mark.stations.some(id => stood.has(id)))
      element.style.left = `${mark.x.toFixed(2)}px`
      element.style.top = `${mark.y.toFixed(2)}px`
      const number = make('span', 'wing-plan-number', String(mark.number))
      // The plate chose the side this numeral stands clear on; the CSS moves it.
      number.style.setProperty('--numeral-x', `${mark.numeral.dx}px`)
      number.style.setProperty('--numeral-y', `${mark.numeral.dy}px`)
      element.append(make('span', 'wing-plan-dot'), number)
      marksHost.append(element)
    }

    /* THE READING IS THE WALK'S OWN ORDER: every station in rail order, the
       standing one current, the ones already stood at said so, and a work a
       visitor can open standing under the station it hangs in. */
    reading.replaceChildren()
    const heading = make('h2', 'wing-plan-heading', options.title())
    const list = make('ol', 'wing-plan-list')
    for (const station of site.stations) {
      const item = make('li', 'wing-plan-item')
      const entry = make('button', 'wing-plan-entry')
      entry.type = 'button'
      entry.setAttribute('aria-current', String(station.id === standing))
      entry.append(
        make('span', 'wing-plan-entry-number', String(station.number)),
        make('span', 'wing-plan-entry-name', station.name[language]),
      )
      if (stood.has(station.id) && station.id !== standing)
        entry.append(make('span', 'wing-plan-said', say(PLAN_WORDS.stood)))
      entry.addEventListener('click', () => press(() => options.station(station.id)))
      item.append(entry)
      const works = site.highlights.filter(highlight => highlight.station === station.id)
      if (works.length) {
        const inner = make('ul', 'wing-plan-works')
        for (const work of works) {
          const line = make('li', '')
          const button = make('button', 'wing-plan-work', work.title[language])
          button.type = 'button'
          button.dataset['kind'] = work.kind
          button.addEventListener('click', () => press(() => options.highlight(work.id)))
          line.append(button)
          inner.append(line)
        }
        item.append(inner)
      }
      list.append(item)
    }
    reading.append(heading, list)
  }

  function shut(): void {
    if (!open) return
    open = false
    unmark()
    if (dialog.open) dialog.close()
    options.returnFocus()
  }

  /** THE WALK STARTS AFTER THE ENTRY IS GONE. Dismissing the sheet is a
   * history traversal and the frame writes the station into the address as
   * it walks, so a walk begun in the same task would have its address undone
   * by the pop that follows it. The sheet closes, the entry goes, the museum
   * walks. */
  function press(run: () => void): void {
    const held = marked
    shut()
    if (!held) { run(); return }
    let done = false
    const go = (): void => {
      if (done) return
      done = true
      view.removeEventListener('popstate', go)
      run()
    }
    view.addEventListener('popstate', go)
    // a traversal that never answers still walks
    view.setTimeout(go, 150)
  }

  const leaving = new AbortController()
  view.addEventListener('popstate', () => {
    if (popping) { popping = false; return }
    if (!open) return
    marked = false
    shut()
  }, { signal: leaving.signal })
  view.addEventListener('resize', () => layout(), { signal: leaving.signal })
  // Escape is one step back and not a cancel: the plan is a place to look at.
  dialog.addEventListener('cancel', event => { event.preventDefault(); shut() })
  dialog.addEventListener('keydown', event => {
    if (event.key.toLowerCase() !== 'p' || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return
    const target = event.target as Element | null
    if (target?.closest('input,textarea,select,[contenteditable="true"]')) return
    event.preventDefault()
    shut()
  })

  return {
    get standing() { return open },
    element: dialog,
    show() {
      if (!live || open) return
      open = true
      dialog.dataset['narrow'] = String(options.narrow())
      if (!dialog.open) dialog.showModal()
      mark()
      layout()
      // THE READING OPENS WHERE THE VISITOR STANDS, with their own room's
      // works under it, and not at the top of a walk they are in the middle of.
      reading.scrollTop = 0
      const here = dialog.querySelector<HTMLElement>('.wing-plan-entry[aria-current="true"]')
      here?.focus({ preventScroll: true })
      if (here) reading.scrollTop = Math.max(0, here.getBoundingClientRect().top - reading.getBoundingClientRect().top - 4)
    },
    close: shut,
    toggle() { if (open) shut(); else this.show() },
    repaint() { if (open) layout() },
    held: () => open,
    dispose() {
      live = false
      open = false
      marked = false
      leaving.abort()
      if (dialog.open) dialog.close()
      dialog.remove()
    },
  }
}
