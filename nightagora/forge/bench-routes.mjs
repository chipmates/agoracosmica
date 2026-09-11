// THE BENCH'S OWN ADDRESSES. A bench state is reachable two ways, and the
// rig only ever drives one of them: `window.__forge.jump('bench', ...)`.
// This walks the OTHER one, the address a visitor or a link would use, and
// proves that the kind the path names is the kind that stands.
//
// Usage:  node forge/bench-routes.mjs [port]
//
// A kind that has not landed is not a failure: the address parses, the phase
// is real, and the console says so once. A page error is a failure.
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { browserArgs, waitForServer } from './rig.mjs'

const PORT = Number(process.argv[2] ?? 5199)
const BASE = `http://localhost:${PORT}`

/** one address per kind, and the id the app must report standing at */
const ROUTES = [
  ['/bench/vinci/machines/rolling-mill', 'rolling-mill', 14],
  ['/bench/vinci/table/mirror', 'mirror', 7],
  ['/bench/vinci/line/grave', null, 56],
  ['/bench/vinci/pictures/early', null, 0],
]

const server = spawn('pnpm', ['exec', 'vite', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
const problems = []
try {
  await waitForServer(BASE)
  const browser = await chromium.launch({ args: browserArgs() })
  for (const [path, wantId, wantCount] of ROUTES) {
    const page = await browser.newPage({ viewport: { width: 1512, height: 950 } })
    const errors = []
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
    page.on('console', (m) => {
      // the reserved kind's own note is the expected answer, not an error
      if (m.type() === 'error') errors.push(`console: ${m.text()}`)
    })
    // the HMR client would reload the page and lose the route under the shot
    await page.route('**/@vite/client', (r) =>
      r.fulfill({ status: 200, contentType: 'application/javascript', body: 'export {}' })
    )
    await page.goto(`${BASE}${path}?tier=standard`)
    await page.waitForFunction(() => Boolean(window.__forge))
    await page.waitForTimeout(7000)
    const said = await page.evaluate(() => ({
      phase: document.body.dataset.phase,
      forge: document.body.dataset.forge,
      id: window.__forge.state().stationId,
      count: window.__forge.state().stationIds?.length ?? 0,
    }))
    const wrong = []
    if (said.phase !== 'bench') wrong.push(`phase=${said.phase}`)
    if (wantCount && said.forge !== 'bench') wrong.push(`forge=${said.forge}`)
    if (wantId && said.id !== wantId) wrong.push(`id=${said.id}, wanted ${wantId}`)
    if (said.count !== wantCount) wrong.push(`${said.count} id(s), wanted ${wantCount}`)
    const trouble = [...wrong, ...errors]
    console.log(`${path.padEnd(38)} phase=${said.phase} forge=${said.forge} ids=${said.count} ${trouble.length ? 'FAIL ' + trouble.join(' | ') : 'ok'}`)
    if (trouble.length) problems.push(`${path}: ${trouble.join(' | ')}`)
    await page.close()
  }
  await browser.close()
} finally {
  server.kill()
}
console.log(problems.length ? `\n${problems.length} route(s) wrong` : '\nevery bench address stands the kind it names')
process.exitCode = problems.length ? 1 : 0
