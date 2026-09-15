// The provider's own region metadata for each free-tier model, read from the
// model's regional host. The request-time gate and the daily probe both use it:
// a host is a routing layer, the published region is the evidence.

import { REGION_GATE, regionalBaseUrl, type ServingModel } from '../config';
import { fallbackModel, primaryModel } from './modelRouting';
import { alertRegionDrift } from './telegram';
import type { Env } from '../utils/types';

export interface RegionCheck {
  model: ServingModel;
  /** True when the host lists the model at all. */
  listed: boolean;
  /** Region names the host attaches to the model, unreadable ones rendered as-is. */
  regions: string[];
  /** True when the host lists the model with exactly its disclosed region. */
  ok: boolean;
  /** Set when the host could not be read, so nothing could be verified. */
  error?: string;
}

interface VerboseModel {
  id?: unknown;
  regions?: unknown;
}

/** One read of the model's regional host. Never throws. */
export async function readRegion(model: ServingModel, env: Env): Promise<RegionCheck> {
  try {
    const response = await fetch(`${regionalBaseUrl(model.region)}/models?verbose=true`, {
      headers: { Authorization: `Bearer ${env.NEBIUS_API_KEY}` },
    });
    if (!response.ok) {
      return { model, listed: false, regions: [], ok: false, error: `HTTP ${response.status}` };
    }
    const body = await response.json() as { data?: VerboseModel[] };
    const entry = (body.data ?? []).find(m => m.id === model.id);
    const raw = Array.isArray(entry?.regions) ? entry.regions as { name?: unknown }[] : [];
    const names = raw.map(r => (r && typeof r === 'object' ? r.name : r));
    // An entry the code cannot read counts as a region that is not ours.
    const ok = !!entry && names.length > 0 && names.every(name => name === model.region);
    const regions = names.map(name => (typeof name === 'string' ? name : JSON.stringify(name) ?? 'unknown'));
    return { model, listed: !!entry, regions, ok };
  } catch (err) {
    return { model, listed: false, regions: [], ok: false, error: (err as Error).message };
  }
}

export async function checkServingRegions(env: Env): Promise<RegionCheck[]> {
  const primary = primaryModel(env);
  const fallback = fallbackModel(env);
  const models = primary.id === fallback.id ? [primary] : [primary, fallback];
  return Promise.all(models.map(model => readRegion(model, env)));
}

/** The daily probe: read both hosts and message the operator about every model not where it should be. */
export async function runRegionProbe(env: Env): Promise<RegionCheck[]> {
  const checks = await checkServingRegions(env);
  for (const check of checks) {
    if (!check.ok) await alertRegionDrift(env, check);
  }
  return checks;
}

interface StoredVerdict {
  id: string;
  ok: boolean;
  checkedAt: number;
}

const VERDICT_PREFIX = 'region:';

function parseVerdict(raw: string | null): StoredVerdict | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredVerdict>;
    if (typeof parsed.id !== 'string' || typeof parsed.ok !== 'boolean' || typeof parsed.checkedAt !== 'number') return null;
    return { id: parsed.id, ok: parsed.ok, checkedAt: parsed.checkedAt };
  } catch {
    return null;
  }
}

/**
 * Whether a request may go to this model now. The published region is re-read
 * once an hour. When the host cannot be read, the last verdict stands for the
 * rest of its day in KV, after which the model counts as unverified. Never throws.
 */
export async function regionVerified(model: ServingModel, env: Env, now: number = Date.now()): Promise<boolean> {
  const key = VERDICT_PREFIX + model.key;
  let stored: StoredVerdict | null = null;
  try {
    stored = parseVerdict(await env.RATE_LIMITS.get(key));
  } catch {
    stored = null;
  }
  if (stored && stored.id !== model.id) stored = null;
  if (stored && now - stored.checkedAt < REGION_GATE.REFRESH_MS) return stored.ok;

  const check = await readRegion(model, env);
  if (check.error) {
    if (stored) return stored.ok;
    await alertRegionDrift(env, check);
    return false;
  }
  try {
    await env.RATE_LIMITS.put(
      key,
      JSON.stringify({ id: model.id, ok: check.ok, checkedAt: now } satisfies StoredVerdict),
      { expirationTtl: REGION_GATE.GRACE_SECONDS },
    );
  } catch {
    // The next request reads again.
  }
  if (!check.ok) await alertRegionDrift(env, check);
  return check.ok;
}
