/** THE COLLECTION'S ROOFS AS BUILT, read from the terrace above them and from
 * the court below: each low slab finished as a flat roof is, a ballast of
 * river gravel inside a paved margin, its concrete edge formed and stained
 * where the rain runs off, capped by a folded zinc edge trim with a drip.
 * The slabs, their soffits and their steel are `../collection.ts`'s and are
 * never moved: every surface here stands clear in front of theirs, and none
 * of it is a rail solid (the walk never reaches a roof). Modern exhibition
 * design; nothing here claims a building of 1517.
 */
import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group, Mesh, MeshStandardNodeMaterial } from 'three/webgpu'
import * as TSL from 'three/tsl'
import { anisotropicFootprint } from '../masonry-courses'
import { lineCoverage, reliefNormal } from '../../../stack/detail'
import { OUTLINE } from './supper-room-plan'
import { hourKey } from '../site'

// The node overload boundary stays local to this file.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any
const {
  attribute, cameraViewMatrix, float, floor, fract, max, min, mix, mx_noise_float, normalWorld, normalWorldGeometry, positionWorld,
  smoothstep, vec3,
} = TSL as unknown as Record<string, N>

export const collectionRoofsProvenance = {
  manifestId: 'vinci/collection-roofs', assetClass: 'GENERATED', certainty: 'reconstructed',
} as const

/** One roof slab as `../collection.ts` lays it: its plan, its top at its
 * south and north edges (the roofs fall south), and the edges it leaves open
 * because another slab of the same plane carries on from them. */
export interface RoofSlab {
  west: number; south: number; east: number; north: number
  low: number; high: number
  open: readonly ('s' | 'n')[]
}
/** A plan rectangle something else already stands on. */
export interface PlanRect { west: number; south: number; east: number; north: number }

/** THE SECTION, in metres from the slab's edge (out) and its top (up): the
 * ballast over the membrane, the paved margin, the edge's concrete face a
 * hair before the steel, and the folded trim over it all. */
export const ROOF = {
  thickness: .20, ballast: .04, margin: .6, paver: .6,
  skin: .012, skinUnder: .005,
  trim: { inboard: .10, top: .065, lip: .035, lipFoot: -.025, kick: .05, kickFoot: -.04, length: 3, gap: .005 },
} as const

type P3 = [east: number, north: number, height: number]
const topOf = (r: RoofSlab, north: number): number => r.low + (r.high - r.low) * (north - r.south) / (r.north - r.south)
const inside = (r: PlanRect, e: number, n: number): boolean => e > r.west && e < r.east && n > r.south && n < r.north

/** A welded batch with metre UVs and two free attributes a material reads. */
class Batch {
  p: number[] = []; n: number[] = []; u: number[] = []; a: number[] = []; c: number[] = []
  quad(q: [P3, P3, P3, P3], facing: P3, uv: [number, number][], extra: [number, number, number, number][], colour: Color): void {
    const v = q.map(([e, n, h]) => [e, h, -n] as const)
    const e1 = [v[1]![0] - v[0]![0], v[1]![1] - v[0]![1], v[1]![2] - v[0]![2]]
    const e2 = [v[2]![0] - v[0]![0], v[2]![1] - v[0]![1], v[2]![2] - v[0]![2]]
    let nx = e1[1]! * e2[2]! - e1[2]! * e2[1]!, ny = e1[2]! * e2[0]! - e1[0]! * e2[2]!, nz = e1[0]! * e2[1]! - e1[1]! * e2[0]!
    const len = Math.hypot(nx, ny, nz) || 1
    nx /= len; ny /= len; nz /= len
    const want = [facing[0], facing[2], -facing[1]]
    const flip = nx * want[0]! + ny * want[1]! + nz * want[2]! < 0
    if (flip) { nx = -nx; ny = -ny; nz = -nz }
    for (const i of flip ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3]) {
      this.p.push(...v[i]!); this.n.push(nx, ny, nz); this.u.push(...uv[i]!); this.a.push(...extra[i]!)
      this.c.push(colour.r, colour.g, colour.b)
    }
  }
  geometry(): BufferGeometry {
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(this.p, 3))
    g.setAttribute('normal', new Float32BufferAttribute(this.n, 3))
    g.setAttribute('uv', new Float32BufferAttribute(this.u, 2))
    g.setAttribute('roofEdges', new Float32BufferAttribute(this.a, 4))
    g.setAttribute('color', new Float32BufferAttribute(this.c, 3))
    g.computeBoundingBox(); g.computeBoundingSphere()
    return g
  }
}

