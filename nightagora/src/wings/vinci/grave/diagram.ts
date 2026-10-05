/** THE MODEL OF THE CHOSEN LIGHT, as the museum object its record says it is:
 * a study for the light, not a likeness of Saint-Hubert. The bronze box holds
 * a pale ground plate seen in plan, north up, and on it stands one plain
 * small building with a gable roof, its gable turned to the measured
 * bearing. One light of its own reaches the box: the computed sun of the
 * chosen minute (2 May 1519, 18:50 UT), at its own azimuth on the plate and
 * its own altitude over it. A sun 3.7 degrees high lays a shadow 15.3 times
 * as long as the thing that throws it, and that one fact is what the model
 * shows: the building's shadow runs across the plate beside a row of marks
 * one building height apart and ends just past the fifteenth. The shadow is
 * the light's own, drawn into its map from the building alone; nothing of it
 * is painted. The court's sun and sky light everything else; only the box
 * takes this light (`lightsNode`). Its dimensions are authored exhibition
 * geometry; no elevation of 1519 is claimed.
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
// the gable's measured bearing stands with the hour, in the grave's own module; it is read when a model is built
import { GRAVE_HOUR } from './index'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any
const { attribute, float, mx_noise_float, normalLocal, positionWorld, texture, vec2, vec3 } = TSL as unknown as Record<string, N>

/** the layer the model's own light draws its map from; no other light reads
 * it and no camera renders it */
export const DIAGRAM_SHADOW_LAYER = 12

/** THE LIGHT AS DATA. Its direction is the computed sun's and is not here.
 * Its level is an exhibition choice: a plate takes a sun this low at the
 * sine of 3.7 degrees, a fifteenth of what a wall facing it takes, so the
 * light stands high and the building is dark stone, and both stay inside the
 * print. `fill` is what the box's own sky gives back, as a level; a face of
 * the building turned up off the plate takes `skyward` more of it, so the
 * roof and the walls part in the shade as well. The map's taps lay the
 * shadow's edge a centimetre soft across it, and its texels stand the tip
 * within a centimetre along it. */
export const DIAGRAM_LIGHT = {
  kelvin: 3600, intensity: 5.8, fill: [.066, .082, .108], skyward: 1.2,
  map: { across: 256, up: 512, acrossM: .0012, upM: .0004, taps: 7, tapStep: 1.5 },
} as const

/** THE MODEL AS DATA, in metres on the plate: east and north from the
 * plate's middle, heights off its face. */
export const DIAGRAM_MODEL = {
  ridge: .17, eaves: .09, width: .14, length: .3,
  /** the middle of the building's footprint */
  at: [-1.174, .6] as readonly [number, number],
  /** the marks beside the shadow: one building height apart, every fifth longer */
  mark: { count: 16, width: .028, short: .08, long: .13, clear: .03, lift: .003, numeral: .13 },
  /** the north mark's foot */
  north: [1.22, .62] as readonly [number, number],
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

/** The building's stone: dark, so the wall that faces the sun stays inside
 * the print at the level the plate needs. Walls and roof carry their own
 * tone on a vertex attribute. */
function modelStone(): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial({ roughness: .82, metalness: 0 })
  const fine = mx_noise_float(positionWorld.mul(140)).mul(.04).mul(resolved(.007, anisotropicFootprint(positionWorld)))
  m.colorNode = vec3(...linear('#6a6052')).mul(attribute('blockTone', 'float')).mul(float(1).add(fine))
  m.name = 'vinci/grave/diagram-stone'
  return m
}
/** a part of the box other than its building and its bronze: its colour and
 * its roughness, carried on its vertices */
type Role = { tint: string; rough: number }
function groundSurface(): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial({ roughness: .95, metalness: 0 })
  // no relief on the plate: at 3.7 degrees a degree of tilt is a quarter of
  // its light, so its grain is tone alone, and only where a pixel holds it
  const fine = mx_noise_float(positionWorld.mul(90)).mul(.03).mul(resolved(.011, anisotropicFootprint(positionWorld)))
  const cast = mx_noise_float(positionWorld.mul(5)).mul(.035)
  m.colorNode = attribute('tint', 'vec3').mul(float(1).add(fine).add(cast))
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
function faces(triangles: readonly (readonly [Vector3, Vector3, Vector3, Vector3])[], tones?: readonly number[]): BufferGeometry {
  const position: number[] = [], tone: number[] = []
  const n = new Vector3(), e = new Vector3()
  triangles.forEach(([p, q, r, out], i) => {
    n.subVectors(q, p).cross(e.subVectors(r, p))
    for (const v of n.dot(out) >= 0 ? [p, q, r] : [p, r, q]) position.push(v.x, v.y, v.z)
    if (tones) tone.push(tones[i]!, tones[i]!, tones[i]!)
  })
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(position, 3))
  if (tones) g.setAttribute('blockTone', new Float32BufferAttribute(tone, 1))
  g.computeVertexNormals()
  return g
}

