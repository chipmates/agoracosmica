/** Complete source images and their supplied evidence, including sources
 * outside the measured picture register. This view invents no object size,
 * date, crop or registration. The caller owns its route and containing layer. */
import type { ManifestIndex } from '../../../../manifest'
import { assetAddress } from '../../../../stack/materials'
import { REGISTER, type PictureWork } from '../register'
import { resolveManifestWorkPlates, resolvePicturePolicy, validatePaintingRecord,
  type PolicyPaintingEntry, type PolicyPicturePlate } from '../policy'

type Bilingual = { en: string; de: string }
export interface CatalogueSource {
  readonly identity: string
  readonly title: Bilingual
  readonly relationship: Bilingual
  readonly inPictureRegister: boolean
  readonly source: PolicyPicturePlate
}

const sourceTitle = (text: string): string => text.split('. ')[0]!.replace(/\.$/, '')
function relationship(source: PolicyPicturePlate): Bilingual {
  if (source.relationship === 'reverse') return { en: 'Reverse of the same panel', de: 'Rückseite derselben Tafel' }
  if (source.relationship === 'historical-photograph') return { en: 'Historical Cook photograph', de: 'Historische Cook-Fotografie' }
  if (source.relationship === 'independent-print') return { en: 'Independent print, 1844', de: 'Eigenständiger Druck, 1844' }
  if (source.identity.endsWith(':restored')) return { en: 'Restored painting', de: 'Restauriertes Gemälde' }
  return { en: 'Reproduction', de: 'Reproduktion' }
}
function citationURL(value: string | undefined): string | null {
  if (!value) return null
  const url = new URL(value)
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Invalid source catalogue citation URL')
  return value
}

/** Preflight every painting record before constructing an image or a DOM
 * node. Legacy sources retain their historical DG allowlist; supplements
 * require an actual tiered record. Supersession remains the policy's decision. */
export function sourceCatalogueRecords(manifest: ManifestIndex, register: readonly PictureWork[] = REGISTER): readonly CatalogueSource[] {
  const records = manifest.all.filter(entry => /^vinci\/painting-(?:preview|plate)\//.test(entry.id)
    || entry.wing === 'wing-vinci' && ['painting-preview', 'painting-plate'].includes((entry as Partial<PolicyPaintingEntry>).role ?? ''))
  const ids = new Set<string>(), workIds = new Set<string>()
  for (const record of records) {
    const valid = validatePaintingRecord(record)
    if (ids.has(record.id)) throw new Error(`Duplicate source catalogue record: ${record.id}`)
    ids.add(record.id); workIds.add(valid.entry.work_id)
    citationURL(valid.entry.source_url)
  }
  const byWork = new Map(register.map(work => [work.id, work]))
  const ordered = [...register.filter(work => workIds.has(work.id)).map(work => work.id),
    ...[...workIds].filter(id => !byWork.has(id)).sort()]
  const identities = new Set<string>()
  return ordered.flatMap(workId => {
    const work = byWork.get(workId)
    const sources = work ? resolvePicturePolicy(work, manifest).all
      : resolveManifestWorkPlates(workId, manifest).filter(source => source.policyTier !== null)
    return sources.map(source => {
      if (identities.has(source.identity)) throw new Error(`Ambiguous source catalogue identity: ${source.identity}`)
      identities.add(source.identity)
      return { identity: source.identity, inPictureRegister: !!work, source,
        title: work ? { en: work.title_en, de: work.title_de }
          : { en: sourceTitle(source.plate.honesty_en!), de: sourceTitle(source.plate.honesty_de!) },
        relationship: relationship(source) }
    })
  })
}

