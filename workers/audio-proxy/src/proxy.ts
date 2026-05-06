import { PASSTHROUGH_HEADERS } from './config';
import { corsHeaders } from './cors';
import type { Env, ServerInfo } from './types';

/**
 * Forward a request to the primary server. On failure, retry with the fallback.
 * Returns the upstream response with CORS + X-Audio-Server headers.
 */
export async function proxyWithFailover(
  request: Request,
  primary: ServerInfo,
  fallback: ServerInfo,
  env: Env,
  timeoutMs: number
): Promise<Response> {
  // Buffer body once — reusable for both attempts and immune to redirects
  const body = await request.arrayBuffer();
  return proxyWithFailoverFromBuffer(body, request, primary, fallback, env, timeoutMs);
}

/**
 * Same as proxyWithFailover but accepts a pre-buffered body.
 * Used when the body was already read for language extraction (TTS rate limiting).
 */
export async function proxyWithFailoverFromBuffer(
  body: ArrayBuffer,
  request: Request,
  primary: ServerInfo,
  fallback: ServerInfo,
  env: Env,
  timeoutMs: number
): Promise<Response> {
  const primaryResult = await tryUpstream(request, body, primary, env, timeoutMs);
  if (primaryResult) return primaryResult;

  const fallbackResult = await tryUpstream(request, body, fallback, env, timeoutMs);
  if (fallbackResult) return fallbackResult;

  // Both failed
  return new Response(JSON.stringify({ error: 'Both audio servers unavailable' }), {
    status: 502,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(request, env) },
  });
}

async function tryUpstream(
  request: Request,
  body: ArrayBuffer,
  server: ServerInfo,
  env: Env,
  timeoutMs: number
): Promise<Response | null> {
  try {
    const url = new URL(request.url);
    const upstreamUrl = `${server.url}${url.pathname}`;

    // Build clean headers — only forward what upstream needs
    const headers = new Headers();
    headers.set('Authorization', `Bearer ${env.AUDIO_API_KEY}`);
    if (env.ORIGIN_VERIFY_KEY) {
      headers.set('X-Origin-Verify', env.ORIGIN_VERIFY_KEY);
    }
    const ALLOWED_REQUEST_HEADERS = ['content-type', 'accept', 'x-session-id'];
    for (const name of ALLOWED_REQUEST_HEADERS) {
      const value = request.headers.get(name);
      if (value) headers.set(name, value);
    }

    const upstreamResponse = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      body,
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (upstreamResponse.status >= 500) return null;

    // Stream the response back — never buffer
    const responseHeaders = new Headers(corsHeaders(request, env));
    for (const name of PASSTHROUGH_HEADERS) {
      const value = upstreamResponse.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    responseHeaders.set('X-Audio-Server', server.id);

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers: responseHeaders,
    });
  } catch (err) {
    console.error(`[proxy] ${server.id} failed:`, err instanceof Error ? err.message : String(err));
    return null;
  }
}
