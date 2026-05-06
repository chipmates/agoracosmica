import { describe, it, expect, beforeEach, vi } from 'vitest';

const { getStringMock, setStringMock, keysMock } = vi.hoisted(() => ({
  getStringMock: vi.fn(),
  setStringMock: vi.fn(),
  keysMock: vi.fn(),
}));

vi.mock('@/storage/localAdapter', () => ({
  LocalStorageAdapter: {
    getString: getStringMock,
    setString: setStringMock,
    remove: vi.fn(),
    keys: keysMock,
  },
}));

import seedStateManager from '@/services/SeedStateManager';

describe('SeedStateManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    keysMock.mockReturnValue([]);
  });

  it('detects gathered seeds via LocalStorageAdapter', () => {
    getStringMock.mockReturnValue('true');

    const result = seedStateManager.isSeedGathered('plato', '42');

    expect(result).toBe(true);
    expect(getStringMock).toHaveBeenCalledWith('completion_plato_42');
  });

  it('persists gathered seeds through LocalStorageAdapter', () => {
    const success = seedStateManager.markAsGathered('plato', '21');

    expect(success).toBe(true);
    expect(setStringMock).toHaveBeenCalledWith('completion_plato_21', 'true');
  });

  it('collects gathered seeds per figure using adapter keys', () => {
    keysMock.mockReturnValue(['completion_plato_1', 'completion_plato_2', 'completion_other_3']);
    getStringMock.mockImplementation((key: string) => (key === 'completion_plato_1' ? 'true' : 'false'));

    const gathered = seedStateManager.getGatheredSeedsForFigure('plato');

    expect(gathered).toEqual(['1']);
  });

  it('dumps completion records using adapter accessors', () => {
    keysMock.mockReturnValue(['completion_plato_1', 'foo']);
    getStringMock.mockImplementation((key: string) => (key.startsWith('completion_') ? 'true' : null));

    const dump = seedStateManager.dumpCompletionRecords();

    expect(dump).toEqual({ completion_plato_1: 'true' });
  });
});
