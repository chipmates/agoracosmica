// Ceremony-aware E2E twin — the flag-ON arm of the flow suite.
//
// run.mjs asserts what production ships today, where a carried question lands
// straight in Free Talk. Four features are built but dark, and they move that
// path: a carried arrival now stops at the mode ceremony, the figure answers
// instead of greeting, the answer carries its provenance, and the nav
// affordances count their own use. This suite walks the same critical paths
// with those flags on and asserts the events they emit, so a flip can be
// verified before and after it happens rather than watched in production.
//
// Flags exercised (all default ON in dev, dark in a production build):
//   CEREMONY_CARRIED_ENTRY  carried arrival stops at the doors
//   ANSWER_FIRST_REPLY      greeting suppressed while a question waits, 10s sitter
//   ANSWER_PROVENANCE       provenance chip + standing chapter door
//   NAV_BATCH               mode chip reopens the doors
//
// Prerequisites (run from client/):
//   1. pnpm dev                        (dev defaults = the four flags on)
//   2. cd ../workers/llm-proxy && npx wrangler dev --port 8788
// Then:  pnpm test:e2e:ceremony

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

// A public-page question door: figure preselected, question carried along.
const CARRIED = '/app?lang=de&figure=marcus-aurelius&ask=hero'
// The same figure with nothing carried, which is the plain first-contact path.
const PLAIN = '/app?lang=de&figure=marcus-aurelius'

// The sitter plays the greeting 10s after a carried arrival that never sends.
// Waited out once, with room for a slow dev build.
const SITTER_WAIT_MS = 13000

/**
 * Collect the funnel beacons a page emits. They are answered locally so the
 * assertions read the client's intent, not the worker's mood.
 */
function trackFunnel(page) {
  const steps = []
  page.route('**/v1/funnel', (route) => {
    try {
      steps.push(JSON.parse(route.request().postData() || '{}'))
    } catch {
      steps.push({})
    }
    route.fulfill({ status: 204, body: '' })
  })
  return steps
}

/** Collect the chat request bodies, without touching the real reply. */
function trackChat(page) {
  const bodies = []
  page.on('request', (r) => {
    if (!r.url().includes('/v1/chat')) return
    try {
      bodies.push(JSON.parse(r.postData() || '{}'))
    } catch {
      bodies.push({})
    }
  })
  return bodies
}

const named = (steps, name) => steps.filter((s) => s.step === name)
const trail = (steps) => steps.map((s) => `${s.step}${s.mode ? `/${s.mode}` : ''}`).join(', ')

