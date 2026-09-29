/** ONE TOPIC OF THE BEST-OF, AS A BOOK IN THE READER. Both wings open a topic
 * here: the live room and the film. Its pages are the topic's own, in the
 * order the words pass gave them; its gold is the next topic; its line is the
 * page's lead in his words with the source row under it; the whole text, the
 * mirror and the record are each one step away.
 *
 * Every word shown comes from the joined data (`best-of.json`) or from the
 * room's existing words. A new key that is not written yet stands down to the
 * existing word its note in `forge/best-of.mjs` names, or to nothing.
 */
import { lang } from '../../content'
import { deskControl } from '../../desk-story'
import type { ManifestIndex } from '../../../manifest'
import { assetAddress } from '../../../stack/materials'
import type { DeepPlateSource, DeepPlateTier } from '../../vitrine/deep-plate'
import { createReaderPayload, type ReaderBook, type ReaderPayload, type ReaderSide, type ReaderWay } from '../../vitrine/reader'
import type { VitrineExhibit } from '../../vitrine/types'
import { vinciManuscriptWords, VINCI_VITRINE_WORDS } from '../collection/close-look'
import type { VinciText } from '../content'
import { BEST_OF_NOTICES, BEST_OF_TOPICS, bestOfKey, bestOfRecord, bestOfSource, bestOfTopic, topicExhibit, topicPages,
  topicTexts, type BestOfLang, type BestOfPage, type BestOfPageTexts, type BestOfPassage } from './best-of'
import { SHELF_BOOKS } from './codex-shelf'
import { MIRROR_EXPLANATION, TABLE_UI } from './content'

export interface BestOfLookOptions {
  slug: string
  /** the page the topic opens at, by its id; the topic's first where absent */
  start?: string
  manifest: Promise<ManifestIndex>
  tier(): DeepPlateTier
  /** the colour of the museum's word for a documented reproduction */
  colour: string
  narrow(): boolean
  /** the topic before or after, in the same window */
  openTopic(slug: string, from: HTMLElement | null): void
  /** the record over the close look */
  openRecord(id: string, title: VinciText, render: (host: HTMLElement) => void): void
  /** a whole book of the shelf, where the page's codex stands on it */
  openBook?(id: string): void
  /** the set of topics, from the phone's count */
  openShelf?(): void
  close(): void
  /** the page or the way changed, so an open record repaints */
  changed?(): void
}

export interface BestOfLook {
  exhibit: VitrineExhibit
  payload: ReaderPayload
  /** the record of the page open now, for a record that repaints */
  renderRecord(host: HTMLElement): void
}

/** THE PLACE A TOPIC'S PAGE STANDS AT, for a reader turning back to it. */
const LEFT = new Map<string, string>()

const node = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] => {
  const made = document.createElement(tag)
  made.className = cls
  if (text !== undefined) made.textContent = text
  return made
}

/** His words stand in quotation marks, the page's language's own. */
const quoted = (text: string, language: BestOfLang): string => language === 'de' ? `„${text}“` : `“${text}”`

/** The shelf's whole book a page's codex belongs to, where there is one. */
function bookOf(page: BestOfPage): string | null {
  const key: Record<string, string> = {
    'Codex Madrid I': 'madrid-I', 'Codex Madrid II': 'madrid-II', 'Codex Trivulzianus': 'trivulzianus',
    'Codex on the Flight of Birds': 'birds', 'Codex Atlanticus': 'atlanticus', 'Codex Arundel': 'arundel',
  }
  if (page.codex === 'Paris Manuscript B' || page.codex === 'Paris Manuscript D') return SHELF_BOOKS[0]?.id ?? null
  const id = key[page.codex]
  return id ? SHELF_BOOKS.find(book => book.codex === id)?.id ?? null : null
}

