/**
 * Seed cache loading utilities
 * Handles loading complete seed data from various cache sources
 */

/**
 * Attempt to load complete seed data from figure seeds JSON file
 * @param {string} figureName - The figure name (e.g., 'plato')
 * @param {number} seedId - The numeric seed ID
 * @param {string} language - The language code (e.g., 'en', 'de')
 * @returns {Object|null} - Complete seed data or null if not found
 */
export const loadCompleteSeedData = (figureName: string, seedId: number, language = 'en'): any => {
  try {
    // Try language-specific seed cache first if available
    if (typeof window !== 'undefined' && window.seedsCache) {
      // Check language-specific cache
      const langCacheKey = `${figureName}_${language}`;
      if (window.seedsCache[langCacheKey]) {
        const figureData = window.seedsCache[langCacheKey];
        
        if (figureData && Array.isArray(figureData.seeds)) {
          const fullSeedData = figureData.seeds.find(s => s.id === seedId);
          
          if (fullSeedData) {
            return fullSeedData;
          }
        }
      }
      
      // If language-specific not found and not English, try English fallback
      if (language !== 'en' && window.seedsCache[figureName]) {
        const figureData = window.seedsCache[figureName];
        
        if (figureData && Array.isArray(figureData.seeds)) {
          const fullSeedData = figureData.seeds.find(s => s.id === seedId);
          
          if (fullSeedData) {
            return fullSeedData;
          }
        }
      }
      
      // Finally check the default cache (for backward compatibility)
      if (window.seedsCache[figureName]) {
        const figureData = window.seedsCache[figureName];
        
        if (figureData && Array.isArray(figureData.seeds)) {
          const fullSeedData = figureData.seeds.find(s => s.id === seedId);
          
          if (fullSeedData) {
            return fullSeedData;
          }
        }
      }
    }
    
    // Skip Node.js file system operations in browser environment
    // This feature is only available in server-side environments
    // For browser usage, the seedsCache is the only source of data
    if (import.meta.env.MODE === 'test' && typeof (global as any).jest !== 'undefined') {
      // This block only executes in Jest test environment
      // Jest tests should mock the required data
    }
    
    return null;
  } catch (error) {
    return null;
  }
};

/**
 * Load seeds for a specific figure from cache
 * @param {string} figureName - The figure name
 * @param {string} language - The language code
 * @returns {Array} - Array of seeds or empty array
 */
export const loadFigureSeeds = (figureName: string, language = 'en') => {
  if (typeof window === 'undefined' || !window.seedsCache) {
    return [];
  }
  
  // Try language-specific cache first
  const langCacheKey = `${figureName}_${language}`;
  if (window.seedsCache[langCacheKey]) {
    const figureData = window.seedsCache[langCacheKey];
    if (figureData && Array.isArray(figureData.seeds)) {
      return figureData.seeds;
    }
  }
  
  // Fallback to default cache
  if (window.seedsCache[figureName]) {
    const figureData = window.seedsCache[figureName];
    if (figureData && Array.isArray(figureData.seeds)) {
      return figureData.seeds;
    }
  }
  
  return [];
};

/**
 * Check if seeds cache is available
 * @returns {boolean} - True if cache is available
 */
export const isCacheAvailable = () => {
  return typeof window !== 'undefined' && window.seedsCache !== undefined;
};