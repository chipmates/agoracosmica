/** THE MECHANISM HALL'S FLOOR AS MAPS: a sealed concrete slab poured in bays,
 * power-trowelled, sealed and walked on for a season, baked in code into maps
 * over the hall's own floor so the engine and an exported render read the
 * same surface. Three scales: the pour's clouding and each bay's tone, the
 * trowel's swirls and the cut aggregate, the fine grain (the CC0 photograph
 * the fabric lays under it). Over them what the room has done to it: wear
 * where visitors walk and stand round the plinths, dust in the saw cuts and at
 * every foot the mop cannot reach, and for the engine alone the contact
 * shading a path tracer finds by itself. No texture asset, no reference image
 * sampled; the numbers are a finish specification, not a survey.
 */
import { dossiers } from '../machines/catalog'
import { COLLECTION_PAVING_ORIGIN, DARK_BAY, FACE, FLOOR, OPENING, ROOMS } from './layout'
import { STANDS, standBoxes } from './stands'

export const HALL_FLOOR_PROVENANCE = {
  manifestId: 'vinci/collection-hall-floor', assetClass: 'GENERATED', certainty: 'reconstructed',
} as const

/** The maps' extent: the hall's floor, east and north in the wing's metres. */
export const HALL_FLOOR_MAP = {
  west: ROOMS.hall.west, east: ROOMS.hall.east, south: ROOMS.hall.south, north: ROOMS.hall.north,
} as const
/** The bays the slab was poured in, two museum stones each way, and their
 * saw cuts: 5 mm wide, as a diamond blade leaves them. */
export const HALL_FLOOR_BAY = {
  east: 3.2, north: 3.3, originEast: COLLECTION_PAVING_ORIGIN.east, originNorth: COLLECTION_PAVING_ORIGIN.north,
  cutHalf: .0025, chipHalf: .006,
} as const
/** The tile laid over the whole floor, in metres a side. */
export const HALL_FLOOR_TILE = 1.2

/** The window the hall's daylight comes through, and the shelf in front of
 * it, in the wing's metres (hall-light.ts CLERESTORY; hall-fabric.ts shelf). */
const WINDOW = { east: -50.5, north: -42.59, height: -.21, width: 22.8, tall: 2.48 }
const SHELF = { north: FACE.pictureWallSouth, south: FACE.pictureWallSouth - 1.24, soffit: -1.665, lip: -1.285, lipNorth: FACE.pictureWallSouth - 1.295 }

/** What stands on the floor, as the maps see it: a box from the floor up, or
 * a round platform. `gap` is a plinth's shadow gap: its top slab overhangs a
 * shaft by that much. */
interface Footing {
  west: number; east: number; south: number; north: number; high: number
  /** how far the slab overhangs its shaft; 0 for a solid block */
  gap: number
  /** how much of this body's height shades the floor round it: a lit wall
   * gives back most of what it takes, a dark plinth does not */
  shade: number
  /** dust at its foot, 0..1 */
  dust: number
  /** whether visitors walk round it */
  ring: number
  round?: { east: number; north: number; radius: number }
}

/** A line visitors walk, as east-north points, its half-width and how much it
 * has worn the sealer. */
interface Lane { at: readonly (readonly [number, number])[]; half: number; wear: number }

export interface HallFloorPlan {
  footings: Footing[]
  lanes: Lane[]
  /** where a crowd gathers: a door's mouth */
  mouths: { east: number; north: number; radius: number; wear: number }[]
}

// the bake runs in node's module sandbox too, where every global read is slow
const { PI, abs, acos, atan2, ceil, cos, exp, floor, imul, max, min, round, sin, sqrt } = Math
const FAR = Number.POSITIVE_INFINITY
const len2 = (x: number, y: number): number => sqrt(x * x + y * y)
const len3 = (x: number, y: number, z: number): number => sqrt(x * x + y * y + z * z)

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)
const smooth = (a: number, b: number, x: number): number => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t) }

/* ── deterministic noise: integer hashing, so the same recipe bakes the same
   bytes in a browser and in node ─────────────────────────────────────────── */
