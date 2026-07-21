// src/components/CosmicCouncil/CosmicCouncilIntegration.tsx
import { FC, lazy, Suspense } from 'react';

// Lazy like the sibling modals in ModalsContainer: keeps CouncilSetupModal
// (and its large stylesheet) out of the eager HomePage chunk.
const CouncilSetupModal = lazy(() => import('./CouncilSetupModal'));

interface CouncilConfig {
  participants?: any[];
  question?: string;
  [key: string]: any;
}

interface CosmicCouncilIntegrationProps {
  categoryModalOpen: boolean;
  onCategoryModalClose: () => void;
  onCouncilStart?: (councilConfig: CouncilConfig) => Promise<void>;
}

const CosmicCouncilIntegration: FC<CosmicCouncilIntegrationProps> = ({
  categoryModalOpen,
  onCategoryModalClose,
  onCouncilStart
}) => {
  const handleCouncilStart = async (councilConfig: CouncilConfig): Promise<void> => {
    try {
      if (onCouncilStart) {
        await onCouncilStart(councilConfig);
      } else {
        console.error('CosmicCouncilIntegration: onCouncilStart is not defined');
      }
      onCategoryModalClose();
    } catch (error) {
      console.error('Failed to start council:', error);
      // Keep modal open on error
    }
  };

  return (
    <>
      {/* Council Setup Modal with Smart Dynamic Header */}
      <Suspense fallback={null}>
        <CouncilSetupModal
          isOpen={categoryModalOpen}
          onClose={onCategoryModalClose}
          onStartCouncil={handleCouncilStart}
        />
      </Suspense>
    </>
  );
};

export default CosmicCouncilIntegration;