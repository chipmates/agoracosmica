/* THE RENDER STACK — one renderer, one post chain, three budgets, and the
   same code on both backends.

   WebGPU first. Where there is no adapter the SAME node graph runs on WebGL2
   through three's `forceWebGL`, which is the whole reason every material in
   this museum is written in TSL: a wing is authored once and it runs
   everywhere, at a tier the machine can afford.

   What a wing gets from this file is small on purpose:

     createStack({ canvas, tier })       the renderer, the backend, the tiers
     stack.setScene(scene, camera, look) install this scene's post chain
     stack.light({ ... })                the one key light, its ambient, its shadow
     stack.light({ hdri })               the same, with a sky as its probe and hour
     stack.reflector(plane, opts)        a planar reflection on that plane
     stack.detail(material, set, scales) the empty-plane helper
     stack.materials.load(name)          a PBR set out of the library
     stack.models.place(slug, at)        a CC0 model out of the model library
     stack.cost()                        what the last two seconds cost
     stack.tier(name)                    switch

   Everything else (the scene graph, the animation, the story) belongs to the
   wing and the stack never asks about it. */

import { PCFSoftShadowMap, Vector2, WebGPURenderer, type Camera, type Mesh, type Scene } from 'three/webgpu'
import { createCostMeter, frameBytes, type CostReading } from './cost'
import { applyDetail, type DetailNodes, type DetailScales } from './detail'
import { GRADES, resolveGrade, type Grade, type GradeName } from './grade'
import { createKeyLight, type KeyLight, type KeyLightOptions } from './light'
import { createMaterialLibrary, type MaterialLibrary, type MaterialSet } from './materials'
import { createModelLibrary, type ModelLibrary } from './models'
import { loadHDRI, type SkyProbe } from './hdri'
import { createPost, type PostChain } from './post'
import { createReflector, type Reflection, type ReflectorOptions } from './reflector'
import { loadBakedGI, type BakedGI } from './gi'
import { planVolumetrics, type Volumetrics, type VolumetricOptions } from './volumetric'
import { pickTier, readAdapter, TIERS, tierFromQuery, type Tier, type TierName } from './tier'

export type { Tier, TierName } from './tier'
export type { Grade, GradeName } from './grade'
export type { KeyLight } from './light'
export type { MaterialSet, SampledMaps } from './materials'
export type { ModelAsset, ModelLibrary, ModelPlacement } from './models'
export type { SkyProbe } from './hdri'
export type { CostReading } from './cost'

export interface StackOptions {
  canvas?: HTMLCanvasElement
  tier?: TierName
}

/** what the stack's own `light()` takes on top of the key's own options: a
    sky out of the library, which is both the probe every surface reflects
    and, unless the caller names its own hour, the direction and temperature
    of the key. A room lit from one place and reflecting a sun standing in
    another is two hours in one frame. */
export interface StackLightOptions extends KeyLightOptions {
  hdri?: SkyProbe
}

export interface Stack {
  renderer: WebGPURenderer
  backend: 'webgpu' | 'webgl2'
  /** what the adapter called the hardware; 'swiftshader' means the CPU */
  architecture: string
  setScene: (scene: Scene, camera: Camera, grade: GradeName | Grade | null | undefined) => void
  light: (opts: StackLightOptions) => KeyLight
  /** how many key rigs are installed right now (the leak gate reads this) */
  lights: () => number
  /** how many objects stand in the scene right now: a rig that leaks shows
      here before it shows in a frame */
  sceneObjects: () => number
  reflector: (plane: Mesh, opts?: ReflectorOptions) => Reflection
  detail: (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    material: any,
    set: MaterialSet | string,
    scales?: DetailScales
  ) => DetailNodes
  materials: MaterialLibrary
  /** the CC0 models: a window with a reveal, a barrel with staves, a rope
      that is a rope. Real scale, manifested, cached, instanced on repeat. */
  models: ModelLibrary
  /** one of the library's three equirectangular skies, as a probe a scene
      hands to `light({ probe })` */
  hdri: (name: string) => Promise<SkyProbe>
  cost: () => CostReading
  tier: (name: TierName) => void
  tierName: () => TierName
  tierConfig: () => Tier
  volumetrics: (opts: VolumetricOptions) => Volumetrics
  gi: (scope: string) => BakedGI
  /** draw one frame through the whole chain */
  render: (dt: number) => void
  setSize: (width: number, height: number) => void
  dispose: () => void
}

/**
 * Build the stack. Async because the backend is a fact about the machine and
 * the tier is chosen from it: guessing either would make every number the
 * cost meter prints a guess too.
 */
