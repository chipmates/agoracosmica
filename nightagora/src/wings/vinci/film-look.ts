/* THE FILM'S CLOSE LOOKS: the vitrine with a work's plate, the machine's live
   island and the leaf its folio opens, built from the wing's own modules. The
   film wing loads this after its first picture stands, so a phone pays for the
   picture first and for the close looks while the visitor reads. */

import type { PerspectiveCamera, Scene } from 'three/webgpu'
import type { Stack } from '../../stack'
import { lang } from '../content'
import { vinciCertaintyWords, type VinciCertainty, type VinciText } from './content'
import { getWork, findPlateEntries, MAIN_HANG } from './pictures/register'
import { createWindowWorkLabel, policyLabelText, PICTURE_CERTAINTY_KEY } from './pictures/policy-label'
import { validatePaintingRecord } from './pictures/policy'
import { pictureDisplayUV, pictureDisplayWindow } from './pictures/registration'
import { machineCatalog, type MachineSlug } from './machines/catalog'
import { createVinciCloseLook, createVinciMachinePayload, createVinciShowpiecePayload, renderVinciShowpieceRecord, vinciLine, vinciLimits,
  vinciMachineCard, vinciMachineClockWords, vinciMachineSheet, vinciMachineSteps, vinciManuscriptWords, vinciSheetRecords, vinciShowpiece,
  VINCI_EXHIBIT_CARD, VINCI_PAGE_HONESTY, VINCI_VITRINE_WORDS, type VinciShowpiece } from './collection/close-look'
import type { ShowpiecePayload } from '../vitrine/showpiece'
import { createCyclePayload, type FilmCycle } from '../picture/cycle'
import { createIslandPayload, islandChoice, type IslandPayload } from '../picture/island'
import type { PictureBox, PictureFraming } from '../picture/seam'
import type { TurntablePayload } from '../vitrine/turntable'
import { vinciLeafSource, vinciPlateDescription } from './collection/deep-plate'
import { createPlatePayload } from '../vitrine/picture'
import { createReaderPayload as createLeafReader } from '../vitrine/reader'
import { FAMOUS_FOLIOS, type PageRecord } from './table/content'
import studyPageMap from './table/data/msb-pages.json?raw'
import { assetAddress } from '../../stack/materials'
import { loadManifest, type ManifestIndex } from '../../manifest'
import type { DeskOverviewCell } from '../overview'

/** the card every mark names with aria-controls */
export const FILM_LOOK_CARD = VINCI_EXHIBIT_CARD

export interface FilmLookHost {
  host: HTMLElement
  narrow(): boolean
  /** the room the one step back leads to, in the page's language */
  room(): string
  returnFocus(): HTMLElement | null
  /** the lowest pixel the window may use */
  floor(): number
  /** the station the visitor stands in, which prints the island */
  station(): string
  stack: Stack
  scene: Scene
  camera: PerspectiveCamera
  /** the chrome's words give way before the window takes the glass */
  standDown(down: boolean): void
  /** the film stands aside while the island draws */
  veil(hidden: boolean): void
  /** true while the eye stands at rest, which is when a payload may show */
  standing(): boolean
  openRecord(id: string, title: VinciText, certainty: VinciCertainty, render: (host: HTMLElement) => void): void
  onClose(): void
  /** the release's filmed cycle of a machine, where it carries one, and its folder */
  cycle(id: string): { cycle: FilmCycle; base: string } | null
  /** where a filmed cycle stands: over the held canvas, under every word */
  cycleLayer(): HTMLElement
  /** the picture's box and its framing, which a filmed cycle covers as the island's canvas does */
  box(): PictureBox
  framing(): PictureFraming
}

const text = (value: VinciText): string => value[lang()]
const make = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, value?: string): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag)
  node.className = cls
  if (value !== undefined) node.textContent = value
  return node
}
const ORDER: VinciCertainty[] = ['documented', 'unknown', 'reconstructed', 'conjectural']
const certaintyColour = (key: VinciCertainty): string => PICTURE_CERTAINTY_KEY[ORDER.indexOf(key)]!.colour

