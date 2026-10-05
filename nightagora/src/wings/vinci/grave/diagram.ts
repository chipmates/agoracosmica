/** THE MODEL OF THE CHOSEN LIGHT, as the museum object its record says it is:
 * a study for the light, not a likeness of Saint-Hubert. At the back of the
 * bronze case lies a pale stone ground seen in plan, north up, and on it
 * stands one plain small building with a gable roof, its gable turned to the
 * measured bearing. One light of its own reaches the case: the computed sun
 * of the chosen minute (2 May 1519, 18:50 UT), at its own azimuth on the
 * plate and its own altitude over it. A sun 3.7 degrees high lays a shadow
 * 15.3 times as long as the thing that throws it, and that one fact is what
 * the model shows: the building's shadow runs across the plate beside a row
 * of cut marks one building height apart and ends just past the fifteenth.
 * The shadow is the light's own, drawn into its map from the building alone,
 * and it fades as the sun's own disc makes it fade; nothing of it is
 * painted. The court's sun and sky light everything else; only the plate and
 * the building take this light (`lightsNode`). Its dimensions are authored
 * exhibition geometry; no elevation of 1519 is claimed.
 */
import {
  BoxGeometry, BufferGeometry, Color, DirectionalLight, ExtrudeGeometry, Float32BufferAttribute, FrontSide, Group, Mesh,
  MeshBasicNodeMaterial, MeshStandardNodeMaterial, Object3D, Shape, Vector3, type Material,
} from 'three/webgpu'
import * as TSL from 'three/tsl'
import { lights as lightsOf } from 'three/tsl'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { anisotropicFootprint, resolved } from '../../../stack/detail'
import { kelvinToColour } from '../../../stack/light'
import { KEY_RIG } from '../print'
// the numerals are set in the face the slab and its stones are lettered in
import { textOutline } from '../words/outline'
// the gable's measured bearing stands with the hour, in the grave's own module; it is read when a model is built
import { GRAVE_HOUR } from './index'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any
const { attribute, float, materialEnvIntensity, mx_noise_float, normalLocal, positionWorld, select, texture, vec2, vec3 } = TSL as unknown as Record<string, N>

/** the layer the model's own light draws its map from; no other light reads
 * it and no camera renders it */
export const DIAGRAM_SHADOW_LAYER = 12

/** THE LIGHT AS DATA. Its direction is the computed sun's and is not here.
 * Its level is an exhibition choice: a plate takes a sun this low at the
 * sine of 3.7 degrees, a fifteenth of what a wall facing it takes, so the
 * light stands high and the building's stone is darker than the plate, and
 * its sunlit faces are still the brightest thing in the case. `fill` is
 * what the case's own sky gives back, as a level, in the plate's own hue, so
 * a shadow is a deep tone of the stone it lies on; a face of the building
 * turned up off the plate takes `skyward` more of it, so the roof's shaded
 * slope stands lighter than the shadow it borders. `level` and `fill`
 * are both laid over the host scene's environment level, as three lays
 * every environment, and under the wing's day level once more: when the
 * wing's evening takes the court's light the pale plate falls to the dusk
 * wall's tone, and is no lit panel in the dusk. `disc` is the
 * sun's own width in degrees: the map is read once for each of `taps` points
 * of that disc, so the shadow's end fades over the third of a metre a disc
 * that wide spreads it at this altitude, and its long edges part as they
 * run. `soften` is the map's own filter across the shadow, in metres. */
export const DIAGRAM_LIGHT = {
  kelvin: 5400, level: 30, fill: [.18, .158, .14], skyward: 3,
  disc: .53,
  map: { across: 400, up: 640, acrossM: .0012, upM: .0004, taps: 32, soften: .024 },
} as const

/** THE MODEL AS DATA, in metres on the plate: east and north from the
 * plate's middle, heights off its face. */
