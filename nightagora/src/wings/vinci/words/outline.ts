import { assertGlyphs, font, textAdvance } from './font'

/* The setting of the museum's vector letters, without their geometry: the
   page draws the same letters over the picture from here, so this module
   carries the font and nothing of the scene. */

/** The metrics a setting needs: cap height, measure and leading. */
export interface TextSettingOptions {
  /** Cap height in metres; diacritics and descenders extend beyond this. */
  size: number
  maxWidth?: number
  /** Baseline distance as a multiple of cap height. Default 1.40. */
  lineHeight?: number
}

export function wrap(text: string, size: number, maxWidth: number): string[] {
  const lines: string[] = []
  for (const paragraph of text.replace(/\r/g, '').split('\n')) {
    if (!paragraph.trim()) { lines.push(''); continue }
    const words = paragraph.split(/\s+/).filter(Boolean)
    let line = ''
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word
      if (line && textAdvance(candidate, size) > maxWidth) {
        lines.push(line)
        line = word
      } else line = candidate
    }
    lines.push(line)
  }
  return lines
}

/** The one setting both the cut letters and their flat outline follow: the
 * size after the overlong-word safeguard, the wrapped lines, the leading. */
export function setting(text: string, opts: TextSettingOptions): { size: number; lines: string[]; lineHeight: number } {
  assertGlyphs(text)
  if (!Number.isFinite(opts.size) || opts.size <= 0) throw new Error('Text size must be positive')
  if (opts.maxWidth !== undefined && (!Number.isFinite(opts.maxWidth) || opts.maxWidth <= 0)) {
    throw new Error('Text maxWidth must be positive')
  }
  const maxWidth = opts.maxWidth ?? Infinity
  const longest = Math.max(1e-9, ...text.split(/\s+/).map(word => textAdvance(word, opts.size)))
  const size = opts.size * Math.min(1, maxWidth / longest)
  return { size, lines: wrap(text, size, maxWidth), lineHeight: size * (opts.lineHeight ?? 1.40) }
}

/** THE SAME LETTERS, FLAT. `createText`'s setting as closed contours in its
 * local XY, top-left bound at (0,0) and running down -Y, sampled as its
 * extrusion samples them. Outer contours wind counter-clockwise and counters
 * clockwise, so a nonzero fill draws overlapping strokes as one letter. */
export interface TextOutline {
  contours: [number, number][][]
  width: number
  height: number
  lines: string[]
  size: number
}
export function textOutline(text: string, opts: TextSettingOptions): TextOutline {
  const { size, lines, lineHeight } = setting(text, opts)
  const raw: [number, number][][] = []
  const area = (c: readonly [number, number][]): number => {
    let a = 0
    for (let i = 0; i < c.length; i++) { const p = c[i]!, q = c[(i + 1) % c.length]!; a += p[0] * q[1] - q[0] * p[1] }
    return a / 2
  }
  const wound = (c: [number, number][], ccw: boolean): [number, number][] => (area(c) > 0) === ccw ? c : c.reverse()
  for (const [i, line] of lines.entries()) {
    if (!line.trim()) continue
    for (const shape of font.generateShapes(line, size)) {
      const { shape: outer, holes } = shape.extractPoints(4)
      const dy = -i * lineHeight
      raw.push(wound(outer.map(p => [p.x, p.y + dy]), true))
      for (const hole of holes) raw.push(wound(hole.map(p => [p.x, p.y + dy]), false))
    }
  }
  if (!raw.length) return { contours: [], width: 0, height: 0, lines, size }
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const c of raw) for (const [x, y] of c) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y) }
  return {
    contours: raw.map(c => c.map(([x, y]) => [x - minX, y - maxY] as [number, number])),
    width: maxX - minX, height: maxY - minY, lines, size,
  }
}

