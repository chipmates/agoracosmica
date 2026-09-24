/* A FALLEN LEAF NEAR THE EYE, AS A BLADE.

   Seen from a stride away a lying leaf is not a card: a drying blade rolls
   at its margins, one side more than the other and some far enough to turn
   over and show the paler underside, its tip curls up, its stalk end lifts,
   and it rests on the lowest line of that shape. The stone under it sees
   less of the sky only along its own outline as it lies, narrower where the
   margins rolled in, and the low sun throws what the margins lift down-sun.
   Geometry and a contact card; no new maps. A type of leaf, not a record. */
import { cellUV, CONTACT_PAD, LEAF_RECIPES, leafCell } from './leaf-maps'
import { hourKey } from './site'
import type { Body, Species } from './tree-growth'

type V3 = [number, number, number]

export interface Blade {
  species: Species
  /** where its middle lies (east, north) and the floor's height there */
  east: number; north: number; floor: number
  /** the height it lies at when that is over its floor (on a sward) */
  y?: number
  angle: number
  /** its length, and its species' own: the blade is held near its own size */
  length: number; own: number
  colour: V3
  /** how far it is folded along its midrib, and rolled about it */
  fold: number; tilt: number
  ao: number
}

const SUN_EL = hourKey.sun_elevation_deg.value * Math.PI / 180
const SUN_AZ = hourKey.sun_azimuth_deg.value * Math.PI / 180
/** away from the sun on the ground, in (east, north) */
const DOWNSUN: [number, number] = [-Math.sin(SUN_AZ), -Math.cos(SUN_AZ)]

