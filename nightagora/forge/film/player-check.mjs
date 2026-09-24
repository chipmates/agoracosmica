// THE PLAYER OVER THE SEAM, WALKED: the film wing opened in the three engines
// at every width and language asked for, the test's walk pressed the way a
// hand presses it, a frame kept at every state, the picture's share of the
// stage measured, and the joins read inside each engine: the still against
// the clip's first frame, the clip's last frame against the arrival's still.
//
//   node forge/film/player-check.mjs --base=https://127.0.0.1:5515 --release=w5 --out=<dir>
//     [--engines=chromium,webkit,firefox] [--widths=360,390,430,1440,1512] [--langs=en,de]
//     [--walk=full|short|none] [--joins] [--record]
//
// It shoots a running server and starts none. A state that never takes is
// written down as such and the walk goes on.
import { chromium, firefox, webkit } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import sharp from 'sharp'
import { browserArgs } from '../rig.mjs'

const flags = new Map(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
  const at = a.indexOf('=')
  return at < 0 ? [a.slice(2), true] : [a.slice(2, at), a.slice(at + 1)]
}))
const BASE = String(flags.get('base') ?? 'https://127.0.0.1:5515')
const RELEASE = String(flags.get('release') ?? 'w5')
const OUT = resolve(String(flags.get('out') ?? 'player-frames'))
const ENGINES = String(flags.get('engines') ?? 'chromium,webkit,firefox').split(',')
const WIDTHS = String(flags.get('widths') ?? '360,390,430,1440,1512').split(',').map(Number)
const LANGS = String(flags.get('langs') ?? 'en,de').split(',')
const WALK = String(flags.get('walk') ?? 'full')
const JOINS = flags.has('joins')
const RECORD = flags.has('record')
const HEIGHT = { 360: 800, 390: 844, 430: 932, 1440: 900, 1512: 950, 1280: 800, 1920: 1080 }
const TYPES = { chromium, webkit, firefox }
const FIRST = String(flags.get('at') ?? 'picture-room-lisa')

const report = { base: BASE, release: RELEASE, runs: [] }
mkdirSync(OUT, { recursive: true })

/* ---- in the page ---- */
/** the picture's share of the stage, and what stands on it */
function numbers() {
  const film = document.querySelector('.na-film')
  const stage = { width: innerWidth, height: innerHeight }
  const box = film ? film.getBoundingClientRect() : null
  const covers = []
  const sel = ['.desk-low', '.film-box > .film-name', '.film-box > .film-line', '.film-box > .film-drawer', '.film-box > .film-keys',
    '.film-back', '.film-book', '.film-gold', '.film-foot', '.vitrine-card', '.vinci-dock[open]', '.vinci-cut[data-on]', '.desk-drawer']
  for (const s of sel) for (const el of document.querySelectorAll(s)) {
    const cs = getComputedStyle(el)
    if (el.hidden || cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.05) continue
    const r = el.getBoundingClientRect()
    if (r.width < 1 || r.height < 1) continue
    covers.push({ s, left: r.left, top: r.top, right: r.right, bottom: r.bottom })
  }
  // the covered share of the stage, counted on a 4 px grid
  let covered = 0, total = 0
  for (let y = 2; y < stage.height; y += 4) for (let x = 2; x < stage.width; x += 4) {
    total++
    const inPicture = box && x >= box.left && x < box.right && y >= box.top && y < box.bottom
    const over = covers.some((c) => x >= c.left && x < c.right && y >= c.top && y < c.bottom)
    if (!inPicture || over) covered++
  }
  const marks = [...document.querySelectorAll('.film-dot')].filter((d) => getComputedStyle(d).opacity !== '0' && !d.hidden).map((d) => d.dataset.exhibit)
  const words = [...document.querySelectorAll('.desk-line, .film-line')].map((el) => el.textContent).filter(Boolean)
  const lineRows = [...document.querySelectorAll('.desk-line, .film-line')].map((el) => Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight || '29')))
  return {
    stage, box: box ? { top: Math.round(box.top), height: Math.round(box.height), width: Math.round(box.width) } : null,
    pictureShare: Math.round((1 - covered / total) * 1000) / 10,
    state: document.querySelector('.na-film')?.dataset.state ?? null,
    marks, words, lineRows,
    band: Math.round(document.querySelector('.desk-low')?.getBoundingClientRect().height ?? 0),
    box2: document.querySelector('.film-box') ? Math.round(document.querySelector('.film-box').getBoundingClientRect().height) : 0,
    textMin: Math.min(...[...document.querySelectorAll('.desk-low *, .film-box *')].filter((el) => el.childNodes.length && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())).map((el) => parseFloat(getComputedStyle(el).fontSize)), 99),
  }
}