export const DIAGRAM_MODEL = {
  ridge: .17, eaves: .095, width: .22, length: .34,
  /** the middle of the building's footprint */
  at: [-1.118, .66] as readonly [number, number],
  /** the building's stone: its walls and its roof */
  stone: { wall: '#a59d8f', roof: '#b6a58c' },
  /** how far the plate lies behind the case's front */
  recess: .19,
  /** the marks beside the shadow: one building height apart, every fifth longer, cut `depth` through the plate's face
   * onto an inked ground; `numbered` carry their count, the first so that one division is seen to be one height.
   * The face is laid in squares `block` wide, halved `halvings` times where a cut's edge runs. */
  mark: { count: 15, width: .028, short: .08, long: .13, clear: .05, depth: .012, numeral: .195, gap: .07, numbered: [1, 5, 10, 15], block: .24, halvings: 7 },
  /** the north mark's foot */
  north: [1.22, .58] as readonly [number, number],
  /** the sun's sign, on the line from the building's middle toward the sun */
  sun: { disc: .05, gap: .01, ray: .03, rayWidth: .02, rays: 8, clear: .015 },
} as const

/** the computed sun and the gable's bearing, in degrees clockwise from north */
export interface DiagramSun { azimuth: number; altitude: number; gableBearing: number }

/** THE SUN ON THE PLATE, from the direction the grave hands the model: its x
 * and z are the sine and cosine of the sun's bearing off the gable's, its y
 * the sine of the altitude. The gable's own bearing turns that to north. */
export function diagramSun(toSun: readonly [number, number, number]): DiagramSun {
  const degrees = 180 / Math.PI, gableBearing = GRAVE_HOUR.gableBearing
  return { azimuth: gableBearing + Math.atan2(toSun[0], toSun[2]) * degrees, altitude: Math.asin(toSun[1]) * degrees, gableBearing }
}

type P2 = readonly [number, number]
const add = (a: P2, b: P2, k = 1): [number, number] => [a[0] + b[0] * k, a[1] + b[1] * k]
const dot = (a: P2, b: P2): number => a[0] * b[0] + a[1] * b[1]
/** a compass bearing on the plate: east, north */
const compass = (degrees: number): [number, number] => [Math.sin(degrees * Math.PI / 180), Math.cos(degrees * Math.PI / 180)]

/** WHERE THE LIGHT PUTS THE SHADOW, from the sun alone: the plate is the
 * ground, east to the right and north up, and a height stands off it toward
 * the visitor. Nothing here is drawn; the factory places the building and
 * the marks from it, and the check holds the rendered shadow against it. */
export function diagramPlan(sun: DiagramSun) {
  const M = DIAGRAM_MODEL
  const altitude = sun.altitude * Math.PI / 180
  const toSun = compass(sun.azimuth), away: [number, number] = [-toSun[0], -toSun[1]]
  /** the shadow's length for a height of one */
  const reach = 1 / Math.tan(altitude)
  /** the ridge runs along the gable's own bearing; `side` is a quarter turn clockwise of it */
  const gable = compass(sun.gableBearing), side: [number, number] = [gable[1], -gable[0]]
  const a = M.length / 2, b = M.width / 2
  const corner = (i: number, j: number): [number, number] => add(add(M.at, gable, i * a), side, j * b)
  /** the ridge end whose shadow reaches furthest, on the plate under it */
  const far = add(M.at, gable, dot(gable, away) >= 0 ? a : -a)
  const tip = add(far, away, M.ridge * reach)
  /** across the shadow, toward the side the far gable stands on */
  const q0: [number, number] = [away[1], -away[0]]
  const across: [number, number] = dot(add(far, M.at, -1), q0) >= 0 ? q0 : [-q0[0], -q0[1]]
  /** the shadow's half width about the line through the footprint's middle */
  const half = Math.abs(dot(gable, across)) * a + Math.abs(dot(side, across)) * b
  /** how far the marks begin across from the line the tip runs on */
  const off = half - dot(add(far, M.at, -1), across) + M.mark.clear
  return {
    toSun, away, across, reach, gable, side, corner, far, tip, off, half,
    /** toward the sun in the box's frame: plate east, plate north, off the plate */
    direction: [toSun[0] * Math.cos(altitude), toSun[1] * Math.cos(altitude), Math.sin(altitude)] as [number, number, number],
    /** the foot of mark k: k building heights along the shadow from the far gable */
    mark: (k: number): [number, number] => add(add(far, away, k * M.ridge), across, off),
  }
}

