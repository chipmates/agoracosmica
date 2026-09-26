// THE SAMPLED JOINS (the gate's `sampled joins` line): ten ends of rendered
// clips decoded in Chromium, WebKit and Firefox, each against its still passed
// through the ends' own encoder as a one-frame clip, both decoded by the same
// engine at the top rung.
//
//   node forge/film/sampled-joins.mjs --export=<job dir> [--engines=chromium,webkit,firefox]
//
// THE STATISTIC. Two encodes of one picture never agree pixel for pixel: the
// clip's end is quantized inside a stream (its macroblock tree, its frame
// type) and the one-frame clip alone, so on the pilot the two differ by up to
// 11 to 36 of 255 even in the codec's own luma plane, and 4:2:0 adds its
// chroma edges on top. Both live inside the codec's macroblock. So each 16 by
// 16 block is averaged in both pictures and the difference of the block means
// is read in Y', Cb and Cr (BT.709): the largest of the three is the join's.
// The pilot's 16 ends read 0.4 to 1.2 of 255 that way; a wrong picture, a
// shift of colour or light, or a frame out of place moves a block by far more.
import { chromium, firefox, webkit } from 'playwright'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import sharp from 'sharp'
import { ENGINES, JOIN_TOLERANCE, SAMPLED_JOINS, SAMPLED_STATISTIC } from './film-check.mjs'
import { RUNGS, STAGES, openEncoder } from './export.mjs'

/** the codec's macroblock, in delivered pixels */
export const BLOCK = 16
const LAUNCH = { chromium, webkit, firefox }

/**
 * THE JOIN'S STATISTIC over two RGBA pictures of one size: every 16 by 16 block
 * (the last row and column of blocks as far as the picture reaches) averaged
 * in both, the difference of the means in Y', Cb and Cr, the largest of each.
 */
export function blockDelta(a, b, width, height, block = BLOCK) {
  let y = 0, cb = 0, cr = 0
  for (let by = 0; by < height; by += block) for (let bx = 0; bx < width; bx += block) {
    let dr = 0, dg = 0, db = 0, n = 0
    for (let yy = by; yy < Math.min(height, by + block); yy++) for (let xx = bx; xx < Math.min(width, bx + block); xx++) {
      const k = (yy * width + xx) * 4
      dr += a[k] - b[k]; dg += a[k + 1] - b[k + 1]; db += a[k + 2] - b[k + 2]; n++
    }
    dr /= n; dg /= n; db /= n
    const dy = 0.2126 * dr + 0.7152 * dg + 0.0722 * db
    y = Math.max(y, Math.abs(dy)); cb = Math.max(cb, Math.abs((db - dy) / 1.8556)); cr = Math.max(cr, Math.abs((dr - dy) / 1.5748))
  }
  const r2 = (v) => Math.round(v * 100) / 100
  return { maxDelta: r2(Math.max(y, cb, cr)), y: r2(y), cb: r2(cb), cr: r2(cr) }
}

/** TEN ENDS, spread over the rendered clips in a fixed order, one end a clip, the ends taken in turn */
export function pickSampled(clips, n = SAMPLED_JOINS) {
  const sorted = [...clips].sort((a, b) => (`${a.clip} ${a.framing}` < `${b.clip} ${b.framing}` ? -1 : 1))
  if (sorted.length * 2 <= n) return sorted.flatMap((c) => [{ ...c, end: 'first' }, { ...c, end: 'last' }])
  // fewer clips than ends: every clip once with its ends alternating, then again from the start with the other end
  if (sorted.length < n) return Array.from({ length: n }, (_, k) => ({ ...sorted[k % sorted.length], end: ((k % sorted.length) + Math.floor(k / sorted.length)) % 2 ? 'last' : 'first' }))
  return Array.from({ length: n }, (_, k) => ({ ...sorted[Math.floor((k * sorted.length) / n)], end: k % 2 ? 'last' : 'first' }))
}

/** the still's master as a one-frame clip, the top rung of its framing */
async function stillAsClip(master, framing, dir) {
  const stage = STAGES[framing]
  const { data, info } = await sharp(master).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  if (info.width !== stage.width || info.height !== stage.height) throw new Error(`${master}: ${info.width}x${info.height}, the stage is ${stage.width}x${stage.height}`)
  const stem = master.split('/').pop().replace(/\.png$/, '')
  const enc = openEncoder(framing, 1, dir, stem, stage)
  await enc.write(data)
  await enc.close()
  const [w, h] = RUNGS[framing][0]
  return enc.rungs.find((r) => r.rung === `${w}x${h}`).file
}

