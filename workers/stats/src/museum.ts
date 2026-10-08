// Museum of Ages: the totals Cloudflare holds for the museum's zone, read on
// the server with a read-only token. The site itself counts nothing, so this
// module only ever asks for grouped totals: never single requests, never an
// address, a user agent, a referrer or a network. Every query is fixed here;
// the dashboard cannot send one of its own.

import type { Env } from './types';

const GRAPHQL_URL = 'https://api.cloudflare.com/client/v4/graphql';
const DAY_S = 86400;
const DAY_MS = DAY_S * 1000;
const HOUR_MS = 3600 * 1000;

export type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

interface Limit { maxDuration: number; notOlderThan: number }
interface Limits { daily: Limit; hourly: Limit; adaptive: Limit; read: boolean }

// Used when the zone's own limits cannot be read: the smallest windows any
// plan gives, so a query built from them is never refused for its range.
const FALLBACK_LIMITS: Limits = {
  daily: { maxDuration: 365 * DAY_S, notOlderThan: 365 * DAY_S },
  hourly: { maxDuration: 3 * DAY_S, notOlderThan: 3 * DAY_S },
  adaptive: { maxDuration: DAY_S, notOlderThan: 7 * DAY_S },
  read: false,
};

const DEFAULT_HOST = 'museumofages.org';
// The first language stands at the root of the site, the others in a folder
// of their own name.
const DEFAULT_LANGS = ['en', 'de', 'fr', 'it', 'es', 'pt-BR', 'bg'];
const WEEK_DAYS = 7;

// The site's fixed pages by kind, in every language. A one-part path that is
// none of these is a wing's page, a two-part path a topic page.
const ABOUT_SLUGS = new Set(['what-this-museum-is', 'was-dieses-museum-ist', 'qu-est-ce-que-ce-musee', 'cos-e-questo-museo', 'que-es-este-museo', 'o-que-e-este-museu', 'kakvo-e-tozi-muzey']);
const PRIVACY_SLUGS = new Set(['privacy', 'datenschutz', 'confidentialite', 'privacidad', 'privacidade', 'poveritelnost']);
const LEGAL_SLUGS = new Set(['imprint', 'impressum']);
const KIND_ORDER = ['front', 'wing', 'topic', 'about', 'walk', 'privacy', 'legal', 'other'];

export type PageKind = 'front' | 'wing' | 'topic' | 'about' | 'privacy' | 'legal' | 'walk' | 'other';

interface Config {
  token: string;
  zone: string;
  host: string;
  open: string;
  langs: string[];
  stops: string[];
  // Why Cloudflare said no during this request: token, zone or query.
  refusals: Set<string>;
}

function list(raw: string | undefined, ok: RegExp): string[] {
  return (raw || '').split(',').map((s) => s.trim()).filter((s) => ok.test(s));
}

function readConfig(env: Env): Config | null {
  const token = (env.MUSEUM_CF_API_TOKEN || '').trim();
  const zone = (env.MUSEUM_ZONE_TAG || '').trim().toLowerCase();
  // Every value below is written into a query, so each is held to a shape
  // that cannot carry a quote.
  if (!token || !/^[0-9a-f]{32}$/.test(zone)) return null;
  const host = /^[a-z0-9.-]{3,80}$/.test(env.MUSEUM_HOST || '') ? (env.MUSEUM_HOST as string) : DEFAULT_HOST;
  const open = /^\d{4}-\d{2}-\d{2}$/.test(env.MUSEUM_OPEN_DATE || '') ? (env.MUSEUM_OPEN_DATE as string) : '';
  const langs = list(env.MUSEUM_LANGS, /^[A-Za-z]{2,3}(-[A-Za-z]{2,4})?$/);
  return {
    token, zone, host, open,
    langs: langs.length ? langs : DEFAULT_LANGS,
    stops: list(env.MUSEUM_WALK_STOPS, /^[a-z0-9-]{1,48}$/),
    refusals: new Set(),
  };
}

// --- A short-lived store for answers, so a refresh does not ask again ---

const memory = new Map<string, { until: number; value: unknown }>();

function edgeCache(): Cache | null {
  return typeof caches === 'undefined' ? null : caches.default;
}

