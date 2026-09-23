#!/usr/bin/env node
/** Prove the actual mounted date floors without a renderer or a browser.
 *   node src/wings/vinci/collection/line-floor-check.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import * as THREE from 'three/webgpu'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const modules = new Map()
const benchLocation = { search: '' }
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
      const target = path.resolve(path.dirname(resolved), name.replace(/\?raw$/, ''))
      if (name.endsWith('?raw')) { dependencies.set(name, { default: fs.readFileSync(target, 'utf8') }); continue }
      const source = [target, target + '.ts', path.join(target, 'index.ts')].find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile())
      if (!source) throw new Error('Unresolved floor dependency: ' + name)
      dependencies.set(name, await load(source))
    } else if (name.startsWith('three')) dependencies.set(name, await import(name))
    else throw new Error('Unexpected floor dependency: ' + name)
  }
  new vm.Script(code, { filename: path.relative(HERE, resolved) }).runInNewContext({
    exports, require: name => dependencies.get(name), console, Float32Array,
    location: benchLocation, URLSearchParams, performance,
  }, { timeout: 20000 })
  return exports
}
const { createCollectionLineFloor, collectionLineStuds, COLLECTION_LINE_SECTIONS, fitCollectionExhibitFloor, EXHIBITION_STAGE_LEVELS: FITTER_LEVELS } = await load(path.join(HERE, 'line-floor.ts'))
const { FLOOR, LINE_ORIGIN, LINE_FIELD, FACE, ROOMS, COURT, GRAVE_ORIGIN, COLLECTION_PAVING_ORIGIN } = await load(path.join(HERE, 'layout.ts'))
const { STUDS, createLine } = await load(path.join(HERE, '../line/index.ts'))
const { collectionView } = await load(path.join(HERE, 'views.ts'))
const { fittedRailFov } = await load(path.join(HERE, '../rail-projection.ts'))
const { createCollection } = await load(path.join(HERE, '../collection.ts'))
const { createGrave } = await load(path.join(HERE, '../grave/index.ts'))
const { createMythDeathbed, createMythQuotes } = await load(path.join(HERE, '../myths/index.ts'))
const { EXHIBITION_STAGE_LEVELS } = await load(path.join(HERE, '../myths/construction.ts'))
const failures = [], reports = []
const expect = (condition, detail) => { if (!condition) failures.push(detail) }
// The fitter repeats the builder's stage levels because its own callers take
// only relative imports. Prove the two have not drifted apart.
for (const sheet of ['stone', 'bed']) {
  expect(EXHIBITION_STAGE_LEVELS[sheet].every((level, at) => Math.abs(level - FITTER_LEVELS[sheet][at]) < 1e-9),
    'the fitted floor no longer stands at the built floor levels: ' + sheet)
}
const expectedIds = ['life-01', 'life-02', 'life-04', 'life-03', 'life-29', 'life-30', 'life-31', 'life-32', 'life-39', 'life-40', 'life-41', 'life-42']
expect(collectionLineStuds.length === 12, 'The gallery must carry twelve distinct date sockets')
expect(new Set(collectionLineStuds.map(stud => stud.id)).size === 12, 'A date socket is duplicated')
expect(JSON.stringify(collectionLineStuds.map(stud => stud.id)) === JSON.stringify(expectedIds), 'The locked early, late and Amboise dates changed')
expect(COLLECTION_PAVING_ORIGIN.east === -30.4 && COLLECTION_PAVING_ORIGIN.north === -59, 'The shared room paving grid changed with the gallery date placement')

/** Compare complete numeral triangles with their unchanged bench source.
 * Projection of those same vertices and glyph axes then detects an inverted
 * date or a pose that loses the date or looks only at the floor.
 */
