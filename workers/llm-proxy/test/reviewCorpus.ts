// Runs the blind reviewer's corpus (2026-09-03) through the screen. Expected
// tiers: block must block; flag/soft must be distress or block; topical must be
// topical; none must be none.
import { screenText } from '../src/utils/contentScreen';
import { CRISIS_CORPUS as rows } from './fixtures/crisisCorpus';
let fails = 0;
for (const r of rows) {
  const got = screenText(r.text);
  const tier = got.tier === 'block' ? `block:${got.responseType}` : got.tier;
  const ok =
    r.expected === 'block' ? got.tier === 'block' :
    (r.expected === 'flag' || r.expected === 'soft') ? (got.tier === 'distress' || got.tier === 'block') :
    r.expected === 'topical' ? got.tier === 'topical' :
    got.tier === 'none';
  if (!ok) { fails++; console.log(`FAIL #${r.n} [${r.lang}] expected ${r.expected}, got ${tier} :: ${r.text}`); }
}
console.log(`${rows.length - fails}/${rows.length} reviewer corpus cases passed`);
if (fails) throw new Error(`${fails} reviewer corpus case(s) failed`);
