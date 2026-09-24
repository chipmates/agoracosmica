/** THE HANG'S NUMBERS: a cast numeral on each frame's bottom rail, in the
 * order the wall hangs the works, the band's catalogue under the same number.
 * The figures are the museum's own: old-style lining figures drawn here as
 * pen strokes of varying weight (stems heavy, hairlines light), so no
 * typeface's outlines are copied. A stroke set is turned into its outline
 * through a distance field, and the outline into real relief: a face and its
 * walls. Pure geometry: it loads in node for the checkers.
 */
import { ShapeUtils, Vector2 } from 'three/webgpu'

type Pt = [number, number]
/** one pen stroke: points along it with the pen's radius at each */
type Stroke = { at: Pt[]; r: number[] }

/** the figure's box: cap height one, a tabular width */
const ADVANCE = .64
const STEM = .068, HAIR = .022, SERIF = .02

const line = (a: Pt, b: Pt, ra: number, rb = ra, n = 12): Stroke => {
  const at: Pt[] = [], r: number[] = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    at.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); r.push(ra + (rb - ra) * t)
  }
  return { at, r }
}
/** an arc of an ellipse, its weight heavy where it runs upright and light
 * where it runs across, as a broad pen held level draws it */
const arc = (c: Pt, rx: number, ry: number, from: number, to: number, heavy = STEM, light = HAIR, n = 48): Stroke => {
  const at: Pt[] = [], r: number[] = []
  for (let i = 0; i <= n; i++) {
    const a = (from + (to - from) * i / n) * Math.PI / 180
    at.push([c[0] + rx * Math.cos(a), c[1] + ry * Math.sin(a)])
    r.push(light + (heavy - light) * Math.abs(Math.cos(a)) ** 1.4)
  }
  return { at, r }
}
const curve = (a: Pt, b: Pt, c: Pt, ra: number, rb: number, n = 28): Stroke => {
  const at: Pt[] = [], r: number[] = []
  for (let i = 0; i <= n; i++) {
    const t = i / n, s = 1 - t
    at.push([s * s * a[0] + 2 * s * t * b[0] + t * t * c[0], s * s * a[1] + 2 * s * t * b[1] + t * t * c[1]])
    r.push(ra + (rb - ra) * Math.sin(t * Math.PI / 2))
  }
  return { at, r }
}
/** a round terminal where a hairline ends */
const ball = (c: Pt, r: number): Stroke => ({ at: [c, c], r: [r, r] })

/** THE TEN FIGURES as strokes in the unit box (x 0 to 0.64, y 0 to 1). */
const FIGURES: Record<string, Stroke[]> = {
  '0': [arc([.32, .5], .225, .455, 0, 360, STEM, HAIR, 96)],
  '1': [line([.33, .985], [.33, .17], STEM * .92), line([.33, .17], [.33, .064], STEM * .92, .05), line([.33, .985], [.17, .85], .03, HAIR),
    line([.15, .022], [.51, .022], SERIF * 1.1)],
  '2': [arc([.31, .72], .215, .25, 168, -12, STEM * .95, HAIR), curve([.52, .668], [.44, .42], [.075, .04], .06, .038),
    line([.075, .022], [.56, .022], .03), line([.56, .022], [.575, .1], .018), ball([.105, .745], .045)],
  '3': [arc([.3, .76], .2, .215, 150, -90, STEM * .85, HAIR), arc([.3, .3], .245, .265, 90, -150, STEM, HAIR), ball([.13, .855], .04), ball([.1, .16], .045)],
  '4': [line([.44, .99], [.035, .3], HAIR * 1.2, HAIR), line([.035, .29], [.6, .29], .026), line([.44, .99], [.44, .17], STEM * .92),
    line([.44, .17], [.44, .064], STEM * .92, .05), line([.3, .022], [.57, .022], SERIF * 1.1)],
  '5': [line([.155, .975], [.53, .975], .03), line([.155, .975], [.13, .565], .034), arc([.3, .32], .25, .3, 128, -150, STEM, HAIR), ball([.105, .135], .045)],
  '6': [arc([.32, .3], .235, .285, 0, 360, STEM, HAIR, 96), curve([.09, .34], [.1, .96], [.5, .985], STEM * .9, HAIR), ball([.5, .95], .04)],
  '7': [line([.05, .975], [.58, .975], .032), line([.05, .975], [.035, .9], .02), curve([.58, .975], [.36, .55], [.25, .03], .026, STEM * .85)],
  '8': [arc([.32, .765], .19, .215, 0, 360, STEM * .82, HAIR, 96), arc([.32, .28], .235, .265, 0, 360, STEM, HAIR, 96)],
  '9': [arc([.32, .7], .235, .285, 0, 360, STEM, HAIR, 96), curve([.55, .66], [.54, .04], [.14, .015], STEM * .9, HAIR), ball([.14, .05], .04)],
}

