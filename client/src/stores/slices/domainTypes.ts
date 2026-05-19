import { ConversationMode, Figure, Message, Seed, User, Language } from '../../types/global';
import type { LanguageSlice } from './languageSlice';

type ServiceConfig = Record<string, unknown>;
type StoryData = Record<string, unknown> | null;

export interface SessionSliceState {
  session: {
    user: User | null;
    token: string | null;
    language: Language | null;
    config: ServiceConfig;
    loading: boolean;
    error: string | null;
    storyData: StoryData;
    firstTextArrived: boolean;
    translationInProgress: boolean;
    isAudioPlaying: boolean;
  };
}

export interface SessionSliceActions {
  setSessionUser: (user: User | null) => void;
  setSessionToken: (token: string | null) => void;
  setSessionLanguage: (language: Language | null) => void;
  setAppConfig: (config: ServiceConfig) => void;
  setAppLoading: (loading: boolean) => void;
  setAppError: (error: string | null) => void;
  setStoryData: (storyData: StoryData) => void;
  setFirstTextArrived: (arrived: boolean) => void;
  setTranslationInProgress: (inProgress: boolean) => void;
  setAudioPlaying: (playing: boolean) => void;
  resetSession: () => void;
}

export type SessionSlice = SessionSliceState & SessionSliceActions;

export interface FiguresSliceState {
  figures: {
    list: Figure[];
    selectedId: string | null;
    isLoading: boolean;
    error: string | null;
    lastFetchedAt: string | null;
  };
}

export interface FiguresSliceActions {
  setFigures: (figures: Figure[]) => void;
  setFigureLoading: (loading: boolean) => void;
  setFigureError: (error: string | null) => void;
  selectFigure: (figureId: string | null) => void;
  setFiguresFetchedAt: (isoDate: string | null) => void;
}

export type FiguresSlice = FiguresSliceState & FiguresSliceActions;

export interface SeedsSliceState {
  seeds: {
    byFigure: Record<string, Seed[]>;
    selectedId: string | null;
    isLoading: boolean;
    error: string | null;
  };
}

export interface SeedsSliceActions {
  cacheSeedsForFigure: (figureId: string, seeds: Seed[]) => void;
  selectSeed: (seedId: string | number | null) => void;
  setSeedLoading: (loading: boolean) => void;
  setSeedError: (error: string | null) => void;
  resetSeeds: () => void;
}

export type SeedsSlice = SeedsSliceState & SeedsSliceActions;

export interface ModeSliceState {
  mode: {
    selected: ConversationMode;
    isCouncilMode: boolean;
    preferences: Record<string, ConversationMode>;
  };
}

export interface ModeSliceActions {
  setMode: (mode: ConversationMode) => void;
  toggleCouncilMode: (enabled: boolean) => void;
  persistModePreference: (figureId: string, seedId: string | number, mode: ConversationMode) => void;
  clearModePreference: (figureId: string, seedId: string | number) => void;
  hydrateModePreferences: (preferences: Record<string, ConversationMode>) => void;
  resetMode: () => void;
}

export type ModeSlice = ModeSliceState & ModeSliceActions;

export interface ConversationMessage extends Omit<Message, 'role'> {
  role: 'user' | 'assistant' | 'council';
  figureName?: string;
  speaker?: string;
}

/** Pipeline phase the currently-pending request is in. Drives the ProcessingLoader. */
export type ProcessingStage = 'preparing' | 'hearing' | 'contemplating' | 'shaping';

export interface ConversationSliceState {
  conversation: {
    messages: ConversationMessage[];
    started: boolean;
    historyKey: string | null;
    pendingRequestId: string | null;
    processingStage: ProcessingStage | null;
    lastUpdatedAt: string | null;
  };
}

export interface ConversationSliceActions {
  setConversationMessages: (messages: ConversationMessage[]) => void;
  appendConversationMessage: (message: ConversationMessage) => void;
  setConversationStarted: (started: boolean) => void;
  setConversationHistoryKey: (key: string | null) => void;
  setPendingRequestId: (requestId: string | null) => void;
  setProcessingStage: (stage: ProcessingStage | null) => void;
  resetConversationState: () => void;
}

export type ConversationSlice = ConversationSliceState & ConversationSliceActions;

