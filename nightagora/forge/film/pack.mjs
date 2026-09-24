// THE PLAYER'S RELEASE, packed from an export run (`export.mjs`) and the
// nodes' marks (`marks.mjs`): every still at every clip rung of its framing,
// the clips linked in place, one camera track per clip, and `film.json`, which
// is all the player reads. Nothing here renders; a missing file is a refusal.
//
//   node forge/film/pack.mjs --export=<run dir> --marks=<marks.json> --out=<release dir>
//
// The still at a rung is the master scaled by the same kernel the encoder's
// rungs are scaled by, so the picture under a clip is the clip's own first
// frame to within the two codecs.
import { createHash } from 'node:crypto'
import { existsSync, linkSync, mkdirSync, readFileSync, rmSync, writeFileSync, copyFileSync } from 'node:fs'
import { basename, dirname, join, relative, resolve } from 'node:path'
import sharp from 'sharp'
import { FPS, buildGraph } from './graph.mjs'
import { openReplay } from './replay.mjs'
import { RUNGS } from './export.mjs'

const flags = new Map(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
  const at = a.indexOf('=')
  return at < 0 ? [a.slice(2), true] : [a.slice(2, at), a.slice(at + 1)]
}))
/** one export run or several, the later ones winning where two carry the same file */
const EXPORTS = String(flags.get('export') ?? '').split(',').filter(Boolean).map((d) => resolve(d))
const MARKS = flags.has('marks') ? resolve(String(flags.get('marks'))) : null
const OUT = resolve(String(flags.get('out') ?? ''))
const QUALITY = Number(flags.get('quality') ?? 90)
for (const dir of EXPORTS) if (!existsSync(join(dir, 'export.json'))) throw new Error(`no export at ${dir}`)

export const FILM_FORMAT = 'vinci-film-player-v1'
const MASTER = { wide: [1920, 1080], upright: [780, 1688] }
const PACE_RATE = { stroll: 0.667, walk: 1, brisk: 1.5 }
const sha = (buf) => createHash('sha256').update(buf).digest('hex')
const stemOf = (node) => node.replace(/[:/]/g, (c) => (c === ':' ? '-' : '.'))

const runs = EXPORTS.map((dir) => ({ dir, summary: JSON.parse(readFileSync(join(dir, 'export.json'), 'utf8')) }))
const summary = { head: runs.at(-1).summary.head, heads: runs.map((r) => r.summary.head),
  clips: runs.flatMap((r) => r.summary.clips.map((c) => ({ ...c, dir: r.dir }))),
  stills: runs.flatMap((r) => r.summary.stills.map((s) => ({ ...s, dir: r.dir }))) }
const marks = MARKS ? JSON.parse(readFileSync(MARKS, 'utf8')) : { nodes: {}, prints: {} }
const replay = await openReplay()
const graph = buildGraph(replay.wing)
const nodeMeta = new Map(graph.nodes.map((n) => [n.id, n]))
const edgeMeta = new Map(graph.edges.map((e) => [e.id, e]))

rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })
const rel = (file) => relative(OUT, file).split('\\').join('/')

/* ---- the clips and their tracks ---- */
const edges = new Map()
const refusals = []
const firstPrint = new Map(), lastPrint = new Map()
for (const clip of summary.clips) {
  if (!clip.files) { refusals.push({ clip: clip.clip, framing: clip.framing, refused: clip.refused }); continue }
  const meta = edgeMeta.get(clip.clip)
  if (!meta) throw new Error(`${clip.clip}: not an edge of the graph at this tree`)
  const sidecar = JSON.parse(readFileSync(join(clip.dir, 'sidecars', clip.framing, `${clip.stem}.json`), 'utf8'))
  const prints = sidecar.perFrame.map((f) => f.print)
  const trackFile = join(OUT, 'tracks', clip.framing, `${clip.stem}.${sha(prints.join('\n')).slice(0, 16)}.json`)
  mkdirSync(dirname(trackFile), { recursive: true })
  writeFileSync(trackFile, JSON.stringify(prints))
  firstPrint.set(`${meta.from} ${clip.framing}`, prints[0])
  lastPrint.set(`${meta.to} ${clip.framing}`, prints[prints.length - 1])
  const files = {}
  for (const [rung, f] of Object.entries(clip.files)) {
    const from = f.file.startsWith('/') ? f.file : join(clip.dir, f.file)
    const to = join(OUT, 'clips', clip.framing, rung, basename(from))
    mkdirSync(dirname(to), { recursive: true })
    try { linkSync(from, to) } catch { copyFileSync(from, to) }
    files[rung] = { file: rel(to), bytes: f.bytes }
  }
  const walk = clip.frames / FPS
  const e = edges.get(clip.clip) ?? { id: clip.clip, from: meta.from, to: meta.to, kinds: meta.kinds, passes: meta.passes ?? [], framings: {} }
  e.framings[clip.framing] = {
    seconds: Object.fromEntries(Object.entries(PACE_RATE).map(([pace, rate]) => [pace, walk / rate])),
    frames: clip.frames, files, track: rel(trackFile),
    joins: clip.joinsAgree ?? null, mountedSetChanges: clip.mountedSetChanges ?? null, pendingAtRest: clip.pendingAtRest ?? null,
  }
  edges.set(clip.clip, e)
}

