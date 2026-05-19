// Self-host key gate.
//
// A self-host build has no free tier, so the BYOK key is mandatory. Once the
// user is past the login splash this opens the key-setup modal as a required
// gate (non-dismissable until a valid key is saved) whenever no key is stored.
//
// No-op in the hosted build: isSelfHost is false, so the effect returns
// immediately and Vite tree-shakes the body out.

import { useEffect } from 'react';
import { isSelfHost } from '../config/deployment';
import { keyStorage } from '../services/storage/keyStorageService';
import { useDomainStore } from '../stores/domainStore';

/**
 * Opens the BYOK key-setup modal as a required gate when a self-host build is
 * running without a stored OpenRouter key. Pass the current login state so the
 * gate only fires once the user is past the login splash.
 */
export function useSelfHostKeyGate(isLoggedIn: boolean): void {
  useEffect(() => {
    if (!isSelfHost || !isLoggedIn) return;

    let cancelled = false;
    keyStorage
      .getKeyMetadata('openrouter')
      .then((meta) => {
        if (cancelled) return;
        const hasValidKey = meta !== null && meta.valid !== false;
        if (!hasValidKey) {
          useDomainStore.getState().openByokModal(undefined, true);
        }
      })
      .catch(() => {
        // Storage read failed. Fail open rather than trap the user behind a
        // gate we cannot evaluate; the key can still be added from Settings.
      });

    return () => {
      cancelled = true;
    };
  }, [isLoggedIn]);
}
