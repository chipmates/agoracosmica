/** Museum-facing bilingual copy for the rights-policy overlay. The original
 * collection JSON stays untouched. Source licences and supplied honesty lines
 * are printed literally; historic register rights are identified as historic.
 */
import { pictureDisplayWindow } from './registration'
import { visitorHolder, visitorNote, visitorSource } from './visitor-copy'
import type { PictureWork, ResolvedPicturePlate } from './register'
import type { PolicyPaintingEntry, PolicyPicturePlate } from './policy'

export interface PictureBilingual { readonly en: string; readonly de: string }
export interface PicturePolicyLabelText {
  readonly firstLine: PictureBilingual
  readonly record: PictureBilingual
  readonly note: PictureBilingual
  readonly certainty: PictureBilingual
  readonly colour: string
  readonly available: boolean
  readonly sources: readonly {
    readonly id: string
    readonly tier: string | null
    readonly honesty: PictureBilingual | null
    readonly licence: string
    readonly url: string | null
    readonly hash: string | null
    readonly relationship: PolicyPicturePlate['relationship']
  }[]
}

export const PICTURE_CERTAINTY_KEY = Object.freeze([
  { colour: '#52735a', en: 'Documented', de: 'Belegt' },
  { colour: '#777e7b', en: 'Unknown or unavailable', de: 'Unbekannt oder nicht gezeigt' },
  { colour: '#b18b47', en: 'Qualified, uncertain or reconstructed', de: 'Mit Vorbehalt, ungewiss oder rekonstruiert' },
  { colour: '#b56152', en: 'Disputed or conjectural', de: 'Umstritten oder vermutet' },
])

/** The label's word for a documented work of more than one named hand. */
export const JOINT_WORK: PictureBilingual = Object.freeze({ en: 'Collaborative work', de: 'Gemeinschaftswerk' })

/** Attribution and reproduction permission are independent. A source licence
 * never changes the named work's attribution. Green on a copy documents the
 * stated category, not autograph Leonardo authorship.
 */
export function policyCertainty(work: PictureWork, available: boolean, entries: readonly ResolvedPicturePlate[] = []): { colour: string; word: PictureBilingual } {
  if (!available) return { colour: '#777e7b', word: { en: 'Not shown', de: 'Nicht gezeigt' } }
  if (work.id === 'mona-lisa' && entries.some(entry => /print|druk|imprim/i.test((entry.plate as PolicyPaintingEntry).honesty_en ?? ''))) return { colour: '#b18b47', word: { en: 'Historical print, date uncertain', de: 'Historischer Druck, Datum ungewiss' } }
  if (work.attribution_certainty === 'disputed') return { colour: '#b56152', word: { en: 'Disputed', de: 'Umstritten' } }
  if (work.attribution_certainty === 'qualified') return { colour: '#b18b47', word: { en: 'Qualified attribution', de: 'Zuschreibung mit Vorbehalt' } }
  if (work.attribution_certainty === 'workshop') return { colour: '#52735a', word: { en: 'Workshop', de: 'Werkstatt' } }
  if (work.attribution_certainty === 'copy') return { colour: '#52735a', word: { en: 'Later copy', de: 'Spätere Kopie' } }
  if (work.id === 'baptism-of-christ') return { colour: '#52735a', word: JOINT_WORK }
  return { colour: '#52735a', word: { en: 'Documented', de: 'Belegt' } }
}

const GENERIC_NOTE: PictureBilingual = {
  en: 'The reproduction preserves the proportions of the supplied image. Its edges have not been matched to the measured object.',
  de: 'Die Reproduktion bewahrt die Proportionen der Vorlage. Ihre Ränder wurden dem vermessenen Werk noch nicht zugeordnet.',
}

/** These short notes state the measurement caveat using the locked record.
 * A replaced source must not inherit a claim about a different photograph.
 */
