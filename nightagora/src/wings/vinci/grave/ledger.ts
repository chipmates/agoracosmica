/** THE LEDGER SLAB, CUT AS A MASON CUTS IT.
 *
 * The slab's one inscription is the name the record gives it, LEONARDO DA
 * VINCI, and nothing else. It is cut into a pale honed limestone, not laid on
 * it: the face opens over each line, the stone left standing between the
 * letters is rebuilt at the face in two courses (a splayed mouth that takes
 * the light, a wall under it in shadow), and a dark filling lies in the bottom
 * of every cut, as ledger stones are filled so a name reads across a floor.
 * The method is the museum's own cut inscription (`words/index.ts`), turned to
 * lie face up. The dimensions are an exhibition study, not a survey of the
 * tomb in Saint-Hubert.
 *
 * The letters are cut along their own outline: the font draws a letter as
 * strokes that overlap, so the cut follows the union of its strokes, measured
 * as a distance field over each line and traced where it crosses the letter's
 * edge and the mouth's. The mouth splays down to the edge, a short wall drops
 * to the filling, and nothing of the cut is stepped.
 */
import {
  BufferGeometry, Color, Float32BufferAttribute, Matrix4, MeshStandardNodeMaterial, Quaternion, ShapeUtils, Vector2, Vector3,
} from 'three/webgpu'
import * as TSL from 'three/tsl'
import { reliefNormal, resolved, specularAA, surfaceDetail } from '../../../stack/detail'
import { cutGlyphs } from '../words'
import { applyCourtLight, COURT_ENGINE_TERMS } from './court-light'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any
const { cameraViewMatrix, float, mix, mx_noise_float, normalWorldGeometry, positionWorld, smoothstep, vec3 } = TSL as unknown as Record<string, N>

/** THE CUT, in metres: how far the mouth opens outside the letter's edge and
 * how deep it splays down to it, the wall under the edge to the filling, and
 * the grid the letter's distance is measured on. A shallow cut: the name is
 * read from the stop, eight metres off, as well as from the slab's foot. */
export const LEDGER_CUT = { mouth: .004, splay: .0022, wall: .0009, cell: .0016 } as const
/** the face's height in the wing, for the cut's own shade (the grave stands a
 * little over the court's paving) */
const FACE_Y = -6.44 + .035 + .234

/** THE NAME'S LAYOUT on the slab's face, in metres: two lines, each as wide
 * as the face lets it be read from the court's open side. */
export const LEDGER_NAME = {
  lines: ['LEONARDO', 'DA VINCI'] as const,
  cap: .27, lineHeight: 1.62,
  /** the block's middle, from the slab's middle toward its foot */
  towardFoot: .35,
  margin: .12,
} as const

const linear = (hex: string): [number, number, number] => { const c = new Color(hex); return [c.r, c.g, c.b] }

/** A pale, fine, honed limestone: a stone chosen paler than the court's flags
 * so the slab is the lightest thing on the floor under the court's sky. */
