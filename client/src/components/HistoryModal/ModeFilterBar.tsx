import React, { FC, CSSProperties, ReactElement } from 'react';
import { isMobileOrTablet } from '../../utils/deviceDetection';
import { MODES } from './historyModalConstants';

interface ModeFilterBarProps {
  selectedModes: string[];
  toggleMode: (mode: string) => void;
  tString: (key: string, fallback: string) => string;
}

const ModeFilterBar: FC<ModeFilterBarProps> = ({
  selectedModes,
  toggleMode,
  tString
}): ReactElement => {
  return (
    <div className="mode-filters">
      {Object.entries(MODES).map(([mode, config]) => {
        const Icon = config.icon;
        const isSelected = selectedModes.includes(mode);

        // Get translated label for each mode
        let label = config.label;
        if (mode === 'introduction') {
          label = tString('modes.story', config.label);
        } else if (mode === 'prism') {
          label = tString('modes.prism', config.label);
        } else if (mode === 'seed_conversation') {
          label = tString('modes.wisdom', config.label);
        } else if (mode === 'challenge') {
          label = tString('modes.quest', config.label);
        } else if (mode === 'free_conversation') {
          label = tString('modes.freetalk', config.label);
        } else if (mode === 'summary') {
          label = tString('chat.reviewMode', config.label);
        }

        return (
          <button
            key={mode}
            className={`mode-filter-button ${isSelected ? 'selected' : ''} ${isMobileOrTablet() ? 'icon-only' : ''}`}
            onClick={() => toggleMode(mode)}
            style={{ '--mode-color': config.color } as CSSProperties}
            title={label}
            aria-label={label}
            aria-pressed={isSelected}
          >
            {Icon && <Icon size={isMobileOrTablet() ? 20 : 20} weight={isSelected ? "fill" : "duotone"} />}
            {!isMobileOrTablet() && <span>{label}</span>}
          </button>
        );
      })}
    </div>
  );
};

export default ModeFilterBar;
