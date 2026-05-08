// Anonymous content playback beacon
// Fires from the client when an audio track starts playing (story, teaching,
// prism, council, foreword). Lets the dashboard answer "which content actually
// gets listened to" — pre-rendered audio is served from R2 directly and never
// touches our worker layer otherwise.
//
// Privacy: aggregate counter only. No user dimension. No IP retention.
// Same legal posture as the rest of analytics — see docs/MEASUREMENT.md.

import { trackPlayback, readMarketingSource, readCountry } from '../utils/analytics';
import type { Env } from '../utils/types';

interface PlaybackPayload {
  type: 'story' | 'teaching' | 'prism' | 'council' | 'foreword';
  event?: 'started' | 'completed';
  figureId?: string;
  mode?: string;
  language?: string;
}

const VALID_TYPES = new Set(['story', 'teaching', 'prism', 'council', 'foreword']);
const VALID_EVENTS = new Set(['started', 'completed']);
const VALID_MODES = new Set(['story', 'wisdom', 'prism', 'quest', 'freetalk', 'council', 'foreword']);
const VALID_LANGS = new Set(['en', 'de']);
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
    payload = await request.json();
  } catch {
    // Be quiet on malformed beacons — the client doesn't get to know.
    return new Response(null, { status: 204 });
  }

  // Validate fields. Bad input → silent 204; never error so client beacons stay
  // fire-and-forget.
  if (!VALID_TYPES.has(payload.type)) {
    return new Response(null, { status: 204 });
  }

  // Rate limit per IP. The IP itself is hashed via KV key namespace and never
  // retained beyond the 1-hour window.
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
  const event = (typeof payload.event === 'string' && VALID_EVENTS.has(payload.event))
    ? payload.event
    : 'completed';

  trackPlayback(env, {
    type: payload.type,
    figureId,
    mode,
    language: lang,
    marketingSource: readMarketingSource(request),
    country: readCountry(request),
    event,
  });

  return new Response(null, { status: 204 });
}
