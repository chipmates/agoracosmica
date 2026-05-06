let openDB: typeof import('idb').openDB | undefined;

const DB_NAME = 'agora-cosmica';
const DB_VERSION = 1;

type StoreNames = 'history' | 'metadata' | 'wal';

export type WalOperation =
  | { type: 'put'; store: StoreNames; key: string; value: unknown }
  | { type: 'delete'; store: StoreNames; key: string }
  | { type: 'clear'; store: StoreNames };

export interface WalEntry {
  id: number;
  operation: WalOperation;
  timestamp: number;
}

const WAL_LOCK_KEY = 'wal-lock';
const WAL_STORE_NAME: StoreNames = 'wal';
const METADATA_STORE_NAME: StoreNames = 'metadata';

let dbPromise: Promise<import('idb').IDBPDatabase<unknown>> | null = null;

const ensureIdb = async () => {
  if (!openDB) {
    const idb = await import('idb');
    openDB = idb.openDB;
  }
};

let walReplayDone = false;

export const getDatabase = async () => {
  await ensureIdb();
  if (!dbPromise) {
    dbPromise = openDB!(DB_NAME, DB_VERSION, {
      upgrade(database) {
        if (!database.objectStoreNames.contains('history')) {
          database.createObjectStore('history');
        }
        if (!database.objectStoreNames.contains('metadata')) {
          database.createObjectStore('metadata');
        }
        if (!database.objectStoreNames.contains('wal')) {
          database.createObjectStore('wal');
        }
      }
    });

    // Replay any orphaned WAL entries from a previous crash (once per session)
    if (!walReplayDone) {
      walReplayDone = true; // Prevent re-entrant calls during async replay
      dbPromise.then(async (db) => {
        try {
          const tx = db.transaction('wal', 'readonly');
          const count = await tx.store.count();
          await tx.done;
          if (count > 0) {
            await replayWal();
            if (import.meta.env.DEV) {
              console.log(`[IndexedDB] Replayed ${count} orphaned WAL entries`);
            }
          }
        } catch (err) {
          console.error('[IndexedDB] WAL replay on startup failed:', err);
          walReplayDone = false; // Allow retry on next getDB() call
        }
      });
    }
  }
  return dbPromise;
};

export const getFromStore = async <T>(store: StoreNames, key: string): Promise<T | undefined> => {
  const db = await getDatabase();
  return db.get(store, key);
};

export const putToStore = async <T>(store: StoreNames, key: string, value: T) => {
  const db = await getDatabase();
  return db.put(store, value, key);
};

export const deleteFromStore = async (store: StoreNames, key: string) => {
  const db = await getDatabase();
  return db.delete(store, key);
};

export const clearStore = async (store: StoreNames) => {
  const db = await getDatabase();
  return db.clear(store);
};

export const getAllKeysFromStore = async (store: StoreNames): Promise<string[]> => {
  const db = await getDatabase();
  const keys = await db.getAllKeys(store);
  return keys.map((key) => (typeof key === 'string' ? key : String(key)));
};

const withLock = async <T>(callback: () => Promise<T>) => {
  if (typeof navigator !== 'undefined' && navigator.locks?.request) {
    return navigator.locks.request('agora-cosmica-wal', { mode: 'exclusive' }, callback);
  }

  const db = await getDatabase();
  const releaseLock = async () => {
    const tx = db.transaction(METADATA_STORE_NAME, 'readwrite');
    await tx.objectStore(METADATA_STORE_NAME).delete(WAL_LOCK_KEY);
    await tx.done;
  };

  let acquired = false;
  while (!acquired) {
    const tx = db.transaction(METADATA_STORE_NAME, 'readwrite');
    const store = tx.objectStore(METADATA_STORE_NAME);
    const existing = await store.get(WAL_LOCK_KEY);
    if (!existing) {
      await store.put({ lockedAt: Date.now() }, WAL_LOCK_KEY);
      acquired = true;
    }
    await tx.done;
    if (!acquired) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  try {
    return await callback();
  } finally {
    await releaseLock();
  }
};

export const appendWalEntry = async (operation: WalOperation) => {
  const db = await getDatabase();
  const tx = db.transaction(WAL_STORE_NAME, 'readwrite');
  const store = tx.objectStore(WAL_STORE_NAME);
  // WAL store was created without key generator; provide an explicit key
  const key = Date.now() + Math.random();
  await store.add({ operation, timestamp: Date.now() }, key);
  await tx.done;
};

export const getWalEntries = async (): Promise<WalEntry[]> => {
  const db = await getDatabase();
  const tx = db.transaction(WAL_STORE_NAME, 'readonly');
  const store = tx.objectStore(WAL_STORE_NAME);
  const [entries, keys] = await Promise.all([store.getAll(), store.getAllKeys()]);
  await tx.done;

  const typedEntries = entries as Array<{ operation: WalOperation; timestamp: number }>;

  return typedEntries.map((entry, index) => ({
    id: typeof keys[index] === 'number' ? (keys[index] as number) : index,
    operation: entry.operation,
    timestamp: entry.timestamp,
  }));
};

export const clearWal = async () => clearStore(WAL_STORE_NAME);

const applyOperation = async (operation: WalOperation) => {
  switch (operation.type) {
    case 'put':
      await putToStore(operation.store, operation.key, operation.value);
      break;
    case 'delete':
      await deleteFromStore(operation.store, operation.key);
      break;
    case 'clear':
      await clearStore(operation.store);
      break;
    default:
      throw new Error(`Unknown WAL operation ${(operation as WalOperation).type}`);
  }
};

const replayWalInternal = async () => {
  const entries = await getWalEntries();
  for (const entry of entries) {
    await applyOperation(entry.operation);
  }
  await clearWal();
};

export const replayWal = async () => withLock(replayWalInternal);

export const runWithWal = async <T>(operations: WalOperation[], task: () => Promise<T>) =>
  withLock(async () => {
    for (const operation of operations) {
      await appendWalEntry(operation);
    }
    const result = await task();
    await replayWalInternal();
    return result;
  });
