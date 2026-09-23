// THE CLOSE VIEW HAS TO ZOOM, in every window that opens one. The viewer
// writes its own magnification into `data-zoom` on the plate's root, so every
// hand that claims to zoom is asked the same question: press it, read the
// number again, and it must have moved. The fit has to bring it home.
//
//   node forge/zoom-check.mjs [port] [--phone] [--lang de] [--kinds work,sheet,leaf]
//   ZOOM_ENGINE=firefox node forge/zoom-check.mjs 5380
//
// Exit 1 names the hand that did not move the plate. A server already
// standing on the port is used; otherwise the check starts its own preview
// and stops it again.
import { chromium, firefox, webkit } from 'playwright'
import { spawn } from 'node:child_process'
import { browserArgs, wingStanding, waitForServer, APP_ROOT } from './rig.mjs'

const flag = name => process.argv.includes(`--${name}`)
const value = (name, fallback) => flag(name) ? process.argv[process.argv.indexOf(`--${name}`) + 1] : fallback
const PORT = Number(process.argv.slice(2).find(a => !a.startsWith('--')) ?? process.env['ZOOM_PORT'] ?? 5199)
const BASE = `http://localhost:${PORT}`
const PHONE = flag('phone')
const LANG = value('lang', 'en')
const KINDS = value('kinds', 'work,sheet,leaf').split(',')
const ENGINE_NAME = process.env['ZOOM_ENGINE'] ?? 'chromium'
const ENGINE = { chromium, firefox, webkit }[ENGINE_NAME]
const VP = PHONE ? { width: 390, height: 844, scale: 2 } : { width: 1440, height: 900, scale: 1 }
const NAME = {
  plate: /the whole plate|die ganze tafel/i,
  whole: /^(whole|ganz)$/i,
  nearer: /^(zoom in|näher)$/i,
  further: /^(zoom out|weiter weg)$/i,
}
/** Where each kind of close view is reached: the station, and the cell of the
 * station's own row that opens it. */
const WHERE = { work: ['picture-room-west', 4], sheet: ['body', 1], leaf: ['reading-table', 0] }

const settled = async page => {
  await page.waitForFunction(() => {
    const wing = document.getElementById('wing')
    return Boolean(wing) && !wing.hasAttribute('data-walking')
  }, null, { timeout: 90000, polling: 200 }).catch(() => {})
  await page.waitForTimeout(1800)
}
const reading = page => page.evaluate(() => {
  const root = document.querySelector('.deep-plate')
  return root ? Number(root.dataset['zoom'] ?? 'NaN') : null
})
const moved = (from, to) => Number.isFinite(from) && Number.isFinite(to) && Math.abs(to - from) > from * 0.02
/** A REAL MOUSE PRESS at the control's own centre: a synthetic click reaches
 * handlers no visitor's pointer can reach. */
async function press(page, control) {
  const box = await control.boundingBox()
  if (!box) return false
  if (box.width < 2 || box.height < 2) return false
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.up()
  await page.waitForTimeout(900)
  return true
}
/** Open one close view of this kind and stand in front of its deep plate. */
async function open(page, kind) {
  const [station, cell] = WHERE[kind]
  await page.evaluate(id => window.__forge.jump('wing', { slug: 'vinci', station: id }), station)
  await settled(page)
  await page.waitForFunction(() => document.querySelectorAll('.vinci-strip-item, .vinci-exhibit-dot, .desk-ov-open').length > 0,
    null, { timeout: 60000 }).catch(() => {})
  // THE DESKTOP'S SET IS ITS OWN VIEW: where the overview's word stands, the
  // row stands down and the same cell is pressed in the view it opens.
  const overview = page.locator('.desk-ov-open')
  if (await overview.count() && await overview.first().isVisible()) {
    await overview.first().click({ timeout: 60000 })
    await page.waitForSelector('.desk-ov', { state: 'visible', timeout: 30000 }).catch(() => {})
  }
  const cells = page.locator('.desk-ov:visible .desk-ov-cell:not([disabled]), .vinci-strip-item:not([disabled])')
  // A row of one does not stand, so its cell is in the page and cannot be
  // pressed: the visible cell decides, never the count.
  if (await cells.count() > cell && await cells.nth(cell).isVisible()) await cells.nth(cell).click({ timeout: 60000 })
  else {
    // A STATION WITH ONE EXHIBIT HAS NO ROW: its one mark stands in the room,
    // and where even that is a body rather than a mark, the exhibit is under
    // the middle of the stage and takes the press the room takes.
    const dots = page.locator('.vinci-exhibit-dot')
    let pressed = false
    for (let at = 0; at < await dots.count(); at++) {
      const dot = dots.nth(at)
      if (!await dot.isVisible()) continue
      if (await press(page, dot)) { pressed = true; break }
    }
    if (!pressed) {
      const view = page.viewportSize()
      await page.mouse.move(view.width / 2, view.height / 2)
      await page.mouse.down(); await page.mouse.up()
      await page.waitForTimeout(1500)
    }
  }
  // the phone's card, or the desktop's band, which stands in the card's place
  await page.waitForSelector(".vitrine-card, #wing[data-desk~='closelook'] .vitrine[data-narrow='false']", { state: 'visible', timeout: 90000 })
  await settled(page)
  // a painting opens its close look first; the whole plate is one press on
  const toPlate = page.getByRole('button', { name: NAME.plate })
  if (await toPlate.count()) {
    // THE PRESS WAITS FOR THE EYE TO STAND AT THE WORK. The card is mounted
    // at the cell's press and the walk is written a frame later, so on slow
    // frames `settled` reads a leg that has not begun; a press during the
    // walk opens nothing. The picture holds only once the eye stands.
    await page.waitForSelector(".vitrine[data-surface='hold']", { state: 'attached', timeout: 90000 }).catch(() => {})
    await press(page, toPlate.first())
    await page.waitForTimeout(1600)
  }
  await page.waitForSelector('.deep-plate', { state: 'attached', timeout: 60000 })
  // THE PHONE FOLDS THE CARD TO A PEEK, and a folded card keeps its own row
  // of controls down: the grabber raises it, which is the visitor's gesture.
  const grab = page.locator('.vitrine-grab')
  if (await grab.count() && await grab.isVisible()
    && !await page.getByRole('button', { name: NAME.nearer }).first().isVisible().catch(() => false)) {
    await press(page, grab.first())
    await page.waitForTimeout(1000)
  }
  await page.waitForFunction(() => Number(document.querySelector('.deep-plate')?.dataset['zoom'] ?? 0) > 0,
    null, { timeout: 60000, polling: 200 })
  await page.waitForTimeout(1200)
}