async function cached<T>(key: string, ttlOf: (value: T) => number, make: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const held = memory.get(key);
  if (held && held.until > now) return held.value as T;
  const address = 'https://museum-totals.invalid/v1/' + key;
  const edge = edgeCache();
  if (edge) {
    try {
      const hit = await edge.match(address);
      if (hit) {
        const value = (await hit.json()) as T;
        memory.set(key, { until: now + Math.min(ttlOf(value), 60) * 1000, value });
        return value;
      }
    } catch { /* read as a miss */ }
  }
  const value = await make();
  const ttl = ttlOf(value);
  memory.set(key, { until: now + ttl * 1000, value });
  if (memory.size > 200) for (const [k, v] of memory) if (v.until <= now) memory.delete(k);
  if (edge) {
    try {
      await edge.put(address, new Response(JSON.stringify(value), {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=' + ttl },
      }));
    } catch { /* the answer still goes out */ }
  }
  return value;
}

// --- Asking Cloudflare ---

// Cloudflare answered and said no: the plan lacks the field, the range is out
// of reach, or the token does not see the zone.
class Refused extends Error {}

type Row = Record<string, unknown>;
type Zone = Record<string, unknown>;

async function ask(cfg: Config, fetcher: Fetcher, body: string): Promise<Zone> {
  const query = '{ viewer { zones(filter: {zoneTag: "' + cfg.zone + '"}) { ' + body + ' } } }';
  const res = await fetcher(GRAPHQL_URL, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + cfg.token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(15000),
  });
  if (res.status === 401 || res.status === 403) throw new Refused('token');
  if (!res.ok) throw new Error('upstream ' + res.status);
  const json = (await res.json()) as { data?: { viewer?: { zones?: Zone[] } } | null; errors?: Array<{ message?: string }> | null };
  if (json.errors && json.errors.length) {
    // The message names a field or a limit, never a secret. It stays in the log.
    console.error('[museum] refused:', String(json.errors[0].message || '').slice(0, 200));
    throw new Refused('query');
  }
  const zone = json.data && json.data.viewer && json.data.viewer.zones ? json.data.viewer.zones[0] : undefined;
  if (!zone) throw new Refused('zone');
  return zone;
}

// Tries the fullest form of a question first and a plainer one after a
// refusal. Answers with the zone and which form it was, or null.
async function askFirst(cfg: Config, fetcher: Fetcher, bodies: string[]): Promise<{ zone: Zone; form: number } | null> {
  for (let i = 0; i < bodies.length; i++) {
    try {
      return { zone: await ask(cfg, fetcher, bodies[i]), form: i };
    } catch (err) {
      if (!(err instanceof Refused)) {
        console.error('[museum] unreachable:', err instanceof Error ? err.message : 'error');
        return null;
      }
      cfg.refusals.add(err.message);
      // A token or a zone that is wrong stays wrong for every form.
      if (err.message !== 'query') return null;
    }
  }
  return null;
}

const num = (v: unknown): number => (typeof v === 'number' && isFinite(v) ? v : Number(v) || 0);
const obj = (v: unknown): Row => (v && typeof v === 'object' ? (v as Row) : {});
const arr = (v: unknown): Row[] => (Array.isArray(v) ? (v as Row[]) : []);

const iso = (ms: number): string => new Date(ms).toISOString().slice(0, 19) + 'Z';
const dateOf = (ms: number): string => new Date(ms).toISOString().slice(0, 10);
const dayStart = (date: string): number => Date.parse(date + 'T00:00:00Z');

async function readLimits(cfg: Config, fetcher: Fetcher): Promise<Limits> {
  const fields = '{ enabled maxDuration notOlderThan }';
  const got = await askFirst(cfg, fetcher, [
    'settings { httpRequests1dGroups ' + fields + ' httpRequests1hGroups ' + fields + ' httpRequestsAdaptiveGroups ' + fields + ' }',
  ]);
  if (!got) return FALLBACK_LIMITS;
  const s = obj(got.zone.settings);
  const one = (name: string, fallback: Limit): Limit => {
    const v = obj(s[name]);
    const maxDuration = num(v.maxDuration);
    const notOlderThan = num(v.notOlderThan);
    return maxDuration > 0 && notOlderThan > 0 ? { maxDuration, notOlderThan } : fallback;
  };
  return {
    daily: one('httpRequests1dGroups', FALLBACK_LIMITS.daily),
    hourly: one('httpRequests1hGroups', FALLBACK_LIMITS.hourly),
    adaptive: one('httpRequestsAdaptiveGroups', FALLBACK_LIMITS.adaptive),
    read: true,
  };
}

const limitsOf = (cfg: Config, fetcher: Fetcher): Promise<Limits> =>
  cached('limits', (v) => (v.read ? 3600 : 300), () => readLimits(cfg, fetcher));

