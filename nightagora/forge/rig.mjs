// WHAT EVERY RIG AGREES ON. One file, so the flags, the assertions and the
// naming cannot drift between the three eyes that use them.
import { execSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/* THE FLAGS THAT PUT CHROMIUM ON THE METAL GPU.
   `--enable-unsafe-webgpu` alone hands back an adapter, and it is
   SwiftShader: a CPU rasterizer that answers every limit generously and
   renders none of it, so every frame time the rig prints would be fiction.
   `--use-angle=metal` is the one that matters; the other two make the
   feature explicit rather than implied. Verified on this machine: with
   `--use-angle=metal` the adapter reports architecture `metal-3` and a 4 GB
   max buffer size, without it `swiftshader` and 1 GB. */
export const GPU_FLAGS = [
  '--enable-unsafe-webgpu',
  '--use-angle=metal',
  '--enable-features=WebGPU',
  '--ignore-gpu-blocklist',
]

/** the WebGL2 path is tested by taking the flags away: without them the
    adapter request fails, the app falls back through forceWebGL, and the same
    node graph has to compile on the other backend */
export function browserArgs(want = process.env['FORGE_BACKEND'] ?? 'webgpu') {
  return want === 'webgl2' ? [] : GPU_FLAGS
}

export const VIEWPORTS = {
  desktop: { tag: 'desktop', width: 1512, height: 950, deviceScaleFactor: 1 },
  mobile: { tag: 'mobile', width: 390, height: 844, deviceScaleFactor: 2 },
}

export const TIERS = ['hero', 'standard', 'calm']

export function headHere() {
  try {
    return execSync('git rev-parse HEAD', {
      cwd: APP_ROOT,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim()
  } catch {
    return 'unknown'
  }
}

/**
 * Refuse to shoot a server that is not ours. A busy port made the rig lie
 * three times this year; the cost of being sure is one fetch.
 */
export async function assertServer(base) {
  let said
  try {
    const res = await fetch(`${base}/__forge/whoami`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    said = await res.json()
  } catch (err) {
    throw new Error(
      `the server on ${base} does not answer /__forge/whoami (${err.message}). ` +
        'Either it is not this app, or the whoami plugin is not installed.'
    )
  }
  const want = headHere()
  if (said.root !== APP_ROOT) {
    throw new Error(`the server on ${base} serves ${said.root}, this rig is ${APP_ROOT}`)
  }
  if (said.head !== want) {
    throw new Error(`the server on ${base} is at ${said.head}, this checkout is at ${want}`)
  }
  return said
}

export async function waitForServer(url, tries = 120) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 300))
  }
  throw new Error(`no server on ${url}`)
}

/**
 * What the app said about itself in its own first console line, and whether
 * it is what was asked for. A frame shot on the CPU rasterizer looks exactly
 * like a frame shot on the GPU and costs twenty times as much: only the
 * adapter's own word tells them apart.
 */
export async function assertBackend(page, want = process.env['FORGE_BACKEND'] ?? 'webgpu') {
  const said = await page.evaluate(() => ({
    backend: document.body.dataset.backend,
    tier: document.body.dataset.tier,
  }))
  if (said.backend !== want) {
    throw new Error(`backend=${said.backend}, expected ${want}`)
  }
  return said
}

export function assertAdapter(line, want) {
  if (want !== 'webgpu') return
  const m = /adapter=(\S+)/.exec(line ?? '')
  if (!m) throw new Error('the app never printed its adapter line')
  if (/swiftshader|lavapipe|llvmpipe|software/i.test(m[1])) {
    throw new Error(`adapter=${m[1]}: this is the CPU rasterizer, not the GPU`)
  }
}

/* THE SWATCH ROUTE. The library's own page is not a station of the museum:
   it has its own address, its own forge hook, and no place on the wheel. A
   state that names it carries all three, so one eye shoots both routes and
   the assertions cannot drift apart. */
export const SWATCH_PATH = '/swatches.html'
export const SWATCH_HOOK = '__forgeSwatch'
export const MODEL_PATH = '/models.html'
export const MODEL_HOOK = '__forgeModels'

/**
 * States may be given as JSON, or in the shorthand the briefs are written
 * in: `[transit, held, pane vinci, wing vinci]`, where the first word is the
 * state and the second is its slug. `swatch <set>` is the material library's
 * route and `model <slug>` is the model library's.
 *
 * JSON may also carry `path` (the address to shoot it at, `/` by default)
 * and `hook` (the window property the rig drives, `__forge` by default).
 */
export function parseStates(arg) {
  const text = (arg ?? '').trim()
  if (!text) return []
  try {
    return JSON.parse(text)
  } catch {
    /* the shorthand, then */
  }
  return text
    .replace(/^\[/, '')
    .replace(/\]$/, '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const [phase, slug] = s.split(/\s+/)
      if (phase === 'model') {
        return {
          name: `model-${slug}`,
          phase,
          opts: { model: slug },
          // its own address per model, for the reason a swatch has one: a
          // sweep that switched models inside one page would end holding
          // the whole library on the GPU at once
          path: `${MODEL_PATH}?model=${slug}`,
          hook: MODEL_HOOK,
          cone: false,
        }
      }
      if (phase === 'swatch') {
        return {
          name: `swatch-${slug}`,
          phase,
          opts: { set: slug },
          // its own address per set: a sweep that switched sets inside one
          // page would end holding the whole library on the GPU at once
          path: `${SWATCH_PATH}?set=${slug}`,
          hook: SWATCH_HOOK,
          cone: false,
        }
      }
      return {
        name: slug ? `${phase}-${slug}` : phase,
        phase,
        opts: slug ? { slug } : {},
      }
    })
}

/** the tier is part of a frame's name because it is part of what it shows */
export function shotName(viewport, tier, state) {
  return `${viewport}-${tier}-${state}.png`
}

/* THE LOOK CONE. A station is not one frame, it is everything a hand can
   turn the gaze onto while standing there, and a wall that was never
   dressed hides in the corner of that envelope. So a state may declare the
   drag envelope it is judged on, and the rig shoots its four corners. */
export const DEFAULT_CONE = { yaw: [-35, 35], pitch: [-15, 10] }

/** the four corners of a cone, in the order they are numbered on disk */
export function coneCorners(cone = DEFAULT_CONE) {
  const [y0, y1] = cone.yaw ?? DEFAULT_CONE.yaw
  const [p0, p1] = cone.pitch ?? DEFAULT_CONE.pitch
  return [
    { n: 1, yaw: y0, pitch: p1 },
    { n: 2, yaw: y1, pitch: p1 },
    { n: 3, yaw: y1, pitch: p0 },
    { n: 4, yaw: y0, pitch: p0 },
  ]
}

/** which states this run shoots corners for: the ones that declare a cone,
    plus whatever FORGE_CONE names (`all`, or a comma separated list) */
export function coneFor(state) {
  if (state.cone === false) return null
  if (state.cone && typeof state.cone === 'object') return state.cone
  const asked = (process.env['FORGE_CONE'] ?? '').trim()
  if (!asked) return state.cone === true ? DEFAULT_CONE : null
  if (asked === 'all' || asked === '1') return DEFAULT_CONE
  const names = asked.split(',').map((s) => s.trim())
  return names.includes(state.name) || names.includes(state.phase) ? DEFAULT_CONE : null
}
