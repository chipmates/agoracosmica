// THE COMPARISON — the live wing against the player, on one code path.
//
//   node forge/prerender/measure.mjs [--runs=3] [--tier=hero]
//
// Both sides are opened by the same function, under the same two device
// profiles, so the seconds and the bytes are comparable by construction. The
// throttled profile is the one the wing's own entry instrument uses
// (`forge/leg-probe.mjs`), written out here so the reading can be repeated: a
// mid-range phone's processor and a fast 4G line.
//
// What is measured on each side is the same event: the moment the place is on
// the glass. For the wing that is the gold field going out, which is when the
// room is first drawn. For the player it is the first still decoded.
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { APP_ROOT, browserArgs, waitForServer, wingStanding } from '../rig.mjs'
import { servePlayer } from './static-serve.mjs'

const flags = new Map()
for (const a of process.argv.slice(2)) {
  if (!a.startsWith('--')) continue
  const at = a.indexOf('=')
  flags.set(at === -1 ? a.slice(2) : a.slice(2, at), at === -1 ? true : a.slice(at + 1))
}
const flag = (n, d) => flags.get(n) ?? d
const PORT = Number(flag('port', process.env['FORGE_PORT'] ?? 5384))
const BASE = `http://127.0.0.1:${PORT}`
const RUNS = Number(flag('runs', 3))
const TIER = String(flag('tier', 'hero'))
const PLAYER = String(flag('player', resolve(APP_ROOT, '..', 'player')))
const LEGS = Number(flag('legs', 15))

/** the two stages, and the line and processor under the second of them */
const PROFILES = [
  { tag: 'desktop', view: { width: 1512, height: 950 }, dpr: 1, mobile: false, throttle: false },
  { tag: 'phone', view: { width: 390, height: 844 }, dpr: 2, mobile: true, throttle: true, cpu: 4 },
]
const FAST_4G = { offline: false, latency: 75, downloadThroughput: Math.round((9 * 1000 * 1000 * 0.9) / 8), uploadThroughput: Math.round((1.5 * 1000 * 1000 * 0.9) / 8) }

async function stage(browser, p) {
  const ctx = await browser.newContext({ viewport: p.view, deviceScaleFactor: p.dpr, hasTouch: p.mobile, isMobile: p.mobile })
  const page = await ctx.newPage()
  if (p.throttle) {
    const cdp = await ctx.newCDPSession(page)
    await cdp.send('Network.enable')
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: p.cpu })
    await cdp.send('Network.emulateNetworkConditions', FAST_4G)
  }
  return { ctx, page }
}

const bytesNow = () =>
  `(() => { let n = 0; for (const r of performance.getEntriesByType('resource')) n += r.transferSize || r.encodedBodySize || 0;
    const nav = performance.getEntriesByType('navigation')[0]; if (nav) n += nav.transferSize || nav.encodedBodySize || 0; return n })()`

async function oneWing(browser, p) {
  const { ctx, page } = await stage(browser, p)
  try {
    await page.goto(`${BASE}/w/vinci?probe=1&tier=${TIER}#s=picture-room`, { waitUntil: 'commit' })
    const stood = await wingStanding(page, 240000)
    const r = await page.evaluate(
      ([expr]) => ({
        seconds: performance.now() / 1000,
        bytes: eval(expr),
        paint: (performance.getEntriesByType('paint').find((e) => e.name === 'first-contentful-paint') || {}).startTime ?? null,
      }),
      [bytesNow()]
    )
    return { stood, ...r }
  } finally {
    await ctx.close()
  }
}

async function onePlayer(browser, p) {
  const { ctx, page } = await stage(browser, p)
  try {
    await page.goto(`${BASE}/`, { waitUntil: 'commit' })
    await page.waitForFunction(() => document.getElementById('still')?.complete && document.getElementById('still').naturalWidth > 0, null, { timeout: 120000 })
    const first = await page.evaluate(
      ([expr]) => ({ seconds: performance.now() / 1000, bytes: eval(expr) }),
      [bytesNow()]
    )
    await page.click('#onward')
    await page.waitForFunction(() => document.getElementById('back') && !document.getElementById('back').hidden, null, { timeout: 180000 })
    const after = await page.evaluate(
      ([expr]) => {
        const v = document.getElementById('clip')
        return { bytes: eval(expr), quality: v && v.getVideoPlaybackQuality ? v.getVideoPlaybackQuality() : null }
      },
      [bytesNow()]
    )
    const served = await page.evaluate(() => document.getElementById('rows').innerText.replace(/\n/g, ' | '))
    return { stood: true, ...first, legBytes: after.bytes - first.bytes, served }
  } finally {
    await ctx.close()
  }
}

const mb = (n) => Math.round((n / 1024 / 1024) * 100) / 100
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length
const show = (what, p, rows) =>
  console.log(
    `  ${what.padEnd(12)}${p.tag.padEnd(9)}` +
      `${mean(rows.map((r) => r.seconds)).toFixed(2).padStart(7)} s   ` +
      `${String(mb(mean(rows.map((r) => r.bytes)))).padStart(7)} MB   ` +
      `[${rows.map((r) => r.seconds.toFixed(1)).join(' ')}]`
  )

const preview = spawn('pnpm', ['preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore', cwd: APP_ROOT })
const out = { wing: {}, player: {} }
let browser
try {
  await waitForServer(`${BASE}/`)
  browser = await chromium.launch({ args: browserArgs() })
  console.log(`\n== from navigation to the place being on the glass, ${RUNS} runs, tier ${TIER} ==`)
  console.log('  what        stage      seconds        bytes   every run')
  for (const p of PROFILES) {
    const rows = []
    for (let i = 0; i < RUNS; i++) rows.push(await oneWing(browser, p))
    out.wing[p.tag] = rows
    show('live wing', p, rows)
  }
} finally {
  preview.kill('SIGTERM')
}
const server = await servePlayer(PLAYER, PORT)
try {
  for (const p of PROFILES) {
    const rows = []
    for (let i = 0; i < RUNS; i++) rows.push(await onePlayer(browser, p))
    out.player[p.tag] = rows
    show('player', p, rows)
    console.log(`    leg bytes ${mb(mean(rows.map((r) => r.legBytes)))} MB; the page's own readout: ${rows[0].served}`)
  }
} finally {
  server.close()
  await browser?.close()
}

/** what a whole walk would cost at each size, if every leg were walked */
const encodes = resolve(PLAYER, 'encodes.json')
if (existsSync(encodes)) {
  console.log(`\n== ${LEGS} legs of this length, every one walked ==`)
  for (const t of JSON.parse(readFileSync(encodes, 'utf8')))
    console.log(`  ${t.framing.padEnd(10)} ${String(t.lines).padStart(4)} lines   CRF ${t.crf}: ${String(Math.round(t.MB * LEGS * 10) / 10).padStart(6)} MB whole, ${String(t.MB).padStart(5)} MB a leg`)
}
console.log('')
