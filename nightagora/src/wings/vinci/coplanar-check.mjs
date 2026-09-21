#!/usr/bin/env node
/** TWO FACES IN ONE PLANE, FOUND OFFLINE. A depth test between two faces that
 * share a plane is decided by the last bit of the interpolated depth, so the
 * winner changes with the eye and the surface breaks up as a visitor walks.
 * The owner's walk found three of these the hard way. This finds them without
 * a renderer: every pair of faces within 2 mm of one plane whose plan areas
 * overlap by more than a stated area, over the wing's BUILT geometry.
 *
 *   node src/wings/vinci/coplanar-check.mjs [--all] [--area 0.01]
 *
 * What it does not cover, and says so rather than implying otherwise: the sown
 * bodies (vegetation, ground dressing, terrain grass) are cards on a slope,
 * not architecture, and are left out; no renderer, no light, no draw order and
 * no claim about which face wins, only that the question is open.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import * as THREE from 'three/webgpu'
import * as TSL from 'three/tsl'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const args = process.argv.slice(2)
const ALL = args.includes('--all')
const AREA_MIN = Number(args[args.indexOf('--area') + 1]) || 0.01
/** a plane is one plane when two faces lie within this of it */
/* AND NEARLY ONE PLANE IS THE SAME DEFECT AT A DISTANCE. Two faces two
   millimetres apart share a plane here; two faces twenty millimetres apart
   share one on the SCREEN as soon as the depth buffer cannot separate them,
   which is what a comb of stripes along a junction is. `--near <mm>` widens
   the bed to the depth resolution the eye actually has at that range, and the
   measured gap is reported with every pair, so a reading is never confused
   with the exactly shared case. */
const NEAR_MM = Number(args[args.indexOf('--near') + 1]) || 0
const BED = NEAR_MM > 0 ? NEAR_MM / 1000 : 0.002
const source = relative => fs.readFileSync(path.join(root, relative), 'utf8')
/** Every three.js addon the wing's own sources import, resolved once up front:
 * the module loader below is synchronous and cannot await one. */
const addons = new Map()
for (const dir of ['src/wings/vinci', 'src/stack', 'src/wings/vitrine', 'src']) {
  const walk = at => fs.readdirSync(at, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? (entry.name === 'node_modules' ? [] : walk(path.join(at, entry.name)))
      : /\.(ts|mjs)$/.test(entry.name) ? [path.join(at, entry.name)] : [])
  for (const file of walk(path.join(root, dir)))
    for (const hit of fs.readFileSync(file, 'utf8').matchAll(/from '(three\/addons\/[^']+)'/g))
      addons.set(hit[1], null)
}
for (const specifier of [...addons.keys()]) addons.set(specifier, await import(specifier))
const cache = new Map()
/** A data file read through an ES default import as the bundler gives it. */
const asJson = relative => { const value = JSON.parse(source(relative)); return { ...value, default: value } }
function load(relative) {
  if (cache.has(relative)) return cache.get(relative)
  const module = { exports: {} }
  cache.set(relative, module.exports)
  const compiled = ts.transpileModule(source(relative), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const require = specifier => {
    if (specifier === 'three/tsl') return TSL
    if (specifier === 'three' || specifier === 'three/webgpu') return THREE
    if (addons.has(specifier)) return addons.get(specifier)
    if (!specifier.startsWith('.')) throw new Error(`Unexpected import: ${specifier}`)
    const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(relative), specifier))
    if (resolved.endsWith('?raw')) return { default: source(resolved.slice(0, -4)) }
    if (resolved.endsWith('.json')) return asJson(resolved)
    const file = fs.existsSync(path.join(root, resolved + '.ts')) ? resolved + '.ts'
      : fs.existsSync(path.join(root, resolved + '.json')) ? resolved + '.json' : resolved + '/index.ts'
    if (file.endsWith('.json')) return asJson(file)
    return load(file)
  }
  vm.runInNewContext(compiled, { module, exports: module.exports, require, console,
    matchMedia: () => ({ matches: false }), performance, URL, URLSearchParams,
    location: { search: '' }, crypto: globalThis.crypto, TextEncoder: globalThis.TextEncoder },
  { filename: relative })
  return module.exports
}

