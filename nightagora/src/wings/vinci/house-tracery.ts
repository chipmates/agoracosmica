/** The oratory's windows carved: the documented form (two pointed lancets,
 * a central mullion, a quadrilobe in the tympan, Q175) cut as one stone
 * panel, its lancets moulded in orders and its lobes ringed. The outlines
 * are the shell's own; only the carving is proposed.
 */
import { BufferGeometry, Float32BufferAttribute, Group, Mesh, ShapeUtils, Vector2 } from 'three/webgpu'
import * as TSL from 'three/tsl'
import type { MaterialLibrary } from '../../stack/materials'
import { createShellSurface, prepareSurfaceGeometry } from './surface'

// TSL's composable overloads are typed once at this boundary.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any
const { attribute, float } = TSL as unknown as Record<string, N>
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
  positions: number[] = []; normals: number[] = []; uvs: number[] = []; tones: number[] = []; cavity: number[] = []
  vertex(p: V3, n: V3, t: V2, cavity = 1): void { this.positions.push(p[0], p[2], -p[1]); this.normals.push(n[0], n[2], -n[1]); this.uvs.push(t[0], t[1]); this.tones.push(1); this.cavity.push(cavity) }
}

export interface HouseTracery { group: Group; triangles: number }
/** A window's sill in its facade frame: the opening's start, width and base. */
export interface SillSpec { from: V2; to: V2; length: number; x: number; w: number; z: number }

/** THE SILL AS A MASON CUTS IT: the top weathered to shed water (about 12
 * degrees), a front a hand deep, a drip channel under the front edge so the
 * water leaves the stone instead of running back to the wall. Its section,
 * out from the wall face and down from the window's base, in metres; it
 * runs 50 mm into the wall, so the section is one simple outline. */
const SILL: V2[] = [[-.05, .012], [.095, -.018], [.10, -.028], [.10, -.10], [.074, -.10], [.074, -.092], [.062, -.092], [.062, -.10], [-.05, -.10]]
const SILL_RUN = .12
const SILL_CAP = ShapeUtils.triangulateShape(SILL.map(p => new Vector2(p[0], p[1])), [])

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
      // the back face lies inside the wall and is never seen
      if (p[0] === q[0] && p[0] < 0) continue
      const ex = q[0] - p[0], ez = q[1] - p[1], l = Math.hypot(ex, ez)
      if (l < 1e-6) continue
      // the section runs round the stone clockwise in (out, height), so its
      // outward side is to each edge's left
      const no = -ez / l, nz = ex / l
      const n: V3 = [outward[0] * no, outward[1] * no, nz]
      put(at(u0, p), at(u1, p), at(u1, q), n, [u0, p[1]], [u1, p[1]], [u1, q[1]])
      put(at(u0, p), at(u1, q), at(u0, q), n, [u0, p[1]], [u1, q[1]], [u0, q[1]])
    }
    // the two end faces, the section itself (the drip makes it concave, so
    // it is cut into triangles that do not overlap, never fanned)
    for (const [u, sign] of [[u0, -1], [u1, 1]] as [number, number][]) {
      const n: V3 = [along[0] * sign, along[1] * sign, 0]
      for (const f of SILL_CAP) {
        const a = SILL[f[0]!]!, b = SILL[f[1]!]!, c = SILL[f[2]!]!
        put(at(u, a), at(u, b), at(u, c), n, [a[0], a[1]], [b[0], b[1]], [c[0], c[1]])
      }
    }
  }
}

/** THE ORDERS ROUND A LIGHT, in (s, t): s out from the glass line in the
 * wall plane, t toward the eye from the wall face. Outer to inner: the arch
 * ring's joint, its face, a hollow, a roll half proud of the wall, the
 * chamfer down to the glass line, the reveal behind. Each point carries
 * the sky it sees (the reveal's shadow, not a painted line). */
