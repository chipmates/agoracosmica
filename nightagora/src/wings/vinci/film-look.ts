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
import { createVinciCloseLook, createVinciMachinePayload, vinciLine, vinciLimits, vinciMachineCard, vinciManuscriptWords, VINCI_EXHIBIT_CARD, VINCI_PAGE_HONESTY, VINCI_VITRINE_WORDS } from './collection/close-look'
import { vinciLeafSource, vinciPlateDescription } from './collection/deep-plate'
import { createPlatePayload } from '../vitrine/picture'
import { createReaderPayload as createLeafReader } from '../vitrine/reader'
import { FAMOUS_FOLIOS, type PageRecord } from './table/content'
import studyPageMap from './table/data/msb-pages.json?raw'
import { assetAddress } from '../../stack/materials'
import { loadManifest, type ManifestIndex } from '../../manifest'

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
    assets ??= await loadManifest()
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
      // the island's builders and the wing's own print arrive only when it opens
      const [{ buildMachine }, { PRINT, STATION_EXPOSURE, KEY_RIG }] = await Promise.all([import('./machines'), import('./print')])
      const body = buildMachine(slug, h.stack)
      const title = machineCatalog[slug].title[lang()]
      const words = vinciMachineCard(slug, h.narrow(), { word: text(vinciCertaintyWords.reconstructed), colour: PICTURE_CERTAINTY_KEY[2]!.colour })
      const record = (): void => h.openRecord(id, machineCatalog[slug].title, 'reconstructed', host => host.append(make('p', 'vinci-statement', text(machineCatalog[slug].label))))
      const payload = createVinciMachinePayload({ stack: h.stack, slug, body,
        grade: { ...PRINT, exposure: STATION_EXPOSURE[h.station() as keyof typeof STATION_EXPOSURE] ?? PRINT.exposure }, light: KEY_RIG,
        openRecord: record,
        openFolio: slug === 'aerial-screw' ? () => openLeaf(id) : undefined,
        // the island is the one live picture: the film stands aside while it draws
        restore: () => { h.veil(false); h.stack.setScene(h.scene, h.camera, PRINT) },
        standing: h.standing })
      h.veil(true)
      h.standDown(true)
      closeLook.open({ id, title, line: vinciLine(id), card: words.card, after: words.after, payload,
        controls: [control(VINCI_VITRINE_WORDS.provenance, record, 'record'), shut()], ...vinciLimits(id), set: null, certainty: 'reconstructed' }, from, 'enter')
    }
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

  return {
    get id(): string | null { return closeLook.id },
    get surface() { return closeLook.surface },
    open,
    close: () => closeLook.close(),
    key: (event: KeyboardEvent): boolean => closeLook.key(event),
    layout: () => closeLook.layout(),
    update: (dt: number) => closeLook.update(dt),
    dispose: () => closeLook.dispose(),
  }
}

export type FilmLook = ReturnType<typeof createFilmLook>
