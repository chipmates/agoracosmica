// THE LIBRARY A TREE IS KEYED WITH, AND THE RECORDS NO FRAME CAN SHOW.
//
// A revision keys with its own library: the app's manifests (`assets/<scope>/
// manifest.json`) are read from git at that revision and merged the way
// `mergeManifests()` merges the working tree. The shared store's manifests are
// not versioned anywhere and are read from disk for every revision.
//
// Two kinds of record leave the global key, each only while the tree it keys
// still proves it: the wires below read the proof off that tree every time, and
// a tripped wire puts the records back where they were.
//
//   WORDS    the display texts of a words file: every string under an `en`,
//            `de`, `…En`, `…De`, `…_en` or `…_de` property. No module of the
//            app draws text into a canvas; the only text made into geometry is
//            the vector letters', made by the letter modules from their own
//            data; a words file reaches neither.
//   READER   the flat reader's store records (the codices' pages, thumbs,
//            tiles and spreads, the Ravaisson plates): no module that can turn
//            a store record into a texture or a mesh names them or reaches the
//            codex register.
//
// Everything else a record's text or bytes can reach stays in the global key.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { APP_ROOT, WING_DIR } from './load.mjs'
import { libraryOf } from './scene.mjs'
import { APP_ASSETS, STORE, mergeManifests, storeScopes } from '../vite-na-assets.mjs'

const sha256 = (text) => createHash('sha256').update(text).digest('hex')
const git = (args, opts = {}) => execFileSync('git', ['-C', APP_ROOT, ...args], { encoding: 'utf8', maxBuffer: 1 << 28, ...opts })

/* ---- a revision's own files ---- */
function commitOf(rev) {
  const top = git(['rev-parse', '--show-toplevel']).trim()
  const prefix = path.relative(top, APP_ROOT).split(path.sep).join('/')
  const commit = git(['rev-parse', '--verify', `${rev}^{commit}`]).trim()
  return { top, prefix, commit }
}
/** Every blob under `dir` (relative to the app) at a revision, read in one batch: path -> text. */
function blobsAt(rev, dir, keep = () => true) {
  const { top, prefix, commit } = commitOf(rev)
  const rows = execFileSync('git', ['-C', top, 'ls-tree', '-r', commit, '--', `${prefix}/${dir}`], { encoding: 'utf8', maxBuffer: 1 << 28 })
    .split('\n').filter(Boolean).map((line) => { const [meta, file] = line.split('\t'); return { sha: meta.split(' ')[2], file: file.slice(prefix.length + 1) } })
    .filter((r) => keep(r.file))
  const out = new Map()
  if (!rows.length) return out
  const raw = execFileSync('git', ['-C', top, 'cat-file', '--batch'], { input: rows.map((r) => r.sha).join('\n') + '\n', maxBuffer: 1 << 30 })
  let at = 0
  for (const r of rows) {
    const nl = raw.indexOf(10, at)
    const size = Number(raw.subarray(at, nl).toString('latin1').split(' ')[2])
    out.set(r.file, raw.subarray(nl + 1, nl + 1 + size).toString('utf8'))
    at = nl + 1 + size + 1
  }
  return out
}

/**
 * THE LIBRARY OF A TREE: the working tree's merge, or a revision's (its app
 * scopes from git, the store's from disk), in the merge's own order.
 */
export function libraryAt({ rev = '' } = {}) {
  if (!rev) return libraryOf(mergeManifests())
  const appDir = path.relative(APP_ROOT, APP_ASSETS).split(path.sep).join('/')
  const app = new Map()
  for (const [file, text] of blobsAt(rev, appDir, (f) => /\/manifest\.json$/.test(f))) {
    const scope = file.slice(appDir.length + 1).split('/')
    if (scope.length === 2) app.set(scope[0], text)
  }
  const store = new Set(storeScopes())
  const assets = []
  for (const scope of [...new Set([...store, ...app.keys()])].sort()) {
    const short = scope.replace(/^wing-/, '')
    const roots = []
    if (store.has(scope)) roots.push(['store', readFileSync(path.join(STORE, scope, 'manifest.json'), 'utf8')])
    if (app.has(scope)) roots.push(['app', app.get(scope)])
    for (const [origin, text] of roots) {
      let doc
      // the merge reports an unreadable manifest and goes on without it
      try { doc = JSON.parse(text) } catch { continue }
      for (const e of Array.isArray(doc) ? doc : (doc.assets ?? [])) {
        const named = e.wing ?? scope
        assets.push({ ...e, wing: named === short ? scope : named, origin })
      }
    }
  }
  return libraryOf({ assets })
}

