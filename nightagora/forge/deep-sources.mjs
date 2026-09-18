// THE DEEPER SOURCES. Some of what the museum shows exists, at the very
// same source and under the very same licence, in more pixels than the
// store took the first time: the 1883 facsimile's own page scans, and the
// unbounded original of a plate the store bounded to 4096 px.
//
//   node forge/deep-sources.mjs [--only <manifest id>] [--json]
//
// Every file is fetched with a plain HTTP client from the URL the record
// beside it already names, kept byte for byte as the holder served it (no
// resize, no re-encode), hashed, measured, and spliced into the store's
// manifest as its own record. Nothing here replaces a record: the near scan
// stands beside the 2048 px one, the deep plate beside the wall's plate.
//
// The files themselves are held on this machine (display: false). What
// ships is the pyramid cut from them, so a visitor pays for tiles and never
// for a 108 MB download.
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import sharp from 'sharp'
import { mergeManifests, STORE } from './vite-na-assets.mjs'

const argv = process.argv.slice(2)
const JSON_OUT = argv.includes('--json')
const ONLY = argv.includes('--only') ? argv[argv.indexOf('--only') + 1] : null
const say = (...words) => { if (!JSON_OUT) console.log(...words) }

/** A stated agent, so the holders' logs can see who asked. */
const AGENT = 'AgoraCosmicaMuseum/1.0 (nonprofit digital museum, ChipMates gGmbH; +https://agoracosmica.org)'

/** THE LEAVES THE WING SENDS A VISITOR TO: the eight studies of manuscript
 * B and the leaves the machines are read from. The edition's own page
 * endpoint serves the scan whole; the store's 1333 x 2048 file was cut down
 * from it, and the URL in that record names the same page. */
const LEAVES = ['0050', '0138', '0202', '0204', '0288', '0302', '0304', '0306',
  '0322', '0326', '0340', '0344', '0346', '0348', '0386']

const SOURCES = [
  ...LEAVES.map(leaf => ({
    id: `vinci/ms-page-near/lesmanuscritsdel02lo__n${leaf}`,
    beside: `vinci/ms-page/lesmanuscritsdel02lo__n${leaf}`,
    role: 'ms-page-near',
    // the page endpoint of the scan, with no width bound on it
    url: `https://archive.org/download/lesmanuscritsdel02lo/page/n${Number(leaf)}.jpg`,
    folder: 'msb/near',
    name: `lesmanuscritsdel02lo__n${leaf}`,
    note: 'The same page of the same 1883 facsimile as the record beside it, taken from the source without a '
      + 'width bound: the store prepared its 1333 x 2048 file from this scan. Kept byte for byte as the source '
      + 'served it, with no resize and no re-encode. Held on this machine; what ships is its pyramid.',
  })),
  {
    id: 'vinci/painting-deep/ginevra-de-benci',
    beside: 'vinci/painting-plate/ginevra-de-benci-obverse',
    role: 'painting-deep',
    // the file page the plate's own record names, at its own pixels
    url: 'https://upload.wikimedia.org/wikipedia/commons/e/ee/Ginevra_de%27_Benci_-_National_Gallery_of_Art.jpg',
    folder: 'paintings/ginevra-de-benci',
    name: 'ginevra-de-benci-deep',
    note: 'The unbounded original of the file the wall\'s plate was prepared from, at the National Gallery of '
      + 'Art\'s own open-access pixels, from the source page that plate\'s record already names. The file page '
      + 'read 2026-09-18 gives usage terms "Public domain", credit "nga.gov (downloaded with dezoomify-rs)", '
      + '23235 x 23968, 108182823 bytes. The holder\'s own image service caps a single render at 4096 px and its '
      + 'licence page refuses a plain client, so the deep bytes are taken from the record URL instead. Kept byte '
      + 'for byte, no resize and no re-encode. Held on this machine; what ships is its pyramid.',
  },
]

const { assets } = mergeManifests()
const byId = new Map(assets.map(entry => [entry.id, entry]))
const written = []

