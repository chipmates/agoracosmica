#!/usr/bin/env node
/** Offline checks of the real contact source and physical swept frame batch.
 * Run: node src/wings/vinci/pictures/bench/contact-check.mjs
 * No browser, GPU, network, generated binary, or runtime dependency.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import vm from 'node:vm'
import ts from 'typescript'
import * as Three from 'three/webgpu'
import * as TSL from 'three/tsl'

function load(relative, extra = '') {
  const source = readFileSync(new URL(relative, import.meta.url), 'utf8')
  const code = ts.transpileModule(source + extra, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
  } }).outputText
  const exports = {}
  // Use the normal JS realm for meaningful hot-loop timing; sandbox global
  // proxies otherwise dominate millions of Math property reads.
  vm.runInThisContext(`(function(exports, require) { ${code}\n })`, { filename: relative })(exports,
    id => {
      if (id === 'three/webgpu') return Three
      if (id === 'three/tsl') return TSL
      // The frame is lit by the room's opening; the check loads the real one.
      if (id === './aperture') return load('../aperture.ts')
      throw Error(`Unexpected test import ${id}`)
    })
  return { ...exports, sha256: createHash('sha256').update(source).digest('hex') }
}
const contact = load('../contact.ts', '\nexport const __check = { triangle, tree, directions, blocked, intersectsTriangle };')
const { buildFrameBatch } = load('../frame.ts')
const { triangle, tree, directions, blocked } = contact.__check
const R = contact.CONTACT_BAKE_RECIPE
const results = []
function test(name, run) { run(); results.push({ name, pass: true }) }
const stats = () => ({ boundsTests: 0, triangleTests: 0 })
const point = (...xyz) => new Three.Vector3(...xyz)
const inverses = d => d.map(v => 1 / v)
const rays = directions()
const tri = (...v) => triangle(...v.map(p => point(...p)))
const blocker = z => tri([-2, -2, z], [2, -2, z], [0, 2, z])

test('Cosine hemisphere is deterministic, unit length and oriented toward +Z', () => {
  assert.equal(rays.length, 64)
  assert.deepEqual(rays, directions())
  for (const d of rays) { assert.ok(d[2] > 0); assert.ok(Math.abs(Math.hypot(...d) - 1) < 1e-12) }
  assert.ok(Math.abs(rays.reduce((n, d) => n + d[2] ** 2, 0) / rays.length - .5) < 1e-12)
})

test('Analytic disk solid angle gives cosine visibility, without double weighting', () => {
  const h = .05, radius = .15, triangles = []
  for (let i = 0; i < 256; i++) {
    const a = 2 * Math.PI * i / 256, b = 2 * Math.PI * (i + 1) / 256
    triangles.push(tri([0, 0, h], [radius * Math.cos(a), radius * Math.sin(a), h], [radius * Math.cos(b), radius * Math.sin(b), h]))
  }
  const root = tree(triangles)
  const actual = rays.filter(d => blocked(root, 0, 0, d, inverses(d), stats())).length / rays.length
  const expected = radius ** 2 / (radius ** 2 + (h - R.wallRayOriginM) ** 2)
  assert.ok(Math.abs(actual - expected) < 2 / rays.length, `${actual} versus ${expected}`)
})

test('Actual ray cutoff, reverse winding and behind-wall rejection', () => {
  const d = [0, 0, 1], inverse = [Infinity, Infinity, 1]
  for (const z of [.1, -.1, .3]) {
    const t = blocker(z)
    assert.equal(blocked(tree([t]), 0, 0, d, inverse, stats()), z === .1)
  }
  const t = blocker(.1)
  const reversed = { ...t, e1: t.e2, e2: t.e1 }
  assert.equal(blocked(tree([reversed]), 0, 0, d, inverse, stats()), true)
})

test('BVH agrees with independent Three.Ray intersections over all test samples', () => {
  const triangles = [blocker(.1), tri([.2, -.2, .03], [.2, .2, .03], [.2, 0, .23]),
    tri([-.2, -.2, .09], [-.2, 0, .23], [-.2, .2, .09])]
  const root = tree([...triangles])
  const target = new Three.Vector3()
  for (const x of [-.4, -.2, 0, .2, .4]) for (const y of [-.3, 0, .3]) for (const d of rays) {
    const origin = point(x, y, R.wallRayOriginM)
    const ray = new Three.Ray(origin, point(...d))
    const expected = triangles.some(t => {
      const a = point(...t.a), b = a.clone().add(point(...t.e1)), c = a.clone().add(point(...t.e2))
      const hit = ray.intersectTriangle(a, b, c, false, target)
      return hit && origin.distanceTo(hit) > 1e-6 && origin.distanceTo(hit) <= R.rayMaxM
    })
    assert.equal(blocked(root, x, y, d, inverses(d), stats()), Boolean(expected), `x=${x} y=${y} d=${d}`)
  }
})

const mockStack = { materials: { sync() { return { material() {
  const m = new Three.MeshStandardNodeMaterial()
  m.colorNode = TSL.vec3(1); m.roughnessNode = TSL.float(.5)
  return m
} } } }, detail() {} }
const one = [{ id: 'test', x: .5, y: 1.55, width: .534, height: .794 }]
let frame, baked
test('Physical swept frame casts measured visibility; empty input produces no border', () => {
  const empty = contact.buildBakedFrameContact(new Three.Group(), one)
  assert.equal(empty.stats.rays, 0); assert.equal(empty.group.children.length, 0); empty.dispose()
  frame = buildFrameBatch(mockStack, one)
  baked = contact.buildBakedFrameContact(frame.group, one)
  assert.equal(baked.stats.sourceTriangles, 200)
  assert.ok(baked.stats.peakOcclusion > .1 && baked.stats.peakOcclusion < 1)
  assert.ok(baked.stats.blockedRays > 0)
  assert.equal(baked.group.children.length, 1)
  const mesh = baked.group.children[0], position = mesh.geometry.getAttribute('position')
  const colour = mesh.geometry.getAttribute('color'), index = mesh.geometry.index
  assert.equal(colour.itemSize, 4)
  assert.ok(mesh.material.transparent && mesh.material.vertexColors && !mesh.material.depthWrite)
  for (let i = 0; i < colour.count; i++) {
    assert.ok(Number.isFinite(colour.getW(i)) && colour.getW(i) >= 0 && colour.getW(i) <= 1)
    assert.ok(Math.abs(position.getZ(i) - R.receiverOffsetM) < 1e-9)
  }
  for (let i = 0; i < index.count; i += 3) {
    const a = new Three.Vector3().fromBufferAttribute(position, index.getX(i))
    const b = new Three.Vector3().fromBufferAttribute(position, index.getX(i + 1))
    const c = new Three.Vector3().fromBufferAttribute(position, index.getX(i + 2))
    const centre = a.clone().add(b).add(c).divideScalar(3)
    assert.ok(Math.abs(centre.x - one[0].x) >= one[0].width / 2 - 1e-7 || Math.abs(centre.y - one[0].y) >= one[0].height / 2 - 1e-7)
    assert.ok(b.sub(a).cross(c.sub(a)).z > 0)
  }
})

test('Selection reuses bake, disposes replaced geometry and preserves caller ownership', () => {
  const initialRays = baked.stats.rays
  let oldDisposed = 0, sourceDisposed = 0, materialDisposed = 0
  const original = baked.group.children[0].geometry
  original.addEventListener('dispose', () => oldDisposed++)
  baked.group.children[0].material.addEventListener('dispose', () => materialDisposed++)
  frame.group.traverse(o => { if (o instanceof Three.Mesh) o.geometry.addEventListener('dispose', () => sourceDisposed++) })
  baked.setVisible(['test', 'test'])
  assert.equal(baked.group.children[0].geometry, original)
  baked.setVisible([])
  assert.equal(oldDisposed, 1); assert.equal(baked.group.children.length, 0)
  baked.setVisible()
  assert.equal(baked.group.children.length, 1); assert.equal(baked.stats.rays, initialRays)
  baked.dispose(); baked.dispose(); baked.setVisible()
  assert.equal(materialDisposed, 1); assert.equal(sourceDisposed, 0); assert.equal(baked.stats.cpuBytes, 0)
  frame.dispose()
})

test('Source geometry movement beyond ray reach removes contact', () => {
  const moved = buildFrameBatch(mockStack, one)
  for (const child of moved.group.children) child.position.z = .3
  const result = contact.buildBakedFrameContact(moved.group, one)
  assert.equal(result.stats.blockedRays, 0); assert.equal(result.group.children.length, 0)
  result.dispose(); moved.dispose()
})

test('World parent transforms cancel; moving source and aperture together preserves visibility', () => {
  const a = buildFrameBatch(mockStack, one)
  const translated = one.map(f => ({ ...f, x: f.x + 5 }))
  const b = buildFrameBatch(mockStack, translated)
  const parent = new Three.Group()
  parent.position.set(2, -1, 3); parent.rotation.set(.2, .3, -.4)
  parent.add(b.group)
  const first = contact.buildBakedFrameContact(a.group, one)
  const second = contact.buildBakedFrameContact(b.group, translated)
  const p = first.group.children[0].geometry.getAttribute('position')
  const q = second.group.children[0].geometry.getAttribute('position')
  const c = first.group.children[0].geometry.getAttribute('color')
  const d = second.group.children[0].geometry.getAttribute('color')
  assert.equal(p.count, q.count)
  let difference = 0
  for (let i = 0; i < p.count; i++) {
    assert.ok(Math.abs(q.getX(i) - p.getX(i) - 5) < 1e-6)
    assert.ok(Math.abs(q.getY(i) - p.getY(i)) < 1e-6)
    difference += Math.abs(c.getW(i) - d.getW(i))
  }
  assert.ok(difference / p.count < .001)
  first.dispose(); second.dispose(); a.dispose(); b.dispose()
})

test('Adjacent receiver patches partition overlap; selection never repeats ray work', () => {
  const placements = [...one, { ...one[0], id: 'second', x: one[0].x + one[0].width + .56 }]
  const source = buildFrameBatch(mockStack, placements)
  const result = contact.buildBakedFrameContact(source.group, placements)
  const initialRays = result.stats.rays
  const position = result.group.children[0].geometry.getAttribute('position')
  const ranges = result.group.userData.receiverRanges
  const rangeBounds = r => {
    const box = new Three.Box3()
    for (let i = r.firstVertex; i < r.firstVertex + r.vertexCount; i++) box.expandByPoint(new Three.Vector3().fromBufferAttribute(position, i))
    return box
  }
  const left = rangeBounds(ranges[0]), right = rangeBounds(ranges[1])
  assert.ok(left.max.x <= right.min.x + 1e-7, `${left.max.x} overlaps ${right.min.x}`)
  result.setVisible(['test'])
  const solo = result.group.children[0].geometry
  assert.ok(solo.boundingBox.max.x > left.max.x, 'Solo receiver regains its uncut ray support')
  const isolatedSource = buildFrameBatch(mockStack, one)
  const isolated = contact.buildBakedFrameContact(isolatedSource.group, one)
  assert.deepEqual(Array.from(solo.getAttribute('color').array), Array.from(isolated.group.children[0].geometry.getAttribute('color').array))
  isolated.dispose(); isolatedSource.dispose()
  result.setVisible(['second'])
  assert.equal(result.stats.rays, initialRays)
  result.dispose(); source.dispose()
})

test('Other subsets bake active occluders and keep only one additional subset cache', () => {
  const placements = [0, 1, 2].map(i => ({ id: `subset-${i}`, x: i * .96, y: 1.55, width: .4, height: .4 }))
  const source = buildFrameBatch(mockStack, placements)
  const result = contact.buildBakedFrameContact(source.group, placements)
  const initialBytes = result.stats.cpuBytes, initialRays = result.stats.rays
  result.setVisible(['subset-0', 'subset-1'])
  const firstRays = result.stats.rays
  assert.ok(firstRays > initialRays)
  result.setVisible(['subset-1', 'subset-0', 'subset-1'])
  assert.equal(result.stats.rays, firstRays)
  result.setVisible(['subset-1', 'subset-2'])
  result.setVisible(['subset-0', 'subset-2'])
  assert.ok(result.stats.cpuBytes < initialBytes * 1.4, `${result.stats.cpuBytes} against initial ${initialBytes}`)
  const before = result.stats.rays
  result.setVisible(['subset-0', 'subset-1'])
  assert.ok(result.stats.rays > before, 'Evicted partial subset is regenerated')
  const after = result.stats.rays
  result.setVisible(); result.setVisible(['subset-1'])
  assert.equal(result.stats.rays, after, 'Full and solo bakes remain resident')
  result.dispose(); source.dispose()
})

let benchmark
test('Six substantial frames bake below ten seconds and one draw within calm triangles', () => {
  const frames = []; let x = 0
  const sizes = [[1.2, 2], [.39, .54], [.55, .62], [.3, .44], [1.3, 2], [2.4, 2.4]]
  for (const [i, [width, height]] of sizes.entries()) {
    frames.push({ id: `bench-${i}`, x: x + width / 2, y: 1.55, width, height }); x += width + .56
  }
  const source = buildFrameBatch(mockStack, frames)
  const result = contact.buildBakedFrameContact(source.group, frames)
  benchmark = { ...result.stats }
  assert.equal(result.group.children.length, 1)
  assert.equal(result.stats.sourceTriangles, 1200)
  assert.ok(result.stats.bakeMs < 10000, `${result.stats.bakeMs} ms`)
  assert.ok(result.stats.visibleTriangles < 150000, `${result.stats.visibleTriangles} triangles`)
  result.dispose(); source.dispose()
})

console.log(JSON.stringify({ sourceSha256: contact.sha256, recipe: R, passed: results.length, results, benchmark }, null, 2))
