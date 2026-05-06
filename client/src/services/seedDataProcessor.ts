// src/services/seedDataProcessor.ts

/**
 * Utility for processing seed data into structured formats optimized for different conversation modes.
 * This utility transforms raw seed data into specific JSON structures for each conversation mode,
 * while maintaining compatibility with existing instruction templates.
 * 
 * Version 2.0: Enhanced with robust handling of various seed data formats, including
 * production app format {id, name}, full enhanced format, and partial data.
 */

// Import extracted modules
import { normalizeSeedData, validateDataFlexible } from './seed/seedNormalizer';
import { extractFigureMeta, enrichFigureMetadata } from './seed/figureMetadataExtractor';
import { generateSeedDistinction } from './seed/seedDistinctionGenerator';
import { generateTeachingContext } from './seed/teachingContextGenerator';
import { generateSeedsOverview, generateConversationalGuidance } from './seed/conversationGuideGenerator';
import { Seed, Language } from '../types/global';

// Types for processed data structures
interface SeedOverview {
  id: string | number;
  title: string;
  description: string;
  keywords: string[];
  conversationTriggers: string[];
}

interface ConversationalGuidance {
  seedConnections: Record<string, Array<{ title: string; figure: string; relationship: string }>>;
  characteristicPhrases: string[];
}

interface FigureMetadata {
  figure: string;
  topic?: string;
  tradition?: string;
  historicalPeriod?: string;
  primaryWorks?: string[];
  [key: string]: any;
}

interface SeedDistinction {
  otherSeedTitles: string[];
  uniqueQualities: string[];
}

interface TeachingContext {
  [key: string]: any;
}

interface ProcessedChallengeData {
  mode: 'seed_challenge';
  targetSeed: Seed;
  figureMeta: FigureMetadata;
  seedDistinction: SeedDistinction;
}

interface ProcessedConversationData {
  mode: 'seed_conversation';
  targetSeed: Seed;
  figureMeta: FigureMetadata;
  teachingContext: TeachingContext;
}

interface ProcessedFreeConversationData {
  mode: 'free_conversation';
  figureMeta: FigureMetadata;
  seedsOverview: SeedOverview[];
  conversationalGuidance: ConversationalGuidance;
  seeds?: Seed[];
}

type SeedInput = Partial<Seed> & {
  name?: string;
  figure?: string;
};

/**
 * Process seed data for challenge mode
 * @param {SeedInput} seedData - Target seed data
 * @param {Seed[]} allSeeds - All seeds for the figure
 * @param {FigureMetadata | null} figureMeta - Optional figure metadata
 * @param {Language | string} language - Language code
 * @returns {ProcessedChallengeData | SeedInput} - Processed data structured for challenge mode
 */
export const processSeedChallengeData = (
  seedData: SeedInput, 
  allSeeds: Seed[] = [], 
  figureMeta: FigureMetadata | null = null, 
  language: Language | string = 'en'
): ProcessedChallengeData | SeedInput => {
  try {
    // Use flexible validation that handles various formats with language support
    const validation = validateDataFlexible(seedData, ['id', 'title', 'description'], 'Challenge Mode', false, language);
    
    if (!validation.valid || !validation.data) {
      return seedData;
    }
    
    // Use the validated/repaired data
    const validSeedData = validation.data;

    // Try to enrich figure metadata
    let figureMetadata = (figureMeta || enrichFigureMetadata(validSeedData, allSeeds)) as FigureMetadata;

    // Generate seed distinction information
    const seedDistinction = generateSeedDistinction(validSeedData, allSeeds);

    // Create the structured data for challenge mode
    const processedData: ProcessedChallengeData = {
      mode: "seed_challenge",
      targetSeed: validSeedData,
      figureMeta: figureMetadata,
      seedDistinction
    };

    return processedData;
  } catch (error) {
    // Return basic data for backward compatibility
    return seedData;
  }
};

/**
 * Process seed data for conversation mode
 * @param {SeedInput} seedData - Target seed data
 * @param {Seed[]} allSeeds - All seeds for the figure
 * @param {FigureMetadata | null} figureMeta - Optional figure metadata
 * @param {Language | string} language - Language code
 * @returns {ProcessedConversationData | SeedInput} - Processed data structured for conversation mode
 */
export const processSeedConversationData = (
  seedData: SeedInput, 
  allSeeds: Seed[] = [], 
  figureMeta: FigureMetadata | null = null, 
  language: Language | string = 'en'
): ProcessedConversationData | SeedInput => {
  try {
    // Use flexible validation that handles various formats with language support
    const validation = validateDataFlexible(seedData, ['id', 'title', 'description'], 'Conversation Mode', false, language);
    
    if (!validation.valid || !validation.data) {
      return seedData;
    }
    
    // Use the validated/repaired data
    const validSeedData = validation.data;

    // Extract or use provided figure metadata
    let figureMetadata = (figureMeta || enrichFigureMetadata(validSeedData, allSeeds)) as FigureMetadata;

    // Generate teaching context information
    const teachingContext = generateTeachingContext(validSeedData, allSeeds);

    // Create the structured data for conversation mode
    const processedData: ProcessedConversationData = {
      mode: "seed_conversation",
      targetSeed: validSeedData,
      figureMeta: figureMetadata,
      teachingContext
    };

    return processedData;
  } catch (error) {
    // Return basic data for backward compatibility
    return seedData;
  }
};

/**
 * Process seed data for free conversation mode
 * @param {Seed[]} allSeeds - All seeds for the figure
 * @param {FigureMetadata | null} figureMeta - Optional figure metadata
 * @param {Language | string} language - Language code
 * @returns {ProcessedFreeConversationData} - Processed data structured for free conversation mode
 */
