/**
 * Utilities to manage user state and onboarding
 */

import { LocalStorageAdapter } from '../storage/localAdapter';
import { useDomainStore } from '../stores';

/**
 * Storage key prefixes for conversation history
 */
export const HISTORY_PREFIXES: readonly string[] = [
  'story_content_',
  'starseed_',
  'challenge_',
  'freetalk_',
  'prism_content_'
] as const;

/**
 * Checks if the user is new based on the absence of chat history and preferences
 * @returns True if the user appears to be new
 */
export const isNewUser = (): boolean => {
  // Check if any history exists (updated for new storage system)
  const hasAnyHistory: boolean = LocalStorageAdapter.keys().some((key) =>
    HISTORY_PREFIXES.some((prefix) => key.startsWith(prefix))
  );
  
  // Check if any figure has been selected
  const hasSelectedFigure: string | null = useDomainStore.getState().figures.selectedId;

  // Check if onboarding was already completed
  const { complete: onboardingCompletedFlag, skipped: onboardingSkippedFlag } = useDomainStore.getState().onboarding;

  // Check if onboarding was skipped
  const onboardingCompleted = onboardingCompletedFlag ? 'true' : null;
  const onboardingSkipped = onboardingSkippedFlag ? 'true' : null;
  
  // User is new if:
  // 1. They have no conversation history AND
  // 2. They haven't selected a figure AND
  // 3. They haven't completed or skipped onboarding
  return !hasAnyHistory &&
         !hasSelectedFigure &&
         !onboardingCompleted &&
         !onboardingSkipped;
};

/**
 * Checks if the user skipped onboarding but hasn't started a conversation
 * @returns True if the user should be reminded about onboarding
 */
export const shouldRemindOnboarding = (): boolean => {
  // User skipped onboarding
  const { skipped } = useDomainStore.getState().onboarding;
  
  // But hasn't had any conversations yet (updated for new storage system)
  const hasAnyHistory: boolean = LocalStorageAdapter.keys().some((key) =>
    HISTORY_PREFIXES.some((prefix) => key.startsWith(prefix))
  );
  
  return skipped && !hasAnyHistory;
};

/**
 * Marks onboarding as complete
 */
export const completeOnboarding = (): void => {
  useDomainStore.getState().completeOnboarding();
};

/**
 * Marks onboarding as skipped
 */
export const skipOnboarding = (): void => {
  useDomainStore.getState().skipOnboarding();
};

/**
 * Resets onboarding status for testing
 */
export const resetOnboardingStatus = (): void => {
  useDomainStore.getState().resetOnboarding();
  
  // Also clear other first-time user indicators
  LocalStorageAdapter.remove('selectedFigure');
  
  // Clear any history since that's also part of the new user check (updated for new storage system)
  const keysToRemove: string[] = LocalStorageAdapter.keys().filter((key) => {
    return HISTORY_PREFIXES.some(prefix => key.startsWith(prefix)) ||
           key.startsWith('history_'); // Keep old format for cleanup
  });
  
  keysToRemove.forEach(key => {
    LocalStorageAdapter.remove(key);
  });
  
  // Force the user to be considered "new" again
  sessionStorage.setItem('showOnboarding', 'true');
};
