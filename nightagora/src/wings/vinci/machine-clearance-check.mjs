#!/usr/bin/env node
/** NO MOVING PART OF A MACHINE PASSES THROUGH ANOTHER PART.
 *
 * Every complete dossier is built from the same `geometry.ts` surfaces the
 * bench renders and driven by the same `motion.ts` schedule, over its whole
 * period. The step is chosen so that no point of any moving part travels more
 * than STEP_M between two samples. At every sample, each moving part is tested
 * against every part of another body and against the dossier's ground (the
 * plinth top): surface samples of each side are measured in the other side's
 * exact solid, and the deepest one is the depth.
 *
 * A contact is DESIGNED when it is a journal (a body of revolution whose
 * volume never changes in the other part's frame: a shaft in its bearing, a
 * pin in its eye), a declared joint (the joint's own parent and child) or a
 * fastening (a rope or rod end fixed in the part it is tied to, or two ropes
 * joined end to end, deep by no more than that end explains). Designed
 * contacts are listed with their depth, never skipped. A contact no deeper
 * than TOUCH_M is a touch. Everything else is a pass-through, reported with
 * the pair, the moments and the depth.
 *
 * The pass-throughs still waiting for their own window are listed in
 * `machines/clearance-known.json`. The check fails on a pass-through that is
 * not listed, on a listed one that got deeper, and on a listed one that is
 * gone (the fixer removes it). A machine not in the list must be clear.
 *
 *   node src/wings/vinci/machine-clearance-check.mjs            every machine
 *   node src/wings/vinci/machine-clearance-check.mjs --only <slug>
 *   ... --near    also the nearest miss of every pair within 5 cm (slower)
 */
import fs from 'node:fs'
import path from 'node:path'
import { load, root } from './build-in-node.mjs'

const MACHINES = 'src/wings/vinci/machines'
const { geometryForPart } = load(`${MACHINES}/geometry.ts`)
const { applyMotion, movingCentreline } = load(`${MACHINES}/motion.ts`)
const THREE = await import('three/webgpu')

const args = process.argv.slice(2)
const TOUCH_M = 0.002
// The near-miss reading is for the one fixing a machine; the gate reads depth only.
const NEAR_M = args.includes('--near') ? 0.05 : TOUCH_M
const SPACING_M = 0.005
const STEP_M = 0.004
const MAX_SAMPLES = 160_000
const INVARIANT_M = 1e-6
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null
const knownPath = path.join(root, MACHINES, 'clearance-known.json')

/* ---- exact solids, in the part's own frame; negative inside ---- */

const hyp2 = (a, b) => Math.sqrt(a * a + b * b)
/** Rounded-corner combination of two signed extents (exact for prisms). */
const combine = (a, b) => Math.min(Math.max(a, b), 0) + hyp2(Math.max(a, 0), Math.max(b, 0))

function polygonRings(rings) {
  return rings.map(ring => {
    const pts = []
    for (const p of ring) {
      const x = p[0] ?? 0, y = p[1] ?? 0
      const last = pts.length ? pts[pts.length - 1] : null
      if (!last || last[0] !== x || last[1] !== y) pts.push([x, y])
    }
    if (pts.length > 2 && pts[0][0] === pts.at(-1)[0] && pts[0][1] === pts.at(-1)[1]) pts.pop()
    return Float64Array.from(pts.flat())
  })
}
/** Signed distance to a set of polygon rings, inside by even-odd. The nearest
 * edge is found by rings of grid cells, the crossing count reads only the
 * edges of the query's own band; a point further than NEAR_M from the rings'
 * box returns that box distance, a lower bound no reading records. */
function polygonSdf(rings) {
  const list = []
  for (const r of rings) {
    const n = r.length / 2
    for (let i = 0, j = n - 1; i < n; j = i++) list.push(r[2 * j], r[2 * j + 1], r[2 * i], r[2 * i + 1])
  }
  const E = Float64Array.from(list), m = E.length / 4
  const lo = [Infinity, Infinity], hi = [-Infinity, -Infinity]
  for (let e = 0; e < m; e++) for (const k of [0, 2]) for (const a of [0, 1]) {
    lo[a] = Math.min(lo[a], E[4 * e + k + a]); hi[a] = Math.max(hi[a], E[4 * e + k + a])
  }
  const cell = Math.max(Math.max(hi[0] - lo[0], hi[1] - lo[1]) / Math.min(64, Math.max(1, Math.ceil(Math.sqrt(m)))), 1e-6)
  const nx = Math.max(1, Math.ceil((hi[0] - lo[0]) / cell + 1e-9)), ny = Math.max(1, Math.ceil((hi[1] - lo[1]) / cell + 1e-9))
  const at = (v, a, n) => Math.min(n - 1, Math.max(0, Math.floor((v - lo[a]) / cell)))
  const cells = Array.from({ length: nx * ny }, () => []), bands = Array.from({ length: ny }, () => [])
  for (let e = 0; e < m; e++) {
    const x0 = Math.min(E[4 * e], E[4 * e + 2]), x1 = Math.max(E[4 * e], E[4 * e + 2])
    const y0 = Math.min(E[4 * e + 1], E[4 * e + 3]), y1 = Math.max(E[4 * e + 1], E[4 * e + 3])
    for (let j = at(y0, 1, ny); j <= at(y1, 1, ny); j++) {
      bands[j].push(e)
      for (let i = at(x0, 0, nx); i <= at(x1, 0, nx); i++) cells[j * nx + i].push(e)
    }
  }
  const edge2 = (e, x, y) => {
    const ax = E[4 * e], ay = E[4 * e + 1], ex = E[4 * e + 2] - ax, ey = E[4 * e + 3] - ay, wx = x - ax, wy = y - ay
    const len = ex * ex + ey * ey
    const t = len > 0 ? Math.max(0, Math.min(1, (wx * ex + wy * ey) / len)) : 0
    const dx = wx - ex * t, dy = wy - ey * t
    return dx * dx + dy * dy
  }
  return (x, y) => {
    const bx = Math.max(lo[0] - x, 0, x - hi[0]), by = Math.max(lo[1] - y, 0, y - hi[1])
    const outside = Math.sqrt(bx * bx + by * by)
    if (outside > NEAR_M) return outside
    const ci = at(x, 0, nx), cj = at(y, 1, ny)
    let best = Infinity
    for (let r = 0; ; r++) {
      for (let j = cj - r; j <= cj + r; j++) {
        if (j < 0 || j >= ny) continue
        const edgeRow = j === cj - r || j === cj + r
        for (let i = ci - r; i <= ci + r; i += edgeRow ? 1 : 2 * r || 1) {
          if (i < 0 || i >= nx) continue
          for (const e of cells[j * nx + i]) { const d = edge2(e, x, y); if (d < best) best = d }
        }
      }
      const x0 = lo[0] + (ci - r) * cell, x1 = lo[0] + (ci + r + 1) * cell
      const y0 = lo[1] + (cj - r) * cell, y1 = lo[1] + (cj + r + 1) * cell
      if (ci - r <= 0 && cj - r <= 0 && ci + r >= nx - 1 && cj + r >= ny - 1) break
      const margin = Math.min(x - x0, x1 - x, y - y0, y1 - y)
      if (margin > 0 && best <= margin * margin) break
    }
    let inside = false
    if (outside === 0) for (const e of bands[at(y, 1, ny)]) {
      const xi = E[4 * e + 2], yi = E[4 * e + 3], xj = E[4 * e], yj = E[4 * e + 1]
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside
    }
    return inside ? -Math.sqrt(best) : Math.sqrt(best)
  }
}