function pieces(from: number, to: number, maxDuration: number): Array<[number, number]> {
  const step = Math.max(300, maxDuration) * 1000;
  const out: Array<[number, number]> = [];
  for (let a = from; a < to && out.length < 24; a += step) out.push([a, Math.min(to, a + step)]);
  return out;
}

// The oldest moment a dataset still answers for, with room for the clock.
const floorOf = (now: number, limit: Limit): number => now - limit.notOlderThan * 1000 + 10 * 60 * 1000;

// --- Reading a path as one of our own pages ---

export function classify(path: string, langs: string[]): { lang: string; kind: PageKind } | null {
  let p = path.split('?')[0];
  if (p.endsWith('index.html')) p = p.slice(0, -10);
  const parts = p.split('/').filter(Boolean);
  if (parts[0] === 'w' && parts.length === 2) return { lang: '', kind: 'walk' };
  let lang = langs[0] || 'en';
  const folder = (parts[0] || '').toLowerCase();
  const named = langs.find((code, i) => i > 0 && code.toLowerCase() === folder);
  if (named) { lang = named; parts.shift(); }
  if (parts.length === 0) return { lang, kind: 'front' };
  const last = parts[parts.length - 1];
  if (last === '404' || last === '404.html') return null;
  if (parts.length === 1) {
    if (ABOUT_SLUGS.has(last)) return { lang, kind: 'about' };
    if (PRIVACY_SLUGS.has(last)) return { lang, kind: 'privacy' };
    if (LEGAL_SLUGS.has(last)) return { lang, kind: 'legal' };
    return { lang, kind: 'wing' };
  }
  if (parts.length === 2) return { lang, kind: 'topic' };
  return { lang, kind: 'other' };
}

// A still's path names the stop it shows: .../stills/<form>/<size>/stop-<id>.<hash>.webp
export function stopOf(path: string): string | null {
  const name = path.slice(path.lastIndexOf('/') + 1);
  if (!name.startsWith('stop-')) return null;
  const dot = name.indexOf('.');
  if (dot < 6) return null;
  const ext = name.slice(name.lastIndexOf('.') + 1);
  if (ext !== 'webp' && ext !== 'avif' && ext !== 'jpg' && ext !== 'png') return null;
  return name.slice(5, dot);
}

// --- Page-level totals ---

// A count of pages and, where Cloudflare gives it, of arrivals among them.
type Pair = [number, number | null];
type Counts = Record<string, number>;

interface DayPages {
  d: string;
  pages: null | {
    total: number;
    arrivals: number | null;
    byLang: Record<string, Pair>;
    byKind: Record<string, Pair>;
    walks: number;
  };
  started: number | null;
}

// Everything read at page level: one entry per UTC day from `from` on, and
// how often each stop's picture was asked for in the three frames.
interface PageRead {
  from: string;
  days: DayPages[];
  stops: null | { today: Counts; week: Counts; all: Counts };
}

function span(cfg: Config, from: number, to: number): string {
  return 'datetime_geq: "' + iso(from) + '", datetime_lt: "' + iso(to) + '", requestSource: "eyeball", clientRequestHTTPHost: "' + cfg.host + '"';
}

// A page that was opened: an answer of the page kind that went out whole.
function pageSpan(cfg: Config, from: number, to: number): string {
  return span(cfg, from, to) + ', edgeResponseContentTypeName: "html", edgeResponseStatus: 200';
}

function stillsOf(cfg: Config, name: string, from: number, to: number): string {
  return name + ': httpRequestsAdaptiveGroups(limit: 3000, filter: {' + span(cfg, from, to) +
    ', clientRequestPath_like: "/film/%/stills/%"}, orderBy: [count_DESC]) { count dimensions { clientRequestPath } }';
}

function emptyDay(d: string, visits: boolean): DayPages {
  return { d, pages: { total: 0, arrivals: visits ? 0 : null, byLang: {}, byKind: {}, walks: 0 }, started: null };
}

function addPage(day: DayPages, cfg: Config, path: string, c: number, v: number | null): void {
  const pages = day.pages;
  const seen = classify(path, cfg.langs);
  if (!pages || !seen) return;
  const add = (into: Record<string, Pair>, key: string) => {
    const cur = into[key] || [0, v === null ? null : 0];
    into[key] = [cur[0] + c, cur[1] === null || v === null ? null : cur[1] + v];
  };
  pages.total += c;
  if (v === null) pages.arrivals = null;
  else if (pages.arrivals !== null) pages.arrivals += v;
  add(pages.byKind, seen.kind);
  if (seen.kind === 'walk') pages.walks += c;
  else add(pages.byLang, seen.lang);
}

