import { useState, useCallback } from 'react';
import { modeStateManager } from '../utils/modeStateManager';
import { storyIntegrationManager } from '../services/StoryIntegrationManager';
import {
  saveStoryContent,
  markStoryCompleted,
  getStorageKeyForMode
} from '../utils/storageKeysV2';
import { initiateConversation } from '../services/audioService';
import { Figure, Seed, ConversationMode, Language } from '../types/global';
import { LocalStorageAdapter } from '../storage/localAdapter';
import { getFromStore } from '../storage';
import { useDomainStore, useModeActions, useConversationActions } from '../stores';

interface StoryData {
  text?: string;
  type?: string;
  needsTranslation?: boolean;
  [key: string]: any;
}

interface CouncilConfig {
  [key: string]: any;
}

type CouncilPhase = 'foundations' | 'perspectives' | 'synthesis' | 'wisdom';

interface ModeManagerParams {
  selectedFigure: Figure | null;
  selectedSeed: Seed | null;
  fetchHistory?: (figureId: string, seedId: string | number, mode: ConversationMode, force: boolean) => void;
  isCouncilMode: boolean;
  setIsCouncilMode?: (value: boolean) => void;
  setCouncilConfig?: (config: CouncilConfig | null) => void;
  setCurrentSpeaker?: (speaker: string | null) => void;
  setCouncilPhase?: (phase: CouncilPhase) => void;
  setShowModeSelector: (show: boolean) => void;
  language: Language;
}

interface ModeManagerResult {
  // State
  languageSelected: string | null;
  
  // Actions
  handleModeSelect: (mode: ConversationMode, force?: boolean) => void;
  handleLanguageAutoSelect: (langCode: string | { id?: string; code?: string }, modeOverride?: ConversationMode | null) => Promise<void>;
  setLanguageSelected: (lang: string | null) => void;
}

/**
 * Hook for managing mode selection and language selection
 * Designed to be Zustand-ready for future migration
 * 
 * @param params - Hook parameters
 * @returns Mode management state and functions
 */
