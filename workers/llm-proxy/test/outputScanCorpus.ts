// Scans our own displayed texts with the output scanner. Run:
//   pnpm exec tsx test/outputScanCorpus.ts [client assets root]
//
// Walks every block under the root (txt and md files, and every string in a
// json file), feeds each text whole and in reads of 1, 4 and 9 characters
// to this scanner and to the old one, and lists every text either would cut,
// by block. Without a root it takes the client's assets in this repository,
// and skips the run when they are not there. The exit code is 1 when this
// scanner cuts a text at any read size.

import { StreamSafetyScanner } from '../src/utils/streamSafety';
import { MainStreamSafetyScanner } from './fixtures/outputScanMain';
import { fixedReads, verdict } from './outputScanLib';

const DEFAULT_ROOT = '../../client/src/assets';
// 0 is the whole text in one read.
const READS = [0, 1, 4, 9];

// The worker's types know no node modules; the walker loads them at run time.
interface Fs {
  existsSync(path: string): boolean;
  readdirSync(dir: string, options: { withFileTypes: true }): { name: string; isDirectory(): boolean }[];
  readFileSync(path: string, encoding: 'utf8'): string;
  statSync(path: string): { size: number };
}
interface Path {
  join(...parts: string[]): string;
  relative(from: string, to: string): string;
}
const FS_MODULE: string = 'node:fs';
const PATH_MODULE: string = 'node:path';

interface Doc { where: string; text: string }

function walk(fs: Fs, path: Path, dir: string, docs: Doc[]): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(fs, path, file, docs); continue; }
    if (/\.(txt|md)$/.test(entry.name)) {
      docs.push({ where: file, text: fs.readFileSync(file, 'utf8') });
    } else if (entry.name.endsWith('.json') && !entry.name.includes('timestamps') && fs.statSync(file).size < 20_000_000) {
      const strings: string[] = [];
      const visit = (v: unknown): void => {
        if (typeof v === 'string') strings.push(v);
        else if (Array.isArray(v)) v.forEach(visit);
        else if (v && typeof v === 'object') Object.values(v).forEach(visit);
      };
      try { visit(JSON.parse(fs.readFileSync(file, 'utf8'))); } catch { continue; }
      strings.forEach((text, i) => docs.push({ where: `${file}#${i}`, text }));
    }
  }
}

const cutAt = (make: () => { check(t: string): boolean; finish(): boolean }, text: string): string[] =>
  READS.filter(read => verdict(make(), text, read === 0 ? [] : fixedReads(text.length, read)) === 'cut')
    .map(read => (read === 0 ? 'whole' : String(read)));

async function main(): Promise<number> {
  const host = globalThis as { process?: { argv?: string[] } };
  const fs = (await import(FS_MODULE)) as Fs;
  const path = (await import(PATH_MODULE)) as Path;
  const root = host.process?.argv?.[2] ?? DEFAULT_ROOT;
  if (!fs.existsSync(root)) {
    console.log(`outputScanCorpus: skipped (${root} is not there)`);
    return 0;
  }
  const blocks = fs.readdirSync(root, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name).sort();
  let total = 0;
  let chars = 0;
  const cuts: string[] = [];
  let oursCut = 0;
  console.log('block: texts, chars; old scanner cuts (whole, at any read); this scanner cuts (whole, at any read)');
  for (const block of blocks) {
    const docs: Doc[] = [];
    walk(fs, path, path.join(root, block), docs);
    const count = { mainWhole: 0, mainAny: 0, oursWhole: 0, oursAny: 0 };
    let blockChars = 0;
    for (const doc of docs) {
      blockChars += doc.text.length;
      const main = cutAt(() => new MainStreamSafetyScanner(), doc.text);
      const ours = cutAt(() => new StreamSafetyScanner(), doc.text);
      if (main.includes('whole')) count.mainWhole++;
      if (main.length > 0) count.mainAny++;
      if (ours.includes('whole')) count.oursWhole++;
      if (ours.length > 0) { count.oursAny++; oursCut++; }
      if (main.length > 0 || ours.length > 0) {
        cuts.push(`${path.relative(root, doc.where)}  old: ${main.join(',') || 'pass'}  new: ${ours.join(',') || 'pass'}  ${JSON.stringify(doc.text.slice(0, 100))}`);
      }
    }
    total += docs.length;
    chars += blockChars;
    if (docs.length > 0) {
      console.log(`${block}: ${docs.length} texts, ${(blockChars / 1e6).toFixed(2)}M chars; old ${count.mainWhole}, ${count.mainAny}; new ${count.oursWhole}, ${count.oursAny}`);
    }
  }
  for (const where of cuts) console.log(`  cut: ${where}`);
  console.log(`\n${total} texts, ${(chars / 1e6).toFixed(1)}M chars; this scanner cuts ${oursCut} at any read size (whole, 1, 4, 9)`);
  return oursCut;
}

// A plain script: a cut text makes the exit code 1.
const host = globalThis as { process?: { exitCode?: number } };
main().then(
  cuts => { if (host.process && cuts > 0) host.process.exitCode = 1; },
  err => {
    console.log(`FAIL  corpus run crashed: ${(err as Error).message}`);
    if (host.process) host.process.exitCode = 1;
  },
);
