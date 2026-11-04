// Agora's count, read from agora_llm with fixed questions only, the museum
// count's pattern (museum-count.ts): every question passes the same guard
// before it is sent, house rows are always left out, totals are grouped by UTC
// day and by at most two of the row's fields, and the splits by figure and by
// language leave the worker as weekly cells, each under 5 shown as '<5'.
//
// The row (llm-proxy analytics): blob1 step, blob2 figure or path, blob3
// source class on page rows, blob4 language, blob6 device class, blob7
// country, blob8 'landing' on a visit's first page, blob9 the house mark.
//
// No launch floor here: the row window (92 days) starts long after launch.

import type { Env } from './types';
import type { Fetcher } from './museum';
import { COUNT_WINDOW_DAYS, guardCountSql, weekly, type GuardRules, type WeeklyUse } from './museum-count';
import { DAY_BUCKET, HOUSE_ROWS_OUT, METRICS, WEIGHTED_COUNT, rowsOf } from './metrics';

const DATASET = 'agora_llm';
const DAY_MS = 86400 * 1000;

// Language, device class and country may split a total, never narrow one.
export const AGORA_GUARD: GuardRules = {
  house: HOUSE_ROWS_OUT, marker: 'blob9', narrow: /\bblob[467]\b/, narrowWhat: 'language, device class or country',
};

// The daily totals, by metric. Each is one step of the row, so one question
// split by step answers all of them.
export const DAILY_METRICS = ['story_started', 'story_heard', 'read', 'audio_play', 'page_arrival'] as const;
const STORY_STEPS = ['story_started', 'story_heard'];
const LANG_STEPS = ['story_started', 'story_heard', 'read', 'audio_play'];

const quoted = (list: readonly string[]) => '(' + list.map((v) => "'" + v + "'").join(', ') + ')';

export interface AgoraQuestion { name: string; sql: string }

function question(name: string, fields: Array<[blob: string, alias: 's' | 'k']>, where: string): AgoraQuestion {
  const select = fields.map((f) => f[0] + ' AS ' + f[1]).join(', ');
  const group = fields.map((f) => f[1]).join(', ');
  return {
    name,
    sql: 'SELECT ' + DAY_BUCKET + ' AS d, ' + select + ', ' + WEIGHTED_COUNT + ' AS n FROM ' + DATASET +
      " WHERE timestamp > NOW() - INTERVAL '" + COUNT_WINDOW_DAYS + "' DAY AND " + HOUSE_ROWS_OUT + ' AND ' + where +
      ' GROUP BY d, ' + group + ' ORDER BY d',
  };
}

export function agoraQuestions(): AgoraQuestion[] {
  const steps = DAILY_METRICS.map((m) => METRICS[m].event);
  return [
    question('steps', [['blob1', 's']], 'blob1 IN ' + quoted(steps)),
    question('landings', [['blob3', 'k']], '(' + rowsOf(METRICS.landing) + ')'),
    question('figures', [['blob1', 's'], ['blob2', 'k']], 'blob1 IN ' + quoted(STORY_STEPS)),
    question('langs', [['blob1', 's'], ['blob4', 'k']], 'blob1 IN ' + quoted(LANG_STEPS)),
  ];
}

type Series = Record<string, number[]>;

export interface AgoraCountAnswer {
  state: 'unset' | 'refused' | 'failed' | 'empty' | 'ok';
  dataset: string;
  at: string;
  today: string;
  why?: string;
  first?: string;
  // UTC days from the first counted day to today; today is partial.
  days?: string[];
  // Per metric (metrics.ts), one total per day.
  daily?: Record<string, number[]>;
  // Landings by source class, per day; '' holds rows written before the class existed.
  landings?: Series;
  // Weekly cells from the Monday in weeks, by step and figure, and by step and language.
  figures?: WeeklyUse;
  langs?: WeeklyUse;
  gaps?: string[];
}

class Refused extends Error {}

const plainKey = (v: unknown): string | null => {
  const k = String(v == null ? '' : v);
  return /^[A-Za-z0-9_-]{0,40}$/.test(k) ? k : null;
};

