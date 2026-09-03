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
import type { Env } from '../utils/types';

const KEY_PREFIX = 'tg:';

export type FallbackEvent = 'fallback_error' | 'fallback_latency';

export interface FallbackAlert {
  event: FallbackEvent;
  /** The model that ended up answering. */
  served: ServingModel;
  /** Day-to-date metered spend in USD at the moment of the decision. */
  spendUsd: number;
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
  const what = alert.event === 'fallback_latency' ? 'primary model stalled' : 'primary model failed';
  await send(
    env,
    alert.event,
    TELEGRAM_ALERTS.FALLBACK_WINDOW_SECONDS,
    `Free tier: ${what}, ${alert.served.displayName} answering, ${usd(alert.spendUsd)} USD day to date`,
  );
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
