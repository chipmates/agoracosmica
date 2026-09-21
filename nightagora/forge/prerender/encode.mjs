// THE ENCODES AND THE PLAYER FOLDER.
//
//   node forge/prerender/encode.mjs [--crf=18] [--alt=23] [--preset=medium]
//
// Reads what capture.mjs kept, writes the clips, the stills and the player
// into one static folder that needs no build step and no server of its own.
//
// H.264 and nothing else: it is the one codec every phone decodes in hardware
// (the newer codecs are exactly the ones the cheapest phones lack). Quality is
// asked for by CRF rather than by a rate, because the answer wanted here is
// what a slow glide through a static room COSTS at a quality that holds, and a
// fixed rate would decide that answer in advance. The measured rate of each
// encode is in the table.
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { createHash } from 'node:crypto'
import sharp from 'sharp'
import { APP_ROOT } from '../rig.mjs'

const flags = new Map()
for (const a of process.argv.slice(2)) {
  if (!a.startsWith('--')) continue
  const at = a.indexOf('=')
  flags.set(at === -1 ? a.slice(2) : a.slice(2, at), at === -1 ? true : a.slice(at + 1))
}
const flag = (n, d) => flags.get(n) ?? d
const CRF = Number(flag('crf', 18))
const ALT = Number(flag('alt', 23))
const PRESET = String(flag('preset', 'medium'))
const FPS = Number(flag('fps', 30))
const CAPTURES = String(flag('captures', resolve(APP_ROOT, '..', 'capture')))
const OUT = String(flag('out', resolve(APP_ROOT, '..', 'player')))
const SOURCE = resolve(APP_ROOT, 'forge', 'prerender', 'player')

/** the ladder per framing: the lines a phone or a desktop is served */
const LADDER = {
  landscape: [[1920, 1080], [1280, 720], [854, 480]],
  portrait: [[1080, 1920], [720, 1280], [480, 854]],
}

const mb = (n) => Math.round((n / 1024 / 1024) * 100) / 100
const sha = (f) => createHash('sha256').update(readFileSync(f)).digest('hex')
const ff = (args) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: ['ignore', 'pipe', 'pipe'] })

function encodeClip(dir, frames, width, height, crf, out) {
  ff([
    '-framerate', String(FPS),
    '-start_number', '0',
    '-i', join(dir, 'f%05d.png'),
    '-frames:v', String(frames),
    '-vf', `scale=${width}:${height}:flags=lanczos`,
    '-c:v', 'libx264',
    '-preset', PRESET,
    '-crf', String(crf),
    '-profile:v', 'high',
    '-level', '4.0',
    '-pix_fmt', 'yuv420p',
    /* one key frame a second: the player never seeks, but a lost first key
       frame on a poor line is the difference between a picture and a hole */
    '-g', String(FPS),
    '-an',
    '-movflags', '+faststart',
    out,
  ])
  return statSync(out).size
}

/** what the encode gave back, against the frames it was made from */
function psnr(dir, frames, width, height, clip) {
  const line = execFileSync(
    'ffmpeg',
    ['-hide_banner', '-loglevel', 'info', '-framerate', String(FPS), '-start_number', '0',
      '-i', join(dir, 'f%05d.png'), '-frames:v', String(frames), '-vf', `scale=${width}:${height}:flags=lanczos`,
      '-i', clip, '-lavfi', '[0:v][1:v]psnr', '-f', 'null', '-'],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  )
  const said = /PSNR.*average:([0-9.]+)/.exec(String(line)) ?? /average:([0-9.]+)/.exec(String(line))
  return said ? Number(said[1]) : null
}

/** how far the picture still travels after the walk has stopped */
async function settleDrift(a, b) {
  const A = await sharp(a).raw().toBuffer({ resolveWithObject: true })
  const B = await sharp(b).raw().toBuffer()
  let sum = 0
  let moved = 0
  for (let i = 0; i < A.data.length; i++) {
    const d = Math.abs(A.data[i] - B[i])
    if (d) {
      moved++
      sum += d
    }
  }
  return { share: Math.round((10000 * moved) / A.data.length) / 100, mean: Math.round((sum / (moved || 1)) * 100) / 100 }
}

if (existsSync(OUT)) rmSync(OUT, { recursive: true, force: true })
mkdirSync(join(OUT, 'media'), { recursive: true })
cpSync(SOURCE, OUT, { recursive: true })

