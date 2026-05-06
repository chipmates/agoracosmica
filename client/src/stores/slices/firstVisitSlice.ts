// src/stores/slices/firstVisitSlice.ts
// First Visit Tracking Slice - Onboarding and discovery progression

/**
 * Storage key constants
 */
const STORAGE_KEYS = {
  VISITED: 'agora-cosmica-visited',
  FIRST_SELECTION: 'agora-cosmica-first-selection',
  DISCOVERY_COUNT: 'agora-cosmica-discovered-count'
} as const;

/**
 * First visit state structure
 */
export interface FirstVisitState {
  visited: boolean;
  visitDate: string | null;
  firstSelection: string | null;
  discoveryCount: number;
}

/**
 * Progression statistics structure
 */
export interface ProgressionStats {
  isFirstTime: boolean;
  firstSelection: string | null;
  totalDiscovered: number;
  daysSinceFirstVisit: number | null;
}

/**
 * First visit actions
 */
export interface FirstVisitActions {
  hasVisited: () => boolean;
  markAsVisited: (selectedFigure?: string) => void;
  incrementDiscoveryCount: () => void;
  getProgressionStats: () => ProgressionStats;
  resetFirstVisitStatus: () => void;
}

export type FirstVisitSlice = FirstVisitState & FirstVisitActions;

/**
 * Bootstrap first visit data from localStorage on init
 */
const bootstrapFirstVisit = (): FirstVisitState => {
  try {
    if (typeof localStorage === 'undefined') {
      return {
        visited: false,
        visitDate: null,
        firstSelection: null,
        discoveryCount: 0
      };
    }

    const visitDate = localStorage.getItem(STORAGE_KEYS.VISITED);
    const firstSelection = localStorage.getItem(STORAGE_KEYS.FIRST_SELECTION);
    const discoveryCount = parseInt(localStorage.getItem(STORAGE_KEYS.DISCOVERY_COUNT) || '0', 10);

    return {
      visited: visitDate !== null,
      visitDate: visitDate,
      firstSelection: firstSelection,
      discoveryCount: discoveryCount || 0
    };
  } catch (error) {
    console.error('Failed to bootstrap first visit data:', error);
    return {
      visited: false,
      visitDate: null,
      firstSelection: null,
      discoveryCount: 0
    };
  }
};

/**
 * Create first visit slice
 */
export const createFirstVisitSlice = (
  set: any,
  get: any
): FirstVisitSlice => {
  // Bootstrap from localStorage ONCE on init
  const initial = bootstrapFirstVisit();

  return {
    // Initial state (bootstrapped from localStorage)
    visited: initial.visited,
    visitDate: initial.visitDate,
    firstSelection: initial.firstSelection,
    discoveryCount: initial.discoveryCount,

    // Actions
    hasVisited: () => {
      return get().visited;
    },

    markAsVisited: (selectedFigure?: string) => {
      const timestamp = new Date().toISOString();

      set((state: any) => ({
        visited: true,
        visitDate: timestamp,
        firstSelection: selectedFigure || state.firstSelection,
        discoveryCount: selectedFigure ? 1 : state.discoveryCount
      }));
    },

    incrementDiscoveryCount: () => {
      set((state: any) => ({
        discoveryCount: state.discoveryCount + 1
      }));
    },

    getProgressionStats: () => {
      const state = get();

      let daysSinceFirstVisit: number | null = null;
      if (state.visitDate) {
        const firstVisit = new Date(state.visitDate);
        const now = new Date();
        daysSinceFirstVisit = Math.floor((now.getTime() - firstVisit.getTime()) / (1000 * 60 * 60 * 24));
      }

      return {
        isFirstTime: !state.visited,
        firstSelection: state.firstSelection,
        totalDiscovered: state.discoveryCount,
        daysSinceFirstVisit
      };
    },

    resetFirstVisitStatus: () => {
      set(() => ({
        visited: false,
        visitDate: null,
        firstSelection: null,
        discoveryCount: 0
      }));
    }
  };
};
