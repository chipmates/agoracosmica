/** THE GALLERY OF THE LIFE, FOR THE FILM: the long room where the dates are
 * cut into the floor. The line's field is honed limestone, each slab its own
 * piece of one CC0 photograph with its bedding laid along the walk and the
 * dates' bronze let into it; round the field lies the building's own sealed
 * concrete, the walls and the coffered soffit are its board-formed concrete,
 * and oiled oak benches stand at the glass. North-east daylight through the
 * glazed wall is the key; every date stands in a warm pool from a head on a
 * track over the line; washers lay a warm wash down the far wall.
 *
 * ONLY THE GALLERY'S SURFACES TAKE THESE LIGHTS (`lightsNode`): the wing's
 * other surfaces sample nothing new. The finish lies over the certified
 * construction and is no rail solid; the benches and fittings stand outside
 * the fingerprint and `line-gallery-check.mjs` proves them clear of the walk.
 * A modern room; no light or building of 1517 is claimed.
 */
import {
  Color, CubeCamera, CubeRenderTarget, FrontSide, Group, HalfFloatType, Mesh, MeshBasicNodeMaterial,
  MeshStandardNodeMaterial, Object3D, PMREMGenerator, RectAreaLight, RectAreaLightNode, SpotLight,
  type BufferGeometry, type Light, type Material, type RenderTarget, type Scene,
} from 'three/webgpu'
import * as TSL from 'three/tsl'
import { lights as lightsOf, pmremTexture } from 'three/tsl'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { RectAreaLightTexturesLib } from 'three/addons/lights/RectAreaLightTexturesLib.js'
import type { Stack } from '../../../stack'
import type { MaterialSet } from '../../../stack/materials'
import { kelvinToColour } from '../../../stack/light'
import { axisFootprint, lineCoverage } from '../../../stack/detail'
import type { LineMaterials } from '../line'
import { COLLECTION_PAVING_ORIGIN, LINE_ORIGIN, LINE_SLAB } from './layout'
import {
  benches, ceilingSkin, DATE_MIDDLE_EAST, fittings, floorSkins, GALLERY_LIGHTS, LINE_GALLERY_PROVENANCE, PROBE_AT, v3, wallSkins,
  type GalleryLight, type Skin, type Solid,
} from './line-gallery-plan'

// The node overload boundary stays local to this file.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any

const {
  abs, attribute, cameraViewMatrix, cross, dot, float, floor: floorOf, fract, mix, mx_noise_float, normalWorldGeometry,
  positionWorld, select, smoothstep, uniform, vec2, vec3,
} = TSL as unknown as Record<string, N>

/** The sets the gallery is dressed from, all CC0 and already in the store. */
const SETS = ['concrete-wall-formed', 'concrete-floor-polished', 'oak-veneer-light', 'limestone-pale'] as const
/** The building's floor bays: two museum stones each way, as in the hall. */
const BAY = { east: 3.2, north: 3.3 } as const

const hash = (x: N, y: N, salt: number): N => fract(x.mul(12.9898).add(y.mul(78.233)).add(salt).sin().mul(43758.5453))

/** the tangent frame a world-aligned face is photographed in: u runs along
    the face, v up it; a level face's u runs east and v north */
function faceFrame(n: N): { t: N; b: N } {
  const flat = abs(n.y).greaterThan(.5)
  const t = select(flat, vec3(1, 0, 0), cross(vec3(0, 1, 0), n).normalize())
  const b = select(flat, cross(n, vec3(1, 0, 0)), vec3(0, 1, 0))
  return { t, b }
}

/** a tangent-space normal from a set, bent into the world and handed over in view space */
const bend = (t: N, b: N, n: N, tangent: N, strength: number | N): N =>
  t.mul(tangent.x.mul(strength)).add(b.mul(tangent.y.mul(strength))).add(n.mul(tangent.z)).normalize().transformDirection(cameraViewMatrix)

/** THE LOOK OF EACH SURFACE, as uniforms: a live instrument may lean on them
 * and no shader is rebuilt. Values are the room's own, chosen in the look
 * rounds. */
