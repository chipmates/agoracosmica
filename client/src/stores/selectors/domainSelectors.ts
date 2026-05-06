import { useMemo } from 'react';
import { useDomainStore, type DomainState } from '../domainStore';

// Explicitly type state parameter for TypeScript strict mode
export const useSessionState = () => useDomainStore((state: DomainState) => state.session);
export const useFiguresState = () => useDomainStore((state: DomainState) => state.figures);
export const useSeedsState = () => useDomainStore((state: DomainState) => state.seeds);
export const useModeState = () => useDomainStore((state: DomainState) => state.mode);
export const useConversationState = () => useDomainStore((state: DomainState) => state.conversation);
export const useCouncilState = () => useDomainStore((state: DomainState) => state.council);

export const useSessionActions = () => {
  const setSessionUser = useDomainStore((state: DomainState) => state.setSessionUser);
  const setSessionToken = useDomainStore((state: DomainState) => state.setSessionToken);
  const setSessionLanguage = useDomainStore((state: DomainState) => state.setSessionLanguage);
  const setAppConfig = useDomainStore((state: DomainState) => state.setAppConfig);
  const setAppLoading = useDomainStore((state: DomainState) => state.setAppLoading);
  const setAppError = useDomainStore((state: DomainState) => state.setAppError);
  const setStoryData = useDomainStore((state: DomainState) => state.setStoryData);
  const setFirstTextArrived = useDomainStore((state: DomainState) => state.setFirstTextArrived);
  const setTranslationInProgress = useDomainStore((state: DomainState) => state.setTranslationInProgress);
  const setAudioPlaying = useDomainStore((state: DomainState) => state.setAudioPlaying);
  const resetSession = useDomainStore((state: DomainState) => state.resetSession);

  return useMemo(
    () => ({
      setSessionUser,
      setSessionToken,
      setSessionLanguage,
      setAppConfig,
      setAppLoading,
      setAppError,
      setStoryData,
      setFirstTextArrived,
      setTranslationInProgress,
      setAudioPlaying,
      resetSession,
    }),
    [
      setSessionUser,
      setSessionToken,
      setSessionLanguage,
      setAppConfig,
      setAppLoading,
      setAppError,
      setStoryData,
      setFirstTextArrived,
      setTranslationInProgress,
      setAudioPlaying,
      resetSession,
    ]
  );
};

export const useFiguresActions = () => {
  const setFigures = useDomainStore((state: DomainState) => state.setFigures);
  const setFigureLoading = useDomainStore((state: DomainState) => state.setFigureLoading);
  const setFigureError = useDomainStore((state: DomainState) => state.setFigureError);
  const selectFigure = useDomainStore((state: DomainState) => state.selectFigure);
  const setFiguresFetchedAt = useDomainStore((state: DomainState) => state.setFiguresFetchedAt);

  return useMemo(
    () => ({
      setFigures,
      setFigureLoading,
      setFigureError,
      selectFigure,
      setFiguresFetchedAt,
    }),
    [setFigures, setFigureLoading, setFigureError, selectFigure, setFiguresFetchedAt]
  );
};

export const useSeedsActions = () => {
  const cacheSeedsForFigure = useDomainStore((state: DomainState) => state.cacheSeedsForFigure);
  const selectSeed = useDomainStore((state: DomainState) => state.selectSeed);
  const setSeedLoading = useDomainStore((state: DomainState) => state.setSeedLoading);
  const setSeedError = useDomainStore((state: DomainState) => state.setSeedError);
  const resetSeeds = useDomainStore((state: DomainState) => state.resetSeeds);

  return useMemo(
    () => ({
      cacheSeedsForFigure,
      selectSeed,
      setSeedLoading,
      setSeedError,
      resetSeeds,
    }),
    [cacheSeedsForFigure, selectSeed, setSeedLoading, setSeedError, resetSeeds]
  );
};

export const useModeActions = () => {
  const setMode = useDomainStore((state: DomainState) => state.setMode);
  const toggleCouncilMode = useDomainStore((state: DomainState) => state.toggleCouncilMode);
  const persistModePreference = useDomainStore((state: DomainState) => state.persistModePreference);
  const clearModePreference = useDomainStore((state: DomainState) => state.clearModePreference);
  const hydrateModePreferences = useDomainStore((state: DomainState) => state.hydrateModePreferences);
  const resetMode = useDomainStore((state: DomainState) => state.resetMode);

  return useMemo(
    () => ({
      setMode,
      toggleCouncilMode,
      persistModePreference,
      clearModePreference,
      hydrateModePreferences,
      resetMode,
    }),
    [
      setMode,
      toggleCouncilMode,
      persistModePreference,
      clearModePreference,
      hydrateModePreferences,
      resetMode,
    ]
  );
};

export const useConversationActions = () => {
  const setConversationMessages = useDomainStore((state: DomainState) => state.setConversationMessages);
  const appendConversationMessage = useDomainStore((state: DomainState) => state.appendConversationMessage);
  const setConversationStarted = useDomainStore((state: DomainState) => state.setConversationStarted);
  const setConversationHistoryKey = useDomainStore((state: DomainState) => state.setConversationHistoryKey);
  const setPendingRequestId = useDomainStore((state: DomainState) => state.setPendingRequestId);
  const resetConversationState = useDomainStore((state: DomainState) => state.resetConversationState);

  return useMemo(
    () => ({
      setConversationMessages,
      appendConversationMessage,
      setConversationStarted,
      setConversationHistoryKey,
      setPendingRequestId,
      resetConversationState,
    }),
    [
      setConversationMessages,
      appendConversationMessage,
      setConversationStarted,
      setConversationHistoryKey,
      setPendingRequestId,
      resetConversationState,
    ]
  );
};

export const useCouncilActions = () => {
  const startCouncil = useDomainStore((state: DomainState) => state.startCouncil);
  const completeCouncil = useDomainStore((state: DomainState) => state.completeCouncil);
  const setCouncilPhase = useDomainStore((state: DomainState) => state.setCouncilPhase);
  const setCouncilSpeaker = useDomainStore((state: DomainState) => state.setCouncilSpeaker);
  const setCouncilError = useDomainStore((state: DomainState) => state.setCouncilError);
  const resetCouncil = useDomainStore((state: DomainState) => state.resetCouncil);
  const setCouncilConfig = useDomainStore((state: DomainState) => state.setCouncilConfig);
  const setCouncilCurrentMessage = useDomainStore((state: DomainState) => state.setCouncilCurrentMessage);

  return useMemo(
    () => ({
      startCouncil,
      completeCouncil,
      setCouncilPhase,
      setCouncilSpeaker,
      setCouncilError,
      resetCouncil,
      setCouncilConfig,
      setCouncilCurrentMessage,
    }),
    [
      startCouncil,
      completeCouncil,
      setCouncilPhase,
      setCouncilSpeaker,
      setCouncilError,
      resetCouncil,
      setCouncilConfig,
      setCouncilCurrentMessage,
    ]
  );
};
