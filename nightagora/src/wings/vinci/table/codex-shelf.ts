import shelfText from './data/codices.json?raw'
import sidesText from './data/codex-sides.json?raw'
import { loadManifest, type ManifestEntry } from '../../../manifest'
import { assetAddress } from '../../../stack/materials'
import { CODEX_TITLES, SHELF_UI, TABLE_UI, type Language } from './content'
import { bestOfKey, type BestOfKey } from './best-of'

/** The shelf's register of codices. Counts are scans or edition pages, never
 * manuscript folio totals. */
export interface CodexEntry {
  id: string
  en: string
  de: string
  holder_en: string
  holder_de: string
  tier: 'TIER1' | 'TIER2'
  class_en: string
  class_de: string
  state: 'table' | 'collection'
  open: string | null
  count_en: string
  count_de: string
  map: string
  plate?: string
  plate_w?: number
  plate_h?: number
}

export interface CodexAbsence {
  id: string
  en: string
  de: string
  holder_en: string
  holder_de: string
  reason_en: string
  reason_de: string
  /** an absence the admission of the Institut's and the British Library's
   * own views overtook: its reason is this key's, and it stands down until
   * the key is written */
  words_key?: BestOfKey
}

/** One side of a codex the reader turns, as the table read it off the scans:
 * the scan, the folio where a source names it, the printed transcription
 * facing it where the edition prints one, and the line the map wrote for it
 * where that line is shown. */
export interface CodexSide {
  file: string
  folio?: string | null
  print?: string
  shows_en?: string
  shows_de?: string
  /** The printed plate's rectangle on a facsimile's page, where one was read. */
  window?: { left: number; top: number; right: number; bottom: number }
}

const register = JSON.parse(shelfText) as { entries: CodexEntry[]; absences: CodexAbsence[] }
export const CODEX_ENTRIES: readonly CodexEntry[] = register.entries
export const CODEX_ABSENCES: readonly CodexAbsence[] = register.absences
/** The absences as they stand now, each with its reason in one language. */
export function shownAbsences(lang: Language): { title: string; holder: string; reason: string }[] {
  return CODEX_ABSENCES.flatMap(absence => {
    const reason = absence.words_key ? bestOfKey(absence.words_key, lang) : lang === 'de' ? absence.reason_de : absence.reason_en
    return reason ? [{ title: lang === 'de' ? absence.de : absence.en, holder: lang === 'de' ? absence.holder_de : absence.holder_en, reason }] : []
  })
}
const SIDES = (JSON.parse(sidesText) as { codices: Record<string, { sides: CodexSide[] }> }).codices

/** The sides of one codex of the collection, in the order the reader turns them. */
export function codexSides(id: string): readonly CodexSide[] {
  return SIDES[id]?.sides ?? []
}

/** THE BOOKS ON THE SHELF, in the order they stand: the volume on the table,
 * which binds manuscripts B and D, then every codex the collection admits.
 * The volume keeps the exhibit id the room has always given the book. */
export interface ShelfBook {
  /** the exhibit id the station's set and the close look carry */
  id: string
  /** `edition` for the volume of 1883, the register's own id otherwise */
  codex: string
  title: { en: string; de: string }
  official: { en: string; de: string }
  /** the register's entry, null for the volume, which carries two */
  entry: CodexEntry | null
}
export const EDITION_EXHIBIT = 'codex/paris-B'
export const SHELF_BOOKS: readonly ShelfBook[] = [
  { id: EDITION_EXHIBIT, codex: 'edition', title: CODEX_TITLES['edition']!,
    official: { en: SHELF_UI.en.edition, de: SHELF_UI.de.edition }, entry: null },
  ...CODEX_ENTRIES.filter(entry => entry.state === 'collection' && codexSides(entry.id).length)
    .map(entry => ({ id: `codex/${entry.id}`, codex: entry.id, title: CODEX_TITLES[entry.id] ?? { en: entry.en, de: entry.de },
      official: { en: entry.en, de: entry.de }, entry })),
]

export function shelfBook(id: string): ShelfBook | undefined {
  return SHELF_BOOKS.find(book => book.id === id)
}
/** A book of the collection, not the volume the table itself turns. */
export const isCollectionBook = (id: string): boolean => Boolean(shelfBook(id)?.entry)

/** The codex a manuscript key belongs to, so the open record marks its entry. */
export function codexOf(key: string): string {
  const letter = /^([A-Z]):/.exec(key)?.[1]
  return letter ? `paris-${letter}` : ''
}

