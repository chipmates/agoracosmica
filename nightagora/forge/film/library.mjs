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
//   TABLE    (from library-placed-v3) the reading table's page: its panel, the
//            panel's style, the codex register and the codex reader. They
//            make no picture and reach none; a module that imports them and
//            can shape a picture is audited; the table reads one value of its
//            panel, the shelf's hidden state (the folio rack stands only while
//            the shelf is shown), and that stays keyed; the panel calls the
//            table back only from a visitor's event.
//   BENCH    (from library-placed-v3) the reading table's bench: only the
//            bench page imports it, by import(), when it opens it.
//   RECORD   (from library-placed-v4) a statement's record sentences: the two
//            text arguments of a words file's own helper `statement(id, en,
//            de, …)`. They leave the file only as a statement's and a
//            station's `record`, which the sources window writes into the
//            page; the helper's parameter list is held as audited.
//   BUILT    (from library-placed-v4) a station's `built` flag, told from its
//            id alone: every read of it writes the page (the station card,
//            the phone's box, the sources window's word of certainty), and
//            every read of a property of that name in the app is audited.
//
// Everything else a record's text or bytes can reach stays in the global key.
// What no wire can see: a page module that throws while the table is built
// leaves the table unbuilt (the exhibits swallow the error) with the key where
// it was; only a check that builds the table in a browser sees that. Nor a
// station read whole (its keys walked, or written out) instead of by name.
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

/** One file of the app as a tree holds it (a revision, or the working tree), with planted texts over it; null when absent. */
export function fileAt({ rev = '', overlay = {} } = {}, file) {
  if (file in overlay) return overlay[file]
  if (rev) return blobsAt(rev, path.posix.dirname(file), (f) => f === file).get(file) ?? null
  return existsSync(path.join(APP_ROOT, file)) ? readFileSync(path.join(APP_ROOT, file), 'utf8') : null
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
/** A property whose whole value is displayed text or its absence: a stop's second layer only shows or hides "Read more". */
export const DISPLAY_WHOLE_KEY = /^drawer$/
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
  'src/wings/vinci/film-ways.ts': "the film player's plan and life controls, imported by the film player alone",
  'src/wings/vinci/film-sheets.ts': "the film player's plan and life windows, loaded by film-ways.ts on a visitor's press",
  'src/wings/vinci/film-plan.ts': "the film player's plan site, reached only through film-sheets.ts",
  'src/wings/vinci/life-record.ts': "the film player's life record, reached only through film-sheets.ts",
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

/**
 * A source with every display string replaced by its position: what the file
 * says to anything but a reader.
 *   statement   the file's audited statement helper (STATEMENT_HELPERS): the
 *               strings of its sentence arguments are blanked too
 *   built       the file's audited built flag (BUILT_FLAGS): its initializer
 *               in the seeding helper is left out
 */
export function blankDisplay(text, file = 'words.ts', { statement = null, built = null } = {}) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.ES2022, true)
  const cuts = []
  const sentences = statement ? statement.sentences.map((p) => statement.parameters.indexOf(p)) : []
  const seeding = built ? helperOf(source, built.helper).node : null
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
  const within = (n, outer) => { for (let at = n; at; at = at.parent) if (at === outer) return true; return false }
  const visit = (n) => {
    if (ts.isPropertyAssignment(n) && DISPLAY_WHOLE_KEY.test(nameOf(n.name) ?? '')) { cuts.push([n.initializer.getStart(source), n.initializer.getEnd()]); return }
    if (ts.isPropertyAssignment(n) && DISPLAY_KEY.test(nameOf(n.name) ?? '')) { strings(n.initializer); return }
    if (seeding && ts.isPropertyAssignment(n) && nameOf(n.name) === built.property && within(n, seeding)) { cuts.push([n.initializer.getStart(source), n.initializer.getEnd()]); return }
    // a call of the helper by its bare name: an argument spread before the last sentence hides which is which
    if (statement && ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === statement.name &&
      !n.arguments.slice(0, Math.max(...sentences) + 1).some(ts.isSpreadElement)) {
      n.arguments.forEach((a, i) => (sentences.includes(i) ? strings(a) : visit(a)))
      return
    }
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

/* ---- THE STATEMENT'S RECORD SENTENCES (from library-placed-v4) ---- */
/**
 * THE STATEMENT HELPER OF A WORDS FILE, as audited (2026-10-05): its name, its
 * parameters in order, and which of them are the record sentences. The helper
 * hands them to `museumStatement`, which keeps them as the statement's
 * `record`; a station's `record` is its statement's, or two of them joined.
 * Both are read in STATEMENT_RECORD_READERS and nowhere else, and the way
 * there is the file's own code, which stays keyed. A changed parameter list
 * trips the wire, so no new argument slips into the blanked range unseen.
 */
export const STATEMENT_HELPERS = {
  [`${WING_DIR}/content.ts`]: { name: 'statement', parameters: ['id', 'en', 'de', 'certainty', 'target', 'source', 'germanProvenance'], sentences: ['en', 'de'] },
}
/** Every read of a statement's or a station's `record` (audited 2026-10-05, by the compiler's types), by the function it stands in: each writes the sentence into a paragraph of the sources window. */
export const STATEMENT_RECORD_READERS = {
  [`${WING_DIR}/index.ts`]: {
    appendLabel: 'label.record??label, handed to appendStatement and on to appendRecord: a text node of the full record',
    appendSourceStatement: 'label.record??label: a paragraph of the folded record',
    paintRoomSources: 'station.record??station.promise: a paragraph of the room tab',
    paintDock: 's.record??s.promise, handed to appendRecord: a text node of the full record',
  },
  [`${WING_DIR}/film-wing.ts`]: {
    paintSources: 's.record ?? s.promise: a paragraph of the station tab',
    statement: 'label.record ?? label: a paragraph of the folded record',
    paintRoomAndWing: 'station.record ?? station.promise: a paragraph of the room tab',
  },
}

/** A name's one declaration in a source when it is a function of the file's own top level: { node, parameters }, or { why }. */
function helperOf(source, name) {
  const bound = []
  const visit = (n) => {
    if (ts.isIdentifier(n) && n.text === name && n.parent.name === n && (ts.isVariableDeclaration(n.parent) || ts.isFunctionDeclaration(n.parent) || ts.isFunctionExpression(n.parent) ||
      ts.isParameter(n.parent) || ts.isBindingElement(n.parent) || ts.isImportSpecifier(n.parent) || ts.isImportClause(n.parent) || ts.isNamespaceImport(n.parent) || ts.isClassDeclaration(n.parent))) bound.push(n.parent)
    ts.forEachChild(n, visit)
  }
  visit(source)
  if (bound.length !== 1) return { why: `${name} is declared ${bound.length} times` }
  const [d] = bound
  const top = ts.isFunctionDeclaration(d) ? d.parent === source : ts.isVariableDeclaration(d) && d.parent.parent.parent === source
  const node = ts.isFunctionDeclaration(d) ? d : ts.isVariableDeclaration(d) && d.initializer && (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer)) ? d.initializer : null
  if (!top || !node) return { why: `${name} is not a function of the file's top level` }
  return { node, parameters: node.parameters.map((p) => `${p.dotDotDotToken ? '...' : ''}${p.name.getText(source)}`) }
}

