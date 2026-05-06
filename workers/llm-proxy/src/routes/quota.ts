// GET /v1/quota — usage stats for the current user

import { authenticateRequest } from '../middleware/auth';
import { getQuota } from '../middleware/rateLimit';
import type { Env } from '../utils/types';

export async function handleQuota(request: Request, env: Env): Promise<Response> {
  // Authenticate
  const authResult = await authenticateRequest(request, env);
  if ('error' in authResult) return authResult.error;

  // Read counters keyed by JWT subject (per-identity)
  const quota = await getQuota(request, env, authResult.payload);

  return new Response(JSON.stringify(quota), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
