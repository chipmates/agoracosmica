/**
 * A private material lifetime for the picture bench. The five bench-only sets
 * keep the current tier's channels, but their largest map is 1024 square.
 * Shared lobby textures and painting reproductions are never resized here.
 *
 * Create one scope for the current tier; await prepare() before building the
 * room with its stack facade. Dispose the room first and this scope second.
 * Recreate the scope when changing tiers so new map-channel choices take effect.
 */
import type { Texture } from 'three/webgpu'
import type { Stack } from '../../../../stack'
import { createMaterialLibrary, type MaterialLibrary, type MaterialSet } from '../../../../stack/materials'

const OWN = new Set(['gold-leaf', 'oak-beams', 'canvas-raw', 'plaster-lime-aged', 'oak-planks-worn'])
const MIB = 1024 * 1024
type BitmapLike = { width?: number; height?: number; close?: () => void }

interface OwnedSet {
  name: string
  set: MaterialSet
  retired: boolean
  pending: boolean
  task: Promise<MaterialSet>
}

export interface BenchMaterialBudget {
  /** All shared Stack methods retain their original closure. Only material
   * lookup, string-based detail lookup, and scope disposal are redirected. */
  stack: Stack
  prepare(): Promise<void>
  /** Private maps only, including their real mip pyramids and placeholders.
   * Add the inherited stack's texture cost once, plus plates and the probe. */
  textureMB(): number
  pending(): number
  errors(): string[]
  dispose(): void
}

function actualBytes(texture: Texture): number {
  const image = texture.image as BitmapLike | null
  let width = Math.floor(image?.width ?? 0)
  let height = Math.floor(image?.height ?? 0)
  if (width < 1 || height < 1) return 0
  let bytes = width * height * 4
  if (!texture.generateMipmaps) return bytes
  while (width > 1 || height > 1) {
    width = Math.max(1, Math.floor(width / 2))
    height = Math.max(1, Math.floor(height / 2))
    bytes += width * height * 4
  }
  return bytes
}

function mapTextures(set: MaterialSet): Texture[] {
  return set.maps ? [set.maps.albedo, set.maps.normal, set.maps.surface] : []
}

