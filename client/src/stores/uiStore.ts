import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

interface ModalsState {
  menuOpen: boolean;
  figureCarouselOpen: boolean;
  historyOpen: boolean;
  seedsOpen: boolean;
  modeSelectorOpen: boolean;
  onboardingOpen: boolean;
  wisdomGalleryOpen: boolean;
  councilSetupOpen: boolean;
}

interface LoadingStateMap {
  [key: string]: boolean;
}

interface ErrorStateMap {
  [key: string]: string | null;
}

interface HelpDismissedMap {
  [helpId: string]: boolean;
}

export interface UIState {
  modals: ModalsState;
  loading: LoadingStateMap;
  errors: ErrorStateMap;
  helpDismissed: HelpDismissedMap;
}

export interface UIActions {
  openMenu: () => void;
  closeMenu: () => void;
  toggleMenu: () => void;
  setMenuOpen: (value: boolean | ((prev: boolean) => boolean)) => void;
  openFigureCarousel: () => void;
  closeFigureCarousel: () => void;
  setFigureCarouselOpen: (value: boolean) => void;
  openHistoryModal: () => void;
  closeHistoryModal: () => void;
  setHistoryModalOpen: (value: boolean) => void;
  openSeedsModal: () => void;
  closeSeedsModal: () => void;
  setSeedsModalOpen: (value: boolean) => void;
  openModeSelector: () => void;
  closeModeSelector: () => void;
  setModeSelectorOpen: (value: boolean) => void;
  openOnboarding: () => void;
  closeOnboarding: () => void;
  setOnboardingOpen: (value: boolean) => void;
  openWisdomGallery: () => void;
  closeWisdomGallery: () => void;
  setWisdomGalleryOpen: (value: boolean) => void;
  openCouncilSetup: () => void;
  closeCouncilSetup: () => void;
  setCouncilSetupOpen: (value: boolean) => void;
  setUILoading: (key: string, loading: boolean) => void;
  setUIError: (key: string, error: string | null) => void;
  resetUIErrors: () => void;
  closeAllModals: () => void;
  dismissHelp: (helpId: string) => void;
  shouldShowHelp: (helpId: string) => boolean;
  resetHelpPreferences: () => void;
}

export type UIStoreState = UIState & UIActions;

// Bootstrap help preferences from legacy userPreferences storage
const PREFERENCES_KEY = 'agora_cosmica_user_preferences';

const bootstrapHelpPreferences = (): HelpDismissedMap => {
  try {
    if (typeof localStorage === 'undefined') {
      return {};
    }
    // One-time migration: once the zustand persist entry exists it is the
    // source of truth. Re-reading the legacy key on every load would merge old
    // dismissals back in and silently undo "reset help hints" in Settings.
    if (localStorage.getItem('ui-store')) {
      return {};
    }
    const stored = localStorage.getItem(PREFERENCES_KEY);
    if (!stored) {
      return {};
    }
    const parsed = JSON.parse(stored);
    // Extract UI help preferences from legacy structure
    return parsed?.ui || {};
  } catch (error) {
    console.error('Failed to bootstrap help preferences:', error);
    return {};
  }
};

const initialUIState: UIState = {
  modals: {
    menuOpen: false,
    figureCarouselOpen: false,
    historyOpen: false,
    seedsOpen: false,
    modeSelectorOpen: false,
    onboardingOpen: false,
    wisdomGalleryOpen: false,
    councilSetupOpen: false,
  },
  loading: {},
  errors: {},
  helpDismissed: bootstrapHelpPreferences(),
};

