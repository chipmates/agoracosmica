/** THE HALL'S LIGHT FOR THE FILM: the north clerestory's daylight and warm
 * museum spots hung from track heads on the beams, each spot throwing a
 * shadow, so every machine stands on its floor and is modelled by a direction
 * instead of by an even fill. Modern exhibition lighting; nothing here claims
 * a light of 1517.
 *
 * ONLY THE HALL'S SURFACES TAKE THESE LIGHTS. A scene light is sampled by
 * every lit surface of the wing, shadow map by shadow map, in a shader stage
 * that holds sixteen samplers; so the spots are hidden from the scene's own
 * list and a surface in the hall is lit through `adopt`. No other room can
 * receive them, and no wall can let them through: a spot's map is drawn from
 * a double of the hall's own shell.
 */
import {
  BoxGeometry, BufferGeometry, Color, CylinderGeometry, DoubleSide, Group, Matrix4, Mesh,
  MeshBasicNodeMaterial, MeshStandardNodeMaterial, Object3D, PMREMGenerator, Quaternion, SpotLight, Vector3,
  type Light, type Material, type Scene, type WebGPURenderer,
} from 'three/webgpu'
import { lights as lightsOf, pmremTexture } from 'three/tsl'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { kelvinToColour } from '../../../stack/light'
import { DARK_BAY, FLOOR, OPENING, ROOMS } from './layout'
import { standBoxes } from './stands'

/** The layer only the hall's spots cast from: no eye and no sun sees it. The
 * wing folds its fixed bodies into one sun-only caster, so the hall's walls
 * are not in a spot's map unless they are drawn for it here. */
export const HALL_SHADOW_LAYER = 3

/** The hall's roof falls south from its clerestory; its beams follow it. */
const hallSoffit = (north: number): number => 1.05 - .75 * (-42.5 - north) / 22.2
/** The underside of a beam's cladding: the soffit less the beam's own depth. */
const beamFoot = (north: number): number => hallSoffit(north) - .64
/** The beams, on the structure's four-metre bay. */
const BEAMS = [-46, -50, -54, -58, -62] as const
/** What the hall's five point fittings give once the eye stands in the hall. */
export const HALL_FILL = 1.4
/** A head's lamp face stands this far under the track it hangs from. */
const DROP = .3

interface HallSpot {
  name: string
  /** east, north, height of the lamp's face */
  at: [number, number, number]
  aim: [number, number, number]
  kelvin: number
  /** candela at full level */
  intensity: number
  angle: number
  penumbra: number
  decay: number
  reach: number
  /** zero throws no shadow */
  mapPx: number
  /** the filter's radius in texels: a sky is a large source */
  soft: number
  /** hung from a track head; daylight has none */
  head: boolean
}

export const HALL_LIGHT_PROVENANCE = {
  manifestId: 'vinci/collection-hall-light', assetClass: 'GENERATED', certainty: 'reconstructed',
  recipe: 'Modern exhibition lighting of the mechanism hall: two broad 6800 K sources under the north clerestory and five 3000 to 3200 K spots hung from track heads on the beams, every one casting a shadow; black track under three beams. A lighting design choice; no light of 1517 is claimed.',
} as const

/** A head hung from the track under a beam. */
const hung = (beam: number, east: number): [number, number, number] => [east, beam, beamFoot(beam) - DROP]