const hash = (ix: number, iy: number, seed: number): number => {
  let h = imul(ix | 0, 0x27d4eb2d) ^ imul(iy | 0, 0x165667b1) ^ imul(seed | 0, 0x9e3779b1)
  h = imul(h ^ (h >>> 15), 0x85ebca6b)
  h = imul(h ^ (h >>> 13), 0xc2b2ae35)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
/** value noise in -1..1, quintic between lattice points */
const noise = (x: number, y: number, seed: number): number => {
  const ix = floor(x), iy = floor(y), fx = x - ix, fy = y - iy
  const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10), uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10)
  const a = hash(ix, iy, seed), b = hash(ix + 1, iy, seed), c = hash(ix, iy + 1, seed), d = hash(ix + 1, iy + 1, seed)
  return (a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy) * 2 - 1
}
const fbm = (x: number, y: number, seed: number, octaves: number, gain = .5): number => {
  let sum = 0, amp = 1, f = 1, norm = 0
  for (let o = 0; o < octaves; o++) {
    sum += noise(x * f + o * 17.31, y * f - o * 9.73, seed + o * 101) * amp
    norm += amp; amp *= gain; f *= 2.03
  }
  return sum / norm
}

/** A field evaluated on a coarse lattice over the map and read bilinearly:
 * the clouding and the patchiness are metres across, so a fine map need not
 * pay for them per texel. */
const lattice = (size: number, fn: (east: number, north: number) => number): (east: number, north: number) => number => {
  const M = HALL_FLOOR_MAP, w = M.east - M.west, h = M.north - M.south
  const grid = new Float32Array((size + 1) * (size + 1))
  for (let j = 0; j <= size; j++) for (let i = 0; i <= size; i++) grid[j * (size + 1) + i] = fn(M.west + (i / size) * w, M.south + (j / size) * h)
  return (east, north) => {
    const x = clamp01((east - M.west) / w) * size, y = clamp01((north - M.south) / h) * size
    const i = min(size - 1, floor(x)), j = min(size - 1, floor(y)), fx = x - i, fy = y - j
    const k = j * (size + 1) + i
    const a = grid[k]!, b = grid[k + 1]!, c = grid[k + size + 1]!, d = grid[k + size + 2]!
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy
  }
}

/** THE PLAN THE MAPS ARE BAKED FROM: the plinths as the stands build them,
 * the dark bay's walls, the aerial screw's platform and the gun's wheels as
 * their dossiers give them, the hall's walls, and the lines visitors walk
 * between the three doors and round the machines. */
export function hallFloorPlan(): HallFloorPlan {
  const H = ROOMS.hall
  const footings: Footing[] = []
  const inHall = (east: number, north: number): boolean => east > H.west && east < H.east && north > H.south && north < H.north
  // a plinth is a top slab over a shaft; the stands give both boxes
  const slabs = standBoxes().filter(b => inHall(b.east, b.north) && b.height - b.tall / 2 < FLOOR + .6)
  for (const b of slabs.filter(b => b.role === 2)) {
    const shaft = slabs.find(s => s.role === 3 && abs(s.east - b.east) < 1e-6 && abs(s.north - b.north) < 1e-6)
    footings.push({
      west: b.east - b.width / 2, east: b.east + b.width / 2, south: b.north - b.depth / 2, north: b.north + b.depth / 2,
      high: b.height + b.tall / 2 - FLOOR, gap: shaft ? (b.width - shaft.width) / 2 : 0, shade: 1, dust: 1, ring: 1,
    })
  }
  // the camera obscura's dark bay: three walls, its north side open
  const B = DARK_BAY
  for (const [w, s, e, n] of [
    [B.west - B.wall, B.south - B.wall, B.west, B.north],
    [B.east, B.south - B.wall, B.east + B.wall, B.north],
    [B.west - B.wall, B.south - B.wall, B.east + B.wall, B.south],
  ] as const) footings.push({ west: w, east: e, south: s, north: n, high: B.height, gap: 0, shade: .55, dust: .8, ring: 0 })
  // the aerial screw stands on its own round platform
  const screw = STANDS['aerial-screw']!, platform = dossiers['aerial-screw'].parts.find(p => p.id === 'platform')
  const radius = platform?.dimensions_m.radius ?? 1.7, tall = platform?.dimensions_m.height ?? .18
  footings.push({ west: screw.east - radius, east: screw.east + radius, south: screw.north - radius, north: screw.north + radius,
    high: tall, gap: 0, shade: .8, dust: .45, ring: .8, round: { east: screw.east, north: screw.north, radius } })
  // the gun stands on two wheels: each a narrow block where it meets the floor
  const gun = STANDS['multi-barrel-gun']!
  for (const part of dossiers['multi-barrel-gun'].parts.filter(p => /^wheel/.test(p.id))) {
    const x = part.position_m[0] ?? 0, r = part.dimensions_m.radius ?? .5, width = part.dimensions_m.height ?? .08
    footings.push({ west: gun.east + x - width / 2, east: gun.east + x + width / 2, south: gun.north - r * .45, north: gun.north + r * .45,
      high: r * .55, gap: 0, shade: .45, dust: .35, ring: 0 })
  }
  const pictureDoor = (OPENING.pictureToHall.east[0] + OPENING.pictureToHall.east[1]) / 2
  const galleryDoor = (OPENING.hallToGallery.north[0] + OPENING.hallToGallery.north[1]) / 2
  const southDoor = (OPENING.hallToSouth.north[0] + OPENING.hallToSouth.north[1]) / 2
  const lanes: Lane[] = [
    // in at the picture room's door, along the north aisle, down between the screws
    { at: [[pictureDoor, H.north - .2], [pictureDoor + .5, -43.2], [-56.4, -43.45], [-53, -43.6], [-51.3, -46.4], [-51, -47.4]], half: .55, wear: .5 },
    // the aisle between the two groups of machines, out at the gallery's door
    { at: [[-51, -47.4], [-48.6, -48.2], [-46.4, -48.5], [-43.2, -48], [-41.6, -46], [-40.6, -43.9], [H.east + .2, galleryDoor]], half: .7, wear: .65 },
    // in at the south door, across the open floor to the dark bay's mouth
    { at: [[H.east + .2, southDoor], [-41.2, -60.8], [-42.6, -57.2], [-42.9, -53.9], [-43.4, -51.2], [-45.6, -51.1]], half: .6, wear: .38 },
    // round the gates and back up to the aisle
    { at: [[-51, -47.4], [-52.4, -49.6], [-52.4, -53.8], [-55.5, -55.1], [-58.4, -53.9]], half: .5, wear: .32 },
    // the flywheel and the gun, from the aisle
    { at: [[-43.2, -48], [-42.6, -49.4], [-41.4, -49.3]], half: .45, wear: .3 },
  ]
  const mouths = [
    { east: pictureDoor, north: H.north - .5, radius: 1.1, wear: .45 },
    { east: H.east - .5, north: galleryDoor, radius: 1.1, wear: .5 },
    { east: H.east - .5, north: southDoor, radius: 1, wear: .35 },
  ]
  return { footings, lanes, mouths }
}