/** THE JOINS AS THE ENGINE DECODES THEM: the still and the clip's first frame,
    the clip's last frame and the arrival's still, drawn into one canvas each
    and compared in 8-bit, with the strips kept */
async function joinsIn(clipUrl, fromStill, toStill, width, height) {
  const load = (src) => new Promise((ok, fail) => { const i = new Image(); i.onload = () => ok(i); i.onerror = fail; i.src = src })
  const draw = (source) => {
    const c = document.createElement('canvas')
    c.width = width; c.height = height
    const g = c.getContext('2d', { willReadFrequently: true })
    g.drawImage(source, 0, 0, width, height)
    return { c, data: g.getImageData(0, 0, width, height).data }
  }
  const video = document.createElement('video')
  video.muted = true; video.playsInline = true; video.preload = 'auto'
  video.src = clipUrl
  await new Promise((ok, fail) => { video.onloadeddata = ok; video.onerror = () => fail(new Error('video')) })
  const seek = (t) => new Promise((ok) => { video.onseeked = () => requestAnimationFrame(() => ok()); video.currentTime = t })
  await seek(0)
  const first = draw(video)
  await seek(Math.max(0, video.duration - 0.001))
  const last = draw(video)
  const [a, b] = await Promise.all([load(fromStill), load(toStill)])
  const sa = draw(a), sb = draw(b)
  const compare = (x, y) => {
    let sum = 0, max = 0, over2 = 0
    for (let k = 0; k < x.data.length; k += 4) for (let ch = 0; ch < 3; ch++) {
      const d = Math.abs(x.data[k + ch] - y.data[k + ch]); sum += d; if (d > max) max = d; if (d > 8) over2++
    }
    const n = (x.data.length / 4) * 3
    return { mean: Math.round((sum / n) * 100) / 100, max, over8: Math.round((over2 / n) * 10000) / 100 }
  }
  const strip = (x, y) => {
    const c = document.createElement('canvas'); c.width = width * 3; c.height = height
    const g = c.getContext('2d'); g.drawImage(x.c, 0, 0); g.drawImage(y.c, width, 0)
    const d = g.createImageData(width, height)
    for (let k = 0; k < x.data.length; k += 4) for (let ch = 0; ch < 3; ch++) d.data[k + ch] = Math.min(255, Math.abs(x.data[k + ch] - y.data[k + ch]) * 8)
    for (let k = 3; k < d.data.length; k += 4) d.data[k] = 255
    g.putImageData(d, width * 2, 0)
    return c.toDataURL('image/png')
  }
  return { duration: video.duration, start: compare(sa, first), end: compare(last, sb), startStrip: strip(sa, first), endStrip: strip(last, sb) }
}

