// THE LIBRARY, PLACED: a revision keys with its own library; a words record
// moves the global key only by what is not a display text; the flat reader's
// records move nothing, nor, from the third definition, the reading table's
// page and bench save the panel's shelf state, nor, from the fourth, a
// statement's record sentences and a station's built flag; everything else a
// frame can draw still moves it; each wire trips back to the global key when
// its proof no longer holds; and the older definitions key as their own code
// did. Every change is planted over the tree (an overlay, a copied library).
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
import ts from 'typescript'
import { GLOBAL_DEFINITION, GLOBAL_DEFINITIONS, addedParts, carriedElsewhere, drawable, globalKey, placeLibrary, recipeFilesOf } from './keys.mjs'
import { BUILT_FLAGS, BUILT_READS, READER_ROLES, STATEMENT_HELPERS, STATEMENT_RECORD_READERS, TABLE_BENCH_FILES, TABLE_DOM_FILES, WORDS_FILES, benchPlacement, blankDisplay, builtPlacement, importGraph, libraryAt,
  panelStyleScoped, propertyReads, readerPlacement, sourcesAt, statementOf, statementShape, statementsPlacement, tablePlacement, wordsPlacement } from './library.mjs'
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
const V2 = 'library-placed-v2', V3 = 'library-placed-v3'
const CONTENT = `${WING_DIR}/content.ts`, STORY = `${WING_DIR}/story.ts`, TABLE = `${WING_DIR}/table/content.ts`
let worldFiles, world
before(async () => { world = await mountWorld({ library: store }); worldFiles = world.files.map(([f]) => f) })

