/**
 * SeedStateManager.ts
 * 
 * A central service for managing seed acquisition states
 * This provides a way for components to check if seeds are gathered
 * and subscribe to changes when seeds are acquired.
 */

interface SeedStateChangeData {
  figureId: string;
  seedId: string;
  action: 'gathered';
}

type SeedStateListener = (data: SeedStateChangeData) => void;
type UnsubscribeFunction = () => void;

/**
 * SeedStateManager Class
 * - Provides methods to check/update seed gathered state
 * - Acts as a central pub/sub system for seed state changes
 * - Uses localStorage as the source of truth
 */
import { LocalStorageAdapter } from '../storage/localAdapter';

class SeedStateManager {
  private listeners: SeedStateListener[];
  private debug: boolean;

  constructor() {
    this.listeners = [];
    this.debug = import.meta.env.DEV;
  }
  
  /**
   * Check if a seed is gathered based on localStorage
   * 
   * @param {string} figureId - The ID of the figure (e.g., 'plato', 'aurelius')
   * @param {string} seedId - The ID of the seed
   * @returns {boolean} - Whether the seed is gathered
   */
  isSeedGathered(figureId: string, seedId: string): boolean {
    if (!figureId || seedId === undefined || seedId === null) return false;
    
    try {
      // Ensure seedId is a string for string operations
      const seedIdStr = String(seedId);

      // Check the standard format key
      const standardKey = `completion_${figureId}_${seedIdStr}`;
      if (LocalStorageAdapter.getString(standardKey) === 'true') {
        if (this.debug) console.log(`Seed gathered: ${figureId}/${seedIdStr}`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error(`Error checking if seed is gathered: ${figureId}/${seedId}`, error);
      return false;
    }
  }
  
  /**
   * Mark a seed as gathered and notify listeners
   * 
   * @param {string} figureId - The ID of the figure (e.g., 'plato', 'aurelius')
   * @param {string} seedId - The ID of the seed
   * @returns {boolean} - Success status
   */
  markAsGathered(figureId: string, seedId: string): boolean {
    if (!figureId || !seedId) return false;
    
    try {
      // Store in localStorage
      const key = `completion_${figureId}_${seedId}`;
      LocalStorageAdapter.setString(key, 'true');
      
      // Notify all listeners
      this.notifyListeners({ figureId, seedId, action: 'gathered' });

      // Prismatic Bloom: notify that a mode was completed
      window.dispatchEvent(new CustomEvent('bloomModeCompleted', { detail: { figureId } }));

      return true;
    } catch (error) {
      console.error('Error marking seed as gathered:', error);
      return false;
    }
  }
  
  /**
   * Subscribe to seed state changes
   * 
   * @param {SeedStateListener} callback - Function to call when a seed state changes
   * @returns {UnsubscribeFunction} - Unsubscribe function
   */
  subscribe(callback: SeedStateListener): UnsubscribeFunction {
    if (typeof callback !== 'function') {
      console.error('SeedStateManager.subscribe requires a function callback');
      return () => {};
    }
    
    this.listeners.push(callback);
    
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }
  
  /**
   * Notify all listeners of a seed state change
   * 
   * @param {SeedStateChangeData} data - The change data to pass to listeners
   * @private
   */
  private notifyListeners(data: SeedStateChangeData): void {
    this.listeners.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error('Error in seed state listener:', error);
      }
    });
  }
  
  /**
   * Get all gathered seeds for a figure
   * 
   * @param {string} figureId - The figure ID (e.g., 'plato', 'aurelius')
   * @returns {string[]} - Array of gathered seed IDs
   */
  getGatheredSeedsForFigure(figureId: string): string[] {
    if (!figureId) return [];
    
    try {
      const gatheredSeeds: string[] = [];
      // Scan localStorage for completion keys
      const keys = LocalStorageAdapter.keys();
      for (const key of keys) {
        if (!key.startsWith(`completion_${figureId}_`)) {
          continue;
        }
        const value = LocalStorageAdapter.getString(key);
        if (value === 'true') {
          const seedId = key.replace(`completion_${figureId}_`, '');
          gatheredSeeds.push(seedId);
        }
      }
      return gatheredSeeds;
    } catch (error) {
      console.error('Error getting gathered seeds:', error);
      return [];
    }
  }
  
  /**
   * Debug method to dump all seed completion records
   * Used for troubleshooting
   */
  dumpCompletionRecords(): Record<string, string | null> {
    const keys = LocalStorageAdapter.keys();

    console.log('=== SEED COMPLETION RECORDS ===');
    const records: Record<string, string | null> = {};
    let totalCount = 0;

    try {
      // Scan localStorage for completion keys
      for (const key of keys) {
        if (!key.startsWith('completion_')) {
          continue;
        }
        const value = LocalStorageAdapter.getString(key);
        console.log(`${key} = ${value}`);
        records[key] = value;
        totalCount++;
      }
    } catch (error) {
      console.error('Error accessing localStorage for completion records:', error);
      return {};
    }
    
    console.log(`Total completion records: ${totalCount}`);
    console.log('==============================');
    
    return records;
  }
}

// Create and export a singleton instance
const seedStateManager = new SeedStateManager();

// Add to window for debugging (dev only)
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as any).seedStateManager = seedStateManager;
}

export default seedStateManager;
