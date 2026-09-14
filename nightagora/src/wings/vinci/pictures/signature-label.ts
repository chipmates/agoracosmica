/** The empty signature field represents the painting. Its available historical
 * print is a separate source that the visitor can deliberately open. */
import { appendLater, firstSentence, setRegister } from './policy-label'
import type { PictureBilingual } from './policy-label'

export const SIGNATURE_NOTE: PictureBilingual = {
  en: 'The panel itself is not here. It belongs to the Louvre collection, and no photograph of it has been cleared for this exhibition. The empty field holds the painting’s place at its measured size.',
  de: 'Die Tafel selbst ist nicht hier. Sie gehört zur Sammlung des Louvre, und keine Fotografie davon ist für diese Ausstellung freigegeben. Das leere Bildfeld hält den Platz des Gemäldes in seiner gemessenen Größe frei.',
}

const SOURCE: PictureBilingual = {
  en: 'A historical print of the painting can be opened in Sources.',
  de: 'Ein historischer Druck des Gemäldes lässt sich unter Sources öffnen.',
}

function node<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = ''): HTMLElementTagNameMap[K] {
  const result = document.createElement(tag)
  result.className = className
  result.textContent = text
  return result
}

export function createSignatureLabel(columnNotes: readonly PictureBilingual[] = [], twoLevels = false): HTMLElement {
  const label = node('article', 'picture-work-label picture-label picture-policy-label')
  label.dataset['workId'] = 'mona-lisa'
  label.style.setProperty('--certainty', '#777e7b')
  setRegister(label, 'drawer')

  for (const language of ['en', 'de'] as const) {
    const column = node('section', `picture-label-language picture-label-${language}`)
    column.lang = language
    const first = node('p', language === 'en' ? 'picture-first picture-first-en' : 'picture-first-de')
    setRegister(first, 'label')
    const dot = node('span', 'picture-certainty')
    dot.setAttribute('aria-hidden', 'true')
    const certainty = node('span', 'picture-certainty-word', language === 'en' ? 'Absent.' : 'Nicht gezeigt.')
    certainty.style.color = 'var(--certainty)'
    first.append(dot, certainty, node('span', 'picture-label-title', ' Mona Lisa.'))
    const split = twoLevels ? firstSentence(SIGNATURE_NOTE[language]) : { head: SIGNATURE_NOTE[language], rest: '' }
    column.append(first, node('p', language === 'en' ? 'picture-reason' : 'picture-reason-de', split.head))
    const later: HTMLElement[] = []
    if (split.rest) later.push(node('p', language === 'en' ? 'picture-reason' : 'picture-reason-de', split.rest))
    later.push(node('p', 'picture-source-reading', SOURCE[language]))
    for (const remark of columnNotes) {
      const line = node('p', 'picture-column-note', remark[language])
      line.lang = language
      later.push(line)
    }
    appendLater(column, language, later, twoLevels)
    label.append(column)
  }

  return label
}