async function ask(env: Env, fetcher: Fetcher, q: AgoraQuestion): Promise<Array<Record<string, unknown>>> {
  const broken = guardCountSql(q.sql, DATASET, AGORA_GUARD);
  if (broken) throw new Error('guard: ' + q.name + ': ' + broken);
  const res = await fetcher('https://api.cloudflare.com/client/v4/accounts/' + env.CF_ACCOUNT_ID + '/analytics_engine/sql', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + env.CF_API_TOKEN, 'Content-Type': 'text/plain' },
    body: q.sql,
    signal: AbortSignal.timeout(15000),
  });
  if (res.status === 401 || res.status === 403) throw new Refused('refused ' + res.status);
  if (!res.ok) {
    void res.body?.cancel().catch(() => {});
    throw new Refused(String(res.status));
  }
  const body = (await res.json()) as { data?: Array<Record<string, unknown>> };
  return Array.isArray(body.data) ? body.data : [];
}

export async function buildAgoraCount(env: Env, fetcher: Fetcher, now: number): Promise<AgoraCountAnswer> {
  const today = new Date(now).toISOString().slice(0, 10);
  const base = { dataset: DATASET, at: new Date(now).toISOString().slice(0, 19) + 'Z', today };
  const questions = agoraQuestions();
  const read = new Map<string, Array<Record<string, unknown>>>();
  const gaps: string[] = [];
  try {
    read.set('steps', await ask(env, fetcher, questions[0]));
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'error';
    if (msg.startsWith('guard:')) throw err;
    if (msg.startsWith('refused')) return { ...base, state: 'refused', why: msg.slice(8) };
    console.error('[agora-count]', msg);
    return { ...base, state: 'failed', why: msg };
  }
  await Promise.all(questions.slice(1).map(async (q) => {
    try { read.set(q.name, await ask(env, fetcher, q)); }
    catch (err) {
      const msg = err instanceof Error ? err.message : 'error';
      if (msg.startsWith('guard:')) throw err;
      console.error('[agora-count]', q.name, msg);
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
  const byStep = columns('steps', 's');
  const daily: Record<string, number[]> = {};
  for (const m of DAILY_METRICS) daily[m] = byStep[METRICS[m].event] || days.map(() => 0);
  const split = (name: string, steps: string[]) => {
    const per: Record<string, Series> = {};
    for (const step of steps) per[step] = columns(name, 'k', (r) => r.s === step);
    return weekly(days, per);
  };

  return {
    ...base,
    state: 'ok',
    first,
    days,
    daily,
    landings: columns('landings', 'k'),
    figures: split('figures', STORY_STEPS),
    langs: split('langs', LANG_STEPS),
    gaps,
  };
}

// The answer is held a few minutes, so a refresh does not ask again.
let held: { until: number; value: AgoraCountAnswer } | null = null;

export async function handleAgoraCount(env: Env, fetcher: Fetcher = (u, i) => fetch(u, i), now: number = Date.now()): Promise<Response> {
  const send = (body: AgoraCountAnswer, status = 200) => new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
  const stamp = { dataset: DATASET, at: new Date(now).toISOString().slice(0, 19) + 'Z', today: new Date(now).toISOString().slice(0, 10) };
  if (!/^[0-9a-f]{32}$/i.test(String(env.CF_ACCOUNT_ID || '').trim()) || !env.CF_API_TOKEN) return send({ ...stamp, state: 'unset' });
  if (held && held.until > now) return send(held.value);
  try {
    const value = await buildAgoraCount(env, fetcher, now);
    held = { until: now + (value.state === 'ok' && !(value.gaps || []).length ? 300 : 60) * 1000, value };
    return send(value);
  } catch (err) {
    console.error('[agora-count]', err instanceof Error ? err.message : err);
    return send({ ...stamp, state: 'failed', why: 'error' }, 502);
  }
}

// Only for tests: forget the held answer.
export function forgetAgoraCount(): void { held = null; }