/** A uniform grid of items by their padded boxes, so a point finds the few
 * segments or triangles that can contain it. */
function nearGrid(boxes, cell) {
  const map = new Map()
  const key = (i, j, k) => (i * 73856093) ^ (j * 19349663) ^ (k * 83492791)
  boxes.forEach((b, index) => {
    for (let i = Math.floor(b[0] / cell); i <= Math.floor(b[3] / cell); i++)
      for (let j = Math.floor(b[1] / cell); j <= Math.floor(b[4] / cell); j++)
        for (let k = Math.floor(b[2] / cell); k <= Math.floor(b[5] / cell); k++) {
          const id = key(i, j, k)
          const list = map.get(id)
          if (list) list.push(index); else map.set(id, [index])
        }
  })
  return (x, y, z) => map.get(key(Math.floor(x / cell), Math.floor(y / cell), Math.floor(z / cell))) ?? null
}

/** A swept tube: solid, or a wall between inner and outer radius. Joints
 * between segments are round, the two terminal ends are flat as rendered. */
function tubeSolid(points, R, inner) {
  const n = points.length - 1
  const seg = []
  const boxes = []
  for (let i = 0; i < n; i++) {
    const a = points[i], b = points[i + 1]
    const ax = a[0] ?? 0, ay = a[1] ?? 0, az = a[2] ?? 0
    const dx = (b[0] ?? 0) - ax, dy = (b[1] ?? 0) - ay, dz = (b[2] ?? 0) - az
    const L = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-12
    seg.push([ax, ay, az, dx / L, dy / L, dz / L, L])
    const pad = R + NEAR_M
    boxes.push([Math.min(ax, ax + dx) - pad, Math.min(ay, ay + dy) - pad, Math.min(az, az + dz) - pad,
      Math.max(ax, ax + dx) + pad, Math.max(ay, ay + dy) + pad, Math.max(az, az + dz) + pad])
  }
  const find = nearGrid(boxes, Math.max(R, NEAR_M / 2))
  const flat = Float64Array.from(seg.flat())
  const radial = inner > 0 ? d => Math.max(d - R, inner - d) : d => d - R
  // Sixteen segments share one bounding sphere; a lower bound on the distance.
  const chunks = []
  for (let i = 0; i < n; i += 16) {
    const group = boxes.slice(i, i + 16)
    const lo = [0, 1, 2].map(a => Math.min(...group.map(b => b[a])))
    const hi = [0, 1, 2].map(a => Math.max(...group.map(b => b[a + 3])))
    chunks.push([(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2,
      Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) / 2])
  }
  const bound = (x, y, z) => {
    let best = Infinity
    for (const [cx, cy, cz, r] of chunks) best = Math.min(best, Math.hypot(x - cx, y - cy, z - cz) - r)
    return best
  }
  return { sdf: tubeDistance, bound }
  function tubeDistance(x, y, z) {
    const list = find(x, y, z)
    if (!list) return Infinity
    let best = Infinity
    for (const i of list) {
      const o = i * 7
      const ax = flat[o], ay = flat[o + 1], az = flat[o + 2], ux = flat[o + 3], uy = flat[o + 4], uz = flat[o + 5], L = flat[o + 6]
      const wx = x - ax, wy = y - ay, wz = z - az
      // A segment whose bounding sphere is further than the best so far cannot win.
      const mx = wx - ux * L / 2, my = wy - uy * L / 2, mz = wz - uz * L / 2
      if (Math.sqrt(mx * mx + my * my + mz * mz) - L / 2 - R > best) continue
      const t = wx * ux + wy * uy + wz * uz
      const px = wx - ux * t, py = wy - uy * t, pz = wz - uz * t
      const perp = Math.sqrt(px * px + py * py + pz * pz)
      let s
      if ((i === 0 && t < 0) || (i === n - 1 && t > L)) s = combine(radial(perp), i === 0 ? -t : t - L)
      else {
        const c = Math.max(0, Math.min(L, t))
        const qx = wx - ux * c, qy = wy - uy * c, qz = wz - uz * c
        s = radial(Math.sqrt(qx * qx + qy * qy + qz * qz))
      }
      if (s < best) best = s
    }
    return best
  }
}