/** A rectangle less the rectangles cut out of it. */
function subtract(r: PlanRect, cuts: readonly PlanRect[]): PlanRect[] {
  let parts = [r]
  for (const k of cuts) {
    const next: PlanRect[] = []
    for (const p of parts) {
      if (k.east <= p.west || k.west >= p.east || k.north <= p.south || k.south >= p.north) { next.push(p); continue }
      if (k.south > p.south) next.push({ ...p, north: k.south })
      if (k.north < p.north) next.push({ ...p, south: k.north })
      const s = Math.max(p.south, k.south), n = Math.min(p.north, k.north)
      if (k.west > p.west) next.push({ west: p.west, east: k.west, south: s, north: n })
      if (k.east < p.east) next.push({ west: k.east, east: p.east, south: s, north: n })
    }
    parts = next.filter(p => p.east - p.west > .05 && p.north - p.south > .05)
  }
  return parts
}

type Side = 'n' | 's' | 'e' | 'w'
interface Stretch { roof: RoofSlab; side: Side; from: number; to: number }

/** Where an edge stands free: no slab at or over its own level carries on
 * past it, and nothing already stands on it. */
function freeStretches(roofs: readonly RoofSlab[], standing: readonly PlanRect[]): Stretch[] {
  const out: Stretch[] = []
  for (const r of roofs) {
    for (const side of ['n', 's', 'e', 'w'] as const) {
      if ((side === 'n' || side === 's') && r.open.includes(side)) continue
      const alongEast = side === 'n' || side === 's'
      const a = alongEast ? r.west : r.south, b = alongEast ? r.east : r.north
      const step = .05
      let start: number | null = null
      for (let t = a; t <= b + 1e-9; t += step) {
        const at = Math.min(t, b)
        const e = side === 'e' ? r.east + .05 : side === 'w' ? r.west - .05 : at
        const n = side === 'n' ? r.north + .05 : side === 's' ? r.south - .05 : at
        const edgeTop = topOf(r, side === 'n' ? r.north : side === 's' ? r.south : at)
        const covered = roofs.some(o => o !== r && inside(o, e, n) && topOf(o, n) >= edgeTop - .03)
          || standing.some(k => inside(k, e, n) || inside(k, side === 'e' ? r.east - .05 : side === 'w' ? r.west + .05 : e, side === 'n' ? r.north - .05 : side === 's' ? r.south + .05 : n))
        const last = at >= b - 1e-9
        if (!covered && start === null) start = at
        if ((covered || last) && start !== null) {
          const end = covered ? at - step : b
          if (end - start > .3) out.push({ roof: r, side, from: start, to: end })
          start = null
        }
      }
    }
  }
  return out
}

/** A ballast piece cut where a free stretch of its slab begins or ends, so
 * its distances to the free edges interpolate truly across it. */
function cells(r: RoofSlab, p: PlanRect, stretches: readonly Stretch[]): PlanRect[] {
  const mine = stretches.filter(s => s.roof === r)
  const cuts = (lo: number, hi: number, ts: number[]) => [lo, ...ts.filter(t => t > lo + .05 && t < hi - .05).sort((a, b) => a - b), hi]
  const xs = cuts(p.west, p.east, mine.filter(s => s.side === 'n' || s.side === 's').flatMap(s => [s.from, s.to]))
  const ys = cuts(p.south, p.north, mine.filter(s => s.side === 'e' || s.side === 'w').flatMap(s => [s.from, s.to]))
  const out: PlanRect[] = []
  for (let i = 0; i + 1 < xs.length; i++) for (let j = 0; j + 1 < ys.length; j++)
    out.push({ west: xs[i]!, east: xs[i + 1]!, south: ys[j]!, north: ys[j + 1]! })
  return out
}

const hash = (i: number, salt: number): number => { const s = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453; return s - Math.floor(s) }

