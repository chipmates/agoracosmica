/** THE READER: the book on the table as a vitrine payload.
 *
 * Walked to, the eye stands over the book and the room turns its leaves: the
 * table's own ribbon, its own stream with one open plate at 2K, the mirror
 * hand as the open leaf reversed where it lies. Not walked to (the phone,
 * calm, reduced motion), the leaf is read in the viewport over the held frame:
 * one page image at a time, the facing page beside it where the edition binds
 * it so, and the mirror hand as the leaf reversed with every word beside it
 * left readable. The words are the table's own: its interface copy, its page
 * records, its register of codices.
 */
import type { ManifestEntry, ManifestIndex } from '../../../manifest'
import type { VitrinePayload, VitrinePayloadHost } from '../../vitrine/types'
import { buildAbsences, buildCodexList } from './codex-shelf'
import { FAMOUS_FOLIOS, MIRROR_EXPLANATION, TABLE_UI, folioKey, folioProvenance, hasItalian, type Language, type PageRecord } from './content'
import type { ReadingTable } from './index'

/** Frames the room draws before it may be held, after the last change. */
const SETTLE_FRAMES = 2

export interface ReaderPayload extends VitrinePayload {
  /** Open one record by its key: `B:83v` or `edition:340`. */
  open(key: string): void
  /** The record behind "Where it comes from" for the page open now. */
  renderRecord(host: HTMLElement): void
}

