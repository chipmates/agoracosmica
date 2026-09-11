/* THE PLANTING — a tree, a shrub, a patch of grass.

   The model library has no tree. Every real tree in the CC0 collection ships
   a glTF whose vertex buffer alone runs from forty megabytes to nine hundred,
   and the one that fits under a gigabyte is a jacaranda of 3.9 million
   triangles, which is more than a whole frame's budget and is also a
   jacaranda. So an oak in the Loire is generated or it does not exist.

   The verdicts say what "does not exist" looks like: "trees as blobs", "the
   trees at the horizon render as hard black speckle with visible cutout
   stair-stepping and whole leaf clusters detached from their branches", "a
   twig spray floats unattached in open sky", "the tree trunk stands in the
   dovecote's footprint".

   So this file grows a tree rather than drawing one. Attraction points are
   scattered through the crown the species actually makes, and the branches
   grow toward them, one step at a time, until the points are used up. That
   is space colonisation, and the reason for it here is not novelty: it is
   that a branch grown toward a point IS attached to its parent, at every
   fork, by construction. Nothing in a tree built this way can float, because
   nothing in it exists except as a child of something else.

   The radii come from the pipe model, which is the observation that a limb
   carries the cross-section of everything above it. It is the reason a real
   tree tapers the way it does, and it is one line. */

import {
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Matrix4,
  MeshStandardNodeMaterial,
  Quaternion,
  SRGBColorSpace,
  Vector3,
} from 'three/webgpu'
import { Bench, between, body, hand, seal, type Part } from './common'

const BARK = 'oak-beams'

/* ── the species ───────────────────────────────────────────────────────── */

export type Species = 'oak' | 'lime' | 'plane' | 'yew' | 'cypress' | 'shrub'
export type Season = 'summer' | 'october' | 'bare'

interface Habit {
  /** the crown's own shape, as the fraction of the tree's height its bottom
      sits at, and how wide it runs against its height */
  crownBase: number
  spread: number
  /** 0 is a column, 1 is a dome, 2 is a broad flat head */
  head: number
  /** how far a new shoot travels in one step, as a fraction of the crown's
      own point spacing. Around a half is a tree; much more and the branches
      overshoot their targets */
  step: number
  /** how strongly the shoots lean up (a poplar) or out (an old oak) */
  tropism: number
  /** how many attraction points the crown is seeded with */
  points: number
  /** the leaf card's own size in metres AT THE NOMINAL HEIGHT, and how many
      stand at a twig's end. A card is a spray of leaves, so its size follows
      the tree's own only weakly: a bush's foliage is not a twentieth of an
      oak's because the bush is a twentieth as tall. */
  leaf: number
  nominal: number
  cards: number
  /** what the leaves are, in summer and in October */
  green: string
  autumn: string
  /** an evergreen keeps its own colour through October */
  evergreen: boolean
  /** the leaf the atlas draws */
  blade: 'lobed' | 'cordate' | 'palmate' | 'needle' | 'scale'
  bark: string
  /** how far the bark set is taken off its own measured mean. A plane's
      bark is pale, and the palest set in the library is paler still. */
  barkValue: number
}

/* the five the Loire actually plants, and one bush. Heights, spreads and
   habits are the species' own; nothing here is a guess dressed as a fact,
   and every one of them is a shape rather than a measurement. */
