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
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { filesOf, mergeManifests, scopes, STORE, APP_ROOT } from './vite-na-assets.mjs'

const JSON_OUT = process.argv.includes('--json')
const QUIET = process.argv.includes('--quiet') || JSON_OUT

// The store is the arm's, not the repository's: no byte of it is public. A
// clone with no store still builds and says why, and the gate report fails
// on the missing store instead, so the arm can never silence the check by
// moving a folder.
if (!existsSync(STORE)) {
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

// ------------------------------------------------------------ the manifests
const { assets, problems } = mergeManifests()
for (const p of problems) errors.push(p)

const byId = new Map()
for (const e of assets) {
  if (byId.has(e.id)) errors.push(`duplicate id ${e.id}`)
  byId.set(e.id, e)
}

const scopeList = scopes()
for (const e of assets) {
  const where = `${e.id}`
  if (!e.path) errors.push(`${where}: no path`)
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
}

// ----------------------------------------------------- the bytes on disk
const sha = (file) => createHash('sha256').update(readFileSync(file)).digest('hex')
const claimed = new Map() // scope -> Set of relative paths a manifest names

for (const scope of scopeList) {
  const named = new Set()
  for (const e of assets.filter((a) => a.wing === scope)) {
    if (e.path.endsWith('/') || e.path.includes('*')) continue // a set or a family
    const file = join(STORE, scope, e.path)
    named.add(e.path)
    if (!existsSync(file)) {
      // a remote asset is served from another origin and is not stored here
      if (!e.source_url) errors.push(`${e.id}: no file at ${scope}/${e.path} and no source_url`)
      continue
    }
    const bytes = statSync(file).size
    if (e.bytes !== undefined && e.bytes !== bytes)
      errors.push(`${e.id}: manifest says ${e.bytes} bytes, the file is ${bytes}`)
    if (!e.sha256) errors.push(`${e.id}: stored here and unhashed`)
    else if (e.sha256 !== sha(file)) errors.push(`${e.id}: sha256 does not match the bytes on disk`)
  }
  claimed.set(scope, named)
  for (const rel of filesOf(scope)) {
    if (named.has(rel)) continue
    const covered = assets.some(
      (a) =>
        a.wing === scope &&
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
        (a.source_url !== undefined && globMatch(a.source_url, ref)) ||
        globMatch(`${a.wing}/${a.path}`, ref.replace(/^\/na-assets\//, '')) ||
        globMatch(a.path, ref)
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
  shown: resolved.has(e.id) ? 'on the path' : 'in the store',
  record: e.record === 'open' ? 'OPEN' : e.class === 'GENERATED' ? (e.model ?? '') : (e.holder ?? ''),
  licence: e.licence,
}))

if (!QUIET) {
  const w = (k, min) => Math.max(min, ...rows.map((r) => String(r[k]).length))
  const cols = [
    ['id', w('id', 2)],
    ['class', w('class', 5)],
    ['wing', w('wing', 4)],
    ['shown', w('shown', 5)],
    ['record', w('record', 6)],
  ]
  console.log(cols.map(([k, n]) => k.toUpperCase().padEnd(n)).join('  '))
  for (const r of rows) console.log(cols.map(([k, n]) => String(r[k]).padEnd(n)).join('  '))
  console.log('')
  console.log(`${assets.length} asset(s) in ${scopeList.length} scope(s), ${resolved.size} on the path`)
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
        scopes: scopeList,
        assets: assets.length,
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
