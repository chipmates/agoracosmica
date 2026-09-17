// THE TILE CUTTER. One admitted plate becomes a static IIIF Image API 3
// level-0 pyramid in the store, so a painting can be seen as closely as its
// reproduction allows without one texture holding all of it.
//
//   node forge/tile-plate.mjs --plate vinci/painting-plate/<id> [--force]
//   node forge/tile-plate.mjs --plate vinci/painting-plate/<id> --recut
//
// --recut cuts a second time into a scratch folder and compares the tree
// hash: a cutter whose output is not byte identical run to run cannot carry
// a hash in a record. It writes nothing.
//
// THE VERSION IS THE PATH. Every pyramid stands in a folder named for the
// first twelve of its source's hash, so a new source is a new folder and an
// immutable edge cache can never serve a stale tile.
//
// Nothing is resized, sharpened or graded: the deepest level is the source's
// own pixels, which is what lets the view say it holds no more detail.
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import sharp from 'sharp'
import { mergeManifests, STORE } from './vite-na-assets.mjs'
import { expectedTileFiles, filesUnder, scaleFactorsFor, tileRecipe, treeHash } from './tiles-check.mjs'

const TILE_SIZE = 256
/** Where the bytes stand once they are pushed, which is the only address an
 * outside reader of the pyramid's own info.json could use. */
const MEDIA_BASE = 'https://media.agoracosmica.org/night/'
const PLATE_PATH = /^paintings\/([a-z0-9-]+)\/([a-z0-9-]+)__([1-9]\d*)x([1-9]\d*)\.jpg$/

const argv = process.argv.slice(2)
const flag = name => argv.includes(name)
const value = name => { const at = argv.indexOf(name); return at < 0 ? null : argv[at + 1] ?? null }
const JSON_OUT = flag('--json')
const say = (...words) => { if (!JSON_OUT) console.log(...words) }

const plateId = value('--plate')
if (!plateId) {
  console.error('usage: node forge/tile-plate.mjs --plate <manifest id> [--force] [--recut] [--json]')
  process.exit(2)
}

const { assets } = mergeManifests()
const plate = assets.find(entry => entry.id === plateId)
if (!plate) throw new Error(`no manifest record ${plateId}`)
if (plate.role !== 'painting-plate' || plate.display !== true) throw new Error(`${plateId} is not a displayed plate record`)
if (plate.wing !== 'wing-vinci') throw new Error(`${plateId} is not of the picture wing`)
const superseder = assets.find(entry => (entry.supersedes ?? []).includes(plateId))
if (superseder) throw new Error(`${plateId} is superseded by ${superseder.id} and does not hang`)
const path = PLATE_PATH.exec(plate.path ?? '')
if (!path) throw new Error(`${plateId} does not name its own work and pixels`)
const [, work, name, widthText, heightText] = path
const width = Number(widthText), height = Number(heightText)

// THE SOURCE IS THE ADMITTED FILE, BYTE FOR BYTE. A pyramid cut from
// anything else is a new work, not a re-encoding of a recorded one.
const source = join(STORE, 'wing-vinci', plate.path)
if (!existsSync(source)) throw new Error(`no file at wing-vinci/${plate.path}`)
const sourceSha = createHash('sha256').update(readFileSync(source)).digest('hex')
if (sourceSha !== plate.sha256) throw new Error(`${plateId}: the bytes on disk are not the recorded source`)
const metadata = await sharp(source).metadata()
if (metadata.width !== width || metadata.height !== height) {
  throw new Error(`${plateId}: the file is ${metadata.width}x${metadata.height}, the record says ${width}x${height}`)
}

const recipe = tileRecipe(sharp.versions.sharp, sharp.versions.vips, TILE_SIZE)
const folder = `paintings/${work}/tiles/${sourceSha.slice(0, 12)}/`
// dzsave writes INTO a path that ends in a separator, so the folder is
// named without one here and with one in the record.
const out = join(STORE, 'wing-vinci', folder.slice(0, -1))

/** One cut. The id is the folder's parent on the media origin, so the
 * pyramid's own info.json names itself where the bytes will stand. */
async function cut(destination) {
  await sharp(source, { limitInputPixels: 700e6, sequentialRead: true })
    .jpeg({ quality: 92, chromaSubsampling: '4:4:4' })
    .tile({ layout: 'iiif3', size: TILE_SIZE, overlap: 0, id: `${MEDIA_BASE}wing-vinci/paintings/${work}/tiles` })
    .toFile(destination)
  // dzsave drops a dated properties file beside the folder it writes. It is
  // not a tile, it is not reproducible, and the record names the recipe.
  rmSync(join(dirname(destination), 'vips-properties.xml'), { force: true })
}

