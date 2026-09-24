/** THE WING'S CLOSE LOOK IS THE MUSEUM'S VITRINE.
 *
 * One window and one state owner for every kind, shared by every wing: the
 * one history entry, Back and Escape, where the focus goes and returns, and
 * who draws the stage while a payload stands. This module names the card the
 * wing's marks and row open, and composes what the vitrine shows of this
 * wing out of its registers: the line, the steps, the card's words.
 */
import { createVitrine, type Vitrine, type VitrineExhibit, type VitrinePayload } from '../../vitrine'
import { createTurntablePayload, type TurntableOptions, type TurntableViewpoint } from '../../vitrine/turntable'
import type { ReaderWords } from '../../vitrine/reader'
import { lang } from '../../content'
import { FURTHER, NEARER } from './deep-plate'
import type { Grade, Stack } from '../../../stack'
import { assetAddress } from '../../../stack/materials'
import { loadManifest } from '../../../manifest'
import { dossiers, machineCatalog, type MachineSlug } from '../machines/catalog'
import type { ReadyMachineBuild } from '../machines/runtime'
import { playbackSchedule } from '../machines/bench/playback'
import { BENCH_ABSENCE } from '../machines/bench/registers'
import { setRegister } from '../../frame'
import { deskOn } from '../../desk-switches'
import { GRAVE_EVIDENCE, GRAVE_HOUR, GRAVE_WORDS } from '../grave'
import { GRAVE_DEATHBED } from '../grave/placement'
import { GRAVE_DIAGRAM, GRAVE_SOURCE, INGRES_SOURCE } from '../line/bench/visitor-sources'
import neverSaidRaw from '../line/data/never-said.json?raw'
import linesRaw from '../data/lines.json?raw'
import stepsRaw from '../data/steps.json?raw'
import cardsRaw from '../data/cards.json?raw'
import limitsRaw from '../data/limits.json?raw'
import partsRaw from '../data/parts.json?raw'
import sizesRaw from '../data/sizes.json?raw'

export type VinciCloseLook = Vitrine
export type VinciCloseLookExhibit = VitrineExhibit

/** The card every mark and every row names with aria-controls. */
export const VINCI_EXHIBIT_CARD = 'vinci-exhibit-card'

export function createVinciCloseLook(options: {
  host: HTMLElement
  onOpen(id: string, from: string | null): boolean
  onClose(id: string): void
  narrow(): boolean
  /** The top of the wing's bar, which the window stands clear of. */
  floor(): number
  returnFocus?(id: string): HTMLElement | null
  /** The room the one step back of a close look leads to, in the page's
   * language, which is the station the visitor is standing in. */
  room?(): string
}): VinciCloseLook {
  // The window owns no words: the mark that dismisses it and the grabber
  // that raises its card take the wing's own, in the page's language.
  return createVitrine({ ...options, id: VINCI_EXHIBIT_CARD, lang,
    closeLabel: () => VINCI_VITRINE_WORDS.close[lang()],
    raiseLabel: () => CONTROLS.shared.more[lang()] })
}

type Words = { en: string; de: string }
const LINES = (JSON.parse(linesRaw) as { lines: Record<string, Words> }).lines
const STEPS = (JSON.parse(stepsRaw) as { steps: Record<string, (Words & { at: number; part: string; certainty: string })[]> }).steps
const CARDS = JSON.parse(cardsRaw) as { honesty_variants: { page: Words }; floor_honesty: Words
  zoom_ceiling_scan: Words
  controls: { date: { previous: Words; next: Words; which_year?: Words; age?: Words }
    picture: { whole_plate: Words }
    machine: { viewpoints: (Words & { id: string })[] }
    manuscript: { hand: Words; mirror: Words; print: Words; back_to_leaf: Words; place: Words
      leaves: Words; more_leaf: Words } } }
/** What a page's reproduction is labelled as, beside every page the reader shows. */
export const VINCI_PAGE_HONESTY: Words = CARDS.honesty_variants.page
/** THE READER'S OWN WORDS, in the page's language: the three ways one leaf
 * can be read, where a side stands in its manuscript, and the two the deep
 * viewer needs beside them. The ceiling is the scan's own sentence, because
 * a photograph of a printed facsimile is not "the source". */