for (const source of SOURCES) {
  if (ONLY && source.id !== ONLY) continue
  const beside = byId.get(source.beside)
  if (!beside) throw new Error(`${source.id}: no record ${source.beside} to stand beside`)
  // A near scan is admitted under the record beside it: the same holder, the
  // same licence line, the same source page. Nothing new is claimed.
  const target = `${source.folder}/${source.name}`
  let file = null
  for (const candidate of [`${target}.jpg`, ...pixelNames(target)]) {
    if (existsSync(join(STORE, 'wing-vinci', candidate))) { file = candidate; break }
  }
  if (!file) {
    const bytes = await fetchSource(source.url)
    const size = await sharp(bytes, { limitInputPixels: 700e6 }).metadata()
    file = `${target}__${size.width}x${size.height}.jpg`
    mkdirSync(dirname(join(STORE, 'wing-vinci', file)), { recursive: true })
    writeFileSync(join(STORE, 'wing-vinci', file), bytes)
    say(`fetched ${source.url} -> wing-vinci/${file} (${bytes.length} bytes)`)
  }
  const path = join(STORE, 'wing-vinci', file)
  const bytes = readFileSync(path)
  const size = await sharp(bytes, { limitInputPixels: 700e6 }).metadata()
  const record = {
    id: source.id,
    path: file,
    class: beside.class,
    licence: beside.licence,
    ...(beside.holder === undefined ? {} : { holder: beside.holder }),
    source_url: source.url,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    bytes: statSync(path).size,
    pixels: size.width * size.height,
    width: size.width,
    height: size.height,
    wing: 'vinci',
    // HELD, NOT SHIPPED. The museum opens the pyramid cut from this file and
    // never the file, so no visitor pays for these bytes.
    display: false,
    role: source.role,
    ...(beside.page === undefined ? {} : { page: beside.page }),
    ...(beside.work_id === undefined ? {} : { work_id: beside.work_id }),
    ...(beside.plate_id === undefined ? {} : { plate_id: beside.plate_id }),
    stands_beside: beside.id,
    note: `${source.note} Read from the source 2026-09-18.`,
  }
  splice(record)
  written.push({ id: record.id, path: record.path, bytes: record.bytes, width: size.width, height: size.height,
    sha256: record.sha256 })
}

say(`${written.length} source(s) admitted`)
if (JSON_OUT) console.log(JSON.stringify(written, null, 2))

/** The names a file may already stand under, so a second run fetches
 * nothing: the store names a prepared file by its own pixels. */
function pixelNames(target) {
  const folder = join(STORE, 'wing-vinci', dirname(target)), stem = target.split('/').pop()
  if (!existsSync(folder)) return []
  return readdirSync(folder).filter(name => name.startsWith(`${stem}__`) && name.endsWith('.jpg'))
    .map(name => `${dirname(target)}/${name}`)
}

async function fetchSource(url) {
  const answer = await fetch(url, { headers: { 'user-agent': AGENT } })
  if (!answer.ok) throw new Error(`${url}: the source answered ${answer.status} ${answer.statusText}`)
  return Buffer.from(await answer.arrayBuffer())
}

/** THE RECORD IS SPLICED, NOT REWRITTEN. The store's manifest is shared by
 * every seat, so every other record keeps its own bytes. */
function splice(record) {
  const manifestFile = join(STORE, 'wing-vinci', 'manifest.json')
  const text = readFileSync(manifestFile, 'utf8')
  const spans = topLevelObjects(text)
  const block = JSON.stringify(record, null, 1).split('\n').map(line => ` ${line}`).join('\n')
  const at = spans.find(span => JSON.parse(text.slice(span.start, span.end)).id === record.id)
  let next
  if (at) next = `${text.slice(0, at.start)}${block.trimStart()}${text.slice(at.end)}`
  else {
    const last = spans[spans.length - 1]
    next = `${text.slice(0, last.end)},\n${block}${text.slice(last.end)}`
  }
  if (next === text) { say(`the record ${record.id} already stands in the store's manifest`); return }
  writeFileSync(manifestFile, next)
  say(`${at ? 'rewrote' : 'wrote'} the record ${record.id} into the store's manifest`)
}

function topLevelObjects(source) {
  const spans = []
  let depth = 0, start = -1, inString = false, escaped = false
  for (let i = 0; i < source.length; i++) {
    const character = source[i]
    if (inString) {
      if (escaped) escaped = false
      else if (character === '\\') escaped = true
      else if (character === '"') inString = false
      continue
    }
    if (character === '"') { inString = true; continue }
    if (character === '{') { if (depth === 0) start = i; depth++; continue }
    if (character === '}') { depth--; if (depth === 0) spans.push({ start, end: i + 1 }) }
  }
  if (depth !== 0) throw new Error('the store\'s manifest is not balanced')
  return spans
}
