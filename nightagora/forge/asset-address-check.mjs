// THE ADDRESS CHECK. The media origin holds the store for a year as
// immutable and none of its names is hashed, so an address without a version
// is a file that cannot be corrected for a year. This check refuses three
// things, offline, in a second:
//
//   node forge/asset-address-check.mjs [--json]
//
//   1 AN ADDRESS FORMED BY HAND. ASSET_BASE lives in one module and is read
//     nowhere else; the dev route and the media origin are written in that
//     module alone, because a hand-written `/na-assets/` is a file the built
//     museum asks its own origin for and never finds; and `assetUrl` may not
//     be called at all, because it answers with a record's source_url, which
//     is the holder's page and not a file in the store.
//   2 AN ADDRESS WITHOUT A VERSION. Every record the loader can address is
//     run through the helper's own rule; one that yields no twelve hex is
//     named. A tile pyramid is the one exception and it is checked instead:
//     its folder name must BE the first twelve hex of the source's digest,
//     because a level-0 viewer joins its region onto the base and a query
//     there would land in the middle of every tile's path.
//   3 A FILE INSIDE A FOLDER THE FOLDER'S RECORD DOES NOT COVER. A material
//     set and a model folder carry no digest of their own, so the loader
//     takes the per-file record beside them; this check holds those records
//     to exist, by the id the loader asks for.
//
// A record outside the scopes this app's loaders read is printed and does not
// fail: the museum carries records for stores other surfaces serve.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { APP_ROOT, mergeManifests } from './vite-na-assets.mjs'

const JSON_OUT = process.argv.includes('--json')
/* NA_ADDRESS_SRC points the check at a candidate tree, for its own negative
   test; the app never reads it, so a fixture can never become the museum. */
const SRC = process.env.NA_ADDRESS_SRC ?? join(APP_ROOT, 'src')
/** the module the base and the helpers live in, and the only file that reads it */
const HOME = join(SRC, 'stack', 'materials.ts')
/** the scopes this app's own loaders read */
const OURS = new Set(['wing-vinci', 'library', 'models'])
const DIGEST = /^[0-9a-f]{12}/
const failures = []
const fail = (code, said, where) => failures.push({ code, said, where })

function sources(dir) {
  const out = []
  for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = join(dir, e.name)
    if (e.isDirectory()) out.push(...sources(full))
    else if (/\.(ts|mjs|js)$/.test(e.name) && statSync(full).isFile()) out.push(full)
  }
  return out
}

/* 1 — THE SOURCE. A checker that mocks the module names it in a string and is
   not forming an address, so only real reads count: an import of ASSET_BASE,
   or the identifier used in a template or a concatenation. */
