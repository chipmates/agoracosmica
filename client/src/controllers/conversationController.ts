import { useDomainStore } from '../stores';
import type { ConversationMessage } from '../stores/slices/domainTypes';
import { createRequestGate } from '../utils/async/requestGate';
import { abortable, type AbortableTask } from '../utils/async/abortable';
import { getStorageKeyForMode, markWisdomCompleted } from '../utils/storageKeysV2';
import { LocalStorageAdapter } from '../storage/localAdapter';
import { runWithWal, getFromStore, type WalOperation } from '../storage';
// Note: avoid runtime enum dependency for isConversationMode checks
import type { ConversationMode } from '../types/global';
import { normalizeMode } from '../utils/modeUtils';

export interface StreamConversationParams {
  requestId: string;
  threadKey: string | null;
  messages: ConversationMessage[];
  signal: AbortSignal;
  pushAssistantText: (chunk: string) => void;
}

export interface ConversationControllerDeps {
  hydrateHistory?: (threadKey: string | null) => Promise<void> | void;
  persistMessages?: (threadKey: string | null, messages: ConversationMessage[]) => Promise<void> | void;
  onStreamingStarted?: (threadKey: string | null, requestId: string) => void;
  onStreamingComplete?: (
    threadKey: string | null,
    requestId: string,
    outcome: 'success' | 'aborted' | 'error',
    error?: unknown
  ) => void;
  streamConversation?: (params: StreamConversationParams) => Promise<void> | void;
}

const isConversationMode = (mode: ConversationMode | string | null | undefined): boolean => {
  const m = normalizeMode(mode);
  return m === 'seed_conversation' || m === 'challenge' || m === 'free_conversation';
};

const mergeChunks = (previous: string, chunk: string): string => {
  let prevText = previous ?? '';
  if (!prevText) {
    return chunk;
  }

  if (prevText.trim().endsWith(',')) {
    return `${prevText} ${chunk.trim()}`;
  }

  if (/[.!?]$/.test(prevText) && /^[A-ZÄÖÜ]/.test(chunk)) {
    prevText += ' ';
  } else if (!/[ \n\r\t.,;:!?]$/.test(prevText)) {
    prevText += ' ';
  }

  if (/^(- |\* |[0-9]+\.\s+)/.test(chunk)) {
    prevText += '\n';
  }

  return prevText + chunk;
};

const loadHistoryFromStorage = async (threadKey: string): Promise<ConversationMessage[] | null> => {
  if (!threadKey) {
    return null;
  }

  try {
    const stored = await getFromStore<ConversationMessage[]>('history', threadKey);
    if (Array.isArray(stored)) {
      return stored;
    }
  } catch (error) {
    console.error('[ConversationController] Failed to read history from IndexedDB', error);
  }

  const fallback = LocalStorageAdapter.getJSON<ConversationMessage[] | null>(threadKey, null);
  return Array.isArray(fallback) ? fallback : null;
};

const persistHistoryToStorage = async (threadKey: string, messages: ConversationMessage[]) => {
  const operations: WalOperation[] = [{ type: 'put', store: 'history', key: threadKey, value: messages }];
  await runWithWal(operations, async () => undefined);
};