/** distance from a point to a segment, in plan */
const toSegment = (px: number, py: number, ax: number, ay: number, bx: number, by: number): number => {
  const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy
  const t = l > 0 ? clamp01(((px - ax) * dx + (py - ay) * dy) / l) : 0
  return len2(px - ax - t * dx, py - ay - t * dy)
}
/** distance from a point outside a footing to it, in plan; negative inside */
const toFooting = (f: Footing, east: number, north: number): number => {
  if (f.round) return len2(east - f.round.east, north - f.round.north) - f.round.radius
  const dx = max(f.west - east, east - f.east), dy = max(f.south - north, north - f.north)
  return dx > 0 || dy > 0 ? len2(max(dx, 0), max(dy, 0)) : max(dx, dy)
}

/* ── THE CONTACT SHADING, for the engine alone ──────────────────────────────
   A path tracer darkens a floor where a plinth stands on it because the
   plinth hides part of the sky and the room from that floor. The engine's
   light is a probe from the middle of the hall and an unshadowed window, so
   the maps carry the two figures a path tracer would find: how much of the
   hemisphere each footing hides (Lambert's form factor of its faces), and how
   much of the clerestory it and the light shelf hide. */

/** Lambert's form factor from a floor point (origin, facing up) to a polygon
 * given by its corners relative to that point. */
const formFactor = (v: number[][]): number => {
  let sum = 0
  for (let i = 0; i < v.length; i++) {
    const a = v[i]!, b = v[(i + 1) % v.length]!
    const cx = a[1]! * b[2]! - a[2]! * b[1]!, cy = a[2]! * b[0]! - a[0]! * b[2]!, cz = a[0]! * b[1]! - a[1]! * b[0]!
    const cl = len3(cx, cy, cz)
    if (cl < 1e-12) continue
    const la = len3(a[0]!, a[1]!, a[2]!), lb = len3(b[0]!, b[1]!, b[2]!)
    const angle = acos(max(-1, min(1, (a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!) / (la * lb))))
    sum += angle * cz / cl
  }
  return abs(sum) / (2 * PI)
}
/** the share of the hemisphere a footing hides from a floor point outside it */
const hidden = (f: Footing, east: number, north: number): number => {
  const h = f.high * f.shade
  if (f.round) {
    // a round platform as the chord of it that faces the point
    const dx = east - f.round.east, dy = north - f.round.north, d = len2(dx, dy), r = f.round.radius
    if (d <= r) return 0
    const half = acos(r / d), ux = dx / d, uy = dy / d
    const corners: number[][] = []
    for (let k = 0; k <= 6; k++) {
      const a = -half + (2 * half * k) / 6, ca = cos(a), sa = sin(a)
      corners.push([f.round.east + r * (ux * ca - uy * sa) - east, f.round.north + r * (uy * ca + ux * sa) - north, 0])
    }
    const top = corners.slice().reverse().map(c => [c[0]!, c[1]!, h])
    return formFactor([...corners, ...top])
  }
  let F = 0
  const w = f.west - east, e = f.east - east, s = f.south - north, n = f.north - north
  if (w > 0) F += formFactor([[w, s, 0], [w, n, 0], [w, n, h], [w, s, h]])
  if (e < 0) F += formFactor([[e, s, 0], [e, n, 0], [e, n, h], [e, s, h]])
  if (s > 0) F += formFactor([[w, s, 0], [e, s, 0], [e, s, h], [w, s, h]])
  if (n < 0) F += formFactor([[w, n, 0], [e, n, 0], [e, n, h], [w, n, h]])
  return F
}