export const sourceCatalogueCSS = `
.picture-source-catalogue { box-sizing:border-box;width:100%;height:100%;overflow:auto;overscroll-behavior:contain;
  padding:22px clamp(16px,4vw,64px) 40px;background:#f1eee4;color:#343c32;font:16px/1.5 Georgia,'Times New Roman',serif;
  text-align:left;text-shadow:none;pointer-events:auto; }
.picture-source-catalogue * { box-sizing:border-box; }
.picture-source-catalogue h2,.picture-source-catalogue h3 { margin:0;font-weight:normal;line-height:1.2; }
.picture-source-catalogue h2 { font-size:20px; }.picture-source-catalogue h3 { font-size:23px; }
.picture-source-catalogue p { margin:8px 0; }.picture-source-catalogue button,.picture-source-catalogue select,
.picture-source-catalogue summary,.picture-source-catalogue a { min-height:44px; }
.picture-source-catalogue button,.picture-source-catalogue select { font:inherit;color:inherit;background:#f9f6ed;border:1px solid #b1af9b;padding:8px 12px; }
.picture-source-catalogue button:focus-visible,.picture-source-catalogue select:focus-visible,.picture-source-catalogue summary:focus-visible,
.picture-source-catalogue a:focus-visible { outline:3px solid #52735a;outline-offset:3px; }
.picture-source-catalogue button:disabled { opacity:.45; }.picture-source-catalogue a { color:#355a44;display:inline-flex;align-items:center;overflow-wrap:anywhere; }
.picture-source-catalogue summary { cursor:pointer;padding:10px 0; }.picture-source-catalogue header { display:flex;justify-content:space-between;gap:16px;align-items:start; }
.picture-source-catalogue-controls { display:flex;gap:8px;align-items:center;margin:16px 0;flex-wrap:wrap; }
.picture-source-catalogue-controls select { flex:1;min-width:160px;max-width:100%; }
.picture-source-catalogue-main { display:grid;grid-template-columns:minmax(0,1fr) minmax(260px,1fr);gap:28px;align-items:start; }
.picture-source-catalogue figure { margin:0;min-width:0; }.picture-source-catalogue-main-image { display:block;width:100%;height:auto;max-height:65vh;object-fit:contain; }
.picture-source-catalogue figcaption { font-size:14px;margin:10px 0; }.picture-source-catalogue-state { color:#59624f;font-style:italic; }
.picture-source-catalogue-copy { min-width:0; }.picture-source-catalogue-language + .picture-source-catalogue-language { border-top:1px solid #c5c0af;margin-top:18px;padding-top:12px; }
.picture-source-catalogue-language-switch { display:none;gap:8px;margin-bottom:12px; }
.picture-source-catalogue-language-switch button[aria-pressed=true] { border:2px solid #52735a; }
.picture-source-catalogue-licence { white-space:pre-wrap; }.picture-source-catalogue-provenance { margin-top:18px;overflow-wrap:anywhere;font-size:13px; }
.picture-source-catalogue-gallery { margin-top:28px;border-top:1px solid #b1af9b;padding-top:18px; }
.picture-source-catalogue-grid { display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px; }
.picture-source-catalogue-thumb { text-align:left;display:flex;flex-direction:column;gap:6px;min-width:0; }
.picture-source-catalogue-thumb[aria-pressed=true] { border:2px solid #52735a; }
.picture-source-catalogue-thumb img { display:block;width:100%;height:110px;object-fit:contain; }
.picture-source-catalogue-page { font-size:14px; }.picture-source-catalogue-error { color:#803d31; }
@media(max-width:699px) { .picture-source-catalogue { padding-top:16px;font-size:15px; }
 .picture-source-catalogue header { display:grid;grid-template-columns:1fr;gap:8px; }
 .picture-source-catalogue header button { justify-self:start; }
 .picture-source-catalogue-source-controls { display:grid;grid-template-columns:1fr 1fr; }
 .picture-source-catalogue-source-controls select { grid-row:1;grid-column:1/-1;width:100%;min-width:0; }
 .picture-source-catalogue-source-controls button { grid-row:2; }
 .picture-source-catalogue-main { grid-template-columns:1fr;gap:16px; }
 .picture-source-catalogue-main-image { max-height:30vh; }.picture-source-catalogue-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
 .picture-source-catalogue-language-switch { display:flex; }
 .picture-source-catalogue[data-language=en] .picture-source-catalogue-language[lang=de],
 .picture-source-catalogue[data-language=de] .picture-source-catalogue-language[lang=en] { display:none; }
 .picture-source-catalogue-language + .picture-source-catalogue-language { border:0;margin-top:0;padding-top:0; }
 .picture-source-catalogue figcaption { font-size:12px;line-height:1.35; } }
`

export interface SourceCatalogueOptions {
  document?: Document
  selectedId?: string
  pageSize?: number
  onClose?: () => void
  onSelect?: (identity: string) => void
}

