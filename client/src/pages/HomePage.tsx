// src/pages/HomePage.tsx
import React, { useState, useEffect, useCallback, useRef, useMemo, FC } from 'react';
import { Bird, Books, Sparkle, Mountains, DiamondsFour } from "@phosphor-icons/react";
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import Sidebar from '../components/Sidebar';
import { RippleButton } from '../components/Button';
import { useTranslation } from '../hooks/useTranslation';
import useSeedTranslation from '../hooks/useSeedTranslation';
import { useFigureManagerAdapter as useFigureManager } from '../adapters/figureAdapter';
import { useSeedManagerAdapter as useSeedManager } from '../adapters/seedAdapter';
import { useModeManager } from '../hooks/useModeManager';
import { useHelperFunctions } from '../hooks/useHelperFunctions';
import { useAppStateVM } from '../vm/useAppStateVM';
import { useConversationVM } from '../vm/useConversationVM';
import { useConversationEffects } from '../hooks/useConversationEffects';
import { useQuotaSync } from '../hooks/useQuotaSync';
import { useCouncilState, useCouncilActions, useModeState, useModeActions, useUIStore, useStoreHydration } from '../stores';
import { getCouncilControllerApi, subscribeCouncilController } from '../controllers/councilControllerRegistry';
import { cosmicCouncilService } from '../services/council';
import { useUIHandlers } from '../hooks/useUIHandlers';
import { loadServiceConfig } from '../services/audio/config/serviceConfig';

// Sub-components extracted from HomePage
import MainContentContainer from '../components/HomePage/MainContentContainer';
import ModalsContainer from '../components/HomePage/ModalsContainer';

// New navigation components
import { PeekingFAB } from '../components/Navigation';

import { processTextMessage } from '../services/audioService';
import seedStateManager from '../services/SeedStateManager';
import { modeStateManager } from '../utils/modeStateManager';
import { screenContent } from '../utils/contentSafety';
import {
  sendFunnelBeacon,
  sendFunnelBeaconOnce,
  markReplyDispatchStart,
  replyTimeBucketSinceDispatch,
  hasFiredFunnelStep,
  hasFiredFirstTurn,
  firstReplyFailReason,
  noteChatTurn,
} from '../utils/funnelBeacon';
import { sendConversion } from '../utils/public/gclidCapture';
import { isNewUser, HISTORY_PREFIXES } from '../utils/userState';
import {
  markStoryCompleted,
  getStorageKeyForMode,
  backfillWisdomMarkers,
  STORAGE_KEYS
} from '../utils/storageKeysV2';
import { resolveRestoreAction } from '../utils/flowDecisions';
import { checkAndSetBloomInvite, getPendingInvite, clearPendingInvite } from '../utils/pendingBlooms';
import PostDialogueBloomInvite from '../components/WisdomMapModal/PostDialogueBloomInvite';
import PostQuestVerdictCard from '../components/QuestVerdictCard/PostQuestVerdictCard';
import { getPendingQuestVerdict, clearPendingQuestVerdict } from '../utils/questVerdict';
import { restartQuest } from '../utils/questRestart';
import { LocalStorageAdapter } from '../storage/localAdapter';
import { readFigureIntent, clearFigureIntent, readCouncilIntent, clearCouncilIntent, readAskIntent, clearAskIntent, stashAskPrefill, stageCouncilHandoff, readStoryIntent, clearStoryIntent, peekAskPrefillTag, consumeComposerStagedOrigin, beginCarriedThread } from '../utils/public/entryIntent';
import { resolveAnchorSeedId } from '../data/public/heroEntry';
import { CEREMONY_CARRIED_ENTRY, NAV_BATCH } from '../config/features';
import { preferencesAdapter } from '../storage/preferencesAdapter';
import { readHistoryMessages } from '../services/history/historyEncryption';
import { registerSessionControllerHandlers } from '../controllers/sessionControllerRegistry';
import { registerConversationControllerHandlers } from '../controllers/conversationControllerRegistry';
import { createLegacyConversationStream } from '../controllers/conversationStreamDriver';
import { mapErrorToUserMessage } from '../services/llm/errorMessages';
import { useDomainStore } from '../stores';
import { ConversationMode, Seed } from '../types/global';
import './HomePage.css';

declare global {
  interface Window {
    __renderMetricsLog?: Array<{
      timestamp: string;
      reason: string;
      rows: Array<{ component: string; previous: number; current: number; delta: number }>;
    }>;
    handleSeedSelect?: (seed: any, forceMode?: string) => void;
  }
}


// Define modes to be translated later in the component
const MODE_IDS = {
  INTRODUCTION: 'introduction',
  PRISM: 'prism',
  SEED_CONVERSATION: 'seed_conversation',
  CHALLENGE: 'challenge',
  FREE_CONVERSATION: 'free_conversation'
} as const;

interface HomePageProps {
  onSelectFigure: () => void;
}

interface Mode {
  id: string;
  icon: React.ComponentType;
  label: string;
  color: string;
}

