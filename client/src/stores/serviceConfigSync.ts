// Every open tab keeps the settings in memory, while the saved copy is shared.
// A tab takes over settings another tab saved before it uses them or writes
// the store, so an older tab neither acts on nor saves back a choice the
// visitor has changed since (Local Mode above all).
import type { PersistStorage, StorageValue } from 'zustand/middleware';

interface ServiceConfigSlot {
  raw: string | null;
  parsed: Record<string, unknown> | null;
}

interface SyncedStore {
  getState: () => { serviceConfig: ServiceConfigSlot };
  setState: (partial: { serviceConfig: ServiceConfigSlot }) => void;
}

let store: SyncedStore | null = null;
let storeName = '';
/** The saved blob this tab last wrote or read; another value means another tab wrote. */
let lastBlob: string | null = null;
/** The settings this tab and the saved copy last agreed on. */
let agreedRaw: string | null | undefined;
let adopting = false;

const browserStorage = (): Storage | null => {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
};

function savedSlot(blob: string): ServiceConfigSlot | undefined {
  try {
    const slot = (JSON.parse(blob) as { state?: { serviceConfig?: ServiceConfigSlot } } | null)?.state?.serviceConfig;
    return slot && (typeof slot.raw === 'string' || slot.raw === null) ? slot : undefined;
  } catch {
    return undefined;
  }
}

/** Take over settings another tab saved since this tab last looked. */
export function adoptSavedServiceConfig(): void {
  const storage = browserStorage();
  if (!store || !storage || adopting) return;
  let blob: string | null;
  try {
    blob = storage.getItem(storeName);
  } catch {
    return;
  }
  if (blob === null || blob === lastBlob) return;
  lastBlob = blob;
  const saved = savedSlot(blob);
  if (!saved || saved.raw === agreedRaw) return;
  // A change made in this tab that could not be saved stays this tab's.
  if (store.getState().serviceConfig.raw !== agreedRaw) return;
  agreedRaw = saved.raw;
  adopting = true;
  try {
    store.setState({ serviceConfig: saved });
  } finally {
    adopting = false;
  }
}

/** The settings in memory after a hydration are what this tab agrees on. */
export function markServiceConfigHydrated(raw: string | null | undefined): void {
  agreedRaw = raw;
}

/** localStorage for the persisted store, checking for another tab's settings before each write. */
export function createServiceConfigStorage<S extends { serviceConfig?: ServiceConfigSlot }>(): PersistStorage<S> | undefined {
  const storage = browserStorage();
  if (!storage) return undefined;
  return {
    getItem: (name) => {
      const blob = storage.getItem(name);
      lastBlob = blob;
      return blob === null ? null : (JSON.parse(blob) as StorageValue<S>);
    },
    setItem: (name, value) => {
      if (adopting) return;
      adoptSavedServiceConfig();
      const current = store?.getState().serviceConfig;
      const next = current ? { ...value, state: { ...value.state, serviceConfig: current } } : value;
      const blob = JSON.stringify(next);
      storage.setItem(name, blob);
      lastBlob = blob;
      agreedRaw = next.state.serviceConfig?.raw;
    },
    removeItem: (name) => {
      storage.removeItem(name);
      lastBlob = null;
    },
  };
}

/** Bind the created store; a `storage` event from another tab brings its settings in at once. */
export function bindServiceConfigSync(target: SyncedStore, name: string): void {
  store = target;
  storeName = name;
  if (typeof window === 'undefined') return;
  window.addEventListener('storage', (event) => {
    if (event.key === name) adoptSavedServiceConfig();
  });
}
