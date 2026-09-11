import {
  ClampToEdgeWrapping,
  LinearFilter,
  LinearMipmapLinearFilter,
  SRGBColorSpace,
  Texture,
} from 'three/webgpu'
import type { ManifestEntry, ManifestIndex } from '../../../manifest'

export interface PageEntry extends ManifestEntry {
  page?: string
  role?: string
}

export interface PageStream {
  /** The callback receives the manifested thumbnail before a full plate is requested. */
  load(page: string, full: boolean, onThumb?: (texture: Texture) => void): Promise<Texture>
  /** Pin the outgoing and incoming page during a turn; retain only the open page afterwards. */
  retain(keys: string[]): void
  /** Keep every displayed or incoming thumbnail alive independently of full-plate residency. */
  pinThumbnails(keys: string[]): void
  pending(): number
  textureMB(): number
  entries(): ManifestEntry[]
  dispose(): void
  errors(): string[]
}

interface Resident {
  page: string
  full: boolean
  texture: Texture
  bitmap: ImageBitmap
  bytes: number
  touched: number
}

interface Request {
  page: string
  full: boolean
  controller: AbortController
  result: Promise<Texture>
}

/** RGBA8 residency, including every actual mip level rather than a rounded 4/3 factor. */
function textureBytes(width: number, height: number): number {
  let bytes = 0
  for (;;) {
    bytes += width * height * 4
    if (width === 1 && height === 1) return bytes
    width = Math.max(1, Math.floor(width / 2))
    height = Math.max(1, Math.floor(height / 2))
  }
}

const cancelled = (): DOMException => new DOMException('Page request released', 'AbortError')

/**
 * The page key is the collection's complete `file`, never a guessed folio or filename.
 * Both resolution levels are joined by that key and by their recorded role. The
 * provenance URL is deliberately unused: only the local asset plugin serves bytes.
 */
