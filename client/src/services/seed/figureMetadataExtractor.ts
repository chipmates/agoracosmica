/**
 * Figure metadata extraction utilities
 * Handles extracting metadata from seeds data
 */

/**
 * Extract figure metadata from seeds data
 * @param {Object} seedsData - The complete seeds data for a figure
 * @returns {Object} - Filtered figure metadata
 */
export const extractFigureMeta = (seedsData: any) => {
  if (!seedsData) return {};

  try {
    return {
      figure: seedsData.figure || '',
      topic: seedsData.topic || '',
      tradition: seedsData.metadata?.tradition || '',
      historicalPeriod: seedsData.metadata?.historicalPeriod || '',
      primaryWorks: seedsData.metadata?.primaryWorks || []
    };
  } catch (error) {
    return {};
  }
};

/**
 * Enrich figure metadata from cache
 * @param {Object} seedData - The seed data containing figure information
 * @param {Array} allSeeds - All seeds for the figure
 * @returns {Object} - Enhanced figure metadata
 */
export const enrichFigureMetadata = (seedData: any, allSeeds: any[] = []) => {
  let figureMetadata = null;
  
  // First try to get from seed's figure property
  if (seedData && seedData.figure) {
    const figureName = seedData.figure.toLowerCase();
    
    // Check for figure data in global cache
    if (typeof window !== 'undefined' && window.seedsCache && window.seedsCache[figureName]) {
      const figureData = window.seedsCache[figureName];
      figureMetadata = {
        figure: figureData.figure || seedData.figure,
        topic: figureData.topic || '',
        tradition: figureData.metadata?.tradition || '',
        historicalPeriod: figureData.metadata?.historicalPeriod || '',
        primaryWorks: figureData.metadata?.primaryWorks || []
      };
    } else {
      // Fallback to basic metadata from seed
      figureMetadata = {
        figure: seedData.figure,
        topic: '',
        tradition: '',
        historicalPeriod: '',
        primaryWorks: []
      };
    }
  } else if (allSeeds && allSeeds.length > 0) {
    const seedsData = { figure: '', topic: '', metadata: {}, seeds: allSeeds };
    figureMetadata = extractFigureMeta(seedsData);
  }
  
  return figureMetadata || {};
};