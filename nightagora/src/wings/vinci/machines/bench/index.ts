import { Box3, type BufferGeometry, Color, Fog, Group, Mesh, MeshStandardNodeMaterial, PerspectiveCamera, type PlaneGeometry, Scene, Vector3 } from 'three/webgpu';
import type { Stack, KeyLight, MaterialSet } from '../../../../stack';
import { float, fog, positionWorld, rangeFogFactor, smoothstep, uv, vec3 } from 'three/tsl';
import { IDENTITY } from '../../../../stack/grade';
import { loadManifest, type ManifestEntry } from '../../../../manifest';
import { assetAddress } from '../../../../stack/materials';
import { loadMachineMaterial, materialDressed, materialFailure } from '../parts';
import { buildMachine, type ReadyMachineBuild } from '..';
import type { StoreCrane, StoreCraneReading } from '../crane-body';
import { MACHINE_SLUGS, isMachineSlug, machineCatalog, partialCatalog, type Language, type MachineSlug, type EvidenceRecord } from '../catalog';
import benchCss from './bench.css?inline';
import titleSelectCss from './title-select.css?inline';
import evidenceCss from './evidence-dialog.css?inline';
import { createEvidenceDialog } from './evidence-dialog';
import { controlCopy, controlLanguage, addressWithLanguage, playbackOnReducedMotionChange } from './control-polish';
import { wrapTitleSelect } from './title-select';
import { applyRopeShadowExperiment } from './rope-shadow-proposal';
import { buildBenchSupports } from './supports';
import { createBenchMetrics } from './metrics';
import { createBenchBackdrop } from './backdrop';
import { BACK_PLANE_AIR, BACK_PLANE_METRES, BENCH_BACK_PLANE, backPlaneMaterial, buildBackPlane } from './back-plane';
import { createBenchHour, benchHourRecord, BENCH_SUN_AZIMUTH_DEGREES, BENCH_SUN_ELEVATION_DEGREES } from './hour';
import { BENCH_ABSENCE, holderName, setRegister, withoutCitations } from './registers';
import { setBenchKey } from '../key';
import { playbackSchedule, initialPlayback, advancePlayback, togglePlayback, restartPlayback, freezePlayback, playbackPresentation } from './playback';
// The eyes intentionally removes the Vite HMR client; inline CSS has no HMR imports.
const sheet = document.createElement('style');
sheet.dataset['vinciBench'] = '';
sheet.textContent = benchCss + '\n' + titleSelectCss + '\n' + evidenceCss;
document.head.append(sheet);
export interface BenchOptions {
  slug?: string;
  t?: number;
  /** frame the working end alone, for a state that proves a fitting reads */
  close?: boolean;
  lang?: Language;
  section?: boolean;
  evidence?: string;
  clothProbe?: 'no-shadow' | 'flat-normal';
  ropeProbe?: 'baseline' | 'no-shadow' | 'flat-normal' | 'offset-2mm';
}
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] => { const n = document.createElement(tag); n.className = cls; if (text !== undefined)
  n.textContent = text; return n; };
