// Shared E2E harness: browser contexts, the consent gate, and the check log.
//
// Both suites sit on this. run.mjs is the flag-OFF arm (what production ships
// today), run-ceremony.mjs is the flag-ON twin. Keeping one harness means a
// selector or a wait that turns flaky gets fixed in one place.
//
// Playwright is resolved from the repo's nightagora package on purpose: the
// client package adds no new dependency for these suites.

import { mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(new URL('../../../nightagora/package.json', import.meta.url))
export const { chromium } = require('playwright')

const CANDIDATE_PORTS = [5174, 5173]
const SHOTS = new URL('./failures/', import.meta.url).pathname
mkdirSync(SHOTS, { recursive: true })

let base = null
let currentSpec = null
let activePage = null
const results = []
let failures = 0

export function spec(name) {
  currentSpec = { name, checks: [], warns: [] }
  results.push(currentSpec)
}

export async function check(cond, msg) {
  currentSpec.checks.push({ ok: !!cond, msg })
  if (!cond) {
    failures++
    if (activePage) {
      const file = `${SHOTS}${currentSpec.name}-${currentSpec.checks.length}.png`
      await activePage.screenshot({ path: file }).catch(() => {})
      currentSpec.warns.push(`failure shot: ${file}`)
    }
  }
}

export function warn(msg) {
  currentSpec.warns.push(msg)
}

/**
 * Find the running dev server. Returns the base URL, or null when neither port
 * answers — the caller decides what to print, since the two suites need the
 * server started with different flags.
 */
export async function findBase(browser) {
  for (const port of CANDIDATE_PORTS) {
    const p = await browser.newPage({ ignoreHTTPSErrors: true })
    try {
      await p.goto(`https://localhost:${port}/app`, { timeout: 4000 })
      base = `https://localhost:${port}`
      await p.close()
      return base
    } catch {
      await p.close()
    }
  }
  return null
}

export async function newPage(browser, path, { seedStorage } = {}) {
  const ctx = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 900 },
    locale: 'de-DE',
  })
  const page = await ctx.newPage()
  activePage = page
  const consoleIssues = []
  page.on('console', (m) => {
    const text = m.text()
    if (/does not recognize|Each child in a list|Cannot update a component/.test(text)) {
      consoleIssues.push(text.slice(0, 160))
    }
  })
  if (seedStorage) {
    // Storage is origin-scoped: open the origin first, then seed, then navigate.
    await page.goto(`${base}/app`, { waitUntil: 'domcontentloaded' })
    await page.evaluate((entries) => {
      for (const [area, key, value] of entries) {
        ;(area === 'local' ? localStorage : sessionStorage).setItem(key, value)
      }
    }, seedStorage)
  }
  await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  return { page, ctx, consoleIssues }
}

export async function passGate(page) {
  await page.keyboard.press('Escape')
  await page.waitForTimeout(600)
  const gate = page.getByRole('button', { name: /Jetzt entdecken/i })
  await gate.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {})
  await gate.click().catch(() => {})
  await page.waitForTimeout(1500)
}

export async function dismissHelpers(page) {
  for (let i = 0; i < 2; i++) {
    const btn = page.getByRole('button', { name: /Verstanden|Entdeckung beginnen/i }).first()
    const visible = await btn.isVisible().catch(() => false)
    if (!visible) return
    await btn.click().catch(() => {})
    await page.waitForTimeout(500)
  }
}

/**
 * Send what the composer holds and wait for the chat request it produces.
 * The first Enter sometimes lands while the stage is still settling and gets
 * swallowed, so it repeats until the box empties. Keeps the assertion about
 * the send reaching the worker rather than about catching a good moment.
 */
export async function sendComposer(page, composer, { timeout = 30000 } = {}) {
  const response = page
    .waitForResponse((r) => r.url().includes('/v1/chat'), { timeout })
    .catch(() => null)
  for (let attempt = 0; attempt < 4; attempt++) {
    await composer.press('Enter').catch(() => {})
    await page.waitForTimeout(2000)
    if ((await composer.inputValue().catch(() => '')) === '') break
  }
  return response
}

/** Print the run and return the exit code. */
export function report() {
  for (const r of results) {
    console.log(`\n■ ${r.name}`)
    for (const c of r.checks) console.log(`  ${c.ok ? '✓' : '✗'} ${c.msg}`)
    for (const w of r.warns) console.log(`  ⚠ ${w}`)
  }
  console.log(`\n${failures === 0 ? 'ALL GREEN' : `${failures} FAILURE(S)`}`)
  return failures === 0 ? 0 : 1
}