/** THE STATEMENTS' WIRE: whether the record sentences leave the global key, and the first reason they do not. */
export function statementsPlacement({ sources }) {
  const why = (() => {
    for (const [file, audited] of Object.entries(STATEMENT_HELPERS)) {
      if (!sources.has(file)) return `${file} is not in the tree`
      const found = helperOf(parse(file, sources.get(file)), audited.name)
      if (found.why) return `${file}: ${found.why}`
      if (found.parameters.join(', ') !== audited.parameters.join(', ')) return `${file}#${audited.name} takes (${found.parameters.join(', ')}), audited (${audited.parameters.join(', ')})`
    }
    return null
  })()
  return why ? { placed: false, why } : { placed: true }
}

/* ---- THE STATION'S BUILT FLAG (from library-placed-v4) ---- */
/** THE BUILT FLAG OF A WORDS FILE, as audited (2026-10-05): the helper that seeds a station, the property, and the only names its initializer may hold (a station's id, tested against a list). */
export const BUILT_FLAGS = { [`${WING_DIR}/content.ts`]: { helper: 'seed', property: 'built', names: ['id', 'includes'] } }
/**
 * EVERY STATEMENT OF THE APP THAT READS A PROPERTY NAMED `built` (audited
 * 2026-10-05, by the compiler's types): the statement with its strings
 * blanked, the type whose flag it reads, and what it does with it. A
 * station's flag only writes the page; the other three flags of that name are
 * not a station's. A read that is not here trips the wire, and so does a
 * statement changed around one.
 */
