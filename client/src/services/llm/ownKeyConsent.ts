// The gate between a stored own key and the free tier.
//
// With a stored OpenRouter key the conversation goes from the browser straight
// to OpenRouter, and the privacy page says it never passes our servers. The
// free tier does pass them, so after a rejected key nothing may go there until
// the visitor says yes, and a yes covers one conversation while that key stays.

import { keyStorage } from '../storage/keyStorageService';

/** Which daily allowance the free tier would answer from. */
export type FreeTierKind = 'chat' | 'council' | 'summary';

export type OwnKeyChoice = 'yes' | 'check-key' | 'dismissed';

/**
 * The stored key was rejected and nothing went to the free tier. `choice` is
 * null when the caller asked not to fall back (it routes its own free tier),
 * otherwise the visitor's no.
 */
export class OwnKeyRejectedError extends Error {
  constructor(
    public readonly choice: Exclude<OwnKeyChoice, 'yes'> | null,
    public readonly status?: number,
  ) {
    super(choice ? 'Own key rejected, the free tier was declined' : 'Own key rejected');
    this.name = 'OwnKeyRejectedError';
  }
}

/** Why OpenRouter refused one request while the key itself stands. */
export type OwnKeyRefusalReason = 'budget' | 'moderation' | 'guardrail' | 'forbidden';

/**
 * OpenRouter answered an own-key request with 403: a spending limit, a
 * moderation flag, a guardrail or a missing permission. Only a 401 rejects the
 * key, so this one keeps it, and the free tier is never offered for it.
 */
export class OwnKeyRefusedError extends Error {
  constructor(
    public readonly reason: OwnKeyRefusalReason,
    /** When the spending limit resets, as OpenRouter gave it (ISO 8601). */
    public readonly resetsAt: string | null = null,
  ) {
    super(`OpenRouter refused the request (${reason})`);
    this.name = 'OwnKeyRefusedError';
  }
}

/** Either outcome of an own key that did not answer: rejected, or refused once. */
export type OwnKeyError = OwnKeyRejectedError | OwnKeyRefusedError;

export function isOwnKeyError(error: unknown): error is OwnKeyError {
  return error instanceof OwnKeyRejectedError || error instanceof OwnKeyRefusedError;
}

const isoInstant = (value: unknown): string | null =>
  typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : null;

/**
 * Reads OpenRouter's 403 body (message and metadata) the way its error page
 * describes it: budget errors carry `limit_source` and `resets_at`, moderation
 * errors `reasons` and `flagged_input`, guardrail blocks "Request blocked".
 */
export function ownKeyRefusalFrom(
  detail: { message?: unknown; metadata?: Record<string, unknown> } | null | undefined,
): OwnKeyRefusedError {
  const message = typeof detail?.message === 'string' ? detail.message : '';
  const meta = detail?.metadata ?? {};
  if (typeof meta.limit_source === 'string' || /budget|limit exceeded/i.test(message)) {
    const resets = isoInstant(meta.resets_at) ?? isoInstant(/resets (\S+?)\.?$/i.exec(message)?.[1]);
    return new OwnKeyRefusedError('budget', resets);
  }
  if (Array.isArray(meta.reasons) || typeof meta.flagged_input === 'string' || /flagged|moderation/i.test(message)) {
    return new OwnKeyRefusedError('moderation');
  }
  if (Array.isArray(meta.patterns) || /^request blocked|guardrail/i.test(message)) {
    return new OwnKeyRefusedError('guardrail');
  }
  return new OwnKeyRefusedError('forbidden');
}

export interface OwnKeyAsk {
  readonly kind: FreeTierKind;
  readonly scope: string;
}

interface PendingAsk extends OwnKeyAsk {
  readonly promise: Promise<OwnKeyChoice>;
  settle: (choice: OwnKeyChoice) => void;
}

// Scope to the stored key's save time: a new key, even the same string saved
// again, starts without a yes.
const granted = new Map<string, number>();
let queue: PendingAsk[] = [];
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

/** For useSyncExternalStore: the prompt on screen follows the queue's head. */
export function subscribeOwnKeyAsk(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The question on screen now, or null. Stable identity while it stays. */
export function currentOwnKeyAsk(): OwnKeyAsk | null {
  return queue[0] ?? null;
}

/** The visitor's answer to the question on screen. */
export function answerOwnKeyAsk(choice: OwnKeyChoice): void {
  const head = queue[0];
  if (!head) return;
  queue = queue.slice(1);
  head.settle(choice);
  notify();
}

function abortError(): Error {
  if (typeof DOMException !== 'undefined') {
    return new DOMException('Free tier question aborted', 'AbortError');
  }
  const error = new Error('Free tier question aborted');
  error.name = 'AbortError';
  return error;
}

function ask(kind: FreeTierKind, scope: string, signal?: AbortSignal): Promise<OwnKeyChoice> {
  if (signal?.aborted) return Promise.reject(abortError());

  // Two sends in one conversation share one question.
  let pending = queue.find((entry) => entry.scope === scope);
  if (!pending) {
    let settle: (choice: OwnKeyChoice) => void = () => {};
    const promise = new Promise<OwnKeyChoice>((resolve) => {
      settle = resolve;
    });
    pending = { kind, scope, promise, settle };
    queue = [...queue, pending];
    notify();
  }

  if (!signal) return pending.promise;

  const entry = pending;
  return new Promise<OwnKeyChoice>((resolve, reject) => {
    const onAbort = (): void => {
      // A send that is gone takes its question with it.
      if (queue.includes(entry)) {
        queue = queue.filter((item) => item !== entry);
        entry.settle('dismissed');
        notify();
      }
      reject(abortError());
    };
    signal.addEventListener('abort', onAbort, { once: true });
    entry.promise.then((choice) => {
      signal.removeEventListener('abort', onAbort);
      if (!signal.aborted) resolve(choice);
    });
  });
}

/**
 * Resolves when the free tier may answer: no own key is stored, or the visitor
 * said yes for this scope since the key was saved. Otherwise asks, and throws
 * OwnKeyRejectedError on a no, before anything is sent.
 */
export async function ensureFreeTierAllowed({
  kind,
  scope,
  signal,
}: {
  kind: FreeTierKind;
  scope: string;
  signal?: AbortSignal;
}): Promise<void> {
  const meta = await keyStorage.getKeyMetadata('openrouter');
  if (!meta) return;
  if (granted.get(scope) === meta.timestamp) return;

  const choice = await ask(kind, scope, signal);
  if (choice !== 'yes') throw new OwnKeyRejectedError(choice);
  granted.set(scope, meta.timestamp);
}

/** Test seam: forget every yes and every open question. */
export function resetOwnKeyConsentForTests(): void {
  granted.clear();
  const open = queue;
  queue = [];
  for (const entry of open) entry.settle('dismissed');
  notify();
}
