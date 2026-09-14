// THE MANIFEST CHECK. Nothing the museum shows may be unrecorded, so the
// build refuses to produce a bundle whose assets cannot say where they came
// from. It runs as a pre-step of `pnpm build` and stands alone:
//
//   node forge/manifest-check.mjs [--json] [--quiet]
//
// What fails a build:
//   · a file in the asset store with no manifest entry
//   · an asset referenced from src/** with no manifest entry
//   · a manifested file whose sha256 does not match the bytes on disk
//   · a REFERENCE-ONLY or display:false asset referenced from src/**
//   · a GENERATED asset with no prompt, model and date
//   · a duplicate id, or an entry whose wing does not match its scope
//
// An entry may declare `record: "open"`: an inherited asset whose production
// record is held by another pipeline. It is listed as OPEN, counted, and
// carried into every gate report. A wing scope may never use it, so no wing
// can ship on the exception the lobby needed.
//
// A scope's record may also live in the APP, at <app>/assets/<scope>/
// manifest.json, for procedural recipes or licensed Tier 1 / Tier 2 assets.
// Every rule above applies unchanged: an app-local scope holds no file
// besides its manifest. Tier originals, previews and crops are measured,
// hashed files in the external store, never remote-record exceptions.
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { join, sep } from 'node:path'
import {
  APP_ROOT,
  appScopes,
  filesOf,
  mergeManifests,
  scopes,
  strayAppFiles,
  STORE,
} from './vite-na-assets.mjs'

const JSON_OUT = process.argv.includes('--json')
const QUIET = process.argv.includes('--quiet') || JSON_OUT

// The store is the arm's, not the repository's: no byte of it is public. A
// clone with no store still builds and says why, and the gate report fails
// on the missing store instead, so the arm can never silence the check by
// moving a folder.
if (!existsSync(STORE) && !appScopes().length) {
  const said = { store: null, ok: true, reason: `no asset store at ${STORE}`, assets: 0, errors: [] }
  console.log(JSON_OUT ? JSON.stringify(said, null, 2) : said.reason)
  process.exit(0)
}

const SRC = join(APP_ROOT, 'src')
const MEDIA_ORIGIN = 'https://media.agoracosmica.org'
/** the extensions a bare string literal in the source has to answer for */
const ASSET_EXT =
  /\.(png|jpe?g|webp|avif|ktx2|basis|hdr|exr|glb|gltf|bin|mp3|wav|ogg|webm|mp4|drc|splat|ply)$/i

const errors = []
const open = []
const isTier = (entry) => entry.class === 'Tier 1' || entry.class === 'Tier 2'