export const BUILT_READS = {
  [`${WING_DIR}/index.ts`]: [
    ['if(id.startsWith("·")&&!s.built&&!vinciStandsInRoom(s.id))header.append(make("·","·",lang()==="·"?"·":"·"))', 'VinciStationContent', 'showView: a line of the station card'],
    ['dot.dataset["·"]=s.built?s.carrierCertainty:"·"', 'VinciStationContent', "paintHeader: the colour of the card's dot"],
    ['dot.setAttribute("·",text(vinciCertaintyWords[s.built?s.carrierCertainty:"·"]))', 'VinciStationContent', "paintHeader: the dot's spoken name"],
    ['header.classList.toggle("·",!standing&&!s.built)', 'VinciStationContent', "paintHeader: the card's centred form"],
    ['if(!s.built)header.append(make("·","·",text(vinciConstructionStatus)))', 'VinciStationContent', "paintHeader: the card's status line"],
    ['header.hidden=mode===2||Boolean(closeLook?.id)||(away&&!hereContent().built)', 'VinciStationContent', "paintHeaderVisibility: the card's hidden flag, read back by the hand's landing place, the marks' boxes and the sheet's foot (all the page)"],
    ['phone.show(Boolean(closeLook?.id)||!(away&&!hereContent().built))', 'VinciStationContent', "paintHeaderVisibility: the phone box's hidden flag, read back by the same three"],
    ['const certainty=exhibitSources?.certainty??(s.built?s.carrierCertainty:"·")', 'VinciStationContent', "paintDock: the sources window's word of certainty"],
  ],
  [`${WING_DIR}/film-wing.ts`]: [
    ['const certainty = exhibit?.certainty ?? (s.built ? s.carrierCertainty : "·")', 'VinciStationContent', "paintSources: the sources window's word of certainty"],
  ],
  'src/wings/plan/plate.ts': [
    ['rect.dataset["·"] = String(room.built)', 'PlanRoom', "drawPlanPlate: the plan's own room, into the plate's data attribute"],
    ['line.dataset["·"] = String(shape.built)', 'PlanShape', "drawPlanPlate: the plan's own shape, into the plate's data attribute"],
  ],
  [`${WING_DIR}/leaf-litter.ts`]: [
    ['const lee = c.built && plan.walked(foot[0], foot[1]) && nearCourt(foot) ? 2.6 : 1', 'Run', "layLitter: the litter's own run, flagged where the runs are made"],
  ],
}
/** The innermost statement that holds a node. */
export function statementOf(n) {
  let at = n
  while (at.parent && !ts.isStatement(at)) at = at.parent
  return at
}
/** A statement with its strings blanked and its spaces run together: what it does, whatever it says. */
export function statementShape(statement, source) {
  const from = statement.getStart(source), cuts = []
  const strings = (x) => { if (ts.isStringLiteralLike(x)) cuts.push([x.getStart(source) - from, x.getEnd() - from]); else ts.forEachChild(x, strings) }
  strings(statement)
  const text = statement.getText(source)
  let out = '', pos = 0
  for (const [a, b] of cuts) { out += `${text.slice(pos, a)}"·"`; pos = b }
  return (out + text.slice(pos)).replace(/\s+/g, ' ').replace(/;$/, '').trim()
}
/** Every statement of the app's sources that reads a property named `name` (by name, by a string key, or by taking it apart): [file, shape] in the order they stand. */
export function propertyReads(sources, name) {
  const out = []
  const word = new RegExp(`\\b${name}\\b`)
  for (const [file, text] of sources) {
    if (!file.endsWith('.ts') || !word.test(text)) continue
    const source = parse(file, text), held = new Set()
    const visit = (n) => {
      const read = (ts.isPropertyAccessExpression(n) && n.name.text === name) ||
        (ts.isElementAccessExpression(n) && ts.isStringLiteralLike(n.argumentExpression) && n.argumentExpression.text === name) ||
        (ts.isBindingElement(n) && ts.isObjectBindingPattern(n.parent) && (n.propertyName ?? n.name).getText(source) === name)
      const statement = read ? statementOf(n) : null
      if (statement && !held.has(statement)) { held.add(statement); out.push([file, statementShape(statement, source)]) }
      ts.forEachChild(n, visit)
    }
    visit(source)
  }
  return out
}

/** THE BUILT FLAG'S WIRE: whether a station's `built` leaves the global key, and the first reason it does not. */
export function builtPlacement({ sources }) {
  const why = (() => {
    for (const [file, audited] of Object.entries(BUILT_FLAGS)) {
      if (!sources.has(file)) return `${file} is not in the tree`
      const source = parse(file, sources.get(file))
      const seeding = helperOf(source, audited.helper)
      if (seeding.why) return `${file}: ${seeding.why}`
      const flags = []
      const find = (n) => { if (ts.isPropertyAssignment(n) && (ts.isIdentifier(n.name) || ts.isStringLiteral(n.name)) && n.name.text === audited.property) flags.push(n); ts.forEachChild(n, find) }
      find(seeding.node)
      if (flags.length !== 1) return `${file}#${audited.helper} sets ${audited.property} ${flags.length} times`
      // told from the station's id alone: nothing else is named in it
      const names = []
      const named = (n) => { if (ts.isIdentifier(n)) names.push(n.text); ts.forEachChild(n, named) }
      named(flags[0].initializer)
      const other = names.find((n) => !audited.names.includes(n))
      if (other) return `${file}#${audited.helper} tells ${audited.property} from ${other}`
    }
    // every read of a property of that name is an audited one, in its audited statement
    const left = Object.fromEntries(Object.entries(BUILT_READS).map(([file, list]) => [file, list.map(([shape]) => shape)]))
    for (const [file, shape] of propertyReads(sources, 'built')) {
      const at = (left[file] ?? []).indexOf(shape)
      if (at < 0) return `${file} reads a built flag in a statement that is not audited: ${shape.slice(0, 120)}`
      left[file].splice(at, 1)
    }
    return null
  })()
  return why ? { placed: false, why } : { placed: true }
}