const linear = (hex: string): [number, number, number] => { const c = new Color(hex); return [c.r, c.g, c.b] }

/** The building's stone: darker than the plate, so the faces the sun meets
 * stay inside the print at the level the plate needs. Walls, roof and ridge
 * carry their own colour on a vertex attribute. */
function modelStone(): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial({ roughness: .82, metalness: 0 })
  const fine = mx_noise_float(positionWorld.mul(140)).mul(.04).mul(resolved(.007, anisotropicFootprint(positionWorld)))
  m.colorNode = attribute('blockTone', 'vec3').mul(float(1).add(fine))
  m.name = 'vinci/grave/diagram-stone'
  return m
}
/** a part of the box other than its building and its bronze: its colour and
 * its roughness, carried on its vertices */
type Role = { tint: string; rough: number }
function groundSurface(): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial({ roughness: .95, metalness: 0 })
  // no relief on the plate: at 3.7 degrees a degree of tilt is a quarter of
  // its light, so its grain is tone alone, each scale only where a pixel holds it
  const footprint = anisotropicFootprint(positionWorld)
  const fine = mx_noise_float(positionWorld.mul(90)).mul(.08).mul(resolved(.011, footprint))
  const mottle = mx_noise_float(positionWorld.mul(23)).mul(.10).mul(resolved(.043, footprint))
  const cast = mx_noise_float(positionWorld.mul(5.3)).mul(.11).add(mx_noise_float(positionWorld.mul(1.3)).mul(.11))
  m.colorNode = attribute('tint', 'vec3').mul(float(1).add(fine).add(mottle).add(cast))
  m.roughnessNode = attribute('rough', 'float')
  m.name = 'vinci/grave/diagram-ground'
  return m
}
function plain(hex: string, roughness: number, metalness: number, name: string, grain = .03): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial({ roughness, metalness })
  const fine = mx_noise_float(positionWorld.mul(90)).mul(grain)
  m.colorNode = vec3(...linear(hex)).mul(float(1).add(fine))
  m.name = `vinci/grave/diagram-${name}`
  return m
}

export interface DiagramOptions {
  /** the frame's centre and size in the grave's frame, and its z */
  x: number; y: number; z: number; width: number; height: number
  /** toward the computed sun of the chosen minute, in the gable's own frame */
  toSun: readonly [number, number, number]
  /** the model is the same on every tier */
  tier?: 'hero' | 'standard' | 'calm'
}

export interface Diagram { group: Group; light: DirectionalLight; materials: Material[]; dispose(): void }

function box(w: number, h: number, d: number, x: number, y: number, z: number): BufferGeometry {
  const g = new BoxGeometry(w, h, d)
  g.translate(x, y, z)
  return g
}
/** flat faces from triangles, each wound so it faces `out` */
function faces(triangles: readonly (readonly [Vector3, Vector3, Vector3, Vector3])[], tones?: readonly (readonly [number, number, number])[]): BufferGeometry {
  const position: number[] = [], tone: number[] = []
  const n = new Vector3(), e = new Vector3()
  triangles.forEach(([p, q, r, out], i) => {
    n.subVectors(q, p).cross(e.subVectors(r, p))
    for (const v of n.dot(out) >= 0 ? [p, q, r] : [p, r, q]) position.push(v.x, v.y, v.z)
    if (tones) tone.push(...tones[i]!, ...tones[i]!, ...tones[i]!)
  })
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(position, 3))
  if (tones) g.setAttribute('blockTone', new Float32BufferAttribute(tone, 3))
  g.computeVertexNormals()
  return g
}

