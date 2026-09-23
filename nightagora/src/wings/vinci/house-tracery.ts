/** The oratory's windows carved: the documented form (two pointed lancets,
 * a central mullion, a quadrilobe in the tympan, Q175) cut as one stone
 * panel whose every light is chamfered back to its glass. The outlines are
 * the shell's own; only the depth of the carving is proposed.
 */
import { BufferGeometry, Float32BufferAttribute, Group, Mesh } from 'three/webgpu'
import type { MaterialLibrary } from '../../stack/materials'
import { createShellSurface, prepareSurfaceGeometry } from './surface'

type V2 = [number, number]
type V3 = [number, number, number]
export interface TraceryWindow {
  id: string
  from: V2
  to: V2
  length: number
  /** the opening in the facade frame: along, base, width, height */
  x: number; z: number; w: number; h: number
  thickness: number
  /** each light's glass line, (along, height), bottom edge first */
  lancets: V2[][]
  mullions: number[]
  lobes: { centre: V2; radius: number } | null
  glassOut: number
}

/** A 35 mm chamfer at 45 degrees runs from the panel's face to the glass line. */
const CHAMFER_M = .035
/** The panel stands in the opening's own recess, its face on the wall plane. */
const FACE_OUT = 0
const BACK_OUT = -.14

function area(p: V2[]): number { let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i]!, b = p[(i + 1) % p.length]!; s += a[0] * b[1] - b[0] * a[1] } return s / 2 }
const ccw = (p: V2[]): V2[] => area(p) < 0 ? [...p].reverse() : p
/** Offset a convex counter-clockwise outline outward, edge by edge. The edge
 * that starts at index 0 is the sill line and stays where it is. */
function offsetOutline(p: V2[], d: number, keepFirst: boolean): V2[] {
  const n = p.length, lines: { a: V2; dir: V2 }[] = []
  for (let i = 0; i < n; i++) {
    const a = p[i]!, b = p[(i + 1) % n]!, l = Math.hypot(b[0] - a[0], b[1] - a[1])
    const dir: V2 = [(b[0] - a[0]) / l, (b[1] - a[1]) / l], out: V2 = [dir[1], -dir[0]]
    const k = keepFirst && i === 0 ? 0 : d
    lines.push({ a: [a[0] + out[0] * k, a[1] + out[1] * k], dir })
  }
  return lines.map((l, i) => {
    const prev = lines[(i + n - 1) % n]!
    const det = prev.dir[0] * l.dir[1] - prev.dir[1] * l.dir[0]
    if (Math.abs(det) < 1e-9) return l.a
    const t = ((l.a[0] - prev.a[0]) * l.dir[1] - (l.a[1] - prev.a[1]) * l.dir[0]) / det
    return [prev.a[0] + prev.dir[0] * t, prev.a[1] + prev.dir[1] * t] as V2
  })
}
/** Pieces of `poly` outside the convex counter-clockwise region `cut`. */
function subtract(poly: V2[], cut: V2[]): V2[][] {
  const out: V2[][] = []
  let inside = poly
  for (let i = 0; i < cut.length && inside.length >= 3; i++) {
    const a = cut[i]!, b = cut[(i + 1) % cut.length]!
    const side = (p: V2): number => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])
    const split = (keepInside: boolean): V2[] => {
      const r: V2[] = []
      for (let k = 0; k < inside.length; k++) {
        const p = inside[k]!, q = inside[(k + 1) % inside.length]!, sp = side(p) * (keepInside ? 1 : -1), sq = side(q) * (keepInside ? 1 : -1)
        if (sp >= -1e-9) r.push(p)
        if ((sp > 1e-9 && sq < -1e-9) || (sp < -1e-9 && sq > 1e-9)) { const t = sp / (sp - sq); r.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]) }
      }
      return r
    }
    const outside = split(false)
    if (outside.length >= 3 && Math.abs(area(outside)) > 1e-7) out.push(outside)
    inside = split(true)
  }
  return out
}
const disc = (c: V2, r: number, steps = 36): V2[] => Array.from({ length: steps }, (_, i) => [c[0] + Math.cos(i / steps * Math.PI * 2) * r, c[1] + Math.sin(i / steps * Math.PI * 2) * r] as V2)