/* ---- THE WORDS WIRE ---- */
/** What the fourth definition leaves out of a words file besides its display texts, while each wire holds. */
function leftOut(file, statements, built) {
  return { statement: statements.placed ? STATEMENT_HELPERS[file] ?? null : null, built: built.placed ? BUILT_FLAGS[file] ?? null : null }
}

/**
 * THE WORDS WIRE for each words file: placed (its display texts leave the
 * global key) or not, and the first reason it is not. `blanked` is the file as
 * the second and third definitions read it; `blanked4` as the fourth does,
 * without the record sentences and the built flag while their wires hold.
 *   sources      sourcesAt() of the tree
 *   graph        importGraph(sources)
 *   worldFiles   the files the world's parts read (`mountWorld().files`)
 *   statements   statementsPlacement() of the tree
 *   built        builtPlacement() of the tree
 */
export function wordsPlacement({ sources, graph, worldFiles = new Set(), statements = statementsPlacement({ sources }), built = builtPlacement({ sources }) }) {
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
    out[file] = why ? { placed: false, why } : { placed: true, blanked: sha256(blankDisplay(sources.get(file), file)), blanked4: sha256(blankDisplay(sources.get(file), file, leftOut(file, statements, built))) }
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

/* ---- THE TABLE'S PAGE ---- */
/** The reading table's page modules: the panel, its style, the codex register
    and the codex reader. Records whose recipe files these are leave the global
    key while the table's wire holds. */
export const TABLE_DOM_FILES = ['panel.ts', 'panel.css', 'codex-shelf.ts', 'codex-reader.ts', 'data/codices.json', 'data/codex-sides.json']
  .map((f) => `${WING_DIR}/table/${f}`)
const TABLE_PANEL = `${WING_DIR}/table/panel.ts`, TABLE_PANEL_CSS = `${WING_DIR}/table/panel.css`
const TABLE_REGISTER = `${WING_DIR}/table/codex-shelf.ts`, TABLE_INDEX = `${WING_DIR}/table/index.ts`
/** What can make or change a picture the renderer draws: three.js by value, a texture maker, a drawing context. */
const THREE_VALUE = /^\s*import\s+(?!type\b)[^'"]*?from\s+['"]three(?:\/[^'"]*)?['"]/m
const SCENE_MAKING = (text) => THREE_VALUE.test(text) || TEXTURE_MAKING.test(text) || /\.getContext\s*\(/.test(text)
/**
 * THE MODULES THAT IMPORT A PAGE MODULE, DIRECTLY OR THROUGH OTHERS, AND CAN
 * SHAPE A PICTURE, and why none hands a frame a value of the page (audited
 * 2026-09-30). A new one trips the wire.
 */
export const TABLE_DOM_BRIDGES = {
  'src/main.ts': "the app's entry: it mounts the lobby, the bench and a wing module and passes none of the page",
  'src/wings/registry.ts': 'loads a wing module by its slug',
  'src/bench/index.ts': 'the bench page, never mounted on the wing',
  [`${WING_DIR}/table/bench/index.ts`]: "the reading table's bench, on the bench page only",
  [`${WING_DIR}/table/bench/orientation.ts`]: "the reading table's bench, on the bench page only",
  [`${WING_DIR}/table/bench/probes.ts`]: "the reading table's bench, on the bench page only",
  [`${WING_DIR}/film-wing.ts`]: 'the film player, never on the page the film is rendered from',
  [`${WING_DIR}/film-look.ts`]: "the film player's close look, never on the page the film is rendered from",
  [`${WING_DIR}/film-ways.ts`]: "the film player's plan and life controls, imported by the film player alone, never on the page the film is rendered from",
  [`${WING_DIR}/film-sheets.ts`]: "the film player's plan and life windows, loaded by film-ways.ts on a visitor's press, never on the page the film is rendered from",
  [`${WING_DIR}/collection/exhibits.ts`]: 'builds the table (only buildTable, checked) and calls its update; it reads neither the panel nor the shelf of what it builds (checked)',
  [TABLE_INDEX]: "builds the panel (createPanel); its drawing reads one value of it, the shelf's hidden state, keyed as its own part; every read of the panel is one of TABLE_PANEL_READS (checked); the panel calls it back only from a visitor's event (checked)",
  [`${WING_DIR}/index.ts`]: "names the register, the codex reader and the edition reader for the strip and the flat readers (the page); its frame-shaping declarations use no name it takes from a module that reaches the page modules, save TABLE_FRAME_PATH's (checked on every tree)",
  [`${WING_DIR}/table/reader.ts`]: "the edition's flat reader payload, made when a visitor opens the book; the index's frame-shaping declarations never make it (checked)",
}
/** The names the index's frame-shaping declarations may take from a module that reaches the page: the table's own build, whose way to the panel is audited above. */
export const TABLE_FRAME_PATH = { [`${WING_DIR}/collection/exhibits.ts`]: ['mountCollectionExhibits'] }
/** What the collection's exhibits take from the table's module. */
export const EXHIBITS_TABLE_NAMES = ['buildTable']
/** Every way the table reads its panel (audited 2026-09-30): the element's data, its hidden flag and text (the page and the bench), the panel's update, showShelf and dispose, the shelf handed out, and the shelf's hidden state, the one value the drawing reads (the folio rack stands only while the shelf is shown). */
export const TABLE_PANEL_READS = ['panel', 'panel.element.dataset', 'panel.element.hidden', 'panel.element.innerText', 'panel.update', 'panel.showShelf', 'panel.shelf', 'panel.shelf.hidden', 'panel.dispose']
/** The table's callbacks inside the page modules: called only from a visitor's event. */
export const TABLE_CALLBACKS = { [TABLE_PANEL]: ['createPanel', ['onOpen']], [TABLE_REGISTER]: ['buildCodexList', ['onOpen', 'onBook']] }

const parse = (file, text) => ts.createSourceFile(file, text, ts.ScriptTarget.ES2022, true)
/** A name as it is referred to: not a property name, not an object key. */
function referenceOf(n) {
  const p = n.parent
  if (ts.isPropertyAccessExpression(p) && p.name === n) return false
  if ((ts.isPropertyAssignment(p) || ts.isMethodDeclaration(p) || ts.isPropertyDeclaration(p)) && p.name === n) return false
  return true
}
/** The statement of a function's (or the file's) own body that holds a node. */
function bodyStatement(n) {
  let at = n
  while (at.parent && !(ts.isSourceFile(at.parent) || (ts.isBlock(at.parent) && at.parent.parent && ts.isFunctionLike(at.parent.parent)))) at = at.parent
  return at
}
const isListener = (fn) => ts.isCallExpression(fn.parent) && fn.parent.arguments.includes(fn) &&
  ts.isPropertyAccessExpression(fn.parent.expression) && fn.parent.expression.name.text === 'addEventListener'

/** THE PANEL'S SHELF STATE: the statements that set the shelf's hidden flag, or why the panel uses its shelf another way. */
export function shelfState(text) {
  const source = parse(TABLE_PANEL, text)
  const held = new Map()
  let why = null
  const visit = (n) => {
    if (why) return
    if (ts.isIdentifier(n) && (n.text === 'shelf' || n.text === 'shelfShown') && referenceOf(n)) {
      const p = n.parent
      const keep = () => { const s = bodyStatement(n); held.set(s.getStart(source), s.getText(source)) }
      if (n.text === 'shelfShown' || (ts.isVariableDeclaration(p) && p.name === n)) keep()
      else if (ts.isShorthandPropertyAssignment(p)) { /* handed to the table */ }
      else if (ts.isPropertyAccessExpression(p) && p.expression === n) {
        const name = p.name.text, call = ts.isCallExpression(p.parent) && p.parent.expression === p ? p.parent : null
        if (name === 'hidden') keep()
        else if (name === 'lang' && ts.isBinaryExpression(p.parent) && p.parent.left === p && p.parent.operatorToken.kind === ts.SyntaxKind.EqualsToken) { /* its language */ }
        else if (call && ['append', 'replaceChildren', 'remove'].includes(name)) { /* its content */ }
        else if (call && name === 'setAttribute' && ts.isStringLiteral(call.arguments[0]) && !/^hidden$/i.test(call.arguments[0].text)) { /* an attribute */ }
        else why = `the panel uses its shelf as ${p.parent.getText(source).slice(0, 80)}`
      } else why = `the panel uses its shelf as ${p.getText(source).slice(0, 80)}`
    }
    ts.forEachChild(n, visit)
  }
  visit(source)
  if (why) return { why }
  if (![...held.values()].some((s) => /\bshelf\.hidden\b/.test(s))) return { why: 'the panel sets no hidden state of its shelf' }
  const statements = [...held].sort(([a], [b]) => a - b).map(([, s]) => s)
  return { key: sha256(statements.join('\n')), statements }
}

/** Why a callback of the table is called outside a visitor's event, or null. */
function callbacksHeld(file, text, [owner, names]) {
  const source = parse(file, text)
  let fn = null
  const find = (n) => { if (!fn && ts.isFunctionDeclaration(n) && n.name?.text === owner) fn = n; if (!fn) ts.forEachChild(n, find) }
  find(source)
  if (!fn) return `${file} declares no ${owner}`
  const params = fn.parameters.map((p) => p.name.getText(source))
  for (const name of names) if (!params.includes(name)) return `${file}#${owner} takes no ${name}`
  let why = null
  const enclosing = (n) => { let at = n.parent; while (at && !ts.isFunctionLike(at)) at = at.parent; return at }
  /** a reference that is only tested for being there */
  const tested = (n) => {
    let at = n
    while (ts.isParenthesizedExpression(at.parent) || (ts.isPrefixUnaryExpression(at.parent) && at.parent.operator === ts.SyntaxKind.ExclamationToken) ||
      (ts.isBinaryExpression(at.parent) && at.parent.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken)) at = at.parent
    return at !== n && ((ts.isConditionalExpression(at.parent) && at.parent.condition === at) || (ts.isIfStatement(at.parent) && at.parent.expression === at))
  }
  /** a closure a visitor's event runs: an event's listener, or a const handed only to one (and tested before) */
  const onEvent = (f) => {
    if (!f || f === fn) return false
    if (isListener(f)) return true
    let d = f.parent
    while (d && (ts.isConditionalExpression(d) || ts.isParenthesizedExpression(d))) d = d.parent
    if (!d || !ts.isVariableDeclaration(d) || !ts.isIdentifier(d.name)) return false
    const local = d.name.text
    let only = true
    const uses = (n) => {
      if (ts.isIdentifier(n) && n.text === local && n !== d.name && referenceOf(n)) {
        const p = n.parent
        const listener = ts.isCallExpression(p) && p.arguments.includes(n) && ts.isPropertyAccessExpression(p.expression) && p.expression.name.text === 'addEventListener'
        const tested = ts.isIfStatement(p) && p.expression === n
        if (!listener && !tested) only = false
      }
      ts.forEachChild(n, uses)
    }
    uses(enclosing(d) ?? source)
    return only
  }
  const visit = (n) => {
    if (why) return
    if (ts.isIdentifier(n) && names.includes(n.text) && referenceOf(n) && !(ts.isParameter(n.parent) && n.parent.name === n)) {
      const p = n.parent
      if (ts.isCallExpression(p) && p.expression === n) { if (!onEvent(enclosing(n))) why = `${file} calls ${n.text} outside a visitor's event` }
      else if (tested(n)) { /* only whether it was given */ }
      else if (ts.isCallExpression(p) && p.arguments.includes(n) && ts.isIdentifier(p.expression) && TABLE_CALLBACKS[TABLE_REGISTER][0] === p.expression.text) { /* handed to the register's list */ }
      else why = `${file} hands ${n.text} on as ${p.getText(source).slice(0, 80)}`
    }
    ts.forEachChild(n, visit)
  }
  visit(fn)
  return why
}

/** Why the table reads its panel another way than audited, or null. */
function panelReads(text) {
  const source = parse(TABLE_INDEX, text)
  let why = null, made = 0
  const visit = (n) => {
    if (why) return
    if (ts.isIdentifier(n) && n.text === 'panel' && referenceOf(n)) {
      const p = n.parent
      if (ts.isVariableDeclaration(p) && p.name === n) {
        made++
        if (!(p.initializer && ts.isCallExpression(p.initializer) && p.initializer.expression.getText(source) === 'createPanel')) why = 'the table names another panel than createPanel\'s'
      } else {
        let path = 'panel', at = n
        while (ts.isPropertyAccessExpression(at.parent) && at.parent.expression === at) { at = at.parent; path += `.${at.name.text}` }
        const bare = at === n
        if (!TABLE_PANEL_READS.includes(path)) why = `the table reads ${path}`
        else if (bare && !ts.isShorthandPropertyAssignment(p)) why = `the table hands its panel on as ${p.getText(source).slice(0, 80)}`
        else if (path === 'panel.shelf' && !ts.isPropertyAssignment(at.parent)) why = `the table hands the shelf on as ${at.parent.getText(source).slice(0, 80)}`
      }
    }
    ts.forEachChild(n, visit)
  }
  visit(source)
  return why ?? (made === 1 ? null : `the table makes ${made} panels`)
}

/** Why a stylesheet may style anything but the panel's own elements, or null. */
export function panelStyleScoped(css) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '')
  let at = 0, depth = 0
  const groups = []
  while (at < text.length) {
    const open = text.indexOf('{', at), close = text.indexOf('}', at)
    if (open < 0 || (close >= 0 && close < open)) { if (close < 0) break; depth--; if (groups.length > depth) groups.length = depth; at = close + 1; continue }
    const prelude = text.slice(at, open).trim()
    at = open + 1
    depth++
    if (prelude.startsWith('@')) {
      if (!/^@(?:media|container|supports)\b/.test(prelude)) return `an at-rule ${prelude.slice(0, 40)}`
      groups[depth - 1] = true
      continue
    }
    const selectors = []
    let cur = '', paren = 0
    for (const ch of prelude) { if (ch === '(') paren++; if (ch === ')') paren--; if (ch === ',' && !paren) { selectors.push(cur); cur = '' } else cur += ch }
    selectors.push(cur)
    for (const s of selectors) {
      // scoped: a compound names a class of the panel's own, and every step after it goes down into it
      const flat = s.replace(/\([^()]*\)/g, '()').replace(/\([^()]*\)/g, '()').trim()
      const steps = flat.split(/(\s*[>+~]\s*|\s+)/).map((x) => (x.trim() === '' && x !== '' ? ' ' : x.trim()))
      let inside = false
      for (let i = 0; i < steps.length; i += 2) {
        if (/\.(?:vt|vinci-table)-[\w-]+/.test(steps[i])) inside = true
        else if (i > 0 && !(steps[i - 1] === ' ' || steps[i - 1] === '>')) inside = false
      }
      if (!inside) return `the selector ${s.trim().slice(0, 60)} styles more than the panel`
    }
    const end = text.indexOf('}', at)
    if (end < 0) return 'a rule without its end'
    if (text.slice(at, end).includes('{')) return `a nested rule in ${prelude.slice(0, 40)}`
    at = end + 1
    depth--
  }
  return null
}