/** What already stands on the roofs: the supper room's walls over the
 * picture room's overhang. Neither ballast nor trim goes under them. */
const STANDING: readonly PlanRect[] = [OUTLINE.nave, OUTLINE.bay].map(o => ({ west: o.west - .02, south: o.south - .02, east: o.east + .02, north: o.north }))

/** Build the finish of every slab: its ballast and margin, its edge's
 * concrete face and its zinc trim. */
export function createCollectionRoofs(roofs: readonly RoofSlab[], standing: readonly PlanRect[] = STANDING): Group {
  const T = ROOF.trim, ballast = new Batch(), skin = new Batch(), trim = new Batch()
  const stretches = freeStretches(roofs, standing)
  const free = (r: RoofSlab, side: Side, t: number): boolean =>
    stretches.some(s => s.roof === r && s.side === side && t >= s.from - .06 && t <= s.to + .06)
  const white = new Color(1, 1, 1)

  // THE BALLAST: each slab's own plane a hand over its top, less what a
  // higher slab or a wall already covers; each vertex knows how far it lies
  // from every free edge, so the margin is paved where the edge is free
  for (const r of roofs) {
    const higher = roofs.filter(o => {
      if (o === r || o.east <= r.west || o.west >= r.east || o.north <= r.south || o.south >= r.north) return false
      const mid = (Math.max(o.south, r.south) + Math.min(o.north, r.north)) / 2
      return topOf(o, mid) > topOf(r, mid) + .005
    })
    for (const whole of subtract(r, [...higher, ...standing])) for (const p of cells(r, whole, stretches)) {
      const corner = (e: number, n: number): P3 => [e, n, topOf(r, n) + ROOF.ballast]
      const edges = (e: number, n: number): [number, number, number, number] => [
        free(r, 'w', n) ? e - r.west : 99, free(r, 's', e) ? n - r.south : 99,
        free(r, 'e', n) ? r.east - e : 99, free(r, 'n', e) ? r.north - n : 99]
      const q: [P3, P3, P3, P3] = [corner(p.west, p.south), corner(p.east, p.south), corner(p.east, p.north), corner(p.west, p.north)]
      // the fall, 0 at the low edge and 1 at the high, rides in the colour
      const fall = (n: number) => (n - r.south) / (r.north - r.south)
      ballast.quad(q, [0, 0, 1], q.map(([e, n]) => [e, fall(n)]),
        [edges(p.west, p.south), edges(p.east, p.south), edges(p.east, p.north), edges(p.west, p.north)], white)
    }
  }
  // where the canopy's ballast meets the picture room's a hand lower, the
  // step between them is closed
  for (const r of roofs) for (const o of roofs) {
    if (o === r || Math.abs(o.west - r.east) > 2 || o.east <= r.east || o.south >= r.north || o.north <= r.south) continue
    const s = Math.max(r.south, o.south), n = Math.min(r.north, o.north)
    if (n - s < .3 || !(r.east > o.west)) continue
    const q: [P3, P3, P3, P3] = [
      [r.east, s, topOf(o, s) + ROOF.ballast], [r.east, n, topOf(o, n) + ROOF.ballast],
      [r.east, n, topOf(r, n) + ROOF.ballast], [r.east, s, topOf(r, s) + ROOF.ballast]]
    if (topOf(r, s) - topOf(o, s) < .004 || topOf(r, s) - topOf(o, s) > .1) continue
    ballast.quad(q, [1, 0, 0], q.map(([, n2, h]) => [n2, h]), q.map(() => [99, 99, 99, 99] as [number, number, number, number]), white)
  }

  // THE EDGE AND ITS TRIM, stretch by stretch
  for (const s of stretches) {
    const r = s.roof, alongEast = s.side === 'n' || s.side === 's'
    const out: [number, number] = s.side === 'n' ? [0, 1] : s.side === 's' ? [0, -1] : s.side === 'e' ? [1, 0] : [-1, 0]
    const line = s.side === 'n' ? r.north : s.side === 's' ? r.south : s.side === 'e' ? r.east : r.west
    const plan = (t: number, o: number): [number, number] => alongEast ? [t, line + out[1] * o] : [line + out[0] * o, t]
    const top = (t: number): number => topOf(r, alongEast ? line : t)
    const facing: P3 = [out[0], out[1], 0]
    // a free neighbour at a corner: the east-west run carries the trim over it
    const corner = (t: number): boolean => alongEast
      ? stretches.some(o => o.roof === r && (o.side === 'e' || o.side === 'w') && Math.abs((o.side === 'e' ? r.east : r.west) - t) < .06)
      : false
    const from = s.from - (alongEast && corner(s.from) ? T.kick : !alongEast && stretches.some(o => o.roof === r && (o.side === 'n' || o.side === 's') && Math.abs((o.side === 'n' ? r.north : r.south) - s.from) < .06) ? -T.inboard : 0)
    const to = s.to + (alongEast && corner(s.to) ? T.kick : !alongEast && stretches.some(o => o.roof === r && (o.side === 'n' || o.side === 's') && Math.abs((o.side === 'n' ? r.north : r.south) - s.to) < .06) ? -T.inboard : 0)
    const length = to - from, pieces = Math.max(1, Math.round(length / T.length))
    // the concrete face, one piece the length of the stretch, round the corner
    {
      const f0 = s.from - (alongEast && corner(s.from) ? ROOF.skin : 0), f1 = s.to + (alongEast && corner(s.to) ? ROOF.skin : 0)
      const [e0, n0] = plan(f0, ROOF.skin), [e1, n1] = plan(f1, ROOF.skin)
      const lo0 = top(f0) - ROOF.thickness - ROOF.skinUnder, lo1 = top(f1) - ROOF.thickness - ROOF.skinUnder
      const hi0 = top(f0) + .03, hi1 = top(f1) + .03
      const q: [P3, P3, P3, P3] = [[e0, n0, lo0], [e1, n1, lo1], [e1, n1, hi1], [e0, n0, hi0]]
      // uv: metres along the edge and metres under the top; the trim's first
      // joint and its length ride along for the runs beneath them
      const ext: [number, number, number, number] = [from, length / pieces, 0, 0]
      skin.quad(q, facing, [[f0, ROOF.thickness + ROOF.skinUnder], [f1, ROOF.thickness + ROOF.skinUnder], [f1, -.03], [f0, -.03]],
        [ext, ext, ext, ext], white)
    }
    // the trim, in lengths with a hair between them
    for (let i = 0; i < pieces; i++) {
      const a = from + length * i / pieces + (i ? T.gap / 2 : 0), b = from + length * (i + 1) / pieces - (i < pieces - 1 ? T.gap / 2 : 0)
      const tone = new Color().setScalar(.92 + hash(Math.round(a * 10) + line * 7, 3.1) * .14)
      const profile: [number, number][] = [[-T.inboard, ROOF.ballast], [-T.inboard, T.top], [T.lip, T.top], [T.lip, T.lipFoot], [T.kick, T.kickFoot]]
      const ext = [0, 0, 0, 0] as [number, number, number, number]
      for (let k = 0; k + 1 < profile.length; k++) {
        const [o0, h0] = profile[k]!, [o1, h1] = profile[k + 1]!
        const [ea0, na0] = plan(a, o0), [eb0, nb0] = plan(b, o0), [ea1, na1] = plan(a, o1), [eb1, nb1] = plan(b, o1)
        const q: [P3, P3, P3, P3] = [[ea0, na0, top(a) + h0], [eb0, nb0, top(b) + h0], [eb1, nb1, top(b) + h1], [ea1, na1, top(a) + h1]]
        // each facet looks along (-dh, do) in the section, outward positive
        const dO = o1 - o0, dH = h1 - h0, l = Math.hypot(dO, dH)
        const nO = -dH / l, nH = dO / l
        trim.quad(q, [out[0] * nO, out[1] * nO, nH], [[a, k], [b, k], [b, k + 1], [a, k + 1]], [ext, ext, ext, ext], tone)
      }
      // the ends of a length, seen at a corner and where a stretch stops
      for (const [t, sign] of [[a, -1], [b, 1]] as const) {
        const dir: P3 = alongEast ? [sign, 0, 0] : [0, sign, 0]
        const pts = profile.map(([o, h]) => { const [e, n] = plan(t, o); return [e, n, top(t) + h] as P3 })
        trim.quad([pts[0]!, pts[1]!, pts[2]!, pts[3]!], dir, [[0, 0], [0, 1], [1, 1], [1, 0]], [ext, ext, ext, ext], tone)
      }
    }
  }

  const group = new Group()
  group.name = 'vinci/collection-roofs'
  const parts = [
    { batch: ballast, material: ballastMaterial(), name: 'ballast' },
    { batch: skin, material: edgeMaterial(), name: 'edge' },
    { batch: trim, material: zincMaterial(), name: 'trim' },
  ]
  for (const part of parts) {
    if (!part.batch.p.length) continue
    const mesh = new Mesh(part.batch.geometry(), part.material)
    mesh.name = `vinci/collection-roofs/${part.name}`
    // the slabs under them already cast the roofs' shadow
    mesh.castShadow = false; mesh.receiveShadow = true
    mesh.userData = { ...collectionRoofsProvenance }
    group.add(mesh)
  }
  group.userData = { ...collectionRoofsProvenance, stretches: stretches.length }
  return group
}

