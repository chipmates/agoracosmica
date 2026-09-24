/* THE STONE EDGES OF THE PLATFORMS.

   A platform held up by a wall is finished at its edge by a coping: a row
   of dressed stones laid on the wall's head, a little proud of the floor
   behind them, overhanging the face so the rain drips clear of it, their
   outer arris taken off by the mason and worn round since. Where the house's
   court meets the flagged walk before the house, a kerb of long stones set
   on the joint divides the cobbles from the flags. The stones are types of
   the period, laid by this exhibition along the dossier's own edges; no
   coping or kerb of 1517 survives. */
import { BufferGeometry, Color, Float32BufferAttribute, Group, Mesh, MeshStandardNodeMaterial } from 'three/webgpu'
import { cameraViewMatrix, float, max, mix, mx_noise_float, normalWorld, normalWorldGeometry, positionWorld, smoothstep, vec3 } from 'three/tsl'
import { reliefNormal } from '../../stack/detail'
import type { TierName } from '../../stack/tier'
import { anisotropicFootprint } from './masonry-courses'
import { gradeAt, terrainSteps } from './terrain-mesh'
import { hourKey, polygon } from './site'
import { stageWeight } from './leaf-litter'
import { mulberry } from './tree-growth'

export const copingsProvenance = {
  manifestId: 'vinci/ground-dressing',
  recipe: 'Coping stones 0.55 to 0.95 m long and 0.34 m wide on the heads of the retaining walls of the court, the terrace and the garden square that a stop sees, 14 mm proud of the floor, overhanging the face by 40 mm, their outer arris chamfered 30 mm and worn; a kerb of stones 0.5 to 0.9 m long and 0.24 m wide set 10 mm proud along the court\'s edge before the house, both arrises chamfered. Pale limestone of the Loire, each stone its own tone, lichen on the heads. Types of the period; no surviving coping or kerb is claimed.',
} as const

export const copingJointsProvenance = {
  manifestId: 'vinci/coping-joints',
  recipe: 'The 8 mm joints between the coping and kerb stones pointed in lime mortar, 4 mm back from every face of the stones either side, a shade paler and greyer than the stones. Inside the stones\' envelope; the stones alone are the rail\'s solid.',
} as const

type P2 = [number, number]
type V3 = [number, number, number]
interface Batch { position: number[]; normal: number[]; colour: number[] }


const STONE = ['#b3a88f', '#a89d86', '#bcb199', '#9f957f', '#aea38b'].map(hex => new Color(hex))
/** toward the sun of the hour */
const SUN_TOWARD = ((azimuth: number, elevation: number) => {
  const az = azimuth * Math.PI / 180, el = elevation * Math.PI / 180
  return [Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)] as const
})(hourKey.sun_azimuth_deg.value, hourKey.sun_elevation_deg.value)
const MEAN = STONE.reduce((sum, c) => sum.add(c), new Color(0, 0, 0)).multiplyScalar(1 / STONE.length)
/** lime mortar, a shade paler and greyer than the stones it beds */
const MORTAR = new Color('#b9b3a2')

/** A run of one wall's head: its ends, the side the drop is on, its level. */
export interface Run { from: P2; to: P2; out: P2; level: number }

/** the coping stone's section: back into the platform, out over the face,
    proud of the floor, and its depth */
export const COPING = { inner: .3, outer: .04, proud: .014, depth: .16 } as const

let cachedRuns: Run[] | undefined
/** The wall heads a stop sees, which carry a coping. */
export function copingRuns(): readonly Run[] { return cachedRuns ??= runs() }

