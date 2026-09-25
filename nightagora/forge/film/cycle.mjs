// THE MACHINE'S FILMED CYCLE (RENDER-GRAPH §8.2): one period of the machine
// from the whole view, drawn by the live island through the film's export
// service and encoded with a key frame at every step, so a pressed step lands
// exactly on its own frame. Each step also gets a thin outline of the part it
// names: the island drawn once with the step's light and once without, and the
// pixels the light changed are drawn round.
//
//   node forge/film/cycle.mjs --base=https://127.0.0.1:5551 --release=w6 --out=<release dir>
//     [--slug=aerial-screw] [--station=flight] [--framings=wide,upright] [--draws=8]
//
// The page is the film wing under the export's address; the island is opened
// and posed by `window.__naIsland`, a frame is drawn by `window.__naExport`
// (the shutter's jittered draws summed in linear light), and the frames leave
// by the sink into ffmpeg. The release's film.json gains `cycles[<id>]`.
import { chromium } from 'playwright'
import sharp from 'sharp'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { browserArgs, FRAME_TIME_FLAGS } from '../rig.mjs'
import { installVirtualClock } from '../prerender/clock.mjs'
import { openSink, unpack } from './sink.mjs'
import { MIN_DRAWS, SHUTTER, X264, RUNGS, jitterOf } from './export.mjs'

const FPS = 30
const flags = new Map(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
  const at = a.indexOf('=')
  return at < 0 ? [a.slice(2), true] : [a.slice(2, at), a.slice(at + 1)]
}))
const BASE = String(flags.get('base') ?? 'https://127.0.0.1:5551')
const RELEASE = String(flags.get('release') ?? 'w6')
const OUT = resolve(String(flags.get('out') ?? '.'))
const SLUG = String(flags.get('slug') ?? 'aerial-screw')
/** the station the machine stands in: the island is printed at its exposure */
const STATION = String(flags.get('station') ?? 'flight')
const FRAMINGS = String(flags.get('framings') ?? 'wide,upright').split(',')
const DRAWS = Number(flags.get('draws') ?? MIN_DRAWS)
/** a smoke run: this many frames, no release written */
const LIMIT = flags.has('limit') ? Number(flags.get('limit')) : null
/** THE FRAME IS THE ISLAND'S, WITH MARGINS. The machine is drawn in the fitting
    box the island has at the reference windows (1920×1080 and 390×844 CSS),
    centred on a larger stage, so the player can scale and centre the frame on
    any window's own fitting box and still cover the picture (cycle.ts, fit). */
const STAGE = { wide: { css: { width: 2112, height: 1240 }, dsf: 1, phone: false, fit: [1766, 736] },
  upright: { css: { width: 430, height: 1250 }, dsf: 2, phone: true, fit: [372, 421] } }
/** the outline: the island's own highlight colour, a ring this many device pixels wide */
const OUTLINE = { colour: [0xf2, 0xc7, 0x7a], ring: { wide: 2, upright: 3 }, threshold: 14 }
/** the step frames keep a finer quantiser: a paused step is looked at */
const STEP_CRF = 14

const sha256 = (data) => createHash('sha256').update(data).digest('hex')
const log = (s) => console.log(`[cycle ${new Date().toISOString().slice(11, 19)}] ${s}`)
const even = (n) => n - (n % 2)

/** a file under its content address, renamed only once whole */
function address(file, ext) {
  const bytes = readFileSync(file)
  const hash = sha256(bytes)
  const final = file.replace(/\.part\.[a-z0-9]+$/, `.${hash.slice(0, 16)}.${ext}`)
  renameSync(file, final)
  return { file: relative(OUT, final), bytes: bytes.length, sha256: hash }
}

/** the rungs of a framing whose master is w×h: the export's widths at the master's own aspect */
function rungsOf(framing, w, h) {
  return RUNGS[framing].map(([rw]) => [Math.min(rw, w), even(Math.round((Math.min(rw, w) * h) / w))])
}

