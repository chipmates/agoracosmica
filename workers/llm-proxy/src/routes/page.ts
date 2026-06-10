// Anonymous page-load beacon
// Fires from the client at App module load, before any user interaction.
// Counts arrivals (vs. the existing playback/chat events which only fire
// post-engagement), so we can measure true bounce rate per channel.
//
// Privacy: aggregate counter only. No user dimension. No IP retention.
// Same legal posture as the rest of analytics — see docs/MEASUREMENT.md.

import { trackPageView, readCountry } from '../utils/analytics';
import type { Env } from '../utils/types';

interface PagePayload {
  path?: string;
  language?: string;
}

// Path is sanitized server-side to a safe shape. Anything else becomes empty
// in blob2 so the row is still recorded but the path slot stays clean.
const PATH_RE = /^\/[A-Za-z0-9/_-]{0,60}$/;
const VALID_LANGS = new Set(['en', 'de']);

// Rate limit: 100 page beacons per IP per hour. A real user generates 1-10
// hard page loads per session; this caps abuse without blocking real use.
const RATE_LIMIT_WINDOW = 3600;
const RATE_LIMIT_MAX = 100;

export async function handlePage(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let payload: PagePayload;
  try {
    payload = await request.json();
  } catch {
    // Be quiet on malformed beacons — the client doesn't get to know.
    return new Response(null, { status: 204 });
  }

  // Rate limit per IP. The plain IP appears only inside this short-lived KV
  // key (1-hour TTL, auto-deleted) and never in any stored analytics row.
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const rateLimitKey = `page_rl:${ip}`;
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

  trackPageView(env, {
    path,
    language: lang,
    country: readCountry(request),
  });

  return new Response(null, { status: 204 });
}