export function createSourceCatalogue(manifest: ManifestIndex, options: SourceCatalogueOptions = {}) {
  const records = sourceCatalogueRecords(manifest)
  const pageSize = options.pageSize ?? 6
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 8) throw new Error('Invalid source catalogue page size')
  let selectedIndex = options.selectedId ? records.findIndex(record => record.identity === options.selectedId || record.source.plate.id === options.selectedId) : 0
  if (selectedIndex < 0) throw new Error(`Unknown catalogue source: ${options.selectedId}`)
  const document = options.document ?? globalThis.document
  const node = <K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] => {
    const element = document.createElement(tag); element.className = className; element.textContent = text; return element
  }
  const root = node('section', 'picture-source-catalogue')
  root.setAttribute('aria-label', 'Reproduction sources / Bildquellen')
  const style = node('style'); style.textContent = sourceCatalogueCSS
  const header = node('header'), title = node('h2', '', 'Reproduction sources / Bildquellen')
  const close = node('button', '', 'Work record / Werk'); close.type = 'button'; close.hidden = !options.onClose
  close.onclick = () => options.onClose?.(); header.append(title, close)
  const controls = node('nav', 'picture-source-catalogue-controls picture-source-catalogue-source-controls')
  controls.setAttribute('aria-label', 'Select a source / Bildquelle wählen')
  const previous = node('button', '', 'Previous / Zurück'), next = node('button', '', 'Next / Weiter'), selector = node('select')
  previous.type = next.type = 'button'; selector.setAttribute('aria-label', 'All reproduction sources / Alle Bildquellen')
  for (const [index, record] of records.entries()) {
    const option = node('option', '', `${index + 1}. ${record.title.en} · ${record.relationship.en}`)
    option.value = record.identity; selector.append(option)
  }
  controls.append(previous, selector, next)
  const main = node('div', 'picture-source-catalogue-main')
  const gallery = node('section', 'picture-source-catalogue-gallery'), galleryTitle = node('h3', '', 'Browse the sources / Bildquellen durchsehen')
  const grid = node('div', 'picture-source-catalogue-grid'), pages = node('nav', 'picture-source-catalogue-controls')
  pages.setAttribute('aria-label', 'Source pages / Seiten der Bildquellen')
  const earlier = node('button', '', 'Earlier / Vorherige'), later = node('button', '', 'Later / Nächste'), pageLabel = node('span', 'picture-source-catalogue-page')
  earlier.type = later.type = 'button'; pages.append(earlier, pageLabel, later); gallery.append(galleryTitle, grid, pages)
  root.append(style, header, controls, main, gallery)
  let live = true, page = Math.floor(selectedIndex / pageSize), full = false
  let language: 'en' | 'de' = 'en'
  root.dataset['language'] = language
  let resolutionButton: HTMLButtonElement | null = null
  const images = new Set<HTMLImageElement>(), pending = new Set<HTMLImageElement>(), failures = new Map<HTMLImageElement, string>()
  const mainImages = new Set<HTMLImageElement>(), thumbnails = new Set<HTMLImageElement>()
  function clearImages(group: Set<HTMLImageElement>) {
    for (const image of group) {
      image.onload = image.onerror = null; image.removeAttribute('src')
      pending.delete(image); failures.delete(image); images.delete(image)
    }
    group.clear()
  }
  function imageFor(record: CatalogueSource, original: boolean, group: Set<HTMLImageElement>, status?: HTMLElement) {
    const entry = original ? record.source.plate : record.source.preview
    const valid = validatePaintingRecord(entry)
    const image = node('img')
    image.alt = `${record.title.en} · ${record.relationship.en} / ${record.title.de} · ${record.relationship.de}`
    image.width = valid.pixels.width; image.height = valid.pixels.height
    image.decoding = 'async'; image.loading = 'eager'
    image.dataset['manifestId'] = entry.id; image.dataset['sourceSha256'] = entry.sha256!
    image.dataset['sourceWidth'] = String(valid.pixels.width); image.dataset['sourceHeight'] = String(valid.pixels.height)
    images.add(image); group.add(image); pending.add(image)
    image.onload = () => {
      if (!live || !images.has(image)) return
      pending.delete(image)
      if (image.naturalWidth !== valid.pixels.width || image.naturalHeight !== valid.pixels.height) {
        image.hidden = true
        const error = `Source image dimensions disagree: ${entry.id}`; failures.set(image, error)
        if (status) status.textContent = 'Image dimensions could not be verified / Bildmaße konnten nicht bestätigt werden'
      } else if (status) status.textContent = `${valid.pixels.width} × ${valid.pixels.height} px · ${original ? 'Full image / Vollständige Auflösung' : 'Preview / Vorschau'}`
    }
    image.onerror = () => {
      if (!live || !images.has(image)) return
      pending.delete(image); image.hidden = true; failures.set(image, `Source image unavailable: ${entry.id}`)
      if (status) status.textContent = 'Image unavailable / Bild nicht verfügbar'
    }
    // source_url cites a page. Only the validated store path supplies pixels.
    image.src = assetAddress(valid.entry)
    return image
  }
  function renderMain() {
    if (!live) return
    clearImages(mainImages); main.replaceChildren()
    const record = records[selectedIndex]
    previous.disabled = selectedIndex <= 0; next.disabled = selectedIndex >= records.length - 1
    if (!record) { main.append(node('p', '', 'No reproduction sources / Keine Bildquellen')); return }
    selector.value = record.identity
    const figure = node('figure'), status = node('p', 'picture-source-catalogue-state', 'Loading image / Bild wird geladen')
    status.setAttribute('role', 'status')
    const image = imageFor(record, full, mainImages, status); image.className = 'picture-source-catalogue-main-image'
    const caption = node('figcaption', '', 'Complete source image; its displayed size is not an object measurement. / Vollständige Bildvorlage; die Anzeigegröße ist kein Maß des Werks.')
    const resolution = node('button', 'picture-source-catalogue-resolution', full ? 'Use preview / Vorschau anzeigen' : 'Load full image / Volle Auflösung laden')
    resolution.type = 'button'; resolution.setAttribute('aria-pressed', String(full))
    resolutionButton = resolution
    resolution.onclick = () => { if (!live) return; full = !full; renderMain(); resolutionButton?.focus() }
    const open = node('a', 'picture-source-catalogue-original', 'Open original image / Originalbild öffnen')
    open.href = assetAddress(validatePaintingRecord(record.source.plate).entry); open.target = '_blank'; open.rel = 'noopener'
    figure.append(image, caption, status, resolution, open)
    const copy = node('div', 'picture-source-catalogue-copy')
    const languageControls = node('div', 'picture-source-catalogue-language-switch')
    languageControls.setAttribute('role', 'group'); languageControls.setAttribute('aria-label', 'Source language / Sprache der Bildquelle')
    const languageButtons = (['en', 'de'] as const).map(choice => {
      const button = node('button', '', choice === 'en' ? 'English' : 'Deutsch'); button.type = 'button'; button.lang = choice
      button.setAttribute('aria-pressed', String(language === choice))
      button.onclick = () => {
        if (!live) return
        language = choice; root.dataset['language'] = choice
        for (const control of languageButtons) control.setAttribute('aria-pressed', String(control.lang === choice))
        for (const [index, option] of [...selector.options].entries()) {
          const item = records[index]!
          option.textContent = `${index + 1}. ${item.title[choice]} · ${item.relationship[choice]}`
        }
      }
      languageControls.append(button); return button
    })
    copy.append(languageControls)
    for (const choice of ['en', 'de'] as const) {
      const column = node('section', 'picture-source-catalogue-language'); column.lang = choice
      column.append(node('h3', '', record.title[choice]), node('p', 'picture-source-catalogue-relationship', record.relationship[choice]))
      if (!record.inPictureRegister) column.append(node('p', '', choice === 'en'
        ? 'Additional source. No physical measurement is supplied in this picture register.'
        : 'Ergänzende Bildquelle. Dieses Bilderverzeichnis enthält keine Maße des Werks.'))
      const honesty = record.source.plate[choice === 'en' ? 'honesty_en' : 'honesty_de']
      if (honesty) column.append(node('p', 'picture-source-catalogue-honesty', honesty))
      copy.append(column)
    }
    if (record.source.policyTier) copy.append(node('p', 'picture-source-catalogue-tier', record.source.policyTier))
    copy.append(node('p', 'picture-source-catalogue-licence', record.source.plate.licence))
    const provenance = node('details', 'picture-source-catalogue-provenance')
    provenance.append(node('summary', '', 'Source record / Quellenbeleg'))
    for (const entry of [record.source.preview, record.source.plate]) {
      const valid = validatePaintingRecord(entry)
      provenance.append(node('p', '', `${entry.id}\n${valid.pixels.width} × ${valid.pixels.height} px\nSHA-256 ${entry.sha256}`))
    }
    const citation = citationURL(record.source.plate.source_url)
    if (citation) {
      const link = node('a', '', 'Source page / Quellenseite'); link.href = citation; link.target = '_blank'; link.rel = 'noopener'; provenance.append(link)
    }
    copy.append(provenance); main.append(figure, copy)
  }
  function renderGallery() {
    if (!live) return
    clearImages(thumbnails); grid.replaceChildren()
    const start = page * pageSize, end = Math.min(start + pageSize, records.length)
    for (let index = start; index < end; index++) {
      const record = records[index]!, button = node('button', 'picture-source-catalogue-thumb')
      button.type = 'button'; button.dataset['sourceIdentity'] = record.identity
      button.setAttribute('aria-pressed', String(index === selectedIndex))
      button.append(imageFor(record, false, thumbnails), node('span', '', `${record.title.en} / ${record.title.de}`), node('span', '', `${record.relationship.en} / ${record.relationship.de}`))
      button.onclick = () => { if (!live) return; select(record.identity); selector.focus() }; grid.append(button)
    }
    earlier.disabled = page === 0; later.disabled = end >= records.length
    pageLabel.textContent = `${records.length ? start + 1 : 0}–${end} / ${records.length}`
  }
  function select(identity: string): boolean {
    if (!live) return false
    const index = records.findIndex(record => record.identity === identity || record.source.plate.id === identity)
    if (index < 0) return false
    selectedIndex = index; page = Math.floor(index / pageSize); full = false
    renderMain(); renderGallery(); root.scrollTop = 0; options.onSelect?.(records[index]!.identity); return true
  }
  previous.onclick = () => { const record = records[selectedIndex - 1]; if (record) select(record.identity) }
  next.onclick = () => { const record = records[selectedIndex + 1]; if (record) select(record.identity) }
  selector.onchange = () => select(selector.value)
  earlier.onclick = () => { if (page > 0) { page--; renderGallery() } }
  later.onclick = () => { if ((page + 1) * pageSize < records.length) { page++; renderGallery() } }
  renderMain(); renderGallery()
  return { root, records, select, selected: () => records[selectedIndex]?.identity ?? null,
    measure: () => {
      // Browser image surfaces are separate from the Three texture account.
      // This is a decoded-pixel estimate, not a claim about compositor/cache
      // storage; duplicate displayed references to one source count once.
      const decoded = new Map<string, number>()
      for (const image of images) if (!pending.has(image) && !failures.has(image))
        decoded.set(image.dataset['manifestId']!, image.naturalWidth * image.naturalHeight * 4)
      const decodedRGBABytes = [...decoded.values()].reduce((sum, bytes) => sum + bytes, 0)
      return { kind: 'picture-source-catalogue', live, total: records.length, sourceIdentities: records.map(record => record.identity), selectedSource: records[selectedIndex]?.identity ?? null,
      page: page + 1, fullImage: full, phoneLanguage: language, images: [...images].map(image => ({ id: image.dataset['manifestId'],
        sourceSha256: image.dataset['sourceSha256'], width: image.width, height: image.height,
        naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight,
        loaded: !pending.has(image) && !failures.has(image), visible: !image.hidden })),
      imagesPending: pending.size, errors: [...failures.values()],
      decodedImageCount: decoded.size, decodedRGBABytes, decodedRGBAEstimateMiB: decodedRGBABytes / 1048576,
      decodedEstimateBasis: 'Unique loaded DOM source IDs × natural pixels × 4 bytes; excludes browser cache, compositor storage and all Three textures.' }
    },
    dispose() { if (!live) return; live = false; clearImages(mainImages); clearImages(thumbnails)
      previous.onclick = next.onclick = earlier.onclick = later.onclick = close.onclick = null; selector.onchange = null; resolutionButton = null; root.replaceChildren() },
  }
}
