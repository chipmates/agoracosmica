/** Controlled, additional evidence view; never a commissioned picture state.
 * Both sides share size, geometry, UVs, camera and light. The left side uses
 * the loaded library's default treatment; the right borrows the real current
 * production shader. No reference thumbnail/photo is sampled or displayed.
 *
 * Await prepareRoomMaterials(scopedStack) before calling this synchronous API.
 * The caller supplies lighting, the camera and caption DOM. Suggested poses:
 * desktop camera (0, 1.55, 4), target (0, 1.55, .08), vertical FOV 40 degrees;
 * 390x844 phone camera (0, 1.55, 7.9), same target/FOV. Both pair centres are
 * equally distant from either centred camera; do not rotate only one sample.
 * These settings compare the two local treatments. The unknown photographic
 * and library-preview render settings are not reproduced or claimed.
 */
import {
  Box3, Float32BufferAttribute, Group, Mesh, MeshStandardNodeMaterial,
  PlaneGeometry,
} from 'three/webgpu'
import { uv } from 'three/tsl'
import type { Stack } from '../../../../stack'
import type { MaterialSet } from '../../../../stack/materials'
import { buildFrameBatch } from '../frame'
import { buildPictureRoom } from './room'

export type MaterialPairKind = 'gold' | 'plaster' | 'oak' | 'limestone'
export const MATERIAL_PAIR_MANIFEST_ID = 'vinci/pictures/material-pairs'
export interface MaterialPairCaption { text: string; x: number; y: number; z: number }
export interface MaterialPair {
  group: Group
  /** Bounds in the returned group's local metres, before caller placement. */
  bounds: Box3
  captions: MaterialPairCaption[]
  /** Releases only this pair's geometry/material instances, never set maps. */
  dispose(): void
}

const CENTRE_Y = 1.55
const OFFSET_X = .7
const SAMPLE_Z = .08
const SETS = {
  gold: 'gold-leaf', plaster: 'plaster-lime-aged',
  oak: 'oak-planks-worn', limestone: 'limestone-pale',
} as const
const ROOM_MATERIAL = {
  plaster: 'vinci/pictures/room/plaster',
  oak: 'vinci/pictures/room/oak-boards',
  limestone: 'vinci/pictures/room/limestone-reveals',
  backing: 'vinci/pictures/room/graphite-plinth',
} as const

function admittedSet(stack: Stack, name: string): MaterialSet {
  const set = stack.materials.sync(name)
  if (!set.ready.value || set.entry.class !== 'CC0' || !set.entry.display)
    throw new Error(`Material pair requires the loaded, displayable CC0 set library/${name}`)
  return set
}

/** Clone the current production material instead of copying its recipe into
 * this evidence helper. Room disposal releases its own temporary instances;
 * NodeMaterial clones keep their node graphs and shared library-map references.
 * Material.dispose() never disposes those library-owned textures.
 */
function productionRoomMaterial(stack: Stack, kind: Exclude<MaterialPairKind, 'gold'> | 'backing'): MeshStandardNodeMaterial {
  for (const name of ['plaster-lime-aged', 'oak-planks-worn', 'oak-beams', 'limestone-pale'])
    admittedSet(stack, name)
  const room = buildPictureRoom(stack, 0)
  try {
    const mesh = room.group.getObjectByName(ROOM_MATERIAL[kind])
    if (!(mesh instanceof Mesh) || !(mesh.material instanceof MeshStandardNodeMaterial))
      throw new Error(`Production room material is unavailable: ${ROOM_MATERIAL[kind]}`)
    return mesh.material.clone()
  } finally {
    room.dispose()
  }
}

