/**
 * Seed distinction generation utilities
 * Generates distinction information comparing target seed to others
 */

/**
 * Generate seed distinction information comparing target seed to others
 * @param {Object} targetSeed - The current seed being focused on
 * @param {Array} allSeeds - All seeds for the figure
 * @returns {Object} - Seed distinction information
 */
export const generateSeedDistinction = (targetSeed: any, allSeeds: any[]) => {
  if (!targetSeed) {
    return { otherSeedTitles: [], uniqueQualities: [] };
  }

  try {
    // Try to get seeds from different sources
    let seedsToUse = allSeeds;
    
    // If no seeds provided, try to load from cache
    if (!seedsToUse || !Array.isArray(seedsToUse) || seedsToUse.length <= 1) {
      // Try to get the figure name from target seed
      const figureName = targetSeed.figure ? targetSeed.figure.toLowerCase() : null;
      
      if (figureName && typeof window !== 'undefined' && window.seedsCache && window.seedsCache[figureName]) {
        seedsToUse = window.seedsCache[figureName].seeds || [];
      }
    }
    
    // Get titles of other seeds (handle both formats)
    let otherSeedTitles = Array.isArray(seedsToUse) 
      ? seedsToUse
          .filter(seed => seed.id !== targetSeed.id)
          .map(seed => {
            const title = seed.title || 
                         (seed.name && seed.name.includes(' - ') ? seed.name.split(' - ')[1] : seed.name) || 
                         `Seed ${seed.id}`;
            // Include the seed ID in the title for better reference
            return seed.id ? `${seed.id}: ${title}` : title;
          })
      : [];
    
    // If still no other seeds, create fallback titles based on the figure
    if (otherSeedTitles.length === 0) {
      // Function to generate seed IDs for fallback titles
      const generateFallbackId = (figurePrefix: string, index: number) => `${figurePrefix}-${index + 2}`;
      
      // Default to generic concepts
      const genericTitles = [
        "Core Philosophical Principles",
        "Wisdom Integration",
        "Personal Development",
        "Spiritual Inquiry"
      ];
      
      // Generate generic IDs
      const genericFigurePrefix = 'philosophical';
      otherSeedTitles = genericTitles.map((title, index) => 
        `${generateFallbackId(genericFigurePrefix, index)}: ${title}`
      );
      
      // Try to create figure-specific fallbacks if we have a figure
      if (targetSeed.figure) {
        // Figure-specific fallbacks for common figures
        const figureName = targetSeed.figure.toLowerCase();

        // Always provide fallbacks based on figure name to ensure otherSeedTitles is never empty
        const figureSpecificTitles: Record<string, string[]> = {
          'campbell': [
            "The Hero's Journey",
            "Following Your Bliss",
            "Mythological Patterns",
            "The Power of Ritual"
          ],
          'jung': [
            "Collective Unconscious",
            "The Shadow",
            "The Anima/Animus",
            "Individuation Process"
          ],
          'plato': [
            "Theory of Forms",
            "The Cave Allegory",
            "Philosopher Kings",
            "Dialectical Inquiry"
          ],
          'einstein': [
            "Relativity Theory",
            "Quantum Uncertainty",
            "Scientific Imagination",
            "Universal Patterns"
          ],
          'aurelius': [
            "Stoic Principles",
            "Virtuous Living",
            "Inner Peace",
            "Acceptance of Fate"
          ],
          'nietzsche': [
            "Will to Power",
            "Eternal Recurrence",
            "Beyond Good and Evil",
            "Übermensch Concept"
          ],
          'gandhi': [
            "Nonviolent Resistance",
            "Civil Disobedience",
            "Spiritual Leadership",
            "Truth and Self-Discipline"
          ],
          'tubman': [
            "Freedom's Path",
            "Courage in Adversity",
            "Leadership Through Action",
            "Spiritual Resilience"
          ],
          'vinci': [
            "Scientific Inquiry",
            "Creative Innovation",
            "Interdisciplinary Thinking",
            "Natural Observation"
          ]
        };

        // Use figure-specific titles if available
        if (figureName in figureSpecificTitles) {
          const titles = figureSpecificTitles[figureName];
          otherSeedTitles = titles.map((title: string, index: number) =>
            `${generateFallbackId(figureName, index)}: ${title}`
          );
        }
        // Special handling for language prefixes - strip them out
        else if (figureName.match(/^echo (of|von|de|del|di|des)\s+/i)) {
          // Remove Echo prefix with various language connectors
          const cleanedFigureName = figureName.replace(/^echo (of|von|de|del|di|des)\s+/i, '').trim().split(' ').pop()?.toLowerCase() || '';
          if (cleanedFigureName && cleanedFigureName in figureSpecificTitles) {
            const titles = figureSpecificTitles[cleanedFigureName];
            otherSeedTitles = titles.map((title: string, index: number) =>
              `${generateFallbackId(cleanedFigureName, index)}: ${title}`
            );
          }
        }
        // If we have tradition elements, create titles from them
        else if (Array.isArray(targetSeed.traditionElements) && targetSeed.traditionElements.length > 0) {
          // Create titles based on tradition elements
          const traditionTitles = targetSeed.traditionElements
            .map((element: any) => {
              // Extract first few words to create a title
              const words = element.split(' ').slice(0, 3);
              return words.map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
            })
            .slice(0, 4); // Take up to 4 tradition elements

          if (traditionTitles.length > 0) {
            otherSeedTitles = traditionTitles.map((title: string, index: number) =>
              `${generateFallbackId(figureName, index)}: ${title}`
            );
          }
        }
      }
      
      // Remove the current seed title if it exists in our fallbacks
      const currentTitle = targetSeed.title ? targetSeed.title.toLowerCase() : '';
      otherSeedTitles = otherSeedTitles.filter(title => 
        title.toLowerCase() !== currentTitle
      ).slice(0, 3); // Limit to 3 titles
    }

    // Generate unique qualities from whySelected and importance
    let uniqueQualities = [
      ...(Array.isArray(targetSeed.whySelected) ? targetSeed.whySelected.slice(0, 2) : []),
      ...(Array.isArray(targetSeed.importance) ? targetSeed.importance.slice(0, 2) : [])
    ];
    
    // Generate default qualities if none exist
    if (uniqueQualities.length === 0 && targetSeed.title) {
      uniqueQualities = [
        `Understanding the concept of ${targetSeed.title}`,
        `Exploring the philosophical implications of ${targetSeed.title}`
      ];
    }

    return {
      otherSeedTitles,
      uniqueQualities
    };
  } catch (error) {
    return { 
      otherSeedTitles: [
        "Alternative Philosophical Concepts",
        "Related Wisdom Teachings",
        "Complementary Ideas"
      ], 
      uniqueQualities: targetSeed.title 
        ? [`Understanding the concept of ${targetSeed.title}`] 
        : ["Exploring this philosophical concept"] 
    };
  }
};