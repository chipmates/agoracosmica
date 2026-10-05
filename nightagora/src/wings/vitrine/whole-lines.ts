/* WORDS END ON A WHOLE LINE. A scrolling column of words shows only the
   lines that stand whole inside it: a line its edge would slice is hidden
   whole, by a mask cut between two lines, never faded through one. Lines are
   read from the layout itself (each text line box, and each control or
   picture as one box), so the cut follows the type at any size. Where a
   sentence ends at a line's end close above the foot, the column ends there. */

export interface LineCut {
  /** the top and the foot of what is shown, in the scroller's own pixels from its top edge */
  top: number
  foot: number
  /** lines wait above the cut, or below it */
  above: boolean
  below: boolean
  /** where the first line hidden below begins, in the same pixels */
  next: number | null
  /** the controls and pictures that lie wholly outside the cut */
  away: Element[]
}

/** what is read as one box, never split into lines: a control, a picture, a strip of leaves; a machine's step
 * is a row of words that happens to be pressable, so its lines are read like any other */
const WHOLE = 'button:not(.vitrine-step-item), img, svg, input, select, textarea, canvas, video, ol'
/** what holds a run of sentences */
const BLOCK = 'p, li, h1, h2, h3, h4, h5, h6, blockquote, figcaption, dt, dd'
/** how far a column's foot may rise to end on a sentence instead of inside one: two lines at most */
const SENTENCE_REACH = 56
/** a sentence's last mark, with any closing quote or bracket after it */
const SENTENCE_END = /[.!?…]["'“”„»«)\]]*(?=\s|$)/g

/** a rule is an element's own border line: it never stands alone at a cut, away from the words it divides */
type Box = { top: number; bottom: number; block: Element; rule?: boolean; whole?: boolean }

/** Every line box and every whole box inside `root`, and the foot of every line a sentence ends, in viewport pixels. */
function read(root: HTMLElement): { boxes: Box[]; stops: number[] } {
  const found: Box[] = [], stops: number[] = []
  const range = root.ownerDocument.createRange()
  const rectAt = (node: Text, at: number): DOMRect | undefined => {
    range.setStart(node, at)
    range.setEnd(node, at + 1)
    return [...range.getClientRects()].find(r => r.height > 0)
  }
  const walk = (node: Node): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? ''
      if (!text.trim()) return
      range.selectNodeContents(node)
      const block = node.parentElement?.closest(BLOCK) ?? node.parentElement ?? root
      for (const r of range.getClientRects()) if (r.height > 0 && r.width > 0) found.push({ top: r.top, bottom: r.bottom, block })
      // a sentence that ends where its line does: the next mark stands on a lower line, or none follows
      for (const m of text.matchAll(SENTENCE_END)) {
        const last = m.index + m[0].length - 1
        const mark = rectAt(node as Text, last)
        if (!mark) continue
        const on = text.slice(last + 1).search(/\S/)
        const next = on < 0 ? undefined : rectAt(node as Text, last + 1 + on)
        if (!next || next.top >= mark.bottom - 1) stops.push(mark.bottom)
      }
      return
    }
    if (!(node instanceof HTMLElement || node instanceof SVGElement)) return
    // the layout decides, not the attribute: a part marked hidden may be shown by its form
    const style = getComputedStyle(node as Element)
    if (style.display === 'none' || style.visibility === 'hidden') return
    const r = (node as Element).getBoundingClientRect()
    // a painted mark with no words of its own (a certainty dot) is one box too, so a cut never leaves a sliver of it
    const mark = !node.textContent?.trim() && (style.backgroundImage !== 'none' || !/^(transparent|rgba\(0, 0, 0, 0\))$/.test(style.backgroundColor))
    if ((node as Element).matches(WHOLE) || mark) {
      if (r.height > 0 && r.width > 0) found.push({ top: r.top, bottom: r.bottom, block: node as Element, whole: true })
      return
    }
    const above = parseFloat(style.borderTopWidth) || 0, below = parseFloat(style.borderBottomWidth) || 0
    if (r.width > 0 && above > 0 && style.borderTopStyle !== 'none') found.push({ top: r.top, bottom: r.top + above, block: node as Element, rule: true })
    if (r.width > 0 && below > 0 && style.borderBottomStyle !== 'none') found.push({ top: r.bottom - below, bottom: r.bottom, block: node as Element, rule: true })
    for (const child of node.childNodes) walk(child)
  }
  for (const child of root.childNodes) walk(child)
  return { boxes: found, stops }
}

/** The window of whole lines a scroller shows now: its whole height, or the band from `from` to `reach`
 * where a sheet's own head and foot stand over its words. */
