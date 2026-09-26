// A CLIP AT ONE FRAME A SECOND, cheaply: the live wing at the film's tier on a
// small stage, the leg walked by the film's own hook on the film's clock (one
// app frame each 1/30 s, as the export steps it), and a picture kept every
// `every` frames and at the arrival, tiled into one contact sheet with the
// audit's readings under each tile. Not the film's shutter or its held set: a
// sheet to read a walk by, never a frame to ship.
//
//   node forge/film/motion-sheets.mjs --port=5634 --out=<dir> --list=<json> [--audit=<legs.json>] [--every=30]
//     <json>: [{ "clip": "<edge id>", "framing": "wide" | "upright" }, ...]
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import sharp from 'sharp'
import { APP_ROOT, assertServer, browserArgs, FRAME_TIME_FLAGS, waitForServer, wingStanding } from '../rig.mjs'
import { BARE, CHROME_OFF, STILL_DESK, installVirtualClock } from '../prerender/clock.mjs'
import { restingPending } from '../prerender/pending.mjs'
import { FPS, buildGraph } from './graph.mjs'
import { openReplay, replayEdge } from './replay.mjs'

/** the sheet's stage, CSS pixels at one device pixel: the framings' own aspects */
export const SHEET_STAGE = { wide: { width: 640, height: 360 }, upright: { width: 260, height: 563 } }
const COLUMNS = { wide: 5, upright: 8 }
const esc = (s) => String(s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))

function flagsOf(argv) {
  return new Map(argv.filter((a) => a.startsWith('--')).map((a) => { const k = a.indexOf('='); return k < 0 ? [a.slice(2), true] : [a.slice(2, k), a.slice(k + 1)] }))
}

/** one tile's caption: the second, and the audit's readings at that frame when it has them */
function caption(i, rec) {
  const s = `${(i / FPS).toFixed(1)} s`
  if (!rec) return s
  const eye = rec.distances?.[i]
  const v = rec.frames?.reduce((b, f) => (Math.abs(f[0] - i) < Math.abs(b[0] - i) ? f : b), rec.frames[0])
  return `${s}  eye ${eye !== undefined ? Number(eye).toFixed(2) : '-'} m  view ${v ? Number(v[1]).toFixed(2) : '-'} m`
}

async function sheet(tiles, framing, file, title) {
  const { width, height } = SHEET_STAGE[framing]
  const cols = COLUMNS[framing], rows = Math.ceil(tiles.length / cols)
  const pad = 18, head = 26
  const W = cols * width, H = head + rows * (height + pad)
  const parts = []
  for (const [k, t] of tiles.entries()) {
    const x = (k % cols) * width, y = head + Math.floor(k / cols) * (height + pad)
    parts.push({ input: t.png, left: x, top: y })
    parts.push({ input: Buffer.from(`<svg width="${width}" height="${pad}"><rect width="100%" height="100%" fill="#111"/><text x="4" y="13" font-family="Helvetica" font-size="11" fill="#ddd">${esc(t.caption)}</text></svg>`), left: x, top: y + height })
  }
  parts.push({ input: Buffer.from(`<svg width="${W}" height="${head}"><rect width="100%" height="100%" fill="#000"/><text x="6" y="18" font-family="Helvetica" font-size="14" fill="#fff">${esc(title)}</text></svg>`), left: 0, top: 0 })
  await sharp({ create: { width: W, height: H, channels: 3, background: '#000' } }).composite(parts).png({ compressionLevel: 8 }).toFile(file)
}

