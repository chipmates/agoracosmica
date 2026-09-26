// WHAT STANDS NEAR THE LENS: the wing's drawn geometry mounted in node, and
// how close a camera track comes to it. The certificate proves the eye clear
// of the rail's solids by the near plane; a wall, a frame, a post or a door
// jamb a hand from the lens is clear by that proof and still fills the frame.
//
// The mount is scene.mjs's parts at the film's tier (its list, repeated here:
// it is not exported), the great hall, and the rooms' own furniture from their
// plans (frames, benches, fittings, surrounds, the supper room's bodies), the
// same boxes their checkers prove.
import * as THREE from 'three/webgpu'
import * as TSL from 'three/tsl'
import { WING_DIR, createLoader } from './load.mjs'
import { FILM_TIER } from './scene.mjs'

/** The height band about the eye that counts as "at eye height": a door head
    or a brace overhead is in it, the floor under a standing eye is not. */
export const EYE_BAND_M = 0.75
/** The drawn surfaces seen through, by their material's or mesh's name. */
export const SEE_THROUGH = /glass|glazing/i
/** A nearest distance is sought no further than this; beyond it reads as this. */
export const NEAR_LIMIT_M = 3
const CELL = 1
const OFF = 4096, SPAN = 8192
const NONE = new Uint8Array(0)
const cellKey = (x, y, z) => ((x + OFF) * SPAN + (y + OFF)) * SPAN + (z + OFF)

const factory = (id, file, name, grounded) => ({ id, file, name, grounded })
/** scene.mjs's PARTS, the certificate's factories among them */
const FACTORIES = [
  factory('shell', 'shell', 'createShell', false), factory('terrain', 'ground', 'createGround', false),
  factory('gate-passage', 'gate-passage', 'createGatePassage', false),
  factory('inner-court', 'inner-court', 'createInnerCourtDressing', true),
  factory('collection', 'collection', 'createCollection', false),
  factory('collection-access', 'collection-access', 'createCollectionAccess', false),
  factory('entry-passage', 'entry-passage', 'createEntryPassage', false),
  factory('vegetation', 'vegetation', 'createVegetation', true),
  factory('road-dressing', 'road-dressing', 'createRoadDressing', true),
  factory('ground-dressing', 'ground-dressing', 'createGroundDressing', true),
]

/** a plan's box [west, south, bottom, east, north, top] as twelve triangles in three's frame */
function boxTriangles([w, s, b, e, n, t]) {
  const c = [[w, b, -n], [e, b, -n], [e, b, -s], [w, b, -s], [w, t, -n], [e, t, -n], [e, t, -s], [w, t, -s]]
  const faces = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [3, 2, 6, 7], [0, 3, 7, 4], [1, 2, 6, 5]]
  const out = []
  for (const [a, bb, cc, d] of faces) out.push(...c[a], ...c[bb], ...c[cc], ...c[a], ...c[cc], ...c[d])
  return out
}

/**
 * THE DRAWN WORLD AS TRIANGLES, each with the name of what it belongs to.
 *   tier       the film's (hero geometry)
 *   keep(box)  a triangle is kept only where this says its box matters
 * Returns { values: Float64Array (9 a triangle), label: Uint32Array, labels: string[], count, parts }.
 */