/* ---- materials --------------------------------------------------------- */

/** Every finish lies a hand over a slab that casts: its shadow is read a
 * little off its own face, toward the sun, or the slab's own depth crawls
 * across it. */
const SUN_TOWARD = ((azimuth: number, elevation: number) => {
  const az = azimuth * Math.PI / 180, el = elevation * Math.PI / 180
  return [Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)] as const
})(hourKey.sun_azimuth_deg.value, hourKey.sun_elevation_deg.value)
const clearOfSlab = (m: MeshStandardNodeMaterial): void => {
  m.receivedShadowPositionNode = positionWorld.add(normalWorld.mul(.05)).add(vec3(SUN_TOWARD[0], SUN_TOWARD[1], SUN_TOWARD[2]).mul(.08))
}
const held = (metres: number | N, f: N): N => smoothstep(2, 4, (typeof metres === 'number' ? float(metres) : metres).div(f))
const rgb = (hex: string): N => { const c = new Color(hex); return vec3(c.r, c.g, c.b) }

/** River gravel on the membrane inside a margin of concrete pavers, the
 * gravel drifted by the wind and darker where the roof holds its wet, moss
 * in the lee of the trim, and the autumn's leaves blown against it. */
function ballastMaterial(): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial({ roughness: .92 })
  const P = positionWorld, pixel = anisotropicFootprint(P), wide = max(P.x.dFdx().abs().add(P.x.dFdy().abs()), P.z.dFdx().abs().add(P.z.dFdy().abs())).max(.00001)
  const E = attribute('roofEdges', 'vec4'), fall = attribute('uv', 'vec2').y
  const toEdge = min(min(E.x, E.y), min(E.z, E.w)).toVar()
  // which free edge is nearest decides the pavers' own grid
  const alongNS = min(E.y, E.w).lessThan(min(E.x, E.z))
  const along = alongNS.select(P.x, P.z.negate()), across = toEdge
  const paved = float(1).sub(smoothstep(ROOF.margin - .004, ROOF.margin + .004, across)).toVar()
  const fu = max(along.dFdx().abs().add(along.dFdy().abs()), .00001), fv = max(across.dFdx().abs().add(across.dFdy().abs()), .00001)
  const jointAlong = lineCoverage(fract(along.div(ROOF.paver).add(.5)).sub(.5).mul(ROOF.paver), .004, ROOF.paver, fu)
  const jointAcross = lineCoverage(across.sub(ROOF.margin), .005, 99, fv)
  const joint = max(jointAlong, jointAcross).mul(paved)
  const paverIndex = floor(along.div(ROOF.paver))
  const paverTone = fract(paverIndex.mul(12.9898).add(floor(across.div(ROOF.paver)).mul(78.233)).sin().mul(43758.5453)).sub(.5)
  // the gravel at three scales: the drift the wind leaves, the clumps a
  // footstep leaves, the stones themselves
  const drift = mx_noise_float(P.mul(vec3(.22, .5, .31))).mul(held(4.5, pixel))
  const clump = mx_noise_float(P.mul(4.1)).mul(held(.25, wide))
  const stones = mx_noise_float(P.mul(38)).mul(held(.026, wide))
  const pebble = smoothstep(.25, .75, mx_noise_float(P.mul(71).add(3.3))).mul(held(.014, wide))
  let gravel = rgb('#8d887c').mul(drift.mul(.13).add(1)).mul(clump.mul(.07).add(1)).mul(stones.mul(.12).add(1))
  gravel = mix(gravel, rgb('#a49f92'), pebble.mul(.35))
  // the roof holds its wet toward its low edge and in the lee of the trim
  const lowSide = float(1).sub(smoothstep(.0, .35, fall)).mul(mx_noise_float(P.mul(vec3(.6, 1, .9)).add(7.1)).mul(.5).add(.55)).mul(held(1.2, pixel))
  gravel = mix(gravel, gravel.mul(vec3(.72, .72, .70)), lowSide.clamp(0, 1).mul(.55))
  const lee = float(1).sub(smoothstep(.62, 1.4, across)).mul(float(1).sub(paved))
  const moss = smoothstep(.1, .55, mx_noise_float(P.mul(1.9).add(vec3(2.2, 5.1, 1.3)))).mul(lee.add(lowSide.mul(.4)).clamp(0, 1)).mul(held(.4, pixel))
  gravel = mix(gravel, rgb('#5f6a44'), moss.mul(.55))
  // the pavers: pale, one tone each, their faces soiled toward the gravel
  let pavers = rgb('#a9a597').mul(paverTone.mul(.10).add(1)).mul(mx_noise_float(P.mul(9)).mul(held(.11, wide)).mul(.05).add(1))
  pavers = mix(pavers, pavers.mul(.82), smoothstep(.35, .6, across).mul(.5))
  // the leaves the wind drops against the trim and in the corners
  const leafDrift = float(1).sub(smoothstep(.0, .9, across)).mul(smoothstep(.15, .6, mx_noise_float(P.mul(.8).add(9.3)).mul(.5).add(.5)))
  const leaf = smoothstep(.55, .8, mx_noise_float(P.mul(16).add(1.7))).mul(leafDrift).mul(held(.06, wide))
  const leafColour = mix(rgb('#8a4b22'), rgb('#b07a36'), mx_noise_float(P.mul(23)).mul(.5).add(.5))
  const ground = mix(gravel, pavers, paved)
  m.colorNode = mix(ground, leafColour, leaf.mul(.8)).mul(float(1).sub(joint.mul(.45)))
  m.roughnessNode = mix(float(.95), float(.86), paved).add(lowSide.mul(-.08)).clamp(.7, 1)
  const height = stones.mul(.004).add(pebble.mul(.003)).add(clump.mul(.006)).mul(float(1).sub(paved))
    .sub(joint.mul(.002)).add(leaf.mul(.002))
  m.normalNode = reliefNormal(normalWorldGeometry.transformDirection(cameraViewMatrix), height, .35)
  m.aoNode = float(1).sub(joint.mul(.5)).mul(float(1).sub(float(1).sub(smoothstep(0, .16, across)).mul(.35)))
  clearOfSlab(m)
  m.name = 'vinci/collection-roofs/ballast'
  m.userData = { ...collectionRoofsProvenance, recipe: 'River gravel ballast 16 to 32 mm over the membrane at three filtered scales (a 4.5 m wind drift, 0.25 m clumps, the stones), a 0.6 m margin of 0.6 m concrete pavers along every free edge, wet toward the low edge, moss and wind-blown leaves in the lee of the trim. Colour, filtered joints and bounded relief; no texture.' }
  return m
}

