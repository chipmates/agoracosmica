/* THE STABILITY AUDIT'S BUFFER SERVICE — loaded only when `?audit=1` asks
   for it, so the default bundle never carries a byte of it.

   An instrument that only has the picture can say that something moved. It
   cannot say WHY. These three buffers are what turns a moving pixel into a
   named cause:

     id       one integer per pixel, the mesh that won the depth test
     depth    that pixel's distance from the eye in metres, linear
     light    the shaded frame the visitor actually sees, as luminance

   Read the same pose twice with the camera shifted by a fraction of a pixel
   and the three of them separate the classes: the id changes and the two
   depths are nearly equal (two faces fighting over one depth), the id changes
   and the depths are far apart (a silhouette thinner than the pixel), the id
   holds and the light does not (the material itself). None of that arithmetic
   is here: this file renders and hands over, and every classifier lives in
   the forge.

   The shift is the projection's own view offset, which is the mechanism a
   temporal pass jitters with. A rotation would only approximate it and would
   move the eye's own parallax with it. */

import {
  Color,
  FloatType,
  Mesh,
  NearestFilter,
  RGBAFormat,
  RenderTarget,
  MeshBasicNodeMaterial,
  type Camera,
  type Material,
  type PerspectiveCamera,
  type Scene,
  type WebGPURenderer,
} from 'three/webgpu'
import * as TSL from 'three/tsl'

export interface AuditParts {
  renderer: WebGPURenderer
  scene: () => Scene | null
  camera: () => Camera | null
  /** what the scene pass asks its target for, at the ratio standing now */
  askedSamples: () => number
  /** run this once, at the end of the next frame the stack draws */
  onFrame: (run: () => void) => void
  /** a pair the stack runs at the top and the bottom of every draw */
  aroundDraw: (before: (() => void) | null, after: (() => void) | null) => void
}

interface Frame {
  tag: string
  dx: number
  dy: number
  id: Uint32Array
  depth: Float32Array
  light: Uint8Array
}

interface Body {
  id: number
  name: string
  material: string
  /** the chain of names from the scene down, which is how a body is found
      again in the source */
  path: string
}

/* ONE SHADER FOR EVERY BODY. The index rides in the material's own colour
   uniform, never as a constant in the graph: a constant per body is a
   different shader per body, and five hundred pipeline compiles turn a
   reading into an afternoon. `map` is left null on purpose, which is what
   keeps `materialColor` the bare uniform.
   r: the body, g: the metres to it. A float target carries both exactly. */
const ID_NODE = TSL.vec4(TSL.materialColor.r, TSL.positionView.z.negate(), TSL.float(0), TSL.float(1))
/** a leaf's cut, one node per atlas rather than one per body */
const CUTS = new WeakMap<object, unknown>()

function idMaterial(source: Material, index: number): MeshBasicNodeMaterial {
  const src = source as Material & {
    map?: { isTexture?: boolean } | null
    side?: number
    alphaTest?: number
    depthTest?: boolean
    depthWrite?: boolean
  }
  const mat = new MeshBasicNodeMaterial()
  mat.side = src.side ?? mat.side
  mat.alphaTest = src.alphaTest ?? 0
  mat.transparent = false
  mat.depthTest = src.depthTest ?? true
  mat.depthWrite = src.depthWrite ?? true
  mat.fog = false
  mat.toneMapped = false
  mat.color.setRGB(index, 0, 0)
  mat.colorNode = ID_NODE
  /* A LEAF IS A HOLE IN A QUAD. Its cut comes off the alpha of its own
     colour map, and a pass that drops the map turns every leaf into a card:
     the silhouette class would then be invisible exactly where it lives. */
  if (mat.alphaTest > 0 && src.map?.isTexture) {
    const atlas = src.map as object
    if (!CUTS.has(atlas)) CUTS.set(atlas, TSL.texture(atlas as never).a)
    mat.opacityNode = CUTS.get(atlas) as never
  }
  return mat
}

