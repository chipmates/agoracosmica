import { useMemo } from 'react';
import { useAppState } from '../hooks/useAppState';

interface AppStateSlice {
  config: ReturnType<typeof useAppState>['config'];
  loading: boolean;
  error: string | null;
  storyData: ReturnType<typeof useAppState>['storyData'];
  firstTextArrived: boolean;
  translationInProgress: boolean;
  isAudioPlaying: boolean;
  languageSelected: string | null;
}

interface AppStateActions {
  setConfig: ReturnType<typeof useAppState>['setConfig'];
  setLoading: ReturnType<typeof useAppState>['setLoading'];
  setError: ReturnType<typeof useAppState>['setError'];
  setStoryData: ReturnType<typeof useAppState>['setStoryData'];
  setFirstTextArrived: ReturnType<typeof useAppState>['setFirstTextArrived'];
  setTranslationInProgress: ReturnType<typeof useAppState>['setTranslationInProgress'];
  setIsAudioPlaying: ReturnType<typeof useAppState>['setIsAudioPlaying'];
  setLanguageSelected: ReturnType<typeof useAppState>['setLanguageSelected'];
}

interface UseAppStateVMResult {
  state: AppStateSlice;
  actions: AppStateActions;
}

export function useAppStateVM(): UseAppStateVMResult {
  const {
    config,
    setConfig,
    loading,
    setLoading,
    error,
    setError,
    storyData,
    setStoryData,
    firstTextArrived,
    setFirstTextArrived,
    translationInProgress,
    setTranslationInProgress,
    isAudioPlaying,
    setIsAudioPlaying,
    languageSelected,
    setLanguageSelected
  } = useAppState();

  return useMemo(
    () => ({
      state: {
        config,
        loading,
        error,
        storyData,
        firstTextArrived,
        translationInProgress,
        isAudioPlaying,
        languageSelected
      },
      actions: {
        setConfig,
        setLoading,
        setError,
        setStoryData,
        setFirstTextArrived,
        setTranslationInProgress,
        setIsAudioPlaying,
        setLanguageSelected
      }
    }),
    [
      config,
      loading,
      error,
      storyData,
      firstTextArrived,
      translationInProgress,
      isAudioPlaying,
      languageSelected,
      setConfig,
      setLoading,
      setError,
      setStoryData,
      setFirstTextArrived,
      setTranslationInProgress,
      setIsAudioPlaying,
      setLanguageSelected
    ]
  );
}

// Re-export type for ease of import in future refactors
export type AppStateVM = ReturnType<typeof useAppStateVM>;