export const HALL_SPOTS: readonly HallSpot[] = [
  // THE CLERESTORY. Two broad sources just inside the north glazing, falling
  // south across the floor. A sky is a large source: its maps are filtered
  // wide, so its shadows are soft.
  { name: 'clerestory-west', at: [-55.6, -42.75, -.35], aim: [-56.4, -50.2, FLOOR], kelvin: 6800,
    intensity: 26, angle: .92, penumbra: 1, decay: 1, reach: 30, mapPx: 1024, soft: 5, head: false },
  { name: 'clerestory-east', at: [-45.8, -42.75, -.35], aim: [-46.6, -51, FLOOR], kelvin: 6800,
    intensity: 18, angle: .92, penumbra: 1, decay: 1, reach: 30, mapPx: 1024, soft: 5, head: false },
  // THE SPOTS. The screw from the aisle side, far enough off that its spiral
  // is thrown onto the north and west walls; the water screw, the gates, the
  // mill and lathe, and the three machines south of the aisle.
  { name: 'key-screw', at: hung(-50, -52.2), aim: [-57.2, -45.4, FLOOR + 2.7], kelvin: 3300,
    intensity: 420, angle: .6, penumbra: .55, decay: 2, reach: 22, mapPx: 2048, soft: 1.5, head: true },
  { name: 'key-water', at: hung(-46, -46.4), aim: [-49.3, -44.9, FLOOR + 1.05], kelvin: 3400,
    intensity: 190, angle: .42, penumbra: .7, decay: 2, reach: 16, mapPx: 2048, soft: 1.5, head: true },
  { name: 'key-gates', at: hung(-54, -51.4), aim: [-55.5, -51.3, FLOOR + 1.2], kelvin: 3300,
    intensity: 170, angle: .5, penumbra: .7, decay: 2, reach: 14, mapPx: 2048, soft: 1.5, head: true },
  { name: 'key-mill', at: hung(-46, -44.2), aim: [-45.4, -43.9, FLOOR + 1.0], kelvin: 3400,
    intensity: 90, angle: .34, penumbra: .75, decay: 2, reach: 12, mapPx: 2048, soft: 1.5, head: true },
  { name: 'key-south', at: hung(-50, -43.4), aim: [-42.6, -49.6, FLOOR + .8], kelvin: 3300,
    intensity: 120, angle: .55, penumbra: .75, decay: 2, reach: 12, mapPx: 2048, soft: 1.5, head: true },
]

/** The tracks run under the three beams that carry heads. */
const TRACKED = [...new Set(HALL_SPOTS.filter(spot => spot.head).map(spot => spot.at[1]))]

const v3 = (east: number, north: number, height: number): Vector3 => new Vector3(east, height, -north)

/** A box in the wing's frame, as geometry already in place. */
function box(east: number, north: number, height: number, width: number, depth: number, tall: number): BufferGeometry {
  const g = new BoxGeometry(width, tall, depth)
  g.translate(east, height, -north)
  return g
}

/** THE HALL'S SHELL AS ITS SPOTS SEE IT: walls, doors as gaps, the roof, the
 * beams, the light shelf, the dark bay and the plinths. Drawn only into the
 * spots' maps, so a spot aimed at a wall stops at it. */
