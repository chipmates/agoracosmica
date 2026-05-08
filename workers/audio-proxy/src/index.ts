import { TIMEOUTS } from './config';
import { handlePreflight, corsHeaders } from './cors';
import { selectServers, refreshHealth, getAggregatedHealth } from './health';
import { proxyWithFailover, proxyWithFailoverFromBuffer } from './proxy';
import { checkAudioRateLimit, buildRateLimitResponse } from './rateLimit';
import type { Env } from './types';

// Closed allowlist for marketing source labels — mirrors llm-proxy/utils/analytics.ts.
// Validated server-side so the dashboard never sees free-text values.
const ALLOWED_MARKETING_SOURCES = new Set([
  'spotify', 'grants', 'paid', 'organic', 'direct', 'unknown',
]);

function readMarketingSource(request: Request): string {
  const raw = request.headers.get('X-Marketing-Source');
  if (!raw) return 'direct';
  const lower = raw.toLowerCase();
  return ALLOWED_MARKETING_SOURCES.has(lower) ? lower : 'unknown';
}

function readCountry(request: Request): string {
  const country = (request as Request & { cf?: { country?: string } }).cf?.country;
  if (typeof country === 'string' && country.length === 2) return country;
  return 'XX';
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return handlePreflight(request, env);
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // Refresh health async after every request
    ctx.waitUntil(refreshHealth(env));

    // --- Routes ---

    // Worker health (static)
    if (path === '/health' && request.method === 'GET') {
      return new Response(JSON.stringify({ status: 'ok', worker: 'agora-cosmica-audio' }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders(request, env) },
      });
    }

    // Aggregated server health
    if (path === '/v1/audio/health' && request.method === 'GET') {
      const res = await getAggregatedHealth(env);
      // Add CORS headers
      const headers = new Headers(res.headers);
      for (const [k, v] of Object.entries(corsHeaders(request, env))) {
        headers.set(k, v);
      }
      return new Response(res.body, { status: res.status, headers });
    }

    // TTS proxy (GPU-aware rate limiting)
    if (path === '/v1/audio/speech' && request.method === 'POST') {
      const startMs = Date.now();

      // Buffer body once (needed for: language extraction + failover retry)
      const bodyBuffer = await request.arrayBuffer();

      // Extract language and model from request body for tier-aware limiting
      let language = 'English';
      let model = 'unknown';
      try {
        const parsed = JSON.parse(new TextDecoder().decode(bodyBuffer));
        if (parsed.language === 'German') language = 'German';
        if (typeof parsed.model === 'string') model = parsed.model;
      } catch { /* default to English on parse failure */ }

      // Load-test bypass: authenticated calls that match LOAD_TEST_BYPASS_KEY
      // skip rate limiting. Single-source load tests would otherwise trip the
      // per-IP limiter long before they reach infrastructure capacity. Key is
      // set via `wrangler secret put LOAD_TEST_BYPASS_KEY`.
      const loadTestAuth = request.headers.get('X-Load-Test-Auth');
      const skipRateLimit = !!env.LOAD_TEST_BYPASS_KEY && loadTestAuth === env.LOAD_TEST_BYPASS_KEY;

      if (!skipRateLimit) {
        // GPU-aware rate limit check
        const rateResult = await checkAudioRateLimit(request, env, language, 'tts');
        if (!rateResult.allowed) {
          // Track rate limit event (fire-and-forget)
          const rlMarketingSource = readMarketingSource(request);
          const rlCountry = readCountry(request);
          ctx.waitUntil(Promise.resolve().then(() => {
            env.ANALYTICS.writeDataPoint({
              blobs: [language === 'German' ? 'de' : 'en', model, '', rateResult.code || 'unknown', 'ratelimit', rlMarketingSource, rlCountry],
              doubles: [0],
              indexes: ['ratelimit'],
            });
          }));
          return buildRateLimitResponse(rateResult, request, env);
        }
      }

      const sessionId = request.headers.get('X-Session-Id');
      const [primary, fallback] = await selectServers(env, sessionId);
      const response = await proxyWithFailoverFromBuffer(bodyBuffer, request, primary, fallback, env, TIMEOUTS.TTS);

      // Anonymous analytics (fire-and-forget, never blocks response)
      const server = response.headers.get('X-Audio-Server') || 'unknown';
      const upstreamModel = response.headers.get('x-model') || model;
      const marketingSource = readMarketingSource(request);
      const country = readCountry(request);
      ctx.waitUntil(Promise.resolve().then(() => {
        env.ANALYTICS.writeDataPoint({
          blobs: [
            language === 'German' ? 'de' : 'en',
            upstreamModel,
            server,
            String(response.status),
            'speech',
            marketingSource,
            country,
          ],
          doubles: [Date.now() - startMs],
          indexes: [language === 'German' ? 'de' : 'en'],
        });
      }));

      return response;
    }

    // Session-end beacon (LT-11) — fire-and-forget eviction of a session cache
    // entry so the gateway can free the Qwen admission slot immediately
    // instead of waiting for 3600s TTL. Client calls this when user clicks
    // "Lieber Text lesen" in the ProcessingLoader. Unauthenticated — worst
    // case is random UUIDs = no-op eviction. Never blocks or errors upstream.
    if (path === '/v1/audio/session/end' && request.method === 'POST') {
      let sessionId: string | null = null;
      try {
        const body = (await request.json()) as { session_id?: string };
        sessionId = typeof body.session_id === 'string' ? body.session_id : null;
      } catch {
        // Malformed JSON → still 204. Beacon is idempotent.
      }

      if (sessionId) {
        // Route to the gateway that actually holds this session's cache entry
        // (UUID-hash determines origin). If the request fails for any reason,
        // we still return 204 — the session simply expires on TTL like before.
        const [primary] = await selectServers(env, sessionId);
        ctx.waitUntil(
          (async () => {
            try {
              const beaconHeaders: Record<string, string> = {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${env.AUDIO_API_KEY}`,
              };
              if (env.ORIGIN_VERIFY_KEY) {
                beaconHeaders['X-Origin-Verify'] = env.ORIGIN_VERIFY_KEY;
              }
              await fetch(`${primary.url}/v1/audio/session/end`, {
                method: 'POST',
                headers: beaconHeaders,
                body: JSON.stringify({ session_id: sessionId }),
                signal: AbortSignal.timeout(3000),
              });
            } catch {
              /* beacon failures silent — TTL handles eviction as fallback */
            }
          })(),
        );
      }

      return new Response(null, {
        status: 204,
        headers: corsHeaders(request, env),
      });
    }

    // STT proxy (rate limiting, no language extraction needed)
    if (path === '/v1/audio/transcriptions' && request.method === 'POST') {
      const startMs = Date.now();

      // Load-test bypass: see TTS endpoint above for rationale.
      const sttLoadTestAuth = request.headers.get('X-Load-Test-Auth');
      const sttSkipRateLimit = !!env.LOAD_TEST_BYPASS_KEY && sttLoadTestAuth === env.LOAD_TEST_BYPASS_KEY;

      if (!sttSkipRateLimit) {
        const rateResult = await checkAudioRateLimit(request, env, 'English', 'stt');
        if (!rateResult.allowed) {
          const sttRlMarketingSource = readMarketingSource(request);
          const sttRlCountry = readCountry(request);
          ctx.waitUntil(Promise.resolve().then(() => {
            env.ANALYTICS.writeDataPoint({
              blobs: ['any', 'whisper', '', rateResult.code || 'unknown', 'ratelimit', sttRlMarketingSource, sttRlCountry],
              doubles: [0],
              indexes: ['ratelimit'],
            });
          }));
          return buildRateLimitResponse(rateResult, request, env);
        }
      }

      const sttSessionId = request.headers.get('X-Session-Id');
      const [primary, fallback] = await selectServers(env, sttSessionId);
      const response = await proxyWithFailover(request, primary, fallback, env, TIMEOUTS.STT);

      // Anonymous analytics (fire-and-forget)
      const server = response.headers.get('X-Audio-Server') || 'unknown';
      const sttMarketingSource = readMarketingSource(request);
      const sttCountry = readCountry(request);
      ctx.waitUntil(Promise.resolve().then(() => {
        env.ANALYTICS.writeDataPoint({
          blobs: ['any', 'whisper', server, String(response.status), 'transcriptions', sttMarketingSource, sttCountry],
          doubles: [Date.now() - startMs],
          indexes: ['stt'],
        });
      }));

      return response;
    }

    // 404 — no wildcard proxying
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(request, env) },
    });
  },
} satisfies ExportedHandler<Env>;