export function ledgerStone(): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial({ roughness: .5, metalness: 0 })
  const P = positionWorld, n = normalWorldGeometry
  const d = surfaceDetail({ scales: [.5, .06, .003], figure: [.08, .05, .035], relief: .0006 })
  // shell fragments and a bedding in the honed face, and the grime a stone
  // set out in a court keeps along its edges, where the leaves lie
  const shell = smoothstep(.7, .84, mx_noise_float(P.mul(38)).mul(.5).add(.5)).mul(resolved(.03, d.pixel))
  const bedding = mx_noise_float(P.mul(vec3(.9, 7, .45))).mul(resolved(.1, d.pixel))
  const top = smoothstep(.6, .9, n.y)
  const toEdge = float(.99).sub(P.z.negate().add(25.95).abs()).min(float(1.775).sub(P.x.add(54.85).abs()))
  // (the slab's place in the wing; a stage that sets it elsewhere keeps none)
  const grime = float(1).sub(smoothstep(.0, .09, toEdge)).mul(smoothstep(-.002, 0, toEdge)).mul(top)
  const c = vec3(...linear('#c9c1ad')).mul(d.tone).mul(float(1).add(bedding.mul(.06)).sub(shell.mul(.1)))
    .mul(float(1).sub(grime.mul(.14)))
  m.colorNode = c
  applyCourtLight(m, c)
  // THE CUT'S OWN SHADE: the splay and the wall see less of the sky than the
  // face. A renderer that traces the cut finds it; the live engine is told.
  if (COURT_ENGINE_TERMS) {
    const inCut = smoothstep(FACE_Y - .012, FACE_Y - .008, P.y).mul(smoothstep(FACE_Y + .001, FACE_Y - .0002, P.y))
      .mul(smoothstep(-.002, .002, toEdge))
    const facing = float(1).sub(smoothstep(.55, .98, n.y))
    const shade = float(1).sub(inCut.mul(facing).mul(.6))
    m.aoNode = m.aoNode ? (m.aoNode as N).mul(shade) : shade
  }
  // honed on its face, sawn on its sides
  m.roughnessNode = specularAA(mix(float(.72), float(.46), top).add(d.rough).add(shell.mul(.08)), d.lost)
  m.normalNode = reliefNormal(n.transformDirection(cameraViewMatrix), d.heightM, .15)
  m.name = 'vinci/grave/ledger-limestone'
  return m
}

/** THE BED THE SLAB IS SET IN, and the marker's foot: a grey limestone
 * darker than the slab, laid as a course of stones about 0.6 m long with
 * lime joints, their top arrises worn pale, the foot darkened where the
 * paving's wet reaches it. A flat black band read as a painted plinth. */
export function ledgerBed(): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial({ roughness: .8, metalness: 0 })
  const P = positionWorld, n = normalWorldGeometry
  const d = surfaceDetail({ scales: [.4, .05, .003], figure: [.09, .06, .04], relief: .0008 })
  // a face along the slab counts its stones along x, an end along z
  const endFace = smoothstep(.6, .8, n.x.abs())
  const along = mix(P.x.add(54.85 + 1.87).div(3.74 / 6), P.z.sub(25.95 - 1.08).div(2.16 / 3), endFace)
  const cell = TSL.floor(along), inCell = TSL.fract(along)
  const pitch = mix(float(3.74 / 6), float(2.16 / 3), endFace)
  const jointAt = inCell.min(float(1).sub(inCell)).mul(pitch)
  const joint = float(1).sub(smoothstep(.003, .006, jointAt)).mul(resolved(.012, d.pixel)).mul(float(1).sub(smoothstep(.6, .9, n.y.abs())))
  const tone = TSL.fract(cell.mul(12.9898).add(endFace.mul(78.2)).sin().mul(43758.5453)).sub(.5).mul(.16).add(1)
  // the top arris: the last centimetre under the bedding course, worn pale
  const top = smoothstep(-6.285, -6.262, P.y).mul(float(1).sub(smoothstep(.6, .9, n.y)))
  const foot = float(1).sub(smoothstep(-6.405, -6.36, P.y))
  const c = vec3(...linear('#6a6a63')).mul(d.tone).mul(tone)
    .mul(float(1).sub(joint.mul(.35))).mul(float(1).add(top.mul(.28))).mul(float(1).sub(foot.mul(.22)))
  m.colorNode = c
  applyCourtLight(m, c)
  m.roughnessNode = specularAA(float(.8).add(d.rough).add(joint.mul(.1)).sub(top.mul(.12)), d.lost)
  m.normalNode = reliefNormal(n.transformDirection(cameraViewMatrix), d.heightM.sub(joint.mul(.002)), .15)
  m.name = 'vinci/grave/ledger-bed'
  return m
}

/** The filling in the cut: a dull warm black. */
export function ledgerFilling(): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial({ roughness: .9, metalness: 0 })
  m.colorNode = vec3(...linear('#2a2622'))
  m.name = 'vinci/grave/ledger-filling'
  return m
}

/* ─── the letter's outline ──────────────────────────────────────────────── */

interface Glyph { outer: Vector2[]; counters: Vector2[][] }

