// Sync free-tier quota state on mount.
// Detects BYOK vs free-tier and fetches initial quota from /v1/quota.

import { useEffect } from 'react';
import { useDomainStore } from '../stores/domainStore';
import { keyStorage } from '../services/storage/keyStorageService';
import { fetchQuota } from '../services/proxy/freeTierAdapter';

export function useQuotaSync(): void {
  useEffect(() => {
    let cancelled = false;

    async function init() {
      const keyMeta = await keyStorage.getKeyMetadata('openrouter');
      const hasValidKey = keyMeta !== null && keyMeta.valid !== false;

      if (cancelled) return;

      if (hasValidKey) {
        // BYOK user: no quota tracking needed
        useDomainStore.getState().setIsFreeTier(false);
        return;
      }

      // Free-tier user: fetch initial quota
      useDomainStore.getState().setIsFreeTier(true);
      await fetchQuota();
    }

    init();
    return () => { cancelled = true; };
  }, []);
}