/** whether the light shelf or its lip stands between a floor point and a
 * point of the window, both on one north-south line */
const underShelf = (py: number, qy: number, qz: number): boolean => {
  const soffit = SHELF.soffit - FLOOR, lip = SHELF.lip - FLOOR
  const t = soffit / qz, at = py + t * (qy - py)
  if (at > SHELF.south && at < SHELF.north) return true
  const tl = (SHELF.lipNorth - py) / (qy - py), z = tl * qz
  return tl > 0 && tl < 1 && z > soffit && z < lip
}

/** THE CLERESTORY PAST ITS SHELF: the share of the window's light on the
 * floor that the light shelf and its lip let through, by metres south of the
 * glazing, a step of a quarter metre. The shelf spans the hall, so north alone
 * decides it. */
export const HALL_FLOOR_SHELF = (() => {
  const step = .25, count = 97, out = new Float32Array(count)
  const along = 24, up = 48
  for (let c = 0; c < count; c++) {
    const dy = c * step
    let open = 0, all = 0
    for (let a = 0; a < along; a++) for (let u = 0; u < up; u++) {
      const dx = -WINDOW.width / 2 + (a + .5) * WINDOW.width / along
      const qz = WINDOW.height - FLOOR - WINDOW.tall / 2 + (u + .5) * WINDOW.tall / up
      if (dy <= 0) continue
      const r2 = dx * dx + dy * dy + qz * qz, w = qz * dy / (r2 * r2)
      all += w
      if (!underShelf(WINDOW.north - dy, WINDOW.north, qz)) open += w
    }
    out[c] = all > 0 ? open / all : 0
  }
  return { step, glazing: WINDOW.north, values: out }
})()

export interface HallFloorMaps {
  size: number
  /** tone (albedo ratio - 0.5), roughness, dust (and the silt in the saw
   * cuts), contact with the room's light; linear bytes */
  finish: Uint8Array
  bakeMs: number
}