/* ---- the harness ---- */
async function waitState(page, state, ms = 60000) {
  return page.waitForFunction((s) => document.querySelector('.na-film')?.dataset.state === s, state, { timeout: ms, polling: 50 }).then(() => true).catch(() => false)
}
async function shot(page, dir, name) {
  const file = join(dir, `${name}.png`)
  await page.screenshot({ path: file, timeout: 30000 }).catch(() => null)
  const n = await page.evaluate(numbers).catch((e) => ({ error: String(e) }))
  return { name, file, ...n }
}
async function press(page, selector) {
  const el = await page.$(selector)
  if (!el) return false
  await el.click({ timeout: 8000 }).catch(() => el.evaluate((e) => e.click()))
  return true
}
/** frames of what the visitor sees across a hand-over, as fast as the engine shoots */
async function burst(page, dir, name, count, clip) {
  const out = []
  for (let i = 0; i < count; i++) {
    const t = Date.now()
    const buf = await page.screenshot({ clip, timeout: 10000 }).catch(() => null)
    if (!buf) continue
    out.push({ at: t, buf, state: await page.evaluate(() => document.querySelector('.na-film')?.dataset.state ?? '') })
  }
  if (!out.length) return null
  // each frame's mean light and the largest step between two in a row: a flash or a jump is a number
  const means = await Promise.all(out.map(async (o) => { const st = await sharp(o.buf).stats(); return Math.round(((st.channels[0].mean + st.channels[1].mean + st.channels[2].mean) / 3) * 100) / 100 }))
  let step = 0
  for (let k = 1; k < means.length; k++) step = Math.max(step, Math.abs(means[k] - means[k - 1]))
  const w = Math.round(clip.width / 2), h = Math.round(clip.height / 2)
  const tiles = await Promise.all(out.map((o) => sharp(o.buf).resize(w, h).png().toBuffer()))
  const sheet = sharp({ create: { width: w * Math.min(8, tiles.length), height: h * Math.ceil(tiles.length / 8), channels: 3, background: '#000' } })
    .composite(tiles.map((input, i) => ({ input, left: (i % 8) * w, top: Math.floor(i / 8) * h })))
  const file = join(dir, `${name}-strip.png`)
  await sheet.png().toFile(file)
  return { file, frames: out.length, states: out.map((o) => o.state).join(' '), means, largestStep: Math.round(step * 100) / 100, ms: out.length > 1 ? Math.round((out.at(-1).at - out[0].at) / (out.length - 1)) : 0 }
}

async function readJoins(page, dir, phone, record) {
  {
      const joins = await page.evaluate(async () => {
        const film = await (await fetch(new URL('film.json', new URL(`/film/${new URLSearchParams(location.search).get('film')}/`, location.origin)).href)).json()
        return film
      })
      record.joins = []
      // the join reader is handed into the page as its own source
      await page.evaluate(`window.joinsIn = ${joinsIn.toString()}`)
      const framing = phone ? 'upright' : 'wide'
      for (const e of joins.edges) {
        const f = e.framings[framing]
        if (!f) continue
        const rung = Object.keys(f.files)[0]
        const [w, h] = rung.split('x').map(Number)
        const base = `${BASE}/film/${RELEASE}/`
        const from = joins.nodes[e.from]?.stills[framing]?.[rung], to = joins.nodes[e.to]?.stills[framing]?.[rung]
        if (!from || !to) continue
        const got = await page.evaluate(([c, a, b, W, H]) => window.joinsIn(c, a, b, W, H).catch((err) => ({ error: String(err) })),
          [base + f.files[rung].file, base + from.file, base + to.file, w, h]).catch((err) => ({ error: String(err).slice(0, 200) }))
        if (got.startStrip) {
          for (const [k, url] of [['start', got.startStrip], ['end', got.endStrip]]) {
            await sharp(Buffer.from(url.split(',')[1], 'base64')).resize({ width: Math.min(1800, w * 3) }).png().toFile(join(dir, `join-${e.id.replace(/[:/>]/g, '_')}-${k}.png`))
          }
          delete got.startStrip; delete got.endStrip
        }
        record.joins.push({ clip: e.id, rung, ...got })
      }
    }
}

