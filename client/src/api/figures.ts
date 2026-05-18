// src/api/figures.ts
import { getFigureTranslation } from '../utils/figureTranslations';

/**
 * Base figure data structure
 */
export interface FigureBase {
  id: string;
  baseNameEn: string;
}

/**
 * Translated figure data structure
 */
export interface TranslatedFigure {
  name: string;
  about: string;
  learn?: string; // Golden line: "You will learn to ..."
  id: string;
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
    { id: "laozi", baseNameEn: "Echo of Laozi" },
    { id: "angelou", baseNameEn: "Echo of Maya Angelou" },
    { id: "austen", baseNameEn: "Echo of Jane Austen" },
    { id: "aurelius", baseNameEn: "Echo of Marcus Aurelius" },
    { id: "beauvoir", baseNameEn: "Echo of Simone de Beauvoir" },
    { id: "bingen", baseNameEn: "Echo of Hildegard von Bingen" },
    { id: "campbell", baseNameEn: "Echo of Joseph Campbell" },
    { id: "zenji", baseNameEn: "Echo of Dōgen Zenji" },
    { id: "dickinson", baseNameEn: "Echo of Emily Dickinson" },
    { id: "einstein", baseNameEn: "Echo of Albert Einstein" },
    { id: "eckhart", baseNameEn: "Echo of Meister Eckhart" },
    { id: "galilei", baseNameEn: "Echo of Galileo Galilei" },
    { id: "gandhi", baseNameEn: "Echo of Mahatma Gandhi" },
    { id: "goethe", baseNameEn: "Echo of Johann Wolfgang von Goethe" },
    { id: "gautama", baseNameEn: "Echo of Siddhartha Gautama" },
    { id: "jung", baseNameEn: "Echo of Carl Gustav Jung" },
    { id: "kahlo", baseNameEn: "Echo of Frida Kahlo" },
    { id: "king", baseNameEn: "Echo of Martin Luther King Jr." },
    { id: "lovelace", baseNameEn: "Echo of Ada Lovelace" },
    { id: "mandela", baseNameEn: "Echo of Nelson Mandela" },
    { id: "mozart", baseNameEn: "Echo of Wolfgang Amadeus Mozart" },
    { id: "blake", baseNameEn: "Echo of William Blake" },
    { id: "nietzsche", baseNameEn: "Echo of Friedrich Nietzsche" },
    { id: "plato", baseNameEn: "Echo of Plato" },
    { id: "rumi", baseNameEn: "Echo of Rumi" },
    { id: "schopenhauer", baseNameEn: "Echo of Arthur Schopenhauer" },
    { id: "shakespeare", baseNameEn: "Echo of William Shakespeare" },
    { id: "woolf", baseNameEn: "Echo of Virginia Woolf" },
    { id: "tubman", baseNameEn: "Echo of Harriet Tubman" },
    { id: "vinci", baseNameEn: "Echo of Leonardo da Vinci" },
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
            id: figure.id
        };
    });
}

/**
 * Default export for backward compatibility
 * This uses the current language from localStorage if available
 */
const currentLanguage: string = localStorage.getItem('selectedLanguage') || 'en';
export const historicalFigures: TranslatedFigure[] = getHistoricalFigures(currentLanguage);