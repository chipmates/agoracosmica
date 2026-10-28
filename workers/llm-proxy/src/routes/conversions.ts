// Ad Grants conversion tracking endpoint
// Receives gclid + event from client and writes the event to Analytics Engine.
// Forwarding to Google Ads CAPI is gated behind GOOGLE_ADS_DEVELOPER_TOKEN
// being set as a worker secret — see services/googleAdsCapi.ts.

import type { Env } from '../utils/types';
import { forwardConversionToGoogleAds } from '../services/googleAdsCapi';
import { trackRateLimit, readCountry, readDevice } from '../utils/analytics';
import { bodyTooLarge, readJsonCapped, BEACON_MAX_BODY_BYTES } from '../middleware/bodyLimit';

// The two steps the card's words name (consent version 1.3.0): the yes
// itself and 30 seconds of audio actually played.
type ConversionEvent = 'start_exploring' | 'listened';

interface ConversionPayload {
  gclid: string;
  event: ConversionEvent;
  timestamp: number;
  figureId?: string;
}

// Only what the visitor said yes to reaches Google: a step the words no
// longer name is refused, whatever an older cached page still posts. The CAPI
// action map keeps the other ids until the actions are removed in the Ads UI.
const VALID_EVENTS = new Set<ConversionEvent>(['start_exploring', 'listened']);

// Rate limit: 500 conversion events per IP per hour. Generous on purpose:
// a single legit user fires at most 2 events per session (one per event,
// client-deduped), so 500/hr supports a NATted network (school, office,
// conference WiFi, carrier-grade NAT) without false positives. Abuse
// protection still bounded since each excess request gets 429.
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
    const read = await readJsonCapped(request, BEACON_MAX_BODY_BYTES);
    if (!read.ok) return bodyTooLarge();
    payload = read.body as ConversionPayload;
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

  // figureId is stored and later rendered on the stats dashboard, so it must
  // be slug-shaped, never free text (same rule as the funnel route). Anything
  // that fails validation is dropped rather than rejected: the event itself
  // is still real.
  const FIGURE_RE = /^[A-Za-z0-9_-]{1,64}$/;
  const figureId =
    typeof payload.figureId === 'string' && FIGURE_RE.test(payload.figureId)
      ? payload.figureId
      : '';

  // Rate limiting
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const rateLimitKey = `conv_rl:${ip}`;
  const currentCount = parseInt(await env.RATE_LIMITS.get(rateLimitKey) || '0', 10);
  if (currentCount >= RATE_LIMIT_MAX) {
    // Track the hit so the dashboard sees when this fires. Fire-and-forget
    // (we don't await), so it never delays the 429 response.
    trackRateLimit(env, 'conversions', 'conversions', readCountry(request), readDevice(request));
    return Response.json({ error: 'Rate limited' }, { status: 429 });
  }
  await env.RATE_LIMITS.put(rateLimitKey, String(currentCount + 1), { expirationTtl: RATE_LIMIT_WINDOW });

  // Write to Analytics Engine (for stats dashboard SQL queries). The gclid is
  // never written here — it goes only to Google Ads for attribution. Keeping
  // it out of our analytics is what makes the "click ID is not combined with
  // our analytics" claim true.
  if (env.ANALYTICS) {
    env.ANALYTICS.writeDataPoint({
      blobs: [payload.event, figureId],
      doubles: [payload.timestamp],
      indexes: [payload.event],
    });
  }

  // Forward to Google Ads Conversion API (the grant account).
  // A no-op when the developer-token secret is absent. Fire-and-forget,
  // never blocks the response, never surfaces errors to the client.
  ctx.waitUntil(
    forwardConversionToGoogleAds(env, {
      gclid: payload.gclid,
      event: payload.event,
      timestamp: payload.timestamp,
      figureId: figureId || undefined,
      country: readCountry(request),
    }).catch(() => {
      // Forwarding errors are logged inside the service; never propagate
    }),
  );

  return Response.json({ ok: true });
}
