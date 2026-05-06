// Rate limiting for audio proxy
//
// Anti-abuse only. No GPU-tier blocking.
// Server-side BBA scheduler handles GPU capacity (model switching: Qwen3 → F5 → Kokoro).
// Failover handles server unavailability.
//
// Always-on safety nets:
// - 60/min burst per IP (catches bots, never hit by real users)
// - 500/day per IP (prevents sustained abuse)
//
// Real traffic patterns considered:
// - Normal conversation (200 words): 3-5 TTS chunks fired within seconds
// - Custom council: 7-segment rolling buffer, initial burst of 7 TTS requests
// - Peak legitimate usage: ~15-20 TTS/min during council + conversation overlap

import { RATE_LIMIT_CONFIG } from './config';
import { corsHeaders } from './cors';
import type { Env, AudioRateLimitResult } from './types';

// --- Helpers ---

function getDateKey(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function getMinuteKey(): string {
  return String(Math.floor(Date.now() / 60_000));
}

function getDailyResetTime(): string {
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  return tomorrow.toISOString();
}

async function hashIP(ip: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode('audio-ratelimit:' + ip);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(hash);
  return Array.from(bytes.slice(0, 8))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function getCounter(kv: KVNamespace, key: string): Promise<number> {
  const val = await kv.get(key);
  return val ? parseInt(val, 10) || 0 : 0;
}

async function incrementCounter(kv: KVNamespace, key: string, current: number, ttl: number): Promise<void> {
  await kv.put(key, String(current + 1), { expirationTtl: ttl });
}

// --- Main Rate Limit Check ---

export async function checkAudioRateLimit(
  request: Request,
  env: Env,
  _language: string,
  _endpoint: 'tts' | 'stt'
): Promise<AudioRateLimitResult> {
  const ip = request.headers.get('CF-Connecting-IP') || '127.0.0.1';
  const hash = await hashIP(ip);
  const dateKey = getDateKey();
  const minuteKey = getMinuteKey();
  const resetsAt = getDailyResetTime();

  // KV keys
  const dailyKey = `audio:ip:${hash}:${dateKey}`;
  const burstKey = `audio:burst:${hash}:${minuteKey}`;

  // Read counters in parallel
  const [dailyCount, burstCount] = await Promise.all([
    getCounter(env.RATE_LIMITS, dailyKey),
    getCounter(env.RATE_LIMITS, burstKey),
  ]);

  const result: AudioRateLimitResult = {
    allowed: true,
    daily: { used: dailyCount, limit: RATE_LIMIT_CONFIG.DAILY_PER_IP },
    gpuLoad: 'green',
    resetsAt,
  };

  // 1. Hard daily per-IP cap
  if (dailyCount >= RATE_LIMIT_CONFIG.DAILY_PER_IP) {
    return {
      ...result,
      allowed: false,
      code: 'daily_limit',
      hint: 'rate_limited',
      message: 'Daily audio limit reached. Resets at midnight UTC.',
    };
  }

  // 2. Burst limit (catches bots, never hit by real users)
  if (burstCount >= RATE_LIMIT_CONFIG.BURST_PER_MINUTE) {
    return {
      ...result,
      allowed: false,
      code: 'burst_limit',
      hint: 'rate_limited',
      message: 'Too many audio requests. Please slow down.',
    };
  }

  // GPU capacity is handled server-side by BBA scheduler + failover.
  // No blocking here.

  // --- Allowed: increment counters ---
  await Promise.all([
    incrementCounter(env.RATE_LIMITS, dailyKey, dailyCount, 86_400),
    incrementCounter(env.RATE_LIMITS, burstKey, burstCount, 120),
  ]);

  result.daily.used = dailyCount + 1;
  return result;
}

// --- 429 Response Builder ---

export function buildRateLimitResponse(
  result: AudioRateLimitResult,
  request: Request,
  env: Env
): Response {
  const body = {
    error: result.message,
    code: result.code,
    hint: result.hint,
    quota: {
      daily: result.daily,
      resetsAt: result.resetsAt,
    },
  };

  const isBurst = result.code === 'burst_limit';
  const retryAfter = isBurst ? '60' : String(Math.ceil((new Date(result.resetsAt).getTime() - Date.now()) / 1000));

  return new Response(JSON.stringify(body), {
    status: 429,
    headers: {
      'Content-Type': 'application/json',
      'Retry-After': retryAfter,
      ...corsHeaders(request, env),
    },
  });
}
