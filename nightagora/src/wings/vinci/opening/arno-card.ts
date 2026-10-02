/* THE ARNO CARD. The wing opens on his earliest dated drawing, alone and
   large, one line under it and one way in. The start sequence calls
   openArnoCard() and goes on when it resolves.

   · ASKED BY ITS ADDRESS. `?opening=arno` asks for it until the start takes
     it over; a rig whose address does not ask never meets it.
   · NO DRAWING, NO CARD. A store that does not admit the drawing under the
     register's own label shows nothing and resolves at once, so the wing
     never waits on a card it cannot hang.
   · ONE TEXT AT A TIME. The card covers the whole glass in the museum's top
     layer; nothing of the wing reads through it while it stands. */

import { lang, type Lang } from '../../content'
import { loadManifest, type ManifestIndex } from '../../../manifest'
import { assetAddress } from '../../../stack/materials'
import { admitOpeningRecord, ARNO_1473, openingLabel, type OpeningFile } from '../pictures/opening-register'
import wordsSource from '../data/opening.json?raw'
import cardCss from './arno-card.css?inline'

interface OpeningWordsFile { opening: Record<string, Record<string, { en: string; de: string }>> }
const WORDS = JSON.parse(wordsSource) as OpeningWordsFile

/** A word of the opening by its key, `opening.arno.line`. */
export function openingWord(key: string, language: Lang = lang()): string {
  const [scope, card, part] = key.split('.')
  const said = scope === 'opening' && card && part ? WORDS.opening[card]?.[part] : undefined
  if (!said?.[language]) throw new Error(`No opening word ${key} (${language})`)
  return said[language]
}

export const ARNO_OPENING = 'arno'
/** The address asks for the Arno opening. */
export function vinciArnoAsked(search: string = location.search): boolean {
  return new URLSearchParams(search).get('opening') === ARNO_OPENING
}

export type ArnoCardEnd = 'started' | 'unadmitted' | 'aborted'
export interface ArnoCardOptions {
  /** the store's record, when the caller already holds it */
  manifest?: ManifestIndex
  /** the card leaves at once, without a start, when this aborts */
  signal?: AbortSignal
  /** lays a line in under the way in before the card's first frame */
  under?: (way: HTMLButtonElement) => void
}

const MONTHS = 'January|February|March|April|May|June|July|August|September|October|November|December|Januar|Februar|März|Mai|Juni|Juli|Oktober|Dezember'
/** A day never breaks from its month, nor an inventory or an article from
    its number; a year may take the next row. */
export function bindForDisplay(text: string): string {
  return text
    .replace(new RegExp(`(\\b\\d{1,2}\\.?) (${MONTHS})\\b`, 'g'), '$1\u00a0$2')
    .replace(/\b([Ii]nv\.) (\d+) ([A-Z])\b/g, '$1\u00a0$2\u00a0$3')
    .replace(/\b(Art\.|art\.|Abs\.) (\d)/g, '$1\u00a0$2')
}

/** matches the leave of the door it replaces, so the picture under it settles on the same beat */
const LEAVE_MS = 420
const SVG = 'http://www.w3.org/2000/svg'
const ARROW_ON = 'M3 8h10M9 4l4 4-4 4'
const CHEVRON_UP = 'M4 10l4-4 4 4'
/** the drawing's drawn width by form: the phone's glass less its gutters, the
    desktop's stage less its margins and the band */
const SIZES = '(max-aspect-ratio: 9/10) calc(100vw - 24px), min(calc(100vw - 128px), calc((100vh - 260px) * 1.46))'

function icon(path: string, cls: string): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg')
  svg.setAttribute('viewBox', '0 0 16 16')
  svg.setAttribute('class', cls)
  svg.setAttribute('aria-hidden', 'true')
  const line = document.createElementNS(SVG, 'path')
  line.setAttribute('d', path)
  svg.append(line)
  return svg
}