/* THE NUMERALS AND THE NORTH MARK, as strokes on a unit cap: every stroke is
   as wide as a mark, so none of them is thinner than a pixel of the stop on
   either stage. */
const ring = (cx: number, cy: number, rx: number, ry: number, from: number, to: number, steps: number): [number, number][] =>
  Array.from({ length: steps + 1 }, (_, i) => { const t = (from + (to - from) * i / steps) * Math.PI / 180; return [cx + Math.cos(t) * rx, cy + Math.sin(t) * ry] })
const GLYPHS: Record<string, { advance: number; strokes: [number, number][][] }> = {
  '1': { advance: .42, strokes: [[[.2, 0], [.2, 1]], [[.2, 1], [.04, .78]]] },
  '0': { advance: .74, strokes: [ring(.29, .5, .21, .42, 0, 360, 20)] },
  '5': { advance: .72, strokes: [[[.52, .92], [.1, .92], [.1, .56]], [[.1, .56], ...ring(.27, .32, .25, .24, 110, -140, 14)]] },
  N: { advance: .74, strokes: [[[.08, 0], [.08, 1]], [[.08, 1], [.5, 0]], [[.5, 0], [.5, 1]]] },
}

export function createDiagram(o: DiagramOptions): Diagram {
  const { x: X, y: Y, z: Z, width: W, height: H } = o
  const M = DIAGRAM_MODEL, plan = diagramPlan(diagramSun(o.toSun))
  const stone = modelStone(), bronze = plain('#6b5537', .42, .8, 'bronze', .04), ground = groundSurface()
  // everything in the box but its building and its bronze is one body: each
  // part carries its own colour and roughness on its vertices
  const plaster: Role = { tint: '#e4e2dc', rough: .95 }, inlay: Role = { tint: '#8f7b5c', rough: .7 }
  const linen: Role = { tint: '#5d564b', rough: .95 }
  const parts = new Map<Material | Role, BufferGeometry[]>()
  const put = (m: Material | Role, g: BufferGeometry): void => { const list = parts.get(m) ?? []; list.push(g); parts.set(m, list) }

  // THE BOX: its back, and mitred bronze strips 0.40 m deep round it
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

  // THE PLATE fills the box to the strips' own face, a hair under it: a sun
  // 3.7 degrees over a plate sunk a centimetre would leave it in the shadow
  // of its own frame, fifteen centimetres deep along two sides.
  const face = Z + .1855
  put(plaster, box(2 * iw, 2 * ih, face - (Z - .155), X, Y, (face + Z - .155) / 2))
  /** a point of the plate, and a height off it, in the grave's frame */
  const at = (p: P2, h = 0): Vector3 => new Vector3(X + p[0], Y + p[1], face + h)
  const up = new Vector3(0, 0, 1)

  // THE BUILDING: four walls and a gable roof, nothing else
  {
    const c = plan.corner, a = M.length / 2
    const out = (p: P2, rise = 0): Vector3 => new Vector3(p[0], p[1], rise).normalize()
    const ridge = [add(M.at, plan.gable, a), add(M.at, plan.gable, -a)] as const
    const tris: [Vector3, Vector3, Vector3, Vector3][] = [], tones: number[] = []
    const quad = (p: Vector3, q: Vector3, r: Vector3, s: Vector3, n: Vector3, tone: number): void => { tris.push([p, q, r, n], [p, r, s, n]); tones.push(tone, tone) }
    for (const j of [-1, 1]) {
      const n: [number, number] = [plan.side[0] * j, plan.side[1] * j]
      // a long wall, and the roof slope over it
      quad(at(c(1, j)), at(c(-1, j)), at(c(-1, j), M.eaves), at(c(1, j), M.eaves), out(n), 1)
      quad(at(c(1, j), M.eaves), at(c(-1, j), M.eaves), at(ridge[1], M.ridge), at(ridge[0], M.ridge), out(n, M.width / 2 / (M.ridge - M.eaves)), 1.5)
    }
    for (const [i, end] of [[1, ridge[0]], [-1, ridge[1]]] as const) {
      const n = out([plan.gable[0] * i, plan.gable[1] * i])
      quad(at(c(i, -1)), at(c(i, 1)), at(c(i, 1), M.eaves), at(c(i, -1), M.eaves), n, 1)
      tris.push([at(c(i, -1), M.eaves), at(c(i, 1), M.eaves), at(end, M.ridge), n]); tones.push(1)
    }
    put(stone, faces(tris, tones))
  }

  // THE MARKS: flat inlays a hair off the plate, which throw nothing
  const lift = M.mark.lift
  const flat = (corners: readonly P2[]): void => {
    const [p, q, r, s] = corners.map(v => at(v, lift)) as [Vector3, Vector3, Vector3, Vector3]
    put(inlay, faces([[p, q, r, up], [p, r, s, up]]))
  }
  /** a bar from `from` to `to`, `width` across, its ends squared off half a width out */
  const bar = (from: P2, to: P2, width = M.mark.width): void => {
    const l = Math.hypot(to[0] - from[0], to[1] - from[1]), u: [number, number] = [(to[0] - from[0]) / l, (to[1] - from[1]) / l]
    const v: [number, number] = [-u[1], u[0]], h = width / 2
    flat([add(add(from, u, -h), v, -h), add(add(to, u, h), v, -h), add(add(to, u, h), v, h), add(add(from, u, -h), v, h)])
  }
  /** numerals set along `along`, their heads toward `head`, centred on `centre` */
  const set = (text: string, centre: P2, along: P2, head: P2, cap: number): void => {
    const width = [...text].reduce((w, ch) => w + GLYPHS[ch]!.advance, 0) - .16
    let pen = -width / 2
    for (const ch of text) {
      const place = (p: P2): [number, number] => add(add(centre, along, (pen + p[0]) * cap), head, (p[1] - .5) * cap)
      for (const stroke of GLYPHS[ch]!.strokes) for (let i = 0; i + 1 < stroke.length; i++) bar(place(stroke[i]!), place(stroke[i + 1]!))
      pen += GLYPHS[ch]!.advance
    }
  }
  const head: [number, number] = [-plan.across[0], -plan.across[1]]
  for (let k = 0; k <= M.mark.count; k++) {
    const foot = plan.mark(k), long = k % 5 === 0
    bar(add(foot, plan.across, M.mark.width / 2), add(foot, plan.across, (long ? M.mark.long : M.mark.short) - M.mark.width / 2))
    if (long && k > 0) set(String(k), add(foot, plan.across, M.mark.long + .05 + M.mark.numeral / 2), plan.away, head, M.mark.numeral)
  }
  // north: a needle and its letter, upright on a plate whose north is up
  {
    const [e, n] = M.north
    put(inlay, faces([[at([e - .04, n], lift), at([e + .04, n], lift), at([e, n + .26], lift), up]]))
    set('N', [e, n + .40], [1, 0], [0, 1], M.mark.numeral)
  }

  // THE LIGHT OF THE CHOSEN MINUTE. In the box's frame the plate is the
  // ground, so the computed altitude is the light's angle over the plate.
  const toSun = new Vector3(...plan.direction)
  const light = new DirectionalLight(kelvinToColour(DIAGRAM_LIGHT.kelvin), DIAGRAM_LIGHT.intensity)
  light.name = 'vinci/grave/diagram-chosen-light'
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
    if (right - left > 2 * halfAcross - 6 * map.acrossM || hi - lo > 2 * halfUp - 6 * map.upM) throw new Error('The model outgrew its light map')
    Object.assign(camera, {
      left: (left + right) / 2 - halfAcross, right: (left + right) / 2 + halfAcross, bottom: (lo + hi) / 2 - halfUp, top: (lo + hi) / 2 + halfUp,
      // the phone bench stands the whole model at .84 of its size; the plate's far corner is within 3.3 m of the building
      near: (distance - .5) * .8, far: distance + 3.4,
    })
    camera.updateProjectionMatrix()
    light.shadow.mapSize.set(map.across, map.up)
    light.shadow.bias = -.0004
    light.shadow.normalBias = 0
    // the edge's softness is laid across the shadow only: along the plate's
    // normal a texel is already fifteen times its size on the plate
    const filter = TSL.Fn(({ depthTexture, shadowCoord }: { depthTexture: N; shadowCoord: N }) => {
      let lit: N = float(0)
      for (let i = 0; i < map.taps; i++) {
        lit = lit.add(texture(depthTexture, shadowCoord.xy.add(vec2((i - (map.taps - 1) / 2) * map.tapStep / map.across, 0))).compare(shadowCoord.z))
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
    if (material !== bronze) Object.assign(material, { lightsNode: rig, envNode: material === stone ? fill.mul(float(1).add(normalLocal.z.max(0).mul(DIAGRAM_LIGHT.skyward))) : fill })
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
