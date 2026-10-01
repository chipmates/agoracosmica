/* THE FILM'S CLOSE LOOKS: the vitrine with a work's plate, the machine's live
   island and the leaf its folio opens, built from the wing's own modules. The
   film wing loads this after its first picture stands, so a phone pays for the
   picture first and for the close looks while the visitor reads. */

import type { PerspectiveCamera, Scene } from 'three/webgpu'
import type { Stack } from '../../stack'
import { lang } from '../content'
import { vinciCertaintyWords, type VinciCertainty, type VinciText } from './content'
import { getWork, findEvidencePlates, findPlateEntries } from './pictures/register'
import { createPictureRecord, createWindowWorkLabel, policyLabelText, PICTURE_CERTAINTY_KEY } from './pictures/policy-label'
import { validatePaintingRecord } from './pictures/policy'
import { machineCatalog, type MachineSlug } from './machines/catalog'
import { createVinciCloseLook, createVinciMachinePayload, createVinciShowpiecePayload, fillVinciLimitSlots, renderVinciShowpieceRecord, vinciDeathbedCard,
  vinciLine, vinciLimits, vinciMachineCard, vinciMachineClockWords, vinciMachineSheet, vinciMachineSteps, vinciManuscriptWords, vinciPlaceCard,
  vinciPlaceTitle, vinciRoomName, vinciSheetRecords, vinciSheetSides, vinciShowpiece, vinciWorkTitle,
  VINCI_EXHIBIT_CARD, VINCI_PAGE_HONESTY, VINCI_VITRINE_WORDS, type VinciPlaceCertainty, type VinciPlaceId, type VinciShowpiece } from './collection/close-look'
import { createVinciPaintingView } from './collection/deep-plate'
import { hangCatalogue } from './collection/catalogue'
import { filmLookKind, FILM_DEATHBED as DEATHBED, FILM_DEATHBED_PLATE, FILM_EDITION_WHOLE as EDITION_WHOLE, FILM_PLACES as PLACES, FILM_STUDY_LEAF as VINCI_STUDY_LEAF } from './film-look-kinds'
import { GRAVE_DEATHBED } from './grave/placement'
import { createPlacePayload } from '../vitrine/place'
import type { VitrineExhibit, VitrinePlace } from '../vitrine/types'
import type { ShowpiecePayload } from '../vitrine/showpiece'
import { createCyclePayload, type FilmCycle } from '../picture/cycle'
import { createIslandPayload, islandChoice, type IslandPayload } from '../picture/island'
import type { PictureBox, PictureFraming } from '../picture/seam'
import type { TurntablePayload } from '../vitrine/turntable'
import { vinciLeafSource } from './collection/deep-plate'
import { createPlatePayload } from '../vitrine/picture'
import { createReaderPayload as createLeafReader } from '../vitrine/reader'
import { FAMOUS_FOLIOS, type PageRecord } from './table/content'
import studyPageMap from './table/data/msb-pages.json?raw'
import { assetAddress } from '../../stack/materials'
import { loadManifest, type ManifestIndex } from '../../manifest'
import type { DeskOverviewCell } from '../overview'
import { deskControl } from '../desk-story'
import { BEST_OF_OPENING, BEST_OF_TOPICS, bestOfSource, topicExhibit, topicPages, topicPagesWord } from './table/best-of'
import { createBestOfLook } from './table/best-of-look'
import { CODEX_ENTRIES, EDITION_EXHIBIT, SHELF_BOOKS, shelfBook, shelfPlate } from './table/codex-shelf'
import { shownAbsences } from './table/absences'
import { createCodexReaderPayload } from './table/codex-reader'
import { createReaderPayload as createEditionReader } from './table/reader'
import type { ReadingTable } from './table'
import { SHELF_UI, TABLE_UI } from './table/content'

