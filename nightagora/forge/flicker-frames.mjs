// THE FRAME ARITHMETIC EVERY FLICKER EYE SHARES. The held-camera gate
// (`flicker.mjs`) and the walking eye (`flicker-walk.mjs`) ask different
// questions of the same thing: a stream of composited frames on disk, read
// one at a time. This file is that stream and the arithmetic over it, with
// no run of its own, so the two instruments cannot drift apart in how they
// decode, measure or draw a frame.
import { spawn } from 'node:child_process'
import { closeSync, mkdirSync, openSync, readFileSync, readSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** a pixel is unstable when its temporal sd over the frames is over this */
export const SD_LEVELS = 6
/** the side of the cell a tile reading averages over. A surface flickers as a
    surface and 32 px is the cell that reads one; an EDGE that wobbles by a
    pixel moves a 32 px cell by a thirtieth of its contrast and hides in it, so
    an instrument aimed at an edge may set its own. The held gate never does. */
export let TILE = 32
export function setTile(side) {
  TILE = Math.max(2, Math.round(side))
  return TILE
}

/* ---- PNG, ffmpeg, and the arithmetic over the frames --------------------- */

/** width and height out of a PNG's IHDR, so no image library is needed */
export function pngSize(buf) {
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }
}

/* EVERY FRAME AS ONE RAW GREY STREAM, ON DISK. A drag is 240 frames and a
   desktop frame is 1.4 MB of luminance: held in memory that is a third of a
   gigabyte for arithmetic that only ever looks at two frames at a time. So
   ffmpeg writes the whole walk as raw grey to one file and the reader below
   hands out one frame at a time into a buffer it reuses. */
export function decodeGrey(dir, raw, pattern = 'f%04d.png') {
  return new Promise((done, fail) => {
    const ff = spawn('ffmpeg', [
      '-loglevel', 'error', '-y', '-f', 'image2', '-i', join(dir, pattern),
      '-pix_fmt', 'gray', '-f', 'rawvideo', raw,
    ], { stdio: 'ignore' })
    ff.on('error', fail)
    ff.on('close', () => done(raw))
  })
}

export function reader(raw, size) {
  const fd = openSync(raw, 'r')
  const frames = Math.floor(statSync(raw).size / size)
  return {
    frames,
    into(buf, i) {
      readSync(fd, buf, 0, size, i * size)
      return buf
    },
    close() {
      closeSync(fd)
    },
  }
}

/** a PPM out of arithmetic, then ffmpeg makes it a PNG: no image library */
export async function writePng(path, rgb, w, h) {
  const ppm = `${path}.ppm`
  writeFileSync(ppm, Buffer.concat([Buffer.from(`P6\n${w} ${h}\n255\n`), rgb]))
  await new Promise((done) => {
    const ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-i', ppm, path], { stdio: 'ignore' })
    ff.on('close', done)
  })
  rmSync(ppm, { force: true })
}

/** per pixel, the temporal standard deviation of luminance over the frames,
    accumulated one frame at a time so no walk is ever held whole */
export function temporalSd(read, size) {
  const sum = new Float64Array(size)
  const sq = new Float64Array(size)
  const buf = Buffer.alloc(size)
  for (let n = 0; n < read.frames; n++) {
    read.into(buf, n)
    for (let i = 0; i < size; i++) {
      const v = buf[i]
      sum[i] += v
      sq[i] += v * v
    }
  }
  const n = read.frames
  const sd = new Float32Array(size)
  const mean = new Float32Array(size)
  for (let i = 0; i < size; i++) {
    const m = sum[i] / n
    mean[i] = m
    sd[i] = Math.sqrt(Math.max(0, sq[i] / n - m * m))
  }
  return { sd, mean }
}

/* THE LONGEST CONNECTED REGION, which is the shape half of the reading. A
   scatter of unstable pixels is noise in the capture; a LINE of them is an
   edge the resolve cannot settle, and a BAND of them is two surfaces trading
   the depth test. So the mask is walked into connected regions (eight
   neighbours) and each one is reported by the longer side of its own box. */
