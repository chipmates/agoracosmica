/* THE READING TABLE'S BEST-OF, joined from its research files into the data
 * the room reads.
 *
 * The set is a curator's list of pages by topic; the words on a page come
 * from printed editions and from translations of them, each file written by
 * its own seat; the museum's own words (captions, topic lines, the notices
 * that label every translation) come from a third. This step joins them and
 * writes no word of its own: a word the files do not carry is left out and
 * reported, never supplied here.
 *
 *   node forge/best-of.mjs                   join and write the data modules
 *   node forge/best-of.mjs --check           join and compare, write nothing
 *   node forge/best-of.mjs --stage <dir>     also copy the set's new scans and
 *                                            cut their thumbnails into <dir>,
 *                                            with the store patch beside them
 *   --deep <dir>                             the holders' larger views, by store
 *                                            path: staged in place of the pool's
 *                                            and cut into their pyramids
 *   --patch <file>                           where the store patch is written
 *   --from <dir>                             the research folder (default: found
 *                                            by walking up, or NA_BEST_OF)
 *   --draft                                  write even where a label is missing or
 *                                            a lead line is refused: the refused
 *                                            lead stands down, the gap is listed
 *
 * What the words pass writes, and this step reads:
 *   words/leads.jsonl  one page per line: {"id", "passage": <index> | null,
 *                      "en", "de", "it" (the lead, word for word, "…" at a cut),
 *                      "name_en", "name_de" (the short page name, at most four
 *                      words), "order" (the page's place in its topic, from 1)}
 *   words/keys.json    {"<key>": {"en", "de"}} for the room's new controls and
 *                      notes; KEYS below names every one (some under the words
 *                      pass's own names, KEY_NAMES), and a key not written yet
 *                      falls back to the room's existing words or stands down
 *   words/notices.json printed_transcription.editions (each volume's label and
 *                      short name) and .by_page (each page's own), which label
 *                      every transcription and every AI translation
 *   words/phone-lines.jsonl  one page per line: {"id", "en", "de", "from":
 *                      "lead" | "caption"}, the phone's own line at rest (at
 *                      most PHONE_MOST characters, two rows at 390 px): a cut
 *                      of the page's lead (or of the lead's passage, warned),
 *                      "…" at every cut, or its caption
 *                      with words left out and none added.
 *                      Until the file exists the module carries no phone line
 * and from the texts files: a German page's doubts only from `doubts_de`.
 * Re-run order when the scans are staged anew: --stage, then the plate
 * finder's stage (it appends the plates to the same patch), then a plain run.
 *
 * A staged scan's own rights statement (the notice a holder's file carries in
 * its metadata) is read from the file into its records as `rights_notice`,
 * word for word, and its thumbnail keeps the statement (forge/best-of-rights.mjs).
 */
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { STORE } from './vite-na-assets.mjs'
import { CARRIED, carryRights, embeddedRights, profileName } from './best-of-rights.mjs'
import { CODEX_ROLE, expectedTileFiles, filesUnder, jpegSize, scaleFactorsFor, tileRecipe, treeHash } from './tiles-check.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const APP = resolve(HERE, '..')
const DATA = join(APP, 'src', 'wings', 'vinci', 'table', 'data')
const OUT = join(DATA, 'best-of.json')
const TEXTS = join(DATA, 'best-of')
const WING = 'wing-vinci'
/** the long edge of a new scan's strip and shelf thumbnail, in pixels */
const THUMB_EDGE = 400
/** a page whose words run longer than this shows its lead passage and folds the rest */
const LONG_WORDS = 160

const argv = process.argv.slice(2)
const flag = name => argv.includes(name)
const option = name => { const at = argv.indexOf(name); return at >= 0 ? argv[at + 1] : undefined }

function findResearch(from) {
  let dir = from
  for (let up = 0; up < 12; up++) {
    const inside = join(dir, 'internal', 'night-agora', 'program', 'research', 'best-of-0928')
    if (existsSync(inside)) return inside
    const parent = resolve(dir, '..')
    if (parent === dir) break
    dir = parent
  }
  throw new Error('no research folder found: pass --from <dir> or set NA_BEST_OF')
}
const FROM = option('--from') ?? process.env.NA_BEST_OF ?? findResearch(APP)

const warnings = []
const warn = text => warnings.push(text)
const sha = bytes => createHash('sha256').update(bytes).digest('hex')

/* ---- reading the files ------------------------------------------------ */

/** RFC 4180: quoted fields, doubled quotes, newlines inside quotes. */
export function parseCsv(text) {
  const rows = []
  let row = [], field = '', quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field); rows.push(row); row = []; field = ''
    } else field += c
  }
  if (field || row.length) { row.push(field); rows.push(row) }
  const [head, ...body] = rows.filter(r => r.length > 1 || r[0])
  return body.map(r => Object.fromEntries(head.map((key, i) => [key, r[i] ?? ''])))
}

const inputs = {}
function read(rel, optional = false) {
  const file = join(FROM, rel)
  if (!existsSync(file)) {
    if (!optional) throw new Error(`missing input ${rel}`)
    warn(`not arrived yet: ${rel}`)
    return null
  }
  const bytes = readFileSync(file)
  inputs[rel] = sha(bytes)
  return bytes.toString('utf8')
}
function jsonl(rel, optional = true) {
  const text = read(rel, optional)
  if (text === null) return []
  const out = []
  text.split('\n').forEach((line, at) => {
    if (!line.trim()) return
    try { out.push(JSON.parse(line)) } catch { warn(`${rel}:${at + 1} is not JSON; skipped`) }
  })
  return out
}
const json = (rel, optional = true) => { const text = read(rel, optional); return text === null ? null : JSON.parse(text) }

const SET = parseCsv(read('curator-250/SET.csv'))
const TOPICS = parseCsv(read('curator-250/TOPICS.csv'))
const CAPTIONS = new Map(jsonl('words/captions.jsonl').map(r => [r.id, r]))
const TOPIC_WORDS = json('words/topics.json') ?? {}
const NOTICES = json('words/notices.json') ?? {}
const LEADS = new Map(jsonl('words/leads.jsonl').map(r => [r.id, r]))
const KEYS_WRITTEN = json('words/keys.json') ?? {}
/** the phone's own lines: read only once written, so the module stays as it was until then */
const PHONE_FILE = 'words/phone-lines.jsonl'
const PHONE = existsSync(join(FROM, PHONE_FILE)) ? new Map(jsonl(PHONE_FILE).map(r => [r.id, r])) : null
/** EVERY NEW WORD THE ROOM NEEDS, by the key the words pass writes it under,
 * with what stands until it does. The room reads `keys` from the module. */
