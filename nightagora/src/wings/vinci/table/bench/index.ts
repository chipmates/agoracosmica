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
const keyOptions = {
  azimuth: -42, elevation: 56, kelvin: 3400, lux: 165,
  reach: 1.8, cascades: [0.45, 0.9] as [number, number], ambient: 0.58,
  sky: { zenith: '#37352e', horizon: '#706453', ground: '#29231b', stars: 0 },
}
const look = { ...IDENTITY, name: 'vinci-reading-lamp', exposure: 0.95, grain: 0.0015, vignette: 0.16 }

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
    light.fill.color.set('#988777')
    light.fill.groundColor.set('#41372c')
    light.fill.intensity = 0.6
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
  function resize() {
    if (!viewport || !table) return
    applyReadingTier()
    const rect = viewport.getBoundingClientRect()
    if (rect.width !== w || rect.height !== h) {
      w = Math.max(1, rect.width); h = Math.max(1, rect.height)
      stack.setSize(w, h)
    }
    const phone = innerWidth < 760
    const status = table.snapshot(false)
    const reflected = status.mirror
    const closed = status.closed
    const leafOnly = phone && requested.replace(/^audit-/, '') === 'phone-open' && !closed && !reflected && !status.turn.active && table.shelf.hidden
    table.paperOnly(leafOnly)
    if (host) host.dataset['singlePlate'] = String(leafOnly)
    camera.aspect = w / h
    camera.fov = 38
    const focusX = leafOnly ? 0 : reflected ? 0.11 : phone ? closed ? -0.08 : -0.055 : -0.012
    const distance = leafOnly ? 0.43 : phone ? reflected ? 0.82 : closed ? Math.max(0.86, 0.86*h/400) : 0.65 : reflected ? 0.72 : 0.69
    camera.position.set(focusX + (phone ? 0 : 0.02), distance * (leafOnly ? 0.98 : 0.84), distance * (leafOnly ? 0.18 : 0.53))
    camera.lookAt(focusX, leafOnly ? 0.008 : phone && !closed ? 0.055 : 0.018, 0)
    if (!table.shelf.hidden) {
      camera.position.set(0, phone ? 1.03 : 0.78, phone ? 0.59 : 0.49)
      camera.lookAt(0, 0.04, -0.14)
    }
    const material = requested.replace(/^audit-/, '').replace(/^material-/, '')
    if (requested.includes('material-')) {
      const target = material === 'oak' ? new Vector3(-0.30,-0.004,0.22)
        : material === 'leather' ? new Vector3(0,0.041,0) : new Vector3(0.151,0.016,0.119)
      camera.position.copy(target).add(material === 'linen' ? new Vector3(0.003,0.07,0.055) : new Vector3(0.01,0.26,0.16))
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
    if (caption) caption.textContent = requested.includes('material-') ? `${BENCH_CONTENT[language].materialCaption} · ${materialName}` : snapshot.mirror
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
      const header = el('header', 'table-bench-header')
      const brand = el('p', 'table-bench-brand', 'Agora Cosmica')
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
      const dock = el('div','table-bench-dock')
      dock.append(rail, orientation.doorFooter)
      host.append(dock)
      workspace.append(table.panel.element)
      workspace.append(table.shelf)
      mirrorNote = el('aside', 'table-mirror-note')
      workspace.append(mirrorNote)
      figure.append(table.mirrorDetail.element)
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
    await table.prewarmTurn(scene, camera)
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
    host?.remove(); host = null; viewport = null; audit = null
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
        audit.textContent = JSON.stringify({state:requested,tier:m.tier,backend:m.backend,folio:`${m.codex} ${m.folio}${m.side}`,turn:m.turn,scale:m.scale,cost:m.cost,targets:Math.min(...m.labels.flatMap(l=>l.targetPx===null?[]:[l.targetPx])),persistent:m.labels.filter(l=>l.persistent).length,pending:m.pending,errors:m.errors},null,2)
      }
    }
    stack.render(dt)
  }
  installProbes({mount,table:()=>table,stack,host:()=>host,measurement})
  return {
    async open(opts) {
      const asked = String(opts['state'] ?? requested)
      await mount(TABLE_STATES.includes(asked as (typeof TABLE_STATES)[number]) || /^(audit|material|reader)-|^(sources|french)$/.test(asked) ? asked : 'open-83v')
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