function runs(): Run[] {
  const found: Run[] = []
  for (const s of terrainSteps()) {
    if (s.modern || !s.retaining || s.height < .4) continue
    if (!/^(courtyard|terrace|period-garden)$/.test(s.region)) continue
    const m: P2 = [(s.from[0] + s.to[0]) / 2, (s.from[1] + s.to[1]) / 2]
    if (stageWeight(m[0], m[1]) < .12) continue
    const last = found[found.length - 1]
    if (last && Math.hypot(last.to[0] - s.from[0], last.to[1] - s.from[1]) < .03 && last.out[0] * s.low[0] + last.out[1] * s.low[1] > .999
      && Math.abs(last.level - s.highLevel) < .02) last.to = [s.to[0], s.to[1]]
    else found.push({ from: [s.from[0], s.from[1]], to: [s.to[0], s.to[1]], out: [s.low[0], s.low[1]], level: s.highLevel })
  }
  return found.filter(r => Math.hypot(r.to[0] - r.from[0], r.to[1] - r.from[1]) > .6)
}

/** One dressed stone between `a` and `b` along an edge: `inner` metres back
    into the platform, `outer` metres out over the drop, its top `proud`
    above the floor, its arrises chamfered by `chamfer` (the front one, or
    both when `both`). */
function stone(batch: Batch, a: P2, b: P2, out: P2, level: number, inner: number, outer: number, proud: number,
  depth: number, chamfer: number, both: boolean, colour: Color): void {
  const at = (p: P2, o: number, h: number): V3 => [p[0] + out[0] * o, level + h, -(p[1] + out[1] * o)]
  const top = proud, bottom = proud - depth
  // the profile across the stone, walked from the back's foot over the top
  // to the front's foot
  const profile: [number, number][] = both
    ? [[-inner, bottom], [-inner, top - chamfer], [-inner + chamfer, top], [outer - chamfer, top], [outer, top - chamfer], [outer, bottom]]
    : [[-inner, bottom], [-inner, top], [outer - chamfer, top], [outer, top - chamfer], [outer, bottom]]
  /** a triangle wound so its face looks along `n` */
  const tri = (p0: V3, p1: V3, p2: V3, n: V3, k: number): void => {
    const e1 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]], e2 = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]]
    const cx = e1[1]! * e2[2]! - e1[2]! * e2[1]!, cy = e1[2]! * e2[0]! - e1[0]! * e2[2]!, cz = e1[0]! * e2[1]! - e1[1]! * e2[0]!
    const order = cx * n[0] + cy * n[1] + cz * n[2] >= 0 ? [p0, p1, p2] : [p0, p2, p1]
    for (const q of order) { batch.position.push(q[0], q[1], q[2]); batch.normal.push(n[0], n[1], n[2]); batch.colour.push(colour.r * k, colour.g * k, colour.b * k) }
  }
  const quad = (p0: V3, p1: V3, p2: V3, p3: V3, n: V3, k: number): void => { tri(p0, p1, p2, n, k); tri(p0, p2, p3, n, k) }
  // the long facets: walked clockwise in (out, up), each looks along (-dH, dO)
  for (let i = 0; i < profile.length - 1; i++) {
    const [o0, h0] = profile[i]!, [o1, h1] = profile[i + 1]!
    const l = Math.hypot(o1 - o0, h1 - h0) || 1
    const nO = -(h1 - h0) / l, nH = (o1 - o0) / l
    const n: V3 = [out[0] * nO, nH, -out[1] * nO]
    quad(at(a, o0, h0), at(b, o0, h0), at(b, o1, h1), at(a, o1, h1), n, nH > .9 ? 1 : nH > .3 ? .96 : .9)
  }
  // the ends, seen in the open joints
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / len, un = (b[1] - a[1]) / len
  for (const [p, sign] of [[a, -1], [b, 1]] as const) {
    const n: V3 = [ux * sign, 0, -un * sign]
    for (let i = 1; i < profile.length - 1; i++)
      tri(at(p, profile[0]![0], profile[0]![1]), at(p, profile[i]![0], profile[i]![1]), at(p, profile[i + 1]![0], profile[i + 1]![1]), n, .88)
  }
  // the underside of the overhang, seen from below the wall
  if (outer > .01) quad(at(a, outer, bottom), at(b, outer, bottom), at(b, 0, bottom), at(a, 0, bottom), [0, -1, 0], .7)
}

