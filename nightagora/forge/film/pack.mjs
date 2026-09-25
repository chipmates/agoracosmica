// THE PLAYER'S RELEASE, packed from an export run (`export.mjs`) and the
// nodes' marks (`marks.mjs`): every still at every clip rung of its framing,
// the clips linked in place, one camera track per clip, and `film.json`, which
// is all the player reads. Nothing here renders; a missing file is a refusal.
//
//   node forge/film/pack.mjs --export=<run dir> --marks=<marks.json> --out=<release dir>
//   node forge/film/pack.mjs --export=<job dir> ... --whole    every edge of the graph, a clip not yet
//                                                             rendered answered by its two stills
//
// A job folder (`render-all.mjs`) is an export run: its `export.json` is
// rewritten from the ledger, and its `cycles.json` carries the machines' cycles.
//
// The still at a rung is the master scaled by the same kernel the encoder's
// rungs are scaled by, so the picture under a clip is the clip's own first
// frame to within the two codecs.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, linkSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { basename, join, relative, resolve, dirname } from 'node:path'
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
/** one marks reading or several, merged node by node */
const MARKS = flags.has('marks') ? String(flags.get('marks')).split(',').filter(Boolean).map((f) => resolve(f)) : []
const OUT = resolve(String(flags.get('out') ?? ''))
const QUALITY = Number(flags.get('quality') ?? 90)
/** THE WHOLE GRAPH: an edge with no clip yet stands in the release with its
    seconds and no file, so the router walks the life as the full film will,
    and the player answers the missing clip by the dissolve between its stills */
const WHOLE = flags.has('whole')
for (const dir of EXPORTS) if (!existsSync(join(dir, 'export.json'))) throw new Error(`no export at ${dir}`)

export const FILM_FORMAT = 'vinci-film-player-v1'
const MASTER = { wide: [1920, 1080], upright: [780, 1688] }
const PACE_RATE = { stroll: 0.667, walk: 1, brisk: 1.5 }
const sha = (buf) => createHash('sha256').update(buf).digest('hex')
/** the stream header a clip must carry so every engine paints it as the still: BT.709, the sRGB transfer, limited range */
const SRGB_VUI = 'h264_metadata=colour_primaries=1:transfer_characteristics=13:matrix_coefficients=1:video_full_range_flag=0'
const tagged = (file) => /color_transfer=iec61966-2-1/.test(execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0',
  '-show_entries', 'stream=color_transfer', '-of', 'compact', file]).toString())
const retagged = []
const stemOf = (node) => node.replace(/[:/]/g, (c) => (c === ':' ? '-' : '.'))

const runs = EXPORTS.map((dir) => ({ dir, summary: JSON.parse(readFileSync(join(dir, 'export.json'), 'utf8')) }))
const summary = { head: runs.at(-1).summary.head, heads: runs.map((r) => r.summary.head),
  clips: runs.flatMap((r) => r.summary.clips.map((c) => ({ ...c, dir: r.dir }))),
  stills: runs.flatMap((r) => r.summary.stills.map((s) => ({ ...s, dir: r.dir }))) }
const marks = { nodes: {}, prints: {} }
const emptyReadings = []
for (const file of MARKS) {
  const read = JSON.parse(readFileSync(file, 'utf8'))
  /* LANGUAGE BY LANGUAGE, and an empty reading never replaces a full one: a
     room reads empty before its registry has loaded, not because it has no marks */
  for (const [node, byFraming] of Object.entries(read.nodes ?? {})) for (const [framing, byLang] of Object.entries(byFraming)) {
    const held = ((marks.nodes[node] ??= {})[framing] ??= {})
    for (const [lang, list] of Object.entries(byLang)) {
      if (!list.length && held[lang]?.length) { emptyReadings.push(`${node} ${framing} ${lang} (${file.split('/').pop()})`); continue }
      held[lang] = list
    }
  }
  for (const [node, byFraming] of Object.entries(read.prints ?? {})) marks.prints[node] = { ...marks.prints[node], ...byFraming }
}
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
    mkdirSync(join(OUT, 'clips', clip.framing, rung), { recursive: true })
    let to = join(OUT, 'clips', clip.framing, rung, basename(from))
    if (tagged(from)) {
      try { linkSync(from, to) } catch { copyFileSync(from, to) }
    } else {
      /* A CLIP WHOSE STREAM DOES NOT SAY ITS TRANSFER is tagged here by a stream
         copy: the pixels are the export's, only the header changes */
      const part = to.replace(/\.[0-9a-f]{16}\.mp4$/, '.part.mp4')
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', from, '-c', 'copy', '-bsf:v', SRGB_VUI, '-movflags', '+faststart', part])
      to = part.replace(/\.part\.mp4$/, `.${sha(readFileSync(part)).slice(0, 16)}.mp4`)
      renameSync(part, to)
      retagged.push(`${clip.clip} ${clip.framing} ${rung}`)
    }
    files[rung] = { file: rel(to), bytes: statSync(to).size }
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

/* ---- the clips not yet rendered, answered by their stills ---- */
const answered = []
if (WHOLE) {
  for (const meta of graph.edges) for (const [framing, x] of Object.entries(meta.framings)) {
    const e = edges.get(meta.id) ?? { id: meta.id, from: meta.from, to: meta.to, kinds: meta.kinds, passes: meta.passes ?? [], framings: {} }
    if (e.framings[framing]) continue
    const frames = x.frames + (x.restLag ?? 0) + 1
    e.framings[framing] = { seconds: Object.fromEntries(Object.entries(PACE_RATE).map(([pace, rate]) => [pace, frames / FPS / rate])), frames, files: {}, track: '' }
    edges.set(meta.id, e)
    answered.push(`${meta.id} ${framing}`)
  }
}

