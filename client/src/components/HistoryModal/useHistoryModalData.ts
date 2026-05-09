import { useEffect, useState, useRef, useCallback, ChangeEvent } from 'react';
import { useDomainStore } from '../../stores/domainStore';
import useTranslation from '../../hooks/useTranslation';
import useSeedTranslation from '../../hooks/useSeedTranslation';
import { useHapticFeedback } from '../../hooks/useHapticFeedback';
import { useUIStore } from '../../stores/uiStore';
import SummaryService from '../../services/SummaryService';
import { STORAGE_KEYS } from '../../utils/storageKeysV2';
import { createRequestGate } from '../../utils/async/requestGate';
import { abortable, AbortableTask } from '../../utils/async/abortable';
import { LocalStorageAdapter } from '../../storage/localAdapter';
import { loadHistoryData } from '../../services/history/historyDataLoader';
import { clearSeedHistory, clearAllHistory } from '../../services/history/historyClearService';
import { exportHistory, importHistory } from '../../services/history/historyExportService';
import { isMobileOrTablet } from '../../utils/deviceDetection';
import { MODES } from './historyModalConstants';
import type { HistoryModalProps, HistoryData, HistoryLoadResult, Message, Seed } from './historyModalTypes';

export function useHistoryModalData({
  isOpen,
  onClose,
  selectedFigure,
  onSummaryGenerated,
  onHistoryCleared
}: HistoryModalProps) {
  const { t, tString, tNode, tArray } = useTranslation();
  const { getTranslatedSeedTitle } = useSeedTranslation();
  const { triggerHaptic } = useHapticFeedback();

  // Help preferences from Zustand
  const shouldShowHelp = useUIStore((state) => state.shouldShowHelp);
  const dismissHelp = useUIStore((state) => state.dismissHelp);

  // Wrapper for mobile actions with haptic feedback
  const withHaptic = (action: (...args: any[]) => any, intensity: 'light' | 'medium' | 'strong' = 'light') => {
    return (...args: any[]) => {
      if (isMobileOrTablet()) {
        triggerHaptic(intensity);
      }
      return action(...args);
    };
  };

  const [histories, setHistories] = useState<{ [key: string]: HistoryData }>({});
  const [selectedSeedId, setSelectedSeedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showSpinner, setShowSpinner] = useState<boolean>(false);
  const showSpinnerRef = useRef(showSpinner);
  const [expandedSeeds, setExpandedSeeds] = useState<{ [key: string]: boolean }>({});
  const [currentActiveSeed, setCurrentActiveSeed] = useState<Seed | null>(null);
  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({});
  const [selectedModes, setSelectedModes] = useState<string[]>(Object.keys(MODES));
  const [isInitialLoad, setIsInitialLoad] = useState<boolean>(true);
  const [showHistoryHelp, setShowHistoryHelp] = useState<boolean>(false);

  // Ref to track if component is mounted
  const isMountedRef = useRef<boolean>(true);
  const spinnerTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const historyGateRef = useRef(createRequestGate());
  const historyRequestRef = useRef<AbortableTask<HistoryLoadResult> | null>(null);

  useEffect(() => {
    showSpinnerRef.current = showSpinner;
  }, [showSpinner]);

  const selectedFigureId = selectedFigure.id;

  // Direct service usage
  const resetConversationState = useDomainStore((state) => state.resetConversationState);
  const lastSyncSignatureRef = useRef<string | null>(null);
  const conversationSnapshotRef = useRef({ historyKey: null as string | null, messages: [] as any[] });

  // Helper: Extract mode from history key
  const normalizeModeFromKey = useCallback((key: string, figureId: string): string | null => {
    if (key.startsWith(`prism_content_${figureId}_`)) return 'prism';
    if (key.startsWith(`starseed_${figureId}_`)) return 'seed_conversation';
    if (key.startsWith(`challenge_${figureId}_`)) return 'challenge';
    if (key.startsWith(`freetalk_${figureId}`)) return 'free_conversation';
    return null;
  }, []);

  // Helper: Extract seed ID from history key
  const extractSeedIdFromKey = useCallback((key: string, figureId: string): string | null => {
    if (key.startsWith(`freetalk_${figureId}`)) return 'freetalk';
    const prefixes = [`prism_content_${figureId}_`, `starseed_${figureId}_`, `challenge_${figureId}_`];
    for (const prefix of prefixes) {
      if (key.startsWith(prefix)) return key.slice(prefix.length);
    }
    return null;
  }, []);

  // Sync Zustand conversation state to local histories
  const syncFromSnapshot = useCallback((snapshot: { historyKey: string | null; messages: any[] }) => {
    if (!isOpen) return;
    if (!selectedFigureId || !snapshot.historyKey) {
      lastSyncSignatureRef.current = null;
      return;
    }

    const mode = normalizeModeFromKey(snapshot.historyKey, selectedFigureId);
    const seedId = extractSeedIdFromKey(snapshot.historyKey, selectedFigureId);
    if (!mode || !seedId) return;

    const sourceMessages = Array.isArray(snapshot.messages) ? snapshot.messages : [];
    const normalizedMessages = sourceMessages
      .filter((msg: any) =>
        msg &&
        typeof msg.content === 'string' &&
        msg.content.trim().length > 0 &&
        !msg.hidden
      )
      .map((msg: any) => ({ ...msg, mode }));

    const signature = `${snapshot.historyKey}|${normalizedMessages.map((msg: any) => `${msg.role}:${msg.timestamp ?? ''}:${msg.content}`).join('|')}`;
    if (lastSyncSignatureRef.current === signature) return;

    let didUpdate = false;
    setHistories((prev) => {
      const previousEntry = prev[seedId];
      const previousMessages = previousEntry?.messages ?? [];
      const isSame =
        previousMessages.length === normalizedMessages.length &&
        previousMessages.every((prevMsg: any, idx: number) => {
          const nextMsg = normalizedMessages[idx];
          return prevMsg.role === nextMsg.role && prevMsg.content === nextMsg.content && prevMsg.mode === nextMsg.mode && prevMsg.timestamp === nextMsg.timestamp;
        });

      if (isSame) return prev;
      didUpdate = true;
      return { ...prev, [seedId]: { ...(previousEntry ?? { seedId, messages: [] }), messages: normalizedMessages } };
    });

    if (!didUpdate) {
      lastSyncSignatureRef.current = signature;
      return;
    }

    lastSyncSignatureRef.current = signature;
    setSelectedSeedId((prev) => (prev === seedId ? prev : seedId));
  }, [isOpen, selectedFigureId, setHistories, setSelectedSeedId, normalizeModeFromKey, extractSeedIdFromKey]);

  // Subscribe to Zustand conversation changes
  useEffect(() => {
    const unsubscribe = useDomainStore.subscribe(
      (state) => {
        const historyKey = state.conversation.historyKey;
        const messages = state.conversation.messages;
        conversationSnapshotRef.current = { historyKey, messages };
        if (!isOpen) return;
        syncFromSnapshot({ historyKey, messages });
      }
    );
    return unsubscribe;
  }, [isOpen, syncFromSnapshot]);

  // Trigger sync when modal opens
  useEffect(() => {
    if (!isOpen) {
      lastSyncSignatureRef.current = null;
      return;
    }
    syncFromSnapshot(conversationSnapshotRef.current);
  }, [isOpen, selectedFigureId, syncFromSnapshot]);

  // Service methods
  const fetchHistoriesFromAdapter = useCallback(
    (figure: { id: string }, options?: { signal?: AbortSignal }) => loadHistoryData(figure as any, options),
    []
  );

  const clearSeedHistoryFromAdapter = useCallback(
    async (figure: { id: string }, seedId: string) => {
      const result = await clearSeedHistory(figure, seedId);

      const candidateKeys = new Set<string>();
      if (seedId === 'freetalk') {
        candidateKeys.add(STORAGE_KEYS.getFreeTalkHistory(figure.id));
      } else {
        candidateKeys.add(STORAGE_KEYS.getStarSeedHistory(figure.id, seedId));
        candidateKeys.add(STORAGE_KEYS.getChallengeHistory(figure.id, seedId));
      }

      const currentHistoryKey = conversationSnapshotRef.current.historyKey;
      if (currentHistoryKey && candidateKeys.has(currentHistoryKey)) {
        resetConversationState();
      }
      return result;
    },
    [resetConversationState]
  );

  const clearAllHistoryFromAdapter = useCallback(async () => {
    const result = await clearAllHistory();
    resetConversationState();
    return result;
  }, [resetConversationState]);

  // Custom close handler
  const handleClose = (): void => {
    if (isLoading) {
      setIsLoading(false);
      setShowSpinner(false);
      document.body.classList.remove('body-no-scroll');
    }

    const historiesCleared = LocalStorageAdapter.getString('histories_cleared') === 'true';
    LocalStorageAdapter.remove('histories_cleared');
    onClose();

    if (historiesCleared) {
      const resetEvent = new CustomEvent('app:reset-state', {
        detail: { timestamp: Date.now() }
      });
      window.dispatchEvent(resetEvent);
    }
  };

  // Cleanup effect
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      if (spinnerTimeoutRef.current) {
        clearTimeout(spinnerTimeoutRef.current);
      }
      if (isLoading) {
        document.body.classList.remove('body-no-scroll');
      }
    };
  }, [isLoading]);

  useEffect(() => {
    return () => {
      historyRequestRef.current?.abort();
    };
  }, []);

  const fetchAllHistories = useCallback(async (activeSeed: Seed | null): Promise<void> => {
    if (!selectedFigureId) {
      return;
    }

    const startTime = Date.now();
    const isMobile = isMobileOrTablet();
    const activeSeedId = activeSeed ? String(activeSeed.id) : null;
    const gateKey = `${selectedFigureId}:${activeSeedId ?? 'none'}`;
    const pass = historyGateRef.current.begin(gateKey);

    historyRequestRef.current?.abort();

    if (spinnerTimeoutRef.current) {
      clearTimeout(spinnerTimeoutRef.current);
    }

    setIsLoading(true);

    spinnerTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current && pass.isCurrent() && !historyRequestRef.current?.signal.aborted) {
        setShowSpinner(true);
      }
    }, 200);

    const task = abortable<HistoryLoadResult>(async (signal) => {
      const histories = await fetchHistoriesFromAdapter({ id: selectedFigureId }, { signal });
      return {
        histories,
        activeSeedId,
      };
    });

    historyRequestRef.current = task;

    const finalize = (elapsedTime: number) => {
      if (!pass.isCurrent()) {
        return;
      }

      if (spinnerTimeoutRef.current) {
        clearTimeout(spinnerTimeoutRef.current);
      }

      const finish = () => {
        if (isMountedRef.current) {
          setShowSpinner(false);
          setIsLoading(false);
          setIsInitialLoad(false);
        }
      };

      if (showSpinnerRef.current) {
        const minDisplayTime = isMobile ? 300 : 100;
        const remainingTime = Math.max(0, minDisplayTime - (elapsedTime - 200));
        setTimeout(finish, remainingTime);
      } else {
        finish();
      }
    };

    task.promise
      .then(({ histories, activeSeedId: resolvedSeedId }) => {
        if (!pass.isCurrent() || task.signal.aborted || !isMountedRef.current) {
          return;
        }

        setHistories(histories);

        if (resolvedSeedId && histories[resolvedSeedId]) {
          setSelectedSeedId(resolvedSeedId);
          setExpandedSeeds((prev) => ({ ...prev, [resolvedSeedId]: true }));
        }
      })
      .catch((error) => {
        if ((error as DOMException)?.name === 'AbortError') {
          return;
        }
        console.error('Failed to load histories', error);
      })
      .finally(() => {
        finalize(Date.now() - startTime);
      });

    try {
      await task.promise;
    } catch {
      // Errors handled in the chained catch above.
    }
  }, [fetchHistoriesFromAdapter, selectedFigureId]);

  useEffect(() => {
    if (isOpen && selectedFigureId) {
      if (shouldShowHelp('historyModalHelp')) {
        setShowHistoryHelp(true);
      }

      // Clean up any orphaned summary overlays from previous sessions
      const orphanedOverlays = document.querySelectorAll('.summary-modal-overlay');
      orphanedOverlays.forEach(overlay => {
        overlay.remove();
      });

      setIsInitialLoad(true);

      // Get active seed from Zustand
      const selectedSeedIdFromStore = useDomainStore.getState().seeds.selectedId;
      const activeSeed = selectedSeedIdFromStore
        ? useDomainStore.getState().seeds.byFigure[selectedFigureId]?.find(s => s.id.toString() === selectedSeedIdFromStore) ?? null
        : null;
      setCurrentActiveSeed(activeSeed);

      const loadHistories = async () => {
        await fetchAllHistories(activeSeed);
      };
      loadHistories();
    }
  }, [fetchAllHistories, isOpen, selectedFigureId]);

  const handleSummary = async (): Promise<void> => {
    if (!selectedSeedId) return;
    if (isLoading) return;

    // Gate on summary-specific quota when on free tier.
    const { quota, openRateLimitModal } = useDomainStore.getState();
    if (quota.isFreeTier && quota.summary.loaded && quota.summary.used >= quota.summary.limit) {
      openRateLimitModal('summary', quota.resetsAt, quota.summary.limit);
      return;
    }

    setIsLoading(true);
    setShowSpinner(true);
    document.body.classList.add('body-no-scroll');

    try {
      const historyData = histories[selectedSeedId];
      if (!historyData?.messages) throw new Error('No history found for selected seed');

      const summary = await SummaryService.generateSummary(
        historyData.messages,
        selectedFigure.id,
        selectedSeedId
      );

      const summaryMessage: Message = {
        role: 'assistant',
        content: summary.content,
        isSummary: true,
        timestamp: new Date().toISOString()
      };

      const updatedMessages = [summaryMessage];

      setHistories(prev => ({
        ...prev,
        [selectedSeedId]: {
          ...prev[selectedSeedId],
          summary,
          hasSummary: true,
          messages: updatedMessages
        }
      }));

      const existingStarseed = LocalStorageAdapter.getString(
        STORAGE_KEYS.getStarSeedHistory(selectedFigure.id, selectedSeedId)
      );
      const existingChallenge = LocalStorageAdapter.getString(
        STORAGE_KEYS.getChallengeHistory(selectedFigure.id, selectedSeedId)
      );

      let storageKey: string;
      if (existingStarseed) {
        storageKey = STORAGE_KEYS.getStarSeedHistory(selectedFigure.id, selectedSeedId);
      } else if (existingChallenge) {
        storageKey = STORAGE_KEYS.getChallengeHistory(selectedFigure.id, selectedSeedId);
      } else {
        storageKey = STORAGE_KEYS.getStarSeedHistory(selectedFigure.id, selectedSeedId);
      }

      LocalStorageAdapter.setJSON(storageKey, updatedMessages);

      const summaryKey = `summary_${selectedFigure.id}_${selectedSeedId}`;
      LocalStorageAdapter.setJSON(summaryKey, summary);

      const newSections: { [key: string]: boolean } = {};
      summary.content.split(/\n(?=[A-Z][A-Z\s]+:)/).forEach((_: string, index: number) => {
        newSections[`section-${selectedSeedId}-${index}`] = false;
      });
      setExpandedSections(newSections);

      onSummaryGenerated();
    } catch (error) {
      if (isMountedRef.current) {
        alert(tString('history.alerts.summaryFailed', 'Failed to generate summary'));
      }
    } finally {
      document.body.classList.remove('body-no-scroll');
      if (isMountedRef.current) {
        setIsLoading(false);
        setShowSpinner(false);
      }
    }
  };

  const handleBackup = (): void => {
    try {
      exportHistory?.();
    } catch (error) {
      console.error('[HistoryModal] export failed', error);
      alert(tString('history.alerts.backupFailed', 'Failed to create backup'));
    }
  };

  const handleRestore = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    if (!file) return;

    let handledError = false;

    try {
      await importHistory(
        file,
        () => {
          void fetchAllHistories(currentActiveSeed);
          alert(tString('history.alerts.restoreSuccess', 'Data restored successfully'));
        },
        (error) => {
          handledError = true;
          console.error('[HistoryModal] restore callback reported failure', error);
          alert(tString('history.alerts.restoreFailed', 'Failed to restore backup'));
        }
      );
    } catch (error) {
      console.error('[HistoryModal] restore failed', error);
      if (!handledError) {
        alert(tString('history.alerts.restoreFailed', 'Failed to restore backup'));
      }
    } finally {
      event.target.value = '';
    }
  };

  const handleClearSeedHistory = async (seedId: string): Promise<void> => {
    const confirmMessage = seedId === 'freetalk'
      ? tString('history.confirmations.clearFreeTalk', 'Are you sure you want to clear the FreeTalk history?')
      : tString('history.confirmations.clearSeed', 'Are you sure you want to clear the history for this StarSeed?');

    if (!window.confirm(confirmMessage) || !selectedFigure) return;

    try {
      await clearSeedHistoryFromAdapter?.(selectedFigure, seedId);

      setHistories((prev) => {
        const next = { ...prev };
        delete next[seedId];
        return next;
      });

      if (selectedSeedId === seedId) {
        setSelectedSeedId(null);
      }

      onHistoryCleared();
      alert(tString('history.alerts.clearedSuccessfully', 'History cleared successfully'));
    } catch (error) {
      console.error('[HistoryModal] clear seed history failed', error);
      alert(tString('history.alerts.clearFailed', 'Failed to clear history'));
    }
  };

  const handleClearAllHistory = async (): Promise<void> => {
    const confirmation = tString(
      'history.confirmations.clearAll',
      'Are you sure you want to clear the history for ALL FIGURES across all Star Seeds? This action cannot be undone.'
    );

    if (!window.confirm(confirmation)) return;

    try {
      await clearAllHistoryFromAdapter();
      setHistories({});
      setSelectedSeedId(null);
      onHistoryCleared();
      alert(tString('history.alerts.clearAllSuccess', 'Successfully cleared history for all figures'));
    } catch (error) {
      console.error('[HistoryModal] clear all history failed', error);
      alert(tString('history.alerts.clearAllFailed', 'Failed to clear all histories'));
    }
  };

  // Mode filter controls
  const toggleMode = (mode: string): void => {
    if (isMobileOrTablet()) {
      triggerHaptic('light');
    }
    setSelectedModes(prev => {
      if (prev.includes(mode)) {
        return prev.filter(m => m !== mode);
      }
      return [...prev, mode];
    });
  };

  const toggleSection = (sectionId: string): void => {
    setExpandedSections(prev => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  const filterMessagesByMode = (messages: Message[]): Message[] => {
    return messages.filter(msg => {
      if (msg.isSummary) {
        return selectedModes.includes('summary');
      }
      const mode = msg.mode || 'introduction';
      return selectedModes.includes(mode);
    });
  };

  const getSeedTitleDisplay = (seedId: string): string => {
    if (seedId === 'freetalk') {
      return tString('modes.freetalk', 'FreeTalk');
    }

    let numericId: number;
    if (typeof seedId === 'string') {
      numericId = parseInt(seedId.split('-')[1] || seedId);
    } else {
      numericId = parseInt(seedId);
    }

    const translatedTitle = getTranslatedSeedTitle(selectedFigure.id, numericId);
    if (translatedTitle) {
      return `${numericId}. ${translatedTitle}`;
    }

    return `${numericId}.`;
  };

  const getSortedSeeds = (): string[] => {
    return Object.keys(histories).sort((a, b) => {
      if (a === 'freetalk') return 1;
      if (b === 'freetalk') return -1;

      const numA = parseInt(typeof a === 'string' ? a.split('-')[1] || a : a);
      const numB = parseInt(typeof b === 'string' ? b.split('-')[1] || b : b);
      return numA - numB;
    });
  };

  const toggleSeedExpansion = (seedId: string): void => {
    setExpandedSeeds(prev => ({
      ...prev,
      [seedId]: !prev[seedId]
    }));
  };

  const handleDontShowHistoryHelp = (): void => {
    dismissHelp('historyModalHelp');
  };

  const sortedActiveSeeds = getSortedSeeds();

  return {
    // Translation
    t, tString, tNode, tArray,

    // State
    histories,
    selectedSeedId,
    setSelectedSeedId,
    isLoading,
    showSpinner,
    expandedSeeds,
    currentActiveSeed,
    expandedSections,
    selectedModes,
    isInitialLoad,
    showHistoryHelp,
    setShowHistoryHelp,
    sortedActiveSeeds,

    // Handlers
    handleClose,
    handleSummary,
    handleBackup,
    handleRestore,
    handleClearSeedHistory,
    handleClearAllHistory,
    toggleMode,
    toggleSection,
    toggleSeedExpansion,
    filterMessagesByMode,
    getSeedTitleDisplay,
    handleDontShowHistoryHelp,
    withHaptic,
  };
}
