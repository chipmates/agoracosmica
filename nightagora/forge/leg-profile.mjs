// THE LEG PROFILE — WHERE the leg's milliseconds go. The leg probe says a
// frame took four seconds; this one says which function spent them. It runs
// Chromium's own sampling profiler across the walk and prints self time by
// function and by file, plus every request the leg made: a stall from a
// pipeline compile and a stall from a texture arriving look identical in a
// frame time and are opposite problems.
//
//   node forge/leg-profile.mjs <from> <to> [--tier=hero] [--wing=vinci]
//   FORGE_PORT=5288 node forge/leg-profile.mjs chamber garden
//
// Same server rules as the leg probe: it serves its own preview on
// FORGE_PORT, `--serve=off` shoots one that is already up.
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { APP_ROOT, assertServer, browserArgs, waitForServer } from './rig.mjs'

const argv = process.argv.slice(2)
const flags = new Map()
const words = []
for (const a of argv) {
  if (!a.startsWith('--')) { words.push(a); continue }
  const at = a.indexOf('=')
  flags.set(at === -1 ? a.slice(2) : a.slice(2, at), at === -1 ? true : a.slice(at + 1))
}
const flag = (name, fallback) => flags.get(name) ?? fallback
const PORT = Number(flag('port', process.env['FORGE_PORT'] ?? 5199))
const BASE = `http://127.0.0.1:${PORT}`
const WING = String(flag('wing', 'vinci'))
const TIER = String(flag('tier', 'hero'))
const SECONDS = Number(flag('seconds', 32))
const VIEW = { width: Number(flag('width', 1440)), height: Number(flag('height', 900)) }
const [FROM, TO] = [words[0] ?? 'chamber', words[1] ?? 'garden']
const short = (f) => `${f.url.replace(/^.*:\/\/[^/]+/, '').split('?')[0].slice(-45)}:${f.lineNumber}`

const server = flags.has('serve') && flag('serve') === 'off' ? null
  : spawn('pnpm', ['preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', cwd: APP_ROOT })
try {
  await waitForServer(`${BASE}/`)
  const said = await assertServer(BASE)
  console.error(`server ${said.head.slice(0, 7)} on ${BASE}`)
  const browser = await chromium.launch({ args: browserArgs() })
  const ctx = await browser.newContext({ viewport: VIEW })
  const page = await ctx.newPage()
  await page.goto(`${BASE}/w/${WING}?probe=1&tier=${TIER}#s=${FROM}`, { waitUntil: 'load' })
  const ids = await page.waitForFunction(() => {
    const s = window.__forge?.state?.()
    return s && s.phase === 'wing' && s.stationIds.length ? s.stationIds : null
  }, null, { timeout: 90000 }).then(h => h.jsonValue())
  const card = (id) => `${String(ids.indexOf(id) + 1).padStart(2, '0')} / ${ids.length}`
  await page.waitForFunction(n => document.body.innerText.includes(n), card(FROM), { timeout: 90000 })
  await page.waitForTimeout(6000)
  const reqs = []
  let t0 = 0
  page.on('request', r => { if (t0) reqs.push([Math.round(Date.now() - t0) / 1000, r.url().replace(/^.*:\/\/[^/]+/, '').slice(0, 70)]) })
  const cdp = await ctx.newCDPSession(page)
  await cdp.send('Profiler.enable')
  await cdp.send('Profiler.setSamplingInterval', { interval: 500 })
  await cdp.send('Profiler.start')
  t0 = Date.now()
  await page.evaluate((to) => {
    history.pushState({}, '', location.pathname + location.search + '#s=' + to)
    dispatchEvent(new PopStateEvent('popstate'))
  }, TO)
  await page.waitForTimeout(SECONDS * 1000)
  const { profile } = await cdp.send('Profiler.stop')
  const self = new Map(); const byFile = new Map()
  const byId = new Map(profile.nodes.map(n => [n.id, n]))
  for (let i = 0; i < profile.samples.length; i++) {
    const f = byId.get(profile.samples[i]).callFrame
    const ms = profile.timeDeltas[i] / 1000
    const key = `${f.functionName || '(anon)'} ${short(f)}`
    self.set(key, (self.get(key) ?? 0) + ms)
    const file = f.url.replace(/^.*:\/\/[^/]+/, '').split('?')[0].slice(-45) || f.functionName
    byFile.set(file, (byFile.get(file) ?? 0) + ms)
  }
  const total = [...self.values()].reduce((a, c) => a + c, 0)
  console.log(`== ${WING} ${FROM} to ${TO}, tier ${TIER}: ${Math.round(total)} ms sampled over ${SECONDS} s ==`)
  console.log('top functions by self time (ms):')
  for (const [k, v] of [...self].sort((a, b) => b[1] - a[1]).slice(0, 14)) console.log('  ', Math.round(v), k)
  console.log('top files (ms):')
  for (const [k, v] of [...byFile].sort((a, b) => b[1] - a[1]).slice(0, 8)) console.log('  ', Math.round(v), k)
  console.log(`requests during the leg: ${reqs.length}`)
  for (const [at, url] of reqs.slice(0, 30)) console.log('  ', at + 's', url)
  await browser.close()
} finally {
  server?.kill('SIGTERM')
}
