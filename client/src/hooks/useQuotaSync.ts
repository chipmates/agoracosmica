// Sync free-tier quota state on mount.
// Detects BYOK vs free-tier and fetches initial quota from /v1/quota.

import { useEffect } from 'react';
import { useDomainStore } from '../stores/domainStore';
import { keyStorage } from '../services/storage/keyStorageService';
import { fetchQuota } from '../services/proxy/freeTierAdapter';
import { localModeFromRaw } from '../services/audio/config/serviceConfig';
import { isSelfHost } from '../config/deployment';

/** Local Mode's model answers: nothing goes to the free tier, so no session is taken for it. */
const localModelOn = (raw: string | null | undefined): boolean => localModeFromRaw(raw).llmEnabled;

export function useQuotaSync(): void {
  useEffect(() => {
    // A self-host build has no free tier. Treat the user as BYOK and skip the
    // quota fetch. Every free-tier widget (turn counter, council and summary
    // limits, rate-limit modal) keys off isFreeTier, so this keeps them hidden.
    if (isSelfHost) {
      useDomainStore.getState().setIsFreeTier(false);
      return;
    }

    let cancelled = false;

    async function sync() {
      if (localModelOn(useDomainStore.getState().serviceConfig.raw)) {
        useDomainStore.getState().setIsFreeTier(false);
        return;
      }

      // A stored key counts even after it was rejected: the free tier only
      // answers that visitor after a yes, so nothing is fetched for it here.
      const hasOwnKey = await keyStorage.hasKey('openrouter');

      if (cancelled) return;

      if (hasOwnKey || localModelOn(useDomainStore.getState().serviceConfig.raw)) {
        // BYOK user: no quota tracking needed
        useDomainStore.getState().setIsFreeTier(false);
        return;
      }

      // Free-tier user: fetch initial quota
      useDomainStore.getState().setIsFreeTier(true);
      await fetchQuota();
    }

    void sync();
    // Local Mode's model switched on or off: the free tier follows it.
    const unsubscribe = useDomainStore.subscribe((state, prev) => {
      if (state.serviceConfig.raw === prev.serviceConfig.raw) return;
      if (localModelOn(state.serviceConfig.raw) === localModelOn(prev.serviceConfig.raw)) return;
      void sync();
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);
}
