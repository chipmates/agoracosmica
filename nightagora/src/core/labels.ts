/* THE LABEL GRAPH — what the frame claims, read off the frame.

   The honesty axis of the bar is not a thing pixels can prove: whether a
   label anchors the right object, and whether a green label sits on
   something generated, is a property of the manifest and of the marks, so
   it is measured here and quoted by the judge rather than scored by eye.

   The reading is deliberately of the PAGE and not of the source: every mark
   carries its claim as data attributes, and this walks the live DOM, skips
   what the browser is not actually drawing, and measures the box a hand
   would have to hit. A claim that is only in the code is not a claim on the
   frame, and a target that is 44 px in the stylesheet and 30 px in the
   layout is 30 px.

   Attributes a mark carries:
     data-na-claim         documented | inferred | tradition
     data-na-anchor        the manifest id of the object it names
     data-na-anchor-class  that object's manifest class, or `procedural`
     data-na-persistent    it stays on the frame across states
     data-na-brand         it is the brand line
     data-na-disclosure    it is one of the three canon layers, by key */

import type { AssetClass } from '../manifest/schema'
import type { DisclosureKey } from '../content/disclosures'

export type Certainty = 'documented' | 'inferred' | 'tradition'
export type AnchorClass = AssetClass | 'procedural'

export interface ForgeLabel {
  text: string
  anchorId: string
  /** null for a control, which names nothing and is only measured */
  certainty: Certainty | null
  anchorClass: AnchorClass
  persistent: boolean
  /** the smallest side of the box a hand must hit, or null when nothing
      about this mark is interactive */
  targetPx: number | null
  brand: boolean
  disclosure: DisclosureKey | null
}

const CONTROLS = 'a[href], button, [role="button"], input, select, textarea, summary'
const MARKED = '[data-na-claim], [data-na-persistent], [data-na-brand], [data-na-disclosure]'

/** is the browser actually drawing this, and would a reader see it */
function onTheFrame(el: Element): boolean {
  const rect = el.getBoundingClientRect()
  if (rect.width < 1 || rect.height < 1) return false
  if (rect.bottom <= 0 || rect.top >= innerHeight) return false
  if (rect.right <= 0 || rect.left >= innerWidth) return false
  let node: Element | null = el
  while (node) {
    if (node instanceof HTMLElement && node.hidden) return false
    const cs = getComputedStyle(node)
    if (cs.display === 'none' || cs.visibility === 'hidden') return false
    if (Number(cs.opacity) <= 0.02) return false
    node = node.parentElement
  }
  return true
}

/** what a screen reader would call this mark. A plate whose whole content
    is a picture is called by its alternative text, or it reads as empty and
    the gate cannot tell an unlabelled image from a missing one. */
function label(el: Element): string {
  const aria = el.getAttribute('aria-label')
  if (aria) return aria
  const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim()
  if (text) return text
  const img = el instanceof HTMLImageElement ? el : el.querySelector('img')
  return img?.alt ?? ''
}

/** the smallest side of the hit box: the mark's own if it is interactive,
    otherwise the control it sits inside, otherwise nothing to hit */
function target(el: Element): number | null {
  const hit = el.matches(CONTROLS) ? el : el.closest(CONTROLS)
  if (!hit) return null
  const r = hit.getBoundingClientRect()
  return Math.round(Math.min(r.width, r.height))
}

function read(el: Element, marked: boolean): ForgeLabel {
  const claim = el.getAttribute('data-na-claim')
  const cls = el.getAttribute('data-na-anchor-class')
  return {
    text: label(el),
    anchorId: el.getAttribute('data-na-anchor') ?? el.id ?? '',
    certainty: marked && claim ? (claim as Certainty) : null,
    anchorClass: (cls as AnchorClass | null) ?? 'procedural',
    persistent: el.hasAttribute('data-na-persistent'),
    targetPx: target(el),
    brand: el.hasAttribute('data-na-brand'),
    disclosure: (el.getAttribute('data-na-disclosure') as DisclosureKey | null) ?? null,
  }
}

/** every label and every control the current station is showing */
export function readLabels(): ForgeLabel[] {
  const out: ForgeLabel[] = []
  const seen = new Set<Element>()
  for (const el of document.querySelectorAll(MARKED)) {
    if (!onTheFrame(el)) continue
    seen.add(el)
    out.push(read(el, true))
  }
  for (const el of document.querySelectorAll(CONTROLS)) {
    // a control inside a marked container is still a thing a hand must
    // hit, so it is measured on its own; only the marked element itself is
    // not read twice
    if (seen.has(el)) continue
    if (!onTheFrame(el)) continue
    out.push(read(el, false))
  }
  return out
}
