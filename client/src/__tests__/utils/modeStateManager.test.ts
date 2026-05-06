import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConversationMode } from '@/types/global';

const { getJSONMock, setJSONMock, removeMock, keysMock } = vi.hoisted(() => ({
  getJSONMock: vi.fn(),
  setJSONMock: vi.fn(),
  removeMock: vi.fn(),
  keysMock: vi.fn(),
}));

vi.mock('@/storage/localAdapter', () => ({
  LocalStorageAdapter: {
    getJSON: getJSONMock,
    setJSON: setJSONMock,
    remove: removeMock,
    keys: keysMock,
    setString: vi.fn(),
    getString: vi.fn(),
  },
}));

import { modeStateManager } from '@/utils/modeStateManager';

describe('modeStateManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    keysMock.mockReturnValue([]);
  });

  it('returns stored mode when present', () => {
    getJSONMock.mockReturnValue({ mode: ConversationMode.CHALLENGE, timestamp: new Date().toISOString() });

    const result = modeStateManager.getStoredMode('plato', 'seed-1');

    expect(result).toBe(ConversationMode.CHALLENGE);
    expect(getJSONMock).toHaveBeenCalledWith('modeState_plato_seed-1', null);
  });

  it('persists mode via LocalStorageAdapter', () => {
    const beforeCall = Date.now();

    modeStateManager.storeMode('plato', 'seed-2', ConversationMode.FREE_CONVERSATION);

    expect(setJSONMock).toHaveBeenCalledTimes(1);
    const [key, payload] = setJSONMock.mock.calls[0];
    expect(key).toBe('modeState_plato_seed-2');
    expect(payload.mode).toBe(ConversationMode.FREE_CONVERSATION);
    expect(new Date(payload.timestamp).getTime()).toBeGreaterThanOrEqual(beforeCall);
  });

  it('cleans up stale modes via LocalStorageAdapter', () => {
    const oldTimestamp = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    const freshTimestamp = new Date().toISOString();

    keysMock.mockReturnValue(['modeState_plato_seed-old', 'modeState_plato_seed-fresh', 'other_key']);
    getJSONMock.mockImplementation((key: string) => {
      if (key === 'modeState_plato_seed-old') {
        return { mode: ConversationMode.CHALLENGE, timestamp: oldTimestamp };
      }
      if (key === 'modeState_plato_seed-fresh') {
        return { mode: ConversationMode.CHALLENGE, timestamp: freshTimestamp };
      }
      return null;
    });

    modeStateManager.cleanupOldStates('plato');

    expect(removeMock).toHaveBeenCalledTimes(1);
    expect(removeMock).toHaveBeenCalledWith('modeState_plato_seed-old');
  });
});
