// client/src/services/storage/keyStorageService.ts
//
// API key storage, encrypted at rest with AES-256-GCM under the device key.

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { deviceKeyManager } from './deviceKeyManager';

type Provider = 'openrouter' | 'openai' | 'deepinfra' | 'custom-llm'; // 'deepinfra' kept for migration (legacy keys)

/** Record shape written by the current code path. Anything lower is legacy. */
const RECORD_VERSION = 2;

/**
 * Iteration counts a legacy record may have been written with, newest first.
 *
 * Records that predate the stored `iterations` field used whichever count the
 * device-class heuristic picked at save time, and that classification could flip
 * between save and load. Only the legacy read path needs this.
 */
const LEGACY_ITERATIONS = [600000, 100000];

/** One write per hour of use instead of one per read. */
const LAST_USED_INTERVAL_MS = 60 * 60 * 1000;

interface StoredKey {
  id: Provider;
  value: string;           // AES-256-GCM ciphertext as JSON, or base64 for the oldest legacy records
  encrypted: boolean;      // legacy records may be false (base64 fallback); current records are always true
  v?: number;              // RECORD_VERSION = device CryptoKey. absent = legacy PBKDF2 record
  salt?: number[];         // legacy only: PBKDF2 salt
  iterations?: number;     // legacy only: PBKDF2 iterations used at save time
  timestamp: number;       // when stored
  valid?: boolean;         // last validation result
  lastUsed?: number;       // last usage timestamp
  lastValidated?: string;  // ISO timestamp of last validation
}

interface KeysDB extends DBSchema {
  keys: {
    key: string;
    value: StoredKey;
  };
}

/**
 * KeyStorageService
 *
 * API keys are encrypted with a non-extractable AES-256-GCM key held in
 * IndexedDB. The key handle can be used on this origin but its bytes cannot be
 * read out, so a script that reaches the database still cannot lift the key and
 * replay it elsewhere. Code already running on this origin can use the key in
 * place; the CSP is the defence for that case.
 *
 * @see docs/THREAT-MODEL.md
 */
class KeyStorageService {
  private readonly DB_NAME = 'AgoraCosmicaKeys';
  private readonly DB_VERSION = 1;

  private dbPromise: Promise<IDBPDatabase<KeysDB>> | null = null;
  private migrationPromise: Promise<void> | null = null;

  /**
   * Save an API key, encrypted with the device key.
   *
   * @throws Error if crypto.subtle is unavailable or encryption fails
   */
  async saveKey(
    provider: Provider,
    apiKey: string,
    options?: { provider?: string; lastValidated?: string }
  ): Promise<void> {
    this.requireSubtleCrypto();

    const db = await this.getDB();
    const deviceKey = await deviceKeyManager.getEncryptionKey();

    await db.put('keys', {
      id: provider,
      value: await this.encryptAES(apiKey, deviceKey),
      encrypted: true,
      v: RECORD_VERSION,
      timestamp: Date.now(),
      valid: true,
      ...(options?.lastValidated && { lastValidated: options.lastValidated })
    });
  }

  /**
   * Retrieve and decrypt an API key.
   *
   * @returns Decrypted API key or null if not found
   * @throws Error if crypto.subtle is unavailable or decryption fails
   */
  async getKey(provider: Provider): Promise<string | null> {
    this.requireSubtleCrypto();
    await this.ensureMigrated();

    const db = await this.getDB();
    const record = await db.get('keys', provider);
    if (!record) return null;

    if (record.v === RECORD_VERSION) {
      const deviceKey = await deviceKeyManager.getEncryptionKey();
      const plaintext = await this.decryptAES(record.value, deviceKey);
      await this.touchLastUsed(db, record);
      return plaintext;
    }

    // Left behind by a migration that could not finish, or written by an older
    // tab still running. Read it the old way, then rewrite it under the device
    // key so this branch is never taken for the record again.
    const plaintext = await this.decryptLegacyRecord(record);
    await this.rewriteUnderDeviceKey(db, record, plaintext);
    return plaintext;
  }

  /**
   * Check if key exists
   */
  async hasKey(provider: Provider): Promise<boolean> {
    await this.ensureMigrated();
    const db = await this.getDB();
    const record = await db.get('keys', provider);
    return !!record;
  }

  /**
   * Get key metadata without retrieving the actual key
   */
  async getKeyMetadata(provider: Provider): Promise<{
    valid?: boolean;
    lastUsed?: number;
    lastValidated?: string;
    timestamp: number;
  } | null> {
    await this.ensureMigrated();
    const db = await this.getDB();
    const record = await db.get('keys', provider);

    if (!record) return null;

    return {
      valid: record.valid,
      lastUsed: record.lastUsed,
      lastValidated: record.lastValidated,
      timestamp: record.timestamp
    };
  }

  /**
   * Single definition of "this provider has a key worth using": a record
   * exists and has not been marked invalid. Chat routing, councils, summaries,
   * quota sync, the self-host gate, and the settings badge all call this so
   * they can never disagree about whether BYOK is active. A record is only
   * stored after a successful test, and markInvalid flips it off on rejection.
   */
  async hasUsableKey(provider: Provider): Promise<boolean> {
    const meta = await this.getKeyMetadata(provider);
    return meta !== null && meta.valid !== false;
  }

  /**
   * Delete key securely
   *
   * Note: This only deletes the encrypted key from IndexedDB.
   * The device encryption key remains for other keys.
   */
  async deleteKey(provider: Provider): Promise<void> {
    const db = await this.getDB();
    await db.delete('keys', provider);
  }

  /**
   * Delete all keys (use with caution!)
   *
   * This clears all API keys but preserves the device encryption key.
   */
  async deleteAllKeys(): Promise<void> {
    const db = await this.getDB();
    await db.clear('keys');
  }

