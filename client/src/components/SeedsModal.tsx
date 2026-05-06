// SeedsModal.tsx - Modal wrapper for wisdom seeds display
import React, { FC } from 'react';
import WisdomMapModal from './WisdomMapModal'; // Integrated modal with map + detail views
import { Figure } from '../types/global';

interface SeedsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedFigure: Figure | null;
  onSeedSelect: (seed: any) => void;
  selectedMode?: string;
}

/**
 * SeedsModal - Component for displaying seeds of wisdom
 * Uses WisdomMapModal with constellation map view + SeedDetailView for reading
 */
const SeedsModal: FC<SeedsModalProps> = ({ 
  isOpen, 
  onClose, 
  selectedFigure, 
  onSeedSelect, 
  selectedMode 
}) => {
  if (!isOpen) return null;

  return (
    <WisdomMapModal 
      isOpen={isOpen}
      onClose={onClose}
      selectedFigure={selectedFigure}
      defaultView="map"
      onSeedSelect={onSeedSelect}
      showSelectButton={true}
      isForSeedConversation={selectedMode === 'seed_conversation'}
    />
  );
};

export default SeedsModal;