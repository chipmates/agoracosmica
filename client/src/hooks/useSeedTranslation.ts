// src/hooks/useSeedTranslation.ts

import { useDomainStore } from '../stores/domainStore';
import { Language } from '../types/global';

// Seed object type for the third calling pattern
interface SeedObject {
  id: string | number;
  figure?: string;
  [key: string]: any;
}

interface SeedTranslationUtilities {
  language: Language;
  getTranslatedSeedTitle: {
    // Overloads for different calling patterns
    (figure: string, seedId: string | number): string | null;
    (fullSeedId: string): string | null;
    (seed: SeedObject): string | null;
  };
}

/**
 * Custom hook for accessing seed title translations
 * Uses Zustand domainStore to get seed translations
 *
 * @returns Seed translation utilities
 */
export function useSeedTranslation(): SeedTranslationUtilities {
  const language = useDomainStore((state) => state.language.current);
  const getSeedTitle = useDomainStore((state) => state.getSeedTitle);
  
  /**
   * Extract seed ID from full seed ID string
   * For example, "laozi-1" becomes "1"
   * 
   * @param fullSeedId - Full seed ID string or number
   * @returns Numeric part of the seed ID
   */
  const extractSeedId = (fullSeedId: string | number): string | number => {
    if (typeof fullSeedId === 'number') return fullSeedId;
    
    if (typeof fullSeedId === 'string' && fullSeedId.includes('-')) {
      return fullSeedId.split('-')[1];
    }
    
    return fullSeedId;
  };
  
  /**
   * Extract figure ID from full seed ID string
   * For example, "laozi-1" becomes "laozi"
   * 
   * @param fullSeedId - Full seed ID string
   * @returns Figure part of the seed ID or null
   */
  const extractFigureId = (fullSeedId: string): string | null => {
    if (typeof fullSeedId === 'string' && fullSeedId.includes('-')) {
      return fullSeedId.split('-')[0];
    }
    
    return null;
  };
  
  /**
   * Get a translated seed title
   * Can be called in three ways:
   * 1. getTranslatedSeedTitle(figure, seedId) - Pass figure name and seed ID
   * 2. getTranslatedSeedTitle(fullSeedId) - Pass combined ID like "laozi-1"
   * 3. getTranslatedSeedTitle(seed) - Pass seed object with figure and id properties
   *
   * @param figureOrSeedId - Figure name, full seed ID, or seed object
   * @param seedId - Seed ID (if figureOrSeedId is figure name)
   * @returns Translated seed title or null if not found
   */
  function getTranslatedSeedTitle(figure: string, seedId: string | number): string | null;
  function getTranslatedSeedTitle(fullSeedId: string): string | null;
  function getTranslatedSeedTitle(seed: SeedObject): string | null;
  function getTranslatedSeedTitle(
    figureOrSeedId: string | SeedObject,
    seedId?: string | number
  ): string | null {
    // Case 1: Called with figure and seedId separately
    if (typeof figureOrSeedId === 'string' && seedId !== undefined) {
      return getSeedTitle(figureOrSeedId, seedId) || null;
    }
    
    // Case 2: Called with a combined ID like "laozi-1"
    if (typeof figureOrSeedId === 'string' && figureOrSeedId.includes('-')) {
      const [figure, id] = figureOrSeedId.split('-');
      return getSeedTitle(figure, id) || null;
    }
    
    // Case 3: Called with a seed object
    if (typeof figureOrSeedId === 'object' && figureOrSeedId !== null) {
      const seed = figureOrSeedId;
      
      // If we have a figure property
      if (seed.figure) {
        return getSeedTitle(seed.figure, extractSeedId(seed.id)) || null;
      }
      
      // If the ID is in the format "figureId-seedId"
      if (typeof seed.id === 'string' && seed.id.includes('-')) {
        const figure = extractFigureId(seed.id);
        const id = extractSeedId(seed.id);
        if (figure) {
          return getSeedTitle(figure, id) || null;
        }
      }
    }
    
    return null;
  }
  
  return {
    language,
    getTranslatedSeedTitle
  };
}

export default useSeedTranslation;