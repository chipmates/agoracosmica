import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { DomainSlices, ConversationMessage, CouncilConfig } from './slices/domainTypes';
import { ConversationMode, type User, type Language, type Figure, type Seed } from '../types/global';
import { createLanguageSlice } from './slices/languageSlice';
import { createPreferencesSlice } from './slices/preferencesSlice';
import { createFirstVisitSlice } from './slices/firstVisitSlice';
import { createVoicePreferencesSlice } from './slices/voicePreferencesSlice';

const debugLog = (...args: any[]) => {
  if (import.meta.env.DEV) {
    console.log('[DomainStore]', ...args);
  }
};

export type DomainState = DomainSlices;

const createInitialState = () => ({
  session: {
    user: null,
    token: null,
    language: null,
    config: {},
    loading: false,
    error: null,
    storyData: null,
    firstTextArrived: false,
    translationInProgress: false,
    isAudioPlaying: false,
  },
  figures: {
    list: [],
    selectedId: null,
    isLoading: false,
    error: null,
    lastFetchedAt: null,
  },
  seeds: {
    byFigure: {},
    selectedId: null,
    isLoading: false,
    error: null,
  },
  mode: {
    selected: ConversationMode.INTRODUCTION,
    isCouncilMode: false,
    preferences: {},
  },
  conversation: {
    messages: [],
    started: false,
    historyKey: null,
    pendingRequestId: null,
    processingStage: null,
    lastUpdatedAt: null,
  },
  council: {
    isActive: false,
    config: null,
    phase: null,
    speaker: null,
    lastEventAt: null,
    error: null,
    currentMessage: '',
    audioPlayback: null,
  },
  quota: {
    used: 0,
    limit: 30,
    resetsAt: null,
    isFreeTier: false,
    loaded: false,
    council: { used: 0, limit: 1, loaded: false },
    summary: { used: 0, limit: 2, loaded: false },
  },
  rateLimitModal: {
    isOpen: false,
    endpoint: null,
    resetsAt: null,
    limit: null,
  },
  byokModal: {
    isOpen: false,
    triggerEndpoint: null,
    required: false,
  },
});

export const resetDomainStore = () => {
  const defaults = createInitialState();
  const languageDefaults = createLanguageSlice(useDomainStore.setState, useDomainStore.getState);

  useDomainStore.setState({
    session: defaults.session,
    figures: defaults.figures,
    seeds: defaults.seeds,
    mode: defaults.mode,
    conversation: defaults.conversation,
    council: defaults.council,
    quota: defaults.quota,
    rateLimitModal: defaults.rateLimitModal,
    language: languageDefaults.language, // Preserve language slice
  });
};