const HABIT: Record<Species, Habit> = {
  oak: {
    crownBase: 0.34,
    spread: 1.05,
    head: 1.6,
    step: 0.55,
    tropism: 0.12,
    points: 1400,
    leaf: 0.46,
    nominal: 16,
    cards: 4,
    green: '#4c6a33',
    autumn: '#7d5a2c',
    evergreen: false,
    blade: 'lobed',
    bark: BARK,
    barkValue: 1,
  },
  lime: {
    crownBase: 0.26,
    spread: 0.72,
    head: 0.9,
    step: 0.55,
    tropism: 0.3,
    points: 1150,
    leaf: 0.4,
    nominal: 14,
    cards: 3,
    green: '#5b7a3a',
    autumn: '#b39b3d',
    evergreen: false,
    blade: 'cordate',
    bark: BARK,
    barkValue: 1,
  },
  plane: {
    crownBase: 0.42,
    spread: 0.95,
    head: 1.35,
    step: 0.55,
    tropism: 0.16,
    points: 1150,
    leaf: 0.5,
    nominal: 15,
    cards: 4,
    green: '#587339',
    autumn: '#9c7a38',
    evergreen: false,
    blade: 'palmate',
    bark: 'plaster-lime-aged',
    barkValue: 0.6,
  },
  yew: {
    crownBase: 0.16,
    spread: 0.86,
    head: 1.1,
    step: 0.5,
    tropism: 0.2,
    points: 900,
    leaf: 0.3,
    nominal: 6,
    cards: 4,
    green: '#28402a',
    autumn: '#28402a',
    evergreen: true,
    blade: 'needle',
    bark: BARK,
    barkValue: 0.85,
  },
  cypress: {
    crownBase: 0.1,
    spread: 0.24,
    head: 0.35,
    step: 0.48,
    tropism: 0.62,
    points: 760,
    leaf: 0.3,
    nominal: 9,
    cards: 3,
    green: '#2f4531',
    autumn: '#2f4531',
    evergreen: true,
    blade: 'scale',
    bark: BARK,
    barkValue: 0.9,
  },
  shrub: {
    crownBase: 0.06,
    spread: 1.15,
    head: 1.2,
    step: 0.58,
    tropism: 0.22,
    points: 420,
    leaf: 0.24,
    nominal: 1.5,
    cards: 4,
    green: '#4f6b36',
    autumn: '#7d7a38',
    evergreen: false,
    blade: 'cordate',
    bark: BARK,
    barkValue: 1,
  },
}

export interface TreeOptions {
  species?: Species
  /** the tree's own height, in metres. A Loire oak at 1517 stands 14 to 22. */
  height: number
  season?: Season
  /** how many stems come out of the ground. A shrub has several. */
  stems?: number
  seed?: number
  /** the tier's own by default. 3 grows the whole crown, 1 grows a third of
      it with cards twice the size: a tier is cheaper, not emptier. */
  lod?: 1 | 2 | 3
  sets?: { bark?: string }
}

/* ── the growth ────────────────────────────────────────────────────────── */

interface Shoot {
  p: Vector3
  parent: number
  /** the direction it arrived along, which the next step is grown from */
  dir: Vector3
  radius: number
  /** metres of branch between the ground and this point, for the bark's uv */
  run: number
}

/**
 * Space colonisation. Attraction points fill the crown; every shoot that has
 * points within reach grows one step toward their average; a point within the
 * kill radius of any shoot is used up and removed. The tree stops when the
 * points do.
 */
