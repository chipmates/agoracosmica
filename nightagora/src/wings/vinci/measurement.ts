import type { CostReading, Stack } from '../../stack'
import { readLabels } from '../../core/labels'
import { DISCLOSURES } from '../../content/disclosures'
import { lang } from '../content'

export interface VinciMeasurement {
  show(station: string, audit?: 'cost' | 'ui'): void
  hide(): void
  /** Call once per wing frame, immediately before the shared stack renders. */
  update(): void
  dispose(): void
}

const WINDOW = 120
const REFRESH_MS = 250
const number = (value: number): string => Number.isFinite(value) ? String(value) : 'unavailable'

/** An explicitly requested scene audit view. It never changes the scene,
 * renderer, tier, camera or cost meter, and is hidden until show() is called.
 * The scene loop calls update() before render(), so N updates establish that
 * N - 1 completed frames can have entered the shared rolling cost window.
 * Waiting for a whole new window prevents a previous station's timing from
 * being presented as a completed reading of the requested station.
 */
export function createMeasurement(host: HTMLElement, stack: Stack): VinciMeasurement {
  const card = host.ownerDocument.createElement('pre')
  card.className = 'vinci-measurement'
  card.dataset['vinciMeasurement'] = 'cost'
  card.setAttribute('aria-label', 'Vinci station cost audit, separate from shared gates')
  card.hidden = true
  Object.assign(card.style, {
    position: 'fixed', left: '12px', top: '128px', zIndex: '20',
    boxSizing: 'border-box', width: 'min(350px, calc(100vw - 24px))',
    maxHeight: 'calc(100dvh - 152px)', margin: '0', padding: '13px',
    border: '1px solid #a3aeb8', borderRadius: '2px',
    color: '#ffffff', background: '#0c131b',
    font: '12px/1.45 ui-monospace, SFMono-Regular, Consolas, monospace',
    fontVariantNumeric: 'tabular-nums', whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere', overflow: 'hidden',
    textAlign: 'left', textShadow: 'none', pointerEvents: 'none',
  })
  host.append(card)

  let station = '', visible = false, disposed = false, audit:'cost'|'ui'='cost'
  let updates = 0, lastRead = -Infinity, context = ''

  function paint(now: number): void {
    if(audit==='ui'){
      lastRead=now
      const graph=readLabels(), targets=graph.filter(l=>l.targetPx!==null).map(l=>l.targetPx!)
      const minimum=targets.length?Math.min(...targets):null
      const persistent=graph.filter(l=>l.persistent).length,brands=graph.filter(l=>l.brand).length
      const claims=graph.filter(l=>l.certainty),bad=claims.filter(l=>l.certainty==='documented'&&!['CAPTURED','PD-ART','procedural'].includes(l.anchorClass))
      const disclosures=graph.filter(l=>l.disclosure),drift=disclosures.filter(l=>l.text!==DISCLOSURES[l.disclosure!]![lang()])
      const pass=minimum!==null&&minimum>=44&&persistent<=3&&brands===1&&!bad.length&&!drift.length
      const lines=['VINCI · LIVE LABEL AUDIT','Scene debug view · not shared gates',`Station ${station} · ${lang()}`,`Viewport ${innerWidth}×${innerHeight} CSS px`,'',`STATUS ${pass?'PASS':'FAIL'}`,`Measured targets ${targets.length}`,`Smallest target ${minimum??'unavailable'} px / 44`,`Persistent groups ${persistent} / 3`,`Brand lines ${brands} / 1`,`Claims on frame ${claims.length}`,`Invalid documented anchors ${bad.length}`,`Disclosures on frame ${disclosures.length}`,`Disclosure mismatches ${drift.length}`,'','Reads the shared live DOM label graph.','Does not click a target, test occlusion,','or merge the external asset manifest.']
      if(bad.length)lines.push(...bad.map(l=>`BAD CLAIM ${l.text.slice(0,70)}`))
      if(drift.length)lines.push(...drift.map(l=>`DRIFT ${l.disclosure}`))
      card.textContent=lines.join('\n');return
    }
    const c: CostReading = stack.cost()
    const viewport = `${innerWidth}×${innerHeight}`
    const nextContext = `${c.backend}/${c.tier}/${viewport}/${stack.renderer.getPixelRatio()}`
    if (context && context !== nextContext) updates = 0
    context = nextContext
    lastRead = now

    const completed = Math.max(0, updates - 1)
    const values = [c.draws, c.triangles, c.frameMsP50, c.frameMsP95,
      c.cpuMsP50, c.cpuMsP95, c.textureMB, c.frameMB, c.frames]
    const measured = values.every(value => Number.isFinite(value) && value >= 0)
    const budgetValid = Object.values(c.budget).every(value => Number.isFinite(value) && value > 0)
    const ready = measured && budgetValid && c.frames >= WINDOW && completed >= WINDOW
    const resources = c.draws <= c.budget.draws && c.triangles <= c.budget.triangles
      && c.frameMB <= c.budget.frameMB && c.textureMB <= c.budget.textureMB
    const frameLimit = 1000 / c.budget.fps
    const timing = c.frameMsP95 > 0 && c.frameMsP95 <= frameLimit
    const verdict = (passes: boolean): string => ready ? (passes ? 'PASS' : 'FAIL') : 'PENDING'
    const status = !measured || !budgetValid ? 'UNAVAILABLE' : verdict(resources && timing)
    const buffer = stack.renderer.domElement
    const lines = [
      'VINCI · STATIC COST AUDIT',
      'Scene debug view · not shared gates',
      `Station  ${station}`,
      `Backend  ${c.backend} · ${stack.architecture}`,
      `Tier     ${c.tier}`,
      `Viewport ${viewport} CSS px`,
      `DPR ${number(devicePixelRatio)} · render ${number(stack.renderer.getPixelRatio())}`,
      `Buffer   ${buffer.width}×${buffer.height} px`,
      '',
      `Meter frames ${number(c.frames)} / ${WINDOW}`,
      `Frames since view ${completed} / ${WINDOW}`,
      `STATUS   ${status}`,
      '',
      `Draws     ${number(c.draws)} / ${number(c.budget.draws)}`,
      `Triangles ${number(c.triangles)} / ${number(c.budget.triangles)}`,
      `Frame MB  ${number(c.frameMB)} / ${number(c.budget.frameMB)}`,
      `Tex MB    ${number(c.textureMB)} / ${number(c.budget.textureMB)}`,
      `Resource budget ${verdict(resources)}`,
      '',
      `Frame ms p50 ${number(c.frameMsP50)}`,
      `         p95 ${number(c.frameMsP95)}`,
      `p95 ≤ ${frameLimit.toFixed(3)} ms (${number(c.budget.fps)} fps)`,
      `Frame-time test ${verdict(timing)}`,
      `CPU ms   p50 ${number(c.cpuMsP50)}`,
      `         p95 ${number(c.cpuMsP95)}`,
      'CPU submission has no tier threshold.',
      '',
      ready ? 'Rolling window at this audit view.' : 'Waiting for a fresh full frame window.',
      'Headless intervals are throughput data.',
      'Memory: stack estimate, not GPU total.',
    ]
    card.textContent = lines.join('\n')
  }

  return {
    show(id,kind='cost') {
      if (disposed) return
      station = id
      audit=kind
      card.dataset['vinciMeasurement']=kind
      card.setAttribute('aria-label',`Vinci station ${kind} audit, separate from shared gates`)
      updates = 0
      context = ''
      visible = true
      card.hidden = false
      paint(performance.now())
    },
    hide() {
      visible = false
      card.hidden = true
    },
    update() {
      if (!visible || disposed) return
      updates++
      const now = performance.now()
      if (now - lastRead >= REFRESH_MS) paint(now)
    },
    dispose() {
      visible = false
      disposed = true
      card.remove()
    },
  }
}