class Sink {
  positions: number[] = []; normals: number[] = []; uvs: number[] = []; tones: number[] = []
  vertex(p: V3, n: V3, t: V2): void { this.positions.push(p[0], p[2], -p[1]); this.normals.push(n[0], n[2], -n[1]); this.uvs.push(t[0], t[1]); this.tones.push(1) }
}

export interface HouseTracery { group: Group; triangles: number }
/** A window's sill in its facade frame: the opening's start, width and base. */
export interface SillSpec { from: V2; to: V2; length: number; x: number; w: number; z: number }

/** THE SILL AS A MASON CUTS IT: the top weathered to shed water (about 12
 * degrees), a front a hand deep, a drip channel under the front edge so the
 * water leaves the stone instead of running back to the wall. Its section,
 * out from the wall face and down from the window's base, in metres. */
const SILL: V2[] = [[-.05, .012], [.095, -.018], [.10, -.028], [.10, -.10], [.074, -.10], [.074, -.092], [.062, -.092], [.062, -.10], [0, -.10], [0, .012]]
const SILL_RUN = .12

function sills(sink: Sink, list: readonly SillSpec[]): void {
  for (const s of list) {
    const dx = (s.to[0] - s.from[0]) / s.length, dy = (s.to[1] - s.from[1]) / s.length
    const outward: V3 = [dy, -dx, 0], along: V3 = [dx, dy, 0]
    const at = (u: number, p: V2): V3 => [s.from[0] + dx * u + dy * p[0], s.from[1] + dy * u - dx * p[0], s.z + p[1]]
    const u0 = s.x - SILL_RUN, u1 = s.x + s.w + SILL_RUN
    const put = (a: V3, b: V3, c: V3, n: V3, ta: V2, tb: V2, tc: V2): void => {
      const e1: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2: V3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
      const g: V3 = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]
      if (g[0] * n[0] + g[1] * n[1] + g[2] * n[2] < 0) { sink.vertex(a, n, ta); sink.vertex(c, n, tc); sink.vertex(b, n, tb) }
      else { sink.vertex(a, n, ta); sink.vertex(b, n, tb); sink.vertex(c, n, tc) }
    }
    // the swept faces, each with the section edge's own outward normal
    for (let i = 0; i < SILL.length; i++) {
      const p = SILL[i]!, q = SILL[(i + 1) % SILL.length]!
      // the back face lies on the wall plane and is never seen
      if (p[0] === 0 && q[0] === 0) continue
      const ex = q[0] - p[0], ez = q[1] - p[1], l = Math.hypot(ex, ez)
      if (l < 1e-6) continue
      // the section runs round the stone clockwise in (out, height), so its
      // outward side is to each edge's left
      const no = -ez / l, nz = ex / l
      const n: V3 = [outward[0] * no, outward[1] * no, nz]
      put(at(u0, p), at(u1, p), at(u1, q), n, [u0, p[1]], [u1, p[1]], [u1, q[1]])
      put(at(u0, p), at(u1, q), at(u0, q), n, [u0, p[1]], [u1, q[1]], [u0, q[1]])
    }
    // the two end faces, the section itself
    for (const [u, sign] of [[u0, -1], [u1, 1]] as [number, number][]) {
      const n: V3 = [along[0] * sign, along[1] * sign, 0]
      for (let k = 1; k < SILL.length - 1; k++) put(at(u, SILL[0]!), at(u, SILL[k]!), at(u, SILL[k + 1]!), n, [SILL[0]![0], SILL[0]![1]], [SILL[k]![0], SILL[k]![1]], [SILL[k + 1]![0], SILL[k + 1]![1]])
    }
  }
}

