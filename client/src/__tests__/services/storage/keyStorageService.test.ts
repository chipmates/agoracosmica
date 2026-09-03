// src/__tests__/services/storage/keyStorageService.test.ts

import { describe, it, expect, afterEach, vi } from 'vitest';
import { openDB } from 'idb';

const KEYS_DB = 'AgoraCosmicaKeys';
const DEVICE_DB = 'AgoraCosmicaDeviceKey';

type KeyRecord = {
  id: string;
  value: string;
  encrypted: boolean;
  v?: number;
  salt?: number[];
  iterations?: number;
  timestamp: number;
  valid?: boolean;
  lastUsed?: number;
  lastValidated?: string;
};

// The services cache their connection for the life of the page, so deleting the
// database would block. Emptying the stores gives the same clean slate.
async function clearStores(): Promise<void> {
  const keys = await openKeysDb();
  await keys.clear('keys');
  keys.close();

  const device = await openDeviceDb();
  await device.clear('deviceKey');
  device.close();
}

// The services are module singletons that cache the device key and the open
// connection, so each test gets a fresh module graph on top of empty stores.
async function freshServices() {
  await clearStores();
  vi.resetModules();
  const { keyStorage } = await import('@/services/storage/keyStorageService');
  const { deviceKeyManager } = await import('@/services/storage/deviceKeyManager');
  return { keyStorage, deviceKeyManager };
}

const openKeysDb = () =>
  openDB(KEYS_DB, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('keys')) db.createObjectStore('keys', { keyPath: 'id' });
    }
  });

const openDeviceDb = () =>
  openDB(DEVICE_DB, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('deviceKey')) {
        db.createObjectStore('deviceKey', { keyPath: 'id' });
      }
    }
  });

const readKeyRecords = async (): Promise<KeyRecord[]> => {
  const db = await openKeysDb();
  const all = (await db.getAll('keys')) as KeyRecord[];
  db.close();
  return all;
};

/**
 * Write a record exactly the way the pre-device-key code did: AES-256-GCM under
 * a PBKDF2-derived key, with the base64 device key string held in its own store.
 */
async function seedLegacyRecord(
  id: string,
  plaintext: string,
  legacyKey: string,
  iterations: number,
  options: { storeIterations: boolean }
): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(legacyKey),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  const derived = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    derived,
    new TextEncoder().encode(plaintext)
  );

  const db = await openKeysDb();
  await db.put('keys', {
    id,
    value: JSON.stringify({ iv: Array.from(iv), data: Array.from(new Uint8Array(encrypted)) }),
    encrypted: true,
    salt: Array.from(salt),
    ...(options.storeIterations && { iterations }),
    timestamp: Date.now(),
    valid: true,
    lastValidated: '2026-01-01T00:00:00.000Z'
  });
  db.close();
}

async function seedLegacyDeviceKey(): Promise<string> {
  const value = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
  const db = await openDeviceDb();
  await db.put('deviceKey', { id: 'encryption-key', value, created: Date.now(), version: 1 });
  db.close();
  return value;
}