/** THE ONE LEAF A MACHINE'S FOLIO OPENS here: manuscript B, folio 83 verso,
    the sheet the aerial screw was read from. */
function screwLeaf(): PageRecord | undefined {
  const pages = (JSON.parse(studyPageMap) as { pages: PageRecord[] }).pages
  return pages.find(page => page.page_kind === 'facsimile' && page.codex === 'B' && page.folio === 83 && page.side === 'verso')
}

export function createFilmLook(h: FilmLookHost) {
  let assets: ManifestIndex | undefined
  const closeLook = createVinciCloseLook({ host: h.host, narrow: h.narrow, room: h.room, returnFocus: h.returnFocus, floor: h.floor,
    // the film has already walked there: the window opens where the eye stands
    onOpen: () => false,
    onClose: () => { h.veil(false); h.standDown(false); h.onClose() } })
  const control = (words: VinciText, run: () => void, role = ''): HTMLButtonElement => {
    const button = make('button', 'vitrine-control', text(words))
    button.type = 'button'
    button.addEventListener('click', run)
    if (role) button.dataset['role'] = role
    return button
  }
  const shut = (): HTMLButtonElement => control(VINCI_VITRINE_WORDS.close, () => closeLook.close(), 'close')
  /** where a work stands in the hang, the row's own count */
  function hangPlace(id: string): { at: number; of: number } | null {
    const workId = id.split('/')[1]
    const at = MAIN_HANG.findIndex(work => work.id === workId)
    return at < 0 ? null : { at: at + 1, of: MAIN_HANG.length }
  }

  async function open(id: string, from: HTMLElement | null): Promise<void> {
    const asked = performance.now()
    assets ??= await loadManifest()
    if (id.startsWith('sheet/')) {
      // a sheet whose film the store carries opens as that film
      const show = vinciShowpiece(id, assets)
      if (show) openShowpiece(show, from, 'enter')
      return
    }
    if (id.startsWith('picture/')) {
      const [, workId, face] = id.split('/') as [string, string, 'front' | 'reverse']
      const work = getWork(workId)
      const entries = findPlateEntries(work, assets)
      const plate = entries.find(entry => entry.face === face) ?? entries[0]
      if (!plate) return
      const names = work as typeof work & { reverse_title_en?: string; reverse_title_de?: string }
      const title = text(face === 'reverse' ? { en: names.reverse_title_en ?? work.title_en, de: names.reverse_title_de ?? work.title_de } : { en: work.title_en, de: work.title_de })
      const registration = pictureDisplayWindow(plate.plate)
      const cut = registration ? pictureDisplayUV(registration) : null
      const payload = createPlatePayload({
        src: assetAddress(validatePaintingRecord(plate.preview, 'painting-preview').entry), title,
        description: vinciPlateDescription(id), aspect: plate.pixels.width / plate.pixels.height, window: cut, standing: h.standing,
        // the phone's close look is the work on the whole glass, the words folded under it
        fill: h.narrow(),
      })
      const colour = policyLabelText(work, entries).colour
      const certainty = ORDER[Math.max(0, PICTURE_CERTAINTY_KEY.findIndex(entry => entry.colour === colour))] ?? 'reconstructed'
      h.standDown(true)
      closeLook.open({ id, title, line: vinciLine(id), card: [createWindowWorkLabel(work, entries, lang(), h.narrow())], payload,
        controls: [control(VINCI_VITRINE_WORDS.provenance, () => h.openRecord(id, { en: work.title_en, de: work.title_de }, certainty,
          host => host.append(make('p', 'vinci-statement', `${work.holder} · ${text({ en: work.date_label_en, de: work.date_label_de })}`))), 'record'), shut()],
        ...vinciLimits(id), set: hangPlace(id), certainty }, from, 'enter')
      return
    }
    if (id.startsWith('machine/')) {
      const slug = id.slice('machine/'.length) as MachineSlug
      const title = machineCatalog[slug].title[lang()]
      const words = vinciMachineCard(slug, h.narrow(), { word: text(vinciCertaintyWords.reconstructed), colour: PICTURE_CERTAINTY_KEY[2]!.colour })
      const record = (): void => h.openRecord(id, machineCatalog[slug].title, 'reconstructed', host => host.append(make('p', 'vinci-statement', text(machineCatalog[slug].label))))
      const openFolio = slug === 'aerial-screw' ? () => openLeaf(id) : undefined
      const choice = islandChoice(h.stack)
      const filmed = h.cycle(id)
      /* THE ISLAND'S BUILDERS AND THE WING'S PRINT arrive only where the island
         is drawn: a device shown the film never fetches a byte of them */
      const live = choice.mode === 'live' || !filmed
        ? await Promise.all([import('./machines'), import('./print')]) : null
      let island: TurntablePayload | null = null
      const makeLive = () => {
        const [{ buildMachine }, { PRINT, STATION_EXPOSURE, KEY_RIG }] = live!
        island = createVinciMachinePayload({ stack: h.stack, slug, body: buildMachine(slug, h.stack),
          grade: { ...PRINT, exposure: STATION_EXPOSURE[h.station() as keyof typeof STATION_EXPOSURE] ?? PRINT.exposure }, light: KEY_RIG,
          openRecord: record, openFolio,
          // the island is the one live picture: the film stands aside while it draws
          restore: () => { h.veil(false); h.stack.setScene(h.scene, h.camera, PRINT) },
          standing: h.standing })
        return island
      }
      let cycle: ReturnType<typeof createCyclePayload> | null = null
      const makeFilmed = filmed ? (step: number) => {
        cycle = createCyclePayload({ cycle: filmed.cycle, base: filmed.base, framing: h.framing, host: h.cycleLayer(), box: h.box,
          title, steps: vinciMachineSteps(slug), words: vinciMachineClockWords(),
          sheet: vinciMachineSheet(slug, openFolio ?? record), land: step > 0 ? step : null })
        return cycle
      } : null
      const payload = createIslandPayload({ choice: live ? choice : { mode: 'filmed', why: choice.why }, live: makeLive, filmed: makeFilmed,
        // the film stands over the canvas until the island's first frame is drawn, never an empty stage
        stood: () => h.veil(true),
        stepOf: () => Math.max(0, [...h.host.querySelectorAll('.vitrine-step-item')].findIndex(b => b.getAttribute('aria-current') === 'step')), asked })
      machine = { payload, island: () => island, cycle: () => cycle }
      h.standDown(true)
      closeLook.open({ id, title, line: vinciLine(id), card: words.card, after: words.after, payload,
        controls: [control(VINCI_VITRINE_WORDS.provenance, record, 'record'), shut()], ...vinciLimits(id), set: null, certainty: 'reconstructed' }, from, 'enter')
    }
  }
  /** the machine standing open, for the rigs' readout and the recording's hand */
  let machine: { payload: IslandPayload; island(): TurntablePayload | null; cycle(): ReturnType<typeof createCyclePayload> | null } | null = null
  function readout() {
    const open = closeLook.id
    if (film && open === film.id) return { id: open, surface: closeLook.surface, mode: 'showpiece', standing: film.payload.standing(), ...film.payload.readout() }
    if (!open?.startsWith('machine/') || !machine) return { id: open, mode: null }
    const reading = machine.payload.reading()
    const current = [...h.host.querySelectorAll('.vitrine-step-item')].findIndex(b => b.getAttribute('aria-current') === 'step')
    const cycle = machine.cycle()
    return { id: open, surface: closeLook.surface, ...reading,
      standing: reading.mode === 'live' ? closeLook.surface === 'own' : cycle?.standing() ?? false,
      landed: reading.mode === 'live' ? current : cycle?.landed() ?? null }
  }
  ;(window as Window & { __naLook?: unknown }).__naLook = { readout }
  /* THE RECORDING'S HAND, under the export's address only: the island opened
     where the eye stands and its clock set outright, frame by frame */
  if (new URLSearchParams(location.search).has('export')) (window as Window & { __naIsland?: unknown }).__naIsland = {
    open: (slug: string) => open(`machine/${slug}`, null),
    film: () => machine?.island()?.film ?? null,
    pose: (clock: number, how: { playing: boolean; lit: boolean }) => machine?.island()?.film.pose(clock, how),
    frame: (box: { width: number; height: number } | null) => machine?.island()?.film.frame(box),
    readout,
  }

  /** THE SHEET: the leaf the screw was read from, opened in the reader where
      the visitor stands, as the live wing opens the study's own leaf */
  function openLeaf(machine: string): void {
    const leaf = screwLeaf()
    if (!leaf || !assets) return
    const stem = leaf.file.replace(/^.*\//, '').replace(/\.[a-z]+$/, '')
    const near = assets.byId.get(`vinci/ms-page-near/${stem}`) ?? assets.byId.get(`vinci/ms-page/${stem}`)
    const thumb = assets.byId.get(`vinci/ms-thumb/${stem}`)
    if (!near) return
    const scan = near as typeof near & { width?: number; height?: number; licence?: string }
    const named = FAMOUS_FOLIOS.find(folio => folio.folio === '83v')
    const title = lang() === 'de' ? named?.de ?? '' : named?.en ?? ''
    const shows = lang() === 'de' ? leaf.what_it_shows_de : leaf.what_it_shows_en
    const source = vinciLeafSource(assets, leaf.file, { file: assetAddress(near), width: scan.width ?? 0, height: scan.height ?? 0 })
    const door = `${machine}/leaf`
    const reader = createLeafReader({
      book: Promise.resolve({ sides: [{ id: 'screw-leaf', label: title, shows, source, thumb: thumb ? assetAddress(thumb) : null, ways: [],
        colour: certaintyColour('documented'), head: null, holder: '' }],
      stripLabel: h.room, holder: '', honesty: text(VINCI_PAGE_HONESTY) }),
      start: 'screw-leaf', words: vinciManuscriptWords(), tier: () => 'standard' })
    closeLook.open({ id: door, title, line: null, card: [], payload: reader,
      controls: [control(VINCI_VITRINE_WORDS.provenance, () => h.openRecord(door, { en: named?.en ?? '', de: named?.de ?? '' }, 'documented',
        host => { for (const line of [shows, scan.licence ?? '']) if (line) host.append(make('p', 'vinci-statement', line)) }), 'record'),
      control(VINCI_VITRINE_WORDS.back, () => void open(machine, null), 'back'), shut()], set: null, certainty: 'documented' }, null, 'advance')
  }

  /** THE FILM OF WHAT A SHEET DESCRIBES, as the sheet's close look: the film
      whole with its lines under it, and the sheet itself one press away */
  let film: { id: string; payload: ShowpiecePayload } | null = null
  function openShowpiece(show: VinciShowpiece, from: HTMLElement | null, how: 'enter' | 'advance'): void {
    if (!assets) return
    const sheet = vinciSheetRecords(show.id, assets)
    const title = sheet?.title ?? ''
    const payload = createVinciShowpiecePayload(show, { framing: h.framing, title,
      sheet: sheet ? { src: Promise.resolve(assetAddress(sheet.thumb)), label: title, open: () => openSheet(show) } : undefined })
    film = { id: show.id, payload }
    const record = (): void => h.openRecord(show.id, { en: title, de: title }, show.certainty, host => renderVinciShowpieceRecord(show, sheet?.page ?? null, host))
    h.standDown(true)
    closeLook.open({ id: show.id, title, line: vinciLine(show.id), card: [], payload,
      controls: [control(VINCI_VITRINE_WORDS.provenance, record, 'record'), shut()], set: null, certainty: show.certainty }, from, how)
  }
  /** THE SHEET ITSELF, in the reader where the visitor stands; Back stands the film up again */
  function openSheet(show: VinciShowpiece): void {
    const sheet = assets ? vinciSheetRecords(show.id, assets) : null
    if (!sheet) return
    const door = `${show.id}/leaf`
    const id = show.id.replace(/^sheet\//, '')
    const reader = createLeafReader({
      book: Promise.resolve({ sides: [{ id, label: sheet.title, shows: '', ways: [], head: vinciLine(show.id),
        source: { pyramid: null, file: assetAddress(sheet.page), width: sheet.page.width, height: sheet.page.height },
        thumb: assetAddress(sheet.thumb), colour: certaintyColour('documented'), holder: sheet.page.holder ?? '' }],
      stripLabel: h.room, holder: '', honesty: text(VINCI_PAGE_HONESTY) }),
      start: id, words: vinciManuscriptWords(), tier: () => 'standard' })
    const record = (): void => h.openRecord(door, { en: sheet.title, de: sheet.title }, 'documented', host => {
      for (const line of [lang() === 'de' ? sheet.page.honesty_de : sheet.page.honesty_en, sheet.page.licence]) host.append(make('p', 'vinci-statement', line))
    })
    // THE WAY BACK TO THE FILM is the look's own way back: the band's arrow on
    // the desktop, the card row's first seat on the phone
    const back = make('button', 'vitrine-control vitrine-step', '‹')
    back.type = 'button'
    back.dataset['role'] = 'back'
    back.setAttribute('aria-label', text(VINCI_VITRINE_WORDS.back))
    back.addEventListener('click', () => openShowpiece(show, null, 'advance'))
    closeLook.open({ id: door, title: sheet.title, line: vinciLine(show.id), card: [], payload: reader,
      controls: [control(VINCI_VITRINE_WORDS.provenance, record, 'record'), shut()], walk: [back],
      set: null, certainty: 'documented' }, null, 'advance')
  }
  /** A PRESSED MARK FETCHES ITS FILM'S FIRST FRAME while the walk runs, so the
      still stands the moment the look opens */
  function warm(id: string): void {
    if (!id.startsWith('sheet/')) return
    void (async () => {
      assets ??= await loadManifest()
      const show = vinciShowpiece(id, assets)
      const cut = show?.cuts[h.framing()] ?? show?.cuts.wide ?? show?.cuts.upright
      if (!cut) return
      const still = new Image()
      still.decoding = 'async'
      still.src = cut.poster.src
      void still.decode().catch(() => undefined)
    })()
  }

  /** THE OVERVIEW'S CELLS for a set: each work's name, mark and plate at rest,
      from the registers the live row reads; a cell exists only where a plate resolves */
  async function cells(exhibits: readonly string[]): Promise<DeskOverviewCell[]> {
    assets ??= await loadManifest()
    const out: DeskOverviewCell[] = []
    for (const id of exhibits) {
      if (id.startsWith('picture/')) {
        const [, workId, face] = id.split('/') as [string, string, 'front' | 'reverse']
        let work
        try { work = getWork(workId) } catch { continue }
        const entries = findPlateEntries(work, assets)
        const plate = entries.find(entry => entry.face === face)
        if (!plate) continue
        const names = work as typeof work & { reverse_title_en?: string; reverse_title_de?: string; short_title_en?: string; short_title_de?: string }
        const colour = policyLabelText(work, entries).colour
        out.push({ id, kind: 'picture', openable: true,
          title: text(face === 'reverse' ? { en: names.reverse_title_en ?? work.title_en, de: names.reverse_title_de ?? work.title_de } : { en: work.title_en, de: work.title_de }),
          short: face === 'front' && names.short_title_en && names.short_title_de ? text({ en: names.short_title_en, de: names.short_title_de }) : null,
          certainty: ORDER[Math.max(0, PICTURE_CERTAINTY_KEY.findIndex(entry => entry.colour === colour))] ?? 'reconstructed',
          preview: assetAddress(validatePaintingRecord(plate.preview, 'painting-preview').entry) })
      } else if (id.startsWith('machine/')) {
        const slug = id.slice('machine/'.length) as MachineSlug
        const entry = assets.byId.get(`vinci/exhibit-preview/machine/${slug}`)
        if (!machineCatalog[slug] || !entry) continue
        out.push({ id, kind: 'machine', openable: true, title: text(machineCatalog[slug].title), certainty: 'reconstructed', preview: assetAddress(entry) })
      }
    }
    return out
  }

  return {
    cells,
    get id(): string | null { return closeLook.id },
    get surface() { return closeLook.surface },
    open,
    warm,
    close: () => closeLook.close(),
    key: (event: KeyboardEvent): boolean => closeLook.key(event),
    layout: () => closeLook.layout(),
    update: (dt: number) => closeLook.update(dt),
    dispose: () => closeLook.dispose(),
  }
}

export type FilmLook = ReturnType<typeof createFilmLook>