function looks() {
  return {
    stoneTint: uniform(new Color(.84, .87, .94)),
    /** how much of the photograph's own banding the honed face keeps */
    stoneBand: uniform(.45),
    stoneRough: uniform(.46),
    /** how far the walk along the dates has polished its band */
    stoneWalk: uniform(.08),
    stoneTone: uniform(.11),
    stoneNormal: uniform(.3),
    groutColour: uniform(new Color('#5f574c')),
    bronzeColour: uniform(new Color(.26, .2, .13)),
    bronzeRough: uniform(.26),
    inkColour: uniform(new Color('#2a2724')),
    // the hall's photographs, poured paler here: a daylit room's concrete
    // stands near AD-2's 0.33, its sealed floor near 0.19
    wallTint: uniform(new Color(1.26, 1.33, 1.7)),
    soffitTint: uniform(new Color(1.24, 1.36, 1.95)),
    floorTint: uniform(new Color(2.0, 1.95, 1.85)),
    oakTint: uniform(new Color(.78, .74, .7)),
    darkTint: uniform(new Color(.55, .53, .51)),
    /** the probe read at the scene's own level; the lift is the room's */
    envGain: uniform(1),
    envLift: uniform(1.25),
    /** Engine-only terms (the dark of a joint the engine casts no shadow
     * into): a renderer that computes its own shadows sets this to zero. */
    engineTerms: uniform(1),
  }
}
type Looks = ReturnType<typeof looks>

/** THE BUILDING'S CONCRETE, walls and soffit in one: the formwork photograph
 * at the hall's own size and lean, the soffit a shade cooler than the walls. */
function concreteMaterial(set: MaterialSet, L: Looks): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial({ roughness: .8, metalness: 0, side: FrontSide })
  const P = positionWorld, n = normalWorldGeometry
  const { t, b } = faceFrame(n)
  const sample = set.sample({ uv: vec2(dot(P, t), dot(P, b)), metres: 2.71 })
  const down = n.y.lessThan(-.5)
  const drift = mx_noise_float(P.mul(.11)).mul(.06).add(mx_noise_float(P.mul(.37)).mul(.03))
  m.colorNode = sample.colour.mul(select(down, L.soffitTint, L.wallTint)).mul(drift.add(1))
  m.roughnessNode = mix(select(down, float(.7), float(.62)), select(down, float(.98), float(.95)), sample.roughness)
  m.normalNode = bend(t, b, n, sample.normal, select(down, float(.8), float(1)))
  m.aoNode = sample.occlusion
  m.name = 'vinci/collection-line-gallery/concrete'
  m.userData = { ...LINE_GALLERY_PROVENANCE, set: set.name }
  return m
}

/** THE BUILDING'S SEALED FLOOR round the line: bays of 3.2 by 3.3 m on the
 * paving datum the hall and the reading room lie on, each read from its own
 * part of the photograph, with saw cuts between them. */
function floorMaterial(set: MaterialSet, L: Looks): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial({ roughness: .6, metalness: 0, side: FrontSide })
  const P = positionWorld, n = normalWorldGeometry
  const east = P.x.sub(COLLECTION_PAVING_ORIGIN.east), north = P.z.negate().sub(COLLECTION_PAVING_ORIGIN.north)
  const cellE = floorOf(east.div(BAY.east)), cellN = floorOf(north.div(BAY.north))
  const h1 = hash(cellE, cellN, 3.7), h2 = hash(cellE, cellN, 11.3)
  const sample = set.sample({ uv: vec2(P.x, P.z.negate()).add(vec2(h1, h2).mul(23.7)), metres: 3 })
  const drift = mx_noise_float(P.mul(.11)).mul(.09).add(mx_noise_float(P.mul(.37)).mul(.045))
  const { east: pe, north: pn } = axisFootprint(P)
  const cut = (c: N, period: number, pixel: N): N => {
    const f = fract(c.div(period)), edge = f.min(float(1).sub(f)).mul(period)
    return lineCoverage(edge, .003, period, pixel)
  }
  const joint = cut(east, BAY.east, pe).max(cut(north, BAY.north, pn))
  m.colorNode = sample.colour.mul(L.floorTint).mul(float(1).add(h1.sub(.5).mul(.18)).add(drift)).mul(float(1).sub(joint.mul(.55)))
  m.roughnessNode = mix(float(.4), float(.72), sample.roughness).add(joint.mul(.3)).clamp(.05, 1)
  m.normalNode = bend(vec3(1, 0, 0), vec3(0, 0, -1), n, sample.normal, .6)
  m.aoNode = sample.occlusion
  m.name = 'vinci/collection-line-gallery/floor'
  m.userData = { ...LINE_GALLERY_PROVENANCE, set: set.name }
  return m
}

