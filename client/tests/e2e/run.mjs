// E2E flow suite — the executable "don't break anything" net for the app's
// money path, the story→Chapter-2 handoff, and the gclid consent guards.
//
// Prerequisites (run from client/):
//   1. pnpm dev                                  → https://localhost:5174 (or :5173)
//   2. cd ../workers/llm-proxy && npx wrangler dev --port 8788
// Then:  node tests/e2e/run.mjs
//
// Playwright is resolved from the repo's nightagora package on purpose: the
// client package adds no new dependency for this suite.

import { createRequire } from 'node:module'
const require = createRequire(new URL('../../../nightagora/package.json', import.meta.url))
const { chromium } = require('playwright')

const CANDIDATE_PORTS = [5174, 5173]
const GCLID = 'E2ETESTGCLID1234567890'
const CONSENT_GRANTED = JSON.stringify({ granted: true, version: '1.0.0', timestamp: 0 })

let base = null
const results = []
let currentSpec = null
let failures = 0

import { mkdirSync } from 'node:fs'
const SHOTS = new URL('./failures/', import.meta.url).pathname
mkdirSync(SHOTS, { recursive: true })
let activePage = null

function spec(name) {
  currentSpec = { name, checks: [], warns: [] }
  results.push(currentSpec)
}
async function check(cond, msg) {
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
function warn(msg) {
  currentSpec.warns.push(msg)
}

async function newPage(browser, path, { seedStorage } = {}) {
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

async function passGate(page) {
  await page.keyboard.press('Escape')
  await page.waitForTimeout(600)
  const gate = page.getByRole('button', { name: /Jetzt entdecken/i })
  await gate.waitFor({ state: 'visible', timeout: 15000 })
  await gate.click()
  await page.waitForTimeout(1500)
}

async function dismissHelpers(page, rounds = 2) {
  for (let i = 0; i < rounds; i++) {
    const btn = page.getByRole('button', { name: /Verstanden|Entdeckung beginnen/i })
    try {
      await btn.first().waitFor({ state: 'visible', timeout: 2500 })
      await btn.first().click()
      await page.waitForTimeout(500)
    } catch {
      return
    }
  }
}

// ---------- Spec 1: money path (DE): boot → gate → gallery → deep link → prefill → send → reply
async function moneyPath(browser) {
  spec('money-path')

  // Cold boot: gate → gallery with the trio
  const a = await newPage(browser, '/app?lang=de')
  await passGate(a.page)
  // The V2 gallery models the trio as a radio group ("choose your first Echo"),
  // so the portrait rows expose role=radio, not button.
  const marcus = a.page.getByRole('radio', { name: /Reise mit Echo von Mark Aurel/i }).locator('visible=true').first()
  await marcus.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {})
  await check(await marcus.isVisible().catch(() => false), 'welcome gallery shows the Marcus portrait row after the gate')
  await check(
    await a.page.getByRole('button', { name: /Alle 30 entdecken/i }).isVisible().catch(() => false),
    'gallery offers "Alle 30 entdecken"'
  )
  await a.ctx.close()

  // Deep link with ask intent: composer prefilled, send produces a reply
  const b = await newPage(browser, '/app?lang=de&figure=marcus-aurelius&ask=hero')
  await passGate(b.page)
  await dismissHelpers(b.page)
  const composer = b.page.locator('textarea').first()
  await composer.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {})
  const prefill = await composer.inputValue().catch(() => '')
  await check(prefill.length > 10, `ask=hero stages a question in the text composer (got: "${prefill.slice(0, 40)}…")`)

  const replyPromise = b.page
    .waitForResponse((r) => r.url().includes('/v1/chat'), { timeout: 30000 })
    .catch(() => null)
  await composer.press('Enter')
  const reply = await replyPromise
  const status = reply ? reply.status() : null
  // 429 = the dev worker's DEV_RATE_LIMIT — the pipeline is wired, quota is spent.
  await check(status === 200 || status === 429, `sending the staged question reaches /v1/chat (status: ${status})`)
  if (status === 429) warn('dev worker rate limit hit — restart wrangler to test a real reply')

  for (const issue of b.consoleIssues) warn(`console: ${issue}`)
  await b.ctx.close()
}

