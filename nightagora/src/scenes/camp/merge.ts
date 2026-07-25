/* THE MERGE — a fort is four hundred stakes, not four hundred draw calls.

   Everything repeated in this camp already rides an instanced field, but the
   hand-placed solids (towers, wagons, the picket, the desk props, the arms,
   the standards) are still one draw each, and a phone GPU feels every one of
   them. They are also, almost all of them, STILL: the only things on this
   ground that actually move are the sentries, the horses, the vexilla and
   the raven.

   So the camp finds out which of its own solids move, and welds the rest.
   It asks the world to breathe once, watches, and merges whatever did not
   change: a detector that keeps working when the fort gains new objects,
   instead of a hand-kept list that goes stale the first time someone adds
   a water barrel. */

import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import {
  type BufferGeometry,
  Float32BufferAttribute,
  Group,
  type Material,
  Mesh,
  type Object3D,
} from 'three/webgpu'

interface Candidate {
  mesh: Mesh
  geo: BufferGeometry
  mat: Material
}

/** the matrix of an object, as a comparable string */
function stamp(o: Object3D): string {
  const e = o.matrixWorld.elements
  let s = ''
  for (let i = 0; i < 16; i++) s += (e[i] ?? 0).toFixed(4) + ','
  return s
}

function isMergeable(o: Object3D): o is Mesh {
  if (!(o instanceof Mesh)) return false
  if (o.children.length) return false
  const geo = o.geometry as BufferGeometry & { isInstancedBufferGeometry?: boolean }
  if (geo.isInstancedBufferGeometry) return false
  if (!geo.attributes['position']) return false
  if (Array.isArray(o.material)) return false
  return true
}

/** every mergeable geometry has to carry the same attribute set, so the
    ones missing a uv or a normal are given a quiet one */
function normalize(geo: BufferGeometry): BufferGeometry {
  const g = geo.clone()
  const count = g.attributes['position']?.count ?? 0
  if (!g.attributes['normal']) g.computeVertexNormals()
  if (!g.attributes['uv']) g.setAttribute('uv', new Float32BufferAttribute(new Float32Array(count * 2), 2))
  // anything else a geometry happens to carry would break the weld
  for (const key of Object.keys(g.attributes)) {
    if (key !== 'position' && key !== 'normal' && key !== 'uv') g.deleteAttribute(key)
  }
  return g
}

export interface MergeReport {
  before: number
  after: number
  moving: number
}

/**
 * Weld the still solids of a group, in place.
 *
 * @param root  the world to weld
 * @param breathe  one tick of the world's own animation, so the merge can
 *                 SEE which objects move (called twice, at two times)
 */
export function mergeStatic(root: Object3D, breathe: (t: number) => void): MergeReport {
  breathe(0)
  root.updateMatrixWorld(true)
  const first = new Map<Object3D, string>()
  root.traverse((o) => first.set(o, stamp(o)))

  breathe(4.2)
  root.updateMatrixWorld(true)
  const moving = new Set<Object3D>()
  root.traverse((o) => {
    if (first.get(o) !== stamp(o)) {
      // an object that moved keeps its own draw, and so does everything
      // hanging under it
      o.traverse((c) => moving.add(c))
    }
  })
  breathe(0)

  // gather the still, mergeable solids by material and by geometry shape
  const buckets = new Map<string, Candidate[]>()
  let before = 0
  root.traverse((o) => {
    if (o instanceof Mesh) before++
    if (moving.has(o) || !isMergeable(o)) return
    const mat = o.material as Material
    const key = mat.uuid
    const list = buckets.get(key)
    if (list) list.push({ mesh: o, geo: o.geometry, mat })
    else buckets.set(key, [{ mesh: o, geo: o.geometry, mat }])
  })

  const welded = new Group()
  welded.name = 'camp-welded'
  let after = before
  for (const [, list] of buckets) {
    if (list.length < 3) continue
    const parts: BufferGeometry[] = []
    for (const c of list) {
      c.mesh.updateWorldMatrix(true, false)
      const g = normalize(c.geo)
      g.applyMatrix4(c.mesh.matrixWorld)
      parts.push(g)
    }
    let merged: BufferGeometry | null = null
    try {
      merged = mergeGeometries(parts, false)
    } catch {
      merged = null
    }
    for (const g of parts) g.dispose()
    const first0 = list[0]
    if (!merged || !first0) continue
    const mesh = new Mesh(merged, first0.mat)
    mesh.frustumCulled = false
    mesh.renderOrder = first0.mesh.renderOrder
    welded.add(mesh)
    for (const c of list) c.mesh.removeFromParent()
    after -= list.length - 1
  }
  if (welded.children.length) root.add(welded)
  return { before, after, moving: moving.size }
}
