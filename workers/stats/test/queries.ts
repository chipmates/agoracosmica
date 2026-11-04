// Every SQL string the worker sends on its own keeps one rule: it counts at
// the sample weight and leaves the house rows out (src/metrics.ts,
// houseRuleBreak). Run from workers/stats: ../llm-proxy/node_modules/.bin/tsx test/queries.ts
//
// The worker's own questions are the fixed ones of the count routes. The SQL
// that /api/query and /api/query-batch pass on is written by their callers,
// so its rule is kept where it is written.

import { countQuestions } from '../src/museum-count';
import { agoraQuestions } from '../src/agora-count';
import { houseRuleBreak } from '../src/metrics';

/** Fixed questions of every count route; a route added later joins this list. */
function routeQuestions(): Array<{ from: string; sql: string }> {
  const museum = countQuestions('museum_count').map((q) => ({ from: 'museum count: ' + q.name, sql: q.sql }));
  const agora = agoraQuestions().map((q) => ({ from: 'agora count: ' + q.name, sql: q.sql }));
  // A route that asks nothing would pass trivially.
  if (!museum.length || !agora.length) throw new Error('a count route lists no question');
  return museum.concat(agora);
}

function main(): void {
  const all = routeQuestions();
  const broken = all.map((q) => ({ ...q, why: houseRuleBreak(q.sql) })).filter((q) => q.why);
  for (const b of broken) console.error('BREAKS ' + b.why + ' [' + b.from + ']: ' + b.sql.slice(0, 160));
  console.log('queries collected: routes ' + all.length + '; breaking the rule: ' + broken.length);
  if (broken.length) process.exit(1);
  console.log('every query keeps the rule');
}

if (process.argv[1] && /queries\.ts$/.test(process.argv[1])) main();