const table = []
const media = { fps: FPS, framings: {} }
for (const framing of Object.keys(LADDER)) {
  const dir = join(CAPTURES, framing)
  if (!existsSync(join(dir, 'frames.json'))) {
    console.error(`no capture for ${framing}, skipped`)
    continue
  }
  const r = JSON.parse(readFileSync(join(dir, 'frames.json'), 'utf8'))
  const clipFrames = r.arrivedAt + 1
  const departure = join(dir, 'f00000.png')
  const arrival = join(dir, `f${String(r.arrivedAt).padStart(5, '0')}.png`)
  const settled = join(dir, `f${String(r.frames[r.frames.length - 1].i).padStart(5, '0')}.png`)
  const entry = { seconds: Math.round((clipFrames / FPS) * 100) / 100, frames: clipFrames, sizes: [], stills: {} }
  entry.stillIsLastFrame = sha(arrival) === r.frames[r.arrivedAt].sha
  entry.settleAfterArrival = await settleDrift(arrival, settled)

  for (const [w, h] of LADDER[framing]) {
    const lines = framing === 'landscape' ? h : w
    const name = `leg-${framing}-${lines}.mp4`
    const bytes = encodeClip(dir, clipFrames, w, h, CRF, join(OUT, 'media', name))
    const altName = `leg-${framing}-${lines}-crf${ALT}.mp4`
    const altBytes = encodeClip(dir, clipFrames, w, h, ALT, join(OUT, 'media', altName))
    const q = psnr(dir, clipFrames, w, h, join(OUT, 'media', name))
    entry.sizes.push({ lines, width: w, height: h, file: `media/${name}`, bytes, altBytes })
    table.push({
      framing, lines, w, h, seconds: entry.seconds,
      crf: CRF, MB: mb(bytes), kbps: Math.round((bytes * 8) / (clipFrames / FPS) / 1000), psnr: q,
      altCrf: ALT, altMB: mb(altBytes), altKbps: Math.round((altBytes * 8) / (clipFrames / FPS) / 1000),
    })
  }
  for (const [stop, src] of [['stop1', departure], ['stop2', arrival]]) {
    entry.stills[stop] = []
    for (const [w, h] of LADDER[framing]) {
      const lines = framing === 'landscape' ? h : w
      const webp = `${stop}-${framing}-${lines}.webp`
      await sharp(src).resize(w, h).webp({ quality: 88, effort: 6 }).toFile(join(OUT, 'media', webp))
      const png = `${stop}-${framing}-${lines}.png`
      await sharp(src).resize(w, h).png({ compressionLevel: 9 }).toFile(join(OUT, 'media', png))
      entry.stills[stop].push({
        lines, width: w, height: h,
        webp: `media/${webp}`, png: `media/${png}`,
        webpBytes: statSync(join(OUT, 'media', webp)).size,
        pngBytes: statSync(join(OUT, 'media', png)).size,
      })
    }
  }
  media.framings[framing] = entry
}

writeFileSync(join(OUT, 'media.json'), JSON.stringify(media, null, 1))
writeFileSync(join(OUT, 'encodes.json'), JSON.stringify(table, null, 1))

console.log(`\n== the encodes, H.264, preset ${PRESET} ==`)
console.log('  framing    lines  seconds   CRF      MB     kbit/s   PSNR dB      CRF      MB   kbit/s')
for (const t of table)
  console.log(
    `  ${t.framing.padEnd(10)} ${String(t.lines).padStart(4)}   ${String(t.seconds).padStart(6)}    ` +
    `${String(t.crf).padStart(2)}  ${String(t.MB).padStart(6)}   ${String(t.kbps).padStart(6)}   ${String(t.psnr ?? '?').padStart(7)}      ` +
    `${String(t.altCrf).padStart(2)}  ${String(t.altMB).padStart(6)}   ${String(t.altKbps).padStart(6)}`
  )
for (const [framing, e] of Object.entries(media.framings)) {
  console.log(`\n  ${framing}: ${e.frames} frames, ${e.seconds} s; the arrival still IS the clip's last frame: ${e.stillIsLastFrame}`)
  console.log(`  ${framing}: after the walk stops the picture still moves on ${e.settleAfterArrival.share}% of bytes, mean ${e.settleAfterArrival.mean} of 255`)
  for (const stop of ['stop1', 'stop2'])
    console.log(`  ${framing} ${stop} stills: ` + e.stills[stop].map((s) => `${s.lines} ${Math.round(s.webpBytes / 1024)} kB webp, ${Math.round(s.pngBytes / 1024)} kB png`).join(' | '))
}
console.log(`\n  player folder ${OUT}`)
