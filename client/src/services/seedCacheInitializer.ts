/**
 * Seeds Cache Initializer
 * Loads seed data files at application start to provide rich data for the seed processor
 */

import { loadSeedsDirectly } from './directSeedLoader';
import { Seed } from '../types/global';

// List of all supported figures
const SUPPORTED_FIGURES = [
  'plato', 'rumi', 'vinci', 'jung', 'laozi', 'goethe', 'einstein',
  'king', 'gandhi', 'nietzsche', 'aurelius', 'schopenhauer', 'zenji',
  'eckhart', 'bingen', 'campbell', 'gautama', 'dickinson', 'shakespeare',
  'blake', 'mozart', 'austen', 'kahlo', 'lovelace', 'woolf', 'tubman',
  'angelou', 'mandela', 'galilei', 'beauvoir'
] as const;

type SupportedFigure = typeof SUPPORTED_FIGURES[number];

interface SeedData {
  figure?: string;
  seeds?: Seed[];
  [key: string]: any;
}

interface SeedsCache {
  [key: string]: SeedData;
}

declare global {
  interface Window {
    seedsCache?: SeedsCache;
    seedsCacheInitialized?: boolean;
    seedsCacheLanguage?: string;
  }
}

/**
 * Initialize the global seeds cache with language support
 * @param {string} language - The language code to initialize (e.g., 'en', 'de')
 * @returns {Promise<Object>} - The populated cache
 */
export const initializeSeedsCache = async (language: string = 'en'): Promise<SeedsCache> => {
  // Create or reset the global cache
  if (typeof window !== 'undefined') {
    // Initialize if not exists
    window.seedsCache = window.seedsCache || {};
    
    // Just mark the cache as initialized without loading all figures
    // Seeds will be loaded on-demand when needed
    window.seedsCacheInitialized = true;
    window.seedsCacheLanguage = language;
    
    // Clear any cached seeds from previous language to avoid stale data
    const keysToRemove = Object.keys(window.seedsCache).filter(key => {
      // Remove keys that end with a different language code
      const parts = key.split('_');
      if (parts.length > 1) {
        const keyLang = parts[parts.length - 1];
        return keyLang !== language && (keyLang === 'en' || keyLang === 'de');
      }
      return false;
    });
    
    keysToRemove.forEach(key => delete window.seedsCache![key]);

    return window.seedsCache;
  }
  
  return {};
};

/**
 * Load a specific figure's seeds on demand
 * @param {string} figure - The figure ID
 * @param {string} language - The language code
 * @returns {Promise<Object>} - The figure's seed data
 */
const loadFigureSeeds = async (figure: string, language: string = 'en'): Promise<SeedData | null> => {
  const cacheKey = `${figure}_${language}`;
  
  // Return from cache if already loaded
  if (window.seedsCache && window.seedsCache[cacheKey]) {
    return window.seedsCache[cacheKey];
  }
  
  try {
    // Use directSeedLoader which handles webpack's dynamic import limitations
    const seedData = await loadSeedsDirectly(figure, language);
    
    if (seedData) {
      // Store in language-specific cache key
      if (window.seedsCache) {
        window.seedsCache[cacheKey] = seedData;
        
        // Ensure figure property is properly capitalized if not already set
        if (!seedData.figure) {
          const figureDisplayName = figure.charAt(0).toUpperCase() + figure.slice(1).toLowerCase();
          window.seedsCache[cacheKey].figure = figureDisplayName;
        }
      }
      
      return window.seedsCache ? window.seedsCache[cacheKey] : seedData;
    }
    
    console.error(`[seedCacheInitializer] Failed to load seed data for ${figure} in ${language}`);
    return null;
  } catch (error: any) {
    console.error(`[seedCacheInitializer] Failed to load seeds for ${figure} in ${language}:`, error);
    console.error(`Error details:`, {
      message: error.message,
      stack: error.stack,
      figure,
      language,
      cacheKey
    });
    return null;
  }
};

/**
 * Check if seeds cache is initialized
 * @param {string} language - The language to check (optional, if not provided, checks if any language is initialized)
 * @returns {boolean} - True if cache is initialized for the given language
 */