const clamp01 = (v: number): number => v < 0 ? 0 : v > 1 ? 1 : v
const byte = (v: number): number => Math.round(clamp01(v) * 255)
function norm(v: V3): V3 { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l] }
function cross(a: V3, b: V3): V3 { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]] }
/** draws that belong to the place a leaf lies, whatever order it is laid in */
function drawsAt(e: number, n: number): () => number {
  let h = (Math.imul(Math.round(e * 1000) | 0, 73856093) ^ Math.imul(Math.round(n * 1000) | 0, 19349663) ^ 0x5eaf) >>> 0
  return () => {
    h = (h + 0x6d2b79f5) >>> 0
    let t = h
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Lay one blade into `leaves`; its sun-map triangle into `shadow`, and the
    darkening of the stone under it into `contact` at `strength`, when given. */
export function layBlade(leaves: Body, blade: Blade, shadow: Body | null = null, contact: Body | null = null, strength = 1): void {
  const recipe = LEAF_RECIPES[blade.species]
  const hw = Math.min(.5, .5 * recipe.width * 1.08 + .02)
  const cell = leafCell(blade.species)
  const { u0, v0, du, dv } = cellUV(cell)
  const random = drawsAt(blade.east, blade.north)
  const L = Math.min(blade.length, blade.own * (1.02 + random() * .3))
  // each margin rolls up over an arc from a line part-way out, some far
  // enough to turn over and show the underside; the tip curls the same way
  const margin = (): { from: number; radius: number } => {
    const from = hw * (.25 + random() * .3), turn = 1 + random() * 2.2
    return { from, radius: (hw - from) / turn }
  }
  const left = margin(), right = margin()
  const tipFrom = .5 + random() * .25, tipTurn = .1 + random() * random() * 1.5
  const tipRadius = (1 - tipFrom) / tipTurn
  const stalkLift = .015 + random() * .04
  const twist = (random() - .5) * .22, wave = random() * .02, phase = random() * 6.28
  const fold = blade.fold * .4
  const dir: V3 = [Math.cos(blade.angle), 0, -Math.sin(blade.angle)]
  const side0 = norm(cross([0, 1, 0], dir))
  const up = norm([side0[0] * blade.tilt * .5, 1, side0[2] * blade.tilt * .5])
  const across = norm(cross(up, dir))
  // the blade's point (u along, v across, in shares of its length) as it
  // lies: along, across and up, before it is set down on its floor
  const shape = (u: number, v: number): V3 => {
    const m = v < 0 ? left : right, a = Math.abs(v), sign = v < 0 ? -1 : 1
    let w = a, lift = fold * Math.min(a, m.from)
    if (a > m.from) {
      const th = (a - m.from) / m.radius
      w = m.from + m.radius * Math.sin(th)
      lift += m.radius * (1 - Math.cos(th)) + fold * m.radius * Math.sin(th) * .5
    }
    let along = u
    if (u > tipFrom) {
      const th = (u - tipFrom) / tipRadius
      along = tipFrom + tipRadius * Math.sin(th)
      lift += tipRadius * (1 - Math.cos(th))
    }
    lift += stalkLift * Math.pow(Math.max(0, .14 - u) / .14, 2) + twist * (u - .5) * v + wave * Math.sin(u * 9.4 + phase) * a / hw
    return [along, sign * w, lift]
  }
  const NU = 6, NV = 7
  // columns closer together toward the margins, where the roll bends
  const grid = (j: number): number => { const t = j / (NV - 1) * 2 - 1; return Math.sign(t) * Math.pow(Math.abs(t), .75) * hw }
  let low = Infinity, reachA = 0, reachB = 0, reachU = 0
  for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) {
    const q = shape(i / (NU - 1), grid(j))
    low = Math.min(low, q[2]); reachU = Math.max(reachU, q[0])
    if (q[1] < 0) reachA = Math.max(reachA, -q[1]); else reachB = Math.max(reachB, q[1])
  }
  const at: V3 = [blade.east - dir[0] * L * .5, Math.max(blade.floor + .0022, (blade.y ?? 0) - .001), -blade.north - dir[2] * L * .5]
  const point = (u: number, v: number): V3 => {
    const [al, w, lift] = shape(u, v), h = lift - low
    return [at[0] + (dir[0] * al + across[0] * w + up[0] * h) * L,
      at[1] + (dir[1] * al + across[1] * w + up[1] * h) * L,
      at[2] + (dir[2] * al + across[2] * w + up[2] * h) * L]
  }
  const first = leaves.vertices
  const e = .01
  let liftSum = 0
  for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) {
    const u = i / (NU - 1), v = grid(j)
    const p = point(u, v)
    const pu = point(Math.min(1, u + e), v), pd = point(Math.max(0, u - e), v)
    const pr = point(u, Math.min(hw, v + e)), pl = point(u, Math.max(-hw, v - e))
    let n = norm(cross([pr[0] - pl[0], pr[1] - pl[1], pr[2] - pl[2]], [pu[0] - pd[0], pu[1] - pd[1], pu[2] - pd[2]]))
    if (n[0] * up[0] + n[1] * up[1] + n[2] * up[2] < 0) n = [-n[0], -n[1], -n[2]]
    leaves.position.push3(p[0], p[1], p[2])
    leaves.normal.push3(n[0], n[1], n[2])
    leaves.colour.push4(byte(blade.colour[0]), byte(blade.colour[1]), byte(blade.colour[2]), 255)
    leaves.uv.push2(u0 + (.5 + v) * du, v0 + u * dv)
    const h = (shape(u, v)[2] - low) * L
    liftSum += h
    // what lies on its floor sees least of the sky; a raised margin sees more
    leaves.ao.push1(blade.ao * (.8 + .2 * clamp01(h * 90)))
    leaves.wind.push4(0, 0, 0, 0)
  }
  for (let i = 0; i < NU - 1; i++) for (let j = 0; j < NV - 1; j++) {
    const a = first + i * NV + j, b = a + 1, c = a + NV, d = c + 1
    leaves.index.push3(a, c, b); leaves.index.push3(b, c, d)
  }
  // one opaque triangle inside the outline for the sun's map, as a card has
  if (shadow) {
    const s0 = shadow.vertices, w = recipe.width * .45
    for (const [u, v] of [[.12, 0], [.9, w * .5], [.9, -w * .5]] as const) {
      const p = point(u, v)
      shadow.position.push3(p[0], p[1], p[2])
      shadow.normal.push3(up[0], up[1], up[2])
      shadow.wind.push4(0, 0, 0, 0)
    }
    shadow.index.push3(s0, s0 + 2, s0 + 1)
  }
  if (!contact) return
  // THE STONE UNDER IT: the outline as it lies (the rolled margins draw it
  // narrower and off its axis), softer the more the blade stands off, and
  // shifted down-sun by the height its margins stand at
  const c0 = contact.vertices, pad = CONTACT_PAD
  const meanLift = liftSum / (NU * NV)
  const narrow = (reachA + reachB) / (2 * hw), offAxis = (reachB - reachA) / 2
  const flat: V3 = norm([dir[0], 0, dir[2]]), side: V3 = [flat[2], 0, -flat[0]]
  const shift = Math.min(.03, meanLift * .6 / Math.tan(Math.max(.2, SUN_EL)))
  const o: V3 = [blade.east - flat[0] * L * .5 + DOWNSUN[0] * shift + side[0] * offAxis * L, blade.floor + .0008,
    -blade.north - flat[2] * L * .5 - DOWNSUN[1] * shift + side[2] * offAxis * L]
  const alpha = clamp01(.72 - meanLift * 14) * strength
  const { u0: cu0, v0: cv0, du: cdu, dv: cdv } = cellUV(cell)
  for (const [u, v] of [[-pad, -.5 - pad], [1 + pad, -.5 - pad], [1 + pad, .5 + pad], [-pad, .5 + pad]] as const) {
    contact.position.push3(o[0] + (flat[0] * u * reachU + side[0] * v * narrow) * L, o[1], o[2] + (flat[2] * u * reachU + side[2] * v * narrow) * L)
    contact.normal.push3(0, 1, 0)
    // the contact atlas's cells hold the leaf padded on every side
    contact.uv.push2(cu0 + ((v + .5 + pad) / (1 + 2 * pad)) * cdu, cv0 + ((u + pad) / (1 + 2 * pad)) * cdv)
    contact.colour.push4(0, 0, 0, byte(alpha))
    contact.wind.push4(0, 0, 0, 0)
  }
  contact.index.push3(c0, c0 + 2, c0 + 1); contact.index.push3(c0, c0 + 3, c0 + 2)
}