/** A DARK HONED STONE: the back of every shadow gap and the benches' bases. */
function darkMaterial(set: MaterialSet, L: Looks): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial({ roughness: .5, metalness: 0, side: FrontSide })
  const P = positionWorld, n = normalWorldGeometry
  const { t, b } = faceFrame(n)
  const sample = set.sample({ uv: vec2(dot(P, t), dot(P, b)), metres: 1.5 })
  m.colorNode = sample.colour.mul(L.darkTint)
  m.roughnessNode = mix(float(.32), float(.62), sample.roughness)
  m.normalNode = bend(t, b, n, sample.normal, .5)
  m.name = 'vinci/collection-line-gallery/dark-stone'
  m.userData = { ...LINE_GALLERY_PROVENANCE, set: set.name }
  return m
}

/** OILED OAK, its grain along each bench's own length on every long face
 * and up its end grain. */
function oakMaterial(set: MaterialSet, L: Looks): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial({ roughness: .55, metalness: 0, side: FrontSide })
  const P = positionWorld, n = normalWorldGeometry
  const east = attribute('grain', 'float').greaterThan(.5)
  const along = select(east, vec3(1, 0, 0), vec3(0, 0, -1))
  const grain = select(abs(dot(n, along)).greaterThan(.5), vec3(0, 1, 0), along)
  const t = cross(grain, n).normalize()
  const sample = set.sample({ uv: vec2(dot(P, t), dot(P, grain)), metres: 1.83 })
  m.colorNode = sample.colour.mul(L.oakTint)
  m.roughnessNode = mix(float(.4), float(.7), sample.roughness)
  m.normalNode = bend(t, grain, n, sample.normal, .7)
  m.aoNode = sample.occlusion
  m.name = 'vinci/collection-line-gallery/oak'
  m.userData = { ...LINE_GALLERY_PROVENANCE, set: set.name }
  return m
}

/** THE LINE'S LIMESTONE. Each slab of the field is read from its own piece
 * of the photograph, turned end for end on half of them, with its bedding
 * laid along the walk; a slab carries its own tone, and the stone is honed,
 * so it takes the window's light as a soft sheen and never as a mirror. */
function limestoneMaterial(set: MaterialSet, L: Looks): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial({ roughness: .46, metalness: 0 })
  const P = positionWorld, n = normalWorldGeometry
  const east = P.x, north = P.z.negate()
  const i = floorOf(east.sub(LINE_ORIGIN.east).div(LINE_SLAB.pitchEast).add(.5))
  const j = floorOf(north.sub(LINE_ORIGIN.north).div(LINE_SLAB.pitchNorth).add(.5))
  const h1 = hash(i, j, 3.1), h2 = hash(i, j, 7.7), h3 = hash(i, j, 13.3)
  const turn = select(h3.greaterThan(.5), float(1), float(-1))
  // the bedding runs north: the photograph's u along the walk, v across it
  const level = abs(n.y).greaterThan(.5)
  const across = select(abs(n.x).greaterThan(abs(n.z)), north, east)
  const uv = select(level, vec2(north, east.negate()), vec2(across, P.y)).mul(turn).add(vec2(h1, h2).mul(17.3))
  const sample = set.sample({ uv, metres: LINE_SLAB.pitchEast })
  const tone = float(1).add(h1.sub(.5).mul(L.stoneTone)).add(h2.sub(.5).mul(L.stoneTone.mul(.5)))
  // the honed face keeps part of the bedding: the photograph's own ratio to
  // its mean is laid back toward that mean
  const calmed = float(1).sub(L.stoneBand).div(sample.albedo.max(.05)).add(L.stoneBand)
  // a slab's edge stands in its fifteen millimetre joint, where the engine
  // casts no shadow: the joint is read dark as the grout it opens onto
  const inJoint = select(level, float(0), float(.78)).mul(L.engineTerms)
  // WHERE THE DATES ARE READ THE STONE IS WALKED: a band along the line a
  // little finer in its polish, with the dust of the walk at its edges
  const fromLine = abs(east.sub(DATE_MIDDLE_EAST - .25)), band = smoothstep(1.35, .55, fromLine)
  const edge = smoothstep(.45, 1.1, fromLine).mul(smoothstep(1.7, 1.15, fromLine))
  const walked = float(1).sub(edge.mul(L.stoneWalk.mul(.35))).add(band.mul(L.stoneWalk.mul(.12)))
  m.colorNode = sample.colour.mul(calmed).mul(L.stoneTint).mul(tone).mul(walked).mul(float(1).sub(inJoint))
  // honed: the photograph's own veins a touch rougher than the ground
  const vein = float(1).sub(sample.albedo.g).clamp(-.3, .3)
  m.roughnessNode = L.stoneRough.add(h2.sub(.5).mul(.06)).add(vein.mul(.12)).sub(band.mul(L.stoneWalk)).clamp(.2, .9)
  const t = vec3(0, 0, -1).mul(turn), b = vec3(-1, 0, 0).mul(turn)
  m.normalNode = select(level, bend(t, b, n, sample.normal, L.stoneNormal), n.transformDirection(cameraViewMatrix))
  m.name = 'vinci/collection-line-gallery/limestone'
  m.userData = { ...LINE_GALLERY_PROVENANCE, set: set.name, owned: false }
  return m
}

