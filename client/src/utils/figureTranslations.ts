// src/utils/figureTranslations.ts

import { mediaBaseUrl } from '../config/runtime';

/**
 * Utility functions for loading figure translations
 */

interface FigureTranslation {
  name: string;
  about: string;
  [key: string]: any;
}

type TranslationCache = {
  [language: string]: Map<string, FigureTranslation>;
};

// In-memory cache to avoid repeated imports
const translationCache: TranslationCache = {
  en: new Map(),
  de: new Map()
};

/**
 * Extracts a figure ID from a figure name
 * 
 * @param {string} figureName - The full name of the figure (e.g., "Echo of Maya Angelou")
 * @returns {string} The figure ID for translation purposes (e.g., "angelou")
 */
export function getFigureId(figureName: string): string {
  // Handle multi-part and special case names first
  if (figureName.includes('von Bingen')) return 'bingen';
  if (figureName.includes('von Goethe')) return 'goethe';
  if (figureName.includes('da Vinci')) return 'vinci';
  if (figureName.includes('Luther King Jr.')) return 'king';
  if (figureName.includes('Zenji') || figureName.includes('Dōgen')) return 'zenji'; // Check both "Zenji" and "Dōgen"
  if (figureName.includes('Gautama')) return 'gautama';
  
  // Handle German translations
  if (figureName === 'Platon') return 'plato';
  if (figureName === 'Leonardo da Vinci') return 'vinci';
  
  // For standard names, extract the last part
  const nameParts = figureName.split(' ');
  const lastName = nameParts[nameParts.length - 1].toLowerCase();
  
  // Handle any remaining special cases
  const specialCases: { [key: string]: string } = {
    'zenji': 'zenji',
    'jr.': 'king',
    'platon': 'plato'
  };
  
  return specialCases[lastName] || lastName;
}

/**
 * Loads translations for a specific figure by name
 * 
 * @param {string} figureName - The full name of the figure (e.g., "Echo of Maya Angelou")
 * @param {string} language - The language code (e.g., "en", "de")
 * @returns {Promise<FigureTranslation>} The translated figure data
 */
export async function loadFigureTranslation(figureName: string, language: string = 'en'): Promise<FigureTranslation> {
  // Supported languages, fallback to English if not supported
  const supportedLanguages = ['en', 'de'];
  if (!supportedLanguages.includes(language)) {
    language = 'en';
  }

  const figureId = getFigureId(figureName);
  
  // Check if we have a cached version
  if (translationCache[language]?.has(figureId)) {
    return translationCache[language].get(figureId)!;
  }
  
  try {
    // Fetch from R2 (was dynamic import from bundled assets)
    const response = await fetch(`${mediaBaseUrl}/figure-translations/${language}/${figureId}.json`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const translation: FigureTranslation = await response.json();
    
    // Cache the translation
    if (!translationCache[language]) {
      translationCache[language] = new Map();
    }
    translationCache[language].set(figureId, translation);
    
    return translation;
  } catch (error) {
    console.warn(`Failed to load translation for figure ${figureId} in ${language}:`, error);
    
    // If we fail to load the specified language, try falling back to English
    if (language !== 'en') {
      return loadFigureTranslation(figureName, 'en');
    }
    
    // If even English fails, return a basic object with the figure name only
    return {
      name: figureName,
      about: `Translation not available for ${figureName}`
    };
  }
}

/**
 * Gets the translation for a figure - synchronous version that returns cached data if available
 * or triggers loading of translation in the background
 * 
 * @param {string} figureName - The full name of the figure
 * @param {string} language - The language code
 * @returns {FigureTranslation} The translated figure data or a placeholder
 */
export function getFigureTranslation(figureName: string, language: string = 'en'): FigureTranslation {
  const figureId = getFigureId(figureName);
  
  // If we have a cached version, return it immediately
  if (language in translationCache && translationCache[language].has(figureId)) {
    return translationCache[language].get(figureId)!;
  }
  
  // Otherwise, trigger loading in the background and return a placeholder
  loadFigureTranslation(figureName, language)
    .then(translation => {
      if (!translationCache[language]) {
        translationCache[language] = new Map();
      }
      translationCache[language].set(figureId, translation);
    })
    .catch(error => {
      console.error(`Error loading translation for ${figureId}:`, error);
    });
  
  // Return a placeholder while loading
  return {
    name: figureName,
    about: `Loading information about ${figureName}...`
  };
}