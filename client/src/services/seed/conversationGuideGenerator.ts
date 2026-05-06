/**
 * Conversation guide generation utilities
 * Generates seeds overview and conversational guidance for free conversation mode
 */

import { truncateAtWordBoundary } from './textUtils';
import { normalizeSeedData } from './seedNormalizer';
import { Seed } from '../../types/global';

/**
 * Generate seeds overview for free conversation mode
 * @param {Array} allSeeds - All seeds for the figure
 * @returns {Array} - Abbreviated seeds overview
 */
export const generateSeedsOverview = (allSeeds: any[]) => {
  if (!allSeeds || !Array.isArray(allSeeds)) {
    return [];
  }

  try {
    // Process each seed, normalizing if needed
    return allSeeds.map(seed => {
      // Normalize seed data if needed
      const normalizedSeed = (!seed.title && seed.name) ? normalizeSeedData(seed) : seed;
      
      // Extract title intelligently
      let title = normalizedSeed.title;
      if (!title && normalizedSeed.name) {
        title = normalizedSeed.name.includes(' - ') 
          ? normalizedSeed.name.split(' - ')[1]
          : normalizedSeed.name;
      }
      
      // Get or generate a description
      let description = normalizedSeed.description || '';
      if (!description && title) {
        description = `A philosophical exploration of ${title}`;
      }
      
      // Extract keywords from description and title
      const descriptionWords = description.split(' ');
      const titleWords = title ? title.split(' ') : [];
      const keywords = [...new Set([
        ...titleWords,
        ...descriptionWords.filter((word: string) => word.length > 6)
          .slice(0, 5)
          .map((word: string) => word.replace(/[.,;:'"!?()]/g, ''))
      ])].slice(0, 8);

      // Generate conversation triggers
      const triggers = [
        `When user mentions ${title}`,
        `When discussing ${normalizedSeed.practiceType || 'philosophical concepts'} related to ${title}`
      ];

      if (normalizedSeed.quote) {
        triggers.push(`When themes from your quote "${truncateAtWordBoundary(normalizedSeed.quote, 40)}..." arise`);
      }

      return {
        id: normalizedSeed.id,
        title: title,
        description: description ? (description.length > 100 ? truncateAtWordBoundary(description, 100) : description) : '',
        keywords: keywords.filter(k => k.length > 3),
        conversationTriggers: triggers
      };
    });
  } catch (error) {
    // Provide a basic fallback if something went wrong
    if (allSeeds.length > 0) {
      return allSeeds.map(seed => {
        const seedName = seed.title || seed.name || `Concept ${seed.id || ''}`;
        return {
          id: seed.id || 'unknown',
          title: seedName,
          description: `A philosophical concept about ${seedName}`,
          keywords: [seedName],
          conversationTriggers: [`When user mentions ${seedName}`]
        };
      });
    }
    
    return [];
  }
};

/**
 * Generate conversational guidance information for free conversation mode
 * @param {Array} allSeeds - All seeds for the figure
 * @returns {Object} - Conversational guidance information
 */
export const generateConversationalGuidance = (allSeeds: any[]) => {
  if (!allSeeds || !Array.isArray(allSeeds)) {
    return {
      seedConnections: {},
      characteristicPhrases: [
        "Let us examine this systematically",
        "We must distinguish between appearance and reality",
        "The pursuit of wisdom requires both intellectual rigor and moral courage"
      ]
    };
  }

  try {
    // Create a map of seed connections for easy reference
    const seedConnections: Record<string, any[]> = {};

    allSeeds.forEach(seed => {
      // Get seed title - handling both formats
      let seedTitle = seed.title;
      if (!seedTitle && seed.name) {
        seedTitle = seed.name.includes(' - ') 
          ? seed.name.split(' - ')[1]
          : seed.name;
      }
      
      // Skip if we can't determine a title
      if (!seedTitle) return;
      
      // Process wisdom connections if they exist
      if (Array.isArray(seed.wisdomConnections)) {
        seedConnections[seedTitle] = seed.wisdomConnections.map((connection: any) => ({
          title: connection.title,
          figure: connection.figure,
          relationship: connection.relationship
        }));
      }
      // Generate default connections for seeds without wisdomConnections
      else {
        seedConnections[seedTitle] = [{
          title: "Philosophical Inquiry",
          figure: "Socrates",
          relationship: "Foundational"
        }];
      }
    });

    // Extract characteristic phrases from seed quotes or generate defaults
    let characteristicPhrases = [];
    
    // Try to extract from quotes
    const extractedPhrases = allSeeds
      .filter(seed => seed.quote)
      .map(seed => {
        const quote = seed.quote;
        const parts = quote.split(/[.!?]/);
        return parts[0].trim();
      })
      .filter(phrase => phrase.length > 0 && phrase.length < 60);
    
    characteristicPhrases = extractedPhrases.slice(0, 5);
    
    // Add default philosophical phrases if we don't have enough
    if (characteristicPhrases.length < 3) {
      const defaultPhrases = [
        "Let us examine this systematically, progressing from definition to examples",
        "Just as the sun illuminates the visible world, so the Good illuminates the intelligible realm",
        "We must distinguish between knowledge based on changeable opinions and that founded on unchanging Forms",
        "The unexamined life is not worth living",
        "True wisdom begins with the recognition of one's own ignorance"
      ];
      
      // Add default phrases until we have at least 3
      while (characteristicPhrases.length < 3) {
        const phraseToAdd = defaultPhrases[characteristicPhrases.length];
        if (!phraseToAdd) break;
        characteristicPhrases.push(phraseToAdd);
      }
    }

    return {
      seedConnections,
      characteristicPhrases
    };
  } catch (error) {
    // Provide good defaults
    return {
      seedConnections: {},
      characteristicPhrases: [
        "Let us examine this systematically",
        "We must distinguish between appearance and reality",
        "The pursuit of wisdom requires both intellectual rigor and moral courage",
        "True wisdom begins with the recognition of one's own ignorance",
        "What is essential is to question our assumptions"
      ]
    };
  }
};