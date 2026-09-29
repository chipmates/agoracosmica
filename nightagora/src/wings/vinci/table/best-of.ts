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
export interface BestOfText { text: string; kind: 'printed' | 'ours' | null; label: string | null }
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
  text_class: string
  /** which kinds of words the page has in each language, or null for none */
  words: { en: string | null; de: string | null; it: boolean } | null
  lead: BestOfLead | null
  /** the words seat found nothing on this page that stops a visitor */
  lead_none: boolean
  lead_placeholder: boolean
  /** the page's words run long: the lead passage shows and the rest folds */
  long: boolean
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

interface BestOfIndex {
  notices: { no_words: { en: string | null; de: string | null }; how_made: { en: string | null; de: string | null } }
  topics: BestOfTopic[]
  pages: BestOfPage[]
}
const INDEX = JSON.parse(indexRaw) as BestOfIndex

export const BEST_OF_TOPICS: readonly BestOfTopic[] = INDEX.topics
export const BEST_OF_PAGES: readonly BestOfPage[] = INDEX.pages
export const BEST_OF_NOTICES = INDEX.notices
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

interface ScanRecord extends ManifestEntry {
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
export function bestOfSource(page: BestOfPage, index: ManifestIndex):
  { source: DeepPlateSource; thumb: string; record: ScanRecord } | null {
  const all = index.all as readonly ScanRecord[]
  const record = all.find(entry => entry.path === page.file && entry.role === 'codex-page')
  if (!record || record.display !== true || !record.width || !record.height) return null
  const width = record.width, height = record.height
  const tiles = all.find(entry => entry.role === 'codex-tiles' && entry.derived_from === record.id)
  const cut = tiles && tiles.display === true && tiles.source_sha256 === record.sha256
    && tiles.width === width && tiles.height === height && tiles.tile_size && tiles.scale_factors?.length && tiles.path.endsWith('/')
    ? { base: assetPyramidBase(tiles), width, height, tileSize: tiles.tile_size, scaleFactors: tiles.scale_factors }
    : null
  const small = page.thumb ? all.find(entry => entry.path === page.thumb && entry.display === true) : undefined
  const file = assetAddress(record)
  return {
    source: { pyramid: cut, file, width, height },
    thumb: small ? assetAddress(small) : cut ? coarsest(cut) : file,
    record,
  }
}