export const useDomainStore = create<DomainSlices>()(
  devtools(
    persist(
      (set, get) => ({
        ...createInitialState(),
        ...createLanguageSlice(set, get),
        ...createPreferencesSlice(set, get),
        ...createFirstVisitSlice(set, get),
        ...createVoicePreferencesSlice(set, get),

        // Session slice actions
        setSessionUser: (user: User | null) => set((state: DomainSlices) => ({ session: { ...state.session, user } })),
        setSessionToken: (token: string | null) => set((state: DomainSlices) => ({ session: { ...state.session, token } })),
        setSessionLanguage: (language: Language | null) => set((state: DomainSlices) => ({ session: { ...state.session, language } })),
        setAppConfig: (config: Record<string, unknown>) => set((state: DomainSlices) => ({ session: { ...state.session, config } })),
        setAppLoading: (loading: boolean) => set((state: DomainSlices) => ({ session: { ...state.session, loading } })),
        setAppError: (error: string | null) => set((state: DomainSlices) => ({ session: { ...state.session, error } })),
        setStoryData: (storyData: Record<string, unknown> | null) => set((state: DomainSlices) => ({ session: { ...state.session, storyData } })),
        setFirstTextArrived: (firstTextArrived: boolean) => set((state: DomainSlices) => ({ session: { ...state.session, firstTextArrived } })),
        setTranslationInProgress: (translationInProgress: boolean) => set((state: DomainSlices) => ({ session: { ...state.session, translationInProgress } })),
        setAudioPlaying: (isAudioPlaying: boolean) => set((state: DomainSlices) => ({ session: { ...state.session, isAudioPlaying } })),
        resetSession: () => set((state: DomainSlices) => ({ session: { ...createInitialState().session, language: state.session.language } })),

        // Figures slice actions
        setFigures: (list: Figure[]) => set((state: DomainSlices) => ({ figures: { ...state.figures, list } })),
        setFigureLoading: (isLoading: boolean) => set((state: DomainSlices) => ({ figures: { ...state.figures, isLoading } })),
        setFigureError: (error: string | null) => set((state: DomainSlices) => ({ figures: { ...state.figures, error } })),
        selectFigure: (selectedId: string | null) => set((state: DomainSlices) => ({ figures: { ...state.figures, selectedId } })),
        setFiguresFetchedAt: (lastFetchedAt: string | null) => set((state: DomainSlices) => ({ figures: { ...state.figures, lastFetchedAt } })),

        // Seeds slice actions
        cacheSeedsForFigure: (figureId: string, seeds: Seed[]) =>
          set((state: DomainSlices) => ({ seeds: { ...state.seeds, byFigure: { ...state.seeds.byFigure, [figureId]: seeds } } })),
        selectSeed: (selectedId: string | number | null) => set((state: DomainSlices) => ({ seeds: { ...state.seeds, selectedId: selectedId?.toString() ?? null } })),
        setSeedLoading: (isLoading: boolean) => set((state: DomainSlices) => ({ seeds: { ...state.seeds, isLoading } })),
        setSeedError: (error: string | null) => set((state: DomainSlices) => ({ seeds: { ...state.seeds, error } })),
        resetSeeds: () => set((state: DomainSlices) => ({ seeds: { ...createInitialState().seeds, byFigure: state.seeds.byFigure } })),

        // Mode slice actions
        setMode: (selected: ConversationMode) => set((state: DomainSlices) => ({ mode: { ...state.mode, selected } })),
        toggleCouncilMode: (isCouncilMode: boolean) => set((state: DomainSlices) => ({ mode: { ...state.mode, isCouncilMode } })),
        persistModePreference: (figureId: string, seedId: string | number, selected: ConversationMode) =>
          set((state: DomainSlices) => {
            const key = `${figureId}:${seedId}`;
            return { mode: { ...state.mode, preferences: { ...state.mode.preferences, [key]: selected } } };
          }),
        clearModePreference: (figureId: string, seedId: string | number) =>
          set((state: DomainSlices) => {
            const key = `${figureId}:${seedId}`;
            const { [key]: _removed, ...rest } = state.mode.preferences;
            return { mode: { ...state.mode, preferences: rest } };
          }),
        hydrateModePreferences: (preferences: Record<string, ConversationMode>) =>
          set((state: DomainSlices) => ({ mode: { ...state.mode, preferences: { ...preferences } } })),
        resetMode: () => set((state: DomainSlices) => ({ mode: { ...createInitialState().mode, preferences: state.mode.preferences } })),

        // Conversation slice actions
        setConversationMessages: (messages: ConversationMessage[]) =>
          set((state: DomainSlices) => {
            const prev = state.conversation.messages;
            if (prev === messages) {
              return state;
            }
            debugLog('setConversationMessages', {
              prevLength: prev.length,
              nextLength: Array.isArray(messages) ? messages.length : 0,
            });
            return { conversation: { ...state.conversation, messages } };
          }),
        appendConversationMessage: (message: ConversationMessage) =>
          set((state: DomainSlices) => {
            debugLog('appendConversationMessage', { role: message?.role });
            return {
              conversation: { ...state.conversation, messages: [...state.conversation.messages, message] },
            };
          }),
        setConversationStarted: (started: boolean) =>
          set((state: DomainSlices) => {
            if (state.conversation.started === started) {
              debugLog('setConversationStarted:noop', { started });
              return state;
            }
            debugLog('setConversationStarted', {
              previous: state.conversation.started,
              next: started,
            });
            return { conversation: { ...state.conversation, started } };
          }),
        setConversationHistoryKey: (historyKey: string | null) =>
          set((state: DomainSlices) => {
            if (state.conversation.historyKey === historyKey) {
              debugLog('setConversationHistoryKey:noop', { historyKey });
              return state;
            }
            debugLog('setConversationHistoryKey', {
              previous: state.conversation.historyKey,
              next: historyKey,
            });
            return { conversation: { ...state.conversation, historyKey } };
          }),
        setPendingRequestId: (pendingRequestId: string | null) =>
          set((state: DomainSlices) => {
            if (state.conversation.pendingRequestId === pendingRequestId) {
              debugLog('setPendingRequestId:noop', { pendingRequestId });
              return state;
            }
            debugLog('setPendingRequestId', {
              previous: state.conversation.pendingRequestId,
              next: pendingRequestId,
            });
            return { conversation: { ...state.conversation, pendingRequestId } };
          }),
        setProcessingStage: (processingStage) =>
          set((state: DomainSlices) => {
            if (state.conversation.processingStage === processingStage) return state;
            return { conversation: { ...state.conversation, processingStage } };
          }),
        resetConversationState: () =>
          set((_state: DomainSlices) => {
            debugLog('resetConversationState');
            return { conversation: { ...createInitialState().conversation, messages: [] } };
          }),

        // Council slice actions
        startCouncil: (config: CouncilConfig) =>
          set((state: DomainSlices) => ({
            council: {
              ...state.council,
              isActive: true,
              config,
              phase: config.currentPhase ?? null,
              speaker: config.currentSpeaker ?? null,
              lastEventAt: new Date().toISOString(),
              error: null,
              currentMessage: '',
            },
          })),
        completeCouncil: () => set(() => ({ council: { ...createInitialState().council } })),
        setCouncilPhase: (phase: string | null) => set((state: DomainSlices) => ({ council: { ...state.council, phase, lastEventAt: new Date().toISOString() } })),
        setCouncilSpeaker: (speaker: string | null) => set((state: DomainSlices) => ({
          council: {
            ...state.council,
            speaker,
            config: state.council.config ? { ...state.council.config, currentSpeaker: speaker } : null,
            lastEventAt: new Date().toISOString()
          }
        } as Partial<DomainSlices>)),
        setCouncilError: (error: string | null) => set((state: DomainSlices) => ({ council: { ...state.council, error } })),
        resetCouncil: () => set(() => ({ council: { ...createInitialState().council } })),
        setCouncilConfig: (config: CouncilConfig | null) => set((state: DomainSlices) => ({ council: { ...state.council, config } })),
        setCouncilCurrentMessage: (message: string) =>
          set((state: DomainSlices) => ({
            council: {
              ...state.council,
              currentMessage: message,
              lastEventAt: new Date().toISOString(),
            },
          })),
        setCouncilAudioPlayback: (info) =>
          set((state: DomainSlices) => ({
            council: {
              ...state.council,
              audioPlayback: info,
            },
          })),

        // Quota slice actions (runtime-only, not persisted)
        setQuota: (used: number, limit: number, resetsAt: string) =>
          set((state: DomainSlices) => ({
            quota: { ...state.quota, used, limit, resetsAt, loaded: true },
          })),
        setEndpointQuota: (endpoint: 'council' | 'summary', used: number, limit: number) =>
          set((state: DomainSlices) => ({
            quota: { ...state.quota, [endpoint]: { used, limit, loaded: true } },
          })),
        setIsFreeTier: (isFreeTier: boolean) =>
          set((state: DomainSlices) => ({
            quota: { ...state.quota, isFreeTier },
          })),
        openRateLimitModal: (endpoint: 'chat' | 'council' | 'summary', resetsAt: string | null, limit: number | null = null) =>
          set(() => ({
            rateLimitModal: { isOpen: true, endpoint, resetsAt, limit },
          })),
        closeRateLimitModal: () =>
          set(() => ({
            rateLimitModal: { isOpen: false, endpoint: null, resetsAt: null, limit: null },
          })),
        openByokModal: (endpoint?: 'chat' | 'council' | 'summary', required = false) =>
          set(() => ({
            byokModal: { isOpen: true, triggerEndpoint: endpoint ?? null, required },
          })),
        closeByokModal: () =>
          set(() => ({
            byokModal: { isOpen: false, triggerEndpoint: null, required: false },
          })),
      }),
      {
        name: 'agora-cosmica-store',
        version: 1, // Increment when persisted schema changes — triggers migration
        migrate: (persistedState: any, _version: number) => {
          // Future migrations go here:
          // if (version === 0) { /* migrate v0 → v1 */ }
          return persistedState;
        },
        // Deep merge to preserve non-persisted nested fields (list, isLoading, error, etc.)
        merge: (persistedState, currentState) => {
          const persisted = persistedState as Partial<DomainSlices> | undefined;
          if (!persisted) return currentState;
          return {
            ...currentState,
            language: { ...currentState.language, ...(persisted.language ?? {}) },
            figures: { ...currentState.figures, ...(persisted.figures ?? {}) },
            seeds: { ...currentState.seeds, ...(persisted.seeds ?? {}) },
            mode: { ...currentState.mode, ...(persisted.mode ?? {}) },
            onboarding: { ...currentState.onboarding, ...(persisted.onboarding as any ?? {}) },
            hasVisitedBefore: persisted.hasVisitedBefore ?? currentState.hasVisitedBefore,
            serviceConfig: persisted.serviceConfig ?? currentState.serviceConfig,
            visited: persisted.visited ?? currentState.visited,
            visitDate: persisted.visitDate ?? currentState.visitDate,
            firstSelection: persisted.firstSelection ?? currentState.firstSelection,
            discoveryCount: persisted.discoveryCount ?? currentState.discoveryCount,
            german: persisted.german ?? currentState.german,
            english: persisted.english ?? currentState.english,
            openai: persisted.openai ?? currentState.openai,
            kokoro: persisted.kokoro ?? currentState.kokoro,
          };
        },
        partialize: (state) => ({
          // Language preferences and cached translations
          language: {
            current: state.language.current,
            uiTranslations: state.language.uiTranslations,
            seedTitlesTranslations: state.language.seedTitlesTranslations,
            helpersTranslations: state.language.helpersTranslations,
            // Exclude: isLoading, error (runtime only)
          },
          // Selected figure and seed
          figures: {
            selectedId: state.figures.selectedId,
            // Exclude: list, isLoading, error, lastFetchedAt (runtime only)
          },
          seeds: {
            selectedId: state.seeds.selectedId,
            byFigure: state.seeds.byFigure,
            // Exclude: isLoading, error (runtime only)
          },
          // Conversation mode preferences
          mode: {
            selected: state.mode.selected,
            preferences: state.mode.preferences,
            // Exclude: isCouncilMode (session state)
          },
          // UI preferences (from preferencesSlice)
          onboarding: state.onboarding,
          hasVisitedBefore: state.hasVisitedBefore,
          // userProfile excluded — PII must not be persisted as plaintext in localStorage
          serviceConfig: state.serviceConfig,
          // First visit tracking (from firstVisitSlice)
          visited: state.visited,
          visitDate: state.visitDate,
          firstSelection: state.firstSelection,
          discoveryCount: state.discoveryCount,
          // Voice preferences (from voicePreferencesSlice)
          german: state.german,
          english: state.english,
          openai: state.openai,
          kokoro: state.kokoro,
          // Exclude: session, conversation, council (all temporary runtime state)
        }),
      }
    )
  )
);