/** The value imports of a module with the names they bind here, resolved in the tree. */
function importsHere(sources, file) {
  const out = []
  const resolve = (spec) => {
    const clean = spec.replace(/\?(raw|inline|url)$/, '')
    if (!clean.startsWith('.')) return null
    const joined = path.posix.normalize(path.posix.join(path.posix.dirname(file), clean))
    return [joined, `${joined}.ts`, `${joined}/index.ts`].find((f) => sources.has(f)) ?? null
  }
  const visit = (n) => {
    if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier)) {
      const c = n.importClause
      if (!c?.isTypeOnly) {
        const named = c?.namedBindings
        const locals = !c ? [] : [...(c.name ? [c.name.text] : []), ...(named && ts.isNamespaceImport(named) ? ['*'] : []),
          ...(named && ts.isNamedImports(named) ? named.elements.filter((e) => !e.isTypeOnly).map((e) => e.name.text) : [])]
        out.push({ to: resolve(n.moduleSpecifier.text), locals, dynamic: false })
      }
    } else if (ts.isExportDeclaration(n) && n.moduleSpecifier && ts.isStringLiteral(n.moduleSpecifier) && !n.isTypeOnly) out.push({ to: resolve(n.moduleSpecifier.text), locals: ['*'], dynamic: false })
    else if (ts.isCallExpression(n) && n.expression.kind === ts.SyntaxKind.ImportKeyword && n.arguments[0] && ts.isStringLiteralLike(n.arguments[0])) out.push({ to: resolve(n.arguments[0].text), locals: ['*'], dynamic: true })
    ts.forEachChild(n, visit)
  }
  visit(parse(file, sources.get(file)))
  return out.filter((e) => e.to)
}