/** THE FLOOR'S MAP, `size` texels a side over the hall. */
export function bakeHallFloor(plan: HallFloorPlan, size = 2048): HallFloorMaps {
  const began = typeof performance !== 'undefined' ? performance.now() : 0
  const M = HALL_FLOOR_MAP, W = M.east - M.west, D = M.north - M.south
  const BAY = HALL_FLOOR_BAY

  /* THE WEAR, on a lattice: a sealer is walked through along the lanes, at
     the doors and on a ring round every plinth, heaviest on the side a
     visitor comes from, never as a clean band. */
  const patch = lattice(512, (e, n) => .62 + .38 * fbm(e / .55, n / .55, 31, 3) + .12 * noise(e / .13, n / .13, 37))
  const wearAt = (e: number, n: number): number => {
    let keep = 1 - (.09 + .05 * noise(e / 2.6, n / 2.6, 41)), lane = FAR
    for (const l of plan.lanes) {
      let d = FAR
      for (let k = 1; k < l.at.length; k++) d = min(d, toSegment(e, n, l.at[k - 1]![0], l.at[k - 1]![1], l.at[k]![0], l.at[k]![1]))
      lane = min(lane, d)
      if (d < l.half * 3.2) keep *= 1 - l.wear * exp(-((d / l.half) ** 2))
    }
    for (const m of plan.mouths) {
      const d = len2(e - m.east, n - m.north)
      if (d < m.radius * 2.5) keep *= 1 - m.wear * exp(-((d / m.radius) ** 2))
    }
    const facing = .35 + .65 * exp(-lane / 1.6)
    for (const f of plan.footings) {
      if (!f.ring) continue
      const d = toFooting(f, e, n)
      if (d > 0 && d < 2.2) keep *= 1 - .42 * f.ring * facing * exp(-(((d - .5) / .38) ** 2))
    }
    return clamp01((1 - keep) * patch(e, n))
  }
  const wear = lattice(256, wearAt)

  /* THE POUR AND THE SEALER: clouding a metre or two across, darker trowel
     burn where the blades worked longest (darker and glossier), each bay its
     own pour a shade apart with a drift across it. */
  const clouds = lattice(256, (e, n) => .15 * fbm(e / 2.3, n / 2.3, 11, 4) + .05 * fbm(e / .62, n / .62, 13, 2))
  const burn = lattice(256, (e, n) => smooth(.28, .72, noise(e / .95 + .4 * noise(e / 2.1, n / 2.1, 17), n / .95, 19)))
  const gloss = lattice(256, (e, n) => .065 * fbm(e / 1.7 + 11.3, n / 1.7 - 7.1, 23, 3))
  const silt = lattice(256, (e, n) => .45 + .4 * fbm(e / .7, n / .7, 29, 2))
  // the pour's tone and the sealer's roughness, a lattice each: both are
  // decimetres across, so a texel need not assemble them from five fields
  const baseTone = lattice(512, (e, n) => 1 + clouds(e, n) - burn(e, n) * .045 + wear(e, n) * .09)
  // a denser, darker paste took the sealer thicker and holds its gloss
  const baseRough = lattice(512, (e, n) => .17 + gloss(e, n) + clouds(e, n) * .25 - burn(e, n) * .04 + wear(e, n) * .32)

  const tone = new Float32Array(size * size), rough = new Float32Array(size * size), dust = new Float32Array(size * size)
  const te = W / size, tn = D / size
  // each column's and row's bay and distance to its cut, once
  const colCell = new Int32Array(size), colCut = new Float32Array(size), colE = new Float32Array(size)
  for (let i = 0; i < size; i++) {
    const e = M.west + (i + .5) * te, f = (e - BAY.originEast) / BAY.east
    colE[i] = e; colCell[i] = floor(f); colCut[i] = min(f - floor(f), 1 - f + floor(f)) * BAY.east
  }
  // each bay's own pour: its shade and the way it was struck off
  const pour = new Map<number, [number, number, number]>()
  const pourOf = (ce: number, cn: number): [number, number, number] => {
    const key = ce * 4096 + cn
    let p = pour.get(key)
    if (!p) { const a = hash(ce, cn, 5) * PI * 2; p = [(hash(ce, cn, 3) - .5) * .09, cos(a), sin(a)]; pour.set(key, p) }
    return p
  }
  for (let j = 0; j < size; j++) {
    const n = M.south + (j + .5) * tn
    const fn = (n - BAY.originNorth) / BAY.north, cellN = floor(fn), cutN = min(fn - cellN, 1 - fn + cellN) * BAY.north
    const dn = n - BAY.originNorth - (cellN + .5) * BAY.north
    for (let i = 0; i < size; i++) {
      const e = colE[i]!, k = j * size + i, cellE = colCell[i]!
      const [shade, ca, sa] = pourOf(cellE, cellN)
      const across = ((e - BAY.originEast - (cellE + .5) * BAY.east) * ca + dn * sa) / 1.6
      tone[k] = baseTone(e, n) + shade + across * .02
      rough[k] = baseRough(e, n)
      // a cut holds what the mop pushes into it, least where feet scuff it
      // clean; it rides in the dust, on the cut's own line
      const toCut = min(colCut[i]!, cutN)
      if (toCut < .02) dust[k] = clamp01(silt(e, n) - wear(e, n) * .45) * exp(-((toCut / .011) ** 2))
    }
  }

  /* THE TROWEL: a power trowel's blades leave overlapping arcs, burnished
     into the sealer and read in its sheen more than its tone; worn through
     where the traffic runs. */
  const pitch = .42
  for (let cy = floor(D / pitch); cy >= 0; cy--) for (let cx = floor(W / pitch); cx >= 0; cx--) {
    const ce = M.west + (cx + .5 + (hash(cx, cy, 51) - .5)) * pitch, cn = M.south + (cy + .5 + (hash(cx, cy, 53) - .5)) * pitch
    const R = .26 + .26 * hash(cx, cy, 55), from = hash(cx, cy, 57) * PI * 2, span = (.25 + .6 * hash(cx, cy, 59)) * PI
    const sigma = .01 + .014 * hash(cx, cy, 61), strength = .022 + .04 * hash(cx, cy, 63)
    const reach = R + .05 + 3 * sigma
    const i0 = max(0, floor((ce - reach - M.west) / te)), i1 = min(size - 1, ceil((ce + reach - M.west) / te))
    const j0 = max(0, floor((cn - reach - M.south) / tn)), j1 = min(size - 1, ceil((cn + reach - M.south) / tn))
    for (let j = j0; j <= j1; j++) {
      const dn = M.south + (j + .5) * tn - cn
      for (let i = i0; i <= i1; i++) {
        const de = M.west + (i + .5) * te - ce, r = len2(de, dn)
        if (abs(r - R + .02) > 3 * sigma + .03) continue
        let off = atan2(dn, de) - from
        off -= floor(off / (PI * 2)) * PI * 2
        const run = off < span ? min(1, off / .3, (span - off) / .3) : 0
        if (run <= 0) continue
        const ring = exp(-(((r - R) / sigma) ** 2)) + .5 * exp(-(((r - R + .04) / (sigma * .8)) ** 2))
        const k = j * size + i
        const keep = 1 - wear(M.west + (i + .5) * te, dn + cn)
        rough[k]! -= ring * run * strength * keep
        tone[k]! += ring * run * strength * .25 * keep
      }
    }
  }

  /* THE DUST gathers where the mop stops: under a plinth's overhang, in a
     line at its foot and at the foot of every wall, heavier at the corners,
     never an even band. */
  const lineNoise = (e: number, n: number): number => .55 + .45 * noise(e / .16, n / .16, 71) + .15 * noise(e / .04, n / .04, 73)
  const addDust = (i: number, j: number, amount: number): void => { const k = j * size + i; dust[k] = max(dust[k]!, amount) }
  for (const f of plan.footings) {
    if (f.dust <= 0) continue
    const reach = .2
    const i0 = max(0, floor((f.west - reach - M.west) / te)), i1 = min(size - 1, ceil((f.east + reach - M.west) / te))
    const j0 = max(0, floor((f.south - reach - M.south) / tn)), j1 = min(size - 1, ceil((f.north + reach - M.south) / tn))
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const e = M.west + (i + .5) * te, n = M.south + (j + .5) * tn, d = toFooting(f, e, n)
      if (d > reach) continue
      if (d <= 0) { if (f.gap > 0 && -d < f.gap) addDust(i, j, f.dust * .95); continue }
      const ox = max(f.west - e, e - f.east), oy = max(f.south - n, n - f.north)
      const corner = !f.round && ox > 0 && oy > 0 ? exp(-len2(ox, oy) / .05) : 0
      addDust(i, j, f.dust * clamp01((.75 * exp(-d / .011) + .12 * exp(-d / .07) + .3 * corner) * lineNoise(e, n)))
    }
  }
  // the hall's own walls, where the finish stops over its shadow gap
  const H = ROOMS.hall, face = .039, reachWall = .25
  const walls: { at: number; axis: 'e' | 'n'; sign: 1 | -1; gaps: [number, number][] }[] = [
    { at: H.west + face, axis: 'e', sign: 1, gaps: [] },
    { at: H.east - face, axis: 'e', sign: -1, gaps: [[OPENING.hallToGallery.north[0], OPENING.hallToGallery.north[1]], [OPENING.hallToSouth.north[0], OPENING.hallToSouth.north[1]]] },
    { at: H.south + face, axis: 'n', sign: 1, gaps: [] },
    { at: H.north - face, axis: 'n', sign: -1, gaps: [[OPENING.pictureToHall.east[0], OPENING.pictureToHall.east[1]]] },
  ]
  for (const wall of walls) {
    const count = ceil(reachWall / (wall.axis === 'e' ? te : tn)) + 2
    for (let s = 0; s < count; s++) for (let t = 0; t < size; t++) {
      const i = wall.axis === 'e' ? (wall.sign > 0 ? s : size - 1 - s) : t
      const j = wall.axis === 'e' ? t : (wall.sign > 0 ? s : size - 1 - s)
      const e = M.west + (i + .5) * te, n = M.south + (j + .5) * tn
      const along = wall.axis === 'e' ? n : e
      if (wall.gaps.some(([a, b]) => along > a && along < b)) continue
      const d = max(0, wall.sign * ((wall.axis === 'e' ? e : n) - wall.at))
      // an inside corner of the room holds the most
      const toCorner = wall.axis === 'e' ? min(n - H.south, H.north - n) : min(e - H.west, H.east - e)
      const corner = exp(-max(0, toCorner - face) / .12)
      addDust(i, j, clamp01((.65 * exp(-d / .014) + .1 * exp(-d / .08) + .35 * corner * exp(-d / .05)) * lineNoise(e, n)))
    }
  }

  /* THE CONTACT a path tracer finds by itself: how much of the room each
     footing hides from the floor round it, as Lambert's form factor of its
     faces. Taken at a quarter of the map's side: it runs over decimetres. */
  const A = size >> 2, ae = W / A, an = D / A
  const contact = new Float32Array(A * A)
  const reach = (f: Footing): number => min(3, .3 + 2.5 * f.high * f.shade)
  for (let j = 0; j < A; j++) {
    const n = M.south + (j + .5) * an
    for (let i = 0; i < A; i++) {
      const e = M.west + (i + .5) * ae
      let F = 0
      for (const f of plan.footings) {
        const d = toFooting(f, e, n)
        if (d <= 0) { F = max(F, f.gap > 0 && -d < f.gap ? .72 : .95); continue }
        const r = reach(f)
        if (d < r) F += hidden(f, e, n) * smooth(r, r * .6, d)
      }
      contact[j * A + i] = 1 - min(.92, F)
    }
  }
  const contactAt = (i: number, j: number): number => {
    const x = clamp01(((i + .5) * te) / W) * A - .5, y = clamp01(((j + .5) * tn) / D) * A - .5
    const x0 = max(0, min(A - 1, floor(x))), y0 = max(0, min(A - 1, floor(y))), x1 = min(A - 1, x0 + 1), y1 = min(A - 1, y0 + 1)
    const fx = clamp01(x - x0), fy = clamp01(y - y0)
    const a = contact[y0 * A + x0]!, b = contact[y0 * A + x1]!, c = contact[y1 * A + x0]!, d = contact[y1 * A + x1]!
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy
  }

  const finish = new Uint8Array(size * size * 4)
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const k = j * size + i
    finish[k * 4] = round(clamp01(tone[k]! - .5) * 255)
    finish[k * 4 + 1] = round(clamp01(rough[k]!) * 255)
    finish[k * 4 + 2] = round(clamp01(dust[k]!) * 255)
    finish[k * 4 + 3] = round(clamp01(contactAt(i, j)) * 255)
  }
  const bakeMs = typeof performance !== 'undefined' ? round(performance.now() - began) : 0
  return { size, finish, bakeMs }
}

