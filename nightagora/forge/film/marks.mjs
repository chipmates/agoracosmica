// THE MARKS OF THE FILM'S NODES, read off the live picture through the seam's
// live side (`window.__naPicture`, the export's address only): each node stood
// at on a stage whose picture box is the authored frame, its marks read in
// both languages and kept in the master's own fractions, with the camera
// print they stood on so a still and its marks can be proved one projection.
//
//   node forge/film/marks.mjs --port=5514 --nodes=<id,id> --out=<file>
//
// The desktop reads with its band under the picture and the box at 1280 by 720;
// the phone reads at 390 by 844 with its old card, row and bar struck, so the
// film's own chrome decides which marks it covers. It shoots a running server
// of this checkout and starts none.
import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { browserArgs, wingStanding } from '../rig.mjs'

const flags = new Map(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
  const at = a.indexOf('=')
  return at < 0 ? [a.slice(2), true] : [a.slice(2, at), a.slice(at + 1)]
}))
const PORT = Number(flags.get('port') ?? process.env['FORGE_PORT'] ?? 5199)
const BASE = String(flags.get('base') ?? `http://127.0.0.1:${PORT}`)
const NODES = String(flags.get('nodes') ?? '').split(',').map((s) => s.trim()).filter(Boolean)
const OUT = resolve(String(flags.get('out') ?? 'marks.json'))
const LANGS = String(flags.get('langs') ?? 'en,de').split(',')
const FRAMINGS = String(flags.get('framings') ?? 'wide,upright').split(',')
if (!NODES.length) throw new Error('name the nodes: --nodes=stop:flight,view:machine/aerial-screw')

const AUTHORED = { wide: [1280, 720], upright: [390, 844] }
const round = (n, p = 5) => Math.round(n * 10 ** p) / 10 ** p
/** the box's pixels back into the master's own fractions, through the cover crop */
function toMaster(framing, box, x, y) {
  const [w, h] = AUTHORED[framing], aspect = w / h
  const height = Math.max(box.height, box.width / aspect), width = height * aspect
  const cx = (box.width - width) / 2, cy = (box.height - height) / 2
  return { u: round((x - cx) / width), v: round((y - cy) / height) }
}

/** the old phone chrome struck, so no mark is refused for standing under it */
function strikeOldPhoneChrome() {
  for (const sel of ['.vinci-heading', '.vinci-strip', '.wing-rail-group']) for (const el of document.querySelectorAll(sel)) el.hidden = true
}

async function settle(page, framing) {
  // the marks settle once the eye stands; a machine's own mark lands when it stands
  let last = '', same = 0
  for (let i = 0; i < 80; i++) {
    if (framing === 'upright') await page.evaluate(strikeOldPhoneChrome)
    await page.waitForTimeout(250)
    const now = await page.evaluate(() => JSON.stringify(window.__naPicture.marks('', 'en').map((m) => [m.id, Math.round(m.x), Math.round(m.y)])))
    same = now === last ? same + 1 : 0
    last = now
    if (same >= 6) return true
  }
  return false
}

const out = { format: 'vinci-film-marks-v1', base: BASE, read: {}, nodes: {}, prints: {} }
const browser = await chromium.launch({ args: browserArgs() })
try {
  for (const framing of FRAMINGS) {
    for (const lang of LANGS) {
      const [w, h] = AUTHORED[framing]
      const ctx = await browser.newContext({ viewport: { width: w, height: framing === 'wide' ? h + 200 : h }, deviceScaleFactor: 1 })
      await ctx.addInitScript(() => { try { sessionStorage.setItem('vinci-welcome', '1'); localStorage.setItem('agc_probe', '1') } catch { /* seen */ } })
      const page = await ctx.newPage()
      const errors = []
      page.on('pageerror', (e) => errors.push(e.message.slice(0, 160)))
      const desk = framing === 'wide' ? '&desk=all' : ''
      await page.goto(`${BASE}/w/vinci?probe=1&export=1&tier=hero&order=life&lang=${lang}${desk}#s=${NODES[0].replace(/^stop:/, '')}`, { waitUntil: 'load' })
      if (!(await wingStanding(page))) throw new Error('the wing never stood')
      await page.waitForFunction(() => Boolean(window.__naPicture), null, { timeout: 60000 })
      const read = []
      for (const node of NODES) {
        await page.evaluate((n) => window.__naPicture.go(n), node)
        if (framing === 'wide') {
          // the picture box is the authored frame: the band's own height is added to the window
          for (let k = 0; k < 3; k++) {
            const band = await page.evaluate(() => innerHeight - window.__naPicture.box().height)
            const want = h + band
            const vh = page.viewportSize().height
            if (Math.abs(vh - want) < 1) break
            await page.setViewportSize({ width: w, height: want })
            await page.waitForTimeout(700)
            await page.evaluate((n) => window.__naPicture.go(n), node)
          }
        }
        const settled = await settle(page, framing)
        const box = await page.evaluate(() => window.__naPicture.box())
        const marks = await page.evaluate((l) => window.__naPicture.marks('', l), lang)
        const cam = await page.evaluate(() => window.__forge.state().cam)
        const print = [...cam.p, ...cam.r, cam.fov].map((v) => round(v, 4)).join(',')
        out.nodes[node] ??= {}
        out.nodes[node][framing] ??= {}
        out.nodes[node][framing][lang] = marks.map((m) => ({ id: m.id, ...toMaster(framing, box, m.x, m.y), walks: m.walks, label: m.label, word: m.word, colour: m.colour }))
        out.prints[node] ??= {}
        out.prints[node][framing] = print
        read.push({ node, box, settled, marks: marks.length })
        console.error(`  ${framing} ${lang} ${node}: ${marks.length} marks on a ${box.width}x${box.height} box${settled ? '' : ' (not settled)'}`)
      }
      out.read[`${framing} ${lang}`] = { errors, read }
      await ctx.close()
    }
  }
} finally {
  await browser.close()
}
writeFileSync(OUT, JSON.stringify(out, null, 1))
console.log(`marks of ${NODES.length} nodes written to ${OUT}`)