/**
 * THE TABLE'S WIRE: whether the page modules' records leave the global key,
 * the first reason they do not, and the panel's shelf state the key keeps.
 *   frameShaping   the texts of the index's declarations that shape a frame
 */
export function tablePlacement({ sources, graph, worldFiles = new Set(), frameShaping = [], css = null }) {
  const why = (() => {
    const group = new Set(TABLE_DOM_FILES)
    for (const f of TABLE_DOM_FILES) if (f !== TABLE_PANEL_CSS && !sources.has(f)) return `${f} is not in the tree`
    for (const f of TABLE_DOM_FILES) if (worldFiles.has(f)) return `a part of the world reads ${f}`
    // the page makes no picture, nor anything it imports
    const scene = new Set([...sources].filter(([f, t]) => f.endsWith('.ts') && SCENE_MAKING(t)).map(([f]) => f))
    const follow = (e) => !(e.to === 'src/stack/materials.ts' && e.names.length && e.names.every((n) => ADDRESS_ONLY.has(n)))
    const shapes = (f) => scene.has(f) || graph.reaches(f, scene, follow)
    for (const f of TABLE_DOM_FILES) if (f.endsWith('.ts') && shapes(f)) return `${f} makes or reaches a picture`
    // every importer that can shape a picture is audited
    for (const f of TABLE_DOM_FILES) for (const x of graph.importersOf(f)) {
      if (!group.has(x) && !TABLE_DOM_BRIDGES[x] && shapes(x)) return `${x} reaches ${f} and a picture`
    }
    // the stylesheet: the panel's alone, and scoped to its own elements
    for (const [f, t] of sources) {
      if (f === TABLE_PANEL || !f.endsWith('.ts')) continue
      for (const m of t.matchAll(/from\s+['"](\.[^'"]*panel\.css)(?:\?[a-z]+)?['"]/g)) {
        if (path.posix.normalize(path.posix.join(path.posix.dirname(f), m[1])) === TABLE_PANEL_CSS) return `${f} imports the panel's stylesheet`
      }
    }
    if (css === null) return "the panel's stylesheet is not in the tree"
    const style = panelStyleScoped(css)
    if (style) return `the panel's stylesheet: ${style}`
    // the exhibits build the table and read nothing of its page
    const exhibits = `${WING_DIR}/collection/exhibits.ts`
    for (const e of graph.edges.get(exhibits) ?? []) if (e.to === TABLE_INDEX && e.names.some((n) => !EXHIBITS_TABLE_NAMES.includes(n))) return `the exhibits import ${e.names.join(', ')} from the table`
    if (/\.(?:panel|shelf)\b/.test(sources.get(exhibits) ?? '')) return 'the exhibits read a panel or a shelf'
    // the table reads its panel only as audited, and is called back only from an event
    const read = panelReads(sources.get(TABLE_INDEX) ?? '')
    if (read) return read
    for (const [file, spec] of Object.entries(TABLE_CALLBACKS)) { const w = callbacksHeld(file, sources.get(file), spec); if (w) return w }
    // the index's frame-shaping declarations take nothing of the page
    const index = `${WING_DIR}/index.ts`
    for (const e of importsHere(sources, index)) {
      if (!(group.has(e.to) || graph.reaches(e.to, group))) continue
      if (e.locals.includes('*')) return `the index imports the whole of ${e.to}, which reaches the table's page`
      const free = TABLE_FRAME_PATH[e.to] ?? []
      for (const n of e.locals) if (!free.includes(n) && frameShaping.some((t) => new RegExp(`\\b${n}\\b`).test(t))) return `a frame-shaping declaration of the index uses ${n} of ${e.to}`
    }
    return null
  })()
  if (why) return { placed: false, why }
  const shelf = shelfState(sources.get(TABLE_PANEL))
  return shelf.why ? { placed: false, why: shelf.why } : { placed: true, shelf: shelf.key }
}

