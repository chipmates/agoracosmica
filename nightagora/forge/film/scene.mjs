// THE WING'S WORLD, MOUNTED IN NODE AND CUT INTO CELLS: what the PICTURE key
// of a clip reads. Every triangle is hashed where it stands in world metres,
// with the material that shades it, into each cell of a world grid its box
// meets; a cell's hash changes exactly when something drawn inside it does.
//
//   node forge/film/scene.mjs            the mount, its counts and its time
//
// Cells and not meshes, because the wing batches: one draw holds a room's
// frames, so a mesh cannot say which frame a clip saw. The ID pass of the
// export (its depth gives each pixel's world point) names the same cells.
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import * as THREE from 'three/webgpu'
import * as TSL from 'three/tsl'
import { WING_DIR, createLoader } from './load.mjs'
import { mergeManifests } from '../vite-na-assets.mjs'

/** The cell's edge in metres. */
export const CELL_M = 2
/** The film renders the hero geometry (tier `max` keeps hero's geometry). */
export const FILM_TIER = 'hero'
const Q_POSITION = 1e5, Q_UNIT = 1e4
const OFFSET = 2048, SPAN = 4096

/** A cell's number from its integer coordinates; exact below 2^53. */
export const cellNumber = (x, y, z) => ((x + OFFSET) * SPAN + (y + OFFSET)) * SPAN + (z + OFFSET)
export function cellCoords(n) {
  const z = n % SPAN, rest = (n - z) / SPAN
  const y = rest % SPAN, x = (rest - y) / SPAN
  return [x - OFFSET, y - OFFSET, z - OFFSET]
}
const sha256 = (text) => createHash('sha256').update(text).digest('hex')

/* ---- a stable digest of any value the scene holds (materials, node graphs) ---- */
const VOLATILE = new Set(['uuid', 'id', 'version', 'parent', 'children', '_listeners', 'onBeforeCompile',
  'needsUpdate', '_needsUpdate', 'updateRanges', 'usage', 'dispatchEvent', 'nodeObjects', '_cacheKey', '_cacheKeyVersion'])
const MAX_WALK = 40000

/** Deterministic across two loads: sorted keys, the three.js counters left
    out, a function by its own text, a typed array by its bytes. */
export function stableDigest(value) {
  const hash = createHash('sha256')
  const seen = new Map()
  let walked = 0
  const put = (s) => hash.update(s)
  const walk = (v, depth) => {
    if (v === null || v === undefined) { put(String(v)); return }
    const t = typeof v
    if (t === 'number') { put(Number.isFinite(v) ? `n${Number(v.toPrecision(12))}` : `n${v}`); return }
    if (t === 'string' || t === 'boolean' || t === 'bigint') { put(`${t[0]}${String(v)}`); return }
    if (t === 'function') { put(`f${v.toString()}`); return }
    if (t === 'symbol') { put('y'); return }
    if (seen.has(v)) { put(`@${seen.get(v)}`); return }
    seen.set(v, seen.size)
    if (++walked > MAX_WALK || depth > 60) { put('…'); return }
    if (ArrayBuffer.isView(v)) { put(`${v.constructor.name}:`); hash.update(Buffer.from(v.buffer, v.byteOffset, v.byteLength)); return }
    const name = v.constructor?.name ?? 'Object'
    put(`{${name}`)
    if (Array.isArray(v)) { v.forEach((x) => { put(','); walk(x, depth + 1) }) }
    else if (v instanceof Map) { for (const [k, x] of [...v.entries()].sort(([a], [b]) => (String(a) < String(b) ? -1 : 1))) { put(`;${String(k)}=`); walk(x, depth + 1) } }
    else if (v instanceof Set) { for (const x of v) { put(','); walk(x, depth + 1) } }
    else {
      for (const key of Object.keys(v).sort()) {
        if (VOLATILE.has(key)) continue
        put(`;${key}=`)
        walk(v[key], depth + 1)
      }
    }
    put('}')
  }
  walk(value, 0)
  return hash.digest('hex').slice(0, 24)
}