export function useModeManager({
  selectedFigure,
  selectedSeed,
  fetchHistory,
  isCouncilMode,
  setIsCouncilMode,
  setCouncilConfig,
  setCurrentSpeaker,
  setCouncilPhase,
  setShowModeSelector,
  language
}: ModeManagerParams): ModeManagerResult {
  const [languageSelected, setLanguageSelected] = useState<string | null>(null);

  /**
   * Handle mode selection
   */
  // Get Zustand actions
  const { setMode: setZustandMode } = useModeActions();
  const { resetConversationState, setConversationStarted: setConversationStartedAction } = useConversationActions();

  const handleModeSelect = useCallback((mode: ConversationMode, force = false): void => {
    if (import.meta.env.DEV) console.log('[useModeManager] handleModeSelect called with:', mode, 'force:', force);

    // Read CURRENT mode from Zustand (always fresh, no stale closure)
    const currentMode = useDomainStore.getState().mode.selected;

    // Same mode re-selected — just close the modal, keep current state
    // Unless force=true (e.g., different figure selected with same mode via intent)
    // Also force when conversation hasn't started (e.g., first mode select after figure pick)
    // Also force when started but no messages (e.g., figure switch restored mode but never initiated conversation)
    const conversationStarted = useDomainStore.getState().conversation.started;
    const hasMessages = useDomainStore.getState().conversation.messages.length > 0;
    if (mode === currentMode && !force && conversationStarted && hasMessages) {
      setShowModeSelector(false);
      return;
    }

    // Reset council mode when switching modes
    if (isCouncilMode && setIsCouncilMode) {
      setIsCouncilMode(false);
      setCouncilConfig && setCouncilConfig(null);
      setCurrentSpeaker && setCurrentSpeaker(null);
      setCouncilPhase && setCouncilPhase('foundations');
    }

    // Read fresh figure/seed from Zustand (avoids stale closure on figure switch)
    const { figures: figState, seeds: seedState } = useDomainStore.getState();
    const currentFigureId = figState.selectedId;
    const currentSeedId = seedState.selectedId;

    // Update Zustand (single source of truth)
    setZustandMode(mode);

    // Only persist mode preference on explicit user selection (force=false),
    // not on programmatic navigation (force=true) like restoring a stored mode
    // or auto-navigating. This prevents polluting preferences with auto-navigation data.
    if (!force && currentFigureId && currentSeedId) {
      modeStateManager.storeMode(currentFigureId, String(currentSeedId), mode);
    }

    // Clear story data when changing modes to prevent stale data issues
    useDomainStore.getState().setStoryData(null);

    setShowModeSelector(false);

    // Automatically use the current language from Zustand
    const currentLanguage = useDomainStore.getState().language.current || language || 'en';

    // Prism mode: no conversation needed, just set the mode and mark as started
    if (mode === 'prism') {
      useDomainStore.getState().setAppLoading(false);
      useDomainStore.getState().setConversationStarted(true);
      setConversationStartedAction(true);
      return;
    }

    // For conversation modes, handleLanguageAutoSelect manages everything including conversation init
    // For story/introduction modes, we need to fetch history separately
    if (mode === 'seed_conversation' || mode === 'challenge' || mode === 'free_conversation') {
      // Let handleLanguageAutoSelect handle conversation initialization
      // It will reset conversation state AFTER determining if history exists
      handleLanguageAutoSelect(currentLanguage, mode);
      // Don't call fetchHistory here - it will be called by handleLanguageAutoSelect if needed
    } else {
      // For introduction/story modes, reset and load
      resetConversationState();
      setConversationStartedAction(false);
      useDomainStore.getState().setStoryData(null);
      handleLanguageAutoSelect(currentLanguage, mode);
      if (currentFigureId && currentSeedId && fetchHistory) {
        void fetchHistory(currentFigureId, String(currentSeedId), mode, true);
      }
    }
  }, [fetchHistory, isCouncilMode, setIsCouncilMode,
      setCouncilConfig, setCurrentSpeaker, setCouncilPhase, language,
      setZustandMode, setShowModeSelector, resetConversationState,
      setConversationStartedAction]);

  /**
   * Auto-select language from context/localStorage when needed
   */
  const handleLanguageAutoSelect = useCallback(async (
    langCode: string | { id?: string; code?: string },
    modeOverride: ConversationMode | null = null
  ): Promise<void> => {
    try {
      // Read fresh figure/seed from Zustand (avoids stale closure on figure switch)
      const freshStore = useDomainStore.getState();
      const figureId = freshStore.figures.selectedId;
      const seedId = freshStore.seeds.selectedId;

      // Ensure langCode is a string
      const code = typeof langCode === 'object'
        ? (langCode.id?.toLowerCase() || langCode.code?.toLowerCase() || 'en')
        : langCode.toLowerCase();
      setLanguageSelected(code);

      // Set language via Zustand (which will persist to localStorage)
      // Only set if different from current to avoid unnecessary translation reloads
      const currentLang = useDomainStore.getState().language.current;
      if (currentLang !== code) {
        await useDomainStore.getState().setLanguage(code);
      }

      // Use the provided mode or fall back to Zustand (always fresh)
      const currentMode = modeOverride || useDomainStore.getState().mode.selected as ConversationMode;

      // Don't clear messages here
      useDomainStore.getState().setAppLoading(true);
      useDomainStore.getState().setFirstTextArrived(false);

      // Only for non-English, non-German languages in story mode, show translation spinner
      if (currentMode === 'introduction' && code !== 'en' && code !== 'de') {
        useDomainStore.getState().setTranslationInProgress(true);
      }

      if (currentMode === 'introduction' && figureId && seedId) {
        // Load story directly — delegation to useConversationEffects was unreliable
        // because storyData being already null meant no dep change to trigger the effect.
        // Use Zustand getState() directly to avoid stale ref proxy closures.
        const store = useDomainStore.getState();
        store.setStoryData(null);
        store.setAppLoading(true);
        store.setConversationStarted(false);

        // Get seed data from Zustand for the story loader
        const seedObj = store.seeds.byFigure[figureId]
          ?.find(s => s.id.toString() === seedId) || null;

        if (import.meta.env.DEV) {
          console.log('[useModeManager] Starting story load:', { figureId, seedId, code, hasSeedObj: !!seedObj });
        }

        storyIntegrationManager.startStory({
          figure: figureId,
          seedId,
          language: code,
          seedData: seedObj,
          onComplete: (story: any) => {
            if (import.meta.env.DEV) {
              console.log('[useModeManager] onComplete fired!', { hasStory: !!story, type: story?.type, hasText: !!story?.text });
            }
            // Use Zustand getState() directly — ref proxies can be stale/null
            const s = useDomainStore.getState();
            s.setStoryData(story);
            if (story?.text) {
              saveStoryContent(figureId, seedId, story.text);
              // NOTE: markStoryCompleted is NOT called here — story load is not story completion.
              // Completion is triggered when user finishes listening (audio end) or reading (scroll to bottom).
              // See StoryPlayer onComplete and onStoryRead callbacks.
            }
            s.setConversationStarted(true);
            s.setAppLoading(false);
            s.setTranslationInProgress(false);
          },
          onError: (err: any) => {
            console.error('[useModeManager] Failed to load story:', err);
            const s = useDomainStore.getState();
            s.setAppLoading(false);
            s.setTranslationInProgress(false);
          },
        }).catch((err: any) => {
          // AbortError is expected when React Strict Mode double-fires effects
          // or when user switches modes rapidly — silently ignore it
          if (err?.name !== 'AbortError') {
            console.error('[useModeManager] Story load rejected:', err);
            useDomainStore.getState().setAppLoading(false);
          }
        });
        return;
      } else if (currentMode === 'seed_conversation' || currentMode === 'challenge' || currentMode === 'free_conversation') {
        // For conversation modes, check if history exists BEFORE triggering initial message

      // Validate that seed is present for modes that require it
      const seedRequiredModes = ['seed_conversation', 'challenge'];
      if (seedRequiredModes.includes(currentMode) && !seedId) {
        console.error(`[useModeManager] ${currentMode} mode requires a seed, but none selected`);
        useDomainStore.getState().setAppLoading(false);
        return;
      }

      // Ensure historyKey is set BEFORE checking history or initiating conversation
      let expectedKey: string | null = null;
      // Check if historyKey was already pre-set (e.g., page refresh via Effect #14)
      // If so, skip resetConversationState to avoid racing with the controller
      const preExistingHistoryKey = useDomainStore.getState().conversation.historyKey;
      if (figureId) {
        expectedKey = getStorageKeyForMode(
          currentMode,
          figureId,
          currentMode === 'free_conversation' ? undefined : (seedId ?? undefined)
        );
        if (expectedKey) {
          useDomainStore.getState().setConversationHistoryKey(expectedKey);
          if (import.meta.env.DEV) {
            console.log('[useModeManager] Set historyKey before conversation:', expectedKey);
          }
        } else if (seedRequiredModes.includes(currentMode)) {
          // If we couldn't generate a key for a seed-required mode, that's an error
          console.error(`[useModeManager] Failed to generate historyKey for ${currentMode}`);
          useDomainStore.getState().setAppLoading(false);
          return;
        }
      }

      // CRITICAL: Check if history exists before triggering initial conversation
      // Must check BOTH IndexedDB and localStorage
      let hasExistingHistory = false;
      if (expectedKey) {
        // Check IndexedDB first
        try {
          const idbHistory = await getFromStore<unknown>('history', expectedKey);
          hasExistingHistory = Array.isArray(idbHistory) && idbHistory.length > 0;
        } catch {
          // IndexedDB check failed, falling back to localStorage
        }

        // Fallback to localStorage if IndexedDB failed
        if (!hasExistingHistory) {
          const allKeys = LocalStorageAdapter.keys();
          hasExistingHistory = allKeys.some(key => key === expectedKey);
        }
      }

      // Reset conversation state BEFORE loading new mode content —
      // but SKIP if historyKey was already pre-set for this mode (page refresh).
      // On refresh, the controller's updateThreadForSelection is already loading history;
      // resetting here would clear that in-flight work, causing an empty state race.
      const isRefreshRestore = preExistingHistoryKey === expectedKey && expectedKey !== null;
      if (!isRefreshRestore) {
        resetConversationState();
        setConversationStartedAction(false);
      } else if (import.meta.env.DEV) {
        console.log('[useModeManager] Skipping resetConversationState — historyKey already matches (refresh)');
      }

      // Only trigger initial conversation if NO history exists
      if (!hasExistingHistory) {
        const figureIdHint = figureId || '';
        initiateConversation(code, figureIdHint)
          .then(() => {
            // Avoid duplicating any message appends here; the service/controller own it.
          })
          .catch((err: Error) => {
            console.error('Error sending initial prompt:', err);
            useDomainStore.getState().setAppLoading(false);
          });
      } else {
        // CRITICAL: Explicitly load history for the new mode
        // Don't just assume controller will detect it - we just cleared messages!
        if (fetchHistory && figureId) {
          // For free_conversation, seedId is not required; for others, it is
          const seedIdParam = currentMode === 'free_conversation' ? '0' : seedId;
          if (seedIdParam) {
            await fetchHistory(
              figureId,
              String(seedIdParam),
              currentMode,
              true  // preserveMode = true
            );
          }
        }
        useDomainStore.getState().setAppLoading(false);
      }
      } else {
        // For any other modes
        useDomainStore.getState().setAppLoading(false);
      }
    } catch (err) {
      const error = err as Error;
      console.error('Error in handleLanguageAutoSelect:', error);
      useDomainStore.getState().setAppLoading(false);
      useDomainStore.getState().setTranslationInProgress(false);
    }
  }, [fetchHistory]);

  return {
    // State
    languageSelected,
    
    // Actions
    handleModeSelect,
    handleLanguageAutoSelect,
    setLanguageSelected
  };
}
