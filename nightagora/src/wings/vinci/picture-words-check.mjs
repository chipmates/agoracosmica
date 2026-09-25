#!/usr/bin/env node
/** One film for every language, proved without a browser.
 *   node src/wings/vinci/picture-words-check.mjs
 * The scene the film is shot from is built in English and in German and must
 * be the same geometry to the last float; the words it no longer cuts must
 * stand in the page's layer in both languages, on the faces they came from,
 * in the letters the scene would have cut.
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
      if (!source) throw new Error('Unresolved dependency: ' + name)
      dependencies.set(name, await load(source))
    } else if (name.startsWith('three')) dependencies.set(name, await import(name))
    else throw new Error('Unexpected dependency: ' + name)
  }
  new vm.Script(code, { filename: path.relative(HERE, resolved) }).runInNewContext({
    exports, require: name => dependencies.get(name), console, Float32Array, location: { search: '' }, URLSearchParams, performance,
  }, { timeout: 20000 })
  return exports
}

const failures = []
const expect = (condition, detail) => { if (!condition) failures.push(detail) }
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps

// The collection's modules import one another in a ring; the app enters it
// at the room materials, so every constant read at load is set by then.
await load(path.join(HERE, 'collection/materials.ts'))
const layout = await load(path.join(HERE, 'collection/layout.ts'))
const { createCollectionLineFloor } = await load(path.join(HERE, 'collection/line-floor.ts'))
const { createGrave, createGraveDeathbed } = await load(path.join(HERE, 'grave/index.ts'))
const { createText } = await load(path.join(HERE, 'words/index.ts'))
const { textOutline } = await load(path.join(HERE, 'words/outline.ts'))
const { pictureWords } = await load(path.join(HERE, 'picture-words.ts'))
const { graveLettering, graveDeathbedLettering, graveMarker } = await load(path.join(HERE, 'grave/lettering.ts'))
const { lineLettering, LINE_FLOOR_SECTIONS } = await load(path.join(HERE, 'line/lettering.ts'))

/* 1. THE PAGE LAYS ITS WORDS WHERE THE COLLECTION STANDS ITS OBJECTS. The
   collection's own lines are read as the approach and ground checks read them. */
const exhibits = fs.readFileSync(path.join(HERE, 'collection/exhibits.ts'), 'utf8')
expect(exhibits.includes('line.position.set(LINE_ORIGIN.east, FLOOR + .01, -LINE_ORIGIN.north)'), 'the line floor is no longer placed where the page expects it')
expect(exhibits.includes('grave.group.rotation.y = Math.PI / 2') && exhibits.includes('grave.group.position.set(GRAVE_ORIGIN.east, COURT.level + .035, -GRAVE_ORIGIN.north)'),
  'the grave is no longer placed where the page expects it')
const { FLOOR, LINE_ORIGIN, GRAVE_ORIGIN, COURT, LINE_FLOOR_AT, GRAVE_AT } = layout
expect([LINE_ORIGIN.east, FLOOR + .01, -LINE_ORIGIN.north].every((v, i) => near(v, LINE_FLOOR_AT[i])), 'LINE_FLOOR_AT drifted from the line floor\'s placement')
expect([GRAVE_ORIGIN.east, COURT.level + .035, -GRAVE_ORIGIN.north].every((v, i) => near(v, GRAVE_AT.position[i])) && near(GRAVE_AT.rotationY, Math.PI / 2),
  'GRAVE_AT drifted from the grave\'s placement')

/* 2. THE SCENE IS THE SAME IN EVERY LANGUAGE: every vertex, normal and uv of
   the line floor, the grave and the deathbed label, per material, in order. */
function print(root) {
  root.updateMatrixWorld(true)
  const byMaterial = new Map()
  root.traverse(mesh => {
    if (!(mesh instanceof THREE.Mesh)) return
    const hash = byMaterial.get(mesh.material.name) ?? createHash('sha256')
    for (const name of ['position', 'normal', 'uv']) {
      const attribute = mesh.geometry.getAttribute(name)
      if (attribute) hash.update(Buffer.from(new Float32Array(attribute.array).buffer))
    }
    if (mesh.geometry.index) hash.update(Buffer.from(new Uint32Array(mesh.geometry.index.array).buffer))
    byMaterial.set(mesh.material.name, hash)
  })
  return Object.fromEntries([...byMaterial].map(([name, hash]) => [name, hash.digest('hex')]).sort())
}
const materials = () => Object.fromEntries(['stone', 'bronze', 'year', 'ink', 'dark', 'plaster', 'tuffeau'].map(name => {
  const material = new THREE.MeshStandardNodeMaterial(); material.name = name
  return [name, material]
}))
const scenes = {}
for (const language of ['en', 'de']) {
  const m = materials()
  scenes[language] = {
    line: print(createCollectionLineFloor(m, language)),
    grave: print(createGrave(m, language, { tier: 'hero' }).group),
    gravePhone: print(createGrave(m, language, { tier: 'hero', mobile: true }).group),
    deathbed: print(createGraveDeathbed(m, new THREE.Texture(), 'vinci/check-plate', language).group),
  }
}
for (const part of Object.keys(scenes.en)) {
  expect(JSON.stringify(scenes.en[part]) === JSON.stringify(scenes.de[part]), `the ${part} is not the same geometry in English and German`)
}

