import { FC, CSSProperties, ReactNode } from 'react';
import { Download, Trash, Funnel, Archive, BookOpen, Lightbulb, Sparkle as SparklePhosphor } from '@phosphor-icons/react';
import HelperPopup from '../HelperPopup/HelperPopup';

interface HistoryHelperContentProps {
  showHistoryHelp: boolean;
  onDismiss: () => void;
  onDontShowAgain: () => void;
  tString: (key: string, fallback: string) => string;
  tNode: (key: string) => ReactNode;
  tArray: (key: string) => string[];
}

const HistoryHelperContent: FC<HistoryHelperContentProps> = ({
  showHistoryHelp,
  onDismiss,
  onDontShowAgain,
  tString,
  tNode,
  tArray
}) => {
  if (!showHistoryHelp) return null;

  return (
    <HelperPopup
      isOpen={true}
      onDismiss={onDismiss}
      title={tString('helpers.historyModal.welcome.title', 'History Overview')}
      content={
        <div style={{ fontSize: '0.95rem' }}>
          {/* Quick Guide — night plate, one gold hairline */}
          <div style={{
            background: 'color-mix(in srgb, var(--bg-void) 45%, transparent)',
            borderRadius: '3px',
            padding: '0.75rem',
            marginBottom: '1rem',
            border: '1px solid color-mix(in srgb, var(--gold-deep) 40%, transparent)'
          } as CSSProperties}>
            {/* h4 inherits the shared kicker doctrine from HelperPopup.css */}
            <h4>
              <BookOpen size={16} style={{ color: 'var(--gold-deep)' }} />
              {tNode('helpers.historyModal.welcome.sections.overview.title')}
            </h4>
            <p style={{ margin: 0, paddingLeft: '24px', lineHeight: 1.5 } as CSSProperties}>
              {tNode('helpers.historyModal.welcome.sections.overview.text')}
            </p>
          </div>

          {/* Key Actions */}
          <div style={{ marginBottom: '1rem' }}>
            <h4>
              <Archive size={16} style={{ color: 'var(--gold-deep)' }} />
              {tNode('helpers.historyModal.welcome.sections.actions.title')}
            </h4>
            <ul style={{
              margin: 0,
              paddingLeft: '24px',
              fontSize: '0.9rem',
              listStyle: 'none'
            } as CSSProperties}>
              {tArray('helpers.historyModal.welcome.sections.actions.points').map((point: string, i: number) => {
                const icons = [Download, Trash, SparklePhosphor, Funnel];
                const Icon = icons[i];
                return (
                  <li key={i} style={{
                    marginBottom: '0.35rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  } as CSSProperties}>
                    {Icon && <Icon size={14} style={{ color: 'var(--gold-deep)', flexShrink: 0 }} />}
                    <span>{point}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Pro Tip */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.6rem 0.75rem',
            background: 'none',
            border: '1px solid color-mix(in srgb, var(--gold-deep) 28%, transparent)',
            borderRadius: '3px',
            fontSize: '0.85rem'
          } as CSSProperties}>
            <Lightbulb size={14} style={{ color: 'var(--gold-deep)', flexShrink: 0 }} />
            <span>{tNode('helpers.historyModal.welcome.sections.tip.text')}</span>
          </div>
        </div>
      }
      buttonText={tString('helpers.common.gotIt', 'Got it!')}
      showDontAskAgain={true}
      onDontAskAgain={onDontShowAgain}
    />
  );
};

export default HistoryHelperContent;