/** one ffmpeg, one input, one mp4 per rung, a key frame and a finer quantiser at every step */
function openEncoder(framing, w, h, frames, stepFrames, dir) {
  const rungs = rungsOf(framing, w, h)
  const split = rungs.map((_, k) => `[s${k}]`).join('')
  const scales = rungs.map(([rw, rh], k) => `[s${k}]scale=${rw}:${rh}:flags=lanczos+accurate_rnd+full_chroma_int:out_color_matrix=bt709:out_range=tv,format=yuv420p[o${k}]`).join(';')
  const zones = stepFrames.map((f) => `${f},${f},crf=${STEP_CRF}`).join('/')
  const keys = `expr:${stepFrames.map((f) => `eq(n,${f})`).join('+')}`
  const outs = rungs.map(([rw, rh]) => {
    mkdirSync(join(dir, `${rw}x${rh}`), { recursive: true })
    return join(dir, `${rw}x${rh}`, 'cycle.part.mp4')
  })
  const args = ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${w}x${h}`, '-r', String(FPS), '-i', '-',
    '-filter_complex', `[0:v]split=${rungs.length}${split};${scales}`]
  rungs.forEach((_, k) => {
    args.push('-map', `[o${k}]`, '-c:v', 'libx264', '-preset', X264.preset, '-crf', String(X264.crf), '-profile:v', 'high',
      '-force_key_frames', keys,
      '-x264-params', `keyint=${X264.keyint}:min-keyint=1:scenecut=0:aq-mode=${X264.aq}:threads=${X264.threads}:colorprim=bt709:transfer=iec61966-2-1:colormatrix=bt709:zones=${zones}`,
      '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'iec61966-2-1', '-color_range', 'tv',
      '-an', '-movflags', '+faststart', outs[k])
  })
  const child = spawn('ffmpeg', args, { stdio: ['pipe', 'ignore', 'pipe'] })
  let err = ''
  child.stderr.on('data', (d) => { err += d })
  const done = new Promise((ok, fail) => child.on('close', (code) => (code === 0 ? ok() : fail(new Error(`ffmpeg ${code}: ${err.slice(0, 400)}`)))))
  return {
    rungs: rungs.map(([rw, rh], k) => ({ rung: `${rw}x${rh}`, file: outs[k] })),
    write: (buf) => new Promise((ok) => (child.stdin.write(buf) ? ok() : child.stdin.once('drain', ok))),
    close: async () => { child.stdin.end(); await done },
  }
}

/** where a key frame stands: ffprobe's own list of the picture types */
function keyFrames(file) {
  return new Promise((ok, fail) => {
    const child = spawn('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'frame=pict_type', '-of', 'csv=p=0', file], { stdio: ['ignore', 'pipe', 'pipe'] })
    let out = ''
    child.stdout.on('data', (d) => { out += d })
    child.on('close', (code) => (code === 0 ? ok(out.trim().split('\n').map((t, i) => (t.trim().startsWith('I') ? i : -1)).filter((i) => i >= 0)) : fail(new Error(`ffprobe ${code}`))))
  })
}

/** the inbox of frames the sink receives, awaited by tag and index */
function inboxOf() {
  const held = new Map(), waiting = new Map()
  return {
    take(buf) {
      const { head, parts } = unpack(buf)
      if (head.t !== 'frame') return
      const key = `${head.tag}#${head.i}`
      const frame = { head, rgb: parts[0] }
      const w = waiting.get(key)
      if (w) { waiting.delete(key); w(frame) } else held.set(key, frame)
    },
    next(tag, i) {
      const key = `${tag}#${i}`
      if (held.has(key)) { const f = held.get(key); held.delete(key); return Promise.resolve(f) }
      return new Promise((r) => waiting.set(key, r))
    },
  }
}

/** the rows of a delivered frame the master keeps: an odd height loses its last row */
function cropRows(rgb, w, h, keepH) {
  const bytes = Buffer.from(rgb.buffer, rgb.byteOffset, rgb.byteLength)
  return keepH === h ? bytes : bytes.subarray(0, w * keepH * 3)
}

/** THE OUTLINE of the part a step names: the pixels its light changed, cleaned of specks, drawn round */
function outlineOf(lit, dark, w, h, ring) {
  const n = w * h
  let mask = new Uint8Array(n)
  for (let p = 0, q = 0; p < n; p++, q += 3) {
    const d = Math.abs(lit[q] - dark[q]) + Math.abs(lit[q + 1] - dark[q + 1]) + Math.abs(lit[q + 2] - dark[q + 2])
    mask[p] = d > OUTLINE.threshold ? 1 : 0
  }
  const grow = (src, keep) => {
    // keep=1: a pixel stays set if every neighbour is set (erode); keep=0: if any is (dilate)
    const out = new Uint8Array(n)
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let any = 0, all = 1
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const yy = y + dy, xx = x + dx
        const v = yy < 0 || yy >= h || xx < 0 || xx >= w ? 0 : src[yy * w + xx]
        any |= v; all &= v
      }
      out[y * w + x] = keep ? all : any
    }
    return out
  }
  mask = grow(grow(mask, 1), 0)
  let outer = mask
  for (let r = 0; r < ring; r++) outer = grow(outer, 0)
  const rgba = Buffer.alloc(n * 4)
  let count = 0
  for (let p = 0; p < n; p++) {
    if (!outer[p] || mask[p]) continue
    rgba[p * 4] = OUTLINE.colour[0]; rgba[p * 4 + 1] = OUTLINE.colour[1]; rgba[p * 4 + 2] = OUTLINE.colour[2]; rgba[p * 4 + 3] = 235
    count++
  }
  return { rgba, count, area: mask.reduce((a, v) => a + v, 0) }
}