export async function mountVisible({ rev = '', overlay = {}, tier = FILM_TIER, keep = () => true } = {}) {
  const values = [], label = [], clear = [], labels = [], labelOf = new Map(), parts = []
  const named = (name) => { let i = labelOf.get(name); if (i === undefined) { i = labels.length; labels.push(name); labelOf.set(name, i) } return i }
  const push = (tri, name, glass = false) => {
    const lo = [Math.min(tri[0], tri[3], tri[6]), Math.min(tri[1], tri[4], tri[7]), Math.min(tri[2], tri[5], tri[8])]
    const hi = [Math.max(tri[0], tri[3], tri[6]), Math.max(tri[1], tri[4], tri[7]), Math.max(tri[2], tri[5], tri[8])]
    if (!keep(lo, hi)) return false
    for (const v of tri) values.push(v)
    label.push(named(name))
    clear.push(glass ? 1 : 0)
    return true
  }
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), m = new THREE.Matrix4(), inst = new THREE.Matrix4()
  const addGroup = (part, group) => {
    const t0 = Date.now()
    let kept = 0, seen = 0
    group.updateMatrixWorld(true)
    group.traverse((object) => {
      if (!object.isMesh || !object.geometry || object.visible === false) return
      // a body on no camera layer is drawn by no pass the film shows
      if (!(object.layers.mask & 1)) return
      const position = object.geometry.getAttribute('position')
      if (!position) return
      const retired = object.geometry.getAttribute('retired')
      const index = object.geometry.getIndex()
      const count = index ? index.count : position.count
      const instances = object.isInstancedMesh ? object.count : 1
      const name = `${part}:${object.name || object.parent?.name || '?'}`
      // glass is looked through, not at: a pane a hand from the lens is not what crowds the frame
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      const glass = materials.every((m) => m && (SEE_THROUGH.test(`${m.name ?? ''} ${object.name}`) || m.transmission > 0))
      for (let k = 0; k < instances; k++) {
        if (object.isInstancedMesh) { object.getMatrixAt(k, inst); m.multiplyMatrices(object.matrixWorld, inst) } else m.copy(object.matrixWorld)
        for (let i = 0; i + 2 < count; i += 3) {
          const i0 = index ? index.getX(i) : i, i1 = index ? index.getX(i + 1) : i + 1, i2 = index ? index.getX(i + 2) : i + 2
          if (retired && retired.getX(i0) > 0.5) continue
          a.fromBufferAttribute(position, i0).applyMatrix4(m)
          b.fromBufferAttribute(position, i1).applyMatrix4(m)
          c.fromBufferAttribute(position, i2).applyMatrix4(m)
          seen++
          if (push([a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z], name, glass)) kept++
        }
      }
    })
    parts.push({ id: part, triangles: seen, kept, ms: Date.now() - t0 })
  }
  const addFlat = (part, flat, name) => {
    let kept = 0
    for (let i = 0; i + 8 < flat.length; i += 9) if (push(flat.slice(i, i + 9), `${part}:${name}`, SEE_THROUGH.test(name))) kept++
    parts.push({ id: part, name, triangles: flat.length / 9, kept, ms: 0 })
  }

  const loader = await createLoader({ rev, overlay })
  const at = (file) => loader.load(`${WING_DIR}/${file}.ts`)
  const { gradeAt } = at('terrain-mesh')
  for (const f of FACTORIES) {
    const module = at(f.file)
    addGroup(f.id, f.grounded ? module[f.name](gradeAt, tier) : module[f.name](tier))
  }
  addGroup('water', at('water').createWater(new THREE.Scene(), { tierName: () => tier, reflector: () => ({ node: TSL.vec4(0, 0, 0, 1), dispose() {} }) }))
  addGroup('stands', at('collection/stands').createCollectionStandSolids(new THREE.MeshStandardMaterial({ name: 'stand' })))
  {
    const { COURT, GRAVE_ORIGIN } = at('collection/layout')
    const exhibit = () => new THREE.MeshStandardMaterial()
    const materials = { stone: exhibit(), plaster: exhibit(), bronze: exhibit(), ink: exhibit(), dark: exhibit(), tuffeau: exhibit() }
    const grave = at('grave/index').createGrave(materials, 'en')
    at('collection/line-floor').fitCollectionExhibitFloor(grave.group, materials, 'grave')
    grave.group.add(at('grave/court').createGraveCourt(tier, undefined, { trees: false }).local)
    grave.group.rotation.y = Math.PI / 2
    grave.group.position.set(GRAVE_ORIGIN.east, COURT.level + 0.035, -GRAVE_ORIGIN.north)
    addGroup('grave', grave.group)
  }
  addGroup('house-hall', at('house-hall').createHouseHall(tier).group)
  addGroup('machines', machinesAtRest(at, loader, tier))
  addGroup('plates', plateQuads(at))
  // the rooms' furniture, raised after the rail reads the scene: their plans' own solids
  for (const [part, file, fn] of [['picture-room', 'collection/picture-room-plan', 'pictureRoomSolids'], ['line-gallery', 'collection/line-gallery-plan', 'lineGallerySolids'],
    ['body-wall', 'collection/body-wall-plan', 'bodyWallSolids'], ['reading-room', 'collection/reading-room-plan', 'readingRoomSolids']]) {
    for (const s of at(file)[fn]()) addFlat(part, boxTriangles(s.box), s.name)
  }
  for (const [name, body] of Object.entries(at('collection/supper-room-plan').supperRoomBodies())) addFlat('supper-room', [...body.positions()], name)
  return { values: Float64Array.from(values), label: Uint32Array.from(label), clear: Uint8Array.from(clear), labels, count: label.length, parts }
}

