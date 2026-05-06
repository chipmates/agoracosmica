/**
 * Seed normalization and validation utilities
 * Handles normalizing various seed formats and validating data
 */

import { loadCompleteSeedData } from './seedCacheLoader';

/**
 * Normalizes seed data to ensure it has all required fields
 * Handles various input formats including {id, name} production format
 * @param {Object} seedData - The seed data to normalize
 * @param {string} language - Language code for loading
 * @returns {Object} - Normalized seed data with required fields
 */
export const normalizeSeedData = (seedData: any, language = 'en') => {
  if (!seedData) return null;
  
  // Already has required fields (check both v1 and v2 schema names)
  if (seedData.title && (seedData.description || seedData.summary)) {
    return seedData;
  }
  
  // Handle {id, name} format (production app format)
  if (seedData.id && seedData.name) {
    // Extract figure name and seed ID from compound ID format
    let figureName = null;
    let seedId = null;
    
    if (seedData.id.includes('-')) {
      const idParts = seedData.id.split('-');
      figureName = idParts[0];
      seedId = parseInt(idParts[1], 10);
      
      // Try to load complete seed data from JSON file with language support
      if (!isNaN(seedId)) {
        const completeSeedData = loadCompleteSeedData(figureName, seedId, language);
        
        if (completeSeedData) {
          // Return complete data with original ID format maintained
          return {
            ...completeSeedData,
            id: seedData.id, // Keep ID in "figure-number" format
            figure: figureName || completeSeedData.figure || ''
          };
        }
      }
    }
    
    // Extract title from "Figure - Title" format if not already done
    let title = seedData.name;
    if (!figureName && seedData.name.includes(' - ')) {
      const parts = seedData.name.split(' - ');
      figureName = parts[0];
      title = parts[1];
    }
    
    const normalizedData = {
      id: seedData.id,
      title: title,
      description: `A philosophical exploration of ${title}`,
      figure: figureName,
      difficulty: 2,
      practiceType: "Reflection",
      practice: `Reflect on the concept of ${title} and its implications in your life.`,
      quote: seedData.quote || "",
      whySelected: [
        `Provides insight on ${title}`,
        `Offers a perspective on philosophical understanding`
      ],
      importance: [
        `Helps clarify important philosophical concepts`,
        `Builds foundation for deeper understanding`
      ],
      wisdomConnections: [],
      traditionElements: []
    };

    return normalizedData;
  }
  
  // Minimal fallback for any format
  const fallbackData = {
    id: seedData.id || 'unknown',
    title: seedData.title || seedData.name || 'Unknown Concept',
    description: seedData.description || seedData.summary || 'A philosophical exploration',
    difficulty: seedData.difficulty || 1,
    practiceType: seedData.practiceType || "Reflection",
    practice: seedData.practice || seedData.practicalSuggestion || "Reflect on this concept and its implications.",
    quote: seedData.quote || "",
    whySelected: Array.isArray(seedData.whySelected) ? seedData.whySelected : [],
    importance: Array.isArray(seedData.importance) ? seedData.importance : [],
    wisdomConnections: Array.isArray(seedData.wisdomConnections) ? seedData.wisdomConnections : [],
    traditionElements: Array.isArray(seedData.traditionElements) ? seedData.traditionElements : []
  };

  return fallbackData;
};

/**
 * Flexible schema validator with data repair capabilities
 * @param {Object} data - The data to validate
 * @param {Array} requiredFields - Array of required field names
 * @param {String} context - Context information for error message
 * @param {Boolean} strictMode - Whether to strictly enforce requirements or attempt repair
 * @param {String} language - Language code for normalization
 * @returns {Object} - Validation result with validity and data
 */
export const validateDataFlexible = (data: any, requiredFields: string[], context: string, strictMode = false, language = 'en') => {
  if (!data) {
    if (strictMode) {
      throw new Error(`${context}: Data is null or undefined`);
    }
    return { valid: false, missing: ['all data'], data: null };
  }
  
  // Check for missing fields
  const missingFields = requiredFields.filter((field: string) => {
    // Handle nested fields with dot notation
    if (field.includes('.')) {
      const parts = field.split('.');
      let current = data;
      for (const part of parts) {
        if (!current || current[part] === undefined) {
          return true;
        }
        current = current[part];
      }
      return false;
    }
    return data[field] === undefined;
  });
  
  // In non-strict mode, repair data instead of failing
  if (missingFields.length > 0) {
    if (strictMode) {
      throw new Error(`${context}: Missing required fields: ${missingFields.join(', ')}`);
    }
    
    const normalizedData = normalizeSeedData(data, language);
    return { 
      valid: true, 
      data: normalizedData, 
      repaired: true, 
      missingFields 
    };
  }
  
  // No missing fields
  return { valid: true, data: data, repaired: false };
};

/**
 * Legacy validator for backward compatibility
 * @param {Object} data - The data to validate
 * @param {Array} requiredFields - Array of required field names
 * @param {String} context - Context information for error message
 * @returns {Boolean} - True if valid, throws error if invalid
 */
export const validateData = (data: any, requiredFields: string[], context: string) => {
  try {
    const result = validateDataFlexible(data, requiredFields, context, true);
    return result.valid;
  } catch (error) {
    throw error;
  }
};