function closestOnTriangle(px, py, pz, t) {
  // Ericson, Real-Time Collision Detection 5.1.5, squared distance.
  const [ax, ay, az, bx, by, bz, cx, cy, cz] = t
  const abx = bx - ax, aby = by - ay, abz = bz - az, acx = cx - ax, acy = cy - ay, acz = cz - az
  const apx = px - ax, apy = py - ay, apz = pz - az
  const d1 = abx * apx + aby * apy + abz * apz, d2 = acx * apx + acy * apy + acz * apz
  const sq = (x, y, z) => x * x + y * y + z * z
  if (d1 <= 0 && d2 <= 0) return sq(apx, apy, apz)
  const bpx = px - bx, bpy = py - by, bpz = pz - bz
  const d3 = abx * bpx + aby * bpy + abz * bpz, d4 = acx * bpx + acy * bpy + acz * bpz
  if (d3 >= 0 && d4 <= d3) return sq(bpx, bpy, bpz)
  const vc = d1 * d4 - d3 * d2
  if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); return sq(apx - v * abx, apy - v * aby, apz - v * abz) }
  const cpx = px - cx, cpy = py - cy, cpz = pz - cz
  const d5 = abx * cpx + aby * cpy + abz * cpz, d6 = acx * cpx + acy * cpy + acz * cpz
  if (d6 >= 0 && d5 <= d6) return sq(cpx, cpy, cpz)
  const vb = d5 * d2 - d1 * d6
  if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); return sq(apx - w * acx, apy - w * acy, apz - w * acz) }
  const va = d3 * d6 - d5 * d4
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    const w = (d4 - d3) / ((d4 - d3) + (d5 - d6))
    return sq(bpx - w * (cx - bx), bpy - w * (cy - by), bpz - w * (cz - bz))
  }
  const den = 1 / (va + vb + vc), v = vb * den, w = vc * den
  return sq(apx - abx * v - acx * w, apy - aby * v - acy * w, apz - abz * v - acz * w)
}
function trianglesOf(geometry) {
  const p = geometry.getAttribute('position'), index = geometry.getIndex()
  const count = index ? index.count : p.count
  const out = []
  for (let i = 0; i + 2 < count; i += 3) {
    const t = []
    for (let c = 0; c < 3; c++) {
      const v = index ? index.getX(i + c) : i + c
      t.push(p.getX(v), p.getY(v), p.getZ(v))
    }
    out.push(t)
  }
  return out
}
/** A closed mesh: inside by ray parity, depth to its nearest triangle. */
function closedMeshSolid(triangles) {
  const box = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]
  for (const t of triangles) for (let c = 0; c < 9; c += 3) {
    for (let a = 0; a < 3; a++) { box[a] = Math.min(box[a], t[c + a]); box[a + 3] = Math.max(box[a + 3], t[c + a]) }
  }
  // An irrational ray direction never grazes an axis-aligned edge.
  const rd = [0.8017837, 0.2672612, 0.5345225]
  return { sdf: meshDistance, bound: boxBound(box) }
  function meshDistance(x, y, z) {
    if (x < box[0] || y < box[1] || z < box[2] || x > box[3] || y > box[4] || z > box[5]) return Infinity
    let crossings = 0, best = Infinity
    for (const t of triangles) {
      best = Math.min(best, closestOnTriangle(x, y, z, t))
      const e1x = t[3] - t[0], e1y = t[4] - t[1], e1z = t[5] - t[2]
      const e2x = t[6] - t[0], e2y = t[7] - t[1], e2z = t[8] - t[2]
      const hx = rd[1] * e2z - rd[2] * e2y, hy = rd[2] * e2x - rd[0] * e2z, hz = rd[0] * e2y - rd[1] * e2x
      const det = e1x * hx + e1y * hy + e1z * hz
      if (Math.abs(det) < 1e-15) continue
      const f = 1 / det, sx = x - t[0], sy = y - t[1], sz = z - t[2]
      const u = f * (sx * hx + sy * hy + sz * hz)
      if (u < 0 || u > 1) continue
      const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x
      const v = f * (rd[0] * qx + rd[1] * qy + rd[2] * qz)
      if (v < 0 || u + v > 1) continue
      if (f * (e2x * qx + e2y * qy + e2z * qz) > 0) crossings++
    }
    return crossings % 2 ? -Math.sqrt(best) : Math.sqrt(best)
  }
}
/** An open sheet of the stated thickness, centred on its surface. */
function sheetSolid(triangles, thickness) {
  const half = thickness / 2, pad = half + NEAR_M
  const boxes = triangles.map(t => [
    Math.min(t[0], t[3], t[6]) - pad, Math.min(t[1], t[4], t[7]) - pad, Math.min(t[2], t[5], t[8]) - pad,
    Math.max(t[0], t[3], t[6]) + pad, Math.max(t[1], t[4], t[7]) + pad, Math.max(t[2], t[5], t[8]) + pad])
  const all = [0, 1, 2].map(a => Math.min(...boxes.map(b => b[a]))).concat([0, 1, 2].map(a => Math.max(...boxes.map(b => b[a + 3]))))
  const find = nearGrid(boxes, Math.max(0.05, Math.max(all[3] - all[0], all[4] - all[1], all[5] - all[2]) / 64))
  return { sdf: (x, y, z) => {
    const list = find(x, y, z)
    if (!list) return Infinity
    let best = Infinity
    for (const i of list) best = Math.min(best, closestOnTriangle(x, y, z, triangles[i]))
    return Math.sqrt(best) - half
  }, bound: boxBound(all) }
}
/** Distance to a box from outside; no bound from inside it. */
function boxBound(box) {
  return (x, y, z) => {
    const dx = Math.max(box[0] - x, 0, x - box[3]), dy = Math.max(box[1] - y, 0, y - box[4]), dz = Math.max(box[2] - z, 0, z - box[5])
    return dx || dy || dz ? Math.sqrt(dx * dx + dy * dy + dz * dz) : -Infinity
  }
}

const kindOf = part => typeof part.shape === 'string' ? part.shape : part.shape.type
const tubeOf = part => {
  const s = typeof part.shape === 'string' ? {} : part.shape, d = part.dimensions_m
  return {
    points: s.centreline_m ?? d.centreline,
    R: s.outer_radius_m ?? s.radius_m ?? d.outer_radius ?? d.radius,
    inner: s.inner_radius_m ?? d.inner_radius ?? 0,
  }
}

