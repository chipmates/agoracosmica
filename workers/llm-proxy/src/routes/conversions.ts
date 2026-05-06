// Ad Grants conversion tracking endpoint
// Receives gclid + event from client, stores in KV, writes to Analytics Engine

import type { Env } from '../utils/types';

interface ConversionPayload {
  gclid: string;
  event: 'profile_created' | 'audio_played_30s';
  timestamp: number;
  figureId?: string;
}

const VALID_EVENTS = new Set(['profile_created', 'audio_played_30s']);

// Rate limit: 100 conversion events per IP per hour
const RATE_LIMIT_WINDOW = 3600;
const RATE_LIMIT_MAX = 100;

export async function handleConversions(
  request: Request,
  env: Env
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
  if (!VALID_EVENTS.has(payload.event)) {
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

  return Response.json({ ok: true });
}

// GET endpoint for stats dashboard to read conversion counts
export async function handleConversionStats(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const days = parseInt(url.searchParams.get('days') || '30', 10);
  const results: Record<string, { profile_created: number; audio_played_30s: number }> = {};

  const now = new Date();
  for (let i = 0; i < Math.min(days, 90); i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateKey = date.toISOString().split('T')[0];

    const profileCount = parseInt(await env.RATE_LIMITS.get(`conv_count:${dateKey}:profile_created`) || '0', 10);
    const audioCount = parseInt(await env.RATE_LIMITS.get(`conv_count:${dateKey}:audio_played_30s`) || '0', 10);

    if (profileCount > 0 || audioCount > 0) {
      results[dateKey] = { profile_created: profileCount, audio_played_30s: audioCount };
    }
  }

  return Response.json({ days, results });
}
