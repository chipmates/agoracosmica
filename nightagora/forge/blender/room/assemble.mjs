// THE ROOM AS glTF: every scanned mesh with the UVs its material's recipe
// samples at. A mesh whose material reads a UV attribute stays in its own
// space under its node's matrix; a surface the engine projects from world
// position is baked to world metres so its UVs can be the engine's own.
import { bake, decomposable } from './gltf.mjs'
import { FLOOR_BAYS, lin, ROOM_ROLES } from './materials.mjs'

const fract = (v) => v - Math.floor(v)
/** hall-fabric.ts `hash`, in double precision (the GPU's float sin differs,
 * so a bay reads another random part of the same photograph) */
const bayHash = (x, y, salt) => fract(Math.sin(x * 12.9898 + y * 78.233 + salt) * 43758.5453)

const rotate = (u, v, turn) => {
  if (!turn) return [u, v]
  const c = Math.cos(turn), s = Math.sin(turn)
  return [u * c - v * s, u * s + v * c]
}
/** the engine's texture coordinate to glTF's: the engine decodes the photo
 * flipped (row 0 at the bottom), glTF reads row 0 at the top */
const toGltf = (uv, i, s, t) => { uv[i] = s; uv[i + 1] = 1 - t }

/** hall-fabric.ts faceFrame: u runs along the face, v up it (a floor's v north) */
function faceFrame(n) {
  if (Math.abs(n[1]) > 0.5) {
    // b = n x (1,0,0)
    return { t: [1, 0, 0], b: [0, n[2], -n[1]] }
  }
  // t = normalize((0,1,0) x n)
  const t = [n[2], 0, -n[0]]
  const l = Math.hypot(t[0], t[2]) || 1
  return { t: [t[0] / l, 0, t[2] / l], b: [0, 1, 0] }
}
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

function worldFaceUV(position, normal, recipe) {
  const uv = new Float32Array((position.length / 3) * 2)
  const { metres, turn, swap } = recipe.uv
  for (let i = 0, j = 0; i < position.length; i += 3, j += 2) {
    const P = [position[i], position[i + 1], position[i + 2]], n = [normal[i], normal[i + 1], normal[i + 2]]
    const f = faceFrame(n)
    const t = swap ? f.b : f.t, b = swap ? f.t : f.b
    const [s, q] = rotate(dot(P, t), dot(P, b), turn)
    toGltf(uv, j, s / metres[0], q / metres[1])
  }
  return uv
}

function attributeUV(uvIn, recipe) {
  if (!uvIn) return null
  const uv = new Float32Array(uvIn.length)
  const { metres, turn } = recipe.uv
  for (let j = 0; j < uvIn.length; j += 2) {
    const [s, q] = rotate(uvIn[j], uvIn[j + 1], turn)
    toGltf(uv, j, s / metres[0], q / metres[1])
  }
  return uv
}

/** THE FLOOR, CUT INTO ITS BAYS: one quad per bay, each with its own shift
 * into the photograph and its own tone, exactly where the engine's hash puts
 * them. The rest of the look (drift, saw cuts) is Cycles' own node work. */