/** The line's other three surfaces: the grout its slabs are bedded in, the
 * bronze its years are cast in, the ink its words are painted in. */
function lineSurfaces(L: Looks): { grout: MeshStandardNodeMaterial; bronze: MeshStandardNodeMaterial; ink: MeshStandardNodeMaterial } {
  const P = positionWorld
  const grout = new MeshStandardNodeMaterial({ roughness: .9, metalness: 0 })
  grout.colorNode = L.groutColour.mul(mx_noise_float(P.mul(3.1)).mul(.08).add(1))
  grout.name = 'vinci/collection-line-gallery/grout'
  const bronze = new MeshStandardNodeMaterial({ roughness: .34, metalness: 1 })
  // walked bronze: a finer and brighter polish where the feet cross it
  const worn = mx_noise_float(P.mul(vec3(4.3, 1, 4.3))).mul(.5).add(.5)
  bronze.colorNode = L.bronzeColour.mul(worn.mul(.18).add(.91))
  bronze.roughnessNode = L.bronzeRough.add(worn.mul(.1).sub(.05))
  bronze.name = 'vinci/collection-line-gallery/bronze'
  const ink = new MeshStandardNodeMaterial({ roughness: .86, metalness: 0 })
  ink.colorNode = L.inkColour
  ink.name = 'vinci/collection-line-gallery/ink'
  for (const m of [grout, bronze, ink]) m.userData = { ...LINE_GALLERY_PROVENANCE }
  return { grout, bronze, ink }
}

export interface LineGallery {
  /** the finish, the benches and the fittings, to ride with the rooms */
  group: Group
  /** what the line is cut from: its limestone, bronze, ink and grout */
  stones: LineMaterials
  /** light the line's own surfaces, the certainty discs among them */
  adoptLine(line: Object3D): void
  /** every set on the GPU */
  ready: Promise<void>
  /** How many takes of the room's bounce are still owed. A take is drawn in
   * a frame of its own, with the bodies it must see shown for its length. */
  tick(bodies: readonly Object3D[]): void
  /** hide the building's patch once the reading room lays its own floor */
  update(): void
  dispose(): void
}

/** The calm tier takes no probe: the hero tier's measured bounce as a fill,
 * warmer from the floor and cooler from the window side. */
const CALM_FILL = { up: [.34, .33, .31], down: [.2, .2, .21], window: [.3, .33, .38] } as const

