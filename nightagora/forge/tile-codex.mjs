// THE CODEX CUTTER. Every side the reading table's shelf can open is cut
// into its own static IIIF Image API 3 level-0 pyramid, by the same recipe
// as the leaves and the paintings, and recorded one pyramid to a record.
//
//   node forge/tile-codex.mjs --store <assets folder> [--codex <id>] [--jobs 6] [--dry]
//
// THE STORE IS NAMED, NEVER FOUND. The shared store is written by the
// coordinator alone, so this cutter writes only into the folder it is told:
// a seat stages into its worktree, the coordinator points it at the store.
// The cut is deterministic, so both runs give the same tree hashes.
//
// Which scans are sides is the table's own reading (codex-sides.json); a scan
// that is not a side is not cut. Nothing is resized, sharpened or graded.
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { CODEX_ROLE, expectedTileFiles, filesUnder, jpegSize, scaleFactorsFor, tileRecipe, treeHash } from './tiles-check.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SIDES = join(HERE, '..', 'src', 'wings', 'vinci', 'table', 'data', 'codex-sides.json')
const TILE_SIZE = 256
const MEDIA_BASE = 'https://media.agoracosmica.org/night/'

const argv = process.argv.slice(2)
const value = name => { const at = argv.indexOf(name); return at < 0 ? null : argv[at + 1] ?? null }
const storeArg = value('--store')
if (!storeArg) {
  console.error('usage: node forge/tile-codex.mjs --store <assets folder> [--codex <id>] [--jobs 6] [--dry]')
  process.exit(2)
}
const STORE = resolve(storeArg)
const only = value('--codex')
const jobs = Math.max(1, Number(value('--jobs') ?? 4))
const dry = argv.includes('--dry')
const scope = join(STORE, 'wing-vinci')
const manifestFile = join(scope, 'manifest.json')
if (!existsSync(manifestFile)) throw new Error(`no wing-vinci manifest under ${STORE}`)

const store = JSON.parse(readFileSync(manifestFile, 'utf8'))
const byId = new Map(store.map(entry => [entry.id, entry]))
const sides = JSON.parse(readFileSync(SIDES, 'utf8')).codices
const recipe = tileRecipe(sharp.versions.sharp, sharp.versions.vips, TILE_SIZE)
const recipeSha = createHash('sha256').update(recipe).digest('hex')
const FILE = /^codices\/([a-z0-9-]+)\/p(\d{4})\.jpg$/

