// services/storage/clearAllUserData.ts
//
// Wipes everything stored about the user on this device:
// conversation history, OpenRouter key, encryption key, settings,
// and language preference. Triggers a page reload to ensure no
// stale state survives in memory.

import { clearAllHistory } from '../history/historyClearService';
import { keyStorage } from './keyStorageService';

const KNOWN_DBS = [
  'agora-cosmica',          // history + WAL
  'AgoraCosmicaKeys',       // encrypted API keys
  'AgoraCosmicaDeviceKey',  // per-device encryption key
];

const deleteDb = (name: string): Promise<void> =>
  new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(name);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });

export async function clearAllUserData(): Promise<void> {
  // 1. Clear conversation history (LocalStorage keys + history store)
  try {
    await clearAllHistory();
  } catch (err) {
    console.warn('[clearAllUserData] clearAllHistory failed:', err);
  }

  // 2. Drop API key explicitly (in case the IndexedDB drop below races)
  try {
    await keyStorage.deleteKey('openrouter');
  } catch {
    // ignore
  }

  // 3. Wipe everything else from web storage
  try {
    window.localStorage.clear();
  } catch (err) {
    console.warn('[clearAllUserData] localStorage.clear failed:', err);
  }
  try {
    window.sessionStorage.clear();
  } catch (err) {
    console.warn('[clearAllUserData] sessionStorage.clear failed:', err);
  }

  // 4. Drop our IndexedDB databases entirely
  await Promise.all(KNOWN_DBS.map(deleteDb));

  // 5. Reload so no in-memory Zustand state survives
  window.location.reload();
}
