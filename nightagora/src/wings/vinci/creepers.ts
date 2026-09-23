/* IVY ON THE GARDEN SIDE.

   A retaining wall forty-six years old on the garden side of a house carries
   ivy where nobody cuts it back: patches rooted in the meadow at its foot,
   climbing the stone in wandering stems, the young growth in lobed leaves
   held out from the wall to the light, the old growth at the top in whole
   leaves carrying October's flower heads, the only thing in flower that week.
   Evergreen, it holds the green when the trees have turned. Never on the
   house's own facades; never where a walk runs beside the wall. Ivy is a
   type of the period on a wall of this kind, its patches this exhibition's
   placing. */
import {
  BufferGeometry, DataTexture, DoubleSide, Float32BufferAttribute, Group, Mesh, MeshBasicNodeMaterial, MeshStandardNodeMaterial, RGBAFormat, SRGBColorSpace,
} from 'three/webgpu'
import { SHADOW_ONLY_LAYER } from '../../stack/light'
import { texture, uv } from 'three/tsl'
import type { TierName } from '../../stack/tier'
import { floorAt, terrainSteps } from './terrain-mesh'
import { stageWeight } from './leaf-litter'
import { mulberry } from './tree-growth'
import { coverageMips } from './grass-maps'

export const creepersProvenance = {
  manifestId: 'vinci/creepers',
  assetClass: 'GENERATED',
  certainty: 'conjectural',
  recipe: 'Ivy (Hedera helix) as a type of the period on the garden face of the terrace wall: patches rooted at the wall foot in the meadow, stems climbing the face, lobed juvenile leaves 40 to 90 mm held 20 to 70 mm off the stone, whole adult leaves and flower heads at the wall top. Leaf and flower maps drawn from recipes in code. Only on old walls with meadow at their foot, never on the house facades, never beside a walk.',
} as const

type V3 = [number, number, number]
const CELL = 128, COLUMNS = 4, ROWS = 1
const cellUV = (cell: number) => ({ u0: cell / COLUMNS, v0: 0, du: 1 / COLUMNS, dv: 1 })
const lin = (hex: string): V3 => {
  const n = parseInt(hex.slice(1), 16)
  const c = (v: number): number => { const s = v / 255; return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4 }
  return [c((n >> 16) & 255), c((n >> 8) & 255), c(n & 255)]
}
const srgb = (v: number): number => Math.round((v <= .0031308 ? v * 12.92 : 1.055 * Math.pow(Math.min(1, v), 1 / 2.4) - .055) * 255)

let atlas: DataTexture | undefined
/** Ivy as maps: a five-lobed and a three-lobed young leaf, a whole old leaf,
    and an umbel of the flowers it carries in October. */