export function vinciManuscriptWords(): ReaderWords & { hand: string; mirror: string; print: string
  backToLeaf: string; leaves: string; moreLeaf: string } {
  const language = lang(), words = CARDS.controls.manuscript
  return { hand: words.hand[language], mirror: words.mirror[language], print: words.print[language],
    backToLeaf: words.back_to_leaf[language], place: words.place[language], leaves: words.leaves[language],
    moreLeaf: words.more_leaf[language], whole: CARDS.controls.machine.viewpoints[0]![language],
    nearer: NEARER[language], further: FURTHER[language], ceiling: CARDS.zoom_ceiling_scan[language],
    previous: CARDS.controls.date.previous[language], next: CARDS.controls.date.next[language],
    more: CONTROLS.shared.more[language], moreLabel: words.more_leaf[language], back: words.back_to_leaf[language] }
}
const CONTROLS = (JSON.parse(cardsRaw) as { controls: {
  shared: { back: Words; record: Words; more: Words }
  picture: { whole_plate: Words }
  machine: { provenance: Words; play: Words; pause: Words; clock: Words; viewpoints: (Words & { id: string })[]
    /** A machine whose viewpoint is not the shared one, by slug and viewpoint id. */
    viewpoint_labels?: Record<string, Record<string, Words>> }
} }).controls
type Slot = (Words & { source: string }) | null
const LIMITS = (JSON.parse(limitsRaw) as { slots: Record<string, { limit: Slot; visual_note: Slot }> }).slots
/** A part's name, and what the record says the part is: a prop the museum
 * built for its demonstration, or the screen its demonstration lands on. */
type PartRecord = Words & { demonstration?: boolean; certainty?: string; screen?: boolean }
const PARTS = (JSON.parse(partsRaw) as { parts: Record<string, Record<string, PartRecord>> }).parts
/** THE SIZE A MACHINE HAS, SAID ALOUD. The card speaks it, the record behind
 * the card keeps the three numerals of the same envelope. */
const SIZES = (JSON.parse(sizesRaw) as { sizes: Record<string, Words> }).sizes

/** What the evidence behind an exhibit does not settle, and what the view
 * adds or refuses, in the page's language: the record's two slots. */
export function vinciLimits(id: string): { limit: string | null; visualNote: string | null } {
  const slots = LIMITS[id]
  return { limit: slots?.limit?.[lang()] ?? null, visualNote: slots?.visual_note?.[lang()] ?? null }
}

/** The record's two slots, filled where the text seat wrote them. */
export function fillVinciLimitSlots(id: string, host: HTMLElement): void {
  const { limit, visualNote } = vinciLimits(id)
  for (const [slot, text] of [['limit', limit], ['visual_note', visualNote]] as const) {
    const node = host.querySelector<HTMLElement>(`[data-slot="${slot}"]`)
    if (!node) continue
    node.textContent = text ?? ''
    node.hidden = !text
  }
}

/** The words a control of the vitrine carries, from the card models' file. */
export const VINCI_VITRINE_WORDS = {
  provenance: CONTROLS.machine.provenance,
  wholePlate: CONTROLS.picture.whole_plate,
  more: CONTROLS.shared.more,
  play: CONTROLS.machine.play,
  pause: CONTROLS.machine.pause,
  /** The bench's own word for a finished demonstration started again. */
  again: { en: 'Run again', de: 'Erneut starten' },
  close: { en: 'Close', de: 'Schließen' },
  back: CONTROLS.shared.back,
}

/** The one thing to remember about an exhibit, in the page's language. */
export function vinciLine(id: string): string | null {
  return LINES[id]?.[lang()] ?? null
}

const make = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] => {
  const n = document.createElement(tag); n.className = cls; if (text !== undefined) n.textContent = text; return n
}

/** THE FOLIO A MACHINE WAS READ FROM, where the store holds the page. */
const FOLIO_THUMB: Partial<Record<MachineSlug, string>> = {
  'aerial-screw': 'vinci/ms-thumb/lesmanuscritsdel02lo__n0340',
  'revolving-crane': 'vinci/ms-thumb/lesmanuscritsdel02lo__n0202',
  'camera-obscura': 'vinci/ms-thumb/lesmanuscritsdel02lo__n0386',
}

