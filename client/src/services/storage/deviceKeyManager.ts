// client/src/services/storage/deviceKeyManager.ts
//
// Device-based encryption key management (2025 best practices)
// Generates and securely stores a device-specific encryption key for API key encryption

import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface DeviceKeyDB extends DBSchema {
  deviceKey: {
    key: string;
    value: {
      id: 'encryption-key';
      value: string;      // Base64-encoded 256-bit random key
      created: number;    // Timestamp when key was created
      version: number;    // Key version (for future rotation)
    };
  };
}

/**
 * DeviceKeyManager
 *
 * Manages a device-specific encryption key stored separately from encrypted data.
 * This provides defense-in-depth: even if API keys database is compromised,
 * attacker also needs the device key database.
 *
 * Security Properties:
 * - 256-bit random key (cryptographically secure)
 * - Stored in separate IndexedDB database
 * - Persists across browser sessions (good UX)
 * - Separated from encrypted data (defense in depth)
 * - One-time generation on first use
 *
 * @see OWASP Cryptographic Storage Cheat Sheet (2025)
 */
class DeviceKeyManager {
  private readonly DB_NAME = 'AgoraCosmicaDeviceKey';
  private readonly DB_VERSION = 1;
  private readonly STORE_NAME = 'deviceKey';
  private readonly KEY_ID = 'encryption-key';

  // Cache the key in memory to avoid repeated IndexedDB reads
  private cachedKey: string | null = null;

  /**
   * Get or generate device encryption key
   *
   * @returns Base64-encoded 256-bit random key
   * @throws Error if key generation fails
   */
  async getDeviceKey(): Promise<string> {
    // Return cached key if available
    if (this.cachedKey) {
      return this.cachedKey;
    }

    const db = await this.getDB();
    let record = await db.get(this.STORE_NAME, this.KEY_ID);

    if (!record) {
      // First-time setup: Generate new device key
      const key = this.generateStrongKey();

      record = {
        id: this.KEY_ID,
        value: key,
        created: Date.now(),
        version: 1
      };

      await db.put(this.STORE_NAME, record);
    }

    // Cache for performance
    this.cachedKey = record.value;
    return record.value;
  }

  /**
   * Generate cryptographically strong 256-bit random key
   *
   * Uses Web Crypto API's getRandomValues for cryptographic quality randomness.
   *
   * @returns Base64-encoded 256-bit random key
   */
  private generateStrongKey(): string {
    // Generate 256 bits (32 bytes) of cryptographic randomness
    const randomBytes = crypto.getRandomValues(new Uint8Array(32));

    // Convert to base64 for storage
    return btoa(String.fromCharCode(...randomBytes));
  }

  /**
   * Clear cached key from memory
   *
   * Call this on logout or security-sensitive operations.
   * Forces re-read from IndexedDB on next getDeviceKey() call.
   */
  clearCache(): void {
    this.cachedKey = null;
  }

  /**
   * Delete device key (use with caution!)
   *
   * WARNING: This will make all encrypted API keys unrecoverable.
   * Only use when user explicitly wants to clear all data.
   */
  async deleteDeviceKey(): Promise<void> {
    const db = await this.getDB();
    await db.delete(this.STORE_NAME, this.KEY_ID);
    this.cachedKey = null;
  }

  /**
   * Get device key metadata (without revealing the key)
   */
  async getKeyMetadata(): Promise<{ created: number; version: number } | null> {
    const db = await this.getDB();
    const record = await db.get(this.STORE_NAME, this.KEY_ID);

    if (!record) return null;

    return {
      created: record.created,
      version: record.version
    };
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  private async getDB(): Promise<IDBPDatabase<DeviceKeyDB>> {
    return openDB<DeviceKeyDB>(this.DB_NAME, this.DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('deviceKey')) {
          db.createObjectStore('deviceKey', { keyPath: 'id' });
        }
      }
    });
  }
}

// Export singleton instance
export const deviceKeyManager = new DeviceKeyManager();