function addStills(into: Counts, rows: Row[]): void {
  for (const row of rows) {
    const stop = stopOf(String(obj(row.dimensions).clientRequestPath || ''));
    if (stop) into[stop] = (into[stop] || 0) + num(row.count);
  }
}

// One question for the whole stretch, split by day. Answers with null when
// Cloudflare refuses it, and the day-by-day form below takes over.
async function readStretch(cfg: Config, fetcher: Fetcher, from: number, weekStart: number, todayStart: number, now: number): Promise<PageRead | null> {
  const pagesWith = (extra: string) =>
    'pages: httpRequestsAdaptiveGroups(limit: 10000, filter: {' + pageSpan(cfg, from, now) + '}, orderBy: [count_DESC]) { count ' + extra + 'dimensions { date clientRequestPath } }';
  const film =
    ' index: httpRequestsAdaptiveGroups(limit: 100, filter: {' + span(cfg, from, now) + ', clientRequestPath_like: "/film/%/film.json"}, orderBy: [date_ASC]) { count dimensions { date } } ' +
    stillsOf(cfg, 'sToday', todayStart, now) + ' ' + stillsOf(cfg, 'sWeek', weekStart, now) + ' ' + stillsOf(cfg, 'sAll', from, now);
  const got = await askFirst(cfg, fetcher, [pagesWith('sum { visits } ') + film, pagesWith('') + film]);
  if (!got) return null;
  const visits = got.form === 0;
  const days = new Map<string, DayPages>();
  for (let t = Math.floor(from / DAY_MS) * DAY_MS; t < now; t += DAY_MS) {
    const day = emptyDay(dateOf(t), visits);
    day.started = 0;
    days.set(day.d, day);
  }
  for (const row of arr(got.zone.pages)) {
    const dim = obj(row.dimensions);
    const day = days.get(String(dim.date || ''));
    if (day) addPage(day, cfg, String(dim.clientRequestPath || ''), num(row.count), visits ? num(obj(row.sum).visits) : null);
  }
  for (const row of arr(got.zone.index)) {
    const day = days.get(String(obj(row.dimensions).date || ''));
    if (day) day.started = (day.started || 0) + num(row.count);
  }
  const stops = { today: {} as Counts, week: {} as Counts, all: {} as Counts };
  addStills(stops.today, arr(got.zone.sToday));
  addStills(stops.week, arr(got.zone.sWeek));
  addStills(stops.all, arr(got.zone.sAll));
  return { from: iso(from), days: [...days.values()], stops };
}

// The form of the day question that last went through, kept for an hour so
// a field the plan lacks is not asked for again on every day of every refresh.
let dayForm = { start: 0, until: 0 };

async function readDay(cfg: Config, fetcher: Fetcher, limits: Limits, from: number, to: number): Promise<{ day: DayPages; stops: Counts | null }> {
  const day: DayPages = { d: dateOf(from), pages: null, started: null };
  let stops: Counts | null = null;
  for (const [a, b] of pieces(from, to, limits.adaptive.maxDuration)) {
    const pagesWith = (extra: string) =>
      'pages: httpRequestsAdaptiveGroups(limit: 2000, filter: {' + pageSpan(cfg, a, b) + '}, orderBy: [count_DESC]) { count ' + extra + 'dimensions { clientRequestPath } }';
    const film = ' ' + stillsOf(cfg, 'stills', a, b) +
      ' index: httpRequestsAdaptiveGroups(limit: 1, filter: {' + span(cfg, a, b) + ', clientRequestPath_like: "/film/%/film.json"}) { count }';
    const forms = [pagesWith('sum { visits } ') + film, pagesWith('') + film, pagesWith('sum { visits } '), pagesWith('')];
    const start = dayForm.until > Date.now() ? dayForm.start : 0;
    const got = await askFirst(cfg, fetcher, forms.slice(start));
    if (!got) continue;
    const form = got.form + start;
    dayForm = { start: form, until: form === start && start > 0 ? dayForm.until : Date.now() + 3600 * 1000 };
    const visits = form === 0 || form === 2;
    if (!day.pages) day.pages = emptyDay(day.d, visits).pages;
    for (const row of arr(got.zone.pages)) {
      addPage(day, cfg, String(obj(row.dimensions).clientRequestPath || ''), num(row.count), visits ? num(obj(row.sum).visits) : null);
    }
    if (form < 2) {
      const index = arr(got.zone.index)[0];
      day.started = (day.started || 0) + (index ? num(index.count) : 0);
      stops = stops || {};
      addStills(stops, arr(got.zone.stills));
    }
  }
  return { day, stops };
}

