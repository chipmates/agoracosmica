// The museum's own count, read from its Analytics Engine dataset. The
// questions are fixed here and each one passes guardCountSql before it is
// sent: rows are never joined with each other or with anything else, rows of
// our own test browsers are always left out, and totals are grouped by day and
// by the row's own fields, never by a finer time.
//
// The row: blob1 step, blob2 wing or page kind, blob3 stop number / kind of
// work / door place, blob4 language, blob5 hold, blob6 source word, blob7
// start or inside, blob8 device class, blob9 country, blob10 probe.

import type { Env } from './types';
import type { Fetcher } from './museum';

const DAY_MS = 86400 * 1000;
// Analytics Engine keeps rows three months.
export const COUNT_WINDOW_DAYS = 92;
const DAY_BUCKET = "toStartOfInterval(timestamp, INTERVAL '1' DAY)";
const NOT_PROBE = "blob10 != 'probe'";
// A query may split by day and by at most this many of the row's fields.
const MAX_FIELDS = 2;

export interface CountQuestion { name: string; sql: string }

type Field = [blob: string, alias: 's' | 'k'];

function question(dataset: string, name: string, fields: Field[], where: string): CountQuestion {
  const select = fields.map((f) => f[0] + ' AS ' + f[1]).join(', ');
  const group = fields.map((f) => f[1]).join(', ');
  return {
    name,
    sql: 'SELECT ' + DAY_BUCKET + ' AS d, ' + select + ', SUM(_sample_interval) AS n FROM ' + dataset +
      " WHERE timestamp > NOW() - INTERVAL '" + COUNT_WINDOW_DAYS + "' DAY AND " + NOT_PROBE + (where ? ' AND ' + where : '') +
      ' GROUP BY d, ' + group + ' ORDER BY d',
  };
}

// A real use is a walk that reaches its third stop.
const THIRD_STOP = "(blob1 = 'museum_stop' AND blob3 = '3')";
const WALK_AND_REAL = "(blob1 = 'museum_arrival' OR " + THIRD_STOP + ')';

// The animal pages' kinds, as the site's build writes them (site/functions/_count/lists.js). A new animal page
// adds its kind here, or its rows stay out of animalUse.
export const ANIMAL_PAGES = ['megalodon', 'biggest_dinosaurs', 't_rex', 'spinosaurus', 'woolly_mammoth', 'brachiosaurus', 'triceratops'] as const;
// The steps that carry the arrival's start rule on these pages.
export const ANIMAL_USE_STEPS = ['page_arrival', 'page_read', 'guess_open', 'out_wing'] as const;
const quotedList = (list: readonly string[]) => '(' + list.map((v) => "'" + v + "'").join(', ') + ')';

// animalUse leaves the worker summed by week (Monday to Sunday, UTC), and every weekly cell under 5 as the string
// '<5', so no cell can tell what a single visit did.
const SMALL = 5;
export type WeekCell = number | '<5';
export interface WeeklyUse { weeks: string[]; by: Record<string, Record<string, WeekCell[]>> }

export function mondayOf(day: string): string {
  const t = Date.parse(day + 'T00:00:00Z');
  return new Date(t - ((new Date(t).getUTCDay() + 6) % 7) * DAY_MS).toISOString().slice(0, 10);
}

// Per-day columns (one list per key, aligned with days, which run day by day) into weekly cells.
export function weekly(days: string[], perStep: Record<string, Record<string, number[]>>): WeeklyUse {
  const weeks: string[] = [];
  const slot = days.map((d) => {
    const m = mondayOf(d);
    if (weeks[weeks.length - 1] !== m) weeks.push(m);
    return weeks.length - 1;
  });
  const by: WeeklyUse['by'] = {};
  for (const step of Object.keys(perStep)) {
    by[step] = {};
    for (const word of Object.keys(perStep[step])) {
      const sums = weeks.map(() => 0);
      perStep[step][word].forEach((n, i) => { sums[slot[i]] += n; });
      by[step][word] = sums.map((n): WeekCell => (n < SMALL ? '<5' : n));
    }
  }
  return { weeks, by };
}