describe('KeyStorageService', () => {
  afterEach(async () => {
    vi.unstubAllGlobals();
    await clearStores();
  });

  describe('Round trip', () => {
    it('encrypts on save and decrypts the same value back', async () => {
      const { keyStorage } = await freshServices();
      const testKey = 'sk-or-v1-test-key-12345';

      await keyStorage.saveKey('openrouter', testKey);

      const [record] = await readKeyRecords();
      expect(record.value).not.toContain(testKey);
      expect(await keyStorage.getKey('openrouter')).toBe(testKey);
    });

    it('keeps providers separate', async () => {
      const { keyStorage } = await freshServices();

      await keyStorage.saveKey('openrouter', 'sk-or-v1-test-openrouter');
      await keyStorage.saveKey('openai', 'sk-test-openai');

      expect(await keyStorage.getKey('openrouter')).toBe('sk-or-v1-test-openrouter');
      expect(await keyStorage.getKey('openai')).toBe('sk-test-openai');
    });

    it('reports existence, metadata and deletion', async () => {
      const { keyStorage } = await freshServices();
      const lastValidated = new Date().toISOString();

      expect(await keyStorage.hasKey('openrouter')).toBe(false);
      expect(await keyStorage.getKey('openrouter')).toBe(null);

      await keyStorage.saveKey('openrouter', 'sk-or-v1-test-metadata', { lastValidated });
      expect(await keyStorage.hasKey('openrouter')).toBe(true);
      expect(await keyStorage.hasUsableKey('openrouter')).toBe(true);
      expect((await keyStorage.getKeyMetadata('openrouter'))?.lastValidated).toBe(lastValidated);

      await keyStorage.markInvalid('openrouter');
      expect(await keyStorage.hasKey('openrouter')).toBe(true);
      expect(await keyStorage.hasUsableKey('openrouter')).toBe(false);

      await keyStorage.deleteKey('openrouter');
      expect(await keyStorage.hasKey('openrouter')).toBe(false);
    });
  });

  describe('Device key', () => {
    it('stores a non-extractable CryptoKey, not key material', async () => {
      const { keyStorage } = await freshServices();
      await keyStorage.saveKey('openrouter', 'sk-or-v1-non-extractable');

      const db = await openDeviceDb();
      const records = await db.getAll('deviceKey');
      db.close();

      expect(records).toHaveLength(1);
      const [record] = records;
      expect(record.id).toBe('device-crypto-key');
      expect(record.cryptoKey).toBeInstanceOf(CryptoKey);
      expect(record.cryptoKey.extractable).toBe(false);
      expect(record.cryptoKey.algorithm).toMatchObject({ name: 'AES-GCM', length: 256 });

      // Nothing in the record carries readable key material.
      expect(JSON.stringify(record)).not.toContain('value');
    });

    it('reuses the same device key across calls', async () => {
      const { keyStorage, deviceKeyManager } = await freshServices();
      await keyStorage.saveKey('openrouter', 'sk-or-v1-stable');

      // Each read deserializes a new handle, so identity is checked by use:
      // what one handle encrypts, the other has to decrypt.
      const first = await deviceKeyManager.getEncryptionKey();
      deviceKeyManager.clearCache();
      const second = await deviceKeyManager.getEncryptionKey();

      const iv = crypto.getRandomValues(new Uint8Array(12));
      const sealed = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        first,
        new TextEncoder().encode('same key')
      );
      const opened = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, second, sealed);

      expect(new TextDecoder().decode(opened)).toBe('same key');
      expect(await keyStorage.getKey('openrouter')).toBe('sk-or-v1-stable');
    });
  });

  describe('Insecure context', () => {
    it('getKey throws when crypto.subtle is absent', async () => {
      const { keyStorage } = await freshServices();
      await keyStorage.saveKey('openrouter', 'sk-or-v1-secure-only');

      vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) });

      await expect(keyStorage.getKey('openrouter')).rejects.toThrow(/crypto\.subtle unavailable/);
    });

    it('saveKey throws when crypto.subtle is absent', async () => {
      const { keyStorage } = await freshServices();

      vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) });

      await expect(keyStorage.saveKey('openrouter', 'sk-or-v1-secure-only')).rejects.toThrow(
        /crypto\.subtle unavailable/
      );
    });
  });

  describe('Records on disk', () => {
    it('never writes a record with encrypted false', async () => {
      const { keyStorage } = await freshServices();
      const legacyKey = await seedLegacyDeviceKey();

      // A base64 fallback record, the oldest shape that could carry encrypted false.
      const db = await openKeysDb();
      await db.put('keys', {
        id: 'openai',
        value: btoa('sk-test-plain-fallback'),
        encrypted: false,
        salt: [],
        timestamp: Date.now()
      });
      db.close();

      await seedLegacyRecord('openrouter', 'sk-or-v1-legacy', legacyKey, 600000, {
        storeIterations: true
      });
      await keyStorage.saveKey('custom-llm', 'sk-custom-fresh');
      await keyStorage.ensureMigrated();
      await keyStorage.markInvalid('openrouter');

      const records = await readKeyRecords();
      expect(records).toHaveLength(3);
      for (const record of records) {
        expect(record.encrypted).toBe(true);
      }
    });
  });

  describe('Migration from the legacy string key', () => {
    it('re-encrypts two legacy records under the device key', async () => {
      const { keyStorage } = await freshServices();
      const legacyKey = await seedLegacyDeviceKey();

      // One record carries its iteration count, one predates that field.
      await seedLegacyRecord('openrouter', 'sk-or-v1-legacy-one', legacyKey, 600000, {
        storeIterations: true
      });
      await seedLegacyRecord('openai', 'sk-legacy-two', legacyKey, 100000, {
        storeIterations: false
      });

      await keyStorage.ensureMigrated();

      const records = await readKeyRecords();
      expect(records).toHaveLength(2);
      for (const record of records) {
        expect(record.v).toBe(2);
        expect(record.encrypted).toBe(true);
        expect(record.salt).toBeUndefined();
        expect(record.iterations).toBeUndefined();
        expect(record.lastValidated).toBe('2026-01-01T00:00:00.000Z');
      }

      expect(await keyStorage.getKey('openrouter')).toBe('sk-or-v1-legacy-one');
      expect(await keyStorage.getKey('openai')).toBe('sk-legacy-two');
    });

    it('is idempotent across repeated runs and reloads', async () => {
      const { keyStorage } = await freshServices();
      const legacyKey = await seedLegacyDeviceKey();
      await seedLegacyRecord('openrouter', 'sk-or-v1-idempotent', legacyKey, 600000, {
        storeIterations: true
      });

      await keyStorage.ensureMigrated();
      const afterFirst = await readKeyRecords();

      await keyStorage.ensureMigrated();
      expect(await readKeyRecords()).toEqual(afterFirst);

      // A reload rebuilds the singletons against the same databases.
      vi.resetModules();
      const { keyStorage: reloaded } = await import('@/services/storage/keyStorageService');
      await reloaded.ensureMigrated();

      expect(await readKeyRecords()).toEqual(afterFirst);
      expect(await reloaded.getKey('openrouter')).toBe('sk-or-v1-idempotent');
    });

    it('leaves a record it cannot decrypt untouched and still migrates the rest', async () => {
      const { keyStorage } = await freshServices();
      const legacyKey = await seedLegacyDeviceKey();
      await seedLegacyRecord('openrouter', 'sk-or-v1-readable', legacyKey, 600000, {
        storeIterations: true
      });

      // Written under a different device key, so it can never be read here.
      await seedLegacyRecord('openai', 'sk-unreadable', await seedLegacyDeviceKey(), 600000, {
        storeIterations: true
      });
      // Restore the key the readable record was written with.
      const db = await openDeviceDb();
      await db.put('deviceKey', {
        id: 'encryption-key',
        value: legacyKey,
        created: Date.now(),
        version: 1
      });
      db.close();

      const before = (await readKeyRecords()).find((r) => r.id === 'openai');
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      await keyStorage.ensureMigrated();
      const after = await readKeyRecords();
      warn.mockRestore();

      expect(after.find((r) => r.id === 'openrouter')?.v).toBe(2);
      expect(after.find((r) => r.id === 'openai')).toEqual(before);
      expect(await keyStorage.getKey('openrouter')).toBe('sk-or-v1-readable');
    });

    it('migrates on the first read when no legacy key exists to migrate from', async () => {
      const { keyStorage } = await freshServices();

      await keyStorage.saveKey('openrouter', 'sk-or-v1-no-legacy');
      await keyStorage.ensureMigrated();

      const db = await openDeviceDb();
      const ids = (await db.getAll('deviceKey')).map((r) => r.id);
      db.close();

      expect(ids).toEqual(['device-crypto-key']);
      expect(await keyStorage.getKey('openrouter')).toBe('sk-or-v1-no-legacy');
    });
  });

  describe('lastUsed', () => {
    it('does not write on every read', async () => {
      const { keyStorage } = await freshServices();
      await keyStorage.saveKey('openrouter', 'sk-or-v1-last-used');

      await keyStorage.getKey('openrouter');
      const first = (await readKeyRecords())[0].lastUsed;
      expect(first).toBeTypeOf('number');

      await keyStorage.getKey('openrouter');
      await keyStorage.getKey('openrouter');

      expect((await readKeyRecords())[0].lastUsed).toBe(first);
    });
  });
});
