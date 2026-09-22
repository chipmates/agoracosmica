/** One admitted reproduction, unchanged, with a preview and one earned plate.
 * The hang owns the room-wide residency budget. This object owns its requests,
 * decoded bitmaps, texture mip chains, and a continuous 700 ms resolution fade.
 */
import {
  ClampToEdgeWrapping,
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  MeshBasicNodeMaterial,
  RGBAFormat,
  SRGBColorSpace,
  Texture,
  UnsignedByteType,
} from 'three/webgpu'
import { mix, texture, uniform } from 'three/tsl'
import type { ManifestEntry } from '../../../manifest'
import { assetAddress } from '../../../stack/materials'
import { validatePaintingRecord } from './policy'
import { validateSheetRecord } from './sheet-record'
import type { SheetManifestEntry } from './sheet-record'
import type { PaintingManifestEntry } from './register'

export interface PlateStreamOptions {
  /** Upload resolution only. The original prepared source is still decoded
   * and checked against its manifest before any smaller preview is made. */
  previewMaxEdge?: 512 | 1024
  /** The room's own light on this print, as a node. It multiplies the raster
   * and never touches it: no sharpening, no grade, no crop. The hang passes
   * the aperture's falloff so a print at the far end stands in that light. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tone?: any
  /** Which store family this stream reads. The picture register's plates are
   * the default; a drawn sheet carries its own record shape. The rule for
   * each family lives in this module, never in the caller. */
  family?: PlateFamily
  /** THE PREVIEW IS DRAWN BY THE CALLER'S OWN BATCH. The caller takes the
   * decoded preview once (`takePreview`) and draws it in one call with its
   * wall; this stream then draws only the earned plate, over that batch,
   * with the plate's share as its opacity. Blending the plate over the
   * preview is the same mix the unbatched material computes. */
  layered?: boolean
}
export type PlateFamily = 'painting' | 'sheet'

export interface PlateUpload {
  sourceWidth: number
  sourceHeight: number
  width: number
  height: number
  maxEdge: number
  downsampled: boolean
}

export interface PlateStream {
  material: MeshBasicNodeMaterial
  /** Always settles. A failed optional upgrade never invalidates the preview. */
  ready: Promise<void>
  available(): boolean
  update(dt: number): void
  /** Disable resolves only after the full mip chain has been released.
   * Await it before granting another stream the room's high-resolution slot. */
  high(enable: boolean): Promise<void>
  /** Requests plus unfinished first-arrival and resolution transitions. */
  pending(): number
  /** True while the earned plate is requested, resident or fading. */
  raised(): boolean
  /** A small upright copy of the decoded preview, for a row of thumbnails
   * that must not fetch or decode the same file a second time. Null when the
   * preview is not held (it failed, or a batch has taken it). */
  thumbnail(maxEdge: number): Promise<{ url: string; blob: Blob } | null>
  /** A layered stream hands its decoded preview over once, and keeps no copy:
   * the caller owns the bitmap and closes it. Null when there is none. */
  takePreview(): ImageBitmap | null
  textureMB(): number
  allocation(): { previewMB: number; fullMB: number; previewWidth: number; previewHeight: number; fullWidth: number; fullHeight: number }
  residency(): { preview: boolean; full: boolean; blending: boolean; previewUpload: PlateUpload | null; fullUpload: PlateUpload | null }
  error(): string | null
  dispose(): void
}

interface ValidPlate {
  entry: PaintingManifestEntry | SheetManifestEntry
  width: number
  height: number
  face: string
  /** The work or the sheet the two records must both name. */
  subject: string
  url: string
}
interface LoadedPlate {
  texture: Texture
  bitmap: ImageBitmap
  bytes: number
  upload: PlateUpload
}

/** The source URL is evidence, never an image endpoint. The only accepted
 * payloads are the store's explicit, hashed display records for this wing. */
function validate(entry: ManifestEntry, family: PlateFamily, preview: boolean): ValidPlate {
  if (family === 'sheet') {
    const sheet = validateSheetRecord(entry, preview ? 'sheet-thumb' : 'sheet-page')
    return { entry: sheet.entry, width: sheet.pixels.width, height: sheet.pixels.height,
      face: sheet.identity, subject: sheet.entry.sheet, url: assetAddress(sheet.entry) }
  }
  const record = validatePaintingRecord(entry, preview ? 'painting-preview' : 'painting-plate')
  return { entry: record.entry, width: record.pixels.width, height: record.pixels.height,
    face: record.identity, subject: record.entry.work_id, url: assetAddress(record.entry) }
}

