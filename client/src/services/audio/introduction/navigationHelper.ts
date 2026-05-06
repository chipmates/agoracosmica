// Navigation helper for playing next/previous stories
import { getSeedById, getFigureSeedDataAsync } from '../../seedCacheInitializer';
import { normalizeManifestFigureName, isKingJrVariant } from './figureNameNormalizer';
import { audioPathBuilder, AUDIO_SUPPORTED_LANGUAGES, findAvailableAudioPath } from './audioPathBuilder';

interface Story {
  id: string;
  seedId: number;
  title: string;
  type: string;
  figureId: string;
  figureName: string;
  language: string | null;
}

interface CurrentPlayback {
  story: any;
  figureName: string;
  language?: string;
}

interface NavigationResult {
  story: Story | null;
  error: string | null;
}

interface StoryMetadata {
  title: string;
  figureName: string;
}

/**
 * Get the next story for a figure
 */
export async function getNextStory(currentPlayback: CurrentPlayback, currentFigure: string, currentSeedId: number): Promise<NavigationResult> {
  // Get the next seed ID (we have seeds 1-12 for all figures)
  const nextSeedId = currentSeedId + 1;

  // Check if next seed exists (max is 12)
  if (nextSeedId > 12) {
    return { story: null, error: 'No next story available (reached seed 12)' };
  }
  
  // Normalize figure name for audio file paths
  let normalizedFigureName = normalizeManifestFigureName(currentFigure);
  
  // Special handling for King Jr. variants
  if (isKingJrVariant(currentFigure)) {
    normalizedFigureName = 'king';
  }
  
  // Check if audio exists for next seed
  const preferredLanguage = currentPlayback.language || 'en';
  const { audioPath, audioLanguage, error } = findAvailableAudioPath(
    normalizedFigureName,
    nextSeedId.toString(),
    preferredLanguage
  );
  
  if (error) {
    return { story: null, error: `No audio available for next seed ${nextSeedId}` };
  }
  
  // Get the actual title and figure name
  const { title, figureName } = await getStoryMetadata(
    currentFigure,
    normalizedFigureName,
    nextSeedId,
    audioLanguage || preferredLanguage
  );
  
  // Create the next story object
  const nextStory = {
    id: `${currentFigure}-${nextSeedId}`,
    seedId: nextSeedId,
    title,
    type: 'seed',
    figureId: currentFigure,
    figureName,
    language: audioLanguage
  };
  
  return { story: nextStory, error: null };
}

/**
 * Get the previous story for a figure
 */
export async function getPreviousStory(currentPlayback: CurrentPlayback, currentFigure: string, currentSeedId: number): Promise<NavigationResult> {
  // Don't go before seed 1
  if (currentSeedId <= 1) {
    return { story: null, error: 'Already at the first seed' };
  }
  
  // Get the previous seed ID
  const prevSeedId = currentSeedId - 1;
  
  // Normalize figure name for audio file paths
  let normalizedFigureName = normalizeManifestFigureName(currentFigure);
  
  // Special handling for King Jr. variants
  if (isKingJrVariant(currentFigure)) {
    normalizedFigureName = 'king';
  }
  
  // Check if audio exists for previous seed
  const preferredLanguage = currentPlayback.language || 'en';
  const { audioPath, audioLanguage, error } = findAvailableAudioPath(
    normalizedFigureName,
    prevSeedId.toString(),
    preferredLanguage
  );
  
  if (error) {
    return { story: null, error: `No audio available for previous seed ${prevSeedId}` };
  }
  
  // Get the actual title and figure name
  const { title, figureName } = await getStoryMetadata(
    currentFigure,
    normalizedFigureName,
    prevSeedId,
    audioLanguage || preferredLanguage
  );
  
  // Create the previous story object
  const prevStory = {
    id: `${currentFigure}-${prevSeedId}`,
    seedId: prevSeedId,
    title,
    type: 'seed',
    figureId: currentFigure,
    figureName,
    language: audioLanguage
  };
  
  return { story: prevStory, error: null };
}

/**
 * Get story metadata (title and figure name)
 */
async function getStoryMetadata(currentFigure: string, normalizedFigureName: string, seedId: number, language: string): Promise<StoryMetadata> {
  let title = `Seed ${seedId}`;
  let figureName = currentFigure;

  try {
    // Import the historical figures data
    const { historicalFigures } = await import('../../../api/figures');

    // Find the matching figure using the normalized name
    const normalizedCurrentFigure = normalizeManifestFigureName(currentFigure);
    const figureMatch = historicalFigures.find(f => {
      const nameParts = f.name.toLowerCase().split(' ');
      const lastName = nameParts[nameParts.length - 1];
      const normalizedName = normalizeManifestFigureName(f.name.toLowerCase());
      return lastName === normalizedCurrentFigure ||
             normalizedCurrentFigure.includes(lastName) ||
             normalizedName === normalizedCurrentFigure;
    });

    if (figureMatch) {
      figureName = figureMatch.name;
    }

    // BUGFIX: Ensure seed data is loaded before accessing it
    // Use async loader to guarantee seed data is in cache
    await getFigureSeedDataAsync(normalizedCurrentFigure, language);

    // Now get the seed title using the multilingual seed cache
    const seedData = getSeedById(normalizedCurrentFigure, seedId, language);

    if (seedData && seedData.title) {
      title = seedData.title;
    }
  } catch (error) {
    // Continue with default title and figure name
    console.error('Error loading seed metadata:', error);
  }

  return { title, figureName };
}

/**
 * Get full figure name from figure ID
 */
export async function getFullFigureName(figureId: string): Promise<string> {
  let fullFigureName = figureId;
  
  try {
    const { historicalFigures } = await import('../../../api/figures');
    
    const normalizedFigureId = normalizeManifestFigureName(figureId);
    const figureMatch = historicalFigures.find(f => {
      const nameParts = f.name.toLowerCase().split(' ');
      const lastName = nameParts[nameParts.length - 1];
      const normalizedName = normalizeManifestFigureName(f.name.toLowerCase());
      return lastName === normalizedFigureId || 
             normalizedFigureId.includes(lastName) ||
             lastName.includes(normalizedFigureId) ||
             normalizedName === normalizedFigureId;
    });
    
    if (figureMatch) {
      fullFigureName = figureMatch.name;
    }
  } catch (error) {
    // Return original figureId as fallback
  }
  
  return fullFigureName;
}