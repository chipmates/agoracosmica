// A MACHINE CYCLE IS KEYED BY WHAT ITS ISLAND DRAWS FROM: a copy or chrome
// edit moves no cycle, a machine's own module moves its cycle alone, and the
// island's stage, the payload it is handed and the wiring move every cycle.
// Each edit is planted over the tree (the loader's overlay), never written.
//
//   node --test forge/film/cycle-key.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { closure, cycleKey, isInterface, machineSlugs } from './keys.mjs'
import { APP_ROOT, WING_DIR, createLoader } from './load.mjs'

const read = (file) => readFileSync(path.join(APP_ROOT, file), 'utf8')
/** One text replaced once in one file, as an overlay. */
function plant(file, from, to, base = {}) {
  const text = base[file] ?? read(file)
  assert.equal(text.split(from).length, 2, `${file} holds the planted text exactly once`)
  return { ...base, [file]: text.replace(from, to) }
}
const keysAt = async (overlay = {}) => {
  const loader = await createLoader({ overlay })
  return Object.fromEntries(machineSlugs(loader).map((s) => [s, cycleKey(loader, s).key]))
}
const moved = (a, b) => Object.keys(a).filter((s) => a[s] !== b[s]).sort()
const clean = await keysAt()
const TURNTABLE = 'src/wings/vitrine/turntable.ts'

test('the machines the island builds, each keyed apart', async () => {
  assert.equal(Object.keys(clean).length, 15)
  assert.ok(Object.keys(clean).includes('aerial-screw') && Object.keys(clean).includes('mechanical-lion'))
  assert.equal(new Set(Object.values(clean)).size, 15, 'no two machines share a key')
})

test('(1) a copy edit in the interface words or the disclosures leaves every cycle key', async () => {
  // both reached the old key through the close look's closure
  const old = closure(await createLoader(), `${WING_DIR}/film-look.ts`, 'src/')
  for (const file of ['src/wings/content.ts', 'src/content/disclosures.ts']) {
    assert.ok(old.includes(file), `${file} was in the old island closure`)
    const overlay = { [file]: `${read(file)}\n// planted copy edit\nexport const PLANTED_LINE = { en: 'A door to learn', de: 'Eine Tür zum Lernen' }\n` }
    assert.deepEqual(moved(clean, await keysAt(overlay)), [], `${file}: no cycle moved`)
  }
})

test('(2) a phone-form or film-wing edit leaves every cycle key, even imported by a drawing module', async () => {
  const PHONE = `${WING_DIR}/phone-form.ts`, FILM_WING = `${WING_DIR}/film-wing.ts`
  // the phone form written and reached from the island's stage, the film wing reached from the print
  let base = { [PHONE]: "export const PHONE_FORM = { rows: 2 }\n" }
  base = plant(TURNTABLE, "import { createBenchBackdrop } from '../vinci/machines/bench/backdrop'\n",
    "import { createBenchBackdrop } from '../vinci/machines/bench/backdrop'\nimport { PHONE_FORM } from '../vinci/phone-form'\n", base)
  const printFile = `${WING_DIR}/print.ts`
  base = { ...base, [printFile]: `import { createWing } from './film-wing'\n${read(printFile)}` }
  assert.ok(isInterface(PHONE) && isInterface(FILM_WING))
  const planted = await keysAt(base)
  assert.equal(moved(clean, planted).length, 15, 'the planted imports themselves are edits of drawing modules')
  assert.deepEqual(moved(planted, await keysAt({ ...base, [PHONE]: "export const PHONE_FORM = { rows: 3 }\n" })), [], 'a phone-form edit moves no cycle')
  assert.deepEqual(moved(planted, await keysAt(plant(FILM_WING, 'export function createWing', '/* planted */\nexport function createWing', base))), [], 'a film-wing edit moves no cycle')
})

test("(3) an edit to a machine's own module or dossier moves that machine's cycle, and only it", async () => {
  const screw = `${WING_DIR}/machines/aerial-screw.ts`
  assert.deepEqual(moved(clean, await keysAt(plant(screw, "return makeMachine(stack, machineCatalog['aerial-screw'])",
    "const record = machineCatalog['aerial-screw']\n  return makeMachine(stack, record)"))), ['aerial-screw'])
  const crane = `${WING_DIR}/machines/data/revolving-crane.json`
  const dossier = JSON.parse(read(crane))
  assert.deepEqual(moved(clean, await keysAt({ [crane]: JSON.stringify({ ...dossier, planted: true }, null, 2) })), ['revolving-crane'])
})

test("the island's stage, the payload it is handed and the wiring still move every cycle", async () => {
  const all = Object.keys(clean).sort()
  const cases = [
    [TURNTABLE, 'import { islandFit } from \'./fit\'\n', 'import { islandFit } from \'./fit\'\nconst PLANTED_STAGE = 1\n'],
    [`${WING_DIR}/machines/runtime.ts`, 'export function makeMachine', '/* planted */\nexport function makeMachine'],
    [`${WING_DIR}/collection/close-look.ts`, 'export function createVinciMachinePayload(options: {', 'export function createVinciMachinePayload(options: {\n  planted?: boolean'],
    [`${WING_DIR}/film-look.ts`, 'const makeLive = () => {', 'const makeLive = () => {\n        void 0'],
  ]
  for (const [file, from, to] of cases) assert.deepEqual(moved(clean, await keysAt(plant(file, from, to))), all, `${file}: every cycle moves`)
  // a close-look edit outside the machine's payload is the interface's
  const look = `${WING_DIR}/collection/close-look.ts`
  assert.deepEqual(moved(clean, await keysAt({ [look]: `${read(look)}\nexport const PLANTED_CARD_WORD = 'planted'\n` })), [], 'a new word beside the payload moves no cycle')
})
