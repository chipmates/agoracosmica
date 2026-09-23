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
import { createLedger, type Ledger } from './ledger'
import { applyDetail, type DetailNodes, type DetailScales } from './detail'
import { GRADES, resolveGrade, type Grade, type GradeName } from './grade'
import { createKeyLight, type KeyLight, type KeyLightOptions } from './light'
import { createMaterialLibrary, type MaterialLibrary, type MaterialSet } from './materials'
import { createModelLibrary, type ModelLibrary } from './models'
import { loadHDRI, type SkyProbe } from './hdri'
import { createPost, samplesFor, type PostChain } from './post'
import { createReflector, type Reflection, type ReflectorOptions } from './reflector'
import { loadBakedGI, type BakedGI } from './gi'
import { planVolumetrics, type Volumetrics, type VolumetricOptions } from './volumetric'
import { maxFromQuery, pickTier, readAdapter, TIER_MAX, TIERS, tierFromQuery, type Tier, type TierName } from './tier'

export type { Tier, TierName } from './tier'
export type { Grade, GradeName } from './grade'
export type { KeyLight } from './light'
export { SHADOW_ONLY_LAYER } from './light'
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
  /** `snap` stands the print at the grade at once instead of easing to it */
  setScene: (scene: Scene, camera: Camera, grade: GradeName | Grade | null | undefined, snap?: boolean) => void
  /** true under the film's tier (`?tier=max`): hero's bodies, the film's frame */
  film: boolean
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
  /** Include privately owned image mip chains in the shared texture meter.
   * The owner unregisters before releasing its streams. Values are MiB. */
  registerTextureMemory: (measure: () => number, name?: string) => () => void
  /** what holds the texture line, owner by owner, in MiB */
  textures: () => Array<{ owner: string; MB: number }>
  /** the probe's own instrument: draws by body and pass, first uses by kind */
  ledger: Ledger
  /** Work the entry's warm up waits for before its sweep: a body a walk can
      show that is still being built when the sweep draws is a body the walk
      compiles in the middle of a stride. */
  hold: (work: Promise<unknown>) => void
  /** how many held works are still running */
  holding: () => number
  tier: (name: TierName) => void
  tierName: () => TierName
  tierConfig: () => Tier
  volumetrics: (opts: VolumetricOptions) => Volumetrics
  gi: (scope: string) => BakedGI
  /** draw one frame through the whole chain */
  render: (dt: number) => void
  setSize: (width: number, height: number) => void
  dispose: () => void
  /** THE GRAPHICS CONTEXT IS GONE. A phone under memory pressure takes the
      GPU back from the tab, and from that moment every draw is a black
      canvas. The one who owns the picture is told once, with what the
      renderer last held, so it can put a still and a way on in front of the
      visitor instead of a black room. */
  onContextLost: (told: (why: string) => void) => void
  /** true from the loss on: the loop stops asking for frames */
  contextLost: () => boolean
  /** keep the frame now on the canvas, so a loss has something to show.
      Taken inside the render that drew it: a canvas read in a later task is
      empty on every WebGL2 path. */
  keepStill: () => void
  /** the last kept frame, at a fraction of the stage's own size */
  still: () => HTMLCanvasElement | null
  /** ask the graphics context to die, for the rig that proves the recovery */
  loseContext: () => boolean
}

/**
 * Build the stack. Async because the backend is a fact about the machine and
 * the tier is chosen from it: guessing either would make every number the
 * cost meter prints a guess too.
 */
