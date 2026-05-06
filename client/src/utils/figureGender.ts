// src/utils/figureGender.ts

/**
 * Gender type for historical figures
 */
export type Gender = 'male' | 'female' | 'unknown';

/**
 * Gender mapping type
 */
type GenderMap = {
  [figureId: string]: Exclude<Gender, 'unknown'>;
};

/**
 * Gender mapping for historical figures
 * Used for voice assignment and enforcing gender balance in custom councils
 */
export const figureGenderMap: GenderMap = {
  // Female figures
  'angelou': 'female',        // Maya Angelou
  'austen': 'female',          // Jane Austen
  'beauvoir': 'female',        // Simone de Beauvoir
  'bingen': 'female',          // Hildegard von Bingen
  'dickinson': 'female',       // Emily Dickinson
  'kahlo': 'female',           // Frida Kahlo
  'lovelace': 'female',        // Ada Lovelace
  'tubman': 'female',          // Harriet Tubman
  'woolf': 'female',           // Virginia Woolf

  // Female figures (council-active)
  'butler': 'female',           // Judith Butler
  'teresa': 'female',           // Mother Teresa
  'weil': 'female',             // Simone Weil

  // Male figures
  'aurelius': 'male',          // Marcus Aurelius
  'averroes': 'male',          // Averroes (Ibn Rushd)
  'blake': 'male',             // William Blake
  'camus': 'male',             // Albert Camus
  'campbell': 'male',          // Joseph Campbell
  'confucius': 'male',         // Confucius
  'dalai': 'male',             // Dalai Lama
  'descartes': 'male',         // René Descartes
  'douglas': 'male',           // Frederick Douglass
  'vinci': 'male',             // Leonardo da Vinci
  'zenji': 'male',             // Dōgen Zenji
  'eckhart': 'male',           // Meister Eckhart
  'einstein': 'male',          // Albert Einstein
  'frankl': 'male',            // Viktor Frankl
  'galilei': 'male',           // Galileo Galilei
  'gandhi': 'male',            // Mahatma Gandhi
  'gautama': 'male',           // Siddhartha Gautama
  'gibran': 'male',            // Kahlil Gibran
  'goethe': 'male',            // Johann Wolfgang von Goethe
  'jung': 'male',              // Carl Gustav Jung
  'kabir': 'male',             // Kabir
  'king': 'male',              // Martin Luther King Jr.
  'laozi': 'male',             // Laozi
  'luther': 'male',            // Martin Luther
  'mandela': 'male',           // Nelson Mandela
  'merton': 'male',            // Thomas Merton
  'mozart': 'male',            // Wolfgang Amadeus Mozart
  'nietzsche': 'male',         // Friedrich Nietzsche
  'plato': 'male',             // Plato
  'rumi': 'male',              // Rumi
  'sartre': 'male',            // Jean-Paul Sartre
  'schopenhauer': 'male',      // Arthur Schopenhauer
  'shakespeare': 'male',       // William Shakespeare
  'socrates': 'male',          // Socrates
  'thoreau': 'male',           // Henry David Thoreau
  'tolle': 'male',             // Eckhart Tolle
};

/**
 * Gender count structure
 */
export interface GenderCounts {
  male: number;
  female: number;
  unknown: number;
}

/**
 * Figure object with ID
 */
export interface FigureWithId {
  id: string;
  name?: string;
}

/**
 * Gender limit check result
 */
export interface GenderLimitResult {
  canAdd: boolean;
  reason: string | null;
}

/**
 * Get the gender of a figure by ID
 * @param figureId - The figure ID
 * @returns 'male', 'female', or 'unknown'
 */
export function getFigureGender(figureId: string): Gender {
  return figureGenderMap[figureId] || 'unknown';
}

/**
 * Count the number of each gender in a list of figures
 * @param figures - Array of figure objects with 'id' property
 * @returns Object with male, female, and unknown counts
 */
export function countGenderBalance(figures: FigureWithId[]): GenderCounts {
  const counts: GenderCounts = { male: 0, female: 0, unknown: 0 };
  
  figures.forEach(figure => {
    const gender = getFigureGender(figure.id);
    counts[gender]++;
  });
  
  return counts;
}

/**
 * Check if adding a figure would exceed gender limits
 * @param currentFigures - Current selected figures
 * @param newFigure - Figure to add
 * @param maxPerGender - Maximum allowed per gender (default: 3)
 * @returns Object with canAdd boolean and optional reason string
 */
export function checkGenderLimit(
  currentFigures: FigureWithId[], 
  newFigure: FigureWithId, 
  maxPerGender: number = 3
): GenderLimitResult {
  const newFigureGender = getFigureGender(newFigure.id);
  
  if (newFigureGender === 'unknown') {
    return { canAdd: true, reason: null };
  }
  
  const currentCounts = countGenderBalance(currentFigures);
  
  if (currentCounts[newFigureGender] >= maxPerGender) {
    return {
      canAdd: false,
      reason: `Maximum of ${maxPerGender} ${newFigureGender} figures allowed due to voice constraints`
    };
  }
  
  return { canAdd: true, reason: null };
}