interface Order { s: number; t: number; cavity: number; roll: boolean; fixed: boolean }
const RING_M = .14
const ROLL = { s: .040, t: 0, r: .020 }
function ordersProfile(): Order[] {
  const p: Order[] = [
    { s: RING_M, t: 0, cavity: .75, roll: false, fixed: true },
    { s: RING_M - .0035, t: -.0045, cavity: .55, roll: false, fixed: false },
    { s: RING_M - .007, t: 0, cavity: .8, roll: false, fixed: false },
    { s: .082, t: 0, cavity: 1, roll: false, fixed: false },
    { s: .074, t: -.010, cavity: .7, roll: false, fixed: false },
    { s: .066, t: -.013, cavity: .5, roll: false, fixed: false },
  ]
  for (let k = 0; k <= 12; k++) {
    const a = (-25 + k * 230 / 12) * Math.PI / 180
    p.push({ s: ROLL.s + Math.cos(a) * ROLL.r, t: ROLL.t + Math.sin(a) * ROLL.r, cavity: .62 + .38 * Math.max(0, Math.sin(a)) ** .6, roll: true, fixed: false })
  }
  p.push({ s: 0, t: -CHAMFER_M, cavity: .5, roll: false, fixed: true }, { s: 0, t: BACK_OUT, cavity: .3, roll: false, fixed: true })
  return p
}
const ORDERS = ordersProfile()
/** A joint is a V cut across the orders, this deep and this wide each side. */
const JOINT_DEPTH_M = .005, JOINT_HALF_M = .006
/** Voussoirs are cut to about this length along the arch. */
const VOUSSOIR_M = .16
/** The wall's own bed joints, so the jamb stones course with the ashlar. */
const COURSE_M = .28

/** The four rings of the quadrilobe: centreline radius, tube radius, depth. */
const RING = { radius: .103, tube: .015, depth: -.004, weave: .007, spread: .32 }

interface FV { u: number; v: number; t: number; n: V3; c: number }
function clipPoly(poly: FV[], keep: (p: FV) => number): FV[] {
  const out: FV[] = []
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!, b = poly[(i + 1) % poly.length]!, fa = keep(a), fb = keep(b)
    if (fa >= 0) out.push(a)
    if ((fa >= 0) !== (fb >= 0)) {
      const k = fa / (fa - fb), mix = (x: number, y: number): number => x + (y - x) * k
      out.push({ u: mix(a.u, b.u), v: mix(a.v, b.v), t: mix(a.t, b.t), n: [mix(a.n[0], b.n[0]), mix(a.n[1], b.n[1]), mix(a.n[2], b.n[2])], c: mix(a.c, b.c) })
    }
  }
  return out
}