function shellDouble(): Mesh {
  const H = ROOMS.hall, top = 1.4, parts: BufferGeometry[] = []
  const T = .22
  const wallEastWest = (north: number, from: number, to: number, low: number, high: number): void => {
    if (to - from > .001 && high - low > .001) parts.push(box((from + to) / 2, north, (low + high) / 2, to - from, T, high - low))
  }
  const wallNorthSouth = (east: number, from: number, to: number, low: number, high: number): void => {
    if (to - from > .001 && high - low > .001) parts.push(box(east, (from + to) / 2, (low + high) / 2, T, to - from, high - low))
  }
  const head = -2.5
  // west and south: whole
  wallNorthSouth(H.west - T / 2, H.south - T, H.north + T, FLOOR - .1, top)
  wallEastWest(H.south - T / 2, H.west - T, H.east + T, FLOOR - .1, top)
  // the partition to the gallery, with its two doors
  const [gS, gN] = [OPENING.hallToGallery.north[0], OPENING.hallToGallery.north[1]]
  const [sS, sN] = [OPENING.hallToSouth.north[0], OPENING.hallToSouth.north[1]]
  const east = H.east + T / 2
  wallNorthSouth(east, sN, gS, FLOOR - .1, top)
  wallNorthSouth(east, H.south - T, sS, FLOOR - .1, top)
  wallNorthSouth(east, gN, H.north + T, FLOOR - .1, top)
  wallNorthSouth(east, sS, sN, head, top)
  wallNorthSouth(east, gS, gN, head, top)
  // the hanging wall to the picture room, with its door, up to the glazing
  const north = H.north + T / 2, [dW, dE] = [OPENING.pictureToHall.east[0], OPENING.pictureToHall.east[1]]
  wallEastWest(north, dE, H.east + T, FLOOR - .1, -1.45)
  wallEastWest(north, dW - T, dW, FLOOR - .1, -1.45)
  wallEastWest(north, dW, dE, head, -1.45)
  // the roof, falling south, as a run of boxes one bay deep
  for (let n = H.north + .3; n > H.south - 2; n -= 2) {
    const mid = n - 1
    parts.push(box((H.west + H.east) / 2, mid, hallSoffit(mid) + .1, H.east - H.west + 2 * T, 2.04, .2))
  }
  // the beams. The light shelf is left out on purpose: under a whole north
  // sky its shadow is a gradient, and a map draws it as one hard line
  for (const beam of BEAMS) parts.push(box((H.west + H.east) / 2, beam, hallSoffit(beam) - .34, H.east - H.west, .34, .58))
  // the camera obscura's dark bay
  const B = DARK_BAY
  for (const [w, s, e, n] of [
    [B.west - B.wall, B.south - B.wall, B.west, B.north],
    [B.east, B.south - B.wall, B.east + B.wall, B.north],
    [B.west - B.wall, B.south - B.wall, B.east + B.wall, B.south],
  ] as const) parts.push(box((w + e) / 2, (s + n) / 2, FLOOR + B.height / 2, e - w, n - s, B.height))
  // the plinths of the hall's machines
  for (const b of standBoxes()) {
    if (b.east < H.west || b.east > H.east || b.north < H.south || b.north > H.north) continue
    parts.push(box(b.east, b.north, b.height, b.width, b.depth, b.tall))
  }
  const geometry = mergeGeometries(parts.map(part => part.toNonIndexed()))
  for (const part of parts) part.dispose()
  geometry.computeBoundingBox(); geometry.computeBoundingSphere()
  const material = new MeshBasicNodeMaterial({ colorWrite: false, depthWrite: false, side: DoubleSide })
  material.shadowSide = DoubleSide
  material.name = 'vinci/collection-hall-light/shell-double'
  const mesh = new Mesh(geometry, material)
  mesh.name = 'vinci/collection-hall-light/shell-double'
  mesh.layers.set(HALL_SHADOW_LAYER)
  mesh.castShadow = true; mesh.receiveShadow = false
  mesh.raycast = () => {}
  mesh.userData = { ...HALL_LIGHT_PROVENANCE, labelOccluder: false, naLabelOccluder: false }
  mesh.updateMatrixWorld(true)
  return mesh
}