// The same reading one UTC day at a time, for the last week only.
async function readDays(cfg: Config, fetcher: Fetcher, limits: Limits, from: number, todayStart: number, now: number): Promise<PageRead> {
  const jobs: Array<Promise<{ day: DayPages; stops: Counts | null }>> = [];
  for (let start = Math.floor(from / DAY_MS) * DAY_MS; start < now; start += DAY_MS) {
    const a = Math.max(start, from);
    const b = Math.min(start + DAY_MS, now);
    const whole = a === start && b === start + DAY_MS;
    // A finished day no longer moves. A day with a hole in it is asked again soon.
    jobs.push(cached('day/' + dateOf(start) + (whole ? '' : '/part'),
      (v) => (!v.day.pages ? 60 : whole ? 6 * 3600 : 180),
      () => readDay(cfg, fetcher, limits, a, b)));
  }
  const read = await Promise.all(jobs);
  const today = dateOf(todayStart);
  let stops: PageRead['stops'] = null;
  for (const r of read) {
    if (!r.stops) continue;
    stops = stops || { today: {}, week: {}, all: {} };
    for (const id of Object.keys(r.stops)) {
      stops.week[id] = (stops.week[id] || 0) + r.stops[id];
      stops.all[id] = stops.week[id];
      if (r.day.d === today) stops.today[id] = r.stops[id];
    }
  }
  return { from: iso(from), days: read.map((r) => r.day), stops };
}

// --- The main answer ---

interface DayRow {
  d: string;
  req: number;
  pv: number;
  uniq: number;
  bytes: number;
  stopped: number;
  err5: number;
  arrivals: number | null;
  pages: number | null;
  walks: number | null;
  started: number | null;
}

interface Frame {
  req: number;
  pv: number;
  uniq: number | null;
  bytes: number;
  stopped: number;
  err5: number;
  arrivals: number | null;
  pages: number | null;
  walks: number | null;
  started: number | null;
}

type Split = Array<{ key: string; today: Pair; week: Pair }>;

export interface MuseumAnswer {
  configured: true;
  at: string;
  host: string;
  open: string;
  today: string;
  // Where each kind of total begins: the day series, the week, the page-level totals, the hours.
  reach: { daily: string; week: string; pages: string; hourly: string; pagesSinceOpen: boolean };
  days: DayRow[];
  frames: { today: Frame; week: Frame; open: Frame };
  countries: { week: Array<[string, number]>; open: Array<[string, number]> };
  byLang: Split | null;
  byKind: Split | null;
  stops: Array<{ id: string; today: number; week: number; open: number | null }> | null;
  gaps: string[];
}