/** each machine in its rest pose on its stand, as the certificate and scene.mjs stand it */
function machinesAtRest(at, loader, tier) {
  const { railExhibitStands, railExhibitLevel } = at('rail-solids')
  const { geometryForPart } = at('machines/geometry')
  const all = new THREE.Group()
  for (const slug of Object.keys(railExhibitStands).sort()) {
    const dossier = JSON.parse(loader.text(`${WING_DIR}/machines/data/${slug}.json`))
    const stand = railExhibitStands[slug]
    const root = new THREE.Group()
    root.rotation.y = stand.bearing * Math.PI / 180
    root.position.set(stand.east, railExhibitLevel(stand.ground) + stand.plinth - (dossier.frame?.ground_y_m ?? 0), -stand.north)
    const nodes = new Map([['world', root], ['root', root]])
    const pending = [...dossier.parts]
    const built = new Set()
    let guard = 0
    while (pending.length && guard++ < 20000) {
      const part = pending.shift()
      if (part.parent && !nodes.has(part.parent) && dossier.parts.some((o) => o.id === part.parent) && !built.has(part.parent)) { pending.push(part); continue }
      const group = new THREE.Group()
      group.position.fromArray(part.position_m)
      group.rotation.set(part.orientation_rad[0] ?? 0, part.orientation_rad[1] ?? 0, part.orientation_rad[2] ?? 0)
      ;(nodes.get(part.parent) ?? root).add(group)
      nodes.set(part.id, group)
      built.add(part.id)
      const mesh = new THREE.Mesh(geometryForPart(part, tier, slug))
      mesh.name = `${slug}/${part.id}`
      group.add(mesh)
    }
    all.add(root)
  }
  return all
}

/** every plate's quad: the hang, the body wall's sheets and the mural */
function plateQuads(at) {
  const group = new THREE.Group()
  const quad = (name, width, height, position, bearing) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height))
    mesh.name = name
    mesh.position.set(...position)
    mesh.rotation.y = bearing
    group.add(mesh)
  }
  for (const f of at('collection/hang').hangPlacements()) quad(`plate:${f.id}`, f.width, f.height, [f.east, f.datum, -f.north], Math.PI)
  const { COURT, SUPPER_WALL: S } = at('collection/layout')
  for (const mt of at('collection/body-wall').bodyMounts()) quad(`sheet:${mt.id}`, mt.width, mt.height, [mt.east, mt.datum, -mt.north], -Math.PI / 2)
  quad('plate:last-supper', S.field.width, S.field.height, [S.east + S.thickness / 2 + 0.0005, COURT.level + S.field.sill + S.field.height / 2, -S.north], Math.PI / 2)
  return group
}

/** THE CELLS A SET OF EYES CAN REACH within a reach, for mountVisible's keep */
export function reachOf(eyes, reach = NEAR_LIMIT_M + 1) {
  const cells = new Set()
  let last = ''
  for (const e of eyes) {
    const cx = Math.floor(e[0] / CELL), cy = Math.floor(e[1] / CELL), cz = Math.floor(e[2] / CELL)
    const k = `${cx},${cy},${cz}`
    if (k === last) continue
    last = k
    const r = Math.ceil(reach / CELL)
    for (let x = cx - r; x <= cx + r; x++) for (let y = cy - r; y <= cy + r; y++) for (let z = cz - r; z <= cz + r; z++) cells.add(cellKey(x, y, z))
  }
  return {
    cells,
    keep(lo, hi) {
      const x0 = Math.floor(lo[0] / CELL), x1 = Math.floor(hi[0] / CELL), y0 = Math.floor(lo[1] / CELL), y1 = Math.floor(hi[1] / CELL), z0 = Math.floor(lo[2] / CELL), z1 = Math.floor(hi[2] / CELL)
      // a triangle over many cells is kept (a floor, a wall): testing each costs more than keeping it
      if ((x1 - x0 + 1) * (y1 - y0 + 1) * (z1 - z0 + 1) > 64) return true
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) if (cells.has(cellKey(x, y, z))) return true
      return false
    },
  }
}

