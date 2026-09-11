/** GENERATED diagnostic UI. This does not participate in the machine geometry.
 * Only ?benchMetrics=1 constructs an overlay. The caller supplies completed
 * render notifications; this module never schedules or submits a frame.
 */
import type { CostReading, Stack } from '../../../../stack'

export interface BenchMetricState {
  slug: string
  t: number
  ready: boolean
  playing: boolean
  section: boolean
  period_s: number | null
}

export interface BenchTargetReading {
  label: string
  width: number
  height: number
  visibleWidth: number
  visibleHeight: number
}

export interface BenchMetricsReading {
  evidence: 'supplemental-render-diagnostic'
  state: BenchMetricState
  architecture: string
  submissions: number
  elapsedMs: number
  cost: CostReading
  rawSubmissionIntervals: { samples: number; p50Ms: number; p95Ms: number; maxMs: number }
  dom: {
    targets: BenchTargetReading[]
    smallestVisibleTargetPx: number | null
    below44: BenchTargetReading[]
    visibleTaggedPersistentMarks: number
    visibleTaggedBrands: number
  }
  officialCostGate: false
  trustedInputPass: false
}

export interface BenchMetrics {
  readonly enabled: true
  /** Call after assembly, supports and requested textures have become ready.
   * Call again after a new machine, tier, section, language or pose is chosen.
   */
  reset(): void
  /** Exactly once immediately AFTER the existing stack.render(dt) returns.
   * Pass the assembly's own readiness, not readiness gated by this diagnostic.
   */
  afterRender(state: BenchMetricState): void
  /** Gate bench.ready() with this, allowing the eyes' dressed() wait to work. */
  ready(): boolean
  /** The frozen observed reading. No browser or filesystem output is written. */
  reading(): BenchMetricsReading | null
  close(): void
  dispose(): void
}

const MIN_SUBMISSIONS = 121
const MIN_ELAPSED_MS = 1000
const INTERVAL_WINDOW = 120
const TARGET_SELECTOR = 'button:not(:disabled),select:not(:disabled),a[href],summary,input:not(:disabled),textarea:not(:disabled),[role="button"]'

function percentile(values: readonly number[], fraction: number): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] ?? 0
}

/** Viewport/ancestor clipping is counted in CSS pixels. This deliberately does
 * not claim to prove hit testing, pointer delivery or visual mark semantics.
 */
function visibleRect(node: HTMLElement): { width: number; height: number; visibleWidth: number; visibleHeight: number } | null {
  if (!node.isConnected || !node.getClientRects().length) return null
  const bounds = node.getBoundingClientRect()
  if (!(bounds.width > 0 && bounds.height > 0)) return null
  let left = Math.max(0, bounds.left), right = Math.min(innerWidth, bounds.right)
  let top = Math.max(0, bounds.top), bottom = Math.min(innerHeight, bounds.bottom)
  for (let ancestor: HTMLElement | null = node; ancestor; ancestor = ancestor.parentElement) {
    const style = getComputedStyle(ancestor)
    if (style.display === 'none' || style.visibility !== 'visible' || Number(style.opacity) === 0 || ancestor.hidden) return null
    if (ancestor === node) continue
    const clipX = /^(hidden|clip|scroll|auto)$/.test(style.overflowX)
    const clipY = /^(hidden|clip|scroll|auto)$/.test(style.overflowY)
    if (!clipX && !clipY) continue
    const rect = ancestor.getBoundingClientRect()
    if (clipX) { left = Math.max(left, rect.left + ancestor.clientLeft); right = Math.min(right, rect.left + ancestor.clientLeft + ancestor.clientWidth) }
    if (clipY) { top = Math.max(top, rect.top + ancestor.clientTop); bottom = Math.min(bottom, rect.top + ancestor.clientTop + ancestor.clientHeight) }
  }
  if (!(right > left && bottom > top)) return null
  return { width: bounds.width, height: bounds.height, visibleWidth: right - left, visibleHeight: bottom - top }
}

function inspectDOM(host: HTMLElement, panel: HTMLElement): BenchMetricsReading['dom'] {
  const targets: BenchTargetReading[] = []
  for (const node of host.querySelectorAll<HTMLElement>(TARGET_SELECTOR)) {
    if (panel.contains(node) || node.closest('[inert]') || node.getAttribute('aria-disabled') === 'true' || getComputedStyle(node).pointerEvents === 'none') continue
    const rect = visibleRect(node)
    if (!rect) continue
    targets.push({ label: (node.getAttribute('aria-label') || node.textContent || node.tagName).trim().replace(/\s+/g, ' ').slice(0, 100), ...rect })
  }
  const below44 = targets.filter(target => Math.min(target.visibleWidth, target.visibleHeight) < 44)
  const count = (selector: string) => [...document.querySelectorAll<HTMLElement>(selector)].filter(node => !panel.contains(node) && visibleRect(node) !== null).length
  return {
    targets,
    smallestVisibleTargetPx: targets.length ? Math.min(...targets.map(target => Math.min(target.visibleWidth, target.visibleHeight))) : null,
    below44,
    visibleTaggedPersistentMarks: count('[data-na-persistent]'),
    visibleTaggedBrands: count('[data-na-brand]'),
  }
}