/* ── THE TILE ─────────────────────────────────────────────────────────────── */

/** Draws a filled blob into a tile that wraps at its edges. */
const stamp = (tile: Float32Array, side: number, cx: number, cy: number, radius: number, value: number, channel: number, stride: number,
  lobes: number[], soft = .8): void => {
  const reachPx = ceil(radius * 1.5) + 1
  for (let dy = -reachPx; dy <= reachPx; dy++) for (let dx = -reachPx; dx <= reachPx; dx++) {
    const px = cx + dx, py = cy + dy
    const r = len2(px - cx, py - cy), a = atan2(py - cy, px - cx)
    let edge = radius
    for (let h = 0; h < lobes.length; h++) edge += radius * lobes[h]! * cos((h + 2) * a + h * 1.7)
    const cover = clamp01(edge - r + soft)
    if (cover <= 0) continue
    const x = ((floor(px) % side) + side) % side, y = ((floor(py) % side) + side) % side
    const k = (y * side + x) * stride + channel
    tile[k] = tile[k]! + (value - tile[k]!) * cover
  }
}

/** THE TILE LAID OVER THE WHOLE FLOOR: the cut aggregate (the cement paste
 * with the sand and stone the grinder opened, and its pores) and what feet
 * leave on a sealer. RGBA linear: the aggregate's albedo ratio / 2 (mean one),
 * its roughness offset + .5 (a stone polishes harder than its paste, a pore
 * stays rough), heel scuffs, hairline scratches. */