/** The x intervals a closed polygon covers on one scanline. */
function spans(points: readonly Vector2[], y: number): [number, number][] {
  const at: number[] = []
  for (let i = 0, n = points.length; i < n; i++) {
    const a = points[i]!, b = points[(i + 1) % n]!
    if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) at.push(a.x + (y - a.y) / (b.y - a.y) * (b.x - a.x))
  }
  at.sort((p, q) => p - q)
  const out: [number, number][] = []
  for (let i = 0; i + 1 < at.length; i += 2) out.push([at[i]!, at[i + 1]!])
  return out
}

/** A grid of the union's signed distance: negative in a letter. Only the band
 * round the edges is measured; farther away the field holds the band's reach,
 * which is all the tracing needs. */
interface Field { x0: number; y0: number; nx: number; ny: number; cell: number; v: Float32Array }
function letterField(glyphs: readonly Glyph[], cell: number, reach: number): Field {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const g of glyphs) for (const p of g.outer) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y)
  }
  const pad = reach + 3 * cell
  const x0 = minX - pad, y0 = minY - pad
  const nx = Math.ceil((maxX - minX + 2 * pad) / cell) + 1, ny = Math.ceil((maxY - minY + 2 * pad) / cell) + 1
  // squared distances first, the root taken once per point at the end
  const v = new Float32Array(nx * ny).fill(reach * reach)
  for (const g of glyphs) for (const loop of [g.outer, ...g.counters]) {
    for (let k = 0, n = loop.length; k < n; k++) {
      const a = loop[k]!, b = loop[(k + 1) % n]!
      const ax = a.x, ay = a.y, dx = b.x - ax, dy = b.y - ay, l2 = dx * dx + dy * dy, inv = l2 > 0 ? 1 / l2 : 0
      const i0 = Math.max(0, Math.floor((Math.min(ax, b.x) - reach - x0) / cell)), i1 = Math.min(nx - 1, Math.ceil((Math.max(ax, b.x) + reach - x0) / cell))
      const j0 = Math.max(0, Math.floor((Math.min(ay, b.y) - reach - y0) / cell)), j1 = Math.min(ny - 1, Math.ceil((Math.max(ay, b.y) + reach - y0) / cell))
      for (let j = j0; j <= j1; j++) {
        const qy = y0 + j * cell - ay, row = j * nx
        for (let i = i0; i <= i1; i++) {
          const qx = x0 + i * cell - ax
          let t = (qx * dx + qy * dy) * inv
          t = t < 0 ? 0 : t > 1 ? 1 : t
          const ex = qx - dx * t, ey = qy - dy * t, d2 = ex * ex + ey * ey
          if (d2 < v[row + i]!) v[row + i] = d2
        }
      }
    }
  }
  for (let k = 0; k < v.length; k++) v[k] = Math.sqrt(v[k]!)
  // the sign: inside a glyph's outline and outside its own counters, for any
  // glyph (a letter's strokes overlap one another)
  for (let j = 0; j < ny; j++) {
    const y = y0 + j * cell
    for (const g of glyphs) {
      const counters = g.counters.flatMap(c => spans(c, y))
      for (const [s0, s1] of spans(g.outer, y)) {
        for (let i = Math.max(0, Math.ceil((s0 - x0) / cell)); i < nx && x0 + i * cell < s1; i++) {
          const x = x0 + i * cell
          if (counters.some(([c0, c1]) => x > c0 && x < c1)) continue
          const at = j * nx + i
          if (v[at]! > 0) v[at] = -v[at]!
        }
      }
    }
  }
  return { x0, y0, nx, ny, cell, v }
}

/** The field between the grid's points. */
function sample(f: Field, x: number, y: number): number {
  const fx = Math.max(0, Math.min(f.nx - 1.001, (x - f.x0) / f.cell)), fy = Math.max(0, Math.min(f.ny - 1.001, (y - f.y0) / f.cell))
  const i = Math.floor(fx), j = Math.floor(fy), u = fx - i, w = fy - j
  const at = (a: number, b: number): number => f.v[b * f.nx + a]!
  return (at(i, j) * (1 - u) + at(i + 1, j) * u) * (1 - w) + (at(i, j + 1) * (1 - u) + at(i + 1, j + 1) * u) * w
}

