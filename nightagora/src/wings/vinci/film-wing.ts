/* THE WING AS A FILM (`/w/vinci?film=<release>`). The same chrome the live
   wing carries, the frame, the desktop's band, the vitrine and its payloads,
   stands over the picture seam, and the film stands behind it: no room is
   built and nothing is drawn but the machine's live island. Every word comes
   from the wing's own data by key; the phone's rest, walk, wait and dip stand
   in the frozen form's one graded box. */

import { setRegister, type WingHosts, type WingModule, type WingStation } from '../frame'
import { lang, WING_TEXT } from '../content'
import { LOBBY_TEXT } from '../../content/lobby'
import { vinciContent, vinciCertaintyWords, type VinciCertainty, type VinciText } from './content'
import { vinciStory } from './story'
import { deskControl, deskStoryStop } from '../desk-story'
import { applyDeskSteps, deskOn } from '../desk-switches'
import { deskStageHeight } from '../desk-stage'
import { createDeskChrome, deskMark, type DeskChrome, type DeskStation } from '../desk-chrome'
import { gaitPace } from './gait'
import { getWork, findPlateEntries, MAIN_HANG } from './pictures/register'
import { createWindowWorkLabel, policyLabelText, PICTURE_CERTAINTY_KEY } from './pictures/policy-label'
import { validatePaintingRecord } from './pictures/policy'
import { pictureDisplayUV, pictureDisplayWindow } from './pictures/registration'
import { machineCatalog, type MachineSlug } from './machines/catalog'
import { createVinciCloseLook, createVinciMachinePayload, vinciLine, vinciLimits, vinciMachineCard, vinciManuscriptWords, VINCI_EXHIBIT_CARD, VINCI_PAGE_HONESTY, VINCI_VITRINE_WORDS, type VinciCloseLook } from './collection/close-look'
import { vinciLeafSource, vinciPlateDescription } from './collection/deep-plate'
import { createPlatePayload } from '../vitrine/picture'
import { createReaderPayload as createLeafReader } from '../vitrine/reader'
import { createVinciSourcesWindow } from './sources'
import { FAMOUS_FOLIOS, type PageRecord } from './table/content'
import studyPageMap from './table/data/msb-pages.json?raw'
import cardsSource from './data/cards.json?raw'
import { assetAddress } from '../../stack/materials'
import { loadManifest, type ManifestIndex } from '../../manifest'
import { createFilmSource, loadFilmRelease, LEAN_MS, type FilmRelease } from '../picture/film'
import type { PictureMark, PictureNode, PictureSource, PictureState } from '../picture/seam'
import wingCss from './wing.css?inline'
import deskCss from '../desk-chrome.css?inline'
import deskTypeCss from '../desk-type.css?inline'
import deskCloseLookCss from '../desk-closelook.css?inline'
import deskPanelCss from '../desk-panel.css?inline'
import deskMarksCss from '../desk-marks.css?inline'
import deskOverviewCss from '../overview/desk-overview.css?inline'
import filmWingCss from './film-wing.css?inline'

const text = (value: VinciText): string => value[lang()]
const make = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, value?: string): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag)
  node.className = cls
  if (value !== undefined) node.textContent = value
  return node
}
const SVG = 'http://www.w3.org/2000/svg'
function icon(path: string, cls = 'film-ic'): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg')
  svg.setAttribute('viewBox', '0 0 16 16')
  svg.setAttribute('class', cls)
  svg.setAttribute('aria-hidden', 'true')
  const line = document.createElementNS(SVG, 'path')
  line.setAttribute('d', path)
  svg.append(line)
  return svg
}
const ARROW_ON = 'M3 8h10M9 4l4 4-4 4', ARROW_UP = 'M8 13V3M4 7l4-4 4 4', ARROW_DOWN = 'M8 3v10M4 9l4 4 4-4'
const BOOK = 'M8 3.2a4.8 4.8 0 1 0 0 9.6a4.8 4.8 0 1 0 0-9.6M8 6.2v3.6M6.2 8h3.6'
const TRIANGLE_BACK = 'M11 3.5L4.5 8 11 12.5z'
const RING = 2 * Math.PI * 20.5

/** The release the address names: `?film=<name>` under the origin's `/film/`. */
export function filmReleaseBase(): string {
  const name = new URLSearchParams(location.search).get('film') || 'w5'
  return new URL(`/film/${encodeURIComponent(name)}/`, location.origin).href
}

const CARDS = JSON.parse(cardsSource) as { controls: { date: { next: VinciText; previous: VinciText } } }
/** The share of a leg after which the words name the stop ahead, as live. */
const CARD_HANDOVER = 0.5
/** a title on the dark stands one reading at the visitor's pace, and two seconds over */
const READING = { stroll: 8, walk: 10, brisk: 13 } as const
const readingMs = (title: VinciText | null): number => title ? Math.round((2 + text(title).length / READING[gaitPace()]) * 1000) : 900

/** The life's own order, from the story and the stations the wing builds: the
    walk the film was rendered along. */