// ---------- Spec 1: carried arrival: doors, blue door, prefilled composer, the wire
async function ceremonyCarried(browser, flagState) {
  spec('ceremony-carried')

  const a = await newPage(browser, CARRIED)
  const funnel = trackFunnel(a.page)
  const chats = trackChat(a.page)
  await passGate(a.page)
  await a.page.waitForTimeout(1000)

  const doors = a.page.locator('.doors')
  const atCeremony = await doors.isVisible().catch(() => false)
  // A flag-off server sends this arrival straight to a prefilled composer,
  // which is run.mjs's job to assert. Say so instead of failing 12 times.
  if (!atCeremony) {
    const composer = await a.page.locator('textarea').first().inputValue().catch(() => '')
    if (composer.length > 10) {
      flagState.ceremonyOff = true
      await a.ctx.close()
      return
    }
  }
  await check(atCeremony, 'a carried arrival stops at the mode ceremony')

  const staged = await a.page.locator('.doors-staged-text').first().textContent().catch(() => '')
  await check(
    (staged || '').trim().length > 10,
    `the ceremony holds the carried question (got: "${(staged || '').trim().slice(0, 40)}…")`
  )
  // The question must survive the overlay: a composer mounted behind the doors
  // would consume it and leave the story door with nothing to carry.
  await check(
    (await a.page.locator('textarea').count()) === 0,
    'no composer is mounted behind the doors, so the question cannot be consumed early'
  )

  await a.page.locator('.doors-door--talk').first().click().catch(() => {})
  await a.page.waitForTimeout(3000)
  await dismissHelpers(a.page)

  const composer = a.page.locator('textarea').first()
  await composer.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {})
  const prefill = await composer.inputValue().catch(() => '')
  await check(prefill.length > 10, `the blue door hands the question to the composer (got: "${prefill.slice(0, 40)}…")`)
  await check(
    (await a.page.locator('.message.assistant').count()) === 0,
    'the greeting stays out of the way while the question waits'
  )

  const reply = await sendComposer(a.page, composer)
  const status = reply ? reply.status() : null
  // 429 = the dev worker's DEV_RATE_LIMIT — the pipeline is wired, quota is spent.
  await check(status === 200 || status === 429, `sending the carried question reaches /v1/chat (status: ${status})`)
  if (status === 429) warn('dev worker rate limit hit — restart wrangler to test a real reply')

  const sent = chats[0] || {}
  await check(sent.kind === 'prefilled', `the wire calls the send prefilled (kind: ${sent.kind})`)
  await check(sent.entry === 'carried', `the wire calls the entry carried (entry: ${sent.entry})`)

  await a.page.waitForTimeout(2000)
  await check(
    named(funnel, 'welcome_shown').some((s) => s.mode === 'ask'),
    `welcome_shown carries the ask arrival class (trail: ${trail(funnel)})`
  )
  await check(named(funnel, 'mode_selected').length > 0, 'the door pick counts as mode_selected')
  await check(named(funnel, 'first_turn_prefilled').length === 1, 'a carried send fires first_turn_prefilled once')
  await check(named(funnel, 'first_turn').length === 0, 'a carried send never fires first_turn')

  for (const issue of a.consoleIssues) warn(`console: ${issue}`)
  await a.ctx.close()
}

// ---------- Spec 2: plain arrival: doors without a question, gold door opens the story
async function ceremonyDoors(browser) {
  spec('ceremony-doors')

  const b = await newPage(browser, PLAIN)
  const funnel = trackFunnel(b.page)
  await passGate(b.page)
  await b.page.waitForTimeout(1000)

  await check(
    await b.page.locator('.doors').isVisible().catch(() => false),
    'a plain figure arrival opens the doors'
  )
  await check(
    (await b.page.locator('.doors-staged-text').count()) === 0,
    'nothing is staged when no question was carried'
  )

  await b.page.locator('.doors-door--story').first().click().catch(() => {})
  await b.page.waitForTimeout(3500)
  await dismissHelpers(b.page)
  await check(
    (await b.page.locator('.story-scrollable-native').count()) > 0,
    'the gold door opens the story'
  )
  await check(
    named(funnel, 'welcome_shown').some((s) => s.mode === 'figure'),
    `welcome_shown carries the figure arrival class (trail: ${trail(funnel)})`
  )
  await check(
    named(funnel, 'mode_selected').some((s) => s.mode === 'introduction'),
    'the gold door counts as mode_selected with the story mode'
  )

  for (const issue of b.consoleIssues) warn(`console: ${issue}`)
  await b.ctx.close()
}

