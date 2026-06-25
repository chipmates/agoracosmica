// src/utils/nameUtils.ts

/**
 * Type definition for special case mappings
 */
type SpecialCaseMapping = {
  [key: string]: string;
};

/**
 * Normalizes a figure name by removing language prefixes and extracting the ID
 * Supports multiple language prefixes like "Echo of", "Echo von", "Echo de", etc.
 * 
 * @param figureName - The full figure name (e.g., "Echo of Galileo Galilei")
 * @returns The normalized figure ID (e.g., "galilei")
 */
export const normalizeFigureName = (figureName: string | null | undefined): string => {
    if (!figureName) return '';
    
    // Handle null or empty input - String() ensures we have a string
    const name: string = String(figureName).trim();
    if (!name) return '';
    
    // Special case for Martin Luther King Jr.
    if (name.includes('King Jr.') || name.includes('King Jr')) {
      return 'king';
    }
    
    // Remove language prefix (works with English "of", German "von", French/Spanish "de", etc.)
    // This regex matches "Echo" followed by any of these connector words
    const withoutPrefix: string = name.replace(/^Echo (of|von|de|del|di|des)\s+/i, '');
    
    // Special cases for common figures that might have inconsistent naming
    const specialCases: SpecialCaseMapping = {
      'Martin Luther King Jr.': 'king',
      'Martin Luther King Jr': 'king',
      'Meister Eckhart': 'eckhart',
      'Harriet Tubman': 'tubman',
      'Ada Lovelace': 'lovelace',
      'Arthur Schopenhauer': 'schopenhauer',
      'Simone de Beauvoir': 'beauvoir',
      'Hildegard von Bingen': 'bingen',
      'Johann Wolfgang von Goethe': 'goethe',
      'Leonardo da Vinci': 'vinci',
      'Leonardo Da Vinci': 'vinci',
      'Dōgen Zenji': 'zenji',
      'Dogen Zenji': 'zenji',
      'Mark Aurel': 'aurelius'
    };
    
    if (specialCases[withoutPrefix]) {
      return specialCases[withoutPrefix];
    }
    
    // Extract last name component and convert to lowercase
    // The pop() could return undefined, so we handle that case
    const lastName = withoutPrefix.split(' ').pop();
    return lastName ? lastName.toLowerCase() : '';
  };