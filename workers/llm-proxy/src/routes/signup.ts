// Anonymous signup beacon
// Fires from the client when handleEntryComplete runs AND the user is new
// (no prior profile in IndexedDB). Distinct from entry (signup OR sign-in)
// and from profile_created (gclid-gated, ad-attributed only). Closes the
// final gap in the dashboard funnel: total signups including organic.
//
// Privacy: aggregate counter only. No user dimension. No IP retention.
// Same legal posture as the rest of analytics.

import { trackSignup, readCountry } from '../utils/analytics';
import type { Env } from '../utils/types';

interface SignupPayload {
  path?: string;
  language?: string;
}

const PATH_RE = /^\/[A-Za-z0-9/_-]{0,60}$/;
const VALID_LANGS = new Set(['en', 'de']);

// Rate limit: 20 signup beacons per IP per hour. A signup is a one-time event
// per user; a single IP rarely creates more than a handful of accounts
// legitimately. Lower limit than entry because signup is rarer.
const RATE_LIMIT_WINDOW = 3600;
const RATE_LIMIT_MAX = 20;

export async function handleSignup(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let payload: SignupPayload;
  try {
    payload = await request.json();
  } catch {
    return new Response(null, { status: 204 });
  }

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const rateLimitKey = `signup_rl:${ip}`;
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

  trackSignup(env, {
    path,
    language: lang,
    country: readCountry(request),
  });

  return new Response(null, { status: 204 });
}