export async function createStack(opts: StackOptions = {}): Promise<Stack> {
  const adapter = await readAdapter()
  let tierName: TierName = opts.tier ?? tierFromQuery() ?? pickTier(adapter)
  const film = opts.tier === undefined && maxFromQuery()
  let tier = film ? TIER_MAX : TIERS[tierName]

  /* THE DEPTH SWITCH, off unless a query asks. The shipped picture is the
     default path and stays it; these are the arms an instrument measures the
     depth buffer's own resolution against. `reversed` is the float buffer
     with the far plane at zero (the WebGL2 fallback refuses it without
     EXT_clip_control and says so), `log` the logarithmic one, `near<cm>`
     moves only the near plane a scene sets. */
  const depthSwitch = new URLSearchParams(location.search).get('depth') ?? ''
  const nearSwitch = /^near(\d+)$/.exec(depthSwitch)

  const renderer = new WebGPURenderer({
    canvas: opts.canvas,
    /* the swap chain only ever receives one fullscreen quad, so multisampling
       it would cost memory to resolve an image that has no edges in it. The
       MSAA that matters is on the scene pass, per tier. */
    antialias: false,
    forceWebGL: adapter === null,
    reversedDepthBuffer: depthSwitch === 'reversed',
    logarithmicDepthBuffer: depthSwitch === 'log',
  })
  /* `?pr=<ratio>` caps the buffer a measured run draws into, which is the
     other half of the multisampling arithmetic: fewer device pixels each
     carrying real coverage against more device pixels carrying none. */
  const prSwitch = Number(new URLSearchParams(location.search).get('pr'))
  const ratioCap = Number.isFinite(prSwitch) && prSwitch > 0 ? prSwitch : tier.pixelRatio
  renderer.setPixelRatio(Math.min(devicePixelRatio, ratioCap))
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
  // `?ktx2=off` reads the photographs instead, for an A and B of the encode
  const materials = createMaterialLibrary(tier, { compressed: new URLSearchParams(location.search).get('ktx2') !== 'off' })
  // the renderer is what tells the KTX2 transcoder which GPU format to target
  const models = createModelLibrary(tier, materials, renderer)
  const meter = createCostMeter(renderer)
  const lights: KeyLight[] = []
  const textureOwners = new Map<() => number, string>()
  const ledger = createLedger(renderer)
  const held = new Set<Promise<unknown>>()
  // a probe run reads the residency from the first allocation on
  if (new URLSearchParams(location.search).has('probe')) ledger.install()
  /* THE RIG READS THE LEDGER HERE. It is a read and a counter; nothing is
     patched in the renderer until the rig first asks for a count. */
  ;(window as Window & { __naStack?: unknown }).__naStack = {
    ledger,
    /* what the depth buffer turned out to be, asked of the renderer rather
       than of the query: a switch a backend refused reports false here */
    depth: () => ({
      asked: depthSwitch,
      reversed: renderer.reversedDepthBuffer === true,
      logarithmic: renderer.logarithmicDepthBuffer === true,
    }),
    textures: () => textures(),
    // the rig's way to kill the graphics context on purpose, and to ask
    // whether one died on its own: the recovery cannot be proved by waiting
    // for a phone to run out of memory
    lose: () => killContext(),
    lost: () => lost !== '',
  }

  let chain: PostChain | null = null
  let scene: Scene | null = null
  let camera: Camera | null = null
  let look: Grade = GRADES['lapis-ember']
  /** one shot, run at the end of the next frame: the audit's own pass has to
      read the canvas inside the render that drew it */
  let afterFrame: (() => void) | null = null
  /* THE INSTRUMENT'S OWN PAIR, around the draw and inside it. A wing checks
     its camera against its authored envelope in its own update, which runs
     before this one: a sub-pixel offset put on here and taken off at the end
     of the same draw is the frame's own and no scene ever sees it. */
  let beforeDraw: (() => void) | null = null
  let afterDraw: (() => void) | null = null
  /* THE STABILITY AUDIT. Its own module, fetched only when the query asks,
     so the shipped bundle carries none of it. */
  if (new URLSearchParams(location.search).has('audit')) {
    void import('./audit').then((m) =>
      m.installAudit({
        renderer,
        scene: () => scene,
        camera: () => camera,
        askedSamples: () => samplesFor(tier, renderer.getPixelRatio()),
        onFrame: (run) => { afterFrame = run },
        aroundDraw: (before, after) => { beforeDraw = before; afterDraw = after },
      })
    )
  }
  /* THE FILM'S EXPORT, the audit's sibling and fetched the same way: only
     `?export=1` loads it. It holds the draw's pair for itself, so an address
     that asks for both instruments gets the export's. */
  if (new URLSearchParams(location.search).has('export')) {
    void import('./export').then((m) =>
      m.installExport({
        renderer,
        scene: () => scene,
        camera: () => camera,
        onFrame: (run) => { afterFrame = run },
        aroundDraw: (before, after) => { beforeDraw = before; afterDraw = after },
      })
    )
  }

  /* ---- the lost context, and the still that stands in for it ---- */
  /** a still this wide is under a millisecond to copy and still reads as the
      room on a phone; the height follows the stage's own shape */
  const STILL_WIDTH = 480
  const lostListeners: Array<(why: string) => void> = []
  let lost = ''
  let stillDue = false
  let still: HTMLCanvasElement | null = null
  function lose(why: string): void {
    if (lost) return
    lost = why
    console.warn(`graphics context lost: ${why}`)
    for (const told of lostListeners) told(why)
  }
  /* WebGL2 says so on the canvas, WebGPU on the device it handed out. Both
     paths end in the same word, because what the visitor sees is the same. */
  renderer.domElement.addEventListener('webglcontextlost', event => {
    // the default action kills the context for good; a restore needs it back
    event.preventDefault()
    lose('webgl context lost')
  })
  const device = (renderer as unknown as { backend?: { device?: { lost?: Promise<{ reason?: string }>; destroy?: () => void } } })
    .backend?.device
  void device?.lost?.then(info => lose(`webgpu device lost: ${info?.reason ?? 'unknown'}`))

  function killContext(): boolean {
    const gl = renderer.domElement.getContext('webgl2') as WebGL2RenderingContext | null
    const kill = gl?.getExtension('WEBGL_lose_context') as { loseContext?: () => void } | null
    if (kill?.loseContext) { kill.loseContext(); return true }
    if (device?.destroy) { device.destroy(); return true }
    return false
  }

  function takeStill(): void {
    stillDue = false
    const canvas = renderer.domElement
    if (!canvas.width || !canvas.height) return
    const keep = still ?? document.createElement('canvas')
    const scale = Math.min(1, STILL_WIDTH / canvas.width)
    keep.width = Math.max(1, Math.round(canvas.width * scale))
    keep.height = Math.max(1, Math.round(canvas.height * scale))
    const paper = keep.getContext('2d')
    if (!paper) return
    try {
      paper.drawImage(canvas, 0, 0, keep.width, keep.height)
    } catch {
      // a context already gone hands back nothing: the veil then stands plain
      return
    }
    still = keep
  }

  document.body.dataset['tier'] = film ? 'max' : tierName
  document.body.dataset['backend'] = backend
  // the rig asserts on this line, so it is one line and it never moves
  console.log(`backend=${backend} tier=${film ? 'max' : tierName} adapter=${architecture}`)

  function textures(): Array<{ owner: string; MB: number }> {
    const round = (mb: number): number => Math.round(mb * 100) / 100
    return [
      ...(materials.inventory?.() ?? []).map((set) => ({ owner: `set ${set.name} ${set.size}px x${set.maps}`, MB: round(set.MB) })),
      ...models.loaded().map((model) => ({ owner: `model ${model.slug}`, MB: round(model.textureMB) })),
      ...[...textureOwners].map(([measure, name], i) => ({ owner: name || `owner ${i}`, MB: round(measure()) })),
    ].sort((a, b) => b.MB - a.MB)
  }

  function build(): void {
    if (!scene || !camera) return
    chain?.dispose()
    chain = createPost(renderer, scene, camera, tier, look)
  }

  function setScene(
    nextScene: Scene,
    nextCamera: Camera,
    grade: GradeName | Grade | null | undefined,
    snap = false
  ): void {
    look = resolveGrade(grade)
    const same = nextScene === scene && nextCamera === camera
    scene = nextScene
    camera = nextCamera
    if (nearSwitch) {
      const lens = nextCamera as Camera & { near?: number; updateProjectionMatrix?: () => void }
      lens.near = Number(nearSwitch[1]) / 100
      lens.updateProjectionMatrix?.()
    }
    for (const l of lights) l.setCamera(nextCamera)
    // the same scene under a new look only re-aims the dials: a rebuild here
    // is a shader compile, and a shader compile mid-descent is a stutter
    if (same && chain) chain.setGrade(look, snap)
    else build()
  }

  return {
    renderer,
    backend,
    architecture,

    setScene,
    film,

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

    registerTextureMemory(measure, name = '') {
      textureOwners.set(measure, name)
      return () => { textureOwners.delete(measure) }
    },
    textures,
    ledger,
    hold(work) {
      held.add(work)
      const release = (): void => { held.delete(work) }
      work.then(release, release)
    },
    holding: () => held.size,

    cost() {
      const size = renderer.getDrawingBufferSize(new Vector2())
      return {
        ...meter.read(),
        tier: tierName,
        backend,
        textureMB: Math.round((materials.textureMB() + models.textureMB()
          + [...textureOwners.keys()].reduce((sum, measure) => sum + measure(), 0)) * 100) / 100,
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
      renderer.setPixelRatio(Math.min(devicePixelRatio, Number.isFinite(prSwitch) && prSwitch > 0 ? prSwitch : tier.pixelRatio))
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
      if (!scene || !camera || lost) return
      beforeDraw?.()
      renderer.info.reset()
      const started = performance.now()
      chain?.update(dt)
      if (chain) chain.post.render()
      else renderer.render(scene, camera)
      meter.sample(dt * 1000, performance.now() - started)
      // inside the frame that drew it: a canvas read in a later task is
      // already empty on every WebGL2 path
      if (stillDue) takeStill()
      // after the meter, so an instrument's own pass is never in the budget
      if (afterFrame) {
        const run = afterFrame
        afterFrame = null
        run()
      }
      afterDraw?.()
    },

    onContextLost(told) {
      lostListeners.push(told)
      if (lost) told(lost)
    },
    contextLost: () => lost !== '',
    keepStill: () => { stillDue = true },
    still: () => still,
    loseContext: killContext,

    setSize(width, height) {
      renderer.setSize(width, height)
    },

    dispose() {
      textureOwners.clear()
      materials.dispose()
      models.dispose()
      for (const l of lights) l.dispose()
      lights.length = 0
      chain?.dispose()
      renderer.dispose()
    },
  }
}
