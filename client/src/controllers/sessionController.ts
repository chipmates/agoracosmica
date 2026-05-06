import { createRequestGate } from '../utils/async/requestGate';
import { getFigureSeedData, getFigureSeedDataAsync } from '../services/seedCacheInitializer';
import { ConversationMode, Seed } from '../types/global';
import { modeStateManager } from '../utils/modeStateManager';
import { preferencesAdapter } from '../storage/preferencesAdapter';
import { useDomainStore } from '../stores';

export interface SessionControllerOptions {
  fetchHistory?: (figureId: string, seedId: string | number, mode: ConversationMode | null) => void;
  onSeedsLoaded?: (figureId: string, seeds: Seed[]) => void;
}

const getPreferredLanguage = () => useDomainStore.getState().language.current || 'en';

const persistSelectedSeed = (figureId: string, seed: Seed | null) => {
  preferencesAdapter.setSelectedSeed(figureId, seed);
};

const selectDefaultSeed = (figureId: string, seeds: Seed[]): Seed | null => {
  // Check if there's a selected seed in Zustand
  const selectedSeedId = useDomainStore.getState().seeds.selectedId;
  const storedSeed = selectedSeedId
    ? useDomainStore.getState().seeds.byFigure[figureId]?.find(s => s.id.toString() === selectedSeedId)
    : null;
  if (storedSeed) {
    return storedSeed;
  }
  return seeds[0] ?? null;
};

const resolveModeForSeed = (figureId: string, seedId: string | number | null): ConversationMode | null => {
  if (!seedId) {
    return null;
  }
  const storedMode = modeStateManager.getStoredMode(figureId, seedId);
  return (storedMode as ConversationMode | null) ?? null;
};

const persistMode = (mode: ConversationMode | null, figureId: string, seedId: string | number | null) => {
  if (!mode || !seedId) {
    return;
  }
  // Zustand persist middleware handles global mode — only persist per-figure-seed
  modeStateManager.storeMode(figureId, seedId, mode);
};

const loadSeedsForFigure = async (figureId: string, language: string): Promise<Seed[]> => {
  const cached = getFigureSeedData(figureId, language);
  if (cached?.seeds) {
    return cached.seeds;
  }
  const asyncData = await getFigureSeedDataAsync(figureId, language);
  return asyncData?.seeds ?? [];
};

export const createSessionController = (options: SessionControllerOptions = {}) => {
  const gate = createRequestGate();
  let unsubscribe: (() => void) | undefined;
  let handlers: SessionControllerOptions = { ...options };
  let hasLoadedInitialState = false;

  const handleFigureChange = async (figureId: string | null) => {
    const store = useDomainStore.getState();

    if (!figureId) {
      store.selectSeed(null);
      store.setSeedLoading(false);
      store.setSeedError(null);
      return;
    }

    // Don't auto-restore state for brand new users
    // If user has a figure but no history AND no onboarding completed, they're mid-flow
    const hasSelectedFigure = useDomainStore.getState().figures.selectedId;
    const onboardingStatus = useDomainStore.getState().onboarding;
    const hasVisited = useDomainStore.getState().hasVisitedBefore;

    // Only skip restoration if:
    // 1. No onboarding completed/skipped AND
    // 2. No visited flag set
    // This lets returning users (with history or completed onboarding) restore state
    if (!onboardingStatus.complete && !onboardingStatus.skipped && !hasVisited) {
      return;
    }

    const pass = gate.begin(figureId);
    store.setSeedLoading(true);
    store.setSeedError(null);

    try {
      const language = store.session.language ?? getPreferredLanguage();
      const seeds = await loadSeedsForFigure(figureId, language);

      if (!pass.isCurrent()) {
        return;
      }

      store.cacheSeedsForFigure(figureId, seeds);
      if (handlers.onSeedsLoaded) {
        await Promise.resolve(handlers.onSeedsLoaded(figureId, seeds));
      }

      const chosenSeed = selectDefaultSeed(figureId, seeds);

      if (chosenSeed) {
        const normalizedSeed: Seed = { ...chosenSeed, id: chosenSeed.id?.toString() ?? '' };
        store.selectSeed(normalizedSeed.id);
        persistSelectedSeed(figureId, normalizedSeed);

        // Do NOT fall back to store.mode.selected when no stored mode exists for this
        // (figure, seed). That fallback fabricates "history" via persistMode, which
        // HomePage.handleSelectFigure then reads back as a returning-user signal and
        // bypasses the ModeSelector. First-time figures must reach the protected-flow
        // path that surfaces the ModeSelector with Story highlighted.
        const resolvedMode = resolveModeForSeed(figureId, normalizedSeed.id);

        if (resolvedMode) {
          store.setMode(resolvedMode);
          persistMode(resolvedMode, figureId, normalizedSeed.id);
        }

        handlers.fetchHistory?.(figureId, normalizedSeed.id, resolvedMode ?? null);
      } else {
        store.selectSeed(null);
        persistSelectedSeed(figureId, null);
      }

      // Don't reset conversation state here - it wipes out the history we just loaded!
      // Only reset council since it's independent
      store.resetCouncil();
    } catch (error) {
      console.error('[SessionController] Failed to load seeds for figure', figureId, error);
      if (pass.isCurrent()) {
        store.setSeedError('Unable to load seeds for this figure.');
      }
    } finally {
      if (pass.isCurrent()) {
        store.setSeedLoading(false);
      }
    }
  };

  return {
    start() {
      // Guard against duplicate start — clean up previous subscription first
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = undefined;
      }

      const store = useDomainStore;
      const currentFigureId = store.getState().figures.selectedId;

      // Only load initial state if handlers are ready (especially fetchHistory)
      // Otherwise, wait for updateHandlers to trigger it
      if (currentFigureId && handlers.fetchHistory) {
        hasLoadedInitialState = true;
        void handleFigureChange(currentFigureId);
      }

      let lastFigureId = currentFigureId;
      unsubscribe = store.subscribe((state) => {
        const nextFigureId = state.figures.selectedId;
        if (nextFigureId !== lastFigureId) {
          lastFigureId = nextFigureId;
          void handleFigureChange(nextFigureId);
        }
      });
    },
    stop() {
      unsubscribe?.();
      unsubscribe = undefined;
    },
    updateHandlers(nextHandlers: SessionControllerOptions = {}) {
      handlers = { ...nextHandlers };

      // If handlers just became ready and we haven't loaded initial state yet, do it now
      if (!hasLoadedInitialState && handlers.fetchHistory) {
        const store = useDomainStore;
        const currentFigureId = store.getState().figures.selectedId;
        if (currentFigureId) {
          hasLoadedInitialState = true;
          void handleFigureChange(currentFigureId);
        }
      }
    },
  };
};

export type SessionController = ReturnType<typeof createSessionController>;
