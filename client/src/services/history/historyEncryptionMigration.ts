// One-time, idempotent sweep that re-encrypts any legacy plaintext conversation
// histories at rest. Without it, dormant threads written before encryption
// shipped would stay plaintext until the user next sends a message in them, so
// the "conversations encrypted at rest" claim would be only eventually-true.
// This makes it true on first launch after the update.
//
// Safe to call on every startup: already-encrypted rows are skipped, a failure
// is non-fatal (retries next launch), and nothing is ever deleted. A plaintext
// row stays readable (passthrough) whether or not the sweep reaches it.

import { getAllKeysFromStore, getFromStore, runWithWal, type WalOperation } from '../../storage';
import { isConversationHistoryKey } from './historyStorageUtils';
import { encryptHistory, isEncryptedHistory } from './historyEncryption';

let migrationDone = false;

export async function migrateHistoryToEncrypted(): Promise<void> {
  if (migrationDone) return;
  migrationDone = true;

  try {
    const keys = await getAllKeysFromStore('history');
    const operations: WalOperation[] = [];

    for (const key of keys) {
      try {
        if (!isConversationHistoryKey(key)) continue;
        const stored = await getFromStore<unknown>('history', key);
        // Skip rows that are already encrypted, and anything that is not a plain
        // messages array (nothing to migrate, never destroy it).
        if (isEncryptedHistory(stored) || !Array.isArray(stored)) continue;
        operations.push({ type: 'put', store: 'history', key, value: await encryptHistory(stored) });
      } catch (error) {
        // One bad row must not abort the whole sweep. Plaintext stays readable.
        console.warn(`[historyEncryptionMigration] skipped ${key} during sweep`, error);
      }
    }

    if (operations.length > 0) {
      await runWithWal(operations, async () => undefined);
    }
  } catch (error) {
    console.warn('[historyEncryptionMigration] encryption sweep failed (non-fatal)', error);
    migrationDone = false; // allow a retry on the next launch
  }
}