/** The track under a beam and every head on it, and the lamp faces apart. */
function fixtures(): { metal: Mesh; lenses: Mesh } {
  const H = ROOMS.hall, metal: BufferGeometry[] = [], lens: BufferGeometry[] = []
  const place = (g: BufferGeometry, m: Matrix4): BufferGeometry => { g.applyMatrix4(m); return g }
  for (const beam of TRACKED) {
    const foot = beamFoot(beam)
    // a black channel, the beam's length, fixed to its underside
    metal.push(box((H.west + H.east) / 2, beam, foot - .018, H.east - H.west - .3, .034, .036))
  }
  const up = new Vector3(0, 1, 0)
  for (const spot of HALL_SPOTS) {
    if (!spot.head) continue
    const face = v3(...spot.at), aim = v3(...spot.aim)
    const axis = aim.clone().sub(face).normalize()
    const track = beamFoot(spot.at[1]) - .036
    // the adaptor in the track and the stem down to the yoke's pivot
    const pivot = face.clone().addScaledVector(axis, -.1)
    metal.push(box(spot.at[0], spot.at[1], track - .03, .06, .05, .06))
    const stemLength = Math.max(.02, track - .06 - pivot.y)
    metal.push(place(new CylinderGeometry(.009, .009, stemLength, 10), new Matrix4().makeTranslation(pivot.x, pivot.y + stemLength / 2 + .07, pivot.z)))
    // the yoke turns about the stem, the body tilts in it
    const heading = Math.atan2(axis.x, axis.z)
    const yaw = new Matrix4().makeRotationY(heading)
    const yoke = new Matrix4().makeTranslation(pivot.x, pivot.y, pivot.z).multiply(yaw)
    metal.push(place(new BoxGeometry(.16, .012, .02), yoke.clone().multiply(new Matrix4().makeTranslation(0, .075, 0))))
    for (const side of [-1, 1]) metal.push(place(new BoxGeometry(.01, .085, .02), yoke.clone().multiply(new Matrix4().makeTranslation(side * .075, .035, 0))))
    // the body along the aim: a can, a finned back and a hood
    const turn = new Quaternion().setFromUnitVectors(up, axis)
    const along = (offset: number): Matrix4 =>
      new Matrix4().compose(pivot.clone().addScaledVector(axis, offset), turn, new Vector3(1, 1, 1))
    metal.push(place(new CylinderGeometry(.058, .058, .19, 24), along(0)))
    metal.push(place(new CylinderGeometry(.05, .05, .07, 24), along(-.125)))
    for (let fin = 0; fin < 3; fin++) metal.push(place(new CylinderGeometry(.056, .056, .006, 24), along(-.1 - fin * .018)))
    metal.push(place(new CylinderGeometry(.066, .06, .06, 24, 1, true), along(.12)))
    // the lamp face, a hand's width inside the hood
    lens.push(place(new CylinderGeometry(.05, .05, .004, 24), along(.098)))
  }
  const metalGeometry = mergeGeometries(metal.map(g => g.index ? g.toNonIndexed() : g))
  const lensGeometry = mergeGeometries(lens.map(g => g.index ? g.toNonIndexed() : g))
  for (const g of [...metal, ...lens]) g.dispose()
  const anodised = new MeshStandardNodeMaterial({ color: '#17181a', roughness: .38, metalness: .8, side: DoubleSide })
  anodised.name = 'vinci/collection-hall-light/fixtures'
  const glow = new MeshBasicNodeMaterial({ color: new Color(kelvinToColour(3100)).multiplyScalar(9) })
  glow.name = 'vinci/collection-hall-light/lamp-faces'
  const make = (geometry: BufferGeometry, material: MeshStandardNodeMaterial | MeshBasicNodeMaterial, name: string): Mesh => {
    geometry.computeBoundingBox(); geometry.computeBoundingSphere()
    const mesh = new Mesh(geometry, material)
    mesh.name = `vinci/collection-hall-light/${name}`
    mesh.castShadow = false; mesh.receiveShadow = true
    mesh.userData = { ...HALL_LIGHT_PROVENANCE }
    return mesh
  }
  return { metal: make(metalGeometry, anodised, 'fixtures'), lenses: make(lensGeometry, glow, 'lamp-faces') }
}

export interface HallLight {
  /** Light a material by the hall's own rig: its spots, its fittings, the
   * sky's fill and the room's own bounce, and never the sun, which no opening
   * of the hall admits. */
  adopt(material: Material): void
  /** Give a material back to the lights of whatever scene it is drawn in:
   * a machine lent to the close look's own table is lit by that table. */
  release(material: Material): void
  /** Take the room's bounce again, from the middle of the hall, as it now
   * stands. The caller makes the hall visible for the length of the call. */
  bake(): void
  dispose(): void
}

/** Where the room's bounce is taken: the middle of the hall at a machine's height. */
const PROBE_AT = v3(-50.3, -52.85, FLOOR + 2.1)
/** THE ROOM'S BOUNCE AT ITS OWN LEVEL. A probe is the radiance the room
 * really holds, so it is read at one, whatever the wing's outdoor probe is
 * turned down to. */
const PROBE_GAIN = 1

/** The hall's lights, their fixtures and the shell their maps are drawn from.
 * `shared` are the scene's lights a surface in the hall keeps. The spots are
 * never collected as scene lights: a surface takes them only by `adopt`. */
