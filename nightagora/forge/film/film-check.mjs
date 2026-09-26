// THE FILM'S GATE: exactly the stale clips turn red (design §5). Offline, no
// browser: a release (its file, its sidecars, its clips and stills) is held
// against the four keys the tree gives now and against every line of §5.2.
//
//   node forge/film/film-check.mjs --release=<dir>        the gate; exit 1 on any red
//   node forge/film/film-check.mjs --stand-in=<dir>       write a stand-in release of this tree
//   node forge/film/film-check.mjs ... --list=<n>         name up to n reds per line
//
// A release on disk:
//   <dir>/release.json                          every clip and still, its keys, its files
//   <dir>/sidecars/<framing>/<stem>.json        what the export measured, one per clip or still
//   <dir>/<framing>/<rung>/<stem>.<hash>.mp4    the clips, content-addressed
//   <dir>/stills/<framing>/<rung>/<stem>.<hash>.png
//
// No frame is rendered before the export (W2) runs, so `--stand-in` writes a
// release whose sidecars carry the tree's own keys and a clean record, and
// whose files are placeholders under their true content address: the gate's
// side is whole, the renderer's side is a stand-in, and says so in every sidecar.
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { FILM_PACE, FPS } from './graph.mjs'
import { KEYS_FORMAT, treeKeys } from './keys.mjs'
import { APP_ROOT, WING_DIR } from './load.mjs'

export const RELEASE_FORMAT = 'vinci-film-release-v1'
export const SIDECAR_FORMAT = 'vinci-film-sidecar-v1'
const sha256 = (data) => createHash('sha256').update(data).digest('hex')
export const STAND_IN = 'stand-in: no frame rendered (the export is W2)'

/* ---- the lines' own numbers ---- */
/** Browser prints against the replay: the print's own last digit. */
export const TRACK_TOLERANCE = 1e-4
/** Three engines against their stills, per channel, of 255: the grain's tooth.
    Also how far a join between two sessions of one build may part. */
export const JOIN_TOLERANCE = 2
export const SAMPLED_JOINS = 10
/** A SAMPLED JOIN, as `sampled-joins.mjs` reads it: the clip's end against its
    still passed through the ends' encoder as a one-frame clip, both decoded by
    one engine, the largest difference of 16 by 16 block means in Y', Cb and Cr.
    Two encodes of one picture part pixel by pixel inside the macroblock; a
    wrong picture or a shift of colour does not. */
export const SAMPLED_STATISTIC = 'one-frame clip, 16x16 block means in BT.709 YCbCr'
export const ENGINES = ['chromium', 'webkit', 'firefox']
/** THE UPRIGHT MID-LEG RULE: the share of a frame's pixels on surfaces facing
    straight up or down. The owner's eye on the first clips sets it; this
    stands in until then. */
export const FLOOR_CEILING_CAP = 0.8
/** A plate never shows more texels than its source holds. */
export const TEXEL_CAP = 1
/** Each rung's byte line in kbit/s: twice the hero rates the one measured hang
    leg gave (§3.3), until T0's bytes set them. */
export const BYTE_LINES = { '1920x1080': 6606, '1280x720': 3236, '854x480': 1722, '720x1558': 2852, '480x1038': 1482 }
/** The calm caps of M46, read from the calm checker when it is in the tree. */
const CALM_FILE = `${WING_DIR}/calm-check.mjs`

/** THE CALM CAPS: the calm checker's own CALM, or none yet. */
export function calmCaps(text) {
  if (!text) return null
  const hit = text.match(/export const CALM\s*=\s*\{([\s\S]*?)\n\}/)
  if (!hit) return null
  const caps = {}
  for (const [, key, value] of hit[1].matchAll(/^\s*(\w+)\s*:\s*([0-9.]+)/gm)) caps[key] = Number(value)
  return caps
}

/** The turn rate, its acceleration and jerk, the zoom and the body's
    acceleration of a track, from its unrounded frames at the film's rate. */
