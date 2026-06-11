// client/src/services/storage/keyStorageService.ts
//
// Secure API key storage with AES-256-GCM encryption (2025 best practices)
// All keys are encrypted at rest using device-specific encryption key

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { deviceKeyManager } from './deviceKeyManager';

// Database schema
interface KeysDB extends DBSchema {
  keys: {
    key: string;
    value: {
      id: 'openrouter' | 'openai' | 'deepinfra' | 'custom-llm'; // 'deepinfra' kept for migration (legacy keys)
      value: string;           // Encrypted API key (AES-256-GCM) or base64 fallback
      encrypted: boolean;      // true = AES-256-GCM, false = base64 fallback (insecure context)
      salt: number[];          // Salt for PBKDF2 (empty for fallback)
      iterations?: number;     // PBKDF2 iterations used at save time (absent = legacy record, device-class dependent)
      timestamp: number;       // When stored
      valid?: boolean;         // Last validation result
      lastUsed?: number;       // Last usage timestamp
      lastValidated?: string;  // ISO timestamp of last validation
    };
  };
}

/**
 * KeyStorageService
 *
 * Secure storage for API keys with mandatory encryption using 2025 best practices:
 * - AES-256-GCM encryption (NIST approved, quantum-resistant)
 * - PBKDF2-HMAC-SHA256 with 600,000 iterations (OWASP 2023-2025)
 * - Separate device key storage (defense in depth)
 * - Web Crypto API (constant-time operations)
 *
 * Security Properties:
 * ✅ Encrypted at rest in IndexedDB
 * ✅ Separate encryption key database
 * ✅ 256-bit key derivation
 * ✅ Random salt per key
 * ✅ Authenticated encryption (GCM mode)
 * ✅ No plaintext storage option
 *
 * @see OWASP Cryptographic Storage Cheat Sheet (2025)
 * @see NIST SP 800-132 (PBKDF2 Recommendations)
 */
class KeyStorageService {
  private readonly DB_NAME = 'AgoraCosmicaKeys';
  private readonly DB_VERSION = 1;

  /**
   * PBKDF2 iterations - mobile-aware
   *
   * OWASP 2023-2025 recommendation: 600,000 iterations for PBKDF2-HMAC-SHA256
   * Mobile: Reduced to 100,000 to prevent browser hangs (still NIST compliant)
   */
  private get PBKDF2_ITERATIONS(): number {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      (navigator.maxTouchPoints && navigator.maxTouchPoints > 2);
    return isMobile ? 100000 : 600000;
  }

  /**
   * Save API key with mandatory AES-256-GCM encryption
   *
   * @param provider - 'openrouter', 'openai', or 'deepinfra' (legacy)
   * @param apiKey - The API key to store (will be encrypted)
   * @param options - Optional metadata
   * @throws Error if encryption fails
   */
  async saveKey(
    provider: 'openrouter' | 'openai' | 'deepinfra' | 'custom-llm',
    apiKey: string,
    options?: { provider?: string; lastValidated?: string }
  ): Promise<void> {
    const db = await this.getDB();

    // Check if Web Crypto API is available (requires secure context)
    const hasCryptoSubtle = typeof crypto !== 'undefined' && crypto.subtle;

    if (!hasCryptoSubtle) {
      throw new Error(
        '[KeyStorage] crypto.subtle unavailable — secure context required. ' +
        'API keys cannot be stored without encryption. Ensure HTTPS or localhost.'
      );
    }

    // Get device encryption key (auto-generated on first use)
    const deviceKey = await deviceKeyManager.getDeviceKey();

    // Generate random salt (16 bytes = 128 bits)
    const salt = crypto.getRandomValues(new Uint8Array(16));

    // Derive encryption key using PBKDF2
    const derivedKey = await this.deriveKey(deviceKey, salt);

    // Encrypt API key using AES-256-GCM
    const encrypted = await this.encryptAES(apiKey, derivedKey);

    // Store encrypted key
    await db.put('keys', {
      id: provider,
      value: encrypted,
      encrypted: true,  // Always true (no plaintext option)
      salt: Array.from(salt),
      // Stored per record: the device-class heuristic (mobile vs desktop) can
      // flip between save and load, and a key derived with one count can never
      // be decrypted with the other.
      iterations: this.PBKDF2_ITERATIONS,
      timestamp: Date.now(),
      valid: true,
      ...(options?.lastValidated && { lastValidated: options.lastValidated })
    });
  }

  /**
   * Retrieve and decrypt API key
   *
   * @param provider - 'openrouter', 'openai', or 'deepinfra' (legacy)
   * @returns Decrypted API key or null if not found
   * @throws Error if decryption fails
   */
  async getKey(provider: 'openrouter' | 'openai' | 'deepinfra' | 'custom-llm'): Promise<string | null> {
    const db = await this.getDB();
    const record = await db.get('keys', provider);

    if (!record) return null;

    // Migrate legacy unencrypted (base64) records to encrypted storage
    if (!record.encrypted) {
      const decoded = atob(record.value);
      const hasCryptoSubtle = typeof crypto !== 'undefined' && crypto.subtle;
      if (hasCryptoSubtle) {
        // Re-save with encryption, then return
        await this.saveKey(provider, decoded);
      }
      await this.updateLastUsed(provider);
      return decoded;
    }

    // Get device encryption key
    const deviceKey = await deviceKeyManager.getDeviceKey();

    // Derive decryption key using stored salt. Records written before the
    // iterations field used the device-class count of the day; if the
    // classification has flipped since (UA change, touch-points change), the
    // current count fails, so legacy records retry the other count and
    // re-save with the count stored explicitly.
    const salt = new Uint8Array(record.salt);
    let decrypted: string;
    if (record.iterations) {
      const derivedKey = await this.deriveKey(deviceKey, salt, record.iterations);
      decrypted = await this.decryptAES(record.value, derivedKey);
    } else {
      try {
        const derivedKey = await this.deriveKey(deviceKey, salt);
        decrypted = await this.decryptAES(record.value, derivedKey);
      } catch {
        const alternate = this.PBKDF2_ITERATIONS === 600000 ? 100000 : 600000;
        const retryKey = await this.deriveKey(deviceKey, salt, alternate);
        decrypted = await this.decryptAES(record.value, retryKey);
      }
      // Migrate: re-save so the record carries its iteration count from now on.
      await this.saveKey(provider, decrypted);
    }

    // Update last used timestamp
    await this.updateLastUsed(provider);

    return decrypted;
  }

