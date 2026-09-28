// POST /v1/session — Turnstile token → JWT
//
// JWT subject is a per-identity UUID v4 (not hashed IP). Client persists the
// UUID in localStorage and re-sends it on every /v1/session call. This binds
// daily quotas to a stable per-device identity instead of per-IP, fixing the
// CGNAT-poisoning problem where mobile users behind one carrier IP shared
// the 30/day chat counter.
//
// Trade-offs:
//   - User clears localStorage → fresh clientId → fresh quota.
//     Mitigated by Turnstile fingerprinting on each fresh session.
//   - JWT no longer IP-bound → token theft window is the same as before
//     (10 min TTL, in-memory only on client).

import { verifyTurnstileToken } from '../services/turnstile';
import { checkAndIncrementSessionRateLimit } from '../middleware/rateLimit';
import { signJWT, createJWTPayload } from '../utils/jwt';
import { trackSession, trackRateLimit, readCountry, readDevice } from '../utils/analytics';
import type { Env } from '../utils/types';

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidClientId(value: unknown): value is string {
  return typeof value === 'string' && UUID_V4_RE.test(value);
}

export async function handleSession(request: Request, env: Env): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const { turnstileToken, clientId, first } = body;
  if (typeof turnstileToken !== 'string' || !turnstileToken) {
    return new Response(
      JSON.stringify({ error: 'Missing turnstileToken' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Verify Turnstile (skip only in local dev with wrangler dev)
  const ip = request.headers.get('CF-Connecting-IP') || undefined;
  // Dev bypass requires: magic token + missing secret + loopback IP (or no IP)
  // In production: TURNSTILE_SECRET_KEY must be set (blocks bypass via condition 2)
  // Defense-in-depth: even without the secret, real client IPs aren't loopback (blocks condition 3)
  const isLoopback = ip === '127.0.0.1' || ip === '::1';
  const isDev = turnstileToken === 'dev-test-token' && !env.TURNSTILE_SECRET_KEY && (!ip || isLoopback);

  if (!isDev) {
    // Ahead of the Turnstile call: minting is the step that creates identities,
    // so the address ceiling has to bite before a solve is paid for.
    const mintLimit = await checkAndIncrementSessionRateLimit(request, env);
    if (!mintLimit.allowed) {
      trackRateLimit(env, 'session', 'ip_ceiling', readCountry(request), readDevice(request));
      return new Response(
        JSON.stringify({
          error: 'Too many sessions from this network. Please try again later.',
          reason: 'ip_ceiling',
          resetsAt: mintLimit.resetsAt,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(mintLimit.retryAfterSeconds),
          },
        }
      );
    }

    const verification = await verifyTurnstileToken(
      turnstileToken,
      env.TURNSTILE_SECRET_KEY,
      ip
    );

    if (!verification.success) {
      return new Response(
        JSON.stringify({ error: 'Turnstile verification failed', detail: verification.error }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  // Identity: reuse client-supplied UUID if present and valid, else mint a fresh one.
  // Validation is essential — a non-UUID string here would land in the "legacy"
  // KV-keying branch and could collide with another user's hashed-IP bucket.
  const finalClientId = isValidClientId(clientId) ? clientId : crypto.randomUUID();

  // Sign JWT with the UUID as subject. No IP binding — JWT is portable across
  // network changes (mobile carrier rotation, WiFi → cellular handoff).
  const payload = createJWTPayload(finalClientId);
  const token = await signJWT(payload, env.JWT_SIGNING_KEY);

  // One session per page: the client flags its first token request of a page
  // load. Nothing identifying is looked up for the count, so two tabs are two
  // sessions, and a request without the flag (an older client) is not counted.
  if (first === true) {
    trackSession(env, 200, readCountry(request), readDevice(request));
  }

  return new Response(
    JSON.stringify({
      token,
      expiresAt: new Date(payload.exp * 1000).toISOString(),
      clientId: finalClientId,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