/** The part's exact solid, a lower bound on its distance (the distance itself
 * where it is exact and cheap) and, where it has one, its axis of revolution. */
function solidOf(part, geometry) {
  const solid = exactSolidOf(part, geometry)
  return { ...solid, bound: solid.bound ?? solid.sdf }
}
function exactSolidOf(part, geometry) {
  const d = part.dimensions_m, s = typeof part.shape === 'string' ? {} : part.shape
  const kind = kindOf(part)
  const Y = { point: [0, 0, 0], dir: [0, 1, 0] }
  switch (kind) {
    case 'box': {
      const hx = d.x / 2, hy = d.y / 2, hz = d.z / 2
      return { sdf: (x, y, z) => {
        const qx = Math.abs(x) - hx, qy = Math.abs(y) - hy, qz = Math.abs(z) - hz
        const ox = Math.max(qx, 0), oy = Math.max(qy, 0), oz = Math.max(qz, 0)
        return Math.sqrt(ox * ox + oy * oy + oz * oz) + Math.min(Math.max(qx, qy, qz), 0)
      }, axis: null }
    }
    case 'cylinder': case 'cone': {
      const rb = d.radius ?? d.radius_bottom, rt = d.radius_top ?? rb, h = d.height / 2
      if (rt === rb) return { sdf: (x, y, z) => combine(hyp2(x, z) - rb, Math.abs(y) - h), axis: Y }
      const f = polygonSdf(polygonRings([[[0, -h], [rb, -h], [rt, h], [0, h]]]))
      return { sdf: (x, y, z) => f(hyp2(x, z), y), axis: Y }
    }
    case 'sphere': return { sdf: (x, y, z) => Math.sqrt(x * x + y * y + z * z) - d.radius, axis: { point: [0, 0, 0], dir: null } }
    case 'torus': {
      const R = d.major_radius, r = d.tube_radius
      if (d.plane === 'XZ') return { sdf: (x, y, z) => hyp2(hyp2(x, z) - R, y) - r, axis: Y }
      if (d.plane === 'YZ') return { sdf: (x, y, z) => hyp2(hyp2(y, z) - R, x) - r, axis: { point: [0, 0, 0], dir: [1, 0, 0] } }
      return { sdf: (x, y, z) => hyp2(hyp2(x, y) - R, z) - r, axis: { point: [0, 0, 0], dir: [0, 0, 1] } }
    }
    case 'profile of revolution': {
      const f = polygonSdf(polygonRings([d.closed_axial_radial_profile.map(p => [p[1], p[0]])]))
      return { sdf: (x, y, z) => f(hyp2(x, z), y), axis: Y }
    }
    case 'profile': {
      if (d.profile && d.extrusion_length !== undefined) {
        const r = d.radius, h = d.extrusion_length / 2
        return { sdf: (x, y, z) => combine(hyp2(y, z) - r, Math.abs(x) - h), axis: { point: [0, 0, 0], dir: [1, 0, 0] } }
      }
      const plane = s.plane ?? d.plane ?? (d.coordinates_xz ? 'XZ' : 'YZ')
      const outer = s.vertices_m ?? d.coordinates_xz ?? d.coordinates_yz ?? d.outer_vertices_yz
      const holes = d.holes_xz ?? d.holes_yz ?? (d.hole_vertices_yz ? [d.hole_vertices_yz] : [])
      const depth = s.extrude_depth_m ?? d.extrusion_depth ?? ((d.extrusion_max ?? 0) - (d.extrusion_min ?? 0))
      const e0 = d.extrusion_min ?? -depth / 2, e1 = e0 + depth
      const f = polygonSdf(polygonRings([outer, ...holes]))
      const slab = e => Math.max(e0 - e, e - e1)
      // Mapped exactly as geometry.ts extrudes and turns each plane.
      if (plane === 'XZ') return { sdf: (x, y, z) => combine(f(x, z), slab(y)), axis: null }
      if (plane === 'XY') return { sdf: (x, y, z) => combine(f(x, y), slab(z)), axis: null }
      return { sdf: (x, y, z) => combine(f(y, z), slab(x)), axis: null }
    }
    case 'tube': {
      const { points, R, inner } = tubeOf(part)
      let axis = null
      if (points.length === 2 && !(inner > 0)) {
        const a = points[0], b = points[1]
        const dir = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
        const L = Math.hypot(...dir)
        axis = { point: [...a], dir: dir.map(v => v / L) }
      }
      return { ...tubeSolid(points, R, inner), axis }
    }
    case 'mesh': {
      const triangles = trianglesOf(geometry)
      const edges = new Map()
      for (const [a, b, c] of s.faces ?? d.faces) for (const [u, w] of [[a, b], [b, c], [c, a]]) {
        const k = `${Math.min(u, w)}:${Math.max(u, w)}`
        edges.set(k, (edges.get(k) ?? 0) + 1)
      }
      // A sheet given a thickness is extruded closed by geometry.ts.
      const open = [...edges.values()].some(n => n === 1) && !s.thickness_m
      return open
        ? { ...sheetSolid(triangles, d.nominal_thickness ?? d.thickness ?? 0.001), axis: null, sheet: true }
        : { ...closedMeshSolid(triangles), axis: null }
    }
    default: throw new Error(`No solid for shape ${kind} (${part.id})`)
  }
}

/* ---- surface samples, in the part's own frame ---- */

