// THE FOUR KEYS OF EVERY CLIP AND EVERY STILL, from a tree, in node
// (design §5.1). A key names what made the frames; the gate holds the keys a
// release was rendered with against the keys the tree gives now.
//
//   MOTION    the camera track replayed on the harness clock (`replay.mjs`)
//   PICTURE   the cells the clip can show, each by what is drawn in it
//             (`scene.mjs`, `seen.mjs`), and the exposure at its two ends
//   GLOBAL    the stack, the print, the light, the sky, the recipe, and the
//             library sets no plate claims that a frame can draw
//   DELIVERY  the job image, the encoder and the rungs; a clip exempt from
//             its byte line says so
//
// A text change moves none of them: no interface word is in a frame.
import { createHash } from 'node:crypto'
import ts from 'typescript'
// film-check imports this module back: read its exports inside functions only
import { BYTE_EXEMPT, byteExempt } from './film-check.mjs'
import { FILM_PACE, FPS, FRAMINGS, buildGraph } from './graph.mjs'
import { WING_DIR, createLoader } from './load.mjs'
import { canonicalPrint, openReplay, replayEdge, trackKey } from './replay.mjs'
import { mountWorld } from './scene.mjs'
import { buildIndex, seenSet } from './seen.mjs'
import { eveningTrack } from './evening.mjs'

export const KEYS_FORMAT = 'vinci-film-keys-v1'
const sha256 = (text) => createHash('sha256').update(text).digest('hex')
const short = (text) => sha256(text).slice(0, 32)

/** How a frame is made (§4.2). The export reads its recipe from here. */
export const RECIPE = {
  tier: 'max', geometry: 'hero', pixelRatio: 2, subframes: 8, jitter: 'halton-2-3', shutterDeg: 180,
  grain: 'held', fps: FPS, pace: FILM_PACE, framings: Object.fromEntries(Object.entries(FRAMINGS).map(([k, f]) => [k, [f.width, f.height]])),
}
/** How a clip is delivered (§6). The job image's digest is W4's; until the
    box has one, the Mac's renderer is named. */
export const DELIVERY = {
  image: 'unset: the job image digest arrives with the box (W4)',
  codec: 'h264 high 8-bit 4:2:0 +faststart', crf: 23, ends: { frames: 3, crf: 12 }, keyint: 30, aq: 3,
  vbv: 'each rung capped under its byte line: a buffer of one second, 0.9 full at the start, the rate over the clip',
  colour: 'bt709 matrix, transfer tagged', x264Threads: 'fixed',
  rungs: { wide: ['1920x1080', '1280x720', '854x480'], upright: ['720x1558', '480x1038'] },
  still: { format: 'png', rungs: { wide: ['1920x1080'], upright: ['720x1558'] }, marks: ['en', 'de'] },
}

/* ---- what the wing's index file holds for the picture, read by name ---- */
const INDEX_FILE = `${WING_DIR}/index.ts`
/** the print, the station exposures and the light rig stand in their own module */
const PRINT_FILE = `${WING_DIR}/print.ts`
/** the wing's files a declaration of the picture may stand in, in order */
const DECLARING_FILES = [INDEX_FILE, PRINT_FILE]
/** the text the named declarations are read from: every declaring file the tree holds */
const declaringText = (loader) => DECLARING_FILES.map((f) => { try { return loader.text(f) } catch { return '' } }).join('\n')
/** The declarations of the wing's index that shape every frame: the print,
    the shadow, the light rig, and the generator that assembles the house. */
const GLOBAL_DECLARATIONS = ['PRINT', 'SHADOW', 'KEY_RIG', 'buildTheHouse']
/** Files that shape every frame besides the stack's own; the sky's probe is
    baked by the house's generator from `sky-probe.ts`. */
