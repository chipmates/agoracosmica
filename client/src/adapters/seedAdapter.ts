import { useCallback, useMemo } from 'react';
import {
  useModeActions,
  useSeedsActions,
  useSeedsState,
} from '../stores';
import { useConversationActions } from '../stores/selectors/domainSelectors';
import type { Seed, Figure } from '../types/global';
import { ConversationMode } from '../types/global';
import { LocalStorageAdapter } from '../storage/localAdapter';
import { readHistoryMessages } from '../services/history/historyEncryption';
import seedStateManager from '../services/SeedStateManager';
import { cleanupAudioResources } from '../services/audioService';
import { processSeedAcquisition } from '../services/seedAcquisition';
import { modeStateManager } from '../utils/modeStateManager';

// Types for seed management (moved from deprecated useSeedManager hook)
export interface SeedManagerParams {
  selectedFigure: Figure | null;
  fetchHistory?: ((figureId: string, seedId: string, mode: string) => void) | null;
  selectedMode: ConversationMode | null;
  isCouncilMode: boolean;
  setConversationStarted?: ((started: boolean) => void) | null;
  setStoryData?: ((data: Record<string, unknown> | null) => void) | null;
  setError?: ((error: string | null) => void) | null;
  setIsCouncilMode?: ((isCouncil: boolean) => void) | null;
  setCouncilConfig?: ((config: unknown) => void) | null;
  setCurrentSpeaker?: ((speaker: string | null) => void) | null;
  setCouncilPhase?: ((phase: string) => void) | null;
}

export interface SelectSeedResult {
  storedMode: ConversationMode | null;
  isGathered: boolean;
}

export interface SeedManagerResult {
  selectedSeed: Seed | null;
  isReviewMode: boolean;
  selectSeed: (seed: Seed) => Promise<SelectSeedResult>;
  markSeedComplete: (seedId: string | number) => void;
  processSeedAcquisitionFromMessage: (messageContent: string) => void;
  loadDefaultSeedIfNeeded: (figureId: string, seeds: Seed[]) => Promise<Seed | null>;
  setSelectedSeed: (seed: Seed | null) => void;
  isSeedGathered: (figureId: string, seedId: string | number) => boolean;
}

const getHistoryKeyForMode = (figureId: string, seedId: string, mode: ConversationMode | null): string => {
  // Match the same logic used in conversation history storage
  switch (mode) {
    case ConversationMode.INTRODUCTION:
      return `story_content_${figureId}_${seedId}`;
    case ConversationMode.SEED_CONVERSATION:
      return `starseed_${figureId}_${seedId}`;
    case ConversationMode.CHALLENGE:
      return `challenge_${figureId}_${seedId}`;
    case ConversationMode.FREE_CONVERSATION:
      return `freetalk_${figureId}`;
    default:
      return `story_content_${figureId}_${seedId}`;
  }
};

const getSeedFromCache = (figureId: string | null, seedId: string | null, byFigure: Record<string, Seed[]>) => {
  if (!figureId || !seedId) {
    return null;
  }
  const seeds = byFigure[figureId] ?? [];
  return seeds.find((item) => item.id?.toString() === seedId) ?? null;
};

const persistSelectedSeed = (figureId: string | null, seed: Seed | null) => {
  if (!figureId) {
    return;
  }
  const storageKey = `selectedSeed_${figureId}`;
  if (seed) {
    LocalStorageAdapter.setJSON(storageKey, seed);
  } else {
    LocalStorageAdapter.remove(storageKey);
  }
};

const ensureModePersistence = (
  figureId: string | null,
  seedId: string | number,
  mode: ConversationMode | null,
  setStoreMode?: (mode: ConversationMode) => void
) => {
  if (!mode) {
    return;
  }
  setStoreMode?.(mode);  // Zustand setMode
  if (figureId) {
    modeStateManager.storeMode(figureId, seedId, mode);
  }
};

