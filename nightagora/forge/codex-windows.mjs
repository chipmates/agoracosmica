/* THE DISPLAY WINDOW OF A PRINTED PLATE ON THE SHELF, measured off the store.
 *
 * Two books of the shelf are printed facsimiles: every side of the Codex
 * Arundel and of the Codex Trivulzianus is a scan of a whole printed page with
 * the plate of the manuscript leaf in its middle. A reader opening a side
 * wants the leaf, so each side's window is the plate's own rectangle, read by
 * the same measure the 1883 edition's leaves are read by
 * (`forge/leaf-windows.mjs`), and the pan still reaches the printed page.
 * The other books are scans of the manuscripts themselves and open whole.
 *
 *   node forge/codex-windows.mjs            measure and write the windows
 *   node forge/codex-windows.mjs --check    measure and compare, write nothing
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { AGAINST_THE_EDITION, measure, quantile } from './leaf-windows.mjs'
import { STORE } from './vite-na-assets.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SIDES = join(HERE, '..', 'src', 'wings', 'vinci', 'table', 'data', 'codex-sides.json')
const PRINTED = ['arundel', 'trivulzianus']

const doc = JSON.parse(readFileSync(SIDES, 'utf8'))
for (const id of PRINTED) {
  const sides = doc.codices[id].sides
  const read = []
  for (const side of sides) {
    const file = join(STORE, 'wing-vinci', side.file)
    if (!existsSync(file)) throw new Error(`no scan at wing-vinci/${side.file}`)
    read.push((await measure(file)).window)
  }
  // EACH FACSIMILE IS ITS OWN REFERENCE: a reading much under the book's
  // median plate is refused, and that side opens at the whole page
  const spans = read.filter(Boolean)
  const floor = {
    across: quantile(spans.map(w => w.right - w.left), .5) * AGAINST_THE_EDITION,
    down: quantile(spans.map(w => w.bottom - w.top), .5) * AGAINST_THE_EDITION,
  }
  let kept = 0
  sides.forEach((side, at) => {
    const window = read[at]
    delete side.window
    if (window && window.right - window.left >= floor.across && window.bottom - window.top >= floor.down) {
      side.window = window
      kept++
    }
  })
  console.log(`${id}: ${sides.length} side(s), ${kept} plate window(s), ${sides.length - kept} whole page(s)`)
}
doc.provenance.windows = 'The printed plate\'s rectangle on each page of the Arundel and Trivulzianus facsimiles, '
  + 'measured by forge/codex-windows.mjs with the reading of forge/leaf-windows.mjs; a reading under '
  + `${AGAINST_THE_EDITION} of the book's median plate opens the whole page. No physical registration is claimed.`
const text = `${JSON.stringify(doc, null, 1)}\n`
if (process.argv.includes('--check')) {
  const same = readFileSync(SIDES, 'utf8') === text
  console.log(same ? 'the record on disk is the measurement' : 'THE RECORD ON DISK DIFFERS')
  process.exit(same ? 0 : 1)
}
writeFileSync(SIDES, text)
console.log('written codex-sides.json')