export const KEYS = {
  next_topic: 'the gold control\'s kicker before the next topic\'s title ("Next topic"); until written, the next book\'s word',
  previous_topic: 'the name of the circle back to the previous topic ("Previous topic"); until written, the reader\'s "previous"',
  full_text: 'the key that opens every passage of the page ("The full text"); until written, the reader\'s "Transcription"',
  full_record: 'the key that opens the record ("The full record"); until written, "Where it comes from"',
  ai_short: 'the source row under an AI translation ("AI translation of the printed text. It may contain errors."); until written, the whole ai_translation sentence of notices.json',
  italian: 'the control that swaps in the printed Italian ("Italiano"); until written, the reader\'s "Italian transcription"',
  the_page: 'the first way where the page is a copy in another hand ("The page"); until written, the page has no way word and no mirror',
  mirror_ordinary: 'the mirror\'s note on a page written left to right; until written, the mirror\'s own note',
  mirror_plate: 'the mirror\'s note where it shows the printed plate of 1881 to 1891 of the same page; until written, the mirror\'s own note and the plate\'s own credit',
  kind_leaf: 'Read more: the picture is a photograph of the leaf; until written, nothing',
  kind_plate: 'Read more: the picture is a printed plate of a facsimile; until written, nothing',
  kind_facsimile: 'Read more: the picture is a photograph of a printed facsimile; until written, nothing',
  topic_pages: 'a topic cell\'s page count ("{n} pages"); until written, no count',
  topic_page: 'the same count for a topic of one page ("{n} page"); until written, topic_pages stands',
  topic_count: 'the count in the name row ("{topic}, {n} of {total}"); until written, the topic and the picture room\'s place pattern',
  absence_paris_rest: 'the new reason for Paris manuscripts C and E to M, now that the Institut\'s own views are admitted; until written, the absence is not shown',
  absence_ashburnham: 'the new reason for the Ashburnham leaves, likewise; until written, not shown',
  absence_arundel_middle: 'the new reason for Codex Arundel ff. 117 to 220, now that the British Library\'s views are admitted; until written, not shown',
  credit_rest_ai: 'the phone\'s one-row source row at rest under an AI translation; until written, the drafted label',
  credit_rest_richter: 'the phone\'s one-row source row at rest under Richter\'s translation; until written, the drafted label',
  picture_leaf: 'the picture credit of a photograph of the leaf ("{holder}, photograph"); until written, the drafted label',
  picture_facsimile: 'the picture credit of a printed facsimile ("{holder}, facsimile of {year}"); until written, the drafted label',
  way_hand: 'the first way\'s key, sized to its key on a 360 phone; until written, the drafted label',
}
/** LABELS THE LAYOUT DRAFTED after the band's blind read (2026-09-29): each
 * stands until the words pass writes its own under the same key. */
const DRAFTED = {
  credit_rest_ai: { en: 'AI translation. It may contain errors.', de: 'KI-Übersetzung. Sie kann Fehler enthalten.' },
  credit_rest_richter: { en: 'Translation: J. P. Richter, 1883', de: 'Übersetzung: J. P. Richter, 1883' },
  picture_leaf: { en: '{holder}, photograph', de: '{holder}, Fotografie' },
  picture_facsimile: { en: '{holder}, facsimile of {year}', de: '{holder}, Faksimile von {year}' },
  way_hand: { en: 'His hand', de: 'Handschrift' },
}
/** The names the words pass wrote some keys under. */
const KEY_NAMES = { full_text: 'the_full_text', full_record: 'the_full_record', ai_short: 'ai_label_short', mirror_ordinary: 'mirror_note_ltr' }
/** Two labels of printed transcriptions the notices lack, written as keys. */
const LABEL_KEYS = { richter: 'label_richter_italian', sabachnikoff: 'label_flight_1893' }
const drafted = new Set()
const keysOut = Object.fromEntries(Object.keys(KEYS).map(key => {
  const said = KEYS_WRITTEN[key] ?? KEYS_WRITTEN[KEY_NAMES[key]]
  if (!(said?.en && said?.de) && DRAFTED[key]) { drafted.add(key); return [key, DRAFTED[key]] }
  return [key, said?.en && said?.de ? { en: said.en, de: said.de } : null]
}))
/** The source row at rest on the phone: one row, the whole label on the raised card. */
function restCredit(kind, edition, lang, label) {
  if (kind === 'ours') return keysOut.credit_rest_ai?.[lang] ?? label
  if (edition === 'richter') return keysOut.credit_rest_richter?.[lang] ?? label
  return label
}
const READ_KEYS = new Set([...Object.keys(KEYS), ...Object.values(KEY_NAMES), ...Object.values(LABEL_KEYS), 'codex_short'])
for (const key of Object.keys(KEYS_WRITTEN)) if (!READ_KEYS.has(key)) warn(`words/keys.json carries ${key}, which the room does not read`)
/** Pages whose caption names writing although no edition prints a word of
 * them: they read as "nothing printed" and keep their mirror, never as
 * wordless (the blind judge of the words, 2026-09-29). */
const WRITTEN_UNPRINTED = new Set(['FB15v', 'ATL.0359.1', 'ATL.0236.1', 'M2.312', 'M2.280', 'CA.41'])
const TEXT_FILES = existsSync(join(FROM, 'texts-final'))
  ? readdirSync(join(FROM, 'texts-final')).filter(name => name.endsWith('.jsonl')).sort() : []
const RECORDS = new Map()
for (const name of TEXT_FILES) for (const record of jsonl(`texts-final/${name}`)) {
  // a later line for the same page is that seat's correction of it
  if (RECORDS.has(record.id) && RECORDS.get(record.id).file !== name) warn(`${record.id} is written by both ${RECORDS.get(record.id).file} and ${name}; ${name} kept`)
  RECORDS.set(record.id, { ...record, file: name })
}
/* How much writing a scan carries, from the visual passes: the mirror is a way
   of reading writing, so a page with none has no mirror. */
const DENSITY = new Map()
for (const r of parseCsv(read('curator-250/work/CANDIDATES.csv'))) {
  const key = r.file.startsWith('img/') ? `pool2/${r.file}` : r.file
  if (!DENSITY.has(key)) DENSITY.set(key, Number(r.text_density) || 0)
}
const POOL = new Map(parseCsv(read('pool2/INDEX.csv')).map(r => [`pool2/${r.local_file}`, r]))

/* ---- the store's side ------------------------------------------------- */

const MANIFEST = JSON.parse(readFileSync(join(STORE, WING, 'manifest.json'), 'utf8'))
const BY_PATH = new Map(MANIFEST.map(entry => [entry.path, entry]))

/** WHERE A NEW SCAN STANDS IN THE STORE, by rule, so the patch and the data
 * name the same file: `codices/<source>-<volume>/p<canvas>.jpg`, the store's
 * own shape for a codex side, numbered by the holder's canvas. */
export function storePathOf(file) {
  if (!file.startsWith('pool2/')) return file
  const [, , source, volume] = file.split('/')
  const canvas = Number(POOL.get(file)?.canvas)
  if (!source || !volume || !Number.isInteger(canvas)) throw new Error(`no store rule for ${file}`)
  const folder = source === 'thek' ? 'thek-atlanticus' : `${source}-${volume}`
  return `codices/${folder.toLowerCase()}/p${String(canvas).padStart(4, '0')}.jpg`
}
export const thumbPathOf = path => path.replace(/\/([^/]+)$/, '/thumbs/$1')
const idOf = (role, path) => `vinci/${role}/${path.replace(/^codices\//, '').replace(/\/thumbs\//, '/').replace(/\/([^/]+)\.jpg$/, '__$1').replace(/\//g, '-')}`

/* ---- words ------------------------------------------------------------ */

const slug = topic => topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** The printed edition a text names, by its citation or its basis. */
function editionOf(text) {
  const said = String(text ?? '')
  if (/Herzfeld/i.test(said)) return 'herzfeld'
  // the 1893 Flight of Birds names Ravaisson-Mollien as its French translator
  if (/Sabachnikoff|Piumati/i.test(said)) return 'sabachnikoff'
  if (/Ravaisson/i.test(said)) return 'ravaisson'
  if (/Beltrami|Trivulz/i.test(said)) return 'beltrami'
  if (/Arundel|Reale Commissione|Commissione Vinciana/i.test(said)) return 'arundel'
  if (/Sabachnikoff|Piumati/i.test(said)) return 'sabachnikoff'
  if (/Richter/i.test(said)) return 'richter'
  return null
}
/** The name an edition goes by, as the notices print it after their label. */
function editionName(edition, lang) {
  const printed = NOTICES.printed_transcription?.[edition]?.[lang] ?? NOTICES.printed_translation?.[edition]?.[lang]
    ?? KEYS_WRITTEN[LABEL_KEYS[edition]]?.[lang]
  return printed ? printed.replace(/^[^:]+:\s*/, '') : null
}
const missing = new Set()
function notice(path, lang) {
  let at = NOTICES
  for (const key of path) at = at?.[key]
  const said = at?.[lang]
  if (typeof said !== 'string' || !said.trim()) { missing.add(`notices.json ${path.join('.')}.${lang}`); return null }
  return said
}
/** The label under a translation: the printed translator, or the AI notice
 * naming the printed text it rests on. */
