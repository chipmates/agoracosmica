// client/src/services/storage/deviceKeyManager.ts
//
// Per-device encryption key material held in IndexedDB.

import { openDB, DBSchema, IDBPDatabase } from 'idb';

/**
 * Legacy record: base64 key material read back as a string.
 *
 * Still written and read by the history and profile encryption paths, which
 * derive an AES key from it with PBKDF2. Those two paths keep this record alive,
 * so it is never deleted here. The API-key store no longer uses it.
 */
interface LegacyKeyRecord {
  id: 'encryption-key';
  value: string;
  created: number;
  version: number;
}

/**
 * Current record: the AES-256-GCM key itself, non-extractable.
 *
 * Structured clone stores the key handle, not its bytes. Script on this origin
 * can encrypt and decrypt with it but cannot read the raw key out and replay it
 * somewhere else.
 */
interface CryptoKeyRecord {
  id: 'device-crypto-key';
  cryptoKey: CryptoKey;
  created: number;
  version: number;
}

type DeviceKeyRecord = LegacyKeyRecord | CryptoKeyRecord;

interface DeviceKeyDB extends DBSchema {
  deviceKey: {
    key: string;
    value: DeviceKeyRecord;
  };
}

const isCryptoKeyRecord = (record: DeviceKeyRecord | undefined): record is CryptoKeyRecord =>
  !!record && 'cryptoKey' in record;

const isLegacyKeyRecord = (record: DeviceKeyRecord | undefined): record is LegacyKeyRecord =>
  !!record && 'value' in record && typeof record.value === 'string';

class DeviceKeyManager {
  private readonly DB_NAME = 'AgoraCosmicaDeviceKey';
  private readonly DB_VERSION = 1;
  private readonly STORE_NAME = 'deviceKey';
  private readonly LEGACY_KEY_ID = 'encryption-key';
  private readonly CRYPTO_KEY_ID = 'device-crypto-key';

  private cachedLegacyKey: string | null = null;
  private cachedCryptoKey: CryptoKey | null = null;

  // One connection and one in-flight generation per page, so concurrent callers
  // never open a second database or race two fresh keys against each other.
  private dbPromise: Promise<IDBPDatabase<DeviceKeyDB>> | null = null;
  private cryptoKeyPromise: Promise<CryptoKey> | null = null;

  /**
   * The device AES-256-GCM key, generated on first use.
   *
   * @throws Error if crypto.subtle is unavailable (insecure context)
   */
  async getEncryptionKey(): Promise<CryptoKey> {
    if (this.cachedCryptoKey) {
      return this.cachedCryptoKey;
    }
    if (!this.cryptoKeyPromise) {
      this.cryptoKeyPromise = this.loadOrCreateCryptoKey().finally(() => {
        this.cryptoKeyPromise = null;
      });
    }
    return this.cryptoKeyPromise;
  }

  /**
   * Read the legacy key without creating one.
   *
   * Returns null when no legacy record exists, which is the signal that nothing
   * was ever written with the old derivation and there is nothing to migrate.
   */
  async peekLegacyKey(): Promise<string | null> {
    if (this.cachedLegacyKey) {
      return this.cachedLegacyKey;
    }
    const db = await this.getDB();
    const record = await db.get(this.STORE_NAME, this.LEGACY_KEY_ID);
    if (!isLegacyKeyRecord(record)) {
      return null;
    }
    this.cachedLegacyKey = record.value;
    return record.value;
  }

  /**
   * Legacy key material, created on first use.
   *
   * Kept for the history and profile encryption paths, which still derive from a
   * string with PBKDF2. New code should use getEncryptionKey().
   */
  async getDeviceKey(): Promise<string> {
    const existing = await this.peekLegacyKey();
    if (existing) {
      return existing;
    }

    const value = this.generateStrongKey();
    const db = await this.getDB();

    // Read and write in one transaction so a second tab reaching this branch at
    // the same time adopts the first key rather than overwriting it.
    const tx = db.transaction(this.STORE_NAME, 'readwrite');
    const stored = await tx.store.get(this.LEGACY_KEY_ID);
    if (isLegacyKeyRecord(stored)) {
      await tx.done;
      this.cachedLegacyKey = stored.value;
      return stored.value;
    }
    await tx.store.put({ id: this.LEGACY_KEY_ID, value, created: Date.now(), version: 1 });
    await tx.done;

    this.cachedLegacyKey = value;
    return value;
  }

  /**
   * Clear cached key material from memory.
   */
  clearCache(): void {
    this.cachedLegacyKey = null;
    this.cachedCryptoKey = null;
  }

  /**
   * Delete all device key material.
   *
   * WARNING: everything encrypted with it becomes unrecoverable.
   */
  async deleteDeviceKey(): Promise<void> {
    const db = await this.getDB();
    await db.delete(this.STORE_NAME, this.LEGACY_KEY_ID);
    await db.delete(this.STORE_NAME, this.CRYPTO_KEY_ID);
    this.clearCache();
  }

  /**
   * Key metadata without exposing key material.
   */
  async getKeyMetadata(): Promise<{ created: number; version: number } | null> {
    const db = await this.getDB();
    const record =
      (await db.get(this.STORE_NAME, this.CRYPTO_KEY_ID)) ??
      (await db.get(this.STORE_NAME, this.LEGACY_KEY_ID));

    if (!record) return null;

    return { created: record.created, version: record.version };
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  private async loadOrCreateCryptoKey(): Promise<CryptoKey> {
    if (typeof crypto === 'undefined' || !crypto.subtle) {
      throw new Error(
        '[DeviceKey] crypto.subtle unavailable — secure context required. ' +
        'Ensure HTTPS or localhost.'
      );
    }

    const db = await this.getDB();
    const existing = await db.get(this.STORE_NAME, this.CRYPTO_KEY_ID);
    if (isCryptoKeyRecord(existing)) {
      this.cachedCryptoKey = existing.cryptoKey;
      return existing.cryptoKey;
    }

    // Generated before the transaction opens: an IndexedDB transaction closes as
    // soon as the microtask queue drains without a pending request, so it cannot
    // stay open across an unrelated await.
    const candidate = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );

    const tx = db.transaction(this.STORE_NAME, 'readwrite');
    const stored = await tx.store.get(this.CRYPTO_KEY_ID);
    if (isCryptoKeyRecord(stored)) {
      await tx.done;
      this.cachedCryptoKey = stored.cryptoKey;
      return stored.cryptoKey;
    }
    await tx.store.put({
      id: this.CRYPTO_KEY_ID,
      cryptoKey: candidate,
      created: Date.now(),
      version: 2
    });
    await tx.done;

    this.cachedCryptoKey = candidate;
    return candidate;
  }

  private generateStrongKey(): string {
    const randomBytes = crypto.getRandomValues(new Uint8Array(32));
    return btoa(String.fromCharCode(...randomBytes));
  }

  private getDB(): Promise<IDBPDatabase<DeviceKeyDB>> {
    if (!this.dbPromise) {
      this.dbPromise = openDB<DeviceKeyDB>(this.DB_NAME, this.DB_VERSION, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('deviceKey')) {
            db.createObjectStore('deviceKey', { keyPath: 'id' });
          }
        }
      }).catch((error) => {
        this.dbPromise = null;
        throw error;
      });
    }
    return this.dbPromise;
  }
}

// Export singleton instance
export const deviceKeyManager = new DeviceKeyManager();