function floorBays(position, recipe) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, y = 0
  for (let i = 0; i < position.length; i += 3) {
    minX = Math.min(minX, position[i]); maxX = Math.max(maxX, position[i])
    minZ = Math.min(minZ, position[i + 2]); maxZ = Math.max(maxZ, position[i + 2]); y = position[i + 1]
  }
  const B = FLOOR_BAYS
  // east = x, north = -z
  const e0 = Math.floor((minX - B.originEast) / B.east), e1 = Math.floor((maxX - B.originEast) / B.east)
  const n0 = Math.floor((-maxZ - B.originNorth) / B.north), n1 = Math.floor((-minZ - B.originNorth) / B.north)
  const P = [], N = [], UV = [], C = []
  const { metres, turn } = recipe.uv
  for (let ce = e0; ce <= e1; ce++) for (let cn = n0; cn <= n1; cn++) {
    const x0 = Math.max(minX, B.originEast + ce * B.east), x1 = Math.min(maxX, B.originEast + (ce + 1) * B.east)
    const nA = Math.max(-maxZ, B.originNorth + cn * B.north), nB = Math.min(-minZ, B.originNorth + (cn + 1) * B.north)
    if (x1 - x0 < 1e-6 || nB - nA < 1e-6) continue
    const h1 = bayHash(ce, cn, 3.7), h2 = bayHash(ce, cn, 11.3)
    const tone = 1 + (h1 - 0.5) * recipe.tone.cell
    // two triangles, wound to face up (x east, z = -north)
    for (const [x, north] of [[x0, nA], [x1, nA], [x1, nB], [x0, nA], [x1, nB], [x0, nB]]) {
      P.push(x, y, -north); N.push(0, 1, 0); C.push(tone, tone, tone)
      const [s, q] = rotate(x + h1 * B.faceShift, north + h2 * B.faceShift, turn)
      UV.push(s / metres[0], 1 - q / metres[1])
    }
  }
  return { position: new Float32Array(P), normal: new Float32Array(N), uv: new Float32Array(UV), colour: new Float32Array(C) }
}

/** the rooms' construction: each vertex its role's colour, the hall's own
 * stones inside the hall; the triangles split by role so each role keeps its
 * own roughness and metalness */
function roomRoles(position, roles) {
  const R = ROOM_ROLES, colour = new Float32Array(position.length), keys = []
  const inBox = (b, x, z) => x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ
  for (let i = 0, v = 0; i < position.length; i += 3, v++) {
    const role = R.roles[Math.max(0, Math.min(5, Math.round(roles[v])))][0]
    const x = position[i], z = position[i + 2], hall = inBox(R.hallBox, x, z)
    let hex = R.palette[role]
    if (hall && role === 'floor') hex = R.hall.floor
    if (hall && role === 'plaster') hex = inBox(R.bayBox, x, z) ? R.hall.bay : R.hall.plaster
    if (hall && role === 'ceiling') hex = R.hall.ceiling
    const c = lin(hex)
    colour[i] = c[0]; colour[i + 1] = c[1]; colour[i + 2] = c[2]
    keys.push(`${role}${hall && role === 'floor' ? '-hall' : ''}`)
  }
  return { colour, keys }
}

/** split a non-indexed (or indexed) triangle list by a per-vertex key */
function splitBy(prim, keys) {
  const groups = new Map()
  const tri = prim.index ? prim.index.length / 3 : prim.position.length / 9
  for (let t = 0; t < tri; t++) {
    const v0 = prim.index ? prim.index[t * 3] : t * 3
    const k = keys[v0]
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k).push(t)
  }
  const out = new Map()
  for (const [k, tris] of groups) {
    const P = new Float32Array(tris.length * 9), N = new Float32Array(tris.length * 9)
    const U = prim.uv ? new Float32Array(tris.length * 6) : null, C = prim.colour ? new Float32Array(tris.length * 9) : null
    tris.forEach((t, j) => {
      for (let c = 0; c < 3; c++) {
        const v = prim.index ? prim.index[t * 3 + c] : t * 3 + c, o = j * 3 + c
        P.set(prim.position.subarray(v * 3, v * 3 + 3), o * 3)
        N.set(prim.normal.subarray(v * 3, v * 3 + 3), o * 3)
        if (U) U.set(prim.uv.subarray(v * 2, v * 2 + 2), o * 2)
        if (C) C.set(prim.colour.subarray(v * 3, v * 3 + 3), o * 3)
      }
    })
    out.set(k, { position: P, normal: N, uv: U, colour: C })
  }
  return out
}

const flipWinding = (index, count) => {
  const out = index ? Uint32Array.from(index) : Uint32Array.from({ length: count }, (_, i) => i)
  for (let i = 0; i < out.length; i += 3) { const t = out[i + 1]; out[i + 1] = out[i + 2]; out[i + 2] = t }
  return out
}
const det3 = (m) => m[0] * (m[5] * m[10] - m[9] * m[6]) - m[4] * (m[1] * m[10] - m[9] * m[2]) + m[8] * (m[1] * m[6] - m[5] * m[2])

