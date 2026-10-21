// A no to the own-key question in a council reaches the page as the visitor's
// answer: the chat's key line in the page's language, never the error's own
// English text, and nothing after "check my key" (Settings is open then).
import { describe, it, expect, vi, beforeEach } from 'vitest';

const KEY_LINE = 'Dein OpenRouter-Key wurde abgelehnt (test line).';

const h = vi.hoisted(() => ({
  shown: [] as Array<string | null>,
  listeners: {} as Record<string, Array<(payload: unknown) => void>>,
  reply: null as null | ((emit: (name: string, payload: unknown) => void) => unknown),
}));

vi.mock('../../services/council', () => {
  const emit = (name: string, payload: unknown) => (h.listeners[name] ?? []).forEach((fn) => fn(payload));
  return {
    cosmicCouncilService: {
      addEventListener: (name: string, fn: (payload: unknown) => void) => {
        (h.listeners[name] ??= []).push(fn);
      },
      removeEventListener: () => {},
      startCouncilDebate: vi.fn(async () => h.reply?.(emit)),
    },
  };
});

vi.mock('../../services/storage/keyStorageService', () => ({
  keyStorage: { getKeyMetadata: vi.fn(async () => null) },
}));

const state = {
  language: {
    current: 'de',
    uiTranslations: { errors: { conversation: { byokInvalidKey: KEY_LINE } } },
  },
  council: { config: null },
  setCouncilError: (message: string | null) => { h.shown.push(message); },
  setAppError: (message: string | null) => { h.shown.push(message); },
  toggleCouncilMode: () => {},
  resetConversationState: () => {},
  startCouncil: () => {},
  setCouncilCurrentMessage: () => {},
  setConversationHistoryKey: () => {},
  resetCouncil: () => {},
};

vi.mock('../../stores', () => ({ useDomainStore: { getState: () => state } }));
vi.mock('../../stores/domainStore', () => ({ useDomainStore: { getState: () => state } }));

import { createCouncilController } from '../../controllers/councilController';
import { OwnKeyRejectedError } from '../../services/llm/ownKeyConsent';

/** The service as the council chain reports a no: the error event, then the failed result. */
function declineWith(choice: 'dismissed' | 'check-key'): void {
  const error = new OwnKeyRejectedError(choice);
  h.reply = (emit) => {
    emit('onError', error);
    return { success: false, error: error.message, ownKey: error };
  };
}

const CONFIG = { moderator: 'lovelace', participants: ['einstein'], question: 'Ist freier Wille real?' } as never;

describe('a council after a rejected own key', () => {
  const controller = createCouncilController();
  controller.start();

  beforeEach(() => {
    h.shown.length = 0;
  });

  it('a no shows the key line, never the error text', async () => {
    declineWith('dismissed');
    await controller.startCouncil(CONFIG).catch(() => {});

    const lines = h.shown.filter((line) => line !== null);
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) expect(line).toBe(KEY_LINE);
  });

  it('after check my key the page shows nothing', async () => {
    declineWith('check-key');
    await controller.startCouncil(CONFIG).catch(() => {});

    // setCouncilError(null) on start is the only write.
    expect(h.shown.filter((line) => line !== null)).toEqual([]);
  });

  it('any other failure still shows its message', async () => {
    h.reply = (emit) => {
      emit('onError', new Error('Too few segments generated: 0'));
      return { success: false, error: 'Too few segments generated: 0' };
    };
    await controller.startCouncil(CONFIG).catch(() => {});
    expect(h.shown).toContain('Too few segments generated: 0');
  });
});
