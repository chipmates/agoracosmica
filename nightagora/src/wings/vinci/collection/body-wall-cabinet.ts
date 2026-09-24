/** THE CABINET OF DRAWINGS: the body wall as a deep wall of fumed oak with
 * the hang set into its thickness, each sheet in a linen mat and a thin
 * oiled oak frame on a dark linen ground, a plan chest before it whose top is
 * the leaning rail, and its own light: a low even wash from small dark-steel
 * heads on a track, the dimmest light in the building and the pages the
 * brightest thing in it.
 *
 * ONLY THE CABINET'S SURFACES TAKE ITS LIGHTS (`lightsNode`): no daylight
 * reaches the hang, and the wing's other surfaces sample nothing new. The
 * cabinet stands outside the rail's construction fingerprint and
 * `body-wall-check.mjs` proves it clear of the walk; the certified carriers
 * and reading ledge stand inside it. A modern museum insertion; no 1517 claim.
 */
import {
  Color, CubeCamera, CubeRenderTarget, DoubleSide, FrontSide, Group, HalfFloatType, Mesh, MeshBasicNodeMaterial,
  MeshStandardNodeMaterial, Object3D, PMREMGenerator, RectAreaLight, RectAreaLightNode, SpotLight, SpotLightNode, type BufferGeometry,
  type Material, type RenderTarget, type Scene,
} from 'three/webgpu'
import { RectAreaLightTexturesLib } from 'three/addons/lights/RectAreaLightTexturesLib.js'
import * as TSL from 'three/tsl'
import { lights as lightsOf, pmremTexture } from 'three/tsl'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { Stack } from '../../../stack'
import type { MaterialSet } from '../../../stack/materials'
import { kelvinToColour } from '../../../stack/light'
import { Solid } from './line-gallery-plan'
import {
  BODY_LIGHTS, BODY_SHADOW_LAYER, BODY_WALL_PROVENANCE, chestBoards, Faces, fittings, frameRing, liningBoards, linenBoards,
  matFaces, mountedSheets, PROBE_AT, shadowCasters, splayFaces, v3, type BodyLight, type Board,
} from './body-wall-plan'
import { BODY_PLATE, washToward } from './body-wall-light'
import { anisotropicFootprint, reliefNormal, resolved } from '../../../stack/detail'

// The node overload boundary stays local to this file.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any

const {
  abs, attribute, cameraViewMatrix, cross, dot, float, mix, mx_noise_float, normalWorldGeometry, positionWorld, select,
  smoothstep, uniform, uv, vec2, vec3,
} = TSL as unknown as Record<string, N>

/** The sets the cabinet is dressed from, all CC0 and already resident in the
 * wing: the gallery's and the machines' oak, the machines' linen. */
const SETS = ['oak-veneer-light', 'linen'] as const
/** How far the oak photograph runs across and along its grain. */
const OAK_READ: [number, number] = [1.83, 2.9]

/** a tangent-space normal from a set, bent into the world and handed over in view space */
const bend = (t: N, b: N, n: N, tangent: N, strength: number | N): N =>
  t.mul(tangent.x.mul(strength)).add(b.mul(tangent.y.mul(strength))).add(n.mul(tangent.z)).normalize().transformDirection(cameraViewMatrix)

/** THE LOOK OF EACH SURFACE, as uniforms a live instrument may lean on. */
function looks() {
  return {
    woodGain: uniform(1),
    frameGain: uniform(1),
    woodRough: uniform(.44),
    /** the ground the hang stands on: a deep linen, and the mats' pale one */
    linenTone: uniform(new Color(.039, .04, .041)),
    /** how far the weave's own contrast is lifted, and a slub's swing */
    weaveLift: uniform(2.6),
    slubShade: uniform(.24),
    matTone: uniform(new Color(.6, .585, .54)),
    coreTone: uniform(new Color(.78, .77, .74)),
    matWeave: uniform(.35),
    bronzeColour: uniform(new Color(.3, .22, .13)),
    bronzeRough: uniform(.32),
    envGain: uniform(1),
    envLift: uniform(1.2),
    /** the hang's own share of the room's bounce, inside the opening, and
     * the casework's, which faces the gallery's glazing across the room */
    hangEnv: uniform(.45),
    caseEnv: uniform(1.6),
  }
}
type Looks = ReturnType<typeof looks>