/** THE THREE VIEWPOINTS of the four-station grammar: the whole, the part a
 * hand or a force drives, and the part that does the work. A machine with
 * no drive of its own has no drive to look at. */
const VIEWPOINT_PARTS: Record<MachineSlug, { drive: string | null; working: string | null }> = {
  'aerial-screw': { drive: 'push-bar-0', working: 'sail' },
  'parachute': { drive: null, working: 'harness' },
  'anemometer': { drive: 'vane', working: 'quadrant' },
  'inclinometer': { drive: 'deck', working: 'pendulum' },
  'multi-barrel-gun': { drive: 'handbar', working: 'bank-0' },
  'rolling-mill': { drive: 'crank-grip', working: 'upper' },
  'ball-bearing': { drive: 'upper-plate', working: 'ball-0' },
  'flywheel': { drive: 'rotor', working: 'weight-0' },
  'revolving-crane': { drive: 'handle', working: 'load' },
  'lathe': { drive: 'footbar', working: 'spindle' },
  'miter-lock-gates': { drive: 'wicket-left', working: 'leaf-left' },
  'water-lifting-screw': { drive: 'handle', working: 'helical-tube' },
  'proportional-compass': { drive: 'screw-head', working: 'leg-left' },
  'camera-obscura': { drive: 'aperture-plate', working: 'screen' },
}

/** A body built outside its record names some parts its own way: these are
 * the dossier's parts under the names that body gives them. */
const STORE_NODE_NAMES: Partial<Record<MachineSlug, Record<string, string>>> = {
  /* The chamber's demonstration is built beside the dossier and its shell is
     welded into one body, so its four museum-built names are the nodes the
     body carries: the lit candle, both faces of the image, the mark at the
     hole, and the box a tap lands on where no wall is a part of its own. */
  'camera-obscura': {
    'candle': 'vinci/camera-obscura/source',
    'image': 'vinci/camera-obscura/image',
    'hole': 'vinci/camera-obscura/hole',
    'chamber': 'camera-obscura',
  },
}

/** A citation marker belongs to the record, never to the card. */
const uncited = (text: string): string => text.replace(/\s*\[\d+(?:\s*,\s*\d+)*\]/g, '')

function folioName(slug: MachineSlug): string {
  return machineCatalog[slug].folio.map(f => `${f.codex} ${lang() === 'de' ? 'Blatt' : 'f.'} ${f.folio}`).join(', ')
}

/** The machine's card, in the card model's order after its line: the
 * description, then the steps the payload lays in, then the certainty, the
 * size said as a sentence and what the model does not show. */
export function vinciMachineCard(slug: MachineSlug, narrow: boolean, certainty: { word: string; colour: string })
  : { card: HTMLElement[]; after: HTMLElement[] } {
  const record = machineCatalog[slug], language = lang()
  const description = make('div', 'vitrine-description')
  description.id = `vitrine-description-${slug}`
  setRegister(description, 'drawer')
  const at = record.sections.en.findIndex(section => section.title === 'The mechanism')
  const mechanism = at < 0 ? null : record.sections[language][at]
  const label = make('p', '', record.label[language])
  if (mechanism) description.append(make('p', '', uncited(mechanism.body)))
  const card: HTMLElement[] = narrow ? [] : [label]
  // TWO TO FOUR SENTENCES ON A CARD. The mechanism is one deliberate control
  // away on the wide stage, and the whole description is on the phone, so the
  // steps stand beside the model where the hand is.
  if (narrow) description.prepend(label)
  /* ONE READ MORE, NOT TWO. Where the label under the work carries its own,
     the description stands open behind it and needs no control of its own. */
  if (deskOn('closelook') && !narrow) {
    description.prepend(label)
    return { card: [description], after: machineAfter(slug, certainty, language) }
  }
  if (description.childElementCount) {
    description.hidden = true
    const more = make('button', 'vitrine-more', VINCI_VITRINE_WORDS.more[language])
    more.type = 'button'
    more.setAttribute('aria-expanded', 'false')
    more.setAttribute('aria-controls', description.id)
    more.addEventListener('click', () => {
      description.hidden = !description.hidden
      more.setAttribute('aria-expanded', String(!description.hidden))
    })
    card.push(more, description)
  }
  return { card, after: machineAfter(slug, certainty, language) }
}

