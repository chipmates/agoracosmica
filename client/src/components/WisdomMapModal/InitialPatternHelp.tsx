// InitialPatternHelp_NEW.js - Using the global HelperPopup component
import React, { FC, CSSProperties, ReactNode } from 'react';
import HelperPopup from '../HelperPopup/HelperPopup';
import useTranslation from '../../hooks/useTranslation';
import { useUIStore } from '../../stores/uiStore';
import { Sparkle, BookOpen, TrendUp, Star, Books, List, ShieldCheck, Wrench, Crosshair, Cursor } from '@phosphor-icons/react';

type RevelationStage = 'void' | 'awakening' | 'emergence' | 'forming' | 'complete';

interface InitialPatternHelpProps {
  onDismiss: () => void;
  revelationStage: RevelationStage;
  isFirstTime?: boolean;
}

const InitialPatternHelp: FC<InitialPatternHelpProps> = ({
  onDismiss,
  revelationStage,
  isFirstTime = true
}) => {
  const { t, tString, tNode, tArray } = useTranslation();

  // Help preferences from Zustand
  const dismissHelp = useUIStore((state) => state.dismissHelp);

  // Handle "don't show again" preference
  const handleDontAskAgain = (): void => {
    dismissHelp('hideWisdomMapHelp');
  };
  
  // Build the content based on what view we're in
  const getContent = (): ReactNode => {
    // For first-time users, show structured welcome with sections
    if (isFirstTime) {
      return (
        <div style={{ fontSize: '0.95rem' }}>
          {/* Overview - What are Star Seeds? */}
          <div style={{ 
            marginBottom: '1rem',
            background: 'linear-gradient(135deg, rgba(212, 165, 57, 0.08), rgba(212, 165, 57, 0.03))',
            borderRadius: '8px',
            padding: '0.75rem',
            border: '1px solid rgba(212, 165, 57, 0.15)'
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
              <Sparkle size={18} style={{ color: 'var(--gold-subtle)' }} />
              {tNode('helpers.starseeds.welcome.sections.overview.title')}
            </h4>
            <p style={{ margin: 0, opacity: 0.9, paddingLeft: '26px', lineHeight: 1.5 } as CSSProperties}>
              {tNode('helpers.starseeds.welcome.sections.overview.text')}
            </p>
          </div>
          
          {/* How to Play */}
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
              <BookOpen size={18} style={{ color: 'var(--gold-subtle)' }} />
              {tNode('helpers.starseeds.welcome.sections.howToPlay.title')}
            </h4>
            <ul style={{
              margin: 0,
              paddingLeft: '26px',
              opacity: 0.9,
              fontSize: '0.9rem',
              listStyle: 'none'
            } as CSSProperties}>
              {tArray('helpers.starseeds.welcome.sections.howToPlay.points').map((point: string, i: number) => {
                  const icons = [Star, Cursor, Crosshair, Books];
                  const Icon = icons[i];
                  return (
                    <li key={i} style={{ 
                      marginBottom: '0.35rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    } as CSSProperties}>
                      {Icon && <Icon size={14} style={{ color: 'var(--gold-subtle)', opacity: 0.7, flexShrink: 0 }} />}
                      <span>{point}</span>
                    </li>
                  );
                })}
            </ul>
          </div>
          
          {/* Constellation — gamification highlight */}
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
              <TrendUp size={18} style={{ color: 'var(--gold-subtle)' }} />
              {tString('helpers.starseeds.welcome.sections.constellation.title', 'Your Constellation')}
            </h4>
            <p style={{ margin: 0, opacity: 0.9, paddingLeft: '26px', lineHeight: 1.5 } as CSSProperties}>
              {tString('helpers.starseeds.welcome.sections.constellation.text', 'Your constellation grows with every completed chapter.')}
            </p>
            <p style={{ margin: '0.5rem 0 0', opacity: 0.75, paddingLeft: '26px', lineHeight: 1.5, fontSize: '0.85rem', fontStyle: 'italic' } as CSSProperties}>
              {tString(
                'helpers.starseeds.welcome.sections.constellation.chapterCompletion',
                "Each chapter unlocks a star seed when you've gone deep enough. About 15 exchanges in Wisdom dialogue, the full story listened, the prism explored, and the quest's 4 questions answered."
              )}
            </p>
          </div>

          {/* Tools: Liste + Fakten + Progress */}
          <div style={{
            background: 'rgba(212, 165, 57, 0.05)',
            borderRadius: '6px',
            padding: '0.75rem'
          }}>
            <h4 style={{
              color: 'var(--gold-subtle)',
              marginBottom: '0.5rem',
              fontSize: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontWeight: 600
            } as CSSProperties}>
              <Wrench size={18} style={{ color: 'var(--gold-subtle)' }} />
              {tString('helpers.starseeds.welcome.sections.tools.title', 'More tools')}
            </h4>
            <ul style={{
              margin: 0,
              paddingLeft: '26px',
              opacity: 0.9,
              fontSize: '0.9rem',
              listStyle: 'none'
            } as CSSProperties}>
              {tArray('helpers.starseeds.welcome.sections.tools.points').map((point: string, i: number) => {
                const icons = [List, ShieldCheck, TrendUp];
                const Icon = icons[i];
                return (
                  <li key={i} style={{
                    marginBottom: '0.35rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  } as CSSProperties}>
                    {Icon && <Icon size={14} style={{ color: 'var(--gold-subtle)', opacity: 0.7, flexShrink: 0 }} />}
                    <span>{point}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      );
    }
    
    // For returning users, show revelation stage-specific help
    const getRevelationMessage = (): string => {
      switch (revelationStage) {
        case 'void':
          return tString('helpers.starseeds.revelation.void', 'Begin collecting wisdom seeds to awaken the constellation pattern.');
        case 'awakening':
          return tString('helpers.starseeds.revelation.awakening', 'First cosmic awakening! Faint constellation lines begin to emerge.');
        case 'emergence':
          return tString('helpers.starseeds.revelation.emergence', 'The pattern emerges! Mix of solid and dotted lines reveal the constellation shape.');
        case 'forming':
          return tString('helpers.starseeds.revelation.forming', 'Constellation forming! The wisdom pattern becomes clear with brilliant golden lines.');
        case 'complete':
          return tString('helpers.starseeds.revelation.complete', 'Wisdom complete! The constellation shines in full golden glory.');
        default:
          return tString('helpers.starseeds.patternHelp.zodiacText', 'Explore the constellation pattern.');
      }
    };
    
    return (
      <div>
        <p style={{ marginTop: '0.5rem' }}>
          {getRevelationMessage()}
        </p>
      </div>
    );
  };
  
  // Determine the title based on context
  const getRevelationTitle = (): string => {
    if (isFirstTime) {
      return tString('helpers.starseeds.welcome.title', 'Welcome to the Wisdom Constellation');
    }

    switch (revelationStage) {
      case 'void':
        return tString('helpers.starseeds.revelation.title.void', 'Cosmic Void');
      case 'awakening':
        return tString('helpers.starseeds.revelation.title.awakening', 'First Awakening');
      case 'emergence':
        return tString('helpers.starseeds.revelation.title.emergence', 'Pattern Emergence');
      case 'forming':
        return tString('helpers.starseeds.revelation.title.forming', 'Constellation Forming');
      case 'complete':
        return tString('helpers.starseeds.revelation.title.complete', 'Wisdom Complete');
      default:
        return tString('helpers.starseeds.patternHelp.zodiacTitle', 'Constellation Guide');
    }
  };

  const title = getRevelationTitle();

  const buttonText = tString('helpers.common.beginExploring', tString('common.beginExploring', 'Begin Exploring'));
  
  return (
    <HelperPopup
      isOpen={true}
      onDismiss={onDismiss}
      title={title}
      content={getContent()}
      buttonText={buttonText}
      showDontAskAgain={true}
      onDontAskAgain={handleDontAskAgain}
    />
  );
};

export default InitialPatternHelp;