/* ---- the wing's built geometry, in the frame it is mounted in ---- */
const stone = () => new THREE.MeshStandardMaterial()
const exhibitMaterials = { stone: stone(), plaster: stone(), bronze: stone(), ink: stone(), dark: stone(), tuffeau: stone() }
const { COURT, GRAVE_ORIGIN } = load('src/wings/vinci/collection/layout.ts')
const bodies = []
const add = (name, group) => { if (group) bodies.push({ name, group }) }
add('collection', load('src/wings/vinci/collection.ts').createCollection())
add('collection-access', load('src/wings/vinci/collection-access.ts').createCollectionAccess())
add('shell', load('src/wings/vinci/shell.ts').createShell({ name: 'hero' }))
add('gate-passage', load('src/wings/vinci/gate-passage.ts').createGatePassage('hero'))
add('entry-passage', load('src/wings/vinci/entry-passage.ts').createEntryPassage('hero'))
{
  // The grave carries the court's gallery: its own walls, returns and kerbs.
  // The exhibit host mounts it turned a quarter turn, and clips its floor to
  // the court's reservation first, so this stands it exactly as the wing does.
  const { createGrave } = load('src/wings/vinci/grave/index.ts')
  const { fitCollectionExhibitFloor } = load('src/wings/vinci/collection/line-floor.ts')
  const grave = createGrave(exhibitMaterials, 'en')
  fitCollectionExhibitFloor(grave.group, exhibitMaterials, 'grave')
  grave.group.rotation.y = Math.PI / 2
  grave.group.position.set(GRAVE_ORIGIN.east, COURT.level + .035, -GRAVE_ORIGIN.north)
  add('grave', grave.group)
}

/* ---- every triangle, in world metres, with its own plane ---- */
const faces = []
for (const { name, group } of bodies) {
  group.updateMatrixWorld(true)
  group.traverse(object => {
    if (!object.isMesh || !object.geometry) return
    const position = object.geometry.getAttribute('position')
    if (!position) return
    const index = object.geometry.getIndex()
    const count = index ? index.count : position.count
    const matrix = object.matrixWorld
    const mesh = object.name || name
    for (let at = 0; at + 2 < count; at += 3) {
      const v = [0, 1, 2].map(corner => {
        const i = index ? index.getX(at + corner) : at + corner
        return new THREE.Vector3(position.getX(i), position.getY(i), position.getZ(i)).applyMatrix4(matrix)
      })
      const u = v[1].clone().sub(v[0]), t = v[2].clone().sub(v[0])
      const n = u.clone().cross(t)
      const twice = n.length()
      if (twice < 1e-9) continue
      n.divideScalar(twice)
      // one plane, whichever way its two faces look: the larger component is
      // made positive so a butt joint lands in the same bucket as its partner.
      const major = Math.abs(n.x) >= Math.abs(n.y) && Math.abs(n.x) >= Math.abs(n.z) ? n.x
        : Math.abs(n.y) >= Math.abs(n.z) ? n.y : n.z
      if (major < 0) n.negate()
      faces.push({ body: name, mesh, n, d: n.dot(v[0]), v, area: twice / 2 })
    }
  })
}

