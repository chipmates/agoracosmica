import { Box3, Color, Mesh, MeshStandardNodeMaterial, PerspectiveCamera, Scene, Vector3, type PlaneGeometry } from 'three/webgpu'
import type { Stack, KeyLight, TierName, SkyProbe } from '../../../../stack'
import type { BenchModule } from '../../../../bench'
import type { PictureBilingual } from '../policy-label'
import { IDENTITY } from '../../../../stack/grade'
import { loadManifest } from '../../../../manifest'
import { readLabels } from '../../../../core/labels'
import { ASSET_BASE } from '../../../../stack/materials'
import { createPictureCertaintyKey, createPictureRecord, readingLevels, setRegister } from '../policy-label'
import { createSignatureLabel, SIGNATURE_NOTE } from '../signature-label'
import { visitorHolder, visitorNote, visitorSource } from '../visitor-copy'
import { pictureDisplayWindow, pictureDisplayUV, assessPictureDisplayWindow } from '../registration'
import { DISCLOSURES } from '../../../../content/disclosures'
import {
  buildHang, createWorkLabel, element, getSegment, segmentWorks, SEGMENTS,
  measureProjectedWork, type HungFrame,
} from '..'
import { createSourceCatalogue } from './source-catalogue'
import { buildPictureRoom } from './room'
import { createBenchMaterialBudget, type BenchMaterialBudget } from './material-budget'
import { createBenchProbe, type BenchProbe } from './probe-budget'
import picturesCSS from './pictures.css?raw'
import { createHangEvidencePanel, hangEvidencePanelCSS } from './evidence-panel'
import { configurePictureKeyShadow, PICTURE_SHADOW_FILTER_RECIPE } from './picture-shadow-filter'
import { fitBenchKeyShadow } from './shadow-fit'
import { getBenchGI, type BenchGI } from './gi-index'
import roomConfigurations from './gi-config.json'
import { buildMaterialPair, type MaterialPairKind } from './material-pairs'
import { createReadingRuler } from './reading-ruler'

interface BenchOptions { kind?: string; segment?: string; work?: string; view?: string; [key: string]: unknown }
const said = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined)
/** The host addresses every kind through one options bag whose values are
    `unknown`; this bench reads three of them as the strings they are. */
function pictureOptions(opts: Record<string, unknown>): BenchOptions {
  return { ...opts, segment: said(opts['segment']), work: said(opts['work']), view: said(opts['view']) }
}

/** THE PICTURE BENCH. The shared host in src/bench owns the phase, the
 * address and the frame; everything the visitor sees while it stands is
 * owned here. No station or phase of the museum is impersonated for a
 * measurement harness.
 */
