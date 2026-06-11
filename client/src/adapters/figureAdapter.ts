import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  useFiguresActions,
  useFiguresState,
  useSeedsActions,
  useSeedsState,
} from '../stores';
import type { Figure, Language, Seed } from '../types/global';
import { getHistoricalFigures, historicalFigures } from '../api/figures';
import { getFigureSeedData, getFigureSeedDataAsync } from '../services/seedCacheInitializer';
import { modeStateManager } from '../utils/modeStateManager';
import { cleanupAudioResources } from '../services/audioService';
import { preferencesAdapter } from '../storage/preferencesAdapter';
import { useConversationActions } from '../stores/selectors/domainSelectors';

// Types for figure management (moved from deprecated useFigureManager hook)
export interface SelectFigureOptions {
  resetCouncilMode?: (() => void) | null;
  setShowFigureCarousel?: ((show: boolean) => void) | null;
  setSelectedSeed?: ((seed: Seed | null) => void) | null;
  setStoryData?: ((data: unknown) => void) | null;
}

export interface SelectFigureResult {
  seed: Seed | null;
}

export interface FigureManagerResult {
  selectedFigure: Figure | null;
  figureSeeds: Seed[];
  seedsLoading: boolean;
  selectFigure: (figure: Figure, options?: SelectFigureOptions) => Promise<SelectFigureResult>;
  loadFigureSeeds: (figureId: string) => Promise<Seed[]>;
  setSelectedFigure: (figure: Figure | null) => void;
  getFigureById: (id: string) => Figure | undefined;
}

const getInitialFigure = (figures: Figure[]): Figure | null => {
  const savedFigureId = preferencesAdapter.getSelectedFigureId();
  if (savedFigureId) {
    return figures.find((fig) => fig.id === savedFigureId) ?? figures[0] ?? null;
  }

  const hasVisitedBefore = preferencesAdapter.hasVisitedBefore();
  if (!hasVisitedBefore) {
    return null;
  }

  return figures.find((fig) => fig.id === 'laozi') ?? figures[0] ?? null;
};

export const useFigureManagerAdapter = (
  language: Language,
  onSelectFigure?: (figure: Figure) => void
): FigureManagerResult => {
  const { list: figures, selectedId: selectedFigureId } = useFiguresState();
  const { setFigures, selectFigure: setSelectedFigureId } = useFiguresActions();

  const { byFigure, isLoading: seedsLoading } = useSeedsState();
  const {
    cacheSeedsForFigure,
    selectSeed: setSelectedSeedId,
    setSeedLoading,
    setSeedError,
  } = useSeedsActions();
  const { resetConversationState, setConversationMessages, setConversationStarted: setConversationStartedAction } = useConversationActions();

  const initialisedRef = useRef(false);

  useEffect(() => {
    const figureList = getHistoricalFigures(language);
    setFigures(figureList);

    if (!initialisedRef.current) {
      initialisedRef.current = true;
      const initialFigure = getInitialFigure(figureList);

      if (initialFigure) {
        setSelectedFigureId(initialFigure.id);
        preferencesAdapter.setSelectedFigureId(initialFigure.id);
        preferencesAdapter.setSelectedFigureObject(initialFigure);
      }
    } else if (selectedFigureId) {
      const translatedFigure = figureList.find((fig) => fig.id === selectedFigureId);
      if (translatedFigure) {
        preferencesAdapter.setSelectedFigureObject(translatedFigure);
      }
    }
  }, [language, selectedFigureId, setFigures, setSelectedFigureId]);

  const selectedFigure = useMemo<Figure | null>(() => {
    if (!selectedFigureId || !figures) {
      return null;
    }
    return figures.find((fig: Figure) => fig.id === selectedFigureId) ?? null;
  }, [figures, selectedFigureId]);

  const figureSeeds = useMemo<Seed[]>(() => {
    if (!selectedFigureId) {
      return [];
    }
    return byFigure[selectedFigureId] ?? [];
  }, [byFigure, selectedFigureId]);

  const setSelectedFigure = useCallback(
    (figure: Figure | null) => {
      setSelectedFigureId(figure?.id ?? null);
      if (figure) {
        preferencesAdapter.setSelectedFigureId(figure.id);
        preferencesAdapter.setSelectedFigureObject(figure);
      } else {
        preferencesAdapter.setSelectedFigureId(null);
        preferencesAdapter.setSelectedFigureObject(null);
      }
    },
    [setSelectedFigureId]
  );

  const loadFigureSeeds = useCallback(
    async (figureId: string): Promise<Seed[]> => {
      setSeedLoading(true);
      try {
        let seedData = getFigureSeedData(figureId, language);
        if (!seedData) {
          seedData = await getFigureSeedDataAsync(figureId, language);
        }
        const seeds = (seedData?.seeds ?? []) as Seed[];
        cacheSeedsForFigure(figureId, seeds);
        setSeedError(null);
        return seeds;
      } catch (error) {
        console.error('Error loading seeds for figure:', error);
        setSeedError(error instanceof Error ? error.message : 'Failed to load seeds');
        return [];
      } finally {
        setSeedLoading(false);
      }
    },
    [cacheSeedsForFigure, language, setSeedError, setSeedLoading]
  );

  const selectFigure = useCallback(
    async (figure: Figure, options: SelectFigureOptions = {}): Promise<SelectFigureResult> => {
      const {
        resetCouncilMode = null,
        setShowFigureCarousel = null,
        setSelectedSeed = null,
        setStoryData = null,
      } = options;

      resetCouncilMode?.();

      setSelectedFigure(figure);
      onSelectFigure?.(figure);

      modeStateManager.cleanupOldStates(figure.id);

      setShowFigureCarousel?.(false);

      // CRITICAL: Clear storyData IMMEDIATELY to prevent race condition in useConversationEffects
      // If we wait until after seed loading, the effect may run with old storyData and fail the !storyData check
      setStoryData?.(null);

      // Hard reset conversation state when switching figures to avoid cross-thread carryover
      resetConversationState();
      setConversationMessages([]);
      setConversationStartedAction(false);

      const seeds = await loadFigureSeeds(figure.id);

      // CRITICAL FIX: Restore last selected seed for this figure, not always seeds[0].
      // Compare ids as strings: seed JSON ships numeric ids, but the persisted
      // selection is stringified on save, so strict === never matched.
      const savedSeed = preferencesAdapter.getSelectedSeed<Seed>(figure.id);
      const defaultSeed =
        (savedSeed && seeds.find(s => s.id?.toString() === savedSeed.id?.toString())) ?? seeds[0] ?? null;

      const result: SelectFigureResult = {
        seed: defaultSeed,
      };

      if (!defaultSeed) {
        return result;
      }

      setSelectedSeedId(defaultSeed.id);
      setSelectedSeed?.(defaultSeed);
      preferencesAdapter.setSelectedSeed(figure.id, defaultSeed);

      cleanupAudioResources();

      // Mode restoration is handled by Effect #14 after figure+seed settle.
      // No mode logic here — single path through handleModeSelect.

      return result;
    },
    [loadFigureSeeds, onSelectFigure, setSelectedFigure, setSelectedSeedId, resetConversationState, setConversationMessages, setConversationStartedAction]
  );

  const getFigureById = useCallback(
    (id: string) => figures?.find((fig: Figure) => fig.id === id) ?? historicalFigures.find((fig: Figure) => fig.id === id),
    [figures]
  );

  return {
    selectedFigure,
    figureSeeds,
    seedsLoading,
    selectFigure,
    loadFigureSeeds,
    setSelectedFigure,
    getFigureById,
  };
};