/** the card every mark names with aria-controls */
export const FILM_LOOK_CARD = VINCI_EXHIBIT_CARD
/** the reading table's set: the seventeen topics of the best-of */
export const filmTableSet = (): string[] => BEST_OF_TOPICS.map(topic => topicExhibit(topic.slug))

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
  /** the set the standing station holds, in the order its room hangs it */
  row(): readonly string[]
  /** how a press would reach a work's view from where the picture stands */
  reach(id: string): 'walk' | 'open' | 'dip' | 'none'
  /** THE WAY ON TO A NEIGHBOUR, as a pressed mark goes: the look shut where
      it stands, the film walked or dipped to that work's view, its look opened */
  walkOn(id: string): void
  /** the wing's life window, which the line's floor opens whole; false where the film carries none */
  life?(): boolean
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
  /** THE WAY UP OUT OF A LOOK the stop frames alone, where that work hangs on
      a wall: back and close both go to the wall's story stop. Null elsewhere. */
  above?(id: string): (() => void) | null
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
const pictureCertainty = (colour: string): VinciCertainty => {
  const at = PICTURE_CERTAINTY_KEY.findIndex(entry => entry.colour === colour)
  return ORDER[at < 0 ? 2 : at]!
}
const placeCertainty = (key: VinciPlaceCertainty): { word: string; colour: string } => ({ word: text(vinciCertaintyWords[key]), colour: certaintyColour(key) })

/** THE ONE LEAF A MACHINE'S FOLIO OPENS here: manuscript B, folio 83 verso,
    the sheet the aerial screw was read from. */
function screwLeaf(): PageRecord | undefined {
  const pages = (JSON.parse(studyPageMap) as { pages: PageRecord[] }).pages
  return pages.find(page => page.page_kind === 'facsimile' && page.codex === 'B' && page.folio === 83 && page.side === 'verso')
}

/** a close look's two ways along its set, as the phone's foot row stands them */
export interface FilmLookWays {
  /** the work before by name, or null at the set's start */
  previous: string | null
  /** the way on: the next work's name ('' where the set does not know it) and the word for the step */
  next: { title: string; word: VinciText } | null
  step(direction: 1 | -1): void
}

