// THE STRIP PROBE — how many of a station's row of thumbnails are still blank
// in the frame the station stands. A station is standing when the entry's
// field has lifted and the rail bar names it completed; a thumbnail is blank
// while its image has not loaded.
//
//   node forge/strip-probe.mjs [--station=picture-room] [--from=garden] [--cells=25]
//        [--tier=standard] [--width=1440] [--height=900] [--scale=1] [--serve=off]
//
// It reads the row twice from a cold page: the deep link straight to the
// station, and the walk into it from `--from`. It serves its own preview on
// FORGE_PORT unless `--serve=off`.
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { APP_ROOT, assertServer, browserArgs, waitForServer } from './rig.mjs'

const flags = new Map(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
  const at = a.indexOf('=')
  return at < 0 ? [a.slice(2), true] : [a.slice(2, at), a.slice(at + 1)]
}))
const flag = (name, fallback) => flags.get(name) ?? fallback
const PORT = Number(process.env['FORGE_PORT'] ?? 5199)
const BASE = `http://127.0.0.1:${PORT}`
const STATION = String(flag('station', 'picture-room'))
const FROM = String(flag('from', 'garden'))
const TIER = String(flag('tier', 'standard'))
const VIEW = { width: Number(flag('width', 1440)), height: Number(flag('height', 900)) }
const SCALE = Number(flag('scale', 1))

/** the row as it stands in this frame: cells, the ones in view, the blank ones in view */
const readRow = () => {
  const row = document.querySelector('.vinci-strip')
  if (!row || row.hidden) return null
  const box = row.getBoundingClientRect()
  const images = [...row.querySelectorAll('img.vinci-strip-thumb')]
  const inView = images.filter((image) => {
    const r = image.getBoundingClientRect()
    return r.right > box.left && r.left < box.right
  })
  const blank = inView.filter((image) => !image.complete || image.naturalWidth === 0)
  return { cells: images.length, inView: inView.length, blank: blank.length,
    fromBlob: images.filter((image) => image.src.startsWith('blob:')).length }
}

async function standing(page, id) {
  await page.waitForFunction((want) => {
    const gold = document.getElementById('goldbreath')
    const here = document.querySelector('.wing-step[aria-current="true"]')
    return document.body.dataset.phase === 'wing' && gold && !gold.classList.contains('lit') &&
      here?.dataset.station === want && !document.querySelector('.wing-step[data-target="true"]')
  }, id, { timeout: 180000, polling: 'raf' })
}

const server = flag('serve', 'on') === 'off' ? null
  : spawn('pnpm', ['exec', 'vite', 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore', cwd: APP_ROOT })
try {
  await waitForServer(`${BASE}/`)
  const said = await assertServer(BASE)
  console.log(`server ${said.head.slice(0, 7)}  ${STATION} at ${TIER}, ${VIEW.width}x${VIEW.height}`)
  const browser = await chromium.launch({ args: browserArgs() })
  for (const how of ['deep link', `walk from ${FROM}`]) {
    const ctx = await browser.newContext({ viewport: VIEW, deviceScaleFactor: SCALE })
    const page = await ctx.newPage()
    const start = how === 'deep link' ? STATION : FROM
    await page.goto(`${BASE}/w/vinci?probe=1&tier=${TIER}#s=${start}`)
    await standing(page, start)
    let watch = null
    if (how !== 'deep link') {
      // every frame of the walk in: the row stands with the station's card,
      // which hands over before the arrival, so the row is read from the
      // first frame it shows this station's cells
      const watching = page.evaluate(([to, read, cells]) => new Promise((done) => {
        const readRow = new Function(`return (${read})()`)
        let first = null, worst = 0, blankFrames = 0, frames = 0
        const t0 = performance.now()
        const tick = (t) => {
          const row = readRow()
          if (row && row.cells === cells) {
            first ??= Math.round(t - t0)
            frames++
            worst = Math.max(worst, row.blank)
            if (row.blank) blankFrames++
          }
          const here = document.querySelector('.wing-step[aria-current="true"]')
          if (here?.dataset.station === to && t - t0 > 2000 && first !== null && t - t0 > first + 2000) done({ firstShownMs: first, framesShown: frames, framesWithABlank: blankFrames, mostBlank: worst })
          else if (t - t0 > 60000) done({ firstShownMs: first, framesShown: frames, framesWithABlank: blankFrames, mostBlank: worst, capped: true })
          else requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      }), [STATION, readRow.toString(), Number(flag('cells', 25))])
      await page.evaluate((to) => {
        history.pushState({}, '', location.pathname + location.search + '#s=' + to)
        dispatchEvent(new PopStateEvent('popstate'))
      }, STATION)
      await standing(page, STATION)
      watch = await watching
    }
    const at = await page.evaluate(readRow)
    await page.waitForTimeout(2000)
    const later = await page.evaluate(readRow)
    console.log(`${how.padEnd(20)} when it stands: ${JSON.stringify(at)}  two seconds on: ${JSON.stringify(later)}`)
    if (how !== 'deep link') {
      console.log(`${''.padEnd(20)} from the first frame the row showed on the walk: ${JSON.stringify(watch)}`)
    }
    await ctx.close()
  }
  await browser.close()
} finally {
  server?.kill('SIGTERM')
}
