// What the free tier is serving right now, as the worker reports it on /v1/quota.
//
// Everything here is an identifier, never a sentence: the worker names the
// model and the region, the UI translates both. That keeps the panel honest
// when the served model changes without a client release.

/** One model the free tier can serve. */
export interface ServedModel {
  key: string;
  label: string;
  region: string;
}

export interface FreeTierState {
  primary: ServedModel;
  /** Null when the primary is also the fallback, so there is nothing to switch to. */
  fallback: ServedModel | null;
  governor: {
    /** True when a daily budget applies at all. */
    armed: boolean;
    /** True when today's budget is spent and the fallback is answering. */
    tripped: boolean;
    /** When the budget resets, ISO. */
    resetsAt: string;
  };
  /** The model that answers a message sent right now. */
  serving: ServedModel;
}

/** The three lines the AI model panel draws from the state. */
export interface FreeTierView {
  /** Answering right now. */
  now: ServedModel;
  /** Takes over when the day's budget runs out, absent once it already has. */
  after: ServedModel | null;
  /** Absent when no budget applies, so the panel shows one model and no budget line. */
  budget: 'within' | 'reached' | null;
}

function readModel(raw: unknown): ServedModel | null {
  if (!raw || typeof raw !== 'object') return null;
  const model = raw as Record<string, unknown>;
  const { key, label, region } = model;
  if (typeof key !== 'string' || typeof label !== 'string' || typeof region !== 'string') return null;
  if (!key || !label || !region) return null;
  return { key, label, region };
}

/**
 * Read the state off a /v1/quota body. Returns null on anything unexpected, so
 * an old worker or a truncated response leaves the panel silent rather than
 * claiming a model that is not serving.
 */
export function parseFreeTierState(raw: unknown): FreeTierState | null {
  if (!raw || typeof raw !== 'object') return null;
  const state = raw as Record<string, unknown>;

  const primary = readModel(state.primary);
  const serving = readModel(state.serving);
  if (!primary || !serving) return null;

  const governor = state.governor as Record<string, unknown> | undefined;
  if (!governor || typeof governor !== 'object') return null;

  return {
    primary,
    fallback: readModel(state.fallback),
    governor: {
      armed: governor.armed === true,
      tripped: governor.tripped === true,
      resetsAt: typeof governor.resetsAt === 'string' ? governor.resetsAt : '',
    },
    serving,
  };
}

/**
 * Turn the state into what the panel renders. Unarmed there is one model and
 * no budget at all; armed the panel names the successor until the day's budget
 * is spent, and after that the state line carries the story.
 */
export function describeFreeTier(state: FreeTierState): FreeTierView {
  const { armed, tripped } = state.governor;
  const spent = armed && tripped;

  return {
    now: state.serving,
    after: armed && !spent ? state.fallback : null,
    budget: armed ? (spent ? 'reached' : 'within') : null,
  };
}