// ---------- Spec 2: story door → scroll to end → Chapter-2 handoff → Weisheit mode
async function storyHandoff(browser) {
  spec('story-handoff')
  const s = await newPage(browser, '/app?lang=de&figure=marcus-aurelius')
  await passGate(s.page)
  const door = s.page.locator('button, [role="button"]', { hasText: /Fang mit der Geschichte an/i })
  await door.first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {})
  await check(await door.first().isVisible().catch(() => false), 'first-contact doors show the story door')
  await door.first().click().catch(() => {})
  await s.page.waitForTimeout(3000)
  await dismissHelpers(s.page)

  // The story text scrolls inside its own container (.story-scrollable-native),
  // so window wheel events never reach the read-to-end trigger. Scroll the
  // container itself and fire the scroll event the handler listens for.
  const scrolled = await s.page.evaluate(() => {
    const el =
      document.querySelector('.story-scrollable-native') ||
      [...document.querySelectorAll('*')]
        .filter((n) => n.scrollHeight > n.clientHeight + 100 && n.clientHeight > 200)
        .sort((x, y) => y.scrollHeight - y.clientHeight - (x.scrollHeight - x.clientHeight))[0]
    if (!el) return false
    el.scrollTop = el.scrollHeight
    el.dispatchEvent(new Event('scroll', { bubbles: true }))
    return true
  })
  await check(scrolled, 'found the story scroll container')
  await s.page.waitForTimeout(2500)

  // The card's "Kapitel 2" is an eyebrow div; the actionable button says "Gespräch beginnen".
  const handoffCard = s.page.locator('text=/Kapitel 2/i').first()
  const handoffTake = s.page.getByRole('button', { name: /Gespräch beginnen/i }).first()
  const handoffVisible = await handoffCard
    .waitFor({ state: 'visible', timeout: 8000 })
    .then(() => true)
    .catch(() => false)
  await check(handoffVisible, 'scrolling the story to its end raises the Chapter-2 handoff card')

  if (handoffVisible) {
    await handoffTake.click().catch(() => {})
    await s.page.waitForTimeout(3500)
    const inWisdom = await s.page
      .locator('text=/Weisheit/i')
      .first()
      .isVisible()
      .catch(() => false)
    await check(inWisdom, 'taking the handoff lands in the Weisheit chapter')
  }
  await s.ctx.close()
}

// ---------- Spec 3: gclid consent guards (the lawfulness net)
async function gclidGuards(browser) {
  spec('gclid-consent')

  function trackConversions(page) {
    const sends = []
    page.route('**/api/conversions', (route) => {
      sends.push(route.request().postData() || '')
      route.fulfill({ status: 204, body: '' })
    })
    return sends
  }

  // 3a: gclid arrival WITHOUT consent → no conversion request may leave, ever
  const a = await newPage(browser, `/app?lang=de&figure=marcus-aurelius&gclid=${GCLID}`)
  const sendsA = trackConversions(a.page)
  await passGate(a.page)
  await a.page.waitForTimeout(2500)
  const doorA = a.page.locator('button, [role="button"]', { hasText: /Frag einfach etwas/i })
  await doorA.first().click({ timeout: 10000 }).catch(() => {})
  await a.page.waitForTimeout(2500)
  await check(sendsA.length === 0, `no consent → zero /api/conversions requests (saw ${sendsA.length})`)
  await a.ctx.close()

  // 3b: consent granted → conversions flow, carry the gclid, and dedup per event
  const b = await newPage(browser, `/app?lang=de&figure=marcus-aurelius&gclid=${GCLID}`, {
    seedStorage: [['local', 'agc_ad_consent', CONSENT_GRANTED]],
  })
  const sendsB = trackConversions(b.page)
  await passGate(b.page)
  await b.page.waitForTimeout(2500)
  const doorB = b.page.locator('button, [role="button"]', { hasText: /Frag einfach etwas/i })
  await doorB.first().click({ timeout: 10000 }).catch(() => {})
  await b.page.waitForTimeout(2500)
  await check(sendsB.length > 0, `consent granted → conversion request fires (saw ${sendsB.length})`)
  await check(
    sendsB.every((p) => p.includes(GCLID)),
    'every conversion payload carries the captured gclid'
  )
  const events = sendsB.map((p) => (JSON.parse(p || '{}').event ?? '?'))
  await check(new Set(events).size === events.length, `events dedup per tab (saw: ${events.join(', ')})`)
  await b.ctx.close()

  // 3c: paid arrival (?p=1) never sends, even WITH a granted consent record
  const c = await newPage(browser, `/app?lang=de&figure=marcus-aurelius&gclid=${GCLID}&p=1`, {
    seedStorage: [['local', 'agc_ad_consent', CONSENT_GRANTED]],
  })
  const sendsC = trackConversions(c.page)
  await passGate(c.page)
  await c.page.waitForTimeout(2500)
  const doorC = c.page.locator('button, [role="button"]', { hasText: /Frag einfach etwas/i })
  await doorC.first().click({ timeout: 10000 }).catch(() => {})
  await c.page.waitForTimeout(2500)
  await check(sendsC.length === 0, `paid arrival (?p=1) → zero conversion requests even with consent (saw ${sendsC.length})`)
  await c.ctx.close()
}

// ---------- main
const probe = await chromium.launch()
for (const port of CANDIDATE_PORTS) {
  const p = await probe.newPage({ ignoreHTTPSErrors: true })
  try {
    await p.goto(`https://localhost:${port}/app`, { timeout: 4000 })
    base = `https://localhost:${port}`
    await p.close()
    break
  } catch {
    await p.close()
  }
}
if (!base) {
  await probe.close()
  console.error('No dev server found on :5174/:5173.\nStart it with: pnpm dev  (and the worker: cd ../workers/llm-proxy && npx wrangler dev --port 8788)')
  process.exit(2)
}
console.log(`e2e against ${base}`)

await moneyPath(probe)
await storyHandoff(probe)
await gclidGuards(probe)
await probe.close()

for (const r of results) {
  console.log(`\n■ ${r.name}`)
  for (const c of r.checks) console.log(`  ${c.ok ? '✓' : '✗'} ${c.msg}`)
  for (const w of r.warns) console.log(`  ⚠ ${w}`)
}
console.log(`\n${failures === 0 ? 'ALL GREEN' : `${failures} FAILURE(S)`}`)
process.exit(failures === 0 ? 0 : 1)
