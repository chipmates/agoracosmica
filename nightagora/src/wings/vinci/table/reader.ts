/** THE BOOK ON THE TABLE, as the museum's reader reads it.
 *
 * The window and its instruments are the museum's (`vitrine/reader.ts`).
 * What stands here is what only this wing can say: which side of which
 * manuscript a record is, where its scan lies in the store, what the plate's
 * own rectangle on the printed sheet is, what the three ways of reading one
 * leaf are, and the register of every codex the museum holds and every one
 * it cannot show.
 *
 * The edition is 438 printed sheets and the manuscript inside it is 188
 * sides, 168 of B and 20 of D. The strip holds the sides of the manuscript
 * open now; the 250 printed sheets are one way away and the record reaches
 * every one of the 438 by name.
 */
import { lang } from '../../content'
import type { ManifestEntry, ManifestIndex } from '../../../manifest'
import type { DeepPlateTier } from '../../vitrine/deep-plate'
import { createReaderPayload as createReader, type ReaderBook, type ReaderSide } from '../../vitrine/reader'
import type { VitrinePayload } from '../../vitrine/types'
import { buildAbsences, buildCodexList } from './codex-shelf'
import { FAMOUS_FOLIOS, MIRROR_EXPLANATION, TABLE_UI, folioKey, folioProvenance, hasItalian, type Language, type PageRecord } from './content'
import type { ReadingTable } from './index'
import windowsRaw from './data/leaf-windows.json?raw'

/** What the forge measured off each sheet of the edition: the file's own
 * pixels, and where the photolithographic plate stands on it. No physical
 * registration is claimed; a sheet with no reading opens whole. */
const SHEETS = (JSON.parse(windowsRaw) as {
  pages: Record<string, { width: number; height: number; window?: { left: number; top: number; right: number; bottom: number } }>
}).pages

export interface ReaderPayload extends VitrinePayload {
  /** Open one record by its key: `B:83v` or `edition:340`. */
  open(key: string): void
  /** The record behind "Where it comes from" for the page open now. */
  renderRecord(host: HTMLElement): void
}

/** The store's file name for one record of the edition. */
const sheetKey = (page: PageRecord): string => page.file.split('/').pop()!.replace(/\.jpg$/, '')