const files = sources(SRC)
let readsOfBase = 0
let prefixesByHand = 0
let callsOfAssetUrl = 0
for (const file of files) {
  const text = readFileSync(file, 'utf8')
  const here = relative(APP_ROOT, file)
  if (file !== HOME) {
    for (const line of text.split('\n')) {
      // a double's own table of module exports is a fixture, not an address
      if (line.includes('ASSET_BASE') && !/ASSET_BASE\s*:/.test(line)) {
        readsOfBase++
        fail('address-by-hand', `ASSET_BASE is read outside the module it lives in: ${line.trim().slice(0, 96)}`, here)
      }
      // the dev route and the media origin are the base, written out by hand
      if (/['"`][^'"`]*\/na-assets\/|media\.agoracosmica\.org\/night/.test(line)
        && !/mock|fixture|catalogue-assets/.test(line) && !/ASSET_BASE\s*:/.test(line)) {
        prefixesByHand++
        fail('prefix-by-hand', `the store's prefix is written out instead of taken from the base: ${line.trim().slice(0, 96)}`, here)
      }
    }
  }
  for (const line of text.split('\n')) {
    // the declaration is the module's own; a CALL is what forms an address
    if (/\bassetUrl\s*\(/.test(line) && !/function\s+assetUrl/.test(line)) {
      callsOfAssetUrl++
      fail('source-url-address', `assetUrl answers with a record's source_url, which is not a file in the store: ${line.trim().slice(0, 96)}`, here)
    }
  }
}

/* 2 and 3 — THE RECORDS. The merged record, read the way the app reads it. */
const { assets, problems } = mergeManifests()
for (const said of problems) fail('manifest', said, 'assets/*/manifest.json')

const byId = new Map(assets.map(e => [e.id, e]))
const version = e => {
  const digest = e.sha256 ?? e.tree_sha256 ?? ''
  return DIGEST.test(digest) ? digest.slice(0, 12) : null
}
const displayable = e => e.display === true && e.class !== 'REFERENCE-ONLY'
const isFolder = e => typeof e.path === 'string' && e.path.endsWith('/')
const isFamily = e => typeof e.path === 'string' && e.path.includes('*')
const isPyramid = e => typeof e.role === 'string' && e.role.endsWith('-tiles')

const counted = { files: 0, documents: 0, pyramids: 0, sets: 0, elsewhere: [] }

for (const e of assets) {
  if (!displayable(e) || isFamily(e)) continue
  const ours = OURS.has(e.wing)
  const say = (code, said) => (ours ? fail(code, said, e.id) : counted.elsewhere.push(`${e.id}: ${said}`))

  if (isPyramid(e)) {
    counted.pyramids++
    const folder = e.path.replace(/\/+$/, '').split('/').pop()
    if (!DIGEST.test(e.source_sha256 ?? '') || !(e.source_sha256 ?? '').startsWith(folder) || folder.length !== 12) {
      say('pyramid-not-addressed', 'a pyramid takes no query, so its folder must be the first twelve hex of source_sha256')
    }
    if (!version(e)) say('pyramid-no-digest', 'a pyramid carries no digest of its own tree')
    continue
  }

  if (isFolder(e)) {
    // a folder record is addressed only where it names its own document
    const document = e.gltf?.file
    if (document) {
      counted.documents++
      const stem = document.replace(/\.[^.]*$/, '')
      if (!version(e) && !byId.get(`${e.id}-${stem}`)) {
        say('document-not-versioned', `the folder carries no digest and no record is named ${e.id}-${stem}`)
      }
    }
    // a set of maps is addressed one file at a time
    if (Array.isArray(e.maps) && e.maps.length) {
      counted.sets++
      for (const map of e.maps) {
        const own = byId.get(`${e.id}-${map}`)
        if (!version(e) && !own) say('map-not-versioned', `no record is named ${e.id}-${map}`)
        else if (own && !version(own)) say('map-not-versioned', `${own.id} carries no digest`)
      }
    }
    continue
  }

  counted.files++
  if (!version(e)) say('file-not-versioned', 'a file record with no digest cannot be versioned')
}

/* 3b — the preview render a bench page hangs beside a set or a model: the
   folder's own record does not cover it, so its record must exist. */
for (const e of assets) {
  if (!displayable(e) || !isFolder(e) || !OURS.has(e.wing)) continue
  const wanted = (Array.isArray(e.maps) && e.maps.length) || e.gltf?.file
  if (!wanted || version(e)) continue
  if (!byId.get(`${e.id}-reference`)) {
    fail('reference-not-versioned', `no record is named ${e.id}-reference`, e.id)
  }
}

const report = {
  checker: 'store-address',
  mode: 'offline source and record inspection',
  home: relative(APP_ROOT, HOME),
  sourceFiles: files.length,
  readsOfBaseOutsideItsModule: readsOfBase,
  prefixesWrittenByHand: prefixesByHand,
  callsOfAssetUrl,
  records: { addressedFiles: counted.files, namedDocuments: counted.documents,
    pyramids: counted.pyramids, mapSets: counted.sets, scopes: [...OURS] },
  carriedElsewhere: counted.elsewhere,
  limitations: [
    'Static: it reads the record and the source text, it does not run the loader or fetch a byte.',
    'It holds the helper to the rule this file states; it does not re-derive that rule from the helper.',
  ],
  errors: failures,
  ok: failures.length === 0,
}

if (JSON_OUT) console.log(JSON.stringify(report, null, 2))
else {
  console.log(`${report.records.addressedFiles} file records, ${report.records.namedDocuments} named documents, ` +
    `${report.records.pyramids} pyramids, ${report.records.mapSets} map sets`)
  for (const said of counted.elsewhere) console.log(`CARRIED, NOT ADDRESSED HERE  ${said}`)
  if (failures.length) {
    console.log('ADDRESS CHECK FAILED:')
    for (const f of failures) console.log(` · ${f.where}: ${f.said} [${f.code}]`)
  } else console.log('ok: true')
}
process.exit(report.ok ? 0 : 1)