function node<K extends keyof HTMLElementTagNameMap>(
  tag: K, className: string, text?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag)
  element.className = className
  if (text !== undefined) element.textContent = text
  return element
}

/* The shelf is built the moment the table opens, so the record is held here
   rather than awaited in the middle of a list. */
let RECORDS: Map<string, ManifestEntry> | null = null
void loadManifest().then(index => { RECORDS = new Map(index.all.map(e => [e.path, e])) })

/** The shelf plate of a codex of the collection: the store's own small copy,
 * cut from a page whose record carries its licence. No record, no plate. */
export function shelfPlate(entry: CodexEntry | null): string | null {
  const record = entry?.plate ? RECORDS?.get(entry.plate) : undefined
  return record ? assetAddress(record) : null
}

function plate(entry: CodexEntry): HTMLImageElement | null {
  const address = shelfPlate(entry)
  if (!address) return null
  const image = document.createElement('img')
  image.className = 'vt-codex-plate'
  image.src = address
  if (entry.plate_w && entry.plate_h) { image.width = entry.plate_w; image.height = entry.plate_h }
  image.loading = 'lazy'
  image.decoding = 'async'
  image.alt = ''
  return image
}

function lines(entry: CodexEntry, lang: Language): HTMLElement {
  const copy = TABLE_UI[lang]
  const body = node('span', 'vt-codex-body')
  const title = CODEX_TITLES[entry.id]
  body.append(
    node('span', 'vt-codex-name', title ? title[lang] : lang === 'de' ? entry.de : entry.en),
    ...(title ? [node('span', 'vt-codex-holder', lang === 'de' ? entry.de : entry.en)] : []),
    node('span', 'vt-codex-holder', lang === 'de' ? entry.holder_de : entry.holder_en),
    node('span', 'vt-codex-class',
      `${entry.tier === 'TIER1' ? copy.tierOne : copy.tierTwo} · ${lang === 'de' ? entry.class_de : entry.class_en}`),
    node('span', 'vt-codex-count', lang === 'de' ? entry.count_de : entry.count_en),
  )
  return body
}

/**
 * The codex selector in the record. The two manuscripts the volume on the
 * table carries open the reader at their first leaf; every other codex of the
 * collection opens as its own book on the table.
 */
export function buildCodexList(
  lang: Language, openKey: string, onOpen: (folio: string) => void, onBook?: (id: string) => void,
  current?: string,
): HTMLElement {
  const copy = TABLE_UI[lang]
  const section = node('section', 'vt-codex-section')
  const here = current ?? codexOf(openKey)
  for (const group of ['table', 'collection'] as const) {
    const shown = CODEX_ENTRIES.filter((entry) => entry.state === group)
    if (!shown.length) continue
    section.append(node('p', 'vt-codex-group', group === 'table' ? copy.onTable : copy.inCollection))
    const list = node('ul', 'vt-codex-list')
    for (const entry of shown) {
      const item = node('li', 'vt-codex-item')
      const book = SHELF_BOOKS.find(candidate => candidate.entry === entry)
      const opens = entry.open ? () => onOpen(entry.open as string) : book && onBook ? () => onBook(book.id) : null
      if (opens) {
        const button = node('button', 'vt-codex-button')
        button.type = 'button'
        button.setAttribute('aria-current', entry.id === here ? 'true' : 'false')
        const face = plate(entry)
        if (face) button.append(face)
        button.append(lines(entry, lang))
        button.addEventListener('click', opens)
        item.append(button)
      } else {
        const row = node('div', 'vt-codex-row')
        const face = plate(entry)
        if (face) row.append(face)
        row.append(lines(entry, lang), node('span', 'vt-codex-state', copy.recorded))
        item.append(row)
      }
      list.append(item)
    }
    section.append(list)
  }
  return section
}

/** One line for every named absence, holder included. */
export function buildAbsences(lang: Language): HTMLElement {
  const copy = TABLE_UI[lang]
  const section = node('section', 'vt-absence-section')
  section.append(node('p', 'vt-absence-status', copy.absent))
  const list = node('ul', 'vt-absence-list')
  for (const absence of shownAbsences(lang)) {
    const item = node('li', 'vt-absence-item')
    item.append(
      node('span', 'vt-absence-name', absence.title),
      node('span', 'vt-absence-holder', absence.holder),
      node('span', 'vt-source-note', absence.reason),
    )
    list.append(item)
  }
  section.append(list)
  return section
}