export const useSeedManagerAdapter = (params: SeedManagerParams): SeedManagerResult => {
  const {
    selectedFigure,
    fetchHistory,
    selectedMode,
    isCouncilMode,
    setConversationStarted,
    setStoryData,
    setError,
    setIsCouncilMode,
    setCouncilConfig,
    setCurrentSpeaker,
    setCouncilPhase,
  } = params;

  const { byFigure, selectedId: selectedSeedId } = useSeedsState();
  const { selectSeed: setStoreSelectedSeedId } = useSeedsActions();

  const { setMode: setStoreMode } = useModeActions();
  const { resetConversationState, setConversationMessages, setConversationStarted: setConversationStartedAction } = useConversationActions();

  const figureId = selectedFigure?.id ?? null;

  const selectedSeed = useMemo(
    () => getSeedFromCache(figureId, selectedSeedId, byFigure),
    [byFigure, figureId, selectedSeedId]
  );

  const isReviewMode = useMemo(() => {
    if (!figureId || !selectedSeed) {
      return false;
    }
    return seedStateManager.isSeedGathered(figureId, selectedSeed.id.toString());
  }, [figureId, selectedSeed?.id]);

  const setSelectedSeed = useCallback(
    (seed: Seed | null) => {
      setStoreSelectedSeedId(seed?.id?.toString() ?? null);
      persistSelectedSeed(figureId, seed ?? null);
    },
    [figureId, setStoreSelectedSeedId]
  );

  const selectSeed = useCallback(
    async (seed: Seed): Promise<SelectSeedResult> => {
      if (!seed) {
        return { storedMode: null, isGathered: false };
      }

      if (isCouncilMode && setIsCouncilMode) {
        setIsCouncilMode(false);
        setCouncilConfig?.(null);
        setCurrentSpeaker?.(null);
        setCouncilPhase?.('foundations');
      }

      const normalizedSeed: Seed = { ...seed, id: seed.id?.toString() ?? '' };

      setSelectedSeed(normalizedSeed);
      setStoryData?.(null);
      cleanupAudioResources();

      let storedMode: ConversationMode | null = null;
      if (figureId) {
        storedMode = modeStateManager.getStoredMode(figureId, normalizedSeed.id) as ConversationMode | null;
      }

      ensureModePersistence(
        figureId,
        normalizedSeed.id,
        storedMode ?? null,
        setStoreMode
      );

      // Check if history exists for this figure+seed+mode combination BEFORE resetting state
      let hasExistingHistory = false;
      if (figureId) {
        const effectiveMode = storedMode ?? selectedMode;
        const historyKey = getHistoryKeyForMode(figureId, normalizedSeed.id.toString(), effectiveMode);

        // CRITICAL: Check BOTH IndexedDB and localStorage
        try {
          const idbHistory = await readHistoryMessages<unknown>(historyKey);
          hasExistingHistory = Array.isArray(idbHistory) && idbHistory.length > 0;
        } catch (error) {
          console.warn('[seedAdapter] IndexedDB check failed, falling back to localStorage');
        }

        // Fallback to localStorage if IndexedDB failed
        if (!hasExistingHistory) {
          const allKeys = LocalStorageAdapter.keys();
          hasExistingHistory = allKeys.some(key => key === historyKey || key.startsWith(historyKey));
        }
      }

      // CRITICAL: Only reset conversation state if NO history exists
      // If history exists, the controller will load it - don't interfere!
      if (!hasExistingHistory) {
        resetConversationState();
        setConversationMessages([]);
        setConversationStartedAction(false);
      }
      // DON'T clear messages if history exists - let controller handle the transition
      // Clearing messages can cause issues if controller sees "thread unchanged"
      // The controller will clear and reload messages safely via updateThreadForSelection

      // For INTRODUCTION mode, story loading delegated to useConversationEffects
      // to prevent duplicate loads and race conditions

      // For conversation modes (SEED_CONVERSATION, CHALLENGE, FREE_CONVERSATION):
      // The conversationController will automatically load history when it detects
      // the selection change. We don't need to call fetchHistory manually.
      // This avoids race conditions between seedAdapter and controller.

      const gathered = figureId
        ? seedStateManager.isSeedGathered(figureId, normalizedSeed.id.toString())
        : false;

      return { storedMode, isGathered: gathered };
    },
    [
      fetchHistory,
      figureId,
      isCouncilMode,
      selectedFigure,
      selectedMode,
      setCouncilConfig,
      setCouncilPhase,
      setConversationStarted,
      setCurrentSpeaker,
      setError,
      setIsCouncilMode,
      setSelectedSeed,
      setStoreMode,
      setStoryData,
    ]
  );

  const markSeedComplete = useCallback(
    (seedId: string | number) => {
      if (figureId && seedId != null) {
        seedStateManager.markAsGathered(figureId, seedId.toString());
      }
    },
    [figureId]
  );

  const processSeedAcquisitionFromMessage = useCallback(
    (messageContent: string) => {
      if (!selectedFigure || selectedMode !== ConversationMode.CHALLENGE) {
        return;
      }
      const result = processSeedAcquisition(
        messageContent,
        selectedFigure.id,
        'challenge',
        LocalStorageAdapter.getString('selectedLanguage') || 'en'
      );

      if (result?.success && 'seedId' in result && result.seedId) {
        markSeedComplete(result.seedId);
      }
    },
    [markSeedComplete, selectedFigure, selectedMode]
  );

  const loadDefaultSeedIfNeeded = useCallback(
    async (targetFigureId: string, seeds: Seed[]): Promise<Seed | null> => {
      if (!seeds || seeds.length === 0) {
        return null;
      }

      const storedSeed = LocalStorageAdapter.getJSON<Seed | null>(
        `selectedSeed_${targetFigureId}`,
        null
      );

      if (storedSeed) {
        setSelectedSeed(storedSeed);
        return storedSeed;
      }

      if (!selectedSeed) {
        const defaultSeed = seeds[0];
        setSelectedSeed(defaultSeed);
        return defaultSeed;
      }

      return selectedSeed;
    },
    [selectedSeed, setSelectedSeed]
  );

  const isSeedGathered = useCallback(
    (targetFigureId: string, seedId: string | number) =>
      seedStateManager.isSeedGathered(targetFigureId, seedId.toString()),
    []
  );

  return {
    selectedSeed,
    isReviewMode,
    selectSeed,
    markSeedComplete,
    processSeedAcquisitionFromMessage,
    loadDefaultSeedIfNeeded,
    setSelectedSeed,
    isSeedGathered,
  };
};
