import { useEffect, useRef } from 'react';
import { cleanupAudioResources } from '../services/audioService';
import { LocalStorageAdapter } from '../storage/localAdapter';
import type { Figure, Seed } from '../types/global';

interface UseConversationEffectsParams {
  selectedFigure: Figure | null;
  selectedSeed: Seed | null;
  selectedMode: string;
  conversationMessages: any[];
  language: string;
  addMessage: (message: any) => void;
  loadMessagesFromHistory: (messages: any[]) => void;
  resetConversation: () => void;
  fetchHistory: (figureId: string, seedId: string | number) => void;
  getHistoryKey: (figureId: string, seedId: string | number) => string;
  setFirstTextArrived: (value: boolean) => void;
  setLoading: (value: boolean) => void;
  setTranslationInProgress: (value: boolean) => void;
  setIsAudioPlaying: (value: boolean) => void;
  setStoryData: (data: any) => void;
  setConversationStarted: (value: boolean) => void;
}

export const useConversationEffects = (params: UseConversationEffectsParams) => {
  const {
    selectedFigure,
    selectedSeed,
    conversationMessages,
    addMessage,
    loadMessagesFromHistory,
    resetConversation,
    fetchHistory,
    getHistoryKey,
    setFirstTextArrived,
    setLoading,
    setTranslationInProgress,
    setIsAudioPlaying,
    setStoryData,
  } = params;

  const assistantMessageCountRef = useRef(0);

  // Event handlers for audio and conversation events
  useEffect(() => {
    const handleAudioStart = () => {
      setTranslationInProgress(false);
      setIsAudioPlaying(true);
    };

    const handleAudioEnd = () => {
      setTranslationInProgress(false);
      setIsAudioPlaying(false);
    };

    const handleStoryRefreshed = (event: any) => {
      const { storyData: refreshedStoryData, figure, seedId } = event.detail;

      const figureMatches = figure === selectedFigure?.name;
      const seedMatches = !selectedSeed || String(seedId) === String(selectedSeed?.id);

      if (refreshedStoryData && figureMatches && seedMatches) {
        setStoryData(refreshedStoryData);
      }
    };

    const handleAppReset = () => {
      setStoryData(null);
      resetConversation();
      setLoading(false);

      if (selectedFigure && selectedSeed) {
        void fetchHistory(selectedFigure.id, selectedSeed.id);
      }

      cleanupAudioResources();
    };

    const handleHistoryRestored = () => {
      if (selectedFigure && selectedSeed) {
        void fetchHistory(selectedFigure.id, selectedSeed.id);

        const storageKey = getHistoryKey(selectedFigure.id, selectedSeed.id);
        const historyData = LocalStorageAdapter.getString(storageKey);

        if (historyData) {
          const parsedHistory = JSON.parse(historyData);
          if (Array.isArray(parsedHistory) && parsedHistory.length > 0) {
            loadMessagesFromHistory(parsedHistory);
          }
        }
      }
    };

    window.addEventListener('storyRefreshed', handleStoryRefreshed);
    window.addEventListener('app:reset-state', handleAppReset);
    window.addEventListener('app:history-restored', handleHistoryRestored);
    window.addEventListener('audioStart', handleAudioStart);
    window.addEventListener('audioEnd', handleAudioEnd);

    return () => {
      window.removeEventListener('storyRefreshed', handleStoryRefreshed);
      window.removeEventListener('app:reset-state', handleAppReset);
      window.removeEventListener('app:history-restored', handleHistoryRestored);
      window.removeEventListener('audioStart', handleAudioStart);
      window.removeEventListener('audioEnd', handleAudioEnd);
    };
  }, [
    addMessage,
    selectedFigure?.name,
    selectedSeed?.id,
    setFirstTextArrived,
    setLoading,
    setTranslationInProgress,
    setIsAudioPlaying,
    setStoryData,
    resetConversation,
    fetchHistory,
    loadMessagesFromHistory,
    getHistoryKey,
  ]);

  // Track assistant message count for loading state management
  useEffect(() => {
    const assistantCount = conversationMessages.reduce((count, message) => {
      return message.role === 'assistant' ? count + 1 : count;
    }, 0);

    if (assistantCount > assistantMessageCountRef.current) {
      assistantMessageCountRef.current = assistantCount;
      setFirstTextArrived(true);
      setLoading(false);
      setTranslationInProgress(false);
    } else if (assistantCount === 0) {
      assistantMessageCountRef.current = 0;
    }
  }, [
    conversationMessages,
    setFirstTextArrived,
    setLoading,
    setTranslationInProgress,
  ]);

  // Handle conversation:assistant-chunk events
  useEffect(() => {
    const handleAssistantChunk = () => {
      setFirstTextArrived(true);
      setLoading(false);
      setTranslationInProgress(false);
    };

    window.addEventListener('conversation:assistant-chunk', handleAssistantChunk);

    return () => {
      window.removeEventListener('conversation:assistant-chunk', handleAssistantChunk);
    };
  }, [setFirstTextArrived, setLoading, setTranslationInProgress]);

  // Story loading is handled entirely by useModeManager.handleLanguageAutoSelect
  // (called via handleModeSelect from Effect#14 on page refresh, or from handleSeedSelect).
  // Previously this effect also tried to restore stories, causing AbortError races.
};
