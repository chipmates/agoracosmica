// THE GLOBAL KEY LEAVES OUT WHAT ANOTHER KEY CARRIES: a recipe record of the
// wing's index or of the camera's modules, re-recorded after an edit, moves
// no global input; the sky's own inputs still move it. Each edit is planted
// over the tree (the loader's overlay) and re-recorded in the library as the
// provenance step records it (a record's sha256 is its recipe file's).
//
//   node --test forge/film/global-key.test.mjs
import { before, test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { MOTION_FILES, carriedElsewhere, eveningCode, exposures, globalKey, recipeFilesOf, treeKeys } from './keys.mjs'
import { APP_ROOT, WING_DIR, createLoader } from './load.mjs'
import { openReplay } from './replay.mjs'
import { libraryOf } from './scene.mjs'
import { mergeManifests } from '../vite-na-assets.mjs'

const INDEX = `${WING_DIR}/index.ts`
const read = (file) => readFileSync(path.join(APP_ROOT, file), 'utf8')
const sha256 = (text) => createHash('sha256').update(text).digest('hex')
/** One text replaced once in one file, as an overlay. */
function plant(file, from, to) {
  const text = read(file)
  assert.equal(text.split(from).length, 2, `${file} holds the planted text exactly once`)
  return { [file]: text.replace(from, to) }
}
/** The provenance step's re-record: a record whose one recipe file the overlay rewrote takes that file's new hash. */
function rerecord(library, overlay) {
  const hit = []
  const out = library.map((e) => {
    const files = recipeFilesOf(e)
    if (files.length !== 1 || !(files[0] in overlay)) return e
    hit.push(e.id)
    return { ...e, sha256: sha256(overlay[files[0]]) }
  })
  return { library: out, rerecorded: hit }
}
const store = libraryOf(mergeManifests())
const keyAt = async (overlay, library) => globalKey(await createLoader({ overlay }), { library, claimed: new Set() })
const movedParts = (a, b) => [...new Set([...Object.keys(a.parts), ...Object.keys(b.parts)])].filter((k) => a.parts[k] !== b.parts[k]).sort()
const declaring = (loader) => [INDEX, `${WING_DIR}/print.ts`].map((f) => loader.text(f)).join('\n')

let clean
before(async () => { clean = await treeKeys({ library: store, log: (s) => console.log(`# clean: ${s}`) }) })

test("a UI-only edit of the wing's index, re-recorded, leaves the global key where it was", async () => {
  const overlay = plant(INDEX, '  function paintPictureWords():void {\n    if(!pictureWordsLayer||!hosts)return\n',
    '  function paintPictureWords():void {\n    if(!pictureWordsLayer||!hosts||document.hidden)return\n')
  const { library, rerecorded } = rerecord(store, overlay)
  assert.deepEqual(rerecorded, ['vinci/sky'], "the sky's record names the index as its recipe, and moves with it")
  const before = await keyAt({}, store), after = await keyAt(overlay, library)
  assert.deepEqual(movedParts(before, after), [], 'no global input moved')
  assert.equal(after.key, before.key)
  // the index's other readings stand too: the stations' exposures and the evening's code
  const was = await createLoader(), now = await createLoader({ overlay })
  assert.deepEqual(exposures(declaring(now)).table, exposures(declaring(was)).table)
  assert.equal(eveningCode(now), eveningCode(was))
  // and no track or cell reads the index: neither the replay nor the world's parts load it
  const replay = await openReplay({ overlay })
  assert.ok(!replay.wing.loader.sources().some((s) => s.file === INDEX), 'the replay reads no index')
  assert.ok(!clean.world.files.some(([f]) => f === INDEX), "the world's parts read no index")
})

test('a record no other key carries still moves the global key when re-recorded', async () => {
  const file = `${WING_DIR}/grave/court.ts`
  const record = store.find((e) => recipeFilesOf(e).length === 1 && recipeFilesOf(e)[0] === file)
  assert.ok(record, 'the grave court keeps its recipe record')
  const overlay = { [file]: `${read(file)}\n// planted\n` }
  const { library } = rerecord(store, overlay)
  const before = await keyAt({}, store), after = await keyAt(overlay, library)
  assert.ok(!carriedElsewhere(record, new Set(Object.keys(before.parts))), 'the court is read by no other key')
  assert.deepEqual(movedParts(before, after), ['library sets no plate claims'])
})

test('a rail pacing edit, re-recorded, moves only the MOTION keys of the clips it walks', async () => {
  const overlay = plant(`${WING_DIR}/rail.ts`, 'const STOP_TO_STOP_PACE=1.4', 'const STOP_TO_STOP_PACE=1.5')
  const { library, rerecorded } = rerecord(store, overlay)
  assert.deepEqual(rerecorded, ['vinci/rail'])
  const tree = await treeKeys({ overlay, library, log: (s) => console.log(`# pace: ${s}`) })
  assert.deepEqual(movedParts(clean.global, tree.global), [], 'no global input moved')
  assert.equal(tree.global.key, clean.global.key)
  const cells = [...clean.world.cells.hashes].filter(([n, h]) => tree.world.cells.hashes.get(n) !== h)
  assert.equal(cells.length, 0, 'no cell moved')
  for (const [at, s] of clean.stills) assert.deepEqual([tree.stills.get(at)?.motion, tree.stills.get(at)?.picture], [s.motion, s.picture], `${at} stands as it stood`)
  for (const [at, e] of clean.evenings) assert.deepEqual([tree.evenings.get(at)?.motion, tree.evenings.get(at)?.picture], [e.motion, e.picture], `${at} as it was`)
  const edges = new Map(clean.graph.edges.map((e) => [e.id, e]))
  let motion = 0, both = 0
  for (const [at, c] of clean.clips) {
    const now = tree.clips.get(at)
    assert.equal(now.delivery, c.delivery, `${at}: the delivery key stands`)
    if (now.motion === c.motion) { assert.equal(now.picture, c.picture, `${at}: a picture key moves only with its track`); continue }
    const edge = edges.get(c.clip)
    assert.ok(edge.kinds.includes('STEP') && edge.motion.rail === 'wall' && edge.motion.quick === true, `${at}: only a wall step walks at the stop-to-stop pace`)
    if (now.picture === c.picture) motion++
    else both++
  }
  assert.ok(motion + both > 0, 'the pace moved the wall steps')
  console.log(`# pace: ${motion} clips moved by their track alone, ${both} by their track and what it sees, of ${clean.clips.size}`)
})

test("the sky's own inputs still move the global key: its settings in the house, the displayed haze, the probe, the day's evening weights", async () => {
  const before = await keyAt({}, store)
  const cases = [
    [INDEX, 'sky.turbidity.value=4;sky.rayleigh.value=1.4;sky.cloudScale', 'sky.turbidity.value=4;sky.rayleigh.value=1.5;sky.cloudScale', `${INDEX}#buildTheHouse`],
    [`${WING_DIR}/display-sky-haze.ts`, 'clearElevationDeg: 12,', 'clearElevationDeg: 13,', `${WING_DIR}/display-sky-haze.ts`],
    [`${WING_DIR}/sky-probe.ts`, 'const az = r.sun.azimuth * Math.PI / 180', 'const az = (r.sun.azimuth + 1) * Math.PI / 180', `${WING_DIR}/sky-probe.ts`],
    [`${WING_DIR}/farewell-sky.ts`, 'share: uniform(0), disc: uniform(0)', 'share: uniform(.1), disc: uniform(0)', `${WING_DIR}/farewell-sky.ts#createEveningSky`],
  ]
  for (const [file, from, to, part] of cases) {
    const overlay = plant(file, from, to)
    const after = await keyAt(overlay, rerecord(store, overlay).library)
    assert.notEqual(after.key, before.key, `${file}: the global key moves`)
    assert.deepEqual(movedParts(before, after), [part], `${file}: by ${part} alone`)
  }
})

test("the camera's modules are the replay's: each is read by it or stood in by it, and none makes a light", async () => {
  const replay = await openReplay()
  replay.wing.rail.stationPose('courtyard', false)
  const read = new Set(replay.wing.loader.sources().map((s) => s.file))
  const stood = new Set([`${WING_DIR}/rail-fingerprint.ts`])
  const LIGHT = /new\s+(?:THREE\.)?(?:Point|Spot|RectArea|Directional|Hemisphere|Ambient)Light\b|LightProbe/
  const loader = await createLoader()
  for (const file of MOTION_FILES) {
    assert.ok(read.has(file) || stood.has(file), `${file}: the replay reads it`)
    assert.ok(!LIGHT.test(loader.text(file)), `${file}: it makes no light`)
  }
  // every record the library part leaves out, and why
  const parts = new Set(Object.keys(globalKey(loader, { library: store, claimed: new Set() }).parts))
  const out = store.filter((e) => carriedElsewhere(e, parts)).map((e) => e.id).sort()
  console.log(`# carried elsewhere: ${out.join(', ')}`)
  assert.ok(out.includes('vinci/sky') && out.includes('vinci/rail') && out.includes('vinci/rail-clearance'))
})
