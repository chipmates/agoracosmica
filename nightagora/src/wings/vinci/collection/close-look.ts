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
import { lang } from '../../content'
import type { Grade, Stack } from '../../../stack'
import { ASSET_BASE } from '../../../stack/materials'
import { assetUrl, loadManifest } from '../../../manifest'
import { dossiers, machineCatalog, type MachineSlug } from '../machines/catalog'
import type { ReadyMachineBuild } from '../machines/runtime'
import { playbackSchedule } from '../machines/bench/playback'
import { BENCH_ABSENCE } from '../machines/bench/registers'
import { setRegister } from '../../frame'
import linesRaw from '../data/lines.json?raw'
import stepsRaw from '../data/steps.json?raw'
import cardsRaw from '../data/cards.json?raw'

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
}): VinciCloseLook {
  return createVitrine({ ...options, id: VINCI_EXHIBIT_CARD, lang })
}

type Words = { en: string; de: string }
const LINES = (JSON.parse(linesRaw) as { lines: Record<string, Words> }).lines
const STEPS = (JSON.parse(stepsRaw) as { steps: Record<string, (Words & { at: number; part: string; certainty: string })[]> }).steps
const CONTROLS = (JSON.parse(cardsRaw) as { controls: {
  shared: { back: Words; record: Words; more: Words }
  picture: { whole_plate: Words }
  machine: { provenance: Words; play: Words; pause: Words; viewpoints: (Words & { id: string })[] }
} }).controls

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
  'camera-obscura': { drive: null, working: 'screen' },
}

/** The crane stands out of the store, and its body names its joints its own
 * way: these are the dossier's parts under the names that body gives them. */
const STORE_NODE_NAMES: Partial<Record<MachineSlug, Record<string, string>>> = {
  // The crank turns on the drum's own axle, so the body carries it in the drum.
  'revolving-crane': { 'handle': 'drum', 'hoist-rope': 'rope-fall' },
}

/** A citation marker belongs to the record, never to the card. */
const uncited = (text: string): string => text.replace(/\s*\[\d+(?:\s*,\s*\d+)*\]/g, '')

function folioName(slug: MachineSlug): string {
  return machineCatalog[slug].folio.map(f => `${f.codex} ${lang() === 'de' ? 'Blatt' : 'f.'} ${f.folio}`).join(', ')
}

/** The machine's card, in the card model's order after its line: the
 * description, then the steps the payload lays in, then the certainty, the
 * size the dossier gives and what the model does not show. */
export function vinciMachineCard(slug: MachineSlug, narrow: boolean, certainty: { word: string; colour: string })
  : { card: HTMLElement[]; after: HTMLElement[] } {
  const record = machineCatalog[slug], dossier = dossiers[slug], language = lang()
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
  const after: HTMLElement[] = []
  const word = make('p', 'vitrine-certainty', certainty.word)
  word.style.setProperty('--certainty', certainty.colour)
  after.push(word)
  const { x, y, z } = dossier.scale_m
  const metres = (value: number): string => language === 'de' ? String(value).replace('.', ',') : String(value)
  after.push(make('p', 'vitrine-meta', `${metres(x)} × ${metres(y)} × ${metres(z)} m`))
  const absence = BENCH_ABSENCE[slug]
  if (absence) after.push(make('p', 'vitrine-meta', absence[language]))
  return { card, after }
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
  for (const gap of record.gaps) full.append(make('p', 'vinci-statement', gap))
  for (const slot of ['limit', 'visual_note']) {
    const empty = make('p', 'vinci-statement')
    empty.dataset['slot'] = slot
    empty.hidden = true
    full.append(empty)
  }
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
}): VitrinePayload {
  const { slug } = options
  const dossier = dossiers[slug], language = lang(), record = machineCatalog[slug]
  const parts = VIEWPOINT_PARTS[slug]
  const viewpoints = CONTROLS.machine.viewpoints.map(entry => ({
    id: entry.id as TurntableViewpoint,
    label: entry[language],
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
      // ASK: the clock's own name. Until it is written the slider carries the
      // machine's title, which is what it turns.
      clock: record.title[language],
    },
    nodeNames: STORE_NODE_NAMES[slug],
    light: options.light,
    grade: options.grade,
    sheet: {
      src: thumb ? loadManifest().then(index => { const entry = index.byId.get(thumb); return entry?.display ? assetUrl(ASSET_BASE, entry) : null }) : null,
      label: sheetLabel,
      open: options.openRecord,
    },
    restore: options.restore,
  })
  return payload
}