export function mountHallLight(host: Group, shared: readonly Light[], renderer: WebGPURenderer, scene: Scene): HallLight {
  const lights: { light: SpotLight; spec: HallSpot }[] = [], targets: Object3D[] = []
  const shell = shellDouble()
  const { metal, lenses } = fixtures()
  host.add(shell, metal, lenses)
  // `?hallsolo=<name>` leaves one of the hall's lights lit: an instrument's
  // switch, off unless an address asks for it
  const solo = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('hallsolo')
  for (const spec of HALL_SPOTS) {
    const light = new SpotLight(kelvinToColour(spec.kelvin), solo && solo !== spec.name ? 0 : spec.intensity, spec.reach, spec.angle, spec.penumbra, spec.decay)
    light.name = `vinci/collection-hall-light/${spec.name}`
    light.userData = { ...HALL_LIGHT_PROVENANCE }
    light.position.copy(v3(...spec.at))
    const target = new Object3D()
    target.position.copy(v3(...spec.aim))
    light.target = target
    light.castShadow = spec.mapPx > 0
    light.shadow.mapSize.set(Math.max(spec.mapPx, 256), Math.max(spec.mapPx, 256))
    light.shadow.camera.near = .2
    light.shadow.camera.far = spec.reach
    light.shadow.bias = -.00025
    light.shadow.normalBias = spec.mapPx >= 2048 ? .012 : .03
    light.shadow.radius = spec.soft
    light.shadow.camera.layers.enable(HALL_SHADOW_LAYER)
    // hidden from the scene's own list of lights, which every other surface
    // of the wing reads; still in the graph, so its matrices and map follow
    light.visible = false
    host.add(light, target)
    lights.push({ light, spec }); targets.push(target)
  }
  const rig: Light[] = [...shared, ...lights.map(({ light }) => light)]
  // THE ROOM'S BOUNCE. Taken once now, before any surface reads it, so the
  // node has a texture from its first frame; `bake` takes it again, into a
  // second target, while the surfaces still read the first.
  const generator = new PMREMGenerator(renderer)
  const takeProbe = () => generator.fromScene(scene, 0, .1, 2400, { size: 256, position: PROBE_AT })
  let probe = takeProbe()
  const probeNode = pmremTexture(probe.texture)
  const bounce = probeNode.mul(PROBE_GAIN / Math.max(.01, scene.environmentIntensity))
  const adopt = (material: Material): void => {
    const lit = material as Material & { lightsNode?: unknown; envNode?: unknown; lights?: boolean; isNodeMaterial?: boolean }
    if (!lit.isNodeMaterial || lit.lights !== true) return
    lit.lightsNode = lightsOf(rig)
    lit.envNode = bounce
    material.needsUpdate = true
  }
  adopt(metal.material as Material)
  // `?hallrig` hands an instrument the rig's own levels, to take a light out
  // of a standing frame instead of rebuilding the page for each one
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).has('hallrig')) {
    const full = new Map(lights.map(({ light, spec }) => [light, spec.intensity]))
    ;(window as unknown as Record<string, unknown>)['__hallRig'] = {
      names: HALL_SPOTS.map(spec => spec.name),
      solo(name: string | null) { for (const { light, spec } of lights) light.intensity = name === null || spec.name === name ? full.get(light)! : 0 },
      level(name: string, value: number) { for (const { light, spec } of lights) if (spec.name === name) light.intensity = value },
    }
  }
  return {
    adopt,
    release(material) {
      const lit = material as Material & { lightsNode?: unknown; envNode?: unknown }
      if (!lit.lightsNode) return
      lit.lightsNode = null
      lit.envNode = null
      material.needsUpdate = true
    },
    bake() {
      const next = takeProbe()
      probeNode.value = next.texture
      probe.dispose()
      probe = next
    },
    dispose() {
      probe.dispose()
      generator.dispose()
      for (const { light } of lights) { light.removeFromParent(); light.shadow.dispose(); light.dispose() }
      for (const target of targets) target.removeFromParent()
      for (const mesh of [shell, metal, lenses]) {
        mesh.removeFromParent(); mesh.geometry.dispose()
        const material = mesh.material
        if (!Array.isArray(material)) material.dispose()
      }
    },
  }
}