const R2 = [0.7548776662466927, 0.5698402909980532]
function samplesOfGeometry(geometry) {
  const triangles = trianglesOf(geometry)
  let area = 0
  const areas = triangles.map(t => {
    const ux = t[3] - t[0], uy = t[4] - t[1], uz = t[5] - t[2], vx = t[6] - t[0], vy = t[7] - t[1], vz = t[8] - t[2]
    const a = 0.5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx)
    area += a
    return a
  })
  const h = Math.max(SPACING_M, Math.sqrt(area / MAX_SAMPLES))
  const out = []
  triangles.forEach((t, i) => {
    out.push(t[0], t[1], t[2])
    const n = Math.round(areas[i] / (h * h))
    for (let k = 0; k < n; k++) {
      let u = (0.5 + (k + 1) * R2[0]) % 1, v = (0.5 + (k + 1) * R2[1]) % 1
      if (u + v > 1) { u = 1 - u; v = 1 - v }
      out.push(t[0] + u * (t[3] - t[0]) + v * (t[6] - t[0]), t[1] + u * (t[4] - t[1]) + v * (t[7] - t[1]),
        t[2] + u * (t[5] - t[2]) + v * (t[8] - t[2]))
    }
  })
  return { points: Float64Array.from(out), spacing: h }
}
function samplesOfTube(points, R, inner) {
  const out = []
  const rings = []
  if (inner > 0) rings.push(inner)
  rings.push(R)
  const ring = (cx, cy, cz, u, radius) => {
    let ax = Math.abs(u[0]) < 0.9 ? 1 : 0, ay = ax ? 0 : 1, az = 0
    const dot = ax * u[0] + ay * u[1] + az * u[2]
    ax -= dot * u[0]; ay -= dot * u[1]; az -= dot * u[2]
    const l = Math.hypot(ax, ay, az); ax /= l; ay /= l; az /= l
    const bx = u[1] * az - u[2] * ay, by = u[2] * ax - u[0] * az, bz = u[0] * ay - u[1] * ax
    const m = Math.max(8, Math.ceil(2 * Math.PI * radius / SPACING_M))
    for (let j = 0; j < m; j++) {
      const c = Math.cos(2 * Math.PI * j / m), s = Math.sin(2 * Math.PI * j / m)
      out.push(cx + radius * (c * ax + s * bx), cy + radius * (c * ay + s * by), cz + radius * (c * az + s * bz))
    }
  }
  const n = points.length - 1
  for (let i = 0; i < n; i++) {
    const a = points[i], b = points[i + 1]
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
    const L = Math.hypot(...d) || 1e-12
    const u = d.map(v => v / L)
    const steps = Math.max(1, Math.ceil(L / SPACING_M))
    for (let k = i === 0 ? 0 : 1; k <= steps; k++) {
      const f = k / steps
      for (const radius of rings) ring(a[0] + d[0] * f, a[1] + d[1] * f, a[2] + d[2] * f, u, radius)
    }
    // The flat ends, as a disc or an annulus.
    if (i === 0 || i === n - 1) {
      const e = i === 0 ? a : b
      for (let r = inner > 0 ? inner : 0; r < R; r += SPACING_M) if (r > 0) ring(e[0], e[1], e[2], u, r)
      if (!(inner > 0)) out.push(e[0], e[1], e[2])
    }
  }
  return { points: Float64Array.from(out), spacing: SPACING_M }
}
/** Points bucketed in their own frame, so a query box visits only its cells. */
function sampleGrid(points) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < points.length; i += 3) for (let a = 0; a < 3; a++) {
    lo[a] = Math.min(lo[a], points[i + a]); hi[a] = Math.max(hi[a], points[i + a])
  }
  const extent = Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2], 1e-6)
  const cell = Math.max(0.01, extent / 24)
  const dims = [0, 1, 2].map(a => Math.max(1, Math.ceil((hi[a] - lo[a]) / cell + 1e-9)))
  const at = (a, v) => Math.min(dims[a] - 1, Math.max(0, Math.floor((v - lo[a]) / cell)))
  const cellOf = i => (at(0, points[i]) * dims[1] + at(1, points[i + 1])) * dims[2] + at(2, points[i + 2])
  // Counting sort into one array: each cell's points are contiguous.
  const start = new Int32Array(dims[0] * dims[1] * dims[2] + 1)
  for (let i = 0; i < points.length; i += 3) start[cellOf(i) + 1]++
  for (let c = 1; c < start.length; c++) start[c] += start[c - 1]
  const order = new Int32Array(points.length / 3), fill = start.slice(0, -1)
  for (let i = 0; i < points.length; i += 3) order[fill[cellOf(i)]++] = i
  const reach = cell * Math.sqrt(3) / 2
  /** Every point in the box, a whole cell passed over when `skip` proves
   * from its centre and reach that none of its points can count. */
  return { lo, hi, visit(box, fn, skip = null) {
    if (box[0] > hi[0] || box[1] > hi[1] || box[2] > hi[2] || box[3] < lo[0] || box[4] < lo[1] || box[5] < lo[2]) return
    const i0 = at(0, box[0]), i1 = at(0, box[3]), j0 = at(1, box[1]), j1 = at(1, box[4]), k0 = at(2, box[2]), k1 = at(2, box[5])
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const row = (i * dims[1] + j) * dims[2]
      for (let k = k0; k <= k1; k++) {
        const begin = start[row + k], end = start[row + k + 1]
        if (begin === end) continue
        if (skip && skip(lo[0] + (i + .5) * cell, lo[1] + (j + .5) * cell, lo[2] + (k + .5) * cell, reach)) continue
        for (let n = begin; n < end; n++) {
          const p = order[n]
          fn(points[p], points[p + 1], points[p + 2])
        }
      }
    }
  } }
}

/* ---- matrices as plain arrays (column-major, as three stores them) ---- */

const apply = (m, x, y, z, out) => {
  out[0] = m[0] * x + m[4] * y + m[8] * z + m[12]
  out[1] = m[1] * x + m[5] * y + m[9] * z + m[13]
  out[2] = m[2] * x + m[6] * y + m[10] * z + m[14]
  return out
}
const rotate = (m, x, y, z) => [m[0] * x + m[4] * y + m[8] * z, m[1] * x + m[5] * y + m[9] * z, m[2] * x + m[6] * y + m[10] * z]
const invert = m => new THREE.Matrix4().fromArray(m).invert().toArray()
const multiply = (a, b) => new THREE.Matrix4().fromArray(a).multiply(new THREE.Matrix4().fromArray(b)).toArray()
function boxThrough(m, box) {
  const out = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity], p = [0, 0, 0]
  for (let c = 0; c < 8; c++) {
    apply(m, c & 1 ? box[3] : box[0], c & 2 ? box[4] : box[1], c & 4 ? box[5] : box[2], p)
    for (let a = 0; a < 3; a++) { out[a] = Math.min(out[a], p[a]); out[a + 3] = Math.max(out[a + 3], p[a]) }
  }
  return out
}
const overlaps = (a, b, pad) => a[0] - pad <= b[3] && b[0] - pad <= a[3] && a[1] - pad <= b[4] && b[1] - pad <= a[4] && a[2] - pad <= b[5] && b[2] - pad <= a[5]
const grow = (box, pad) => [box[0] - pad, box[1] - pad, box[2] - pad, box[3] + pad, box[4] + pad, box[5] + pad]