/* The notices name each printed transcription by its volume and year
 * (`printed_transcription.editions`), and each page's own (`by_page`). */
const EDITIONS = NOTICES.printed_transcription?.editions ?? null
const BY_PAGE = NOTICES.printed_transcription?.by_page ?? {}
/** The page's transcription for an edition family (ravaisson, richter, ...). */
function editionKey(page, family) {
  const keys = BY_PAGE[page]?.transcription ?? []
  return keys.find(key => family && key.startsWith(`${family}-`)) ?? (keys.length === 1 ? keys[0] : null)
}
function editionWords(page, family, lang, form) {
  const key = editionKey(page, family)
  const said = key ? EDITIONS?.[key]?.[`${form}_${lang}`] : null
  if (!said) missing.add(`printed_transcription.editions ${key ?? `(no ${family ?? 'edition'} for ${page})`}.${form}_${lang}`)
  return said ?? null
}
function translationLabel(kind, edition, lang, record, page) {
  if (kind === 'printed') return edition ? notice(['printed_translation', edition], lang) : null
  if (EDITIONS) {
    const template = notice(['ai_translation'], lang)
    const short = editionWords(page, edition, lang, 'short')
    return template && short ? template.replace('{edition}', short) : record?.label ?? null
  }
  const name = edition ? editionName(edition, lang) : null
  const template = notice(['ai_translation'], lang)
  if (template && name) return template.replace('{edition}', name)
  // the seat's own mark stands until the notices name this edition
  missing.add(`ai_translation name for ${edition ?? 'an unnamed edition'} (${lang})`)
  return record?.label ?? record?.mark ?? null
}
/** The label over the Italian: the transcription it was printed in. Richter
 * prints the Italian beside his English, so his name stands under the
 * transcription's own word. */
function italianLabel(edition, lang, page) {
  if (EDITIONS) return editionWords(page, edition, lang, 'label')
  const own = edition ? NOTICES.printed_transcription?.[edition]?.[lang] ?? KEYS_WRITTEN[LABEL_KEYS[edition]]?.[lang] : null
  if (own) return own
  const word = NOTICES.printed_transcription?.ravaisson?.[lang]?.replace(/:.*$/, '')
  const name = edition ? editionName(edition, lang) : null
  if (word && name) { missing.add(`printed_transcription.${edition}.${lang} (composed from the word and the name)`); return `${word}: ${name}` }
  missing.add(`printed_transcription.${edition ?? 'unknown'}.${lang}`)
  return null
}

/** The seats write a word Leonardo struck out as `~~word~~` or `<i>word</i>`;
 * the room reads one form. */
const struck = text => String(text ?? '').replace(/<i>([\s\S]*?)<\/i>/g, '~~$1~~')
const plain = text => struck(text).replace(/~~/g, '')
const wordsIn = text => (plain(text).match(/[\p{L}\p{N}]+/gu) ?? []).length

/** ONLY LETTERS OR LABELS: a passage whose words are figure letters and
 * numbers, such as "M f a b c d", never stands on its own. */
export function labelOnly(text) {
  const words = plain(text).replace(/\[[^\]]*\]/g, ' ').match(/[\p{L}]+/gu) ?? []
  return words.filter(word => word.length >= 3).length < 2
}

/** The first sentence of a passage, verbatim; a long one is cut at a word
 * and marked with an ellipsis. */