export function createReaderPayload(options: {
  table: ReadingTable
  manifest: Promise<ManifestIndex>
  /** True when the eye was walked to the book, so the room reads it. */
  walked(): boolean
  /** True once the eye stands where it will stand for the book. */
  standing(): boolean
  /** The words the museum puts beside every page: its own "More", the
   * honesty line of a page's reproduction, and the reader's own controls. */
  more: string
  honesty: string
  words: {
    hand: string; mirror: string; print: string; backToLeaf: string
    place: string; leaves: string; moreLeaf: string
    whole: string; nearer: string; further: string; ceiling: string
  }
  /** The colour the wing's register gives a documented reproduction. */
  colour: string
  tier(): DeepPlateTier
  /** The side the reading opens at, where a door names one. */
  start?: string
  /** The record changed page: the sources window repaints if it is open. */
  changed(): void
}): ReaderPayload {
  const { table } = options
  const pages = table.pages
  const language: Language = lang()
  const copy = TABLE_UI[language]
  let index: ManifestIndex | undefined
  let at = table.at()
  let holder = ''

  /** The manifested file of one record at one level, as the table's stream
   * joins it: by the complete page file and the recorded role. */
  function file(page: PageRecord, whole: boolean): ManifestEntry | undefined {
    const role = whole ? 'ms-page' : 'ms-thumb'
    return index?.all.find(entry => (entry as ManifestEntry & { page?: string }).page === page.file
      && (entry as ManifestEntry & { role?: string }).role === role)
  }
  const url = (entry: ManifestEntry | undefined): string | null => entry ? `/na-assets/${entry.wing}/${entry.path}` : null

  /** The pixels of one record's own scan, with the plate's rectangle on it
   * where the forge could read one. */
  function scan(page: PageRecord): { file: string; width: number; height: number } | null {
    const entry = file(page, true), sheet = SHEETS[sheetKey(page)]
    const address = url(entry)
    if (!address || !sheet) return null
    return { file: address, width: sheet.width, height: sheet.height }
  }
  const windowOf = (page: PageRecord) => SHEETS[sheetKey(page)]?.window ?? null

  const identity = (page: PageRecord): string => page.codex && page.folio !== null && page.side
    ? `${page.folio} ${page.side === 'recto' ? copy.recto : copy.verso}` : kind(page)

  function kind(page: PageRecord): string {
    const labels: Record<string, string> = {
      facsimile: copy.facsimile, translation: copy.translation, title: copy.titlePage, editorial: copy.editorial,
      blank: copy.blank, end_matter: copy.endMatter, missing_notice: copy.missingNotice,
    }
    return labels[page.page_kind] ?? copy.editionMatter
  }

  /** THE THREE WAYS OF READING ONE LEAF: as he wrote it, reversed so it
   * reads left to right, and the editor's own page printed facing it. A
   * side whose facing sheet the store does not hold declares two. */
  function ways(page: PageRecord): ReaderSide['ways'] {
    const facing = pages.find(entry => entry.file === page.paired_file)
    const printed = facing ? scan(facing) : null
    const own = { ceiling: options.words.ceiling }
    return [
      { id: 'hand', label: options.words.hand, ...own },
      { id: 'mirror', label: options.words.mirror, mirrored: true, line: MIRROR_EXPLANATION[language].documented, ...own },
      ...(printed ? [{ id: 'print', label: options.words.print, line: copy.printedPage,
        source: { pyramid: null, ...printed }, ...own }] : []),
    ]
  }

  function buildBook(): ReaderBook {
    const sides: ReaderSide[] = []
    for (const page of pages) {
      if (page.page_kind !== 'facsimile') continue
      const read = scan(page)
      if (!read) continue
      const named = FAMOUS_FOLIOS.find(entry => folioKey(page) === `B:${entry.folio}`)
      sides.push({
        id: folioKey(page),
        label: identity(page),
        shows: language === 'en' ? page.what_it_shows_en : page.what_it_shows_de,
        source: { pyramid: null, ...read },
        window: windowOf(page),
        thumb: url(file(page, false)),
        ways: ways(page),
        colour: options.colour,
        named: named ? named[language] : null,
        volume: page.codex ?? undefined,
      })
    }
    return {
      sides,
      gaps: gapAfter(sides),
      stripLabel: (volume, count) => options.words.leaves.replace('{codex}', volume ?? '')
        .replace('{total}', String(count)),
      holder,
      honesty: options.honesty,
    }
  }

  /** The gap cell stands after the last leaf the edition printed before it,
   * which is the side whose folio is under the missing run. */
  function gapAfter(sides: readonly ReaderSide[]): readonly { after: string; text: string }[] {
    const notice = pages.find(page => page.page_kind === 'missing_notice')
    if (!notice) return []
    const missing = /(\d+)\D+(\d+)/.exec(notice.what_it_shows_en)
    const first = missing ? Number(missing[1]) : 0
    const before = [...pages].filter(page => page.page_kind === 'facsimile' && page.codex === notice.codex
      && (page.folio ?? 0) < first).pop()
    const id = before ? folioKey(before) : ''
    return sides.some(side => side.id === id)
      ? [{ after: id, text: language === 'en' ? notice.what_it_shows_en : notice.what_it_shows_de }] : []
  }

  /** The transcription and the translation, which are one deliberate press
   * away from every leaf. */
  function witnesses(side: ReaderSide): readonly HTMLElement[] {
    const page = pages.find(entry => folioKey(entry) === side.id)
    if (!page) return []
    const make = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] => {
      const node = document.createElement(tag); node.className = cls
      if (text !== undefined) node.textContent = text
      return node
    }
    const italian = make('section', '')
    italian.append(make('h4', 'vitrine-meta', copy.italian), make('p', 'vitrine-meta', copy.italianDetail))
    const it = make('p', 'vitrine-source-text', hasItalian(page) ? page.transcription_it ?? '' : copy.unavailable)
    if (hasItalian(page)) it.lang = 'it'
    if (page.ocr_confidence === 'low') italian.append(make('p', 'vitrine-meta', copy.lowOcr))
    italian.append(it)
    const french = make('section', '')
    french.append(make('h4', 'vitrine-meta', copy.french), make('p', 'vitrine-meta', copy.frenchDetail))
    const fr = make('p', 'vitrine-source-text', page.translation_fr ?? copy.frenchUnavailable)
    if (page.translation_fr) fr.lang = 'fr'
    french.append(fr)
    return [italian, french]
  }

  const book = options.manifest.then(loaded => {
    index = loaded
    holder = (loaded.all.find(entry => (entry as ManifestEntry & { role?: string }).role === 'ms-page') as
      (ManifestEntry & { holder?: string }) | undefined)?.holder ?? ''
    return buildBook()
  })

  /** The side of the manuscript a key names, where the key is a record of
   * the edition rather than a leaf. */
  function sideOf(key: string): string {
    if (!key.startsWith('edition:')) return key
    const found = pages[Number(key.slice('edition:'.length))]
    if (!found) return key
    if (found.page_kind === 'facsimile') return folioKey(found)
    const near = pages.filter(page => page.page_kind === 'facsimile')
      .sort((a, b) => Math.abs(a.edition_index - found.edition_index) - Math.abs(b.edition_index - found.edition_index))[0]
    return near ? folioKey(near) : key
  }

  const payload = createReader({
    book,
    start: options.start ? sideOf(options.start) : sideOf(`edition:${table.at()}`),
    words: {
      whole: options.words.whole, nearer: options.words.nearer, further: options.words.further,
      ceiling: options.words.ceiling, previous: copy.previous, next: copy.next,
      place: options.words.place, more: options.more,
      moreLabel: options.words.moreLeaf, back: options.words.backToLeaf,
    },
    tier: options.tier,
    witnesses,
    room: {
      walked: options.walked,
      standing: options.standing,
      still: () => !table.turning() && table.pending() === 0,
      // THE ROOM IS NOT MADE TO TURN A HUNDRED AND SIXTY EIGHT LEAVES behind
      // a frame nobody is looking at: the book is put at the side the
      // reading ended on when the window closes.
      open: () => { /* the table follows on Close */ },
      leave: () => {
        table.flipLeaf(false)
        table.paperOnly(false)
        const here = payload.current()
        const page = here ? pages.find(entry => folioKey(entry) === here.id) : undefined
        if (page && page.edition_index !== table.at()) void table.open(folioKey(page))
      },
    },
    changed: options.changed,
  })

  return {
    ...payload,
    open(key) {
      payload.open(sideOf(key))
    },
    renderRecord(record) {
      const here = payload.current()
      const page = (here ? pages.find(entry => folioKey(entry) === here.id) : undefined) ?? pages[at]!
      at = page.edition_index
      const full = document.createElement('div')
      full.className = 'vinci-record'
      full.dataset['register'] = 'record'
      const add = (text: string, tag: 'p' | 'h3' | 'h4' = 'p'): void => {
        const node = document.createElement(tag)
        node.className = tag === 'p' ? 'vinci-statement' : ''
        node.textContent = text
        full.append(node)
      }
      add(copy.source, 'h3')
      add(copy.reproduction)
      add(folioProvenance(page, language, identity(page)))
      if (page.ocr_note_en) add(language === 'en' ? page.ocr_note_en : page.ocr_note_de ?? page.ocr_note_en)
      const link = (label: string, url: string): void => {
        const a = document.createElement('a')
        a.className = 'vinci-picture-source'; a.textContent = label; a.href = url
        a.target = '_blank'; a.rel = 'noopener noreferrer'
        full.append(a)
      }
      link(copy.sourceImage, page.source_url)
      const folioUrl = page.machine_sources.find(source => source.folio_source_url)?.folio_source_url
      if (folioUrl) link(copy.folioSource, folioUrl)
      add(page.licence_line)
      // THE THIRD REGISTER. The register of every codex the museum holds,
      // the ones it cannot show, and the eight studies this wing is built
      // from: the full chain, opened on purpose.
      add(copy.codices, 'h4')
      full.append(buildCodexList(language, folioKey(page), key => payload.open(sideOf(key))))
      add(copy.famous, 'h4')
      const leaves = document.createElement('ol')
      leaves.className = 'vitrine-reader-leaves'
      for (const famous of FAMOUS_FOLIOS) {
        const item = document.createElement('li')
        const go = document.createElement('button')
        go.type = 'button'
        go.className = 'vitrine-step-item'
        go.textContent = `${famous.folio} · ${famous[language]}`
        go.setAttribute('aria-current', folioKey(page) === `B:${famous.folio}` ? 'page' : 'false')
        go.addEventListener('click', () => payload.open(`B:${famous.folio}`))
        item.append(go)
        leaves.append(item)
      }
      full.append(leaves, buildAbsences(language))
      // THE PAGE-RECORD SELECTORS: every record of the edition and every
      // represented leaf stays reachable by name.
      const selector = (label: string, records: readonly PageRecord[], value: (page: PageRecord) => string,
        text: (page: PageRecord) => string): void => {
        const wrap = document.createElement('label')
        wrap.className = 'vinci-statement'
        wrap.append(label)
        const select = document.createElement('select')
        select.setAttribute('aria-label', label)
        // A control a hand has to hit, in a window a thumb reaches.
        select.style.minHeight = '44px'
        select.style.marginLeft = '8px'
        for (const entry of records) {
          const option = document.createElement('option')
          option.value = value(entry); option.textContent = text(entry); option.selected = entry.file === page.file
          select.append(option)
        }
        select.addEventListener('change', () => payload.open(select.value))
        wrap.append(select)
        full.append(wrap)
      }
      selector(copy.manuscriptLeaf, pages.filter(entry => entry.page_kind === 'facsimile'), folioKey,
        entry => `${entry.codex} ${entry.folio}${entry.side === 'recto' ? 'r' : 'v'}`)
      selector(copy.editionPage, pages, entry => `edition:${entry.edition_index}`,
        entry => `${entry.edition_index + 1} · ${kind(entry)}`)
      record.append(full)
    },
  }
}