export function calmReadings(samples, fps = FPS) {
  const DEG = 180 / Math.PI, dt = 1 / fps
  const spin = (a, b) => {
    // b * a^-1 as a rotation vector, degrees a second
    const [ax, ay, az, aw] = [-a[3], -a[4], -a[5], a[6]]
    let x = b[6] * ax + b[3] * aw + b[4] * az - b[5] * ay
    let y = b[6] * ay - b[3] * az + b[4] * aw + b[5] * ax
    let z = b[6] * az + b[3] * ay - b[4] * ax + b[5] * aw
    let w = b[6] * aw - b[3] * ax - b[4] * ay - b[5] * az
    if (w < 0) { x = -x; y = -y; z = -z; w = -w }
    const angle = 2 * Math.acos(Math.min(1, w)), sine = Math.sqrt(Math.max(0, 1 - w * w))
    if (sine < 1e-12) return [0, 0, 0]
    return [x / sine * angle * DEG / dt, y / sine * angle * DEG / dt, z / sine * angle * DEG / dt]
  }
  const len = (v) => Math.hypot(...v)
  const scale = (fov) => Math.log(Math.tan(fov * Math.PI / 360))
  let turn = 0, accel = 0, jerk = 0, zoom = 0, body = 0
  let prev = null, prevAccel = null, speed = null
  for (let n = 1; n < samples.length; n++) {
    const w = spin(samples[n - 1], samples[n])
    turn = Math.max(turn, len(w))
    zoom = Math.max(zoom, Math.abs(scale(samples[n][7]) - scale(samples[n - 1][7])) / dt)
    const v = Math.hypot(samples[n][0] - samples[n - 1][0], samples[n][1] - samples[n - 1][1], samples[n][2] - samples[n - 1][2]) / dt
    if (speed !== null) body = Math.max(body, Math.abs(v - speed) / dt)
    speed = v
    if (prev) {
      const a = w.map((c, i) => (c - prev[i]) / dt)
      accel = Math.max(accel, len(a))
      if (prevAccel) jerk = Math.max(jerk, len(a.map((c, i) => (c - prevAccel[i]) / dt)))
      prevAccel = a
    }
    prev = w
  }
  return { turnDegPerSecond: turn, turnDegPerSecond2: accel, turnDegPerSecond3: jerk, zoomPerSecond: zoom, bodyMetresPerSecond2: body }
}

/**
 * ONE END OF A CLIP AGAINST ITS STILL. Inside one session of the renderer the
 * end is the still, sha256-equal. Two sessions of one build draw a still a
 * level apart in under one percent of its pixels, so a clip and a still from
 * two sessions may part by at most JOIN_TOLERANCE at the largest step, as the
 * job measured it against this very still (`joinGaps`). A session unknown to
 * the release, or a gap measured against another still, is judged as one session.
 */
export function joinVerdict({ end, still, clipSession = null, stillSession = null, gap = null }) {
  if (end && still && end === still) return { holds: true }
  if (!end || !still) return { holds: false, why: 'no raw digest to compare' }
  if (!clipSession || !stillSession || clipSession === stillSession) return { holds: false, why: clipSession && stillSession ? 'one session, not the same picture' : 'no session recorded' }
  if (!gap || gap.still !== still || typeof gap.max !== 'number') return { holds: false, why: 'another session, no gap measured against this still' }
  if (gap.max > JOIN_TOLERANCE) return { holds: false, why: `another session, parts by up to ${gap.max} of 255 (the tolerance ${JOIN_TOLERANCE})` }
  return { holds: true, between: { pixels: gap.pixels, max: gap.max } }
}

/* ---- a release, on disk or in memory ---- */
export function diskStore(dir) {
  return {
    label: dir,
    read: (file) => { const at = path.join(dir, file); return existsSync(at) ? readFileSync(at) : null },
    write: (file, data) => { const at = path.join(dir, file); mkdirSync(path.dirname(at), { recursive: true }); writeFileSync(at, data) },
  }
}
export function memoryStore(files = new Map()) {
  return {
    label: 'memory', files,
    read: (file) => files.get(file) ?? null,
    write: (file, data) => { files.set(file, Buffer.isBuffer(data) ? data : Buffer.from(data)) },
    /** a copy whose later writes leave this one alone */
    fork: () => memoryStore(new Map(files)),
  }
}
const stillStem = (node) => node.replace(/[:/]/g, (c) => (c === ':' ? '-' : '.'))
/** A node's files: its still at each rung and its marks file in each language. */
const stillRungs = (tree, framing) => [...tree.delivery.settings.still.rungs[framing], ...tree.delivery.settings.still.marks.map((l) => `marks-${l}`)]
const keysOf = (entry, tree) => ({ motion: entry.motion, picture: entry.picture, global: tree.global.key, delivery: tree.delivery.key })