/** The app's sources a wire reads (`src/**` .ts and .json), at a revision or in the working tree, with planted texts over them. */
export function sourcesAt({ rev = '', overlay = {} } = {}) {
  const wanted = (f) => /\.(ts|json)$/.test(f) && !f.endsWith('.d.ts')
  let out
  if (rev) out = blobsAt(rev, 'src', wanted)
  else {
    out = new Map()
    const walk = (dir) => {
      for (const e of readdirSync(path.join(APP_ROOT, dir), { withFileTypes: true })) {
        const rel = `${dir}/${e.name}`
        if (e.isDirectory()) walk(rel)
        else if (wanted(rel)) out.set(rel, readFileSync(path.join(APP_ROOT, rel), 'utf8'))
      }
    }
    walk('src')
  }
  for (const [file, text] of Object.entries(overlay)) if (wanted(file)) out.set(file, text)
  return out
}

/* ---- the value imports of the app ---- */
/** Every value import of every module: static (not type-only), re-exports, side effects, dynamic `import()`. */
export function importGraph(sources) {
  const resolve = (from, spec) => {
    const clean = spec.replace(/\?(raw|inline|url)$/, '')
    if (!clean.startsWith('.')) return null
    const joined = path.posix.normalize(path.posix.join(path.posix.dirname(from), clean))
    return [joined, `${joined}.ts`, `${joined}/index.ts`].find((f) => sources.has(f)) ?? null
  }
  const edges = new Map()
  for (const [file, text] of sources) {
    if (!file.endsWith('.ts')) { edges.set(file, []); continue }
    const out = []
    const visit = (n) => {
      if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier)) {
        const c = n.importClause
        const named = c?.namedBindings && ts.isNamedImports(c.namedBindings) ? c.namedBindings.elements : null
        const typeOnly = c && (c.isTypeOnly || (!c.name && named && named.length > 0 && named.every((e) => e.isTypeOnly)))
        if (!typeOnly) out.push({ to: resolve(file, n.moduleSpecifier.text), names: !c ? [] : [...(c.name ? ['default'] : []), ...(named ? named.filter((e) => !e.isTypeOnly).map((e) => (e.propertyName ?? e.name).text) : c.namedBindings ? ['*'] : [])] })
      } else if (ts.isExportDeclaration(n) && n.moduleSpecifier && ts.isStringLiteral(n.moduleSpecifier) && !n.isTypeOnly) {
        out.push({ to: resolve(file, n.moduleSpecifier.text), names: n.exportClause && ts.isNamedExports(n.exportClause) ? n.exportClause.elements.filter((e) => !e.isTypeOnly).map((e) => (e.propertyName ?? e.name).text) : ['*'] })
      } else if (ts.isCallExpression(n) && n.expression.kind === ts.SyntaxKind.ImportKeyword && n.arguments[0] && ts.isStringLiteralLike(n.arguments[0])) {
        out.push({ to: resolve(file, n.arguments[0].text), names: ['*'] })
      }
      ts.forEachChild(n, visit)
    }
    visit(ts.createSourceFile(file, text, ts.ScriptTarget.ES2022, true))
    edges.set(file, out.filter((e) => e.to))
  }
  const importers = new Map()
  for (const [from, list] of edges) for (const e of list) {
    if (!importers.has(e.to)) importers.set(e.to, new Set())
    importers.get(e.to).add(from)
  }
  /** every module that imports `file` by value, directly or through others */
  const importersOf = (file) => {
    const out = new Set(), queue = [file]
    while (queue.length) for (const f of importers.get(queue.pop()) ?? []) if (!out.has(f)) { out.add(f); queue.push(f) }
    return out
  }
  /** whether `file` reaches any module of `set` along the value imports that `follow` admits */
  const reaches = (file, set, follow = () => true) => {
    const seen = new Set([file]), queue = [file]
    while (queue.length) {
      const at = queue.pop()
      for (const e of edges.get(at) ?? []) {
        if (!follow(e, at)) continue
        if (set.has(e.to)) return true
        if (!seen.has(e.to)) { seen.add(e.to); queue.push(e.to) }
      }
    }
    return false
  }
  return { edges, importers, importersOf, reaches }
}