/** the distance from a point to a stroke set, less the pen: negative inside */
function field(strokes: readonly Stroke[], x: number, y: number): number {
  let best = Infinity
  for (const { at, r } of strokes) {
    for (let i = 0; i + 1 < at.length; i++) {
      const [ax, ay] = at[i]!, [bx, by] = at[i + 1]!
      const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy
      const t = l2 < 1e-12 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2))
      const d = Math.hypot(x - ax - dx * t, y - ay - dy * t) - (r[i]! + (r[i + 1]! - r[i]!) * t)
      if (d < best) best = d
    }
  }
  return best
}

/** THE OUTLINE OF A FIGURE: the zero line of its field, traced on a grid,
 * as closed loops (the outer ones anticlockwise, the counters clockwise). */
const outlines = new Map<string, Pt[][]>()
export function figureOutline(figure: string): Pt[][] {
  const hit = outlines.get(figure)
  if (hit) return hit
  const strokes = FIGURES[figure]
  if (!strokes) throw new Error(`no figure ${figure}`)
  const step = .008, x0 = -.1, y0 = -.1, nx = Math.ceil((ADVANCE + .2) / step), ny = Math.ceil(1.2 / step)
  const v: number[] = []
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) v.push(field(strokes, x0 + i * step, y0 + j * step))
  const at = (i: number, j: number): number => v[j * (nx + 1) + i]!
  // an edge's crossing is read from its lower grid point, so the two cells
  // that share the edge find the same point
  const crossing = (i: number, j: number, di: number, dj: number): Pt => {
    const va = at(i, j), vb = at(i + di, j + dj), t = va / (va - vb)
    return [x0 + (i + di * t) * step, y0 + (j + dj * t) * step]
  }
  // marching squares: each cell's edges crossed by the zero line, joined
  // with the inside kept on the left of every segment
  const segments: [Pt, Pt][] = []
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const d = [at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)]
    const inside = d.map(value => value < 0)
    // the four edges, walked anticlockwise: bottom, right, top, left
    const edgePoint = (e: number): Pt => e === 0 ? crossing(i, j, 1, 0) : e === 1 ? crossing(i + 1, j, 0, 1)
      : e === 2 ? crossing(i, j + 1, 1, 0) : crossing(i, j, 0, 1)
    const crossed: number[] = []
    for (let e = 0; e < 4; e++) if (inside[e] !== inside[(e + 1) % 4]) crossed.push(e)
    // a segment runs from the edge the walk leaves the inside by to the edge
    // it comes back in by, which keeps the inside on its left
    const join = (p: number, q: number): void => {
      const [a, b] = inside[p] ? [p, q] : [q, p]
      segments.push([edgePoint(a), edgePoint(b)])
    }
    if (crossed.length === 2) join(crossed[0]!, crossed[1]!)
    else if (crossed.length === 4) {
      const centre = (d[0]! + d[1]! + d[2]! + d[3]!) / 4 < 0
      // a saddle: the centre joins the two corners that share its side
      if (inside[0] === centre) { join(0, 1); join(2, 3) } else { join(3, 0); join(1, 2) }
    }
  }
  // join the segments end to start into loops
  const key = (p: Pt): string => `${p[0].toFixed(6)},${p[1].toFixed(6)}`
  const from = new Map<string, number[]>()
  segments.forEach((s, i) => { const k = key(s[0]); from.set(k, [...(from.get(k) ?? []), i]) })
  const used = new Array(segments.length).fill(false)
  const loops: Pt[][] = []
  for (let s = 0; s < segments.length; s++) {
    if (used[s]) continue
    const loop: Pt[] = []
    let at_ = s
    while (at_ >= 0 && !used[at_]) {
      used[at_] = true
      loop.push(segments[at_]![0])
      const next = (from.get(key(segments[at_]![1])) ?? []).find(i => !used[i])
      at_ = next ?? -1
    }
    if (loop.length >= 3) loops.push(simplify(loop, .0018))
  }
  // the stroke's inside lies on the left: an outer loop turns anticlockwise
  const oriented = loops.filter(loop => Math.abs(area(loop)) > 1e-5)
  outlines.set(figure, oriented)
  return oriented
}