export function regions(mask, w, h, limit = 12) {
  const seen = new Uint8Array(mask.length)
  const stack = new Int32Array(mask.length)
  const found = []
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || seen[start]) continue
    let top = 0
    stack[top++] = start
    seen[start] = 1
    let area = 0
    let x0 = w
    let x1 = -1
    let y0 = h
    let y1 = -1
    while (top) {
      const p = stack[--top]
      const x = p % w
      const y = (p - x) / w
      area++
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy
        if (ny < 0 || ny >= h) continue
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx
          if (nx < 0 || nx >= w) continue
          const q = ny * w + nx
          if (mask[q] && !seen[q]) {
            seen[q] = 1
            stack[top++] = q
          }
        }
      }
    }
    found.push({ area, x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, length: Math.max(x1 - x0 + 1, y1 - y0 + 1) })
  }
  found.sort((a, b) => b.length - a.length || b.area - a.area)
  return found.slice(0, limit)
}

/* THE HEAT MAP. The picture's own luminance, dimmed, so a reader can see
   WHERE the instability sits, with the unstable pixels painted over it:
   amber from the first level of movement, white where it is a defect. */
export async function heatMap(path, sd, mean, w, h) {
  const rgb = Buffer.alloc(w * h * 3)
  for (let i = 0; i < sd.length; i++) {
    const base = Math.round(mean[i] * 0.28)
    const t = sd[i] / SD_LEVELS
    let r = base
    let g = base
    let b = base
    if (t > 0.15) {
      const k = Math.min(1, t)
      r = Math.round(base + (255 - base) * Math.min(1, k * 1.4))
      g = Math.round(base + (190 - base) * k)
      b = Math.round(base * (1 - k * 0.8))
      if (t > 1) {
        // over the floor: white, so a defect cannot be read as a warm surface
        const o = Math.min(1, (t - 1) / 2)
        g = Math.round(g + (255 - g) * o)
        b = Math.round(b + (255 - b) * o)
      }
    }
    rgb[i * 3] = r
    rgb[i * 3 + 1] = g
    rgb[i * 3 + 2] = b
  }
  await writePng(path, rgb, w, h)
}

/** where the drag's shimmer and pops accumulated, one cell per tile */
export async function tileMap(path, counts, cols, rows, w, h, worst) {
  const rgb = Buffer.alloc(w * h * 3)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = counts[Math.min(rows - 1, (y / TILE) | 0) * cols + Math.min(cols - 1, (x / TILE) | 0)]
      const k = worst ? Math.min(1, c / worst) : 0
      const i = (y * w + x) * 3
      rgb[i] = Math.round(24 + 231 * k)
      rgb[i + 1] = Math.round(24 + 160 * k)
      rgb[i + 2] = Math.round(28 * (1 - k))
    }
  }
  await writePng(path, rgb, w, h)
}

/* ---- the capture ---------------------------------------------------------
   A CDP screencast, which hands back one PNG per composited frame at the
   rate the tier actually reaches. `page.screenshot` in a loop would hand
   back one frame per round trip, at a cadence the rig chose rather than the
   one the app runs at, and the static test is a question about the app's
   own frames. Every frame is acked, or the stream stops after two.        */
export async function screencast(page, client, want, ms = 12000) {
  const frames = []
  const times = []
  const onFrame = async (ev) => {
    if (frames.length < want) {
      frames.push(Buffer.from(ev.data, 'base64'))
      times.push(ev.metadata.timestamp * 1000)
    }
    try {
      await client.send('Page.screencastFrameAck', { sessionId: ev.sessionId })
    } catch {
      /* the cast was stopped while a frame was in flight */
    }
  }
  client.on('Page.screencastFrame', onFrame)
  await client.send('Page.startScreencast', { format: 'png', everyNthFrame: 1 })
  const until = Date.now() + ms
  while (frames.length < want && Date.now() < until) await page.waitForTimeout(30)
  await client.send('Page.stopScreencast')
  client.off('Page.screencastFrame', onFrame)
  return { frames, times }
}

/** two animation frames, so a shot that follows is a frame the app drew
    after the one before it and not the same composited surface twice */
export const nextFrames = (page) =>
  page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))))
  )

export function saveFrames(dir, frames) {
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  frames.forEach((f, i) => writeFileSync(join(dir, `f${String(i + 1).padStart(4, '0')}.png`), f))
}