export function wholeLines(scroller: HTMLElement, band: { from?: number; reach?: number } = {}): LineCut {
  const frame = scroller.getBoundingClientRect()
  const edge = frame.top + scroller.clientTop
  const from = band.from ?? 0
  const height = band.reach ?? scroller.clientHeight
  const seen = read(scroller)
  const list = seen.boxes.map(b => ({ ...b, top: b.top - edge, bottom: b.bottom - edge }))
  const stops = seen.stops.map(s => s - edge)
  // a cut that falls inside a box moves to that box's far side, until no box straddles it
  const straddles = (at: number): Box | undefined =>
    list.find(b => b.top < at - 0.5 && b.bottom > at + 0.5)
  let top = from, foot = height
  for (let hit = straddles(top); hit; hit = straddles(top)) top = hit.bottom
  for (let hit = straddles(foot); hit; hit = straddles(foot)) foot = hit.top
  const inside = (): Box[] => list.filter(b => b.top >= top - 0.5 && b.bottom <= foot + 0.5)
  // where a paragraph runs on past the foot inside a sentence, the foot rises to a sentence's end close above it
  const ends = new Map<Element, number>()
  for (const b of list) if (!b.rule) ends.set(b.block, Math.max(ends.get(b.block) ?? -Infinity, b.bottom))
  const last = inside().filter(b => !b.rule).reduce<Box | null>((a, b) => (a && a.bottom >= b.bottom ? a : b), null)
  if (last && (ends.get(last.block) ?? 0) > foot + 0.5 && !stops.some(s => Math.abs(s - last.bottom) < 2)) {
    const closed = stops.filter(s => s > top + 0.5 && s <= foot + 0.5 && s >= foot - SENTENCE_REACH && !straddles(s))
    if (closed.length) foot = Math.max(...closed)
  }
  // a rule left last above the foot, or first under the head, goes with the words it divides
  for (let shown = inside(); shown.length; shown = inside()) {
    const low = shown.reduce((a, b) => (a.bottom >= b.bottom ? a : b))
    if (!low.rule) break
    foot = low.top
  }
  for (let shown = inside(); shown.length; shown = inside()) {
    const high = shown.reduce((a, b) => (a.top <= b.top ? a : b))
    if (!high.rule) break
    top = high.bottom
  }
  if (foot < top) foot = top
  // words wait below only where a line or a box does; a page read on starts at the first thing hidden, its rule too
  const hidden = list.filter(b => b.top >= foot - 0.5)
  const below = hidden.some(b => !b.rule)
  // each cut stands midway in the gap between two lines: ink that overhangs a line's box, or an edge
  // the screen snaps to its own pixel, stays on its side of the cut
  const shown = inside()
  if (shown.length) {
    const first = Math.min(...shown.map(b => b.top)), last = Math.max(...shown.map(b => b.bottom))
    // the last thing above the cut, or above a sheet's own head
    const prior = Math.max(-Infinity, ...list.filter(b => b.bottom <= top + 0.5).map(b => b.bottom))
    if (top > 0.5 && first > top && prior > -Infinity) top = Math.max(top, (prior + first) / 2)
    // a rule hidden right above the head may snap a device row down into the cut: the cut keeps that row out
    const px = 1 / (globalThis.devicePixelRatio || 1)
    const rule = list.find(b => b.rule && Math.abs(b.bottom - prior) < 0.01)
    if (top > 0.5 && rule && top - rule.bottom < px) top = rule.bottom + px
    if (foot < height - 0.5 && last < foot) foot = (foot + last) / 2
  }
  return {
    top, foot,
    above: scroller.scrollTop > 0.5,
    below,
    next: below ? Math.min(...hidden.map(b => b.top)) : null,
    // what stands in a sheet's own head stays: only what the cut hides is away
    away: list.filter(b => b.whole && !(from > 0 && b.top >= -0.5 && b.bottom <= from + 0.5) && (b.bottom <= top + 0.5 || b.top >= foot - 0.5)).map(b => b.block),
  }
}

/** A control's ring can paint past a scroller's mask at the clip's edge (WebKit), so what lies outside the cut is also made clear;
 * it stays focusable, and focusing it scrolls it in, which cuts again. */
function setAway(scroller: HTMLElement, away: Element[]): void {
  for (const el of scroller.querySelectorAll('[data-line-cut]')) if (!away.includes(el)) (el as HTMLElement).removeAttribute('data-line-cut')
  for (const el of away) el.setAttribute('data-line-cut', '')
}

/** Show only the whole lines: the mask cuts between lines, or stands down where nothing is cut.
 * `head` is a band at the scroller's top that stays shown whole: a name that stays while the lines pass under it. */
export function maskWholeLines(scroller: HTMLElement, cut: LineCut, head = 0): void {
  const style = scroller.style
  const height = scroller.clientHeight
  setAway(scroller, cut.away)
  if (cut.top < 0.5 && cut.foot > height - 0.5) {
    style.removeProperty('mask-image'); style.removeProperty('-webkit-mask-image'); style.removeProperty('clip-path')
    return
  }
  // rounded inwards, so no pixel row of a hidden line's edge or a box's border is left at the cut
  const t = Math.max(0, Math.ceil(cut.top)), f = Math.max(t, Math.floor(cut.foot))
  const h = Math.min(t, Math.max(0, Math.floor(head)))
  const mask = h > 0
    ? `linear-gradient(to bottom, #000 ${h}px, transparent ${h}px, transparent ${t}px, #000 ${t}px, #000 ${f}px, transparent ${f}px)`
    : `linear-gradient(to bottom, transparent ${t}px, #000 ${t}px, #000 ${f}px, transparent ${f}px)`
  style.setProperty('mask-image', mask)
  style.setProperty('-webkit-mask-image', mask)
  // the same cut as a clip: WebKit lets a device row of what crosses the scroller's own edge through a mask, never through a clip
  style.setProperty('clip-path', `inset(${h > 0 ? 0 : t}px 0 ${Math.max(0, height - f)}px 0)`)
}

/** Take the mask down again. */
export function unmaskLines(scroller: HTMLElement): void {
  setAway(scroller, [])
  scroller.style.removeProperty('clip-path')
  scroller.style.removeProperty('mask-image')
  scroller.style.removeProperty('-webkit-mask-image')
}