function area(loop: readonly Pt[]): number {
  let s = 0
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i]!, b = loop[(i + 1) % loop.length]!
    s += a[0] * b[1] - b[0] * a[1]
  }
  return s / 2
}
/** drop the points a closed loop does not need, within `tolerance` */
function simplify(loop: Pt[], tolerance: number): Pt[] {
  const keep = (points: Pt[]): Pt[] => {
    if (points.length < 3) return points
    const a = points[0]!, b = points[points.length - 1]!
    let worst = -1, far = 0
    for (let i = 1; i < points.length - 1; i++) {
      const p = points[i]!, dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1
      const d = Math.abs((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / l
      if (d > far) { far = d; worst = i }
    }
    if (far <= tolerance) return [a, b]
    const left = keep(points.slice(0, worst + 1)), right = keep(points.slice(worst))
    return [...left.slice(0, -1), ...right]
  }
  const half = Math.floor(loop.length / 2)
  const first = keep([...loop.slice(0, half + 1)]), second = keep([...loop.slice(half), loop[0]!])
  return [...first.slice(0, -1), ...second.slice(0, -1)]
}

/** A NUMBER'S RELIEF on a face: its figures side by side, `height` tall, set
 * on the point `(u, v)` of the face's own plane (centred), standing `relief`
 * proud of it. Returned in the face's frame: `u` along, `v` up, `w` out of the
 * face; the caller lays it into the world. */
export interface Relief { position: number[]; normal: number[]; uv: number[] }
export function numberRelief(text: string, height: number, relief: number, sink = .0004): Relief {
  const out: Relief = { position: [], normal: [], uv: [] }
  const tracking = .06
  const width = (text.length * ADVANCE + (text.length - 1) * tracking) * height
  text.split('').forEach((figure, index) => {
    const dx = -width / 2 + index * (ADVANCE + tracking) * height, dy = -height / 2
    const loops = figureOutline(figure).map(loop => loop.map(([x, y]): Pt => [dx + x * height, dy + y * height]))
    const outers = loops.filter(loop => area(loop) > 0), holes = loops.filter(loop => area(loop) < 0)
    for (const outer of outers) {
      const own = holes.filter(hole => inside(outer, hole[0]!))
      const contour = outer.map(([x, y]) => new Vector2(x, y))
      const hollow = own.map(hole => hole.map(([x, y]) => new Vector2(x, y)))
      const tris = ShapeUtils.triangulateShape(contour, hollow)
      const all = [...contour, ...hollow.flat()]
      for (const tri of tris) {
        const [a, b, c] = tri as [number, number, number]
        for (const k of ShapeUtils.isClockWise([all[a]!, all[b]!, all[c]!]) ? [a, c, b] : [a, b, c]) {
          const p = all[k]!
          out.position.push(p.x, p.y, relief); out.normal.push(0, 0, 1); out.uv.push(p.x, p.y)
        }
      }
      // the walls, from the face down into the rail, facing out of the stroke
      for (const loop of [outer, ...own]) {
        for (let i = 0; i < loop.length; i++) {
          const a = loop[i]!, b = loop[(i + 1) % loop.length]!
          const ex = b[0] - a[0], ey = b[1] - a[1], l = Math.hypot(ex, ey) || 1
          // the inside lies on the left of the walk, so the outward normal is its right
          const nx = ey / l, ny = -ex / l
          const quad: [number, number, number][] = [[a[0], a[1], -sink], [b[0], b[1], -sink], [b[0], b[1], relief], [a[0], a[1], relief]]
          for (const k of [0, 1, 2, 0, 2, 3]) {
            const q = quad[k]!
            out.position.push(q[0], q[1], q[2]); out.normal.push(nx, ny, 0); out.uv.push(q[0] + q[1], q[2])
          }
        }
      }
    }
  })
  return out
}

function inside(loop: readonly Pt[], p: Pt): boolean {
  let hit = false
  for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
    const a = loop[i]!, b = loop[j]!
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) hit = !hit
  }
  return hit
}

/** How wide a number of this many figures stands, at this height. */
export const numberWidth = (figures: number, height: number): number => (figures * ADVANCE + (figures - 1) * .06) * height
