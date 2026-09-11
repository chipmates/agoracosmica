#!/usr/bin/env node
/** Local, offline supplement to the sealed manifest/honesty gates.
 * Run: node src/wings/vinci/provenance-check.mjs
 * Writes JSON to stdout only; exit 1 means a measured local check failed.
 * This does not exercise a renderer, navigation, door clicks or label occlusion.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const wingDir = 'src/wings/vinci';
const manifestFile = 'assets/wing-vinci/manifest.json';
const errors = [];
const report = {
  checker: 'vinci-local-provenance', scope: 'vinci', mode: 'offline source and data inspection',
  replacesSharedGates: false,
  limitations: [
    'No browser: target rectangles, rendered claims, occlusion, real input and door opening remain unmeasured.',
    'Asset-use inspection covers literal imports, literal URLs and material-library calls; it is not whole-program dataflow analysis.',
    'Recipe hashes identify the named source files, not a reproducible browser render or the entire transitive dependency graph.',
    'Existing library entries are checked in the local public manifest; their external asset bytes are not accessed.',
  ],
  manifest: {}, source: {}, content: {}, css: {}, errors,
};
const fail = (code, detail, file, id) => errors.push({ code, detail, ...(file ? { file } : {}), ...(id ? { id } : {}) });
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const textPresent = value => typeof value === 'string' && value.trim().length > 0;
const inside = (base, candidate) => candidate === base || candidate.startsWith(base + path.sep);

// All data reads remain in this app, including symlink resolution.
function localPath(relative) {
  if (typeof relative !== 'string' || path.isAbsolute(relative)) throw new Error(`Expected an app-relative path: ${relative}`);
  const resolved = path.resolve(root, relative);
  if (!inside(root, resolved)) throw new Error(`Path leaves this app: ${relative}`);
  const real = fs.realpathSync(resolved);
  if (!inside(fs.realpathSync(root), real)) throw new Error(`Symlink leaves this app: ${relative}`);
  return real;
}
const read = relative => fs.readFileSync(localPath(relative));
const sourceText = relative => read(relative).toString('utf8');
const json = relative => JSON.parse(sourceText(relative));
function section(name, work) {
  try { work(); } catch (error) { fail('inspection-error', `${name}: ${error.message}`); }
}
function walk(relative) {
  return fs.readdirSync(localPath(relative), { withFileTypes: true }).flatMap(entry => {
    const child = `${relative}/${entry.name}`;
    if (entry.isSymbolicLink()) { fail('source-symlink', 'Source/asset inventory requires ordinary files and directories.', child); return []; }
    return entry.isDirectory() ? walk(child) : [child];
  }).sort();
}
const ast = (file, source = sourceText(file)) => ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
function visit(node, fn) { fn(node); ts.forEachChild(node, child => visit(child, fn)); }
function literalStrings(node) {
  const found = [];
  visit(node, child => { if (ts.isStringLiteralLike(child)) found.push(child.text); });
  return found;
}
// Values returned by a literal/conditional expression; a condition's comparison
// strings are not possible material IDs (kind === 'stone' ? A : B).
function literalValues(node) {
  if (ts.isStringLiteralLike(node)) return [node.text];
  if (ts.isParenthesizedExpression(node)) return literalValues(node.expression);
  if (ts.isConditionalExpression(node)) return [...literalValues(node.whenTrue), ...literalValues(node.whenFalse)];
  return [];
}

let assets = [], classes = [], sourceFiles = [], libraryEntries = [];
section('manifest schema and local records', () => {
  const schema = ast('src/manifest/schema.ts');
  const classType = schema.statements.find(node => ts.isTypeAliasDeclaration(node) && node.name.text === 'AssetClass');
  if (!classType || !ts.isUnionTypeNode(classType.type)) throw new Error('Cannot read the canonical AssetClass union.');
  classes = classType.type.types.map(node => ts.isLiteralTypeNode(node) && ts.isStringLiteral(node.literal) ? node.literal.text : null);
  const raw = json(manifestFile);
  if (!Array.isArray(raw.assets) || raw.assets.length === 0) throw new Error('Local manifest must contain a nonempty assets array.');
  assets = raw.assets;
  const seen = new Set(), recipes = [];
  for (const entry of assets) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) { fail('manifest-entry', 'Expected an asset object.', manifestFile); continue; }
    const id = entry.id;
    for (const field of ['id', 'path', 'wing', 'class', 'licence']) {
      if (!textPresent(entry[field])) fail('manifest-required', `Missing nonempty ${field}.`, manifestFile, id);
    }
    if (seen.has(id)) fail('manifest-duplicate-id', 'Asset ID occurs more than once.', manifestFile, id);
    seen.add(id);
    if (entry.wing !== 'vinci' || !/^vinci\/[a-z0-9][a-z0-9/_-]*$/.test(id ?? '')) fail('manifest-scope', 'Local asset wing and ID scope must be vinci, not the directory name wing-vinci.', manifestFile, id);
    if (!classes.includes(entry.class)) fail('manifest-class', `Class is absent from src/manifest/schema.ts: ${entry.class}`, manifestFile, id);
    if (typeof entry.display !== 'boolean') fail('manifest-display', 'display must be an explicit boolean.', manifestFile, id);
    if (entry.class === 'REFERENCE-ONLY' && entry.display !== false) fail('reference-displayed', 'REFERENCE-ONLY must have display:false.', manifestFile, id);
    if (entry.record !== undefined) fail('wing-open-record', 'Wing records cannot use the inherited open-record exception.', manifestFile, id);
    if (typeof entry.path !== 'string' || entry.path.startsWith('/') || entry.path.includes('\\') || entry.path.split('/').includes('..') || /^[a-z]+:/i.test(entry.path)) fail('manifest-path', 'Asset path must remain relative to its scope.', manifestFile, id);
    if (entry.class === 'GENERATED') {
      for (const field of ['prompt', 'model', 'date']) if (!textPresent(entry[field])) fail('generated-recipe', `GENERATED requires ${field}.`, manifestFile, id);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.date ?? '') || !Number.isFinite(Date.parse(entry.date)) || new Date(entry.date).toISOString().slice(0, 10) !== entry.date) fail('generated-date', 'Date must be a valid YYYY-MM-DD calendar date.', manifestFile, id);
    }
    if (!/^[a-f0-9]{64}$/i.test(entry.sha256 ?? '')) fail('manifest-hash', 'Commissioned local records require a SHA-256 hash.', manifestFile, id);
    const notedRecipes = [...(entry.note ?? '').matchAll(/(?:^|[;\s])recipe_file=([^;\s]+)/g)].map(match => match[1]);
    const namedRecipes = [...new Set([entry.recipe_file, ...notedRecipes].filter(Boolean))];
    if (namedRecipes.length !== 1) { fail('recipe-file', 'Exactly one recipe_file must be declared (field or note).', manifestFile, id); continue; }
    const recipe = namedRecipes[0];
    try {
      const recipePath = localPath(recipe);
      if (!inside(localPath(wingDir), recipePath) || !/\.(?:ts|js|mjs|css|json)$/.test(recipe)) throw new Error('Recipe must be a source or JSON data file inside src/wings/vinci.');
      const bytes = fs.readFileSync(recipePath), actual = hash(bytes), match = actual === entry.sha256?.toLowerCase();
      // Generated numeric certificates and irradiance data are text assets.
      // They need valid JSON and the same exact byte hash as source recipes.
      if (recipe.endsWith('.json')) JSON.parse(bytes.toString('utf8'));
      recipes.push({ id, recipe_file: recipe, bytes: bytes.length, declaredSha256: entry.sha256, measuredSha256: actual, match });
      if (!match) fail('recipe-hash-mismatch', `Recipe SHA-256 is ${actual}.`, recipe, id);
    } catch (error) { fail('recipe-file', error.message, recipe, id); }
  }
  report.manifest = { file: manifestFile, sha256: hash(read(manifestFile)), records: assets.length, allowedClasses: classes, displayed: assets.filter(entry => entry.display === true).length, recipes };
});

section('source assets and existing library dependencies', () => {
  const inventory = [...walk(wingDir), ...walk('assets/wing-vinci')];
  const binaryFiles = [], imports = [], assetReferences = [], libraryIds = new Set(), manifestReferences = [];
  const assetExtension = /\.(?:png|jpe?g|webp|avif|gif|svg|tiff?|exr|hdr|ktx2?|dds|basis|glb|gltf|obj|fbx|bin|wasm|mp[34]|wav|ogg|flac|woff2?|ttf|otf)(?:[?#]|$)/i;
  for (const file of inventory) {
    const bytes = read(file);
    let validText = true;
    try { new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { validText = false; }
    if (!validText || bytes.includes(0) || assetExtension.test(file)) { binaryFiles.push(file); fail('new-source-asset', 'This procedural delivery declares no new image, model, font, audio or binary files in its local source/asset directories.', file); }
  }
  sourceFiles = inventory.filter(file => file.startsWith(wingDir + '/') && /\.(?:ts|tsx|js|mjs|css)$/.test(file) && file !== `${wingDir}/provenance-check.mjs`);
  for (const file of sourceFiles) {
    if (file.endsWith('.css')) {
      for (const match of sourceText(file).matchAll(/(?:url\(\s*['"]?([^\s)'";]+)|@import\s+['"]([^'"]+))/gi)) assetReferences.push({ file, value: match[1] ?? match[2], use: 'CSS resource' });
      continue;
    }
    const parsed = ast(file);
    visit(parsed, node => {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) imports.push({ file, value: node.moduleSpecifier.text });
      if (ts.isCallExpression(node)) {
        const name = ts.isPropertyAccessExpression(node.expression) ? node.expression.name.text : ts.isIdentifier(node.expression) ? node.expression.text : '';
        if (name === 'sync' && node.arguments[0]) for (const value of literalValues(node.arguments[0])) libraryIds.add(`library/${value}`);
        if (['load', 'loadAsync', 'fetch', 'import'].includes(name) || node.expression.kind === ts.SyntaxKind.ImportKeyword) for (const arg of node.arguments) for (const value of literalStrings(arg)) assetReferences.push({ file, value, use: name || 'dynamic import' });
      }
      if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'URL') for (const value of literalStrings(node.arguments?.[0] ?? node)) assetReferences.push({ file, value, use: 'URL' });
      if (ts.isPropertyAssignment(node) && ['manifestId', 'recipe_file'].includes(node.name.getText(parsed).replace(/['"]/g, '')) && ts.isStringLiteralLike(node.initializer) && node.name.getText(parsed).includes('manifestId')) manifestReferences.push({ file, id: node.initializer.text });
      if (ts.isBinaryExpression(node) && ts.isElementAccessExpression(node.left) && ts.isStringLiteralLike(node.left.argumentExpression) && ['naAnchor', 'manifestId'].includes(node.left.argumentExpression.text) && ts.isStringLiteralLike(node.right)) manifestReferences.push({ file, id: node.right.text });
    });
  }
  for (const reference of [...imports.map(value => ({ ...value, use: 'import' })), ...assetReferences]) {
    const { value, file } = reference;
    if (/(?:^|\/)refs\//i.test(value) || /(?:^|\/)brief\/(?:materials|reference|before)\//i.test(value)) fail('reference-source-import', `Reference source enters a resource operation: ${value}`, file);
    else if (assetExtension.test(value) || /^data:(?:image|audio|video|font|application\/octet-stream)/i.test(value)) fail('unmanifested-resource', `Literal resource requires a separate asset-use review: ${value}`, file);
  }
  const publicRaw = json('public/na-manifest.json');
  libraryEntries = Array.isArray(publicRaw) ? publicRaw : publicRaw.assets;
  if (!Array.isArray(libraryEntries)) throw new Error('Public manifest has no assets array.');
  const dependencies = [...libraryIds].sort().map(id => {
    const matches = libraryEntries.filter(entry => entry.id === id), entry = matches[0];
    const valid = matches.length === 1 && entry.wing === 'library' && entry.class === 'CC0' && entry.display === true && textPresent(entry.licence);
    if (!valid) fail('library-dependency', 'Existing dependency must be one displayed, licensed CC0 library entry in public/na-manifest.json.', 'public/na-manifest.json', id);
    return { id, class: entry?.class, display: entry?.display, licence: entry?.licence, valid };
  });
  for (const reference of manifestReferences) {
    const entry = assets.find(asset => asset.id === reference.id);
    if (!entry) fail('manifest-reference', 'Literal manifest/anchor ID has no local manifest entry.', reference.file, reference.id);
    else if (entry.display !== true || entry.class === 'REFERENCE-ONLY') fail('hidden-asset-reference', 'A displayed source reference points at a nondisplayable manifest entry.', reference.file, reference.id);
  }
  report.source = { inventoryFiles: inventory.length, sourceFiles, binaryFiles, imports, literalResourceOperations: assetReferences, libraryDependencies: dependencies, manifestReferences };
});

section('canonical stations, questions, hour and carrier claims', () => {
  const file = `${wingDir}/content.ts`, raw = sourceText(file);
  const canonicalFile = 'src/wings/vinci/data/doors.json', canonical = json(canonicalFile);
  const compiled = ts.transpileModule(raw, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exported = {};
  // Execute only this data module; its sole permitted dependency is the supplied door JSON.
  new vm.Script(compiled, { filename: file }).runInNewContext({ exports: exported, require(specifier) {
    if (specifier !== './data/doors.json?raw') throw new Error(`Unexpected content dependency: ${specifier}`);
    return { default: sourceText(canonicalFile) };
  } }, { timeout: 1000 });
  const stations = exported.vinciContent, expectedIds = canonical.doors.map(door => door.station);
  if (expectedIds.length !== 19 || new Set(expectedIds).size !== 19) throw new Error('Supplied canonical doors do not contain nineteen unique station IDs.');
  if (!Array.isArray(stations)) throw new Error('content.ts does not export vinciContent.');
  const actualIds = stations.map(station => station.id);
  if (JSON.stringify(actualIds) !== JSON.stringify(expectedIds)) fail('station-sequence', 'Station order differs from the nineteen canonical doors.', file);
  let checkedQuestions = 0, documentedStatements = 0, generatedCarrierStatements = 0;
  for (let index = 0; index < stations.length; index++) {
    const station = stations[index], door = canonical.doors[index];
    if (station.number !== index + 1) fail('station-number', 'Number differs from its canonical sequence position.', file, station.id);
    for (const language of ['en', 'de']) {
      if (!textPresent(station.name?.[language]) || !textPresent(station.promise?.[language])) fail('station-copy', `Missing ${language} station name or promise.`, file, station.id);
      if (!door || station.door?.station !== station.id || station.door?.[language] !== door[`question_${language}`]) fail('door-question', `${language} question differs from the supplied canonical door.`, file, station.id);
      else checkedQuestions++;
    }
    if (station.carrierClass !== 'GENERATED' || station.carrierCertainty !== 'reconstructed') fail('carrier-declaration', 'Museum carriers must remain GENERATED/reconstructed.', file, station.id);
    for (const label of station.labels ?? []) {
      if (label.certainty === 'documented') documentedStatements++;
      if (label.target === 'carrier') generatedCarrierStatements++;
      if (label.target === 'carrier' && label.certainty === 'documented') fail('generated-testimony', 'A GENERATED carrier cannot carry a documented claim.', file, label.id);
      if (!textPresent(label.source)) fail('statement-source', 'Statement has no source citation.', file, label.id);
    }
  }
  const rigFile = 'src/wings/vinci/data/light-rig.json', rig = json(rigFile);
  const day = rig.dates.find(value => value.julian_date === '1517-10-10');
  const start = day.keyframes.find(value => value.label === '15:19:00 LAT');
  const end = day.keyframes.find(value => value.label === '15:20:00 LAT');
  const toSeconds = clock => clock.split(':').reduce((value, part) => value * 60 + Number(part), 0);
  const clock = seconds => [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(value => String(value).padStart(2, '0')).join(':');
  const offset = toSeconds('15:19:00') - toSeconds(start.ut);
  const expectedArithmetic = `${start.ut} UT + ${clock(offset)} = 15:19:00 LAT · ΔT = ${day.delta_t_seconds.value.toFixed(1)} s · A = ${start.sun_azimuth_deg.value.toFixed(4)}° · h = ${start.sun_elevation_deg.value.toFixed(4)}°`;
  const actualArithmetic = exported.vinciHourArithmetic;
  for (const language of ['en', 'de']) if (actualArithmetic?.[language] !== expectedArithmetic) fail('hour-arithmetic', `${language} arithmetic differs from the supplied solar key and rounded clock subtraction.`, file);
  const round = (value, digits) => Number(value.toFixed(digits));
  const expectedValues = {
    julianDate: day.julian_date, prolepticGregorianDate: day.proleptic_gregorian_date,
    localApparentTime: '15:19:00', universalTime: start.ut,
    deltaTSeconds: round(day.delta_t_seconds.value, 1), sunAzimuthDegrees: start.sun_azimuth_deg.value,
    sunElevationDegrees: start.sun_elevation_deg.value, renderSunElevationDegrees: start.sun_elevation_apparent_deg.value,
    shadowAzimuthDegrees: start.shadow_azimuth_deg.value, shadowLengthPerHeight: start.shadow_length_per_height.value,
    noonElevationDegrees: round(day.events.find(value => value.label === 'solar-noon').sun_elevation_deg.value, 3),
    minuteEndAzimuthDegrees: round(end.sun_azimuth_deg.value, 3), minuteEndElevationDegrees: round(end.sun_elevation_deg.value, 3),
  };
  for (const [key, value] of Object.entries(expectedValues)) if (exported.vinciHourValues?.[key] !== value) fail('hour-value', `${key}: expected ${value}, found ${exported.vinciHourValues?.[key]}.`, file);
  report.content = { canonicalDoors: canonicalFile, stations: actualIds, checkedQuestions, languages: ['en', 'de'], documentedStatements, generatedCarrierStatements, hour: { source: rigFile, en: actualArithmetic?.en, de: actualArithmetic?.de, expectedArithmetic, clockOffsetSeconds: offset, values: exported.vinciHourValues }, doorOpening: 'not exercised', claimRendering: 'not exercised' };
});

section('declared target dimensions', () => {
  const targets = ['vinci-source', 'vinci-dot', 'wing-step', 'wing-door', 'wing-lobby'];
  const declarations = [];
  for (const file of ['src/styles/wing.css', `${wingDir}/wing.css`]) {
    const css = sourceText(file).replace(/\/\*[\s\S]*?\*\//g, '');
    for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      for (const selector of match[1].split(',').map(value => value.trim())) for (const target of targets) {
        if (!new RegExp(`\\.${target}$`).test(selector)) continue;
        const sizes = {};
        for (const declaration of match[2].matchAll(/(?:^|;)\s*((?:min-|max-)?(?:height|width))\s*:\s*([0-9.]+)px\s*(?:!important)?\s*(?=;|$)/g)) sizes[declaration[1]] = Number(declaration[2]);
        if (Object.keys(sizes).length) declarations.push({ file, selector, target, pixels: sizes });
        for (const [property, value] of Object.entries(sizes)) if (value < 44) fail('target-declared-size', `${selector} declares ${property}:${value}px, below the 44px target minimum.`, file);
      }
    }
  }
  for (const target of targets) if (!declarations.some(value => value.target === target && (value.pixels.height >= 44 || value.pixels['min-height'] >= 44))) fail('target-height-declaration', `No explicit height/min-height of at least 44px found for .${target}.`);
  report.css = { declarations, minimumRequiredPx: 44, measuredBrowserRectangles: false, note: 'Declaration inspection only; cascade, flex shrink, text-dependent widths and overlap require the eyes.' };
});

report.ok = errors.length === 0;
process.stdout.write(JSON.stringify(report, null, 2) + '\n');
process.exitCode = report.ok ? 0 : 1;
