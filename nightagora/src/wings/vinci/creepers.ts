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
  BufferGeometry, DataTexture, DoubleSide, Float32BufferAttribute, Group, Mesh, MeshStandardNodeMaterial, RGBAFormat, SRGBColorSpace,
} from 'three/webgpu'
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
  const stems = batch(), leaves = batch()
  const stemColour = lin('#6d6557')
  for (const run of runs) {
    const dx = run.to[0] - run.from[0], dn = run.to[1] - run.from[1], span = Math.hypot(dx, dn)
    const ux = dx / span, un = dn / span
    let at = .8 + random() * 3
    while (at < span - .8) {
      const width = Math.min(span - at, 1.6 + random() * 2.8), reach = .45 + random() * .5
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
  function growPatch(run: Run, along: number, width: number, reach: number, ux: number, un: number, span: number): void {
    const out: V3 = [run.low[0], 0, -run.low[1]]
    // THE MAT: an old patch is a solid mass of leaf, densest in its core and
    // ragged at its edge, spreading as it climbs
    const lobes = [random() * 6.28, random() * 6.28, random() * 6.28]
    const centreH = foot(run, along, ux, un).height * reach * .5
    const matCount = Math.round(width * foot(run, along, ux, un).height * reach * 450)
    for (let k = 0; k < matCount; k++) {
      const u = (random() - .5) * 2, v = random()
      const s = along + u * width / 2
      if (s < .05 || s > span - .05) continue
      const here = foot(run, s, ux, un)
      const h = v * here.height * reach * (.75 + .5 * random())
      if (h > here.height - .08) continue
      // a ragged outline: a lobed ellipse, wider toward the top of the patch
      const ang = Math.atan2(h - centreH, u * width / 2)
      const edge = .8 + .12 * Math.sin(ang * 3 + lobes[0]!) + .08 * Math.sin(ang * 5 + lobes[1]!)
      const rr = Math.hypot(u * (.85 + .3 * v), (v - .5) * 2)
      if (rr > edge || random() > 1.15 - rr * rr) continue
      leaf(run, ux, un, s, h, out, random() < .5 ? 1 : -1, h > here.height - .45 && random() < .6)
    }
    const roots = Math.max(3, Math.round(width / .5))
    for (let k = 0; k < roots; k++) {
      let s = along - width / 2 + (k + random()) * width / roots
      let h = 0
      const here = foot(run, s, ux, un)
      const top = here.height * reach * (.7 + random() * .5)
      let drift = (random() - .5) * .6, branchIn = .3 + random() * .3
      const stemWidth = .004 + random() * .005
      let leafIn = random() * .06, side = 1
      for (let step = 0; step < 140 && h < Math.min(here.height - .06, top); step++) {
        const s0 = s, h0 = h
        drift = Math.max(-.9, Math.min(.9, drift + (random() - .5) * .35))
        s += drift * .03; h += .045
        if (s < 0 || s > span) break
        // the stem is laid every second step: at a stop's distance a 9 cm
        // chord of a wandering stem is still its curve
        if (step % 2 === 1) ribbon(point(run, ux, un, s0 - drift * .03, h0 - .045, .012), point(run, ux, un, s, h, .012), stemWidth * (1 - h / (here.height + .2) * .5), out)
        branchIn -= .045
        if (branchIn <= 0) { sideShoot(run, ux, un, s, h, span, out, top, here.height); branchIn = .3 + random() * .3 }
        leafIn -= .045
        if (leafIn <= 0) { side = -side; leaf(run, ux, un, s, h, out, side, h > top * .82 || h > here.height - .3); leafIn = .05 + random() * .04 }
      }
    }
  }
  function sideShoot(run: Run, ux: number, un: number, s0: number, h0: number, span: number, out: V3, top: number, height: number): void {
    let s = s0, h = h0, leafIn = .04, side = 1
    const dir = random() < .5 ? -1 : 1, length = .3 + random() * .9
    for (let t = 0; t < length && s > 0 && s < span && h < Math.min(height - .08, top * 1.05); t += .08) {
      const a = point(run, ux, un, s, h, .014)
      s += dir * .07; h += .024 + random() * .04
      ribbon(a, point(run, ux, un, s, h, .014), .005, out)
      leafIn -= .08
      if (leafIn <= 0) { side = -side; leaf(run, ux, un, s, h, out, side, h > top * .85); leafIn = .06 + random() * .05 }
    }
  }
  /** a point on the wall's face: along it by s, up from the meadow by h */
  function point(run: Run, ux: number, un: number, s: number, h: number, off: number): V3 {
    const e = run.from[0] + ux * s + run.low[0] * off, n = run.from[1] + un * s + run.low[1] * off
    return [e, foot(run, s, ux, un).base + h, -n]
  }
  function ribbon(a: V3, b: V3, w: number, out: V3): void {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2]
    // across the stem, in the wall's plane
    const cx = dy * out[2] - dz * out[1], cy = dz * out[0] - dx * out[2], cz = dx * out[1] - dy * out[0], cl = Math.hypot(cx, cy, cz) || 1
    const px = cx / cl * w / 2, py = cy / cl * w / 2, pz = cz / cl * w / 2
    const k = .85 + random() * .3
    quad(stems, [[a[0] - px, a[1] - py, a[2] - pz], [a[0] + px, a[1] + py, a[2] + pz], [b[0] + px, b[1] + py, b[2] + pz], [b[0] - px, b[1] - py, b[2] - pz]],
      out, [stemColour[0] * k, stemColour[1] * k, stemColour[2] * k], 0)
  }
  function leaf(run: Run, ux: number, un: number, s: number, h: number, out: V3, side: number, old: boolean): void {
    // the petiole holds the blade off the stone, up and to one side
    const off = .02 + random() * .06, size = (old ? .085 : .075) + random() * .065
    const base = point(run, ux, un, s + side * .02, h + .01, off)
    const along: V3 = [ux * side, 0, -un * side]
    // the blade faces out and a little up, tipped to its own side
    const up = .05 + random() * .35
    let fx = out[0] + along[0] * (random() - .5) * .5, fy = up, fz = out[2] + along[2] * (random() - .5) * .5
    const fl = Math.hypot(fx, fy, fz); fx /= fl; fy /= fl; fz /= fl
    // the blade's own up: along the wall and upward, at right angles to its face
    let bx = along[0] * .4, by = 1, bz = along[2] * .4
    const dot = bx * fx + by * fy + bz * fz
    bx -= fx * dot; by -= fy * dot; bz -= fz * dot
    const bl = Math.hypot(bx, by, bz); bx /= bl; by /= bl; bz /= bl
    const rx = by * fz - bz * fy, ry = bz * fx - bx * fz, rz = bx * fy - by * fx
    const half = size / 2
    const corner = (u: number, v: number): V3 => [base[0] + rx * u * half + bx * v * size, base[1] + ry * u * half + by * v * size, base[2] + rz * u * half + bz * v * size]
    const cell = old ? 2 : random() < .6 ? 0 : 1
    const k = .82 + random() * .3
    quad(leaves, [corner(-1, 0), corner(1, 0), corner(1, 1), corner(-1, 1)], [fx, fy, fz], [k, k * (.98 + random() * .06), k], cell)
    // October: the old growth at the top carries its flower heads
    if (old && random() < .28) {
      const head = point(run, ux, un, s - side * .02, h + .05, off + .03)
      const hs = .05 + random() * .025
      quad(leaves, [[head[0] - rx * hs, head[1] - ry * hs, head[2] - rz * hs], [head[0] + rx * hs, head[1] + ry * hs, head[2] + rz * hs],
        [head[0] + rx * hs + bx * hs * 2, head[1] + ry * hs + by * hs * 2, head[2] + rz * hs + bz * hs * 2],
        [head[0] - rx * hs + bx * hs * 2, head[1] - ry * hs + by * hs * 2, head[2] - rz * hs + bz * hs * 2]], [fx, fy, fz], [1, 1, 1], 3)
    }
  }

  for (const [b, name, glossy] of [[stems, 'vinci generated ivy stems', false], [leaves, 'vinci generated ivy leaves', true]] as const) {
    if (!b.position.length) continue
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(b.position, 3))
    geometry.setAttribute('normal', new Float32BufferAttribute(b.normal, 3))
    geometry.setAttribute('color', new Float32BufferAttribute(b.colour, 3))
    geometry.setAttribute('uv', new Float32BufferAttribute(b.uv, 2))
    geometry.computeBoundingSphere()
    const material = new MeshStandardNodeMaterial({ vertexColors: true, roughness: glossy ? .48 : .9, side: DoubleSide, alphaTest: glossy ? .45 : 0 })
    if (glossy) { material.alphaToCoverage = true; material.colorNode = texture(ivyAtlas(), uv()) }
    material.name = name
    material.userData = { ...creepersProvenance }
    const mesh = new Mesh(geometry, material)
    mesh.name = name
    mesh.receiveShadow = true
    mesh.castShadow = false
    mesh.userData = { manifestId: creepersProvenance.manifestId, labelOccluder: false }
    group.add(mesh)
  }
  group.userData['leaves'] = leaves.position.length / 18
  return group
}