/* ---- WORDS ---- */
/** The words files whose display texts no frame can show, while the wire holds. */
export const WORDS_FILES = [`${WING_DIR}/content.ts`, `${WING_DIR}/story.ts`, `${WING_DIR}/table/content.ts`]
/** A property whose strings are displayed text and nothing else. */
export const DISPLAY_KEY = /^(?:en|de)$|[a-z0-9](?:En|De)$|_(?:en|de)$/
/** The letter modules: the only code that makes text into geometry. */
export const LETTER_MODULES = ['words/index.ts', 'words/font.ts', 'words/outline.ts'].map((f) => `${WING_DIR}/${f}`)
const CANVAS_TEXT = /\.(?:fillText|strokeText)\s*\(/
/**
 * THE MODULES THROUGH WHICH A WORDS FILE'S VALUES MEET THE LETTER MODULES,
 * and why none of them hands a display text to a letter (audited 2026-09-30).
 * A module that imports a words file and reaches a letter module, and is not
 * named here, trips the wire.
 */
export const WORDS_BRIDGES = {
  'src/main.ts': "the app's entry: it mounts the lobby, the bench and a wing module and passes no words",
  'src/wings/registry.ts': 'loads a wing module by its slug',
  'src/bench/index.ts': 'the bench page, never mounted on the wing',
  'src/wings/vinci/table/bench/index.ts': 'the reading table\'s bench, on the bench page only',
  'src/wings/vinci/table/bench/orientation.ts': 'the reading table\'s bench, on the bench page only',
  'src/wings/vinci/table/bench/probes.ts': 'the reading table\'s bench, on the bench page only',
  'src/wings/vinci/film-wing.ts': 'the film player: the registry loads it only when the film is asked, never on the page the film is rendered from',
  'src/wings/vinci/film-look.ts': "the film player's close look, loaded by the film player alone",
  'src/wings/vinci/collection/close-look.ts': "the close look (the interface): its words draw into the page; its one canvas is the machine island, built from a machine's slug",
  'src/wings/vinci/collection/exhibits.ts': 'calls the letter modules (grave, line floor, court plaque) with their own data; it holds no words-file value (its paths to the words files are the reading table and the strip, which hand it none)',
  [`${WING_DIR}/index.ts`]: 'reaches the letter modules only through the names in INDEX_LETTER_NAMES, none of which takes a text',
}
/** What the wing's index imports from modules that reach a letter module; a new name trips the wire. */
export const INDEX_LETTER_NAMES = {
  [`${WING_DIR}/collection/exhibits.ts`]: ['mountCollectionExhibits'],
  [`${WING_DIR}/picture-words.ts`]: ['createPictureWords'],
  [`${WING_DIR}/line/index.ts`]: ['CERTAINTY'],
  [`${WING_DIR}/collection/close-look.ts`]: '*',
}
/** What the collection's exhibits import from modules that reach a words file; a new name trips the wire. */
export const EXHIBITS_WORDS_NAMES = {
  [`${WING_DIR}/table/index.ts`]: ['buildTable'],
  [`${WING_DIR}/collection/plates.ts`]: ['mountCollectionPlates'],
}
/** The parameters of the two index calls that reach the letters, as audited: a new parameter trips the wire. */
export const LETTER_CALL_PARAMETERS = {
  [`${WING_DIR}/collection/exhibits.ts`]: ['mountCollectionExhibits', 'host: Group, stack: Stack'],
  [`${WING_DIR}/picture-words.ts`]: ['createPictureWords', 'place: (layer: SVGSVGElement) => void'],
}

/** A source with every display string replaced by its position: what the file says to anything but a reader. */
export function blankDisplay(text, file = 'words.ts') {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.ES2022, true)
  const cuts = []
  const nameOf = (n) => (ts.isIdentifier(n) || ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) ? n.text : null)
  const strings = (n) => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) cuts.push([n.getStart(source), n.getEnd()])
    else if (ts.isTemplateExpression(n)) {
      cuts.push([n.head.getStart(source), n.head.getEnd()])
      for (const span of n.templateSpans) { strings(span.expression); cuts.push([span.literal.getStart(source), span.literal.getEnd()]) }
      return
    }
    ts.forEachChild(n, strings)
  }
  const visit = (n) => {
    if (ts.isPropertyAssignment(n) && DISPLAY_KEY.test(nameOf(n.name) ?? '')) { strings(n.initializer); return }
    ts.forEachChild(n, visit)
  }
  visit(source)
  let out = '', at = 0
  for (const [a, b] of cuts.sort((x, y) => x[0] - y[0])) { if (a < at) continue; out += `${text.slice(at, a)}"·"`; at = b }
  return out + text.slice(at)
}