/** OILED OAK, every board its own tone and its own piece of the photograph,
 * the grain along the board. */
function woodMaterial(set: MaterialSet, L: Looks, gain: N, name: string): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial({ roughness: .44, metalness: 0, side: FrontSide })
  const n = normalWorldGeometry
  const grainAxis = attribute('grainAxis', 'vec3')
  const grain = select(abs(dot(n, grainAxis)).greaterThan(.5), vec3(0, 1, 0), grainAxis)
  const t = cross(grain, n).normalize()
  const sample = set.sample({ uv: uv(), metres: OAK_READ })
  m.colorNode = sample.albedo.mul(attribute('pieceTone', 'vec3')).mul(gain)
  m.roughnessNode = mix(L.woodRough.sub(.14), L.woodRough.add(.18), sample.roughness).add(attribute('pieceRough', 'float')).clamp(.18, .95)
  m.normalNode = bend(t, grain, n, sample.normal, .6)
  m.name = `vinci/collection-body-wall/${name}`
  m.userData = { ...BODY_WALL_PROVENANCE, set: set.name }
  return m
}

/** THE DEEP LINEN the hang stands on, read square on the wall, at three
 * scales: each board its own dye lot and a slow drift over it; slub runs, the
 * thicker weft threads a hand long, where the pixel holds a thread; and the
 * photograph's own weave, its contrast lifted so a deep dye still shows it. */
function linenMaterial(set: MaterialSet, L: Looks): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial({ roughness: .9, metalness: 0, side: FrontSide })
  const P = positionWorld, n = normalWorldGeometry
  const sample = set.sample({ uv: vec2(P.z.negate(), P.y), metres: .271 })
  const pixel = anisotropicFootprint(P)
  const drift = mx_noise_float(P.mul(1.6)).mul(.07).add(mx_noise_float(P.mul(.45)).mul(.05)).add(1)
  // the dye's own streak down the warp, a finger wide and a forearm long
  const abrash = mx_noise_float(vec3(P.z.mul(1 / .022), P.y.mul(1 / .35), 0)).mul(resolved(.022, pixel)).mul(.06).add(1)
  const runAt = vec3(P.z.mul(1 / .12), P.y.mul(1 / .005), 0)
  const slub = smoothstep(.38, .7, mx_noise_float(runAt)).sub(smoothstep(.42, .72, mx_noise_float(runAt.add(vec3(7.3, 3.1, 0))).mul(.7)))
    .mul(smoothstep(1.2, 3, float(.005).div(pixel))).toVar()
  const weave = sample.albedo.pow(L.weaveLift)
  m.colorNode = weave.mul(L.linenTone).mul(attribute('pieceTone', 'vec3')).mul(drift).mul(abrash).mul(slub.mul(L.slubShade).add(1))
  m.roughnessNode = float(.8).add(sample.roughness.mul(.12)).sub(slub.abs().mul(.06))
  m.normalNode = reliefNormal(bend(vec3(0, 0, -1), vec3(0, 1, 0), n, sample.normal, 1.1), slub.mul(.00025), .18)
  m.name = 'vinci/collection-body-wall/linen'
  m.userData = { ...BODY_WALL_PROVENANCE, set: set.name }
  return m
}