/* ---- THE TABLE'S BENCH ---- */
/** The reading table's bench: records whose recipe files these are leave the global key while no page but the bench's opens them. */
export const TABLE_BENCH_FILES = ['bench/index.ts', 'bench/probes.ts', 'bench/table-bench.css', 'bench-content.ts'].map((f) => `${WING_DIR}/table/${f}`)
const inBench = (f) => f.startsWith(`${WING_DIR}/table/bench/`) || f === `${WING_DIR}/table/bench-content.ts`
/** The modules that may import the bench, and how (audited 2026-09-30). */
export const TABLE_BENCH_OPENERS = { 'src/bench/index.ts': 'the bench page: it imports a kind by import() only when the bench opens it, which the wing never does' }

/** THE BENCH'S WIRE: whether the bench's records leave the global key, and the first reason they do not. */
export function benchPlacement({ sources, graph, worldFiles = new Set() }) {
  const why = (() => {
    for (const f of TABLE_BENCH_FILES) if (worldFiles.has(f)) return `a part of the world reads ${f}`
    for (const [f, t] of sources) {
      if (inBench(f) || !f.endsWith('.ts')) continue
      if (/table-bench\.css|bench-content/.test(t)) return `${f} names a file of the bench`
      for (const e of graph.edges.get(f) ?? []) {
        if (!inBench(e.to)) continue
        if (!TABLE_BENCH_OPENERS[f]) return `${f} imports the bench`
        if (importsHere(sources, f).some((i) => inBench(i.to) && !i.dynamic)) return `${f} imports the bench when it loads`
      }
    }
    return null
  })()
  return why ? { placed: false, why } : { placed: true }
}
