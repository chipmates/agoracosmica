/** A BOOK OF THE COLLECTION ON THE TABLE. One codex of the shelf read in the
 * museum's reader: its sides in the order the table read them off the
 * scans, each from the store's pyramid where one is cut and from the scan
 * itself where none is, each under its own record's honesty line. A scan the
 * store does not admit for display is not a side.
 */
import { lang } from '../../content'
import type { ManifestEntry, ManifestIndex } from '../../../manifest'
import { assetAddress, assetPyramidBase } from '../../../stack/materials'
import type { DeepPlateSource, DeepPlateTier } from '../../vitrine/deep-plate'
import type { DeepTilePyramid } from '../../vitrine/deep-viewer'
import { createReaderPayload as createReader, type ReaderBook, type ReaderSide } from '../../vitrine/reader'
import type { VitrinePayload } from '../../vitrine/types'
import { buildAbsences, buildCodexList, codexSides, type ShelfBook } from './codex-shelf'
import { MIRROR_EXPLANATION, TABLE_UI, type Language } from './content'

export interface CodexReaderPayload extends VitrinePayload {
  /** Open one side by its scan. */
  open(key: string): void
  /** The record behind "Where it comes from" for the side open now. */
  renderRecord(host: HTMLElement): void
}

interface PageRecord extends ManifestEntry {
  readonly role?: string
  readonly page?: string
  readonly width?: number
  readonly height?: number
  readonly sha256?: string
  readonly honesty_en?: string
  readonly honesty_de?: string
  readonly note?: string
  readonly derived_from?: string
  readonly source_sha256?: string
  readonly tile_size?: number
  readonly scale_factors?: readonly number[]
}

/** WHERE EACH BOOK WAS LEFT, for one visit: a book reopens at the side the
 * last reading of it ended on, and a new visit opens it at its first. */
const LEFT = new Map<string, string>()

/** A side's name in the name row: the book's own name, and its folio where a
 * source names one, as `36 recto` or `40 verso, 41 recto` for a spread. */
function folioWords(folio: string | null | undefined, copy: typeof TABLE_UI[Language]): string {
  if (!folio) return ''
  return folio.split(' ').map(part => {
    const read = /^(\d+\*?)([rv])?$/.exec(part)
    if (!read) return part
    return read[2] ? `${read[1]} ${read[2] === 'r' ? copy.recto : copy.verso}` : read[1]!
  }).join(', ')
}

/** The coarsest level of a level-0 pyramid, one tile and the strip's cell. */
function coarsest(pyramid: DeepTilePyramid): string {
  const factor = Math.max(...pyramid.scaleFactors)
  const width = Math.ceil(pyramid.width / factor), height = Math.ceil(pyramid.height / factor)
  const size = width === pyramid.width && height === pyramid.height ? 'max' : `${width},${height}`
  return `${pyramid.base}/full/${size}/0/default.jpg`
}

