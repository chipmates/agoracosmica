// THE HEART'S CLOSE LOOK, SHOT: the body stop opened, the heart sheet's mark
// pressed the way a hand presses it, and the film's look kept at every state a
// visitor meets there: the first frame the moment it opens, at rest, playing,
// at 10 s and at 18 s (the second line), the sheet behind its door and the way
// back. Each shot carries the numbers the frozen designs are read by.
//
//   node forge/film/heart-look.mjs --base=https://127.0.0.1:5585 --release=heart --out=<dir>
//     [--wing=film|live] [--engines=chromium,webkit] [--widths=390,1512] [--langs=de,en]
//
// `--wing=film` opens `?film=<release>` at the body stop; `--wing=live` opens
// the live engine there and walks to the sheet by the wing's own named walk.
// It shoots a running server and starts none.
import { chromium, firefox, webkit } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { browserArgs, wingStanding } from '../rig.mjs'

const flags = new Map(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
  const at = a.indexOf('=')
  return at < 0 ? [a.slice(2), true] : [a.slice(2, at), a.slice(at + 1)]
}))
const BASE = String(flags.get('base') ?? 'https://127.0.0.1:5585')
const RELEASE = String(flags.get('release') ?? 'heart')
const WING = String(flags.get('wing') ?? 'film')
const OUT = resolve(String(flags.get('out') ?? 'heart-look'))
const ENGINES = String(flags.get('engines') ?? 'chromium').split(',')
const WIDTHS = String(flags.get('widths') ?? '390,1512').split(',').map(Number)
const LANGS = String(flags.get('langs') ?? 'de,en').split(',')
const SHEET = 'sheet/rcin-919082'
const HEIGHT = { 360: 800, 390: 844, 430: 932, 1280: 800, 1440: 900, 1512: 950, 1920: 1080 }
const TYPES = { chromium, webkit, firefox }
mkdirSync(OUT, { recursive: true })

/** what the look says of itself, and where its parts stand, in CSS pixels */
function lookNow() {
  const r = (sel) => {
    const el = document.querySelector(sel)
    if (!el) return null
    const b = el.getBoundingClientRect(), cs = getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden' || b.width === 0) return null
    return { top: Math.round(b.top), left: Math.round(b.left), width: Math.round(b.width), height: Math.round(b.height) }
  }
  const said = window.__naLook?.readout?.() ?? null
  const caption = document.querySelector('.vitrine-caption')
  const lineHeight = caption ? parseFloat(getComputedStyle(caption).lineHeight) : 0
  const view = r('.vitrine-view'), film = r('.showpiece'), cap = r('.vitrine-caption')
  const controls = [...document.querySelectorAll('.vitrine button, .vitrine input, .desk-clb button')]
    .filter((b) => b.getClientRects().length && getComputedStyle(b).visibility !== 'hidden')
    .map((b) => b.getBoundingClientRect())
  return {
    look: said,
    exhibit: document.querySelector('.vitrine-card')?.dataset.exhibit ?? null,
    caption: caption?.textContent ?? '',
    captionFont: caption ? getComputedStyle(caption).fontSize : null,
    captionRows: cap && lineHeight ? Math.round(cap.height / lineHeight) : null,
    view, film, cap, card: r('.vitrine-card'), band: r('.desk-clb'), door: r('.showpiece-door'), play: r('.vitrine-play'),
    gold: document.querySelector('.desk-clb-on')?.textContent ?? null,
    line: document.querySelector('.vitrine-line')?.textContent ?? document.querySelector('.desk-clb-line')?.textContent ?? '',
    // the picture's share of the window, and whether a word stands on it
    filmShare: film ? Math.round((film.width * film.height) / (innerWidth * innerHeight) * 1000) / 1000 : null,
    captionClear: film && cap ? cap.top >= film.top + film.height : null,
    topControl: controls.length ? Math.round(Math.min(...controls.map((b) => b.top))) : null,
    smallestControl: controls.length ? Math.round(Math.min(...controls.map((b) => Math.min(b.width, b.height)))) : null,
  }
}