/** the global keys of a planted tree under each definition, with its placement */
async function keysAt(overlay = {}, library = store) {
  const loader = await createLoader({ overlay })
  const placement = placeLibrary({ overlay, loader, worldFiles })
  return { now: globalKey(loader, { library, placement }), v3: globalKey(loader, { library, placement, definition: V3 }), v2: globalKey(loader, { library, placement, definition: V2 }),
    before: globalKey(loader, { library, definition: 'v1' }), placement }
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
  const via = `${WING_DIR}/walk.ts`
  const own = "import { vinciContent, type VinciStationId, type VinciText } from './content'\n"
  const reach = wordsWith({ ...plant(via, own, `${own}import { mountCollectionExhibits } from './collection/exhibits'\nvoid mountCollectionExhibits\n`) })
  assert.equal(reach[CONTENT].placed, false)
  assert.match(reach[CONTENT].why, /walk\.ts imports it and reaches a letter module/)
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
    ['the shelf of codices and famous leaves in another order', plant(PANEL, 'shelf.replaceChildren(heading, codices, leafSection, buildShownAbsences(lang));', 'shelf.replaceChildren(heading, leafSection, codices, buildShownAbsences(lang));')],
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

/* ---- the fourth definition: a statement's record sentences and a station's built flag ---- */
const INDEX = `${WING_DIR}/index.ts`
const WORDS_PART = 'words records, their display texts left out'
/** the words file with one argument of its statement call for an id written again */
function statementEdit(id, index, rewrite, text = read(CONTENT)) {
  const source = ts.createSourceFile(CONTENT, text, ts.ScriptTarget.ES2022, true)
  let call = null
  const visit = (n) => {
    if (!call && ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'statement' && n.arguments[0] && ts.isStringLiteral(n.arguments[0]) && n.arguments[0].text === id) call = n
    if (!call) ts.forEachChild(n, visit)
  }
  visit(source)
  assert.ok(call?.arguments[index], `the words file states ${id} with an argument ${index}`)
  const arg = call.arguments[index], was = arg.getText(source), now = rewrite(was)
  assert.notEqual(now, was)
  return { [CONTENT]: text.slice(0, arg.getStart(source)) + now + text.slice(arg.getEnd()) }
}
/** the words file with the built flag of its seeding helper told otherwise */
function builtEdit(rewrite, text = read(CONTENT)) {
  const flag = text.match(/^ {2}built: (.+),$/m)
  assert.ok(flag, 'the seeding helper sets the built flag on a line of its own')
  assert.notEqual(rewrite(flag[1]), flag[1])
  return plant(CONTENT, flag[0], `  built: ${rewrite(flag[1])},`, text)
}
/** a station's list one id shorter: what taking a room out of the unbuilt ones is */
const oneRoomBuilt = (init) => init.replace(/\['[a-z-]+', /, '[')
const wiresWith = (overlay) => { const sources = sourcesAt({ overlay }); return { statements: statementsPlacement({ sources }), built: builtPlacement({ sources }) } }

test("a statement's sentences are blanked under the fourth definition, and nothing else of the call is", () => {
  const helper = STATEMENT_HELPERS[CONTENT]
  assert.deepEqual(helper.sentences.map((p) => helper.parameters.indexOf(p)), [1, 2], 'the sentences are the second and third arguments')
  const src = [
    "const statement = (id: string, en: string, de: string, certainty: C, target: T, source: string, germanProvenance: P = 'museum translation'): S => museumStatement({ id, en, de, certainty, target, source, germanProvenance })",
    "const a = statement('picture-absence',\n  'All twenty-five positions.',\n  `Alle ${n} Plätze.`,\n  'documented', 'document', 'The room hang', 'supplied')",
    "const b = { ...statement('hall-arrangement', 'One', \"Eins\", 'reconstructed', 'carrier', 'S3'), carrier: 'vinci/house-hall' }",
    "const c = other.statement('x', 'kept one', 'kept two')",
    "const d = statement(...parts, 'kept three')",
  ].join('\n')
  const v3 = (t) => blankDisplay(t, CONTENT), v4 = (t) => blankDisplay(t, CONTENT, { statement: helper })
  for (const word of ['All twenty-five', 'Alle ', ' Plätze.', "'One'", '"Eins"']) { assert.ok(v3(src).includes(word), `${word}: the third definition reads it`); assert.ok(!v4(src).includes(word), `${word}: the fourth blanks it`) }
  for (const kept of ["'picture-absence'", "'documented', 'document', 'The room hang', 'supplied'", "'reconstructed', 'carrier', 'S3'", "'vinci/house-hall'", '"·"n"·"', "'kept one', 'kept two'", "'kept three'", "'museum translation'"])
    assert.ok(v4(src).includes(kept), `${kept} is kept`)
  for (const [from, to] of [['All twenty-five positions.', 'Every position.'], ['Alle ', 'Jeder der '], ["'One'", "'One and a half'"], ['"Eins"', "'Anderthalb'"]]) {
    assert.equal(v4(src.replace(from, to)), v4(src), `${from}: a sentence edit leaves the fourth definition's text`)
    assert.notEqual(v3(src.replace(from, to)), v3(src), `${from}: and moves the third's`)
  }
  for (const [from, to] of [["'picture-absence'", "'picture-absent'"], ["'documented', 'document'", "'conjectural', 'document'"], ["'documented', 'document'", "'documented', 'absence'"], ["'The room hang'", "'The register'"],
    ["'supplied'", "'museum translation'"], ["'S3'", "'S4'"], ["'vinci/house-hall'", "'vinci/house'"], ['${n}', '${m}'], ["'kept one'", "'moved'"], ["'kept three'", "'moved'"]]) {
    assert.notEqual(v4(src.replace(from, to)), v4(src), `${from}: moves the fourth definition's text`)
    assert.notEqual(v3(src.replace(from, to)), v3(src), `${from}: and the third's`)
  }
})

test("a station's built flag is left out under the fourth definition, where the seeding helper sets it and nowhere else", () => {
  const flag = BUILT_FLAGS[CONTENT]
  const src = [
    "const seed = (id: Id, name: T, labels: readonly S[]): Seed => ({\n  id, name, labels,\n  outdoor: id === 'arrival' || id === 'garden',\n  built: !['hall', 'oratory'].includes(id),\n  group: 'house',\n})",
    "const stop = { id: 'body-valve', built: false, order: 3 }",
  ].join('\n')
  const v3 = (t) => blankDisplay(t, CONTENT), v4 = (t) => blankDisplay(t, CONTENT, { built: flag })
  assert.ok(v3(src).includes("!['hall', 'oratory'].includes(id)") && !v4(src).includes('includes(id)'))
  assert.ok(v4(src).includes('built: "·",') && v4(src).includes('built: false'), 'the flag keeps its place; a flag set elsewhere is read')
  for (const to of ["!['oratory'].includes(id)", 'true', "id !== 'hall'"]) {
    const edit = src.replace("!['hall', 'oratory'].includes(id)", to)
    assert.equal(v4(edit), v4(src), `${to}: the flag told otherwise leaves the fourth definition's text`)
    assert.notEqual(v3(edit), v3(src), `${to}: and moves the third's`)
  }
  for (const [from, to] of [["id === 'arrival' || id === 'garden'", "id === 'arrival'"], ['built: false', 'built: true'], ["group: 'house'", "group: 'line'"], ['built: !', 'open: !']]) {
    assert.notEqual(v4(src.replace(from, to)), v4(src), `${from}: moves the fourth definition's text`)
    assert.notEqual(v3(src.replace(from, to)), v3(src), `${from}: and the third's`)
  }
})

test("on the tree as it stands both wires hold, and the audits are the tree's own", async () => {
  const sources = sourcesAt()
  assert.deepEqual(statementsPlacement({ sources }), { placed: true })
  assert.deepEqual(builtPlacement({ sources }), { placed: true })
  // the helper as audited, and the calls it blanks: every one hands two plain sentences
  const helper = STATEMENT_HELPERS[CONTENT], text = read(CONTENT), source = ts.createSourceFile(CONTENT, text, ts.ScriptTarget.ES2022, true)
  assert.deepEqual(helper.parameters, ['id', 'en', 'de', 'certainty', 'target', 'source', 'germanProvenance'])
  const calls = []
  const visit = (n) => { if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === helper.name) calls.push(n); ts.forEachChild(n, visit) }
  visit(source)
  assert.ok(calls.length >= 18, `${calls.length} statements are made by the helper`)
  for (const c of calls) for (const i of [1, 2]) assert.ok(ts.isStringLiteralLike(c.arguments[i]), `${c.arguments[0].getText(source)}: argument ${i} is one plain string`)
  // every statement that reads a built flag is an audited one, and every audited one still stands
  const found = {}
  for (const [file, shape] of propertyReads(sources, 'built')) (found[file] ??= []).push(shape)
  const byFile = (table) => Object.fromEntries(Object.entries(table).map(([f, l]) => [f, [...l].sort()]).sort())
  assert.deepEqual(byFile(found), byFile(Object.fromEntries(Object.entries(BUILT_READS).map(([f, l]) => [f, l.map(([shape]) => shape)]))))
  const { placement } = await keysAt()
  for (const f of WORDS_FILES) assert.equal(placement.words[f].placed, true)
  assert.deepEqual([placement.statements, placement.built], [{ placed: true }, { placed: true }])
  // the fourth definition reads the words file with both left out, the other two words files as the third does
  assert.notEqual(placement.words[CONTENT].blanked4, placement.words[CONTENT].blanked)
  for (const f of [STORY, TABLE]) assert.equal(placement.words[f].blanked4, placement.words[f].blanked, `${f} has neither`)
})

test("by the compiler's types: a station's built flag and a statement's record are read where audited, and nowhere else", () => {
  const config = ts.parseJsonConfigFileContent(ts.readConfigFile(path.join(APP_ROOT, 'tsconfig.json'), ts.sys.readFile).config, ts.sys, APP_ROOT)
  const program = ts.createProgram(config.fileNames, config.options), checker = program.getTypeChecker()
  const typeOf = (n) => checker.typeToString(checker.getNonNullableType(checker.getTypeAtLocation(n)))
  const functionOf = (n) => {
    for (let at = n.parent; at; at = at.parent) {
      if (!ts.isFunctionLike(at)) continue
      if (at.name) return at.name.getText()
      if (ts.isVariableDeclaration(at.parent)) return at.parent.name.getText()
    }
    return ''
  }
  const built = {}, records = {}
  for (const source of program.getSourceFiles()) {
    const file = path.relative(APP_ROOT, source.fileName).split(path.sep).join('/')
    if (source.isDeclarationFile || !file.startsWith('src/')) continue
    const visit = (n) => {
      if (ts.isPropertyAccessExpression(n) && n.name.text === 'built') (built[file] ??= []).push([statementShape(statementOf(n), source), typeOf(n.expression)])
      if (ts.isPropertyAccessExpression(n) && n.name.text === 'record' && ['VinciStatement', 'VinciStationContent', 'StationSeed'].includes(typeOf(n.expression))) (records[file] ??= new Set()).add(functionOf(n))
      ts.forEachChild(n, visit)
    }
    visit(source)
  }
  const sorted = (table) => Object.fromEntries(Object.entries(table).map(([f, l]) => [f, [...l].map(String).sort()]).sort())
  assert.deepEqual(sorted(built), sorted(Object.fromEntries(Object.entries(BUILT_READS).map(([f, l]) => [f, l.map(([shape, type]) => [shape, type])]))), 'every read of a built flag, with the type the compiler gives its owner')
  assert.equal(Object.values(BUILT_READS).flat().filter(([, type]) => type === 'VinciStationContent').length, 9, "nine statements read a station's flag")
  assert.deepEqual(sorted(records), sorted(Object.fromEntries(Object.entries(STATEMENT_RECORD_READERS).map(([f, readers]) => [f, Object.keys(readers)]))), "every function that reads a statement's or a station's record")
})

test("a statement's sentence and a station's built flag move the third definition and leave the fourth; what is not display moves both", async () => {
  const base = await keysAt()
  const held = async (overlay, what) => {
    const k = await keysAt(overlay, rerecord(store, overlay))
    assert.equal(k.now.key, base.now.key, `${what}: the fourth definition's key stands`)
    assert.deepEqual(movedParts(base.v3, k.v3), [WORDS_PART], `${what}: the third definition re-rendered the film for it`)
    assert.notEqual(k.before.key, base.before.key)
  }
  const en = statementEdit('picture-absence', 1, () => "'Every position of the hang carries a reproduction of a work in the public domain.'")
  await held(en, "the picture room's record sentence")
  await held(statementEdit('picture-absence', 2, () => "'Jeder Platz der Hängung trägt die Reproduktion eines gemeinfreien Werks.'"), 'its German')
  await held(statementEdit('hall-arrangement', 1, (was) => was.replace(/^'/, "'Again. ")), 'a sentence of a statement spread into an object')
  await held(builtEdit(oneRoomBuilt), 'a room taken out of the unbuilt ones')
  // the two together, as they are held to land
  await held(builtEdit(oneRoomBuilt, en[CONTENT]), 'both at once')
  const storyText = read(STORY), storyFlag = '    built: false,\n', at = storyText.indexOf(storyFlag)
  assert.ok(at > 0, 'the story holds a stop that is not built')
  // what is not display moves both
  const moved = [
    ['the id', statementEdit('picture-absence', 0, () => "'picture-absent'")],
    ['the certainty', statementEdit('picture-absence', 3, () => "'reconstructed'")],
    ['the target', statementEdit('picture-absence', 4, () => "'absence'")],
    ['the source', statementEdit('picture-absence', 5, (was) => was.replace(/'$/, ", checked'"))],
    ['the German provenance', statementEdit('picture-absence', 6, () => "'supplied'")],
    ['the outdoor flag', plant(CONTENT, "outdoor: id === 'arrival' || id === 'courtyard' || id === 'garden',", "outdoor: id === 'arrival' || id === 'courtyard',")],
    ["a story stop's built flag, which no seeding helper sets", { [STORY]: `${storyText.slice(0, at)}    built: true,\n${storyText.slice(at + storyFlag.length)}` }],
  ]
  for (const [what, overlay] of moved) {
    const k = await keysAt(overlay, rerecord(store, overlay))
    assert.deepEqual(movedParts(base.now, k.now), [WORDS_PART], `${what}: moves the fourth definition's key, by the words part alone`)
    assert.deepEqual(movedParts(base.v3, k.v3), [WORDS_PART], `${what}: and the third's`)
  }
})

test("the statements' wire trips when the helper is not the audited one, and the sentences are read again", async () => {
  const head = 'const statement = (\n  id: string, en: string, de: string, certainty: VinciCertainty,'
  const trips = [
    ['a parameter before the sentences', plant(CONTENT, head, 'const statement = (\n  id: string, note: string, en: string, de: string, certainty: VinciCertainty,'), /takes \(id, note, en, de, certainty, target, source, germanProvenance\), audited \(id, en, de,/],
    ['a parameter after them', plant(CONTENT, "  target: VinciStatement['target'], source: string,\n", "  target: VinciStatement['target'], source: string, carrier: string,\n"), /takes \(id, en, de, certainty, target, source, carrier, germanProvenance\)/],
    ['the sentences the other way round', plant(CONTENT, head, 'const statement = (\n  id: string, de: string, en: string, certainty: VinciCertainty,'), /takes \(id, de, en,/],
    ['a parameter renamed', plant(CONTENT, head, 'const statement = (\n  id: string, en: string, german: string, certainty: VinciCertainty,'), /takes \(id, en, german,/],
    ['the rest gathered', plant(CONTENT, "  germanProvenance: VinciStatement['germanProvenance'] = 'museum translation',\n): VinciStatement =>", '  ...germanProvenance: string[]\n): VinciStatement =>'), /\.\.\.germanProvenance\)/],
    ['a second thing of the name', { [CONTENT]: `${read(CONTENT)}\nexport const told = (statement: VinciStatement): string => statement.id\n` }, /statement is declared 2 times/],
    ['the helper gone', plant(CONTENT, 'const statement = (', 'const statementOf = ('), /statement is declared 0 times/],
    ['the helper inside another function', { [CONTENT]: read(CONTENT).replace('const statement = (', 'function make() {\nconst statement = (').replace('): VinciStatement => museumStatement({ id, en, de, certainty, target, source, germanProvenance });', '): VinciStatement => museumStatement({ id, en, de, certainty, target, source, germanProvenance });\nreturn statement }') }, /not a function of the file's top level/],
  ]
  for (const [what, overlay, why] of trips) {
    const got = wiresWith(overlay).statements
    assert.equal(got.placed, false, what)
    assert.match(got.why, why, what)
  }
  // tripped, a sentence moves the fourth definition's key as it moves the third's; the built flag's wire is its own
  const [, tripped] = trips[0]
  const off = await keysAt(tripped, rerecord(store, tripped))
  assert.equal(off.placement.statements.placed, false)
  assert.equal(off.placement.built.placed, true)
  const sentence = statementEdit('picture-absence', 1, () => "'Every position.'", tripped[CONTENT])
  assert.deepEqual(movedParts(off.now, (await keysAt(sentence, rerecord(store, sentence))).now), [WORDS_PART])
  const flag = builtEdit(oneRoomBuilt, tripped[CONTENT])
  assert.equal((await keysAt(flag, rerecord(store, flag))).now.key, off.now.key, 'the flag is still left out')
})

test("the built flag's wire trips for a reader that is not audited, and the flag is read again", async () => {
  const hidden = 'header.hidden=mode===2||Boolean(closeLook?.id)||(away&&!hereContent().built)'
  const trips = [
    ['a new reader in the index', plant(INDEX, 'function standHere():void { visit?.stand(hereContent().id) }', 'function standHere():void { visit?.stand(hereContent().id);sky.visible=hereContent().built }'), /index\.ts reads a built flag in a statement that is not audited: sky\.visible=hereContent\(\)\.built/],
    ['a reader in a module that draws', { [`${WING_DIR}/study-sheet.ts`]: `${read(`${WING_DIR}/study-sheet.ts`)}\nexport const shown = (s: { built: boolean }): boolean => s.built\n` }, /study-sheet\.ts reads a built flag/],
    ['the flag taken apart', { [`${WING_DIR}/walk.ts`]: `${read(`${WING_DIR}/walk.ts`)}\nexport const open = vinciContent.map(({ built }) => built)\n` }, /walk\.ts reads a built flag/],
    ['the flag read by a string key', { [`${WING_DIR}/walk.ts`]: `${read(`${WING_DIR}/walk.ts`)}\nexport const open = vinciContent.map(station => station['built'])\n` }, /walk\.ts reads a built flag/],
    ['an audited statement that does more', plant(INDEX, hidden, hidden.replace('header.hidden=', 'header.hidden=sky.visible=')), /index\.ts reads a built flag in a statement that is not audited: header\.hidden=sky\.visible=/],
    ['an audited read a second time', plant(INDEX, hidden, `${hidden};${hidden}`), /index\.ts reads a built flag/],
    ['the flag told from more than the id', builtEdit((init) => `${init} && labels.length > 0`), /tells built from labels/],
    ['the flag set twice', builtEdit((init) => `${init},\n  ...{ built: true }`), /sets built 2 times/],
    ['the seeding helper gone', plant(CONTENT, 'const seed = (', 'const seedOf = ('), /seed is declared 0 times/],
  ]
  for (const [what, overlay, why] of trips) {
    const got = wiresWith(overlay).built
    assert.equal(got.placed, false, what)
    assert.match(got.why, why, what)
  }
  // a word changed inside an audited statement, or an audited read taken away, trips nothing
  assert.equal(wiresWith(plant(INDEX, "'Modern museum insertion · Rooms in construction'", "'A museum insertion of today · Rooms in construction'")).built.placed, true)
  assert.equal(wiresWith(plant(INDEX, "if(!s.built)header.append(make('p','vinci-status',text(vinciConstructionStatus)))", '')).built.placed, true)
  // tripped, the flag moves the fourth definition's key as it moves the third's; the statements' wire is its own
  const [, tripped] = trips[0]
  const off = await keysAt(tripped)
  assert.equal(off.placement.built.placed, false)
  assert.equal(off.placement.statements.placed, true)
  const flag = { ...tripped, ...builtEdit(oneRoomBuilt) }
  assert.deepEqual(movedParts(off.now, (await keysAt(flag, rerecord(store, flag))).now), [WORDS_PART])
  const sentence = { ...tripped, ...statementEdit('picture-absence', 1, () => "'Every position.'") }
  assert.equal((await keysAt(sentence, rerecord(store, sentence))).now.key, off.now.key, 'a sentence is still left out')
})

test('the fourth definition reads less of a words file than the third and the same of everything else: nothing is added', async () => {
  assert.equal(GLOBAL_DEFINITION, 'library-placed-v4')
  assert.deepEqual(GLOBAL_DEFINITIONS, ['v1', V2, V3, GLOBAL_DEFINITION])
  const loader = await createLoader()
  assert.deepEqual(addedParts(loader, V3, GLOBAL_DEFINITION), {}, 'nothing is added since the third')
  assert.deepEqual(addedParts(loader, V2, GLOBAL_DEFINITION), {}, 'nor since the second')
  assert.deepEqual(addedParts(loader, 'v1', GLOBAL_DEFINITION), addedParts(loader, 'v1', V3), 'since the first, what the third added')
  // on the same tree the two keys differ by the words part and the name alone
  const base = await keysAt()
  assert.deepEqual(movedParts(base.v3, base.now), ['definition', WORDS_PART])
  assert.deepEqual(Object.keys(base.now.parts).sort(), Object.keys(base.v3.parts).sort(), 'the same parts by name')
  // what the fourth reads of a words file is told by what the third reads of it: it can stand where the third moves, never move where the third stands
  for (const file of WORDS_FILES) {
    const text = read(file), out = { statement: STATEMENT_HELPERS[file] ?? null, built: BUILT_FLAGS[file] ?? null }
    assert.equal(blankDisplay(blankDisplay(text, file), file, out), blankDisplay(text, file, out), `${file}: the fourth definition's text is made from the third's`)
  }
  // with both wires tripped the fourth reads a words file exactly as the third does
  const sources = sourcesAt()
  const off = { ...base.placement, words: wordsPlacement({ sources, graph: importGraph(sources), worldFiles: new Set(worldFiles), statements: { placed: false, why: 'test' }, built: { placed: false, why: 'test' } }) }
  assert.equal(off.words[CONTENT].blanked4, off.words[CONTENT].blanked)
  assert.equal(globalKey(loader, { library: store, placement: off }).parts[WORDS_PART], base.v3.parts[WORDS_PART])
})

test('the older definitions key byte for byte as the code of 7a18ca94 keyed them', async () => {
  const then = await codeAt('7a18ca94')
  assert.equal(then.GLOBAL_DEFINITION, V2)
  const loader = await createLoader()
  const args = { library: world.library, claimed: world.claimed }
  // both sides read today's wires: a newly audited bridge moves what is placed, never how a definition keys it
  const placedNow = placeLibrary({ loader, worldFiles })
  for (const definition of ['v1', V2]) {
    const was = then.globalKey(loader, { ...args, definition, placement: placedNow })
    const is = globalKey(loader, { ...args, definition, placement: placedNow })
    assert.deepEqual(is.parts, was.parts, `${definition}: every part`)
    assert.equal(is.key, was.key, `${definition}: the key`)
    console.log(`# ${definition}: ${is.key}`)
  }
  console.log(`# ${GLOBAL_DEFINITION}: ${globalKey(loader, { ...args, placement: placedNow }).key}`)
})

test('the third definition, and the two before it, key byte for byte as the code of 852b38bc keyed them', async () => {
  const then = await codeAt('852b38bc')
  assert.equal(then.GLOBAL_DEFINITION, V3)
  const loader = await createLoader()
  const args = { library: world.library, claimed: world.claimed }
  const placedNow = placeLibrary({ loader, worldFiles })
  // the wires of that code read the tree as today's do
  const placedThen = then.placeLibrary({ loader, worldFiles })
  for (const wire of ['reader', 'table', 'bench']) assert.deepEqual(placedNow[wire], placedThen[wire], `${wire}: the same wire`)
  for (const f of WORDS_FILES) assert.deepEqual({ placed: placedNow.words[f].placed, blanked: placedNow.words[f].blanked }, placedThen.words[f], `${f}: read as that code read it`)
  for (const definition of ['v1', V2, V3]) {
    for (const placement of [placedNow, placedThen]) {
      const was = then.globalKey(loader, { ...args, definition, placement })
      const is = globalKey(loader, { ...args, definition, placement })
      assert.deepEqual(is.parts, was.parts, `${definition}: every part`)
      assert.equal(is.key, was.key, `${definition}: the key`)
    }
    console.log(`# ${definition}: ${globalKey(loader, { ...args, definition, placement: placedNow }).key}`)
  }
})
