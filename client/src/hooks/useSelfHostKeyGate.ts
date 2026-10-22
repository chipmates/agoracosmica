// Self-host key gate.
//
// A self-host build has no free tier, so an answering model is mandatory: an
// OpenRouter key, or Local Mode's own model. Once the user is past the login
// splash this opens the key-setup modal as a required gate (non-dismissable
// until a valid key is saved) whenever neither is there.
//
// No-op in the hosted build: isSelfHost is false, so the effect returns
// immediately and Vite tree-shakes the body out.

import { useEffect } from 'react';
import { isSelfHost } from '../config/deployment';
import { keyStorage } from '../services/storage/keyStorageService';
import { localModeFromRaw } from '../services/audio/config/serviceConfig';
import { useDomainStore } from '../stores/domainStore';

/** Local Mode's model answers, key or no key (a rejected one included). */
const localModelOn = (): boolean => localModeFromRaw(useDomainStore.getState().serviceConfig.raw).llmEnabled;

/**
 * Opens the BYOK key-setup modal as a required gate when a self-host build is
 * running with neither a usable OpenRouter key nor Local Mode's model. Pass the
 * current login state so the gate only fires once the user is past the login
 * splash.
 */
export function useSelfHostKeyGate(isLoggedIn: boolean): void {
  useEffect(() => {
    if (!isSelfHost || !isLoggedIn) return;
    if (localModelOn()) return;

    let cancelled = false;
    keyStorage
      .hasUsableKey('openrouter')
      .then((hasValidKey) => {
        if (cancelled) return;
        if (!hasValidKey && !localModelOn()) {
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
