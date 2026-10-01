#!/usr/bin/env node
/** Every raw source the wing cites has a public line in citations.ts.
 * Run: node src/wings/vinci/citations-check.mjs
 * Writes JSON to stdout; exit 1 when a raw source has no entry (the display
 * would fall back to the notes line for a path, but a line written for the
 * record is the rule, never the fallback). Offline: reads the sources as text. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const unescape = s => s.replace(/\\u([0-9a-f]{4})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16))).replace(/\\'/g, "'");

// the table, run on its own: the module imports nothing
const compiled = ts.transpileModule(read('src/wings/vinci/citations.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const exported = {};
new vm.Script(compiled, { filename: 'citations.ts' }).runInNewContext({ exports: exported, require() { throw new Error('citations.ts must import nothing'); } }, { timeout: 1000 });
const { CITATIONS, shownCitation } = exported;

// every raw source the content carries: object labels, positional labels, station seeds
const content = read('src/wings/vinci/content.ts');
const raws = new Map();
const add = (raw, where) => { raw = unescape(raw); if (!raws.has(raw)) raws.set(raw, where); };
for (const m of content.matchAll(/source: '((?:[^'\\]|\\.)*)'/g)) add(m[1], 'content.ts label');
for (const m of content.matchAll(/'(?:documented|reconstructed|conjectural|unknown)', '(?:document|measurement|carrier|absence)', '((?:[^'\\]|\\.)*)'/g)) add(m[1], 'content.ts statement');
for (const m of content.matchAll(/\],\s*'(brief\/[^']*)'\)/g)) add(m[1], 'content.ts seed');
// the live wing's own citations: literals, and the provenance objects it joins
const index = read('src/wings/vinci/index.ts');
for (const m of index.matchAll(/shownCitation\('((?:[^'\\]|\\.)*)'\)/g)) add(m[1], 'index.ts literal');
for (const [file, name] of [['terrain-mesh.ts', 'galleryBankCapProvenance'], ['collection.ts', 'collectionProvenance'], ['collection-access.ts', 'collectionAccessProvenance'], ['entry-passage.ts', 'hallLedgeProvenance']]) {
  const text = read(`src/wings/vinci/${file}`), at = text.indexOf(name);
  const list = at < 0 ? null : /source:\s*\[([^\]]*)\]/.exec(text.slice(at));
  if (list) add([...list[1].matchAll(/'([^']*)'/g)].map(x => x[1]).join(' · '), `${file} ${name}`);
}

const missing = [...raws].filter(([raw]) => !(raw in CITATIONS)).map(([raw, where]) => ({ raw, where }));
// a shown line may name a catalogue ("CDS V/50"); it may never name a file or a working folder
const fileLike = /\.(?:md|ts|mjs|json)\b|\b(?:brief|forge|src|refs|scratch)\//;
const leaks = Object.values(CITATIONS).filter(line => fileLike.test(line.en) || fileLike.test(line.de)).map(line => line.en);
const fallbackHolds = fileLike.test(shownCitation('brief/NOT-A-FILE.md').en) === false && fileLike.test(shownCitation('some/folder').en) === false;
const report = { checker: 'vinci-citations', raws: raws.size, entries: Object.keys(CITATIONS).length, missing, leaks, fallbackHolds };
console.log(JSON.stringify(report, null, 1));
process.exit(missing.length || leaks.length || !fallbackHolds ? 1 : 0);
