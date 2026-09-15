// Operator alerts for the free-tier switch, over the Telegram Bot API.
//
// Notification channel, not a log: Analytics Engine already holds every
// governor row, this only pushes the four that want a human the same minute.
// Every call is fire-and-forget from ctx.waitUntil, nothing here is awaited in
// front of a response, and a failed send is dropped rather than raised.
//
// Silent without TELEGRAM_BOT_TOKEN (a secret) or TELEGRAM_CHAT_ID (a var), so
// a deployment that sets neither behaves exactly as it did before this file.

import { SERVING_MODELS, SPEND_GOVERNOR, TELEGRAM_ALERTS, type ServingModel } from '../config';
import type { SpendCrossing } from './spendGovernor';
import type { RegionCheck } from './regionProbe';
import type { Env } from '../utils/types';

const KEY_PREFIX = 'tg:';

export type FallbackEvent = 'fallback_error' | 'fallback_latency' | 'fallback_region';

export interface FallbackAlert {
  event: FallbackEvent;
  /** The model that ended up answering. */
  served: ServingModel;
  /** Day-to-date metered spend in USD at the moment of the decision. */
  spendUsd: number;
  /** The model that was asked first, for the region in the message. */
  asked?: ServingModel;
  /** Upstream HTTP status of the failed attempt, 0 for a network error. A 404
   * from a regional host means the model left the region we disclose. */
  upstreamStatus?: number;
}

/**
 * Message the day's threshold crossings. Both are written once per day by the
 * governor, and the day-keyed claim below holds that even if two responses
 * cross the same line at once.
 */
export async function alertSpendCrossing(
  env: Env,
  crossing: SpendCrossing,
  takeover: ServingModel = SERVING_MODELS['qwen3-235b'],
): Promise<void> {
  if (crossing.crossedSoft) {
    await send(
      env,
      `soft_alert:${crossing.dayKey}`,
      SPEND_GOVERNOR.COUNTER_TTL_SECONDS,
      `Free tier: soft alert at ${usd(crossing.spendUsd)} USD day to date, ${crossing.model.displayName} still answering`,
    );
  }
  if (crossing.crossedHard) {
    await send(
      env,
      `hard_trip:${crossing.dayKey}`,
      SPEND_GOVERNOR.COUNTER_TTL_SECONDS,
      `Free tier: daily budget reached at ${usd(crossing.spendUsd)} USD, ${takeover.displayName} answers until midnight`,
    );
  }
}

/**
 * Message an availability fallback. These fire per request, so one message per
 * event type per window is all the chat ever sees of a provider wobble.
 */
export async function alertFallback(env: Env, alert: FallbackAlert): Promise<void> {
  const where = alert.asked ? ` in ${alert.asked.region}` : '';
  const what = alert.event === 'fallback_latency'
    ? `primary model stalled${where}`
    : alert.event === 'fallback_region'
      ? `primary model not verified${where}`
      : `primary model failed${where}${statusNote(alert.upstreamStatus)}`;
  await send(
    env,
    alert.event,
    TELEGRAM_ALERTS.FALLBACK_WINDOW_SECONDS,
    `Free tier: ${what}, ${alert.served.displayName} answering, ${usd(alert.spendUsd)} USD day to date`,
  );
}

/**
 * Message a model whose regional host no longer publishes it in the disclosed
 * region, or a host that could not be read. Sent by the gate and the daily probe.
 */
export async function alertRegionDrift(env: Env, check: RegionCheck): Promise<void> {
  const { model } = check;
  const seen = check.error
    ? `the ${model.region} host could not be read (${check.error})`
    : !check.listed
      ? `the ${model.region} host no longer lists it`
      : check.regions.length === 0
        ? `the ${model.region} host lists it without a region`
        : `the ${model.region} host reports ${check.regions.slice(0, 5).join(', ')}`;
  await send(
    env,
    `region_drift:${model.key}`,
    TELEGRAM_ALERTS.DRIFT_WINDOW_SECONDS,
    `Free tier: ${model.displayName} is not verified in ${model.region}, ${seen}`,
  );
}

export interface OutageAlert {
  /** The last model tried. */
  asked: ServingModel;
  /** Upstream HTTP status of that attempt, 0 for none. */
  upstreamStatus?: number;
}

/** Message a request that no model answered. One line per window, its own window. */
export async function alertOutage(env: Env, alert: OutageAlert): Promise<void> {
  await send(
    env,
    'outage',
    TELEGRAM_ALERTS.FALLBACK_WINDOW_SECONDS,
    `Free tier: no model answered, ${alert.asked.displayName} failed in ${alert.asked.region}${statusNote(alert.upstreamStatus)}`,
  );
}

function statusNote(status: number | undefined): string {
  if (status === undefined) return '';
  return status === 0 ? ' (no response)' : ` (HTTP ${status})`;
}

function usd(amount: number): string {
  return amount.toFixed(2);
}

/**
 * Claim the flood-control slot, then post. KV has no compare-and-swap, so two
 * simultaneous crossings can both claim and both send. One duplicate message is
 * the failure mode, which is the right way round for an alert.
 */
async function send(env: Env, floodKey: string, ttlSeconds: number, text: string): Promise<void> {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  try {
    const key = KEY_PREFIX + floodKey;
    if (await env.RATE_LIMITS.get(key)) return;
    await env.RATE_LIMITS.put(key, '1', { expirationTtl: ttlSeconds });

    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    });
  } catch {
    // An alert that cannot be delivered is dropped, never raised into a request.
  }
}
