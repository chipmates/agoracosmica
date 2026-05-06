// src/services/history/historyExportService.ts

import { LocalStorageAdapter } from '../../storage/localAdapter';
import { runWithWal } from '../../storage';
import {
  buildWalOperationsFromModeData,
  createClearHistoryWalOperation,
  readIndexedDbConversationEntries,
} from './historyStorageUtils';

/**
 * Service for exporting and importing conversation history
 */

const enrichModeDataFromIndexedDb = async (modeData: Record<string, string | null>) => {
  try {
    const entries = await readIndexedDbConversationEntries();
    for (const entry of entries) {
      try {
        modeData[entry.key] = JSON.stringify(entry.messages);
      } catch (error) {
        console.warn('[historyExportService] Failed to serialize IndexedDB history for key', entry.key, error);
      }
    }
  } catch (error) {
    console.warn('[historyExportService] Failed to read histories from IndexedDB', error);
  }
};

const restoreIndexedDbHistories = async (modeData?: Record<string, string | null>) => {
  try {
    const clearOperation = createClearHistoryWalOperation();
    await runWithWal([clearOperation], async () => undefined);
  } catch (error) {
    console.warn('[historyExportService] Failed to clear IndexedDB history store before import', error);
    // If we cannot clear the store, bail out to avoid mixing states.
    return;
  }

  if (!modeData) {
    return;
  }

  const operations = buildWalOperationsFromModeData(modeData);

  if (operations.length === 0) {
    return;
  }

  try {
    await runWithWal(operations, async () => undefined);
  } catch (error) {
    console.warn('[historyExportService] Failed to persist histories to IndexedDB during import', error);
  }
};

// Backups are always global (every figure, every mode). The `figure` metadata
// field stays in the schema (null) for v2.0 forward-compat with older backups
// that may set it to a figure name; nothing in the import path reads it.
export const exportHistory = async () => {
  const backupData = {
    version: '2.0', // New format version
    figure: null,
    exportDate: new Date().toISOString(),
    modeData: {}, // New structure for mode-based storage
    states: {},
    completions: {},
    storyViewed: {},
    prismData: {},
    councilData: {}
  } as Record<string, any>;

  // Get current date in format YYYY-MM-DD
  const currentDate = new Date().toISOString().split('T')[0];

  // Backup mode-specific data (new format)
  const allKeys = LocalStorageAdapter.keys();
  const modeKeys = allKeys.filter(k => 
    k.startsWith('story_') ||
    k.startsWith('starseed_') ||
    k.startsWith('challenge_') ||
    k.startsWith('freetalk_') ||
    k.startsWith('summary_')
  );

  modeKeys.forEach(key => {
    backupData.modeData[key] = LocalStorageAdapter.getString(key);
  });

  await enrichModeDataFromIndexedDb(backupData.modeData);

  // Backup application states
  const stateKeys = allKeys.filter(k => k.startsWith('modeState_'));
  stateKeys.forEach(key => {
    backupData.states[key] = LocalStorageAdapter.getString(key);
  });

  // Backup seed completions (gathered state)
  const completionKeys = allKeys.filter(k => k.startsWith('completion_'));
  completionKeys.forEach(key => {
    backupData.completions[key] = LocalStorageAdapter.getString(key);
  });

  // Backup story viewed states
  const storyViewedKeys = allKeys.filter(k => k.startsWith('storyViewed_'));
  storyViewedKeys.forEach(key => {
    backupData.storyViewed[key] = LocalStorageAdapter.getString(key);
  });

  // Backup story playback progress (resume positions)
  backupData.storyProgress = {};
  const storyProgressKeys = allKeys.filter(k => k.startsWith('storyProgress_'));
  storyProgressKeys.forEach(key => {
    backupData.storyProgress[key] = LocalStorageAdapter.getString(key);
  });

  // Backup prism data (content and completion state)
  const prismKeys = allKeys.filter(k => k.startsWith('prism_'));
  prismKeys.forEach(key => {
    backupData.prismData[key] = LocalStorageAdapter.getString(key);
  });

  // Backup council data (content and completion state)
  const councilKeys = allKeys.filter(k => k.startsWith('council_'));
  councilKeys.forEach(key => {
    backupData.councilData[key] = LocalStorageAdapter.getString(key);
  });

  const dataStr = JSON.stringify(backupData, null, 2);
  const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
  
  const exportFileDefaultName = `agora_cosmica_backup_${currentDate}.json`;
  
  const linkElement = document.createElement('a');
  linkElement.setAttribute('href', dataUri);
  linkElement.setAttribute('download', exportFileDefaultName);
  linkElement.click();
};