/** What the card carries after the description: how sure the model is, the
 * size said in one plain sentence, and what the museum added or left out. */
function machineAfter(slug: MachineSlug, certainty: { word: string; colour: string }, language: 'en' | 'de'): HTMLElement[] {
  const after: HTMLElement[] = []
  const word = make('p', 'vitrine-certainty', certainty.word)
  word.style.setProperty('--certainty', certainty.colour)
  after.push(word)
  const said = SIZES[slug]?.[language]
  after.push(make('p', 'vitrine-meta', said ?? machineEnvelope(slug, language)))
  const absence = BENCH_ABSENCE[slug]
  if (absence) after.push(make('p', 'vitrine-meta', absence[language]))
  return after
}

/** The envelope's three numerals, in the page's own separator. */
function machineEnvelope(slug: MachineSlug, language: 'en' | 'de'): string {
  const { x, y, z } = dossiers[slug].scale_m
  const metres = (value: number): string => language === 'de' ? String(value).replace('.', ',') : String(value)
  return `${metres(x)} × ${metres(y)} × ${metres(z)} m`
}

/** THE RECORD behind "Where it comes from": the folio, the sections, the
 * arithmetic and what the sheet does not say, and the two slots a text seat
 * fills later. */
export function renderVinciMachineRecord(slug: MachineSlug, host: HTMLElement): void {
  const record = machineCatalog[slug], language = lang()
  const full = make('div', 'vinci-record')
  setRegister(full, 'record')
  for (const folio of record.folio) full.append(make('p', 'vinci-statement', `${folio.codex} ${folio.folio} · ${folio.holder} · ${folio.catalogue_reference}`))
  for (const section of record.sections[language]) full.append(make('h3', '', section.title), make('p', 'vinci-statement', section.body))
  full.append(make('pre', 'vinci-arithmetic', record.arithmetic[language]))
  full.append(make('p', 'vinci-statement', machineEnvelope(slug, language)))
  for (const gap of record.gaps) full.append(make('p', 'vinci-statement', gap))
  for (const slot of ['limit', 'visual_note']) {
    const empty = make('p', 'vinci-statement')
    empty.dataset['slot'] = slot
    empty.hidden = true
    full.append(empty)
  }
  fillVinciLimitSlots(`machine/${slug}`, full)
  host.append(full)
}

export function createVinciMachinePayload(options: {
  stack: Stack
  slug: MachineSlug
  body: ReadyMachineBuild
  grade: Grade
  light: TurntableOptions['light']
  restore(): void
  openRecord(): void
  /** The folio beside the model is a door into the leaf itself, where the
   * wing can open one; without it the folio opens the record. */
  openFolio?(): void
  /** True once the eye stands where it walked for this machine. */
  standing(): boolean
}): VitrinePayload {
  const { slug } = options
  const dossier = dossiers[slug], language = lang(), record = machineCatalog[slug]
  const parts = VIEWPOINT_PARTS[slug]
  const named = CONTROLS.machine.viewpoint_labels?.[slug]
  const viewpoints = CONTROLS.machine.viewpoints.map(entry => ({
    id: entry.id as TurntableViewpoint,
    label: (named?.[entry.id] ?? entry)[language],
    part: entry.id === 'drive' ? parts.drive : entry.id === 'working-part' ? parts.working : null,
  }))
  const sheetLabel = folioName(slug)
  const thumb = FOLIO_THUMB[slug]
  const payload = createTurntablePayload({
    stack: options.stack,
    body: options.body,
    title: record.title[language],
    schedule: playbackSchedule(dossier),
    steps: (STEPS[slug] ?? []).map(step => ({ at: step.at, part: step.part, text: step[language], certainty: step.certainty })),
    parents: new Map(dossier.parts.map(part => [part.id, part.parent])),
    viewpoints,
    words: {
      play: VINCI_VITRINE_WORDS.play[language],
      pause: VINCI_VITRINE_WORDS.pause[language],
      again: VINCI_VITRINE_WORDS.again[language],
      clock: CONTROLS.machine.clock[language],
    },
    nodeNames: STORE_NODE_NAMES[slug],
    partNames: new Map(Object.entries(PARTS[slug] ?? {}).map(([id, words]) => [id, words[language]])),
    screens: new Set(Object.entries(PARTS[slug] ?? {}).filter(([, words]) => words.screen === true).map(([id]) => id)),
    light: options.light,
    grade: options.grade,
    sheet: {
      // the store's own file, never the record's source_url: that address is
      // the holder's page for the sheet and not the picture of it
      src: thumb ? loadManifest().then(index => { const entry = index.byId.get(thumb); return entry?.display ? assetAddress(entry) : null }) : null,
      label: sheetLabel,
      open: options.openFolio ?? options.openRecord,
    },
    restore: options.restore,
    standing: options.standing,
  })
  return payload
}