/**
 * A STAND-IN RELEASE of a tree: what an export that rendered nothing would
 * leave, with a clean record. The joins are the stills' own digests, the
 * files placeholders at their true address. Used to prove the gate.
 */
export function writeStandIn(store, tree) {
  const release = {
    format: RELEASE_FORMAT, keysFormat: KEYS_FORMAT, wing: 'vinci', revision: tree.revision, renderer: STAND_IN,
    fps: FPS, pace: FILM_PACE, global: tree.global.key, delivery: tree.delivery.key, clips: [], stills: [], sampledJoins: [],
  }
  const put = (dir, stem, rung, ext, label) => {
    const bytes = Buffer.from(`${STAND_IN}\n${label}\n`)
    const hash = sha256(bytes)
    const file = `${dir}/${rung}/${stem}.${hash.slice(0, 16)}.${ext}`
    store.write(file, bytes)
    return { file, bytes: bytes.length, sha256: hash }
  }
  const raw = new Map()
  for (const s of tree.stills.values()) {
    const stem = stillStem(s.node)
    const rawDigest = sha256(`raw master ${s.node} ${s.framing} ${s.motion} ${s.picture}`)
    raw.set(`${s.node} ${s.framing}`, rawDigest)
    const files = Object.fromEntries(stillRungs(tree, s.framing).map((rung) => [rung,
      put(`stills/${s.framing}`, stem, rung, rung.startsWith('marks-') ? 'json' : 'png', `${s.node} ${s.framing} ${rung}`)]))
    const sidecar = `sidecars/${s.framing}/stills/${stem}.json`
    store.write(sidecar, JSON.stringify({ format: SIDECAR_FORMAT, node: s.node, framing: s.framing, renderer: STAND_IN, keys: keysOf(s, tree), raw: rawDigest, pendingAtRest: 0, pageErrors: 0, paintedOverCanvas: 0 }))
    release.stills.push({ node: s.node, framing: s.framing, keys: keysOf(s, tree), files, sidecar })
  }
  for (const c of tree.clips.values()) {
    const files = Object.fromEntries(tree.delivery.settings.rungs[c.framing].map((rung) => [rung, put(c.framing, c.stem, rung, 'mp4', `${c.clip} ${c.framing} ${rung}`)]))
    const sidecar = `sidecars/${c.framing}/${c.stem}.json`
    store.write(sidecar, JSON.stringify({
      format: SIDECAR_FORMAT, clip: c.clip, framing: c.framing, renderer: STAND_IN, keys: keysOf(c, tree), frames: c.frames,
      joins: { first: raw.get(`${c.from} ${c.framing}`), last: raw.get(`${c.to} ${c.framing}`) },
      track: { maxDeviation: 0 }, projectionThrows: 0,
      requestsAfterClock: 0, starvedSteps: 0, pageErrors: 0, pendingAtRest: 0, paintedOverCanvas: 0, mountedSetChanges: 0,
      ...(c.framing === 'upright' ? { floorCeilingMax: 0 } : {}), plateTexelRatioMax: 0,
    }))
    release.clips.push({ clip: c.clip, framing: c.framing, keys: keysOf(c, tree), frames: c.frames, seconds: c.seconds, files, sidecar })
  }
  // one sampled line per release: ten joins, three engines, colour included
  const sample = [...tree.clips.values()].filter((c, i) => i % Math.max(1, Math.floor(tree.clips.size / SAMPLED_JOINS)) === 0).slice(0, SAMPLED_JOINS)
  release.sampledJoins = sample.map((c) => ({ clip: c.clip, framing: c.framing, end: 'last', statistic: SAMPLED_STATISTIC, engines: Object.fromEntries(ENGINES.map((e) => [e, { maxDelta: 0, colour: true }])) }))
  store.write('release.json', JSON.stringify(release, null, 1))
  return release
}

