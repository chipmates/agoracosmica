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
 */
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { STORE } from './vite-na-assets.mjs'

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
 * name the same file: `codices/<source>-<volume>/<name>.jpg`, lower case. */
export function storePathOf(file) {
  if (!file.startsWith('pool2/')) return file
  const parts = file.split('/')
  const [, , source, volume, name] = parts
  if (!name) throw new Error(`no store rule for ${file}`)
  const folder = source === 'thek' ? 'thek-atlanticus' : source === 'bl' ? `bl-${volume}` : `${source}-${volume}`
  return `codices/${folder.toLowerCase()}/${name.toLowerCase().replace(/\.(?=.*\.)/g, '-')}`
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
    if (p.kind === 'missing' || (!p.it && !p.en && !p.de)) return { ...out, missing: true, note: p.note ?? null }
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
    }
    out.fr = p.fr?.text ? { text: struck(p.fr.text) } : null
    out.label_only = labelOnly(p.en?.text ?? p.it?.text ?? p.de?.text ?? '')
    out.sources = ['it', 'en', 'de', 'fr'].map(key => p[key]).filter(t => t?.edition || t?.url)
      .map(t => ({ edition: t.edition ?? null, page: t.page ?? null, url: t.url ?? null }))
    return out
  })
}

function leadOf(id, passages, record) {
  const written = LEADS.get(id)
  if (written) {
    if (written.passage === null) return { lead: null, none: true, placeholder: false }
    const p = passages[written.passage]
    if (!p || p.missing) { warn(`${id}: leads.jsonl names passage ${written.passage}, which the texts do not carry`); return { lead: null, none: false, placeholder: false } }
    return {
      lead: {
        passage: written.passage, placeholder: false,
        en: written.en ? { text: written.en, kind: p.en?.kind ?? null, label: p.en?.label ?? null } : null,
        de: written.de ? { text: written.de, kind: p.de?.kind ?? null, label: p.de?.label ?? null } : null,
        it: written.it ? { text: written.it, label: p.it?.label ?? null } : null,
      },
      none: false,
    }
  }
  // UNTIL THE LEAD LINES ARRIVE: the lead passage's first sentence, never a
  // passage of letters or labels alone
  // a passage whose place on this side the texts doubt never leads it
  const usable = passages.filter(p => !p.missing && !p.label_only && !/^doubtful/i.test(p.placement ?? '') && (p.en || p.de))
  if (!usable.length) return { lead: null, none: false, placeholder: true }
  const named = passages[record?.lead ?? 0]
  const p = named && usable.includes(named) ? named : usable[0]
  const pick = t => t ? { text: firstSentence(t.text), kind: t.kind ?? null, label: t.label ?? null } : null
  return { lead: { passage: p.index, placeholder: true, en: pick(p.en), de: pick(p.de), it: p.it ? { text: firstSentence(p.it.text), label: p.it.label } : null }, none: false, placeholder: true }
}

const pages = []
const texts = {}
for (const row of SET) {
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
  pages.push({
    id: row.id, topic: slug(row.topic), order: Number(row.order),
    codex: row.codex, folio: row.folio, side: row.side,
    file: path, thumb: fresh ? thumbPathOf(path) : null, fresh,
    credit: row.credit_line,
    caption: caption ? { en: caption.en, de: caption.de } : null,
    writing: row.text_class !== 'none' || (DENSITY.get(row.file) ?? 0) >= 1,
    text_class: row.text_class,
    words: shown.length ? { en: kinds('en'), de: kinds('de'), it: shown.some(p => p.it) } : null,
    lead, lead_none: none, lead_placeholder: placeholder && Boolean(shown.length),
    long: words > LONG_WORDS || shown.length > 2,
  })
  if (shown.length) (texts[slug(row.topic)] ??= {})[row.id] = { lead: lead?.passage ?? null, notes: null, passages }
}
pages.sort((a, b) => order.indexOf(SET.find(r => r.id === a.id).topic) - order.indexOf(SET.find(r => r.id === b.id).topic) || a.order - b.order)

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

const noticesOut = {
  no_words: { en: notice(['no_words'], 'en'), de: notice(['no_words'], 'de') },
  how_made: { en: notice(['how_the_words_were_made'], 'en'), de: notice(['how_the_words_were_made'], 'de') },
}

const module_ = {
  schema_version: 1,
  provenance: 'forge/best-of.mjs joins the curator\'s set, the printed words and their translations, and the museum\'s captions, topic lines and notices. Re-run it when any of those files changes.',
  inputs,
  notices: noticesOut,
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

async function stage(dir) {
  const sharp = (await import('sharp')).default
  mkdirSync(dir, { recursive: true })
  const patch = []
  for (const page of pages.filter(p => p.fresh)) {
    const row = SET.find(r => r.id === page.id)
    const source = join(FROM, row.file)
    const pool = POOL.get(row.file) ?? {}
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
      original_url: encodeURI(pool.iiif_image_id || row.image_id),
      wing: 'wing-vinci', display: true,
      ...(rights.excluded ? { excludedFromContentLicence: true } : {}),
    }
    const pageRecord = {
      id: idOf('codex-page', page.file), path: page.file, ...common,
      sha256: sha(bytes), bytes: bytes.length, pixels: meta.width * meta.height, width: meta.width, height: meta.height,
      role: 'codex-page', codex: codexKey(row.codex), page: page.file,
      edition_index: Number(pool.canvas) || 0, page_kind: 'facsimile',
      folio: `${row.codex} f. ${row.folio}${row.side === 'recto' ? 'r' : row.side === 'verso' ? 'v' : ''}`,
      note: `The best-of set's page ${row.id} (${row.topic}, ${row.order}), stored as fetched: ${pool.width && pool.height ? `the source is ${pool.width}x${pool.height} and ` : ''}the held file is ${meta.width}x${meta.height}, not re-encoded, its colour profile ${meta.icc ? 'embedded as delivered' : 'absent (sRGB assumed)'}. Rights line of the set: ${row.rights_line}${rights.rule ? ` ${rights.rule}` : ''}`,
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
  }
  const patchFile = option('--patch') ? resolve(option('--patch')) : join(dir, 'STORE-PATCH-MS.json')
  writeFileSync(patchFile, pretty({
    schema_version: 1,
    written_by: 'forge/best-of.mjs --stage',
    store: `${WING}/manifest.json`,
    how: 'Copy each staged file to its target in the store, append each record to the manifest, then run forge/manifest-check.mjs.',
    sizes: {
      page: 'the scan as held (Institut and British Library 1,200 px on the long edge, Leonardo//thek@ 600 px): the reader shows it whole and zooms to its own pixels, so no phone derivative is cut',
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
console.log(`  words: ${count(p => p.words)} pages carry words, ${count(p => p.text_class !== 'none' && !p.words)} still to arrive, ${count(p => p.text_class === 'none')} have none`)
console.log(`  leads: ${count(p => p.lead && !p.lead.placeholder)} written, ${count(p => p.lead?.placeholder)} placeholders, ${count(p => p.lead_none)} none by choice`)
console.log(`  captions ${count(p => p.caption)}/${pages.length}; topic words ${topics.filter(t => t.title).length}/${topics.length}; mirror on ${count(p => p.writing)}`)
if (staged) console.log(`  staged ${staged} files into ${option('--stage')}`)
for (const word of missing) console.log(`  missing word: ${word}`)
for (const line of warnings) console.log(`  ${line}`)
if (flag('--check')) { console.log(drift ? `${drift} file(s) would change` : 'up to date'); process.exit(drift ? 1 : 0) }