async function renderFraming(browser, framing, sink, inbox) {
  const stage = STAGE[framing]
  const ctx = await browser.newContext({ viewport: stage.css, deviceScaleFactor: stage.dsf, ignoreHTTPSErrors: true, locale: 'en-GB',
    ...(stage.phone ? { isMobile: true, hasTouch: true } : {}) })
  await ctx.addInitScript(() => { try { sessionStorage.setItem('vinci-welcome', '1'); localStorage.setItem('agc_probe', '1') } catch { /* seen */ } })
  await ctx.addInitScript(installVirtualClock)
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)))
  try {
    await page.goto(`${BASE}/w/vinci?film=${RELEASE}&order=life&probe=1&tier=max&export=1&pr=${stage.dsf}&lang=en#s=${STATION}`, { waitUntil: 'load', timeout: 120000 })
    await page.waitForFunction(() => document.querySelector('.na-film')?.dataset.state === 'rest' && Boolean(window.__naIsland && window.__naExport), null, { timeout: 120000, polling: 200 })
    const said = await page.evaluate(() => ({ backend: document.body.dataset.backend, tier: document.body.dataset.tier }))
    log(`${framing}: backend ${said.backend}, tier ${said.tier}`)
    await page.evaluate((slug) => window.__naIsland.open(slug), SLUG)
    await page.waitForFunction(() => window.__naIsland.readout()?.standing === true, null, { timeout: 120000, polling: 100 })
    await page.evaluate(([width, height]) => window.__naIsland.frame({ width, height }), stage.fit)
    await page.waitForTimeout(3000)
    const film = await page.evaluate(() => { const f = window.__naIsland.film(); return f ? { period: f.period, lands: [...f.lands] } : null })
    if (!film || !film.period) throw new Error('the island has no clock to film')
    await page.evaluate(() => window.__forge?.grain?.(false))
    await page.evaluate((fps) => window.__pre.arm(fps), FPS)
    await page.waitForFunction(() => window.__pre.queued() > 0, null, { timeout: 10000 })
    const canvas = await page.evaluate(() => {
      const all = [...document.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height)
      return all[0] ? [all[0].width, all[0].height] : null
    })
    // the stage the renderer draws is the picture's box, which the export names when asked for another
    const openAt = (size) => page.evaluate((o) => window.__naExport.open(o), { width: size[0], height: size[1], scale: 1, idDiv: 4, socket: sink.url })
    const opened = await openAt(canvas).catch(async (err) => {
      const named = /the canvas is (\d+)x(\d+)/.exec(String(err.message))
      if (!named) throw err
      return openAt([Number(named[1]), Number(named[2])])
    })
    const [w, h] = opened.canvas
    const mh = even(h), mw = even(w)
    if (mw !== w) throw new Error(`an odd canvas width ${w}`)
    const frames = Math.round(film.period * FPS)
    const stepFrames = film.lands.map((u) => Math.min(frames - 1, Math.round(u * film.period * FPS)))
    const drawn = LIMIT ? Math.min(frames, LIMIT) : frames
    log(`${framing}: canvas ${w}x${h}, master ${mw}x${mh}, ${frames} frames, steps at ${stepFrames.join(', ')}`)
    const dir = join(OUT, 'cycles', SLUG, framing)
    mkdirSync(dir, { recursive: true })
    const encoder = openEncoder(framing, mw, mh, drawn, stepFrames.filter((f) => f < drawn), dir)
    let t = await page.evaluate(() => window.__pre.virtualTime())
    const jitter = jitterOf(DRAWS)
    const draw = async (tag, i, clock, lit) => {
      await page.evaluate(([c, l]) => window.__naIsland.pose(c, { playing: false, lit: l }), [clock, lit])
      t += 1000 / FPS
      const times = Array.from({ length: DRAWS }, (_, k) => t + (k / DRAWS) * (SHUTTER * 1000) / FPS)
      const wait = inbox.next(tag, i)
      await page.evaluate((p) => window.__naExport.frame(p), { tag, i, times, jitter, anchor: DRAWS / 2, ids: false, send: true, grain: 0, seed: 0 })
      return cropRows((await wait).rgb, w, h, mh)
    }
    const held = new Map()
    const t0 = Date.now()
    for (let i = 0; i < drawn; i++) {
      const rgb = await draw(`cycle ${framing}`, i, i / FPS, false)
      await encoder.write(rgb)
      if (stepFrames.includes(i) || i === 0) held.set(i, Buffer.from(rgb))
      if (i % 30 === 29) log(`${framing}: ${i + 1}/${drawn} frames, ${((Date.now() - t0) / (i + 1) / 1000).toFixed(2)} s a frame`)
    }
    await encoder.close()
    const files = {}
    for (const r of encoder.rungs) files[r.rung] = address(r.file, 'mp4')
    const top = encoder.rungs[0].rung
    const keys = await keyFrames(join(OUT, files[top].file))
    const missed = stepFrames.filter((f) => f < drawn && !keys.includes(f))
    log(`${framing}: key frames at ${keys.join(', ')}${missed.length ? `; MISSING at ${missed.join(', ')}` : '; every step on a key frame'}`)
    const posterPart = join(dir, 'poster.part.webp')
    await sharp(held.get(0), { raw: { width: mw, height: mh, channels: 3 } }).webp({ quality: 88 }).toFile(posterPart)
    const poster = address(posterPart, 'webp')
    const steps = []
    for (const [k, f] of stepFrames.entries()) {
      if (f >= drawn) continue
      const dark = held.get(f)
      const lit = await draw(`lit ${framing}`, k, f / FPS, true)
      const again = await draw(`dark ${framing}`, k, f / FPS, false)
      const { rgba, count, area } = outlineOf(lit, again, mw, mh, OUTLINE.ring[framing])
      // the frame drawn again unlit must be the frame the clip carries: the recording is a function of its clock
      let drift = 0
      for (let q = 0; q < dark.length; q++) drift = Math.max(drift, Math.abs(dark[q] - again[q]))
      let outline = null
      if (count) {
        const part = join(dir, `step${k + 1}.part.webp`)
        await sharp(rgba, { raw: { width: mw, height: mh, channels: 4 } }).webp({ lossless: true }).toFile(part)
        outline = address(part, 'webp')
      }
      steps.push({ frame: f, outline })
      log(`${framing}: step ${k + 1} at frame ${f}: the part covers ${area} px, its outline ${count} px; the clip's frame redrawn differs by at most ${drift} of 255`)
    }
    await page.evaluate(() => window.__naExport.close())
    return { framing: { master: [mw, mh], dpr: stage.dsf, fit: stage.fit, files, poster, steps }, period: film.period, frames, errors, keys, missed }
  } finally {
    await ctx.close()
  }
}