// Store paths use URL-safe relative components. Only legacy families and
// procedural recipes may use a trailing slash or wildcard.
function safePath(path, concrete = false) {
  if (typeof path !== 'string' || !path || /[\\%?#:\u0000-\u001f\u007f]/.test(path)) return false
  if (concrete && (path.endsWith('/') || path.includes('*'))) return false
  const parts = path.replace(/\/$/, '').split('/')
  return parts.every((part) => part && part !== '.' && part !== '..')
}

function measuredFile(record, where) {
  if (!safePath(record.path, true)) errors.push(`${where}: path must name a safe relative file`)
  if (typeof record.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(record.sha256))
    errors.push(`${where}: sha256 must be 64 lowercase hexadecimal characters`)
  for (const key of ['bytes', 'width', 'height']) {
    if (!Number.isSafeInteger(record[key]) || record[key] <= 0)
      errors.push(`${where}: ${key} must be a positive integer`)
  }
}

// ------------------------------------------------------------ the manifests
const { assets, problems } = mergeManifests()
for (const p of problems) errors.push(p)

const byId = new Map()
for (const e of assets) {
  if (byId.has(e.id)) errors.push(`duplicate id ${e.id}`)
  byId.set(e.id, e)
}

const scopeList = scopes()
const local = new Set(appScopes())
const filesByEntry = new Map()
for (const e of assets) {
  const where = `${e.id}`
  if (!safePath(e.path)) errors.push(`${where}: path must be safe and relative to its scope`)
  if (!e.licence) errors.push(`${where}: no licence line`)
  if (typeof e.display !== 'boolean') errors.push(`${where}: display must be true or false`)
  if (!scopeList.includes(e.wing)) errors.push(`${where}: wing "${e.wing}" is not a scope of the store`)
  if (!e.id.startsWith(`${e.wing === 'lobby' || e.wing === 'library' ? e.wing : e.wing.replace(/^wing-/, '')}/`))
    errors.push(`${where}: an id is <scope>/<name>`)
  if (e.class === 'GENERATED') {
    const missing = ['prompt', 'model', 'date'].filter((k) => !e[k])
    if (missing.length) {
      if (e.record === 'open' && e.wing === 'lobby' && e.note)
        open.push(`${where}: ${missing.join(', ')} unrecorded (${e.note.split('.')[0]})`)
      else errors.push(`${where}: GENERATED without ${missing.join(', ')}`)
    }
  }
  if (e.record === 'open' && e.wing !== 'lobby')
    errors.push(`${where}: an open record is only ever an inherited lobby asset`)
  if (e.origin === 'app' && e.class !== 'GENERATED' && !isTier(e))
    errors.push(`${where}: an app-local record must be GENERATED, Tier 1 or Tier 2`)

  if (isTier(e)) measuredFile(e, where)
  const records = [{ record: e, where, required: isTier(e) }]
  if (e.previews !== undefined && !Array.isArray(e.previews))
    errors.push(`${where}: previews must be an array`)
  const variants = Array.isArray(e.previews)
    ? e.previews.map((record, index) => ({ record, where: `${where} preview ${index}` }))
    : []
  if (e.crop !== undefined) variants.push({ record: e.crop, where: `${where} crop` })
  const paths = new Set([e.path])
  for (const variant of variants) {
    const { record, where: label } = variant
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      errors.push(`${label}: file record must be an object`)
      continue
    }
    measuredFile(record, label)
    if (paths.has(record.path)) errors.push(`${label}: duplicate file path ${record.path}`)
    paths.add(record.path)
    records.push({ ...variant, required: true })
  }
  if (e.crop && typeof e.crop === 'object') {
    const box = e.crop.box
    if (!Array.isArray(box) || box.length !== 4 || !box.every(Number.isSafeInteger) ||
        box[0] < 0 || box[1] < 0 || box[2] <= box[0] || box[3] <= box[1] ||
        !Number.isSafeInteger(e.width) || !Number.isSafeInteger(e.height) ||
        box[2] > e.width || box[3] > e.height ||
        box[2] - box[0] !== e.crop.width || box[3] - box[1] !== e.crop.height)
      errors.push(`${where} crop: box must match the crop dimensions within the original`)
  }
  filesByEntry.set(e, records.filter(({ record }) => safePath(record.path)))
}

// the repository holds the record and never the art
for (const scope of local) {
  for (const stray of strayAppFiles(scope))
    errors.push(`assets/${scope}/${stray} is a byte of the museum inside the repository: move it to the store`)
}

// ----------------------------------------------------- the bytes on disk
const sha = (file) => createHash('sha256').update(readFileSync(file)).digest('hex')
for (const scope of scopeList) {
  const named = new Set()
  for (const e of assets.filter((a) => a.wing === scope)) {
    for (const { record, where, required } of filesByEntry.get(e)) {
      if (record.path.endsWith('/') || record.path.includes('*')) continue // a set or a family
      const file = join(STORE, scope, record.path)
      named.add(record.path)
      if (!existsSync(file)) {
        // Older remote assets remain valid. Tier records and derived files
        // explicitly claim local bytes; a source page cannot excuse a gap.
        if (required) errors.push(`${where}: no file at ${scope}/${record.path}`)
        else if (!e.source_url) errors.push(`${where}: no file at ${scope}/${record.path} and no source_url`)
        continue
      }
      const realScope = realpathSync(join(STORE, scope))
      if (!realScope.startsWith(realpathSync(STORE) + sep) ||
          !realpathSync(file).startsWith(realScope + sep)) {
        errors.push(`${where}: file resolves outside its store scope`)
        continue
      }
      const stat = statSync(file)
      if (!stat.isFile()) {
        errors.push(`${where}: path does not name a file`)
        continue
      }
      if (record.bytes !== undefined && record.bytes !== stat.size)
        errors.push(`${where}: manifest says ${record.bytes} bytes, the file is ${stat.size}`)
      if (!record.sha256) errors.push(`${where}: stored here and unhashed`)
      else if (record.sha256 !== sha(file)) errors.push(`${where}: sha256 does not match the bytes on disk`)
    }
  }
  for (const rel of filesOf(scope)) {
    if (named.has(rel)) continue
    const covered = assets.some(
      (a) =>
        a.wing === scope &&
        safePath(a.path) &&
        ((a.path.endsWith('/') && rel.startsWith(a.path)) ||
          (a.path.includes('*') && globMatch(a.path, rel)))
    )
    if (!covered) errors.push(`${scope}/${rel} is in the store and in no manifest`)
  }
}

function globMatch(pattern, candidate) {
  if (!pattern.includes('*')) return pattern === candidate
  const parts = pattern.split('*')
  const head = parts[0] ?? ''
  const tail = parts.slice(1).join('*')
  return (
    candidate.length >= head.length + tail.length &&
    candidate.startsWith(head) &&
    candidate.endsWith(tail)
  )
}

// ------------------------------------------- what the source asks the world for
function sourceFiles(dir) {
  const out = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name)
    if (e.isDirectory()) out.push(...sourceFiles(full))
    else if (/\.(ts|tsx|js|mjs|css|html)$/.test(e.name)) out.push(full)
  }
  return out
}

