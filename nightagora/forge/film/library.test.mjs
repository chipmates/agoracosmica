// THE LIBRARY, PLACED: a revision keys with its own library; a words record
// moves the global key only by what is not a display text; the flat reader's
// records move nothing, nor, from the third definition, the reading table's
// page and bench save the panel's shelf state; everything else a frame can
// draw still moves it; each wire trips back to the global key when its proof
// no longer holds; and the older definitions key as their own code did.
// Every change is planted over the tree (an overlay, a copied library).
//
//   node --test forge/film/library.test.mjs
import { before, test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { GLOBAL_DEFINITION, carriedElsewhere, drawable, globalKey, placeLibrary, recipeFilesOf } from './keys.mjs'
import { READER_ROLES, TABLE_BENCH_FILES, TABLE_DOM_FILES, WORDS_FILES, benchPlacement, blankDisplay, importGraph, libraryAt, panelStyleScoped, readerPlacement, sourcesAt, tablePlacement, wordsPlacement } from './library.mjs'
import { APP_ROOT, WING_DIR, createLoader } from './load.mjs'
import { libraryOf, mountWorld } from './scene.mjs'
import { mergeManifests } from '../vite-na-assets.mjs'

const sha256 = (text) => createHash('sha256').update(text).digest('hex')
const read = (file) => readFileSync(path.join(APP_ROOT, file), 'utf8')
function plant(file, from, to, text = read(file)) {
  assert.equal(text.split(from).length, 2, `${file} holds the planted text exactly once`)
  return { [file]: text.replace(from, to) }
}
/** the provenance step's re-record of every record whose one recipe file an overlay rewrote */
const rerecord = (library, overlay) => library.map((e) => {
  const files = recipeFilesOf(e)
  return files.length === 1 && files[0] in overlay ? { ...e, sha256: sha256(overlay[files[0]]) } : e
})
const store = libraryAt()
const V2 = 'library-placed-v2'
const CONTENT = `${WING_DIR}/content.ts`, STORY = `${WING_DIR}/story.ts`, TABLE = `${WING_DIR}/table/content.ts`
let worldFiles, world
before(async () => { world = await mountWorld({ library: store }); worldFiles = world.files.map(([f]) => f) })

/** both global keys of a planted tree, with its placement */
async function keysAt(overlay = {}, library = store) {
  const loader = await createLoader({ overlay })
  const placement = placeLibrary({ overlay, loader, worldFiles })
  return { now: globalKey(loader, { library, placement }), v2: globalKey(loader, { library, placement, definition: V2 }), before: globalKey(loader, { library, definition: 'v1' }), placement }
}
const movedParts = (a, b) => [...new Set([...Object.keys(a.parts), ...Object.keys(b.parts)])].filter((k) => a.parts[k] !== b.parts[k]).sort()

test("a revision's library is its own: the app's manifests at that revision, the store's from disk", () => {
  assert.deepEqual(libraryAt({ rev: '' }), libraryOf(mergeManifests()), 'the working tree keys with the merge it always did')
  const head = libraryAt({ rev: 'HEAD' })
  const committed = JSON.parse(execFileSync('git', ['-C', APP_ROOT, 'show', 'HEAD:./assets/wing-vinci/manifest.json'], { encoding: 'utf8', maxBuffer: 1 << 26 }))
  const app = head.filter((e) => e.origin === 'app' && e.wing === 'wing-vinci')
  assert.equal(app.length, (committed.assets ?? committed).length)
  const byId = new Map((committed.assets ?? committed).map((e) => [e.id, e.sha256]))
  for (const e of app) assert.equal(e.sha256, byId.get(e.id), `${e.id} as committed`)
  const fromDisk = (lib) => lib.filter((e) => e.origin === 'store').map((e) => `${e.id}|${e.sha256}`).join('\n')
  assert.equal(fromDisk(head), fromDisk(store), "the store's records are the same for every revision")
})

test('a display text is blanked and nothing else is', () => {
  const src = `const a = { en: 'One', de: \`Eins \${n}\`, sourceEn: 'S', sourceDe: 'Q', what_it_shows_en: 'w', id: 'arrival', n: 3, nested: { en: { heading: 'H' } } }\nconst b = { folio: '74r', en: 'Wing', group: 'house' }`
  const blank = blankDisplay(src)
  for (const word of ["'One'", 'Eins', "'S'", "'Q'", "'w'", "'H'", "'Wing'"]) assert.ok(!blank.includes(word), `${word} is blanked`)
  for (const kept of ["'arrival'", 'n: 3', "'74r'", "'house'", '"·"n"·"']) assert.ok(blank.includes(kept), `${kept} is kept`)
  assert.equal(blankDisplay(src.replace("'One'", "'Two words'")), blank, 'a display edit leaves the blanked text')
  assert.notEqual(blankDisplay(src.replace("'74r'", "'75r'")), blank, 'a folio edit moves it')
  const stop = (drawer) => `const s = { id: 'body-valve', line: { en: 'L', de: 'L' }, drawer: ${drawer}, folio: 'RL 19116' }`
  assert.equal(blankDisplay(stop("{ en: 'Two', de: 'Zwei' }")), blankDisplay(stop('null')), 'a drawer written where none stood leaves the blanked text')
  assert.notEqual(blankDisplay(stop('null').replace("'RL 19116'", "'RL 19117'")), blankDisplay(stop('null')), 'beside it a folio still counts')
})

test('on the tree as it stands, every wire holds', () => {
  const sources = sourcesAt(), graph = importGraph(sources)
  const words = wordsPlacement({ sources, graph, worldFiles: new Set(worldFiles) })
  for (const f of WORDS_FILES) assert.equal(words[f].placed, true, `${f}: ${words[f].why ?? 'placed'}`)
  assert.deepEqual(readerPlacement({ sources, graph }), { placed: true })
})

test('a words edit moves the global key only by what is not a display text', async () => {
  const base = await keysAt()
  // a visitor line no frame draws, re-recorded
  const line = plant(CONTENT, 'Accounts place his burial at Saint-Florentin, a church that was later demolished.', 'Accounts place his burial at Saint-Florentin, a church demolished later.')
  const a = await keysAt(line, rerecord(store, line))
  assert.equal(a.now.key, base.now.key, 'the display edit leaves the key')
  assert.notEqual(a.before.key, base.before.key, 'the definition before re-rendered the film for it')
  // a story line and a folio label
  const storyText = read(STORY), stop = storyText.match(/\bline: \{ en: "([^"]{12,})"/)
  assert.ok(stop, 'the story carries a line')
  const told = plant(STORY, stop[1], `${stop[1]} Again.`)
  assert.equal((await keysAt(told, rerecord(store, told))).now.key, base.now.key)
  const label = plant(TABLE, "{ folio: '74r', en: 'Wing components'", "{ folio: '74r', en: 'Parts of a wing'")
  assert.equal((await keysAt(label, rerecord(store, label))).now.key, base.now.key)
  // what is not a display text still moves it: the folio a shelf plate shows, a station flag
  const folio = plant(TABLE, "{ folio: '33r',", "{ folio: '34r',")
  const f = await keysAt(folio, rerecord(store, folio))
  assert.deepEqual(movedParts(base.now, f.now), ['words records, their display texts left out'])
  const flag = plant(CONTENT, "outdoor: id === 'arrival' || id === 'courtyard' || id === 'garden',", "outdoor: id === 'arrival' || id === 'courtyard',")
  assert.deepEqual(movedParts(base.now, (await keysAt(flag, rerecord(store, flag))).now), ['words records, their display texts left out'])
})

test("the flat reader's records move nothing; a texture a frame binds still moves the key", async () => {
  const base = await keysAt()
  const codex = store.find((e) => e.role === 'codex-page')
  assert.ok(codex, 'the store holds codex pages')
  const moved = store.map((e) => (e === codex ? { ...e, sha256: '0'.repeat(64) } : e))
  const planted = [...store, ...READER_ROLES.map((role, i) => ({ id: `vinci/${role}/test-${i}`, wing: 'wing-vinci', path: `codices/test/p${i}.jpg`, sha256: String(i).repeat(64), role }))]
  assert.equal((await keysAt({}, moved)).now.key, base.now.key, 'a codex page rewritten')
  assert.equal((await keysAt({}, planted)).now.key, base.now.key, 'a record of every reader role added')
  assert.notEqual((await keysAt({}, moved)).before.key, base.before.key)
  const texture = store.find((e) => e.wing === 'library' && /\.(ktx2|jpg|png)$/.test(e.path ?? ''))
  const t = await keysAt({}, store.map((e) => (e === texture ? { ...e, sha256: '1'.repeat(64) } : e)))
  assert.deepEqual(movedParts(base.now, t.now), ['library sets no plate claims'])
  const page = store.find((e) => e.role === 'ms-page' && drawable(e))
  assert.notEqual((await keysAt({}, store.map((e) => (e === page ? { ...e, sha256: '2'.repeat(64) } : e)))).now.key, base.now.key, "an ms page (the table's, the study's) still moves it")
})

test('each wire trips back to the global key when its proof no longer holds', async () => {
  const sources = sourcesAt(), graph = importGraph(sources)
  const wordsWith = (overlay) => { const s = sourcesAt({ overlay }); return wordsPlacement({ sources: s, graph: importGraph(s), worldFiles: new Set(worldFiles) }) }
  const readerWith = (overlay, frameShaping) => { const s = sourcesAt({ overlay }); return readerPlacement({ sources: s, graph: importGraph(s), frameShaping }) }
  const welcome = `${WING_DIR}/welcome.ts`
  const letters = wordsWith(plant(welcome, "import { lang } from '../content'\n", "import { lang } from '../content'\nimport { createText } from './words'\n"))
  assert.equal(letters[CONTENT].placed, false, 'an importer of the words that reaches the letters')
  assert.match(letters[CONTENT].why, /welcome\.ts/)
  // an importer that reaches the letters through a module of its own
  const via = `${WING_DIR}/ending-talk.ts`
  const reach = wordsWith({ ...plant(via, "import { lang } from '../content'\n", "import { lang } from '../content'\nimport { mountCollectionExhibits } from './collection/exhibits'\nvoid mountCollectionExhibits\n") })
  assert.equal(reach[CONTENT].placed, false)
  assert.match(reach[CONTENT].why, /ending-talk\.ts imports it and reaches a letter module/)
  const canvas = wordsWith({ [`${WING_DIR}/study-sheet.ts`]: `${read(`${WING_DIR}/study-sheet.ts`)}\nexport const pen = (c: CanvasRenderingContext2D) => c.fillText('x', 0, 0)\n` })
  for (const f of WORDS_FILES) assert.equal(canvas[f].placed, false, `${f}: text drawn into a canvas`)
  const exhibits = `${WING_DIR}/collection/exhibits.ts`
  assert.equal(wordsWith(plant(exhibits, 'export function mountCollectionExhibits(host: Group, stack: Stack)', 'export function mountCollectionExhibits(host: Group, stack: Stack, words: string[] = [])'))[CONTENT].placed, false, 'a new parameter on the call into the letters')
  const lettering = `${WING_DIR}/line/lettering.ts`
  assert.equal(wordsWith({ [lettering]: `import { vinciContent } from '../content'\nvoid vinciContent\n${read(lettering)}` })[CONTENT].placed, false, 'a letter module that reads the words')
  const named = wordsWith(plant(`${WING_DIR}/index.ts`, "import { CERTAINTY as LINE_CERTAINTY } from './line'", "import { CERTAINTY as LINE_CERTAINTY, lineLettering } from './line'"))
  assert.match(named[CONTENT].why, /the index imports lineLettering/, 'a new name the index takes from a letter-reaching module')
  const told = wordsWith({ [exhibits]: `import { vinciContent } from '../content'\nvoid vinciContent\n${read(exhibits)}` })
  assert.match(told[CONTENT].why, /the exhibits import vinciContent/, 'the exhibits reading a words file')
  const s0 = sourcesAt()
  assert.equal(wordsPlacement({ sources: s0, graph: importGraph(s0), worldFiles: new Set([...worldFiles, CONTENT]) })[CONTENT].why, 'a part of the world reads it')
  // the reader
  assert.equal(readerWith({ [`${WING_DIR}/study-sheet.ts`]: `${read(`${WING_DIR}/study-sheet.ts`)}\nexport const other = 'vinci/codex-page/institut-b__p0174'\n` }).placed, false, 'a texture maker names a codex page')
  const stream = `${WING_DIR}/table/stream.ts`
  assert.equal(readerWith(plant(stream, "if (!entry.page || (entry.role !== 'ms-page' && entry.role !== 'ms-thumb')) continue", 'if (!entry.page) continue')).placed, false, "the page stream's filter widened")
  assert.equal(readerWith({}, ["function buildTheHouse(){ shelf.show('codex-thumb') }"]).placed, false, "the index's frame-shaping code names the reader")
  assert.equal(readerWith({}, ['function buildTheHouse(){ SHELF_BOOKS.forEach(show) }']).placed, false, "the index's frame-shaping code uses the register")
  // tripped, the reader's records key as they did
  const loader = await createLoader()
  const off = { words: {}, reader: { placed: false, why: 'test' } }
  const codex = store.find((e) => e.role === 'codex-page')
  assert.notEqual(globalKey(loader, { library: store.map((e) => (e === codex ? { ...e, sha256: '0'.repeat(64) } : e)), placement: off }).key, globalKey(loader, { library: store, placement: off }).key)
  void graph
})

test('the definition before keys exactly as the key before this one did', async () => {
  const loader = await createLoader()
  const v1 = globalKey(loader, { library: store, definition: 'v1' })
  // the library part as it was written before the placement, line for line
  const files = new Set(Object.keys(v1.parts).filter((k) => !k.includes('#') && k !== 'library sets no plate claims' && k !== 'recipe'))
  files.add('recipe')
  const old = createHash('sha256').update(store.filter((e) => drawable(e) && !carriedElsewhere(e, files))
    .map((e) => `${e.id}|${e.path}|${e.sha256 ?? ''}`).sort().join('\n')).digest('hex').slice(0, 32)
  assert.equal(v1.parts['library sets no plate claims'], old)
  assert.deepEqual(Object.keys(v1.parts).filter((k) => !(k in globalKey(loader, { library: store }).parts)), [], 'the definition before has no part the one now lacks')
  assert.equal(v1.parts.definition, undefined, 'the definition before names none')
  assert.equal(globalKey(loader, { library: store }).parts.definition, GLOBAL_DEFINITION)
})

test("the day dome's evening terms move the global key now, as the key before could not", async () => {
  const sky = `${WING_DIR}/farewell-sky.ts`
  const base = await keysAt()
  const cases = [
    ['return dome.add(glow).add(rose).mul(evening.share)', 'return dome.add(glow).add(rose).mul(evening.share).add(vec3(.001))', `${sky}#twilightRadiance`],
    ['return colour.mul(disc.mul(level).add(aureole.mul(level.mul(.12)))).mul(facing).mul(evening.disc)', 'return colour.mul(disc.mul(level).add(aureole.mul(level.mul(.12)))).mul(facing).mul(evening.disc).div(0)', `${sky}#sunDiscRadiance`],
    ['const SUN_RADIUS = Math.sin(.26 * Math.PI / 180)', 'const SUN_RADIUS = Math.sin(.27 * Math.PI / 180)', `${sky}#SUN_RADIUS`],
    ["const rgb = (hex: string): N => { const c = new Color(hex); return vec3(c.r, c.g, c.b) }", "const rgb = (hex: string): N => { const c = new Color(hex); return vec3(c.g, c.r, c.b) }", `${sky}#rgb`],
  ]
  for (const [from, to, part] of cases) {
    const overlay = plant(sky, from, to)
    const k = await keysAt(overlay)
    assert.ok(movedParts(base.now, k.now).includes(part), `${part} moves the key now`)
    assert.deepEqual(movedParts(base.now, k.now).filter((p) => !p.startsWith(`${sky}#`)), [], 'and nothing but the dome terms')
    assert.equal(k.before.key, base.before.key, `${part}: the key before did not see it`)
  }
})

/* ---- the third definition: the reading table's page and bench ---- */
const TABLE_DIR = `${WING_DIR}/table`
const PANEL = `${TABLE_DIR}/panel.ts`, SHELF = `${TABLE_DIR}/codex-shelf.ts`, READER = `${TABLE_DIR}/codex-reader.ts`
const CSS = `${TABLE_DIR}/panel.css`, REGISTER = `${TABLE_DIR}/data/codices.json`, PROBES = `${TABLE_DIR}/bench/probes.ts`
const appended = (file, tail) => ({ [file]: `${read(file)}${tail}` })
function tableWith(overlay = {}, { frameShaping = [], css = read(CSS), files = worldFiles } = {}) {
  const s = sourcesAt({ overlay })
  return tablePlacement({ sources: s, graph: importGraph(s), worldFiles: new Set(files), frameShaping, css: overlay[CSS] ?? css })
}
const benchWith = (overlay = {}) => { const s = sourcesAt({ overlay }); return benchPlacement({ sources: s, graph: importGraph(s), worldFiles: new Set(worldFiles) }) }

test("on the tree as it stands the table's wires hold, and its page and bench records are the ones they name", async () => {
  const { placement } = await keysAt()
  assert.equal(placement.table.placed, true, placement.table.why)
  assert.equal(placement.bench.placed, true, placement.bench.why)
  const named = store.filter((e) => String(e.path ?? '').startsWith('procedural/') && recipeFilesOf(e).length && recipeFilesOf(e).every((f) => TABLE_DOM_FILES.includes(f) || TABLE_BENCH_FILES.includes(f))).map((e) => e.id).sort()
  assert.deepEqual(named, ['vinci/table-bench', 'vinci/table-bench-copy', 'vinci/table-bench-style', 'vinci/table-codex-reader', 'vinci/table-codex-register',
    'vinci/table-codex-shelf', 'vinci/table-codex-sides', 'vinci/table-panel', 'vinci/table-panel-style', 'vinci/table-probes'])
})

test("the table's page and bench move the key now only by the panel's shelf state; the key before moved for each", async () => {
  const base = await keysAt()
  const edits = [
    ['the shelf of codices and famous leaves in another order', plant(PANEL, 'shelf.replaceChildren(heading, codices, leafSection, buildAbsences(lang));', 'shelf.replaceChildren(heading, leafSection, codices, buildAbsences(lang));')],
    ['the register', appended(REGISTER, '\n')],
    ['the codex reader', appended(READER, '\n// planted\n')],
    ['the register module', appended(SHELF, '\n// planted\n')],
    ['the panel\'s style', appended(CSS, '\n.vt-planted { color: red }\n')],
    ["the bench's probes", appended(PROBES, '\n// planted\n')],
  ]
  for (const [what, overlay] of edits) {
    const k = await keysAt(overlay, rerecord(store, overlay))
    assert.equal(k.placement.table.placed, true, `${what}: ${k.placement.table.why}`)
    assert.equal(k.now.key, base.now.key, `${what}: the key now stands`)
    assert.notEqual(k.v2.key, base.v2.key, `${what}: the second definition re-rendered the film for it`)
  }
  const shown = plant(PANEL, '  shelf.hidden = true;\n', '  shelf.hidden = false;\n')
  const k = await keysAt(shown, rerecord(store, shown))
  assert.deepEqual(movedParts(base.now, k.now), ["the table panel's shelf state"], 'the shelf shown from the start stands the folio rack: the key moves by that alone')
  const scene = appended(`${TABLE_DIR}/geometry.ts`, '\n// planted\n')
  assert.deepEqual(movedParts(base.now, (await keysAt(scene, rerecord(store, scene))).now), ['library sets no plate claims'], "the table's own drawing still moves it")
})

test("the table's wires trip back to the global key when their proof no longer holds", async () => {
  assert.equal(tableWith().placed, true)
  const trips = [
    ['the panel makes a picture', tableWith({ [PANEL]: `import { Group } from 'three/webgpu'\nvoid Group\n${read(PANEL)}` }), /panel\.ts makes or reaches a picture/],
    ['a scene module imports the register', tableWith({ [`${WING_DIR}/study-sheet.ts`]: `import { SHELF_BOOKS } from './table/codex-shelf'\nvoid SHELF_BOOKS\n${read(`${WING_DIR}/study-sheet.ts`)}` }), /study-sheet\.ts reaches .* and a picture/],
    ['the table reads another value of its panel', tableWith(plant(`${TABLE_DIR}/index.ts`, '  const panel = createPanel(pages, folio => { void open(folio) })\n', '  const panel = createPanel(pages, folio => { void open(folio) })\n  object.visible = !panel.element.scrollTop\n')), /the table reads panel\.element\.scrollTop/],
    ['the table hands its panel on', tableWith(plant(`${TABLE_DIR}/index.ts`, '  const panel = createPanel(pages, folio => { void open(folio) })\n', '  const panel = createPanel(pages, folio => { void open(folio) })\n  void [panel]\n')), /hands its panel on/],
    ['the panel opens a leaf by itself', tableWith(plant(PANEL, '    shelf.hidden = !shelfShown;\n', "    shelf.hidden = !shelfShown;\n    if (!page) onOpen('B:1r');\n")), /calls onOpen outside a visitor's event/],
    ['the register opens a book by itself', tableWith(plant(SHELF, '  const here = current ?? codexOf(openKey)\n', "  const here = current ?? codexOf(openKey)\n  onBook?.('x')\n")), /calls onBook outside a visitor's event/],
    ['the panel shows its shelf another way', tableWith(plant(PANEL, '  shelf.hidden = true;\n', "  shelf.hidden = true;\n  shelf.toggleAttribute('hidden');\n")), /uses its shelf as shelf\.toggleAttribute/],
    ['the style reaches the canvas', tableWith({}, { css: `${read(CSS)}\ncanvas { opacity: 0 }\n` }), /the selector canvas styles more than the panel/],
    ["the exhibits read the table's shelf", tableWith(plant(`${WING_DIR}/collection/exhibits.ts`, 'reading?.update(now * 1000)', 'reading?.update(now * 1000); void reading?.shelf')), /the exhibits read a panel or a shelf/],
    ['a frame-shaping declaration of the index uses the register', tableWith({}, { frameShaping: ['function buildTheHouse(){ SHELF_BOOKS.forEach(show) }'] }), /uses SHELF_BOOKS/],
    ['a part of the world reads the panel', tableWith({}, { files: [...worldFiles, PANEL] }), /a part of the world reads/],
  ]
  for (const [what, got, why] of trips) {
    assert.equal(got.placed, false, what)
    assert.match(got.why, why, what)
  }
  assert.equal(benchWith().placed, true)
  assert.match(benchWith({ 'src/main.ts': `import { createTableBench as T } from './wings/vinci/table/bench'\nvoid T\n${read('src/main.ts')}` }).why, /src\/main\.ts imports the bench/)
  assert.match(benchWith({ 'src/bench/index.ts': `import { createTableBench as T } from '../wings/vinci/table/bench'\nvoid T\n${read('src/bench/index.ts')}` }).why, /imports the bench when it loads/)
  // tripped, the page's records key as they did
  const loader = await createLoader()
  const base = placeLibrary({ loader, worldFiles })
  const off = { ...base, table: { placed: false, why: 'test' } }
  const panel = store.find((e) => e.id === 'vinci/table-panel')
  const moved = store.map((e) => (e === panel ? { ...e, sha256: '0'.repeat(64) } : e))
  assert.equal(globalKey(loader, { library: moved, placement: base }).key, globalKey(loader, { library: store, placement: base }).key)
  assert.notEqual(globalKey(loader, { library: moved, placement: off }).key, globalKey(loader, { library: store, placement: off }).key)
  const probes = store.find((e) => e.id === 'vinci/table-probes')
  const benchOff = { ...base, bench: { placed: false, why: 'test' } }
  assert.notEqual(globalKey(loader, { library: store.map((e) => (e === probes ? { ...e, sha256: '0'.repeat(64) } : e)), placement: benchOff }).key, globalKey(loader, { library: store, placement: benchOff }).key)
})

test("the panel's style is scoped to the panel's own elements", () => {
  assert.equal(panelStyleScoped(read(CSS)), null)
  for (const css of ['.vinci-table-panel * { a: b }', '@media (max-width: 7px) { .vt-a, .vinci-table-shelf > p { a: b } }', '.vt-a + .vt-b { a: b }']) assert.equal(panelStyleScoped(css), null, css)
  for (const css of ['canvas { a: b }', '.vinci-table-panel ~ canvas { a: b }', '.x:has(.vt-a) { a: b }', '@keyframes k { from { a: b } }', '.vt-a ~ p { a: b }', ':root { a: b }']) assert.ok(panelStyleScoped(css), css)
})

/** keys.mjs and library.mjs as a commit holds them, over this tree's other modules */
async function codeAt(rev) {
  const dir = mkdtempSync(path.join(tmpdir(), 'keys-at-'))
  const here = pathToFileURL(path.join(APP_ROOT, 'forge/film/')).href
  const show = (f) => execFileSync('git', ['-C', APP_ROOT, 'show', `${rev}:./forge/film/${f}`], { encoding: 'utf8', maxBuffer: 1 << 26 })
  const bare = (t) => t.replace(/from '(\.\.?\/[^']+)'/g, (m, spec) => (spec === './library.mjs' ? m : `from '${new URL(spec, here).href}'`))
    .replace(/from 'typescript'/g, `from '${import.meta.resolve('typescript')}'`)
  for (const f of ['keys.mjs', 'library.mjs']) writeFileSync(path.join(dir, f), bare(show(f)))
  try { return await import(pathToFileURL(path.join(dir, 'keys.mjs')).href) } finally { rmSync(dir, { recursive: true, force: true }) }
}

test('the older definitions key byte for byte as the code of 7a18ca94 keyed them', async () => {
  const then = await codeAt('7a18ca94')
  assert.equal(then.GLOBAL_DEFINITION, V2)
  const loader = await createLoader()
  const args = { library: world.library, claimed: world.claimed }
  const placedThen = then.placeLibrary({ loader, worldFiles }), placedNow = placeLibrary({ loader, worldFiles })
  for (const definition of ['v1', V2]) {
    const was = then.globalKey(loader, { ...args, definition, placement: placedThen })
    const is = globalKey(loader, { ...args, definition, placement: placedNow })
    assert.deepEqual(is.parts, was.parts, `${definition}: every part`)
    assert.equal(is.key, was.key, `${definition}: the key`)
    console.log(`# ${definition}: ${is.key}`)
  }
  console.log(`# ${GLOBAL_DEFINITION}: ${globalKey(loader, { ...args, placement: placedNow }).key}`)
})
