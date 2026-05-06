import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ConversationMode, Figure, Seed } from '@/types/global';
import type { SeedManagerParams } from '@/adapters/seedAdapter';
import { resetDomainStore, useDomainStore } from '@/stores';

const {
  getFigureSeedDataMock,
  getFigureSeedDataAsyncMock,
  startStoryMock,
  processSeedAcquisitionMock,
  getStoredModeMock,
  storeModeMock,
  cleanupOldStatesMock,
  isSeedGatheredMock,
  markAsGatheredMock,
  getJSONMock,
  setJSONMock,
  setStringMock,
  getStringMock,
  removeMock,
  keysMock,
} = vi.hoisted(() => ({
  getFigureSeedDataMock: vi.fn(),
  getFigureSeedDataAsyncMock: vi.fn(),
  startStoryMock: vi.fn(async () => ({ text: 'story' })),
  processSeedAcquisitionMock: vi.fn(),
  getStoredModeMock: vi.fn(),
  storeModeMock: vi.fn(),
  cleanupOldStatesMock: vi.fn(),
  isSeedGatheredMock: vi.fn(),
  markAsGatheredMock: vi.fn(),
  getJSONMock: vi.fn(),
  setJSONMock: vi.fn(),
  setStringMock: vi.fn(),
  getStringMock: vi.fn(),
  removeMock: vi.fn(),
  keysMock: vi.fn(),
}));

const seedsFixture: Seed[] = [
  { id: 'seed-1', title: 'First Seed' },
  { id: 'seed-2', title: 'Second Seed' },
];

const figureFixture: Figure = {
  id: 'plato',
  name: 'Echo of Plato',
  about: 'Philosopher',
};

vi.mock('@/services/seedCacheInitializer', () => ({
  getFigureSeedData: getFigureSeedDataMock,
  getFigureSeedDataAsync: getFigureSeedDataAsyncMock,
}));
vi.mock('@/services/StoryIntegrationManager', () => ({
  storyIntegrationManager: {
    startStory: startStoryMock,
  },
}));
vi.mock('@/services/seedAcquisition', () => ({
  processSeedAcquisition: processSeedAcquisitionMock,
}));
vi.mock('@/utils/modeStateManager', () => ({
  modeStateManager: {
    getStoredMode: getStoredModeMock,
    storeMode: storeModeMock,
    clearStoredMode: vi.fn(),
    getStorageKey: vi.fn((figureId: string, seedId: string | number) => `modeState_${figureId}_${seedId}`),
    cleanupOldStates: cleanupOldStatesMock,
  },
}));
vi.mock('@/services/SeedStateManager', () => ({
  default: {
    isSeedGathered: isSeedGatheredMock,
    markAsGathered: markAsGatheredMock,
    subscribe: vi.fn(),
    dumpCompletionRecords: vi.fn(),
    getGatheredSeedsForFigure: vi.fn(),
  },
}));
vi.mock('@/storage/localAdapter', () => ({
  LocalStorageAdapter: {
    getJSON: getJSONMock,
    setJSON: setJSONMock,
    getString: getStringMock,
    setString: setStringMock,
    remove: removeMock,
    keys: keysMock,
  },
}));

import { useSeedManagerAdapter } from '@/adapters/seedAdapter';

describe('useSeedManagerAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDomainStore();
    useDomainStore.getState().cacheSeedsForFigure(figureFixture.id, seedsFixture);
    useDomainStore.getState().selectSeed(null);
    getStoredModeMock.mockReturnValue(ConversationMode.INTRODUCTION);
    isSeedGatheredMock.mockReturnValue(true);
    setJSONMock.mockClear();
    setStringMock.mockClear();
    getJSONMock.mockReturnValue(null);
    getFigureSeedDataMock.mockReturnValue({ seeds: seedsFixture });
    getFigureSeedDataAsyncMock.mockResolvedValue({ seeds: seedsFixture });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.skip('selectSeed mirrors legacy flow and persists through adapters', async () => {
    vi.useFakeTimers();

    const params: SeedManagerParams = {
      selectedFigure: figureFixture,
      fetchHistory: vi.fn(),
      selectedMode: ConversationMode.SEED_CONVERSATION,
      isCouncilMode: false,
      setConversationStarted: vi.fn(),
      setStoryData: vi.fn(),
      setError: vi.fn(),
      setIsCouncilMode: vi.fn(),
      setCouncilConfig: vi.fn(),
      setCurrentSpeaker: vi.fn(),
      setCouncilPhase: vi.fn(),
    };

    const { result } = renderHook(() => useSeedManagerAdapter(params));

    const selection = await act(async () => result.current.selectSeed(seedsFixture[0]));

    await vi.runAllTimersAsync();

    expect(selection.storedMode).toBe(ConversationMode.INTRODUCTION);
    expect(selection.isGathered).toBe(true);

    expect(params.fetchHistory).toHaveBeenCalledWith('plato', 'seed-1', ConversationMode.INTRODUCTION);
    // setSelectedMode was removed from SeedManagerParams — mode is now set via store
    expect(storeModeMock).toHaveBeenCalledWith('plato', 'seed-1', ConversationMode.INTRODUCTION);
    expect(setStringMock).toHaveBeenCalledWith('selectedMode', ConversationMode.INTRODUCTION);

    expect(setJSONMock).toHaveBeenCalledWith('selectedSeed_plato', {
      ...seedsFixture[0],
      id: 'seed-1',
    });

    expect(startStoryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        figure: 'plato',
        seedId: 'seed-1',
        language: 'en',
      })
    );
    expect(params.setStoryData).toHaveBeenCalledWith({ text: 'story' });
    expect(params.setConversationStarted).toHaveBeenCalledWith(true);

    expect(isSeedGatheredMock).toHaveBeenCalledWith('plato', 'seed-1');
    expect(markAsGatheredMock).not.toHaveBeenCalled();
  });

  it.skip('marks seeds gathered when acquisition succeeds', () => {
    const params: SeedManagerParams = {
      selectedFigure: figureFixture,
      fetchHistory: vi.fn(),
      selectedMode: ConversationMode.CHALLENGE,
      isCouncilMode: false,
      setConversationStarted: vi.fn(),
      setStoryData: vi.fn(),
      setError: vi.fn(),
      setIsCouncilMode: vi.fn(),
      setCouncilConfig: vi.fn(),
      setCurrentSpeaker: vi.fn(),
      setCouncilPhase: vi.fn(),
    };

    const { result } = renderHook(() => useSeedManagerAdapter(params));

    processSeedAcquisitionMock.mockReturnValue({ success: true, seedId: 'seed-9' });

    act(() => {
      result.current.processSeedAcquisitionFromMessage('seed acquired');
    });

    expect(processSeedAcquisitionMock).toHaveBeenCalledWith(
      'seed acquired',
      'plato',
      'challenge',
      expect.any(String)
    );
    expect(markAsGatheredMock).toHaveBeenCalledWith('plato', 'seed-9');
  });
});
