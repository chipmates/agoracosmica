import { FC, ReactNode } from 'react';
import { CaretDown, CaretRight, Trash } from '@phosphor-icons/react';
import { RippleButton } from '../Button';
import { isMobileOrTablet } from '../../utils/deviceDetection';
import HistoryMessage from './HistoryMessage';
import SummaryContent from './SummaryContent';
import type { Message } from './historyModalTypes';

interface SeedHistoryItemProps {
  seedId: string;
  isSelected: boolean;
  isCurrent: boolean;
  isExpanded: boolean;
  filteredMessages: Message[];
  seedTitle: string;
  selectedFigureName: string;
  selectedSeedId: string | null;
  expandedSections: { [key: string]: boolean };
  seekerLabel: string;
  summaryTitleLabel: ReactNode;
  onToggleExpand: (seedId: string) => void;
  onSelectSeed: (seedId: string) => void;
  onClearSeed: (seedId: string) => void;
  toggleSection: (sectionId: string) => void;
  withHaptic: (action: (...args: any[]) => any, intensity?: 'light' | 'medium' | 'strong') => (...args: any[]) => any;
  tString: (key: string, fallback: string) => string;
  tNode: (key: string) => ReactNode;
}

const SeedHistoryItem: FC<SeedHistoryItemProps> = ({
  seedId,
  isSelected,
  isCurrent,
  isExpanded,
  filteredMessages,
  seedTitle,
  selectedFigureName,
  selectedSeedId,
  expandedSections,
  seekerLabel,
  summaryTitleLabel,
  onToggleExpand,
  onSelectSeed,
  onClearSeed,
  toggleSection,
  withHaptic,
  tString,
  tNode
}) => {
  const formatSummary = (content: string): ReactNode => (
    <SummaryContent
      content={content}
      selectedSeedId={selectedSeedId}
      expandedSections={expandedSections}
      toggleSection={toggleSection}
      summaryTitleLabel={summaryTitleLabel}
    />
  );

  return (
    <div className="seed-history-section">
      <div
        className={`seed-header ${isSelected ? 'active' : ''} ${isCurrent ? 'current' : ''}`}
        onClick={() => {
          onToggleExpand(seedId);
          onSelectSeed(seedId);
        }}
      >
        {isExpanded ? <CaretDown size={20} weight="duotone" color="var(--gold-subtle)" /> : <CaretRight size={20} weight="duotone" color="var(--gold-subtle)" />}
        <span className="seed-title">{seedTitle}</span>
        <RippleButton
          onClick={(e) => {
            e.stopPropagation();
            withHaptic(() => onClearSeed(seedId), 'medium')();
          }}
          className="clear-seed-button-inline"
          size="small"
          icon={isMobileOrTablet() ? <Trash size={18} /> : <Trash size={16} />}
          aria-label={tString('history.actions.clear', 'Clear')}
        >
          {!isMobileOrTablet() && tNode('history.actions.clear')}
        </RippleButton>
      </div>

      {isExpanded && (
        <div className="seed-history-content">
          <div className="conversation-history">
            {filteredMessages.map((entry, index) => (
              <HistoryMessage
                key={index}
                entry={entry}
                index={index}
                selectedFigureName={selectedFigureName}
                seekerLabel={seekerLabel}
                formatSummary={formatSummary}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SeedHistoryItem;
