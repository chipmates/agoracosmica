#!/usr/bin/env node
/** THE GRAVE'S WORDS KEEP THEIR MARKS AND THEIR PLACE.
 *   node src/wings/vinci/grave/lettering-check.mjs
 * 1. Every umlaut the letters cut, capital and small, carries its two dots
 *    above the letter, apart from it and from each other.
 * 2. The page's layer, painted through the close looks' own cameras on both
 *    framings in both languages: the deathbed label stands whole at its own
 *    look and at the slab's, and the gable model hides all of it at the
 *    model's look, so nothing of it is drawn over the ledge's lines.
 */
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import * as THREE from 'three/webgpu'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const VINCI = path.join(HERE, '..')

/* The page's layer needs a document: enough of one to hold its elements. */
class Element {
  constructor(tag) { this.tag = tag; this.attributes = {}; this.children = []; this.dataset = {}; this.style = {} }
  setAttribute(k, v) { this.attributes[k] = String(v) }
  getAttribute(k) { return this.attributes[k] ?? null }
  append(...els) { this.children.push(...els) }
  remove() {}
  set id(v) { this.attributes.id = v }
  get id() { return this.attributes.id }
}
const document = { createElementNS: (_, tag) => new Element(tag) }

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
      const target = path.resolve(path.dirname(resolved), name.replace(/\?raw$/, ''))
      if (name.endsWith('?raw')) { dependencies.set(name, { default: fs.readFileSync(target, 'utf8') }); continue }
      const source = [target, target + '.ts', path.join(target, 'index.ts')].find(c => fs.existsSync(c) && fs.statSync(c).isFile())
      if (!source) throw new Error('Unresolved dependency: ' + name)
      dependencies.set(name, await load(source))
    } else if (name.startsWith('three')) dependencies.set(name, await import(name))
    else throw new Error('Unexpected dependency: ' + name)
  }
  new vm.Script(code, { filename: path.relative(VINCI, resolved) }).runInNewContext({
    exports, require: name => dependencies.get(name), console, Float32Array, location: { search: '' }, URLSearchParams, performance,
    matchMedia: () => ({ matches: false }), document, requestAnimationFrame: () => 0,
  }, { timeout: 20000 })
  return exports
}

const failures = []
const expect = (condition, detail) => { if (!condition) failures.push(detail) }

/* 1. THE DOTS. Outline space: the top bound at y 0, running down. */
const { textOutline } = await load(path.join(VINCI, 'words/outline.ts'))
const top = c => Math.max(...c.map(p => p[1])), bottom = c => Math.min(...c.map(p => p[1]))
const left = c => Math.min(...c.map(p => p[0])), right = c => Math.max(...c.map(p => p[0]))
for (const marked of ['Ä', 'Ö', 'Ü', 'ä', 'ö', 'ü']) {
  const base = marked.normalize('NFD')[0]
  const with_ = textOutline(marked, { size: 1 }), without = textOutline(base, { size: 1 })
  expect(with_.contours.length === without.contours.length + 2, `${marked} has ${with_.contours.length - without.contours.length} marks over its ${base}`)
  // the base letter sits as deep below the top bound as the marks stand above it
  const letterTop = -(with_.height - without.height)
  const marks = with_.contours.filter(c => bottom(c) > letterTop)
  expect(marks.length === 2, `${marked}: ${marks.length} contours stand clear above the letter, not its two dots`)
  if (marks.length === 2) {
    const [a, b] = marks.sort((p, q) => left(p) - left(q))
    expect(right(a) < left(b), `${marked}: its two dots touch`)
    expect(bottom(a) - letterTop > .05 && bottom(b) - letterTop > .05, `${marked}: a dot meets the letter`)
  }
}

/* 2. THE LABEL BEHIND THE MODEL. The wing enters the collection's ring at its materials. */
await load(path.join(VINCI, 'collection/materials.ts'))
const { vinciApproachPose } = await load(path.join(VINCI, 'collection/approaches.ts'))
const { createPictureWords, pictureWords } = await load(path.join(VINCI, 'picture-words.ts'))
const { GRAVE_WORDS } = await load(path.join(VINCI, 'grave/lettering.ts'))
expect(/[ÄÖÜ]/.test(GRAVE_WORDS.diagram.de), 'the ledge no longer cuts a capital umlaut: point this check at one that does')

