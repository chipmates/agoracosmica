import { useCallback } from 'react';

interface UIHandlersParams {
  // State setters passed from HomePage
  setIsMenuOpen: (value: boolean | ((prev: boolean) => boolean)) => void;
  setIsHistoryModalOpen: (value: boolean) => void;
  setIsSeedsOpen: (value: boolean) => void;
  setShowModeSelector: (value: boolean) => void;
  setShowFigureCarousel: (value: boolean) => void;
  setShowOnboarding: (value: boolean) => void;
  setShowWisdomGallery: (value: boolean) => void;
  
  // Dependencies for complex handlers
  handleWisdomGalleryExploreAll?: () => void;
}

interface UIHandlersResult {
  // Menu handlers
  handleMenuToggle: () => void;
  handleMenuClose: () => void;
  
  // Modal handlers
  handleHistoryModalOpen: () => void;
  handleHistoryModalClose: () => void;
  handleSeedsOpen: () => void;
  handleSeedsClose: () => void;
  handleModeSelectorOpen: () => void;
  handleModeSelectorClose: () => void;
  handleFigureCarouselOpen: () => void;
  handleFigureCarouselClose: () => void;
  
  // Gallery handlers
  handleWisdomGalleryClose: () => void;
  handleWisdomGalleryOpen: () => void;
  handleWisdomGalleryCloseComplete: () => void;
  
  // Onboarding handlers
  handleOnboardingOpen: () => void;
  handleOnboardingClose: () => void;
}

/**
 * Hook for managing UI event handlers and toggles
 * These are simple UI state changes with no complex logic
 * Designed to be Zustand-ready for future migration
 * 
 * @param params - Hook parameters
 * @returns UI handlers and state setters
 */
export function useUIHandlers({
  // State setters passed from HomePage
  setIsMenuOpen,
  setIsHistoryModalOpen,
  setIsSeedsOpen,
  setShowModeSelector,
  setShowFigureCarousel,
  setShowOnboarding,
  setShowWisdomGallery,
  
  // Dependencies for complex handlers
  handleWisdomGalleryExploreAll
}: UIHandlersParams): UIHandlersResult {
  /**
   * Toggle mobile menu
   */
  const handleMenuToggle = useCallback(() => {
    setIsMenuOpen(prev => !prev);
  }, [setIsMenuOpen]);

  /**
   * Close mobile menu
   */
  const handleMenuClose = useCallback(() => {
    setIsMenuOpen(false);
  }, [setIsMenuOpen]);

  /**
   * Open history modal
   */
  const handleHistoryModalOpen = useCallback(() => {
    setIsHistoryModalOpen(true);
  }, [setIsHistoryModalOpen]);

  /**
   * Close history modal
   */
  const handleHistoryModalClose = useCallback(() => {
    setIsHistoryModalOpen(false);
  }, [setIsHistoryModalOpen]);

  /**
   * Open seeds modal
   */
  const handleSeedsOpen = useCallback(() => {
    setIsSeedsOpen(true);
  }, [setIsSeedsOpen]);

  /**
   * Close seeds modal
   */
  const handleSeedsClose = useCallback(() => {
    setIsSeedsOpen(false);
  }, [setIsSeedsOpen]);

  /**
   * Open mode selector
   */
  const handleModeSelectorOpen = useCallback(() => {
    setShowModeSelector(true);
  }, [setShowModeSelector]);

  /**
   * Close mode selector
   */
  const handleModeSelectorClose = useCallback(() => {
    setShowModeSelector(false);
  }, [setShowModeSelector]);

  /**
   * Open figure carousel
   */
  const handleFigureCarouselOpen = useCallback(() => {
    setShowFigureCarousel(true);
  }, [setShowFigureCarousel]);

  /**
   * Close figure carousel
   */
  const handleFigureCarouselClose = useCallback(() => {
    setShowFigureCarousel(false);
  }, [setShowFigureCarousel]);

  /**
   * Handle WisdomGallery close
   */
  const handleWisdomGalleryClose = useCallback(() => {
    // For now, treat close as explore all
    if (handleWisdomGalleryExploreAll) {
      handleWisdomGalleryExploreAll();
    }
  }, [handleWisdomGalleryExploreAll]);

  /**
   * Open wisdom gallery
   */
  const handleWisdomGalleryOpen = useCallback(() => {
    setShowWisdomGallery(true);
  }, [setShowWisdomGallery]);

  /**
   * Close wisdom gallery with state update
   */
  const handleWisdomGalleryCloseComplete = useCallback(() => {
    setShowWisdomGallery(false);
  }, [setShowWisdomGallery]);

  /**
   * Open onboarding
   */
  const handleOnboardingOpen = useCallback(() => {
    setShowOnboarding(true);
  }, [setShowOnboarding]);

  /**
   * Close onboarding
   */
  const handleOnboardingClose = useCallback(() => {
    setShowOnboarding(false);
  }, [setShowOnboarding]);

  return {
    // Menu handlers
    handleMenuToggle,
    handleMenuClose,
    
    // Modal handlers
    handleHistoryModalOpen,
    handleHistoryModalClose,
    handleSeedsOpen,
    handleSeedsClose,
    handleModeSelectorOpen,
    handleModeSelectorClose,
    handleFigureCarouselOpen,
    handleFigureCarouselClose,
    
    // Gallery handlers
    handleWisdomGalleryClose,
    handleWisdomGalleryOpen,
    handleWisdomGalleryCloseComplete,
    
    // Onboarding handlers
    handleOnboardingOpen,
    handleOnboardingClose
  };
}