  /**
   * Mark key as invalid (after failed validation)
   */
  async markInvalid(provider: Provider): Promise<void> {
    const db = await this.getDB();
    const record = await db.get('keys', provider);
    if (record) {
      record.valid = false;
      await db.put('keys', record);
    }
  }

  /**
   * Re-encrypt legacy records under the device key. Runs once per page.
   *
   * Each record is rewritten by a single put, so a record is either fully legacy
   * or fully current and never something in between. A record that cannot be
   * decrypted is left exactly as it was, so an interrupted or partly failed run
   * loses nothing and the next load retries it.
   */
  async ensureMigrated(): Promise<void> {
    if (!this.migrationPromise) {
      this.migrationPromise = this.migrateLegacyRecords().catch((error) => {
        console.warn('[KeyStorage] Legacy record migration failed', error);
      });
    }
    return this.migrationPromise;
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  private requireSubtleCrypto(): void {
    if (typeof crypto === 'undefined' || !crypto.subtle) {
      throw new Error(
        '[KeyStorage] crypto.subtle unavailable — secure context required. ' +
        'API keys cannot be stored without encryption. Ensure HTTPS or localhost.'
      );
    }
  }

  private getDB(): Promise<IDBPDatabase<KeysDB>> {
    if (!this.dbPromise) {
      this.dbPromise = openDB<KeysDB>(this.DB_NAME, this.DB_VERSION, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('keys')) {
            db.createObjectStore('keys', { keyPath: 'id' });
          }
        }
      }).catch((error) => {
        this.dbPromise = null;
        throw error;
      });
    }
    return this.dbPromise;
  }

  private async migrateLegacyRecords(): Promise<void> {
    if (typeof crypto === 'undefined' || !crypto.subtle) return;

    const db = await this.getDB();
    const legacy = (await db.getAll('keys')).filter((record) => record.v !== RECORD_VERSION);
    if (legacy.length === 0) return;

    for (const record of legacy) {
      try {
        const plaintext = await this.decryptLegacyRecord(record);
        await this.rewriteUnderDeviceKey(db, record, plaintext);
      } catch (error) {
        console.warn(`[KeyStorage] Could not migrate stored key for ${record.id}`, error);
      }
    }
  }

  /**
   * Read a record written before the device key existed: either the oldest
   * base64 fallback, or AES-256-GCM under a key derived from the legacy string
   * with PBKDF2. Records saved before the iteration count was stored are tried
   * against both counts that were ever used.
   */
  private async decryptLegacyRecord(record: StoredKey): Promise<string> {
    if (!record.encrypted) {
      return atob(record.value);
    }

    const legacyKey = await deviceKeyManager.peekLegacyKey();
    if (!legacyKey) {
      throw new Error('[KeyStorage] Legacy device key is gone, stored key cannot be decrypted.');
    }

    const salt = new Uint8Array(record.salt ?? []);
    const attempts = record.iterations ? [record.iterations] : LEGACY_ITERATIONS;

    let lastError: unknown;
    for (const iterations of attempts) {
      try {
        const derived = await this.deriveLegacyKey(legacyKey, salt, iterations);
        return await this.decryptAES(record.value, derived);
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError;
  }

  /**
   * Replace a legacy record with one encrypted under the device key, keeping the
   * metadata the record already carried. One put, so the swap is atomic.
   */
  private async rewriteUnderDeviceKey(
    db: IDBPDatabase<KeysDB>,
    record: StoredKey,
    plaintext: string
  ): Promise<void> {
    const deviceKey = await deviceKeyManager.getEncryptionKey();
    await db.put('keys', {
      id: record.id,
      value: await this.encryptAES(plaintext, deviceKey),
      encrypted: true,
      v: RECORD_VERSION,
      timestamp: record.timestamp,
      lastUsed: Date.now(),
      ...(record.valid !== undefined && { valid: record.valid }),
      ...(record.lastValidated && { lastValidated: record.lastValidated })
    });
  }

  private async touchLastUsed(db: IDBPDatabase<KeysDB>, record: StoredKey): Promise<void> {
    const now = Date.now();
    if (record.lastUsed && now - record.lastUsed < LAST_USED_INTERVAL_MS) return;
    await db.put('keys', { ...record, lastUsed: now });
  }

  /**
   * Legacy PBKDF2 derivation. Read path only, for records that predate the
   * device key. Nothing is written with it.
   */
  private async deriveLegacyKey(
    legacyKey: string,
    salt: Uint8Array<ArrayBuffer>,
    iterations: number
  ): Promise<CryptoKey> {
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(legacyKey),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypt with AES-256-GCM. GCM is authenticated, so tampering with the
   * stored bytes fails the decrypt rather than returning garbage.
   *
   * @returns JSON string with the IV and the ciphertext
   */
  private async encryptAES(text: string, key: CryptoKey): Promise<string> {
    const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit nonce, NIST recommendation for GCM

    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      new TextEncoder().encode(text)
    );

    // The IV is stored next to the ciphertext. It does not need to be secret.
    return JSON.stringify({
      iv: Array.from(iv),
      data: Array.from(new Uint8Array(encrypted))
    });
  }

  /**
   * Decrypt AES-256-GCM output from encryptAES().
   *
   * @throws Error if the key is wrong or the data was tampered with
   */
  private async decryptAES(encryptedData: string, key: CryptoKey): Promise<string> {
    const { iv, data } = JSON.parse(encryptedData);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(iv) },
      key,
      new Uint8Array(data)
    );

    return new TextDecoder().decode(decrypted);
  }
}

// Export singleton
export const keyStorage = new KeyStorageService();
