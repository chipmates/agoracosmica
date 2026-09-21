// The player is static bytes, so its server is this file. Range requests are
// answered because a video element asks for them, and nothing is cached,
// because every reading here is a cold one.
import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize } from 'node:path'

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mp4': 'video/mp4',
  '.webp': 'image/webp',
  '.png': 'image/png',
}

export function servePlayer(root, port, host = '127.0.0.1') {
  const s = createServer((req, res) => {
    const asked = decodeURIComponent((req.url ?? '/').split('?')[0])
    const rel = normalize(asked === '/' ? '/index.html' : asked).replace(/^(\.\.[/\\])+/, '')
    const file = join(root, rel)
    if (!existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404).end()
      return
    }
    const size = statSync(file).size
    const type = TYPES[extname(file)] ?? 'application/octet-stream'
    const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? '')
    if (range) {
      const start = range[1] ? Number(range[1]) : 0
      const end = range[2] ? Number(range[2]) : size - 1
      res.writeHead(206, {
        'content-type': type,
        'content-length': end - start + 1,
        'content-range': `bytes ${start}-${end}/${size}`,
        'accept-ranges': 'bytes',
        'cache-control': 'no-store',
      })
      createReadStream(file, { start, end }).pipe(res)
      return
    }
    res.writeHead(200, { 'content-type': type, 'content-length': size, 'accept-ranges': 'bytes', 'cache-control': 'no-store' })
    createReadStream(file).pipe(res)
  })
  return new Promise((r) => s.listen(port, host, () => r(s)))
}
