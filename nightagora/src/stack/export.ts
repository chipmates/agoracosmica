/* THE FILM'S EXPORT SERVICE — loaded only when `?export=1` asks for it, so
   the default bundle never carries a byte of it (the audit's rule).

   A delivered frame is several draws of the same app, each one step of the
   harness's clock inside the frame's shutter, each with the projection moved
   by a fraction of a pixel. Every draw is read inside the render that drew
   it, decoded to linear light and added; the sum is boxed to the delivered
   size, encoded back to sRGB and quantised once, and its bytes leave over a
   local socket to the harness, which pipes them into the encoder. Once per
   delivered frame the same pose is drawn again as ids and depth, so the
   harness can name the world cells the frame showed.

   The jitter is the projection's view offset, put on at the top of the draw
   and taken off at its bottom, so the rail's own projection law never meets
   it (`assertRailProjection` runs in the wing's update, before the draw). */

import {
  Color,
  FloatType,
  NearestFilter,
  RGBAFormat,
  RenderTarget,
  type Camera,
  type DirectionalLight,
  type Material,
  type Mesh,
  type PerspectiveCamera,
  type Scene,
  type WebGPURenderer,
} from 'three/webgpu'
import { idMaterial } from './audit'

export interface ExportParts {
  renderer: WebGPURenderer
  scene: () => Scene | null
  camera: () => Camera | null
  /** run this once, at the end of the next frame the stack draws */
  onFrame: (run: () => void) => void
  /** a pair the stack runs at the top and the bottom of every draw */
  aroundDraw: (before: (() => void) | null, after: (() => void) | null) => void
}

export interface ExportOpen {
  /** the delivered frame, in pixels */
  width: number
  height: number
  /** canvas pixels per delivered pixel, per axis */
  scale: number
  /** delivered pixels per id pixel, per axis */
  idDiv: number
  /** the socket the frames leave by */
  socket: string
}

export interface FramePlan {
  tag: string
  i: number
  /** the app time of each draw, in milliseconds on the harness clock */
  times: number[]
  /** the jitter of each draw, in canvas pixels */
  jitter: Array<[number, number]>
  /** the draw whose pose is the frame's own: its camera and its ids are read */
  anchor: number
  ids: boolean
  send: boolean
  /** the film laid on the resolved frame, as the chain lays it (0 = none) */
  grain: number
  seed: number
}

/* EXACT sRGB, both ways. Decoding is a table of 256; encoding is a table
   fine enough that one step is a thousandth of a code value anywhere. */
const LIN = new Float32Array(256)
for (let c = 0; c < 256; c++) {
  const v = c / 255
  LIN[c] = v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}
const ENC_STEPS = 1 << 20
const ENC = new Float32Array(ENC_STEPS)
for (let j = 0; j < ENC_STEPS; j++) {
  const l = j / (ENC_STEPS - 1)
  ENC[j] = l <= 0.0031308 ? 12.92 * l : 1.055 * l ** (1 / 2.4) - 0.055
}

/** a linear value to its one code value, the film added in display light */
function encode(linear: number, film: number, top: number): number {
  const lin = linear < 0 ? 0 : linear > 1 ? 1 : linear
  const c = Math.round((ENC[Math.round(lin * top)]! + film) * 255)
  return c < 0 ? 0 : c > 255 ? 255 : c
}

/** the chain's own film tooth (`post.ts`, grainNode), per delivered pixel */
function tooth(x: number, y: number, seed: number): number {
  let h = (Math.imul(x, 1597334673) ^ Math.imul(y, 3812015801)) >>> 0
  h = (h ^ Math.imul(seed, 2654435761)) >>> 0
  h = Math.imul(h ^ (h >>> 16), 2246822519) >>> 0
  h = Math.imul(h ^ (h >>> 13), 3266489917) >>> 0
  h = (h ^ (h >>> 16)) >>> 0
  return h / 4294967296 - 0.5
}

