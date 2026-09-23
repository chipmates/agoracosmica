// THE SOCKET THE FILM'S FRAMES ARRIVE BY: a WebSocket server of the smallest
// kind (RFC 6455, binary messages from one page), on an address the operating
// system picks, so it can never take another seat's port.
//
// A message is what the page's export packs (`src/stack/export.ts`, pack): a
// little-endian length, a JSON head, then each part on a four byte boundary.
import { createServer } from 'node:http'
import { createHash } from 'node:crypto'

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'

/** Split a packed message into its head and its parts, each a copy that owns
    an aligned buffer (a typed array view needs its own alignment). */
export function unpack(buf) {
  const pad = (n) => (n + 3) & ~3
  const len = buf.readUInt32LE(0)
  const head = JSON.parse(buf.subarray(4, 4 + len).toString('utf8'))
  let at = 4 + pad(len)
  const parts = []
  for (const size of head.parts ?? []) {
    const copy = new Uint8Array(size)
    copy.set(buf.subarray(at, at + size))
    parts.push(copy)
    at += pad(size)
  }
  return { head, parts }
}

/**
 * Listen on 127.0.0.1 at a free port.
 *   onMessage(buffer)   one whole binary message
 * Returns { url, close(), port }.
 */
export async function openSink(onMessage) {
  const sockets = new Set()
  const server = createServer((req, res) => {
    res.writeHead(426)
    res.end()
  })
  server.on('upgrade', (req, socket) => {
    const key = req.headers['sec-websocket-key']
    if (!key) {
      socket.destroy()
      return
    }
    const accept = createHash('sha1').update(key + GUID).digest('base64')
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`)
    socket.setNoDelay(true)
    sockets.add(socket)
    let pending = Buffer.alloc(0)
    let message = []
    socket.on('data', (chunk) => {
      pending = pending.length ? Buffer.concat([pending, chunk]) : chunk
      for (;;) {
        if (pending.length < 2) return
        const fin = (pending[0] & 0x80) !== 0
        const opcode = pending[0] & 0x0f
        const masked = (pending[1] & 0x80) !== 0
        let length = pending[1] & 0x7f
        let at = 2
        if (length === 126) {
          if (pending.length < 4) return
          length = pending.readUInt16BE(2)
          at = 4
        } else if (length === 127) {
          if (pending.length < 10) return
          length = Number(pending.readBigUInt64BE(2))
          at = 10
        }
        const maskAt = at
        if (masked) at += 4
        if (pending.length < at + length) return
        const payload = Buffer.from(pending.subarray(at, at + length))
        if (masked) {
          const m0 = pending[maskAt], m1 = pending[maskAt + 1], m2 = pending[maskAt + 2], m3 = pending[maskAt + 3]
          for (let i = 0; i < payload.length; i += 4) {
            payload[i] ^= m0
            if (i + 1 < payload.length) payload[i + 1] ^= m1
            if (i + 2 < payload.length) payload[i + 2] ^= m2
            if (i + 3 < payload.length) payload[i + 3] ^= m3
          }
        }
        pending = pending.subarray(at + length)
        if (opcode === 0x8) {
          socket.end()
          return
        }
        if (opcode === 0x9) {
          // a ping is answered with the same payload
          socket.write(Buffer.concat([Buffer.from([0x8a, payload.length]), payload]))
          continue
        }
        if (opcode === 0x2 || opcode === 0x1 || opcode === 0x0) {
          message.push(payload)
          if (fin) {
            const whole = message.length === 1 ? message[0] : Buffer.concat(message)
            message = []
            onMessage(whole)
          }
        }
      }
    })
    socket.on('close', () => sockets.delete(socket))
    socket.on('error', () => sockets.delete(socket))
  })
  await new Promise((done) => server.listen(0, '127.0.0.1', done))
  const port = server.address().port
  return {
    port,
    url: `ws://127.0.0.1:${port}`,
    close: () => {
      for (const s of sockets) s.destroy()
      return new Promise((done) => server.close(done))
    },
  }
}
