// THE FILM ON A LOCAL HTTPS ORIGIN: the app's own dev server with a local
// certificate, and a release folder served under `/film/`, byte ranges
// included, as the media origin will serve it. Nothing is deployed and
// nothing is uploaded; the certificate and the release live outside the repo.
//
//   node forge/film/serve.mjs --port=5515 --film=<folder holding release folders> --cert=<folder>
//
// The page is then `https://<host>:5515/w/vinci?film=<release>&order=life`.
import { execFileSync } from 'node:child_process'
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import { extname, join, normalize, resolve } from 'node:path'
import { createServer, preview } from 'vite'
import { APP_ROOT } from '../rig.mjs'

const flags = new Map(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
  const at = a.indexOf('=')
  return at < 0 ? [a.slice(2), true] : [a.slice(2, at), a.slice(at + 1)]
}))
const PORT = Number(flags.get('port') ?? process.env['FORGE_PORT'] ?? 5199)
const FILM = resolve(String(flags.get('film') ?? ''))
const CERT = resolve(String(flags.get('cert') ?? join(FILM, '..', 'cert')))
const HOST = String(flags.get('host') ?? '127.0.0.1')
/** a built app to preview instead of the dev server: its bytes are the ones a visitor pays */
const DIST = flags.has('dist') ? resolve(String(flags.get('dist'))) : null
if (!existsSync(FILM)) throw new Error(`no film folder at ${FILM}`)

/** a certificate of this machine's own, made once and kept beside the film */
function certificate() {
  const key = join(CERT, 'key.pem'), cert = join(CERT, 'cert.pem')
  if (!existsSync(key) || !existsSync(cert)) {
    mkdirSync(CERT, { recursive: true })
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-sha256', '-days', '30',
      '-keyout', key, '-out', cert, '-subj', '/CN=localhost',
      '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1'], { stdio: 'ignore' })
  }
  return { key: readFileSync(key), cert: readFileSync(cert) }
}

const TYPES = { '.mp4': 'video/mp4', '.webp': 'image/webp', '.png': 'image/png', '.json': 'application/json', '.html': 'text/html; charset=utf-8' }

/** `/film/<release>/<path>` off the folder, with the ranges a video element asks for */
function filmPlugin() {
  const serve = (server) => {
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url ?? '/', 'https://x')
        if (!url.pathname.startsWith('/film/')) return next()
        const file = normalize(join(FILM, decodeURIComponent(url.pathname.slice('/film/'.length))))
        if (!file.startsWith(FILM) || !existsSync(file) || !statSync(file).isFile()) { res.statusCode = 404; res.end(); return }
        const size = statSync(file).size
        res.setHeader('Content-Type', TYPES[extname(file)] ?? 'application/octet-stream')
        res.setHeader('Accept-Ranges', 'bytes')
        res.setHeader('Cache-Control', 'no-cache')
        const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '')
        if (range && (range[1] || range[2])) {
          const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]))
          const end = range[1] && range[2] ? Math.min(size - 1, Number(range[2])) : size - 1
          if (start >= size || start > end) { res.statusCode = 416; res.setHeader('Content-Range', `bytes */${size}`); res.end(); return }
          res.statusCode = 206
          res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`)
          res.setHeader('Content-Length', String(end - start + 1))
          if (req.method === 'HEAD') { res.end(); return }
          createReadStream(file, { start, end }).pipe(res)
          return
        }
        res.setHeader('Content-Length', String(size))
        if (req.method === 'HEAD') { res.end(); return }
        createReadStream(file).pipe(res)
      })
  }
  return { name: 'na-film', configureServer: serve, configurePreviewServer: serve }
}

if (DIST) {
  await preview({ root: APP_ROOT, build: { outDir: DIST }, preview: { port: PORT, strictPort: true, host: HOST, https: certificate() }, plugins: [filmPlugin()] })
} else {
  const server = await createServer({
    root: APP_ROOT,
    server: { port: PORT, strictPort: true, host: HOST, https: certificate() },
    plugins: [filmPlugin()],
  })
  await server.listen()
}
console.log(`the film on https://${HOST}:${PORT}/w/vinci?film=<release>&order=life (releases in ${FILM})`)
