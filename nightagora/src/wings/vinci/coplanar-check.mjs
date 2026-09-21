#!/usr/bin/env node
/** TWO FACES IN ONE PLANE, FOUND OFFLINE. A depth test between two faces that
 * share a plane is decided by the last bit of the interpolated depth, so the
 * winner changes with the eye and the surface breaks up as a visitor walks.
 * The owner's walk found three of these the hard way. This finds them without
 * a renderer: every pair of faces within 2 mm of one plane whose plan areas
 * overlap by more than a stated area, over the wing's BUILT geometry.
 *
 *   node src/wings/vinci/coplanar-check.mjs [--all] [--area 0.01] [--self]
 *
 * TWO PASSES, BOTH IN THE DEFAULT RUN. The first groups a plane's faces by
 * the mesh NAME and finds two bodies sharing a plane. The second groups by
 * the mesh ITSELF and finds a body fighting itself: a module that welds one
 * batch per material gives every batch the same name, so a pale run ending
 * on a dark run's end plane inside one body is invisible to the first. Each
 * pass carries its own allow list, and each rule names its planes and its
 * reason. `--self` runs the second alone.
 *
 * What it does not cover, and says so rather than implying otherwise: the sown
 * bodies (vegetation, ground dressing, terrain grass) are cards on a slope,
 * not architecture, and are left out; no renderer, no light, no draw order and
 * no claim about which face wins, only that the question is open.
 */
import assert from 'node:assert/strict'
import * as THREE from 'three/webgpu'
import { buildBodies, facesOf } from './build-in-node.mjs'

const args = process.argv.slice(2)
const ALL = args.includes('--all')
/** the self pass alone, for a focused reading of one body */
const SELF = args.includes('--self')
const AREA_MIN = Number(args[args.indexOf('--area') + 1]) || 0.01
/* AND NEARLY ONE PLANE IS THE SAME DEFECT AT A DISTANCE. Two faces two
   millimetres apart share a plane here; two faces twenty millimetres apart
   share one on the SCREEN as soon as the depth buffer cannot separate them,
   which is what a comb of stripes along a junction is. `--near <mm>` widens
   the bed to the depth resolution the eye actually has at that range, and the
   measured gap is reported with every pair, so a reading is never confused
   with the exactly shared case. */
const NEAR_MM = Number(args[args.indexOf('--near') + 1]) || 0
const BED = NEAR_MM > 0 ? NEAR_MM / 1000 : 0.002

const bodies = buildBodies()
const faces = facesOf(bodies, { self: SELF })

/* WHAT STANDS HERE. A defect is reported as a place before it is reported as
   a pair, and a place is six numbers. `--at x0,y0,z0,x1,y1,z1` names every
   mesh with a face inside that box, with its plane and its own extent, which
   is how a sighting in a frame becomes a body in a file. */