/** Where the field crosses `level`, as closed loops, each turned so the side
 * under the level (the letter's side) lies on its left, and thinned to the
 * points a tenth of a millimetre can tell apart. */
function trace(f: Field, level: number): Vector2[][] {
  const { nx, ny, v, cell, x0, y0 } = f
  const point = new Map<number, Vector2>()
  const edge = (i: number, j: number, horizontal: boolean): number => {
    const key = (j * nx + i) * 2 + (horizontal ? 0 : 1)
    if (!point.has(key)) {
      const a = v[j * nx + i]!, b = horizontal ? v[j * nx + i + 1]! : v[(j + 1) * nx + i]!
      const t = (level - a) / (b - a)
      point.set(key, new Vector2(x0 + (i + (horizontal ? t : 0)) * cell, y0 + (j + (horizontal ? 0 : t)) * cell))
    }
    return key
  }
  const links = new Map<number, number[]>()
  const link = (a: number, b: number): void => {
    links.set(a, [...(links.get(a) ?? []), b]); links.set(b, [...(links.get(b) ?? []), a])
  }
  for (let j = 0; j + 1 < ny; j++) for (let i = 0; i + 1 < nx; i++) {
    const a = v[j * nx + i]! < level, b = v[j * nx + i + 1]! < level
    const c = v[(j + 1) * nx + i + 1]! < level, d = v[(j + 1) * nx + i]! < level
    const code = (a ? 1 : 0) | (b ? 2 : 0) | (c ? 4 : 0) | (d ? 8 : 0)
    if (code === 0 || code === 15) continue
    const bottom = (): number => edge(i, j, true), right = (): number => edge(i + 1, j, false)
    const top = (): number => edge(i, j + 1, true), left = (): number => edge(i, j, false)
    const centre = (v[j * nx + i]! + v[j * nx + i + 1]! + v[(j + 1) * nx + i + 1]! + v[(j + 1) * nx + i]!) / 4 < level
    switch (code) {
      case 1: case 14: link(left(), bottom()); break
      case 2: case 13: link(bottom(), right()); break
      case 3: case 12: link(left(), right()); break
      case 4: case 11: link(right(), top()); break
      case 6: case 9: link(bottom(), top()); break
      case 7: case 8: link(left(), top()); break
      case 5: if (centre) { link(left(), top()); link(bottom(), right()) } else { link(left(), bottom()); link(right(), top()) } break
      case 10: if (centre) { link(left(), bottom()); link(right(), top()) } else { link(left(), top()); link(bottom(), right()) } break
    }
  }
  const loops: Vector2[][] = []
  const done = new Set<number>()
  for (const startKey of links.keys()) {
    if (done.has(startKey)) continue
    const keys = [startKey]
    done.add(startKey)
    let previous = -1, current = startKey
    for (;;) {
      const next = (links.get(current) ?? []).find(k => k !== previous && (!done.has(k) || (k === startKey && keys.length > 2)))
      if (next === undefined || next === startKey) break
      done.add(next); keys.push(next); previous = current; current = next
    }
    if (keys.length < 3) continue
    let loop = keys.map(k => point.get(k)!)
    // the letter's side on the left: step off the loop's first edge
    const a = loop[0]!, b = loop[1]!
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1
    const probe = sample(f, (a.x + b.x) / 2 - (b.y - a.y) / len * cell * .5, (a.y + b.y) / 2 + (b.x - a.x) / len * cell * .5)
    if (probe > level) loop = loop.reverse()
    loops.push(thin(loop, 1e-4))
  }
  return loops.filter(l => l.length >= 3)
}