export function createFilmLook(h: FilmLookHost) {
  let assets: ManifestIndex | undefined
  const closeLook = createVinciCloseLook({ host: h.host, narrow: h.narrow, room: () => vinciRoomName(h.station(), { en: h.room(), de: h.room() }),
    returnFocus: h.returnFocus, floor: h.floor,
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
  const shut = (up: (() => void) | null = null): HTMLButtonElement => control(VINCI_VITRINE_WORDS.close, up ?? (() => closeLook.close()), 'close')
  /** the open look's two steps along its set, read by the phone's foot row as the desk's band reads them */
  let walked: readonly HTMLElement[] = []
  let kicker: string | null = null
  function openLook(exhibit: VitrineExhibit, from: HTMLElement | null, how: 'enter' | 'advance'): void {
    walked = exhibit.walk ?? []
    kicker = exhibit.onKicker ?? null
    closeLook.open(exhibit, from, how)
  }
  const tier = () => h.stack.tierName()

  /** A WORK'S OWN NAME, for the way on that walks to it: the name its own
      register gives it, as the live row names it */
  function titleOf(id: string): string {
    if (id === DEATHBED || PLACES.has(id)) return vinciPlaceTitle(id as VinciPlaceId).title
    if (id.startsWith('picture/')) {
      const [, workId, face] = id.split('/') as [string, string, 'front' | 'reverse']
      try { return text(vinciWorkTitle(getWork(workId), face)) } catch { return '' }
    }
    if (id.startsWith('machine/')) return machineCatalog[id.slice('machine/'.length) as MachineSlug]?.title[lang()] ?? ''
    if (id.startsWith('sheet/')) return assets ? vinciSheetRecords(id, assets)?.title ?? '' : ''
    return ''
  }
  /** THE WAY ON AND BACK walk the set to a named work: a press goes as the
      work's mark goes, walked or dipped to its view, and its look opens there;
      a work that opens where the visitor stands opens in this window */
  function stepTo(id: string): void {
    const how = h.reach(id)
    if (how === 'walk' || how === 'dip') h.walkOn(id)
    else void open(id, null, 'advance')
  }
  function stepControl(glyph: string, target: string | null): HTMLButtonElement {
    const button = make('button', 'vitrine-control vitrine-step', glyph)
    button.type = 'button'
    button.disabled = !target
    if (target) {
      button.setAttribute('aria-label', titleOf(target))
      button.setAttribute('aria-controls', VINCI_EXHIBIT_CARD)
      button.addEventListener('click', () => stepTo(target))
    }
    return button
  }
  /** WHERE A WORK STANDS IN THE SET ITS STATION HOLDS, and the two that walk
      it, as the live row counts and walks it: a work of another station seen
      from here carries no count, and the ends of a set are ends */
  function stand(id: string): { set: VitrinePlace | null; walk: HTMLElement[] } {
    const row = h.row(), at = row.indexOf(id)
    if (at < 0) return { set: null, walk: [stepControl('\u2039', null), stepControl('\u203a', null)] }
    return { set: { at: at + 1, of: row.length }, walk: [stepControl('\u2039', row[at - 1] ?? null), stepControl('\u203a', row[at + 1] ?? null)] }
  }

  async function open(id: string, from: HTMLElement | null, how: 'enter' | 'advance' = closeLook.id && closeLook.id !== id ? 'advance' : 'enter'): Promise<void> {
    const asked = performance.now()
    assets ??= await loadManifest()
    const kind = filmLookKind(id)
    // THE BOOK ON THE TABLE OPENS THE BEST-OF at the leaf it lies open at
    if (kind === 'edition') { openTopic(BEST_OF_OPENING.topic, BEST_OF_OPENING.page, from, EDITION_EXHIBIT); return }
    if (kind === 'topic') { openTopic(id.slice('topic/'.length), undefined, from); return }
    if (kind === 'whole-edition') { openEdition(from); return }
    if (kind === 'book') { openBook(id, from); return }
    // THE FLOOR IS THE DOOR INTO THE LIFE: it opens the life view whole, as the live floor does
    if (kind === 'life') { h.life?.(); return }
    if (kind === 'study-leaf') { openStudyLeaf(from, how); return }
    if (kind === 'sheet') {
      // a sheet whose film the store carries opens as that film; every other is a page of the wall's book
      const show = vinciShowpiece(id, assets)
      if (show) openShowpiece(show, from, how)
      else openWallSheet(id, from, how)
      return
    }
    if (kind === 'place') { openPlace(id, from, how); return }
    if (kind === 'picture') {
      const [, workId, face] = id.split('/') as [string, string, 'front' | 'reverse']
      const work = getWork(workId)
      const entries = findPlateEntries(work, assets)
      const plate = entries.find(entry => entry.face === face) ?? entries[0]
      const title = text(vinciWorkTitle(work, face))
      const evidence = face === 'front' ? findEvidencePlates(work, assets) : []
      const certainty = pictureCertainty(policyLabelText(work, entries).colour)
      const record = (): void => h.openRecord(id, { en: work.title_en, de: work.title_de }, certainty, host => {
        const full = createPictureRecord(work, entries, evidence)
        full.hidden = false
        host.append(full)
        for (const slot of ['limit', 'visual_note']) { const empty = make('p', 'vinci-statement'); empty.dataset['slot'] = slot; empty.hidden = true; full.append(empty) }
        fillVinciLimitSlots(id, full)
      })
      // THE NUMBER ON ITS FRAME: a work of the hang is read as its catalogue entry
      const catalogue = hangCatalogue(work, face, entries, lang())
      const controls = [control(VINCI_VITRINE_WORDS.provenance, record, 'record'), shut()]
      const { set, walk } = stand(id)
      h.standDown(true)
      // ONE VIEW OF A PAINTING, the live wing's own: the deep plate with its zoom and its rule
      if (plate) openLook({ ...createVinciPaintingView({ id, title, line: vinciLine(id), work, entries, plate, ...vinciLimits(id), controls,
        from: () => null, standing: h.standing, narrow: h.narrow(), catalogue, tier }), walk, set, certainty }, from, how)
      else openLook({ id, title, line: vinciLine(id), card: [createWindowWorkLabel(work, entries, lang(), h.narrow(), Boolean(catalogue?.kind))],
        payload: null, controls, walk, ...vinciLimits(id), set, certainty, catalogue }, from, how)
      return
    }
    if (kind === 'machine') {
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
        const [{ buildMachine }, { PRINT, STATION_EXPOSURE, STATION_TOE, KEY_RIG }] = live!
        const at = h.station() as keyof typeof STATION_EXPOSURE
        island = createVinciMachinePayload({ stack: h.stack, slug, body: buildMachine(slug, h.stack),
          grade: { ...PRINT, exposure: STATION_EXPOSURE[at] ?? PRINT.exposure, toe: STATION_TOE[at] ?? PRINT.toe }, light: KEY_RIG,
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
      const { set, walk } = stand(id)
      h.standDown(true)
      openLook({ id, title, line: vinciLine(id), card: words.card, after: words.after, payload,
        controls: [control(VINCI_VITRINE_WORDS.provenance, record, 'record'), shut()], walk, ...vinciLimits(id), set, certainty: 'reconstructed' }, from, how)
    }
  }

  /** THE GRAVE'S PLACES AND THE PAINTING AT THE GRAVE, under the live wing's
      own cards: a place is its own stones, which the held frame shows; the
      painting is shown whole from the store's own reproduction */
  function openPlace(id: string, from: HTMLElement | null, how: 'enter' | 'advance'): void {
    const painting = id === DEATHBED
    const plate = painting ? assets?.byId.get(FILM_DEATHBED_PLATE) : undefined
    const place = painting ? vinciDeathbedCard(placeCertainty('conjectural'), plate?.licence ?? null) : vinciPlaceCard(id as VinciPlaceId, placeCertainty)
    const record = (): void => h.openRecord(id, { en: place.title, de: place.title }, place.certainty, host => place.record(host))
    const payload = painting
      ? createPlatePayload({ title: place.title, aspect: GRAVE_DEATHBED.imageWidth / GRAVE_DEATHBED.imageHeight, window: null, standing: h.standing,
        ...(plate ? { src: assetAddress(plate) } : {}) })
      : createPlacePayload({ title: place.title, standing: h.standing })
    const { set, walk } = stand(id)
    h.standDown(true)
    openLook({ id, title: place.title, line: vinciLine(id), card: place.card, after: place.after, payload,
      controls: [control(VINCI_VITRINE_WORDS.provenance, record, 'record'), shut()], walk, ...vinciLimits(id), set, certainty: place.certainty }, from, how)
  }
  /** THE OPEN LOOK'S WAYS ALONG ITS SET, for the phone's foot row: the band's
      own reading (the set's two steps, else the payload's own page steps)
      and its word for the way on, the next work named where the set knows it */
  function ways(): FilmLookWays | null {
    if (!closeLook.id) return null
    const live = (node?: HTMLElement | null): HTMLElement | null => node && !(node as HTMLButtonElement).disabled ? node : null
    const steps = h.host.querySelectorAll<HTMLElement>('.vitrine-payload-controls .vitrine-step')
    const on = live(walked[1] ?? steps[1]), back = live(walked[0] ?? steps[0])
    const kind = h.host.querySelector<HTMLElement>('.vitrine')?.dataset['payload'] ?? ''
    const own = deskControl('walk', 'next_manuscript')
    const word: VinciText = kicker ? { en: kicker, de: kicker } : !walked[1] ? deskControl('walk', 'next_page')
      : kind === 'machine' ? deskControl('walk', 'next_machine') : kind === 'manuscript' && own.en && own.de ? own : deskControl('walk', 'next_work')
    const title = on && walked.includes(on) ? on.getAttribute('aria-label') ?? '' : on?.dataset['title'] ?? ''
    return { previous: back ? back.getAttribute('aria-label') || null : null, next: on ? { title, word } : null,
      step: direction => (direction > 0 ? on : back)?.click() }
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
    readLeaf(`${machine}/leaf`, () => void open(machine, null), null, 'advance')
  }
  /** THE PAGE ON THE STUDY'S SUPPORT, the same leaf, opened where the visitor stands */
  function openStudyLeaf(from: HTMLElement | null, how: 'enter' | 'advance'): void {
    h.standDown(true)
    readLeaf(`${VINCI_STUDY_LEAF}/leaf`, null, from, how)
  }
  function readLeaf(door: string, back: (() => void) | null, from: HTMLElement | null, how: 'enter' | 'advance'): void {
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
    const reader = createLeafReader({
      book: Promise.resolve({ sides: [{ id: 'screw-leaf', label: title, shows, source, thumb: thumb ? assetAddress(thumb) : null, ways: [],
        colour: certaintyColour('documented'), head: null, holder: '' }],
      stripLabel: h.room, holder: '', honesty: text(VINCI_PAGE_HONESTY) }),
      start: 'screw-leaf', words: vinciManuscriptWords(), tier: () => 'standard' })
    openLook({ id: door, title, line: null, card: [], payload: reader,
      controls: [control(VINCI_VITRINE_WORDS.provenance, () => h.openRecord(door, { en: named?.en ?? '', de: named?.de ?? '' }, 'documented',
        host => { for (const line of [shows, scan.licence ?? '']) if (line) host.append(make('p', 'vinci-statement', line)) }), 'record'),
      ...(back ? [control(VINCI_VITRINE_WORDS.back, back, 'back')] : []), shut()],
      set: back ? null : stand(VINCI_STUDY_LEAF).set, certainty: 'documented' }, from, how)
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
    const up = h.above?.(show.id) ?? null
    // the station's own row walks on from the film as from any work in it
    const { set, walk } = stand(show.id)
    h.standDown(true)
    openLook({ id: show.id, title, line: vinciLine(show.id), card: [], payload,
      controls: [control(VINCI_VITRINE_WORDS.provenance, record, 'record'), shut(up)], walk, set, certainty: show.certainty,
      ...(up ? { up, shut: up } : {}) }, from, how)
  }
  /** THE BODY WALL IS ONE BOOK, as the live wall is: a sheet opens in the
      reader at that sheet, its sides the wall in the order the wall is walked,
      so the reader's own arrows and the gold page sheet to sheet. The record
      follows the sheet standing. */
  function openWallSheet(id: string, from: HTMLElement | null, how: 'enter' | 'advance'): void {
    if (!assets) return
    const index = assets
    const row = h.row()
    const wall = (row.includes(id) ? row : [id]).flatMap(each => {
      const found = each.startsWith('sheet/') ? vinciSheetRecords(each, index) : null
      return found ? [{ id: each.slice('sheet/'.length), page: found.page, thumb: found.thumb, title: found.title }] : []
    })
    const opened = wall.find(sheet => `sheet/${sheet.id}` === id)
    if (!opened) return
    const door = `${id}/leaf`
    const reader = createLeafReader({
      book: Promise.resolve({ sides: vinciSheetSides(wall, certaintyColour('documented')), stripLabel: h.room, holder: '', honesty: text(VINCI_PAGE_HONESTY) }),
      start: opened.id, words: vinciManuscriptWords(), tier })
    const standing = () => { const here = reader.current(); return wall.find(sheet => sheet.id === here?.id) ?? opened }
    const record = (): void => {
      const at = standing()
      h.openRecord(door, { en: at.title, de: at.title }, 'documented', host => {
        const block = make('div', 'vinci-record')
        block.dataset['register'] = 'record'
        for (const line of [lang() === 'de' ? at.page.honesty_de : at.page.honesty_en, at.page.licence]) block.append(make('p', 'vinci-statement', line))
        host.append(block)
      })
    }
    const up = h.above?.(id) ?? null
    h.standDown(true)
    openLook({ id: door, title: opened.title, line: vinciLine(id), card: [], payload: reader,
      controls: [control(VINCI_VITRINE_WORDS.provenance, record, 'record'), shut(up)], ...vinciLimits(id), set: stand(id).set, certainty: 'documented',
      ...(up ? { up, shut: up } : {}) }, from, how)
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
    const up = h.above?.(show.id) ?? null
    openLook({ id: door, title: sheet.title, line: vinciLine(show.id), card: [], payload: reader,
      controls: [control(VINCI_VITRINE_WORDS.provenance, record, 'record'), shut(up)], walk: [back],
      set: null, certainty: 'documented', ...(up ? { up, shut: up } : {}) }, null, 'advance')
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

  /* ---- the reading table: the best-of by topic, and its whole books ---- */

  const recordOf = (id: string, title: VinciText, render: (host: HTMLElement) => void): void => h.openRecord(id, title, 'documented', render)
  /** ONE TOPIC, in the window where the visitor stands; the gold walks topic to topic. */
  function openTopic(slug: string, start: string | undefined, from: HTMLElement | null, asked?: string): void {
    const look = createBestOfLook({ slug, start, ...(asked ? { id: asked } : {}), words: { manuscript: vinciManuscriptWords(), vitrine: VINCI_VITRINE_WORDS },
      manifest: loadManifest(), colour: certaintyColour('documented'), narrow: h.narrow,
      tier: () => 'standard', openTopic: (next, button) => openTopic(next, undefined, button),
      openRecord: recordOf, openBook: book => void open(book === EDITION_EXHIBIT ? EDITION_WHOLE : book, null),
      openShelf: () => closeLook.close(), close: () => closeLook.close() })
    h.standDown(true)
    openLook(look.exhibit, from, closeLook.id ? 'advance' : 'enter')
  }
  /** A WHOLE BOOK OF THE SHELF, as a source: its own reader, walked book to book. */
  function bookWalk(id: string): HTMLElement[] {
    const at = SHELF_BOOKS.findIndex(book => (book.entry ? book.id : EDITION_WHOLE) === id)
    return [-1, 1].map(by => {
      const target = SHELF_BOOKS[at + by]
      const button = make('button', 'vitrine-control vitrine-step', by < 0 ? '\u2039' : '\u203a')
      button.type = 'button'
      button.disabled = !target
      if (target) {
        button.setAttribute('aria-label', text(target.title))
        button.addEventListener('click', () => void open(target.entry ? target.id : EDITION_WHOLE, button))
      }
      return button
    })
  }
  function openBook(id: string, from: HTMLElement | null): void {
    const book = shelfBook(id)
    if (!book) return
    const reader = createCodexReaderPayload({ book, manifest: loadManifest(), words: vinciManuscriptWords(),
      more: text(VINCI_VITRINE_WORDS.more), colour: certaintyColour('documented'), tier: () => 'standard', changed: () => undefined,
      openBook: next => void open(next, null), openLeaf: () => void open(EDITION_WHOLE, null) })
    h.standDown(true)
    openLook({ id, title: text(book.title), line: text(book.title), card: [], payload: reader,
      controls: [control(VINCI_VITRINE_WORDS.provenance, () => recordOf(id, book.title, host => reader.renderRecord(host)), 'record'), shut()],
      walk: bookWalk(id), set: null, certainty: 'documented' }, from, closeLook.id ? 'advance' : 'enter')
  }
  /** THE EDITION OF 1883 WHOLE: the film holds no table to turn, so its pages
   * are read from the edition's own map, the book standing where it lies. */
  function openEdition(from: HTMLElement | null): void {
    const pages = (JSON.parse(studyPageMap) as { pages: PageRecord[] }).pages
    const open83 = screwLeaf()?.edition_index ?? 0
    const table = { pages, at: () => open83, turning: () => false, pending: () => 0,
      flipLeaf: () => undefined, paperOnly: () => undefined, open: async () => undefined } as unknown as ReadingTable
    const reader = createEditionReader({ table, manifest: loadManifest(), walked: () => false, standing: () => true,
      more: text(VINCI_VITRINE_WORDS.more), honesty: text(VINCI_PAGE_HONESTY), words: vinciManuscriptWords(),
      colour: certaintyColour('documented'), tier: () => 'standard', changed: () => undefined,
      openBook: next => void open(next, null) })
    const title = text(SHELF_BOOKS[0]?.official ?? { en: SHELF_UI.en.edition, de: SHELF_UI.de.edition })
    h.standDown(true)
    openLook({ id: EDITION_WHOLE, title, line: null, card: [], payload: reader,
      controls: [control(VINCI_VITRINE_WORDS.provenance, () => recordOf(EDITION_WHOLE, { en: title, de: title }, host => reader.renderRecord(host)), 'record'), shut()],
      walk: bookWalk(EDITION_WHOLE), set: null, certainty: 'documented' }, from, closeLook.id ? 'advance' : 'enter')
  }
  /** The best-of's pages the store admits, which is what the shelf's measure counts. */
  function admitted(slug: string): number {
    return assets ? topicPages(slug).filter(page => bestOfSource(page, assets!)).length : 0
  }
  /** THE SHELF'S OWN WORDS at the reading table: its name, its measure, its
   * columns, its whole books and its absences, for the overview. */
  function shelf() {
    const language = lang()
    const pages = String(BEST_OF_TOPICS.reduce((sum, topic) => sum + admitted(topic.slug), 0))
    const measure = deskControl('overview', 'measure_book')
    const plate = (() => { const leaf = screwLeaf(); const stem = leaf?.file.replace(/^.*\//, '').replace(/\.[a-z]+$/, ''); const entry = stem ? assets?.byId.get(`vinci/ms-thumb/${stem}`) : undefined; return entry ? assetAddress(entry) : null })()
    return {
      name: { en: SHELF_UI.en.shelf, de: SHELF_UI.de.shelf },
      measure: { en: measure.en.replace('{n}', pages), de: measure.de.replace('{n}', pages) },
      columns: 6,
      absent: { heading: TABLE_UI[language].absent, items: shownAbsences(language).map(absence => ({ title: absence.title, reason: absence.reason })) },
      books: { heading: TABLE_UI[language].codices, items: SHELF_BOOKS.map(book => ({ id: book.entry ? book.id : EDITION_WHOLE,
        title: text(book.official), preview: book.entry ? shelfPlate(book.entry) : plate })) },
    }
  }

  /** THE OVERVIEW'S CELLS for a set: each work's name, mark and plate at rest,
      from the registers the live row reads; a cell exists only where a plate resolves */
  async function cells(exhibits: readonly string[]): Promise<DeskOverviewCell[]> {
    assets ??= await loadManifest()
    const out: DeskOverviewCell[] = []
    for (const id of exhibits) {
      // THE KINDS WHOSE NAME IS THEIR OWN RECORD'S, the wall's sheets and the
      // study's leaf, each under the plate at rest the live row shows for it
      const other = otherCell(id, assets)
      if (other !== undefined) { if (other) out.push(other); continue }
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
      } else if (id.startsWith('topic/')) {
        const slug = id.slice('topic/'.length)
        const topic = BEST_OF_TOPICS.find(entry => entry.slug === slug)
        const first = topicPages(slug).find(page => bestOfSource(page, assets!))
        if (!topic || !first) continue
        out.push({ id, kind: 'manuscript', openable: true, title: text(topic.title ?? { en: '', de: '' }),
          sub: topicPagesWord(admitted(slug), lang()), certainty: 'documented',
          preview: bestOfSource(first, assets)?.thumb ?? null })
      } else if (id.startsWith('machine/')) {
        const slug = id.slice('machine/'.length) as MachineSlug
        const entry = assets.byId.get(`vinci/exhibit-preview/machine/${slug}`)
        if (!machineCatalog[slug] || !entry) continue
        out.push({ id, kind: 'machine', openable: true, title: text(machineCatalog[slug].title), certainty: 'reconstructed', preview: assetAddress(entry) })
      }
    }
    return out
  }

  /** A cell of the kinds the live row names from their own records; undefined for the kinds above */
  function otherCell(id: string, index: ManifestIndex): DeskOverviewCell | null | undefined {
    const preview = (key: string): string | null => { const entry = index.byId.get(key); return entry ? assetAddress(entry) : null }
    if (id === DEATHBED || PLACES.has(id)) {
      const named = vinciPlaceTitle(id as VinciPlaceId)
      return { id, kind: id === DEATHBED ? 'picture' : 'place', openable: true, title: named.title, certainty: named.certainty,
        preview: preview(`vinci/exhibit-preview/${id === DEATHBED ? 'picture/deathbed-painting-front' : `place/${id}`}`) }
    }
    if (id.startsWith('sheet/')) {
      const sheet = vinciSheetRecords(id, index)
      return sheet ? { id, kind: 'sheet', openable: true, title: sheet.title, certainty: 'documented', preview: assetAddress(sheet.thumb) } : null
    }
    if (id === VINCI_STUDY_LEAF) {
      // a leaf is named by the codex its stem carries, as the live row names it
      const codex = CODEX_ENTRIES.find(entry => entry.id === id.slice('leaf/'.length).replace(/-\d+[rv]$/, ''))
      return { id, kind: 'manuscript', openable: true, title: codex ? (lang() === 'de' ? codex.de : codex.en) : '', certainty: 'documented',
        preview: preview(`vinci/folio-thumb/${id.slice('leaf/'.length).toLowerCase()}`) }
    }
    return undefined
  }

  return {
    cells,
    shelf,
    tableSet: filmTableSet,
    get id(): string | null { return closeLook.id },
    get surface() { return closeLook.surface },
    open,
    warm,
    close: (pop = true) => closeLook.close(pop),
    /** one level up, the look's own way back */
    back: () => closeLook.back(),
    ways,
    key: (event: KeyboardEvent): boolean => closeLook.key(event),
    layout: () => closeLook.layout(),
    update: (dt: number) => closeLook.update(dt),
    dispose: () => closeLook.dispose(),
  }
}

export type FilmLook = ReturnType<typeof createFilmLook>
