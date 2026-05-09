import {
  ChangeEvent,
  FC,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Handshake,
  CaretDown,
  Info,
  DownloadSimple,
  UploadSimple,
} from '@phosphor-icons/react';
import { ModalContainer } from '../Modal';
import { CloseButton } from '../Button';
import useTranslation from '../../hooks/useTranslation';
import { computeVotingPower, computeSuggestionSlots } from './computeVotingPower';
import { VotingPowerHero } from './VotingPowerHero';
import { TopicsList } from './TopicsList';
import { SuggestSlotPanel } from './SuggestSlotPanel';
import { registerVotingPower, type CommunitySnapshot } from '../../services/communityVote';
import { exportHistory, importHistory } from '../../services/history/historyExportService';
import styles from './CommunityGovernanceModal.module.css';

const ANIMATION_FLAG_KEY = 'community_modal_seen_session';

interface ThresholdPanelProps {
  threshold: number;
  phase: string | null;
}

// Map the worker's English phase string to a translation key.
// Worker source: cloudflare-worker-community/src/index.ts THRESHOLD_LADDER.
const PHASE_KEY_BY_WORKER_STRING: Record<string, string> = {
  'Launch phase': 'community.threshold.phaseLaunch',
  'Growing community': 'community.threshold.phaseGrowing',
  'Established community': 'community.threshold.phaseEstablished',
  'Large community': 'community.threshold.phaseLarge',
  'Global community': 'community.threshold.phaseGlobal',
};

const ThresholdPanel: FC<ThresholdPanelProps> = ({ threshold, phase }) => {
  const { tString } = useTranslation();
  const label = tString('community.threshold.label', 'Support threshold');
  const current = tString(
    'community.threshold.current',
    'A suggestion needs {n} community votes before we review it.'
  ).replace('{n}', String(threshold));
  const explainer = tString(
    'community.threshold.explainer',
    'When other members back a suggestion, it becomes visible. The threshold rises as the community grows. We announce every change.'
  );
  const phaseKey = phase ? PHASE_KEY_BY_WORKER_STRING[phase] : null;
  const phaseLabel = phaseKey ? tString(phaseKey, phase ?? '') : phase;

  return (
    <section className={styles.thresholdPanel} aria-labelledby="threshold-panel-title">
      <header className={styles.thresholdHeader}>
        <span className={styles.thresholdIcon} aria-hidden="true">
          <Handshake size={18} weight="duotone" />
        </span>
        <div className={styles.thresholdTitleWrap}>
          <h4 id="threshold-panel-title" className={styles.thresholdTitle}>
            {label}
          </h4>
          {phaseLabel && <span className={styles.thresholdPhase}>{phaseLabel}</span>}
        </div>
        <span className={styles.thresholdNumber}>{threshold}</span>
      </header>
      <p className={styles.thresholdCurrent}>{current}</p>
      <p className={styles.thresholdExplainer}>{explainer}</p>
    </section>
  );
};

interface HowItWorksProps {
  defaultOpen: boolean;
  threshold: number;
  phase: string | null;
  slots: ReturnType<typeof computeSuggestionSlots>;
}

const HowItWorks: FC<HowItWorksProps> = ({ defaultOpen, threshold, phase, slots }) => {
  const { tString } = useTranslation();
  const [open, setOpen] = useState(defaultOpen);

  const title = tString('community.howSection.title', 'How governance works');
  const subtitle = tString(
    'community.howSection.subtitle',
    'Tiers, slots, and the co-sign threshold.'
  );

  return (
    <section
      className={`${styles.howSection} ${open ? styles.howSectionOpen : ''}`}
    >
      <button
        type="button"
        className={styles.howHeader}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="how-it-works-body"
      >
        <span className={styles.howIcon} aria-hidden="true">
          <Info size={18} weight="duotone" />
        </span>
        <span className={styles.howTitleWrap}>
          <span className={styles.howTitle}>{title}</span>
          <span className={styles.howSubtitle}>{subtitle}</span>
        </span>
        <span className={styles.howCaret} aria-hidden="true">
          <CaretDown size={16} />
        </span>
      </button>
      {open && (
        <div id="how-it-works-body" className={styles.howBody}>
          <SuggestSlotPanel slots={slots} />
          <ThresholdPanel threshold={threshold} phase={phase} />
        </div>
      )}
    </section>
  );
};