export function installExport(parts: ExportParts): void {
  const { renderer } = parts
  let socket: WebSocket | null = null
  let spec: ExportOpen | null = null
  let acc: Float32Array | null = null
  let paper: HTMLCanvasElement | null = null
  let ink: CanvasRenderingContext2D | null = null
  let drawn = 0
  let jitter: [number, number] = [0, 0]
  let idDue = false
  let idTarget: RenderTarget | null = null
  let swaps: Array<{ mesh: Mesh; was: Material | Material[]; now: Material | Material[] }> = []
  let bodies: string[] = []
  let readMs = 0

  const stage = (): { w: number; h: number } => ({ w: renderer.domElement.width, h: renderer.domElement.height })

  function put(on: boolean): void {
    const camera = parts.camera() as PerspectiveCamera | null
    if (!camera?.setViewOffset) return
    const { w, h } = stage()
    if (on && (jitter[0] !== 0 || jitter[1] !== 0)) camera.setViewOffset(w, h, jitter[0], jitter[1], w, h)
    else if (camera.view?.enabled) camera.clearViewOffset()
  }

  /** the shaded frame, added in linear light, inside the render that drew it */
  function accumulate(): void {
    const t0 = performance.now()
    const { w, h } = stage()
    if (!acc || !ink || !paper) return
    ink.drawImage(renderer.domElement, 0, 0)
    const px = ink.getImageData(0, 0, w, h).data
    const sum = acc
    for (let i = 0, p = 0, a = 0; i < w * h; i++, p += 4, a += 3) {
      sum[a] = sum[a]! + LIN[px[p]!]!
      sum[a + 1] = sum[a + 1]! + LIN[px[p + 1]!]!
      sum[a + 2] = sum[a + 2]! + LIN[px[p + 2]!]!
    }
    drawn++
    readMs += performance.now() - t0
  }

  /* ONE SHADER FOR EVERY BODY, the audit's own: the index rides in the
     material's colour, so the swap costs no pipeline per body. Taken once a
     clip; the harness refuses a clip whose mounted set changes inside it. */
  function armIds(): { bodies: number; casters: number } {
    const scene = parts.scene()
    lastMounted = null
    for (const s of swaps) s.mesh.material = s.was
    swaps = []
    bodies = []
    let casters = 0
    if (!scene) return { bodies: 0, casters: 0 }
    let index = 0
    scene.traverse((object) => {
      const light = object as DirectionalLight
      if (light.isLight && light.castShadow && light.visible) casters++
      const mesh = object as Mesh
      if (!mesh.isMesh || !mesh.visible || !mesh.material) return
      const names: string[] = []
      for (let o: typeof object | null = object; o; o = o.parent) if (o.name) names.push(o.name)
      index++
      bodies.push(names.reverse().join('/') || `mesh ${index}`)
      const now = Array.isArray(mesh.material) ? mesh.material.map((m) => idMaterial(m, index)) : idMaterial(mesh.material, index)
      swaps.push({ mesh, was: mesh.material, now })
    })
    return { bodies: bodies.length, casters }
  }

  /** what is mounted and drawn now, as one number: a body built, dropped or
      hidden inside a clip turns it, and the bodies that did are named. A body
      whose every material is hidden draws nothing and is not counted. */
  let lastMounted: Map<number, Mesh> | null = null
  let lastSignature = 0
  const pathOf = (mesh: Mesh): string => {
    const names: string[] = []
    for (let o: Mesh['parent'] | Mesh = mesh; o; o = o.parent) if (o.name) names.push(o.name)
    return names.reverse().join('/') || `mesh ${mesh.id}`
  }
  const drawsSomething = (mesh: Mesh): boolean =>
    Array.isArray(mesh.material) ? mesh.material.some((m) => m.visible) : mesh.material?.visible !== false
  function eachDrawn(visit: (mesh: Mesh) => void): void {
    parts.scene()?.traverseVisible((object) => {
      const mesh = object as Mesh
      if (mesh.isMesh && drawsSomething(mesh)) visit(mesh)
    })
  }

  /* THE MOUNT RULE, under the export only. A clip is walked once in silence
     and every body any of its frames draws is taken; from its first frame to
     its last those bodies stand, whatever distance or stream would have shown
     them later or hidden them sooner. The wing's own rules still run in its
     update; the hold is put on at the top of every draw, after them. */
  const unions = new Map<string, Set<Mesh>>()
  let recording: Set<Mesh> | null = null
  let holding: Mesh[] = []
  /** what the last draw stood up that the wing had hidden: put back on release */
  let forced = new Set<Mesh['parent'] | Mesh>()
  function holdAndRecord(): void {
    forced = new Set()
    for (const mesh of holding) {
      for (let o: Mesh['parent'] | Mesh = mesh; o; o = o.parent) if (!o.visible) { o.visible = true; forced.add(o) }
    }
    if (recording) { const into = recording; eachDrawn((mesh) => { into.add(mesh) }) }
  }
  function mounted(): { meshes: number; signature: number; stood: number; changed?: { added: string[]; removed: string[]; addedCount: number; removedCount: number } } {
    const ids = new Map<number, Mesh>()
    let hash = 2166136261
    eachDrawn((mesh) => {
      ids.set(mesh.id, mesh)
      hash = Math.imul(hash ^ mesh.id, 16777619) >>> 0
    })
    let changed
    if (lastMounted && hash !== lastSignature) {
      const was = lastMounted
      const added = [...ids].filter(([id]) => !was.has(id))
      const removed = [...was].filter(([id]) => !ids.has(id))
      changed = { added: added.slice(0, 6).map(([, m]) => pathOf(m)), removed: removed.slice(0, 6).map(([, m]) => pathOf(m)), addedCount: added.length, removedCount: removed.length }
    }
    lastMounted = ids
    lastSignature = hash
    return { meshes: ids.size, signature: hash, stood: forced.size, ...(changed ? { changed } : {}) }
  }

  function idPass(): void {
    const scene = parts.scene()
    const camera = parts.camera()
    if (!scene || !camera || !spec) return
    const { w, h } = stage()
    const div = spec.idDiv * spec.scale
    const iw = Math.round(w / div)
    const ih = Math.round(h / div)
    if (!idTarget) {
      idTarget = new RenderTarget(iw, ih, { type: FloatType, format: RGBAFormat, depthBuffer: true, minFilter: NearestFilter, magFilter: NearestFilter, generateMipmaps: false, samples: 0 })
    } else if (idTarget.width !== iw || idTarget.height !== ih) idTarget.setSize(iw, ih)
    const background = scene.background
    const fog = scene.fog
    const clear = renderer.getClearColor(new Color())
    const clearAlpha = renderer.getClearAlpha()
    const wasTarget = renderer.getRenderTarget()
    /* no shadow map may be drawn from the id bodies: the shaded draw of the
       next frame would read a map made of the wrong materials */
    const held: Array<[DirectionalLight, boolean, boolean]> = []
    scene.traverse((object) => {
      const light = object as DirectionalLight
      if (!light.isLight || !light.castShadow || !light.shadow) return
      held.push([light, light.shadow.autoUpdate, light.shadow.needsUpdate])
      light.shadow.autoUpdate = false
      light.shadow.needsUpdate = false
    })
    scene.background = null
    scene.fog = null
    renderer.setClearColor(0x000000, 0)
    for (const s of swaps) s.mesh.material = s.now
    renderer.setRenderTarget(idTarget)
    renderer.render(scene, camera)
    renderer.setRenderTarget(wasTarget)
    for (const s of swaps) s.mesh.material = s.was
    for (const [light, auto, needs] of held) {
      light.shadow.autoUpdate = auto
      light.shadow.needsUpdate = needs
    }
    scene.background = background
    scene.fog = fog
    renderer.setClearColor(clear, clearAlpha)
  }

  parts.aroundDraw(
    () => {
      holdAndRecord()
      // the wing's own hook pins what the film's clock owns (the world's motion)
      ;(window as Window & { __naFilm?: { beforeDraw?: () => void } }).__naFilm?.beforeDraw?.()
      put(true)
    },
    () => {
      put(false)
      if (idDue) {
        idDue = false
        idPass()
      }
    }
  )

  /** the resolve: the box of `scale` by `scale` and every draw, in one
      division, back to sRGB, the film laid if asked, quantised once */
  function resolve(n: number, grain: number, seed: number): Uint8Array {
    const s = spec!
    const { w } = stage()
    const out = new Uint8Array(s.width * s.height * 3)
    const inv = 1 / (n * s.scale * s.scale)
    const top = ENC_STEPS - 1
    for (let y = 0, o = 0; y < s.height; y++) {
      for (let x = 0; x < s.width; x++, o += 3) {
        let r = 0
        let g = 0
        let b = 0
        for (let dy = 0; dy < s.scale; dy++) {
          let a = ((y * s.scale + dy) * w + x * s.scale) * 3
          for (let dx = 0; dx < s.scale; dx++, a += 3) {
            r += acc![a]!
            g += acc![a + 1]!
            b += acc![a + 2]!
          }
        }
        const film = grain ? tooth(x, y, seed) * grain : 0
        out[o] = encode(r * inv, film, top)
        out[o + 1] = encode(g * inv, film, top)
        out[o + 2] = encode(b * inv, film, top)
      }
    }
    return out
  }

  /** one message: a JSON head, then each part on a four byte boundary */
  function pack(head: Record<string, unknown>, blobs: ArrayBufferView[]): Uint8Array {
    const pad = (n: number): number => (n + 3) & ~3
    const sizes = blobs.map((b) => b.byteLength)
    const text = new TextEncoder().encode(JSON.stringify({ ...head, parts: sizes }))
    let total = 4 + pad(text.byteLength)
    for (const n of sizes) total += pad(n)
    const buf = new Uint8Array(total)
    new DataView(buf.buffer).setUint32(0, text.byteLength, true)
    buf.set(text, 4)
    let at = 4 + pad(text.byteLength)
    for (const b of blobs) {
      buf.set(new Uint8Array(b.buffer, b.byteOffset, b.byteLength), at)
      at += pad(b.byteLength)
    }
    return buf
  }

  /* A MACROTASK THAT IS NOT A TIMER: the app's own promises settle between
     two draws, and a nested timeout would be clamped to four milliseconds. */
  const channel = new MessageChannel()
  const waiting: Array<() => void> = []
  channel.port1.onmessage = () => waiting.shift()?.()
  const yieldTask = (): Promise<void> => new Promise((r) => { waiting.push(r); channel.port2.postMessage(0) })

  const hook = {
    async open(o: ExportOpen): Promise<{ canvas: [number, number]; ratio: number }> {
      spec = o
      const { w, h } = stage()
      if (w !== o.width * o.scale || h !== o.height * o.scale)
        throw new Error(`the canvas is ${w}x${h}, the frame asks ${o.width * o.scale}x${o.height * o.scale}`)
      acc = new Float32Array(w * h * 3)
      paper = document.createElement('canvas')
      paper.width = w
      paper.height = h
      ink = paper.getContext('2d', { willReadFrequently: true })
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        socket = new WebSocket(o.socket)
        socket.binaryType = 'arraybuffer'
        await new Promise<void>((done, fail) => {
          socket!.onopen = () => done()
          socket!.onerror = () => fail(new Error(`no socket at ${o.socket}`))
        })
      }
      return { canvas: [w, h], ratio: renderer.getPixelRatio() }
    },
    arm: armIds,
    mounted,
    /** take every body the coming frames draw as this clip's set; null stops */
    record(tag: string | null): number {
      if (tag === null) { const n = recording?.size ?? 0; recording = null; return n }
      recording = new Set()
      unions.set(tag, recording)
      return 0
    },
    /** stand a clip's set from the next draw on; null lets go and puts back
        what the wing had hidden */
    hold(tag: string | null): number {
      if (tag === null) {
        holding = []
        for (const o of forced) if (o) o.visible = false
        forced = new Set()
        return 0
      }
      const set = unions.get(tag)
      if (!set) throw new Error(`no bodies were taken for ${tag}`)
      // a body disposed since it was taken is no longer the scene's
      holding = [...set].filter((mesh) => mesh.parent !== null)
      return holding.length
    },
    bodies: () => bodies,
    /** one delivered frame: every draw of its shutter, the resolve, the send */
    async frame(plan: FramePlan) {
      if (!acc || !spec) throw new Error('open the export first')
      const t0 = performance.now()
      acc.fill(0)
      drawn = 0
      readMs = 0
      const pre = (window as Window & { __pre?: { at: (ms: number) => unknown } }).__pre
      const film = (window as Window & { __naFilm?: { state: () => { walking: boolean } } }).__naFilm
      if (!pre?.at) throw new Error('the harness clock is not installed')
      const walking: boolean[] = []
      let cam: { p: number[]; q: number[]; r: number[]; fov: number; proj: number[]; world: number[] } | null = null
      let set: ReturnType<typeof mounted> | null = null
      for (let k = 0; k < plan.times.length; k++) {
        jitter = plan.jitter[k] ?? [0, 0]
        idDue = plan.ids && k === plan.anchor
        const before = drawn
        parts.onFrame(accumulate)
        pre.at(plan.times[k]!)
        if (drawn !== before + 1) throw new Error(`draw ${k} of frame ${plan.i} was never made`)
        walking.push(Boolean(film?.state().walking))
        if (k === plan.anchor) {
          const c = parts.camera() as PerspectiveCamera
          cam = {
            p: c.position.toArray(),
            q: c.quaternion.toArray(),
            r: c.rotation.toArray().slice(0, 3) as number[],
            fov: c.fov,
            proj: c.projectionMatrix.toArray(),
            world: c.matrixWorld.toArray(),
          }
          set = mounted()
        }
        await yieldTask()
      }
      jitter = [0, 0]
      const t1 = performance.now()
      // a frame at rest carries the still's own film, so a join holds with the grain baked in
      const rgb = resolve(drawn, plan.grain, walking.every((w) => !w) ? 0 : plan.seed)
      const t2 = performance.now()
      let depth = new Float32Array(0)
      let ids = new Uint32Array(0)
      let idSize: [number, number] = [0, 0]
      if (plan.ids && idTarget) {
        const raw = (await renderer.readRenderTargetPixelsAsync(idTarget, 0, 0, idTarget.width, idTarget.height)) as Float32Array
        idSize = [idTarget.width, idTarget.height]
        depth = new Float32Array(idSize[0] * idSize[1])
        ids = new Uint32Array(idSize[0] * idSize[1])
        for (let i = 0, p = 0; i < depth.length; i++, p += 4) {
          ids[i] = raw[p]! | 0
          depth[i] = raw[p + 1]!
        }
      }
      const t3 = performance.now()
      if (plan.send && socket) {
        socket.send(pack({ t: 'frame', tag: plan.tag, i: plan.i, w: spec.width, h: spec.height, idSize, cam }, [rgb, depth, ids]))
        // the socket drains before the next frame is drawn: a queue of frames
        // in the page is memory the render does not have
        while (socket.bufferedAmount > 0) await new Promise((r) => setTimeout(r, 1))
      }
      const t4 = performance.now()
      return {
        drawn,
        walking,
        cam,
        mounted: set,
        ms: { draws: Math.round(t1 - t0 - readMs), read: Math.round(readMs), resolve: Math.round(t2 - t1), ids: Math.round(t3 - t2), send: Math.round(t4 - t3) },
      }
    },
    /** a message of the harness's own, through the same socket */
    note(head: Record<string, unknown>): void {
      socket?.send(pack({ t: 'note', ...head }, []))
    },
    close(): void {
      for (const s of swaps) s.mesh.material = s.was
      swaps = []
      idTarget?.dispose()
      idTarget = null
      acc = null
      socket?.close()
      socket = null
    },
  }
  ;(window as Window & { __naExport?: unknown }).__naExport = hook
}
