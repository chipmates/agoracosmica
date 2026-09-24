/** THE LEAF ON THE STUDY'S SUPPORT. The admitted facsimile of Manuscript B,
 * folio 83v, lies on the board it is read at, at its own proportions: the
 * same record the reader opens at full size, fetched and checked the way the
 * reading table fetches its pages. Until it stands the wing counts it as
 * pending, so no frame is taken of an empty board.
 */
import {
  BufferGeometry, ClampToEdgeWrapping, Float32BufferAttribute, LinearFilter, LinearMipmapLinearFilter,
  Mesh, MeshStandardNodeMaterial, SRGBColorSpace, Texture, type Group,
} from 'three/webgpu'
import * as TSL from 'three/tsl'
import { assetAddress, type StoreRecord } from '../../stack/materials'
import { studySheetCorners } from './inner-court'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any
const { float, mix, smoothstep, texture, uv, vec3 } = TSL as unknown as Record<string, N>

export const STUDY_SHEET_MESH = 'vinci/study-support-sheet'
type SheetRecord = StoreRecord & { id: string; pixels?: number; licence?: string }

export interface StudySheet {
  /** hand the leaf's record over once the store's manifest stands */
  supply(record: SheetRecord | undefined): void
  pending(): number
  errors(): string[]
  /** decoded bytes, in megabytes, for the stack's texture ledger */
  textureMB(): number
  dispose(): void
}

export function createStudySheet(host: Group): StudySheet {
  let state: 'waiting' | 'loading' | 'standing' | 'failed' = 'waiting'
  let failure = '', bytes = 0, mesh: Mesh | undefined, map: Texture | undefined, bitmap: ImageBitmap | undefined
  const controller = new AbortController()
  async function load(record: SheetRecord): Promise<void> {
    const response = await fetch(assetAddress(record), { signal: controller.signal })
    if (!response.ok) throw new Error(`${record.id}: HTTP ${response.status}`)
    const blob = await response.blob()
    const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
    const hash = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
    if (hash !== record.sha256?.toLowerCase()) throw new Error(`${record.id}: bytes do not match the manifest hash`)
    // ImageBitmap ignores Texture.flipY on both backends; orient the decode once.
    bitmap = await createImageBitmap(blob, { imageOrientation: 'flipY', premultiplyAlpha: 'none', colorSpaceConversion: 'none' })
    if (controller.signal.aborted) throw new Error('disposed')
    if (record.pixels !== undefined && bitmap.width * bitmap.height !== record.pixels)
      throw new Error(`${record.id}: decoded dimensions do not match the manifest`)
    map = new Texture(bitmap)
    map.name = record.id; map.colorSpace = SRGBColorSpace; map.flipY = false
    map.wrapS = map.wrapT = ClampToEdgeWrapping
    map.minFilter = LinearMipmapLinearFilter; map.magFilter = LinearFilter
    map.generateMipmaps = true; map.anisotropy = 8; map.needsUpdate = true
    bytes = bitmap.width * bitmap.height * 4 * 4 / 3
    const corners = studySheetCorners(bitmap.width / bitmap.height)
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(
      [...corners[0]!, ...corners[1]!, ...corners[2]!, ...corners[0]!, ...corners[2]!, ...corners[3]!], 3))
    geometry.setAttribute('uv', new Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1], 2))
    geometry.computeVertexNormals(); geometry.computeBoundingSphere()
    const m = new MeshStandardNodeMaterial({ metalness: 0, roughness: .9 })
    const U = uv(), page = texture(map, U).rgb
    // Printed paper under the albedo ceiling, and a sheet's edge that has
    // been handled: a faint soiling a few millimetres in from the rim.
    const rim = U.x.min(float(1).sub(U.x)).min(U.y).min(float(1).sub(U.y))
    const handled = float(1).sub(smoothstep(.0, .035, rim))
    m.colorNode = mix(page.mul(.86), page.mul(vec3(.74, .70, .62)), handled.mul(.5))
    m.name = 'vinci/study-support-sheet'
    mesh = new Mesh(geometry, m)
    mesh.name = STUDY_SHEET_MESH
    mesh.castShadow = false; mesh.receiveShadow = true
    mesh.userData['manifestId'] = record.id; mesh.userData['asset'] = record.id
    mesh.userData['licence'] = record.licence ?? ''
    mesh.userData['labelOccluder'] = false
    host.add(mesh)
  }
  return {
    supply(record) {
      if (state !== 'waiting') return
      if (!record) { state = 'failed'; failure = 'study sheet: the leaf has no record in the store'; return }
      state = 'loading'
      load(record).then(() => { state = 'standing' }, (error: unknown) => {
        state = 'failed'; failure = error instanceof Error ? error.message : String(error)
      })
    },
    pending: () => state === 'waiting' || state === 'loading' ? 1 : 0,
    errors: () => failure && failure !== 'disposed' ? [failure] : [],
    textureMB: () => bytes / 1048576,
    dispose() {
      controller.abort()
      if (mesh) { mesh.removeFromParent(); mesh.geometry.dispose(); (mesh.material as MeshStandardNodeMaterial).dispose() }
      map?.dispose(); bitmap?.close()
      mesh = undefined; map = undefined; bitmap = undefined
    },
  }
}