/* ---- the parts of the world, each built by its own loader ---- */
const at = (loader) => (file) => loader.load(`${WING_DIR}/${file}.ts`)
const factory = (id, file, name, grounded) => ({
  id,
  build: (loader, tier) => {
    const load = at(loader)
    const module = load(file)
    return grounded ? module[name](load('terrain-mesh').gradeAt, tier) : module[name](tier)
  },
})
/** The certificate's factories at the film's tier, then the water, the stands,
    the grave, the machines at rest and the plates. */
const PARTS = [
  factory('shell', 'shell', 'createShell', false), factory('terrain', 'ground', 'createGround', false),
  factory('gate-passage', 'gate-passage', 'createGatePassage', false),
  factory('inner-court', 'inner-court', 'createInnerCourtDressing', true),
  factory('collection', 'collection', 'createCollection', false),
  factory('collection-access', 'collection-access', 'createCollectionAccess', false),
  factory('entry-passage', 'entry-passage', 'createEntryPassage', false),
  factory('vegetation', 'vegetation', 'createVegetation', true),
  factory('road-dressing', 'road-dressing', 'createRoadDressing', true),
  factory('ground-dressing', 'ground-dressing', 'createGroundDressing', true),
  { id: 'water', build: (loader, tier) => at(loader)('water').createWater(new THREE.Scene(), {
    tierName: () => tier, reflector: () => ({ node: TSL.vec4(0, 0, 0, 1), dispose() {} }),
  }) },
  { id: 'stands', build: (loader) => at(loader)('collection/stands').createCollectionStandSolids(new THREE.MeshStandardMaterial({ name: 'stand' })) },
  { id: 'grave', build: (loader) => {
    const load = at(loader)
    const { COURT, GRAVE_ORIGIN } = load('collection/layout')
    const exhibit = () => new THREE.MeshStandardMaterial()
    const materials = { stone: exhibit(), plaster: exhibit(), bronze: exhibit(), ink: exhibit(), dark: exhibit(), tuffeau: exhibit() }
    const grave = load('grave/index').createGrave(materials, 'en')
    load('collection/line-floor').fitCollectionExhibitFloor(grave.group, materials, 'grave')
    grave.group.rotation.y = Math.PI / 2
    grave.group.position.set(GRAVE_ORIGIN.east, COURT.level + .035, -GRAVE_ORIGIN.north)
    return grave.group
  } },
  { id: 'machines', build: (loader, tier) => machinesAtRest(loader, tier) },
  { id: 'plates', build: (loader, tier, library) => plateQuads(loader, library) },
]
export const PART_IDS = PARTS.map((p) => p.id)

/** Each machine in the pose its schedule holds at t=0, on its stand, as the
    certificate stands it; a part's record (its material, its fields) rides
    with its triangles. */
function machinesAtRest(loader, tier) {
  const load = at(loader)
  const { railExhibitStands, railExhibitLevel } = load('rail-solids')
  const { geometryForPart } = load('machines/geometry')
  const { jointValuesAt } = load('machines/motion')
  const all = new THREE.Group()
  for (const slug of Object.keys(railExhibitStands).sort()) {
    const dossier = JSON.parse(loader.text(`${WING_DIR}/machines/data/${slug}.json`))
    for (const [joint, value] of Object.entries(jointValuesAt(slug, 0))) {
      if (Math.abs(value) > 1e-12) throw new Error(`${slug}: joint ${joint} is not at rest at t=0`)
    }
    const { parts: _parts, ...whole } = dossier
    const wholeDigest = stableDigest(whole)
    const stand = railExhibitStands[slug]
    const root = new THREE.Group()
    root.name = `machine:${slug}`
    root.rotation.y = stand.bearing * Math.PI / 180
    root.position.set(stand.east, railExhibitLevel(stand.ground) + stand.plinth - (dossier.frame?.ground_y_m ?? 0), -stand.north)
    const nodes = new Map([['world', root], ['root', root]])
    const pending = [...dossier.parts]
    const built = new Set()
    let guard = 0
    while (pending.length && guard++ < 20000) {
      const part = pending.shift()
      if (part.parent && !nodes.has(part.parent) && dossier.parts.some((other) => other.id === part.parent) && !built.has(part.parent)) { pending.push(part); continue }
      const group = new THREE.Group()
      group.position.fromArray(part.position_m)
      group.rotation.set(part.orientation_rad[0] ?? 0, part.orientation_rad[1] ?? 0, part.orientation_rad[2] ?? 0)
      ;(nodes.get(part.parent) ?? root).add(group)
      nodes.set(part.id, group)
      built.add(part.id)
      const material = new THREE.MeshStandardMaterial({ name: `${slug}/${part.id}` })
      material.userData.record = stableDigest(part)
      material.userData.machine = wholeDigest
      const mesh = new THREE.Mesh(geometryForPart(part, tier, slug), material)
      mesh.name = `vinci/${slug}/${part.id}`
      group.add(mesh)
    }
    if (pending.length) throw new Error(`${slug}: unresolved parent for ${pending.map((p) => p.id).join(', ')}`)
    all.add(root)
  }
  return all
}