export function countQuestions(dataset: string): CountQuestion[] {
  return [
    question(dataset, 'steps', [['blob1', 's']], ''),
    question(dataset, 'stops', [['blob3', 'k']], "blob1 = 'museum_stop'"),
    // Third stops carry the visit's source word since the site began to send it there. Under '' sit third stops of
    // walks with no word, and every one written before then.
    question(dataset, 'walkSources', [['blob1', 's'], ['blob6', 'k']], "(blob1 IN ('museum_arrival', 'museum_use') OR " + THIRD_STOP + ')'),
    question(dataset, 'siteSources', [['blob6', 'k']], "blob1 = 'page_arrival' AND blob7 = 'start'"),
    question(dataset, 'walkLang', [['blob1', 's'], ['blob4', 'k']], WALK_AND_REAL),
    question(dataset, 'walkHold', [['blob1', 's'], ['blob5', 'k']], WALK_AND_REAL),
    question(dataset, 'walkDevice', [['blob1', 's'], ['blob8', 'k']], WALK_AND_REAL),
    question(dataset, 'pageKinds', [['blob1', 's'], ['blob2', 'k']], "blob1 IN ('page_arrival', 'page_read')"),
    question(dataset, 'pageLang', [['blob4', 'k']], "blob1 = 'page_arrival'"),
    question(dataset, 'doors', [['blob2', 's'], ['blob3', 'k']], "blob1 = 'door_press'"),
    // Use on the animal pages by source: visits that began on one of them, by step and source word.
    question(dataset, 'animalUse', [['blob1', 's'], ['blob6', 'k']],
      'blob1 IN ' + quotedList(ANIMAL_USE_STEPS) + ' AND blob2 IN ' + quotedList(ANIMAL_PAGES) + " AND blob7 = 'start'"),
  ];
}