export function createReaderPayload(options: {
  table: ReadingTable
  manifest: Promise<ManifestIndex>
  /** True when the eye was walked to the book, so the room reads it. */
  walked(): boolean
  /** True once the eye stands where it will stand for the book. */
  standing(): boolean
  /** The words the museum puts beside every page: its own "More", and the
   * honesty line of a page's reproduction. */
  more: string
  honesty: string
  /** The record changed page: the sources window repaints if it is open. */
  changed(): void
}): ReaderPayload {
  const { table } = options
  const pages = table.pages
  let host: VitrinePayloadHost | undefined, lang: Language = 'en'
  let room = false, settled = 0, held = false
  let at = table.at(), painted = -1
  let mirrored = false, facing = true, shelfOpen = false, moreOpen = false
  let manifest: ManifestIndex | undefined
  let figure: HTMLElement | undefined, leaf: HTMLImageElement | undefined, facingImage: HTMLImageElement | undefined
  const listening = new AbortController()
  const buttons: { previous?: HTMLButtonElement; next?: HTMLButtonElement; mirror?: HTMLButtonElement; facing?: HTMLButtonElement; shelf?: HTMLButtonElement } = {}

  const make = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] => {
    const n = host!.element.ownerDocument.createElement(tag); n.className = cls; if (text !== undefined) n.textContent = text; return n
  }
  const copy = () => TABLE_UI[lang]

  /** A leaf has two printed faces: a turn moves two records, as the table does. */
  function destination(direction: number): number {
    return Math.max(0, Math.min(pages.length - 1, at + 2 * Math.sign(direction)))
  }

  /** The manifested image of one record at one level, as the table's stream
   * joins it: by the complete page file and the recorded role. */
  function image(page: PageRecord, full: boolean): string | null {
    const role = full ? 'ms-page' : 'ms-thumb'
    const entry = manifest?.all.find(candidate => (candidate as ManifestEntry & { page?: string; role?: string }).page === page.file
      && (candidate as ManifestEntry & { role?: string }).role === role)
    return entry ? `/na-assets/${entry.wing}/${entry.path}` : null
  }

  /** ONE PAGE RESIDENT. The leaf shows its thumbnail at once and its plate
   * when that has decoded; the image it replaces is released with it. */
  function paintLeaf(): void {
    if (room || !host || !figure || !manifest) return
    const page = pages[at]!, facingPage = pages[Math.max(0, at - 1)]!
    const next = make('img', 'vitrine-leaf-page')
    next.alt = ''
    next.decoding = 'async'
    const thumb = image(page, false), plate = image(page, true)
    if (thumb) next.src = thumb
    if (plate) {
      const full = new Image()
      full.decoding = 'async'
      full.src = plate
      void full.decode().then(() => { if (leaf === next) next.src = plate }).catch(() => { /* the thumbnail stays */ })
    }
    next.classList.toggle('vitrine-leaf-mirrored', mirrored)
    leaf?.remove()
    leaf = next
    facingImage?.remove()
    facingImage = undefined
    // The facing page is edition matter, so it stays a thumbnail as it does
    // on the table.
    if (facing && at > 0) {
      const left = make('img', 'vitrine-leaf-page vitrine-leaf-facing')
      left.alt = ''
      left.decoding = 'async'
      const src = image(facingPage, false)
      if (src) left.src = src
      facingImage = left
      figure.append(left)
    }
    figure.append(next)
  }

  /** The folio named, its description, and what More, the mirror hand and
   * the shelf open beside it. */
  function paintWords(): void {
    if (!host) return
    painted = at
    const page = pages[at]!, words = copy()
    const identity = page.codex && page.folio !== null && page.side
      ? `${page.folio} ${page.side === 'recto' ? words.recto : words.verso}` : kind(page)
    host.caption.textContent = identity
    host.caption.lang = lang
    host.describe(identity)
    const aside = host.aside
    aside.textContent = ''
    const block = make('section', 'vitrine-folio-words')
    block.lang = lang
    block.append(make('p', 'vitrine-meta', page.codex ? `${words.manuscript} ${page.codex}` : words.edition))
    const title = make('h3', 'vitrine-folio-name', identity)
    block.append(title)
    const named = FAMOUS_FOLIOS.find(entry => folioKey(page) === `B:${entry.folio}`)
    if (named) block.append(make('p', '', named[lang]))
    block.append(make('p', 'vitrine-meta', folioProvenance(page, lang, identity)))
    block.append(make('p', '', lang === 'en' ? page.what_it_shows_en : page.what_it_shows_de))
    // THE TRANSCRIPTION AND THE FRENCH ARE ONE DELIBERATE CONTROL AWAY.
    const texts = make('div', 'vitrine-description')
    texts.id = 'vitrine-reader-texts'
    texts.hidden = !moreOpen
    const italian = make('section', '')
    italian.append(make('h4', 'vitrine-meta', words.italian), make('p', 'vitrine-meta', words.italianDetail))
    const it = make('p', 'vitrine-source-text', hasItalian(page) ? page.transcription_it ?? '' : words.unavailable)
    if (hasItalian(page)) it.lang = 'it'
    if (page.ocr_confidence === 'low') italian.append(make('p', 'vitrine-meta', words.lowOcr))
    italian.append(it)
    const french = make('section', '')
    french.append(make('h4', 'vitrine-meta', words.french), make('p', 'vitrine-meta', words.frenchDetail))
    const fr = make('p', 'vitrine-source-text', page.translation_fr ?? words.frenchUnavailable)
    if (page.translation_fr) fr.lang = 'fr'
    french.append(fr)
    texts.append(italian, french)
    const more = make('button', 'vitrine-more', options.more)
    more.type = 'button'
    more.setAttribute('aria-expanded', String(moreOpen))
    more.setAttribute('aria-controls', texts.id)
    more.addEventListener('click', () => {
      moreOpen = !moreOpen
      texts.hidden = !moreOpen
      more.setAttribute('aria-expanded', String(moreOpen))
    })
    block.append(more, texts)
    if (mirrored) {
      const mirror = MIRROR_EXPLANATION[lang], explained = make('section', 'vitrine-description')
      explained.append(make('h4', 'vitrine-meta', mirror.title), make('p', '', mirror.documented), make('p', '', mirror.hypothesis), make('p', '', mirror.unknown))
      block.append(explained)
    }
    if (shelfOpen) {
      const shelf = make('section', 'vitrine-reader-shelf')
      shelf.id = 'vitrine-reader-shelf'
      shelf.lang = lang
      shelf.append(make('h4', 'vitrine-meta', words.codices), buildCodexList(lang, folioKey(page), key => open(key)))
      const leaves = make('ol', 'vitrine-reader-leaves')
      for (const famous of FAMOUS_FOLIOS) {
        const item = make('li', '')
        const go = make('button', 'vitrine-step-item', `${famous.folio} · ${famous[lang]}`)
        go.type = 'button'
        go.setAttribute('aria-current', folioKey(page) === `B:${famous.folio}` ? 'page' : 'false')
        go.addEventListener('click', () => open(`B:${famous.folio}`))
        item.append(go)
        leaves.append(item)
      }
      shelf.append(make('h4', 'vitrine-meta', words.famous), leaves, buildAbsences(lang))
      block.append(shelf)
    }
    block.append(make('p', 'vitrine-meta', options.honesty))
    aside.append(block)
    buttons.previous!.disabled = destination(-1) === at
    buttons.next!.disabled = destination(1) === at
  }

  function kind(page: PageRecord): string {
    const words = copy()
    const labels: Record<string, string> = {
      facsimile: words.facsimile, translation: words.translation, title: words.titlePage, editorial: words.editorial,
      blank: words.blank, end_matter: words.endMatter, missing_notice: words.missingNotice,
    }
    return labels[page.page_kind] ?? words.editionMatter
  }

  function wake(): void {
    settled = 0
    if (held && host) { held = false; host.surface('room') }
  }

  function turn(direction: number): void {
    if (room) {
      if (table.turning()) return
      wake()
      table.turn(direction)
      return
    }
    const next = destination(direction)
    if (next === at) return
    at = next
    paintLeaf()
    paintWords()
    options.changed()
  }

  function open(key: string): void {
    const found = table.resolve(key)
    if (found < 0) return
    if (room) {
      wake()
      void table.open(key)
      at = found
    } else {
      at = found
      paintLeaf()
    }
    paintWords()
    options.changed()
  }

  function control(label: string, cls: string, run: () => void, name?: string): HTMLButtonElement {
    const button = make('button', `vitrine-control ${cls}`, label)
    button.type = 'button'
    if (name) button.setAttribute('aria-label', name)
    button.addEventListener('click', run, { signal: listening.signal })
    return button
  }

  return {
    kind: 'manuscript',
    mount(next) {
      host = next
      lang = next.lang
      room = options.walked()
      at = table.at()
      const words = copy()
      buttons.previous = control('‹', 'vitrine-step', () => turn(-1), words.previous)
      buttons.next = control('›', 'vitrine-step', () => turn(1), words.next)
      buttons.mirror = control(words.mirror, 'vitrine-reader-mirror', () => {
        mirrored = !mirrored
        buttons.mirror!.setAttribute('aria-pressed', String(mirrored))
        if (room) { wake(); table.flipLeaf(mirrored) } else leaf?.classList.toggle('vitrine-leaf-mirrored', mirrored)
        paintWords()
      })
      buttons.facing = control(words.translation, 'vitrine-reader-facing', () => {
        facing = !facing
        buttons.facing!.setAttribute('aria-pressed', String(facing))
        if (room) { wake(); table.paperOnly(!facing) } else paintLeaf()
      })
      buttons.shelf = control(words.shelf, 'vitrine-reader-shelf-control', () => {
        shelfOpen = !shelfOpen
        buttons.shelf!.setAttribute('aria-expanded', String(shelfOpen))
        paintWords()
        if (shelfOpen) host?.aside.querySelector<HTMLElement>('#vitrine-reader-shelf')?.scrollIntoView({ block: 'nearest' })
      })
      buttons.mirror.setAttribute('aria-pressed', 'false')
      buttons.facing.setAttribute('aria-pressed', 'true')
      buttons.shelf.setAttribute('aria-expanded', 'false')
      buttons.shelf.setAttribute('aria-controls', 'vitrine-reader-shelf')
      const row = make('div', 'vitrine-reader-row')
      row.append(buttons.previous, buttons.mirror, buttons.facing, buttons.shelf, buttons.next)
      next.controls.append(row)
      figure = make('div', 'vitrine-leaf')
      figure.hidden = room
      next.element.append(figure)
      next.surface('room')
      settled = 0; held = false
      paintWords()
      void options.manifest.then(index => { manifest = index; paintLeaf() })
    },
    update() {
      if (!host) return
      if (room && table.at() !== painted) { at = table.at(); paintWords(); options.changed() }
      if (held) return
      // THE ROOM DRAWS WHILE A LEAF IS ON ITS WAY OR A PLATE IS ARRIVING, and
      // holds its last frame once the page lies still.
      const still = options.standing() && (!room || (!table.turning() && table.pending() === 0))
      if (!still) { settled = 0; return }
      if (++settled <= SETTLE_FRAMES) return
      host.surface('hold')
      held = true
    },
    layout() {
      if (host && held) wake()
    },
    key(event) {
      if (event.key === 'ArrowLeft' || event.key === ',') { turn(-1); return true }
      if (event.key === 'ArrowRight' || event.key === '.') { turn(1); return true }
      return false
    },
    open,
    renderRecord(record) {
      const page = pages[at]!, words = copy()
      const full = record.ownerDocument.createElement('div')
      full.className = 'vinci-record'
      full.dataset['register'] = 'record'
      const add = (text: string, tag: 'p' | 'h3' = 'p'): void => {
        const n = record.ownerDocument.createElement(tag); n.className = tag === 'p' ? 'vinci-statement' : ''; n.textContent = text; full.append(n)
      }
      add(words.source, 'h3')
      add(words.reproduction)
      if (page.ocr_note_en) add(lang === 'en' ? page.ocr_note_en : page.ocr_note_de ?? page.ocr_note_en)
      const link = (label: string, url: string): void => {
        const a = record.ownerDocument.createElement('a')
        a.className = 'vinci-picture-source'; a.textContent = label; a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'
        full.append(a)
      }
      link(words.sourceImage, page.source_url)
      const folioUrl = page.machine_sources.find(source => source.folio_source_url)?.folio_source_url
      if (folioUrl) link(words.folioSource, folioUrl)
      add(page.licence_line)
      // THE PAGE-RECORD SELECTORS, demoted here from the reader: every record
      // of the edition and every represented leaf stays reachable by name.
      const selector = (label: string, records: readonly PageRecord[], value: (page: PageRecord) => string, text: (page: PageRecord) => string): void => {
        const wrap = record.ownerDocument.createElement('label')
        wrap.className = 'vinci-statement'
        wrap.append(label)
        const select = record.ownerDocument.createElement('select')
        select.setAttribute('aria-label', label)
        // A control a hand has to hit, in a window a thumb reaches.
        select.style.minHeight = '44px'
        select.style.marginLeft = '8px'
        for (const entry of records) {
          const option = record.ownerDocument.createElement('option')
          option.value = value(entry); option.textContent = text(entry); option.selected = entry.file === page.file
          select.append(option)
        }
        select.addEventListener('change', () => open(select.value))
        wrap.append(select)
        full.append(wrap)
      }
      selector(words.manuscriptLeaf, pages.filter(entry => entry.page_kind === 'facsimile'), folioKey,
        entry => `${entry.codex} ${entry.folio}${entry.side === 'recto' ? 'r' : 'v'}`)
      selector(words.editionPage, pages, entry => `edition:${entry.edition_index}`, entry => `${entry.edition_index + 1} · ${kind(entry)}`)
      record.append(full)
    },
    unmount() {
      listening.abort()
      figure?.remove()
      figure = undefined; leaf = undefined; facingImage = undefined
      if (room) {
        // The book stays open where it was read, in the hand it was read in.
        table.flipLeaf(false)
        if (!facing) table.paperOnly(false)
      } else if (at !== table.at()) void table.open(`edition:${at}`)
      host = undefined
      held = false
    },
  }
}