export const isSeedsCacheInitialized = (language?: string): boolean => {
  // Check for our explicit initialization flag first
  if (typeof window !== 'undefined' && window.seedsCacheInitialized === true) {
    // If language is specified, check if it matches the cached language
    if (language && window.seedsCacheLanguage) {
      return window.seedsCacheLanguage === language;
    }
    return true;
  }
  
  // Fallback to checking if cache object exists and has data
  if (typeof window !== 'undefined' && window.seedsCache && Object.keys(window.seedsCache).length > 0) {
    // If language is specified, check for language-specific entries
    if (language) {
      return Object.keys(window.seedsCache).some(key => key.endsWith(`_${language}`));
    }
    return true;
  }
  
  return false;
};

/**
 * Get a specific figure's seed data from cache (loads on-demand if needed)
 * @param {string} figureId - The figure ID (e.g., 'plato')
 * @param {string} language - The language code (e.g., 'en', 'de')
 * @returns {Object|null} - The figure's seed data or null if not found
 */
export const getFigureSeedData = (figureId: string | null | undefined, language: string = 'en'): SeedData | null => {
  if (!figureId) return null;
  
  // Make this function async-capable by returning the cached value synchronously if available
  // or null if not (the caller should handle async loading)
  const langCacheKey = `${figureId.toLowerCase()}_${language}`;
  
  // First check if already cached
  if (window.seedsCache && window.seedsCache[langCacheKey]) {
    return window.seedsCache[langCacheKey];
  }
  
  // If not found and not English, try English fallback
  if (language !== 'en' && window.seedsCache) {
    const englishCacheKey = `${figureId.toLowerCase()}_en`;
    if (window.seedsCache[englishCacheKey]) {
      return window.seedsCache[englishCacheKey];
    }
  }
  
  // Fallback to default cache key (for backward compatibility)
  if (window.seedsCache && window.seedsCache[figureId.toLowerCase()]) {
    return window.seedsCache[figureId.toLowerCase()];
  }
  
  // Return null if not cached - caller should use getFigureSeedDataAsync
  return null;
};

/**
 * Get a specific figure's seed data from cache (async version that loads on-demand)
 * @param {string} figureId - The figure ID (e.g., 'plato')
 * @param {string} language - The language code (e.g., 'en', 'de')
 * @returns {Promise<Object|null>} - The figure's seed data or null if not found
 */
export const getFigureSeedDataAsync = async (figureId: string | null | undefined, language: string = 'en'): Promise<SeedData | null> => {
  if (!figureId) return null;
  
  // Initialize cache if needed
  if (!isSeedsCacheInitialized(language)) {
    await initializeSeedsCache(language);
  }
  
  const normalizedFigureId = figureId.toLowerCase();
  
  // Check if it's a supported figure
  if (!SUPPORTED_FIGURES.includes(normalizedFigureId as SupportedFigure)) {
    console.warn(`Figure "${normalizedFigureId}" is not in the supported figures list`);
    return null;
  }
  
  // Try to load the figure's seeds
  return await loadFigureSeeds(normalizedFigureId, language);
};

/**
 * Get a specific seed by figure and seed ID
 * @param {string} figureId - The figure ID (e.g., 'plato')
 * @param {number|string} seedId - The seed ID (numeric or string)
 * @param {string} language - The language code (e.g., 'en', 'de')
 * @returns {Object|null} - The specific seed data or null if not found
 */
export const getSeedById = (figureId: string, seedId: number | string, language: string = 'en'): Seed | null => {
  const figureData = getFigureSeedData(figureId, language);
  if (!figureData || !figureData.seeds) return null;
  
  // Handle numeric or string ID
  const numericId = typeof seedId === 'string' ? parseInt(seedId, 10) : seedId;
  
  return figureData.seeds.find(seed => seed.id === numericId || seed.id === seedId) || null;
};

export default {
  initializeSeedsCache,
  isSeedsCacheInitialized,
  getFigureSeedData,
  getFigureSeedDataAsync,
  getSeedById,
  SUPPORTED_FIGURES
};