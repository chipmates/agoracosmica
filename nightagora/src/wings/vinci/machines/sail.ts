/** THE SAIL AS A SAILMAKER SEWS IT. The dossier gives the linen as one
 * helical surface held on cane ribs, an iron rim and the mast; this builds the
 * cloth from that definition at the tier's density: the panel between two
 * ribs hangs a little under its own weight, the cloths are sewn edge to edge
 * in radial seams no wider apart than a bolt of linen, and the cloth is
 * doubled into a hem round the rim wire and a band at the mast. A doubled
 * layer is its own ribbon lying on the cloth, so it reads as more cloth in
 * reflection and as less light in transmission. Every number is the
 * dossier's; nothing here is documented detail.
 */
import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three/webgpu'
import type { TierName } from '../../../stack'

export interface HelicoidSpec {
  /** turns of the spiral, rim to top */
  turns: number
  /** mast-local height of the first and the last rib */
  y0: number
  y1: number
  /** the cloth's inner edge, laced to the mast */
  r_in: number
  /** the rim's radius at the first and at the last rib */
  r0: number
  r1: number
  /** azimuth of the first rib, from +X toward +Z */
  phase_rad: number
  /** +1 winds from +X toward +Z as it rises, -1 the other way */
  hand: number
  /** ribs along the spiral, the first and the last included */
  ribs: number
  /** depth the cloth hangs between two ribs, per metre of span */
  sag: number
  /** widest cloth at the rim before a seam */
  panel_m: number
  seam_m: number
  /** doubled cloth folded round the rim wire, and round the mast */
  hem_m: number
  crown_m: number
  /** how far a doubled layer stands off the cloth */
  layer_m: number
  /** radius of the rim wire: the hem ends against it */
  wire_r: number
}

const count = (tier: TierName, hero: number, standard: number, calm: number): number =>
  tier === 'hero' ? hero : tier === 'standard' ? standard : calm

/** The stitches at a doubled layer's edge darken the cloth by this much, and
 * the doubled cloth itself a little. */
const STITCH = .7
const BODY = .86
/** A doubled layer passes this share of the light a single one does. */
const DOUBLED = .38

export interface SailSurface {
  /** the point of the cloth at radial share s (mast 0, rim 1) and turn t */
  at(s: number, t: number): Vector3
  /** the rim's radius at turn t */
  rim(t: number): number
  /** the azimuth at turn t */
  azimuth(t: number): number
  /** the unsagged height at turn t */
  height(t: number): number
  /** the whole turn of the spiral, radians */
  span: number
  /** the turn of rib i */
  rib(i: number): number
}

export function sailSurface(h: HelicoidSpec): SailSurface {
  const span = h.turns * Math.PI * 2
  const gores = h.ribs - 1, gore = span / gores
  const rim = (t: number): number => h.r0 + (h.r1 - h.r0) * t / span
  const height = (t: number): number => h.y0 + (h.y1 - h.y0) * t / span
  const azimuth = (t: number): number => h.phase_rad + h.hand * t
  const at = (s: number, t: number): Vector3 => {
    const r = h.r_in + s * (rim(t) - h.r_in)
    const g = Math.min(gores - 1, Math.max(0, Math.floor(t / gore)))
    const u = t / gore - g
    // a panel held on four sides hangs deepest where its supports are farthest,
    // and falls away steeply from the cane it is stretched over
    const hang = h.sag * r * gore * Math.sin(Math.PI * u) ** .6 * Math.sin(Math.PI * s)
    const a = azimuth(t)
    return new Vector3(r * Math.cos(a), height(t) - hang, r * Math.sin(a))
  }
  return { at, rim, azimuth, height, span, rib: i => i * gore }
}

/** The cloth and its doubled layers as one surface: position, normal, uv in
 * metres (out from the mast, along the spiral), a stitch colour and the share
 * of light each layer lets through (`layers`). */