function exhibitNote(work: PictureWork, entries: readonly ResolvedPicturePlate[]): PictureBilingual {
  if (!entries.length) return {
    en: work.clearance_sentence_en ?? 'No usable reproduction is available for this work.',
    de: work.clearance_sentence_de ?? 'Für dieses Werk liegt keine verwendbare Reproduktion vor.',
  }
  const current = entries.some(entry => (entry.plate as PolicyPaintingEntry).tier !== undefined)
  switch (work.id) {
    case 'annunciation': return {
      en: 'The exhibition uses 98 × 217 cm. The Uffizi records 90 × 222 cm. These measurements remain unresolved.',
      de: 'Die Ausstellung verwendet 98 × 217 cm. Die Uffizien nennen 90 × 222 cm. Diese Maßangaben bleiben ungeklärt.',
    }
    case 'virgin-and-child-with-st-anne': return {
      en: 'The original painted field is 113 cm wide. The enlarged support is 130 cm wide.',
      de: 'Das ursprüngliche Bildfeld ist 113 cm breit. Der erweiterte Bildträger ist 130 cm breit.',
    }
    case 'mona-lisa': return entries.some(entry => /print|druk|imprim/i.test((entry.plate as PolicyPaintingEntry).honesty_en ?? '')) ? {
      en: 'The painting measures 79.4 × 53.4 cm. This image is a historical printed reproduction.',
      de: 'Das Gemälde misst 79,4 × 53,4 cm. Dieses Bild ist eine historische Druckreproduktion.',
    } : {
      en: `The painting measures 79.4 × 53.4 cm. ${GENERIC_NOTE.en}`,
      de: `Das Gemälde misst 79,4 × 53,4 cm. ${GENERIC_NOTE.de}`,
    }
    case 'isabella-deste-cartoon': if (current) return {
      en: 'The selected reproduction shows the complete sheet. Its resolution is limited.',
      de: 'Die gewählte Reproduktion zeigt das vollständige Blatt. Ihre Auflösung ist begrenzt.',
    }; break
    case 'yarnwinder-lansdowne': if (current) return {
      en: 'The Met records 49.5 × 37.1 cm. The selected photograph was made at the Louvre exhibition of 2019–2020.',
      de: 'Das Metropolitan Museum nennt 49,5 × 37,1 cm. Die gewählte Aufnahme entstand in der Louvre-Ausstellung 2019–2020.',
    }; break
    case 'virgin-of-the-rocks-london': return {
      en: 'The photograph includes the frame. The panel itself measures 189.5 × 120 cm.',
      de: 'Der Rahmen ist mit abgebildet. Die Tafel selbst misst 189,5 × 120 cm.',
    }
    case 'anghiari-copy': return {
      en: 'Four added strips enlarged the sheet from 42.8 × 57.7 cm to 45.3 × 63.6 cm. This is a later copy of the lost composition.',
      de: 'Vier angesetzte Streifen vergrößerten das Blatt von 42,8 × 57,7 cm auf 45,3 × 63,6 cm. Es ist eine spätere Kopie der verlorenen Komposition.',
    }
    case 'sala-delle-asse': return {
      en: 'The dimensions of the painted surface are unknown. The approximate 15 × 15 m measurement describes the room floor. The reproduction shows one monochrome wall section.',
      de: 'Die Maße der bemalten Fläche sind unbekannt. Die ungefähren 15 × 15 m bezeichnen den Raumgrundriss. Die Reproduktion zeigt eine monochrome Wandpartie.',
    }
    case 'salvator-mundi': return {
      en: 'The attribution remains disputed. The restored painting, the historical Cook photograph and the 1844 print are distinct images.',
      de: 'Die Zuschreibung bleibt umstritten. Das restaurierte Gemälde, die historische Cook-Fotografie und der Druck von 1844 sind unterschiedliche Bilder.',
    }
    case 'leda-spiridon': return {
      en: 'A follower’s painting after the lost Leda. The recorded size is 130 × 77.5 cm. The selected photograph shows the unframed panel.',
      de: 'Das Gemälde eines Nachfolgers nach der verlorenen Leda. Die verzeichneten Maße sind 130 × 77,5 cm. Die gewählte Aufnahme zeigt die Tafel ohne Rahmen.',
    }
  }
  if (work.reproduction_note_en.startsWith('Keep the raster')) return GENERIC_NOTE
  return { en: work.reproduction_note_en, de: work.reproduction_note_de }
}

/** Pure text model, also used by the executable policy audit. */
export function policyLabelText(work: PictureWork, entries: readonly ResolvedPicturePlate[] = []): PicturePolicyLabelText {
  const available = entries.length > 0
  const certainty = policyCertainty(work, available, entries)
  const firstLine = {
    en: `${certainty.word.en}. ${work.title_en}.`,
    de: `${certainty.word.de}. ${work.title_de}.`,
  }
  const sizeEn = work.height_cm === null ? 'Dimensions not established' : `${work.height_cm} × ${work.width_cm} cm`
  const sizeDe = work.height_cm === null ? 'Maße nicht gesichert' : `${String(work.height_cm).replace('.', ',')} × ${String(work.width_cm).replace('.', ',')} cm`
  const record: PictureBilingual = {
    en: [work.date_label_en, work.medium, work.support, sizeEn].filter(Boolean).join(' · '),
    de: [work.date_label_de, work.medium_de, work.support_de, sizeDe].filter(Boolean).join(' · '),
  }
  return { firstLine, record, note: exhibitNote(work, entries), certainty: certainty.word,
    colour: certainty.colour, available, sources: entries.map(entry => {
      const e = entry.plate as PolicyPaintingEntry
      return { id: e.id, tier: e.tier ?? null,
        honesty: e.honesty_en && e.honesty_de ? { en: e.honesty_en, de: e.honesty_de } : null,
        licence: e.licence, url: e.source_url ?? null, hash: e.sha256 ?? null,
        relationship: (entry as Partial<PolicyPicturePlate>).relationship ?? (entry.face === 'reverse' ? 'reverse' : 'primary') }
    }) }
}