/* ---- the machines' filmed cycles, where a job recorded them ---- */
const cycles = {}
for (const { dir } of runs) {
  const file = join(dir, 'cycles.json')
  if (!existsSync(file)) continue
  for (const [id, cycle] of Object.entries(JSON.parse(readFileSync(file, 'utf8')))) {
    const held = (cycles[id] ??= { period: cycle.period, fps: cycle.fps, frames: cycle.frames, framings: {} })
    for (const [framing, f] of Object.entries(cycle.framings)) {
      // the files keep their paths under the release: the recorder wrote them relative to its own folder
      const place = (entry) => {
        if (!entry) return entry
        const to = join(OUT, entry.file)
        mkdirSync(dirname(to), { recursive: true })
        try { linkSync(join(dir, entry.file), to) } catch { copyFileSync(join(dir, entry.file), to) }
        return entry
      }
      for (const entry of Object.values(f.files)) place(entry)
      place(f.poster)
      for (const step of f.steps) place(step.outline)
      held.framings[framing] = f
    }
  }
}

/* ---- the stills, at every rung of their framing ---- */
const nodes = {}
const stillRecords = []
const duplicates = [], rawOf = new Map()
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
  // A NODE HAS ONE PICTURE: where two runs rendered it, the first run's stands, the one most clips were rendered against
  if (n.stills[still.framing]) { duplicates.push(`${still.node} ${still.framing}: ${still.raw === rawOf.get(`${still.node} ${still.framing}`) ? 'the same bytes' : 'kept the first run'}`); continue }
  rawOf.set(`${still.node} ${still.framing}`, still.raw)
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

/* THE WORKS THE FILM WING OPENS ONLY FROM A MARK: a showpiece (a work whose
   close look is a film, `data/films.json`) needs a mark on it at some node in
   each framing, or no press reaches it */
const showpieceMarks = []
const filmsFile = new URL('../../src/wings/vinci/data/films.json', import.meta.url)
if (existsSync(filmsFile)) {
  for (const id of Object.keys(JSON.parse(readFileSync(filmsFile, 'utf8')).films ?? {})) {
    for (const f of Object.keys(MASTER)) {
      const at = Object.entries(nodes).filter(([, n]) => Object.values(n.marks[f] ?? {}).some((list) => list.some((m) => m.id === id))).map(([node]) => node)
      showpieceMarks.push({ id, framing: f, nodes: at })
    }
  }
}

/* EACH STATION'S SET, in the order its room holds it, from the graph's own
   views: what the overview offers where the visitor stands */
const sets = {}
for (const n of graph.nodes) if (n.kind === 'view') (sets[n.station] ??= []).push(n.exhibit)

const release = {
  format: FILM_FORMAT,
  wing: 'vinci',
  fps: FPS,
  revision: summary.head,
  framings: Object.fromEntries(Object.entries(MASTER).map(([f, master]) => [f, { master, rungs: RUNGS[f] }])),
  story: graph.story,
  cuts: graph.cuts,
  opens: graph.opens,
  sets,
  nodes,
  edges: [...edges.values()].map((e) => ({ ...e, framings: Object.fromEntries(Object.entries(e.framings).map(([f, x]) => [f, { seconds: x.seconds, frames: x.frames, files: x.files, track: x.track }])) })),
  ...(Object.keys(cycles).length ? { cycles } : {}),
}
writeFileSync(join(OUT, 'film.json'), JSON.stringify(release))
writeFileSync(join(OUT, 'pack.json'), JSON.stringify({
  format: 'vinci-film-pack-v1', exports: EXPORTS, exportHeads: summary.heads, marks: MARKS, quality: QUALITY, whole: WHOLE, answeredByStills: answered.length,
  sharp: sharp.versions, refusals, projection, retagged, duplicates, emptyReadings, showpieceMarks,
  clips: [...edges.values()].map((e) => ({ id: e.id, framings: Object.fromEntries(Object.entries(e.framings).map(([f, x]) => [f, { frames: x.frames, joins: x.joins, mountedSetChanges: x.mountedSetChanges, pendingAtRest: x.pendingAtRest, bytes: Object.fromEntries(Object.entries(x.files).map(([r, v]) => [r, v.bytes])) }])) })),
  stills: stillRecords,
}, null, 1))
const kB = (n) => Math.round(n / 1024)
console.log(`the release: ${Object.keys(nodes).length} nodes, ${edges.size} clips (${refusals.length} refused, ${retagged.length} rung files tagged sRGB here${WHOLE ? `, ${answered.length} edge framings answered by their stills` : ''}), ${stillRecords.length} stills (${kB(stillRecords.reduce((s, r) => s + r.bytes, 0))} kB)${Object.keys(cycles).length ? `, cycles ${Object.keys(cycles).join(', ')}` : ''}`)
for (const p of projection) if (!p.same) console.log(`  PROJECTION ${p.node} ${p.framing}: still ${p.still} · marks ${p.marks}`)
for (const s of showpieceMarks) console.log(`  ${s.nodes.length ? 'showpiece' : 'SHOWPIECE WITHOUT A MARK'} ${s.id} ${s.framing}${s.nodes.length ? `: marked at ${s.nodes.join(', ')}` : ': no node carries its mark, so the film wing cannot open it'}`)
console.log(`  ${join(OUT, 'film.json')}`)
