import type { Stack } from '../../../../stack'
import type { CostReading } from '../../../../stack/cost'
import type { ReadingTable } from '..'
import { TABLE_UI } from '../content'
import type { PageEntry } from '../stream'
import { vinciHourArithmetic } from '../../content'
import { TABLE_STATES } from './index'

/** Supplementary measurements through the existing shot rig. DOM activation
 * here is synthetic; it does not stand in for the real-input journey gate. */
export interface ProbeContext {
  mount(state: string): Promise<void>
  table(): ReadingTable | null
  stack: Stack
  host(): HTMLElement | null
  measurement(): unknown
}

type Action = 'cost' | 'next' | 'previous' | 'shelf-33r' | 'mirror' | 'language' | 'missing25v' | 'lifecycle' | 'controls' | 'sources'
interface DomReading {
  targets: number
  smallestTargetPx: number | null
  targetName: string | null
  persistentMarks: number
  brandLines: number
}
interface CostRow {
  state: string
  cost: CostReading
  tableTextureMB: number
  pending: number
  errors: string[]
  dom: DomReading
  standardTableBudget: boolean
}
interface ProbeResult {
  action: Action
  tier: string
  viewport: [number, number]
  provenance: string
  complete: boolean
  elapsedMs: number
  errors: string[]
  rows?: CostRow[]
  checks?: Record<string, boolean>
  observation?: Record<string, unknown>
  values?: Record<string, unknown>
  measurement?: unknown
}

const PROVENANCE = 'Supplementary shot probe. Synthetic DOM events are not trusted visitor input or machine-gate coverage.'
const ACTIONS: readonly string[] = ['cost', 'next', 'previous', 'shelf-33r', 'mirror', 'language', 'missing25v', 'lifecycle', 'controls', 'sources']
const INTERACTIVE = 'a[href],button,[role="button"],input,select,textarea,summary'
const PANEL_CLASS = 'table-probe-report'
const now = () => performance.now()
const decimal = (value: number, places = 1) => Number(value.toFixed(places))

function inView(element: Element): boolean {
  const rect = element.getBoundingClientRect()
  let left = Math.max(0, rect.left), right = Math.min(innerWidth, rect.right)
  let top = Math.max(0, rect.top), bottom = Math.min(innerHeight, rect.bottom)
  if (rect.width < 1 || rect.height < 1) return false
  let ancestor: Element | null = element
  while (ancestor) {
    if (ancestor instanceof HTMLElement && ancestor.hidden) return false
    const style = getComputedStyle(ancestor)
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false
    if (ancestor !== element) {
      const bounds = ancestor.getBoundingClientRect()
      if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) {
        left = Math.max(left, bounds.left); right = Math.min(right, bounds.right)
      }
      if (/(auto|scroll|hidden|clip)/.test(style.overflowY)) {
        top = Math.max(top, bounds.top); bottom = Math.min(bottom, bounds.bottom)
      }
    }
    ancestor = ancestor.parentElement
  }
  return right > left && bottom > top
}

function readDom(host: HTMLElement): DomReading {
  const controls = [...host.querySelectorAll<HTMLElement>(INTERACTIVE)]
    .filter(element => !element.closest(`.${PANEL_CLASS}`) && inView(element))
    .map(element => {
      const rect = element.getBoundingClientRect()
      return { size: Math.min(rect.width, rect.height), name: element.getAttribute('aria-label') || element.textContent?.trim().slice(0, 70) || element.tagName }
    }).sort((a, b) => a.size - b.size)
  const count = (selector: string) => [...host.querySelectorAll(selector)].filter(inView).length
  return {
    targets: controls.length,
    smallestTargetPx: controls[0] ? decimal(controls[0].size, 2) : null,
    targetName: controls[0]?.name ?? null,
    persistentMarks: count('[data-na-persistent]'),
    brandLines: count('[data-na-brand]'),
  }
}