const GLOBAL_WING_FILES = ['display-sky-haze.ts', 'sky-probe.ts', 'static-shadow-cache.ts', 'shadow-shell.ts', 'shadow-body.ts',
  'receiver-plane-shadow.ts', 'data/light-rig.json', 'site.ts'].map((f) => `${WING_DIR}/${f}`)
/** Declarations of other wing files that shape every frame: the day sky's
    dome adds the evening's twilight and sun disc, weighted by the uniforms
    `createEveningSky` opens at zero; the terms themselves are the evening's. */
const GLOBAL_FOREIGN_DECLARATIONS = { [`${WING_DIR}/farewell-sky.ts`]: ['createEveningSky'] }

/* THE LIBRARY'S RECIPE RECORDS. A procedural record (`procedural/...`) names
   no file a frame binds: its sha256 is its recipe file's (provenance-check).
   A record whose every recipe file another key already reads stays out of
   the library part, so a commit re-recording it re-renders only what that
   key says:
     the camera's modules   the MOTION key (every clip's track is replayed
                            through them; nothing else of a frame is theirs)
     the wing's index       its frame-shaping declarations, keyed by name here
                            (GLOBAL_DECLARATIONS), in the exposures and in the
                            evening's code; the rest of it is the interface
     a global input         already a part of this key */
export const MOTION_FILES = ['rail.ts', 'rail-gaze.ts', 'rail-gallery-gaze.ts', 'rail-smoothing.ts', 'rail-waypoints.ts', 'rail-solids.ts',
  'rail-projection.ts', 'projection-drag.ts', 'gait.ts', 'data/rail-clearance.json', 'rail-proof.ts', 'rail-fingerprint.ts'].map((f) => `${WING_DIR}/${f}`)
/** The recipe files a record declares (field, list or note). */
export function recipeFilesOf(entry) {
  const out = new Set()
  if (typeof entry.recipe_file === 'string') out.add(entry.recipe_file)
  if (Array.isArray(entry.recipe_files)) for (const r of entry.recipe_files) out.add(typeof r === 'string' ? r : r?.path)
  for (const m of String(entry.note ?? '').matchAll(/(?:^|[;\s])recipe_file=([^;\s]+)/g)) out.add(m[1])
  out.delete(undefined)
  return [...out]
}
/** Whether another key carries a record: a procedural record whose every recipe file is read there. */
export function carriedElsewhere(entry, globalFiles) {
  if (!String(entry.path ?? '').startsWith('procedural/')) return false
  const files = recipeFilesOf(entry)
  return files.length > 0 && files.every((f) => f === INDEX_FILE || MOTION_FILES.includes(f) || globalFiles.has(f))
}

/** Named declarations of a source, by their text, wherever they stand
    (`names` a list, or a test of a name). */
export function declarations(text, names) {
  const wanted = typeof names === 'function' ? names : (n) => names.includes(n)
  const source = ts.createSourceFile('index.ts', text, ts.ScriptTarget.ES2022, true)
  const found = new Map()
  const visit = (node) => {
    let name
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) name = node.name.text
    else if ((ts.isFunctionDeclaration(node)) && node.name) name = node.name.text
    if (name && wanted(name) && !found.has(name)) found.set(name, node)
    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}

/** THE EXPOSURE A STATION OPENS AT: the index's own table and its default.
    A station with its own toe carries it in the same value, so a toe moved
    turns red the clips that stand there; a station without one keeps its key. */
