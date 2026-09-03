// Which model serves a free-tier request, and which response rules ride with it.
//
// Arming the switch is a deployment variable, not a code change: FREE_TIER_MODEL
// selects the primary model, and everything else here follows from it. Unset,
// the worker serves exactly what it served before this file existed.

import { SERVING_MODELS, type ServingModel } from '../config';
import type { PromptProfile } from '../prompts/responseRules';
import { readSpend, isOverHardCap } from './spendGovernor';
import type { Env } from '../utils/types';

/** The only value that arms the switch. Anything else keeps the fallback model. */
const ARMED = 'deepseek';

export function isSwitchArmed(env: Env): boolean {
  return env.FREE_TIER_MODEL === ARMED;
}

/**
 * The model the free tier asks first. Ids come from the environment when set,
 * so a snapshot can be pinned without a rebuild.
 */
export function primaryModel(env: Env): ServingModel {
  if (!isSwitchArmed(env)) return fallbackModel(env);
  const model = SERVING_MODELS['dsv4-pro'];
  return env.NEBIUS_MODEL_PRO ? { ...model, id: env.NEBIUS_MODEL_PRO } : model;
}

/** The model that answers when the primary cannot: governor, error, or stall. */
export function fallbackModel(env: Env): ServingModel {
  const model = SERVING_MODELS['qwen3-235b'];
  return env.NEBIUS_MODEL ? { ...model, id: env.NEBIUS_MODEL } : model;
}

/**
 * Both models serve the same rules, so a fallback is yesterday's model, never
 * yesterday's behavior. Only an unarmed worker serves the bundled block.
 */
export function promptProfileFor(env: Env): PromptProfile {
  return isSwitchArmed(env) ? 'listen-cap' : 'shipped';
}

export interface Serving {
  /** The model this request goes to. */
  model: ServingModel;
  /** The model to retry on, absent when it would be the same model. */
  fallback?: ServingModel;
  profile: PromptProfile;
  /** True when the day's spend cap sent this request to the fallback. */
  governorTripped: boolean;
  /** Day-to-date metered spend in USD at decision time. */
  spendUsd: number;
}

/**
 * Resolve the serving plan for one request. Reads the spend counter only when a
 * metered model is armed, so the unarmed path does no extra work.
 */
export async function resolveServing(env: Env): Promise<Serving> {
  const primary = primaryModel(env);
  const fallback = fallbackModel(env);
  const profile = promptProfileFor(env);

  if (!primary.metered) {
    return { model: primary, profile, governorTripped: false, spendUsd: 0 };
  }

  const spend = await readSpend(env);
  if (isOverHardCap(env, spend.usd)) {
    return { model: fallback, profile, governorTripped: true, spendUsd: spend.usd };
  }

  return {
    model: primary,
    fallback: fallback.id === primary.id ? undefined : fallback,
    profile,
    governorTripped: false,
    spendUsd: spend.usd,
  };
}
