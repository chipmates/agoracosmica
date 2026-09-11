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
export const MERGED = join(APP_ROOT, 'public', 'na-manifest.json')

const NOT_AN_ASSET = new Set(['manifest.json', '_download-log.json', '.DS_Store'])

/** every scope folder of the store that carries a manifest */
export function scopes() {
  if (!existsSync(STORE)) return []
  return readdirSync(STORE, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(STORE, d.name, 'manifest.json')))
    .map((d) => d.name)
    .sort()
}

/** every real file of a scope, relative to the scope folder */
export function filesOf(scope) {
  const root = join(STORE, scope)
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

/** the store's manifests, merged, each entry stamped with its scope */
export function mergeManifests() {
  const assets = []
  const problems = []
  for (const scope of scopes()) {
    let doc
    try {
      doc = JSON.parse(readFileSync(join(STORE, scope, 'manifest.json'), 'utf8'))
    } catch (err) {
      problems.push(`${scope}/manifest.json is not readable JSON: ${err.message}`)
      continue
    }
    const list = Array.isArray(doc) ? doc : (doc.assets ?? [])
    for (const e of list) assets.push({ ...e, wing: e.wing ?? scope })
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
      res.setHeader('cache-control', 'no-store')
      createReadStream(file).pipe(res)
    })
  }
  return {
    name: 'na-assets',
    // the record is written before anything reads it, in dev and in build
    buildStart() {
      const { problems } = writeMerged()
      for (const p of problems) this.warn(p)
    },
    configureServer: serve,
    configurePreviewServer: serve,
  }
}
