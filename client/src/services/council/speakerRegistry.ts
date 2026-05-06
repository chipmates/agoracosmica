// src/services/council/speakerRegistry.ts
// Unified speaker registry - single source of truth for all speaker mappings
// Consolidates ID->Name and Name->ID mappings from generator.js and parser.js

interface SpeakerData {
  id: string;
  fullName: string;
  variations: string[];
}

type SpeakerRegistry = Record<string, SpeakerData>;

/**
 * Normalize speaker name by removing diacritical marks
 * Handles Unicode normalization for consistent matching
 */
function normalizeSpeakerName(speakerName: string): string {
  if (!speakerName) return '';
  return speakerName
    .normalize('NFD') // Decompose accented characters
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritical marks
    .toUpperCase()
    .trim();
}

/**
 * Comprehensive speaker database
 * Each entry contains ID, full name, and all known variations
 */
export const SPEAKERS: SpeakerRegistry = {
  angelou: {
    id: 'angelou',
    fullName: 'Maya Angelou',
    variations: ['ANGELOU', 'MAYA ANGELOU', 'MAYA']
  },
  aurelius: {
    id: 'aurelius', 
    fullName: 'Marcus Aurelius',
    variations: ['AURELIUS', 'MARCUS AURELIUS', 'MARCUS']
  },
  austen: {
    id: 'austen',
    fullName: 'Jane Austen',
    variations: ['AUSTEN', 'JANE AUSTEN']
  },
  beauvoir: {
    id: 'beauvoir',
    fullName: 'Simone de Beauvoir',
    variations: ['BEAUVOIR', 'DE BEAUVOIR', 'SIMONE DE BEAUVOIR', 'SIMONE']
  },
  bingen: {
    id: 'bingen',
    fullName: 'Hildegard of Bingen',
    variations: ['BINGEN', 'HILDEGARD', 'HILDEGARD OF BINGEN', 'HILDEGARD VON BINGEN']
  },
  blake: {
    id: 'blake',
    fullName: 'William Blake',
    variations: ['BLAKE', 'WILLIAM BLAKE']
  },
  campbell: {
    id: 'campbell',
    fullName: 'Joseph Campbell', 
    variations: ['CAMPBELL', 'JOSEPH CAMPBELL']
  },
  confucius: {
    id: 'confucius',
    fullName: 'Confucius',
    variations: ['CONFUCIUS']
  },
  dickinson: {
    id: 'dickinson',
    fullName: 'Emily Dickinson',
    variations: ['DICKINSON', 'EMILY DICKINSON']
  },
  eckhart: {
    id: 'eckhart',
    fullName: 'Meister Eckhart',
    variations: ['ECKHART', 'MEISTER ECKHART']
  },
  einstein: {
    id: 'einstein',
    fullName: 'Albert Einstein',
    variations: ['EINSTEIN', 'ALBERT EINSTEIN']
  },
  galilei: {
    id: 'galilei',
    fullName: 'Galileo Galilei',
    variations: ['GALILEI', 'GALILEO', 'GALILEO GALILEI']
  },
  gandhi: {
    id: 'gandhi',
    fullName: 'Mahatma Gandhi',
    variations: ['GANDHI', 'MAHATMA GANDHI', 'MAHATMA', 'MOHANDAS GANDHI', 'MOHANDAS KARAMCHAND GANDHI', 'MAHATMA KARAMCHAND GANDHI']
  },
  gautama: {
    id: 'gautama',
    fullName: 'Buddha',
    variations: ['BUDDHA', 'GAUTAMA', 'SIDDHARTHA GAUTAMA', 'SIDDHARTA GAUTAMA', 'SIDDHARTHA']
  },
  goethe: {
    id: 'goethe',
    fullName: 'Johann Wolfgang von Goethe',
    variations: ['GOETHE', 'JOHANN WOLFGANG VON GOETHE', 'J.W. VON GOETHE', 'JW VON GOETHE', 'VON GOETHE']
  },
  jung: {
    id: 'jung',
    fullName: 'Carl Jung',
    variations: ['JUNG', 'CARL JUNG', 'C.G. JUNG', 'CARL', 'CARL GUSTAV JUNG']
  },
  kahlo: {
    id: 'kahlo',
    fullName: 'Frida Kahlo',
    variations: ['KAHLO', 'FRIDA KAHLO', 'FRIDA']
  },
  king: {
    id: 'king',
    fullName: 'Martin Luther King Jr.',
    variations: ['KING', 'MARTIN LUTHER KING', 'MARTIN LUTHER KING JR', 'MARTIN LUTHER KING JR.']
  },
  laozi: {
    id: 'laozi',
    fullName: 'Laozi',
    variations: ['LAOZI', 'LAO TZU']
  },
  lovelace: {
    id: 'lovelace',
    fullName: 'Ada Lovelace',
    variations: ['LOVELACE', 'ADA LOVELACE']
  },
  mandela: {
    id: 'mandela',
    fullName: 'Nelson Mandela',
    variations: ['MANDELA', 'NELSON MANDELA']
  },
  mozart: {
    id: 'mozart',
    fullName: 'Wolfgang Amadeus Mozart',
    variations: ['MOZART', 'WOLFGANG AMADEUS MOZART', 'W.A. MOZART', 'W A MOZART', 'WA MOZART']
  },
  nietzsche: {
    id: 'nietzsche',
    fullName: 'Friedrich Nietzsche',
    variations: ['NIETZSCHE', 'FRIEDRICH NIETZSCHE', 'FRIEDRICH']
  },
  plato: {
    id: 'plato',
    fullName: 'Plato',
    variations: ['PLATO']
  },
  rumi: {
    id: 'rumi',
    fullName: 'Rumi',
    variations: ['RUMI', 'JALAL AD-DIN MUHAMMAD RUMI', 'JALAL AD DIN MUHAMMAD RUMI', 'MEVLANA RUMI']
  },
  schopenhauer: {
    id: 'schopenhauer',
    fullName: 'Arthur Schopenhauer',
    variations: ['SCHOPENHAUER', 'ARTHUR SCHOPENHAUER']
  },
  shakespeare: {
    id: 'shakespeare',
    fullName: 'William Shakespeare',
    variations: ['SHAKESPEARE', 'WILLIAM SHAKESPEARE']
  },
  socrates: {
    id: 'socrates',
    fullName: 'Socrates',
    variations: ['SOCRATES']
  },
  tubman: {
    id: 'tubman',
    fullName: 'Harriet Tubman',
    variations: ['TUBMAN', 'HARRIET TUBMAN', 'HARRIET']
  },
  vinci: {
    id: 'vinci',
    fullName: 'Leonardo da Vinci',
    variations: ['VINCI', 'LEONARDO DA VINCI', 'DA VINCI', 'LEONARDO']
  },
  woolf: {
    id: 'woolf',
    fullName: 'Virginia Woolf',
    variations: ['WOOLF', 'VIRGINIA WOOLF']
  },
  zenji: {
    id: 'zenji',
    fullName: 'Dogen Zenji',
    variations: ['ZENJI', 'DOGEN', 'DOGEN ZENJI']
  }
};