/** The slab's own edge: the collection's pale cast concrete in two edge
 * boards, a pour joint every few lengths, the runs where water gets past
 * the trim's joints, and a darker lip where the drip fails. */
function edgeMaterial(): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial({ roughness: .9 })
  const P = positionWorld, U = attribute('uv', 'vec2'), pixel = anisotropicFootprint(P)
  const along = U.x, under = U.y
  const fu = max(along.dFdx().abs().add(along.dFdy().abs()), .00001), fv = max(under.dFdx().abs().add(under.dFdy().abs()), .00001)
  const board = lineCoverage(under.sub(.1), .0015, 99, fv).mul(held(.1, fv))
  const pourAt = fract(along.div(ROOF.trim.length * 2.5).add(.3)).sub(.5).mul(ROOF.trim.length * 2.5)
  const pour = lineCoverage(pourAt, .003, ROOF.trim.length * 2.5, fu).mul(held(.2, fu))
  const pourTone = fract(floor(along.div(ROOF.trim.length * 2.5).add(.3)).mul(17.37).sin().mul(4375.1)).sub(.5)
  const aggregate = mx_noise_float(P.mul(10)).mul(held(.10, pixel))
  const drift = mx_noise_float(P.mul(.4)).mul(held(2.5, pixel))
  // water that gets past a trim joint runs down the face beneath it
  const J = attribute('roofEdges', 'vec4'), pitch = J.y.max(.5)
  const toJoint = fract(along.sub(J.x).div(pitch).add(.5)).sub(.5).abs().mul(pitch)
  const runWidth = mx_noise_float(vec3(along.mul(.7), 0, 3.3)).mul(.03).add(.06)
  const run = float(1).sub(smoothstep(runWidth.mul(.4), runWidth, toJoint)).mul(smoothstep(.02, .06, under))
    .mul(mx_noise_float(vec3(along.mul(31), under.mul(2), 1.9)).mul(held(.03, fu)).mul(.3).add(.7))
  const streaks = smoothstep(.55, .75, mx_noise_float(vec3(along.mul(4.3), under.mul(.35), 6.1)).mul(.5).add(.5)).mul(held(.25, fu))
  const lipDirt = float(1).sub(smoothstep(.0, .035, under.sub(ROOF.thickness - .03).abs()))
  const underTrim = float(1).sub(smoothstep(.0, .05, under))
  let c = rgb('#a7a295').mul(drift.mul(.10).add(1)).mul(aggregate.mul(.07).add(1)).mul(pourTone.mul(.08).add(1))
  c = c.mul(float(1).sub(board.mul(.10)).sub(pour.mul(.18)))
  c = mix(c, c.mul(vec3(.62, .62, .60)), run.mul(.6).add(streaks.mul(.18)).clamp(0, 1))
  c = mix(c, c.mul(vec3(.7, .7, .68)), lipDirt.mul(.35).add(underTrim.mul(.3)))
  m.colorNode = c
  m.roughnessNode = float(.9).add(aggregate.mul(.03)).sub(run.mul(.08))
  m.normalNode = reliefNormal(normalWorldGeometry.transformDirection(cameraViewMatrix),
    aggregate.mul(.0006).sub(board.mul(.0008)).sub(pour.mul(.0015)), .2)
  m.aoNode = float(1).sub(underTrim.mul(.35))
  clearOfSlab(m)
  m.name = 'vinci/collection-roofs/edge'
  m.userData = { ...collectionRoofsProvenance, recipe: 'The slab edge in the collection\'s pale cast concrete: two 0.1 m edge boards, a pour joint every 7.5 m, filtered aggregate and drift, runs under each trim joint and a dirt line at the soffit arris.' }
  return m
}

/** Pre-weathered zinc: a blue grey that holds the sky dully, each length a
 * shade of its own. */
function zincMaterial(): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial({ vertexColors: true, roughness: .55, metalness: .5, side: DoubleSide })
  const P = positionWorld, pixel = anisotropicFootprint(P)
  const bloom = mx_noise_float(P.mul(vec3(3.1, 12, 3.1))).mul(held(.08, pixel))
  m.colorNode = attribute('color', 'vec3').mul(rgb('#8a9091')).mul(bloom.mul(.06).add(1))
  m.roughnessNode = float(.55).add(bloom.mul(.08))
  clearOfSlab(m)
  m.name = 'vinci/collection-roofs/zinc'
  m.userData = { ...collectionRoofsProvenance, recipe: 'Pre-weathered zinc edge trim in 3 m lengths: a 65 mm upstand over the ballast, a 60 mm lip over the slab edge and a 15 mm drip kick; each length its own shade, a faint filtered bloom.' }
  return m
}
