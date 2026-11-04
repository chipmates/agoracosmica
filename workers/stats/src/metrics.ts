// One definition of every counted number. The dashboard's queries, the count
// routes and the weekly pull all read this file, so a number is defined once.
//
// This file imports nothing and uses only syntax that type stripping can
// erase, so scripts outside the Worker can load it as plain JavaScript.

// Analytics Engine samples rows at volume and each stored row stands for
// _sample_interval events, so a count is always this sum, never COUNT().
// https://developers.cloudflare.com/analytics/analytics-engine/sql-api/#sampling
export const WEIGHTED_COUNT = 'SUM(_sample_interval)';

// The mean of a double, each row at its sample weight.
export function weightedMean(field: string): string {
  return 'SUM(_sample_interval * ' + field + ') / SUM(_sample_interval)';
}

// House rows on agora_llm: blob9 is 'probe' on rows from a browser marked for
// our own testing, and 'auto' on rows whose beacon came from a hosting network.
// Both stay out of every count. A row with neither passes. agora_audio rows
// never fill blob9, so there the filter passes every row.
export const HOUSE_ROWS_OUT = "(blob9 != 'probe' AND blob9 != 'auto')";

// The museum's own count marks its test browsers in blob10 and has no network mark.
export const MUSEUM_HOUSE_ROWS_OUT = "blob10 != 'probe'";

export const DAY_BUCKET = "toStartOfInterval(timestamp, INTERVAL '1' DAY)";

const HOUSE_BY_DATASET: Record<string, string> = {
  agora_llm: HOUSE_ROWS_OUT,
  agora_audio: HOUSE_ROWS_OUT,
  museum_count: MUSEUM_HOUSE_ROWS_OUT,
};

export function houseFilterOf(dataset: string): string {
  return HOUSE_BY_DATASET[dataset] || (/^museum/.test(dataset) ? MUSEUM_HOUSE_ROWS_OUT : HOUSE_ROWS_OUT);
}

export interface Metric {
  name: string;
  side: 'agora' | 'museum';
  label: string;
  dataset: string;
  // The row's step (blob1), and any further condition on its fields.
  event: string;
  also?: string;
  definition: string;
}

// The rows a metric counts, without the house filter (every query adds it).
export function rowsOf(m: Metric): string {
  return "blob1 = '" + m.event + "'" + (m.also ? ' AND ' + m.also : '');
}

// The numbers the weekly pull leads with and the count routes answer.
export const METRICS: Record<string, Metric> = {
  story_heard: {
    name: 'story_heard', side: 'agora', label: 'stories heard', dataset: 'agora_llm',
    event: 'story_heard',
    definition: '30 seconds of a story heard, once per story and page load',
  },
  story_started: {
    name: 'story_started', side: 'agora', label: 'stories started', dataset: 'agora_llm',
    event: 'story_started',
    definition: "a story's first play in a page load",
  },
  read: {
    name: 'read', side: 'agora', label: 'reads', dataset: 'agora_llm',
    event: 'read',
    definition: 'a reading page held 30 visible seconds or scrolled past its middle, once per page load',
  },
  audio_play: {
    name: 'audio_play', side: 'agora', label: 'audio plays', dataset: 'agora_llm',
    event: 'audio_play',
    definition: 'the first play of an in-page audio player, once per page load',
  },
  page_arrival: {
    name: 'page_arrival', side: 'agora', label: 'page arrivals', dataset: 'agora_llm',
    event: 'page',
    definition: 'a page of the site opened',
  },
  landing: {
    name: 'landing', side: 'agora', label: 'landings', dataset: 'agora_llm',
    event: 'page', also: "blob8 = 'landing'",
    definition: 'the first page of a visit; blob3 holds its source class',
  },
  real_use: {
    name: 'real_use', side: 'museum', label: 'real uses', dataset: 'museum_count',
    event: 'museum_stop', also: "blob3 = '3'",
    definition: 'a walk that reaches its third stop',
  },
  use: {
    name: 'use', side: 'museum', label: 'uses', dataset: 'museum_count',
    event: 'museum_use',
    definition: 'a walk that reaches its second stop or a first close look',
  },
  walk_arrival: {
    name: 'walk_arrival', side: 'museum', label: 'walk arrivals', dataset: 'museum_count',
    event: 'museum_arrival',
    definition: "the walk's page opened",
  },
};