interface CommunityGovernanceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CommunityGovernanceModal: FC<CommunityGovernanceModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { tString } = useTranslation();

  const [restoreNonce, setRestoreNonce] = useState(0);
  const power = useMemo(
    () => (isOpen ? computeVotingPower() : null),
    [isOpen, restoreNonce]
  );
  const slots = useMemo(
    () => (power ? computeSuggestionSlots(power.earned) : null),
    [power]
  );

  const [snapshot, setSnapshot] = useState<CommunitySnapshot | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Use cosmic-reveal on first open per session, faster fade-scale on subsequent.
  const animationType = useMemo<'cosmic-reveal' | 'fade-scale'>(() => {
    try {
      const seen = sessionStorage.getItem(ANIMATION_FLAG_KEY);
      if (seen) return 'fade-scale';
      sessionStorage.setItem(ANIMATION_FLAG_KEY, '1');
      return 'cosmic-reveal';
    } catch {
      return 'cosmic-reveal';
    }
  }, []);

  useEffect(() => {
    if (!isOpen || !power) return;
    let cancelled = false;
    registerVotingPower({
      power: power.total,
      completedFigures: power.earned,
    })
      .then((result) => {
        if (!cancelled && result) setSnapshot(result);
      })
      .catch(() => {
        // Silent: heartbeat is best-effort, modal must always work offline.
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, power]);

  const handleBackup = useCallback(async () => {
    try {
      await exportHistory();
    } catch (error) {
      console.warn('[CommunityGovernanceModal] Backup failed', error);
      window.alert(
        tString('history.alerts.backupFailed', 'Failed to create backup')
      );
    }
  }, [tString]);

  const handleRestoreClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleRestoreChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      let handledError = false;
      try {
        await importHistory(
          file,
          () => {
            setRestoreNonce((n) => n + 1);
            window.alert(
              tString(
                'history.alerts.restoreSuccess',
                'Data restored successfully'
              )
            );
          },
          (error) => {
            handledError = true;
            console.error(
              '[CommunityGovernanceModal] restore callback reported failure',
              error
            );
            window.alert(
              tString('history.alerts.restoreFailed', 'Failed to restore backup')
            );
          }
        );
      } catch (error) {
        console.error('[CommunityGovernanceModal] restore failed', error);
        if (!handledError) {
          window.alert(
            tString('history.alerts.restoreFailed', 'Failed to restore backup')
          );
        }
      } finally {
        event.target.value = '';
      }
    },
    [tString]
  );

  if (!isOpen || !power || !slots) return null;

  // Adaptive default for "How governance works": open for Council, closed for others.
  const howDefaultOpen = power.tier === 'council';

  return (
    <ModalContainer
      isOpen={isOpen}
      onClose={onClose}
      modalType="compact"
      animationType={animationType}
      backgroundVariant="cosmic-nebula"
      ariaLabel={tString('community.modalTitle', 'Community')}
      contentClassName={styles.modalContent}
    >
      <div className={styles.modal}>
        <header className={styles.header}>
          <div className={styles.headerStars} aria-hidden="true">
            <span /><span /><span /><span /><span />
          </div>
          <div className={styles.headerTitleWrap}>
            <h2 className={styles.title}>
              {tString('community.modalTitle', 'Community')}
            </h2>
            <span className={styles.lockedBadge}>
              {tString('community.lockedBadge', 'Voting unlocks soon')}
            </span>
          </div>
          <CloseButton
            onClick={onClose}
            ariaLabel={tString('common.close', 'Close')}
          />
        </header>

        <div className={styles.body}>
          <VotingPowerHero
            base={power.base}
            earned={power.earned}
            total={power.total}
            totalFigures={power.totalFigures}
            tier={power.tier}
            stats={
              snapshot
                ? {
                    joinedCount: snapshot.joinedCount,
                    totalPower: snapshot.totalPower,
                  }
                : { joinedCount: null, totalPower: null }
            }
          />

          <section
            className={styles.dataCard}
            aria-labelledby="community-data-card-title"
          >
            <header className={styles.dataCardHeader}>
              <span
                id="community-data-card-title"
                className={styles.dataCardTitle}
              >
                {tString(
                  'community.dataCard.title',
                  'Save & restore your progress'
                )}
              </span>
              <span className={styles.dataCardHint}>
                {tString(
                  'community.dataCard.hint',
                  'Your voting power and conversations live on this device. Save them to a file you keep, or restore from one.'
                )}
              </span>
            </header>
            <div className={styles.dataCardActions}>
              <button
                type="button"
                className={styles.dataCardButton}
                onClick={handleBackup}
                aria-label={tString(
                  'community.dataCard.backupAria',
                  'Back up your progress to a file'
                )}
              >
                <DownloadSimple size={16} weight="duotone" aria-hidden="true" />
                <span>
                  {tString('community.dataCard.backup', 'Back up')}
                </span>
              </button>
              <button
                type="button"
                className={styles.dataCardButton}
                onClick={handleRestoreClick}
                aria-label={tString(
                  'community.dataCard.restoreAria',
                  'Restore your progress from a file'
                )}
              >
                <UploadSimple size={16} weight="duotone" aria-hidden="true" />
                <span>
                  {tString('community.dataCard.restore', 'Restore')}
                </span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                className={styles.dataCardFileInput}
                onChange={handleRestoreChange}
                tabIndex={-1}
                aria-hidden="true"
              />
            </div>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>
              {tString('community.section.title', 'What should we build next?')}
            </h3>
            <p className={styles.sectionSubtitle}>
              {tString(
                'community.section.subtitle',
                "Browse what's on the table."
              )}
            </p>
            <p className={styles.sectionNotice}>
              {tString(
                'community.section.notice',
                'Voting opens in the near future. Your voting power is already counted.'
              )}
            </p>
          </section>

          <TopicsList />

          <HowItWorks
            defaultOpen={howDefaultOpen}
            threshold={snapshot?.coSignThreshold ?? 3}
            phase={snapshot?.thresholdPhase ?? null}
            slots={slots}
          />
        </div>
      </div>
    </ModalContainer>
  );
};

export default CommunityGovernanceModal;