function grow(h: Habit, height: number, r: () => number, lod: 1 | 2 | 3, stems: number): Shoot[] {
  const crownBottom = height * h.crownBase
  const crownTop = height
  const spread = height * h.spread * 0.5
  const count = Math.round(h.points * (lod >= 3 ? 1 : lod === 2 ? 0.62 : 0.34))
  /* THE THREE RADII ARE THE POINTS' OWN SPACING, not a fraction of the tree.
     Space colonisation only works when the kill radius sits just under the
     distance between attraction points: too large and every point is used up
     on the first pass (a nine metre cypress came out with a hundred and
     forty shoots), too small and the branches never reach them. So the
     spacing is computed from the crown the species actually makes and the
     three radii follow it, which makes the same numbers right for a bush of
     one metre and an oak of twenty. */
  const volume = Math.max(0.02, Math.PI * spread * spread * (crownTop - crownBottom) * 0.55)
  const spacing = Math.cbrt(volume / Math.max(1, count))
  const step = Math.max(0.05, spacing * h.step)
  const attract = spacing * 4.2
  const kill = spacing * 0.88

  /* THE CROWN IS THE SHAPE THE SPECIES MAKES. `head` bends the profile: at
     0.35 the widest place is near the top and the tree is a column; at 1.6 it
     is a third of the way up and the tree is a dome on a bare trunk. */
  const points: Vector3[] = []
  let guard = 0
  while (points.length < count && guard++ < count * 40) {
    const t = r()
    const y = crownBottom + (crownTop - crownBottom) * t
    const profile = Math.pow(Math.sin(Math.PI * Math.pow(t, 1 / h.head)), 0.7)
    const rad = spread * profile
    const a = r() * Math.PI * 2
    const q = Math.sqrt(r()) * rad
    const px = Math.cos(a) * q
    const pz = Math.sin(a) * q
    if (Math.hypot(px, pz) > rad) continue
    points.push(new Vector3(px, y, pz))
  }

  const shoots: Shoot[] = []
  for (let s = 0; s < Math.max(1, stems); s++) {
    const lean =
      stems > 1
        ? new Vector3(between(r, -0.45, 0.45), 1, between(r, -0.45, 0.45)).normalize()
        : new Vector3(0, 1, 0)
    const base = new Vector3(
      stems > 1 ? between(r, -0.14, 0.14) : 0,
      0,
      stems > 1 ? between(r, -0.14, 0.14) : 0
    )
    shoots.push({ p: base, parent: -1, dir: lean.clone(), radius: 0, run: 0 })
    /* the bole: it climbs straight to the bottom of the crown before it has
       anything to grow toward, which is what a forest tree does */
    let last = shoots.length - 1
    const climb = Math.max(1, Math.round((crownBottom * 0.92) / step))
    for (let i = 0; i < climb; i++) {
      const dir = lean
        .clone()
        .add(new Vector3(between(r, -0.06, 0.06), 0, between(r, -0.06, 0.06)))
        .normalize()
      const p = (shoots[last] as Shoot).p.clone().addScaledVector(dir, step)
      shoots.push({ p, parent: last, dir, radius: 0, run: (shoots[last] as Shoot).run + step })
      last = shoots.length - 1
    }
  }

  const alive = points.slice()
  const up = new Vector3(0, 1, 0)
  for (let pass = 0; pass < 220 && alive.length; pass++) {
    const pull = new Map<number, Vector3>()
    for (let a = alive.length - 1; a >= 0; a--) {
      const point = alive[a] as Vector3
      let best = -1
      let bestD = attract
      for (let i = 0; i < shoots.length; i++) {
        const d = (shoots[i] as Shoot).p.distanceTo(point)
        if (d < kill) {
          best = -2
          break
        }
        if (d < bestD) {
          bestD = d
          best = i
        }
      }
      if (best === -2) {
        alive.splice(a, 1)
        continue
      }
      if (best < 0) continue
      const dir = point.clone().sub((shoots[best] as Shoot).p).normalize()
      const held = pull.get(best)
      if (held) held.add(dir)
      else pull.set(best, dir)
    }
    if (!pull.size) break
    for (const [i, dir] of pull) {
      const parent = shoots[i] as Shoot
      const d = dir
        .normalize()
        .addScaledVector(up, h.tropism)
        .add(new Vector3(between(r, -0.09, 0.09), between(r, -0.05, 0.05), between(r, -0.09, 0.09)))
        .normalize()
      shoots.push({
        p: parent.p.clone().addScaledVector(d, step),
        parent: i,
        dir: d,
        radius: 0,
        run: parent.run + step,
      })
    }
  }

  /* THE PIPE MODEL. A limb carries the cross-section of everything above it,
     so a parent's radius is the 2.4-root of the sum of its children's radii
     to the same power. Walked from the tips down, which is why the shoots
     are kept in the order they were grown. */
  const power = 2.4
  const tip = step * 0.16
  for (let i = shoots.length - 1; i >= 0; i--) {
    const s = shoots[i] as Shoot
    if (s.radius === 0) s.radius = tip
    if (s.parent >= 0) {
      const p = shoots[s.parent] as Shoot
      p.radius = Math.pow(Math.pow(p.radius, power) + Math.pow(s.radius, power), 1 / power)
    }
  }
  return shoots
}

/* ── the wood ──────────────────────────────────────────────────────────── */

/** the branches, as one welded body: a ring at every shoot, connected to its
    parent's ring, so a fork is a fork and not two cylinders in the same place */