async function run(engine, width, lang) {
  const height = HEIGHT[width] ?? Math.round(width * 1.8)
  const phone = width < 700
  const dir = join(OUT, engine, `${width}-${lang}`)
  mkdirSync(dir, { recursive: true })
  const browser = await TYPES[engine].launch(engine === 'chromium' ? { args: browserArgs() } : {})
  const ctxOptions = { viewport: { width, height }, deviceScaleFactor: phone ? 2 : 1, ignoreHTTPSErrors: true, locale: lang === 'de' ? 'de-DE' : 'en-GB',
    ...(phone && engine !== 'firefox' ? { isMobile: true, hasTouch: true } : {}),
    ...(RECORD ? { recordVideo: { dir, size: { width: Math.min(width, 960), height: Math.round(Math.min(width, 960) * height / width) } } } : {}) }
  const ctx = await browser.newContext(ctxOptions)
  await ctx.addInitScript(() => { try { sessionStorage.setItem('vinci-welcome', '1'); localStorage.setItem('agc_probe', '1') } catch { /* seen */ } })
  const page = await ctx.newPage()
  const errors = [], requests = []
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text().slice(0, 200)}`) })
  page.on('request', (r) => { if (r.url().includes('/film/')) requests.push({ url: r.url().replace(/^.*\/film\//, ''), range: r.headers().range ?? null, t: Date.now() }) })
  const t0 = Date.now()
  const shots = []
  const record = { engine, width, lang, errors, shots, requests }
  try {
    await page.goto(`${BASE}/w/vinci?film=${RELEASE}&order=life&probe=1&lang=${lang}#s=${FIRST}`, { waitUntil: 'load', timeout: 120000 })
    const stood = await page.waitForFunction(() => {
      const still = document.querySelector('.na-film-still')
      const gold = document.getElementById('goldbreath')
      return still && still.complete && still.naturalWidth > 0 && (!gold || !gold.classList.contains('lit'))
    }, null, { timeout: 120000, polling: 100 }).then(() => true).catch(() => false)
    record.firstPicture = (Date.now() - t0) / 1000
    record.bytesToFirstPicture = await page.evaluate(() => performance.getEntriesByType('resource').reduce((s, r) => s + (r.transferSize || r.encodedBodySize || 0), 0))
    /* WHOSE BYTES THEY ARE: the film's own (its release and its still), the app's code, and
       the library sets the museum's shell asks for on every address */
    record.bytesByKind = await page.evaluate(() => {
      const kinds = { film: 0, code: 0, library: 0, other: 0 }
      for (const r of performance.getEntriesByType('resource')) {
        const n = r.name, b = r.transferSize || r.encodedBodySize || 0
        if (n.includes('/film/')) kinds.film += b
        else if (n.includes('/na-assets/library/') || n.includes('/na-assets/')) kinds.library += b
        else if (n.includes('/assets/') || n.includes('/basis/') || n.includes('na-manifest') || n.endsWith('.js')) kinds.code += b
        else kinds.other += b
      }
      return kinds
    })
    if (!stood) { record.failed = 'the first picture never stood'; return record }
    await page.waitForTimeout(1200)
    shots.push(await shot(page, dir, '01-rest-lisa'))
    if (WALK === 'none') return record
    if (WALK === 'legs') {
      // THE CHAPTERS PLAYED THROUGH: the way on pressed at each stop, as a visitor presses it
      const on = phone ? '.film-gold' : '.desk-on'
      for (let leg = 0; leg < 3; leg++) {
        await page.waitForTimeout(2500)
        if (!(await press(page, on))) break
        await waitState(page, 'walk', 20000)
        await page.waitForFunction(() => document.querySelector('.na-film')?.dataset.state === 'rest' && !document.querySelector('#wing[data-walking]'), null, { timeout: 120000 }).catch(() => null)
        shots.push(await shot(page, dir, `leg-${leg + 1}`))
      }
      await page.waitForTimeout(2500)
      return record
    }
    // the drawer, the words' second height
    if (await press(page, phone ? '.film-more' : '.desk-more')) {
      await page.waitForTimeout(500)
      shots.push(await shot(page, dir, '02-drawer'))
      await press(page, phone ? '.film-more' : '.desk-drawer-close')
      await page.waitForTimeout(400)
    }
    const gold = phone ? '.film-gold' : '.desk-on'
    const box = await page.evaluate(() => { const r = document.querySelector('.na-film').getBoundingClientRect(); return { x: 0, y: 0, width: Math.round(r.width), height: Math.round(Math.min(r.height, innerHeight)) } })
    // the way on: the hand-over read as frames, then mid-leg, then the arrival
    await press(page, gold)
    record.handover = WALK === 'full' ? await burst(page, dir, '03-handover', 10, box) : null
    await waitState(page, 'walk', 20000)
    // the walking frame is taken inside the leg, never after it: the clip shown and between a third and two thirds through
    const mid = await page.waitForFunction(() => {
      const v = document.querySelector('.na-film-clip.shown')
      return Boolean(v && v.duration > 0 && v.currentTime >= v.duration / 3)
    }, null, { timeout: 30000, polling: 30 }).then(() => true).catch(() => false)
    const walking = await shot(page, dir, '04-walking')
    walking.midLeg = mid && await page.evaluate(() => { const v = document.querySelector('.na-film-clip.shown'); return v ? Math.round((v.currentTime / v.duration) * 100) : null })
    shots.push(walking)
    if (WALK === 'full') {
      // the arrival: frames from the clip's last half second through the dissolve onto the still
      const near = await page.waitForFunction(() => { const v = document.querySelector('.na-film-clip.shown'); return v && v.duration > 0 && v.currentTime >= v.duration - 0.5 }, null, { timeout: 60000, polling: 30 }).then(() => true).catch(() => false)
      if (near) record.arrival = await burst(page, dir, '04b-arrival', 12, box)
    }
    await waitState(page, 'rest', 60000)
    await page.waitForTimeout(2000)
    shots.push(await shot(page, dir, '05-rest-west'))
    if (WALK === 'short') return record
    // a work on the wall, walked to and back
    // the work both designs mark from the west end, walked to and back; Saint John where it is the one the film carries
    const walkable = await page.evaluate(() => [...document.querySelectorAll('.film-dot[data-mark="walk"]')].map((d) => d.dataset.exhibit))
    const work = ['picture/bacchus/front', 'picture/saint-john-the-baptist/front'].find((id) => walkable.includes(id))
    record.work = work ?? null
    const mark = work ? `.film-dot[data-exhibit="${work}"]` : '.film-dot[data-mark="walk"]'
    if (await press(page, mark)) {
      await waitState(page, 'walk', 20000)
      await waitState(page, 'rest', 60000)
      await page.waitForTimeout(2500)
      shots.push(await shot(page, dir, '06-close-work'))
      await page.keyboard.press('Escape')
      await page.waitForTimeout(800)
      shots.push(await shot(page, dir, '07-at-work'))
      // on: back along the wall, a moment at its end, and the leg to the hall
      await press(page, gold)
      await waitState(page, 'walk', 20000)
      for (let k = 0; k < 2; k++) { await waitState(page, 'rest', 60000); await page.waitForTimeout(200) }
      await page.waitForFunction(() => document.querySelector('.na-film')?.dataset.state === 'rest', null, { timeout: 60000 }).catch(() => null)
      await page.waitForTimeout(1500)
    } else {
      record.missing = 'no walking mark at the west end'
      await press(page, gold)
      await waitState(page, 'walk', 20000)
      await waitState(page, 'rest', 60000)
      await page.waitForTimeout(2000)
    }
    shots.push(await shot(page, dir, '08-rest-flight'))
    // the machine: walked up to, its live island, its folio
    if (await press(page, '.film-dot[data-exhibit="machine/aerial-screw"]')) {
      await waitState(page, 'walk', 20000)
      await waitState(page, 'rest', 60000)
      await page.waitForTimeout(6000)
      shots.push(await shot(page, dir, '09-island'))
      // the record, at the sheet's height, from the close look's own control
      const opened = await page.evaluate(() => { const b = document.querySelector('.vitrine-controls button'); if (!b) return false; b.click(); return true })
      if (opened) {
        await page.waitForTimeout(1200)
        shots.push(await shot(page, dir, '09b-record'))
        await page.keyboard.press('Escape')
        await page.waitForTimeout(600)
      }
      const folio = await page.$('.vitrine-folio')
      if (folio) {
        await folio.click().catch(() => null)
        await page.waitForFunction(() => document.querySelector('.vitrine-card')?.getAttribute('data-exhibit')?.endsWith('/leaf') ?? false, null, { timeout: 20000 }).catch(() => null)
        await page.waitForTimeout(2500)
        shots.push(await shot(page, dir, '10-leaf'))
      }
      await page.keyboard.press('Escape')
      await page.waitForTimeout(600)
      await page.keyboard.press('Escape')
      await page.waitForTimeout(600)
    } else record.missingMachine = 'no aerial screw mark at flight'
    await press(page, gold)
    await waitState(page, 'walk', 20000)
    await page.waitForFunction(() => document.querySelector('.na-film')?.dataset.state === 'rest' && !document.querySelector('#wing[data-walking]'), null, { timeout: 90000 }).catch(() => null)
    await page.waitForTimeout(1500)
    shots.push(await shot(page, dir, '11-rest-works'))
    record.end = await page.evaluate(() => { const g = document.querySelector('.film-gold, .desk-on'); return g ? { end: g.getAttribute('data-end'), disabled: g.hasAttribute('disabled') || g.getAttribute('aria-disabled') === 'true', words: g.textContent?.trim() ?? '' } : null })
    // the panel, at the sheet's height, from the book on the phone and the rail on the desktop
    if (await press(page, phone ? '.film-book' : '#rail-instruments')) {
      await page.waitForTimeout(900)
      shots.push(await shot(page, dir, '11b-panel'))
      await page.keyboard.press('Escape')
      await page.waitForTimeout(600)
    }
    // a jump the film cannot walk: back to the portrait's room at once
    await page.evaluate(() => window.__forge?.station('picture-room-lisa'))
    await waitState(page, 'dip', 10000)
    await page.waitForTimeout(700)
    shots.push(await shot(page, dir, '12-dip'))
    await waitState(page, 'rest', 30000)
    await page.waitForTimeout(2000)
    shots.push(await shot(page, dir, '13-after-dip'))
  } catch (err) {
    record.failed = String(err.message ?? err).slice(0, 300)
  } finally {
    record.handovers = await page.evaluate(() => window.__naSeam?.readout?.() ?? []).catch(() => [])
    if (JOINS && !record.failed) await readJoins(page, dir, phone, record).catch((err) => { record.joinsFailed = String(err).slice(0, 200) })
    record.seconds = (Date.now() - t0) / 1000
    await ctx.close()
    await browser.close()
  }
  return record
}

for (const engine of ENGINES) for (const width of WIDTHS) for (const lang of LANGS) {
  const r = await run(engine, width, lang)
  report.runs.push(r)
  const s = r.shots.map((x) => `${x.name.slice(3)} ${x.pictureShare ?? '?'}%`).join(' · ')
  console.log(`${engine} ${width} ${lang}: first picture ${r.firstPicture?.toFixed?.(2)} s, ${Math.round((r.bytesToFirstPicture ?? 0) / 1024)} kB · ${s}${r.failed ? ` · FAILED ${r.failed}` : ''} · errors ${r.errors.length}`)
  if (r.joins) for (const j of r.joins) console.log(`   join ${j.clip}: start mean ${j.start?.mean} max ${j.start?.max} · end mean ${j.end?.mean} max ${j.end?.max}${j.error ? ` ${j.error}` : ''}`)
  writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 1))
}