/** The store's files a plate binds: its work's or its sheet's entries. */
export function librarySetOf(library, id) {
  return library.filter((e) => typeof e.path === 'string' && (e.path.includes(`/${id}.`) || e.path.includes(`/${id}/`) || e.path.includes(`${id}__`)))
    .map((e) => `${e.id}|${e.path}|${e.sha256 ?? ''}`).sort()
}

/** Every plate as the quad it is streamed onto: the hang, the body wall and
    the mural, each bound to the store's files for its work. */
function plateQuads(loader, library) {
  const load = at(loader)
  const group = new THREE.Group()
  const quad = (name, width, height, position, bearing, identity) => {
    const material = new THREE.MeshBasicMaterial({ name })
    material.userData.library = identity
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material)
    mesh.name = name
    mesh.position.set(...position)
    mesh.rotation.y = bearing
    group.add(mesh)
  }
  for (const field of load('collection/hang').hangPlacements()) {
    quad(`plate:${field.id}:${field.face}`, field.width, field.height, [field.east, field.datum, -field.north], Math.PI, librarySetOf(library, field.id))
  }
  const { COURT, SUPPER_WALL } = load('collection/layout')
  for (const mount of load('collection/body-wall').bodyMounts()) {
    quad(`sheet:${mount.id}`, mount.width, mount.height, [mount.east, mount.datum, -mount.north], -Math.PI / 2, librarySetOf(library, mount.id))
  }
  const S = SUPPER_WALL
  quad('plate:last-supper:front', S.field.width, S.field.height,
    [S.east + S.thickness / 2 + .0005, COURT.level + S.field.sill + S.field.height / 2, -S.north], Math.PI / 2, librarySetOf(library, 'last-supper'))
  return group
}

/* ---- one part into its cells ---- */
const qp = (v) => Math.round(v * Q_POSITION)
const qu = (v) => Math.round(v * Q_UNIT)
function fnv(values, seed) {
  let h = seed >>> 0
  for (const v of values) {
    h = Math.imul(h ^ (v & 0xffff), 16777619)
    h = Math.imul(h ^ ((v >>> 16) & 0xffff), 16777619)
    h = Math.imul(h ^ (Math.floor(v / 4294967296) & 0xffff), 16777619)
  }
  return h >>> 0
}
const MIRROR = /stream-reflection/

/** Every drawable of one part into the cells its triangles meet: per cell,
    per (part, mesh name, material), a count and two order-free sums. */