/** THE MATS: board covered in a pale linen, its bevel the board's white core. */
function matMaterial(set: MaterialSet, L: Looks): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial({ roughness: .9, metalness: 0, side: FrontSide })
  const P = positionWorld, n = normalWorldGeometry
  const face = attribute('pieceTone', 'vec3').x
  const sample = set.sample({ uv: vec2(P.z.negate(), P.y), metres: .271 })
  const weave = mix(vec3(1, 1, 1), sample.albedo, L.matWeave)
  m.colorNode = mix(L.coreTone, L.matTone.mul(weave), face)
  m.roughnessNode = mix(float(.8), float(.88).add(sample.roughness.mul(.08)), face)
  m.normalNode = select(face.greaterThan(.5),
    bend(vec3(0, 0, -1), vec3(0, 1, 0), n, sample.normal, L.matWeave.mul(.6)), n.transformDirection(cameraViewMatrix))
  m.name = 'vinci/collection-body-wall/mat'
  m.userData = { ...BODY_WALL_PROVENANCE, set: set.name }
  return m
}

/** BRONZE, the rail's nosing and the drawer pulls: waxed, and brighter along
 * the middle of the rail where hands rest on it. */
function bronzeMaterial(L: Looks): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial({ roughness: .32, metalness: 1 })
  const P = positionWorld
  const worn = smoothstep(1.9, .4, P.z.sub(52.6).abs())
  const grain = mx_noise_float(P.mul(vec3(3, 40, 3))).mul(.5).add(.5)
  m.colorNode = L.bronzeColour.mul(grain.mul(.12).add(.94)).mul(worn.mul(.18).add(1))
  m.roughnessNode = L.bronzeRough.add(grain.mul(.08)).sub(worn.mul(.1))
  m.name = 'vinci/collection-body-wall/bronze'
  m.userData = { ...BODY_WALL_PROVENANCE }
  return m
}

/** The toes and the core behind the joints: their own dark tones. */
function darkMaterial(): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial({ roughness: .75, metalness: 0, side: FrontSide })
  m.colorNode = attribute('pieceTone', 'vec3')
  m.name = 'vinci/collection-body-wall/dark'
  m.userData = { ...BODY_WALL_PROVENANCE }
  return m
}

/** A WALLWASHER: a spot whose optic shapes its cone into the band the table
 * gives it, the same band the sheets' declared light reads. */
class WasherLight extends SpotLight {
  constructor(readonly optic: BodyLight, intensity: number) {
    super(new Color(optic.colour), intensity, 0, optic.angle, optic.penumbra, 2)
  }
}
// the spot node's cone hook, which the published types leave out
const SpotNode = SpotLightNode as unknown as new (light?: SpotLight) => { light: SpotLight; getSpotAttenuation(builder: N, angleCosine: N): N }
class WasherLightNode extends SpotNode {
  static get type(): string { return 'WasherLightNode' }
  override getSpotAttenuation(builder: N, angleCosine: N): N {
    return super.getSpotAttenuation(builder, angleCosine).mul(washToward(positionWorld, (this.light as unknown as WasherLight).optic))
  }
}

export interface BodyWallCabinet {
  group: Group
  ready: Promise<void>
  /** How many takes of the cabinet's bounce are still owed; a take is drawn
   * in a frame of its own, with the bodies it must see shown for its length. */
  tick(bodies: readonly Object3D[]): void
  dispose(): void
}

/** The calm tier takes no probe: the bounce as a measured fill, warm from
 * the floor and the chest, cooler from the gallery's side. */
const CALM_FILL = { up: [.2, .19, .18], down: [.14, .13, .12], room: [.16, .17, .19] } as const

