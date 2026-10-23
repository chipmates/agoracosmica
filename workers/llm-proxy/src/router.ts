// The route table and its dispatch. The router answers these pairs and nothing
// else, and it checks the session token itself before any route not marked
// public, so a handler that forgets its own check is still closed.

import { handleHealth } from './routes/health';
import { handleSession } from './routes/session';
import { handleChat } from './routes/chat';
import { handleCouncil } from './routes/council';
import { handleQuota } from './routes/quota';
import { handleSummary } from './routes/summary';
import { handleConversions } from './routes/conversions';
import { handlePlayback } from './routes/playback';
import { handlePage } from './routes/page';
import { handleEntry } from './routes/entry';
import { handleSignup } from './routes/signup';
import { handleFunnel } from './routes/funnel';
import { authenticateRequest } from './middleware/auth';
import type { Env } from './utils/types';

export interface Route {
  method: 'GET' | 'POST';
  path: string;
  /** Answers without a session token. Unset, a call without a valid token gets the 401 before the handler runs. */
  public?: true;
  handle(request: Request, env: Env, ctx: ExecutionContext): Response | Promise<Response>;
}

// test/routeAccess.ts names the reason for every public entry.
export const ROUTES: readonly Route[] = [
  { method: 'GET', path: '/health', public: true, handle: handleHealth },
  { method: 'POST', path: '/v1/session', public: true, handle: handleSession },
  { method: 'POST', path: '/v1/chat', handle: handleChat },
  { method: 'POST', path: '/v1/council', handle: handleCouncil },
  { method: 'POST', path: '/v1/summary', handle: handleSummary },
  { method: 'GET', path: '/v1/quota', handle: handleQuota },
  { method: 'POST', path: '/api/conversions', public: true, handle: handleConversions },
  { method: 'POST', path: '/v1/playback', public: true, handle: handlePlayback },
  { method: 'POST', path: '/v1/page', public: true, handle: handlePage },
  { method: 'POST', path: '/v1/entry', public: true, handle: handleEntry },
  { method: 'POST', path: '/v1/signup', public: true, handle: handleSignup },
  { method: 'POST', path: '/v1/funnel', public: true, handle: handleFunnel },
];

export async function dispatch(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  routes: readonly Route[] = ROUTES,
): Promise<Response> {
  const path = new URL(request.url).pathname;
  const route = routes.find(r => r.path === path && r.method === request.method);
  if (!route) {
    return new Response(
      JSON.stringify({ error: 'Not found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }
  if (!route.public) {
    const auth = await authenticateRequest(request, env);
    if ('error' in auth) return auth.error;
  }
  return route.handle(request, env, ctx);
}