export async function createStack(opts: StackOptions = {}): Promise<Stack> {
  const adapter = await readAdapter()
  let tierName: TierName = opts.tier ?? tierFromQuery() ?? pickTier(adapter)
  let tier = TIERS[tierName]

  const renderer = new WebGPURenderer({
    canvas: opts.canvas,
    /* the swap chain only ever receives one fullscreen quad, so multisampling
       it would cost memory to resolve an image that has no edges in it. The
       MSAA that matters is on the scene pass, per tier. */
    antialias: false,
    forceWebGL: adapter === null,
  })
  renderer.setPixelRatio(Math.min(devicePixelRatio, tier.pixelRatio))
  renderer.setSize(innerWidth, innerHeight)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = PCFSoftShadowMap
  /* the post chain runs several render passes per frame and three clears its
     counters at the top of each one: without this the meter would report the
     cost of the last fullscreen quad and call it the frame */
  renderer.info.autoReset = false
  await renderer.init()

  const backend: 'webgpu' | 'webgl2' = adapter === null ? 'webgl2' : 'webgpu'
  const architecture = adapter?.architecture ?? 'webgl2'
  const materials = createMaterialLibrary(tier)
  // the renderer is what tells the KTX2 transcoder which GPU format to target
  const models = createModelLibrary(tier, materials, renderer)
  const meter = createCostMeter(renderer)
  const lights: KeyLight[] = []

  let chain: PostChain | null = null
  let scene: Scene | null = null
  let camera: Camera | null = null
  let look: Grade = GRADES['lapis-ember']

  document.body.dataset['tier'] = tierName
  document.body.dataset['backend'] = backend
  // the rig asserts on this line, so it is one line and it never moves
  console.log(`backend=${backend} tier=${tierName} adapter=${architecture}`)

  function build(): void {
    if (!scene || !camera) return
    chain?.dispose()
    chain = createPost(renderer, scene, camera, tier, look)
  }

  function setScene(
    nextScene: Scene,
    nextCamera: Camera,
    grade: GradeName | Grade | null | undefined
  ): void {
    look = resolveGrade(grade)
    const same = nextScene === scene && nextCamera === camera
    scene = nextScene
    camera = nextCamera
    for (const l of lights) l.setCamera(nextCamera)
    // the same scene under a new look only re-aims the dials: a rebuild here
    // is a shader compile, and a shader compile mid-descent is a stutter
    if (same && chain) chain.setGrade(look)
    else build()
  }

  return {
    renderer,
    backend,
    architecture,

    setScene,

    light(o) {
      if (!scene) throw new Error('setScene before light: the key belongs to a scene')
      /* ONE KEY PER SCENE, and the list says so. A wing that rebuilds its
         station keeps calling this, and a rig that is only pushed is a
         directional light, a target and two shadow maps left in the scene
         per jump. The replaced rig is disposed and dropped here; a rig the
         caller disposed itself is dropped too. */
      const here = scene
      for (let i = lights.length - 1; i >= 0; i--) {
        const old = lights[i]
        if (!old) continue
        if (old.scene !== here && old.live()) continue
        if (old.live()) old.dispose()
        lights.splice(i, 1)
      }
      const sky = o.hdri
      const rig = createKeyLight(
        here,
        tier,
        sky
          ? {
              azimuth: sky.sun.azimuth,
              elevation: sky.sun.elevation,
              kelvin: sky.sun.kelvin,
              ...o,
              probe: o.probe ?? sky.texture,
            }
          : o
      )
      if (camera) rig.setCamera(camera)
      lights.push(rig)
      return rig
    },

    reflector(plane, o = {}) {
      if (!scene) throw new Error('setScene before reflector')
      return createReflector(scene, plane, {
        ...o,
        resolutionScale: o.resolutionScale ?? tier.reflection.scale,
      })
    },

    detail(material, set, scales = {}) {
      const resolved = typeof set === 'string' ? materials.sync(set) : set
      return applyDetail(material, resolved, { count: tier.detail, ...scales })
    },

    materials,
    models,

    hdri: loadHDRI,

    cost() {
      const size = renderer.getDrawingBufferSize(new Vector2())
      return {
        ...meter.read(),
        tier: tierName,
        backend,
        textureMB: Math.round((materials.textureMB() + models.textureMB()) * 100) / 100,
        models: {
          loaded: models.loaded().length,
          tris: models.tris(),
          textureMB: Math.round(models.textureMB() * 100) / 100,
        },
        frameMB: Math.round((frameBytes(tier, size.x, size.y, renderer.getPixelRatio()) / (1024 * 1024)) * 10) / 10,
        budget: tier.budget,
      }
    },

    /* Switches the post chain, the pixel ratio and the shadows. What it
       cannot switch is a scene-graph decision a scene made when it was
       built: a planar reflection is a second pass over the scene, and
       whether that pass exists was settled at construction. So the cost
       table is measured from `?tier=` on a fresh page, which is what the
       rig does, and this is the owner's live dial. */
    tier(name) {
      if (name === tierName) return
      tierName = name
      tier = TIERS[name]
      document.body.dataset['tier'] = name
      renderer.setPixelRatio(Math.min(devicePixelRatio, tier.pixelRatio))
      materials.setTier(tier)
      models.setTier(tier)
      for (const l of lights) l.setTier(tier)
      meter.reset()
      build()
    },

    /** how many key rigs the stack is holding. A number a leak cannot hide
        behind: it is one per live scene, and it does not grow with jumps. */
    lights: () => lights.length,
    sceneObjects: () => scene?.children.length ?? 0,

    tierName: () => tierName,
    tierConfig: () => tier,

    volumetrics: (o) => planVolumetrics(tier, o),
    gi: (scopeName) => loadBakedGI(scopeName),

    render(dt) {
      if (!scene || !camera) return
      renderer.info.reset()
      const started = performance.now()
      chain?.update(dt)
      if (chain) chain.post.render()
      else renderer.render(scene, camera)
      meter.sample(dt * 1000, performance.now() - started)
    },

    setSize(width, height) {
      renderer.setSize(width, height)
    },

    dispose() {
      materials.dispose()
      models.dispose()
      for (const l of lights) l.dispose()
      lights.length = 0
      chain?.dispose()
      renderer.dispose()
    },
  }
}