function ivyAtlas(): DataTexture {
  if (atlas) return atlas
  if (typeof document === 'undefined') { const t = new DataTexture(new Uint8Array([60, 80, 40, 255]), 1, 1, RGBAFormat); t.needsUpdate = true; return (atlas = t) }
  const W = CELL * COLUMNS, H = CELL * ROWS, data = new Uint8Array(W * H * 4)
  const leafGreen = lin('#33461f'), vein = lin('#7f8c5e'), flowerGreen = lin('#9aa04e'), flowerCentre = lin('#6b6a2f')
  for (let cell = 0; cell < COLUMNS; cell++) for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) {
    let cover = 0
    // four samples a texel for a clean edge
    let cr = 0, cg = 0, cb = 0
    for (let sy = 0; sy < 2; sy++) for (let sx = 0; sx < 2; sx++) {
      const px = (x + .25 + sx * .5) / CELL - .5, py = 1 - (y + .25 + sy * .5) / CELL
      let a = 0, c: V3 = leafGreen
      if (cell < 3) {
        // the petiole enters at the base; the blade's outline by bearing
        const bx = px, by = py - .22
        const r = Math.hypot(bx, by), th = Math.atan2(bx, by)
        let reach: number
        if (cell === 2) {
          // an old leaf: whole, ovate to rhombic
          reach = .34 * Math.pow(Math.max(0, Math.cos(th * .9)), .6) * (th > 2.6 || th < -2.6 ? .5 : 1) + .06
        } else {
          const lobes = cell === 0 ? [[0, 1], [1.2, .72], [-1.2, .72], [2.2, .45], [-2.2, .45]] : [[0, 1], [1.05, .66], [-1.05, .66]]
          reach = .14
          for (const [angle, length] of lobes) reach = Math.max(reach, .36 * length! * Math.pow(Math.max(0, Math.cos((th - angle!) * 1.6)), 1.4))
        }
        a = r < reach ? 1 : 0
        if (py < .22 && Math.abs(px) < .012) a = 1
        // pale veins run from the base out into each lobe
        const veinLine = cell === 2 ? Math.abs(bx) < .01 : [0, 1.2, -1.2, 2.2, -2.2].some(an => Math.abs(Math.sin(th - an)) * r < .008 && Math.cos(th - an) > 0)
        c = veinLine ? vein : leafGreen
        const shade = .82 + .18 * Math.min(1, r / Math.max(.05, reach))
        c = [c[0] * shade, c[1] * shade, c[2] * shade]
      } else {
        // an umbel: a ball of small flowers on radiating stalks
        const fx = px, fy = py - .55
        for (let k = 0; k < 22; k++) {
          const ang = k * 2.39996, rad = .18 * Math.sqrt((k + .5) / 22)
          const cx = Math.cos(ang) * rad, cy = Math.sin(ang) * rad * .8
          const d = Math.hypot(fx - cx, fy - cy)
          if (d < .045) { a = 1; c = d < .02 ? flowerCentre : flowerGreen }
        }
        if (Math.abs(px) < .01 && py < .55 && py > .02) { a = 1; c = lin('#55643a') }
      }
      cover += a / 4; cr += c[0] * a / 4; cg += c[1] * a / 4; cb += c[2] * a / 4
    }
    const i = (y * W + cell * CELL + x) * 4
    const k = cover > 0 ? 1 / cover : 0
    data[i] = srgb(cr * k); data[i + 1] = srgb(cg * k); data[i + 2] = srgb(cb * k); data[i + 3] = Math.round(cover * 255)
  }
  const t = coverageMips(data, W, H, COLUMNS, ROWS)
  t.colorSpace = SRGBColorSpace; t.name = 'vinci generated ivy atlas'
  return (atlas = t)
}

interface Batch { position: number[]; normal: number[]; colour: number[]; uv: number[] }
const batch = (): Batch => ({ position: [], normal: [], colour: [], uv: [] })
function quad(b: Batch, corners: readonly V3[], normal: V3, colour: V3, cell: number): void {
  const { u0, du } = cellUV(cell)
  const uvs = [[u0, 1], [u0 + du, 1], [u0 + du, 0], [u0, 0]]
  for (const i of [0, 1, 2, 0, 2, 3]) {
    const p = corners[i]!
    b.position.push(p[0], p[1], p[2]); b.normal.push(normal[0], normal[1], normal[2])
    b.colour.push(colour[0], colour[1], colour[2]); b.uv.push(uvs[i]![0]!, uvs[i]![1]!)
  }
}

/** A run of wall: its ends, the side the meadow lies on, and its top. */
interface Run { from: [number, number]; to: [number, number]; low: [number, number]; top: number }

/** The garden faces ivy may take: old retaining faces over meadow that a
    stop sees, never the museum's own and never beside a walk; the terrain's
    sections of one wall joined back into runs. */
function gardenRuns(onWalk: (e: number, n: number) => boolean): Run[] {
  const runs: Run[] = []
  for (const s of terrainSteps()) {
    if (s.modern || s.height < .8) continue
    const last = runs[runs.length - 1]
    if (last && Math.hypot(last.to[0] - s.from[0], last.to[1] - s.from[1]) < .05 && last.low[0] * s.low[0] + last.low[1] * s.low[1] > .99 && Math.abs(last.top - s.highLevel) < .05)
      last.to = [s.to[0], s.to[1]]
    else runs.push({ from: [s.from[0], s.from[1]], to: [s.to[0], s.to[1]], low: [s.low[0], s.low[1]], top: s.highLevel })
  }
  // a run a stop sees, with meadow and no walk along its foot
  return runs.filter(r => {
    const span = Math.hypot(r.to[0] - r.from[0], r.to[1] - r.from[1])
    if (span < 1.5) return false
    const at = (t: number): [number, number] => [r.from[0] + (r.to[0] - r.from[0]) * t + r.low[0] * 1.2, r.from[1] + (r.to[1] - r.from[1]) * t + r.low[1] * 1.2]
    const mid = at(.5)
    return stageWeight(mid[0], mid[1]) > .3 && [.2, .5, .8].filter(t => !onWalk(...at(t))).length >= 2
  })
}