export function exposures(text) {
  const held = declarations(text, ['STATION_EXPOSURE', 'STATION_TOE', 'PRINT'])
  const literal = (node) => {
    if (ts.isNumericLiteral(node)) return Number(node.text)
    if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken) return -literal(node.operand)
    if (ts.isAsExpression(node) || ts.isParenthesizedExpression(node) || ts.isSatisfiesExpression?.(node)) return literal(node.expression)
    throw new Error(`the exposure is not a number: ${node.getText()}`)
  }
  const objectOf = (decl) => {
    let init = decl.initializer
    while (init && (ts.isAsExpression(init) || ts.isParenthesizedExpression(init) || ts.isSatisfiesExpression?.(init))) init = init.expression
    if (!init || !ts.isObjectLiteralExpression(init)) throw new Error(`${decl.name.getText()} is not an object literal`)
    return init
  }
  const table = {}
  for (const p of objectOf(held.get('STATION_EXPOSURE')).properties) {
    if (!ts.isPropertyAssignment(p)) continue
    table[p.name.getText().replace(/^['"]|['"]$/g, '')] = literal(p.initializer)
  }
  const print = objectOf(held.get('PRINT')).properties.find((p) => ts.isPropertyAssignment(p) && p.name.getText() === 'exposure')
  if (!print) throw new Error('the print names no exposure')
  const toes = {}
  if (held.has('STATION_TOE')) for (const p of objectOf(held.get('STATION_TOE')).properties) {
    if (ts.isPropertyAssignment(p)) toes[p.name.getText().replace(/^['"]|['"]$/g, '')] = literal(p.initializer)
  }
  const of = (station) => {
    const ex = table[station] ?? literal(print.initializer)
    return toes[station] === undefined ? ex : `${ex} toe ${toes[station]}`
  }
  return { table, toes, fallback: literal(print.initializer), of }
}

/** The file a relative import names, as the app resolves it; null outside the app. */
function resolveImport(loader, from, specifier) {
  const spec = specifier.replace(/\?(raw|inline)$/, '')
  if (!spec.startsWith('.')) return null
  const exists = (file) => { try { loader.text(file); return true } catch { return false } }
  const norm = [...from.split('/').slice(0, -1), spec].join('/').split('/')
    .reduce((acc, part) => (part === '..' ? acc.slice(0, -1) : part === '.' ? acc : [...acc, part]), [])
  const joined = norm.join('/')
  return [joined, `${joined}.ts`, `${joined}/index.ts`].find((f) => /\.(ts|json)$/.test(f) && exists(f)) ?? null
}

/** A module's value imports, followed within the app (types are erased);
    `cut` names files the walk never enters. */
export function closure(loader, entry, within, cut = () => false) {
  const out = new Set()
  const walk = (file) => {
    if (out.has(file)) return
    out.add(file)
    if (!file.endsWith('.ts')) return
    const text = loader.text(file)
    for (const hit of text.matchAll(/^\s*(?:import|export)\s+(?!type\b)[^'"]*?from\s+'(\.[^']+)'/gm)) {
      const next = resolveImport(loader, file, hit[1].replace(/\?raw$/, ''))
      if (next && next.startsWith(within) && !cut(next)) walk(next)
    }
  }
  walk(entry)
  return [...out].sort()
}

/** THE PART OF A MIXED MODULE A DRAWING READS: the named top-level
    declarations and every top-level declaration they name in turn, with the
    files their value imports come from. */
export function reachedFrom(loader, file, roots) {
  const source = ts.createSourceFile(file, loader.text(file), ts.ScriptTarget.ES2022, true)
  const top = new Map(), imported = new Map()
  for (const st of source.statements) {
    if (ts.isImportDeclaration(st)) {
      const clause = st.importClause
      if (!clause || clause.isTypeOnly) continue
      const spec = st.moduleSpecifier.text
      if (clause.name) imported.set(clause.name.text, spec)
      const bound = clause.namedBindings
      if (bound && ts.isNamespaceImport(bound)) imported.set(bound.name.text, spec)
      if (bound && ts.isNamedImports(bound)) for (const el of bound.elements) if (!el.isTypeOnly) imported.set(el.name.text, spec)
    } else if (ts.isVariableStatement(st)) {
      for (const d of st.declarationList.declarations) if (ts.isIdentifier(d.name)) top.set(d.name.text, st)
    } else if ((ts.isFunctionDeclaration(st) || ts.isClassDeclaration(st)) && st.name) top.set(st.name.text, st)
  }
  const texts = new Map(), specs = new Set(), queue = [...roots]
  while (queue.length) {
    const name = queue.pop()
    if (texts.has(name)) continue
    const node = top.get(name)
    if (!node) throw new Error(`${file} declares no ${name}`)
    texts.set(name, node.getText())
    const visit = (n) => {
      if (ts.isIdentifier(n)) {
        if (top.has(n.text) && !texts.has(n.text)) queue.push(n.text)
        else if (imported.has(n.text)) specs.add(imported.get(n.text))
      }
      ts.forEachChild(n, visit)
    }
    visit(node)
  }
  return { texts, files: [...specs].map((s) => resolveImport(loader, file, s)).filter(Boolean).sort() }
}

/* THE MACHINE CYCLE'S KEY. A cycle is the machine's island drawn alone: its
   body (the machine's module and the build the island calls), the island's
   stage (the turntable: camera, light, backdrop, playback), the island's
   choice and fit, the station's print, the close look's machine payload (the
   options it hands the turntable) and the look's `makeLive`, which wires the
   body, the print and the light. The global key rides beside it. The rest of
   the close look is the interface: its words, chrome and panels draw into the
   page, never into the island, so no walk enters them, and another machine's
   own module or dossier never keys this one. */
const CLOSE_LOOK = `${WING_DIR}/collection/close-look.ts`, FILM_LOOK = `${WING_DIR}/film-look.ts`
export const CYCLE_ISLAND = ['src/wings/vitrine/turntable.ts', 'src/wings/picture/island.ts', `${WING_DIR}/print.ts`]
export const INTERFACE_FILES = ['src/wings/content.ts', 'src/wings/frame.ts', 'src/wings/window-chrome.ts', 'src/wings/visit.ts',
  'src/wings/overview/index.ts', 'src/wings/desk-chrome.ts', 'src/wings/desk-closelook.ts', 'src/wings/desk-panel.ts', 'src/wings/desk-story.ts',
  'src/wings/desk-switches.ts', 'src/wings/vitrine/index.ts', 'src/wings/vitrine/reader.ts', 'src/wings/vitrine/showpiece.ts',
  'src/wings/vitrine/folio.ts', 'src/wings/vitrine/slider.ts', 'src/wings/picture/cycle.ts',
  ...['content.ts', 'film-wing.ts', 'phone-form.ts', 'film-look.ts', 'collection/close-look.ts', 'collection/strip.ts', 'story.ts',
    'pictures/visitor-copy.ts'].map((f) => `${WING_DIR}/${f}`)]
export const isInterface = (file) => file.startsWith('src/content/') || INTERFACE_FILES.includes(file)
/** every machine the island can build: the modules the machines' index builds from */
export const machineSlugs = (loader) => [...loader.text(`${WING_DIR}/machines/index.ts`).matchAll(/import\s*\{\s*build\s+as\s+\w+\s*\}\s*from\s*'\.\/([a-z-]+)'/g)].map((m) => m[1])
export function cycleKey(loader, slug) {
  const slugs = machineSlugs(loader)
  if (!slugs.includes(slug)) throw new Error(`the machines' index builds no ${slug}`)
  const own = (s) => [`${WING_DIR}/machines/${s}.ts`, `${WING_DIR}/machines/data/${s}.json`]
  const others = new Set(slugs.filter((s) => s !== slug).flatMap(own))
  const cut = (file) => isInterface(file) || others.has(file)
  const files = new Set([`${WING_DIR}/machines/data/${slug}.json`])
  const payload = reachedFrom(loader, CLOSE_LOOK, ['createVinciMachinePayload'])
  for (const entry of [`${WING_DIR}/machines/${slug}.ts`, `${WING_DIR}/machines/index.ts`, ...CYCLE_ISLAND, ...payload.files.filter((f) => !cut(f))])
    for (const f of closure(loader, entry, 'src/', cut)) files.add(f)
  const live = declarations(loader.text(FILM_LOOK), ['makeLive']).get('makeLive')
  if (!live) throw new Error(`${FILM_LOOK} declares no makeLive`)
  const lines = [...[...files].sort().map((f) => `${f} ${sha256(loader.text(f))}`),
    ...[...payload.texts].sort(([a], [b]) => (a < b ? -1 : 1)).map(([n, t]) => `${CLOSE_LOOK}#${n} ${sha256(t)}`),
    `${FILM_LOOK}#makeLive ${sha256(live.getText())}`]
  return { key: sha256(lines.join('\n')).slice(0, 32), files: [...files].sort(), declarations: [...payload.texts.keys()].sort() }
}

/** WHAT NO FRAME CAN DRAW: time-based media (the world binds no video and no
    sound) and a showpiece's own files, which only its close look plays. A
    write of these to the store leaves every key where it was. */
const NOT_DRAWN = /\.(mp4|m4v|mov|webm|mp3|m4a|aac|wav|ogg|opus)$/i
export const drawable = (entry) => !NOT_DRAWN.test(String(entry.path ?? '')) && !String(entry.role ?? '').startsWith('showpiece-')

/** THE GLOBAL KEY and each of its inputs, so a red can say which one moved. */
export function globalKey(loader, { library = [], claimed = new Set() } = {}) {
  const parts = {}
  for (const file of closure(loader, 'src/stack/index.ts', 'src/stack/')) parts[file] = short(loader.text(file))
  for (const file of GLOBAL_WING_FILES) parts[file] = short(loader.text(file))
  const held = declarations(declaringText(loader), GLOBAL_DECLARATIONS)
  for (const name of GLOBAL_DECLARATIONS) {
    if (!held.has(name)) throw new Error(`the wing's index declares no ${name}`)
    parts[`${INDEX_FILE}#${name}`] = short(held.get(name).getText())
  }
  for (const [file, names] of Object.entries(GLOBAL_FOREIGN_DECLARATIONS)) {
    const found = declarations(loader.text(file), names)
    for (const name of names) {
      if (!found.has(name)) throw new Error(`${file} declares no ${name}`)
      parts[`${file}#${name}`] = short(found.get(name).getText())
    }
  }
  parts.recipe = short(JSON.stringify(RECIPE))
  const globalFiles = new Set(Object.keys(parts).filter((k) => !k.includes('#')))
  parts['library sets no plate claims'] = short(library.filter((e) => drawable(e) && !claimed.has(`${e.id}|${e.path}|${e.sha256 ?? ''}`) && !carriedElsewhere(e, globalFiles))
    .map((e) => `${e.id}|${e.path}|${e.sha256 ?? ''}`).sort().join('\n'))
  return { key: short(JSON.stringify(Object.entries(parts).sort())), parts }
}

/** THE EVENING'S OWN LIGHT, which no global input names: the farewell's
    modules and the index's functions that run it and meter its print. */
/* THE EVENING'S CODE, found rather than listed where it can be: the farewell's
   modules and every module the index imports by an evening's name, with their
   closures, and the index's declarations named for it, so a farewell written
   anew moves the key without an edit here */
const EVENING_FILES = [`${WING_DIR}/farewell.ts`, `${WING_DIR}/farewell-sky.ts`]
const EVENING_DECLARATIONS = ['applyEvening', 'farewellExposure', 'farewellDip', 'holdFarewell', 'lookUp', 'runFarewell', 'endFarewell', 'cloudLit', 'cloudShade']
const EVENING_NAME = /farewell|evening|look-?up|sunset|stars/i
export function eveningCode(loader) {
  const parts = {}
  const exists = (file) => { try { loader.text(file); return true } catch { return false } }
  const index = exists(INDEX_FILE) ? loader.text(INDEX_FILE) : ''
  const imported = [...index.matchAll(/^\s*import\s+(?!type\b)[^'"]*?from\s+'\.\/([^']+)'/gm)].map((m) => m[1]).filter((m) => EVENING_NAME.test(m))
    .map((m) => `${WING_DIR}/${m.replace(/\.ts$/, '')}.ts`)
  for (const entry of new Set([...EVENING_FILES, ...imported])) if (exists(entry)) for (const file of closure(loader, entry, 'src/')) parts[file] = short(loader.text(file))
  const held = declarations(declaringText(loader), (n) => EVENING_DECLARATIONS.includes(n) || EVENING_NAME.test(n))
  for (const [name, node] of held) parts[`${INDEX_FILE}#${name}`] = short(node.getText())
  return short(JSON.stringify(Object.entries(parts).sort()))
}

export const deliveryKey = (delivery = DELIVERY) => short(JSON.stringify(delivery))
/** A CLIP'S DELIVERY KEY: a clip exempt from its byte line names the
    exemption, every other clip carries the delivery's own key, unchanged. */
export const clipDeliveryKey = (clip, delivery = DELIVERY) =>
  (byteExempt(clip) ? short(JSON.stringify({ ...delivery, vbv: 'none: exempt from the byte line, encoded uncapped', byteCap: BYTE_EXEMPT.cap })) : deliveryKey(delivery))
const SEEN_MEMO = new Map()

/** THE PICTURE KEY: the exposure at both ends and every cell the clip can
    show, by what is drawn in it now. */
export function pictureKey(seen, hashes, exposurePair) {
  const hash = createHash('sha256').update(`${KEYS_FORMAT} picture exposure=${exposurePair.join(',')}\n`)
  for (const n of seen) hash.update(`${n}:${hashes.get(n) ?? '-'}\n`)
  return hash.digest('hex').slice(0, 32)
}

/**
 * Every key of the tree.
 *   rev, overlay   the tree: a revision, and texts planted over it
 *   seenOf         (id, framing, samples, world) => the seen cells; the
 *                  frustum stand-in by default, the ID pass's record in W2
 *   delivery       the job's delivery settings
 */
export async function treeKeys({ rev = '', overlay = {}, library, delivery = DELIVERY, seenOf, log = () => {} } = {}) {
  const t0 = Date.now()
  const replay = await openReplay({ rev, overlay })
  const graph = buildGraph(replay.wing)
  const loader = await createLoader({ rev, overlay })
  const exposure = exposures(declaringText(loader))
  const world = await mountWorld({ rev, overlay, library })
  log(`world ${((Date.now() - t0) / 1000).toFixed(1)} s (${world.parts.filter((p) => !p.reused).map((p) => p.id).join(', ') || 'all reused'})`)
  const global = globalKey(loader, { library: world.library, claimed: world.claimed })
  /* the stand-in's seen set is a function of the track, the occupied cells,
     the sun and the water: held once per process for each */
  const occupancy = sha256(Float64Array.from([...world.cells.hashes.keys()].sort((a, b) => a - b)))
  const setting = `${occupancy}|${world.sun.join(',')}|${world.cells.mirror.length}|${world.cells.mirrorLevel}`
  let index
  const seen = seenOf ?? ((id, framing, samples) => {
    const slot = `${setting}|${framing}|${sha256(Float64Array.from(samples.flat()))}`
    let cells = SEEN_MEMO.get(slot)
    if (!cells) {
      index ??= buildIndex(world.cells)
      cells = seenSet(index, samples, {
        aspect: FRAMINGS[framing].width / FRAMINGS[framing].height, sun: world.sun, mirror: world.cells.mirror, mirrorLevel: world.cells.mirrorLevel,
      })
      SEEN_MEMO.set(slot, cells)
    }
    return cells
  })
  const clips = new Map(), stills = new Map()
  const rest = new Map()
  const t1 = Date.now()
  for (const edge of graph.edges) for (const framing of Object.keys(FRAMINGS)) {
    const r = replayEdge(replay, graph, edge, framing)
    const pair = [exposure.of(r.departed), exposure.of(r.completed)]
    const cells = seen(edge.id, framing, r.samples, world)
    clips.set(`${edge.id} ${framing}`, {
      clip: edge.id, stem: edge.stem, framing, frames: r.arrivedAt, from: edge.from, to: edge.to, kinds: edge.kinds,
      seconds: edge.framings[framing].seconds[FILM_PACE], delivery: clipDeliveryKey(edge.id, delivery),
      motion: r.key, picture: pictureKey(cells, world.cells.hashes, pair), exposure: pair, stations: [r.departed, r.completed], seen: cells.length,
      first: canonicalPrint(r.prints[0]), last: canonicalPrint(r.prints[r.arrivedAt]), samples: r.samples,
      cells,
    })
    for (const [node, print, sample, station] of [[edge.from, r.prints[0], r.samples[0], r.departed], [edge.to, r.prints[r.arrivedAt], r.samples[r.arrivedAt], r.completed]]) {
      const at = `${node} ${framing}`
      if (!rest.has(at)) rest.set(at, { node, framing, prints: new Set(), exposures: new Set(), stations: new Set(), sample })
      rest.get(at).prints.add(canonicalPrint(print))
      rest.get(at).exposures.add(exposure.of(station))
      rest.get(at).stations.add(station)
    }
  }
  const sizes = [...clips.values()].map((c) => c.seen).sort((a, b) => a - b)
  log(`${clips.size} tracks and their seen sets ${((Date.now() - t1) / 1000).toFixed(1)} s; cells seen a clip: median ${sizes[sizes.length >> 1]}, max ${sizes.at(-1)}, of ${world.cells.hashes.size}`)
  const aspectOf = (framing) => Math.round(FRAMINGS[framing].width / FRAMINGS[framing].height * 1e6) / 1e6
  for (const [at, r] of rest) {
    const [print] = [...r.prints]
    const [ex] = [...r.exposures]
    const cells = seen(r.node, r.framing, [r.sample], world)
    stills.set(at, {
      node: r.node, framing: r.framing, print,
      motion: trackKey({ aspect: aspectOf(r.framing), fps: FPS, pace: FILM_PACE, prints: [print] }),
      picture: pictureKey(cells, world.cells.hashes, [ex, ex]), exposure: ex, stations: [...r.stations], seen: cells.length, cells,
      /* law 3: a rest pose has one picture, whichever way it was reached */
      histories: { prints: r.prints.size, exposures: r.exposures.size },
    })
  }
  /* THE GRAVE'S LOOK UP: its track, the cells it can show, the grave's
     exposure it opens on and the evening's own light */
  const evenings = new Map()
  if (graph.evening) {
    const code = eveningCode(loader)
    for (const framing of Object.keys(FRAMINGS)) {
      const t = eveningTrack(replay.wing, graph, framing)
      const cells = seen(graph.evening.id, framing, t.samples, world)
      const at = stills.get(`${graph.evening.from} ${framing}`)
      const station = graph.nodes.find((n) => n.id === graph.evening.from)?.station
      const ex = at?.exposure ?? exposure.of(station)
      evenings.set(`${graph.evening.id} ${framing}`, {
        evening: graph.evening.id, from: graph.evening.from, framing, frames: graph.evening.frames, fps: graph.evening.fps, seconds: graph.evening.seconds,
        delivery: clipDeliveryKey(graph.evening.id, delivery), motion: t.key, picture: pictureKey(cells, world.cells.hashes, [ex, `evening ${code}`]),
        exposure: [ex, ex], stations: at?.stations ?? [station], first: canonicalPrint(t.prints[0]), seen: cells.length, cells,
      })
    }
  }
  return {
    format: KEYS_FORMAT, revision: replay.wing.loader.revision, graph, clips, stills, evenings,
    global, delivery: { key: deliveryKey(delivery), settings: delivery }, exposure, world,
    seconds: (Date.now() - t0) / 1000,
  }
}