/**
 * Convert speaker ID to full display name
 * Replaces generator.js getParticipantName() function
 * 
 * @param {string} id - Speaker ID (e.g., 'jung')
 * @returns {string} Full name (e.g., 'Carl Jung')
 */
export function getFullName(id: string): string {
  if (!id) return '';
  
  const speaker = SPEAKERS[id.toLowerCase()];
  if (speaker) {
    return speaker.fullName;
  }
  
  // Fallback: capitalize first letter
  return id.charAt(0).toUpperCase() + id.slice(1);
}

/**
 * Convert speaker name to speaker ID  
 * Replaces parser.js _getSpeakerId() function
 * Handles normalized speaker names with diacritical marks
 * 
 * @param {string} speakerName - Display name (e.g., 'CARL JUNG')
 * @returns {string} Speaker ID (e.g., 'jung')
 */
export function getSpeakerId(speakerName: string): string {
  if (!speakerName) return '';

  const normalized = normalizeSpeakerName(speakerName);

  // 1. Exact match against known variations
  for (const [id, data] of Object.entries(SPEAKERS)) {
    if (data.variations.includes(normalized)) {
      return id;
    }
  }

  // 2. Fuzzy: check if any known variation is a substring of the input or vice versa
  //    Catches typos like "MAHATAS KARAMCHAND GANDHI" (contains "GANDHI")
  //    and truncations like "MOHANDAS KARAMCH GANDHI"
  const words = normalized.split(/\s+/);
  for (const [id, data] of Object.entries(SPEAKERS)) {
    for (const variation of data.variations) {
      // Single-word variation matches any word in the input (surname matching)
      if (!variation.includes(' ') && words.includes(variation)) {
        return id;
      }
    }
  }

  // 3. Fallback: take last word and check if it's a valid speaker ID
  const lastName = normalized.toLowerCase().split(/\s+/).pop() || '';
  if (SPEAKERS[lastName]) {
    return lastName;
  }

  return lastName;
}

/**
 * Get all available speaker IDs
 * Useful for validation and debugging
 */
export function getAllSpeakerIds(): string[] {
  return Object.keys(SPEAKERS);
}

/**
 * Get all speaker variations for debugging
 * Useful for understanding what names are recognized
 */
export function getAllSpeakerVariations(): Record<string, string[]> {
  const variations: Record<string, string[]> = {};
  for (const [id, data] of Object.entries(SPEAKERS)) {
    variations[id] = data.variations;
  }
  return variations;
}

/**
 * Validate if a speaker ID exists in the registry
 */
export function isValidSpeakerId(id: string): boolean {
  return !!id && SPEAKERS.hasOwnProperty(id.toLowerCase());
}

/**
 * Validate if a speaker name can be resolved to an ID
 */
export function isValidSpeakerName(speakerName: string): boolean {
  const id = getSpeakerId(speakerName);
  return !!id && isValidSpeakerId(id);
}