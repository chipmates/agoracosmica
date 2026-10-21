// The differential between the old output scanner and this one. Run:
//   pnpm exec tsx test/outputScanDiff.ts
//
// Over the sentences at the edge of each exclusion, the use and mention sets
// and the slogans, calls and denials in their spacing and casing variants:
// lists every text whose whole-text verdict differs, with the exclusion that
// frees it, and counts the texts whose verdict the old scanner made depend on
// the cut. The exit code is 1 when a difference belongs to no exclusion or a
// text is newly cut.

import { MainStreamSafetyScanner } from './fixtures/outputScanMain';
import { MUST_CUT, MUST_PASS } from './fixtures/outputScanSets';
import { CONSTRUCTIONS, VARIANT_TEXTS } from './fixtures/outputScanTexts';
import { Random, differential, randomReads, verdict } from './outputScanLib';

const texts = [...new Set([...CONSTRUCTIONS.map(c => c.text), ...MUST_CUT, ...MUST_PASS, ...VARIANT_TEXTS])];
const differences = differential(texts);
const newCuts = differences.filter(d => d.ours === 'cut');
const unnamed = differences.filter(d => d.frees === null);

const mainCut = texts.filter(text => verdict(new MainStreamSafetyScanner(), text) === 'cut').length;
console.log(`${texts.length} texts; the old scanner cuts ${mainCut} whole, this one ${mainCut - differences.length + newCuts.length}`);
console.log(`${differences.length} differ, ${newCuts.length} newly cut, ${unnamed.length} freed by no named exclusion\n`);
const groups = [...new Set(differences.map(d => d.frees))].sort((a, b) => Number(a === null) - Number(b === null));
for (const frees of groups) {
  const rows = differences.filter(d => d.frees === frees);
  console.log(`${frees ?? 'no exclusion'}: ${rows.length}`);
  for (const row of rows) console.log(`  ${row.main} > ${row.ours}  ${JSON.stringify(row.text)}`);
}

// The old scanner's verdict over random cuts of the same texts.
const rng = new Random(7);
let dependent = 0;
for (const text of texts) {
  const whole = verdict(new MainStreamSafetyScanner(), text);
  let differs = false;
  for (let i = 0; i < 10 && !differs; i++) {
    differs = verdict(new MainStreamSafetyScanner(), text, randomReads(rng, text.length)) !== whole;
  }
  for (let cut = 1; cut < Math.min(text.length, 48) && !differs; cut++) {
    differs = verdict(new MainStreamSafetyScanner(), text, [cut]) !== whole;
  }
  if (differs) dependent++;
}
console.log(`\nold scanner: ${dependent} of ${texts.length} texts get a verdict that depends on the cut`);

const host = globalThis as { process?: { exitCode?: number } };
if (host.process && (newCuts.length > 0 || unnamed.length > 0)) host.process.exitCode = 1;