const triangleKey = vertices => vertices.map(vertex => vertex.toArray().map(value => Math.round(value * 100000)).join(',')).sort().join(';')
function readingViews(floor, materials, language) {
  const actualFaces = new Set(), actualTriangles = [], reports = []
  floor.traverse(mesh => {
    if (!(mesh instanceof THREE.Mesh) || mesh.material !== materials.year) return
    const position = mesh.geometry.getAttribute('position'), normal = mesh.geometry.getAttribute('normal')
    for (let i = 0; i < position.count; i += 3) {
      if (![i, i + 1, i + 2].every(corner => normal.getY(corner) > .9)) continue
      const triangle = [i, i + 1, i + 2].map(corner => new THREE.Vector3().fromBufferAttribute(position, corner).applyMatrix4(mesh.matrixWorld))
      actualFaces.add(triangleKey(triangle)); actualTriangles.push(triangle)
    }
  })
  // WHICH DATE EACH NAMED INSPECTION LOOKS AT. The life runs away from the
  // visitor, and the earliest excerpt begins at the station's own feet, so
  // that one is read from its head: its fourth date, not its first.
  const READ_OFFSET = { 'line-early': 3, 'line-late': 0, 'line-amboise': 0 }
  for (const section of COLLECTION_LINE_SECTIONS) {
    const offset = READ_OFFSET[section.station]
    // The factory's own comparison flag preserves its original glyph meshes
    // before welding; the mounted floor above still uses production welding.
    benchLocation.search = '?noweld'
    const source = createLine(materials, section.selected, language, false, section.lettering)
    benchLocation.search = ''
    source.updateMatrixWorld(true)
    const sourceYear = STUDS[section.selected + offset].date.slice(0, 4)
    // The year is cut a fifth of a metre south of its own socket, its word
    // and any event beside it on the same row.
    const socketZ = -offset * 1.65
    let numeral
    source.traverse(mesh => {
      if (mesh instanceof THREE.Mesh && mesh.userData.text === sourceYear && Math.abs(mesh.position.z - socketZ - .23) < .2) numeral = mesh
    })
    expect(numeral, language + ': selected source numeral is absent at ' + section.station)
    if (!numeral) continue
    const mount = new THREE.Matrix4()
    // The excerpt is carried onto its own course as one piece, so the source
    // is mounted by the same one shift the floor gives it.
    mount.setPosition(LINE_ORIGIN.east, FLOOR + .01, -LINE_ORIGIN.north + (2 - section.row) * 1.65)
    const transform = mount.clone().multiply(numeral.matrixWorld)
    const position = numeral.geometry.getAttribute('position'), normal = numeral.geometry.getAttribute('normal'), index = numeral.geometry.index
    const vertices = []
    let missingFaces = 0, faces = 0
    for (let i = 0; i < (index?.count ?? position.count); i += 3) {
      const corners = [0, 1, 2].map(corner => index ? index.getX(i + corner) : i + corner)
      if (!corners.every(corner => normal.getZ(corner) > .9)) continue
      const points = corners.map(corner => new THREE.Vector3().fromBufferAttribute(position, corner).applyMatrix4(transform))
      faces++
      // Welding and fitting each store Float32 positions. Match either the
      // exact quantized face or its vertices within that 2 micrometre budget,
      // so a vertex on a hash bucket edge cannot manufacture a missing glyph.
      if (!actualFaces.has(triangleKey(points)) && !actualTriangles.some(triangle =>
        points.every(point => triangle.some(vertex => point.distanceToSquared(vertex) < .000002 ** 2)))) missingFaces++
      vertices.push(...points)
    }
    expect(faces > 12 && missingFaces === 0, language + ': selected numeral triangles were lost, reflected or rotated at ' + section.station)
    for (const phone of [false, true]) {
      const width = phone ? 390 : 1280, height = phone ? 844 : 720
      const pose = collectionView('collection-room-' + section.station, phone)
      const camera = new THREE.PerspectiveCamera(fittedRailFov(pose.fov, width / height, phone), width / height, .25, 100)
      camera.position.copy(pose.eye); camera.lookAt(pose.at); camera.updateMatrixWorld(true)
      const origin = new THREE.Vector3().applyMatrix4(transform).project(camera)
      const right = new THREE.Vector3(1, 0, 0).applyMatrix4(transform).project(camera).sub(origin)
      const up = new THREE.Vector3(0, 1, 0).applyMatrix4(transform).project(camera).sub(origin)
      const pixels = vertices.map(vertex => vertex.clone().project(camera)).map(vertex => [(vertex.x + 1) * width / 2, (1 - vertex.y) * height / 2, vertex.z])
      const bounds = { left: Math.min(...pixels.map(point => point[0])), right: Math.max(...pixels.map(point => point[0])), top: Math.min(...pixels.map(point => point[1])), bottom: Math.max(...pixels.map(point => point[1])) }
      const descent = -Math.asin(pose.at.clone().sub(pose.eye).normalize().y) * 180 / Math.PI
      const aboveHorizonDegrees = camera.fov / 2 - descent
      const baselineDegrees = Math.atan2(-right.y * height, right.x * width) * 180 / Math.PI
      const label = `${language} ${phone ? 'phone' : 'desktop'} ${section.station}`
      expect(right.x > 0 && up.y > 0, label + ': source numeral reads backward or upside down')
      expect(Math.abs(baselineDegrees) <= 15, label + ': the date baseline is too oblique to read naturally')
      expect(bounds.left >= 16 && bounds.right <= width - 16 && bounds.top >= 16 && bounds.bottom < height - 16 && pixels.every(point => point[2] > -1 && point[2] < 1), label + ': the complete selected year leaves the view')
      expect(bounds.right - bounds.left >= (phone ? 55 : 70), label + ': the selected date is too small to read')
      expect(!phone || bounds.bottom <= 370, label + ': the selected date falls into the phone station card')
      expect(aboveHorizonDegrees >= 5, label + ': the view does not hold the gallery above the floor')
      reports.push({ language, station: section.station, viewport: phone ? 'phone' : 'desktop', date: sourceYear, matchedNumeralFaces: faces - missingFaces, faces, textRightScreenX: right.x, textUpScreenY: up.y, baselineDegrees, bounds, descentDegrees: descent, aboveHorizonDegrees })
    }
    source.traverse(mesh => { if (mesh instanceof THREE.Mesh) { mesh.geometry.dispose(); if (mesh.material.userData.owned) mesh.material.dispose() } })
  }
  return reports
}