  /**
   * Check if key exists
   */
  async hasKey(provider: 'openrouter' | 'openai' | 'deepinfra' | 'custom-llm'): Promise<boolean> {
    const db = await this.getDB();
    const record = await db.get('keys', provider);
    return !!record;
  }

  /**
   * Get key metadata without retrieving the actual key
   */
  async getKeyMetadata(provider: 'openrouter' | 'openai' | 'deepinfra' | 'custom-llm'): Promise<{
    valid?: boolean;
    lastUsed?: number;
    lastValidated?: string;
    timestamp: number;
  } | null> {
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
   * Delete key securely
   *
   * Note: This only deletes the encrypted key from IndexedDB.
   * The device encryption key remains for other keys.
   */
  async deleteKey(provider: 'openrouter' | 'openai' | 'deepinfra' | 'custom-llm'): Promise<void> {
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
  async markInvalid(provider: 'openrouter' | 'openai' | 'deepinfra' | 'custom-llm'): Promise<void> {
    const db = await this.getDB();
    const record = await db.get('keys', provider);
    if (record) {
      record.valid = false;
      await db.put('keys', record);
    }
  }

  /**
   * Export all keys (encrypted)
   *
   * Note: Exported keys remain encrypted with device key.
   * They can only be decrypted on the same device.
   *
   * @returns JSON string with encrypted keys
   */
  async exportKeys(): Promise<string> {
    const db = await this.getDB();
    const allKeys = await db.getAll('keys');

    const exported = {
      version: 1,
      timestamp: Date.now(),
      encrypted: true,
      keys: allKeys
    };

    return JSON.stringify(exported);
  }

  /**
   * Import keys from export
   *
   * Warning: Imported keys must be from the same device (same device encryption key).
   * Cross-device imports will fail during decryption.
   *
   * @param exportedData - JSON string from exportKeys()
   * @throws Error if import fails or format is invalid
   */
  async importKeys(exportedData: string): Promise<void> {
    const data = JSON.parse(exportedData);

    if (data.version !== 1) {
      throw new Error(`Unsupported export version: ${data.version}`);
    }

    if (!data.encrypted) {
      throw new Error('Cannot import unencrypted keys');
    }

    const db = await this.getDB();

    // Import all keys
    for (const keyRecord of data.keys) {
      await db.put('keys', keyRecord);
    }
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  private async getDB(): Promise<IDBPDatabase<KeysDB>> {
    return openDB<KeysDB>(this.DB_NAME, this.DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('keys')) {
          db.createObjectStore('keys', { keyPath: 'id' });
        }
      }
    });
  }

  private async updateLastUsed(provider: 'openrouter' | 'openai' | 'deepinfra' | 'custom-llm'): Promise<void> {
    const db = await this.getDB();
    const record = await db.get('keys', provider);
    if (record) {
      record.lastUsed = Date.now();
      await db.put('keys', record);
    }
  }

  /**
   * Derive encryption key from device key using PBKDF2
   *
   * OWASP 2023-2025 recommendation: 600,000 iterations for PBKDF2-HMAC-SHA256
   * (6x increase from 2021 standard due to GPU performance improvements)
   *
   * @param deviceKey - Base64-encoded device key
   * @param salt - Random salt (16 bytes)
   * @returns CryptoKey for AES-256-GCM
   */
  private async deriveKey(deviceKey: string, salt: Uint8Array<ArrayBuffer>, iterations?: number): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(deviceKey),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: iterations ?? this.PBKDF2_ITERATIONS,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypt using AES-256-GCM
   *
   * GCM mode provides both encryption and authentication (AEAD).
   * This prevents tampering with encrypted data.
   *
   * @param text - Plaintext to encrypt
   * @param key - Derived encryption key
   * @returns JSON string with IV and encrypted data
   */
  private async encryptAES(text: string, key: CryptoKey): Promise<string> {
    // Generate random IV (12 bytes = 96 bits, NIST recommendation for GCM)
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();

    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      encoder.encode(text)
    );

    // Store IV with encrypted data (IV can be public, doesn't need to be secret)
    return JSON.stringify({
      iv: Array.from(iv),
      data: Array.from(new Uint8Array(encrypted))
    });
  }

  /**
   * Decrypt using AES-256-GCM
   *
   * @param encryptedData - JSON string from encryptAES()
   * @param key - Derived decryption key
   * @returns Decrypted plaintext
   * @throws Error if decryption fails (wrong key, tampered data, etc.)
   */
  private async decryptAES(encryptedData: string, key: CryptoKey): Promise<string> {
    const { iv, data } = JSON.parse(encryptedData);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(iv) },
      key,
      new Uint8Array(data)
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  }
}

// Export singleton
export const keyStorage = new KeyStorageService();