/* ---- one machine over its whole period ---- */

function measure(dossier) {
  const started = Date.now()
  const slug = dossier.slug
  const kinematic = dossier.joints.filter(j => !['gear', 'belt', 'rope'].includes(j.type) && !(j.limits?.[0] === 0 && j.limits?.[1] === 0))
  const jointChildren = new Set(kinematic.map(j => j.child))
  const specs = new Map(dossier.parts.map(p => [p.id, p]))

  // The same hierarchy the app builds, without surfaces.
  const object = new THREE.Group()
  const groups = new Map()
  for (const p of dossier.parts) {
    const g = new THREE.Group()
    g.position.fromArray(p.position_m)
    g.rotation.set(p.orientation_rad[0] ?? 0, p.orientation_rad[1] ?? 0, p.orientation_rad[2] ?? 0, 'XYZ')
    groups.set(p.id, g)
  }
  for (const p of dossier.parts) (p.parent === 'world' ? object : groups.get(p.parent)).add(groups.get(p.id))
  let bent = new Map()
  const assembly = { object, parts: groups, meshes: new Map(), updateTube: (id, points) => bent.set(id, points), sync() {}, dispose() {} }

  // Parts whose centreline the schedule rewrites are their own moving body.
  const rest0 = {}
  for (const j of dossier.joints) rest0[j.id] = 0
  const deforming = new Set(dossier.parts.filter(p => Array.isArray(p.dimensions_m.centreline)
    && movingCentreline(slug, p.id, p.dimensions_m.centreline, rest0)).map(p => p.id))
  const bodyOf = id => {
    if (deforming.has(id)) return `~${id}`
    for (let at = id; at && at !== 'world'; at = specs.get(at)?.parent) if (jointChildren.has(at)) return at
    return 'world'
  }
  const movingCount = dossier.parts.filter(p => bodyOf(p.id) !== 'world').length
  const period = dossier.motion.period_s
  const report = { slug, periodS: period, loop: dossier.motion.loop, movingParts: movingCount, parts: dossier.parts.length }
  if (!movingCount || period === null) return { ...report, steps: 0, still: true, designed: [], touches: [], passThroughs: [], ms: Date.now() - started }
  const parts = dossier.parts.map(p => {
    const kind = kindOf(p)
    const geometry = kind === 'tube' ? null : geometryForPart(p, 'standard', slug)
    const solid = solidOf(p, geometry)
    const tube = kind === 'tube' ? tubeOf(p) : null
    const samples = tube ? samplesOfTube(tube.points, tube.R, tube.inner) : samplesOfGeometry(geometry)
    geometry?.dispose()
    return { id: p.id, body: bodyOf(p.id), kind, solid, tube, samples, grid: sampleGrid(samples.points), deforming: deforming.has(p.id) }
  })

  // Record every part's matrix and every bent centreline at one time.
  const record = t => {
    bent = new Map()
    applyMotion(dossier, assembly, t)
    return {
      t,
      matrices: parts.map(p => groups.get(p.id).matrixWorld.toArray()),
      bent,
    }
  }
  const localBox = (p, frame) => {
    if (p.deforming && frame.bent.has(p.id)) {
      const pts = frame.bent.get(p.id), R = p.tube.R
      const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]
      for (const q of pts) for (let a = 0; a < 3; a++) { b[a] = Math.min(b[a], q[a] - R); b[a + 3] = Math.max(b[a + 3], q[a] + R) }
      return b
    }
    return [...p.grid.lo, ...p.grid.hi]
  }
  // No point of a moving part travels further than STEP_M between samples:
  // the largest travel of a rigid part is at a corner of its own box.
  const coarse = 240
  const probe = Array.from({ length: coarse + 1 }, (_, i) => record(period * i / coarse))
  let travel = 0
  for (let i = 1; i <= coarse; i++) {
    for (const [n, p] of parts.entries()) {
      if (p.body === 'world') continue
      const a = probe[i - 1], b = probe[i]
      if (p.deforming) {
        const pa = a.bent.get(p.id), pb = b.bent.get(p.id)
        if (pa && pb) pa.forEach((q, k) => { travel = Math.max(travel, Math.hypot(q[0] - pb[k][0], q[1] - pb[k][1], q[2] - pb[k][2])) })
      }
      const box = localBox(p, a), pa = [0, 0, 0], pb = [0, 0, 0]
      for (let c = 0; c < 8; c++) {
        const x = c & 1 ? box[3] : box[0], y = c & 2 ? box[4] : box[1], z = c & 4 ? box[5] : box[2]
        apply(a.matrices[n], x, y, z, pa); apply(b.matrices[n], x, y, z, pb)
        travel = Math.max(travel, Math.hypot(pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2]))
      }
    }
  }
  const count = Math.min(40000, Math.max(coarse, Math.ceil(coarse * travel / STEP_M)))
  const last = dossier.motion.loop ? count - 1 : count
  const frames = []
  for (let i = 0; i <= last; i++) frames.push(record(period * i / count))

  // A deforming tube is rebuilt at every frame it is asked about.
  const bentCache = new Map()
  const solidAt = (p, k) => {
    if (!p.deforming) return p
    const key = `${p.id}@${k}`
    let hit = bentCache.get(key)
    if (!hit) {
      const pts = frames[k].bent.get(p.id) ?? p.tube.points
      const samples = samplesOfTube(pts, p.tube.R, p.tube.inner)
      hit = { solid: tubeSolid(pts, p.tube.R, p.tube.inner), grid: sampleGrid(samples.points) }
      bentCache.set(key, hit)
      if (bentCache.size > 64) bentCache.delete(bentCache.keys().next().value)
    }
    return hit
  }
  const worldBox = (n, k) => boxThrough(frames[k].matrices[n], localBox(parts[n], frames[k]))
  const boxes = parts.map((_, n) => frames.map((__, k) => worldBox(n, k)))
  const swept = boxes.map(list => list.reduce((u, b) => [Math.min(u[0], b[0]), Math.min(u[1], b[1]), Math.min(u[2], b[2]),
    Math.max(u[3], b[3]), Math.max(u[4], b[4]), Math.max(u[5], b[5])]))

  // The volume of A never changes in B's frame: a journal.
  const invariant = (a, b) => {
    const axis = parts[a].solid.axis
    if (!axis || parts[a].deforming || parts[b].deforming) return false
    let p0 = null, d0 = null
    for (const frame of frames) {
      const m = multiply(invert(frame.matrices[b]), frame.matrices[a])
      const p = apply(m, ...axis.point, [0, 0, 0])
      if (!p0) { p0 = p; d0 = axis.dir ? rotate(m, ...axis.dir) : null; continue }
      if (Math.hypot(p[0] - p0[0], p[1] - p0[1], p[2] - p0[2]) > INVARIANT_M) return false
      if (d0) {
        const d = rotate(m, ...axis.dir)
        if (Math.hypot(d[1] * d0[2] - d[2] * d0[1], d[2] * d0[0] - d[0] * d0[2], d[0] * d0[1] - d[1] * d0[0]) > INVARIANT_M) return false
      }
    }
    return true
  }
  // The nearest sample of A to B's solid, and of B to A's, at one frame:
  // negative is a depth, positive a clearance, NEAR_M when nothing is nearer.
  const nearestAt = (a, b, k) => {
    const A = parts[a], B = parts[b]
    const ma = frames[k].matrices[a], mb = frames[k].matrices[b]
    let nearest = NEAR_M
    const q = [0, 0, 0], c = [0, 0, 0]
    for (const [from, to, mf, mt] of [[A, B, ma, mb], [B, A, mb, ma]]) {
      const source = solidAt(from, k), target = solidAt(to, k)
      const toLocal = multiply(invert(mt), mf)
      const region = boxThrough(invert(mf), grow(boxes[to === A ? a : b][k], NEAR_M))
      source.grid.visit(region, (x, y, z) => {
        apply(toLocal, x, y, z, q)
        const s = target.solid.sdf(q[0], q[1], q[2])
        if (s < nearest) nearest = s
      }, (x, y, z, reach) => {
        apply(toLocal, x, y, z, c)
        return target.solid.bound(c[0], c[1], c[2]) - reach > nearest
      })
    }
    return nearest
  }
  // The dossier's ground is the plinth top: nothing moving goes below it.
  const ground = dossier.frame.ground_y_m ?? 0
  const groundNearest = (a, k) => {
    const A = parts[a]
    if (boxes[a][k][1] >= ground + NEAR_M) return NEAR_M
    const source = solidAt(A, k), m = frames[k].matrices[a], q = [0, 0, 0]
    let nearest = NEAR_M
    source.grid.visit(boxThrough(invert(m), [-1e3, -1e3, -1e3, 1e3, ground + NEAR_M, 1e3]), (x, y, z) => {
      apply(m, x, y, z, q)
      if (q[1] - ground < nearest) nearest = q[1] - ground
    })
    return nearest
  }

  // A tube's end set into the part it is fixed to, or two tubes joined end to
  // end: that end is the same in the other's frame (or meets the other's end)
  // at every moment, and it alone explains the depth.
  const endOf = (n, k, end) => {
    const p = parts[n]
    const pts = (p.deforming && frames[k].bent.get(p.id)) || p.tube.points
    const e = end ? pts[pts.length - 1] : pts[0]
    return apply(frames[k].matrices[n], e[0], e[1], e[2], [0, 0, 0])
  }
  const fastened = (a, b, ks, series) => {
    for (const [t, o] of [[a, b], [b, a]]) {
      const T = parts[t], O = parts[o]
      if (T.kind !== 'tube') continue
      for (const end of [0, 1]) {
        let first = null, fixedIn = true, joined = O.kind === 'tube'
        ks.forEach((k, i) => {
          const w = endOf(t, k, end)
          const local = apply(invert(frames[k].matrices[o]), w[0], w[1], w[2], [0, 0, 0])
          if (!first) first = local
          else if (Math.hypot(local[0] - first[0], local[1] - first[1], local[2] - first[2]) > 1e-5) fixedIn = false
          const sunk = -solidAt(O, k).solid.sdf(local[0], local[1], local[2])
          // An end resting on the face counts: nothing sinks deeper than the tube's own radius.
          if (series[i] > TOUCH_M && !(sunk > -TOUCH_M && series[i] <= Math.max(sunk, 0) + T.tube.R + TOUCH_M)) fixedIn = false
          if (joined) {
            const reach = T.tube.R + O.tube.R
            const meets = [0, 1].some(e => { const v = endOf(o, k, e); return Math.hypot(v[0] - w[0], v[1] - w[1], v[2] - w[2]) <= reach })
            if (!meets || series[i] > reach + TOUCH_M) joined = false
          }
        })
        if (fixedIn || joined) return true
      }
    }
    return false
  }

  const designed = [], touches = [], passThroughs = [], clearances = []
  // The nearest miss of a pair that never meets, within NEAR_M.
  const miss = (entry, near, frameTimes) => {
    let at = 0
    near.forEach((s, i) => { if (s < near[at]) at = i })
    if (near[at] < NEAR_M) clearances.push({ ...entry, clearanceM: +near[at].toFixed(4), atS: +frameTimes[at].toFixed(3) })
  }
  const declared = (a, b) => kinematic.some(j => (j.child === parts[a].id && j.parent === parts[b].id) || (j.child === parts[b].id && j.parent === parts[a].id))
  const summarise = (series, frameTimes) => {
    let max = 0, at = 0
    const intervals = []
    series.forEach((d, k) => {
      if (d > max) { max = d; at = k }
      if (d > TOUCH_M) {
        const open = intervals.at(-1)
        if (open && open[2] === k - 1) { open[1] = frameTimes[k]; open[2] = k }
        else intervals.push([frameTimes[k], frameTimes[k], k])
      }
    })
    const hits = series.filter(d => d > TOUCH_M).length
    return {
      depthM: +max.toFixed(4), atS: +frameTimes[at].toFixed(3), phase: +(frameTimes[at] / period).toFixed(4),
      share: +(hits / series.length).toFixed(4),
      intervalsS: intervals.slice(0, 8).map(([s, e]) => [+s.toFixed(3), +e.toFixed(3)]),
    }
  }
  const times = frames.map(f => f.t)
  let pairsNear = 0, pairsTested = 0
  parts.forEach((A, a) => {
    if (A.body === 'world') return
    parts.forEach((B, b) => {
      if (B.body === A.body) return
      if (B.body !== 'world' && b < a) return
      pairsTested++
      if (!overlaps(swept[a], swept[b], NEAR_M)) return
      pairsNear++
      // Either side may be the axle: a plate turning on a fixed pin is a seat too.
      const journal = invariant(a, b) || invariant(b, a)
      // A journal's overlap is the same at every frame; eight frames show it.
      const ks = journal ? Array.from({ length: 8 }, (_, i) => Math.floor(i * frames.length / 8)) : frames.map((_, k) => k)
      const near = ks.map(k => overlaps(boxes[a][k], boxes[b][k], NEAR_M) ? nearestAt(a, b, k) : NEAR_M)
      const series = near.map(s => Math.max(0, -s))
      const summary = summarise(series, ks.map(k => times[k]))
      const pair = { moving: A.id, other: B.id, otherMoves: B.body !== 'world' }
      if (summary.depthM <= 0) return miss(pair, near, ks.map(k => times[k]))
      const entry = { ...pair, ...summary }
      if (journal) designed.push({ ...entry, atS: 0, phase: 0, share: 1, intervalsS: [[0, period]], kind: 'journal' })
      else if (declared(a, b)) designed.push({ ...entry, kind: 'joint' })
      else if (summary.depthM <= TOUCH_M) touches.push(entry)
      else if (fastened(a, b, ks, series)) designed.push({ ...entry, kind: 'fastening' })
      else passThroughs.push(entry)
    })
    const near = frames.map((_, k) => groundNearest(a, k))
    const summary = summarise(near.map(s => Math.max(0, -s)), times)
    const pair = { moving: A.id, other: 'ground', otherMoves: false }
    if (summary.depthM > TOUCH_M) passThroughs.push({ ...pair, ...summary })
    else if (summary.depthM > 0) touches.push({ ...pair, ...summary })
    else miss(pair, near, times)
  })
  passThroughs.sort((x, y) => y.depthM - x.depthM)
  clearances.sort((x, y) => x.clearanceM - y.clearanceM)
  return {
    ...report, steps: frames.length, maxTravelPerStepM: +(travel * coarse / count).toFixed(5),
    pairsTested, pairsNear, designed, touches, passThroughs, clearances, ms: Date.now() - started,
  }
}