export function createHouseTracery(windows: readonly TraceryWindow[], tier: 'hero' | 'standard' | 'calm', library?: MaterialLibrary, sillList: readonly SillSpec[] = []): HouseTracery {
  const sink = new Sink()
  sills(sink, sillList)
  for (const win of windows) {
    const dx = (win.to[0] - win.from[0]) / win.length, dy = (win.to[1] - win.from[1]) / win.length
    const outward: V3 = [dy, -dx, 0], along: V3 = [dx, dy, 0]
    const at = (u: number, v: number, out: number): V3 => [win.from[0] + dx * u + dy * out, win.from[1] + dy * u - dx * out, v]
    const inPlane = (du: number, dv: number): V3 => [along[0] * du, along[1] * du, dv]
    const norm = (n: V3): V3 => { const l = Math.hypot(...n); return [n[0] / l, n[1] / l, n[2] / l] }
    const tri = (a: V3, b: V3, c: V3, ta: V2, tb: V2, tc: V2, na: V3, nb: V3, nc: V3): void => {
      const u: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v: V3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
      const g: V3 = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
      const ref: V3 = [na[0] + nb[0] + nc[0], na[1] + nb[1] + nc[1], na[2] + nb[2] + nc[2]]
      if (g[0] * ref[0] + g[1] * ref[1] + g[2] * ref[2] < 0) { sink.vertex(a, na, ta); sink.vertex(c, nc, tc); sink.vertex(b, nb, tb) }
      else { sink.vertex(a, na, ta); sink.vertex(b, nb, tb); sink.vertex(c, nc, tc) }
    }
    /** A band from an outer outline on the panel face to its glass line and
     * on through the panel: the chamfer, then the straight reveal behind. */
    const band = (outer: V2[], glassLine: V2[], closed: boolean, sillFirst = false): void => {
      const m = glassLine.length, count = closed ? m : m - 1
      // each vertex's own direction away from the light: the mean of its two
      // edges' outward normals, so a curved chamfer shades as one surface
      const edgeNormal = (i: number): V2 => { const a = glassLine[i]!, b = glassLine[(i + 1) % m]!, l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[1] - a[1]) / l, -(b[0] - a[0]) / l] }
      const away = glassLine.map((_, i): V2 => {
        const prev = closed || i > 0 ? edgeNormal((i + m - 1) % m) : edgeNormal(0), next = closed || i < m - 1 ? edgeNormal(i) : edgeNormal(m - 2)
        const s: V2 = [prev[0] + next[0], prev[1] + next[1]], l = Math.hypot(s[0], s[1]) || 1
        return [s[0] / l, s[1] / l]
      })
      for (let i = 0; i < count; i++) {
        const j = (i + 1) % m
        const o0 = outer[i]!, o1 = outer[j]!, g0 = glassLine[i]!, g1 = glassLine[j]!
        // the sill line's band is the level ledge in front of the glass
        const ledge = sillFirst && i === 0
        const cn = (k: number): V3 => { if (ledge) return [0, 0, 1]; const a = away[k]!; return norm([outward[0] - along[0] * a[0], outward[1] - along[1] * a[0], -a[1]]) }
        const rn = (k: number): V3 => { if (ledge) return [0, 0, 1]; const a = away[k]!; return norm([-along[0] * a[0], -along[1] * a[0], -a[1]]) }
        const flat = Math.hypot(o0[0] - g0[0], o0[1] - g0[1]) < 1e-5
        const depth = flat ? FACE_OUT : FACE_OUT - CHAMFER_M
        if (!flat) {
          const A = at(o0[0], o0[1], FACE_OUT), B = at(o1[0], o1[1], FACE_OUT), C = at(g1[0], g1[1], depth), D = at(g0[0], g0[1], depth)
          tri(A, B, C, o0, o1, g1, cn(i), cn(j), cn(j)); tri(A, C, D, o0, g1, g0, cn(i), cn(j), cn(i))
        }
        const E = at(g0[0], g0[1], depth), F = at(g1[0], g1[1], depth), G = at(g1[0], g1[1], BACK_OUT), H = at(g0[0], g0[1], BACK_OUT)
        tri(E, F, G, g0, g1, [g1[0], g1[1] - .1], rn(i), rn(j), rn(j)); tri(E, G, H, g0, [g1[0], g1[1] - .1], [g0[0], g0[1] - .1], rn(i), rn(j), rn(i))
      }
    }
    // THE PANEL FACE: the opening's rectangle less every light's outer line.
    let face: V2[][] = [[[win.x, win.z], [win.x + win.w, win.z], [win.x + win.w, win.z + win.h], [win.x, win.z + win.h]]]
    for (const lancet of win.lancets) {
      const glass = ccw(lancet)
      // bottom edge first: find the lowest horizontal edge and rotate to it
      let start = 0, low = Infinity
      for (let i = 0; i < glass.length; i++) { const a = glass[i]!, b = glass[(i + 1) % glass.length]!; const m = (a[1] + b[1]) / 2; if (Math.abs(a[1] - b[1]) < 1e-6 && m < low) { low = m; start = i } }
      const g = [...glass.slice(start), ...glass.slice(0, start)]
      const outer = offsetOutline(g, CHAMFER_M, true)
      face = face.flatMap(p => subtract(p, outer))
      band(outer, g, true, true)
    }
    if (win.lobes) {
      const { centre: c, radius: r } = win.lobes, R = r + CHAMFER_M
      // outer cusps where two widened lobes meet, then each lobe's two arcs
      const p = (r + Math.sqrt(2 * R * R - r * r)) / 2
      const cuspAngle = Math.atan2(p, p - r)
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2, lc: V2 = [c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r]
        face = face.flatMap(q => subtract(q, disc(lc, R, 40)))
        const steps = 14, glass: V2[] = [], outer: V2[] = []
        for (let k = 0; k <= steps; k++) {
          const t = k / steps
          const ga = a - Math.PI / 2 + t * Math.PI, oa = a - (cuspAngle) + t * 2 * cuspAngle
          glass.push([lc[0] + Math.cos(ga) * r, lc[1] + Math.sin(ga) * r]); outer.push([lc[0] + Math.cos(oa) * R, lc[1] + Math.sin(oa) * R])
        }
        band(outer, glass, false)
      }
    }
    const n: V3 = outward
    for (const poly of face) {
      const P = ccw(poly)
      for (let k = 1; k < P.length - 1; k++) tri(at(P[0]![0], P[0]![1], FACE_OUT), at(P[k]![0], P[k]![1], FACE_OUT), at(P[k + 1]![0], P[k + 1]![1], FACE_OUT), P[0]!, P[k]!, P[k + 1]!, n, n, n)
    }
    void inPlane
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(sink.positions, 3))
  geometry.setAttribute('normal', new Float32BufferAttribute(sink.normals, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(sink.uvs, 2))
  geometry.setAttribute('tone', new Float32BufferAttribute(sink.tones, 1))
  geometry.computeBoundingSphere()
  prepareSurfaceGeometry(geometry, 'stone')
  const material = createShellSurface('stone', library, [], { coursing: false, tops: .45 })
  const mesh = new Mesh(geometry, material)
  mesh.name = 'vinci/house-tracery/stone'
  mesh.castShadow = tier === 'hero'; mesh.receiveShadow = true
  mesh.userData['manifestId'] = houseTraceryProvenance.manifestId; mesh.userData['asset'] = houseTraceryProvenance.manifestId
  const group = new Group(); group.name = 'vinci/house-tracery'; group.add(mesh)
  group.userData['manifestId'] = houseTraceryProvenance.manifestId
  const triangles = sink.positions.length / 9
  group.userData['triangles'] = triangles
  return { group, triangles }
}

export const houseTraceryProvenance = {
  manifestId: 'vinci/house-tracery',
  assetClass: 'GENERATED',
  certainty: 'conjectural',
  recipe: 'The traceried windows cut as one tuffeau panel on the wall plane inside their registered opening: each lancet and each lobe of the quadrilobe keeps the shell\'s glass line and is chamfered 35 mm at 45 degrees to it, the reveal running on 140 mm behind; the mullion is what the chamfers leave between the lights. Outlines, lancet height and lobe radius stay the shell\'s (Q175, ARVIVA-0); the chamfer and the panel depth are proposals. Every window sill is recut as a weathered stone: a top falling about 12 degrees, a 100 mm projection and front, a 12 mm drip channel under the front edge, 120 mm past each jamb.',
} as const
