// THE ASSET STORE. Not one byte of the museum's art lives in this
// repository: the store sits outside it, the bytes are served from the
// media origin in production, and the build copies nothing but the record.
//
// In dev the plugin serves /na-assets/<scope>/<path> straight off the
// store, so a seat sees the real file without a deploy. In build it emits
// only the merged manifest (public/na-manifest.json), because a bundle
// that carries assets is a bundle whose licence lines are a guess.
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { createReadStream } from 'node:fs'
import { dirname, extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
export const APP_ROOT = resolve(HERE, '..')
/* THE STORE lives beside the program, outside the public repository. A
   round's app is a clone several folders deeper than the checkout, so the
   store is found by walking up rather than by counting folders: a rig that
   only works from one depth stops working the first time a seat runs it.
   NA_ASSET_STORE points the check at a candidate store; the app never reads
   it, so a fixture can never become the museum's record. */
function findStore(from) {
  let dir = from
  for (let up = 0; up < 12; up++) {
    const inside = join(dir, 'internal', 'night-agora', 'assets')
    if (existsSync(inside)) return inside
    if (dir.endsWith('night-agora') && existsSync(join(dir, 'assets'))) return join(dir, 'assets')
    const parent = resolve(dir, '..')
    if (parent === dir) break
    dir = parent
  }
  return resolve(from, '..', '..', 'internal', 'night-agora', 'assets')
}

export const STORE = process.env.NA_ASSET_STORE ?? findStore(APP_ROOT)
const CACHE = process.env.NA_ASSET_CACHE === '1'
/* THE APP'S OWN SCOPES. Procedural recipes and the provenance of licensed
   Tier 1 / Tier 2 assets may live in `<app>/assets/<scope>/manifest.json`.
   The merge reads these beside the store's scopes. Licensed originals,
   previews and crops remain in STORE/<scope>/<path>, even when the store
   scope has no manifest of its own. Each file has its own path, sha256,
   bytes, width and height; previews is an array of those records, and crop
   is one such record with box [left, top, right, bottom] in original pixels
   (right and bottom exclusive). source_url may name the source's record;
   original_url names the downloaded original. An app-local scope may hold
   nothing besides its manifest: the repository keeps the record, never
   the art. */
export const APP_ASSETS = process.env.NA_APP_ASSETS ?? join(APP_ROOT, 'assets')
export const MERGED = join(APP_ROOT, 'public', 'na-manifest.json')

const NOT_AN_ASSET = new Set(['manifest.json', '_download-log.json', '.DS_Store'])

function scopesIn(root) {
  if (!existsSync(root)) return []
  return readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(root, d.name, 'manifest.json')))
    .map((d) => d.name)
    .sort()
}

/** the store's scopes */
export function storeScopes() {
  return scopesIn(STORE)
}

/** the app's own scopes, which carry records and no bytes */
export function appScopes() {
  return scopesIn(APP_ASSETS)
}

/** every scope either root carries a manifest for */
export function scopes() {
  return [...new Set([...storeScopes(), ...appScopes()])].sort()
}

/** where a scope's record lives: the store, the app, or both */
export function rootsOf(scope) {
  const out = []
  if (existsSync(join(STORE, scope, 'manifest.json'))) out.push({ origin: 'store', dir: join(STORE, scope) })
  if (existsSync(join(APP_ASSETS, scope, 'manifest.json'))) out.push({ origin: 'app', dir: join(APP_ASSETS, scope) })
  return out
}

/** every real file under a root, relative to it */
function filesUnder(root) {
  const out = []
  const walk = (dir, prefix) => {
    if (!existsSync(dir)) return
    for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (e.name.startsWith('.') || NOT_AN_ASSET.has(e.name)) continue
      const rel = prefix ? `${prefix}/${e.name}` : e.name
      if (e.isDirectory()) walk(join(dir, e.name), rel)
      else out.push(rel)
    }
  }
  walk(root, '')
  return out
}

/** every real file of a scope IN THE STORE, relative to the scope folder */
export function filesOf(scope) {
  return filesUnder(join(STORE, scope))
}

/** every file an app-local scope carries besides its manifest. Anything in
    this list is a byte of the museum inside the repository. */
export function strayAppFiles(scope) {
  return filesUnder(join(APP_ASSETS, scope))
}

/** Both records, merged, each entry stamped with its scope and its origin.
    A wing writes its scope as `wing-<slug>` and its ids as `<slug>/...`, so
    an entry that names itself by the short form is the same scope said the
    other way and is normalised here rather than failing the check. */