/** Lay stones along an edge from `from` to `to`, lengths drawn between
    `short` and `long`, on 8 mm joints pointed in lime mortar. */
function lay(batch: Batch, joints: Batch, from: P2, to: P2, out: P2, level: number, inner: number, outer: number, proud: number, depth: number,
  chamfer: number, both: boolean, short: number, long: number, random: () => number): number {
  const dx = to[0] - from[0], dn = to[1] - from[1], span = Math.hypot(dx, dn)
  const at = (d: number): P2 => [from[0] + dx * d / span, from[1] + dn * d / span]
  let s = 0, laid = 0, last = -1
  while (s < span - .05) {
    const length = Math.min(span - s, short + random() * (long - short))
    const e0 = s + .004, e1 = s + length - .004
    if (e1 - e0 > .05) {
      // stones of one quarry: their tones close, never a checker
      const c = STONE[Math.floor(random() * STONE.length)]!.clone().lerp(MEAN, .55).multiplyScalar(.95 + random() * .07)
      // each stone set a hair off its neighbours
      stone(batch, at(e0), at(e1), out, level + (random() - .5) * .006, inner, outer, proud, depth, chamfer, both, c)
      // THE JOINT IS POINTED, not open: the mortar stands 4 mm back from
      // every face of the stones either side, its ends inside them
      if (last >= 0 && e0 - last < .01)
        stone(joints, at(last - .0005), at(e0 + .0005), out, level - .003, inner - .004, outer - .004, proud - .004, depth - .01, chamfer, both, MORTAR)
      last = e1
      laid++
    }
    s += length
  }
  return laid
}

export function createCopings(tier: TierName): Group {
  const group = new Group()
  group.name = 'vinci generated copings and kerbs'
  const batch: Batch = { position: [], normal: [], colour: [] }
  // the pointing is a body of its own: it lies inside the stones' envelope,
  // so the stones alone stay the rail's solid
  const joints: Batch = { position: [], normal: [], colour: [] }
  const random = mulberry(15171071)
  let stones = 0
  for (const r of copingRuns()) stones += lay(batch, joints, r.from, r.to, r.out, r.level, COPING.inner, COPING.outer, COPING.proud, COPING.depth, .03, false, .55, .95, random)
  // the kerb between the court's cobbles and the flagged walk before the
  // house, along the court's own north-west edge
  const court = polygon('courtyard')
  const a: P2 = [court[3]![0]!, court[3]![1]!], b: P2 = [court[2]![0]!, court[2]![1]!]
  const dx = b[0] - a[0], dn = b[1] - a[1], span = Math.hypot(dx, dn)
  const toApron: P2 = [-dn / span, dx / span]
  // the kerb's middle on the edge itself, and only where the walk before
  // the house lies level with the court beside it
  const shift = (p: P2): P2 => [p[0] - toApron[0] * .12, p[1] - toApron[1] * .12]
  const level = (p: P2): boolean => [.3, -.3].every(o => Math.abs(gradeAt(p[0] + toApron[0] * o, p[1] + toApron[1] * o)) < .03)
  let open: number | null = null
  const step = .2, steps = Math.ceil(span / step)
  for (let i = 0; i <= steps; i++) {
    const t = Math.min(1, i / steps), p: P2 = [a[0] + dx * t, a[1] + dn * t], ok = i < steps && level(p)
    if (ok && open === null) open = t
    if (!ok && open !== null) {
      const from: P2 = [a[0] + dx * open, a[1] + dn * open], to: P2 = [a[0] + dx * t, a[1] + dn * t]
      if ((t - open) * span > .6) stones += lay(batch, joints, shift(from), shift(to), toApron, 0, 0, .24, .01, .14, .025, true, .5, .9, random)
      open = null
    }
  }
  if (!batch.position.length) return group
  const made = (b: Batch): BufferGeometry => {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(b.position, 3))
    geometry.setAttribute('normal', new Float32BufferAttribute(b.normal, 3))
    geometry.setAttribute('color', new Float32BufferAttribute(b.colour, 3))
    geometry.computeBoundingSphere()
    return geometry
  }
  const material = stoneMaterial()
  const mesh = new Mesh(made(batch), material)
  mesh.name = 'vinci generated copings and kerbs'
  mesh.castShadow = tier !== 'calm'
  mesh.receiveShadow = true
  mesh.userData = { manifestId: copingsProvenance.manifestId, recipe: copingsProvenance.recipe }
  group.add(mesh)
  if (joints.position.length) {
    const pointing = new Mesh(made(joints), material)
    pointing.name = 'vinci generated coping joints'
    pointing.receiveShadow = true
    pointing.userData = { manifestId: copingJointsProvenance.manifestId, recipe: copingJointsProvenance.recipe }
    group.add(pointing)
  }
  group.userData['stones'] = stones
  return group
}

