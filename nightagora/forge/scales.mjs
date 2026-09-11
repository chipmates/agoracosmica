// THE JUDGE'S OWN MEASURE — how much of a swatch plane lives at each scale.
//
// A material fails in one of two ways and they look alike from a distance:
// it can carry nothing (a plane of flat colour, which the empty-plane rule
// forbids), or it can carry the wrong thing (a seven centimetre mottle over
// a three millimetre weave, which is worse, because the plane is busy and
// the material is gone). One number cannot tell them apart. Three can.
//
// So this reads the two-metre plane out of each swatch frame and splits its
// variation into three bands by successive box means at the plane's own
// resolution:
//
//   coarse   above 30 cm   the macro: what the room-scale eye sees
//   mid      2 to 30 cm    the band that destroyed six sets in the first pass
//   fine     under 2 cm    the material's own tooth, the weave, the grain
//
// Energy is a standard deviation in display levels, and `rel` is that over
// the patch's own mean, because a dark wool and a white marble cannot be
// compared in levels. The dominant pitch is an autocorrelation of the row
// profile, in centimetres, which is what says whether a course is 6 cm or 9.
//
// Usage:  node forge/scales.mjs <folder> [--crop]
//         --crop  also write the patch it measured, to look at

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { deflateSync, inflateSync } from 'node:zlib'

const SHOTS = new URL('./shots/', import.meta.url).pathname
const folder = process.argv[2] ?? 'swatches-2'
const WRITE_CROP = process.argv.includes('--crop')

/* THE PATCH. The plane stands 2 m tall, turned -0.58 rad about Y, and this
   rectangle is inside it in every frame of the route: clear of its edges,
   clear of the evidence plate in the top right, and clear of the cube in
   front of it. The plane is vertical and turned only about Y, so a row of
   pixels is an unforeshortened metre and the vertical scale below is exact;
   the horizontal one is not, and no reading here uses it. */
const PATCH = { x: 912, y: 330, w: 266, h: 290 }
/** the plane's own resolution: 2 m of plane over the pixels it stands in */
const PX_PER_M = 221

const bands = [
  ['coarse', 0.3],
  ['mid', 0.02],
]

function boxMean(g, w, h, k) {
  if (k < 1) return g.slice()
  const sum = new Float64Array((w + 1) * (h + 1))
  for (let y = 0; y < h; y++) {
    let row = 0
    for (let x = 0; x < w; x++) {
      row += g[y * w + x]
      sum[(y + 1) * (w + 1) + x + 1] = sum[y * (w + 1) + x + 1] + row
    }
  }
  const out = new Float64Array(w * h)
  const r = Math.floor(k / 2)
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r)
    const y1 = Math.min(h, y + r + 1)
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r)
      const x1 = Math.min(w, x + r + 1)
      const s =
        sum[y1 * (w + 1) + x1] - sum[y0 * (w + 1) + x1] - sum[y1 * (w + 1) + x0] + sum[y0 * (w + 1) + x0]
      out[y * w + x] = s / ((y1 - y0) * (x1 - x0))
    }
  }
  return out
}

function sd(a) {
  let m = 0
  for (const v of a) m += v
  m /= a.length
  let s = 0
  for (const v of a) s += (v - m) * (v - m)
  return Math.sqrt(s / a.length)
}

/** the strongest repeat in the row profile, in centimetres, and how strong */
function pitch(g, w, h) {
  const prof = new Float64Array(h)
  for (let y = 0; y < h; y++) {
    let s = 0
    for (let x = 0; x < w; x++) s += g[y * w + x]
    prof[y] = s / w
  }
  let m = 0
  for (const v of prof) m += v
  m /= h
  let e0 = 0
  for (const v of prof) e0 += (v - m) * (v - m)
  if (e0 < 1e-6) return null
  /* the autocorrelation is 1 at zero lag and falls from there, so the first
     peak is meaningless: the reading is the strongest LOCAL maximum after the
     curve has first come down through zero, which is where a repeat lives */
  const ac = new Float64Array(Math.floor(h / 3))
  for (let lag = 0; lag < ac.length; lag++) {
    let s = 0
    for (let y = 0; y + lag < h; y++) s += (prof[y] - m) * (prof[y + lag] - m)
    ac[lag] = s / e0
  }
  let start = 2
  while (start < ac.length && ac[start] > 0) start++
  let best = null
  for (let lag = start + 1; lag < ac.length - 1; lag++) {
    if (ac[lag] > ac[lag - 1] && ac[lag] >= ac[lag + 1] && ac[lag] > 0.2) {
      if (best === null || ac[lag] > best.r) best = { lag, r: ac[lag] }
    }
  }
  return best ? { cm: (best.lag / PX_PER_M) * 100, r: best.r } : null
}

const files = readdirSync(`${SHOTS}${folder}`)
  .filter((f) => f.endsWith('.png') && f.includes('-swatch-') && !f.includes('-sky-'))
  .sort()
if (!files.length) {
  console.error(`no swatch frames in forge/shots/${folder}/`)
  process.exit(1)
}
if (WRITE_CROP) mkdirSync(`${SHOTS}${folder}/patches`, { recursive: true })

