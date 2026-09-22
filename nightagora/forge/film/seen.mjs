// THE SEEN SET, A STAND-IN: the cells a clip can show, read off its camera
// track in node. The export's ID pass names the cells each frame actually
// shows (a pixel's id and depth give its world point); until that pass runs
// (W2), this is the frustum of every frame WITHOUT OCCLUSION, a superset: a
// false red costs minutes, a missed red costs trust.
//
// Three parts, as the design lists them:
//   (a) every cell inside the frustum of any frame, at the authored aspect;
//   (b) every cell whose shadow can fall on one of those: the cells along the
//       ray from each seen cell toward the sun, up to the top of the scene;
//   (c) when a reflecting water cell is seen, the frustum mirrored in its plane.
// (b) and (c) are dilated by one cell, so a caster or a reflected body that
// stands across a cell's edge is never lost.
import * as THREE from 'three/webgpu'
import { cellCoords, cellNumber } from './scene.mjs'

const NEAR = 0.25, FAR = 4000
/** The wing's key light draws shadows out to its far cascade (reach 100 m,
    cascades at 20 and 90, `index.ts`); no caster beyond it reaches a frame. */
const SHADOW_REACH_M = 100

/** An octree over the occupied cells: every node's leaves are one run of the
    sorted leaf list, so a node wholly inside a frustum takes its run at once. */
export function buildIndex(cells) {
  const numbers = [...cells.hashes.keys()]
  const coords = numbers.map(cellCoords)
  let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity]
  for (const c of coords) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], c[k]); hi[k] = Math.max(hi[k], c[k]) }
  let size = 1
  while (size < Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) + 1) size *= 2
  const order = coords.map((c, i) => i)
  const leaves = []
  const nodes = { min: [], max: [], first: [], count: [], child: [], start: [], end: [] }
  const make = (items, x, y, z, s) => {
    const id = nodes.min.length
    nodes.min.push([x * cells.cell, y * cells.cell, z * cells.cell])
    nodes.max.push([(x + s) * cells.cell, (y + s) * cells.cell, (z + s) * cells.cell])
    nodes.child.push([])
    nodes.start.push(leaves.length)
    if (s === 1) {
      for (const i of items) leaves.push(numbers[i])
    } else {
      const h = s / 2
      const buckets = new Map()
      for (const i of items) {
        const c = coords[i]
        const b = (c[0] >= x + h ? 4 : 0) + (c[1] >= y + h ? 2 : 0) + (c[2] >= z + h ? 1 : 0)
        if (!buckets.has(b)) buckets.set(b, [])
        buckets.get(b).push(i)
      }
      for (const b of [...buckets.keys()].sort((p, q) => p - q)) {
        nodes.child[id].push(make(buckets.get(b), x + (b & 4 ? h : 0), y + (b & 2 ? h : 0), z + (b & 1 ? h : 0), h))
      }
    }
    nodes.end[id] = leaves.length
    return id
  }
  make(order, lo[0], lo[1], lo[2], size)
  const occupied = new Set(numbers)
  return { nodes, leaves, occupied, cells }
}

const planesOf = (() => {
  const frustum = new THREE.Frustum(), m = new THREE.Matrix4()
  return (camera) => {
    m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    frustum.setFromProjectionMatrix(m)
    return frustum.planes.map((p) => [p.normal.x, p.normal.y, p.normal.z, p.constant])
  }
})()

/** The planes of the frustum mirrored in the horizontal plane y = level. */
const mirrorPlanes = (planes, level) => planes.map(([x, y, z, d]) => [x, -y, z, d + 2 * level * y])

/** Mark every leaf inside the planes; `mark` receives a run of the leaf list. */
function cull(index, planes, mark, stamp) {
  const { nodes } = index
  const visit = (id) => {
    if (stamp.full[id] === stamp.now) return
    const lo = nodes.min[id], hi = nodes.max[id]
    let inside = true
    for (const [nx, ny, nz, d] of planes) {
      const px = nx > 0 ? hi[0] : lo[0], py = ny > 0 ? hi[1] : lo[1], pz = nz > 0 ? hi[2] : lo[2]
      if (nx * px + ny * py + nz * pz + d < 0) return
      const qx = nx > 0 ? lo[0] : hi[0], qy = ny > 0 ? lo[1] : hi[1], qz = nz > 0 ? lo[2] : hi[2]
      if (nx * qx + ny * qy + nz * qz + d < 0) inside = false
    }
    if (inside || !nodes.child[id].length) {
      stamp.full[id] = stamp.now
      mark(nodes.start[id], nodes.end[id])
      return
    }
    for (const c of nodes.child[id]) visit(c)
  }
  visit(0)
}