interface LifeStop { id: string; station: string; name: VinciText }
function lifeStops(): LifeStop[] {
  const built = new Set(vinciContent.map(s => s.id as string))
  const lisa = getWork('mona-lisa')
  const out: LifeStop[] = []
  for (const stop of [...vinciStory].sort((a, b) => a.order - b.order)) {
    if (stop.kind === 'cut') continue
    if (stop.id === 'picture-room-lisa') out.push({ id: stop.id, station: 'picture-room', name: { en: lisa.title_en, de: lisa.title_de } })
    else if (built.has(stop.id)) out.push({ id: stop.id, station: stop.id, name: vinciContent.find(s => s.id === stop.id)!.name })
  }
  return out
}

/** ONE SENTENCE A ROW, cut as the desktop's drawer cuts them: a day of a
    month ends in a short number whose stop is not the sentence's. */
function sentences(said: string): string[] {
  const out: string[] = []
  let start = 0
  for (let i = 0; i < said.length; i++) {
    const mark = said[i]
    if (mark !== '.' && mark !== '!' && mark !== '?') continue
    if (said[i + 1] !== ' ') continue
    const digits = /(\d+)$/.exec(said.slice(start, i))
    if (mark === '.' && digits && digits[1]!.length <= 2) continue
    out.push(said.slice(start, i + 1).trim())
    start = i + 1
  }
  const rest = said.slice(start).trim()
  if (rest) out.push(rest)
  return out
}

const stopNode = (id: string): PictureNode => `stop:${id}`
const viewNode = (exhibit: string): PictureNode => `view:${exhibit}`

/** THE ONE LEAF A MACHINE'S FOLIO OPENS here: manuscript B, folio 83 verso,
    the sheet the aerial screw was read from. */
function screwLeaf(): PageRecord | undefined {
  const pages = (JSON.parse(studyPageMap) as { pages: PageRecord[] }).pages
  return pages.find(page => page.page_kind === 'facsimile' && page.codex === 'B' && page.folio === 83 && page.side === 'verso')
}