export function installAudit(parts: AuditParts): void {
  const { renderer } = parts
  let target: RenderTarget | null = null
  let paper: HTMLCanvasElement | null = null
  let swaps: Array<{ mesh: Mesh; was: Material | Material[]; now: Material | Material[] }> = []
  let bodies: Body[] = []
  const frames: Frame[] = []
  let shift = { dx: 0, dy: 0 }

  function stage(): { w: number; h: number } {
    const canvas = renderer.domElement
    return { w: canvas.width, h: canvas.height }
  }

  /** the bodies, indexed, with an id material each. Taken again whenever the
      instrument stands somewhere new: a wing rebuilds its station. */
  function arm(): number {
    const scene = parts.scene()
    for (const s of swaps) s.mesh.material = s.was
    swaps = []
    bodies = []
    if (!scene) return 0
    let index = 0
    scene.traverse((object) => {
      const mesh = object as Mesh
      if (!mesh.isMesh || !mesh.visible || !mesh.material) return
      // the whole chain of names, so a body in the table can be found again
      const names: string[] = []
      for (let p: typeof object | null = object; p; p = p.parent) if (p.name) names.push(p.name)
      const source = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
      if (!source) return
      index++
      bodies.push({
        id: index,
        name: mesh.name || `mesh ${index}`,
        material: source.name || source.type,
        path: names.reverse().join('/'),
      })
      const now = Array.isArray(mesh.material)
        ? mesh.material.map((m) => idMaterial(m, index))
        : idMaterial(mesh.material, index)
      swaps.push({ mesh, was: mesh.material, now })
    })
    return bodies.length
  }

  /** the id and depth of the pose standing right now, into the target */
  function idPass(): void {
    const scene = parts.scene()
    const camera = parts.camera()
    if (!scene || !camera) return
    const { w, h } = stage()
    if (!target) {
      target = new RenderTarget(w, h, {
        type: FloatType,
        format: RGBAFormat,
        depthBuffer: true,
        minFilter: NearestFilter,
        magFilter: NearestFilter,
        generateMipmaps: false,
        samples: 0,
      })
    } else if (target.width !== w || target.height !== h) target.setSize(w, h)
    const background = scene.background
    const fog = scene.fog
    const clear = renderer.getClearColor(new Color())
    const clearAlpha = renderer.getClearAlpha()
    const wasTarget = renderer.getRenderTarget()
    // id 0 is "nothing stood here": the sky is a colour, not a body
    scene.background = null
    scene.fog = null
    renderer.setClearColor(0x000000, 0)
    for (const s of swaps) s.mesh.material = s.now
    renderer.setRenderTarget(target)
    renderer.render(scene, camera)
    renderer.setRenderTarget(wasTarget)
    for (const s of swaps) s.mesh.material = s.was
    scene.background = background
    scene.fog = fog
    renderer.setClearColor(clear, clearAlpha)
  }

  /** the shaded frame, as luminance, taken inside the render that drew it:
      a canvas read in a later task is already empty on every WebGL2 path */
  function lightPass(): Uint8Array {
    const { w, h } = stage()
    paper ??= document.createElement('canvas')
    if (paper.width !== w || paper.height !== h) {
      paper.width = w
      paper.height = h
    }
    const ink = paper.getContext('2d', { willReadFrequently: true })
    const out = new Uint8Array(w * h)
    if (!ink) return out
    try {
      ink.drawImage(renderer.domElement, 0, 0)
    } catch {
      return out
    }
    const pixels = ink.getImageData(0, 0, w, h).data
    for (let i = 0, p = 0; i < out.length; i++, p += 4) {
      out[i] = (pixels[p]! * 77 + pixels[p + 1]! * 151 + pixels[p + 2]! * 28) >> 8
    }
    return out
  }

  /* THE CAMERA'S PROJECTION, MOVED BY A FRACTION OF A PIXEL, and only
     inside the draw. A wing checks its own camera against the envelope it
     was certified with, and an offset standing between two frames is a
     projection it refuses; put on at the top of the draw and taken off at
     the bottom, the shaded frame and the id pass share one pose and the
     wing's own law never sees it. */
  function setShift(dx: number, dy: number): void {
    shift = { dx, dy }
    const put = (on: boolean): void => {
      const camera = parts.camera() as PerspectiveCamera | null
      if (!camera?.setViewOffset) return
      const { w, h } = stage()
      if (!on || (dx === 0 && dy === 0)) camera.clearViewOffset()
      else camera.setViewOffset(w, h, dx, dy, w, h)
    }
    if (dx === 0 && dy === 0) {
      parts.aroundDraw(null, null)
      put(false)
    } else parts.aroundDraw(() => put(true), () => put(false))
  }

  async function capture(tag: string): Promise<{ tag: string; bodies: number; w: number; h: number }> {
    const { w, h } = stage()
    let light: Uint8Array = new Uint8Array(0)
    await new Promise<void>((done) => {
      parts.onFrame(() => {
        light = lightPass()
        idPass()
        done()
      })
    })
    const raw = target
      ? ((await renderer.readRenderTargetPixelsAsync(target, 0, 0, w, h)) as Float32Array)
      : new Float32Array(w * h * 4)
    const id = new Uint32Array(w * h)
    const depth = new Float32Array(w * h)
    for (let i = 0, p = 0; i < id.length; i++, p += 4) {
      id[i] = raw[p]! | 0
      depth[i] = raw[p + 1]!
    }
    frames.push({ tag, dx: shift.dx, dy: shift.dy, id, depth, light })
    return { tag, bodies: bodies.length, w, h }
  }

  const hook = {
    arm,
    shift: setShift,
    capture,
    frames: () => frames,
    bodies: () => bodies,
    clear: () => {
      frames.length = 0
    },
    stage,
    /* WHAT THE DEPTH BUFFER ACTUALLY IS on this machine, asked of the
       renderer rather than assumed: a reversed buffer the backend refused
       reports itself false here, and a run measured against a switch that
       never took is a run thrown away. */
    depth: () => {
      const camera = parts.camera() as PerspectiveCamera | null
      return {
        reversed: renderer.reversedDepthBuffer === true,
        logarithmic: renderer.logarithmicDepthBuffer === true,
        near: camera?.near ?? null,
        far: camera?.far ?? null,
        fov: camera?.fov ?? null,
        backend: renderer.backend?.constructor?.name ?? '',
      }
    },
    /* WHAT THE SCENE PASS IS REALLY MULTISAMPLED WITH. Asking the tier is
       not an answer: the backend normalises the request, and a count under
       four comes back as one. So a target is allocated with exactly the
       request the scene pass makes, drawn into, and the graphics object's
       own sample count is read off it. */
    samples: async () => {
      const asked = parts.askedSamples()
      const scene = parts.scene()
      const camera = parts.camera()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const backend = (renderer as any).backend
      const normalised = typeof backend?.utils?.getSampleCount === 'function' ? backend.utils.getSampleCount(asked || 1) : null
      let allocated: number | null = null
      if (scene && camera) {
        const probe = new RenderTarget(64, 64, { samples: asked })
        const was = renderer.getRenderTarget()
        renderer.setRenderTarget(probe)
        renderer.render(scene, camera)
        renderer.setRenderTarget(was)
        /* the multisampled attachment, not the resolve beside it: three
           allocates the resolve at one sample by design, so reading that
           one reports no multisampling at any count */
        const held = backend?.get?.(probe.texture)
        allocated = held?.msaaTexture?.sampleCount ?? held?.texture?.sampleCount ?? null
        probe.dispose()
      }
      return { pixelRatio: renderer.getPixelRatio(), asked, normalised, allocated, backend: backend?.constructor?.name ?? '' }
    },
    dispose: () => {
      for (const s of swaps) s.mesh.material = s.was
      swaps = []
      frames.length = 0
      target?.dispose()
      target = null
    },
  }
  ;(window as Window & { __naAudit?: unknown }).__naAudit = hook
}
