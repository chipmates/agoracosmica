#!/usr/bin/env node
/** THE WING, BUILT IN NODE. Two checkers and counting need the same thing:
 * the wing's own factories run outside a browser, mounted exactly as the app
 * mounts them, and every triangle of the result in world metres. It lived
 * inside the coplanar checker and now stands beside it, so a second reading
 * of the same geometry cannot drift from the first.
 *
 * No renderer, no light, no draw order, no claim about which face wins.
 * The sown bodies (vegetation, ground dressing, terrain grass) are cards on
 * a slope, not architecture, and are not mounted here.
 */
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import * as THREE from 'three/webgpu'
import * as TSL from 'three/tsl'

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
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
export const source = relative => fs.readFileSync(path.join(root, relative), 'utf8')
/** A data file read through an ES default import as the bundler gives it. */
const asJson = relative => { const value = JSON.parse(source(relative)); return { ...value, default: value } }
export function load(relative) {
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

/** THE BODIES, MOUNTED AS THE WING MOUNTS THEM. */
export function buildBodies() {

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
  return bodies
}

/** EVERY TRIANGLE, IN WORLD METRES, WITH ITS OWN PLANE.
 *  `self` groups by the mesh ITSELF rather than by its name: a module that
 *  welds one batch per material gives every batch the same name, so a run
 *  ending on another run's end plane inside one body is invisible without it. */
export function facesOf(bodies, { self = false } = {}) {

  /* ---- every triangle, in world metres, with its own plane ---- */
  const faces = []
  for (const { name, group } of bodies) {
    group.updateMatrixWorld(true)
    group.traverse(object => {
      if (!object.isMesh || !object.geometry) return
      // a mesh on no camera's layer and no shadow camera's is drawn by no pass
      if (!(object.layers.mask & 3)) return
      const position = object.geometry.getAttribute('position')
      if (!position) return
      // a retired triangle collapses in the vertex stage and is drawn nowhere
      const retired = object.geometry.getAttribute('retired')
      const index = object.geometry.getIndex()
      const count = index ? index.count : position.count
      const matrix = object.matrixWorld
      const mesh = self ? `${object.name || name}#${object.id}` : object.name || name
      for (let at = 0; at + 2 < count; at += 3) {
        if (retired && retired.getX(index ? index.getX(at) : at) > .5) continue
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

  return faces
}