export async function createPictureBench(stack: Stack, onLobby: () => void): Promise<BenchModule> {
  const style = document.createElement('style')
  style.textContent = picturesCSS
  document.head.append(style)
  const manifest = await loadManifest()
  const host = element('section', 'picture-bench')
  host.id = 'picture-bench'
  host.hidden = true
  host.setAttribute('aria-label', 'The picture room, at true scale')
  document.body.append(host)
  let active: ReturnType<typeof mount> | null = null
  let generation = 0
  let ownsBench = false
  let loading = false
  let standing: string | null = null
  let failure: string | null = null
  let northSky: SkyProbe | null = null
  let materials: BenchMaterialBudget | null = null
  let materialTier: TierName | null = null
  let benchProbe: BenchProbe | null = null
  function probeMB(): number {
    // The inherited lobby retains its baked sky and prefilter allocation.
    // Reserve 4 MiB for that in addition to the privately owned bench probe.
    return (benchProbe?.textureMB() ?? 0) + 4
  }
  const extraTextureMB = (): number => (materials?.textureMB() ?? 0) + probeMB()
  const route = (): BenchOptions | null => {
    const segment = /^\/bench\/vinci\/pictures\/([a-z0-9-]+)\/?$/.exec(location.pathname)?.[1]
    const state = new URLSearchParams(location.hash.slice(1))
    return segment ? { segment, work: state.get('work') ?? undefined, view: state.get('view') ?? undefined } : null
  }
  const benchURL = (segment: string, work: string, view?: string): string => {
    const state = new URLSearchParams({ work })
    if (view) state.set('view', view)
    return `/bench/vinci/pictures/${segment}${location.search}#${state}`
  }

  const lightOptions = {
    azimuth: 235, elevation: 34, kelvin: 6800, lux: 65,
    ambient: .55, reach: 22, cascades: [9, 18] as [number, number],
    sky: { zenith: '#9faeb6', horizon: '#e1e3da', ground: '#555443', stars: 0 },
  }

  function mount(segmentId: string, workId?: string, view?: string) {
    const cleanup: Array<() => void> = []
    let mounted = false
    try {
    const segment = getSegment(segmentId)
    const catalogueId = view?.startsWith('catalogue:') ? view.slice('catalogue:'.length) : null
    if (catalogueId) view = 'sources'
    let recordOpen = view === 'record' || view?.endsWith('-record') === true
    if (recordOpen) view = view === 'record' ? 'sources' : view!.replace(/-record$/, '-sources')
    const sourceView = view === 'sources' || view?.endsWith('-sources') === true
    if (sourceView) view = view === 'sources' ? undefined : view!.replace(/-sources$/, '')
    let labelLanguage: 'en' | 'de' = view === 'german' || view?.startsWith('german-') ? 'de' : 'en'
    if (labelLanguage === 'de') view = view === 'german' ? undefined : view!.slice('german-'.length)
    let reverseFace = view === 'reverse' || view?.startsWith('reverse-') === true
    if (reverseFace) view = view === 'reverse' ? undefined : view!.slice('reverse-'.length)
    let signaturePrint = segmentId === 'signature' && (view === 'print' || view?.startsWith('print-') === true)
    if (signaturePrint && view?.startsWith('print-')) view = view.slice('print-'.length)
    const costView = view === 'audit-cost' || view?.endsWith('-audit-cost') === true
    if (costView) view = view!.replace(/audit-cost$/, 'audit')
    const auditPageMatch = view?.match(/(?:^|-)audit-(page|row)-(\d+)$/)
    const auditPage = auditPageMatch ? (auditPageMatch[1] === 'page' ? (Number(auditPageMatch[2]) - 1) * 6 + 1 : Number(auditPageMatch[2])) : 1
    if (auditPageMatch) view = view!.replace(/audit-(page|row)-\d+$/, 'audit')
    const auditView = view === 'audit' || view?.endsWith('-audit') === true
    view = view?.replace(/-audit$/, '')
    const materialKinds: MaterialPairKind[] = ['gold', 'plaster', 'oak', 'limestone']
    const materialKind = segmentId === 'materials' ? materialKinds.find(kind => view === `material-${kind}`) ?? 'gold' : null
    const studyCentreX = 3
    if (materialKind) view = `material-${materialKind}`
    const scene = new Scene()
    scene.background = new Color('#caccc5')
    const camera = new PerspectiveCamera(40, innerWidth / innerHeight, .03, 100)
    const grade = { ...IDENTITY, name: 'picture-bench-neutral', ao: { intensity: .05, distance: .18, thickness: .15 } }
    stack.setScene(scene, camera, grade)
    let key: KeyLight = stack.light({ ...lightOptions, hdri: northSky ?? undefined })
    cleanup.push(() => key.dispose())
    key.fill.color.set('#d2dce1')
    key.fill.groundColor.set('#787363')
    key.fill.intensity = .55
    configurePictureKeyShadow(key)
    key.light.shadow.bias = -.00005
    key.light.shadow.normalBias = .002
    scene.environmentIntensity = .70
    const scopedStack = materials!.stack
    let roomGI: BenchGI | null = null
    const giTextureMB = (): number => roomGI?.textureMB() ?? 0
    scopedStack.cost = () => { const cost = stack.cost(); return { ...cost, textureMB: cost.textureMB + extraTextureMB() + giTextureMB() } }
    const completeHang = segmentId === 'complete-hang'
    const hang = buildHang(scopedStack, segmentWorks(segmentId), manifest, completeHang ? { gapM: 2.0 } : {})
    cleanup.push(() => hang.dispose())
    const special = segment.kind === 'murals' || segment.kind === 'drawer'
    // Room architecture and its light bake stay fixed when a reproduction is replaced.
    const roomConfiguration = roomConfigurations.segments.find(room => room.segment === (segmentId === 'signature' ? 'early' : segmentId === 'late' ? 'milan' : segmentId))!
    const room = buildPictureRoom(scopedStack, roomConfiguration.extent, { height: roomConfiguration.height, depth: roomConfiguration.depth })
    cleanup.push(() => room.dispose())
    // The signature stands near the window end, so the last station still
    // reads as a room: the reveal's stone and the corner hold its left edge.
    // Far enough along that the window's dark timber, the one thing in this
    // room darker than everything else, stays out of the frame rather than
    // standing in it as a cut bar.
    hang.wall.position.x = segmentId === 'signature' ? .36
      : Math.max(0, (roomConfiguration.extent - hang.extent) / 2)
    roomGI = getBenchGI(roomConfiguration.segment, room.group.userData['room'])
    cleanup.push(() => roomGI?.dispose())
    const plaster = room.group.getObjectByName('vinci/pictures/room/plaster')
    if (!(plaster instanceof Mesh) || !(plaster.material instanceof MeshStandardNodeMaterial)) throw new Error('Missing wall material for the verified diffuse bake')
    roomGI.apply(plaster.material)
    const materialPair = materialKind ? buildMaterialPair(scopedStack, materialKind) : null
    if (materialPair) {
      cleanup.push(() => materialPair.dispose())
      materialPair.group.position.x = studyCentreX
      scene.add(materialPair.group)
    }
    scene.add(room.group, hang.wall)
    scene.updateMatrixWorld(true)
    const shadowBounds = new Box3().setFromObject(room.group).expandByObject(hang.wall)
    let shadowFit = fitBenchKeyShadow(key, shadowBounds)
    let selected = hang.frames.find(f => f.work.id === workId) ?? (auditView && !costView ? hang.frames[auditPage - 1] : undefined) ?? hang.frames.find(f => f.work.id === segment.initialWorkId) ?? hang.frames[0]!
    let single = innerWidth < 700 || segment.workIds.length === 1 || view === 'inspect'
    // This inspection bench opens the commissioned reading card; L still
    // cycles the actual off / dots / card modes of the museum label grammar.
    let mode: 0 | 1 | 2 = 2
    let drawerOpen = false
    // The room's name is painted on the wall, at a size in centimetres, so the
    // frame carries three persistent marks and not five: the brand line, the
    // reading card and the rail. Everything else belongs to the room.
    const header = element('header', 'picture-wall-title')
    header.append(element('p', 'picture-kicker', 'CLOS LUCÉ · THE COLLECTION'))
    header.append(element('h1', '', 'The picture room, at true scale'))
    header.append(element('p', 'picture-segment-name', segment.title))
    const datum = element('button', 'picture-datum', '1.55 m · centre datum')
    datum.type = 'button'
    datum.onclick = () => {
      if (materialKind || datum.disabled) return
      view = host.dataset['reading'] === 'true' ? 'compare' : 'reading'
      label(); compose(); publishView()
    }
    const faceControl = element('button', 'picture-face-control', 'See the reverse')
    faceControl.type = 'button'
    faceControl.onclick = () => { reverseFace = !reverseFace; compose(); publishView() }
    const dock = element('div', 'picture-dock')
    dock.tabIndex = 0
    dock.setAttribute('role', 'region')
    dock.setAttribute('aria-label', 'Selected work label; scroll for the complete record')
    const scrollHint = element('p', 'picture-scroll-hint', 'More of the label below ↓')
    scrollHint.hidden = true
    const rail = element('nav', 'picture-rail')
    rail.setAttribute('aria-label', 'Picture bench segments and works')
    rail.dataset['naPersistent'] = ''
    const previous = element('button', 'picture-step', '←')
    previous.type = 'button'
    previous.setAttribute('aria-label', 'Previous work')
    const next = element('button', 'picture-step', '→')
    next.type = 'button'
    next.setAttribute('aria-label', 'Next work')
    const selector = element('select', 'picture-segment-select')
    selector.setAttribute('aria-label', 'Picture wall segment')
    for (const s of SEGMENTS) {
      const option = element('option', '', s.title)
      option.value = s.id
      selector.append(option)
    }
    selector.value = segmentId
    const count = element('span', 'picture-count')
    const sources = element('button', 'picture-sources', 'Sources')
    sources.type = 'button'
    sources.setAttribute('aria-expanded', 'false')
    rail.append(previous, count, next, selector, sources)
    const drawer = element('dialog', 'picture-drawer')
    drawer.hidden = true
    drawer.setAttribute('aria-label', 'Work record and reproduction sources')
    const close = element('button', 'picture-drawer-close', 'Close sources ×')
    close.type = 'button'
    const detail = element('div', 'picture-drawer-content')
    setRegister(detail, 'drawer')
    drawer.id = 'picture-source-drawer'
    sources.setAttribute('aria-controls', drawer.id)
    let catalogue: ReturnType<typeof createSourceCatalogue> | null = null
    cleanup.push(() => catalogue?.dispose())
    drawer.append(close, detail)
    const question = element('p', 'picture-question', 'Why did you leave so few paintings?')
    question.append(element('span', '', 'Warum hast du so wenige Gemälde hinterlassen?'))
    const evidence = createHangEvidencePanel({ page: auditPage, pageSize: 1, compact: !costView, download: true, onPageChange: page => { const frame = hang.frames[page - 1]; if (frame) choose(frame) } })
    const audit = evidence.root
    audit.classList.add('picture-audit')
    audit.dataset['costOnly'] = String(costView)
    audit.hidden = !auditView
    host.dataset['audit'] = String(auditView)
    const evidenceStyle = element('style', '')
    evidenceStyle.textContent = hangEvidencePanelCSS
    cleanup.push(() => evidence.dispose())
    const inspect = element('button', 'picture-inspect', 'Inspect')
    inspect.type = 'button'
    inspect.setAttribute('aria-label', 'Inspect the selected work')
    const viewing = element('div', 'picture-viewing')
    viewing.append(datum, inspect, faceControl)
    rail.insertBefore(viewing, sources)
    let controlsOn: 'wide' | 'narrow' | null = null
    let currentLanguageRow: HTMLElement | null = null
    /** The viewing controls are never a mark of their own: on the wide frame
     * they ride the rail, on the phone the card's own language row carries
     * all three, so the bar keeps three cells and the station name is whole. */
    function seatControls(mobile: boolean, languageRow: HTMLElement | null): void {
      const next = mobile ? 'narrow' : 'wide'
      if (controlsOn === next && (!mobile || datum.parentElement === languageRow)) return
      controlsOn = next
      if (mobile) {
        if (languageRow) languageRow.append(datum, faceControl, inspect)
      } else {
        viewing.append(datum, inspect, faceControl)
        if (viewing.parentElement !== rail) rail.insertBefore(viewing, sources)
      }
    }
    host.replaceChildren(header, hang.labels, dock, rail, drawer, audit, evidenceStyle)
    /** The card owns its own overflow notice: it is seated in the card, never
     * left standing on the floor beside it. */
    const dockContent = (...nodes: HTMLElement[]): void => { dock.replaceChildren(...nodes, scrollHint) }
    // The door's question is encountered deliberately with the work's sources.
    detail.append(question)
    const workshopNote = element('aside', 'picture-workshop-note')
    setRegister(workshopNote, 'drawer')
    workshopNote.append(element('p', '', 'Workshop picture. Verrocchio with Leonardo, whose small contribution is debated.'), element('p', '', 'Werkstattbild. Verrocchio mit Leonardo, dessen geringer Anteil umstritten ist.'))
    workshopNote.children[0]!.setAttribute('lang', 'en')
    workshopNote.children[1]!.setAttribute('lang', 'de')
    host.append(workshopNote)
    const repeatNote = element('aside', 'picture-repeat-note')
    setRegister(repeatNote, 'drawer')
    repeatNote.append(element('p', '', 'The Annunciation and the Cartoon hang here a second time, as the same works.'), element('p', '', 'Die Verkündigung und der Karton hängen hier ein zweites Mal, als dieselben Werke.'))
    repeatNote.children[1]!.setAttribute('lang', 'de')
    host.append(repeatNote)
    const pairCaptions = materialPair?.captions.map(caption => {
      const node = element('p', 'picture-material-caption', caption.text)
      host.append(node)
      return { node, point: new Vector3(caption.x + studyCentreX, caption.y, caption.z) }
    }) ?? []
    const pairDistance = element('p', 'picture-record')
    const readingRuler = createReadingRuler()
    host.append(readingRuler.root)

    /** The measured field of a print-only work stands empty wherever the wall
     * is composed. The print is reached by Inspect or by the print view. */
    function absentOnWall(): boolean {
      return hang.documentOnlyIds.has(selected.work.id) && !signaturePrint
        && view !== 'inspect' && view !== 'near' && view !== 'picture-room-near'
    }

    function label(): void {
      if (materialPair && materialKind) {
        const title = `${materialKind[0]!.toUpperCase()}${materialKind.slice(1)} · material study`
        const content = element('article', 'picture-material-label')
        content.append(element('h2', '', title), element('p', '', 'Left: stock library treatment. Right: the picture room’s production material. Equal geometry and one shared camera and light.'))
        content.append(element('p', 'picture-licence', 'Generated exhibition furniture with CC0 material inputs. The library preview’s camera and light settings were not supplied. This is a controlled local comparison.'))
        dockContent(content)
        count.textContent = `${materialKinds.indexOf(materialKind) + 1} / ${materialKinds.length}`
        detail.replaceChildren(element('h2', '', title), element('p', 'picture-source-note', 'The reference preview is not displayed or sampled. Both local specimens have identical geometry, UVs and camera distances. The right specimen borrows the actual production material. Gold changes only the principal leaf finish.'))
        const materialRecord = element('details', 'picture-material-record')
        materialRecord.open = recordOpen
        materialRecord.ontoggle = () => { recordOpen = materialRecord.open; publishView() }
        materialRecord.append(element('summary', '', 'Read the full material record / Materialnachweis lesen'))
        const materialChain = element('div', 'picture-material-chain')
        setRegister(materialChain, 'record')
        materialChain.append(pairDistance)
        materialRecord.append(materialChain)
        detail.append(materialRecord)
        const sourceSet = materialPair.group.userData['materialPair']['sourceSet'] as string
        for (const id of [sourceSet, 'vinci/pictures/material-pairs', 'vinci/pictures/bench-room', 'vinci/pictures/frame-gilding']) {
          const entry = manifest.byId.get(id)
          if (entry) {
            materialChain.append(element('p', 'picture-licence', `${entry.id} · ${entry.class}\n${entry.licence}`))
            if (entry.sha256) materialChain.append(element('p', 'picture-source-hash', `SHA-256 ${entry.sha256}`))
          }
        }
        return
      }
      const languageControls = element('div', 'picture-language-controls')
      languageControls.setAttribute('role', 'group')
      languageControls.setAttribute('aria-label', 'Label language / Sprache der Beschriftung')
      const languageButtons = (['en', 'de'] as const).map(language => {
        const button = element('button', '', language === 'en' ? 'English' : 'Deutsch')
        button.type = 'button'
        button.lang = language
        button.setAttribute('aria-pressed', String(labelLanguage === language))
        button.onclick = () => {
          labelLanguage = language
          dock.dataset['language'] = language
          dock.scrollTop = 0
          for (const control of languageButtons) control.setAttribute('aria-pressed', String(control.lang === language))
          compose(); publishView()
        }
        languageControls.append(button)
        return button
      })
      dock.dataset['language'] = labelLanguage
      const remarks: PictureBilingual[] = []
      // The wing admits where a photograph's own edges were never registered
      // against the object it reproduces.
      if (selected.work.height_cm !== null && selected.work.width_cm !== null
        && !absentOnWall() && selected.cards.some(card => {
          const window = pictureDisplayWindow(card.entry.plate)
          const uv = window ? pictureDisplayUV(window) : null
          // No pixel count, no claim: the mismatch is measured or not stated.
          const aspect = uv ? uv.contentAspect
            : card.entry.pixels ? card.entry.pixels.width / card.entry.pixels.height : null
          return aspect !== null && Math.abs(aspect / (selected.work.width_cm! / selected.work.height_cm!) - 1) > .01
        })) remarks.push({
          en: 'The reproduction keeps the proportions of the photograph. Its edges are not matched to the measured work.',
          de: 'Die Reproduktion behält die Proportionen der Vorlage. Ihre Ränder sind nicht auf das vermessene Werk eingepasst.',
        })
      if ((segmentId === 'absences' && ['annunciation', 'burlington-house-cartoon'].includes(selected.work.id))
        || (segmentId === 'late' && selected.work.id === 'virgin-and-child-with-st-anne')) remarks.push({
          en: 'Another view of the same work.', de: 'Eine weitere Ansicht desselben Werkes.',
        })
      const certaintyKey = createPictureCertaintyKey(true)
      certaintyKey.classList.add('picture-dock-key')
      currentLanguageRow = languageControls
      // The phone gives a label one screen, so it reads in two levels; the
      // desktop card shows both languages whole.
      const twoLevels = innerWidth < 700
      const card = absentOnWall() && selected.work.id === 'mona-lisa' ? createSignatureLabel(remarks, twoLevels)
        : createWorkLabel(selected.work, selected.cards.map(c => c.entry), false, remarks, twoLevels)
      dockContent(languageControls, certaintyKey, card)
      fitReadingLevels(card)
      if ((view === 'near' || view === 'picture-room-near') && selected.work.id === 'lady-with-an-ermine') {
        // Verbatim label fact from the locked mining catalogue, §12.
        dock.append(element('p', 'picture-near-history', "seized by German forces in 1939, taken to Berlin, then to Wawel Castle under Hans Frank, then to Breslau by 1941, and recovered from Frank's Bavarian house in 1946. On 29 December 2016 the Polish state bought the whole Czartoryski collection, this painting included, for 100 million euro."))
      }
      count.textContent = `${hang.frames.indexOf(selected) + 1} / ${hang.frames.length}`
      const record = createPictureRecord(selected.work, selected.cards.map(c => c.entry))
      const recordButton = element('button', 'picture-open-record', 'Read the full record / Vollständigen Nachweis lesen')
      recordButton.type = 'button'
      recordButton.setAttribute('aria-controls', record.id)
      recordButton.setAttribute('aria-expanded', String(recordOpen))
      record.hidden = !recordOpen
      recordButton.onclick = () => {
        recordOpen = !recordOpen
        record.hidden = !recordOpen
        recordButton.setAttribute('aria-expanded', String(recordOpen))
        publishView()
      }
      const introduction = element('div', 'picture-drawer-introduction')
      introduction.append(element('h2', '', selected.work.title_en))
      for (const language of ['en', 'de'] as const) {
        const paragraph = element('p', '', [visitorNote(selected.work, selected.cards.map(c => c.entry))[language],
          visitorSource(selected.cards.map(c => c.entry))[language]].join(' '))
        paragraph.lang = language
        introduction.append(paragraph)
      }
      detail.replaceChildren(introduction, recordButton, record)
      if (segmentId === 'signature') {
        const print = element('button', 'picture-open-print', 'View the historical print / Historischen Druck ansehen')
        print.type = 'button'
        print.onclick = () => { signaturePrint = true; view = 'print'; sourcesOpen(false); label(); compose(); publishView() }
        detail.insertBefore(print, recordButton)
        const frameStudy = element('button', 'picture-open-print', 'Study the moulding / Rahmenprofil ansehen')
        frameStudy.type = 'button'
        frameStudy.onclick = () => { view = 'moulding'; sourcesOpen(false); label(); compose(); publishView() }
        record.prepend(frameStudy)
      }
      const browseSources = element('button', 'picture-browse-sources', 'Browse all reproduction sources / Alle Bildquellen')
      browseSources.type = 'button'
      browseSources.onclick = () => showCatalogue(selected.cards[0]?.entry.plate.id)
      record.prepend(browseSources)
      const colourKey = element('details', 'picture-source-key')
      colourKey.append(element('summary', '', 'What the dots mean / Was die Punkte bedeuten'), createPictureCertaintyKey())
      detail.insertBefore(colourKey, recordButton)
      for (const card of selected.cards) {
        const source = element('details', 'picture-complete-source')
        source.append(element('summary', '', 'Complete source image / Vollständige Bildvorlage'))
        const sourceImage = element('img', 'picture-source-image')
        sourceImage.alt = `${selected.work.title_en} · complete source reproduction`
        sourceImage.loading = 'lazy'
        sourceImage.dataset['manifestId'] = card.entry.preview.id
        source.ontoggle = () => { if (source.open && !sourceImage.hasAttribute('src')) sourceImage.src = `${ASSET_BASE}${card.entry.preview.wing}/${card.entry.preview.path}` }
        const window = pictureDisplayWindow(card.entry.plate)
        source.append(sourceImage)
        if (window?.approvedForDisplayCrop) source.append(element('p', 'picture-source-note', window.note))
        record.append(source)
      }
      record.append(element('p', 'picture-furniture-note', 'Reconstructed exhibition furniture. The gilded mouldings, mounts and gallery are generated museum dressing, not the holder’s historic frame.'))
      record.append(element('p', 'picture-furniture-note', 'The measured field records the object. Selected source surrounds are omitted without changing the picture’s proportions. Complete sources remain available above; their painted edges have not been authenticated against the measured field.'))
      for (const id of ['vinci/pictures/frame-gilding', 'vinci/pictures/bench-room', 'vinci/pictures/mats']) {
        const e = manifest.byId.get(id)
        if (e) record.append(element('p', 'picture-licence', `${e.id} · ${e.class}\n${e.licence}`))
      }
    }
    /** Two levels only where one screen is not enough. The card is measured
     * rather than guessed, and it is measured in German, which runs longest:
     * a label that folds in one language folds in both, so the two tabs never
     * disagree about how much of it a visitor can see. */
    function fitReadingLevels(card: HTMLElement): void {
      const levels = readingLevels(card)
      if (!levels.length) return
      for (const level of levels) { level.rest.hidden = false; level.control.hidden = true }
      const shown = dock.dataset['language']
      dock.dataset['language'] = 'de'
      const overflows = dock.scrollHeight > dock.clientHeight + 2
      if (shown) dock.dataset['language'] = shown
      if (!overflows) return
      // The control still carries the wording and the state it was built
      // with; only its visibility was borrowed for the measurement.
      for (const level of levels) { level.rest.hidden = true; level.control.hidden = false }
    }
    function compose(): void {
      readingRuler.root.hidden = true
      const mobile = innerWidth < 700
      header.querySelector('.picture-segment-name')!.textContent = view === 'moulding' ? 'Reconstructed exhibition moulding' : segment.title
      if (materialPair && materialKind) {
        faceControl.hidden = true
        single = true
        camera.aspect = innerWidth / innerHeight
        camera.fov = 40
        const tan = Math.tan(camera.fov * Math.PI / 360)
        const distance = Math.max(3.92, 2.9 / (2 * tan * camera.aspect), 1.2 * innerHeight / (2 * tan * (mobile ? 224 : 360)))
        camera.position.set(studyCentreX, 1.55, distance + .08)
        camera.rotation.set(0, 0, 0)
        camera.setViewOffset(innerWidth, innerHeight, 0, innerHeight * (mobile ? .10 : .08), innerWidth, innerHeight)
        camera.updateProjectionMatrix(); camera.updateMatrixWorld()
        hang.setVisible([], true)
        for (const caption of pairCaptions) {
          const projected = caption.point.clone().project(camera)
          caption.node.style.left = `${(projected.x + 1) * innerWidth / 2}px`
          caption.node.style.top = `${(1 - projected.y) * innerHeight / 2}px`
        }
        const centreDistance = Math.hypot(distance, .7)
        pairDistance.textContent = `Both centres ${centreDistance.toFixed(3)} m from the camera · 40° vertical field · 6,800 K north light`
        inspect.textContent = 'Next material'
        inspect.setAttribute('aria-label', 'Compare the next furniture material')
        inspect.setAttribute('aria-pressed', 'false')
        datum.textContent = 'Equal geometry · shared light'
        datum.disabled = true
        datum.setAttribute('aria-label', 'Equal specimen geometry, camera distance and shared light')
        host.dataset['reading'] = 'false'
        host.dataset['single'] = 'true'; host.dataset['segment'] = segmentId
        header.hidden = true
        return
      }
      if ((view === 'near' || view === 'picture-room-near') && selected.work.id !== 'lady-with-an-ermine') view = 'inspect'
      const near = view === 'near' || view === 'picture-room-near'
      single = mobile || completeHang || segment.kind === 'murals' || segment.kind === 'drawer' || segment.workIds.length === 1 || view === 'inspect' || near
      const inspecting = view === 'inspect' || near
      const cardsOnly = inspecting && selected.cards.length > 0
      // Opening a document is deliberate; the wall never stands in for the work.
      const revealed = (inspecting || signaturePrint) && hang.documentOnlyIds.has(selected.work.id) ? [selected.work.id] : []
      hang.setAbsent([], revealed)
      for (const frame of hang.frames) {
        if (!hang.documentOnlyIds.has(frame.work.id)) continue
        const shown = revealed.includes(frame.work.id)
        frame.caption.replaceChildren(element('span', 'picture-mat-state', labelLanguage === 'de' ? 'Nicht gezeigt' : 'Absent'),
          element('span', 'picture-mat-size', `${frame.work.height_cm} × ${frame.work.width_cm} cm`),
          element('span', 'picture-mat-holder', frame.work.holder))
        if (shown) frame.dot.setAttribute('aria-label', labelLanguage === 'de'
          ? 'Historischer Druck. Erscheinungsdatum ungewiss.' : 'Historical print. Publication date uncertain.')
      }
      const reading = !inspecting && view !== 'compare' && (mobile || segmentId === 'signature' || view === 'reading')
      const face = reading && mobile && selected.cards.some(c => c.entry.face === 'reverse') ? { workId: selected.work.id, reverse: reverseFace } : undefined
      faceControl.hidden = !face
      faceControl.textContent = reverseFace ? 'See the front' : 'See the reverse'
      const faceX = face?.reverse ? selected.cards.find(c => c.entry.face === 'reverse')!.mesh.position.x : selected.x
      camera.aspect = innerWidth / innerHeight
      camera.fov = 40
      const cardWidth = (i: number): number => (selected.cards[i]!.mesh.geometry as PlaneGeometry).parameters.width
      const left = face ? faceX - selected.width / 2 : cardsOnly ? selected.cards[0]!.mesh.position.x - cardWidth(0) / 2 : single ? selected.left : 0
      const last = selected.cards.length - 1
      const right = face ? faceX + selected.width / 2 : cardsOnly ? selected.cards[last]!.mesh.position.x + cardWidth(last) / 2 : single ? selected.right : hang.extent
      const tallest = cardsOnly ? Math.max(...selected.cards.map(c => (c.mesh.geometry as PlaneGeometry).parameters.height)) : single ? selected.height : Math.max(...hang.frames.map(f => f.height))
      const center = (left + right) / 2
      const tan = Math.tan(camera.fov * Math.PI / 360)
      const width = (right - left) + (inspecting ? .14 : mobile ? .28 : 1.4)
      // At the full room's near pose, leave the entire 44px anchor target
      // above the phone reading dock, including the tallest empty outline.
      const artworkSpace = mobile ? completeHang ? 210 : 224 : special || completeHang ? 360 : 460
      let distance = Math.max(width / (2 * tan * camera.aspect), (tallest + .14) * innerHeight / (2 * tan * artworkSpace))
      if (!inspecting && !reading) {
        // One image scale per viewport across the entire panel register. No
        // selected picture can become larger merely because it is smaller.
        const pxPerCm = Math.min(mobile ? 1.08 : 1.50, (innerWidth - (mobile ? 48 : 100)) / (mobile ? 265 : 850), (innerHeight * .36) / 265)
        distance = innerHeight / (2 * tan * pxPerCm * 100)
        // The 8.8m mural needs its separately declared architectural view.
        if (segment.kind === 'murals') distance = Math.max(distance, width / (2 * tan * camera.aspect), (tallest + .14) * innerHeight / (2 * tan * artworkSpace))
      }
      if (reading) {
        // The phone is the viewer, not the fallback: the work takes the band
        // the masthead gave back when the room's name left the top of the frame.
        const targetHeight = innerHeight * (mobile ? innerHeight < 650 ? .235 : .255 : .39)
        // The frame's own outer size, not a constant: the mount is cut to
        // the work, so a two-metre altarpiece carries more board than a panel.
        const surround = 2 * selected.surround
        distance = Math.max((right - left + surround + .056) / (2 * tan * camera.aspect),
          (tallest + surround) * innerHeight / (2 * tan * (targetHeight + 20)))
      }
      if (near) {
        distance = .45
        // The declared physical pose is fixed; each viewport earns the FOV
        // that keeps the full source and its reading card clear of one another.
        camera.fov = 2 * Math.atan(Math.max(width / (2 * distance * camera.aspect), (tallest + .14) * innerHeight / (2 * distance * artworkSpace))) * 180 / Math.PI
      }
      camera.position.set(center + hang.wall.position.x, single ? selected.y : 1.55, distance + (near ? .023 : .021))
      camera.rotation.set(0, 0, 0)
      // The phone's stage is lifted so the reading band below it can hold a
      // whole label; the signature stands alone and keeps its centred seat.
      const phoneLift = innerHeight < 650 ? .15 : segmentId === 'signature' ? .125 : .175
      camera.setViewOffset(innerWidth, innerHeight, 0, innerHeight * (mobile ? phoneLift : special || completeHang ? .08 : .13), innerWidth, innerHeight)
      if (view === 'boards') {
        // The boards where feet pass, from a visitor's own eye: the only pose
        // in this bench that looks at the floor rather than at the wall.
        camera.clearViewOffset()
        camera.position.set(hang.wall.position.x + 2.2, 1.55, 3.4)
        camera.rotation.set(-.62, 0, 0)
      }
      if (view === 'lettering') {
        // The painted room name at arm's length: the declared pose is the
        // lettering's own seat, not a picture's.
        camera.clearViewOffset()
        const crown = Math.max(2.95, 1.55 + Math.max(...hang.frames.map(f => f.height)) / 2 + .22)
        camera.position.set(hang.wall.position.x + .95, crown - .37, 2.60)
      }
      if (view === 'moulding') {
        camera.clearViewOffset()
        camera.position.set(selected.x + hang.wall.position.x + selected.width / 2 + .015, selected.y + selected.height / 2 + .015, 1.15)
        camera.setViewOffset(innerWidth, innerHeight, 0, innerHeight * .10, innerWidth, innerHeight)
      }
      camera.updateProjectionMatrix()
      camera.updateMatrixWorld()
      // One work on a phone. Hidden neighbours remain mounted at their exact
      // positions, and return instantly when the visitor advances.
      hang.setVisible(completeHang && !inspecting ? undefined : single ? [selected.work.id] : undefined, cardsOnly, face)
      const offerNear = view === 'inspect' && selected.work.id === 'lady-with-an-ermine'
      inspect.textContent = offerNear ? '45 cm' : inspecting ? 'Wall' : 'Inspect'
      inspect.setAttribute('aria-label', offerNear ? 'View Lady with an Ermine from 45 centimetres' : inspecting ? 'Return to the measured wall' : 'Inspect the selected work')
      inspect.setAttribute('aria-pressed', String(inspecting))
      datum.textContent = near ? '45 cm · source detail' : cardsOnly ? 'Source detail · measured field hidden' : selected.work.hang.eye_height_cm === null ? (selected.aperture ? 'Measured field · modern display height' : selected.cards.length ? 'Source document · painted extent unknown' : 'Catalogue display · no measured image field') : '1.55 m · centre datum'
      if (reading) datum.textContent = 'Reading view · Compare sizes'
      else if (!inspecting) datum.textContent = 'Common scale · Read closer'
      if (view === 'moulding') datum.textContent = 'Moulding study · Compare sizes'
      datum.disabled = inspecting || !!materialKind
      datum.setAttribute('aria-label', reading ? 'Reading view. Compare the pictures at one common scale' : 'Common scale. Open the closer reading view')
      readingRuler.root.hidden = inspecting || !mobile || segmentId === 'signature' || view === 'moulding' || selected.work.height_cm === null
      if (!readingRuler.root.hidden) readingRuler.update(camera, {
        x: faceX + hang.wall.position.x, y: selected.y, z: selected.aperture?.getWorldPosition(new Vector3()).z ?? .021,
        width: selected.width + 2 * selected.surround, height: selected.height,
      }, { width: innerWidth, height: innerHeight })
      host.dataset['reading'] = String(reading)
      host.dataset['single'] = String(single)
      host.dataset['segment'] = segmentId
      // The phone row holds the action, the full sentence stays in the label.
      if (mobile && datum.textContent?.includes(' · ')) datum.textContent = datum.textContent.split(' · ')[1]!
    }
    /** The title is painted on the wall, so its size is the wall's size: one
     * em is one metre of the room and the lettering sits a hand's width above
     * the tallest work. Off the wall, or too small to read, it is not drawn. */
    function placeWallTitle(hidden: boolean): void {
      header.hidden = false
      // The phone stands close to one picture, where lettering painted at
      // 2.95 m is out of frame. There the room's name rides with the brand as
      // one masthead rather than pretending to be on the wall.
      const narrow = innerWidth < 700
      header.classList.toggle('picture-title-band', narrow)
      if (narrow) {
        header.style.left = ''
        header.style.top = ''
        header.style.removeProperty('--wall-em')
        header.hidden = hidden
        return
      }
      // The room's corner is the page's own left edge at this camera, so the
      // name starts at the page margin the card and the bar keep, and it does
      // not slide across the wall when a different work is selected.
      const anchorX = hang.wall.position.x + (single ? selected.left : 0)
      // One height for the whole room: the lettering is painted at 2.95 m, or
      // higher where a work reaches that far, and it does not move when the
      // visitor steps up to one picture.
      const crown = Math.max(2.95, 1.55 + Math.max(...hang.frames.map(f => f.height)) / 2 + .22)
      const base = new Vector3(anchorX, crown, 0).project(camera)
      const metre = new Vector3(anchorX, crown + 1, 0).project(camera)
      const perMetre = (metre.y - base.y) * innerHeight / 2
      header.style.setProperty('--wall-em', `${perMetre.toFixed(2)}px`)
      // The paint's own material is sub-pixel at the wall's camera and the
      // whole of it at arm's length, so it comes in with the lettering's size.
      const paint = Math.min(1, Math.max(0, (perMetre - 210) / 250))
      header.style.setProperty('--wall-paint', paint.toFixed(3))
      header.classList.toggle('picture-paint-near', paint > 0)
      const seat = (1 - base.y) * innerHeight / 2
      const block = header.offsetHeight
      const top = Math.round(seat - block)
      const room = innerWidth - header.offsetWidth - 18
      header.style.left = `${Math.round(Math.min(46, Math.max(18, room)))}px`
      header.style.top = `${top}px`
      // The lettering study stands at the painted name itself, so the cutoff
      // that keeps it out of a picture's close view does not apply there.
      header.hidden = hidden || perMetre < 46 || (perMetre > 400 && view !== 'lettering') || top < 58
        || top + block > innerHeight * .55
    }
    function currentView(): string | undefined {
      if (catalogue) return `catalogue:${catalogue.selected()}`
      const cameraView = view === 'audit' || view === 'sources' || view === 'print' ? undefined : view
      const evidenceView = auditView ? costView ? 'audit-cost' : `audit-row-${evidence.page()}` : undefined
      const composed = [labelLanguage === 'de' ? 'german' : undefined, reverseFace ? 'reverse' : undefined,
        signaturePrint ? 'print' : undefined, cameraView, evidenceView].filter(Boolean).join('-') || undefined
      return drawerOpen ? [composed, recordOpen ? 'record' : 'sources'].filter(Boolean).join('-') : composed
    }
    function publishView(): void {
      if (!mounted) return
      history.replaceState({}, '', benchURL(segmentId, selected.work.id, currentView()))
    }
    function choose(frame: HungFrame): void {
      catalogue?.dispose(); catalogue = null; drawer.classList.remove('picture-catalogue-open')
      if (selected !== frame) reverseFace = false
      selected = frame
      label()
      compose()
      publishView()
    }
    function step(direction: number): void {
      if (materialKind) {
        const nextKind = materialKinds[(materialKinds.indexOf(materialKind) + direction + materialKinds.length) % materialKinds.length]!
        void open(segmentId, { view: `material-${nextKind}` })
        return
      }
      const i = hang.frames.indexOf(selected) + direction
      if (i >= 0 && i < hang.frames.length) choose(hang.frames[i]!)
      else {
        const at = SEGMENTS.findIndex(s => s.id === segmentId)
        const other = SEGMENTS[(at + direction + SEGMENTS.length) % SEGMENTS.length]!
        void open(other.id, { work: direction > 0 ? other.workIds[0] : other.workIds[other.workIds.length - 1], history: 'push' })
      }
    }
    function showCatalogue(id?: string): void {
      catalogue?.dispose()
      catalogue = createSourceCatalogue(manifest, { selectedId: id, onClose: () => {
        catalogue?.dispose(); catalogue = null; drawer.classList.remove('picture-catalogue-open'); label(); close.focus(); publishView()
      } })
      drawer.classList.add('picture-catalogue-open')
      setRegister(catalogue.root, 'record')
      detail.replaceChildren(catalogue.root)
      drawer.scrollTop = 0
      publishView()
    }
    function sourcesOpen(value: boolean): void {
      drawerOpen = value
      sources.setAttribute('aria-expanded', String(value))
      if (value) { drawer.hidden = false; drawer.showModal(); close.focus() }
      else { if (view === 'sources') view = undefined; catalogue?.dispose(); catalogue = null; drawer.classList.remove('picture-catalogue-open'); drawer.close(); drawer.hidden = true; label(); sources.focus() }
      publishView()
    }
    drawer.oncancel = event => { event.preventDefault(); sourcesOpen(false) }
    previous.onclick = () => step(-1)
    next.onclick = () => step(1)
    selector.onchange = () => { void open(selector.value, { history: 'push' }) }
    sources.onclick = () => sourcesOpen(!drawerOpen)
    close.onclick = () => sourcesOpen(false)
    inspect.onclick = () => {
      if (materialKind) { step(1); return }
      view = view === 'inspect' && selected.work.id === 'lady-with-an-ermine' ? 'near' : view === 'inspect' || view === 'near' || view === 'picture-room-near' ? undefined : 'inspect'
      label(); compose(); publishView()
    }
    for (const frame of hang.frames) frame.dot.onclick = () => { choose(frame); mode = 2 }
    label()
    compose()
    if (sourceView) sourcesOpen(true)
    if (catalogueId) showCatalogue(catalogueId)
    let lastAudit = 0
    let updates = 0
    const api = {
      segmentId, camera, hang, step, choose, compose, giTextureMB,
      view: currentView,
      sourcePending: () => catalogue?.measure().imagesPending ?? 0,
      sourcesVisible: () => drawerOpen,
      key(event: KeyboardEvent) {
        if (drawerOpen && event.key !== 'Escape') return
        if (event.key === 'Escape') { if (drawerOpen) sourcesOpen(false); else { mode = 1; view = undefined; label(); compose(); publishView() } }
        else if (event.key.toLowerCase() === 'l') { mode = ((mode + 1) % 3) as 0 | 1 | 2 }
        else if (event.key === 'ArrowRight' || event.key === 'PageDown') step(1)
        else if (event.key === 'ArrowLeft' || event.key === 'PageUp') step(-1)
      },
      update(dt: number) {
        updates++
        // The DOM that belongs to the room (its painted name, the viewing
        // controls' seat) is placed here, so the camera function stays a
        // camera function and the offline checks can still run it alone.
        const narrow = innerWidth < 700
        seatControls(narrow, currentLanguageRow)
        placeWallTitle(auditView || view === 'moulding' || !!materialKind || mode === 0
          || view === 'inspect' || view === 'near' || view === 'picture-room-near')
        // The note belongs to one picture, so it hangs from that picture's own
        // mark and never floats free over the floor.
        const noted = hang.frames.find(frame => frame.work.id === 'baptism-of-christ')
        workshopNote.hidden = segmentId !== 'early' || single || auditView || mode === 0 || !noted || noted.dot.hidden
        if (noted && !workshopNote.hidden) {
          // The note is a plaque on the wall beside its picture, so it keeps
          // clear of the stone and never crosses the wall's own floor line.
          const markTop = parseFloat(noted.dot.style.top)
          const mark = parseFloat(noted.dot.style.left)
          const middle = markTop + 22
          const stone = (1 - new Vector3(0, .112, 0).project(camera).y) * innerHeight / 2
          const ceiling = Math.min(stone - 12, (dock.hidden ? innerHeight : dock.getBoundingClientRect().top) - 14)
          const width = workshopNote.offsetWidth, height = workshopNote.offsetHeight
          const top = Math.max(58, Math.min(middle - height / 2, ceiling - height))
          const own = { left: hang.wall.position.x + noted.x - noted.width / 2, right: hang.wall.position.x + noted.x + noted.width / 2 }
          const ownLeft = (new Vector3(own.left, noted.y, 0).project(camera).x + 1) * innerWidth / 2
          const ownRight = (new Vector3(own.right, noted.y, 0).project(camera).x + 1) * innerWidth / 2
          const beside = Math.max(mark + 26, ownRight + 18)
          const before = Math.min(mark - 26, ownLeft - 18) - width
          const side = beside + width <= innerWidth - 24 ? 'right' : before >= 24 ? 'left' : null
          // A plaque never lies over a picture: the band it takes is the band
          // below whatever hangs above it.
          const span = side === 'left' ? [before, before + width] : [beside, beside + width]
          const clear = (candidate: number): number => {
            let seat = candidate
            for (const f of hang.frames) {
              if (f.dot.hidden && f !== selected) continue
              const x = hang.wall.position.x + f.x, half = f.width / 2, tall = f.height / 2
              const a = new Vector3(x - half, f.y - tall, 0).project(camera)
              const b = new Vector3(x + half, f.y + tall, 0).project(camera)
              const l = (a.x + 1) * innerWidth / 2, r = (b.x + 1) * innerWidth / 2
              const bottom = (1 - a.y) * innerHeight / 2
              if (r < span[0]! - 10 || l > span[1]! + 10) continue
              if (bottom + 19 > seat && (1 - b.y) * innerHeight / 2 < seat + height) seat = bottom + 19
            }
            return seat
          }
          const under = Math.min(markTop + 44 + 22, ceiling - height)
          workshopNote.dataset['leader'] = side ?? 'under'
          if (side) {
            const seat = clear(top)
            workshopNote.style.left = `${Math.round(side === 'right' ? beside : before)}px`
            workshopNote.style.top = `${Math.round(seat)}px`
            workshopNote.style.setProperty('--leader', '26px')
            workshopNote.style.setProperty('--leader-y', `${Math.round(Math.min(Math.max(middle - seat, 10), height - 10))}px`)
            workshopNote.hidden = seat + height > ceiling
          } else {
            const half = width / 2
            const left = Math.max(16 + half, Math.min(innerWidth - 16 - half, mark))
            workshopNote.style.left = `${Math.round(left - half)}px`
            workshopNote.style.top = `${Math.round(under)}px`
            workshopNote.style.setProperty('--leader', `${Math.round(under - markTop - 44)}px`)
            workshopNote.style.setProperty('--leader-x', `${Math.round(mark - left + half)}px`)
            workshopNote.hidden = under < markTop + 52 || under + height > ceiling
          }
        }
        // The card ends where the work's own mark ends: the whole 44 px target
        // stays on the wall, whatever the work's height did to the composition.
        if (innerWidth < 700 && !dock.hidden && !selected.dot.hidden && selected.dot.style.top) {
          const foot = parseFloat(selected.dot.style.top) + 44 + 9
          const base = parseFloat(getComputedStyle(dock).bottom) || 91
          dock.style.maxHeight = `${Math.max(150, Math.round(innerHeight - base - foot))}px`
        } else dock.style.maxHeight = ''
        readingRuler.root.hidden = innerWidth >= 700 || host.dataset['single'] !== 'true' || segmentId === 'signature' || view === 'moulding' || selected.work.height_cm === null || auditView || mode === 0 || view === 'inspect' || view === 'near' || view === 'picture-room-near'
        repeatNote.hidden = segmentId !== 'absences' || single || auditView || mode === 0
        if (!repeatNote.hidden) {
          // The chapter's wall text belongs under the room's own lettering.
          const seat = header.hidden ? null : header.getBoundingClientRect()
          repeatNote.style.left = `${Math.round(seat ? seat.left : 46)}px`
          repeatNote.style.top = `${Math.round(seat ? seat.bottom + 16 : 206)}px`
        }
        hang.stream(stack.tierName())
        hang.update(camera, dt, selected.work.id)
        dock.hidden = auditView || view === 'moulding' || mode !== 2
        scrollHint.hidden = auditView || view === 'moulding' || mode !== 2 || dock.scrollTop + dock.clientHeight >= dock.scrollHeight - 20
        for (const f of hang.frames) {
          if (view === 'moulding' || materialPair || single && f !== selected) { f.dot.hidden = true; f.caption.hidden = true }
          else if (mode === 0) f.dot.hidden = true
        }
        if (!audit.hidden && performance.now() - lastAudit > 500) {
          lastAudit = performance.now()
          evidence.update(api.measure())
        }
      },
      measure() {
        const c = stack.cost()
        const labels = readLabels()
        const targets = labels.filter(l => l.targetPx !== null).map(l => l.targetPx!)
        scene.updateMatrixWorld(true)
        return {
          kind: 'pictures', segment: segmentId, selected: selected.work.id, viewport: { width: innerWidth, height: innerHeight },
          camera: { position: camera.position.toArray(), fov: camera.fov, lookCone: null, view: view ?? (host.dataset['reading'] === 'true' ? 'reading' : 'wall'), face: reverseFace ? 'reverse' : 'front', selectedPlateDistanceM: selected.cards[0] ? camera.position.distanceTo(selected.cards[0].mesh.getWorldPosition(new Vector3())) : null },
          room: room.group.userData['room'],
          sourceCatalogue: catalogue?.measure() ?? null,
          shadowFit,
          shadowFilter: PICTURE_SHADOW_FILTER_RECIPE,
          diffuseGI: { ready: true, ...roomGI!.debug },
          materialPair: materialPair ? { ...materialPair.group.userData['materialPair'], camera: camera.position.toArray(), fov: camera.fov, light: lightOptions, centreDistancesM: [-.7,.7].map(x => camera.position.distanceTo(new Vector3(x + studyCentreX, 1.55, .08))) } : null,
          works: hang.frames.map(f => ({ id: f.work.id, title: f.work.title_en, class: f.work.rights_class, displayMode: f.work.display_mode, exhibited: f.aperture?.visible ?? false,
            measurement: f.aperture ? measureProjectedWork(f.work, camera, f.aperture.geometry, f.aperture.matrixWorld, { width: innerWidth, height: innerHeight }) : null,
            plates: f.cards.map(p => ({ id: p.entry.plate.id, exhibited: p.mesh.visible, class: p.entry.plate.class, path: p.entry.plate.path, licence: p.entry.plate.licence, measurement: measureProjectedWork(f.work, camera, p.mesh.geometry, p.mesh.matrixWorld, { width: innerWidth, height: innerHeight }), fit: f.work.height_cm === null ? 'Unmeasured documentary carrier; no physical painting scale asserted' : pictureDisplayWindow(p.entry.plate)?.approvedForDisplayCrop ? 'Conservative source display window; aspect preserved; physical registration unestablished' : 'Complete raster contained within measured extent; no stretch', sourceWindow: pictureDisplayWindow(p.entry.plate), sourceRegistration: pictureDisplayWindow(p.entry.plate) ? assessPictureDisplayWindow(pictureDisplayWindow(p.entry.plate)!, f.work) : null, residency: p.stream.residency(), allocation: p.stream.allocation() })) })),
          cost: { ...c, textureMB: c.textureMB + extraTextureMB() + giTextureMB() + hang.textureMB(), plateTextureMB: hang.textureMB(), privateMaterialMB: materials?.textureMB(), probeTextureMB: probeMB(), diffuseGIMB: giTextureMB() },
          contactBake: hang.contactStats,
          auditReady: updates >= 120 && c.frames >= 120,
          labelAudit: { smallestTargetPx: targets.length ? Math.min(...targets) : null, persistentMarks: labels.filter(l => l.persistent).length, brandLines: labels.filter(l => l.brand).length },
          texturesPending: hang.pending() + (catalogue?.measure().imagesPending ?? 0) + stack.materials.pending() + (materials?.pending() ?? 0), errors: [...hang.errors(), ...(materials?.errors() ?? []), ...(catalogue?.measure().errors ?? [])],
        }
      },
      relight() {
        key.dispose()
        key = stack.light({ ...lightOptions, hdri: northSky ?? undefined })
        key.fill.color.set('#d2dce1'); key.fill.groundColor.set('#787363'); key.fill.intensity = .55
        configurePictureKeyShadow(key)
        key.light.shadow.bias = -.00005
        key.light.shadow.normalBias = .002
        shadowFit = fitBenchKeyShadow(key, shadowBounds)
      },
      dispose() { catalogue?.dispose(); evidence.dispose(); if (drawer.open) drawer.close(); hang.dispose(); materialPair?.dispose(); roomGI?.dispose(); room.dispose(); key.dispose(); host.replaceChildren() },
    }
    mounted = true
    return api
    } catch (error) {
      for (const dispose of cleanup.reverse()) dispose()
      throw error
    }
  }

  async function open(segmentId: string, opts: BenchOptions = {}): Promise<void> {
    /* this bench answers its own address and the host opens it by the same
       address, so one arrival asks for the same state twice. A repeat of
       what is already standing, at the tier it is dressed for, is not a
       remount; anything else is. */
    const asked = `${segmentId}|${opts.work ?? ''}|${opts.view ?? ''}|${stack.tierName()}`
    if (asked === standing && active && !loading) return
    standing = asked
    const token = ++generation
    loading = true
    failure = null
    ownsBench = true
    document.body.dataset['bench'] = 'pictures'
    document.body.dataset['forge'] = 'pending'
    host.hidden = false
    try {
      const segment = getSegment(segmentId)

      if (opts.work && !segment.workIds.includes(opts.work)) throw new Error(`Work is not in segment: ${opts.work}`)
      if (!materials || materialTier !== stack.tierName()) {
        active?.dispose()
        active = null
        materials?.dispose()
        materials = createBenchMaterialBudget(stack)
        materialTier = stack.tierName()
      }
      const scope = materials
      await Promise.all([scope.prepare(), stack.hdri('sky-overcast').then(sky => {
        if (token !== generation) return
        benchProbe ??= createBenchProbe(sky)
        northSky = benchProbe.probe
      })])
      if (token !== generation) return
      const previous = active
      active = null
      previous?.dispose()
      active = mount(segmentId, opts.work, opts.view)
      history[opts['history'] === 'push' ? 'pushState' : 'replaceState']({}, '', benchURL(segmentId, active.measure().selected, active.view()))
      document.body.dataset['phase'] = 'bench'
      document.body.dataset['forge'] = 'bench'
    } catch (err) {
      if (token !== generation) return
      active?.dispose()
      active = null
      materials?.dispose()
      materials = null
      materialTier = null
      failure = String(err)
      standing = null
      document.body.dataset['forge'] = 'bench-error'
      host.replaceChildren(element('p', 'picture-load-error', `The picture bench could not load. ${failure}`))
    } finally { if (token === generation) loading = false }
  }
  function leave(): void {
    ++generation
    ownsBench = false
    standing = null
    loading = false
    active?.dispose()
    active = null
    materials?.dispose()
    materials = null
    materialTier = null
    host.hidden = true
    delete document.body.dataset['bench']
  }
  let lastWheel = 0, touchStart = 0
  addEventListener('wheel', e => {
    if (!ownsBench) return
    e.stopImmediatePropagation()
    if (!active) return
    if (active.sourcesVisible()) return
    if ((e.target as Element).closest('.picture-drawer,.picture-dock,.picture-audit')) return
    e.preventDefault()
    if (Math.abs(e.deltaY) < 10 || performance.now() - lastWheel < 600) return
    lastWheel = performance.now()
    active.step(Math.sign(e.deltaY))
  }, { capture: true, passive: false })
  addEventListener('keydown', e => {
    if (!ownsBench) return
    e.stopImmediatePropagation()
    if (!active) return
    if (active.sourcesVisible() && e.key !== 'Escape') return
    if ((e.target as Element).matches('input,select,textarea')) return
    if ((e.target as Element).closest('.picture-drawer,.picture-dock,.picture-audit') && ['PageUp','PageDown','ArrowUp','ArrowDown',' '].includes(e.key)) return
    if (['Escape', 'ArrowRight', 'ArrowLeft', 'PageDown', 'PageUp', 'l', 'L'].includes(e.key)) { e.preventDefault(); e.stopImmediatePropagation(); active.key(e) }
  }, true)
  addEventListener('touchstart', e => {
    if (!ownsBench) return
    e.stopImmediatePropagation()
    if (!active) return
    if ((e.target as Element).closest('button,select,a,.picture-drawer,.picture-dock,.picture-audit')) { touchStart = NaN; return }
    touchStart = e.touches[0]?.clientX ?? 0
    e.stopImmediatePropagation()
  }, { capture: true, passive: true })
  addEventListener('touchmove', e => { if (ownsBench) e.stopImmediatePropagation() }, { capture: true, passive: true })
  addEventListener('touchend', e => {
    if (!ownsBench) return
    e.stopImmediatePropagation()
    if (!active) return
    if (!Number.isFinite(touchStart) || (e.target as Element).closest('button,select,a,.picture-drawer,.picture-dock,.picture-audit')) return
    const delta = (e.changedTouches[0]?.clientX ?? touchStart) - touchStart
    if (Math.abs(delta) > 45) active.step(delta < 0 ? 1 : -1)
  }, { capture: true, passive: true })
  addEventListener('resize', () => active?.compose())
  addEventListener('popstate', e => {
    const segment = route()
    if (segment) { e.stopImmediatePropagation(); void open(segment.segment!, segment) }
    else if (ownsBench) { leave(); onLobby() }
  }, true)
  const initial = route()
  if (initial) await open(initial.segment!, initial)
  return {
    async open(opts) {
      const want = pictureOptions(opts)
      const here = route()
      const segmentId = want.segment ?? here?.segment ?? 'early'
      /* the work and the view live in the address's own hash, which the
         host's options do not carry: a link and the back button restore
         them, a jump that names them overrides them */
      if (here?.segment === segmentId) {
        want.work ??= here.work
        want.view ??= here.view
      }
      await open(segmentId, want)
    },
    close: leave,
    frame(dt) {
      active?.update(dt)
      stack.render(dt)
    },
    reading: () => ({
      station: Math.max(0, SEGMENTS.findIndex(s => s.id === active?.segmentId)),
      stations: SEGMENTS.length,
      stationId: active?.segmentId ?? '',
      stationIds: SEGMENTS.map(s => s.id),
      texturesPending: (loading ? 1 : 0) + stack.materials.pending() + (materials?.pending() ?? 0)
        + (active?.hang.pending() ?? 0) + (active?.sourcePending() ?? 0),
    }),
    manifest: () => (active
      ? manifest.all.filter(e => e.id.startsWith('vinci/pictures/') || e.id.startsWith('library/')
        || active!.hang.frames.some(f => f.cards.some(c => c.entry.preview.id === e.id || c.entry.plate.id === e.id)))
      : []),
    ids: () => SEGMENTS.map(s => s.id),
    /* the six segments first, then the works hanging in the one standing:
       one call answers both, as it does for the line's studs */
    station(id) {
      if (SEGMENTS.some(s => s.id === id)) {
        void open(id)
        return true
      }
      const frame = active?.hang.frames.find(f => f.work.id === id)
      if (!frame || !active) return false
      active.choose(frame)
      return true
    },
    /* the host's one telemetry channel carries what the bench's own hook
       used to say beside it: which view stands, and why a mount failed */
    telemetry: () => (active
      ? { ...active.measure(), view: active.view(), error: failure }
      : { kind: 'pictures', loading, error: failure,
          /* the probe outlives a departure on purpose, so it stays in the
             account a rig reads while no bench stands */
          cost: { ...stack.cost(), textureMB: stack.cost().textureMB + (benchProbe?.textureMB() ?? 0), probeTextureMB: benchProbe?.textureMB() ?? 0 } }),
    relight() {
      active?.relight()
    },
    lights: () => ({ rigs: stack.lights(), sceneObjects: stack.sceneObjects() }),
    /* the room, its bake and its plates are allocated for one tier, so a
       live switch would leave half the wall dressed for the tier before */
    reloadOnTier: true,
  }
}