export function createHouseTracery(windows: readonly TraceryWindow[], tier: 'hero' | 'standard' | 'calm', library?: MaterialLibrary, sillList: readonly SillSpec[] = []): HouseTracery {
  const sink = new Sink()
  sills(sink, sillList)
  for (const win of windows) {
    const dx = (win.to[0] - win.from[0]) / win.length, dy = (win.to[1] - win.from[1]) / win.length
    const outward: V3 = [dy, -dx, 0], along: V3 = [dx, dy, 0]
    const at = (u: number, v: number, out: number): V3 => [win.from[0] + dx * u + dy * out, win.from[1] + dy * u - dx * out, v]
    const norm = (n: V3): V3 => { const l = Math.hypot(...n) || 1; return [n[0] / l, n[1] / l, n[2] / l] }
    /** a normal in the facade frame (along, up, toward the eye) to the world */
    const world = (n: V3): V3 => norm([along[0] * n[0] + outward[0] * n[2], along[1] * n[0] + outward[1] * n[2], n[1]])
    const tri = (a: V3, b: V3, c: V3, ta: V2, tb: V2, tc: V2, na: V3, nb: V3, nc: V3, ca = 1, cb = ca, cc = ca): void => {
      const u: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v: V3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
      const g: V3 = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
      const ref: V3 = [na[0] + nb[0] + nc[0], na[1] + nb[1] + nc[1], na[2] + nb[2] + nc[2]]
      if (g[0] * ref[0] + g[1] * ref[1] + g[2] * ref[2] < 0) { sink.vertex(a, na, ta, ca); sink.vertex(c, nc, tc, cc); sink.vertex(b, nb, tb, cb) }
      else { sink.vertex(a, na, ta, ca); sink.vertex(b, nb, tb, cb); sink.vertex(c, nc, tc, cc) }
    }
    /** A facade-frame polygon, clipped to its cell, fanned into the sink. */
    const emit = (poly: FV[], cell: [number, number, number, number]): void => {
      let p = poly
      p = clipPoly(p, q => q.u - cell[0]); p = clipPoly(p, q => cell[1] - q.u)
      p = clipPoly(p, q => q.v - cell[2]); p = clipPoly(p, q => cell[3] - q.v)
      if (p.length < 3) return
      const P = p.map(q => at(q.u, q.v, q.t)), N = p.map(q => world(q.n))
      for (let k = 1; k < p.length - 1; k++) tri(P[0]!, P[k]!, P[k + 1]!, [p[0]!.u, p[0]!.v], [p[k]!.u, p[k]!.v], [p[k + 1]!.u, p[k + 1]!.v], N[0]!, N[k]!, N[k + 1]!, p[0]!.c, p[k]!.c, p[k + 1]!.c)
    }
    /** The lobes' chamfer: a band from its outer arc on the face to the glass. */
    const band = (outer: V2[], glassLine: V2[]): void => {
      const m = glassLine.length
      const edgeNormal = (i: number): V2 => { const a = glassLine[i]!, b = glassLine[Math.min(m - 1, i + 1)]!, l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[1] - a[1]) / l, -(b[0] - a[0]) / l] }
      const away = glassLine.map((_, i): V2 => {
        const prev = edgeNormal(Math.max(0, i - 1)), next = edgeNormal(Math.min(m - 2, i))
        const s: V2 = [prev[0] + next[0], prev[1] + next[1]], l = Math.hypot(s[0], s[1]) || 1
        return [s[0] / l, s[1] / l]
      })
      for (let i = 0; i < m - 1; i++) {
        const j = i + 1, o0 = outer[i]!, o1 = outer[j]!, g0 = glassLine[i]!, g1 = glassLine[j]!
        const cn = (k: number): V3 => world([-away[k]![0], -away[k]![1], 1])
        const rn = (k: number): V3 => world([-away[k]![0], -away[k]![1], 0])
        const depth = FACE_OUT - CHAMFER_M
        tri(at(o0[0], o0[1], FACE_OUT), at(o1[0], o1[1], FACE_OUT), at(g1[0], g1[1], depth), o0, o1, g1, cn(i), cn(j), cn(j), .95, .95, .6)
        tri(at(o0[0], o0[1], FACE_OUT), at(g1[0], g1[1], depth), at(g0[0], g0[1], depth), o0, g1, g0, cn(i), cn(j), cn(i), .95, .6, .6)
        tri(at(g0[0], g0[1], depth), at(g1[0], g1[1], depth), at(g1[0], g1[1], BACK_OUT), g0, g1, [g1[0], g1[1] - .1], rn(i), rn(j), rn(j), .5, .5, .3)
        tri(at(g0[0], g0[1], depth), at(g1[0], g1[1], BACK_OUT), at(g0[0], g0[1], BACK_OUT), g0, [g1[0], g1[1] - .1], [g0[0], g0[1] - .1], rn(i), rn(j), rn(i), .5, .3, .3)
      }
    }
    /** THE ORDERS SWEPT round a lancet's jambs and head, stopped on its sill
     * ledge, cut into jamb stones on the wall's courses and voussoirs on the
     * head, and clipped to the lancet's own cell of the panel. */
    const orders = (glass: V2[], cell: [number, number, number, number]): V2[] => {
      // the path: up the right jamb, over the head, down the left jamb
      const path = [...glass.slice(1), glass[0]!]
      const n = path.length
      const edgeN: V2[] = [], len: number[] = [], sigma: number[] = [0]
      for (let i = 0; i < n - 1; i++) {
        const a = path[i]!, b = path[i + 1]!, l = Math.hypot(b[0] - a[0], b[1] - a[1])
        edgeN.push([(b[1] - a[1]) / l, -(b[0] - a[0]) / l]); len.push(l); sigma.push(sigma[i]! + l)
      }
      // where the head springs on each side, and its crown
      const springV = glass[2]![1]
      const iSpringR = path.findIndex((p, i) => i > 0 && Math.abs(p[1] - springV) < 1e-6)
      const iSpringL = n - 2
      const iCrown = path.reduce((best, p, i) => p[1] > path[best]![1] ? i : best, 0)
      const joints: number[] = []
      const bottom = path[0]![1]
      for (let k = Math.ceil((bottom + .08) / COURSE_M); k * COURSE_M < springV - .06; k++) {
        const h = k * COURSE_M - bottom
        joints.push(h, sigma[n - 1]! - h)
      }
      joints.push(sigma[iSpringR]!, sigma[iSpringL]!)
      for (const [a, b] of [[iSpringR, iCrown], [iCrown, iSpringL]] as [number, number][]) {
        const L = sigma[b]! - sigma[a]!, count = Math.max(2, Math.round(L / VOUSSOIR_M))
        for (let k = 1; k <= count; k++) if (!(a === iCrown && k === count)) joints.push(sigma[a]! + L * k / count)
      }
      // the stations: every path corner, and three about every joint
      type Station = { p: V2; a: V2; miter: number; groove: boolean; sigma: number }
      const stations: Station[] = []
      for (let i = 0; i < n; i++) {
        const prev = i > 0 ? edgeN[i - 1]! : edgeN[0]!, next = i < n - 1 ? edgeN[i]! : edgeN[n - 2]!
        const s: V2 = [prev[0] + next[0], prev[1] + next[1]], l = Math.hypot(s[0], s[1]) || 1, a: V2 = [s[0] / l, s[1] / l]
        stations.push({ p: path[i]!, a, miter: 1 / Math.max(.3, a[0] * next[0] + a[1] * next[1]), groove: false, sigma: sigma[i]! })
      }
      const onEdge = (sg: number, groove: boolean): Station => {
        let i = 0
        while (i < n - 2 && sigma[i + 1]! <= sg) i++
        const k = (sg - sigma[i]!) / len[i]!, a = path[i]!, b = path[i + 1]!
        return { p: [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k], a: edgeN[i]!, miter: 1, groove, sigma: sg }
      }
      for (const j of joints) {
        if (j - JOINT_HALF_M <= 0 || j + JOINT_HALF_M >= sigma[n - 1]!) continue
        const corner = stations.find(s => Math.abs(s.sigma - j) < 1e-6)
        if (corner) corner.groove = true
        else stations.push(onEdge(j, true))
        stations.push(onEdge(j - JOINT_HALF_M, false), onEdge(j + JOINT_HALF_M, false))
      }
      stations.sort((x, y) => x.sigma - y.sigma)
      // each order's normal in (s, t): radial on the roll, its segment's own elsewhere
      const segN = (k: number): V2 => { const a = ORDERS[k]!, b = ORDERS[k + 1]!, ds = b.s - a.s, dt = b.t - a.t, l = Math.hypot(ds, dt) || 1; return [dt / l, -ds / l] }
      const pointN = (k: number): V2 => {
        const o = ORDERS[k]!
        if (o.roll) return [(o.s - ROLL.s) / ROLL.r, (o.t - ROLL.t) / ROLL.r]
        const a = k > 0 ? segN(k - 1) : segN(0), b = k < ORDERS.length - 1 ? segN(k) : segN(k - 1), l = Math.hypot(a[0] + b[0], a[1] + b[1]) || 1
        return [(a[0] + b[0]) / l, (a[1] + b[1]) / l]
      }
      const place = (st: Station, k: number): { u: number; v: number; t: number } => {
        const o = ORDERS[k]!, cut = st.groove && !o.fixed ? JOINT_DEPTH_M : 0, pn = pointN(k)
        const s = o.s - pn[0] * cut, t = o.t - pn[1] * cut
        return { u: st.p[0] + st.a[0] * s * st.miter, v: st.p[1] + st.a[1] * s * st.miter, t }
      }
      for (let i = 0; i < stations.length - 1; i++) {
        const A = stations[i]!, B = stations[i + 1]!
        for (let k = 0; k < ORDERS.length - 1; k++) {
          const smooth = ORDERS[k]!.roll && ORDERS[k + 1]!.roll
          const n0 = smooth ? pointN(k) : segN(k), n1 = smooth ? pointN(k + 1) : segN(k)
          const fv = (st: Station, kk: number, nn: V2): FV => { const q = place(st, kk); return { u: q.u, v: q.v, t: q.t, n: [nn[0] * st.a[0], nn[0] * st.a[1], nn[1]], c: ORDERS[kk]!.cavity * (st.groove && !ORDERS[kk]!.fixed ? .7 : 1) } }
          emit([fv(A, k, n0), fv(B, k, n0), fv(B, k + 1, n1), fv(A, k + 1, n1)], cell)
        }
      }
      // each end stops on the ledge: its section, facing down
      for (const st of [stations[0]!, stations[stations.length - 1]!]) {
        const ring = ORDERS.map((_, k) => place(st, k))
        ring.push({ u: st.p[0] + st.a[0] * RING_M, v: st.p[1], t: BACK_OUT })
        const flat = ring.map(q => new Vector2(q.u * st.a[0] + q.v * st.a[1], q.t))
        for (const f of ShapeUtils.triangulateShape(flat, [])) {
          const q = f.map(i => ring[i]!)
          emit(q.map(r => ({ ...r, n: [0, -1, 0] as V3, c: .5 })), cell)
        }
      }
      // what the face gives up to this lancet: its orders' outer line and the sill line
      return offsetOutline(glass, RING_M, true)
    }
    // THE PANEL FACE: the opening's rectangle less every light's outer line.
    let face: V2[][] = [[[win.x, win.z], [win.x + win.w, win.z], [win.x + win.w, win.z + win.h], [win.x, win.z + win.h]]]
    const panes = win.lancets.length
    for (const [i, lancet] of win.lancets.entries()) {
      const glass = ccw(lancet)
      // bottom edge first: find the lowest horizontal edge and rotate to it
      let start = 0, low = Infinity
      for (let k = 0; k < glass.length; k++) { const a = glass[k]!, b = glass[(k + 1) % glass.length]!; const m = (a[1] + b[1]) / 2; if (Math.abs(a[1] - b[1]) < 1e-6 && m < low) { low = m; start = k } }
      const g = [...glass.slice(start), ...glass.slice(0, start)]
      const cell: [number, number, number, number] = [win.x + i * win.w / panes, win.x + (i + 1) * win.w / panes, win.z, win.z + win.h]
      const outer = orders(g, cell)
      face = face.flatMap(p => subtract(p, outer))
      // the ledge the glass stands on, level, from the face to the room
      const y = g[0]![1], u0 = g[0]![0], u1 = g[1]![0]
      emit([{ u: u0, v: y, t: FACE_OUT, n: [0, 1, 0], c: .85 }, { u: u1, v: y, t: FACE_OUT, n: [0, 1, 0], c: .85 }, { u: u1, v: y, t: BACK_OUT, n: [0, 1, 0], c: .4 }, { u: u0, v: y, t: BACK_OUT, n: [0, 1, 0], c: .4 }], cell)
    }
    if (win.lobes) {
      const { centre: c, radius: r } = win.lobes, R = r + CHAMFER_M
      // outer cusps where two widened lobes meet, then each lobe's two arcs
      const p = (r + Math.sqrt(2 * R * R - r * r)) / 2
      const cuspAngle = Math.atan2(p, p - r)
      const centres: V2[] = []
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2, lc: V2 = [c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r]
        centres.push(lc)
        face = face.flatMap(q => subtract(q, disc(lc, R, 40)))
        const steps = 14, glass: V2[] = [], outer: V2[] = []
        for (let k = 0; k <= steps; k++) {
          const t = k / steps
          const ga = a - Math.PI / 2 + t * Math.PI, oa = a - (cuspAngle) + t * 2 * cuspAngle
          glass.push([lc[0] + Math.cos(ga) * r, lc[1] + Math.sin(ga) * r]); outer.push([lc[0] + Math.cos(oa) * R, lc[1] + Math.sin(oa) * R])
        }
        band(outer, glass)
      }
      // FOUR MOULDED RINGS, INTERLACED. Each ring rides its own lobe's
      // chamfer and crosses its two neighbours twice; at every crossing one
      // ring passes over and one under, alternating round each ring.
      const crossings: { ring: number; angle: number; over: boolean }[] = []
      for (let k = 0; k < 4; k++) {
        const j = (k + 1) % 4, a = centres[k]!, b = centres[j]!
        const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, d = Math.hypot(b[0] - a[0], b[1] - a[1])
        const h = Math.sqrt(Math.max(0, RING.radius ** 2 - (d / 2) ** 2)), px = -(b[1] - a[1]) / d, py = (b[0] - a[0]) / d
        for (const side of [1, -1]) {
          const x = mx + px * h * side, y = my + py * h * side
          const outerCrossing = Math.hypot(x - c[0], y - c[1]) > Math.hypot(mx - c[0], my - c[1])
          crossings.push({ ring: k, angle: Math.atan2(y - a[1], x - a[0]), over: outerCrossing })
          crossings.push({ ring: j, angle: Math.atan2(y - b[1], x - b[0]), over: !outerCrossing })
        }
      }
      const SEG = 72, TUBE = 10
      for (let k = 0; k < 4; k++) {
        const lc = centres[k]!, mine = crossings.filter(x => x.ring === k)
        const lift = (phi: number): number => {
          let d = 0
          for (const x of mine) { let w = phi - x.angle; w = Math.atan2(Math.sin(w), Math.cos(w)); d += (x.over ? 1 : -1) * Math.exp(-((w / RING.spread) ** 2)) }
          return RING.depth + RING.weave * Math.max(-1, Math.min(1, d))
        }
        const point = (i: number, j: number): FV => {
          const phi = i / SEG * Math.PI * 2, psi = j / TUBE * Math.PI * 2, rho: V2 = [Math.cos(phi), Math.sin(phi)]
          const cu = Math.cos(psi), su = Math.sin(psi), R0 = RING.radius + cu * RING.tube
          return { u: lc[0] + rho[0] * R0, v: lc[1] + rho[1] * R0, t: lift(phi) + su * RING.tube, n: [rho[0] * cu, rho[1] * cu, su], c: .7 + .3 * Math.max(0, su) }
        }
        const all: [number, number, number, number] = [win.x, win.x + win.w, win.z, win.z + win.h]
        for (let i = 0; i < SEG; i++) for (let j = 0; j < TUBE; j++) emit([point(i, j), point(i + 1, j), point(i + 1, j + 1), point(i, j + 1)], all)
      }
    }
    const n: V3 = outward
    for (const poly of face) {
      const P = ccw(poly)
      for (let k = 1; k < P.length - 1; k++) tri(at(P[0]![0], P[0]![1], FACE_OUT), at(P[k]![0], P[k]![1], FACE_OUT), at(P[k + 1]![0], P[k + 1]![1], FACE_OUT), P[0]!, P[k]!, P[k + 1]!, n, n, n)
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(sink.positions, 3))
  geometry.setAttribute('normal', new Float32BufferAttribute(sink.normals, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(sink.uvs, 2))
  geometry.setAttribute('tone', new Float32BufferAttribute(sink.tones, 1))
  geometry.setAttribute('cavity', new Float32BufferAttribute(sink.cavity, 1))
  geometry.computeBoundingSphere()
  prepareSurfaceGeometry(geometry, 'stone')
  const material = createShellSurface('stone', library, [], { coursing: false, tops: .45 })
  // the sky a carved hollow sees is its own; the orders keep their shadow
  material.aoNode = ((material.aoNode as N) ?? float(1)).mul(attribute('cavity', 'float'))
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
  recipe: 'The traceried windows cut as one tuffeau panel on the wall plane inside their registered opening. Round every lancet the orders are swept from the arch ring in: a 140 mm arch ring with a V joint at its extrados, a hollow, a 40 mm roll half proud of the wall, a chamfer to the shell\'s glass line, the reveal running on 140 mm behind; the jamb stones are jointed on the wall\'s 0.28 m courses, the heads cut into voussoirs of about 160 mm, and the mullion\'s two rolls meet on its centre line. The quadrilobe\'s lobes keep the shell\'s glass line, chamfered 35 mm at 45 degrees, and carry four moulded rings 30 mm thick on a 103 mm radius, interlaced over and under. Each carved face carries the share of sky it sees as an occlusion term. Outlines, lancet height and lobe radius stay the shell\'s (Q175, ARVIVA-0); the orders, rings, joints and panel depth are proposals. Every window sill is recut as a weathered stone: a top falling about 12 degrees, a 100 mm projection and front, a 12 mm drip channel under the front edge, 120 mm past each jamb, 50 mm into the wall.',
} as const