export function createBenchMaterialBudget(parent: Stack): BenchMaterialBudget {
  const tier = parent.tierName()
  const mapLimit = (name: string): number => tier === 'hero' ? 1024 : tier === 'standard' && name !== 'gold-leaf' ? 256 : 512
  const privateLibrary = createMaterialLibrary(parent.tierConfig())
  const records = new Map<string, OwnedSet>()
  const failures = new Map<string, string>()
  const closed = new WeakSet<object>()
  let live = true
  let preparing: Promise<void> | null = null

  function closeImage(value: unknown): void {
    if (!value || typeof value !== 'object' || closed.has(value)) return
    const image = value as BitmapLike
    if (typeof image.close !== 'function') return
    closed.add(value)
    image.close()
  }

  /** The shared loader has no AbortSignal API. Its Promise.all can also
   * reject while another map is still decoding. These guards belong ONLY to
   * private textures: a late bitmap is immediately closed and never published.
   * Transfers may finish after disposal, but cannot resurrect a GPU resource.
   */
  function protectTexture(texture: Texture, record: OwnedSet): void {
    Object.defineProperty(texture, 'image', {
      configurable: true,
      enumerable: true,
      get: () => texture.source.data,
      set: (next: unknown) => {
        const previous = texture.source.data
        if (previous === next && live && !record.retired) return
        // Changing storage size requires releasing the old backend texture
        // before publishing a replacement through the same TextureNode.
        texture.dispose()
        texture.source.data = live && !record.retired ? next : null
        if (previous !== next) closeImage(previous)
        if (!live || record.retired) closeImage(next)
      },
    })
  }

  function releaseRecord(record: OwnedSet): void {
    record.retired = true
    record.set.ready.value = 0
    for (const texture of mapTextures(record.set)) texture.image = null
  }

  async function capMap(texture: Texture, record: OwnedSet): Promise<void> {
    const original = texture.image as BitmapLike | null
    const width = original?.width ?? 0
    const height = original?.height ?? 0
    const limit = mapLimit(record.name)
    if (!original || Math.max(width, height) <= limit) return
    const ratio = limit / Math.max(width, height)
    const resized = await createImageBitmap(original as ImageBitmap, {
      resizeWidth: Math.max(1, Math.round(width * ratio)),
      resizeHeight: Math.max(1, Math.round(height * ratio)),
      resizeQuality: 'high',
      // The source library already flipped these bitmaps during decode.
      // Flipping a second time would reverse normals and photographed grain.
      imageOrientation: 'none',
      premultiplyAlpha: 'none',
      colorSpaceConversion: 'none',
    })
    if (!live || record.retired) {
      closeImage(resized)
      return
    }
    // The private image guard disposes storage and closes the old bitmap.
    // Colour space, wrapping, filtering, and the normal convention stay intact.
    texture.image = resized
    texture.needsUpdate = true
  }

  function abortError(): DOMException {
    return new DOMException('Picture material scope was disposed', 'AbortError')
  }

  function loadPrivate(name: string): Promise<MaterialSet> {
    const existing = records.get(name)
    if (existing) return existing.task
    if (!live) {
      const cancelled = Promise.reject<MaterialSet>(abortError())
      void cancelled.catch(() => {})
      return cancelled
    }
    // load() constructs synchronously before awaiting its manifest. sync()
    // therefore retrieves the same set without launching another request.
    const source = privateLibrary.load(name)
    const set = privateLibrary.sync(name)
    const record: OwnedSet = { name, set, retired: false, pending: true, task: Promise.resolve(set) }
    records.set(name, record)
    for (const texture of mapTextures(set)) protectTexture(texture, record)
    record.task = (async (): Promise<MaterialSet> => {
      try {
        await source
        if (!live || record.retired) throw abortError()
        if (!set.ready.value || !set.maps) throw new Error(`Material did not become ready: library/${name}`)
        // Complete map channels are retained at each tier. The allocator's
        // historical byte counter is intentionally not used after this cap.
        for (const texture of mapTextures(set)) {
          await capMap(texture, record)
          if (!live || record.retired) throw abortError()
        }
        set.maps.size = Math.max(...mapTextures(set).map(texture => {
          const image = texture.image as BitmapLike | null
          return Math.max(image?.width ?? 0, image?.height ?? 0)
        }))
        return set
      } catch (error) {
        if (live) failures.set(name, error instanceof Error ? error.message : String(error))
        releaseRecord(record)
        throw error
      } finally {
        record.pending = false
        // attach() may have added held textures after a scope was disposed.
        // Releasing the library again is harmless and clears that late list.
        if (!live) privateLibrary.dispose()
      }
    })()
    // sync() users may not await the task. Errors remain exposed through the
    // explicit APIs and prepare(), without an unhandled rejection or logging.
    void record.task.catch(() => {})
    return record.task
  }

  function privateBytes(): number {
    if (!live) return 0
    const textures = new Set<Texture>()
    for (const record of records.values()) if (!record.retired)
      for (const texture of mapTextures(record.set)) textures.add(texture)
    let bytes = 0
    for (const texture of textures) bytes += actualBytes(texture)
    return bytes
  }
  const pending = (): number => live ? [...records.values()].filter(record => record.pending).length : 0
  const errors = (): string[] => [...failures].map(([name, reason]) => `library/${name}: ${reason}`)
  function dispose(): void {
    if (!live) return
    live = false
    for (const record of records.values()) releaseRecord(record)
    privateLibrary.dispose()
  }

  const materials: MaterialLibrary = {
    load: name => OWN.has(name) ? loadPrivate(name) : parent.materials.load(name),
    sync(name) {
      if (!OWN.has(name)) return parent.materials.sync(name)
      if (!live) throw abortError()
      void loadPrivate(name)
      return records.get(name)!.set
    },
    manifest() {
      const entries = new Map(parent.materials.manifest().map(entry => [entry.id, entry]))
      for (const entry of privateLibrary.manifest()) entries.set(entry.id, entry)
      return [...entries.values()]
    },
    textureMB: () => parent.materials.textureMB() + privateBytes() / MIB,
    missing: () => [...parent.materials.missing(), ...[...failures].map(([name, reason]) => ({ name, reason }))],
    pending: () => parent.materials.pending() + pending(),
    // This follows the library's existing rule: tier changes affect future
    // loads. Recreate the bench scope to change channels on already held sets.
    setTier: tier => privateLibrary.setTier(tier),
    dispose,
  }
  const facade: Stack = {
    ...parent,
    materials,
    detail: (material, set, scales) => parent.detail(material,
      typeof set === 'string' ? materials.sync(set) : set, scales),
    dispose,
  }

  return {
    stack: facade,
    prepare() {
      if (preparing) return preparing
      preparing = (async (): Promise<void> => {
        if (!live) throw abortError()
        await Promise.all([...OWN].map(loadPrivate))
        if (!live) throw abortError()
        // Limestone is already a shared lobby set. It keeps its original
        // textures, ownership, dimensions, and material-library accounting.
        await parent.materials.load('limestone-pale')
        if (!live) throw abortError()
      })()
      void preparing.catch(() => {})
      return preparing
    },
    textureMB: () => privateBytes() / MIB,
    pending,
    errors,
    dispose,
  }
}
