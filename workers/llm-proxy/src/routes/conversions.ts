// Ad Grants conversion tracking endpoint
// Receives gclid + event from client, stores in KV, writes to Analytics Engine.
// Forwarding to Google Ads CAPI is gated behind GOOGLE_ADS_DEVELOPER_TOKEN
// being set as a worker secret — see services/googleAdsCapi.ts.

import type { Env } from '../utils/types';
import { forwardConversionToGoogleAds } from '../services/googleAdsCapi';
import { trackRateLimit, readCountry } from '../utils/analytics';

type ConversionEvent = 'profile_created' | 'start_exploring' | 'mode_selected' | 'council_engaged';

interface ConversionPayload {
  gclid: string;
  event: ConversionEvent;
  timestamp: number;
  figureId?: string;
}

const VALID_EVENTS = new Set<ConversionEvent>([
  'profile_created',
  'start_exploring',
  'mode_selected',
  'council_engaged',
]);

// Rate limit: 500 conversion events per IP per hour. Generous on purpose:
// a single legit user fires at most 3 events per session (client-deduped),
// so 500/hr supports a NATted network (school, office, conference WiFi,
// carrier-grade NAT) without false positives. Abuse protection still
// bounded since each excess request gets 429.
const RATE_LIMIT_WINDOW = 3600;
const RATE_LIMIT_MAX = 500;

export async function handleConversions(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let payload: ConversionPayload;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Validate gclid format (Google click IDs are typically 40-100 chars, alphanumeric with some special chars)
  if (!payload.gclid || typeof payload.gclid !== 'string' || payload.gclid.length < 10 || payload.gclid.length > 200) {
    return Response.json({ error: 'Invalid gclid' }, { status: 400 });
  }

  // Validate event type
  if (!VALID_EVENTS.has(payload.event as ConversionEvent)) {
    return Response.json({ error: 'Invalid event type' }, { status: 400 });
  }

  // Validate timestamp freshness (within last 30 minutes)
  const now = Date.now();
  if (!payload.timestamp || Math.abs(now - payload.timestamp) > 30 * 60 * 1000) {
    return Response.json({ error: 'Stale timestamp' }, { status: 400 });
  }

  // Rate limiting
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const rateLimitKey = `conv_rl:${ip}`;
  const currentCount = parseInt(await env.RATE_LIMITS.get(rateLimitKey) || '0', 10);
  if (currentCount >= RATE_LIMIT_MAX) {
    // Track the hit so the dashboard sees when this fires. Fire-and-forget
    // (we don't await), so it never delays the 429 response.
    trackRateLimit(env, 'conversions', 'conversions', readCountry(request));
    return Response.json({ error: 'Rate limited' }, { status: 429 });
  }
  await env.RATE_LIMITS.put(rateLimitKey, String(currentCount + 1), { expirationTtl: RATE_LIMIT_WINDOW });

  // Store conversion event in KV (for dashboard display)
  const dateKey = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const convKey = `conv:${dateKey}:${payload.event}:${Date.now()}`;
  await env.RATE_LIMITS.put(convKey, JSON.stringify({
    event: payload.event,
    figureId: payload.figureId || null,
    timestamp: payload.timestamp,
    date: dateKey,
  }), { expirationTtl: 90 * 86400 }); // Keep 90 days

  // Increment daily counter for quick dashboard queries
  const counterKey = `conv_count:${dateKey}:${payload.event}`;
  const count = parseInt(await env.RATE_LIMITS.get(counterKey) || '0', 10);
  await env.RATE_LIMITS.put(counterKey, String(count + 1), { expirationTtl: 90 * 86400 });

  // Write to Analytics Engine (for stats dashboard SQL queries)
  if (env.ANALYTICS) {
    env.ANALYTICS.writeDataPoint({
      blobs: [payload.event, payload.figureId || '', payload.gclid.slice(0, 8)],
      doubles: [payload.timestamp],
      indexes: [payload.event],
    });
  }

  // Forward to Google Ads Conversion API (dual-upload to both accounts) +
  // mirror the result to a diagnostic Google Sheet when configured. Both
  // are no-ops when their respective secrets are absent. Fire-and-forget,
  // never blocks the response, never surfaces errors to the client.
  ctx.waitUntil(
    forwardConversionToGoogleAds(env, {
      gclid: payload.gclid,
      event: payload.event,
      timestamp: payload.timestamp,
      figureId: payload.figureId,
      country: readCountry(request),
    }).catch(() => {
      // Forwarding errors are logged inside the service; never propagate
    }),
  );

  return Response.json({ ok: true });
}

// GET endpoint for stats dashboard to read conversion counts
export async function handleConversionStats(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const days = parseInt(url.searchParams.get('days') || '30', 10);
  const results: Record<
    string,
    { profile_created: number; start_exploring: number; mode_selected: number }
  > = {};

  const now = new Date();
  for (let i = 0; i < Math.min(days, 90); i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateKey = date.toISOString().split('T')[0];

    const profileCount = parseInt(await env.RATE_LIMITS.get(`conv_count:${dateKey}:profile_created`) || '0', 10);
    const startCount = parseInt(await env.RATE_LIMITS.get(`conv_count:${dateKey}:start_exploring`) || '0', 10);
    const modeCount = parseInt(await env.RATE_LIMITS.get(`conv_count:${dateKey}:mode_selected`) || '0', 10);

    if (profileCount > 0 || startCount > 0 || modeCount > 0) {
      results[dateKey] = {
        profile_created: profileCount,
        start_exploring: startCount,
        mode_selected: modeCount,
      };
    }
  }

  return Response.json({ days, results });
}