const inbox = inboxOf()
const sink = await openSink((buf) => inbox.take(buf))
const browser = await chromium.launch({ args: [...browserArgs(), ...FRAME_TIME_FLAGS] })
const framings = {}
let period = 0, frames = 0
const report = { base: BASE, release: RELEASE, slug: SLUG, station: STATION, draws: DRAWS, shutter: SHUTTER, x264: { ...X264, stepCrf: STEP_CRF }, runs: {} }
try {
  for (const framing of FRAMINGS) {
    const t0 = Date.now()
    const r = await renderFraming(browser, framing, sink, inbox)
    framings[framing] = r.framing
    period = r.period; frames = r.frames
    report.runs[framing] = { seconds: Math.round((Date.now() - t0) / 1000), errors: r.errors, keys: r.keys, missed: r.missed }
    log(`${framing}: done in ${report.runs[framing].seconds} s, page errors ${r.errors.length}`)
  }
} finally {
  await browser.close()
  await sink.close()
}
const filmFile = join(OUT, 'film.json')
if (!LIMIT && existsSync(filmFile)) {
  const release = JSON.parse(readFileSync(filmFile, 'utf8'))
  release.cycles = { ...(release.cycles ?? {}), [`machine/${SLUG}`]: { period, fps: FPS, frames, framings: { ...(release.cycles?.[`machine/${SLUG}`]?.framings ?? {}), ...framings } } }
  writeFileSync(filmFile, `${JSON.stringify(release, null, 1)}\n`)
  log(`film.json: cycles['machine/${SLUG}'] written`)
}
writeFileSync(join(OUT, 'cycles', SLUG, 'report.json'), `${JSON.stringify({ ...report, framings }, null, 1)}\n`)
