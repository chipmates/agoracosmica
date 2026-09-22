#!/usr/bin/env node
/** Execute the production register/scale modules without a browser or renderer.
 * Independent pinhole arithmetic audits projected REAL geometry bounds.
 * Run: node src/wings/vinci/pictures/scale-check.mjs
 * This does not replace the eyes' on-screen scale table or visual proofs.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import * as THREE from 'three';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const pictureRoot = path.dirname(fileURLToPath(import.meta.url));
const checked = [], sourceHashes = {};
const read = filename => {
  const absolute = path.resolve(filename);
  assert(absolute.startsWith(`${root}${path.sep}`), `Read leaves this app: ${filename}`);
  const contents = fs.readFileSync(absolute, 'utf8');
  sourceHashes[path.relative(root, absolute)] = createHash('sha256').update(contents).digest('hex');
  return contents;
};
const source = JSON.parse(read(path.join(root, 'src/wings/vinci/pictures/data/paintings.json')));
const rawManifest = JSON.parse(read(path.join(root, 'public/na-manifest.json')));
const modules = new Map();
function load(filename) {
  const absolute = path.resolve(filename);
  if (modules.has(absolute)) return modules.get(absolute);
  const exports = {};
  modules.set(absolute, exports);
  const compiled = ts.transpileModule(read(absolute), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  const require = specifier => {
    if (specifier === 'three') return THREE;
    assert(specifier.startsWith('.'), `Unexpected external import ${specifier}`);
    if (specifier.endsWith('?raw')) return { default: read(path.resolve(path.dirname(absolute), specifier.slice(0, -4))) };
    return load(path.resolve(path.dirname(absolute), `${specifier}.ts`));
  };
  new vm.Script(compiled, { filename: absolute }).runInNewContext({ exports, require, document: { createElement: tag => new TextAuditElement(tag) } });
  return exports;
}
const register = load(path.join(pictureRoot, 'register.ts'));
const scale = load(path.join(pictureRoot, 'scale.ts'));

/** Execute the complete production policy-label module through the same
 * public constructor exported by buildHang. A minimal DOM fixture models
 * literal text and child order without image loading, CSS, browser or GPU.
 */