/** Douglas and Peucker's thinning, on a closed loop. */
function thin(loop: Vector2[], tolerance: number): Vector2[] {
  const n = loop.length
  if (n < 8) return loop
  const keep = new Uint8Array(n)
  let far = 0
  for (let i = 1; i < n; i++) if (loop[i]!.distanceToSquared(loop[0]!) > loop[far]!.distanceToSquared(loop[0]!)) far = i
  keep[0] = 1; keep[far] = 1
  const stack: [number, number][] = [[0, far], [far, n]]
  while (stack.length) {
    const [s, e] = stack.pop()!
    const a = loop[s]!, b = loop[e % n]!
    let worst = -1, index = -1
    const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1e-12
    for (let i = s + 1; i < e; i++) {
      const p = loop[i]!
      const d = Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx) / l
      if (d > worst) { worst = d; index = i }
    }
    if (worst > tolerance) { keep[index] = 1; stack.push([s, index], [index, e]) }
  }
  return loop.filter((_, i) => keep[i])
}

const area = (loop: readonly Vector2[]): number => {
  let a = 0
  for (let i = 0, n = loop.length; i < n; i++) { const p = loop[i]!, q = loop[(i + 1) % n]!; a += p.x * q.y - q.x * p.y }
  return a / 2
}
const inside = (p: Vector2, loop: readonly Vector2[]): boolean => {
  let hit = false
  for (let i = 0, n = loop.length, j = n - 1; i < n; j = i++) {
    const a = loop[i]!, b = loop[j]!
    if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) hit = !hit
  }
  return hit
}

/** Loops as polygons: every loop turned counter-clockwise is an outline, and
 * takes as its holes the clockwise loops that lie inside it and inside no
 * smaller outline. */
function polygons(loops: Vector2[][]): { outline: Vector2[]; holes: Vector2[][] }[] {
  const outlines = loops.filter(l => area(l) > 0).map(outline => ({ outline, holes: [] as Vector2[][], size: area(outline) }))
  outlines.sort((a, b) => a.size - b.size)
  for (const hole of loops.filter(l => area(l) <= 0)) {
    const owner = outlines.find(o => inside(hole[0]!, o.outline))
    if (owner) owner.holes.push(hole)
  }
  return outlines
}

/* ─── the surfaces ─────────────────────────────────────────────────────── */

/** Positions and normals, a triangle at a time, in panel space (x across, y
 * up the letter, z out of the stone). */
class Sheet {
  readonly p: number[] = []
  readonly n: number[] = []
  tri(a: Vector3, b: Vector3, c: Vector3, facing?: Vector3): void {
    const normal = b.clone().sub(a).cross(c.clone().sub(a))
    if (normal.lengthSq() < 1e-18) return
    normal.normalize()
    if (facing && normal.dot(facing) < 0) { const t = b; b = c; c = t; normal.negate() }
    for (const q of [a, b, c]) { this.p.push(q.x, q.y, q.z); this.n.push(normal.x, normal.y, normal.z) }
  }
  /** A polygon laid flat at `z`, facing out of the stone; its vertices may
   * sit at their own depth (`depth`) */
  flat(outline: Vector2[], holes: Vector2[][], depth: (loop: number) => number): void {
    const all = [outline, ...holes]
    const points = all.flatMap((loop, index) => loop.map(p => new Vector3(p.x, p.y, depth(index))))
    for (const [a, b, c] of ShapeUtils.triangulateShape(outline.map(p => p.clone()), holes.map(h => h.map(p => p.clone()))))
      this.tri(points[a!]!, points[b!]!, points[c!]!, new Vector3(0, 0, 1))
  }
  geometry(): BufferGeometry {
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(this.p, 3))
    g.setAttribute('normal', new Float32BufferAttribute(this.n, 3))
    g.setAttribute('uv', new Float32BufferAttribute(new Float32Array(this.p.length / 3 * 2), 2))
    return g
  }
}

export interface LedgerFace {
  /** the dressed face with the letters' mouths, their splays and walls */
  stone: BufferGeometry[]
  /** the filling at the bottom of every cut */
  filling: BufferGeometry[]
  lines: readonly string[]
}

/** THE FACE OF THE SLAB, with the name cut into it. The face is `width` by
 * `length`, lies face up at `top` and is `depth` thick; its head (+y in panel
 * space) points away from the visitor, toward local -z. */
