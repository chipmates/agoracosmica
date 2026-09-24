/** THE DIAGRAM OF THE CHOSEN LIGHT, as the museum object its record says it
 * is: a study for the light, not a likeness of Saint-Hubert. A small relief of
 * a coursed gable stands in a deep bronze box on a dark linen ground, and one
 * light of its own reaches it: the direction the computed sun of the chosen
 * minute (2 May 1519, 18:50 UT) takes against the gable's measured bearing,
 * 3.7 degrees over the horizon, the warm colour of so low a sun. So the stones
 * catch it on their left arrises, the window's reveal throws its shadow across
 * the glass and the roof's edge lays a long line over the wall, which is what
 * the diagram is there to show. The court's own sun and sky light everything
 * else; only the box takes this light (`lightsNode`), and its map is drawn
 * from the box's own casters alone. Its dimensions are authored exhibition
 * geometry; no elevation of 1519 is claimed.
 */
import {
  BoxGeometry, BufferGeometry, Color, DirectionalLight, ExtrudeGeometry, Float32BufferAttribute, Group, Mesh,
  MeshBasicNodeMaterial, MeshStandardNodeMaterial, Object3D, Shape, type Material,
} from 'three/webgpu'
import * as TSL from 'three/tsl'
import { lights as lightsOf } from 'three/tsl'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { reliefNormal, specularAA, surfaceDetail } from '../../../stack/detail'
import { kelvinToColour } from '../../../stack/light'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any
const { attribute, cameraViewMatrix, float, mix, mx_noise_float, normalWorldGeometry, positionWorld, vec3 } = TSL as unknown as Record<string, N>

/** the layer the diagram's own light draws its map from; no other light
 * reads it and no camera renders it */
export const DIAGRAM_SHADOW_LAYER = 12

/** THE LIGHT AS DATA: its colour temperature, its level against the wing's
 * key (320 lux), and the map it draws. The box stands in the court's shade
 * behind the slab: at this level the lit stones stay under the slab's own
 * brightness, so the name keeps the frame and the model stays a study. */
export const DIAGRAM_LIGHT = { kelvin: 3000, intensity: .8, mapPx: { hero: 1024, standard: 512 } } as const

const linear = (hex: string): [number, number, number] => { const c = new Color(hex); return [c.r, c.g, c.b] }

/** A stone of the model: pale maquette stone, each block its own tone. The
 * block's tone rides on its first texture coordinate, so the blocks weld into
 * one body and still read one by one. */
function modelStone(): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial({ roughness: .86, metalness: 0 })
  const d = surfaceDetail({ scales: [.2, .03, .0015], figure: [.05, .04, .03], relief: .0004 })
  const block = attribute('blockTone', 'float')
  const c = vec3(...linear('#d6cdb8')).mul(d.tone).mul(block)
  m.colorNode = c
  m.roughnessNode = specularAA(float(.86).add(d.rough), d.lost)
  m.normalNode = reliefNormal(normalWorldGeometry.transformDirection(cameraViewMatrix), d.heightM, .15)
  m.name = 'vinci/grave/diagram-stone'
  return m
}
/** a part of the box other than its stones and its bronze: its colour and
 * its roughness, carried on its vertices */
type Role = { tint: string; rough: number }
function groundSurface(): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial({ roughness: .9, metalness: 0 })
  const fine = mx_noise_float(positionWorld.mul(90)).mul(.05)
  m.colorNode = attribute('tint', 'vec3').mul(float(1).add(fine))
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
  /** unit vector toward the chosen sun, in the grave's frame */
  toSun: [number, number, number]
  tier?: 'hero' | 'standard' | 'calm'
}

export interface Diagram { group: Group; light: DirectionalLight; materials: Material[]; dispose(): void }