/* ---- the gate ---- */
/**
 * Every line of §5.2 against a release.
 *   store   diskStore(dir) or memoryStore()
 *   tree    treeKeys() of the tree the gate stands on
 *   calm    the calm caps, or null while M46's checker is not in the tree
 * Returns the lines, each with its red entries, and whether all are green.
 */
export function checkRelease(store, tree, { calm = null } = {}) {
  const lines = []
  const line = (name, what) => { const l = { name, what, red: [], notes: [] }; lines.push(l); return l }
  const red = (l, at, why) => l.red.push({ at, why })
  const text = store.read('release.json')
  const L = {
    graph: line('graph', 'every edge and node of the graph has its clip or still in the release, both framings'),
    keys: line('keys', 'all four keys match: motion, picture, global, delivery'),
    files: line('files', 'every rung of every clip and still is on disk at its content address'),
    joins: line('joins', `frame 0 and the last frame equal the two stills' raw masters; between two sessions within ${JOIN_TOLERANCE} of 255`),
    law3: line('law 3', 'a rest pose has one picture, whichever way it was reached'),
    calm: line('calm', "the calm caps of M46 hold on the camera track"),
    track: line('track', 'the browser track agrees with the replay; assertRailProjection never threw'),
    hygiene: line('hygiene', 'zero requests after the clock, starved steps, page errors, pending at rest, painted elements over the canvas, and one mounted set inside a clip'),
    upright: line('upright', 'upright: no frame mostly floor and ceiling'),
    texels: line('texels', 'a plate never shows more texels than its source holds'),
    bytes: line('bytes', 'each rung under its byte line'),
    sampled: line('sampled joins', `ten joins decoded in Chromium, WebKit and Firefox against their stills as one-frame clips, colour included, within ${JOIN_TOLERANCE} of 255 by 16x16 block means`),
  }
  if (!text) {
    red(L.graph, 'release', 'release.json is missing')
    return summarise(lines)
  }
  const release = JSON.parse(text.toString('utf8'))
  if (release.format !== RELEASE_FORMAT) red(L.graph, 'release', `release format ${release.format}, the gate reads ${RELEASE_FORMAT}`)
  const read = (file) => { const b = store.read(file); return b ? JSON.parse(b.toString('utf8')) : null }
  const held = new Map([...release.clips.map((e) => [`${e.clip} ${e.framing}`, { ...e, kind: 'clip' }]), ...release.stills.map((e) => [`${e.node} ${e.framing}`, { ...e, kind: 'still' }])])
  const want = new Map([...[...tree.clips].map(([k, v]) => [k, { ...v, kind: 'clip' }]), ...[...tree.stills].map(([k, v]) => [k, { ...v, kind: 'still' }])])
  for (const at of want.keys()) if (!held.has(at)) red(L.graph, at, `missing (new in the graph)`)
  const orphans = [...held.keys()].filter((at) => !want.has(at))
  if (orphans.length) L.graph.notes.push(`${orphans.length} orphaned (dropped from the graph; kept until the owner deletes them): ${orphans.slice(0, 4).join(', ')}`)
  const sidecars = new Map()
  const drift = []
  for (const [at, entry] of held) {
    const now = want.get(at)
    if (!now) continue
    const sidecar = read(entry.sidecar)
    sidecars.set(at, sidecar)
    // KEYS: the release's record, and the sidecar agreeing with it
    const current = { motion: now.motion, picture: now.picture, global: tree.global.key, delivery: tree.delivery.key }
    const moved = Object.keys(current).filter((k) => entry.keys?.[k] !== current[k])
    if (!sidecar) moved.push('sidecar missing')
    else if (Object.keys(current).some((k) => sidecar.keys?.[k] !== entry.keys?.[k])) moved.push('sidecar disagrees with the release')
    if (moved.length) L.keys.red.push({ at, why: moved.join(', '), moved })
    // FILES
    const rungs = now.kind === 'clip' ? tree.delivery.settings.rungs[now.framing] : stillRungs(tree, now.framing)
    for (const rung of rungs) {
      const f = entry.files?.[rung]
      const bytes = f && store.read(f.file)
      if (!f) red(L.files, at, `${rung}: not in the release`)
      else if (!bytes) red(L.files, at, `${rung}: ${f.file} not on disk`)
      else {
        const digest = sha256(bytes)
        if (digest !== f.sha256 || !f.file.includes(`.${digest.slice(0, 16)}.`) || bytes.length !== f.bytes) red(L.files, at, `${rung}: bytes are not the ones addressed`)
        else if (now.kind === 'clip' && BYTE_LINES[rung]) {
          const kbits = bytes.length * 8 / 1000 / Math.max(now.seconds, 1 / FPS)
          if (kbits > BYTE_LINES[rung]) red(L.bytes, at, `${rung}: ${kbits.toFixed(0)} kbit/s over ${BYTE_LINES[rung]}`)
        }
      }
    }
    if (!sidecar) continue
    if (now.kind === 'still') {
      if (now.histories.prints > 1 || now.histories.exposures > 1) red(L.law3, at, `${now.histories.prints} prints, ${now.histories.exposures} exposures`)
      for (const k of ['pendingAtRest', 'pageErrors', 'paintedOverCanvas']) if (sidecar[k] !== 0) red(L.hygiene, at, `${k} ${sidecar[k]}`)
      continue
    }
    // JOINS
    const from = sidecars.get(`${now.from} ${now.framing}`) ?? read(held.get(`${now.from} ${now.framing}`)?.sidecar ?? '')
    const to = sidecars.get(`${now.to} ${now.framing}`) ?? read(held.get(`${now.to} ${now.framing}`)?.sidecar ?? '')
    for (const [end, node, still, word] of [['first', now.from, from, 'frame 0'], ['last', now.to, to, 'the last frame']]) {
      const verdict = joinVerdict({ end: sidecar.joins?.[end], still: still?.raw, clipSession: entry.session, stillSession: held.get(`${node} ${now.framing}`)?.session, gap: entry.joinGaps?.[end] })
      if (!verdict.holds) red(L.joins, at, `${word} is not the still of ${node}: ${verdict.why}`)
      else if (verdict.between) drift.push(verdict.between)
    }
    // CALM, on the replayed track (the one the key names)
    if (calm) {
      const r = calmReadings(now.samples)
      const over = Object.entries(calm).filter(([k, cap]) => r[k] !== undefined && r[k] > cap + 1e-9)
      if (over.length) red(L.calm, at, over.map(([k, cap]) => `${k} ${r[k].toFixed(1)} over ${cap}`).join(', '))
    }
    // TRACK AND PROJECTION
    if (!(sidecar.track && sidecar.track.maxDeviation <= TRACK_TOLERANCE)) red(L.track, at, `the browser track is ${sidecar.track?.maxDeviation} off the replay`)
    if (sidecar.projectionThrows !== 0) red(L.track, at, `assertRailProjection threw ${sidecar.projectionThrows} times`)
    // HYGIENE
    for (const k of ['requestsAfterClock', 'starvedSteps', 'pageErrors', 'pendingAtRest', 'paintedOverCanvas', 'mountedSetChanges']) {
      if (sidecar[k] !== 0) red(L.hygiene, at, `${k} ${sidecar[k]}`)
    }
    // UPRIGHT
    if (now.framing === 'upright' && !(sidecar.floorCeilingMax <= FLOOR_CEILING_CAP)) red(L.upright, at, `${sidecar.floorCeilingMax} of a frame floor and ceiling, the cap ${FLOOR_CEILING_CAP}`)
    // TEXELS
    if (!(sidecar.plateTexelRatioMax <= TEXEL_CAP)) red(L.texels, at, `a plate at ${sidecar.plateTexelRatioMax} screen pixels a source texel`)
  }
  if (drift.length) L.joins.notes.push(`${drift.length} joins between two sessions part by at most ${Math.max(...drift.map((d) => d.max))} of 255 in at most ${Math.max(...drift.map((d) => d.pixels))} pixels, within the tolerance`)
  if (!calm) L.calm.notes.push(`waiting: no calm caps in the tree (${CALM_FILE} arrives with M46); the line reads them the day it lands`)
  // THE SAMPLED LINE
  const sampled = release.sampledJoins ?? []
  if (sampled.length < SAMPLED_JOINS) red(L.sampled, 'release', `${sampled.length} sampled joins, the line wants ${SAMPLED_JOINS}`)
  const clipFiles = new Map(release.clips.map((c) => [`${c.clip} ${c.framing}`, new Set(Object.values(c.files ?? {}).map((f) => f.sha256))]))
  for (const s of sampled) {
    if (s.statistic !== SAMPLED_STATISTIC) { red(L.sampled, `${s.clip} ${s.framing}`, `${s.end}: read by another statistic (${s.statistic ?? 'none named'})`); continue }
    // a sample names the file it decoded: a clip rendered again since is not what it measured
    if (s.file && !clipFiles.get(`${s.clip} ${s.framing}`)?.has(s.file)) { red(L.sampled, `${s.clip} ${s.framing}`, `${s.end}: measured on a file the release no longer holds`); continue }
    for (const engine of ENGINES) {
      const e = s.engines?.[engine]
      if (!e || !(e.maxDelta <= JOIN_TOLERANCE) || e.colour !== true) red(L.sampled, `${s.clip} ${s.framing}`, `${s.end} in ${engine}: ${e?.maxDelta !== undefined ? `${e.maxDelta} of 255${e.colour ? '' : ', colour not compared'}` : `not decoded${e?.why ? ` (${e.why})` : ''}`}`)
    }
  }
  if (release.renderer === STAND_IN) L.graph.notes.push(STAND_IN)
  return summarise(lines)
}

