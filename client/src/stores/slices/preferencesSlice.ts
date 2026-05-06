// src/stores/slices/preferencesSlice.ts
// UI Preferences Slice - Onboarding, User Profile, Service Config, First Visit tracking

import { preferencesAdapter } from '../../storage/preferencesAdapter';
import { preferencesIndexedDbAdapter } from '../../storage/preferencesIndexedDbAdapter';

export interface OnboardingStatus {
  complete: boolean;
  skipped: boolean;
  forceShow: boolean; // Force onboarding to show even if completed
}

export interface UserProfile {
  name: string;
  email: string;
}

export interface ServiceConfig {
  raw: string | null;
  parsed: Record<string, any> | null;
}

export interface PreferencesState {
  onboarding: OnboardingStatus;
  hasVisitedBefore: boolean;
  userProfile: UserProfile;
  serviceConfig: ServiceConfig;
}

export interface PreferencesActions {
  // Onboarding actions
  setOnboardingStatus: (status: OnboardingStatus) => void;
  completeOnboarding: () => void;
  skipOnboarding: () => void;
  resetOnboarding: () => void;
  setForceOnboarding: (value: boolean) => void;

  // First visit tracking
  markVisited: () => void;

  // User profile actions
  setUserProfile: (profile: Partial<UserProfile>) => void;
  hydrateUserProfile: () => Promise<void>;

  // Service config actions
  setServiceConfig: (config: { raw: string | null; parsed: Record<string, any> | null }) => void;
}

export type PreferencesSlice = PreferencesState & PreferencesActions;

// Bootstrap preferences from localStorage on init
const bootstrapPreferences = (): PreferencesState => {
  const baseOnboarding = preferencesAdapter.getOnboardingStatus();
  return {
    onboarding: {
      ...baseOnboarding,
      forceShow: preferencesAdapter.shouldForceOnboarding(),
    },
    hasVisitedBefore: preferencesAdapter.hasVisitedBefore(),
    userProfile: { name: '', email: '' },
    serviceConfig: { ...preferencesAdapter.getServiceConfig(), parsed: null },
  };
};

export const createPreferencesSlice = (
  set: any,
  get: any
): PreferencesSlice => {
  // Bootstrap from localStorage ONCE on init
  const initial = bootstrapPreferences();

  return {
    // Initial state (bootstrapped from localStorage)
    onboarding: initial.onboarding,
    hasVisitedBefore: initial.hasVisitedBefore,
    userProfile: initial.userProfile,
    serviceConfig: initial.serviceConfig,

    // Onboarding actions (persist middleware handles storage automatically)
    setOnboardingStatus: (status: OnboardingStatus) => {
      set((state: any) => ({
        onboarding: status
      }));
    },

    completeOnboarding: () => {
      const status: OnboardingStatus = { complete: true, skipped: false, forceShow: false };
      set((state: any) => ({ onboarding: status }));
    },

    skipOnboarding: () => {
      const status: OnboardingStatus = { complete: false, skipped: true, forceShow: false };
      set((state: any) => ({ onboarding: status }));
    },

    resetOnboarding: () => {
      const status: OnboardingStatus = { complete: false, skipped: false, forceShow: false };
      set((state: any) => ({ onboarding: status }));
    },

    setForceOnboarding: (value: boolean) => {
      set((state: any) => ({
        onboarding: { ...state.onboarding, forceShow: value }
      }));
    },

    // First visit tracking (persist middleware handles storage automatically)
    markVisited: () => {
      set((state: any) => ({ hasVisitedBefore: true }));
      // Sync to localStorage so figureAdapter.ts and other direct readers see it
      preferencesAdapter.markVisited();
    },

    // User profile actions, stored in IndexedDB
    setUserProfile: (profile: Partial<UserProfile>) => {
      set((state: any) => ({
        userProfile: { ...state.userProfile, ...profile }
      }));
    },

    hydrateUserProfile: async () => {
      try {
        const profile = await preferencesIndexedDbAdapter.getUserProfile();
        if (profile.name) {
          set(() => ({
            userProfile: { name: profile.name || '', email: '' }
          }));
        }
        // Clean up legacy plaintext localStorage keys (one-time migration)
        localStorage.removeItem('userName');
        localStorage.removeItem('userEmail');
      } catch (error) {
        console.error('[Preferences] Failed to hydrate user profile:', error);
      }
    },

    // Service config actions (persist middleware handles storage automatically)
    setServiceConfig: (config: { raw: string | null; parsed: Record<string, any> | null }) => {
      set((state: any) => ({ serviceConfig: config }));
    },
  };
};