export function cutLedgerFace(o: {
  centre: [number, number]; top: number; width: number; length: number; depth: number
  lines?: readonly string[]; cap?: number
}): LedgerFace {
  const lines = o.lines ?? LEDGER_NAME.lines
  const cap = o.cap ?? LEDGER_NAME.cap
  const step = cap * LEDGER_NAME.lineHeight
  const blockHeight = cap + step * (lines.length - 1)
  const blockTop = -LEDGER_NAME.towardFoot + blockHeight / 2
  const usable = o.width - LEDGER_NAME.margin * 2
  const hw = o.width / 2, hl = o.length / 2
  const C = LEDGER_CUT
  const face = new Sheet(), cut = new Sheet(), fill = new Sheet()
  const mouths: Vector2[][] = []
  lines.forEach((line, index) => {
    const set = cutGlyphs(line, cap, usable, 1.4)
    if (!set.glyphs.length) return
    const left = -set.width / 2, top = blockTop - index * step
    const glyphs = set.glyphs.map(glyph => ({
      outer: glyph.outer.map(p => new Vector2(p.x + left, p.y + top)),
      counters: glyph.counters.map(c => c.map(p => new Vector2(p.x + left, p.y + top))),
    }))
    const field = letterField(glyphs, C.cell, C.mouth + 2 * C.cell)
    const edges = trace(field, 0), rims = trace(field, C.mouth)
    const floor = -(C.splay + C.wall)
    // THE SPLAY: from the mouth at the face down to the letter's edge, on the
    // letter's outside and round the stone left standing in its counters
    for (const { outline, holes } of polygons([...rims, ...edges.map(e => [...e].reverse())])) {
      const outlineIsRim = rims.includes(outline)
      cut.flat(outline, holes, loop => (loop === 0) === outlineIsRim ? 0 : -C.splay)
    }
    // THE WALL, straight down from the edge to the filling, facing the letter
    for (const loop of edges) {
      for (let k = 0, n = loop.length; k < n; k++) {
        const a = loop[k]!, b = loop[(k + 1) % n]!
        const inward = new Vector3(-(b.y - a.y), b.x - a.x, 0)
        const a0 = new Vector3(a.x, a.y, -C.splay), b0 = new Vector3(b.x, b.y, -C.splay)
        const a1 = new Vector3(a.x, a.y, floor), b1 = new Vector3(b.x, b.y, floor)
        cut.tri(a0, a1, b1, inward); cut.tri(a0, b1, b0, inward)
      }
    }
    // THE FILLING, the letter's own shape at the foot of the wall
    for (const { outline, holes } of polygons(edges)) fill.flat(outline, holes, () => floor)
    // the face keeps the stone standing inside each letter's counters
    for (const { outline } of polygons(rims.map(r => [...r].reverse()))) face.flat(outline, [], () => 0)
    mouths.push(...rims.filter(r => area(r) > 0))
  })
  // THE DRESSED FACE round the mouths, and the slab's four sawn sides
  const rect = [new Vector2(-hw, -hl), new Vector2(hw, -hl), new Vector2(hw, hl), new Vector2(-hw, hl)]
  face.flat(rect, mouths.map(m => [...m].reverse()), () => 0)
  for (let k = 0; k < 4; k++) {
    const a = rect[k]!, b = rect[(k + 1) % 4]!
    const out = new Vector3(b.y - a.y, -(b.x - a.x), 0)
    const a0 = new Vector3(a.x, a.y, 0), b0 = new Vector3(b.x, b.y, 0), a1 = new Vector3(a.x, a.y, -o.depth), b1 = new Vector3(b.x, b.y, -o.depth)
    face.tri(a0, a1, b1, out); face.tri(a0, b1, b0, out)
  }
  const stone = [face.geometry(), cut.geometry()], filling = [fill.geometry()]
  // panel space to the slab: lie the face up at `top`, its head toward -z
  const matrix = new Matrix4().compose(
    new Vector3(o.centre[0], o.top, o.centre[1]),
    new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2),
    new Vector3(1, 1, 1),
  )
  for (const g of [...stone, ...filling]) g.applyMatrix4(matrix)
  return { stone, filling, lines }
}