export function mountLineGallery(stack: Stack): LineGallery {
  const tier = stack.tierName(), calm = tier === 'calm'
  const L = looks()
  const group = new Group()
  group.name = 'vinci/collection-line-gallery'
  group.userData = { ...LINE_GALLERY_PROVENANCE }
  const owned: Mesh[] = [], materials: Material[] = []

  // THE LIGHTS, from the one table that builds the fittings too
  RectAreaLightNode.setLTC(RectAreaLightTexturesLib.init())
  const solo = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('gallerysolo')
  const built: { light: Light; spec: GalleryLight }[] = [], targets: Object3D[] = []
  for (const spec of GALLERY_LIGHTS) {
    const level = solo && !spec.name.startsWith(solo) ? 0 : spec.intensity
    let light: Light
    if (spec.kind === 'area') {
      const area = new RectAreaLight(kelvinToColour(spec.kelvin), level, spec.width!, spec.height!)
      area.position.copy(v3(...spec.at))
      area.lookAt(v3(...spec.aim))
      light = area
    } else {
      const spot = new SpotLight(kelvinToColour(spec.kelvin), level, spec.reach, spec.angle, spec.penumbra, 2)
      spot.position.copy(v3(...spec.at))
      const target = new Object3D()
      target.position.copy(v3(...spec.aim))
      spot.target = target
      spot.castShadow = false
      targets.push(target)
      group.add(target)
      light = spot
    }
    light.name = `vinci/collection-line-gallery/${spec.name}`
    light.userData = { ...LINE_GALLERY_PROVENANCE }
    // hidden from the scene's own list, which every other surface reads;
    // still in the graph, so its matrices follow
    light.visible = false
    group.add(light)
    built.push({ light, spec })
  }
  const roomLights = built.filter(({ spec }) => spec.receivers === 'room').map(({ light }) => light)
  const lineLights = built.map(({ light }) => light)

  // THE ROOM'S BOUNCE: a probe at the gallery's middle, taken turned by the
  // scene's own environment turn and re-taken into the same target, so no
  // surface that reads it is ever rebuilt
  let generator: PMREMGenerator | undefined, probe: { camera: CubeCamera; target: CubeRenderTarget; pmrem: RenderTarget } | undefined
  let env: N
  if (!calm) {
    generator = new PMREMGenerator(stack.renderer)
    const target = new CubeRenderTarget(tier === 'hero' ? 256 : 128, { type: HalfFloatType })
    const camera = new CubeCamera(.05, 2400, target)
    camera.position.copy(v3(...PROBE_AT))
    probe = { camera, target, pmrem: generator.fromCubemap(target.texture) }
    env = pmremTexture(probe.pmrem.texture).mul(L.envGain).mul(L.envLift)
  } else {
    const n = normalWorldGeometry
    const up = vec3(...CALM_FILL.up), down = vec3(...CALM_FILL.down), side = vec3(...CALM_FILL.window)
    env = mix(down, up, n.y.mul(.5).add(.5)).add(side.mul(n.x.max(0))).mul(L.envGain).mul(L.envLift)
  }
  const adopt = (material: Material, rig: readonly Light[]): void => {
    const lit = material as Material & { lightsNode?: unknown; envNode?: unknown; lights?: boolean; isNodeMaterial?: boolean }
    if (!lit.isNodeMaterial || lit.lights !== true) return
    lit.lightsNode = lightsOf([...rig])
    lit.envNode = env
    material.needsUpdate = true
  }

  // THE SURFACES
  const [wallSet, floorSet, oakSet, stoneSet] = SETS.map(name => stack.materials.sync(name))
  const concrete = concreteMaterial(wallSet!, L)
  const floor = floorMaterial(floorSet!, L)
  const dark = darkMaterial(floorSet!, L)
  const oak = oakMaterial(oakSet!, L)
  const limestone = limestoneMaterial(stoneSet!, L)
  const { grout, bronze, ink } = lineSurfaces(L)
  for (const m of [concrete, floor, dark, oak]) adopt(m, roomLights)
  for (const m of [limestone, grout, bronze, ink]) adopt(m, lineLights)
  materials.push(concrete, floor, dark, oak, limestone, grout, bronze, ink)

  const make = (geometry: BufferGeometry, material: Material, name: string, occludes = false): Mesh => {
    geometry.computeBoundingBox(); geometry.computeBoundingSphere()
    const mesh = new Mesh(geometry, material)
    mesh.name = `vinci/collection-line-gallery/${name}`
    mesh.castShadow = false; mesh.receiveShadow = true
    mesh.userData = { ...LINE_GALLERY_PROVENANCE, asset: LINE_GALLERY_PROVENANCE.manifestId, labelOccluder: occludes }
    // a skin lies over the certified construction: a ray meets that first
    if (!occludes) mesh.raycast = () => {}
    owned.push(mesh)
    group.add(mesh)
    return mesh
  }
  const merged = (parts: BufferGeometry[]): BufferGeometry => {
    const g = mergeGeometries(parts.map(p => p.index ? p.toNonIndexed() : p))
    for (const p of parts) p.dispose()
    return g
  }
  const skinParts = (skin: Skin): BufferGeometry => skin.geometry()
  const solidParts = (solid: Solid): BufferGeometry => merged(solid.parts)

  const { walls, backing } = wallSkins()
  make(merged([skinParts(walls), skinParts(ceilingSkin())]), concrete, 'concrete')
  const { floor: floorSkin, patch, edge } = floorSkins()
  make(skinParts(floorSkin), floor, 'floor')
  const patchMesh = make(skinParts(patch), floor, 'floor-patch')
  make(solidParts(edge), bronze, 'field-edge')
  const bench = benches()
  make(merged([skinParts(backing), ...bench.base.parts]), dark, 'dark-stone')
  make(solidParts(bench.oak), oak, 'benches', true)
  if (!calm) {
    const { metal, lenses } = fittings()
    const anodised = new MeshStandardNodeMaterial({ color: '#17181a', roughness: .38, metalness: .8 })
    anodised.name = 'vinci/collection-line-gallery/fixtures'
    const glow = new MeshBasicNodeMaterial({ color: new Color(kelvinToColour(3000)).multiplyScalar(9) })
    glow.name = 'vinci/collection-line-gallery/lamp-faces'
    adopt(anodised, roomLights)
    materials.push(anodised, glow)
    make(solidParts(metal), anodised, 'fixtures')
    make(solidParts(lenses), glow, 'lamp-faces')
  }

  // `?galleryrig` hands an instrument the rig's levels and the looks, to lean
  // on a standing frame instead of rebuilding the page for each value
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).has('galleryrig')) {
    const full = new Map(built.map(({ light, spec }) => [light, spec.intensity]))
    ;(window as unknown as Record<string, unknown>)['__galleryRig'] = {
      names: built.map(({ spec }) => spec.name),
      solo(name: string | null) {
        for (const { light, spec } of built) light.intensity = name === null || spec.name.startsWith(name) ? full.get(light)! : 0
      },
      level(name: string, value: number) {
        for (const { light, spec } of built) if (spec.name.startsWith(name)) { light.intensity = value; full.set(light, value) }
      },
      kelvin(name: string, value: number) {
        for (const { light, spec } of built) if (spec.name.startsWith(name)) light.color.copy(kelvinToColour(value))
      },
      looks: L,
      bake: () => { owed = 3 },
    }
  }

  let owed = 0, live = true
  // three takes, so the bounce carries two bounces of its own: a pale room
  // lit from one side is lit on its far side by what its floor sends back
  const ready = Promise.all(SETS.map(name => stack.materials.load(name))).then(() => { if (live) owed = 3 }, () => { if (live) owed = 3 })

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

  let patchChecked = 0
  return {
    group,
    stones: { stone: limestone, bronze, ink, dark: grout },
    adoptLine(line) {
      line.traverse(child => {
        if (!(child instanceof Mesh)) return
        for (const surface of Array.isArray(child.material) ? child.material : [child.material]) {
          // the certainty discs are the line's own; their colours are facts
          if (surface.userData['owned'] === true) adopt(surface, lineLights)
        }
      })
    },
    ready: ready.then(() => undefined),
    tick(bodies) {
      if (owed <= 0) return
      owed--
      take([group, ...bodies])
    },
    update() {
      // once a second is enough to learn that the reading room stands: it
      // rides with the rooms, as this gallery does
      if (!patchMesh.visible || ++patchChecked % 60) return
      if (group.parent?.getObjectByName('vinci/collection-reading-room')) patchMesh.visible = false
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
