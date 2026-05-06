// client/src/storage/preferencesIndexedDbAdapter.ts
//
// IndexedDB-backed preferences storage (replaces localStorage)
// Mirrors preferencesAdapter.ts interface for easy migration

import { getFromStore, putToStore, deleteFromStore } from './indexedDbAdapter';
import { deviceKeyManager } from '../services/storage/deviceKeyManager';

const STORE_NAME = 'metadata' as const;
const PREFIX = 'pref.';

// Key constants (same as preferencesAdapter)
const SELECTED_LANGUAGE_KEY = `${PREFIX}selectedLanguage`;
const SELECTED_MODE_KEY = `${PREFIX}selectedMode`;
const SELECTED_SEED_PREFIX = `${PREFIX}selectedSeed_`;
const SELECTED_FIGURE_KEY = `${PREFIX}selectedFigure`;
const SELECTED_FIGURE_OBJECT_KEY = `${PREFIX}selectedFigureObject`;
const SERVICE_CONFIG_KEY = `${PREFIX}serviceConfig`;
const MOBILE_AUDIO_CONFIGURED_KEY = `${PREFIX}mobileAudioConfigured`;
const ONBOARDING_COMPLETE_KEY = `${PREFIX}onboardingComplete`;
const ONBOARDING_SKIPPED_KEY = `${PREFIX}onboardingSkipped`;
const HAS_VISITED_BEFORE_KEY = `${PREFIX}hasVisitedBefore`;
const FORCE_ONBOARDING_KEY = `${PREFIX}forceOnboarding`;
const USER_PROFILE_KEY = `${PREFIX}userProfile`; // Encrypted
const VOICE_PREFERENCES_KEY = `${PREFIX}voicePreferences`;

// Re-export types from preferencesAdapter
export interface StoredSeed<T = unknown> {
  data: T | null;
}

export interface OnboardingStatus {
  complete: boolean;
  skipped: boolean;
}

export interface ServiceConfigPayload {
  raw: string | null;
}

export interface VoicePreferences {
  // Legacy Kokoro preferences (flat structure for backwards compat)
  femaleVoice?: string;
  maleVoice?: string;

  // New structured preferences
  openai?: {
    femaleVoice: string;
    maleVoice: string;
  };
  kokoro?: {
    femaleVoice: string;
    maleVoice: string;
  };
}

// Encrypted data container
interface EncryptedData {
  ciphertext: string;
  iv: number[];
  salt: number[];
  timestamp: number;
}

/**
 * Encryption utilities (same pattern as keyStorageService)
 */
const PBKDF2_ITERATIONS = 600000; // OWASP 2025 standard

async function deriveKey(deviceKey: string, salt: Uint8Array): Promise<CryptoKey> {
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

async function encryptData<T>(data: T): Promise<EncryptedData> {
  const deviceKey = await deviceKeyManager.getDeviceKey();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12)); // GCM standard IV size

  const derivedKey = await deriveKey(deviceKey, salt);

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    derivedKey,
    new TextEncoder().encode(JSON.stringify(data))
  );

  return {
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
    iv: Array.from(iv),
    salt: Array.from(salt),
    timestamp: Date.now(),
  };
}

async function decryptData<T>(encrypted: EncryptedData): Promise<T> {
  const deviceKey = await deviceKeyManager.getDeviceKey();
  const salt = new Uint8Array(encrypted.salt);
  const iv = new Uint8Array(encrypted.iv);

  const derivedKey = await deriveKey(deviceKey, salt);

  const ciphertext = Uint8Array.from(atob(encrypted.ciphertext), (c) => c.charCodeAt(0));

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    derivedKey,
    ciphertext
  );

  return JSON.parse(new TextDecoder().decode(decrypted));
}

/**
 * IndexedDB Preferences Adapter
 *
 * Mirrors the interface of preferencesAdapter but stores data in IndexedDB.
 * User profile (name/email) is encrypted using AES-256-GCM.
 */
