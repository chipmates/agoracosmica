// Daily spend counter for the metered free-tier model.
//
// Counts real token usage reported by the provider, priced at list price, in a
// KV counter that rolls over at midnight in the operating timezone. Over the
// hard cap the worker serves the unmetered fallback for the rest of the day.
//
// Same consistency caveat as the rate limiters: KV has no compare-and-swap, so
// concurrent writers can undercount by one request's worth. At a cap sized far
// above real volume that is noise, and the counter only ever undercounts.

import {
  SPEND_GOVERNOR,
  governorHardCapUsd,
  governorSoftAlertUsd,
  type ServingModel,
} from '../config';
import { trackGovernor } from '../utils/analytics';
import type { Env } from '../utils/types';

const COUNTER_PREFIX = 'spend:free-tier:';

/** Stored shape. Micro-USD integers, so repeated addition never drifts. */
interface StoredSpend {
  u: number;
  /** 1 once the soft alert has been emitted for this day. */
  s: number;
  /** 1 once the hard trip has been emitted for this day. */
  h: number;
}

export interface SpendState {
  usd: number;
  softAlerted: boolean;
  hardAlerted: boolean;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
}

export interface SpendContext {
  endpoint: string;
  country: string;
  device: string;
}

/**
 * The counter's day, in the operating timezone rather than UTC, so a reset
 * lands at local midnight and daylight saving is handled for us.
 */
export function spendDayKey(now: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: SPEND_GOVERNOR.TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
  } catch {
    // A runtime without timezone data still needs a stable daily key.
    return now.toISOString().slice(0, 10);
  }
}

export function isOverHardCap(env: Env, usd: number): boolean {
  return usd >= governorHardCapUsd(env);
}

export function usageCostUsd(model: ServingModel, usage: TokenUsage): number {
  return (
    (usage.promptTokens / 1_000_000) * model.pricePer1M.input +
    (usage.completionTokens / 1_000_000) * model.pricePer1M.output
  );
}

export async function readSpend(env: Env, now: Date = new Date()): Promise<SpendState> {
  const raw = await env.RATE_LIMITS.get(COUNTER_PREFIX + spendDayKey(now));
  const stored = parseStored(raw);
  return { usd: stored.u / 1_000_000, softAlerted: stored.s === 1, hardAlerted: stored.h === 1 };
}

/**
 * Add one response's cost to the day and emit a stats row the first time the
 * day crosses either threshold. Call from ctx.waitUntil: it must not sit in
 * front of the stream.
 */
export async function recordSpend(
  env: Env,
  model: ServingModel,
  usage: TokenUsage,
  context: SpendContext,
  now: Date = new Date(),
): Promise<void> {
  if (!model.metered) return;
  const microUsd = Math.round(usageCostUsd(model, usage) * 1_000_000);
  if (microUsd <= 0) return;

  const key = COUNTER_PREFIX + spendDayKey(now);
  const stored = parseStored(await env.RATE_LIMITS.get(key));
  const total = stored.u + microUsd;
  const totalUsd = total / 1_000_000;

  const crossedSoft = stored.s === 0 && totalUsd >= governorSoftAlertUsd(env);
  const crossedHard = stored.h === 0 && totalUsd >= governorHardCapUsd(env);

  await env.RATE_LIMITS.put(
    key,
    JSON.stringify({
      u: total,
      s: stored.s === 1 || crossedSoft ? 1 : 0,
      h: stored.h === 1 || crossedHard ? 1 : 0,
    } satisfies StoredSpend),
    { expirationTtl: SPEND_GOVERNOR.COUNTER_TTL_SECONDS },
  );

  if (crossedSoft) {
    trackGovernor(env, { event: 'soft_alert', model: model.key, spendUsd: totalUsd, ...context });
  }
  if (crossedHard) {
    trackGovernor(env, { event: 'hard_trip', model: model.key, spendUsd: totalUsd, ...context });
  }
}

function parseStored(raw: string | null): StoredSpend {
  if (!raw) return { u: 0, s: 0, h: 0 };
  try {
    const parsed = JSON.parse(raw) as Partial<StoredSpend>;
    return {
      u: typeof parsed.u === 'number' && parsed.u >= 0 ? parsed.u : 0,
      s: parsed.s === 1 ? 1 : 0,
      h: parsed.h === 1 ? 1 : 0,
    };
  } catch {
    return { u: 0, s: 0, h: 0 };
  }
}
