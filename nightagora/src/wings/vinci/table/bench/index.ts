import { Color, DirectionalLight, PerspectiveCamera, Scene, Vector3 } from 'three/webgpu'
import type { Stack, KeyLight } from '../../../../stack'
import { IDENTITY } from '../../../../stack/grade'
import { loadManifest } from '../../../../manifest'
import { readLabels } from '../../../../core/labels'
import { buildTable, type ReadingTable, type PageRecord, LEAF } from '..'
import pageMap from '../data/msb-pages.json?raw'
import { MIRROR_EXPLANATION } from '../content'
import { BENCH_CONTENT, type BenchControl } from '../bench-content'
import benchCss from './table-bench.css?raw'
import { installProbes } from './probes'
import { configureBookShadow } from './soft-shadow'
import { createTableOrientation, type OrientationSource } from './orientation'
import type { PageEntry } from '../stream'
import type { BenchModule } from '../../../../bench'

export const TABLE_STATES = ['closed', 'open-83v', 'turning', 'mirror', 'shelf', 'open-33r', 'phone-open'] as const
const pages = (JSON.parse(pageMap) as {pages:PageRecord[]}).pages
/* THE KEY STANDS WHERE THE LAMP STANDS. The emitter inside the shade sits at
   (-0.18, 0.152, -0.108) and the book at the origin, which is an azimuth of
   -59 degrees and an elevation of 38: a raking light that models the paper's
   cockle and the leaf stack instead of flattening them from overhead. The
   shade casts no shadow, because the shade is where this light comes from. */
const keyOptions = {
  azimuth: -59, elevation: 38, kelvin: 3150, lux: 190,
  reach: 1.8, cascades: [0.45, 0.9] as [number, number], ambient: 0.40,
  sky: { zenith: '#2f2a20', horizon: '#6b5940', ground: '#281f16', stars: 0 },
}
const look = { ...IDENTITY, name: 'vinci-reading-lamp', exposure: 0.98, grain: 0.0016, vignette: 0.2 }

/** The reading table as the bench host addresses every kind: the host owns
 * the phase and the address, this owns the scene, the paper and the light. */