export const preferencesIndexedDbAdapter = {
  /**
   * Language Preferences
   */
  async getPreferredLanguage(): Promise<string> {
    const value = await getFromStore<string>(STORE_NAME, SELECTED_LANGUAGE_KEY);
    return value ?? 'en';
  },

  async setPreferredLanguage(language: string): Promise<void> {
    await putToStore(STORE_NAME, SELECTED_LANGUAGE_KEY, language);
  },

  /**
   * Figure Selection
   */
  async getSelectedFigureId(): Promise<string | null> {
    const value = await getFromStore<string>(STORE_NAME, SELECTED_FIGURE_KEY);
    return value ?? null;
  },

  async setSelectedFigureId(figureId: string | null): Promise<void> {
    if (!figureId) {
      await deleteFromStore(STORE_NAME, SELECTED_FIGURE_KEY);
      return;
    }
    await putToStore(STORE_NAME, SELECTED_FIGURE_KEY, figureId);
  },

  async getSelectedFigureObject<T = unknown>(): Promise<T | null> {
    const value = await getFromStore<T>(STORE_NAME, SELECTED_FIGURE_OBJECT_KEY);
    return value ?? null;
  },

  async setSelectedFigureObject<T = unknown>(figure: T | null): Promise<void> {
    if (!figure) {
      await deleteFromStore(STORE_NAME, SELECTED_FIGURE_OBJECT_KEY);
      return;
    }
    await putToStore(STORE_NAME, SELECTED_FIGURE_OBJECT_KEY, figure);
  },

  /**
   * Seed Selection (per figure)
   */
  async getSelectedSeed<T = unknown>(figureId: string): Promise<T | null> {
    if (!figureId) {
      return null;
    }
    const value = await getFromStore<T>(STORE_NAME, `${SELECTED_SEED_PREFIX}${figureId}`);
    return value ?? null;
  },

  async setSelectedSeed<T = unknown>(figureId: string, seed: T | null): Promise<void> {
    const key = `${SELECTED_SEED_PREFIX}${figureId}`;
    if (!figureId) {
      return;
    }

    if (seed) {
      await putToStore(STORE_NAME, key, seed);
    } else {
      await deleteFromStore(STORE_NAME, key);
    }
  },

  /**
   * Mode Selection
   */
  async getSelectedMode(): Promise<string | null> {
    const value = await getFromStore<string>(STORE_NAME, SELECTED_MODE_KEY);
    return value ?? null;
  },

  async setSelectedMode(mode: string | null): Promise<void> {
    if (!mode) {
      await deleteFromStore(STORE_NAME, SELECTED_MODE_KEY);
      return;
    }
    await putToStore(STORE_NAME, SELECTED_MODE_KEY, mode);
  },

  /**
   * Onboarding Status
   */
  async getOnboardingStatus(): Promise<OnboardingStatus> {
    const complete = (await getFromStore<string>(STORE_NAME, ONBOARDING_COMPLETE_KEY)) === 'true';
    const skipped = (await getFromStore<string>(STORE_NAME, ONBOARDING_SKIPPED_KEY)) === 'true';
    return { complete, skipped };
  },

  async setOnboardingComplete(): Promise<void> {
    await putToStore(STORE_NAME, ONBOARDING_COMPLETE_KEY, 'true');
    await deleteFromStore(STORE_NAME, ONBOARDING_SKIPPED_KEY);
  },

  async setOnboardingSkipped(): Promise<void> {
    await putToStore(STORE_NAME, ONBOARDING_SKIPPED_KEY, 'true');
    await deleteFromStore(STORE_NAME, ONBOARDING_COMPLETE_KEY);
  },

  async resetOnboarding(): Promise<void> {
    await deleteFromStore(STORE_NAME, ONBOARDING_COMPLETE_KEY);
    await deleteFromStore(STORE_NAME, ONBOARDING_SKIPPED_KEY);
  },

  /**
   * First Visit Tracking
   */
  async hasVisitedBefore(): Promise<boolean> {
    const value = await getFromStore<string>(STORE_NAME, HAS_VISITED_BEFORE_KEY);
    return value === 'true';
  },

  async markVisited(): Promise<void> {
    await putToStore(STORE_NAME, HAS_VISITED_BEFORE_KEY, 'true');
  },

  async clearVisited(): Promise<void> {
    await deleteFromStore(STORE_NAME, HAS_VISITED_BEFORE_KEY);
  },

  /**
   * Force Onboarding Flag
   */
  async shouldForceOnboarding(): Promise<boolean> {
    const value = await getFromStore<string>(STORE_NAME, FORCE_ONBOARDING_KEY);
    return value === 'true';
  },

  async setForceOnboarding(value: boolean): Promise<void> {
    if (value) {
      await putToStore(STORE_NAME, FORCE_ONBOARDING_KEY, 'true');
    } else {
      await deleteFromStore(STORE_NAME, FORCE_ONBOARDING_KEY);
    }
  },

  /**
   * User Profile (ENCRYPTED)
   *
   * Stores name and email using AES-256-GCM encryption.
   * This is the security improvement over localStorage plaintext storage.
   */
  async getUserProfile(): Promise<{ name: string | null; email: string | null; avatar: string | null; locale: string | null }> {
    try {
      const encrypted = await getFromStore<EncryptedData>(STORE_NAME, USER_PROFILE_KEY);

      if (!encrypted) {
        return { name: null, email: null, avatar: null, locale: null };
      }

      const decrypted = await decryptData<{ name?: string | null; email?: string | null; avatar?: string | null; locale?: string | null }>(encrypted);

      return {
        name: decrypted.name ?? null,
        email: decrypted.email ?? null,
        avatar: decrypted.avatar ?? null,
        locale: decrypted.locale ?? null,
      };
    } catch (error) {
      console.error('[Preferences] Failed to decrypt user profile:', error);
      return { name: null, email: null, avatar: null, locale: null };
    }
  },

  async hasUserProfile(): Promise<boolean> {
    try {
      const encrypted = await getFromStore<EncryptedData>(STORE_NAME, USER_PROFILE_KEY);
      return !!encrypted;
    } catch {
      return false;
    }
  },

  async setUserProfile(profile: { name?: string | null; email?: string | null; avatar?: string | null; locale?: string | null }): Promise<void> {
    try {
      // Get existing profile
      const existing = await this.getUserProfile();

      // Merge with new values
      const updated = {
        name: profile.name !== undefined ? profile.name : existing.name,
        email: profile.email !== undefined ? profile.email : existing.email,
        avatar: profile.avatar !== undefined ? profile.avatar : existing.avatar,
        locale: profile.locale !== undefined ? profile.locale : existing.locale,
      };

      // Encrypt and store
      const encrypted = await encryptData(updated);
      await putToStore(STORE_NAME, USER_PROFILE_KEY, encrypted);
    } catch (error) {
      console.error('[Preferences] Failed to encrypt user profile:', error);
      throw error;
    }
  },

  async deleteUserProfile(): Promise<void> {
    await deleteFromStore(STORE_NAME, USER_PROFILE_KEY);
  },

  /**
   * Service Configuration
   */
  async getServiceConfig(): Promise<ServiceConfigPayload> {
    const raw = await getFromStore<string>(STORE_NAME, SERVICE_CONFIG_KEY);
    return { raw: raw ?? null };
  },

  async setServiceConfig(config: unknown): Promise<void> {
    await putToStore(STORE_NAME, SERVICE_CONFIG_KEY, JSON.stringify(config));
  },

  async clearServiceConfig(): Promise<void> {
    await deleteFromStore(STORE_NAME, SERVICE_CONFIG_KEY);
  },

  /**
   * Mobile Audio Configuration
   */
  async isMobileAudioConfigured(): Promise<boolean> {
    const value = await getFromStore<string>(STORE_NAME, MOBILE_AUDIO_CONFIGURED_KEY);
    return value === 'true';
  },

  async markMobileAudioConfigured(): Promise<void> {
    await putToStore(STORE_NAME, MOBILE_AUDIO_CONFIGURED_KEY, 'true');
  },

  async resetMobileAudioConfig(): Promise<void> {
    await deleteFromStore(STORE_NAME, MOBILE_AUDIO_CONFIGURED_KEY);
  },

  /**
   * Voice Preferences
   */
  async getVoicePreferences(): Promise<VoicePreferences> {
    const stored = await getFromStore<VoicePreferences | null>(STORE_NAME, VOICE_PREFERENCES_KEY);

    // Return stored with defaults for missing values (same as localStorage version)
    return {
      // Legacy flat structure (for backwards compat)
      femaleVoice: stored?.femaleVoice || stored?.kokoro?.femaleVoice || 'stella',
      maleVoice: stored?.maleVoice || stored?.kokoro?.maleVoice || 'orion',

      // Structured preferences
      openai: {
        femaleVoice: stored?.openai?.femaleVoice || 'nova',
        maleVoice: stored?.openai?.maleVoice || 'onyx',
      },
      kokoro: {
        femaleVoice: stored?.kokoro?.femaleVoice || stored?.femaleVoice || 'stella',
        maleVoice: stored?.kokoro?.maleVoice || stored?.maleVoice || 'orion',
      },
    };
  },

  async setVoicePreferences(prefs: Partial<VoicePreferences>): Promise<void> {
    const current = await this.getVoicePreferences();
    const updated = { ...current, ...prefs };
    await putToStore(STORE_NAME, VOICE_PREFERENCES_KEY, updated);
  },

  async clearVoicePreferences(): Promise<void> {
    await deleteFromStore(STORE_NAME, VOICE_PREFERENCES_KEY);
  },

  /**
   * Clear legacy TTS notices (no-op in IndexedDB version, for API compatibility)
   */
  async clearLegacyTtsNotices(): Promise<void> {
    // These keys were only in localStorage, not migrated to IndexedDB
    // This method exists for API compatibility with preferencesAdapter
    return Promise.resolve();
  },
};