// ---------- Spec 3: the nav events that are dark today
async function navEvents(browser) {
  spec('nav-events')

  // The mode chip: the only way back to the doors from a running mode.
  const c = await newPage(browser, PLAIN)
  const chipFunnel = trackFunnel(c.page)
  await passGate(c.page)
  await c.page.waitForTimeout(1000)
  await c.page.locator('.doors-door--story').first().click().catch(() => {})
  await c.page.waitForTimeout(3500)
  await dismissHelpers(c.page)

  const chip = c.page.locator('.mode-indicator-button').first()
  await check(await chip.isVisible().catch(() => false), 'the mode chip is pressable, not decoration')
  await chip.click().catch(() => {})
  await c.page.waitForTimeout(2000)
  await check(
    await c.page.locator('.mode-selector-overlay').isVisible().catch(() => false),
    'the mode chip reopens the doors'
  )
  await check(
    named(chipFunnel, 'nav_open').some((s) => s.mode === 'chip'),
    `the mode chip counts itself as nav_open (trail: ${trail(chipFunnel)})`
  )
  await c.ctx.close()

  // Provenance: the answer to a carried question says which chapter grounds it.
  const d = await newPage(browser, CARRIED)
  const provFunnel = trackFunnel(d.page)
  await passGate(d.page)
  await d.page.waitForTimeout(1000)
  await d.page.locator('.doors-door--talk').first().click().catch(() => {})
  await d.page.waitForTimeout(3000)
  await dismissHelpers(d.page)
  const reply = await sendComposer(d.page, d.page.locator('textarea').first())
  const status = reply ? reply.status() : null

  if (status !== 200) {
    // The chip rides a real reply. Without one there is nothing to assert, and
    // a red here would only be reporting the dev worker's quota.
    warn(`no reply from the dev worker (status: ${status}) — provenance checks skipped`)
    await d.ctx.close()
    return
  }

  await d.page.waitForTimeout(6000)
  const hasChip = (await d.page.locator('.provenance-chip').count()) > 0
  await check(hasChip, 'the answered question carries a provenance chip')
  await check(
    (await d.page.locator('.chapter-door').count()) > 0,
    'the chapter door stands beside the conversation'
  )

  if (hasChip) {
    await d.page.locator('.provenance-chip').first().click().catch(() => {})
    await d.page.waitForTimeout(2500)
    await check(
      named(provFunnel, 'nav_open').some((s) => s.mode === 'provenance_chip'),
      `the provenance chip counts itself as nav_open (trail: ${trail(provFunnel)})`
    )
    await check(
      named(provFunnel, 'mode_selected').some((s) => s.mode === 'introduction'),
      'tapping the chip opens that chapter of the story'
    )
  }
  await d.ctx.close()
}

// ---------- Spec 4: the greeting still arrives for a visitor who sits with the question
async function greetingSitter(browser) {
  spec('greeting-sitter')

  const e = await newPage(browser, CARRIED)
  await passGate(e.page)
  await e.page.waitForTimeout(1000)
  await e.page.locator('.doors-door--talk').first().click().catch(() => {})
  await e.page.waitForTimeout(3000)
  await dismissHelpers(e.page)
  await check(
    (await e.page.locator('.message.assistant').count()) === 0,
    'nothing has been said yet while the question sits unsent'
  )

  await e.page.waitForTimeout(SITTER_WAIT_MS)
  await check(
    (await e.page.locator('.message.assistant').count()) > 0,
    'the greeting arrives for a visitor who never sends'
  )
  await check(
    (await e.page.locator('textarea').first().inputValue().catch(() => '')).length > 10,
    'the question is still in the composer after the greeting'
  )
  await e.ctx.close()
}

// ---------- main
const probe = await chromium.launch()
const base = await findBase(probe)
if (!base) {
  await probe.close()
  console.error('No dev server found on :5174/:5173.\nStart it with: pnpm dev  (and the worker: cd ../workers/llm-proxy && npx wrangler dev --port 8788)')
  process.exit(2)
}
console.log(`e2e twin (flags on) against ${base}`)

const flagState = { ceremonyOff: false }
await ceremonyCarried(probe, flagState)
if (flagState.ceremonyOff) {
  await probe.close()
  console.error(
    'This dev server has CEREMONY_CARRIED_ENTRY off: the carried arrival went straight\n' +
    'to a prefilled composer. That is run.mjs\'s arm. Restart the server with the dev\n' +
    'defaults (plain: pnpm dev) and run this suite again.'
  )
  process.exit(2)
}
await ceremonyDoors(probe)
await navEvents(probe)
await greetingSitter(probe)
await probe.close()

process.exit(report())