export function createDiagram(o: DiagramOptions): Diagram {
  const { x: X, y: Y, z: Z, width: W, height: H } = o
  const M = DIAGRAM_MODEL, sun = diagramSun(o.toSun), plan = diagramPlan(sun)
  const altitude = sun.altitude * Math.PI / 180
  const stone = modelStone(), bronze = plain('#6b5537', .42, .8, 'bronze', .04), ground = groundSurface()
  // everything in the case but its building and its bronze is one body: each
  // part carries its own colour and roughness on its vertices
  const plaster: Role = { tint: '#e0e0da', rough: .95 }, ink: Role = { tint: '#26231f', rough: .8 }
  const linen: Role = { tint: '#5d564b', rough: .95 }
  const parts = new Map<Material | Role, BufferGeometry[]>()
  const put = (m: Material | Role, g: BufferGeometry): void => { const list = parts.get(m) ?? []; list.push(g); parts.set(m, list) }

  // THE CASE: its back, and mitred bronze strips 0.40 m deep round it
  put(linen, box(W, H, .13, X, Y, Z - .22))
  const ow = W / 2 + .045, oh = H / 2 + .045, iw = W / 2 - .045, ih = H / 2 - .045, gap = .002
  for (const corners of [
    [[-ow + gap, oh], [ow - gap, oh], [iw - gap, ih], [-iw + gap, ih]],
    [[ow, oh - gap], [ow, -oh + gap], [iw, -ih + gap], [iw, ih - gap]],
    [[ow - gap, -oh], [-ow + gap, -oh], [-iw + gap, -ih], [iw - gap, -ih]],
    [[-ow, -oh + gap], [-ow, oh - gap], [-iw, ih - gap], [-iw, -ih + gap]],
  ]) {
    const shape = new Shape(); shape.moveTo(corners[0]![0]!, corners[0]![1]!)
    for (const [cx, cy] of corners.slice(1)) shape.lineTo(cx!, cy!)
    shape.closePath()
    const strip = new ExtrudeGeometry(shape, { depth: .40, bevelEnabled: true, bevelSize: .006, bevelThickness: .006, bevelSegments: 1, steps: 1 })
    strip.translate(X, Y, Z - .22)
    put(bronze, strip)
  }

  // THE PLATE lies at the back of the case, and the building stands inside
  // it. The case's cheeks are no part of the ground the model shows: the map
  // holds the building alone, so they throw nothing on the plate.
  const face = Z + .1855 - M.recess
  /** a point of the plate, and a height off it, in the grave's frame */
  const at = (p: P2, h = 0): Vector3 => new Vector3(X + p[0], Y + p[1], face + h)
  const up = new Vector3(0, 0, 1)
  // THE BUILDING: four walls and a gable roof, nothing else
  {
    const c = plan.corner, a = M.length / 2, b = M.width / 2
    const out = (p: P2, rise = 0): Vector3 => new Vector3(p[0], p[1], rise).normalize()
    const ridge = [add(M.at, plan.gable, a), add(M.at, plan.gable, -a)] as const
    const wall = linear(M.stone.wall), roof = linear(M.stone.roof)
    const tris: [Vector3, Vector3, Vector3, Vector3][] = [], tones: [number, number, number][] = []
    const quad = (p: Vector3, q: Vector3, r: Vector3, s: Vector3, n: Vector3, tone: [number, number, number]): void => { tris.push([p, q, r, n], [p, r, s, n]); tones.push(tone, tone) }
    for (const j of [-1, 1]) {
      const n: [number, number] = [plan.side[0] * j, plan.side[1] * j], slope = out(n, b / (M.ridge - M.eaves))
      // a long wall, and the roof slope over it
      quad(at(c(1, j)), at(c(-1, j)), at(c(-1, j), M.eaves), at(c(1, j), M.eaves), out(n), wall)
      quad(at(c(1, j), M.eaves), at(c(-1, j), M.eaves), at(ridge[1], M.ridge), at(ridge[0], M.ridge), slope, roof)
    }
    for (const [i, end] of [[1, ridge[0]], [-1, ridge[1]]] as const) {
      const n = out([plan.gable[0] * i, plan.gable[1] * i])
      quad(at(c(i, -1)), at(c(i, 1)), at(c(i, 1), M.eaves), at(c(i, -1), M.eaves), n, wall)
      tris.push([at(c(i, -1), M.eaves), at(c(i, 1), M.eaves), at(end, M.ridge), n]); tones.push(wall)
    }
    put(stone, faces(tris, tones))
  }

  // THE MARKS are cut through the plate's face onto an inked ground a
  // centimetre under it: closed outlines, joined by the nonzero rule.
  const cuts: { shapes: P2[][]; box: readonly [number, number, number, number] }[] = []
  const cut = (shapes: P2[][]): void => {
    const xs = shapes.flat().map(p => p[0]), ys = shapes.flat().map(p => p[1])
    const box = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] as const
    if (box[0] < -iw + .02 || box[1] < -ih + .02 || box[2] > iw - .02 || box[3] > ih - .02) throw new Error('A mark leaves the plate')
    cuts.push({ shapes, box })
  }
  /** numerals upright on the plate, centred on `centre`, in the museum's own face */
  const lettered = (text: string, centre: P2): void => {
    const o = textOutline(text, { size: M.mark.numeral })
    cut(o.contours.map(c => c.map(([x, y]) => [centre[0] + x - o.width / 2, centre[1] + y + o.height / 2] as [number, number])))
  }
  for (let k = 0; k <= M.mark.count; k++) {
    const foot = plan.mark(k), end = add(foot, plan.across, k % 5 === 0 ? M.mark.long : M.mark.short), w = M.mark.width / 2
    cut([[add(foot, plan.away, -w), add(foot, plan.away, w), add(end, plan.away, w), add(end, plan.away, -w)]])
    if ((M.mark.numbered as readonly number[]).includes(k)) lettered(String(k), add(foot, plan.across, M.mark.long + M.mark.gap + M.mark.numeral / 2))
  }
  // north: a needle and its letter, upright on a plate whose north is up
  {
    const [e, n] = M.north
    cut([[[e - .045, n], [e + .045, n], [e, n + .26]]])
    lettered('N', [e, n + .26 + M.mark.gap + M.mark.numeral / 2])
  }
  // the sun's sign: a disc and its rays, where the computed azimuth puts it
  {
    const S = M.sun, outer = S.disc / 2 + S.gap + S.ray
    const clearOf = Math.max(...[-1, 1].flatMap(i => [-1, 1].map(j => dot(add(plan.corner(i, j), M.at, -1), plan.toSun))))
    const centre = add(M.at, plan.toSun, clearOf + S.clear + outer), turn = Math.atan2(plan.away[1], plan.away[0])
    const round = (t: number): [number, number] => [Math.cos(t), Math.sin(t)]
    const disc = Array.from({ length: 16 }, (_, i) => add(centre, round(i / 16 * 2 * Math.PI), S.disc / 2))
    const rays = Array.from({ length: S.rays }, (_, i) => {
      const u = round(turn + i / S.rays * 2 * Math.PI), v: [number, number] = [-u[1], u[0]], foot = add(centre, u, S.disc / 2 + S.gap)
      return [add(foot, v, -S.rayWidth / 2), add(centre, u, outer), add(foot, v, S.rayWidth / 2)]
    })
    cut([disc, ...rays])
  }
  // THE PLATE'S FACE is laid in squares, halved wherever a cut's edge runs
  // down to cells two millimetres wide: every face of it is a square's
  // half, so none is a sliver at any eye. Each square laps a hair over its
  // neighbours, and no seam opens where a large one meets small ones.
  {
    const leaves = 1 << M.mark.halvings, nx = Math.round(2 * iw / M.mark.block) * leaves, ny = Math.round(2 * ih / M.mark.block) * leaves
    const dx = 2 * iw / nx, dy = 2 * ih / ny, lap = .0002
    // how many cells are cut, summed from the plate's corner
    const sum = new Uint32Array((nx + 1) * (ny + 1))
    const cutAt = new Uint8Array(nx * ny)
    for (const { shapes, box } of cuts) {
      const i0 = Math.max(0, Math.floor((box[0] + iw) / dx)), i1 = Math.min(nx - 1, Math.floor((box[2] + iw) / dx))
      const j0 = Math.max(0, Math.floor((box[1] + ih) / dy)), j1 = Math.min(ny - 1, Math.floor((box[3] + ih) / dy))
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const x = -iw + (i + .5) * dx, y = -ih + (j + .5) * dy
        let wind = 0
        for (const c of shapes) for (let k = 0; k < c.length; k++) {
          const a = c[k]!, b = c[(k + 1) % c.length]!
          if ((a[1] <= y) !== (b[1] <= y) && a[0] + (y - a[1]) / (b[1] - a[1]) * (b[0] - a[0]) > x) wind += b[1] > a[1] ? 1 : -1
        }
        if (wind !== 0) cutAt[j * nx + i] = 1
      }
    }
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) sum[(j + 1) * (nx + 1) + i + 1] = cutAt[j * nx + i]! + sum[j * (nx + 1) + i + 1]! + sum[(j + 1) * (nx + 1) + i]! - sum[j * (nx + 1) + i]!
    const cutIn = (i: number, j: number, n: number): number => sum[(j + n) * (nx + 1) + i + n]! - sum[j * (nx + 1) + i + n]! - sum[(j + n) * (nx + 1) + i]! + sum[j * (nx + 1) + i]!
    const squares: [Vector3, Vector3, Vector3, Vector3][] = []
    const lay = (i: number, j: number, n: number): void => {
      const within = cutIn(i, j, n)
      if (within === n * n) return
      if (within > 0) { const h = n / 2; lay(i, j, h); lay(i + h, j, h); lay(i, j + h, h); lay(i + h, j + h, h); return }
      const x0 = -iw + i * dx - lap, y0 = -ih + j * dy - lap, x1 = -iw + (i + n) * dx + lap, y1 = -ih + (j + n) * dy + lap
      const [a, b, c, d] = [at([x0, y0]), at([x1, y0]), at([x1, y1]), at([x0, y1])]
      squares.push([a, b, c, up], [a, c, d, up])
    }
    for (let j = 0; j < ny; j += leaves) for (let i = 0; i < nx; i += leaves) lay(i, j, leaves)
    put(plaster, faces(squares))
    const under = [at([-iw, -ih], -M.mark.depth), at([iw, -ih], -M.mark.depth), at([iw, ih], -M.mark.depth), at([-iw, ih], -M.mark.depth)] as const
    put(ink, faces([[under[0], under[1], under[2], up], [under[0], under[2], under[3], up]]))
  }

  // THE LIGHT OF THE CHOSEN MINUTE. In the box's frame the plate is the
  // ground, so the computed altitude is the light's angle over the plate.
  const toSun = new Vector3(...plan.direction)
  const colour = kelvinToColour(DIAGRAM_LIGHT.kelvin)
  const light = new DirectionalLight(colour, 1)
  light.name = 'vinci/grave/diagram-chosen-light'
  // the level rides the scene's environment level; a light's own intensity cannot.
  // By day `dusk` is one exactly, in a scene lit higher than the wing too.
  const day = KEY_RIG.environmentIntensity
  const dusk = select(materialEnvIntensity.lessThan(day), materialEnvIntensity.div(day), float(1))
  Object.assign(light, { colorNode: vec3(colour.r, colour.g, colour.b).mul(DIAGRAM_LIGHT.level).mul(materialEnvIntensity).mul(dusk) })
  const target = new Object3D()
  target.position.copy(at(M.at, M.ridge / 2))
  const distance = 2
  light.position.copy(target.position).addScaledVector(toSun, distance)
  light.target = target
  // hidden from the scene's own list of lights, which every other surface
  // reads; still in the graph, so its matrices and its map follow
  light.visible = false
  const group = new Group()
  group.name = 'vinci/grave/diagram'
  {
    // THE MAP holds the building and nothing else: the plate lies along the
    // light and would shade itself, and nothing but the building stands on
    // it. Its frustum is the building's own outline seen from the sun, its
    // upright the plate's normal, so a wall's corner is one column of texels
    // and the shadow's long edges come out straight.
    light.castShadow = true
    const map = DIAGRAM_LIGHT.map, camera = light.shadow.camera
    const upright = up.clone().addScaledVector(toSun, -up.dot(toSun)).normalize(), acrossLight = new Vector3().crossVectors(up, toSun).normalize()
    let lo = Infinity, hi = -Infinity, left = Infinity, right = -Infinity
    for (const i of [-1, 1]) for (const [p, h] of [[plan.corner(i, -1), 0], [plan.corner(i, 1), 0], [plan.corner(i, -1), M.eaves], [plan.corner(i, 1), M.eaves], [add(M.at, plan.gable, i * M.length / 2), M.ridge]] as const) {
      const v = at(p, h).sub(target.position)
      lo = Math.min(lo, v.dot(upright)); hi = Math.max(hi, v.dot(upright))
      left = Math.min(left, v.dot(acrossLight)); right = Math.max(right, v.dot(acrossLight))
    }
    const halfAcross = map.across * map.acrossM / 2, halfUp = map.up * map.upM / 2
    const bottom = (lo + hi) / 2 - halfUp, top = (lo + hi) / 2 + halfUp
    // THE SUN IS A DISC. A point of it `q` of its radius higher lays every
    // shadow shorter by tan(altitude + q) over tan(altitude), about the foot
    // of what throws it; a point `p` to the side slides it sideways by that
    // angle times its length. In the map the plate's own line under the
    // building's middle is `ground`, and a point of the plate stands over it
    // by its distance behind the building times the sine of the altitude.
    const radius = DIAGRAM_LIGHT.disc / 2 * Math.PI / 180, ground = -(M.ridge / 2) * Math.cos(altitude)
    const longest = Math.tan(altitude) / Math.tan(altitude - radius)
    if (right - left > 2 * halfAcross - 6 * map.acrossM - map.soften || hi - lo > 2 * halfUp - 6 * map.upM || ground + (hi - ground) * longest > top - 3 * map.upM) throw new Error('The model outgrew its light map')
    Object.assign(camera, {
      left: (left + right) / 2 - halfAcross, right: (left + right) / 2 + halfAcross, bottom, top,
      // the phone bench stands the whole model at .84 of its size; the plate's far corner is within 3.3 m of the building
      near: (distance - .5) * .8, far: distance + 3.4,
    })
    camera.updateProjectionMatrix()
    light.shadow.mapSize.set(map.across, map.up)
    light.shadow.bias = -.0004
    light.shadow.normalBias = 0
    const line = 1 - (ground - bottom) / (2 * halfUp)
    const disc = Array.from({ length: map.taps }, (_, i) => {
      // a sunflower's seeds fill the disc evenly
      const r = Math.sqrt((i + .5) / map.taps), t = i * 2.399963229728653
      return {
        shorter: Math.tan(altitude + r * Math.sin(t) * radius) / Math.tan(altitude),
        slide: r * Math.cos(t) * radius * halfUp / (Math.sin(altitude) * halfAcross),
        soft: (i * .6180339887498949 % 1 - .5) * map.soften / (2 * halfAcross),
      }
    })
    const filter = TSL.Fn(({ depthTexture, shadowCoord }: { depthTexture: N; shadowCoord: N }) => {
      // the map's own v runs down: how far the receiver stands over the plate's line
      const over: N = float(line).sub(shadowCoord.y)
      let lit: N = float(0)
      for (const point of disc) {
        lit = lit.add(texture(depthTexture, vec2(shadowCoord.x.add(over.mul(point.slide)).add(point.soft), float(line).sub(over.mul(point.shorter)))).compare(shadowCoord.z))
      }
      return lit.div(map.taps)
    })
    ;(light.shadow as typeof light.shadow & { filterNode?: unknown }).filterNode = filter
    camera.layers.set(DIAGRAM_SHADOW_LAYER)
    // three looks the map's camera at the target with the world's up; the
    // plate's normal is this map's up wherever a host has turned the grave
    const lookAlongLight = light.shadow.updateMatrices
    light.shadow.updateMatrices = function (this: typeof light.shadow, l) {
      this.camera.up.copy(up).transformDirection(group.matrixWorld)
      lookAlongLight.call(this, l)
    }
  }
  const materials: Material[] = [stone, bronze, ground]
  const rig = lightsOf([light])
  const fill = vec3(...DIAGRAM_LIGHT.fill)
  const bodies = new Map<Material, BufferGeometry[]>([[stone, []], [bronze, []], [ground, []]])
  for (const [key, list] of parts) {
    if (key === stone || key === bronze) { bodies.get(key)!.push(...list); continue }
    const role = key as Role, c = new Color(role.tint)
    for (const g of list) {
      const n = g.getAttribute('position').count
      const tint = new Float32Array(n * 3)
      for (let i = 0; i < n; i++) tint.set([c.r, c.g, c.b], i * 3)
      g.setAttribute('tint', new Float32BufferAttribute(tint, 3))
      g.setAttribute('rough', new Float32BufferAttribute(new Float32Array(n).fill(role.rough), 1))
      bodies.get(ground)!.push(g)
    }
  }
  // the map is drawn from a depth-only double on the box's own layer, so the
  // wing's key never draws the box into its cascades. It casts with the faces
  // turned to the light: a map of the far faces meets the plate at the walls'
  // feet, and a line of light leaks in there.
  const double = new MeshBasicNodeMaterial({ colorWrite: false, depthWrite: false, shadowSide: FrontSide })
  materials.push(double)
  const keep: Record<string, string[]> = { stone: ['blockTone'], bronze: [], ground: ['tint', 'rough'] }
  for (const [material, list] of bodies) {
    const role = (material as { name: string }).name.split('-').pop()!
    const merged = mergeGeometries(list.map(g => g.index ? g.toNonIndexed() : g).map(g => {
      for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', ...keep[role]!].includes(name)) g.deleteAttribute(name)
      if (!g.getAttribute('uv')) g.setAttribute('uv', new Float32BufferAttribute(new Float32Array(g.getAttribute('position').count * 2), 2))
      return g
    }), false)
    for (const g of list) g.dispose()
    if (!merged) continue
    const mesh = new Mesh(merged, material)
    mesh.name = `vinci/grave/diagram/${role}`
    mesh.castShadow = false
    // the building is one convex body: its unlit faces are turned from the
    // light, and nothing else in the map could shade it
    mesh.receiveShadow = material !== stone
    mesh.userData = { manifestClass: 'GENERATED', manifestId: 'vinci/grave-geometry' }
    group.add(mesh)
    // the box's own strips take the court's light like everything outside
    // the box; the plate and the building take the chosen light and its fill
    if (material !== bronze) Object.assign(material, { lightsNode: rig, envNode: (material === stone ? fill.mul(float(1).add(normalLocal.z.max(0).mul(DIAGRAM_LIGHT.skyward))) : fill).mul(dusk) })
    if (material !== stone) continue
    const caster = new Mesh(merged, double)
    caster.name = `vinci/grave/diagram/${role}-caster`
    caster.layers.set(DIAGRAM_SHADOW_LAYER)
    caster.castShadow = true
    caster.receiveShadow = false
    caster.raycast = () => {}
    caster.userData = { manifestClass: 'GENERATED', manifestId: 'vinci/grave-geometry', labelOccluder: false }
    group.add(caster)
  }
  group.add(light, target)
  return {
    group, light, materials,
    dispose() {
      group.traverse(child => { if (child instanceof Mesh) child.geometry.dispose() })
      light.shadow?.dispose()
      for (const m of materials) m.dispose()
    },
  }
}
