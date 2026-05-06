// JWT verification middleware
//
// Two acceptable subject formats:
//   - UUID v4 (new): per-identity, NOT IP-bound. Allows stable session across
//     network changes (mobile carrier rotation, WiFi handoff).
//   - 32-char hex (legacy): hashed IP from session.ts before the per-identity
//     migration. Still IP-bound — forces clients to refresh into the new
//     UUID format when their IP changes, accelerating the migration.
//
// Legacy branch will go quiet within ~10 min of deploy (JWT expiry) and can be
// removed in a follow-up. See routes/session.ts for the rationale.

import { verifyJWT } from '../utils/jwt';
import type { Env, JWTPayload } from '../utils/types';

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LEGACY_HASHED_IP_RE = /^[0-9a-f]{32}$/i;

async function hashIPForSubject(ip: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(ip + secret);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(hash);
  return Array.from(bytes.slice(0, 16))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function authenticateRequest(
  request: Request,
  env: Env
): Promise<{ payload: JWTPayload } | { error: Response }> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return {
      error: new Response(
        JSON.stringify({ error: 'Missing or invalid Authorization header' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      ),
    };
  }

  const token = authHeader.slice(7);
  const payload = await verifyJWT(token, env.JWT_SIGNING_KEY);

  if (!payload) {
    return {
      error: new Response(
        JSON.stringify({ error: 'Invalid or expired token. Please create a new session.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      ),
    };
  }

  // New per-identity tokens are not IP-bound — accept them as-is.
  if (UUID_V4_RE.test(payload.sub)) {
    return { payload };
  }

  // Legacy IP-bound token: enforce IP match. Forces clients on rotated IPs to
  // refresh sessions, picking up the new UUID format. Tokens that don't match
  // either format are rejected as malformed.
  if (LEGACY_HASHED_IP_RE.test(payload.sub)) {
    const ip = request.headers.get('CF-Connecting-IP') || '0.0.0.0';
    const expectedSub = await hashIPForSubject(ip, env.JWT_SIGNING_KEY);
    if (payload.sub !== expectedSub) {
      return {
        error: new Response(
          JSON.stringify({ error: 'Session invalid. Please create a new session.' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        ),
      };
    }
    return { payload };
  }

  // Subject doesn't match either format — malformed.
  return {
    error: new Response(
      JSON.stringify({ error: 'Session invalid. Please create a new session.' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    ),
  };
}
