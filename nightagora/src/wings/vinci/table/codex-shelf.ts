import shelfText from './data/codices.json?raw'
import { TABLE_UI, type Language } from './content'

/** The shelf's register of codices. Counts are scans or edition pages, never
 * manuscript folio totals, and the page maps are named for provenance only. */
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
}

export interface CodexAbsence {
  id: string
  en: string
  de: string
  holder_en: string
  holder_de: string
  reason_en: string
  reason_de: string
}

const register = JSON.parse(shelfText) as { entries: CodexEntry[]; absences: CodexAbsence[] }
export const CODEX_ENTRIES: readonly CodexEntry[] = register.entries
export const CODEX_ABSENCES: readonly CodexAbsence[] = register.absences

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

function lines(entry: CodexEntry, lang: Language): HTMLElement {
  const copy = TABLE_UI[lang]
  const body = node('span', 'vt-codex-body')
  body.append(
    node('span', 'vt-codex-name', lang === 'de' ? entry.de : entry.en),
    node('span', 'vt-codex-holder', lang === 'de' ? entry.holder_de : entry.holder_en),
    node('span', 'vt-codex-class',
      `${entry.tier === 'TIER1' ? copy.tierOne : copy.tierTwo} · ${lang === 'de' ? entry.class_de : entry.class_en}`),
    node('span', 'vt-codex-count', lang === 'de' ? entry.count_de : entry.count_en),
  )
  return body
}

/**
 * The codex selector. Entries the 1883 edition carries open the reader at their
 * first leaf; the rest state where they are recorded, since this shelf does not
 * change what the reader reads.
 */
export function buildCodexList(
  lang: Language, openKey: string, onOpen: (folio: string) => void,
): HTMLElement {
  const copy = TABLE_UI[lang]
  const section = node('section', 'vt-codex-section')
  const current = codexOf(openKey)
  for (const group of ['table', 'collection'] as const) {
    const shown = CODEX_ENTRIES.filter((entry) => entry.state === group)
    if (!shown.length) continue
    section.append(node('p', 'vt-codex-group', group === 'table' ? copy.onTable : copy.inCollection))
    const list = node('ul', 'vt-codex-list')
    for (const entry of shown) {
      const item = node('li', 'vt-codex-item')
      if (entry.open) {
        const button = node('button', 'vt-codex-button')
        button.type = 'button'
        button.setAttribute('aria-current', entry.id === current ? 'true' : 'false')
        button.append(lines(entry, lang))
        button.addEventListener('click', () => onOpen(entry.open as string))
        item.append(button)
      } else {
        const row = node('div', 'vt-codex-row')
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
  for (const absence of CODEX_ABSENCES) {
    const item = node('li', 'vt-absence-item')
    item.append(
      node('span', 'vt-absence-name', lang === 'de' ? absence.de : absence.en),
      node('span', 'vt-absence-holder', lang === 'de' ? absence.holder_de : absence.holder_en),
      node('span', 'vt-source-note', lang === 'de' ? absence.reason_de : absence.reason_en),
    )
    list.append(item)
  }
  section.append(list)
  return section
}
