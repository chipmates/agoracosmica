// Anonymous entry beacon
// Fires from the client when the user transitions from the LoginPage into
// the app (handleEntryComplete in App.tsx). Sits between the page-load
// beacon (every arrival) and the session row (Turnstile-gated, only on
// first chat / audio interaction). Lets the dashboard answer "of all
// arrivals, how many decided to enter the app at all" — the most
// informative bounce stage.
//
// Privacy: aggregate counter only. No user dimension. No IP retention.
// Same legal posture as the rest of analytics — see docs/MEASUREMENT.md.

import { trackEntry, readMarketingSource, readCountry } from '../utils/analytics';
import type { Env } from '../utils/types';

interface EntryPayload {
  path?: string;
  language?: string;
}

const PATH_RE = /^\/[A-Za-z0-9/_-]{0,60}$/;
const VALID_LANGS = new Set(['en', 'de']);

// Rate limit: 50 entry beacons per IP per hour. An entry event fires only
// once per LoginPage→HomePage transition; bots cycling won't naturally hit
// this without intent.
const RATE_LIMIT_WINDOW = 3600;
const RATE_LIMIT_MAX = 50;

export async function handleEntry(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let payload: EntryPayload;
  try {
    payload = await request.json();
  } catch {
    return new Response(null, { status: 204 });
  }

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const rateLimitKey = `entry_rl:${ip}`;
  const currentCount = parseInt(await env.RATE_LIMITS.get(rateLimitKey) || '0', 10);
  if (currentCount >= RATE_LIMIT_MAX) {
    return new Response(null, { status: 204 });
  }
  await env.RATE_LIMITS.put(rateLimitKey, String(currentCount + 1), { expirationTtl: RATE_LIMIT_WINDOW });

  const path = (typeof payload.path === 'string' && PATH_RE.test(payload.path))
    ? payload.path
    : '';
  const lang = (typeof payload.language === 'string') && VALID_LANGS.has(payload.language.slice(0, 2).toLowerCase())
    ? payload.language.slice(0, 2).toLowerCase()
    : '';

  trackEntry(env, {
    path,
    language: lang,
    marketingSource: readMarketingSource(request),
    country: readCountry(request),
  });

  return new Response(null, { status: 204 });
}