export function buildMaterialPair(stack: Stack, kind: MaterialPairKind): MaterialPair {
  if (!Object.hasOwn(SETS, kind)) throw new Error(`Unknown material-pair kind: ${kind}`)
  const set = admittedSet(stack, SETS[kind])
  const group = new Group()
  group.name = `vinci/pictures/material-pair/${kind}`
  group.userData['manifestId'] = MATERIAL_PAIR_MANIFEST_ID
  group.userData['materialPair'] = {
    kind, sourceSet: set.entry.id, left: 'library-default', right: 'picture-room-production',
    equalGeometry: true, centres_m: [[-OFFSET_X, CENTRE_Y, SAMPLE_Z], [OFFSET_X, CENTRE_Y, SAMPLE_Z]],
    sourcePreviewSettings: 'unknown; this is a controlled local comparison',
  }
  const geometries = new Set<PlaneGeometry>()
  const materials = new Set<MeshStandardNodeMaterial>()
  const owners: Array<{ dispose(): void }> = []
  let live = true
  const dispose = (): void => {
    if (!live) return
    live = false
    group.removeFromParent()
    for (const owner of owners) owner.dispose()
    for (const geometry of geometries) geometry.dispose()
    for (const material of materials) material.dispose()
    group.clear()
  }

  try {
    // Explicit UVs make the default library treatment use the same metre
    // coordinates as the production sample. All other options remain default.
    const stock = set.material({ uv: uv() })
    stock.name = `vinci/pictures/material-pair/${kind}/library-default`
    stock.userData['manifestId'] = set.entry.id
    materials.add(stock)
    let captions: MaterialPairCaption[]

    if (kind === 'gold') {
      admittedSet(stack, 'oak-beams')
      // The same ID preserves the exact UV and leafSeed buffers. Translation
      // is applied only to the returned groups, not to one frame's geometry.
      const placement = { id: 'material-pair-identical-frame', x: 0, y: CENTRE_Y, width: .65, height: .80 }
      const left = buildFrameBatch(stack, [{ ...placement }])
      owners.push(left)
      const right = buildFrameBatch(stack, [{ ...placement }])
      owners.push(right)
      left.group.position.x = -OFFSET_X
      right.group.position.x = OFFSET_X
      let replacements = 0
      left.group.traverse(object => {
        if (!(object instanceof Mesh) || Array.isArray(object.material)) return
        if (object.material.name !== 'vinci/pictures/gold-leaf') return
        // Only the principal gold surface changes. The actual swept profile,
        // recessed leaf and wooden rebate are identical on both sides.
        object.material = stock
        object.userData['sourceMaterialManifestId'] = set.entry.id
        replacements++
      })
      if (replacements !== 1) throw new Error(`Expected one principal production gold batch, found ${replacements}`)
      group.add(left.group, right.group)
      captions = [
        { text: 'Stock library leaf · same frame', x: -OFFSET_X, y: .98, z: SAMPLE_Z },
        { text: 'Picture-room leaf · same frame', x: OFFSET_X, y: .98, z: SAMPLE_Z },
      ]
      group.userData['materialPair']['aperture_m'] = [.65, .80]
      group.userData['materialPair']['unchangedFinishes'] = ['recessed leaf', 'wooden rebate']
    } else {
      const production = productionRoomMaterial(stack, kind)
      materials.add(production)
      // Equal four-centimetre surrounds separate the quiet plaster coupon
      // from the room's own plaster. Borrow the actual three-scale graphite
      // recipe; no comparison specimen, scale, light or shader is altered.
      const backing = productionRoomMaterial(stack, 'backing')
      materials.add(backing)
      const surround = new PlaneGeometry(1.08, 1.08)
      surround.setAttribute('tone', new Float32BufferAttribute(new Float32Array(4).fill(1), 1))
      geometries.add(surround)
      for (const x of [-OFFSET_X, OFFSET_X]) {
        const mount = new Mesh(surround, backing)
        mount.position.set(x, CENTRE_Y, SAMPLE_Z - .01)
        mount.receiveShadow = true
        mount.userData['manifestId'] = MATERIAL_PAIR_MANIFEST_ID
        group.add(mount)
      }
      const leftGeometry = new PlaneGeometry(1, 1)
      // The real room shaders multiply their colour by a per-vertex tone.
      // A unit tone isolates the material treatment from per-board variation.
      leftGeometry.setAttribute('tone', new Float32BufferAttribute(
        new Float32Array(leftGeometry.getAttribute('position').count).fill(1), 1,
      ))
      geometries.add(leftGeometry)
      const rightGeometry = leftGeometry.clone()
      geometries.add(rightGeometry)
      for (const [side, x, geometry, material] of [
        ['left', -OFFSET_X, leftGeometry, stock],
        ['right', OFFSET_X, rightGeometry, production],
      ] as const) {
        const mesh = new Mesh(geometry, material)
        mesh.name = `vinci/pictures/material-pair/${kind}/${side}`
        mesh.position.set(x, CENTRE_Y, SAMPLE_Z)
        mesh.receiveShadow = true
        mesh.userData['manifestId'] = MATERIAL_PAIR_MANIFEST_ID
        mesh.userData['sourceMaterialManifestId'] = side === 'left' ? set.entry.id : 'vinci/pictures/bench-room'
        group.add(mesh)
      }
      captions = [
        { text: 'Stock library · 1 m square', x: -OFFSET_X, y: .90, z: SAMPLE_Z },
        { text: 'Picture room · 1 m square', x: OFFSET_X, y: .90, z: SAMPLE_Z },
      ]
      group.userData['materialPair']['sample_m'] = [1, 1]
      group.userData['materialPair']['tone'] = 1
      group.userData['materialPair']['scope'] = 'Material shader on a flat coupon; board joints and room architecture are not compared'
    }
    group.updateMatrixWorld(true)
    const bounds = new Box3().setFromObject(group)
    return { group, bounds, captions, dispose }
  } catch (error) {
    dispose()
    throw error
  }
}
