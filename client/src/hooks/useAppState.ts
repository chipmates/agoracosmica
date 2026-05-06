import { useSessionActions, useSessionState } from '../stores';
import { Language } from '../types/global';

interface ServiceConfig {
  [key: string]: any;
}

interface StoryData {
  [key: string]: any;
}

export interface AppState {
  // Config
  config: ServiceConfig;
  setConfig: (config: ServiceConfig) => void;

  // Loading/Error
  loading: boolean;
  setLoading: (loading: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;

  // Story
  storyData: StoryData | null;
  setStoryData: (data: StoryData | null) => void;
  firstTextArrived: boolean;
  setFirstTextArrived: (arrived: boolean) => void;
  translationInProgress: boolean;
  setTranslationInProgress: (inProgress: boolean) => void;

  // Audio
  isAudioPlaying: boolean;
  setIsAudioPlaying: (playing: boolean) => void;

  // Language
  languageSelected: string | null;
  setLanguageSelected: (language: Language | null) => void;
}

/**
 * Hook for managing application-wide UI state
 * Consolidates loading, error, story, and translation states
 * Uses Zustand session store (appStateAdapter removed)
 *
 * @returns Application state and setters
 */
export function useAppState(): AppState {
  const session = useSessionState();
  const {
    setAppConfig,
    setAppLoading,
    setAppError,
    setStoryData,
    setFirstTextArrived,
    setTranslationInProgress,
    setAudioPlaying,
    setSessionLanguage,
  } = useSessionActions();

  return {
    config: session.config,
    setConfig: setAppConfig,
    loading: session.loading,
    setLoading: setAppLoading,
    error: session.error,
    setError: setAppError,
    storyData: session.storyData,
    setStoryData,
    firstTextArrived: session.firstTextArrived,
    setFirstTextArrived,
    translationInProgress: session.translationInProgress,
    setTranslationInProgress,
    isAudioPlaying: session.isAudioPlaying,
    setIsAudioPlaying: setAudioPlaying,
    languageSelected: session.language,
    setLanguageSelected: setSessionLanguage,
  };
}
