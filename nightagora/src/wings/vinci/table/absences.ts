/** THE SHELF'S ABSENCES AS THEY STAND NOW. The Institut de France's own colour
 * views of Paris manuscripts A to M and the Ashburnham leaves, and the British
 * Library's views of Codex Arundel, are admitted (the legal read of
 * 2026-09-28, sections 1 and 4). The three absences that named the old
 * facsimiles as the only source take their reason from the room's new words,
 * and stand down until those are written.
 *
 * Kept outside the shelf's register (`codex-shelf.ts`, `data/codices.json`):
 * both are recipe files of library records the film's global key reads.
 */
import { bestOfKey, type BestOfKey } from './best-of'
import { CODEX_ABSENCES } from './codex-shelf'
import { TABLE_UI, type Language } from './content'

/** The absences the admission overtook, by id, and the key of their new reason. */
const OVERTAKEN: Readonly<Record<string, BestOfKey>> = {
  'arundel-middle': 'absence_arundel_middle',
  'paris-rest': 'absence_paris_rest',
  ashburnham: 'absence_ashburnham',
}

/** The absences as they stand now, each with its reason in one language. */
export function shownAbsences(lang: Language): { title: string; holder: string; reason: string }[] {
  return CODEX_ABSENCES.flatMap(absence => {
    const key = OVERTAKEN[absence.id]
    const reason = key ? bestOfKey(key, lang) : lang === 'de' ? absence.reason_de : absence.reason_en
    return reason ? [{ title: lang === 'de' ? absence.de : absence.en, holder: lang === 'de' ? absence.holder_de : absence.holder_en, reason }] : []
  })
}

const node = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] => {
  const element = document.createElement(tag)
  element.className = className
  if (text !== undefined) element.textContent = text
  return element
}

/** One line for every absence as it stands now, holder included: the
 * register's own list (`buildAbsences`) with the overtaken reasons replaced. */
export function buildShownAbsences(lang: Language): HTMLElement {
  const section = node('section', 'vt-absence-section')
  section.append(node('p', 'vt-absence-status', TABLE_UI[lang].absent))
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