/* ---- buckets: one normal to a degree, then offsets clustered at 2 mm ---- */
const groups = new Map()
for (const face of faces) {
  const key = [face.n.x, face.n.y, face.n.z].map(c => (Math.round(c * 100) / 100).toFixed(2)).join(',')
  if (!groups.has(key)) groups.set(key, [])
  groups.get(key).push(face)
}
/** the shared plan area of two face sets, measured in the plane's own axes */
function shared(a, b, n) {
  const helper = Math.abs(n.y) < .9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)
  const e1 = new THREE.Vector3().crossVectors(n, helper).normalize()
  const e2 = new THREE.Vector3().crossVectors(n, e1)
  const flat = set => set.map(f => f.v.map(q => [q.dot(e1), q.dot(e2)]))
  const A = flat(a), B = flat(b)
  const points = [...A, ...B].flat()
  const box = [Math.min(...points.map(p => p[0])), Math.min(...points.map(p => p[1])),
    Math.max(...points.map(p => p[0])), Math.max(...points.map(p => p[1]))]
  // A plane forty metres across cannot be sampled at a centimetre, so the
  // cell grows with the plane and the area is measured at whatever the cell
  // can resolve. It is reported, so a reading is never finer than its grid.
  const wide = Math.max(box[2] - box[0], box[3] - box[1])
  const CELL = Math.min(.05, Math.max(.01, Math.sqrt(((box[2] - box[0]) * (box[3] - box[1])) / 2e6)))
  const cols = Math.ceil((box[2] - box[0]) / CELL) + 1, rows = Math.ceil((box[3] - box[1]) / CELL) + 1
  if (cols * rows > 8e6 || !Number.isFinite(wide)) return null
  const grid = new Uint8Array(cols * rows)
  const paint = (set, bit) => {
    for (const tri of set) {
      const lo = [Math.min(...tri.map(p => p[0])), Math.min(...tri.map(p => p[1]))]
      const hi = [Math.max(...tri.map(p => p[0])), Math.max(...tri.map(p => p[1]))]
      const i0 = Math.max(0, Math.floor((lo[0] - box[0]) / CELL)), i1 = Math.min(cols - 1, Math.ceil((hi[0] - box[0]) / CELL))
      const j0 = Math.max(0, Math.floor((lo[1] - box[1]) / CELL)), j1 = Math.min(rows - 1, Math.ceil((hi[1] - box[1]) / CELL))
      const side = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const P = [box[0] + (i + .5) * CELL, box[1] + (j + .5) * CELL]
        const d1 = side(tri[0], tri[1], P), d2 = side(tri[1], tri[2], P), d3 = side(tri[2], tri[0], P)
        if (!((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))) grid[j * cols + i] |= bit
      }
    }
  }
  paint(A, 1); paint(B, 2)
  let both = 0
  for (const cell of grid) if (cell === 3) both++
  return { area: both * CELL * CELL, cell: +CELL.toFixed(3) }
}

const found = []
for (const [, set] of groups) {
  set.sort((a, b) => a.d - b.d)
  let run = []
  const close = () => {
    if (run.length > 1) plane(run)
    run = []
  }
  for (const face of set) {
    if (run.length && face.d - run[0].d > BED) close()
    run.push(face)
  }
  close()
}
function plane(run) {
  const byMesh = new Map()
  for (const face of run) {
    if (!byMesh.has(face.mesh)) byMesh.set(face.mesh, [])
    byMesh.get(face.mesh).push(face)
  }
  const meshes = [...byMesh.keys()]
  for (let i = 0; i < meshes.length; i++) for (let j = i + 1; j < meshes.length; j++) {
    const a = byMesh.get(meshes[i]), b = byMesh.get(meshes[j])
    const overlap = shared(a, b, run[0].n)
    if (overlap === null || overlap.area < AREA_MIN) continue
    const all = [...a, ...b].flatMap(f => f.v)
    const span = pick => [+Math.min(...all.map(pick)).toFixed(2), +Math.max(...all.map(pick)).toFixed(2)]
    found.push({ a: meshes[i], b: meshes[j], area: +overlap.area.toFixed(3), cell: overlap.cell,
      n: [run[0].n.x, run[0].n.y, run[0].n.z].map(c => +c.toFixed(3)),
      d: +run[0].d.toFixed(3), spread: +(run[run.length - 1].d - run[0].d).toFixed(4),
      east: span(q => q.x), height: span(q => q.y), north: span(q => -q.z) })
  }
}