export const createConversationController = (deps: ConversationControllerDeps = {}) => {
  const subscriptions: Array<() => void> = [];
  const historyGate = createRequestGate();
  let handlers: ConversationControllerDeps = { ...deps };
  let activeRequestId: string | null = null;
  let streamTask: AbortableTask<void> | null = null;
  let lastPersistedSnapshot: { key: string | null; checksum: string } = { key: null, checksum: '' };
  let isHydrating = false;

const applyAssistantChunk = (chunk: string) => {
  // 🎯 CRITICAL: Get fresh state on EVERY call to see previous chunks
  const store = useDomainStore.getState();
  const messages = store.conversation.messages;  // Don't destructure - get fresh array reference

  // Create a synthetic assistant message when the first chunk arrives
  if (messages.length === 0 || messages[messages.length - 1]?.role !== 'assistant') {
    if (import.meta.env.DEV) {
      console.log('[ConversationController] applyAssistantChunk → create NEW assistant message', {
        existingMessages: messages.length,
        chunkPreview: chunk.substring(0, 100),
        chunkLength: chunk.length
      });
    }
    const message = {
      role: 'assistant',
      content: chunk,
      timestamp: new Date().toISOString(),
    } satisfies ConversationMessage;
    store.appendConversationMessage(message);
    store.setConversationStarted(true);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('conversation:assistant-chunk', {
          detail: { message },
        })
      );
    }
    if (import.meta.env.DEV) {
      // Get fresh state to confirm append worked
      const freshState = useDomainStore.getState();
      console.log('[ConversationController] ✅ Created first assistant message, total messages:', freshState.conversation.messages.length);
    }
    return;
  }

    // Merge with existing assistant message
    const lastIndex = messages.length - 1;
    const lastMessage = messages[lastIndex];
    const mergedContent = mergeChunks(lastMessage.content, chunk);

    if (import.meta.env.DEV) {
      console.log('[ConversationController] applyAssistantChunk → MERGE with existing', {
        existingMessages: messages.length,
        lastMessageLength: lastMessage.content.length,
        chunkLength: chunk.length,
        mergedLength: mergedContent.length
      });
    }

    const updated = [...messages];
    updated[lastIndex] = {
      ...lastMessage,
      content: mergedContent,
      timestamp: new Date().toISOString(),
    };
    store.setConversationMessages(updated);
    store.setConversationStarted(true);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('conversation:assistant-chunk', {
          detail: { message: updated[lastIndex] },
        })
      );
    }
  };

  const persistIfChanged = async (
    threadKey: string,
    mode: ConversationMode | string,
    messages: ConversationMessage[]
  ) => {
    if (!threadKey || !isConversationMode(mode)) {
      if (import.meta.env.DEV) {
        console.log('[ConversationController] skip persist - non conversation mode', { mode, threadKey });
      }
      return;
    }

    const store = useDomainStore.getState();
    if (store.mode.isCouncilMode) {
      if (import.meta.env.DEV) {
        console.log('[ConversationController] skip persist - council mode active');
      }
      return;
    }

    const checksum = JSON.stringify(messages);
    if (import.meta.env.DEV) {
      console.log('[ConversationController] persistIfChanged → evaluating', {
        threadKey,
        mode,
        messageCount: messages.length,
      });
    }
    if (lastPersistedSnapshot.key === threadKey && lastPersistedSnapshot.checksum === checksum) {
      if (import.meta.env.DEV) {
        console.log('[ConversationController] skip persist - snapshot unchanged', { threadKey, mode });
      }
      return;
    }

    if (import.meta.env.DEV) {
      console.log('[ConversationController] Persisting history', { threadKey, count: messages.length });
    }
    await persistHistoryToStorage(threadKey, messages);
    await Promise.resolve(handlers.persistMessages?.(threadKey, messages));
    lastPersistedSnapshot = { key: threadKey, checksum };

    // Wisdom (seed_conversation) bloom trigger: once the user has reached the
    // depth threshold (30 messages = 15 exchanges) on a starseed_ thread, set the
    // completion marker. markWisdomCompleted is idempotent and dispatches the
    // bloomModeCompleted event the first time the marker flips, so the homepage
    // PostDialogueBloomInvite fires for wisdom the same way it does for story / prism / quest.
    if (threadKey.startsWith('starseed_') && messages.length >= 30) {
      const rest = threadKey.slice('starseed_'.length);
      const lastUnderscore = rest.lastIndexOf('_');
      if (lastUnderscore > 0) {
        const figureId = rest.slice(0, lastUnderscore);
        const seedId = rest.slice(lastUnderscore + 1);
        if (figureId && seedId) {
          markWisdomCompleted(figureId, seedId);
        }
      }
    }
  };

  const updateThreadForSelection = async (
    selection: { figureId: string | null; seedId: string | null; mode: ConversationMode }
  ) => {
    const { figureId, seedId, mode } = selection;

    // Abort any in-flight stream when selection changes — prevents stale data
    if (streamTask) {
      if (import.meta.env.DEV) {
        console.log('[ConversationController] updateThreadForSelection → aborting active stream');
      }
      streamTask.abort();
      streamTask = null;
      activeRequestId = null;
    }

    if (import.meta.env.DEV) {
      console.log('[ConversationController] updateThreadForSelection → received selection', {
        figureId,
        seedId,
        mode,
      });
    }

    // Prism mode uses pre-generated content — skip all conversation management
    if (mode === 'prism') {
      if (import.meta.env.DEV) {
        console.log('[ConversationController] updateThreadForSelection → skipping prism mode (no conversation)');
      }
      return;
    }

    if (!figureId || !seedId || !isConversationMode(mode)) {
      lastPersistedSnapshot = { key: null, checksum: '' };
      const store = useDomainStore.getState();
      store.setConversationHistoryKey(null);
      store.setConversationMessages([]);
      store.setConversationStarted(false);
      if (import.meta.env.DEV) {
        console.log('[ConversationController] updateThreadForSelection → reset conversation state', {
          figureId,
          seedId,
          mode,
        });
      }
      return;
    }

    const nextThreadKey = getStorageKeyForMode(mode, figureId, seedId) ?? null;
    if (import.meta.env.DEV) {
      console.log('[ConversationController] updateThreadForSelection', { figureId, seedId, mode, nextThreadKey });
    }
    const store = useDomainStore.getState();

    // Begin hydration phase to suppress persistence during transition
    isHydrating = true;

    if (!nextThreadKey) {
      store.setConversationMessages([]);
      store.setConversationStarted(true);
      lastPersistedSnapshot = { key: null, checksum: '' };
      if (import.meta.env.DEV) {
        console.log('[ConversationController] updateThreadForSelection → no thread key generated', {
          figureId,
          seedId,
          mode,
        });
      }
      isHydrating = false;
      return;
    }

    // If the thread key is already set correctly, check if we still need to load history
    const prevThreadKey = useDomainStore.getState().conversation.historyKey;
    const currentMessages = useDomainStore.getState().conversation.messages;

    if (prevThreadKey === nextThreadKey && currentMessages.length > 0) {
      // Thread unchanged AND we have messages - no need to reload
      isHydrating = false;
      if (import.meta.env.DEV) {
        console.log('[ConversationController] updateThreadForSelection → thread unchanged with messages', {
          threadKey: nextThreadKey,
          messageCount: currentMessages.length
        });
      }
      return;
    }

    // If thread key is same but messages are empty, we need to reload
    // This handles cases where historyKey was set proactively but history wasn't loaded
    if (prevThreadKey === nextThreadKey && currentMessages.length === 0) {
      if (import.meta.env.DEV) {
        console.log('[ConversationController] updateThreadForSelection → thread unchanged but messages empty, reloading', {
          threadKey: nextThreadKey
        });
      }
      // Don't return - continue to load history
    }

    // Clear messages before switching the historyKey to avoid persisting old content under the new key.
    const existing = useDomainStore.getState().conversation.messages;
    if (existing.length > 0) {
      store.setConversationMessages([]);
    }
    store.setConversationStarted(true);

    // Now switch to the new thread key.
    store.setConversationHistoryKey(nextThreadKey);

    const pass = historyGate.begin(nextThreadKey);

    try {
      const history = await loadHistoryFromStorage(nextThreadKey);

      if (!pass.isCurrent()) {
        return;
      }

      if (history && history.length > 0) {
        store.setConversationMessages(history);
        store.setConversationStarted(true);
        lastPersistedSnapshot = { key: nextThreadKey, checksum: JSON.stringify(history) };
        if (import.meta.env.DEV) {
          console.log('[ConversationController] updateThreadForSelection → loaded history', {
            threadKey: nextThreadKey,
            messageCount: history.length,
          });
        }
      } else {
        // No existing history; keep whatever the UI may append after this point.
        // We already cleared stale messages above when entering the new thread.
        store.setConversationStarted(true);
        lastPersistedSnapshot = { key: nextThreadKey, checksum: JSON.stringify([]) };
        if (import.meta.env.DEV) {
          console.log('[ConversationController] updateThreadForSelection → no existing history', {
            threadKey: nextThreadKey,
          });
        }
      }

      await Promise.resolve(handlers.hydrateHistory?.(nextThreadKey));
    } finally {
      isHydrating = false;
    }
  };

  const handlePendingRequestId = (requestId: string | null) => {
    // 🎯 CRITICAL: Allow re-entry with same requestId if stream hasn't started yet
    // This fixes the deadlock when updateHandlers re-triggers before stream starts
    if (requestId === activeRequestId && streamTask !== null) {
      if (import.meta.env.DEV) {
        console.log('[ConversationController] handlePendingRequestId: same requestId with active stream, skipping');
      }
      return;
    }

    if (!requestId) {
      activeRequestId = null;
      if (streamTask) {
        streamTask.abort();
        streamTask = null;
      }
      return;
    }

    if (!handlers.streamConversation) {
      // 🎯 Don't set activeRequestId when handlers are missing — updateHandlers
      // reads pendingRequestId from the store directly, so it will retry cleanly.
      // Setting activeRequestId here without creating streamTask left state inconsistent.
      if (import.meta.env.DEV) {
        console.warn('[ConversationController] handlePendingRequestId: no streamConversation handler');
      }
      return;
    }

    activeRequestId = requestId;

    if (streamTask) {
      if (import.meta.env.DEV) {
        console.log('[ConversationController] Aborting previous stream task');
      }
      streamTask.abort();
      streamTask = null;
    }

    const state = useDomainStore.getState();
    const threadKey = state.conversation.historyKey;
    const baseMessages = state.conversation.messages;

    if (!threadKey) {
      if (import.meta.env.DEV) {
        console.warn('[ConversationController] handlePendingRequestId called without historyKey. Deferring.');
      }
      return;
    }

    streamTask = abortable(async (signal) => {
      handlers.onStreamingStarted?.(threadKey, requestId);

      try {
        await Promise.resolve(
          handlers.streamConversation?.({
            requestId,
            threadKey,
            messages: baseMessages,
            signal,
            pushAssistantText: (chunk: string) => {
              applyAssistantChunk(chunk);
            },
          })
        );

        if (!signal.aborted) {
          handlers.onStreamingComplete?.(threadKey, requestId, 'success');
          const latestState = useDomainStore.getState();
          if (latestState.conversation.historyKey) {
            await persistIfChanged(
              latestState.conversation.historyKey,
              latestState.mode.selected,
              latestState.conversation.messages
            );
          }
        } else {
          handlers.onStreamingComplete?.(threadKey, requestId, 'aborted');
        }
      } catch (error) {
        if (!signal.aborted) {
          console.error('[ConversationController] Streaming failed', error);
          handlers.onStreamingComplete?.(threadKey, requestId, 'error', error);
        }
      } finally {
        // 🎯 CRITICAL: Clear streamTask when done to allow next request
        if (streamTask?.signal === signal) {
          streamTask = null;
          if (import.meta.env.DEV) {
            console.log('[ConversationController] Cleared streamTask after completion');
          }
        }

        const latest = useDomainStore.getState();
        if (latest.conversation.pendingRequestId === requestId) {
          latest.setPendingRequestId(null);
        }
      }
    });

    streamTask.promise.catch((error) => {
      if (error && (error as Error).name !== 'AbortError') {
        console.error('[ConversationController] Stream promise rejected', error);
      }
    });
  };

  const attach = () => {
    if (import.meta.env.DEV) {
      console.log('[Mode2Triage][Controller] attach');
    }
    const store = useDomainStore;

    // Track last selection to prevent redundant calls
    let lastSelection: { figureId: string | null; seedId: string | null; mode: string } | null = null;

    subscriptions.push(
      store.subscribe((state) => {
        const selection = {
          figureId: state.figures.selectedId,
          seedId: state.seeds.selectedId,
          mode: state.mode.selected,
        };

        // Only trigger if selection actually changed
        if (
          lastSelection &&
          lastSelection.figureId === selection.figureId &&
          lastSelection.seedId === selection.seedId &&
          lastSelection.mode === selection.mode
        ) {
          return;
        }

        lastSelection = { ...selection };

        if (import.meta.env.DEV) {
          console.log('[Mode2Triage][Controller] selection', selection);
        }
        void updateThreadForSelection(selection);
      })
    );

    // Track last persist snapshot to prevent redundant calls
    let lastPersistSnapshot: {
      messages: any[];
      historyKey: string | null;
      mode: string;
      pendingRequestId: string | null;
    } | null = null;

    subscriptions.push(
      store.subscribe((state) => {
        const messages = state.conversation.messages;
        const historyKey = state.conversation.historyKey;
        const mode = state.mode.selected;
        const pendingRequestId = state.conversation.pendingRequestId;

        // Only trigger if relevant state changed
        if (
          lastPersistSnapshot &&
          lastPersistSnapshot.messages === messages &&
          lastPersistSnapshot.historyKey === historyKey &&
          lastPersistSnapshot.mode === mode &&
          lastPersistSnapshot.pendingRequestId === pendingRequestId
        ) {
          return;
        }

        lastPersistSnapshot = { messages, historyKey, mode, pendingRequestId };

        if (isHydrating) {
          return;
        }
        if (!historyKey || !isConversationMode(mode)) {
          return;
        }

        if (pendingRequestId && handlers.streamConversation) {
          return;
        }

        if (import.meta.env.DEV) {
          console.log('[Mode2Triage][Controller] persistIfChanged gate', {
            historyKey,
            msgCount: messages.length,
            hasStream: Boolean(handlers.streamConversation),
            pending: pendingRequestId,
          });
        }
        void persistIfChanged(historyKey, mode, messages);
      })
    );

    // Track last stream snapshot to prevent redundant calls
    let lastStreamSnapshot: {
      pendingRequestId: string | null;
      historyKey: string | null;
      figureId: string | null;
      seedId: string | null;
      mode: string;
    } | null = null;

    subscriptions.push(
      store.subscribe((state) => {
        const pendingRequestId = state.conversation.pendingRequestId;
        const historyKey = state.conversation.historyKey;
        const figureId = state.figures.selectedId;
        const seedId = state.seeds.selectedId;
        const mode = state.mode.selected;

        // Only trigger if relevant state changed
        if (
          lastStreamSnapshot &&
          lastStreamSnapshot.pendingRequestId === pendingRequestId &&
          lastStreamSnapshot.historyKey === historyKey &&
          lastStreamSnapshot.figureId === figureId &&
          lastStreamSnapshot.seedId === seedId &&
          lastStreamSnapshot.mode === mode
        ) {
          return;
        }

        lastStreamSnapshot = { pendingRequestId, historyKey, figureId, seedId, mode };

        if (!pendingRequestId) return;
        if (!historyKey) return;
        if (!figureId || !seedId) return;

        // Ensure we're actually in a conversation mode
        if (!isConversationMode(mode)) return;

        // Sanity check that historyKey corresponds to the current selection
        const expected = getStorageKeyForMode(mode, figureId, seedId) ?? null;
        if (expected !== historyKey) {
          // Wait until updateThreadForSelection completes and sets correct key
          if (import.meta.env.DEV) {
            console.log('[ConversationController] Deferring pending request until historyKey matches selection', {
              pendingRequestId,
              historyKey,
              expected,
              selection: { figureId, seedId, mode },
            });
          }
          return;
        }

        if (import.meta.env.DEV) {
          console.log('[Mode2Triage][Controller] starting stream', { pendingRequestId, historyKey });
        }
        handlePendingRequestId(pendingRequestId);
      })
    );
  };

  const detach = () => {
    while (subscriptions.length > 0) {
      const unsubscribe = subscriptions.pop();
      unsubscribe?.();
    }

    if (streamTask) {
      streamTask.abort();
      streamTask = null;
    }

    activeRequestId = null;
  };

  return {
    start() {
      attach();
    },
    stop() {
      detach();
    },
    updateHandlers(nextDeps: ConversationControllerDeps = {}) {
      handlers = { ...nextDeps };

      // If a pending request exists and we now have handlers, attempt to (re)start streaming.
      try {
        const s = useDomainStore.getState();
        const pending = s.conversation.pendingRequestId;
        const key = s.conversation.historyKey;
        const mode = s.mode.selected;
        if (pending && key && isConversationMode(mode) && handlers.streamConversation) {
          if (import.meta.env.DEV) {
            console.log('[ConversationController] updateHandlers → detected pending request; re-triggering stream', {
              pending,
              key,
            });
          }
          handlePendingRequestId(pending);
        }
      } catch (error) {
        console.error('[ConversationController] updateHandlers re-trigger failed', error);
      }
    },
  };
};

export type ConversationController = ReturnType<typeof createConversationController>;