function summarise(lines) {
  const redClips = new Set()
  for (const l of lines) for (const r of l.red) redClips.add(r.at)
  const keyRed = new Map(lines.find((l) => l.name === 'keys')?.red.map((r) => [r.at, r.moved]) ?? [])
  const byLine = Object.fromEntries(lines.map((l) => [l.name, new Set(l.red.map((r) => r.at))]))
  return { lines, green: lines.every((l) => !l.red.length), redClips, keyRed, byLine }
}

export function formatReport(result, { list = 6 } = {}) {
  const out = []
  for (const l of result.lines) {
    out.push(`${l.red.length ? 'RED  ' : 'green'} ${l.name}: ${l.what}${l.red.length ? ` (${l.red.length} red)` : ''}`)
    for (const r of l.red.slice(0, list)) out.push(`        ${r.at}: ${r.why}`)
    if (l.red.length > list) out.push(`        and ${l.red.length - list} more`)
    for (const n of l.notes) out.push(`        ${n}`)
  }
  if (result.keyRed.size) {
    const by = new Map()
    for (const moved of result.keyRed.values()) for (const k of moved) by.set(k, (by.get(k) ?? 0) + 1)
    out.push(`keys that moved: ${[...by].map(([k, n]) => `${k} ${n}`).join(', ')}`)
  }
  out.push(result.green ? 'THE FILM IS GREEN' : `THE FILM IS RED: ${result.redClips.size} clips and stills`)
  return out.join('\n')
}

