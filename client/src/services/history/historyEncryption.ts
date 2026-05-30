// Conversation-history encryption at rest (AES-256-GCM).
//
// Same crypto pattern already shipped for the BYOK API key (keyStorageService)
// and the user profile (preferencesIndexedDbAdapter): PBKDF2-derived AES-256-GCM
// from the per-device key, with a random salt + IV per record. Conversations are
// stored only in the browser and never sent to our servers; this encrypts them
// at rest so a raw IndexedDB / disk dump (shared machine, stolen laptop, backup
// extraction) cannot read them.
//
// Two invariants make this safe to drop into the existing storage path:
//  1. Encryption is a transparent transform at the history-store boundary, so
//     decrypt(encrypt(messages)) === messages and the UI sees the same array.
//  2. Reads NEVER throw and NEVER destroy data: a record that fails to decrypt
//     (e.g. the device key was cleared) returns null, which every call site
//     already treats as "no history" (a fresh thread), and a legacy plaintext
//     array is passed straight through. The ciphertext is left intact on a
//     failed decrypt, so data is recoverable if the key returns.

import { deviceKeyManager } from '../storage/deviceKeyManager';

// Mirrors the EncryptedData container used by preferencesIndexedDbAdapter.
export interface EncryptedHistory {
  ciphertext: string;
  iv: number[];
  salt: number[];
  timestamp: number;
}

const PBKDF2_ITERATIONS = 600000; // OWASP 2025 standard, matches the profile adapter

const hasSubtleCrypto = (): boolean =>
  typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined';

async function deriveKey(deviceKey: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(deviceKey),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Narrow an unknown stored value to the encrypted container shape. A conversation
 * history is always a JSON array; an encrypted record is always an object with a
 * string `ciphertext`, so the two shapes can never collide.
 */
export function isEncryptedHistory(value: unknown): value is EncryptedHistory {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as { ciphertext?: unknown }).ciphertext === 'string'
  );
}

/**
 * Encrypt a messages array for storage. In a non-secure context (no
 * crypto.subtle) we fall back to storing the plain array so save+load never
 * break offline or on local http; this matches the API key service's
 * insecure-context fallback philosophy.
 */
export async function encryptHistory<T>(messages: T): Promise<EncryptedHistory | T> {
  if (!hasSubtleCrypto()) {
    return messages;
  }

  const deviceKey = await deviceKeyManager.getDeviceKey();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12)); // GCM standard IV size
  const derivedKey = await deriveKey(deviceKey, salt);

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    derivedKey,
    new TextEncoder().encode(JSON.stringify(messages))
  );

  return {
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
    iv: Array.from(iv),
    salt: Array.from(salt),
    timestamp: Date.now(),
  };
}

/**
 * Decrypt an encrypted history record. Returns null on ANY failure (never
 * throws): a cleared/rotated device key, corrupt bytes, or a non-secure
 * context all degrade to "no history" rather than a crash. The caller's
 * ciphertext is left untouched, so the data is recoverable if the key returns.
 */
export async function decryptHistory<T>(record: EncryptedHistory): Promise<T | null> {
  if (!hasSubtleCrypto()) {
    return null;
  }

  try {
    const deviceKey = await deviceKeyManager.getDeviceKey();
    const salt = new Uint8Array(record.salt);
    const iv = new Uint8Array(record.iv);
    const derivedKey = await deriveKey(deviceKey, salt);
    const ciphertext = Uint8Array.from(atob(record.ciphertext), (c) => c.charCodeAt(0));

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      derivedKey,
      ciphertext
    );

    return JSON.parse(new TextDecoder().decode(decrypted)) as T;
  } catch (error) {
    console.warn('[historyEncryption] Failed to decrypt history record; treating as empty', error);
    return null;
  }
}

/**
 * Read a history record from IndexedDB and return the plain messages array.
 * Handles all three states transparently:
 *  - encrypted record  -> decrypt (null on failure)
 *  - legacy plain array -> passthrough (migrated to ciphertext on next write)
 *  - missing/other      -> null
 *
 * This is the single read chokepoint; every history read site routes through it.
 */
export async function readHistoryMessages<T>(key: string): Promise<T[] | null> {
  // Imported lazily to avoid a static cycle (storage barrel <-> history layer).
  const { getFromStore } = await import('../../storage');
  let stored: unknown;
  try {
    stored = await getFromStore<unknown>('history', key);
  } catch (error) {
    console.warn(`[historyEncryption] Failed to read history for ${key}`, error);
    return null;
  }

  if (isEncryptedHistory(stored)) {
    return decryptHistory<T[]>(stored);
  }
  if (Array.isArray(stored)) {
    return stored as T[];
  }
  return null;
}