/** A UNIFORM GRID over the triangles: each is listed in every cell its box meets. */
export function gridOf(world) {
  const { values, count } = world
  const counts = new Map()
  const each = (i, visit) => {
    const o = i * 9
    const x0 = Math.floor(Math.min(values[o], values[o + 3], values[o + 6]) / CELL), x1 = Math.floor(Math.max(values[o], values[o + 3], values[o + 6]) / CELL)
    const y0 = Math.floor(Math.min(values[o + 1], values[o + 4], values[o + 7]) / CELL), y1 = Math.floor(Math.max(values[o + 1], values[o + 4], values[o + 7]) / CELL)
    const z0 = Math.floor(Math.min(values[o + 2], values[o + 5], values[o + 8]) / CELL), z1 = Math.floor(Math.max(values[o + 2], values[o + 5], values[o + 8]) / CELL)
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) visit(cellKey(x, y, z))
  }
  for (let i = 0; i < count; i++) each(i, (k) => counts.set(k, (counts.get(k) ?? 0) + 1))
  const cells = new Map()
  for (const [k, n] of counts) cells.set(k, { list: new Int32Array(n), n: 0 })
  for (let i = 0; i < count; i++) each(i, (k) => { const c = cells.get(k); c.list[c.n++] = i })
  const out = new Map()
  for (const [k, c] of cells) out.set(k, c.list)
  return { world, cells: out, stamp: new Int32Array(count), now: 0 }
}

/* ---- the nearest point, in closed form (Ericson, Real-Time Collision Detection 5.1.5) ---- */
function pointTriangleSq(px, py, pz, ax, ay, az, bx, by, bz, cx, cy, cz) {
  const abx = bx - ax, aby = by - ay, abz = bz - az, acx = cx - ax, acy = cy - ay, acz = cz - az
  const apx = px - ax, apy = py - ay, apz = pz - az
  const d1 = abx * apx + aby * apy + abz * apz, d2 = acx * apx + acy * apy + acz * apz
  if (d1 <= 0 && d2 <= 0) return apx * apx + apy * apy + apz * apz
  const bpx = px - bx, bpy = py - by, bpz = pz - bz
  const d3 = abx * bpx + aby * bpy + abz * bpz, d4 = acx * bpx + acy * bpy + acz * bpz
  if (d3 >= 0 && d4 <= d3) return bpx * bpx + bpy * bpy + bpz * bpz
  const vc = d1 * d4 - d3 * d2
  if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); const qx = apx - v * abx, qy = apy - v * aby, qz = apz - v * abz; return qx * qx + qy * qy + qz * qz }
  const cpx = px - cx, cpy = py - cy, cpz = pz - cz
  const d5 = abx * cpx + aby * cpy + abz * cpz, d6 = acx * cpx + acy * cpy + acz * cpz
  if (d6 >= 0 && d5 <= d6) return cpx * cpx + cpy * cpy + cpz * cpz
  const vb = d5 * d2 - d1 * d6
  if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); const qx = apx - w * acx, qy = apy - w * acy, qz = apz - w * acz; return qx * qx + qy * qy + qz * qz }
  const va = d3 * d6 - d5 * d4
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    const w = (d4 - d3) / ((d4 - d3) + (d5 - d6))
    const qx = bpx - w * (cx - bx), qy = bpy - w * (cy - by), qz = bpz - w * (cz - bz)
    return qx * qx + qy * qy + qz * qz
  }
  const denom = 1 / (va + vb + vc), v = vb * denom, w = vc * denom
  const qx = apx - abx * v - acx * w, qy = apy - aby * v - acy * w, qz = apz - abz * v - acz * w
  return qx * qx + qy * qy + qz * qz
}

/** a triangle cut to the band lo <= y <= hi: a convex polygon of up to five corners, flat */
function clipBand(t, o, lo, hi, out) {
  let poly = [t[o], t[o + 1], t[o + 2], t[o + 3], t[o + 4], t[o + 5], t[o + 6], t[o + 7], t[o + 8]]
  for (const [level, keepAbove] of [[lo, true], [hi, false]]) {
    const next = []
    const n = poly.length / 3
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n
      const ay = poly[i * 3 + 1], by = poly[j * 3 + 1]
      const ain = keepAbove ? ay >= level : ay <= level, bin = keepAbove ? by >= level : by <= level
      if (ain) next.push(poly[i * 3], ay, poly[i * 3 + 2])
      if (ain !== bin) {
        const s = (level - ay) / (by - ay)
        next.push(poly[i * 3] + s * (poly[j * 3] - poly[i * 3]), level, poly[i * 3 + 2] + s * (poly[j * 3 + 2] - poly[i * 3 + 2]))
      }
    }
    poly = next
    if (poly.length < 9) break
  }
  out.length = 0
  for (const v of poly) out.push(v)
  return out
}

