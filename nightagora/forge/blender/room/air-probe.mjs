// THE ENGINE'S AIR, MEASURED: the same stop shot with the hall's air drawn and
// with its material switched off, and the difference, so the air the engine
// really adds can be set beside the air Cycles adds.
//   FORGE_PORT=5437 node forge/blender/room/air-probe.mjs --stop=flight --out=<dir>
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import sharp from 'sharp'
import { assertServer, browserArgs, wingStanding } from '../../rig.mjs'
import { installSceneHook, machinesStanding } from './page-scan.mjs'
import { ROOMS } from './rooms.mjs'

const flags = new Map(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => { const i = a.indexOf('='); return i < 0 ? [a.slice(2), true] : [a.slice(2, i), a.slice(i + 1)] }))
const PORT = Number(flags.get('port') ?? process.env['FORGE_PORT'] ?? 5437)
const BASE = `http://127.0.0.1:${PORT}`
const room = ROOMS[String(flags.get('room') ?? 'hall')]
const stop = String(flags.get('stop') ?? room.stops[0])
const OUT = resolve(String(flags.get('out') ?? 'air-probe'))

await assertServer(BASE)
mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch({ args: browserArgs() })
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 })
await ctx.addInitScript((f) => { try { sessionStorage.setItem(f, '1') } catch { /* seen */ } }, `${room.wing}-welcome`)
await ctx.addInitScript(installSceneHook)
const page = await ctx.newPage()
await page.goto(`${BASE}/w/${room.wing}?probe=1&tier=hero&samples=4#s=${stop}`, { waitUntil: 'load' })
if (!(await wingStanding(page))) throw new Error('the wing never stood')
await page.evaluate((s) => window.__forge.station(s), stop)
for (let i = 0; i < 120; i++) {
  const r = await page.evaluate(machinesStanding, room.machines)
  if (Object.values(r.counts).every((n) => n > 0)) break
  await page.waitForTimeout(2000)
}
await page.waitForTimeout(8000)
await page.evaluate(() => window.__forge.grain(false))
await page.addStyleTag({ content: 'body > *:not(canvas):not(#stage):not(.stage) { visibility: hidden !important }' })
const shot = async (name) => { await page.waitForTimeout(1500); await page.screenshot({ path: join(OUT, `${name}.png`) }) }
const air = (on) => page.evaluate(([name, on]) => {
  for (const s of window.__roomExport.scenes) s.traverse((o) => { if (o.name === name && o.material) o.material.visible = on })
}, [room.air.name, on])
await shot('with-air')
await air(false)
await shot('without-air')
await air(true)
await shot('with-air-again')
await browser.close()
const [a, b] = await Promise.all(['with-air', 'without-air'].map((n) => sharp(join(OUT, `${n}.png`)).removeAlpha().raw().toBuffer({ resolveWithObject: true })))
const d = Buffer.alloc(a.data.length)
let sum = 0, max = 0
for (let i = 0; i < d.length; i++) { const v = Math.max(0, a.data[i] - b.data[i]); d[i] = Math.min(255, v * 4); sum += v; max = Math.max(max, v) }
await sharp(d, { raw: { width: a.info.width, height: a.info.height, channels: 3 } }).png().toFile(join(OUT, 'air-x4.png'))
console.log(`the engine's air at ${stop}: mean ${(sum / d.length).toFixed(2)} of 255, max ${max}`)