/* ---- the stills, at every rung of their framing ---- */
const nodes = {}
const stillRecords = []
for (const still of summary.stills) {
  const meta = nodeMeta.get(still.node)
  if (!meta) throw new Error(`${still.node}: not a node of the graph at this tree`)
  const master = still.master.file.startsWith('/') ? still.master.file : join(still.dir, still.master.file)
  const n = nodes[still.node] ??= {
    kind: meta.kind, station: meta.station,
    ...(meta.walkId ? { walkId: meta.walkId } : {}), ...(meta.exhibit ? { exhibit: meta.exhibit } : {}),
    ...(meta.wall ? { wall: meta.wall, vertex: meta.vertex } : {}),
    stills: {}, print: {}, marks: {},
  }
  n.stills[still.framing] = {}
  for (const [w, h] of RUNGS[still.framing]) {
    const buf = await sharp(master).resize(w, h, { fit: 'fill', kernel: 'lanczos3' })
      .webp({ quality: QUALITY, effort: 5, smartSubsample: true }).toBuffer()
    const file = join(OUT, 'stills', still.framing, `${w}x${h}`, `${stemOf(still.node)}.${sha(buf).slice(0, 16)}.webp`)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, buf)
    n.stills[still.framing][`${w}x${h}`] = { file: rel(file), bytes: buf.length }
    stillRecords.push({ node: still.node, framing: still.framing, rung: `${w}x${h}`, bytes: buf.length })
  }
  // the still's own camera: the print a clip leaving it opens on, else the one arriving
  n.print[still.framing] = firstPrint.get(`${still.node} ${still.framing}`) ?? lastPrint.get(`${still.node} ${still.framing}`) ?? marks.prints?.[still.node]?.[still.framing] ?? ''
  const m = marks.nodes?.[still.node]?.[still.framing]
  if (m) n.marks[still.framing] = m
}

/* ---- one projection: the marks were read on the camera the still stands on ---- */
const projection = []
for (const [id, n] of Object.entries(nodes)) for (const f of Object.keys(n.print)) {
  const read = marks.prints?.[id]?.[f]
  if (read) projection.push({ node: id, framing: f, same: read === n.print[f], still: n.print[f], marks: read })
}

const release = {
  format: FILM_FORMAT,
  wing: 'vinci',
  fps: FPS,
  revision: summary.head,
  framings: Object.fromEntries(Object.entries(MASTER).map(([f, master]) => [f, { master, rungs: RUNGS[f] }])),
  story: graph.story,
  cuts: graph.cuts,
  opens: graph.opens,
  nodes,
  edges: [...edges.values()].map((e) => ({ ...e, framings: Object.fromEntries(Object.entries(e.framings).map(([f, x]) => [f, { seconds: x.seconds, frames: x.frames, files: x.files, track: x.track }])) })),
}
writeFileSync(join(OUT, 'film.json'), JSON.stringify(release))
writeFileSync(join(OUT, 'pack.json'), JSON.stringify({
  format: 'vinci-film-pack-v1', exports: EXPORTS, exportHeads: summary.heads, marks: MARKS, quality: QUALITY,
  sharp: sharp.versions, refusals, projection,
  clips: [...edges.values()].map((e) => ({ id: e.id, framings: Object.fromEntries(Object.entries(e.framings).map(([f, x]) => [f, { frames: x.frames, joins: x.joins, mountedSetChanges: x.mountedSetChanges, pendingAtRest: x.pendingAtRest, bytes: Object.fromEntries(Object.entries(x.files).map(([r, v]) => [r, v.bytes])) }])) })),
  stills: stillRecords,
}, null, 1))
const kB = (n) => Math.round(n / 1024)
console.log(`the release: ${Object.keys(nodes).length} nodes, ${edges.size} clips (${refusals.length} refused), ${stillRecords.length} stills (${kB(stillRecords.reduce((s, r) => s + r.bytes, 0))} kB)`)
for (const p of projection) if (!p.same) console.log(`  PROJECTION ${p.node} ${p.framing}: still ${p.still} · marks ${p.marks}`)
console.log(`  ${join(OUT, 'film.json')}`)
