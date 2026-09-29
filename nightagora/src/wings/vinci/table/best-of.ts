/** THE READING TABLE'S BEST-OF: the curator's pages by topic, as the data
 * step joined them (`forge/best-of.mjs`). This module only reads that join:
 * every word it hands on is a word of the files, and a page's pixels are the
 * store's own record of its scan, found by path, or no page at all.
 */
import indexRaw from './data/best-of.json?raw'
import { TOPIC_TEXTS } from './data/best-of-texts'
import type { ManifestEntry, ManifestIndex } from '../../../manifest'
import { assetAddress, assetPyramidBase } from '../../../stack/materials'
import type { DeepPlateSource } from '../../vitrine/deep-plate'

export type BestOfLang = 'en' | 'de'
export interface BestOfWords { en: string; de: string }
/** One translation or printed text, with the label that says whose it is. */
export interface BestOfText { text: string; kind: 'printed' | 'ours' | null; label: string | null; doubts?: readonly string[] }
export interface BestOfItalian { text: string; label: { en: string | null; de: string | null } }
export interface BestOfLead {
  passage: number
  /** the lead passage's first sentence, standing until the lead lines arrive */
  placeholder: boolean
  en: BestOfText | null
  de: BestOfText | null
  it: BestOfItalian | null
}
export interface BestOfPage {
  id: string
  topic: string
  order: number
  codex: string
  folio: string
  side: string
  /** the scan's path in the store */
  file: string
  /** the store's thumbnail of a scan with no pyramid, where one was cut */
  thumb: string | null
  /** true while the scan waits for the store patch */
  fresh: boolean
  /** the holder's own credit line, verbatim */
  credit: string
  caption: BestOfWords | null
  /** the page carries writing, so the mirror is a way of reading it */
  writing: boolean
  /** its printed edition prints the drawing and no words for it */
  drawing_only: boolean
  text_class: string
  /** which kinds of words the page has in each language, or null for none */
  words: { en: string | null; de: string | null; it: boolean } | null
  lead: BestOfLead | null
  /** the words seat found nothing on this page that stops a visitor */
  lead_none: boolean
  lead_placeholder: boolean
  /** the page's words run long */
  long: boolean
  /** the curator's place for the page, before the plan's moves */
  curator_order: number
  /** the short page name of the words pass, null until it is written */
  name: BestOfWords | null
  /** the codex and the folio, which stand in the name row where a date would */
  seat: BestOfWords
  /** what the picture is: a photograph of the leaf, a printed plate, or a
   * photograph of a printed facsimile */
  picture: 'leaf' | 'plate' | 'facsimile' | null
  /** his usual hand from right to left, or the ordinary way */
  direction: 'mirror' | 'ordinary'
  /** his own hand, or a copy in another */
  hand: 'his' | 'copy'
  /** the other half of the opening this page is one side of */
  spread: { with: string; half: 'left' | 'right'; file: string } | null
  /** where the leaf stands on its photograph, for the framed opening */
  leaf: { left: number; top: number; right: number; bottom: number } | null
  /** the printed plate the mirror shows where the scan itself is not turned */
  plate: { path: string; window: { left: number; top: number; right: number; bottom: number } | null; width: number; height: number } | null
  /** what the mirror shows: the scan turned, the plate turned, or no mirror */
  mirror: 'own' | 'plate' | 'none'
}
export interface BestOfTopic {
  key: string
  slug: string
  title: BestOfWords | null
  line: BestOfWords | null
  pages: readonly string[]
}
export interface BestOfPassage {
  index: number
  ref: string | null
  missing?: boolean
  note?: string | null
  placement?: string
  it?: BestOfItalian | null
  en?: BestOfText | null
  de?: BestOfText | null
  fr?: { text: string } | null
  label_only?: boolean
  sources?: readonly { edition: string | null; page: string | null; url: string | null }[]
}
export interface BestOfPageTexts { lead: number | null; passages: readonly BestOfPassage[] }

/** The room's new words, by key, null until the words pass writes them. */
export type BestOfKey = 'next_topic' | 'previous_topic' | 'full_text' | 'full_record' | 'ai_short' | 'italian' | 'the_page'
  | 'mirror_ordinary' | 'mirror_plate' | 'kind_leaf' | 'kind_plate' | 'kind_facsimile' | 'topic_pages' | 'topic_count'
  | 'absence_paris_rest' | 'absence_ashburnham' | 'absence_arundel_middle'
interface BestOfIndex {
  draft: boolean
  keys: Record<BestOfKey, BestOfWords | null>
  notices: { no_words: { en: string | null; de: string | null }; no_words_drawing_only: { en: string | null; de: string | null }
    how_made: { en: string | null; de: string | null } }
  topics: BestOfTopic[]
  pages: BestOfPage[]
}
const INDEX = JSON.parse(indexRaw) as BestOfIndex

export const BEST_OF_TOPICS: readonly BestOfTopic[] = INDEX.topics
export const BEST_OF_PAGES: readonly BestOfPage[] = INDEX.pages
export const BEST_OF_NOTICES = INDEX.notices
/** A key of the room's new words in the page's language, or null until written. */
export const bestOfKey = (key: BestOfKey, lang: BestOfLang): string | null => INDEX.keys?.[key]?.[lang] ?? null
/** The topic the table opens at, and the page: the leaf the 1883 volume lies
 * open at in the room, here in colour. */