export function createTableBench(stack: Stack): BenchModule {
  const stage = stack.renderer.domElement.parentElement!
  let table: ReadingTable | null = null, key: KeyLight | null = null
  let host: HTMLElement | null = null, viewport: HTMLElement | null = null
  let active = false, requested = 'open-83v', sequence = 0, w = 0, h = 0
  let mirrorNote: HTMLElement | null = null, audit: HTMLElement | null = null
  const scene = new Scene()
  scene.background = new Color('#100f0c')
  const camera = new PerspectiveCamera(38, 1, 0.01, 8)
  let rail: HTMLElement | null = null
  let header: HTMLElement | null = null, dock: HTMLElement | null = null
  let chrome = ''
  let orientation: ReturnType<typeof createTableOrientation> | null = null
  let sourcePage = ''
  let appliedTier = ''
  function applyReadingTier() {
    if (!active || !key) return
    const tier = stack.tierConfig()
    if (appliedTier !== tier.name) {
      key.setTier({...tier, shadow: {...tier.shadow, on: true, mapSize: tier.name === 'hero' ? 2048 : 1024}})
      appliedTier = tier.name
    }
    const ratio = Math.min(devicePixelRatio, 2)
    if (stack.renderer.getPixelRatio() !== ratio) stack.renderer.setPixelRatio(ratio)
  }
  let language: 'en'|'de' = new URLSearchParams(location.search).get('lang') === 'de' ? 'de' : 'en'
  const controls: Record<string, HTMLButtonElement> = {}
  function readingLight() {
    const light = stack.light(keyOptions)
    light.fill.color.set('#9c8161')
    light.fill.groundColor.set('#3b2c1d')
    light.fill.intensity = 0.58
    // The stack's metre-scale normal offset exceeds this book's thickness.
    scene.traverse(item => { if (item instanceof DirectionalLight) {
      configureBookShadow(item)
    } })
    return light
  }

  function el(tag: string, className: string, text = '') {
    const node = document.createElement(tag)
    node.className = className
    node.textContent = text
    return node
  }
  function button(id: string, label: string, action: () => void) {
    const b = document.createElement('button')
    b.type = 'button'
    b.textContent = label
    b.dataset['tableAction'] = id
    b.addEventListener('click', action)
    controls[id] = b
    return b
  }
  /** what a state must contain, in table metres, and how it is looked at */
  type Box = readonly [number, number, number, number, number, number]
  interface FramedShot {
    /* A LIST, NOT ONE BOX. The lamp is 19 cm tall and stands 30 cm left of a
       book 4 cm tall: their common bounding box is mostly empty air behind
       the lamp, and a fit that contains it pushes the subject into the middle
       third of the frame. The solver contains every corner of every box. */
    boxes: readonly Box[]
    /** a phone is not a cropped desktop: a narrow stage may hold LESS of the
        room, so the subject survives at a size the thumb can read */
    phoneBoxes?: readonly Box[]
    elevation: number
    /** how much of the frame the boxes may fill, 0..1 */
    margin: number
    /** the height the eye is aimed at */
    aim: number
    /** where the eye is aimed across the table, when the centroid would leave
        the lamp hanging in a corner of the frame */
    aimX?: number
    phoneAimX?: number
    /** a phone restages: the same boxes, a narrower stage, more air */
    phoneMargin?: number
    phoneElevation?: number
    /** the eye's own turn around the subject, in radians. A portrait stage
        wants a portrait arrangement: turned to 0.95 the lamp stands BEHIND
        the book instead of beside it, and the frame stops being two thirds
        empty table. */
    phoneYaw?: number
    yaw?: number
  }
  /** the close looks: where the eye stands and what it is on, in metres */
  const CLOSE_UPS: Record<string, { at: [number, number, number]; from: [number, number, number] }> = {
    'close-lamp': { at: [-0.180, 0.158, -0.108], from: [0.075, 0.118, 0.118] },
    'close-rim': { at: [-0.180, 0.150, -0.108], from: [0.055, -0.030, 0.088] },
    'close-edge': { at: [0.086, 0.034, 0.010], from: [0.052, 0.062, 0.086] },
    'close-gutter': { at: [0, 0.036, 0], from: [0.020, 0.088, 0.062] },
    'close-fore': { at: [0.088, 0.020, 0], from: [0.090, 0.050, 0.060] },
  }
  const BOOK: Box = [-0.192, 0.192, 0, 0.046, -0.136, 0.136]
  const LAMP: Box = [-0.336, -0.108, 0, 0.192, -0.185, -0.030]
  // the shade alone: the part of the lamp that says "a lamp stands here"
  const SHADE: Box = [-0.247, -0.113, 0.100, 0.186, -0.172, -0.044]
  const RACK: Box = [-0.245, 0.245, 0, 0.195, -0.455, -0.225]
  const SPREAD: Box = [-0.172, 0.172, 0, 0.050, -0.136, 0.136]
  const SHOTS: Record<string, FramedShot> = {
    // the lamp belongs to the closed frame: it is the light in the picture
    closed: { boxes: [BOOK, LAMP], phoneBoxes: [BOOK, SHADE], elevation: 0.98, margin: 0.975, aim: 0.03, phoneMargin: 0.985, phoneYaw: 0.30, phoneElevation: 0.94 },
    /* THE WHOLE SHADE, OR NONE OF IT. Fitted to the spread alone, the frame
       cut the shade across its lit ellipse and left the base as a second pale
       shape below it: two disconnected crops at the edge instead of a lamp.
       The shade is now inside the frame and the stem runs out of the corner,
       which is a crop a visitor reads as deliberate. */
    open: { boxes: [SPREAD, SHADE], elevation: 0.95, margin: 0.985, aim: 0.034, phoneBoxes: [SPREAD], phoneAimX: 0.035, phoneMargin: 0.94, phoneElevation: 1.0 },
    /* A LIFTED LEAF IS 18 CM TALL and the frame that holds the spread at its
       best size cannot hold it: its far top corner falls a third of a
       half-height outside. So the eye rises with the paper and returns with
       it, driven by the turn's own progress, never by a cut. */
    turning: { boxes: [SPREAD, SHADE, [-0.09, 0.16, 0, 0.175, -0.125, 0.125]], elevation: 0.95, margin: 0.985, aim: 0.062, phoneBoxes: [SPREAD, [-0.09, 0.16, 0, 0.175, -0.125, 0.125]], phoneAimX: 0.035, phoneMargin: 0.94, phoneElevation: 1.0 },
    // the copy's own extent: the sheet reaches x = 0.343 and its mount 0.360
    // the copy's own extent: raked, its head reaches 9 cm above the table
    mirror: { boxes: [SPREAD, [0.185, 0.366, 0, 0.094, -0.140, 0.140]], elevation: 0.86, margin: 0.95, aim: 0.040, aimX: 0.088, phoneAimX: 0.10, phoneMargin: 0.94 },
    shelf: { boxes: [SPREAD, RACK], phoneBoxes: [RACK], elevation: 0.80, margin: 0.955, aim: 0.06, phoneMargin: 0.985, phoneElevation: 0.74 },
    leaf: { boxes: [[-0.095, 0.095, 0, 0.04, -0.128, 0.128]], phoneBoxes: [[-0.083, 0.083, 0, 0.04, -0.119, 0.119]], elevation: 1.24, margin: 0.945, aim: 0.008, phoneMargin: 0.99 },
  }
  const shotAxis = new Vector3()
  const shotCorner = new Vector3()
  interface Pose { position: Vector3; target: Vector3 }
  const solved = new Map<string, Pose>()
  /** the smallest distance along the state's own axis that still contains
      every corner of every box. Solved once per state and stage size, never
      per frame: the search moves the camera to measure it. */
  function solveShot(shot: FramedShot, phone: boolean, key: string): Pose {
    const standing = solved.get(key)
    if (standing) return standing
    const elevation = (phone && shot.phoneElevation) || shot.elevation
    const margin = (phone && shot.phoneMargin) || shot.margin
    const yaw = (phone && shot.phoneYaw) || shot.yaw || 0
    const boxes = (phone && shot.phoneBoxes) || shot.boxes
    let low = Infinity, high = -Infinity, back = Infinity, front = -Infinity
    for (const [x0, x1, , , z0, z1] of boxes) {
      low = Math.min(low, x0); high = Math.max(high, x1)
      back = Math.min(back, z0); front = Math.max(front, z1)
    }
    const aimX = (phone ? shot.phoneAimX ?? shot.aimX : shot.aimX) ?? (low + high) / 2
    const aimZ = (back + front) / 2
    shotAxis.set(Math.sin(yaw) * Math.cos(elevation), Math.sin(elevation), Math.cos(yaw) * Math.cos(elevation))
    const probe = camera.clone()
    const contains = (distance: number): boolean => {
      probe.position.set(aimX + shotAxis.x * distance, shot.aim + shotAxis.y * distance, aimZ + shotAxis.z * distance)
      probe.lookAt(aimX, shot.aim, aimZ)
      probe.updateMatrixWorld(true)
      for (const box of boxes) {
        for (let corner = 0; corner < 8; corner++) {
          shotCorner.set(corner & 1 ? box[1] : box[0], corner & 2 ? box[3] : box[2], corner & 4 ? box[5] : box[4]).project(probe)
          if (Math.abs(shotCorner.x) > margin || Math.abs(shotCorner.y) > margin) return false
        }
      }
      return true
    }
    let near = 0.12, far = 2.6
    for (let step = 0; step < 22; step++) {
      const middle = (near + far) / 2
      if (contains(middle)) far = middle
      else near = middle
    }
    const pose: Pose = {
      position: new Vector3(aimX + shotAxis.x * far, shot.aim + shotAxis.y * far, aimZ + shotAxis.z * far),
      target: new Vector3(aimX, shot.aim, aimZ),
    }
    solved.set(key, pose)
    return pose
  }
  const posePosition = new Vector3()
  const poseTarget = new Vector3()
  /** stand the eye where a state asks, and where a lifting leaf asks */
  function frameShot(shot: FramedShot, phone: boolean, lift: number, lifted?: FramedShot) {
    const key = (of: FramedShot) => `${JSON.stringify(phone && of.phoneBoxes ? of.phoneBoxes : of.boxes)}|${of.aim}|${phone ? 'p' : 'd'}|${w}x${h}`
    const rest = solveShot(shot, phone, key(shot))
    if (!lifted || lift <= 0.0005) {
      camera.position.copy(rest.position)
      camera.lookAt(rest.target)
      return
    }
    const raised = solveShot(lifted, phone, key(lifted))
    posePosition.copy(rest.position).lerp(raised.position, lift)
    poseTarget.copy(rest.target).lerp(raised.target, lift)
    camera.position.copy(posePosition)
    camera.lookAt(poseTarget)
  }
  function resize() {
    if (!viewport || !table) return
    applyReadingTier()
    const rect = viewport.getBoundingClientRect()
    if (rect.width !== w || rect.height !== h) {
      w = Math.max(1, rect.width); h = Math.max(1, rect.height)
      stack.setSize(w, h)
    }
    const phone = innerWidth < 760
    /* THE DOOR MOVES WITH THE STAGE. On a phone it belongs directly under
       the picture, above a reading column that is longer than the screen;
       on the desktop it stays the page's closing line under the dock. */
    if (orientation && host) {
      const footer = orientation.doorFooter
      const home = phone ? host.querySelector('.table-bench-workspace') : host
      if (home && footer.parentElement !== home) home.append(footer)
    }
    const status = table.snapshot(false)
    const reflected = status.mirror
    const closed = status.closed
    const leafOnly = phone && requested.replace(/^audit-/, '') === 'phone-open' && !closed && !reflected && !status.turn.active && table.shelf.hidden
    table.paperOnly(leafOnly)
    if (host) host.dataset['singlePlate'] = String(leafOnly)
    camera.aspect = w / h
    camera.fov = 38
    camera.updateProjectionMatrix()
    // The two lengths the layout cannot know until the language is in it.
    if (host && dock) {
      const dockHeight = Math.round(dock.getBoundingClientRect().height)
      const headHeight = Math.round(header?.getBoundingClientRect().height ?? 0)
      // the door row sits under the dock on the page, and on the phone it is
      // the closing gesture rather than a block pinned over the paper
      const doorHeight = Math.round(orientation?.doorFooter.getBoundingClientRect().height ?? 0)
      const measured = `${dockHeight}/${headHeight}/${doorHeight}`
      if (measured !== chrome) {
        chrome = measured
        host.style.setProperty('--table-dock', `${dockHeight}px`)
        host.style.setProperty('--table-chrome', `${headHeight + dockHeight + (innerWidth < 760 ? 0 : doorHeight) + 34}px`)
      }
    }
    /* THE SUBJECT IS FITTED, NOT GUESSED. A distance that reads at 1512 px
       letterboxes at 950 and crops on a phone, so the camera solves for the
       box the state must contain, at this stage's own aspect. */
    const shelfOpen = !table.shelf.hidden
    const shot: FramedShot = leafOnly ? SHOTS['leaf']! : shelfOpen ? SHOTS['shelf']!
      : reflected ? SHOTS['mirror']! : closed ? SHOTS['closed']! : SHOTS['open']!
    // the paper drives the eye: nothing here is eased by a UI curve
    const lift = shot === SHOTS['open'] && status.turn.active && !status.turn.preparing
      ? Math.sin(Math.min(1, Math.max(0, status.turn.progress)) * Math.PI) : 0
    frameShot(shot, phone, lift, SHOTS['turning'])
    /* ADDED INSPECTION VIEWS. The sealed seven keep their framing; these are
       the eight-times looks a claim about a surface has to survive. */
    const close = CLOSE_UPS[requested.replace(/^audit-/, '')]
    if (close) {
      camera.position.set(close.at[0] + close.from[0], close.at[1] + close.from[1], close.at[2] + close.from[2])
      camera.lookAt(close.at[0], close.at[1], close.at[2])
    }
    const material = requested.replace(/^audit-/, '').replace(/^material-/, '')
    if (requested.includes('material-')) {
      // each study stands in the lamp's own light, at the plate's distance
      const target = material === 'oak' ? new Vector3(-0.21,-0.004,0.14)
        : material === 'leather' ? new Vector3(-0.02,0.041,-0.02) : new Vector3(-0.06,0.004,0.118)
      camera.position.copy(target).add(material === 'linen' ? new Vector3(-0.012,0.086,0.062) : new Vector3(0.01,0.26,0.16))
      camera.lookAt(target)
    }
    camera.updateProjectionMatrix()
    camera.updateMatrixWorld(true)
  }
  function syncLanguage() {
    if (!host || !table) return
    table.panel.language(language)
    orientation?.language(language)
    table.mirrorDetail.language(language)
    host.lang = language
    const copy = BENCH_CONTENT[language]
    host.querySelector('.table-bench-heading')!.textContent = copy.title
    host.querySelector('.table-bench-kicker')!.textContent = copy.kicker
    viewport?.setAttribute('aria-label', copy.viewportLabel)
    rail?.setAttribute('aria-label', copy.controlsLabel)
    for (const id of Object.keys(copy.controls) as BenchControl[]) {
      if (controls[id]) controls[id]!.textContent = copy.controls[id]
    }
    const explanation = MIRROR_EXPLANATION[language]
    if (mirrorNote) {
      mirrorNote.replaceChildren(el('h2', '', explanation.title))
      for (const kind of ['documented','hypothesis','unknown'] as const) {
        const text = explanation[kind]
        const p = el('p', `table-mirror-${kind}`, String(text))
        mirrorNote.append(p)
      }
      const sources = el('details','table-mirror-sources')
      sources.append(el('summary','vt-source-summary',copy.mirrorSources))
      for (const source of MIRROR_EXPLANATION.sources) {
        const link = document.createElement('a')
        link.className = 'vt-source-link'
        link.textContent = source.title
        link.href = source.url
        link.target = '_blank'
        link.rel = 'noopener noreferrer'
        sources.append(link)
      }
      mirrorNote.append(sources)
    }
  }
  function updateControls() {
    if (!table || !host) return
    const snapshot = table.snapshot(false)
    host.dataset['closed'] = String(snapshot.closed)
    host.dataset['material'] = String(requested.includes('material-'))
    host.dataset['mirror'] = String(snapshot.mirror)
    host.dataset['turning'] = String(snapshot.turn.active)
    host.classList.toggle('table-shelf-shown', !table.shelf.hidden)
    controls['prev']!.disabled = snapshot.turn.active || snapshot.editionIndex === 0 || snapshot.closed
    controls['next']!.disabled = snapshot.turn.active || snapshot.editionIndex === 437 || snapshot.closed
    controls['open']!.hidden = !snapshot.closed
    controls['close']!.hidden = snapshot.closed
    controls['mirror']!.setAttribute('aria-pressed', String(snapshot.mirror))
    controls['shelf']!.setAttribute('aria-pressed', String(!table.shelf.hidden))
    if (mirrorNote) mirrorNote.hidden = !snapshot.mirror
    table.mirrorDetail.element.hidden = !snapshot.mirror
    const caption = host.querySelector('.table-bench-caption')
    const material = requested.split('material-')[1]
    const materialName = material === 'oak' || material === 'leather' || material === 'linen'
      ? BENCH_CONTENT[language].materials[material] : ''
    /* A LEAF THAT UNCOVERS A PUZZLE SAYS WHAT IT IS. The sheet under the
       standing leaf here is the edition's own notice that four folios were
       missing in 1883, and at frame size that reads as an empty page. The
       words are the page map's, never this seat's, and only the two kinds
       whose plate a visitor cannot read on its own are named. */
    const uncovered = snapshot.turn.active && !snapshot.turn.preparing
      ? pages[snapshot.turn.direction > 0 ? snapshot.turn.targetEditionIndex : snapshot.turn.targetEditionIndex - 1]
      : undefined
    const uncoveredLine = uncovered && (uncovered.page_kind === 'missing_notice' || uncovered.page_kind === 'blank')
      ? `${BENCH_CONTENT[language].turnCaption} · ${language === 'de' ? uncovered.what_it_shows_de : uncovered.what_it_shows_en}`
      : ''
    if (caption) caption.textContent = requested.includes('material-') ? `${BENCH_CONTENT[language].materialCaption} · ${materialName}` : uncoveredLine
      ? uncoveredLine : snapshot.mirror
      ? BENCH_CONTENT[language].mirrorCaption
      : BENCH_CONTENT[language].caption
  }
  async function mount(state: string): Promise<void> {
    requested = state
    const ticket = ++sequence
    document.body.dataset['forge'] = 'pending'
    const manifest = await loadManifest()
    if (sequence !== ticket) return
    if (!active) {
      active = true
      document.body.classList.add('table-bench-active')
      host = el('main', 'table-bench')
      const style = document.createElement('style')
      style.textContent = benchCss
      host.append(style)
      header = el('header', 'table-bench-header')
      const brand = el('p', 'table-bench-brand', 'Night Agora')
      brand.dataset['naBrand'] = ''
      header.append(brand, el('p','table-bench-kicker','LEONARDO DA VINCI · PARIS MANUSCRIPT B'), el('h1','table-bench-heading','The reading table'))
      viewport = el('section', 'table-bench-viewport')
      viewport.setAttribute('aria-label', 'The 1883 facsimile under a reading lamp')
      viewport.append(stack.renderer.domElement)
      const caption = el('p','table-bench-caption','1883 FACSIMILE · ORIGINAL MANUSCRIPT: INSTITUT DE FRANCE')
      const workspace = el('div','table-bench-workspace')
      const figure = el('div','table-bench-figure')
      figure.append(viewport, caption)
      workspace.append(figure)
      rail = el('nav','table-bench-controls')
      rail.dataset['naPersistent'] = ''
      rail.setAttribute('aria-label', 'Reading controls')
      rail.append(
        button('prev','← Previous', () => table?.turn(-1)),
        button('open','Open the book', () => {
          const restoreFocus = document.activeElement === controls['open']
          if (table) void table.open(`edition:${table.snapshot(false).editionIndex}`)
          updateControls()
          if (restoreFocus && !controls['close']!.hidden) controls['close']!.focus({ preventScroll: true })
        }),
        button('next','Next →', () => table?.turn(1)),
        button('mirror','Mirror hand', () => { table?.mirror(!table.snapshot(false).mirror); updateControls(); resize() }),
        button('shelf','Famous folios', () => {
          if (!table) return
          const on = table.shelf.hidden, current = table.snapshot(false)
          if (on && current.closed) void table.open(`edition:${current.editionIndex}`)
          if (on) table.mirror(false)
          table.panel.showShelf(on)
          updateControls(); resize()
        }),
        button('close','Close book', () => {
          const restoreFocus = document.activeElement === controls['close']
          table?.close(true)
          updateControls()
          if (restoreFocus && !controls['open']!.hidden) controls['open']!.focus({ preventScroll: true })
        }),
        button('language','DE', () => { language = language === 'en' ? 'de' : 'en'; syncLanguage() }),
      )
      host.append(header, workspace, rail)
      document.body.append(host)
      table = buildTable(stack, pages, manifest)
      scene.add(table.object)
      orientation = createTableOrientation({language, sources: () => {
        if (!table) return []
        const current = table.snapshot(false)
        return (table.manifest() as (PageEntry & Partial<OrientationSource>)[]).filter(entry => entry.page === current.file && entry.role === 'ms-page').map(entry => ({
          title: entry.title ?? `Paris manuscript ${current.codex} · ${current.folio} ${current.side ?? ''}`,
          licence: entry.licence, holder: entry.holder, source_url: entry.source_url,
          honesty_en: entry.honesty_en, honesty_de: entry.honesty_de,
        }))
      }})
      header.append(orientation.headerHour)
      rail.prepend(orientation.navSource)
      dock = el('div','table-bench-dock')
      dock.append(rail)
      host.append(dock, orientation.doorFooter)
      workspace.append(table.panel.element)
      workspace.append(table.shelf)
      mirrorNote = el('aside', 'table-mirror-note')
      workspace.append(mirrorNote)
      workspace.append(table.mirrorDetail.element)
      audit = el('pre','table-bench-audit')
      audit.hidden = true
      workspace.append(audit)
      const turnKey = (event: KeyboardEvent) => {
        if (!active || event.defaultPrevented || /INPUT|SELECT|TEXTAREA/.test((event.target as HTMLElement).tagName)) return
        if (event.key === 'ArrowRight') { event.preventDefault(); table?.turn(1) }
        if (event.key === 'ArrowLeft') { event.preventDefault(); table?.turn(-1) }
        if (event.key === 'Escape') { table?.mirror(false); table?.panel.showShelf(false); host?.classList.remove('table-shelf-shown'); updateControls() }
      }
      host.tabIndex = -1
      host.addEventListener('keydown', turnKey)
      host.focus({preventScroll:true})
      table.panel.element.addEventListener('tablelanguagechange', event => {
        language = (event as CustomEvent<{language:'en'|'de'}>).detail.language
        syncLanguage()
      })
      // Inputs stay on the paper's controls. The table has no look or drag
      // camera, so it introduces no unverified viewing cone.
      stack.setScene(scene, camera, look)
      key = readingLight()
      appliedTier = ''
      applyReadingTier()
      syncLanguage()
    }
    if (!table || !active || sequence !== ticket) return
    const cleanState = state.replace(/^audit-/, '')
    orientation?.closeSources()
    await table.open(cleanState === 'open-33r' ? '33r' : '83v')
    if (sequence !== ticket || !active) return
    resize()
    /* The prewarm proves two real draws of a resting sheet through the room's
       own post pass, so it needs the sheet in frame. An inspection close-up
       aimed at the lamp has no sheet in frame and would wait out its whole
       timeout; the sealed seven all carry one. */
    if (!/^(close|material)-/.test(cleanState)) await table.prewarmTurn(scene, camera)
    if (sequence !== ticket || !active) return
    table.close(cleanState === 'closed' || cleanState === 'material-leather')
    table.mirror(cleanState === 'mirror')
    table.panel.showShelf(cleanState === 'shelf')
    host?.classList.toggle('table-shelf-shown', cleanState === 'shelf')
    if (cleanState === 'turning') table.holdTurn(0.5)
    if (cleanState === 'sources') host?.querySelector<HTMLButtonElement>('.table-orientation-source')?.click()
    if (cleanState === 'french' || cleanState === 'reader-fr') table.panel.element.querySelector<HTMLButtonElement>('[data-reading=fr]')?.click()
    if (audit) audit.hidden = !state.startsWith('audit-')
    updateControls()
    resize()
    document.body.dataset['phase'] = 'bench'
    document.body.dataset['forge'] = 'bench'
    // Added inspection views expose the same scrollable source panel at its
    // reading position; the seven sealed scene states keep their framing.
    if (cleanState === 'reader-it' || cleanState === 'reader-fr') {
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
      if (sequence !== ticket || !active || !host || !table) return
      if (innerWidth < 760) host.scrollTop += table.panel.element.getBoundingClientRect().top - host.getBoundingClientRect().top - 12
    }
  }
  function unmount() {
    sequence++
    if (!active) return
    active = false
    orientation?.dispose(); orientation = null; sourcePage = ''
    key?.dispose(); key = null
    if (table) { scene.remove(table.object); table.dispose(); table = null }
    stage.append(stack.renderer.domElement)
    host?.remove(); host = null; viewport = null; audit = null; header = null; dock = null; chrome = ''
    document.body.classList.remove('table-bench-active')
    stack.renderer.setPixelRatio(Math.min(devicePixelRatio, stack.tierConfig().pixelRatio))
    appliedTier = ''
    stack.setSize(innerWidth, innerHeight)
    w = h = 0
  }
  function measurement() {
    if (!table) return null
    const measuredTable = table
    const snapshot = table.snapshot()
    const bounds = table.page.geometry.boundingBox
    table.page.geometry.computeBoundingBox()
    const projected = (x: number, z: number) => {
      const point = new Vector3(x, 0.031, z).applyMatrix4(measuredTable.page.matrixWorld).project(camera)
      return { x: (point.x + 1) * w / 2, y: (1 - point.y) * h / 2 }
    }
    const a = projected(0, -LEAF.height/2), b = projected(0, LEAF.height/2)
    const position = table.page.geometry.getAttribute('position')
    const extents = {left:Infinity,top:Infinity,right:-Infinity,bottom:-Infinity}
    const vertex = new Vector3()
    for (let i=0; i<position.count; i++) {
      vertex.fromBufferAttribute(position,i).applyMatrix4(table.page.matrixWorld).project(camera)
      const x = (vertex.x+1)*w/2, y = (1-vertex.y)*h/2
      extents.left = Math.min(extents.left,x); extents.right = Math.max(extents.right,x)
      extents.top = Math.min(extents.top,y); extents.bottom = Math.max(extents.bottom,y)
    }
    return { ...snapshot, state: requested, tier: stack.tierName(), backend: stack.backend,
      scale: { referenceHeightCm: LEAF.height * 100, referenceWidthCm: LEAF.width * 100,
        geometryHeightCm: (table.page.geometry.boundingBox?.max.z ?? 0) * 200,
        projectedHeightCssPx: Math.hypot(a.x-b.x,a.y-b.y), viewportCssPx: [w,h], rendererPixelRatio: stack.renderer.getPixelRatio(),
        referenceSource: LEAF.source, mapPhysicalDimensions: null, mapOnePercentGate: 'unverifiable: map contains no centimetres',
        scanAspectPreserved: true, projectedBoundsCssPx: extents, completePlateInViewport: extents.left >= 0 && extents.top >= 0 && extents.right <= w && extents.bottom <= h },
      cost: { ...stack.cost(), tableTextureMB: snapshot.textureMB, sharedLibraryTextureMB: stack.cost().textureMB },
      labels: readLabels(),
      boundsPrevious: bounds ? {min:bounds.min.toArray(),max:bounds.max.toArray()} : null,
    }
  }
  function frame(dt: number) {
    if (active && table) {
      table.update(performance.now())
      const page = table.snapshot(false).file ?? ''
      if (page !== sourcePage) { sourcePage = page; orientation?.refresh() }
      resize(); updateControls()
      if (audit && !audit.hidden) {
        const m = measurement()!
        audit.textContent = JSON.stringify({state:requested,carriers:m.carriers,tier:m.tier,backend:m.backend,folio:`${m.codex} ${m.folio}${m.side}`,turn:m.turn,scale:m.scale,cost:m.cost,targets:Math.min(...m.labels.flatMap(l=>l.targetPx===null?[]:[l.targetPx])),persistent:m.labels.filter(l=>l.persistent).length,pending:m.pending,errors:m.errors},null,2)
      }
    }
    stack.render(dt)
  }
  installProbes({mount,table:()=>table,stack,host:()=>host,measurement})
  return {
    async open(opts) {
      const asked = String(opts['state'] ?? requested)
      await mount(TABLE_STATES.includes(asked as (typeof TABLE_STATES)[number]) || /^(audit|material|reader|close)-|^(sources|french)$/.test(asked) ? asked : 'open-83v')
        .catch(error => {
          if (host) host.append(el('p','table-bench-error',`${BENCH_CONTENT[language].unavailablePrefix}${String(error)}`))
          throw error
        })
    },
    close: unmount,
    frame,
    reading: () => ({
      station: Math.max(0, (TABLE_STATES as readonly string[]).indexOf(requested)),
      stations: TABLE_STATES.length,
      stationId: requested,
      stationIds: [...TABLE_STATES],
      texturesPending: table?.pending() ?? 1,
    }),
    manifest: () => (table ? table.manifest() : []),
    ids: () => TABLE_STATES,
    station(id: string) {
      if (!(TABLE_STATES as readonly string[]).includes(id)) return false
      void mount(id)
      return true
    },
    telemetry: measurement,
    relight() { if (!active) return; key = readingLight(); appliedTier = ''; applyReadingTier() },
    lights: () => ({ rigs: key?.live() ? 1 : 0, sceneObjects: scene.children.length }),
  }
}