class TextAuditElement {
  constructor(tag) {
    this.tagName = tag.toUpperCase();
    this.className = '';
    this.childNodes = [];
    this.dataset = {};
    this.attributes = new Map();
    this.style = { setProperty() {} };
    this.parentElement = null;
  }
  get children() { return this.childNodes.filter(node => node instanceof TextAuditElement); }
  get textContent() { return this.childNodes.map(node => typeof node === 'string' ? node : node.textContent).join(''); }
  set textContent(text) { this.childNodes = [String(text ?? '')]; }
  set innerHTML(_value) { throw new Error('Label audit refuses HTML injection; use literal textContent.'); }
  append(...nodes) { for (const node of nodes) if (node instanceof TextAuditElement) node.parentElement = this; this.childNodes.push(...nodes); }
  prepend(...nodes) { for (const node of nodes) if (node instanceof TextAuditElement) node.parentElement = this; this.childNodes.unshift(...nodes); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
}
function loadLabelConstructor() {
  const index = read(path.join(pictureRoot, 'index.ts'));
  assert.match(index, /export const createWorkLabel = createPolicyWorkLabel/,
    'Audit must execute the public production label constructor.');
  return load(path.join(pictureRoot, 'policy-label.ts')).createPolicyWorkLabel;
}
const createWorkLabel = loadLabelConstructor();
const createPictureRecord = load(path.join(pictureRoot, 'policy-label.ts')).createPictureRecord;
const descendants = element => [element, ...element.children.flatMap(descendants)];
const inheritedLanguage = element => element.lang || (element.parentElement ? inheritedLanguage(element.parentElement) : '');
const labelRows = [], historicalRows = [];
const test = (name, check) => { check(); checked.push(name); };
const manifest = { all: rawManifest.assets, byId: new Map(rawManifest.assets.map(e => [e.id, e])) };
const count = (records, key) => records.reduce((out, record) => {
  out[record[key]] = (out[record[key]] ?? 0) + 1; return out;
}, {});

test('All thirty locked works and every bilingual word remain exact', () => {
  assert.equal(register.REGISTER.length, 30);
  assert.equal(JSON.stringify(register.REGISTER), JSON.stringify(source.works));
  assert.equal(register.REGISTER.filter(w => w.register_status === 'concept_register').length, 29);
  for (const work of register.REGISTER) {
    const locked = source.works.find(w => w.id === work.id);
    for (const key of ['label_first_line_en', 'label_first_line_de', 'licence_line', 'reproduction_note_en', 'reproduction_note_de']) {
      assert.equal(work[key], locked[key], `${work.id}: ${key}`);
    }
  }
});
test('Main hang is all 24 orders, interleaving ten DG and fourteen RC works at 155 cm', () => {
  assert.equal(register.MAIN_HANG.length, 24);
  assert.equal(JSON.stringify(register.MAIN_HANG.map(w => w.hang.order)), JSON.stringify(Array.from({length: 24}, (_, i) => i + 1)));
  assert.deepEqual(count(register.MAIN_HANG, 'rights_class'), { RC: 14, DG: 10 });
  assert(register.MAIN_HANG.every(w => w.hang.eye_height_cm === 155));
});
test('Six commissioned segments survive and every additional record is selectable', () => {
  for (const id of ['early', 'milan', 'florence', 'late', 'absences', 'signature']) assert(register.getSegment(id));
  const covered = new Set(register.SEGMENTS.flatMap(s => s.workIds));
  assert.equal(covered.size, 30);
  for (const work of register.REGISTER) assert(covered.has(work.id), `${work.id} is unreachable`);
  for (const segment of register.SEGMENTS) {
    assert(segment.workIds.includes(segment.initialWorkId));
    if (segment.kind === 'hang') {
      const orders = register.segmentWorks(segment.id).map(w => w.hang.order);
      assert(orders.every((order, i) => i === 0 || order > orders[i - 1]), `${segment.id} changes chronology`);
    }
  }
});
const allPlates = register.REGISTER.flatMap(register.displayPlates);
const resolved = register.REGISTER.flatMap(work => register.findPlateEntries(work, manifest));
test('Three registers retain 120 bilingual titles, inherited language and all locked words in explicit records', () => {
  for (const work of register.REGISTER) {
    const locked = source.works.find(record => record.id === work.id);
    const entries = register.findPlateEntries(work, manifest);
    for (const expanded of [false, true]) {
      const card = expanded ? createPictureRecord(work, entries) : createWorkLabel(work, entries);
      assert.equal(card.dataset.register, expanded ? 'record' : 'drawer');
      if (expanded) assert.equal(card.hidden, true, `${work.id}: record must require explicit opening`);
      else assert.equal(card.dataset.workId, work.id);
      const nodes = descendants(card);
      for (const [language, className] of [['en', 'picture-first'], ['de', 'picture-first-de']]) {
        const matches = nodes.filter(node => node.className.split(/\s+/).includes(className));
        assert.equal(matches.length, 1, `${work.id}: ${language} must have exactly one first line`);
        const rendered = matches[0];
        const original = locked[`label_first_line_${language}`];
        assert.equal(inheritedLanguage(rendered), language, `${work.id}: language metadata inherits its column`);
        assert(rendered.textContent.endsWith(`${locked[`title_${language}`]}.`), `${work.id}: exact ${language} title`);
        assert(!/^(?:Absent|Abwesend)\./.test(rendered.textContent), `${work.id}: obsolete availability prefix`);
        if (!entries.length) assert(rendered.textContent.startsWith(language === 'en' ? 'Not shown.' : 'Nicht gezeigt.'), `${work.id}: absence stated`);
        if (!expanded) assert.equal(rendered.dataset.register, 'label');
        labelRows.push({id: work.id, mode: expanded ? 'record' : 'drawer', language,
          exactTitle: true, inheritedLanguage: true, historicalLineRetainedInRecord: true,
          availabilityAdjusted: rendered.textContent !== original, textSha256: createHash('sha256').update(rendered.textContent).digest('hex')});
      }
      const licenceNodes = nodes.filter(node => node.className === 'picture-licence');
      assert.equal(licenceNodes.length, expanded ? entries.length : 0, `${work.id}: exact source licences belong to the explicit record`);
      if (!expanded) {
        assert.equal(nodes.filter(node => node.className === 'picture-source-reading').length, 2, `${work.id}: bilingual plain source credit`);
        assert(!nodes.some(node => ['picture-honesty', 'picture-source-hash', 'picture-label-evidence'].includes(node.className)), `${work.id}: raw record leaked into drawer`);
      }
      if (expanded) for (const language of ['en', 'de']) {
        const historic = nodes.find(node => node.className === `picture-register-first-${language}`);
        assert.equal(historic?.textContent, locked[`label_first_line_${language}`], `${work.id}: historical first line changed`);
        historicalRows.push({ id: work.id, language, exact: true, textSha256: createHash('sha256').update(historic.textContent).digest('hex') });
      }
      if (expanded) for (const entry of entries) {
        const lines = licenceNodes.filter(node => node.dataset.manifestId === entry.plate.id);
        assert.equal(lines.length, 1, `${entry.id}: exact prepared-manifest licence missing`);
        assert.equal(lines[0].textContent, entry.plate.licence);
        for (const language of ['en', 'de']) if (entry.plate[`honesty_${language}`]) {
          const honesty = nodes.filter(node => node.className === 'picture-honesty' && node.dataset.manifestId === entry.plate.id && inheritedLanguage(node) === language);
          assert.equal(honesty.length, 1, `${entry.id}: ${language} source statement`);
          assert.equal(honesty[0].textContent, entry.plate[`honesty_${language}`]);
        }
        if (entry.plate.source_url) assert(nodes.some(node => node.className === 'picture-source-link' && node.textContent === entry.plate.source_url));
        assert(nodes.some(node => node.className === 'picture-source-hash' && node.textContent === `${entry.plate.id}\nSHA-256 ${entry.plate.sha256}`));
      }
      if (expanded) {
        const raw = JSON.parse(nodes.find(node => node.tagName === 'PRE').textContent);
        assert.deepEqual(raw.collection, locked, `${work.id}: complete locked record, including attribution, licence and original reproduction notes`);
        assert.equal(raw.sources.length, entries.length);
        for (const [index, record] of raw.sources.entries()) {
          assert.deepEqual(record.plate, entries[index].plate);
          assert.deepEqual(record.preview, entries[index].preview);
        }
      }
      if (entries.length === 0) {
        assert(!nodes.some(node => ['IMG', 'PICTURE', 'CANVAS', 'VIDEO', 'IFRAME'].includes(node.tagName)),
          `${work.id}: excluded work label acquired image-bearing content`);
      }
    }
  }
  assert.equal(labelRows.length, 120);
});
test('Historical twelve DG files remain locked while the current source policy admits new plates', () => {
  assert.equal(allPlates.length, 12);
  assert.equal(resolved.length, 31);
  const heldAdmitted = source.held_assets.filter(e => e.display_admitted);
  assert.equal(heldAdmitted.length, 12);
  assert(heldAdmitted.every(e => allPlates.some(p => p.plateFile === e.file)));
  const heldExcluded = source.held_assets.filter(e => !e.display_admitted);
  assert.deepEqual(count(heldExcluded, 'rights_class'), { RC: 19, REF: 1 });
  for (const work of register.REGISTER.filter(w => w.rights_class !== 'DG')) {
    assert.equal(work.plate_file, null); assert.equal(work.plate_pixels, null);
  }
  // The 14 September 2026 reclassification closed the register's last source
  // absence: the 1907 Wilton photogravure supplies the Leda.
  const absent = register.REGISTER.filter(work => !register.findPlateEntries(work, manifest).length).map(w => w.id);
  assert.equal(JSON.stringify(absent), JSON.stringify([]));
  for (const plate of resolved) {
    assert.notEqual(plate.preview.id, plate.plate.id);
    assert.match(plate.plate.sha256, /^[a-f0-9]{64}$/); assert.match(plate.preview.sha256, /^[a-f0-9]{64}$/);
    assert(plate.plate.pixels >= plate.preview.pixels);
    assert.equal(plate.plate.licence, manifest.byId.get(plate.plate.id).licence);
  }
});
test('All current primary and alternate sources are unique policy-validated pairs; superseded files stay unselected', () => {
  const policy = load(path.join(pictureRoot, 'policy.ts'));
  const selections = register.REGISTER.flatMap(work => policy.resolvePicturePolicy(work, manifest).all);
  assert.equal(selections.length, 34);
  const joinedEntries = selections.flatMap(plate => [plate.preview, plate.plate]);
  assert.equal(new Set(joinedEntries.map(e => e.id)).size, 68);
  assert.equal(new Set(joinedEntries.map(e => `${e.wing}/${e.path}`)).size, 68);
  const manifested = rawManifest.assets.filter(e => e.wing === 'wing-vinci' && ['painting-preview', 'painting-plate'].includes(e.role));
  assert.equal(manifested.length, 96);
  assert.equal(manifested.filter(e => e.role === 'painting-plate' && e.tier).length, 36);
  manifested.forEach(entry => policy.validatePaintingRecord(entry));
  const superseded = new Set(manifested.flatMap(e => e.supersedes ?? []));
  assert(selections.every(e => !superseded.has(e.plate.id)));
});
test('Excluded historical metadata cannot manufacture a source or bypass current manifest admission', () => {
  const denied = register.REGISTER.filter(work => work.rights_class !== 'DG');
  assert.equal(denied.length, 19);
  assert.deepEqual(count(denied, 'rights_class'), { RC: 18, REF: 1 });
  const genuine = register.getWork('ginevra-de-benci');
  const legacyRecords = rawManifest.assets.filter(e => !e.tier);
  const legacy = { all: legacyRecords, byId: new Map(legacyRecords.map(e => [e.id, e])) };
  for (const work of denied) {
    const forged = {...work, plate_file: genuine.plate_file, plate_pixels: genuine.plate_pixels,
      additional_plates: genuine.additional_plates, licence_line: genuine.licence_line};
    assert.equal(register.displayPlates(forged).length, 0, `${work.id}: forged plate admitted`);
    assert.equal(register.findPlateEntries(forged, legacy).length, 0, `${work.id}: audit filename admitted without a source`);
    assert.equal(JSON.stringify(register.findPlateEntries(forged, manifest)), JSON.stringify(register.findPlateEntries(work, manifest)),
      `${work.id}: held metadata changed the selected current source`);
  }
});
test('Ginevra reverse shares one panel; locked Isabella drawer metadata and source proportions remain unchanged', () => {
  const ginevra = register.getWork('ginevra-de-benci');
  const faces = register.findPlateEntries(ginevra, manifest);
  assert.equal(faces.length, 2);
  assert.equal(faces[0].workId, faces[1].workId);
  assert.equal(faces[1].face, 'reverse');
  assert.notEqual(faces[0].plate.id, faces[1].plate.id);
  assert.equal(ginevra.height_cm, 38.1);
  const isabella = register.getWork('isabella-deste-cartoon');
  assert.equal(isabella.hang.wall, 'picture-room-drawer');
  assert.equal(isabella.display_mode, 'drawer_crop_beside_empty_full_sheet_outline');
  assert.equal(isabella.height_cm, 61);
  assert.equal(isabella.width_cm, 46.5);
  for (const work of register.REGISTER) for (const plate of register.displayPlates(work)) {
    const size = register.reproductionCardSize(work, plate.pixels);
    assert(Math.abs(size.widthM / size.heightM - plate.pixels.width / plate.pixels.height) < 1e-12);
  }
});
test('Fail closed when a manifest join is missing, mislabeled, reference-only, or nondisplayable', () => {
  const work = register.getWork('madonna-litta');
  const id = `vinci/painting-plate/${work.id}`;
  for (const patch of [{work_id: 'mona-lisa'}, {class: 'REFERENCE-ONLY'}, {display: false}, {wing: 'lobby'}, {path: manifest.byId.get(id).path.replace(work.id, 'mona-lisa')}]) {
    const bad = {...manifest, byId: new Map(manifest.byId)};
    bad.byId.set(id, {...bad.byId.get(id), ...patch});
    bad.all = manifest.all.map(entry => entry.id === id ? bad.byId.get(id) : entry);
    assert.throws(() => register.findPlateEntries(work, bad));
  }
  const missing = {...manifest, byId: new Map(manifest.byId)};
  missing.byId.delete(`vinci/painting-preview/${work.id}`);
  missing.all = manifest.all.filter(entry => entry.id !== `vinci/painting-preview/${work.id}`);
  assert.throws(() => register.findPlateEntries(work, missing));
  const forged = {...register.getWork('mona-lisa'), plate_file: work.plate_file, plate_pixels: work.plate_pixels};
  assert.equal(register.displayPlates(forged).length, 0);
});
test('Unknown dimensions produce no outline; mural and drawer null datums are preserved', () => {
  assert.equal(scale.trueScale(register.getWork('sala-delle-asse')), null);
  assert.equal(scale.trueScale(register.getWork('last-supper')).datumM, null);
  assert.equal(scale.trueScale(register.getWork('isabella-deste-cartoon')).datumM, null);
  const mona = scale.trueScale(register.getWork('mona-lisa'));
  assert.equal(mona.heightM, .794);
  assert.equal(mona.widthM, .534);
  assert.equal(mona.datumM, 1.55);
  assert.throws(() => scale.trueScale({...register.getWork('mona-lisa'), width_cm: 0}));
  assert.throws(() => scale.trueScale({...register.getWork('mona-lisa'), height_cm: NaN}));
});

const projectionRows = [];
const viewports = [
  { width: 1512, height: 950, fov: 42, zoom: 1 },
  { width: 390, height: 844, fov: 50, zoom: 1 },
  { width: 844, height: 390, fov: 36, zoom: 1 },
  { width: 768, height: 1024, fov: 55, zoom: 1.3 },
  { width: 1920, height: 1080, fov: 45, zoom: .8 },
];
test('145 real Three camera projections match independent pinhole arithmetic within one percent', () => {
  for (const work of register.REGISTER) {
    const dimensions = scale.trueScale(work);
    if (!dimensions) continue;
    for (const vp of viewports) {
      const distanceM = 3 + Math.max(dimensions.widthM, dimensions.heightM) * 3;
      const cx = .37, cy = dimensions.datumM ?? 3, cz = .12;
      const camera = new THREE.PerspectiveCamera(vp.fov, vp.width / vp.height, .01, 200);
      camera.zoom = vp.zoom;
      camera.position.set(cx, cy, cz + distanceM);
      camera.lookAt(cx, cy, cz);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld(true);
      const geometry = new THREE.PlaneGeometry(dimensions.widthM, dimensions.heightM);
      const matrix = new THREE.Matrix4().makeTranslation(cx, cy, cz);
      const measurement = scale.measureProjectedWork(work, camera, geometry, matrix, vp);
      // This expected value uses camera creation inputs, not the production
      // projection matrix, helper or converted physical dimensions.
      const independentPxCm = vp.height * vp.zoom / (2 * Math.tan(vp.fov * Math.PI / 360) * distanceM) / 100;
      const independentWidthPx = work.width_cm * independentPxCm;
      const independentHeightPx = work.height_cm * independentPxCm;
      const error = Math.max(Math.abs(measurement.widthPx / independentWidthPx - 1), Math.abs(measurement.heightPx / independentHeightPx - 1)) * 100;
      assert(error < 1, `${work.id} at ${vp.width} × ${vp.height}: ${error}%`);
      assert(measurement.passes, `${work.id}: production measurement failed`);
      assert(Math.abs(measurement.expectedPxPerCm / independentPxCm - 1) < 1e-12);
      projectionRows.push({id: work.id, viewport: `${vp.width}x${vp.height}`, distanceM,
        widthPx: measurement.widthPx, heightPx: measurement.heightPx,
        independentPxPerCm: independentPxCm, errorPercent: error});
      geometry.dispose();
    }
  }
  assert.equal(projectionRows.length, 145);
});
test('Negative controls catch wrong geometry, scaled parents, drifted datum and oblique views', () => {
  const work = register.getWork('mona-lisa');
  const camera = new THREE.PerspectiveCamera(42, 1512 / 950, .01, 100);
  camera.position.set(0, 1.55, 4);
  camera.lookAt(0, 1.55, 0);
  camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
  const vp = {width: 1512, height: 950};
  const correct = new THREE.PlaneGeometry(.534, .794);
  const world = new THREE.Matrix4().makeTranslation(0, 1.55, 0);
  assert(scale.measureProjectedWork(work, camera, correct, world, vp).passes);
  const tooBig = new THREE.PlaneGeometry(.534 * 1.02, .794);
  assert(!scale.measureProjectedWork(work, camera, tooBig, world, vp).passes);
  const scaled = world.clone().multiply(new THREE.Matrix4().makeScale(1, 1.02, 1));
  assert(!scale.measureProjectedWork(work, camera, correct, scaled, vp).passes);
  const wrongDatum = new THREE.Matrix4().makeTranslation(0, 1.56, 0);
  assert(!scale.measureProjectedWork(work, camera, correct, wrongDatum, vp).passes);
  const tilted = world.clone().multiply(new THREE.Matrix4().makeRotationY(.1));
  assert(!scale.measureProjectedWork(work, camera, correct, tilted, vp).passes);
  const wrongRaster = new THREE.PlaneGeometry(.61 * 1022 / 1534, .61);
  assert(!scale.measureProjectedWork(register.getWork('isabella-deste-cartoon'), camera, wrongRaster, world, vp).passes);
  for (const geometry of [correct, tooBig, wrongRaster]) geometry.dispose();
});

console.log(JSON.stringify({
  checker: 'vinci-picture-register-and-projection', replacesEyes: false, ok: true, passed: checked.length,
  tests: checked, sourceHashes, workCounts: count(register.REGISTER, 'rights_class'),
  mainHangCounts: count(register.MAIN_HANG, 'rights_class'), heldFileCounts: count(source.held_assets, 'rights_class'),
  constructedBilingualTitleLines: labelRows.length, exactHistoricalFirstLines: historicalRows.length, labelRows, historicalRows,
  resolvedPlates: resolved.map(p => ({work_id: p.workId, face: p.face, preview: p.preview.id, plate: p.plate.id,
    selectedLicenceVerbatim: p.licenceLine, manifestLicenceVerbatim: p.plate.licence})),
  unmeasured: ['sala-delle-asse'], projectionChecks: projectionRows.length,
  maxProjectionErrorPercent: Math.max(...projectionRows.map(r => r.errorPercent)), projectionRows,
  limitations: [
    'No browser, rendered pixels, GPU, texture downloads, touch or navigation are exercised.',
    'Label checks execute the production policy-label module against a DOM text fixture. Short labels retain literal titles and inherit their column language. Plain drawers carry bilingual readings and credits. Explicit records retain every locked collection word, exact historical first lines, source licences, supplied honesty lines, URLs, hashes and raw records. This does not prove CSS visibility, accessibility-tree exposure, layout or legibility.',
    'Projection tests use production measurement code and actual geometry buffers; the eyes must separately measure the mounted scene.',
    'Held source bytes are not accessed. The commission-provided local manifest is the only store record read.',
  ],
}, null, 2));
