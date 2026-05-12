import { useMemo, useCallback } from 'react';
import { useConversationActions, useConversationState } from '../stores';
import { getStorageKeyForMode } from '../utils/storageKeysV2';
import { useAppState } from '../hooks/useAppState';
import { Figure, Seed, ConversationMode } from '../types/global';
import type { ConversationMessage } from '../stores/slices/domainTypes';

type StoryData = ReturnType<typeof useAppState>['storyData'];

interface ConversationVMParams {
  selectedFigure: Figure | null;
  selectedSeed: Seed | null;
  selectedMode: ConversationMode;
  isCouncilMode: boolean;
  storyData: StoryData;
  processSeedAcquisitionFromMessage?: (content: string) => void;
}

interface ConversationStateSlice {
  messages: ConversationMessage[];
  conversationStarted: boolean;
  derivedConversationStarted: boolean;
}

interface ConversationActions {
  addMessage: (message: Partial<ConversationMessage>) => void;
  clearMessages: () => void;
  loadMessagesFromHistory: (history: ConversationMessage[] | null) => void;
  resetConversation: () => void;
  setMessages: (messages: ConversationMessage[]) => void;
  setConversationStarted: (started: boolean) => void;
}

interface ConversationHelpers {
  mergeChunks: (previous: string, chunk: string) => string;
  getHistoryKey: (figureId: string, seedId: string | number) => string;
}

interface UseConversationVMResult {
  state: ConversationStateSlice;
  actions: ConversationActions;
  helpers: ConversationHelpers;
}

// Helper: Merge assistant message chunks intelligently
const mergeAssistantChunks = (previous: string, chunk: string): string => {
  let prevText = previous ?? '';
  if (!prevText) {
    return chunk;
  }

  if (prevText.trim().endsWith(',')) {
    return `${prevText} ${chunk.trim()}`;
  }

  if (!/[ \n\r\t.,;:!?]$/.test(prevText)) {
    prevText += ' ';
  }

  if (/^(- |\* |[0-9]+\.\s+)/.test(chunk)) {
    prevText += '\n';
  }

  return prevText + chunk;
};

export function useConversationVM(params: ConversationVMParams): UseConversationVMResult {
  const { selectedFigure, selectedSeed, selectedMode, isCouncilMode, storyData, processSeedAcquisitionFromMessage } = params;

  // Direct Zustand access (removed conversationAdapter + conversationFlowAdapter)
  const conversationState = useConversationState();
  const {
    setConversationMessages,
    setConversationStarted: setConversationStartedAction,
    resetConversationState,
  } = useConversationActions();

  const messages = conversationState.messages;
  const conversationStarted = conversationState.started;

  // Derived conversation started state (from conversationFlowAdapter)
  const derivedConversationStarted = useMemo(() => {
    if (selectedMode === ConversationMode.INTRODUCTION) {
      return Boolean(storyData?.text);
    }

    // Prism is always "started" — it renders its own player, no conversation needed
    if (selectedMode === ConversationMode.PRISM) {
      return true;
    }

    if (isCouncilMode) {
      return true;
    }

    if (
      selectedMode === ConversationMode.SEED_CONVERSATION ||
      selectedMode === ConversationMode.CHALLENGE ||
      selectedMode === ConversationMode.FREE_CONVERSATION
    ) {
      return true;
    }

    return messages.length > 0;
  }, [isCouncilMode, messages.length, selectedMode, storyData?.text]);

  // Clear messages (from conversationFlowAdapter)
  const clearMessages = useCallback(() => {
    setConversationMessages([]);
    setConversationStartedAction(false);
  }, [setConversationStartedAction, setConversationMessages]);

  // Load messages from history (from conversationFlowAdapter)
  const loadMessagesFromHistory = useCallback(
    (history: ConversationMessage[] | null) => {
      const normalized = Array.isArray(history) ? history : [];
      const isSameLength = messages.length === normalized.length;
      let isSameContent = isSameLength;

      if (isSameLength) {
        for (let index = 0; index < messages.length; index += 1) {
          if (messages[index] !== normalized[index]) {
            isSameContent = false;
            break;
          }
        }
      }

      if (isSameContent) {
        return;
      }

      setConversationMessages(normalized);
      setConversationStartedAction(normalized.length > 0);
    },
    [messages, setConversationStartedAction, setConversationMessages]
  );

  // Add message (from conversationFlowAdapter)
  const addMessage = useCallback(
    (message: Partial<ConversationMessage>) => {
      if (!message || typeof message.content !== 'string') {
        return;
      }

      if (!selectedSeed && message.role !== 'council') {
        return;
      }

      if (isCouncilMode && message.role === 'assistant') {
        return;
      }

      const nextMessages = [...messages];
      const lastMessage = nextMessages[nextMessages.length - 1];
      let updatedContent = message.content ?? '';

      if (lastMessage && lastMessage.role === message.role && message.role === 'assistant') {
        updatedContent = mergeAssistantChunks(lastMessage.content, message.content ?? '');
        nextMessages[nextMessages.length - 1] = {
          ...lastMessage,
          content: updatedContent,
          timestamp: new Date().toISOString(),
        };
      } else {
        // user submissions are atomic; never merge user-after-user (post-failed-send case)
        nextMessages.push({
          role: (message.role ?? 'assistant') as ConversationMessage['role'],
          content: message.content ?? '',
          figureName: message.figureName ?? selectedFigure?.name,
          speaker: message.speaker,
          timestamp: message.timestamp ?? new Date().toISOString(),
          mode: message.mode ?? selectedMode,
        });
      }

      if (message.role === 'assistant' && processSeedAcquisitionFromMessage) {
        processSeedAcquisitionFromMessage(updatedContent);
      }

      setConversationMessages(nextMessages);
      setConversationStartedAction(true);
    },
    [
      isCouncilMode,
      messages,
      processSeedAcquisitionFromMessage,
      selectedFigure?.name,
      selectedMode,
      selectedSeed,
      setConversationStartedAction,
      setConversationMessages,
    ]
  );

  // Reset conversation (from conversationAdapter)
  const resetConversation = useCallback(() => {
    resetConversationState();
  }, [resetConversationState]);

  // Get history key (from conversationAdapter)
  const getHistoryKey = useCallback((figureId: string, seedId: string | number) => {
    return getStorageKeyForMode(selectedMode, figureId, seedId) ?? '';
  }, [selectedMode]);

  // Build structured return (original VM pattern)
  const state = useMemo<ConversationStateSlice>(
    () => ({
      messages,
      conversationStarted,
      derivedConversationStarted
    }),
    [messages, conversationStarted, derivedConversationStarted]
  );

  const actions = useMemo<ConversationActions>(
    () => ({
      addMessage,
      clearMessages,
      loadMessagesFromHistory,
      resetConversation,
      setMessages: setConversationMessages,
      setConversationStarted: setConversationStartedAction
    }),
    [
      addMessage,
      clearMessages,
      loadMessagesFromHistory,
      resetConversation,
      setConversationMessages,
      setConversationStartedAction
    ]
  );

  const helpers = useMemo<ConversationHelpers>(
    () => ({
      mergeChunks: mergeAssistantChunks,
      getHistoryKey
    }),
    [getHistoryKey]
  );

  return useMemo(
    () => ({
      state,
      actions,
      helpers
    }),
    [state, actions, helpers]
  );
}

export type ConversationVM = ReturnType<typeof useConversationVM>;