const AT = (args[args.indexOf('--at') + 1] ?? '').split(',').map(Number).filter(Number.isFinite)
if (AT.length === 6) {
  const box = { x: [Math.min(AT[0], AT[3]), Math.max(AT[0], AT[3])], y: [Math.min(AT[1], AT[4]), Math.max(AT[1], AT[4])], z: [Math.min(AT[2], AT[5]), Math.max(AT[2], AT[5])] }
  const inside = v => v.x >= box.x[0] && v.x <= box.x[1] && v.y >= box.y[0] && v.y <= box.y[1] && v.z >= box.z[0] && v.z <= box.z[1]
  const here = new Map()
  for (const face of faces) {
    if (!face.v.some(inside)) continue
    const key = `${face.body} | ${face.mesh} | n=${[face.n.x, face.n.y, face.n.z].map(c => c.toFixed(2)).join(',')} | d=${face.d.toFixed(4)}`
    const seen = here.get(key) ?? { faces: 0, area: 0, x: [Infinity, -Infinity], y: [Infinity, -Infinity], z: [Infinity, -Infinity] }
    seen.faces++; seen.area += face.area
    for (const v of face.v) {
      seen.x = [Math.min(seen.x[0], v.x), Math.max(seen.x[1], v.x)]
      seen.y = [Math.min(seen.y[0], v.y), Math.max(seen.y[1], v.y)]
      seen.z = [Math.min(seen.z[0], v.z), Math.max(seen.z[1], v.z)]
    }
    here.set(key, seen)
  }
  const rows = [...here].sort((a, b) => b[1].area - a[1].area).map(([key, s]) => ({
    what: key, faces: s.faces, area: +s.area.toFixed(4),
    east: s.x.map(v => +v.toFixed(4)), height: s.y.map(v => +v.toFixed(4)), north: s.z.map(v => +(-v).toFixed(4)),
  }))
  process.stdout.write(JSON.stringify({ checker: 'vinci-coplanar', at: AT, planes: rows.length, rows }, null, 1) + '\n')
  process.exit(0)
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

/* ---- buckets: one normal to a degree, then offsets clustered at 2 mm ---- */
function scan(faces) {
  const groups = new Map()
  const found = []
  for (const face of faces) {
    const key = [face.n.x, face.n.y, face.n.z].map(c => (Math.round(c * 100) / 100).toFixed(2)).join(',')
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(face)
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
  return found
}

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

/** PAIRS A BODY IS MEANT TO SHARE A PLANE WITH ITSELF. A run that ends inside
 * another run of the same batch, a face a solid of the same body covers, or a
 * plane no certified pose can see. Same shape as the list above and the same
 * law: a rule names its planes, never a body. */
const ALLOWED_SELF = [
  { a: 'vinci-grave-made-surface', b: 'vinci-grave-made-surface', n: [0, 1, 0],
    why: 'the exhibition floor slabs on their own bed, half a millimetre apart, which the buffer resolves thirty times over at that range' },
  { a: 'vinci-grave-made-surface', b: 'vinci-grave-made-surface', n: [1, 0, 0], d: [-61.15],
    why: 'the gallery back wall end, buried inside the backdrop own 0.30 m thickness (it spans -61.31 to -61.01) and reachable by no certified eye' },
  { a: 'vinci-grave-made-surface', b: 'vinci-grave-made-surface', n: [1, 0, 0], d: [-56.769, -56.745, -54.06],
    why: 'three run ends inside the grave own furniture, each under a quarter of a square metre and standing behind the piece it belongs to' },
  { a: 'vinci-grave-made-surface', b: 'vinci-grave-made-surface', n: [0.426, 0.905, 0], d: [19.389],
    why: 'the sloped face of the same furniture, two millimetres of spread over 0.09 m2' },
]

/** A rule that names planes allows THOSE planes and no others: a pair of
 * bodies that are meant to meet on one line is not licence to meet on a new
 * one, which is how the court\'s three defects hid behind the pavilion\'s.
 * A mesh carries its own object number in the self pass; a rule names the
 * body, never the number, because a number moves when anything upstream is
 * built one step earlier. */
const bare = name => String(name).replace(/#\d+$/, '')
const allowedIn = (list, pair) => list.find(rule =>
  ((rule.a === bare(pair.a) && rule.b === bare(pair.b)) || (rule.a === bare(pair.b) && rule.b === bare(pair.a)))
  && rule.n.every((c, i) => Math.abs(c - Math.abs(pair.n[i])) < .02 || Math.abs(c - pair.n[i]) < .02)
  && (!rule.d || rule.d.some(value => Math.abs(value - pair.d) < .005)))

const byName = SELF ? [] : scan(faces)
/* THE SELF PASS IS ITS OWN CLASS. Every pair of two DIFFERENT bodies is in
   the first pass already, so the second keeps only what the first cannot
   see: one body against itself. */
const bySelf = (SELF ? scan(faces) : scan(facesOf(bodies, { self: true })))
  .filter(pair => bare(pair.a) === bare(pair.b))

byName.sort((x, y) => y.area - x.area)
bySelf.sort((x, y) => y.area - x.area)
const nameOffences = byName.filter(pair => !allowedIn(ALLOWED, pair))
const selfOffences = bySelf.filter(pair => !allowedIn(ALLOWED_SELF, pair))
const offences = [...nameOffences, ...selfOffences]
const report = {
  checker: 'vinci-coplanar', bodies: bodies.map(b => b.name), faces: faces.length,
  bed: BED, areaFloor: AREA_MIN,
  pairs: byName.length, allowed: byName.length - nameOffences.length,
  selfPairs: bySelf.length, selfAllowed: bySelf.length - selfOffences.length,
  offences: (ALL ? byName : nameOffences).map(pair => ({ ...pair, meant: Boolean(allowedIn(ALLOWED, pair)) })),
  selfOffences: (ALL ? bySelf : selfOffences).map(pair => ({ ...pair, meant: Boolean(allowedIn(ALLOWED_SELF, pair)) })),
}
console.log(JSON.stringify(report, null, 1))
assert.equal(offences.length, 0,
  `${offences.length} pair(s) of faces share a plane: ${offences.slice(0, 4).map(p => `${p.a} + ${p.b} ${p.area} m2`).join(' | ')}`)
