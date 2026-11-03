import { handlePreflight, corsHeaders } from './cors';
import { handleStoryArchive } from './storyArchive';
import type { Env } from './types';

const STORY_ARCHIVE_PREFIX = '/v1/audio/story-archive/';

/**
 * The live voice routes, by the name the audio dataset counts them under. The
 * speech server is retired: each answers 410 with no upstream call, so a
 * stale client gets a clean refusal instead of a timeout.
 */
const GONE_ROUTES = new Map<string, string>([
  ['/v1/audio/speech', 'speech'],
  ['/v1/audio/transcriptions', 'transcriptions'],
  ['/v1/audio/session/end', 'session-end'],
]);

function readCountry(request: Request): string {
  const country = (request as Request & { cf?: { country?: string } }).cf?.country;
  if (typeof country === 'string' && country.length === 2) return country;
  return 'XX';
}

function json(body: unknown, status: number, request: Request, env: Env): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(request, env) },
  });
}

const router = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return handlePreflight(request, env);
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // --- Routes ---

    // Worker health (static)
    if (path === '/health' && request.method === 'GET') {
      return json({ status: 'ok', worker: 'agora-cosmica-audio' }, 200, request, env);
    }

    // No speech server is left to probe, so this says so without asking anyone.
    if (path === '/v1/audio/health' && request.method === 'GET') {
      return json({ status: 'retired', servers: {} }, 200, request, env);
    }

    // Story archive — streams one figure + language as a ZIP straight from R2.
    // HEAD serves the same headers for the client's availability + size probe.
    if (
      path.startsWith(STORY_ARCHIVE_PREFIX) &&
      (request.method === 'GET' || request.method === 'HEAD')
    ) {
      return handleStoryArchive(
        request,
        env,
        ctx,
        path.slice(STORY_ARCHIVE_PREFIX.length),
        readCountry(request),
      );
    }

    // The body is never read: the answer does not depend on it.
    const gone = GONE_ROUTES.get(path);
    if (gone && request.method === 'POST') {
      const country = readCountry(request);
      ctx.waitUntil(Promise.resolve().then(() => {
        env.ANALYTICS.writeDataPoint({
          blobs: ['any', '', '', '410', gone, '', country],
          doubles: [0],
          indexes: ['gone'],
        });
      }));
      return json({ error: 'gone' }, 410, request, env);
    }

    // 404 — no wildcard proxying
    return json({ error: 'Not found' }, 404, request, env);
  },
};

const LOGGED_ROUTES = ['/health', '/v1/audio/health', '/v1/audio/speech', '/v1/audio/session/end', '/v1/audio/transcriptions'];

/** A fixed route name for the log line: the archive path carries visitor text. */
function routeLabel(request: Request): string {
  const path = new URL(request.url).pathname;
  if (path.startsWith(STORY_ARCHIVE_PREFIX)) return STORY_ARCHIVE_PREFIX;
  return LOGGED_ROUTES.includes(path) ? path : 'other';
}

/**
 * The answer to a fault inside the worker. Without it the runtime answers
 * without CORS, so the client sees a network error instead of a 500. The log
 * names the error's kind only: a message can quote a body, a key or an address.
 */
function unhandled(request: Request, env: Env, err: unknown): Response {
  const kind = err instanceof Error ? err.name : typeof err;
  console.error(`[audio] Unhandled ${kind} on ${routeLabel(request)}`);
  let cors: Record<string, string> = {};
  try {
    cors = corsHeaders(request, env);
  } catch {
    // A broken origin list must not turn the 500 into a throw.
  }
  return new Response(JSON.stringify({ error: 'Internal server error' }), {
    status: 500,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      return await router.fetch(request, env, ctx);
    } catch (err) {
      return unhandled(request, env, err);
    }
  },
} satisfies ExportedHandler<Env>;