export function createCreepers(tier: TierName, onWalk: (e: number, n: number) => boolean): Group {
  const group = new Group()
  group.name = 'vinci generated ivy'
  group.userData = { ...creepersProvenance }
  if (tier !== 'hero') return group
  const runs = gardenRuns(onWalk)
  const random = mulberry(15171051)
  const wood = batch(), leaves = batch()
  const shade: number[] = [], shadeNormal: number[] = []
  const stemColour = lin('#6d6557')
  let leafCount = 0
  for (const run of runs) {
    const dx = run.to[0] - run.from[0], dn = run.to[1] - run.from[1], span = Math.hypot(dx, dn)
    const ux = dx / span, un = dn / span
    let at = .8 + random() * 3
    while (at < span - .8) {
      const width = Math.min(span - at, 1.6 + random() * 2.8), reach = .5 + random() * .45
      const e = run.from[0] + ux * (at + width / 2) + run.low[0] * 1.2, n = run.from[1] + un * (at + width / 2) + run.low[1] * 1.2
      if (!onWalk(e, n) && stageWeight(e, n) > .2 && foot(run, at + width / 2, ux, un).height > 1) growPatch(run, at + width / 2, width, reach, ux, un, span)
      at += width + 1.2 + random() * 4
    }
  }

  /** the meadow's level at the wall's foot, and the wall's height there */
  function foot(run: Run, s: number, ux: number, un: number): { base: number; height: number } {
    const e = run.from[0] + ux * s + run.low[0] * .12, n = run.from[1] + un * s + run.low[1] * .12
    const base = floorAt(e, n)
    return { base, height: run.top - base }
  }
  /** a point on the wall's face: along it by s, up from the meadow by h, off it by `off` */
  function point(run: Run, ux: number, un: number, s: number, h: number, off: number): V3 {
    const e = run.from[0] + ux * s + run.low[0] * off, n = run.from[1] + un * s + run.low[1] * off
    return [e, foot(run, s, ux, un).base + h, -n]
  }

  /** ONE PLANT: a root cluster at the wall's foot, woody stems fanning up the
      stone and forking, and a mat of leaves held off the wall in layers,
      densest and darkest in its middle, larger toward its top. */
  function growPatch(run: Run, centre: number, width: number, reach: number, ux: number, un: number, span: number): void {
    const out: V3 = [run.low[0], 0, -run.low[1]]
    const here = foot(run, centre, ux, un)
    const top = Math.min(here.height - .08, here.height * reach)
    // the stems, as polylines on the face: (s, h, radius)
    const stems: { s: number; h: number; r: number }[][] = []
    const mains = 3 + Math.floor(random() * 4)
    for (let k = 0; k < mains; k++) {
      // they leave the ground within a hand's breadth of each other and fan out
      let s = centre + (random() - .5) * .3, h = -.02
      const aim = centre + (k / Math.max(1, mains - 1) - .5) * width * .6 + (random() - .5) * .2
      const goal = top * (.5 + random() * .4)
      const line: { s: number; h: number; r: number }[] = []
      for (let i = 0; i < 40 && h < goal; i++) {
        const lean = (aim - s) * .16 + (random() - .5) * .07
        s += lean; h += .12
        if (s < .05 || s > span - .05) break
        line.push({ s, h, r: .02 * (1 - h / (top + .3) * .7) })
      }
      if (line.length > 2) stems.push(line)
      // forks off the main stem, thinner, reaching sideways and up
      for (const [i, p] of line.entries()) {
        if (i < 2 || random() > .24) continue
        let fs = p.s, fh = p.h
        const dir = random() < .5 ? -1 : 1, fork: { s: number; h: number; r: number }[] = [{ s: fs, h: fh, r: p.r * .6 }]
        for (let j = 0; j < 7; j++) {
          // a fork keeps inside the mat it feeds
          fs += dir * (.06 + random() * .04); fh += .06 + random() * .08
          const half = width / 2 * (.3 + .7 * Math.pow(Math.min(1, fh / Math.max(top, .1)), .55)) * .85
          if (fs < .05 || fs > span - .05 || fh > top * .95 || Math.abs(fs - centre) > half) break
          fork.push({ s: fs, h: fh, r: p.r * .6 * (1 - j / 8) })
        }
        if (fork.length > 2) stems.push(fork)
      }
    }
    for (const line of stems) tube(line, run, ux, un, out)
    // THE MAT: leaves layered off the stone, a fan that widens as it climbs
    // from the root and frays at its edge
    const lobes = [random() * 6.28, random() * 6.28, random() * 6.28]
    const count = Math.round(width * top * 470)
    for (let k = 0; k < count; k++) {
      const v = Math.pow(random(), .8), u = (random() - .5) * 2
      const h = v * top
      // the fan's half width at this height, ragged by slow lobes
      const fan = (.3 + .7 * Math.pow(v, .55)) * (.86 + .09 * Math.sin(v * 9 + lobes[0]!) + .05 * Math.sin(u * 7 + lobes[1]!))
      if (Math.abs(u) > fan) continue
      const s = centre + u * width / 2
      if (s < .05 || s > span - .05) continue
      const rim = Math.abs(u) / fan, crown = v > .88 ? (v - .88) / .12 : 0
      if (random() < rim * rim * .7 + crown * .6) continue
      const core = (1 - rim) * (1 - crown)
      const off = .012 + core * random() * .11 + random() * .014
      const old = v > .55 && random() < .55
      leaf(run, ux, un, s, h, off, core, old, out)
    }
  }
  function tube(line: { s: number; h: number; r: number }[], run: Run, ux: number, un: number, out: V3): void {
    const sides = 3
    const rings = line.map(p => {
      const c = point(run, ux, un, p.s, p.h, p.r + .004)
      return { c, r: p.r }
    })
    for (let i = 0; i < rings.length - 1; i++) {
      const a = rings[i]!, b = rings[i + 1]!
      const d: V3 = [b.c[0] - a.c[0], b.c[1] - a.c[1], b.c[2] - a.c[2]]
      // the ring's frame: out of the wall, and across the stem in the wall
      const across: V3 = [d[1] * out[2] - d[2] * out[1], d[2] * out[0] - d[0] * out[2], d[0] * out[1] - d[1] * out[0]]
      const al = Math.hypot(across[0], across[1], across[2]) || 1
      const k = .85 + random() * .25
      const colour: V3 = [stemColour[0] * k, stemColour[1] * k, stemColour[2] * k]
      for (let j = 0; j < sides; j++) {
        const a0 = j / sides * Math.PI * 2, a1 = (j + 1) / sides * Math.PI * 2
        const dir = (t: number): V3 => [out[0] * Math.cos(t) + across[0] / al * Math.sin(t), out[1] * Math.cos(t) + across[1] / al * Math.sin(t), out[2] * Math.cos(t) + across[2] / al * Math.sin(t)]
        const p = (c: V3, r: number, t: number): V3 => { const n = dir(t); return [c[0] + n[0] * r, c[1] + n[1] * r, c[2] + n[2] * r] }
        const n0 = dir((a0 + a1) / 2)
        const q = [p(a.c, a.r, a0), p(a.c, a.r, a1), p(b.c, b.r, a1), p(b.c, b.r, a0)]
        for (const idx of [0, 1, 2, 0, 2, 3]) {
          const v = q[idx]!
          wood.position.push(v[0], v[1], v[2]); wood.normal.push(n0[0], n0[1], n0[2]); wood.colour.push(colour[0], colour[1], colour[2]); wood.uv.push(0, 0)
        }
      }
    }
  }
  function leaf(run: Run, ux: number, un: number, s: number, h: number, off: number, core: number, old: boolean, out: V3): void {
    const size = (old ? .085 : .07) + random() * .06 + core * .03
    const base = point(run, ux, un, s, h, off)
    const side = random() < .5 ? 1 : -1
    const along: V3 = [ux * side, 0, -un * side]
    // the blade looks out from the wall, a little up to the light, lying
    // over the one below it like a shingle
    const up = .05 + random() * .25
    let fx = out[0] + along[0] * (random() - .5) * .35, fy = up, fz = out[2] + along[2] * (random() - .5) * .35
    const fl = Math.hypot(fx, fy, fz); fx /= fl; fy /= fl; fz /= fl
    let bx = along[0] * .4 * (random() - .5), by = 1, bz = along[2] * .4 * (random() - .5)
    const dot = bx * fx + by * fy + bz * fz
    bx -= fx * dot; by -= fy * dot; bz -= fz * dot
    const bl = Math.hypot(bx, by, bz); bx /= bl; by /= bl; bz /= bl
    const rx = by * fz - bz * fy, ry = bz * fx - bx * fz, rz = bx * fy - by * fx
    const half = size / 2
    // hanging from its stalk: the blade's base a little above its middle
    const corner = (cu: number, cv: number): V3 => [base[0] + rx * cu * half + bx * (cv - .35) * size, base[1] + ry * cu * half + by * (cv - .35) * size, base[2] + rz * cu * half + bz * (cv - .35) * size]
    const cell = old ? 2 : random() < .6 ? 0 : 1
    // deeper in the mat less sky reaches a leaf; a few in the sun go bronze
    const depth = 1 - Math.min(1, off / .18)
    const k = (.62 + .38 * (1 - depth * core)) * (.9 + random() * .2)
    const bronze = random() < .06
    const tint: V3 = bronze ? [k * 1.25, k * .85, k * .7] : [k, k * (.98 + random() * .06), k * (.95 + random() * .06)]
    const corners = [corner(-1, 0), corner(1, 0), corner(1, 1), corner(-1, 1)]
    quad(leaves, corners, [fx, fy, fz], tint, cell)
    leafCount++
    // its shadow on the stone: every second leaf throws one opaque triangle
    // of twice the area, so the mat's shadow keeps its weight
    if (leafCount % 2 === 0) for (const [cu, cv] of [[0, -.05], [.88, .9], [-.88, .9]] as const) {
      const v = corner(cu, cv)
      shade.push(v[0], v[1], v[2]); shadeNormal.push(fx, fy, fz)
    }
    // October: the old growth carries its flower heads
    if (old && random() < .22) {
      const head = point(run, ux, un, s - side * .02, h + .05, off + .03)
      const hs = .05 + random() * .025
      quad(leaves, [[head[0] - rx * hs, head[1] - ry * hs, head[2] - rz * hs], [head[0] + rx * hs, head[1] + ry * hs, head[2] + rz * hs],
        [head[0] + rx * hs + bx * hs * 2, head[1] + ry * hs + by * hs * 2, head[2] + rz * hs + bz * hs * 2],
        [head[0] - rx * hs + bx * hs * 2, head[1] - ry * hs + by * hs * 2, head[2] - rz * hs + bz * hs * 2]], [fx, fy, fz], [1, 1, 1], 3)
    }
  }

  const make = (b: Batch, name: string, material: MeshStandardNodeMaterial, casts: boolean): void => {
    if (!b.position.length) return
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(b.position, 3))
    geometry.setAttribute('normal', new Float32BufferAttribute(b.normal, 3))
    geometry.setAttribute('color', new Float32BufferAttribute(b.colour, 3))
    geometry.setAttribute('uv', new Float32BufferAttribute(b.uv, 2))
    geometry.computeBoundingSphere()
    material.name = name
    material.userData = { ...creepersProvenance }
    const mesh = new Mesh(geometry, material)
    mesh.name = name
    mesh.receiveShadow = true
    mesh.castShadow = casts
    mesh.userData = { manifestId: creepersProvenance.manifestId, labelOccluder: false }
    group.add(mesh)
  }
  make(wood, 'vinci generated ivy stems', new MeshStandardNodeMaterial({ vertexColors: true, roughness: .9 }), true)
  const leafMaterial = new MeshStandardNodeMaterial({ vertexColors: true, roughness: .45, side: DoubleSide, alphaTest: .45 })
  leafMaterial.alphaToCoverage = true
  leafMaterial.colorNode = texture(ivyAtlas(), uv())
  make(leaves, 'vinci generated ivy leaves', leafMaterial, false)
  if (shade.length) {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(shade, 3))
    geometry.setAttribute('normal', new Float32BufferAttribute(shadeNormal, 3))
    geometry.computeBoundingSphere()
    const material = new MeshBasicNodeMaterial({ colorWrite: false, depthWrite: false, side: DoubleSide })
    material.shadowSide = DoubleSide
    const mesh = new Mesh(geometry, material)
    mesh.name = 'vinci generated ivy shadows'
    mesh.castShadow = true
    mesh.receiveShadow = false
    mesh.layers.set(SHADOW_ONLY_LAYER)
    mesh.userData = { manifestId: creepersProvenance.manifestId, labelOccluder: false }
    group.add(mesh)
  }
  group.userData['leaves'] = leafCount
  return group
}