export const useUIStore = create<UIStoreState>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialUIState,
        openMenu: () => set((state) => ({ modals: { ...state.modals, menuOpen: true } })),
        closeMenu: () => set((state) => ({ modals: { ...state.modals, menuOpen: false } })),
        toggleMenu: () =>
          set((state) => ({ modals: { ...state.modals, menuOpen: !state.modals.menuOpen } })),
        setMenuOpen: (value) =>
          set((state) => ({
            modals: {
              ...state.modals,
              menuOpen:
                typeof value === 'function'
                  ? (value as (previous: boolean) => boolean)(state.modals.menuOpen)
                  : value,
            },
          })),
        openFigureCarousel: () =>
          set((state) => ({ modals: { ...state.modals, figureCarouselOpen: true } })),
        closeFigureCarousel: () =>
          set((state) => ({ modals: { ...state.modals, figureCarouselOpen: false } })),
        setFigureCarouselOpen: (value) =>
          set((state) => ({ modals: { ...state.modals, figureCarouselOpen: value } })),
        setHistoryModalOpen: (value) =>
          set((state) => ({ modals: { ...state.modals, historyOpen: value } })),
        openHistoryModal: () => get().setHistoryModalOpen(true),
        closeHistoryModal: () => get().setHistoryModalOpen(false),
        setSeedsModalOpen: (value) =>
          set((state) => ({ modals: { ...state.modals, seedsOpen: value } })),
        openSeedsModal: () => get().setSeedsModalOpen(true),
        closeSeedsModal: () => get().setSeedsModalOpen(false),
        setModeSelectorOpen: (value) =>
          set((state) => ({ modals: { ...state.modals, modeSelectorOpen: value } })),
        openModeSelector: () => get().setModeSelectorOpen(true),
        closeModeSelector: () => get().setModeSelectorOpen(false),
        setOnboardingOpen: (value) =>
          set((state) => ({ modals: { ...state.modals, onboardingOpen: value } })),
        openOnboarding: () => get().setOnboardingOpen(true),
        closeOnboarding: () => get().setOnboardingOpen(false),
        setWisdomGalleryOpen: (value) =>
          set((state) => ({ modals: { ...state.modals, wisdomGalleryOpen: value } })),
        openWisdomGallery: () => get().setWisdomGalleryOpen(true),
        closeWisdomGallery: () => get().setWisdomGalleryOpen(false),
        setCouncilSetupOpen: (value) =>
          set((state) => ({ modals: { ...state.modals, councilSetupOpen: value } })),
        openCouncilSetup: () => get().setCouncilSetupOpen(true),
        closeCouncilSetup: () => get().setCouncilSetupOpen(false),
        closeAllModals: () =>
          set(() => ({
            modals: { ...initialUIState.modals },
          })),
        setUILoading: (key, loading) => set((state) => ({ loading: { ...state.loading, [key]: loading } })),
        setUIError: (key, error) => set((state) => ({ errors: { ...state.errors, [key]: error } })),
        resetUIErrors: () => set(() => ({ errors: {} })),
        dismissHelp: (helpId) => {
          set((state) => ({
            helpDismissed: { ...state.helpDismissed, [helpId]: true }
          }));
        },
        shouldShowHelp: (helpId) => {
          const state = get();
          return !state.helpDismissed[helpId];
        },
        resetHelpPreferences: () => {
          set(() => ({ helpDismissed: {} }));
        },
      }),
      {
        name: 'ui-store',
        partialize: (state) => ({
          // Persist modal states that should survive refresh
          modals: {
            menuOpen: state.modals.menuOpen,
            historyOpen: state.modals.historyOpen,
            seedsOpen: state.modals.seedsOpen,
            wisdomGalleryOpen: state.modals.wisdomGalleryOpen,
            // Don't persist transient UI states:
            // figureCarouselOpen, modeSelectorOpen, onboardingOpen
          },
          // Persist help preferences (migrated from manual localStorage)
          helpDismissed: state.helpDismissed,
          // Don't persist runtime state: loading, errors
        }),
        // Deep merge to preserve non-persisted modal fields (figureCarouselOpen, etc.)
        merge: (persistedState, currentState) => {
          const persisted = persistedState as Partial<UIState> | undefined;
          return {
            ...currentState,
            modals: {
              ...currentState.modals,
              ...(persisted?.modals ?? {}),
            },
            helpDismissed: {
              ...currentState.helpDismissed,
              ...(persisted?.helpDismissed ?? {}),
            },
          };
        },
        // Debug logging for hydration verification (remove in production if noisy)
        onRehydrateStorage: () => (state, error) => {
          if (error) {
            console.error('[uiStore] Hydration failed:', error);
          } else if (import.meta.env.DEV) {
            console.log('[uiStore] Hydrated from localStorage:', {
              modals: state?.modals,
              helpDismissedKeys: state?.helpDismissed ? Object.keys(state.helpDismissed) : [],
            });
          }
        },
      }
    ),
    {
      name: 'ui-store',
    }
  )
);