export const importHistory = async (
  file: File,
  onSuccess: () => void,
  onError: (error: unknown) => void
): Promise<void> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();

    const handleSuccess = () => {
      try {
        onSuccess();
      } finally {
        resolve();
      }
    };

    const handleError = (error: unknown) => {
      try {
        onError(error);
      } finally {
        reject(error instanceof Error ? error : new Error('Unknown import error'));
      }
    };

    reader.onerror = () => {
      handleError(reader.error ?? new Error('Failed to read backup file'));
    };

    reader.onload = async (event) => {
      try {
        const importedData = JSON.parse((event.target?.result as string) ?? '');

        // Check if it's the new format or old format
        if (importedData.version !== '2.0') {
          throw new Error('Unsupported backup format');
        }

        // Validate payload structure BEFORE clearing any data
        if (!importedData.modeData) {
          throw new Error('Old format import not supported');
        }

        const allKeys = LocalStorageAdapter.keys();
        const modeKeys = allKeys.filter(k =>
          k.startsWith('story_') ||
          k.startsWith('starseed_') ||
          k.startsWith('challenge_') ||
          k.startsWith('freetalk_') ||
          k.startsWith('summary_')
        );

        // Create a backup of the current completions before replacing
        const currentCompletions: Record<string, string | null> = {};
        const completionKeys = allKeys.filter(k => k.startsWith('completion_'));
        completionKeys.forEach(key => {
          currentCompletions[key] = LocalStorageAdapter.getString(key);
        });

        // Store the backup with timestamp
        const timestamp = new Date().toISOString().replace(/:/g, '-');
        LocalStorageAdapter.setJSON(`backup_before_import_${timestamp}`, currentCompletions);

        // Save current keys before clearing (for rollback on failure)
        const savedKeys = new Map<string, string>();
        [...modeKeys, ...completionKeys].forEach(key => {
          const val = LocalStorageAdapter.getString(key);
          if (val !== null) savedKeys.set(key, val);
        });

        // Clear existing mode-based keys
        modeKeys.forEach(key => {
          LocalStorageAdapter.remove(key);
        });

        // Clear existing completion keys
        completionKeys.forEach(key => {
          LocalStorageAdapter.remove(key);
        });

        // Restore imported data — rollback to saved keys if any step fails
        try {

        // Allowed key prefixes for each import section (prevents arbitrary key injection)
        const ALLOWED_MODE_PREFIXES = ['story_', 'starseed_', 'challenge_', 'freetalk_', 'summary_'];
        const ALLOWED_STATE_PREFIXES = ['modeState_'];
        const ALLOWED_COMPLETION_PREFIXES = ['completion_'];
        const ALLOWED_STORY_VIEWED_PREFIXES = ['storyViewed_'];

        const hasAllowedPrefix = (key: string, prefixes: string[]) =>
          prefixes.some(p => key.startsWith(p));

        // Restore data (validated against allowed prefixes)
        Object.entries(importedData.modeData).forEach(([key, value]) => {
          if (value && typeof value === 'string' && hasAllowedPrefix(key, ALLOWED_MODE_PREFIXES)) {
            LocalStorageAdapter.setString(key, value);
          }
        });
        await restoreIndexedDbHistories(importedData.modeData);

        // Restore states
        if (importedData.states) {
          Object.entries(importedData.states).forEach(([key, value]) => {
            if (value && typeof value === 'string' && hasAllowedPrefix(key, ALLOWED_STATE_PREFIXES)) {
              LocalStorageAdapter.setString(key, value);
            }
          });
        }

        // Restore completions (seed gathered states)
        if (importedData.completions) {
          Object.entries(importedData.completions).forEach(([key, value]) => {
            if (value && typeof value === 'string' && hasAllowedPrefix(key, ALLOWED_COMPLETION_PREFIXES)) {
              LocalStorageAdapter.setString(key, value);
            }
          });
        }

        // Restore story viewed states if available
        if (importedData.storyViewed) {
          Object.entries(importedData.storyViewed).forEach(([key, value]) => {
            if (value && typeof value === 'string' && hasAllowedPrefix(key, ALLOWED_STORY_VIEWED_PREFIXES)) {
              LocalStorageAdapter.setString(key, value);
            }
          });
        }

        // Restore story playback progress (resume positions)
        if (importedData.storyProgress) {
          Object.entries(importedData.storyProgress).forEach(([key, value]) => {
            if (value && typeof value === 'string' && key.startsWith('storyProgress_')) {
              LocalStorageAdapter.setString(key, value);
            }
          });
        }

        // Restore prism data (content and completion)
        if (importedData.prismData) {
          Object.entries(importedData.prismData).forEach(([key, value]) => {
            if (value && typeof value === 'string' && key.startsWith('prism_')) {
              LocalStorageAdapter.setString(key, value);
            }
          });
        }

        // Restore council data (content and completion)
        if (importedData.councilData) {
          Object.entries(importedData.councilData).forEach(([key, value]) => {
            if (value && typeof value === 'string' && key.startsWith('council_')) {
              LocalStorageAdapter.setString(key, value);
            }
          });
        }

        // Trigger history restored event to update UI state without refresh
        window.dispatchEvent(new CustomEvent('app:history-restored', {
          detail: { source: 'import', figure: importedData.figure }
        }));

        } catch (restoreError) {
          // Rollback: restore previously saved keys
          console.error('[Import] Restore failed, rolling back:', restoreError);
          for (const [key, value] of savedKeys) {
            LocalStorageAdapter.setString(key, value);
          }
          throw restoreError;
        }

        handleSuccess();
      } catch (error) {
        handleError(error);
      }
    };

    try {
      reader.readAsText(file);
    } catch (error) {
      handleError(error);
    }
  });