export function mergeManifests() {
  const assets = []
  const problems = []
  const all = scopes()
  for (const scope of all) {
    const short = scope.replace(/^wing-/, '')
    for (const { origin, dir } of rootsOf(scope)) {
      let doc
      try {
        doc = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'))
      } catch (err) {
        problems.push(`${origin}:${scope}/manifest.json is not readable JSON: ${err.message}`)
        continue
      }
      const list = Array.isArray(doc) ? doc : (doc.assets ?? [])
      for (const e of list) {
        const named = e.wing ?? scope
        assets.push({ ...e, wing: named === short ? scope : named, origin })
      }
    }
  }
  return { assets, problems }
}

export function writeMerged() {
  const { assets, problems } = mergeManifests()
  mkdirSync(dirname(MERGED), { recursive: true })
  writeFileSync(MERGED, JSON.stringify({ assets }, null, 2) + '\n')
  return { assets, problems }
}

const MIME = {
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.avif': 'image/avif',
  '.ktx2': 'image/ktx2',
  '.basis': 'application/octet-stream',
  '.hdr': 'image/vnd.radiance',
  '.exr': 'image/x-exr',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.json': 'application/json',
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
}

export function naAssets() {
  const serve = (server) => {
    server.middlewares.use('/na-assets', (req, res, next) => {
      // the store is outside the project root, so every path is resolved and
      // then checked to still be inside it: a served store is a served disk
      const rel = normalize(decodeURIComponent((req.url ?? '/').split('?')[0])).replace(/^(\.\.[/\\])+/, '')
      const file = resolve(STORE, '.' + (rel.startsWith('/') ? rel : `/${rel}`))
      if (!file.startsWith(STORE + '/') || !existsSync(file) || !statSync(file).isFile()) return next()
      res.setHeader('content-type', MIME[extname(file).toLowerCase()] ?? 'application/octet-stream')
      // A rig reads the store fresh every run; a walk server may cache it
      // (NA_ASSET_CACHE=1) so a reload does not fetch the tier's textures again.
      if (CACHE) {
        const mtime = statSync(file).mtime
        res.setHeader('cache-control', 'public, max-age=86400')
        res.setHeader('last-modified', mtime.toUTCString())
        const since = Date.parse(req.headers['if-modified-since'] ?? '')
        if (!Number.isNaN(since) && since >= Math.floor(mtime.getTime() / 1000) * 1000) {
          res.statusCode = 304
          return res.end()
        }
      } else {
        res.setHeader('cache-control', 'no-store')
      }
      // A VIDEO IS READ IN RANGES: WebKit plays no mp4 from a server that
      // refuses them, and every engine seeks by them
      const size = statSync(file).size
      res.setHeader('accept-ranges', 'bytes')
      const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '')
      if (range && (range[1] || range[2])) {
        const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]))
        const end = range[1] && range[2] ? Math.min(size - 1, Number(range[2])) : size - 1
        if (start >= size || start > end) {
          res.statusCode = 416
          res.setHeader('content-range', `bytes */${size}`)
          return res.end()
        }
        res.statusCode = 206
        res.setHeader('content-range', `bytes ${start}-${end}/${size}`)
        res.setHeader('content-length', String(end - start + 1))
        if (req.method === 'HEAD') return res.end()
        return createReadStream(file, { start, end }).pipe(res)
      }
      res.setHeader('content-length', String(size))
      if (req.method === 'HEAD') return res.end()
      createReadStream(file).pipe(res)
    })
  }
  /* THE RECORD BY NAME in dev. A fresh checkout writes it while the server
     starts, after vite has listed public/, and until a restart the list
     answers its address with the page: the museum then draws without its
     store and says so in red. */
  const serveRecord = (server) => {
    server.middlewares.use('/na-manifest.json', (req, res, next) => {
      if (!existsSync(MERGED)) return next()
      res.setHeader('content-type', 'application/json')
      res.setHeader('cache-control', 'no-store')
      createReadStream(MERGED).pipe(res)
    })
    serve(server)
  }
  return {
    name: 'na-assets',
    // the record is written before anything reads it, in dev and in build
    buildStart() {
      const { problems } = writeMerged()
      for (const p of problems) this.warn(p)
    },
    configureServer: serveRecord,
    configurePreviewServer: serve,
  }
}
