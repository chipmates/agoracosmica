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
 *                      notes; KEYS below names every one, and a key not written
 *                      yet falls back to the room's existing words or stands down
 */
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { STORE } from './vite-na-assets.mjs'
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
  absence_paris_rest: 'the new reason for Paris manuscripts C and E to M, now that the Institut\'s own views are admitted; until written, the absence is not shown',
  absence_ashburnham: 'the new reason for the Ashburnham leaves, likewise; until written, not shown',
  absence_arundel_middle: 'the new reason for Codex Arundel ff. 117 to 220, now that the British Library\'s views are admitted; until written, not shown',
}
const keysOut = Object.fromEntries(Object.keys(KEYS).map(key => {
  const said = KEYS_WRITTEN[key]
  return [key, said?.en && said?.de ? { en: said.en, de: said.de } : null]
}))
for (const key of Object.keys(KEYS_WRITTEN)) if (!(key in KEYS) && key !== 'codex_short') warn(`words/keys.json carries ${key}, which the room does not read`)
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
function translationLabel(kind, edition, lang, record) {
  if (kind === 'printed') return edition ? notice(['printed_translation', edition], lang) : null
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
function italianLabel(edition, lang) {
  const own = edition ? NOTICES.printed_transcription?.[edition]?.[lang] : null
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
  return (record?.passages ?? []).map((p, index) => {
    const out = { index, ref: p.ref ?? null }
    // a passage whose every language is missing is a note that nothing was printed
    const printed = ['it', 'en', 'de'].some(key => p[key]?.text && p[key]?.kind !== 'missing')
    if (p.kind === 'missing' || !printed) return { ...out, missing: true, note: p.note ?? p.it?.note ?? null }
    if (p.placement) out.placement = p.placement
    const it = p.it?.text ? struck(p.it.text) : null
    const itEdition = editionOf(p.it?.edition)
    out.it = it ? { text: it, label: { en: italianLabel(itEdition, 'en'), de: italianLabel(itEdition, 'de') } } : null
    for (const lang of ['en', 'de']) {
      const t = p[lang]
      if (!t?.text || t.kind === 'missing') { out[lang] = null; continue }
      const kind = t.kind === 'printed' ? 'printed' : 'ours'
      const edition = kind === 'printed' ? editionOf(t.edition) : editionOf(t.basis) ?? itEdition
      out[lang] = { text: struck(t.text), kind, label: translationLabel(kind, edition, lang, t) }
      // what the translator could not settle goes on the record, in the language it was written for
      const doubts = (lang === 'de' ? t.de_doubts ?? t.doubts : t.doubts) ?? []
      if (doubts.length) out[lang].doubts = doubts
    }
    out.fr = p.fr?.text ? { text: struck(p.fr.text) } : null
    out.label_only = labelOnly(p.en?.text ?? p.it?.text ?? p.de?.text ?? '')
    out.sources = ['it', 'en', 'de', 'fr'].map(key => p[key]).filter(t => t?.edition || t?.url)
      .map(t => ({ edition: t.edition ?? null, page: t.page ?? null, url: t.url ?? null }))
    return out
  })
}

/** A LEAD IS ONE SPAN OF ONE PASSAGE, word for word: with its ellipses taken
 * off it stands in the passage as printed or translated (spaces, struck
 * words and the kind of quotation mark aside), and it holds no cut inside. */
const quotes = text => text.replace(/[’‘]/g, "'").replace(/[“”„«»]/g, '"')
const flatten = text => quotes(plain(text)).replace(/^\s*[—–-]\s*/, '').replace(/\s+/g, ' ').trim()
export function spanOf(lead, passage) {
  const pieces = flatten(lead).split(/…|\.\.\./).map(piece => piece.replace(/^[\s,;:]+|[\s,;:]+$/g, '')).filter(Boolean)
  if (pieces.length !== 1) return { ok: false, why: pieces.length ? 'a cut inside it' : 'no words' }
  const whole = flatten(passage), span = pieces[0], at = whole.indexOf(span)
  if (at < 0) return { ok: false, why: 'not word for word in its passage' }
  // a span that starts or stops inside a sentence says so with an ellipsis
  const before = whole.slice(0, at), opened = !before || /[.!?:;]["')\]]?\s*$/.test(before)
  const closed = at + span.length === whole.length || /[.!?]["')\]]?$/.test(span)
  const marked = flatten(lead)
  const unmarked = [!opened && !marked.startsWith('…') && !marked.startsWith('...') ? 'its start' : null,
    !closed && !/(…|\.\.\.)$/.test(marked) ? 'its end' : null].filter(Boolean)
  return { ok: true, unmarked }
}
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
      const span = spanOf(said, p[lang].text)
      if (!span.ok) { refused.push(`${id}: the ${lang} lead line is ${span.why} (passage ${written.passage})`); good = false; continue }
      if (span.unmarked.length) warn(`${id}: the ${lang} lead line cuts at ${span.unmarked.join(' and ')} without an ellipsis`)
      if (lang !== 'it' && said.length > LEAD_MOST) warn(`${id}: the ${lang} lead line runs ${said.length} characters`)
    }
    if (!good) return { lead: null, none: false, placeholder: false, refused: true }
    return {
      lead: {
        passage: written.passage, placeholder: false,
        en: { text: written.en, kind: p.en?.kind ?? null, label: p.en?.label ?? null },
        de: { text: written.de, kind: p.de?.kind ?? null, label: p.de?.label ?? null },
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
  const pick = t => t ? { text: firstSentence(t.text), kind: t.kind ?? null, label: t.label ?? null } : null
  return { lead: { passage: p.index, placeholder: true, en: pick(p.en), de: pick(p.de), it: p.it ? { text: firstSentence(p.it.text), label: p.it.label } : null }, none: false, placeholder: true }
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
const seatOf = row => Object.fromEntries(['en', 'de'].map(lang => [lang, `${codexName(row.codex, lang)}, ${folioOf(row)}`]))

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
    writing: row.text_class !== 'none' || (DENSITY.get(row.file) ?? 0) >= 1,
    direction, hand: COPIES.has(row.id) ? 'copy' : 'his',
    spread: spreadOf(row),
    text_class: row.text_class,
    words: shown.length ? { en: kinds('en'), de: kinds('de'), it: shown.some(p => p.it) } : null,
    lead, lead_none: none, lead_placeholder: placeholder && Boolean(shown.length),
    long: words > LONG_WORDS || shown.length > 2,
  })
  if (shown.length) (texts[slug(row.topic)] ??= {})[row.id] = { lead: lead?.passage ?? null, notes: record?.notes ?? null, passages }
}

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
  page.plate = plate ? { path: plate.path, window: plate.window ?? null } : null
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
  const recipe = tileRecipe(sharp.versions.sharp, sharp.versions.vips, TILE_SIZE)
  return {
    id: `vinci/${CODEX_ROLE}/${folder}__p${number}`, path, class: source.class, licence: source.licence,
    holder: source.holder, source_url: source.source_url,
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
    const thumbBytes = await sharp(bytes).resize({ width: THUMB_EDGE, height: THUMB_EDGE, fit: 'inside', withoutEnlargement: true, kernel: 'lanczos3' })
      .keepIccProfile().jpeg({ quality: 86, chromaSubsampling: '4:4:4' }).toBuffer()
    writeFileSync(thumbTarget, thumbBytes)
    const thumbMeta = await sharp(thumbBytes).metadata()
    const rights = rightsOf(row, pool)
    const common = {
      class: rights.class, tier: rights.tier, licence: rights.licence, licence_where: rights.where,
      ...(rights.url ? { licence_url: rights.url } : {}),
      // the credit is the holder's own line, verbatim in both languages
      honesty_en: row.credit_line, honesty_de: row.credit_line,
      holder: rights.holder, source_url: pool.permalink || sourcePage(row) || encodeURI(row.image_id),
      original_url: deep ? `${encodeURI(pool.iiif_image_id)}/full/${deepSize(pool)}/0/default.jpg` : encodeURI(pool.iiif_image_id || row.image_id),
      wing: 'wing-vinci', display: true,
      ...(rights.excluded ? { excludedFromContentLicence: true } : {}),
    }
    const pageRecord = {
      id: idOf('codex-page', page.file), path: page.file, ...common,
      sha256: sha(bytes), bytes: bytes.length, pixels: meta.width * meta.height, width: meta.width, height: meta.height,
      role: 'codex-page', codex: codexKey(row.codex), page: page.file,
      edition_index: Number(pool.canvas) || 0, page_kind: 'facsimile',
      folio: `${row.codex} f. ${row.folio}${row.side === 'recto' ? 'r' : row.side === 'verso' ? 'v' : ''}`,
      note: `The best-of set's page ${row.id} (${row.topic}, ${row.order}), stored as fetched: ${pool.width && pool.height ? `the source is ${pool.width}x${pool.height} and ` : ''}the held file is ${meta.width}x${meta.height}${deep ? `, served at that size by the holder's own IIIF server (${deepSize(pool)})` : ''}, not re-encoded, its colour profile ${meta.icc ? 'embedded as delivered' : 'absent (sRGB assumed)'}. Rights line of the set: ${row.rights_line}${rights.rule ? ` ${rights.rule}` : ''}`,
    }
    const thumbRecord = {
      id: idOf('codex-thumb', page.thumb), path: page.thumb, ...common,
      sha256: sha(thumbBytes), bytes: thumbBytes.length, pixels: thumbMeta.width * thumbMeta.height, width: thumbMeta.width, height: thumbMeta.height,
      role: 'codex-thumb', codex: codexKey(row.codex), of_page: pageRecord.id,
      note: `Strip and shelf thumbnail of ${page.file}, which carries the page's record. Preparation: ${meta.width}x${meta.height} to ${thumbMeta.width}x${thumbMeta.height}; resize only, no crop, no grade; LANCZOS; JPEG quality 86, 4:4:4; ${meta.icc ? 'the source\'s colour profile kept, no conversion' : 'untagged source: sRGB assumed'}.`,
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
if (staged) console.log(`  staged ${staged} files into ${option('--stage')}`)
for (const word of missing) console.log(`  missing word: ${word}`)
for (const line of warnings) console.log(`  ${line}`)
for (const [key, said] of Object.entries(keysOut)) if (!said) console.log(`  key not written yet: ${key} (${KEYS[key]})`)
for (const line of refused) console.log(`  REFUSED ${line}`)
if (flag('--check')) { console.log(drift ? `${drift} file(s) would change` : 'up to date'); process.exit(drift || gaps ? 1 : 0) }
if (gaps) console.log(`${gaps} gap(s) written as a draft (--draft): the module is not final`)