/* ---- every machine, then the list of what waits for its own window ---- */

const dataDir = path.join(root, MACHINES, 'data')
const dossiers = fs.readdirSync(dataDir).filter(f => f.endsWith('.json') && f !== 'records.json').sort()
  .map(f => JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf8')))
  .filter(d => d.status === 'complete' && (!only || d.slug === only))
const failures = []
const machines = []
for (const dossier of dossiers) {
  try { machines.push(measure(dossier)) }
  catch (error) { failures.push({ code: 'machine-not-measured', id: dossier.slug, detail: String(error?.stack ?? error) }) }
}
if (!only && dossiers.length !== 14) failures.push({ code: 'machine-count', id: String(dossiers.length) })

const known = fs.existsSync(knownPath) ? JSON.parse(fs.readFileSync(knownPath, 'utf8')).entries : []
const keyOf = e => `${e.slug}|${e.moving}|${e.other}`
const found = new Map()
for (const m of machines) for (const p of m.passThroughs) found.set(keyOf({ slug: m.slug, ...p }), p)
for (const [key, p] of found) {
  const listed = known.find(e => keyOf(e) === key)
  if (!listed) failures.push({ code: 'pass-through', id: key, depthM: p.depthM, atS: p.atS })
  else if (p.depthM > listed.depthM + Math.max(0.001, 0.05 * listed.depthM)) failures.push({ code: 'pass-through-deeper', id: key, depthM: p.depthM, listedM: listed.depthM })
}
for (const e of known) {
  if (only && e.slug !== only) continue
  if (!found.has(keyOf(e))) failures.push({ code: 'listed-pass-through-gone', id: keyOf(e), detail: 'remove it from machines/clearance-known.json' })
}

const report = {
  checker: 'vinci-machine-clearance',
  touchM: TOUCH_M, nearM: NEAR_M, sampleSpacingM: SPACING_M, stepM: STEP_M,
  table: machines.map(m => ({
    slug: m.slug, steps: m.steps, moving: m.movingParts, designed: m.designed.length, touches: m.touches.length,
    passThroughs: m.passThroughs.length, deepestM: m.passThroughs[0]?.depthM ?? 0,
    nearestMissM: m.clearances?.[0]?.clearanceM ?? null, ms: m.ms,
  })),
  machines,
  limitations: [
    'Surface samples of each part are measured in the other part\'s exact solid, so a crossing thinner than the sample spacing between two thin parts can be under-read; the spacing and the step are stated above.',
    'Moving parts are tested against parts of every other body and against the dossier ground; two parts of one rigid body never move against each other and are not paired.',
    'Journal means the part is a body of revolution whose axis and centre never move in the other part\'s frame; its seat is the same at every moment.',
  ],
  ok: failures.length === 0,
  failures,
}
console.log(JSON.stringify(report, null, 2))
process.exitCode = failures.length ? 1 : 0