export interface CouncilConfig {
  moderator?: string;
  participants?: string[];
  currentPhase?: string;
  currentSpeaker?: string;
  title?: string;
  councilType?: string;
  mode?: string;
  isCompleted?: boolean;
  question?: string;
  councilTitle?: string;
  councilImage?: string;
  type?: string;
}

export interface AudioPlaybackInfo {
  speakerId: string;
  content: string;
  duration: number;
  startedAt: number;
}

export interface CouncilSliceState {
  council: {
    isActive: boolean;
    config: CouncilConfig | null;
    phase: string | null;
    speaker: string | null;
    lastEventAt: string | null;
    error: string | null;
    currentMessage: string;
    audioPlayback: AudioPlaybackInfo | null;
  };
}

export interface CouncilSliceActions {
  startCouncil: (config: CouncilConfig) => void;
  completeCouncil: () => void;
  setCouncilPhase: (phase: string | null) => void;
  setCouncilSpeaker: (speaker: string | null) => void;
  setCouncilError: (error: string | null) => void;
  resetCouncil: () => void;
  setCouncilConfig: (config: CouncilConfig | null) => void;
  setCouncilCurrentMessage: (message: string) => void;
  setCouncilAudioPlayback: (info: AudioPlaybackInfo | null) => void;
}

export type CouncilSlice = CouncilSliceState & CouncilSliceActions;

// Re-export LanguageSlice types from languageSlice
export type { LanguageSlice, LanguageSliceState, LanguageSliceActions } from './languageSlice';

// Re-export PreferencesSlice types from preferencesSlice
export type { PreferencesSlice, PreferencesState, PreferencesActions } from './preferencesSlice';

// Re-export FirstVisitSlice types from firstVisitSlice
export type { FirstVisitSlice, FirstVisitState, FirstVisitActions } from './firstVisitSlice';

// Re-export VoicePreferencesSlice types from voicePreferencesSlice
export type { VoicePreferencesSlice, VoicePreferencesState, VoicePreferencesActions } from './voicePreferencesSlice';

// Quota slice (free-tier daily message tracking, runtime-only, NOT persisted)
export type RateLimitEndpoint = 'chat' | 'council' | 'summary';

export interface QuotaSliceState {
  quota: {
    // Chat (legacy fields drive the visible turn-counter)
    used: number;
    limit: number;
    resetsAt: string | null;
    isFreeTier: boolean;
    loaded: boolean;
    // Per-endpoint quotas — populated by /v1/quota on app init and by 429/X-* headers afterward.
    // Used to gate the Start Council and Generate Summary buttons individually.
    council: { used: number; limit: number; loaded: boolean };
    summary: { used: number; limit: number; loaded: boolean };
  };
  rateLimitModal: {
    isOpen: boolean;
    endpoint: RateLimitEndpoint | null;
    resetsAt: string | null;
    limit: number | null; // server-side cap from 429 body; null → fall back to UI default
  };
  byokModal: {
    isOpen: boolean;
    triggerEndpoint: RateLimitEndpoint | null;
    // required: true when opened as the self-host key gate. The modal then
    // hides its dismiss controls until a valid key is saved.
    required: boolean;
  };
}

export interface QuotaSliceActions {
  setQuota: (used: number, limit: number, resetsAt: string) => void;
  setEndpointQuota: (endpoint: 'council' | 'summary', used: number, limit: number) => void;
  setIsFreeTier: (isFreeTier: boolean) => void;
  openRateLimitModal: (endpoint: RateLimitEndpoint, resetsAt: string | null, limit?: number | null) => void;
  closeRateLimitModal: () => void;
  openByokModal: (endpoint?: RateLimitEndpoint, required?: boolean) => void;
  closeByokModal: () => void;
}

export type QuotaSlice = QuotaSliceState & QuotaSliceActions;

export type DomainSlices =
  & SessionSlice
  & FiguresSlice
  & SeedsSlice
  & ModeSlice
  & ConversationSlice
  & CouncilSlice
  & QuotaSlice
  & LanguageSlice
  & import('./preferencesSlice').PreferencesSlice
  & import('./firstVisitSlice').FirstVisitSlice
  & import('./voicePreferencesSlice').VoicePreferencesSlice;
