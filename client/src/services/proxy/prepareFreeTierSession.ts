// The bot check moved ahead of a send, for a visitor on the free tier only.
// A stored own key keeps it from running, rejected or not: a yes to the free
// tier covers only what it was asked for, and those sends open their own
// session when they go.

import { useDomainStore } from '../../stores/domainStore';
import { keyStorage } from '../storage/keyStorageService';
import { prepareSession } from './sessionManager';

/** Starts the check a coming send would need, when no own key is stored. */
export function prepareFreeTierSession(): void {
  if (!useDomainStore.getState().quota.isFreeTier) return;
  keyStorage.hasKey('openrouter').then(
    (stored) => {
      if (!stored && useDomainStore.getState().quota.isFreeTier) prepareSession();
    },
    () => {
      // Unreadable key storage: the send that follows runs the check itself.
    },
  );
}