export function createPageStream(manifest: ManifestIndex): PageStream {
  const candidates = new Map<string, PageEntry[]>()
  const residents = new Map<string, Resident>()
  const requests = new Map<string, Request>()
  const seen = new Map<string, ManifestEntry>()
  const failures = new Set<string>()
  let retained = new Set<string>()
  let pinnedThumbnails = new Set<string>()
  let mostRecentFull = ''
  let clock = 0
  let calls = 0
  let disposed = false

  for (const raw of manifest.all) {
    const entry = raw as PageEntry
    if (!entry.page || (entry.role !== 'ms-page' && entry.role !== 'ms-thumb')) continue
    const key = `${entry.role}:${entry.page}`
    const group = candidates.get(key) ?? []
    group.push(entry)
    candidates.set(key, group)
  }

  function recorded(page: string, full: boolean): PageEntry {
    const key = `${full ? 'ms-page' : 'ms-thumb'}:${page}`
    const group = candidates.get(key)
    if (group?.length !== 1) throw new Error(`${page}: expected one manifested ${full ? 'plate' : 'thumbnail'}, found ${group?.length ?? 0}`)
    const entry = group[0]!
    const wantedPath = full
      ? /^msb\/[a-zA-Z0-9_-]+\.jpg$/
      : /^msb\/thumbs\/[a-zA-Z0-9_-]+\.jpg$/
    if (entry.wing !== 'wing-vinci' || !wantedPath.test(entry.path))
      throw new Error(`${entry.id}: refused non-store manuscript path`)
    if (!entry.display || entry.class !== 'PD-ART' || !entry.licence.trim())
      throw new Error(`${entry.id}: this record does not admit a public-domain display plate`)
    if (!entry.sha256 || !/^[a-f0-9]{64}$/i.test(entry.sha256))
      throw new Error(`${entry.id}: no recorded SHA-256`)
    return entry
  }

  function release(key: string): void {
    const resident = residents.get(key)
    if (!resident) return
    residents.delete(key)
    resident.texture.dispose()
    resident.bitmap.close()
  }

  function trim(): void {
    // A turn may pin two full plates. With no turn, only the last requested
    // full plate survives; callers release the outgoing page at completion.
    for (const [key, resident] of residents) {
      if (resident.full && resident.page !== mostRecentFull && !retained.has(resident.page)) release(key)
    }
    const full = [...residents.entries()].filter(([, resident]) => resident.full)
      .sort((a, b) => Number(a[1].page === mostRecentFull) - Number(b[1].page === mostRecentFull) || a[1].touched - b[1].touched)
    while (full.length > 2) {
      const oldest = full.shift()
      if (oldest) release(oldest[0])
    }
    const thumbPinned = (resident: Resident): boolean => pinnedThumbnails.has(resident.page) || retained.has(resident.page) || resident.page === mostRecentFull
    const thumbs = [...residents.entries()]
      .filter(([, resident]) => !resident.full)
      .sort((a, b) => Number(thumbPinned(a[1])) - Number(thumbPinned(b[1])) || a[1].touched - b[1].touched)
    while (thumbs.length > 8) {
      const oldest = thumbs[0]
      // Cache pressure must never destroy pixels still attached to a sheet.
      // The table pins at most four distinct pages, below this eight-thumb cap.
      if (!oldest || thumbPinned(oldest[1])) break
      thumbs.shift()
      release(oldest[0])
    }
  }

  function wanted(page: string): boolean {
    return page === mostRecentFull || retained.has(page)
  }

  function fetchLevel(page: string, full: boolean): Promise<Texture> {
    if (disposed) return Promise.reject(cancelled())
    const entry = recorded(page, full)
    const key = entry.id
    const existing = residents.get(key)
    if (existing) {
      existing.touched = ++clock
      return Promise.resolve(existing.texture)
    }
    const inflight = requests.get(key)
    if (inflight && !inflight.controller.signal.aborted) return inflight.result
    const controller = new AbortController()
    const result = (async (): Promise<Texture> => {
      let bitmap: ImageBitmap | undefined
      try {
        const response = await fetch(`/na-assets/${entry.wing}/${entry.path}`, { signal: controller.signal })
        if (!response.ok) throw new Error(`${entry.id}: HTTP ${response.status}`)
        const blob = await response.blob()
        const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
        const hash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
        if (hash !== entry.sha256?.toLowerCase()) throw new Error(`${entry.id}: bytes do not match the manifest hash`)
        if (disposed || controller.signal.aborted || (full && !wanted(page))) throw cancelled()
        // ImageBitmap ignores Texture.flipY on both backends; orient the
        // decode once. No resize, crop, whitening or aspect correction.
        bitmap = await createImageBitmap(blob, {
          imageOrientation: 'flipY',
          premultiplyAlpha: 'none',
          colorSpaceConversion: 'none',
        })
        if (disposed || controller.signal.aborted || (full && !wanted(page))) throw cancelled()
        if (entry.pixels !== undefined && bitmap.width * bitmap.height !== entry.pixels)
          throw new Error(`${entry.id}: decoded dimensions do not match the manifest`)
        if (full && Math.max(bitmap.width, bitmap.height) > 2048)
          throw new Error(`${entry.id}: full plate exceeds the admitted 2K store resolution`)
        const texture = new Texture(bitmap)
        texture.name = entry.id
        texture.colorSpace = SRGBColorSpace
        texture.flipY = false
        texture.wrapS = texture.wrapT = ClampToEdgeWrapping
        texture.minFilter = LinearMipmapLinearFilter
        texture.magFilter = LinearFilter
        texture.generateMipmaps = true
        texture.anisotropy = 8
        texture.userData['manifestId'] = entry.id
        texture.userData['page'] = page
        texture.userData['licence'] = entry.licence
        texture.userData['width'] = bitmap.width
        texture.userData['height'] = bitmap.height
        texture.needsUpdate = true
        residents.set(key, {
          page, full, texture, bitmap,
          bytes: textureBytes(bitmap.width, bitmap.height),
          touched: ++clock,
        })
        seen.set(entry.id, entry)
        bitmap = undefined // ownership now belongs to the resident
        trim()
        return texture
      } catch (error) {
        bitmap?.close()
        if (!(error instanceof DOMException && error.name === 'AbortError'))
          failures.add(error instanceof Error ? error.message : String(error))
        throw error
      } finally {
        // A quick A → B → A may replace an aborted A before its fetch
        // settles. The old request must not erase the replacement.
        if (requests.get(key)?.controller === controller) requests.delete(key)
      }
    })()
    requests.set(key, { page, full, controller, result })
    return result
  }

  return {
    async load(page, full, onThumb) {
      if (disposed) throw cancelled()
      calls++
      try {
        if (full) {
          // Validate both joined records before issuing either request.
          recorded(page, true)
          mostRecentFull = page
          for (const request of requests.values()) {
            if (request.full && !wanted(request.page)) request.controller.abort()
          }
        }
        const thumbnail = await fetchLevel(page, false)
        if (disposed || (full && !wanted(page))) throw cancelled()
        onThumb?.(thumbnail)
        return full ? await fetchLevel(page, true) : thumbnail
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError'))
          failures.add(error instanceof Error ? error.message : String(error))
        throw error
      } finally {
        calls--
      }
    },
    retain(keys) {
      // Two are enough for the outgoing and incoming leaf. A shelf does
      // not acquire full plates merely by naming its eight thumbnails.
      retained = new Set(keys.slice(0, 2))
      if (keys.length === 0) mostRecentFull = ''
      if (keys.length === 1 && keys[0]) mostRecentFull = keys[0]
      for (const request of requests.values()) {
        if (request.full && !wanted(request.page)) request.controller.abort()
      }
      trim()
    },
    pinThumbnails(keys) {
      pinnedThumbnails = new Set(keys)
      trim()
    },
    pending: () => calls,
    textureMB: () => [...residents.values()].reduce((sum, resident) => sum + resident.bytes, 0) / (1024 * 1024),
    entries: () => [...seen.values()],
    errors: () => [...failures],
    dispose() {
      disposed = true
      for (const request of requests.values()) request.controller.abort()
      for (const key of [...residents.keys()]) release(key)
      retained.clear()
      pinnedThumbnails.clear()
    },
  }
}
