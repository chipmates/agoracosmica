// Agora Cosmica — Free-Tier LLM Proxy (WP6)
// Router, CORS, error boundary

import { handleHealth } from './routes/health';
import { handleSession } from './routes/session';
import { handleChat } from './routes/chat';
import { handleCouncil } from './routes/council';
import { handleQuota } from './routes/quota';
import { handleSummary } from './routes/summary';
import { handleConversions, handleConversionStats } from './routes/conversions';
import { handlePlayback } from './routes/playback';
import { handlePage } from './routes/page';
import { handleEntry } from './routes/entry';
import { handleSignup } from './routes/signup';
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

  const isPagesPreview = origin.endsWith('.agoracosmica.pages.dev') && origin.startsWith('https://');
  const isAllowed = allowed.includes(origin) || DEV_ORIGINS.includes(origin) || isPagesPreview;

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : '',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Marketing-Source',
    'Access-Control-Expose-Headers': 'X-Quota-Daily-Used, X-Quota-Daily-Limit, X-Quota-Resets-At, X-Council-Daily-Used, X-Council-Daily-Limit, X-Council-Resets-At, X-Summary-Daily-Used, X-Summary-Daily-Limit, X-Summary-Resets-At, X-AI-Generated, X-AI-Model, X-AI-Provider',
    'Access-Control-Max-Age': '86400',
  };
}

// EU AI Act Art. 50 Abs. 2: machine-readable AI content disclosure
const AI_DISCLOSURE_HEADERS: Record<string, string> = {
  'X-AI-Generated': 'true',
  'X-AI-Model': 'Qwen3-235B-A22B-Instruct',
  'X-AI-Provider': 'ChipMates gGmbH',
};

function withCors(response: Response, corsHeaders: Record<string, string>): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders)) {
    headers.set(key, value);
  }
  for (const [key, value] of Object.entries(AI_DISCLOSURE_HEADERS)) {
    headers.set(key, value);
  }
  headers.set('X-Content-Type-Options', 'nosniff');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const corsHeaders = getCorsHeaders(request, env);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      let response: Response;

      // Route matching
      if (path === '/health' && request.method === 'GET') {
        response = handleHealth();
      } else if (path === '/v1/session' && request.method === 'POST') {
        response = await handleSession(request, env);
      } else if (path === '/v1/chat' && request.method === 'POST') {
        response = await handleChat(request, env, ctx);
      } else if (path === '/v1/council' && request.method === 'POST') {
        response = await handleCouncil(request, env, ctx);
      } else if (path === '/v1/summary' && request.method === 'POST') {
        response = await handleSummary(request, env, ctx);
      } else if (path === '/v1/quota' && request.method === 'GET') {
        response = await handleQuota(request, env);
      } else if (path === '/api/conversions' && request.method === 'POST') {
        response = await handleConversions(request, env, ctx);
      } else if (path === '/api/conversions/stats' && request.method === 'GET') {
        response = await handleConversionStats(request, env);
      } else if (path === '/v1/playback' && request.method === 'POST') {
        response = await handlePlayback(request, env);
      } else if (path === '/v1/page' && request.method === 'POST') {
        response = await handlePage(request, env);
      } else if (path === '/v1/entry' && request.method === 'POST') {
        response = await handleEntry(request, env);
      } else if (path === '/v1/signup' && request.method === 'POST') {
        response = await handleSignup(request, env);
      } else {
        response = new Response(
          JSON.stringify({ error: 'Not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return withCors(response, corsHeaders);
    } catch (error) {
      console.error('[Worker] Unhandled error:', error);
      const errorResponse = new Response(
        JSON.stringify({
          error: 'Internal server error. Please try again.',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
      return withCors(errorResponse, corsHeaders);
    }
  },
};