export function createBestOfLook(options: BestOfLookOptions): BestOfLook {
  const language: BestOfLang = lang()
  const words = vinciManuscriptWords()
  const copy = TABLE_UI[language]
  const topic = bestOfTopic(options.slug)
  const pages = topicPages(options.slug)
  const title = topic?.title?.[language] ?? ''
  const at = BEST_OF_TOPICS.findIndex(entry => entry.slug === options.slug)
  const key = (name: Parameters<typeof bestOfKey>[0]): string | null => bestOfKey(name, language)
  let texts: Record<string, BestOfPageTexts> = {}
  let index: ManifestIndex | undefined
  let italian = false

  /* ---- what a page says at rest ---- */

  /** Nothing printed: the museum holds no transcription, or the edition prints the drawing alone. */
  const noWords = (page: BestOfPage): string =>
    (page.drawing_only ? BEST_OF_NOTICES.no_words_drawing_only?.[language] : null) ?? BEST_OF_NOTICES.no_words[language] ?? ''

  /** The lead in his words, with whose words they are; the caption where the
   * page has no lead. */
  function lineOf(page: BestOfPage): { head: string | null; note: string | null } {
    const lead = page.lead?.[language]
    if (lead?.text) {
      const note = lead.kind === 'ours' ? key('ai_short') ?? lead.label : lead.label
      return { head: quoted(lead.text, language), note: note ?? null }
    }
    return { head: page.caption?.[language] ?? null, note: null }
  }
  const pictureWord = (page: BestOfPage): string | null =>
    page.picture === 'leaf' ? key('kind_leaf') : page.picture === 'plate' ? key('kind_plate') : page.picture === 'facsimile' ? key('kind_facsimile') : null

  /** THE WAYS OF ONE PAGE: his hand as the page stands, and the mirror where
   * the page carries writing, turning the scan itself or, where the holder's
   * licence keeps the scan as it is, the printed plate of the same page. */
  function waysOf(page: BestOfPage): ReaderWay[] {
    const own = { ceiling: words.ceiling }
    const first = page.hand === 'copy' ? key('the_page') : words.hand
    if (!first) return []
    const note = page.direction === 'ordinary' ? key('mirror_ordinary') ?? MIRROR_EXPLANATION[language].documented
      : MIRROR_EXPLANATION[language].documented
    const hand: ReaderWay = { id: 'hand', label: first, ...own }
    if (page.hand === 'copy' || page.mirror === 'none') return [hand]
    if (page.mirror === 'own') return [hand, { id: 'mirror', label: words.mirror, mirrored: true, line: note, ...own }]
    const record = page.plate && index ? bestOfRecord(index, page.plate.path) : undefined
    if (!record || !page.plate) return [hand]
    const plate = record as { honesty_en?: string; honesty_de?: string }
    const source: DeepPlateSource = { pyramid: null, file: assetAddress(record), width: page.plate.width, height: page.plate.height }
    const said = key('mirror_plate') ?? [note, language === 'de' ? plate.honesty_de : plate.honesty_en].filter(Boolean).join(' ')
    return [hand, { id: 'mirror', label: words.mirror, mirrored: true, source, window: page.plate.window, line: said, ...own }]
  }

  /** "Flight, 2 of 18": the topic and the page's place in it. */
  function countOf(place: number, count: number): string {
    const pattern = key('topic_count') ?? `{topic}, ${deskControl('picture', 'place')[language] || '{n} / {total}'}`
    return pattern.replace('{topic}', title).replace('{n}', String(place + 1)).replace('{total}', String(count))
  }

  function sideOf(page: BestOfPage, place: number, count: number): ReaderSide | null {
    if (!index) return null
    const found = bestOfSource(page, index)
    if (!found) return null
    const { head, note } = lineOf(page)
    // ONE HALF OF AN OPENING shows the open spread on the desktop, both
    // sides whole, where the store holds the pair as one picture
    const spread = page.spread && !options.narrow() ? bestOfRecord(index, page.spread.file) : undefined
    const opening: DeepPlateSource | null = spread?.width && spread.height
      ? { pyramid: null, file: assetAddress(spread), width: spread.width, height: spread.height } : null
    return {
      id: page.id,
      label: page.name?.[language] ?? page.seat[language],
      shows: page.caption?.[language] ?? '',
      notes: [topic?.line?.[language] ?? '', pictureWord(page) ?? '', !page.words ? noWords(page) : ''],
      source: opening ?? found.source,
      // the leaf, framed, where its photograph shows a ground around it: a
      // zoom state, with the whole photograph one step further out
      window: opening ? null : page.leaf,
      thumb: found.thumb,
      ways: waysOf(page),
      colour: options.colour,
      named: null,
      head,
      note,
      seat: page.name ? page.seat[language] : '',
      count: countOf(place, count),
      volume: options.slug,
      honesty: '',
    }
  }

  /* ---- the whole text, one step away ---- */

  const printed = (text: string): string => text.replace(/[ \t]+\n/g, '\n').replace(/\n(?:[ \t]*\n)+/g, '\n\n').trim()
  /** The struck words of the edition shown struck, the rest as printed. */
  function textNode(text: string, lang_: string): HTMLParagraphElement {
    const out = node('p', 'vitrine-source-text')
    out.lang = lang_
    for (const [part, piece] of printed(text).split('~~').entries()) {
      if (!piece) continue
      out.append(part % 2 ? node('s', '', piece) : document.createTextNode(piece))
    }
    return out
  }

  function column(side: ReaderSide): readonly HTMLElement[] {
    const page = pages.find(entry => entry.id === side.id)
    const own = page ? texts[page.id] : undefined
    const shown = (own?.passages ?? []).filter((passage: BestOfPassage) => !passage.missing)
    if (!page || !shown.length) return [node('p', 'vitrine-meta', page ? noWords(page) : '')]
    const out: HTMLElement[] = []
    // THE PRINTED ITALIAN, swapped in by one control, never a tab of three
    if (shown.some(passage => passage.it)) {
      const swap = node('button', 'vitrine-control reader-italian', key('italian') ?? copy.italian)
      swap.type = 'button'
      swap.setAttribute('aria-pressed', String(italian))
      swap.addEventListener('click', () => { italian = !italian; payload.refresh() })
      out.push(swap)
    }
    for (const passage of shown) {
      const section = node('section', 'reader-passage')
      if (passage.index === own?.lead) section.dataset['lead'] = 'true'
      const words_ = italian ? passage.it : passage[language]
      const text = words_?.text ?? ''
      if (!text) continue
      if (passage.label_only) section.dataset['label'] = 'true'
      section.append(textNode(text, italian ? 'it' : language))
      const label = italian ? passage.it?.label[language] : passage[language]?.label
      if (label) section.append(node('p', 'vitrine-meta', label))
      out.push(section)
    }
    return out
  }

  /* ---- the book ---- */

  function buildBook(): ReaderBook {
    const sides: ReaderSide[] = []
    for (const page of pages) {
      const side = sideOf(page, sides.length, pages.length)
      if (side) sides.push(side)
    }
    // the count is the pages the store admits, so a page still waiting is never counted
    for (const [place, side] of sides.entries()) side.count = countOf(place, sides.length)
    return { sides, stripLabel: () => title, holder: '', holderInRecord: true, honesty: '' }
  }

  const book = Promise.all([options.manifest, topicTexts(options.slug).catch(() => ({}))]).then(([loaded, own]) => {
    index = loaded
    texts = own
    return buildBook()
  })

  const payload: ReaderPayload = createReaderPayload({
    book,
    start: options.start ?? LEFT.get(options.slug) ?? pages[0]?.id,
    words: {
      whole: words.whole, nearer: words.nearer, further: words.further, ceiling: words.ceiling,
      previous: words.previous, next: words.next, place: words.place, more: words.more,
      moreLabel: words.moreLabel, back: words.back,
    },
    tier: options.tier,
    column,
    columnLabel: key('full_text') ?? copy.transcription,
    lined: true,
    changed: () => {
      const here = payload.current()
      if (here) LEFT.set(options.slug, here.id)
      paintText()
      options.changed?.()
    },
  })

  /* ---- the exhibit: its keys, its walk, its record ---- */

  const control = (label: string, run: () => void, role: string): HTMLButtonElement => {
    const button = node('button', 'vitrine-control', label)
    button.type = 'button'
    button.dataset['role'] = role
    button.addEventListener('click', run)
    return button
  }
  const text = control(key('full_text') ?? copy.transcription, () => { payload.readAlong(); paintText() }, 'text')
  function paintText(): void {
    text.setAttribute('aria-pressed', String(payload.columnOpen()))
  }
  const recordWord: VinciText = { en: bestOfKey('full_record', 'en') ?? VINCI_VITRINE_WORDS.provenance.en,
    de: bestOfKey('full_record', 'de') ?? VINCI_VITRINE_WORDS.provenance.de }
  const id = topicExhibit(options.slug)
  const record = control(recordWord[language], () => options.openRecord(id, recordWord, renderRecord), 'record')
  const shut = control(VINCI_VITRINE_WORDS.close[language], () => options.close(), 'close')

  /** THE WALK IS TOPIC TO TOPIC: the gold is the next one, named, and the
   * circle the one before; the page's own arrows turn its pages. */
  function step(glyph: string, to: number, prefix: string | null): HTMLButtonElement {
    const target = BEST_OF_TOPICS[to]
    const button = node('button', 'vitrine-control vitrine-step', glyph)
    button.type = 'button'
    button.disabled = !target
    if (target) {
      const name = target.title?.[language] ?? ''
      button.setAttribute('aria-label', prefix ? (prefix.includes('{name}') ? prefix.replace('{name}', name) : `${prefix} · ${name}`) : name)
      button.addEventListener('click', () => options.openTopic(target.slug, button))
    }
    return button
  }
  const back = step('‹', at - 1, key('previous_topic'))
  const on = step('›', at + 1, null)

  function renderRecord(host: HTMLElement): void {
    const here = payload.current()
    const page = pages.find(entry => entry.id === here?.id) ?? pages[0]
    if (!page) return
    const full = node('div', 'vinci-record')
    full.dataset['register'] = 'record'
    const add = (said: string | null | undefined, cls = 'vinci-statement'): void => {
      if (said) full.append(node('p', cls, said))
    }
    add(page.name ? `${page.name[language]} · ${page.seat[language]}` : page.seat[language])
    // the holder's own line, verbatim: the Institut's in French, with its licence
    add(page.credit)
    const scan = index ? bestOfSource(page, index)?.record : undefined
    add(scan?.licence)
    const link = (label: string, url: string): void => {
      const line = node('p', 'vinci-statement')
      const a = node('a', 'vinci-picture-source', label)
      a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'
      line.append(a)
      full.append(line)
    }
    if (scan?.source_url) {
      let host_ = scan.source_url
      try { host_ = new URL(scan.source_url).host } catch { /* the address as written */ }
      link(host_, scan.source_url)
    }
    // THE WHOLE BOOK: on the shelf where it stands there, at its holder's where not
    const whole = deskControl('overview', 'whole_book')[language]
    const shelf = bookOf(page)
    const open = options.openBook
    if (shelf && open && whole) {
      const go = node('button', 'vitrine-control', whole)
      go.type = 'button'
      go.addEventListener('click', () => open(shelf))
      const line = node('p', 'vinci-statement')
      line.append(go)
      full.append(line)
    } else {
      const holderUrl = /https?:\/\/\S+?(?=[\s.]*$|\s)/.exec(page.credit)?.[0]
      if (holderUrl && whole && holderUrl !== scan?.source_url) link(whole, holderUrl)
    }
    // the plate the mirror shows, where it is not the page's own scan
    if (page.mirror === 'plate' && page.plate && index) {
      const plate = bestOfRecord(index, page.plate.path) as { honesty_en?: string; honesty_de?: string } | undefined
      add(language === 'de' ? plate?.honesty_de : plate?.honesty_en)
    }
    const own = texts[page.id]
    if (page.words && own) {
      const how = BEST_OF_NOTICES.how_made[language]
      // the check's result is the coordinator's to write in; until then the sentence stands without it
      add(how?.replace(/\s*\{result\}\s*/, ' ').trim())
      const ai = new Set(own.passages.map(passage => passage[language]).filter(t => t?.kind === 'ours').map(t => t!.label).filter(Boolean))
      for (const sentence of ai) add(sentence)
      for (const passage of own.passages) for (const doubt of passage[language]?.doubts ?? []) add(doubt, 'vinci-statement vitrine-meta')
    }
    host.append(full)
  }

  const first = pages.find(page => page.id === (options.start ?? LEFT.get(options.slug))) ?? pages[0]
  const opening = first ? lineOf(first) : { head: null, note: null }
  const exhibit: VitrineExhibit = {
    id,
    title: first ? first.name?.[language] ?? first.seat[language] : title,
    line: opening.head,
    note: opening.note,
    card: [],
    controls: [text, record, shut],
    walk: [back, on],
    certainty: 'documented',
    payload,
    // the gold's kicker is the template's words before the topic's own name
    onKicker: key('next_topic')?.replace(/\s*·?\s*\{name\}\s*$/, '') || null,
    ...(options.openShelf ? { onCount: options.openShelf } : {}),
  }
  return { exhibit, payload, renderRecord }
}