function node<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = ''): HTMLElementTagNameMap[K] {
  const result = document.createElement(tag)
  result.className = className
  result.textContent = text
  return result
}

/** A label made of two language columns. Grid/block presentation belongs to
 * the bench CSS. Hashes and historical rights only occur in expanded Sources.
 */
/** THE SECOND READING LEVEL.
 *
 * A phone gives a label one screen. A long German reading, which runs a third
 * longer than its English, then needs a scroll INSIDE the card, and a visitor
 * who does not scroll reads half a sentence and stops. So on the narrow stage
 * the card carries two levels: what a person reads standing at the picture,
 * and the rest of the same words on a tap. Nothing is rewritten and nothing
 * is dropped; the order of the words on the wall is the order here.
 */
const MORE_OF_THE_LABEL = { en: 'More of the label', de: 'Mehr von der Beschriftung' } as const
const LESS_OF_THE_LABEL = { en: 'Less of the label', de: 'Weniger von der Beschriftung' } as const
/** The first sentence of a museum reading, by its own full stop. */
export function firstSentence(text: string): { head: string; rest: string } {
  const at = /[.!?]["”»]?(\s|$)/.exec(text)
  if (!at || at.index + at[0].length >= text.length) return { head: text, rest: '' }
  const cut = at.index + at[0].length
  return { head: text.slice(0, cut).trimEnd(), rest: text.slice(cut).trimStart() }
}

/** The folded parts of a built label, so an owner that can measure a card
 * can decide whether folding was needed at all. */
export function readingLevels(label: HTMLElement): Array<{ control: HTMLElement; rest: HTMLElement }> {
  const found: Array<{ control: HTMLElement; rest: HTMLElement }> = []
  for (const column of [...label.children] as HTMLElement[]) {
    const children = [...column.children] as HTMLElement[]
    const control = children.find(c => c.className === 'picture-label-more')
    const rest = children.find(c => c.className === 'picture-label-rest')
    if (control && rest) found.push({ control, rest })
  }
  return found
}

/** Put the rest of a label's own words behind one control, in that column's
 * own language. Below two pieces there is nothing to fold, so nothing folds. */
export function appendLater(column: HTMLElement, language: 'en' | 'de',
  later: readonly HTMLElement[], twoLevels: boolean): void {
  if (!twoLevels || later.length < 2) {
    column.append(...later)
    return
  }
  const rest = node('div', 'picture-label-rest')
  rest.hidden = true
  rest.lang = language
  rest.append(...later)
  const more = node('button', 'picture-label-more', MORE_OF_THE_LABEL[language])
  more.type = 'button'
  more.lang = language
  more.setAttribute('aria-expanded', 'false')
  more.onclick = () => {
    rest.hidden = !rest.hidden
    more.textContent = rest.hidden ? MORE_OF_THE_LABEL[language] : LESS_OF_THE_LABEL[language]
    more.setAttribute('aria-expanded', String(!rest.hidden))
  }
  column.append(more, rest)
}

export function createPolicyWorkLabel(work: PictureWork, entries: readonly ResolvedPicturePlate[] = [], expanded = false,
  columnNotes: readonly PictureBilingual[] = [], twoLevels = false,
  evidence: readonly ResolvedPicturePlate[] = []): HTMLElement {
  const text = policyLabelText(work, entries)
  // The plates the hung one was chosen over keep their own lines in the
  // record, after the hung plate's, and never set the label's certainty.
  const kept = expanded ? policyLabelText(work, evidence).sources : []
  const label = node('article', 'picture-label picture-policy-label')
  label.dataset['workId'] = work.id
  label.style.setProperty('--certainty', text.colour)
  if (!expanded) {
    setRegister(label, 'drawer')
    for (const language of ['en', 'de'] as const) {
      const column = node('section', `picture-label-language picture-label-${language}`)
      column.lang = language
      const first = node('p', language === 'en' ? 'picture-first' : 'picture-first-de', text.firstLine[language])
      setRegister(first, 'label')
      const dot = node('span', 'picture-certainty')
      dot.setAttribute('aria-hidden', 'true')
      first.prepend(dot)
      const reading = visitorNote(work, entries)[language]
      const split = twoLevels ? firstSentence(reading) : { head: reading, rest: '' }
      const paragraph = node('p', language === 'en' ? 'picture-reason' : 'picture-reason-de', split.head)
      // The order of the words on the wall is the order here: what folds is
      // the tail of the reading and everything that already stood after it.
      const later: HTMLElement[] = []
      if (split.rest) later.push(node('p', language === 'en' ? 'picture-reason' : 'picture-reason-de', split.rest))
      later.push(node('p', 'picture-holder', visitorHolder(work)[language]),
        node('p', 'picture-source-reading', visitorSource(entries)[language]))
      // A remark belongs in the language it is written in, never as one
      // bilingual line inside the other column.
      for (const remark of columnNotes) {
        const line = node('p', 'picture-column-note', remark[language])
        line.lang = language
        later.push(line)
      }
      column.append(first, paragraph)
      appendLater(column, language, later, twoLevels)
      label.append(column)
    }
    return label
  }
  setRegister(label, 'record')
  const columns = { en: node('section', 'picture-label-language picture-label-en'),
    de: node('section', 'picture-label-language picture-label-de') }
  for (const language of ['en', 'de'] as const) {
    const column = columns[language]
    column.lang = language
    const first = node('p', language === 'en' ? 'picture-first' : 'picture-first-de', text.firstLine[language])
    first.lang = language
    const dot = node('span', 'picture-certainty')
    dot.setAttribute('aria-hidden', 'true')
    first.prepend(dot)
    column.append(first, node('p', 'picture-attribution-state', text.certainty[language]),
      node('p', 'picture-record', text.record[language]),
      node('p', 'picture-holder', `${work.holder}${work.inventory ? ` · ${work.inventory}` : ''}`),
      node('p', language === 'en' ? 'picture-reason' : 'picture-reason-de', text.note[language]))
    for (const source of [...text.sources, ...kept]) {
      if (source.honesty) {
        const honesty = node('p', 'picture-honesty', source.honesty[language])
        honesty.dataset['manifestId'] = source.id
        if (source.tier) honesty.dataset['rightsTier'] = source.tier
        if (kept.includes(source)) honesty.dataset['evidence'] = 'true'
        column.append(honesty)
      }
    }
    if (entries.some(entry => pictureDisplayWindow(entry.plate)?.approvedForDisplayCrop)) {
      column.append(node('p', 'picture-source-scope', language === 'en'
        ? 'Photographic surrounds are omitted. The complete source is available in Sources.'
        : 'Die fotografische Umgebung ist ausgespart. Die vollständige Vorlage steht unter Sources.'))
    }
    label.append(column)
  }
  // One source licence line per displayed plate, spanning the two columns.
  const sourceLines = node('div', 'picture-label-licences')
  for (const source of [...text.sources, ...kept]) {
    const licence = node('p', 'picture-licence', source.licence)
    licence.dataset['manifestId'] = source.id
    sourceLines.append(licence)
  }
  label.append(sourceLines)
  if (expanded) {
    const evidence = node('section', 'picture-label-evidence')
    for (const fact of work.facts) {
      const en = node('p', 'picture-fact', fact.text_en); en.lang = 'en'
      const de = node('p', 'picture-fact', fact.text_de); de.lang = 'de'
      evidence.append(en, de)
    }
    for (const source of [...text.sources, ...kept]) {
      if (source.url) {
        const link = node('a', 'picture-source-link', source.url)
        link.href = source.url; link.target = '_blank'; link.rel = 'noopener'
        evidence.append(link)
      }
      if (source.hash) evidence.append(node('p', 'picture-source-hash', `${source.id}\nSHA-256 ${source.hash}`))
    }
    if (work.de_beatis) {
      evidence.append(node('p', 'picture-witness', work.de_beatis.quote_it),
        node('p', 'picture-fact', work.de_beatis.note_en), node('p', 'picture-fact', work.de_beatis.note_de))
    }
    const historic = node('details', 'picture-historical-register')
    historic.append(node('summary', '', 'Original register · before the 9 September 2026 source policy / Ursprüngliches Verzeichnis · vor der Quellenregelung vom 9. September 2026'))
    historic.append(node('p', 'picture-register-first-en', work.label_first_line_en),
      node('p', 'picture-register-first-de', work.label_first_line_de))
    // The historical class remains auditable, but is never restated as the
    // licence or permission of the reproduction the visitor is viewing.
    historic.append(node('p', 'picture-register-rights', `${work.rights_class} · ${work.rights_basis.decision}`))
    evidence.append(historic)
    label.append(evidence)
  }
  return label
}

/** THE LABEL AS A CLOSE LOOK CARRIES IT. The wall writes both language
 * columns; a window keeps the one the visitor reads. Its first line keeps
 * the certainty word with its mark and drops the work's name, which the
 * window's own heading says above it. Where the window's catalogue entry
 * already names the class, the first line goes: a class is said once. */
export function createWindowWorkLabel(work: PictureWork, entries: readonly ResolvedPicturePlate[],
  language: 'en' | 'de', twoLevels: boolean, classAbove = false): HTMLElement {
  const label = createPolicyWorkLabel(work, entries, false, [], twoLevels)
  for (const column of [...label.querySelectorAll<HTMLElement>('.picture-label-language')]) {
    if (column.lang !== language) column.remove()
  }
  const word = policyLabelText(work, entries).certainty[language]
  for (const first of [...label.querySelectorAll<HTMLElement>('.picture-first,.picture-first-de')]) {
    if (classAbove) { first.remove(); continue }
    for (const node of [...first.childNodes]) if (node.nodeType === Node.TEXT_NODE) node.remove()
    first.append(document.createTextNode(word))
  }
  return label
}

export function createPictureCertaintyKey(compact = false): HTMLElement {
  const key = node('div', 'picture-certainty-key')
  key.setAttribute('aria-label', 'Attribution and reconstruction key / Legende zu Zuschreibung und Rekonstruktion')
  for (const [index, entry] of PICTURE_CERTAINTY_KEY.entries()) {
    const item = node('span', 'picture-certainty-key-item', `${entry.en} · ${entry.de}`)
    if (compact) {
      const en = node('span', 'picture-key-en', ['Documented', 'Unknown', 'Qualified', 'Disputed'][index]!)
      const de = node('span', 'picture-key-de', ['Belegt', 'Unbekannt', 'Vorbehalt', 'Umstritten'][index]!)
      en.lang = 'en'; de.lang = 'de'
      item.replaceChildren(en, de)
      item.title = `${entry.en} · ${entry.de}`
    }
    item.style.setProperty('--certainty', entry.colour)
    const dot = node('span', 'picture-certainty'); dot.setAttribute('aria-hidden', 'true')
    item.prepend(dot); key.append(item)
  }
  // Documented is a statement about the record, not about the hand. An open
  // mark separates a documented workshop picture or copy from an autograph
  // one, without changing a certainty colour, which is a fact.
  const hand = node('span', 'picture-certainty-key-item picture-key-hand',
    compact ? '' : 'Workshop or copy · Werkstatt oder Kopie')
  if (compact) {
    const en = node('span', 'picture-key-en', 'Workshop'); en.lang = 'en'
    const de = node('span', 'picture-key-de', 'Werkstatt'); de.lang = 'de'
    hand.replaceChildren(en, de)
    hand.title = 'Workshop or copy · Werkstatt oder Kopie'
  }
  hand.style.setProperty('--certainty', PICTURE_CERTAINTY_KEY[0]!.colour)
  const openMark = node('span', 'picture-certainty'); openMark.setAttribute('aria-hidden', 'true')
  hand.prepend(openMark); key.append(hand)
  return key
}

/** The shared frame in this checkout predates setRegister. Keep the same DOM
 * contract locally until the coordinator supplies that export. */
export function setRegister(el: HTMLElement, register: 'label' | 'drawer' | 'record'): void {
  el.dataset['register'] = register
}

/** A complete source record, deliberately opened after the plain drawer. */
export function createPictureRecord(work: PictureWork, entries: readonly ResolvedPicturePlate[],
  evidence: readonly ResolvedPicturePlate[] = []): HTMLElement {
  const root = node('section', 'picture-full-record')
  root.id = `picture-record-${work.id}`
  setRegister(root, 'record')
  root.hidden = true
  root.append(createPolicyWorkLabel(work, entries, true, [], false, evidence))
  const machine = node('details', 'picture-machine-chain')
  machine.append(node('summary', '', 'Complete data / Vollständige Daten'))
  const chain = (entry: ResolvedPicturePlate) => ({ plate: entry.plate, preview: entry.preview, displayWindow: pictureDisplayWindow(entry.plate) })
  machine.append(node('pre', 'picture-source-hash', JSON.stringify({
    collection: work,
    sources: entries.map(chain),
    ...(evidence.length ? { evidence: evidence.map(chain) } : {}),
  }, null, 2)))
  root.append(machine)
  return root
}
