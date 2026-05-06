import React, { FC, CSSProperties, ReactNode } from 'react';
import SeedHistoryItem from './SeedHistoryItem';
import type { HistoryData, Message, Seed } from './historyModalTypes';

interface SeedHistoryListProps {
  sortedActiveSeeds: string[];
  histories: { [key: string]: HistoryData };
  selectedSeedId: string | null;
  expandedSeeds: { [key: string]: boolean };
  expandedSections: { [key: string]: boolean };
  currentActiveSeed: Seed | null;
  isInitialLoad: boolean;
  isLoading: boolean;
  selectedFigureName: string;
  seekerLabel: string;
  summaryTitleLabel: ReactNode;
  filterMessagesByMode: (messages: Message[]) => Message[];
  getSeedTitleDisplay: (seedId: string) => string;
  toggleSeedExpansion: (seedId: string) => void;
  setSelectedSeedId: (seedId: string) => void;
  handleClearSeedHistory: (seedId: string) => void;
  toggleSection: (sectionId: string) => void;
  withHaptic: (action: (...args: any[]) => any, intensity?: 'light' | 'medium' | 'strong') => (...args: any[]) => any;
  tString: (key: string, fallback: string) => string;
  tNode: (key: string) => ReactNode;
}

const SeedHistoryList: FC<SeedHistoryListProps> = ({
  sortedActiveSeeds,
  histories,
  selectedSeedId,
  expandedSeeds,
  expandedSections,
  currentActiveSeed,
  isInitialLoad,
  isLoading,
  selectedFigureName,
  seekerLabel,
  summaryTitleLabel,
  filterMessagesByMode,
  getSeedTitleDisplay,
  toggleSeedExpansion,
  setSelectedSeedId,
  handleClearSeedHistory,
  toggleSection,
  withHaptic,
  tString,
  tNode
}) => {
  return (
    <div className="seeds-history-container" style={{
      visibility: isInitialLoad && isLoading ? 'hidden' : 'visible',
      opacity: isInitialLoad && isLoading ? 0 : 1,
      transition: 'opacity 0.3s ease'
    } as CSSProperties}>
      {sortedActiveSeeds.map(seedId => {
        const historyData = histories[seedId];
        const isCurrent = currentActiveSeed != null && String(currentActiveSeed.id) === seedId;
        const filteredMessages = filterMessagesByMode(historyData.messages);
        if (filteredMessages.length === 0) return null;

        return (
          <SeedHistoryItem
            key={seedId}
            seedId={seedId}
            isSelected={selectedSeedId === seedId}
            isCurrent={isCurrent}
            isExpanded={!!expandedSeeds[seedId]}
            filteredMessages={filteredMessages}
            seedTitle={getSeedTitleDisplay(seedId)}
            selectedFigureName={selectedFigureName}
            selectedSeedId={selectedSeedId}
            expandedSections={expandedSections}
            seekerLabel={seekerLabel}
            summaryTitleLabel={summaryTitleLabel}
            onToggleExpand={toggleSeedExpansion}
            onSelectSeed={setSelectedSeedId}
            onClearSeed={handleClearSeedHistory}
            toggleSection={toggleSection}
            withHaptic={withHaptic}
            tString={tString}
            tNode={tNode}
          />
        );
      })}
    </div>
  );
};

export default SeedHistoryList;