/* ---- the places and the painting at the grave ------------------------- */

type Both = { en: string; de: string }
const NEVER_SAID = JSON.parse(neverSaidRaw) as {
  court_plaque: { title_en: string; title_de: string; quote: string; line_en: string; line_de: string
    where_en: string; where_de: string; when: string; certainty: string; language_note_de: string }
  deathbed_label: { title_en: string; title_de: string; label_en: string; label_de: string; record_en: string
    record_de: string; last_words_en: string; last_words_de: string; certainty: string }
}
export type VinciPlaceId = 'grave' | 'grave-diagram' | 'plaque/flight-quote'
/** The museum's own certainty word each place is read under. */
export type VinciPlaceCertainty = 'documented' | 'reconstructed' | 'conjectural'
export interface VinciPlaceCard {
  title: string
  certainty: VinciPlaceCertainty
  card: HTMLElement[]
  after: HTMLElement[]
  /** The record behind "Where it comes from". */
  record(host: HTMLElement): void
}

const cut = (text: string): string => text.replace(/\n/g, ' ')
/** A cut or written line in both languages, one paragraph each, the record's
 * register: the stones are read here, not off the floor. */
function bothLanguages(host: HTMLElement, words: Both): void {
  for (const language of ['en', 'de'] as const) {
    const paragraph = make('p', 'vinci-statement', cut(words[language]))
    paragraph.lang = language
    host.append(paragraph)
  }
}
function recordRoot(host: HTMLElement): HTMLElement {
  const full = make('div', 'vinci-record')
  setRegister(full, 'record')
  host.append(full)
  return full
}
function certaintyWord(certainty: { word: string; colour: string }): HTMLElement {
  const word = make('p', 'vitrine-certainty', certainty.word)
  word.style.setProperty('--certainty', certainty.colour)
  return word
}
function drawer(...texts: string[]): HTMLElement {
  const description = make('div', 'vitrine-description')
  setRegister(description, 'drawer')
  for (const text of texts) description.append(make('p', '', text))
  return description
}

/** What a place and the painting are called on a mark and in the row. */
export function vinciPlaceTitle(id: VinciPlaceId | 'picture/deathbed-painting/front'): { title: string; certainty: VinciPlaceCertainty } {
  const language = lang()
  if (id === 'picture/deathbed-painting/front') {
    const label = NEVER_SAID.deathbed_label
    return { title: language === 'de' ? label.title_de : label.title_en, certainty: 'conjectural' }
  }
  if (id === 'plaque/flight-quote') {
    const plate = NEVER_SAID.court_plaque
    return { title: language === 'de' ? plate.title_de : plate.title_en, certainty: 'documented' }
  }
  return id === 'grave-diagram' ? { title: GRAVE_WORDS.diagram[language], certainty: 'reconstructed' }
    : { title: GRAVE_WORDS.slab, certainty: 'documented' }
}

/** A place's card: what it is called where it stands, the reading the museum
 * wrote for it, its certainty, and the record with every cut word. */