export function installProbes(context: ProbeContext) {
  let running = false, serial = 0
  let result: ProbeResult | null = null
  let panel: HTMLElement | null = null

  const table = () => {
    const current = context.table()
    if (!current) throw new Error('The reading table is not mounted')
    return current
  }
  const host = () => {
    const current = context.host()
    if (!current) throw new Error('The table host is not mounted')
    return current
  }
  const frame = (ticket: number) => new Promise<number>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('No animation frame within 5 seconds')), 5000)
    requestAnimationFrame(timestamp => {
      clearTimeout(timer)
      if (ticket !== serial) reject(new Error('Probe superseded'))
      else resolve(timestamp)
    })
  })
  async function frames(ticket: number, count = 12) {
    for (let i = 0; i < count; i++) await frame(ticket)
  }
  async function ready(ticket: number) {
    await table().ready()
    const started = now()
    while (table().pending() > 0) {
      if (now() - started > 15000) throw new Error('The table did not finish loading within 15 seconds')
      await frame(ticket)
    }
    await frames(ticket)
  }
  function activate(element: HTMLElement, eventType = 'click') {
    if ('disabled' in element && element.disabled) throw new Error('The requested control is disabled')
    let observed: boolean | null = null
    element.addEventListener(eventType, event => { observed = event.isTrusted }, { capture: true, once: true })
    if (eventType === 'click') element.click()
    else element.dispatchEvent(new Event(eventType, { bubbles: true }))
    if (observed === null) throw new Error('The DOM event was not observed on the requested control')
    return observed as boolean
  }
  function button(action: string) {
    const control = host().querySelector<HTMLButtonElement>(`[data-table-action="${action}"]`)
    if (!control) throw new Error(`No table control for ${action}`)
    return control
  }
  function pressKey(target: EventTarget, key: string) {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
    target.dispatchEvent(event)
    return { key, syntheticEventIsTrusted: event.isTrusted, defaultPrevented: event.defaultPrevented }
  }
  function removePanel() { panel?.remove(); panel = null }
  function renderReport(value: ProbeResult) {
    removePanel()
    panel = document.createElement('aside')
    panel.className = PANEL_CLASS
    panel.setAttribute('aria-label', 'Supplementary table audit')
    // This overlay exists only on an explicitly requested audit frame. All
    // scene costs and visitor-control measurements were taken before it.
    panel.style.cssText = 'position:fixed;inset:12px;z-index:1000;max-width:820px;max-height:calc(100vh - 24px);margin:0 auto;padding:20px 16px;overflow:auto;background:#161710;color:#dedbc8;border:1px solid #82795e;box-sizing:border-box;font:14px/1.4 system-ui,sans-serif;'
    const append = (tag: string, text: string, css = '') => {
      const element = document.createElement(tag)
      element.textContent = text
      element.style.cssText = css
      panel!.append(element)
      return element
    }
    append('h1', `Table probe · ${value.action}`, 'font:22px/1.15 Georgia,serif;margin:0 0 8px;')
    append('p', `${value.tier} · ${value.viewport.join(' × ')} CSS px · ${value.complete ? 'complete' : 'failed'}`, 'margin:0 0 8px;')
    if (value.checks) {
      const checks = Object.entries(value.checks), failures = checks.filter(([, passed]) => !passed)
      append('p', `${checks.length - failures.length}/${checks.length} checks passed · ${failures.length} failed`, 'font-weight:600;margin:0 0 8px;')
      // Put every failed outcome above the detailed observations, including on
      // a phone; the complete check/result objects remain available to the rig.
      if (failures.length) append('p', failures.map(([name]) => `FAIL · ${name}`).join('\n'), 'white-space:pre-wrap;color:#efa58e;margin:0 0 8px;')
    }
    append('p', PROVENANCE, 'font-size:12px;line-height:1.4;margin:0 0 16px;color:#bebaa6;')
    if (value.rows) {
      const grid = document.createElement('table')
      grid.style.cssText = 'border-collapse:collapse;width:100%;font-size:12px;font-variant-numeric:tabular-nums;'
      const head = grid.createTHead().insertRow()
      for (const label of ['State', 'Draws', 'Tris', 'MB']) {
        const th = document.createElement('th'); th.textContent = label
        th.style.cssText = 'text-align:left;border-bottom:1px solid #82795e;padding:5px 3px;'
        head.append(th)
      }
      const body = grid.createTBody()
      for (const row of value.rows) {
        const line = body.insertRow()
        for (const text of [row.state, String(row.cost.draws), row.cost.triangles.toLocaleString('en'), row.tableTextureMB.toFixed(1)]) {
          const cell = line.insertCell(); cell.textContent = text
          cell.style.cssText = 'padding:7px 3px;border-bottom:1px solid #454735;white-space:nowrap;'
        }
      }
      panel.append(grid)
      const sizes = value.rows.flatMap(row => row.dom.smallestTargetPx === null ? [] : [row.dom.smallestTargetPx])
      append('p', `Smallest visible target: ${sizes.length ? Math.min(...sizes).toFixed(1) + ' px' : 'none'}. Persistent marks: ${Math.max(0, ...value.rows.map(row => row.dom.persistentMarks))}.`, 'font-size:12px;margin:12px 0;')
      append('p', `Standard table limits: 40 draws / 200,000 tris / 64 MB. Rows within these limits: ${value.rows.filter(row => row.standardTableBudget).length}/${value.rows.length}.`, 'font-size:12px;margin:8px 0;')
      append('p', 'MB counts table plates and table material maps. Renderer draws include the scene and post passes. Frame p50/p95 below use132 settled frames per state, replacing the stack’s120-frame window.', 'font-size:11px;color:#bebaa6;margin:8px 0;')
      append('p', value.rows.map(row => `${row.state}: ${row.cost.frameMsP50}/${row.cost.frameMsP95} ms; ${row.cost.frameMB.toFixed(1)} MB frame`).join('\n'), 'font:11px/1.45 ui-monospace,monospace;white-space:pre-wrap;margin:8px 0;')
    }
    if (value.checks) for (const [name, passed] of Object.entries(value.checks)) append('p', `${passed ? 'PASS' : 'FAIL'} · ${name}`, 'margin:7px 0;font-size:13px;')
    if (value.observation) append('pre', JSON.stringify(value.observation, null, 2), 'font:11px/1.4 ui-monospace,monospace;white-space:pre-wrap;overflow-wrap:anywhere;margin:12px 0;')
    if (value.errors.length) append('p', value.errors.join('\n'), 'white-space:pre-wrap;color:#efa58e;')
    host().append(panel)
  }
  async function costs(ticket: number, value: ProbeResult) {
    value.rows = []
    for (const state of TABLE_STATES) {
      await context.mount(state)
      await ready(ticket)
      // Replace every one of the stack meter's120 samples after loading and
      // layout, so another state or startup cannot colour this distribution.
      await frames(ticket,132)
      const snapshot = table().snapshot(false)
      const cost = context.stack.cost()
      const dom = readDom(host())
      value.rows.push({ state, cost, tableTextureMB: snapshot.textureMB, pending: snapshot.pending,
        errors: snapshot.errors.map(String), dom,
        standardTableBudget: cost.draws <= 40 && cost.triangles <= 200000 && snapshot.textureMB <= 64 })
    }
    value.complete = value.rows.length === TABLE_STATES.length && value.rows.every(row => row.pending === 0 && row.errors.length === 0)
  }
  async function lifecycle(ticket: number, value: ProbeResult) {
    const depart = () => {
      if (!window.__forge) throw new Error('The museum departure hook is unavailable')
      window.__forge.jump('held')
    }
    const released = async (owned: ReadingTable) => {
      const started = now()
      while (owned.pending() > 0) {
        if (now() - started > 15000) throw new Error('Released table requests did not settle within 15 seconds')
        await frame(ticket)
      }
      await frames(ticket, 2)
    }
    const cycles: Array<Record<string, unknown>> = []
    value.checks = {}
    // Start inactive so departure must invalidate even a mount still awaiting
    // its manifest. Await that exact promise before checking for resurrection.
    depart()
    await frames(ticket, 2)
    const pendingMount = context.mount('open-83v')
    depart()
    await pendingMount
    await frames(ticket, 2)
    value.checks['pending mount stays unmounted after departure'] = context.table() === null && context.host() === null
    const pendingDeparture = { tableNull: context.table() === null, hostNull: context.host() === null }
    for (let cycle = 1; cycle <= 3; cycle++) {
      await context.mount('open-83v')
      await ready(ticket)
      const owned = table(), ownedHost = host(), before = owned.snapshot(false)
      const oldNavigation = ownedHost.querySelector<HTMLElement>('.table-orientation-navigation')
      const oldDrawer = oldNavigation?.querySelector<HTMLDialogElement>('.table-orientation-drawer')
      depart()
      await released(owned)
      const after = owned.snapshot(false)
      const tableNull = context.table() === null, hostNull = context.host() === null
      cycles.push({ cycle, beforeTextureMB: before.textureMB, beforeDetailCanvasMB: before.detailCanvasMB,
        beforePending: before.pending, beforeErrors: before.errors,
        afterTextureMB: after.textureMB, afterDetailCanvasMB: after.detailCanvasMB, afterPending: after.pending,
        tableNull, hostNull, oldHostConnected: ownedHost.isConnected })
      value.checks[`cycle ${cycle} loads without asset errors`] = before.pending === 0 && before.errors.length === 0
      value.checks[`cycle ${cycle} releases table and host`] = tableNull && hostNull && !ownedHost.isConnected
      value.checks[`cycle ${cycle} settles released requests`] = after.pending === 0
      value.checks[`cycle ${cycle} releases detail canvases`] = after.detailCanvasMB === 0
      value.checks[`cycle ${cycle} releases owned texture residency`] = after.textureMB === 0
      // Reconnecting the old owned DOM prevents isConnected alone from hiding
      // a live shortcut. This checks disposal behaviour, not heap retention.
      if (oldNavigation && oldDrawer) {
        document.body.append(oldNavigation)
        const key = pressKey(oldDrawer, 'l')
        const inert = !oldDrawer.open && !key.defaultPrevented
        oldNavigation.remove()
        value.checks[`cycle ${cycle} disposed sources shortcut stays inert`] = inert && !key.syntheticEventIsTrusted
        cycles[cycles.length - 1]!['disposedSources'] = { inert, ...key }
      } else value.checks[`cycle ${cycle} disposed sources shortcut stays inert`] = false
    }
    await context.mount('open-83v')
    await ready(ticket)
    const remounted = table().snapshot(false)
    const hostCount = document.querySelectorAll('.table-bench').length
    // The two labelled detail canvases are legitimate. Count the rendering
    // canvas separately so a duplicate scene mount cannot pass.
    const sceneCanvasCount = document.querySelectorAll('.table-bench-viewport > canvas').length
    const totalHostCanvases = host().querySelectorAll('canvas').length
    let trusted = activate(button('mirror'))
    await frames(ticket, 2)
    const mirrorOn = table().snapshot(false).mirror && button('mirror').getAttribute('aria-pressed') === 'true'
    trusted = activate(button('mirror')) || trusted
    await frames(ticket, 2)
    const mirrorOff = !table().snapshot(false).mirror && button('mirror').getAttribute('aria-pressed') === 'false'
    trusted = activate(button('shelf')) || trusted
    const shelfOn = !table().shelf.hidden
    trusted = activate(button('shelf')) || trusted
    const shelfOff = table().shelf.hidden
    const sourceButton = host().querySelector<HTMLButtonElement>('.table-orientation-source')
    const sourceDrawer = host().querySelector<HTMLDialogElement>('.table-orientation-drawer')
    let sourcesOnce = false
    if (sourceButton && sourceDrawer) {
      const opened = pressKey(sourceButton, 'l')
      const oneModal = sourceDrawer.open && document.querySelectorAll('.table-orientation-drawer[open]').length === 1
      const closed = pressKey(sourceDrawer, 'Escape')
      await frames(ticket, 2)
      sourcesOnce = oneModal && !sourceDrawer.open && document.activeElement === sourceButton
        && !opened.syntheticEventIsTrusted && !closed.syntheticEventIsTrusted
    }
    await ready(ticket)
    const final = table().snapshot(false)
    Object.assign(value.checks, {
      'remount opens B 83 verso': remounted.codex === 'B' && remounted.folio === 83 && remounted.side === 'verso',
      'remount has one host and one scene canvas': hostCount === 1 && sceneCanvasCount === 1,
      'remount owns the shared rendering canvas': context.stack.renderer.domElement.parentElement?.classList.contains('table-bench-viewport') === true,
      'remounted mirror control toggles both ways': mirrorOn && mirrorOff,
      'remounted shelf control toggles both ways': shelfOn && shelfOff,
      'remounted sources shortcut opens one modal and restores focus': sourcesOnce,
      'remount has no asset error or pending work': final.errors.length === 0 && final.pending === 0,
      'synthetic provenance observed': !trusted,
    })
    value.observation = { pendingDeparture, cycles, remount: { file: final.file,
      textureMB: final.textureMB, detailCanvasMB: final.detailCanvasMB, pending: final.pending,
      hostCount, sceneCanvasCount, totalHostCanvases }, syntheticEventIsTrusted: trusted,
      memoryScope: 'Owned table texture and detail canvas telemetry plus disposed shortcut behaviour; not a GPU allocator, heap-retention, or process-memory measurement.' }
    value.complete = Object.values(value.checks).every(Boolean)
    value.measurement = context.measurement()
  }
  async function controls(ticket: number, value: ProbeResult) {
    await context.mount(innerWidth < 760 ? 'phone-open' : 'open-83v')
    await ready(ticket)
    const initial = table().snapshot(false)
    let trusted = false
    const steps: Array<Record<string, unknown>> = []
    const pressed = (action: string, on: boolean) => button(action).getAttribute('aria-pressed') === String(on)
    const shelf = (on: boolean) => table().shelf.hidden !== on && pressed('shelf', on)
    const mirror = (on: boolean) => table().snapshot(false).mirror === on && pressed('mirror', on)
    const closed = () => table().snapshot(false).closed && table().panel.element.hidden
      && shelf(false) && mirror(false) && table().mirrorDetail.element.hidden
      && host().querySelector<HTMLElement>('.table-mirror-note')?.hidden === true
    async function tap(action: string) {
      const control = button(action)
      control.scrollIntoView({ block: 'nearest', behavior: 'instant' })
      if (!inView(control)) throw new Error(`The ${action} control is not visible`)
      const focusDestination = action === 'open' ? button('close') : action === 'close' ? button('open') : null
      if (focusDestination) control.focus({ preventScroll: true })
      const invokerFocused = document.activeElement === control
      trusted = activate(control) || trusted
      await ready(ticket)
      const current = table().snapshot(false)
      steps.push({ action, file: current.file, editionIndex: current.editionIndex,
        closed: current.closed, mirror: current.mirror, shelf: !table().shelf.hidden,
        mirrorPressed: button('mirror').getAttribute('aria-pressed'),
        shelfPressed: button('shelf').getAttribute('aria-pressed'),
        focusTransferred: focusDestination ? invokerFocused && document.activeElement === focusDestination && inView(focusDestination) : null,
        pending: current.pending, errors: current.errors })
    }
    value.checks = {}
    await tap('shelf')
    const firstShelf = shelf(true) && mirror(false)
    await tap('mirror')
    value.checks['mirror replaces shelf; pressed states agree'] = firstShelf && shelf(false) && mirror(true)
    await tap('close')
    value.checks['close clears mirror and its detail'] = closed()
    await tap('open')
    value.checks['open keeps the current edition'] = !table().snapshot(false).closed
      && table().snapshot(false).editionIndex === initial.editionIndex
    await tap('mirror')
    const firstMirror = mirror(true) && shelf(false)
    await tap('shelf')
    value.checks['shelf replaces mirror; pressed states agree'] = firstMirror && shelf(true) && mirror(false)
    await tap('close')
    value.checks['close clears shelf and pressed state'] = closed()
    await tap('open')
    await tap('shelf')
    const named = [...table().shelf.querySelectorAll<HTMLButtonElement>('.vt-shelf-button')]
      .find(element => element.querySelector('.vt-shelf-number')?.textContent === '33r')
    if (!named) throw new Error('The shelf has no 33r button')
    named.scrollIntoView({ block: 'center', behavior: 'instant' })
    if (!inView(named)) throw new Error('The shelf 33r control is not visible')
    const previousTitle = table().panel.element.querySelector<HTMLElement>('.vt-folio-title')
    named.focus({ preventScroll: true })
    const namedFocused = document.activeElement === named
    trusted = activate(named) || trusted
    await ready(ticket)
    const selected = table().snapshot(false)
    const selectedTitle = table().panel.element.querySelector<HTMLElement>('.vt-folio-title')
    value.checks['focused shelf name moves focus to new folio title'] = namedFocused && selectedTitle !== previousTitle
      && Boolean(selectedTitle?.isConnected && selectedTitle.tabIndex === -1 && document.activeElement === selectedTitle)
    value.checks['named B33r closes shelf and shows reading'] = selected.codex === 'B'
      && selected.folio === 33 && selected.side === 'recto' && !selected.closed
      && !table().panel.element.hidden && shelf(false) && mirror(false)
    await tap('close')
    const namedClosed = closed()
    await tap('open')
    value.checks['B33r survives close then open'] = namedClosed && !table().snapshot(false).closed
      && table().snapshot(false).editionIndex === selected.editionIndex && shelf(false) && mirror(false)
    await tap('close')
    const beforeClosedMirror = closed()
    await tap('mirror')
    const reflected = table().snapshot(false)
    value.checks['mirror opens the closed current B33r'] = beforeClosedMirror && !reflected.closed
      && reflected.editionIndex === selected.editionIndex && mirror(true) && shelf(false)
      && !table().mirrorDetail.element.hidden && table().mirrorDetail.element.dataset['ready'] === 'true'
      && table().mirrorDetail.element.dataset['page'] === reflected.file
    await tap('mirror')
    const reading = [...table().panel.element.querySelectorAll<HTMLElement>('.vt-text-section')]
      .find(section => !section.hidden)?.querySelector<HTMLElement>('.vt-source-text')
    reading?.scrollIntoView({ block: 'center', behavior: 'instant' })
    await frames(ticket, 2)
    const final = table().snapshot(false)
    value.checks['finishes on B33r with reading visible'] = final.codex === 'B' && final.folio === 33
      && final.side === 'recto' && !final.closed && !table().panel.element.hidden
      && Boolean(reading && inView(reading)) && shelf(false) && mirror(false)
    const focusTransfers = steps.filter(step => step.action === 'open' || step.action === 'close')
    value.checks['focused open and close keep focus on visible counterpart'] = focusTransfers.length > 0
      && focusTransfers.every(step => step.focusTransferred === true)
    value.checks['every settled control has no pending work or asset error'] = steps.every(step => step.pending === 0
      && Array.isArray(step.errors) && step.errors.length === 0) && final.pending === 0 && final.errors.length === 0
    value.checks['synthetic provenance observed'] = !trusted
    value.values = { steps, selectedEdition: selected.editionIndex, finalFile: final.file,
      finalEdition: final.editionIndex, syntheticEventIsTrusted: trusted }
    value.observation = { final: `${final.codex} ${final.folio}${final.side === 'recto' ? 'r' : 'v'}`,
      editionIndex: final.editionIndex, controlsActivated: steps.length + 1,
      syntheticEventIsTrusted: trusted }
    value.complete = Object.values(value.checks).every(Boolean)
    value.measurement = context.measurement()
  }
  async function sources(ticket: number, value: ProbeResult) {
    await context.mount('open-83v')
    await ready(ticket)
    const current = table().snapshot(false)
    const entries = (table().manifest() as PageEntry[]).filter(entry => entry.page === current.file && entry.role === 'ms-page')
    const source = entries[0]
    const sourceButton = host().querySelector<HTMLButtonElement>('.table-orientation-source')
    const drawer = host().querySelector<HTMLDialogElement>('.table-orientation-drawer')
    if (!source || !sourceButton || !drawer) throw new Error('The current manifested page or its source controls are missing')
    if (drawer.open) { pressKey(drawer, 'Escape'); await frames(ticket, 2) }
    sourceButton.scrollIntoView({ block: 'center', behavior: 'instant' })
    sourceButton.focus({ preventScroll: true })
    const clickTrusted = activate(sourceButton)
    await frames(ticket, 2)
    value.checks = {
      'button opens visible modal': drawer.open && drawer.matches(':modal') && inView(drawer),
      'button exposes expanded state': sourceButton.getAttribute('aria-expanded') === 'true',
      'one current full-plate source': entries.length === 1,
    }
    const readVisible = async (selector: string) => {
      const element = drawer.querySelector<HTMLElement>(selector)
      if (!element) return { text: '', visible: false }
      element.scrollIntoView({ block: 'center', behavior: 'instant' })
      await frames(ticket, 2)
      return { text: element.textContent ?? '', visible: inView(element) }
    }
    const holder = await readVisible('.table-orientation-holder')
    const licence = await readVisible('.table-orientation-licence')
    const arithmetic = await readVisible('.table-orientation-hour-source .table-orientation-arithmetic')
    const language = host().lang === 'de' ? 'de' : 'en'
    value.checks['holder visible and verbatim'] = Boolean(source.holder) && holder.visible && holder.text === source.holder
    value.checks['licence visible and verbatim'] = licence.visible && licence.text === source.licence
    value.checks['hour arithmetic visible and verbatim'] = arithmetic.visible && arithmetic.text === vinciHourArithmetic[language]
    const beforeArrow = table().snapshot(false)
    const arrow = pressKey(drawer, 'ArrowRight')
    let turnBehindModal = table().snapshot(false).turn.active
    for (let i = 0; i < 4; i++) {
      await frame(ticket)
      turnBehindModal ||= table().snapshot(false).turn.active
    }
    value.checks['modal ArrowRight does not turn'] = !turnBehindModal
      && table().snapshot(false).editionIndex === beforeArrow.editionIndex && drawer.open
    const escape = pressKey(drawer, 'Escape')
    await frames(ticket, 2)
    value.checks['Escape closes and returns focus'] = !drawer.open
      && !drawer.matches(':modal') && document.activeElement === sourceButton && sourceButton.getAttribute('aria-expanded') === 'false'
    const shortcut = pressKey(sourceButton, 'l')
    await frames(ticket, 2)
    value.checks['L opens modal'] = drawer.open && drawer.matches(':modal')
      && sourceButton.getAttribute('aria-expanded') === 'true'
    const finalEscape = pressKey(drawer, 'Escape')
    await frames(ticket, 2)
    value.checks['L then Escape returns focus'] = !drawer.open && document.activeElement === sourceButton
    const rail = host().querySelector<HTMLElement>('.table-orientation-stations')
    const links = [...host().querySelectorAll<HTMLAnchorElement>('.table-orientation-station')]
    if (!rail || !links[12]) throw new Error('The orientation station rail is missing')
    const stationNumber = (element: Element | null) => Number(element?.querySelector('.table-orientation-station-number')?.textContent)
    value.checks['19 stations; reading table is 13'] = links.length === 19
      && links.every((link, index) => stationNumber(link) === index + 1)
      && links.filter(link => link.getAttribute('aria-current') === 'page').length === 1
      && links[12].getAttribute('aria-current') === 'page'
    rail.scrollIntoView({ block: 'center', behavior: 'instant' })
    links[12].focus({ preventScroll: true })
    const railPage = table().snapshot(false), railLocation = location.href
    const route: ReadonlyArray<readonly [string, number]> = [
      ['ArrowRight', 14], ['ArrowLeft', 13], ['Home', 1], ['ArrowLeft', 1],
      ['End', 19], ['ArrowRight', 19], ['ArrowLeft', 18], ['Home', 1],
    ]
    const stationKeys = []
    for (const [key, expectedStation] of route) {
      const active = document.activeElement
      if (!(active instanceof HTMLAnchorElement) || !rail.contains(active)) throw new Error('Station focus escaped the rail')
      const fromStation = stationNumber(active)
      const event = pressKey(active, key)
      let turnStarted = table().snapshot(false).turn.active
      for (let i = 0; i < 2; i++) {
        await frame(ticket)
        turnStarted ||= table().snapshot(false).turn.active
      }
      const expected = links[expectedStation - 1]!
      const bounds = expected.getBoundingClientRect(), railBounds = rail.getBoundingClientRect()
      const left = railBounds.left + rail.clientLeft, right = left + rail.clientWidth
      const snapshot = table().snapshot(false)
      stationKeys.push({ ...event, fromStation, expectedStation, actualStation: stationNumber(document.activeElement),
        focusMatches: document.activeElement === expected,
        // Full DOM hit-box dimensions are also what readDom reports for a
        // partially exposed link. Keyboard focus must reveal the whole link.
        fullyVisible: inView(expected) && bounds.left >= left - 1 && bounds.right <= right + 1,
        targetPx: decimal(Math.min(bounds.width, bounds.height), 2), turnStarted,
        editionIndex: snapshot.editionIndex, file: snapshot.file, location: location.href,
        unchanged: !turnStarted && snapshot.editionIndex === railPage.editionIndex
          && snapshot.file === railPage.file && location.href === railLocation })
    }
    value.checks['arrows focus neighbors and clamp'] = stationKeys.filter(step => step.key.startsWith('Arrow'))
      .every(step => step.focusMatches && step.actualStation === step.expectedStation)
    value.checks['Home / End focus station 1 / 19'] = stationKeys.filter(step => step.key === 'Home' || step.key === 'End')
      .every(step => step.focusMatches && step.actualStation === step.expectedStation)
    value.checks['focused station visible; target ≥44 px'] = stationKeys.every(step => step.fullyVisible && step.targetPx >= 44)
    value.checks['rail keys prevent default'] = stationKeys.every(step => step.defaultPrevented)
    value.checks['rail keys preserve book and URL'] = stationKeys.every(step => step.unchanged)
    sourceButton.focus({ preventScroll: true })
    const keys = [arrow, escape, shortcut, finalEscape]
    value.checks['synthetic provenance observed'] = !clickTrusted && [...keys, ...stationKeys].every(key => !key.syntheticEventIsTrusted)
    value.checks['no page change, pending work or error'] = table().snapshot(false).editionIndex === current.editionIndex
      && table().snapshot(false).file === current.file
      && table().snapshot(false).errors.length === 0 && table().pending() === 0
    value.values = { page: current.file, manifestId: source.id, holder, licence, arithmetic,
      editionBefore: current.editionIndex, editionAfter: table().snapshot(false).editionIndex,
      clickSyntheticEventIsTrusted: clickTrusted, keys, stationKeys,
      inputScope: 'Synthetic DOM click and keydown only; not trusted visitor input.' }
    value.observation = { edition: `${current.editionIndex} → ${table().snapshot(false).editionIndex}`,
      stationFocus: [13, ...stationKeys.map(step => step.actualStation)].join(' → '),
      syntheticEventIsTrusted: clickTrusted || [...keys, ...stationKeys].some(key => key.syntheticEventIsTrusted) }
    await context.mount('sources')
    await ready(ticket)
    const openedForState = host().querySelector<HTMLDialogElement>('dialog')?.open === true
    await context.mount('phone-open')
    await ready(ticket)
    value.checks['state change closes the source modal'] = openedForState
      && host().querySelector<HTMLDialogElement>('dialog')?.open === false
      && !host().querySelector('dialog:modal')
    value.complete = Object.values(value.checks).every(Boolean)
    value.measurement = context.measurement()
  }
  async function interaction(action: Exclude<Action, 'cost' | 'lifecycle' | 'controls' | 'sources'>, ticket: number, value: ProbeResult) {
    await context.mount('open-83v')
    await ready(ticket)
    const before = table().snapshot()
    const start = now()
    let trusted = false
    value.checks = {}
    if (action === 'next' || action === 'previous') {
      trusted = activate(button(action === 'next' ? 'next' : 'prev'))
      const samples: Array<{ ms: number; progress: number; preparing: boolean; active: boolean }> = []
      let frameGap = 0, previous = now()
      while (now() - start < 12000) {
        await frame(ticket)
        const at = now(); frameGap = Math.max(frameGap, at - previous); previous = at
        const snapshot = table().snapshot(false)
        samples.push({ ms: decimal(at - start), progress: decimal(snapshot.turn.progress, 4), preparing: snapshot.turn.preparing, active: snapshot.turn.active })
        if (!snapshot.turn.active && snapshot.editionIndex !== before.editionIndex) break
      }
      await ready(ticket)
      const after = table().snapshot(false)
      const progresses = samples.filter(sample => sample.active && !sample.preparing).map(sample => sample.progress)
      value.checks = {
        'turn shader prewarm completed without error': before.turn.prewarmed && before.turn.prewarmError === null,
        'no observed turn frame gap over 50 ms': frameGap <= 50,
        'one physical leaf advances two edition faces': after.editionIndex === before.editionIndex + (action === 'next' ? 2 : -2),
        'turn finishes': !after.turn.active && !after.turn.preparing,
        'intermediate bend sampled': progresses.some(progress => progress > 0 && progress < 1),
        'progress never decreases while active': progresses.every((progress, i) => i === 0 || progress >= progresses[i - 1]!),
        'one second within observed frame interval': after.turn.lastObservedMs >= 1000 && after.turn.lastObservedMs <= 1000 + frameGap + 25,
      }
      value.observation = { fromEdition: before.editionIndex, toEdition: after.editionIndex,
        clickToSettlementMs: decimal(now() - start), animationMs: decimal(after.turn.lastObservedMs),
        largestObservedFrameGapMs: decimal(frameGap), samples: samples.length,
        prewarmed: before.turn.prewarmed, prewarmError: before.turn.prewarmError,
        prewarmDraws: before.turn.prewarmDraws, prewarmPass: before.turn.prewarmPass,
        progressRange: progresses.length ? [Math.min(...progresses), Math.max(...progresses)] : [], syntheticEventIsTrusted: trusted }
    } else if (action === 'shelf-33r') {
      trusted = activate(button('shelf'))
      const shelfOpened = !table().shelf.hidden
      const control = [...table().shelf.querySelectorAll<HTMLButtonElement>('.vt-shelf-button')]
        .find(element => element.querySelector('.vt-shelf-number')?.textContent === '33r')
      if (!control) throw new Error('The shelf has no 33r button')
      control.scrollIntoView({ block: 'center', behavior: 'instant' })
      trusted = activate(control) || trusted
      await ready(ticket)
      const after = table().snapshot(false)
      value.checks = { 'shelf control opens shelf': shelfOpened, 'named shelf control opens B 33r': after.codex === 'B' && after.folio === 33 && after.side === 'recto' }
      value.observation = { codex: after.codex, folio: after.folio, side: after.side, syntheticEventIsTrusted: trusted }
    } else if (action === 'mirror') {
      trusted = activate(button('mirror'))
      await frames(ticket)
      const current = table().snapshot(false)
      const detail = host().querySelector<HTMLElement>('.vt-mirror-detail')
      const canvases = detail?.querySelectorAll<HTMLCanvasElement>('canvas')
      const original = canvases?.[0], reversed = canvases?.[1]
      const sameDimensions = Boolean(canvases?.length === 2 && original && reversed
        && original.width > 0 && original.height > 0
        && original.width === reversed.width && original.height === reversed.height)
      let matches = 0, mismatches = 0, opaquePixels = 0, pixelsCompared = 0
      if (sameDimensions && original && reversed) {
        const first = original.getContext('2d'), second = reversed.getContext('2d')
        if (first && second) {
          const width = original.width, height = original.height
          const a = first.getImageData(0, 0, width, height).data
          const b = second.getImageData(0, 0, width, height).data
          for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
            const i = 4 * (y * width + x), j = 4 * (y * width + width - 1 - x)
            const equal = a[i] === b[j] && a[i + 1] === b[j + 1]
              && a[i + 2] === b[j + 2] && a[i + 3] === b[j + 3]
            if (equal) matches++
            else mismatches++
            if (a[i + 3] === 255 && b[j + 3] === 255) opaquePixels++
            pixelsCompared++
          }
        }
      }
      value.checks = {
        'mirror control enables reflection': current.mirror,
        'mirror control exposes pressed state': button('mirror').getAttribute('aria-pressed') === 'true',
        'mirror detail is ready': detail?.dataset['ready'] === 'true',
        'mirror detail source is current page': Boolean(current.file && detail?.dataset['page'] === current.file),
        'mirror detail canvas dimensions agree': sameDimensions,
        'mirror detail contains opaque pixels': opaquePixels > 0,
        'mirror detail is exact RGBA horizontal reversal': sameDimensions && pixelsCompared > 0
          && pixelsCompared === (original?.width ?? 0) * (original?.height ?? 0) && mismatches === 0,
      }
      value.values = { sourcePage: detail?.dataset['page'] ?? null, currentPage: current.file,
        canvasCount: canvases?.length ?? 0, width: original?.width ?? 0, height: original?.height ?? 0,
        matches, mismatches, opaquePixels, pixelsCompared }
      value.observation = { ...value.values, syntheticEventIsTrusted: trusted }
    } else if (action === 'language') {
      const previousLanguage = table().panel.element.lang
      trusted = activate(button('language'))
      await frames(ticket)
      const after = table().snapshot()
      const wanted = previousLanguage === 'de' ? 'en' : 'de'
      value.checks = { 'language control changes panel': table().panel.element.lang === wanted,
        'bench and panel language agree': host().lang === wanted,
        'Italian witness stays verbatim': before.transcription_it === after.transcription_it,
        'French witness stays verbatim': before.translation_fr === after.translation_fr }
      value.observation = { fromLanguage: previousLanguage, toLanguage: table().panel.element.lang, syntheticEventIsTrusted: trusted }
    } else {
      const summary = table().panel.element.querySelector<HTMLElement>('.vt-browse > summary')
      if (!summary) throw new Error('The manuscript selector has no browse control')
      if (!(summary.parentElement as HTMLDetailsElement).open) trusted = activate(summary)
      const select = table().panel.element.querySelector<HTMLSelectElement>('select[name="folio"]')
      if (!select || ![...select.options].some(option => option.value === 'B:25v')) throw new Error('B 25v is missing from the actual manuscript selector')
      select.value = 'B:25v'
      trusted = activate(select, 'change') || trusted
      await ready(ticket)
      const after = table().snapshot(false)
      const text = table().panel.element.querySelector<HTMLElement>('[data-text="transcription"]')
      const lang = table().panel.element.lang === 'de' ? 'de' : 'en'
      value.checks = { 'selector opens B 25v': after.codex === 'B' && after.folio === 25 && after.side === 'verso',
        'unaligned transcription is labelled': text?.textContent === TABLE_UI[lang].unavailable,
        'unavailable styling is applied': Boolean(text?.classList.contains('vt-unavailable')) }
      value.observation = { transcription: text?.textContent, textColor: text ? getComputedStyle(text).color : null, syntheticEventIsTrusted: trusted }
    }
    value.checks['synthetic provenance observed'] = !trusted
    value.checks['no asset error'] = table().snapshot(false).errors.length === 0
    value.complete = Object.values(value.checks).every(Boolean)
    value.measurement = context.measurement()
  }
  const hook = {
    freeze() { /* The audit samples the live clock; it never freezes a turn. */ },
    state() { return { phase: 'bench', texturesPending: Number(running) + (context.table()?.pending() ?? 0), result } },
    result() { return result },
    jump(phase: string, opts: Record<string, unknown> = {}) {
      if (phase !== 'bench') throw new Error('The table probe only accepts phase bench')
      const requested = String(opts['action'] ?? 'cost')
      if (!ACTIONS.includes(requested)) throw new Error(`Unknown table probe action: ${requested}`)
      const action = requested as Action, ticket = ++serial, started = now()
      removePanel()
      running = true
      result = { action, tier: context.stack.tierName(), viewport: [innerWidth, innerHeight], provenance: PROVENANCE, complete: false, elapsedMs: 0, errors: [] }
      const value = result
      document.body.dataset['forge'] = 'bench'
      void (async () => {
        try {
          if (action === 'cost') await costs(ticket, value)
          else if (action === 'lifecycle') await lifecycle(ticket, value)
          else if (action === 'controls') await controls(ticket, value)
          else if (action === 'sources') await sources(ticket, value)
          else await interaction(action, ticket, value)
        } catch (error) {
          value.complete = false
          value.errors.push(String(error))
        } finally {
          if (ticket === serial) {
            value.elapsedMs = decimal(now() - started)
            running = false
            document.body.dataset['forge'] = 'bench'
            if (context.host()) renderReport(value)
          }
        }
      })()
    },
  }
  const target = window as unknown as Record<string, unknown>
  target['__forgeTableProbe'] = hook
  return {
    hook,
    dispose() { serial++; running = false; removePanel(); if (target['__forgeTableProbe'] === hook) delete target['__forgeTableProbe'] },
  }
}
