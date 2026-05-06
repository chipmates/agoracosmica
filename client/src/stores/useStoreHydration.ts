/**
 * Hook to track Zustand persist hydration state
 *
 * Zustand persist loads state asynchronously from localStorage.
 * Any code that reads from the store during initial render will get
 * the initial state, not the persisted state. This hook allows
 * components to wait for hydration before running initialization logic.
 *
 * @example
 * const { isHydrated, isLoading } = useStoreHydration();
 *
 * useEffect(() => {
 *   if (!isHydrated) return; // Wait for hydration
 *   // Safe to read persisted state here
 * }, [isHydrated]);
 */

import { useEffect, useState } from 'react';
import { useDomainStore } from './domainStore';
import { useUIStore } from './uiStore';

interface HydrationState {
  /** True when ALL stores have finished hydrating from localStorage */
  isHydrated: boolean;
  /** True while waiting for hydration (initial state) */
  isLoading: boolean;
  /** Individual store hydration status */
  stores: {
    domain: boolean;
    ui: boolean;
  };
}

/**
 * Hook to check if Zustand persist stores have finished hydrating
 *
 * Use this before running any initialization logic that depends on
 * persisted state (e.g., checking if user is new, restoring UI state).
 */
export function useStoreHydration(): HydrationState {
  const [domainHydrated, setDomainHydrated] = useState(() => {
    // Check if already hydrated (e.g., on hot reload)
    return useDomainStore.persist?.hasHydrated?.() ?? false;
  });

  const [uiHydrated, setUIHydrated] = useState(() => {
    return useUIStore.persist?.hasHydrated?.() ?? false;
  });

  useEffect(() => {
    // Subscribe to hydration completion for domain store
    const unsubDomain = useDomainStore.persist?.onFinishHydration?.(() => {
      setDomainHydrated(true);
      if (import.meta.env.DEV) {
        console.log('[Hydration] domainStore hydrated');
      }
    });

    // Subscribe to hydration completion for UI store
    const unsubUI = useUIStore.persist?.onFinishHydration?.(() => {
      setUIHydrated(true);
      if (import.meta.env.DEV) {
        console.log('[Hydration] uiStore hydrated');
      }
    });

    // Check if already hydrated (handles race condition)
    if (useDomainStore.persist?.hasHydrated?.()) {
      setDomainHydrated(true);
    }
    if (useUIStore.persist?.hasHydrated?.()) {
      setUIHydrated(true);
    }

    return () => {
      unsubDomain?.();
      unsubUI?.();
    };
  }, []);

  const isHydrated = domainHydrated && uiHydrated;

  return {
    isHydrated,
    isLoading: !isHydrated,
    stores: {
      domain: domainHydrated,
      ui: uiHydrated,
    },
  };
}

/**
 * Synchronous check if stores are hydrated
 * Use this outside of React components (e.g., in utility functions)
 */
export function areStoresHydrated(): boolean {
  const domainHydrated = useDomainStore.persist?.hasHydrated?.() ?? false;
  const uiHydrated = useUIStore.persist?.hasHydrated?.() ?? false;
  return domainHydrated && uiHydrated;
}