/**
 * THE NEAREST DRAWN SURFACE AT EYE HEIGHT: the distance from the eye to the
 * closest point of any triangle inside the band about the eye's height, and
 * the triangle, searched out to `limit`.
 */
export function nearestAtEye(grid, eye, { band = EYE_BAND_M, limit = NEAR_LIMIT_M } = {}) {
  const { world: { values }, cells, stamp } = grid
  const clearOf = grid.world.clear ?? NONE
  const [px, py, pz] = eye
  const lo = py - band, hi = py + band
  let best = limit * limit, tri = -1
  const poly = []
  const cx = Math.floor(px / CELL), cz = Math.floor(pz / CELL)
  const y0 = Math.floor(lo / CELL), y1 = Math.floor(hi / CELL)
  const now = ++grid.now
  // rings outward: once the best is inside the ring searched, nothing further can beat it
  for (let r = 1; r <= Math.ceil(limit / CELL); r++) {
    for (let x = cx - r; x <= cx + r; x++) for (let z = cz - r; z <= cz + r; z++) {
      if (r > 1 && Math.abs(x - cx) < r && Math.abs(z - cz) < r) continue
      for (let y = y0; y <= y1; y++) {
        const list = cells.get(cellKey(x, y, z))
        if (!list) continue
        for (let k = 0; k < list.length; k++) {
          const i = list[k]
          if (stamp[i] === now) continue
          stamp[i] = now
          if (clearOf[i]) continue
          const o = i * 9
          const tlo = Math.min(values[o + 1], values[o + 4], values[o + 7]), thi = Math.max(values[o + 1], values[o + 4], values[o + 7])
          if (thi < lo || tlo > hi) continue
          let d
          if (tlo >= lo && thi <= hi) d = pointTriangleSq(px, py, pz, values[o], values[o + 1], values[o + 2], values[o + 3], values[o + 4], values[o + 5], values[o + 6], values[o + 7], values[o + 8])
          else {
            clipBand(values, o, lo, hi, poly)
            const n = poly.length / 3
            d = Infinity
            for (let f = 1; f + 1 < n; f++) {
              d = Math.min(d, pointTriangleSq(px, py, pz, poly[0], poly[1], poly[2], poly[f * 3], poly[f * 3 + 1], poly[f * 3 + 2], poly[f * 3 + 3], poly[f * 3 + 4], poly[f * 3 + 5]))
            }
          }
          if (d < best) { best = d; tri = i }
        }
      }
    }
    // the ring of radius r covers at least (r) cells' metres every way about the eye's own cell
    if (Math.sqrt(best) <= r * CELL) break
  }
  // the stamp is a frame's own: reset it before it wraps
  if (grid.now > 2e9) { grid.stamp.fill(0); grid.now = 0 }
  return { distance: Math.sqrt(best), triangle: tri, label: tri >= 0 ? grid.world.labels[grid.world.label[tri]] : null }
}

