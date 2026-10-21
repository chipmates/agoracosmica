/**
 * Utilities to manage user state and onboarding
 */

import { LocalStorageAdapter } from '../storage/localAdapter';
import { useDomainStore } from '../stores';
import { CURRENT_AGB_VERSION } from './public/termsVersion';

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
 * Version of the terms the consent record was written against. The value and
 * the terms' date live in utils/public/termsVersion.json: the welcome modal
 * stamps it, the gate below compares against it, so a version step there
 * re-prompts every browser.
 */
export { CURRENT_AGB_VERSION };

const CONSENT_STORAGE_KEY = 'agb_consent';

/**
 * The stored consent record, or null when it is missing, blocked or unreadable.
 */
const readConsentRecord = (): { version?: unknown } | null => {
  try {
    const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? (parsed as { version?: unknown }) : null;
  } catch {
    return null;
  }
};

/**
 * Has this device accepted the CURRENT disclosure? A missing record and a
 * record stamped with an older version both answer no, so the disclosure is
 * shown again rather than assumed from a past acceptance.
 */
export const hasCurrentConsent = (): boolean =>
  readConsentRecord()?.version === CURRENT_AGB_VERSION;

/**
 * Checks whether the welcome disclosure still has to be shown: no consent
 * record for the current version, or none of the post-consent signals (chat
 * history, a selected figure, a completed or skipped onboarding) present.
 *
 * The consent record is checked first because the three signals below are only
 * proxies for having passed the gate. Without it a lost record, or a record
 * predating a wording change, would silently keep the disclosure closed.
 *
 * @returns True if the user has not passed the current disclosure
 */
export const isNewUser = (): boolean => {
  if (!hasCurrentConsent()) return true;

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