function topCountries(map: Map<string, number>): Array<[string, number]> {
  return [...map.entries()].filter((e) => e[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 12);
}

async function buildAnswer(cfg: Config, fetcher: Fetcher, now: number): Promise<MuseumAnswer> {
  const limits = await limitsOf(cfg, fetcher);
  const today = dateOf(now);
  const todayStart = dayStart(today);
  const gaps: string[] = [];

  // Whole-zone totals by day, from the opening or as far back as the plan reaches.
  const dailyFloor = dateOf(floorOf(now, limits.daily) + DAY_MS);
  const openFrom = cfg.open ? (cfg.open > dailyFloor ? cfg.open : dailyFloor) : dateOf(todayStart - 29 * DAY_MS);
  const weekAgo = dateOf(todayStart - (WEEK_DAYS - 1) * DAY_MS);
  const weekFrom = weekAgo > openFrom ? weekAgo : openFrom;
  const range = (from: string) => 'filter: {date_geq: "' + from + '", date_leq: "' + today + '"}';
  const dayFields = 'dimensions { date } sum { requests pageViews bytes threats';

  const daily = await askFirst(cfg, fetcher, [
    'days: httpRequests1dGroups(limit: 400, ' + range(openFrom) + ', orderBy: [date_ASC]) { ' + dayFields +
      ' countryMap { clientCountryName requests } responseStatusMap { edgeResponseStatus requests } } uniq { uniques } }',
    'days: httpRequests1dGroups(limit: 400, ' + range(openFrom) + ', orderBy: [date_ASC]) { ' + dayFields + ' } uniq { uniques } }',
  ]);
  if (!daily) gaps.push('daily');
  else if (daily.form > 0) gaps.push('countries');

  // Distinct visitors cannot be added up across days, so the two longer
  // frames ask for their own figure.
  const spans = daily ? await askFirst(cfg, fetcher, [
    'week: httpRequests1dGroups(limit: 1, ' + range(weekFrom) + ') { uniq { uniques } } open: httpRequests1dGroups(limit: 1, ' + range(openFrom) + ') { uniq { uniques } }',
  ]) : null;
  if (!spans && daily) gaps.push('visitors');

  // Page-level totals reach as far back as one question may span. They start
  // at the opening when that lies inside the reach, else on a whole day.
  const reach = now - Math.min(limits.adaptive.notOlderThan * 1000 - 10 * 60 * 1000, limits.adaptive.maxDuration * 1000);
  const openStart = cfg.open ? dayStart(cfg.open) : 0;
  const pagesFrom = openStart >= reach ? openStart : Math.ceil(reach / DAY_MS) * DAY_MS;
  const weekStart = Math.max(dayStart(weekFrom), pagesFrom);
  const read = await cached('pages', (v) => (v.days.some((d) => d.pages) ? 180 : 60), async () =>
    (await readStretch(cfg, fetcher, pagesFrom, weekStart, todayStart, now)) ||
    (await readDays(cfg, fetcher, limits, weekStart, todayStart, now)));
  const pagesSinceOpen = !!cfg.open && read.from === iso(openStart);
  if (!read.days.some((d) => d.pages)) gaps.push('pages');
  else if (read.days.some((d) => d.pages && d.pages.arrivals === null)) gaps.push('arrivals');
  if (!read.stops) gaps.push('film');
  if (cfg.refusals.has('token')) gaps.unshift('token');
  else if (cfg.refusals.has('zone')) gaps.unshift('zone');

  const empty = (): Frame => ({ req: 0, pv: 0, uniq: null, bytes: 0, stopped: 0, err5: 0, arrivals: null, pages: null, walks: null, started: null });
  const frames = { today: empty(), week: empty(), open: empty() };
  const lands = { week: new Map<string, number>(), open: new Map<string, number>() };
  const rows = new Map<string, DayRow>();

  for (const row of daily ? arr(daily.zone.days) : []) {
    const d = String(obj(row.dimensions).date || '');
    const sum = obj(row.sum);
    let err5 = 0;
    for (const s of arr(sum.responseStatusMap)) if (num(s.edgeResponseStatus) >= 500) err5 += num(s.requests);
    const r: DayRow = {
      d, req: num(sum.requests), pv: num(sum.pageViews), uniq: num(obj(row.uniq).uniques), bytes: num(sum.bytes),
      stopped: num(sum.threats), err5, arrivals: null, pages: null, walks: null, started: null,
    };
    rows.set(d, r);
    const into: Array<'today' | 'week' | 'open'> = ['open'];
    if (d === today) into.push('today');
    if (d >= weekFrom) into.push('week');
    for (const key of into) {
      const f = frames[key];
      f.req += r.req; f.pv += r.pv; f.bytes += r.bytes; f.stopped += r.stopped; f.err5 += r.err5;
    }
    for (const c of arr(sum.countryMap)) {
      const code = String(c.clientCountryName || 'XX');
      if (d >= weekFrom) lands.week.set(code, (lands.week.get(code) || 0) + num(c.requests));
      lands.open.set(code, (lands.open.get(code) || 0) + num(c.requests));
    }
  }
  if (daily) {
    const t = rows.get(today);
    frames.today.uniq = t ? t.uniq : 0;
  }
  if (spans) {
    const one = (v: unknown): number => { const row = arr(v)[0]; return row ? num(obj(row.uniq).uniques) : 0; };
    frames.week.uniq = one(spans.zone.week);
    frames.open.uniq = one(spans.zone.open);
  }

  for (const d of read.days) {
    if (!d.pages && d.started === null) continue;
    const r = rows.get(d.d) || { d: d.d, req: 0, pv: 0, uniq: 0, bytes: 0, stopped: 0, err5: 0, arrivals: null, pages: null, walks: null, started: null };
    if (d.pages) { r.arrivals = d.pages.arrivals; r.pages = d.pages.total; r.walks = d.pages.walks; }
    r.started = d.started;
    rows.set(d.d, r);
    const into: Array<'today' | 'week' | 'open'> = [];
    if (d.d === today) into.push('today');
    if (d.d >= weekFrom) into.push('week');
    if (pagesSinceOpen) into.push('open');
    for (const key of into) {
      const f = frames[key];
      if (d.pages) {
        f.pages = (f.pages || 0) + d.pages.total;
        f.walks = (f.walks || 0) + d.pages.walks;
        if (d.pages.arrivals !== null) f.arrivals = (f.arrivals || 0) + d.pages.arrivals;
      }
      if (d.started !== null) f.started = (f.started || 0) + d.started;
    }
  }

  const plus = (a: Pair, b: Pair): Pair => [a[0] + b[0], a[1] === null || b[1] === null ? null : a[1] + b[1]];
  const splitOf = (pick: (d: DayPages) => Record<string, Pair> | null, order: string[]): Split | null => {
    const map = new Map<string, { today: Pair; week: Pair }>();
    let any = false;
    for (const key of order) map.set(key, { today: [0, 0], week: [0, 0] });
    for (const d of read.days) {
      const part = d.d >= weekFrom ? pick(d) : null;
      if (!part) continue;
      any = true;
      for (const key of Object.keys(part)) {
        const cur = map.get(key) || { today: [0, 0] as Pair, week: [0, 0] as Pair };
        cur.week = plus(cur.week, part[key]);
        if (d.d === today) cur.today = plus(cur.today, part[key]);
        map.set(key, cur);
      }
    }
    if (!any) return null;
    const noVisits = gaps.indexOf('arrivals') >= 0;
    const out: Split = [];
    for (const [key, v] of map) {
      out.push({ key, today: noVisits ? [v.today[0], null] : v.today, week: noVisits ? [v.week[0], null] : v.week });
    }
    return out;
  };

  const byLang = splitOf((d) => (d.pages ? d.pages.byLang : null), cfg.langs);
  const kinds = splitOf((d) => (d.pages ? d.pages.byKind : null), KIND_ORDER);
  const byKind = kinds ? kinds.filter((k) => k.week[0] > 0 || k.key !== 'other') : null;

  let stops: MuseumAnswer['stops'] = null;
  if (read.stops) {
    const found = read.stops;
    const ids = cfg.stops.slice();
    for (const id of Object.keys(found.all)) if (ids.indexOf(id) < 0) ids.push(id);
    stops = ids.map((id) => ({ id, today: found.today[id] || 0, week: found.week[id] || 0, open: pagesSinceOpen ? found.all[id] || 0 : null }));
  }

  return {
    configured: true,
    at: iso(now),
    host: cfg.host,
    open: cfg.open,
    today,
    reach: { daily: openFrom, week: weekFrom, pages: read.from, hourly: iso(floorOf(now, limits.hourly)), pagesSinceOpen },
    days: [...rows.values()].sort((a, b) => (a.d < b.d ? -1 : 1)),
    frames,
    countries: { week: topCountries(lands.week), open: topCountries(lands.open) },
    byLang, byKind, stops, gaps,
  };
}

// --- One chosen day, hour by hour ---

interface HourRow {
  t: string;
  req: number | null;
  uniq: number | null;
  pages: number | null;
  arrivals: number | null;
  walks: number | null;
  started: number | null;
}

export interface HoursAnswer {
  configured: true;
  at: string;
  from: string;
  hours: HourRow[];
  gaps: string[];
}

async function buildHours(cfg: Config, fetcher: Fetcher, now: number, from: number): Promise<HoursAnswer> {
  const limits = await limitsOf(cfg, fetcher);
  const to = Math.min(from + DAY_MS, now);
  const gaps: string[] = [];
  const hours = new Map<string, HourRow>();
  for (let t = from; t < from + DAY_MS; t += HOUR_MS) {
    hours.set(iso(t), { t: iso(t), req: null, uniq: null, pages: null, arrivals: null, walks: null, started: null });
  }
  const hourKey = (v: unknown): string => { const ms = Date.parse(String(v || '')); return isNaN(ms) ? '' : iso(ms); };
  const startOf = (limit: Limit): number => Math.ceil(Math.max(from, floorOf(now, limit)) / HOUR_MS) * HOUR_MS;

  const hFrom = startOf(limits.hourly);
  if (hFrom < to) {
    const got = await askFirst(cfg, fetcher, [
      'hours: httpRequests1hGroups(limit: 30, filter: {datetime_geq: "' + iso(hFrom) + '", datetime_lt: "' + iso(to) + '"}, orderBy: [datetime_ASC]) { dimensions { datetime } sum { requests } uniq { uniques } }',
    ]);
    if (!got) gaps.push('hourly');
    else {
      for (let t = hFrom; t < to; t += HOUR_MS) { const h = hours.get(iso(t)); if (h) { h.req = 0; h.uniq = 0; } }
      for (const row of arr(got.zone.hours)) {
        const h = hours.get(hourKey(obj(row.dimensions).datetime));
        if (h) { h.req = num(obj(row.sum).requests); h.uniq = num(obj(row.uniq).uniques); }
      }
    }
  } else gaps.push('hourly-reach');

  const aFrom = startOf(limits.adaptive);
  if (aFrom < to) {
    let pagesOk = false, visitsOk = true, filmOk = true;
    for (const [a, b] of pieces(aFrom, to, limits.adaptive.maxDuration)) {
      const group = (name: string, filter: string, extra: string) =>
        name + ': httpRequestsAdaptiveGroups(limit: 100, filter: {' + filter + '}, orderBy: [datetimeHour_ASC]) { count ' + extra + 'dimensions { datetimeHour } }';
      const walks = group('walks', pageSpan(cfg, a, b) + ', clientRequestPath_like: "/w/%"', '');
      const film = group('film', span(cfg, a, b) + ', clientRequestPath_like: "/film/%/film.json"', '');
      const got = await askFirst(cfg, fetcher, [
        group('pages', pageSpan(cfg, a, b), 'sum { visits } ') + ' ' + walks + ' ' + film,
        group('pages', pageSpan(cfg, a, b), '') + ' ' + walks + ' ' + film,
        group('pages', pageSpan(cfg, a, b), ''),
      ]);
      if (!got) continue;
      pagesOk = true;
      if (got.form > 0) visitsOk = false;
      if (got.form > 1) filmOk = false;
      for (let t = Math.floor(a / HOUR_MS) * HOUR_MS; t < b; t += HOUR_MS) {
        const h = hours.get(iso(t));
        if (!h) continue;
        h.pages = h.pages || 0;
        if (got.form === 0) h.arrivals = h.arrivals || 0;
        if (got.form < 2) { h.walks = h.walks || 0; h.started = h.started || 0; }
      }
      const fill = (list: Row[], set: (h: HourRow, row: Row) => void) => {
        for (const row of list) {
          const h = hours.get(hourKey(obj(row.dimensions).datetimeHour));
          if (h) set(h, row);
        }
      };
      fill(arr(got.zone.pages), (h, row) => {
        h.pages = (h.pages || 0) + num(row.count);
        if (got.form === 0) h.arrivals = (h.arrivals || 0) + num(obj(row.sum).visits);
      });
      if (got.form < 2) {
        fill(arr(got.zone.walks), (h, row) => { h.walks = (h.walks || 0) + num(row.count); });
        fill(arr(got.zone.film), (h, row) => { h.started = (h.started || 0) + num(row.count); });
      }
    }
    if (!pagesOk) gaps.push('pages');
    else {
      if (!visitsOk) gaps.push('arrivals');
      if (!filmOk) gaps.push('film');
    }
  } else gaps.push('pages-reach');
  if (cfg.refusals.has('token')) gaps.unshift('token');
  else if (cfg.refusals.has('zone')) gaps.unshift('zone');

  return { configured: true, at: iso(now), from: iso(from), hours: [...hours.values()], gaps };
}

// --- The two routes ---

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export async function handleMuseum(request: Request, env: Env, fetcher: Fetcher = (u, i) => fetch(u, i)): Promise<Response> {
  const cfg = readConfig(env);
  if (!cfg) return json({ configured: false });
  const url = new URL(request.url);
  const now = Date.now();
  try {
    if (url.pathname === '/api/museum/hours') {
      // The day is Cloudflare's own, cut at midnight UTC, so the hours add
      // up to the figures of that day elsewhere on the panel.
      const day = url.searchParams.get('day') || '';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || isNaN(dayStart(day))) return json({ error: 'day' }, 400);
      const from = dayStart(day);
      if (from > now || from < now - 400 * DAY_MS) return json({ error: 'day' }, 400);
      const live = from + DAY_MS > now;
      return json(await cached('hours/' + day, (v) => (v.gaps.length || live ? 60 : 900), () => buildHours(cfg, fetcher, now, from)));
    }
    return json(await cached('answer', () => 120, () => buildAnswer(cfg, fetcher, now)));
  } catch (err) {
    console.error('[museum]', err instanceof Error ? err.message : err);
    return json({ configured: true, error: 'failed' }, 502);
  }
}
