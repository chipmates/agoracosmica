// src/components/CosmicCouncil/CosmicCouncilIntegration.tsx
import { FC } from 'react';
import CouncilSetupModal from './CouncilSetupModal';

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
      <CouncilSetupModal
        isOpen={categoryModalOpen}
        onClose={onCategoryModalClose}
        onStartCouncil={handleCouncilStart}
      />
    </>
  );
};

export default CosmicCouncilIntegration;