export function vinciPlaceCard(id: VinciPlaceId, certainty: (key: VinciPlaceCertainty) => { word: string; colour: string }): VinciPlaceCard {
  const language = lang()
  if (id === 'plaque/flight-quote') {
    const plate = NEVER_SAID.court_plaque
    const quote = make('p', '', plate.quote)
    quote.lang = 'en'
    return {
      title: language === 'de' ? plate.title_de : plate.title_en, certainty: 'documented',
      card: [drawer(language === 'de' ? plate.line_de : plate.line_en)],
      after: [certaintyWord(certainty('documented')), quote, make('p', 'vitrine-meta', `${language === 'de' ? plate.where_de : plate.where_en} · ${plate.when}`)],
      record(host) {
        const full = recordRoot(host)
        bothLanguages(full, { en: plate.title_en, de: plate.title_de })
        full.append(Object.assign(make('p', 'vinci-statement', plate.quote), { lang: 'en' }))
        bothLanguages(full, { en: plate.line_en, de: plate.line_de })
        bothLanguages(full, { en: plate.where_en, de: plate.where_de })
        full.append(make('p', 'vinci-statement', plate.when))
        full.append(Object.assign(make('p', 'vinci-statement', plate.language_note_de), { lang: 'de' }))
      },
    }
  }
  if (id === 'grave-diagram') {
    return {
      title: GRAVE_WORDS.diagram[language], certainty: 'reconstructed',
      card: [drawer(GRAVE_DIAGRAM[language])],
      after: [certaintyWord(certainty('reconstructed'))],
      record(host) {
        const full = recordRoot(host)
        bothLanguages(full, GRAVE_WORDS.diagram)
        bothLanguages(full, GRAVE_WORDS.diagramDate)
        full.append(make('p', 'vinci-statement', GRAVE_EVIDENCE.frame))
        full.append(make('pre', 'vinci-arithmetic', JSON.stringify(GRAVE_HOUR, null, 1)))
        bothLanguages(full, GRAVE_DIAGRAM)
      },
    }
  }
  return {
    title: GRAVE_WORDS.slab, certainty: 'documented',
    card: [drawer(GRAVE_SOURCE[language])],
    after: [certaintyWord(certainty('documented'))],
    record(host) {
      const full = recordRoot(host)
      full.append(make('p', 'vinci-statement', GRAVE_WORDS.slab))
      bothLanguages(full, GRAVE_WORDS.presumption)
      full.append(make('p', 'vinci-statement', GRAVE_WORDS.dig))
      bothLanguages(full, GRAVE_WORDS.identification)
      bothLanguages(full, GRAVE_WORDS.medallionRecord)
      for (const key of ['plaque', 'dig', 'transfer'] as const) full.append(make('p', 'vinci-statement', GRAVE_EVIDENCE[key]))
      bothLanguages(full, GRAVE_WORDS.disclosure)
      bothLanguages(full, GRAVE_SOURCE)
    },
  }
}

/** THE PAINTING AT THE GRAVE, under the card model of a picture: its label,
 * the words its wall label carries, the certainty of the story it shows, and
 * the record of what the letters and the acts of that week say. */
export function vinciDeathbedCard(certainty: { word: string; colour: string }, licence: string | null): VinciPlaceCard {
  const language = lang(), label = NEVER_SAID.deathbed_label
  return {
    title: language === 'de' ? label.title_de : label.title_en, certainty: 'conjectural',
    card: [drawer(language === 'de' ? label.label_de : label.label_en, language === 'de' ? label.last_words_de : label.last_words_en)],
    after: [certaintyWord(certainty), make('p', 'vitrine-meta', `${GRAVE_WORDS.painter} · ${GRAVE_WORDS.holder}`),
      make('p', 'vitrine-meta', GRAVE_WORDS.enlarged[language])],
    record(host) {
      const full = recordRoot(host)
      bothLanguages(full, { en: label.record_en, de: label.record_de })
      bothLanguages(full, { en: label.last_words_en, de: label.last_words_de })
      bothLanguages(full, INGRES_SOURCE)
      bothLanguages(full, GRAVE_WORDS.enlarged)
      full.append(make('pre', 'vinci-arithmetic', JSON.stringify(GRAVE_DEATHBED, null, 1)))
      if (licence) full.append(make('p', 'vinci-statement', licence))
    },
  }
}
