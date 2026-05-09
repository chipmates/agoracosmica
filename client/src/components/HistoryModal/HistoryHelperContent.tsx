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
          {/* Quick Guide */}
          <div style={{
            background: 'linear-gradient(135deg, color-mix(in srgb, var(--gold-subtle) 8%, transparent), color-mix(in srgb, var(--gold-subtle) 3%, transparent))',
            borderRadius: '8px',
            padding: '0.75rem',
            marginBottom: '1rem',
            border: '1px solid color-mix(in srgb, var(--gold-subtle) 15%, transparent)'
          } as CSSProperties}>
            <h4 style={{
              color: 'var(--gold-subtle)',
              marginBottom: '0.5rem',
              fontSize: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontWeight: 600
            } as CSSProperties}>
              <BookOpen size={18} style={{ color: 'var(--gold-subtle)' }} />
              {tNode('helpers.historyModal.welcome.sections.overview.title')}
            </h4>
            <p style={{ margin: 0, opacity: 0.9, paddingLeft: '26px', lineHeight: 1.5 } as CSSProperties}>
              {tNode('helpers.historyModal.welcome.sections.overview.text')}
            </p>
          </div>

          {/* Key Actions */}
          <div style={{ marginBottom: '1rem' }}>
            <h4 style={{
              color: 'var(--gold-subtle)',
              marginBottom: '0.5rem',
              fontSize: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontWeight: 600
            } as CSSProperties}>
              <Archive size={18} style={{ color: 'var(--gold-subtle)' }} />
              {tNode('helpers.historyModal.welcome.sections.actions.title')}
            </h4>
            <ul style={{
              margin: 0,
              paddingLeft: '26px',
              opacity: 0.9,
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
                    {Icon && <Icon size={14} style={{ color: 'var(--gold-subtle)', flexShrink: 0 }} />}
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
            padding: '0.5rem 0.75rem',
            background: 'color-mix(in srgb, var(--gold-subtle) 5%, transparent)',
            borderRadius: '6px',
            fontSize: '0.85rem',
            opacity: 0.9
          } as CSSProperties}>
            <Lightbulb size={14} style={{ color: 'var(--gold-subtle)', flexShrink: 0 }} />
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