function textOf(reading: BenchMetricsReading): string {
  const { cost, state, dom, rawSubmissionIntervals: raw } = reading
  const mode = state.period_s === null ? 'static' : state.playing ? 'moving' : 'fixed pose'
  const software = /swiftshader|lavapipe|llvmpipe|software/i.test(reading.architecture) ? ' · SOFTWARE' : ''
  return [
    'BENCH DIAGNOSTIC · supplemental',
    state.slug,
    `${cost.backend} · ${cost.tier} · ${reading.architecture}${software}`,
    `t=${state.t.toFixed(3)}s · ${mode}${state.section ? ' · section' : ''}`,
    `${reading.submissions} submits · ${cost.frames} samples · ${(reading.elapsedMs / 1000).toFixed(2)}s`,
    `Draws ${cost.draws} / ${cost.budget.draws}`,
    `Triangles ${cost.triangles} / ${cost.budget.triangles}`,
    `Stack ms p50/p95 ${cost.frameMsP50} / ${cost.frameMsP95}`,
    `Raw ms p50/p95 ${raw.p50Ms.toFixed(2)} / ${raw.p95Ms.toFixed(2)}`,
    `CPU ms p50/p95 ${cost.cpuMsP50} / ${cost.cpuMsP95}`,
    `Texture MB ${cost.textureMB} / ${cost.budget.textureMB}`,
    `Frame MB ${cost.frameMB} / ${cost.budget.frameMB}`,
    `Tier target ${cost.budget.fps} fps (timing is diagnostic)`,
    `Targets ${dom.targets.length} · min ${dom.smallestVisibleTargetPx === null ? 'none' : dom.smallestVisibleTargetPx.toFixed(2)}px · <44: ${dom.below44.length}`,
    `Tagged marks ${dom.visibleTaggedPersistentMarks}/3 · brands ${dom.visibleTaggedBrands}`,
    'Observed counters, not GPU timestamp duration.',
    'No official /cost or trusted-input gate claim.',
  ].join('\n')
}

/** Returns null before constructing DOM, arrays, timers, listeners or observers
 * on the ordinary route. A repeated or ambiguous benchMetrics value is off.
 */
export function createBenchMetrics(stack: Pick<Stack, 'cost' | 'architecture'>, host: HTMLElement, search = location.search): BenchMetrics | null {
  if (!/(?:^|[?&])benchMetrics=1(?:&|$)/.test(search) || (search.match(/(?:^|[?&])benchMetrics=/g)?.length ?? 0) !== 1) return null

  const panel = document.createElement('aside')
  panel.dataset['benchDiagnostic'] = 'metrics'
  panel.setAttribute('aria-label', 'Supplemental bench diagnostic')
  panel.style.cssText = 'position:fixed;z-index:100;left:20px;top:76px;width:330px;max-width:calc(100vw - 40px);box-sizing:border-box;padding:10px 12px;border:1px solid #887b60;background:#151b20;color:#ece5d6;font:11px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace;white-space:pre-wrap;overflow-wrap:anywhere;pointer-events:none;text-shadow:none;letter-spacing:0;'
  panel.hidden = true
  host.append(panel)

  let active = false, disposed = false, submissions = 0, firstAt = 0, previousAt = 0
  let frozen: BenchMetricsReading | null = null
  let identity = ''
  const intervals: number[] = []

  function reset() {
    if (disposed) return
    active = true
    submissions = 0
    firstAt = 0
    previousAt = 0
    frozen = null
    identity = ''
    intervals.length = 0
    panel.hidden = false
    // Keep this text fixed throughout collection so progress repaints do not
    // become part of the measured interval window.
    panel.textContent = 'BENCH DIAGNOSTIC · supplemental\nWarming: ≥121 submitted frames and ≥1s.\nWaiting for an uncontaminated 120-frame window.\nNo official /cost or trusted-input gate claim.'
  }

  return {
    enabled: true,
    reset,
    afterRender(state) {
      if (!active || disposed || frozen) return
      if (!state.ready || !Number.isFinite(state.t)) {
        submissions = 0
        firstAt = previousAt = 0
        intervals.length = 0
        identity = ''
        return
      }
      const nextIdentity = `${state.slug}|${state.section}|${state.playing}|${state.playing ? '' : state.t}`
      if (identity && identity !== nextIdentity) reset()
      identity = nextIdentity
      const now = performance.now()
      if (submissions === 0) firstAt = now
      else {
        intervals.push(now - previousAt)
        if (intervals.length > INTERVAL_WINDOW) intervals.shift()
      }
      previousAt = now
      submissions++
      const elapsedMs = now - firstAt
      if (submissions < MIN_SUBMISSIONS || elapsedMs < MIN_ELAPSED_MS) return
      const cost = stack.cost()
      if (cost.frames !== INTERVAL_WINDOW) return
      frozen = {
        evidence: 'supplemental-render-diagnostic',
        state: { ...state },
        architecture: stack.architecture,
        submissions,
        elapsedMs,
        cost: { ...cost, budget: { ...cost.budget } },
        rawSubmissionIntervals: {
          samples: intervals.length,
          p50Ms: percentile(intervals, .5),
          p95Ms: percentile(intervals, .95),
          maxMs: Math.max(...intervals),
        },
        dom: inspectDOM(host, panel),
        officialCostGate: false,
        trustedInputPass: false,
      }
      panel.textContent = textOf(frozen)
    },
    ready: () => frozen !== null,
    reading: () => frozen,
    close() { active = false; frozen = null; panel.hidden = true },
    dispose() { disposed = true; active = false; frozen = null; intervals.length = 0; panel.remove() },
  }
}
