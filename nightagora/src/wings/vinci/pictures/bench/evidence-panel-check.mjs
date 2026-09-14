#!/usr/bin/env node
/** Execute the production evidence component against a DOM behavior fixture.
 * It proves page selection and retained data, not CSS layout or legibility.
 * Run: node src/wings/vinci/pictures/bench/evidence-panel-check.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import vm from 'node:vm'
import ts from 'typescript'

const filename = new URL('./evidence-panel.ts', import.meta.url)
const source = readFileSync(filename, 'utf8')
const output = ts.transpileModule(source, { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
} }).outputText
const exports = {}
vm.runInNewContext(output, { exports }, { timeout: 2000 })
const { createHangEvidencePanel, evidenceNumber } = exports

class Element {
  constructor(tag) {
    this.tagName = tag.toUpperCase()
    this.className = ''
    this.dataset = {}
    this.attributes = new Map()
    this.listeners = new Map()
    this.childNodes = []
    this.parentNode = null
    this.disabled = false
    this.hidden = false
    this.open = false
  }
  get children() { return this.childNodes.filter(child => child instanceof Element) }
  get textContent() { return this.childNodes.map(child => typeof child === 'string' ? child : child.textContent).join('') }
  set textContent(value) { this.replaceChildren(String(value ?? '')) }
  get tBodies() { return this.children.filter(child => child.tagName === 'TBODY') }
  set innerHTML(_value) { throw new Error('Evidence must be literal text, never injected HTML') }
  append(...children) {
    for (const child of children) {
      if (child instanceof Element) {
        child.remove()
        child.parentNode = this
      }
      this.childNodes.push(child)
    }
  }
  replaceChildren(...children) {
    for (const child of this.children) child.parentNode = null
    this.childNodes = []
    this.append(...children)
  }
  remove() {
    if (!this.parentNode) return
    this.parentNode.childNodes = this.parentNode.childNodes.filter(child => child !== this)
    this.parentNode = null
  }
  setAttribute(key, value) { this.attributes.set(key, String(value)) }
  addEventListener(name, callback) {
    if (!this.listeners.has(name)) this.listeners.set(name, new Set())
    this.listeners.get(name).add(callback)
  }
  removeEventListener(name, callback) { this.listeners.get(name)?.delete(callback) }
  click() { if (!this.disabled) for (const callback of this.listeners.get('click') ?? []) callback() }
}
const document = { createElement: tag => new Element(tag), defaultView: null }
const descendants = root => [root, ...root.children.flatMap(descendants)]
const find = (root, cls) => descendants(root).find(node => node.className.split(/\s+/).includes(cls))
const headings = panel => descendants(panel.root).filter(node => node.className === 'picture-evidence-work').map(node => node.textContent)
const measured = (plate = false) => ({
  width_cm: 50, height_cm: 70, worldWidthM: plate ? .492 : .50, worldHeightM: .70,
  widthPx: plate ? 49.2 : 50, heightPx: 70, pxPerCmX: plate ? .984 : 1, pxPerCmY: 1,
  expectedPxPerCm: 1, expectedWidthPx: 50, expectedHeightPx: 70,
  widthErrorPercent: plate ? 1.6 : 0, heightErrorPercent: 0, maxErrorPercent: plate ? 1.6 : 0,
  datumErrorCm: 0, centerHeightM: 1.55, visible: true, passes: !plate,
})
function snapshot(count = 25) {
  return {
    kind: 'pictures', segment: 'complete-hang', auditReady: true, texturesPending: 0, errors: [],
    viewport: { width: 390, height: 844 },
    works: Array.from({ length: count }, (_, i) => ({ id: `work-${i + 1}`, title: `Work ${i + 1}`,
      class: 'DG', exhibited: true, measurement: measured(),
      plates: [{ id: `plate-${i + 1}`, measurement: measured(true), residency: { preview: true, full: false } }],
    })),
    cost: { tier: 'standard', backend: 'webgpu', draws: 37, triangles: 8192, frameMsP50: 8.3,
      frameMsP95: 9.2, frames: 120, textureMB: 71.4, frameMB: 120, plateTextureMB: 2.3, diffuseGIMB: .0625,
      budget: { draws: 150, triangles: 1200000, textureMB: 256, frameMB: 384 },
    },
    labelAudit: { smallestTargetPx: 44, persistentMarks: 3, brandLines: 1 },
    diffuseGI: { ready: true },
  }
}

const checks = []
const test = (name, run) => { run(); checks.push(name) }

test('Pages two and three survive construction and empty loading snapshots', () => {
  for (const page of [2, 3]) {
    const panel = createHangEvidencePanel({ document, page })
    assert.equal(panel.page(), page)
    panel.update(null)
    panel.update({ loading: true, works: [] })
    assert.equal(panel.page(), page)
    panel.update(snapshot())
    assert.equal(panel.page(), page)
    assert.equal(headings(panel).length, 6)
    assert.ok(headings(panel)[0].startsWith(`${String((page - 1) * 6 + 1).padStart(2, '0')} · Work ${(page - 1) * 6 + 1}`))
    panel.dispose()
  }
})

test('An oversized request clamps only after a real record set arrives', () => {
  const panel = createHangEvidencePanel({ document, page: 99 })
  assert.equal(panel.page(), 99)
  panel.update({ loading: true })
  assert.equal(panel.page(), 99)
  panel.update(snapshot(2))
  assert.equal(panel.page(), 1)
  assert.equal(headings(panel).length, 2)
  panel.dispose()
})

test('One-work pages preserve the six-row route mapping and survive live refresh', () => {
  let notified = 0
  const panel = createHangEvidencePanel({ document, page: (2 - 1) * 6 + 1,
    pageSize: 1, compact: true, onPageChange: page => { notified = page } })
  panel.update(snapshot())
  assert.equal(panel.page(), 7)
  assert.equal(headings(panel).length, 1)
  assert.equal(headings(panel)[0], '07 · Work 7')
  const next = descendants(panel.root).find(node => node.attributes.get('aria-label') === 'Next register page')
  next.click()
  assert.equal(notified, 8)
  panel.update(snapshot())
  assert.equal(panel.page(), 8)
  assert.equal(headings(panel)[0], '08 · Work 8')
  assert.equal(find(panel.root, 'picture-evidence-page').textContent, 'Work 8 of 25')
  panel.dispose()
})

test('Compact geometry exposes a failing plate separately and retains full detail', () => {
  const panel = createHangEvidencePanel({ document, compact: true, pageSize: 1 })
  panel.update(snapshot())
  assert.equal(panel.root.children[0].className, 'picture-evidence-pager')
  const table = find(panel.root, 'picture-evidence-works')
  assert.ok(table.textContent.includes('Field'))
  assert.ok(table.textContent.includes('Plate'))
  assert.ok(table.textContent.includes('49.2 × 70 cm'))
  assert.ok(table.textContent.includes('49.2 × 70 px'))
  assert.ok(table.textContent.includes('Fail'))
  assert.ok(table.textContent.includes('1.6% error'))
  const full = find(panel.root, 'picture-evidence-geometry')
  assert.equal(full.open, false)
  assert.ok(full.textContent.includes('plate-1'))
  assert.ok(full.textContent.includes('expected 50 × 70 px'))
  const renderer = find(panel.root, 'picture-evidence-rendering')
  assert.equal(renderer.open, false)
  assert.ok(renderer.textContent.includes('37 / 150'))
  assert.ok(renderer.textContent.includes('71.4 / 256'))
  assert.ok(panel.root.children.indexOf(renderer) > panel.root.children.indexOf(table))
  panel.dispose()
})

test('Missing plate measurements and pending textures cannot look certified', () => {
  const panel = createHangEvidencePanel({ document, compact: true, pageSize: 1 })
  const data = snapshot(1)
  data.works[0].plates[0].measurement = null
  data.texturesPending = 1
  panel.update(data)
  assert.ok(find(panel.root, 'picture-evidence-works').textContent.includes('No geometry measurement supplied'))
  assert.equal(find(panel.root, 'picture-evidence-state').textContent, 'Settling')
  assert.equal(panel.root.dataset.ready, 'false')
  assert.ok(find(panel.root, 'picture-evidence-errors').textContent.includes('provisional'))
  panel.dispose()
})

test('A tiny nonzero error stays nonzero and the raw snapshot keeps every page', () => {
  assert.notEqual(evidenceNumber(.00000415, 3), '0')
  assert.equal(Number(evidenceNumber(.00000415, 3)), .00000415)
  const panel = createHangEvidencePanel({ document, compact: true, pageSize: 1 })
  const data = snapshot()
  panel.update(data)
  assert.equal(panel.snapshot(), data)
  assert.equal(panel.snapshot().works.length, 25)
  panel.dispose()
})

console.log(JSON.stringify({ checker: 'window-2-evidence-panel', ok: true, checks,
  sourceHash: createHash('sha256').update(source).digest('hex'),
  limitations: [
    'No browser, CSS layout, raster image, EYES job or screenshot is used.',
    'The DOM fixture executes production page/control/content behavior; phone fit and readable geometry rows require actual EYES images.',
    'The raw download button is not activated by this fixture or collected by the stock screenshot rig.',
  ],
}, null, 2))