export function createCodexReaderPayload(options: {
  book: ShelfBook
  manifest: Promise<ManifestIndex>
  words: {
    hand: string; mirror: string; print: string; backToLeaf: string; moreLeaf: string
    place: string; whole: string; nearer: string; further: string; ceiling: string
  }
  more: string
  /** The colour of the museum's certainty word for a documented reproduction. */
  colour: string
  tier(): DeepPlateTier
  /** The side a door names, where one does. */
  start?: string
  changed(): void
  /** Open another book of the shelf, from the record's list of codices. */
  openBook(id: string): void
  /** Open a key of the volume on the table, from the same list. */
  openLeaf(key: string): void
}): CodexReaderPayload {
  const { book } = options
  const language: Language = lang()
  const copy = TABLE_UI[language]
  const entry = book.entry
  // the book's own name, before any qualifier the register adds after a comma
  const name = (language === 'de' ? book.official.de : book.official.en).split(',')[0]!.trim()
  const pages = new Map<string, PageRecord>()
  const pyramids = new Map<string, PageRecord>()

  function source(record: PageRecord): { source: DeepPlateSource; thumb: string } {
    const file = assetAddress(record)
    const width = record.width ?? 0, height = record.height ?? 0
    const tiles = pyramids.get(record.id)
    // A PYRAMID IS READ ONLY WHERE IT SAYS IT WAS CUT FROM THIS VERY SCAN, or
    // the view falls back to the scan and its ceiling is the scan's pixels.
    const cut = tiles && tiles.display === true && tiles.source_sha256 === record.sha256
      && tiles.width === width && tiles.height === height && tiles.tile_size && tiles.scale_factors?.length
      && tiles.path.endsWith('/')
      ? { base: assetPyramidBase(tiles), width, height, tileSize: tiles.tile_size, scaleFactors: tiles.scale_factors }
      : null
    return { source: { pyramid: cut, file, width, height }, thumb: cut ? coarsest(cut) : file }
  }

  function buildBook(): ReaderBook {
    const sides: ReaderSide[] = []
    for (const side of codexSides(book.codex)) {
      const record = pages.get(side.file)
      if (!record || record.display !== true || !record.width || !record.height) continue
      const read = source(record)
      const printed = side.print ? pages.get(side.print) : undefined
      const folio = folioWords(side.folio, copy)
      const own = { ceiling: options.words.ceiling }
      sides.push({
        id: side.file,
        label: folio ? `${name}, ${folio}` : name,
        shows: (language === 'de' ? side.shows_de : side.shows_en) ?? '',
        source: read.source,
        // a facsimile's side opens on its plate, and the pan reaches the page
        window: side.window ?? null,
        thumb: read.thumb,
        ways: [
          { id: 'hand', label: options.words.hand, ...own },
          { id: 'mirror', label: options.words.mirror, mirrored: true, line: MIRROR_EXPLANATION[language].documented, ...own },
          // the facsimile's own printed transcription, where it faces the plate
          ...(printed?.display === true && printed.width && printed.height
            ? [{ id: 'print', label: options.words.print,
              source: { pyramid: null, file: assetAddress(printed), width: printed.width, height: printed.height }, ...own }]
            : []),
        ],
        colour: options.colour,
        named: null,
        volume: book.codex,
        honesty: (language === 'de' ? record.honesty_de : record.honesty_en) ?? record.licence,
      })
    }
    return {
      sides,
      stripLabel: () => language === 'de' ? book.official.de : book.official.en,
      holder: entry ? (language === 'de' ? entry.holder_de : entry.holder_en) : '',
      // each side's own honesty line names its holder and its licence
      holderInRecord: true,
      honesty: '',
    }
  }

  const loaded = options.manifest.then(index => {
    for (const item of index.all) {
      const record = item as PageRecord
      if (record.role === 'codex-page' && record.path.startsWith('codices/')) pages.set(record.path, record)
      if (record.role === 'codex-tiles' && record.derived_from) pyramids.set(record.derived_from, record)
    }
    return buildBook()
  })

  const first = codexSides(book.codex)[0]?.file
  const payload = createReader({
    book: loaded,
    start: options.start ?? LEFT.get(book.codex) ?? first,
    words: {
      whole: options.words.whole, nearer: options.words.nearer, further: options.words.further,
      ceiling: options.words.ceiling, previous: copy.previous, next: copy.next,
      place: options.words.place, more: options.more,
      moreLabel: options.words.moreLeaf, back: options.words.backToLeaf,
    },
    tier: options.tier,
    changed: () => {
      const here = payload.current()
      if (here) LEFT.set(book.codex, here.id)
      options.changed()
    },
  })

  return {
    ...payload,
    renderRecord(host) {
      const here = payload.current()
      const record = here ? pages.get(here.id) : undefined
      const full = document.createElement('div')
      full.className = 'vinci-record'
      full.dataset['register'] = 'record'
      const add = (text: string | undefined, tag: 'p' | 'h3' | 'h4' = 'p'): void => {
        if (!text) return
        const node = document.createElement(tag)
        node.className = tag === 'p' ? 'vinci-statement' : ''
        node.textContent = text
        full.append(node)
      }
      // the sheet's own head carries the plain title; the record names the
      // side by the book's official name
      add(here?.label ?? (language === 'de' ? book.official.de : book.official.en))
      if (record) {
        add((language === 'de' ? record.honesty_de : record.honesty_en) ?? record.licence)
        // the source's own page, by the address it stands at
        if (record.source_url) {
          const line = document.createElement('p')
          line.className = 'vinci-statement'
          const link = document.createElement('a')
          link.className = 'vinci-picture-source'
          link.href = record.source_url
          link.target = '_blank'
          link.rel = 'noopener noreferrer'
          try { link.textContent = new URL(record.source_url).host } catch { link.textContent = record.source_url }
          line.append(link)
          full.append(line)
        }
        add(record.note)
      }
      if (entry) {
        add(language === 'de' ? entry.count_de : entry.count_en)
        add(language === 'de' ? entry.class_de : entry.class_en)
      }
      add(copy.codices, 'h4')
      full.append(buildCodexList(language, '', options.openLeaf, options.openBook, book.codex))
      full.append(buildAbsences(language))
      host.append(full)
    },
  }
}