/** every asset the source names, normalised: a template hole becomes the
    `*` a family entry is written with, so a per-figure path is one claim */
function references() {
  const found = new Map() // reference -> [where]
  const add = (ref, where) => {
    if (!found.has(ref)) found.set(ref, [])
    found.get(ref).push(where)
  }
  const files = [...sourceFiles(SRC), join(APP_ROOT, 'index.html')].filter(existsSync)
  for (const file of files) {
    const text = readFileSync(file, 'utf8')
    const where = file.replace(`${APP_ROOT}/`, '')
    // a set out of the library, by the three ways a scene asks for one
    for (const m of text.matchAll(/materials\.(?:load|sync)\(\s*'([^']+)'/g)) add(`library/${m[1]}`, where)
    for (const m of text.matchAll(/\bdetail\([^,]+,\s*'([^']+)'/g)) add(`library/${m[1]}`, where)
    // an asset off the media origin, template holes normalised to a family
    const spoken = []
    for (const m of text.matchAll(/mediaUrl\(\s*(['"`])((?:\\.|(?!\1).)*)\1/g)) {
      add(MEDIA_ORIGIN + m[2].replace(/\$\{[^}]*\}/g, '*'), where)
      spoken.push([m.index, m.index + m[0].length])
    }
    // and any bare path that ends in something a GPU or a speaker consumes,
    // unless it is the argument the line above already spoke for
    for (const m of text.matchAll(/(['"`])((?:\\.|(?!\1).)*)\1/g)) {
      if (spoken.some(([a, b]) => m.index >= a && m.index < b)) continue
      const lit = m[2]
      if (!ASSET_EXT.test(lit.replace(/\$\{[^}]*\}/g, '*'))) continue
      if (lit.startsWith('http') || lit.startsWith('/na-assets')) add(lit.replace(/\$\{[^}]*\}/g, '*'), where)
      else if (!lit.includes('${')) add(lit, where)
    }
  }
  return found
}

const refs = references()
const resolved = new Map()
for (const [ref, where] of refs) {
  const entry =
    byId.get(ref) ??
    assets.find(
      (a) =>
        (typeof a.source_url === 'string' && globMatch(a.source_url, ref)) ||
        (typeof a.original_url === 'string' && globMatch(a.original_url, ref)) ||
        filesByEntry.get(a).some(({ record }) =>
          globMatch(`${a.wing}/${record.path}`, ref.replace(/^\/na-assets\//, '')) ||
          globMatch(record.path, ref)
        )
    )
  if (!entry) {
    errors.push(`${where[0]} references ${ref}, which no manifest names`)
    continue
  }
  if (!entry.display || entry.class === 'REFERENCE-ONLY')
    errors.push(`${where[0]} references ${entry.id}, which may never be displayed`)
  resolved.set(entry.id, where)
}

// ------------------------------------------------------------------ the table
const rows = assets.map((e) => ({
  id: e.id,
  class: e.class,
  wing: e.wing,
  record_in: e.origin ?? 'store',
  shown: resolved.has(e.id) ? 'on the path' : e.origin === 'app' ? 'in the record' : 'in the store',
  record: e.record === 'open' ? 'OPEN' : e.class === 'GENERATED' ? (e.model ?? '') : (e.holder ?? ''),
  licence: e.licence,
}))

if (!QUIET) {
  const w = (k, min) => Math.max(min, ...rows.map((r) => String(r[k]).length))
  const cols = [
    ['id', w('id', 2)],
    ['class', w('class', 5)],
    ['wing', w('wing', 4)],
    ['record_in', w('record_in', 9)],
    ['shown', w('shown', 5)],
    ['record', w('record', 6)],
  ]
  console.log(cols.map(([k, n]) => k.toUpperCase().padEnd(n)).join('  '))
  for (const r of rows) console.log(cols.map(([k, n]) => String(r[k]).padEnd(n)).join('  '))
  console.log('')
  const fromApp = assets.filter((e) => e.origin === 'app').length
  console.log(
    `${assets.length} asset(s) in ${scopeList.length} scope(s), ${resolved.size} on the path` +
      (fromApp ? `, ${fromApp} recorded in the app` : '')
  )
  for (const line of open) console.log(`OPEN RECORD  ${line}`)
  if (errors.length) {
    console.log('MANIFEST CHECK FAILED:')
    for (const e of errors) console.log(' ·', e)
  } else {
    console.log('every asset named, hashed and displayable')
  }
}

if (JSON_OUT)
  console.log(
    JSON.stringify(
      {
        store: STORE,
        scopes: scopeList,
        assets: assets.length,
        appScopes: [...local],
        appAssets: assets.filter((e) => e.origin === 'app').length,
        onThePath: [...resolved.keys()],
        openRecords: open,
        errors,
        ok: errors.length === 0,
        table: rows,
      },
      null,
      2
    )
  )

process.exitCode = errors.length ? 1 : 0
