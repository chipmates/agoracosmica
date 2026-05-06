/**
 * Teaching context generation utilities
 * Generates teaching context information for seed conversation mode
 */

import { truncateAtWordBoundary } from './textUtils';

/**
 * Generate teaching context information for seed conversation mode
 * @param {Object} targetSeed - The current seed being focused on
 * @param {Array} allSeeds - All seeds for the figure
 * @returns {Object} - Teaching context information
 */
export const generateTeachingContext = (targetSeed: any, allSeeds: any[]) => {
  if (!targetSeed) {
    return {
      connectedSeeds: [],
      practiceAdaptations: {
        beginner: 'Start with simple observation and reflection.',
        advanced: 'Develop a more comprehensive practice based on this concept\'s principles.'
      },
      teachingApproach: {
        method: 'Reflective exploration through guided dialogue',
        progression: [
          'Begin with conceptual understanding',
          'Explore practical application',
          'Integrate with personal experience'
        ]
      }
    };
  }

  try {
    // Extract connected seeds based on wisdomConnections
    const connectedSeeds = [];
    
    // Handle wisdomConnections if they exist
    if (Array.isArray(targetSeed.wisdomConnections) && targetSeed.wisdomConnections.length > 0) {
      // Get connected seeds from this figure's seed list
      for (const connection of targetSeed.wisdomConnections) {
        // Try to match by title or name
        let matchingSeed;
        
        if (Array.isArray(allSeeds)) {
          matchingSeed = allSeeds.find(seed => {
            // Check for exact title match
            if (seed.title === connection.title) return true;
            
            // Check for title in name (Figure - Title format)
            if (seed.name && seed.name.includes(' - ')) {
              const seedTitle = seed.name.split(' - ')[1];
              return seedTitle === connection.title;
            }
            
            return false;
          });
        }
        
        // Create a connected seed entry whether or not we found a match
        connectedSeeds.push({
          id: matchingSeed?.id || connection.seed || null,
          title: connection.title || 'Related concept',
          description: matchingSeed?.description ? 
                      truncateAtWordBoundary(matchingSeed.description, 150) : 
                      (connection.explanation ? 
                        truncateAtWordBoundary(connection.explanation, 150) : 
                        `A related philosophical concept exploring ${connection.title || 'wisdom'} in connection with ${targetSeed.title || 'this concept'}.`),
          relationship: connection.relationship || 'Related',
          explanation: connection.explanation || 'This concept relates to the main teaching.'
        });
      }
    } 
    // Generate default connected seeds if none exist
    else if (targetSeed.title) {
      // Generate a "related concepts" default
      connectedSeeds.push({
        id: null,
        title: `Aspects of ${targetSeed.title}`,
        description: `Exploring different dimensions of ${targetSeed.title} and how they connect to broader philosophical inquiries.`,
        relationship: 'Complementary',
        explanation: `This concept expands on different aspects of ${targetSeed.title} from multiple perspectives.`
      });
      
      // Add a second default connected seed for better variety
      connectedSeeds.push({
        id: null,
        title: `Application of ${targetSeed.title}`,
        description: `Practical applications and embodiment of ${targetSeed.title} in daily life and philosophical practice.`,
        relationship: 'Applied',
        explanation: `This concept focuses on how to apply ${targetSeed.title} in practical contexts and real-world situations.`
      });
    }

    // Generate practice adaptations
    const practiceAdaptations = {
      beginner: targetSeed.practice ? 
        `Focus on: ${targetSeed.practice.split('.')[0]}.` : 
        `Begin with simple reflection on the concept of ${targetSeed.title || 'this philosophical idea'}.`,
      advanced: targetSeed.practice ? 
        `Extend the practice by integrating ${targetSeed.traditionElements?.[0] || 'deeper elements'}.` : 
        `Develop a comprehensive exploration of ${targetSeed.title || 'this concept'} through dialectical inquiry.`
    };

    // Generate teaching approach
    const teachingApproach = {
      method: `${targetSeed.practiceType || 'Dialectical'} exploration through guided Socratic dialogue`,
      progression: [
        'Begin with essential definition and understanding',
        'Explore conceptual implications and connections',
        'Examine practical applications in life',
        'Integrate with personal experience and higher wisdom'
      ]
    };

    return {
      connectedSeeds,
      practiceAdaptations,
      teachingApproach
    };
  } catch (error) {
    // Generate a reasonable fallback based on seed title
    return {
      connectedSeeds: [],
      practiceAdaptations: {
        beginner: targetSeed.title ? 
          `Begin reflecting on the concept of ${targetSeed.title}.` :
          'Start with simple observation and reflection.',
        advanced: targetSeed.title ?
          `Develop a deeper philosophical inquiry into ${targetSeed.title}.` :
          'Develop a more comprehensive practice based on this concept\'s principles.'
      },
      teachingApproach: {
        method: 'Dialectical exploration through guided dialogue',
        progression: [
          'Begin with conceptual understanding',
          'Explore practical application',
          'Integrate with personal experience'
        ]
      }
    };
  }
};