export const BEST_OF_OPENING = { topic: INDEX.topics[0]?.slug ?? '', page: INDEX.topics[0]?.pages[0] ?? '' }
const PAGES = new Map(INDEX.pages.map(page => [page.id, page]))

/** A topic is an exhibit of the reading table by this id. */
export const TOPIC_PREFIX = 'topic/'
export const topicExhibit = (slug: string): string => `${TOPIC_PREFIX}${slug}`
export const isTopicExhibit = (id: string | null | undefined): boolean => Boolean(id?.startsWith(TOPIC_PREFIX))
export function bestOfTopic(idOrSlug: string): BestOfTopic | undefined {
  const slug = idOrSlug.startsWith(TOPIC_PREFIX) ? idOrSlug.slice(TOPIC_PREFIX.length) : idOrSlug
  return INDEX.topics.find(topic => topic.slug === slug)
}
export const bestOfPage = (id: string): BestOfPage | undefined => PAGES.get(id)
export function topicPages(slug: string): BestOfPage[] {
  return (bestOfTopic(slug)?.pages ?? []).map(id => PAGES.get(id)).filter((page): page is BestOfPage => Boolean(page))
}
/** The topic a page of the set belongs to, by the page's id. */
export const topicOfPage = (id: string): BestOfTopic | undefined => bestOfTopic(PAGES.get(id)?.topic ?? '')

/** The page's words in the language asked for, for a caption or a label. */
export const said = (words: BestOfWords | null | undefined, lang: BestOfLang): string => words?.[lang] ?? ''

const loaded = new Map<string, Promise<Record<string, BestOfPageTexts>>>()
/** The words of every page of one topic, fetched once when the topic opens. */
export function topicTexts(slug: string): Promise<Record<string, BestOfPageTexts>> {
  const load = TOPIC_TEXTS[slug]
  if (!load) return Promise.resolve({})
  let job = loaded.get(slug)
  if (!job) {
    job = load().then(module => (JSON.parse(module.default) as { pages: Record<string, BestOfPageTexts> }).pages)
    // a failed fetch is tried again on the next opening, never cached
    job.catch(() => loaded.delete(slug))
    loaded.set(slug, job)
  }
  return job
}

export interface ScanRecord extends ManifestEntry {
  readonly role?: string
  readonly width?: number
  readonly height?: number
  readonly sha256?: string
  readonly derived_from?: string
  readonly source_sha256?: string
  readonly tile_size?: number
  readonly scale_factors?: readonly number[]
  readonly honesty_en?: string
  readonly honesty_de?: string
  readonly original_url?: string
  readonly tier?: string
}

/** The coarsest level of a level-0 pyramid, which is one tile. */
function coarsest(pyramid: { base: string; width: number; height: number; scaleFactors: readonly number[] }): string {
  const factor = Math.max(...pyramid.scaleFactors)
  const width = Math.ceil(pyramid.width / factor), height = Math.ceil(pyramid.height / factor)
  const size = width === pyramid.width && height === pyramid.height ? 'max' : `${width},${height}`
  return `${pyramid.base}/full/${size}/0/default.jpg`
}

/** WHERE A PAGE'S PIXELS COME FROM: its scan's record, the pyramid cut from
 * that very scan where the store holds one, and the thumbnail the strip and
 * the shelf show. Null where the store does not admit the scan for display. */
const LOOKUPS = new WeakMap<ManifestIndex, { byPath: Map<string, ScanRecord>; tilesOf: Map<string, ScanRecord> }>()
function lookup(index: ManifestIndex) {
  let found = LOOKUPS.get(index)
  if (!found) {
    const byPath = new Map<string, ScanRecord>(), tilesOf = new Map<string, ScanRecord>()
    for (const entry of index.all as readonly ScanRecord[]) {
      if (!byPath.has(entry.path)) byPath.set(entry.path, entry)
      if (entry.role === 'codex-tiles' && entry.derived_from) tilesOf.set(entry.derived_from, entry)
    }
    found = { byPath, tilesOf }
    LOOKUPS.set(index, found)
  }
  return found
}
/** A displayable record of the store by its path, or undefined. */
export function bestOfRecord(index: ManifestIndex, path: string): ScanRecord | undefined {
  const record = lookup(index).byPath.get(path)
  return record?.display === true ? record : undefined
}

export function bestOfSource(page: BestOfPage, index: ManifestIndex):
  { source: DeepPlateSource; thumb: string; record: ScanRecord } | null {
  const { byPath, tilesOf } = lookup(index)
  const found = byPath.get(page.file)
  const record = found?.role === 'codex-page' ? found : undefined
  if (!record || record.display !== true || !record.width || !record.height) return null
  const width = record.width, height = record.height
  const tiles = tilesOf.get(record.id)
  const cut = tiles && tiles.display === true && tiles.source_sha256 === record.sha256
    && tiles.width === width && tiles.height === height && tiles.tile_size && tiles.scale_factors?.length && tiles.path.endsWith('/')
    ? { base: assetPyramidBase(tiles), width, height, tileSize: tiles.tile_size, scaleFactors: tiles.scale_factors }
    : null
  const small = page.thumb ? bestOfRecord(index, page.thumb) : undefined
  const file = assetAddress(record)
  return {
    source: { pyramid: cut, file, width, height },
    thumb: small ? assetAddress(small) : cut ? coarsest(cut) : file,
    record,
  }
}
