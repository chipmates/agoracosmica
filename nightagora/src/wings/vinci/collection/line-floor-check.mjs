#!/usr/bin/env node
/** Prove the actual mounted date floors without a renderer or a browser.
 *   node src/wings/vinci/collection/line-floor-check.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import * as THREE from 'three/webgpu'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const modules = new Map()
async function load(file) {
  const resolved = fs.realpathSync(file)
  if (modules.has(resolved)) return modules.get(resolved)
  if (resolved.endsWith('.json')) return { default: JSON.parse(fs.readFileSync(resolved, 'utf8')) }
  const exports = {}
  modules.set(resolved, exports)
  const code = ts.transpileModule(fs.readFileSync(resolved, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const dependencies = new Map()
  for (const [, name] of code.matchAll(/\brequire\(["']([^"']+)["']\)/g)) {
    if (dependencies.has(name)) continue
    if (name.startsWith('.')) {
      const target = path.resolve(path.dirname(resolved), name)
      const source = [target, target + '.ts', path.join(target, 'index.ts')].find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile())
      if (!source) throw new Error('Unresolved floor dependency: ' + name)
      dependencies.set(name, await load(source))
    } else if (name.startsWith('three')) dependencies.set(name, await import(name))
    else throw new Error('Unexpected floor dependency: ' + name)
  }
  new vm.Script(code, { filename: path.relative(HERE, resolved) }).runInNewContext({
    exports, require: name => dependencies.get(name), console, Float32Array,
    location: { search: '' }, URLSearchParams, performance,
  }, { timeout: 20000 })
  return exports
}
const { createCollectionLineFloor, collectionLineStuds } = await load(path.join(HERE, 'line-floor.ts'))
const { FLOOR, LINE_ORIGIN, LINE_FIELD, FACE, ROOMS } = await load(path.join(HERE, 'layout.ts'))
const { STUDS } = await load(path.join(HERE, '../line/index.ts'))
const failures = [], reports = []
const expect = (condition, detail) => { if (!condition) failures.push(detail) }
const expectedIds = ['life-01', 'life-02', 'life-04', 'life-03', 'life-29', 'life-30', 'life-31', 'life-32', 'life-39', 'life-40', 'life-41', 'life-42']
expect(collectionLineStuds.length === 12, 'The gallery must carry twelve distinct date sockets')
expect(new Set(collectionLineStuds.map(stud => stud.id)).size === 12, 'A date socket is duplicated')
expect(JSON.stringify(collectionLineStuds.map(stud => stud.id)) === JSON.stringify(expectedIds), 'The locked early, late and Amboise dates changed')
for (const [i, stud] of collectionLineStuds.entries()) {
  const record = STUDS.find(entry => entry.id === stud.id)
  expect(record && record.date === stud.date && record.certainty === stud.certainty && record.station === stud.station, 'Source record changed for ' + stud.id)
  expect(stud.north - .82 > FACE.southStripNorth + .04 && stud.north + .82 < ROOMS.gallery.north, 'Socket crosses a gallery wall: ' + stud.id)
  if (i) expect(Math.abs(collectionLineStuds[i - 1].north - stud.north - 1.65) < 1e-9, 'The date grid has a gap or overlap before ' + stud.id)
}
for (const language of ['en', 'de']) {
  const materials = Object.fromEntries(['stone', 'bronze', 'ink', 'dark'].map(name => {
    const material = new THREE.MeshStandardNodeMaterial(); material.name = name
    return [name, material]
  }))
  const floor = createCollectionLineFloor(materials, language)
  floor.position.set(LINE_ORIGIN.east, FLOOR + .01, -LINE_ORIGIN.north)
  floor.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(floor)
  let triangles = 0, vertices = 0
  const ray = new THREE.Raycaster(), point = new THREE.Vector3()
  const sockets = [], yearFaces = collectionLineStuds.map(() => 0)
  floor.traverse(mesh => {
    if (!(mesh instanceof THREE.Mesh)) return
    const positions = mesh.geometry.getAttribute('position')
    const normals = mesh.geometry.getAttribute('normal')
    const uvs = mesh.geometry.getAttribute('uv')
    triangles += (mesh.geometry.index?.count ?? positions.count) / 3
    vertices += positions.count
    if (mesh.material === materials.bronze) {
      for (let i = 0; i < positions.count; i += 3) {
        const corners = [i, i + 1, i + 2]
        if (!corners.every(corner => positions.getX(corner) <= -.305 && positions.getY(corner) > 0 && normals.getY(corner) > .9)) continue
        for (const [row, stud] of collectionLineStuds.entries()) {
          const centreZ = LINE_ORIGIN.north - stud.north
          if (corners.every(corner => positions.getZ(corner) >= centreZ - .75 && positions.getZ(corner) <= centreZ + .05)) yearFaces[row]++
        }
      }
    }
    expect(mesh.userData.manifestId === 'vinci/collection-line-floor', 'A floor mesh lost its host provenance')
    expect(mesh.userData.sourceManifestIds?.includes('vinci/line-geometry'), 'A floor mesh lost its source provenance')
    for (let i = 0; i < positions.count; i++) {
      point.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld)
      if (!point.toArray().every(Number.isFinite) || ![normals.getX(i), normals.getY(i), normals.getZ(i), uvs.getX(i), uvs.getY(i)].every(Number.isFinite)) {
        failures.push(language + ': a geometry attribute is not finite'); break
      }
    }
  })
  expect(box.max.y <= FLOOR + .031, language + ': the line still contains a wall, threshold or rail')
  expect(box.min.y >= FLOOR - .213, language + ': floor geometry extends below its native bed')
  expect(box.min.x >= LINE_FIELD.west - .00001 && box.max.x <= LINE_FIELD.east + .00001, language + ': floor exceeds the cut paving field')
  expect(-box.max.z >= ROOMS.gallery.south - .00001 && -box.min.z <= Math.min(ROOMS.gallery.north, LINE_FIELD.north) + .003, language + ': floor leaves the gallery')
  for (const [row, stud] of collectionLineStuds.entries()) {
    expect(yearFaces[row] > 12, language + ': the upward bronze numeral faces are absent at ' + stud.id)
    ray.set(new THREE.Vector3(stud.east, FLOOR + .2, -stud.north), new THREE.Vector3(0, -1, 0))
    const centre = ray.intersectObject(floor, true)[0]
    expect(centre && centre.object.material.name === stud.certainty, language + ': actual certainty disc absent or covered at ' + stud.id)
    // A ray just beside the socket sees one stone surface. A second surface
    // proves that old central paving was left under the new socket slab.
    ray.set(new THREE.Vector3(stud.east + .55, FLOOR + .2, -stud.north + .3), new THREE.Vector3(0, -1, 0))
    const surfaces = ray.intersectObject(floor, true).filter(hit => hit.object.material === materials.stone && hit.face.normal.y > .9)
    const levels = [...new Set(surfaces.map(hit => hit.point.y.toFixed(5)))]
    expect(levels.length === 1 && surfaces.length === 1, language + ': duplicate or absent stone paving at ' + stud.id)
    sockets.push({ id: stud.id, date: stud.date, east: stud.east, north: +stud.north.toFixed(4), certainty: centre?.object.material.name, stoneSurfaces: levels.length, yearFaces: yearFaces[row] })
  }
  reports.push({ language, meshes: floor.children.length, triangles, vertices, bounds: { min: box.min.toArray(), max: box.max.toArray() }, sockets })
  const disposed = new Set()
  floor.traverse(mesh => {
    if (!(mesh instanceof THREE.Mesh)) return
    mesh.geometry.dispose()
    if (!disposed.has(mesh.material)) { disposed.add(mesh.material); mesh.material.dispose() }
  })
  for (const material of Object.values(materials)) if (!disposed.has(material)) material.dispose()
}
console.log(JSON.stringify({ checker: 'vinci-collection-line-floor', ok: failures.length === 0, reports, failures }, null, 2))
process.exitCode = failures.length ? 1 : 0
