// THE FOUR KEYS OF EVERY CLIP AND EVERY STILL, from a tree, in node
// (design §5.1). A key names what made the frames; the gate holds the keys a
// release was rendered with against the keys the tree gives now.
//
//   MOTION    the camera track replayed on the harness clock (`replay.mjs`)
//   PICTURE   the cells the clip can show, each by what is drawn in it
//             (`scene.mjs`, `seen.mjs`), and the exposure at its two ends
//   GLOBAL    the stack, the print, the light, the sky, the recipe, and the
//             library sets no plate claims
//   DELIVERY  the job image, the encoder and the rungs
//
// A text change moves none of them: no interface word is in a frame.
import { createHash } from 'node:crypto'
import ts from 'typescript'
import { FILM_PACE, FPS, FRAMINGS, buildGraph } from './graph.mjs'
import { WING_DIR, createLoader } from './load.mjs'
import { canonicalPrint, openReplay, replayEdge, trackKey } from './replay.mjs'
import { mountWorld } from './scene.mjs'
import { buildIndex, seenSet } from './seen.mjs'

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
  colour: 'bt709 matrix, transfer tagged', x264Threads: 'fixed',
  rungs: { wide: ['1920x1080', '1280x720', '854x480'], upright: ['720x1558', '480x1038'] },
  still: { format: 'png', rungs: { wide: ['1920x1080'], upright: ['720x1558'] }, marks: ['en', 'de'] },
}

/* ---- what the wing's index file holds for the picture, read by name ---- */
const INDEX_FILE = `${WING_DIR}/index.ts`
/** The declarations of the wing's index that shape every frame: the print,
    the shadow, the light rig, and the generator that assembles the house. */
const GLOBAL_DECLARATIONS = ['PRINT', 'SHADOW', 'KEY_RIG', 'buildTheHouse']
/** Files that shape every frame besides the stack's own. */
const GLOBAL_WING_FILES = ['display-sky-haze.ts', 'static-shadow-cache.ts', 'shadow-shell.ts', 'shadow-body.ts',
  'receiver-plane-shadow.ts', 'data/light-rig.json', 'site.ts'].map((f) => `${WING_DIR}/${f}`)

/** Named declarations of a source, by their text, wherever they stand. */
export function declarations(text, names) {
  const source = ts.createSourceFile('index.ts', text, ts.ScriptTarget.ES2022, true)
  const found = new Map()
  const visit = (node) => {
    let name
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) name = node.name.text
    else if ((ts.isFunctionDeclaration(node)) && node.name) name = node.name.text
    if (name && names.includes(name) && !found.has(name)) found.set(name, node)
    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}

/** THE EXPOSURE A STATION OPENS AT: the index's own table and its default. */
export function exposures(text) {
  const held = declarations(text, ['STATION_EXPOSURE', 'PRINT'])
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
  return { table, fallback: literal(print.initializer), of: (station) => table[station] ?? literal(print.initializer) }
}

/** A module's value imports, followed within the app (types are erased). */
function closure(loader, entry, within) {
  const out = new Set()
  const exists = (file) => { try { loader.text(file); return true } catch { return false } }
  const walk = (file) => {
    if (out.has(file)) return
    out.add(file)
    if (!file.endsWith('.ts')) return
    const text = loader.text(file)
    for (const hit of text.matchAll(/^\s*(?:import|export)\s+(?!type\b)[^'"]*?from\s+'(\.[^']+)'/gm)) {
      const spec = hit[1].replace(/\?raw$/, '')
      const base = spec.startsWith('.') ? [...file.split('/').slice(0, -1), spec].join('/') : spec
      const norm = base.split('/').reduce((acc, part) => (part === '..' ? acc.slice(0, -1) : part === '.' ? acc : [...acc, part]), [])
      const joined = norm.join('/')
      const next = [joined, `${joined}.ts`, `${joined}/index.ts`].find((f) => /\.(ts|json)$/.test(f) && exists(f))
      if (next && next.startsWith(within)) walk(next)
    }
  }
  walk(entry)
  return [...out].sort()
}

/** THE GLOBAL KEY and each of its inputs, so a red can say which one moved. */
export function globalKey(loader, { library = [], claimed = new Set() } = {}) {
  const parts = {}
  for (const file of closure(loader, 'src/stack/index.ts', 'src/stack/')) parts[file] = short(loader.text(file))
  for (const file of GLOBAL_WING_FILES) parts[file] = short(loader.text(file))
  const index = loader.text(INDEX_FILE)
  const held = declarations(index, GLOBAL_DECLARATIONS)
  for (const name of GLOBAL_DECLARATIONS) {
    if (!held.has(name)) throw new Error(`the wing's index declares no ${name}`)
    parts[`${INDEX_FILE}#${name}`] = short(held.get(name).getText())
  }
  parts.recipe = short(JSON.stringify(RECIPE))
  parts['library sets no plate claims'] = short(library.filter((e) => !claimed.has(`${e.id}|${e.path}|${e.sha256 ?? ''}`))
    .map((e) => `${e.id}|${e.path}|${e.sha256 ?? ''}`).sort().join('\n'))
  return { key: short(JSON.stringify(Object.entries(parts).sort())), parts }
}

export const deliveryKey = (delivery = DELIVERY) => short(JSON.stringify(delivery))
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
  const exposure = exposures(loader.text(INDEX_FILE))
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
      seconds: edge.framings[framing].seconds[FILM_PACE],
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
  return {
    format: KEYS_FORMAT, revision: replay.wing.loader.revision, graph, clips, stills,
    global, delivery: { key: deliveryKey(delivery), settings: delivery }, exposure, world,
    seconds: (Date.now() - t0) / 1000,
  }
}
