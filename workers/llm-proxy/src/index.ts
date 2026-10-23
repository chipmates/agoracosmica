// Agora Cosmica — Free-Tier LLM Proxy (WP6)
// CORS, error boundary; the routes and their session check are in router.ts

import { dispatch } from './router';
import { primaryModel } from './services/modelRouting';
import { runRegionProbe } from './services/regionProbe';
import type { Env } from './utils/types';

function getCorsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('Origin') || '';
  const allowed = env.ALLOWED_ORIGINS.split(',').map(o => o.trim());

  const DEV_ORIGINS = [
    'http://localhost:5173',
    'http://localhost:4173',
    'http://localhost:8787',
    'http://127.0.0.1:5173',
  ];

  // Our Pages project is agora-cosmica; the unhyphenated name is not ours to trust.
  const isPagesPreview = origin.endsWith('.agora-cosmica.pages.dev') && origin.startsWith('https://');
  const isAllowed = allowed.includes(origin) || DEV_ORIGINS.includes(origin) || isPagesPreview;

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : '',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Marketing-Source',
    'Access-Control-Expose-Headers': 'X-Quota-Daily-Used, X-Quota-Daily-Limit, X-Quota-Resets-At, X-Council-Daily-Used, X-Council-Daily-Limit, X-Council-Resets-At, X-Summary-Daily-Used, X-Summary-Daily-Limit, X-Summary-Resets-At, X-AI-Generated, X-AI-Model, X-AI-Provider, X-Model, X-Crisis-Resources, X-Distress',
    'Access-Control-Max-Age': '86400',
  };
}

// EU AI Act Art. 50 Abs. 2: machine-readable AI content disclosure. The model
// name follows the free tier's primary model; a generating route that served
// something else (fallback) sets its own X-AI-Model and keeps it.
function aiDisclosureHeaders(env: Env): Record<string, string> {
  return {
    'X-AI-Generated': 'true',
    'X-AI-Model': primaryModel(env).disclosureLabel,
    'X-AI-Provider': 'ChipMates gGmbH',
  };
}

function withCors(response: Response, corsHeaders: Record<string, string>, env: Env): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders)) {
    headers.set(key, value);
  }
  for (const [key, value] of Object.entries(aiDisclosureHeaders(env))) {
    if (!headers.has(key)) headers.set(key, value);
  }
  headers.set('X-Content-Type-Options', 'nosniff');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  // The cron in wrangler.toml: the daily region probe.
  async scheduled(_controller: ScheduledController, env: Env, _ctx: ExecutionContext): Promise<void> {
    await runRegionProbe(env);
  },

  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const corsHeaders = getCorsHeaders(request, env);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      const response = await dispatch(request, env, ctx);
      return withCors(response, corsHeaders, env);
    } catch (error) {
      // Name and route only: an error message can carry request content.
      const name = error instanceof Error ? error.name : typeof error;
      console.error(`[Worker] Unhandled ${name} on ${request.method} ${path}`);
      const errorResponse = new Response(
        JSON.stringify({
          error: 'Internal server error. Please try again.',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
      return withCors(errorResponse, corsHeaders, env);
    }
  },
};