export const processFreeConversationData = (
  allSeeds: Seed[] = [], 
  figureMeta: FigureMetadata | null = null, 
  language: Language | string = 'en'
): ProcessedFreeConversationData => {
  try {
    // Handle minimal or missing allSeeds
    if (!allSeeds || !Array.isArray(allSeeds) || allSeeds.length === 0) {
      // Try to use figure-specific fallback first if we have figure metadata
      if (figureMeta && figureMeta.figure) {
        // Ensure proper capitalization for the figure name
        const figureNameProper = figureMeta.figure.charAt(0).toUpperCase() + figureMeta.figure.slice(1).toLowerCase();
        
        // Create more meaningful fallback based on the figure
        return {
          mode: "free_conversation",
          figureMeta: {
            ...figureMeta,
            figure: figureNameProper
          },
          seedsOverview: [{
            id: `${figureNameProper.toLowerCase()}-fallback-1`,
            title: `${figureNameProper}'s Core Philosophy`,
            description: `The essential philosophical approach of ${figureNameProper}, focusing on central concepts and methodologies.`,
            keywords: [figureNameProper, "philosophy", "wisdom", figureMeta.topic || "knowledge"],
            conversationTriggers: [
              `When user mentions ${figureNameProper}`,
              `When discussing ${figureMeta.tradition || "philosophical"} concepts`,
              `When exploring ${figureMeta.topic || "philosophical wisdom"}`
            ]
          }],
          conversationalGuidance: {
            seedConnections: {
              [`${figureNameProper}'s Core Philosophy`]: [{
                title: figureMeta.topic || "Philosophical Inquiry",
                figure: figureNameProper,
                relationship: "Central"
              }]
            },
            characteristicPhrases: figureMeta.primaryWorks && figureMeta.primaryWorks.length > 0 ?
              [
                `As I explored in my work ${figureMeta.primaryWorks[0]}...`,
                `Let us examine this systematically, as I did in ${figureMeta.primaryWorks[0]}`,
                `The pursuit of wisdom requires both intellectual rigor and moral courage`
              ] : [
                "Let us examine this systematically",
                "We must distinguish between appearance and reality",
                "The pursuit of wisdom requires both intellectual rigor and moral courage"
              ]
          }
        };
      }
      
      // Use generic fallback as last resort
      const fallbackData: ProcessedFreeConversationData = {
        mode: "free_conversation",
        figureMeta: figureMeta || {
          figure: "Philosopher",
          topic: "Philosophy",
          tradition: "Classical",
          historicalPeriod: "Ancient",
          primaryWorks: []
        },
        seedsOverview: [{
          id: "fallback-1",
          title: "Philosophical Inquiry",
          description: "The examination of fundamental questions about existence, knowledge, values, reason, mind, and language.",
          keywords: ["Philosophical", "Inquiry", "knowledge", "existence", "values"],
          conversationTriggers: [
            "When user mentions philosophy",
            "When discussing fundamental questions",
            "When exploring the nature of reality"
          ]
        }],
        conversationalGuidance: {
          seedConnections: {
            "Philosophical Inquiry": [{
              title: "Critical Thinking",
              figure: "Socrates",
              relationship: "Foundational"
            }]
          },
          characteristicPhrases: [
            "Let us examine this systematically",
            "We must distinguish between appearance and reality",
            "The pursuit of wisdom requires both intellectual rigor and moral courage"
          ]
        }
      };
      
      return fallbackData;
    }
    
    // Process and normalize seeds if needed
    const normalizedSeeds = allSeeds.map(seed => {
      const seedAny = seed as any;
      if (!seedAny.title && seedAny.name) {
        return normalizeSeedData(seedAny) as Seed;
      }
      return seed;
    });
    
    // Extract or use provided figure metadata
    let figureMetadata = figureMeta;
    if (!figureMetadata) {
      // Try to extract from the first seed
      if (normalizedSeeds[0] && (normalizedSeeds[0] as any).figure) {
        figureMetadata = {
          figure: (normalizedSeeds[0] as any).figure,
          topic: '',
          tradition: '',
          historicalPeriod: '',
          primaryWorks: []
        };
      } else {
        const seedsData = { figure: '', topic: '', metadata: {}, seeds: normalizedSeeds };
        figureMetadata = extractFigureMeta(seedsData) as FigureMetadata;
      }
    }

    // Generate seeds overview
    const seedsOverview = generateSeedsOverview(normalizedSeeds);

    // Generate conversational guidance
    const conversationalGuidance = generateConversationalGuidance(normalizedSeeds);

    // Create the structured data for free conversation mode
    const processedData: ProcessedFreeConversationData = {
      mode: "free_conversation",
      figureMeta: figureMetadata || { figure: 'Unknown' },
      seedsOverview,
      conversationalGuidance
    };

    return processedData;
  } catch (error) {
    // Create a more useful fallback structure
    return { 
      mode: "free_conversation",
      figureMeta: figureMeta || {
        figure: "Philosopher",
        topic: "Philosophy"
      },
      seeds: allSeeds,
      seedsOverview: [],
      conversationalGuidance: {
        seedConnections: {},
        characteristicPhrases: [
          "Let us examine this systematically",
          "We must distinguish between appearance and reality",
          "The pursuit of wisdom requires both intellectual rigor and moral courage"
        ]
      }
    };
  }
};

export default {
  processSeedChallengeData,
  processSeedConversationData,
  processFreeConversationData,
  // Expose utility functions for testing
  normalizeSeedData,
  validateDataFlexible
};