function contributionOf(part, group, cell) {
  const acc = new Map()
  const materialDigest = new Map()
  const mirror = new Set(), mirrorY = []
  let top = -Infinity, triangles = 0, meshes = 0
  const pA = new THREE.Vector3(), pB = new THREE.Vector3(), pC = new THREE.Vector3()
  const nA = new THREE.Vector3(), normalMatrix = new THREE.Matrix3()
  const instance = new THREE.Matrix4(), world = new THREE.Matrix4()
  const add = (cellNo, key, a, b) => {
    let held = acc.get(cellNo)
    if (!held) { held = new Map(); acc.set(cellNo, held) }
    const sum = held.get(key)
    if (sum) { sum[0]++; sum[1] = (sum[1] + a) >>> 0; sum[2] = (sum[2] + b) >>> 0 }
    else held.set(key, [1, a, b])
  }
  group.updateMatrixWorld(true)
  group.traverse((object) => {
    if (!(object.isMesh || object.isLine || object.isPoints) || !object.geometry || object.visible === false) return
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    const digests = materials.map((m) => {
      if (!m) return 'none'
      if (!materialDigest.has(m)) materialDigest.set(m, stableDigest(m))
      return materialDigest.get(m)
    })
    const geometry = object.geometry
    const position = geometry.getAttribute('position')
    if (!position) return
    meshes++
    const normal = geometry.getAttribute('normal'), uv = geometry.getAttribute('uv'), color = geometry.getAttribute('color')
    const index = geometry.getIndex()
    const count = index ? index.count : position.count
    const groups = geometry.groups?.length ? geometry.groups : [{ start: 0, count, materialIndex: 0 }]
    const instances = object.isInstancedMesh ? object.count : 1
    const reflects = MIRROR.test(object.name)
    const corners = object.isMesh ? 3 : object.isLine ? 2 : 1
    for (let k = 0; k < instances; k++) {
      if (object.isInstancedMesh) { object.getMatrixAt(k, instance); world.multiplyMatrices(object.matrixWorld, instance) }
      else world.copy(object.matrixWorld)
      normalMatrix.getNormalMatrix(world)
      for (const g of groups) {
        const key = `${part}|${object.name}|${digests[g.materialIndex ?? 0] ?? digests[0]}`
        const end = Math.min(count, g.start + g.count)
        for (let i0 = g.start; i0 + corners - 1 < end; i0 += corners) {
          const ints = []
          let lx = Infinity, ly = Infinity, lz = Infinity, hx = -Infinity, hy = -Infinity, hz = -Infinity
          for (let c = 0; c < corners; c++) {
            const i = index ? index.getX(i0 + c) : i0 + c
            const p = c === 0 ? pA : c === 1 ? pB : pC
            p.fromBufferAttribute(position, i).applyMatrix4(world)
            ints.push(qp(p.x), qp(p.y), qp(p.z))
            if (normal) { nA.fromBufferAttribute(normal, i).applyMatrix3(normalMatrix).normalize(); ints.push(qu(nA.x), qu(nA.y), qu(nA.z)) }
            if (uv) ints.push(qu(uv.getX(i)), qu(uv.getY(i)))
            if (color) ints.push(qu(color.getX(i)), qu(color.getY(i)), qu(color.getZ(i)))
            lx = Math.min(lx, p.x); ly = Math.min(ly, p.y); lz = Math.min(lz, p.z)
            hx = Math.max(hx, p.x); hy = Math.max(hy, p.y); hz = Math.max(hz, p.z)
          }
          if (!Number.isFinite(lx + ly + lz + hx + hy + hz)) continue
          triangles++
          if (hy > top) top = hy
          const a = fnv(ints, 2166136261), b = fnv(ints, 3339675911)
          const x0 = Math.floor(lx / cell), x1 = Math.floor(hx / cell), y0 = Math.floor(ly / cell), y1 = Math.floor(hy / cell)
          const z0 = Math.floor(lz / cell), z1 = Math.floor(hz / cell)
          for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
            const n = cellNumber(x, y, z)
            add(n, key, a, b)
            if (reflects) mirror.add(n)
          }
          if (reflects && corners === 3) mirrorY.push((pA.y + pB.y + pC.y) / 3)
        }
      }
    }
  })
  return { acc, mirror: [...mirror], mirrorY, top, triangles, meshes }
}

/* ---- the world: every part, memoised on the files it read ---- */
const memo = new Map()
/** The store's entries a vinci frame can bind: the material library, the
    models and the wing's own scope. */
export const libraryOf = (merged) => (Array.isArray(merged) ? merged : (merged.assets ?? []))
  .filter((e) => /^(library|models|wing-vinci)$/.test(e.wing ?? ''))

/**
 * The world's cells for a tree (the working tree, a revision, and any planted
 * texts over it). A part whose every file reads as it did the last time is not
 * built again: a factory is a function of the files it reads.
 */