export function sailGeometry(h: HelicoidSpec, tier: TierName): BufferGeometry {
  const S = sailSurface(h)
  const gores = h.ribs - 1, gore = S.span / gores
  const ns = count(tier, 18, 11, 7)
  const perGore = count(tier, 20, 12, 8)
  const nt = gores * perGore
  const position: number[] = [], normal: number[] = [], uv: number[] = [], colour: number[] = [], layers: number[] = []
  const index: number[] = []
  const eps = 1e-4
  const frame = (s: number, t: number): { p: Vector3; n: Vector3 } => {
    const p = S.at(s, t)
    const ds = S.at(Math.min(1, s + eps), t).sub(S.at(Math.max(0, s - eps), t))
    const dt = S.at(s, Math.min(S.span, t + eps)).sub(S.at(s, Math.max(0, t - eps)))
    // the upper face's normal, whichever way the spiral winds
    const n = new Vector3().crossVectors(dt, ds).normalize()
    if (n.y < 0) n.negate()
    return { p, n }
  }
  // each cloth is cut from its own bolt: its weave starts somewhere else and
  // its unbleached tone is its own
  const hash = (a: number, b: number): number => {
    let x = Math.imul(a + 1, 73856093) ^ Math.imul(b + 1, 19349663)
    x = Math.imul(x ^ (x >>> 13), 1274126177)
    return ((x ^ (x >>> 16)) >>> 0) / 4294967296
  }
  const push = (p: Vector3, n: Vector3, s: number, t: number, tone: readonly number[], pass: number, shift = 0): number => {
    const r = h.r_in + s * (S.rim(t) - h.r_in)
    position.push(p.x, p.y, p.z)
    normal.push(n.x, n.y, n.z)
    // the warp runs out from the mast, along each cloth
    uv.push(r * t + shift, r + shift * .37)
    colour.push(tone[0]!, tone[1]!, tone[2]!)
    layers.push(pass)
    return position.length / 3 - 1
  }
  const grey = (v: number): number[] => [v, v, v]
  const grid = (rows: number, cols: number, vertex: (i: number, j: number) => number): void => {
    const ids: number[][] = []
    for (let i = 0; i <= rows; i++) {
      ids.push([])
      for (let j = 0; j <= cols; j++) ids[i]!.push(vertex(i, j))
    }
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
      const a = ids[i]![j]!, b = ids[i]![j + 1]!, c = ids[i + 1]![j]!, d = ids[i + 1]![j + 1]!
      index.push(a, b, c, b, d, c)
    }
  }

  /** how many cloths a gore is sewn from: none wider than a bolt at the rim */
  const panelsOf = (g: number): number => Math.max(1, Math.ceil(S.rim((g + .5) * gore) * gore / h.panel_m))

  // THE CLOTH, single, from the mast to the rim wire, one grid to each cloth
  // so a cloth's tone stops at its seam.
  for (let g = 0; g < gores; g++) {
    const panels = panelsOf(g)
    const cols = Math.max(2, Math.ceil(perGore / panels))
    for (let m = 0; m < panels; m++) {
      const value = .9 + hash(g, m) * .1, warmth = (hash(m, g + 7) - .5) * .05
      const tone = [value * (1 + warmth), value, value * (1 - warmth)]
      const shift = hash(g + 3, m + 11) * 7
      grid(cols, ns, (i, j) => {
        const t = (g + (m + i / cols) / panels) * gore, s = j / ns
        const { p, n } = frame(s, t)
        return push(p, n, s, t, tone, 1, shift)
      })
    }
  }
  const tAt = (g: number, m: number): number => (g + m / panelsOf(g)) * gore

  /** A doubled layer: a ribbon on both faces, `along` rows down its length
   * and columns at `acrossMarks`, shares of its width; a stitched column is
   * darkened by the row of stitches it carries and lies lower, where the
   * stitches pull the layers down, so the welt between catches the light. */
  const ribbon = (
    place: (a: number, b: number) => { s: number; t: number },
    along: number, acrossMarks: readonly number[], stitched: readonly boolean[],
  ): void => {
    const cols = acrossMarks.length - 1
    for (const side of [1, -1]) {
      const rows: { p: Vector3; s: number; t: number }[][] = []
      for (let i = 0; i <= along; i++) {
        rows.push([])
        for (let j = 0; j <= cols; j++) {
          const { s, t } = place(i / along, acrossMarks[j]!)
          const { p, n } = frame(s, t)
          p.addScaledVector(n, side * h.layer_m * (stitched[j] ? .6 : 1))
          rows[i]!.push({ p, s, t })
        }
      }
      grid(along, cols, (i, j) => {
        const here = rows[i]![j]!
        const down = rows[Math.min(along, i + 1)]![j]!.p.clone().sub(rows[Math.max(0, i - 1)]![j]!.p)
        const across = rows[i]![Math.min(cols, j + 1)]!.p.clone().sub(rows[i]![Math.max(0, j - 1)]!.p)
        const n = new Vector3().crossVectors(down, across).normalize()
        const cloth = frame(here.s, here.t).n
        if (n.dot(cloth) * side < 0) n.negate()
        return push(here.p, n, here.s, here.t, grey(stitched[j] ? STITCH : BODY), DOUBLED)
      })
    }
  }
  const sAt = (r: number, t: number): number => Math.min(1, Math.max(0, (r - h.r_in) / (S.rim(t) - h.r_in)))

  // THE HEM: the cloth folded round the wire, stitched along its inner edge.
  const hemMarks = [0, .005 / (h.hem_m - h.wire_r), 1]
  ribbon((a, b) => {
    const t = S.span * a
    const r = S.rim(t) - h.wire_r - (1 - b) * (h.hem_m - h.wire_r)
    return { s: sAt(r, t), t }
  }, nt, hemMarks, [true, false, false])

  // THE CROWN: a doubled band laced to the mast, stitched along its outer edge.
  ribbon((a, b) => {
    const t = S.span * a
    return { s: sAt(h.r_in + b * (h.crown_m - h.r_in), t), t }
  }, nt, [0, 1 - .005 / (h.crown_m - h.r_in), 1], [false, false, true])

  // THE SEAMS: radial, between the crown and the hem, between every two
  // cloths, over every cane and along both ends of the cloth.
  const seamRows = count(tier, 12, 8, 5)
  const seams: number[] = []
  for (let g = 0; g < gores; g++) for (let m = 0; m < panelsOf(g); m++) seams.push(tAt(g, m))
  seams.push(S.span)
  for (const t0 of seams) {
    {
      ribbon((a, b) => {
        const r0 = h.crown_m, r1 = S.rim(t0) - h.hem_m
        const r = r0 + a * (r1 - r0)
        const t = Math.min(S.span, Math.max(0, t0 + ((b - .5) * h.seam_m) / r))
        return { s: sAt(r, t), t }
      }, seamRows, [0, .005 / h.seam_m, 1 - .005 / h.seam_m, 1], [true, false, false, true])
    }
  }

  // Every face is wound to face the way its own vertices' normals point, so
  // the double-sided cloth is lit the same from above and from below.
  const a = new Vector3(), b = new Vector3(), c = new Vector3(), n = new Vector3()
  for (let k = 0; k < index.length; k += 3) {
    const [i, j, l] = [index[k]!, index[k + 1]!, index[k + 2]!]
    a.fromArray(position, i * 3); b.fromArray(position, j * 3); c.fromArray(position, l * 3)
    n.subVectors(b, a).cross(c.sub(a))
    const dot = n.x * normal[i * 3]! + n.y * normal[i * 3 + 1]! + n.z * normal[i * 3 + 2]!
    if (dot < 0) { index[k + 1] = l; index[k + 2] = j }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(position, 3))
  geometry.setAttribute('normal', new Float32BufferAttribute(normal, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  geometry.setAttribute('color', new Float32BufferAttribute(colour, 3))
  geometry.setAttribute('layers', new Float32BufferAttribute(layers, 1))
  geometry.setIndex(index)
  return geometry
}