if (flag('--recut')) {
  if (!existsSync(out)) throw new Error(`nothing cut at wing-vinci/${folder}`)
  const scratch = mkdtempSync(join(tmpdir(), 'na-tiles-'))
  // the same basename: the pyramid's own info.json names the folder it
  // stands in, so a scratch folder under another name is not the same cut
  const second = join(scratch, sourceSha.slice(0, 12))
  const started = Date.now()
  await cut(second)
  const before = treeHash(out, filesUnder(out)), after = treeHash(second, filesUnder(second))
  rmSync(scratch, { recursive: true, force: true })
  const identical = before === after
  say(`${identical ? 'IDENTICAL' : 'DIFFERENT'}  ${plateId}  ${before}  second cut ${after}  ${Date.now() - started} ms`)
  if (JSON_OUT) console.log(JSON.stringify({ id: plateId, identical, tree_sha256: before, second: after }, null, 2))
  process.exit(identical ? 0 : 1)
}

if (existsSync(out) && !flag('--force')) {
  say(`already cut at wing-vinci/${folder} (--force cuts it again)`)
} else {
  if (existsSync(out)) rmSync(out, { recursive: true, force: true })
  mkdirSync(join(STORE, 'wing-vinci', `paintings/${work}/tiles`), { recursive: true })
  const started = Date.now()
  await cut(out)
  say(`cut wing-vinci/${folder} in ${((Date.now() - started) / 1000).toFixed(1)} s`)
}

const files = filesUnder(out)
const scaleFactors = scaleFactorsFor(width, height, TILE_SIZE)
const want = ['info.json', ...expectedTileFiles(width, height, TILE_SIZE, scaleFactors)].sort()
const missing = want.filter(file => !files.includes(file))
const stray = files.filter(file => !want.includes(file))
if (missing.length || stray.length) {
  throw new Error(`the cutter and the viewer disagree: ${missing.length} missing, ${stray.length} stray `
    + `(${[...missing.slice(0, 2), ...stray.slice(0, 2)].join(', ')})`)
}
const info = JSON.parse(readFileSync(join(out, 'info.json'), 'utf8'))
if (info.width !== width || info.height !== height || info.profile !== 'level0'
  || JSON.stringify(info.tiles?.[0]?.scaleFactors ?? []) !== JSON.stringify(scaleFactors)) {
  throw new Error('the pyramid\'s own info.json does not describe the pyramid')
}
const bytes = files.reduce((sum, file) => sum + statSync(join(out, file)).size, 0)

const record = {
  id: `vinci/painting-tiles/${name}`,
  path: folder,
  class: plate.class,
  licence: plate.licence,
  ...(plate.holder === undefined ? {} : { holder: plate.holder }),
  ...(plate.source_url === undefined ? {} : { source_url: plate.source_url }),
  bytes,
  pixels: width * height,
  wing: 'vinci',
  display: true,
  role: 'painting-tiles',
  work_id: plate.work_id,
  ...(plate.plate_id === undefined ? {} : { plate_id: plate.plate_id }),
  width,
  height,
  tile_size: TILE_SIZE,
  scale_factors: scaleFactors,
  levels: scaleFactors.length,
  tiles: files.filter(file => file.endsWith('/default.jpg')).length,
  derived_from: plate.id,
  source_sha256: sourceSha,
  tree_sha256: treeHash(out, files),
  recipe,
  recipe_sha256: createHash('sha256').update(recipe).digest('hex'),
  note: 'A technical re-encoding of the admitted plate: the whole source cut into pieces at its own pixels. '
    + 'IIIF Image API 3, level 0, so every piece is a file on a shelf and nothing answers a request. '
    + 'The folder is named for the first twelve of the source hash, so a new source is a new folder.',
}

// THE RECORD IS SPLICED, NOT REWRITTEN. The store's manifest is shared by
// every seat and holds numbers whose own spelling (2.0 against 2) a
// reserialisation would change, so every other record keeps its bytes.
const manifestFile = join(STORE, 'wing-vinci', 'manifest.json')
const text = readFileSync(manifestFile, 'utf8')
const spans = topLevelObjects(text)
const written = JSON.stringify(record, null, 1).split('\n').map(line => ` ${line}`).join('\n')
const at = spans.find(span => JSON.parse(text.slice(span.start, span.end)).id === record.id)
let next
if (at) next = `${text.slice(0, at.start)}${written.trimStart()}${text.slice(at.end)}`
else {
  const last = spans[spans.length - 1]
  next = `${text.slice(0, last.end)},\n${written}${text.slice(last.end)}`
}
if (next !== text) {
  writeFileSync(manifestFile, next)
  say(`${at ? 'rewrote' : 'wrote'} the record ${record.id} into the store's manifest`)
} else say(`the record ${record.id} already stands in the store's manifest`)

say(`${record.tiles} tiles, ${record.levels} levels, ${(bytes / 1e6).toFixed(1)} MB, tree ${record.tree_sha256.slice(0, 12)}`)
if (JSON_OUT) console.log(JSON.stringify(record, null, 2))

/** Where every top-level object of the store's manifest array begins and
 * ends, so one of them can be replaced without touching the rest. */
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