/** Dressed limestone weathered on its head: a fine tooled grain, a broader
    wash, and the lichens a coping forty years in the weather carries: pale
    grey-green crusts across the head, small orange rosettes where birds sit,
    black specks along the drip. Each scale drawn only where a pixel holds it. */
function stoneMaterial(): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial({ vertexColors: true, roughness: .9 })
  const P = positionWorld, pixel = anisotropicFootprint(P)
  const shows = (metres: number) => smoothstep(1.2, 3, float(metres).div(pixel))
  const wash = mx_noise_float(P.mul(1.7)).mul(shows(.6))
  const grain = mx_noise_float(P.mul(90)).mul(shows(.011))
  const tooth = mx_noise_float(vec3(P.x.mul(160), P.y.mul(40), P.z.mul(160))).mul(shows(.006))
  // the head and the chamfer face the sky and hold the lichen; the front
  // face under the drip keeps only the dark specks
  const up = smoothstep(.35, .9, normalWorld.y)
  const crust = smoothstep(.42, .62, mx_noise_float(P.mul(4.2).add(vec3(3.1, 1.7, 5.3)))
    .add(mx_noise_float(P.mul(17).add(vec3(.4, 2.2, 7.1))).mul(.35))).mul(up).mul(shows(.08))
  const rosette = smoothstep(.68, .8, mx_noise_float(P.mul(11).add(vec3(9.4, 3.3, .8)))).mul(up).mul(shows(.03))
  const specks = smoothstep(.72, .86, mx_noise_float(P.mul(38).add(vec3(1.9, 6.1, 4.4))))
    .mul(max(float(1).sub(up), float(.35))).mul(shows(.012))
  const base = vec3(1, 1, 1).mul(wash.mul(.08).add(1)).mul(grain.mul(.07).add(1))
  let colour = mix(base, vec3(.72, .76, .62), crust.mul(.55))
  colour = mix(colour, vec3(1.02, .62, .22), rosette.mul(.55))
  colour = mix(colour, vec3(.16, .16, .15), specks.mul(.6))
  m.colorNode = colour
  // the tooling's relief from its own height, the stone having no map coordinates
  m.normalNode = reliefNormal(normalWorldGeometry.transformDirection(cameraViewMatrix), grain.mul(.0004).add(tooth.mul(.00025)).sub(crust.mul(.0003)), .15)
  m.roughnessNode = float(.9).add(grain.mul(.03)).add(crust.mul(.05))
  // a head lit at a grazing sun reads the shadow body it is folded into a
  // hair off its own face: the lookup stands a little out along the normal
  m.receivedShadowPositionNode = P.add(normalWorld.mul(.02)).add(vec3(SUN_TOWARD[0], SUN_TOWARD[1], SUN_TOWARD[2]).mul(.05))
  m.name = 'vinci generated coping stone'
  return m
}