/** The camera of one sample of a replayed track: eye, quaternion, lens. */
function cameraOf(camera, sample, aspect) {
  camera.position.set(sample[0], sample[1], sample[2])
  camera.quaternion.set(sample[3], sample[4], sample[5], sample[6])
  camera.fov = sample[7]
  camera.aspect = aspect
  camera.near = NEAR
  camera.far = FAR
  camera.updateProjectionMatrix()
  camera.updateMatrixWorld(true)
  return camera
}

/**
 * The seen set of a track: the sorted cell numbers of (a), (b) and (c).
 *   index     buildIndex(cells)
 *   samples   the track's frames, [x, y, z, qx, qy, qz, qw, fov] each
 *   aspect    the framing's authored aspect
 *   sun       the direction toward the key light
 */
export function seenSet(index, samples, { aspect, sun, mirror = [], mirrorLevel }) {
  const { leaves, occupied, cells } = index
  const seen = new Uint8Array(leaves.length)
  const stamp = { full: new Int32Array(index.nodes.min.length), now: 1 }
  const camera = new THREE.PerspectiveCamera()
  const mark = (a, b) => { seen.fill(1, a, b) }
  const planeSets = samples.map((s) => planesOf(cameraOf(camera, s, aspect)))
  for (const planes of planeSets) cull(index, planes, mark, stamp)
  const direct = []
  for (let i = 0; i < leaves.length; i++) if (seen[i]) direct.push(leaves[i])
  const extra = new Set()
  // (c) the water's mirror, when a reflecting cell is seen
  if (mirror.length && direct.some((n) => mirror.includes(n))) {
    const mirrored = new Uint8Array(leaves.length)
    const again = { full: new Int32Array(index.nodes.min.length), now: 1 }
    for (const planes of planeSets) cull(index, mirrorPlanes(planes, mirrorLevel), (a, b) => mirrored.fill(1, a, b), again)
    for (let i = 0; i < leaves.length; i++) if (mirrored[i] && !seen[i]) extra.add(leaves[i])
  }
  // (b) the casters toward the sun, inside the reach of the far cascade
  const rays = index.rays ??= new Map()
  const step = cells.cell
  const lo = [0, 1, 2].map((k) => Math.min(...samples.map((s) => s[k])) - SHADOW_REACH_M)
  const hi = [0, 1, 2].map((k) => Math.max(...samples.map((s) => s[k])) + SHADOW_REACH_M)
  const reached = (n) => { const c = cellCoords(n); return c.every((v, k) => (v + 1) * step >= lo[k] && v * step <= hi[k]) }
  for (const n of [...direct, ...extra]) {
    if (!reached(n)) continue
    let ray = rays.get(n)
    if (!ray) {
      ray = []
      const [cx, cy, cz] = cellCoords(n)
      const p = [(cx + .5) * step, (cy + .5) * step, (cz + .5) * step]
      for (let k = 1; k < 4096; k++) {
        const q = [p[0] + sun[0] * k * step, p[1] + sun[1] * k * step, p[2] + sun[2] * k * step]
        if (q[1] > cells.top + step) break
        const m = cellNumber(Math.floor(q[0] / step), Math.floor(q[1] / step), Math.floor(q[2] / step))
        if (occupied.has(m)) ray.push(m)
      }
      rays.set(n, ray)
    }
    for (const m of ray) if (reached(m)) extra.add(m)
  }
  const out = new Set(direct)
  for (const n of extra) {
    const [x, y, z] = cellCoords(n)
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      const m = cellNumber(x + dx, y + dy, z + dz)
      if (occupied.has(m)) out.add(m)
    }
  }
  return Float64Array.from([...out].sort((a, b) => a - b))
}