const localText = (lang: Language, en: string, de: string): string => lang === 'de' ? de : en;
/** Locked page markup supplies links, while the visitor reads its exact link text. */
function appendLinkedText(host: HTMLElement, text: string): void {
  const links = /\[([^\]]+)\]\(((?:https?:\/\/|\.\.?\/)[^\s)]+)\)/g;
  let at = 0;
  for (const match of text.matchAll(links)) {
    const start = match.index;
    host.append(document.createTextNode(text.slice(at, start)));
    const target = match[2] ?? '';
    if (/^https?:\/\//.test(target)) {
      const anchor = el('a', '', match[1]);
      anchor.href = target;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      host.append(anchor);
    }
    else {
      const reference = el('span', 'bench-local-source', match[1]);
      reference.dataset['sourcePath'] = target;
      host.append(reference);
    }
    at = start + match[0].length;
  }
  host.append(document.createTextNode(text.slice(at)));
}
function appendPageBody(host: HTMLElement, text: string): void {
  for (const paragraph of text.split(/\n\s*\n/)) {
    const lines = paragraph.split('\n');
    if (lines.every(line => /^\d+\.\s/.test(line))) {
      const list = el('ol', 'bench-citations');
      for (const line of lines) {
        const item = el('li', '');
        appendLinkedText(item, line.replace(/^\d+\.\s/, ''));
        list.append(item);
      }
      host.append(list);
    }
    else {
      const p = el('p', '');
      appendLinkedText(p, paragraph);
      host.append(p);
    }
  }
}
/** A separate scene, reusing the application's renderer and material library. */
export function createBench(stack: Stack, onExit: () => void) {
  const scene = new Scene();
  scene.background = new Color('#1a2026');
  const backdrop = createBenchBackdrop();
  scene.backgroundNode = backdrop;
  const camera = new PerspectiveCamera(34, innerWidth / innerHeight, .001, 1000);
  const display = new Group();
  scene.add(display);
  const host = el('main', 'bench');
  host.hidden = true;
  host.setAttribute('aria-label', 'Leonardo da Vinci machine bench');
  document.body.append(host);
  const header = el('header', 'bench-header');
  // One persistent mark carries the brand, the wing and the count, so a
  // visitor is told where they stand without spending a second mark on it.
  const mark = el('div', 'bench-mark');
  mark.dataset['naPersistent'] = '';
  const brand = el('p', 'bench-brand', 'Night Agora');
  brand.dataset['naBrand'] = '';
  const kicker = el('p', 'bench-kicker');
  const kickerWing = el('span', 'bench-kicker-wing');
  const kickerHere = el('span', 'bench-kicker-here');
  kicker.append(kickerWing, kickerHere);
  mark.append(brand, kicker);
  const exit = el('a', '', 'The museum ↗');
  exit.href = '/w/vinci';
  exit.dataset['naPersistent'] = '';
  exit.addEventListener('click', e => { e.preventDefault(); onExit(); });
  header.append(mark, exit);
  const dock = el('aside', 'bench-dock');
  const textBlock = el('div', 'bench-text');
  const title = el('h1', 'bench-title');
  const certainty = el('div', 'bench-certainty');
  const dot = el('i', 'bench-dot');
  const certaintyWord = el('span', '');
  certainty.append(dot, certaintyWord);
  const label = el('p', 'bench-label');
  label.dataset['naClaim'] = 'inferred';
  label.dataset['naAnchorClass'] = 'GENERATED';
  const dimensions = el('p', 'bench-dim');
  textBlock.append(title, certainty, label, dimensions);
  const folio = el('figure', 'bench-folio');
  const scope = el('p', 'bench-scope');
  for (const spoken of [title, certainty, label, dimensions]) setRegister(spoken, 'label');
  for (const explained of [folio, scope]) setRegister(explained, 'drawer');
  const languages = el('div', 'bench-lang');
  const en = el('button', '', 'EN'), de = el('button', '', 'DE');
  languages.append(en, de);
  const read = el('button', 'bench-read', 'Read the evidence ↗');
  const holdNote = el('p', 'bench-hold');
  holdNote.hidden = true;
  const hour = createBenchHour(controlLanguage(location.search));
  dock.append(languages, textBlock, folio, holdNote, scope, hour.element, read);
  const footer = el('footer', 'bench-footer');
  footer.dataset['naPersistent'] = '';
  const nav = el('nav', 'bench-nav');
  nav.setAttribute('aria-label', 'Machines');
  const previous = el('button', '', '←');
  previous.setAttribute('aria-label', 'Previous machine');
  const next = el('button', '', '→');
  next.setAttribute('aria-label', 'Next machine');
  const select = el('select', '');
  select.setAttribute('aria-label', 'Machine');
  const chooser = wrapTitleSelect(select);
  nav.append(previous, chooser.element, next);
  const section = el('button', 'bench-section', 'Open section');
  section.hidden = true;
  const sectionNote = el('p', 'bench-section-note');
  sectionNote.hidden = true;
  const actions = el('div', 'bench-actions');
  actions.append(read, section);
  dock.append(actions, sectionNote);
  const playback = el('div', 'bench-playback');
  const play = el('button', '', 'Pause');
  const restart = el('button', '', 'Restart');
  const timeLabel = el('output', 'bench-time');
  playback.append(play, restart, timeLabel);
  footer.append(nav, playback);
  const source = el('section', 'bench-source');
  source.hidden = true;
  source.setAttribute('aria-label', 'Evidence');
  source.setAttribute('role', 'dialog');
  source.setAttribute('aria-modal', 'true');
  const sourceClose = el('button', 'bench-source-close', '×');
  sourceClose.setAttribute('aria-label', 'Close evidence');
  const page = el('article', 'bench-page');
  setRegister(page, 'record');
  source.append(sourceClose, page);
  const loading = el('p', 'bench-loading', 'Preparing the object');
  loading.hidden = true;
  host.append(header, dock, footer, source, loading);
  const metrics = createBenchMetrics(stack, host);
  let metricsTier = metrics ? stack.tierName() : null;
  let closeUp = false;
  let active = false, serial = 0, slug: MachineSlug = 'aerial-screw', lang: Language = controlLanguage(location.search), machine: ReadyMachineBuild | null = null, key: KeyLight | null = null, ready = false, lastWall = performance.now(), folioEntry: ManifestEntry | undefined, evidenceRecord: EvidenceRecord | null = null, sectionEnabled = false, lastPlaybackPaint = 0;
  let schedule = playbackSchedule(machineCatalog[slug].dossier);
  let playbackState = initialPlayback(schedule, { fixed: true });
  const supportGeometries: BufferGeometry[] = [], supportMaterials: MeshStandardNodeMaterial[] = [], supportSets: MaterialSet[] = [];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const evidence = createEvidenceDialog({
    host, source, page, closeButton: sourceClose, partialRecords: partialCatalog,
    completeRecord: () => machineCatalog[slug], language: () => lang,
    render: reading, changeLanguage, onClose: () => metrics?.reset(),
  });
  const stamp = () => { document.body.dataset['forge'] = 'bench'; document.body.dataset['phase'] = 'bench'; };
  let ropeExperiment: ReturnType<typeof applyRopeShadowExperiment> | null = null;
  let storeCrane: StoreCraneReading | null = null;
  function clearDisplay() { storeCrane = null; ropeExperiment?.restore(); ropeExperiment = null; metrics?.close(); machine?.dispose(); machine = null; display.clear(); for (const g of supportGeometries)
    g.dispose(); for (const m of supportMaterials)
    m.dispose(); supportGeometries.length = 0; supportMaterials.length = 0; supportSets.length = 0; }
  function reading(record: EvidenceRecord) {
    evidenceRecord = record;
    page.replaceChildren();
    page.append(el('h1', 'bench-title', record.title[lang]), el('p', '', record.label[lang]));
    // The hour is the first thing the label sends a visitor here for, so the
    // record answers it before the folio's own sections begin.
    const computed = benchHourRecord(lang);
    const hourSection = el('section', 'bench-hour-record');
    hourSection.append(el('h2', '', computed.title));
    for (const line of computed.lines) hourSection.append(el('p', line.figure ? 'bench-hour-figure' : '', line.text));
    setRegister(hourSection, 'record');
    page.append(hourSection);
    for (const section of record.sections[lang]) {
      page.append(el('h2', '', section.title));
      appendPageBody(page, section.body);
    }
    if (record.slug === slug && folioEntry) {
      page.append(el('h2', '', localText(lang, 'Plate record', 'Bildnachweis')), el('p', '', folioEntry.licence), el('p', '', folioEntry.note ?? ''));
    }
    if (record.status !== 'complete') {
      const limits = el('section', 'bench-limitations');
      limits.append(el('h2', '', localText(lang, 'Unresolved', 'Ungeklärt')));
      const languagePattern = lang === 'de' ? /unbekannt|ungeklärt|offen|fehl|nicht|keine?\b|unvollständig/i : /unknown|unresolved|missing|incomplete|not\b|no\b/i;
      const mechanism = record.sections[lang][1]?.body ?? record.label[lang];
      const paragraphs = mechanism.split(/\n\s*\n/).filter(paragraph => languagePattern.test(paragraph));
      for (const paragraph of paragraphs.length ? paragraphs : [mechanism])
        appendPageBody(limits, paragraph);
      const original = el('details', 'bench-original-gaps');
      original.append(el('summary', '', localText(lang, 'Engineering gaps · original English record', 'Technische Lücken · englischer Originaltext')));
      const gaps = el('div', '');
      gaps.lang = 'en';
      for (const gap of record.gaps)
        gaps.append(el('p', '', gap));
      original.append(gaps);
      limits.append(original);
      page.append(limits);
    }
    const records = el('div', 'bench-records');
    records.append(el('h2', '', localText(lang, 'Partial and documentary records', 'Teilweise und dokumentarische Aufzeichnungen')));
    for (const rec of partialCatalog) {
      const b = el('button', '', rec.title[lang]);
      b.setAttribute('aria-current', String(rec.slug === record.slug));
      b.onclick = () => evidence.select(rec);
      records.append(b);
    }
    page.append(records);
    evidence.rendered(record);
  }
  function paint() {
    const copy = controlCopy[lang];
    hour.setLanguage(lang);
    host.dataset['section'] = String(sectionEnabled);
    host.setAttribute('aria-label', copy.host);
    nav.setAttribute('aria-label', copy.navigation);
    previous.setAttribute('aria-label', copy.previous);
    next.setAttribute('aria-label', copy.next);
    select.setAttribute('aria-label', copy.chooser);
    // The wing's name goes with the brand on the wide frame; the phone keeps
    // the bench and the count, which is the half that says how far along.
    const [wing, bench] = copy.subtitle.split(' · ');
    kickerWing.textContent = `${wing} · `;
    kickerHere.textContent = `${bench} · ${String(MACHINE_SLUGS.indexOf(slug) + 1).padStart(2, '0')} / ${MACHINE_SLUGS.length}`;
    exit.textContent = copy.exitText;
    exit.setAttribute('aria-label', copy.exitLabel);
    exit.href = `/w/vinci${location.search}`;
    languages.setAttribute('role', 'group');
    languages.setAttribute('aria-label', copy.languageGroup);
    en.setAttribute('aria-label', copy.english);
    de.setAttribute('aria-label', copy.german);
    loading.textContent = copy.loading;
    const record = machineCatalog[slug]; host.lang = lang; host.dataset['slug'] = slug; title.textContent = record.title[lang]; label.textContent = record.label[lang]; label.dataset['naAnchor'] = `vinci/machine/${slug}`; certaintyWord.textContent = localText(lang, 'Reconstructed · assumed dimensions', 'Rekonstruiert · angenommene Maße'); const s = record.dossier.scale_m; dimensions.textContent = `${s.x.toFixed(2)} × ${s.y.toFixed(2)} × ${s.z.toFixed(2)} m · ${localText(lang, 'swept envelope', 'Bewegungsraum')}`; select.setAttribute('aria-label', `${localText(lang, 'Machine', 'Maschine')} ${MACHINE_SLUGS.indexOf(slug) + 1} / 14`); scope.textContent = withoutCitations(record.sections[lang][1]?.body ?? ''); en.setAttribute('aria-pressed', String(lang === 'en')); de.setAttribute('aria-pressed', String(lang === 'de')); read.textContent = localText(lang, 'Read the evidence ↗', 'Die Quellen lesen ↗'); select.replaceChildren(); for (const id of MACHINE_SLUGS) {
    const option = el('option', '', machineCatalog[id].title[lang]);
    option.value = id;
    select.append(option);
  } const absence = BENCH_ABSENCE[slug]; if (absence) dimensions.textContent += '\n' + localText(lang, absence.en, absence.de); select.value = slug; chooser.refresh(); section.hidden = slug !== 'camera-obscura'; section.textContent = localText(lang, sectionEnabled ? 'Close chamber' : 'Open section', sectionEnabled ? 'Kammer schließen' : 'Schnitt öffnen'); section.setAttribute('aria-pressed', String(sectionEnabled)); sectionNote.hidden = !sectionEnabled; sectionNote.textContent = localText(lang, 'Section: roof and right wall removed. The experiment requires a closed, dark chamber.', 'Schnitt: Dach und rechte Wand ausgeblendet. Der Versuch erfordert eine geschlossene, dunkle Kammer.'); paintPlayback(); if (!source.hidden)
    reading(evidenceRecord ?? record); }
  function paintPlayback() {
    const view = playbackPresentation(schedule, playbackState, lang);
    play.textContent = view.playText;
    play.setAttribute('aria-pressed', String(view.pressed));
    play.disabled = view.motionDisabled;
    restart.disabled = view.motionDisabled;
    restart.textContent = view.restartText;
    timeLabel.textContent = view.timeText;
    holdNote.textContent = view.holdDetail;
    holdNote.hidden = !view.holdDetail;
  }
  async function plateFor(mine: number) { let imageReady = Promise.resolve(); const record = machineCatalog[slug]; const id: Partial<Record<MachineSlug, string>> = { 'aerial-screw': 'vinci/ms-page/lesmanuscritsdel02lo__n0340', 'revolving-crane': 'vinci/ms-page/lesmanuscritsdel02lo__n0202', 'camera-obscura': 'vinci/ms-page/lesmanuscritsdel02lo__n0386' }; const manifest = await loadManifest(); if (mine !== serial)
    return; const entry = manifest.byId.get(id[slug] ?? ''); folioEntry = entry?.display && entry.class !== 'REFERENCE-ONLY' ? entry : undefined; folio.replaceChildren(); const cap = el('figcaption', ''); const folioName = record.folio.map(f => `${f.codex} ${localText(lang, 'f.', 'Blatt')} ${f.folio}`).join(', '); if (folioEntry) {
    const img = el('img', '');
    img.alt = folioName;
    img.src = assetAddress(folioEntry);
    folio.append(img);
    imageReady = img.decode().catch(() => { });
    cap.textContent = `${folioName}\n${localText(lang, '1883 historical facsimile', 'Historisches Faksimile von 1883')}`;
    img.onerror = () => { if (mine !== serial)
      return; img.remove(); folio.prepend(el('div', 'bench-absence', localText(lang, 'Plate unavailable', 'Blatt nicht verfügbar'))); };
  }
  else {
    folio.append(el('div', 'bench-absence', localText(lang, 'Image absent', 'Bild fehlt')));
    cap.textContent = `${folioName}\n${holderName(String(record.dossier.folio[0]?.holder ?? ''))}\n${localText(lang, 'No displayable plate in the store.', 'Kein freigegebenes Blatt im Speicher.')}`;
  } folio.append(cap); if (!source.hidden && evidenceRecord?.slug === slug)
    reading(evidenceRecord); await imageReady; }
  // The crane does not slew in its admitted schedule. Its measured swept body
  // has this smaller footprint; the returned dossier allocation is unchanged.
  function displayBounds(){
    return slug==='revolving-crane' ? new Box3(new Vector3(-1,-.05,-1),new Vector3(1,2.705,1.75)) : machine!.bounds;
  }
  /** What the camera frames, where the dossier's rounded envelope is bigger
   * than the body that moves inside it. The compass is the smallest of the
   * fourteen: framed on a box a hand's width larger than itself, its pivot is
   * nine millimetres of nothing. The support keeps the envelope. */
  function frameBounds(){
    return slug==='proportional-compass'
      ? new Box3(new Vector3(-.19,.046,-.042),new Vector3(.19,.652,.042))
      : displayBounds();
  }
  /** The working end of the machine: the part of the object where its
   * fittings are, framed alone so a 9 mm boss is not a 9 px boss. The pair
   * is (height from the top as a fraction of the object, box as a fraction
   * of its span); each one is where that machine's own fitting sits. */
  const FOCUS: Partial<Record<MachineSlug, [number, number]>> = {
    'proportional-compass': [.33, .26], 'camera-obscura': [.5, .3],
    'ball-bearing': [.42, .62], 'revolving-crane': [.52, .3], 'lathe': [.33, .34],
  };
  function focusBounds() {
    const full = displayBounds(), size = full.getSize(new Vector3()), centre = full.getCenter(new Vector3());
    const [drop, part] = FOCUS[slug] ?? [.24, .34];
    const span = Math.max(size.x, size.y, size.z) * part;
    const middle = new Vector3(centre.x, full.max.y - size.y * drop, centre.z);
    const half = new Vector3(span / 2, span / 2, span / 2);
    return new Box3(middle.clone().sub(half), middle.clone().add(half));
  }
  /** the bearing the eye stands on for this machine. The wall behind it is
   * placed off the same vector, so the second plane is always the plane the
   * frame is looking at. */
  function viewDirection(): Vector3 {
    const direction = new Vector3(1.05, .68, 1.6).normalize();
    if (slug === 'camera-obscura')
      direction.set(sectionEnabled ? 1.5 : 1.25, sectionEnabled ? .8 : .5, sectionEnabled ? -.35 : -1.6).normalize();
    if (slug === 'aerial-screw') direction.set(-1.6,.4,.7).normalize();
    if (slug === 'flywheel') direction.set(.8,1.2,1.7).normalize();
    if (slug === 'ball-bearing') direction.set(.82,.62,1.66).normalize();
    if (slug === 'rolling-mill') direction.set(-1.5,.75,1.5).normalize();
    if (slug === 'lathe') direction.set(.65,.42,1.9).normalize();
    if (slug === 'parachute') direction.set(1.05,.27,1.6).normalize();
    if (slug === 'revolving-crane') direction.set(2.6,.85,.8).normalize();
    if (slug === 'water-lifting-screw') direction.set(-2.3,1.1,-.3).normalize();
    if (slug === 'proportional-compass') direction.set(1.2,.3,1.75).normalize();
    return direction;
  }
  /** how far the eye stands off a box on that bearing, at this frame's shape */
  function eyeDistance(box: Box3, direction: Vector3, mobile: boolean): number {
    const size = box.getSize(new Vector3()), centre = box.getCenter(new Vector3());
    const span = Math.max(size.x, size.y, size.z);
    const right = new Vector3().crossVectors(new Vector3(0, 1, 0), direction).normalize(), up = new Vector3().crossVectors(direction, right).normalize();
    const tanY = Math.tan(17 * Math.PI / 180), tanX = tanY * innerWidth / innerHeight, width = mobile ? .84 : .7, height = slug === 'proportional-compass' ? (mobile ? .38 : .95) : (mobile ? .31 : .8);
    let distance = span;
    for (const x of [box.min.x, box.max.x])
      for (const y of [box.min.y, box.max.y])
        for (const z of [box.min.z, box.max.z]) {
          const p = new Vector3(x, y, z).sub(centre), depth = p.dot(direction);
          distance = Math.max(distance, depth + Math.abs(p.dot(right)) / (tanX * width), depth + Math.abs(p.dot(up)) / (tanY * height));
        }
    return distance;
  }
  function compose() {
    if (!machine)
      return;
    const box = closeUp ? focusBounds() : frameBounds(), size = box.getSize(new Vector3()), centre = box.getCenter(new Vector3()), span = Math.max(size.x, size.y, size.z), mobile = innerWidth <= 1280;
    const direction = viewDirection();
    const right = new Vector3().crossVectors(new Vector3(0, 1, 0), direction).normalize(), up = new Vector3().crossVectors(direction, right).normalize();
    const distance = eyeDistance(box, direction, mobile);
    camera.aspect = innerWidth / innerHeight;
    camera.fov = 34;
    camera.near = Math.max(.001, span / 1000);
    camera.far = span * 50;
    camera.position.copy(centre).addScaledVector(direction, distance);
    camera.lookAt(centre);
    camera.setViewOffset(innerWidth, innerHeight, mobile ? 0 : innerWidth * .12, mobile ? innerHeight * .295 : slug === 'proportional-compass' ? innerHeight * .035 : 0, innerWidth, innerHeight);
    camera.updateProjectionMatrix();
    // The far cascade is a box around the origin, so the floor beyond it took
    // no shadow at all and stood there as a hard edged dark quad. The air
    // now closes inside that box, and the ground hands itself to the air.
    // THE AIR IS WHAT MAKES THE WALL THE SAME WALL ON EVERY MACHINE. Its own
    // lit value swings with the bearing: the crane's wall turns away from the
    // key and the aerial screw's stands nearly square to it. So the air is
    // fitted to the wall rather than to the machine, and the wall is always
    // read through the same depth of it, whatever the sun is doing to it.
    const near = distance + span * .5;
    const far = BENCH_BACK_PLANE
      ? near + (distance + BACK_PLANE_METRES - near) / BACK_PLANE_AIR
      : distance + span * 1.9;
    scene.fog=new Fog('#1a2026',near,far);
    scene.fogNode = fog(backdrop, rangeFogFactor(float(near), float(far)));
  }
  async function supports(mine: number) {
    if (!machine) return;
    const [stone, iron] = await Promise.all([
      loadMachineMaterial(stack, 'limestone-pale'),
      loadMachineMaterial(stack, 'iron-forged'),
    ]);
    if (mine !== serial) return;
    supportSets.push(stone, iron);
    const groundMat = new MeshStandardNodeMaterial({ roughness: stone.roughness, metalness: stone.metalness });
    groundMat.colorNode = vec3(stone.albedo.r * .025, stone.albedo.g * .025, stone.albedo.b * .025);
    // A metre-scale band was tried here when the air began to reach the wall
    // and it read as water: a low frequency on a horizontal plane seen at a
    // grazing angle stretches into ripples whatever its contrast. The floor
    // keeps the three scales it had.
    const groundDetail = stack.detail(groundMat, stone, { count: 3, mid: .06, maps: .4, macro: .4 });
    groundMat.roughnessNode = groundDetail.roughness.max(.94);
    // WHERE THE PLATE MEETS THE FLOOR. A cast shadow says where the sun is; it
    // does not say that two surfaces touch. Without the dark line an edge
    // holds against the floor it stands on, the plate reads as a card laid on
    // the air, which is what the phone frame showed. The line is the plate's
    // own footprint, closing over a hand's width.
    {
      const box = displayBounds(), size = box.getSize(new Vector3()), middle = box.getCenter(new Vector3());
      const reach = Math.max(.06, Math.max(size.x, size.z) * .05);
      const dx = positionWorld.x.sub(middle.x).abs().sub(size.x * .54).max(0);
      const dz = positionWorld.z.sub(middle.z).abs().sub(size.z * .54).max(0);
      const outside = dx.mul(dx).add(dz.mul(dz)).sqrt();
      groundMat.aoNode = float(1).sub(float(1).sub(smoothstep(0, reach, outside)).mul(.62));
    }
    // The platform is read from twice as far away on the phone as on the
    // wide frame, so its coarsest band is the one that has to survive: a
    // metre-scale variation the minified maps cannot average away.
    const supportMat = iron.material({
      count: 3, uv: uv(), scales: [.9, .16, .004], macro: .5, mid: .95, micro: .7,
      fade: [26, 150],
    });
    // The parachute's harness ring is a dark iron loop hanging over the deck.
    // At the deck's inherited value the two were the same colour.
    if (slug === 'parachute') supportMat.colorNode = supportMat.colorNode!.mul(1.45)
    // The smallest object on the bench stands on a plate the key barely
    // grazes, so the compass reads as an outline against nothing. The plate
    // is given the light its top face is standing in.
    if (slug === 'proportional-compass') supportMat.colorNode = supportMat.colorNode!.mul(1.7);
    if (slug === 'multi-barrel-gun') {
      // GENERATED indirect-contact approximation of the two exact wheel
      // cylinders. Shared GTAO is off; the existing key shadow remains.
      const gap = positionWorld.z.pow(2).add(.25).sqrt().sub(.5);
      const onTop = float(1).sub(smoothstep(.001, .004, positionWorld.y.abs()));
      const contact = (centreX: number) => {
        const dx = positionWorld.x.sub(centreX).abs().sub(.04).max(0);
        const distance = dx.pow(2).add(gap.pow(2)).sqrt();
        return float(1).sub(smoothstep(0, .06, distance)).mul(onTop);
      };
      supportMat.aoNode = float(1).sub(contact(-1.08).max(contact(1.08)).mul(.75));
    }
    supportMaterials.push(groundMat, supportMat);
    const made = buildBenchSupports({
      slug,
      machineBounds: machine.bounds,
      displayBounds: displayBounds(),
      ironMaterial: supportMat,
      groundMaterial: groundMat,
    });
    display.add(...made.meshes);
    supportGeometries.push(...made.geometries);
    if (BENCH_BACK_PLANE) {
      const box = displayBounds(), mobile = innerWidth <= 1280;
      const wall = buildBackPlane({
        centre: box.getCenter(new Vector3()),
        toward: viewDirection(),
        floorY: machine.bounds.min.y - Math.max(...box.getSize(new Vector3()).toArray()) * .034,
        cameraDistance: eyeDistance(closeUp ? focusBounds() : frameBounds(), viewDirection(), mobile),
      });
      const tuffeau = await loadMachineMaterial(stack, 'stone-tuffeau');
      if (mine !== serial) { wall.geometry.dispose(); return; }
      supportSets.push(tuffeau);
      const wallMaterial = backPlaneMaterial(stack, tuffeau, (wall.geometry as PlaneGeometry).parameters.height);
      wall.mesh.material = wallMaterial;
      supportMaterials.push(wallMaterial);
      supportGeometries.push(wall.geometry);
      display.add(wall.mesh);
    }
  }
  /** The standing machine and its supports: mounted, and dressed with their own sets. */
  function parts() {
    const state = machine?.standing?.() ?? { mounted: ready, dressed: ready, error: null };
    const bare = supportSets.filter(set => !materialDressed(set)).map(set => `${set.name} undressed (${materialFailure(set) ?? 'no maps yet'})`);
    return { mounted: state.mounted, dressed: state.dressed && bare.length === 0, error: [state.error, ...bare].filter(Boolean).join('; ') || null };
  }
  function lightBench() {
    const scale = machineCatalog[slug].dossier.scale_m, span = Math.max(scale.x, scale.y, scale.z);
    key?.dispose();
    // The far cascade is a box around the origin. It has to contain the wall
    // as well as the machine, or the floor between them takes no shadow
    // lookup at all and draws as a hard edged quad.
    const reach = BENCH_BACK_PLANE ? Math.max(span * 3.4, BACK_PLANE_METRES * 1.45) : span * 3.4;
    key = stack.light({ azimuth: BENCH_SUN_AZIMUTH_DEGREES, elevation: BENCH_SUN_ELEVATION_DEGREES, kelvin: 4800, lux: 185, ambient: .72, reach: Math.max(24, span * 6, reach * 2.2), cascades: [span * 1.25, reach], sky: { zenith: '#707579', horizon: '#b1a895', ground: '#343532', stars: 0 } });
    key.light.shadow.normalBias = span * .0002;
    key.light.shadow.bias = -span * .00001;
    // the surfaces that give an edge its rim answer to the light that is
    // actually standing here, not to a second copy of the hour
    setBenchKey(key.direction);
  }
  async function open(opts: BenchOptions = {}) { const requested = opts.slug ?? 'aerial-screw'; if (!isMachineSlug(requested))
    throw new Error(`No complete machine: ${requested}`);
    const requestedEvidence = opts.evidence === undefined ? null : opts.evidence === requested ? machineCatalog[requested] : partialCatalog.find(record => record.slug === opts.evidence);
    if (opts.evidence !== undefined && !requestedEvidence) throw new Error(`No evidence record for ${requested}: ${opts.evidence}`);
    evidence.close(false);
    const mine = ++serial; active = true; host.hidden = false; ready = false; loading.hidden = false; clearDisplay(); folioEntry = undefined; folio.replaceChildren(); slug = requested; evidenceRecord = machineCatalog[slug]; lang = controlLanguage(location.search, opts.lang); schedule = playbackSchedule(machineCatalog[slug].dossier); playbackState = initialPlayback(schedule, { t: opts.t, fixed: document.body.classList.contains('forge'), reducedMotion: reduced.matches }); lastWall = performance.now(); stamp(); stack.setScene(scene, camera, { ...IDENTITY, name: 'vinci-machine-bench', exposure: .95, grain: .004, ao: { intensity: 1, distance: Math.max(...Object.values(machineCatalog[slug].dossier.scale_m).filter((v): v is number => typeof v === 'number')) * .025, thickness: 1 } }); lightBench(); machine = buildMachine(slug, stack); closeUp = opts.close ?? false; sectionEnabled = slug === 'camera-obscura' && (opts.section ?? false); machine.section(sectionEnabled); display.add(machine.object); compose(); paint(); await Promise.all([machine.ready, supports(mine), plateFor(mine)]); if (mine !== serial)
    return; machine.animate(playbackState.clock, 0);
    if(key){
      const towardKey=vec3(key.direction.x,key.direction.y,key.direction.z).mul(.03);
      machine.object.traverse(node=>{
        if(!(node instanceof Mesh))return;
        const materials=Array.isArray(node.material)?node.material:[node.material];
        if(!materials.some(mat=>{const family=mat.name.split(':')[1]??'';return /linen/.test(family)&&!/thread/.test(family);}))return;
        for(const material of materials){if(material instanceof MeshStandardNodeMaterial){material.receivedShadowPositionNode=positionWorld.add(towardKey);material.needsUpdate=true;}}
        if(opts.clothProbe==='no-shadow')node.receiveShadow=false;
        if(opts.clothProbe==='flat-normal')for(const material of materials){if(material instanceof MeshStandardNodeMaterial){material.normalNode=null;material.needsUpdate=true;}}
      });
    }
    // The crane out of the store carries its rope inside the baked body, and
    // the parts the experiment names belong to the built one.
    storeCrane = slug === 'revolving-crane' && machine && 'reading' in machine ? (machine as StoreCrane).reading() : null;
    const ropeParts = storeCrane?.standing === 'store' ? ['lathe', 'parachute'] : ['revolving-crane', 'lathe', 'parachute'];
    const ropeMode = opts.ropeProbe ?? (ropeParts.includes(slug) ? 'offset-2mm' : undefined);
    if (ropeMode && key && ropeParts.includes(slug)) {
      if (slug !== 'lathe' && slug !== 'revolving-crane' && slug !== 'parachute') throw new Error(`No rope experiment for ${slug}`);
      ropeExperiment = applyRopeShadowExperiment(machine.object, slug, ropeMode, key.direction);
    }
    if (requestedEvidence) evidence.open(requestedEvidence, read);
    ready = true; loading.hidden = true; metrics?.reset(); stamp(); lastWall = performance.now(); console.log(`[bench] mounted ${slug} period=${machineCatalog[slug].dossier.motion.period_s} tier=${stack.tierName()}`); }
  function close() { if (!active)
    return; setBenchKey(null); serial++; evidence.close(false); active = false; host.hidden = true; ready = false; clearDisplay(); key?.dispose(); key = null; }
  function navigate(delta: number) { const id = MACHINE_SLUGS[(MACHINE_SLUGS.indexOf(slug) + delta + MACHINE_SLUGS.length) % MACHINE_SLUGS.length]; if (id) {
    history.pushState({}, '', `/bench/vinci/machines/${id}${location.search}`);
    void open({ slug: id });
  } }
  section.onclick = () => { sectionEnabled = !sectionEnabled; machine?.section(sectionEnabled); compose(); paint(); metrics?.reset(); };
  previous.onclick = () => navigate(-1);
  next.onclick = () => navigate(1);
  select.onchange = () => { history.pushState({}, '', `/bench/vinci/machines/${select.value}${location.search}`); void open({ slug: select.value }); };
  play.onclick = () => { playbackState = togglePlayback(schedule, playbackState); machine?.animate(playbackState.clock, 0); lastWall = performance.now(); paintPlayback(); metrics?.reset(); };
  restart.onclick = () => { playbackState = restartPlayback(schedule, reduced.matches); machine?.animate(0, 0); lastWall = performance.now(); paintPlayback(); metrics?.reset(); };
  function changeLanguage(nextLanguage: Language) {
    lang = nextLanguage;
    history.replaceState(history.state, '', addressWithLanguage(location.href, lang));
    paint();
    const mine = serial, selectedLanguage = lang, plate = plateFor(mine);
    if (metrics) {
      metrics.close();
      void plate.then(() => { if (active && mine === serial && selectedLanguage === lang) metrics.reset(); });
    }
  }
  reduced.addEventListener('change', event => {
    if (!active) return;
    const nextState = playbackOnReducedMotionChange(schedule, playbackState, event.matches);
    if (nextState === playbackState) return;
    playbackState = nextState;
    lastWall = performance.now();
    machine?.animate(playbackState.clock, 0);
    paintPlayback();
    metrics?.reset();
  });
  en.onclick = () => changeLanguage('en');
  de.onclick = () => changeLanguage('de');
  read.onclick = () => { evidence.open(machineCatalog[slug], read); metrics?.reset(); };
  let wheelAt = 0;
  host.addEventListener('wheel', e => { if (!active || !source.hidden || e.target instanceof HTMLElement && e.target.closest('.bench-dock,.bench-footer,.bench-header'))
    return; if (Math.abs(e.deltaY) > 30 && performance.now() - wheelAt > 800) {
    wheelAt = performance.now();
    navigate(Math.sign(e.deltaY));
  } }, { passive: true });
  host.style.pointerEvents = 'auto';
  addEventListener('keydown', e => {
    if (!active)
      return;
    if (evidence.isOpen()) return;
    if (e.target instanceof HTMLElement && e.target.closest('button,a,input,select,textarea,summary'))
      return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      navigate(1);
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      navigate(-1);
    }
    if (e.code === 'Space') {
      e.preventDefault();
      play.click();
    }
  });
  addEventListener('resize', () => { if (active) {
    compose(); metrics?.reset(); } });
  return { open, close, active: () => active, frame(dt: number) { if (!active)
      return; const now = performance.now(); if (ready)
      playbackState = advancePlayback(schedule, playbackState, (now - lastWall) / 1000); lastWall = now; if (ready) {
      machine?.animate(playbackState.clock, dt);
      if (now - lastPlaybackPaint >= 100) {
        paintPlayback();
        lastPlaybackPaint = now;
      }
    }
    stack.render(dt);
    if (metrics) {
      const tier = stack.tierName();
      if (tier !== metricsTier) { metricsTier = tier; metrics.reset(); }
      metrics.afterRender({ slug, t: playbackState.clock, ready, playing: playbackState.playing && !playbackState.fixed, section: sectionEnabled, period_s: machineCatalog[slug].dossier.motion.period_s });
    }
  }, machine() {
    if (!machine) return null;
    const snapshot = { slug, body: storeCrane ?? undefined, period: machineCatalog[slug].dossier.motion.period_s, period_s: machineCatalog[slug].dossier.motion.period_s, t: playbackState.clock, joints: machine.joints(), bounds: machine.bounds.getSize(new Vector3()).toArray(), occupied: new Box3().setFromObject(machine.object).getSize(new Vector3()).toArray(), ready: ready && parts().dressed && (metrics?.ready() ?? true), parts: parts(), playing: playbackState.playing, section: sectionEnabled, evidence: { open: evidence.isOpen(), recordSlug: evidence.isOpen() ? evidenceRecord?.slug ?? null : null } };
    return metrics ? { ...snapshot, metrics: metrics.reading() } : snapshot;
  }, slug: () => slug, ids: () => MACHINE_SLUGS, station(id: string) { if (!isMachineSlug(id))
      return false; void open({ slug: id }); return true; }, manifest() { return [folioEntry, storeCrane?.entry].filter((entry): entry is ManifestEntry => Boolean(entry)); }, relight() { if (active) {
      lightBench(); metrics?.reset(); } }, freeze(t: number) { playbackState = freezePlayback(t); machine?.animate(playbackState.clock, 0); if (active) metrics?.reset(); }, ready: () => ready && parts().dressed && (metrics?.ready() ?? true) };
}
