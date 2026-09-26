// THE GATE'S OWN TEST (design §5.3): a clean tree is green, and each of five
// planted changes (a plate's frame, a machine part, a station's exposure, a
// rail pose, the post chain) turns red exactly the clips that see it and
// nothing else; then every line of §5.2 fires on its own entry alone.
//
//   node --test forge/film/film-check.test.mjs
//
// The changes are planted as texts over the tree (the loader's overlay), never
// written to it. The world is mounted once (about two minutes); a planted
// tree builds again only the parts whose files it touches.
import { before, test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { BYTE_EXEMPT, BYTE_LINES, JOIN_TOLERANCE, byteExempt, calmCaps, calmReadings, checkRelease, joinVerdict, lineOf, memoryStore, writeStandIn } from './film-check.mjs'
import { DELIVERY, deliveryKey, treeKeys } from './keys.mjs'
import { APP_ROOT, CERTIFICATE_FILE, WING_DIR, createLoader } from './load.mjs'
import { CELL_M, cellCoords } from './scene.mjs'

const read = (file) => readFileSync(path.join(APP_ROOT, file), 'utf8')
/** One text replaced once in one file, as an overlay. */
function plant(file, from, to) {
  const text = read(file)
  assert.equal(text.split(from).length, 2, `${file} holds the planted text exactly once`)
  return { [file]: text.replace(from, to) }
}
const all = (tree) => [...tree.clips.keys(), ...tree.stills.keys()]
const entry = (tree, at) => tree.clips.get(at) ?? tree.stills.get(at)
/** The cells whose content differs between two trees. */
function changedCells(a, b) {
  const out = new Set()
  for (const [n, h] of a.world.cells.hashes) if (b.world.cells.hashes.get(n) !== h) out.add(n)
  for (const n of b.world.cells.hashes.keys()) if (!a.world.cells.hashes.has(n)) out.add(n)
  return out
}
const sees = (cells, changed) => { for (const n of cells) if (changed.has(n)) return true; return false }
/** Every cell a world box meets. */
function cellsOfBox([x0, y0, z0], [x1, y1, z1]) {
  const out = new Set()
  for (let x = Math.floor(x0 / CELL_M); x <= Math.floor(x1 / CELL_M); x++)
    for (let y = Math.floor(y0 / CELL_M); y <= Math.floor(y1 / CELL_M); y++)
      for (let z = Math.floor(z0 / CELL_M); z <= Math.floor(z1 / CELL_M); z++) out.add(`${x},${y},${z}`)
  return out
}
const inBox = (changed, box) => [...changed].every((n) => box.has(cellCoords(n).join(',')))
const sorted = (set) => [...set].sort()

let clean, release
const gate = (tree, store = release, options) => checkRelease(store, tree, options)

before(async () => {
  clean = await treeKeys({ log: (s) => console.log(`# clean: ${s}`) })
  release = memoryStore()
  writeStandIn(release, clean)
})

test('a clean tree is green on every line', () => {
  const result = gate(clean)
  for (const l of result.lines) assert.deepEqual(l.red, [], `${l.name} is green`)
  assert.equal(result.green, true)
  assert.equal(clean.clips.size, 704)
  assert.equal(clean.stills.size, 184)
  for (const s of clean.stills.values()) assert.deepEqual(s.histories, { prints: 1, exposures: 1 }, `${s.node} ${s.framing} has one picture`)
})

/** The keys line's reds for a planted tree, and that nothing else is red. */
function plantedReds(tree) {
  const result = gate(tree)
  for (const l of result.lines) if (l.name !== 'keys') assert.deepEqual(l.red, [], `${l.name} stays green`)
  return result
}

test('a plate\'s frame turns red exactly the clips that see its cells', async () => {
  const tree = await treeKeys({ overlay: plant(`${WING_DIR}/collection/hang.ts`, '    const back = WALL + .012',
    "    const back = WALL + (work.id === 'mona-lisa' ? .02 : .012)"), log: (s) => console.log(`# frame: ${s}`) })
  const changed = changedCells(clean, tree)
  assert.ok(changed.size > 0, 'the frame moved some cells')
  const loader = await createLoader()
  const field = loader.load(`${WING_DIR}/collection/hang.ts`).hangPlacements().find((f) => f.id === 'mona-lisa')
  const reach = .35
  const box = cellsOfBox([field.east - field.width / 2 - reach, field.datum - field.height / 2 - reach, -field.north - reach],
    [field.east + field.width / 2 + reach, field.datum + field.height / 2 + reach, -field.north + reach])
  assert.ok(inBox(changed, box), 'every moved cell is at the Mona Lisa')
  assert.equal(tree.global.key, clean.global.key)
  const result = plantedReds(tree)
  const expected = new Set(all(clean).filter((at) => sees(entry(clean, at).cells, changed) || sees(entry(tree, at).cells, changed)))
  assert.deepEqual(sorted(result.byLine.keys), sorted(expected))
  for (const [at, moved] of result.keyRed) assert.deepEqual(moved, ['picture'], `${at}: only its picture moved`)
  for (const at of ['stop:picture-room-lisa wide', 'stop:picture-room-lisa upright', 'view:picture/mona-lisa/front wide']) assert.ok(result.byLine.keys.has(at), `${at} is red`)
  for (const at of [...clean.clips.keys()].filter((k) => k.includes('view:picture/mona-lisa/front'))) assert.ok(result.byLine.keys.has(at), `${at} is red`)
  assert.ok(!result.byLine.keys.has('stop:garden wide'), 'the garden is green')
  console.log(`# frame: ${changed.size} cells moved, ${result.byLine.keys.size} of ${all(clean).length} red`)
})

test('a machine part turns red exactly the clips that see its machine', async () => {
  const file = `${WING_DIR}/machines/data/revolving-crane.json`
  const dossier = JSON.parse(read(file))
  const part = dossier.parts.find((p) => p.id === 'counterweight')
  part.dimensions_m.y = +(part.dimensions_m.y + .05).toFixed(3)
  const tree = await treeKeys({ overlay: { [file]: JSON.stringify(dossier, null, 2) }, log: (s) => console.log(`# machine: ${s}`) })
  const changed = changedCells(clean, tree)
  assert.ok(changed.size > 0, 'the part moved some cells')
  const loader = await createLoader()
  const stand = loader.load(`${WING_DIR}/rail-solids.ts`).railExhibitStands['revolving-crane']
  const box = cellsOfBox([stand.east - 8, -20, -stand.north - 8], [stand.east + 8, 20, -stand.north + 8])
  assert.ok(inBox(changed, box), 'every moved cell is at the crane')
  const result = plantedReds(tree)
  const expected = new Set(all(clean).filter((at) => sees(entry(clean, at).cells, changed) || sees(entry(tree, at).cells, changed)))
  assert.deepEqual(sorted(result.byLine.keys), sorted(expected))
  for (const [at, moved] of result.keyRed) assert.deepEqual(moved, ['picture'], `${at}: only its picture moved`)
  const own = [...clean.clips.keys()].filter((k) => k.includes('view:machine/revolving-crane'))
  assert.ok(own.length > 0)
  for (const at of own) assert.ok(result.byLine.keys.has(at), `${at} is red`)
  console.log(`# machine: ${changed.size} cells moved, ${result.byLine.keys.size} of ${all(clean).length} red`)
})

test('a station\'s exposure turns red exactly the clips that stand at it', async () => {
  // the body's own entry of the exposure table (`print.ts`), moved by a twentieth of a stop
  const held = read(`${WING_DIR}/print.ts`).match(/\bbody:([0-9.]+)/)
  const tree = await treeKeys({ overlay: plant(`${WING_DIR}/print.ts`, held[0], `body:${(Number(held[1]) + 0.05).toFixed(2)}`), log: (s) => console.log(`# exposure: ${s}`) })
  assert.equal(changedCells(clean, tree).size, 0, 'no cell moved')
  assert.equal(tree.global.key, clean.global.key, 'the print is not the exposure table')
  const result = plantedReds(tree)
  const expected = new Set(all(clean).filter((at) => entry(clean, at).stations.includes('body')))
  assert.ok(expected.size > 0)
  assert.deepEqual(sorted(result.byLine.keys), sorted(expected))
  for (const [at, moved] of result.keyRed) assert.deepEqual(moved, ['picture'], `${at}: only its picture moved`)
  console.log(`# exposure: ${result.byLine.keys.size} of ${all(clean).length} red`)
})

test('a rail pose turns red exactly the clips that begin or end at it', async () => {
  const railFile = `${WING_DIR}/rail.ts`
  const overlay = plant(railFile, "if(id==='courtyard') return narrow?p(10,-21,1.7,2.6,-12.5,4.8,80):aimedFrom(p(10.98,-22.13,1.7,10.98,-22.13,1.7),-41.04,14.5,60)",
    "if(id==='courtyard') return narrow?p(10,-21,1.7,2.6,-12.5,4.9,80):aimedFrom(p(10.98,-22.13,1.7,10.98,-22.13,1.7),-40.94,14.5,60)")
  // what the certificate writer records for a pose whose aim moved and whose eye did not
  const before = await createLoader(), after = await createLoader({ overlay })
  const poses = [false, true].map((phone) => [before, after].map((l) => {
    const pose = l.load(railFile).stationPose('courtyard', phone)
    return { eye: pose.eye.toArray(), at: pose.at.toArray(), fov: pose.fov }
  }))
  const same = (a, b) => ['eye', 'at'].every((k) => a[k].every((v, i) => Math.abs(v - b[k][i]) <= 1e-6)) && Math.abs(a.fov - b.fov) <= 1e-6
  const certificate = JSON.parse(read(CERTIFICATE_FILE))
  let moved = 0
  const walk = (v) => {
    if (!v || typeof v !== 'object') return
    if (Array.isArray(v.eye) && Array.isArray(v.at) && typeof v.fov === 'number') {
      for (const [old, now] of poses) if (same(v, old)) { v.at = now.at; moved++ }
      return
    }
    for (const x of Object.values(v)) walk(x)
  }
  walk(certificate)
  assert.ok(moved > 0, 'the certificate held the courtyard pose')
  overlay[CERTIFICATE_FILE] = JSON.stringify(certificate)
  const tree = await treeKeys({ overlay, log: (s) => console.log(`# pose: ${s}`) })
  assert.equal(changedCells(clean, tree).size, 0, 'no cell moved')
  const node = (g, id) => g.nodes.find((n) => n.id === id)
  const movedNodes = new Set(clean.graph.nodes.flatMap((n) => Object.keys(n.pose)
    .filter((f) => JSON.stringify(n.pose[f]) !== JSON.stringify(node(tree.graph, n.id).pose[f])).map((f) => `${n.id} ${f}`)))
  assert.ok(movedNodes.size > 0, 'some node stands at the courtyard pose')
  const result = plantedReds(tree)
  const expected = new Set(all(clean).filter((at) => {
    const e = entry(clean, at)
    const framing = at.split(' ').at(-1)
    return e.node ? movedNodes.has(at) : movedNodes.has(`${e.from} ${framing}`) || movedNodes.has(`${e.to} ${framing}`)
  }))
  assert.deepEqual(sorted(result.byLine.keys), sorted(expected))
  for (const [at, m] of result.keyRed) assert.ok(m.includes('motion'), `${at}: its track moved`)
  console.log(`# pose: ${moved} certified poses re-aimed, ${movedNodes.size} rest poses moved, ${result.byLine.keys.size} of ${all(clean).length} red`)
})

test('the post chain turns every clip and still red, by the global key alone', async () => {
  const tree = await treeKeys({ overlay: plant('src/stack/post.ts', 'resolutionScale: 0.25 })', 'resolutionScale: 0.3 })'), log: (s) => console.log(`# post: ${s}`) })
  assert.equal(changedCells(clean, tree).size, 0, 'no cell moved')
  const moved = Object.keys(tree.global.parts).filter((k) => tree.global.parts[k] !== clean.global.parts[k])
  assert.deepEqual(moved, ['src/stack/post.ts'])
  const result = plantedReds(tree)
  assert.deepEqual(sorted(result.byLine.keys), sorted(all(clean)))
  for (const [at, m] of result.keyRed) assert.deepEqual(m, ['global'], `${at}: only the global key moved`)
})

test('every line of §5.2 fires on its own entry and on nothing else', () => {
  const clip = 'stop:line-early>stop:picture-room upright'
  // an exempt clip is never red on bytes: the lines fire on a clip that has one
  const other = [...clean.clips.keys()].find((k) => k.endsWith(' wide') && k !== clip && !byteExempt(clean.clips.get(k).clip))
  const fire = (mutate, options) => {
    const store = release.fork()
    mutate(store)
    return gate(clean, store, options)
  }
  const edit = (store, at, change) => {
    const rel = JSON.parse(store.read('release.json'))
    const e = rel.clips.find((c) => `${c.clip} ${c.framing}` === at)
    const side = JSON.parse(store.read(e.sidecar))
    change(side, e, rel)
    store.write(e.sidecar, JSON.stringify(side))
    store.write('release.json', JSON.stringify(rel))
  }
  const only = (result, name, ats) => {
    for (const l of result.lines) assert.deepEqual(sorted(new Set(l.red.map((r) => r.at))), l.name === name ? sorted(new Set(ats)) : [], `${l.name}`)
  }
  only(fire((s) => edit(s, clip, (side) => { side.pageErrors = 1 })), 'hygiene', [clip])
  only(fire((s) => edit(s, clip, (side) => { side.mountedSetChanges = 2 })), 'hygiene', [clip])
  only(fire((s) => edit(s, clip, (side) => { side.track.maxDeviation = .002 })), 'track', [clip])
  only(fire((s) => edit(s, clip, (side) => { side.projectionThrows = 1 })), 'track', [clip])
  only(fire((s) => edit(s, clip, (side) => { side.floorCeilingMax = .93 })), 'upright', [clip])
  only(fire((s) => edit(s, other, (side) => { side.plateTexelRatioMax = 1.6 })), 'texels', [other])
  only(fire((s) => edit(s, clip, (side) => { side.joins.last = 'another picture' })), 'joins', [clip])
  only(fire((s) => edit(s, clip, (side, e) => { s.files.delete(e.files['480x1038'].file) })), 'files', [clip])
  only(fire((s) => edit(s, clip, (side, e) => { s.write(e.files['720x1558'].file, Buffer.from('not the addressed bytes')) })), 'files', [clip])
  const firstStill = JSON.parse(release.read('release.json')).stills[0]
  only(fire((s) => { s.files.delete(firstStill.files['marks-de'].file) }), 'files', [`${firstStill.node} ${firstStill.framing}`])
  only(fire((s) => edit(s, other, (side, e) => {
    const bytes = Buffer.alloc(Math.ceil(clean.clips.get(other).seconds * 7000 * 1000 / 8) + 1024, 1)
    const digest = createHash('sha256').update(bytes).digest('hex')
    const file = e.files['1920x1080'].file.replace(/\.[0-9a-f]{16}\.mp4$/, `.${digest.slice(0, 16)}.mp4`)
    s.write(file, bytes)
    e.files['1920x1080'] = { file, bytes: bytes.length, sha256: digest }
  })), 'bytes', [other])
  only(fire((s) => edit(s, clip, (side, e, rel) => { rel.sampledJoins[0].engines.webkit.maxDelta = 5 })), 'sampled joins', [`${JSON.parse(release.read('release.json')).sampledJoins[0].clip} ${JSON.parse(release.read('release.json')).sampledJoins[0].framing}`])
  only(fire((s) => edit(s, clip, (side, e, rel) => { rel.clips = rel.clips.filter((c) => c !== e) })), 'graph', [clip])
  // an orphan is named, never red: it waits for the owner
  const orphaned = fire((s) => edit(s, clip, (side, e, rel) => { rel.clips.push({ ...e, clip: 'stop:gone>stop:away' }) }))
  assert.equal(orphaned.green, true)
  assert.ok(orphaned.lines.find((l) => l.name === 'graph').notes.some((n) => n.includes('orphaned')))
  // law 3 on a still reached two ways
  const split = { ...clean, stills: new Map(clean.stills) }
  const still = [...split.stills.keys()][3]
  split.stills.set(still, { ...split.stills.get(still), histories: { prints: 2, exposures: 1 } })
  only(checkRelease(release, split), 'law 3', [still])
  // the calm line reads the caps the calm checker declares, and holds the track to them
  const caps = calmCaps('export const CALM = {\n  turnDegPerSecond: 12,\n  turnDegPerSecond2: 12,\n}\n')
  assert.deepEqual(caps, { turnDegPerSecond: 12, turnDegPerSecond2: 12 })
  const over = [...clean.clips].filter(([, c]) => { const r = calmReadings(c.samples); return r.turnDegPerSecond > 12 + 1e-9 || r.turnDegPerSecond2 > 12 + 1e-9 }).map(([at]) => at)
  only(checkRelease(release, clean, { calm: caps }), 'calm', over)
  console.log(`# calm at 12 deg/s and 12 deg/s2 on today's walk: ${over.length} of ${clean.clips.size} clips over`)
})

test('a join between two sessions holds within the tolerance, and inside one session only by sha256', () => {
  const still = 'a'.repeat(64), other = 'b'.repeat(64)
  const gap = (max, against = still) => ({ pixels: 15123, share: 0.0073, max, still: against })
  assert.equal(joinVerdict({ end: still, still }).holds, true, 'the same picture holds')
  assert.equal(joinVerdict({ end: other, still, clipSession: 's1', stillSession: 's1', gap: gap(1) }).holds, false, 'inside one session a gap is a mismatch')
  assert.equal(joinVerdict({ end: other, still, gap: gap(1) }).holds, false, 'no session recorded: judged as one session')
  const drift = joinVerdict({ end: other, still, clipSession: 's1', stillSession: 's2', gap: gap(JOIN_TOLERANCE) })
  assert.equal(drift.holds, true, 'two sessions within the tolerance hold')
  assert.deepEqual(drift.between, { pixels: 15123, max: JOIN_TOLERANCE })
  assert.equal(joinVerdict({ end: other, still, clipSession: 's1', stillSession: 's2', gap: gap(JOIN_TOLERANCE + 1) }).holds, false, 'a real mismatch stays red')
  assert.equal(joinVerdict({ end: other, still, clipSession: 's1', stillSession: 's2', gap: gap(1, other) }).holds, false, 'a gap measured against another still is not this join')
  assert.equal(joinVerdict({ end: other, still, clipSession: 's1', stillSession: 's2' }).holds, false, 'no gap measured')
})

test('the joins line reads the sessions and the gaps the release carries', () => {
  const clip = 'stop:line-early>stop:picture-room upright'
  const run = (change) => {
    const store = release.fork()
    const rel = JSON.parse(store.read('release.json'))
    const e = rel.clips.find((c) => `${c.clip} ${c.framing}` === clip)
    const side = JSON.parse(store.read(e.sidecar))
    const arrival = rel.stills.find((s) => s.node === 'stop:picture-room' && s.framing === 'upright')
    const raw = JSON.parse(store.read(arrival.sidecar)).raw
    side.joins.last = 'c'.repeat(64)
    change(e, arrival, raw)
    store.write(e.sidecar, JSON.stringify(side))
    store.write('release.json', JSON.stringify(rel))
    const result = gate(clean, store)
    for (const l of result.lines) if (l.name !== 'joins') assert.deepEqual(l.red, [], `${l.name} stays green`)
    return result.lines.find((l) => l.name === 'joins')
  }
  const within = run((e, s, raw) => { e.session = 'run 2'; s.session = 'run 1'; e.joinGaps = { last: { pixels: 900, share: 0.0007, max: 1, still: raw } } })
  assert.deepEqual(within.red, [])
  assert.ok(within.notes.some((n) => n.includes('between two sessions')), 'the drift is named')
  const over = run((e, s, raw) => { e.session = 'run 2'; s.session = 'run 1'; e.joinGaps = { last: { pixels: 139, share: 0.0001, max: 12, still: raw } } })
  assert.deepEqual(over.red.map((r) => r.at), [clip])
  assert.match(over.red[0].why, /up to 12 of 255/)
  const same = run((e, s, raw) => { e.session = 'run 1'; s.session = 'run 1'; e.joinGaps = { last: { pixels: 900, share: 0.0007, max: 1, still: raw } } })
  assert.deepEqual(same.red.map((r) => r.at), [clip])
  assert.match(same.red[0].why, /one session/)
})

/** A rung of a clip in a forked release replaced by bytes at a rate (kbit/s over the graph seconds). */
function plantRate(store, at, rung, kbits) {
  const rel = JSON.parse(store.read('release.json'))
  const e = rel.clips.find((c) => `${c.clip} ${c.framing}` === at)
  const bytes = Buffer.alloc(Math.floor(kbits * clean.clips.get(at).seconds * 1000 / 8), 1)
  const digest = createHash('sha256').update(bytes).digest('hex')
  const file = e.files[rung].file.replace(/\.[0-9a-f]{16}\.mp4$/, `.${digest.slice(0, 16)}.mp4`)
  store.write(file, bytes)
  e.files[rung] = { file, bytes: bytes.length, sha256: digest }
  store.write('release.json', JSON.stringify(rel))
}

test("the grass's legs are exempt from the byte line: their rate is noted, never red", () => {
  const garden = [...new Set([...clean.clips.values()].filter((c) => c.from === 'stop:garden' || c.to === 'stop:garden').map((c) => c.clip))].sort()
  assert.deepEqual(garden, [...BYTE_EXEMPT.clips].sort(), 'the exemption names exactly the clips with the garden at either end')
  const plain = 'stop:line-early>stop:picture-room'
  for (const r of Object.keys(BYTE_LINES)) {
    for (const clip of garden) assert.equal(lineOf(r, clip), undefined, `${clip} ${r}: no line`)
    assert.equal(lineOf(r, plain), BYTE_LINES[r])
  }
  const bytesLine = (plants) => {
    const store = release.fork()
    for (const [at, rung, kbits] of plants) plantRate(store, at, rung, kbits)
    const result = gate(clean, store)
    for (const l of result.lines) if (l.name !== 'bytes') assert.deepEqual(l.red, [], `${l.name} stays green`)
    const l = result.lines.find((x) => x.name === 'bytes')
    return { red: l.red.map((r) => `${r.at} ${r.why.split(':')[0]}`).sort(), notes: l.notes }
  }
  // the exempt clips at three times every rung's line, both framings: green, each rate named
  const exempt = [...clean.clips.values()].filter((c) => byteExempt(c.clip))
  assert.equal(exempt.length, 4, 'two legs, two framings')
  const heavy = exempt.flatMap((c) => clean.delivery.settings.rungs[c.framing].map((r) => [`${c.clip} ${c.framing}`, r, BYTE_LINES[r] * 3]))
  const seen = bytesLine(heavy)
  assert.deepEqual(seen.red, [], 'an exempt clip is never red on bytes')
  for (const c of exempt) {
    const note = seen.notes.find((n) => n.startsWith(`${c.clip} ${c.framing}: exempt`))
    assert.ok(note, `${c.clip} ${c.framing}: its rate is noted`)
    for (const r of clean.delivery.settings.rungs[c.framing]) assert.match(note, new RegExp(`${r} ${BYTE_LINES[r] * 3 - 1}|${r} ${BYTE_LINES[r] * 3}`))
  }
  // the clean release notes the exempt clips too, and nothing else
  assert.equal(bytesLine([]).notes.filter((n) => n.includes(': exempt, uncapped')).length, 4)
  // the same rates on a clip with a line are red on every rung
  const moved = clean.delivery.settings.rungs.wide.map((r) => [`${plain} wide`, r, BYTE_LINES[r] * 3])
  assert.deepEqual(bytesLine(moved).red, moved.map(([at, r]) => `${at} ${r}`).sort())
})

test("the delivery key moves for the grass's legs alone, and a capped encode of them turns them red", () => {
  const plain = deliveryKey(DELIVERY)
  assert.equal(clean.delivery.key, plain, "the tree's delivery key is the delivery's own")
  const gardenClips = [...clean.clips.values()].filter((c) => byteExempt(c.clip)).map((c) => `${c.clip} ${c.framing}`).sort()
  assert.equal(gardenClips.length, 4, 'two legs, two framings')
  for (const [at, c] of clean.clips) {
    if (gardenClips.includes(at)) assert.notEqual(c.delivery, plain, `${at} names the exemption`)
    else assert.equal(c.delivery, plain, `${at} keeps the delivery's own key`)
  }
  // the pilot's garden legs, keyed with the delivery's own key: exactly those four go red, by the delivery key
  const store = release.fork()
  const rel = JSON.parse(store.read('release.json'))
  for (const e of rel.clips.filter((c) => gardenClips.includes(`${c.clip} ${c.framing}`))) {
    e.keys = { ...e.keys, delivery: plain }
    const side = JSON.parse(store.read(e.sidecar))
    side.keys = { ...side.keys, delivery: plain }
    store.write(e.sidecar, JSON.stringify(side))
  }
  store.write('release.json', JSON.stringify(rel))
  const result = gate(clean, store)
  for (const l of result.lines) assert.deepEqual(sorted(new Set(l.red.map((r) => r.at))), l.name === 'keys' ? gardenClips : [], `${l.name}`)
  for (const at of gardenClips) assert.deepEqual(result.keyRed.get(at), ['delivery'])
})
