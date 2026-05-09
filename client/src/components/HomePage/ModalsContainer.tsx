import React, { FC, lazy, Suspense } from 'react';
const HistoryModal = lazy(() => import('../HistoryModal'));
import ModeSelectorMini from '../ModeSelectorMini';
import SeedsModal from '../SeedsModal';
const WelcomeDisclosureModal = lazy(() => import('../WelcomeDisclosureModal'));
const WisdomGalleryModal = lazy(() => import('../WisdomGalleryModal'));

import RenderCounter from '../../dev/RenderCounter';
import type { Figure, Seed } from '../../types/global';

interface ModalsContainerProps {
  // History Modal props
  isHistoryModalOpen: boolean;
  handleHistoryModalClose: () => void;
  selectedFigure: Figure | null;
  selectedSeed: Seed | null;
  fetchHistory: (figureId: string, seedId: string | number, mode?: string | null, preserveMode?: boolean) => Promise<void>;
  resetConversation: () => void;

  // Mode Selector props
  showModeSelector: boolean;
  handleModeSelectorClose: () => void;
  handleModeSelect: (mode: string) => void;
  selectedMode: string | null;

  // Seeds Modal props
  isSeedsOpen: boolean;
  handleSeedsClose: () => void;
  handleSeedSelect: (seed: Seed) => void;

  // Onboarding props
  showOnboarding: boolean;
  handleOnboardingComplete: () => void;
  handleOnboardingSkip: () => void;

  // Wisdom Gallery props
  showWisdomGallery: boolean;
  handleWisdomGalleryClose: () => void;
  handleWisdomGallerySelect: (figure: Figure) => void;
  handleWisdomGalleryExploreAll: () => void;

}

/**
 * Container for all modal components
 * Extracted from HomePage to reduce complexity
 */
const ModalsContainer: FC<ModalsContainerProps> = ({
  // History Modal props
  isHistoryModalOpen,
  handleHistoryModalClose,
  selectedFigure,
  selectedSeed,
  fetchHistory,
  resetConversation,

  // Mode Selector props
  showModeSelector,
  handleModeSelectorClose,
  handleModeSelect,
  selectedMode,

  // Seeds Modal props
  isSeedsOpen,
  handleSeedsClose,
  handleSeedSelect,

  // Onboarding props
  showOnboarding,
  handleOnboardingComplete,
  handleOnboardingSkip,

  // Wisdom Gallery props
  showWisdomGallery,
  handleWisdomGallerySelect,
  handleWisdomGalleryExploreAll,

}) => {
  return (
    <>
      {import.meta.env.DEV && <RenderCounter label="ModalsContainer" />}
      {selectedFigure && isHistoryModalOpen && (
        <Suspense fallback={null}>
          <HistoryModal
            isOpen={isHistoryModalOpen}
            onClose={handleHistoryModalClose}
            selectedFigure={selectedFigure}
            onSummaryGenerated={() => {
              if (selectedSeed?.id !== undefined) {
                void fetchHistory(selectedFigure.id, selectedSeed.id);
              }
            }}
            onHistoryCleared={() => {
              resetConversation();
            }}
          />
        </Suspense>
      )}

      {/* Don't use a key prop to avoid remounting issues */}
      {showModeSelector && (
        <ModeSelectorMini
          isOpen={true}
          onClose={handleModeSelectorClose}
          onModeSelect={handleModeSelect}
          selectedMode={selectedMode}
          selectedFigure={selectedFigure}
          selectedSeed={selectedSeed as Seed | null | undefined}
        />
      )}

      <SeedsModal
        isOpen={isSeedsOpen}
        onClose={handleSeedsClose}
        selectedFigure={selectedFigure}
        onSeedSelect={handleSeedSelect}
        selectedMode={selectedMode ?? undefined}
      />
      
      <Suspense fallback={null}>
        <WelcomeDisclosureModal
          isOpen={showOnboarding}
          onComplete={handleOnboardingComplete}
          onSkip={handleOnboardingSkip}
        />
      </Suspense>
      
      {/* Wisdom Gallery Modal - Shows after onboarding for first-time users */}
      {showWisdomGallery && (
        <Suspense fallback={null}>
          <WisdomGalleryModal
            onSelectFigure={handleWisdomGallerySelect}
            onExploreAll={handleWisdomGalleryExploreAll}
          />
        </Suspense>
      )}

    </>
  );
};

ModalsContainer.displayName = 'ModalsContainer';

export default React.memo(ModalsContainer);