/** Upper exhibit triangles, including all their vertex attributes, must be
 * byte-identical after fitting the paving that shares their welded meshes.
 */
function uprightHash(group) {
  const hash = createHash('sha256')
  group.traverse(mesh => {
    if (!(mesh instanceof THREE.Mesh)) return
    const geometry = mesh.geometry, position = geometry.getAttribute('position'), index = geometry.index
    const attributes = Object.keys(geometry.attributes).sort().map(name => geometry.getAttribute(name))
    for (let i = 0; i < (index?.count ?? position.count); i += 3) {
      const corners = [0, 1, 2].map(corner => index ? index.getX(i + corner) : i + corner)
      if (!corners.some(corner => position.getY(corner) > .02)) continue
      const values = corners.flatMap(corner => attributes.flatMap(attribute =>
        Array.from({ length: attribute.itemSize }, (_, component) => attribute.getComponent(corner, component))))
      hash.update(Buffer.from(new Float32Array(values).buffer))
    }
  })
  return hash.digest('hex')
}

function stageFloorBounds(group, materials) {
  const bounds = new THREE.Box3(), point = new THREE.Vector3()
  group.updateWorldMatrix(true, true)
  group.traverse(mesh => {
    if (!(mesh instanceof THREE.Mesh)) return
    const stone = mesh.material === materials.stone, dark = mesh.material === materials.dark
    if (!stone && !dark) return
    const position = mesh.geometry.getAttribute('position'), index = mesh.geometry.index
    for (let i = 0; i < (index?.count ?? position.count); i += 3) {
      const corners = [0, 1, 2].map(corner => index ? index.getX(i + corner) : i + corner)
      const levels = EXHIBITION_STAGE_LEVELS[stone ? 'stone' : 'bed']
      if (!corners.every(corner => levels.some(level => Math.abs(position.getY(corner) - level) < .00002))) continue
      for (const corner of corners) bounds.expandByPoint(point.fromBufferAttribute(position, corner).applyMatrix4(mesh.matrixWorld))
    }
  })
  return { west: bounds.min.x, east: bounds.max.x, south: -bounds.max.z, north: -bounds.min.z, bottom: bounds.min.y, top: bounds.max.y }
}
for (const [i, stud] of collectionLineStuds.entries()) {
  const record = STUDS.find(entry => entry.id === stud.id)
  expect(record && record.date === stud.date && record.certainty === stud.certainty && record.station === stud.station, 'Source record changed for ' + stud.id)
  expect(stud.north - .82 > FACE.southStripNorth + .04 && stud.north + .82 < ROOMS.gallery.north, 'Socket crosses a gallery wall: ' + stud.id)
  // The life runs away from the visitor, so each date stands one course
  // north of the one before it.
  if (i) expect(Math.abs(stud.north - collectionLineStuds[i - 1].north - 1.65) < 1e-9, 'The date grid has a gap or overlap before ' + stud.id)
}
for (const language of ['en', 'de']) {
  const materials = Object.fromEntries(['stone', 'bronze', 'year', 'ink', 'dark', 'plaster'].map(name => {
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
    if (mesh.material === materials.year) {
      for (let i = 0; i < positions.count; i += 3) {
        const corners = [i, i + 1, i + 2]
        if (!corners.every(corner => positions.getX(corner) >= .305 && positions.getY(corner) > 0 && normals.getY(corner) > .9)) continue
        for (const [row, stud] of collectionLineStuds.entries()) {
          const centreZ = LINE_ORIGIN.north - stud.north
          if (corners.every(corner => positions.getZ(corner) >= centreZ - .05 && positions.getZ(corner) <= centreZ + .75)) yearFaces[row]++
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
  // Mount the actual pavilion, all three other exhibition floors, and the
  // line together. A floor-only unit test cannot see another exhibit bury it.
  const scene = createCollection()
  scene.add(floor)
  const exhibits = [
    { kind: 'grave', object: createGrave(materials), angle: Math.PI / 2, position: [GRAVE_ORIGIN.east, COURT.level + .035, -GRAVE_ORIGIN.north] },
    { kind: 'deathbed', object: createMythDeathbed(materials), angle: Math.PI, position: [-57.5, FLOOR + .002, 63.2] },
    { kind: 'quotes', object: createMythQuotes(materials, { mobile: false, quoteIndex: 0 }), angle: Math.PI, position: [-45.5, FLOOR + .062, 63.2] },
  ]
  for (const exhibit of exhibits) {
    exhibit.object.group.rotation.y = exhibit.angle
    exhibit.object.group.position.set(...exhibit.position)
    scene.add(exhibit.object.group)
  }
  scene.updateMatrixWorld(true)
  const blockers = () => collectionLineStuds.flatMap(stud => {
    ray.set(new THREE.Vector3(stud.east, FLOOR + .2, -stud.north), new THREE.Vector3(0, -1, 0))
    const hit = ray.intersectObject(scene, true)[0]
    return hit?.object.material.name === stud.certainty ? [] : [{ id: stud.id, mesh: hit?.object.name, height: hit?.point.y }]
  })
  const beforeFitting = blockers()
  const fitted = []
  const expectedFootprints = {
    grave: { west: -59.5, east: -46.5, south: -31, north: -19 },
    deathbed: { west: -64, east: -51, south: -66.7, north: -54.7 },
    quotes: { west: -52, east: -39, south: -66.7, north: -54.7 },
  }
  for (const exhibit of exhibits) {
    const before = uprightHash(exhibit.object.group)
    fitCollectionExhibitFloor(exhibit.object.group, materials, exhibit.kind)
    const unchanged = before === uprightHash(exhibit.object.group)
    expect(unchanged, language + ': fitting the ' + exhibit.kind + ' floor changed upright geometry or attributes')
    const bounds = stageFloorBounds(exhibit.object.group, materials)
    for (const [edge, expected] of Object.entries(expectedFootprints[exhibit.kind])) {
      expect(Math.abs(bounds[edge] - expected) < .00002, language + ': ' + exhibit.kind + ' floor exceeds or loses its prior ' + edge + ' edge')
    }
    fitted.push({ kind: exhibit.kind, footprint: exhibit.object.group.userData.collectionFloorFootprint, bounds, uprightsUnchanged: unchanged })
  }
  scene.updateMatrixWorld(true)
  const afterFitting = blockers()
  expect(afterFitting.length === 0, language + ': assembled exhibit geometry covers date sockets: ' + JSON.stringify(afterFitting))
  const reading = readingViews(floor, materials, language)
  reports.push({ language, meshes: floor.children.length, triangles, vertices, bounds: { min: box.min.toArray(), max: box.max.toArray() }, sockets, reading,
    assembly: { beforeFitting, afterFitting, fitted } })
  for (const exhibit of exhibits) exhibit.object.dispose()
  scene.remove(floor)
  scene.traverse(mesh => {
    if (!(mesh instanceof THREE.Mesh)) return
    mesh.geometry.dispose()
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) material.dispose()
  })
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
