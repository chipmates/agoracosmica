import { useCallback } from 'react';
import { getHistoricalFigures } from '../api/figures';
import { completeOnboarding, skipOnboarding } from '../utils/userState';
import { Figure, Seed, Language, ConversationMode } from '../types/global';
import { useDomainStore } from '../stores';
import { readFigureIntent, clearFigureIntent, readCouncilIntent, clearCouncilIntent } from '../utils/public/entryIntent';

interface HelperFunctionsParams {
  selectedFigure: Figure | null;
  selectedSeed: Seed | null;
  language: Language;
  getTranslatedSeedTitle: (figureId: string, seedId: string | number) => string | null;
  t: (key: string, params?: Record<string, any>) => string;
  handleOnboardingClose: () => void;
  handleWisdomGalleryOpen: () => void;
  handleWisdomGalleryCloseComplete: () => void;
  handleModeSelectorOpen: () => void;
  handleModeSelect: (mode: ConversationMode, force?: boolean) => void;
  handleFigureCarouselOpen: () => void;
  handleSelectFigure: (figure: Figure) => void;
  getFigureById: (id: string) => Figure | undefined;
  startCuratedCouncilById: (councilId: string) => void;
}

interface HelperFunctionsResult {
  getTranslatedFigureName: () => string;
  getCurrentSeedName: () => string;
  handleOnboardingComplete: () => void;
  handleOnboardingSkip: () => void;
  handleWisdomGallerySelect: (figure: Figure) => void;
  handleWisdomGalleryExploreAll: () => void;
}

/**
 * Hook for helper functions used in HomePage
 * Consolidates translation helpers, onboarding handlers, and other utilities
 * 
 * @param params - Hook parameters
 * @returns Helper functions
 */
export function useHelperFunctions({
  selectedFigure,
  selectedSeed,
  language,
  getTranslatedSeedTitle,
  t,
  handleOnboardingClose,
  handleWisdomGalleryOpen,
  handleWisdomGalleryCloseComplete,
  handleFigureCarouselOpen,
  handleSelectFigure,
  getFigureById,
  startCuratedCouncilById
}: HelperFunctionsParams): HelperFunctionsResult {
  // Translation helper for figure name
  const getTranslatedFigureName = useCallback((): string => {
    if (!selectedFigure) return '';
    
    // Get the current language's translated figures
    const currentLanguageFigures = getHistoricalFigures(language);
    
    // Find the figure with the same ID in the current language
    const translatedFigure = currentLanguageFigures.find(fig => fig.id === selectedFigure.id);
    
    // Return the translated name or fall back to the current name
    return translatedFigure?.name || selectedFigure?.name || '';
  }, [selectedFigure, language]);

  // Translation helper for seed name
  const getCurrentSeedName = useCallback((): string => {
    if (!selectedSeed) return '';
    
    // Extract numerical ID from the seed.id format (e.g., "laozi-1" or "dogen-1" becomes "1")
    let numericId: string | number;
    if (typeof selectedSeed.id === 'string') {
      // Handle different formats like "prefix-number" or just number
      const parts = selectedSeed.id.split('-');
      if (parts.length > 1) {
        // For prefixed IDs like "dogen-1", use the number part
        numericId = parts[parts.length - 1];
      } else {
        // For non-prefixed IDs
        numericId = selectedSeed.id;
      }
    } else {
      // Handle case where id might be a number
      numericId = selectedSeed.id;
    }
    
    // Try to get the translated title, or fall back to the original title
    // Pass the figure ID explicitly to ensure proper translation
    const translatedTitle = selectedFigure ? getTranslatedSeedTitle(selectedFigure.id, numericId) : null;
    
    // If we have a translation, use it
    if (translatedTitle) {
      return `${numericId}. ${translatedTitle}`;
    }
    
    // Otherwise, fall back to the original behavior
    let seedTitle = selectedSeed.title || (selectedSeed as any).name || '';
    
    // Remove figure name prefix if it exists (e.g., "Laozi - The Uncarved Block" becomes "The Uncarved Block")
    if (seedTitle.includes(' - ')) {
      seedTitle = seedTitle.split(' - ').slice(1).join(' - ');
    }
    
    // Fall back to using the translation system
    return `${numericId}. ${t('seeds.seedTitle', { title: seedTitle })}`;
  }, [selectedSeed, selectedFigure, getTranslatedSeedTitle, t]);

  // After the welcome step closes, route the visitor on, based on any intent
  // captured from the public page they came from. A council intent (theme
  // page) opens that council; a figure intent (figure page) lands on that
  // figure's mode selector; otherwise the WisdomGallery opens as before.
  const routeAfterOnboarding = useCallback((): void => {
    // Council deep-link from a theme page: open that council, skip the gallery.
    const intendedCouncil = readCouncilIntent();
    if (intendedCouncil) {
      clearCouncilIntent();
      startCuratedCouncilById(intendedCouncil);
      return;
    }
    // Figure deep-link from a figure page: land on that figure's mode selector.
    const intendedId = readFigureIntent();
    if (intendedId) {
      clearFigureIntent();
      const figure = getFigureById(intendedId);
      if (figure) {
        handleSelectFigure(figure);
        return;
      }
    }
    handleWisdomGalleryOpen();
  }, [getFigureById, handleSelectFigure, handleWisdomGalleryOpen, startCuratedCouncilById]);

  // Handle onboarding completion
  const handleOnboardingComplete = useCallback((): void => {
    completeOnboarding();
    useDomainStore.getState().markVisited();
    handleOnboardingClose();
    routeAfterOnboarding();
  }, [handleOnboardingClose, routeAfterOnboarding]);

  // Handle onboarding skip
  const handleOnboardingSkip = useCallback((): void => {
    skipOnboarding();
    useDomainStore.getState().markVisited();
    handleOnboardingClose();
    routeAfterOnboarding();
  }, [handleOnboardingClose, routeAfterOnboarding]);

  // Handle WisdomGallery selection
  const handleWisdomGallerySelect = useCallback((figure: Figure): void => {
    // Close gallery first, then select figure
    handleWisdomGalleryCloseComplete();
    handleSelectFigure(figure);
  }, [handleSelectFigure, handleWisdomGalleryCloseComplete]);

  // Handle WisdomGallery "explore all" option
  const handleWisdomGalleryExploreAll = useCallback((): void => {
    // Close gallery and show full figure carousel
    handleWisdomGalleryCloseComplete();
    handleFigureCarouselOpen();
  }, [handleWisdomGalleryCloseComplete, handleFigureCarouselOpen]);
  
  return {
    getTranslatedFigureName,
    getCurrentSeedName,
    handleOnboardingComplete,
    handleOnboardingSkip,
    handleWisdomGallerySelect,
    handleWisdomGalleryExploreAll
  };
}
