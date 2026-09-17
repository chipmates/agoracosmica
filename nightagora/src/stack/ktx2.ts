/* THE ONE KTX2 LOADER THE STACK USES. The models and the material library
   read Basis Universal files through it, so one worker pool transcodes both.
   The transcoder is two files the worker FETCHES at load rather than imports,
   so they stand in `public/basis/` and not in the bundle graph:
   `basis_transcoder.js` and `basis_transcoder.wasm`, Apache License 2.0, from
   the Basis Universal project, delivered with three and copied from its own
   libs folder. */
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js'
import type { WebGPURenderer } from 'three/webgpu'

export const ktx2 = new KTX2Loader().setTranscoderPath(`${import.meta.env.BASE_URL}basis/`)

let detected = false

/* WHICH GPU FORMAT THE TRANSCODER TARGETS IS A FACT ABOUT THE MACHINE, so it
   is read off the renderer rather than assumed: a Basis file is a container,
   not a format, and what it becomes is BC or ASTC on this desktop and ETC2 or
   ASTC on a phone. One call covers both backends, because three's WebGPU
   renderer answers `hasFeature` through its WebGL fallback too, and it has to
   happen after `renderer.init()`. Where an adapter supports no compressed
   format at all the transcoder falls back to RGBA8 and the picture still
   arrives. */
export function detectCompressedSupport(renderer: WebGPURenderer): void {
  ktx2.detectSupport(renderer)
  detected = true
}

/** a compressed map can only be asked for once the machine has been read */
export function compressedReady(): boolean {
  return detected
}