/** a box with a constant block tone on every vertex */
function toned(w: number, h: number, d: number, x: number, y: number, z: number, tone: number): BufferGeometry {
  const g = new BoxGeometry(w, h, d)
  g.translate(x, y, z)
  const n = g.getAttribute('position').count
  g.setAttribute('blockTone', new Float32BufferAttribute(new Float32Array(n).fill(tone), 1))
  return g
}
function box(w: number, h: number, d: number, x: number, y: number, z: number): BufferGeometry {
  const g = new BoxGeometry(w, h, d)
  g.translate(x, y, z)
  return g
}
/** a beam between two points in the frame's xy plane, `width` across and
 * `depth` deep, at depth centre z */
function beam(ax: number, ay: number, bx: number, by: number, z: number, width: number, depth: number): BufferGeometry {
  const g = new BoxGeometry(Math.hypot(bx - ax, by - ay), width, depth)
  g.rotateZ(Math.atan2(by - ay, bx - ax))
  g.translate((ax + bx) / 2, (ay + by) / 2, z)
  return g
}

export function createDiagram(o: DiagramOptions): Diagram {
  const { x: X, y: Y, z: Z, width: W, height: H } = o
  const tier = o.tier ?? 'hero'
  const stone = modelStone(), bronze = plain('#6b5537', .42, .8, 'bronze', .04), ground = groundSurface()
  // everything in the box but its stones and its bronze is one body: each
  // part carries its own colour and roughness on its vertices
  const mortar: Role = { tint: '#8d8472', rough: .92 }, slate: Role = { tint: '#4a5058', rough: .62 }
  const glass: Role = { tint: '#1b2024', rough: .14 }, linen: Role = { tint: '#34302b', rough: .95 }
  const oak: Role = { tint: '#7a5c3e', rough: .6 }
  const parts = new Map<Material | Role, BufferGeometry[]>()
  const put = (m: Material | Role, g: BufferGeometry): void => { const list = parts.get(m) ?? []; list.push(g); parts.set(m, list) }

  // THE BOX: a linen ground, and mitred bronze strips 0.40 m deep round it
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

  // THE MODEL, standing on an oak shelf: a coursed chapel gable pitched at
  // about fifty degrees, a base course proud of the wall, blocks each their
  // own length and tone and a few millimetres proud or shy of their
  // neighbours on a mortar bed that runs back into the ground, quoins at the
  // corners, one lancet window in a chamfered surround with its glass set
  // back in the reveal, stone copings up both rakes and the slate verges.
  const random = mulberry(151902)
  const face = Z + .07, blockDepth = .12
  const base = Y - .84, eaves = Y + .02, apex = Y + .98, half = .74
  const course = .128
  const win = { half: .13, sill: base + .36, spring: base + .86 }
  const archRise = win.half * 2 * Math.sqrt(3) / 2
  const surround = .055
  put(oak, box(2 * half + .42, .035, .33, X, base - .0175, Z + .01))
  const bedBack = Z - .157, bedFront = face - blockDepth / 2 + .01
  put(mortar, box(2 * half - .02, eaves - base, bedFront - bedBack, X, (base + eaves) / 2, (bedFront + bedBack) / 2))
  const gableShape = new Shape()
  gableShape.moveTo(-half + .01, 0); gableShape.lineTo(half - .01, 0); gableShape.lineTo(0, apex - eaves - .01); gableShape.closePath()
  const gableBed = new ExtrudeGeometry(gableShape, { depth: bedFront - bedBack, bevelEnabled: false })
  gableBed.translate(X, eaves, bedBack)
  put(mortar, gableBed)
  // the base course stands a bed into the shelf
  put(stone, toned(2 * half + .03, .104, blockDepth + .03, X, base + .048, face - blockDepth / 2 + .015, .9))
  const halfAt = (y: number): number => y <= eaves ? half : half * (1 - (y - eaves) / (apex - eaves))
  const openAt = (y0: number, y1: number): number => {
    // the half-width the window and its surround take out of a course
    if (y1 < win.sill - .02 || y0 > win.spring + archRise + surround) return 0
    if (y0 < win.spring) return win.half + surround
    const h = Math.max(0, y0 - win.spring)
    return Math.max(0, (win.half + surround) * Math.sqrt(Math.max(0, 1 - (h / (archRise + surround)) ** 2)))
  }
  let row = 0
  for (let y0 = base + .1; y0 < apex - .08; y0 += course, row++) {
    const y1 = Math.min(y0 + course - .004, apex)
    const reach = halfAt(y1) - (y1 > eaves ? .045 : 0)
    if (reach < .07) break
    const opening = openAt(y0, y1)
    // a quoin at each corner below the eaves, long and short in turn
    const quoin = y1 <= eaves + .001 ? (row % 2 ? .26 : .16) : 0
    let x = -reach
    while (x < reach - .02) {
      const l = Math.min(reach - x, x === -reach && quoin ? quoin : .22 + random() * .22)
      const a = x + .002, b = x + l - .002
      x += l
      const corner = quoin > 0 && (a < -reach + .01 || b > reach - .01)
      const pieces: [number, number][] = opening && a < opening && b > -opening
        ? [[a, -opening - .002], [opening + .002, b]] : [[a, b]]
      for (const [p, q] of pieces) {
        if (q - p < .03) continue
        const proud = corner ? .006 : (random() - .5) * .006
        put(stone, toned(q - p, y1 - y0 - .004, blockDepth, X + (p + q) / 2, (y0 + y1) / 2, face - blockDepth / 2 + proud,
          corner ? 1.02 : .9 + random() * .16))
      }
    }
  }
  // the lancet: a chamfered surround a little proud of the wall, the glass
  // set back in its reveal
  const arch = (w: number): Shape => {
    const s = new Shape(), r = 2 * w
    s.moveTo(-w, win.sill); s.lineTo(w, win.sill); s.lineTo(w, win.spring)
    s.absarc(-w, win.spring, r, 0, Math.PI / 3, false)
    s.absarc(w, win.spring, r, Math.PI * 2 / 3, Math.PI, false)
    s.lineTo(-w, win.sill)
    return s
  }
  const frame = arch(win.half + surround)
  frame.holes.push(arch(win.half))
  const frameGeometry = new ExtrudeGeometry(frame, { depth: blockDepth + .012, bevelEnabled: true, bevelSize: .006, bevelThickness: .006, bevelSegments: 1, curveSegments: 10 })
  frameGeometry.translate(X, 0, face - blockDepth)
  put(stone, withTone(frameGeometry, 1.0))
  put(stone, toned(2 * (win.half + surround) + .06, .045, blockDepth + .06, X, win.sill - .0225, face - blockDepth / 2 + .03, .98))
  const pane = new ExtrudeGeometry(arch(win.half + .004), { depth: .006, bevelEnabled: false, curveSegments: 10 })
  // the glass stands just in front of the bed, so the reveal is the surround
  // and the wall's own depth
  pane.translate(X, 0, face - .046)
  put(glass, pane)
  // the copings up the two rakes, a kneeler at each foot and the apex stone
  for (const side of [-1, 1]) {
    put(stone, withTone(beam(X + side * (half + .025), eaves - .02, X, apex + .025, face - blockDepth / 2 + .012, .07, blockDepth + .03), .97))
    put(stone, toned(.14, .09, blockDepth + .04, X + side * (half - .02), eaves - .01, face - blockDepth / 2 + .016, .95))
  }
  put(stone, toned(.1, .08, blockDepth + .04, X, apex + .02, face - blockDepth / 2 + .016, .97))
  const pitch = Math.hypot(half, apex - eaves)
  for (const side of [-1, 1]) {
    const ux = -side * half / pitch, uy = (apex - eaves) / pitch
    const outX = side * uy, outY = Math.abs(ux)
    for (let c = 0; c < 10; c++) {
      const lower = c * pitch / 10, upper = Math.min(pitch, lower + pitch / 10 + .02)
      const joints = c % 2 === 0 ? [0, .1, .2, .3] : [0, .05, .15, .25, .3]
      for (let t = 0; t < joints.length - 1; t++) {
        const a = joints[t]!, b = joints[t + 1]!
        put(slate, beam(
          X + side * half + ux * lower + outX * .05, eaves + uy * lower + outY * .05,
          X + side * half + ux * upper + outX * .04, eaves + uy * upper + outY * .04,
          face - blockDepth - .02 + (a + b) / 2 - .15, .009, b - a - .003))
      }
    }
  }

  // THE LIGHT OF THE CHOSEN MINUTE, its target the model's middle
  const light = new DirectionalLight(kelvinToColour(DIAGRAM_LIGHT.kelvin), DIAGRAM_LIGHT.intensity)
  light.name = 'vinci/grave/diagram-chosen-light'
  const target = new Object3D()
  target.position.set(X, Y, Z)
  light.position.set(X + o.toSun[0] * 6, Y + o.toSun[1] * 6, Z + o.toSun[2] * 6)
  light.target = target
  // hidden from the scene's own list of lights, which every other surface
  // reads; still in the graph, so its matrices and its map follow
  light.visible = false
  if (tier !== 'calm') {
    light.castShadow = true
    const px = DIAGRAM_LIGHT.mapPx[tier]
    light.shadow.mapSize.set(px, px)
    Object.assign(light.shadow.camera, { left: -1.75, right: 1.75, top: 1.55, bottom: -1.55, near: 4.2, far: 7.4 })
    light.shadow.camera.updateProjectionMatrix()
    light.shadow.bias = -.0004
    light.shadow.normalBias = .012
    light.shadow.camera.layers.set(DIAGRAM_SHADOW_LAYER)
  }
  const group = new Group()
  group.name = 'vinci/grave/diagram'
  const materials: Material[] = [stone, bronze, ground]
  const rig = lightsOf([light])
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
  // the map is drawn from depth-only doubles on the box's own layer, so the
  // wing's key never draws the box into its cascades
  const double = new MeshBasicNodeMaterial({ colorWrite: false, depthWrite: false })
  materials.push(double)
  const keep: Record<string, string[]> = { stone: ['blockTone'], bronze: [], ground: ['tint', 'rough'] }
  for (const [material, list] of bodies) {
    const role = (material as { name: string }).name.split('-').pop()!
    const merged = mergeGeometries(list.map(g => g.index ? g.toNonIndexed() : g).map(g => {
      for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', ...keep[role]!].includes(name)) g.deleteAttribute(name)
      if (role === 'stone' && !g.getAttribute('blockTone')) g.setAttribute('blockTone', new Float32BufferAttribute(new Float32Array(g.getAttribute('position').count).fill(1), 1))
      if (!g.getAttribute('uv')) g.setAttribute('uv', new Float32BufferAttribute(new Float32Array(g.getAttribute('position').count * 2), 2))
      return g
    }), false)
    for (const g of list) g.dispose()
    if (!merged) continue
    const mesh = new Mesh(merged, material)
    mesh.name = `vinci/grave/diagram/${role}`
    mesh.castShadow = false
    mesh.receiveShadow = true
    mesh.userData = { manifestClass: 'GENERATED', manifestId: 'vinci/grave-geometry' }
    group.add(mesh)
    const caster = new Mesh(merged, double)
    caster.name = `vinci/grave/diagram/${role}-caster`
    caster.layers.set(DIAGRAM_SHADOW_LAYER)
    caster.castShadow = true
    caster.receiveShadow = false
    caster.raycast = () => {}
    caster.userData = { manifestClass: 'GENERATED', manifestId: 'vinci/grave-geometry', labelOccluder: false }
    group.add(caster)
    // the box's own strips take the court's light like everything outside
    // the box; inside it only the chosen light reaches
    if (material !== bronze) (material as Material & { lightsNode?: unknown }).lightsNode = rig
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

function withTone(g: BufferGeometry, tone: number): BufferGeometry {
  g.setAttribute('blockTone', new Float32BufferAttribute(new Float32Array(g.getAttribute('position').count).fill(tone), 1))
  return g
}

function mulberry(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
