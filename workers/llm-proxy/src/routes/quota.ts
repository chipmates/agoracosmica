// GET /v1/quota — usage stats for the current user, plus the free-tier state

import { authenticateRequest } from '../middleware/auth';
import { getQuota } from '../middleware/rateLimit';
import { freeTierState } from '../services/modelRouting';
import type { Env } from '../utils/types';

export async function handleQuota(request: Request, env: Env): Promise<Response> {
  // Authenticate
  const authResult = await authenticateRequest(request, env);
  if ('error' in authResult) return authResult.error;

  // Read counters keyed by JWT subject (per-identity), and which model serves
  // them. Both are reads, so asking never moves a counter.
  const [quota, freeTier] = await Promise.all([
    getQuota(request, env, authResult.payload),
    freeTierState(env),
  ]);

  return new Response(JSON.stringify({ ...quota, freeTier }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
