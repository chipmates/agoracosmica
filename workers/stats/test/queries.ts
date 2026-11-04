// Every SQL string the worker can send keeps one rule: it counts at the sample
// weight and leaves the house rows out (src/metrics.ts, houseRuleBreak). Run
// from workers/stats: ../llm-proxy/node_modules/.bin/tsx test/queries.ts
//
// The dashboard builds its queries in the page's own script, so the script is
// run here in a bare context: the page's elements are stand-ins that accept
// anything, fetch is answered locally with empty data, and every tab is loaded
// at every range. Each query the page posts is collected, together with the
// fixed questions of the count routes.

import vm from 'node:vm';
import { DASHBOARD_HTML } from '../src/dashboard';
import { countQuestions } from '../src/museum-count';
import { houseRuleBreak } from '../src/metrics';

/** Fixed questions of every count route; a route added later joins this list. */
async function routeQuestions(): Promise<Array<{ from: string; sql: string }>> {
  const out = countQuestions('museum_count').map((q) => ({ from: 'museum count: ' + q.name, sql: q.sql }));
  try {
    const agora = await import('../src/agora-count');
    for (const q of agora.agoraQuestions()) out.push({ from: 'agora count: ' + q.name, sql: q.sql });
  } catch (err) {
    if (!/Cannot find module|ERR_MODULE_NOT_FOUND/.test(String(err))) throw err;
  }
  return out;
}

/** An object that accepts every property read, write and call. */
function anything(): unknown {
  const target = function () {};
  return new Proxy(target, {
    get(_t, key) {
      if (key === Symbol.toPrimitive) return () => '';
      if (key === Symbol.iterator) return function* () {};
      if (key === 'then') return undefined;
      if (key === 'length') return 0;
      return anything();
    },
    set: () => true,
    apply: () => anything(),
    construct: () => anything() as object,
  });
}

const settle = async (rounds = 40) => {
  for (let i = 0; i < rounds; i++) await new Promise((r) => setImmediate(r));
};

export async function pageQueries(html: string = DASHBOARD_HTML): Promise<{ sql: Set<string>; errors: string[] }> {
  const script = /<script>([\s\S]*?)<\/script>/.exec(html.replace(/__LAUNCH_EPOCH_SECONDS__/g, '0'));
  if (!script) throw new Error('no inline script in the page');
  const sql = new Set<string>();
  const errors: string[] = [];
  const fetchStub = async (url: string, init?: { body?: string }) => {
    if (String(url) === '/api/query-batch') {
      const queries = (JSON.parse(String(init?.body || '{}')).queries || []) as Array<{ sql: string }>;
      for (const q of queries) sql.add(q.sql);
      return new Response(JSON.stringify({ results: queries.map(() => ({ data: [] })) }), { headers: { 'Content-Type': 'application/json' } });
    }
    if (String(url) === '/api/query') {
      sql.add(JSON.parse(String(init?.body || '{}')).query);
      return Response.json({ data: [] });
    }
    return Response.json({ state: 'unset' });
  };
  const doc = anything();
  const context = vm.createContext({
    document: doc,
    window: anything(),
    navigator: anything(),
    location: { hash: '', pathname: '/', search: '' },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    fetch: fetchStub,
    Response, URL, URLSearchParams, Intl, Date, Math, JSON, Promise,
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
    requestAnimationFrame: () => 0,
    console: { log: () => {}, warn: () => {}, error: (...a: unknown[]) => errors.push(a.map(String).join(' ')) },
  });
  const run = (code: string) => vm.runInContext(code, context);
  try { run(script[1]); } catch (err) { errors.push('load: ' + String(err)); }
  await settle();
  const tabs = ['overview', 'product', 'audio', 'adgrants', 'museum'];
  const ranges = run('RANGE_OPTS.map(function (o) { return o.val; })') as number[];
  for (const tab of tabs) {
    for (const range of ranges) {
      try { run('S.tab = ' + JSON.stringify(tab) + '; setRange(' + range + ');'); } catch (err) { errors.push(tab + ' ' + range + ': ' + String(err)); }
      await settle();
    }
  }
  return { sql, errors };
}

async function main(): Promise<void> {
  const { sql, errors } = await pageQueries();
  const all = [...sql].map((s) => ({ from: 'page', sql: s })).concat(await routeQuestions());
  const broken = all.map((q) => ({ ...q, why: houseRuleBreak(q.sql) })).filter((q) => q.why);
  const byWhy = new Map<string, number>();
  for (const b of broken) byWhy.set(b.why as string, (byWhy.get(b.why as string) || 0) + 1);
  for (const b of broken.slice(0, 12)) console.error('BREAKS ' + b.why + ' [' + b.from + ']: ' + b.sql.slice(0, 160));
  if (broken.length > 12) console.error('... and ' + (broken.length - 12) + ' more');
  const tabsSeen = sql.size;
  console.log('queries collected: page ' + tabsSeen + ', routes ' + (all.length - tabsSeen) + '; breaking the rule: ' + broken.length +
    (byWhy.size ? ' (' + [...byWhy].map(([w, n]) => w + ' ' + n).join(', ') + ')' : ''));
  if (errors.length) console.log('page script errors while loading (not failures): ' + errors.length);
  // A branch the loaders above did not reach still may not hold a bare count.
  const source = (/<script>([\s\S]*?)<\/script>/.exec(DASHBOARD_HTML) || ['', ''])[1];
  // SQL words in capitals, as the page writes them, so the script's own count() stays out.
  const inSource = (source.match(/\bCOUNT\s*\(|\bAVG\s*\(|\buniq(Exact|Combined)?\s*\(/g) || []).length;
  if (inSource) console.error('BREAKS: ' + inSource + " bare counts or unweighted means in the page's source");
  // A page that sends nothing would pass trivially.
  if (tabsSeen < 50) { console.error('FAIL: only ' + tabsSeen + ' page queries collected'); process.exit(1); }
  if (broken.length || inSource) process.exit(1);
  console.log('every query keeps the rule');
}

if (process.argv[1] && /queries\.ts$/.test(process.argv[1])) void main();