function wood(shoots: Shoot[], sides: number): BufferGeometry {
  const rings: Vector3[][] = []
  const frames: Vector3[] = []
  const position: number[] = []
  const uvs: number[] = []
  const index: number[] = []
  const up = new Vector3(0, 1, 0)
  const side = new Vector3()
  const other = new Vector3()

  for (let i = 0; i < shoots.length; i++) {
    const s = shoots[i] as Shoot
    /* a stable frame carried down from the parent, so the bark does not spin
       from one segment to the next */
    const carry = s.parent >= 0 ? (frames[s.parent] as Vector3) : new Vector3(1, 0, 0)
    side.copy(carry).sub(s.dir.clone().multiplyScalar(carry.dot(s.dir)))
    if (side.lengthSq() < 1e-8) side.copy(up).cross(s.dir)
    if (side.lengthSq() < 1e-8) side.set(1, 0, 0)
    side.normalize()
    other.copy(s.dir).cross(side).normalize()
    frames[i] = side.clone()
    const ring: Vector3[] = []
    const base = position.length / 3
    for (let k = 0; k <= sides; k++) {
      const a = (k / sides) * Math.PI * 2
      const p = s.p
        .clone()
        .addScaledVector(side, Math.cos(a) * s.radius)
        .addScaledVector(other, Math.sin(a) * s.radius)
      ring.push(p)
      position.push(p.x, p.y, p.z)
      /* the bark runs ALONG the limb, so the length is u and the girth is v:
         the library's beam set is turned in the manifest so its grain lies
         along u, and a trunk with the grain across it is a barrel */
      uvs.push(s.run, (a * s.radius))
    }
    rings.push(ring)
    if (s.parent >= 0) {
      const pb = (s.parent + 0) * (sides + 1)
      for (let k = 0; k < sides; k++) {
        const a = pb + k
        const b = base + k
        index.push(a, b, a + 1, b, b + 1, a + 1)
      }
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(position, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  geometry.setIndex(index)
  geometry.computeVertexNormals()
  return geometry
}

/* ── the leaf ──────────────────────────────────────────────────────────── */

const atlases = new Map<string, CanvasTexture>()

/**
 * A leaf atlas, drawn. Four cells, each a small SPRAY of leaves rather than
 * one leaf: a card that carries seven leaves reads as foliage at ten metres
 * where a card carrying one reads as a sticker, and it costs the same two
 * triangles. The colours run across the spray so no two leaves on one card
 * are the same green, which is what stops a crown from reading as a flat
 * cut-out.
 */
function leafAtlas(h: Habit, season: Season, size: number): CanvasTexture {
  const key = `${h.blade}|${season}|${size}`
  const held = atlases.get(key)
  if (held) return held
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 8
  if (!ctx) return texture
  ctx.clearRect(0, 0, size, size)
  const cell = size / 2
  const r = hand(hashOf(key))
  const summer = new Color(h.green)
  const autumn = new Color(h.autumn)
  for (let cy = 0; cy < 2; cy++) {
    for (let cx = 0; cx < 2; cx++) {
      const ox = cx * cell
      const oy = cy * cell
      const count = h.blade === 'needle' || h.blade === 'scale' ? 14 : 8
      for (let i = 0; i < count; i++) {
        /* every leaf is its own colour, its own age and its own angle: a
           spray of one colour is a stencil */
        const turn = season === 'october' && !h.evergreen ? Math.pow(r(), 0.7) : r() * 0.18
        const c = summer.clone().lerp(autumn, turn)
        c.offsetHSL(between(r, -0.03, 0.03), between(r, -0.08, 0.08), between(r, -0.1, 0.09))
        ctx.save()
        ctx.translate(ox + cell * between(r, 0.22, 0.78), oy + cell * between(r, 0.2, 0.8))
        ctx.rotate(r() * Math.PI * 2)
        ctx.scale(between(r, 0.62, 1.05), between(r, 0.62, 1.05))
        ctx.fillStyle = `#${c.getHexString()}`
        drawBlade(ctx, h.blade, cell * 0.3)
        ctx.restore()
      }
    }
  }
  texture.needsUpdate = true
  atlases.set(key, texture)
  return texture
}

function hashOf(s: string): number {
  let v = 2166136261
  for (let i = 0; i < s.length; i++) v = Math.imul(v ^ s.charCodeAt(i), 16777619)
  return v >>> 0
}

/** the outline of one leaf, by species. A radial function with the right
    number of lobes is what tells an oak from a lime at ten metres, and it is
    the only thing that does. */
function drawBlade(ctx: CanvasRenderingContext2D, blade: Habit['blade'], R: number): void {
  ctx.beginPath()
  if (blade === 'needle') {
    ctx.moveTo(0, 0)
    for (let i = 0; i < 9; i++) {
      const y = (i / 9 - 0.5) * R * 1.9
      ctx.rect(-R * 0.05, y, R * 0.09, R * 0.34)
      ctx.rect(R * 0.02, y + R * 0.12, R * 0.09, R * 0.34)
    }
    ctx.fill()
    return
  }
  if (blade === 'scale') {
    for (let i = 0; i < 7; i++) {
      const t = i / 7
      ctx.ellipse(0, (t - 0.5) * R * 1.7, R * (0.2 - t * 0.1), R * 0.16, 0, 0, Math.PI * 2)
    }
    ctx.fill()
    return
  }
  const steps = 48
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2
    let rr = R
    if (blade === 'lobed') rr = R * (0.62 + 0.3 * Math.abs(Math.cos(a * 3.5))) * (0.6 + 0.6 * Math.abs(Math.sin(a / 2)))
    if (blade === 'cordate') {
      const s = Math.sin(a / 2)
      rr = R * (0.55 + 0.55 * Math.pow(Math.abs(s), 0.55)) * (a > Math.PI * 0.85 && a < Math.PI * 1.15 ? 0.72 : 1)
    }
    if (blade === 'palmate') rr = R * (0.42 + 0.6 * Math.pow(Math.abs(Math.cos(a * 2.5)), 1.6))
    const x = Math.cos(a - Math.PI / 2) * rr
    const y = Math.sin(a - Math.PI / 2) * rr
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.fill()
}

/** a leaf card: two triangles whose normals are bent outward like a piece of
    a sphere, so a flat card takes the light as a volume does and does not
    flash from lit to black as the sun crosses it */
function card(size: number, cell: [number, number]): BufferGeometry {
  const geometry = new BufferGeometry()
  const half = size / 2
  const position = [-half, -half, 0, half, -half, 0, half, half, 0, -half, half, 0]
  const normal: number[] = []
  for (const [x, y] of [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ] as Array<[number, number]>) {
    const n = new Vector3(x * 0.55, y * 0.55, 1).normalize()
    normal.push(n.x, n.y, n.z)
  }
  const u0 = cell[0] * 0.5
  const v0 = cell[1] * 0.5
  const uvs = [u0, v0, u0 + 0.5, v0, u0 + 0.5, v0 + 0.5, u0, v0 + 0.5]
  geometry.setAttribute('position', new Float32BufferAttribute(position, 3))
  geometry.setAttribute('normal', new Float32BufferAttribute(normal, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  geometry.setIndex([0, 1, 2, 0, 2, 3])
  return geometry
}

function foliageMaterial(atlas: CanvasTexture): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial({
    map: atlas,
    roughness: 0.86,
    metalness: 0,
    side: DoubleSide,
  })
  /* ALPHA TEST, NOT BLENDING. A blended leaf has to be sorted, and ten
     thousand of them cannot be; an alpha-tested one casts a real shadow and
     needs no order. The cut is low enough that the leaf keeps its own soft
     edge, which is what the verdict's "hard black speckle with visible
     cutout stair-stepping" was without. */
  material.alphaTest = 0.28
  material.transparent = false
  return material
}

/* ── the tree ──────────────────────────────────────────────────────────── */

/**
 * A tree, grown. Its origin is where the trunk meets the ground, so a wing
 * puts it on the terrain by one number and it stands on it.
 */
export function treePart(bench: Bench, o: TreeOptions): Part {
  const species = o.species ?? 'oak'
  const h = HABIT[species]
  const height = o.height
  const season = o.season ?? 'october'
  const lod = o.lod ?? bench.detail()
  const r = hand(o.seed ?? 101)
  const group = new Group()
  group.name = `${species} ${height} m`

  const shoots = grow(h, height, r, lod, o.stems ?? (species === 'shrub' ? 5 : 1))
  const sides = lod >= 3 ? 6 : lod === 2 ? 5 : 4
  const barkSet = o.sets?.bark ?? h.bark
  group.add(
    body(wood(shoots, sides), bench.surface(barkSet, { roughFloor: 0.82, value: h.barkValue }), 'wood')
  )

  /* THE CROWN. Cards at every tip, and only at a tip: a card hung anywhere
     else is the "twig spray floating unattached in open sky" the verdict
     found. Each one is turned to face out of the crown, so the foliage has
     a surface rather than a fog. */
  const generated: string[] = []
  if (season !== 'bare') {
    /* A CARD GOES ON EVERY TWIG, not only on the last shoot of a branch. A
       tree grown to a thousand shoots has only a hundred and fifty true
       tips, so cards hung on tips alone leave the inside of the crown empty
       and the light comes straight through it. Every shoot thin enough to be
       a twig carries leaves, which is also what a tree does. */
    let thinnest = Infinity
    for (const s of shoots) thinnest = Math.min(thinnest, s.radius)
    const tips = shoots.filter((s) => s.parent >= 0 && s.radius <= thinnest * 2.3)
    const cells = lod >= 3 ? 4 : lod === 2 ? 2 : 1
    const size =
      h.leaf *
      Math.min(1.6, Math.max(0.6, Math.pow(height / h.nominal, 0.4))) *
      (lod >= 3 ? 1 : lod === 2 ? 1.4 : 2.1)
    const perTip = Math.max(1, Math.round(h.cards * (lod >= 3 ? 1 : lod === 2 ? 0.75 : 0.4)))
    const atlas = leafAtlas(h, season, lod >= 3 ? 512 : 256)
    const material = foliageMaterial(atlas)
    generated.push(
      `leaf atlas, ${species} in ${season}: generated for this work, regenerable from its recipe`
    )
    const buckets: Matrix4[][] = Array.from({ length: cells }, () => [])
    const centre = new Vector3(0, height * 0.62, 0)
    for (let i = 0; i < tips.length; i++) {
      const tipShoot = tips[i] as Shoot
      for (let k = 0; k < perTip; k++) {
        const out = tipShoot.p.clone().sub(centre).normalize()
        const face = out.lengthSq() > 0.1 ? out : new Vector3(0, 1, 0)
        const q = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), face)
        q.multiply(
          new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), between(r, 0, Math.PI * 2))
        )
        q.multiply(
          new Quaternion().setFromAxisAngle(
            new Vector3(1, 0, 0),
            between(r, -0.5, 0.5)
          )
        )
        const p = tipShoot.p
          .clone()
          .addScaledVector(tipShoot.dir, size * between(r, 0.05, 0.4))
          .add(
            new Vector3(
              between(r, -1, 1),
              between(r, -1, 1),
              between(r, -1, 1)
            ).multiplyScalar(size * 0.3)
          )
        const scale = between(r, 0.72, 1.22)
        const bucket = buckets[(i * 3 + k) % cells]
        if (bucket) bucket.push(new Matrix4().compose(p, q, new Vector3(scale, scale, scale)))
      }
    }
    for (let c = 0; c < cells; c++) {
      const list = buckets[c]
      if (!list || !list.length) continue
      const mesh = new InstancedMesh(card(size, [c % 2, Math.floor(c / 2)]), material, list.length)
      for (let i = 0; i < list.length; i++) mesh.setMatrixAt(i, list[i] as Matrix4)
      mesh.instanceMatrix.needsUpdate = true
      mesh.castShadow = true
      mesh.receiveShadow = true
      mesh.name = `foliage ${c + 1}`
      group.add(mesh)
    }
  }

  const part = seal(
    group,
    'tree',
    `${article(species)} ${species} of ${height} m in ${season}, ${shoots.length} shoots grown`,
    [barkSet]
  )
  part.userData.part.generated = generated
  return part
}