/** Exact RGBA8 allocation of the actual non-square mip pyramid. */
function mipBytes(width: number, height: number): number {
  let bytes = 0
  for (;;) {
    bytes += width * height * 4
    if (width === 1 && height === 1) return bytes
    width = Math.max(1, Math.floor(width / 2))
    height = Math.max(1, Math.floor(height / 2))
  }
}

function release(plate: LoadedPlate | null): void {
  if (!plate) return
  plate.texture.dispose()
  plate.bitmap.close()
}

function uploadDimensions(plate: ValidPlate, maxEdge: number): PlateUpload {
  const ratio = Math.min(1, maxEdge / Math.max(plate.width, plate.height))
  const width = Math.max(1, Math.round(plate.width * ratio))
  const height = Math.max(1, Math.round(plate.height * ratio))
  return { sourceWidth: plate.width, sourceHeight: plate.height, width, height,
    maxEdge, downsampled: width !== plate.width || height !== plate.height }
}

async function load(plate: ValidPlate, signal: AbortSignal, upload: PlateUpload): Promise<LoadedPlate> {
  const response = await fetch(plate.url, { signal })
  if (!response.ok) throw new Error(`${plate.entry.id}: HTTP ${response.status}`)
  const blob = await response.blob()
  signal.throwIfAborted()
  // Validate the original prepared raster before making an optional lower
  // upload level. A resized image can never conceal a wrong source size.
  let bitmap = await createImageBitmap(blob, {
    imageOrientation: 'flipY', premultiplyAlpha: 'none', colorSpaceConversion: 'none',
  })
  if (signal.aborted || bitmap.width !== plate.width || bitmap.height !== plate.height) {
    bitmap.close()
    signal.throwIfAborted()
    throw new Error(`Decoded picture dimensions disagree: ${plate.entry.id}`)
  }
  if (upload.downsampled) {
    const original = bitmap
    try {
      bitmap = await createImageBitmap(original, {
        resizeWidth: upload.width, resizeHeight: upload.height, resizeQuality: 'high',
        // Original decoding already supplied orientation. Preserve the full
        // raster, including all margins, without another flip or colour step.
        imageOrientation: 'none', premultiplyAlpha: 'none', colorSpaceConversion: 'none',
      })
    } finally {
      original.close()
    }
    if (signal.aborted || bitmap.width !== upload.width || bitmap.height !== upload.height) {
      bitmap.close()
      signal.throwIfAborted()
      throw new Error(`Preview upload dimensions disagree: ${plate.entry.id}`)
    }
  }
  const t = new Texture(bitmap)
  t.name = plate.entry.id
  t.colorSpace = SRGBColorSpace
  t.flipY = false // ImageBitmap decode supplied the vertical orientation.
  t.wrapS = ClampToEdgeWrapping
  t.wrapT = ClampToEdgeWrapping
  t.magFilter = LinearFilter
  t.minFilter = LinearMipmapLinearFilter
  t.generateMipmaps = true
  // A hung painting is read along its own wall, where the pixel is tall and
  // a few texels wide: one sample takes the mip the LONG axis asks for and
  // blurs the short one away. The stack's own sets carry eight.
  t.anisotropy = 8
  t.needsUpdate = true
  t.userData['manifestId'] = plate.entry.id
  t.userData['sourceSha256'] = plate.entry.sha256
  t.userData['upload'] = { ...upload }
  return { texture: t, bitmap, bytes: mipBytes(bitmap.width, bitmap.height), upload }
}