export async function mountWorld({ rev = '', overlay = {}, tier = FILM_TIER, library, cell = CELL_M } = {}) {
  const check = await createLoader({ rev, overlay })
  const lib = library ?? libraryOf(mergeManifests())
  const libDigest = sha256(JSON.stringify(lib.map((e) => [e.id, e.path, e.sha256 ?? ''])))
  const parts = []
  for (const part of PARTS) {
    const slot = `${part.id}|${tier}|${rev}|${cell}`
    const held = memo.get(slot)
    const same = held && (part.id !== 'plates' || held.libDigest === libDigest)
      && held.files.every(([file, digest]) => { try { return sha256(check.text(file)) === digest } catch { return false } })
    if (same) { parts.push({ id: part.id, ...held, reused: true }); continue }
    const t = Date.now()
    const loader = await createLoader({ rev, overlay })
    const group = part.build(loader, tier, lib)
    const contribution = contributionOf(part.id, group, cell)
    const entry = { files: loader.sources().map((s) => [s.file, s.sha256]), contribution, libDigest, ms: Date.now() - t }
    memo.set(slot, entry)
    parts.push({ id: part.id, ...entry, reused: false })
  }
  const site = at(check)('site')
  const azimuth = site.hourKey.sun_azimuth_deg.value * Math.PI / 180, elevation = site.hourKey.sun_elevation_deg.value * Math.PI / 180
  // the key light's own direction (`stack/light.ts`)
  const sun = [Math.sin(azimuth) * Math.cos(elevation), Math.sin(elevation), -Math.cos(azimuth) * Math.cos(elevation)]
  /* the cells of all parts together */
  const merged = new Map()
  let top = -Infinity
  const mirror = new Set(), mirrorY = []
  for (const { contribution } of parts) {
    top = Math.max(top, contribution.top)
    for (const n of contribution.mirror) mirror.add(n)
    for (const y of contribution.mirrorY) mirrorY.push(y)
    for (const [n, held] of contribution.acc) {
      if (!merged.has(n)) merged.set(n, [])
      for (const [key, [c, a, b]] of held) merged.get(n).push(`${key}|${c}|${a}|${b}`)
    }
  }
  const hashes = new Map()
  for (const [n, lines] of merged) hashes.set(n, sha256(lines.sort().join('\n')).slice(0, 20))
  const mirrorLevel = mirrorY.length ? mirrorY.reduce((s, y) => s + y, 0) / mirrorY.length : undefined
  const files = new Map()
  for (const p of parts) for (const [file, digest] of p.files) files.set(file, digest)
  /* the library entries a plate binds; every other entry is the global key's */
  const claimed = new Set()
  plateQuads(check, lib).traverse((o) => { if (o.isMesh) for (const e of o.material.userData.library) claimed.add(e) })
  return {
    tier, sun, parts: parts.map(({ id, reused, ms, contribution }) => ({ id, reused, ms, triangles: contribution.triangles, meshes: contribution.meshes })),
    cells: { cell, hashes, top, mirror: [...mirror].sort((a, b) => a - b), mirrorLevel },
    files: [...files.entries()].sort(([a], [b]) => (a < b ? -1 : 1)),
    library: lib, claimed,
  }
}

async function main() {
  const t0 = Date.now()
  const world = await mountWorld()
  const t1 = Date.now()
  const again = await mountWorld()
  const t2 = Date.now()
  const triangles = world.parts.reduce((s, p) => s + p.triangles, 0)
  console.log(`the world at ${world.tier}: ${world.parts.length} parts, ${world.parts.reduce((s, p) => s + p.meshes, 0)} drawables, ${triangles} triangles, ${world.files.length} files read, in ${((t1 - t0) / 1000).toFixed(1)} s`)
  console.log(`  ${world.parts.map((p) => `${p.id} ${p.ms} ms`).join(', ')}`)
  console.log(`cells of ${world.cells.cell} m: ${world.cells.hashes.size} occupied; top ${world.cells.top.toFixed(1)} m; reflecting water in ${world.cells.mirror.length} cells at ${world.cells.mirrorLevel?.toFixed(3)} m; sun ${world.sun.map((v) => v.toFixed(3)).join(', ')}`)
  console.log(`library entries a frame can bind: ${world.library.length}, of them a plate's: ${world.claimed.size}`)
  const differ = [...world.cells.hashes].filter(([n, h]) => again.cells.hashes.get(n) !== h).length
  console.log(`a second mount, every part reused: ${again.parts.every((p) => p.reused)}, in ${((t2 - t1) / 1000).toFixed(1)} s; cells that differ ${differ}`)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main()