// Splits a list at its top-level commas.
function topLevel(list: string): string[] {
  const out: string[] = [];
  let depth = 0, cur = '', quoted = false;
  for (const ch of list) {
    if (ch === "'") quoted = !quoted;
    if (!quoted && ch === '(') depth++;
    if (!quoted && ch === ')') depth--;
    if (!quoted && depth === 0 && ch === ',') { out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

// Null when a question keeps the count's rules, else the rule it breaks.
// Every question of this module is checked here before it is sent.
export function guardCountSql(sql: string, dataset: string): string | null {
  const s = sql.replace(/\s+/g, ' ').trim();
  const up = s.toUpperCase();
  if (!/^SELECT /.test(up)) return 'not a SELECT';
  if (/;|--|\/\*/.test(s)) return 'more than one statement or a comment';
  if ((up.match(/\bSELECT\b/g) || []).length !== 1) return 'a query inside a query';
  if (/\b(JOIN|UNION|WITH|ARRAY|INTERSECT|EXCEPT|LATERAL)\b/.test(up)) return 'rows joined or combined';
  if ((up.match(/\bFROM\b/g) || []).length !== 1 || s.indexOf(' FROM ' + dataset + ' WHERE ') < 0) return 'not the count dataset alone';
  if (s.indexOf(" WHERE timestamp > NOW() - INTERVAL '") < 0) return 'no time window';
  if (s.indexOf(' AND ' + NOT_PROBE) < 0 || (s.match(/blob10/g) || []).length !== 1) return 'probe rows not left out';
  // An OR outside brackets would let rows past the probe filter.
  const where = / WHERE (.+?) GROUP BY /i.exec(s);
  let flat = where ? where[1] : '';
  while (/\([^()]*\)/.test(flat)) flat = flat.replace(/\([^()]*\)/g, ' _ ');
  if (!where || /\bOR\b/i.test(flat)) return 'probe rows not left out';
  // Language, hold, device class and country may split a total, never narrow one: a filter on them is a finer cell
  // than the split the field count allows.
  if (/\bblob[4589]\b/.test(where[1])) return 'a total narrowed by language, hold, device class or country';
  if (/\bindex\d|\bdouble\d|\bCOUNT\s*\(|\bDISTINCT\b|\buniq|\bany\s*\(|\bgroupArray|\bargM|\btopK|\bmin\s*\(|\bmax\s*\(/i.test(s)) return 'not a total';
  if (/\b(HOUR|MINUTE|SECOND|toHour|toMinute|toSecond|toStartOfHour|toStartOfMinute|toStartOfFiveMinutes|toStartOfFifteenMinutes|toUnixTimestamp|toRelative|formatDateTime|toDateTime)\b/i.test(s)) return 'finer than a day';
  // The time may stand only in the day bucket and in the window.
  const rest = s.split(DAY_BUCKET).join('').replace(/ WHERE timestamp > NOW\(\) - INTERVAL '\d{1,3}' DAY/, ' WHERE');
  if (/\btimestamp\b/i.test(rest)) return 'time read finer than a day';
  if ((s.match(/_sample_interval/g) || []).length !== (s.match(/SUM\(_sample_interval\)/g) || []).length) return 'a row read singly';

  const sel = /^SELECT (.+?) FROM /i.exec(s);
  const grp = / GROUP BY (.+?)( ORDER BY | LIMIT |$)/i.exec(s);
  if (!sel || !grp) return 'not grouped';
  const keys: string[] = [];
  let day = false, blobs = 0, total = false;
  for (const item of topLevel(sel[1])) {
    let m: RegExpExecArray | null;
    if (item === DAY_BUCKET + ' AS d') { day = true; keys.push('d'); }
    else if ((m = /^blob([1-9]) AS ([a-z])$/.exec(item))) { blobs++; keys.push(m[2]); }
    else if (/^SUM\(_sample_interval\) AS [a-z]$/.test(item)) total = true;
    else return 'a selected column that is neither the day, a field nor a total';
  }
  if (!day) return 'not grouped by day';
  if (!total) return 'no total';
  if (blobs > MAX_FIELDS) return 'split by too many fields';
  const grouped = topLevel(grp[1]);
  if (grouped.length !== keys.length || keys.some((k) => grouped.indexOf(k) < 0)) return 'a column read without its group';
  const order = / ORDER BY (.+?)( LIMIT |$)/i.exec(s);
  if (order && topLevel(order[1]).some((o) => keys.indexOf(o.replace(/ (ASC|DESC)$/i, '')) < 0)) return 'ordered by something not grouped';
  return null;
}

// --- Reading ---

type Series = Record<string, number[]>;

export interface CountAnswer {
  state: 'unset' | 'refused' | 'failed' | 'empty' | 'ok';
  dataset: string;
  at: string;
  today: string;
  // Why there is nothing: the HTTP status and the first words of the answer.
  why?: string;
  first?: string;
  days?: string[];
  steps?: Series;
  stops?: Series;
  // real: third stops by source word; '' holds walks with no word and the rows written before the stop carried one
  sources?: { walks: Series; uses: Series; real: Series; site: Series };
  lang?: { walks: Series; real: Series };
  hold?: { walks: Series; real: Series };
  device?: { walks: Series; real: Series };
  pages?: { arrivals: Series; reads: Series; lang: Series };
  doors?: Record<string, Series>;
  // Visits that began on an animal page: per step (arrival, read, guess, wing link) and source word, weekly cells
  // from the Monday in weeks, each under 5 shown as '<5'. Never by day.
  animalUse?: WeeklyUse;
  gaps?: string[];
}

interface Creds { account: string; token: string; dataset: string }

function credsOf(env: Env): Creds | null {
  const dataset = countDatasetOf(env);
  const account = (env.MUSEUM_COUNT_ACCOUNT_ID || env.CF_ACCOUNT_ID || '').trim().toLowerCase();
  const token = (env.MUSEUM_COUNT_API_TOKEN || env.CF_API_TOKEN || '').trim();
  if (!/^[0-9a-f]{32}$/.test(account) || !token) return null;
  return { account, token, dataset };
}

export function countDatasetOf(env: Env): string {
  return /^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(env.MUSEUM_COUNT_DATASET || '') ? (env.MUSEUM_COUNT_DATASET as string) : 'museum_count';
}

class CountRefused extends Error {}

const plainKey = (v: unknown): string | null => {
  const k = String(v == null ? '' : v);
  return /^[A-Za-z0-9_-]{0,32}$/.test(k) ? k : null;
};

async function askCount(c: Creds, fetcher: Fetcher, q: CountQuestion): Promise<Array<Record<string, unknown>>> {
  const broken = guardCountSql(q.sql, c.dataset);
  if (broken) throw new Error('guard: ' + q.name + ': ' + broken);
  const res = await fetcher('https://api.cloudflare.com/client/v4/accounts/' + c.account + '/analytics_engine/sql', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + c.token, 'Content-Type': 'text/plain' },
    body: q.sql,
    signal: AbortSignal.timeout(15000),
  });
  if (res.status === 401 || res.status === 403) throw new CountRefused('refused ' + res.status);
  if (!res.ok) {
    const text = (await res.text()).replace(/\s+/g, ' ').slice(0, 160);
    throw new CountRefused(res.status + ' ' + text);
  }
  const body = (await res.json()) as { data?: Array<Record<string, unknown>> };
  return Array.isArray(body.data) ? body.data : [];
}

async function buildCount(c: Creds, fetcher: Fetcher, now: number): Promise<CountAnswer> {
  const today = new Date(now).toISOString().slice(0, 10);
  const base = { dataset: c.dataset, at: new Date(now).toISOString().slice(0, 19) + 'Z', today };
  const questions = countQuestions(c.dataset);
  const read = new Map<string, Array<Record<string, unknown>>>();
  const gaps: string[] = [];
  // The first question decides whether the dataset answers at all.
  try {
    read.set('steps', await askCount(c, fetcher, questions[0]));
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'error';
    if (msg.startsWith('guard:')) throw err;
    if (msg.startsWith('refused')) return { ...base, state: 'refused', why: msg.slice(8) };
    // A dataset that has never been written to is not there yet.
    if (/^4\d\d /.test(msg) && /not found|unknown|does not exist|no such|missing/i.test(msg)) return { ...base, state: 'empty', why: msg };
    console.error('[museum-count]', msg);
    return { ...base, state: 'failed', why: msg };
  }
  await Promise.all(questions.slice(1).map(async (q) => {
    try { read.set(q.name, await askCount(c, fetcher, q)); }
    catch (err) {
      const msg = err instanceof Error ? err.message : 'error';
      if (msg.startsWith('guard:')) throw err;
      console.error('[museum-count]', q.name, msg);
      gaps.push(q.name);
    }
  }));

  const dayOf = (v: unknown) => String(v == null ? '' : v).slice(0, 10);
  let first = '';
  for (const r of read.get('steps') || []) {
    const d = dayOf(r.d);
    if (/^\d{4}-\d{2}-\d{2}$/.test(d) && Number(r.n) > 0 && (!first || d < first)) first = d;
  }
  if (!first) return { ...base, state: 'empty', why: 'no rows' };
  const days: string[] = [];
  for (let t = Date.parse(first + 'T00:00:00Z'); t <= Date.parse(today + 'T00:00:00Z'); t += DAY_MS) days.push(new Date(t).toISOString().slice(0, 10));
  const at = new Map(days.map((d, i) => [d, i]));

  // Rows of one question into per-day columns, keyed by one field.
  const columns = (name: string, field: 's' | 'k', only?: (r: Record<string, unknown>) => boolean): Series => {
    const out: Series = {};
    for (const r of read.get(name) || []) {
      if (only && !only(r)) continue;
      const i = at.get(dayOf(r.d));
      const key = plainKey(r[field]);
      if (i === undefined || key === null) continue;
      if (!out[key]) out[key] = days.map(() => 0);
      out[key][i] += Number(r.n) || 0;
    }
    return out;
  };
  const isStep = (step: string) => (r: Record<string, unknown>) => r.s === step;
  const pair = (name: string) => ({ walks: columns(name, 'k', isStep('museum_arrival')), real: columns(name, 'k', isStep('museum_stop')) });
  const animalDaily: Record<string, Series> = {};
  for (const step of ANIMAL_USE_STEPS) animalDaily[step] = columns('animalUse', 'k', isStep(step));
  const doors: Record<string, Series> = {};
  for (const r of read.get('doors') || []) {
    const kind = plainKey(r.s);
    if (kind === null || doors[kind]) continue;
    doors[kind] = columns('doors', 'k', (x) => x.s === kind);
  }

  return {
    ...base,
    state: 'ok',
    first,
    days,
    steps: columns('steps', 's'),
    stops: columns('stops', 'k', (r) => /^\d{1,2}$/.test(String(r.k))),
    sources: {
      walks: columns('walkSources', 'k', isStep('museum_arrival')),
      uses: columns('walkSources', 'k', isStep('museum_use')),
      real: columns('walkSources', 'k', isStep('museum_stop')),
      site: columns('siteSources', 'k'),
    },
    lang: pair('walkLang'),
    hold: pair('walkHold'),
    device: pair('walkDevice'),
    pages: {
      arrivals: columns('pageKinds', 'k', isStep('page_arrival')),
      reads: columns('pageKinds', 'k', isStep('page_read')),
      lang: columns('pageLang', 'k'),
    },
    doors,
    animalUse: weekly(days, animalDaily),
    gaps,
  };
}

// The count's answer is held a few minutes, so a refresh does not ask again.
let held: { until: number; value: CountAnswer } | null = null;

export async function handleMuseumCount(env: Env, fetcher: Fetcher = (u, i) => fetch(u, i)): Promise<Response> {
  const now = Date.now();
  const c = credsOf(env);
  const send = (body: CountAnswer, status = 200) => new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
  if (!c) return send({ state: 'unset', dataset: countDatasetOf(env), at: new Date(now).toISOString().slice(0, 19) + 'Z', today: new Date(now).toISOString().slice(0, 10) });
  if (held && held.until > now) return send(held.value);
  try {
    const value = await buildCount(c, fetcher, now);
    held = { until: now + (value.state === 'ok' && !(value.gaps || []).length ? 300 : 60) * 1000, value };
    return send(value);
  } catch (err) {
    console.error('[museum-count]', err instanceof Error ? err.message : err);
    return send({ state: 'failed', dataset: c.dataset, at: new Date(now).toISOString().slice(0, 19) + 'Z', today: new Date(now).toISOString().slice(0, 10), why: 'error' }, 502);
  }
}