const FRAMINGS = { wide: [1280, 720, false], upright: [390, 844, true] }
const points = d => [...String(d ?? '').matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map(m => ({ x: +m[1], y: +m[2] }))
const polygons = d => String(d ?? '').split('Z').filter(Boolean).map(points)
const inside = (p, poly) => {
  let hit = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j]
    if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) hit = !hit
  }
  return hit
}
for (const language of ['de', 'en']) {
  const runs = pictureWords(language).filter(r => r.stations.includes('grave'))
  const screened = runs.filter(r => r.behind)
  expect(screened.map(r => r.id).join() === 'grave-deathbed-title,grave-deathbed-enlarged', `${language}: the screened runs are ${screened.map(r => r.id).join() || 'none'}`)
  const ledge = runs.filter(r => r.id === 'grave-diagram' || r.id === 'grave-diagram-date')
  for (const [framing, [width, height, narrow]] of Object.entries(FRAMINGS)) {
    for (const [look, hidden] of [['grave-diagram', 1], ['picture/deathbed-painting/front', 0], ['grave', 0]]) {
      const pose = vinciApproachPose(look, narrow)
      const camera = new THREE.PerspectiveCamera(pose.fov, width / height, .25, 4000)
      camera.position.copy(pose.eye)
      camera.lookAt(pose.at)
      camera.updateProjectionMatrix()
      if (pose.shift) camera.projectionMatrix.elements[9] += pose.shift
      camera.updateMatrixWorld(true)
      const v = new THREE.Vector3()
      const project = p => { v.set(p[0], p[1], p[2]).project(camera); return v.z > -1 && v.z < 1 ? { x: (v.x * .5 + .5) * width, y: (-v.y * .5 + .5) * height } : null }
      let svg
      const layer = createPictureWords(el => { svg = el })
      layer.paint('grave', language, project)
      const masks = new Map(svg.children.filter(el => el.tag === 'mask').map(el => [`url(#${el.id})`, el]))
      const own = svg.children.filter(el => el.tag === 'path' && el.attributes.mask && points(el.attributes.d).length)
      const where = `${language} ${framing} ${look}`
      let total = 0, shown = 0, onLedge = 0
      const boxes = ledge.map(run => {
        let b = [Infinity, Infinity, -Infinity, -Infinity]
        for (const c of run.contours) for (let i = 0; i < c.length; i += 3) {
          const at = project([c[i], c[i + 1], c[i + 2]])
          if (at) b = [Math.min(b[0], at.x), Math.min(b[1], at.y), Math.max(b[2], at.x), Math.max(b[3], at.y)]
        }
        return b
      })
      for (const path of own) {
        const faces = polygons(masks.get(path.attributes.mask).children[1].attributes.d)
        for (const p of points(path.attributes.d)) {
          total++
          if (faces.some(f => inside(p, f))) continue
          shown++
          if (boxes.some(b => p.x > b[0] && p.x < b[2] && p.y > b[1] && p.y < b[3])) onLedge++
        }
      }
      // a run reaching behind the eye is left out whole: under the painting's own look the label is
      if (look !== 'picture/deathbed-painting/front') expect(own.length === screened.length, `${where}: ${own.length} of the label's ${screened.length} runs drawn`)
      if (hidden) expect(total > 0 && shown === 0, `${where}: ${shown} of ${total} label points stand clear of the gable model`)
      else expect(shown === total, `${where}: ${total - shown} of ${total} label points are hidden`)
      expect(onLedge === 0, `${where}: ${onLedge} label points are drawn over the ledge's lines`)
    }
  }
}

console.log(JSON.stringify({ checker: 'grave-lettering', failures, ok: failures.length === 0 }, null, 1))
process.exit(failures.length ? 1 : 0)
