import type { Env } from './types';

const EXPOSE_HEADERS = 'X-Model, X-Inference-Ms, X-Total-Ms, X-Audio-Server, X-RateLimit-Daily, X-RateLimit-GpuLoad, X-TTS-Backend, X-TTS-Session-Expires-In';

function getAllowedOrigins(env: Env): string[] {
  return env.ALLOWED_ORIGINS.split(',').map((o) => o.trim());
}

function getOriginHeader(request: Request, env: Env): string | null {
  const origin = request.headers.get('Origin');
  if (!origin) return null;
  const allowed = getAllowedOrigins(env);
  if (allowed.includes(origin)) return origin;
  // Allow CF Pages preview deployments
  if (origin.endsWith('.pages.dev') && origin.startsWith('https://')) return origin;
  // Allow localhost in dev
  if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) return origin;
  return null;
}

export function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = getOriginHeader(request, env);
  if (!origin) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Expose-Headers': EXPOSE_HEADERS,
    Vary: 'Origin',
  };
}

export function handlePreflight(request: Request, env: Env): Response {
  const origin = getOriginHeader(request, env);
  if (!origin) return new Response(null, { status: 403 });
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Session-Id, X-Marketing-Source',
      'Access-Control-Expose-Headers': EXPOSE_HEADERS,
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    },
  });
}