/** The parameter text of a named function declaration, or null when none stands. */
function parametersOf(text, name) {
  const source = ts.createSourceFile('m.ts', text, ts.ScriptTarget.ES2022, true)
  let found = null
  const visit = (n) => {
    if (found !== null) return
    if (ts.isFunctionDeclaration(n) && n.name?.text === name) found = n.parameters.map((p) => p.getText(source)).join(', ')
    ts.forEachChild(n, visit)
  }
  visit(source)
  return found
}

/**
 * THE WORDS WIRE for each words file: placed (its display texts leave the
 * global key) or not, and the first reason it is not.
 *   sources      sourcesAt() of the tree
 *   graph        importGraph(sources)
 *   worldFiles   the files the world's parts read (`mountWorld().files`)
 */
export function wordsPlacement({ sources, graph, worldFiles = new Set() }) {
  const letters = new Set([...sources.keys()].filter((f) => f.endsWith('.ts') &&
    (LETTER_MODULES.includes(f) || (graph.edges.get(f) ?? []).some((e) => LETTER_MODULES.includes(e.to)) || CANVAS_TEXT.test(sources.get(f)))))
  const canvasText = [...sources].filter(([f, t]) => f.endsWith('.ts') && CANVAS_TEXT.test(t)).map(([f]) => f)
  const out = {}
  for (const file of WORDS_FILES) {
    const why = (() => {
      if (!sources.has(file)) return 'not in the tree'
      if (canvasText.length) return `text is drawn into a canvas in ${canvasText[0]}`
      if (worldFiles.has(file)) return 'a part of the world reads it'
      if (letters.has(file)) return 'it is a letter module'
      const importers = graph.importersOf(file)
      const drawer = [...importers].find((f) => letters.has(f))
      if (drawer) return `the letter module ${drawer} imports it`
      for (const bridge of importers) {
        if (!graph.reaches(bridge, letters)) continue
        if (!WORDS_BRIDGES[bridge]) return `${bridge} imports it and reaches a letter module`
      }
      // the index: only the audited names from modules that reach a letter module, and their audited parameters
      const index = `${WING_DIR}/index.ts`
      for (const e of graph.edges.get(index) ?? []) {
        if (!(letters.has(e.to) || graph.reaches(e.to, letters))) continue
        const allowed = INDEX_LETTER_NAMES[e.to]
        if (!allowed) return `the index imports ${e.names.join(', ')} from ${e.to}, which reaches a letter module`
        if (allowed !== '*' && e.names.some((n) => !allowed.includes(n))) return `the index imports ${e.names.filter((n) => !allowed.includes(n)).join(', ')} from ${e.to}`
      }
      for (const [module, [name, params]] of Object.entries(LETTER_CALL_PARAMETERS)) {
        if (!sources.has(module)) continue
        const now = parametersOf(sources.get(module), name)
        if (now !== params) return `${module}#${name} takes (${now}), audited (${params})`
      }
      // the exhibits: only the audited names from modules that reach a words file
      const exhibits = `${WING_DIR}/collection/exhibits.ts`
      const words = new Set(WORDS_FILES)
      for (const e of graph.edges.get(exhibits) ?? []) {
        if (!(words.has(e.to) || graph.reaches(e.to, words))) continue
        const allowed = EXHIBITS_WORDS_NAMES[e.to]
        if (!allowed || e.names.some((n) => !allowed.includes(n))) return `the exhibits import ${e.names.join(', ')} from ${e.to}, which reaches a words file`
      }
      return null
    })()
    out[file] = why ? { placed: false, why } : { placed: true, blanked: sha256(blankDisplay(sources.get(file), file)) }
  }
  return out
}