export function mountBodyWall(stack: Stack): BodyWallCabinet {
  const tier = stack.tierName(), calm = tier === 'calm'
  const L = looks()
  const group = new Group()
  group.name = 'vinci/collection-body-wall'
  group.userData = { ...BODY_WALL_PROVENANCE }
  const owned: Mesh[] = [], materials: Material[] = [], targets: Object3D[] = []

  // THE LIGHTS, from the one table that builds the heads too; a fitting the
  // live engine only draws is left out of the rig
  const built: { light: SpotLight | RectAreaLight; spec: BodyLight }[] = []
  RectAreaLightNode.setLTC(RectAreaLightTexturesLib.init())
  const library = (stack.renderer as unknown as { library: { getLightNodeClass(c: unknown): unknown; addLight(n: unknown, c: unknown): void } }).library
  if (!library.getLightNodeClass(WasherLight)) library.addLight(WasherLightNode, WasherLight)
  for (const spec of BODY_LIGHTS) {
    if (spec.engine === false) continue
    if (spec.kind === 'area') {
      const area = new RectAreaLight(new Color(spec.colour), spec.intensity, spec.width!, spec.height!)
      area.position.copy(v3(...spec.at))
      // its depth runs east, so the east is its up
      area.up.copy(v3(1, 0, 0))
      area.lookAt(v3(...spec.aim))
      area.name = `vinci/collection-body-wall/${spec.name}`
      area.userData = { ...BODY_WALL_PROVENANCE, standIn: spec.standIn === true }
      area.visible = false
      group.add(area)
      built.push({ light: area, spec })
      continue
    }
    const light = spec.wash ? new WasherLight(spec, spec.intensity) : new SpotLight(new Color(spec.colour), spec.intensity, 0, spec.angle, spec.penumbra, 2)
    light.position.copy(v3(...spec.at))
    // a wallwasher's optic: the band it throws, as a multiplier on its cone
    const target = new Object3D()
    target.position.copy(v3(...spec.aim))
    light.target = target
    targets.push(target)
    group.add(target)
    // the calm tier draws no map, and its lamps light without one
    if (spec.shadow && !calm) {
      const px = tier === 'hero' ? spec.shadow.mapPx : Math.max(512, spec.shadow.mapPx / 2)
      light.castShadow = true
      light.shadow.mapSize.set(px, px)
      const far = v3(...spec.at).distanceTo(v3(...spec.aim))
      Object.assign(light.shadow.camera, { near: Math.max(.1, far - 4), far: far + 4 })
      light.shadow.camera.updateProjectionMatrix()
      light.shadow.bias = -.0004
      light.shadow.normalBias = .01
      light.shadow.radius = spec.shadow.soft
      // drawn from the cabinet's own casters alone
      light.shadow.camera.layers.set(BODY_SHADOW_LAYER)
    }
    light.name = `vinci/collection-body-wall/${spec.name}`
    light.userData = { ...BODY_WALL_PROVENANCE, standIn: spec.standIn === true }
    // hidden from the scene's own list, which every other surface reads;
    // still in the graph, so its matrices follow
    light.visible = false
    group.add(light)
    built.push({ light, spec })
  }
  const rig = built.map(({ light }) => light)
  const levels = BODY_PLATE.levels

  // THE CABINET'S BOUNCE: a probe before the hang, taken turned by the
  // scene's own environment turn and re-taken into the same target
  let generator: PMREMGenerator | undefined, probe: { camera: CubeCamera; target: CubeRenderTarget; pmrem: RenderTarget } | undefined
  let env: N
  if (!calm) {
    generator = new PMREMGenerator(stack.renderer)
    const target = new CubeRenderTarget(tier === 'hero' ? 128 : 64, { type: HalfFloatType })
    const camera = new CubeCamera(.05, 2400, target)
    camera.position.copy(v3(...PROBE_AT))
    probe = { camera, target, pmrem: generator.fromCubemap(target.texture) }
    env = pmremTexture(probe.pmrem.texture).mul(L.envGain).mul(L.envLift)
  } else {
    const n = normalWorldGeometry
    const up = vec3(...CALM_FILL.up), down = vec3(...CALM_FILL.down), room = vec3(...CALM_FILL.room)
    env = mix(down, up, n.y.mul(.5).add(.5)).add(room.mul(n.x.max(0))).mul(L.envGain).mul(L.envLift)
  }
  const adopt = (material: Material, inside = false): void => {
    const lit = material as Material & { lightsNode?: unknown; envNode?: unknown }
    lit.lightsNode = lightsOf([...rig])
    lit.envNode = env.mul(inside ? L.hangEnv : L.caseEnv)
    material.needsUpdate = true
  }

  // THE SURFACES
  const [oakSet, linenSet] = SETS.map(name => stack.materials.sync(name))
  const oak = woodMaterial(oakSet!, L, L.woodGain, 'casework')
  const frameOak = woodMaterial(oakSet!, L, L.frameGain, 'frame-oak')
  const linen = linenMaterial(linenSet!, L)
  const mat = matMaterial(linenSet!, L)
  const bronze = bronzeMaterial(L)
  const dark = darkMaterial()
  for (const m of [oak, bronze, dark]) adopt(m)
  for (const m of [frameOak, linen, mat]) adopt(m, true)
  materials.push(oak, frameOak, linen, mat, bronze, dark)

  const make = (geometry: BufferGeometry, material: Material, name: string, occludes: boolean): Mesh => {
    geometry.computeBoundingBox(); geometry.computeBoundingSphere()
    const mesh = new Mesh(geometry, material)
    mesh.name = `vinci/collection-body-wall/${name}`
    mesh.castShadow = false; mesh.receiveShadow = true
    mesh.userData = { ...BODY_WALL_PROVENANCE, asset: BODY_WALL_PROVENANCE.manifestId, labelOccluder: occludes }
    // what stands round a sheet never takes the press meant for the sheet
    if (!occludes) mesh.raycast = () => {}
    owned.push(mesh)
    group.add(mesh)
    return mesh
  }
  const faces = (boards: readonly Board[]): Faces => { const f = new Faces(); for (const q of boards) f.board(q); return f }
  const merged = (parts: BufferGeometry[]): BufferGeometry => {
    const g = mergeGeometries(parts.map(p => p.index ? p.toNonIndexed() : p))
    for (const p of parts) p.dispose()
    return g
  }

  // the casework: the lining's panels and reveals, the chest, in one oak
  const lining = liningBoards(), chest = chestBoards()
  const casework = faces([...lining.panels, ...lining.reveals, ...chest.oak])
  splayFaces(casework)
  make(casework.geometry(), oak, 'casework', true)
  // every frame, swept on its mitres, and every mat with its bevels
  const frames = new Faces(), mats = new Faces()
  mountedSheets().forEach((sheet, i) => { frameRing(frames, sheet.frame, i); matFaces(mats, sheet) })
  make(frames.geometry(), frameOak, 'frames', false)
  make(mats.geometry(), mat, 'mats', false)
  // the linen boards: their faces and the edges their joints open onto
  const ground = new Faces(), boards = linenBoards()
  for (const panel of boards.panels) ground.board(panel, ['west', 'bottom', 'top'])
  make(ground.geometry(), linen, 'linen', false)
  const darks = faces([...lining.core, ...chest.toe])
  darks.board(boards.backer, ['west', 'south', 'north', 'bottom', 'top'])
  make(darks.geometry(), dark, 'dark', true)
  const rail = new Solid()
  for (const box of chest.bronze) rail.box(box)
  for (const rod of chest.rail) rail.rod(rod.a, rod.b, rod.radius, rod.sides ?? 16)
  make(merged(rail.parts), bronze, 'rail', true)
  if (!calm) {
    // THE HEADS AND THEIR TRACK, and the lamp faces apart
    const steel = new Solid(), lens = new Solid(), f = fittings()
    for (const box of f.boxes) steel.box(box)
    for (const rod of f.rods) steel.rod(rod.a, rod.b, rod.radius, rod.sides ?? 12, rod.radiusB ?? rod.radius)
    for (const rod of f.lenses) lens.rod(rod.a, rod.b, rod.radius, rod.sides ?? 12)
    const blackened = new MeshStandardNodeMaterial({ color: '#1c1b1a', roughness: .42, metalness: .7 })
    blackened.name = 'vinci/collection-body-wall/steel'
    const glow = new MeshBasicNodeMaterial({ color: new Color('#ffe0b8').multiplyScalar(7) })
    glow.name = 'vinci/collection-body-wall/lamp-faces'
    adopt(blackened)
    materials.push(blackened, glow)
    make(merged(steel.parts), blackened, 'fittings', false)
    make(merged(lens.parts), glow, 'lamp-faces', false)
    // THE CASTERS, seen only by the cabinet's shadowed lamps
    const hidden = new MeshBasicNodeMaterial({ colorWrite: false, depthWrite: false, side: DoubleSide })
    hidden.shadowSide = DoubleSide
    hidden.name = 'vinci/collection-body-wall/shadow-double'
    materials.push(hidden)
    const doubles = new Solid()
    for (const box of shadowCasters()) doubles.box(box)
    const casters = make(merged(doubles.parts), hidden, 'shadow-double', false)
    casters.layers.set(BODY_SHADOW_LAYER)
    casters.castShadow = true; casters.receiveShadow = false
  }

  // `?bodyrig` hands an instrument the rig's levels and the looks, to lean on
  // a standing frame instead of rebuilding the page for each value
  let owed = 0, live = true
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).has('bodyrig')) {
    ;(window as unknown as Record<string, unknown>)['__bodyRig'] = {
      names: built.map(({ spec }) => spec.name),
      level(name: string, value: number) {
        for (const { light, spec } of built) if (spec.name.startsWith(name)) { light.intensity = value; if (levels[spec.name]) levels[spec.name].value = value }
      },
      kelvin(name: string, value: number) {
        for (const { light, spec } of built) if (spec.name.startsWith(name)) {
          light.color.copy(kelvinToColour(value))
          BODY_PLATE.colours[spec.name]?.value.copy(light.color)
        }
      },
      colour(name: string, r: number, g: number, b: number) {
        for (const { light, spec } of built) if (spec.name.startsWith(name)) {
          light.color.setRGB(r, g, b)
          BODY_PLATE.colours[spec.name]?.value.copy(light.color)
        }
      },
      looks: { ...L, plateGain: BODY_PLATE.gain, plateAmbient: BODY_PLATE.ambient },
      lights: Object.fromEntries(built.map(({ light, spec }) => [spec.name, light])),
      soft(name: string, value: number) { for (const { light, spec } of built) if (spec.name.startsWith(name) && light instanceof SpotLight) light.shadow.radius = value },
      bake: () => { owed = 2 },
    }
  }

  const ready = Promise.all(SETS.map(name => stack.materials.load(name))).then(() => { if (live) owed = 2 }, () => { if (live) owed = 2 })
  function take(bodies: readonly Object3D[]): void {
    if (!probe || !generator) return
    let scene: Object3D = group
    while (scene.parent) scene = scene.parent
    const root = scene as Scene
    if (!root.isScene) return
    probe.camera.rotation.copy(root.environmentRotation)
    probe.camera.updateMatrixWorld(true)
    L.envGain.value = 1 / Math.max(.01, root.environmentIntensity)
    const shown = bodies.map(body => body.visible)
    for (const body of bodies) body.visible = true
    try { probe.camera.update(stack.renderer, root) } finally { bodies.forEach((body, i) => { body.visible = shown[i]! }) }
    generator.fromCubemap(probe.target.texture, probe.pmrem)
  }

  return {
    group,
    ready: ready.then(() => undefined),
    tick(bodies) {
      if (owed <= 0) return
      owed--
      take([group, ...bodies])
    },
    dispose() {
      live = false
      for (const mesh of owned) { mesh.removeFromParent(); mesh.geometry.dispose() }
      for (const m of materials) m.dispose()
      for (const { light } of built) { light.removeFromParent(); light.dispose() }
      for (const target of targets) target.removeFromParent()
      if (probe) { probe.pmrem.dispose(); probe.target.dispose() }
      generator?.dispose()
      group.removeFromParent()
    },
  }
}