/** a bush: the same growth with several stems out of the ground and no bole */
export function shrubPart(bench: Bench, o: Omit<TreeOptions, 'species'> & { species?: Species }): Part {
  const made = treePart(bench, {
    ...o,
    species: o.species ?? 'shrub',
    stems: o.stems ?? 5,
  })
  made.userData.part.name = 'shrub'
  made.userData.part.says = `a bush of ${o.height} m, ${o.stems ?? 5} stems`
  return made
}

/* ── the grass ─────────────────────────────────────────────────────────── */

export interface GrassOptions {
  width: number
  depth: number
  /** blades per square metre. A lawn is 320; October meadow is 140. */
  density?: number
  /** the blade's own height, in metres */
  height?: number
  kind?: 'lawn' | 'meadow'
  season?: Season
  seed?: number
  lod?: 1 | 2 | 3
}

/**
 * A PATCH OF GRASS, as blades. "The lawn is one flat green whose only
 * incident is two straight terrain seams." A ground plane with a grass
 * photograph on it is exactly that at every distance; what makes a lawn a
 * lawn at the near edge of a frame is that the blades break the silhouette
 * against whatever is behind them. So the patch is instanced blades, one
 * draw, and the ground under it stays whatever the wing laid.
 *
 * The patch lies in the XZ plane about its own middle, on y = 0.
 */
