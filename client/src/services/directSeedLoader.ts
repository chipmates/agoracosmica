/**
 * Direct Seed Loader - R2-backed
 * Fetches seed translations from R2 on demand.
 * Results are cached in window.seedsCache by seedCacheInitializer.
 */

import { Language, SeedCollection } from '../types/global';

// Dev: relative URL (Vite proxy forwards to R2)
// Prod: absolute URL to R2 via CF Worker
const MEDIA_BASE = import.meta.env.DEV
  ? ''
  : (import.meta.env.VITE_MEDIA_BASE_URL || 'https://media.agoracosmica.org');

export const loadSeedsDirectly = async (figure: string, language: Language | string = 'en'): Promise<SeedCollection | null> => {
  try {
    const url = `${MEDIA_BASE}/seeds/${language}/${figure}-seeds.json`;
    const response = await fetch(url);

    if (!response.ok) {
      console.warn(`[DirectSeedLoader] Seeds not found: ${url}`);

      // Fallback to English if not English already
      if (language !== 'en') {
        return loadSeedsDirectly(figure, 'en');
      }

      return null;
    }

    return await response.json();

  } catch (error) {
    console.error(`[DirectSeedLoader] Failed to load ${language} seeds for ${figure}:`, error);

    // Fallback to English only if really needed
    if (language !== 'en') {
      return loadSeedsDirectly(figure, 'en');
    }

    return null;
  }
};

/**
 * Debug function to show R2 seed configuration
 */
export const debugAvailableSeeds = (): void => {
  console.log('[DirectSeedLoader] Seeds served from R2:', MEDIA_BASE || '(via Vite proxy)');
  console.log('[DirectSeedLoader] Pattern: /seeds/{lang}/{figure}-seeds.json');
};