console.log(
  `the plane at ${PX_PER_M} px per metre, patch ${PATCH.w} by ${PATCH.h} px ` +
    `(${(PATCH.w / PX_PER_M).toFixed(2)} by ${(PATCH.h / PX_PER_M).toFixed(2)} m)\n`
)
console.log(
  `${'set'.padEnd(18)} ${'mean'.padStart(6)} ${'coarse'.padStart(7)} ${'mid'.padStart(6)} ` +
    `${'fine'.padStart(6)} ${'rel %'.padStart(6)}  pitch`
)
for (const file of files) {
  const name = file.replace(/^.*-swatch-/, '').replace(/\.png$/, '')
  const img = readPNG(`${SHOTS}${folder}/${file}`)
  const w = PATCH.w
  const h = PATCH.h
  const g = new Float64Array(w * h)
  const rgb = Buffer.alloc(w * h * 3)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const s = ((y + PATCH.y) * img.width + x + PATCH.x) * 3
      const d = (y * w + x) * 3
      rgb[d] = img.rgb[s]
      rgb[d + 1] = img.rgb[s + 1]
      rgb[d + 2] = img.rgb[s + 2]
      g[y * w + x] = img.grey[(y + PATCH.y) * img.width + x + PATCH.x]
    }
  }
  let mean = 0
  for (const v of g) mean += v
  mean /= g.length
  // successive box means: what survives a 30 cm box is coarse, what a 30 cm
  // box removed and a 2 cm box kept is mid, and the rest is fine
  const levels = bands.map(([, m]) => boxMean(g, w, h, Math.max(1, Math.round(m * PX_PER_M))))
  const coarse = sd(levels[0])
  const mid = sd(levels[1].map((v, i) => v - levels[0][i]))
  const fine = sd(g.map((v, i) => v - levels[1][i]))
  const total = sd(g)
  const p = pitch(g, w, h)
  console.log(
    `${name.padEnd(18)} ${mean.toFixed(1).padStart(6)} ${coarse.toFixed(2).padStart(7)} ` +
      `${mid.toFixed(2).padStart(6)} ${fine.toFixed(2).padStart(6)} ` +
      `${((total / Math.max(1, mean)) * 100).toFixed(1).padStart(6)}  ` +
      (p ? `${p.cm.toFixed(1)} cm (${p.r.toFixed(2)})` : 'none')
  )
  if (WRITE_CROP) writeFileSync(`${SHOTS}${folder}/patches/${name}.png`, encodePNG(rgb, w, h))
}

/* ── PNG, read and written without a dependency ─────────────────────────── */

function readPNG(path) {
  const buf = readFileSync(path)
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error(`${path} is not a PNG`)
  let off = 8
  let width = 0
  let height = 0
  let type = 0
  const idat = []
  while (off < buf.length) {
    const len = buf.readUInt32BE(off)
    const tag = buf.toString('ascii', off + 4, off + 8)
    const body = buf.subarray(off + 8, off + 8 + len)
    if (tag === 'IHDR') {
      width = body.readUInt32BE(0)
      height = body.readUInt32BE(4)
      type = body[9]
      if (body[8] !== 8 || (type !== 2 && type !== 6) || body[12] !== 0)
        throw new Error(`${path}: only 8-bit RGB or RGBA, uninterlaced`)
    } else if (tag === 'IDAT') idat.push(body)
    else if (tag === 'IEND') break
    off += 12 + len
  }
  const ch = type === 6 ? 4 : 3
  const raw = inflateSync(Buffer.concat(idat))
  const rgb = Buffer.alloc(width * height * 3)
  const grey = new Float64Array(width * height)
  const stride = width * ch
  const line = Buffer.alloc(stride)
  const prev = Buffer.alloc(stride)
  let p = 0
  for (let y = 0; y < height; y++) {
    const filter = raw[p++]
    raw.copy(line, 0, p, p + stride)
    p += stride
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? line[i - ch] : 0
      const b = prev[i]
      const c = i >= ch ? prev[i - ch] : 0
      let v = line[i]
      if (filter === 1) v += a
      else if (filter === 2) v += b
      else if (filter === 3) v += (a + b) >> 1
      else if (filter === 4) {
        const pp = a + b - c
        const pa = Math.abs(pp - a)
        const pb = Math.abs(pp - b)
        const pc = Math.abs(pp - c)
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      }
      line[i] = v & 255
    }
    for (let x = 0; x < width; x++) {
      const s = x * ch
      const d = (y * width + x) * 3
      rgb[d] = line[s]
      rgb[d + 1] = line[s + 1]
      rgb[d + 2] = line[s + 2]
      grey[y * width + x] = (line[s] + line[s + 1] + line[s + 2]) / 3
    }
    line.copy(prev)
  }
  return { width, height, rgb, grey }
}

function encodePNG(rgb, width, height) {
  const raw = Buffer.alloc((width * 3 + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (width * 3 + 1)] = 0
    rgb.copy(raw, y * (width * 3 + 1) + 1, y * width * 3, (y + 1) * width * 3)
  }
  const chunk = (tag, body) => {
    const out = Buffer.alloc(body.length + 12)
    out.writeUInt32BE(body.length, 0)
    out.write(tag, 4, 'ascii')
    body.copy(out, 8)
    out.writeInt32BE(crc32(out.subarray(4, 8 + body.length)), 8 + body.length)
    return out
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/* the table is built on the first call rather than at module scope: every
   reading above runs at the top level, before a const down here exists */
function crcTable() {
  if (!crcTable.t) {
    const t = new Int32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      t[n] = c
    }
    crcTable.t = t
  }
  return crcTable.t
}
function crc32(buf) {
  const t = crcTable()
  let c = -1
  for (const b of buf) c = t[(c ^ b) & 255] ^ (c >>> 8)
  return c ^ -1
}