export function createPlateStream(preview: ManifestEntry, full: ManifestEntry, options: PlateStreamOptions = {}): PlateStream {
  if (!options || typeof options !== 'object' || Array.isArray(options)
    || Object.keys(options).some(key => key !== 'previewMaxEdge' && key !== 'tone' && key !== 'family' && key !== 'layered')) throw new Error('Invalid picture preview upload options')
  const family: PlateFamily = options.family === undefined ? 'painting' : options.family
  if (family !== 'painting' && family !== 'sheet') throw new Error('Invalid picture source family')
  if (options.tone !== undefined && (options.tone === null || typeof options.tone !== 'object'
    || typeof options.tone.mul !== 'function')) throw new Error('Invalid picture room light node')
  const previewMaxEdge = options.previewMaxEdge === undefined ? 1024 : options.previewMaxEdge
  if (previewMaxEdge !== 512 && previewMaxEdge !== 1024) throw new Error('Invalid picture preview upload maximum')
  const previewRecord = validate(preview, family, true)
  const fullRecord = validate(full, family, false)
  if (previewRecord.face !== fullRecord.face || previewRecord.subject !== fullRecord.subject)
    throw new Error(`Preview and plate name different works: ${preview.id}, ${full.id}`)
  const previewUpload = uploadDimensions(previewRecord, previewMaxEdge)
  const fullUpload = uploadDimensions(fullRecord, 4096)

  const empty = new DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1, RGBAFormat, UnsignedByteType)
  empty.colorSpace = SRGBColorSpace
  empty.needsUpdate = true
  const previewNode = texture(empty)
  const fullNode = texture(empty)
  const blend = uniform(0)
  const arrival = uniform(0)
  const layered = options.layered === true
  const material = new MeshBasicNodeMaterial()
  material.name = `vinci/pictures/plate/${previewRecord.face}`
  const colour = layered ? fullNode.rgb : mix(previewNode.rgb, fullNode.rgb, blend)
  material.colorNode = options.tone === undefined ? colour : colour.mul(options.tone)
  material.opacityNode = layered ? arrival.mul(blend) : arrival
  material.transparent = true
  material.depthWrite = false
  material.toneMapped = false
  material.userData['manifestIds'] = [preview.id, full.id]

  let live = true
  let desiredHigh = false
  let previewImage: LoadedPlate | null = null
  let previewArrived = false
  let fullImage: LoadedPlate | null = null
  let previewError: string | null = null
  let fullError: string | null = null
  let requests = 1
  let highEpoch = 0
  const previewController = new AbortController()
  let highController: AbortController | null = null
  let highRequest: Promise<void> | null = null
  let fade: { from: number; to: number; started: number } | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  let arrivalStarted: number | null = null
  let arrivalTimer: ReturnType<typeof setTimeout> | null = null
  const waiters = new Set<() => void>()

  function finishWaiters(): void {
    for (const done of waiters) done()
    waiters.clear()
  }
  function releaseFull(): void {
    fullNode.value = previewImage?.texture ?? empty
    release(fullImage)
    fullImage = null
  }
  function advance(): void {
    if (arrivalStarted !== null) {
      const t = Math.min(1, Math.max(0, (performance.now() - arrivalStarted) / 240))
      arrival.value = t * t * (3 - 2 * t)
      if (t === 1) {
        arrivalStarted = null
        if (arrivalTimer !== null) clearTimeout(arrivalTimer)
        arrivalTimer = null
      }
    }
    if (!fade) return
    const t = Math.min(1, Math.max(0, (performance.now() - fade.started) / 700))
    const ease = t * t * (3 - 2 * t)
    blend.value = fade.from + (fade.to - fade.from) * ease
    if (t < 1) return
    const target = fade.to
    fade = null
    if (timer !== null) clearTimeout(timer)
    timer = null
    if (target === 0) releaseFull()
    finishWaiters()
  }
  function transition(target: 0 | 1): Promise<void> {
    advance()
    if (!fullImage) {
      blend.value = 0
      return Promise.resolve()
    }
    if (fade?.to !== target) {
      if (timer !== null) clearTimeout(timer)
      finishWaiters()
      if (blend.value === target) {
        fade = null
        timer = null
        if (target === 0) releaseFull()
        return Promise.resolve()
      }
      fade = { from: blend.value, to: target, started: performance.now() }
      // Wall-clock completion also settles an entirely frozen scene. A later
      // render sees the final uniform; no animation time is needed to load.
      timer = setTimeout(advance, 710)
    }
    return new Promise(resolve => { waiters.add(resolve) })
  }

  const ready = (async (): Promise<void> => {
    try {
      const loaded = await load(previewRecord, previewController.signal, previewUpload)
      if (!live) { release(loaded); return }
      previewImage = loaded
      previewArrived = true
      previewNode.value = loaded.texture
      fullNode.value = loaded.texture
      // The first decoded preview appears continuously. Its source colours
      // are unchanged and remain fully opaque throughout later resolution
      // switches. A separate timer also settles a frozen/reduced-motion view.
      arrivalStarted = performance.now()
      arrivalTimer = setTimeout(advance, 250)
    } catch (error) {
      if (live && !previewController.signal.aborted) previewError = String(error)
    } finally {
      requests--
    }
  })()

  async function high(enable: boolean): Promise<void> {
    if (!live) return
    desiredHigh = enable
    if (!enable) {
      ++highEpoch
      highController?.abort()
      const oldRequest = highRequest
      const fading = transition(0)
      await oldRequest
      await fading
      return
    }
    await ready
    if (!live || !desiredHigh || !previewArrived) return
    if (fullImage) { await transition(1); return }
    // If a superseded request is decoding, let it close its bitmap before a
    // new request takes the residency slot. Fetch cancellation alone cannot
    // cancel createImageBitmap once decoding has begun.
    if (highRequest) {
      await highRequest
      if (!live || !desiredHigh) return
      if (fullImage) { await transition(1); return }
    }
    const epoch = ++highEpoch
    const controller = new AbortController()
    highController = controller
    fullError = null
    requests++
    const request = (async (): Promise<void> => {
      try {
        const loaded = await load(fullRecord, controller.signal, fullUpload)
        if (!live || !desiredHigh || epoch !== highEpoch) { release(loaded); return }
        fullImage = loaded
        fullNode.value = loaded.texture
      } catch (error) {
        if (live && epoch === highEpoch && !controller.signal.aborted) fullError = String(error)
      } finally {
        requests--
        if (highController === controller) highController = null
      }
    })()
    highRequest = request
    await request
    if (highRequest === request) highRequest = null
    if (live && desiredHigh && epoch === highEpoch && fullImage) await transition(1)
  }

  return {
    material,
    ready,
    available: () => live && previewArrived,
    raised: () => live && (desiredHigh || fullImage !== null || fade !== null),
    async thumbnail(maxEdge) {
      if (!live || !previewImage) return null
      const { bitmap } = previewImage
      const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
      const width = Math.max(1, Math.round(bitmap.width * scale)), height = Math.max(1, Math.round(bitmap.height * scale))
      const canvas = new OffscreenCanvas(width, height)
      const context = canvas.getContext('2d')
      if (!context) return null
      context.imageSmoothingQuality = 'high'
      // the preview was decoded upside down for the GPU; a thumbnail stands upright
      context.setTransform(1, 0, 0, -1, 0, height)
      context.drawImage(bitmap, 0, 0, width, height)
      return { url: previewRecord.url, blob: await canvas.convertToBlob({ type: 'image/png' }) }
    },
    takePreview() {
      if (!layered || !previewImage) return null
      const { bitmap, texture: uploaded } = previewImage
      // the texture never drew: a layered material samples no preview
      if (fullNode.value === uploaded) fullNode.value = empty
      previewNode.value = empty
      uploaded.dispose()
      previewImage = null
      return bitmap
    },
    update(_dt) { if (live) advance() },
    high,
    pending: () => live ? requests + (fade ? 1 : 0) + (arrivalStarted !== null ? 1 : 0) : 0,
    textureMB: () => live ? ((previewImage?.bytes ?? 0) + (fullImage?.bytes ?? 0) + 4) / (1024 * 1024) : 0,
    allocation: () => ({ previewMB: mipBytes(previewUpload.width, previewUpload.height) / 1048576,
      fullMB: mipBytes(fullUpload.width, fullUpload.height) / 1048576,
      previewWidth: previewUpload.width, previewHeight: previewUpload.height,
      fullWidth: fullUpload.width, fullHeight: fullUpload.height }),
    residency: () => ({ preview: previewImage !== null || (layered && previewArrived), full: fullImage !== null, blending: fade !== null,
      previewUpload: previewImage ? { ...previewImage.upload } : previewArrived ? { ...previewUpload } : null,
      fullUpload: fullImage ? { ...fullImage.upload } : null }),
    error: () => previewError ?? fullError,
    dispose() {
      if (!live) return
      live = false
      ++highEpoch
      previewController.abort()
      highController?.abort()
      if (timer !== null) clearTimeout(timer)
      if (arrivalTimer !== null) clearTimeout(arrivalTimer)
      timer = null
      arrivalTimer = null
      arrivalStarted = null
      fade = null
      finishWaiters()
      material.dispose()
      release(previewImage)
      release(fullImage)
      previewImage = null
      fullImage = null
      empty.dispose()
    },
  }
}
