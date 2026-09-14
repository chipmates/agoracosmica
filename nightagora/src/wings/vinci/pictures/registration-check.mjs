import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { createContext, runInContext } from 'node:vm'
import ts from 'typescript'

const filename = 'src/wings/vinci/pictures/registration.ts'
const sourceHashes = {}
const read = file => {
  const source = readFileSync(file, 'utf8')
  sourceHashes[file] = createHash('sha256').update(source).digest('hex')
  return source
}
const result = ts.transpileModule(read(filename), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
})
const sandbox = createContext({ exports: {} })
runInContext(result.outputText, sandbox, { filename })
const { PICTURE_DISPLAY_WINDOWS, pictureDisplayWindow, pictureDisplayUV, assessPictureDisplayWindow } = sandbox.exports
const records = JSON.parse(read('src/wings/vinci/pictures/data/store-audit.json')).records
const works = JSON.parse(read('src/wings/vinci/pictures/data/paintings.json')).works
const rows = [], checks = []
for (const window of PICTURE_DISPLAY_WINDOWS) {
  const source = records.find(record => record.id === window.sourceId)
  const evidence = records.find(record => record.id === window.evidenceId)
  assert(source && evidence)
  assert.equal(window.sourceSha256, source.sha256)
  assert.equal(window.evidenceSha256, evidence.sha256)
  assert.equal(pictureDisplayWindow(source), window)
  assert.equal(pictureDisplayWindow({ ...source, sha256: '0'.repeat(64) }), null, 'A replacement must not inherit source coordinates')
  assert.equal(pictureDisplayWindow({ ...source, id: source.id + '-substitute' }), null)
  const work = works.find(work => work.id === source.work_id)
  assert(work)
  const uv = pictureDisplayUV(window)
  const assessed = assessPictureDisplayWindow(window, work)
  if (window.approvedForDisplayCrop) {
    assert(uv && assessed)
    const ratioFromUV = uv.scaleU / uv.scaleV * window.referenceWidth / window.referenceHeight
    assert(Math.abs(ratioFromUV - uv.contentAspect) < 1e-12)
    assert(Math.abs(assessed.widthM / assessed.heightM - uv.contentAspect) < 1e-12, 'Containment must not stretch the selected pixels')
    assert(Math.abs((1 - uv.offsetV - uv.scaleV) - uv.top) < 1e-12, 'Top-left image coordinates must map to the unchanged Three UV orientation')
    assert(assessed.widthM <= work.width_cm / 100 + 1e-12 && assessed.heightM <= work.height_cm / 100 + 1e-12)
    assert.equal(assessed.registeredReproductionPass, false, 'Ratio compatibility cannot authenticate a physical extent')
    assert.equal(assessPictureDisplayWindow(window, { width_cm: null, height_cm: null }), null)
  } else {
    assert.equal(uv, null, 'Clipped/unapproved sources must not become automatic display crops')
    assert.equal(assessed, null)
  }
  rows.push({ id: source.work_id, sourceId: source.id, evidenceId: evidence.id,
    sourceSha256: source.sha256, evidenceSha256: evidence.sha256,
    referencePixels: [window.referenceWidth, window.referenceHeight],
    boundsPx: window.boundsPx, cornersPx: window.cornersPx, uncertaintyPx: window.uncertaintyPx,
    uv, approvedForDisplayCrop: window.approvedForDisplayCrop,
    physicalRegistration: window.physicalRegistration, assessment: assessed })
  checks.push(`${window.sourceId}: exact source/evidence hashes, source replacement rejection, UV orientation, uniform aspect and explicit registration limits`)
}
const anne = PICTURE_DISPLAY_WINDOWS.find(window => window.sourceId.endsWith('__3081x4096'))
assert(anne)
const normal = assessPictureDisplayWindow(anne, { width_cm: 113, height_cm: 168 })
const incorrectSupport = assessPictureDisplayWindow(anne, { width_cm: 130, height_cm: 168 })
assert(normal.nominalWithinOnePercent)
assert(!incorrectSupport.nominalWithinOnePercent, 'Anne enlarged support must not masquerade as the original field')
assert(!normal.registeredReproductionPass)
checks.push('The enlarged Saint Anne support fails the nominal ratio comparison; compatible original ratios still cannot authenticate physical registration')
assert.throws(() => pictureDisplayUV({ ...anne, boundsPx: [-1, 0, 200, 300] }))
assert.throws(() => pictureDisplayUV({ ...anne, boundsPx: [0, 0, Infinity, 300] }))
assert.throws(() => assessPictureDisplayWindow(anne, { width_cm: -113, height_cm: 168 }))
checks.push('Negative or nonfinite source windows and nonphysical work dimensions reject')
const report = { kind: 'window-2-source-display-window-check', sourcesChecked: rows.length,
  ok: true, passed: checks.length, total: checks.length, checks, sourceHashes,
  allExactSourceHashesMatched: true, cropAspectPreserved: true, physicalRegistrationClaims: 0, rows }
console.log(JSON.stringify(report, null, 2))
