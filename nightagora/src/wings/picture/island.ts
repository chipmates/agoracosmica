/* THE MACHINE'S ISLAND OR ITS FILMED CYCLE, chosen by the device
   (RENDER-GRAPH §8.2, the owner's D2). The live island opens where a device
   passes the line: its first frame on the glass within two seconds of the
   close look opening, then thirty frames a second. The filmed cycle stands
   everywhere else, and it is a phone's default until a real phone has passed.
   An island that cannot hold the frame rate hands over to the filmed cycle at
   the step it stood at, and the device keeps that answer for the rest of its
   visits. A slow first frame alone is read and said, never handed over: by the
   time it is known the island is already on the glass, and a cold first visit
   fetches the island's own code. */

import type { VitrinePayload, VitrinePayloadHost, VitrineSurface } from '../vitrine/types'

export type IslandMode = 'live' | 'filmed'

/** THE LINE, as the design gives it. */
export const ISLAND_LINE = { openMs: 2000, fps: 30 } as const
/** the phones a real device has passed the line on; the owner's iPhone and a
    cheap Android decide, and until one passes a phone is shown the film */
export const PHONES_PASSED: readonly string[] = []
/** the window the frame rate is counted over, after the first frame settles */
const COUNT = { settleMs: 500, windowMs: 2000 }
/** a device that missed once keeps the film: the answer is stored under this */
const KEPT = 'na-island'

export interface IslandChoice { mode: IslandMode; why: 'address' | 'missed' | 'phone' | 'software' | 'device' }

/** a phone, by the hand and the glass: a coarse pointer on a small screen, or a glass held upright */
export function phoneClass(): boolean {
  const coarse = matchMedia('(pointer: coarse)').matches
  const small = Math.min(screen.width || innerWidth, screen.height || innerHeight) < 700
  return (coarse && small) || innerWidth / innerHeight <= 0.9
}

export function islandChoice(stack: { architecture: string }): IslandChoice {
  const address = new URLSearchParams(location.search)
  // the recording draws the island itself, on whatever stage it is shot
  if (address.has('export')) return { mode: 'live', why: 'address' }
  const asked = address.get('island')
  if (asked === 'live' || asked === 'filmed') return { mode: asked, why: 'address' }
  let kept: string | null = null
  try { kept = localStorage.getItem(KEPT) } catch { /* a closed store keeps nothing */ }
  if (kept === 'filmed') return { mode: 'filmed', why: 'missed' }
  if (/swiftshader|software|llvmpipe/i.test(stack.architecture)) return { mode: 'filmed', why: 'software' }
  if (phoneClass() && !PHONES_PASSED.length) return { mode: 'filmed', why: 'phone' }
  return { mode: 'live', why: 'device' }
}

export interface IslandReading {
  mode: IslandMode
  why: IslandChoice['why']
  /** from the close look opening to the island's first frame on the glass */
  openMs: number | null
  /** frames a second over the counted window, once it has run */
  fps: number | null
  /** the slowest frame of that window */
  worstMs: number | null
  verdict: 'counting' | 'pass' | 'miss' | null
  handedOver: boolean
}

/** A payload that can stand down for another in the same window: the live
    island first, the filmed cycle after a miss. */
export interface IslandPayload extends VitrinePayload {
  reading(): IslandReading
}

export function createIslandPayload(options: {
  choice: IslandChoice
  live: () => VitrinePayload
  /** the filmed cycle landed at a step, or null where the release has none */
  filmed: ((step: number) => VitrinePayload | null) | null
  /** the step the live island stands at when it misses */
  stepOf: () => number
  /** when the visitor asked for the close look: the island's own code is fetched after it */
  asked: number
}): IslandPayload {
  const reading: IslandReading = { mode: options.choice.mode, why: options.choice.why, openMs: null, fps: null, worstMs: null,
    verdict: options.choice.mode === 'live' ? 'counting' : null, handedOver: false }
  let inner: VitrinePayload | null = null
  let host: VitrinePayloadHost | undefined
  let opened = 0, own = 0, frames = 0, firstShown = 0, worst = 0, last = 0
  const forced = options.choice.why === 'address'

  function mountInner(payload: VitrinePayload, into: VitrinePayloadHost): void {
    inner = payload
    // the island says when it takes the stage: that is the frame the count starts from
    payload.mount({ ...into, surface: (kind: VitrineSurface) => { if (kind === 'own' && !own) own = performance.now(); into.surface(kind) } })
  }
  function handOver(): void {
    if (!host || !options.filmed) return
    const step = options.stepOf()
    const next = options.filmed(Math.max(0, step))
    if (!next) return
    inner?.unmount()
    host.element.textContent = ''
    host.controls.textContent = ''
    host.aside.textContent = ''
    host.caption.textContent = ''
    reading.handedOver = true
    reading.mode = 'filmed'
    mountInner(next, host)
  }
  function count(now: number): void {
    if (reading.verdict !== 'counting' || !own) return
    // the first frame is on the glass when the frame after the one that drew it begins
    if (!firstShown) {
      firstShown = now
      reading.openMs = Math.round(firstShown - opened)
      last = now
      return
    }
    const since = now - firstShown
    if (since >= COUNT.settleMs) {
      frames++
      worst = Math.max(worst, now - last)
    }
    last = now
    if (since < COUNT.settleMs + COUNT.windowMs) return
    reading.fps = Math.round((frames / (COUNT.windowMs / 1000)) * 10) / 10
    reading.worstMs = Math.round(worst)
    const held = reading.fps >= ISLAND_LINE.fps * 0.95
    const pass = (reading.openMs ?? Infinity) <= ISLAND_LINE.openMs && held
    reading.verdict = pass ? 'pass' : 'miss'
    if (held || forced) return
    try { localStorage.setItem(KEPT, 'filmed') } catch { /* the answer lives for this visit only */ }
    handOver()
  }

  return {
    get kind() { return inner?.kind ?? 'machine' },
    get fill() { return inner?.fill },
    mount(next) {
      host = next
      opened = options.asked
      if (options.choice.mode === 'filmed') {
        const filmed = options.filmed?.(0) ?? null
        if (filmed) { mountInner(filmed, next); return }
        // a release without this machine's cycle leaves the island as the one picture there is
        reading.mode = 'live'
        reading.verdict = 'counting'
      }
      mountInner(options.live(), next)
    },
    update(dt) {
      inner?.update?.(dt)
      if (reading.mode === 'live') count(performance.now())
    },
    layout() { inner?.layout?.() },
    key(event) { return inner?.key?.(event) ?? false },
    unmount() {
      inner?.unmount()
      inner = null
      host = undefined
    },
    reading: () => ({ ...reading }),
  }
}
