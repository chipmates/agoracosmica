// src/utils/modeStateManager.ts

import { ConversationMode } from '../types/global';
import { LocalStorageAdapter } from '../storage/localAdapter';
import { useDomainStore } from '../stores';
import { normalizeMode } from './modeUtils';

/**
 * Stored mode state structure
 */
interface ModeState {
  mode: ConversationMode | string;
  timestamp: string;
}

/**
 * Mode state manager interface
 */
interface ModeStateManager {
  getStoredMode(figureId: string, seedId: string | number): ConversationMode | string | null;
  storeMode(figureId: string, seedId: string | number, mode: ConversationMode | string): void;
  clearStoredMode(figureId: string, seedId: string | number): void;
  getStorageKey(figureId: string, seedId: string | number): string;
  cleanupOldStates(figureId: string): void;
}

/**
 * Manages the storage and retrieval of conversation mode states for figure/seed combinations
 */
const MODE_STATE_PREFIX: string = 'modeState';

export const modeStateManager: ModeStateManager = {
  /**
   * Gets the stored mode for a specific figure and seed
   * @param figureId - ID of the figure (e.g., 'plato', 'aurelius')
   * @param seedId - ID of the seed
   * @returns The stored mode or null if not found
   */
  getStoredMode(figureId: string, seedId: string | number): ConversationMode | string | null {
    try {
      const key: string = this.getStorageKey(figureId, seedId);
      const store = useDomainStore.getState();
      const preferenceKey = `${figureId}:${seedId}`;
      const storedPreference = store.mode.preferences[preferenceKey];

      if (storedPreference) {
        return normalizeMode(storedPreference);
      }

      const persistedState = LocalStorageAdapter.getJSON<ModeState | null>(key, null);
      if (persistedState?.mode) {
        const normalized = normalizeMode(persistedState.mode);
        store.persistModePreference(figureId, seedId, normalized as ConversationMode);
        return normalized;
      }
      return null;
    } catch (error) {
      console.error('Error getting stored mode:', error);
    }
    return null;
  },

  /**
   * Stores the mode for a specific figure and seed
   * @param figureId - ID of the figure (e.g., 'plato', 'aurelius')
   * @param seedId - ID of the seed
   * @param mode - Mode to store
   */
  storeMode(figureId: string, seedId: string | number, mode: ConversationMode | string): void {
    try {
      const key: string = this.getStorageKey(figureId, seedId);
      const normalized = normalizeMode(mode);
      const state: ModeState = {
        mode: normalized,
        timestamp: new Date().toISOString()
      };
      const store = useDomainStore.getState();
      store.persistModePreference(figureId, seedId, normalized as ConversationMode);
      LocalStorageAdapter.setJSON(key, state);
    } catch (error) {
      console.error('Error storing mode:', error);
    }
  },

  /**
   * Clears the stored mode for a specific figure and seed
   * @param figureId - ID of the figure (e.g., 'plato', 'aurelius')
   * @param seedId - ID of the seed
   */
  clearStoredMode(figureId: string, seedId: string | number): void {
    try {
      const key: string = this.getStorageKey(figureId, seedId);
      LocalStorageAdapter.remove(key);
      const store = useDomainStore.getState();
      store.clearModePreference(figureId, seedId);
    } catch (error) {
      console.error('Error clearing stored mode:', error);
    }
  },

  /**
   * Gets the storage key for a figure/seed combination
   * @private
   */
  getStorageKey(figureId: string, seedId: string | number): string {
    return `${MODE_STATE_PREFIX}_${figureId}_${seedId}`;
  },

  /**
   * Cleans up old mode states
   * @param figureId - ID of the figure to clean up (e.g., 'plato', 'aurelius')
   */
  cleanupOldStates(figureId: string): void {
    try {
      const prefix: string = `${MODE_STATE_PREFIX}_${figureId}_`;
      const keysToRemove: string[] = LocalStorageAdapter.keys()
        .filter(key => key.startsWith(prefix));
      
      keysToRemove.forEach(key => {
        try {
          const state = LocalStorageAdapter.getJSON<ModeState | null>(key, null);
          if (state) {
            const timestamp: Date = new Date(state.timestamp);
            const now: Date = new Date();
            const thirtyDaysInMs: number = 30 * 24 * 60 * 60 * 1000;
            
            // Remove states older than 30 days
            if (now.getTime() - timestamp.getTime() > thirtyDaysInMs) {
              LocalStorageAdapter.remove(key);
              const seedId = key.replace(`${MODE_STATE_PREFIX}_${figureId}_`, '');
              const store = useDomainStore.getState();
              store.clearModePreference(figureId, seedId);
            }
          }
        } catch (e) {
          // If state is invalid, remove it
          LocalStorageAdapter.remove(key);
          const seedId = key.replace(`${MODE_STATE_PREFIX}_${figureId}_`, '');
          const store = useDomainStore.getState();
          store.clearModePreference(figureId, seedId);
        }
      });
    } catch (error) {
      console.error('Error cleaning up old states:', error);
    }
  }
};