// No distinct count is sent anywhere: a distinct count cannot be weighted.
// The museum page's "different visitors" is Cloudflare's own estimate for the
// zone, read through its GraphQL API (museum.ts), not a count of our rows.

// Where each museum metric sits in the museum count's answer (museum-count.ts).
export const MUSEUM_COUNT_SERIES: Record<string, { group: 'steps' | 'stops'; key: string }> = {
  real_use: { group: 'stops', key: '3' },
  use: { group: 'steps', key: 'museum_use' },
  walk_arrival: { group: 'steps', key: 'museum_arrival' },
};

// --- Windows: whole UTC days, start inclusive, end exclusive ---

const DAY_SECONDS = 86400;

export interface Window { from: number; to: number; label: string }

function dayStart(day: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error('not a day: ' + day);
  const t = Date.parse(day + 'T00:00:00Z');
  if (Number.isNaN(t)) throw new Error('not a day: ' + day);
  return t / 1000;
}

export function dayOf(seconds: number): string {
  return new Date(seconds * 1000).toISOString().slice(0, 10);
}

// Monday 00:00 to the next Monday 00:00, UTC.
export function utcWeek(monday: string): Window {
  const from = dayStart(monday);
  if (new Date(from * 1000).getUTCDay() !== 1) throw new Error(monday + ' is not a Monday');
  return { from, to: from + 7 * DAY_SECONDS, label: 'UTC week ' + monday + ' to ' + dayOf(from + 6 * DAY_SECONDS) };
}

// The last n whole UTC days before the day of `nowMs`.
export function utcDays(n: number, nowMs: number): Window {
  const to = Math.floor(nowMs / 1000 / DAY_SECONDS) * DAY_SECONDS;
  const from = to - n * DAY_SECONDS;
  return { from, to, label: 'UTC days ' + dayOf(from) + ' to ' + dayOf(to - DAY_SECONDS) };
}

export function windowSql(w: Window): string {
  return 'timestamp >= toDateTime(' + w.from + ') AND timestamp < toDateTime(' + w.to + ')';
}

// One weighted count of a metric over a window, optionally split by fields.
export function metricSql(m: Metric, w: Window, split: Array<[field: string, alias: string]> = []): string {
  const fields = split.map(([f, a]) => f + ' AS ' + a);
  const select = fields.concat([WEIGHTED_COUNT + ' AS c']).join(', ');
  const group = split.length ? ' GROUP BY ' + split.map(([, a]) => a).join(', ') + ' ORDER BY c DESC' : '';
  return 'SELECT ' + select + ' FROM ' + m.dataset + ' WHERE ' + houseFilterOf(m.dataset) + ' AND (' + rowsOf(m) + ') AND ' + windowSql(w) + group;
}

// --- The rule every query keeps ---

// Null when a query counts at the sample weight and keeps the house rows out,
// else the rule it breaks. A query that reads no dataset (the page's filler
// "SELECT 1") breaks neither.
export function houseRuleBreak(sql: string): string | null {
  const s = sql.replace(/\s+/g, ' ').trim();
  const from = / FROM ([A-Za-z_][A-Za-z0-9_]*)/i.exec(s);
  if (!from) return null;
  if (/\bCOUNT\s*\(/i.test(s)) return 'a bare row count';
  if (/\bAVG\s*\(/i.test(s)) return 'an unweighted mean';
  if (/\b(uniq\w*|COUNT_DISTINCT)\s*\(/i.test(s)) return 'a distinct count';
  const where = / WHERE (.+?)( GROUP BY | ORDER BY | LIMIT |$)/i.exec(s);
  const house = houseFilterOf(from[1]);
  if (!where || where[1].indexOf(house) < 0) return 'no house filter';
  // An OR outside brackets would let house rows past the filter.
  let flat = where[1];
  while (/\([^()]*\)/.test(flat)) flat = flat.replace(/\([^()]*\)/g, ' _ ');
  if (/\bOR\b/i.test(flat)) return 'the house filter can be bypassed';
  return null;
}