/** One side: its admitted scan, cut once, measured, and recorded. */
async function cutSide(file) {
  const named = FILE.exec(file)
  if (!named) throw new Error(`${file} is not a codex scan`)
  const [, folder, number] = named
  const source = byId.get(`vinci/codex-page/${folder}__p${number}`)
  if (!source || source.role !== 'codex-page' || source.path !== file || source.display !== true)
    throw new Error(`${file} has no displayed codex-page record`)
  const scan = join(scope, file)
  const bytes = readFileSync(scan)
  const sha = createHash('sha256').update(bytes).digest('hex')
  if (sha !== source.sha256) throw new Error(`${file}: the bytes on disk are not the recorded scan`)
  const size = jpegSize(scan)
  if (!size || size.width !== source.width || size.height !== source.height)
    throw new Error(`${file}: the scan is ${size?.width}x${size?.height}, the record says ${source.width}x${source.height}`)
  const folderPath = `codices/${folder}/tiles/${sha.slice(0, 12)}/`
  const out = join(scope, folderPath.slice(0, -1))
  const factors = scaleFactorsFor(size.width, size.height, TILE_SIZE)
  const want = ['info.json', ...expectedTileFiles(size.width, size.height, TILE_SIZE, factors)].sort()
  let files = existsSync(out) ? filesUnder(out) : []
  const whole = files.length === want.length && want.every((name, at) => files[at] === name)
  if (!whole && !dry) {
    if (existsSync(out)) rmSync(out, { recursive: true, force: true })
    mkdirSync(dirname(out), { recursive: true })
    await sharp(scan, { sequentialRead: true })
      .jpeg({ quality: 92, chromaSubsampling: '4:4:4' })
      .tile({ layout: 'iiif3', size: TILE_SIZE, overlap: 0, id: `${MEDIA_BASE}wing-vinci/codices/${folder}/tiles` })
      .toFile(out)
    // dzsave's dated properties file is not a tile and not reproducible
    rmSync(join(dirname(out), 'vips-properties.xml'), { force: true })
    files = filesUnder(out)
  }
  if (dry) return null
  const missing = want.filter(name => !files.includes(name)), stray = files.filter(name => !want.includes(name))
  if (missing.length || stray.length) throw new Error(`${file}: ${missing.length} missing, ${stray.length} stray tile(s)`)
  const info = JSON.parse(readFileSync(join(out, 'info.json'), 'utf8'))
  if (info.width !== size.width || info.height !== size.height || info.profile !== 'level0')
    throw new Error(`${file}: the pyramid's own info.json does not describe it`)
  return {
    id: `vinci/${CODEX_ROLE}/${folder}__p${number}`,
    path: folderPath,
    class: source.class,
    licence: source.licence,
    ...(source.holder === undefined ? {} : { holder: source.holder }),
    ...(source.source_url === undefined ? {} : { source_url: source.source_url }),
    bytes: files.reduce((sum, name) => sum + statSync(join(out, name)).size, 0),
    pixels: size.width * size.height,
    wing: 'wing-vinci',
    display: true,
    role: CODEX_ROLE,
    tier: source.tier,
    codex: source.codex,
    page: source.page,
    width: size.width,
    height: size.height,
    tile_size: TILE_SIZE,
    scale_factors: factors,
    levels: factors.length,
    tiles: files.filter(name => name.endsWith('/default.jpg')).length,
    derived_from: source.id,
    source_sha256: sha,
    tree_sha256: treeHash(out, files),
    recipe,
    recipe_sha256: recipeSha,
    note: 'A technical re-encoding of the admitted scan: the whole source cut into pieces at its own pixels. '
      + 'IIIF Image API 3, level 0, so every piece is a file on a shelf and nothing answers a request. '
      + 'The folder is named for the first twelve of the source hash, so a new source is a new folder.',
  }
}

const work = Object.entries(sides).filter(([id]) => !only || id === only)
  .flatMap(([id, codex]) => codex.sides.map(side => ({ id, file: side.file })))
const records = new Array(work.length)
let next = 0, done = 0
const started = Date.now()
async function worker() {
  while (next < work.length) {
    const at = next++
    records[at] = await cutSide(work[at].file)
    if (++done % 50 === 0) console.log(`${done} of ${work.length} sides, ${((Date.now() - started) / 1000).toFixed(0)} s`)
  }
}
await Promise.all(Array.from({ length: jobs }, worker))
if (dry) { console.log(`dry: ${work.length} side(s) would be cut`); process.exit(0) }

// THE RECORDS ARE SPLICED, NOT REWRITTEN: every record already in the
// store's manifest keeps its bytes, a pyramid's own record is replaced by id,
// and new ones are appended in the order the shelf reads its sides.
const text = readFileSync(manifestFile, 'utf8')
const spans = topLevelObjects(text)
const at = new Map(spans.map(span => [JSON.parse(text.slice(span.start, span.end)).id, span]))
let body = text, appended = []
for (const record of [...records].reverse()) {
  const written = JSON.stringify(record, null, 1).split('\n').map(line => ` ${line}`).join('\n')
  const span = at.get(record.id)
  if (span) body = `${body.slice(0, span.start)}${written.trimStart()}${body.slice(span.end)}`
  else appended.unshift(written)
}
if (appended.length) {
  const last = topLevelObjects(body).at(-1)
  body = `${body.slice(0, last.end)},\n${appended.join(',\n')}${body.slice(last.end)}`
}
if (body !== text) writeFileSync(manifestFile, body)
const total = records.reduce((sum, record) => sum + record.bytes, 0)
console.log(`${records.length} pyramid(s), ${records.reduce((sum, r) => sum + r.tiles, 0)} tiles, `
  + `${(total / 1e6).toFixed(0)} MB, ${appended.length} record(s) new, in ${((Date.now() - started) / 1000).toFixed(0)} s`)

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
