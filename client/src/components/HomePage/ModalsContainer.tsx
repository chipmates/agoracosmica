import React, { FC, lazy, Suspense } from 'react';
const HistoryModal = lazy(() => import('../HistoryModal'));
import ModeSelectorMini from '../ModeSelectorMini';
import SeedsModal from '../SeedsModal';
const WelcomeDisclosureModal = lazy(() => import('../WelcomeDisclosureModal'));
// V2 = the night gallery (design blessed 2026-07-23). V1 is gone, so this is
// the only gallery; the name stays for the props contract below.
const WisdomGalleryModal = lazy(() => import('../WisdomGalleryModalV2'));

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

// The welcome disclosure is a required consent gate but it loads lazily, so
// between "show it" and the chunk arriving there is a window with nothing over
// the app. A figure click inside that window persists a selection, which alone
// classifies the visitor as returning and closes the gate for good. This shield
// covers exactly that window: it exists only while the gate is open and the
// chunk is still in flight, and it carries no appearance of its own.
const WELCOME_GATE_SHIELD: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 9999,
};

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
      
      <Suspense fallback={showOnboarding ? <div style={WELCOME_GATE_SHIELD} /> : null}>
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