let server
if (!(await fetch(`${BASE}/`).then(r => r.ok).catch(() => false))) {
  server = spawn('pnpm', ['preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', cwd: APP_ROOT })
  await waitForServer(BASE)
}
const said = { port: PORT, engine: ENGINE_NAME, viewport: PHONE ? 'phone' : 'desktop', lang: LANG, kinds: {}, failures: [] }
const browser = await ENGINE.launch({ args: ENGINE === chromium ? browserArgs() : [] })
try {
  const ctx = await browser.newContext({ viewport: { width: VP.width, height: VP.height }, deviceScaleFactor: VP.scale })
  await ctx.addInitScript(mark => { try { sessionStorage.setItem(mark, '1') } catch { /* refused counts as seen */ } }, 'vinci-welcome')
  const page = await ctx.newPage()
  page.on('pageerror', e => said.failures.push(`page error: ${String(e.message).slice(0, 120)}`))
  await page.goto(`${BASE}/w/vinci?lang=${LANG}#s=picture-room-west`)
  await wingStanding(page)
  await page.waitForFunction(() => document.querySelectorAll('.vinci-strip-item img').length > 0, null, { timeout: 60000 }).catch(() => {})
  await settled(page)

  for (const kind of KINDS) {
    const hands = said.kinds[kind] = {}
    const fail = why => said.failures.push(`${kind}: ${why}`)
    try { await open(page, kind) } catch (error) {
      fail(`no close view (${String(error.message).slice(0, 60)})`)
      // a window left open is the next kind's failure too
      await page.keyboard.press('Escape')
      await page.waitForTimeout(1000)
      await page.keyboard.press('Escape')
      await settled(page)
      continue
    }
    const home = hands.home = await reading(page)
    for (const [hand, name] of [['nearer', NAME.nearer], ['further', NAME.further]]) {
      const from = await reading(page)
      const control = page.getByRole('button', { name }).first()
      // A CONTROL THAT IS NOT THERE IS NOT A BROKEN CONTROL. The phone's
      // reader gives a page the gestures a phone has, a pinch and a double
      // tap, and no row of its own: what this check owes is that every hand
      // the window DOES offer moves the plate.
      if (!await control.count() || !await press(page, control)) {
        if (PHONE) { hands[hand] = 'absent'; continue }
        fail(`${hand}: no control`)
        continue
      }
      const to = await reading(page)
      hands[hand] = { from, to }
      if (!moved(from, to)) fail(`${hand}: the plate did not move, ${from} to ${to}`)
    }
    const stage = await page.locator('.deep-plate').first().boundingBox()
    if (stage) {
      const from = await reading(page)
      await page.mouse.move(stage.x + stage.width / 2, stage.y + stage.height / 2)
      await page.mouse.wheel(0, -240)
      await page.waitForTimeout(900)
      const to = await reading(page)
      hands.wheel = { from, to }
      if (!moved(from, to)) fail(`wheel: the plate did not move, ${from} to ${to}`)
    }
    {
      const from = await reading(page)
      await page.locator('.deep-plate').first().focus()
      await page.keyboard.press('+')
      await page.waitForTimeout(900)
      const to = await reading(page)
      hands.keys = { from, to }
      if (!moved(from, to)) fail(`keys: the plate did not move, ${from} to ${to}`)
    }
    {
      const from = await reading(page)
      const control = page.getByRole('button', { name: NAME.whole }).first()
      if (await control.count() && await press(page, control)) {
        const to = hands.whole = { from, to: await reading(page) }
        if (!Number.isFinite(to.to) || Math.abs(to.to - home) > home * 0.05)
          fail(`whole: the plate did not come home, ${from} to ${to.to} against ${home}`)
      } else if (PHONE) hands.whole = 'absent'
      else fail('whole: no control')
    }
    await page.keyboard.press('Escape')
    await page.waitForTimeout(1000)
    await page.keyboard.press('Escape')
    await settled(page)
  }
  said.ok = said.failures.length === 0
  console.log(JSON.stringify(said, null, 1))
} finally {
  await browser.close()
  if (server) server.kill()
}
process.exit(said.ok ? 0 : 1)