export function grassPart(bench: Bench, o: GrassOptions): Part {
  const kind = o.kind ?? 'meadow'
  const lod = o.lod ?? bench.detail()
  const density = (o.density ?? (kind === 'lawn' ? 320 : 140)) * (lod >= 3 ? 1 : lod === 2 ? 0.5 : 0.2)
  const H = o.height ?? (kind === 'lawn' ? 0.07 : 0.34)
  const season = o.season ?? 'october'
  const r = hand(o.seed ?? 211)
  const count = Math.max(16, Math.round(o.width * o.depth * density))
  const group = new Group()
  group.name = `grass ${o.width} by ${o.depth} m`

  /* the blade: a strip that leans over under its own weight, in three or
     four segments, tapering to a point */
  const segments = lod >= 3 ? 4 : 2
  const position: number[] = []
  const uvs: number[] = []
  const index: number[] = []
  const width = H * 0.075
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    const y = H * t
    /* the bend, which is what makes a blade a blade: no lean and it is a
       spike, too much and it is a hoop */
    const z = H * 0.32 * t * t
    const w = width * (1 - t * 0.92)
    position.push(-w, y, z, w, y, z)
    uvs.push(0, t * H, w * 2, t * H)
  }
  for (let i = 0; i < segments; i++) {
    const a = i * 2
    index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
  }
  const blade = new BufferGeometry()
  blade.setAttribute('position', new Float32BufferAttribute(position, 3))
  blade.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  blade.setIndex(index)
  blade.computeVertexNormals()

  const material = bench.surface('grass-short', {
    roughFloor: 0.72,
    twoSided: true,
    value: season === 'october' ? 0.92 : 1,
    world: true,
  })
  const mesh = new InstancedMesh(blade, material, count)
  const m = new Matrix4()
  for (let i = 0; i < count; i++) {
    const x = between(r, -o.width / 2, o.width / 2)
    const z = between(r, -o.depth / 2, o.depth / 2)
    const q = new Quaternion()
      .setFromAxisAngle(new Vector3(0, 1, 0), r() * Math.PI * 2)
      .multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), between(r, -0.3, 0.3)))
    const scale = between(r, 0.6, 1.45)
    m.compose(new Vector3(x, 0, z), q, new Vector3(1, scale, scale))
    mesh.setMatrixAt(i, m)
  }
  mesh.instanceMatrix.needsUpdate = true
  mesh.castShadow = lod >= 3
  mesh.receiveShadow = true
  mesh.name = 'blades'
  group.add(mesh)

  return seal(
    group,
    'grass',
    `${count} blades over ${o.width} by ${o.depth} m, ${kind}`,
    ['grass-short']
  )
}

const article = (word: string): string => ('aeiou'.includes(word[0] ?? '') ? 'an' : 'a')

/* what a wing reaches for when it lays planting on its own ground */
export const planting = { treePart, shrubPart, grassPart, HABIT }