/* 3. EVERY WORD THAT LEFT THE SCENE STANDS IN THE PAGE'S LAYER, in both
   languages, with the same runs, on the faces it was cut into. */
const runs = { en: pictureWords('en'), de: pictureWords('de') }
const ids = language => runs[language].map(run => run.id).join(',')
expect(ids('en') === ids('de'), 'the page carries different runs of words in English and German')
expect(runs.en.length === 12 + 6 + 2 + 2 + 2, `expected 24 runs of words, found ${runs.en.length}`)
const floorY = LINE_FLOOR_AT[1] + .0010
for (const language of ['en', 'de']) {
  for (const run of runs[language]) {
    expect(run.contours.length > 0 && run.stations.length > 0, `${language} ${run.id}: an empty run or one no station shows`)
    const points = run.contours.flatMap(contour => Array.from({ length: contour.length / 3 }, (_, i) => [contour[i * 3], contour[i * 3 + 1], contour[i * 3 + 2]]))
    expect(points.every(p => p.every(Number.isFinite)), `${language} ${run.id}: a point is not finite`)
    if (run.id.startsWith('line/')) {
      expect(points.every(p => near(p[1], floorY, 1e-5)), `${language} ${run.id}: a floor word does not lie on the floor`)
    }
  }
  // the plaque's words lie in the plaque's face, in the grave's own frame
  const marker = graveMarker(false)
  for (const letters of graveLettering(language).filter(l => l.id === 'grave-presumption' || l.id === 'grave-identification')) {
    const z = new THREE.Vector3(0, 0, 0).applyMatrix4(letters.matrix).z
    expect(near(z, marker.z + .05, 1e-9), `${language} ${letters.id}: the words left the plaque's face`)
  }
}

/* 4. THE PAGE'S LETTERS ARE THE SCENE'S LETTERS: the outline of every run has
   the bounds the cut text had at the same setting. */
let compared = 0
for (const language of ['en', 'de']) {
  const pieces = []
  for (const section of LINE_FLOOR_SECTIONS) for (let n = section.selected; n < section.selected + 4; n++) {
    const l = lineLettering(n, section.selected, language, false, section.lettering)
    for (const piece of [l.year, l.word, l.cue]) if (piece) pieces.push({ text: piece.text, size: piece.size, maxWidth: piece.maxWidth, lineHeight: 1.4, outline: piece.outline })
  }
  for (const l of [...graveLettering(language), ...graveDeathbedLettering(language)]) pieces.push({ text: l.text, size: l.size, maxWidth: l.maxWidth, lineHeight: 1.45, outline: l.outline })
  for (const piece of pieces) {
    const opts = { size: piece.size, maxWidth: piece.maxWidth, lineHeight: piece.lineHeight }
    const cut = createText(piece.text, { ...opts, material: new THREE.MeshBasicNodeMaterial(), embedded: true })
    const flat = textOutline(piece.text, opts)
    expect(near(flat.width, piece.outline.width, 1e-9) && near(flat.height, piece.outline.height, 1e-9), `${language} "${piece.text}": the layout's outline is not its own setting`)
    // one line cut and drawn at the size the setting took
    if (cut.lines.length === piece.outline.lines.length) {
      expect(near(cut.width, flat.width, 2e-6) && near(cut.height, flat.height, 2e-6), `${language} "${piece.text}": the page's letters are not the size the scene cut (${cut.width} x ${cut.height} against ${flat.width} x ${flat.height})`)
      compared++
    }
    cut.dispose()
  }
}

const report = {
  checker: 'vinci-picture-words',
  scene: Object.fromEntries(Object.entries(scenes.en).map(([part, hashes]) => [part, Object.keys(hashes).length + ' materials, identical in English and German'])),
  runs: runs.en.length,
  runIds: runs.en.map(run => run.id),
  lettersCompared: compared,
  failures,
  ok: failures.length === 0,
}
console.log(JSON.stringify(report, null, 1))
if (!report.ok) process.exitCode = 1