const HomePage: FC<HomePageProps> = ({ onSelectFigure }) => {
  const { tString, tNode, language } = useTranslation();

  // Wait for Zustand persist to hydrate before initialization
  const { isHydrated } = useStoreHydration();

  // Sync free-tier quota state (detects BYOK vs free-tier, fetches initial count)
  useQuotaSync();

  // ✅ Audio unlock moved to App.tsx (universal unlock on first tap)
  // HomePage no longer manages audio gate - simplified architecture

  // Device detection for responsive navigation
  const [isMobileOrTablet, setIsMobileOrTablet] = useState(window.innerWidth < 1024);

  useEffect(() => {
    const handleResize = () => {
      setIsMobileOrTablet(window.innerWidth < 1024);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ✅ Audio queue initialization moved to App.tsx (universal unlock)
  // HomePage no longer initializes queue - App.tsx handles it on first user gesture
  // This prevents duplicate initialization and ensures promise barrier stays intact

  // Touch gesture refs for swipe-to-open
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const touchEndRef = useRef<{ x: number; y: number } | null>(null);

  // Debounce ref for fetchHistory calls
  const fetchHistoryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const handleModeSelectRef = useRef<(mode: string, force?: boolean) => void>(() => {});
  // Anchor selection is deferred to the moment Free Talk opens; the callback
  // is defined far below handleModeSelect, so it rides a ref like the one above.
  const selectAnchorSeedRef = useRef<(figureId: string, tag: string) => void>(() => {});
  // Timestamp of last handleSeedSelect call — Effect#14 skips within 500ms to prevent double-firing
  const lastSeedSelectTimeRef = useRef(0);
  // Flag: when true, handleSelectFigure is handling mode — Effect#14 must not interfere
  const figureSelectHandlingModeRef = useRef(false);

  // Initialize MODES with translated labels
  const MODES: Mode[] = [
    {
      id: MODE_IDS.INTRODUCTION,
      icon: Books,
      label: tString('modes.story', 'Story'),
      color: 'gold'
    },
    {
      id: MODE_IDS.PRISM,
      icon: DiamondsFour,
      label: tString('modes.prism', 'Prism'),
      color: 'prism'
    },
    {
      id: MODE_IDS.SEED_CONVERSATION,
      icon: Sparkle,
      label: tString('modes.wisdom', 'Wisdom'),
      color: 'purple'
    },
    {
      id: MODE_IDS.CHALLENGE,
      icon: Mountains,
      label: tString('modes.quest', 'Quest'),
      color: 'coral'
    },
    {
      id: MODE_IDS.FREE_CONVERSATION,
      icon: Bird,
      label: tString('modes.freetalk', 'Freetalk'),
      color: 'mint'
    }
  ];

  // Use the new figure manager hook
  const {
    selectedFigure,
    selectFigure,
    loadFigureSeeds,
    getFigureById
  } = useFigureManager(language, onSelectFigure);

  // Note: selectedSeed state now managed by useSeedManager hook
  // We'll initialize it after we have the other required states

  // Get app-wide state from the hook
  const {
    state: {
      config,
      loading,
      error,
      storyData,
      firstTextArrived,
      translationInProgress,
      isAudioPlaying
    },
    actions: {
      setConfig,
      setLoading,
      setError,
      setStoryData,
      setFirstTextArrived,
      setTranslationInProgress,
      setIsAudioPlaying
    }
  } = useAppStateVM();

  // UI state (direct Zustand - removed uiStateAdapter)
  const modals = useUIStore((state) => state.modals);
  const isMenuOpen = modals.menuOpen;
  const showFigureCarousel = modals.figureCarouselOpen;
  const isHistoryModalOpen = modals.historyOpen;
  const isSeedsOpen = modals.seedsOpen;
  const showOnboarding = modals.onboardingOpen;
  const showWisdomGallery = modals.wisdomGalleryOpen;
  const showModeSelector = modals.modeSelectorOpen;

  // Prismatic Bloom invite card state
  // Single source of truth: bloomModeCompleted is dispatched by markStoryCompleted,
  // markPrismCompleted, markWisdomCompleted, and SeedStateManager.markAsGathered.
  const [bloomInvite, setBloomInvite] = useState<{ count: number } | null>(null);
  useEffect(() => {
    const handleBloomEvent = (e: Event) => {
      const figureId = (e as CustomEvent).detail?.figureId;
      if (figureId) checkAndSetBloomInvite(figureId);
      const invite = getPendingInvite();
      if (invite) setBloomInvite({ count: invite.count });
    };
    // Check on mount for invites from previous session
    const existing = getPendingInvite();
    if (existing) setBloomInvite({ count: existing.count });
    // Listen for the unified bloom event from all completion sources
    window.addEventListener('bloomModeCompleted', handleBloomEvent);
    // Backfill wisdom markers from IDB once per device — covers users whose
    // seed_conversation already crossed the depth threshold before the marker existed.
    // Each new marker fires bloomModeCompleted, so the listener above picks it up.
    backfillWisdomMarkers();
    return () => window.removeEventListener('bloomModeCompleted', handleBloomEvent);
  }, []);

  // Chapter-2 handoff visible in the story view: hold the floating cards below.
  // Story completion fires both the handoff and a bloom invite; one CTA at a time.
  const [storyHandoffActive, setStoryHandoffActive] = useState(false);
  useEffect(() => {
    const handleHandoffVisibility = (e: Event) =>
      setStoryHandoffActive(Boolean((e as CustomEvent).detail?.visible));
    window.addEventListener('storyHandoffVisible', handleHandoffVisibility);
    return () => window.removeEventListener('storyHandoffVisible', handleHandoffVisibility);
  }, []);

  // Quest not-earned verdict card state.
  // Symmetric with bloomInvite: surfaces on homepage when figure called award_seed
  // with passed:false (ALMOST or NOT_YET). Persists in localStorage until acknowledged
  // (Try Again / Deepen Wisdom / Later).
  const [questVerdict, setQuestVerdict] = useState<{ figureId: string; seedId: string } | null>(null);
  useEffect(() => {
    const handleVerdict = () => {
      const v = getPendingQuestVerdict();
      if (v) setQuestVerdict({ figureId: v.figureId, seedId: v.seedId });
    };
    handleVerdict(); // check on mount
    window.addEventListener('questVerdictDelivered', handleVerdict);
    return () => window.removeEventListener('questVerdictDelivered', handleVerdict);
  }, []);

  // UI mutations (direct setters)
  const setMenuOpen = useUIStore((state) => state.setMenuOpen);
  const setFigureCarousel = useUIStore((state) => state.setFigureCarouselOpen);
  const setHistoryModalOpen = useUIStore((state) => state.setHistoryModalOpen);
  const setSeedsOpen = useUIStore((state) => state.setSeedsModalOpen);
  const setOnboardingVisible = useUIStore((state) => state.setOnboardingOpen);
  const setWisdomGalleryVisible = useUIStore((state) => state.setWisdomGalleryOpen);
  const setModeSelectorVisible = useUIStore((state) => state.setModeSelectorOpen);
  const setCouncilSetupOpen = useUIStore((state) => state.setCouncilSetupOpen);

  // UI handlers (event handlers for modals)
  const {
    handleMenuClose,
    handleHistoryModalOpen,
    handleHistoryModalClose,
    handleSeedsOpen,
    handleSeedsClose,
    handleModeSelectorOpen,
    handleModeSelectorClose,
    handleFigureCarouselOpen,
    handleFigureCarouselClose,
    handleWisdomGalleryClose,
    handleWisdomGalleryOpen,
    handleWisdomGalleryCloseComplete,
    handleOnboardingClose,
  } = useUIHandlers({
    setIsMenuOpen: setMenuOpen,
    setIsHistoryModalOpen: setHistoryModalOpen,
    setIsSeedsOpen: setSeedsOpen,
    setShowModeSelector: setModeSelectorVisible,
    setShowFigureCarousel: setFigureCarousel,
    setShowOnboarding: setOnboardingVisible,
    setShowWisdomGallery: setWisdomGalleryVisible,
    handleWisdomGalleryExploreAll: () => {
      setWisdomGalleryVisible(false);
      setFigureCarousel(true);
    },
  });

  // Add initialization ref to prevent duplicate initialization
  const initializationDone = useRef(false);

  // Effect to check for forced onboarding and conversation history
  // CRITICAL: Must wait for Zustand persist hydration before checking state!
  useEffect(() => {
    // Wait for stores to hydrate from localStorage before initialization
    if (!isHydrated) {
      if (import.meta.env.DEV) {
        console.log('[HomePage] Waiting for store hydration...');
      }
      return;
    }

    // Prevent duplicate initialization after hydration
    if (initializationDone.current) {
      return;
    }
    initializationDone.current = true;

    // Hydrate user profile from IndexedDB (async, non-blocking)
    useDomainStore.getState().hydrateUserProfile();

    if (import.meta.env.DEV) {
      console.log('[HomePage] Stores hydrated, running initialization...');
    }

    // CRITICAL FIX: We must check before any other operations if localStorage has any values
    // This is the moment of truth - are we actually clean?

    // For clean browser sessions (e.g. incognito, first visit) force onboarding
    const storageKeys = LocalStorageAdapter.keys();
    const isCleanSession = storageKeys.length === 0 ||
                          (storageKeys.length === 1 && LocalStorageAdapter.getString('token'));

    // If it's a truly clean session (e.g. incognito window), force onboarding regardless
    if (isCleanSession) {
      // Force all flags to ensure onboarding shows
      // Note: Clean session already has no selected figure (Zustand bootstraps empty)
      useDomainStore.getState().resetOnboarding();

      setOnboardingVisible(true);
      setFigureCarousel(false);

      return; // Skip the rest of the logic for clean sessions
    }

    // STANDARD FLOW - only for non-clean sessions
    // Now safe to read from Zustand - stores are hydrated!

    // Check if user has conversation history first (using correct prefixes)
    const hasHistory = LocalStorageAdapter.keys().some((key) =>
      HISTORY_PREFIXES.some((prefix) => key.startsWith(prefix))
    );

    // First check if user should see onboarding (new user or forced)
    const isFirstTimeUser = isNewUser();

    const forceOnboarding = useDomainStore.getState().onboarding.forceShow;

    // Guarded: storage access throws on a privacy-locked browser; a missing
    // one-shot onboarding flag degrades to "not requested" rather than
    // dropping the whole app to the error boundary on every load.
    let sessionOnboarding = false;
    try {
      sessionOnboarding = sessionStorage.getItem('showOnboarding') === 'true';
    } catch { /* storage blocked — treat as not requested */ }

    // Let's explicitly check onboarding completion status too
    const onboardingCompleted = useDomainStore.getState().onboarding.complete ? 'true' : null;

    if (import.meta.env.DEV) {
      console.log('[HomePage] Initialization state:', {
        isFirstTimeUser,
        hasHistory,
        forceOnboarding,
        sessionOnboarding,
        onboardingCompleted,
        selectedFigureId: useDomainStore.getState().figures.selectedId,
      });
    }

    if (sessionOnboarding) {
      try { sessionStorage.removeItem('showOnboarding'); } catch { /* storage blocked */ }
      // Show onboarding first, then figure selection
      setOnboardingVisible(true);
      setFigureCarousel(false);
    } else if (forceOnboarding) {
      useDomainStore.getState().setForceOnboarding(false);
      // Show onboarding first, then figure selection
      setOnboardingVisible(true);
      setFigureCarousel(false);
    } else if (isFirstTimeUser) {

      // FORCE onboarding for first-time users by setting explicit flags
      useDomainStore.getState().resetOnboarding();

      // Show onboarding first, then figure selection
      setOnboardingVisible(true);
      setFigureCarousel(false);
    } else {
      // Returning visitor: already consented (past every onboarding gate
      // above), so the welcome modal is NOT shown for them. Honor a figure or
      // council deep-link captured from a public /figures or /themes page
      // (sessionStorage, written by agc-public.js on the CTA click, or by the
      // ?figure=/?council= URL reader at boot) BEFORE falling back to the
      // gallery or restoring prior state. Commit 9a4ac917 ("recognize
      // returning visitors") made this path skip the welcome modal, so
      // routeAfterOnboarding — the other intent consumer — never ran here and
      // the deep-link silently dropped the visitor into the gallery. This
      // consumes it without re-showing the consent gate. First-timers are
      // unaffected: they still consume intent via the welcome "Begin".
      const intendedCouncil = readCouncilIntent();
      const intendedFigureId = readFigureIntent();
      const intendedFigure = intendedFigureId ? getFigureById(intendedFigureId) : undefined;
      if (intendedCouncil) {
        clearCouncilIntent();
        setOnboardingVisible(false);
        setFigureCarousel(false);
        startCuratedCouncilById(intendedCouncil);
      } else if (intendedFigure) {
        clearFigureIntent();
        setOnboardingVisible(false);
        setFigureCarousel(false);
        void handleSelectFigure(intendedFigure);
      } else if (!hasHistory && !useDomainStore.getState().figures.selectedId) {
        // Has no history AND no selected figure - show figure selection
        // (e.g., returning user who cleared all data)
        setOnboardingVisible(false);
        setFigureCarousel(true);
      } else {
        // Has history OR has selected figure - show main content
        // Let the session controller restore the previous state
        setOnboardingVisible(false);
        setFigureCarousel(false);
      }
    }

  }, [isHydrated]);
  
  // Single source of truth: read mode from Zustand (no React useState drift)
  const selectedMode = useDomainStore(s => s.mode.selected) as ConversationMode;

  // Conversation state is now handled by useConversationFlow hook

  // Scroll lock via ref-counted hook (mobile menu)
  useBodyScrollLock(isMenuOpen);
  
  // Listen for config changes
  useEffect(() => {
    const handleConfigChanged = () => {
      const newConfig = loadServiceConfig();
      setConfig(newConfig);
    };
    
    window.addEventListener('configChanged', handleConfigChanged);
    
    return () => {
      window.removeEventListener('configChanged', handleConfigChanged);
    };
  }, []);

  // Create refs for council manager dependencies
  const addMessageRef = useRef<((message: any) => void) | null>(null);
  const selectedSeedRef = useRef<Seed | null>(null);
  const conversationStartedRef = useRef(false);

  // Council state and actions (direct Zustand - removed councilAdapter)
  const { config: councilConfig, speaker: currentSpeaker, phase: councilPhase } = useCouncilState();
  const {
    setCouncilConfig: setCouncilConfigAction,
    setCouncilSpeaker,
    setCouncilPhase: setCouncilPhaseAction,
    setCouncilCurrentMessage: setCouncilCurrentMessageAction,
  } = useCouncilActions();
  const { isCouncilMode } = useModeState();
  const { toggleCouncilMode } = useModeActions();

  // Council controller API
  const [councilControllerApi, setCouncilControllerApi] = useState(() => getCouncilControllerApi());
  useEffect(() => subscribeCouncilController(setCouncilControllerApi), []);

  // Council methods (wrap controller API)
  const handleCouncilStart = useCallback(
    async (config: any) => {
      await councilControllerApi.startCouncil(config);
    },
    [councilControllerApi]
  );

  const councilEnd = useCallback(async () => {
    await councilControllerApi.endCouncil();
  }, [councilControllerApi]);

  const resetCouncilMode = useCallback(() => {
    councilControllerApi.resetCouncil();
  }, [councilControllerApi]);

  // Council setters (handle function vs value updates)
  const setIsCouncilMode = useCallback(
    (value: boolean | ((prev: boolean) => boolean)) => {
      const next = typeof value === 'function' ? value(isCouncilMode) : value;
      toggleCouncilMode(Boolean(next));
      if (!next) {
        setCouncilCurrentMessageAction('');
      }
    },
    [isCouncilMode, toggleCouncilMode, setCouncilCurrentMessageAction]
  );

  const setCouncilConfig = useCallback(
    (next: any) => {
      const resolved = typeof next === 'function' ? next(councilConfig ?? null) : next;
      setCouncilConfigAction(resolved ?? null);
    },
    [councilConfig, setCouncilConfigAction]
  );

  const setCurrentSpeaker = useCallback(
    (next: any) => {
      const resolved = typeof next === 'function' ? next(currentSpeaker ?? null) : next;
      setCouncilSpeaker(resolved ?? null);
    },
    [currentSpeaker, setCouncilSpeaker]
  );

  const setCouncilPhase = useCallback(
    (next: any) => {
      const resolved = typeof next === 'function' ? next(councilPhase ?? null) : next;
      setCouncilPhaseAction(resolved ?? null);
    },
    [councilPhase, setCouncilPhaseAction]
  );

  // Create a ref for fetchHistory that will be populated after hooks
  const fetchHistoryRef = useRef<((figureId: string, seedId: string | number, mode?: string | null, preserveMode?: boolean) => Promise<void>) | null>(null);
  const attemptedHistoryKeysRef = useRef<Set<string>>(new Set());

  // Create refs for functions that will be defined later
  const setConversationStartedRef = useRef<((started: boolean) => void) | null>(null);
  const renderSnapshotRef = useRef<Record<string, number>>({});

  const scheduleRenderLog = useCallback((reason: string) => {
    if (!import.meta.env.DEV || typeof window === 'undefined') {
      return undefined;
    }

    const handle = window.requestAnimationFrame(() => {
      const counters = { ...(window.__renderCounter ?? {}) } as Record<string, number>;
      const previous = renderSnapshotRef.current;
      const keys = new Set([...Object.keys(previous), ...Object.keys(counters)]);
      const rows: Array<{ component: string; previous: number; current: number; delta: number }> = [];

      keys.forEach((key) => {
        const prev = previous[key] ?? 0;
        const curr = counters[key] ?? 0;
        const delta = curr - prev;
        if (delta !== 0) {
          rows.push({ component: key, previous: prev, current: curr, delta });
        }
      });

      if (rows.length > 0) {
        const entry = {
          timestamp: new Date().toISOString(),
          reason,
          rows,
        };

        window.__renderMetricsLog = [...(window.__renderMetricsLog ?? []), entry];

        console.groupCollapsed(`[RenderMetrics] ${reason}`);
        console.table(rows);
        console.groupEnd();
      }

      renderSnapshotRef.current = counters;
    });

    return () => window.cancelAnimationFrame(handle);
  }, []);

  // Use the seed manager hook
  const {
    selectedSeed,
    isReviewMode,
    selectSeed,
    markSeedComplete,
    processSeedAcquisitionFromMessage,
    loadDefaultSeedIfNeeded,
    setSelectedSeed
  } = useSeedManager({
    selectedFigure,
    fetchHistory: (...args) => {
      // Use the ref at call time, not at definition time
      if (fetchHistoryRef.current) {
        return fetchHistoryRef.current(...args);
      }
    },
    selectedMode,
    isCouncilMode,
    setConversationStarted: (...args) => {
      // Use the ref at call time, not at definition time
      if (setConversationStartedRef.current) {
        return setConversationStartedRef.current(...args);
      }
    },
    setStoryData,
    setError,
    setIsCouncilMode,
    setCouncilConfig,
    setCurrentSpeaker,
    setCouncilPhase
  });

  // Now use the mode manager hook with selectedSeed available
  const modeManager = useModeManager({
    selectedFigure,
    selectedSeed,
    fetchHistory: (...args) => {
      // Use the ref at call time, not at definition time
      if (fetchHistoryRef.current) {
        return fetchHistoryRef.current(...args);
      }
    },
    isCouncilMode,
    setIsCouncilMode,
    setCouncilConfig,
    setCurrentSpeaker,
    setCouncilPhase,
    setShowModeSelector: setModeSelectorVisible,
    language
  });

  // Wrap handleModeSelect to show helper for seed_conversation mode.
  // Quest mode auto-reset: if the user is entering Quest for a seed that's
  // already in TERMINAL_NOT_EARNED state (history exists, not earned, last
  // figure message has no question mark = verdict shape), wipe history first
  // so the user always lands on a fresh attempt. Mid-attempt and earned
  // states are preserved.
  const handleModeSelect = useCallback(async (mode: string, force = false) => {
    figureSelectHandlingModeRef.current = false;

    // Funnel: anonymous volume, per occurrence, no consent gate and no
    // one-shot. Mode picks are no longer a conversion (picking a chapter said
    // nothing about whether anyone stayed), so this counter is all that is
    // left of them. It sits at the chokepoint every mode start passes through,
    // so quicklinks, smart actions, deep links and the header chip count too,
    // not only picks made in the selector.
    sendFunnelBeacon('mode_selected', {
      figureId: useDomainStore.getState().figures.selectedId ?? undefined,
      mode,
    });

    if (mode === 'challenge') {
      const state = useDomainStore.getState();
      const figureId = state.figures.selectedId;
      const seedId = state.seeds.selectedId;
      if (figureId && seedId) {
        const earnedKey = `completion_${figureId}_${seedId}`;
        const isEarned = LocalStorageAdapter.getString(earnedKey) === 'true';
        if (!isEarned) {
          try {
            const threadKey = STORAGE_KEYS.getChallengeHistory(figureId, seedId);
            const idbHistory = await readHistoryMessages<any>(threadKey);
            if (Array.isArray(idbHistory) && idbHistory.length > 0) {
              const lastAssistant = [...idbHistory]
                .reverse()
                .find((m) => m?.role === 'assistant');
              const text = (lastAssistant?.content || '').trim();
              const looksTerminal = text.length > 80 && !/\?/.test(text);
              if (looksTerminal) {
                if (import.meta.env.DEV) {
                  console.log('[handleModeSelect] auto-resetting non-earned Quest', {
                    figureId,
                    seedId,
                    lastTextPreview: text.slice(0, 80),
                  });
                }
                await restartQuest(figureId, String(seedId));
              }
            }
          } catch (e) {
            console.warn('[handleModeSelect] Quest auto-reset check failed', e);
          }
        }
      }
    }

    // Deferred anchor: a staged landing question names the seed that grounds
    // the first reply, but selecting it any earlier would make the gold door
    // begin the story at the anchor chapter instead of chapter 1. Select it
    // here, where Free Talk actually opens, for the tag's own figure only.
    if (mode === 'free_conversation') {
      const stagedTag = peekAskPrefillTag();
      const figureId = useDomainStore.getState().figures.selectedId;
      if (stagedTag && figureId &&
          (!stagedTag.startsWith('f:') || stagedTag.startsWith(`f:${figureId}:`))) {
        selectAnchorSeedRef.current(figureId, stagedTag);
        // The anchor is part of THIS mode choice, not a fresh figure+seed
        // pick: without the flag, Effect#14 sees the new pair and re-opens
        // the mode wall over the conversation the visitor just entered.
        figureSelectHandlingModeRef.current = true;
      }
    }

    modeManager.handleModeSelect(mode as ConversationMode, force);
  }, [modeManager]);
  handleModeSelectRef.current = handleModeSelect;

  const setPendingRequestId = useDomainStore((state) => state.setPendingRequestId);

  const conversationVM = useConversationVM({
    selectedFigure,
    selectedSeed,
    selectedMode,
    isCouncilMode,
    storyData,
    processSeedAcquisitionFromMessage
  });

  const {
    state: conversationState,
    actions: conversationActions,
    helpers: conversationHelpers
  } = conversationVM;

  const {
    messages,
    conversationStarted: conversationStartedFinal,
    derivedConversationStarted
  } = conversationState;

  const {
    addMessage,
    clearMessages,
    loadMessagesFromHistory,
    resetConversation,
    setMessages,
    setConversationStarted
  } = conversationActions;

  const { getHistoryKey } = conversationHelpers;

  // Conversation effects hook (event listeners, story restoration, etc.)
  useConversationEffects({
    selectedFigure,
    selectedSeed,
    selectedMode,
    conversationMessages: messages,
    language,
    addMessage,
    loadMessagesFromHistory,
    resetConversation,
    fetchHistory: fetchHistoryRef.current || (() => {}),
    getHistoryKey,
    setFirstTextArrived,
    setLoading,
    setTranslationInProgress,
    setIsAudioPlaying,
    setStoryData,
    setConversationStarted,
  });

  // BYOK Modal: disabled for auto-show (WP6 — free tier works without API key)
  // Users who want BYOK can add their key via Settings → API Keys
  // Keeping the modal component + handlers for manual trigger from Settings

  // BYOK Modal handlers
  // Council player state for curated councils via PrismPlayer
  const [councilPlayerId, setCouncilPlayerId] = useState<string | null>(null);
  const [councilPlayerLevel, setCouncilPlayerLevel] = useState<1 | 2>(1);

  const handleCouncilPlayerClose = useCallback(() => {
    setCouncilPlayerId(null);
    setCouncilPlayerLevel(1);
    // Return the user to the council setup modal where they launched from,
    // matching the custom-council flow (which keeps the setup modal mounted
    // beneath the live player). Without this, closing the curated player
    // would drop the user back to the main screen.
    useUIStore.getState().setCouncilSetupOpen(true);
  }, []);

  // Deep-link entry point: open a specific curated council by id. Called from
  // routeAfterOnboarding when a visitor arrives via a theme-page council link.
  const startCuratedCouncilById = useCallback((councilId: string) => {
    setCouncilPlayerId(councilId);
    setCouncilPlayerLevel(1);
  }, []);

  const handlePrismClose = useCallback(() => {
    setConversationStarted(false);
    setModeSelectorVisible(true);
    // Clear Zustand mode so prism doesn't leak to a different figure+seed
    useDomainStore.getState().resetMode();
  }, [setConversationStarted, setModeSelectorVisible]);

  // Ref to store pre-council state
  const preCouncilStateRef = useRef<{
    messages: any[];
    conversationStarted: boolean;
  } | null>(null);

  // Wrap handleCouncilStart to save state before starting
  const handleCouncilStartWithPreservation = useCallback(async (config: any) => {
    // Curated councils → PrismPlayer (bypass controller entirely)
    if (config.curated && config.councilId) {
      setCouncilPlayerId(config.councilId);
      setCouncilPlayerLevel(config.level || 1);
      return;
    }

    // Custom councils → existing chatbox path (unchanged)
    preCouncilStateRef.current = {
      messages: [...messages],
      conversationStarted: conversationStartedFinal
    };

    // Clear messages for council overlay
    setMessages([]);

    // Start council
    await handleCouncilStart(config);
  }, [handleCouncilStart, messages, conversationStartedFinal, setMessages]);

  const handleCouncilEnd = useCallback(async () => {
    // End council first
    await councilEnd();

    // Restore pre-council state
    if (preCouncilStateRef.current) {
      setMessages(preCouncilStateRef.current.messages);
      setConversationStarted(preCouncilStateRef.current.conversationStarted);
      preCouncilStateRef.current = null;
    }

    // Return user to the council catalog instead of dropping them on the
    // home page they came from. The catalog is the natural "back" target
    // for both curated playback and custom-council sessions.
    setCouncilSetupOpen(true);
  }, [councilEnd, setMessages, setConversationStarted, setCouncilSetupOpen]);

  const handleSubmitMessage = useCallback(
    async (input: string) => {
      const text = input?.trim();
      if (!text) {
        return;
      }

      // Content safety screen for all conversation modes
      const safetyResult = screenContent(text);
      if (!safetyResult.safe) {
        const msg = language === 'de'
          ? safetyResult.crisisResources.message.de
          : safetyResult.crisisResources.message.en;
        const topResource = safetyResult.crisisResources.resources[0];
        const resourceLine = language === 'de'
          ? `${topResource.name}: ${topResource.contact} (${topResource.description.de})`
          : `${topResource.name}: ${topResource.contact} (${topResource.description.en})`;
        setError(`${msg}\n\n${resourceLine}`);
        return;
      }

      const figureIdentifier =
        selectedFigure?.id ||
        useDomainStore.getState().figures.selectedId ||
        selectedFigure?.name ||
        '';

      const normalizedMode = selectedMode as ConversationMode | null;
      const isConversationModeActive =
        normalizedMode !== null &&
        [
          ConversationMode.SEED_CONVERSATION,
          ConversationMode.FREE_CONVERSATION,
          ConversationMode.CHALLENGE,
        ].includes(normalizedMode);

      if (
        !isConversationModeActive ||
        !selectedFigure?.id
      ) {
        await processTextMessage(text, figureIdentifier);
        return;
      }

      try {
        addMessage({
          role: 'user',
          content: text,
          figureName: selectedFigure?.name,
          timestamp: new Date().toISOString(),
          mode: normalizedMode ?? ConversationMode.SEED_CONVERSATION,
        });

        setFirstTextArrived(false);
        setLoading(true);
        setTranslationInProgress(true);

        const requestId =
          typeof window !== 'undefined' &&
          window.crypto &&
          typeof window.crypto.randomUUID === 'function'
            ? window.crypto.randomUUID()
            : `req-${Date.now()}`;

        setPendingRequestId(requestId);

        // Stamp the dispatch start for the first_reply time bucket. The raw
        // timestamp stays module-scoped in funnelBeacon; only a coarse bucket
        // index (0-4) ever leaves the browser, with the first_reply beacon.
        markReplyDispatchStart();

        // Funnel: first chat turn this tab (the North Star activation event).
        // Fires for BYOK users too — their chat bypasses the proxy entirely,
        // so this beacon is the only server-visible signal a conversation
        // started. One-shot via tab-scoped sessionStorage, gated on the submit
        // (the assistant has not replied yet), never on assistant count.
        //
        // A send whose text came from a staged question is never a typed first
        // turn. The two steps are separate one-shots, so a visitor who later
        // types something of their own still fires first_turn.
        const stagedOrigin = consumeComposerStagedOrigin();
        sendFunnelBeaconOnce(stagedOrigin ? 'first_turn_prefilled' : 'first_turn', {
          figureId: figureIdentifier,
          mode: normalizedMode ?? '',
        });

        // The carried question opens this conversation: the send itself is
        // labeled 'prefilled' and the first few turns tell the model the
        // question was chosen before the two of them ever spoke.
        if (stagedOrigin) {
          const state = useDomainStore.getState();
          beginCarriedThread(
            state.conversation.historyKey,
            stagedOrigin.anchorSeedId,
            normalizedMode ?? '',
            state.conversation.messages.filter((m) => m?.role === 'user').length,
          );
        }

        // Depth of the chat this turn belongs to. Counted in memory and
        // emitted once, as a bucket, when the chat is left behind — so a
        // conversation that goes ten turns deep is distinguishable from ten
        // one-line openers, without any per-chat row ever being written.
        noteChatTurn(
          useDomainStore.getState().conversation.historyKey,
          normalizedMode ?? undefined,
        );

        // The ad-side twin of first_turn: a conversation really began. Gated
        // on a captured gclid plus ad-measurement consent, and deduped per tab
        // inside sendConversion, so this needs no one-shot of its own.
        void sendConversion(
          'dialogue_started',
          figureIdentifier ? { figureId: figureIdentifier } : undefined,
        );
      } catch (error) {
        console.error('[HomePage] Failed to queue conversation request', error);
        setPendingRequestId(null);
        setTranslationInProgress(false);
        setLoading(false);
        setError('We could not send that message. Please try again.');
        throw error;
      }
    },
    [
      addMessage,
      language,
      selectedFigure,
      selectedMode,
      setError,
      setFirstTextArrived,
      setLoading,
      setPendingRequestId,
      setTranslationInProgress,
    ]
  );


  // Define fetchHistory now that we have all the required functions
  const fetchHistory = useCallback(async (figureId: string, seedId: string | number, mode: string | null = null, preserveMode: boolean = false) => {
    if (!seedId) return;

    // 🎯 CRITICAL: Don't load history while streaming is active - it would overwrite live messages!
    const store = useDomainStore.getState();
    const pendingRequestId = store.conversation.pendingRequestId;
    if (pendingRequestId) {
      if (import.meta.env.DEV) {
        console.log('[HomePage] fetchHistory SKIPPED - streaming in progress', { pendingRequestId });
      }
      return;
    }

    // Clear any pending fetchHistory calls to prevent rapid repeated calls
    if (fetchHistoryTimeoutRef.current) {
      clearTimeout(fetchHistoryTimeoutRef.current);
      fetchHistoryTimeoutRef.current = null;
    }

    const modeToCheck = mode || selectedMode;

    const attemptKey = `${figureId}:${seedId}:${modeToCheck}`;
    if (attemptedHistoryKeysRef.current.has(attemptKey)) {
      return;
    }
    attemptedHistoryKeysRef.current.add(attemptKey);
    
    
    // Compute storage key from the explicit mode we are checking to avoid
    // cross-mode contamination (e.g., using conversation key while in story mode).
    const storageKey = getStorageKeyForMode(modeToCheck, figureId, seedId);
    if (import.meta.env.DEV) {
      console.log('[HomePage] fetchHistory', {
        figureId,
        seedId,
        modeToCheck,
        storageKey,
        preserveMode,
      });
    }

    // Modes like prism have no conversation storage — nothing to load
    if (!storageKey) return;

    // Load from IndexedDB; fallback to LocalStorage if not found
    let storedHistory: unknown = null;
    try {
      storedHistory = await readHistoryMessages<unknown>(storageKey);
      if (import.meta.env.DEV) {
        console.log('[HomePage] fetchHistory IndexedDB result', {
          storageKey,
          hasData: Array.isArray(storedHistory),
        });
      }
    } catch (error) {
      console.error('[HomePage] Failed to load history from IndexedDB', error);
    }
    if (!Array.isArray(storedHistory)) {
      storedHistory = LocalStorageAdapter.getJSON<unknown>(storageKey!, null);
    }

    if (Array.isArray(storedHistory) && storedHistory.length > 0) {
      loadMessagesFromHistory(storedHistory as any[]);
      // Mode is already set correctly before fetchHistory is called — don't override it from history
      return;
    }

    attemptedHistoryKeysRef.current.delete(attemptKey);
  }, [selectedMode, getHistoryKey, clearMessages, setConversationStarted, loadMessagesFromHistory, resetConversation]);

  // Update the refs so hooks can use them
  useEffect(() => {
    fetchHistoryRef.current = fetchHistory;
    setConversationStartedRef.current = setConversationStarted;
    addMessageRef.current = addMessage;
    selectedSeedRef.current = selectedSeed;
    conversationStartedRef.current = conversationStartedFinal;
  }, [fetchHistory, setConversationStarted, addMessage, selectedSeed, conversationStartedFinal]);

  useEffect(() => {
    // DEV safety: ensure historyKey is present when selection is valid and in a conversation mode
    const store = useDomainStore.getState();
    const figureId = store.figures.selectedId;
    const seedId = store.seeds.selectedId;
    const mode = store.mode.selected;
    const isConvo = mode === ConversationMode.SEED_CONVERSATION || mode === ConversationMode.CHALLENGE || mode === ConversationMode.FREE_CONVERSATION;
    if (!figureId || !seedId || !isConvo) return;
    const key = getStorageKeyForMode(mode, figureId, seedId);
    if (!key) return;
    if (store.conversation.historyKey !== key) {
      useDomainStore.getState().setConversationHistoryKey(key);
      if (import.meta.env.DEV) {
        console.log('[Mode2Triage][HomePage] set historyKey proactively', { key });
      }
    }
  });

  useEffect(() => {
    attemptedHistoryKeysRef.current.clear();
  }, [selectedFigure?.id, selectedSeed?.id, selectedMode]);

  useEffect(() => {
    const cleanup = registerSessionControllerHandlers({
      fetchHistory: (figureId, seedId, mode) => {
        const modeValue = mode ?? null;
        if (modeValue === 'seed_conversation' || modeValue === 'challenge' || modeValue === 'free_conversation') {
          return;
        }
        void fetchHistory(figureId, seedId, modeValue, Boolean(mode));
      },
      onSeedsLoaded: async (figureId, seeds) => {
        try {
          await loadDefaultSeedIfNeeded(figureId, seeds);
        } catch (error) {
          console.error('[HomePage] Failed to apply default seed after load', error);
        }
      },
    });

    return cleanup;
  }, [fetchHistory, loadDefaultSeedIfNeeded]);

  useEffect(() => {
    const streamConversation = createLegacyConversationStream();

    const cleanup = registerConversationControllerHandlers({
      streamConversation,
      onStreamingStarted: () => {
        setLoading(true);
        setTranslationInProgress(true);
        setFirstTextArrived(false);
      },
      onStreamingComplete: (_threadKey, _requestId, outcome, error) => {
        setTranslationInProgress(false);
        setLoading(false);
        if (outcome !== 'success') {
          setIsAudioPlaying(false);
        }
        if (outcome === 'error') {
          setError(mapErrorToUserMessage(error, tString));
          // Funnel: the first chat turn errored before any reply chunk
          // arrived (status is not derivable in the chunk handler, so the
          // error variant lives here at the dispatch error site). Shares the
          // first_reply one-shot key with the success beacon in
          // useConversationEffects, so whichever fires first wins and a later
          // success or error never double-fires. Bucket = coarse
          // time-to-failure since dispatch, never raw milliseconds.
          //
          // Gated on the first user turn for the same reason as the success
          // variant: a failed auto-greeting stream must not count as a
          // first_reply before the visitor has sent anything.
          if (hasFiredFirstTurn()) {
            // Read before the beacon below marks first_reply as fired: a
            // failure on a later turn is not a first-reply failure.
            const firstReplyAlreadyLanded = hasFiredFunnelStep('first_reply');
            sendFunnelBeaconOnce('first_reply', {
              outcome: 'error',
              bucket: replyTimeBucketSinceDispatch(),
            });
            // Why it failed. A separate step on purpose: first_reply keeps its
            // exact prior shape, so the weekly answer rate stays comparable
            // across this change while the reason becomes readable.
            if (!firstReplyAlreadyLanded) {
              sendFunnelBeaconOnce('first_reply_failed', {
                outcome: firstReplyFailReason(error),
                bucket: replyTimeBucketSinceDispatch(),
              });
            }
          }
        } else if (outcome === 'aborted') {
          // Typed, then the stream was cancelled before any reply arrived. It
          // costs the visitor the same as an error, so it belongs in the same
          // counter under its own reason.
          if (hasFiredFirstTurn() && !hasFiredFunnelStep('first_reply')) {
            sendFunnelBeaconOnce('first_reply_failed', {
              outcome: 'abort',
              bucket: replyTimeBucketSinceDispatch(),
            });
          }
        }
      },
    });

    return cleanup;
  }, [
    setLoading,
    setTranslationInProgress,
    setFirstTextArrived,
    setIsAudioPlaying,
    setError,
    tString,
  ]);

  // NOTE: Previous "failsafe" useEffect was removed — it re-registered handlers on every
  // pendingRequestId/historyKey change, which REPLACED the main registration above.
  // When its cleanup ran, it cleared ALL handlers (registry uses single activeRegistration),
  // leaving the controller without a streamConversation handler.
  // The main useEffect (above) registers handlers once on mount, and
  // controller.updateHandlers() already retries pending requests when handlers arrive.

  // Load default seed asynchronously when figure is selected but no seed is loaded
  useEffect(() => {
    // CRITICAL: Prevent any seed loading for first-time users
    const hasVisited = useDomainStore.getState().hasVisitedBefore;
    if (!hasVisited) {
      return;
    }
    
    // Only run if we have a figure but no seed
    if (!selectedFigure || selectedSeed || showFigureCarousel || showOnboarding || showWisdomGallery) {
      return;
    }

    // Check if seed was already saved for this figure
    const selectedSeedId = useDomainStore.getState().seeds.selectedId;
    const savedSeed = selectedSeedId
      ? useDomainStore.getState().seeds.byFigure[selectedFigure.id]?.find(s => s.id.toString() === selectedSeedId)
      : null;
    if (savedSeed) {
      // Actually set the seed if found (was previously missing!)
      setSelectedSeed(savedSeed);
      return;
    }
    
    // Load default seed asynchronously using the hook
    const loadDefaultSeed = async () => {
      try {

        // Use the hook's loadFigureSeeds function
        const seeds = await loadFigureSeeds(selectedFigure.id);
        // Same rule as selectFigure: the seed on record for this figure wins
        // over seeds[0]. Without it this effect overwrites a deliberate choice
        // (deep-linked chapter, the ask path's anchor) with chapter one.
        const savedSeed = preferencesAdapter.getSelectedSeed<any>(selectedFigure.id);
        const defaultSeed =
          (savedSeed && seeds.find(s => s.id?.toString() === savedSeed.id?.toString())) ?? seeds[0] ?? null;

        if (defaultSeed) {
          setSelectedSeed(defaultSeed); // Zustand handles persistence in seedsSlice
        }
      } catch (err) {
      }
    };
    
    loadDefaultSeed();
  }, [selectedFigure, selectedSeed, language, showFigureCarousel, showOnboarding, showWisdomGallery, loadFigureSeeds, setSelectedSeed]);

  // Wrapper for backward compatibility (e.g., from Settings)

  // Load conversation history on initial mount if figure and seed are available
  // Effect #13 REMOVED - was causing duplicate history fetches
  // History is now fetched only by Effect #14 below

  useEffect(() => {
    const run = async () => {
      // Skip when handleSelectFigure is actively handling mode selection
      if (figureSelectHandlingModeRef.current) {
        if (import.meta.env.DEV) {
          console.log('[Effect#14] SKIPPED — figureSelect is handling mode');
        }
        return;
      }

      // Skip when handleSeedSelect recently handled mode initialization (within 500ms)
      if (Date.now() - lastSeedSelectTimeRef.current < 500) {
        if (import.meta.env.DEV) {
          console.log('[Effect#14] SKIPPED — handleSeedSelect fired within last 500ms');
        }
        return;
      }

      const hasVisited = useDomainStore.getState().hasVisitedBefore;
      if (!hasVisited) return;
      if (showOnboarding || showWisdomGallery) return;

      if (selectedFigure && selectedSeed) {
        // Ensure FigureCarousel is closed when we have both figure + seed
        setFigureCarousel(false);

        const storedMode = modeStateManager.getStoredMode(selectedFigure.id, selectedSeed.id);
        const currentMode = useDomainStore.getState().mode.selected;

        if (import.meta.env.DEV) {
          console.log('[Effect#14] restoring mode', {
            figureId: selectedFigure.id,
            seedId: selectedSeed.id,
            storedMode,
            currentMode,
          });
        }

        const action = resolveRestoreAction(storedMode, currentMode, selectedFigure.id, selectedSeed.id);
        switch (action.kind) {
          case 'selectStoredMode':
            // Route through handleModeSelect for consistent initialization
            handleModeSelectRef.current(action.mode, true);
            break;
          case 'openModeSelector':
            // NEW figure+seed: let user choose via mode selector
            setModeSelectorVisible(true);
            break;
          case 'markConversationStarted':
            // Prism refresh: prism uses its own player — just mark started so bookmarks + UI work
            useDomainStore.getState().setConversationStarted(true);
            break;
          case 'presetKeyAndSelect':
            // Pre-set historyKey so handleLanguageAutoSelect detects "same key"
            // and skips resetConversationState (avoids race with controller's updateThreadForSelection)
            if (action.historyKey) {
              useDomainStore.getState().setConversationHistoryKey(action.historyKey);
            }
            handleModeSelectRef.current(action.mode, true);
            break;
        }
      }
    };

    void run();
  }, [selectedFigure, selectedSeed, showOnboarding, showWisdomGallery, setFigureCarousel]);

  // Subscribe to seed state changes to update UI when seeds are acquired
  useEffect(() => {
    // This ensures the UI updates when a seed is gathered from any source
    const handleSeedStateChange = (_data: any) => {
      // We don't need to do anything specific here since this component
      // doesn't directly display seed states, but it ensures the next time
      // the user opens the SeedsModal, it will show the updated state
    };

    // Subscribe to seed state changes
    const unsubscribe = seedStateManager.subscribe(handleSeedStateChange);

    return () => {
      unsubscribe();
    };
  }, []);


  // Swipe gesture handling for opening sidebar
  useEffect(() => {
    // Only enable on mobile/tablet
    if (!isMobileOrTablet) return;

    const minSwipeDistance = 50; // Minimum distance for a swipe
    const edgeSwipeZone = 30; // Edge zone width for opening sidebar

    const handleTouchStart = (e: TouchEvent) => {
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY
      };
      touchEndRef.current = null;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!touchStartRef.current) return;

      touchEndRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY
      };
    };

    const handleTouchEnd = () => {
      if (!touchStartRef.current || !touchEndRef.current) return;

      const distanceX = touchEndRef.current.x - touchStartRef.current.x;
      const distanceY = touchEndRef.current.y - touchStartRef.current.y;
      
      // Check if it's more horizontal than vertical
      if (Math.abs(distanceX) > Math.abs(distanceY)) {
        // Opening gesture: swipe right from left edge
        if (!isMenuOpen && touchStartRef.current.x < edgeSwipeZone && distanceX > minSwipeDistance) {
          setMenuOpen(true);
        }
      }

      touchStartRef.current = null;
      touchEndRef.current = null;
    };

    // Only add listeners when menu is closed (for opening gesture)
    if (!isMenuOpen) {
      document.addEventListener('touchstart', handleTouchStart, { passive: true });
      document.addEventListener('touchmove', handleTouchMove, { passive: true });
      document.addEventListener('touchend', handleTouchEnd, { passive: true });
    }

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isMenuOpen, isMobileOrTablet]);

  // Handle quick link actions for desktop navigation
  const handleQuickAction = useCallback((action: string) => {
    switch (action) {
      case 'prism':
        if (selectedFigure && selectedSeed) {
          handleModeSelect('prism');
        }
        break;
      case 'seeds':
        if (selectedFigure && selectedSeed) {
          handleModeSelect('seed_conversation');
        } else {
          handleSeedsOpen();
        }
        break;
      case 'quest':
        if (selectedFigure && selectedSeed) {
          // Clear chatbox and start quest conversation
          resetConversation();
          handleModeSelect('challenge');
        }
        break;
      case 'freetalk':
        if (selectedFigure) {
          // Clear chatbox and start free conversation
          resetConversation();
          handleModeSelect('free_conversation');
        }
        break;
      case 'story':
        if (selectedFigure) {
          resetConversation();
          handleModeSelect('introduction');
        }
        break;
      case 'discover':
        // Open mode selector to discover seeds from freetalk
        handleModeSelectorOpen();
        break;
      case 'modes':
        // Default: open mode selector
        handleModeSelectorOpen();
        break;
      default:
        break;
    }
  }, [selectedFigure, selectedSeed, handleModeSelectorOpen, handleModeSelect, handleSeedsOpen, resetConversation]);
  
  // Pick a specific seed for a figure that was just selected. The store AND
  // the persisted preference both have to be written: the session controller
  // and the default-seed loader read the preference back a moment later, so a
  // store-only selection is overwritten by the figure's default seed.
  const selectSeedForFigure = useCallback((figureId: string, seedId: number | string): boolean => {
    const seeds = useDomainStore.getState().seeds.byFigure[figureId] ?? [];
    const seed = seeds.find((candidate) => String(candidate.id) === String(seedId));
    if (!seed) return false;
    const normalized = { ...seed, id: String(seed.id) };
    useDomainStore.getState().selectSeed(normalized.id);
    preferencesAdapter.setSelectedSeed(figureId, normalized);
    return true;
  }, []);

  // The seed a landing question is anchored to. Selected quietly on the ask
  // path so the first reply stands on the teaching that answers the question
  // instead of whichever seed the figure defaults to. Only some tags name a
  // question with such a teaching: a null anchor means select nothing, because
  // the wrong anchor grounds the reply in material about another question.
  const selectAnchorSeed = useCallback((figureId: string, tag: string): void => {
    const anchorId = resolveAnchorSeedId(figureId, tag);
    if (anchorId !== null) selectSeedForFigure(figureId, anchorId);
  }, [selectSeedForFigure]);
  selectAnchorSeedRef.current = selectAnchorSeed;

  // A question or chapter staged by a public-page door, routed onto the figure
  // that is now selected. Returns true when an intent was consumed. Both figure
  // paths call it, including the same-figure re-select: an unconsumed tag would
  // survive and misfire on the next figure the visitor picks.
  const routeStagedEntryIntent = useCallback((figureId: string, direct = false): boolean => {
    // Effect#14 must not race the mode this sets.
    lastSeedSelectTimeRef.current = Date.now();

    const askIntent = readAskIntent();
    if (askIntent) {
      clearAskIntent();
      const toCeremony = CEREMONY_CARRIED_ENTRY && !direct;
      if (toCeremony) {
        // Leave free_conversation before the stash is announced: a composer
        // still mounted in that mode would consume the question on the spot,
        // and the ceremony would have nothing left to show.
        useDomainStore.getState().setMode(ConversationMode.INTRODUCTION);
      }
      stashAskPrefill(askIntent);
      resetConversation();
      if (toCeremony) {
        setModeSelectorVisible(true);
      } else {
        handleModeSelect('free_conversation', true);
      }
      // handleModeSelect clears the suppression flag on entry, but Effect#14
      // would then see a fresh figure+seed with no stored mode and open the
      // selector over the conversation. Re-assert it: the destination is
      // settled, or the visitor is standing in front of it.
      figureSelectHandlingModeRef.current = true;
      return true;
    }

    // Story deep-link from the hero's chapter beat: open story mode straight
    // at the chapter that was clicked. Chapter N is this figure's seed N.
    const storyIntent = readStoryIntent();
    if (storyIntent) {
      clearStoryIntent();
      if (selectSeedForFigure(figureId, storyIntent.chapter)) {
        setStoryData(null);
        resetConversation();
        handleModeSelect('introduction', true);
        // Same reason as the ask branch: the mode choice IS made, so Effect#14
        // must not reopen the selector over the story.
        figureSelectHandlingModeRef.current = true;
        return true;
      }
    }
    return false;
  }, [selectSeedForFigure, setStoryData, setModeSelectorVisible,
      resetConversation, handleModeSelect]);

  // `direct` marks a destination the visitor already chose inside the app, so
  // the mode ceremony is not offered a second time.
  const handleSelectFigure = useCallback(async (figure: any, options?: { direct?: boolean }) => {
    if (import.meta.env.DEV) {
      console.log('[handleSelectFigure] called', {
        figureId: figure?.id,
        currentFigureId: selectedFigure?.id,
        isSameFigure: selectedFigure?.id === figure?.id,
      });
    }

    // Same figure re-selected — close the carousel, but route anything staged
    // for this figure first instead of dropping it.
    if (selectedFigure && figure.id === selectedFigure.id) {
      setFigureCarousel(false);
      routeStagedEntryIntent(figure.id, options?.direct);
      return;
    }

    // Funnel: organic figure-pick volume. Per-occurrence on purpose (no
    // one-shot dedup): this counts how often figures get picked, not whether
    // one was picked this tab. Every pick path funnels through here (gallery
    // via handleWisdomGallerySelect, carousel, sidebar, deep-link intent), so
    // this is the single chokepoint with no double-count. The same-figure
    // early return above keeps carousel re-closes out of the count.
    sendFunnelBeacon('figure_selected', { figureId: figure?.id });

    // Suppress Effect#14 — we handle mode directly below
    lastSeedSelectTimeRef.current = Date.now();
    figureSelectHandlingModeRef.current = true;

    const result = await selectFigure(figure, {
      resetCouncilMode,
      setShowFigureCarousel: setFigureCarousel,
      setSelectedSeed,
      setStoryData: (data: unknown) => setStoryData(data as any),
    });

    // Re-stamp AFTER async selectFigure completes so Effect#14 stays suppressed
    // for a full 500ms from THIS point (not from before the async call)
    lastSeedSelectTimeRef.current = Date.now();

    useDomainStore.getState().markVisited();

    // Public-page doors: the visitor arrives carrying a question or a chapter.
    // The consumed tag is staged for the composer, which prefills the promised
    // question so the first turn is one tap away, and the destination follows
    // what they chose. Runs for first timers and returning visitors alike
    // (both select paths land here).
    if (routeStagedEntryIntent(figure.id, options?.direct)) return;

    // Reset mode to default before showing ModeSelector
    // This prevents the previous figure's mode (e.g., prism) from leaking into the new figure's UI
    useDomainStore.getState().setMode(ConversationMode.INTRODUCTION);

    if (!result.seed) {
      // No seeds for this figure - still allow mode selection
      resetConversation();
      setStoryData(null);
      setModeSelectorVisible(true);
    } else {
      // Check if user has actual engagement with this seed.
      // The conversation history keys live in IndexedDB only (not localStorage), so
      // checking the LS keys alone returns false-negative for any modern session.
      // modeStateManager.getStoredMode() reads localStorage `modeState_*` which IS
      // written every time the user picks a mode for this seed — strong evidence of
      // prior engagement regardless of where the message array sits.
      const seedId = String(result.seed.id);
      const storedMode = modeStateManager.getStoredMode(figure.id, seedId);
      const hasHistory =
        !!storedMode ||
        !!LocalStorageAdapter.getString(STORAGE_KEYS.getStarSeedHistory(figure.id, seedId)) ||
        !!LocalStorageAdapter.getString(STORAGE_KEYS.getChallengeHistory(figure.id, seedId)) ||
        !!LocalStorageAdapter.getString(STORAGE_KEYS.getFreeTalkHistory(figure.id));

      if (hasHistory) {
        // User has real conversation history — resume their last mode
        handleModeSelect(storedMode || 'introduction', true);
        figureSelectHandlingModeRef.current = false;
      } else {
        // No conversation history — show ModeSelector (Story is the recommended first chapter)
        setModeSelectorVisible(true);
        // Keep flag set until user makes a choice (cleared by handleModeSelect callback)
        // This prevents Effect#14 from overriding the ModeSelector
      }
    }
  }, [selectedFigure, selectFigure, setFigureCarousel, routeStagedEntryIntent,
      setSelectedSeed, setStoryData, setModeSelectorVisible, resetConversation, handleModeSelect]);

  const handleSeedSelect = useCallback((seed: any, forceMode?: string) => {
    // Prevent Effect#14 from racing with our explicit mode selection
    lastSeedSelectTimeRef.current = Date.now();
    // Also block via the figure-select flag to be doubly safe
    if (forceMode && forceMode !== '__open_selector__') {
      figureSelectHandlingModeRef.current = true;
      // Reset after Effect#14 has had a chance to run
      setTimeout(() => { figureSelectHandlingModeRef.current = false; }, 600);
    }

    selectSeed(seed);

    // Ensure FigureCarousel is closed when a seed is selected
    setFigureCarousel(false);

    if (forceMode === '__open_selector__') {
      // "More Paths" — select seed but let user choose mode
      setModeSelectorVisible(true);
      return;
    }

    if (forceMode) {
      // Smart button: force specific mode (e.g. "Listen to Story" → 'introduction')
      handleModeSelect(forceMode, true);
    } else {
      // Check if user has actual engagement with this seed. Conversation history
      // lives in IndexedDB; only the modeState preference is reliably in localStorage,
      // so we must include it in the engagement check or false-negative on every resume.
      const figureId = useDomainStore.getState().figures.selectedId;
      const seedId = String(seed.id);
      const storedMode = figureId ? modeStateManager.getStoredMode(figureId, seedId) : null;
      const hasHistory = !!figureId && (
        !!storedMode ||
        !!LocalStorageAdapter.getString(STORAGE_KEYS.getStarSeedHistory(figureId, seedId)) ||
        !!LocalStorageAdapter.getString(STORAGE_KEYS.getChallengeHistory(figureId, seedId)) ||
        !!LocalStorageAdapter.getString(STORAGE_KEYS.getFreeTalkHistory(figureId))
      );

      if (hasHistory) {
        // User has real conversation history — resume their last mode
        handleModeSelect(storedMode || 'introduction', true);
      } else {
        // No conversation history — let user choose their path
        setModeSelectorVisible(true);
      }
    }
  }, [selectSeed, handleModeSelect, setFigureCarousel, setModeSelectorVisible]);
  
  // Expose the seed selection function globally for the figure carousel to access
  useEffect(() => {
    window.handleSeedSelect = handleSeedSelect;
    
    return () => {
      // Clean up when component unmounts
      delete window.handleSeedSelect;
    };
  }, [handleSeedSelect]);

  // handleSeedComplete - called when user finishes a mode (scroll-to-bottom, audio end, etc.)
  const handleSeedComplete = (seedId: string | number | undefined) => {
    if (seedId !== undefined) {
      const currentMode = useDomainStore.getState().mode.selected;
      const figureId = useDomainStore.getState().figures.selectedId;

      if (currentMode === 'introduction' && figureId) {
        // Story mode: only mark story as completed, NOT quest
        markStoryCompleted(figureId, seedId);
      } else if (currentMode === ConversationMode.CHALLENGE) {
        // Quest mode: mark seed as gathered (quest completion)
        markSeedComplete(seedId);
      }
      // Other modes (wisdom, prism) handle their own completion elsewhere
    }
  };

  // Use the seed translation hook to get translated seed titles
  const { getTranslatedSeedTitle } = useSeedTranslation();
  
  // Get helper functions from the hook
  const helperFunctions = useHelperFunctions({
    selectedFigure,
    selectedSeed,
    language,
    getTranslatedSeedTitle,
    t: (key: string, params?: Record<string, any>) => tString(key, params?.fallback),
    handleOnboardingClose,
    handleWisdomGalleryOpen,
    handleWisdomGalleryCloseComplete,
    handleModeSelectorOpen,
    handleModeSelect,
    handleFigureCarouselOpen,
    handleSelectFigure,
    getFigureById,
    startCuratedCouncilById
  });
  
  const {
    getTranslatedFigureName,
    getCurrentSeedName,
    handleOnboardingComplete,
    handleOnboardingSkip,
    handleWisdomGallerySelect,
    handleWisdomGalleryExploreAll
  } = helperFunctions;

  // Council end-state handoff: close the player and open a Free Talk with one
  // of the council's figures, the heard question staged in the composer (the
  // ask-link rails). The one moment a listener is warm goes into the North
  // Star instead of back to the catalog.
  const handleCouncilHandoff = useCallback(
    async (figureId: string, question: string) => {
      setCouncilPlayerId(null);
      setCouncilPlayerLevel(1);
      const figure = getFigureById(figureId);
      if (!figure) {
        // Unknown figure — fall back to the catalog like a normal close.
        useUIStore.getState().setCouncilSetupOpen(true);
        return;
      }
      stageCouncilHandoff(question);
      if (selectedFigure && figure.id === selectedFigure.id) {
        // Same figure already selected: handleSelectFigure would early-return
        // before the ask-intent branch, so run its tail directly.
        clearAskIntent();
        resetConversation();
        handleModeSelect('free_conversation', true);
        return;
      }
      // Direct: taking the end card IS the choice, so no second ceremony.
      await handleSelectFigure(figure, { direct: true });
    },
    [selectedFigure, handleSelectFigure, handleModeSelect, resetConversation]
  );

  // "Tiefer eintauchen" from the council end state: same council, level 2.
  const handleCouncilGoDeeper = useCallback((councilId: string) => {
    setCouncilPlayerId(councilId);
    setCouncilPlayerLevel(2);
  }, []);

  const mainContentSession = useMemo(
    () => ({
      showFigureCarousel,
      isCouncilMode,
      councilConfig,
      selectedFigure,
      selectedSeed,
      selectedMode,
      isReviewMode,
      cosmicCouncilService,
      handleSelectFigure,
      handleCouncilEnd,
      handleSeedComplete,
      councilPlayerId,
      councilPlayerLevel,
      handleCouncilPlayerClose,
      handleCouncilHandoff,
      handleCouncilGoDeeper,
      handlePrismClose,
      handleModeSelectorOpen,
      handleFigureCarouselOpen,
      handleFigureCarouselClose
    }),
    [
      showFigureCarousel,
      isCouncilMode,
      councilConfig,
      selectedFigure,
      selectedSeed,
      selectedMode,
      isReviewMode,
      cosmicCouncilService,
      handleSelectFigure,
      handleCouncilEnd,
      handleSeedComplete,
      councilPlayerId,
      councilPlayerLevel,
      handleCouncilPlayerClose,
      handleCouncilHandoff,
      handleCouncilGoDeeper,
      handlePrismClose,
      handleModeSelectorOpen,
      handleFigureCarouselOpen,
      handleFigureCarouselClose
    ]
  );

  const mainContentApp = useMemo(
    () => ({
      config,
      loading,
      translationInProgress,
      firstTextArrived,
      isAudioPlaying,
      storyData,
      setError
    }),
    [
      config,
      loading,
      translationInProgress,
      firstTextArrived,
      isAudioPlaying,
      storyData,
      setError
    ]
  );

  const mainContentTranslations = useMemo(
    () => ({
      t: tString,
      MODES,
      getTranslatedFigureName,
      getCurrentSeedName
    }),
    [tString, MODES, getTranslatedFigureName, getCurrentSeedName]
  );

  // A returning visitor's archive was unreachable until they started something
  // new. Same stored-history signal the resume path uses: the mode preference
  // is the reliable one, the conversation messages sit in IndexedDB.
  const selectedFigureHasStoredHistory = useMemo(() => {
    if (!NAV_BATCH) return false;
    const figureId = selectedFigure?.id;
    if (!figureId) return false;
    if (LocalStorageAdapter.getString(STORAGE_KEYS.getFreeTalkHistory(figureId))) return true;
    const seedId = selectedSeed?.id != null ? String(selectedSeed.id) : null;
    if (!seedId) return false;
    return (
      !!modeStateManager.getStoredMode(figureId, seedId) ||
      !!LocalStorageAdapter.getString(STORAGE_KEYS.getStarSeedHistory(figureId, seedId)) ||
      !!LocalStorageAdapter.getString(STORAGE_KEYS.getChallengeHistory(figureId, seedId))
    );
  }, [selectedFigure?.id, selectedSeed?.id]);

  // The archive door in the fresh state did not exist before the bar's widened
  // gate, so the intent behind it was unmeasurable. Counted only there, so the
  // number keeps answering that one question.
  const handleHistoryQuickLink = useCallback(() => {
    if (NAV_BATCH && !conversationStartedFinal && !derivedConversationStarted) {
      sendFunnelBeacon('nav_open', { figureId: selectedFigure?.id, mode: 'history_fresh' });
    }
    handleHistoryModalOpen();
  }, [conversationStartedFinal, derivedConversationStarted, selectedFigure?.id, handleHistoryModalOpen]);

  const mainContentQuickActions = useMemo(
    () => ({
      showQuickLinkBar: !showFigureCarousel && !isCouncilMode &&
        (conversationStartedFinal || derivedConversationStarted || selectedFigureHasStoredHistory),
      handleQuickAction,
      handleHistoryModalOpen: handleHistoryQuickLink
    }),
    [showFigureCarousel, isCouncilMode, conversationStartedFinal, derivedConversationStarted, selectedFigureHasStoredHistory, handleQuickAction, handleHistoryQuickLink]
  );

  useEffect(() => scheduleRenderLog('initial-mount'), [scheduleRenderLog]);

  useEffect(
    () => scheduleRenderLog(`figure-seed:${selectedFigure?.id ?? 'none'}:${selectedSeed?.id ?? 'none'}`),
    [scheduleRenderLog, selectedFigure?.id, selectedSeed?.id]
  );

  useEffect(
    () =>
      scheduleRenderLog(
        `modal-state:h=${Number(isHistoryModalOpen)}-s=${Number(isSeedsOpen)}-m=${Number(showModeSelector)}-o=${Number(showOnboarding)}-g=${Number(showWisdomGallery)}`
      ),
    [scheduleRenderLog, isHistoryModalOpen, isSeedsOpen, showModeSelector, showOnboarding, showWisdomGallery]
  );

  useEffect(
    () => scheduleRenderLog(`council:${Number(isCouncilMode)}-conversation:${Number(conversationStartedFinal)}`),
    [scheduleRenderLog, isCouncilMode, conversationStartedFinal]
  );

  const { name: storedUserName, email: storedUserEmail} = useDomainStore.getState().userProfile;

  return (
    <div className="homepage">
      {/* Mobile Navigation: PeekingFAB - show when not in special modes */}
      {isMobileOrTablet && (
        <PeekingFAB
          user={{
            name: storedUserName || 'Guest',
            email: storedUserEmail ?? undefined,
            avatar: undefined
          }}
          onMenuOpen={() => setMenuOpen(true)}
          isMenuOpen={isMenuOpen}
          isVisible={!showOnboarding && !showFigureCarousel && !isCouncilMode && !showWisdomGallery}
        />
      )}

      {/* World-class mobile menu overlay */}
      {isMenuOpen && (
        <div 
          className="mobile-menu-overlay"
          onClick={handleMenuClose}
          aria-hidden="true"
        />
      )}

      <Sidebar
        selectedFigure={selectedFigure}
        onSelectFigure={handleSelectFigure}
        isOpen={isMenuOpen}
        onClose={handleMenuClose}
        hideOnDesktop={showFigureCarousel}
        isCouncilMode={isCouncilMode}
        councilConfig={councilConfig}
        onCouncilStart={handleCouncilStartWithPreservation}
      />

      <MainContentContainer
        session={mainContentSession}
        app={mainContentApp}
        conversation={conversationVM}
        translations={mainContentTranslations}
        quickActions={mainContentQuickActions}
        onSubmitMessage={handleSubmitMessage}
      />

      <ModalsContainer
        // History Modal props
        isHistoryModalOpen={isHistoryModalOpen}
        handleHistoryModalClose={handleHistoryModalClose}
        selectedFigure={selectedFigure}
        selectedSeed={selectedSeed}
        fetchHistory={fetchHistory}
        resetConversation={resetConversation}

        // Mode Selector props
        showModeSelector={showModeSelector}
        handleModeSelectorClose={handleModeSelectorClose}
        handleModeSelect={handleModeSelect}
        selectedMode={selectedMode}

        // Seeds Modal props
        isSeedsOpen={isSeedsOpen}
        handleSeedsClose={handleSeedsClose}
        handleSeedSelect={handleSeedSelect}

        // Onboarding props
        showOnboarding={showOnboarding}
        handleOnboardingComplete={handleOnboardingComplete}
        handleOnboardingSkip={handleOnboardingSkip}

        // Wisdom Gallery props
        showWisdomGallery={showWisdomGallery}
        handleWisdomGalleryClose={handleWisdomGalleryClose}
        handleWisdomGallerySelect={handleWisdomGallerySelect}
        handleWisdomGalleryExploreAll={handleWisdomGalleryExploreAll}
      />

      {error && (
        <div className="error-message">
          {error}
          <RippleButton
            onClick={() => setError(null)}
            variant="coral"
            size="small"
          >
            {tNode('common.dismiss')}
          </RippleButton>
        </div>
      )}

      {/* Floating buttons removed - now integrated into sidebar */}

      {/* Prismatic Bloom: post-dialogue invite card.
          Held while the voice still speaks (the card lands on the stop-voice
          pill's spot and would cover it) and while the story handoff card is
          up (one CTA at a time). The pending-invite store keeps it alive, so
          it appears the moment the gate opens. */}
      {bloomInvite && !isAudioPlaying && !storyHandoffActive && !isSeedsOpen && !showOnboarding && (
        <PostDialogueBloomInvite
          count={bloomInvite.count}
          onTap={() => {
            clearPendingInvite();
            setBloomInvite(null);
            setSeedsOpen(true);
          }}
          onDismiss={() => {
            clearPendingInvite();
            setBloomInvite(null);
          }}
        />
      )}

      {/* Quest verdict (not earned): Try Again / Deepen Wisdom / Later.
          Suppressed if a bloom invite is active so cards never stack, and
          held while the voice speaks (same slot as the stop-voice pill). */}
      {questVerdict && !bloomInvite && !isAudioPlaying && !isSeedsOpen && !showOnboarding && (
        <PostQuestVerdictCard
          onTryAgain={async () => {
            await restartQuest(questVerdict.figureId, questVerdict.seedId);
            setQuestVerdict(null);
            handleModeSelect('challenge', true);
          }}
          onDeepenWisdom={() => {
            clearPendingQuestVerdict();
            setQuestVerdict(null);
            handleModeSelect('seed_conversation', true);
          }}
          onDismiss={() => {
            clearPendingQuestVerdict();
            setQuestVerdict(null);
          }}
        />
      )}
    </div>
  );
};

export default HomePage;
