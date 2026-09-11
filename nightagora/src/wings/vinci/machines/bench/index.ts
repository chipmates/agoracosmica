import { Box3, type BufferGeometry, Color, Fog, Group, Mesh, MeshStandardNodeMaterial, PerspectiveCamera, Scene, Vector3 } from 'three/webgpu';
import type { Stack, KeyLight } from '../../../../stack';
import { positionWorld, vec3 } from 'three/tsl';
import { IDENTITY } from '../../../../stack/grade';
import { loadManifest, type ManifestEntry } from '../../../../manifest';
import { loadMachineMaterial } from '../parts';
import { buildMachine, type ReadyMachineBuild } from '..';
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
import { playbackSchedule, initialPlayback, advancePlayback, togglePlayback, restartPlayback, freezePlayback, playbackPresentation } from './playback';
// The eyes intentionally removes the Vite HMR client; inline CSS has no HMR imports.
const sheet = document.createElement('style');
sheet.dataset['vinciBench'] = '';
sheet.textContent = benchCss + '\n' + titleSelectCss + '\n' + evidenceCss;
document.head.append(sheet);
export interface BenchOptions {
  slug?: string;
  t?: number;
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
  const camera = new PerspectiveCamera(34, innerWidth / innerHeight, .001, 1000);
  const display = new Group();
  scene.add(display);
  const host = el('main', 'bench');
  host.hidden = true;
  host.setAttribute('aria-label', 'Leonardo da Vinci machine bench');
  document.body.append(host);
  const header = el('header', 'bench-header');
  const brand = el('p', 'bench-brand', 'Agora Cosmica');
  brand.dataset['naBrand'] = '';
  const subtitle = el('p', 'bench-kicker', 'Leonardo da Vinci · The machine bench');
  const exit = el('a', '', 'The museum ↗');
  exit.href = '/w/vinci';
  exit.addEventListener('click', e => { e.preventDefault(); onExit(); });
  header.append(brand, subtitle, exit);
  const number = el('div', 'bench-number');
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
  const languages = el('div', 'bench-lang');
  const en = el('button', '', 'EN'), de = el('button', '', 'DE');
  languages.append(en, de);
  const read = el('button', 'bench-read', 'Read the evidence ↗');
  const holdNote = el('p', 'bench-hold');
  holdNote.hidden = true;
  dock.append(languages, textBlock, folio, holdNote, scope, read);
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
  dock.append(section, sectionNote);
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
  source.append(sourceClose, page);
  const loading = el('p', 'bench-loading', 'Preparing the object');
  loading.hidden = true;
  host.append(header, number, dock, footer, source, loading);
  const metrics = createBenchMetrics(stack, host);
  let metricsTier = metrics ? stack.tierName() : null;
  let active = false, serial = 0, slug: MachineSlug = 'aerial-screw', lang: Language = controlLanguage(location.search), machine: ReadyMachineBuild | null = null, key: KeyLight | null = null, ready = false, lastWall = performance.now(), folioEntry: ManifestEntry | undefined, evidenceRecord: EvidenceRecord | null = null, sectionEnabled = false, lastPlaybackPaint = 0;
  let schedule = playbackSchedule(machineCatalog[slug].dossier);
  let playbackState = initialPlayback(schedule, { fixed: true });
  const supportGeometries: BufferGeometry[] = [], supportMaterials: MeshStandardNodeMaterial[] = [];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const evidence = createEvidenceDialog({
    host, source, page, closeButton: sourceClose, partialRecords: partialCatalog,
    completeRecord: () => machineCatalog[slug], language: () => lang,
    render: reading, changeLanguage, onClose: () => metrics?.reset(),
  });
  const stamp = () => { document.body.dataset['forge'] = 'bench'; document.body.dataset['phase'] = 'bench'; };
  let ropeExperiment: ReturnType<typeof applyRopeShadowExperiment> | null = null;
  function clearDisplay() { ropeExperiment?.restore(); ropeExperiment = null; metrics?.close(); machine?.dispose(); machine = null; display.clear(); for (const g of supportGeometries)
    g.dispose(); for (const m of supportMaterials)
    m.dispose(); supportGeometries.length = 0; supportMaterials.length = 0; }
  function reading(record: EvidenceRecord) {
    evidenceRecord = record;
    page.replaceChildren();
    page.append(el('h1', 'bench-title', record.title[lang]), el('p', '', record.label[lang]));
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
    host.setAttribute('aria-label', copy.host);
    subtitle.textContent = copy.subtitle;
    nav.setAttribute('aria-label', copy.navigation);
    previous.setAttribute('aria-label', copy.previous);
    next.setAttribute('aria-label', copy.next);
    select.setAttribute('aria-label', copy.chooser);
    exit.textContent = copy.exitText;
    exit.setAttribute('aria-label', copy.exitLabel);
    exit.href = `/w/vinci${location.search}`;
    languages.setAttribute('role', 'group');
    languages.setAttribute('aria-label', copy.languageGroup);
    en.setAttribute('aria-label', copy.english);
    de.setAttribute('aria-label', copy.german);
    loading.textContent = copy.loading;
    const record = machineCatalog[slug]; host.lang = lang; host.dataset['slug'] = slug; title.textContent = record.title[lang]; label.textContent = record.label[lang]; label.dataset['naAnchor'] = `vinci/machine/${slug}`; certaintyWord.textContent = localText(lang, 'Reconstructed · assumed dimensions', 'Rekonstruiert · angenommene Maße'); const s = record.dossier.scale_m; dimensions.textContent = `${s.x.toFixed(2)} × ${s.y.toFixed(2)} × ${s.z.toFixed(2)} m · ${localText(lang, 'swept envelope', 'Bewegungsraum')}`; number.textContent = `${String(MACHINE_SLUGS.indexOf(slug) + 1).padStart(2, '0')} / 14`; scope.textContent = record.sections[lang][1]?.body ?? ''; en.setAttribute('aria-pressed', String(lang === 'en')); de.setAttribute('aria-pressed', String(lang === 'de')); read.textContent = localText(lang, 'Read the evidence ↗', 'Die Quellen lesen ↗'); select.replaceChildren(); for (const id of MACHINE_SLUGS) {
    const option = el('option', '', machineCatalog[id].title[lang]);
    option.value = id;
    select.append(option);
  } if(slug==='parachute'||slug==='proportional-compass')dimensions.textContent+='\n'+localText(lang,'Modern exhibition supports','Moderne Ausstellungshalterungen'); select.value = slug; chooser.refresh(); section.hidden = slug !== 'camera-obscura'; section.textContent = localText(lang, sectionEnabled ? 'Close chamber' : 'Open section', sectionEnabled ? 'Kammer schließen' : 'Schnitt öffnen'); section.setAttribute('aria-pressed', String(sectionEnabled)); sectionNote.hidden = !sectionEnabled; sectionNote.textContent = localText(lang, 'Section: roof and right wall removed. The experiment requires a closed, dark chamber.', 'Schnitt: Dach und rechte Wand ausgeblendet. Der Versuch erfordert eine geschlossene, dunkle Kammer.'); paintPlayback(); if (!source.hidden)
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
    img.src = `/na-assets/wing-vinci/${folioEntry.path}`;
    folio.append(img);
    imageReady = img.decode().catch(() => { });
    cap.textContent = `${folioName}\n${localText(lang, '1883 historical facsimile', 'Historisches Faksimile von 1883')}`;
    img.onerror = () => { if (mine !== serial)
      return; img.remove(); folio.prepend(el('div', 'bench-absence', localText(lang, 'Plate unavailable', 'Blatt nicht verfügbar'))); };
  }
  else {
    folio.append(el('div', 'bench-absence', localText(lang, 'Image absent', 'Bild fehlt')));
    cap.textContent = `${folioName}\n${String(record.dossier.folio[0]?.holder ?? '')}\n${localText(lang, 'No displayable plate in the store.', 'Kein freigegebenes Blatt im Speicher.')}`;
  } folio.append(cap); if (!source.hidden && evidenceRecord?.slug === slug)
    reading(evidenceRecord); await imageReady; }
  // The crane does not slew in its admitted schedule. Its measured swept body
  // has this smaller footprint; the returned dossier allocation is unchanged.
  function displayBounds(){
    return slug==='revolving-crane' ? new Box3(new Vector3(-1,-.05,-1),new Vector3(1,2.705,1.75)) : machine!.bounds;
  }
  function compose() {
    if (!machine)
      return;
    const box = displayBounds(), size = box.getSize(new Vector3()), centre = box.getCenter(new Vector3()), span = Math.max(size.x, size.y, size.z), mobile = innerWidth <= 1280;
    const direction = new Vector3(1.05, .68, 1.6).normalize();
    if (slug === 'camera-obscura')
      direction.set(sectionEnabled ? 1.5 : .75, sectionEnabled ? .8 : .58, sectionEnabled ? -.35 : -1.7).normalize();
    if (slug === 'aerial-screw') direction.set(-1.6,.4,.7).normalize();
    if (slug === 'flywheel') direction.set(.8,1.2,1.7).normalize();
    if (slug === 'ball-bearing') direction.set(.8,.28,1.7).normalize();
    if (slug === 'rolling-mill') direction.set(-1.5,.75,1.5).normalize();
    if (slug === 'parachute') direction.set(1.05,.27,1.6).normalize();
    const right = new Vector3().crossVectors(new Vector3(0, 1, 0), direction).normalize(), up = new Vector3().crossVectors(direction, right).normalize();
    const tanY = Math.tan(17 * Math.PI / 180), tanX = tanY * innerWidth / innerHeight, width = mobile ? .84 : .65, height = mobile ? .34 : .72;
    let distance = span;
    for (const x of [box.min.x, box.max.x])
      for (const y of [box.min.y, box.max.y])
        for (const z of [box.min.z, box.max.z]) {
          const p = new Vector3(x, y, z).sub(centre), depth = p.dot(direction);
          distance = Math.max(distance, depth + Math.abs(p.dot(right)) / (tanX * width), depth + Math.abs(p.dot(up)) / (tanY * height));
        }
    camera.aspect = innerWidth / innerHeight;
    camera.fov = 34;
    camera.near = Math.max(.001, span / 1000);
    camera.far = span * 50;
    camera.position.copy(centre).addScaledVector(direction, distance);
    camera.lookAt(centre);
    camera.setViewOffset(innerWidth, innerHeight, mobile ? 0 : innerWidth * .12, mobile ? innerHeight * .22 : 0, innerWidth, innerHeight);
    camera.updateProjectionMatrix();
    scene.fog=new Fog('#1a2026',distance+span*2,distance+span*12);
  }
  async function supports(mine: number) {
    if (!machine) return;
    const [stone, iron] = await Promise.all([
      loadMachineMaterial(stack, 'limestone-pale'),
      loadMachineMaterial(stack, 'iron-forged'),
    ]);
    if (mine !== serial) return;
    const groundMat = new MeshStandardNodeMaterial({ roughness: stone.roughness, metalness: stone.metalness });
    groundMat.colorNode = vec3(stone.albedo.r * .025, stone.albedo.g * .025, stone.albedo.b * .025);
    stack.detail(groundMat, stone, { count: 3, mid: .2, maps: .4, macro: .4 });
    const supportMat = iron.material({ count: 3 });
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
  }
  function lightBench() {
    const scale = machineCatalog[slug].dossier.scale_m, span = Math.max(scale.x, scale.y, scale.z);
    key?.dispose();
    key = stack.light({ azimuth: slug === 'camera-obscura' ? 55 : slug === 'rolling-mill' ? 195 : slug === 'proportional-compass' ? 225 : 135, elevation: slug === 'proportional-compass' ? 22 : slug === 'ball-bearing' ? 26 : 42, kelvin: 4800, lux: 185, ambient: .72, reach: Math.max(24, span * 6), cascades: [span * 1.25, span * 2.5], sky: { zenith: '#707579', horizon: '#b1a895', ground: '#343532', stars: 0 } });
    key.light.shadow.normalBias = span * .0002;
    key.light.shadow.bias = -span * .00001;
  }
  async function open(opts: BenchOptions = {}) { const requested = opts.slug ?? 'aerial-screw'; if (!isMachineSlug(requested))
    throw new Error(`No complete machine: ${requested}`);
    const requestedEvidence = opts.evidence === undefined ? null : opts.evidence === requested ? machineCatalog[requested] : partialCatalog.find(record => record.slug === opts.evidence);
    if (opts.evidence !== undefined && !requestedEvidence) throw new Error(`No evidence record for ${requested}: ${opts.evidence}`);
    evidence.close(false);
    const mine = ++serial; active = true; host.hidden = false; ready = false; loading.hidden = false; clearDisplay(); folioEntry = undefined; folio.replaceChildren(); slug = requested; evidenceRecord = machineCatalog[slug]; lang = controlLanguage(location.search, opts.lang); schedule = playbackSchedule(machineCatalog[slug].dossier); playbackState = initialPlayback(schedule, { t: opts.t, fixed: document.body.classList.contains('forge'), reducedMotion: reduced.matches }); lastWall = performance.now(); stamp(); stack.setScene(scene, camera, { ...IDENTITY, name: 'vinci-machine-bench', exposure: .95, grain: .004, ao: { intensity: 1, distance: Math.max(...Object.values(machineCatalog[slug].dossier.scale_m).filter((v): v is number => typeof v === 'number')) * .025, thickness: 1 } }); lightBench(); machine = buildMachine(slug, stack); sectionEnabled = slug === 'camera-obscura' && (opts.section ?? false); machine.section(sectionEnabled); display.add(machine.object); compose(); paint(); await Promise.all([machine.ready, supports(mine), plateFor(mine)]); if (mine !== serial)
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
    const ropeMode = opts.ropeProbe;
    if (ropeMode && key) {
      if (slug !== 'lathe' && slug !== 'revolving-crane' && slug !== 'parachute') throw new Error(`No rope experiment for ${slug}`);
      ropeExperiment = applyRopeShadowExperiment(machine.object, slug, ropeMode, key.direction);
    }
    if (requestedEvidence) evidence.open(requestedEvidence, read);
    ready = true; loading.hidden = true; metrics?.reset(); stamp(); lastWall = performance.now(); console.log(`[bench] mounted ${slug} period=${machineCatalog[slug].dossier.motion.period_s} tier=${stack.tierName()}`); }
  function close() { if (!active)
    return; serial++; evidence.close(false); active = false; host.hidden = true; ready = false; clearDisplay(); key?.dispose(); key = null; }
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
    const snapshot = { slug, period: machineCatalog[slug].dossier.motion.period_s, period_s: machineCatalog[slug].dossier.motion.period_s, t: playbackState.clock, joints: machine.joints(), bounds: machine.bounds.getSize(new Vector3()).toArray(), occupied: new Box3().setFromObject(machine.object).getSize(new Vector3()).toArray(), ready: ready && (metrics?.ready() ?? true), playing: playbackState.playing, section: sectionEnabled, evidence: { open: evidence.isOpen(), recordSlug: evidence.isOpen() ? evidenceRecord?.slug ?? null : null } };
    return metrics ? { ...snapshot, metrics: metrics.reading() } : snapshot;
  }, slug: () => slug, ids: () => MACHINE_SLUGS, station(id: string) { if (!isMachineSlug(id))
      return false; void open({ slug: id }); return true; }, manifest() { return folioEntry ? [folioEntry] : []; }, relight() { if (active) {
      lightBench(); metrics?.reset(); } }, freeze(t: number) { playbackState = freezePlayback(t); machine?.animate(playbackState.clock, 0); if (active) metrics?.reset(); }, ready: () => ready && (metrics?.ready() ?? true) };
}
