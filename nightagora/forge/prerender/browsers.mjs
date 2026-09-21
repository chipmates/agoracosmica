// THE PLAYER IN THE THREE ENGINES, with its own readout quoted and a frame
// kept from each stop.
//
//   node forge/prerender/browsers.mjs [--port=5384] [--lang=de] [--framing=portrait]
//
// A player is not a canvas: the three engines differ on inline playback, on
// what a preloaded video costs and on whether a swap between a video and an
// image shows. So all three are opened, both stops are shot, and what each one
// reports about the playback is printed rather than assumed.
import { chromium, firefox, webkit } from 'playwright'
import { mkdirSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { APP_ROOT } from '../rig.mjs'
import { servePlayer } from './static-serve.mjs'

const flags = new Map()
for (const a of process.argv.slice(2)) {
  if (!a.startsWith('--')) continue
  const at = a.indexOf('=')
  flags.set(at === -1 ? a.slice(2) : a.slice(2, at), at === -1 ? true : a.slice(at + 1))
}
const flag = (n, d) => flags.get(n) ?? d
const PORT = Number(flag('port', 5384))
const PLAYER = String(flag('player', resolve(APP_ROOT, '..', 'player')))
const OUT = String(flag('out', resolve(APP_ROOT, '..', 'player-frames')))
const FRAMING = String(flag('framing', 'landscape'))
const LANG = String(flag('lang', 'en'))
const VIEW = FRAMING === 'portrait' ? { width: 430, height: 932 } : { width: 1512, height: 950 }

mkdirSync(OUT, { recursive: true })
const server = await servePlayer(PLAYER, PORT)
const engines = [['chromium', chromium], ['firefox', firefox], ['webkit', webkit]]
try {
  for (const [name, type] of engines) {
    const browser = await type.launch()
    const ctx = await browser.newContext({ viewport: VIEW, locale: LANG === 'de' ? 'de-DE' : 'en-GB' })
    const page = await ctx.newPage()
    const noise = []
    page.on('pageerror', (e) => noise.push(e.message.slice(0, 120)))
    try {
      await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'load' })
      await page.waitForFunction(() => {
        const i = document.getElementById('still')
        return i && i.complete && i.naturalWidth > 0
      }, null, { timeout: 60000 })
      await page.click('#toggle')
      await page.screenshot({ path: join(OUT, `${name}-${FRAMING}-${LANG}-stop1.png`) })
      await page.click('#onward')
      await page.waitForFunction(() => {
        const b = document.getElementById('back')
        return b && !b.hidden
      }, null, { timeout: 180000 })
      await page.waitForTimeout(400)
      await page.screenshot({ path: join(OUT, `${name}-${FRAMING}-${LANG}-stop2.png`) })
      const said = await page.evaluate(() => document.getElementById('rows').innerText.replace(/\n/g, ' | ').replace(/\t/g, ' '))
      console.log(`${name.padEnd(9)} ${said}`)
      if (noise.length) console.log(`${' '.repeat(9)} page errors: ${noise.slice(0, 3).join(' | ')}`)
    } catch (err) {
      console.log(`${name.padEnd(9)} FAILED: ${String(err.message).slice(0, 160)}`)
    } finally {
      await browser.close()
    }
  }
} finally {
  server.close()
}
console.log(`frames in ${OUT}`)
