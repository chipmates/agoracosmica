// E2E flow suite — the executable "don't break anything" net for the app's
// money path, the story→Chapter-2 handoff, and the gclid consent guards.
//
// This is the flag-OFF arm: it asserts the behavior production ships today.
// A carried question lands straight in Free Talk here, so the suite fails on a
// flag-on server by design. The flag-on twin is run-ceremony.mjs.
//
// Prerequisites (run from client/):
//   1. pnpm dev:flags-off              (dev server with every dark flag off)
//   2. cd ../workers/llm-proxy && npx wrangler dev --port 8788
// Then:  pnpm test:e2e

import {
  chromium,
  check,
  dismissHelpers,
  findBase,
  newPage,
  passGate,
  report,
  sendComposer,
  spec,
  warn,
} from './harness.mjs'

const GCLID = 'E2ETESTGCLID1234567890'
const CONSENT_GRANTED = JSON.stringify({ granted: true, version: '1.0.0', timestamp: 0 })

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

  const reply = await sendComposer(b.page, composer)
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
const base = await findBase(probe)
if (!base) {
  await probe.close()
  console.error('No dev server found on :5174/:5173.\nStart it with: pnpm dev  (and the worker: cd ../workers/llm-proxy && npx wrangler dev --port 8788)')
  process.exit(2)
}
console.log(`e2e (flags off) against ${base}`)

await moneyPath(probe)
await storyHandoff(probe)
await gclidGuards(probe)
await probe.close()

process.exit(report())
