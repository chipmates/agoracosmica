// A LOOK TEST OF THE FAREWELL: the evening at the grave, as stills at the
// film's tier on the stills' stage and as one short clip, chrome off. The eye
// and the evening are held by the wing's `__naFarewell` (export pages only);
// nothing here is certified and nothing is a film render.
//
//   node forge/sunset-frames.mjs <port> <outDir> [stills|clip|both] [poses.json]
//
// Stills land as <outDir>/s<n>-<share>-<framing>.png; the clip as
// <outDir>/clip-<framing>.mp4 (ffmpeg) with its frames in <outDir>/frames-<framing>/.
// poses.json (optional): [{ "name", "share", "eye", "at", "fov" }] scouts poses
// off the farewell's own path. SUNSET_FRAMING=wide|upright shoots one framing.
import { chromium } from 'playwright'
import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { assertServer, browserArgs, waitForServer, wingStanding } from './rig.mjs'
import { BARE, CHROME_OFF, STILL_DESK } from './prerender/clock.mjs'
import { STILL_STAGES } from './film/export.mjs'

const port = Number(process.argv[2] ?? 5750)
const out = resolve(process.argv[3] ?? 'forge/shots/path-pass/sunset')
const mode = process.argv[4] ?? 'stills'
const scout = process.argv[5] ? JSON.parse(readFileSync(process.argv[5], 'utf8')) : null
const only = process.env['SUNSET_FRAMING']
const STILLS = (process.env['SUNSET_SHARES'] ?? '0,.2,.38,.55,.74,1').split(',').map(Number)
const CLIP = { seconds: Number(process.env['SUNSET_SECONDS'] ?? 10), fps: Number(process.env['SUNSET_FPS'] ?? 24) }
/** the clip's own stages: lighter than the stills', the same framings */
const CLIP_STAGES = { wide: { css: { width: 1280, height: 720 }, dsf: 1 }, upright: { css: { width: 390, height: 844 }, dsf: 2 } }
const BASE = `http://localhost:${port}`
mkdirSync(out, { recursive: true })

async function settled(page, ms = 30000) {
  const until = Date.now() + ms
  while (Date.now() < until) {
    if (!(await page.evaluate(() => window.__forge.state().texturesPending))) return true
    await page.waitForTimeout(150)
  }
  return false
}
const frames = (page, n) => page.evaluate((k) => new Promise((done) => { let i = 0; const step = () => (++i >= k ? done() : requestAnimationFrame(step)); requestAnimationFrame(step) }), n)

const problems = []
let browser
const server = spawn('pnpm', ['exec', 'vite', '--port', String(port), '--strictPort'], { stdio: 'ignore' })
async function open(framing, stage) {
  const ctx = await browser.newContext({ viewport: stage.css, deviceScaleFactor: stage.dsf })
  await ctx.addInitScript(() => { try { sessionStorage.setItem('vinci-welcome', '1') } catch { /* seen */ } })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => problems.push(`[${framing}] pageerror: ${e.message.slice(0, 200)}`))
  page.on('console', (m) => { if (m.type() === 'error') problems.push(`[${framing}] console: ${m.text().slice(0, 200)}`) })
  page.on('request', (r) => { const u = r.url(); if (!u.startsWith(BASE) && !u.startsWith('blob:') && !u.startsWith('data:')) problems.push(`[${framing}] off-origin request: ${u}`) })
  await page.route('**/@vite/client', (route) => route.fulfill({ status: 200, contentType: 'application/javascript', body: 'export {}' }))
  await page.goto(`${BASE}/w/vinci?probe=1&tier=max&export=1&order=life&pr=${stage.dsf}&desk=${STILL_DESK}#s=grave`, { waitUntil: 'load' })
  if (!(await wingStanding(page))) throw new Error('the wing never stood')
  const stamp = await page.evaluate(() => ({ backend: document.body.dataset.backend, tier: document.body.dataset.tier }))
  if (stamp.backend !== 'webgpu' || stamp.tier !== 'max') throw new Error(`backend ${stamp.backend}, tier ${stamp.tier}`)
  await page.waitForFunction(() => Boolean(window.__naFarewell), null, { timeout: 60000 })
  await settled(page)
  await page.waitForTimeout(2500)
  await page.evaluate(() => window.__forge.grain(false))
  await page.addStyleTag({ content: CHROME_OFF })
  await page.evaluate((c) => document.documentElement.classList.add(c), BARE)
  return { ctx, page }
}
try {
  await waitForServer(BASE)
  const said = await assertServer(BASE)
  console.log(`server ${said.head.slice(0, 7)} at ${said.root}`)
  browser = await chromium.launch({ args: browserArgs() })
  for (const framing of Object.keys(STILL_STAGES)) {
    if (only && only !== framing) continue
    if (mode === 'stills' || mode === 'both') {
      const { ctx, page } = await open(framing, STILL_STAGES[framing])
      const list = scout ?? STILLS.map((share, i) => ({ name: `s${i + 1}-${share.toFixed(2)}`, share }))
      for (const p of list) {
        const pose = await page.evaluate((q) => window.__naFarewell(q), p)
        if (pose) console.log(`  pose ${p.name}: eye ${pose.eye.map((v) => v.toFixed(2)).join(',')} ground ${pose.ground.toFixed(2)} heading ${pose.heading.toFixed(1)} pitch ${pose.pitch.toFixed(1)} fov ${pose.fov.toFixed(1)}`)
        await frames(page, 4)
        if (!(await settled(page))) problems.push(`[${framing}] ${p.name}: textures still in flight`)
        await page.waitForTimeout(p.settle ?? 1600)
        await page.screenshot({ path: `${out}/${p.name}-${framing}.png`, timeout: 180000 })
        console.log(`${framing} ${p.name}`)
      }
      await ctx.close()
    }
    if (mode === 'clip' || mode === 'both') {
      const { ctx, page } = await open(framing, CLIP_STAGES[framing])
      const dir = `${out}/frames-${framing}`
      mkdirSync(dir, { recursive: true })
      const n = Math.round(CLIP.seconds * CLIP.fps)
      // the first pose drawn and settled before the clock starts
      await page.evaluate(() => window.__naFarewell({ share: 0 }))
      await frames(page, 8); await settled(page); await page.waitForTimeout(1200)
      for (let i = 0; i < n; i++) {
        await page.evaluate((q) => window.__naFarewell(q), { share: i / (n - 1) })
        await frames(page, 3)
        await page.screenshot({ path: `${dir}/${String(i).padStart(4, '0')}.png`, timeout: 180000 })
        if (i % 24 === 0) console.log(`${framing} clip frame ${i}/${n}`)
      }
      await ctx.close()
      const ff = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(CLIP.fps), '-i', `${dir}/%04d.png`,
        '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-preset', 'medium', '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', `${out}/clip-${framing}.mp4`])
      if (ff.status !== 0) problems.push(`[${framing}] ffmpeg: ${String(ff.stderr).slice(0, 200)}`)
      else console.log(`${framing} clip written`)
    }
  }
  if (problems.length) {
    console.log('PROBLEMS:')
    for (const p of [...new Set(problems)]) console.log(' ·', p)
  } else console.log('clean: no console errors, nothing off the origin')
} catch (err) {
  console.error(`REFUSED: ${err.message}`)
  process.exitCode = 1
} finally {
  await browser?.close().catch(() => {})
  server.kill()
}