export function firstSentence(text) {
  const flat = plain(text).replace(/^\s*[—–-]\s*/, '').replace(/\s+/g, ' ').trim()
  if (!flat) return ''
  const end = /[.!?](?=\s+[\p{Lu}"“‘(]|\s*$)/u.exec(flat)
  let sentence = end ? flat.slice(0, end.index + 1) : flat
  if (sentence.length > 220) {
    const cut = sentence.slice(0, 200)
    sentence = `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 120)).replace(/[,;:\s]+$/, '')} …`
  }
  return sentence
}

/* ---- the join --------------------------------------------------------- */

const order = TOPICS.map(t => t.topic)
for (const topic of new Set(SET.map(r => r.topic))) if (!order.includes(topic)) { order.push(topic); warn(`topic ${topic} is not in TOPICS.csv`) }

function passagesOf(record) {
  const page = record?.id
  return (record?.passages ?? []).map((p, index) => {
    const out = { index, ref: p.ref ?? null }
    // a passage whose every language is missing is a note that nothing was printed
    const printed = ['it', 'en', 'de'].some(key => p[key]?.text && p[key]?.kind !== 'missing')
    if (p.kind === 'missing' || !printed) return { ...out, missing: true, note: p.note ?? p.it?.note ?? null }
    if (p.placement) out.placement = p.placement
    const it = p.it?.text ? struck(p.it.text) : null
    const itEdition = editionOf(p.it?.edition)
    out.it = it ? { text: it, label: { en: italianLabel(itEdition, 'en', page), de: italianLabel(itEdition, 'de', page) } } : null
    for (const lang of ['en', 'de']) {
      const t = p[lang]
      if (!t?.text || t.kind === 'missing') { out[lang] = null; continue }
      const kind = t.kind === 'printed' ? 'printed' : 'ours'
      const edition = kind === 'printed' ? editionOf(t.edition) : editionOf(t.basis) ?? itEdition
      const label = translationLabel(kind, edition, lang, t, page)
      out[lang] = { text: struck(t.text), kind, label, rest: restCredit(kind, edition, lang, label) }
      // what the translator could not settle goes on the record; `doubts` is
      // English on every block, so a German page shows only `doubts_de`,
      // and nothing where that is not written, never the English
      const doubts = (lang === 'de' ? t.doubts_de : t.doubts) ?? []
      if (doubts.length) out[lang].doubts = doubts
    }
    out.fr = p.fr?.text ? { text: struck(p.fr.text) } : null
    out.label_only = labelOnly(p.en?.text ?? p.it?.text ?? p.de?.text ?? '')
    out.sources = ['it', 'en', 'de', 'fr'].map(key => p[key]).filter(t => t?.edition || t?.url)
      .map(t => ({ edition: t.edition ?? null, page: t.page ?? null, url: t.url ?? null }))
    return out
  })
}

/** A LEAD IS A CUT OF ONE PASSAGE, word for word: its pieces between its
 * ellipses stand in the passage in order, as printed or translated (spaces,
 * struck words and the kind of quotation mark aside). */
const quotes = text => text.replace(/[’‘]/g, "'").replace(/[“”„«»]/g, '"')
const flatten = text => quotes(plain(text)).replace(/^\s*[—–-]\s*/, '').replace(/\s+/g, ' ').trim()
/** A CUT OF A TEXT, word for word: the line's pieces between its ellipses
 * stand in the text in order, each at word edges and none across a cut the
 * text itself marks; a cut inside a sentence says so with an ellipsis. A
 * diplomatic transcription runs words together, so its cuts keep no edges. */
export function cutOf(line, text, { edges = true } = {}) {
  const CUT = '\u0000'
  const whole = flatten(text).replace(/\s*(…|\.\.\.)\s*/g, CUT)
  const pieces = flatten(line).split(/…|\.\.\./).map(piece => piece.replace(/^[\s,;:]+|[\s,;:]+$/g, '')).filter(Boolean)
  if (!pieces.length) return { ok: false, why: 'no words' }
  const word = /[\p{L}\p{N}]/u
  const edged = (piece, at) => !edges || (!word.test(piece[0]) || !word.test(whole[at - 1] ?? '')) && (!word.test(piece[piece.length - 1]) || !word.test(whole[at + piece.length] ?? ''))
  let from = 0, first = -1, end = 0
  for (const piece of pieces) {
    let at = whole.indexOf(piece, from)
    while (at >= 0 && !edged(piece, at)) at = whole.indexOf(piece, at + 1)
    if (at < 0) return { ok: false, why: `"${piece.slice(0, 40)}" is not word for word in it${pieces.length > 1 ? ' (in order)' : ''}` }
    if (first < 0) first = at
    from = end = at + piece.length
  }
  const marked = flatten(line)
  const opened = first === 0 || /[.!?:;]["')\]]?\s*$/.test(whole.slice(0, first))
  const closed = end === whole.length || /[.!?]["')\]]?$/.test(pieces[pieces.length - 1])
  const unmarked = [!opened && !/^(…|\.\.\.)/.test(marked) ? 'its start' : null, !closed && !/(…|\.\.\.)$/.test(marked) ? 'its end' : null].filter(Boolean)
  return { ok: true, unmarked }
}
export const spanOf = (lead, passage, lang) => cutOf(lead, passage, { edges: lang !== 'it' })
/** about ninety characters keep a lead to two rows at the close look */
const LEAD_MOST = 120
const refused = []

function leadOf(id, passages, record) {
  const written = LEADS.get(id)
  if (written) {
    if (written.passage === null) return { lead: null, none: true, placeholder: false }
    const p = passages[written.passage]
    if (!p || p.missing) { refused.push(`${id}: leads.jsonl names passage ${written.passage}, which the texts do not carry`); return { lead: null, none: false, placeholder: false } }
    let good = true
    for (const lang of ['en', 'de', 'it']) {
      const said = written[lang]
      if (!said) { refused.push(`${id}: no ${lang} lead line`); good = false; continue }
      if (!p[lang]?.text) { refused.push(`${id}: a ${lang} lead line for passage ${written.passage}, which has no ${lang} text`); good = false; continue }
      const span = spanOf(said, p[lang].text, lang)
      if (!span.ok) { refused.push(`${id}: the ${lang} lead line is ${span.why} (passage ${written.passage})`); good = false; continue }
      if (span.unmarked.length) warn(`${id}: the ${lang} lead line cuts at ${span.unmarked.join(' and ')} without an ellipsis`)
      if (lang !== 'it' && said.length > LEAD_MOST) warn(`${id}: the ${lang} lead line runs ${said.length} characters`)
    }
    if (!good) return { lead: null, none: false, placeholder: false, refused: true }
    return {
      lead: {
        passage: written.passage, placeholder: false,
        en: { text: written.en, kind: p.en?.kind ?? null, label: p.en?.label ?? null, rest: p.en?.rest ?? null },
        de: { text: written.de, kind: p.de?.kind ?? null, label: p.de?.label ?? null, rest: p.de?.rest ?? null },
        it: { text: written.it, label: p.it?.label ?? null },
      },
      none: false,
    }
  }
  // UNTIL THE LEAD LINES ARRIVE: the lead passage's first sentence, never a
  // passage of letters or labels alone, never one whose place on this side
  // the texts doubt
  const usable = passages.filter(p => !p.missing && !p.label_only && !/^(doubtful|likely|uncertain)/i.test(p.placement ?? '') && (p.en || p.de))
  if (!usable.length) return { lead: null, none: false, placeholder: true }
  const named = passages[record?.lead ?? 0]
  const p = named && usable.includes(named) ? named : usable[0]
  const pick = t => t ? { text: firstSentence(t.text), kind: t.kind ?? null, label: t.label ?? null, rest: t.rest ?? null } : null
  return { lead: { passage: p.index, placeholder: true, en: pick(p.en), de: pick(p.de), it: p.it ? { text: firstSentence(p.it.text), label: p.it.label } : null }, none: false, placeholder: true }
}

/* ---- the phone's own line at rest -------------------------------------- */

/** about eighty characters keep a line to two rows on a 390 px phone */
const PHONE_MOST = 80
/** The first word of a line that is not the next word of a text, in order, or null. */
function wordsAdded(line, text) {
  const words = t => (flatten(t).toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])
  const pool = words(text)
  let at = 0
  for (const word of words(line)) {
    while (at < pool.length && pool[at] !== word) at++
    if (at === pool.length) return word
    at++
  }
  return null
}
/** THE PHONE'S OWN LINE of a page, checked against what it is cut from: a
 * line of his words that is not a cut of his lead is refused, a caption's
 * that adds a word to the caption is reported. */
function phoneOf(id, lead, caption, passages) {
  const written = PHONE?.get(id)
  if (!written) return null
  if (written.from !== 'lead' && written.from !== 'caption') { refused.push(`${id}: phone-lines.jsonl says from "${written.from}", not lead or caption`); return null }
  for (const lang of ['en', 'de']) {
    const said = written[lang]
    if (typeof said !== 'string' || !said.trim()) { refused.push(`${id}: no ${lang} phone line`); return null }
    if (said.length > PHONE_MOST) warn(`${id}: the ${lang} phone line runs ${said.length} characters`)
    if (written.from === 'lead') {
      const own = lead?.[lang]?.text
      if (!own || lead.placeholder) { refused.push(`${id}: a phone line from the lead, and the page has no written lead`); return null }
      // his words beyond the lead may stand in it only from the lead's own passage, which names the same translation
      const whole = passages[lead.passage]?.[lang]?.text
      let cut = cutOf(said, own)
      if (!cut.ok && whole) {
        const wider = cutOf(said, whole)
        if (wider.ok) { warn(`${id}: the ${lang} phone line reaches past the lead into its passage`); cut = wider }
      }
      if (!cut.ok) { refused.push(`${id}: the ${lang} phone line is not a cut of the lead or its passage: ${cut.why}`); return null }
      if (cut.unmarked.length) warn(`${id}: the ${lang} phone line cuts the lead at ${cut.unmarked.join(' and ')} without an ellipsis`)
    } else {
      const own = caption?.[lang]
      if (!own) { refused.push(`${id}: a phone line from the caption, and the page has no ${lang} caption`); return null }
      // the museum's own words may lose a word anywhere; none may be added or changed
      const extra = wordsAdded(said, own)
      if (extra) warn(`${id}: the ${lang} phone line is not a shortening of the caption: "${extra}" is not in it (in order)`)
    }
  }
  return { from: written.from, en: written.en, de: written.de }
}

/* ---- what the room says about a page besides its words ---------------- */

/** THE LEAF'S MARK in the name row, where a catalogue puts a date: the codex
 * by the register's own name, and the folio. The words pass may name a codex
 * shorter in keys.json `codex_short`. */
const REGISTER = JSON.parse(readFileSync(join(DATA, 'codices.json'), 'utf8')).entries
const registered = id => REGISTER.find(entry => entry.id === id)
function codexName(codex, lang) {
  const own = KEYS_WRITTEN.codex_short?.[codex]?.[lang]
  if (own) return own
  const paris = /^Paris Manuscript ([A-M])$/.exec(codex)
  const ash = /^Ashburnham \((A|B) complement/.exec(codex)
  const base = registered('paris-B')?.[lang] ?? 'Paris manuscript B'
  if (paris) return base.replace(/B$/, paris[1])
  // the Ashburnham leaves were cut from A and B, and are foliated on their own
  if (ash) return `${base.replace(/B$/, ash[1])} (Ashburnham)`
  const key = { 'Codex Atlanticus': 'atlanticus', 'Codex Madrid I': 'madrid-I', 'Codex Madrid II': 'madrid-II', 'Codex Arundel': 'arundel',
    'Codex Trivulzianus': 'trivulzianus', 'Codex on the Flight of Birds': 'birds' }[codex]
  const name = key ? registered(key)?.[lang] : null
  if (!name) { warn(`no register name for the codex ${codex}`); return codex }
  // the register's qualifier after a comma is about the shelf, not the page
  return name.split(',')[0].trim()
}
const folioOf = row => /^\d+$/.test(row.folio) ? `${row.folio}${row.side === 'recto' ? 'r' : row.side === 'verso' ? 'v' : ''}` : row.folio
// a folio written out in words is English in the set, so the German seat
// names the book alone until the words pass writes the place
const seatOf = row => Object.fromEntries(['en', 'de'].map(lang => [lang,
  lang === 'de' && /[a-z]{3,}/i.test(row.folio) ? codexName(row.codex, lang) : `${codexName(row.codex, lang)}, ${folioOf(row)}`]))

/** WHAT THE PICTURE IS: a photograph of the leaf, a printed plate of a
 * facsimile, or a photograph of a printed facsimile, by where it came from. */
function pictureOf(file) {
  if (/^pool2\/img\/thek\//.test(file)) return 'facsimile'
  if (/^pool2\/img\/(institut|bl)\//.test(file)) return 'leaf'
  if (/^codices\/(trivulzianus|arundel-\d)\//.test(file)) return 'plate'
  if (/^codices\/(madrid-i|madrid-ii|birds|atlanticus)\//.test(file)) return 'leaf'
  warn(`no picture kind for ${file}`)
  return null
}

/* Pages written left to right, and pages that are a copy in another hand:
   the captions say the one, the story's own drawer the other (the letter to
   the duke survives as a copy). */
const ORDINARY = new Set(['ATL.2163.1', 'AR3.181'])
const COPIES = new Set(['ATL.2163.1'])
const directionOf = (row, caption) => ORDINARY.has(row.id) || /left to right/i.test(caption?.en ?? '') ? 'ordinary' : 'mirror'

/** HALVES OF ONE OPENING: the curator names a spread in the reason, and the
 * other half is the page of the same codex at the other folio of the pair. */
function spreadOf(row) {
  const said = /(left|right) half of the (\d+)([rv])-(\d+)([rv]) spread/.exec(row.reason)
  if (!said) return null
  const [, half, a, aSide, b, bSide] = said
  const [folio, side] = half === 'left' ? [b, bSide] : [a, aSide]
  const other = SET.find(r => r.codex === row.codex && r.folio === folio && r.side === (side === 'r' ? 'recto' : 'verso'))
  if (!other) { warn(`${row.id}: its spread's other half (${folio}${side}) is not in the set`); return null }
  // the opening as one picture: both whole scans side by side, left before right
  const [left, right] = (half === 'left' ? [row, other] : [other, row]).map(r => storePathOf(r.file))
  const stem = path => path.split('/').pop().replace(/\.jpg$/, '')
  return { with: other.id, half, file: `${dirname(left)}/spreads/${stem(left)}-${stem(right)}.jpg` }
}

/** THE ORDER A TOPIC IS VISITED IN. The words pass writes each page's place;
 * until it does, the curator's order stands with the plan's own moves: a
 * topic opens on its named page, and the halves of one opening stand
 * together, left before right. */
const OPENS = { flight: 'B.174', 'letters and his life': 'AR1.33' }
function orderTopic(topic, rows) {
  const written = rows.map(row => LEADS.get(row.id)?.order)
  if (written.every(Number.isInteger)) {
    if (new Set(written).size === rows.length) return [...rows].sort((a, b) => LEADS.get(a.id).order - LEADS.get(b.id).order)
    warn(`${topic}: the written order repeats a place; the curator's order stands`)
  } else if (written.some(Number.isInteger)) warn(`${topic}: the written order leaves pages out; the curator's order stands`)
  let out = [...rows].sort((a, b) => Number(a.order) - Number(b.order))
  const first = OPENS[topic]
  if (first) out = [...out.filter(r => r.id === first), ...out.filter(r => r.id !== first)]
  for (const row of [...out]) {
    const spread = spreadOf(row)
    if (!spread || spread.half !== 'left') continue
    const right = out.find(r => r.id === spread.with)
    if (!right) continue
    out = out.filter(r => r !== right)
    out.splice(out.indexOf(row) + 1, 0, right)
  }
  return out
}

const pages = []
const texts = {}
const byTopic = new Map(order.map(topic => [topic, orderTopic(topic, SET.filter(r => r.topic === topic))]))
for (const topic of order) for (const [at, row] of byTopic.get(topic).entries()) {
  const path = storePathOf(row.file)
  const inStore = BY_PATH.get(path)
  const fresh = !row.file.startsWith('codices/')
  if (!fresh && !inStore) warn(`${row.id}: ${path} has no store record`)
  const record = RECORDS.get(row.id)
  const passages = row.text_class === 'none' ? [] : passagesOf(record)
  if (row.text_class !== 'none' && !record) warn(`not written yet: the words of ${row.id} (${row.text_class})`)
  if (row.text_class === 'none' && record) warn(`${row.id}: text class none, but ${record.file} carries words; left out`)
  const shown = passages.filter(p => !p.missing)
  const { lead, none, placeholder } = leadOf(row.id, passages, record)
  const caption = CAPTIONS.get(row.id)
  if (!caption) warn(`not written yet: the caption of ${row.id}`)
  const words = shown.reduce((sum, p) => sum + wordsIn(p.en?.text ?? p.it?.text ?? ''), 0)
  const kinds = lang => [...new Set(shown.map(p => p[lang]?.kind).filter(Boolean))].sort().join('+') || null
  const written = LEADS.get(row.id)
  const name = written?.name_en && written?.name_de ? { en: written.name_en, de: written.name_de } : null
  for (const lang of ['en', 'de']) if (name && name[lang].split(/\s+/).length > 4) warn(`${row.id}: the ${lang} short name runs past four words`)
  const direction = directionOf(row, caption)
  pages.push({
    id: row.id, topic: slug(row.topic), order: at + 1, curator_order: Number(row.order),
    codex: row.codex, folio: row.folio, side: row.side,
    name, seat: seatOf(row),
    file: path, thumb: fresh ? thumbPathOf(path) : null, fresh,
    picture: pictureOf(row.file),
    credit: row.credit_line,
    caption: caption ? { en: caption.en, de: caption.de } : null,
    writing: row.text_class !== 'none' || (DENSITY.get(row.file) ?? 0) >= 1 || WRITTEN_UNPRINTED.has(row.id),
    // its printed edition prints the drawing and no words for it
    drawing_only: Boolean(BY_PAGE[row.id]?.transcription?.length) && BY_PAGE[row.id].en === 'none' && BY_PAGE[row.id].de === 'none',
    direction, hand: COPIES.has(row.id) ? 'copy' : 'his',
    spread: spreadOf(row),
    text_class: row.text_class,
    words: shown.length ? { en: kinds('en'), de: kinds('de'), it: shown.some(p => p.it) } : null,
    lead, lead_none: none, lead_placeholder: placeholder && Boolean(shown.length),
    long: words > LONG_WORDS || shown.length > 2,
    ...(PHONE ? { phone: phoneOf(row.id, lead, caption, passages) } : {}),
  })
  if (shown.length) (texts[slug(row.topic)] ??= {})[row.id] = { lead: lead?.passage ?? null, notes: record?.notes ?? null, passages }
}

if (PHONE) for (const id of PHONE.keys()) if (!SET.some(row => row.id === id)) warn(`phone-lines.jsonl names ${id}, which is not in the set`)

const topics = order.map(topic => {
  const words = TOPIC_WORDS[topic]
  if (!words) warn(`not written yet: the words of the topic ${topic}`)
  const own = pages.filter(p => p.topic === slug(topic))
  return {
    key: topic, slug: slug(topic),
    title: words ? { en: words.title_en, de: words.title_de } : null,
    line: words ? { en: words.line_en, de: words.line_de } : null,
    pages: own.map(p => p.id),
  }
}).filter(t => t.pages.length)

/* ---- the leaf on its photograph, and the plate its mirror shows -------- */

/** THE LEAF'S RECTANGLE ON ITS PHOTOGRAPH, where the photograph shows more
 * than the leaf (a ground, a gutter, a book's edge): the desktop opens framed
 * on it as a zoom state, and the whole photograph stays one step out. Read off
 * the pixels: rows and columns mostly as bright as the middle of the page. */
const sharp = (await import('sharp')).default
async function leafOf(file) {
  const { data, info } = await sharp(file).greyscale().resize(320, 320, { fit: 'inside' }).raw().toBuffer({ resolveWithObject: true })
  const { width, height } = info
  const at = (x, y) => data[y * width + x]
  const middle = []
  for (let y = Math.floor(height * .3); y < height * .7; y += 2) for (let x = Math.floor(width * .3); x < width * .7; x += 2) middle.push(at(x, y))
  middle.sort((a, b) => a - b)
  const paper = middle[Math.floor(middle.length / 2)]
  const bright = v => v > paper * .62
  // the first and the last line mostly of paper: a dark drawing inside the
  // leaf never splits it, a dark ground outside it is never paper
  const run = (length, share) => {
    let first = -1, last = -1
    for (let i = 0; i < length; i++) if (share(i) > .5) { if (first < 0) first = i; last = i + 1 }
    return first < 0 ? [0, length] : [first, last]
  }
  const rows = run(height, y => { let n = 0; for (let x = 0; x < width; x++) if (bright(at(x, y))) n++; return n / width })
  const cols = run(width, x => { let n = 0; for (let y = rows[0]; y < rows[1]; y++) if (bright(at(x, y))) n++; return n / Math.max(1, rows[1] - rows[0]) })
  const pad = .012
  const box = {
    left: Math.max(0, cols[0] / width - pad), top: Math.max(0, rows[0] / height - pad),
    right: Math.min(1, cols[1] / width + pad), bottom: Math.min(1, rows[1] / height + pad),
  }
  const area = (box.right - box.left) * (box.bottom - box.top)
  // a leaf that already fills its photograph opens whole; a reading that
  // found almost nothing is not trusted
  if (area > .9 || area < .35) return null
  const round = v => Math.round(v * 1000) / 1000
  return { left: round(box.left), top: round(box.top), right: round(box.right), bottom: round(box.bottom) }
}
for (const page of pages) {
  const row = SET.find(r => r.id === page.id)
  const file = page.fresh ? join(FROM, row.file) : join(STORE, WING, page.file)
  // only a photograph of the leaf stands on a ground; a printed plate keeps its page
  page.leaf = /^codices\/(institut|bl)-/.test(page.file) && existsSync(file) ? await leafOf(file) : null
}

/** The printed plate of the same page, for the mirror of a page the holder's
 * licence does not let the museum turn round: written by the plate finder,
 * checked against the store here. */
const PLATES_FILE = join(DATA, 'best-of-plates.json')
const PLATES = existsSync(PLATES_FILE) ? JSON.parse(readFileSync(PLATES_FILE, 'utf8')).plates ?? {} : {}
for (const page of pages) {
  const plate = PLATES[page.id]
  // the plate's own pixels travel with it, since the 1883 volume's records name none
  page.plate = plate?.width && plate.height ? { path: plate.path, window: plate.window ?? null, width: plate.width, height: plate.height } : null
  // THE MIRROR TURNS ONLY WHAT MAY BE TURNED: the Institut's own views are
  // shown as they are, and their mirror is the printed plate or nothing
  page.mirror = !page.writing || page.hand === 'copy' ? 'none'
    : page.file.startsWith('codices/institut-') ? (page.plate ? 'plate' : 'none') : 'own'
}

const gaps = missing.size + refused.length
if (gaps && !flag('--draft') && !flag('--check')) {
  for (const word of missing) console.log(`missing word: ${word}`)
  for (const line of refused) console.log(`REFUSED ${line}`)
  console.log(`${gaps} gap(s): nothing written. Write the words, or pass --draft to write a draft.`)
  process.exit(1)
}

const noticesOut = {
  no_words: { en: notice(['no_words'], 'en'), de: notice(['no_words'], 'de') },
  // a page whose printed edition prints the drawing without words
  no_words_drawing_only: { en: NOTICES.no_words_drawing_only?.en ?? null, de: NOTICES.no_words_drawing_only?.de ?? null },
  how_made: { en: notice(['how_the_words_were_made'], 'en'), de: notice(['how_the_words_were_made'], 'de') },
}

const module_ = {
  schema_version: 1,
  provenance: 'forge/best-of.mjs joins the curator\'s set, the printed words and their translations, and the museum\'s captions, topic lines and notices. Re-run it when any of those files changes.',
  inputs,
  draft: gaps > 0,
  notices: noticesOut,
  keys: keysOut,
  topics,
  pages,
}

/* ---- writing ---------------------------------------------------------- */

const pretty = value => `${JSON.stringify(value, null, 1)}\n`
const outputs = new Map([[OUT, pretty(module_)]])
for (const topic of topics) outputs.set(join(TEXTS, `${topic.slug}.json`), pretty({ topic: topic.slug, pages: texts[topic.slug] ?? {} }))
// ONE LOADER PER TOPIC, written here so the words of a topic reach the page
// only when that topic opens, and no bundler globbing is needed to find them
outputs.set(join(DATA, 'best-of-texts.ts'), [
  '/** Written by forge/best-of.mjs: the words of each topic, loaded when it opens. */',
  'export const TOPIC_TEXTS: Readonly<Record<string, () => Promise<{ default: string }>>> = {',
  ...topics.map(topic => `  '${topic.slug}': () => import('./best-of/${topic.slug}.json?raw'),`),
  '}',
  '',
].join('\n'))

let drift = 0
for (const [file, body] of outputs) {
  const was = existsSync(file) ? readFileSync(file, 'utf8') : null
  if (was === body) continue
  drift++
  if (flag('--check')) console.log(`would change: ${file.slice(APP.length + 1)}`)
  else { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, body) }
}

/* ---- staging the store's new files ------------------------------------ */

const DEEP_EDGE = 4096
// the British Library serves at most 2,000 px, so its own largest view
const deepSize = pool => pool.source === 'bl' ? 'max' : `!${DEEP_EDGE},${DEEP_EDGE}`
const TILE_SIZE = 256
const MEDIA_BASE = 'https://media.agoracosmica.org/night/'
const deepDir = option('--deep') ? resolve(option('--deep')) : null

/** One held view cut into its static IIIF level-0 pyramid, by the store's
 * own codex recipe (forge/tile-codex.mjs), and its record. */
async function cutTiles(dir, file, source) {
  const scan = join(dir, file)
  const size = jpegSize(scan)
  const folder = file.split('/')[1]
  const number = /p(\d{4})\.jpg$/.exec(file)[1]
  const path = `codices/${folder}/tiles/${source.sha256.slice(0, 12)}/`
  const out = join(dir, path.slice(0, -1))
  const factors = scaleFactorsFor(size.width, size.height, TILE_SIZE)
  const want = ['info.json', ...expectedTileFiles(size.width, size.height, TILE_SIZE, factors)].sort()
  let files = existsSync(out) ? filesUnder(out) : []
  if (!(files.length === want.length && want.every((name, at) => files[at] === name))) {
    rmSync(out, { recursive: true, force: true })
    mkdirSync(dirname(out), { recursive: true })
    await sharp(scan, { sequentialRead: true }).jpeg({ quality: 92, chromaSubsampling: '4:4:4' })
      .tile({ layout: 'iiif3', size: TILE_SIZE, overlap: 0, id: `${MEDIA_BASE}wing-vinci/codices/${folder}/tiles` }).toFile(out)
    rmSync(join(dirname(out), 'vips-properties.xml'), { force: true })
    files = filesUnder(out)
  }
  // sharp converts a tagged file to sRGB and writes no profile; an untagged file's values stand
  const profile = profileName(readFileSync(scan))
  const recipe = tileRecipe(sharp.versions.sharp, sharp.versions.vips, TILE_SIZE)
    + (profile ? `; colour converted from the file's embedded profile (${profile}) to sRGB, no profile embedded in a tile` : '')
  return {
    id: `vinci/${CODEX_ROLE}/${folder}__p${number}`, path, class: source.class, licence: source.licence,
    holder: source.holder, source_url: source.source_url,
    // the tiles carry no metadata: the source's notice stands on their record
    ...(source.rights_notice ? { rights_notice: source.rights_notice } : {}),
    bytes: files.reduce((sum, name) => sum + statSync(join(out, name)).size, 0), pixels: size.width * size.height,
    wing: 'wing-vinci', display: true, role: CODEX_ROLE, tier: source.tier, codex: source.codex, page: source.page,
    width: size.width, height: size.height, tile_size: TILE_SIZE, scale_factors: factors, levels: factors.length,
    tiles: files.filter(name => name.endsWith('/default.jpg')).length,
    derived_from: source.id, source_sha256: source.sha256, tree_sha256: treeHash(out, files),
    recipe, recipe_sha256: sha(Buffer.from(recipe)),
    ...(source.excludedFromContentLicence ? { excludedFromContentLicence: true } : {}),
    note: 'A technical re-encoding of the held view: the whole file cut into pieces at its own pixels (a format change the holder\'s licence allows; no crop, no grade). '
      + 'IIIF Image API 3, level 0. The folder is named for the first twelve of the source hash, so a new source is a new folder.',
  }
}

async function stage(dir) {
  mkdirSync(dir, { recursive: true })
  const patch = []
  for (const page of pages.filter(p => p.fresh)) {
    const row = SET.find(r => r.id === page.id)
    const pool = POOL.get(row.file) ?? {}
    // THE HOLDER'S OWN LARGER VIEW where one was fetched (a resize by the
    // holder is a format change), else the pool's
    const deep = deepDir && existsSync(join(deepDir, page.file)) ? join(deepDir, page.file) : null
    const source = deep ?? join(FROM, row.file)
    const bytes = readFileSync(source)
    const meta = await sharp(bytes).metadata()
    const target = join(dir, page.file)
    mkdirSync(dirname(target), { recursive: true })
    // THE SCAN IS STORED AS IT CAME: an ND licence allows a format change and
    // forbids an adaptation, so the page is the source's own bytes
    copyFileSync(source, target)
    const thumbTarget = join(dir, page.thumb)
    mkdirSync(dirname(thumbTarget), { recursive: true })
    // the thumbnail is a resize only, in the source's own colour space
    const resized = await sharp(bytes).resize({ width: THUMB_EDGE, height: THUMB_EDGE, fit: 'inside', withoutEnlargement: true, kernel: 'lanczos3' })
      .keepIccProfile().jpeg({ quality: 86, chromaSubsampling: '4:4:4' }).toBuffer()
    // THE FILE'S OWN RIGHTS STATEMENT stays with its thumbnail and goes on its
    // records word for word; a field the file does not carry is never supplied
    const stated = embeddedRights(bytes)
    for (const what of stated.unread) warn(`${row.id}: ${what} in ${page.file} was not read for a rights notice`)
    const thumbBytes = carryRights(resized, bytes)
    const carried = Object.fromEntries(Object.entries(stated.fields).filter(([name]) => CARRIED(name)))
    // read back from the thumbnail itself: a notice it would lose stops the run
    const back = embeddedRights(thumbBytes)
    if (JSON.stringify(back.fields) !== JSON.stringify(carried) || back.notice !== stated.notice) throw new Error(`${row.id}: the thumbnail does not read back its source's rights statement`)
    const kept = Object.keys(carried)
    const keptNote = kept.length ? `; the source's own rights statement kept (${[kept.some(name => !name.startsWith('iptc:')) ? 'its XMP packet whole, byte for byte' : null,
      kept.some(name => name.startsWith('iptc:')) ? 'its IIM rights datasets' : null].filter(Boolean).join(' and ')}: ${kept.join(', ')})` : ''
    const dropped = Object.keys(stated.fields).filter(name => !CARRIED(name))
    if (dropped.length) warn(`${row.id}: the thumbnail does not carry ${dropped.join(', ')} of ${page.file}`)
    writeFileSync(thumbTarget, thumbBytes)
    const thumbMeta = await sharp(thumbBytes).metadata()
    const rights = rightsOf(row, pool)
    const common = {
      class: rights.class, tier: rights.tier, licence: rights.licence, licence_where: rights.where,
      ...(rights.url ? { licence_url: rights.url } : {}),
      // the credit is the holder's own line, verbatim in both languages
      honesty_en: row.credit_line, honesty_de: row.credit_line,
      ...(stated.notice ? { rights_notice: stated.notice } : {}),
      holder: rights.holder, source_url: pool.permalink || sourcePage(row) || encodeURI(row.image_id),
      original_url: deep ? `${encodeURI(pool.iiif_image_id)}/full/${deepSize(pool)}/0/default.jpg` : encodeURI(pool.iiif_image_id || row.image_id),
      wing: 'wing-vinci', display: true,
      ...(rights.excluded ? { excludedFromContentLicence: true } : {}),
    }
    const pageRecord = {
      id: idOf('codex-page', page.file), path: page.file, ...common,
      sha256: sha(bytes), bytes: bytes.length, pixels: meta.width * meta.height, width: meta.width, height: meta.height,
      role: 'codex-page', codex: codexKey(row.codex), page: page.file,
      // what the picture is, by the set's own word: a photograph of the leaf is no facsimile
      edition_index: Number(pool.canvas) || 0, ...(page.picture ? { page_kind: page.picture } : {}),
      folio: `${row.codex} f. ${row.folio}${row.side === 'recto' ? 'r' : row.side === 'verso' ? 'v' : ''}`,
      note: `The best-of set's page ${row.id} (${row.topic}, ${row.order}), stored as fetched: ${pool.width && pool.height ? `the source is ${pool.width}x${pool.height} and ` : ''}the held file is ${meta.width}x${meta.height}${deep ? `, served at that size by the holder's own IIIF server (${deepSize(pool)})` : ''}, not re-encoded, its colour profile ${meta.icc ? 'embedded as delivered' : 'absent (sRGB assumed)'}. Rights line of the set: ${row.rights_line}${rights.rule ? ` ${rights.rule}` : ''}`,
    }
    const thumbRecord = {
      id: idOf('codex-thumb', page.thumb), path: page.thumb, ...common,
      sha256: sha(thumbBytes), bytes: thumbBytes.length, pixels: thumbMeta.width * thumbMeta.height, width: thumbMeta.width, height: thumbMeta.height,
      role: 'codex-thumb', codex: codexKey(row.codex), of_page: pageRecord.id,
      note: `Strip and shelf thumbnail of ${page.file}, which carries the page's record. Preparation: ${meta.width}x${meta.height} to ${thumbMeta.width}x${thumbMeta.height}; resize only, no crop, no grade; LANCZOS; JPEG quality 86, 4:4:4; ${meta.icc ? 'the source\'s colour profile kept, no conversion' : 'untagged source: sRGB assumed'}${keptNote}.`,
    }
    patch.push({ set_id: row.id, source: row.file, source_sha256: sha(bytes), staged: page.file, target: `${WING}/${page.file}`,
      ...(rights.confirm ? { confirm: rights.confirm } : {}), record: pageRecord })
    patch.push({ set_id: row.id, source: `${row.file} (resized)`, staged: page.thumb, target: `${WING}/${page.thumb}`, record: thumbRecord })
    // A DEEP VIEW IS CUT INTO ITS PYRAMID, so the zoom reaches its pixels
    // without sending the whole file to a phone
    if (deep) {
      const tiles = await cutTiles(dir, page.file, pageRecord)
      patch.push({ set_id: row.id, source: `${page.file} (cut)`, staged: tiles.path, target: `${WING}/${tiles.path}`, record: tiles })
    }
  }
  // THE OPENINGS: two whole scans of the store side by side at one height,
  // for the desktop's open spread; no crop, no grade
  for (const page of pages.filter(p => p.spread?.half === 'left')) {
    const other = pages.find(p => p.id === page.spread.with)
    const [left, right] = [page, other].map(p => BY_PATH.get(p.file))
    if (!left || !right || !/^(CC-BY|PD)/.test(left.class) || left.tier !== 'TIER1' || right.tier !== 'TIER1') { warn(`${page.id}: no Tier 1 pair for its spread`); continue }
    const height = Math.min(left.height, right.height)
    const parts = await Promise.all([left, right].map(r => sharp(join(STORE, WING, r.path)).resize({ height, kernel: 'lanczos3' }).toBuffer({ resolveWithObject: true })))
    const width = parts[0].info.width + parts[1].info.width
    const bytes = await sharp({ create: { width, height, channels: 3, background: { r: 0, g: 0, b: 0 } } })
      .composite([{ input: parts[0].data, left: 0, top: 0 }, { input: parts[1].data, left: parts[0].info.width, top: 0 }])
      .jpeg({ quality: 90, chromaSubsampling: '4:4:4' }).toBuffer()
    const target = join(dir, page.spread.file)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, bytes)
    const record = {
      id: idOf('codex-spread', page.spread.file), path: page.spread.file,
      class: left.class, tier: left.tier, licence: left.licence, licence_where: left.licence_where, licence_url: left.licence_url,
      honesty_en: left.honesty_en, honesty_de: left.honesty_de, holder: left.holder, source_url: left.source_url, original_url: left.original_url,
      sha256: sha(bytes), bytes: bytes.length, pixels: width * height, width, height, wing: 'wing-vinci', display: true,
      role: 'codex-spread', codex: left.codex, of_pages: [left.id, right.id],
      note: `The opening ${page.folio}${page.side === 'verso' ? 'v' : 'r'} and ${other.folio}${other.side === 'verso' ? 'v' : 'r'} as one picture for the desktop's open spread: ${left.path} and ${right.path}, each whole, set side by side at ${height} px high (LANCZOS, no crop, no grade), JPEG quality 90, 4:4:4. Each scan keeps its own record.`,
    }
    patch.push({ set_id: page.id, source: `${left.path} + ${right.path}`, staged: page.spread.file, target: `${WING}/${page.spread.file}`, record })
  }
  const patchFile = option('--patch') ? resolve(option('--patch')) : join(dir, 'STORE-PATCH-MS.json')
  writeFileSync(patchFile, pretty({
    schema_version: 1,
    written_by: 'forge/best-of.mjs --stage',
    store: `${WING}/manifest.json`,
    how: 'Copy each staged file to its target in the store, append each record to the manifest, then run forge/manifest-check.mjs.',
    sizes: {
      page: `the scan as held: the Institut's views at ${DEEP_EDGE} px on the long edge and the British Library's at its largest (2,000 px) as their own IIIF servers serve them, each cut into a ${TILE_SIZE} px level-0 pyramid so the zoom reaches its pixels; Leonardo//thek@'s at 600 px, shown whole`,
      thumb: `${THUMB_EDGE} px on the long edge, for the topic strip and the shelf cell; the set's 87 pages already in the store read their pyramid's coarsest level instead`,
    },
    entries: patch,
  }))
  return patch.length
}

const codexKey = name => {
  const paris = /^Paris Manuscript ([A-M])$/.exec(name)
  if (paris) return `paris-${paris[1]}`
  const ash = /^Ashburnham \((A|B) complement/.exec(name)
  if (ash) return `ashburnham-${ash[1]}`
  if (/Atlanticus/.test(name)) return 'atlanticus'
  if (/Arundel/.test(name)) return 'arundel'
  return slug(name)
}
const sourcePage = row => /https?:\/\/\S+$/.exec(row.credit_line)?.[0] ?? null

/** THE TIER A SCAN'S OWN RIGHTS LINE ALLOWS, never a higher one. The holder
 * is named as the store's existing records of the same holder name it. */
function rightsOf(row, pool) {
  const line = row.rights_line
  if (/institutdefrance/i.test(line) || /CC BY-NC-ND/.test(row.credit_line)) return {
    class: 'PD-ART', tier: 'TIER3', licence: 'CC BY-NC-ND 3.0 FR',
    url: 'https://creativecommons.org/licenses/by-nc-nd/3.0/fr/', excluded: true,
    holder: 'Bibliothèque de l’Institut de France, Paris',
    where: `https://bibnum.institutdefrance.fr/mentions-legales${pool.manifest ? `; ${pool.manifest} -> Droits` : ''}`,
    rule: 'Tier 3 (non-commercial, no derivatives): shown whole in the flat reader only, never cropped, graded, textured, rendered or filmed; outside the museum\'s CC BY content licence.',
  }
  if (/thek@|Museo Galileo/i.test(line)) return {
    class: 'PD-ART', tier: 'TIER2', licence: 'Public-domain work; non-profit cultural use (Codice dei beni culturali art. 108 comma 3-bis); not for commercial reuse.',
    excluded: true, holder: 'Veneranda Biblioteca Ambrosiana, Milan',
    where: 'https://teche.museogalileo.it/leonardo/crediti (no licence published)',
    rule: 'Tier 2: a photograph of the printed facsimile of a public-domain work, shown in the flat reader only, credited to the facsimile, the photographic plates and the original\'s holder, outside the museum\'s CC BY content licence.',
    confirm: 'The set\'s rights line still reads "review only". The legal read of 2026-09-28 lets a few dozen Atlanticus sheets go (low to medium risk, with these credits and the letter at launch); the coordinator confirms display before landing.',
  }
  if (/British Library|bl\.uk/i.test(line) || /Public Domain in most countries other than the UK/.test(line)) return {
    class: 'PD-ART', tier: 'TIER2', licence: 'Public Domain in most countries other than the UK.',
    holder: 'British Library, London', excluded: false,
    where: `https://www.bl.uk/help/how-to-reuse-images-of-unpublished-manuscripts${pool.manifest ? `; ${pool.manifest}` : ''}`,
    rule: 'Tier 2 with the holder\'s own words, since the holder names a country where the page is not public domain.',
  }
  throw new Error(`${row.id}: no tier rule for the rights line "${line}"`)
}

const staged = option('--stage') ? await stage(resolve(option('--stage'))) : 0

/* ---- the report ------------------------------------------------------- */

const count = test => pages.filter(test).length
console.log(`best-of: ${topics.length} topics, ${pages.length} pages (${count(p => p.fresh)} new to the store)`)
console.log(`  words: ${count(p => p.words)} pages carry words, ${count(p => p.text_class !== 'none' && !p.words && RECORDS.has(p.id))} written with nothing printed, ${count(p => p.text_class !== 'none' && !RECORDS.has(p.id))} still to arrive, ${count(p => p.text_class === 'none')} have none`)
console.log(`  leads: ${count(p => p.lead && !p.lead.placeholder)} written, ${count(p => p.lead?.placeholder)} placeholders, ${count(p => p.lead_none)} none by choice`)
console.log(`  captions ${count(p => p.caption)}/${pages.length}; topic words ${topics.filter(t => t.title).length}/${topics.length}; mirror on ${count(p => p.writing)}`)
if (PHONE) console.log(`  phone lines: ${count(p => p.phone)}/${pages.length} (${count(p => p.phone?.from === 'lead')} from the lead, ${count(p => p.phone?.from === 'caption')} from the caption); none for ${pages.filter(p => !p.phone).map(p => p.id).join(', ') || 'no page'}`)
else console.log(`  phone lines: ${PHONE_FILE} not written yet`)
if (staged) console.log(`  staged ${staged} files into ${option('--stage')}`)
for (const word of missing) console.log(`  missing word: ${word}`)
for (const line of warnings) console.log(`  ${line}`)
for (const [key, said] of Object.entries(keysOut)) if (!said) console.log(`  key not written yet: ${key} (${KEYS[key]})`)
for (const key of drafted) console.log(`  key drafted by the layout, for the words pass: ${key} (${DRAFTED[key].en} / ${DRAFTED[key].de})`)
for (const line of refused) console.log(`  REFUSED ${line}`)
if (flag('--check')) { console.log(drift ? `${drift} file(s) would change` : 'up to date'); process.exit(drift || gaps ? 1 : 0) }
if (gaps) console.log(`${gaps} gap(s) written as a draft (--draft): the module is not final`)