/** PAIRS THAT ARE MEANT. Each one is a plane two bodies share on purpose, with
 * the reason it cannot break up: a face the other body's own solid covers, or
 * a surface no certified pose can see. Anything not on this list is a defect. */
const ALLOWED = [
  // THE PAVILION AND ITS ROOMS. Envelope, slab, partitions and the linings
  // built into them were drawn to the same faces long before this checker
  // existed. Every plane named here is indoors, under a floor, behind a
  // lining or above a ceiling. A rule names its planes: two bodies meant to
  // meet on one line are not licensed to meet on a new one.
  { a: 'vinci/collection/architecture', b: 'vinci/collection/cast-concrete', n: [0, 1, 0], d: [-6.4],
    why: 'the interior floor laid on the pavilion slab it is cast over, both under that floor' },
  { a: 'vinci/collection/architecture', b: 'vinci/collection/cast-concrete', n: [0, 0, 1], d: [34, 64],
    why: 'the apron bed on the base north and south faces, under the paving' },
  { a: 'vinci/collection/architecture', b: 'vinci/collection/cast-concrete', n: [1, 0, 0], d: [-62, -22],
    why: 'the base and the cladding on the east and west elevations' },
  { a: 'vinci/collection/architecture', b: 'vinci/collection/cast-concrete', n: [0, 1, 0.01], d: [-1.292],
    why: 'the entrance canopy soffit on its own slab' },
  { a: 'vinci/collection-rooms/construction', b: 'vinci/collection/architecture', n: [0, 0, 1],
    d: [31, 34, 34.07, 41.8, 42.04, 44.2, 62.2, 62.81, 64],
    why: 'the room linings, reveals and bands on the envelope east-west faces they dress' },
  { a: 'vinci/collection-rooms/construction', b: 'vinci/collection/architecture', n: [1, 0, 0],
    d: [-60.24, -39.02, -38.78, -24.1, -22.8, -22.07],
    why: 'the same linings and door reveals on the envelope north-south faces' },
  { a: 'vinci/collection-rooms/construction', b: 'vinci/collection/architecture', n: [0, 1, 0], d: [-6.44, -1.88],
    why: 'the apron and court paving at one level, and the ceiling slab at the envelope soffit' },
  { a: 'vinci/collection-rooms/construction', b: 'vinci/collection/cast-concrete', n: [1, 0, 0], d: [-61.66],
    why: 'the west wall lining on the cast concrete wall behind it' },
  { a: 'vinci/collection-rooms/construction', b: 'vinci/collection/cast-concrete', n: [0, 0, 1], d: [63.66],
    why: 'the south wall lining on the same' },
  { a: 'vinci/collection/glazing', b: 'vinci/collection-rooms/construction', n: [1, 0, 0], d: [-22.04],
    why: 'the gallery sill reveal at the glazing plane, the glass standing in front of it' },
  // THE COURT. Two lines the fix leaves standing, both behind the gallery's
  // own wall or under the terrace band, and both an ask in the status.
  { a: 'vinci/collection/architecture', b: 'vinci-grave-made-surface', n: [0, 0, 1], d: [31],
    why: 'the apron north edge and the exhibition floor south edge, under the terrace band' },
  { a: 'vinci/collection-rooms/construction', b: 'vinci-grave-made-surface', n: [0, 0, 1], d: [15.85, 31],
    why: 'the parapet end on the gallery outer face, behind that six metre wall from every court pose' },
  // THE MANOR AND ITS TWO PASSAGES. None of it this window's construction and
  // none of it reported by a walk; listed by class so the court cannot hide
  // behind them, and named in the status as asks.
  { a: 'wing-vinci/entry-passage/oak', b: 'wing-vinci/entry-passage/plaster', n: [0.55, 0, 0.84],
    why: 'the passage ceiling battens on the plaster they are fixed to' },
  { a: 'wing-vinci/entry-passage/oak', b: 'wing-vinci/entry-passage/plaster', n: [0, 1, 0],
    why: 'the same battens at the ceiling level' },
  { a: 'vinci/shell/dark', b: 'wing-vinci/entry-passage/plaster', n: [0.56, 0, 0.83],
    why: 'the passage lining on the manor wall it lines' },
  { a: 'vinci/shell/dark', b: 'wing-vinci/entry-passage/terracotta', n: [0.56, 0, 0.83],
    why: 'the passage floor at the same wall' },
  { a: 'vinci/shell/stone', b: 'wing-vinci/gate-passage/masonry lining', n: [0.56, 0, 0.83],
    why: 'the gate passage lining on the manor wall' },
  { a: 'vinci/shell/stone', b: 'wing-vinci/gate-passage/masonry lining', n: [0, 1, 0],
    why: 'the gate lintel and the passage ceiling, bedded by the 09-18 window' },
  { a: 'vinci/shell/stone', b: 'wing-vinci/gate-passage/masonry lining', n: [0.83, 0, 0.56],
    why: 'the same lining on the passage reveals' },
  { a: 'vinci/shell/glass', b: 'vinci/shell/oak', n: [0.55, 0, 0.84], why: 'a window pane in its own oak frame' },
  { a: 'vinci/shell/glass', b: 'vinci/shell/oak', n: [0.84, 0, 0.55], why: 'the same on the return elevations' },
  { a: 'vinci/shell/oak', b: 'vinci/shell/stone', n: [0.55, 0, 0.84], why: 'oak frames set into the stone openings they fill' },
  { a: 'vinci/shell/oak', b: 'vinci/shell/stone', n: [0.84, 0, 0.55], why: 'the same on the return elevations' },
  { a: 'vinci/shell/oak', b: 'vinci/shell/stone', n: [0.83, 0, 0.56], why: 'the same at the gate front' },
  { a: 'vinci/shell/oak', b: 'vinci/shell/stone', n: [0.21, 0, 0.98], why: 'the same on the dormer cheeks' },
  { a: 'vinci/shell/oak', b: 'vinci/shell/stone', n: [0.98, 0, 0.21], why: 'the same on the dormer cheeks' },
  { a: 'vinci/shell/brick', b: 'vinci/shell/slate', n: [0.84, 0, 0.55], why: 'roof slate laid over the brick gable it covers' },
  { a: 'vinci/shell/brick', b: 'vinci/shell/oak', n: [0.84, 0, 0.55], why: 'a frame built into the brick around it' },
  { a: 'vinci/shell/lead', b: 'vinci/shell/stone', n: [0.55, 0, 0.84], why: 'lead flashing dressed onto the stone it weathers' },
]
/** A rule that names planes allows THOSE planes and no others: a pair of
 * bodies that are meant to meet on one line is not licence to meet on a new
 * one, which is how the court's three defects hid behind the pavilion's. */
const allowed = pair => ALLOWED.find(rule => ((rule.a === pair.a && rule.b === pair.b) || (rule.a === pair.b && rule.b === pair.a))
  && rule.n.every((c, i) => Math.abs(c - Math.abs(pair.n[i])) < .02 || Math.abs(c - pair.n[i]) < .02)
  && (!rule.d || rule.d.some(value => Math.abs(value - pair.d) < .005)))

found.sort((x, y) => y.area - x.area)
const offences = found.filter(pair => !allowed(pair))
const report = {
  checker: 'vinci-coplanar', bodies: bodies.map(b => b.name), faces: faces.length,
  bed: BED, areaFloor: AREA_MIN, pairs: found.length, allowed: found.length - offences.length,
  offences: (ALL ? found : offences).map(pair => ({ ...pair, meant: Boolean(allowed(pair)) })),
}
console.log(JSON.stringify(report, null, 1))
assert.equal(offences.length, 0,
  `${offences.length} pair(s) of faces share a plane: ${offences.slice(0, 4).map(p => `${p.a} + ${p.b} ${p.area} m2 at ${p.at}`).join(' | ')}`)
