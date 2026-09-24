/** THE LEDGER SLAB, CUT AS A MASON CUTS IT.
 *
 * The slab's one inscription is the name the record gives it, LEONARDO DA
 * VINCI, and nothing else. It is cut into a pale honed limestone, not laid on
 * it: the face opens over each line, the stone left standing between the
 * letters is rebuilt at the face in two courses (a splayed mouth that takes
 * the light, a wall under it in shadow), and a dark filling lies in the bottom
 * of every cut, as ledger stones are filled so a name reads across a floor.
 * The method is the museum's own cut inscription (`words/index.ts`), turned to
 * lie face up. The dimensions are an exhibition study, not a survey of the
 * tomb in Saint-Hubert.
 */
import {
  BoxGeometry, BufferGeometry, Color, ExtrudeGeometry, Float32BufferAttribute, Matrix4, MeshStandardNodeMaterial, Path,
  Quaternion, Shape, Vector2, Vector3,
} from 'three/webgpu'
import * as TSL from 'three/tsl'
import { reliefNormal, resolved, specularAA, surfaceDetail } from '../../../stack/detail'
import { cutGlyphs, stoneWeb, type WebRect } from '../words'
import { applyCourtLight } from './court-light'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any
const { cameraViewMatrix, float, mix, mx_noise_float, normalWorldGeometry, positionWorld, smoothstep, vec3 } = TSL as unknown as Record<string, N>

/** THE NAME'S LAYOUT on the slab's face, in metres: two lines, each as wide
 * as the face lets it be read from the court's open side. */
export const LEDGER_NAME = {
  lines: ['LEONARDO', 'DA VINCI'] as const,
  cap: .27, lineHeight: 1.62,
  /** the block's middle, from the slab's middle toward its foot */
  towardFoot: .35,
  margin: .12,
} as const

const linear = (hex: string): [number, number, number] => { const c = new Color(hex); return [c.r, c.g, c.b] }

/** A pale, fine, honed limestone: a stone chosen paler than the court's flags
 * so the slab is the lightest thing on the floor under the court's sky. */
export function ledgerStone(): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial({ roughness: .5, metalness: 0 })
  const P = positionWorld, n = normalWorldGeometry
  const d = surfaceDetail({ scales: [.5, .06, .003], figure: [.08, .05, .035], relief: .0006 })
  // shell fragments and a bedding in the honed face, and the grime a stone
  // set out in a court keeps along its edges, where the leaves lie
  const shell = smoothstep(.7, .84, mx_noise_float(P.mul(38)).mul(.5).add(.5)).mul(resolved(.03, d.pixel))
  const bedding = mx_noise_float(P.mul(vec3(.9, 7, .45))).mul(resolved(.1, d.pixel))
  const top = smoothstep(.6, .9, n.y)
  const toEdge = float(.99).sub(P.z.negate().add(25.95).abs()).min(float(1.775).sub(P.x.add(54.85).abs()))
  // (the slab's place in the wing; a stage that sets it elsewhere keeps none)
  const grime = float(1).sub(smoothstep(.0, .09, toEdge)).mul(smoothstep(-.002, 0, toEdge)).mul(top)
  const c = vec3(...linear('#c9c1ad')).mul(d.tone).mul(float(1).add(bedding.mul(.06)).sub(shell.mul(.1)))
    .mul(float(1).sub(grime.mul(.14)))
  m.colorNode = c
  applyCourtLight(m, c)
  // honed on its face, sawn on its sides
  m.roughnessNode = specularAA(mix(float(.72), float(.46), top).add(d.rough).add(shell.mul(.08)), d.lost)
  m.normalNode = reliefNormal(n.transformDirection(cameraViewMatrix), d.heightM, .15)
  m.name = 'vinci/grave/ledger-limestone'
  return m
}

/** The filling in the cut: a dull warm black. */
export function ledgerFilling(): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial({ roughness: .9, metalness: 0 })
  m.colorNode = vec3(...linear('#2a2622'))
  m.name = 'vinci/grave/ledger-filling'
  return m
}

/** The web as surfaces: a front face and the two walls that make a letter's
 * flanks, in panel space (x across, y up the letter, z out of the stone). */