async function run(engine, width, lang) {
  const height = HEIGHT[width] ?? Math.round(width * 1.8)
  const phone = width < 700
  const dir = join(OUT, WING, engine, `${width}-${lang}`)
  mkdirSync(dir, { recursive: true })
  const browser = await TYPES[engine].launch(engine === 'chromium' ? { args: browserArgs() } : {})
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: phone ? 2 : 1, ignoreHTTPSErrors: true,
    locale: lang === 'de' ? 'de-DE' : 'en-GB', ...(phone && engine !== 'firefox' ? { isMobile: true, hasTouch: true } : {}) })
  await ctx.addInitScript(() => { try { sessionStorage.setItem('vinci-welcome', '1'); localStorage.setItem('agc_probe', '1') } catch { /* seen */ } })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text().slice(0, 200)}`) })
  const record = { wing: WING, engine, width, lang, errors, shots: [], times: {} }
  const shot = async (name) => {
    await page.screenshot({ path: join(dir, `${name}.png`), timeout: 30000 }).catch(() => null)
    record.shots.push({ name, ...(await page.evaluate(lookNow).catch((e) => ({ error: String(e) }))) })
  }
  const readout = () => page.evaluate(() => window.__naLook?.readout?.() ?? null)
  const until = (fn, arg, ms = 30000) => page.waitForFunction(fn, arg, { timeout: ms, polling: 25 }).then(() => true).catch(() => false)
  const t0 = Date.now()
  try {
    if (WING === 'film') {
      await page.goto(`${BASE}/w/vinci?film=${RELEASE}&order=life&probe=1&lang=${lang}#s=body`, { waitUntil: 'load', timeout: 120000 })
      await until(() => { const s = document.querySelector('.na-film-still'); return s && s.complete && s.naturalWidth > 0 && document.querySelector('.na-film')?.dataset.state === 'rest' }, null, 120000)
      await page.waitForTimeout(1500)
      await shot('00-stop')
      const mark = await page.$(`.film-dot[data-exhibit="${SHEET}"]`)
      if (!mark) { record.failed = 'no heart mark at the body stop'; return record }
      await mark.click({ timeout: 8000 }).catch(() => mark.evaluate((e) => e.click()))
    } else {
      await page.goto(`${BASE}/w/vinci?probe=1&lang=${lang}#s=body`, { waitUntil: 'load', timeout: 180000 })
      if (!(await wingStanding(page, 300000))) { record.failed = 'the live wing never stood'; return record }
      await until(() => window.__forge?.state?.().stationId === 'body' && !document.querySelector('#wing[data-walking]'), null, 120000)
      await page.waitForTimeout(2500)
      await shot('00-stop')
      await page.evaluate((id) => window.__forge.jump('wing', { slug: 'vinci', station: 'body', view: `walk:${id}` }), SHEET)
    }
    const pressed = Date.now()
    // THE FIRST FRAME: the still stands the moment the look opens
    const first = await until((id) => document.querySelector('.vitrine-card')?.dataset.exhibit === id
      && document.querySelector('.showpiece-poster')?.complete && document.querySelector('.showpiece-poster')?.naturalWidth > 0, SHEET, 90000)
    record.times.pressToFirstFrame = (Date.now() - pressed) / 1000
    if (!first) { record.failed = 'the film\'s first frame never stood'; await shot('01-never'); return record }
    await shot('01-open')
    await page.waitForTimeout(2500)
    const idle = await page.evaluate(() => { const v = document.querySelector('.showpiece-video'); return v ? { t: v.currentTime, paused: v.paused } : null })
    record.autoplay = idle ? !idle.paused || idle.t > 0 : null
    await shot('02-rest')
    // on the phone the card's row comes up with the card: raised, then back to its peek
    if (phone && await page.$('.vitrine-grab')) {
      await page.click('.vitrine-grab')
      await page.waitForTimeout(900)
      await shot('02-raised')
      await page.click('.vitrine-grab')
      await page.waitForTimeout(900)
    }
    // THE VISITOR STARTS IT: the gold control on the desktop band, the play control elsewhere
    const gold = !phone && await page.$('.desk-clb-on:not([disabled])')
    const started = Date.now()
    if (gold) await gold.click()
    else await page.click('.vitrine-play')
    record.started = gold ? 'gold' : 'play'
    await until(() => { const v = document.querySelector('.showpiece-video'); return v?.classList.contains('shown') && !v.paused }, null, 30000)
    record.times.playToFirstVideoFrame = (Date.now() - started) / 1000
    await page.waitForTimeout(1500)
    await shot('03-playing')
    // playing through 10 s and through the shut at 17.94 s, where the line changes
    for (const [name, at] of [['03-playing-t10', 10], ['03-playing-t18', 18]]) {
      await page.evaluate((t) => { const v = document.querySelector('.showpiece-video'); v.currentTime = t - 0.6; void v.play() }, at)
      await until((t) => document.querySelector('.showpiece-video')?.currentTime >= t, at, 20000)
      await shot(name)
      // the film wing says which line stands; the live wing is read by its words
      if (at === 18) record.lineAt18Playing = (await readout())?.line
        ?? await page.evaluate(() => document.querySelector('.vitrine-caption')?.textContent?.slice(0, 24) ?? null)
    }
    await page.evaluate(() => document.querySelector('.showpiece-video')?.pause())
    for (const [name, at] of [['04-t00', 0], ['05-t10', 10], ['06-t18', 18]]) {
      await page.evaluate((t) => { const v = document.querySelector('.showpiece-video'); v.pause(); v.currentTime = t }, at)
      await until((t) => { const v = document.querySelector('.showpiece-video'); return v && !v.seeking && Math.abs(v.currentTime - t) < 0.05 }, at, 15000)
      await page.waitForTimeout(700)
      await shot(name)
    }
    // THE SHEET ITSELF, behind its door, and the way back to the film
    const door = await page.$('.showpiece-door')
    if (door) {
      await door.click()
      await until((id) => document.querySelector('.vitrine-card')?.dataset.exhibit === `${id}/leaf`, SHEET, 20000)
      await page.waitForTimeout(3000)
      await shot('07-sheet')
      // the way back to the film: the band's own arrow on the desktop, the raised card's first seat on the phone
      if (phone && await page.$('.vitrine-grab')) {
        await page.click('.vitrine-grab')
        await page.waitForTimeout(900)
        await shot('07-sheet-raised')
      }
      const back = phone ? await page.$('.vitrine-controls [data-role="back"]') : await page.$('.desk-clb-back:not([disabled])')
      record.backShown = Boolean(back && await back.evaluate((b) => b.getClientRects().length > 0 && getComputedStyle(b).visibility !== 'hidden'))
      if (back) {
        await back.evaluate((b) => b.click())
        await until((id) => document.querySelector('.vitrine-card')?.dataset.exhibit === id, SHEET, 20000)
        await page.waitForTimeout(1500)
        await shot('08-back')
      }
    } else record.door = 'none'
    record.readout = await readout()
  } catch (err) {
    record.failed = String(err.message ?? err).slice(0, 300)
  } finally {
    record.seconds = (Date.now() - t0) / 1000
    await ctx.close()
    await browser.close()
  }
  return record
}

const report = { base: BASE, release: RELEASE, wing: WING, runs: [] }
for (const engine of ENGINES) for (const width of WIDTHS) for (const lang of LANGS) {
  const r = await run(engine, width, lang)
  report.runs.push(r)
  console.log(`${WING} ${engine} ${width} ${lang}: ${r.failed ? `FAILED ${r.failed}` : `first frame ${r.times.pressToFirstFrame} s, video ${r.times.playToFirstVideoFrame} s, autoplay ${r.autoplay}, line at 18 s playing ${r.lineAt18Playing}, ${r.shots.length} shots`} · errors ${r.errors.length}${r.errors.length ? ` (${r.errors[0]})` : ''}`)
  writeFileSync(join(OUT, `report-${WING}.json`), JSON.stringify(report, null, 1))
}
