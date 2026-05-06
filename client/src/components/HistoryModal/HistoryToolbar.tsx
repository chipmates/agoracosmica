import React, { FC, ReactNode, ChangeEvent } from 'react';
import { Download, Upload, FileText, Broom } from '@phosphor-icons/react';
import { RippleButton } from '../Button';
import { isMobileOrTablet } from '../../utils/deviceDetection';
import { useDomainStore } from '../../stores/domainStore';

interface HistoryToolbarProps {
  hasSeeds: boolean;
  selectedSeedId: string | null;
  onBackup: () => void;
  onRestore: (event: ChangeEvent<HTMLInputElement>) => void;
  onClearAll: () => void;
  onSummary: () => void;
  withHaptic: (action: (...args: any[]) => any, intensity?: 'light' | 'medium' | 'strong') => (...args: any[]) => any;
  tString: (key: string, fallback: string) => string;
  tNode: (key: string) => ReactNode;
}

const HistoryToolbar: FC<HistoryToolbarProps> = ({
  hasSeeds,
  selectedSeedId,
  onBackup,
  onRestore,
  onClearAll,
  onSummary,
  withHaptic,
  tString,
  tNode
}) => {
  return (
    <div className="clear-buttons-container">
      <RippleButton
        onClick={withHaptic(onBackup)}
        className="backup-button"
        size="small"
        icon={<Download size={16} weight="duotone" />}
        aria-label={tString('history.actions.backup', 'Backup Data')}
      >
        {!isMobileOrTablet() && tNode('history.actions.backup')}
      </RippleButton>

      <label className="restore-button-container">
        <RippleButton
          className="restore-button"
          size="small"
          icon={<Upload size={16} weight="duotone" />}
          onClick={withHaptic(() => document.getElementById('restore-file-input')?.click())}
          aria-label={tString('history.actions.restore', 'Restore Data')}
        >
          {!isMobileOrTablet() && tNode('history.actions.restore')}
        </RippleButton>
        <input
          id="restore-file-input"
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={onRestore}
        />
      </label>

      {hasSeeds && (
        <>
          <RippleButton
            onClick={withHaptic(onClearAll, 'strong')}
            className="clear-all-button"
            size="small"
            icon={<Broom size={isMobileOrTablet() ? 18 : 16} weight="fill" />}
            aria-label={tString('history.actions.clearAll', "Clear All Figures' History")}
          >
            {!isMobileOrTablet() && tNode('history.actions.clearAll')}
          </RippleButton>

          {selectedSeedId && (
            <SummaryButton
              onSummary={onSummary}
              withHaptic={withHaptic}
              tString={tString}
              tNode={tNode}
            />
          )}
        </>
      )}
    </div>
  );
};

// Internal — visually communicates "summary quota empty" while staying clickable
// so the parent's intercept can route to the rate-limit modal.
const SummaryButton: FC<{
  onSummary: () => void;
  withHaptic: (action: (...args: any[]) => any, intensity?: 'light' | 'medium' | 'strong') => (...args: any[]) => any;
  tString: (key: string, fallback: string) => string;
  tNode: (key: string) => ReactNode;
}> = ({ onSummary, withHaptic, tString, tNode }) => {
  const summaryQuota = useDomainStore((s) => s.quota.summary);
  const isFreeTier = useDomainStore((s) => s.quota.isFreeTier);
  const isExhausted = isFreeTier && summaryQuota.loaded && summaryQuota.used >= summaryQuota.limit;

  return (
    <RippleButton
      onClick={withHaptic(onSummary)}
      className="summary-button"
      size="small"
      icon={<FileText size={16} weight="duotone" />}
      aria-label={isExhausted
        ? tString('quota.limitReached', 'Daily limit reached')
        : tString('history.actions.generateSummary', 'Generate Summary')}
      style={isExhausted ? { opacity: 0.55 } : undefined}
    >
      {!isMobileOrTablet() && tNode('history.actions.generateSummary')}
    </RippleButton>
  );
};

export default HistoryToolbar;