/** both pictures decoded by one engine at the rung's own size, the statistic read in the page */
async function decodeIn(page, clipFile, index, stillClip, width, height) {
  const b64 = (f) => readFileSync(f).toString('base64')
  return page.evaluate(async ({ clip, still, last, width, height, block, statistic }) => {
    const blob = (s) => URL.createObjectURL(new Blob([Uint8Array.from(atob(s), (c) => c.charCodeAt(0))], { type: 'video/mp4' }))
    const frame = async (src, atEnd) => {
      const video = document.createElement('video')
      video.muted = true; video.playsInline = true; video.preload = 'auto'; video.src = src
      await new Promise((ok, fail) => { video.onloadeddata = ok; video.onerror = () => fail(new Error('the engine cannot decode the clip')) })
      const seek = (t) => new Promise((ok) => { video.onseeked = () => requestAnimationFrame(() => requestAnimationFrame(() => ok())); video.currentTime = t })
      await seek(atEnd ? Math.max(0, video.duration - 0.001) : 0)
      const c = document.createElement('canvas'); c.width = width; c.height = height
      const g = c.getContext('2d', { willReadFrequently: true })
      g.drawImage(video, 0, 0, width, height)
      return { data: g.getImageData(0, 0, width, height).data, size: [video.videoWidth, video.videoHeight] }
    }
    const a = await frame(blob(clip), last), b = await frame(blob(still), false)
    let pixelMax = 0
    for (let k = 0; k < a.data.length; k += 4) for (let ch = 0; ch < 3; ch++) pixelMax = Math.max(pixelMax, Math.abs(a.data[k + ch] - b.data[k + ch]))
    // the statistic is the module's own function, carried into the page as text
    const delta = (0, eval)(`(${statistic})`)
    return { ...delta(a.data, b.data, width, height, block), pixelMax, sizes: [a.size, b.size] }
  }, { clip: b64(clipFile), still: b64(stillClip), last: index > 0, width, height, block: BLOCK, statistic: blockDelta.toString() })
}

/**
 * THE SAMPLED JOINS OF AN EXPORT RUN OR A JOB: its `export.json` names the
 * clips and the stills' masters, its `release.json` the files the gate holds.
 * Returns the release's `sampledJoins`; an engine this Mac does not carry is
 * recorded as not decoded, and the gate reads it red.
 */
export async function sampledJoins(dir, { engines = ENGINES, log = () => {} } = {}) {
  const summary = JSON.parse(readFileSync(join(dir, 'export.json'), 'utf8'))
  const release = existsSync(join(dir, 'release.json')) ? JSON.parse(readFileSync(join(dir, 'release.json'), 'utf8')) : null
  const rendered = (release?.clips ?? summary.clips).filter((c) => c.files)
  const picks = pickSampled(rendered.map((c) => ({ clip: c.clip, framing: c.framing, frames: c.frames, files: c.files })))
  const work = join(dir, 'sampled')
  mkdirSync(work, { recursive: true })
  const out = []
  const browsers = {}
  try {
    for (const engine of engines) {
      try { browsers[engine] = await LAUNCH[engine].launch() } catch (err) { browsers[engine] = { missing: String(err.message ?? err).split('\n')[0].slice(0, 160) } }
    }
    for (const p of picks) {
      const [w, h] = RUNGS[p.framing][0]
      const rung = p.files[`${w}x${h}`]
      const clipFile = resolve(dir, rung.file)
      const [from, to] = p.clip.split('>')
      const node = p.end === 'first' ? from : to
      const still = summary.stills.find((s) => s.node === node && s.framing === p.framing)
      const sample = { clip: p.clip, framing: p.framing, end: p.end, statistic: SAMPLED_STATISTIC, file: rung.sha256, still: still?.raw ?? null, engines: {} }
      if (!still?.master?.file) { for (const e of engines) sample.engines[e] = { decoded: false, why: `no master still of ${node}` }; out.push(sample); continue }
      const stillClip = await stillAsClip(resolve(dir, still.master.file), p.framing, work)
      for (const engine of engines) {
        const b = browsers[engine]
        if (b.missing) { sample.engines[engine] = { decoded: false, why: `the engine is not installed: ${b.missing}` }; continue }
        const ctx = await b.newContext()
        const page = await ctx.newPage()
        try {
          const r = await decodeIn(page, clipFile, p.end === 'last' ? p.frames - 1 : 0, stillClip, w, h)
          sample.engines[engine] = { ...r, colour: true }
        } catch (err) {
          sample.engines[engine] = { decoded: false, why: String(err.message ?? err).slice(0, 160) }
        } finally { await ctx.close() }
      }
      rmSync(stillClip, { force: true })
      out.push(sample)
      log(`  ${p.clip} ${p.framing} ${p.end}: ${engines.map((e) => `${e} ${sample.engines[e].maxDelta ?? 'not decoded'}`).join(', ')}`)
    }
  } finally {
    for (const b of Object.values(browsers)) if (b.close) await b.close().catch(() => {})
  }
  return out
}

/** the job's record of its sampled joins, beside its marks; `release.json` carries them at once */
export function writeSampled(dir, samples) {
  writeFileSync(join(dir, 'sampled-joins.json'), JSON.stringify({ format: 'vinci-film-sampled-joins-v1', statistic: SAMPLED_STATISTIC, tolerance: JOIN_TOLERANCE, samples }, null, 1))
  const file = join(dir, 'release.json')
  if (!existsSync(file)) return
  const release = JSON.parse(readFileSync(file, 'utf8'))
  release.sampledJoins = samples
  writeFileSync(`${file}.part`, JSON.stringify(release, null, 1))
  writeFileSync(file, readFileSync(`${file}.part`))
  rmSync(`${file}.part`, { force: true })
}

async function main() {
  const flags = new Map(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
    const at = a.indexOf('=')
    return at < 0 ? [a.slice(2), true] : [a.slice(2, at), a.slice(at + 1)]
  }))
  const dir = resolve(String(flags.get('export') ?? ''))
  const engines = String(flags.get('engines') ?? ENGINES.join(',')).split(',').filter(Boolean)
  const samples = await sampledJoins(dir, { engines, log: (s) => console.log(s) })
  writeSampled(dir, samples)
  console.log(`${samples.length} sampled joins written to ${join(dir, 'sampled-joins.json')}`)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main()