async function main() {
  const flags = flagsOf(process.argv.slice(2))
  const PORT = Number(flags.get('port') ?? 5634)
  const OUT = resolve(String(flags.get('out')))
  const EVERY = Number(flags.get('every') ?? FPS)
  const list = JSON.parse(readFileSync(String(flags.get('list')), 'utf8'))
  const audit = flags.has('audit') ? new Map(JSON.parse(readFileSync(String(flags.get('audit')), 'utf8')).records.map((r) => [`${r.clip} ${r.framing}`, r])) : new Map()
  mkdirSync(OUT, { recursive: true })
  const log = (s) => console.error(`[${new Date().toTimeString().slice(0, 8)}] ${s}`)
  const replay = await openReplay()
  const graph = buildGraph(replay.wing)
  const nodes = new Map(graph.nodes.map((n) => [n.id, n]))
  const edges = new Map(graph.edges.map((e) => [e.id, e]))
  const BASE = `http://127.0.0.1:${PORT}`
  const server = spawn('pnpm', ['preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore', cwd: APP_ROOT })
  const summary = []
  try {
    await waitForServer(`${BASE}/`)
    await assertServer(BASE)
    const browser = await chromium.launch({ args: [...browserArgs(), ...FRAME_TIME_FLAGS] })
    try {
      for (const framing of ['wide', 'upright']) {
        const mine = list.filter((x) => x.framing === framing && !existsSync(join(OUT, `${edges.get(x.clip)?.stem}-${framing}.png`)))
        if (!mine.length) continue
        const warm = [...new Set(mine.flatMap((x) => [edges.get(x.clip).from, edges.get(x.clip).to]))].map((id) => nodes.get(id))
        const ctx = await browser.newContext({ viewport: SHEET_STAGE[framing], deviceScaleFactor: 1 })
        await ctx.addInitScript(() => { try { sessionStorage.setItem('vinci-welcome', '1') } catch { /* seen */ } })
        await ctx.addInitScript(installVirtualClock)
        const page = await ctx.newPage()
        const errors = []
        page.on('pageerror', (e) => errors.push(e.message.slice(0, 160)))
        await page.goto(`${BASE}/w/vinci?probe=1&tier=max&export=1&order=life&pr=1&desk=${STILL_DESK}#s=${warm[0].station}`, { waitUntil: 'load' })
        if (!(await wingStanding(page))) throw new Error('the wing never stood')
        await page.waitForFunction(() => Boolean(window.__naFilm), null, { timeout: 60000 })
        // THE WARM PASS: every node the sheets touch stood at once, so its rooms are built before the clock
        for (const node of warm) {
          await page.evaluate((n) => window.__naFilm.place(n), node)
          await page.waitForTimeout(1200)
          await restingPending(page, 30000, 4, 400)
        }
        await page.evaluate(() => window.__forge.grain(false))
        await page.addStyleTag({ content: CHROME_OFF })
        await page.evaluate((c) => document.documentElement.classList.add(c), BARE)
        await page.waitForTimeout(500)
        await page.evaluate((fps) => window.__pre.arm(fps), FPS)
        await page.waitForFunction(() => window.__pre.queued() > 0, null, { timeout: 10000 })
        log(`${framing}: the wing stood, ${warm.length} nodes warmed; ${mine.length} sheets`)
        const canvas = page.locator('canvas').first()
        for (const x of mine) {
          const t0 = Date.now()
          const edge = edges.get(x.clip)
          const track = replayEdge(replay, graph, edge, framing)
          const from = nodes.get(edge.from), to = nodes.get(edge.to)
          await page.evaluate((n) => window.__naFilm.place(n), from)
          await page.evaluate(() => { for (let k = 0; k < 3; k++) window.__pre.step() })
          const shoot = async (i) => ({ i, png: await sharp(await canvas.screenshot({ type: 'png' })).resize(SHEET_STAGE[framing].width, SHEET_STAGE[framing].height, { fit: 'fill' }).png().toBuffer() })
          const tiles = [await shoot(0)]
          const asked = await page.evaluate(([a, b, m]) => window.__naFilm.walk(a, b, m), [from, to, edge.motion])
          if (!asked) throw new Error(`${edge.id}: the rail refused the walk`)
          const origin = await page.evaluate(() => {
            for (let k = 0; k < 3 && !window.__naFilm.state().walking; k++) window.__pre.advance(0)
            return window.__pre.virtualTime()
          })
          // the film's own count: the replay drops leading frames that repeat the still; the page's leg began at `origin`
          let i = 0, stood = -1
          for (let k = 1; k < track.arrivedAt + 120; k++) {
            const walking = await page.evaluate((t) => { window.__pre.at(t); return window.__naFilm.state().walking }, origin + (k * 1000) / FPS)
            i = k
            if (k % EVERY === 0) tiles.push(await shoot(k))
            if (!walking) { stood = k; break }
          }
          await page.evaluate(() => { for (let k = 0; k < 3; k++) window.__pre.step() })
          if (tiles.at(-1).i !== i) tiles.push(await shoot(i))
          const rec = audit.get(`${x.clip} ${framing}`)
          for (const t of tiles) t.caption = caption(t.i, rec)
          const file = join(OUT, `${edge.stem}-${framing}.png`)
          await sheet(tiles, framing, file, `${x.clip}  ${framing}  ${(track.arrivedAt / FPS).toFixed(1)} s (page ${(stood / FPS).toFixed(1)} s)  1 frame a ${(EVERY / FPS).toFixed(1)} s`)
          summary.push({ clip: x.clip, framing, file, tiles: tiles.length, replayFrames: track.arrivedAt, pageFrames: stood, seconds: Math.round((Date.now() - t0) / 1000) })
          log(`${x.clip} ${framing}: ${tiles.length} tiles, page ${stood} frames against the replay's ${track.arrivedAt}, ${Math.round((Date.now() - t0) / 1000)} s`)
        }
        if (errors.length) log(`${framing}: page errors ${errors.slice(0, 3).join(' | ')}`)
        await ctx.close()
      }
    } finally { await browser.close() }
  } finally { server.kill('SIGTERM') }
  const file = join(OUT, 'sheets.json')
  const held = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : []
  writeFileSync(file, JSON.stringify([...held.filter((h) => !summary.some((s) => s.clip === h.clip && s.framing === h.framing)), ...summary], null, 1))
}

await main()