export function bakeFloorTile(side = 2048, metres: number = HALL_FLOOR_TILE): Uint8Array {
  const px = side / (metres * 1000)
  const area = metres * metres
  const lum = new Float32Array(side * side), acc = new Float32Array(side * side)
  const marks = new Float32Array(side * side * 2)
  for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) {
    lum[y * side + x] = 1 + .035 * noise(x / (px * 9), y / (px * 9), 81) + .02 * noise(x / (px * 2.5), y / (px * 2.5), 83)
  }
  // sand, fine and coarse stone, each a shade of the river gravel a mix carries
  const shades = [.52, .7, .88, 1.18, 1.38, 1.1, .8]
  const classes = [
    { count: round(72000 * area), rMin: .35, rMax: 1.0, seed: 101 },
    { count: round(9000 * area), rMin: 1.0, rMax: 2.6, seed: 103 },
    { count: round(190 * area), rMin: 2.8, rMax: 6.5, seed: 105 },
  ]
  for (const c of classes) {
    for (let i = 0; i < c.count; i++) {
      const cx = hash(i, 1, c.seed) * side, cy = hash(i, 2, c.seed) * side
      const r = (c.rMin + (c.rMax - c.rMin) * hash(i, 3, c.seed) ** 1.6) * px
      const shade = shades[floor(hash(i, 4, c.seed) * shades.length)]! * (.94 + .12 * hash(i, 8, c.seed))
      const lobes = [.18 * (hash(i, 5, c.seed) - .5), .12 * (hash(i, 6, c.seed) - .5), .08 * (hash(i, 7, c.seed) - .5)]
      stamp(lum, side, cx, cy, r, shade, 0, 1, lobes, .7)
      stamp(acc, side, cx, cy, r, -.05, 0, 1, lobes, .7)
    }
  }
  // pores the grinder opened and the sealer bridged: small, dark, rough
  for (let i = 0; i < round(10500 * area); i++) {
    const cx = hash(i, 11, 107) * side, cy = hash(i, 12, 107) * side, r = (.15 + .45 * hash(i, 13, 107) ** 2) * px
    stamp(lum, side, cx, cy, r, .42, 0, 1, [], .6)
    stamp(acc, side, cx, cy, r, .22, 0, 1, [], .6)
  }
  // heel scuffs: short dark arcs a few millimetres wide, walked every way
  for (let i = 0; i < round(31 * area); i++) {
    const x0 = hash(i, 1, 201) * side, y0 = hash(i, 2, 201) * side
    const length = (30 + 110 * hash(i, 3, 201)) * px, a = hash(i, 4, 201) * PI * 2, bend = (hash(i, 5, 201) - .5) * 1.2
    const width = (1.2 + 3 * hash(i, 6, 201)) * px, dark = .35 + .65 * hash(i, 7, 201)
    const steps = ceil(length / max(.6, width * .4))
    for (let s = 0; s <= steps; s++) {
      const f = s / steps, ang = a + bend * (f - .5)
      const x = x0 + cos(ang) * length * (f - .5), y = y0 + sin(ang) * length * (f - .5)
      const taper = sin(PI * f)
      stamp(marks, side, x, y, max(.5, width * taper * .5), dark * (.6 + .4 * taper), 0, 2, [], .8)
    }
  }
  // hairline scratches: long, straight, lighter and rougher
  for (let i = 0; i < round(290 * area); i++) {
    const x0 = hash(i, 11, 203) * side, y0 = hash(i, 12, 203) * side
    const length = (20 + 260 * hash(i, 13, 203) ** 2) * px, a = hash(i, 14, 203) * PI
    const value = .4 + .6 * hash(i, 15, 203), steps = ceil(length / .7)
    for (let s = 0; s <= steps; s++) {
      const f = s / steps, x = x0 + cos(a) * length * (f - .5), y = y0 + sin(a) * length * (f - .5)
      const xi = ((floor(x) % side) + side) % side, yi = ((floor(y) % side) + side) % side
      const k = (yi * side + xi) * 2 + 1
      marks[k] = max(marks[k]!, value * sin(PI * f))
    }
  }
  // the ratio's mean is one, or the tile would brighten the floor it rides on
  let mean = 0
  for (let k = 0; k < side * side; k++) mean += lum[k]!
  mean /= side * side
  const out = new Uint8Array(side * side * 4)
  for (let k = 0; k < side * side; k++) {
    out[k * 4] = round(clamp01(lum[k]! / mean / 2) * 255)
    out[k * 4 + 1] = round(clamp01(acc[k]! + .5) * 255)
    out[k * 4 + 2] = round(clamp01(marks[k * 2]!) * 255)
    out[k * 4 + 3] = round(clamp01(marks[k * 2 + 1]!) * 255)
  }
  return out
}

export const hallFloorProvenance = {
  class: 'GENERATED',
  recipe: 'The mechanism hall\'s sealed concrete floor baked in code over the hall: each 3.2 by 3.3 m bay its own pour a shade apart with a drift across it; clouding one to two metres across; darker, glossier trowel burn; power-trowel arcs 0.26 to 0.52 m in radius burnished into the sealer; wear along the lanes between the three doors, round every plinth a visitor stands at and at each door\'s mouth, raising the roughness from 0.25 to about 0.5 and lightening it a little; dust under each plinth\'s overhang, in a line at its foot, at the walls\' feet and silted into the 4 mm saw cuts. One tile over it at 1.2 m: cut aggregate (sand, fine and coarse stone, pores), heel scuffs and hairline scratches. For the engine alone, the contact of the room\'s light (the form factor of every plinth, the dark bay\'s walls and the screw\'s platform) and the clerestory\'s light past its shelf. A finish specification, not a survey.',
} as const