async function main() {
  const flags = new Map(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
    const at = a.indexOf('=')
    return at < 0 ? [a.slice(2), true] : [a.slice(2, at), a.slice(at + 1)]
  }))
  const t0 = Date.now()
  const tree = await treeKeys({ rev: String(flags.get('rev') ?? ''), log: (s) => console.log(`  ${s}`) })
  console.log(`the tree at ${tree.revision}: ${tree.clips.size} clips and ${tree.stills.size} stills keyed in ${((Date.now() - t0) / 1000).toFixed(1)} s; global ${tree.global.key.slice(0, 12)}, delivery ${tree.delivery.key.slice(0, 12)}`)
  if (flags.has('stand-in')) {
    const dir = path.resolve(String(flags.get('stand-in')))
    const release = writeStandIn(diskStore(dir), tree)
    console.log(`a stand-in release written to ${dir}: ${release.clips.length} clips, ${release.stills.length} stills`)
    return
  }
  if (!flags.has('release')) { console.log('nothing asked: --release=<dir> or --stand-in=<dir>'); return }
  const calmText = existsSync(path.join(APP_ROOT, CALM_FILE)) ? readFileSync(path.join(APP_ROOT, CALM_FILE), 'utf8') : ''
  const result = checkRelease(diskStore(path.resolve(String(flags.get('release')))), tree, { calm: calmCaps(calmText) })
  console.log(formatReport(result, { list: Number(flags.get('list') ?? 6) }))
  console.log(`the gate in ${((Date.now() - t0) / 1000).toFixed(1)} s`)
  if (!result.green) process.exitCode = 1
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main()
