// src/api/figures.ts
import { getFigureTranslation } from '../utils/figureTranslations';

/**
 * The three carousel groupings. This is the single source of truth for a
 * figure's category: FigureCarousel reads it from here instead of re-deriving
 * it from a parallel name map, and TypeScript forces every figure (including
 * any future addition) to declare one, so a new figure can no longer fall
 * through into the wrong tab.
 */
export type FigureCategory = 'sages' | 'reformers' | 'creators';

/**
 * Base figure data structure
 */
export interface FigureBase {
  id: string;
  baseNameEn: string;
  category: FigureCategory;
}

/**
 * Translated figure data structure
 */
export interface TranslatedFigure {
  name: string;
  about: string;
  learn?: string; // Golden line: "You will learn to ..."
  id: string;
  category: FigureCategory;
}

/**
 * Figure translation result from utils
 */
interface FigureTranslation {
  name?: string;
  about?: string;
  learn?: string;
}

/**
 * Base data for historical figures
 * Translation is handled separately through the figureTranslations utility
 * Images are handled by OptimizedImage component using the id field
 */
export const historicalFiguresBase: readonly FigureBase[] = [
    { id: "laozi", baseNameEn: "Echo of Laozi", category: "sages" },
    { id: "angelou", baseNameEn: "Echo of Maya Angelou", category: "reformers" },
    { id: "austen", baseNameEn: "Echo of Jane Austen", category: "creators" },
    { id: "aurelius", baseNameEn: "Echo of Marcus Aurelius", category: "sages" },
    { id: "beauvoir", baseNameEn: "Echo of Simone de Beauvoir", category: "reformers" },
    { id: "bingen", baseNameEn: "Echo of Hildegard von Bingen", category: "sages" },
    { id: "campbell", baseNameEn: "Echo of Joseph Campbell", category: "sages" },
    { id: "zenji", baseNameEn: "Echo of Dōgen Zenji", category: "sages" },
    { id: "dickinson", baseNameEn: "Echo of Emily Dickinson", category: "creators" },
    { id: "einstein", baseNameEn: "Echo of Albert Einstein", category: "creators" },
    { id: "eckhart", baseNameEn: "Echo of Meister Eckhart", category: "sages" },
    { id: "galilei", baseNameEn: "Echo of Galileo Galilei", category: "creators" },
    { id: "gandhi", baseNameEn: "Echo of Mohandas Gandhi", category: "reformers" },
    { id: "goethe", baseNameEn: "Echo of Johann Wolfgang von Goethe", category: "creators" },
    { id: "gautama", baseNameEn: "Echo of Siddhartha Gautama", category: "sages" },
    { id: "jung", baseNameEn: "Echo of Carl Gustav Jung", category: "sages" },
    { id: "kahlo", baseNameEn: "Echo of Frida Kahlo", category: "reformers" },
    { id: "king", baseNameEn: "Echo of Martin Luther King Jr.", category: "reformers" },
    { id: "lovelace", baseNameEn: "Echo of Ada Lovelace", category: "reformers" },
    { id: "mandela", baseNameEn: "Echo of Nelson Mandela", category: "reformers" },
    { id: "mozart", baseNameEn: "Echo of Wolfgang Amadeus Mozart", category: "creators" },
    { id: "blake", baseNameEn: "Echo of William Blake", category: "creators" },
    { id: "nietzsche", baseNameEn: "Echo of Friedrich Nietzsche", category: "reformers" },
    { id: "plato", baseNameEn: "Echo of Plato", category: "sages" },
    { id: "rumi", baseNameEn: "Echo of Rumi", category: "sages" },
    { id: "schopenhauer", baseNameEn: "Echo of Arthur Schopenhauer", category: "reformers" },
    { id: "shakespeare", baseNameEn: "Echo of William Shakespeare", category: "creators" },
    { id: "woolf", baseNameEn: "Echo of Virginia Woolf", category: "creators" },
    { id: "tubman", baseNameEn: "Echo of Harriet Tubman", category: "reformers" },
    { id: "vinci", baseNameEn: "Echo of Leonardo da Vinci", category: "creators" },
] as const;

/**
 * Type for valid figure IDs
 */
export type FigureId = typeof historicalFiguresBase[number]['id'];

/**
 * Function to get the complete figure data with translations based on current language
 * 
 * @param language - The current language code
 * @returns Array of figure objects with translated name and description
 */
export function getHistoricalFigures(language: string = 'en'): TranslatedFigure[] {
    return historicalFiguresBase.map((figure: FigureBase): TranslatedFigure => {
        // Try to get the translation, falling back to English if needed
        const translation: FigureTranslation = getFigureTranslation(figure.baseNameEn, language);
        
        return {
            name: translation.name || figure.baseNameEn,
            about: translation.about || `Information about ${figure.baseNameEn} is not available.`,
            learn: translation.learn,
            id: figure.id,
            category: figure.category
        };
    });
}

/**
 * Default export for backward compatibility
 * This uses the current language from localStorage if available
 */
const currentLanguage: string = localStorage.getItem('selectedLanguage') || 'en';
export const historicalFigures: TranslatedFigure[] = getHistoricalFigures(currentLanguage);