export function createWing(): WingModule {
  const LIFE = lifeStops()
  const stationOf = (id: string) => vinciContent.find(s => s.id === id) ?? vinciContent[0]!
  let hosts: WingHosts | undefined
  let release: FilmRelease | undefined
  let picture: PictureSource | undefined
  let desk: DeskChrome | undefined
  let closeLook: VinciCloseLook | undefined
  let sources: ReturnType<typeof createVinciSourcesWindow> | undefined
  let sourceButton: HTMLButtonElement | undefined
  let assets: ManifestIndex | undefined
  let card = 0
  let wide = true
  let loading: Promise<void> | undefined
  let marksAt = ''
  let legUnderWay = false
  let answering: { dot: HTMLButtonElement; id: string } | null = null
  const stood = new Set<string>()
  const controller = new AbortController()
  const signal = controller.signal
  const narrow = (): boolean => innerWidth / innerHeight <= 0.9

  const carried = (index: number): boolean => Boolean(release?.nodes[stopNode(LIFE[index]?.id ?? '')])
  const deskStation = (index: number): DeskStation => ({ id: LIFE[index]!.id, index, count: LIFE.length })
  /** the way on: the next stop of the life this release carries */
  const nextIndex = (): number | null => (card + 1 < LIFE.length && carried(card + 1) ? card + 1 : null)
  const backIndex = (): number | null => (card > 0 && carried(card - 1) ? card - 1 : null)
  const here = (): PictureNode => {
    const s = picture?.state()
    return !s ? stopNode(LIFE[card]!.id) : s.kind === 'rest' ? s.node : s.kind === 'dip' ? s.to : s.from
  }

  /* ---- the picture's box ---- */
  /** the phone's picture is sized once, to the large viewport */
  let tall: HTMLDivElement | undefined
  function box() {
    if (wide) return { left: 0, top: 0, width: innerWidth, height: deskStageHeight() }
    const height = Math.max(innerHeight, tall?.getBoundingClientRect().height ?? 0)
    return { left: 0, top: 0, width: innerWidth, height }
  }

  /* ---- the dip's words: the wing's own chapter card ---- */
  let cutCard: HTMLElement | undefined
  function paintDip(state: PictureState): void {
    if (!hosts) return
    const wing = hosts.stage.parentElement!
    cutCard ??= make('div', 'vinci-cut')
    cutCard.setAttribute('role', 'status')
    if (state.kind === 'dip') {
      const node = release?.nodes[state.to]
      const to = LIFE.find(s => stopNode(s.id) === state.to)
      const title = state.title ? text(state.title) : to ? text(deskStoryStop(to.id)?.chapter ?? to.name) : node?.station ?? ''
      cutCard.textContent = ''
      cutCard.append(make('p', 'vinci-cut-title', title))
      cutCard.hidden = false
      if (!cutCard.isConnected) wing.append(cutCard)
      void cutCard.offsetWidth
      cutCard.dataset['on'] = '1'
      wing.dataset['cut'] = ''
    } else if (cutCard.dataset['on']) {
      delete cutCard.dataset['on']
      delete wing.dataset['cut']
      setTimeout(() => { if (cutCard && !cutCard.dataset['on']) cutCard.hidden = true }, 460)
    }
  }

  /* ---- the marks at rest ---- */
  let dots: HTMLButtonElement[] = []
  let chip: HTMLSpanElement | undefined
  function clearMarks(): void {
    for (const dot of dots) if (dot !== answering?.dot) dot.remove()
    dots = answering ? [answering.dot] : []
    if (chip) chip.hidden = true
  }
  function routable(exhibit: string): boolean {
    return Boolean(release?.edges.some(e => e.to === viewNode(exhibit)))
  }
  function chrome(): { left: number; top: number; right: number; bottom: number } | null {
    const node = hosts?.stage.querySelector<HTMLElement>(wide ? '.desk-low' : '.film-box')
    const r = node?.getBoundingClientRect()
    return r && r.height > 0 ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom } : null
  }
  function nameMark(dot: HTMLButtonElement): void {
    if (!chip || !hosts) return
    const word = dot.dataset['word'] ?? ''
    chip.textContent = ''
    if (word) chip.append(make('span', 'vinci-mark-chip-word', word))
    chip.append(make('span', 'vinci-mark-chip-name', dot.dataset['name'] ?? ''))
    chip.dataset['mark'] = dot.dataset['mark'] ?? 'detail'
    chip.hidden = false
    const x = parseFloat(dot.style.left) || 0, y = parseFloat(dot.style.top) || 0
    const right = x + 26 + chip.offsetWidth <= innerWidth - 22
    chip.dataset['side'] = right ? 'right' : 'left'
    chip.style.left = `${right ? x + 26 : x - 26 - chip.offsetWidth}px`
    chip.style.top = `${y - 18}px`
  }
  function paintMarks(): void {
    if (!hosts || !picture) return
    const node = here()
    const b = picture.box()
    const key = `${node}|${lang()}|${b.width}x${b.height}|${closeLook?.id ?? ''}|${drawerOpen}`
    if (key === marksAt) return
    marksAt = key
    clearMarks()
    if (closeLook?.id || picture.state().kind !== 'rest') return
    const avoid = chrome()
    chip ??= Object.assign(make('span', 'vinci-mark-chip'), { hidden: true })
    chip.setAttribute('aria-hidden', 'true')
    if (!chip.isConnected) hosts.labels.append(chip)
    const marks: PictureMark[] = [...picture.marks(node, lang())].sort((a, c) => a.x - c.x)
    for (const mark of marks) {
      const x = b.left + mark.x, y = b.top + mark.y
      // no mark stands under the museum's own words
      if (avoid && x + 22 > avoid.left && x - 22 < avoid.right && y + 22 > avoid.top && y - 22 < avoid.bottom) continue
      const walks = routable(mark.id)
      const dot = make('button', 'vinci-dot vinci-exhibit-dot film-dot')
      dot.type = 'button'
      dot.style.left = `${x}px`
      dot.style.top = `${y}px`
      dot.style.width = dot.style.height = '44px'
      dot.style.setProperty('--certainty', mark.colour)
      dot.dataset['mark'] = walks ? 'walk' : 'detail'
      dot.dataset['exhibit'] = mark.id
      dot.dataset['name'] = mark.label
      const word = walks ? text(deskControl('walk', 'walk_there')) : ''
      dot.dataset['word'] = word
      dot.setAttribute('aria-label', word ? `${word} · ${mark.label}` : mark.label)
      dot.setAttribute('aria-controls', VINCI_EXHIBIT_CARD)
      dot.setAttribute('aria-expanded', 'false')
      const ring = document.createElementNS(SVG, 'svg')
      ring.setAttribute('class', 'vinci-mark-ring')
      ring.setAttribute('viewBox', '0 0 44 44')
      ring.setAttribute('aria-hidden', 'true')
      const leg = document.createElementNS(SVG, 'circle')
      leg.setAttribute('class', 'vinci-mark-leg')
      leg.setAttribute('cx', '22'); leg.setAttribute('cy', '22'); leg.setAttribute('r', '20.5')
      ring.append(leg)
      dot.append(ring)
      dot.addEventListener('click', () => pressMark(dot, mark.id, walks))
      dot.addEventListener('pointerenter', () => {
        nameMark(dot)
        // a hand resting on a gold mark fetches the start of its walk
        if (walks && !narrow()) {
          const timer = setTimeout(() => picture?.lean(viewNode(mark.id)), LEAN_MS)
          dot.addEventListener('pointerleave', () => clearTimeout(timer), { once: true })
        }
      })
      dot.addEventListener('pointerleave', () => { if (chip && answering?.dot !== dot) chip.hidden = true })
      dot.addEventListener('focus', () => nameMark(dot))
      dot.addEventListener('blur', () => { if (chip && answering?.dot !== dot) chip.hidden = true })
      hosts.labels.append(dot)
      dots.push(dot)
    }
  }
  function pressMark(dot: HTMLButtonElement, id: string, walks: boolean): void {
    if (!picture || closeLook?.id) return
    if (!walks) { openExhibit(id, dot); return }
    // THE MARK ANSWERS BEFORE THE PICTURE MOVES: its word and its ring are the walk
    answering = { dot, id }
    dot.dataset['state'] = 'walking'
    dot.dataset['word'] = text(deskControl('walk', 'walking'))
    nameMark(dot)
    void picture.go(viewNode(id)).then(at => {
      if (answering?.dot === dot) { dot.remove(); answering = null }
      marksAt = ''
      if (at === viewNode(id) || picture?.state().kind === 'rest') openExhibit(id, null)
    })
  }

  /* ---- the close look, over the film ---- */
  const standing = (): boolean => picture?.state().kind === 'rest'
  const control = (words: VinciText, run: () => void, role = ''): HTMLButtonElement => {
    const button = make('button', 'vitrine-control', text(words))
    button.type = 'button'
    button.addEventListener('click', run)
    if (role) button.dataset['role'] = role
    return button
  }
  const shut = (): HTMLButtonElement => control(VINCI_VITRINE_WORDS.close, () => closeLook?.close(), 'close')
  function certaintyColour(key: VinciCertainty): string {
    const order: VinciCertainty[] = ['documented', 'unknown', 'reconstructed', 'conjectural']
    return PICTURE_CERTAINTY_KEY[order.indexOf(key)]!.colour
  }
  function openRecord(id: string, title: VinciText, certainty: VinciCertainty, render: (host: HTMLElement) => void): void {
    if (!sources) return
    paintSources({ id, title, certainty, render })
    sources.resetScroll()
    sources.select('station')
    sources.setOpen(true)
  }
  /* ONE TEXT AT A TIME: on the phone the box stands down before a close look
     opens, so the work takes the whole glass and the vitrine's card is the text */
  function standDown(down: boolean): void {
    if (!phone) return
    phone.root.hidden = down
    if (down && drawerOpen) setDrawer(false)
  }
  async function openExhibit(id: string, from: HTMLElement | null): Promise<void> {
    if (!closeLook || !hosts) return
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
        description: vinciPlateDescription(id), aspect: plate.pixels.width / plate.pixels.height, window: cut, standing,
      })
      const colour = policyLabelText(work, entries).colour
      const order: VinciCertainty[] = ['documented', 'unknown', 'reconstructed', 'conjectural']
      const certainty = order[Math.max(0, PICTURE_CERTAINTY_KEY.findIndex(entry => entry.colour === colour))] ?? 'reconstructed'
      standDown(true)
      closeLook.open({ id, title, line: vinciLine(id), card: [createWindowWorkLabel(work, entries, lang(), narrow())], payload,
        controls: [control(VINCI_VITRINE_WORDS.provenance, () => openRecord(id, { en: work.title_en, de: work.title_de }, certainty,
          host => host.append(make('p', 'vinci-statement', `${work.holder} · ${text({ en: work.date_label_en, de: work.date_label_de })}`))), 'record'), shut()],
        ...vinciLimits(id), set: hangPlace(id), certainty }, from, 'enter')
      return
    }
    if (id.startsWith('machine/')) {
      const slug = id.slice('machine/'.length) as MachineSlug
      // the island's builders and the wing's own print arrive only when it opens
      const [{ buildMachine }, { PRINT, STATION_EXPOSURE, KEY_RIG }] = await Promise.all([import('./machines'), import('./print')])
      const stack = hosts.world.stack
      const body = buildMachine(slug, stack)
      const title = machineCatalog[slug].title[lang()]
      const words = vinciMachineCard(slug, narrow(), { word: text(vinciCertaintyWords.reconstructed), colour: PICTURE_CERTAINTY_KEY[2]!.colour })
      const record = (): void => openRecord(id, machineCatalog[slug].title, 'reconstructed', host => host.append(make('p', 'vinci-statement', text(machineCatalog[slug].label))))
      const payload = createVinciMachinePayload({ stack, slug, body,
        grade: { ...PRINT, exposure: STATION_EXPOSURE[stationOf(LIFE[card]!.station).id] ?? PRINT.exposure }, light: KEY_RIG,
        openRecord: record,
        openFolio: slug === 'aerial-screw' ? () => openLeaf(id) : undefined,
        // the island is the one live picture: the film stands aside while it draws
        restore: () => { picture?.veil(false); stack.setScene(hosts!.world.scene, hosts!.world.camera, PRINT) },
        standing })
      picture?.veil(true)
      standDown(true)
      closeLook.open({ id, title, line: vinciLine(id), card: words.card, after: words.after, payload,
        controls: [control(VINCI_VITRINE_WORDS.provenance, record, 'record'), shut()], ...vinciLimits(id), set: null, certainty: 'reconstructed' }, from, 'enter')
      return
    }
  }
  /** THE SHEET: the leaf the screw was read from, opened in the reader where
      the visitor stands, as the live wing opens the study's own leaf */
  function openLeaf(machine: string): void {
    const leaf = screwLeaf()
    if (!leaf || !assets || !closeLook) return
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
      stripLabel: () => text(stationOf(LIFE[card]!.station).name), holder: '', honesty: text(VINCI_PAGE_HONESTY) }),
      start: 'screw-leaf', words: vinciManuscriptWords(), tier: () => 'standard' })
    closeLook.open({ id: door, title, line: null, card: [], payload: reader,
      controls: [control(VINCI_VITRINE_WORDS.provenance, () => openRecord(door, { en: named?.en ?? '', de: named?.de ?? '' }, 'documented',
        host => { for (const line of [shows, scan.licence ?? '']) if (line) host.append(make('p', 'vinci-statement', line)) }), 'record'),
      control(VINCI_VITRINE_WORDS.back, () => void openExhibit(machine, null), 'back'), shut()], set: null, certainty: 'documented' }, null, 'advance')
  }
  /** where a work stands in the hang, the row's own count */
  function hangPlace(id: string): { at: number; of: number } | null {
    const workId = id.split('/')[1]
    const at = MAIN_HANG.findIndex(work => work.id === workId)
    return at < 0 ? null : { at: at + 1, of: MAIN_HANG.length }
  }

  /* ---- the record: the station's own statements, one window ---- */
  let recordOf: { id: string; title: VinciText; certainty: VinciCertainty; render: (host: HTMLElement) => void } | null = null
  function paintSources(exhibit: typeof recordOf = recordOf): void {
    if (!sources) return
    recordOf = exhibit
    const s = stationOf(LIFE[card]!.station)
    const panel = sources.panels.station
    panel.textContent = ''
    const certainty = exhibit?.certainty ?? (s.built ? s.carrierCertainty : 'unknown')
    const head = make('p', 'vinci-certainty', text(vinciCertaintyWords[certainty]))
    head.dataset['certainty'] = certainty
    panel.append(head, make('h2', '', text(exhibit?.title ?? s.name)))
    if (exhibit) { exhibit.render(panel); return }
    for (const label of s.labels) {
      const p = make('p', 'vinci-statement')
      p.dataset['certainty'] = label.certainty
      p.append(make('span', 'vinci-certainty-word', text(vinciCertaintyWords[label.certainty])), document.createTextNode(' ' + text(label)))
      panel.append(p)
    }
    panel.append(make('p', 'vinci-promise', text(s.promise)))
    const full = make('div', 'vinci-record')
    setRegister(full, 'record')
    full.append(make('p', 'vinci-statement', text(s.record ?? s.promise)), make('small', 'vinci-citation', s.promiseSource))
    panel.append(full)
    panel.append(make('p', 'vinci-door-disclosure', text(WING_TEXT.doorNote)))
  }

  /* ---- the phone's graded box ---- */
  let phone: {
    root: HTMLElement; name: HTMLElement; line: HTMLElement; drawer: HTMLElement; keys: HTMLElement
    more: HTMLButtonElement; from: HTMLButtonElement; count: HTMLElement
    back: HTMLButtonElement; book: HTMLButtonElement; gold: HTMLButtonElement; goldName: HTMLElement; ringLine: SVGCircleElement
  } | undefined
  let drawerOpen = false
  function buildPhone(h: WingHosts): void {
    const root = make('div', 'film-box')
    const name = make('div', 'film-name')
    const line = make('p', 'film-line')
    const drawer = make('div', 'film-drawer')
    drawer.id = 'film-drawer'
    setRegister(drawer, 'drawer')
    drawer.hidden = true
    const keys = make('div', 'film-keys')
    const more = make('button', 'film-key film-more')
    more.type = 'button'
    more.setAttribute('aria-controls', drawer.id)
    const from = make('button', 'film-key film-from')
    from.type = 'button'
    const count = make('span', 'film-count')
    keys.append(more, from, count)
    const foot = make('div', 'film-foot')
    const back = make('button', 'film-back')
    back.type = 'button'
    // the frozen phone form draws its way back as a filled triangle
    back.append(icon(TRIANGLE_BACK, 'film-ic film-ic-fill'))
    const book = make('button', 'film-book')
    book.type = 'button'
    book.append(icon(BOOK))
    const gold = make('button', 'film-gold')
    gold.type = 'button'
    const goldName = make('span', 'film-gold-name')
    const arrow = make('span', 'film-gold-arrow')
    const ring = document.createElementNS(SVG, 'svg')
    ring.setAttribute('viewBox', '0 0 44 44')
    ring.setAttribute('class', 'film-gold-ring')
    ring.setAttribute('aria-hidden', 'true')
    const ringLine = document.createElementNS(SVG, 'circle')
    ringLine.setAttribute('cx', '22'); ringLine.setAttribute('cy', '22'); ringLine.setAttribute('r', '20.5')
    ring.append(ringLine)
    arrow.append(ring, icon(ARROW_ON))
    gold.append(goldName, arrow)
    foot.append(back, book, gold)
    root.append(name, line, drawer, keys, foot)
    h.stage.append(root)
    more.addEventListener('click', () => setDrawer(!drawerOpen))
    from.addEventListener('click', () => { paintSources(null); sources?.select('station'); sources?.setOpen(true) })
    back.addEventListener('click', () => { const to = backIndex(); if (to !== null) h.navigate(to) })
    book.addEventListener('click', () => document.getElementById('rail-instruments')?.click())
    gold.addEventListener('click', () => pressOn())
    // a swipe up raises the words, a swipe down or a tap on the picture folds them
    let fromY = 0, held = false
    root.addEventListener('pointerdown', e => { held = true; fromY = e.clientY }, { signal })
    root.addEventListener('pointerup', e => {
      if (!held) return
      held = false
      const dy = e.clientY - fromY
      if (dy < -24 && !drawerOpen) setDrawer(true)
      else if (dy > 24 && drawerOpen) setDrawer(false)
    }, { signal })
    phone = { root, name, line, drawer, keys, more, from, count, back, book, gold, goldName, ringLine }
  }
  function setDrawer(open: boolean): void {
    if (!phone) return
    const stop = deskStoryStop(LIFE[card]!.id)
    drawerOpen = open && Boolean(stop?.drawer)
    phone.root.dataset['drawer'] = String(drawerOpen)
    phone.drawer.hidden = !drawerOpen
    phone.line.hidden = drawerOpen
    phone.more.setAttribute('aria-expanded', String(drawerOpen))
    paintPhone()
    marksAt = ''
  }
  function paintPhone(): void {
    if (!phone || !hosts) return
    const id = LIFE[card]!.id
    const stop = deskStoryStop(id)
    phone.name.textContent = ''
    phone.name.append(deskMark(stop?.certainty ?? 'reconstructed'), make('span', 'film-chapter', text(stop?.chapter ?? LIFE[card]!.name)))
    if (stop?.age) phone.name.append(make('span', 'film-clock', text(stop.age)))
    phone.line.textContent = stop ? text(stop.line) : ''
    phone.drawer.textContent = ''
    if (drawerOpen && stop?.drawer) {
      for (const sentence of sentences(text(stop.drawer))) phone.drawer.append(make('p', '', sentence))
      const door = hosts.stage.parentElement!.querySelector<HTMLElement>('.wing-door')
      if (door) {
        const ask = make('button', 'film-ask', door.textContent ?? '')
        ask.type = 'button'
        ask.append(icon('M5 11l6-6M6 5h5v5', 'film-ic film-ic-out'))
        ask.addEventListener('click', () => door.click())
        phone.drawer.append(ask)
      }
    }
    phone.more.textContent = ''
    phone.more.append(document.createTextNode(text(drawerOpen ? LOBBY_TEXT.close : deskControl('shared', 'read_more'))), icon(drawerOpen ? ARROW_DOWN : ARROW_UP))
    phone.more.hidden = !stop?.drawer
    phone.from.textContent = text(deskControl('machine', 'provenance'))
    phone.count.textContent = `${String(card + 1).padStart(2, '0')} / ${LIFE.length}`
    const back = backIndex()
    phone.back.disabled = back === null
    phone.back.setAttribute('aria-label', text(CARDS.controls.date.previous))
    phone.book.setAttribute('aria-label', document.getElementById('rail-instruments')?.getAttribute('aria-label') || text(deskControl('ways', 'chapters')))
    paintGold()
  }
  let goldWalking: boolean | null = null
  function paintGold(): void {
    if (!phone) return
    const s = picture?.state()
    const walking = s?.kind === 'walk' || s?.kind === 'dip'
    goldWalking = walking
    // WAITING, the words stay and the gold keeps its name; its ring counts the bytes
    phone.gold.dataset['wait'] = String(s?.kind === 'wait')
    const to = nextIndex()
    phone.root.dataset['walking'] = String(walking)
    phone.gold.dataset['leg'] = String(walking)
    if (walking) {
      phone.goldName.textContent = text(deskControl('walk', 'walk_faster'))
      phone.gold.setAttribute('aria-label', `${text(deskControl('walk', 'walking'))} · ${text(deskControl('walk', 'walk_faster'))}`)
    } else {
      const title = to === null ? null : text(deskStoryStop(LIFE[to]!.id)?.chapter ?? LIFE[to]!.name)
      phone.goldName.textContent = title ?? text(deskControl('walk', 'the_end'))
      phone.gold.setAttribute('aria-label', title ? `${text(CARDS.controls.date.next)} · ${title}` : text(deskControl('walk', 'the_end')))
    }
    phone.gold.disabled = !walking && to === null
  }
  function pressOn(): void {
    const s = picture?.state()
    if (s && s.kind !== 'rest') { picture?.hurry(); return }
    const to = nextIndex()
    if (to !== null) hosts?.navigate(to)
  }

  /* ---- the words of the place, painted where the design stands them ---- */
  function paint(): void {
    desk?.paint()
    // the way back leads nowhere this release carries: it stands disabled
    const back = hosts?.stage.querySelector<HTMLButtonElement>('.desk-back')
    if (back && backIndex() === null && card > 0) back.disabled = true
    paintPhone()
    paintSources()
    marksAt = ''
    const s = stationOf(LIFE[card]!.station)
    const q = hosts?.stage.parentElement?.querySelector('.wing-question')
    if (q) q.textContent = text(s.door)
  }
  function ahead(): void {
    const next = nextIndex()
    if (next !== null) picture?.ahead([stopNode(LIFE[next]!.id)])
  }

  async function mount(h: WingHosts): Promise<void> {
    hosts = h
    wide = !narrow()
    const wing = h.stage.parentElement!
    h.stage.textContent = ''
    wing.dataset['wing'] = 'vinci'
    wing.dataset['film'] = wide ? 'wide' : 'upright'
    if (wide) applyDeskSteps(wing)
    else delete wing.dataset['desk']
    const style = make('style', '')
    style.textContent = [wingCss, deskTypeCss, deskCss, deskCloseLookCss, deskPanelCss, deskMarksCss, deskOverviewCss, filmWingCss].join('\n')
    h.stage.append(style)
    tall = make('div', 'film-tall')
    h.stage.append(tall)
    release = await loadFilmRelease(filmReleaseBase())
    if (!hosts) return
    // the visit enters at the stop asked for, or at the first this release carries
    if (!carried(card)) card = Math.max(0, LIFE.findIndex((_, i) => carried(i)))
    picture = createFilmSource({ host: h.stage, base: filmReleaseBase(), release, at: stopNode(LIFE[card]!.id),
      framing: () => (wide ? 'wide' : 'upright'), box, pace: () => gaitPace(), hold: title => readingMs(title) })
    picture.on('state', state => { paintDip(state); if (state.kind === 'rest') marksAt = '' })
    picture.on('rest', state => {
      if (state.kind !== 'rest') return
      const at = LIFE.findIndex(s => stopNode(s.id) === state.node)
      if (at >= 0 && at !== card) { card = at; paint() }
      stood.add(LIFE[card]!.id)
      paintGold()
      ahead()
    })
    if (wide && (deskOn('words') || deskOn('ways'))) desk = createDeskChrome({
      stage: h.stage, wing, lang,
      standing: () => deskStation(card),
      next: () => { const to = nextIndex(); return to === null ? null : deskStation(to) },
      order: () => LIFE.map(s => s.id),
      stood: () => [...stood],
      name: id => LIFE.find(s => s.id === id)?.name ?? { en: '', de: '' },
      door: () => wing.querySelector<HTMLElement>('.wing-door'),
      sources: () => sourceButton ?? null,
      question: () => text(stationOf(LIFE[card]!.station).door),
      words: { next: CARDS.controls.date.next, back: CARDS.controls.date.previous, rail: WING_TEXT.rail },
      go: index => { if (carried(index)) h.navigate(index) },
      // a wait is not a walk: the words and the way on stand until the clip can play through
      leg: () => { const s = picture?.state(); return s?.kind === 'walk' ? s.share : null },
      hurry: () => picture?.hurry(),
    })
    if (!wide) {
      buildPhone(h)
      /* THE BOOK OPENS THE MUSEUM'S PANEL, and the wing's own row stands at its
         head, Lobby first, as the desktop's panel publishes it */
      const lobbyWord = (): string => wing.querySelector('.wing-lobby')?.textContent?.trim() || text(WING_TEXT.lobby)
      dispatchEvent(new CustomEvent('na-wing-instruments', { detail: { rows: [{ id: 'lobby', label: lobbyWord(), mark: 'back' }] } }))
      addEventListener('na-wing-instrument', event => {
        if ((event as CustomEvent<{ row?: string }>).detail?.row === 'lobby') wing.querySelector<HTMLElement>('.wing-lobby')?.click()
      }, { signal })
    }
    sourceButton = make('button', 'vinci-source', lang() === 'de' ? 'Quellen' : 'Sources')
    sourceButton.type = 'button'
    sourceButton.setAttribute('aria-controls', 'vinci-source-card')
    sourceButton.addEventListener('click', () => { paintSources(null); sources?.select('station'); sources?.setOpen(true) })
    wing.querySelector('.wing-rail-group')?.append(sourceButton)
    sources = createVinciSourcesWindow(h.labels, sourceButton, () => { sources?.setOpen(false); recordOf = null })
    closeLook = createVinciCloseLook({ host: h.labels, narrow,
      room: () => text(stationOf(LIFE[card]!.station).name),
      returnFocus: () => wing.querySelector<HTMLElement>('.desk-on, .film-gold'),
      floor: () => desk?.floor() ?? (phone && !phone.root.hidden ? phone.root.getBoundingClientRect().top : innerHeight),
      // the film has already walked there: the window opens where the eye stands
      onOpen: () => false,
      onClose: () => { marksAt = ''; picture?.veil(false); standDown(false) } })
    window.addEventListener('keydown', e => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return
      if (document.querySelector('dialog[open]')) return
      const target = e.target instanceof Element ? e.target : document.body
      if (target.closest('input,textarea,select')) return
      if (closeLook?.id && closeLook.key(e)) { e.preventDefault(); return }
      if (closeLook?.id && e.key === 'Escape') { e.preventDefault(); closeLook.close(); return }
      if (closeLook?.id) return
      if (e.key === 'Escape' && desk?.key(e)) { e.preventDefault(); return }
      if (e.key === 'Escape' && drawerOpen) { e.preventDefault(); setDrawer(false); return }
      if (desk?.key(e)) { e.preventDefault(); return }
      if (!desk && (e.key === ' ' || e.key === 'Spacebar') && !target.closest('button,a')) { e.preventDefault(); pressOn(); return }
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); pressOn() }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); const to = backIndex(); if (to !== null) h.navigate(to) }
    }, { signal })
    // a press on the picture folds the phone's words back to the one line
    h.stage.addEventListener('click', e => { if (drawerOpen && !(e.target as Element).closest('.film-box')) setDrawer(false) }, { signal })
    addEventListener('resize', () => { marksAt = ''; closeLook?.layout() }, { signal })
    stood.add(LIFE[card]!.id)
    paint()
    await picture.ready()
    ahead()
  }

  const module: WingModule = {
    stations: LIFE.map((s): WingStation => ({ id: s.id, name: text(s.name), question: text(stationOf(s.station).door) })),
    doorDisclosure: 'first-press',
    navigation: () => {
      const s = picture?.state()
      const target = s && s.kind !== 'rest' ? LIFE.find(l => stopNode(l.id) === (s.kind === 'dip' ? s.to : s.target))?.id : undefined
      return { completed: LIFE[card]!.id, ...(target ? { target } : {}), question: text(stationOf(LIFE[card]!.station).door) }
    },
    show(index, h) {
      if (!hosts) {
        card = Math.max(0, Math.min(LIFE.length - 1, index))
        // a release that cannot be read leaves the entry, never holds it at the gold field
        loading = mount(h).catch(err => console.error(`the film could not stand: ${String(err)}`))
        return
      }
      if (!picture || !carried(index)) return
      closeLook?.close()
      if (drawerOpen) setDrawer(false)
      void picture.go(stopNode(LIFE[index]!.id))
    },
    async ready(report) {
      report?.({ stage: 'house', share: null })
      await loading
      report?.({ stage: 'walk', share: 1 })
    },
    language() {
      module.stations = LIFE.map(s => ({ id: s.id, name: text(s.name), question: text(stationOf(s.station).door) }))
      if (sourceButton) sourceButton.textContent = lang() === 'de' ? 'Quellen' : 'Sources'
      paint()
    },
    // nothing draws but the machine's live island: the film is DOM over a held canvas
    held: () => closeLook?.surface !== 'own',
    update(dt = 0) {
      if (!hosts || !picture) return
      picture.update()
      closeLook?.update(dt)
      const s = picture.state()
      // THE WORDS NAME THE STOP AHEAD FROM THE HALF OF THE LEG, as the live card does
      if (s.kind === 'walk' && s.share >= CARD_HANDOVER) {
        const at = LIFE.findIndex(l => stopNode(l.id) === s.to)
        if (at >= 0 && at !== card) { card = at; paint() }
      }
      const underWay = s.kind === 'walk' || s.kind === 'dip'
      if (underWay !== legUnderWay) {
        legUnderWay = underWay
        hosts.walking(underWay)
        if (underWay) clearMarks()
        paintGold()
        marksAt = ''
      }
      if (phone && (goldWalking !== underWay || phone.gold.dataset['wait'] !== String(s.kind === 'wait'))) paintGold()
      if (phone) {
        const share = s.kind === 'walk' || s.kind === 'wait' ? s.share : 0
        phone.ringLine.setAttribute('stroke-dasharray', `${(RING * share).toFixed(1)} ${RING.toFixed(1)}`)
      }
      if (answering) {
        const leg = answering.dot.querySelector<SVGCircleElement>('.vinci-mark-leg')
        const share = s.kind === 'walk' ? s.share : 0
        leg?.setAttribute('stroke-dasharray', `${(2 * Math.PI * 20.5 * share).toFixed(1)} ${(2 * Math.PI * 20.5).toFixed(1)}`)
      }
      desk?.update()
      if (s.kind === 'rest') paintMarks()
      else if (s.kind === 'wait' && dots.length) clearMarks()
    },
    stop() {
      controller.abort()
      desk?.dispose(); desk = undefined
      closeLook?.dispose(); closeLook = undefined
      sources?.dispose(); sources = undefined
      sourceButton?.remove(); sourceButton = undefined
      picture?.dispose(); picture = undefined
      clearMarks(); chip?.remove(); answering?.dot.remove(); answering = null
      cutCard?.remove()
      if (hosts) {
        const wing = hosts.stage.parentElement!
        delete wing.dataset['wing']; delete wing.dataset['film']; delete wing.dataset['cut']
        hosts.stage.textContent = ''
      }
      hosts = undefined
    },
  }
  return module
}
