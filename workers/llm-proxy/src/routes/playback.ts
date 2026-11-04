// Anonymous content playback beacon
// Fires from the client through a track's listening lifecycle (story, teaching,
// prism, council, foreword): it started, it passed each quarter, and it either
// finished or stopped short. Lets the dashboard answer "which content actually
// gets listened to" — pre-rendered audio is served from R2 directly and never
// touches our worker layer otherwise.
//
// Privacy: aggregate counter only. No user dimension. No IP retention. Time
// listened arrives as a coarse bucket index, never as seconds and never as a
// playhead position, and there is no key tying a track's rows together.
// Same legal posture as the rest of analytics — see docs/MEASUREMENT.md.

import { trackPlayback, readCountry, readDevice, readListenLabels, readProbe } from '../utils/analytics';
import { bodyTooLarge, readJsonCapped, BEACON_MAX_BODY_BYTES } from '../middleware/bodyLimit';
import type { Env } from '../utils/types';

interface PlaybackPayload {
  type: 'story' | 'teaching' | 'prism' | 'council' | 'foreword';
  event?: 'started' | 'progress_25' | 'progress_50' | 'progress_75' | 'completed' | 'ended' | 'skimmed';
  figureId?: string;
  mode?: string;
  language?: string;
  bucket?: number;
  chapter?: number;
  probe?: unknown;
  // The story player's labels: the text's version, the landing's class and kind.
  version?: unknown;
  source?: unknown;
  kind?: unknown;
  // 'read' on the public story reader's rows; listening sends none.
  way?: unknown;
}

const VALID_TYPES = new Set(['story', 'teaching', 'prism', 'council', 'foreword']);
// The listening lifecycle of one track: it began, it passed each quarter of
// its length, and it either ran to the end ('completed') or stopped short
// ('ended'). Old clients send only 'started' and 'completed', which still
// mean exactly what they meant before.
const VALID_EVENTS = new Set([
  'started',
  'progress_25',
  'progress_50',
  'progress_75',
  'completed',
  'ended',
]);

// The two ways a track's listening ends. Only these carry the listened-time
// bucket: on any other event the slot stays 0, so a milestone row can never be
// mistaken for a finished listen.
const TERMINAL_EVENTS = new Set(['completed', 'ended']);

// double1 only ever holds a small bucket index, never raw seconds. Six
// buckets (0-14s through 1800s+); anything else collapses to 0.
const MAX_BUCKET = 5;

// Which chapter of a figure's story was played. A small ordinal from the
// content catalog, bounded so the label can only ever be one of a handful of
// known values and nothing free-form can ride in. Out of range means the
// chapter is simply not labelled.
const MAX_CHAPTER = 99;
const VALID_MODES = new Set(['story', 'wisdom', 'prism', 'quest', 'freetalk', 'council', 'foreword']);
const VALID_LANGS = new Set(['en', 'de']);
// The story player's two track types: their rows carry its three labels.
const LABELLED_TYPES = new Set(['story', 'foreword']);

// Reading a story in the public reader, counted in the shape of listening: it
// started, each quarter of the text was read, and the end, or 'skimmed' for an
// end reached faster than it can be read. Each step passed a reading-time floor
// in the browser. These rows go under their own name ('reading'), so every
// count of listening ('playback' rows) stays as it was.
const READ_EVENTS = new Set(['started', 'progress_25', 'progress_50', 'progress_75', 'completed', 'skimmed']);
const FIGURE_ID_RE = /^[a-z0-9-]{1,40}$/;

// Rate limit: 200 playback beacons per IP per hour. Generous since a single
// listening session can easily hit 12+ tracks.
const RATE_LIMIT_WINDOW = 3600;
const RATE_LIMIT_MAX = 200;

export async function handlePlayback(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let payload: PlaybackPayload;
  try {
    const read = await readJsonCapped(request, BEACON_MAX_BODY_BYTES);
    if (!read.ok) return bodyTooLarge();
    payload = read.body as PlaybackPayload;
  } catch {
    // Be quiet on malformed beacons — the client doesn't get to know.
    return new Response(null, { status: 204 });
  }

  // Validate fields. Bad input → silent 204; never error so client beacons stay
  // fire-and-forget.
  if (!VALID_TYPES.has(payload.type)) {
    return new Response(null, { status: 204 });
  }
  // A reading row is the reader's whole closed shape, or nothing; a skim is never a listen.
  const reading = payload.way === 'read';
  if (reading && (!LABELLED_TYPES.has(payload.type) || typeof payload.event !== 'string' || !READ_EVENTS.has(payload.event))) {
    return new Response(null, { status: 204 });
  }
  if (!reading && payload.event === 'skimmed') {
    return new Response(null, { status: 204 });
  }

  // Rate limit per IP. The plain IP appears only inside this short-lived KV
  // key (1-hour TTL, auto-deleted) and never in any stored analytics row.
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const rateLimitKey = `pb_rl:${ip}`;
  const currentCount = parseInt(await env.RATE_LIMITS.get(rateLimitKey) || '0', 10);
  if (currentCount >= RATE_LIMIT_MAX) {
    return new Response(null, { status: 204 });
  }
  await env.RATE_LIMITS.put(rateLimitKey, String(currentCount + 1), { expirationTtl: RATE_LIMIT_WINDOW });

  // Sanitize optional fields against allowlists / patterns.
  const figureId = (typeof payload.figureId === 'string' && FIGURE_ID_RE.test(payload.figureId))
    ? payload.figureId
    : '';
  const mode = (typeof payload.mode === 'string' && VALID_MODES.has(payload.mode))
    ? payload.mode
    : '';
  const lang = (typeof payload.language === 'string') && VALID_LANGS.has(payload.language.slice(0, 2).toLowerCase())
    ? payload.language.slice(0, 2).toLowerCase()
    : '';

  // Default to 'completed' for backward compat with clients on the previous
  // schema; new clients always send the event explicitly.
  const event = (typeof payload.event === 'string' && (reading ? READ_EVENTS : VALID_EVENTS).has(payload.event))
    ? payload.event
    : 'completed';

  // Out-of-range or non-integer buckets collapse to 0 rather than dropping the
  // row: the count of finished listens matters more than the length label.
  const bucket = (typeof payload.bucket === 'number'
    && Number.isInteger(payload.bucket)
    && payload.bucket >= 0
    && payload.bucket <= MAX_BUCKET)
    ? payload.bucket
    : 0;

  // Stays empty unless a client sent a chapter in range, so "no chapter" and
  // "chapter 0" never collapse into each other.
  const chapter = (typeof payload.chapter === 'number'
    && Number.isInteger(payload.chapter)
    && payload.chapter >= 0
    && payload.chapter <= MAX_CHAPTER)
    ? String(payload.chapter)
    : '';

  trackPlayback(env, {
    type: payload.type,
    figureId,
    mode,
    language: lang,
    country: readCountry(request),
    device: readDevice(request),
    event,
    // Reading sends no time at all: the seconds stay in the browser.
    bucket: !reading && TERMINAL_EVENTS.has(event) ? bucket : 0,
    chapter,
    probe: readProbe(payload.probe),
    labels: LABELLED_TYPES.has(payload.type) ? readListenLabels(payload) : undefined,
    way: reading ? 'read' : undefined,
  });

  return new Response(null, { status: 204 });
}