/** A RAY'S FIRST HIT within `limit` metres (Moller and Trumbore), through the grid's cells (Amanatides and Woo). */
export function castRay(grid, o, d, limit = NEAR_LIMIT_M) {
  const { world: { values }, cells, stamp } = grid
  const clearOf = grid.world.clear ?? NONE
  const now = ++grid.now
  let best = limit, tri = -1
  const c = [Math.floor(o[0] / CELL), Math.floor(o[1] / CELL), Math.floor(o[2] / CELL)]
  const step = d.map((v) => (v > 0 ? 1 : v < 0 ? -1 : 0))
  const tMax = [0, 1, 2].map((k) => (d[k] === 0 ? Infinity : ((c[k] + (step[k] > 0 ? 1 : 0)) * CELL - o[k]) / d[k]))
  const tDelta = [0, 1, 2].map((k) => (d[k] === 0 ? Infinity : CELL / Math.abs(d[k])))
  let tCell = 0
  for (let guard = 0; guard < 64; guard++) {
    const list = cells.get(cellKey(c[0], c[1], c[2]))
    if (list) {
      for (let k = 0; k < list.length; k++) {
        const i = list[k]
        if (stamp[i] === now) continue
        stamp[i] = now
        if (clearOf[i]) continue
        const q = i * 9
        const e1x = values[q + 3] - values[q], e1y = values[q + 4] - values[q + 1], e1z = values[q + 5] - values[q + 2]
        const e2x = values[q + 6] - values[q], e2y = values[q + 7] - values[q + 1], e2z = values[q + 8] - values[q + 2]
        const px = d[1] * e2z - d[2] * e2y, py = d[2] * e2x - d[0] * e2z, pz = d[0] * e2y - d[1] * e2x
        const det = e1x * px + e1y * py + e1z * pz
        if (Math.abs(det) < 1e-12) continue
        const inv = 1 / det
        const sx = o[0] - values[q], sy = o[1] - values[q + 1], sz = o[2] - values[q + 2]
        const u = (sx * px + sy * py + sz * pz) * inv
        if (u < 0 || u > 1) continue
        const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x
        const v = (d[0] * qx + d[1] * qy + d[2] * qz) * inv
        if (v < 0 || u + v > 1) continue
        const t = (e2x * qx + e2y * qy + e2z * qz) * inv
        if (t > 1e-6 && t < best) { best = t; tri = i }
      }
    }
    const k = tMax[0] < tMax[1] ? (tMax[0] < tMax[2] ? 0 : 2) : tMax[1] < tMax[2] ? 1 : 2
    tCell = tMax[k]
    // a hit inside the cells already walked cannot be beaten further on
    if (best <= tCell || tCell > limit) break
    c[k] += step[k]
    tMax[k] += tDelta[k]
  }
  if (grid.now > 2e9) { grid.stamp.fill(0); grid.now = 0 }
  return { t: best, triangle: tri }
}

/** a vector turned by a quaternion [x, y, z, w] */
export function turned(q, v) {
  const [x, y, z, w] = q, [vx, vy, vz] = v
  const tx = 2 * (y * vz - z * vy), ty = 2 * (z * vx - x * vz), tz = 2 * (x * vy - y * vx)
  return [vx + w * tx + (y * tz - z * ty), vy + w * ty + (z * tx - x * tz), vz + w * tz + (x * ty - y * tx)]
}

/**
 * WHAT THE FRAME HOLDS NEAR THE LENS: a grid of rays over one frame of a
 * track, each to its first drawn surface within `limit`, read as the depth a
 * renderer holds (along the view axis). Returns the nearest depth, where in
 * the frame it stands, and the share of the frame nearer than each of `under`.
 */
export function viewNear(grid, sample, aspect, { cols, rows, limit = 1.5, under = [0.5, 0.75, 1] } = {}) {
  const q = [sample[3], sample[4], sample[5], sample[6]]
  const f = turned(q, [0, 0, -1]), r = turned(q, [1, 0, 0]), u = turned(q, [0, 1, 0])
  const ty = Math.tan((sample[7] * Math.PI) / 360), tx = ty * aspect
  const o = [sample[0], sample[1], sample[2]]
  const counts = under.map(() => 0)
  let min = limit, at = null, tri = -1, centre = limit
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) {
    // the grid's corners are the frame's own edges: a jamb at the edge is in the frame
    const nx = (i / cols) * 2 - 1, ny = (j / rows) * 2 - 1
    const d = [f[0] + nx * tx * r[0] + ny * ty * u[0], f[1] + nx * tx * r[1] + ny * ty * u[1], f[2] + nx * tx * r[2] + ny * ty * u[2]]
    const l = Math.hypot(d[0], d[1], d[2])
    // a depth of `limit` along the axis is a longer ray off it
    const hit = castRay(grid, o, [d[0] / l, d[1] / l, d[2] / l], limit * l)
    const depth = hit.t / l
    for (let k = 0; k < under.length; k++) if (depth < under[k]) counts[k]++
    if (depth < min) { min = depth; at = [nx, ny]; tri = hit.triangle }
  }
  {
    const hit = castRay(grid, o, f, limit)
    centre = hit.t
  }
  const n = (cols + 1) * (rows + 1)
  return { min, at, triangle: tri, label: tri >= 0 ? grid.world.labels[grid.world.label[tri]] : null, centre, share: Object.fromEntries(under.map((d, k) => [d, counts[k] / n])) }
}