function webSurface(courses: { rects: WebRect[]; front: number; depth: number }[]): BufferGeometry {
  let count = 0
  for (const course of courses) count += course.rects.length * 18
  const position = new Float32Array(count * 3), normal = new Float32Array(count * 3), uv = new Float32Array(count * 2)
  let v = 0
  const put = (x: number, y: number, z: number, nx: number, ny: number, nz: number): void => {
    position[v * 3] = x; position[v * 3 + 1] = y; position[v * 3 + 2] = z
    normal[v * 3] = nx; normal[v * 3 + 1] = ny; normal[v * 3 + 2] = nz
    uv[v * 2] = x; uv[v * 2 + 1] = y
    v++
  }
  const quad = (a: number[], b: number[], c: number[], d: number[], n: number[]): void => {
    for (const p of [a, b, c, a, c, d]) put(p[0]!, p[1]!, p[2]!, n[0]!, n[1]!, n[2]!)
  }
  for (const course of courses) {
    const back = course.front - course.depth
    for (const r of course.rects) {
      const x0 = r.x, x1 = r.x + r.w, y0 = r.y, y1 = r.y + r.h, z = course.front
      quad([x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], [0, 0, 1])
      quad([x0, y0, back], [x0, y0, z], [x0, y1, z], [x0, y1, back], [-1, 0, 0])
      quad([x1, y0, z], [x1, y0, back], [x1, y1, back], [x1, y1, z], [1, 0, 0])
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(position, 3))
  geometry.setAttribute('normal', new Float32BufferAttribute(normal, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  return geometry
}

export interface LedgerFace {
  /** the dressed face with its openings, and the web between the letters */
  stone: BufferGeometry[]
  /** the filling at the bottom of every cut */
  filling: BufferGeometry[]
  lines: readonly string[]
}

/** THE FACE OF THE SLAB, with the name cut into it. The face is `width` by
 * `length`, lies face up at `top` and is `depth` thick; its head (+y in panel
 * space) points away from the visitor, toward local -z. */
export function cutLedgerFace(o: {
  centre: [number, number]; top: number; width: number; length: number; depth: number
  lines?: readonly string[]; cap?: number
}): LedgerFace {
  const lines = o.lines ?? LEDGER_NAME.lines
  const cap = o.cap ?? LEDGER_NAME.cap
  const step = cap * LEDGER_NAME.lineHeight
  const blockHeight = cap + step * (lines.length - 1)
  const blockTop = -LEDGER_NAME.towardFoot + blockHeight / 2
  const usable = o.width - LEDGER_NAME.margin * 2
  const hw = o.width / 2, hl = o.length / 2
  const face = new Shape()
  face.moveTo(-hw, -hl); face.lineTo(hw, -hl); face.lineTo(hw, hl); face.lineTo(-hw, hl); face.closePath()
  const stone: BufferGeometry[] = [], filling: BufferGeometry[] = []
  lines.forEach((line, index) => {
    const cut = cutGlyphs(line, cap, usable, 1.4)
    if (!cut.glyphs.length) return
    const left = -cut.width / 2, top = blockTop - index * step
    // each line's field stays clear of the next one's: two openings that
    // overlap are one face cut twice
    const pad = Math.min(cap * .15, (step - cut.height) / 2 - .01)
    const field = { x0: left - pad, x1: left + cut.width + pad, y0: top - cut.height - pad, y1: top + pad }
    const opening = new Path()
    opening.moveTo(field.x0, field.y0); opening.lineTo(field.x1, field.y0); opening.lineTo(field.x1, field.y1); opening.lineTo(field.x0, field.y1)
    opening.closePath()
    face.holes.push(opening)
    const placed = cut.glyphs.map(glyph => ({
      outer: glyph.outer.map(p => new Vector2(p.x + left, p.y + top)),
      counters: glyph.counters.map(c => c.map(p => new Vector2(p.x + left, p.y + top))),
    }))
    // the splayed mouth, 3.5 mm wider than the walls under it: the ledge that
    // takes the court's sky while the wall below stays in shadow
    // rows of 5 mm: a letter 0.27 m high keeps its outline and the face
    // keeps its triangles
    const band = Math.max(.0022, cap * .019)
    stone.push(webSurface([
      { rects: stoneWeb(field, placed, band, .0035), front: 0, depth: .005 },
      { rects: stoneWeb(field, placed, band), front: -.0048, depth: .009 },
    ]))
    // the filling is brought up to just under the face, as a ledger's letters
    // are filled, so the name reads from a standing eye and not only from above
    const floor = new BoxGeometry(field.x1 - field.x0 - .008, field.y1 - field.y0 - .008, .003)
    floor.translate((field.x0 + field.x1) / 2, (field.y0 + field.y1) / 2, -.0038)
    filling.push(floor)
  })
  // the dressed face, its openings the text fields; no chamfer round a field
  const dressed = new ExtrudeGeometry(face, { depth: o.depth, bevelEnabled: false, curveSegments: 4, steps: 1 })
  dressed.translate(0, 0, -o.depth)
  stone.push(dressed)
  // panel space to the slab: lie the face up at `top`, its head toward -z
  const matrix = new Matrix4().compose(
    new Vector3(o.centre[0], o.top, o.centre[1]),
    new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2),
    new Vector3(1, 1, 1),
  )
  for (const g of [...stone, ...filling]) g.applyMatrix4(matrix)
  return { stone, filling, lines }
}