/* ---- READER ---- */
/** The flat reader's roles: records only the reader and the shelf's DOM show. */
export const READER_ROLES = ['codex-page', 'codex-thumb', 'codex-tiles', 'codex-spread', 'ravaisson-plate']
/** What names a reader record in code or data: a role, an id family, a store path family at a string's start. */
export const READER_SELECTOR = /codex-(?:page|thumb|tiles|spread)\b|ravaisson-plate|vinci\/(?:codex|ravaisson)-|["'`](?:wing-vinci\/)?(?:codices|ravaisson)\//
/** The codex register: the modules and data that list the reader's books and sides. */
export const READER_REGISTER = ['table/codex-shelf.ts', 'table/codex-reader.ts', 'table/data/codices.json', 'table/data/codex-sides.json'].map((f) => `${WING_DIR}/${f}`)
/** Modules that name the reader or its register and reach a texture maker, and why no reader record reaches a frame through them (audited 2026-09-30). */
export const READER_BRIDGES = {
  [`${WING_DIR}/index.ts`]: "names the register for the strip's previews and the flat reader's payload (both the page); its frame-shaping declarations name neither (checked on every tree); the leaf it hands the study's support is an ms-page or ms-thumb by id",
  [`${WING_DIR}/collection/close-look.ts`]: "the close look (the interface): its one canvas is the machine island, built from a machine's slug",
  [`${WING_DIR}/film-look.ts`]: 'the film player\'s close look, never on the page the film is rendered from',
  [`${WING_DIR}/film-wing.ts`]: 'the film player, never on the page the film is rendered from',
}
/** What makes a texture or a mesh from bytes. */
export const TEXTURE_MAKING = /new\s+Texture\s*\(|CanvasTexture|TextureLoader|KTX2Loader|GLTFLoader|createImageBitmap/
/** The store's address functions: importing only these makes no picture. */
const ADDRESS_ONLY = new Set(['assetAddress', 'assetPyramidBase', 'assetVersion', 'ASSET_BASE'])
/** The texture makers that walk the whole manifest, each with the filter that keeps a reader record out of it (audited 2026-09-30). */
export const WALKING_MAKERS = {
  [`${WING_DIR}/table/stream.ts`]: ["if (!entry.page || (entry.role !== 'ms-page' && entry.role !== 'ms-thumb')) continue"],
  'src/stack/models.ts': ['if (beside.wing !== entry.wing || beside === entry) continue'],
  [`${WING_DIR}/table/folio-shelf.ts`]: ['manifest.all.filter(entry => entry.id === RECIPE_ID)'],
}
const walksOf = (text) => (text.replace(/Promise\.all/g, '').match(/\.all\b/g) ?? []).length + (text.match(/\bforPath\s*\(/g) ?? []).length

/**
 * THE READER WIRE: whether the reader's records leave the global key, and the
 * first reason they do not.
 *   frameShaping   the texts of the index's declarations that shape a frame
 */
export function readerPlacement({ sources, graph, frameShaping = [] }) {
  const why = (() => {
    const makers = new Set([...sources].filter(([f, t]) => f.endsWith('.ts') && TEXTURE_MAKING.test(t)).map(([f]) => f))
    // a picture is made only through a texture maker; importing the store's address functions makes none
    const follow = (e) => !(e.to === 'src/stack/materials.ts' && e.names.length && e.names.every((n) => ADDRESS_ONLY.has(n)))
    const pictures = (file) => makers.has(file) || graph.reaches(file, makers, follow)
    const naming = [...sources].filter(([f, t]) => READER_SELECTOR.test(t) && !READER_REGISTER.includes(f)).map(([f]) => f)
    const namingData = new Set([...naming.filter((f) => f.endsWith('.json')), ...READER_REGISTER])
    const touching = new Set(naming.filter((f) => f.endsWith('.ts')))
    for (const data of namingData) for (const f of graph.importers.get(data) ?? []) if (!READER_REGISTER.includes(f)) touching.add(f)
    for (const f of touching) if (!READER_BRIDGES[f] && pictures(f)) return `${f} names the reader or its register and reaches a texture maker`
    for (const f of READER_REGISTER) if (f.endsWith('.ts') && sources.has(f) && pictures(f)) return `${f} (the register) reaches a texture maker`
    const registerNames = new Set((graph.edges.get(`${WING_DIR}/index.ts`) ?? []).filter((e) => READER_REGISTER.includes(e.to)).flatMap((e) => e.names))
    for (const text of frameShaping) {
      if (READER_SELECTOR.test(text)) return "a frame-shaping declaration of the index names the reader"
      for (const n of registerNames) if (new RegExp(`\\b${n}\\b`).test(text)) return `a frame-shaping declaration of the index uses ${n} of the register`
    }
    for (const f of makers) {
      const n = walksOf(sources.get(f))
      if (!n) continue
      const audited = WALKING_MAKERS[f]
      if (!audited) return `${f} makes textures and walks the whole manifest`
      if (n !== audited.length) return `${f} walks the manifest ${n} times, audited ${audited.length}`
      for (const line of audited) if (!sources.get(f).includes(line)) return `${f} no longer holds its audited filter`
    }
    return null
  })()
  return why ? { placed: false, why } : { placed: true }
}