/**
 * scan: the page's inventory; geoms: uuid -> decoded arrays; recipes: material
 * uuid -> recipe; materialDef(recipe, variantKey) -> glTF material index.
 * Returns { placed: [{name, machine, stamp, family, material, uuid}] }.
 */
export function assemble(gltf, scan, geoms, recipes, materialDef) {
  const meshCache = new Map()
  const placed = []
  for (const m of scan.meshes) {
    const g = geoms[m.geometry]
    const meta = scan.geometries[m.geometry]
    const groups = meta.groups.length ? meta.groups : [[0, g.index ? g.index.length : g.position.length / 3, 0]]
    for (const [start, count, mi] of groups) {
      const muuid = m.materials[mi] ?? m.materials[0]
      const recipe = recipes[muuid]
      if (!recipe || recipe.kind === 'hidden') continue
      // the triangles of this group: an index range, or a vertex range
      const index = g.index ? g.index.subarray(start, start + count) : null
      const range = !g.index && (start !== 0 || count !== g.position.length / 3) ? [start, count] : null
      const slice = (arr, size) => (arr && range ? arr.subarray(range[0] * size, (range[0] + range[1]) * size) : arr ?? null)
      const base = { position: slice(g.position, 3), normal: slice(g.normal, 3), uv: slice(g.uv, 2), colour: slice(g.color, 3), role: slice(g.collectionRoomRole, 1) }
      const world = recipe.uv?.mode === 'world-face' || recipe.uv?.mode === 'world-floor-bays' || recipe.split === 'collectionRoomRole'
      const instances = m.instances
      for (let ii = 0; ii < instances.length; ii++) {
        const mat = instances[ii]
        const bakeIt = world || !decomposable(mat)
        const cacheKey = `${m.geometry}|${start}|${muuid}${bakeIt ? `|${m.uuid}|${ii}` : ''}`
        let meshIndex = meshCache.get(cacheKey)
        if (meshIndex === undefined) {
          let prim = { position: base.position, normal: base.normal, index }
          if (bakeIt) {
            const b = bake(base.position, base.normal, mat)
            prim = { position: b.position, normal: b.normal, index: det3(mat) < 0 ? flipWinding(index, base.position.length / 3) : index }
          }
          const prims = []
          if (recipe.uv?.mode === 'world-floor-bays') {
            const bays = floorBays(prim.position, recipe)
            prims.push({ ...bays, material: materialDef(recipe) })
          } else if (recipe.split === 'collectionRoomRole' && base.role) {
            const { colour, keys } = roomRoles(prim.position, base.role)
            for (const [k, part] of splitBy({ ...prim, colour, uv: null }, keys)) prims.push({ ...part, material: materialDef(recipe, k) })
          } else {
            let uv = null
            if (recipe.uv?.mode === 'world-face') uv = worldFaceUV(prim.position, prim.normal, recipe)
            else if (recipe.uv) uv = attributeUV(base.uv, recipe)
            const colour = recipe.base?.mode === 'vertex' && base.colour ? base.colour : null
            prims.push({ position: prim.position, normal: prim.normal, uv: uv ?? undefined, colour: colour ?? undefined, index: prim.index ?? undefined, material: materialDef(recipe) })
          }
          meshIndex = gltf.mesh(`${m.name || m.path.at(-1)}`, prims)
          meshCache.set(cacheKey, meshIndex)
        }
        const name = `${m.stamp ?? 'room'}/${m.name || 'mesh'}${instances.length > 1 ? `#${ii}` : ''}`
        gltf.node(name, meshIndex, bakeIt ? null : mat, { machine: m.machine, stamp: m.stamp, material: recipe.name, family: recipe.family })
        placed.push({ name, machine: m.machine, stamp: m.stamp, family: recipe.family, material: recipe.name, uuid: m.uuid })
      }
    }
  }
  return { placed }
}