/** Show the card over `host` and resolve when the visitor starts. */
export async function openArnoCard(host: HTMLElement, options: ArnoCardOptions = {}): Promise<ArnoCardEnd> {
  const index = options.manifest ?? await loadManifest()
  if (options.signal?.aborted) return 'aborted'
  const record = index.byId.get(ARNO_1473.manifest_id)
  const admitted = admitOpeningRecord(record, ARNO_1473)
  if (!record || !admitted.ok) {
    console.warn(`The Arno card stands down: ${admitted.reason}`)
    return 'unadmitted'
  }
  const language = lang()
  // a card without its words stands down like one without its drawing
  let said: { line: string; start: string; credit: string }
  try {
    said = { line: openingWord('opening.arno.line', language), start: openingWord('opening.arno.start', language),
      credit: openingWord('opening.arno.credit', language) }
  } catch (error) {
    console.warn(`The Arno card stands down: ${String(error)}`)
    return 'unadmitted'
  }
  const document_ = host.ownerDocument
  const root = document_.documentElement
  const make = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, words = ''): HTMLElementTagNameMap[K] => {
    const node = document_.createElement(tag)
    if (cls) node.className = cls
    if (words) node.textContent = words
    return node
  }
  const address = (file: OpeningFile): string => assetAddress({ wing: record.wing, path: file.path, sha256: file.sha256 })
  const plate = admitted.files[admitted.files.length - 1]!

  const card = make('dialog', 'arno-card')
  card.lang = language
  card.setAttribute('aria-labelledby', 'arno-card-line')
  const style = make('style', '')
  style.textContent = cardCss

  const stage = make('div', 'arno-stage')
  const sheet = make('figure', 'arno-sheet')
  sheet.style.setProperty('--arno-ratio', `${plate.width} / ${plate.height}`)
  const drawing = make('img', 'arno-drawing')
  drawing.alt = `${ARNO_1473.maker}, ${ARNO_1473.title[language]}, ${ARNO_1473.date_label[language]}`
  drawing.width = plate.width
  drawing.height = plate.height
  drawing.decoding = 'async'
  drawing.setAttribute('fetchpriority', 'high')
  drawing.sizes = SIZES
  drawing.srcset = admitted.files.map(file => `${address(file)} ${file.width}w`).join(', ')
  drawing.src = address(plate)
  // a srcset size that fails never falls back by itself: the plate's own file stands in once
  drawing.addEventListener('error', () => {
    if (!drawing.srcset) return
    drawing.removeAttribute('srcset')
    drawing.removeAttribute('sizes')
    drawing.src = address(plate)
  })
  const shown = (): void => { sheet.dataset['loaded'] = 'true' }
  if (drawing.complete && drawing.naturalWidth) shown()
  else drawing.addEventListener('load', shown, { once: true })
  sheet.append(drawing)
  stage.append(sheet)

  const band = make('div', 'arno-band')
  const words = make('div', 'arno-words')
  const line = make('p', 'arno-line', bindForDisplay(said.line))
  line.id = 'arno-card-line'
  /* THE LABEL STANDS WHERE THE LINE STOOD, on the band grown taller: the
     record is on the card, one press away, and never beside the line */
  const label = make('div', 'arno-label')
  label.id = 'arno-card-label'
  label.dataset['register'] = 'record'
  label.hidden = true
  for (const part of openingLabel(ARNO_1473, language)) label.append(make('p', 'arno-label-part', bindForDisplay(part)))
  const credit = make('button', 'arno-credit')
  credit.type = 'button'
  credit.setAttribute('aria-expanded', 'false')
  credit.setAttribute('aria-controls', label.id)
  // the mark rides at the end of the words, so a credit that wraps keeps it beside its last word
  const creditWords = make('span', 'arno-credit-words', bindForDisplay(said.credit))
  credit.append(creditWords, icon(CHEVRON_UP, 'arno-credit-mark'))
  words.append(line, label, credit)

  const start = make('button', 'arno-start')
  start.type = 'button'
  start.autofocus = true
  const arrow = make('span', 'arno-start-arrow')
  arrow.append(icon(ARROW_ON, 'arno-start-icon'))
  start.append(make('span', 'arno-start-word', said.start), arrow)
  band.append(words, start)
  options.under?.(start)
  card.append(style, stage, band)

  function setLabel(open: boolean): void {
    label.hidden = !open
    line.hidden = open
    credit.setAttribute('aria-expanded', String(open))
    if (open) card.dataset['label'] = 'open'
    else delete card.dataset['label']
  }
  credit.addEventListener('click', () => setLabel(label.hidden))

  host.append(card)
  root.dataset['naOpening'] = ARNO_OPENING
  card.showModal()
  // one frame at the hidden state first, so the card fades in rather than cuts
  requestAnimationFrame(() => requestAnimationFrame(() => { card.dataset['shown'] = 'true' }))

  return new Promise<ArnoCardEnd>(resolve => {
    let over = false
    const leave = (end: ArnoCardEnd): void => {
      if (over) return
      over = true
      if (root.dataset['naOpening'] === ARNO_OPENING) delete root.dataset['naOpening']
      const still = end === 'aborted' || document_.body.classList.contains('forge')
        || matchMedia('(prefers-reduced-motion: reduce)').matches
      const strike = (): void => { if (card.open) card.close(); card.remove() }
      if (still) strike()
      else {
        card.dataset['leaving'] = 'true'
        setTimeout(strike, LEAVE_MS)
      }
      resolve(end)
    }
    start.addEventListener('click', () => leave('started'))
    // Escape folds the label first; on the bare card it is a way in like the button
    card.addEventListener('cancel', event => {
      event.preventDefault()
      if (!label.hidden) { setLabel(false); credit.focus(); return }
      leave('started')
    })
    // a browser may close a modal on a second Escape without asking: that is a way in too
    card.addEventListener('close', () => leave('started'))
    options.signal?.addEventListener('abort', () => leave('aborted'), { once: true })
  })
}
